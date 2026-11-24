// D02: cada misión arranca con su mapa, rivales y preparación.
const ctx = require('./sim.cjs');
const out = [];
for (const m of ctx.CAMPAIGN) {
  const g = new ctx.Game(ctx.Campaign.opts(m.id));
  const cnt = (pid) => { const o = {}; g.buildings.filter((b) => b.owner === pid).forEach((b) => { const k = b.type + (b.level > 1 ? 'L' + b.level : ''); o[k] = (o[k] || 0) + 1; }); return o; };
  const ucnt = (pid) => { const o = {}; g.units.filter((u) => u.owner === pid).forEach((u) => { o[u.type] = (o[u.type] || 0) + 1; }); return o; };
  out.push({ id: m.id, map: g.map.kind, players: g.players.length, personas: g.players.map((p) => p.persona || 'tú').join(','),
    coins: Math.round(g.players[0].coins), passive: g.bots.map((b) => !!b.passive).join(','), nextWave: g.bots.map((b) => Math.round(b.nextWaveAt)).join(','),
    me: cnt(0), meU: ucnt(0), bot1: cnt(1), bot1U: ucnt(1), flags: g.points.filter((p) => p.type === 'flag').map((p) => g.cells[p.cell].comp !== g.camp.homeComp).filter(Boolean).length });
}
console.log(JSON.stringify(out, null, 1));
