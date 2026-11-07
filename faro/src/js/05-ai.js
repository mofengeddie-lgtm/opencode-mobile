'use strict';
// Bots (NPC): cada uno tiene una personalidad. Construyen economía, se expanden, planifican un
// ejército mixto que contrarresta al enemigo, agrupan sus oleadas, se retiran heridos, reparan,
// capturan puntos (también cruzando el mar) y hablan con el jugador.

const unitCat = (u) => (u.cls === 'ship' || u.cls === 'sub' ? 'sea' : u.cls);

class Bot {
  constructor(game, pid) {
    this.g = game;
    this.pid = pid;
    const p = game.players[pid];
    this.pkey = p.persona || 'aggro';
    this.persona = PERSONALITIES[this.pkey];
    this.tac = game.diff.tactics;
    this.t = 1 + Math.random() * 2;
    this.wave = Math.max(4, Math.round(game.diff.wave * this.persona.waveSize));
    this.nextWaveAt = game.diff.firstWave * this.persona.firstWave + Math.random() * 30;
    this.claimed = new Set();
    this.defendT = 0;
    // Dos bolsas: economía (edificios, expansión) y ejército (tropas).
    this.ecoBank = p.coins * 0.75;
    this.milBank = p.coins * 0.25;
    this.lastT = 0;
    this.saveFor = null;
    this.raid = null;
    this.threatAt = -99;
    this.ferryTrips = 0;
    // Métricas para las pruebas.
    this.wavesSent = 0;
    this.waveSizes = [];
    this.retreats = 0;
    this.repairs = 0;
    this.firstWaveAt = -1;
  }

  get p() {
    return this.g.players[this.pid];
  }

  update(dt) {
    if (!this.p.alive) return;
    this.t -= dt;
    this.defendT -= dt;
    if (this.t > 0) return;
    this.t = this.g.diff.think * (0.8 + Math.random() * 0.4);
    this.think();
  }

  targetArmy() {
    return 3 + Math.floor(this.g.time / 22);
  }

  think() {
    const g = this.g;
    const p = this.p;
    g.refreshEconomy();
    const mine = g.buildings.filter((b) => b.alive && b.owner === this.pid);
    const units = g.units.filter((u) => u.alive && u.owner === this.pid);
    const army = units.filter((u) => u.def.weapon).length;

    // Reparte lo ganado desde la última decisión entre las dos bolsas.
    const gained = (p.income * g.incomeMult(p) * (g.time - this.lastT)) / 60;
    this.lastT = g.time;
    const T = g.time;
    const base = T < 50 ? 0.2 : army < this.targetArmy() ? (T < 240 ? 0.45 : 0.55) : 0.38;
    const milShare = clamp(base + (T < 50 ? 0 : this.persona.milShare), 0.1, 0.75);
    this.milBank += gained * milShare;
    this.ecoBank += gained * (1 - milShare);
    const total = this.milBank + this.ecoBank;
    if (total > p.coins) {
      // Gastos no anotados (puestos, barcos ingenieros): salen primero de la economía.
      let excess = total - p.coins;
      const fromEco = Math.min(this.ecoBank, excess);
      this.ecoBank -= fromEco;
      excess -= fromEco;
      this.milBank = Math.max(0, this.milBank - excess);
    } else if (total < p.coins) {
      this.ecoBank += p.coins - total;
    }

    this.defend(units);
    this.build(mine);
    this.expand(mine, units);
    this.produce(mine, units);
    if (this.tac.retreat) this.retreat(units, mine);
    this.repairBase(units, mine);
    this.attack(units);
    this.ferry(mine, units);
  }

  coreCell() {
    return this.g.cells[this.p.core.cell];
  }

