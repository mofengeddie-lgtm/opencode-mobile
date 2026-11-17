// Pruebas de la v1.7 en Chromium: N01 (carga en 3 pasos y perfil que no se lee), N02 (perfil seguro), N03 (barra de
// arriba), N04 (barra de selección), N05 (Arsenal), N06 (modelos nuevos), N07-N08 (Arsenal estratégico apagado y
// encendido), N09 (pasajeros y plazas reservadas), N10 (resultado y «Revancha»), N11 (ajustes) y N14 (rendimiento).
// Uso: SP=<carpeta con three/ y faro161.html> node test-v17.cjs   ·   ONLY=N04,N08 para correr solo algunas.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = process.env.SP || __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const GAME = process.env.GAME || 'file:///home/user/opencode-mobile/faro/faro.html';
const GAME161 = `file://${SP}/faro161.html`;
const THREE_JS = SP + '/three/node_modules/three/build/three.min.js';
const errsAll = [];
// Mismo formato de números que el juego (para escribir los resultados).
const fmt = (n) => Math.floor(n).toLocaleString('es-ES');
const SIZES = [['iPad horizontal', 1180, 820], ['pantalla 16:9', 1280, 720], ['iPad vertical', 820, 1180], ['celular horizontal', 844, 390], ['celular vertical', 390, 844]];

