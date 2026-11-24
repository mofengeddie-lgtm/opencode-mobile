// v1.9: revisor de idioma (parte 2): abre el juego en inglés, recorre las pantallas y busca español a la vista.
// Uso: node faro/tools/idioma/revisar_pantallas.cjs [archivo.html] [--fotos carpeta]
// Recorre: vestíbulo (todas sus partes y pestañas), ventanas, tienda, Arsenal con las 135 fichas, ajustes,
// la partida (barra, construir con cada pestaña, fichas, pausa), el final y los avisos que salen.
// Escribe tools/idioma/salida/pantallas.json. Sale con código 1 si encuentra español.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const FARO = path.resolve(__dirname, '..', '..');
const FILE = process.argv.slice(2).find((a) => a.endsWith('.html')) || path.join(FARO, 'faro.html');
const fi = process.argv.indexOf('--fotos');
const SHOTS = fi > 0 ? process.argv[fi + 1] : null;

// Detector: letras propias del español y palabras comunes que no existen en inglés.
const DETECT = () => {
  const ES = new Set(('de la el los las que para con una uno por del tus sin más tu su sus al es son está hay cada como pero ya solo aquí toca '
    + 'nivel monedas tropas edificios partida jugar vida daño casillas energía población tienes puedes ganar perder misión misiones '
    + 'construye construir entrena isla islas tierra mar aire barco barcos núcleo faro bandera cuartel puerto fábrica granja mina '
    + 'mejora mejorar mejoras cerrar volver salir pausa ajustes sonido música todo todos ningún ninguna listo lista esperando también '
    + 'muy poco mucho entre hasta desde después antes cuando donde quieres elige elegir ahora otra otro primero segundo vez veces '
    + 'apagado encendido sí ataca atacar defensa enemigo enemigos aliado aliados rivales cristales premio premios temporada rango '
    + 'segundos minutos tiempo nuevo nueva nuevos sigue seguir abrir cancelar terminar comprar fabricar').split(' '));
  const KEEP = ['Faro de Ámbar', 'Faro de', 'Ámbar', 'Español', 'AIR DEFENSE', 'Idioma · Language', 'IDIOMA · LANGUAGE', 'faro-de-ambar', 'FARO2026', 'PRIMERAISLA', 'AMBAR'];
  return (text) => {
    let t = ` ${text} `;
    for (const k of KEEP) t = t.split(k).join(' ');
    t = t.replace(/FARO\d[\w.=-]*/g, ' '); // texto de la copia del progreso (código, no idioma)
    const words = t.split(/[^A-Za-zÁÉÍÓÚáéíóúÑñÜü¿¡]+/).filter(Boolean);
    const bad = [];
    for (const w of words) {
      const lw = w.toLowerCase();
      if (/[áéíóúñ¿¡ü]/i.test(w) || ES.has(lw)) {
        const at = t.indexOf(w);
        bad.push(w + ' «' + t.slice(Math.max(0, at - 40), at + w.length + 40).replace(/\s+/g, ' ').trim() + '»');
      }
    }
    return bad;
  };
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.setDefaultTimeout(240000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    window.FARO_TEST_LANG = 'en';
    try { localStorage.setItem('faro-lang', 'en'); } catch (err) { /* nada */ }
  });
  await p.route('**/*', (r) => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await p.goto('file://' + FILE);
  await p.waitForFunction(() => window.FARO && FARO.loaded);
  await p.waitForTimeout(800);
  await p.evaluate(`window.__detect = (${DETECT.toString()})();`);
  // Avisos: se anotan todos los que aparecen.
  await p.evaluate(() => {
    window.__toasts = [];
    const ui = FARO.ui;
    const orig = ui.toast.bind(ui);
    ui.toast = (text, ...rest) => { window.__toasts.push(String(text)); return orig(text, ...rest); };
  });
  const report = [];
  const grab = async (name) => {
    const r = await p.evaluate(() => {
      const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && (el.offsetParent !== null || s.position === 'fixed'); };
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode;
        const el = n.parentElement;
        if (!el || /^(SCRIPT|STYLE)$/.test(el.nodeName) || !n.nodeValue.trim()) continue;
        if (el.closest('[hidden]') || !vis(el)) continue;
        out.push(n.nodeValue.trim());
      }
      for (const el of document.querySelectorAll('[title],[aria-label],[placeholder]')) {
        if (el.closest('[hidden]') || !vis(el)) continue;
        for (const a of ['title', 'aria-label', 'placeholder']) { const v = el.getAttribute(a); if (v) out.push(v); }
      }
      const text = out.join(' | ');
      return { bad: window.__detect(text), sample: text.slice(0, 300) };
    });
    report.push({ screen: name, bad: [...new Set(r.bad)], sample: r.sample });
    return r;
  };
  const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
  const click = (sel) => p.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);

  await grab('vestíbulo');
  await shot('en-lobby');
  for (const v of ['play', 'arsenal', 'shop']) {
    await click(`[data-view="${v}"]`);
    await p.waitForTimeout(300);
    await grab('pestaña ' + v);
    if (v === 'shop') {
      const tabs = await p.evaluate(() => [...document.querySelectorAll('[data-act="shoptab"]')].map((x) => x.dataset.v));
      for (const t of tabs) { await click(`[data-act="shoptab"][data-v="${t}"]`); await p.waitForTimeout(250); await grab('tienda ' + t); }
    }
    if (v === 'arsenal') {
      await shot('en-arsenal');
      const filters = await p.evaluate(() => [...document.querySelectorAll('[data-act="arsfilter"],[data-filter]')].map((x) => x.dataset.v || x.dataset.filter));
      for (const f of filters) { await p.evaluate((x) => { const el = document.querySelector(`[data-act="arsfilter"][data-v="${x}"],[data-filter="${x}"]`); if (el) el.click(); }, f); await p.waitForTimeout(150); }
      await p.evaluate(() => { const el = document.querySelector('[data-act="arsfilter"][data-v="all"],[data-filter="all"]'); if (el) el.click(); });
      const n = await p.evaluate(() => document.querySelectorAll('#menu .arsenal [data-k], #menu [data-act="arscard"], #menu .ucard').length);
      const keys = await p.evaluate(() => [...document.querySelectorAll('#menu [data-k]')].map((x) => x.dataset.k));
      let i = 0;
      for (const k of keys) {
        await p.evaluate((x) => { const el = document.querySelector(`#menu [data-k="${x}"]`); if (el) el.click(); }, k);
        await p.waitForTimeout(60);
        await grab('ficha ' + k);
        i++;
      }
      report.push({ screen: 'fichas del Arsenal', bad: [], sample: `${i} fichas abiertas (${n} tarjetas)` });
    }
  }
  await click('[data-view="play"]');
  const subs = await p.evaluate(() => [...document.querySelectorAll('[data-act="sub"]')].map((x) => x.dataset.sub));
  for (const s of subs) { await click(`[data-act="sub"][data-sub="${s}"]`); await p.waitForTimeout(250); await grab('vestíbulo ' + s); }
  await click('[data-act="sub"][data-sub="main"]');
  const modals = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-act="modal"]')].map((x) => x.dataset.m))]);
  for (const m of [...modals, 'about', 'codes', 'copy']) {
    await p.evaluate((x) => FARO.lobby.openModal(x), m);
    await p.waitForTimeout(250);
    await grab('ventana ' + m);
    await p.evaluate(() => { document.getElementById('modal').hidden = true; FARO.lobby.modal = null; });
  }
  // Ajustes por secciones.
  await p.evaluate(() => FARO.ui.openSettings && FARO.ui.openSettings());
  await p.waitForTimeout(300);
  const secs = await p.evaluate(() => [...document.querySelectorAll('#settings [data-setsec]')].map((x) => x.dataset.setsec));
  for (const s of secs) { await click(`#settings [data-setsec="${s}"]`); await p.waitForTimeout(200); await grab('ajustes ' + s); }
  await shot('en-settings');
  await p.evaluate(() => FARO.ui.closeSettings && FARO.ui.closeSettings());
  // Partida.
  await p.evaluate(() => { FARO.opts = { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 4242 }; FARO.startGame(); });
  await p.waitForTimeout(1200);
  await grab('partida');
  await shot('en-game');
  await p.evaluate(() => FARO.ui.toggleBuild());
  await p.waitForTimeout(300);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#btabs [data-tab]')].map((x) => x.dataset.tab));
  for (const t of tabs) { await click(`#btabs [data-tab="${t}"]`); await p.waitForTimeout(200); await grab('construir ' + t); }
  await p.evaluate(() => FARO.ui.toggleBuild());
  // Fichas de selección: Núcleo, un edificio de cada productor y tropas de cada clase.
  await p.evaluate(() => {
    const g = FARO.game;
    g.players[0].coins = 999999; g.players[0].energy = 9999;
    const core = g.cells[g.players[0].core.cell];
    for (const t of ['barracks', 'factory', 'research', 'gate', 'bunker', 'turret', 'aadef', 'house']) {
      const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b2) => g.map.dist(a, core) - g.map.dist(b2, core))[0];
      if (c) g.addBuilding(0, t, c.i, true);
    }
  });
  const sels = await p.evaluate(() => FARO.game.buildings.filter((x) => x.owner === 0).map((x) => x.id));
  for (const id of sels) {
    await p.evaluate((i) => { const g = FARO.game; FARO.setSelection([g.buildings.find((x) => x.id === i)]); }, id);
    await p.waitForTimeout(250);
    await grab('ficha de edificio ' + id);
  }
  await p.evaluate(() => { const g = FARO.game; FARO.setSelection(g.units.filter((u) => u.owner === 0)); });
  await p.waitForTimeout(250);
  await grab('ficha de tropas');
  await p.evaluate(() => FARO.togglePause(true));
  await p.waitForTimeout(250);
  await grab('pausa');
  await p.evaluate(() => FARO.togglePause(false));
  await p.evaluate(() => { const g = FARO.game; for (const pl of g.players) if (pl.team !== g.players[0].team) g.kill(pl.core, 0); g.checkEnd(); });
  await p.waitForSelector('#end:not([hidden])', { timeout: 30000 });
  await grab('final');
  await shot('en-end');
  // Campaña: ficha de la misión 1 y tutorial.
  await p.evaluate(() => FARO.toMenu());
  await p.waitForTimeout(300);
  await p.evaluate(() => FARO.startMission(1));
  await p.waitForTimeout(800);
  await grab('misión 1');
  await p.evaluate(() => FARO.toMenu());
  const toasts = await p.evaluate(() => window.__toasts);
  const tbad = await p.evaluate((list) => window.__detect(list.join(' | ')), toasts);
  report.push({ screen: 'avisos', bad: [...new Set(tbad)], sample: toasts.slice(0, 10).join(' | ') });
  await b.close();
  const withBad = report.filter((r) => r.bad.length);
  fs.mkdirSync(path.join(__dirname, 'salida'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'salida', 'pantallas.json'), JSON.stringify({ file: FILE, screens: report.length, withSpanish: withBad.length, errors: errs, report }, null, 1));
  console.log(`[Idioma] pantallas recorridas en inglés: ${report.length} · con español a la vista: ${withBad.length} · errores: ${errs.length}`);
  for (const r of withBad) console.log(`  - ${r.screen}: ${r.bad.slice(0, 6).join(' ‖ ')}`);
  for (const e of errs) console.log('  ! ' + e);
  process.exitCode = withBad.length || errs.length ? 1 : 0;
})();
