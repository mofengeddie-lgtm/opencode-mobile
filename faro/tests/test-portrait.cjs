const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = process.env.SP;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  await page.waitForTimeout(700);
  await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'ffa');
  await page.waitForTimeout(500);
  const box = await page.evaluate(() => { const r = document.getElementById('btn-pause').getBoundingClientRect(); return { right: r.right, w: innerWidth }; });
  console.log('pausa visible completa:', box.right <= box.w, JSON.stringify(box));
  await browser.close();
})();
