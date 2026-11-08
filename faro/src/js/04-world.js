'use strict';
// Estado y simulación de la partida: economía, construcción, producción,
// movimiento, combate, territorio y condiciones de victoria.

let _nextId = 1;

// Partida personalizada: jugadores 2-6, equipos opcionales, monedas iniciales y reglas.
function customMode(c) {
  const n = clamp(c.players || 4, 2, 6);
  const teams = [];
  for (let i = 0; i < n; i++) teams.push(c.teams ? (i < Math.ceil(n / 2) ? 0 : 1) : i);
  return {
    name: 'Personalizado', players: n, teams, coins: c.coins || START_COINS, energy: c.energy || START_ENERGY,
    fog: !!c.fog, speed: c.turbo ? 2 : 1, king: !!c.king, custom: true,
  };
}

class Game {
  constructor(opts) {
    this.opts = opts;
    const mode = opts.mission ? Campaign.mode(opts.mission) : opts.custom ? customMode(opts.custom) : MODES[opts.mode];
    this.mode = mode;
    this.diff = DIFFICULTY[opts.difficulty];
    this.map = new GameMap(opts.seed, opts.mapKind, mode.players);
    this.cells = this.map.cells;
    this.speed = mode.speed || (opts.turbo ? 2 : 1);
    this.fog = !!(opts.fog || mode.fog);
    this.creator = !!opts.creator;
    this.elimOrder = [];
    this._assignT = 0;
    this.time = 0;
    this.over = false;
    this.result = null;
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.removed = [];
    this.fx = [];
    this.events = [];
    this.territoryDirty = true;
    this.territoryVersion = 0;
    this.objDone = {};
    this._coreWarn = -99;
    this._slowT = 0;
    this._fogT = 0;

    this.kingTime = {};
    this.players = [];
    for (let i = 0; i < mode.players; i++) {
      this.players.push({
        id: i, team: mode.teams[i], name: PLAYER_NAMES[i], color: PLAYER_COLORS[i],
        coins: mode.coins || START_COINS, energy: mode.energy || START_ENERGY, energyRate: 0,
        human: i === 0, alive: true, income: 0, popUsed: 0, popCap: 0, coresKilled: 0,
        emergencyUsed: false, dome: null,
        stats: { built: 0, trained: 0, lost: 0, kills: 0, earned: 0, captures: 0, upgrades: 0, hitBy: {} },
      });
    }
    // Puntos de captura: el Faro y las Banderas.
    this.points = this.map.points.map((pt, i) => {
      const c = this.cells[pt.cell];
      const point = {
        id: i, type: pt.type, def: POINTS[pt.type], cell: pt.cell, x: c.x, z: c.z, y: c.h, alive: true, kind: 'point',
        owner: -1, prog: 0, capTeam: -1, contested: false,
      };
      c.point = point;
      return point;
    });
    this._pointT = 0;
    this.chat = [];
    this._alertT = {};
    this.fights = [];
    this._fightCell = new Map();
    // Inicio: Núcleo, 1 Granja, 2.000 monedas y (desde la v0.6) 1 Constructor para arrancar rápido.
    for (const p of this.players) {
      const home = this.cells[this.map.homes[p.id]];
      p.core = this.addBuilding(p.id, 'core', home.i, true);
      const sf = this.map.startFarms[p.id];
      if (sf >= 0 && !this.cells[sf].bld) this.addBuilding(p.id, 'farm', sf, true);
      const spawn = this.freeCellsNear(home.i, 'land', p.id, START_UNITS.length + 1);
      START_UNITS.forEach((t, k) => { if (spawn[k] !== undefined) this.addUnit(p.id, t, spawn[k]); });
      if (this.mode.tutorial && p.id !== 0) {
        // Tutorial: un bot lento con un Núcleo débil para practicar.
        p.core.maxHp = 3000;
        p.core.hp = 3000;
        p.core._w = { ...BUILDINGS.core.weapon, dmg: 8, range: 3 };
        p.core._wLv = 1;
      }
    }
    this.recomputeTerritory();
    this.refreshEconomy();
    // Personalidades repartidas según la semilla del mapa: cada bot es distinto.
    const order = PERSONALITY_ORDER.slice();
    const rng = mulberry32(opts.seed + 77);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.bots = this.players.filter((p) => !p.human).map((p, i) => {
      p.persona = opts.personas && opts.personas[p.id] ? opts.personas[p.id] : order[i % order.length];
      return new Bot(this, p.id);
    });
    // Campaña (v0.7): preparación de la misión y seguimiento de su meta.
    this.camp = null;
    if (opts.mission) Campaign.setup(this);
  }

  // ---------- consultas básicas ----------
  isEnemy(a, b) {
    return this.players[a].team !== this.players[b].team;
  }

  emit(type, data) {
    this.events.push({ type, ...data });
  }

  toast(pid, text, kind = 'info') {
    if (pid === 0) this.emit('toast', { text, kind });
  }

  // Mensaje de un bot. Se guarda siempre; la interfaz muestra los que te afectan.
  say(pid, text, opts = {}) {
    const p = this.players[pid];
    if (!p || p.human) return false;
    if (!opts.force && this.time - (p.lastSay || -99) < 20) {
      // Guarda el mensaje más importante y lo dice en cuanto pueda.
      if (opts.queue && (!p.pendingSay || p.pendingSay.opts.queue <= opts.queue)) p.pendingSay = { text, opts };
      return false;
    }
    p.lastSay = this.time;
    const me = this.players[0];
    const msg = {
      pid, text, time: this.time, x: opts.x, z: opts.z, kind: opts.kind || 'info',
      ally: p.team === me.team, toMe: !!opts.toMe, public: !!opts.public,
    };
    this.chat.push(msg);
    if (this.chat.length > 60) this.chat.shift();
    this.emit('chat', { msg });
    return true;
  }

  // Alerta para el jugador con ubicación (para el botón «Ver» y el pulso del minimapa).
  alert(key, text, kind, x, z, every = 15) {
    if (this.time - (this._alertT[key] || -99) < every) return;
    this._alertT[key] = this.time;
    this.emit('toast', { text, kind, x, z });
    this.emit('ping', { x, z, kind });
  }

  passable(cell, mover, owner) {
    if (mover === 'air') return true;
    const T = TERRAIN[cell.t];
    if (mover === 'land' ? !T.land : !T.water) return false;
    const b = cell.bld;
    if (b) return b.type === 'wall' && !this.isEnemy(b.owner, owner);
    return true;
  }

  groundY(u, cell) {
    if (u.mover === 'air') return 2.3;
    if (u.mover === 'sea') return u.cls === 'sub' ? -0.1 : 0.02;
    return cell.h;
  }

  freeCellsNear(ci, mover, owner, count) {
    const c0 = this.cells[ci];
    const out = [];
    for (const off of SPIRAL) {
      if (off.d === 0 && mover !== 'air') continue;
      const c = this.map.get(c0.q + off.q, c0.r + off.r);
      if (!c || !this.passable(c, mover, owner)) continue;
      out.push(c.i);
      if (out.length >= count) break;
    }
    while (out.length < count) out.push(out[0] ?? ci);
    return out;
  }