  // ---------- construcción ----------
  build(mine) {
    const g = this.g;
    const p = this.p;
    const T = g.time;
    const n = (t) => mine.filter((b) => b.type === t).length;
    const ownFree = (terrain) => g.cells.some((c) => c.owner === this.pid && c.t === terrain && !c.bld);
    const coast = g.cells.some((c) => c.owner === this.pid && c.t === 'shallow' && !c.bld && g.map.isCoast(c));
    const easy = g.opts.difficulty === 'easy';
    const plan = this.persona.plan;
    const want = [];
    const open = g.opts.mapKind === 'open';
    // Base castigada por buques, aeronaves o artillería (o Núcleo muy dañado): Cúpula primero.
    const shelled = p.navalHitAt !== undefined && T - p.navalHitAt < 90;
    if (!p.dome && T > 200 && (shelled || p.core.hp < p.core.maxHp * 0.8)) want.push('dome');
    if (n('farm') < 2) want.push('farm');
    if (n('barracks') < 1 && T > 10) want.push('barracks');
    if (this.persona.harborFirst && coast && n('harbor') < 1 && T > 60) want.push('harbor');
    // Mucho dinero militar sin gastar: hace falta más capacidad de producción.
    if (this.milBank > 2500) {
      if (!open && n('factory') < 2 && T > 240) want.push('factory');
      else if (n('barracks') < 3) want.push('barracks');
    }
    if (n('farm') < 4) want.push('farm');
    // La Fábrica entra pronto en la lista: sin ella el ejército solo puede ser infantería.
    const factoryAt = plan.veh >= 3 ? 120 : 170;
    if (n('factory') < 1 && T > (open ? 300 : factoryAt)) want.push('factory');
    const heavyNow = n('factory') + n('harbor') + n('helipad');
    if (n('mill') < 1 && (heavyNow > 0 || T > 240)) want.push('mill');
    if (p.popCap - p.popUsed < 6 && p.popCap < MAX_POP) {
      const houseUp = mine.find((b) => b.type === 'house' && b.built && (b.level || 1) < HOUSE_LEVELS.length);
      if (n('house') < g.limitFor(this.pid, 'house')) want.push('house');
      else if (houseUp) want.push('houseUp');
    }
    const heavy = n('factory') + n('harbor') + n('helipad');
    if (heavy && p.energy < 60 && n('mill') < Math.min(4, 1 + n('factory') + n('helipad'))) want.push('mill');
    if (ownFree('gold') && n('mine') < 2) want.push('mine');
    if (n('harbor') < 1 && coast && open) want.push('harbor');
    if (ownFree('gold')) want.push('mine');
    if (n('harbor') < 1 && coast && T > (plan.sea >= 3 ? 90 : 240)) want.push('harbor');
    const enemyAir = g.units.some((u) => u.cls === 'air' && g.isEnemy(u.owner, this.pid));
    if (enemyAir && n('aadef') < 2 && T > 180) want.push('aadef');
    const farmsBuilt = mine.filter((b) => b.type === 'farm' && b.built).length;
    if (T > 270 && farmsBuilt && n('pump') < Math.min(6, Math.floor((T - 220) / 70))) want.push('pump');
    const turretCap = Math.round(4 * this.persona.turrets);
    if (n('turret') < Math.min(turretCap, Math.floor(((T - 60) * this.persona.turrets) / 120))) want.push('turret');
    if (ownFree('oil')) want.push('rig');
    if (!easy && plan.air >= 1 && n('helipad') < 1 && T > (plan.air >= 2 ? 300 : 380)) want.push('helipad');
    if (n('farm') < Math.min(8, 3 + Math.floor(T / 70))) want.push('farm');
    if (n('barracks') < 2 && T > 280) want.push('barracks');
    if (n('hospital') < 1 && T > (this.tac.retreat ? 300 : 420)) want.push('hospital');
    if (n('factory') < 2 && T > 480 && !open) want.push('factory');
    if (n('harbor') < 2 && coast && T > (plan.sea >= 3 ? 300 : 420)) want.push('harbor');

    if (!want.length) {
      // Nada que construir: el dinero de economía pasa al ejército.
      this.milBank += this.ecoBank * 0.5;
      this.ecoBank *= 0.5;
      return;
    }
    let actions = 0;
    for (const type of want) {
      if (actions >= 2) break;
      if (type === 'houseUp') {
        const h = mine.find((b) => b.type === 'house' && b.built && (b.level || 1) < HOUSE_LEVELS.length);
        const hc = h ? g.upgradeCost(h) : 0;
        if (!h || this.ecoBank < hc) break;
        if (typeof g.upgrade(h) !== 'string') {
          this.ecoBank -= hc;
          actions++;
        }
        continue;
      }
      if (type === 'dome') {
        if (this.ecoBank + this.milBank < DOME.cost) break;
        if (!g.buyDome(this.pid)) {
          const fromEco = Math.min(this.ecoBank, DOME.cost);
          this.ecoBank -= fromEco;
          this.milBank = Math.max(0, this.milBank - (DOME.cost - fromEco));
          actions++;
        }
        continue;
      }
      const cost = BUILDINGS[type].cost;
      if (this.ecoBank < cost || p.coins < cost) break;
      if (BUILDINGS[type].energyCost && p.energy < BUILDINGS[type].energyCost) continue;
      if (type === 'pump') {
        const farm = mine.find((b) => b.alive && b.type === 'farm' && b.built);
        if (farm && typeof g.upgrade(farm) !== 'string') {
          this.ecoBank -= cost;
          actions++;
        }
        continue;
      }
      const ci = this.pickCell(type);
      if (ci < 0) continue;
      if (!g.place(this.pid, type, ci)) {
        this.ecoBank -= cost;
        actions++;
      }
    }
  }

