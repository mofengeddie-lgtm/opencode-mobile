// Pruebas de lógica de la v1.2 (I06 mapas y ventaja de altura, I09 temporadas por fecha).
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, UNITS } = ctx;
const TERRAIN = V('TERRAIN');
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- I06 mapas nuevos ----------
{
  const rows = [];
  let ok = true;
  for (const mk of ['mesa', 'dunes']) {
    for (const [mode, seed] of [['conquest', 5], ['ffa', 7], ['duel', 9], ['duos', 11], ['league', 13]]) {
      const g = new Game({ mode, mapKind: mk, difficulty: 'normal', seed });
      const cnt = (t) => g.cells.filter((c) => c.t === t).length;
      const faroComp = g.cells[g.map.points[0].cell].comp;
      const joined = g.map.homes.every((h) => g.cells[h].comp === faroComp);
      const fertile = g.players.map((p) => g.cells.filter((c) => c.t === 'fertile' && g.map.dist(c, g.cells[p.core.cell]) <= 4).length);
      const special = mk === 'mesa' ? cnt('high') : cnt('dune');
      if (!joined || special < 15 || Math.min(...fertile) < 8) ok = false;
      rows.push(`${mk}/${mode}: ${mk === 'mesa' ? 'mesetas' : 'dunas'} ${special}, bases unidas al Faro ${joined}, fértil mín. ${Math.min(...fertile)}`);
    }
  }
  // Ventaja de altura: un Francotirador en la meseta alcanza 1 casilla más lejos a un objetivo de abajo.
  const g = new Game({ mode: 'duel', mapKind: 'mesa', difficulty: 'normal', seed: 5, fog: false });
  g.bots = [];
  const high = g.cells.filter((c) => c.t === 'high');
  let bonusOk = false; let ev = 'sin casos';
  for (const hc of high) {
    const w = UNITS.rifle.weapon;
    const low = g.cells.find((c) => TERRAIN[c.t].land && !TERRAIN[c.t].highGround && g.map.dist(c, hc) === w.range + 1 && g.passable(c, 'land', 1));
    if (!low) continue;
    const up = g.addUnit(0, 'rifle', hc.i);
    const foe = g.addUnit(1, 'rifle', low.i);
    const fromHigh = g.inRange(up, w, foe);
    const fromLow = g.inRange(foe, w, up);
    // El mismo tirador sin meseta (en una casilla baja) no llega.
    const lowCell = g.cells.find((c) => TERRAIN[c.t].land && !TERRAIN[c.t].highGround && g.map.dist(c, low) === w.range + 1 && g.passable(c, 'land', 0));
    let flat = true;
    if (lowCell) { const u2 = g.addUnit(0, 'rifle', lowCell.i); flat = g.inRange(u2, w, foe); }
    bonusOk = fromHigh && !fromLow && !flat;
    ev = `Artillero (alcance ${w.range}) en la meseta contra uno abajo a ${w.range + 1} casillas: desde arriba llega (${fromHigh}), desde abajo no (${!fromLow}), en terreno llano a la misma distancia no llega (${!flat})`;
    break;
  }
  // Los bots juegan los mapas nuevos sin errores.
  const play = [];
  for (const mk of ['mesa', 'dunes']) {
    seedRandom(7);
    const gg = new Game({ mode: 'ffa', mapKind: mk, difficulty: 'normal', seed: 17 });
    gg.players[0].core.maxHp = gg.players[0].core.hp = 1e9;
    for (let i = 0; i < 600 * 8; i++) gg.update(0.1);
    const blds = gg.buildings.filter((b) => b.owner && b.alive).length;
    const army = gg.units.filter((u) => u.owner && u.alive && u.def.weapon).length;
    if (blds < 10) ok = false;
    play.push(`${mk}: en 8 min los bots tienen ${blds} edificios y ${army} tropas`);
  }
  check('I06', 'Mapas «Mesetas de Cobre» (ventaja de altura) y «Dunas Rojas» se generan bien y se pueden jugar', ok && bonusOk,
    `${rows.join(' · ')}. ${ev}. ${play.join('; ')}`);
}

// ---------- I09 temporadas por fecha ----------
if ((() => { try { V('seasonForDate'); return false; } catch (e) { return true; } })()) {
  // v1.5: la decoración por fecha se quitó a pedido; esta prueba la reemplaza L01.
  check('I09sim', 'Temporada según la fecha', false, 'ya no existe: la v1.5 quitó las temporadas por fecha (la reemplaza L01)');
} else {
  const f = V('seasonForDate');
  const at = (m, d) => f(new Date(2026, m - 1, d));
  const cases = [[10, 14], [10, 15], [10, 31], [11, 5], [11, 6], [11, 9], [12, 9], [12, 10], [12, 25], [1, 6], [1, 7]];
  const got = cases.map(([m, d]) => `${d}/${m}: ${at(m, d) || '—'}`);
  const ok = at(10, 14) === null && at(10, 15) === 'pumpkin' && at(10, 31) === 'pumpkin' && at(11, 5) === 'pumpkin' && at(11, 6) === null && at(11, 9) === null &&
    at(12, 9) === null && at(12, 10) === 'winter' && at(12, 25) === 'winter' && at(1, 6) === 'winter' && at(1, 7) === null;
  check('I09sim', 'Temporada según la fecha', ok, got.join(', '));
}

fs.writeFileSync(__dirname + '/results-v12-sim.json', JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
