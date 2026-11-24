// Pruebas de lógica de la v0.9 (F02-F05, F06, F08-F14, F17) con el juego sin gráficos.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, BUILDINGS, UNITS } = ctx;

function mk(seed = 11, mapKind = 'continent', mode = 'duel') {
  const g = new Game({ mode, mapKind, difficulty: 'normal', seed, fog: false });
  g.bots = [];
  for (const p of g.players) { p.coins = 1e7; p.energy = 1e6; }
  return g;
}
const run = (g, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) g.update(dt); };
const spot = (g, type, near, pid = 0) => {
  const c0 = g.cells[near === undefined ? g.players[pid].core.cell : near];
  const c = g.cells.filter((x) => !g.placeInvalid(pid, type, x.i, true)).sort((a, b) => g.map.dist(a, c0) - g.map.dist(b, c0))[0];
  return c ? c.i : -1;
};
const build = (g, type, pid = 0, near) => { const ci = spot(g, type, near, pid); return ci < 0 ? null : g.addBuilding(pid, type, ci, true); };
const levelUp = (g, b, lv) => { while (b.level < lv) { b.upgrading = { level: b.level + 1, progress: 1 }; g.finishUpgrade(b); } };
const landNear = (g, ci, n = 30, pid = 0) => g.freeCellsNear(ci, 'land', pid, n);
const events = (g) => { const out = g.events.splice(0); return out; };

// ---------- F02 límites ----------
{
  const g = mk(21);
  const MAX_POP = V('MAX_POP');
  const pads = [];
  for (let i = 0; i < 6; i++) pads.push(build(g, 'helipad'));
  const seventh = g.placeInvalid(0, 'helipad', spot(g, 'barracks'), true);
  const turretsOk = BUILDINGS.turret.limit === 20;
  // Helicópteros y Apaches: sin límite propio, solo la comunidad.
  levelUp(g, g.players[0].core, 3);
  for (let i = 0; i < 12; i++) build(g, 'house');
  g.refreshEconomy();
  const res = [];
  for (let i = 0; i < 6; i++) res.push(g.enqueue(pads[i % 6], i % 2 ? 'apache' : 'heli'));
  for (let i = 0; i < 6; i++) res.push(g.enqueue(pads[i % 6], 'apache'));
  const okQueued = res.filter((r) => r === null).length;
  const why = res.find((r) => r) || '';
  // Comunidad máxima 180 aunque haya muchas Casas.
  for (const h of g.buildings.filter((b) => b.type === 'house' && b.owner === 0)) levelUp(g, h, 2);
  g.refreshEconomy();
  const cap = g.players[0].popCap;
  check('F02', 'Límites nuevos: 6 Helipuertos, 20 Torretas, helicópteros sin límite propio, comunidad hasta 180',
    BUILDINGS.helipad.limit === 6 && /Límite/.test(seventh || '') && turretsOk && !UNITS.heli.limit && !UNITS.apache.limit &&
      okQueued >= 10 && MAX_POP === 240 && cap === MAX_POP,
    `Helipuertos: 6 puestos, el 7.º dice «${seventh}»; Torretas límite ${BUILDINGS.turret.limit}; Helicóptero límite ${UNITS.heli.limit || 'ninguno'}, Apache límite ${UNITS.apache.limit || 'ninguno'}; ` +
    `${okQueued} de 12 en cola (Helicóptero y Apache, 7 Apaches) ${why ? '· el resto: «' + why + '»' : ''}; con ${g.count(0, 'house')} Casas la comunidad queda en ${cap} (máximo ${MAX_POP})`);
}

