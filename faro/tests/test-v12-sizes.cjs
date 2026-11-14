// I10: nada tapado ni fuera de pantalla en 5 tamaños, con las pantallas de la v1.1 y las nuevas de la v1.2.
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
    if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) bad.push(`${n} fuera de pantalla (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
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


// Caja dentro de la pantalla (y, si se pide, sin tapar la barra de arriba).
// En el vestíbulo la pantalla se desplaza hacia abajo: ahí solo cuenta el ancho (onlyX).
const INSIDE = ([sel, label, onlyX]) => {
  const bad = [];
  for (const el of document.querySelectorAll(sel)) {
    if (!el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1) continue;
    if (r.left < -1 || r.right > innerWidth + 1 || (!onlyX && (r.top < -1 || r.bottom > innerHeight + 1))) bad.push(`${label} fuera (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
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
    // v1.4: con BIGTEXT=1, la misma prueba con «Letra grande» y «Colores para daltonismo».
    if (process.env.BIGTEXT) await page.addInitScript(() => { localStorage.setItem('faro-bigtext', '1'); localStorage.setItem('faro-cvd', '1'); });
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
    // v1.1: panel «Rangos».
    await page.click('[data-sub="ranks"]');
    await page.waitForTimeout(250);
    res.rangos = await page.evaluate(PROBE_SCREEN);
    await page.screenshot({ path: `${SP}/shots/h09-${name}-ranks.png` });
    // v1.2: tabla de la Clasificatoria (cada fila dentro del ancho del panel).
    res.tabla = await page.evaluate(() => {
      const bad = [];
      const ol = document.getElementById('ladder');
      if (!ol) return ['falta la tabla'];
      const box = ol.getBoundingClientRect();
      for (const li of ol.querySelectorAll('li')) { const r = li.getBoundingClientRect(); if (r.right > box.right + 1 || r.right > innerWidth + 1) { bad.push('fila de la tabla se sale'); break; } }
      if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('desborde horizontal');
      return bad;
    });
    // v1.2: Taller y ventana de mapas con miniaturas.
    await page.evaluate(() => { const P = Profile.data; P.plans = { selva_veh: true, marea_core: true }; P.fragments = 70; FARO.lobby.view = 'shop'; FARO.lobby.shopTab = 'workshop'; FARO.lobby.render(); });
    await page.waitForTimeout(250);
    res.taller = (await page.evaluate(PROBE_SCREEN)).concat(await page.evaluate(INSIDE, ['.shopgrid .item.plan', 'plano', true]));
    await page.screenshot({ path: `${SP}/shots/i10-${name}-workshop.png` });
    await page.evaluate(() => { FARO.lobby.view = 'play'; FARO.lobby.sub = 'main'; FARO.lobby.render(); FARO.lobby.openModal('maps'); });
    await page.waitForTimeout(400);
    res.mapas = await page.evaluate(() => {
      const bad = [];
      const m = document.querySelector('#modal .panel, #modal > *');
      for (const c of document.querySelectorAll('.mapcard')) {
        const r = c.getBoundingClientRect(); const i = c.querySelector('img').getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.left < -1) bad.push('carta de mapa fuera');
        if (i.width < 60 || i.right > r.right + 1) bad.push('miniatura cortada');
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) bad.push('desborde horizontal');
      return [...new Set(bad)];
    });
    await page.screenshot({ path: `${SP}/shots/i10-${name}-maps.png` });
    await page.evaluate(() => FARO.lobby.closeModal());
    await page.click('[data-sub="custom"]');
    await page.waitForTimeout(300);
    res.personalizado = (await page.evaluate(PROBE_SCREEN)).concat(await page.evaluate(INSIDE, ['.mapopt', 'miniatura', true]));
    await page.evaluate(() => { const el = document.querySelector('.mapthumbs'); if (el) el.scrollIntoView({ block: 'center' }); });
    await page.screenshot({ path: `${SP}/shots/i10-${name}-custom.png` });
    await page.click('[data-sub="main"]');
    await page.evaluate(() => { FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame(); });
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
    // v1.2: rueda de selección (abierta en el centro y en una esquina).
    for (const [tag, fx, fy] of [['centro', 0.5, 0.5], ['esquina', 0.04, 0.95]]) {
      await page.evaluate(([a, b]) => { FARO.setSelection([]); FARO.ui.showWheel(innerWidth * a, innerHeight * b); }, [fx, fy]);
      await page.waitForTimeout(200);
      const bad = await page.evaluate(() => {
        const out = [];
        const opts = [...document.querySelectorAll('#wheel .wheel-opt')].map((b) => b.getBoundingClientRect());
        if (opts.length !== 8) out.push('rueda sin 8 opciones');
        for (const r of opts) if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) { out.push('opción de la rueda fuera'); break; }
        for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) {
          const a = opts[i]; const b = opts[j];
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left); const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 4 && h > 4) { out.push('opciones de la rueda se tapan'); i = 99; break; }
        }
        for (const r of opts) if (r.height < 36 || r.width < 44) { out.push(`opción chica ${Math.round(r.width)}×${Math.round(r.height)}`); break; }
        return out;
      });
      res['rueda-' + tag] = bad;
      if (tag === 'centro') await page.screenshot({ path: `${SP}/shots/i10-${name}-wheel.png` });
      await page.evaluate(() => FARO.ui.hideWheel());
    }
    // v1.2: ventana de mensajes.
    await page.evaluate(() => { const g = FARO.game; g.say(1, 'Mensaje de prueba bastante largo para ver si la ventana corta bien el texto en pantallas chicas.', { force: true, toMe: true }); FARO.ui.chatKey = null; FARO.ui.togglePop('chat'); });
    await page.waitForTimeout(250);
    res.mensajes = await page.evaluate(INSIDE, ['#chatpop', 'ventana de mensajes']);
    await page.screenshot({ path: `${SP}/shots/i10-${name}-chat.png` });
    await page.evaluate(() => FARO.ui.togglePop(null));
    // v1.2: pausa con Temporada y Música.
    await page.evaluate(() => FARO.togglePause(true));
    await page.waitForTimeout(250);
    res.pausa = await page.evaluate(() => {
      const bad = [];
      const btns = [...document.querySelectorAll('[data-season], [data-music]')].filter((b) => b.getClientRects().length);
      if (btns.length < (document.querySelector('[data-season]') ? 8 : 4)) bad.push('faltan botones de temporada o música');
      for (const b of btns) { const r = b.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.left < -1) { bad.push('botón de la pausa fuera'); break; } if (r.height < 30) { bad.push('botón de la pausa chico'); break; } }
      return bad;
    });
    await page.evaluate(() => { const b = document.querySelector('[data-season="winter"]'); if (b) b.scrollIntoView({ block: 'center' }); });
    await page.screenshot({ path: `${SP}/shots/i10-${name}-pause.png` });
    await page.evaluate(() => FARO.togglePause(false));
    // v1.1: marcador con «Aliarse» (todos contra todos).
    await page.evaluate(() => { FARO.setSelection([]); FARO.ui.togglePop('score'); });
    await page.waitForTimeout(300);
    res.marcador = await page.evaluate(() => {
      const bad = [];
      const el = document.getElementById('score');
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) bad.push(`marcador fuera (${Math.round(r.right)}×${Math.round(r.bottom)})`);
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible') bad.push('marcador más ancho');
      const btns = el.querySelectorAll('[data-ally]');
      if (!btns.length) bad.push('sin «Aliarse»');
      for (const b of btns) { const q = b.getBoundingClientRect(); if (q.height < 28) bad.push('«Aliarse» chico'); }
      return bad;
    });
    await page.screenshot({ path: `${SP}/shots/h09-${name}-score.png` });
    await page.evaluate(() => FARO.ui.togglePop(null));
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
    // v1.2: tutorial con señales (aro y texto dentro de la pantalla).
    await page.evaluate(() => { FARO.input.cancelPlacement(); FARO.opts = { mode: 'tutorial', mapKind: 'continent', difficulty: 'easy', seed: 1414 }; FARO.startGame(); FARO.focusCore(); });
    await page.waitForTimeout(500);
    res.tutorial = await page.evaluate(() => {
      const bad = [];
      FARO.ui.updateCoach();
      const c = document.getElementById('coach');
      if (!c || c.hidden) return ['sin señal del tutorial'];
      for (const sel of ['.coach-tip', '.coach-ring']) {
        const el = c.querySelector(sel);
        if (el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) bad.push(sel.slice(1) + ' fuera');
      }
      return bad;
    });
    await page.screenshot({ path: `${SP}/shots/i10-${name}-coach.png` });
    await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame(); });
    await page.waitForTimeout(300);
    // v1.1: derrota con gráficas y «Seguir mirando», y la barra de espectador.
    await page.evaluate(() => { FARO.input.cancelPlacement(); const g = FARO.game; for (let i = 0; i < 400; i++) g.update(0.1); g.kill(g.players[0].core, 1); g.checkEnd(); });
    await page.waitForSelector('#end:not([hidden])', { timeout: 20000 });
    res.finalGraficas = await page.evaluate(PROBE_SCREEN);
    const chartsOk = await page.evaluate(() => [...document.querySelectorAll('#enddialog .histchart')].every((f) => { const r = f.getBoundingClientRect(); return r.width > 150 && r.right <= innerWidth + 1; }));
    if (!chartsOk) res.finalGraficas.push('gráficas cortadas');
    await page.screenshot({ path: `${SP}/shots/h09-${name}-end.png` });
    if (await page.$('#btn-spectate')) {
      await page.evaluate(() => document.getElementById('btn-spectate').click());
      await page.waitForTimeout(300);
      res.espectador = await page.evaluate(() => {
        const bad = [];
        const r = document.getElementById('specbar').getBoundingClientRect();
        if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) bad.push('barra de espectador fuera');
        const top = document.querySelector('.topbar').getBoundingClientRect();
        if (r.top < top.bottom - 2 && r.left < top.right && r.right > top.left) bad.push('barra de espectador tapa la barra de arriba');
        return bad;
      });
      await page.screenshot({ path: `${SP}/shots/h09-${name}-spec.png` });
    }
    const fails = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join('; ')}`);
    out.push({ name, ok: fails.length === 0 && errs.length === 0, fails, errs });
    console.log(name, fails.length ? 'FALLA ' + fails.join(' | ') : 'ok', errs.join(' '));
    await page.context().close();
  }
  if (!only) fs.writeFileSync(SP + (process.env.BIGTEXT ? '/results-v14-sizes-big.json' : '/results-v12-sizes.json'), JSON.stringify(out, null, 1));
  await browser.close();
})();
