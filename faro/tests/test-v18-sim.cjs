// Pruebas de la v1.8 sin gráficos (Node): tropas y edificios nuevos y sus sistemas (O04-O13 del PRD v1.8).
// Uso: node faro/tests/test-v18-sim.cjs  →  escribe faro/tests/results-v18-sim.json
const fs = require('fs');
const path = require('path');
const ctx = require('./sim.cjs');
const { Game, UNITS, BUILDINGS } = ctx;

const results = {};
const ok = (id, pass, evidence) => {
  results[id] = { status: pass ? 'ok' : 'fail', evidence };
  console.log(`${pass ? '✅' : '❌'} ${id}: ${evidence}`);
};
const NEW_UNITS = ['scout', 'soldier', 'officer', 'radioman', 'sapper', 'mortar', 'paratrooper', 'marine', 'atguided', 'gunner', 'antidrone',
  'robodog', 'armoredcar', 'ifv', 'trooptruck', 'ambulance', 'recovery', 'supplytruck', 'tanker', 'commandveh', 'mobileradar', 'howitzer',
  'towedgun', 'tankdestroyer', 'amphib', 'bridgelayer', 'clearer', 'dozer', 'thermo', 'scoutdrone', 'cargodrone', 'interceptor', 'navaldrone',
  'subdrone', 'transheli', 'rescueheli', 'navalheli', 'attackjet', 'heavybomber', 'transportplane', 'awacs', 'tankerplane', 'ewplane', 'gunship',
  'gunboat', 'battleship', 'patrolboat', 'corvette', 'cruiser', 'landingship', 'logship', 'hospitalship', 'hovercraft', 'minesweeper',
  'minelayer', 'reconsub', 'stratsub'];
const NEW_BLD = ['corral', 'powerplant', 'workshop', 'research', 'radarstation', 'dronecenter', 'shipyard', 'depot', 'hq', 'bunker', 'gate',
  'bridge', 'dock', 'watchtower', 'coastal', 'silo', 'ciws', 'laser'];

// Campo de pruebas con obras instantáneas y todo el mapa como «tu territorio» (para poner cada edificio en su lugar).
function sandbox(seed = 7, extra = {}) {
  const g = new Game({ mode: 'sandbox', mapKind: 'archipelago', difficulty: 'normal', seed, creator: true, instantBuild: true, ...extra });
  return g;
}
function allMine(g) {
  for (const c of g.cells) if (c.owner < 0 || c.owner === 0) c.owner = 0;
}
const run = (g, secs) => { for (let i = 0; i < secs * 10; i++) g.update(0.1); };
const near = (g, ci, mover, owner = 0, n = 1) => g.freeCellsNear(ci, mover, owner, n);
const home = (g, pid = 0) => g.cells[g.players[pid].core.cell];
function placeAny(g, t, nearCell) {
  const cs = g.cells.filter((c) => !g.placeInvalid(0, t, c.i, true));
  if (!cs.length) return null;
  const ref = nearCell || home(g);
  cs.sort((a, b) => g.map.dist(a, ref) - g.map.dist(b, ref));
  const err = g.place(0, t, cs[0].i);
  if (err) return null;
  return g.cells[cs[0].i].bld;
}

// ---------- O04: cada tropa nueva se produce en su productor y obedece una orden ----------
{
  const g = sandbox(7);
  const p = g.players[0];
  let made = 0;
  const bad = [];
  for (const k of Object.keys(UNITS)) {
    const b = g.buildings.find((x) => x.owner === 0 && x.built && g.producesOf(x).includes(k));
    if (!b) { bad.push(`${k}: sin productor construido`); continue; }
    p.coins = 500000; p.energy = 9999;
    b.queue = [];
    const err = g.enqueue(b, k);
    if (err) { bad.push(`${k}: ${err}`); continue; }
    for (let i = 0; i < 600 && b.queue.length; i++) g.update(0.1);
    const u = g.units.find((x) => x.type === k && x.owner === 0 && x.alive);
    if (!u) { bad.push(`${k}: no salió`); continue; }
    // Orden de mover: a 2 casillas, por donde puede ir.
    const dest = g.freeCellsNear(u.cell, u.mover, 0, 6).find((ci) => ci !== u.cell && g.map.dist(g.cells[ci], g.cells[u.cell]) >= 2);
    if (dest !== undefined) {
      g.orderMove([u], dest);
      run(g, 12);
      if (u.alive && g.map.dist(g.cells[u.cell], g.cells[dest]) > 1 && u.mover !== 'air') { bad.push(`${k}: no llegó`); }
    }
    made++;
    g.kill(u, -1);
    g.update(0.1);
  }
  const newMade = NEW_UNITS.filter((k) => !bad.some((x) => x.startsWith(k + ':'))).length;
  ok('O04', bad.length === 0, `${made} de ${Object.keys(UNITS).length} tropas producidas y movidas (nuevas: ${newMade} de ${NEW_UNITS.length})${bad.length ? ' · fallas: ' + bad.join('; ') : ''}`);
}

