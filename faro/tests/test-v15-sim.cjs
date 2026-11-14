// Pruebas de lógica de la v1.5: L09 (errores encontrados), reglas sin cambios (L03/L11) y alturas del Núcleo (L03).
// Con FARO_JS=<carpeta de la v1.4> se corren las mismas pruebas de errores sobre la v1.4 (deben fallar).
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const V = (e) => vm.runInContext(e, ctx);
const TERRAIN = V('TERRAIN');
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const OLD = !!process.env.FARO_JS;

// ---------- L09a: Dúos en Arrecife Doble ----------
{
  const out = [];
  let bad = 0;
  let tot = 0;
  for (const mode of ['duos', 'conquest', 'league', 'king', 'duel', 'big', 'ffa', 'teams', 'blitz']) {
    for (const mapKind of ['reef', 'archipelago', 'open', 'continent', 'bay', 'mesa', 'dunes']) {
      let b = 0;
      for (let s = 1; s <= 40; s++) { seedRandom(s * 7919); tot++; try { new ctx.Game({ mode, mapKind, difficulty: 'normal', seed: s * 7919 }); } catch (e) { b++; } }
      if (b) out.push(`${mode} en ${mapKind}: ${b} de 40 no se pueden crear`);
      bad += b;
    }
  }
  // En Dúos/Arrecife: cada casa conectada por tierra con su isla centro.
  let linked = 0;
  let duosOk = 0;
  for (let s = 1; s <= 40; s++) {
    seedRandom(s * 31);
    try {
      const g = new ctx.Game({ mode: 'duos', mapKind: 'reef', difficulty: 'normal', seed: s * 31 });
      duosOk++;
      const m = g.map;
      if (m.homes.every((hi, i) => g.cells[hi].comp === m.atWorld(m.hubFor(i).x, m.hubFor(i).z).comp)) linked++;
    } catch (e) { /* cuenta como no creada */ }
  }
  check('L09a', 'Dúos en Arrecife Doble se puede jugar', bad === 0 && duosOk === 40 && linked === 40,
    `${tot} partidas creadas (9 modos × 7 mapas × 40 semillas): ${bad ? `${bad} fallan (${out.join('; ')})` : 'todas bien'}; Dúos en Arrecife: ${duosOk} de 40 creadas, ${OLD ? 'sin islas centro' : `${linked} de 40 con cada casa unida a pie a su isla centro`}`);
}

// ---------- L09b: reparar un edificio rodeado ----------
{
  seedRandom(77);
  const g = new ctx.Game({ mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 77, fog: false });
  g.bots = [];
  const core = g.cells[g.players[0].core.cell];
  // Una casilla con sus 6 vecinas libres; se llenan de Granjas y en el centro va una Casa dañada.
  const center = g.cells.find((c) => g.passable(c, 'land', 0) && !c.bld && !c.point && g.map.dist(c, core) >= 3 && g.map.dist(c, core) <= 6 &&
    c.nb.length === 6 && c.nb.every((ni) => g.passable(g.cells[ni], 'land', 0) && !g.cells[ni].bld && !g.cells[ni].point));
  const house = g.addBuilding(0, 'house', center.i, true);
  for (const ni of center.nb) g.addBuilding(0, 'solar', ni, true);
  const surrounded = center.nb.every((ni) => g.cells[ni].bld);
  house.hp = house.maxHp * 0.4;
  house.lastHit = -99;
  const spot = g.freeCellsNear(core.i, 'land', 0, 4).find((ci) => g.map.dist(g.cells[ci], center) >= 3);
  const eng = g.addUnit(0, 'engineer', spot);
  const toasts = [];
  g.on && g.on('toast', (t) => toasts.push(t.text));
  const origToast = g.toast.bind(g);
  g.toast = (owner, text, kind) => { if (owner === 0) toasts.push(text); return origToast(owner, text, kind); };
  g.orderRepair([eng], house);
  let t = 0;
  for (; t < 600; t++) { g.update(0.1); if (eng.state !== 'repair') break; }
  const gaveUp = eng.state !== 'repair';
  // La reparación sola no vuelve a elegir ese edificio enseguida.
  let again = 0;
  for (let i = 0; i < 100; i++) { g.update(0.1); if (eng.state === 'repair') again++; }
  check('L09b', 'Reparar algo rodeado ya no deja al Ingeniero esperando', surrounded && gaveUp && t <= 30 && again === 0,
    `Casa dañada rodeada por 6 Paneles solares (${surrounded}); el Ingeniero ${gaveUp ? `deja la orden en ${(t / 10).toFixed(1)} s` : 'sigue en «reparar» después de 60 s'}${toasts.length ? ` y avisa «${toasts.filter((x) => /reparar|llegar/i.test(x)).slice(0, 1).join('')}»` : ''}; en los 10 s siguientes no lo vuelve a intentar (${again === 0})`);
}

