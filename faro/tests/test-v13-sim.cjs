// Pruebas de lógica de la v1.3 (bugs de tu revisión). Con FARO_JS=<código v1.2> se reproduce cada bug.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const TAG = process.env.TAG || 'v13';
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, UNITS, BUILDINGS } = ctx;
const TERRAIN = V('TERRAIN');
const NUKE = V('NUKE');
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- J01 «Avanzar atacando» con un enemigo inalcanzable ----------
{
  seedRandom(1);
  const out = [];
  let okAll = true;
  for (const seed of [3, 5, 8]) {
    const g = new Game({ mode: 'duel', mapKind: 'open', difficulty: 'normal', seed, fog: false });
    g.bots = [];
    const home = g.cells[g.players[0].core.cell];
    const isl = g.cells.filter((c) => c.comp === home.comp && g.passable(c, 'land', 0) && !c.bld);
    // Agua honda: ninguna tierra a menos de 3 casillas (no se le puede disparar desde la orilla).
    const deep = g.cells.filter((c) => TERRAIN[c.t].water && !c.bld && !g.cells.some((x) => TERRAIN[x.t].land && g.map.dist(x, c) <= 3));
    let found = null;
    for (const s of isl) {
      const w = deep.find((c) => g.map.dist(c, s) === 5);
      if (!w) continue;
      const d = isl.find((c) => g.map.dist(c, s) >= 6 && g.map.dist(c, w) >= g.map.dist(s, w) + 4);
      if (d) { found = { s, w, d }; break; }
    }
    if (!found) { out.push(`semilla ${seed}: sin lugar`); continue; }
    const u = g.addUnit(0, 'rifle', found.s.i);
    const foe = g.addUnit(1, 'barge', found.w.i);
    let paths = 0;
    const sp = g.setPath.bind(g);
    g.setPath = (x, ci) => { if (x === u) paths++; return sp(x, ci); };
    g.orderMove([u], found.d.i, true);
    let flips = 0;
    let prev = u.state;
    let arrived = -1;
    for (let i = 0; i < 400; i++) {
      g.update(0.1);
      foe.hp = foe.maxHp;
      if (u.state !== prev) { flips++; prev = u.state; }
      if (arrived < 0 && g.map.dist(g.cells[u.cell], found.d) <= 1) arrived = g.time;
    }
    const ok = arrived >= 0 && flips <= 6;
    if (!ok) okAll = false;
    out.push(`semilla ${seed}: ${arrived >= 0 ? `llegó a los ${arrived.toFixed(0)} s` : 'no llegó en 40 s'}, ${flips} cambios de estado, ${(paths / 40).toFixed(1)} búsquedas de camino por segundo`);
  }
  check('J01', '«Avanzar atacando» con un barco enemigo inalcanzable cerca', okAll, `Artillero con «Avanzar atacando» y una Barcaza enemiga en el agua a 5 casillas: ${out.join('; ')}`);
}

