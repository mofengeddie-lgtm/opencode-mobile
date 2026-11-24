// Pruebas de la v1.9 (versión para Poki) en Chromium: P01 (sin pedidos externos), P02 (eventos del SDK en orden),
// P03 (anuncios entre partidas), P04 (anuncio con premio), P05 (SDK real de Poki), P06 (la página no se mueve),
// P07 (incógnito), P11 (elegir idioma), P14 (versión limpia) y P16 (la versión web sigue bien, sin CDN).
// Uso: node faro/tests/test-v19.cjs   ·   ONLY=P02,P04 para correr solo algunas.
// Antes: node faro/build.mjs && node faro/build.mjs --poki. El SDK de prueba (fakepoki.js) anota cada llamada.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const FARO = path.resolve(__dirname, '..');
const WEB = path.join(FARO, 'faro.html');
const POKI = path.join(FARO, 'poki', 'index.html');
const FAKE = fs.readFileSync(path.join(__dirname, 'fakepoki.js'), 'utf8');
const OUT = process.env.OUT || path.join(__dirname, 'results-v19.json');
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];

// Abre el juego sin red (solo el archivo). opts: lang (navegador), fake (SDK de prueba), fakeOpts, allow (hosts permitidos), init.
async function open(browser, file, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1031, height: opts.h || 580 }, hasTouch: !!opts.touch });
  const p = await ctx.newPage();
  p.setDefaultTimeout(240000);
  p.errs = [];
  p.logs = [];
  p.ext = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_FAILED|ERR_BLOCKED/.test(t)) p.errs.push(t.slice(0, 200));
    if (['log', 'info', 'debug'].includes(m.type())) p.logs.push(t.slice(0, 160));
  });
  const lang = opts.lang || 'es-ES';
  await p.addInitScript((l) => {
    Object.defineProperty(navigator, 'language', { get: () => l });
    Object.defineProperty(navigator, 'languages', { get: () => [l] });
  }, lang);
  if (opts.fakeOpts) await p.addInitScript((o) => Object.assign(window, o), opts.fakeOpts);
  if (opts.fake) await p.addInitScript({ content: FAKE });
  if (opts.init) await p.addInitScript(opts.init);
  await p.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    if (opts.allow && opts.allow.some((h) => u.includes(h))) return r.continue();
    p.ext.push(u);
    return r.abort();
  });
  await p.goto('file://' + file, { timeout: 240000 });
  await p.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 240000, polling: 200 });
  return p;
}
const close = (p) => p.context().close();
const events = (p) => p.evaluate(() => (window.POKI_LOG || []).map((x) => x.ev));
const sdkOnly = (list) => list.filter((e) => ['gameplayStart', 'gameplayStop', 'commercialBreak', 'rewardedBreak', 'gameLoadingFinished'].includes(e));
const dupes = (list) => { const g = list.filter((e) => e === 'gameplayStart' || e === 'gameplayStop'); return g.some((e, i) => i && e === g[i - 1]); };
const winGame = (p) => p.evaluate(() => { const g = FARO.game; for (const pl of g.players) if (pl.team !== g.players[0].team) g.kill(pl.core, 0); g.checkEnd(); });

