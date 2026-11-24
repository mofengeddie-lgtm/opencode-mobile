// Punto 5 (v1.0): piloto automático con nivel de jugador medio (tácticas y ritmo de Normal, ingresos de jugador)
// contra un bot en Normal y en Difícil. Cuenta victorias del piloto.
const ctx = require('./sim.cjs');
const vm = require('vm');
const DIFF = vm.runInContext('DIFFICULTY', ctx);
const diffs = (process.argv[2] || 'normal,hard').split(',');
const mins = Number(process.argv[3] || 25);
const res = {};
for (const diff of diffs) {
  let w = 0, l = 0, n = 0; const out = [];
  for (const [mapKind, persona] of [['continent', 'aggro'], ['archipelago', 'builder'], ['continent', 'keeper'], ['archipelago', 'aggro']]) for (const seed of [3, 8, 13, 21]) {
    let a = (seed * 2654435761) >>> 0;
    ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const g = new ctx.Game({ mode: 'duel', mapKind, difficulty: diff, seed, personas: [null, persona] });
    g.players[0].persona = persona;
    const pilot = new ctx.Bot(g, 0);
    pilot.tac = { ...DIFF.normal.tactics };
    pilot.update = function (dt) { if (!this.p.alive) return; this.t -= dt; this.defendT -= dt; if (this.t > 0) return; this.t = DIFF.normal.think * (0.8 + ctx.Math.random() * 0.4); this.think(); };
    for (let i = 0; i < mins * 600 && !g.over; i++) { g.update(0.1); if (!g.over) pilot.update(0.1); }
    n++; if (g.result === 'victory') w++; else if (g.result === 'defeat') l++;
    out.push(`${mapKind}/${persona}/${seed}:${g.result || 'empate'}@${Math.round(g.time)}`);
  }
  res[diff] = { w, l, d: n - w - l, n, out };
  console.log(diff, JSON.stringify({ w, l, d: n - w - l, n }), out.join(' '));
}
require('fs').writeFileSync(__dirname + '/' + (process.env.OUT || 'duel-diff.json'), JSON.stringify(res, null, 1));