  pickCell(type) {
    const g = this.g;
    const core = this.coreCell();
    let best = -1;
    let bestS = Infinity;
    const toCenter = Math.hypot(core.x, core.z) || 1;
    for (const c of g.cells) {
      if (c.owner !== this.pid || c.bld || c.bridge) continue;
      if (g.placeInvalid(this.pid, type, c.i)) continue;
      const d = g.map.dist(c, core);
      if (d < 2 && type !== 'turret') continue;
      let s = Math.random() * 1.5;
      if (type === 'turret') {
        const dot = -(c.x * core.x + c.z * core.z) / toCenter;
        s += Math.abs(d - 2.5) * 2 - dot * 0.3;
      } else if (type === 'farm' || type === 'house') {
        s += Math.abs(d - 3);
      } else if (type === 'mine' || type === 'rig' || type === 'harbor') {
        s += d * 0.3;
      } else {
        s += d * 1.2;
      }
      // Evita tapar el paso: penaliza casillas con pocas vecinas libres.
      let free = 0;
      for (const ni of c.nb) {
        const nc = g.cells[ni];
        if (TERRAIN[nc.t].land && !nc.bld) free++;
      }
      if (TERRAIN[c.t].land && free < 3) s += 4;
      if (s < bestS) { bestS = s; best = c.i; }
    }
    return best;
  }

  // ---------- expansión ----------
  expand(mine, units) {
    const g = this.g;
    const T = g.time;
    if (T < 25) return;
    const outposts = mine.filter((b) => b.type === 'outpost').length;
    const maxOut = Math.min(6, 2 + Math.floor(T / 200));
    const busy = units.filter((u) => u.def.founds && u.state === 'found');
    if (outposts + busy.length >= maxOut) return;
    this.claimed = new Set(busy.map((u) => u.foundCell));

    const landEng = units.filter((u) => u.type === 'engineer' && u.state !== 'found' && u.state !== 'repair');
    const target = this.findExpansion('land');
    if (target >= 0) {
      if (landEng.length) {
        if (this.p.coins >= BUILDINGS.outpost.cost) g.orderFound(landEng[0], target);
      } else {
        this.queueOnce(mine, 'barracks', 'engineer');
      }
    }
    const harbors = mine.filter((b) => b.type === 'harbor' && b.built);
    if (harbors.length && T > 140) {
      const boats = units.filter((u) => u.type === 'boatEng' && u.state !== 'found');
      const st = this.findExpansion('sea');
      if (st >= 0) {
        if (boats.length) {
          if (this.p.coins >= BUILDINGS.outpost.cost) g.orderFound(boats[0], st);
        } else if ((this.boatEngs || 0) < 3 && this.ecoBank >= UNITS.boatEng.cost + BUILDINGS.outpost.cost) {
          if (this.queueOnce(mine, 'harbor', 'boatEng')) this.boatEngs = (this.boatEngs || 0) + 1;
        }
      }
    }
  }

  queueOnce(mine, btype, utype) {
    const g = this.g;
    const builders = mine.filter((b) => b.type === btype && b.built);
    if (!builders.length) return false;
    if (builders.some((b) => b.queue.some((q) => q.type === utype))) return false;
    if (g.units.some((u) => u.owner === this.pid && u.type === utype)) return false;
    if (g.enqueue(builders[0], utype)) return false;
    // Barcaza: gasto militar. Ingenieros: gasto de expansión.
    if (utype === 'barge') this.milBank = Math.max(0, this.milBank - UNITS[utype].cost);
    else this.ecoBank = Math.max(0, this.ecoBank - UNITS[utype].cost);
    return true;
  }

  findExpansion(how) {
    const g = this.g;
    const core = this.coreCell();
    let best = -1;
    let bestS = Infinity;
    for (const r of g.cells) {
      if ((r.t !== 'gold' && r.t !== 'oil') || r.owner !== -1 || r.bld) continue;
      if (how === 'land' && r.t === 'oil') continue;
      for (const off of SPIRAL) {
        if (off.d > 2) break;
        const c = g.map.get(r.q + off.q, r.r + off.r);
        if (!c || this.claimed.has(c.i) || c.owner !== -1) continue;
        if (g.foundInvalid(this.pid, c.i, how)) continue;
        if (how === 'land' && c.comp !== core.comp) continue;
        const s = g.map.dist(c, core) + off.d * 0.5;
        if (s < bestS) { bestS = s; best = c.i; }
      }
    }
    return best;
  }

  // ---------- producción: plan de ejército y contrarrestos ----------
  enemyMix() {
    const g = this.g;
    const mix = { inf: 0, veh: 0, sea: 0, air: 0, total: 0 };
    for (const u of g.units) {
      if (!u.alive || !u.def.weapon || !g.isEnemy(u.owner, this.pid)) continue;
      mix[unitCat(u)]++;
      mix.total++;
    }
    for (const k of ['inf', 'veh', 'sea', 'air']) mix[k] = mix.total ? mix[k] / mix.total : 0;
    return mix;
  }

