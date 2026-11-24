// v1.9: ¿las partidas normales (sin Campo de pruebas) quedan idénticas antes y después de juntar el Laboratorio (v1.8.1)?
// Uso: FARO_JS=<carpeta src/js/ de otra versión> node test-v19-same.cjs  → una huella por partida (azar fijo); se comparan las dos salidas.
const crypto = require('crypto');
const ctx = require('./sim.cjs');
const CASES = [['ffa', 'archipelago', 'normal', 1], ['ffa', 'continent', 'hard', 2], ['duos', 'archipelago', 'normal', 3], ['conquest', 'bay', 'easy', 4]];
const out = {};
for (const [mode, mapKind, difficulty, seed] of CASES) {
  // Azar fijo por partida (el mismo en las dos versiones).
  let a = (seed * 2654435761) >>> 0;
  ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let g;
  try { g = new ctx.Game({ mode, mapKind, difficulty, fog: false, turbo: false, seed }); } catch (e) { out[`${mode}/${mapKind}`] = 'no se pudo: ' + e.message; continue; }
  for (let i = 0; i < 15 * 600 && !g.over; i++) g.update(0.1);
  const st = JSON.stringify({ t: Math.round(g.time * 10), over: g.result || null,
    p: g.players.map((p) => [p.alive, Math.round(p.coins), p.income, p.popUsed]),
    u: g.units.filter((u) => u.alive).map((u) => [u.owner, u.type, Math.round(u.x * 100), Math.round(u.z * 100), Math.round(u.hp)]),
    b: g.buildings.filter((b) => b.alive).map((b) => [b.owner, b.type, b.cell, Math.round(b.hp)]) });
  out[`${mode}/${mapKind}/${difficulty}/${seed}`] = crypto.createHash('sha256').update(st).digest('hex').slice(0, 16) + ` (${g.units.filter((u) => u.alive).length} tropas, ${g.buildings.filter((b) => b.alive).length} edificios, ${Math.round(g.time)} s${g.over ? ', ' + g.result : ''})`;
}
console.log(JSON.stringify(out, null, 1));