  // ---------- A* ----------
  findPath(start, goalI, mover, owner) {
    const cells = this.cells;
    const N = cells.length;
    if (!this._g) {
      this._g = new Float32Array(N);
      this._from = new Int32Array(N);
      this._stamp = new Uint32Array(N);
      this._closed = new Uint32Array(N);
      this._run = 0;
    }
    const run = ++this._run;
    const G = this._g;
    const F = this._from;
    const S = this._stamp;
    const C = this._closed;
    const goal = cells[goalI];
    const goalOk = this.passable(goal, mover, owner);
    const heap = new MinHeap();
    S[start] = run;
    G[start] = 0;
    F[start] = -1;
    heap.push(start, 0);
    let best = start;
    let bestH = this.map.dist(cells[start], goal);
    let iter = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (C[cur] === run) continue;
      C[cur] = run;
      const hc = this.map.dist(cells[cur], goal);
      if (hc < bestH) { bestH = hc; best = cur; }
      if (cur === goalI || (!goalOk && hc <= 1)) { best = cur; break; }
      if (++iter > 5000) break;
      for (const ni of cells[cur].nb) {
        if (C[ni] === run) continue;
        const nc = cells[ni];
        if (!this.passable(nc, mover, owner)) continue;
        const slow = mover === 'land' ? TERRAIN[nc.t].slow || 1 : 1;
        const ng = G[cur] + slow;
        if (S[ni] !== run || ng < G[ni]) {
          S[ni] = run;
          G[ni] = ng;
          F[ni] = cur;
          heap.push(ni, ng + this.map.dist(nc, goal) * 1.01);
        }
      }
    }
    const path = [];
    let c = best;
    while (c !== -1 && c !== start) {
      path.push(c);
      c = F[c];
    }
    path.reverse();
    return path;
  }

  // ---------- niveles ----------
  bMaxHp(def, lv) {
    return def.levels ? def.levels[lv].hp : Math.round(def.hp * lvlMult(lv));
  }

  bIncome(b) {
    const d = b.def;
    if (d.levels) return d.levels[b.level].income;
    return Math.round((d.income || 0) * lvlMult(b.level));
  }

  bEnergy(b) {
    return Math.round((b.def.energy || 0) * lvlMult(b.level));
  }

  bPop(b) {
    const d = b.def;
    if (d.levels) return d.levels[b.level].pop;
    return (d.pop || 0) * b.level;
  }

  // Arma según el nivel: láser del Núcleo, Air Defense más fuerte, etc.
  weaponOf(b) {
    const d = b.def;
    if (!d.weapon) return null;
    if (b._wLv === b.level && b._w) return b._w;
    let w = d.weapon;
    if (d.levels && d.levels[b.level].laser) {
      const L = d.levels[b.level].laser;
      w = { ...w, dmg: L.dmg, range: L.range, beams: L.beams };
    } else if (b.level > 1) {
      w = { ...w, dmg: w.dmg * lvlMult(b.level), range: w.range + (b.type === 'aadef' ? 1 : 0) };
    }
    b._w = w;
    b._wLv = b.level;
    return w;
  }

  healOf(b) {
    const d = b.def;
    if (!d.heal) return null;
    if (d.healLevels) return { cls: d.heal.cls, pct: d.healLevels[b.level].pct, range: d.healLevels[b.level].range };
    if (d.heal.rate) return { ...d.heal, rate: d.heal.rate * lvlMult(b.level) };
    return d.heal;
  }

  prodRate(b) {
    return 1 / (1 - 0.2 * (b.level - 1));
  }

  // ---------- creación de entidades ----------
  addBuilding(owner, type, ci, instant = false) {
    const def = BUILDINGS[type];
    const cell = this.cells[ci];
    const built = instant || def.build === 0;
    const hp0 = this.bMaxHp(def, 1);
    const b = {
      id: _nextId++, kind: 'bld', type, def, owner, cell: ci, x: cell.x, z: cell.z, y: cell.h, level: 1, upgrading: null,
      hp: built ? hp0 : hp0 * 0.1, maxHp: hp0, built, progress: built ? 1 : 0, workAcc: 0, lastWork: -99,
      miniCd: [0, 0],
      queue: [], rally: -1, alive: true, cd: 0, scanT: Math.random() * 0.3, autoTarget: null,
      onWater: !!TERRAIN[cell.t].water, healT: 0, aimYaw: 0, lastHit: -99, visible: true,
      rot: Math.floor(Math.random() * 6) * (Math.PI / 3),
    };
    if (type === 'core' || type === 'harbor') b.rot = 0;
    cell.bld = b;
    this.buildings.push(b);
    if (def.claim) this.territoryDirty = true;
    // Aparta a las unidades que estaban sobre la casilla.
    for (const u of this.units) {
      if (!u.alive || u.cell !== ci || u.mover === 'air') continue;
      const free = this.freeCellsNear(ci, u.mover, u.owner, 1)[0];
      const fc = this.cells[free];
      u.x = fc.x + u.offX;
      u.z = fc.z + u.offZ;
      u.cell = free;
      if (u.state !== 'idle') this.setPath(u, u.dest >= 0 ? u.dest : free);
    }
    return b;
  }

  addUnit(owner, type, ci) {
    const def = UNITS[type];
    const cell = this.cells[ci];
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * 0.33;
    const u = {
      id: _nextId++, kind: 'unit', type, def, owner, cls: def.cls, mover: def.mover, cell: ci,
      offX: Math.cos(a) * rr, offZ: Math.sin(a) * rr, x: 0, z: 0, y: 0, hp: def.hp, maxHp: def.hp,
      alive: true, state: 'idle', path: [], pathI: 0, dest: -1, target: null, autoTarget: null,
      aggroTarget: null, cd: Math.random() * 0.5, scanT: Math.random() * 0.3, yaw: Math.random() * 6,
      aimYaw: 0, moveYaw: 0, moving: false, repathT: 0, resume: -1, foundCell: -1, role: 'home',
      lastHit: -99, visible: true, inside: null, cargo: def.capacity ? [] : null, boardTarget: null,
      buildTarget: null, shield: 0, shieldMax: 0,
    };
    if (this.unitShieldActive(owner)) {
      u.shieldMax = u.maxHp * DOME_LEVELS[3].unitShield;
      u.shield = u.shieldMax;
    }
    u.x = cell.x + u.offX;
    u.z = cell.z + u.offZ;
    u.y = this.groundY(u, cell);
    this.units.push(u);
    return u;
  }

  // ---------- territorio ----------
  recomputeTerritory() {
    for (const c of this.cells) {
      c.owner = -1;
      c.ownerD = 99;
      c.ownerId = 0;
    }
    const claimers = this.buildings.filter((b) => b.alive && b.def.claim)
      .map((b) => ({ owner: b.owner, cell: b.cell, claim: b.def.claim, id: b.id }));
    for (const pt of this.points) {
      if (pt.owner >= 0) claimers.push({ owner: pt.owner, cell: pt.cell, claim: pt.def.claim, id: 1e6 + pt.id });
    }
    for (const b of claimers) {
      const bc = this.cells[b.cell];
      for (const off of SPIRAL) {
        if (off.d > b.claim) break;
        const c = this.map.get(bc.q + off.q, bc.r + off.r);
        if (!c) continue;
        if (off.d < c.ownerD || (off.d === c.ownerD && b.id < c.ownerId)) {
          c.owner = b.owner;
          c.ownerD = off.d;
          c.ownerId = b.id;
        }
      }
    }
    this.territoryDirty = false;
    this.territoryVersion++;
  }

  // ---------- economía ----------
  refreshEconomy() {
    for (const p of this.players) {
      p.income = 0;
      p.popCap = 0;
      p.popUsed = 0;
      p.energyRate = 0;
      p.bonus = 0;
    }
    for (const b of this.buildings) {
      if (!b.alive) continue;
      const p = this.players[b.owner];
      if (b.built) {
        p.income += this.bIncome(b);
        p.popCap += this.bPop(b);
        p.energyRate += this.bEnergy(b);
      }
      for (const q of b.queue) p.popUsed += UNITS[q.type].pop;
    }
    for (const pt of this.points) {
      if (pt.owner < 0) continue;
      const p = this.players[pt.owner];
      p.income += pt.def.income;
      p.bonus += pt.def.bonus;
    }
    for (const u of this.units) if (u.alive) this.players[u.owner].popUsed += u.def.pop;
    for (const p of this.players) {
      if (this.creator && p.id === 0) p.popCap = MAX_POP;
      p.popCap = Math.min(MAX_POP, p.popCap);
      p.baseIncome = p.income;
      p.income = Math.round(p.income * (1 + p.bonus));
    }
  }

  incomeMult(p) {
    return p.human ? 1 : this.diff.income;
  }

  count(pid, type) {
    let n = 0;
    for (const b of this.buildings) if (b.alive && b.owner === pid && b.type === type) n++;
    return n;
  }

  limitFor(pid, type) {
    const def = BUILDINGS[type];
    if (type === 'house') return HOUSE_LIMIT + 2 * this.players[pid].coresKilled;
    return def.limit || 0;
  }

  placeInvalid(pid, type, ci, ignoreCost = false) {
    const def = BUILDINGS[type];
    const c = this.cells[ci];
    const p = this.players[pid];
    if (!c) return 'Casilla no válida';
    // Las estructuras de mar se ponen en su lugar del mar aunque esté fuera de tu territorio (punto 15).
    if (def.sea) {
      if (c.owner >= 0 && c.owner !== pid && this.isEnemy(c.owner, pid)) return 'Es territorio enemigo';
    } else if (c.owner !== pid) {
      return 'Fuera de tu territorio';
    }
    if (c.point) return `Aquí está ${c.point.type === 'faro' ? 'el Faro' : 'una Bandera'}`;
    if (c.bld) return 'Casilla ocupada';
    const reserved = { gold: 'Las vetas de oro son para Minas', fertile: 'La tierra fértil es para Granjas',
      oilland: 'El petróleo en tierra es para Bombas de petróleo' };
    const nearWater = c.nb.some((ni) => TERRAIN[this.cells[ni].t].water);
    if (Array.isArray(def.on)) {
      if (!def.on.includes(c.t)) return 'Solo en ' + def.on.map((t) => TERRAIN[t].name.toLowerCase()).join(' o ');
    } else if (def.on === 'land' || def.on === 'landcoast') {
      if (!TERRAIN[c.t].land) return 'Debe ir sobre tierra';
      if (reserved[c.t]) return reserved[c.t];
      if (def.on === 'landcoast' && !nearWater) return 'Debe ir en tierra junto al agua';
    } else if (def.on === 'coast') {
      if (c.t !== 'shallow' || !this.map.isCoast(c)) return 'Debe ir en el agua, junto a la orilla';
    } else if (def.on === 'shallowcoast') {
      if (c.t !== 'shallow' || !this.map.isCoast(c)) return 'Debe ir en agua poco profunda junto a la costa';
    } else if (def.on === 'deep') {
      if (c.t !== 'deep') return 'Debe ir en mar profundo';
    }
    const limit = this.limitFor(pid, type);
    if (limit && this.count(pid, type) >= limit) return `Límite alcanzado (${limit})`;
    if (!ignoreCost && p.coins < def.cost) return 'Monedas insuficientes';
    if (!ignoreCost && def.energyCost && p.energy < def.energyCost) return `Energía insuficiente (${def.energyCost}): construye energías (Solar, Eólica...)`;
    return null;
  }

  place(pid, type, ci, rot) {
    const err = this.placeInvalid(pid, type, ci);
    if (err) return err;
    const p = this.players[pid];
    const def = BUILDINGS[type];
    p.coins -= def.cost;
    p.energy -= def.energyCost || 0;
    const b = this.addBuilding(pid, type, ci);
    if (rot !== undefined) b.rot = rot;
    p.stats.built++;
    this.emit('sound', { name: 'place', pid });
    if (!this.assignSite(b) && pid === 0) this.warnNoBuilder(b);
    return null;
  }

  // ---------- obras: constructores, ingenieros y barcos constructores ----------
  needsWork(b) {
    return b.alive && ((!b.built && !b.def.selfBuild && b.type !== 'outpost') || !!b.upgrading);
  }

  canBuildSite(u, b) {
    const by = b.def.builtBy || 'land';
    if (!u.def.builds) return false;
    if (by === 'engineer') return u.type === 'engineer';
    return u.def.builds === by;
  }

  // ¿Puede la unidad llegar a una casilla junto a la obra?
  reachesSite(u, b) {
    const bc = this.cells[b.cell];
    const comp = this.cells[u.cell].comp;
    if (bc.comp === comp && TERRAIN[bc.t].water === (u.mover === 'sea')) return true;
    return bc.nb.some((ni) => this.cells[ni].comp === comp);
  }

  builderFor(b, onlyIdle = true) {
    let best = null;
    let bd = Infinity;
    const bc = this.cells[b.cell];
    for (const u of this.units) {
      if (!u.alive || u.inside || u.owner !== b.owner || !this.canBuildSite(u, b)) continue;
      if (onlyIdle && u.state !== 'idle') continue;
      if (u.role === 'cap' || u.role === 'wave') continue;
      if (!this.reachesSite(u, b)) continue;
      const d = this.map.dist(this.cells[u.cell], bc);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  assignSite(b) {
    const u = this.builderFor(b);
    if (!u) return false;
    this.orderBuild([u], b);
    return true;
  }

  warnNoBuilder(b) {
    const by = b.def.builtBy || 'land';
    const has = this.units.some((u) => u.alive && u.owner === b.owner && this.canBuildSite(u, b));
    const who = by === 'sea' ? 'un Barco constructor (en el Puerto)' : by === 'engineer' ? 'un Ingeniero (en el Cuartel)'
      : 'un Constructor (en el Núcleo o el Cuartel)';
    const text = has ? 'Obra en espera: tu constructor está ocupado; irá al terminar.' : `Obra en espera: necesitas ${who}.`;
    this.alert('nobuilder' + by, text, 'bad', b.x, b.z, 8);
  }

  orderBuild(units, b) {
    let n = 0;
    for (const u of units) {
      if (!u.alive || u.inside || !this.canBuildSite(u, b)) continue;
      u.state = 'build';
      u.buildTarget = b;
      u.target = null;
      u.repairTarget = null;
      u.repathT = 0;
      n++;
    }
    return n;
  }

  // Cada segundo: las obras sin nadie reciben al constructor libre más cercano.
  assignBuilders() {
    const busy = new Set();
    for (const u of this.units) if (u.alive && u.state === 'build' && u.buildTarget) busy.add(u.buildTarget);
    for (const b of this.buildings) {
      if (!this.needsWork(b) || busy.has(b)) continue;
      if (this.assignSite(b)) busy.add(b);
    }
  }

  // Trabajo de un constructor junto a la obra (se aplica en el siguiente paso del edificio).
  workOn(u, b, dt) {
    b.workAcc += (u.def.buildRate || 1) * dt;
    b.lastWork = this.time;
    u.aimYaw = Math.atan2(b.x - u.x, b.z - u.z);
    // Martilleo de obra (solo tus constructores suenan).
    if (u.owner === 0 && Math.random() < dt * 1.3) this.emit('sound', { name: 'build', x: b.x, z: b.z });
    if (Math.random() < dt * 1.5) this.fx.push({ k: 'spark', x: b.x + (Math.random() - 0.5) * 0.7, y: b.y + 0.4 + Math.random() * 0.4, z: b.z + (Math.random() - 0.5) * 0.7, s: 0.18 });
  }

  demolish(b) {
    if (!b.alive || b.type === 'core') return;
    const p = this.players[b.owner];
    const back = b.built ? 0.4 : 0.75;
    p.coins += Math.floor(b.def.cost * back);
    p.energy += Math.floor((b.def.energyCost || 0) * back);
    for (const q of b.queue) {
      p.coins += UNITS[q.type].cost;
      p.energy += UNITS[q.type].energy || 0;
    }
    b.queue = [];
    b.alive = false;
    const c = this.cells[b.cell];
    if (c.bld === b) c.bld = null;
    if (b.def.claim) this.territoryDirty = true;
    this.fx.push({ k: 'boom', x: b.x, y: b.y + 0.3, z: b.z, s: 0.9 });
  }

  foundInvalid(pid, ci, how) {
    const c = this.cells[ci];
    if (!c || !TERRAIN[c.t].land) return 'Elige una casilla de tierra';
    if (c.t === 'gold') return 'No sobre vetas de oro: ponlo al lado';
    if (c.point) return 'Ese punto se captura con infantería';
    if (c.bld) return 'Casilla ocupada';
    if (c.owner >= 0 && this.isEnemy(c.owner, pid)) return 'Es territorio enemigo';
    if (how === 'sea' && !c.nb.some((ni) => TERRAIN[this.cells[ni].t].water)) return 'Debe estar en la costa';
    return null;
  }

  enqueue(b, type) {
    const def = UNITS[type];
    const p = this.players[b.owner];
    if (!b.built) return 'Aún en construcción';
    if (!b.def.produces || !b.def.produces.includes(type)) return 'No se produce aquí';
    if (b.queue.length >= 5) return 'Cola llena (5)';
    if (def.limit) {
      const have = this.units.filter((u) => u.alive && u.owner === b.owner && u.type === type).length +
        this.buildings.reduce((s, x) => s + (x.owner === b.owner ? x.queue.filter((q) => q.type === type).length : 0), 0);
      if (have >= def.limit) return `Límite alcanzado (${def.limit})`;
    }
    if (p.coins < def.cost) return 'Monedas insuficientes';
    if (def.energy && p.energy < def.energy) return `Energía insuficiente (${def.energy}): construye energías (Solar, Eólica...)`;
    this.refreshEconomy();
    if (p.popUsed + def.pop > p.popCap) return 'Población llena: construye o amplía Casas';
    p.coins -= def.cost;
    p.energy -= def.energy || 0;
    b.queue.push({ type, t: 0 });
    b.lastType = type;
    p.popUsed += def.pop;
    return null;
  }

  cancelQueue(b, idx) {
    const q = b.queue[idx];
    if (!q) return;
    b.queue.splice(idx, 1);
    const p = this.players[b.owner];
    p.coins += UNITS[q.type].cost;
    p.energy += UNITS[q.type].energy || 0;
  }

  // Mejoras (punto 6): todos los edificios suben a nivel 3; la Casa a 4. Las hace un constructor.
  upgradeCost(b) {
    const d = b.def;
    const lv = b.level;
    if (lv >= d.maxLevel) return 0;
    if (d.levels) return d.levels[lv + 1].cost;
    if (b.type === 'house') return HOUSE_LEVELS[lv];
    return Math.max(50, Math.round(d.cost * LEVEL_UP_COST[lv]));
  }

  upgradeInvalid(b) {
    if (!b.built) return 'Aún en construcción';
    if (b.upgrading) return 'Ya se está mejorando';
    if (b.level >= b.def.maxLevel) return b.def.maxLevel === 1 ? 'Este edificio no se mejora' : `${b.def.name}: nivel máximo`;
    if (!this.creator || b.owner !== 0) {
      if (this.players[b.owner].coins < this.upgradeCost(b)) return 'Monedas insuficientes';
    }
    return null;
  }

  upgrade(b) {
    const err = this.upgradeInvalid(b);
    if (err) return err;
    const p = this.players[b.owner];
    p.coins -= this.upgradeCost(b);
    b.upgrading = { level: b.level + 1, progress: 0 };
    p.stats.upgrades++;
    this.emit('sound', { name: 'place', pid: b.owner });
    if (!this.assignSite(b) && b.owner === 0) this.warnNoBuilder(b);
    return b;
  }

  finishUpgrade(b) {
    const lv = b.upgrading.level;
    b.upgrading = null;
    const ratio = b.hp / b.maxHp;
    b.level = lv;
    b.maxHp = this.bMaxHp(b.def, lv);
    b.hp = Math.min(b.maxHp, Math.max(b.hp, b.maxHp * ratio));
    this.refreshEconomy();
    this.emit('built', { b, upgraded: true });
    if (b.owner === 0) {
      this.emit('toast', { text: `${b.def.name}: nivel ${lv}`, kind: 'good' });
      this.emit('sound', { name: 'done' });
    }
  }

  cargoSlots(t) {
    let n = 0;
    for (const u of t.cargo) n += u.cls === 'veh' ? 2 : 1;
    return n;
  }

  orderRepair(units, b) {
    let n = 0;
    for (const u of units) {
      if (!u.alive || !u.def.repairs || u.inside) continue;
      u.state = 'repair';
      u.repairTarget = b;
      u.target = null;
      u.repathT = 0;
      n++;
    }
    return n;
  }

  repairBuilding(u, b, dt) {
    u.aimYaw = Math.atan2(b.x - u.x, b.z - u.z);
    if (this.time - b.lastHit < REPAIR.pause) return;
    b.hp = Math.min(b.maxHp, b.hp + REPAIR.rate * dt);
    if (Math.random() < dt * 2) this.fx.push({ k: 'heal', x: b.x + (Math.random() - 0.5) * 0.6, y: b.y + 0.6, z: b.z + (Math.random() - 0.5) * 0.6 });
  }

  repairAround(u, dt) {
    const uc = this.cells[u.cell];
    for (const ci of [uc.i, ...uc.nb]) {
      const b = this.cells[ci].bld;
      if (b && b.alive && b.built && b.owner === u.owner && b.hp < b.maxHp) {
        this.repairBuilding(u, b, dt);
        return;
      }
    }
  }

  orderBoard(units, t) {
    for (const u of units) {
      if (!u.alive || u.mover !== 'land' || u.inside) continue;
      u.state = 'board';
      u.boardTarget = t;
      u.target = null;
      u.repathT = 0;
    }
  }

  board(u, t) {
    const need = u.cls === 'veh' ? 2 : 1;
    if (this.cargoSlots(t) + need > t.def.capacity) {
      this.toast(u.owner, 'La Barcaza está llena', 'bad');
      u.state = 'idle';
      return false;
    }
    t.cargo.push(u);
    u.inside = t;
    u.state = 'idle';
    u.path = [];
    u.boardTarget = null;
    u.target = null;
    u.autoTarget = null;
    if (u.owner === 0) this.emit('sound', { name: 'ready' });
    return true;
  }

  unload(t) {
    if (!t.cargo || !t.cargo.length) return 'La Barcaza va vacía';
    const c0 = this.cells[t.cell];
    const spots = [];
    for (const off of SPIRAL) {
      if (off.d > 2) break;
      const c = this.map.get(c0.q + off.q, c0.r + off.r);
      if (c && this.passable(c, 'land', t.owner)) spots.push(c.i);
    }
    if (!spots.length) return 'Acerca la Barcaza a la orilla para desembarcar';
    t.cargo.forEach((u, i) => {
      const ci = spots[i % spots.length];
      const c = this.cells[ci];
      u.inside = null;
      u.cell = ci;
      u.x = c.x + u.offX;
      u.z = c.z + u.offZ;
      u.y = c.h;
      u.state = 'idle';
      u.path = [];
    });
    const out = t.cargo;
    t.cargo = [];
    if (t.owner === 0) this.emit('sound', { name: 'order' });
    return out;
  }

  // ---------- órdenes ----------
  setPath(u, dest) {
    u.dest = dest;
    u.path = u.mover === 'air' ? [dest] : this.findPath(u.cell, dest, u.mover, u.owner);
    u.pathI = 0;
  }

  spreadDest(u, center, used) {
    for (const off of SPIRAL) {
      if (off.d > 7) break;
      const c = this.map.get(center.q + off.q, center.r + off.r);
      if (!c || used.has(c.i) || !this.passable(c, u.mover, u.owner)) continue;
      return c.i;
    }
    return center.i;
  }

  // Formación en línea (v0.7): una fila de frente al destino, perpendicular a la dirección de marcha.
  // Devuelve una casilla por tropa (ordenadas de izquierda a derecha) y hacia dónde miran.
  lineSlots(units, center) {
    let cx = 0;
    let cz = 0;
    for (const u of units) { cx += u.x; cz += u.z; }
    cx /= units.length;
    cz /= units.length;
    let dx = center.x - cx;
    let dz = center.z - cz;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) { dx = 0; dz = 1; } else { dx /= len; dz /= len; }
    const px = -dz;
    const pz = dx;
    const perRow = 10;
    const order = [...units].sort((a, b) => (a.x * px + a.z * pz) - (b.x * px + b.z * pz));
    const slots = new Map();
    const used = new Set();
    order.forEach((u, k) => {
      const row = Math.floor(k / perRow);
      const inRow = Math.min(perRow, order.length - row * perRow);
      const off = (k % perRow) - (inRow - 1) / 2;
      const x = center.x + px * off * SQ3 - dx * row * SQ3;
      const z = center.z + pz * off * SQ3 - dz * row * SQ3;
      const c = this.map.atWorld(x, z) || center;
      const dest = this.spreadDest(u, c, used);
      used.add(dest);
      slots.set(u, dest);
      // Dentro de su casilla, se para justo sobre la línea (sin salirse de la casilla).
      const dc = this.cells[dest];
      let ox = x - dc.x;
      let oz = z - dc.z;
      const ol = Math.hypot(ox, oz);
      if (ol > 0.7) { ox *= 0.7 / ol; oz *= 0.7 / ol; }
      if (u.mover !== 'air') { u.offX = ox; u.offZ = oz; }
    });
    return { slots, face: Math.atan2(dx, dz) };
  }

  orderMove(units, ci, attackMove = false, formation = 'block') {
    const used = new Set();
    const center = this.cells[ci];
    const alive = units.filter((u) => u.alive);
    const line = formation === 'line' && alive.length > 1 ? this.lineSlots(alive, center) : null;
    for (const u of alive) {
      const dest = line ? line.slots.get(u) : this.spreadDest(u, center, used);
      used.add(dest);
      u.faceYaw = line ? line.face : null;
      u.target = null;
      u.autoTarget = null;
      u.aggroTarget = null;
      u.state = attackMove ? 'amove' : 'move';
      u.resume = attackMove ? dest : -1;
      u.leashCell = -1;
      this.setPath(u, dest);
    }
  }

  orderAttack(units, target) {
    for (const u of units) {
      if (!u.alive) continue;
      u.faceYaw = null;
      const w = u.def.weapon;
      if (!w || !this.canAttack(u, w, target)) continue;
      u.state = 'attack';
      u.target = target;
      u.resume = -1;
      u.repathT = 0;
      u.leashCell = -1;
    }
  }

  orderFound(u, ci) {
    const why = this.foundInvalid(u.owner, ci, u.def.founds);
    if (why) return why;
    u.state = 'found';
    u.foundCell = ci;
    u.target = null;
    this.setPath(u, ci);
    return null;
  }

  orderStop(units) {
    for (const u of units) {
      u.state = 'idle';
      u.path = [];
      u.target = null;
      u.resume = -1;
    }
  }

  // ---------- combate ----------
  canAttack(a, w, t) {
    if (!t.alive || t.inside || !this.isEnemy(a.owner, t.owner)) return false;
    if (t.def.stealth && !(t.seenBy & (1 << this.players[a.owner].team))) return false;
    if (t.kind === 'bld') return w.waterOnly ? t.onWater : (w.mult.bld || 0) > 0;
    if (w.waterOnly) return t.cls === 'ship' || t.cls === 'sub';
    return (w.mult[t.cls] || 0) > 0;
  }

  coverBetween(a, t) {
    const dx = t.x - a.x;
    const dz = t.z - a.z;
    const d = Math.hypot(dx, dz);
    const steps = Math.ceil(d / 0.8);
    for (let i = 1; i < steps; i++) {
      const c = this.map.atWorld(a.x + (dx * i) / steps, a.z + (dz * i) / steps);
      if (c && TERRAIN[c.t].cover && c.i !== t.cell) return true;
    }
    return false;
  }

  inRange(a, w, t, extraTiles = 0) {
    let r = w.range + extraTiles;
    const d = Math.hypot(t.x - a.x, t.z - a.z);
    const reach = (rr) => rr * SQ3 + (t.kind === 'bld' ? 0.75 : 0.35);
    if (d > reach(r)) return false;
    if (a.def.losBlock && d > reach(2) && this.coverBetween(a, t)) r = Math.min(r, 2);
    // Ocultación: una tropa en bosque solo se ataca de cerca, salvo desde el aire.
    if (t.kind === 'unit' && t.mover === 'land' && a.mover !== 'air' && this.cells[t.cell].t === 'forest') r = Math.min(r, 2);
    return d <= reach(r);
  }

  acquire(a, w, extraTiles, exclude = null) {
    const maxD = (w.range + extraTiles) * SQ3 + 0.8;
    // Fuego concentrado (bots desde Normal, v0.8): entre lo que tienen a tiro, primero la tropa
    // armada con menos vida; así la eliminan antes en vez de repartir el daño.
    const focus = extraTiles === 0 && this.players[a.owner].focusFire;
    let best = null;
    let bs = Infinity;
    const check = (t) => {
      if (!t.alive || t.owner === a.owner || t === exclude) return;
      const dx = t.x - a.x;
      const dz = t.z - a.z;
      if (Math.abs(dx) > maxD || Math.abs(dz) > maxD) return;
      if (!this.canAttack(a, w, t)) return;
      const d = Math.hypot(dx, dz);
      if (d > maxD || !this.inRange(a, w, t, extraTiles)) return;
      const s = focus
        ? (t.kind === 'bld' ? 1e6 : 0) + (t.def.weapon ? 0 : 5000) + t.hp + (t.shield || 0) + d * 4
        : d + (t.kind === 'bld' ? 3 : 0) + (t.def.weapon ? 0 : 1.5);
      if (s < bs) { bs = s; best = t; }
    };
    for (const t of this.units) check(t);
    for (const t of this.buildings) check(t);
    return best;
  }

  muzzleY(a) {
    if (a.kind === 'bld') return a.y + (a.type === 'core' ? 1.3 : 0.65);
    if (a.mover === 'air') return a.y + 0.2;
    return a.y + (a.cls === 'inf' ? 0.35 : 0.35);
  }

  fire(a, w, t, gun = 0) {
    if (a.def.stealth) a.lastShot = this.time;
    const mult = t.kind === 'bld' ? w.mult.bld || 0 : w.mult[t.cls] || 0;
    const dmg = w.dmg * mult;
    let sx = a.x;
    const sy = this.muzzleY(a) + (gun && a.type === 'turret' ? 0.05 : 0);
    let sz = a.z;
    if (gun && a.kind === 'bld') {
      // Cañones laterales (miniguns o segundo láser) salen un poco a cada lado.
      const side = gun % 2 === 1 ? 1 : -1;
      const yaw = a.aimYaw || 0;
      sx += Math.cos(yaw) * 0.32 * side;
      sz -= Math.sin(yaw) * 0.32 * side;
    }
    const ty = t.kind === 'bld' ? t.y + 0.4 : t.y + (t.cls === 'inf' ? 0.25 : 0.2);
    const color = PLAYER_COLORS[a.owner];
    if (w.proj === 'laser') {
      this.fx.push({ k: 'laser', x1: sx, y1: sy, z1: sz, x2: t.x, y2: ty, z2: t.z });
      this.damage(t, dmg, a.owner, a);
      this.fx.push({ k: 'spark', x: t.x, y: ty, z: t.z, s: 0.4 });
    } else if (w.proj === 'bullet' || w.proj === 'bolt' || w.proj === 'flak') {
      this.fx.push({ k: 'tracer', x1: sx, y1: sy, z1: sz, x2: t.x, y2: ty, z2: t.z, color, heavy: w.proj !== 'bullet' });
      this.damage(t, dmg, a.owner, a);
      if (w.proj === 'flak' || w.proj === 'bolt') this.fx.push({ k: 'spark', x: t.x, y: ty, z: t.z, s: 0.35 });
    } else {
      const speed = w.proj === 'rocket' ? 10 : w.proj === 'shell' ? 12 : w.proj === 'missile' ? 7 : 5;
      const d = Math.hypot(t.x - sx, t.z - sz);
      this.projectiles.push({
        kind: w.proj, t, dmg, owner: a.owner, src: a, sx, sy, sz, tx: t.x, ty, tz: t.z,
        time: 0, dur: Math.max(0.12, d / speed), color,
      });
    }
    // Sonido: la minigun de la Torreta suena distinto al cañón.
    this.emit('sound', { name: gun && a.type === 'turret' ? 'minigun' : w.proj, x: sx, z: sz });
  }

  domeCovers(owner, t) {
    const p = this.players[owner];
    if (!p.dome || p.dome.hp <= 0 || !p.core.alive) return false;
    return Math.hypot(t.x - p.core.x, t.z - p.core.z) <= DOME_LEVELS[p.dome.level].range * SQ3 + 0.5;
  }

  unitShieldActive(pid) {
    const p = this.players[pid];
    return !!(p && p.dome && p.dome.level >= 3 && p.dome.hp > 0 && p.core && p.core.alive);
  }

  // Lugares con pelea reciente: la interfaz dibuja un icono de combate (documento pág. 13).
  noteFight(t) {
    const last = this._fightCell.get(t.cell) || -99;
    if (this.time - last < 1) return;
    this._fightCell.set(t.cell, this.time);
    this.fights.push({ x: t.x, z: t.z, y: t.y, t: this.time, cell: t.cell });
    if (this.fights.length > 40) this.fights.shift();
  }

  damage(t, dmg, src, srcEnt) {
    if (!t.alive || dmg <= 0) return;
    if (srcEnt) this.noteFight(t);
    if (t.owner === 0 && srcEnt) {
      const k = srcEnt.kind === 'bld' ? 'bld' : srcEnt.type;
      const hb = this.players[0].stats.hitBy;
      hb[k] = (hb[k] || 0) + dmg;
    }
    // Escudo personal de las tropas (Cúpula nivel 3).
    if (t.kind === 'unit' && t.shield > 0) {
      const a = Math.min(t.shield, dmg);
      t.shield -= a;
      dmg -= a;
      t.lastHit = this.time;
      if (dmg <= 0) return;
    }
    // Cúpula: absorbe el daño de barcos, aeronaves y lanzamisiles cerca del Núcleo.
    if (srcEnt && (srcEnt.cls === 'ship' || srcEnt.cls === 'sub' || srcEnt.cls === 'air' || srcEnt.type === 'arty') &&
      this.domeCovers(t.owner, t)) {
      const dome = this.players[t.owner].dome;
      dome.hp -= dmg;
      dome.lastHit = this.time;
      if (dome.hp <= 0) {
        dome.hp = 0;
        dome.brokenAt = this.time;
        this.fx.push({ k: 'boom', x: this.players[t.owner].core.x, y: 2, z: this.players[t.owner].core.z, s: 1.2 });
        if (t.owner === 0) this.emit('toast', { text: `La Cúpula se rompió. Vuelve en ${DOME.recover} s`, kind: 'bad' });
        for (const u of this.units) if (u.owner === t.owner) u.shield = 0;
      }
      return;
    }
    if (t.type === 'core') {
      if (t.shieldUntil > this.time) return;
      const p = this.players[t.owner];
      if (!p.emergencyUsed && t.hp - dmg <= t.maxHp * EMERGENCY.at) {
        p.emergencyUsed = true;
        t.hp = Math.max(1, Math.min(t.hp, t.maxHp * EMERGENCY.at));
        t.shieldUntil = this.time + EMERGENCY.time;
        this.emit('toast', { text: t.owner === 0 ? `¡Escudo de emergencia! ${EMERGENCY.time} s de protección`
          : `${p.name} activó su escudo de emergencia`, kind: t.owner === 0 ? 'good' : 'info' });
        this.emit('sound', { name: 'alarm' });
        return;
      }
    }
    t.hp -= dmg;
    t.lastHit = this.time;
    t.lastAttacker = src;
    const victim = this.players[t.owner];
    if (t.kind === 'bld' && srcEnt && (srcEnt.cls === 'ship' || srcEnt.cls === 'sub' || srcEnt.cls === 'air' || srcEnt.type === 'arty')) {
      victim.navalHitAt = this.time;
    }
    if (t.owner === 0) {
      if (t.type === 'core' && this.time - this._coreWarn > 15) {
        this._coreWarn = this.time;
        this.alert('core', '¡Tu Núcleo está bajo ataque!', 'bad', t.x, t.z, 0);
        this.emit('sound', { name: 'alarm' });
      } else if (t.kind === 'bld') {
        this.alert('bld', `Atacan tu ${t.def.name}`, 'bad', t.x, t.z, 20);
      } else if (this.cells[t.cell].owner === 0) {
        this.alert('units', 'Tus tropas pelean en tu territorio', 'bad', t.x, t.z, 25);
      }
    } else if (src === 0 && !victim.human && !victim.provoked && t.kind === 'bld') {
      victim.provoked = true;
      const lines = PERSONALITIES[victim.persona].lines.provoked;
      this.say(t.owner, lines[Math.floor(Math.random() * lines.length)], { toMe: true, force: true });
    }
    if (t.hp <= 0) this.kill(t, src);
  }

  kill(e, killer) {
    if (!e.alive) return;
    e.alive = false;
    const big = e.kind === 'bld' ? 1.5 : e.cls === 'inf' ? 0.45 : 0.95;
    this.fx.push({ k: 'boom', x: e.x, y: e.y + 0.3, z: e.z, s: big, death: true, bld: e.kind === 'bld' });
    this.emit('sound', { name: e.kind === 'bld' ? 'bigboom' : e.cls !== 'inf' ? 'boom' : 'hit', x: e.x, z: e.z });
    if (killer >= 0 && killer !== e.owner) this.players[killer].stats.kills++;
    if (e.kind === 'unit') this.players[e.owner].stats.lost++;
    if (e.kind === 'bld' && e.owner === 0 && this.camp && !this.over) this.camp.lostBld++;
    if (e.cargo) for (const c of e.cargo) this.kill(c, killer);
    if (e.kind === 'bld') {
      const c = this.cells[e.cell];
      if (c.bld === e) c.bld = null;
      if (e.def.claim) this.territoryDirty = true;
      if (e.type === 'core') this.eliminate(e.owner, killer);
      else if (e.owner === 0) {
        this.emit('toast', { text: `Perdiste: ${e.def.name}`, kind: 'bad', x: e.x, z: e.z });
        this.emit('ping', { x: e.x, z: e.z, kind: 'bad' });
      }
    }
  }

  eliminate(pid, killer) {
    const p = this.players[pid];
    if (!p.alive) return;
    p.alive = false;
    this.elimOrder.push({ pid, time: this.time, killer });
    if (killer >= 0 && killer !== pid) this.players[killer].coresKilled++;
    if (!p.human && p.persona) {
      const lines = PERSONALITIES[p.persona].lines.fall;
      this.say(pid, lines[Math.floor(Math.random() * lines.length)], { force: true, public: true });
    }
    for (const pt of this.points) {
      if (pt.owner === pid) {
        pt.owner = -1;
        pt.prog = 0;
        pt.capTeam = -1;
        this.territoryDirty = true;
      }
    }
    for (const u of this.units) if (u.alive && u.owner === pid) this.kill(u, -1);
    for (const b of this.buildings) if (b.alive && b.owner === pid) this.kill(b, -1);
    this.emit('toast', { text: pid === 0 ? 'Tu Núcleo ha caído' : `${p.name} ha sido eliminado`, kind: pid === 0 ? 'bad' : 'good' });
    if (killer === 0 && pid !== 0) this.completeObjective('kill');
    this.checkEnd();
  }

  endKing(team) {
    if (this.over) return;
    this.over = true;
    this.result = team === this.players[0].team ? 'victory' : 'defeat';
    this.kingWinner = team;
    this.emit('over', { result: this.result, king: true });
  }

  checkEnd() {
    if (this.over) return;
    const me = this.players[0];
    if (!me.alive) {
      this.over = true;
      this.result = 'defeat';
    } else {
      const teams = new Set(this.players.filter((p) => p.alive).map((p) => p.team));
      if (teams.size <= 1) {
        this.over = true;
        this.result = 'victory';
      }
    }
    if (this.over) this.emit('over', { result: this.result });
  }

  completeObjective(id) {
    if (this.objDone[id]) return;
    this.objDone[id] = true;
    this.emit('objective', { id });
  }

  // ---------- simulación ----------
  update(rawDt) {
    const dt = Math.min(rawDt, 0.1) * this.speed;
    if (dt <= 0) return;
    this.time += dt;

    this._slowT -= dt;
    if (this._slowT <= 0) {
      this._slowT = 0.5;
      this.refreshEconomy();
      this.checkObjectives();
      for (const p of this.players) {
        if (p.pendingSay && p.alive && this.time - (p.lastSay || -99) >= 20) {
          const { text, opts } = p.pendingSay;
          p.pendingSay = null;
          this.say(p.id, text, { ...opts, queue: 0 });
        }
      }
    }
    if (this.creator) {
      // Modo creador: monedas y energía infinitas para el jugador.
      this.players[0].coins = 999999;
      this.players[0].energy = 99999;
    }
    this._assignT -= dt;
    if (this._assignT <= 0) {
      this._assignT = 1;
      this.assignBuilders();
    }
    for (const p of this.players) {
      if (!p.alive) continue;
      const inc = (p.income / 60) * dt * this.incomeMult(p);
      p.coins += inc;
      p.stats.earned += inc;
      p.energy += (p.energyRate / 10) * dt;
      if (p.dome && p.dome.hp <= 0 && this.time - p.dome.brokenAt >= DOME.recover) {
        p.dome.hp = p.dome.maxHp;
        if (p.id === 0) this.emit('toast', { text: 'La Cúpula volvió a levantarse', kind: 'good' });
      }
    }
    this.updatePoints(dt);

    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      if (b.alive) this.updateBuilding(b, dt);
    }
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      if (u.alive) this.updateUnit(u, dt);
    }
    this.updateProjectiles(dt);
    if (!this.over) for (const bot of this.bots) bot.update(dt);
    if (this.camp) Campaign.update(this, dt);

    if (this.units.some((u) => !u.alive)) {
      for (const u of this.units) if (!u.alive) this.removed.push(u);
      this.units = this.units.filter((u) => u.alive);
    }
    if (this.buildings.some((b) => !b.alive)) {
      for (const b of this.buildings) if (!b.alive) this.removed.push(b);
      this.buildings = this.buildings.filter((b) => b.alive);
    }
    if (this.territoryDirty) this.recomputeTerritory();

    this._fogT -= dt;
    if (this._fogT <= 0) {
      this._fogT = 0.3;
      this.updateVisibility();
    }
  }

  checkObjectives() {
    if (this.count(0, 'farm') && this.buildings.some((b) => b.owner === 0 && b.type === 'farm' && b.built)) this.completeObjective('farm');
    if (this.buildings.some((b) => b.owner === 0 && b.type === 'barracks' && b.built)) this.completeObjective('barracks');
    const army = this.units.filter((u) => u.owner === 0 && u.def.weapon).length;
    if (army >= 5) this.completeObjective('army');
    if (this.units.some((u) => u.owner === 0 && u.def.builds)) this.completeObjective('builder');
    if (this.buildings.some((b) => b.owner === 0 && b.def.cat === 'energy' && b.built)) this.completeObjective('energy');
    if (this.points.some((pt) => pt.owner === 0)) this.completeObjective('capture');
  }

  // Cúpula (puntos 5 y 6): pide Núcleo nivel 3; sube de nivel 1 a 3.
  domeCost(pid) {
    const p = this.players[pid];
    const next = p.dome ? p.dome.level + 1 : 1;
    return next <= 3 ? DOME_LEVELS[next].cost : 0;
  }

  domeInvalid(pid) {
    const p = this.players[pid];
    if (!p.core.alive || p.core.level < 3) return 'Mejora el Núcleo a nivel 3 para comprar la Cúpula';
    if (p.dome && p.dome.level >= 3) return 'La Cúpula ya está en nivel 3';
    if (!(this.creator && pid === 0) && p.coins < this.domeCost(pid)) return 'Monedas insuficientes';
    return null;
  }

  buyDome(pid) {
    const err = this.domeInvalid(pid);
    if (err) return err;
    const p = this.players[pid];
    p.coins -= this.domeCost(pid);
    const lv = p.dome ? p.dome.level + 1 : 1;
    const L = DOME_LEVELS[lv];
    p.dome = { level: lv, hp: L.hp, maxHp: L.hp, brokenAt: -99, lastHit: -99 };
    if (L.unitShield) {
      for (const u of this.units) {
        if (u.alive && u.owner === pid) {
          u.shieldMax = u.maxHp * L.unitShield;
          u.shield = u.shieldMax;
        }
      }
    }
    this.emit('sound', { name: 'done', pid });
    return null;
  }

  // ---------- captura de puntos ----------
  updatePoints(dt) {
    this._pointT -= dt;
    if (this._pointT > 0) return;
    const step = 0.25 - this._pointT;
    this._pointT = 0.25;
    const nearD = CAPTURE.near * SQ3 + 0.5;
    const clearD = CAPTURE.clear * SQ3 + 0.5;
    for (const pt of this.points) {
      const near = new Map();
      const close = new Set();
      for (const u of this.units) {
        if (!u.alive || u.inside) continue;
        const d = Math.hypot(u.x - pt.x, u.z - pt.z);
        if (d > clearD) continue;
        const team = this.players[u.owner].team;
        close.add(team);
        if (d <= nearD && u.cls === 'inf') {
          if (!near.has(team)) near.set(team, u.owner);
        }
      }
      const ownerTeam = pt.owner >= 0 ? this.players[pt.owner].team : -1;
      pt.contested = close.size > 1;
      if (pt.contested) continue;
      if (near.size === 1) {
        const [team, pid] = [...near.entries()][0];
        const k = step / CAPTURE.time;
        if (team === ownerTeam) {
          pt.prog = Math.min(1, pt.prog + k);
        } else if (pt.owner >= 0) {
          pt.prog -= k;
          if (pt.prog <= 0) {
            const lost = pt.owner;
            pt.owner = -1;
            pt.prog = 0;
            pt.capTeam = team;
            this.territoryDirty = true;
            if (this.players[lost].team === this.players[0].team) {
              this.alert('pt' + pt.id, `Perdiste ${pt.type === 'faro' ? 'el Faro' : 'una Bandera'}`, 'bad', pt.x, pt.z, 0);
            }
          }
        } else {
          if (pt.capTeam !== team) {
            pt.capTeam = team;
            pt.prog = 0;
          }
          pt.prog += k;
          if (pt.prog >= 1) {
            pt.prog = 1;
            pt.owner = pid;
            this.players[pid].stats.captures++;
            this.territoryDirty = true;
            this.refreshEconomy();
            const what = pt.type === 'faro' ? 'el Faro' : 'una Bandera';
            const capP = this.players[pid];
            if (!capP.human && capP.persona) {
              if (capP.team === this.players[0].team) {
                this.say(pid, pt.type === 'faro' ? ALLY_LINES.faro : ALLY_LINES.flag, { x: pt.x, z: pt.z });
              } else if (pt.type === 'faro') {
                const lines = PERSONALITIES[capP.persona].lines.faro;
                this.say(pid, lines[Math.floor(Math.random() * lines.length)], { x: pt.x, z: pt.z, public: true, force: true });
              }
            }
            if (this.players[pid].team === this.players[0].team) {
              this.emit('toast', { text: pid === 0 ? `¡Capturaste ${what}!` : `${this.players[pid].name} capturó ${what}`, kind: 'good' });
              if (pid === 0) this.emit('sound', { name: 'capture' });
              this.emit('sound', { name: 'done' });
            } else if (pt.type === 'faro') {
              this.emit('toast', { text: `${this.players[pid].name} capturó el Faro`, kind: 'bad', x: pt.x, z: pt.z });
              this.emit('ping', { x: pt.x, z: pt.z, kind: 'bad' });
            }
          }
        }
      } else if (pt.owner < 0 && pt.prog > 0 && near.size === 0) {
        pt.prog = Math.max(0, pt.prog - step / (CAPTURE.time * 2));
      }
    }
    if (this.mode.king && !this.over) {
      const faro = this.points.find((pt) => pt.type === 'faro');
      if (faro && faro.owner >= 0) {
        const team = this.players[faro.owner].team;
        this.kingTime[team] = (this.kingTime[team] || 0) + step;
        if (this.kingTime[team] >= KING_TIME) this.endKing(team);
      }
    }
  }

  updateStealth() {
    const detR = (3 * SQ3 + 0.5) ** 2;
    for (const s of this.units) {
      if (!s.alive || !s.def.stealth) continue;
      if (this.time - (s.lastShot || -99) < 3) {
        s.seenBy = 0xff;
        continue;
      }
      let mask = 1 << this.players[s.owner].team;
      const check = (e) => {
        if (!e.alive || !this.isEnemy(e.owner, s.owner)) return;
        const dx = e.x - s.x;
        const dz = e.z - s.z;
        if (dx * dx + dz * dz <= detR) mask |= 1 << this.players[e.owner].team;
      };
      for (const u of this.units) if (u.def.detects) check(u);
      for (const b of this.buildings) if (b.type === 'harbor' && b.built) check(b);
      s.seenBy = mask;
    }
  }

  updateVisibility() {
    const fog = this.fog;
    const myTeam = this.players[0].team;
    this.updateStealth();
    const stealthy = (u) => u.def.stealth && !(u.seenBy & (1 << myTeam));
    if (!fog) {
      for (const u of this.units) u.visible = !u.inside && !stealthy(u);
      return;
    }
    const eyes = [];
    for (const u of this.units) {
      if (this.players[u.owner].team === myTeam) eyes.push([u.x, u.z, ((u.def.vision || (u.def.weapon ? u.def.weapon.range + 1.5 : 3)) * SQ3) ** 2]);
    }
    for (const b of this.buildings) {
      if (this.players[b.owner].team === myTeam) eyes.push([b.x, b.z, ((b.def.vision || 3) * SQ3) ** 2]);
    }
    for (const u of this.units) {
      if (u.inside) { u.visible = false; continue; }
      if (this.players[u.owner].team === myTeam) { u.visible = true; continue; }
      if (stealthy(u)) { u.visible = false; continue; }
      const inForest = u.mover === 'land' && this.cells[u.cell].t === 'forest';
      const forestR = (2 * SQ3 + 0.4) ** 2;
      let vis = false;
      for (const e of eyes) {
        const dx = u.x - e[0];
        const dz = u.z - e[1];
        if (dx * dx + dz * dz <= (inForest ? Math.min(e[2], forestR) : e[2])) { vis = true; break; }
      }
      u.visible = vis;
    }
  }

  updateBuilding(b, dt) {
    const def = b.def;
    // El trabajo de los constructores llega en workAcc; el Puesto avanzado se levanta solo.
    const work = b.type === 'outpost' || this.creator && b.owner === 0 && this.opts.instantBuild ? dt * 3 : b.workAcc;
    b.workAcc = 0;
    b.helped = work > 0;
    if (b.upgrading) {
      b.upgrading.progress += work / (def.build * 0.5);
      if (b.upgrading.progress >= 1) this.finishUpgrade(b);
    }
    if (!b.built) {
      b.progress += work / def.build;
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * work) / def.build);
      if (b.progress >= 1) {
        b.progress = 1;
        b.built = true;
        this.emit('built', { b });
        if (b.owner === 0) {
          this.emit('toast', { text: `${def.name} ${def.fem ? 'terminada' : 'terminado'}`, kind: 'good' });
          this.emit('sound', { name: 'done' });
        }
      }
      return;
    }
    if (b.queue.length) {
      const q = b.queue[0];
      q.t += dt * this.prodRate(b);
      if (q.t >= UNITS[q.type].build) {
        b.queue.shift();
        this.spawnFrom(b, q.type);
      }
    }
    const w = this.weaponOf(b);
    if (w) {
      b.cd -= dt;
      b.scanT -= dt;
      if (b.scanT <= 0) {
        b.scanT = 0.3;
        b.autoTarget = this.acquire(b, w, 0);
        b.autoTarget2 = w.beams > 1 ? this.acquire(b, w, 0, b.autoTarget) : null;
      }
      const t = b.autoTarget;
      if (t && t.alive && this.inRange(b, w, t)) {
        b.aimYaw = Math.atan2(t.x - b.x, t.z - b.z);
        if (b.cd <= 0) {
          this.fire(b, w, t);
          // Núcleo nivel 3: segundo láser (a otro enemigo si lo hay).
          if (w.beams > 1) {
            const t2 = b.autoTarget2 && b.autoTarget2.alive && this.inRange(b, w, b.autoTarget2) ? b.autoTarget2 : t;
            if (t2.alive) this.fire(b, w, t2, 1);
          }
          b.cd = w.cd;
        }
      }
    }
    // Torreta nivel 2: 1 minigun; nivel 3: 2 miniguns.
    const mg = def.minigun;
    if (mg && b.level > 1) {
      const guns = b.level - 1;
      for (let gi = 0; gi < guns; gi++) {
        b.miniCd[gi] -= dt;
        if (b.miniCd[gi] > 0) continue;
        const mw = { ...mg, proj: 'bullet' };
        const mt = b.autoTarget && b.autoTarget.alive && this.canAttack(b, mw, b.autoTarget) && this.inRange(b, mw, b.autoTarget)
          ? b.autoTarget : this.acquire(b, mw, 0);
        if (!mt) continue;
        this.fire(b, mw, mt, gi + 1);
        b.miniCd[gi] = mg.cd;
      }
    }
    const heal = this.healOf(b);
    if (heal) {
      b.healT -= dt;
      if (b.healT <= 0) {
        b.healT = 0.5;
        const rr = (heal.range * SQ3 + 0.4) ** 2;
        for (const u of this.units) {
          if (!u.alive || u.inside || this.isEnemy(u.owner, b.owner) || !heal.cls.includes(u.cls) || u.hp >= u.maxHp) continue;
          const dx = u.x - b.x;
          const dz = u.z - b.z;
          if (dx * dx + dz * dz > rr) continue;
          u.hp = Math.min(u.maxHp, u.hp + (heal.rate ? heal.rate * 0.5 : heal.pct * u.maxHp * 0.5));
          if (Math.random() < 0.25) this.fx.push({ k: 'heal', x: u.x, y: u.y + 0.5, z: u.z });
        }
      }
    }
  }

  spawnFrom(b, type) {
    const def = UNITS[type];
    const ci = this.freeCellsNear(b.cell, def.mover, b.owner, 1)[0];
    const u = this.addUnit(b.owner, type, ci);
    this.players[b.owner].stats.trained++;
    if (b.rally >= 0) this.orderMove([u], b.rally, !!def.weapon);
    if (b.owner === 0) this.emit('sound', { name: 'ready' });
    this.emit('spawned', { u, b });
    return u;
  }

  followPath(u, dt) {
    if (u.pathI >= u.path.length) return true;
    const cells = this.cells;
    const c = cells[u.path[u.pathI]];
    if (u.mover !== 'air' && !this.passable(c, u.mover, u.owner)) {
      const d = u.dest;
      this.setPath(u, d);
      if (!u.path.length) return true;
      return false;
    }
    const last = u.pathI === u.path.length - 1;
    const tx = c.x + (last ? u.offX : u.offX * 0.5);
    const tz = c.z + (last ? u.offZ : u.offZ * 0.5);
    const dx = tx - u.x;
    const dz = tz - u.z;
    const d = Math.hypot(dx, dz);
    let sp = u.def.speed * SQ3;
    if (u.mover === 'land') sp /= TERRAIN[cells[u.cell].t].slow || 1;
    const step = sp * dt;
    if (d <= step) {
      u.x = tx;
      u.z = tz;
      u.pathI++;
    } else {
      u.x += (dx / d) * step;
      u.z += (dz / d) * step;
    }
    if (d > 0.01) u.moveYaw = Math.atan2(dx, dz);
    u.moving = true;
    const nc = this.map.atWorld(u.x, u.z);
    if (nc) u.cell = nc.i;
    return u.pathI >= u.path.length;
  }

  updateUnit(u, dt) {
    if (u.shieldMax > 0) {
      if (!this.unitShieldActive(u.owner)) u.shield = 0;
      else if (this.time - u.lastHit > UNIT_SHIELD.regenDelay) u.shield = Math.min(u.shieldMax, u.shield + u.shieldMax * UNIT_SHIELD.regen * dt);
    } else if (this.unitShieldActive(u.owner)) {
      u.shieldMax = u.maxHp * DOME_LEVELS[3].unitShield;
      u.shield = u.shieldMax;
    }
    if (u.inside) {
      u.x = u.inside.x;
      u.z = u.inside.z;
      u.cell = u.inside.cell;
      return;
    }
    u.moving = false;
    const w = u.def.weapon;
    let ft = null;
    if (w) {
      u.cd -= dt;
      u.scanT -= dt;
      if (u.scanT <= 0) {
        u.scanT = 0.25 + Math.random() * 0.1;
        u.autoTarget = this.acquire(u, w, 0);
        u.aggroTarget = !u.autoTarget && (u.state === 'idle' || u.state === 'amove') ? this.acquire(u, w, 2) : null;
      }
      if (u.target && u.target.alive && this.inRange(u, w, u.target)) ft = u.target;
      else if (u.autoTarget && u.autoTarget.alive && this.inRange(u, w, u.autoTarget)) ft = u.autoTarget;
      if (ft) {
        u.aimYaw = Math.atan2(ft.x - u.x, ft.z - u.z);
        if (u.cd <= 0) {
          this.fire(u, w, ft);
          u.cd = w.cd;
        }
      }
    }

    switch (u.state) {
      case 'idle':
        if (u.def.repairs) this.repairAround(u, dt);
        if (u.aggroTarget && u.aggroTarget.alive && u.def.weapon) {
          u.state = 'attack';
          u.target = u.aggroTarget;
          u.resume = -1;
          u.leashCell = u.cell;
          u.repathT = 0;
        }
        break;
      case 'move':
        if (this.followPath(u, dt)) u.state = 'idle';
        break;
      case 'amove':
        if (ft) break;
        if (u.aggroTarget && u.aggroTarget.alive) {
          u.state = 'attack';
          u.target = u.aggroTarget;
          u.repathT = 0;
          u.leashCell = -1;
          break;
        }
        if (this.followPath(u, dt)) {
          u.state = 'idle';
          u.resume = -1;
        }
        break;
      case 'attack': {
        const t = u.target;
        const lost = !t || !t.alive || !w || !this.canAttack(u, w, t) ||
          (u.leashCell >= 0 && this.map.dist(this.cells[u.cell], this.cells[u.leashCell]) > 5);
        if (lost) {
          u.target = null;
          if (u.resume >= 0) {
            u.state = 'amove';
            this.setPath(u, u.resume);
          } else {
            u.state = 'idle';
            u.path = [];
          }
          u.leashCell = -1;
          break;
        }
        if (this.inRange(u, w, t)) {
          u.path = [];
          u.pathI = 0;
          break;
        }
        u.repathT -= dt;
        if (u.repathT <= 0) {
          u.repathT = 1.0;
          this.setPath(u, t.cell);
          if (!u.path.length && u.mover !== 'air') {
            u.target = null;
            u.state = u.resume >= 0 ? 'amove' : 'idle';
            if (u.resume >= 0) this.setPath(u, u.resume);
            break;
          }
        }
        this.followPath(u, dt);
        break;
      }
      case 'build': {
        const b = u.buildTarget;
        if (!b || !this.needsWork(b)) {
          u.state = 'idle';
          u.buildTarget = null;
          u.path = [];
          break;
        }
        const bc = this.cells[b.cell];
        const uc = this.cells[u.cell];
        if (hexDist(uc.q, uc.r, bc.q, bc.r) <= 1) {
          u.path = [];
          this.workOn(u, b, dt);
          break;
        }
        u.repathT -= dt;
        if (u.repathT <= 0) {
          u.repathT = 1.2;
          this.setPath(u, b.cell);
          if (!u.path.length && hexDist(uc.q, uc.r, bc.q, bc.r) > 1) {
            u.state = 'idle';
            u.buildTarget = null;
            break;
          }
        }
        this.followPath(u, dt);
        break;
      }
      case 'repair': {
        const b = u.repairTarget;
        if (!b || !b.alive || b.hp >= b.maxHp) {
          u.state = 'idle';
          u.repairTarget = null;
          u.path = [];
          break;
        }
        const bc = this.cells[b.cell];
        const uc = this.cells[u.cell];
        if (hexDist(uc.q, uc.r, bc.q, bc.r) <= 1) {
          u.path = [];
          this.repairBuilding(u, b, dt);
          break;
        }
        u.repathT -= dt;
        if (u.repathT <= 0) {
          u.repathT = 1;
          this.setPath(u, b.cell);
        }
        this.followPath(u, dt);
        break;
      }
      case 'board': {
        const t = u.boardTarget;
        if (!t || !t.alive) {
          u.state = 'idle';
          break;
        }
        if (this.map.dist(this.cells[u.cell], this.cells[t.cell]) <= 1) {
          this.board(u, t);
          break;
        }
        u.repathT -= dt;
        if (u.repathT <= 0) {
          u.repathT = 1;
          this.setPath(u, t.cell);
        }
        this.followPath(u, dt);
        break;
      }
      case 'found': {
        const fc = this.cells[u.foundCell];
        const near = this.map.dist(this.cells[u.cell], fc) <= (u.mover === 'land' ? 0 : 1);
        const done = this.followPath(u, dt);
        if (near || done) {
          if (near || this.map.dist(this.cells[u.cell], fc) <= 1) this.tryFound(u);
          else {
            this.toast(u.owner, 'El ingeniero no puede llegar ahí', 'bad');
            u.state = 'idle';
          }
        }
        break;
      }
      default:
        break;
    }

    const cell = this.cells[u.cell];
    const gy = this.groundY(u, cell);
    u.y += (gy - u.y) * Math.min(1, dt * 10);
    // Quieta en formación en línea: mira hacia donde se la mandó.
    const face = u.faceYaw !== null && u.faceYaw !== undefined && u.state === 'idle' ? u.faceYaw : u.yaw;
    const want = u.moving ? u.moveYaw : ft && !u.def.turretOnly ? u.aimYaw : face;
    u.yaw = lerpAngle(u.yaw, want, Math.min(1, dt * 8));
  }

  tryFound(u) {
    const why = this.foundInvalid(u.owner, u.foundCell, u.def.founds);
    const p = this.players[u.owner];
    if (why) {
      this.toast(u.owner, why, 'bad');
      u.state = 'idle';
      return false;
    }
    if (p.coins < BUILDINGS.outpost.cost) {
      // Espera en el sitio hasta reunir el dinero.
      if (!u.warnedCoins) {
        u.warnedCoins = true;
        this.toast(u.owner, 'El ingeniero espera: faltan monedas para el puesto (800)', 'bad');
      }
      return false;
    }
    p.coins -= BUILDINGS.outpost.cost;
    u.alive = false;
    this.addBuilding(u.owner, 'outpost', u.foundCell);
    p.stats.built++;
    if (u.owner === 0) {
      this.emit('toast', { text: 'Puesto avanzado fundado', kind: 'good' });
      this.emit('sound', { name: 'place' });
    }
    return true;
  }

  updateProjectiles(dt) {
    if (!this.projectiles.length) return;
    for (const p of this.projectiles) {
      p.time += dt;
      if (p.t.alive) {
        p.tx = p.t.x;
        p.tz = p.t.z;
      }
      if (p.time >= p.dur) {
        p.done = true;
        if (p.t.alive) this.damage(p.t, p.dmg, p.owner, p.src);
        this.fx.push({ k: 'boom', x: p.tx, y: p.ty, z: p.tz, s: p.kind === 'torpedo' ? 0.7 : 0.5, small: true });
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }
}
