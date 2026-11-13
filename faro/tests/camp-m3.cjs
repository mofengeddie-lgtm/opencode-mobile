// Misión 3 con órdenes automáticas como las de un jugador: tropas al Faro, Cuartel, Granjas y refuerzos.
const ctx = require('./sim.cjs');
const seeds = (process.argv[2] || '1').split(',').map(Number);
const res = [];
for (const rs of seeds) {
  let a = (rs * 2654435761) >>> 0;
  ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = new ctx.Game(ctx.Campaign.opts(3));
  const me = g.players[0];
  const faro = g.points.find((p) => p.type === 'faro');
  const builder = g.units.find((u) => u.owner === 0 && u.type === 'builder');
  const army = () => g.units.filter((u) => u.owner === 0 && u.alive && u.def.weapon);
  let bar = null; let wait = 0; const log = [];
  for (let i = 0; i < 20 * 600 && !g.over; i++) {
    g.update(0.1);
    wait -= 0.1; if (wait > 0) continue; wait = 2;
    const core = g.cells[me.core.cell];
    if (!bar) {
      const spot = g.cells.filter((c) => !g.placeInvalid(0, 'barracks', c.i)).sort((x, y) => g.map.dist(x, core) - g.map.dist(y, core))[0];
      if (spot) { g.place(0, 'barracks', spot.i); bar = spot.bld; log.push(`${Math.round(g.time)}s Cuartel`); }
    } else if (bar.built && bar.alive) {
      if (bar.queue.length < 2) g.enqueue(bar, army().length % 3 ? 'rifle' : 'shotgun');
    }
    if (me.coins > 700) { const f = g.cells.find((c) => !g.placeInvalid(0, 'farm', c.i)); if (f) g.place(0, 'farm', f.i); }
    // Como un jugador: junta un grupo en casa y avanza atacando con todos juntos; luego refuerza de a 4.
    const all = army();
    const atHome = all.filter((u) => u.state === 'idle' && g.map.dist(g.cells[u.cell], core) <= 5);
    const out = all.length - atHome.length;
    const need = out >= 3 ? 4 : Number(process.env.GROUP || 8);
    if (atHome.length >= need) { g.orderMove(atHome, faro.cell, true, 'line'); log.push(`${Math.round(g.time)}s salen ${atHome.length}`); }
    const lost = all.filter((u) => u.state === 'idle' && g.map.dist(g.cells[u.cell], core) > 5 && g.map.dist(g.cells[u.cell], g.cells[faro.cell]) > 1);
    if (lost.length) g.orderMove(lost, faro.cell, true);
    if (bar && bar.built && me.coins > 1800 && g.count(0, 'turret') < 1) { const tc = g.cells.filter((c) => !g.placeInvalid(0, 'turret', c.i) && g.map.dist(c, core) === 2)[0]; if (tc) g.place(0, 'turret', tc.i); }
  }
  const st = ctx.Campaign.stars(g);
  res.push({ log: log.slice(0, 6).join('; '), seed: rs, result: g.result, time: Math.round(g.time), hold: Math.round(g.camp.faroHold), stars: st.filter((s) => s.ok).length, why: st.filter((s) => !s.ok).map((s) => s.text + ': ' + s.why).join(' / '), lost: me.stats.lost });
}
console.log(JSON.stringify(res, null, 1));
