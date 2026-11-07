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
      PLAYER_NAMES, LEVEL_UP_COST, PERSONALITY_ORDER, ALLY_LINES, CAT_NAMES,
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

  serialize(game) {
    const consts = this._consts();
    const ids = new Map();
    const objs = [];
    const classes = new Map([[Game.prototype, 'Game'], [Bot.prototype, 'Bot'], [GameMap.prototype, 'GameMap'], [MinHeap.prototype, 'MinHeap']]);
    const enc = (v) => {
      if (typeof v === 'function' || v === undefined) return undefined;
      if (typeof v === 'number' && !Number.isFinite(v)) return { $n: String(v) };
      if (v === null || typeof v !== 'object') return v;
      const cp = consts.get(v);
      if (cp) return { $c: cp };
      const known = ids.get(v);
      if (known !== undefined) return { $r: known };
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
        for (const k of Object.keys(v)) {
          const e = enc(v[k]);
          if (e !== undefined) o[k] = e;
        }
        rec = { o };
        const cls = classes.get(Object.getPrototypeOf(v));
        if (cls) rec.k = cls;
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
    const made = data.objs.map((r) => {
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
    // Los datos de cada edificio y tropa vuelven a apuntar a la configuración actual.
    for (const b of game.buildings) if (BUILDINGS[b.type]) b.def = BUILDINGS[b.type];
    for (const u of game.units) if (UNITS[u.type]) u.def = UNITS[u.type];
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
