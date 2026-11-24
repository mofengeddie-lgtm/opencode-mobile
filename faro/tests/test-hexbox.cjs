const { chromium } = require('playwright');
const path = require('path');
const SP = process.env.SP;
const FILE = 'file:///home/user/opencode-mobile/faro/faro.html';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(FILE);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SP + '/shots/01-menu.png' });
  await page.click('#btn-start');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SP + '/shots/02-start.png' });
  const info = await page.evaluate(() => {
    const g = FARO.game;
    return { cells: g.cells.length, players: g.players.length, units: g.units.length, blds: g.buildings.length,
      mine: g.cells.filter(c => c.owner === 0).length };
  });
  console.log('start', JSON.stringify(info));
  // Simular 8 minutos de partida con los bots
  const sim = await page.evaluate(() => {
    const g = FARO.game;
    const t0 = performance.now();
    const snaps = [];
    for (let i = 0; i < (globalThis.STEPS||9000); i++) {
      g.update(0.1);
      if (i % 600 === 0) {
        snaps.push({ t: Math.round(g.time), units: g.units.length, blds: g.buildings.length,
          coins: g.players.map(p => Math.round(p.coins)).join('/'),
          alive: g.players.map(p => p.alive ? 1 : 0).join('') });
      }
      const bad = g.units.find(u => !isFinite(u.x) || !isFinite(u.z) || !isFinite(u.y));
      if (bad) return { error: 'NaN unit ' + bad.type + ' state ' + bad.state, snaps };
    }
    const byType = {};
    for (const b of g.buildings) byType[b.type] = (byType[b.type] || 0) + 1;
    const uType = {};
    for (const u of g.units) uType[u.type] = (uType[u.type] || 0) + 1;
    return { ms: Math.round(performance.now() - t0), snaps, byType, uType,
      stats: g.players.map(p => p.stats), over: g.over, result: g.result, time: g.time };
  });
  console.log('sim', JSON.stringify(sim, null, 0));
  await page.waitForTimeout(800);
  await page.screenshot({ path: SP + '/shots/03-after-sim.png' });
  console.log('errors', JSON.stringify(errors.slice(0, 20)));
  await browser.close();
})();
