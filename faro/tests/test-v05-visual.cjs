// Pruebas visuales del PRD v0.5 (B13-B15) en Chromium.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  // B13: modelos de Blender
  const models = await page.evaluate(() => {
    const keys = Object.keys(GLB);
    const missing = [];
    for (const t of Object.keys(BUILDINGS)) if (!glbKey(t) && !(t === 'wall' && GLB.wall_post && GLB.wall_seg)) missing.push(t);
    for (const t of Object.keys(UNITS)) if (!glbKey(t)) missing.push(t);
    const levels = ['core_1', 'core_2', 'core_3', 'turret_1', 'turret_2', 'turret_3', 'hospital_1', 'hospital_2', 'hospital_3'].filter((k) => !GLB[k]);
    const ships = ['speedboat', 'boatEng', 'barge', 'destroyer', 'sub'].map((t) => { const m = getModel(t, 0xff0000); return t + ':' + m.main.attributes.position.count; });
    return { n: keys.length, count: FARO.modelCount, missing, levels, ships, wall: !!GLB.wall_post && !!GLB.wall_seg, scaffold: !!GLB.scaffold };
  });
  check('B13', 'los modelos de Blender cargan: todos los edificios, variantes por nivel, unidades y barcos', models.n >= 49 && models.missing.length === 0 && models.levels.length === 0 && models.wall && models.scaffold && errs.length === 0,
    `${models.n} modelos GLB; sin modelo: [${models.missing.join(', ')}]; niveles faltantes: [${models.levels.join(', ')}]; barcos (vértices): ${models.ships.join(', ')}; errores: ${errs.length}`);
  // Partida para las demás
  await H.compat(page);
  await page.evaluate(() => { FARO.__legacy = false; FARO.setOption('mode', 'duel'); FARO.setOption('mapKind', 'continent'); FARO.startGame(); });
  await page.waitForTimeout(300);
  // B14: muro
  const wall = await page.evaluate(() => {
    const g = FARO.game; const me = g.players[0]; me.coins = 1e6;
    g.bots.forEach((b) => { b.update = () => {}; b.think = () => {}; });
    const core = g.cells[me.core.cell];
    // tres muros en línea (vecinos)
    const start = g.cells.find((c) => !g.placeInvalid(0, 'wall', c.i) && g.map.dist(c, core) === 3 && c.nb.filter((ni) => !g.placeInvalid(0, 'wall', ni)).length >= 2);
    const a = g.addBuilding(0, 'wall', start.i, true);
    const nbs = start.nb.filter((ni) => !g.placeInvalid(0, 'wall', ni)).slice(0, 2);
    nbs.forEach((ni) => g.addBuilding(0, 'wall', ni, true));
    const lone = g.cells.find((c) => !g.placeInvalid(0, 'wall', c.i) && g.map.dist(c, start) >= 4 && c.nb.every((ni) => !g.cells[ni].bld));
    const l = g.addBuilding(0, 'wall', lone.i, true);
    FARO.renderer.syncEntities(0, 0);
    const va = FARO.renderer.vis.get(a.id); const vl = FARO.renderer.vis.get(l.id);
    const r = FARO.renderer; r.cam.tx = start.x; r.cam.tz = start.z; r.cam.dist = 11; r.updateCamera();
    return { center: va.segs.children.length, lone: vl.segs.children.length, post: !!va.main };
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: SP + '/shots/v05-wall.png' });
  check('B14', 'el Muro es una muralla: torreón y tramos que se unen con los muros vecinos', wall.center === 2 && wall.lone === 0 && wall.post,
    `muro con 2 vecinos: ${wall.center} tramos; muro solo: ${wall.lone} tramos; captura shots/v05-wall.png`);
  // B15: holograma ámbar, rayo al cielo, icono de combate
  const fx = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer; const me = g.players[0];
    FARO.input.startPlacement({ kind: 'build', btype: 'barracks' });
    const ci = [...FARO.input.placement.valid][0];
    r.setGhost('barracks', ci, 0, true);
    const okColor = r.ghost.okMat.color.getHexString();
    const ghostVis = r.ghost.group.visible;
    FARO.input.cancelPlacement();
    r.frame(0.016, 1, []);
    const beams = (r.skyBeams || []).filter((b) => b && b.visible !== false).length;
    // pelea: una tropa enemiga ataca a una tuya
    const land = g.freeCellsNear(me.core.cell, 'land', 0, 8);
    const mine = g.addUnit(0, 'rifle', land[5]);
    const foe = g.addUnit(1, 'rifle', land[6]);
    for (let i = 0; i < 20; i++) g.update(0.1);
    r.frame(0.016, 2, []);
    return { okColor, ghostVis, beams, players: g.players.length, fights: r.fightIcons, lasers: r.laserCount };
  });
  check('B15', 'holograma ámbar al construir, rayo ámbar al cielo sobre cada Núcleo e icono de combate', fx.okColor === 'ffb63a' && fx.ghostVis && fx.beams === fx.players && fx.fights >= 1,
    `holograma #${fx.okColor}; rayos ${fx.beams}/${fx.players} Núcleos; iconos de combate ${fx.fights}`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/v05-fight.png' });
  check('errores', 'sin errores en la consola', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  require('fs').writeFileSync(SP + '/results-v05-visual.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
