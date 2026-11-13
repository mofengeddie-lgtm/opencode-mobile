// Pruebas de lógica de la v1.0 (G02, G03, G04, G05 tácticas, G07, G08) con el juego sin gráficos.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, BUILDINGS, UNITS } = ctx;
const NUKE = V('NUKE');

function mk(seed = 11, mapKind = 'continent', mode = 'duel', difficulty = 'normal') {
  const g = new Game({ mode, mapKind, difficulty, seed, fog: false });
  g.bots = [];
  for (const p of g.players) { p.coins = 1e7; p.energy = 1e6; }
  return g;
}
const run = (g, sec, dt = 0.1, each) => { for (let t = 0; t < sec; t += dt) { g.update(dt); if (each) each(); } };
const spot = (g, type, near, pid = 0) => {
  const c0 = g.cells[near === undefined ? g.players[pid].core.cell : near];
  const c = g.cells.filter((x) => !g.placeInvalid(pid, type, x.i, true)).sort((a, b) => g.map.dist(a, c0) - g.map.dist(b, c0))[0];
  return c ? c.i : -1;
};
const build = (g, type, pid = 0, near) => { const ci = spot(g, type, near, pid); return ci < 0 ? null : g.addBuilding(pid, type, ci, true); };
const levelUp = (g, b, lv) => { while (b.level < lv) { b.upgrading = { level: b.level + 1, progress: 1 }; g.finishUpgrade(b); } };

// ---------- G02 comunidad 240 ----------
{
  const g = mk(41);
  const MAX_POP = V('MAX_POP');
  levelUp(g, g.players[0].core, 3);
  const houses = [];
  for (let i = 0; i < 10; i++) { const h = build(g, 'house'); if (h) houses.push(h); }
  const ninth = g.placeInvalid(0, 'house', spot(g, 'barracks'), true);
  for (const h of houses) levelUp(g, h, 2);
  g.refreshEconomy();
  const cap = g.players[0].popCap;
  check('G02', 'Comunidad máxima 240, 8 Casas y se puede llegar a 240',
    MAX_POP === 240 && houses.length === 8 && cap === 240 && /Límite|límite/.test(ninth || ''),
    `máximo ${MAX_POP}; Casas puestas ${houses.length} (la 9.ª: «${ninth}»); con 8 Apartamentos y el Núcleo en nivel 3 la comunidad llega a ${cap}`);
}

// ---------- G03 radiación ----------
{
  const g = mk(42);
  const a = build(g, 'aadef');
  levelUp(g, a, 4);
  const ec = g.players[1].core;
  // Blanco lejos de los dos Núcleos (sin láseres ni defensas que confundan la medida).
  const target = g.cells.filter((c) => g.passable(c, 'land', 1) && g.map.dist(c, g.cells[ec.cell]) >= 7 && g.map.dist(c, g.cells[g.players[0].core.cell]) >= 7 &&
    g.cells.filter((x) => g.map.dist(x, c) <= 2 && g.passable(x, 'land', 1)).length >= 15)[0];
  g.launchNuke(a, target.i);
  run(g, NUKE.flight + 0.5);
  const zones = (g.radZones || []).length;
  const z = g.radZones[0];
  let radFx = 0;
  const of = g.fx.push.bind(g.fx);
  g.fx.push = (f) => { if (f.k === 'rad') radFx++; return of(f); };
  const free = g.freeCellsNear(target.i, 'land', 1, 6);
  // 1) Tanque enemigo solo dentro de la zona, 5 s.
  const foe = g.addUnit(1, 'tank', free[1]);
  const f0 = foe.hp;
  run(g, 5);
  const burned = f0 - foe.hp;
  foe.alive = false;
  // 2) Tanque propio solo dentro de la zona, 5 s.
  const mine = g.addUnit(0, 'tank', free[2]);
  const m0 = mine.hp;
  run(g, 5);
  const ownSafe = mine.hp === m0;
  mine.alive = false;
  // 3) Cuartel enemigo puesto dentro después de la explosión, 5 s.
  const foeB = g.addBuilding(1, 'barracks', g.cells.filter((x) => g.map.dist(x, target) === 1 && !x.bld && V('TERRAIN')[x.t].land)[0].i, true);
  const coreBefore = foeB.hp + foeB.shield;
  run(g, 5);
  const coreBurn = coreBefore - (foeB.hp + foeB.shield);
  // Se apaga a los 60 s.
  const left = z.until - g.time;
  run(g, left - 1);
  const stillOn = g.radZones.length > 0;
  run(g, 2);
  const off = g.radZones.length === 0;
  check('G03', 'El misil nuclear deja 1 minuto de radiación: quema a los enemigos de dentro y se apaga a los 60 s',
    zones === 1 && z.until - z.start === 60 && burned > 0 && ownSafe && coreBurn > 0 && stillOn && off && radFx > 0,
    `zona creada al caer (${zones}), dura ${z.until - z.start} s; en 5 s un tanque enemigo perdió ${Math.round(burned)} de vida (${Math.round((burned / foe.maxHp) * 100)} %) y el tuyo ${Math.round(m0 - mine.hp)}; un Cuartel enemigo dentro perdió ${Math.round(coreBurn)} (escudo y vida) en otros 5 s; ` +
    `a 1 s del final sigue activa (${stillOn}) y después se apaga (${off}); efectos de fuego y humo: ${radFx}`);
}

