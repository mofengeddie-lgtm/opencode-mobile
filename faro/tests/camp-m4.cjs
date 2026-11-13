// Misión 4 con órdenes automáticas como las de un jugador: subir a la Barcaza, cruzar, desembarcar y capturar.
const ctx = require('./sim.cjs');
const seeds = (process.argv[2] || '1').split(',').map(Number);
const res = [];
for (const rs of seeds) {
  let a = (rs * 2654435761) >>> 0;
  ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = new ctx.Game(ctx.Campaign.opts(4));
  const barge = g.units.find((u) => u.owner === 0 && u.type === 'barge');
  const inf = () => g.units.filter((u) => u.owner === 0 && (u.type === 'rifle' || u.type === 'shotgun') && u.alive);
  let phase = 'barracks'; let flag = null; const log = []; let bar = null;
  const me = g.players[0];
  const builder = g.units.find((u) => u.owner === 0 && u.type === 'builder');
  const pickFlag = () => g.points.filter((p) => p.type === "flag" && p.owner !== 0 && g.cells[p.cell].comp !== g.camp.homeComp)
    .sort((x, y) => Math.hypot(x.x - barge.x, x.z - barge.z) - Math.hypot(y.x - barge.x, y.z - barge.z))[0];
  const shoreFor = (pt) => {
    const fc = g.cells[pt.cell]; let best = -1; let bd = 1e9;
    for (const c of g.cells) {
      if (!g.passable(c, 'sea', 0)) continue;
      if (!c.nb.some((ni) => g.cells[ni].comp === fc.comp)) continue;
      const d = g.map.dist(c, fc); if (d < bd) { bd = d; best = c.i; }
    }
    return best;
  };
  let wait = 0;
  for (let i = 0; i < 20 * 600 && !g.over; i++) {
    g.update(0.1);
    wait -= 0.1;
    if (wait > 0) continue;
    wait = 1;
    const troops = inf();
    if (!barge.alive) { log.push('barcaza perdida'); break; }
    if (phase === 'barracks') {
      const core = g.cells[me.core.cell];
      const spot = g.cells.filter((c) => !g.placeInvalid(0, 'barracks', c.i)).sort((x, y) => g.map.dist(x, core) - g.map.dist(y, core))[0];
      g.place(0, 'barracks', spot.i); bar = spot.bld; g.orderBuild([builder], bar); phase = 'train'; log.push(`${Math.round(g.time)}s Cuartel`);
    } else if (phase === 'train') {
      if (bar.built) { while (bar.queue.length < 5 && !g.enqueue(bar, troops.length % 2 ? 'shotgun' : 'rifle')); if (troops.length >= 6) { phase = 'board'; log.push(`${Math.round(g.time)}s 6 tropas`); } }
      else if (builder.state === 'idle') g.orderBuild([builder], bar);
      // Economía básica mientras tanto: Granjas en la tierra fértil.
      const farm = g.cells.find((c) => !g.placeInvalid(0, 'farm', c.i));
      if (farm && me.coins > 1300) g.place(0, 'farm', farm.i);
    } else if (phase === 'board') {
      const out = troops.filter((u) => !u.inside);
      if (!out.length) { flag = pickFlag(); if (!flag) break; g.orderMove([barge], shoreFor(flag)); phase = 'sail'; log.push(`${Math.round(g.time)}s zarpa a bandera ${flag.id}`); }
      else g.orderBoard(out.filter((u) => u.state !== 'board'), barge);
    } else if (phase === 'sail') {
      if (barge.state === 'idle') { const r = g.unload(barge); if (typeof r === 'string') { log.push(r); g.orderMove([barge], shoreFor(flag)); } else { g.orderMove(r, flag.cell, true); phase = 'capture'; log.push(`${Math.round(g.time)}s desembarca`); } }
    } else if (phase === 'capture') {
      if (flag.owner === 0) { log.push(`${Math.round(g.time)}s capturada ${flag.id}`); phase = 'board'; }
      else if (troops.every((u) => u.state === 'idle')) g.orderMove(troops, flag.cell, true);
    }
  }
  const st = ctx.Campaign.stars(g);
  res.push({ seed: rs, result: g.result, time: Math.round(g.time), flags: g.camp.flags.length, stars: st.filter((s) => s.ok).length, why: st.filter((s) => !s.ok).map((s) => s.text + ': ' + s.why).join(' / '), lost: g.players[0].stats.lost, log: log.join('; ') });
}
console.log(JSON.stringify(res, null, 1));
