// E01-E05 y E12 del PRD v0.8 en Chromium (iPad horizontal).
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.evaluate(() => { FARO.setQuality('high'); FARO.opts = { mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 777 }; FARO.startGame(); });
  await page.waitForTimeout(300);

  // ---------- E01 texturas ----------
  const e01 = await page.evaluate(() => {
    const r = FARO.renderer;
    const parts = r.terrainParts.filter((p) => p.key !== 'plain');
    const hi = parts.map((p) => `${p.key}:${p.mesh.material.map.image.width}`);
    FARO.setQuality('low');
    const lo = parts.map((p) => `${p.key}:${p.mesh.material.map.image.width}`);
    FARO.setQuality('high');
    const back = parts.every((p) => p.mesh.material.map.image.width === 512);
    const terrains = Object.keys(TERRAIN_TEX).sort().join(',');
    const cellsOk = FARO.game.cells.every((c) => r.cellPart[c.i] && (TERRAIN_TEX[c.t] ? r.cellPart[c.i].mesh.material.map : !r.cellPart[c.i].mesh.material.map));
    return { n: FARO.texCount, terrains, hi, lo, back, cellsOk, parts: parts.length };
  });
  await page.evaluate(() => { const r = FARO.renderer; const c = FARO.game.cells[FARO.game.players[0].core.cell]; r.cam.tx = c.x; r.cam.tz = c.z; r.cam.dist = 13; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: SP + '/shots/v08-e01.png', timeout: 120000 });
  check('E01', 'El suelo usa las texturas de Poly Haven en los terrenos de tierra; en Más fluido son más chicas',
    e01.n === 7 && e01.hi.every((x) => x.endsWith(':512')) && e01.lo.every((x) => x.endsWith(':256')) && e01.back && e01.cellsOk,
    `${e01.n} texturas (${e01.terrains}); en este mapa ${e01.parts} grupos con textura: Alta ${e01.hi.join(' ')} · Más fluido ${e01.lo.join(' ')}; cada casilla en su grupo y el agua lisa: ${e01.cellsOk}`);

  // ---------- E02 aviso en el borde ----------
  const e02a = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    const core = g.cells[g.players[0].core.cell];
    const far = g.cells.filter((c) => c.owner === 0 && TERRAIN[c.t].land && !c.bld && !c.point).sort((a, b) => g.map.dist(b, core) - g.map.dist(a, core))[0];
    window.W = g.addBuilding(0, 'wall', far.i, true);
    // La cámara mira lejos: la muralla queda fuera de la pantalla.
    r.cam.tx = core.x + 45; r.cam.tz = core.z + 10; r.cam.dist = 14; r.updateCamera();
    const enemy = g.addUnit(1, 'rifle', g.freeCellsNear(far.i, 'land', 1, 3)[2]);
    g.damage(W, 5, 1, enemy);
    return true;
  });
  await page.waitForFunction(() => document.querySelector('.edge') && !document.querySelector('.edge').hidden, null, { timeout: 15000 }).catch(() => {});
  const e02 = await page.evaluate(() => {
    const el = document.querySelector('.edge');
    if (!el) return { none: true };
    const r = FARO.renderer;
    const rect = el.getBoundingClientRect();
    const s = r.project(W.x, 0.3, W.z);
    let dx = s.x - r.width / 2; let dy = s.y - r.height / 2; if (!s.ok) { dx = -dx; dy = -dy; }
    const want = Math.atan2(dy, dx);
    const m = /rotate\(([-0-9.e]+)rad\)/.exec(el.querySelector('i').style.transform);
    const got = m ? Number(m[1]) : NaN;
    let diff = Math.abs(want - got); if (diff > Math.PI) diff = 2 * Math.PI - diff;
    const onEdge = rect.left < 120 || rect.right > r.width - 120 || rect.top < 140 || rect.bottom > r.height - 120;
    return { text: el.innerText, diff, onEdge, hidden: el.hidden, inView: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, rect: [rect.left, rect.top, rect.right, rect.bottom].map(Math.round).join(',') };
  });
  if (!e02.none) await page.click('.edge');
  await page.waitForTimeout(300);
  const e02b = await page.evaluate(() => { const c = FARO.renderer.cam; return { d: Math.hypot(c.tx - W.x, c.tz - W.z), left: document.querySelectorAll('.edge').length }; });
  await page.screenshot({ path: SP + '/shots/v08-e02.png', timeout: 120000 });
  check('E02', 'Al atacar algo tuyo fuera de la pantalla aparece la flecha en el borde, apunta bien y tocarla lleva la cámara',
    !e02.none && !e02.hidden && e02.onEdge && e02.inView && e02.diff < 0.15 && e02b.d < 5.5,
    e02.none ? 'sin flecha' : `flecha «${e02.text}» en el borde (${e02.onEdge}), dentro de la pantalla (${e02.inView}), visible (${!e02.hidden}) [${e02.rect}]; error de dirección ${e02.diff.toFixed(3)} rad; tras tocarla la cámara va a la zona atacada (a ${e02b.d.toFixed(2)} de la muralla; los avisos a menos de 5 casillas se juntan en una flecha)`);

  // ---------- E03 barra de producción ----------
  await page.evaluate(() => {
    const g = FARO.game; const core = g.cells[g.players[0].core.cell];
    FARO.focusCore();
    const spots = g.cells.filter((c) => !g.placeInvalid(0, 'barracks', c.i, true) && g.map.dist(c, core) <= 4);
    window.BAR = g.addBuilding(0, 'barracks', spots[0].i, true);
    window.FAC = g.addBuilding(0, 'factory', spots.find((c) => g.map.dist(c, spots[0]) > 1).i, true);
    g.players[0].coins = 20000; g.players[0].energy = 500;
    g.enqueue(BAR, 'rifle'); g.enqueue(BAR, 'shotgun');
  });
  await page.waitForFunction(() => document.querySelectorAll('#prodbar .pitem').length === 3 && document.querySelector(`[data-pbar="${BAR.id}"]`), null, { timeout: 60000 });
  await page.waitForTimeout(600);
  const e03 = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#prodbar .pitem')];
    const bar = document.querySelector(`[data-prod="${BAR.id}"]`);
    const w = document.querySelector(`[data-pbar="${BAR.id}"]`).style.width;
    return { n: items.length, idle: items.filter((i) => i.classList.contains('idle')).map((i) => i.title), badge: bar.querySelector('em') ? bar.querySelector('em').textContent : '', w, tips: items.map((i) => i.title) };
  });
  await page.click(`#prodbar [data-prod]:nth-of-type(2)`);
  await page.waitForTimeout(300);
  const e03b = await page.evaluate(() => ({ sel: FARO.selection[0] && FARO.selection[0].type, d: Math.hypot(FARO.renderer.cam.tx - BAR.x, FARO.renderer.cam.tz - BAR.z) }));
  await page.screenshot({ path: SP + '/shots/v08-e03.png', timeout: 120000 });
  check('E03', 'La barra de producción muestra tus edificios que entrenan, su cola y progreso, marca los parados y tocar uno lo elige',
    e03.n === 3 && e03.idle.length === 1 && /Fábrica/.test(e03.idle[0]) && e03.badge === '2' && parseFloat(e03.w) > 0 && e03b.sel === 'barracks' && e03b.d < 1,
    `${e03.n} edificios (${e03.tips.join(' · ')}); parado en amarillo: ${e03.idle.join(', ')}; Cuartel con cola ${e03.badge} y progreso ${e03.w}; tocarlo lo elige (${e03b.sel}) y lleva la cámara`);

  // ---------- E04 iconos ----------
  const e04 = await page.evaluate(() => {
    const g = FARO.game;
    const us = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 3).map((ci) => g.addUnit(0, 'rifle', ci));
    FARO.setSelection(us); FARO.ui.renderSel(true);
    const unitBtns = [...document.querySelectorAll('#selpanel .btn')].filter((b) => b.dataset.act !== 'close' && b.dataset.act !== 'savegrp');
    const u = unitBtns.map((b) => ({ t: b.textContent.trim().slice(0, 18), icon: !!b.querySelector('.bi svg'), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }));
    FARO.setSelection([BAR]); FARO.ui.renderSel(true);
    const bBtns = [...document.querySelectorAll('#selpanel .actions .btn')];
    const b = bBtns.map((x) => ({ t: x.textContent.trim().slice(0, 18), icon: !!x.querySelector('.bi svg'), h: x.getBoundingClientRect().height }));
    return { u, b };
  });
  const all04 = [...e04.u, ...e04.b];
  check('E04', 'Los botones de acción tienen icono y tamaño cómodo para el dedo',
    all04.length >= 6 && all04.every((x) => x.icon && x.h >= 36),
    `tropas: ${e04.u.map((x) => x.t).join(' · ')}; Cuartel: ${e04.b.map((x) => x.t).join(' · ')}; todos con icono: ${all04.every((x) => x.icon)}; alto mínimo ${Math.round(Math.min(...all04.map((x) => x.h)))} px`);

  // ---------- E05 ficha del enemigo ----------
  const e05 = await page.evaluate(() => {
    const g = FARO.game;
    const t = g.addUnit(1, 'tank', g.freeCellsNear(g.players[0].core.cell, 'land', 1, 8)[7]);
    t.hp = 1100;
    FARO.setSelection([t]); FARO.ui.renderSel(true);
    const unit = document.getElementById('enemycard').innerText.replace(/\n/g, ' | ');
    const ec = g.players[1].core;
    FARO.setSelection([ec]); FARO.ui.renderSel(true);
    const bld = document.getElementById('enemycard').innerText.replace(/\n/g, ' | ');
    return { unit, bld };
  });
  await page.screenshot({ path: SP + '/shots/v08-e05.png', timeout: 120000 });
  check('E05', 'La ficha del enemigo muestra vida, nivel y qué usar contra él',
    /Vida \| 1100 \/ 2200 \(50 %\)/.test(e05.unit) && /Fuerte contra/.test(e05.unit) && /Usa \| /.test(e05.unit) && /Nivel \| 1 de 3/.test(e05.bld) && /Usa \| /.test(e05.bld),
    `Tanque: «${e05.unit}» · Núcleo enemigo: «${e05.bld}»`);

  // ---------- E12 movimiento de CMU ----------
  const e12 = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    FARO.setSelection([]);
    const core = g.cells[g.players[0].core.cell];
    r.cam.tx = core.x; r.cam.tz = core.z;
    const sp = g.freeCellsNear(core.i, 'land', 0, 4);
    const runner = g.addUnit(0, 'rifle', sp[0]);
    const walker = g.addUnit(0, 'builder', sp[1]);
    const dest = g.cells.filter((c) => g.passable(c, 'land', 0) && g.map.dist(c, core) === 6 && TERRAIN[c.t].land && !TERRAIN[c.t].slow)[0];
    g.orderMove([runner, walker], dest.i, false);
    // Simula 1,2 s de juego y de dibujo, cuadro a cuadro.
    const samples = [];
    for (let i = 0; i < 36; i++) {
      g.update(1 / 30);
      r.frame(1 / 30, FARO.time + i / 30, []);
      const v = r.vis.get(runner.id);
      samples.push([v.legl.rotation.x, v.shinl.rotation.x, v.legr.rotation.x]);
    }
    const vr = r.vis.get(runner.id); const vw = r.vis.get(walker.id);
    const range = (k) => Math.max(...samples.map((s) => s[k])) - Math.min(...samples.map((s) => s[k]));
    const notMirror = samples.some((s) => Math.abs(s[0] + s[2]) > 0.05);
    const out = { clipR: vr.gaitClip, clipW: vw.gaitClip, hip: range(0), knee: range(1), notMirror, kneeMin: Math.min(...samples.map((s) => s[1])) };
    // Más fluido: balanceo simple, rodilla quieta.
    FARO.setQuality('low');
    for (let i = 0; i < 10; i++) { g.update(1 / 30); r.frame(1 / 30, FARO.time + 2 + i / 30, []); }
    out.lowClip = vr.gaitClip; out.lowKnee = vr.shinl.rotation.x; out.lowMirror = Math.abs(vr.legl.rotation.x + vr.legr.rotation.x) < 1e-6;
    FARO.setQuality('high');
    return out;
  });
  check('E12', 'Los soldados caminan y corren con el movimiento de CMU en Alta calidad; en Más fluido usan el balanceo simple',
    e12.clipR === 'run' && e12.clipW === 'walk' && e12.hip > 0.4 && e12.knee > 0.6 && e12.kneeMin >= -0.05 && e12.notMirror && e12.lowClip === null && e12.lowKnee === 0 && e12.lowMirror,
    `Artillero: ${e12.clipR}, Constructor: ${e12.clipW}; en 1,2 s la cadera recorre ${e12.hip.toFixed(2)} rad y la rodilla ${e12.knee.toFixed(2)} rad (nunca se dobla al revés); piernas no espejadas: ${e12.notMirror}. Más fluido: ciclo ${e12.lowClip}, rodilla ${e12.lowKnee}, balanceo simple ${e12.lowMirror}`);

  results.push({ id: 'errs', ok: page.errs.length === 0, ev: page.errs.join(' | ') });
  console.log('errores', page.errs);
  fs.writeFileSync(SP + '/results-v08.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
