// Pruebas de lógica de la v1.4: K01-K05, reglas del desafío (K08) y estrellas de los bots (K11).
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, UNITS, BUILDINGS } = ctx;
const TERRAIN = V('TERRAIN');
const VET = V('VETERAN');
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const quiet = (seed, mode = 'duel', map = 'continent') => { seedRandom(seed); const g = new Game({ mode, mapKind: map, difficulty: 'normal', seed, fog: false }); g.bots = []; return g; };
const landNear = (g, ci, dmin, dmax) => g.cells.filter((c) => g.passable(c, 'land', 0) && !c.bld && g.map.dist(c, g.cells[ci]) >= dmin && g.map.dist(c, g.cells[ci]) <= dmax && c.comp === g.cells[ci].comp);

// ---------- K01 Patrullar ----------
{
  const g = quiet(101);
  const core = g.players[0].core.cell;
  const start = g.freeCellsNear(core, 'land', 0, 4);
  const us = start.slice(0, 3).map((ci) => g.addUnit(0, 'rifle', ci));
  const far = landNear(g, core, 7, 8)[0];
  const n = g.orderPatrol(us, far.i);
  let laps = 0;
  const pos = [];
  for (let i = 0; i < 1200; i++) {
    g.update(0.1);
    if (i % 50 === 0) pos.push(g.map.dist(g.cells[us[0].cell], far));
  }
  laps = us[0].patrol ? us[0].patrol.laps : 0;
  // Un enemigo aparece cerca del camino: pelean y luego siguen patrullando.
  const mid = landNear(g, far.i, 2, 3)[0];
  const foe = g.addUnit(1, 'rifle', mid.i);
  let fought = false;
  for (let i = 0; i < 600; i++) { g.update(0.1); if (us.some((u) => u.state === 'attack')) fought = true; if (!foe.alive) break; }
  for (let i = 0; i < 200; i++) g.update(0.1);
  const back = us.filter((u) => u.alive).every((u) => u.state === 'patrol' || u.state === 'attack');
  const ok = n === 3 && laps >= 3 && Math.max(...pos) >= 6 && Math.min(...pos) <= 1 && fought && !foe.alive && back;
  check('K01', 'Patrullar: van y vuelven y pelean en el camino', ok,
    `3 Artilleros patrullan entre su lugar y un punto a 7-8 casillas: en 2 min hicieron ${laps} tramos (distancia al punto entre ${Math.min(...pos)} y ${Math.max(...pos)} casillas); ` +
    `un Artillero enemigo cerca del camino: lo atacaron (${fought}) y lo eliminaron (${!foe.alive}); después siguen patrullando (${back})`);
}

// ---------- K02 Mantener posición ----------
{
  const run = (hold) => {
    const g = quiet(102);
    const core = g.players[0].core.cell;
    const c0 = landNear(g, core, 3, 3)[0];
    const u = g.addUnit(0, 'rifle', c0.i);
    if (hold) g.setHold([u], true);
    const w = UNITS.rifle.weapon;
    // Enemigo a 5 casillas: fuera de tiro (3) pero dentro de lo que un Artillero sale a buscar.
    const cf = landNear(g, c0.i, 5, 5).find((c) => g.map.dist(c, g.cells[core]) > 3);
    const foe = g.addUnit(1, 'rifle', cf.i);
    foe.def = { ...foe.def, weapon: null };
    for (let i = 0; i < 100; i++) g.update(0.1);
    const moved = g.map.dist(g.cells[u.cell], c0);
    const hp1 = foe.hp;
    // Ahora un enemigo a tiro.
    const cn = landNear(g, u.cell, 2, 2)[0];
    const foe2 = g.addUnit(1, 'rifle', cn.i);
    foe2.def = { ...foe2.def, weapon: null };
    const h0 = foe2.hp;
    for (let i = 0; i < 60; i++) g.update(0.1);
    return { moved, chased: hp1 < foe.maxHp || moved > 0, shot: foe2.hp < h0 || !foe2.alive, stayed: g.map.dist(g.cells[u.cell], c0) };
  };
  const h = run(true);
  const f = run(false);
  const ok = h.moved === 0 && h.stayed === 0 && h.shot && f.moved > 0;
  check('K02', 'Mantener posición: no persiguen, pero disparan a lo que tienen a tiro', ok,
    `con «Mantener posición»: ante un enemigo a 5 casillas se movió ${h.moved} casillas; a uno a 2 casillas le disparó (${h.shot}) sin moverse (${h.stayed} casillas). Sin la orden, la misma tropa salió a perseguir (${f.moved} casillas)`);
}

