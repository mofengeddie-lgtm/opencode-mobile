// D01-D03 y D05-D11 del PRD v0.7 en Chromium (iPad horizontal, toques simulados).
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };

async function open(browser, w = 1180, h = 820) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('faro-profile-v1'); Profile.load(); Creator.owner = false; FARO.lobby.render(); });
  return page;
}

// Empieza una misión desde el vestíbulo y toca «¡A jugar!».
async function mission(page, id) {
  await page.evaluate((n) => { FARO.toMenu(); FARO.abandonGame(); FARO.lobby.sub = 'campaign'; FARO.lobby.render(); }, id);
  await page.click(`#btn-mission-${id}`);
  await page.waitForSelector('#brief:not([hidden])');
  await page.click('#btn-brief-go');
  await page.waitForFunction(() => !FARO.paused);
}

// Gana la misión 1 de forma limpia: 2 Granjas y 5 Artilleros nuevos.
const WIN1 = () => {
  const g = FARO.game;
  const cells = g.cells.filter((c) => c.owner === 0 && c.t === 'fertile' && !c.bld).slice(0, 2);
  cells.forEach((c) => g.addBuilding(0, 'farm', c.i, true));
  g.refreshEconomy();
  g.freeCellsNear(g.players[0].core.cell, 'land', 0, 5).forEach((ci) => g.addUnit(0, 'rifle', ci));
  FARO.ui.renderMission(true);
  return document.getElementById('objlist').innerText;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await open(browser);

  // ---------- D01 vestíbulo ----------
  await page.click('[data-sub="campaign"]');
  const d01 = await page.evaluate(() => {
    const cards = document.querySelectorAll('.mcard').length;
    const btns = [...document.querySelectorAll('[data-act="mission"]')].map((b) => b.dataset.v);
    const locks = [...document.querySelectorAll('.mlock')].map((x) => x.textContent);
    Creator.owner = true; Profile.data.creator.on = true; FARO.lobby.render();
    const btnsC = [...document.querySelectorAll('[data-act="mission"]')].map((b) => b.dataset.v);
    Creator.owner = false; FARO.lobby.render();
    const menu = document.querySelector('[data-sub="campaign"]').innerText.replace(/\s+/g, ' ');
    return { cards, btns, locks, btnsC, menu };
  });
  await page.screenshot({ path: SP + '/shots/v07-d01.png' });
  check('D01', 'El vestíbulo muestra la Campaña con 6 misiones; solo la primera abierta (todas en modo creador)',
    d01.cards === 6 && d01.btns.join() === '1' && d01.locks.length === 5 && d01.btnsC.join() === '1,2,3,4,5,6',
    `menú «${d01.menu}»; ${d01.cards} misiones; abiertas: ${d01.btns.join(',')}; cerradas con aviso: ${d01.locks.length} («${d01.locks[0]}»); modo creador: ${d01.btnsC.join(',')}`);

  // ---------- D02 preparación de cada misión ----------
  const d02 = [];
  for (let id = 1; id <= 6; id++) {
    await page.evaluate(() => { Profile.data.campaign.done = { 1: true, 2: true, 3: true, 4: true, 5: true }; });
    await page.evaluate((n) => { FARO.toMenu(); FARO.abandonGame(); FARO.startMission(n); }, id);
    await page.waitForSelector('#brief:not([hidden])');
    const info = await page.evaluate((n) => {
      const g = FARO.game;
      const m = Campaign.def(n);
      const blds = (pid) => { const o = {}; g.buildings.filter((b) => b.owner === pid).forEach((b) => { const k = b.type + (b.level > 1 ? b.level : ''); o[k] = (o[k] || 0) + 1; }); return o; };
      const units = (pid) => { const o = {}; g.units.filter((u) => u.owner === pid).forEach((u) => { o[u.type] = (o[u.type] || 0) + 1; }); return o; };
      const guarded = g.points.filter((pt) => pt.type === 'flag' && pt.owner === 1 && g.units.some((u) => u.owner === 1 && Math.hypot(u.x - pt.x, u.z - pt.z) < 4)).length;
      const faro = g.points.find((pt) => pt.type === 'faro');
      const faroGuards = faro.owner === 1 ? g.units.filter((u) => u.owner === 1 && Math.hypot(u.x - faro.x, u.z - faro.z) < 4).length : 0;
      return {
        map: g.map.kind, want: m.mapKind, players: g.players.length, personas: g.players.slice(1).map((p) => p.persona).join(','),
        coins: Math.round(g.players[0].coins), me: blds(0), meU: units(0), bot: blds(1), botU: units(1), passive: g.bots.every((b) => !!b.passive),
        wave: Math.round(g.bots[0].nextWaveAt), guarded, faroGuards, paused: FARO.paused, brief: document.querySelector('#brief h2').textContent,
      };
    }, id);
    let ok = info.map === info.want && info.paused && info.brief.length > 0;
    let ev = `M${id} ${info.map}, ${info.players} imperios (${info.personas})`;
    if (id === 1) { ok = ok && info.passive; ev += ', vecino tranquilo'; }
    if (id === 2) { ok = ok && info.coins === 4000 && info.me.turret === 1 && info.bot.harbor === 1 && info.botU.speedboat === 2 && info.wave >= 100 && info.wave <= 116; ev += `, 4.000 monedas y Torreta; Almirante con Puerto, ${info.botU.speedboat} Lanchas y ${info.botU.rifle} Artilleros; primera oleada ~${info.wave} s`; }
    if (id === 3) { ok = ok && info.personas === 'keeper' && info.meU.rifle === 3 && info.faroGuards === 4; ev += `, tus 3 Artilleros; el Guardián del Faro empieza con el Faro y ${info.faroGuards} guardias`; }
    if (id === 4) { ok = ok && info.me.harbor === 1 && info.meU.barge === 1 && info.guarded === 2; ev += `, tu Puerto y Barcaza listos; ${info.guarded} Banderas con guardias`; }
    if (id === 5) { ok = ok && info.coins === 8000 && info.bot.core2 === 1 && info.bot.wall >= 4 && info.bot.turret3 === 1 && info.bot.turret2 === 2 && info.bot.aadef === 1; ev += `, 8.000 monedas; rival: Núcleo nivel 2, ${info.bot.wall} muros, Torreta nivel 3, 2 de nivel 2 y AIR DEFENSE`; }
    if (id === 6) { ok = ok && info.players === 4 && info.coins === 4000; ev += ', 4.000 monedas'; }
    d02.push({ ok, ev });
    if (id === 5) await page.screenshot({ path: SP + '/shots/v07-brief5.png' });
  }
  await page.evaluate(() => { Profile.data.campaign.done = {}; Profile.save(); });
  check('D02', 'Cada misión arranca con su mapa, rivales y preparación', d02.every((x) => x.ok), d02.map((x) => x.ev).join(' · '));

  // ---------- D03 + D05 + D06: misión 1 ----------
  await mission(page, 1);
  const before = await page.evaluate(() => ({ crystals: Profile.data.crystals, panel: document.getElementById('objlist').innerText.replace(/\n/g, ' | ') }));
  const after = await page.evaluate(WIN1);
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  await page.screenshot({ path: SP + '/shots/v07-end1.png' });
  const end1 = await page.evaluate(() => ({
    title: document.querySelector('#enddialog h2').textContent, stars: document.querySelectorAll('#enddialog .bigstars i.on').length,
    next: !!document.getElementById('btn-next'), reward: FARO.game.reward.camp, crystals: Profile.data.crystals,
    result: FARO.game.result, saved: JSON.parse(localStorage.getItem('faro-profile-v1')).campaign,
  }));
  check('D03', 'Los objetivos se ven en el panel con su progreso y la misión se gana al cumplirlos',
    /Ingresos: 1140 \/ 1600/.test(before.panel) && /Tropas de combate: 0 \/ 5/.test(before.panel) && /1620 \/ 1600/.test(after) && /5 \/ 5/.test(after) && end1.result === 'victory' && end1.title === '¡Misión cumplida!',
    `al empezar: «${before.panel}»; con 2 Granjas y 5 Artilleros: «${after.replace(/\n/g, ' | ')}» → ${end1.title}`);

  // ---------- D05 estrellas y motivos ----------
  // Misión 2: termina con el Núcleo al 40 % y 4 edificios perdidos.
  await page.evaluate(() => { FARO.toMenu(); });
  await mission(page, 2);
  await page.evaluate(() => {
    const g = FARO.game;
    const core = g.players[0].core;
    g.freeCellsNear(core.cell, 'land', 0, 8).filter((ci) => !g.cells[ci].bld && TERRAIN[g.cells[ci].t].land).slice(0, 3).forEach((ci) => g.addBuilding(0, 'wall', ci, true));
    g.buildings.filter((b) => b.owner === 0 && b.type !== 'core').slice(0, 4).forEach((b) => g.kill(b, 1));
    core.hp = core.maxHp * 0.4;
    g.time = 359.8;
  });
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  const end2 = await page.evaluate(() => ({ stars: document.querySelectorAll('#enddialog .bigstars i.on').length, list: document.querySelector('#enddialog .starlist').innerText.replace(/\n/g, ' ') }));
  await page.screenshot({ path: SP + '/shots/v07-end2.png' });
  // Misión 3: gana pasado el tiempo y con 7 tropas perdidas.
  await page.evaluate(() => { FARO.toMenu(); });
  await mission(page, 3);
  await page.evaluate(() => {
    const g = FARO.game;
    const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 7);
    sp.map((ci) => g.addUnit(0, 'rifle', ci)).forEach((u) => g.kill(u, 1));
    g.time = 500;
    g.camp.faroHold = 59.9;
    const faro = g.points.find((p) => p.type === 'faro');
    faro.owner = 0; faro.prog = 1;
  });
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  const end3 = await page.evaluate(() => ({ stars: document.querySelectorAll('#enddialog .bigstars i.on').length, list: document.querySelector('#enddialog .starlist').innerText.replace(/\n/g, ' '), reward: FARO.game.reward.camp }));
  check('D05', 'Estrellas según cada condición; la pantalla final explica las que faltaron',
    end1.stars === 3 && end2.stars === 1 && /terminó al 40 %/.test(end2.list) && /Perdiste 4 edificios/.test(end2.list) &&
    end3.stars === 1 && /Tardaste 08:2/.test(end3.list) && /Perdiste 7 tropas/.test(end3.list),
    `M1 perfecta: ${end1.stars}★ · M2 «${end2.list}» → ${end2.stars}★ · M3 «${end3.list}» → ${end3.stars}★`);

  // ---------- D06 premios una sola vez, siguiente misión abierta y progreso guardado ----------
  await page.evaluate(() => { FARO.toMenu(); });
  const c0 = await page.evaluate(() => Profile.data.crystals);
  await mission(page, 1);
  await page.evaluate(WIN1);
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  const rep = await page.evaluate(() => ({ reward: FARO.game.reward.camp, gained: FARO.game.reward.crystals }));
  // Mejorar estrellas: la misión 3 se repite perfecta (de 1 a 3 estrellas = +40).
  await page.evaluate(() => { FARO.toMenu(); });
  await mission(page, 3);
  await page.evaluate(() => { const g = FARO.game; g.camp.faroHold = 59.9; const f = g.points.find((p) => p.type === 'faro'); f.owner = 0; f.prog = 1; });
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  const up = await page.evaluate(() => FARO.game.reward.camp);
  await page.click('#btn-menu');
  await page.evaluate(() => { FARO.lobby.sub = 'campaign'; FARO.lobby.render(); });
  const lob = await page.evaluate(() => ({ open: [...document.querySelectorAll('[data-act="mission"]')].map((b) => b.dataset.v).join(','), stored: localStorage.getItem('faro-profile-v1') }));
  const stored = JSON.parse(lob.stored).campaign;
  await page.screenshot({ path: SP + '/shots/v07-d06.png' });
  check('D06', 'Premio de primera vez y por estrella nueva una sola vez; la siguiente misión se abre y el progreso se guarda',
    end1.reward.first === 50 && end1.reward.newStars === 3 && rep.reward.first === 0 && rep.reward.newStars === 0 && end3.reward.first === 100 && end3.reward.newStars === 1 &&
    up.first === 0 && up.newStars === 2 && lob.open === '1,2,3,4' && stored.done['1'] && stored.stars['1'] === 3 && stored.stars['3'] === 3,
    `M1 primera vez: +${end1.reward.first} y ${end1.reward.newStars} estrellas nuevas (+${end1.reward.newStars * 20}); M1 repetida: primera vez +${rep.reward.first}, estrellas nuevas ${rep.reward.newStars} (solo los cristales normales: +${rep.gained}); M3 de 1★ a 3★: +${up.newStars * 20}; abiertas: ${lob.open}; guardado: ${JSON.stringify(stored)}`);

  // ---------- controles (misión 1, vecino tranquilo) ----------
  await mission(page, 1);
  const setup = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.players[0].core;
    const sp = g.freeCellsNear(core.cell, 'land', 0, 8);
    window.T = sp.slice(0, 6).map((ci) => g.addUnit(0, 'rifle', ci));
    FARO.setSelection(T.slice(0, 4));
    return T.length;
  });
  // D07 grupos
  await page.click('#selpanel [data-act="savegrp"][data-v="1"]');
  const g1 = await page.evaluate(() => { const n = FARO.groups[1].length; FARO.setSelection([]); return { n, dock: document.getElementById('grp1').textContent }; });
  await page.click('[data-group="1"]');
  const sel1 = await page.evaluate(() => { FARO.renderer.cam.tx = -30; FARO.renderer.cam.tz = -30; return FARO.selection.length; });
  await page.waitForTimeout(500);
  // Dos toques seguidos (el emulador es lento: se tocan desde la página para que lleguen en menos de 0,45 s).
  await page.evaluate(() => { const b = document.querySelector('[data-group="1"]'); b.click(); b.click(); });
  const cam = await page.evaluate(() => { const c = FARO.renderer.cam; let x = 0; let z = 0; T.slice(0, 4).forEach((u) => { x += u.x; z += u.z; }); return { d: Math.hypot(c.tx - x / 4, c.tz - z / 4) }; });
  await page.evaluate(() => FARO.setSelection(T.slice(4, 6)));
  await page.keyboard.press('Shift+Digit2');
  await page.evaluate(() => FARO.setSelection(T.slice(0, 1)));
  await page.keyboard.press('Control+Digit3');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Digit2');
  const keys = await page.evaluate(() => ({ g2: FARO.groups[2].length, g3: FARO.groups[3].length, sel: FARO.selection.map((u) => u.id).join(), want: T.slice(4, 6).map((u) => u.id).join() }));
  check('D07', 'Grupos 1-2-3: guardar, elegir y doble toque para ir con la cámara (también con teclado)',
    g1.n === 4 && g1.dock === '4' && sel1 === 4 && cam.d < 1 && keys.g2 === 2 && keys.g3 === 1 && keys.sel === keys.want,
    `«Guardar en 1» con 4 tropas → grupo 1 = ${g1.n} (botón muestra ${g1.dock}); tocar 1 elige ${sel1}; dos toques: cámara a ${cam.d.toFixed(2)} del grupo; Mayús+2 guarda ${keys.g2}, Ctrl+3 guarda ${keys.g3}; tecla 2 elige el grupo 2: ${keys.sel === keys.want}`);

  // D08 avanzar atacando
  const d08prep = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.cells[g.players[0].core.cell];
    // Destino a ~9 casillas, y dos enemigos a mitad de camino.
    const dest = g.cells.filter((c) => g.passable(c, 'land', 0) && g.map.dist(c, core) === 9 && c.comp === core.comp)[0];
    const mid = g.cells.filter((c) => g.passable(c, 'land', 1) && g.map.dist(c, core) === 5 && g.map.dist(c, dest) === 4)[0];
    window.E = [g.addUnit(1, 'rifle', mid.i), g.addUnit(1, 'rifle', mid.i)];
    E.forEach((u) => { u.state = 'idle'; });
    FARO.setSelection(T.slice(0, 4));
    window.DEST = dest.i;
    const r = FARO.renderer;
    r.cam.tx = (core.x + dest.x) / 2; r.cam.tz = (core.z + dest.z) / 2; r.cam.dist = 40; r.updateCamera();
    return true;
  });
  await page.click('#btn-amove');
  const armed = await page.evaluate(() => ({ arm: FARO.input.amoveArm, label: document.getElementById('btn-amove').textContent }));
  const pt = await page.evaluate(() => { const c = FARO.game.cells[DEST]; FARO.renderer.updateCamera(); const s = FARO.renderer.project(c.x, c.h, c.z); return s; });
  await page.mouse.click(pt.x, pt.y);
  const d08 = await page.evaluate(() => {
    const g = FARO.game;
    const units = T.slice(0, 4);
    const states = new Set(units.map((u) => u.state));
    let fought = false;
    for (let i = 0; i < 900; i++) {
      g.update(0.1);
      if (units.some((u) => u.state === 'attack')) fought = true;
      if (E.every((e) => !e.alive) && units.every((u) => !u.alive || u.state === 'idle')) break;
    }
    const alive = units.filter((u) => u.alive);
    const near = alive.filter((u) => g.map.dist(g.cells[u.cell], g.cells[DEST]) <= 2).length;
    return { states: [...states].join(','), fought, enemies: E.filter((e) => e.alive).length, alive: alive.length, near, t: Math.round(g.time) };
  });
  check('D08', 'Avanzar atacando: las tropas pelean con lo que encuentran en el camino y siguen hasta el destino',
    armed.arm && /destino/.test(armed.label) && d08.states === 'amove' && d08.fought && d08.enemies === 0 && d08.near === d08.alive && d08.alive > 0,
    `botón «${armed.label}»; tras tocar el mapa: estado ${d08.states}; pelearon: ${d08.fought}; enemigos vivos: ${d08.enemies}; ${d08.near} de ${d08.alive} tropas llegaron a 2 casillas del destino`);

  // D09 formación en línea
  const d09 = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.cells[g.players[0].core.cell];
    const units = T.filter((u) => u.alive);
    // Junta a las tropas cerca del Núcleo.
    const sp = g.freeCellsNear(core.i, 'land', 0, units.length);
    units.forEach((u, k) => { const c = g.cells[sp[k]]; u.cell = c.i; u.x = c.x; u.z = c.z; u.state = 'idle'; u.path = []; });
    FARO.setSelection(units);
    return units.length;
  });
  await page.click('#btn-formation');
  const formLabel = await page.evaluate(() => ({ f: FARO.formation, label: document.getElementById('btn-formation').textContent }));
  const d09b = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.cells[g.players[0].core.cell];
    const units = FARO.selection.slice();
    let cx = 0; let cz = 0; units.forEach((u) => { cx += u.x; cz += u.z; }); cx /= units.length; cz /= units.length;
    const dest = g.cells.filter((c) => g.passable(c, 'land', 0) && g.map.dist(c, core) === 7 && c.comp === core.comp)
      .sort((a, b) => a.nb.filter((ni) => g.passable(g.cells[ni], 'land', 0)).length - b.nb.filter((ni) => g.passable(g.cells[ni], 'land', 0)).length).pop();
    FARO.input.moveTo(units, dest.i);
    for (let i = 0; i < 600; i++) { g.update(0.1); if (units.every((u) => u.state === 'idle' && !u.moving)) break; }
    for (let i = 0; i < 20; i++) g.update(0.1);
    let dx = dest.x - cx; let dz = dest.z - cz; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const along = units.map((u) => u.x * dx + u.z * dz);
    const across = units.map((u) => u.x * -dz + u.z * dx);
    const spread = (a) => Math.max(...a) - Math.min(...a);
    const face = Math.atan2(dx, dz);
    const diff = (a) => { let d = a - face; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
    const yawErr = Math.max(...units.map((u) => diff(u.yaw)));
    // Comparación: la misma orden en bloque.
    FARO.formation = 'block';
    const back = g.cells[g.players[0].core.cell];
    g.orderMove(units, back.i, false, 'block');
    for (let i = 0; i < 600; i++) { g.update(0.1); if (units.every((u) => u.state === 'idle' && !u.moving)) break; }
    let bx = 0; let bz = 0; units.forEach((u) => { bx += u.x; bz += u.z; }); bx /= units.length; bz /= units.length;
    const ex = bx - dest.x; const ez = bz - dest.z; const EL = Math.hypot(ex, ez);
    const acrossB = units.map((u) => u.x * (-ez / EL) + u.z * (ex / EL));
    FARO.formation = 'line';
    return { n: units.length, along: spread(along).toFixed(2), across: spread(across).toFixed(2), yawErr: yawErr.toFixed(2), acrossBlock: spread(acrossB).toFixed(2) };
  });
  await page.screenshot({ path: SP + '/shots/v07-d09.png' });
  check('D09', 'Formación en línea: las tropas quedan de frente al destino, una al lado de otra',
    formLabel.f === 'line' && /línea/.test(formLabel.label) && Number(d09b.along) <= 2.2 && Number(d09b.across) >= (d09b.n - 1) * 1.2 && Number(d09b.yawErr) < 0.35,
    `botón «${formLabel.label}»; ${d09b.n} tropas: ancho de la fila ${d09b.across} (en bloque ${d09b.acrossBlock}), fondo ${d09b.along}; desvío de la mirada respecto al destino ${d09b.yawErr} rad`);

  // D10 repetir y ×5
  await page.evaluate(() => {
    const g = FARO.game;
    const core = g.cells[g.players[0].core.cell];
    const c = g.cells.find((x) => !g.placeInvalid(0, 'barracks', x.i, true) && g.map.dist(x, core) <= 4);
    window.BAR = g.addBuilding(0, 'barracks', c.i, true);
    g.players[0].coins = 10000;
    FARO.setSelection([BAR]);
  });
  await page.click('#selpanel [data-act="train"][data-type="rifle"]');
  await page.waitForSelector('#btn-repeat');
  await page.click('#btn-repeat');
  const q1 = await page.evaluate(() => BAR.queue.length);
  await page.click('#btn-repeat5');
  const q2 = await page.evaluate(() => ({ q: BAR.queue.length, toast: document.getElementById('toasts').innerText }));
  await page.evaluate(() => { while (BAR.queue.length) FARO.game.cancelQueue(BAR, 0); FARO.ui.renderSel(true); });
  await page.click('#btn-repeat5');
  const q3 = await page.evaluate(() => BAR.queue.length);
  await page.evaluate(() => { while (BAR.queue.length) FARO.game.cancelQueue(BAR, 0); FARO.game.players[0].coins = 150; FARO.ui.renderSel(true); });
  await page.click('#btn-repeat');
  const q4 = await page.evaluate(() => ({ q: BAR.queue.length, toast: document.getElementById('toasts').innerText, label: document.getElementById('btn-repeat').textContent }));
  check('D10', 'Repetir y ×5 ponen la última tropa en la cola (si alcanza el dinero)',
    q1 === 2 && q2.q === 5 && /3 en cola/.test(q2.toast) && q3 === 5 && q4.q === 0 && /Monedas insuficientes/.test(q4.toast),
    `entrenar 1 Artillero + «Repetir» → cola ${q1}; «×5» → cola ${q2.q} («3 en cola · Cola llena (5)»); cola vacía + «×5» → ${q3}; con 150 monedas «${q4.label}» → cola ${q4.q} y aviso «Monedas insuficientes»`);

  // D11 botón Constructores
  const d11 = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.players[0].core;
    g.units.filter((u) => u.owner === 0 && u.def.builds).forEach((u) => g.kill(u, -1));
    const sp = g.freeCellsNear(core.cell, 'land', 0, 3);
    window.B = [g.addUnit(0, 'builder', sp[0]), g.addUnit(0, 'builder', sp[1]), g.addUnit(0, 'engineer', sp[2])];
    const farm = g.buildings.find((b) => b.owner === 0 && b.type === 'farm');
    farm.hp = farm.maxHp * 0.5; farm.lastHit = -99;
    g.orderRepair([B[0]], farm);
    FARO.setSelection([]);
    return B[0].state;
  });
  await page.click('#btn-builders');
  const s1 = await page.evaluate(() => FARO.selection.map((u) => u.id).sort().join());
  await page.click('#btn-builders');
  const s2 = await page.evaluate(() => FARO.selection.length);
  await page.keyboard.press('c');
  const s3 = await page.evaluate(() => ({ ids: FARO.selection.map((u) => u.id).sort().join(), want: [B[1].id, B[2].id].sort().join(), dock: document.getElementById('bld-idle').textContent }));
  check('D11', 'Botón Constructores elige primero a los que no trabajan',
    d11 === 'repair' && s1 === s3.want && s2 === 3 && s3.ids === s3.want,
    `1 constructor reparando y 2 libres (botón muestra ${s3.dock}): 1.er toque elige los 2 libres; 2.º toque los ${s2}; tecla C vuelve a los libres: ${s3.ids === s3.want}`);

  // D04 (parte de interfaz): perder si cae tu Núcleo.
  await page.evaluate(() => { FARO.toMenu(); });
  await mission(page, 4);
  await page.evaluate(() => FARO.game.kill(FARO.game.players[0].core, 1));
  await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
  const lose = await page.evaluate(() => ({ title: document.querySelector('#enddialog h2').textContent, next: !!document.getElementById('btn-next'), again: !!document.getElementById('btn-again'), stars: document.querySelectorAll('#enddialog .bigstars i.on').length, done: !!Profile.data.campaign.done[4] }));
  await page.screenshot({ path: SP + '/shots/v07-lose.png' });
  fs.writeFileSync(SP + '/v07-lose.json', JSON.stringify(lose));
  console.log('derrota', JSON.stringify(lose));

  console.log('errores', page.errs);
  results.push({ id: 'errs', ok: page.errs.length === 0, ev: page.errs.join(' | ') });
  fs.writeFileSync(SP + '/results-v07.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