// ---------- J03 misil nuclear: no daña lo tuyo ni a tus aliados; la Cúpula lo frena ----------
{
  const g = new Game({ mode: 'duos', mapKind: 'continent', difficulty: 'normal', seed: 21, fog: false });
  g.bots = [];
  // Un punto lejos de los Núcleos con tierra alrededor.
  const cores = g.players.map((p) => g.cells[p.core.cell]);
  const spot = g.cells.find((c) => TERRAIN[c.t].land && !c.bld && cores.every((k) => g.map.dist(k, c) > 8) &&
    g.cells.filter((x) => g.map.dist(x, c) <= 2 && g.passable(x, 'land', 0) && !x.bld).length >= 12);
  const free = g.cells.filter((x) => g.map.dist(x, spot) <= 2 && g.passable(x, 'land', 0) && !x.bld && x !== spot);
  const myTank = g.addUnit(0, 'tank', free[0].i);
  const mySolar = g.addBuilding(0, 'solar', free[1].i, true);
  const allyTank = g.addUnit(1, 'tank', free[2].i);
  const foeTank = g.addUnit(2, 'tank', free[3].i);
  const foeSolar = g.addBuilding(2, 'solar', free[4].i, true);
  const hp0 = [myTank.hp, mySolar.hp, allyTank.hp, foeTank.hp, foeSolar.hp];
  const kills0 = g.players[0].stats.kills;
  g.updateNuke({ kind: 'nuke', dmg: NUKE.dmg, owner: 0, sx: spot.x, sy: 3, sz: spot.z, tx: spot.x, ty: spot.h, tz: spot.z, cell: spot.i, time: NUKE.flight, dur: NUKE.flight, checked: true });
  const after = [myTank, mySolar, allyTank, foeTank, foeSolar].map((e) => (e.alive ? Math.round(e.hp) : 'destruido'));
  const friendlyOk = myTank.alive && myTank.hp === hp0[0] && mySolar.alive && mySolar.hp === hp0[1] && allyTank.alive && allyTank.hp === hp0[2];
  const foeHit = !foeTank.alive || foeTank.hp < hp0[3];
  // Cúpula: misil enemigo junto al Núcleo de un jugador con Cúpula.
  const g2 = new Game({ mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 22, fog: false });
  g2.bots = [];
  const p0 = g2.players[0];
  const core = p0.core;
  while (core.level < 3) { core.upgrading = { level: core.level + 1, progress: 1 }; g2.finishUpgrade(core); }
  p0.coins = 1e6;
  g2.buyDome(0);
  const domeHp0 = p0.dome.hp;
  const coreHp0 = core.hp + (core.shield || 0);
  const cc = g2.cells[core.cell];
  const tgt = g2.cells.find((c) => g2.map.dist(c, cc) === 1);
  g2.updateNuke({ kind: 'nuke', dmg: NUKE.dmg, owner: 1, sx: tgt.x, sy: 3, sz: tgt.z, tx: tgt.x, ty: tgt.h, tz: tgt.z, cell: tgt.i, time: NUKE.flight, dur: NUKE.flight, checked: true });
  const domeHp1 = p0.dome.hp;
  const coreHp1 = core.hp + (core.shield || 0);
  const domeOk = domeHp1 < domeHp0;
  check('J03', 'El misil no daña lo tuyo ni a aliados; la Cúpula absorbe su daño', friendlyOk && foeHit && domeOk,
    `misil propio en medio de: tu Tanque ${hp0[0]} → ${after[0]}, tu Solar ${hp0[1]} → ${after[1]}, Tanque aliado ${hp0[2]} → ${after[2]}, Tanque enemigo ${hp0[3]} → ${after[3]}, Solar enemiga ${hp0[4]} → ${after[4]} (eliminaciones contadas: ${g.players[0].stats.kills - kills0}); ` +
    `misil enemigo junto a tu Núcleo con Cúpula de ${Math.round(domeHp0)}: la Cúpula queda en ${Math.round(domeHp1)} y el Núcleo (vida + escudo) pasa de ${Math.round(coreHp0)} a ${Math.round(coreHp1)}`);
}

// ---------- J04 tropas de tierra sobre el agua ----------
{
  let samples = 0;
  let onWaterCell = 0;
  let overWater = 0;
  const where = [];
  for (const [mode, map, seed] of [['ffa', 'archipelago', 31], ['conquest', 'reef', 32], ['ffa', 'bay', 33], ['duos', 'open', 34], ['conquest', 'mesa', 35], ['ffa', 'dunes', 36]]) {
    seedRandom(seed);
    const g = new Game({ mode, mapKind: map, difficulty: 'normal', seed });
    for (let i = 0; i < 600 * 10; i++) {
      g.update(0.1);
      if (i % 5) continue;
      for (const u of g.units) {
        if (!u.alive || u.inside || u.mover !== 'land') continue;
        samples++;
        if (!TERRAIN[g.cells[u.cell].t].land) { onWaterCell++; if (where.length < 3) where.push(`${u.def.name} en ${map}`); }
        const c = g.map.atWorld(u.x, u.z);
        if (c && !TERRAIN[c.t].land) overWater++;
      }
    }
  }
  check('J04', 'Ninguna tropa de tierra queda en una casilla de agua', onWaterCell === 0,
    `6 partidas de 10 min (6 mapas): ${samples} muestras de tropas de tierra; en una casilla de agua: ${onWaterCell}${where.length ? ` (${where.join(', ')})` : ''}; con el centro de la tropa un instante sobre el borde del agua al doblar la costa: ${overWater}`);
}

