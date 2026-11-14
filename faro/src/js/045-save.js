'use strict';
// Guardar y cargar una partida (punto 16: si sales sin querer, puedes volver).
// Convierte todo el estado del juego en JSON: las referencias entre objetos (un edificio que
// apunta a su objetivo, el Núcleo de cada jugador...) se guardan como números, y los datos de
// configuración (BUILDINGS, UNITS...) como su nombre, para no copiarlos.

const SAVE_KEY = 'faro-save-v1';
const SAVE_VERSION = 1;

const Save = {
  _paths: null,
  _byPath: null,

  // Recorre la configuración una vez y anota la ruta de cada objeto (por ejemplo «BUILDINGS.core»).
  _consts() {
    if (this._paths) return this._paths;
    const paths = new Map();
    const byPath = new Map();
    const roots = {
      BUILDINGS, UNITS, MODES, MAPS, DIFFICULTY, POINTS, PERSONALITIES, TERRAIN, DOME_LEVELS, UNIT_SHIELD,
      HOUSE_LEVELS, DOME, EMERGENCY, REPAIR, CAPTURE, PALETTES, BUILD_TABS, OBJECTIVES, PLAYER_COLORS,
      PLAYER_NAMES, LEVEL_UP_COST, PERSONALITY_ORDER, ALLY_LINES, CAT_NAMES, CAMPAIGN,
    };
    const walk = (o, path, depth) => {
      if (!o || typeof o !== 'object' || paths.has(o) || depth > 6) return;
      paths.set(o, path);
      byPath.set(path, o);
      for (const k of Object.keys(o)) walk(o[k], path + '.' + k, depth + 1);
    };
    for (const [name, obj] of Object.entries(roots)) walk(obj, name, 0);
    this._paths = paths;
    this._byPath = byPath;
    return paths;
  },

  // v1.3: guardado más chico y rápido (cada 60 s). El mapa no se guarda: se vuelve a crear con su
  // semilla al cargar (una suma de control comprueba que sea el mismo). Las casillas solo guardan lo
  // que no se puede recalcular; los efectos visuales y avisos ya mostrados tampoco se guardan.
  MAP_STATIC: ['i', 'q', 'r', 'x', 'z', 't', 'h', 'land', 'nb', 'comp', 'bridge'],
  // Datos de las casillas que se vuelven a poner al cargar: territorio (se recalcula), edificio y punto.
  CELL_REBUILT: ['owner', 'ownerD', 'ownerId', 'bld', 'point'],
  GAME_TRANSIENT: ['fx', 'events', 'removed'],

  mapCheck(cells) {
    let h = 2166136261;
    for (const c of cells) {
      const str = `${c.q},${c.r},${c.t},${Math.round(c.h * 100)},${c.land ? 1 : 0},${c.comp},${c.bridge ? 1 : 0};`;
      for (let k = 0; k < str.length; k++) {
        h ^= str.charCodeAt(k);
        h = Math.imul(h, 16777619);
      }
    }
    return h >>> 0;
  },

  serialize(game) {
    const consts = this._consts();
    const ids = new Map();
    const objs = [];
    const map = game.map;
    const compact = map instanceof GameMap && map.cells === game.cells;
    const cellIdx = compact ? new Map(map.cells.map((c, i) => [c, i])) : null;
    const skipGame = new Set(this.GAME_TRANSIENT);
    if (compact) skipGame.add('cells');
    const skipMap = new Set(['cells', 'lookup']);
    const classes = new Map([[Game.prototype, 'Game'], [Bot.prototype, 'Bot'], [GameMap.prototype, 'GameMap'], [MinHeap.prototype, 'MinHeap']]);
    const enc = (v) => {
      if (typeof v === 'function' || v === undefined) return undefined;
      if (typeof v === 'number' && !Number.isFinite(v)) return { $n: String(v) };
      if (v === null || typeof v !== 'object') return v;
      const cp = consts.get(v);
      if (cp) return { $c: cp };
      const known = ids.get(v);
      if (known !== undefined) return { $r: known };
      if (cellIdx && cellIdx.has(v)) {
        // Referencia a una casilla: al cargar apunta a la casilla recreada.
        const cid = objs.length;
        ids.set(v, cid);
        objs.push({ cell: cellIdx.get(v) });
        return { $r: cid };
      }
      const id = objs.length;
      ids.set(v, id);
      objs.push(null);
      let rec;
      if (Array.isArray(v)) rec = { a: v.map((x) => { const e = enc(x); return e === undefined ? null : e; }) };
      else if (v instanceof Map) rec = { m: [...v].map(([k, x]) => [enc(k), enc(x)]) };
      else if (v instanceof Set) rec = { s: [...v].map(enc) };
      else if (ArrayBuffer.isView(v)) rec = { t: v.constructor.name, n: v.length };
      else {
        const o = {};
        const skip = v === game ? skipGame : compact && v === map ? skipMap : null;
        for (const k of Object.keys(v)) {
          if (skip && skip.has(k)) continue;
          const e = enc(v[k]);
          if (e !== undefined) o[k] = e;
        }
        rec = { o };
        const cls = classes.get(Object.getPrototypeOf(v));
        if (cls) rec.k = cls;
        if (compact && v === map) {
          // Datos de casillas que no se recalculan solos (si los hay): se guardan aparte.
          const fixed = new Set([...this.MAP_STATIC, ...this.CELL_REBUILT]);
          const extra = [];
          map.cells.forEach((c, i) => {
            const ks = Object.keys(c).filter((k) => !fixed.has(k));
            if (!ks.length) return;
            const eo = {};
            for (const k of ks) {
              const e = enc(c[k]);
              if (e !== undefined) eo[k] = e;
            }
            extra.push([i, eo]);
          });
          // La suma de control se calcula una vez por mapa (sus casillas fijas no cambian en la partida).
          if (!this._checks) this._checks = new WeakMap();
          let check = this._checks.get(map);
          if (check === undefined) {
            check = this.mapCheck(map.cells);
            this._checks.set(map, check);
          }
          rec.gen = { seed: map.seed, kind: map.kind, n: map.n, pairs: !!map.pairs, check, extra };
        }
      }
      objs[id] = rec;
      return { $r: id };
    };
    enc(game);
    let maxId = 0;
    for (const e of game.units) maxId = Math.max(maxId, e.id || 0);
    for (const e of game.buildings) maxId = Math.max(maxId, e.id || 0);
    return { v: SAVE_VERSION, nextId: Math.max(maxId + 1, _nextId), objs };
  },

  deserialize(data) {
    if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.objs)) throw new Error('Guardado no válido');
    this._consts();
    const byPath = this._byPath;
    const classes = { Game, Bot, GameMap, MinHeap };
    const typed = { Float32Array, Int32Array, Uint32Array, Uint8Array, Int16Array, Uint16Array, Float64Array };
    let fresh = null;
    const genRec = data.objs.find((r) => r && r.gen);
    if (genRec) {
      const g0 = genRec.gen;
      fresh = new GameMap(g0.seed, g0.kind, g0.n, g0.pairs);
      if (this.mapCheck(fresh.cells) !== g0.check) throw new Error('El mapa no coincide con esta versión del juego');
    }
    const made = data.objs.map((r) => {
      if (r.cell !== undefined) return fresh.cells[r.cell];
      if (r.a) return [];
      if (r.m) return new Map();
      if (r.s) return new Set();
      // Los arreglos numéricos son memoria de trabajo del buscador de caminos: se crean vacíos.
      if (r.t) return new (typed[r.t] || Float32Array)(r.n);
      return r.k && classes[r.k] ? Object.create(classes[r.k].prototype) : {};
    });
    const dec = (v) => {
      if (v === null || typeof v !== 'object') return v;
      if (v.$r !== undefined) return made[v.$r];
      if (v.$c !== undefined) {
        if (!byPath.has(v.$c)) throw new Error('Dato de configuración desconocido: ' + v.$c);
        return byPath.get(v.$c);
      }
      if (v.$n !== undefined) return Number(v.$n);
      return v;
    };
    data.objs.forEach((r, i) => {
      if (r.cell !== undefined) return;
      const t = made[i];
      if (r.a) r.a.forEach((x) => t.push(dec(x)));
      else if (r.m) r.m.forEach(([k, x]) => t.set(dec(k), dec(x)));
      else if (r.s) r.s.forEach((x) => t.add(dec(x)));
      else if (r.o) for (const k of Object.keys(r.o)) t[k] = dec(r.o[k]);
    });
    const game = made[0];
    if (!(game instanceof Game)) throw new Error('Guardado no válido');
    _nextId = Math.max(_nextId, data.nextId || 1);
    game.events = [];
    if (!game.fx) game.fx = [];
    if (!game.removed) game.removed = [];
    if (genRec) {
      // Mapa recreado: casillas nuevas, con sus edificios, puntos y datos extra.
      game.map.cells = fresh.cells;
      game.map.lookup = fresh.lookup;
      game.cells = fresh.cells;
      for (const [ci, eo] of genRec.gen.extra || []) for (const k of Object.keys(eo)) fresh.cells[ci][k] = dec(eo[k]);
      for (const c of fresh.cells) { c.bld = null; delete c.point; }
      for (const b of game.buildings) if (b.alive) fresh.cells[b.cell].bld = b;
      for (const pt of game.points || []) fresh.cells[pt.cell].point = pt;
    }
    // Los datos de cada edificio y tropa vuelven a apuntar a la configuración actual.
    for (const b of game.buildings) if (BUILDINGS[b.type]) b.def = BUILDINGS[b.type];
    for (const u of game.units) if (UNITS[u.type]) u.def = UNITS[u.type];
    // Partidas guardadas antes de la v1.1: equipo de origen para las alianzas.
    for (const p of game.players) if (p.team0 === undefined) p.team0 = p.team;
    if (!game.radZones) game.radZones = [];
    game.territoryDirty = true;
    return game;
  },

  // Datos para mostrar en el vestíbulo sin cargar toda la partida.
  summary(game) {
    const me = game.players[0];
    return {
      mode: game.mode.name, map: (MAPS[game.opts.mapKind] || {}).name || '', time: Math.round(game.time),
      alive: game.players.filter((p) => p.alive).length, players: game.players.length,
      units: game.units.filter((u) => u.owner === 0 && u.alive).length, coins: Math.round(me.coins),
      savedAt: Date.now(), creator: !!game.creator,
      ranked: !!(game.mode.ranked && !game.opts.custom),
    };
  },

  write(game) {
    if (!game || game.over || game.preview) return false;
    try {
      const data = this.serialize(game);
      data.summary = this.summary(game);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('[Guardado] No se pudo guardar la partida:', err && err.message);
      return false;
    }
  },

  peek() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.v === SAVE_VERSION ? data.summary || {} : null;
    } catch (err) {
      return null;
    }
  },

  read() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? this.deserialize(JSON.parse(raw)) : null;
    } catch (err) {
      console.warn('[Guardado] No se pudo cargar la partida:', err && err.message);
      return null;
    }
  },

  clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* sin almacenamiento */ }
  },
};