// ---------- K03 Veteranas ----------
{
  const g = quiet(103);
  const core = g.players[0].core.cell;
  const c0 = landNear(g, core, 3, 3)[0];
  const u = g.addUnit(0, 'rifle', c0.i);
  const base = u.maxHp;
  const at = {};
  let killed = 0;
  while (killed < 15) {
    const cn = landNear(g, u.cell, 1, 2).find((c) => !g.units.some((x) => x.alive && x.cell === c.i));
    const foe = g.addUnit(1, 'rifle', cn.i);
    foe.hp = 1;
    g.damage(foe, 5, 0, u);
    if (!foe.alive) killed++;
    if (killed === 3 || killed === 8 || killed === 15) at[killed] = { vet: u.vet || 0, ratio: +(u.maxHp / base).toFixed(3) };
  }
  // Daño de un disparo: tropa normal contra veterana de 3 estrellas.
  const t1 = g.addUnit(1, 'tank', landNear(g, u.cell, 2, 3)[0].i);
  const h1 = t1.hp + (t1.shield || 0);
  g.fire(u, UNITS.rifle.weapon, t1);
  const dVet = h1 - (t1.hp + (t1.shield || 0));
  const plain = g.addUnit(0, 'rifle', landNear(g, u.cell, 1, 2).find((c) => !g.units.some((x) => x.alive && x.cell === c.i)).i);
  const h2 = t1.hp + (t1.shield || 0);
  g.fire(plain, UNITS.rifle.weapon, t1);
  const dPlain = h2 - (t1.hp + (t1.shield || 0));
  const ratio = dVet / dPlain;
  const ok = at[3].vet === 1 && at[8].vet === 2 && at[15].vet === 3 && Math.abs(at[3].ratio - 1.1) < 0.01 && Math.abs(at[8].ratio - 1.2) < 0.01 && Math.abs(at[15].ratio - 1.3) < 0.01 &&
    Math.abs(ratio - (1 + 3 * VET.dmg)) < 0.01;
  check('K03', 'Veteranas: estrellas con 3, 8 y 15 eliminaciones', ok,
    `con 3 eliminaciones: ${at[3].vet} estrella (vida máxima ×${at[3].ratio}); con 8: ${at[8].vet} (×${at[8].ratio}); con 15: ${at[15].vet} (×${at[15].ratio}); ` +
    `un disparo de la veterana de 3 estrellas quita ${dVet.toFixed(1)} y el de una tropa nueva ${dPlain.toFixed(1)} (×${ratio.toFixed(2)})`);
}

// ---------- K04 Reparación sola ----------
{
  const run = (on) => {
    const g = quiet(104, 'conquest');
    const p = g.players[0];
    p.autoRepair = on;
    const core = p.core.cell;
    const b = g.addBuilding(0, 'solar', landNear(g, core, 3, 4).find((c) => !g.placeInvalid(0, 'solar', c.i, true)).i, true);
    b.hp = b.maxHp * 0.4;
    b.lastHit = -99;
    const builder = g.units.find((u) => u.owner === 0 && u.def.builds);
    builder.state = 'idle';
    const d0 = g.map.dist(g.cells[builder.cell], g.cells[b.cell]);
    let tFull = -1;
    for (let i = 0; i < 900; i++) { g.update(0.1); if (tFull < 0 && b.hp >= b.maxHp) tFull = g.time; }
    return { d0, pct: Math.round((b.hp / b.maxHp) * 100), tFull };
  };
  const on = run(true);
  const off = run(false);
  const ok = on.pct === 100 && off.pct < 50 && on.d0 >= 2;
  check('K04', 'Reparación sola: el Constructor libre repara lo dañado cerca', ok,
    `Solar al 40 % a ${on.d0} casillas del Constructor sin trabajo: con «Reparación sola» quedó al ${on.pct} %${on.tFull > 0 ? ` (a los ${on.tFull.toFixed(0)} s)` : ''}; apagada, quedó al ${off.pct} %`);
}

