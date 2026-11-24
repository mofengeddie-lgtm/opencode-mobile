// O17 (v1.8): en Normal y Difícil los bots usan tropas nuevas del catálogo; en Fácil, no. Partidas de 20 minutos.
// Uso: node faro/tests/test-v18-bots.cjs  →  escribe faro/tests/results-v18-bots.json
const fs = require('fs');
const ctx = require('./sim.cjs');
const { Game } = ctx;
const NEW = new Set(['soldier', 'gunner', 'atguided', 'mortar', 'armoredcar', 'tankdestroyer', 'ifv', 'howitzer', 'towedgun', 'thermo',
  'gunboat', 'patrolboat', 'corvette', 'attackjet', 'heavybomber', 'gunship']);
const out = {};
for (const difficulty of ['easy', 'normal', 'hard']) {
  const seen = {};
  let trained = 0;
  for (const seed of [21, 22, 23]) {
    const g = new Game({ mode: 'conquest', mapKind: seed === 22 ? 'open' : 'archipelago', difficulty, seed });
    const known = new Set();
    for (let i = 0; i < 20 * 600 && !g.over; i++) {
      g.update(0.1);
      if (i % 20 !== 0) continue;
      for (const u of g.units) {
        if (u.owner === 0 || known.has(u.id)) continue;
        known.add(u.id);
        trained++;
        if (NEW.has(u.type)) seen[u.type] = (seen[u.type] || 0) + 1;
      }
    }
  }
  const n = Object.values(seen).reduce((a, b) => a + b, 0);
  out[difficulty] = { trained, newUnits: n, share: trained ? n / trained : 0, types: seen };
  console.log(`${difficulty}: ${trained} tropas de bots, ${n} nuevas (${Math.round((out[difficulty].share) * 100)} %) · ${Object.keys(seen).join(', ')}`);
}
const pass = out.easy.newUnits === 0 && out.normal.newUnits > 0 && out.hard.newUnits > 0;
fs.writeFileSync(__dirname + '/results-v18-bots.json', JSON.stringify({ ok: pass, ...out }, null, 1));
console.log(pass ? '✅ los bots usan tropas nuevas en Normal y Difícil, no en Fácil' : '❌ revisar');
