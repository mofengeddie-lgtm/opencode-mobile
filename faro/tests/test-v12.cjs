// Pruebas de la v1.2 en Chromium (iPad horizontal, toques simulados): I01-I05, I07-I09.
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);

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
  await page.evaluate(() => { localStorage.removeItem('faro-profile-v1'); localStorage.setItem('faro-season', 'auto'); Profile.load(); FARO.lobby.render(); });
  const cdp = await page.context().newCDPSession(page);
  const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);

  // ---------- I01 rueda de selección ----------
  if (want('I01')) {
    await page.evaluate(() => {
      FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 2121 };
      FARO.startGame();
      const g = FARO.game;
      g.bots = [];
      const core = g.cells[g.players[0].core.cell];
      const land = g.freeCellsNear(core.i, 'land', 0, 12);
      for (let i = 0; i < 4; i++) g.addUnit(0, 'rifle', land[i]);
      g.addUnit(0, 'tank', land[5]);
      g.addUnit(0, 'heli', land[6]);
      g.addUnit(0, 'apache', land[7]);
      const water = g.cells.filter((c) => TERRAIN[c.t].water && !c.bld).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
      g.addUnit(0, 'destroyer', water[0].i);
      g.addUnit(0, 'frigate', water[3].i);
      g.addUnit(0, 'speedboat', water[6].i);
      g.addUnit(0, 'builder', land[8]);
      FARO.focusCore();
      FARO.setSelection([]);
    });
    await step(2);
    await page.waitForTimeout(300);
    const want0 = await page.evaluate(() => {
      const g = FARO.game;
      const n = (f) => g.units.filter((u) => u.owner === 0 && u.alive && !u.inside && f(u)).length;
      return { army: n((u) => u.def.weapon && u.mover === 'land'), sea: n((u) => u.def.weapon && u.mover === 'sea'), air: n((u) => u.def.weapon && u.mover === 'air'),
        all: n((u) => u.def.weapon), builders: n((u) => u.def.builds === 'land') };
    });
    const selInfo = () => page.evaluate(() => {
      const s = FARO.selection.filter((e) => e.kind === 'unit');
      return { n: s.length, movers: [...new Set(s.map((u) => u.mover))].join('+'), builders: s.filter((u) => u.def.builds).length, types: s.map((u) => u.type).join(',') };
    });
    // 1) Mantener pulsado con el dedo (toque real de CDP) y soltar sobre «Tierra».
    const hx = 640; const hy = 330;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] });
    await page.waitForTimeout(250);
    const early = await page.evaluate(() => !!document.getElementById('wheel'));
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => {
      const w = document.getElementById('wheel');
      if (!w) return null;
      return [...w.querySelectorAll('.wheel-opt')].map((b) => { const r = b.getBoundingClientRect(); return { k: b.dataset.wk, label: b.querySelector('b').textContent, n: Number(b.querySelector('small').textContent), off: b.disabled, x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    });
    await page.screenshot({ path: SP + '/shots/v12-i01-wheel.png' });
    let held = { n: 0 };
    if (opened) {
      const t = opened.find((o) => o.k === 'army');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (hx + t.x) / 2, y: (hy + t.y) / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: t.x, y: t.y }] });
      await page.waitForTimeout(80);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(200);
      held = await selInfo();
    } else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const closedAfter = await page.evaluate(() => !document.getElementById('wheel'));
    // Un toque corto no abre la rueda.
    await page.evaluate(() => FARO.setSelection([]));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] });
    await page.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const shortTap = await page.evaluate(() => !!document.getElementById('wheel'));
    // Arrastrar (mover la cámara) tampoco la abre.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: hx, y: hy }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: hx + i * 12, y: hy }] }); await page.waitForTimeout(40); }
    await page.waitForTimeout(500);
    const dragWheel = await page.evaluate(() => !!document.getElementById('wheel'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // 2) Con la tecla Tab y tocando cada opción.
    const picks = {};
    for (const k of ['sea', 'air', 'all', 'builders', 'g1']) {
      if (k === 'g1') await page.evaluate(() => { const g = FARO.game; FARO.setSelection(g.units.filter((u) => u.owner === 0 && u.type === 'rifle').slice(0, 2)); FARO.saveGroup(1); FARO.setSelection([]); });
      await page.keyboard.press('Tab');
      await page.waitForTimeout(150);
      const ok = await page.evaluate(() => !!document.getElementById('wheel'));
      if (!ok) { picks[k] = { open: false }; continue; }
      await page.click(`#wheel [data-wk="${k}"]`);
      await page.waitForTimeout(150);
      picks[k] = { open: true, ...(await selInfo()) };
    }
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    const escClosed = await page.evaluate(() => !document.getElementById('wheel'));
    const counts = opened ? Object.fromEntries(opened.map((o) => [o.k, o.n])) : {};
    const ok = opened && opened.length === 8 && opened.every((o) => o.inView) && !early && !shortTap && !dragWheel && closedAfter && escClosed &&
      counts.army === want0.army && counts.sea === want0.sea && counts.air === want0.air && counts.all === want0.all && counts.builders === want0.builders &&
      held.n === want0.army && held.movers === 'land' && picks.sea.n === want0.sea && picks.sea.movers === 'sea' && picks.air.n === want0.air && picks.air.movers === 'air' &&
      picks.all.n === want0.all && picks.builders.n === want0.builders && picks.builders.builders === want0.builders && picks.g1.n === 2 && counts.g1 === 0 && opened.find((o) => o.k === 'g1').off;
    add('I01', ok, `mantener pulsado el mapa con el dedo: a los 0,25 s todavía no (${!early}), a los 0,75 s se abre con ${opened ? opened.length : 0} opciones dentro de la pantalla (${opened ? opened.map((o) => `${o.label} ${o.n}`).join(', ') : '—'}); ` +
      `al deslizar el dedo a «Tierra» y soltar quedan elegidas ${held.n} tropas (${held.movers}); un toque corto no la abre (${!shortTap}) y arrastrar el mapa tampoco (${!dragWheel}); ` +
      `con Tab: Mar → ${picks.sea.n} (${picks.sea.movers}), Aire → ${picks.air.n} (${picks.air.movers}), Todo → ${picks.all.n}, Constructores → ${picks.builders.n}, Grupo 1 (guardado con 2) → ${picks.g1.n}; los grupos vacíos salen apagados; Esc la cierra (${escClosed})`);
  }

  // ---------- I02 mensajes ----------
  if (want('I02')) {
    await page.evaluate(() => {
      FARO.opts = { mode: 'duos', mapKind: 'continent', difficulty: 'normal', seed: 2222 };
      FARO.startGame();
    });
    await step(5);
    const setup = await page.evaluate(() => {
      const g = FARO.game;
      g.say(1, 'Voy a proteger el lado norte.', { force: true, toMe: true });
      g.say(3, '¡Nadie me gana en este mapa!', { force: true, public: true });
      g.say(4, 'Plan secreto de mi equipo.', { force: true });
      return { teams: g.players.map((p) => p.team).join(''), ally: g.players[1].name, foe: g.players[3].name, foe2: g.players[4].name };
    });
    // Se abre tocando la lista de mensajes de la esquina (o desde el marcador).
    await page.evaluate(() => { const f = document.getElementById('feed'); f.hidden = false; });
    await page.click('#players');
    await page.waitForTimeout(200);
    await page.click('#btn-open-chat');
    await page.waitForTimeout(250);
    const read = () => page.evaluate(() => ({ open: !document.getElementById('chatpop').hidden, log: (document.getElementById('chatlog') || {}).innerText || '', tabs: [...document.querySelectorAll('[data-chattab]')].map((b) => b.textContent + ':' + b.getAttribute('aria-selected')).join(' '), quick: [...document.querySelectorAll('[data-qmsg]')].map((b) => b.textContent) }));
    const all0 = await read();
    await page.click('[data-chattab="ally"]');
    await page.waitForTimeout(150);
    const ally0 = await read();
    await page.click('[data-qmsg="¡Gracias!"]');
    await page.waitForTimeout(200);
    const ally1 = await read();
    await page.click('[data-qmsg="¡Cuidado!"]');
    await page.waitForTimeout(200);
    const ally2 = await read();
    await page.screenshot({ path: SP + '/shots/v12-i02-chat.png' });
    await page.click('[data-chattab="all"]');
    await page.waitForTimeout(150);
    const all1 = await read();
    // Sin aliados (Duelo) no hay mensajes rápidos.
    await page.evaluate(() => { FARO.opts = { mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 2223 }; FARO.startGame(); });
    await step(2);
    await page.click('#players');
    await page.waitForTimeout(150);
    await page.click('#btn-open-chat');
    await page.waitForTimeout(200);
    const solo = await read();
    await page.evaluate(() => FARO.ui.togglePop(null));
    const ok = setup.teams === '001122' && all0.open && /Todos:true/.test(all0.tabs) && all0.log.includes('proteger el lado norte') && all0.log.includes('Nadie me gana') && !all0.log.includes('Plan secreto') &&
      /Aliados:true/.test(ally0.tabs) && ally0.log.includes('proteger el lado norte') && !ally0.log.includes('Nadie me gana') &&
      /Tú:\s*¡Gracias!/.test(ally1.log) && /(De nada|Para eso estamos|Cuando quieras)/.test(ally1.log) && /Tú:\s*¡Cuidado!/.test(ally2.log) && /(Pongo defensas|Vigilo mi lado|por avisar)/.test(ally2.log) &&
      all1.log.includes('¡Gracias!') && ally0.quick.length === 3 && solo.quick.length === 0 && /Cuando tengas aliados/.test(solo.log + (await page.evaluate(() => document.getElementById('chatpop').innerText)));
    const replyLine = (ally2.log.split('\n').filter((l) => l.includes(setup.ally)).pop() || '').trim();
    add('I02', ok, `Dúos (equipos ${setup.teams}): «Mensajes» se abre desde el marcador; en «Todos» se ven el aliado y el mensaje público de ${setup.foe}, pero no el mensaje interno del otro equipo; ` +
      `en «Aliados» solo el aliado; mensajes rápidos: ${ally0.quick.join(', ')} (+ ¡Ayuda! y ¡Ataquemos!); al tocar «¡Gracias!» y «¡Cuidado!» salen como «Tú» y ${setup.ally} contesta («${replyLine.replace(/\s+/g, " ").replace(/\d\d:\d\d$/, "").slice(0, 80)}»); en Duelo (sin aliados) no hay botones rápidos y sale la ayuda`);
  }

  // ---------- I03 tabla de la Clasificatoria ----------
  if (want('I03')) {
    await page.evaluate(() => { FARO.toMenu && FARO.toMenu(); });
    await page.waitForTimeout(300);
    const readLadder = () => page.evaluate(() => {
      const li = [...document.querySelectorAll('#ladder li')];
      const rows = li.map((l) => ({ pos: parseInt(l.querySelector('b').textContent, 10), name: l.querySelector('span').textContent.replace(/\s*bot$/, ''), bot: !!l.querySelector('span small'), pts: Number(l.querySelector('strong').textContent), me: l.classList.contains('me') }));
      return { rows, me: rows.find((r) => r.me) };
    });
    await page.evaluate(() => { Profile.data.ranked.points = 0; Profile.save(); FARO.lobby.render(); });
    await page.click('[data-sub="ranks"]');
    await page.waitForTimeout(250);
    const t0 = await readLadder();
    // Me pongo justo debajo de un comandante bot y gano una Clasificatoria (+25).
    const target = t0.rows.filter((r) => r.bot).sort((a, b) => a.pts - b.pts)[6];
    await page.evaluate((p) => { Profile.data.ranked.points = p; Profile.save(); FARO.lobby.render(); }, target.pts - 10);
    await page.waitForTimeout(150);
    const t1 = await readLadder();
    const frag0 = await page.evaluate(() => Profile.data.fragments || 0);
    await page.evaluate(() => { if (Profile.level() < 10) { Profile.data.xp = Math.max(Profile.data.xp, 9000); Profile.save(); FARO.lobby.render(); } }); await page.click('#btn-ranked');
    await page.waitForTimeout(500);
    await page.evaluate(() => { const g = FARO.game; for (const p of g.players) if (p.team !== g.players[0].team) g.kill(p.core, 0); g.checkEnd(); });
    await page.waitForSelector('#end:not([hidden])', { timeout: 15000 });
    await page.click('#btn-menu');
    await page.waitForTimeout(400);
    await page.click('[data-sub="ranks"]');
    await page.waitForTimeout(250);
    const t2 = await readLadder();
    const frag1 = await page.evaluate(() => Profile.data.fragments || 0);
    await page.screenshot({ path: SP + '/shots/v12-i03-ladder.png', fullPage: false });
    const sorted = (rows) => rows.every((r, i) => i === 0 || rows[i - 1].pts >= r.pts) && rows.every((r, i) => r.pos === i + 1);
    const ok = t0.rows.length === 21 && t0.rows.filter((r) => r.bot).length === 20 && sorted(t0.rows) && sorted(t1.rows) && sorted(t2.rows) && t0.me.pos === 21 &&
      t2.me.pts === t1.me.pts + 25 && t2.me.pos < t1.me.pos && new Set(t0.rows.map((r) => r.name)).size === 21;
    add('I03', ok, `21 puestos (20 marcados «bot» + tú), ordenados por puntos y con nombres distintos (primero: ${t0.rows[0].name} con ${t0.rows[0].pts}); con 0 puntos estás en el puesto ${t0.me.pos}.º; ` +
      `con ${t1.me.pts} puntos estás ${t1.me.pos}.º; después de ganar una Clasificatoria de verdad tienes ${t2.me.pts} y subes al ${t2.me.pos}.º; la partida también dio ${frag1 - frag0} fragmentos`);
  }

  // ---------- I04 colecciones nuevas ----------
  if (want('I04')) {
    const modalLeft = await page.evaluate(() => { const m = FARO.lobby.modal; if (m) FARO.lobby.closeModal(); return m || null; });
    if (modalLeft) console.log('ventana abierta al volver al menú:', modalLeft);
    await page.click('[data-view="shop"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => { FARO.lobby.shopTab = 'skins'; FARO.lobby.render(); });
    await page.waitForTimeout(400);
    const shop = await page.evaluate(() => [...document.querySelectorAll('.shopgrid .item')].map((it) => ({ name: it.querySelector('b').textContent, rar: it.querySelector('.rar').textContent, img: it.querySelector('img') && it.querySelector('img').naturalWidth > 0, src: it.querySelector('img') && it.querySelector('img').src.length }))
      .filter((x) => /Frente 1940|Marea/.test(x.name)));
    await page.evaluate(() => { const el = [...document.querySelectorAll('.shopgrid .item')].find((it) => /Frente 1940/.test(it.textContent)); if (el) el.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: SP + '/shots/v12-i04-shop.png' });
    // Los aspectos cambian el aspecto del modelo (miniatura distinta a la normal).
    const thumbs = await page.evaluate(() => {
      const out = {};
      for (const [slot, model] of [['inf', 'rifle'], ['veh', 'tank'], ['sea', 'destroyer'], ['core', 'core']]) {
        const a = Thumbs.get(model, PLAYER_COLORS[0]);
        const f = Thumbs.get(model, PLAYER_COLORS[0], 'frente');
        const m = Thumbs.get(model, PLAYER_COLORS[0], 'marea');
        out[slot] = a !== f && a !== m && f !== m;
      }
      return out;
    });
    // Comprar y equipar uno y verlo en la partida.
    const inGame = await page.evaluate(() => {
      Profile.data.crystals = 99999;
      Profile.data.owned.frente_inf = true;
      Profile.data.owned.marea_core = true;
      Profile.data.equipped.inf = 'frente_inf';
      Profile.data.equipped.core = 'marea_core';
      Profile.save();
      FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 2424 };
      FARO.startGame();
      const g = FARO.game;
      const r = g.addUnit(0, 'rifle', g.freeCellsNear(g.players[0].core.cell, 'land', 0, 3)[0]);
      const foe = g.addUnit(1, 'rifle', g.freeCellsNear(g.players[1].core.cell, 'land', 1, 3)[0]);
      return { mine: FARO.renderer.lookFor(r), core: FARO.renderer.lookFor(g.players[0].core), foe: FARO.renderer.lookFor(foe) };
    });
    await page.evaluate(() => { const g = FARO.game; const c = g.players[0].core; FARO.renderer.cam.tx = c.x; FARO.renderer.cam.tz = c.z; FARO.renderer.cam.dist = 13; FARO.renderer.updateCamera(); });
    await step(3);
    await page.waitForTimeout(500);
    await page.screenshot({ path: SP + '/shots/v12-i04-ingame.png' });
    await page.evaluate(() => { Profile.data.equipped.inf = null; Profile.data.equipped.core = null; delete Profile.data.owned.frente_inf; delete Profile.data.owned.marea_core; Profile.data.crystals = 0; Profile.save(); });
    const ok = shop.length === 8 && shop.every((s) => s.img) && Object.values(thumbs).every(Boolean) && inGame.mine === 'frente' && inGame.core === 'marea' && inGame.foe === null;
    add('I04', ok, `en la tienda hay ${shop.length} aspectos nuevos con su imagen (${shop.map((s) => `${s.name} · ${s.rar}`).join('; ')}); las miniaturas de soldado, tanque, destructor y Núcleo cambian con cada colección (${Object.entries(thumbs).map(([k, v]) => `${k} ${v}`).join(', ')}); ` +
      `equipados en la partida: tus soldados usan «${inGame.mine}», tu Núcleo «${inGame.core}» y los rivales el normal (${inGame.foe === null})`);
  }

  // ---------- I05 planos, fragmentos y Taller ----------
  if (want('I05')) {
    await page.evaluate(() => { FARO.toMenu && FARO.toMenu(); });
    await page.waitForTimeout(300);
    // Muchos cofres (gratis, sin ventana) para ver las proporciones y los repetidos.
    const stats = await page.evaluate(() => {
      const P = Profile.data;
      P.owned = {}; P.plans = {}; P.fragments = 0; P.chests = { opened: 0, pity: 0 };
      const c = { skin: 0, plan: 0, frags: 0, dup: 0, dupFrags: 0, packFrags: 0 };
      // 50 perfiles nuevos que abren 8 cofres cada uno (con el tiempo casi todo es tuyo y los planos pasan a fragmentos).
      for (let i = 0; i < 400; i++) {
        if (i % 8 === 0) { P.owned = {}; P.plans = {}; }
        const before = P.fragments;
        const r = FARO.lobby.openChest('isla', true, true);
        c[r.kind]++;
        if (r.dup) { c.dup++; c.dupFrags += P.fragments - before; }
        if (r.kind === 'frags') c.packFrags += P.fragments - before;
      }
      return { ...c, fragments: P.fragments, plans: Object.keys(P.plans).length, owned: Object.keys(P.owned).length };
    });
    // Un cofre con plano desde la tienda, con la ventana y el botón «Ir al Taller».
    const flow = await page.evaluate(() => {
      const P = Profile.data;
      P.owned = {}; P.plans = {}; P.fragments = 0; P.crystals = 1000; P.chests = { opened: 0, pity: 0 };
      Profile.save();
      FARO.lobby.view = 'shop'; FARO.lobby.shopTab = 'chests'; FARO.lobby.render();
      // Solo dentro de este cofre: rareza común, primer aspecto, «plano» (75 de 100) y primer plano posible.
      const L = FARO.lobby;
      L.openChest = function (...a) {
        const seq = [0.1, 0.0, 0.75, 0.0];
        const orig = Math.random;
        let i = 0;
        Math.random = () => (i < seq.length ? seq[i++] : orig());
        try { return Object.getPrototypeOf(L).openChest.apply(L, a); } finally { Math.random = orig; delete L.openChest; }
      };
      window.__restore = () => { delete L.openChest; };
      return { crystals: P.crystals };
    });
    await page.click('[data-act="chest"][data-v="isla"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__restore());
    const modal = await page.evaluate(() => (document.querySelector('.modal, #modal') || document.body).innerText);
    const planId = await page.evaluate(() => Object.keys(Profile.data.plans)[0]);
    const cr1 = await page.evaluate(() => Profile.data.crystals);
    await page.screenshot({ path: SP + '/shots/v12-i05-plan.png' });
    await page.click('#modal [data-act="shoptab"][data-v="workshop"]');
    await page.waitForTimeout(300);
    const ws0 = await page.evaluate((id) => { const b = document.querySelector(`[data-act="craft"][data-id="${id}"]`); return { btn: !!b, disabled: b && b.disabled, text: b && b.textContent, frags: document.getElementById('frag-count').textContent, err: FARO.lobby.craft(id) }; }, planId);
    const cost = await page.evaluate((id) => FRAG_COST[SKIN_BY_ID[id].rar], planId);
    await page.evaluate((n) => { Profile.data.fragments = n + 7; Profile.save(); FARO.lobby.render(); }, cost);
    await page.waitForTimeout(200);
    await page.screenshot({ path: SP + '/shots/v12-i05-workshop.png' });
    await page.click(`[data-act="craft"][data-id="${planId}"]`);
    await page.waitForTimeout(300);
    const after = await page.evaluate((id) => ({ owned: !!Profile.data.owned[id], plan: !!Profile.data.plans[id], frags: Profile.data.fragments, msg: (document.querySelector('.modal, #modal') || document.body).innerText, saved: JSON.parse(localStorage.getItem('faro-profile-v1')).owned[id] }), planId);
    await page.evaluate(() => FARO.lobby.closeModal());
    const name = await page.evaluate((id) => SKIN_BY_ID[id].name, planId);
    const pct = (k) => Math.round((stats[k] / 400) * 100);
    const ok = stats.plan > 0 && stats.frags > 0 && stats.dup > 0 && stats.dupFrags > 0 && Math.abs(pct('skin') - 70) <= 8 && Math.abs(pct('plan') - 20) <= 7 &&
      flow.crystals === 1000 && cr1 === 650 && /Plano/.test(modal) && /Ir al Taller/.test(modal) && planId && ws0.btn && ws0.disabled && /Te faltan/.test(ws0.err) &&
      after.owned && !after.plan && after.frags === 7 && after.saved && /Fabricaste/.test(after.msg);
    add('I05', ok, `50 perfiles nuevos × 8 cofres: ${pct('skin')} % aspectos, ${pct('plan')} % planos y ${pct('frags')} % fragmentos; ${stats.dup} aspectos repetidos dieron ${stats.dupFrags} fragmentos y los paquetes ${stats.packFrags}; ` +
      `un Cofre de Isla comprado en la tienda (quedan ${cr1} de 1000 cristales) dio el plano «${name}» con el botón «Ir al Taller»; en el Taller el botón «${(ws0.text || '').trim()}» está apagado con ${ws0.frags} fragmentos («${ws0.err}»); ` +
      `con ${cost + 7} fragmentos se fabrica: el aspecto pasa a ser tuyo (guardado: ${after.saved}), el plano se gasta y quedan ${after.frags} fragmentos`);
  }

  // ---------- I07 miniaturas ----------
  if (want('I07')) {
    await page.evaluate(() => { FARO.lobby.view = 'play'; FARO.lobby.sub = 'main'; FARO.lobby.render(); FARO.lobby.openModal('maps'); });
    await page.waitForTimeout(500);
    const modalT = await page.evaluate(() => [...document.querySelectorAll('.mapcard')].map((c) => ({ name: c.querySelector('b').textContent, w: c.querySelector('img').naturalWidth, src: c.querySelector('img').src })));
    await page.screenshot({ path: SP + '/shots/v12-i07-maps.png' });
    await page.click('.mapcard[data-v="mesa"]');
    await page.waitForTimeout(300);
    const picked = await page.evaluate(() => Profile.data.play.mapKind);
    await page.evaluate(() => FARO.lobby.closeModal && FARO.lobby.modal && FARO.lobby.closeModal());
    await page.click('[data-sub="custom"]');
    await page.waitForTimeout(400);
    const cust = await page.evaluate(() => [...document.querySelectorAll('.mapopt')].map((c) => ({ name: c.querySelector('span').textContent, w: c.querySelector('img').naturalWidth, on: c.classList.contains('on'), v: c.dataset.v, src: c.querySelector('img').src })));
    await page.click('.mapopt[data-v="dunes"]');
    await page.waitForTimeout(300);
    const cust2 = await page.evaluate(() => ({ kind: Profile.data.custom.mapKind, on: document.querySelector('.mapopt.on').dataset.v }));
    await page.evaluate(() => { const el = document.querySelector('.mapthumbs'); if (el) el.scrollIntoView({ block: 'center' }); });
    await page.screenshot({ path: SP + '/shots/v12-i07-custom.png' });
    const n = await page.evaluate(() => LOBBY_MAPS.length);
    const ok = modalT.length === n && modalT.every((m) => m.w > 0) && new Set(modalT.map((m) => m.src)).size === n && picked === 'mesa' &&
      cust.length === n && cust.every((m) => m.w > 0) && new Set(cust.map((m) => m.src)).size === n && cust2.kind === 'dunes' && cust2.on === 'dunes';
    add('I07', ok, `«Elige un mapa» muestra ${modalT.length} mapas, cada uno con su miniatura distinta (${modalT.map((m) => m.name).join(', ')}); tocar «Mesetas de Cobre» lo elige (${picked}); ` +
      `en Personalizado hay ${cust.length} miniaturas y tocar «Dunas Rojas» la marca y la guarda (${cust2.kind})`);
  }

  // ---------- I08 tutorial con señales ----------
  if (want('I08')) {
    // Se quita el Constructor inicial para ver también los dos primeros pasos (tocar el Núcleo y entrenar uno).
    await page.evaluate(() => { FARO.opts = { mode: 'tutorial', mapKind: 'continent', difficulty: 'easy', seed: 1414 }; FARO.startGame(); FARO.focusCore();
      const g = FARO.game; for (const u of g.units) if (u.owner === 0 && u.def.builds) g.kill(u, -1); FARO.setSelection([]);
      // Registro: quién empieza un modo de colocación y qué clics llegan (para encontrar toques fantasma).
      window.__pl = [];
      if (!FARO.input.__wrapped) {
        const sp = FARO.input.startPlacement.bind(FARO.input);
        FARO.input.startPlacement = (o) => { window.__pl.push(`${o.kind}:${o.btype || ''} t=${FARO.game.time.toFixed(1)} ${new Error().stack.split('\n').slice(2, 5).map((l) => l.trim()).join(' < ')}`); return sp(o); };
        for (const ty of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup']) document.addEventListener(ty, (e) => { if (window.__pl) window.__pl.push(`${ty} ${e.pointerType || ''} ${e.isTrusted ? 'real' : 'script'} (${Math.round(e.clientX)},${Math.round(e.clientY)}) t=${Math.round(performance.now())} ev=${Math.round(e.timeStamp)} en ${e.target.id || e.target.className || e.target.tagName}`); }, true);
        window.__pl.push('instalado t=' + Math.round(performance.now()));
        FARO.input.__wrapped = true;
      } });
    await step(2);
    await page.waitForTimeout(400);
    const seq = [];
    const misses = [];
    let last = '';
    let final = null;
    for (let i = 0; i < 120; i++) {
      const st = await page.evaluate(() => {
        const s = FARO.ui.coachStep(FARO.game);
        FARO.ui.updateCoach();
        if (!s) return null;
        const ring = document.querySelector('#coach .coach-ring');
        const r = ring && !ring.hidden ? ring.getBoundingClientRect() : null;
        const tip = document.querySelector('#coach .coach-tip');
        return { text: FARO.ui.coachText, sel: s.sel || null, world: s.world || null, ring: r && { x: r.x + r.width / 2, y: r.y + r.height / 2, inView: r.left >= -2 && r.top >= -2 && r.right <= innerWidth + 2 && r.bottom <= innerHeight + 2 }, tip: tip.textContent, tipShown: !document.getElementById('coach').hidden };
      });
      if (!st) break;
      if (process.env.DEBUG) console.log(i, st.text, JSON.stringify(st.ring), await page.evaluate(() => FARO.selection.map((e) => e.type).join(',')),
        st.ring ? await page.evaluate((r) => { const e = document.elementFromPoint(r.x, r.y); return (e && (e.id || e.tagName + '.' + e.className)) + ' scroll ' + scrollY + ' place ' + (FARO.input.placement ? FARO.input.placement.kind + ':' + FARO.input.placement.btype : '-'); }, st.ring) : '');
      const key = st.text.replace(/\(tienes \d de 5\)/, '');
      if (key !== last) {
        seq.push({ text: st.text, ring: !!st.ring, inView: st.ring ? st.ring.inView : false, tip: st.tip === st.text && st.tipShown });
        last = key;
        if (seq.length <= 9) await page.screenshot({ path: SP + `/shots/v12-i08-step${seq.length}.png` });
      }
      if (st.sel) {
        // Toque real en el centro del botón señalado, comprobando antes que nada lo tapa.
        const hit = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2; const y = r.top + r.height / 2;
          const top = document.elementFromPoint(x, y);
          return { x, y, free: !!top && (top === el || el.contains(top)), top: top && (top.id || top.className) };
        }, st.sel);
        if (!hit || !hit.free) { misses.push(`${st.text} (tapado por ${hit ? hit.top : 'nada'})`); }
        if (process.env.DEBUG) console.log('clic en botón', st.sel, Math.round(hit.x), Math.round(hit.y), await page.evaluate(() => Math.round(performance.now())));
        if (hit) await page.mouse.click(hit.x, hit.y);
        await page.waitForTimeout(150);
        await step(st.sel.includes('train') ? 15 : 2);
      } else if (st.world) {
        if (!st.ring || !st.ring.inView) {
          // Fuera de la pantalla: llevo la cámara como lo haría el jugador.
          misses.push('fuera de pantalla: ' + st.text);
          await page.evaluate((w) => { FARO.renderer.cam.tx = w.x; FARO.renderer.cam.tz = w.z; FARO.renderer.updateCamera(); }, st.world);
          await page.waitForTimeout(200);
          continue;
        }
        if (/espera/.test(st.text)) { await step(30); continue; }
        // Si la cámara todavía se mueve, el aro también: se espera a que quede quieto (como haría una persona).
        const again = await page.evaluate(() => { FARO.ui.updateCoach(); const r = document.querySelector('#coach .coach-ring').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        if (Math.hypot(again.x - st.ring.x, again.y - st.ring.y) > 6) { await page.waitForTimeout(300); continue; }
        if (process.env.DEBUG) console.log('clic en aro', Math.round(st.ring.x), Math.round(st.ring.y), await page.evaluate(() => Math.round(performance.now())));
        await page.mouse.click(st.ring.x, st.ring.y);
        await page.waitForTimeout(200);
        if (/minimapa/.test(st.text)) { await page.waitForTimeout(2500); continue; }
        if (/Núcleo enemigo/.test(st.text)) {
          await step(2);
          final = await page.evaluate(() => {
            const g = FARO.game;
            const foe = g.players.find((q) => q.id !== 0 && q.alive && q.core && q.core.alive);
            const army = g.units.filter((u) => u.owner === 0 && u.alive && u.def.weapon);
            return { n: army.length, toFoe: army.filter((u) => u.state === 'attack' && u.target === foe.core).length };
          });
          break;
        }
        await step(3);
      } else { await step(10); }
    }
    await page.screenshot({ path: SP + '/shots/v12-i08-final.png' });
    const plLog = await page.evaluate(() => window.__pl.slice(0, 14));
    console.log('registro de colocación:', JSON.stringify(plLog, null, 1));
    const texts = seq.map((s) => s.text);
    const need = ['minimapa', 'Toca tu Núcleo', 'Entrena un Constructor', 'Abre la pestaña «Energía»', 'Elige «Solar»', 'Toca una casilla dorada', 'Toca «Construir»', 'Terminar', 'Elige «Cuartel»', 'espera a que termine', 'Toca tu Cuartel', 'Entrena Artilleros', 'Ejército', 'Núcleo enemigo'];
    const covered = need.filter((n) => texts.some((t) => t.includes(n)));
    const ok = covered.length === need.length && seq.every((s) => s.tip) && seq.filter((s) => !/No quedan/.test(s.text)).every((s) => s.ring) && final && final.toFoe > 0 && misses.filter((m) => !m.startsWith('fuera')).length === 0 && seq.every((s) => s.inView || !s.ring);
    add('I08', ok, `siguiendo solo el aro y el texto, con toques: ${seq.length} pasos (${texts.map((t) => `«${t.replace(/\s*\(tienes \d de 5\)/, '')}»`).join(' → ')}); ` +
      `aro visible en ${seq.filter((s) => s.ring).length} de ${seq.length}; ${misses.length ? `aviso: ${misses.join('; ')}` : 'cada señal estaba en la pantalla'}; al final ${final ? `${final.toFoe} de ${final.n} tropas van al Núcleo enemigo` : 'no se llegó al ataque'}`);
  }

  // ---------- I09 temporadas ----------
  // v1.5: la decoración por fecha se quitó a pedido; esta prueba la reemplaza L01.
  const noSeasons = await page.evaluate(() => typeof FARO.seasonPref !== 'function');
  if (want('I09') && noSeasons) add('I09', false, 'ya no existe: la v1.5 quitó las temporadas por fecha (la reemplaza L01)');
  if (want('I09') && !noSeasons) {
    await page.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'easy', seed: 2929 }; FARO.startGame(); FARO.focusCore(); });
    await step(2);
    const auto0 = await page.evaluate(() => ({ pref: FARO.seasonPref(), season: FARO.renderer.season, today: seasonForDate(new Date()) }));
    await page.evaluate(() => FARO.togglePause(true));
    await page.waitForTimeout(200);
    const note = await page.evaluate(() => document.getElementById('season-note').textContent);
    const res = {};
    for (const s of ['pumpkin', 'winter', 'none', 'auto']) {
      await page.click(`[data-season="${s}"]`);
      await page.waitForTimeout(250);
      res[s] = await page.evaluate(() => ({ season: FARO.renderer.season, pumpkins: FARO.renderer.pumpkins || 0, snow: !!FARO.renderer.snow, pressed: document.querySelector('[data-season].gold').dataset.season, saved: localStorage.getItem('faro-season') }));
      if (s === 'pumpkin' || s === 'winter') {
        await page.evaluate(() => FARO.togglePause(false));
        await page.evaluate(() => { const r = FARO.renderer; r.cam.dist = 26; r.updateCamera(); });
        await step(2);
        await page.waitForTimeout(500);
        await page.screenshot({ path: SP + `/shots/v12-i09-${s}.png` });
        await page.evaluate(() => FARO.togglePause(true));
        await page.waitForTimeout(150);
      }
    }
    // Se recuerda al empezar otra partida.
    await page.click('[data-season="winter"]');
    await page.evaluate(() => { FARO.togglePause(false); FARO.opts = { mode: 'conquest', mapKind: 'mesa', difficulty: 'easy', seed: 2930 }; FARO.startGame(); });
    await page.waitForTimeout(300);
    const kept = await page.evaluate(() => FARO.renderer.season);
    await page.evaluate(() => { localStorage.setItem('faro-season', 'auto'); FARO.setSeason('auto'); });
    const ok = auto0.pref === 'auto' && auto0.today === null && auto0.season === null && /ninguna en esta fecha/.test(note) &&
      res.pumpkin.season === 'pumpkin' && res.pumpkin.pumpkins > 0 && res.pumpkin.pressed === 'pumpkin' && res.winter.season === 'winter' && res.winter.snow &&
      res.none.season === null && !res.none.snow && res.none.pumpkins === 0 && res.auto.season === null && res.auto.saved === 'auto' && kept === 'winter';
    add('I09', ok, `hoy (${new Date().getDate()} nov) la automática no pone ninguna («${note.slice(0, 60)}…»); en la pausa: Calabazas pone ${res.pumpkin.pumpkins} calabazas, Invierno pone nieve (${res.winter.snow}), ` +
      `Ninguna quita todo (${res.none.season === null && !res.none.snow}), Automática vuelve a ninguna; la elección se guarda y sigue en la partida siguiente (${kept})`);
  }

  add('errores', errs.length === 0, errs.length ? errs.slice(0, 5).join(' | ') : 'sin errores en la consola');
  fs.writeFileSync(SP + '/results-v12' + (only ? '-' + only.join('') : '') + '.json', JSON.stringify(results, null, 1));
  console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
