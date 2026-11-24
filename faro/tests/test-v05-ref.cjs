// B27-B30: modelos según referencias, skin Brigada Tóxica, luz de Poly Haven y piernas al caminar.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  const info = await page.evaluate(() => {
    const vcount = (k, part) => { const p = GLB[k] && GLB[k].parts[part]; return p ? p.chunks.reduce((s, c) => s + c.g.attributes.position.count, 0) : 0; };
    const parts = (k) => (GLB[k] ? Object.keys(GLB[k].parts).sort().join('+') : 'falta');
    return {
      turret: [1, 2, 3].map((l) => vcount('turret_' + l, 'turret')),
      jeep: parts('jeep'), aadef: parts('aadef'), arty: parts('arty'), heli: parts('heli'),
      core: [1, 2, 3].map((l) => parts('core_' + l)), coreV: [1, 2, 3].map((l) => vcount('core_' + l, 'main')),
      ships: ['barge', 'speedboat', 'boatEng', 'destroyer'].map((k) => k + ':' + vcount(k, 'main')),
      eco: ['farm', 'mine', 'rig', 'helipad'].map((k) => k + ':' + vcount(k, 'main')),
      soldier: parts('builder'), tox: Object.keys(GLB).filter((k) => k.endsWith('@toxico')).length,
    };
  });
  check('B27', 'modelos nuevos: torreta con miniguns por nivel, jeep con artillero, Núcleo fortaleza, barcos, aire, defensa y economía',
    info.turret[1] > info.turret[0] && info.turret[2] > info.turret[1] && info.jeep === 'main+turret' && info.aadef === 'main+rotor+turret' &&
    info.arty === 'main+turret' && info.heli === 'main+rotor' && info.core.every((p) => p === 'crystal+main') && info.coreV[2] > info.coreV[0] && errs.length === 0,
    `vértices de la torreta por nivel ${info.turret.join(' < ')}; jeep ${info.jeep}; AIR DEFENSE ${info.aadef}; Núcleo ${info.coreV.join('/')} vértices; ${info.ships.join(', ')}; ${info.eco.join(', ')}; láminas: shots/models-sheet.png y models-front.png`);
  // B28 skin
  const skin = await page.evaluate(() => {
    const s = SKIN_BY_ID.toxico_inf;
    Profile.data.owned = {}; Profile.data.crystals = 5000; Profile.save();
    FARO.lobby.view = 'shop'; FARO.lobby.shopTab = 'skins'; FARO.lobby.render();
    const card = [...document.querySelectorAll('.item')].find((el) => el.textContent.includes('Brigada Tóxica'));
    const normalThumb = Thumbs.get('rifle', PLAYER_COLORS[0]);
    const toxThumb = Thumbs.get('rifle', PLAYER_COLORS[0], 'toxico');
    const inLegendPool = SKINS.filter((x) => x.rar === 'legendario' && !x.special).some((x) => x.id === 'toxico_inf');
    return { exists: !!s, rar: s && s.rar, card: !!card, thumbsDiffer: normalThumb !== toxThumb && toxThumb.length > 1000, inLegendPool };
  });
  await page.click('[data-act="buy"][data-id="toxico_inf"]');
  await page.screenshot({ path: SP + '/shots/v05-shop-toxico.png' });
  await page.evaluate(() => { Profile.data.equipped.inf = 'toxico_inf'; Profile.save(); FARO.__legacy = false; FARO.lobby.view = 'play'; FARO.lobby.sub = 'main'; FARO.lobby.syncOpts(); FARO.startGame(); });
  await page.waitForTimeout(300);
  const inGame = await page.evaluate(() => {
    const g = FARO.game;
    const u = g.addUnit(0, 'rifle', g.freeCellsNear(g.players[0].core.cell, 'land', 0, 4)[1]);
    const e = g.addUnit(1, 'rifle', g.freeCellsNear(g.players[1].core.cell, 'land', 1, 4)[1]);
    FARO.renderer.syncEntities(0, 0);
    const keys = [..._modelCache.keys()];
    return { owned: !!Profile.data.owned.toxico_inf, looks: g.opts.looks, mine: keys.some((k) => k.startsWith('rifle:') && k.endsWith(':toxico')), enemyNormal: keys.some((k) => k.startsWith('rifle:' + PLAYER_COLORS[1] + ':') && !k.endsWith('toxico')) };
  });
  check('B28', 'skin Brigada Tóxica: legendario, en la Tienda y el Cofre del Faro; tus soldados usan el modelo con capucha y máscara',
    skin.exists && skin.rar === 'legendario' && skin.card && skin.thumbsDiffer && skin.inLegendPool && inGame.owned && inGame.looks.inf === 'toxico' && inGame.mine && inGame.enemyNormal,
    `${JSON.stringify(skin)}; comprado ${inGame.owned}; en partida: tus fusileros con modelo tóxico ${inGame.mine}, los del rival normales ${inGame.enemyNormal}`);
  // B29 luz
  const env = await page.evaluate(() => ({ env: !!ENV_MAP, scene: FARO.renderer.scene.environment === ENV_MAP, intensity: GLB_MAT.envMapIntensity }));
  const size = fs.statSync('/home/user/opencode-mobile/faro/faro.html').size;
  check('B29', 'luz de ambiente con el cielo HDRI de Poly Haven (CC0), sin errores; archivo de menos de 4 MB',
    env.env && env.scene && size < 4 * 1024 * 1024 && errs.length === 0, `mapa de entorno ${env.env}, en la escena ${env.scene}, intensidad ${env.intensity}; faro.html ${(size / 1048576).toFixed(2)} MB; errores ${errs.length}`);
  // B30 piernas
  const legs = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    const u = g.units.find((x) => x.owner === 0 && x.type === 'rifle');
    const far = g.freeCellsNear(u.cell, 'land', 0, 6).slice(-1)[0];
    g.orderMove([u], far);
    const samples = [];
    for (let i = 0; i < 30; i++) { g.update(0.05); r.syncEntities(0.05, 10 + i * 0.05); const v = r.vis.get(u.id); samples.push([v.legl.rotation.x, v.legr.rotation.x, u.moving]); }
    u.state = 'idle'; u.moving = false; u.path = null;
    for (let i = 0; i < 40; i++) { r.syncEntities(0.05, 20 + i * 0.05); }
    const v = r.vis.get(u.id);
    return { maxSwing: Math.max(...samples.map((s) => Math.abs(s[0]))), mirrored: samples.every((s) => Math.abs(s[0] + s[1]) < 1e-9), moving: samples.some((s) => s[2]), rest: Math.abs(v.legl.rotation.x) };
  });
  check('B30', 'las tropas mueven las piernas al caminar y se quedan quietas al parar', legs.moving && legs.maxSwing > 0.25 && legs.mirrored && legs.rest < 0.02,
    `balanceo máximo ${legs.maxSwing.toFixed(2)} rad, piernas opuestas ${legs.mirrored}, quieta al parar ${legs.rest.toFixed(3)} rad`);
  check('errores', 'sin errores de consola', errs.length === 0, JSON.stringify(errs.slice(0, 4)));
  fs.writeFileSync(SP + '/results-v05-ref.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