  pickUnit(producers, units) {
    const g = this.g;
    const T = g.time;
    const open = g.opts.mapKind === 'open';
    const cats = {};
    for (const b of producers) {
      if (b.type === 'barracks') cats.inf = 'barracks';
      else if (b.type === 'factory') cats.veh = 'factory';
      else if (b.type === 'harbor') cats.sea = 'harbor';
      else if (b.type === 'helipad') cats.air = 'helipad';
    }
    const have = { inf: 0, veh: 0, sea: 0, air: 0 };
    for (const u of units) if (u.def.weapon) have[unitCat(u)]++;
    for (const b of producers) {
      for (const q of b.queue) if (UNITS[q.type].weapon) have[unitCat(UNITS[q.type])]++;
    }
    const plan = { ...this.persona.plan };
    if (open) {
      plan.sea += 2;
      plan.inf = Math.max(1, plan.inf - 1);
    }
    // Energía acumulada: prioriza tropas que la usan.
    if (this.p.energy > 120) {
      plan.veh += 2;
      plan.sea += 1;
      plan.air += 1;
    }
    const mix = this.enemyMix();
    if (this.tac.counter && mix.total >= 3) {
      if (mix.air >= 0.12) plan.veh += 2;
      if (mix.sea >= 0.25) plan.sea += 2;
      if (mix.veh >= 0.3) plan.inf += 1;
    }
    // Recién empezada la partida, o bajo ataque: infantería rápida.
    const urgent = T < 120 || g.time - this.threatAt < 12;
    let avail = Object.keys(cats);
    if (urgent && cats.inf) avail = ['inf'];
    let best = null;
    let bestGap = -Infinity;
    const planSum = avail.reduce((s, c) => s + plan[c], 0) || 1;
    const haveSum = avail.reduce((s, c) => s + have[c], 0) || 1;
    for (const c of avail) {
      const gap = plan[c] / planSum - have[c] / haveSum + Math.random() * 0.05;
      if (gap > bestGap) { bestGap = gap; best = c; }
    }
    if (!best) return null;
    return { type: this.unitFor(best, mix, have, units), btype: cats[best], since: T };
  }

  unitFor(cat, mix, have, units) {
    const T = this.g.time;
    const r = Math.random();
    const counter = this.tac.counter && mix.total >= 3;
    if (cat === 'inf') {
      if (T < 90) return 'rifle';
      if (counter && mix.veh >= 0.3) return r < 0.65 ? 'rocket' : 'rifle';
      if (counter && mix.inf >= 0.6) return r < 0.4 ? 'sniper' : 'rifle';
      return r < 0.45 ? 'rifle' : r < 0.8 ? 'rocket' : 'sniper';
    }
    if (cat === 'veh') {
      const aaHave = units.filter((u) => u.type === 'aa').length;
      if (counter && mix.air >= 0.12 && aaHave < 3) return 'aa';
      if (counter && mix.veh >= 0.3) return r < 0.7 ? 'tank' : 'jeep';
      if (counter && mix.inf >= 0.6) return r < 0.55 ? 'jeep' : 'tank';
      if (mix.air > 0 && aaHave < 1) return 'aa';
      return r < 0.45 ? 'tank' : r < 0.8 || T < 300 ? 'jeep' : 'arty';
    }
    if (cat === 'sea') {
      if (counter && mix.sea >= 0.25) return r < 0.5 ? 'destroyer' : 'sub';
      return r < 0.55 ? 'destroyer' : r < 0.85 ? 'speedboat' : 'sub';
    }
    return 'heli';
  }

  produce(mine, units) {
    const g = this.g;
    const p = this.p;
    const producers = mine.filter((b) => b.built && b.def.produces);
    if (!producers.length) {
      this.ecoBank += this.milBank;
      this.milBank = 0;
      return;
    }
    let budget = Math.min(p.coins, this.milBank);
    for (let k = 0; k < 3; k++) {
      if (!this.saveFor || !producers.some((b) => b.type === this.saveFor.btype)) this.saveFor = this.pickUnit(producers, units);
      const s = this.saveFor;
      if (!s) return;
      const def = UNITS[s.type];
      const b = producers.filter((x) => x.type === s.btype && x.queue.length < 2)
        .sort((a, c) => a.queue.length - c.queue.length)[0];
      if (!b) return;
      if (def.cost > budget || p.energy < (def.energy || 0)) {
        // Ahorra para esta tropa; si tarda demasiado, vuelve a planificar.
        if (g.time - s.since > 70) this.saveFor = null;
        return;
      }
      const err = g.enqueue(b, s.type);
      this.saveFor = null;
      if (err) return;
      budget -= def.cost;
      this.milBank -= def.cost;
    }
  }