// ---------- K05 Producción continua ----------
{
  const g = quiet(105, 'conquest');
  const p = g.players[0];
  const core = p.core.cell;
  const bar = g.addBuilding(0, 'barracks', landNear(g, core, 2, 4).find((c) => !g.placeInvalid(0, 'barracks', c.i, true)).i, true);
  p.coins = 1000;
  g.enqueue(bar, 'rifle');
  bar.loop = true;
  const n0 = g.units.filter((u) => u.owner === 0 && u.type === 'rifle').length;
  let minCoins = Infinity;
  for (let i = 0; i < 400; i++) { g.update(0.1); p.coins = Math.min(p.coins, 1e9); minCoins = Math.min(minCoins, p.coins); p.income = 0; }
  const n1 = g.units.filter((u) => u.owner === 0 && u.type === 'rifle').length;
  const wait1 = bar.loopWait;
  // Con dinero de nuevo, sigue.
  p.coins += 2000;
  for (let i = 0; i < 200; i++) g.update(0.1);
  const n2 = g.units.filter((u) => u.owner === 0 && u.type === 'rifle').length;
  // Comunidad llena: espera sin gastar.
  g.refreshEconomy();
  p.coins = 50000;
  const cap = p.popCap;
  while (p.popUsed < p.popCap) { const ci = g.freeCellsNear(core, 'land', 0, 1)[0]; g.addUnit(0, 'rifle', ci); g.refreshEconomy(); }
  const coinsBefore = p.coins;
  for (let i = 0; i < 100; i++) g.update(0.1);
  const wait2 = bar.loopWait;
  const spent = coinsBefore - p.coins;
  const ok = n1 > n0 && /Monedas insuficientes/.test(wait1 || '') && minCoins >= 0 && n2 > n1 && /Población llena/.test(wait2 || '') && spent <= 0;
  check('K05', 'Producción continua: sigue entrenando y espera sin gastar', ok,
    `con 1.000 monedas y «Siempre»: entrenó ${n1 - n0} Artilleros más y se quedó esperando («${wait1}»), nunca con monedas negativas (mínimo ${Math.floor(minCoins)}); ` +
    `con 2.000 monedas más siguió (${n2 - n1} más); con la comunidad llena (${cap}) espera («${wait2}») y no gasta (${Math.max(0, spent)} monedas)`);
}

// ---------- K08 reglas del desafío ----------
{
  const g = new Game({ mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 108, rule: 'nofactory', startCoins: 800 });
  const g2 = new Game({ mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 109, rule: 'noair' });
  const land = (gg) => gg.cells.find((c) => TERRAIN[c.t].land && !c.bld && c.owner === 0) || gg.cells[gg.players[0].core.cell];
  const e1 = g.placeInvalid(0, 'factory', land(g).i, true);
  const e2 = g2.placeInvalid(0, 'helipad', land(g2).i, true);
  const e3 = g2.placeInvalid(0, 'airport', land(g2).i, true);
  const botOk = !/Desafío/.test(g.placeInvalid(1, 'factory', g.cells[g.players[1].core.cell].i, true) || '');
  const ok = /sin Fábrica/.test(e1) && /sin Helipuerto/.test(e2) && /sin Helipuerto/.test(e3) && g.players[0].coins === 800 && g.players[1].coins !== 800 && botOk;
  check('K08sim', 'Reglas del desafío', ok, `«Sin fábricas»: «${e1}»; «Cielo cerrado»: Helipuerto «${e2}», Aeropuerto «${e3}»; «Bolsillos vacíos»: empiezas con ${g.players[0].coins} monedas y los bots con ${g.players[1].coins}; la regla no frena a los bots (${botOk})`);
}

// ---------- K11 estrellas en partidas de bots ----------
{
  let vets = 0, v3 = 0, units = 0;
  for (const [mode, map, seed] of [['ffa', 'archipelago', 111], ['league', 'continent', 112], ['conquest', 'reef', 113]]) {
    seedRandom(seed);
    const g = new Game({ mode, mapKind: map, difficulty: 'normal', seed });
    for (let i = 0; i < 600 * 15; i++) g.update(0.1);
    for (const u of g.units) { if (!u.alive || !u.def.weapon) continue; units++; if (u.vet) vets++; if (u.vet >= 3) v3++; }
  }
  check('K11vet', 'Los bots también tienen veteranas', vets > 0, `3 partidas de 15 min: ${vets} de ${units} tropas vivas con estrellas (${v3} con 3)`);
}

fs.writeFileSync(__dirname + '/results-v14-sim.json', JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
