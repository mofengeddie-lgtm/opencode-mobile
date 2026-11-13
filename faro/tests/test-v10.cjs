// Pruebas de la v1.0 en Chromium (iPad horizontal): G01, G03 (vista), G04 (botones), G06, G08 (botón), G09 (portada).
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.waitForTimeout(800);

  // ---------- G09 portada ----------
  const cover = await page.evaluate(() => {
    const el = document.querySelector('.cover');
    const r = el.getBoundingClientRect();
    const img = el.querySelector('.cover-img');
    return { h: Math.round(r.height), url: (Thumbs.coverUrl || '').length, bg: getComputedStyle(img).backgroundImage.slice(0, 22), anim: getComputedStyle(img).animationName,
      news: [...el.querySelectorAll('.cover-news li')].map((x) => x.textContent), version: el.querySelector('small').textContent, gv: GAME_VERSION, brand: !!el.querySelector('.cover-brand svg') };
  });
  await page.screenshot({ path: SP + '/shots/v10-g09-cover.png' });
  results.push({ id: 'G09web', ok: cover.h >= 220 && cover.url > 1000 && /url/.test(cover.bg) && cover.anim === 'coverpan' && cover.news.length === 5 && cover.version.includes(cover.gv) && cover.brand,
    ev: `portada de ${cover.h} px de alto con escena 3D (${Math.round(cover.url / 1024)} KB), movimiento suave «${cover.anim}», logo, «${cover.version}» y novedades: ${cover.news.join(', ')}` });

  // ---------- partida ----------
  await page.evaluate(() => { FARO.setQuality('high'); FARO.opts = { mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 1010 }; FARO.startGame(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; g.players[0].coins = 3e6; g.players[0].energy = 1e5; FARO.focusCore(); });

  // ---------- G01 botón «Construir» ----------
  await page.click('.bitem[data-b="farm"]');
  await page.waitForTimeout(200);
  const pts = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer; const p = FARO.input.placement;
    const core = g.cells[g.players[0].core.cell];
    const list = [...p.valid].map((i) => g.cells[i]).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
    const out = [];
    for (const c of list) {
      const s = r.project(c.x, c.h, c.z);
      if (s.ok && s.x > 300 && s.x < r.width - 300 && s.y > 120 && s.y < r.height - 170) out.push({ i: c.i, x: s.x, y: s.y });
      if (out.length >= 3) break;
    }
    return { pts: out, farms0: g.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length, okDisabled: document.getElementById('btn-place-ok').disabled, okText: document.getElementById('btn-place-ok').textContent.trim() };
  });
  const farms = () => page.evaluate(() => FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length);
  await page.touchscreen.tap(pts.pts[0].x, pts.pts[0].y);
  await page.waitForTimeout(250);
  const afterTap = await page.evaluate(() => ({ cell: FARO.input.placement.cell, ghost: !!(FARO.renderer.ghost && FARO.renderer.ghost.visible), ok: !document.getElementById('btn-place-ok').disabled, text: document.getElementById('placetext').innerText }));
  const f1 = await farms();
  await page.screenshot({ path: SP + '/shots/v10-g01-ghost.png' });
  await page.click('#btn-place-ok');
  await page.waitForTimeout(250);
  const f2 = await farms();
  const still = await page.evaluate(() => ({ placing: !!FARO.input.placement, cancel: document.getElementById('btn-place-cancel').textContent.trim() }));
  await page.touchscreen.tap(pts.pts[1].x, pts.pts[1].y);
  await page.waitForTimeout(200);
  await page.click('#btn-place-ok');
  await page.waitForTimeout(250);
  const f3 = await farms();
  await page.click('#btn-place-cancel');
  await page.waitForTimeout(200);
  const out = await page.evaluate(() => !FARO.input.placement);
  check('G01', 'Tocar una casilla solo muestra la obra fantasma; la obra se pone con «Construir»; varias seguidas y salir con «Terminar»',
    pts.okDisabled && f1 === pts.farms0 && afterTap.ok && f2 === pts.farms0 + 1 && still.placing && f3 === pts.farms0 + 2 && still.cancel === 'Terminar' && out,
    `antes de tocar, «${pts.okText}» está apagado (${pts.okDisabled}); al tocar una casilla: Granjas ${pts.farms0} → ${f1} (solo la vista previa), barra «${afterTap.text.replace(/\n/g, ' ')}»; ` +
    `con «Construir»: ${f2}; sigue en modo construir (${still.placing}) y otra casilla + «Construir»: ${f3}; el botón «${still.cancel}» sale: ${out}`);

  // ---------- G04 botones del Núcleo ----------
  const lv1 = await page.evaluate(() => { FARO.setSelection([FARO.game.players[0].core]); return true; });
  await page.waitForTimeout(300);
  const hidden1 = await page.evaluate(() => !document.getElementById('btn-upall') && !document.getElementById('btn-autoup'));
  await page.evaluate(() => {
    const g = FARO.game; const core = g.players[0].core;
    while (core.level < 3) { core.upgrading = { level: core.level + 1, progress: 1 }; g.finishUpgrade(core); }
    for (const b of g.buildings) if (b.owner === 0 && !b.built) { b.progress = 1; b.built = true; g.resetShield(b); }
    FARO.ui.renderSel(true);
  });
  await page.waitForTimeout(300);
  const ui3 = await page.evaluate(() => ({ up: document.getElementById('btn-upall') ? document.getElementById('btn-upall').textContent.trim() : null, auto: document.getElementById('btn-autoup') ? document.getElementById('btn-autoup').textContent.trim() : null }));
  await page.screenshot({ path: SP + '/shots/v10-g04-core.png' });
  await page.click('#btn-upall');
  await page.waitForTimeout(300);
  const ups = await page.evaluate(() => FARO.game.buildings.filter((b) => b.owner === 0 && b.upgrading).length);
  await page.click('#btn-autoup');
  await page.waitForTimeout(300);
  const autoOn = await page.evaluate(() => ({ flag: FARO.game.players[0].autoUpgrade, pressed: document.getElementById('btn-autoup').getAttribute('aria-pressed'), text: document.getElementById('btn-autoup').textContent.trim() }));
  results.push({ id: 'G04web', ok: hidden1 && ui3.up && ui3.auto && ups > 0 && autoOn.flag && autoOn.pressed === 'true',
    ev: `Núcleo nivel 1: sin botones (${hidden1}); nivel 3: «${ui3.up}» y «${ui3.auto}»; al tocar «Mejorar todo» quedaron ${ups} edificios mejorándose; «${autoOn.text}» (encendido: ${autoOn.flag})` });
  await page.evaluate(() => { FARO.game.players[0].autoUpgrade = false; });

  // ---------- G06 aviones y Aeropuerto ----------
  const g06 = await page.evaluate(() => new Promise((res) => {
    const g = FARO.game; const r = FARO.renderer;
    const core = g.cells[g.players[0].core.cell];
    const c = g.cells.find((x) => !g.placeInvalid(0, 'airport', x.i, true) && g.map.dist(x, core) <= 6);
    window.AIR = g.addBuilding(0, 'airport', c.i, true);
    const cells = g.freeCellsNear(core.i, 'land', 0, 30);
    window.F = g.addUnit(0, 'fighter', cells[12]);
    window.B = g.addUnit(0, 'bomber', cells[14]);
    F.hp = F.maxHp * 0.7;
    const lx = F.x, lz = F.z;
    const samples = [];
    let banks = 0; let frames = 0;
    const fx0 = r.fxs.soft ? r.fxs.soft.count || 0 : 0;
    const tick = () => {
      const v = r.vis.get(F.id);
      if (v) { samples.push([v.group.position.x, v.group.position.z]); if (Math.abs(v.group.rotation.z) > 0.05) banks++; }
      frames++;
      if (frames < 90) requestAnimationFrame(tick);
      else {
        let maxd = 0;
        for (const s of samples) maxd = Math.max(maxd, Math.hypot(s[0] - samples[0][0], s[1] - samples[0][1]));
        res({ maxd, banks, frames, logical: Math.hypot(F.x - lx, F.z - lz), trails: r.fxs.soft ? (r.fxs.soft.count || r.fxs.soft.n || 0) : -1 });
      }
    };
    requestAnimationFrame(tick);
  }));
  await page.evaluate(() => { FARO.setSelection([F]); });
  await page.waitForTimeout(300);
  const fCard = await page.evaluate(() => (document.querySelector('.planecard') || {}).innerText || '');
  await page.evaluate(() => { FARO.setSelection([B]); });
  await page.waitForTimeout(300);
  const bCard = await page.evaluate(() => (document.querySelector('.planecard') || {}).innerText || '');
  const hasBz = !!(await page.$('#btn-bombzone'));
  await page.screenshot({ path: SP + '/shots/v10-g06-bomber.png' });
  let bzOk = false;
  if (hasBz) {
    await page.click('#btn-bombzone');
    await page.waitForTimeout(200);
    const tgt = await page.evaluate(() => { const g = FARO.game; const r = FARO.renderer; const c = g.cells[g.players[0].core.cell]; const t = g.cells.find((x) => g.map.dist(x, c) === 3); const s = r.project(t.x, t.h, t.z); return { x: s.x, y: s.y, i: t.i }; });
    await page.touchscreen.tap(tgt.x, tgt.y);
    await page.waitForTimeout(300);
    bzOk = await page.evaluate(() => B.state === 'amove' || (B.path && B.path.length > 0));
  }
  await page.evaluate(() => { FARO.setSelection([AIR]); });
  await page.waitForTimeout(400);
  const aCard = await page.evaluate(() => (document.querySelector('.radar.airport') || {}).innerText || '');
  await page.screenshot({ path: SP + '/shots/v10-g06-airport.png' });
  const models = await page.evaluate(() => ['fighter', 'bomber', 'airport'].map((k) => { const v = createVisual(k, PLAYER_COLORS[0]); let n = 0; v.group.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return `${k}:${GLB[k] ? n : 'sin GLB'}`; }));
  results.push({ id: 'G06web', ok: g06.maxd > 0.5 && g06.logical < 0.05 && g06.banks > 10 && /Misiles aire-aire/.test(fCard) && /Bombas/.test(bCard) && /Furtivo/.test(bCard) && hasBz && bzOk && /Torre de control/.test(aCard) && models.every((m) => !/sin GLB|:0$/.test(m)) && errs.length === 0,
    ev: `Caza quieto: en ${g06.frames} cuadros su avión recorre una vuelta (se aleja hasta ${g06.maxd.toFixed(2)} del centro) sin mover su posición de juego (${g06.logical.toFixed(2)}), inclinado en ${g06.banks} cuadros; ` +
      `ficha del Caza: «${fCard.replace(/\n/g, ' · ')}»; del Bombardero: «${bCard.replace(/\n/g, ' · ')}»; «Bombardear zona» manda al Bombardero: ${bzOk}; Aeropuerto: «${aCard.replace(/\n/g, ' · ')}»; modelos (vértices): ${models.join(' ')}; errores: ${errs.length ? errs.join(' | ') : 'ninguno'}` });

  // ---------- G03 vista de la radiación y G08 botón ----------
  const g08 = await page.evaluate(() => {
    const g = FARO.game;
    const core = g.cells[g.players[0].core.cell];
    const silos = [];
    for (let k = 0; k < 3; k++) {
      const c = g.cells.find((x) => !g.placeInvalid(0, 'aadef', x.i, true) && g.map.dist(x, core) <= 6);
      const b = g.addBuilding(0, 'aadef', c.i, true);
      while (b.level < 4) { b.upgrading = { level: b.level + 1, progress: 1 }; g.finishUpgrade(b); }
      silos.push(b);
    }
    window.SILOS = silos;
    silos[2].nukeReadyAt = g.time + 100;
    FARO.setSelection([silos[0]]);
    return true;
  });
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => { const b = document.getElementById('btn-nuke3'); return b ? { dis: b.disabled, note: b.parentElement.innerText } : null; });
  await page.evaluate(() => { SILOS[2].nukeReadyAt = 0; FARO.ui.renderSel(true); });
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => { const b = document.getElementById('btn-nuke3'); return b ? !b.disabled : false; });
  await page.screenshot({ path: SP + '/shots/v10-g08-button.png' });
  await page.click('#btn-nuke3');
  await page.waitForTimeout(200);
  const tgt = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer; const p = FARO.input.placement;
    const ec = g.cells[g.players[1].core.cell];
    const c = [...p.valid].map((i) => g.cells[i]).sort((a, b) => g.map.dist(a, ec) - g.map.dist(b, ec))[0];
    r.cam.tx = c.x; r.cam.tz = c.z; r.cam.dist = 14; r.updateCamera();
    const s = r.project(c.x, c.h, c.z);
    return { x: s.x, y: s.y, n: p.valid.size };
  });
  await page.touchscreen.tap(tgt.x, tgt.y);
  await page.waitForTimeout(300);
  const launched = await page.evaluate(() => FARO.game.projectiles.filter((p) => p.kind === 'nuke').length);
  // El navegador de pruebas dibuja muy lento: se avanza el tiempo del juego a mano hasta que caen.
  await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 150 && !(g.radZones || []).length; i++) g.update(0.1); g.update(0.5); });
  await page.waitForTimeout(1500);
  const radView = await page.evaluate(() => {
    const r = FARO.renderer; const ctx = r.octx; const texts = [];
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = (t, x, y, m) => { texts.push(String(t)); return orig(t, x, y, m); };
    r.drawOverlay([]);
    ctx.fillText = orig;
    return { meshes: r.radMeshes ? r.radMeshes.size : 0, zones: FARO.game.radZones.length, label: texts.find((t) => /Radiación/.test(t)) || '' };
  });
  await page.screenshot({ path: SP + '/shots/v10-g03-radiation.png' });
  results.push({ id: 'G08web', ok: off && off.dis && on && launched === 3, ev: `con 2 listos el botón está apagado («${off ? off.note.replace(/\n/g, ' ') : 'sin botón'}»); con 3 se enciende (${on}); al elegir el blanco salen ${launched} misiles` });
  results.push({ id: 'G03web', ok: radView.zones > 0 && radView.meshes === radView.zones && /Radiación/.test(radView.label), ev: `${radView.zones} zonas de radiación con su disco verde (${radView.meshes}) y el cartel «${radView.label}»` });

  fs.writeFileSync(SP + '/results-v10.json', JSON.stringify(results, null, 1));
  for (const r of results) if (!r.name) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id} · ${r.ev}`);
  console.log('errores', errs);
  await browser.close();
})();
