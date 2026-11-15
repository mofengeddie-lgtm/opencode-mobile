// Pruebas de la v1.6 en Chromium: M01 (carga), M02 (transiciones), M03 (motivos), M04 (alcance al colocar),
// M05 («Acerca de») y M09 (rendimiento frente a la v1.5).
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.env.SP || __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const GAME = 'file:///home/user/opencode-mobile/faro/faro.html';
const GAME15 = `file://${SP}/faro15.html`;
const THREE_JS = SP + '/three/node_modules/three/build/three.min.js';
const errsAll = [];

async function open(browser, w, h, { url = GAME, init = null, wait = true, three = true, media = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, reducedMotion: media || 'no-preference' });
  const page = await context.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.route('**/three.min.js', (r) => (three ? r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }) : r.abort()));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url, { timeout: 120000 });
  if (wait) await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 120000 });
  return page;
}
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);
const tapBtn = async (page, sel) => {
  const hit = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, free: !!top && (top === el || el.contains(top)) }; }, sel);
  if (hit) await page.mouse.click(hit.x, hit.y);
  return !!hit && hit.free;
};
const newGame = (page, extra = '') => page.evaluate((x) => {
  FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: x || 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame();
  const g = FARO.game; g.bots = []; FARO.focusCore();
}, extra);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------- M01 pantalla de carga ----------
  if (want('M01')) {
    // Traza de la barra y la fase mientras carga (antes de que corran los scripts del juego).
    const trace = () => {
      window.__boot = [];
      const t0 = performance.now();
      const id = setInterval(() => {
        const f = document.getElementById('boot-fill');
        const ph = document.getElementById('boot-phase');
        const d = document.getElementById('boot-detail');
        if (!f) { if (document.readyState === 'complete' && window.__boot.length) clearInterval(id); return; }
        const last = window.__boot[window.__boot.length - 1];
        const row = { t: Math.round(performance.now() - t0), w: parseFloat(f.style.width) || 0, ph: ph ? ph.textContent : '', d: d ? d.textContent : '' };
        if (!last || last.w !== row.w || last.ph !== row.ph || last.d !== row.d) window.__boot.push(row);
      }, 15);
    };
    const page = await open(browser, 1180, 820, { init: trace });
    await page.waitForTimeout(900);
    // Historial de lo que mostró la pantalla (cada cambio de fase o de avance, también los muy rápidos).
    const r = await page.evaluate(() => ({ hist: (window.FaroBoot || {}).hist || [], log: (window.FaroBoot || {}).log, gone: !document.getElementById('boot'), seen: (window.__boot || []).length }));
    const widths = r.hist.map((x) => x.pct);
    const mono = widths.every((w, i) => !i || w >= widths[i - 1]);
    const phases = [...new Set(r.hist.map((x) => x.text))];
    const models = r.hist.map((x) => x.detail).filter((d) => /\d+ de \d+/.test(d));
    errsAll.push(...page.errs);
    await page.context().close();
    // Fallo: sin motor 3D.
    const bad = await open(browser, 1180, 820, { three: false, wait: false });
    await bad.waitForTimeout(2500);
    const f = await bad.evaluate(() => ({ failed: !!document.querySelector('#boot.failed'), phase: (document.getElementById('boot-phase') || {}).textContent, detail: (document.getElementById('boot-detail') || {}).textContent, retry: !document.getElementById('boot-retry').hidden, h: Math.round(document.getElementById('boot-retry').getBoundingClientRect().height) }));
    await bad.screenshot({ path: `${SP}/shots/v16-m01-error.png` });
    // Vuelve la conexión: «Reintentar» recarga y el juego abre.
    await bad.unroute('**/three.min.js');
    await bad.route('**/three.min.js', (rr) => rr.fulfill({ path: THREE_JS, contentType: 'application/javascript' }));
    const free = await tapBtn(bad, '#boot-retry');
    let reopened = false;
    try { await bad.waitForFunction(() => window.FARO && window.FARO.loaded && !document.getElementById('boot'), null, { timeout: 120000 }); reopened = true; } catch (e) { /* no abrió */ }
    await bad.context().close();
    const ok = r.gone && mono && widths[widths.length - 1] === 100 && phases.some((p) => /3D/.test(p)) && phases.some((p) => /Modelos/.test(p)) && phases.some((p) => /Cielo/.test(p)) && phases.some((p) => /perfil/.test(p)) &&
      models.length >= 3 && f.failed && f.retry && f.h >= 44 && /motor 3D/.test(f.detail) && free && reopened;
    add('M01', ok, `al abrir: fases «${phases.join('» → «')}»; la barra avanzó en ${widths.length} pasos sin retroceder (orden de fases: ${(r.log || []).join(' → ')}) (${widths.slice(0, 4).join(', ')} … ${widths.slice(-3).join(', ')} %), con los modelos contados («${models[0] || ''}» … «${models[models.length - 1] || ''}»); la pantalla se retiró al terminar (${r.gone}). ` +
      `Sin el motor 3D: «${f.phase}» — «${f.detail}» y botón «Reintentar» de ${f.h} px; al volver la conexión, «Reintentar» abrió el juego (${reopened})`);
  }

  // ---------- M02 transiciones ----------
  if (want('M02')) {
    const anim = async (media, battery) => {
      const page = await open(browser, 1180, 820, { media });
      await newGame(page);
      if (battery) await page.evaluate(() => FARO.setBattery(true));
      await page.evaluate(() => { const g = FARO.game; const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 6); window.U = g.addUnit(0, 'rifle', sp[2]); FARO.setSelection([U]); });
      await page.waitForTimeout(80);
      const sel = await page.evaluate(() => getComputedStyle(document.getElementById('selpanel')).animationName);
      await page.evaluate(() => { FARO.setSelection([]); FARO.ui.toggleBuild(false); });
      await page.waitForTimeout(250);
      await page.evaluate(() => FARO.ui.toggleBuild(true));
      await page.waitForTimeout(40);
      const build = await page.evaluate(() => getComputedStyle(document.querySelector('#buildpanel .blist')).animationName);
      await page.evaluate(() => { FARO.quitToMenu ? FARO.quitToMenu() : null; });
      await page.evaluate(() => { FARO.state = 'menu'; FARO.ui.showScreen('menu'); FARO.lobby.openModal('about'); });
      await page.waitForTimeout(40);
      const modal = await page.evaluate(() => { const d = document.querySelector('#modal .dialog'); return d ? getComputedStyle(d).animationName : 'sin ventana'; });
      errsAll.push(...page.errs);
      await page.context().close();
      return { sel, build, modal };
    };
    const normal = await anim('no-preference', false);
    const reduce = await anim('reduce', false);
    const batt = await anim('no-preference', true);
    const ok = normal.sel === 'faroPanelIn' && normal.build === 'faroSideIn' && normal.modal === 'faroPop' &&
      [reduce, batt].every((x) => x.sel === 'none' && x.build === 'none' && x.modal === 'none');
    add('M02', ok, `normal: ficha «${normal.sel}», construir «${normal.build}», ventana «${normal.modal}»; con «Reducir movimiento»: ${reduce.sel} / ${reduce.build} / ${reduce.modal}; con ahorro de batería: ${batt.sel} / ${batt.build} / ${batt.modal}`);
  }

  // ---------- M03 motivos junto a la acción ----------
  if (want('M03')) {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    const out = [];
    let okAll = true;
    const why = async (tab, k) => page.evaluate(([t, kk]) => { FARO.ui.tab = t; FARO.ui.renderBuildList(); FARO.ui.refreshBuild(true); const el = document.querySelector(`#blist [data-why="${kk}"]`); const p = FARO.game.players[0]; const d = BUILDINGS[kk]; return { txt: el ? el.textContent : 'sin tarjeta', coins: Math.ceil(d.cost - p.coins), energy: Math.ceil((d.energyCost || 0) - p.energy) }; }, [tab, k]);
    await page.evaluate(() => { const p = FARO.game.players[0]; p.coins = 100; p.energy = 200; });
    const farm = await why('eco', 'farm');
    await page.evaluate(() => { const p = FARO.game.players[0]; p.coins = 50000; p.energy = 10; });
    const fac = await why('prod', 'factory');
    // Límite de Casas lleno.
    const lim = await page.evaluate(() => {
      const g = FARO.game; const core = g.cells[g.players[0].core.cell]; const L = g.limitFor(0, 'house');
      let n = g.count(0, 'house');
      for (const c of g.cells) { if (n >= L) break; if (!g.placeInvalid(0, 'house', c.i, true)) { g.addBuilding(0, 'house', c.i, true); n++; } }
      return L;
    });
    const house = await why('eco', 'house');
    await page.evaluate(() => { FARO.game.players[0].energy = 999; });
    const okB = farm.txt === `Faltan ${farm.coins} monedas` && fac.txt === `Faltan ${fac.energy} de energía` && house.txt === `Límite: ${lim} de ${lim}`;
    if (!okB) okAll = false;
    out.push(`Construir: Granja (300) con unas 100 monedas «${farm.txt}» (le faltan ${farm.coins}); Fábrica (50 de energía) con unos 10 «${fac.txt}» (le faltan ${fac.energy}); Casa con ${lim} hechas «${house.txt}»`);
    // Entrenar.
    const card = async (t) => page.evaluate((tt) => { const el = document.querySelector(`#selpanel [data-why="${tt}"]`); return el ? el.textContent : 'sin tarjeta'; }, t);
    // La ficha se refresca con los cuadros; en Chromium sin tarjeta gráfica hay ~1 por segundo: esperar a que cambie (hasta 8 s).
    const cardChange = async (t, prev) => { for (let i = 0; i < 40; i++) { const x = await card(t); if (x !== prev) return x; await page.waitForTimeout(200); } return card(t); };
    const short = async () => page.evaluate(() => Math.ceil(UNITS.rifle.cost - FARO.game.players[0].coins));
    await page.evaluate(() => {
      const g = FARO.game; const core = g.cells[g.players[0].core.cell];
      const put = (t) => { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; return g.addBuilding(0, t, c.i, true); };
      window.BAR = put('barracks'); window.FAC = put('factory');
      g.players[0].coins = 150; FARO.setSelection([BAR]);
    });
    await page.waitForTimeout(700);
    const rifle1 = await card('rifle');
    const need1 = await short();
    await page.evaluate(() => { FARO.game.players[0].coins = 300; });
    const rifle2 = await cardChange('rifle', rifle1);
    const need2 = await short();
    await page.evaluate(() => { const p = FARO.game.players[0]; p.coins = 50000; FARO.game.update(0.1); p.popUsed = p.popCap; FARO.ui.selSig = ''; FARO.game.update = ((u) => function (dt) { u.call(this, dt); this.players[0].popUsed = this.players[0].popCap; })(FARO.game.update); });
    const popTxt = await cardChange('rifle', rifle2);
    const eUnit = await page.evaluate(() => { const t = BUILDINGS.factory.produces.find((k) => UNITS[k].energy); return t || null; });
    await page.evaluate(() => { FARO.setSelection([FAC]); FARO.game.players[0].energy = 0; });
    await page.waitForTimeout(700);
    const eTxt = eUnit ? await card(eUnit) : 'sin tropa con energía';
    const eNeed = await page.evaluate((t) => (t ? UNITS[t].energy : 0), eUnit);
    await page.screenshot({ path: `${SP}/shots/v16-m03.png` });
    // La tarjeta se refresca 6 veces por segundo: puede ir unas pocas monedas detrás del ingreso.
    const near = (txt, need) => { const m = /^Faltan (\d+) monedas$/.exec(txt); return !!m && Number(m[1]) >= need && Number(m[1]) <= need + 12; };
    const okT = near(rifle1, need1) && near(rifle2, need2) && need2 < need1 && /Comunidad llena/.test(popTxt) && (!eUnit || eTxt === `Faltan ${eNeed} de energía`);
    if (!okT) okAll = false;
    out.push(`Entrenar: Artillero (400) con unas 150 monedas «${rifle1}» (le faltan ${need1}) y, al subir a 300, se actualiza solo a «${rifle2}» (le faltan ${need2}); con la comunidad llena «${popTxt}»; ${eUnit ? `${eUnit} sin energía «${eTxt}»` : ''}`);
    errsAll.push(...page.errs);
    await page.context().close();
    add('M03', okAll, out.join(' · '));
  }

  // ---------- M04 alcance al colocar ----------
  if (want('M04')) {
    const out = [];
    let okAll = true;
    for (const map of ['continent', 'mesa']) {
      const page = await open(browser, 1180, 820);
      await newGame(page, map);
      for (const t of ['turret', 'miniturret', 'aadef']) {
        const r = await page.evaluate(([tt, mapName]) => {
          const g = FARO.game; const core = g.cells[g.players[0].core.cell];
          g.players[0].coins = 50000;
          FARO.input.startPlacement({ kind: 'build', btype: tt });
          let claimed = false;
          if (mapName === 'mesa' && !g.cells.some((x) => TERRAIN[x.t].highGround && !g.placeInvalid(0, tt, x.i, true))) {
            const hc = g.cells.filter((x) => TERRAIN[x.t].highGround && !x.bld && !x.point && x.owner < 0).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
            if (hc) { hc.owner = 0; claimed = true; }
          }
          const cands = g.cells.filter((x) => !g.placeInvalid(0, tt, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
          const high = cands.find((c) => TERRAIN[c.t].highGround);
          const c = (mapName === 'mesa' && high) || cands[0];
          FARO.input.previewAt(c.i);
          const ring = FARO.renderer.ghostRange;
          const w = BUILDINGS[tt].weapon;
          const hb = TERRAIN[c.t].highGround ? 1 : 0;
          const want = (w.range + hb) * SQ3 + 0.75;
          const res = { t: BUILDINGS[tt].name, vis: !!ring && ring.visible, r: ring ? +ring.userData.radius.toFixed(3) : 0, want: +want.toFixed(3), at: !!ring && Math.hypot(ring.position.x - c.x, ring.position.z - c.z) < 0.01, high: !!hb, range: w.range + hb, claimed, nHigh: g.cells.filter((x) => TERRAIN[x.t].highGround).length };
          // Mover la obra a otra casilla: el círculo la sigue.
          const c2 = cands.find((x) => x !== c && g.map.dist(x, c) >= 2);
          FARO.input.previewAt(c2.i);
          res.follows = Math.hypot(ring.position.x - c2.x, ring.position.z - c2.z) < 0.01;
          FARO.input.cancelPlacement();
          res.hidden = !ring.visible;
          return res;
        }, [t, map]);
        const ok = r.vis && Math.abs(r.r - r.want) < 0.001 && r.at && r.follows && r.hidden && (map !== 'mesa' || r.high);
        if (!ok) okAll = false;
        out.push(`${map === 'mesa' ? 'Mesetas' : 'Continente'} · ${r.t}: círculo de ${r.range} casillas${r.high ? ` (en meseta, +1${r.claimed ? '; meseta dada para la prueba' : ''})` : (map === 'mesa' ? ` (no se encontró meseta: el mapa tiene ${r.nHigh})` : '')} visible (${r.vis}), sigue a la obra (${r.follows}) y se va al cancelar (${r.hidden})`);
      }
      await page.evaluate(() => { FARO.input.startPlacement({ kind: 'build', btype: 'turret' }); const g = FARO.game; const core = g.cells[g.players[0].core.cell]; const c = g.cells.filter((x) => !g.placeInvalid(0, 'turret', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[2]; FARO.input.previewAt(c.i); FARO.renderer.cam.tx = c.x; FARO.renderer.cam.tz = c.z; FARO.renderer.cam.dist = 18; });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SP}/shots/v16-m04-${map}.png` });
      errsAll.push(...page.errs);
      await page.context().close();
      await new Promise((r) => setTimeout(r, 10));
    }
    add('M04', okAll, out.join(' · '));
  }

  // ---------- M05 «Acerca de» ----------
  if (want('M05')) {
    const out = [];
    let okAll = true;
    for (const [name, w, h] of [['iPad horizontal', 1180, 820], ['celular vertical', 390, 844]]) {
      const page = await open(browser, w, h);
      await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.lobby.render(); });
      const free = await tapBtn(page, '.sidebtn[data-m="about"]');
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const m = document.getElementById('modal');
        const t = m && !m.hidden ? m.innerText : '';
        const small = [...m.querySelectorAll('button')].filter((b) => b.getClientRects().length && (b.getBoundingClientRect().height < 43.5 || b.getBoundingClientRect().width < 43.5)).length;
        return { open: !!m && !m.hidden, ver: /Versión 1\.6/.test(t), news: m.querySelectorAll('.about-news li').length, credits: /Poly Haven/.test(t) && /CMU/.test(t) && /three\.js/.test(t) && /Blender/.test(t), small };
      });
      await page.screenshot({ path: `${SP}/shots/v16-m05-${w}x${h}.png` });
      const closed = await tapBtn(page, '#modal .row [data-act="close"]');
      await page.waitForTimeout(300);
      const gone = await page.evaluate(() => document.getElementById('modal').hidden);
      const ok = free && r.open && r.ver && r.news === 5 && r.credits && r.small === 0 && closed && gone;
      if (!ok) okAll = false;
      out.push(`${name}: se abre desde el vestíbulo (${r.open}), dice «Versión 1.6» (${r.ver}), ${r.news} novedades, créditos de Blender, Poly Haven, CMU y three.js (${r.credits}); botones de menos de 44 px: ${r.small}; «Cerrar» la cierra (${gone})`);
      errsAll.push(...page.errs);
      await page.context().close();
    }
    add('M05', okAll, out.join(' · '));
  }

  // ---------- M09 rendimiento frente a la v1.5 ----------
  if (want('M09')) {
    const fps = async (url, q) => {
      const page = await open(browser, 1180, 820, { url });
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
      await page.context().close();
      return r;
    };
    const med = (x) => [...x].sort((p, q) => p - q)[1];
    const parts = [];
    let okAll = true;
    for (const [q, qn] of [['high', 'Alta calidad'], ['low', 'Más fluido']]) {
      const a = []; const b = [];
      for (let i = 0; i < 3; i++) { a.push(await fps(GAME15, q)); b.push(await fps(GAME, q)); }
      const k = med(b) / med(a);
      if (k < 0.9) okAll = false;
      parts.push(`${qn}: v1.5 ${med(a).toFixed(1)} (${a.map((x) => x.toFixed(1)).join(', ')}); v1.6 ${med(b).toFixed(1)} (${b.map((x) => x.toFixed(1)).join(', ')}): ${k >= 1 ? `${Math.round((k - 1) * 100)} % más` : `${Math.round((1 - k) * 100)} % menos`}`);
    }
    const kb = fs.statSync('/home/user/opencode-mobile/faro/faro.html').size / 1048576;
    add('M09', okAll && kb < 3.5, `cuadros por segundo en la misma partida (90 tropas y 9 edificios; Chromium sin tarjeta gráfica; 12 s, 3 veces, mediana): ${parts.join(' · ')}. faro.html pesa ${kb.toFixed(2).replace('.', ',')} MB (meta: menos de 3,5 MB)`);
  }

  const errs = [...new Set(errsAll)];
  add('errores', errs.length === 0, errs.length ? errs.slice(0, 6).join(' | ') : 'sin errores en la consola');
  await browser.close();
  fs.writeFileSync(SP + (only ? `/results-v16-${only.join('')}.json` : '/results-v16.json'), JSON.stringify(results, null, 1));
})();
