const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const SP = __dirname;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page); await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  const r = await page.evaluate(async () => {
    localStorage.removeItem('faro-profile-v1'); Profile.load(); Profile.data.campaign.done = { 1: true, 2: true };
    FARO.startMission(3); FARO.ui.hideBrief();
    const g = FARO.game; for (let i = 0; i < 300; i++) g.update(0.1);
    g.camp.faroHold = 22.5; g.camp.lostBld = 1;
    FARO.toMenu();
    const peek = Save.peek();
    const resumeTxt = document.querySelector('.resume') ? document.querySelector('.resume').innerText : '';
    FARO.suspended = null; FARO.loadSavedGame();
    const g2 = FARO.game;
    FARO.ui.renderMission(true);
    return { peek: peek.mode, resumeTxt, same: g2 !== g, camp: g2.camp, mode: g2.mode.name, panel: document.getElementById('objlist').innerText.replace(/\n/g, ' | '), title: document.getElementById('objtitle').textContent, t: Math.round(g2.time) };
  });
  console.log(JSON.stringify(r, null, 1), errs);
  await browser.close();
})();
