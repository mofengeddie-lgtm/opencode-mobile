// Pruebas de la v1.8 en Chromium: O14 («Tu ejército» en el vestíbulo), O15 (Campo de pruebas y paneles nuevos),
// O16 (Ajustes «A tu manera» y pestaña Misiones) y O19 (tamaño, carga y fluidez frente a la v1.7).
// Uso: SP=<carpeta con three/ y faro17final.html> node test-v18.cjs   ·   ONLY=O14,O16 para correr solo algunas.
// Las capturas de O14 quedan en faro/docs/prd/img-v18/.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.env.SP || __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const FARO = '/home/user/opencode-mobile/faro';
const GAME = process.env.GAME || `file://${FARO}/faro.html`;
const GAME17 = `file://${SP}/faro17final.html`;
const THREE_JS = SP + '/three/node_modules/three/build/three.min.js';
const IMG = `${FARO}/docs/prd/img-v18`;
fs.mkdirSync(IMG, { recursive: true });
const errsAll = [];

async function open(browser, w, h, { url = GAME, init = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.route('**/three.min.js', (r) => r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const t0 = Date.now();
  await page.goto(url, { timeout: 180000 });
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 240000 });
  page.loadMs = Date.now() - t0;
  return page;
}
const close = async (page) => { errsAll.push(...page.errs); await page.context().close(); };
const settle = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 60000 }).catch(() => {});
// Toca el centro de un elemento solo si está a la vista y no lo tapa otro (como un dedo).
const tapBtn = async (page, sel) => {
  const hit = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, free: !!top && (top === el || el.contains(top)) };
  }, sel);
  if (hit) await page.mouse.click(hit.x, hit.y);
  return !!hit && hit.free;
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (id, fn) => {
    if (!want(id)) return;
    try { await fn(); } catch (e) { add(id, false, 'la prueba se cortó: ' + String(e.message || e).split('\n')[0].slice(0, 300)); }
  };

  // ---------- O14: «Tu ejército» detrás del vestíbulo ----------
  await run('O14', async () => {
    const sizes = [['ipad-horizontal', 1180, 820], ['ipad-vertical', 820, 1180], ['celular', 390, 844]];
    const parts = [];
    let pass = true;
    for (const [name, w, h] of sizes) {
      const page = await open(browser, w, h);
      await page.waitForTimeout(2500);
      await settle(page);
      await page.screenshot({ path: `${IMG}/vestibulo-${name}.png` });
      const s = await page.evaluate(() => {
        const g = FARO.game;
        const mine = g.units.filter((u) => u.owner === 0);
        const kinds = new Set(mine.map((u) => (u.mover === 'air' ? 'aire' : u.mover === 'sea' || u.cls === 'ship' ? 'mar' : u.cls === 'inf' ? 'infantería' : 'vehículos')));
        const blds = g.buildings.filter((b) => b.owner === 0).length;
        const tag = document.getElementById('armytag');
        const hero = document.querySelector('.cover.hero');
        return { showcase: !!g.showcase, preview: !!g.preview, n: g.showcaseCount, kinds: [...kinds], blds, tagShown: !!tag && !tag.hidden && getComputedStyle(tag).display !== 'none',
          heroLive: !!hero && getComputedStyle(hero.querySelector('.cover-img')).display === 'none', army: document.body.classList.contains('army') };
      });
      // La cámara gira sola: el ángulo cambia con el tiempo.
      const y0 = await page.evaluate(() => FARO.renderer.cam.yaw);
      await page.waitForTimeout(1500);
      const y1 = await page.evaluate(() => FARO.renderer.cam.yaw);
      const ok = s.showcase && s.preview && s.n >= 20 && s.kinds.length >= 3 && s.blds >= 8 && s.heroLive && y1 !== y0;
      if (!ok) pass = false;
      parts.push(`${name}: ${s.n} tropas (${s.kinds.join(', ')}), ${s.blds} edificios, portada en vivo ${s.heroLive ? 'sí' : 'no'}, etiqueta ${s.tagShown ? 'visible' : 'oculta'}, cámara gira ${y1 !== y0 ? 'sí' : 'no'}`);
      if (name === 'ipad-horizontal') {
        // Al entrar a la partida, la escena del vestíbulo se deja de usar.
        const before = await page.evaluate(() => { window.__pv = FARO.game; return FARO.game.units.length; });
        await tapBtn(page, '#btn-play');
        await page.waitForFunction(() => FARO.state === 'play', null, { timeout: 120000 });
        const after = await page.evaluate(() => ({ same: FARO.game === window.__pv, showcase: !!FARO.game.showcase, armyClass: document.body.classList.contains('army'), units: FARO.game.units.filter((u) => u.owner === 0).length }));
        const stops = !after.same && !after.showcase && after.units < before;
        if (!stops) pass = false;
        parts.push(`al tocar Jugar: partida nueva ${!after.same ? 'sí' : 'no'}, sin desfile ${!after.showcase ? 'sí' : 'no'} (${after.units} tropas tuyas)`);
        // Con «Más fluido», un desfile más chico.
        await page.evaluate(() => { FARO.toMenu(); FARO.setQuality('low'); FARO.makePreview(); });
        const low = await page.evaluate(() => FARO.game.showcaseCount);
        await page.evaluate(() => FARO.setQuality('auto'));
        if (!(low < s.n)) pass = false;
        parts.push(`con «Más fluido»: ${low} tropas`);
      }
      await close(page);
    }
    add('O14', pass, parts.join(' · ') + ` · capturas en docs/prd/img-v18/`);
  });

  // ---------- O15: Campo de pruebas desde el vestíbulo y paneles nuevos ----------
  await run('O15', async () => {
    const page = await open(browser, 1180, 820);
    await tapBtn(page, '[data-act="modal"][data-m="modes"]');
    await page.waitForTimeout(500);
    await settle(page);
    const listed = await page.evaluate(() => !!document.querySelector('[data-act="pickmode"][data-v="sandbox"]'));
    await tapBtn(page, '[data-act="pickmode"][data-v="sandbox"]');
    await page.waitForTimeout(400);
    await tapBtn(page, '#btn-play');
    await page.waitForFunction(() => FARO.state === 'play', null, { timeout: 120000 });
    const g0 = await page.evaluate(() => {
      const g = FARO.game;
      const p = g.players[0];
      const prods = g.buildings.filter((b) => b.owner === 0 && b.def.produces && b.type !== 'core').map((b) => b.type);
      return { sandbox: !!g.mode.sandbox, bots: g.bots.length, coins: Math.round(p.coins), pop: p.popCap, strategic: g.strategic, prods };
    });
    // Fábrica: todas sus tropas (también el Lanzador nuclear móvil, porque hay Arsenal estratégico).
    const cards = await page.evaluate(() => {
      const g = FARO.game;
      FARO.setSelection([g.buildings.find((b) => b.owner === 0 && b.type === 'factory')]);
      FARO.ui.renderSel(true);
      return document.querySelectorAll('#selpanel [data-act="train"]').length;
    });
    // Centro de investigación: tocar «Blindaje».
    await page.evaluate(() => {
      const g = FARO.game;
      FARO.setSelection([g.buildings.find((b) => b.owner === 0 && b.type === 'research')]);
      FARO.ui.renderSel(true);
    });
    await page.waitForTimeout(300);
    const tapped = await tapBtn(page, '#selpanel [data-act="research"][data-v="armor"]');
    await page.waitForTimeout(300);
    const res = await page.evaluate(() => {
      const b = FARO.game.buildings.find((x) => x.owner === 0 && x.type === 'research');
      return b.researching ? b.researching.key : null;
    });
    // Pestaña «Apoyo» del menú Construir y el Complejo estratégico en Defensa.
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#btabs [data-tab], #btabs button')].map((b) => b.textContent.trim()));
    // Puerta: abrir y cerrar desde su panel.
    const gate = await page.evaluate(() => {
      const g = FARO.game;
      const core = g.cells[g.players[0].core.cell];
      const c = g.cells.filter((x) => !g.placeInvalid(0, 'gate', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
      const b = g.addBuilding(0, 'gate', c.i, true);
      FARO.setSelection([b]);
      FARO.ui.renderSel(true);
      return b.id;
    });
    await tapBtn(page, '#btn-gate');
    const closed = await page.evaluate((id) => FARO.game.buildings.find((b) => b.id === id).closed, gate);
    // Sin XP: terminar la partida no suma experiencia.
    const xp = await page.evaluate(() => {
      const before = Profile.data.xp;
      const g = FARO.game;
      g.over = true; g.result = 'victory';
      const r = FARO.lobby.finish(g);
      return { before, after: Profile.data.xp, lines: r.lines.join(' / ') };
    });
    const pass = listed && g0.sandbox && g0.bots === 0 && g0.coins >= 499000 && g0.pop === 240 && g0.strategic && g0.prods.length >= 6 && cards === 29 &&
      tapped && res === 'armor' && tabs.some((t) => /Apoyo/.test(t)) && closed === true && xp.after === xp.before;
    add('O15', pass, `modo en la lista: ${listed ? 'sí' : 'no'} · bots ${g0.bots} · monedas ${g0.coins} · población ${g0.pop} · Arsenal estratégico ${g0.strategic ? 'sí' : 'no'} · productores hechos: ${g0.prods.join(', ')} · Fábrica: ${cards} tropas · «Blindaje» tocado: ${res || 'no'} · pestañas: ${tabs.join(', ')} · puerta cerrada desde su panel: ${closed ? 'sí' : 'no'} · XP ${xp.before} → ${xp.after} (${xp.lines})`);
    await close(page);
  });

  // ---------- O16: Ajustes «A tu manera» y Misiones ----------
  await run('O16', async () => {
    const page = await open(browser, 1180, 820);
    await tapBtn(page, '[data-act="settings"]');
    await page.waitForTimeout(400);
    await settle(page);
    const secs = {};
    for (const s of ['interfaz', 'sonido', 'camara', 'accesibilidad', 'controles']) {
      await tapBtn(page, `[data-setsec="${s}"]`);
      await page.waitForTimeout(150);
      secs[s] = await page.evaluate((k) => {
        const pane = document.querySelector(`[data-setpane="${k}"]`);
        const r = pane.getBoundingClientRect();
        return !pane.hidden && r.height > 40 ? pane.querySelectorAll('button, input, li').length : 0;
      }, s);
    }
    await tapBtn(page, '[data-setsec="accesibilidad"]');
    const calmTap = await tapBtn(page, '#btn-calm');
    const calm1 = await page.evaluate(() => [FARO.calm, localStorage.getItem('faro-calm')]);
    await tapBtn(page, '[data-setsec="interfaz"]');
    await page.evaluate(() => { const s = document.getElementById('ui-scale'); s.value = '120'; s.dispatchEvent(new Event('input', { bubbles: true })); });
    const scale1 = await page.evaluate(() => FARO.uiScale);
    await page.reload();
    await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 240000 });
    const kept = await page.evaluate(() => [FARO.calm, FARO.uiScale]);
    await tapBtn(page, '[data-act="settings"]');
    await page.waitForTimeout(300);
    await settle(page);
    const resetTap = await tapBtn(page, '#btn-settings-reset');
    const reset = await page.evaluate(() => [FARO.calm, FARO.uiScale, FARO.qualityPref]);
    await tapBtn(page, '#btn-settings-back');
    const back = await page.evaluate(() => !!document.querySelector('#pause #btn-calm') && document.getElementById('settings').hidden);
    // Pestaña «Misiones».
    await tapBtn(page, '[data-view="missions"]');
    await page.waitForTimeout(300);
    await settle(page);
    const mis = await page.evaluate(() => ({ view: !!document.querySelector('.missionsview'), n: document.querySelectorAll('.missionsview .mission').length }));
    const pass = Object.values(secs).every((n) => n > 0) && calmTap && calm1[0] === true && calm1[1] === '1' && scale1 === 120 && kept[0] === true && kept[1] === 120 &&
      resetTap && reset[0] === false && reset[1] === 100 && reset[2] === 'auto' && back && mis.view && mis.n >= 3;
    add('O16', pass, `secciones con controles: ${Object.entries(secs).map(([k, n]) => `${k} ${n}`).join(', ')} · «Reducir destellos» y 120 %: ${calm1[0] && scale1 === 120 ? 'sí' : 'no'} · después de recargar: ${kept.join(' / ')} · «Restablecer»: destellos ${reset[0]}, ${reset[1]} %, calidad ${reset[2]} · los controles vuelven a la pausa: ${back ? 'sí' : 'no'} · Misiones: ${mis.n} misiones en la pestaña`);
    await close(page);
  });

  // ---------- O19: tamaño, carga y fluidez frente a la v1.7 ----------
  await run('O19', async () => {
    const size = fs.statSync(`${FARO}/faro.html`).size;
    const fps = async (url, q) => {
      const page = await open(browser, 1180, 820, { url });
      const loadMs = page.loadMs;
      await page.evaluate((qq) => {
        FARO.setQuality(qq); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame();
        const g = FARO.game; g.bots = [];
        const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 9);
        const types = ['rifle', 'tank', 'sniper', 'jeep', 'rocket', 'medic'];
        for (let i = 0; i < 90; i++) g.addUnit(0, types[i % types.length], sp[i % sp.length]);
        const core = g.cells[g.players[0].core.cell];
        for (const t of ['barracks', 'farm', 'solar', 'house', 'factory', 'turret', 'farm', 'solar']) { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; if (c) g.addBuilding(0, t, c.i, true); }
        FARO.focusCore(); FARO.renderer.cam.dist = 22;
      }, q);
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 12000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
      errsAll.push(...page.errs.filter((e) => !/faro17/.test(e)));
      await page.context().close();
      return { fps: r, loadMs };
    };
    const a = await fps(GAME17, 'low');
    const b = await fps(GAME, 'low');
    const a2 = await fps(GAME17, 'low');
    const b2 = await fps(GAME, 'low');
    const fps17 = (a.fps + a2.fps) / 2;
    const fps18 = (b.fps + b2.fps) / 2;
    const load17 = (a.loadMs + a2.loadMs) / 2;
    const load18 = (b.loadMs + b2.loadMs) / 2;
    const pass = size <= 6 * 1024 * 1024 && fps18 >= fps17 * 0.85 && load18 <= load17 * 1.15 + 1500;
    add('O19', pass, `faro.html: ${(size / 1048576).toFixed(2)} MB (máx. 6) · cuadros por segundo con 90 tropas (Más fluido, Chromium sin tarjeta gráfica): v1.7 ${fps17.toFixed(2)} · v1.8 ${fps18.toFixed(2)} · carga hasta el vestíbulo: v1.7 ${(load17 / 1000).toFixed(1)} s · v1.8 ${(load18 / 1000).toFixed(1)} s`);
  });

  const errs = [...new Set(errsAll)];
  add('errores', errs.length === 0, errs.length ? errs.slice(0, 5).join(' | ') : 'sin errores de página');
  fs.writeFileSync(`${FARO}/tests/results-v18${only ? '-' + only.join('') : ''}.json`, JSON.stringify(results, null, 1));
  console.log('FIN');
  await browser.close();
})();
