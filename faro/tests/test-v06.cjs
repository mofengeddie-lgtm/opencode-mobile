// C05-C08 y C10-C14 del PRD v0.6 en Chromium.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
async function open(browser, w = 1180, h = 820) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  await page.evaluate(() => { FARO.__legacy = false; FARO.setOption('mode', 'duel'); FARO.setOption('mapKind', 'archipelago'); FARO.startGame(); });
  await page.waitForTimeout(300);
  return page;
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await open(browser);
  // C05 calidad automática
  const auto = await page.evaluate(() => {
    const a = FARO; a.setQuality('auto');
    const start = a.quality;
    const steps = [25, 30, 28, 22].map((f) => a.autoQuality(f));
    const after = a.quality; const toast = document.getElementById('toasts').textContent;
    a.setQuality('auto');
    const highSteps = [55, 58, 60, 52, 57, 59].map((f) => a.autoQuality(f));
    return { start, steps, after, toast: /más fluido \(automático/.test(toast), back: a.quality, stays: highSteps.every((x) => !x) && a.quality === 'high' };
  });
  check('C05', 'Automática: con pocos cuadros por segundo pasa a Más fluido y avisa; con muchos se queda en Alta',
    auto.start === 'high' && auto.steps.join() === 'false,false,false,true' && auto.after === 'low' && auto.toast && auto.stays,
    `empieza en ${auto.start}; 25-30-28-22 fps → cambia al 4.º segundo: ${auto.steps.join(',')} → ${auto.after}, aviso ${auto.toast}; con 52-60 fps se queda en ${auto.back}`);
  // C06 qué cambia en Más fluido
  const q = await page.evaluate(() => {
    const a = FARO; const r = a.renderer;
    const read = () => ({ shadows: r.renderer.shadowMap.enabled, env: !!r.scene.environment, ratio: r.renderer.getPixelRatio(), fx: r.fxs.scale });
    a.setQuality('high'); const hi = read();
    a.setQuality('low'); const lo = read();
    // partículas: misma secuencia de explosiones en las dos calidades
    const count = (scale) => { r.fxs.scale = scale; const s0 = r.fxs.spawned; for (let i = 0; i < 200; i++) r.fxs.explosion(0, 0.5, 0, 1, false); return r.fxs.spawned - s0; };
    const nHi = count(1); const nLo = count(0.5);
    a.setQuality('high');
    return { hi, lo, nHi, nLo };
  });
  check('C06', 'Más fluido apaga sombras y luz del cielo, usa resolución normal y la mitad de partículas',
    q.hi.shadows && q.hi.env && q.hi.fx === 1 && !q.lo.shadows && !q.lo.env && q.lo.ratio === 1 && q.lo.fx === 0.5 && Math.abs(q.nLo / q.nHi - 0.5) < 0.12,
    `Alta ${JSON.stringify(q.hi)}; Más fluido ${JSON.stringify(q.lo)}; partículas en 200 explosiones: ${q.nHi} → ${q.nLo} (${Math.round((q.nLo / q.nHi) * 100)} %)`);
  // C07 contador
  await page.click('#btn-pause');
  await page.click('#btn-fps');
  await page.click('#btn-resume');
  await page.waitForFunction(() => /\d+ fps/.test(document.getElementById('fps').textContent) && !document.getElementById('fps').hidden, null, { timeout: 8000 }).catch(() => {});
  const fpsOn = await page.evaluate(() => ({ hidden: document.getElementById('fps').hidden, text: document.getElementById('fps').textContent, saved: localStorage.getItem('faro-fps') }));
  await page.screenshot({ path: SP + '/shots/v06-fps.png' });
  await page.click('#btn-pause');
  await page.click('#btn-fps');
  const fpsOff = await page.evaluate(() => ({ hidden: document.getElementById('fps').hidden, btn: document.getElementById('btn-fps').textContent }));
  await page.click('#btn-resume');
  check('C07', 'el contador de cuadros por segundo se enciende y apaga desde la pausa', !fpsOn.hidden && /\d+ fps/.test(fpsOn.text) && fpsOn.saved === 'on' && fpsOff.hidden,
    `encendido: «${fpsOn.text}» (guardado ${fpsOn.saved}); apagado: oculto ${fpsOff.hidden}, botón «${fpsOff.btn}»`);
  // C10 modelos
  const models = await page.evaluate(() => {
    const need = { barracks: 'main', factory: 'main', harbor: 'main', house: 'main', solar: 'main', wind: 'blades+main', hydro: 'blades+main', tidal: 'blades+main',
      wave: 'main+rocker', sub: 'main', apache: 'main+rotor', aa: 'main+turret', miniturret: 'main+turret', outpost: 'main', hospital_1: 'main', hospital_2: 'main', hospital_3: 'main' };
    const bad = Object.entries(need).filter(([k, p]) => !GLB[k] || Object.keys(GLB[k].parts).sort().join('+') !== p).map(([k]) => k);
    const g = FARO.game; const r = FARO.renderer; const me = g.players[0];
    me.coins = 1e6;
    const spot = (t) => g.cells.find((c) => !g.placeInvalid(0, t, c.i, true) && !c.bld);
    const placed = {};
    for (const t of ['wind', 'hydro', 'tidal', 'wave', 'aadef']) { const c = spot(t); if (c) placed[t] = g.addBuilding(0, t, c.i, true); }
    r.syncEntities(0, 0);
    const before = {}; for (const [t, b] of Object.entries(placed)) { const v = r.vis.get(b.id); before[t] = [v.blades && v.blades.rotation.x + v.blades.rotation.z, v.rocker && v.rocker.rotation.x, v.rotor && v.rotor.rotation.y]; }
    for (let i = 0; i < 10; i++) r.syncEntities(0.1, 1 + i * 0.1);
    const moved = Object.entries(placed).map(([t, b]) => { const v = r.vis.get(b.id); const now = [v.blades && v.blades.rotation.x + v.blades.rotation.z, v.rocker && v.rocker.rotation.x, v.rotor && v.rotor.rotation.y]; return t + ':' + now.some((x, k) => x !== undefined && x !== before[t][k]); });
    return { bad, moved, n: Object.keys(GLB).length };
  });
  check('C10', 'los 15 modelos nuevos cargan sin errores y sus piezas se mueven', models.bad.length === 0 && models.moved.every((m) => m.endsWith('true')) && page.errs.length === 0,
    `${models.n} modelos; con piezas correctas: ${17 - models.bad.length}/17 (incluye Enfermería 1-3)${models.bad.length ? ' faltan ' + models.bad.join(',') : ''}; se mueven: ${models.moved.join(', ')}; lámina shots/models-v06.png`);
  // C11 efectos
  const fx = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer; const me = g.players[0];
    const core = g.cells[me.core.cell];
    const land = g.freeCellsNear(core.i, 'land', 0, 20);
    const s0 = r.fxs.spawned;
    const tank = g.addUnit(0, 'tank', land[3]); const rk = g.addUnit(0, 'rocket', land[4]); const rf = g.addUnit(0, 'rifle', land[5]);
    const foe = g.addUnit(1, 'tank', land[8]); foe.hp = foe.maxHp = 1e6;
    let trail = 0; let flash = 0;
    for (let i = 0; i < 60; i++) { g.update(0.05); const before = r.fxs.soft.head; r.frame(0.05, 30 + i * 0.05, []); }
    const afterFight = r.fxs.spawned - s0;
    const sea = g.cells.find((c) => c.t === 'deep' && !c.bld);
    const splashBefore = r.fxs.spawned;
    r.spawnBoom(sea.x, 0, sea.z, 0.6, true);
    const splash = r.fxs.spawned - splashBefore;
    for (let i = 0; i < 400; i++) r.fxs.explosion(core.x, 1, core.z, 1.5, true);
    r.fxs.update(0.01);
    return { afterFight, splash, count: r.fxs.count, cap: r.fxs.capacity, overWater: r.overWater(sea.x, sea.z) };
  });
  check('C11', 'explosiones, fogonazos, estelas, chispas y salpicaduras aparecen y respetan el tope de partículas',
    fx.afterFight > 20 && fx.splash >= 5 && fx.overWater && fx.count <= fx.cap, `en 3 s de pelea: ${fx.afterFight} partículas; impacto en el mar: ${fx.splash} gotas; con 400 explosiones seguidas: ${fx.count} visibles, tope ${fx.cap}`);
  // C12 humo de daño
  const smoke = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    const b = g.buildings.find((x) => x.owner === 0 && x.type === 'farm');
    b.hp = b.maxHp * 0.3;
    const s0 = r.fxs.spawned;
    for (let i = 0; i < 20; i++) r.syncEntities(0.1, 50 + i * 0.1);
    const smoking = r.smokingCount; const puffs = r.fxs.spawned - s0;
    b.hp = b.maxHp;
    r.syncEntities(0.1, 53);
    return { smoking, puffs, after: r.smokingCount };
  });
  check('C12', 'un edificio con menos del 40 % de vida echa humo y deja de hacerlo al repararlo', smoke.smoking >= 1 && smoke.puffs >= 4 && smoke.after === 0,
    `al 30 %: ${smoke.smoking} edificio echando humo, ${smoke.puffs} bocanadas en 2 s; reparado: ${smoke.after}`);
  // C13 sonidos
  const snd = await page.evaluate(async () => {
    const s = FARO.sound; s.on = true; s.unlock();
    for (let i = 0; i < 20 && s.ctx.state !== 'running'; i++) await new Promise((r) => setTimeout(r, 50));
    const names = ['bullet', 'minigun', 'flak', 'laser', 'rocket', 'missile', 'shell', 'torpedo', 'boom', 'bigboom', 'build', 'heal', 'capture', 'click', 'place', 'done'];
    let errors = 0;
    const v0 = s.voices || 0;
    for (const n of names) { try { s.last = {}; s.play(n); } catch (e) { errors++; } await new Promise((r) => setTimeout(r, 30)); }
    const played = (s.voices || 0) - v0;
    s.ends = [];
    for (let i = 0; i < 120; i++) { s.last = {}; s.play(i % 2 ? 'boom' : 'shell'); }
    const now = s.ctx.currentTime;
    return { state: s.ctx.state, errors, played, active: s.ends.filter((t) => t > now).length };
  });
  check('C13', 'los sonidos nuevos suenan sin errores y se limita cuántos suenan a la vez', snd.state === 'running' && snd.errors === 0 && snd.played >= 11 && snd.active <= 24,
    `audio ${snd.state}; 16 sonidos sin errores (${snd.played} de efecto con voz propia + interfaz); con 120 explosiones seguidas suenan como máximo ${snd.active} a la vez (tope 24)`);
  const errsMain = [...page.errs];
  await page.context().close();
  // C08 rendimiento comparado
  const perf = await open(browser);
  // Tiempo de dibujo por cuadro (promedio de 8 cuadros tras 2 de calentamiento), más estable que contar cuadros a ~1,5 fps.
  const msOf = (q) => perf.evaluate((q) => {
    const a = FARO; const r = a.renderer; a.setQuality(q);
    for (let i = 0; i < 2; i++) r.frame(0.016, 100 + i, a.selection);
    const gl = r.renderer.getContext();
    const px = new Uint8Array(4);
    const t0 = performance.now();
    for (let i = 0; i < 8; i++) {
      r.frame(0.016, 102 + i * 0.016, a.selection);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // espera a que el dibujo termine de verdad
    }
    return (performance.now() - t0) / 8;
  }, q);
  await perf.evaluate(() => {
    const g = FARO.game;
    g.bots.forEach((b) => { b.update = () => {}; });
    FARO.paused = true;
    const types = ['rifle', 'rifle', 'shotgun', 'tank', 'jeep', 'rocket', 'sniper', 'aa'];
    for (const p of [0, 1]) { const cs = g.freeCellsNear(g.players[p].core.cell, 'land', p, 100); for (let i = 0; i < 100 && i < cs.length; i++) g.addUnit(p, types[i % types.length], cs[i]); }
    const r = FARO.renderer; r.cam.dist = 34; r.updateCamera();
  });
  const runs = [];
  for (let k = 0; k < 2; k++) runs.push([await msOf('high'), await msOf('low')]);
  const msHigh = Math.min(...runs.map((x) => x[0]));
  const msLow = Math.min(...runs.map((x) => x[1]));
  const nUnits = await perf.evaluate(() => FARO.game.units.length);
  check('C08', 'escena grande (200 tropas): Más fluido dibuja cada cuadro más rápido que Alta en el emulador', msLow < msHigh,
    `${nUnits} tropas, emulador sin GPU: Alta ${msHigh.toFixed(0)} ms por cuadro, Más fluido ${msLow.toFixed(0)} ms (${Math.round((1 - msLow / msHigh) * 100)} % menos)`);
  await perf.context().close();
  // C14 tamaños
  const sizes = [['iPad horizontal', 1180, 820], ['16:9', 1280, 720], ['iPad vertical', 820, 1180], ['celular horizontal', 844, 390], ['celular vertical', 390, 844]];
  const problems = [];
  for (const [name, w, h] of sizes) {
    const pg = await open(browser, w, h);
    await pg.evaluate(() => FARO.toggleFps(true));
    await pg.waitForTimeout(1500);
    const bad = await pg.evaluate(() => {
      const ids = ['objectives', 'buildpanel', 'miniwrap', 'quick', 'selpanel', 'btn-build', 'king', 'fps'];
      const boxes = [];
      for (const id of ids) { const el = document.getElementById(id); if (!el || el.hidden || getComputedStyle(el).display === 'none') continue; boxes.push([id, el.getBoundingClientRect()]); }
      document.querySelectorAll('.topbar > *').forEach((el, i) => boxes.push(['top' + i, el.getBoundingClientRect()]));
      const out = [];
      for (const [id, r] of boxes) if (r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)) out.push(id + ' fuera');
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i]; const [b, rb] = boxes[j];
        if (!ra.width || !rb.width) continue;
        if (a === 'fps' && b.startsWith('top')) continue; // el contador vive dentro de la barra superior
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 2 && oy > 2) out.push(`${a} tapa ${b}`);
      }
      return out;
    });
    await pg.click('#btn-pause');
    const pauseBad = await pg.evaluate(() => [...document.querySelectorAll('#pause button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); }).map((b) => b.textContent));
    await pg.screenshot({ path: `${SP}/shots/v06-${w}x${h}.png` });
    if (bad.length || pauseBad.length) problems.push(`${name}: ${bad.concat(pauseBad.map((t) => 'botón fuera ' + t)).join(', ')}`);
    await pg.context().close();
  }
  check('C14', 'nada tapado ni fuera de pantalla en 5 tamaños con el contador y el menú de gráficos', problems.length === 0, problems.join(' | ') || '5/5 tamaños sin problemas (contador encendido y menú de pausa abierto)');
  check('errores', 'sin errores de consola', errsMain.length === 0, JSON.stringify(errsMain.slice(0, 4)));
  fs.writeFileSync(SP + '/results-v06.json', JSON.stringify(results, null, 1));
  await browser.close();
})();
