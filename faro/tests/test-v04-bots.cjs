// Pruebas de los bots del PRD v0.4 (A01, A03–A09) en Node, con azar repetible.
const ctx = require('./sim.cjs');
const TERRAIN = ctx.TERRAIN;
const results = [];
const check = (id, name, ok, extra = '') => results.push({ ok: !!ok, text: `${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${extra}` });
function seedRandom(seed) {
  let a = (seed * 2654435761) >>> 0;
  ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const newGame = (o) => new ctx.Game({ fog: false, turbo: false, difficulty: 'normal', ...o });
const run = (g, s) => { for (let i = 0; i < s * 10 && !g.over; i++) g.update(0.1); };
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// ---------- A01: personalidades ----------
{
  seedRandom(1);
  const g = newGame({ mode: 'ffa', mapKind: 'archipelago', seed: 5 });
  const names = g.bots.map((b) => b.pkey);
  check('A01', 'cada bot recibe una personalidad distinta', new Set(names).size === names.length, names.join(','));
  const first = { aggro: [], builder: [] };
  const sea = { admiral: [], other: [] };
  for (const seed of [3, 7, 13, 21, 34, 55]) {
    seedRandom(seed);
    const g2 = newGame({ mode: 'ffa', mapKind: 'archipelago', seed, personas: { 1: 'aggro', 2: 'builder', 3: 'admiral' } });
    const trainedSea = {};
    const os = g2.spawnFrom.bind(g2);
    g2.spawnFrom = (b, t) => { if (ctx.UNITS[t].weapon && ctx.UNITS[t].mover === 'sea') trainedSea[b.owner] = (trainedSea[b.owner] || 0) + 1; return os(b, t); };
    g2.players[0].core.hp = 1e9; g2.players[0].core.maxHp = 1e9;
    run(g2, 900);
    const b1 = g2.bots.find((b) => b.pid === 1);
    const b2 = g2.bots.find((b) => b.pid === 2);
    if (b1.firstWaveAt > 0) first.aggro.push(b1.firstWaveAt);
    first.builder.push(b2.firstWaveAt > 0 ? b2.firstWaveAt : 900);
    sea.admiral.push(trainedSea[3] || 0);
    sea.other.push(((trainedSea[1] || 0) + (trainedSea[2] || 0)) / 2);
  }
  check('A01', 'el Agresivo lanza su primera oleada antes que el Constructor',
    avg(first.aggro) < avg(first.builder), `Agresivo ${Math.round(avg(first.aggro))} s · Constructor ${Math.round(avg(first.builder))} s`);
  check('A01', 'el Almirante entrena más buques de guerra', avg(sea.admiral) > avg(sea.other),
    `Almirante ${avg(sea.admiral).toFixed(1)} · otros ${avg(sea.other).toFixed(1)} por partida`);
}

// ---------- A03: contrarrestos ----------
{
  seedRandom(2);
  const g = newGame({ mode: 'duel', mapKind: 'archipelago', seed: 9 });
  const bot = g.bots[0];
  const free = (t) => g.cells.find((c) => c.owner === bot.pid && !g.placeInvalid(bot.pid, t, c.i, true));
  for (const t of ['barracks', 'factory']) {
    g.players[bot.pid].coins = 1e5; g.players[bot.pid].energy = 500;
    g.place(bot.pid, t, free(t).i);
  }
  for (const b of g.buildings) { if (b.owner === bot.pid) { b.built = true; b.progress = 1; } }
  g.time = 400;
  const spawnFor = (type, n) => { const cs = g.freeCellsNear(g.map.homes[0], UNITS_MOVER(type), 0, n); return cs.map((ci) => g.addUnit(0, type, ci)); };
  function UNITS_MOVER(t) { return ctx.UNITS[t].mover; }
  const pick = (k) => {
    const producers = g.buildings.filter((b) => b.owner === bot.pid && b.built && b.def.produces);
    const units = g.units.filter((u) => u.owner === bot.pid);
    const out = [];
    for (let i = 0; i < k; i++) out.push(bot.pickUnit(producers, units).type);
    return out;
  };
  for (const u of g.units.filter((x) => x.owner === 0)) u.alive = false;
  g.units = g.units.filter((u) => u.alive);
  spawnFor('heli', 6);
  const vsAir = pick(30);
  const aaShare = vsAir.filter((t) => t === 'aa').length / vsAir.filter((t) => ['aa', 'tank', 'jeep', 'arty'].includes(t)).length;
  check('A03', 'contra 6 helicópteros elige Antiaéreos', aaShare >= 0.9 && vsAir.includes('aa'), `antiaéreos ${Math.round(aaShare * 100)} % de sus vehículos`);
  for (const u of g.units.filter((x) => x.owner === 0)) u.alive = false;
  g.units = g.units.filter((u) => u.alive);
  spawnFor('tank', 6);
  const vsTank = pick(40);
  const good = vsTank.filter((t) => t === 'rocket' || t === 'tank').length / vsTank.length;
  check('A03', 'contra 6 tanques elige Lanzacohetes o Tanques', good >= 0.6, `${Math.round(good * 100)} % (${[...new Set(vsTank)].join(', ')})`);
}

// ---------- A04: oleadas agrupadas y defensas primero ----------
{
  const spreads = [];
  let launches = 0;
  for (const seed of [4, 8, 15]) {
    seedRandom(seed);
    const g = newGame({ mode: 'ffa', mapKind: 'archipelago', seed });
    for (const b of g.bots) {
      const ol = b.launch.bind(b);
      b.launch = (units, target, an) => { if (b.lastLaunch) { spreads.push(b.lastLaunch.together); b.lastLaunch = null; } return ol(units, target, an); };
    }
    run(g, 900);
    launches += g.bots.reduce((s, b) => s + b.wavesSent, 0);
  }
  const tight = spreads.filter((s) => s >= 0.8).length / (spreads.length || 1);
  const avgTogether = spreads.reduce((a, b) => a + b, 0) / (spreads.length || 1);
  check('A04', 'las oleadas salen reunidas (en el 80 % de ellas, 8 de cada 10 tropas a 4 casillas o menos)', spreads.length >= 5 && tight >= 0.8,
    `${spreads.length} oleadas reunidas de ${launches} lanzadas; ${Math.round(tight * 100)} % salieron juntas; media ${Math.round(avgTogether * 100)} % de tropas juntas`);

  seedRandom(5);
  const g = newGame({ mode: 'duel', mapKind: 'archipelago', seed: 12, difficulty: 'hard' });
  const bot = g.bots[0];
  const core0 = g.players[0].core;
  g.players[0].coins = 1e5;
  const tCell = g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, 'turret', c.i) && g.map.dist(c, g.cells[core0.cell]) === 2);
  g.place(0, 'turret', tCell.i);
  const turret = g.buildings.find((b) => b.type === 'turret');
  turret.built = true;
  const cs = g.freeCellsNear(g.map.homes[bot.pid], 'land', bot.pid, 6);
  const army = cs.map((ci) => g.addUnit(bot.pid, 'rifle', ci));
  bot.launch(army, core0);
  const onTurret = army.filter((u) => u.target === turret).length;
  check('A04', 'en Difícil la oleada ataca primero la Torreta junto al Núcleo', onTurret === army.length, `${onTurret}/${army.length} contra la Torreta`);
}

