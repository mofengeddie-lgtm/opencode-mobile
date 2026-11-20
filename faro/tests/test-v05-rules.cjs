// Pruebas de reglas del PRD v0.5 (B01-B12, B22) con la lógica del juego en Node.
const ctx = require('./sim.cjs');
const { BUILDINGS, UNITS, TERRAIN } = ctx;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
function seedRandom(seed) {
  let a = (seed * 2654435761) >>> 0;
  ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const newGame = (o) => { const g = new ctx.Game({ fog: false, turbo: false, difficulty: 'normal', mode: 'duel', mapKind: 'archipelago', ...o }); g.bots.forEach((b) => { b.update = () => {}; b.think = () => {}; }); return g; };
// v0.6: cada imperio empieza con 1 Constructor; las pruebas «sin constructor» lo quitan primero.
const noBuilders = (g) => g.units.filter((u) => u.def.builds).forEach((u) => g.kill(u, -1));
const run = (g, s) => { for (let i = 0; i < s * 10 && !g.over; i++) g.update(0.1); };
const near = (g, ci, pid, n, mover = 'land') => g.freeCellsNear(ci, mover, pid, n);
const freeFor = (g, pid, type, pred = () => true) => g.cells.find((c) => !g.placeInvalid(pid, type, c.i, true) && pred(c));

seedRandom(1);
// ---------- B01 ----------
{
  const res = [];
  for (const mode of ['duel', 'ffa', 'conquest', 'teams']) {
    const g = newGame({ mode, seed: 11 });
    for (const p of g.players) {
      const mine = g.buildings.filter((b) => b.owner === p.id).map((b) => b.type).sort().join(',');
      res.push({ ok: mine === 'core,farm' && g.units.filter((u) => u.owner === p.id).map((u) => u.type).join() === 'builder' && p.coins === 2000 && p.energy === 60 && p.popCap === 20, mine, coins: p.coins, e: p.energy, pop: p.popCap });
    }
  }
  const g = newGame({ seed: 11 });
  const me = g.players[0];
  const prod = BUILDINGS.core.produces.join();
  const err = g.enqueue(me.core, 'builder');
  run(g, 6);
  const nb = g.units.filter((u) => u.owner === 0 && u.type === 'builder').length - 1;
  check('B01', 'inicio: Núcleo + 1 Granja, 2.000 monedas, 60 de energía, 20 de población y (v0.6) 1 Constructor; el Núcleo entrena Constructores',
    res.every((r) => r.ok) && prod === 'builder' && err === null && nb === 1, `${res.length} jugadores en 4 modos ok=${res.filter((r) => r.ok).length}; Núcleo produce [${prod}]; Constructor entrenado: ${nb}`);
}
// ---------- B02 ----------
{
  const g = newGame({ seed: 12 });
  noBuilders(g);
  const me = g.players[0]; me.coins = 1e5;
  const core = g.cells[me.core.cell];
  const c = freeFor(g, 0, 'barracks', (x) => g.map.dist(x, core) === 2);
  g.place(0, 'barracks', c.i);
  const b = g.buildings.find((x) => x.type === 'barracks' && x.owner === 0);
  run(g, 20);
  const alerts = g.chat.concat(g.events).map((e) => e.text || (e.msg && e.msg.text) || '').join(' | ');
  const noBuilder = { built: b.built, progress: b.progress, warned: /Obra en espera: necesitas un Constructor/.test(JSON.stringify(g.events)) || /Obra en espera/.test(alerts) };
  // Con Constructor: avanza
  const cells = near(g, c.i, 0, 6).filter((ci) => g.map.dist(g.cells[ci], c) === 1);
  const bu = g.addUnit(0, 'builder', cells[0]);
  run(g, 1.5);
  const st = bu.state;
  const p0 = b.progress;
  run(g, 4);
  const rateB = (b.progress - p0) / 4;
  // Ingeniero en otra obra igual
  const c2 = freeFor(g, 0, 'barracks', (x) => g.map.dist(x, core) >= 2 && g.map.dist(x, c) >= 3);
  g.place(0, 'barracks', c2.i);
  const b2 = g.buildings.find((x) => x.type === 'barracks' && x.cell === c2.i);
  const en = g.addUnit(0, 'engineer', near(g, c2.i, 0, 6).find((ci) => g.map.dist(g.cells[ci], c2) === 1));
  g.orderBuild([en], b2);
  // Espera a que el Ingeniero esté trabajando y mide 2 s.
  let guard = 0;
  while (b2.progress === 0 && guard++ < 100) run(g, 0.1);
  run(g, 0.5);
  const q0 = b2.progress;
  run(g, 2);
  const rateE = (b2.progress - q0) / 2;
  run(g, 40);
  check('B02', 'obra «En construcción» solo avanza con constructor; el Ingeniero va el doble; aviso sin constructor',
    !noBuilder.built && noBuilder.progress === 0 && st === 'build' && rateB > 0 && Math.abs(rateE / rateB - 2) < 0.15 && b.built,
    `sin constructor 20 s: progreso ${noBuilder.progress}; Constructor ${(rateB * 100).toFixed(1)} %/s, Ingeniero ${(rateE * 100).toFixed(1)} %/s (×${(rateE / rateB).toFixed(2)}); terminado: ${b.built}`);
  // Aviso
  const g2 = newGame({ seed: 13 });
  noBuilders(g2);
  g2.players[0].coins = 1e5;
  const cc = freeFor(g2, 0, 'solar');
  g2.place(0, 'solar', cc.i);
  const ev = g2.events.filter((e) => e.type === 'toast' || e.type === 'alert').map((e) => e.text).join(' | ');
  check('B02', 'aviso cuando no hay constructor', /necesitas un Constructor/.test(ev), ev.slice(0, 120));
  // Barco constructor en el mar
  const g3 = newGame({ seed: 14 });
  g3.players[0].coins = 1e5;
  const oil = freeFor(g3, 0, 'rig', (x) => x.t === 'oil');
  const errRig = g3.place(0, 'rig', oil.i);
  const rig = g3.buildings.find((x) => x.type === 'rig');
  const landB = g3.addUnit(0, 'builder', near(g3, g3.players[0].core.cell, 0, 3)[0]);
  run(g3, 5);
  const byLand = rig ? rig.progress : -1;
  const sea = near(g3, oil.i, 0, 8, 'sea').find((ci) => g3.map.dist(g3.cells[ci], oil) <= 2) ?? near(g3, oil.i, 0, 8, 'sea')[0];
  const be = g3.addUnit(0, 'boatEng', sea);
  g3.orderBuild([be], rig);
  run(g3, 60);
  check('B02', 'el Barco constructor levanta la Plataforma; el Constructor de tierra no', errRig === null && byLand === 0 && rig.built && landB.state !== 'build',
    `colocar: ${errRig}; con Constructor de tierra: ${byLand}; con Barco constructor: ${rig.built ? 'terminada' : Math.round(rig.progress * 100) + ' %'}`);
}
// ---------- B03 ----------
{
  const g = newGame({ seed: 15, mapKind: 'continent' });
  const me = g.players[0];
  const rows = [];
  for (const [type, d] of Object.entries(BUILDINGS)) {
    if (type === 'core' || type === 'wall' && false) continue;
    me.coins = 1e6; me.energy = 1e5;
    const c = freeFor(g, 0, type, (x) => !g.cells[x.i].bld);
    if (!c) { rows.push(`${type}: sin casilla`); continue; }
    const b = g.addBuilding(0, type, c.i, true);
    const hp1 = b.maxHp; const inc1 = g.bIncome(b); const en1 = g.bEnergy(b);
    const levels = [];
    let costs = [];
    while (b.level < d.maxLevel) {
      const cost = g.upgradeCost(b);
      const coins0 = me.coins;
      const r = g.upgrade(b);
      if (typeof r === 'string') { levels.push(r); break; }
      costs.push(Math.round(coins0 - me.coins) === cost);
      // trabajo de constructor hasta terminar
      let guard = 0;
      while (b.upgrading && guard++ < 2000) { b.workAcc += 0.1 * (d.builtBy === 'sea' ? 1 : 1); g.updateBuilding(b, 0.1); }
      levels.push(b.level);
    }
    const ok = b.level === d.maxLevel && costs.every(Boolean) && (d.maxLevel === 1 || b.maxHp > hp1);
    rows.push({ type, ok, max: d.maxLevel, levels: levels.join('>'), hp: `${hp1}>${b.maxHp}`, inc: `${inc1}>${g.bIncome(b)}`, en: `${en1}>${g.bEnergy(b)}` });
    b.alive = false; g.cells[c.i].bld = null;
  }
  const bad = rows.filter((r) => typeof r === 'string' || !r.ok);
  const farm = rows.find((r) => r.type === 'farm');
  const house = rows.find((r) => r.type === 'house');
  check('B03', 'todos los edificios suben a su nivel máximo (3; Casa 4) cobrando el precio, con más vida y producción',
    bad.length === 0 && farm.max === 3 && house.max === 4, `${rows.length} edificios; Granja ingreso ${farm.inc}, vida ${farm.hp}; Casa ${house.levels}; fallan: ${JSON.stringify(bad)}`);
  // La mejora necesita constructor
  const g2 = newGame({ seed: 16 });
  noBuilders(g2);
  g2.players[0].coins = 1e5;
  const farmB = g2.buildings.find((b) => b.owner === 0 && b.type === 'farm');
  g2.upgrade(farmB);
  run(g2, 20);
  const waiting = farmB.upgrading && farmB.upgrading.progress === 0 && farmB.level === 1;
  const bu = g2.addUnit(0, 'builder', near(g2, farmB.cell, 0, 3)[0]);
  run(g2, 30);
  check('B03', 'la mejora la hace un constructor y mientras tanto el edificio sigue funcionando', waiting && farmB.level === 2,
    `sin constructor 20 s: esperando=${waiting}; con Constructor: nivel ${farmB.level}`);
}
// ---------- B04 ----------
{
  const g = newGame({ seed: 17 });
  const me = g.players[0]; const core = me.core;
  const w = [1, 2, 3].map((lv) => { core.level = lv; core._wLv = 0; const x = g.weaponOf(core); return { lv, dmg: x.dmg, range: x.range, beams: x.beams || 1 }; });
  core.level = 1; core._wLv = 0;
  const domeL1 = g.domeInvalid(0);
  core.level = 2; core._wLv = 0;
  const domeL2 = g.domeInvalid(0);
  core.level = 3; core._wLv = 0;
  me.coins = 1e5;
  const domeL3 = g.domeInvalid(0);
  // Doble láser: dos enemigos en alcance
  const foes = near(g, core.cell, 1, 6).filter((ci) => g.map.dist(g.cells[ci], g.cells[core.cell]) <= 3).slice(0, 2).map((ci) => g.addUnit(1, 'tank', ci));
  const shots = [];
  const of = g.fire.bind(g);
  g.fire = (a, wp, t, gun) => { if (a === core) shots.push(t.id); return of(a, wp, t, gun); };
  run(g, 3);
  const distinct = new Set(shots).size;
  // Láser en nivel 1 también dispara
  const g2 = newGame({ seed: 18 });
  const c2 = g2.players[0].core;
  const f2 = g2.addUnit(1, 'rifle', near(g2, c2.cell, 1, 4).find((ci) => g2.map.dist(g2.cells[ci], g2.cells[c2.cell]) <= 3));
  const hp0 = f2.hp;
  run(g2, 3);
  check('B04', 'Núcleo nivel 1-3 dispara láser en todos los niveles; doble láser en nivel 3; Cúpula solo con nivel 3',
    w[0].dmg > 0 && w[1].dmg > w[0].dmg && w[2].beams === 2 && /nivel 3/.test(domeL1) && /nivel 3/.test(domeL2) && domeL3 === null && distinct === 2 && f2.hp < hp0,
    `láser ${JSON.stringify(w)}; L1 hizo daño: ${Math.round(hp0 - f2.hp)}; nivel 3 disparó a ${distinct} enemigos distintos; Cúpula con L1: «${domeL1}», con L3: ${domeL3}`);
}
// ---------- B05 ----------
{
  const g = newGame({ seed: 19 });
  const me = g.players[0]; me.coins = 1e6; me.core.level = 3;
  const lv = [];
  for (let i = 0; i < 4; i++) { const r = g.buyDome(0); lv.push(r === null || typeof r === 'object' ? (me.dome && me.dome.level) : r); }
  const hpByLv = ctx.DOME_LEVELS.slice(1).map((L) => L.hp);
  const u = g.addUnit(0, 'rifle', near(g, me.core.cell, 0, 3)[0]);
  run(g, 0.5);
  const sh0 = u.shield;
  const hp0 = u.hp;
  g.damage(u, 20, 1, { kind: 'unit', type: 'rifle', cls: 'inf', owner: 1 });
  const afterHit = { shield: u.shield, hp: u.hp };
  run(g, 4);
  const notYet = u.shield;
  run(g, 15);
  check('B05', 'Cúpula niveles 1-3; en nivel 3 las tropas llevan escudo que absorbe daño y se recarga tras 5 s',
    lv.slice(0, 3).join() === '1,2,3' && typeof lv[3] === 'string' && sh0 > 0 && afterHit.hp === hp0 && afterHit.shield < sh0 && notYet <= afterHit.shield + 1e-6 && u.shield >= sh0 - 1e-6,
    `niveles ${lv.join(' > ')}; vida de la Cúpula ${hpByLv.join('/')}; escudo ${sh0} → tras 20 de daño ${afterHit.shield} (vida intacta ${afterHit.hp}/${hp0}) → a los 4 s ${notYet} → recargado ${u.shield}`);
}
// ---------- B06 ----------
{
  const per = [];
  for (const lv of [1, 2, 3]) {
    const g = newGame({ seed: 20 });
    const me = g.players[0];
    const c = freeFor(g, 0, 'turret', (x) => g.map.dist(x, g.cells[me.core.cell]) >= 4);
    const t = g.addBuilding(0, 'turret', c.i, true);
    t.level = lv;
    const foe = g.addUnit(1, 'tank', near(g, c.i, 1, 6).find((ci) => g.map.dist(g.cells[ci], c) === 2));
    foe.hp = foe.maxHp = 1e7;
    foe.speed = 0; foe.def = { ...foe.def, speed: 0, weapon: null };
    let n = 0; const guns = new Set();
    const of = g.fire.bind(g);
    g.fire = (a, w, tt, gun) => { if (a === t) { n++; guns.add(gun || 0); } return of(a, w, tt, gun); };
    run(g, 5);
    per.push({ lv, shots: n, guns: guns.size });
  }
  check('B06', 'Torreta: nivel 2 con 1 minigun y nivel 3 con 2 (más disparos)', per[0].guns === 1 && per[1].guns === 2 && per[2].guns === 3 && per[2].shots > per[1].shots && per[1].shots > per[0].shots,
    per.map((p) => `nivel ${p.lv}: ${p.shots} disparos en 5 s con ${p.guns} armas`).join('; '));
}
// ---------- B07 ----------
{
  const rows = [];
  for (const lv of [1, 2, 3]) {
    const g = newGame({ seed: 21 });
    const me = g.players[0];
    const c = freeFor(g, 0, 'hospital', (x) => g.map.dist(x, g.cells[me.core.cell]) >= 4);
    const h = g.addBuilding(0, 'hospital', c.i, true);
    h.level = lv;
    const u = g.addUnit(0, 'rifle', near(g, c.i, 0, 4).find((ci) => g.map.dist(g.cells[ci], c) === 1));
    u.hp = u.maxHp * 0.3;
    const h0 = u.hp;
    run(g, 4);
    rows.push({ lv, healed: Math.round(((u.hp - h0) / u.maxHp) * 100), range: g.healOf(h).range });
  }
  check('B07', 'Enfermería nivel 1-3 cura más en cada nivel (clínica, mini hospital, hospital grande)', rows[1].healed > rows[0].healed && rows[2].healed > rows[1].healed,
    rows.map((r) => `nivel ${r.lv}: +${r.healed} % en 4 s, alcance ${r.range}`).join('; ') + ' · modelos hospital_1/2/3 en B13');
}
// ---------- B08 ----------
{
  const types = ['solar', 'wind', 'hydro', 'tidal', 'wave'];
  const g = newGame({ seed: 22, mapKind: 'archipelago' });
  const me = g.players[0]; me.coins = 1e6;
  const rows = [];
  for (const t of types) {
    const d = BUILDINGS[t];
    const c = freeFor(g, 0, t);
    if (!c) { rows.push(`${t}: sin lugar`); continue; }
    const b = g.addBuilding(0, t, c.i, true);
    g.refreshEconomy();
    const e0 = me.energy; run(g, 10.05); const gain = Math.round(me.energy - e0);
    rows.push({ t, name: d.name, cost: d.cost, on: d.on, gain, place: c.t, builtBy: d.builtBy || 'land' });
    b.alive = false; g.cells[c.i].bld = null; g.refreshEconomy();
  }
  const okGains = rows.every((r) => typeof r === 'object' && r.gain === BUILDINGS[r.t].energy);
  check('B08', 'cinco energías con su lugar y producción; el Molino ya no existe', okGains && !BUILDINGS.mill && !BUILDINGS.windmill,
    rows.map((r) => (typeof r === 'string' ? r : `${r.name} ${r.cost} +${r.gain}/10 s en ${r.place}`)).join('; ') + `; Molino: ${BUILDINGS.mill ? 'existe' : 'no existe'}`);
  // Lugares de energía: Hidráulica en tierra junto al agua, Mareomotriz en costa, Undimotriz en mar profundo
  const g2 = newGame({ seed: 23 });
  g2.players[0].coins = 1e6;
  const inland = g2.cells.find((x) => x.owner === 0 && TERRAIN[x.t].land && !x.bld && !x.point && x.t === 'grass' && x.nb.every((ni) => TERRAIN[g2.cells[ni].t].land));
  const deep = g2.cells.find((x) => x.t === 'deep' && x.owner !== 1);
  const shallow = g2.cells.find((x) => x.t === 'shallow' && g2.map.isCoast(x) && !x.bld && x.owner !== 1);
  check('B08', 'cada energía pide su lugar', /junto al agua/.test(g2.placeInvalid(0, 'hydro', inland.i)) && /profundo/.test(g2.placeInvalid(0, 'wave', shallow.i)) && /poco profunda/.test(g2.placeInvalid(0, 'tidal', deep.i)),
    `Hidráulica tierra adentro: «${g2.placeInvalid(0, 'hydro', inland.i)}»; Undimotriz en costa: «${g2.placeInvalid(0, 'wave', shallow.i)}»; Mareomotriz en alta mar: «${g2.placeInvalid(0, 'tidal', deep.i)}»`);
}
// ---------- B09 ----------
{
  const rows = [];
  for (const [type, d] of Object.entries(BUILDINGS)) {
    if (type === 'core') continue;
    let row = null;
    for (const mk of ['archipelago', 'open', 'continent']) {
      const g = newGame({ seed: 24, mapKind: mk });
      const me = g.players[0]; me.coins = 1e7; me.energy = 1e6;
      const valid = freeFor(g, 0, type);
      if (!valid) continue;
      const limit = g.limitFor(0, type);
      const before = g.placeInvalid(0, type, valid.i);
      // Llena hasta el límite en otras casillas libres.
      const spare = g.cells.filter((x) => !x.bld && !x.point && x.i !== valid.i);
      while (g.count(0, type) < limit) g.addBuilding(0, type, spare.shift().i, true);
      const msg = g.placeInvalid(0, type, valid.i);
      row = { type, limit, before, msg };
      break;
    }
    rows.push(row || { type, limit: 0, msg: 'sin lugar válido' });
  }
  const bad = rows.filter((r) => !r.limit || r.before !== null || !/Límite alcanzado/.test(r.msg || ''));
  check('B09', 'cada edificio tiene límite; al llegar no deja construir y lo explica', bad.length === 0,
    rows.map((r) => `${BUILDINGS[r.type].name} ${r.limit}`).join(', ') + ` · mensaje: «${rows[0].msg}»` + (bad.length ? ` · fallan: ${JSON.stringify(bad)}` : ''));
}
// ---------- B10 ----------
{
  const g = newGame({ seed: 25 });
  g.players[0].coins = 1e6;
  const own = (pred) => g.cells.find((x) => x.owner === 0 && !x.bld && !x.point && pred(x));
  const grass = own((x) => x.t === 'grass');
  const fert = own((x) => x.t === 'fertile');
  const oill = own((x) => x.t === 'oilland');
  const gold = g.cells.find((x) => x.t === 'gold' && !x.bld && x.owner === 0) || g.cells.find((x) => x.t === 'gold');
  const r = {
    farmGrass: g.placeInvalid(0, 'farm', grass.i), farmFert: g.placeInvalid(0, 'farm', fert.i),
    pumpGrass: g.placeInvalid(0, 'pump', grass.i), pumpOil: oill ? g.placeInvalid(0, 'pump', oill.i) : 'sin petróleo propio',
    mineGrass: g.placeInvalid(0, 'mine', grass.i), houseFert: g.placeInvalid(0, 'house', fert.i),
  };
  let spots = 0; let homes = 0;
  for (const seed of [1, 2, 3, 4, 5]) for (const mk of ['archipelago', 'open', 'continent', 'bay', 'reef']) {
    const gg = new ctx.Game({ mode: 'conquest', mapKind: mk, difficulty: 'normal', seed });
    for (const p of gg.players) {
      homes++;
      const hc = gg.cells[gg.map.homes[p.id]];
      const f = gg.cells.filter((x) => x.t === 'fertile' && gg.map.dist(x, hc) <= 4).length;
      const o = gg.cells.filter((x) => x.t === 'oilland' && gg.map.dist(x, hc) <= 5).length;
      const gd = gg.cells.filter((x) => x.t === 'gold').length;
      if (f >= 4 && o >= 1 && gd > 0) spots++;
    }
  }
  check('B10', 'Granja solo en tierra fértil, Bomba solo en petróleo en tierra, Mina solo en veta de oro',
    /fértil/.test(r.farmGrass) && r.farmFert === null && /petróleo/i.test(r.pumpGrass) && r.pumpOil === null && /oro/.test(r.mineGrass) && /Granjas/.test(r.houseFert) && spots === homes,
    `${JSON.stringify(r)}; lugares cerca de cada base: ${spots}/${homes} bases (25 mapas)`);
}
// ---------- B11 ----------
{
  let tried = 0; let blocked = 0; let ok = 0; let enemy = 0; let enemyTried = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const mk of ['archipelago', 'open', 'bay', 'reef']) {
    const g = newGame({ seed, mapKind: mk, mode: 'ffa' });
    g.players[0].coins = 1e6;
    for (const c of g.cells.filter((x) => x.t === 'oil')) {
      const e = g.placeInvalid(0, 'rig', c.i);
      if (c.owner === -1 || c.owner === 0) { tried++; if (e === null) ok++; if (/Fuera de tu territorio/.test(e || '')) blocked++; }
      else { enemyTried++; if (/enemigo/.test(e || '')) enemy++; }
    }
  }
  check('B11', 'la Plataforma petrolera se pone en el petróleo del mar sin «Fuera de tu territorio»', tried > 0 && blocked === 0 && ok === tried && enemy === enemyTried,
    `${ok}/${tried} manchas de petróleo libres o propias aceptadas, ${blocked} con aviso de territorio; en territorio enemigo bloqueadas ${enemy}/${enemyTried}`);
}
// ---------- B12 ----------
{
  const list = Object.entries(UNITS);
  const g = newGame({ seed: 26 });
  const me = g.players[0]; me.coins = 1e6; me.energy = 1e6;
  const c = freeFor(g, 0, 'helipad');
  const hp = g.addBuilding(0, 'helipad', c.i, true);
  g.refreshEconomy();
  const a1 = g.enqueue(hp, 'apache');
  run(g, UNITS.apache.build + 2);
  const a2 = g.enqueue(hp, 'apache');
  const ap = g.units.find((u) => u.type === 'apache');
  const producers = {};
  for (const [k, d] of Object.entries(BUILDINGS)) for (const t of d.produces || []) (producers[t] = producers[t] || []).push(k);
  const orphan = list.filter(([k]) => !producers[k]).map(([k]) => k);
  check('B12', 'las 20 unidades existen y se entrenan en algún edificio; Apache Guardián máximo 1 y ocupa 5',
    list.length === 20 && orphan.length === 0 && a1 === null && ap && /máximo|Límite|1/.test(a2 || '') && UNITS.apache.pop === 5,
    `${list.length} unidades: ${list.map(([, d]) => d.name).join(', ')}; segunda Apache: «${a2}»; población ${UNITS.apache.pop}`);
}
// ---------- B22 ----------
{
  const name = BUILDINGS.aadef.name;
  check('B22', 'la Batería antiaérea se llama AIR DEFENSE', /^air defense$/i.test(name), `nombre: ${name}`);
}
require('fs').writeFileSync(__dirname + '/results-v05-rules.json', JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.ok).length}/${results.length} aprobadas`);