// ---------- F03 Casa, Apartamento y comunidad por bajas ----------
{
  const g = mk(22);
  const h = build(g, 'house');
  const p1 = g.bPop(h);
  events(g);
  levelUp(g, h, 2);
  const p2 = g.bPop(h);
  const ev = events(g).find((e) => e.type === 'upgraded');
  const maxLv = BUILDINGS.house.maxLevel;
  const p = g.players[0];
  g.refreshEconomy();
  const c0 = p.popCap;
  p.stats.kills += 20;
  g.refreshEconomy();
  const c1 = p.popCap;
  p.coresKilled += 1;
  g.refreshEconomy();
  const c2 = p.popCap;
  check('F03', 'Casa +10 y Apartamento (nivel 2, máximo) +20 más; comunidad extra por eliminar tropas y Núcleos',
    p1 === 10 && p2 === 30 && maxLv === 2 && ev && ev.lines.some((l) => /Apartamento/.test(l)) && c1 === c0 + 4 && c2 === c1 + 15,
    `Casa ${p1} → Apartamento ${p2} (nivel máximo ${maxLv}); tarjeta: «${ev ? ev.lines.join(' · ') : 'sin tarjeta'}»; comunidad ${c0} → ${c1} con 20 bajas → ${c2} al destruir un Núcleo`);
}

// ---------- F04 escudos ----------
{
  const g = mk(23);
  const types = ['house', 'farm', 'barracks', 'turret', 'aadef', 'wall', 'helipad'];
  const shields = types.map((t) => { const b = build(g, t); return b ? `${BUILDINGS[t].name}:${b.shieldMax}` : `${t}:sin lugar`; });
  const allHave = g.buildings.filter((b) => b.owner === 0).every((b) => b.shieldMax > 0);
  const bar = g.buildings.find((b) => b.type === 'barracks');
  const enemy = g.addUnit(1, 'tank', landNear(g, g.players[1].core.cell, 5, 1)[0]);
  const hp0 = bar.hp; const sh0 = bar.shield;
  g.damage(bar, 100, 1, enemy);
  const absorbed = bar.hp === hp0 && Math.abs(bar.shield - (sh0 - 100)) < 1e-6;
  g.damage(bar, sh0, 1, enemy);
  const through = bar.hp < hp0 && bar.shield === 0;
  // Escudo de las tropas: solo dentro de la Cúpula nivel 3.
  const core = g.players[0].core;
  levelUp(g, core, 3);
  for (let i = 0; i < 3; i++) g.buyDome(0);
  const inC = landNear(g, core.cell, 6)[2];
  const R = V('DOME_LEVELS')[3].range;
  const outC = g.cells.filter((c) => !V('TERRAIN')[c.t].water && g.map.dist(c, g.cells[core.cell]) === R + 3 && g.passable(c, 'land', 0))[0].i;
  const uin = g.addUnit(0, 'rifle', inC);
  const uout = g.addUnit(0, 'rifle', outC);
  run(g, 0.5);
  const inside = uin.shieldMax > 0 && g.unitShielded(uin);
  const outside = !g.unitShielded(uout) && !(uout.shieldMax > 0);
  // Sale de la Cúpula: pierde el escudo.
  uin.x = uout.x; uin.z = uout.z; uin.cell = uout.cell; uin.path = [];
  run(g, 0.3);
  const lost = !(uin.shieldMax > 0);
  check('F04', 'El escudo de las tropas solo dentro de la Cúpula; cada edificio con su escudo',
    allHave && absorbed && through && inside && outside && lost && g.players[0].dome.level === 3,
    `escudos: ${shields.join(', ')}; todos los edificios con escudo: ${allHave}; 100 de daño al Cuartel van al escudo (${sh0} → ${Math.round(sh0 - 100)}) y la vida sigue en ${hp0}; ` +
    `al romperse el escudo baja la vida (${Math.round(bar.hp)}). Cúpula nivel ${g.players[0].dome.level} (${R} casillas): Fusilero dentro con escudo ${Math.round(uin.shieldMax || 0) || 'sí'}=${inside}, fuera sin escudo=${outside}, al salir lo pierde=${lost}`);
}