// ---------- J05 misión de edificios y demoler con mejora en curso ----------
{
  const g = new Game({ mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 41, fog: false });
  g.bots = [];
  const p = g.players[0];
  p.coins = 50000;
  const core = g.cells[p.core.cell];
  const spot = (type) => g.cells.filter((c) => !g.placeInvalid(0, type, c.i)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
  const b0 = p.stats.built;
  const c1 = spot('solar');
  g.place(0, 'solar', c1.i);
  const b1 = p.stats.built;
  const placed = c1.bld;
  const coins0 = p.coins;
  g.demolish(placed);
  const refund = p.coins - coins0;
  const b2 = p.stats.built;
  // Una obra que sí se termina.
  const c2 = spot('solar');
  g.place(0, 'solar', c2.i);
  const solar = c2.bld;
  for (let i = 0; i < 1200 && !solar.built; i++) g.update(0.1);
  const b3 = p.stats.built;
  // Demoler un Cuartel mientras se mejora.
  const bar = g.addBuilding(0, 'barracks', spot('barracks').i, true);
  const coinsA = p.coins;
  const upCost = g.upgradeCost(bar);
  g.upgrade(bar);
  const coinsB = p.coins;
  g.demolish(bar);
  const back = p.coins - coinsB;
  const expected = Math.floor(BUILDINGS.barracks.cost * 0.4) + upCost;
  const ok = b1 === b0 && b2 === b0 && b3 === b0 + 1 && solar.built && back === expected && coinsA - coinsB === upCost;
  check('J05', '«Construye 12 edificios» cuenta obras terminadas; demoler devuelve la mejora en curso', ok,
    `colocar una Solar: edificios ${b0} → ${b1}; cancelarla (vuelven ${refund} monedas): ${b2}; cuando una Solar se termina: ${b3}. ` +
    `Cuartel terminado con mejora en curso (pagada: ${upCost}): al demolerlo vuelven ${back} (40 % del Cuartel ${Math.floor(BUILDINGS.barracks.cost * 0.4)} + la mejora ${upCost})`);
}

// ---------- J06 primer objetivo y textos ----------
{
  const g = new Game({ mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 51, fog: false });
  for (let i = 0; i < 30; i++) g.update(0.1);
  const at1 = !!g.objDone.builder;
  const p = g.players[0];
  p.coins = 5000;
  g.enqueue(p.core, 'builder');
  for (let i = 0; i < 300 && !g.objDone.builder; i++) g.update(0.1);
  const after = !!g.objDone.builder;
  const objText = V('OBJECTIVES')[0].text;
  const bdesc = BUILDINGS.barracks.desc;
  const nProd = BUILDINGS.barracks.produces.length;
  const ok = !at1 && after && /más/.test(objText) && bdesc.includes(String(nProd));
  check('J06sim', 'Primer objetivo y texto del Cuartel', ok,
    `«${objText}»: al segundo 3 ${at1 ? 'ya está cumplido (empiezas con un Constructor)' : 'no está cumplido'}; al entrenar uno ${after ? 'se cumple' : 'no se cumple'}. Cuartel: «${bdesc}» (entrena ${nProd})`);
}

// ---------- J07 paso más lento de la simulación (IA de los bots) ----------
{
  const runs = [];
  let maxTwo = 0;
  for (const [mode, map, seed] of [['ffa', 'archipelago', 61], ['league', 'continent', 62], ['big', 'reef', 63]]) {
    seedRandom(seed);
    const g = new Game({ mode, mapKind: map, difficulty: 'hard', seed });
    // Cuántos bots piensan en el mismo paso.
    let thinking = 0;
    for (const b of g.bots) { const th = b.think.bind(b); b.think = () => { thinking++; return th(); }; }
    const times = [];
    for (let i = 0; i < 600 * 12; i++) {
      thinking = 0;
      const t0 = performance.now();
      g.update(0.1);
      times.push(performance.now() - t0);
      if (thinking > 1) maxTwo++;
    }
    times.sort((a, b) => a - b);
    runs.push({ mode, map, p50: times[Math.floor(times.length * 0.5)], p99: times[Math.floor(times.length * 0.99)], max: times[times.length - 1], bots: g.bots.length });
  }
  const ev = runs.map((r) => `${r.mode}/${r.map} (${r.bots} bots): mediana ${r.p50.toFixed(2)} ms, 1 % más lento ${r.p99.toFixed(1)} ms, máximo ${r.max.toFixed(1)} ms`).join('; ');
  check('J07ai', 'Bots repartidos: nunca piensan dos en el mismo paso', maxTwo === 0, `${ev}; pasos con más de un bot pensando: ${maxTwo}`);
  fs.writeFileSync(__dirname + `/steps-${TAG}.json`, JSON.stringify(runs));
}

// ---------- J12 Muro y nombre del modo ----------
{
  const MODES = V('MODES');
  const ok = BUILDINGS.wall.cost === 30 && MODES.blitz.name !== 'Relámpago';
  check('J12', 'Muro a 30 y modo con nombre propio', ok, `Muro: ${BUILDINGS.wall.cost} monedas; modo rápido: «${MODES.blitz.name}»`);
}

fs.writeFileSync(__dirname + `/results-${TAG}-sim.json`, JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
