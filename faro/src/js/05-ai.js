'use strict';
// Bots (NPC): cada uno tiene una personalidad. Construyen economía, se expanden, planifican un
// ejército mixto que contrarresta al enemigo, agrupan sus oleadas, se retiran heridos, reparan,
// capturan puntos (también cruzando el mar) y hablan con el jugador.

const unitCat = (u) => (u.cls === 'ship' || u.cls === 'sub' ? 'sea' : u.cls);
// Tropas rápidas para hostigar la economía enemiga (v0.8).
// Orden de preferencia: Jeep, Lancha, Ranger (sin Fábrica ni Puerto) y Helicóptero.
const FAST_UNITS = { jeep: 'veh', speedboat: 'sea', ranger: 'inf', heli: 'air' };
const ECO_TYPES = ['farm', 'mine', 'pump', 'rig'];

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
    this.siegeAt = -99;
    this.ferryTrips = 0;
    // v0.8: fuego concentrado, hostigamiento, Torreta de defensa y ayuda a aliados.
    p.focusFire = !!this.tac.focus;
    this.nextHarassAt = 200 + Math.random() * 60;
    this.wantFast = -99;
    this.turretAt = -99;
    this.helpAt = {};
    this.lastTarget = null;
    this.harassSent = 0;
    this.firstHarassAt = -1;
    this.defTurrets = 0;
    this.helpSent = 0;
    this.lastDefense = null;
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
    const overdue = T > this.nextWaveAt + 60 ? 0.15 : 0;
    const milShare = clamp(base + overdue + (T < 50 ? 0 : this.persona.milShare), 0.1, 0.8);
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
    if (g.mode.tutorial) return;
    this.staffBuilders(mine, units);
    this.build(mine);
    this.expand(mine, units);
    this.produce(mine, units);
    if (this.tac.retreat) this.retreat(units, mine);
    this.repairBase(units, mine);
    // Campaña: un vecino tranquilo no ataca ni sale a capturar.
    if (this.passive) return;
    this.attack(units);
    this.ferry(mine, units);
    if (this.tac.harass) this.harass(units);
    if (this.tac.teamwork) this.helpAllies(units);
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
    const core = p.core;
    const want = [];
    const open = g.opts.mapKind === 'open';
    // Sin constructores no se levanta nada: obras pendientes frente a constructores disponibles.
    const units = g.units.filter((u) => u.alive && u.owner === this.pid);
    const builders = units.filter((u) => u.def.builds === 'land').length;
    const sites = mine.filter((b) => g.needsWork(b) && (b.def.builtBy || 'land') !== 'sea').length;
    const tooBusy = sites >= builders * 2 + 1;
    // Base castigada por buques, aeronaves o artillería (o Núcleo muy dañado): Cúpula primero.
    const shelled = p.navalHitAt !== undefined && T - p.navalHitAt < 90;
    if (core.level >= 3 && (!p.dome || (p.dome.level < 3 && T > 700)) && (shelled || core.hp < core.maxHp * 0.8 || T > 650)) want.push('dome');
    if (n('farm') < 2) want.push('farm');
    if (n('barracks') < 1 && T > 10) want.push('barracks');
    // Sin camino por tierra a ningún Núcleo enemigo: el Puerto (y la Barcaza) van primero.
    const landReach = g.players.some((q) => q.alive && g.isEnemy(q.id, this.pid) && q.core.alive &&
      g.cells[q.core.cell].comp === this.coreCell().comp);
    if (!landReach && coast && n('harbor') < 1 && T > 45) want.push('harbor');
    if (this.persona.harborFirst && coast && n('harbor') < 1 && T > 60) want.push('harbor');
    if (this.milBank > 2500) {
      if (!open && n('factory') < 2 && T > 240) want.push('factory');
      else if (n('barracks') < 3) want.push('barracks');
    }
    if (ownFree('fertile') && n('farm') < 4) want.push('farm');
    const factoryAt = plan.veh >= 3 ? 120 : 170;
    if (n('factory') < 1 && T > (open ? 300 : factoryAt)) want.push('factory');
    const energyB = mine.filter((b) => b.def.cat === 'energy').length;
    const heavyNow = n('factory') + n('harbor') + n('helipad');
    if (energyB < 1 && (heavyNow > 0 || T > 200)) want.push(n('wind') < 8 ? 'wind' : 'solar');
    if (p.popCap - p.popUsed < 6 && p.popCap < MAX_POP) {
      const houseUp = mine.find((b) => b.type === 'house' && b.built && !b.upgrading && b.level < b.def.maxLevel);
      if (n('house') < g.limitFor(this.pid, 'house')) want.push('house');
      else if (houseUp) want.push('up:house');
    }
    if (heavyNow && p.energy < 60 && energyB < Math.min(5, 1 + n('factory') + n('helipad') + n('harbor'))) {
      want.push(ownFree('shallow') && n('hydro') < 2 ? 'hydro' : n('wind') < 8 ? 'wind' : 'solar');
    }
    if (T > 240 && core.level < 2 && n('barracks') >= 1 && energyB >= 1) want.push('up:core');
    if (ownFree('gold') && n('mine') < 2) want.push('mine');
    if (ownFree('oilland') && n('pump') < 2) want.push('pump');
    if (n('harbor') < 1 && coast && open) want.push('harbor');
    if (ownFree('gold') && n('mine') < 3 + Math.floor(T / 300)) want.push('mine');
    if (n('harbor') < 1 && coast && T > (plan.sea >= 3 ? 90 : 240)) want.push('harbor');
    const enemyAir = g.units.some((u) => u.cls === 'air' && g.isEnemy(u.owner, this.pid));
    if (enemyAir && n('aadef') < 2 && T > 180) want.push('aadef');
    // Mejoras: Núcleo primero (nivel 3 abre la Cúpula), luego economía y defensas.
    if (T > 260 && core.level < 2) want.push('up:core');
    if (T > 520 && core.level < 3) want.push('up:core');
    if (T > 300) want.push('up:farm', 'up:mine', 'up:pump', 'up:barracks');
    if (T > 420) want.push('up:turret', 'up:barracks');
    const turretCap = Math.round(4 * this.persona.turrets);
    if (n('turret') < Math.min(turretCap, Math.floor(((T - 60) * this.persona.turrets) / 120))) want.push('turret');
    if (n('harbor') && (ownFree('oil') || this.seaSpot('rig') >= 0)) want.push('rig');
    if (n('harbor') && heavyNow > 1 && p.energy < 80 && n('tidal') < 2 && this.seaSpot('tidal') >= 0) want.push('tidal');
    if (!easy && plan.air >= 1 && n('helipad') < 1 && T > (plan.air >= 2 ? 300 : 380)) want.push('helipad');
    if (ownFree('fertile') && n('farm') < Math.min(10, 3 + Math.floor(T / 70))) want.push('farm');
    if (ownFree('oilland') && n('pump') < 2 + Math.floor(T / 300)) want.push('pump');
    if (n('barracks') < 2 && T > 280) want.push('barracks');
    if (n('hospital') < 1 && T > (this.tac.retreat ? 300 : 420)) want.push('hospital');
    if (n('factory') < 2 && T > 480 && !open) want.push('factory');
    if (n('harbor') < 2 && coast && T > (plan.sea >= 3 ? 300 : 420)) want.push('harbor');

    // Una mejora barata cada ~minuto (Granja, Mina, Bomba o Casa) aunque haya otras compras esperando.
    if (T > 300 && T - (this.cheapUpAt || 0) > 60 && !tooBusy) {
      const cand = mine.filter((x) => ['farm', 'mine', 'pump', 'house'].includes(x.type) && x.built && !x.upgrading && x.level < x.def.maxLevel)
        .sort((x, y) => g.upgradeCost(x) - g.upgradeCost(y))[0];
      if (cand && this.ecoBank >= g.upgradeCost(cand)) {
        const uc = g.upgradeCost(cand);
        if (typeof g.upgrade(cand) !== 'string') {
          this.ecoBank -= uc;
          this.cheapUpAt = T;
        }
      }
    }
    if (!want.length) {
      this.milBank += this.ecoBank * 0.5;
      this.ecoBank *= 0.5;
      return;
    }
    let actions = 0;
    for (const type of want) {
      if (actions >= 2) break;
      if (type.startsWith('up:')) {
        const t = type.slice(3);
        const b = mine.find((x) => x.type === t && x.built && !x.upgrading && x.level < x.def.maxLevel);
        if (!b || tooBusy) continue;
        const uc = g.upgradeCost(b);
        if (this.ecoBank < uc) {
          if (t === 'core') break;
          continue;
        }
        if (typeof g.upgrade(b) !== 'string') {
          this.ecoBank -= uc;
          actions++;
        }
        continue;
      }
      if (type === 'dome') {
        const dc = g.domeCost(this.pid);
        if (this.ecoBank + this.milBank < dc) break;
        if (!g.buyDome(this.pid)) {
          const fromEco = Math.min(this.ecoBank, dc);
          this.ecoBank -= fromEco;
          this.milBank = Math.max(0, this.milBank - (dc - fromEco));
          actions++;
        }
        continue;
      }
      const def = BUILDINGS[type];
      if (!def.sea && tooBusy) continue;
      const cost = def.cost;
      if (this.ecoBank < cost || p.coins < cost) break;
      if (def.energyCost && p.energy < def.energyCost) continue;
      const ci = def.sea ? this.seaSpot(type) : this.pickCell(type);
      if (ci < 0) continue;
      if (!g.place(this.pid, type, ci)) {
        this.ecoBank -= cost;
        actions++;
      }
    }
  }

  // Estructuras de mar: el lugar libre más cercano a la base (puede estar fuera del territorio).
  seaSpot(type) {
    const g = this.g;
    const core = this.coreCell();
    let best = -1;
    let bd = Infinity;
    for (const c of g.cells) {
      if (c.bld || (c.owner >= 0 && c.owner !== this.pid)) continue;
      const d = g.map.dist(c, core);
      if (d > 9) continue;
      if (g.placeInvalid(this.pid, type, c.i, true)) continue;
      if (d < bd) { bd = d; best = c.i; }
    }
    return best;
  }

  // Constructores: 2 al empezar y más a medida que crece la base (máximo 5).
  // Barco constructor si hay estructuras de mar esperando.
  staffBuilders(mine, units) {
    const g = this.g;
    const want = Math.min(5, 2 + Math.floor(mine.length / 6));
    const have = units.filter((u) => u.def.builds === 'land').length +
      mine.reduce((s, b) => s + b.queue.filter((q) => UNITS[q.type].builds === 'land').length, 0);
    const sieged = g.time - this.siegeAt < 15;
    if (have < want && (!sieged || have === 0)) {
      const prod = mine.filter((b) => b.built && b.def.produces && b.def.produces.includes('builder') && b.queue.length < 2)
        .sort((a, b) => a.queue.length - b.queue.length)[0];
      if (prod && this.p.coins >= UNITS.builder.cost && !g.enqueue(prod, 'builder')) {
        this.ecoBank = Math.max(0, this.ecoBank - UNITS.builder.cost);
      }
    }
    const seaWork = mine.some((b) => g.needsWork(b) && b.def.builtBy === 'sea');
    if (seaWork) this.queueOnce(mine, 'harbor', 'boatEng');
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

    const landEng = units.filter((u) => u.type === 'engineer' && u.state !== 'found' && u.state !== 'repair' && u.state !== 'build');
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
    // Hostigamiento: si faltan tropas rápidas, entrena una (Jeep, Lancha o Helicóptero).
    if (this.tac.harass && T - this.wantFast < 40) {
      const fastHave = units.filter((u) => FAST_UNITS[u.type]).length +
        producers.reduce((s, b) => s + b.queue.filter((q) => FAST_UNITS[q.type]).length, 0);
      const opt = Object.entries(FAST_UNITS).find(([t, c]) => cats[c] && (t !== 'heli' || this.p.energy >= UNITS.heli.energy));
      if (opt && fastHave < 3) return { type: opt[0], btype: cats[opt[1]], since: T };
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
      if (T < 90) return r < 0.7 ? 'rifle' : 'shotgun';
      if (counter && mix.veh >= 0.3) return r < 0.65 ? 'rocket' : 'rifle';
      if (counter && mix.inf >= 0.6) return r < 0.3 ? 'sniper' : r < 0.55 ? 'breaker' : r < 0.75 ? 'hunter' : 'rifle';
      return r < 0.3 ? 'rifle' : r < 0.45 ? 'ranger' : r < 0.58 ? 'shotgun' : r < 0.78 ? 'rocket' : r < 0.88 ? 'sniper' : r < 0.95 ? 'breaker' : 'hunter';
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
    return !units.some((u) => u.type === 'apache') && this.p.coins > UNITS.apache.cost * 1.5 ? 'apache' : 'heli';
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
    if (td <= 3) this.siegeAt = g.time;
    // Una oleada que se estaba reuniendo vuelve a defender si el peligro está cerca del Núcleo.
    if (this.raid && td <= 4) {
      for (const u of this.raid.units) if (u.alive && u.role === 'raid') u.role = 'home';
      this.raid = null;
    }
    // Defensa en equipo (v0.8): van todas las tropas de casa, también las que salen de la producción,
    // y los hostigadores que estén cerca. Los guardias se quedan cuidando sus Banderas.
    const tc = g.cells[threat.cell];
    const near = (u) => g.map.dist(g.cells[u.cell], tc) <= 10;
    const guards = units.filter((u) => u.def.weapon && !u.inside && g.canAttack(u, u.def.weapon, threat) &&
      (u.role === 'home' || (u.role === 'harass' && near(u))) &&
      (u.state === 'idle' || u.state === 'move' || (u.state === 'amove' && u.role !== 'raid')));
    for (const u of guards) if (u.role !== 'home') u.role = 'home';
    const nearby = units.filter((u) => u.def.weapon && !u.inside && u.role !== 'retreat' && near(u));
    this.lastDefense = { t: g.time, cell: tc.i, near: nearby.length, sent: guards.filter(near).length,
      fighting: nearby.filter((u) => u.state === 'attack' || guards.includes(u)).length };
    if (this.tac.turret && td <= 7) this.defenseTurret(tc);
    const byMover = { land: [], sea: [], air: [] };
    for (const u of guards) byMover[u.mover].push(u);
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
        if (target.kind === 'bld') {
          this.coreRaids = (this.coreRaids || 0) + 1;
          if (this.firstRaidAt === undefined) this.firstRaidAt = g.time;
        }
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
    let cores = g.players
      .filter((p) => p.alive && g.isEnemy(p.id, this.pid) && p.core.alive)
      .map((p) => ({ p, d: g.map.dist(g.cells[p.core.cell], core) }))
      .sort((a, b) => a.d - b.d);
    if (!cores.length) return null;
    // Primero los Núcleos a los que el ejército llega a pie.
    const byLand = cores.filter((c) => g.cells[c.p.core.cell].comp === core.comp);
    if (byLand.length) cores = byLand;
    // Aliados coordinados (v0.8): atacan al mismo rival que un aliado bot.
    if (this.tac.teamwork) {
      for (const b of g.bots) {
        if (b === this || b.p.team !== this.p.team || !b.p.alive) continue;
        const t = b.lastTarget;
        if (t && t.alive && cores.some((c) => c.p.core === t) && Math.random() < 0.8) {
          this.lastTarget = t;
          return t;
        }
      }
    }
    const pickI = cores.length > 1 && Math.random() < 0.3 ? 1 : 0;
    this.lastTarget = cores[pickI].p.core;
    return this.lastTarget;
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
    // Avanzan atacando, juntas (en bloque) para llegar a la vez; la línea se usa al reunirse.
    if (land.length) g.orderMove(land, tc.i, true);
    if (air.length) g.orderMove(air, tc.i, true);
    if (sea.length) {
      const wc = this.waterNear(tc, sea[0]);
      if (wc >= 0) g.orderMove(sea, wc, true);
    }
    return [...land, ...air, ...(sea.length && this.waterNear(tc, sea[0]) >= 0 ? sea : [])];
  }

  // ---------- v0.8: Torreta de defensa, hostigamiento y aliados ----------
  // Levanta una Torreta entre el Núcleo y el lado por donde vino el ataque (cada 45 s como mucho).
  defenseTurret(threatCell) {
    const g = this.g;
    if (g.time - this.turretAt < 45) return false;
    const core = this.coreCell();
    const p = this.p;
    if (p.coins < BUILDINGS.turret.cost + 200) return false;
    const dir = Math.atan2(threatCell.z - core.z, threatCell.x - core.x);
    const off = (c) => {
      let a = Math.atan2(c.z - core.z, c.x - core.x) - dir;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return Math.abs(a);
    };
    const own = g.buildings.filter((b) => b.alive && b.owner === this.pid && b.type === 'turret');
    const cand = g.cells.filter((c) => {
      const d = g.map.dist(c, core);
      return d >= 2 && d <= 3 && off(c) < 0.9 && !own.some((t) => g.map.dist(g.cells[t.cell], c) < 2) && !g.placeInvalid(this.pid, 'turret', c.i);
    }).sort((a, b) => off(a) - off(b));
    if (!cand.length) return false;
    if (g.place(this.pid, 'turret', cand[0].i)) return false;
    this.turretAt = g.time;
    this.defTurrets++;
    return true;
  }

  // Granja, Mina, Bomba o Plataforma enemiga lejos de sus defensas y alcanzable por esa tropa.
  ecoTarget(u, maxDist = Infinity) {
    const g = this.g;
    const uc = g.cells[u.cell];
    const defs = g.buildings.filter((b) => b.alive && g.isEnemy(b.owner, this.pid) && b.def.weapon && g.canAttack(b, b.def.weapon, u));
    let best = null;
    let bs = Infinity;
    for (const b of g.buildings) {
      if (!b.alive || !g.isEnemy(b.owner, this.pid) || !ECO_TYPES.includes(b.type)) continue;
      const c = g.cells[b.cell];
      const d = g.map.dist(c, uc);
      if (d > maxDist) continue;
      if (u.mover === 'land' && c.comp !== uc.comp && !c.nb.some((ni) => g.cells[ni].comp === uc.comp)) continue;
      if (u.mover === 'sea' && this.waterNear(c, u) < 0) continue;
      let safe = 99;
      for (const t of defs) safe = Math.min(safe, g.map.dist(g.cells[t.cell], c) - (t.def.weapon.range || 4));
      if (safe < -1) continue;
      const s = d / 3 - Math.min(safe, 6) * 3;
      if (s < bs) { bs = s; best = b; }
    }
    return best;
  }

  // Hostigamiento: 2-3 tropas rápidas atacan la economía enemiga lejos de sus defensas.
  harass(units) {
    const g = this.g;
    const team = units.filter((u) => u.role === 'harass' && !u.inside);
    for (const u of team) {
      if (u.state !== 'idle') continue;
      const t = this.ecoTarget(u, 7);
      if (t) this.sendTo([u], t);
      else {
        u.role = 'home';
        g.orderMove([u], this.p.core.cell, false);
      }
    }
    if (team.length || g.time < this.nextHarassAt) return;
    const fast = units.filter((u) => FAST_UNITS[u.type] && u.role === 'home' && !u.inside && u.state === 'idle');
    if (fast.length < 2) {
      this.wantFast = g.time;
      return;
    }
    const group = fast.slice(0, 3);
    const target = this.ecoTarget(group[0]);
    if (!target) {
      this.nextHarassAt = g.time + 30;
      return;
    }
    const sent = this.sendTo(group, target);
    for (const u of sent) u.role = 'harass';
    if (sent.length) {
      this.harassSent++;
      if (this.firstHarassAt < 0) this.firstHarassAt = g.time;
      this.lastHarass = { t: g.time, target: target.type, owner: target.owner, units: sent.map((u) => u.type) };
      this.nextHarassAt = g.time + 80 + Math.random() * 40;
    } else this.nextHarassAt = g.time + 30;
  }

  // Aliados (Liga y Equipos): si atacan la base de un aliado, va la mitad del ejército de casa.
  helpAllies(units) {
    const g = this.g;
    if (g.time - (this._helpScan || -99) < 3) return;
    this._helpScan = g.time;
    // Las tropas que ya ayudaron vuelven a casa.
    for (const u of units) {
      if (u.role === 'help' && u.state === 'idle') {
        u.role = 'home';
        g.orderMove([u], this.p.core.cell, false);
      }
    }
    const me = this.p;
    for (const ally of g.players) {
      if (ally.id === this.pid || !ally.alive || ally.team !== me.team || !ally.core || !ally.core.alive) continue;
      if (g.time - (this.helpAt[ally.id] || -99) < 40) continue;
      const ac = g.cells[ally.core.cell];
      let threat = null;
      let n = 0;
      for (const e of g.units) {
        if (!e.alive || e.inside || !g.isEnemy(e.owner, this.pid) || !e.def.weapon) continue;
        if (g.map.dist(g.cells[e.cell], ac) <= 6) { n++; if (!threat) threat = e; }
      }
      if (!threat || n < 2) continue;
      const tc = g.cells[threat.cell];
      const home = units.filter((u) => u.def.weapon && u.role === 'home' && !u.inside && (u.state === 'idle' || u.state === 'move') && g.canAttack(u, u.def.weapon, threat) &&
        (u.mover !== 'land' || g.cells[u.cell].comp === tc.comp));
      if (home.length < 3) continue;
      const go = home.slice(0, Math.min(8, Math.ceil(home.length / 2)));
      const sent = this.sendTo(go, threat.kind === 'bld' ? threat : { cell: tc.i });
      for (const u of sent) u.role = 'help';
      if (sent.length) {
        this.helpAt[ally.id] = g.time;
        this.helpSent++;
        this.lastHelp = { t: g.time, ally: ally.id, units: sent.length };
        if (ally.human) g.say(this.pid, '¡Voy a ayudarte!', { x: tc.x, z: tc.z, queue: 2 });
      }
    }
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
      this.nextWaveAt = g.time + (50 + Math.random() * 40) * this.persona.waveEvery * (this.waveMult || 1);
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
    // Romper empates (v0.8, desde Normal): pasados 15 min, si la oleada está lista sale con todo lo
    // que hay en casa (los guardias siguen en sus Banderas), dejando 3 defensores.
    if (this.tac.focus && g.time > 900 && g.time >= this.nextWaveAt) {
      const home = army.filter((u) => u.role === 'home');
      if (home.length >= 12) {
        const target = this.chooseEnemyCore();
        if (target) {
          const keep = home.filter((u) => u.mover === 'land').slice(0, 3);
          if (this.launch(home.filter((u) => !keep.includes(u)), target).length) {
            this.allIn = (this.allIn || 0) + 1;
            return;
          }
        }
      }
    }
    if (g.time < this.nextWaveAt) return;
    // v0.5 empieza sin tropas: la primera oleada pide menos y crece con el tiempo.
    // Si se atrasa más de 1 min, también salen los guardias de las Banderas.
    const late = g.time > this.nextWaveAt + 60;
    let need = Math.min(this.wave, Math.max(5, Math.floor(this.p.popCap * 0.5)), 3 + Math.floor(g.time / 150));
    if (late) need = Math.max(3, need - 2);
    if (army.length < need) return;
    const target = this.chooseEnemyCore();
    if (!target) return;
    // Solo van las tropas que pueden llegar: las de tierra, si hay camino por tierra hasta el Núcleo.
    const tc = g.cells[target.cell];
    const reach = (u) => u.mover !== 'land' || g.cells[u.cell].comp === tc.comp || tc.nb.some((ni) => g.cells[ni].comp === g.cells[u.cell].comp);
    const home = army.filter((u) => (u.role === 'home' || (late && u.role === 'guard')) && reach(u));
    if (home.length < need) return;
    if (this.tac.group) {
      // Solo se reúnen las tropas de tierra de la isla principal (más aéreas y navales).
      const coreComp = this.coreCell().comp;
      const raiders = home.filter((u) => u.mover !== 'land' || g.cells[u.cell].comp === coreComp);
      let stage = this.stagingCell(target);
      if (stage < 0) stage = this.p.core.cell;
      const landers = raiders.filter((u) => u.mover !== 'sea');
      if (raiders.length >= Math.min(need, 5)) {
        for (const u of raiders) u.role = 'raid';
        if (landers.length) g.orderMove(landers, stage, true, this.tac.line !== false ? 'line' : 'block');
        this.raid = { units: raiders, target, stage, start: g.time };
        this.announce(raiders, target);
        return;
      }
    }
    this.launch(home, target);
  }
}