// ---------- G04 mejorar todo y automáticas ----------
{
  const g = mk(43);
  const p = g.players[0];
  const blds = ['farm', 'farm', 'barracks', 'turret', 'house', 'mine', 'factory'].map((t) => build(g, t)).filter(Boolean);
  const before3 = g.upgradeAll(0);
  levelUp(g, p.core, 3);
  // Con dinero justo: solo algunas.
  p.coins = 2500;
  const some = g.upgradeAll(0);
  const partial = typeof some === 'object' && some.n > 0 && p.coins >= 0 && g.upgradeCandidates(0).length > 0;
  // Con mucho dinero: todas las que faltan.
  p.coins = 1e6;
  const all = g.upgradeAll(0);
  const busy = g.buildings.filter((b) => b.owner === 0 && b.upgrading).length;
  // Automáticas: con 3 Constructores y tiempo, todo al máximo; nunca bajan de la reserva.
  for (const b of g.buildings) if (b.upgrading) { b.upgrading.progress = 1; g.finishUpgrade(b); }
  const cells = g.freeCellsNear(p.core.cell, 'land', 0, 6);
  for (let k = 0; k < 3; k++) g.addUnit(0, 'builder', cells[k]);
  p.coins = 60000;
  p.autoUpgrade = true;
  let minAfterAuto = Infinity;
  let autoStarts = 0;
  const ou = g.upgrade.bind(g);
  g.upgrade = (b) => { const r = ou(b); if (typeof r !== 'string') { autoStarts++; minAfterAuto = Math.min(minAfterAuto, p.coins); } return r; };
  let maxBusy = 0;
  run(g, 600, 0.1, () => { maxBusy = Math.max(maxBusy, g.buildings.filter((b) => b.owner === 0 && b.upgrading).length); if (p.coins < 20000) p.coins += 20000; });
  const left = g.upgradeCandidates(0).length;
  const maxed = blds.filter((b) => b.alive && b.level >= (b.def.maxLevel || 1)).length;
  check('G04', '«Mejorar todo» y «Mejoras automáticas» solo con el Núcleo en nivel 3; respetan el dinero y llegan al máximo',
    typeof before3 === 'string' && partial && typeof all === 'object' && all.n > 0 && left === 0 && minAfterAuto >= V('AUTO_UP').reserve && maxBusy <= 3,
    `con el Núcleo en nivel 1: «${before3}»; con 2.500 monedas: ${some.n} mejora(s) (quedan ${g.upgradeCandidates(0).length >= 0 ? 'otras' : ''} esperando dinero); con dinero: ${all.n} más a la vez (${busy} en obra); ` +
    `automáticas con 3 Constructores: ${autoStarts} mejoras en 10 min, como mucho ${maxBusy} a la vez, nunca por debajo de ${Math.round(minAfterAuto)} monedas (reserva ${V('AUTO_UP').reserve}); al final quedan ${left} por mejorar y ${maxed} de ${blds.length} edificios al máximo`);
}