  // ---------- combate ----------
  defend(units) {
    const g = this.g;
    if (this.defendT > 0) return;
    this.defendT = 2;
    const core = this.coreCell();
    let threat = null;
    let td = Infinity;
    for (const e of g.units) {
      if (!e.alive || e.inside || !g.isEnemy(e.owner, this.pid)) continue;
      const c = g.cells[e.cell];
      const d = g.map.dist(c, core);
      if (c.owner === this.pid || d <= 5) {
        if (d < td) { td = d; threat = e; }
      }
    }
    if (!threat) return;
    // Urgencia (comprar infantería rápida) solo si el peligro está junto al Núcleo y el ejército es pequeño.
    const armySize = units.filter((u) => u.def.weapon).length;
    if (td <= 4 && armySize < 8) this.threatAt = g.time;
    // Una oleada que se estaba reuniendo vuelve a defender si el peligro está cerca del Núcleo.
    if (this.raid && td <= 4) {
      for (const u of this.raid.units) if (u.alive && u.role === 'raid') u.role = 'home';
      this.raid = null;
    }
    const guards = units.filter((u) => u.def.weapon && u.role === 'home' && !u.inside &&
      (u.state === 'idle' || u.state === 'move') && g.canAttack(u, u.def.weapon, threat));
    const byMover = { land: [], sea: [], air: [] };
    for (const u of guards) byMover[u.mover].push(u);
    const tc = g.cells[threat.cell];
    if (byMover.land.length && TERRAIN[tc.t].land) g.orderMove(byMover.land, tc.i, true);
    if (byMover.air.length) g.orderMove(byMover.air, tc.i, true);
    if (byMover.sea.length) {
      const wc = this.waterNear(tc, byMover.sea[0]);
      if (wc >= 0) g.orderMove(byMover.sea, wc, true);
    }
  }

  // Tropas con menos del 30 % de vida vuelven a curarse y luego regresan.
  retreat(units, mine) {
    const g = this.g;
    const core = this.p.core;
    for (const u of units) {
      if (!u.def.weapon || u.inside) continue;
      if (u.role === 'retreat') {
        if (u.hp >= u.maxHp * 0.85) {
          u.role = 'home';
          u.state = 'idle';
        } else if (u.state === 'idle' && u.retreatTo >= 0 && g.map.dist(g.cells[u.cell], g.cells[u.retreatTo]) > 2) {
          g.orderMove([u], u.retreatTo, false);
        }
        continue;
      }
      if (u.hp >= u.maxHp * 0.3) continue;
      const comp = g.cells[u.cell].comp;
      let spot = null;
      let sd = Infinity;
      const consider = (b) => {
        if (!b.alive || !b.built) return;
        const bc = g.cells[b.cell];
        if (u.mover === 'land' && bc.comp !== comp) return;
        if (u.mover === 'sea' && !bc.nb.some((ni) => g.cells[ni].comp === comp) && bc.comp !== comp) return;
        const d = g.map.dist(bc, g.cells[u.cell]);
        if (d < sd) { sd = d; spot = b; }
      };
      if (u.mover === 'sea') {
        for (const b of mine) if (b.type === 'harbor') consider(b);
      } else {
        if (u.mover === 'land') for (const b of mine) if (b.type === 'hospital') consider(b);
        if (!spot || sd > 8) consider(core);
      }
      if (!spot) continue;
      const dest = g.freeCellsNear(spot.cell, u.mover, this.pid, 1)[0];
      u.role = 'retreat';
      u.retreatTo = dest;
      u.target = null;
      if (this.raid) this.raid.units = this.raid.units.filter((x) => x !== u);
      g.orderMove([u], dest, false);
      this.retreats++;
    }
  }

  // Ingenieros libres reparan los edificios dañados de la base.
  repairBase(units, mine) {
    const g = this.g;
    const engs = units.filter((u) => u.def.repairs && u.state === 'idle' && !u.inside);
    if (!engs.length) return;
    const damaged = mine.filter((b) => b.built && b.hp < b.maxHp * 0.9 && g.time - b.lastHit > REPAIR.pause)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    for (const b of damaged) {
      const bc = g.cells[b.cell];
      const e = engs.find((x) => g.cells[x.cell].comp === bc.comp || bc.nb.some((ni) => g.cells[ni].comp === g.cells[x.cell].comp));
      if (!e) continue;
      g.orderRepair([e], b);
      engs.splice(engs.indexOf(e), 1);
      this.repairs++;
      if (!engs.length) return;
    }
  }

  waterNear(target, ship) {
    const g = this.g;
    const comp = g.cells[ship.cell].comp;
    for (const off of SPIRAL) {
      if (off.d > 5) break;
      const c = g.map.get(target.q + off.q, target.r + off.r);
      if (c && TERRAIN[c.t].water && !c.bld && c.comp === comp) return c.i;
    }
    return -1;
  }

  coastNear(target, ship) {
    const g = this.g;
    const comp = g.cells[ship.cell].comp;
    for (const off of SPIRAL) {
      if (off.d > 6) break;
      const c = g.map.get(target.q + off.q, target.r + off.r);
      if (c && TERRAIN[c.t].water && !c.bld && c.comp === comp && g.map.isCoast(c)) return c.i;
    }
    return -1;
  }

  // Banderas sin dueño de tu equipo a las que no se llega por tierra.
  farFlags() {
    const g = this.g;
    const core = this.coreCell();
    const team = this.p.team;
    return g.points.filter((pt) => pt.type === 'flag' && (pt.owner < 0 || g.players[pt.owner].team !== team) &&
      g.cells[pt.cell].comp !== core.comp)
      .sort((a, b) => g.map.dist(g.cells[a.cell], core) - g.map.dist(g.cells[b.cell], core));
  }

