// L07: toques al azar en iPad y celular. Busca errores de consola, congelamientos y textos «undefined»/«NaN».
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const GAME = process.env.GAME || 'file:///home/user/opencode-mobile/faro/faro.html';
const MINUTES = Number(process.env.MIN || 15);
const OUT = process.env.OUT || '/results-v15-monkey.json';
const DEVICES = (process.env.DEV ? process.env.DEV.split(',') : ['ipad', 'cel']).map((k) => ({ ipad: ['iPad horizontal 1180 × 820', 1180, 820], cel: ['celular horizontal 844 × 390', 844, 390], celv: ['celular vertical 390 × 844', 390, 844] })[k]);
let seed = 1515;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const [name, w, h] of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, acceptDownloads: true });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(`console: ${m.text()}`); });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
    await H.routes(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(GAME, { timeout: 120000 });
    await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 120000 });
    await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.setQuality('low'); FARO.lobby.render(); });
    const t0 = Date.now();
    let actions = 0;
    let games = 0;
    let freezes = 0;
    const slow = [];
    let lastAction = 'inicio';
    const badText = new Set();
    const kinds = {};
    const screens = new Set();
    while (Date.now() - t0 < MINUTES * 60000) {
      // ¿Dónde estamos?
      let st;
      try {
        st = await Promise.race([
          page.evaluate(() => ({ state: FARO.state, over: !!(FARO.game && FARO.game.over), modal: !!document.querySelector('.modal:not([hidden]), #modal:not([hidden])') })),
          new Promise((_, rej) => setTimeout(() => rej(new Error('sin respuesta')), 15000)),
        ]);
      } catch (e) {
        // ¿Cuánto tarda en volver a responder? (más de 60 s = congelado de verdad).
        const tw = Date.now();
        let back = false;
        for (let k = 0; k < 12 && !back; k++) back = await Promise.race([page.evaluate(() => true), new Promise((res) => setTimeout(() => res(false), 5000))]).catch(() => false);
        const secs = Math.round((Date.now() - tw) / 1000) + 15;
        slow.push(`${secs} s tras «${lastAction}»`);
        if (!back) { freezes++; errs.push(`congelado más de 75 s tras «${lastAction}»`); if (freezes > 1) break; }
        continue;
      }
      screens.add(st.state);
      // Si estamos en el vestíbulo mucho rato, a veces empezar una partida directo (para probar la partida).
      if (st.state !== 'play' && rnd() < 0.08) {
        await page.evaluate(() => { try { const b = document.getElementById('btn-play'); if (b) b.click(); } catch (e) { /* nada */ } });
        games++;
        await page.waitForTimeout(600);
        continue;
      }
      const r = rnd();
      let kind;
      if (r < 0.62) {
        // Tocar un botón visible al azar.
        const target = await page.evaluate((k) => {
          const els = [...document.querySelectorAll('button:not([disabled]), [role="button"], .tab, .bitem, .card, .chip, .sidebtn, a[href^="#"]')].filter((b) => {
            if (!b.getClientRects().length) return false;
            const r = b.getBoundingClientRect();
            if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
            const x = r.left + r.width / 2; const y = r.top + r.height / 2;
            const top = document.elementFromPoint(x, y);
            return top && (top === b || b.contains(top));
          });
          if (!els.length) return null;
          const b = els[Math.floor(k * els.length)];
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: (b.id || b.dataset.act || b.textContent.trim()).slice(0, 30) };
        }, rnd());
        if (!target) {
          // Sin botones a la vista: desplazar lo que haya en el centro (una ventana larga, por ejemplo).
          kind = 'desplazar';
          lastAction = 'desplazar';
          await page.mouse.move(w / 2, h / 2);
          await page.mouse.wheel(0, 250);
        } else if (target) {
          kind = 'botón';
          lastAction = `botón ${target.label}`;
          await page.mouse.click(target.x, target.y);
        } else kind = 'nada';
      } else if (r < 0.82) {
        kind = 'mapa';
        lastAction = 'toque en el mapa';
        await page.mouse.click(Math.floor(rnd() * w), Math.floor(60 + rnd() * (h - 120)));
      } else if (r < 0.9) {
        kind = 'arrastre';
        const x = Math.floor(rnd() * w); const y = Math.floor(60 + rnd() * (h - 120));
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + (rnd() - 0.5) * 300, y + (rnd() - 0.5) * 200, { steps: 6 }); await page.mouse.up();
      } else if (r < 0.95) {
        kind = 'pulsación larga';
        const x = Math.floor(rnd() * w); const y = Math.floor(60 + rnd() * (h - 120));
        await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
      } else {
        kind = 'tiempo';
        lastAction = '15 s de juego de golpe';
        await page.evaluate(() => { if (FARO.state === 'play' && FARO.game && !FARO.game.over) for (let i = 0; i < 150; i++) FARO.game.update(0.1); });
      }
      kinds[kind] = (kinds[kind] || 0) + 1;
      actions++;
      await page.waitForTimeout(120 + Math.floor(rnd() * 200));
      if (actions % 15 === 0) {
        const bad = await page.evaluate(() => {
          const out = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const t = n.textContent;
            if (!/\bundefined\b|\bNaN\b|\[object Object\]/.test(t)) continue;
            const el = n.parentElement;
            if (!el || !el.getClientRects().length || el.closest('script, style')) continue;
            out.push(`${el.id || el.className || el.tagName}: ${t.trim().slice(0, 80)}`);
          }
          return out;
        }).catch(() => []);
        for (const b of bad) badText.add(b);
        if (actions % 150 === 0) await page.screenshot({ path: `${SP}/shots/v15-monkey-${name.split(' ')[0]}-${actions}.png` }).catch(() => {});
      }
    }
    const uniq = [...new Set(errs)];
    report.push({ name, minutes: +((Date.now() - t0) / 60000).toFixed(1), actions, games, kinds, freezes, slow, errors: uniq, badText: [...badText], screens: [...screens] });
    console.log(name, JSON.stringify(report[report.length - 1]).slice(0, 1500));
    await ctx.close();
  }
  await browser.close();
  const ok = report.every((r) => !r.errors.length && !r.freezes && !r.badText.length && r.actions > 100);
  const ev = report.map((r) => `${r.name}: ${r.minutes} min, ${r.actions} toques (${Object.entries(r.kinds).map(([k, v]) => `${v} ${k}`).join(', ')}), ${r.games} partidas empezadas; errores en la consola: ${r.errors.length ? r.errors.slice(0, 5).join(' | ') : 'ninguno'}; congelamientos: ${r.freezes}${r.slow.length ? ` (respuestas lentas de más de 15 s: ${r.slow.join(', ')})` : ''}; textos raros: ${r.badText.length ? r.badText.slice(0, 5).join(' | ') : 'ninguno'}`).join(' · ');
  console.log(ok ? 'OK  ' : 'FAIL', 'L07', ev);
  fs.writeFileSync(SP + OUT, JSON.stringify([{ id: 'L07', ok, ev, report }], null, 1));
})();
