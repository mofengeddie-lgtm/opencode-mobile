// Pruebas de la v1.5 en Chromium: L01 (sin temporadas), L02 (portada), L03 (Núcleo), L04 (edificios), L05 (ficha),
// L06 (tropas) y L10 (rendimiento frente a la v1.4).
const H = require('./helpers.cjs');
const { chromium } = require('playwright');
const fs = require('fs');
const SP = __dirname;
const results = [];
const add = (id, ok, ev) => { results.push({ id, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !only || only.includes(id);
const GAME = 'file:///home/user/opencode-mobile/faro/faro.html';
const GAME14 = `file://${SP}/faro14.html`;
const SIZES = [['iPad horizontal', 1180, 820], ['iPad vertical', 820, 1180], ['pantalla 16:9', 1280, 720], ['celular horizontal', 844, 390], ['celular vertical', 390, 844]];
const errsAll = [];

async function open(browser, w, h, { url = GAME, init = null } = {}) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const page = await context.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  if (init) await page.addInitScript(init.fn, init.arg);
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url, { timeout: 120000 });
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 120000 });
  return page;
}
const step = (page, n) => page.evaluate((k) => { for (let i = 0; i < k; i++) FARO.game.update(0.1); }, n);
const tapBtn = async (page, sel) => {
  const hit = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, free: !!top && (top === el || el.contains(top)) }; }, sel);
  if (hit) await page.mouse.click(hit.x, hit.y);
  return hit && hit.free;
};
// Fecha fija (para probar que no hay temporadas en esas fechas).
const fakeDate = (iso) => ({
  fn: (when) => {
    const fixed = new Date(when).getTime();
    const D = Date;
    // eslint-disable-next-line no-global-assign
    Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed + (performance.now() | 0); } };
  },
  arg: iso,
});

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ---------- L01 sin temporadas del año ----------
  if (want('L01')) {
    const out = [];
    let okAll = true;
    for (const iso of ['2026-10-31T18:00:00', '2026-12-25T12:00:00']) {
      const page = await open(browser, 1180, 820, { init: fakeDate(iso) });
      // Aunque alguien hubiera elegido «Calabazas» en la v1.4, ya no aparece.
      await page.evaluate(() => { localStorage.setItem('faro-season', 'pumpkin'); });
      await page.reload();
      await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 120000 });
      const lobby = await page.evaluate(() => ({
        news: [...document.querySelectorAll('.cover-news li')].map((l) => l.textContent),
        words: /Calabazas|Invierno|Decoración de temporada/.test(document.body.innerText),
        top: (document.querySelector('[data-sub="top"] small') || {}).textContent || '',
        saved: localStorage.getItem('faro-season'),
        date: new Date().toISOString().slice(0, 10),
      }));
      await page.evaluate(() => { FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame(); FARO.togglePause(true); });
      await page.waitForTimeout(700);
      const game = await page.evaluate(() => {
        const r = FARO.renderer;
        let points = 0; let spheres = 0;
        r.scene.traverse((o) => { if (o.isPoints && o.material && o.material.isPointsMaterial && Math.abs(o.material.size - 0.14) < 1e-6) points++; if (o.isInstancedMesh && o.geometry && o.geometry.type === 'SphereGeometry') spheres++; });
        return {
          pauseSeason: document.querySelectorAll('[data-season]').length,
          pauseWords: /Decoración de temporada|Calabazas|Invierno/.test(document.getElementById('pause').innerText),
          snow: points + (r.snow ? 1 : 0) + (r.seasonGroup ? 1 : 0), pumpkins: spheres, fn: typeof r.applySeason,
        };
      });
      // La Liga y el Pase siguen con su temporada.
      await page.evaluate(() => { FARO.togglePause(false); FARO.state = 'menu'; FARO.lobby.sub = 'ranks'; FARO.lobby.render(); });
      await page.waitForTimeout(300);
      const liga = await page.evaluate(() => /Temporada \d/.test(document.getElementById('lobby-body').innerText));
      const ok = !lobby.words && !lobby.news.some((t) => /Temporad/.test(t)) && /T\. \d/.test(lobby.top) && game.pauseSeason === 0 && !game.pauseWords && game.snow === 0 && game.pumpkins === 0 && game.fn === 'undefined' && liga && lobby.saved === null;
      if (!ok) okAll = false;
      out.push(`${lobby.date}: portada sin «Calabazas», «Invierno» ni «Temporadas» (${!lobby.words && !lobby.news.some((t) => /Temporad/.test(t))}; novedades: ${lobby.news.join(', ')}); en la partida, nieve ${game.snow} y calabazas ${game.pumpkins}; la pausa tiene ${game.pauseSeason} botones de temporada; la opción guardada de la v1.4 se borró (${lobby.saved === null}); la Liga sigue con su temporada (${liga}) y el menú dice «Top jugadores ${lobby.top}»`);
      errsAll.push(...page.errs);
      await page.context().close();
    }
    add('L01', okAll, out.join(' · '));
  }

  // ---------- L02 portada en 5 tamaños ----------
  if (want('L02')) {
    const out = [];
    let okAll = true;
    for (const [name, w, h] of SIZES) {
      const page = await open(browser, w, h);
      await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.lobby.view = 'play'; FARO.lobby.sub = 'main'; FARO.lobby.render(); });
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const play = document.getElementById('btn-play').getBoundingClientRect();
        const icons = [...document.querySelectorAll('.sidebtn .ic')];
        const letters = icons.filter((i) => i.textContent.trim() !== '' || !i.querySelector('svg')).length;
        const labels = [...document.querySelectorAll('.lmenu .lm-label')];
        const lh = labels.length ? parseFloat(getComputedStyle(labels[0]).lineHeight) || 18 : 18;
        const broken = labels.filter((l) => l.getBoundingClientRect().height > lh * 1.45).map((l) => l.textContent);
        const cutLabels = labels.filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent);
        const small = [...document.querySelectorAll('#menu button, #menu .sidebtn')].filter((b) => {
          if (!b.getClientRects().length || getComputedStyle(b).visibility === 'hidden') return false;
          const q = b.getBoundingClientRect();
          return q.width < 43.5 || q.height < 43.5;
        }).map((b) => `${(b.id || b.textContent.trim()).slice(0, 14)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
        // Lo que se ve de cada elemento: recortado por los contenedores con overflow oculto (la imagen de la portada es más grande a propósito).
        const visRight = (e) => { let r = e.getBoundingClientRect().right; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (o.overflowX !== 'visible') r = Math.min(r, p.getBoundingClientRect().right); } return r; };
        const overEls = [...document.querySelectorAll('#lobby-body *')].filter((e) => e.getClientRects().length && visRight(e) > innerWidth + 1 && getComputedStyle(e).visibility !== 'hidden');
        const over = overEls.length;
        const overWhat = overEls.slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${(e.className && e.className.baseVal === undefined ? e.className : '').toString().split(' ')[0]} hasta x=${Math.round(e.getBoundingClientRect().right)}`).join(', ');
        return { overWhat, playTop: Math.round(play.top), playBottom: Math.round(play.bottom), playH: Math.round(play.height), playW: Math.round(play.width), letters, icons: icons.length, broken, cutLabels, small, over, scrollW: document.documentElement.scrollWidth, label: document.getElementById('btn-play').textContent.trim() };
      });
      await page.screenshot({ path: `${SP}/shots/v15-l02-${w}x${h}.png` });
      const ipad = /iPad/.test(name);
      const ok = (!ipad || (r.playTop >= 0 && r.playBottom <= h)) && r.letters === 0 && r.icons >= 5 && !r.broken.length && !r.cutLabels.length && !r.small.length && r.over === 0 && r.scrollW <= w + 1 && /Jugar/i.test(r.label);
      if (!ok) okAll = false;
      out.push(`${name} ${w} × ${h}: JUGAR (${r.playW} × ${r.playH} px) entre y=${r.playTop} y y=${r.playBottom}${ipad ? (r.playBottom <= h ? ', se ve sin desplazar' : ', NO se ve sin desplazar') : ''}; iconos dibujados ${r.icons - r.letters} de ${r.icons}; textos del menú partidos: ${r.broken.length ? r.broken.join(', ') : 'ninguno'}${r.cutLabels.length ? `; cortados: ${r.cutLabels.join(', ')}` : ''}; botones de menos de 44 px: ${r.small.length ? r.small.join(', ') : 'ninguno'}; algo cortado a la derecha: ${r.over ? `${r.over} (${r.overWhat})` : 'nada'}`);
      errsAll.push(...page.errs);
      await page.context().close();
    }
    add('L02', okAll, out.join(' · '));
  }

  // ---------- L03 Núcleo: color del jugador en la imagen, nuevo frente a la v1.4 ----------
  if (want('L03')) {
    const shot = async (url, tag) => {
      const page = await open(browser, 1180, 820, { url });
      await page.evaluate(() => {
        FARO.setQuality('high'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame();
        FARO.game.bots = [];
        const c = FARO.game.players[0].core;
        const r = FARO.renderer; r.cam.tx = c.x; r.cam.tz = c.z; r.cam.dist = 11; r.cam.yaw = 0.5;
        document.body.classList.add('shot');
      });
      await page.addStyleTag({ content: 'body.shot #hud, body.shot .topbar, body.shot #buildpanel, body.shot #leftcol, body.shot #selpanel, body.shot #bottomleft, body.shot #prodbar { visibility: hidden !important; }' });
      const res = [];
      for (const lv of [1, 2, 3]) {
        await page.evaluate((l) => { FARO.game.players[0].core.level = l; }, lv);
        await page.waitForTimeout(1600);
        const box = await page.evaluate(() => { const c = FARO.game.players[0].core; const a = FARO.renderer.project(c.x, c.y + 0.2, c.z); const b = FARO.renderer.project(c.x, c.y + 2.6, c.z); return { x: a.x, y0: b.y, y1: a.y }; });
        const half = Math.round((box.y1 - box.y0) * 0.6);
        const clip = { x: Math.max(0, Math.round(box.x - half)), y: Math.max(0, Math.round(box.y0 - 10)), width: half * 2, height: Math.round(box.y1 - box.y0 + 40) };
        const file = `${SP}/shots/v15-l03-${tag}-${lv}.png`;
        await page.screenshot({ path: file, clip });
        // Cuenta los píxeles con el color del jugador (azul) en el recorte.
        const pct = await page.evaluate(async (b64) => {
          const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const d = cx.getImageData(0, 0, img.width, img.height).data;
          const col = PLAYER_COLORS[0]; const R = (col >> 16) & 255; const G = (col >> 8) & 255; const B = col & 255;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) {
            // Mismo tono que el color del jugador (azul), con luz o sombra.
            const r = d[i]; const g = d[i + 1]; const bl = d[i + 2];
            if (bl > 90 && bl > r * 1.6 && bl > g * 1.15 && Math.abs((r / (bl + 1)) - R / (B + 1)) < 0.35 && Math.abs((g / (bl + 1)) - G / (B + 1)) < 0.3) n++;
          }
          return (n / (d.length / 4)) * 100;
        }, fs.readFileSync(file).toString('base64'));
        res.push({ lv, pct: +pct.toFixed(1), h: Math.round(box.y1 - box.y0) });
      }
      errsAll.push(...page.errs);
      await page.context().close();
      return res;
    };
    const old = await shot(GAME14, 'v14');
    const now = await shot(GAME, 'v15');
    const ok = now.every((r, i) => r.pct > old[i].pct && r.pct >= 4);
    add('L03', ok, now.map((r, i) => `nivel ${r.lv}: color del jugador en ${r.pct} % de la imagen del Núcleo (v1.4: ${old[i].pct} %; ${(r.pct / old[i].pct).toFixed(2).replace('.', ',')} veces)`).join('; ') +
      ' (misma cámara y misma partida; recortes en shots/v15-l03-*)');
  }

  // ---------- L04 edificios con color y nivel; L05 ficha; L06 tropas ----------
  if (want('L04') || want('L05') || want('L06')) {
    const page = await open(browser, 1180, 820);
    await page.evaluate(() => {
      FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame();
      const g = FARO.game; g.bots = []; g.players[0].coins = 60000; g.players[0].energy = 999;
      const put = (pid, type, lv) => {
        const core = g.cells[g.players[pid].core.cell];
        const c = g.cells.filter((x) => !g.placeInvalid(pid, type, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
        const b = g.addBuilding(pid, type, c.i, true);
        b.level = lv; if (b.def.levels && b.def.levels[lv]) { b.maxHp = b.def.levels[lv].hp || b.maxHp; b.hp = b.maxHp; }
        return b;
      };
      window.T = { bar: put(0, 'barracks', 1), tur: put(0, 'turret', 3), house: put(0, 'house', 2), farm: put(0, 'farm', 2), solar: put(0, 'solar', 1), fac: put(0, 'factory', 1), red: put(1, 'barracks', 2), red2: put(1, 'turret', 1) };
      FARO.focusCore(); FARO.renderer.cam.dist = 20;
    });
    await page.waitForTimeout(1200);
    if (want('L04')) {
      // Mejora en curso (barra celeste) y Cuartel parado (aviso «zz») después de 6 s de juego sin cola.
      await page.evaluate(() => { const g = FARO.game; g.startUpgrade ? g.startUpgrade(T.fac) : (T.fac.upgrading = { level: 2, progress: 0.4 }); });
      await step(page, 70);
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const g = FARO.game; const R = FARO.renderer;
        const eligible = g.buildings.filter((b) => b.alive && b.type !== 'wall' && b.type !== 'core' && R.vis.get(b.id) && R.vis.get(b.id).group.visible);
        const cols = [];
        const ic = R.flags.instanceColor;
        for (let i = 0; i < R.flags.count; i++) cols.push([ic.getX(i), ic.getY(i), ic.getZ(i)].map((v) => Math.round(v * 255)));
        const want = eligible.map((b) => { const c = PLAYER_COLORS[b.owner]; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; });
        const match = want.every((w, i) => cols[i] && w.every((v, k) => Math.abs(v - cols[i][k]) <= 2));
        const pipsWant = eligible.filter((b) => b.def.maxLevel > 1 && b.built).reduce((s, b) => s + b.level, 0);
        return { flags: R.flags.count, eligible: eligible.length, match, pips: R.levelPips.count, pipsWant, owners: [...new Set(eligible.map((b) => g.players[b.owner].name))].join(' y '), up: R.upBars, upgrading: !!T.fac.upgrading, idle: R.idleBadges, coreIdle: false };
      });
      await page.screenshot({ path: `${SP}/shots/v15-l04.png` });
      add('L04', r.flags === r.eligible && r.match && r.pips === r.pipsWant && r.up >= 1 && r.idle >= 1,
        `${r.eligible} edificios (${r.owners}): ${r.flags} banderines, cada uno del color de su dueño (${r.match}); marcas de nivel: ${r.pips} (suma de niveles de lo que se mejora: ${r.pipsWant}); Fábrica mejorándose con su barra celeste (${r.up} barra); Cuartel sin cola desde hace 7 s con su aviso «zz» (${r.idle} aviso; el Núcleo no lo muestra)`);
    }
    if (want('L05')) {
      const out = [];
      await page.evaluate(() => { const g = FARO.game; ['rifle', 'sniper', 'rocket'].forEach((t) => g.enqueue(T.bar, t)); FARO.setSelection([T.bar]); });
      await page.waitForTimeout(900);
      const a = await page.evaluate(() => ({
        qtime: (document.getElementById('sel-qtime') || {}).textContent || '',
        nextup: (() => { const n = document.querySelector('#selpanel .nextup'); return n && n.offsetParent ? n.innerText.replace(/\s+/g, ' ') : ''; })(),
        coins: FARO.game.players[0].coins, items: document.querySelectorAll('#sel-queue .qitem').length,
      }));
      const freeX = await tapBtn(page, '#sel-queue .qitem:last-of-type');
      await page.waitForTimeout(500);
      const b = await page.evaluate(() => ({ coins: FARO.game.players[0].coins, items: document.querySelectorAll('#sel-queue .qitem').length }));
      const refund = Math.round(b.coins - a.coins);
      await page.screenshot({ path: `${SP}/shots/v15-l05.png` });
      const okA = /lista en|la próxima en/.test(a.qtime) && /→/.test(a.nextup) && a.items === 3 && b.items === 2 && refund >= 1500 && refund <= 1540 && freeX;
      out.push(`Cuartel con 3 en cola: dice «${a.qtime}»; a la vista: «${a.nextup.slice(0, 120)}»; tocar el último de la cola lo quita (${a.items} → ${b.items}) y devuelve el precio del Cohetero (1500): las monedas suben ${refund} (lo demás es el ingreso de esos segundos)`);
      // Tarjetas sin cortes en 5 tamaños.
      const cut = [];
      for (const [name, w, h] of SIZES) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => { FARO.ui.selSig = ''; FARO.setSelection([T.bar]); });
        await page.waitForTimeout(700);
        const c = await page.evaluate(() => {
          const p = document.getElementById('selpanel').getBoundingClientRect();
          const cards = [...document.querySelectorAll('#selpanel .card')];
          const bad = cards.filter((k) => { const r = k.getBoundingClientRect(); return r.right > p.right + 1 || r.left < p.left - 1; }).length;
          const sw = document.getElementById('selpanel');
          return { n: cards.length, bad, scroll: sw.scrollWidth > sw.clientWidth + 1 };
        });
        await page.screenshot({ path: `${SP}/shots/v15-l05-${w}x${h}.png` });
        if (c.bad || c.scroll) cut.push(`${name}: ${c.bad} de ${c.n} cortadas`);
        out.push(`${name}: ${c.n} tarjetas, ${c.bad ? `${c.bad} cortadas` : 'ninguna cortada'}`);
      }
      await page.setViewportSize({ width: 1180, height: 820 });
      add('L05', okA && !cut.length, out.join(' · '));
    }
    if (want('L06')) {
      const r1 = await page.evaluate(() => {
        const g = FARO.game;
        const sp = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 9);
        window.U = ['sniper', 'rifle', 'rifle', 'tank', 'heli', 'jeep'].map((t, i) => g.addUnit(0, t, sp[(i + 4) % sp.length]));
        const e = g.freeCellsNear(g.players[1].core.cell, 'land', 0, 6);
        ['rifle', 'tank'].forEach((t, i) => g.addUnit(1, t, e[i + 2]));
        FARO.setSelection([U[0]]);
        FARO.focusCore(); FARO.renderer.cam.dist = 12;
        return true;
      });
      await page.waitForTimeout(1200);
      const near = await page.evaluate(() => {
        const g = FARO.game; const R = FARO.renderer;
        const vis = g.units.filter((u) => u.alive && !u.inside && R.vis.get(u.id) && R.vis.get(u.id).group.visible).length;
        const tiles = (document.querySelector('#selpanel .unittiles') || {}).innerText || '';
        const vs = (document.querySelector('#selpanel .vsline') || {}).innerText || '';
        return { rings: R.marksShown.rings, vis, icons: R.unitIcons, tiles: tiles.replace(/\s+/g, ' '), vs: vs.replace(/\s+/g, ' ') };
      });
      await page.screenshot({ path: `${SP}/shots/v15-l06-near.png` });
      await page.evaluate(() => { FARO.setSelection([]); FARO.renderer.cam.dist = 44; });
      await page.waitForTimeout(1200);
      const far = await page.evaluate(() => ({ icons: FARO.renderer.unitIcons }));
      await page.screenshot({ path: `${SP}/shots/v15-l06-far.png` });
      await page.evaluate(() => { FARO.renderer.cam.dist = 14; FARO.setSelection(U); });
      await page.waitForTimeout(900);
      const chipFree = await tapBtn(page, '#selpanel [data-act="seltype"][data-type="rifle"]');
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => FARO.selection.map((e) => e.type));
      const ok = near.rings === near.vis && near.icons === 0 && far.icons > 0 && /Daño\/s/i.test(near.tiles) && /Alcance/i.test(near.tiles) && /Velocidad/i.test(near.tiles) && /contra/i.test(near.vs) && chipFree && after.length === 2 && after.every((t) => t === 'rifle');
      add('L06', ok, `${near.vis} tropas a la vista, ${near.rings} anillos de color; iconos de tipo: ${near.icons} con la cámara cerca y ${far.icons} con la cámara lejos; ficha del Francotirador: «${near.tiles}» · «${near.vs}»; con 6 tropas elegidas, tocar «2× Artillero» deja ${after.length} elegidas (${after.join(', ')})`);
    }
    errsAll.push(...page.errs);
    await page.context().close();
  }

  // ---------- L09e la fila de jugadores en una línea (iPad horizontal, con la barra «Producción») ----------
  if (want('L09')) {
    const row = async (url) => {
      const page = await open(browser, 1180, 820, { url });
      await page.evaluate(() => {
        FARO.setQuality('low'); FARO.opts = { mode: 'conquest', mapKind: 'continent', difficulty: 'normal', seed: 919 }; FARO.startGame();
        const g = FARO.game; g.bots = []; g.players[0].coins = 50000;
        const core = g.cells[g.players[0].core.cell];
        for (const t of ['barracks', 'factory', 'solar', 'farm']) { const c = g.cells.filter((x) => !g.placeInvalid(0, t, x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0]; g.addBuilding(0, t, c.i, true); }
        const sp = g.freeCellsNear(core.i, 'land', 0, 6);
        for (let i = 0; i < 11; i++) g.addUnit(0, 'rifle', sp[i % sp.length]);
        for (let i = 0; i < 40; i++) g.update(0.1);
        FARO.ui.playersSig = '';
      });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const el = document.getElementById('players');
        const chips = [...el.querySelectorAll('.pchip')];
        const tops = new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top)));
        return { lines: tops.size, h: Math.round(el.getBoundingClientRect().height), names: chips.map((c) => c.innerText.trim()).join(' · '), prod: !!document.querySelector('#prodbar:not([hidden])') };
      });
      await page.screenshot({ path: `${SP}/shots/v15-l09row-${url === GAME ? 'v15' : 'v14'}.png` });
      await page.context().close();
      return r;
    };
    const old = await row(GAME14);
    const now = await row(GAME);
    add('L09e', now.lines === 1, `iPad horizontal con la barra «Producción» y números largos arriba: v1.4 ${old.lines} línea${old.lines > 1 ? 's' : ''} (${old.h} px de alto: ${old.names}); v1.5 ${now.lines} línea (${now.h} px: ${now.names})`);
  }

  // ---------- L09f «¡A jugar!» de la misión a la vista en el celular ----------
  if (want('L09')) {
    const brief = async (url, w, h) => {
      const page = await open(browser, w, h, { url });
      await page.evaluate(() => { localStorage.clear(); Profile.load(); FARO.setQuality('low'); FARO.lobby.sub = 'campaign'; FARO.lobby.render(); document.getElementById('btn-mission-1').click(); });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => { const b = document.getElementById('btn-brief-go').getBoundingClientRect(); const top = document.elementFromPoint(b.left + b.width / 2, Math.min(innerHeight - 1, b.top + b.height / 2)); return { bottom: Math.round(b.bottom), h: innerHeight, free: b.bottom <= innerHeight && !!top && top.id === 'btn-brief-go' }; });
      await page.context().close();
      return r;
    };
    const parts = [];
    let okAll = true;
    for (const [name, w, h] of [['celular horizontal', 844, 390], ['celular vertical', 390, 844], ['iPad horizontal', 1180, 820]]) {
      const old = await brief(GAME14, w, h);
      const now = await brief(GAME, w, h);
      if (!now.free) okAll = false;
      parts.push(`${name}: v1.4 ${old.free ? 'a la vista' : `escondido (termina en y=${old.bottom}, la pantalla mide ${old.h})`}; v1.5 ${now.free ? 'a la vista' : `escondido (y=${now.bottom})`}`);
    }
    add('L09f', okAll, `botón «¡A jugar!» de la Misión 1 sin desplazar la ficha: ${parts.join(' · ')}`);
  }

  // ---------- L10 rendimiento: cuadros por segundo frente a la v1.4 ----------
  if (want('L10')) {
    const fps = async (url, q = 'high') => {
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
      const r = await page.evaluate(() => new Promise((res) => {
        let n = 0; const t0 = performance.now();
        const f = () => { n++; if (performance.now() - t0 < 12000) requestAnimationFrame(f); else res({ fps: n / ((performance.now() - t0) / 1000) }); };
        requestAnimationFrame(f);
      }));
      await page.context().close();
      return r.fps;
    };
    const med = (x) => [...x].sort((p, q) => p - q)[1];
    const parts = [];
    let okAll = true;
    for (const [q, qn] of [['high', 'Alta calidad'], ['low', 'Más fluido']]) {
      const a = []; const b = [];
      for (let i = 0; i < 3; i++) { a.push(await fps(GAME14, q)); b.push(await fps(GAME, q)); }
      const k = med(b) / med(a);
      if (k < 0.9) okAll = false;
      parts.push(`${qn}: v1.4 ${med(a).toFixed(1)} cuadros por segundo (${a.map((x) => x.toFixed(1)).join(', ')}); v1.5 ${med(b).toFixed(1)} (${b.map((x) => x.toFixed(1)).join(', ')}): ${k >= 1 ? `${Math.round((k - 1) * 100)} % más` : `${Math.round((1 - k) * 100)} % menos`}`);
    }
    add('L10', okAll, `misma partida (90 tropas y 9 edificios a la vista; Chromium sin tarjeta gráfica, por eso los números son bajos; 12 s, 3 veces cada una, mediana): ${parts.join(' · ')}`);
  }

  const errs = [...new Set(errsAll)];
  add('errores', errs.length === 0, errs.length ? errs.slice(0, 6).join(' | ') : 'sin errores en la consola');
  await browser.close();
  if (!only) fs.writeFileSync(SP + '/results-v15.json', JSON.stringify(results, null, 1));
  else fs.writeFileSync(SP + `/results-v15-${only.join('')}.json`, JSON.stringify(results, null, 1));
})();