// ---------- A05: retirada, curación y reparación ----------
{
  seedRandom(6);
  const g = newGame({ mode: 'duel', mapKind: 'archipelago', seed: 14 });
  const bot = g.bots[0];
  const pc = g.cells[g.map.homes[bot.pid]];
  const far = g.cells.find((c) => c.comp === pc.comp && TERRAIN[c.t].land && !c.bld && g.map.dist(c, pc) === 6);
  const u = g.addUnit(bot.pid, 'rifle', far.i);
  u.role = 'wave';
  u.hp = u.maxHp * 0.2;
  bot.retreat([u], g.buildings.filter((b) => b.owner === bot.pid));
  const startRole = u.role;
  let healedAt = -1;
  for (let i = 0; i < 900; i++) {
    g.update(0.1);
    if (i % 18 === 0) bot.retreat([u], g.buildings.filter((b) => b.owner === bot.pid));
    if (u.role === 'home') { healedAt = g.time; break; }
  }
  check('A05', 'una tropa al 20 % se retira, se cura en el Núcleo y vuelve', startRole === 'retreat' && healedAt > 0 && u.hp >= u.maxHp * 0.85,
    `rol inicial ${startRole}, vuelve a los ${Math.round(healedAt)} s con ${Math.round((u.hp / u.maxHp) * 100)} %`);
  // v0.5: los bots empiezan sin tropas; se agrega un Ingeniero para esta prueba.
  const eng = g.units.find((x) => x.owner === bot.pid && x.type === 'engineer') || g.addUnit(bot.pid, 'engineer', g.freeCellsNear(g.map.homes[bot.pid], 'land', bot.pid, 2)[0]);
  g.players[bot.pid].coins = 1e5;
  const fc = g.cells.find((c) => c.owner === bot.pid && !g.placeInvalid(bot.pid, 'farm', c.i));
  g.place(bot.pid, 'farm', fc.i);
  const farm = g.buildings.find((b) => b.owner === bot.pid && b.type === 'farm');
  farm.built = true; farm.progress = 1; farm.hp = farm.maxHp * 0.4; farm.lastHit = -99;
  eng.state = 'idle';
  bot.repairBase(g.units.filter((x) => x.owner === bot.pid), g.buildings.filter((b) => b.owner === bot.pid));
  // v0.5: también reparan los Constructores; vale cualquiera que repare.
  const rep = g.units.filter((x) => x.owner === bot.pid && x.state === 'repair').map((x) => x.type);
  const st = rep.join(',') || 'nadie';
  run(g, 30);
  check('A05', 'un Ingeniero o Constructor bot repara un edificio dañado', rep.length > 0 && farm.hp >= farm.maxHp * 0.99, `reparando: ${st}, vida final ${Math.round((farm.hp / farm.maxHp) * 100)} %`);
}