// ---------- G05 tácticas nuevas de Difícil ----------
{
  // a) Busca primero Constructores: un Artillero del bot con un Constructor y un Artillero enemigos a tiro.
  const pick = (diff) => {
    const g = new Game({ mode: 'duel', mapKind: 'continent', difficulty: diff, seed: 44, fog: false });
    const bot = g.bots.find((b) => b.pid === 1);
    const c0 = g.cells[g.players[1].core.cell];
    const free = g.freeCellsNear(c0.i, 'land', 1, 30);
    const shooter = g.addUnit(1, 'rifle', free[20]);
    const near = g.cells.filter((c) => g.map.dist(c, g.cells[shooter.cell]) === 2 && g.passable(c, 'land', 0));
    const builder = g.addUnit(0, 'builder', near[0].i);
    const rifle = g.addUnit(0, 'rifle', near[1].i);
    const t = g.acquire(shooter, UNITS.rifle.weapon, 0);
    return t ? t.type : 'nada';
  };
  const hardPick = pick('hard');
  const normPick = pick('normal');
  // b) Defensa antiaérea en cuanto ve aviones.
  const aaCount = (diff) => {
    const g = new Game({ mode: 'duel', mapKind: 'continent', difficulty: diff, seed: 45, fog: false });
    g.bots = g.bots.filter((b) => b.pid === 1);
    for (const p of g.players) { p.coins = 30000; p.energy = 2000; }
    run(g, 130);
    const heliCell = g.freeCellsNear(g.players[1].core.cell, 'land', 0, 40)[30];
    const h = g.addUnit(0, 'heli', heliCell);
    h.hp = h.maxHp = 1e7;
    run(g, 40, 0.1, () => { g.players[1].coins = Math.max(g.players[1].coins, 20000); });
    return g.buildings.filter((b) => b.owner === 1 && b.type === 'aadef').length;
  };
  const aaHard = aaCount('hard');
  const aaNorm = aaCount('normal');
  // c) Misil antes y salva de 3.
  const g = new Game({ mode: 'duel', mapKind: 'continent', difficulty: 'hard', seed: 46, fog: false });
  const bot = g.bots.find((b) => b.pid === 1);
  const silos = [0, 1, 2].map(() => build(g, 'aadef', 1));
  for (const s of silos) levelUp(g, s, 4);
  g.time = 950;
  g.players[1].coins = 70000;
  bot.useNuke(g.buildings.filter((b) => b.owner === 1));
  const salvo = g.projectiles.filter((pp) => pp.kind === 'nuke').length;
  const DIFF = V('DIFFICULTY');
  check('G05t', 'Tácticas nuevas de Difícil',
    hardPick === 'builder' && normPick !== 'builder' && aaHard > aaNorm && aaHard >= 2 && salvo === 3,
    `con un Constructor y un Artillero a tiro, Difícil dispara a: ${UNITS[hardPick] ? UNITS[hardPick].name : hardPick} (Normal: ${UNITS[normPick] ? UNITS[normPick].name : normPick}); ` +
    `40 s después de ver un helicóptero enemigo tiene ${aaHard} AIR DEFENSE (Normal: ${aaNorm}); a los 15:50 min con 3 AIR DEFENSE nivel 4 lanza la salva de ${salvo}; ` +
    `ingresos ×${DIFF.hard.income} (antes ×1,3), piensa cada ${DIFF.hard.think} s (antes 1,1), primera oleada a los ${DIFF.hard.firstWave} s (antes 95)`);
}

