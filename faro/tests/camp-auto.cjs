// D04: las 6 misiones se pueden ganar con órdenes automáticas (un piloto bot juega por ti).
const ctx = require('./sim.cjs');
const ids = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
const personas = (process.argv[3] || 'builder,builder,keeper,keeper,aggro,aggro').split(',');
const seeds = (process.argv[4] || '1').split(',').map(Number);
const res = [];
for (const id of ids) {
  for (const rs of seeds) {
    let a = (rs * 2654435761) >>> 0;
    ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const g = new ctx.Game(ctx.Campaign.opts(id)); if (process.env.NOAUTOREP) g.players[0].autoRepair = false;
    g.players[0].persona = personas[id - 1];
    const pilot = new ctx.Bot(g, 0);
    if (process.env.SHARP) {
      // Piloto «atento»: reacciona como el bot Difícil (tácticas y tiempo de decisión), sin monedas extra.
      pilot.tac = { group: true, retreat: true, counter: true, focusDefense: true };
      pilot.update = function (dt) { if (!this.p.alive) return; this.t -= dt; this.defendT -= dt; if (this.t > 0) return; this.t = 1.1 * (0.8 + ctx.Math.random() * 0.4); this.think(); };
    }
    if (process.env.HUMANMULT) g.incomeMult = function (p) { return p.human ? 1 : this.diff.income; };
    const t0 = Date.now();
    let log = [];
    for (let i = 0; i < 30 * 600 && !g.over; i++) {
      g.update(0.1);
      if (!g.over) pilot.update(0.1 * g.speed);
      if (i % 1200 === 0) log.push(`${Math.round(g.time)}s ${ctx.Campaign.goalLines(g).map((l) => l.text).join(' | ')} core${Math.round(g.players[0].core.hp)}`);
    }
    const st = ctx.Campaign.stars(g);
    res.push({ id, seed: rs, result: g.result, time: Math.round(g.time), stars: st.filter((s) => s.ok).length, why: st.filter((s) => !s.ok).map((s) => s.text + ': ' + s.why).join(' / '),
      lost: g.players[0].stats.lost, lostBld: g.camp.lostBld, minCore: g.camp.minCore.toFixed(2), ms: Date.now() - t0 });
    if (process.env.LOG) console.log(log.join('\n'));
  }
}
console.log(JSON.stringify(res, null, 1));
