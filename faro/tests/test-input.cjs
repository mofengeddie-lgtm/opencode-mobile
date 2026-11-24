const H = require('./helpers.cjs');
// Prueba los controles reales: toques, selección, construcción, producción e ingenieros.
const { chromium } = require('playwright');
const SP = process.env.SP;
const FILE = 'file:///home/user/opencode-mobile/faro/faro.html';
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(FILE);
  await H.compat(page);
  await page.waitForTimeout(800);
  await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'duel');
  await page.waitForTimeout(700);

  const proj = (sel) => page.evaluate((sel) => {
    const app = window.FARO; const g = app.game; const r = app.renderer;
    let e;
    if (sel.unit) e = g.units.find((u) => u.owner === 0 && u.type === sel.unit);
    if (sel.bld) e = g.buildings.find((b) => b.owner === 0 && b.type === sel.bld);
    if (sel.cell !== undefined) e = g.cells[sel.cell];
    if (!e) return null;
    const y = sel.cell !== undefined ? Math.max(e.h, 0) : e.y + (e.kind === 'bld' ? 0.2 : 0.25);
    const p = r.project(e.x, y, e.z);
    return { x: p.x, y: p.y };
  }, sel);
  const step = (secs) => page.evaluate((s) => { for (let i = 0; i < s * 10; i++) window.FARO.game.update(0.1); }, secs);

  // 1. Tocar un fusilero lo selecciona
  let p = await proj({ unit: 'rifle' });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(200);
  let sel = await page.evaluate(() => window.FARO.selection.map((e) => e.type));
  check('tocar fusilero lo selecciona', sel.length === 1 && sel[0] === 'rifle', JSON.stringify(sel));
  check('panel de selección visible', await page.isVisible('#selpanel'));

  // 2. Tocar el suelo lo mueve
  const target = await page.evaluate(() => {
    const g = window.FARO.game; const core = g.cells[g.map.homes[0]];
    const c = g.cells.find((c) => g.map.dist(c, core) === 3 && c.t === 'grass' && !c.bld);
    return c.i;
  });
  p = await proj({ cell: target });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(150);
  let st = await page.evaluate(() => window.FARO.selection[0] && window.FARO.selection[0].state);
  check('tocar el suelo da orden de mover', st === 'move', st);
  await step(8);
  const arrived = await page.evaluate((t) => { const u = window.FARO.selection[0]; return { cell: u.cell, state: u.state, d: window.FARO.game.map.dist(window.FARO.game.cells[u.cell], window.FARO.game.cells[t]) }; }, target);
  check('la tropa llega al destino', arrived.d <= 1 && arrived.state === 'idle', JSON.stringify(arrived));

  // 3. Construir una granja desde el panel
  await page.click('[data-act="close"]');
  const farm0 = await page.evaluate(() => window.FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length);
  await page.click('[data-b="farm"]');
  await page.waitForTimeout(150);
  check('modo colocación activo', await page.isVisible('#placebar'));
  const farmCell = await page.evaluate(() => { const app = window.FARO; return [...app.input.placement.valid][0]; });
  await page.evaluate((ci) => { const r = window.FARO.renderer; const c = window.FARO.game.cells[ci]; r.cam.tx = c.x; r.cam.tz = c.z; r.updateCamera(); }, farmCell);
  p = await proj({ cell: farmCell });
  await page.screenshot({ path: SP + '/shots/10-placement.png' });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(150);
  let farm = await page.evaluate(() => window.FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length);
  check('tocar la casilla solo muestra la vista previa (no cobra)', farm === farm0, 'granjas=' + farm + ' (inicio ' + farm0 + ')');
  await page.click('#btn-place-ok');
  await page.waitForTimeout(150);
  farm = await page.evaluate(() => window.FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length);
  check('«Construir» coloca la granja', farm === farm0 + 1, 'granjas=' + farm + ' (inicio ' + farm0 + ')');
  // la granja sigue en modo colocación para poner más; cancelamos
  await page.click('#btn-place-cancel');

  // 4. Cuartel + entrenamiento
  await page.click('[data-tab="prod"]');
  await page.click('[data-b="barracks"]');
  const bCell = await page.evaluate(() => [...window.FARO.input.placement.valid][3]);
  await page.evaluate((ci) => { const r = window.FARO.renderer; const c = window.FARO.game.cells[ci]; r.cam.tx = c.x; r.cam.tz = c.z; r.updateCamera(); }, bCell);
  p = await proj({ cell: bCell });
  await page.touchscreen.tap(p.x, p.y);
  await page.click('#btn-place-ok');
  await step(25); // v0.5: el Ingeniero camina hasta la obra y la construye
  await page.waitForTimeout(200);
  const built = await page.evaluate(() => { const b = window.FARO.game.buildings.find((b) => b.owner === 0 && b.type === 'barracks'); return b && b.built; });
  check('cuartel terminado', built === true);
  p = await proj({ bld: 'barracks' });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(300);
  sel = await page.evaluate(() => window.FARO.selection.map((e) => e.type));
  check('tocar el cuartel lo selecciona', sel[0] === 'barracks', JSON.stringify(sel));
  await page.click('[data-act="train"][data-type="rifle"]');
  await page.click('[data-act="train"][data-type="rifle"]');
  await page.waitForTimeout(100);
  const q = await page.evaluate(() => window.FARO.selection[0].queue.length);
  check('dos fusileros en cola', q === 2, 'cola=' + q);
  await page.screenshot({ path: SP + '/shots/11-barracks.png' });
  await step(11);
  const rifles = await page.evaluate(() => window.FARO.game.units.filter((u) => u.owner === 0 && u.type === 'rifle').length);
  check('fusileros entrenados', rifles === 4, 'fusileros=' + rifles);

  // 5. Ingeniero funda un puesto avanzado
  p = await proj({ unit: 'engineer' });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(200);
  const picked = await page.evaluate(() => window.FARO.selection.length === 1 && window.FARO.selection[0].type === 'engineer');
  if (!picked) await page.evaluate(() => window.FARO.setSelection(window.FARO.game.units.filter((u) => u.owner === 0 && u.type === 'engineer')));
  await page.click('[data-act="found"]');
  await page.waitForTimeout(100);
  const fCell = await page.evaluate(() => {
    const app = window.FARO; const g = app.game; const core = g.cells[g.map.homes[0]];
    const list = [...app.input.placement.valid].map((i) => g.cells[i]).filter((c) => c.owner === -1);
    list.sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
    return list[0].i;
  });
  const center = await page.evaluate((ci) => { const r = window.FARO.renderer; const c = window.FARO.game.cells[ci]; r.cam.tx = c.x; r.cam.tz = c.z; r.updateCamera(); return true; }, fCell);
  p = await proj({ cell: fCell });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(100);
  st = await page.evaluate(() => { const u = window.FARO.game.units.find((u) => u.owner === 0 && u.type === 'engineer'); return u && u.state; });
  check('ingeniero en camino', st === 'found', st);
  await step(40);
  const outposts = await page.evaluate(() => window.FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'outpost').length);
  check('puesto avanzado fundado', outposts === 1, 'puestos=' + outposts);

  // 6. Arrastrar mueve la cámara; botón Núcleo la centra
  const cam0 = await page.evaluate(() => ({ ...window.FARO.renderer.cam }));
  await page.mouse.move(600, 400); await page.mouse.down(); await page.mouse.move(450, 300, { steps: 6 }); await page.mouse.up();
  const cam1 = await page.evaluate(() => ({ ...window.FARO.renderer.cam }));
  check('arrastrar mueve la cámara', Math.hypot(cam1.tx - cam0.tx, cam1.tz - cam0.tz) > 2);
  await page.click('#btn-home');

  // 7. Recuadro selecciona varias tropas
  await page.evaluate(() => { const g = window.FARO.game; const c = g.cells[g.map.homes[0]]; const r = window.FARO.renderer; r.cam.tx = c.x; r.cam.tz = c.z; r.cam.dist = 30; r.updateCamera(); });
  await page.click('#btn-box');
  await page.mouse.move(20, 70); await page.mouse.down(); await page.mouse.move(1160, 800, { steps: 8 }); await page.mouse.up();
  await page.click('#btn-box');
  sel = await page.evaluate(() => window.FARO.selection.length);
  check('recuadro selecciona varias tropas', sel >= 3, 'seleccionadas=' + sel);
  await page.screenshot({ path: SP + '/shots/12-multi.png' });

  // 8. Botón Ejército, pausa y fin de partida
  await page.click('[data-quick="army"]');
  sel = await page.evaluate(() => window.FARO.selection.length);
  check('botón Ejército', sel >= 4, 'sel=' + sel);
  await page.click('#btn-pause');
  check('menú de pausa', await page.isVisible('#pause'));
  await page.screenshot({ path: SP + '/shots/13-pause.png' });
  await page.click('#btn-resume');
  await page.evaluate(() => { const g = window.FARO.game; g.kill(g.players[1].core, 0); });
  const endOk = await page.waitForSelector('#end', { state: 'visible', timeout: 6000 }).then(() => true, () => false);
  check('pantalla de victoria', endOk);
  await page.screenshot({ path: SP + '/shots/14-victory.png' });

  console.log(results.join('\n'));
  console.log('errores:', JSON.stringify(errors));
  await browser.close();
})();