// ---------- F05 reparación de aeronaves ----------
{
  const g = mk(24);
  const pad = build(g, 'helipad');
  const far = g.cells.filter((c) => g.map.dist(c, g.cells[pad.cell]) === 9)[0].i;
  const h = g.addUnit(0, 'heli', far);
  h.hp = h.maxHp * 0.25;
  const air = build(g, 'airport');
  const ap = g.cells.filter((c) => g.map.dist(c, g.cells[air.cell]) === 6 && g.map.dist(c, g.cells[pad.cell]) > 8)[0];
  const f = g.addUnit(0, 'fighter', ap ? ap.i : far);
  f.hp = f.maxHp * 0.2;
  const d0 = Math.hypot(h.x - pad.x, h.z - pad.z);
  let back = null; let full = null;
  for (let t = 0; t < 150; t += 0.1) {
    g.update(0.1);
    if (back === null && Math.hypot(h.x - pad.x, h.z - pad.z) < 2) back = g.time;
    if (full === null && h.hp >= h.maxHp * 0.95) full = g.time;
  }
  const fHeal = f.hp / f.maxHp;
  check('F05', 'Helipuerto y Aeropuerto reparan aeronaves; con poca vida vuelven solas',
    back !== null && full !== null && fHeal > 0.9,
    `Helicóptero al 25 % a ${d0.toFixed(1)} de distancia: llegó al Helipuerto a los ${back === null ? '—' : back.toFixed(0)} s y quedó reparado (95 %) a los ${full === null ? '—' : full.toFixed(0)} s; ` +
    `Caza al 20 %: con el Aeropuerto llega al ${Math.round(fHeal * 100)} %`);
}

// ---------- F06 tarjeta «Qué mejoró» y efectos ----------
{
  const g = mk(25);
  const rows = [];
  let ok = true;
  for (const t of ['farm', 'barracks', 'turret', 'hospital', 'aadef']) {
    const b = build(g, t);
    if (!b) { ok = false; rows.push(`${t}: sin lugar`); continue; }
    const before = g.snapshot(b);
    const prev = g.upgradePreview(b);
    events(g);
    levelUp(g, b, b.level + 1);
    const after = g.snapshot(b);
    const ev = events(g).find((e) => e.type === 'upgraded');
    const better = after.hp > before.hp && (after.income >= before.income) && (after.dmg >= before.dmg);
    const same = ev && JSON.stringify(ev.lines) === JSON.stringify(prev);
    if (!(ev && ev.lines.length >= 2 && better && same)) ok = false;
    rows.push(`${BUILDINGS[t].name}: «${ev ? ev.lines.join(' · ') : '—'}»${same ? '' : ' (no coincide con la vista previa)'}`);
  }
  check('F06', 'Cada mejora muestra la tarjeta «Qué mejoró» y sus efectos se cumplen', ok, rows.join('; '));
}

// ---------- F08 aeropuerto, caza y bombardero furtivo ----------
{
  const g = mk(26);
  const air = build(g, 'airport');
  const q1 = g.enqueue(air, 'fighter');
  const q2 = g.enqueue(air, 'bomber');
  run(g, 70);
  const f = g.units.find((u) => u.type === 'fighter' && u.owner === 0);
  const b = g.units.find((u) => u.type === 'bomber' && u.owner === 0);
  // Furtivo: una AIR DEFENSE enemiga solo lo ve a 3 casillas o menos.
  const aad = build(g, 'aadef', 1);
  const w = g.weaponOf(aad);
  const cAad = g.cells[aad.cell];
  const at = (d) => g.cells.find((c) => g.map.dist(c, cAad) === d);
  let farSeen = null; let nearSeen = null;
  if (b) {
    const put = (c) => { b.x = c.x; b.z = c.z; b.cell = c.i; b.path = []; b.state = 'idle'; b.lastShot = -99; };
    put(at(5)); g.updateStealth(); farSeen = g.canAttack(aad, w, b);
    put(at(2)); g.updateStealth(); nearSeen = g.canAttack(aad, w, b);
  }
  check('F08', 'Aeropuerto, Caza y Bombardero furtivos funcionan (el bombardero solo se ve de cerca)',
    q1 === null && q2 === null && f && b && UNITS.bomber.stealth && farSeen === false && nearSeen === true,
    `Aeropuerto entrena Caza (${f ? 'listo' : 'no'}) y Bombardero (${b ? 'listo' : 'no'}); AIR DEFENSE enemiga: a 5 casillas lo puede atacar=${farSeen}, a 2 casillas=${nearSeen}`);
}

