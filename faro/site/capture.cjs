// Capturas reales de la v1.9 para el sitio del juego (antes v1.7 y v1.8) (escenas armadas a mano, sin HUD donde conviene).
// Corre desde faro/site (usa faro/tests/helpers.cjs) o desde una copia junto a helpers.cjs.
const H = (() => {
  for (const p of ['../tests/helpers.cjs', '../helpers.cjs']) {
    try { return require(p); } catch (err) { if (err.code !== 'MODULE_NOT_FOUND') throw err; }
  }
  throw new Error('[Sitio] No encuentro helpers.cjs');
})();
const { chromium } = require('playwright');
const fs = require('fs');
const SP = '/tmp/claude-0/-home-user-opencode-mobile/0f78d3e3-e6a8-58dd-9fa1-10429825d51c/scratchpad';
const GAME = process.env.GAME || 'file:///home/user/opencode-mobile/faro/faro.html';
const THREE_JS = SP + '/three/node_modules/three/build/three.min.js';
const S = (n) => `${SP}/site/shots/${n}.png`;
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.route('**/three.min.js', (r) => r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(GAME, { timeout: 120000 });
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 180000 });
  // Miniaturas de todo el Arsenal y de los mapas.
  const data = await page.evaluate(() => {
    const items = arsenalItems().map((it) => ({ key: it.key, kind: it.kind, fam: it.fam, name: it.def.name, role: arsenalRole(it), desc: it.def.desc || '', isNew: ARSENAL_NEW.includes(it.key), img: Thumbs.get(it.key, PLAYER_COLORS[0]) }));
    const maps = LOBBY_MAPS.map((k) => ({ key: k, name: MAPS[k].name, desc: MAPS[k].desc || '', img: mapThumb(k, 6) }));
    const modes = Object.entries(MODES).filter(([, m]) => m.lobby).map(([k, m]) => ({ key: k, name: m.name, desc: m.desc || '' }));
    return { items, maps, modes, version: GAME_VERSION, news: ABOUT_NEWS };
  });
  fs.writeFileSync(`${SP}/site/data.json`, JSON.stringify(data));
  console.log('datos', data.items.length, 'fichas', data.maps.length, 'mapas', data.modes.length, 'modos', data.version);
  // Escena armada.
  await page.evaluate(() => {
    FARO.opts = { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 919 };
    FARO.setQuality('high'); FARO.startGame();
    const g = FARO.game; g.bots = [];
    const p = g.players[0]; p.coins = 500000; p.energy = 999;
    const core = g.cells[p.core.cell];
    p.core.level = 3;
    const put = (t, lv) => { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; if (!c) return null; const b = g.addBuilding(0, t, c.i, true); if (lv) b.level = lv; return b; };
    put('barracks'); put('factory', 2); put('turret', 3); put('helipad'); put('farm'); put('farm'); put('house'); put('house', 2); put('solar'); put('wind'); put('aadef', 2); put('turret', 2);
    window.HARBOR = put('harbor'); put('mine'); put('house'); put('radarstation'); put('bunker'); put('dronecenter'); put('depot');
    g.refreshEconomy(); g.recomputeTerritory && g.recomputeTerritory();
    const land = g.cells.filter((c) => c.land && !c.bld && g.passable(c, 'land', 0) && g.map.dist(c, core) >= 2 && g.map.dist(c, core) <= 4).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
    // v1.8: también las tropas nuevas del catálogo del usuario.
    const types = ['soldier', 'rifle', 'atguided', 'tank', 'mlrs', 'launcher', 'howitzer', 'heavytank', 'marine', 'officer', 'aa', 'ifv', 'medic', 'ranger',
      'tankdestroyer', 'thermo', 'robodog', 'gunner', 'mortar', 'commandveh'];
    window.ARMY = types.map((t, i) => g.addUnit(0, t, land[(i * 2) % land.length].i));
    const sky = g.cells.filter((c) => g.map.dist(c, core) === 3);
    window.AIR = ['heli', 'drone', 'scoutdrone', 'apache', 'transheli', 'attackjet', 'fighter'].map((t, i) => g.addUnit(0, t, sky[(i * 3) % sky.length].i));
    for (const u of [...ARMY, ...AIR]) u.hold = true;
    const hc = g.cells[HARBOR.cell];
    const sea = g.cells.filter((c) => (c.t === 'shallow' || c.t === 'deep') && !c.bld && g.map.dist(c, hc) >= 1 && g.map.dist(c, hc) <= 4).sort((a, b) => g.map.dist(a, hc) - g.map.dist(b, hc));
    window.NAVY = ['missileboat', 'destroyer', 'corvette', 'frigate', 'hovercraft', 'carrier', 'cruiser', 'battleship', 'patrolboat'].map((t, i) => g.addUnit(0, t, sea[(i * 2 + 1) % sea.length].i));
    for (const u of NAVY) u.hold = true;
    FARO.setSelection([]);
    FARO.focusCore();
  });
  const hud = (on) => page.evaluate((v) => { document.getElementById('hud').style.visibility = v ? '' : 'hidden'; }, on);
  const cam = (o) => page.evaluate((c) => { const r = FARO.renderer; const g = FARO.game; const base = c.at === 'harbor' ? HARBOR : c.at === 'faro' ? g.points.find((x) => x.type === 'faro') : g.players[0].core; r.cam.tx = base.x + (c.dx || 0); r.cam.tz = base.z + (c.dz || 0); r.cam.dist = c.dist; if (c.yaw !== undefined) r.cam.yaw = c.yaw; if (c.pitch !== undefined) r.cam.pitch = c.pitch; }, o);
  await page.waitForTimeout(6000);
  await hud(false);
  await cam({ dist: 15, pitch: 0.82 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: S('hero-base') });
  await cam({ dist: 9.5, pitch: 0.72, dx: 1.5 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: S('ejercito-cerca') });
  await cam({ at: 'harbor', dist: 12, pitch: 0.8 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: S('flota') });
  // Con interfaz: base y panel de selección.
  await hud(true);
  await cam({ dist: 17, pitch: 0.9 });
  await page.evaluate(() => { FARO.setSelection(ARMY.slice(0, 7)); });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: S('interfaz') });
  // Pelea: llegan enemigos.
  await page.evaluate(() => {
    const g = FARO.game; const core = g.cells[g.players[0].core.cell];
    FARO.setSelection([]);
    const ring = g.cells.filter((c) => c.land && g.passable(c, 'land', 1) && g.map.dist(c, core) >= 5 && g.map.dist(c, core) <= 6);
    window.FOES = ['tank', 'rifle', 'rifle', 'rocket', 'lighttank', 'rifle', 'tank', 'shotgun'].map((t, i) => g.addUnit(1, t, ring[(i * 3) % ring.length].i));
    g.orderMove(FOES, core.i, true);
    for (const u of [...ARMY, ...AIR]) u.hold = false;
  });
  await hud(false);
  await cam({ dist: 14, pitch: 0.8 });
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(4500);
    await page.screenshot({ path: S('batalla-' + k) });
  }
  console.log('ERRORES', errs.length, errs.slice(0, 5).join(' || '));
  await browser.close();
})().catch((e) => { console.error('FALLO', e.message.slice(0, 500)); process.exit(1); });