// ---------- L09c: «Avanzar atacando» con enemigos al otro lado del agua ----------
// Escopetero (alcance 2) que avanza por la costa; enfrente, en otra isla y a 4 casillas, Constructores enemigos:
// los ve (sale a buscar a 2 casillas más de su alcance) pero no los alcanza ni encuentra camino.
{
  let tried = 0;
  let arrived = 0;
  const out = [];
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
    seedRandom(seed);
    const g = new ctx.Game({ mode: 'duel', mapKind: 'reef', difficulty: 'normal', seed, fog: false });
    g.bots = [];
    const home = g.cells[g.players[0].core.cell];
    const isl = home.comp;
    let start = null;
    let other = [];
    for (const c of g.cells) {
      if (c.comp !== isl || c.bld || c.point || !g.passable(c, 'land', 0)) continue;
      const near = g.cells.filter((e) => e.comp !== isl && e.comp >= 0 && TERRAIN[e.t].land && !e.bld && !e.point && g.passable(e, 'land', 1) && g.map.dist(c, e) === 4);
      if (near.length >= 6) { start = c; other = near.slice(0, 8); break; }
    }
    if (!start) continue;
    const dest = g.cells.filter((c) => c.comp === isl && !c.bld && g.passable(c, 'land', 0) && g.map.dist(c, start) >= 7 && g.map.dist(c, start) <= 9)[0];
    if (!dest) continue;
    tried++;
    const u = g.addUnit(0, 'shotgun', start.i);
    for (const e of other) g.addUnit(1, 'builder', e.i);
    g.orderMove([u], dest.i, true);
    let t = 0;
    for (; t < 900; t++) { g.update(0.1); if (g.map.dist(g.cells[u.cell], dest) <= 1) break; }
    const ok = g.map.dist(g.cells[u.cell], dest) <= 1;
    if (ok) arrived++;
    out.push(`mapa ${seed}: ${ok ? `llegó en ${(t / 10).toFixed(0)} s` : `no llegó en 90 s (a ${g.map.dist(g.cells[u.cell], dest)} casillas, «${u.state}»)`}`);
  }
  check('L09d', '«Avanzar atacando» sigue llegando aunque vea enemigos que no puede alcanzar', tried >= 4 && arrived === tried,
    `Escopetero que avanza atacando por la costa del Arrecife Doble, con 6 a 8 Constructores enemigos en otra isla a 4 casillas (los ve, pero no hay camino): ${out.join('; ')}`);
}

if (!OLD) {
  // ---------- Reglas sin cambios frente a la v1.4 ----------
  const vm2 = require('vm');
  const dir14 = path.join(__dirname, 'v14src/faro/src/js/');
  const ctx14 = { console, performance, Math, JSON, Set, Map, Array, Object, Number, String, Float32Array, Int32Array, Uint32Array, Uint8Array, Infinity, isFinite };
  vm2.createContext(ctx14);
  vm2.runInContext(fs.readFileSync(dir14 + '00-config.js', 'utf8') + ';globalThis.U=UNITS;globalThis.B=BUILDINGS;', ctx14);
  const cur = { U: V('UNITS'), B: V('BUILDINGS') };
  const diffs = [];
  const cmp = (a, b, where) => {
    if (typeof a === 'number' || typeof b === 'number' || typeof a === 'string' || typeof b === 'string' || typeof a === 'boolean') { if (a !== b) diffs.push(`${where}: ${b} → ${a}`); return; }
    if (!a || !b || typeof a !== 'object') { if (a !== b && !(a == null && b == null)) diffs.push(`${where}`); return; }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (typeof a[k] !== 'function') cmp(a[k], b[k], `${where}.${k}`);
  };
  cmp(cur.U, ctx14.U, 'UNITS');
  cmp(cur.B, ctx14.B, 'BUILDINGS');
  const seasons = (() => { try { V('SEASONS'); return true; } catch (e) { return false; } })();
  check('L01sim', 'Sin temporadas por fecha y reglas iguales a la v1.4', !seasons && diffs.length === 0,
    `la tabla de temporadas por fecha (Calabazas, Invierno) ya no existe en el juego (${!seasons}); precios, vida, daño, alcance, velocidad y tiempos de las ${Object.keys(cur.U).length} tropas y los ${Object.keys(cur.B).length} edificios iguales a la v1.4: ${diffs.length ? `NO (${diffs.slice(0, 6).join('; ')})` : 'sí'}`);

  // ---------- L03: alturas de los modelos del Núcleo (glTF: mínimo y máximo de las posiciones) ----------
  const glbBox = (buf) => {
    const len = buf.readUInt32LE(12);
    const json = JSON.parse(buf.slice(20, 20 + len).toString('utf8'));
    let minY = Infinity; let maxY = -Infinity; let tris = 0;
    const nodeY = {};
    for (const n of json.nodes || []) if (n.mesh !== undefined) nodeY[n.mesh] = (n.translation || [0, 0, 0])[1];
    (json.meshes || []).forEach((m, mi) => {
      for (const p of m.primitives) {
        const a = json.accessors[p.attributes.POSITION];
        minY = Math.min(minY, a.min[1] + (nodeY[mi] || 0));
        maxY = Math.max(maxY, a.max[1] + (nodeY[mi] || 0));
        tris += (p.indices !== undefined ? json.accessors[p.indices].count : a.count) / 3;
      }
    });
    return { h: maxY - minY, tris: Math.round(tris), bytes: buf.length };
  };
  const rows = [];
  let taller = true;
  let distinct = new Set();
  for (const lv of [1, 2, 3]) {
    const now = glbBox(fs.readFileSync(`/home/user/opencode-mobile/faro/assets/models/core_${lv}.glb`));
    const old = glbBox(execSync(`git -C /home/user/opencode-mobile show c672a4b:faro/assets/models/core_${lv}.glb`, { maxBuffer: 1e7 }));
    if (!(now.h > old.h * 1.2)) taller = false;
    distinct.add(`${now.h.toFixed(3)}|${now.tris}`);
    rows.push(`nivel ${lv}: alto ${old.h.toFixed(2)} → ${now.h.toFixed(2)} (${Math.round((now.h / old.h - 1) * 100)} % más), ${old.tris} → ${now.tris} triángulos`);
  }
  check('L03model', 'Núcleo nuevo: 3 niveles distintos y más altos', taller && distinct.size === 3, rows.join('; ') + ' (1 = radio de una casilla)');
}

fs.writeFileSync(__dirname + (process.env.OUT || '/results-v15-sim.json'), JSON.stringify(results, null, 1));