// ---------- F09 portaaviones, fragata y lancha ----------
{
  const g = mk(27, 'archipelago', 'duel');
  const sea = g.cells.filter((c) => V('TERRAIN')[c.t].water && g.passable(c, 'sea', 0)).sort((a, b) => g.map.dist(a, g.cells[g.players[0].core.cell]) - g.map.dist(b, g.cells[g.players[0].core.cell]));
  const carrier = g.addUnit(0, 'carrier', sea[3].i);
  const fighters = [0, 1, 2, 3, 4].map((k) => g.addUnit(0, 'fighter', sea[6 + k].i));
  fighters[0].hp = fighters[0].maxHp * 0.5;
  const boarded = fighters.map((f) => (g.canBoard(f, carrier) ? g.board(f, carrier) : false));
  const nIn = carrier.cargo.length;
  const h0 = fighters[0].hp;
  run(g, 5);
  const healed = fighters[0].hp > h0;
  const un = g.unload(carrier);
  const out = fighters.filter((f) => !f.inside).length;
  const lander = g.addUnit(0, 'lander', sea[12].i);
  const inf = Array.from({ length: 11 }, (_, k) => g.addUnit(0, 'rifle', landNear(g, g.players[0].core.cell, 20)[k]));
  const tank = g.addUnit(0, 'tank', landNear(g, g.players[0].core.cell, 20)[12]);
  let nL = 0; for (const u of inf) if (g.canBoard(u, lander) && g.board(u, lander)) nL++;
  const frigate = g.addUnit(0, 'frigate', sea[20].i);
  const fw = UNITS.frigate.weapon;
  const enemyHeli = g.addUnit(1, 'heli', sea[22].i);
  const canAA = g.canAttack(frigate, fw, enemyHeli) || (UNITS.frigate.missile && g.canAttack(frigate, UNITS.frigate.missile, enemyHeli));
  check('F09', 'Portaaviones lleva y repara Cazas; Fragata y Lancha de desembarco funcionan',
    nIn === 4 && boarded[4] === false && healed && out === 5 && nL === 10 && UNITS.lander.capacity === 10 && canAA,
    `Portaaviones: ${nIn} Cazas adentro (el 5.º no entra), el Caza herido se repara dentro (${Math.round(h0)} → ${Math.round(fighters[0].hp)}), al lanzar quedan ${out} en el aire; ` +
    `Lancha de desembarco: ${nL} soldados (capacidad ${UNITS.lander.capacity}); Fragata ataca aeronaves=${!!canAA}`);
}

// ---------- F10 fábrica, cuartel, transporte y médico ----------
{
  const g = mk(28);
  const fac = build(g, 'factory');
  const bar = build(g, 'barracks');
  const fNew = ['lighttank', 'heavytank', 'missiletruck', 'apc', 'launcher'].filter((t) => BUILDINGS.factory.produces.includes(t));
  const res = fNew.map((t) => g.enqueue(fac, t));
  const med = g.enqueue(bar, 'medic');
  run(g, 120);
  const made = fNew.filter((t) => g.units.some((u) => u.type === t && u.owner === 0));
  const cells = landNear(g, g.players[0].core.cell, 30);
  const jeep = g.addUnit(0, 'jeep', cells[20]);
  const apc = g.addUnit(0, 'apc', cells[21]);
  const sold = Array.from({ length: 11 }, (_, k) => g.addUnit(0, 'rifle', cells[k]));
  let j = 0; let a = 0;
  for (const s of sold.slice(0, 5)) if (g.canBoard(s, jeep) && g.board(s, jeep)) j++;
  for (const s of sold.slice(5, 11)) if (g.canBoard(s, apc) && g.board(s, apc)) a++;
  const tankNo = g.canBoard(g.addUnit(0, 'tank', cells[22]), apc);
  const medic = g.units.find((u) => u.type === 'medic' && u.owner === 0) || g.addUnit(0, 'medic', cells[23]);
  const hurt = g.addUnit(0, 'rifle', cells[24]);
  hurt.x = medic.x + 0.6; hurt.z = medic.z; hurt.cell = medic.cell;
  hurt.hp = hurt.maxHp * 0.3; hurt.lastHit = -99;
  const hh0 = hurt.hp;
  run(g, 5);
  check('F10', 'Fábrica y Cuartel con sus unidades nuevas; Jeep y Transporte llevan soldados; el Médico cura',
    made.length === 5 && med === null && j === 4 && a === 6 && !tankNo && hurt.hp > hh0 + hurt.maxHp * 0.1,
    `Fábrica entrenó ${made.join(', ')} (${made.length} de 5); Cuartel: Médico ${med === null ? 'en cola' : med}; Jeep llevó ${j} (máx. 4), Transporte ${a} (máx. 6), tanque al Transporte=${tankNo}; ` +
    `el Médico curó a un Fusilero del ${Math.round((hh0 / hurt.maxHp) * 100)} % al ${Math.round((hurt.hp / hurt.maxHp) * 100)} % en 5 s`);
}

