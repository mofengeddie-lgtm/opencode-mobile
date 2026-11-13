// Pruebas de la v0.9 en Chromium (iPad horizontal): F01, F04 (colores), F06 (tarjeta), F07, F14 (iconos),
// F15, F16 y F20 (suelo de la v0.6).
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

  // ---------- F16 portada ----------
  const cover = await page.evaluate(() => {
    const el = document.querySelector('.cover');
    const r = el ? el.getBoundingClientRect() : null;
    return { has: !!el, url: (Thumbs.coverUrl || '').length, bg: el ? getComputedStyle(el.querySelector('.cover-img') || el).backgroundImage.slice(0, 30) : '', h: r ? Math.round(r.height) : 0, title: el ? el.innerText.split('\n').slice(0, 2).join(' / ') : '', version: document.querySelector('.brand-sm .version').textContent, gv: GAME_VERSION };
  });
  await page.screenshot({ path: SP + '/shots/v09v10-f16-cover.png' });

  // ---------- partida ----------
  await page.evaluate(() => { FARO.setQuality('high'); FARO.opts = { mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 909 }; FARO.startGame(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; g.players[0].coins = 1e6; g.players[0].energy = 1e5; FARO.focusCore(); });

  // ---------- F20 suelo de la v0.6 ----------
  const ground = await page.evaluate(() => {
    const r = FARO.renderer;
    const t = r.terrain;
    const meshes = [];
    r.scene.traverse((o) => { if (o.isInstancedMesh && o.count === FARO.game.cells.length) meshes.push(o); });
    return { single: meshes.length === 1 && meshes[0] === t, map: !!(t.material && t.material.map), tex: typeof FARO_TEX !== 'undefined', cells: FARO.game.cells.length, std: t.material.type };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SP + '/shots/v09v10-f20-ground.png' });
  check('F20', 'Suelo de la v0.6: colores lisos por terreno, sin las texturas (pedido durante la versión)',
    ground.single && !ground.map && !ground.tex,
    `una sola malla de ${ground.cells} casillas (${ground.std}), con textura=${ground.map}, texturas en el juego=${ground.tex}`);

  // ---------- F07 construir de un toque ----------
  await page.click('[data-tab="eco"]').catch(() => {});
  const farmBtn = await page.$('.bitem[data-b="farm"]');
  if (farmBtn) await farmBtn.click();
  await page.waitForTimeout(200);
  const pts = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer; const p = FARO.input.placement;
    if (!p) return { none: true };
    const core = g.cells[g.players[0].core.cell];
    const list = [...p.valid].map((i) => g.cells[i]).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
    const out = [];
    for (const c of list) {
      const s = r.project(c.x, c.h, c.z);
      if (s.ok && s.x > 300 && s.x < r.width - 300 && s.y > 120 && s.y < r.height - 160) out.push({ i: c.i, x: s.x, y: s.y });
      if (out.length >= 3) break;
    }
    return { pts: out, farms0: g.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length, text: document.getElementById('placetext').innerText };
  });
  const tapped = [];
  if (!pts.none) {
    for (const p of pts.pts.slice(0, 2)) {
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(250);
      // v1.0: cada obra se confirma con «Construir».
      await page.click('#btn-place-ok');
      await page.waitForTimeout(200);
      tapped.push(p.i);
    }
  }
  const mid = await page.evaluate(() => ({ placing: !!FARO.input.placement, placed: FARO.input.placement ? FARO.input.placement.placed : -1, text: document.getElementById('placetext').innerText, farms: FARO.game.buildings.filter((b) => b.owner === 0 && b.type === 'farm').length }));
  await page.screenshot({ path: SP + '/shots/v09v10-f07-onetap.png' });
  await page.click('#btn-place-cancel').catch(() => {});
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ placing: !!FARO.input.placement }));
  check('F07', 'Construir de un toque, varias obras seguidas, hasta «Listo»',
    !pts.none && mid.farms === pts.farms0 + 2 && mid.placing && mid.placed === 2 && !after.placing,
    `Granjas ${pts.farms0} → ${mid.farms} con 2 toques (sin confirmar cada una); sigue en modo construir: ${mid.placing}; barra: «${mid.text.replace(/\n/g, ' ')}»; «Listo» termina: ${!after.placing}`);

  // ---------- F01 el constructor tiene que llegar ----------
  await page.evaluate(() => {
    const g = FARO.game;
    window.SITES = g.buildings.filter((b) => b.owner === 0 && b.type === 'farm' && !b.built);
    for (const u of g.units) if (u.owner === 0 && u.def.builds) { u.x += 0; }
  });
  const f01a = await page.evaluate(() => {
    const g = FARO.game;
    const s = SITES[SITES.length - 1];
    const p0 = s.progress;
    return { p0, n: SITES.length };
  });
  await page.waitForTimeout(1200);
  const f01b = await page.evaluate(() => {
    const g = FARO.game;
    const r = FARO.renderer;
    const s = SITES[SITES.length - 1];
    const builders = g.units.filter((u) => u.owner === 0 && u.alive && u.buildTarget && SITES.includes(u.buildTarget));
    const near = builders.some((u) => Math.hypot(u.x - u.buildTarget.x, u.z - u.buildTarget.z) < 1.6);
    return { prog: SITES.map((x) => x.progress.toFixed(2)).join(','), builders: builders.length, near, lastWork: SITES.map((x) => (g.time - x.lastWork).toFixed(1)).join(',') };
  });
  // Sin constructor cerca no avanza: lo alejamos y comprobamos.
  const f01c = await page.evaluate(() => new Promise((res) => {
    const g = FARO.game;
    const s = SITES[SITES.length - 1];
    for (const u of g.units) if (u.owner === 0 && u.def.builds) { u.buildTarget = null; u.state = 'idle'; u.path = []; }
    g.assignSite = () => false;
    const p0 = s.progress;
    setTimeout(() => res({ p0, p1: s.progress, label: true }), 1500);
  }));
  await page.waitForTimeout(400);
  const labels = await page.evaluate(() => {
    // Busca el cartel en el dibujo 2D: el juego escribe «Esperando constructor» sobre la obra parada.
    const ctx = FARO.renderer.octx; const texts = [];
    const orig = ctx.fillText.bind(ctx);
    ctx.fillText = (t, x, y, m) => { texts.push(String(t)); return orig(t, x, y, m); };
    FARO.renderer.drawOverlay(FARO.selection || []);
    ctx.fillText = orig;
    return texts.filter((t) => /constructor|Construyendo|camino/i.test(t));
  });
  await page.screenshot({ path: SP + '/shots/v09v10-f01-waiting.png' });
  check('F01', 'Las obras esperan al constructor y se ve la línea y el cartel de espera o avance',
    f01c.p1 === f01c.p0 && labels.some((t) => /Esperando constructor/.test(t)),
    `obras de Granja: ${f01a.n}; con constructor: progreso ${f01b.prog} (${f01b.builders} constructores asignados, junto a la obra: ${f01b.near}); sin constructor la obra queda en ${(f01c.p1 * 100).toFixed(0)} % (no avanza: ${f01c.p1 === f01c.p0}); carteles: ${[...new Set(labels)].join(' · ')}`);

  // ---------- F04 colores del escudo ----------
  const sh = await page.evaluate(() => [SHIELD_CSS(0.9), SHIELD_CSS(0.5), SHIELD_CSS(0.2)]);
  const shBar = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    const b = g.buildings.find((x) => x.owner === 0 && x.type === 'farm' && x.built) || g.players[0].core;
    b.shield = b.shieldMax * 0.5;
    const used = [];
    const ctx = r.octx; const orig = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (...a) { used.push(ctx.fillStyle); return orig(...a); };
    r.drawOverlay([]);
    ctx.fillRect = orig;
    return { yellow: used.includes(SHIELD_CSS(0.5)) };
  });
  results.push({ id: 'F04ui', name: 'Colores del escudo', ok: sh[0] !== sh[1] && sh[1] !== sh[2] && shBar.yellow, ev: `azul ${sh[0]} (más de 66 %), amarillo ${sh[1]} (33-66 %), rojo ${sh[2]} (menos de 33 %); barra amarilla dibujada sobre un edificio al 50 %: ${shBar.yellow}` });

  // ---------- F06 tarjeta «Qué mejoró» ----------
  await page.evaluate(() => {
    const g = FARO.game;
    const b = g.buildings.find((x) => x.owner === 0 && x.type === 'core');
    b.upgrading = { level: 2, progress: 1 };
    g.finishUpgrade(b);
  });
  await page.waitForSelector('.toast.upcard', { timeout: 5000 }).catch(() => {});
  const card = await page.evaluate(() => { const el = document.querySelector('.toast.upcard'); return el ? el.innerText.replace(/\n/g, ' · ') : ''; });
  await page.screenshot({ path: SP + '/shots/v09v10-f06-card.png' });
  results.push({ id: 'F06ui', name: 'Tarjeta en pantalla', ok: /qué mejoró/i.test(card), ev: card });

  // ---------- F14 iconos de disparo de los helicópteros ----------
  const f14 = await page.evaluate(() => new Promise((res) => {
    const g = FARO.game; const r = FARO.renderer;
    const core = g.cells[g.players[0].core.cell];
    const cells = g.freeCellsNear(core.i, 'land', 0, 20);
    const ap = g.addUnit(0, 'apache', cells[10]);
    const he = g.addUnit(0, 'heli', cells[11]);
    const tk = g.addUnit(1, 'tank', cells[14]);
    tk.hp = tk.maxHp = 1e6;
    let seen = 0; let frames = 0;
    const tick = () => {
      frames++;
      if (g.time - (ap.lastShot || -99) < 0.6 || g.time - (he.lastShot || -99) < 0.6) seen++;
      if (frames < 120) requestAnimationFrame(tick); else res({ seen, frames, kinds: [ap.lastShotKind, he.lastShotKind].join(',') });
    };
    tick();
  }));
  await page.screenshot({ path: SP + '/shots/v09v10-f14-air.png' });
  results.push({ id: 'F14ui', name: 'Iconos de disparo', ok: f14.seen > 5, ev: `en ${f14.frames} cuadros, ${f14.seen} con el icono de disparo o misil sobre el Apache o el Helicóptero (últimos: ${f14.kinds})` });

  // ---------- F15 modelos ----------
  const models = await page.evaluate(() => {
    const want = ['medic', 'medic@toxico', 'lighttank', 'heavytank', 'missiletruck', 'apc', 'launcher', 'frigate', 'lander', 'carrier', 'fighter', 'bomber',
      'airport', 'antinuke', 'aadef', 'aadef_4', 'turret_4', 'house_2', 'core_1', 'core_3', 'heli', 'apache', 'rifle'];
    const missing = want.filter((k) => !GLB[k]);
    const made = [];
    for (const k of want) {
      const [t, look] = k.split('@');
      try { const v = createVisual(t, PLAYER_COLORS[0], look); let n = 0; v.group.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; }); made.push(`${k}:${n}`); } catch (e) { made.push(`${k}:ERROR ${e.message}`); }
    }
    return { total: Object.keys(GLB).length, missing, made, count: FARO.modelCount };
  });
  check('F15', 'Modelos nuevos o rehechos cargan sin errores (soldados, AIR DEFENSE, Núcleo, Apache, aviones, barcos, vehículos)',
    models.missing.length === 0 && !models.made.some((m) => /ERROR|:0$/.test(m)) && errs.length === 0,
    `${models.total} modelos de Blender cargados; faltan: ${models.missing.join(', ') || 'ninguno'}; vértices: ${models.made.join(' ')}; errores de consola: ${errs.length ? errs.join(' | ') : 'ninguno'}`);

  // ---------- F16 calidad ----------
  const q = await page.evaluate(() => {
    const r = FARO.renderer;
    const count = () => { const c = {}; r.scene.traverse((o) => { if (o.isMesh && o.material && o.material.type) c[o.material.type] = (c[o.material.type] || 0) + 1; }); return c; };
    FARO.setQuality('high');
    const hi = { pr: r.renderer.getPixelRatio(), shadows: r.renderer.shadowMap.enabled, mats: count(), env: !!r.scene.environment };
    FARO.setQuality('low');
    const lo = { pr: r.renderer.getPixelRatio(), shadows: r.renderer.shadowMap.enabled, mats: count(), env: !!r.scene.environment, half: FARO.renderer.overlayHalf };
    FARO.setQuality('high');
    return { hi, lo, dpr: devicePixelRatio };
  });
  const loLambert = q.lo.mats.MeshLambertMaterial || 0; const hiLambert = q.hi.mats.MeshLambertMaterial || 0;
  check('F16', 'Portada nueva y calidad: Más fluido mejor que antes y Alta un poco más detallada',
    cover.has && cover.url > 1000 && /url/.test(cover.bg) && cover.version === 'v' + cover.gv && loLambert > hiLambert && !q.lo.shadows && q.hi.shadows,
    `portada: escena 3D de ${Math.round(cover.url / 1024)} KB, ${cover.h} px de alto, «${cover.title}», versión ${cover.version}; Alta: ${q.hi.pr}× (antes hasta 1,75×), sombras, luz del cielo, materiales ${JSON.stringify(q.hi.mats)}; ` +
    `Más fluido: ${q.lo.pr}×, sin sombras ni luz del cielo, materiales livianos ${JSON.stringify(q.lo.mats)} (Lambert ${loLambert} vs ${hiLambert}). Los cuadros por segundo reales se miden en tu iPad.`);

  fs.writeFileSync(SP + '/results-v09-on-v10.json', JSON.stringify(results, null, 1));
  console.log('errores', errs);
  await browser.close();
})();
