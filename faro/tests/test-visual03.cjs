const { chromium } = require('playwright');
const SP = process.env.SP;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForTimeout(600);
  await page.evaluate(() => { const a = window.FARO; a.setOption('mode', 'ffa'); a.setOption('mapKind', 'archipelago'); a.startGame(); });
  await page.waitForTimeout(300);
  // Faro capturado a medias con tropas cerca
  await page.evaluate(() => {
    const app = window.FARO; const g = app.game;
    g.bots.forEach((b) => { b.update = () => {}; });
    const faro = g.points.find((p) => p.type === 'faro');
    const near = g.cells.filter((c) => TERRAIN[c.t].land && !c.point && g.map.dist(c, g.cells[faro.cell]) === 1);
    for (let i = 0; i < 3; i++) g.addUnit(0, 'rifle', near[i].i);
    for (let i = 0; i < 60; i++) g.update(0.1);
    const r = app.renderer; r.cam.tx = faro.x; r.cam.tz = faro.z; r.cam.dist = 13; r.cam.yaw = 0.6; r.updateCamera();
    app.setSelection([faro]);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SP + '/shots/70-faro.png' });
  // Base con Molino, Cúpula y escudo de emergencia
  await page.evaluate(() => {
    const app = window.FARO; const g = app.game; const me = g.players[0];
    me.coins = 50000;
    const free = (t) => g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, t, c.i) && g.map.dist(c, g.cells[me.core.cell]) >= 2);
    g.place(0, 'mill', free('mill').i, 0.5);
    g.place(0, 'mill', free('mill').i, 1.2);
    g.place(0, 'house', free('house').i);
    g.place(0, 'farm', free('farm').i);
    for (let i = 0; i < 80; i++) g.update(0.1);
    g.buyDome(0);
    g.damage(me.core, me.core.hp - me.core.maxHp * 0.2, 1);
    const sub = g.cells.find((c) => c.t === 'shallow' && g.map.dist(c, g.cells[me.core.cell]) <= 4);
    if (sub) g.addUnit(1, 'heli', sub.i);
    const r = app.renderer; r.cam.tx = me.core.x; r.cam.tz = me.core.z; const m = g.buildings.find((b) => b.type === 'mill'); r.cam.tx = m.x; r.cam.tz = m.z; r.cam.dist = 11; r.updateCamera();
    app.setSelection([me.core]);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SP + '/shots/71-base.png' });
  console.log('errores', JSON.stringify(errs));
  await browser.close();
})();
