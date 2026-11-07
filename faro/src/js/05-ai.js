'use strict';
// Bots: construyen economía, se expanden con ingenieros, entrenan tropas,
// defienden su territorio y lanzan oleadas de ataque.

class Bot {
  constructor(game, pid) {
    this.g = game;
    this.pid = pid;
    this.t = 1 + Math.random() * 2;
    this.wave = game.diff.wave;
    this.nextWaveAt = game.diff.firstWave + Math.random() * 30;
    this.claimed = new Set();
    this.defendT = 0;
    // Dos bolsas: economía (edificios, expansión) y ejército (tropas).
    this.ecoBank = START_COINS * 0.75;
    this.milBank = START_COINS * 0.25;
    this.lastT = 0;
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
    const milShare = T < 50 ? 0.2 : army < this.targetArmy() ? (T < 240 ? 0.45 : 0.55) : 0.38;
    this.milBank += gained * milShare;
    this.ecoBank += gained * (1 - milShare);
    const total = this.milBank + this.ecoBank;
    if (total > p.coins && total > 0) {
      const k = p.coins / total;
      this.milBank *= k;
      this.ecoBank *= k;
    } else if (total < p.coins) {
      this.ecoBank += p.coins - total;
    }

    this.defend(units);
    this.build(mine);
    this.expand(mine, units);
    this.produce(mine, units);
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
    const hard = g.opts.difficulty !== 'easy';
    const want = [];
    const open = g.opts.mapKind === 'open';
    // Núcleo castigado a media partida: ahorra para la Cúpula antes que nada.
    if (!p.dome && T > 300 && p.core.hp < p.core.maxHp * 0.8) want.push('dome');
    if (n('farm') < 2) want.push('farm');
    if (n('barracks') < 1 && T > 10) want.push('barracks');
    // Mucho dinero militar sin gastar: hace falta más capacidad de producción.
    if (this.milBank > 2500) {
      if (!open && n('factory') < 2 && T > 240) want.push('factory');
      else if (n('barracks') < 3) want.push('barracks');
    }
    if (n('farm') < 4) want.push('farm');
    if (n('mill') < 1 && T > 40) want.push('mill');
    if (p.popCap - p.popUsed < 6 && p.popCap < MAX_POP) {
      const houseUp = mine.find((b) => b.type === 'house' && b.built && (b.level || 1) < HOUSE_LEVELS.length);
      if (n('house') < g.limitFor(this.pid, 'house')) want.push('house');
      else if (houseUp) want.push('houseUp');
    }
    const heavy = n('factory') + n('harbor') + n('helipad');
    if (heavy && p.energy < 200 && n('mill') < Math.min(4, 1 + heavy)) want.push('mill');
    if (ownFree('gold') && n('mine') < 2) want.push('mine');
    if (n('harbor') < 1 && coast && open) want.push('harbor');
    if (n('factory') < 1 && T > 150 && !open) want.push('factory');
    if (ownFree('gold')) want.push('mine');
    if (n('harbor') < 1 && coast && T > 240) want.push('harbor');
    const enemyAir = g.units.some((u) => u.cls === 'air' && g.isEnemy(u.owner, this.pid));
    if (enemyAir && n('aadef') < 2 && T > 180) want.push('aadef');
    const farmsBuilt = mine.filter((b) => b.type === 'farm' && b.built).length;
    if (T > 270 && farmsBuilt && n('pump') < Math.min(6, Math.floor((T - 220) / 70))) want.push('pump');
    if (n('turret') < Math.min(4, Math.floor((T - 60) / 120))) want.push('turret');
    if (ownFree('oil')) want.push('rig');
    if (hard && n('helipad') < 1 && T > 330) want.push('helipad');
    if (n('farm') < Math.min(8, 3 + Math.floor(T / 70))) want.push('farm');
    if (n('barracks') < 2 && T > 280) want.push('barracks');
    if (n('hospital') < 1 && T > 420) want.push('hospital');
    if (n('factory') < 2 && T > 480 && !open) want.push('factory');
    if (n('harbor') < 2 && coast && T > 420) want.push('harbor');

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

    const landEng = units.filter((u) => u.type === 'engineer' && u.state !== 'found');
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
        } else {
          this.queueOnce(mine, 'harbor', 'boatEng');
        }
      }
    }
  }

  queueOnce(mine, btype, utype) {
    const g = this.g;
    const builders = mine.filter((b) => b.type === btype && b.built);
    if (!builders.length) return;
    if (builders.some((b) => b.queue.some((q) => q.type === utype))) return;
    if (g.units.some((u) => u.owner === this.pid && u.type === utype)) return;
    g.enqueue(builders[0], utype);
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

  // ---------- producción ----------
  produce(mine, units) {
    const g = this.g;
    const p = this.p;
    const T = g.time;
    let spend = Math.min(p.coins, this.milBank);
    if (!mine.some((b) => b.built && b.def.produces)) {
      this.ecoBank += this.milBank;
      this.milBank = 0;
      return;
    }
    const open = g.opts.mapKind === 'open';
    const infantry = units.filter((u) => u.cls === 'inf' && u.def.weapon).length;
    const enemyAir = g.units.some((u) => u.cls === 'air' && g.isEnemy(u.owner, this.pid));
    for (const b of mine) {
      if (!b.built || !b.def.produces || b.queue.length >= 2) continue;
      if (b.type === 'barracks' && open && infantry > 10) continue;
      // Cada edificio decide qué quiere entrenar y ahorra para eso.
      if (!b.botNext) {
        const r = Math.random();
        if (b.type === 'barracks') b.botNext = r < 0.45 || T < 80 ? 'rifle' : r < 0.78 ? 'rocket' : 'sniper';
        else if (b.type === 'factory') {
          b.botNext = enemyAir && r < 0.3 ? 'aa' : r < 0.55 ? 'tank' : r < 0.8 || T < 300 ? 'jeep' : 'arty';
        }
        else if (b.type === 'harbor') b.botNext = r < 0.4 ? 'speedboat' : r < 0.75 || T < 300 ? 'destroyer' : 'sub';
        else if (b.type === 'helipad') b.botNext = 'heli';
      }
      const type = b.botNext;
      if (!type) continue;
      const cost = UNITS[type].cost;
      if (cost > spend) continue;
      const err = g.enqueue(b, type);
      if (!err) {
        spend -= cost;
        this.milBank -= cost;
        b.botNext = null;
      } else if (err.startsWith('Población') || err.startsWith('Energía')) {
        b.botNext = null;
      }
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
      if (!e.alive || !g.isEnemy(e.owner, this.pid)) continue;
      const c = g.cells[e.cell];
      const d = g.map.dist(c, core);
      if (c.owner === this.pid || d <= 5) {
        if (d < td) { td = d; threat = e; }
      }
    }
    if (!threat) return;
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

  // Sin camino por tierra hacia ningún enemigo: lleva tropas en Transporte.
  ferry(mine, units) {
    const g = this.g;
    if (g.time < 240 || !mine.some((b) => b.type === 'harbor' && b.built)) return;
    const core = this.coreCell();
    const landReach = g.players.some((p) => p.alive && g.isEnemy(p.id, this.pid) && p.core.alive &&
      g.cells[p.core.cell].comp === core.comp);
    const faro = g.points.find((pt) => pt.type === 'faro');
    const faroByLand = !g.mode.king || !faro || g.cells[faro.cell].comp === core.comp;
    if (landReach && faroByLand) return;
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
        const target = this.ferryTarget();
        if (!target) return;
        const wc = this.coastNear(g.cells[target.cell], t);
        if (wc < 0) return;
        for (const u of boarding) u.state = 'idle';
        t.botMode = 'sail';
        t.botTarget = target;
        t.loadT = 0;
        g.orderMove([t], wc);
      }
    } else if (t.botMode === 'sail') {
      if (t.state !== 'idle') return;
      const res = g.unload(t);
      if (typeof res !== 'string') {
        const target = t.botTarget && t.botTarget.alive ? t.botTarget : this.ferryTarget();
        for (const u of res) u.role = 'wave';
        if (target) g.orderMove(res, target.cell, true);
      }
      t.botMode = 'return';
      const wc = this.coastNear(core, t);
      if (wc >= 0) g.orderMove([t], wc);
    } else if (t.botMode === 'return' && t.state === 'idle') {
      t.botMode = 'load';
    }
  }

  ferryTarget() {
    const g = this.g;
    if (g.mode.king) {
      const faro = g.points.find((pt) => pt.type === 'faro');
      if (faro && (faro.owner < 0 || g.players[faro.owner].team !== this.p.team)) return faro;
    }
    return this.chooseEnemyCore();
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

  nearestEnemyBuilding(from, comp) {
    const g = this.g;
    let best = null;
    let bd = Infinity;
    for (const b of g.buildings) {
      if (!b.alive || !g.isEnemy(b.owner, this.pid)) continue;
      const c = g.cells[b.cell];
      if (comp !== undefined && c.comp !== comp && !c.nb.some((ni) => g.cells[ni].comp === comp)) continue;
      const d = g.map.dist(c, from);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
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

  // Envía escuadras de infantería a capturar Banderas y el Faro.
  capture(units) {
    const g = this.g;
    const T = g.time;
    if (T < 45) return;
    const myTeam = this.p.team;
    const core = this.coreCell();
    const king = !!g.mode.king;
    const squads = new Map();
    for (const u of units) {
      if (u.role !== 'cap') continue;
      const pt = u.capPoint;
      if (!pt || (pt.owner >= 0 && g.players[pt.owner].team === myTeam && T - (u.capSince || 0) > (king && pt.type === 'faro' ? 9999 : 90))) {
        u.role = 'home';
        u.capPoint = null;
        continue;
      }
      squads.set(pt, (squads.get(pt) || 0) + 1);
      if (u.state === 'idle' && g.map.dist(g.cells[u.cell], g.cells[pt.cell]) > 1) g.orderMove([u], pt.cell, true);
    }
    const maxSquads = king ? 3 : 2;
    if (squads.size >= maxSquads) return;
    const targets = g.points
      .filter((pt) => !squads.has(pt) && (pt.owner < 0 || g.players[pt.owner].team !== myTeam))
      .filter((pt) => g.cells[pt.cell].comp === core.comp)
      .map((pt) => ({ pt, d: g.map.dist(g.cells[pt.cell], core) - (pt.type === 'faro' ? (king ? 30 : 6) : 0) }))
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

  attack(units) {
    const g = this.g;
    this.capture(units);
    const army = units.filter((u) => u.def.weapon);
    // Las tropas que terminaron su ataque buscan el siguiente objetivo.
    for (const u of army) {
      if (u.role !== 'wave' || u.state !== 'idle') continue;
      const c = g.cells[u.cell];
      const comp = u.mover === 'land' ? c.comp : undefined;
      const next = this.nearestEnemyBuilding(c, comp);
      if (next) this.sendTo([u], next);
      else {
        u.role = 'home';
        g.orderMove([u], this.p.core.cell, false);
      }
    }
    if (g.time < this.nextWaveAt) return;
    const home = army.filter((u) => u.role === 'home');
    const need = Math.min(this.wave, Math.max(5, Math.floor(this.p.popCap * 0.5)));
    if (home.length < need) return;
    const target = this.chooseEnemyCore();
    if (!target) return;
    let sent = this.sendTo(home, target);
    if (!sent.length) {
      // Sin camino por tierra: ataca el edificio enemigo alcanzable más cercano.
      const alt = this.nearestEnemyBuilding(this.coreCell(), this.coreCell().comp);
      if (alt) sent = this.sendTo(home, alt);
    }
    for (const u of sent) u.role = 'wave';
    if (sent.length) {
      this.wave = Math.min(this.wave + 3, 26);
      this.nextWaveAt = g.time + 50 + Math.random() * 40;
    }
  }
}
