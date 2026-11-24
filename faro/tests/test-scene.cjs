const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = process.env.SP;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  await page.waitForTimeout(700);
  await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'ffa');
  await page.waitForTimeout(400);
  // Simula 9 minutos y busca la base de bot más desarrollada.
  const where = await page.evaluate(() => {
    const app = window.FARO; const g = app.game;
    for (let i = 0; i < 5400 && !g.over; i++) g.update(0.1);
    let best = null; let n = -1;
    for (const p of g.players) {
      if (!p.alive || p.human) continue;
      const k = g.buildings.filter((b) => b.owner === p.id).length;
      if (k > n) { n = k; best = p; }
    }
    const c = best.core;
    app.renderer.cam.tx = c.x; app.renderer.cam.tz = c.z; app.renderer.cam.dist = 20;
    return { name: best.name, n, time: Math.round(g.time), over: g.over };
  });
  console.log('base', JSON.stringify(where));
  await page.waitForTimeout(600);
  await page.screenshot({ path: SP + '/shots/30-botbase.png' });
  // Busca una pelea en curso: proyectiles o unidades heridas.
  const fight = await page.evaluate(() => {
    const app = window.FARO; const g = app.game;
    for (let k = 0; k < 600; k++) {
      g.update(0.1);
      const hurt = g.units.filter((u) => g.time - u.lastHit < 0.6);
      if (hurt.length >= 4) {
        const u = hurt[0];
        app.renderer.cam.tx = u.x; app.renderer.cam.tz = u.z; app.renderer.cam.dist = 16;
        return { t: Math.round(g.time), n: hurt.length };
      }
    }
    return null;
  });
  console.log('pelea', JSON.stringify(fight));
  await page.waitForTimeout(80);
  await page.screenshot({ path: SP + '/shots/31-fight.png' });
  console.log('errores', JSON.stringify(errs));
  await browser.close();
})();
