// B23 (mapas) y B24 (bots en los 5 mapas) del PRD v0.5.
const ctx = require('./sim.cjs');
const { TERRAIN, BUILDINGS } = ctx;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
// ---------- B23 ----------
{
  const per = {};
  let total = 0; let good = 0; const bad = [];
  for (const kind of ['archipelago', 'open', 'continent', 'bay', 'reef']) for (const n of [2, 4, 6]) for (const seed of [1, 2, 3, 4, 5]) {
    total++;
    const g = new ctx.Game({ mode: n === 2 ? 'duel' : n === 4 ? 'ffa' : 'conquest', mapKind: kind, difficulty: 'normal', seed: seed * 101 });
    const m = g.map;
    const homes = m.homes.map((hi) => m.cells[hi]);
    const landOk = homes.every((h) => TERRAIN[h.t].land && h.t !== 'mount');
    // Agua conectada entre las costas de las bases (para llegar en barco).
    const water = (c) => TERRAIN[c.t].water;
    const seen = new Int32Array(m.cells.length).fill(-1);
    let comp = 0;
    for (const c of m.cells) {
      if (!water(c) || seen[c.i] >= 0) continue;
      const st = [c.i]; seen[c.i] = comp;
      while (st.length) { const x = m.cells[st.pop()]; for (const ni of x.nb) if (seen[ni] < 0 && water(m.cells[ni])) { seen[ni] = comp; st.push(ni); } }
      comp++;
    }
    const coastComps = homes.map((h) => {
      const s = new Set();
      for (const c of m.cells) if (water(c) && m.dist(c, h) <= 6 && seen[c.i] >= 0) s.add(seen[c.i]);
      return s;
    });
    // Cada par de bases: mismo componente de tierra, o comparten un mar.
    let pairsOk = true;
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) {
      const land = homes[i].comp === homes[j].comp;
      const sea = [...coastComps[i]].some((k) => coastComps[j].has(k));
      if (!land && !sea) pairsOk = false;
    }
    const resources = homes.every((h) => m.cells.filter((c) => c.t === 'fertile' && m.dist(c, h) <= 4).length >= 4);
    const ok = landOk && pairsOk && resources && m.points.length >= 1;
    if (ok) good++; else bad.push(`${kind}/${n}/${seed}`);
    per[kind] = per[kind] || { maps: 0, landPairs: 0, pairs: 0 };
    per[kind].maps++;
  }
  check('B23', 'los mapas (incluidos Bahía Gris y Arrecife Doble) generan islas válidas con camino por tierra o por mar', good === total,
    `${good}/${total} mapas válidos (5 tipos × 2, 4 y 6 jugadores × 5 semillas)${bad.length ? '; fallan ' + bad.join(', ') : ''}`);
}
// ---------- B24 ----------
{
  const rows = [];
  let errors = 0;
  for (const mapKind of ['archipelago', 'open', 'continent', 'bay', 'reef']) {
    for (const seed of [11, 22]) {
      let a = seed * 2654435761 >>> 0;
      ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const g = new ctx.Game({ mode: 'ffa', mapKind, difficulty: 'normal', fog: false, turbo: false, seed });
      const builders = {}; const energy = {}; const upgrades = {};
      const os = g.spawnFrom.bind(g);
      g.spawnFrom = (b, type) => { if (b.owner !== 0 && ctx.UNITS[type].builds) builders[b.owner] = (builders[b.owner] || 0) + 1; return os(b, type); };
      // El jugador humano no hace nada: su Núcleo aguanta para que los bots jueguen 15 min entre ellos.
      g.players[0].core.maxHp = g.players[0].core.hp = 1e9;
      let err = null;
      const t0 = Date.now();
      try {
        for (let i = 0; i < 9000 && !g.over; i++) {
          g.update(0.1);
          if (i % 50 === 0) for (const ev of g.events) if (ev.type === 'built' && ev.b.owner !== 0) {
            if (ev.upgraded) upgrades[ev.b.owner] = (upgrades[ev.b.owner] || 0) + 1;
            else if (BUILDINGS[ev.b.type].cat === 'energy') energy[ev.b.owner] = (energy[ev.b.owner] || 0) + 1;
          }
          if (i % 50 === 0) g.events.length = 0;
        }
      } catch (e) { err = e.message; errors++; }
      const bots = g.bots.map((b) => ({ pid: b.pid, builders: builders[b.pid] || 0, energy: energy[b.pid] || 0, ups: g.players[b.pid].stats.upgrades, waves: b.wavesSent || 0, raids: b.coreRaids || 0, ferry: b.ferryTrips || 0, coreLv: g.players[b.pid].core.level }));
      rows.push({ mapKind, seed, err, time: Math.round(g.time), ms: Date.now() - t0, bots });
    }
  }
  const allBots = rows.flatMap((r) => r.bots);
  const pct = (f) => Math.round((allBots.filter(f).length / allBots.length) * 100);
  const byMap = {};
  for (const r of rows) {
    const k = r.mapKind; byMap[k] = byMap[k] || { waves: 0, raids: 0, ups: 0, energy: 0, builders: 0 };
    for (const b of r.bots) { byMap[k].waves += b.waves; byMap[k].raids += b.raids; byMap[k].ups += b.ups; byMap[k].energy += b.energy; byMap[k].builders += b.builders; }
  }
  const mapsOk = Object.values(byMap).every((m) => m.waves + m.raids > 0 && m.ups > 0 && m.energy > 0 && m.builders > 0);
  check('B24', 'los bots entrenan constructores, mejoran edificios, construyen energías y atacan en los 5 mapas, sin errores',
    errors === 0 && mapsOk && pct((b) => b.builders >= 2) >= 90,
    `${rows.length} partidas de 15 min, ${allBots.length} bots; con 2+ constructores ${pct((b) => b.builders >= 2)} %, con mejoras ${pct((b) => b.ups > 0)} %, con energía ${pct((b) => b.energy > 0)} %, que atacaron un Núcleo (oleada o desembarco) ${pct((b) => b.waves + b.raids > 0)} %; Núcleo nivel 2+ ${pct((b) => b.coreLv >= 2)} %; por mapa ${JSON.stringify(byMap)}; errores ${errors}`);
  for (const r of rows) console.log('  ', r.mapKind, r.seed, r.err || '', r.time + 's', r.ms + 'ms', JSON.stringify(r.bots));
}
require('fs').writeFileSync(__dirname + '/results-v05-maps-bots.json', JSON.stringify(results, null, 1));
