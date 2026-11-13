const H = require('./helpers.cjs');
// Prueba las novedades: mejora de granja, transporte (subir y bajar), batería antiaérea, lanzamisiles.
const { chromium } = require('playwright');
const SP = process.env.SP;
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name} ${extra}`);

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
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  await page.waitForTimeout(700);
  await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'duel');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.FARO.game; g.bots.forEach((b) => { b.update = () => {}; }); g.players[0].coins = 30000; });
  const step = (s) => page.evaluate((s) => { for (let i = 0; i < s * 10; i++) window.FARO.game.update(0.1); }, s);
  const tapEntity = async (fn) => {
    const p = await page.evaluate(fn);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(200);
  };
  const focus = (expr) => page.evaluate(expr);

  // 1. (v0.5) La Granja sube a nivel 2 con un constructor; la Bomba de petróleo es aparte.
  await tapEntity(() => { const app = window.FARO; const b = app.game.buildings.find((x) => x.type === 'farm' && x.owner === 0); app.renderer.cam.tx = b.x; app.renderer.cam.tz = b.z; app.renderer.updateCamera(); const p = app.renderer.project(b.x, b.y + 0.15, b.z); return p; });
  check('granja seleccionada', await page.evaluate(() => window.FARO.selection[0] && window.FARO.selection[0].type === 'farm'));
  const inc0 = await page.evaluate(() => { window.FARO.game.refreshEconomy(); return window.FARO.game.players[0].income; });
  await page.click('[data-act="upgrade"]');
  await page.waitForTimeout(150);
  let up = await page.evaluate(() => { const b = window.FARO.game.buildings.find((x) => x.type === 'farm' && x.owner === 0); return { upgrading: !!b.upgrading, level: b.level, coins: Math.round(window.FARO.game.players[0].coins) }; });
  check('mejora de la granja iniciada', up.upgrading && up.level === 1, JSON.stringify(up));
  await step(30);
  const inc = await page.evaluate(() => { window.FARO.game.refreshEconomy(); const b = window.FARO.game.buildings.find((x) => x.type === 'farm' && x.owner === 0); return { income: window.FARO.game.players[0].income, level: b.level }; });
  check('granja nivel 2 suma ingresos', inc.level === 2 && inc.income === inc0 + 120, JSON.stringify(inc) + ' antes=' + inc0);
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/40-pump.png' });

  // 2. Transporte: subir y bajar
  const ship = await page.evaluate(() => {
    const g = window.FARO.game; const core = g.cells[g.map.homes[0]];
    const c = g.cells.filter((x) => x.t === 'shallow' && g.map.isCoast(x) && !x.bld).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
    const t = g.addUnit(0, 'barge', c.i);
    const r = window.FARO.renderer; r.cam.tx = (c.x + core.x) / 2; r.cam.tz = (c.z + core.z) / 2; r.cam.dist = 22; r.updateCamera();
    return t.id;
  });
  await page.click('[data-quick="army"]');
  const nArmy = await page.evaluate(() => window.FARO.selection.length);
  await tapEntity(() => { const g = window.FARO.game; const t = g.units.find((u) => u.type === 'barge'); return window.FARO.renderer.project(t.x, t.y + 0.25, t.z); });
  const boarding = await page.evaluate(() => window.FARO.game.units.filter((u) => u.state === 'board').length);
  check('tocar el transporte manda subir', boarding === nArmy && nArmy > 0, `subiendo=${boarding} de ${nArmy}`);
  await step(15);
  const cargo = await page.evaluate(() => window.FARO.game.units.find((u) => u.type === 'barge').cargo.length);
  check('tropas a bordo', cargo === nArmy, 'carga=' + cargo);
  await tapEntity(() => { const g = window.FARO.game; const t = g.units.find((u) => u.type === 'barge'); return window.FARO.renderer.project(t.x, t.y + 0.25, t.z); });
  await page.waitForTimeout(250);
  await page.screenshot({ path: SP + '/shots/41-transport.png' });
  check('botón Desembarcar visible', await page.isVisible('[data-act="unload"]'));
  await page.click('[data-act="unload"]');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => { const g = window.FARO.game; return { inside: g.units.filter((u) => u.inside).length, sel: window.FARO.selection.length }; });
  check('desembarcan todas', after.inside === 0 && after.sel === nArmy, JSON.stringify(after));

  // 3. Batería antiaérea desde el panel Defensa
  await page.click('[data-tab="def"]');
  await page.click('[data-b="aadef"]');
  const aaCell = await page.evaluate(() => [...window.FARO.input.placement.valid][2]);
  const p = await page.evaluate((ci) => { const r = window.FARO.renderer; const c = window.FARO.game.cells[ci]; r.cam.tx = c.x; r.cam.tz = c.z; r.updateCamera(); return r.project(c.x, c.h, c.z); }, aaCell);
  await page.touchscreen.tap(p.x, p.y);
  await page.click('#btn-place-ok');
  await step(30); // v0.5+: el constructor camina hasta la obra y la levanta (12 s a velocidad normal)
  const aa = await page.evaluate(() => { const g = window.FARO.game; const b = g.buildings.find((x) => x.type === 'aadef'); return b && b.built; });
  check('batería antiaérea construida', aa === true);

  // 4. Lanzamisiles ataca edificios y no tropas; la batería derriba helicópteros
  const fightRes = await page.evaluate(() => {
    const g = window.FARO.game; const app = window.FARO;
    const aaB = g.buildings.find((x) => x.type === 'aadef');
    const heli = g.addUnit(1, 'heli', g.freeCellsNear(aaB.cell, 'air', 1, 3)[2]);
    const land = g.freeCellsNear(g.map.homes[1], 'land', 1, 40);
    const enemyCore = g.players[1].core;
    const arty = g.addUnit(0, 'arty', land[30]);
    const rifle = g.addUnit(1, 'rifle', land[29]);
    const coreHp0 = enemyCore.hp; const rifleHp0 = rifle.hp;
    for (let i = 0; i < 200; i++) g.update(0.1);
    return { heliAlive: heli.alive, coreDamaged: enemyCore.lastHit > 0 && enemyCore.lastAttacker === 0, rifleHitByArty: rifle.alive ? rifle.hp < rifleHp0 : 'muerto', artyAlive: arty.alive };
  });
  check('la batería derriba al helicóptero', fightRes.heliAlive === false, JSON.stringify(fightRes));
  check('el lanzamisiles daña el Núcleo', fightRes.coreDamaged === true);
  await page.screenshot({ path: SP + '/shots/42-aadef.png' });

  console.log(results.join('\n'));
  console.log('errores:', JSON.stringify(errors));
  await browser.close();
})();
