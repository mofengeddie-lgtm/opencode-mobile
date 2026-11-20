// G09/G10: nada tapado ni fuera de pantalla en 5 tamaños con las pantallas nuevas de la v1.0.
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
    await page.waitForTimeout(500);
    const res = {};
    res.portada = await page.evaluate(PROBE_SCREEN);
    const cov = await page.evaluate(() => { const c = document.querySelector('.cover'); const r = c.getBoundingClientRect(); const t = c.querySelector('.cover-text').getBoundingClientRect();
      const chips = [...c.querySelectorAll('.cover-news li')].every((li) => { const q = li.getBoundingClientRect(); return q.right <= r.right + 1 && q.bottom <= r.bottom + 1; });
      return { inside: r.left >= 0 && r.right <= innerWidth + 1, text: t.bottom <= r.bottom + 1 && t.right <= r.right + 1 && t.top >= r.top - 1 && chips }; });
    if (!cov.inside) res.portada.push('portada fuera de pantalla');
    if (!cov.text) res.portada.push('texto de la portada se sale');
    await page.screenshot({ path: `${SP}/shots/g10-${name}-lobby.png` });
    await page.evaluate(() => { FARO.setQuality('low'); FARO.opts = { mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame(); });
    await page.waitForTimeout(400);
    const near = (type) => `(() => { const g = FARO.game; const core = g.cells[g.players[0].core.cell]; const c = g.cells.filter((x) => !g.placeInvalid(0, '${type}', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; return g.addBuilding(0, '${type}', c.i, true); })()`;
    // Núcleo nivel 3: casillas de estado, «Mejorar todo» y «Mejoras automáticas».
    await page.evaluate(() => { const g = FARO.game; g.players[0].coins = 50000; const c = g.players[0].core; while (c.level < 3) { c.upgrading = { level: c.level + 1, progress: 1 }; g.finishUpgrade(c); } FARO.setSelection([c]); });
    await page.waitForTimeout(400);
    res.nucleo = await page.evaluate(PROBE_HUD);
    if (!(await page.$('#btn-upall'))) res.nucleo.push('falta «Mejorar todo»');
    await page.screenshot({ path: `${SP}/shots/g10-${name}-core.png` });
    // AIR DEFENSE nivel 4 con radar y misil nuclear.
    await page.evaluate((code) => {
      const g = FARO.game; const b = eval(code);
      b.upgrading = { level: 4, progress: 1 }; g.finishUpgrade(b);
      g.addUnit(1, 'heli', g.freeCellsNear(b.cell, 'land', 1, 20)[12]);
      FARO.setSelection([b]);
    }, near('aadef'));
    await page.waitForTimeout(800);
    res.airDefense = await page.evaluate(PROBE_HUD);
    if (!(await page.$('#btn-nuke'))) res.airDefense.push('falta el botón del misil nuclear');
    if (!(await page.$('#btn-nuke3'))) res.airDefense.push('falta «Lanzar los 3»');

    await page.screenshot({ path: `${SP}/shots/g10-${name}-aadef.png` });
    // Casa con «Mejorar a Apartamento».
    await page.evaluate((code) => { const b = eval(code); FARO.setSelection([b]); }, near('house'));
    await page.waitForTimeout(300);
    res.casa = await page.evaluate(PROBE_HUD);
    // Transporte con soldados (Bajar soldados) y Médico.
    await page.evaluate(() => {
      const g = FARO.game; const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 12);
      const apc = g.addUnit(0, 'apc', sp[0]);
      for (let k = 1; k <= 3; k++) { const s = g.addUnit(0, 'rifle', sp[k]); g.board(s, apc); }
      FARO.setSelection([apc]);
    });
    await page.waitForTimeout(300);
    res.transporte = await page.evaluate(PROBE_HUD);
    await page.screenshot({ path: `${SP}/shots/g10-${name}-apc.png` });
    // Bombardero (ficha y «Bombardear zona») y Aeropuerto (torre de control).
    await page.evaluate((code) => {
      const g = FARO.game; const air = eval(code);
      const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 20);
      window.BB = g.addUnit(0, 'bomber', sp[15]);
      window.AIRP = air;
      FARO.setSelection([BB]);
    }, near('airport'));
    await page.waitForTimeout(300);
    res.bombardero = await page.evaluate(PROBE_HUD);
    if (!(await page.$('#btn-bombzone'))) res.bombardero.push('falta «Bombardear zona»');
    await page.screenshot({ path: `${SP}/shots/g10-${name}-bomber.png` });
    await page.evaluate(() => FARO.setSelection([AIRP]));
    await page.waitForTimeout(300);
    res.aeropuerto = await page.evaluate(PROBE_HUD);
    // Construir con botón: barra de colocación con «Construir» y una casilla elegida.
    await page.evaluate(() => { FARO.setSelection([]); FARO.input.startPlacement({ kind: 'build', btype: 'farm' }); const p = FARO.input.placement; const c = [...p.valid][0]; if (c !== undefined) FARO.input.previewAt(c); });
    await page.waitForTimeout(300);
    res.construir = await page.evaluate(() => {
      const bad = [];
      const pb = document.getElementById('placebar');
      const r = pb.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.top < -1) bad.push('barra de colocación fuera de pantalla');
      for (const id of ['btn-place-ok', 'btn-place-cancel']) {
        const q = document.getElementById(id).getBoundingClientRect();
        if (q.height < 36) bad.push(id + ' chico');
        if (q.right > innerWidth + 1 || q.bottom > innerHeight + 1) bad.push(id + ' fuera');
      }
      if (document.getElementById('btn-place-ok').textContent.trim() !== 'Construir') bad.push('falta «Construir»');
      return bad;
    });
    await page.screenshot({ path: `${SP}/shots/g10-${name}-place.png` });
    const fails = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join('; ')}`);
    out.push({ name, ok: fails.length === 0 && errs.length === 0, fails, errs });
    console.log(name, fails.length ? 'FALLA ' + fails.join(' | ') : 'ok', errs.join(' '));
    await page.context().close();
  }
  if (!only) fs.writeFileSync(SP + '/results-v10-sizes.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
