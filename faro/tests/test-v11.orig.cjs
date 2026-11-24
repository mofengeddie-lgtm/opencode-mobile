// Pruebas de la v1.1 en Chromium (iPad horizontal): H01, H03, H05, H06, H07, H08 en pantalla.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('faro-profile-v1'); Profile.load(); FARO.lobby.render(); });

  // ---------- H05 música del vestíbulo ----------
  await page.click('[data-sub="ranks"]');
  await page.waitForTimeout(1500);
  const lob = await page.evaluate(() => ({ cur: FARO.music.current, notes: FARO.music.notes, state: FARO.sound.ctx && FARO.sound.ctx.state, level: FARO.music.level }));

  // ---------- H03 Clasificatoria ----------
  const rank0 = await page.evaluate(() => document.getElementById('rank-name').textContent);
  await page.screenshot({ path: SP + '/shots/v11-h03-ranks.png' });
  await page.click('#btn-ranked');
  await page.waitForTimeout(600);
  const rk = await page.evaluate(() => ({ mode: FARO.game.mode.name, ranked: !!FARO.game.mode.ranked, diff: FARO.game.opts.difficulty, teams: FARO.game.players.map((p) => p.team).join('') }));
  // H05: en la partida suena la melodía de batalla; con combate se suman los tambores.
  await page.waitForTimeout(1200);
  const bat0 = await page.evaluate(() => ({ cur: FARO.music.current, drums: FARO.music.drums || 0 }));
  await page.evaluate(() => new Promise((res) => {
    const g = FARO.game; let n = 0;
    const iv = setInterval(() => { g.players[0].underAttackAt = g.time; FARO.musicFight = 1; if (++n > 40) { clearInterval(iv); res(); } }, 100);
  }));
  const bat1 = await page.evaluate(() => ({ drums: FARO.music.drums || 0, intensity: FARO.music.intensity }));
  // Volumen en la pausa.
  await page.evaluate(() => FARO.togglePause(true));
  await page.waitForTimeout(200);
  await page.click('[data-music="0"]');
  const off = await page.evaluate(() => ({ playing: FARO.music.playing, level: FARO.music.level, pressed: document.querySelector('[data-music="0"]').classList.contains('gold') }));
  await page.click('[data-music="0.6"]');
  await page.waitForTimeout(300);
  const on = await page.evaluate(() => ({ playing: FARO.music.playing, level: FARO.music.level }));
  await page.evaluate(() => FARO.togglePause(false));
  add('H05web', lob.cur === 'lobby' && lob.notes > 0 && bat0.cur === 'battle' && bat1.drums > bat0.drums && bat1.intensity > 0.25 && !off.playing && off.pressed && on.playing,
    `vestíbulo: melodía «${lob.cur}» (${lob.notes} notas, audio ${lob.state}); partida: «${bat0.cur}»; con combate la intensidad sube a ${bat1.intensity.toFixed(2)} y suenan ${bat1.drums - bat0.drums} golpes de bombo; en la pausa «Apagada» la detiene (${!off.playing}) y «Media» la vuelve a encender (${on.playing})`);

  // Victoria en Clasificatoria: +25.
  await page.evaluate(() => { const g = FARO.game; for (const p of g.players) if (p.team !== g.players[0].team) g.kill(p.core, 0); g.checkEnd(); });
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  const endWin = await page.evaluate(() => document.getElementById('enddialog').innerText);
  await page.click('#btn-menu');
  await page.waitForTimeout(400);
  await page.click('[data-sub="ranks"]');
  await page.waitForTimeout(300);
  const after1 = await page.evaluate(() => ({ name: document.getElementById('rank-name').textContent, pts: Profile.data.ranked.points, hist: Profile.data.ranked.history.length, saved: JSON.parse(localStorage.getItem('faro-profile-v1')).ranked.points }));
  // Subir de rango y una derrota (−15): de 310 (Plata I) a 295 (Bronce III).
  await page.evaluate(() => { Profile.data.ranked.points = 310; Profile.save(); FARO.lobby.render(); });
  await page.click('#btn-ranked');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; g.kill(g.players[0].core, 3); g.checkEnd(); });
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  const endLoss = await page.evaluate(() => document.getElementById('enddialog').innerText);
  await page.click('#btn-menu');
  await page.waitForTimeout(300);
  await page.click('[data-sub="ranks"]');
  await page.waitForTimeout(300);
  const after2 = await page.evaluate(() => ({ name: document.getElementById('rank-name').textContent, pts: Profile.data.ranked.points, ranks: document.querySelectorAll('.ranklist li').length }));
  // Desde Oro, Difícil.
  const hardAt = await page.evaluate(() => [rankedDifficulty(590), rankedDifficulty(600)]);
  add('H03web', rank0 === 'Bronce I' && rk.ranked && rk.teams === '000111' && /\+25/.test(endWin) && after1.pts === 25 && after1.saved === 25 && /−15|-15/.test(endLoss) && after2.pts === 295 && after2.name === 'Bronce III' && after2.ranks === 10 && hardAt.join() === 'normal,hard',
    `al empezar: ${rank0}; «Jugar Clasificatoria» abre «${rk.mode}» (equipos ${rk.teams}, rivales en ${rk.diff}); al ganar: «${(endWin.match(/Clasificatoria[^\n·]*·[^\n]*/) || [''])[0]}» → ${after1.pts} puntos (${after1.name}, guardado: ${after1.saved}); ` +
    `con 310 (Plata I) y una derrota: «${(endLoss.match(/Clasificatoria[^\n·]*·[^\n]*/) || [''])[0]}» → ${after2.pts} (${after2.name}); ${after2.ranks} rangos en el panel; dificultad con 590 y 600 puntos: ${hardAt.join(' / ')}`);

  // ---------- H01 alianzas en pantalla ----------
  await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 1111 }; FARO.startGame(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 300; i++) g.update(0.1); });
  await page.click('#players');
  await page.waitForTimeout(300);
  const builderPid = await page.evaluate(() => FARO.game.players.find((p) => p.persona === 'builder').id);
  await page.click(`[data-ally="ask"][data-pid="${builderPid}"]`);
  await page.waitForTimeout(700);
  const allied = await page.evaluate((pid) => ({ ally: FARO.game.players[pid].team === FARO.game.players[0].team, btn: !!document.querySelector(`[data-ally="break"][data-pid="${pid}"]`), row: document.querySelector(`#score tr[data-pid="${pid}"]`).innerText, chat: (document.getElementById('feed') || document.body).innerText.includes('Trato hecho') || FARO.game.chat.some((m) => m.ally && /Trato hecho/.test(m.text)) }), builderPid);
  await page.screenshot({ path: SP + '/shots/v11-h01-ally.png' });
  await page.click(`[data-ally="break"][data-pid="${builderPid}"]`);
  await page.waitForTimeout(200);
  const armed = await page.evaluate((pid) => FARO.game.players[pid].team === FARO.game.players[0].team, builderPid);
  await page.click(`[data-ally="break"][data-pid="${builderPid}"]`);
  await page.waitForTimeout(400);
  const broke = await page.evaluate((pid) => ({ enemy: FARO.game.isEnemy(0, pid), btn: !!document.querySelector(`[data-ally="ask"][data-pid="${pid}"]`) }), builderPid);
  add('H01web', allied.ally && allied.btn && /aliado/.test(allied.row) && allied.chat && armed && broke.enemy && broke.btn,
    `«Aliarse» con ${allied.row.split('\n')[0]}: aliados (${allied.ally}), la fila dice «${allied.row.replace(/\s+/g, ' ').slice(0, 60)}», mensaje en el chat: ${allied.chat}; «Romper» pide confirmación (sigue aliado tras el primer toque: ${armed}) y al segundo toque vuelven a ser rivales (${broke.enemy})`);

  // ---------- H06 órdenes en Liga ----------
  await page.evaluate(() => { FARO.ui.togglePop(null); FARO.opts = { mode: 'league', mapKind: 'continent', difficulty: 'normal', seed: 31 }; FARO.startGame(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 2400; i++) g.update(0.1); });
  await page.click('#players');
  await page.waitForTimeout(300);
  const hasOrders = await page.evaluate(() => !!document.getElementById('btn-ally-help') && !!document.getElementById('btn-ally-attack'));
  await page.click('#btn-ally-help');
  await page.waitForTimeout(300);
  const helpToast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.innerText).find((t) => /aliados/.test(t)) || '');
  await page.click('#btn-ally-attack');
  await page.waitForTimeout(200);
  const tgt = await page.evaluate(() => {
    const g = FARO.game; const r = FARO.renderer;
    const foe = g.players.find((p) => p.team !== g.players[0].team && p.alive);
    const c = g.cells[foe.core.cell];
    r.cam.tx = c.x; r.cam.tz = c.z; r.cam.dist = 14; r.updateCamera();
    const s = r.project(c.x, c.h, c.z);
    return { x: s.x, y: s.y, name: foe.name, placing: FARO.input.placement && FARO.input.placement.kind };
  });
  await page.touchscreen.tap(tgt.x, tgt.y);
  await page.waitForTimeout(400);
  const attToast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map((t) => t.innerText).find((t) => /atacan a/.test(t)) || '');
  add('H06web', hasOrders && /mandan|no tienen/.test(helpToast) && tgt.placing === 'allyattack' && /atacan a/.test(attToast),
    `en el marcador de la Liga: «¡Ayuda!» y «¡Ataquemos!» (${hasOrders}); «¡Ayuda!»: «${helpToast}»; «¡Ataquemos!» y tocar el Núcleo de ${tgt.name}: «${attToast}»`);

  // ---------- H07 espectador y H08 gráficas ----------
  await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 1212 }; FARO.startGame(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 1500; i++) g.update(0.1); g.kill(g.players[0].core, 1); g.checkEnd(); });
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  const end1 = await page.evaluate(() => ({ spec: !!document.getElementById('btn-spectate'), charts: document.querySelectorAll('#enddialog .histchart').length, lines: document.querySelectorAll('#enddialog .histchart polyline').length, legend: document.querySelectorAll('#enddialog .histlegend span').length, table: !!document.querySelector('#enddialog .histtable table') }));
  // Pasar el dedo por la gráfica muestra los valores del momento.
  const box = await page.evaluate(() => { const r = document.querySelector('#enddialog .histchart svg').getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.5 }; });
  await page.mouse.move(box.x, box.y);
  await page.waitForTimeout(200);
  const tip = await page.evaluate(() => { const t = document.querySelector('#enddialog .histtip'); return t && !t.hidden ? t.innerText.replace(/\n/g, ' ') : ''; });
  await page.screenshot({ path: SP + '/shots/v11-h08-charts.png' });
  await page.click('#btn-spectate');
  await page.waitForTimeout(400);
  const spec = await page.evaluate(() => ({ endHidden: document.getElementById('end').hidden, bar: !document.getElementById('specbar').hidden, body: document.body.classList.contains('spectating'), over: FARO.game.over, t: FARO.game.time }));
  await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 300; i++) g.update(0.1); });
  const t2 = await page.evaluate(() => FARO.game.time);
  await page.screenshot({ path: SP + '/shots/v11-h07-spectate.png' });
  await page.evaluate(() => { const g = FARO.game; const alive = g.players.filter((p) => p.alive); for (const p of alive.slice(1)) g.kill(p.core, alive[0].id); g.checkEnd(); });
  await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
  const end2 = await page.evaluate(() => ({ text: document.querySelector('#enddialog .endhero').innerText.replace(/\n/g, ' '), spec: !!document.getElementById('btn-spectate'), bar: !document.getElementById('specbar').hidden }));
  add('H07web', end1.spec && spec.endHidden && spec.bar && spec.body && !spec.over && t2 > spec.t + 25 && /ganó/.test(end2.text) && !end2.spec && !end2.bar,
    `derrota con «Seguir mirando» (${end1.spec}); al tocarlo: barra «Modo espectador» (${spec.bar}) y la partida sigue (${Math.round(t2 - spec.t)} s más); al quedar un imperio: «${end2.text}»`);
  add('H08web', end1.charts === 2 && end1.lines === 12 && end1.legend === 6 && end1.table && /\d/.test(tip),
    `${end1.charts} gráficas (monedas por minuto y tropas), ${end1.lines} líneas (6 imperios × 2), leyenda con ${end1.legend} nombres, tabla (${end1.table}); al pasar el dedo: «${tip.slice(0, 120)}»`);

  fs.writeFileSync(SP + '/results-v11.json', JSON.stringify(results, null, 1));
  console.log('errores', errs);
  await browser.close();
})();
