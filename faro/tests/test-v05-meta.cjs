const { chromium } = require('playwright');
const SP = __dirname;
const results = [];
const check = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(ok ? 'OK ' : 'FALLA', id, ev); };
async function open(browser, { owner = false, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  if (owner) await ctx.addInitScript(() => { window.claude = { use: async (n) => (n === 'user' ? { isOwner: async () => true } : null) }; });
  else await ctx.addInitScript(() => { window.claude = { use: async (n) => (n === 'user' ? { isOwner: async () => false } : null) }; });
  if (storage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, storage);
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await page.route('**/GLTFLoader.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/examples/js/loaders/GLTFLoader.js', contentType: 'application/javascript' }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded && Creator.checked, null, { timeout: 30000 });
  return { ctx, page };
}
async function waitEnd(page) {
  // La pantalla final aparece 1,6 s después del final y se dibuja en el siguiente cuadro (~0,5 s sin GPU).
  await page.waitForFunction(() => !document.getElementById('end').hidden && document.getElementById('enddialog').innerText.length > 50, null, { timeout: 10000 }).catch(() => {});
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // 1) Jugador normal: PLAY, salir, volver, recargar, continuar.
  let { ctx, page } = await open(browser);
  check('B21-no-dueño', await page.evaluate(() => !document.querySelector('[data-m="creator"]') && $('creator-badge').hidden), 'sin botón ni insignia de creador para otra cuenta');
  await page.tap('#btn-play');
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => { const g = FARO.game; const me = g.players[0];
    return { state: FARO.state, units: g.units.filter((u) => u.owner === 0 && u.type !== 'builder').length, builders: g.units.filter((u) => u.owner === 0 && u.type === 'builder').length, coins: me.coins, blds: g.buildings.filter((b) => b.owner === 0).map((b) => b.type), mode: g.mode.name, creator: g.creator }; });
  check('B01-inicio', st.state === 'play' && st.units === 0 && st.builders === 1 && st.coins >= 2000 && st.coins < 2050 && st.blds.join() === 'core,farm' && !st.creator, JSON.stringify(st));
  // avanza la partida
  await page.evaluate(() => { const g = FARO.game; g.players[0].core.queue.push({ type: 'builder', t: 0 }); for (let i = 0; i < 600; i++) g.update(0.1); });
  const t1 = await page.evaluate(() => Math.round(FARO.game.time));
  await page.evaluate(() => FARO.togglePause(true));
  await page.tap('#btn-quit');
  await page.waitForTimeout(200);
  const menu1 = await page.evaluate(() => ({ menu: !$('menu').hidden, resume: !!document.querySelector('[data-act="resume"]'), saved: !!localStorage.getItem('faro-save-v1') }));
  check('B20-salir', menu1.menu && menu1.resume && menu1.saved, JSON.stringify(menu1));
  await page.tap('[data-act="resume"]');
  await page.waitForTimeout(200);
  const back = await page.evaluate(() => ({ state: FARO.state, time: Math.round(FARO.game.time), units: FARO.game.units.filter((u) => u.owner === 0).length }));
  check('B20-volver', back.state === 'play' && Math.abs(back.time - t1) <= 1, JSON.stringify(back) + ' t1=' + t1);
  // Guardado automático y recarga
  await page.evaluate(() => { for (let i = 0; i < 300; i++) FARO.game.update(0.1); FARO.saveT = 0; });
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => Math.round(FARO.game.time));
  const snap = await page.evaluate(() => ({ b: FARO.game.buildings.length, u: FARO.game.units.length, coins: Math.round(FARO.game.players[0].coins) }));
  await page.reload();
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const hasLoad = await page.evaluate(() => !!document.querySelector('[data-act="load"]') && document.querySelector('.resume').textContent);
  await page.tap('[data-act="load"]');
  await page.waitForTimeout(400);
  const loaded = await page.evaluate(() => ({ state: FARO.state, time: Math.round(FARO.game.time), b: FARO.game.buildings.length, u: FARO.game.units.length, coins: Math.round(FARO.game.players[0].coins) }));
  check('B20-recargar', hasLoad && loaded.state === 'play' && Math.abs(loaded.time - t2) <= 16 && loaded.b > 0, `banner="${hasLoad && hasLoad.replace(/\s+/g, ' ').trim()}" antes=${JSON.stringify(snap)} t=${t2} cargada=${JSON.stringify(loaded)}`);
  await page.evaluate(() => { for (let i = 0; i < 200; i++) FARO.game.update(0.1); });
  await page.waitForTimeout(500);
  // Final de partida: forzar victoria
  await page.evaluate(() => { $('enddialog').innerHTML = ''; const g = FARO.game; g.players[0].stats.captures = 2; for (const p of g.players) if (p.id !== 0) g.eliminate(p.id, 0); });
  await waitEnd(page);
  const end = await page.evaluate(() => ({ shown: !$('end').hidden, text: $('enddialog').innerText, xp: Profile.data.xp, cr: Profile.data.crystals, games: Profile.data.stats.games, wins: Profile.data.stats.wins, saved: !!localStorage.getItem('faro-save-v1') }));
  check('B19-victoria', end.shown && /Victoria/.test(end.text) && /Posiciones/i.test(end.text) && /Mirar el final/.test(end.text) && /Revancha/.test(end.text) && /Vestíbulo/.test(end.text) && end.games === 1 && end.wins === 1 && !end.saved,
    `xp=${end.xp} cristales=${end.cr} partidas=${end.games} victorias=${end.wins} guardada=${end.saved} | ${end.text.replace(/\s+/g, ' ').slice(0, 700)}`);
  await page.tap('#btn-menu');
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ resume: !!document.querySelector('[data-act="resume"],[data-act="load"]'), nums: document.querySelector('.numbers').innerText.replace(/\s+/g, ' ') }));
  check('B16-numeros', !after.resume && /Partidas 1/.test(after.nums) && /Victorias 1/.test(after.nums), after.nums);
  // Derrota con consejo
  await page.tap('#btn-play');
  await page.waitForTimeout(300);
  await page.evaluate(() => { $('enddialog').innerHTML = ''; const g = FARO.game; g.players[0].stats.hitBy = { tank: 5000, rifle: 300 }; g.eliminate(0, 1); });
  await waitEnd(page);
  const lose = await page.evaluate(() => $('enddialog').innerText.replace(/\s+/g, ' '));
  check('B19-derrota', /Derrota/.test(lose) && /Consejo/.test(lose) && /Cazadores/.test(lose), lose.slice(0, 500));
  await page.tap('#btn-menu');
  // Premio diario, códigos, pase, misiones, cofres, tienda e inventario
  await page.tap('[data-m="daily"]');
  const c0 = await page.evaluate(() => Profile.data.crystals);
  await page.tap('[data-act="dailyclaim"]');
  const c1 = await page.evaluate(() => ({ cr: Profile.data.crystals, idx: Profile.data.daily.idx, can: Profile.dailyClaimable() }));
  // Simula faltar 2 días
  await page.evaluate(() => { const D = Profile.data.daily; D.idx = 4; D.last = keyOfDay(dayNum(dayKey()) - 3); Profile.refresh(); });
  const miss = await page.evaluate(() => ({ idx: Profile.data.daily.idx, can: Profile.dailyClaimable() }));
  check('B16-premio-diario', c1.cr === c0 + 20 && c1.idx === 1 && !c1.can && miss.idx === 2 && miss.can, `antes ${c0} después ${JSON.stringify(c1)}; tras faltar 2 días de racha 4 → ${JSON.stringify(miss)}`);
  await page.evaluate(() => FARO.lobby.closeModal());
  await page.tap('[data-m="codes"]');
  await page.fill('#code-input', 'faro2026');
  await page.tap('#code-form button[type="submit"]');
  const code1 = await page.evaluate(() => ({ cr: Profile.data.crystals, msg: document.querySelector('#modal-body .advice').innerText }));
  await page.fill('#code-input', 'FARO2026');
  await page.tap('#code-form button[type="submit"]');
  const code2 = await page.evaluate(() => document.querySelector('#modal-body .advice').innerText);
  await page.fill('#code-input', 'NOEXISTE');
  await page.tap('#code-form button[type="submit"]');
  const code3 = await page.evaluate(() => document.querySelector('#modal-body .advice').innerText);
  check('B16-codigos', /100 cristales/.test(code1.msg) && /Ya usaste/.test(code2) && /no existe/.test(code3), `${code1.msg} | ${code2} | ${code3}`);
  await page.evaluate(() => FARO.lobby.closeModal());
  // Pase: dar XP y reclamar
  await page.evaluate(() => { Profile.data.xp = 3100; Profile.save(); FARO.lobby.render(); });
  await page.tap('[data-m="pass"]');
  const passInfo = await page.evaluate(() => ({ tiers: document.querySelectorAll('.tier').length, claim: document.querySelectorAll('[data-act="passclaim"]').length }));
  await page.tap('[data-act="passall"]');
  const passAfter = await page.evaluate(() => ({ claimed: Object.keys(Profile.data.pass).length, cr: Profile.data.crystals, opened: Profile.data.chests.opened }));
  check('B16-pase', passInfo.tiers === 40 && passInfo.claim === 10 && passAfter.claimed === 10 && passAfter.opened >= 2, `${JSON.stringify(passInfo)} → ${JSON.stringify(passAfter)}`);
  await page.evaluate(() => FARO.lobby.closeModal());
  await page.tap('[data-m="missions"]');
  const mis = await page.evaluate(() => ({ n: document.querySelectorAll('.mission').length, reroll: document.querySelectorAll('[data-act="reroll-m"]').length, prog: Profile.data.missions.daily.map((m) => m.id + ':' + m.prog).join(',') }));
  if (mis.reroll) await page.tap('[data-act="reroll-m"]');
  const mis2 = await page.evaluate(() => ({ reroll: document.querySelectorAll('[data-act="reroll-m"]').length, rerolled: Profile.data.missions.rerolled }));
  check('B16-misiones', mis.n === 6 && mis.reroll > 0 && mis2.reroll === 0 && mis2.rerolled, `${JSON.stringify(mis)} → ${JSON.stringify(mis2)}`);
  await page.evaluate(() => FARO.lobby.closeModal());
  // Cofres con garantía y repetidos
  const chest = await page.evaluate(() => {
    Profile.data.crystals = 100000; Profile.data.chests.pity = 0; Profile.data.owned = {};
    let legend = 0; let dups = 0; let maxGap = 0; let gap = 0; const before = Profile.data.crystals;
    for (let i = 0; i < 300; i++) { const r = FARO.lobby.openChest('isla', false, true); gap++; if (r.item.rar === 'legendario') { legend++; maxGap = Math.max(maxGap, gap); gap = 0; } if (r.dup) dups++; }
    return { legend, dups, maxGap, spent: before - Profile.data.crystals, owned: Object.keys(Profile.data.owned).length, pool: SKINS.filter((x) => !x.special).length };
  });
  check('B16-cofres', chest.maxGap <= 30 && chest.legend >= 10 && chest.dups > 0 && chest.owned >= chest.pool - 2, JSON.stringify(chest) + ' (con azar: casi todos los aspectos en 300 cofres)');
  // Tienda: comprar y equipar
  await page.evaluate(() => { Profile.data.owned = {}; Profile.data.crystals = 400; Profile.save(); FARO.lobby.view = 'shop'; FARO.lobby.shopTab = 'skins'; FARO.lobby.render(); });
  await page.tap('[data-act="buy"][data-id="selva_inf"]');
  const buy = await page.evaluate(() => ({ cr: Profile.data.crystals, own: !!Profile.data.owned.selva_inf }));
  await page.tap('#lobby-tabs [data-view="inv"]');
  await page.tap('[data-act="equip"][data-id="selva_inf"]');
  await page.tap('#lobby-tabs [data-view="play"]');
  await page.tap('#btn-play');
  await page.waitForTimeout(300);
  const skin = await page.evaluate(() => { const g = FARO.game; const u = g.addUnit(0, 'rifle', g.freeCellsNear(g.players[0].core.cell, 'land', 1, 4)[0]); FARO.renderer.syncEntities(0, 0); return { looks: g.opts.looks, key: [..._modelCache.keys()].filter((k) => k.startsWith('rifle:')).join(' ') }; });
  check('B16-tienda-inventario', buy.cr === 250 && buy.own && skin.looks.inf === 'selva' && /selva/.test(skin.key), `${JSON.stringify(buy)} ${JSON.stringify(skin)}`);
  // Liga bloqueada antes de nivel 10
  await page.evaluate(() => FARO.toMenu());
  await page.evaluate(() => { FARO.abandonGame(); Profile.data.xp = 100; FARO.lobby.view = 'play'; FARO.lobby.render(); });
  await page.tap('[data-m="modes"]');
  const league = await page.evaluate(() => ({ cards: document.querySelectorAll('.mode-card').length, locked: document.querySelector('[data-v="league"]').disabled }));
  check('B16-modos', league.cards === 6 && league.locked, JSON.stringify(league));
  await page.evaluate(() => FARO.lobby.closeModal());
  // Personalizado: 2-6 jugadores, mitad de XP
  await page.tap('[data-act="sub"][data-sub="custom"]');
  await page.tap('[data-k="players"][data-v="6"]');
  await page.tap('[data-k="teams"][data-v="true"]');
  await page.tap('[data-k="coins"][data-v="6000"]');
  await page.tap('[data-k="mapKind"][data-v="reef"]');
  await page.tap('#btn-play-custom');
  await page.waitForTimeout(300);
  const cust = await page.evaluate(() => { const g = FARO.game; return { n: g.players.length, teams: g.players.map((p) => p.team).join(''), coins: g.players[0].coins, map: g.opts.mapKind, name: g.mode.name }; });
  const xp0 = await page.evaluate(() => Profile.data.xp);
  await page.evaluate(() => { $('enddialog').innerHTML = ''; const g = FARO.game; for (const p of g.players) if (p.team !== 0) g.eliminate(p.id, 0); });
  await waitEnd(page);
  const custXp = await page.evaluate((x) => ({ gained: Profile.data.xp - x, lines: FARO.game.reward.lines }), xp0);
  check('B17-personalizado', cust.n === 6 && cust.teams === '000111' && cust.coins >= 6000 && cust.coins < 6050 && cust.map === 'reef' && custXp.lines.includes('Personalizado: mitad de XP') && custXp.lines.some((l) => /Jugar: \+20 XP/.test(l)), `${JSON.stringify(cust)} ${JSON.stringify(custXp)}`);
  await page.tap('#btn-menu');
  // Tutorial
  await page.tap('[data-act="sub"][data-sub="tutorial"]');
  await page.tap('#btn-play-tutorial');
  await page.waitForTimeout(300);
  const tut = await page.evaluate(() => ({ steps: [...document.querySelectorAll('#objlist li')].map((l) => l.textContent), mode: FARO.game.mode.tutorial, botHp: FARO.game.players[1].core.maxHp }));
  const before = await page.evaluate(() => ({ cr: Profile.data.crystals }));
  await page.evaluate(() => { $('enddialog').innerHTML = ''; const g = FARO.game; g.eliminate(1, 0); });
  await waitEnd(page);
  const tutEnd = await page.evaluate(() => ({ done: Profile.data.tutorialDone, badge: Profile.data.badges.primerFaro, gold: !!Profile.data.owned.dorado_inf, cr: Profile.data.crystals, txt: $('enddialog').innerText.includes('Primer Faro') }));
  await page.tap('#btn-again');
  await page.waitForTimeout(300);
  await page.evaluate(() => { $('enddialog').innerHTML = ''; FARO.game.eliminate(1, 0); });
  await waitEnd(page);
  const tutAgain = await page.evaluate(() => ({ txt: $('enddialog').innerText.includes('Premio del Tutorial') }));
  check('B18-tutorial', tut.steps.length === 3 && tut.mode && tut.botHp === 3000 && tutEnd.done && tutEnd.badge && tutEnd.gold && tutEnd.cr >= before.cr + 150 && tutEnd.txt && !tutAgain.txt,
    `pasos=${JSON.stringify(tut.steps)} premio=${JSON.stringify(tutEnd)} segunda vez sin premio=${!tutAgain.txt}`);
  check('errores-normal', page.errs.length === 0, JSON.stringify(page.errs));
  await ctx.close();
  // 2) Dueño: modo creador
  ({ ctx, page } = await open(browser, { owner: true }));
  const cr = await page.evaluate(() => ({ btn: !!document.querySelector('[data-m="creator"]'), badge: !$('creator-badge').hidden, crystals: $('crystals').textContent }));
  await page.tap('#btn-play');
  await page.waitForTimeout(300);
  const cg = await page.evaluate(() => { const g = FARO.game; const me = g.players[0]; me.coins = 5; g.update(0.1); const c = g.cells.find((x) => !g.placeInvalid(0, 'factory', x.i)); return { creator: g.creator, coins: me.coins, energy: me.energy, place: c ? g.place(0, 'factory', c.i) : 'sin casilla', coinsAfter: (g.update(0.1), me.coins) }; });
  check('B21-creador', cr.btn && cr.badge && cr.crystals === '∞' && cg.creator && cg.coins >= 999999 && cg.energy >= 99999, `${JSON.stringify(cr)} ${JSON.stringify(cg)}`);
  check('errores-dueño', page.errs.length === 0, JSON.stringify(page.errs));
  await ctx.close();
  await browser.close();
  require('fs').writeFileSync(SP + '/results-v05-meta.json', JSON.stringify(results, null, 1));
  console.log(results.filter((r) => r.ok).length + '/' + results.length + ' aprobadas');
})();
