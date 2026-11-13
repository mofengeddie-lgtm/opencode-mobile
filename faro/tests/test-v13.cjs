// Pruebas de la v1.3 en Chromium: J02, J06 (fila «aliado» y ayuda), J07 (guardado), J08 (interfaz), J09, J10, J11.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const GAME = 'file:///home/user/opencode-mobile/faro/faro.html';

async function open(browser, w, h, url = GAME, keep = null) {
  const context = keep || await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const page = await context.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  return page;
}
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);
const errsAll = [];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------- J02 abandonar la Liga 3 vs 3 cuenta como derrota ----------
  if (want('J02') || want('J09')) {
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.lobby.render(); });
    const pts = () => page.evaluate(() => ({ p: Profile.data.ranked.points, g: Profile.data.ranked.games, h: (Profile.data.ranked.history[0] || {}).forfeit }));
    if (want('J09')) {
      // Nivel 1: la Liga no se abre.
      await page.click('[data-sub="ranks"]');
      await page.waitForTimeout(250);
      const r0 = await page.evaluate(() => ({ names: [...document.querySelectorAll('.ranklist li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()), rules: document.getElementById('rank-rules').textContent, name: document.getElementById('rank-name').textContent }));
      // (aria-disabled: en el iPad se puede tocar y explica por qué no se abre; Playwright necesita «force»).
      await page.click('#btn-ranked', { force: true });
      await page.waitForTimeout(300);
      const gate = await page.evaluate(() => ({ modal: !document.getElementById('modal').hidden && document.getElementById('modal').innerText, state: FARO.state }));
      await page.evaluate(() => FARO.lobby.closeModal());
      await page.screenshot({ path: SP + '/shots/v13-j09-ranks.png' });
      // Nivel 10: ganar de 690 a Sargento con protección; la primera derrota no baja; la segunda sí.
      await page.evaluate(() => { Profile.data.xp = 9 * 1000; Profile.data.ranked.points = 680; Profile.data.ranked.shield = false; Profile.save(); FARO.lobby.render(); });
      const play = async (win) => {
        await page.click('[data-sub="ranks"]');
        await page.waitForTimeout(200);
        await page.click('#btn-ranked');
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => ({ mode: FARO.game.mode.name, key: Object.keys(MODES).find((k) => MODES[k] === FARO.game.mode), ranked: !!FARO.game.mode.ranked, diff: FARO.game.opts.difficulty }));
        await page.evaluate((w) => { const g = FARO.game; if (w) { for (const p of g.players) if (p.team !== g.players[0].team) g.kill(p.core, 0); } else g.kill(g.players[0].core, 3); g.checkEnd(); }, win);
        await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
        const end = await page.evaluate(() => (document.getElementById('enddialog').innerText.match(/Liga 3 vs 3[^\n]*/) || [''])[0]);
        await page.click('#btn-menu');
        await page.waitForTimeout(300);
        return { m, end, after: await page.evaluate(() => ({ p: Profile.data.ranked.points, rank: rankName(Profile.data.ranked.points), shield: Profile.data.ranked.shield })) };
      };
      const w1 = await play(true);
      const l1 = await play(false);
      const l2 = await play(false);
      // Temporada nueva (enero de 2027): el pase vuelve a empezar y bajas 1 rango.
      await page.evaluate(() => { Profile.data.pass = { 1: true, 2: true }; Profile.data.season.passXp = 900; Profile.data.ranked.points = 1250; Profile.save(); });
      const before = await page.evaluate(() => ({ tier: Profile.passTier(), rank: rankName(Profile.data.ranked.points), season: Profile.data.season.no }));
      await page.evaluate(() => { Profile.now = () => new Date(2027, 0, 5); Profile.refresh(); FARO.lobby.render(); });
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ modal: (document.querySelector('#modal-body h2, #modal-body h3') || {}).textContent + ': ' + ((document.querySelector('#modal-body p') || {}).textContent || ''), tier: Profile.passTier(), claimed: Object.keys(Profile.data.pass).length, rank: rankName(Profile.data.ranked.points), pts: Profile.data.ranked.points, season: Profile.data.season.no, xp: Profile.data.xp }));
      await page.screenshot({ path: SP + '/shots/v13-j09-season.png' });
      await page.evaluate(() => { FARO.lobby.closeModal(); Profile.now = () => new Date(); });
      const names = r0.names.map((n) => n.replace(/[\d.]+$/, '').trim());
      const ok = r0.names.length === 6 && /Recluta/.test(r0.names[0]) && /Almirante del Faro/.test(r0.names[5]) && r0.name === 'Recluta' &&
        /nivel 10/.test(gate.modal) && gate.state === 'menu' &&
        w1.m.key === 'league' && w1.m.ranked && w1.after.p === 705 && w1.after.rank === 'Sargento' && w1.after.shield &&
        l1.after.p === 700 && l1.after.rank === 'Sargento' && /protección/.test(l1.end) && !l1.after.shield &&
        l2.after.p === 685 && l2.after.rank === 'Cabo' &&
        before.tier === 3 && after.season === before.season + 1 && after.tier === 0 && after.claimed === 0 && after.rank === 'Sargento' && after.pts === 700 && /Temporada/.test(after.modal);
      add('J09', ok, `rangos: ${names.join(', ')} (${r0.names.map((n) => (n.match(/[\d.]+$/) || [''])[0]).join(' / ')} puntos); con nivel 1 «Jugar Liga 3 vs 3» dice «${(gate.modal.match(/La Liga[^.]*\./) || [''])[0]}» y no empieza; ` +
        `con nivel 10 abre «${w1.m.mode}» con rango (rivales en ${w1.m.diff}); ganar con 680: «${w1.end}» (protección: ${w1.after.shield}); perder: «${l1.end}» → ${l1.after.p}; perder otra vez: «${l2.end}» → ${l2.after.p} (${l2.after.rank}); ` +
        `cambio a la Temporada ${after.season}: aviso «${after.modal.replace(/\s+/g, ' ').slice(0, 200)}», pase del nivel ${before.tier} al ${after.tier} (reclamados: ${after.claimed}), Capitán (1250) → ${after.rank} (${after.pts}); la XP total no cambia (${after.xp})`);
    }
    if (want('J02')) {
      await page.evaluate(() => { Profile.data.xp = 9 * 1000; Profile.data.ranked.points = 500; Profile.data.ranked.shield = false; Profile.save(); FARO.lobby.render(); });
      const startLeague = async () => {
        await page.click('[data-sub="ranks"]');
        await page.waitForTimeout(200);
        await page.click('#btn-ranked');
        await page.waitForTimeout(500);
        await step(page, 20);
      };
      // a) Salir al menú y «Abandonar».
      const p0 = await pts();
      await startLeague();
      await page.evaluate(() => FARO.togglePause(true));
      await page.click('#btn-quit');
      await page.waitForTimeout(300);
      await page.click('[data-act="abandon"]');
      await page.waitForTimeout(300);
      const p1 = await pts();
      // b) Salir al menú y empezar otra partida encima.
      await startLeague();
      await page.evaluate(() => FARO.togglePause(true));
      await page.click('#btn-quit');
      await page.waitForTimeout(300);
      await page.click('[data-sub="main"]');
      await page.waitForTimeout(200);
      await page.evaluate(() => { Profile.data.play.mode = 'conquest'; FARO.lobby.render(); });
      await page.click('#btn-play');
      await page.waitForTimeout(400);
      const p2 = await pts();
      // c) Partida guardada que se abandona después de recargar la página.
      await page.evaluate(() => FARO.togglePause(true));
      await page.click('#btn-quit');
      await page.waitForTimeout(300);
      await page.click('[data-act="abandon"]');
      await startLeague();
      await page.evaluate(() => FARO.togglePause(true));
      await page.click('#btn-quit');
      await page.waitForTimeout(400);
      await page.reload();
      await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
      const meta = await page.evaluate(() => Save.peek());
      await page.click('[data-act="abandon"]');
      await page.waitForTimeout(300);
      const p3 = await pts();
      // d) Una partida normal abandonada no toca los puntos.
      await page.click('[data-sub="main"]');
      await page.evaluate(() => { Profile.data.play.mode = 'conquest'; FARO.lobby.render(); });
      await page.click('#btn-play');
      await page.waitForTimeout(300);
      await page.evaluate(() => FARO.togglePause(true));
      await page.click('#btn-quit');
      await page.waitForTimeout(300);
      await page.click('[data-act="abandon"]');
      await page.waitForTimeout(300);
      const p4 = await pts();
      const ok = p1.p === p0.p - 15 && p1.h && p2.p === p1.p - 15 && meta && meta.ranked && p3.p === p2.p - 15 && p4.p === p3.p && p3.g === p0.g + 3;
      add('J02', ok, `con ${p0.p} puntos: empezar la Liga, «Salir al menú» y «Abandonar» → ${p1.p} (queda como «Abandono» en tus partidas); salir y empezar otra partida encima → ${p2.p}; ` +
        `salir, recargar la página y abandonar la partida guardada → ${p3.p}; abandonar una partida normal no cambia los puntos (${p4.p}); partidas contadas: ${p3.g - p0.g}`);
    }
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- J06 fila «aliado» y textos de la ayuda ----------
  if (want('J06')) {
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => { FARO.opts = { mode: 'ffa', mapKind: 'continent', difficulty: 'normal', seed: 606 }; FARO.startGame(); });
    await step(page, 5);
    await page.waitForTimeout(400);
    const before = await page.evaluate(() => document.getElementById('players').innerText.replace(/\s+/g, ' '));
    const name = await page.evaluate(() => { FARO.game.formAlliance(0, 1); return FARO.game.players[1].name; });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => document.getElementById('players').innerText.replace(/\s+/g, ' '));
    const help = await page.evaluate(() => [...document.querySelectorAll('#pause li')].map((l) => l.textContent).filter((t) => /Mejorar:|Demoler:|Salir:/.test(t)));
    const ok = !before.includes('aliado') && new RegExp(name + '\\s*aliado').test(after) && help.some((t) => /Casa llega a nivel 2/.test(t)) && help.some((t) => /Demoler:/.test(t));
    add('J06web', ok, `fila de arriba antes: «${before}»; al aliarte con ${name}, sin que caiga nadie: «${after}»; ayuda de la pausa: ${help.map((t) => `«${t.trim()}»`).join(' ')}`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- J07 guardado: v1.2 contra v1.3, en el navegador ----------
  if (want('J07')) {
    const res = {};
    for (const [tag, url] of [['v1.2', 'file://' + SP + '/v12.html'], ['v1.3', GAME]]) {
      const page = await open(browser, 1180, 820, url);
      await page.evaluate(() => { FARO.opts = { mode: 'ffa', mapKind: 'archipelago', difficulty: 'normal', seed: 707 }; FARO.startGame(); });
      // 8 minutos de partida, dejando que el juego dibuje entre medio (como al jugar).
      for (let k = 0; k < 16; k++) { await step(page, 300); await page.waitForTimeout(200); }
      res[tag] = await page.evaluate(() => {
        const t = [];
        let kb = 0;
        for (let i = 0; i < 6; i++) {
          const t0 = performance.now();
          Save.write(FARO.game);
          t.push(performance.now() - t0);
          kb = (localStorage.getItem('faro-save-v1') || localStorage.getItem(Object.keys(localStorage).find((k) => /save/.test(k))) || '').length / 1024;
        }
        t.sort((a, b) => a - b);
        const g2 = Save.read();
        const same = g2 && g2.units.length === FARO.game.units.length && g2.buildings.length === FARO.game.buildings.length &&
          g2.cells.every((c, i) => (c.bld ? c.bld.id : -1) === (FARO.game.cells[i].bld ? FARO.game.cells[i].bld.id : -1));
        return { kb: Math.round(kb), ms: t[3], max: t[5], same, every: FARO.saveT !== undefined ? (document.body.innerHTML.includes('cada minuto') ? 60 : 15) : '?' };
      });
      errsAll.push(...page.errs);
      await page.context().close();
    }
    // Se guarda al pausar y al salir (v1.3).
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => { localStorage.removeItem('faro-save-v1'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 708 }; FARO.startGame(); });
    await step(page, 50);
    const t0 = await page.evaluate(() => { Save.clear(); FARO.togglePause(true); const m = Save.peek(); FARO.togglePause(false); return m && m.time; });
    errsAll.push(...page.errs);
    await page.context().close();
    const a = res['v1.2'];
    const b = res['v1.3'];
    const ok = b.kb <= a.kb / 2 && b.ms <= a.ms / 2 && b.same && t0 > 0;
    add('J07web', ok, `partida de 8 min con 6 imperios: v1.2 guarda ${a.kb} KB en ${a.ms.toFixed(1)} ms (máximo ${a.max.toFixed(1)}) cada 15 s; v1.3 guarda ${b.kb} KB en ${b.ms.toFixed(1)} ms (máximo ${b.max.toFixed(1)}) cada 60 s; al cargar la v1.3, tropas, edificios y casillas quedan iguales (${b.same}); al pausar se guarda (partida en el segundo ${t0})`);
  }

  // ---------- J08 interfaz en celular horizontal e iPad ----------
  if (want('J08')) {
    const out = [];
    let okAll = true;
    for (const [name, w, h] of [['iPad 1080 × 810', 1080, 810], ['celular horizontal 844 × 390', 844, 390], ['celular vertical 390 × 844', 390, 844]]) {
      const page = await open(browser, w, h);
      await page.evaluate(() => { FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame(); const g = FARO.game; g.players[0].coins = 50000; FARO.focusCore(); });
      await page.waitForTimeout(1200);
      const smallBtns = () => page.evaluate(() => [...document.querySelectorAll('button, [role="button"], .tab')].filter((b) => {
        if (!b.getClientRects().length || getComputedStyle(b).visibility === 'hidden') return false;
        const r = b.getBoundingClientRect();
        if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
        if (b.closest('#lobby, #menu, .screen[hidden]')) return false;
        return r.width < 43.5 || r.height < 43.5;
      }).map((b) => `${(b.id || b.textContent.trim() || b.className).slice(0, 16)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`));
      const small = new Set(await smallBtns());
      // Núcleo seleccionado.
      await page.evaluate(() => FARO.setSelection([FARO.game.players[0].core]));
      await page.waitForTimeout(500);
      const core = await page.evaluate(() => {
        const sp = document.getElementById('selpanel').getBoundingClientRect();
        const tb = document.querySelector('.topbar').getBoundingClientRect();
        const c = FARO.game.players[0].core;
        const pr = FARO.renderer.project(c.x, c.y + 0.6, c.z);
        const top = document.elementFromPoint(pr.x, pr.y);
        const up = [...document.querySelectorAll('#selpanel [data-act="upgrade"]')][0];
        const ub = up && up.getBoundingClientRect();
        return { top: Math.round(sp.top), h: Math.round(sp.height), tbBottom: Math.round(tb.bottom), coreFree: !!top && (top.id === 'gl' || top.id === 'overlay'), upVisible: !!ub && ub.top >= sp.top && ub.bottom <= sp.bottom + 1, more: !!document.querySelector('#btn-seldetails'), coreY: Math.round(pr.y) };
      });
      for (const b of await smallBtns()) small.add(b);
      await page.screenshot({ path: SP + `/shots/v13-j08-${w}x${h}-core.png` });
      // «Más detalles» abre lo plegado.
      await page.click('#btn-seldetails');
      await page.waitForTimeout(300);
      const more = await page.evaluate(() => ({ tiles: !!document.querySelector('#selpanel .coretiles') && document.querySelector('#selpanel .coretiles').getClientRects().length > 0, h: Math.round(document.getElementById('selpanel').getBoundingClientRect().height), top: Math.round(document.getElementById('selpanel').getBoundingClientRect().top) }));
      await page.click('#btn-seldetails');
      // Tropas elegidas y panel de construir abierto.
      await page.evaluate(() => { const g = FARO.game; const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 6); const us = sp.slice(0, 4).map((ci) => g.addUnit(0, 'rifle', ci)); FARO.setSelection(us); });
      await page.waitForTimeout(400);
      for (const b of await smallBtns()) small.add(b);
      await page.evaluate(() => { FARO.setSelection([]); if (window.innerWidth <= 860) FARO.ui.toggleBuild(true); });
      await page.waitForTimeout(400);
      for (const b of await smallBtns()) small.add(b);
      const energyOneLine = await page.evaluate(() => { const e = document.getElementById('energyRate'); return e.getClientRects().length <= 1; });
      await page.screenshot({ path: SP + `/shots/v13-j08-${w}x${h}-build.png` });
      const limit = h <= 520 ? 0.56 : 0.44;
      const ok = core.top >= core.tbBottom && core.h <= h * limit + 2 && core.upVisible && core.more && more.tiles && more.top >= core.tbBottom && small.size === 0 && energyOneLine && (w < 900 || core.coreFree);
      if (!ok) okAll = false;
      out.push(`${name}: panel del Núcleo de ${core.h} px (${Math.round((core.h / h) * 100)} % de la pantalla), empieza en y=${core.top} (la barra de arriba termina en ${core.tbBottom}), «Mejorar» a la vista ${core.upVisible}${w >= 900 ? `, el Núcleo se ve libre ${core.coreFree}` : ''}; «Más detalles» muestra las casillas de datos (${more.tiles}); botones de menos de 44 × 44: ${small.size ? [...small].join(', ') : 'ninguno'}; energía en una línea ${energyOneLine}`);
      errsAll.push(...page.errs);
      await page.context().close();
    }
    add('J08', okAll, out.join(' · '));
  }

  // ---------- J10 tutorial de 3 pasos con Barcaza ----------
  if (want('J10')) {
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.lobby.render(); });
    await page.click('[data-sub="tutorial"]');
    await page.waitForTimeout(300);
    const lobbySteps = await page.evaluate(() => [...document.querySelectorAll('.steps li')].map((l) => l.textContent));
    await page.click('#btn-play-tutorial');
    await page.waitForTimeout(800);
    const mapInfo = await page.evaluate(() => { const g = FARO.game; return { kind: g.opts.mapKind, sea: g.cells[g.players[0].core.cell].comp !== g.cells[g.players[1].core.cell].comp }; });
    const seq = [];
    const misses = [];
    let last = '';
    let won = false;
    const t0 = Date.now();
    for (let i = 0; i < 600; i++) {
      const st = await page.evaluate(() => {
        const g = FARO.game;
        if (g.over) return { over: g.result };
        const s = FARO.ui.coachStep(g);
        FARO.ui.updateCoach();
        if (!s) return null;
        const ring = document.querySelector('#coach .coach-ring');
        const r = ring && !ring.hidden ? ring.getBoundingClientRect() : null;
        return { text: FARO.ui.coachText, sel: s.sel || null, world: s.world || null, ring: r && { x: r.x + r.width / 2, y: r.y + r.height / 2 } };
      });
      if (!st) { await step(page, 10); continue; }
      if (st.over) { won = st.over === 'victory'; break; }
      const key = st.text.replace(/\(tienes \d de 3\)|\(\d de 3\)/, '');
      if (key !== last) { seq.push(st.text); last = key; if (seq.length % 4 === 1) await page.screenshot({ path: SP + `/shots/v13-j10-${String(seq.length).padStart(2, '0')}.png` }); }
      if (process.env.DEBUG) console.log(i, st.text);
      if (/espera|navega|suben/.test(st.text)) { await step(page, 20); continue; }
      if (st.sel) {
        const hit = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, free: !!top && (top === el || el.contains(top)) }; }, st.sel);
        if (!hit || !hit.free) misses.push(st.text);
        if (hit) await page.mouse.click(hit.x, hit.y);
        await page.waitForTimeout(150);
        await step(page, st.sel.includes('train') ? 25 : 3);
        continue;
      }
      if (st.ring) {
        const again = await page.evaluate(() => { FARO.ui.updateCoach(); const r = document.querySelector('#coach .coach-ring').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        if (Math.hypot(again.x - st.ring.x, again.y - st.ring.y) > 6) { await page.waitForTimeout(300); continue; }
        await page.mouse.click(st.ring.x, st.ring.y);
        await page.waitForTimeout(200);
        if (/minimapa/.test(st.text)) { await page.waitForTimeout(2000); continue; }
        await step(page, 5);
        continue;
      }
      await step(page, 10);
    }
    const objs = await page.evaluate(() => Object.keys(FARO.game.objDone));
    await page.screenshot({ path: SP + '/shots/v13-j10-final.png' });
    const need = ['Granja', 'Solar', 'Cuartel', 'Artilleros', 'Puerto', 'Barcaza', 'subirlos', 'mar junto a la isla', 'Desembarcar', 'Núcleo del bot'];
    const covered = need.filter((n) => seq.some((t) => t.includes(n)));
    const ok = won && mapInfo.sea && covered.length === need.length && misses.length === 0 && ['tut_build', 'tut_army', 'kill'].every((k) => objs.includes(k)) && lobbySteps.length === 3;
    add('J10', ok, `en el vestíbulo: ${lobbySteps.map((t) => `«${t}»`).join(' ')}; mapa ${mapInfo.kind} con el bot en otra isla (${mapInfo.sea}); siguiendo solo el aro y el texto, con toques: ${seq.length} pasos (${seq.map((t) => `«${t}»`).join(' → ')}); ` +
      `${misses.length ? `botones tapados: ${misses.join('; ')}` : 'ningún botón señalado estaba tapado'}; objetivos cumplidos: ${objs.join(', ')}; resultado: ${won ? 'victoria' : 'sin terminar'} (${Math.round((Date.now() - t0) / 1000)} s de prueba)`);
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- J11 copia del progreso ----------
  if (want('J11')) {
    const a = await open(browser, 1180, 820);
    await a.evaluate(() => { localStorage.clear(); Profile.load(); const P = Profile.data; P.xp = 12345; P.crystals = 777; P.owned.frente_inf = true; P.ranked.points = 900; P.fragments = 55; P.tutorialDone = true; Profile.save(); FARO.lobby.render(); });
    await a.click('[data-m="backup"]');
    await a.waitForTimeout(300);
    const code = await a.evaluate(() => document.getElementById('bk-out').value);
    await a.click('#btn-bk-copy');
    await a.waitForTimeout(300);
    const copied = await a.evaluate(() => (document.getElementById('bk-msg') || {}).textContent || '');
    await a.screenshot({ path: SP + '/shots/v13-j11-export.png' });
    const want0 = await a.evaluate(() => JSON.stringify({ xp: Profile.data.xp, c: Profile.data.crystals, o: Profile.data.owned, r: Profile.data.ranked.points, f: Profile.data.fragments, t: Profile.data.tutorialDone }));
    errsAll.push(...a.errs);
    await a.context().close();
    // Otro navegador (sin nada guardado).
    const b = await open(browser, 820, 1180);
    const fresh = await b.evaluate(() => Profile.data.xp);
    await b.click('[data-m="backup"]');
    await b.waitForTimeout(300);
    // Copia cortada: no se carga.
    await b.fill('#bk-in', code.slice(0, code.length - 40));
    await b.click('#btn-bk-load');
    await b.waitForTimeout(200);
    const cut = await b.evaluate(() => ({ msg: (document.getElementById('bk-msg') || {}).textContent || '', xp: Profile.data.xp }));
    await b.fill('#bk-in', code);
    await b.click('#btn-bk-load');
    await b.waitForTimeout(200);
    const ask = await b.evaluate(() => document.getElementById('btn-bk-load').textContent);
    await b.click('#btn-bk-load');
    await b.waitForTimeout(300);
    const got = await b.evaluate(() => JSON.stringify({ xp: Profile.data.xp, c: Profile.data.crystals, o: Profile.data.owned, r: Profile.data.ranked.points, f: Profile.data.fragments, t: Profile.data.tutorialDone }));
    const msg = await b.evaluate(() => (document.getElementById('bk-msg') || {}).textContent || '');
    await b.screenshot({ path: SP + '/shots/v13-j11-import.png' });
    await b.reload();
    await b.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
    const kept = await b.evaluate(() => Profile.data.xp);
    errsAll.push(...b.errs);
    await b.context().close();
    const ok = /^FARO1\./.test(code) && fresh === 0 && /incompleta/.test(cut.msg) && cut.xp === 0 && /Reemplazar/.test(ask) && got === want0 && kept === 12345;
    add('J11', ok, `código de ${code.length} caracteres («${code.slice(0, 14)}…»), «Copiar»: «${copied}»; en otro navegador (nivel 1): una copia cortada no se carga («${cut.msg}»); la entera pide confirmar («${ask}») y carga: «${msg}»; datos iguales (nivel, cristales, aspectos, puntos, fragmentos, tutorial): ${got === want0}; sigue al recargar (${kept} XP)`);
  }

  add('errores', errsAll.length === 0, errsAll.length ? errsAll.slice(0, 5).join(' | ') : 'sin errores en la consola');
  fs.writeFileSync(SP + '/results-v13' + (only ? '-' + only.join('') : '') + '.json', JSON.stringify(results, null, 1));
  console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
