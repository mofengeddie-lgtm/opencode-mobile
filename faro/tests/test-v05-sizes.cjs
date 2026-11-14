// B25: vestíbulo, tienda, ventanas y pantalla final sin desbordes en 5 tamaños.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = __dirname;
const sizes = [['ipad-h', 1180, 820], ['16x9', 1280, 720], ['ipad-v', 820, 1180], ['cel-h', 844, 390], ['cel-v', 390, 844]];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [name, w, h] of sizes) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
    await H.routes(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
    await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
    const probe = () => page.evaluate(() => {
      const bad = [];
      const docW = document.documentElement.scrollWidth;
      if (docW > innerWidth + 1) bad.push('desborde horizontal ' + docW);
      const scr = [...document.querySelectorAll('.screen')].find((s) => !s.hidden && s.id !== 'hud');
      if (scr && scr.scrollWidth > scr.clientWidth + 1) bad.push(scr.id + ' ancho ' + scr.scrollWidth + '>' + scr.clientWidth);
      for (const el of document.querySelectorAll('#menu button, #modal button, #end button')) {
        if (!el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) bad.push('botón fuera: ' + el.textContent.trim().slice(0, 20));
        if (r.width > 0 && r.height < 30) bad.push('botón chico: ' + el.textContent.trim().slice(0, 20) + ' ' + Math.round(r.height));
      }
      return bad;
    });
    const res = {};
    res.lobby = await probe();
    await page.screenshot({ path: `${SP}/shots/s-${name}-lobby.png` });
    await page.evaluate(() => { FARO.lobby.view = 'shop'; FARO.lobby.render(); });
    res.shop = await probe();
    await page.evaluate(() => { FARO.lobby.view = 'play'; FARO.lobby.render(); FARO.lobby.openModal('pass'); });
    res.pass = await probe();
    await page.evaluate(() => FARO.lobby.closeModal());
    await page.evaluate(() => { FARO.lobby.sub = 'custom'; FARO.lobby.render(); });
    res.custom = await probe();
    if (name === 'cel-v') await page.screenshot({ path: `${SP}/shots/s-${name}-custom.png`, fullPage: false });
    await page.evaluate(() => { FARO.lobby.sub = 'main'; FARO.lobby.syncOpts(); FARO.startGame(); const g = FARO.game; g.players[0].stats.hitBy = { heli: 900 }; g.eliminate(0, 1); });
    await page.waitForTimeout(2000);
    res.end = await probe();
    await page.screenshot({ path: `${SP}/shots/s-${name}-end.png` });
    const fails = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join('; ')}`);
    out.push({ name, ok: fails.length === 0 && errs.length === 0, fails, errs });
    console.log(name, fails.length ? 'FALLA ' + fails.join(' | ') : 'ok', errs.join(' '));
    await page.context().close();
  }
  require('fs').writeFileSync(SP + '/results-v05-sizes.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