// ---------- O05: cada edificio nuevo se coloca, se termina y hace lo suyo ----------
{
  const g = sandbox(7);
  allMine(g);
  const p = g.players[0];
  const built = [];
  const bad = [];
  const B = {};
  for (const t of NEW_BLD) {
    p.coins = 500000; p.energy = 9999;
    // El Campo de pruebas ya trae el Centro de investigación y el Astillero (límite 1): se usan esos.
    const have = g.buildings.find((x) => x.owner === 0 && x.type === t);
    const b = have && g.limitFor(0, t) === 1 ? have : placeAny(g, t);
    if (!b) { bad.push(`${t}: sin lugar válido`); continue; }
    B[t] = b;
  }
  run(g, 15);
  for (const [t, b] of Object.entries(B)) (b.alive && b.built ? built : bad).push(t + (b.built ? '' : ': sin terminar'));
  const checks = [];
  g.refreshEconomy();
  if (B.corral) checks.push(['corral da monedas', g.bIncome(B.corral) === 280]);
  if (B.powerplant) checks.push(['central da energía', g.bEnergy(B.powerplant) === 25]);
  if (B.dronecenter) checks.push(['centro de drones produce', g.producesOf(B.dronecenter).includes('interceptor')]);
  if (B.shipyard) checks.push(['astillero produce', g.producesOf(B.shipyard).includes('cruiser')]);
  if (B.workshop) {
    const ci = near(g, B.workshop.cell, 'land')[0];
    const tk = g.addUnit(0, 'tank', ci);
    tk.hp = 500;
    run(g, 3);
    checks.push(['taller repara vehículos', tk.hp > 550]);
  }
  if (B.dock) {
    const ci = near(g, B.dock.cell, 'sea')[0];
    const sh = g.addUnit(0, 'destroyer', ci);
    sh.hp = 500;
    run(g, 3);
    checks.push(['muelle repara barcos', sh.hp > 530]);
  }
  if (B.hq) {
    g.territoryDirty = true;
    run(g, 0.2);
    checks.push(['centro de mando gana territorio', g.cells[B.hq.cell].owner === 0]);
  }
  ok('O05', bad.length === 0 && checks.every((c) => c[1]), `${built.length} de ${NEW_BLD.length} edificios nuevos terminados · ${checks.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · ')}${bad.length ? ' · fallas: ' + bad.join('; ') : ''}`);
}

