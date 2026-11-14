// K13 (arreglo hallado en las pruebas): tropas que suben a una Barcaza lejos de su orilla.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const { Game } = ctx;
const TERRAIN = V('TERRAIN');
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const out = [];
let okAll = true;
let tried = 0;
let triedB = 0;
for (const seed of [11, 12, 13, 14, 15, 16]) {
  seedRandom(seed);
  const g = new Game({ mode: 'duel', mapKind: 'open', difficulty: 'normal', seed, fog: false });
  g.bots = [];
  const core = g.cells[g.players[0].core.cell];
  const isl = core.comp;
  const land = g.cells.filter((c) => c.comp === isl);
  // Casilla de mar a 3 casillas de la isla (ni a 1 ni a 2), en un mar que toca la isla.
  const seaComps = new Set();
  for (const c of land) for (const ni of c.nb) { const n = g.cells[ni]; if (TERRAIN[n.t].water && !TERRAIN[n.t].land) seaComps.add(n.comp); }
  const dLand = (c) => { let m = 99; for (const l of land) { const d = g.map.dist(c, l); if (d < m) m = d; } return m; };
  const sea = g.cells.filter((c) => seaComps.has(c.comp) && !c.bld && TERRAIN[c.t].water && !TERRAIN[c.t].land && g.map.dist(c, core) <= 14 && dLand(c) === 3);
  if (!sea.length) continue;
  tried++;
  const s = sea[0];
  const barge = g.addUnit(0, 'barge', s.i);
  const spots = g.freeCellsNear(core.i, 'land', 0, 5);
  const us = spots.slice(0, 3).map((ci) => g.addUnit(0, 'rifle', ci));
  g.orderBoard(us, barge);
  let t = 0;
  for (; t < 1200; t++) { g.update(0.1); if (us.every((u) => u.inside)) break; }
  const inside = us.filter((u) => u.inside).length;
  const ok = inside === 3;
  if (!ok) okAll = false;
  out.push(`mapa ${seed}: Barcaza a 3 casillas de la costa, 3 Artilleros en tierra → ${inside} de 3 a bordo${ok ? ` en ${(t / 10).toFixed(0)} s` : ' en 2 min'}`);
  // Caso B (el del tutorial): Barcaza pegada a la costa, pero toda la orilla junto a ella está ocupada por edificios.
  const s2 = g.cells.find((c) => seaComps.has(c.comp) && !c.bld && TERRAIN[c.t].water && !TERRAIN[c.t].land && g.map.dist(c, core) >= 4 && g.map.dist(c, core) <= 12 &&
    c.nb.some((ni) => g.cells[ni].comp === isl) && c.nb.every((ni) => g.cells[ni].comp !== isl || (!g.cells[ni].bld && !g.units.some((u) => u.cell === ni))));
  if (!s2) continue;
  let blocked = 0;
  for (const ni of s2.nb) if (g.cells[ni].comp === isl) { const b = g.addBuilding(0, 'farm', ni, true); if (b && g.cells[ni].bld) blocked++; }
  const coastOk = s2.nb.every((ni) => g.cells[ni].comp !== isl || g.cells[ni].bld);
  const barge2 = g.addUnit(0, 'barge', s2.i);
  const spots2 = g.freeCellsNear(core.i, 'land', 0, 5).filter((ci) => !g.units.some((u) => u.cell === ci));
  const us2 = spots2.slice(0, 3).map((ci) => g.addUnit(0, 'rifle', ci));
  g.orderBoard(us2, barge2);
  let t2 = 0;
  for (; t2 < 1200; t2++) { g.update(0.1); if (us2.every((u) => u.inside)) break; }
  const in2 = us2.filter((u) => u.inside).length;
  const ok2 = in2 === 3 && coastOk;
  if (!ok2) okAll = false;
  triedB++;
  out.push(`mapa ${seed} con la orilla tapada (${blocked} ${blocked === 1 ? "Granja" : "Granjas"} en las casillas de tierra junto a la Barcaza) → ${in2} de 3 a bordo${ok2 ? ` en ${(t2 / 10).toFixed(0)} s` : ' en 2 min'}`);
}
const ok = okAll && tried >= 3 && triedB >= 3;
const ev = out.join('; ');
console.log(ok ? 'OK  ' : 'FAIL', 'K13', ev);
fs.writeFileSync(__dirname + (process.env.OUT || '/results-v14-board.json'), JSON.stringify([{ id: 'K13', ok, ev }], null, 1));