  // Barcaza: lleva tropas a islas sin camino por tierra (Núcleos enemigos, el Faro o Banderas).
  ferry(mine, units) {
    const g = this.g;
    if (g.time < 200 || !mine.some((b) => b.type === 'harbor' && b.built)) return;
    const core = this.coreCell();
    const landReach = g.players.some((p) => p.alive && g.isEnemy(p.id, this.pid) && p.core.alive &&
      g.cells[p.core.cell].comp === core.comp);
    const faro = g.points.find((pt) => pt.type === 'faro');
    const faroByLand = !g.mode.king || !faro || g.cells[faro.cell].comp === core.comp;
    const flagsWanted = this.farFlags().length > 0 &&
      (!landReach || this.pkey === 'admiral' || this.pkey === 'keeper' || g.time > 420);
    if (landReach && faroByLand && !flagsWanted) return;
    const t = units.find((u) => u.type === 'barge');
    if (!t) {
      this.queueOnce(mine, 'harbor', 'barge');
      return;
    }
    t.botMode = t.botMode || 'load';
    if (t.botMode === 'load') {
      if (t.state !== 'idle') return;
      if (g.map.dist(g.cells[t.cell], core) > 7) {
        const wc = this.coastNear(core, t);
        if (wc >= 0) g.orderMove([t], wc);
        return;
      }
      const boarding = units.filter((u) => u.state === 'board' && u.boardTarget === t);
      let slots = t.def.capacity - g.cargoSlots(t) - boarding.reduce((s, u) => s + (u.cls === 'veh' ? 2 : 1), 0);
      const pick = [];
      for (const u of units) {
        if (u.mover !== 'land' || !u.def.weapon || u.inside || u.role !== 'home' || u.state !== 'idle') continue;
        const need = u.cls === 'veh' ? 2 : 1;
        if (need <= slots) {
          pick.push(u);
          slots -= need;
        }
      }
      if (pick.length) g.orderBoard(pick, t);
      t.loadT = (t.loadT || 0) + g.diff.think;
      const full = g.cargoSlots(t) >= t.def.capacity - 1;
      if (full || (t.cargo.length >= 3 && t.loadT > 60)) {
        const target = this.ferryTarget(landReach);
        if (!target) return;
        const wc = this.coastNear(g.cells[target.cell], t);
        if (wc < 0) return;
        for (const u of boarding) u.state = 'idle';
        t.botMode = 'sail';
        t.botTarget = target;
        t.loadT = 0;
        this.ferryTrips++;
        g.orderMove([t], wc);
      }
    } else if (t.botMode === 'sail') {
      if (t.state !== 'idle') return;
      const res = g.unload(t);
      if (typeof res !== 'string') {
        let target = t.botTarget && t.botTarget.alive ? t.botTarget : this.ferryTarget(landReach);
        if (target && target.kind === 'point') {
          const team = this.p.team;
          if (target.owner >= 0 && g.players[target.owner].team === team) target = null;
        }
        if (target && target.kind === 'point') {
          for (const u of res) {
            u.role = 'cap';
            u.capPoint = target;
            u.capSince = g.time;
          }
        } else {
          for (const u of res) u.role = 'wave';
        }
        if (target) g.orderMove(res, target.cell, true);
      }
      t.botMode = 'return';
      const wc = this.coastNear(core, t);
      if (wc >= 0) g.orderMove([t], wc);
    } else if (t.botMode === 'return' && t.state === 'idle') {
      t.botMode = 'load';
    }
  }

  ferryTarget(landReach = true) {
    const g = this.g;
    if (g.mode.king) {
      const faro = g.points.find((pt) => pt.type === 'faro');
      if (faro && (faro.owner < 0 || g.players[faro.owner].team !== this.p.team)) return faro;
    }
    const flags = this.farFlags();
    const flagFirst = this.pkey === 'keeper' || this.pkey === 'admiral' || this.ferryTrips % 2 === 1 || landReach;
    if (flags.length && flagFirst) return flags[0];
    if (landReach) return flags[0] || null;
    return this.chooseEnemyCore() || flags[0] || null;
  }

  chooseEnemyCore() {
    const g = this.g;
    const core = this.coreCell();
    const cores = g.players
      .filter((p) => p.alive && g.isEnemy(p.id, this.pid) && p.core.alive)
      .map((p) => ({ p, d: g.map.dist(g.cells[p.core.cell], core) }))
      .sort((a, b) => a.d - b.d);
    if (!cores.length) return null;
    const pickI = cores.length > 1 && Math.random() < 0.3 ? 1 : 0;
    return cores[pickI].p.core;
  }