// ---------- A06: Barcaza a Banderas en Mar abierto ----------
{
  let farCaps = 0;
  let trips = 0;
  for (const seed of [2, 6, 10, 17]) {
    seedRandom(seed);
    const g = newGame({ mode: 'ffa', mapKind: 'open', seed });
    const owners = g.points.map((p) => p.owner);
    for (let i = 0; i < 9000 && !g.over; i++) {
      g.update(0.1);
      if (i % 10) continue;
      g.points.forEach((p, k) => {
        if (p.owner !== owners[k] && p.owner > 0 && p.type === 'flag') {
          const home = g.cells[g.players[p.owner].core.cell];
          if (g.cells[p.cell].comp !== home.comp) farCaps++;
        }
        owners[k] = p.owner;
      });
    }
    trips += g.bots.reduce((s, b) => s + b.ferryTrips, 0);
  }
  check('A06', 'en Mar abierto capturan Banderas de otras islas', farCaps >= 1, `${farCaps} capturas en otras islas, ${trips} viajes de Barcaza (4 partidas)`);
}

// ---------- A07: Cúpula ante ataque naval ----------
{
  seedRandom(7);
  const g = newGame({ mode: 'duel', mapKind: 'archipelago', seed: 16 });
  const bot = g.bots[0];
  const p = g.players[bot.pid];
  g.time = 260;
  bot.lastT = 260;
  const farmC = g.cells.find((c) => c.owner === bot.pid && !g.placeInvalid(bot.pid, 'farm', c.i, true));
  p.coins = 9000;
  g.place(bot.pid, 'farm', farmC.i);
  const farm = g.buildings.find((b) => b.owner === bot.pid && b.type === 'farm');
  g.damage(farm, 50, 0, { cls: 'ship', type: 'destroyer', owner: 0 });
  p.coins = 9000;
  bot.ecoBank = 6500; bot.milBank = 2500;
  p.core.level = 3; // v0.5: la Cúpula pide Núcleo nivel 3
  bot.think();
  check('A07', 'tras recibir fuego naval, el bot compra la Cúpula', !!p.dome, `Cúpula: ${p.dome ? 'sí' : 'no'}`);
}