// ---------- G07 el constructor llega ----------
{
  const g = mk(47);
  const p = g.players[0];
  const core = g.cells[p.core.cell];
  const site = g.cells.filter((c) => !g.placeInvalid(0, 'barracks', c.i) && g.map.dist(c, core) >= 4 && g.map.dist(c, core) <= 6)[0];
  for (const u of g.units) if (u.owner === 0 && u.def.builds) u.alive = false;
  g.units = g.units.filter((u) => u.alive);
  const far = g.cells.filter((c) => g.passable(c, 'land', 0) && g.map.dist(c, site) === 5)[0];
  const bu = g.addUnit(0, 'builder', far.i);
  g.place(0, 'barracks', site.i, 0);
  const b = g.buildings.find((x) => x.cell === site.i);
  let walkingProg = 0; let workFrames = 0; let maxWorkDist = 0; let movingWhileWork = 0; let firstWork = null;
  let last = b.progress;
  run(g, 60, 0.1, () => {
    const d = Math.hypot(bu.x - b.x, bu.z - b.z);
    const gained = b.progress - last;
    last = b.progress;
    if (gained > 0) {
      workFrames++;
      maxWorkDist = Math.max(maxWorkDist, d);
      if (bu.moving) movingWhileWork++;
      if (firstWork === null) firstWork = g.time;
    } else if (d > V('BUILD_REACH') + 0.05 && b.workAcc > 0 && !b.built) {
      // sin avance mientras está lejos: bien
    }
    if (d > V('BUILD_REACH') + 0.05 && gained > 0) walkingProg++;
  });
  check('G07', 'La obra solo avanza con el constructor quieto y pegado a ella; mientras camina, no avanza',
    walkingProg === 0 && movingWhileWork === 0 && workFrames > 0 && maxWorkDist <= V('BUILD_REACH') + 0.01 && b.built,
    `Constructor a 5 casillas: empezó a construir a los ${firstWork === null ? '—' : firstWork.toFixed(1)} s, siempre a ${maxWorkDist.toFixed(2)} o menos del centro de la obra (límite ${V('BUILD_REACH')}); ` +
    `cuadros con avance caminando: ${walkingProg}, moviéndose: ${movingWhileWork}; obra terminada: ${b.built}`);
}

// ---------- G08 salva de 3 ----------
{
  const g = mk(48);
  const p = g.players[0];
  const a = [0, 1, 2].map(() => build(g, 'aadef'));
  for (let i = 0; i < 2; i++) levelUp(g, a[i], 4);
  const with2 = g.salvoInvalid(0);
  levelUp(g, a[2], 4);
  const ec = g.players[1].core;
  const target = g.cells.filter((c) => g.map.dist(c, g.cells[ec.cell]) === 1)[0];
  build(g, 'antinuke', 1, ec.cell);
  const c0 = p.coins;
  const n = g.launchSalvo(0, target.i);
  const paid = c0 - p.coins;
  const flying = g.projectiles.filter((pp) => pp.kind === 'nuke').length;
  const again = g.salvoInvalid(0);
  run(g, NUKE.flight + 1);
  p.coins = 50000;
  for (const s of a) s.nukeReadyAt = 0;
  const poor = g.salvoInvalid(0);
  check('G08', '«Lanzar los 3» con 3 AIR DEFENSE nivel 4 listos; lanza los tres y un Escudo antimisiles solo derriba uno',
    /Necesitas 3/.test(with2 || '') && n === 3 && flying === 3 && paid === NUKE.cost * 3 && g.nukesIntercepted === 1 && /Necesitas 3/.test(again || '') && /Monedas/.test(poor || ''),
    `con 2 listos: «${with2}»; con 3: salen ${flying} a la vez y cuestan ${paid}; después: «${again}»; el Escudo antimisiles derribó ${g.nukesIntercepted} de 3; sin dinero: «${poor}»`);
}

fs.writeFileSync(__dirname + '/results-v10-sim.json', JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