async function open(browser, w, h, { url = GAME, init = null, wait = true } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.route('**/three.min.js', (r) => r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url, { timeout: 120000 });
  if (wait) await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 180000 });
  return page;
}
const close = async (page) => { errsAll.push(...page.errs); await page.context().close(); };
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);
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
// Partida sin bots con mucho dinero, para armar escenas.
const newGame = (page, opts = {}) => page.evaluate((o) => {
  FARO.setQuality('low');
  FARO.opts = Object.assign({ mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }, o);
  FARO.startGame();
  const g = FARO.game; g.bots = []; FARO.focusCore();
  const p = g.players[0]; p.coins = 500000; p.energy = 999;
  const core = g.cells[p.core.cell];
  window.put = (t, owner = 0) => { const c = g.cells.filter((x) => !g.placeInvalid(owner, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; return c ? g.addBuilding(owner, t, c.i, true) : null; };
  window.near = (d0, d1, mover = 'land') => g.cells.filter((c) => g.map.dist(c, core) >= d0 && g.map.dist(c, core) <= d1 && !c.bld && g.passable(c, mover, 0));
  for (let i = 0; i < 8; i++) put('house');
  g.refreshEconomy();
}, opts);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (id, fn) => {
    if (!want(id)) return;
    try { await fn(); } catch (e) { add(id, false, 'la prueba se cortó: ' + String(e.message || e).split('\n')[0].slice(0, 300)); }
  };

  // ---------- N01 carga en 3 pasos y perfil que no se puede leer ----------
  await run('N01', async () => {
    const page = await open(browser, 1180, 820);
    const seq = await page.evaluate(() => {
      const out = [];
      for (const h of FaroBoot.hist) if (h.steps && out[out.length - 1] !== h.steps) out.push(h.steps);
      return out;
    });
    const rank = { wait: 0, now: 1, done: 2, error: -1 };
    let mono = true;
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1].split(',').map((x) => rank[x]);
      const b = seq[i].split(',').map((x) => rank[x]);
      if (b.some((v, k) => v < a[k])) mono = false;
    }
    await close(page);
    const BAD = '{esto no es un perfil';
    const p2 = await open(browser, 1180, 820, { wait: false, init: `localStorage.setItem('faro-profile-v1', ${JSON.stringify(BAD)})` });
    await p2.waitForFunction(() => { const b = document.getElementById('boot-alt'); return b && !b.hidden; }, null, { timeout: 180000 });
    const ask = await p2.evaluate((bad) => {
      Profile.save();
      const lis = [...document.querySelectorAll('#boot-steps li')].map((li) => `${li.querySelector('b').textContent}: ${li.lastElementChild.textContent}`);
      return {
        phase: document.getElementById('boot-phase').textContent, detail: document.getElementById('boot-detail').textContent, lis,
        retry: !document.getElementById('boot-retry').hidden, alt: document.getElementById('boot-alt').textContent,
        loaded: !!(window.FARO && FARO.loaded), kept: localStorage.getItem('faro-profile-v1') === bad, copy: localStorage.getItem('faro-profile-v1-copia') === bad,
      };
    }, BAD);
    await p2.screenshot({ path: `${SP}/shots/v17-n01-perfil.png` });
    const tapped = await tapBtn(p2, '#boot-alt');
    await p2.waitForFunction(() => window.FARO && FARO.loaded, null, { timeout: 120000 });
    const after = await p2.evaluate((bad) => {
      let fresh = null;
      try { fresh = JSON.parse(localStorage.getItem('faro-profile-v1')); } catch (e) { fresh = null; }
      return { fresh: !!fresh && fresh.v === 1, copy: localStorage.getItem('faro-profile-v1-copia') === bad, lobby: !document.getElementById('menu').hidden };
    }, BAD);
    await close(p2);
    const want3 = seq.length && seq[seq.length - 1] === 'done,done,done' && seq[0].startsWith('now');
    const okAsk = /No pudimos cargar tu perfil\. Tu progreso no se ha reemplazado\./.test(ask.detail) && ask.retry && ask.alt === 'Empezar de nuevo' && !ask.loaded && ask.kept && ask.copy && /Tu perfil: No se pudo leer/.test(ask.lis.join('|'));
    add('N01', want3 && mono && okAsk && tapped && after.fresh && after.copy && after.lobby,
      `al abrir, los 3 pasos pasan por ${seq.map((s) => `«${s.replace(/now/g, 'cargando').replace(/wait/g, 'en espera').replace(/done/g, 'listo')}»`).join(' → ')} (nunca vuelven atrás: ${mono}) · ` +
      `con un perfil que no se puede leer: «${ask.phase}» / «${ask.detail}»; pasos ${ask.lis.join(' · ')}; «Reintentar» a la vista (${ask.retry}) y «${ask.alt}»; el juego espera (cargado: ${ask.loaded}); ` +
      `lo guardado sigue igual aunque el juego intente guardar (${ask.kept}) y hay una copia aparte (${ask.copy}) · al tocar «Empezar de nuevo»: perfil nuevo (${after.fresh}), la copia sigue (${after.copy}) y se abre el vestíbulo (${after.lobby})`);
  });

  // ---------- N02 perfil seguro: datos con el tipo equivocado y perfil sano ----------
  await run('N02', async () => {
    const WRONG = JSON.stringify({ v: 1, xp: '350', crystals: 'abc', stats: 5, tutorialDone: 'si', play: { mode: 'conquest', mapKind: 'continent', difficulty: 'hard' }, owned: { 'rifle-selva': true } });
    const page = await open(browser, 1180, 820, { init: `if (!sessionStorage.getItem('n02')) { sessionStorage.setItem('n02', '1'); localStorage.setItem('faro-profile-v1', ${JSON.stringify(WRONG)}); }` });
    const r = await page.evaluate(() => ({
      xp: Profile.data.xp, crystals: Profile.data.crystals, statsOk: typeof Profile.data.stats === 'object' && Profile.data.stats.games === 0, tut: Profile.data.tutorialDone,
      diff: Profile.data.play.difficulty, map: Profile.data.play.mapKind, owned: !!Profile.data.owned['rifle-selva'], repaired: Profile.repaired.slice(),
      detail: FaroBoot.hist.map((h) => h.detail).filter((d) => /repar/.test(d)).pop() || '', err: Profile.loadError,
    }));
    // Perfil sano: se guarda y se vuelve a abrir igual, sin reparar nada.
    await page.evaluate(() => { Profile.data.xp = 1234; Profile.data.crystals = 77; Profile.data.stats.games = 9; Profile.save(); });
    await page.reload();
    await page.waitForFunction(() => window.FARO && FARO.loaded, null, { timeout: 180000 });
    const sane = await page.evaluate(() => ({ xp: Profile.data.xp, crystals: Profile.data.crystals, games: Profile.data.stats.games, diff: Profile.data.play.difficulty, rep: Profile.repaired.length, err: Profile.loadError }));
    await close(page);
    const ok = r.xp === 350 && r.crystals === 0 && r.statsOk && r.tut === false && r.diff === 'hard' && r.map === 'continent' && r.owned && !r.err &&
      ['xp', 'crystals', 'stats', 'tutorialDone'].every((k) => r.repaired.includes(k)) && /repararon 4 datos/.test(r.detail) &&
      sane.xp === 1234 && sane.crystals === 77 && sane.games === 9 && sane.diff === 'hard' && sane.rep === 0 && !sane.err;
    add('N02', ok, `perfil con datos del tipo equivocado (XP como texto «350», cristales «abc», estadísticas como número, tutorial «si»): XP ${r.xp}, cristales ${r.crystals}, estadísticas reparadas (${r.statsOk}), tutorial ${r.tut}; ` +
      `lo demás se conserva: dificultad ${r.diff}, mapa ${r.map}, aspecto comprado (${r.owned}); reparados: ${r.repaired.join(', ')}; la carga dice «${r.detail}» · ` +
      `perfil sano guardado y vuelto a abrir: XP ${sane.xp}, cristales ${sane.crystals}, partidas ${sane.games}, dificultad ${sane.diff}, datos reparados ${sane.rep}`);
  });

  // ---------- N03 barra de arriba ----------
  await run('N03', async () => {
    const out = [];
    let okAll = true;
    for (const [name, w, h, big] of [...SIZES, ['iPad horizontal con letra grande', 1180, 820, true]]) {
      const page = await open(browser, w, h, { init: big ? "localStorage.setItem('faro-uiscale', '115')" : null });
      await newGame(page);
      await page.waitForTimeout(600);
      const r = await page.evaluate(() => {
        const g = FARO.game; const p = g.players[0];
        p.coins = 12345; p.energy = 77; g.time = 125;
        FARO.ui.updateTop();
        const want = { coins: fmt(p.coins), income: `+${fmt(p.income)}/min`, pop: `${p.popUsed}/${p.popCap}`, energy: fmt(p.energy), clock: fmtTime(g.time) };
        const vis = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        const blocks = [['Monedas', '.stat.coins', 'coins'], ['Ingresos', '#stat-income', 'income2'], ['Población', '#stat-pop', 'pop'], ['Energía', '.stat.energy', 'energy'], ['Partida', '.stat.clock', 'clock']];
        const seen = [];
        const wrong = [];
        for (const [label, sel, id] of blocks) {
          const el = document.querySelector(sel);
          if (!vis(el)) continue;
          const lab = el.querySelector('.lbl');
          seen.push(label + (vis(lab) ? '' : ' (sin etiqueta)'));
          const val = document.getElementById(id).textContent;
          const exp = { coins: want.coins, income2: want.income, pop: want.pop, energy: want.energy, clock: want.clock }[id];
          if (val !== exp) wrong.push(`${label}: «${val}» en vez de «${exp}»`);
          if (lab && vis(lab) && lab.textContent.trim() !== label) wrong.push(`etiqueta «${lab.textContent}»`);
        }
        const incSmall = vis(document.getElementById('income')) ? document.getElementById('income').textContent : null;
        if (incSmall !== null && incSmall !== want.income) wrong.push(`ingreso junto a las monedas «${incSmall}»`);
        const res = document.querySelector('.res').getBoundingClientRect();
        const pl = document.getElementById('players');
        const pr = vis(pl) ? pl.getBoundingClientRect() : null;
        const sys = document.querySelector('.sys').getBoundingClientRect();
        const bad = [];
        if (res.left < -1 || res.right > innerWidth + 1) bad.push('la barra se sale de la pantalla');
        if (pr && pr.left < res.right - 1 && pr.top < res.bottom - 1) bad.push('los jugadores tapan la barra');
        if (sys.left < res.right - 1 && sys.top < res.bottom - 1) bad.push('los botones tapan la barra');
        return { seen, wrong, bad, incSmall: incSmall !== null, players: g.players.length };
      });
      await page.screenshot({ path: `${SP}/shots/v17-n03-${w}x${h}${big ? '-big' : ''}.png` });
      await close(page);
      const wide = w >= 861;
      const ok = !r.wrong.length && !r.bad.length && (!wide || r.seen.length === 5 && r.seen.every((s) => !s.includes('sin etiqueta')));
      if (!ok) okAll = false;
      out.push(`${name}: ${r.seen.join(', ')}${!r.seen.includes('Ingresos') && r.incSmall ? ' (el ingreso va junto a las monedas)' : ''}${r.wrong.length ? ' · MAL ' + r.wrong.join('; ') : ''}${r.bad.length ? ' · ' + r.bad.join('; ') : ''}`);
    }
    add('N03', okAll, `partida de 6 imperios, con 12.345 monedas, 77 de energía y 2:05 de partida; números iguales al juego en todo lo que se ve · ${out.join(' · ')}`);
  });

  // ---------- N04 barra de selección ----------
  await run('N04', async () => {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    const read = () => page.evaluate(() => { FARO.ui.renderSel(true); const q = (s) => (document.querySelector(s) || {}).textContent || ''; return { h3: q('#selpanel h3'), order: q('#sel-order'), hp: q('#sel-hptext'), hidden: document.getElementById('selpanel').hidden }; });
    await page.evaluate(() => {
      const g = FARO.game; const c = near(2, 3);
      window.U = [g.addUnit(0, 'rifle', c[0].i), g.addUnit(0, 'rifle', c[1].i), g.addUnit(0, 'tank', c[2].i)];
      U[1].hp = 130;
      FARO.setSelection(U);
    });
    const a = await read();
    const want = await page.evaluate(() => { const cur = U.reduce((s, u) => s + u.hp, 0); const max = U.reduce((s, u) => s + u.maxHp, 0); return `Vida del grupo · ${Math.round((cur / max) * 100)} % (${fmt(cur)} / ${fmt(max)})`; });
    await page.evaluate(() => { const g = FARO.game; g.orderMove(U, near(7, 8)[0].i); });
    const mv = await read();
    await page.evaluate(() => { const g = FARO.game; window.FOE = g.addUnit(1, 'tank', near(2, 3)[4].i); g.orderAttack(U, FOE); });
    const at = await read();
    await page.evaluate(() => { const g = FARO.game; g.orderStop(U); g.orderPatrol(U, near(5, 6)[0].i); });
    const pa = await read();
    await page.evaluate(() => { const g = FARO.game; g.orderStop(U); g.setHold(U, true); });
    const ho = await read();
    await page.evaluate(() => { const g = FARO.game; g.kill(FOE, 0); g.setHold(U, false); g.orderStop(U); g.orderMove([U[0]], near(7, 8)[1].i); });
    const mix = await read();
    const names = await page.evaluate(() => {
      const g = FARO.game; const out = {};
      const sea = g.cells.filter((c) => TERRAIN[c.t].water && !c.bld && g.passable(c, 'sea', 0)).slice(0, 4);
      const ships = [g.addUnit(0, 'destroyer', sea[0].i), g.addUnit(0, 'missileboat', sea[1].i)];
      const air = [g.addUnit(0, 'heli', near(2, 3)[5].i), g.addUnit(0, 'drone', near(2, 3)[6].i)];
      for (const [k, sel] of [['flota', ships], ['aire', air], ['mixto', [ships[0], U[2], air[0]]]]) { FARO.setSelection(sel); FARO.ui.renderSel(true); out[k] = document.querySelector('#selpanel h3').textContent; }
      FARO.setSelection(U); FARO.ui.renderSel(true);
      FARO.renderer.cam.tx = -999; FARO.renderer.cam.tz = -999;
      return out;
    });
    const tapC = await tapBtn(page, '#btn-center');
    const cen = await page.evaluate(() => { const ax = U.reduce((s, u) => s + u.x, 0) / U.length; const az = U.reduce((s, u) => s + u.z, 0) / U.length; return Math.hypot(FARO.renderer.cam.tx - ax, FARO.renderer.cam.tz - az); });
    await page.screenshot({ path: `${SP}/shots/v17-n04.png` });
    const tapX = await tapBtn(page, '#selpanel [data-act="close"]');
    const gone = await page.evaluate(() => { FARO.ui.renderSel(true); return { n: FARO.selection.length, hidden: document.getElementById('selpanel').hidden }; });
    await close(page);
    const ok = a.h3 === 'Escuadra terrestre' && a.hp === want && /en espera/.test(a.order) && /moviéndose/.test(mv.order) && /atacando/.test(at.order) && /patrullando/.test(pa.order) &&
      /manteniendo posición/.test(ho.order) && /1 moviéndose · 2 en espera|2 en espera · 1 moviéndose/.test(mix.order) &&
      names.flota === 'Flota' && names.aire === 'Escuadrilla aérea' && names.mixto === 'Grupo mixto' && tapC && cen < 0.01 && tapX && gone.n === 0 && gone.hidden;
    add('N04', ok, `2 Artilleros y un Tanque (uno con 130 de 260 de vida): «${a.h3}», «${a.hp}» (esperado «${want}») · orden actual: «${a.order}» → al mover «${mv.order}» → al atacar «${at.order}» → al patrullar «${pa.order}» → al mantener «${ho.order}» → mezclada «${mix.order}» · ` +
      `barcos: «${names.flota}», aeronaves: «${names.aire}», de todo: «${names.mixto}» · «Centrar» lleva la cámara al grupo (a ${cen.toFixed(3)} del centro) · «Quitar selección» la suelta (${gone.n} elegidas, panel oculto: ${gone.hidden})`);
  });

  // ---------- N05 Arsenal ----------
  await run('N05', async () => {
    const page = await open(browser, 1180, 820);
    const tab = await tapBtn(page, '#lobby-tabs [data-view="arsenal"]');
    await page.waitForTimeout(800);
    const base = await page.evaluate(() => {
      const nU = Object.keys(UNITS).length; const nB = Object.keys(BUILDINGS).length;
      const imgs = [...document.querySelectorAll('#ars-grid .arsitem img')].map((i) => i.src);
      return { nU, nB, count: document.getElementById('ars-count').textContent, cards: imgs.length, okImg: imgs.filter((s) => s.startsWith('data:image/png') && s.length > 2000).length, distinct: new Set(imgs).size };
    });
    const names = async () => page.evaluate(() => [...document.querySelectorAll('#ars-grid .arsitem b')].map((b) => b.textContent));
    await page.fill('#ars-search', 'dron');
    await page.waitForTimeout(300);
    const dron = await names();
    await page.fill('#ars-search', 'camion');
    await page.waitForTimeout(300);
    const camion = await names();
    await page.fill('#ars-search', '');
    const fil = {};
    for (const f of ['inf', 'land', 'sea', 'air', 'bld', 'strat', 'all']) {
      await tapBtn(page, `[data-act="arsfilter"][data-v="${f}"]`);
      await page.waitForTimeout(200);
      fil[f] = (await names()).length;
    }
    const exp = await page.evaluate(() => {
      const V = Object.values(UNITS);
      return { inf: V.filter((d) => d.cls === 'inf' && !d.strategic).length, land: V.filter((d) => d.cls === 'veh').length, sea: V.filter((d) => d.cls === 'ship' || d.cls === 'sub').length,
        air: V.filter((d) => d.cls === 'air').length, bld: Object.keys(BUILDINGS).length, strat: 3, all: V.length + Object.keys(BUILDINGS).length };
    });
    const picked = await tapBtn(page, '[data-act="arspick"][data-k="mlrs"]');
    await page.waitForTimeout(300);
    // El precio se escribe con el mismo formato que todo el juego (en español, los números de 4 cifras van sin punto).
    const sheet = await page.evaluate(() => document.getElementById('ars-sheet').innerText.replace(/\s+/g, ' '));
    const price = await page.evaluate(() => `${fmt(UNITS.mlrs.cost)} monedas y ${UNITS.mlrs.energy} de energía`);
    await page.screenshot({ path: `${SP}/shots/v17-n05.png` });
    await close(page);
    const ph = await open(browser, 390, 844);
    await tapBtn(ph, '#lobby-tabs [data-view="arsenal"]');
    await ph.waitForTimeout(800);
    const phone = await ph.evaluate(() => { const s = document.getElementById('ars-sheet').getBoundingClientRect(); const g = document.getElementById('ars-grid').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, w: innerWidth, sheetW: Math.round(s.width), below: s.top >= g.bottom - 1 }; });
    await ph.screenshot({ path: `${SP}/shots/v17-n05-cel.png` });
    await close(ph);
    const needs = [price, '3 plazas', '18 s', 'Fábrica', 'Dispara salvas de 6', 'Daño en área'];
    const okSheet = needs.every((t) => sheet.includes(t));
    const okF = Object.keys(exp).every((k) => fil[k] === exp[k]);
    const ok = tab && base.count === `${base.nU} tropas · ${base.nB} edificios` && base.cards === base.nU + base.nB && base.okImg === base.cards &&
      dron.join() === 'Dron de ataque,Dron kamikaze' && camion.join() === 'Camión antiaéreo,Camión de misiles' && okF && picked && okSheet && phone.sw <= phone.w && phone.sheetW > 200 && phone.below;
    add('N05', ok, `«${base.count}»: ${base.cards} tarjetas, ${base.okImg} con su miniatura (${base.distinct} distintas) · buscar «dron»: ${dron.join(', ')}; «camion» (sin tilde): ${camion.join(', ')} · ` +
      `filtros: ${Object.keys(exp).map((k) => `${k} ${fil[k]}${fil[k] === exp[k] ? '' : ` (esperado ${exp[k]})`}`).join(', ')} · ficha del Lanzacohetes múltiple: ${needs.map((t) => `«${t}» ${sheet.includes(t) ? 'sí' : 'NO'}`).join(', ')} · ` +
      `celular vertical: sin desplazamiento lateral (${phone.sw} de ${phone.w} px), la ficha va debajo de la lista (${phone.below})`);
  });

  // ---------- N06 modelos nuevos ----------
  await run('N06', async () => {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    const NEW = ['launcher', 'nukelauncher', 'drone', 'fpv', 'mlrs', 'missileboat'];
    const r = await page.evaluate((list) => {
      const g = FARO.game;
      const glb = list.map((k) => ({ k, glb: !!GLB[k], team: GLB[k] ? Object.values(GLB[k].parts).some((p) => p.chunks.some((c) => c.team === 1)) : false, fromGlb: !!getModel(k, PLAYER_COLORS[0]).glb }));
      const others = Object.keys(UNITS).filter((k) => !list.includes(k)).map((k) => Thumbs.get(k, PLAYER_COLORS[0]));
      const mine = list.map((k) => Thumbs.get(k, PLAYER_COLORS[0]));
      const distinctAmong = new Set(mine).size === mine.length;
      const clash = mine.filter((u) => others.includes(u)).length;
      const sea = g.cells.filter((c) => TERRAIN[c.t].water && !c.bld && g.passable(c, 'sea', 0));
      window.NU = list.map((k, i) => g.addUnit(0, k, (UNITS[k].mover === 'sea' ? sea : near(2, 3, UNITS[k].mover === 'air' ? 'air' : 'land'))[i].i));
      return { glb, distinctAmong, clash };
    }, NEW);
    await page.waitForTimeout(2500);
    const vis = await page.evaluate(() => NU.map((u) => { const v = FARO.renderer.vis.get(u.id); return !!v && !!v.group && v.group.children.length > 0 && v.group.visible !== false; }));
    await page.evaluate(() => { FARO.renderer.cam.tx = NU[1].x; FARO.renderer.cam.tz = NU[1].z; FARO.renderer.cam.dist = 9; });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SP}/shots/v17-n06.png` });
    await close(page);
    const ok = r.glb.every((x) => x.glb && x.team && x.fromGlb) && r.distinctAmong && r.clash === 0 && vis.every(Boolean);
    add('N06', ok, `${r.glb.map((x) => `${x.k}: modelo de Blender ${x.glb ? 'sí' : 'NO'}, color del jugador ${x.team ? 'sí' : 'NO'}`).join(' · ')} · miniaturas distintas entre sí (${r.distinctAmong}) y de las otras tropas (${r.clash} iguales) · en el mapa: ${vis.filter(Boolean).length} de ${vis.length} se dibujan`);
  });

  // ---------- N07 Arsenal estratégico apagado ----------
  await run('N07', async () => {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    const r = await page.evaluate(() => {
      const g = FARO.game; const p = g.players[0];
      const fac = put('factory');
      const prod = g.producesOf(fac).includes('nukelauncher');
      const enq = g.enqueue(fac, 'nukelauncher');
      FARO.setSelection([fac]); FARO.ui.renderSel(true);
      const card = !!document.querySelector('#selpanel .card[data-type="nukelauncher"]');
      const a1 = put('aadef'); const a2 = put('aadef');
      for (const a of [a1, a2]) { a.level = 4; a.built = true; }
      const foe = g.cells[g.players[1].core.cell];
      const tgt = g.cells.filter((c) => g.map.dist(c, g.cells[a1.cell]) <= NUKE.range && g.map.dist(c, g.cells[p.core.cell]) > NUKE.radius + 3).sort((a, b) => g.map.dist(a, foe) - g.map.dist(b, foe))[0];
      const coins0 = p.coins;
      FARO.input.r.pickCell = () => tgt;
      FARO.input.startPlacement({ kind: 'nuke', building: a1 });
      FARO.input.placementTap(0, 0);
      const dlg1 = !document.getElementById('strat').hidden;
      const n1 = g.projectiles.filter((x) => x.kind === 'nuke').length;
      const spent1 = coins0 - p.coins;
      const again = g.nukeInvalid(a1, tgt.i);
      const second = g.launchNuke(a2, tgt.i);
      const n2 = g.projectiles.filter((x) => x.kind === 'nuke').length;
      return { strategic: g.strategic, prod, enq, card, dlg1, n1, spent: spent1, again, second, n2, left: g.strategicLeft(0) };
    });
    await step(page, 120);
    await close(page);
    const ok = !r.strategic && !r.prod && /Arsenal estratégico/.test(r.enq) && !r.card && !r.dlg1 && r.n1 === 1 && r.spent === 20000 && /Recargando/.test(r.again) && r.second === null && r.n2 === 2;
    add('N07', ok, `partida normal: Arsenal estratégico ${r.strategic ? 'ENCENDIDO' : 'apagado'}; la Fábrica no ofrece el Lanzador nuclear móvil (tarjeta: ${r.card}; si se intenta: «${r.enq}») · ` +
      `AIR DEFENSE de nivel 4: tocar el blanco lanza el misil sin preguntar (ventana: ${r.dlg1}), ${r.n1} misil, cobra ${fmt(r.spent)} monedas, después «${r.again}»; otro AIR DEFENSE lanza el suyo (${r.second === null ? 'sí' : r.second}): ${r.n2} misiles, sin límite por partida, como en la v1.6`);
  });

  // ---------- N08 Arsenal estratégico encendido ----------
  await run('N08', async () => {
    const page = await open(browser, 1180, 820);
    await tapBtn(page, '[data-act="sub"][data-sub="custom"]');
    await page.waitForTimeout(500);
    const on = await tapBtn(page, '[data-act="cset"][data-k="strategic"][data-v="true"]');
    await page.waitForTimeout(500);
    await tapBtn(page, '#btn-play-custom');
    await page.waitForFunction(() => FARO.state === 'play' && FARO.game && !FARO.game.preview, null, { timeout: 60000 });
    const s0 = await page.evaluate(() => {
      const g = FARO.game; g.bots = []; const p = g.players[0]; p.coins = 500000; p.energy = 999;
      const core = g.cells[p.core.cell];
      window.put = (t) => { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; return c ? g.addBuilding(0, t, c.i, true) : null; };
      for (let i = 0; i < 8; i++) put('house');
      g.refreshEconomy();
      window.FAC = put('factory');
      FARO.setSelection([FAC]); FARO.ui.renderSel(true);
      const why = (document.querySelector('#selpanel .card[data-type="nukelauncher"] .why') || {}).textContent;
      return { strategic: g.strategic, custom: !!g.opts.custom, why, coins: p.coins };
    });
    const tapCard = await tapBtn(page, '#selpanel .card[data-type="nukelauncher"]');
    const q = await page.evaluate((c0) => { const g = FARO.game; return { q: FAC.queue.length, paid: c0 - g.players[0].coins, again: g.enqueue(FAC, 'nukelauncher') }; }, s0.coins);
    await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 3000 && !g.units.some((u) => u.type === 'nukelauncher'); i++) g.update(0.1); window.NL = g.units.find((u) => u.type === 'nukelauncher'); FARO.setSelection([NL]); FARO.ui.renderSel(true); });
    const box = () => page.evaluate(() => { FARO.ui.renderSel(true); const q = (s) => (document.getElementById(s) || {}).textContent || ''; return { num: q('strat-num'), text: q('strat-text'), dis: !!(document.getElementById('btn-mnuke') || {}).disabled }; });
    const prep = await box();
    await step(page, 610);
    const ready = await box();
    const tapZone = await tapBtn(page, '#btn-mnuke');
    const zone = await page.evaluate(() => {
      const g = FARO.game; const p = FARO.input.placement; const core = g.cells[g.players[0].core.cell];
      const cells = [...p.valid].map((i) => g.cells[i]);
      const bad = cells.filter((c) => g.map.dist(c, g.cells[NL.cell]) > STRATEGIC.range || g.map.dist(c, core) <= NUKE.radius + 2).length;
      window.TGT = cells.sort((a, b) => g.map.dist(b, g.cells[NL.cell]) - g.map.dist(a, g.cells[NL.cell]))[0];
      FARO.input.r.pickCell = () => TGT;
      FARO.input.placementTap(0, 0);
      return { kind: p.kind, n: cells.length, bad, dlg: !document.getElementById('strat').hidden, nukes: g.projectiles.filter((x) => x.kind === 'nuke').length, left: g.strategicLeft(0) };
    });
    await page.screenshot({ path: `${SP}/shots/v17-n08-confirmar.png` });
    const tapCancel = await tapBtn(page, '#btn-strat-cancel');
    const canc = await page.evaluate(() => ({ dlg: !document.getElementById('strat').hidden, left: FARO.game.strategicLeft(0), spent: NL.spent, nukes: FARO.game.projectiles.filter((x) => x.kind === 'nuke').length }));
    await page.evaluate(() => FARO.input.placementTap(0, 0));
    const btn = await page.evaluate(() => { const r = document.getElementById('btn-strat-ok').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.dblclick(btn.x, btn.y);
    const fired = await page.evaluate(() => ({ nukes: FARO.game.projectiles.filter((x) => x.kind === 'nuke').length, left: FARO.game.strategicLeft(0), spent: NL.spent, dlg: !document.getElementById('strat').hidden }));
    await page.evaluate(() => FARO.setSelection([NL]));
    const after = await box();
    await page.screenshot({ path: `${SP}/shots/v17-n08-agotado.png` });
    await step(page, 120);
    const share = await page.evaluate(() => {
      const g = FARO.game;
      const a = put('aadef'); a.level = 4; a.built = true;
      const silo = g.nukeInvalid(a); const salvo = g.salvoInvalid(0);
      g.kill(NL, 1);
      const rebuild = g.enqueue(FAC, 'nukelauncher');
      FARO.setSelection([FAC]); FARO.ui.renderSel(true);
      const why = (document.querySelector('#selpanel .card[data-type="nukelauncher"] .why') || {}).textContent;
      Save.write(g);
      const g2 = Save.read();
      return { silo, salvo, rebuild, why, saved: !!g2, s2: g2 && g2.strategic, used2: g2 && g2.players[0].stratUsed, left2: g2 && g2.strategicLeft(0), rival2: g2 && g2.strategicLeft(1) };
    });
    // Al revés: primero el AIR DEFENSE (también pide confirmar) y después ya no se puede fabricar el lanzador.
    const rev = await page.evaluate(() => {
      FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 920, custom: { players: 4, teams: false, coins: 2000, fog: false, turbo: false, king: false, strategic: true } };
      FARO.startGame();
      const g = FARO.game; g.bots = []; const p = g.players[0]; p.coins = 500000; p.energy = 999;
      const core = g.cells[p.core.cell];
      const put2 = (t) => { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; return g.addBuilding(0, t, c.i, true); };
      for (let i = 0; i < 8; i++) put2('house');
      g.refreshEconomy();
      const a = put2('aadef'); a.level = 4; a.built = true;
      const fac = put2('factory');
      const tgt = g.cells.filter((c) => g.map.dist(c, g.cells[a.cell]) <= 20 && g.map.dist(c, core) > 7)[0];
      FARO.input.r.pickCell = () => tgt;
      FARO.input.startPlacement({ kind: 'nuke', building: a });
      FARO.input.placementTap(0, 0);
      const dlg = !document.getElementById('strat').hidden;
      const before = g.projectiles.filter((x) => x.kind === 'nuke').length;
      document.getElementById('btn-strat-ok').click();
      return { dlg, before, after: g.projectiles.filter((x) => x.kind === 'nuke').length, left: g.strategicLeft(0), enq: g.enqueue(fac, 'nukelauncher') };
    });
    await close(page);
    const ok = on && s0.strategic && s0.custom && s0.why === '' && tapCard && q.q === 1 && q.paid === 22000 && /Límite/.test(q.again) &&
      prep.num === '1 / 1' && /^Preparando: faltan \d+ s/.test(prep.text) && prep.dis && /^Disponible/.test(ready.text) && !ready.dis &&
      tapZone && zone.kind === 'mnuke' && zone.n > 0 && zone.bad === 0 && zone.dlg && zone.nukes === 0 && zone.left === 1 &&
      tapCancel && !canc.dlg && canc.left === 1 && !canc.spent && canc.nukes === 0 && fired.nukes === 1 && fired.left === 0 && fired.spent && !fired.dlg &&
      after.num === '0 / 1' && after.dis && /Agotado/.test(after.text) && /agotado/.test(share.silo) && /un solo uso/.test(share.salvo) && /agotado/.test(share.rebuild) && /agotado/.test(share.why || '') &&
      share.saved && share.s2 && share.used2 === 1 && share.left2 === 0 && share.rival2 === 1 && rev.dlg && rev.before === 0 && rev.after === 1 && rev.left === 0 && /agotado/.test(rev.enq);
    add('N08', ok, `«Arsenal estratégico: Activado» en Personalizado (${on}) → partida con la opción (${s0.strategic}); la Fábrica ofrece el Lanzador nuclear móvil (motivo «${s0.why}»), tocarlo lo pone en cola y cobra ${fmt(q.paid)}; otro: «${q.again}» · ` +
      `al salir: «${prep.num}», «${prep.text}», botón apagado (${prep.dis}); a los 60 s: «${ready.text}» · «Elegir zona»: ${zone.n} casillas posibles, ${zone.bad} fuera del alcance de ${14} o pegadas a tu Núcleo; al tocar una, pide confirmar (${zone.dlg}) y todavía no sale nada (${zone.nukes} misiles, quedan ${zone.left}) · ` +
      `«Cancelar»: ventana cerrada, sigue ${canc.left} / 1 · doble toque en «Confirmar uso único»: ${fired.nukes} misil, quedan ${fired.left} · al volver a elegirlo: «${after.num}», «${after.text}» · ` +
      `el AIR DEFENSE de nivel 4 dice «${share.silo}» y la salva «${share.salvo}»; destruido el lanzador, volver a fabricarlo: «${share.rebuild}» · guardar y volver a la partida: opción ${share.s2}, usos gastados ${share.used2}, te quedan ${share.left2}, al rival ${share.rival2} · ` +
      `al revés (primero el AIR DEFENSE): pide confirmar (${rev.dlg}), sale ${rev.after - rev.before} misil y el lanzador ya no se puede fabricar («${rev.enq}»)`);
  });

  // ---------- N09 pasajeros y plazas reservadas ----------
  await run('N09', async () => {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    const r = await page.evaluate(() => {
      const g = FARO.game; const c = near(2, 3);
      const apc = g.addUnit(0, 'apc', c[0].i);
      const r1 = g.addUnit(0, 'rifle', c[0].i); const r2 = g.addUnit(0, 'sniper', c[0].i);
      g.board(r1, apc); g.board(r2, apc);
      const r3 = g.addUnit(0, 'rocket', near(4, 5)[0].i);
      g.orderBoard([r3], apc);
      FARO.setSelection([apc]); FARO.ui.renderSel(true);
      const lis = [...document.querySelectorAll('#paxbox .paxlist li')].map((li) => `${li.querySelector('span').textContent} · ${li.querySelector('em').textContent}`);
      const count = (document.getElementById('pax-count') || {}).textContent;
      const fac = put('factory');
      g.enqueue(fac, 'mlrs'); g.enqueue(fac, 'tank');
      FARO.setSelection([fac]); FARO.ui.renderSel(true);
      const p = g.players[0];
      return { lis, count, qres: (document.getElementById('sel-qres') || {}).textContent, want: `2 en cola · ${UNITS.mlrs.pop + UNITS.tank.pop} plazas reservadas · Comunidad al terminar: ${p.popUsed} / ${p.popCap}` };
    });
    await page.screenshot({ path: `${SP}/shots/v17-n09.png` });
    await close(page);
    const ok = r.lis.join('|') === 'Artillero · a bordo|Francotirador · a bordo|Cohetero · en camino' && r.count === '2 / 6 plazas · 1 en camino' && r.qres === r.want;
    add('N09', ok, `Transporte blindado con 2 a bordo y 1 en camino: «${r.count}»; lista: ${r.lis.join('; ')} · Fábrica con Lanzacohetes múltiple y Tanque en cola: «${r.qres}» (esperado «${r.want}»)`);
  });

  // ---------- N10 resultado y «Revancha» ----------
  await run('N10', async () => {
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => { FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'bay', difficulty: 'normal', seed: 4242 }; FARO.startGame(); });
    await step(page, 300);
    const xp0 = await page.evaluate(() => Profile.data.xp);
    await page.evaluate(() => { const g = FARO.game; window.G0 = g; g.kill(g.players[0].core, 1); g.checkEnd(); });
    await page.waitForSelector('#end:not([hidden])', { timeout: 60000 });
    await page.waitForTimeout(600);
    const r = await page.evaluate((x0) => {
      const g = G0;
      const tiles = [...document.querySelectorAll('#endmain > div')].map((d) => ({ b: d.querySelector('b').textContent, s: d.querySelector('span').textContent }));
      const land = Math.max(g.players[0].peakLand || 0, g.cells.reduce((n, c) => n + (c.owner === 0 ? 1 : 0), 0));
      const xpAfter = Profile.data.xp;
      FARO.lobby.finish(g); FARO.lobby.endHtml(g);
      const row = document.querySelector('#enddialog .endrow').getBoundingClientRect();
      return { tiles, time: fmtTime(g.time), land: fmt(land), rxp: g.reward.xp, rxpText: '+' + fmt(g.reward.xp), gained: xpAfter - x0, again: Profile.data.xp - xpAfter, title: document.querySelector('#enddialog h2').textContent,
        btns: [...document.querySelectorAll('#enddialog .endrow .btn')].map((b) => b.textContent.trim()), rowVisible: row.bottom <= innerHeight + 1 && row.top >= 0 };
    }, xp0);
    await page.screenshot({ path: `${SP}/shots/v17-n10.png` });
    const tapA = await tapBtn(page, '#btn-again');
    await page.waitForFunction(() => FARO.game && FARO.game !== window.G0 && !FARO.game.preview, null, { timeout: 60000 });
    const re = await page.evaluate(() => ({ map: FARO.game.opts.mapKind, mode: FARO.game.opts.mode, over: FARO.game.over, t: FARO.game.time, endHidden: document.getElementById('end').hidden }));
    await close(page);
    const ok = r.tiles.length === 3 && r.tiles[0].s === 'Duración' && r.tiles[0].b === r.time && /Territorio/.test(r.tiles[1].s) && r.tiles[1].b === r.land && Number(r.land) > 0 && r.tiles[2].s === 'Experiencia' && r.tiles[2].b === r.rxpText &&
      r.gained === r.rxp && r.again === 0 && r.rowVisible && r.btns.includes('Revancha') && r.btns.includes('Volver al vestíbulo') && tapA && re.map === 'bay' && re.mode === 'conquest' && !re.over && re.t < 5 && re.endHidden;
    add('N10', ok, `«${r.title}» con ${r.tiles.map((t) => `${t.s} ${t.b}`).join(' · ')} (partida ${r.time}, territorio máximo ${r.land} casillas, XP ganada ${r.rxp}); botones siempre a la vista (${r.rowVisible}): ${r.btns.join(', ')} · ` +
      `la XP sube ${r.gained} una vez y nada más al volver a armar la pantalla (+${r.again}) · «Revancha»: partida nueva en el mismo mapa y modo (${re.map}, ${re.mode}), en ${re.t.toFixed(1)} s`);
  });

  // ---------- N11 tamaño de la interfaz y menos destellos ----------
  await run('N11', async () => {
    const page = await open(browser, 1180, 820);
    await newGame(page);
    await page.evaluate(() => FARO.togglePause(true));
    await page.waitForTimeout(400);
    await page.evaluate(() => { const s = document.getElementById('ui-scale'); s.value = '130'; s.dispatchEvent(new Event('input', { bubbles: true })); });
    const sc = await page.evaluate(() => ({ uiz: getComputedStyle(document.documentElement).getPropertyValue('--uiz').trim(), label: document.getElementById('ui-scale-val').textContent, saved: localStorage.getItem('faro-uiscale'), zoom: getComputedStyle(document.querySelector('#objlist')).zoom }));
    const tapCalm = await tapBtn(page, '#btn-calm');
    const calm = await page.evaluate(() => {
      const fx = FARO.renderer.fxs; let n = 0; const orig = fx.add;
      fx.add = function (...a) { n++; return orig.apply(this, a); };
      fx.flash(0, 1, 0, 1); const off = n;
      FARO.setCalm(false); n = 0; fx.flash(0, 1, 0, 1); const onN = n;
      FARO.setCalm(true); fx.add = orig;
      return { off, onN, low: FARO.renderer.lowFlash, saved: localStorage.getItem('faro-calm'), label: document.getElementById('btn-calm').textContent };
    });
    await page.screenshot({ path: `${SP}/shots/v17-n11-pausa.png` });
    await page.evaluate(() => FARO.togglePause(false));
    await page.reload();
    await page.waitForFunction(() => window.FARO && FARO.loaded, null, { timeout: 180000 });
    const kept = await page.evaluate(() => ({ s: FARO.uiScale, calm: FARO.calm }));
    await newGame(page);
    await page.evaluate(() => { const g = FARO.game; const c = near(2, 3); FARO.setSelection([0, 1, 2, 3].map((i) => g.addUnit(0, i % 2 ? 'tank' : 'rifle', c[i].i))); FARO.ui.renderSel(true); });
    await page.waitForTimeout(1500);
    const fit = await page.evaluate(() => {
      const bad = [];
      for (const sel of ['#selpanel', '#buildpanel', '.topbar .res', '#leftdock']) {
        const el = document.querySelector(sel);
        if (!el || el.offsetParent === null) continue;
        for (const x of [el, ...el.querySelectorAll('.btn, .card, h3, .bitem')]) {
          const r = x.getBoundingClientRect();
          if (r.width && (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)) { bad.push(sel); break; }
        }
      }
      return bad;
    });
    await page.screenshot({ path: `${SP}/shots/v17-n11-130.png` });
    await close(page);
    const ph = await open(browser, 390, 844, { init: "localStorage.setItem('faro-uiscale', '130')" });
    const phone = await ph.evaluate(() => { FARO.ui.updateA11yBtns(); return { eff: FARO.uiScaleEff, note: document.getElementById('ui-scale-note').textContent }; });
    await close(ph);
    const ok = sc.uiz === '1.30' && sc.label === '130 %' && sc.saved === '130' && Number(sc.zoom) > 1.25 && tapCalm && calm.off === 0 && calm.onN === 1 && calm.low && calm.saved === '1' &&
      kept.s === 130 && kept.calm && !fit.length && phone.eff === 115 && /115 %/.test(phone.note);
    add('N11', ok, `«Tamaño de la interfaz» a 130 %: paneles ×${sc.zoom}, dice «${sc.label}», queda guardado (${sc.saved}) · «${calm.label}»: fogonazos ${calm.off} (sin la opción: ${calm.onN}); destello del misil suave (${calm.low}) · ` +
      `al volver a abrir el juego: ${kept.s} % y menos destellos ${kept.calm ? 'sí' : 'no'} · iPad horizontal a 130 % con 4 tropas elegidas: ${fit.length ? 'se salen: ' + fit.join(', ') : 'nada se sale de la pantalla'} · celular vertical: usa ${phone.eff} % («${phone.note}»)`);
  });

  // ---------- N14 rendimiento ----------
  await run('N14', async () => {
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
      errsAll.push(...page.errs.filter((e) => !/faro161/.test(e)));
      await page.context().close();
      return r;
    };
    const med = (x) => [...x].sort((p, q) => p - q)[1];
    const parts = [];
    let okAll = true;
    for (const [q, qn] of [['high', 'Alta calidad'], ['low', 'Más fluido']]) {
      const a = []; const b = [];
      for (let i = 0; i < 3; i++) { a.push(await fps(GAME161, q)); b.push(await fps(GAME, q)); }
      const k = med(b) / med(a);
      if (k < 0.9) okAll = false;
      parts.push(`${qn}: v1.6.1 ${med(a).toFixed(1)} (${a.map((x) => x.toFixed(1)).join(', ')}); v1.7 ${med(b).toFixed(1)} (${b.map((x) => x.toFixed(1)).join(', ')}): ${k >= 1 ? `${Math.round((k - 1) * 100)} % más` : `${Math.round((1 - k) * 100)} % menos`}`);
    }
    const kb = fs.statSync(GAME.replace('file://', '')).size / 1048576;
    add('N14', okAll && kb < 3.5, `cuadros por segundo en la misma partida (90 tropas y 9 edificios; Chromium sin tarjeta gráfica; 12 s, 3 veces, mediana) contra tu v1.6.1: ${parts.join(' · ')}. faro.html pesa ${kb.toFixed(2).replace('.', ',')} MB (meta: menos de 3,5 MB)`);
  });

  const errs = [...new Set(errsAll)];
  add('errores', errs.length === 0, errs.length ? errs.slice(0, 6).join(' | ') : 'sin errores en la consola');
  await browser.close();
  fs.writeFileSync(SP + (only ? `/results-v17-${only.join('')}.json` : '/results-v17.json'), JSON.stringify(results, null, 1));
})();