// ---------- A08: avisos antes del ataque y ritmo de mensajes ----------
{
  let warned = 0;
  let arrivals = 0;
  let early = 0;
  let violations = 0;
  let total = 0;
  for (const seed of [3, 9, 27]) {
    seedRandom(seed);
    const g = newGame({ mode: 'duel', mapKind: 'archipelago', seed });
    g.players[0].core.hp = 1e9; g.players[0].core.maxHp = 1e9;
    let warnAt = -1;
    let arriveAt = -1;
    for (let i = 0; i < 9000 && !g.over; i++) {
      g.update(0.1);
      if (warnAt < 0) { const m = g.chat.find((c) => c.toMe && c.kind === 'bad'); if (m) warnAt = m.time; }
      if (arriveAt < 0 && i % 5 === 0 && g.units.some((u) => u.owner !== 0 && (u.role === 'wave') && g.cells[u.cell].owner === 0)) arriveAt = g.time;
      if (warnAt >= 0 && arriveAt >= 0) break;
    }
    if (arriveAt >= 0) arrivals++;
    if (warnAt >= 0) warned++;
    if (arriveAt >= 0 && warnAt >= 0 && warnAt <= arriveAt) early++;
    const byBot = {};
    for (const m of g.chat) (byBot[m.pid] = byBot[m.pid] || []).push(m);
    for (const list of Object.values(byBot)) {
      for (let k = 1; k < list.length; k++) {
        total++;
        const fall = PERS_FALL(list[k].text);
        if (!fall && list[k].time - list[k - 1].time < 20 - 1e-6) violations++;
      }
    }
  }
  function PERS_FALL(t) { return Object.values(ctx.PERSONALITIES).some((p) => p.lines.fall.includes(t)); }
  check('A08', 'el bot avisa antes de que su oleada entre en tu territorio', arrivals >= 2 && early === arrivals, `${early} de ${arrivals} ataques avisados a tiempo (${warned} avisos)`);
  check('A08', 'nunca más de un mensaje por bot cada 20 s (salvo la despedida)', violations === 0, `${violations} infracciones en ${total} pares`);
}

// ---------- A09: dificultad ----------
{
  const stats = {};
  for (const diff of ['easy', 'hard']) {
    let retreats = 0;
    let grouped = 0;
    for (const seed of [5, 11, 19]) {
      seedRandom(seed);
      const g = newGame({ mode: 'ffa', mapKind: 'archipelago', seed, difficulty: diff });
      for (const b of g.bots) {
        const ol = b.launch.bind(b);
        b.launch = (u, t, an) => { if (b.lastLaunch) grouped++; b.lastLaunch = null; return ol(u, t, an); };
      }
      run(g, 900);
      retreats += g.bots.reduce((s, b) => s + b.retreats, 0);
    }
    stats[diff] = { retreats, grouped };
  }
  check('A09', 'Fácil: sin retiradas ni oleadas reunidas', stats.easy.retreats === 0 && stats.easy.grouped === 0, JSON.stringify(stats.easy));
  check('A09', 'Difícil: hay retiradas y oleadas reunidas', stats.hard.retreats > 0 && stats.hard.grouped > 0, JSON.stringify(stats.hard));
}

console.log(results.map((r) => r.text).join('\n'));
console.log(`TOTAL ${results.filter((r) => r.ok).length}/${results.length}`);