// ---------- O06: anfibios ----------
{
  const g = sandbox(7);
  const shallow = g.cells.find((c) => c.t === 'shallow' && !c.bld && g.map.isCoast(c));
  const deep = g.cells.find((c) => c.t === 'deep' && !c.bld);
  const land = g.cells.find((c) => TERR(c).land && !c.bld);
  function TERR(c) { return ctx.TERRAIN[c.t]; }
  const rules = [
    ['marine en agua baja', g.passable(shallow, 'amphib', 0) === true],
    ['marine no en mar profundo', g.passable(deep, 'amphib', 0) === false],
    ['soldado no en agua', g.passable(shallow, 'land', 0) === false],
    ['barco no en tierra', g.passable(land, 'sea', 0) === false],
  ];
  // Un Infante de marina camina hasta el agua baja de la costa.
  const nb = shallow.nb.map((ni) => g.cells[ni]).find((c) => TERR(c).land && !c.bld);
  const m = g.addUnit(0, 'marine', nb.i);
  m.hold = true;
  g.orderMove([m], shallow.i);
  let reached = false;
  for (let i = 0; i < 100; i++) { g.update(0.1); if (m.cell === shallow.i) reached = true; }
  rules.push(['marine llegó al agua', reached]);
  const hv = g.addUnit(0, 'hovercraft', shallow.i);
  g.orderMove([hv], nb.i);
  run(g, 8);
  rules.push(['aerodeslizador subió a la costa', hv.cell === nb.i]);
  ok('O06', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O07: puente y puerta ----------
{
  const g = sandbox(7, { creator: false, instantBuild: false });
  allMine(g);
  const p = g.players[0];
  // Puente con el Vehículo lanzapuentes.
  const shallow = g.cells.find((c) => c.t === 'shallow' && !c.bld && g.map.isCoast(c) && c.nb.some((ni) => ctx.TERRAIN[g.cells[ni].t].land && !g.cells[ni].bld));
  const shore = shallow.nb.map((ni) => g.cells[ni]).find((c) => ctx.TERRAIN[c.t].land && !c.bld);
  const bl = g.addUnit(0, 'bridgelayer', shore.i);
  bl.yaw = Math.atan2(shallow.x - shore.x, shallow.z - shore.z);
  const coins0 = p.coins;
  const res = g.layBridge(bl);
  const paid = p.coins;
  run(g, 4);
  const br = typeof res === 'string' ? null : res;
  const rules = [['puente tendido', !!br && br.built], ['pagó el puente', coins0 - paid >= BUILDINGS.bridge.cost - 1 && coins0 - paid < BUILDINGS.bridge.cost + 200]];
  if (br) {
    const bc = g.cells[br.cell];
    rules.push(['tierra cruza', g.passable(bc, 'land', 0) && g.passable(bc, 'land', 1)], ['barcos no', !g.passable(bc, 'sea', 0)]);
    const r = g.addUnit(0, 'rifle', shore.i);
    r.hold = true;
    g.orderMove([r], bc.i);
    let on = false;
    for (let i = 0; i < 80; i++) { g.update(0.1); if (r.cell === bc.i) on = true; }
    rules.push(['soldado sobre el puente', on]);
  }
  // Puerta reforzada (la levantan los Ingenieros del Campo de pruebas).
  const gt = placeAny(g, 'gate');
  run(g, 25);
  const gc = g.cells[gt.cell];
  rules.push(['puerta: tuyos pasan', g.passable(gc, 'land', 0)], ['puerta: enemigos no', !g.passable(gc, 'land', 1)]);
  g.toggleGate(gt);
  rules.push(['cerrada: nadie', !g.passable(gc, 'land', 0)]);
  ok('O07', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O08: auras ----------
{
  const g = sandbox(7);
  const h = home(g);
  const cells = near(g, h.i, 'land', 0, 8);
  const rifle = g.addUnit(0, 'rifle', cells[0]);
  const tank = g.addUnit(0, 'tank', cells[0]);
  // Todos en la misma casilla o pegados: dentro del alcance de cada aura.
  g.addUnit(0, 'officer', cells[0]);
  g.addUnit(0, 'commandveh', cells[0]);
  g.addUnit(0, 'supplytruck', cells[0]);
  g.addUnit(0, 'tanker', cells[0]);
  run(g, 0.6);
  const rules = [
    ['mando +15 % (no se suman)', Math.abs(rifle.buffDmg - 0.15) < 1e-9],
    ['suministros +20 % recarga', Math.abs(rifle.buffCd - 0.2) < 1e-9],
    ['combustible +20 % vehículos', Math.abs(tank.buffSpd - 0.2) < 1e-9 && !(rifle.buffSpd > 0)],
  ];
  // Daño real: el arma del Artillero con mando cerca hace 1,15 veces.
  const e = g.addUnit(1, 'rifle', cells[6]);
  const w = rifle.def.weapon;
  const m = g.dmgMult(rifle, w, e);
  rules.push(['daño ×1,15', Math.abs(m - w.mult.inf * 1.15) < 1e-9]);
  // Interferencia: un Avión de apoyo electrónico enemigo cerca de tu Torreta.
  const t = g.addBuilding(0, 'turret', near(g, h.i, 'land', 0, 12)[10], true);
  g.addUnit(1, 'ewplane', t.cell);
  run(g, 0.6);
  rules.push(['interferencia −40 %', Math.abs(t.jam - 0.4) < 1e-9]);
  ok('O08', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O09: detección y minas ----------
{
  const g = sandbox(7);
  const team0 = 1 << g.players[0].team;
  const sea = g.cells.filter((c) => c.t === 'deep' && !c.bld && g.map.dist(c, home(g)) > 8);
  const subCell = sea[0];
  const sub = g.addUnit(1, 'sub', subCell.i);
  g.updateVisibility();
  const hidden = !(sub.seenBy & team0);
  const pb = g.addUnit(0, 'patrolboat', near(g, subCell.i, 'sea', 0, 2)[1]);
  g.updateVisibility();
  const seen = !!(sub.seenBy & team0);
  // Mina: el Buque minador la siembra; un Destructor enemigo pasa y recibe 500.
  const mlCell = sea[6] || sea[3];
  const ml = g.addUnit(0, 'minelayer', mlCell.i);
  const mine = g.layMine(ml);
  const mineOk = typeof mine !== 'string';
  g.kill(pb, -1);
  ml.x += 0; g.orderMove([ml], near(g, mlCell.i, 'sea', 0, 6)[5]);
  run(g, 4);
  g.updateVisibility();
  const enemySees = mineOk && !!(mine.seenBy & (1 << g.players[1].team));
  const ds = g.addUnit(1, 'destroyer', near(g, mlCell.i, 'sea', 1, 3)[0]);
  const hp0 = ds.hp;
  run(g, 1);
  const boom = mineOk && !mine.alive && hp0 - ds.hp >= 499;
  // Dragaminas: descubre y destruye una mina enemiga.
  const g2 = sandbox(8);
  const sea2 = g2.cells.filter((c) => c.t === 'deep' && !c.bld && g2.map.dist(c, home(g2)) > 6);
  const eml = g2.addUnit(1, 'minelayer', sea2[0].i);
  const emine = g2.layMine(eml);
  g2.kill(eml, -1);
  const ms = g2.addUnit(0, 'minesweeper', near(g2, sea2[0].i, 'sea', 0, 3)[2]);
  run(g2, 8);
  const swept = typeof emine !== 'string' && !emine.alive;
  const rules = [['submarino oculto sin detector', hidden], ['la Patrullera lo descubre', seen], ['mina sembrada', mineOk],
    ['el enemigo no ve la mina', mineOk && !enemySees], ['mina explota con barco enemigo (500)', boom], ['Dragaminas la quita', swept]];
  ok('O09', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O10: transporte aéreo y paracaídas ----------
{
  const g = sandbox(7);
  const h = home(g);
  const cells = near(g, h.i, 'land', 0, 12);
  const th = g.addUnit(0, 'transheli', cells[0]);
  const rifles = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => g.addUnit(0, 'rifle', cells[k]));
  g.orderBoard(rifles, th);
  run(g, 10);
  const boarded = th.cargo.length;
  const far = g.cells.filter((c) => ctx.TERRAIN[c.t].land && !c.bld && g.map.dist(c, h) >= 8 && g.map.dist(c, h) <= 12)[0];
  g.orderMove([th], far.i);
  run(g, 12);
  const out = g.unload(th);
  const landed = Array.isArray(out) && out.length === 8 && out.every((u) => g.map.dist(g.cells[u.cell], far) <= 2);
  // Avión de transporte: bajan en paracaídas.
  const tp = g.addUnit(0, 'transportplane', far.i);
  const pr = g.addUnit(0, 'paratrooper', cells[9]);
  tp.cargo.push(pr); pr.inside = tp;
  const out2 = g.unload(tp);
  const chute = Array.isArray(out2) && out2[0].dropT > g.time;
  // Paracaidista del Cuartel con Aeropuerto: cae en el punto de reunión.
  const bar = g.buildings.find((b) => b.owner === 0 && b.type === 'barracks');
  bar.rally = far.i;
  g.players[0].coins = 500000;
  g.enqueue(bar, 'paratrooper');
  run(g, 10);
  const para = g.units.find((u) => u.type === 'paratrooper' && u !== pr && u.owner === 0);
  const dropped = !!para && g.map.dist(g.cells[para.cell], far) <= 1;
  const rules = [['8 soldados subieron', boarded === 8], ['bajaron lejos, en tierra', landed], ['del avión, en paracaídas', chute], ['Paracaidista cae en la reunión', dropped]];
  ok('O10', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O11: Búnker ----------
{
  const g = sandbox(7);
  allMine(g);
  const bk = placeAny(g, 'bunker');
  run(g, 5);
  const cells = near(g, bk.cell, 'land', 0, 6);
  const rifles = cells.slice(0, 5).map((ci) => g.addUnit(0, 'rifle', ci));
  g.orderBoard(rifles, bk);
  run(g, 8);
  const inside = bk.cargo.length;
  const e = g.addUnit(1, 'rifle', cells[5]);
  const m = g.dmgMult(bk, bk.def.weapon, e);
  const expect = bk.def.weapon.mult.inf * (1 + 4 * 0.25);
  g.kill(bk, 1);
  const alive = rifles.filter((r) => r.alive && !r.inside).length;
  const rules = [['entran 4 (no 5)', inside === 4], ['daño ×2 con 4 adentro', Math.abs(m - expect) < 1e-9], ['salen vivos al caer', alive === 5]];
  ok('O11', rules.every((r) => r[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O12: Centro de investigación ----------
{
  const g = sandbox(7, { creator: false, instantBuild: false });
  const p = g.players[0];
  const rc = g.buildings.find((b) => b.owner === 0 && b.type === 'research');
  const h = home(g);
  const cells = near(g, h.i, 'land', 0, 4);
  const tk = g.addUnit(0, 'tank', cells[0]);
  const hp0 = tk.maxHp;
  const g0 = new Game({ mode: 'sandbox', mapKind: 'archipelago', difficulty: 'normal', seed: 7 });
  const rc0 = g0.buildings.find((b) => b.owner === 0 && b.type === 'research');
  g0.players[0].coins = 100;
  const poor = g0.researchInvalid(rc0, 'armor');
  const c0 = p.coins;
  const err1 = g.startResearch(rc, 'armor');
  const c1 = p.coins;
  const busy = g.startResearch(rc, 'aim');
  run(g, RESEARCH_TIME());
  const armorOk = p.research && p.research.armor && Math.abs(tk.maxHp - hp0 * 1.1) < 1e-6;
  g.startResearch(rc, 'aim');
  run(g, RESEARCH_TIME());
  const r = g.addUnit(0, 'rifle', cells[1]);
  const e = g.addUnit(1, 'rifle', cells[2]);
  const aimOk = Math.abs(g.dmgMult(r, r.def.weapon, e) - r.def.weapon.mult.inf * 1.1) < 1e-9;
  g.startResearch(rc, 'engines');
  run(g, RESEARCH_TIME());
  const engOk = !!(p.research && p.research.engines);
  function RESEARCH_TIME() { return 46; }
  const rules = [['cuesta 2500', !err1 && Math.abs(c0 - c1 - 2500) < 1], ['una a la vez', typeof busy === 'string'],
    ['sin dinero no empieza', typeof poor === 'string'], ['Blindaje +10 % vida', armorOk], ['Puntería +10 % daño', aimOk], ['Motores lista', engOk]];
  ok('O12', rules.every((x) => x[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

// ---------- O13: Arsenal estratégico ampliado ----------
{
  const normal = new Game({ mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 7 });
  const fac = { def: BUILDINGS.factory };
  const yard = { def: BUILDINGS.shipyard };
  const hidden = !normal.producesOf(fac).includes('nukelauncher') && !normal.producesOf(yard).includes('stratsub') && !normal.buildable('silo');
  const siloErr = normal.placeInvalid(0, 'silo', normal.players[0].core.cell, true);
  const g = sandbox(7);
  allMine(g);
  const silo = placeAny(g, 'silo');
  run(g, 12);
  const early = g.siloInvalid(silo);
  run(g, 62);
  const target = g.players[1].core.cell;
  const far = g.map.dist(g.cells[target], g.cells[silo.cell]) <= NUKE_RANGE();
  function NUKE_RANGE() { return 40; }
  const res = g.launchSilo(silo, target);
  const used = g.players[0].stratUsed === 1;
  const h = home(g);
  const ml = g.addUnit(0, 'nukelauncher', near(g, h.i, 'land', 0, 2)[1]);
  ml.armAt = 0;
  const after = g.mobileNukeInvalid(ml, target);
  const ss = g.addUnit(0, 'stratsub', near(g, h.i, 'sea', 0, 1)[0]);
  ss.armAt = 0;
  const after2 = g.mobileNukeInvalid(ss);
  const rules = [['sin el modificador no aparecen', hidden && typeof siloErr === 'string'], ['silo: primero se prepara', typeof early === 'string' && early.startsWith('Preparando')],
    ['silo lanza el DF-5C', far && res === null && used], ['después, el lanzador móvil no puede (0/1)', typeof after === 'string' && after.includes('0/1')],
    ['ni el submarino estratégico', typeof after2 === 'string' && after2.includes('0/1')]];
  ok('O13', rules.every((x) => x[1]), rules.map(([n, v]) => `${n}: ${v ? 'sí' : 'NO'}`).join(' · '));
}

fs.writeFileSync(path.join(__dirname, 'results-v18-sim.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
const fails = Object.values(results).filter((r) => r.status !== 'ok').length;
console.log(`[Pruebas v1.8] ${Object.keys(results).length - fails} de ${Object.keys(results).length} aprobadas`);
