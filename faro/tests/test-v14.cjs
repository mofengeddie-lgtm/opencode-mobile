// Pruebas de la v1.4 en Chromium (iPad, toques simulados): K01-K10 en pantalla.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const errsAll = [];

async function open(browser, w = 1180, h = 820) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true })).newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('faro-profile-v1'); localStorage.removeItem('faro-cvd'); localStorage.removeItem('faro-battery'); localStorage.removeItem('faro-bigtext'); Profile.load(); FARO.lobby.render(); });
  return page;
}
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);
// Toque real en el centro de un botón, comprobando que nada lo tapa.
async function tapBtn(page, sel) {
  const hit = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); return { x, y, free: !!t && (t === el || el.contains(t)) }; }, sel);
  if (!hit) throw new Error('no está ' + sel);
  await page.mouse.click(hit.x, hit.y);
  await page.waitForTimeout(150);
  return hit.free;
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------- K01-K05 en pantalla ----------
  if (want('K15')) {
    const page = await open(browser);
    await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 1401 }; FARO.startGame(); const g = FARO.game; g.bots = []; g.players[0].coins = 20000; FARO.focusCore(); });
    await step(page, 3);
    // Tropas elegidas: Patrullar y luego tocar un punto del mapa.
    await page.evaluate(() => { const g = FARO.game; const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 8); window.US = sp.slice(4, 8).map((ci) => g.addUnit(0, 'rifle', ci)); FARO.setSelection(US); });
    await page.waitForTimeout(400);
    const f1 = await tapBtn(page, '#btn-patrol');
    const armed = await page.evaluate(() => FARO.input.amoveArm);
    const pt = await page.evaluate(() => { const g = FARO.game; const core = g.cells[g.players[0].core.cell]; const c = g.cells.filter((x) => g.passable(x, 'land', 0) && !x.bld && g.map.dist(x, core) === 5 && x.comp === core.comp).map((x) => ({ x, s: FARO.renderer.project(x.x, x.h, x.z) })).find((o) => o.s.ok && o.s.x > 300 && o.s.x < 800 && o.s.y > 150 && o.s.y < 560 && document.elementFromPoint(o.s.x, o.s.y).id === 'gl'); return c && { x: c.s.x, y: c.s.y, i: c.x.i }; });
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(250);
    await step(page, 200);
    await page.waitForTimeout(2500);
    const pat = await page.evaluate(() => ({ n: US.filter((u) => u.patrol).length, laps: Math.max(...US.map((u) => (u.patrol ? u.patrol.laps : 0))), label: document.getElementById('btn-patrol').textContent.trim() }));
    // Mantener posición.
    const f2 = await tapBtn(page, '#btn-hold');
    const hold = await page.evaluate(() => ({ n: US.filter((u) => u.hold).length, patrol: US.filter((u) => u.patrol).length, label: document.getElementById('btn-hold').textContent.trim() }));
    // Veterana: estrellas en la ficha.
    await page.evaluate(() => { const g = FARO.game; const u = US[0]; for (let i = 0; i < 8; i++) g.creditKill(u, { kind: 'unit', mover: 'land' }); FARO.setSelection([u]); });
    await page.waitForTimeout(400);
    const vet = await page.evaluate(() => ({ title: document.querySelector('#selpanel h3').textContent.trim(), sub: document.querySelector('#selpanel .selhead p').textContent.trim() }));
    await page.screenshot({ path: SP + '/shots/v14-k-vet.png' });
    // Reparación sola: botón en la ficha del Constructor.
    await page.evaluate(() => { const g = FARO.game; FARO.setSelection(g.units.filter((u) => u.owner === 0 && u.def.builds)); });
    await page.waitForTimeout(300);
    const r0 = await page.evaluate(() => FARO.game.players[0].autoRepair !== false);
    const f3 = await tapBtn(page, '#btn-autorep');
    const r1 = await page.evaluate(() => ({ on: FARO.game.players[0].autoRepair !== false, label: document.getElementById('btn-autorep').textContent.trim() }));
    await tapBtn(page, '#btn-autorep');
    // Producción continua: «Siempre» en el Cuartel.
    await page.evaluate(() => { const g = FARO.game; const core = g.cells[g.players[0].core.cell]; const c = g.cells.filter((x) => !g.placeInvalid(0, 'barracks', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; window.BAR = g.addBuilding(0, 'barracks', c.i, true); g.players[0].coins = 1300; g.enqueue(BAR, 'rifle'); FARO.setSelection([BAR]); });
    await page.waitForTimeout(400);
    const f4 = await tapBtn(page, '#btn-loop');
    await step(page, 300);
    await page.waitForTimeout(400);
    const loop = await page.evaluate(() => ({ on: BAR.loop, label: document.getElementById('btn-loop').textContent.trim(), wait: (document.getElementById('loop-wait') || {}).textContent || '', made: FARO.game.players[0].stats.looped || 0 }));
    await page.screenshot({ path: SP + '/shots/v14-k-loop.png' });
    const ok = f1 && armed === 'patrol' && pat.n === 4 && pat.laps >= 1 && /Patrullando/.test(pat.label) && f2 && hold.n === 4 && hold.patrol === 0 && /sí/.test(hold.label) &&
      /★★/.test(vet.title) && /eliminaciones/.test(vet.sub) && r0 && f3 && !r1.on && /no/.test(r1.label) && f4 && loop.on && loop.made >= 1 && /Esperando/.test(loop.wait);
    add('K15web', ok, `«Patrullar» y tocar un punto a 5 casillas: ${pat.n} de 4 tropas patrullan (${pat.laps} tramos en 20 s; el botón dice «${pat.label}»); «Mantener posición»: ${hold.n} de 4 (dejan de patrullar: ${hold.patrol === 0}; «${hold.label}»); ` +
      `veterana con 8 eliminaciones: «${vet.title}» y «${vet.sub.split('·').pop().trim()}»; «Reparación sola» empieza en sí y al tocarlo queda «${r1.label}»; «Siempre» en el Cuartel entrenó ${loop.made} más y luego «${loop.wait.trim()}»; ningún botón tapado: ${f1 && f2 && f3 && f4}`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- K06 logros ----------
  if (want('K06')) {
    const page = await open(browser);
    const before = await page.evaluate(() => ({ n: Object.keys(Profile.data.achievements).length, c: Profile.data.crystals }));
    // Una partida ganada rápido, sin perder edificios, con las marcas de varios logros.
    const play = async (setup) => {
      await page.evaluate((s) => {
        FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 1406, ...(s.weekly ? { weekly: 'w-prueba' } : {}) };
        FARO.startGame();
        const g = FARO.game;
        const st = g.players[0].stats;
        Object.assign(st, s.stats);
        const P = Profile.data;
        Object.assign(P.stats, s.pstats);
        P.ranked.best = s.best;
        if (s.tutorial) P.tutorialDone = true;
        g.time = s.time;
        for (const p of g.players) if (p.team !== g.players[0].team) g.kill(p.core, 0);
        g.checkEnd();
      }, setup);
      try { await page.waitForSelector('#end:not([hidden])', { timeout: 40000 }); } catch (e) {
        console.log('DEBUG fin', JSON.stringify(await page.evaluate(() => ({ over: FARO.game.over, res: FARO.game.result, state: FARO.state, end: document.getElementById('end').hidden, brief: document.getElementById('brief').hidden }))), page.errs);
        throw e;
      }
      const lines = await page.evaluate(() => (document.getElementById('enddialog').innerText.match(/Logro: [^·\n]*/g) || []).map((t) => t.trim()));
      await page.click('#btn-menu');
      await page.waitForTimeout(300);
      return lines;
    };
    const l1 = await play({ stats: { built: 26, trained: 2, airKills: 11, bestVet: 3, landings: 1, faro: 1, lostBld: 0 }, pstats: { wins: 9, trained: 99, faro: 2 }, best: 720, tutorial: true, time: 420, weekly: true });
    const mid = await page.evaluate(() => ({ n: Object.keys(Profile.data.achievements).length, c: Profile.data.crystals, ids: Object.keys(Profile.data.achievements) }));
    const l2 = await play({ stats: { built: 30, airKills: 20, bestVet: 3, landings: 2, faro: 1, lostBld: 0 }, pstats: {}, best: 720, tutorial: true, time: 400, weekly: true });
    const end = await page.evaluate(() => ({ n: Object.keys(Profile.data.achievements).length, c: Profile.data.crystals }));
    await page.click('[data-view="inv"]');
    await page.waitForTimeout(300);
    const inv = await page.evaluate(() => ({ cards: document.querySelectorAll('#logros .ach').length, on: document.querySelectorAll('#logros .ach.on').length, title: document.querySelector('#logros h3').textContent }));
    await page.evaluate(() => document.getElementById('logros').scrollIntoView());
    await page.screenshot({ path: SP + '/shots/v14-k06-logros.png' });
    const sumCrystals = await page.evaluate(() => ACHIEVEMENTS.reduce((s, a) => s + a.crystals, 0));
    const ok = before.n === 0 && l1.length === 12 && mid.n === 12 && l2.length === 0 && end.n === 12 && inv.cards === 12 && inv.on === 12;
    add('K06', ok, `una partida con todas las marcas: ${l1.length} logros nuevos (${l1.map((t) => t.replace('Logro: ', '')).join('; ')}); los 12 juntos dan ${sumCrystals} cristales; ` +
      `otra partida igual: ${l2.length} logros nuevos (no se repiten ni vuelven a dar cristales); en el Inventario: «${inv.title}» con ${inv.on} insignias encendidas`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- K07 Top jugadores ----------
  if (want('K07')) {
    const page = await open(browser);
    const read = () => page.evaluate(() => {
      const rows = [...document.querySelectorAll('#toptable tbody tr')].filter((r) => !r.classList.contains('gap'));
      const vals = rows.map((r) => ({ pos: parseInt(r.cells[0].textContent, 10), name: r.cells[1].textContent.trim(), me: r.classList.contains('me'), val: Number(r.cells[r.classList.contains('me') ? 3 : 3] ? r.cells[3].textContent.replace(/\D/g, '') : 0), medal: !!r.querySelector('.medal') }));
      return { vals, gap: !!document.querySelector('#toptable tr.gap'), tab: document.querySelector('.subtabs .on').textContent };
    });
    await page.click('[data-sub="top"]');
    await page.waitForTimeout(300);
    const t1 = await read();
    await page.click('[data-act="toptab"][data-v="wins"]');
    await page.waitForTimeout(200);
    const t2 = await read();
    await page.click('[data-act="toptab"][data-v="islands"]');
    await page.waitForTimeout(200);
    const t3 = await read();
    // Con muchos puntos, tu fila sube a los 10 primeros.
    await page.evaluate(() => { Profile.data.ranked.points = 2600; Profile.data.ranked.games = 40; Profile.data.ranked.wins = 30; FARO.lobby.topTab = 'liga'; FARO.lobby.render(); });
    await page.waitForTimeout(200);
    const t4 = await read();
    await page.screenshot({ path: SP + '/shots/v14-k07-top.png' });
    const sorted = (t) => { const top = t.vals.filter((v) => !v.me || v.pos <= 10); return top.every((v, i) => i === 0 || top[i - 1].val >= v.val); };
    const me = (t) => t.vals.find((v) => v.me);
    const ok = [t1, t2, t3].every((t) => t.vals.length === 11 && t.gap && me(t) && me(t).pos > 10 && t.vals.filter((v) => v.medal).length === 3 && sorted(t)) &&
      t4.vals.length === 10 && !t4.gap && me(t4) && me(t4).pos <= 3 && t4.vals.find((v) => v.me).medal;
    add('K07', ok, `pestañas «${t1.tab}», «${t2.tab}» e «${t3.tab}»: 10 primeros ordenados con oro, plata y bronce, y abajo «···» y tu fila (puesto ${me(t1).pos} de 51); ` +
      `con 2.600 puntos subes al puesto ${me(t4).pos} y tu fila queda arriba con medalla; los demás dicen «bot»`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- K08 desafío semanal ----------
  if (want('K08')) {
    const page = await open(browser);
    const weeks = await page.evaluate(() => {
      const at = (y, m, d) => weeklyFor(new Date(y, m - 1, d));
      const mon = at(2026, 11, 9); const sun = at(2026, 11, 15); const nextMon = at(2026, 11, 16);
      return { mon: mon.name + '/' + mon.seed, sun: sun.name + '/' + sun.seed, next: nextMon.name + '/' + nextMon.seed, all: [0, 1, 2, 3, 4, 5].map((k) => at(2026, 11, 9 + k * 7).name) };
    });
    await page.click('[data-sub="weekly"]');
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => ({ name: document.querySelector('.weekly h2').textContent, desc: document.getElementById('weekly-desc').textContent }));
    await page.screenshot({ path: SP + '/shots/v14-k08-weekly.png' });
    const playW = async (win) => {
      await page.click('[data-sub="weekly"]');
      await page.waitForTimeout(200);
      await page.click('#btn-weekly');
      await page.waitForTimeout(500);
      const g = await page.evaluate(() => ({ seed: FARO.game.opts.seed, map: FARO.game.opts.mapKind, weekly: FARO.game.opts.weekly }));
      await page.evaluate((w) => { const g = FARO.game; g.time = w ? 500 + Math.random() * 10 : 300; if (w) { for (const p of g.players) if (p.team !== g.players[0].team) g.kill(p.core, 0); } else g.kill(g.players[0].core, 1); g.checkEnd(); }, win);
      await page.waitForSelector('#end:not([hidden])', { timeout: 40000 });
      const text = await page.evaluate(() => document.getElementById('enddialog').innerText);
      await page.click('#btn-menu');
      await page.waitForTimeout(300);
      return { g, crystals: /Desafío semanal ganado: \+150/.test(text) };
    };
    const c0 = await page.evaluate(() => Profile.data.crystals);
    const a = await playW(false);
    const b = await playW(true);
    const c1 = await page.evaluate(() => Profile.data.crystals);
    const c = await playW(true);
    await page.click('[data-sub="weekly"]');
    await page.waitForTimeout(200);
    const rec = await page.evaluate(() => { const W = weeklyFor(Profile.now()); return { ...Profile.data.weekly[W.week], best: (document.getElementById('weekly-best') || {}).textContent }; });
    const ok = weeks.mon === weeks.sun && weeks.mon !== weeks.next && new Set(weeks.all).size === 6 && a.g.seed === b.g.seed && b.g.seed === c.g.seed && !a.crystals && b.crystals && !c.crystals && rec.won && rec.tries === 3 && !!rec.best;
    add('K08', ok, `del lunes 9 al domingo 15 de noviembre es el mismo desafío (${weeks.mon.split('/')[0]}, semilla ${weeks.mon.split('/')[1]}) y el lunes 16 cambia (${weeks.next.split('/')[0]}); las 6 semanas siguientes traen ${new Set(weeks.all).size} desafíos distintos; ` +
      `esta semana: «${info.name.replace('Desafío semanal: ', '')}» («${info.desc}»); 3 intentos con el mismo mapa y semilla (${a.g.map}, ${a.g.seed}); perder no da premio, la primera victoria da 150 cristales y la segunda no; mejor tiempo guardado: ${rec.best}`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- K09 ahorro de batería ----------
  if (want('K09')) {
    const page = await open(browser);
    await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 1409 }; FARO.startGame(); });
    await page.waitForTimeout(500);
    // Se detiene el bucle real y se le dan 2 s de cuadros simulados de una pantalla de 120 Hz y de 60 Hz.
    const res = await page.evaluate(() => {
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = () => 0;
      const count = (hz) => {
        let n = 0;
        const fr = FARO.renderer.frame.bind(FARO.renderer);
        FARO.renderer.frame = (...a) => { n++; return fr(...a); };
        const t0 = performance.now() + 1000;
        FARO.lastDraw = 0;
        for (let i = 0; i < hz * 2; i++) FARO.loop(t0 + (i * 1000) / hz);
        FARO.renderer.frame = fr;
        return n / 2;
      };
      const out = {};
      FARO.setBattery(false);
      out.off120 = count(120); out.off60 = count(60);
      const fxOff = FARO.renderer.fxs ? FARO.renderer.fxs.scale : null;
      FARO.setBattery(true);
      out.on120 = count(120); out.on60 = count(60);
      out.fxOn = FARO.renderer.fxs ? FARO.renderer.fxs.scale : null;
      out.fxOff = fxOff;
      out.quality = FARO.renderer.quality;
      out.saved = localStorage.getItem('faro-battery');
      FARO.setBattery(false);
      window.requestAnimationFrame = raf;
      requestAnimationFrame((t) => FARO.loop(t));
      return out;
    });
    const ok = res.on120 >= 28 && res.on120 <= 31 && res.on60 >= 28 && res.on60 <= 31 && res.off120 >= 119 && res.fxOn < res.fxOff && res.quality === 'low' && res.saved === '1';
    add('K09', ok, `pantalla de 120 Hz: sin ahorro dibuja ${res.off120} cuadros por segundo y con ahorro ${res.on120}; de 60 Hz: ${res.off60} y ${res.on60}; partículas al ${Math.round(res.fxOff * 100)} % → ${Math.round(res.fxOn * 100)} %; gráficos en «${res.quality === 'low' ? 'más fluido' : res.quality}»; la opción se recuerda (${res.saved === '1'})`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- K10 daltonismo y letra grande en pantalla ----------
  if (want('K10')) {
    const page = await open(browser);
    await page.evaluate(() => { FARO.opts = { mode: 'ffa', mapKind: 'continent', difficulty: 'easy', seed: 1410 }; FARO.startGame(); FARO.focusCore(); });
    await page.waitForTimeout(600);
    const before = await page.evaluate(() => ({ names: FARO.game.players.map((p) => p.name), cols: FARO.game.players.map((p) => p.color.toString(16)) }));
    await page.evaluate(() => FARO.togglePause(true));
    await page.waitForTimeout(200);
    const fc = await tapBtn(page, '#btn-cvd');
    const fb = await tapBtn(page, '#btn-bigtext');
    await page.evaluate(() => FARO.togglePause(false));
    await page.waitForTimeout(800);
    // Formas del minimapa: se cuentan las llamadas a la función de formas en un cuadro.
    const shapes = await page.evaluate(() => {
      const seen = new Set();
      const orig = window.minimapShape;
      window.minimapShape = (ctx, shape, x, y, r) => { seen.add(shape); return orig(ctx, shape, x, y, r); };
      FARO.renderer.drawMinimap(document.getElementById('minimap'));
      window.minimapShape = orig;
      return [...seen];
    });
    const after = await page.evaluate(() => ({ names: FARO.game.players.map((p) => p.name), cols: FARO.game.players.map((p) => p.color.toString(16)), chips: document.getElementById('players').innerText.replace(/\s+/g, ' '), big: document.body.classList.contains('bigtext'), zoom: getComputedStyle(document.querySelector('#objlist')).zoom }));
    await page.screenshot({ path: SP + '/shots/v14-k10-cvd.png' });
    // Recordado al recargar.
    await page.reload();
    await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
    const kept = await page.evaluate(() => ({ cvd: FARO.cvd, big: document.body.classList.contains('bigtext'), c1: PLAYER_COLORS[1].toString(16) }));
    await page.evaluate(() => { FARO.setCvd(false); FARO.setBigText(false); });
    const ok = fc && fb && after.names.join() !== before.names.join() && after.cols[1] !== before.cols[1] && after.chips.includes(after.names[1]) && shapes.length >= 4 && after.big && Number(after.zoom) > 1 && kept.cvd && kept.big;
    add('K10web', ok, `en la pausa «Colores para daltonismo»: jugadores ${before.names.slice(1).join(', ')} → ${after.names.slice(1).join(', ')} (la fila de arriba se actualiza: «${after.chips}»); el minimapa dibuja ${shapes.length} formas distintas (${shapes.map((x) => ({ circle: 'círculo', square: 'cuadrado', triangle: 'triángulo', diamond: 'rombo', star: 'estrella', cross: 'cruz' }[x] || x)).join(', ')}); ` +
      `«Letra grande» agranda los paneles (×${after.zoom}); las dos opciones se recuerdan al volver a abrir el juego (${kept.cvd && kept.big})`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  add('errores', errsAll.length === 0, errsAll.length ? errsAll.slice(0, 5).join(' | ') : 'sin errores en la consola');
  fs.writeFileSync(SP + '/results-v14' + (only ? '-' + only.join('') : '') + '.json', JSON.stringify(results, null, 1));
  console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
