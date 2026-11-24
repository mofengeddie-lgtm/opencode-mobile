const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = process.env.SP;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, w, h] of [['ipad-vertical', 820, 1180], ['cel-horizontal', 844, 390], ['cel-vertical', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
    await H.routes(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
    await H.compat(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SP}/shots/20-${name}-menu.png` });
    await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'ffa');
    await page.waitForTimeout(500);
    await page.evaluate(() => { const g = window.FARO.game; window.FARO.setSelection(g.units.filter((u) => u.owner === 0)); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SP}/shots/21-${name}-game.png` });
    await page.click('#btn-build');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SP}/shots/22-${name}-build.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(name, 'overflow', overflow, 'errors', JSON.stringify(errs));
    await ctx.close();
  }
  await browser.close();
})();
