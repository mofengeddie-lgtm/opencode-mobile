// D13: nada tapado ni fuera de pantalla en 5 tamaños con los botones nuevos y la pantalla de misión.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const sizes = [['ipad-h', 1180, 820], ['16x9', 1280, 720], ['ipad-v', 820, 1180], ['cel-h', 844, 390], ['cel-v', 390, 844]];
const only = process.argv[2];

const PROBE_SCREEN = () => {
  const bad = [];
  const docW = document.documentElement.scrollWidth;
  if (docW > innerWidth + 1) bad.push('desborde horizontal ' + docW);
  const scr = [...document.querySelectorAll('.screen')].find((s) => !s.hidden && s.id !== 'hud' && getComputedStyle(s).display !== 'none');
  if (scr && scr.scrollWidth > scr.clientWidth + 1) bad.push(scr.id + ' ancho ' + scr.scrollWidth + '>' + scr.clientWidth);
  for (const el of document.querySelectorAll('#menu button, #brief button, #end button')) {
    if (!el.offsetParent) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)) bad.push('botón fuera: ' + el.textContent.trim().slice(0, 20));
    if (r.width > 0 && r.height < 30) bad.push('botón chico: ' + el.textContent.trim().slice(0, 20) + ' ' + Math.round(r.height));
  }
  return bad;
};

// Paneles del juego que no deben taparse entre sí ni salirse de la pantalla.
const PROBE_HUD = () => {
  const bad = [];
  const vis = (el) => el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
  const items = [];
  const add = (name, el) => { if (vis(el)) items.push([name, el.getBoundingClientRect()]); };
  document.querySelectorAll('.topbar > *').forEach((el, i) => add('barra' + i, el));
  add('objetivos', document.getElementById('objectives'));
  add('grupos', document.getElementById('groups'));
  add('minimapa', document.getElementById('miniwrap'));
  add('rápidos', document.getElementById('quick'));
  add('panel', document.getElementById('selpanel'));
  add('construir', document.getElementById('btn-build'));
  add('producción', document.getElementById('prodbar'));
  const bp = document.getElementById('buildpanel');
  if (vis(bp)) add('panelConstruir', bp);
  for (const [n, r] of items) {
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) bad.push(`${n} fuera de pantalla (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const [a, ra] = items[i];
      const [b, rb] = items[j];
      if (a.startsWith('barra') && b.startsWith('barra')) continue;
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) bad.push(`${a} tapa ${b} (${Math.round(w)}×${Math.round(h)})`);
    }
  }
  // El botón de plegar va encima del minimapa, y la caja del minimapa no es más ancha que el mapa.
  const mm = document.getElementById('minimap').getBoundingClientRect();
  const bm = document.getElementById('btn-mini').getBoundingClientRect();
  const wrap = document.getElementById('miniwrap').getBoundingClientRect();
  if (bm.left < mm.left - 1 || bm.right > mm.right + 1 || bm.top < mm.top - 1 || bm.bottom > mm.bottom + 1) bad.push('botón del minimapa fuera del mapa');
  if (wrap.width > mm.width + 2) bad.push(`caja del minimapa más ancha (${Math.round(wrap.width)} > ${Math.round(mm.width)})`);
  // Botones nuevos: tamaño cómodo para el dedo.
  for (const el of document.querySelectorAll('#groups .qbtn, #selpanel .btn')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 36 || r.width < 36) bad.push(`botón chico ${el.textContent.trim().slice(0, 14)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  return bad;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [name, w, h] of sizes) {
    if (only && only !== name) continue;
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
    await H.routes(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
    await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
    await page.evaluate(() => { localStorage.removeItem('faro-profile-v1'); Profile.load(); Profile.data.campaign.done = { 1: true, 2: true }; Profile.data.campaign.stars = { 1: 3, 2: 2 }; FARO.lobby.sub = 'campaign'; FARO.lobby.render(); });
    const res = {};
    res.campaña = await page.evaluate(PROBE_SCREEN);
    await page.screenshot({ path: `${SP}/shots/d13-${name}-lobby.png` });
    await page.click('#btn-mission-1');
    await page.waitForSelector('#brief:not([hidden])');
    res.historia = await page.evaluate(PROBE_SCREEN);
    const goVisible = await page.evaluate(() => { const b = document.getElementById('btn-brief-go'); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
    if (!goVisible) res.historia.push('«¡A jugar!» no se alcanza');
    await page.screenshot({ path: `${SP}/shots/d13-${name}-brief.png` });
    await page.click('#btn-brief-go');
    await page.waitForFunction(() => !FARO.paused);
    // Panel de misión plegado y abierto, con 6 tropas elegidas (botones nuevos del panel).
    await page.evaluate(() => {
      const g = FARO.game;
      const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 6);
      FARO.setSelection(sp.map((ci) => g.addUnit(0, 'rifle', ci)));
    });
    await page.waitForTimeout(400);
    res.tropas = await page.evaluate(PROBE_HUD);
    await page.screenshot({ path: `${SP}/shots/d13-${name}-units.png` });
    const collapsed = await page.evaluate(() => document.getElementById('objectives').classList.contains('collapsed'));
    if (collapsed) {
      await page.click('#btn-obj');
      await page.waitForTimeout(200);
      res.objetivosAbiertos = await page.evaluate(PROBE_HUD);
      await page.screenshot({ path: `${SP}/shots/d13-${name}-obj.png` });
      await page.click('#btn-obj');
    }
    // Cuartel con «Repetir» y «×5».
    await page.evaluate(() => {
      const g = FARO.game;
      const core = g.cells[g.players[0].core.cell];
      const c = g.cells.find((x) => !g.placeInvalid(0, 'barracks', x.i, true) && g.map.dist(x, core) <= 4);
      const b = g.addBuilding(0, 'barracks', c.i, true);
      g.players[0].coins = 5000;
      g.enqueue(b, 'rifle');
      FARO.setSelection([b]);
    });
    await page.waitForTimeout(400);
    res.cuartel = await page.evaluate(PROBE_HUD);
    await page.screenshot({ path: `${SP}/shots/d13-${name}-barracks.png` });
    // Pantalla final de misión.
    await page.evaluate(() => {
      const g = FARO.game;
      g.cells.filter((c) => c.owner === 0 && c.t === 'fertile' && !c.bld).slice(0, 2).forEach((c) => g.addBuilding(0, 'farm', c.i, true));
      g.refreshEconomy();
    });
    await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
    res.final = await page.evaluate(PROBE_SCREEN);
    const btnsOk = await page.evaluate(() => ['btn-next', 'btn-again', 'btn-menu'].every((id) => { const b = document.getElementById(id); b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    if (!btnsOk) res.final.push('botones del final no se alcanzan');
    await page.screenshot({ path: `${SP}/shots/d13-${name}-end.png` });
    const fails = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join('; ')}`);
    out.push({ name, ok: fails.length === 0 && errs.length === 0, fails, errs });
    console.log(name, fails.length ? 'FALLA ' + fails.join(' | ') : 'ok', errs.join(' '));
    await page.context().close();
  }
  if (!only) fs.writeFileSync(SP + (process.env.OUT || '/results-v07-sizes.json'), JSON.stringify(out, null, 1));
  await browser.close();
})();