// ---------- F11 torreta nivel 4 ----------
{
  const g = mk(29);
  const t = build(g, 'turret');
  levelUp(g, t, 4);
  const w = g.weaponOf(t);
  const cT = g.cells[t.cell];
  const hc = g.cells.find((c) => g.map.dist(c, cT) === 2);
  const heli = g.addUnit(1, 'heli', hc.i);
  heli.hp = heli.maxHp = 1e6;
  const shots = {};
  const of = g.fire.bind(g);
  g.fire = (a, ww, tt, gun) => { if (a === t) shots[gun || 0] = (shots[gun || 0] || 0) + 1; return of(a, ww, tt, gun); };
  run(g, 6);
  const guns = Object.keys(shots).filter((k) => k !== '0').length;
  const t3 = build(g, 'turret');
  levelUp(g, t3, 3);
  check('F11', 'Torreta nivel 4 con 3 miniguns y tiro antiaéreo',
    guns === 3 && w.mult.air > g.weaponOf(t3).mult.air * 2 && w.dmg > g.weaponOf(t3).dmg && heli.hp < 1e6,
    `nivel 4: cañón con daño a aeronaves ×${w.mult.air} (nivel 3: ×${g.weaponOf(t3).mult.air}), daño ${Math.round(w.dmg)} (nivel 3: ${Math.round(g.weaponOf(t3).dmg)}); disparos en 6 s por arma ${JSON.stringify(shots)} (3 miniguns: ${guns === 3}); el helicóptero recibió ${Math.round(1e6 - heli.hp)} de daño`);
}

// ---------- F12 misil nuclear ----------
{
  const g = mk(30);
  const NUKE = V('NUKE');
  const a = [];
  for (let i = 0; i < 4; i++) a.push(build(g, 'aadef'));
  for (let i = 0; i < 3; i++) levelUp(g, a[i], 4);
  levelUp(g, a[3], 3);
  const fourth = g.upgradeInvalid(a[3]);
  const p = g.players[0];
  const enemyCore = g.players[1].core;
  const ec = g.cells[enemyCore.cell];
  const target = g.cells.filter((c) => g.map.dist(c, ec) === 1)[0];
  // Escudo antimisiles enemigo cerca del blanco: derriba el primero.
  const shield = build(g, 'antinuke', 1, enemyCore.cell);
  const coins0 = p.coins;
  events(g);
  const r1 = g.launchNuke(a[0], target.i);
  const paid = coins0 - p.coins;
  const warn = events(g).filter((e) => e.type === 'toast').map((e) => e.text);
  const again = g.nukeInvalid(a[0], target.i);
  run(g, NUKE.flight + 1);
  const intercepted = g.nukesIntercepted || 0;
  const hpAfterShield = enemyCore.hp;
  // Segundo misil desde otro AIR DEFENSE: el escudo está recargando y el misil cae.
  const hp0 = enemyCore.hp;
  const near = g.addUnit(1, 'tank', g.cells.filter((c) => g.map.dist(c, target) === 1 && g.passable(c, 'land', 1))[0].i);
  const r2 = g.launchNuke(a[1], target.i);
  run(g, NUKE.flight + 1);
  const dmg = hp0 - enemyCore.hp;
  p.coins = 100;
  const poor = g.nukeInvalid(a[2], target.i);
  const ok = !!fourth && paid === NUKE.cost && NUKE.cooldown === 180 && /Recargando/.test(again || '') && warn.length > 0 &&
    intercepted === 1 && hpAfterShield === hp0 && (typeof r2 !== 'string') && dmg > 0 && !near.alive && /Monedas/.test(poor || '');
  check('F12', 'Misil nuclear: solo 3 AIR DEFENSE de nivel 4, costo, recarga de 3 min, aviso, daño en área y Escudo antimisiles que lo derriba', ok,
    `4.º a nivel 4: «${fourth}»; cuesta ${paid} (precio ${NUKE.cost}); después: «${again}» (recarga ${NUKE.cooldown} s); aviso: «${warn[0] || '—'}»; ` +
    `el Escudo antimisiles derribó ${intercepted} (Núcleo enemigo intacto: ${hpAfterShield === hp0}); el segundo cayó: Núcleo −${Math.round(dmg)}, tanque al lado destruido=${!near.alive}; sin dinero: «${poor}»`);
}