(async () => {
  const b = await chromium.launch({ args: ARGS });

  // P01 y P16: sin red, las dos versiones cargan y se juega una partida.
  if (want('P01') || want('P16')) {
    for (const [id, file, name] of [['P01', POKI, 'Poki'], ['P16', WEB, 'web']]) {
      if (!want(id)) continue;
      const p = await open(b, file, { fake: id === 'P01' });
      const info = await p.evaluate(() => ({ three: THREE.REVISION, models: Object.keys(GLB).length, fonts: document.fonts.check('600 16px "Chakra Petch"') && document.fonts.check('16px Barlow') }));
      await p.click('#btn-play');
      await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 200 });
      await p.mouse.click(500, 300);
      await p.evaluate(() => { for (let i = 0; i < 600; i++) FARO.game.update(0.1); });
      await winGame(p);
      await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
      const ext = p.ext.filter((u) => !(id === 'P01' && u.includes('game-cdn.poki.com/scripts/v2/poki-sdk.js')));
      const html = fs.readFileSync(file, 'utf8');
      const cdn = /cdnjs\.cloudflare|cdn\.jsdelivr|fonts\.googleapis|fonts\.gstatic|unpkg\.com/.test(html);
      add(id, ext.length === 0 && !cdn && info.models === 156 && info.fonts && !p.errs.length,
        `${name}: sin red, cargó three.js r${info.three}, ${info.models} modelos y las fuentes de adentro (${info.fonts}); se jugó una partida hasta la victoria · pedidos a otros sitios: ${ext.length}${id === 'P01' ? ' (aparte del script del SDK de Poki)' : ''} · el archivo nombra CDN o Google Fonts: ${cdn} · errores: ${p.errs.length}`);
      await close(p);
    }
  }

  // P02 y P03: eventos del SDK y anuncios (SDK de prueba: cada anuncio dura 1,5 s).
  if (want('P02') || want('P03')) {
    const p = await open(b, POKI, { fake: true });
    await p.waitForTimeout(500);
    const ev0 = sdkOnly(await events(p));
    await p.click('#btn-play');
    await p.waitForTimeout(400);
    const during = await p.evaluate(() => ({ ad: !!window.POKI_AD, shield: !document.getElementById('adshield').hidden, ctx: FARO.sound.ctx ? FARO.sound.ctx.state : 'sin sonido aún' }));
    await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
    await p.waitForTimeout(600);
    const beforeTap = sdkOnly(await events(p));
    await p.mouse.click(520, 320);
    await p.waitForTimeout(300);
    const afterTap = sdkOnly(await events(p));
    // Pausa con ESC; seguir: anuncio; durante el anuncio la partida no avanza, el sonido calla y las teclas no hacen nada.
    await p.evaluate(() => FARO.setSelection([]));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const paused = await p.evaluate(() => FARO.paused);
    await p.click('#btn-resume');
    await p.waitForTimeout(300);
    const adState = await p.evaluate(() => ({ t: FARO.game.time, ad: !!window.POKI_AD, ctx: FARO.sound.ctx ? FARO.sound.ctx.state : 'sin sonido', shield: !document.getElementById('adshield').hidden }));
    await p.keyboard.press('b');
    await p.mouse.click(300, 300);
    await p.waitForTimeout(800);
    const adState2 = await p.evaluate(() => ({ t: FARO.game.time, build: !document.getElementById('buildpanel').hidden && document.getElementById('buildpanel').offsetParent !== null }));
    await p.waitForFunction(() => !window.POKI_AD && !FARO.paused, null, { polling: 100 });
    await p.waitForTimeout(1200);
    const after = await p.evaluate(() => ({ t: FARO.game.time, ctx: FARO.sound.ctx ? FARO.sound.ctx.state : 'sin sonido', shield: !document.getElementById('adshield').hidden }));
    // Al vestíbulo: sin anuncio.
    await p.evaluate(() => FARO.togglePause(true));
    await p.waitForTimeout(200);
    const nBefore = (await events(p)).filter((e) => e === 'commercialBreak').length;
    await p.evaluate(() => FARO.toMenu());
    await p.waitForTimeout(800);
    const nAfter = (await events(p)).filter((e) => e === 'commercialBreak').length;
    // Volver a la partida: anuncio camino a jugar; luego 3 minutos de toques al azar y teclas (pausa, seguir, final).
    await p.evaluate(() => FARO.lobby.render());
    const resumeBtn = await p.$('[data-act="resume"]');
    if (resumeBtn) await resumeBtn.click(); else await p.evaluate(() => FARO.resumeGame());
    await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
    // Los botones de idioma vuelven a abrir el juego (eso se prueba en P11): aquí se esconden para que los toques al azar no lo hagan.
    await p.addStyleTag({ content: '[data-lang] { display: none !important; }' });
    const rnd = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const t0 = Date.now();
    let actions = 0;
    let adEventsBad = 0;
    while (Date.now() - t0 < 180000) {
      const r = rnd();
      if (r < 0.6) await p.mouse.click(40 + rnd() * 950, 60 + rnd() * 480);
      else if (r < 0.7) await p.keyboard.press('Escape');
      else if (r < 0.8) { const x = await p.$('#btn-resume'); if (x && await x.isVisible()) await x.click({ timeout: 2000 }).catch(() => {}); }
      else if (r < 0.85) await p.keyboard.press('p');
      else await p.mouse.click(40 + rnd() * 950, 60 + rnd() * 480);
      actions++;
      const log = await p.evaluate(() => window.POKI_LOG);
      // Ningún evento de juego mientras un anuncio está en pantalla.
      let inAd = false;
      adEventsBad = 0;
      for (const x of log) {
        if (x.ev === 'commercialBreak' || x.ev === 'rewardedBreak') inAd = true;
        else if (x.ev === 'commercialBreak-fin' || x.ev === 'rewardedBreak-fin') inAd = false;
        else if (inAd && (x.ev === 'gameplayStart' || x.ev === 'gameplayStop')) adEventsBad++;
      }
      if (await p.evaluate(() => FARO.state !== 'play' && !window.POKI_AD)) { await p.evaluate(() => FARO.lobby.render()); const rb = await p.$('[data-act="resume"]'); if (rb) await rb.click({ timeout: 2000 }).catch(() => {}); else await p.click('#btn-play', { timeout: 2000 }).catch(() => {}); await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100, timeout: 20000 }).catch(() => {}); }
    }
    await p.evaluate(() => FARO.togglePause(false));
    await p.waitForFunction(() => !window.POKI_AD, null, { polling: 100 });
    await winGame(p);
    await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
    await p.click('#btn-menu');
    await p.waitForTimeout(500);
    const all = await events(p);
    const sdk = sdkOnly(all);
    const firstStartAfterLoad = afterTap.length > beforeTap.length && afterTap[afterTap.length - 1] === 'gameplayStart' && !beforeTap.slice(ev0.length).includes('gameplayStart');
    if (want('P02')) {
      add('P02', ev0.join() === 'gameLoadingFinished' && firstStartAfterLoad && !dupes(sdk) && adEventsBad === 0 && sdk.filter((e) => e === 'gameLoadingFinished').length === 1 && !p.errs.length,
        `al cargar: ${ev0.join(', ')} · al entrar a la partida: ${beforeTap.slice(ev0.length).join(' > ')} (sin gameplayStart hasta tocar) · primer toque: gameplayStart (${firstStartAfterLoad}) · ` +
        `recorrido completo + 3 min de toques y teclas al azar (${actions} acciones): ${sdk.length} eventos, ${sdk.filter((e) => e === 'gameplayStart').length} gameplayStart y ${sdk.filter((e) => e === 'gameplayStop').length} gameplayStop, dos iguales seguidos: ${dupes(sdk)}, eventos durante un anuncio: ${adEventsBad} · errores: ${p.errs.length}`);
    }
    if (want('P03')) {
      add('P03', during.ad && during.shield && paused && adState.ad && adState.shield && adState.ctx !== 'running' && Math.abs(adState2.t - adState.t) < 0.01 && !adState2.build &&
        after.t > adState.t && !after.shield && (after.ctx === 'running' || after.ctx === 'sin sonido') && nAfter === nBefore,
        `«Jugar»: anuncio con la capa que frena los toques (${during.shield}) · ESC pausa (${paused}) · «Seguir»: anuncio; durante el anuncio el sonido queda «${adState.ctx}», el tiempo de la partida no se mueve (${adState.t.toFixed(2)} → ${adState2.t.toFixed(2)} s) y la tecla B y un toque no hacen nada (panel abierto: ${adState2.build}) · al terminar: sigue (${after.t.toFixed(2)} s), sonido «${after.ctx}» · ir al vestíbulo: anuncios ${nBefore} → ${nAfter} (sin anuncio)`);
    }
    await close(p);
  }

  // P04: anuncio con premio en la pantalla final.
  if (want('P04')) {
    const runs = [];
    for (const reward of [true, false]) {
      const p = await open(b, POKI, { fake: true, fakeOpts: { FAKE_REWARD: reward, FAKE_AD_MS: 800 } });
      await p.click('#btn-play');
      await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
      await p.mouse.click(500, 300);
      await winGame(p);
      await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
      await p.waitForTimeout(400);
      const btn = await p.evaluate(() => {
        const d = document.getElementById('btn-double');
        const m = document.getElementById('btn-menu');
        if (!d) return null;
        const a = d.getBoundingClientRect();
        const c = m.getBoundingClientRect();
        const rgb = getComputedStyle(d).backgroundColor.match(/\d+/g).map(Number);
        return { text: d.textContent.trim(), rgb, green: rgb[1] > rgb[0] + 30 && rgb[1] > rgb[2] + 30, bigger: c.width >= a.width - 0.5 && c.height >= a.height - 0.5, beside: Math.abs(a.top - c.top) < 4 || a.top >= c.bottom - 1 };
      });
      const before = await p.evaluate(() => ({ c: Profile.data.crystals, xp: Profile.data.xp, r: FARO.game.reward }));
      const toasts0 = await p.evaluate(() => document.querySelectorAll('.toast').length);
      await p.click('#btn-double');
      await p.waitForTimeout(1500);
      const mid = await p.evaluate(() => ({ c: Profile.data.crystals, xp: Profile.data.xp, doubled: !!FARO.game.doubled, btn: !!document.getElementById('btn-double'), toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent) }));
      // Otra vez (solo si quedó el botón): no debe dar dos veces.
      if (mid.btn && reward) await p.click('#btn-double').catch(() => {});
      await p.waitForTimeout(1200);
      const end = await p.evaluate(() => ({ c: Profile.data.crystals, xp: Profile.data.xp }));
      runs.push({ reward, btn, before, mid, end, toasts0 });
      await close(p);
    }
    // En Campo de pruebas no hay botón.
    const p = await open(b, POKI, { fake: true, fakeOpts: { FAKE_AD_MS: 300 } });
    await p.evaluate(() => { FARO.opts = { ...FARO.opts, mode: 'sandbox' }; FARO.startGame(); });
    await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
    await winGame(p);
    await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
    const sandboxBtn = await p.evaluate(() => !!document.getElementById('btn-double'));
    await close(p);
    const [ok, no] = runs;
    const gained = ok.mid.c - ok.before.c;
    add('P04', ok.btn && /🎬/.test(ok.btn.text) && !ok.btn.green && ok.btn.bigger && ok.btn.beside && gained === ok.before.r.crystals && ok.end.c === ok.mid.c && ok.mid.doubled && ok.mid.toasts.some((t) => /doble/i.test(t)) &&
      no.mid.c === no.before.c && !no.mid.doubled && !no.mid.toasts.some((t) => /doble|premio|reward/i.test(t)) && !sandboxBtn,
      `botón «${ok.btn && ok.btn.text}» con 🎬, color rgb(${ok.btn && ok.btn.rgb.join(', ')}) (verde: ${ok.btn && ok.btn.green}), el botón normal «Volver al vestíbulo» es igual o más grande (${ok.btn && ok.btn.bigger}) y está al lado (${ok.btn && ok.btn.beside}) · ` +
      `video visto: cristales ${ok.before.c} → ${ok.mid.c} (+${gained}, el premio era ${ok.before.r.crystals}), XP ${ok.before.xp} → ${ok.mid.xp}, aviso «${(ok.mid.toasts.find((t) => /doble/i.test(t)) || '').slice(0, 60)}», una sola vez (${ok.end.c}) · ` +
      `sin video (bloqueador): cristales ${no.before.c} → ${no.mid.c}, sin aviso de premio (${!no.mid.toasts.some((t) => /doble|premio|reward/i.test(t))}) · Campo de pruebas: sin botón (${!sandboxBtn})`);
  }

  // P05: SDK real de Poki (desde game-cdn.poki.com).
  if (want('P05')) {
    const p = await open(b, POKI, { allow: ['game-cdn.poki.com', 'poki.com', 'poki-cdn.com', 'poki-gdn.com'] });
    const sdk = await p.evaluate(() => ({ has: typeof window.PokiSDK === 'object' && typeof PokiSDK.init === 'function', ok: Platform.ok, log: Platform.log.map((x) => x.ev) }));
    await p.click('#btn-play');
    await p.waitForFunction(() => FARO.state === 'play', null, { timeout: 120000, polling: 200 });
    await p.waitForFunction(() => !Platform.inAd, null, { timeout: 120000, polling: 200 });
    await p.mouse.click(500, 300);
    await p.evaluate(() => { for (let i = 0; i < 300; i++) FARO.game.update(0.1); });
    const playing = await p.evaluate(() => ({ state: FARO.state, t: Math.round(FARO.game.time), log: Platform.log.map((x) => x.ev) }));
    await close(p);
    // SDK que nunca contesta (ni init ni el anuncio): el juego carga a los 6 s y la partida empieza a los 8 s.
    const t0 = Date.now();
    const h = await open(b, POKI, { init: () => {
      const never = () => new Promise(() => {});
      window.PokiSDK = { init: never, gameLoadingFinished() {}, gameplayStart() {}, gameplayStop() {}, commercialBreak: never, rewardedBreak: never, getLanguage: () => 'es' };
    } });
    const loadS = Math.round((Date.now() - t0) / 1000);
    const t1 = Date.now();
    await h.click('#btn-play');
    await h.waitForFunction(() => FARO.state === 'play' && !Platform.inAd, null, { timeout: 60000, polling: 200 });
    const hang = await h.evaluate(() => {
      const L = Platform.log;
      const at = (e) => (L.find((x) => x.ev === e) || {}).t;
      return { release: Math.round((at('commercialBreak-fin') - at('commercialBreak')) / 100) / 10, initS: Math.round((at('gameLoadingFinished') || 0) / 100) / 10, log: L.map((x) => x.ev).join(' > ') };
    });
    hang.loadS = loadS;
    hang.playS = Math.round((Date.now() - t1) / 1000);
    await close(h);
    // Sin el script (bloqueado): el juego sigue igual.
    const q = await open(b, POKI, {});
    await q.click('#btn-play');
    await q.waitForFunction(() => FARO.state === 'play', null, { polling: 200 });
    const noSdk = await q.evaluate(() => ({ state: FARO.state, sdk: !!Platform.sdk }));
    await close(q);
    add('P05', sdk.has && playing.state === 'play' && playing.t > 20 && noSdk.state === 'play' && !noSdk.sdk && hang.release <= 9 && /init-sin-respuesta/.test(hang.log),
      `con el script real (aquí solo llega game-cdn.poki.com; los demás servidores de Poki no y el SDK avisa que el juego no está en Poki): PokiSDK cargó (${sdk.has}), init ${sdk.ok ? 'bien' : 'sin respuesta: el juego siguió a los 6 s'}; eventos: ${playing.log.join(' > ')}; la partida corre (${playing.t} s) · ` +
      `SDK que nunca contesta: la carga siguió sin él (vestíbulo listo a los ${hang.initS} s de abrir) y el anuncio que nunca empieza suelta el juego a los ${hang.release} s (${hang.log}); la partida empezó (${hang.playS} s en total con esta máquina sin tarjeta gráfica) · sin el script (bloqueado): la partida empieza igual, sin SDK (${!noSdk.sdk})`);
  }

  // P06: dentro de una página larga (como en Poki), espacio, flechas y rueda no la mueven.
  if (want('P06')) {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } });
    const p = await ctx.newPage();
    p.setDefaultTimeout(240000);
    await p.route('**/*', (r) => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
    const host = path.join(__dirname, 'poki-host.html');
    fs.writeFileSync(host, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#83FFE7"><div style="height:40px">Página de Poki (prueba)</div><iframe id="g" src="file://${POKI}" style="width:1031px;height:580px;border:0"></iframe><div style="height:3000px">más contenido</div></body>`);
    await p.goto('file://' + host);
    const f = await (await p.$('#g')).contentFrame();
    await f.waitForFunction(() => window.FARO && FARO.loaded, null, { timeout: 240000, polling: 200 });
    await p.mouse.click(500, 300);
    const y0 = await p.evaluate(() => scrollY);
    for (const k of ['Space', 'ArrowDown', 'ArrowDown', 'PageDown', 'Space']) await p.keyboard.press(k);
    await p.mouse.move(500, 300);
    for (let i = 0; i < 6; i++) await p.mouse.wheel(0, 400);
    // El desplazamiento se aplica en el cuadro siguiente; sin tarjeta gráfica cada cuadro tarda: se espera 5 s.
    await p.waitForTimeout(5000);
    const y1 = await p.evaluate(() => scrollY);
    // En el juego: la rueda sobre una lista del juego la sigue desplazando (el Arsenal).
    await f.evaluate(() => { document.querySelector('[data-view="arsenal"]').click(); });
    await p.waitForTimeout(500);
    const listScroll = await f.evaluate(() => { const el = [...document.querySelectorAll('#menu *')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 20; }); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200), top: el.scrollTop }; });
    let moved = null;
    if (listScroll) {
      const fr = await (await p.$('#g')).boundingBox();
      await p.mouse.move(fr.x + listScroll.x, fr.y + listScroll.y);
      await p.mouse.wheel(0, 300);
      await p.waitForTimeout(5000);
      moved = await f.evaluate(() => { const el = [...document.querySelectorAll('#menu *')].find((e) => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 20; }); return el ? el.scrollTop : null; });
    }
    const y2 = await p.evaluate(() => scrollY);
    await ctx.close();
    fs.unlinkSync(host);
    add('P06', y0 === 0 && y1 === 0 && y2 === 0 && (moved === null || moved > listScroll.top),
      `juego en un iframe de 1031×580 dentro de una página de 3.000 px: tras espacio, flechas, Av Pág y 6 giros de rueda la página sigue en ${y1} px · la rueda sobre una lista del juego la desplaza (${listScroll ? `${listScroll.top} → ${moved} px` : 'no había lista larga'}) y la página sigue en ${y2} px`);
  }

  // P07: modo incógnito (el almacenamiento falla siempre).
  if (want('P07')) {
    const p = await open(b, POKI, { fake: true, init: () => {
      const boom = () => { throw new DOMException('El almacenamiento no está disponible', 'SecurityError'); };
      for (const k of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) Storage.prototype[k] = boom;
    } });
    await p.waitForTimeout(600);
    const note = await p.evaluate(() => (document.getElementById('nosave') || {}).textContent || '');
    await p.click('#btn-play');
    await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
    await p.mouse.click(500, 300);
    await p.evaluate(() => { for (let i = 0; i < 1200; i++) FARO.game.update(0.1); });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    await p.evaluate(() => FARO.togglePause(false));
    await p.waitForFunction(() => !window.POKI_AD, null, { polling: 100 });
    await winGame(p);
    await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
    await p.click('#btn-menu');
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => ({ state: FARO.state, xp: Profile.data.xp }));
    add('P07', note && after.state === 'menu' && after.xp > 0 && !p.errs.length,
      `con un almacenamiento que falla en cada lectura y escritura: el vestíbulo avisa «${note}» · se jugó una partida de 2 min, pausa, victoria y vuelta al vestíbulo (XP de la sesión: ${after.xp}) · errores: ${p.errs.length}`);
    await close(p);
  }

  // P11: elegir idioma (Poki, Ajustes y navegador).
  if (want('P11')) {
    const rows = [];
    for (const l of ['es', 'en', 'fr', 'pt']) {
      const p = await open(b, POKI, { fake: true, fakeOpts: { FAKE_LANG: l }, lang: 'es-ES' });
      rows.push([`Poki «${l}»`, await p.evaluate(() => I18N.lang), await p.evaluate(() => document.querySelector('#btn-play span').textContent)]);
      await close(p);
    }
    for (const l of ['es-AR', 'en-GB']) {
      const p = await open(b, WEB, { lang: l });
      rows.push([`navegador «${l}»`, await p.evaluate(() => I18N.lang), await p.evaluate(() => document.querySelector('#btn-play span').textContent)]);
      await close(p);
    }
    // Selector de Ajustes: de español a inglés; queda guardado y manda sobre Poki.
    const p = await open(b, POKI, { fake: true, fakeOpts: { FAKE_LANG: 'es' } });
    await p.evaluate(() => FARO.ui.openSettings());
    await p.waitForTimeout(300);
    await Promise.all([p.waitForNavigation({ timeout: 240000 }), p.click('[data-lang="en"]')]);
    await p.waitForFunction(() => window.FARO && FARO.loaded, null, { timeout: 240000, polling: 200 });
    const chosen = await p.evaluate(() => ({ lang: I18N.lang, chosen: I18N.chosen, saved: localStorage.getItem('faro-lang'), play: document.querySelector('#btn-play span').textContent }));
    await close(p);
    const okRows = rows.every(([n, lang]) => (/«es/.test(n) ? lang === 'es' : lang === 'en'));
    add('P11', okRows && chosen.lang === 'en' && chosen.saved === 'en',
      rows.map(([n, lang, play]) => `${n} → ${lang} («${play}»)`).join(' · ') + ` · Ajustes «English» con Poki en español: se vuelve a abrir en ${chosen.lang} («${chosen.play}»), guardado «${chosen.saved}»`);
  }

  // P14: versión limpia.
  if (want('P14')) {
    const p = await open(b, POKI, { fake: true });
    const ui = await p.evaluate(() => ({ creator: !!document.getElementById('btn-creatorzone'), links: [...document.querySelectorAll('a[href^="http"]')].length, roblox: /Roblox/.test(document.body.innerText) }));
    await p.evaluate(() => { document.querySelector('[data-view="shop"]').click(); });
    await p.waitForTimeout(300);
    const shop = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('[data-act="shoptab"]')].map((x) => x.dataset.v), roblox: /Roblox/.test(document.body.innerText) }));
    await p.evaluate(() => document.querySelector('[data-view="play"]').click());
    await p.click('#btn-play');
    await p.waitForFunction(() => FARO.state === 'play' && !window.POKI_AD, null, { polling: 100 });
    await p.mouse.click(500, 300);
    await p.evaluate(() => { for (let i = 0; i < 1200; i++) FARO.game.update(0.1); });
    await winGame(p);
    await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
    const html = fs.readFileSync(POKI, 'utf8');
    const creatorCode = /CREATOR_PASS/.test(html);
    add('P14', !ui.creator && ui.links === 0 && !ui.roblox && !shop.roblox && !shop.tabs.includes('crystals') && p.logs.length === 0,
      `sin botón «Creadores» (${!ui.creator}) · enlaces de salida: ${ui.links} · menciones a Roblox: vestíbulo ${ui.roblox}, tienda ${shop.roblox} · pestañas de la tienda: ${shop.tabs.join(', ')} (sin compras de cristales) · mensajes de consola (log/info/debug) en carga, partida y final: ${p.logs.length}${p.logs.length ? ' («' + p.logs.slice(0, 3).join('», «') + '»)' : ''} · el código de la zona de creadores sigue en el archivo, apagado en Poki (${creatorCode})`);
    await close(p);
  }

  await b.close();
  let prev = [];
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (err) { prev = []; }
  const merged = [...prev.filter((x) => !results.some((r) => r.id === x.id)), ...results];
  fs.writeFileSync(OUT, JSON.stringify(merged, null, 1));
  console.log(`[Pruebas v1.9] ${results.filter((r) => r.ok).length} de ${results.length} bien`);
})();