  sendTo(units, targetB) {
    const g = this.g;
    const tc = g.cells[targetB.cell];
    const land = [];
    const air = [];
    const sea = [];
    for (const u of units) {
      if (u.mover === 'air') air.push(u);
      else if (u.mover === 'sea') sea.push(u);
      else if (g.cells[u.cell].comp === tc.comp || tc.nb.some((ni) => g.cells[ni].comp === g.cells[u.cell].comp)) land.push(u);
    }
    if (land.length) g.orderMove(land, tc.i, true);
    if (air.length) g.orderMove(air, tc.i, true);
    if (sea.length) {
      const wc = this.waterNear(tc, sea[0]);
      if (wc >= 0) g.orderMove(sea, wc, true);
    }
    return [...land, ...air, ...(sea.length && this.waterNear(tc, sea[0]) >= 0 ? sea : [])];
  }

  // Siguiente objetivo de una tropa en oleada. En Difícil, primero las defensas cercanas.
  nextTarget(from, comp) {
    const g = this.g;
    let best = null;
    let bd = Infinity;
    for (const b of g.buildings) {
      if (!b.alive || !g.isEnemy(b.owner, this.pid)) continue;
      const c = g.cells[b.cell];
      if (comp !== undefined && c.comp !== comp && !c.nb.some((ni) => g.cells[ni].comp === comp)) continue;
      let d = g.map.dist(c, from);
      if (this.tac.focusDefense && b.def.weapon && b.type !== 'core' && d <= 6) d -= 10;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Envía escuadras de infantería a capturar Banderas y el Faro; deja un guardia en cada punto.
  capture(units) {
    const g = this.g;
    const T = g.time;
    if (T < 45) return;
    const myTeam = this.p.team;
    const core = this.coreCell();
    const king = !!g.mode.king;
    const squads = new Map();
    const guards = new Map();
    for (const u of units) {
      if (u.role === 'guard') {
        const pt = u.capPoint;
        if (!pt || pt.owner < 0 || g.players[pt.owner].team !== myTeam) {
          u.role = 'cap';
          u.capSince = T;
        } else {
          guards.set(pt, u);
          if (u.state === 'idle' && g.map.dist(g.cells[u.cell], g.cells[pt.cell]) > 1) g.orderMove([u], pt.cell, true);
          continue;
        }
      }
      if (u.role !== 'cap') continue;
      const pt = u.capPoint;
      const held = pt && pt.owner >= 0 && g.players[pt.owner].team === myTeam;
      if (!pt || (held && T - (u.capSince || 0) > (king && pt.type === 'faro' ? 9999 : 90))) {
        if (pt && held && !guards.has(pt) && guards.size < 3) {
          u.role = 'guard';
          guards.set(pt, u);
        } else {
          u.role = 'home';
          u.capPoint = null;
        }
        continue;
      }
      squads.set(pt, (squads.get(pt) || 0) + 1);
      if (u.state === 'idle' && g.map.dist(g.cells[u.cell], g.cells[pt.cell]) > 1) g.orderMove([u], pt.cell, true);
    }
    const maxSquads = (king ? 3 : 2) + this.persona.capture;
    if (squads.size >= maxSquads) return;
    const faroBias = (king ? 30 : 6) + this.persona.capture * 6;
    const targets = g.points
      .filter((pt) => !squads.has(pt) && (pt.owner < 0 || g.players[pt.owner].team !== myTeam))
      .filter((pt) => g.cells[pt.cell].comp === core.comp)
      .map((pt) => ({ pt, d: g.map.dist(g.cells[pt.cell], core) - (pt.type === 'faro' ? faroBias : 0) }))
      .sort((a, b) => a.d - b.d);
    if (!targets.length) return;
    const pt = targets[0].pt;
    const size = pt.type === 'faro' ? (king ? 6 : 4) : 3;
    const free = units.filter((u) => u.cls === 'inf' && u.def.weapon && u.role === 'home' && !u.inside &&
      (u.state === 'idle' || u.state === 'move'));
    if (free.length < size + (T < 200 ? 0 : 2)) return;
    const squad = free.slice(0, size);
    for (const u of squad) {
      u.role = 'cap';
      u.capPoint = pt;
      u.capSince = T;
    }
    g.orderMove(squad, pt.cell, true);
  }

  // Casilla propia más cercana al objetivo: allí se reúne la oleada antes de salir.
  stagingCell(target) {
    const g = this.g;
    const core = this.coreCell();
    const tc = g.cells[target.cell];
    let best = -1;
    let bd = Infinity;
    for (const c of g.cells) {
      if (c.owner !== this.pid || c.comp !== core.comp || c.bld || !g.passable(c, 'land', this.pid)) continue;
      const d = g.map.dist(c, tc);
      if (d < bd) { bd = d; best = c.i; }
    }
    return best;
  }

  announce(units, target) {
    const g = this.g;
    if (!units.length) return;
    let x = 0;
    let z = 0;
    for (const u of units) { x += u.x; z += u.z; }
    x /= units.length;
    z /= units.length;
    const me = g.players[0];
    const owner = g.players[target.owner];
    if (target.owner === 0 && g.isEnemy(this.pid, 0)) {
      const lines = this.persona.lines.attack;
      g.say(this.pid, lines[Math.floor(Math.random() * lines.length)], { x, z, toMe: true, kind: 'bad', queue: 3 });
    } else if (owner && this.p.team === me.team) {
      g.say(this.pid, ALLY_LINES.attack.replace('{t}', owner.name), { x, z, queue: 1 });
    }
  }

  launch(units, target, announced = false) {
    const g = this.g;
    if (!target || !target.alive) target = this.chooseEnemyCore();
    if (!target) return [];
    let sent = this.sendTo(units, target);
    if (!sent.length) {
      // Sin camino por tierra: ataca el edificio enemigo alcanzable más cercano.
      const alt = this.nextTarget(this.coreCell(), this.coreCell().comp);
      if (alt) sent = this.sendTo(units, alt);
    }
    if (this.tac.focusDefense && sent.length) {
      const tc = g.cells[target.cell];
      const defs = g.buildings.filter((b) => b.alive && g.isEnemy(b.owner, this.pid) && b.def.weapon && b.type !== 'core' &&
        g.map.dist(g.cells[b.cell], tc) <= 5).sort((a, b) => g.map.dist(g.cells[a.cell], tc) - g.map.dist(g.cells[b.cell], tc));
      if (defs.length) {
        const able = sent.filter((u) => g.canAttack(u, u.def.weapon, defs[0]));
        g.orderAttack(able, defs[0]);
      }
    }
    for (const u of sent) u.role = 'wave';
    if (sent.length) {
      if (!announced) this.announce(sent, target);
      this.wavesSent++;
      this.waveSizes.push(sent.length);
      if (this.firstWaveAt < 0) this.firstWaveAt = g.time;
      this.wave = Math.min(this.wave + 3, 26);
      this.nextWaveAt = g.time + (50 + Math.random() * 40) * this.persona.waveEvery;
    }
    return sent;
  }

  attack(units) {
    const g = this.g;
    this.capture(units);
    const army = units.filter((u) => u.def.weapon && !u.inside);
    // Las tropas que terminaron su ataque buscan el siguiente objetivo.
    for (const u of army) {
      if (u.role !== 'wave' || u.state !== 'idle') continue;
      const c = g.cells[u.cell];
      const comp = u.mover === 'land' ? c.comp : undefined;
      const next = this.nextTarget(c, comp);
      if (next) this.sendTo([u], next);
      else {
        u.role = 'home';
        g.orderMove([u], this.p.core.cell, false);
      }
    }
    // Oleada reuniéndose en la frontera: sale cuando está junta o tras 25 s.
    if (this.raid) {
      const r = this.raid;
      r.units = r.units.filter((u) => u.alive && u.role === 'raid');
      if (!r.units.length) {
        this.raid = null;
        return;
      }
      const st = g.cells[r.stage];
      const ready = r.units.filter((u) => u.mover === 'sea' || g.map.dist(g.cells[u.cell], st) <= 3).length;
      // No sale mientras su aviso de ataque espera turno (el límite de mensajes es de 20 s).
      const warning = this.p.pendingSay && this.p.pendingSay.opts.queue === 3;
      if ((ready >= r.units.length * 0.8 && !warning) || g.time - r.start > 25) {
        // Las rezagadas (a más de 5 casillas) se quedan en casa: nadie llega solo al combate.
        const go = r.units.filter((u) => u.mover !== 'land' || g.map.dist(g.cells[u.cell], st) <= 5);
        for (const u of r.units) if (!go.includes(u)) u.role = 'home';
        this.raid = null;
        if (go.length < 3) {
          for (const u of go) u.role = 'home';
          this.nextWaveAt = g.time + 30;
          return;
        }
        const land = go.filter((u) => u.mover === 'land');
        const near = land.filter((u) => g.map.dist(g.cells[u.cell], st) <= 4).length;
        this.lastLaunch = { together: land.length ? near / land.length : 1, size: go.length, gathered: g.time - r.start };
        this.launch(go, r.target, true);
      }
      return;
    }
    if (g.time < this.nextWaveAt) return;
    const home = army.filter((u) => u.role === 'home');
    const need = Math.min(this.wave, Math.max(5, Math.floor(this.p.popCap * 0.5)));
    if (home.length < need) return;
    const target = this.chooseEnemyCore();
    if (!target) return;
    if (this.tac.group) {
      // Solo se reúnen las tropas de tierra de la isla principal (más aéreas y navales).
      const coreComp = this.coreCell().comp;
      const raiders = home.filter((u) => u.mover !== 'land' || g.cells[u.cell].comp === coreComp);
      let stage = this.stagingCell(target);
      if (stage < 0) stage = this.p.core.cell;
      const landers = raiders.filter((u) => u.mover !== 'sea');
      if (raiders.length >= Math.min(need, 5)) {
        for (const u of raiders) u.role = 'raid';
        if (landers.length) g.orderMove(landers, stage, true);
        this.raid = { units: raiders, target, stage, start: g.time };
        this.announce(raiders, target);
        return;
      }
    }
    this.launch(home, target);
  }
}