// ---------- F13 todas las tropas armadas dañan edificios ----------
{
  const armed = Object.entries(UNITS).filter(([, u]) => u.weapon);
  const none = armed.filter(([, u]) => !(u.weapon.mult.bld > 0)).map(([k]) => k);
  const g = mk(31);
  const ec = g.players[1].core;
  const cells = g.cells.filter((c) => g.map.dist(c, g.cells[ec.cell]) === 2 && g.passable(c, 'land', 0));
  const rows = [];
  for (const k of ['rifle', 'sniper', 'medic', 'jeep', 'lighttank', 'aa']) {
    if (!UNITS[k] || !UNITS[k].weapon) continue;
    const u = g.addUnit(0, k, cells[rows.length % cells.length].i);
    rows.push(`${UNITS[k].name}:${g.canAttack(u, UNITS[k].weapon, ec) ? 'sí' : 'no'}`);
  }
  check('F13', 'Todas las tropas armadas dañan edificios y Núcleos', none.length === 0 && rows.every((r) => r.endsWith('sí')),
    `${armed.length} tropas armadas, sin daño a edificios: ${none.length ? none.join(', ') : 'ninguna'}; atacan al Núcleo enemigo: ${rows.join(', ')}`);
}

// ---------- F14 helicópteros: armas y precios ----------
{
  const g = mk(32);
  const H = UNITS.heli; const A = UNITS.apache;
  const cells = landNear(g, g.players[0].core.cell, 20);
  const heli = g.addUnit(0, 'heli', cells[5]);
  const apache = g.addUnit(0, 'apache', cells[6]);
  const tank = g.addUnit(1, 'tank', cells[8]);
  tank.hp = tank.maxHp = 1e6;
  run(g, 4);
  const kinds = new Set();
  for (let t = 0; t < 8; t += 0.1) { g.update(0.1); if (g.time - (apache.lastShot || -99) < 0.15) kinds.add(apache.lastShotKind); if (g.time - (heli.lastShot || -99) < 0.15) kinds.add('heli:' + heli.lastShotKind); }
  check('F14', 'Helicóptero y Apache con sus armas y precios nuevos; se sabe cuándo disparan y lanzan misiles',
    H.cost === 7500 && A.cost === 10000 && A.hp > H.hp && A.weapon.dmg > H.weapon.dmg && A.missile && A.flares && H.gun && kinds.size >= 2,
    `Helicóptero ${H.cost} (vida ${H.hp}, cohetes ${H.weapon.dmg} + ametralladora de puerta), Apache ${A.cost} (vida ${A.hp}, cohetes ${A.weapon.dmg}, cañón, misiles ${A.missile.dmg}, ${A.flares} bengalas); disparos vistos: ${[...kinds].join(', ')}`);
}

// ---------- F17 tierra fértil más grande ----------
{
  const rows = [];
  let ok = true;
  for (const [mapKind, seed] of [['continent', 3], ['archipelago', 4], ['open', 5]]) {
    const g = mk(seed, mapKind, 'ffa');
    const counts = g.players.map((p) => g.cells.filter((c) => c.t === 'fertile' && g.map.dist(c, g.cells[p.core.cell]) <= 4).length);
    if (Math.min(...counts) < 8) ok = false;
    rows.push(`${mapKind}: ${counts.join(', ')}`);
  }
  check('F17', 'Tierra fértil en zonas más grandes (casillas fértiles a 4 casillas de cada Núcleo; antes 3 a 5)', ok, rows.join(' · ') + ` · Granjas por imperio: ${BUILDINGS.farm.limit}`);
}

fs.writeFileSync(__dirname + '/results-v09-sim-on-v10.json', JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
