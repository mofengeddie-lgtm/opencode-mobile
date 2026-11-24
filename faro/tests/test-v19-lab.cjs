// P19 (v1.9): el Laboratorio del Campo de pruebas (v1.8.1, publicada aparte el 21 nov y juntada en la v1.9).
// Se toca como un dedo lo que se puede tocar (botón del matraz, botones del panel, el mapa) y se mira el estado del juego.
// Uso: node test-v19-lab.cjs   ·   GAME=file:///…/otro.html para correrla en otra versión (p. ej. la v1.8.1 publicada)
//      FARO_LANG=en para el panel en inglés · OUT=archivo.json para guardar el resultado en otro lado.
const { chromium } = require('playwright');
const fs = require('fs');
const FARO = '/home/user/opencode-mobile/faro';
const SP = process.env.SP || __dirname;
const GAME = process.env.GAME || `file://${FARO}/faro.html`;
const OUT = process.env.OUT || `${FARO}/tests/results-v19-lab.json`;
const LANG = process.env.FARO_LANG === 'en' ? 'en' : 'es';
const THREE = SP + '/three/node_modules/three';
const results = [];
const add = (id, ok, ev, extra = {}) => { results.push({ id, ok: !!ok, ev, ...extra }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} · ${ev}`); };

async function open(browser, w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errs.push(m.text()); });
  await page.addInitScript((lang) => {
    window.FARO_TEST_LANG = lang;
    const l = lang === 'en' ? ['en-US', 'en'] : ['es-ES', 'es'];
    Object.defineProperty(navigator, 'language', { get: () => l[0] });
    Object.defineProperty(navigator, 'languages', { get: () => l });
  }, LANG);
  // Las versiones de antes de la v1.9 piden el motor 3D y las letras a otros sitios.
  if (fs.existsSync(THREE)) {
    await page.route('**/three.min.js', (r) => r.fulfill({ path: THREE + '/build/three.min.js', contentType: 'application/javascript' }));
    await page.route('**/GLTFLoader.js', (r) => r.fulfill({ path: THREE + '/examples/js/loaders/GLTFLoader.js', contentType: 'application/javascript' }));
  }
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(GAME, { timeout: 180000 });
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 240000 });
  return page;
}

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
  await page.waitForTimeout(250);
  return !!hit && hit.free;
};

// Toca una casilla del mapa que cumpla la condición (la más cerca de tu Núcleo que se vea y no la tape un botón).
const tapCell = async (page, cond, skip = []) => {
  const at = await page.evaluate(([src, skipIds]) => {
    const ok = new Function('c', 'g', 'return (' + src + ')(c, g);');
    const g = FARO.game;
    const R = FARO.renderer;
    const core = g.cells[g.players[0].core.cell];
    const cands = g.cells.filter((c) => !skipIds.includes(c.i) && ok(c, g)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core));
    for (const c of cands.slice(0, 400)) {
      const p = R.project(c.x, Math.max(c.h, 0), c.z);
      if (!p.ok || p.x < 20 || p.y < 20 || p.x > innerWidth - 20 || p.y > innerHeight - 20) continue;
      const top = document.elementFromPoint(p.x, p.y);
      if (!top || top.tagName !== 'CANVAS') continue;
      const back = R.pickCell(p.x, p.y);
      if (back && back.i === c.i) return { x: p.x, y: p.y, ci: c.i };
    }
    return null;
  }, [cond.toString(), skip]);
  if (at) {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(350);
  }
  return at;
};

const lastToast = (page) => page.evaluate(() => [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent.trim()).pop() || '');
const placeText = (page) => page.evaluate(() => { const b = document.getElementById('placebar'); return b && !b.hidden ? document.getElementById('placetext').textContent.replace(/\s+/g, ' ').trim() : ''; });
const openLab = async (page) => {
  const shown = await page.evaluate(() => !document.getElementById('labpop').hidden);
  if (!shown) await tapBtn(page, '#btn-lab');
  return page.evaluate(() => !document.getElementById('labpop').hidden);
};
const count = (page, owner, type) => page.evaluate(([o, t]) => FARO.game.units.filter((u) => u.alive && u.owner === o && u.type === t && !u.dummy).length, [owner, type]);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const run = async (id, fn) => {
    try { await fn(); } catch (e) { add(id, false, 'la prueba se cortó: ' + String(e.message || e).split('\n')[0].slice(0, 300)); }
  };
  const page = await open(browser, 1180, 820);
  const ver = await page.evaluate(() => GAME_VERSION);

  // ---------- Entrar al Campo de pruebas desde el vestíbulo ----------
  await tapBtn(page, '[data-act="modal"][data-m="modes"]');
  await page.waitForTimeout(500);
  await tapBtn(page, '[data-act="pickmode"][data-v="sandbox"]');
  await page.waitForTimeout(400);
  await tapBtn(page, '#btn-play');
  await page.waitForFunction(() => FARO.state === 'play', null, { timeout: 180000 });
  await page.waitForTimeout(1500);

  await run('lab-boton', async () => {
    const s = await page.evaluate(() => {
      const b = document.getElementById('btn-lab');
      const r = b.getBoundingClientRect();
      return { sandbox: !!FARO.game.mode.sandbox, lab: !!FARO.game.lab, hidden: b.hidden, w: Math.round(r.width), h: Math.round(r.height),
        toasts: [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent.trim()).join(' | ') };
    });
    const hint = /matraz|flask/i.test(s.toasts);
    add('lab-boton', s.sandbox && s.lab && !s.hidden && s.w >= 44 && s.h >= 44 && hint,
      `Campo de pruebas: botón del matraz visible (${!s.hidden}), ${s.w}×${s.h} px; aviso al entrar: «${s.toasts.slice(0, 140)}»`);
  });

  // ---------- Panel ----------
  let panelText = '';
  await run('lab-panel', async () => {
    const shown = await openLab(page);
    const s = await page.evaluate(() => {
      const el = document.getElementById('labpop');
      const r = el.getBoundingClientRect();
      const small = [...el.querySelectorAll('button, input')].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.height < 44; }).length;
      const units = el.querySelectorAll('[data-lab="unit"]').length;
      const need = arsenalItems().filter((it) => it.kind === 'unit').length;
      const head = [...el.querySelectorAll('.lbl')].map((x) => x.textContent.trim());
      return { text: el.innerText, small, units, need, types: Object.keys(UNITS).length, head, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1 };
    });
    panelText = s.text;
    const head = s.head.find((t) => /\d+/.test(t)) || '';
    add('lab-panel', shown && s.units === s.need && head.includes(String(s.types)) && s.small === 0 && s.inView,
      `se abre con el matraz (${shown}); secciones: ${s.head.join(' / ')}; ${s.units} tropas para crear de ${s.need}; botones de menos de 44 px: ${s.small}; dentro de la pantalla: ${s.inView}`);
  });

  // ---------- Buscador y familias ----------
  await run('lab-buscar', async () => {
    const q = LANG === 'en' ? 'tank' : 'tanque';
    await page.fill('#lab-search', q);
    await page.waitForTimeout(300);
    const a = await page.evaluate(() => [...document.querySelectorAll('#lab-units [data-lab="unit"] b')].map((b) => b.textContent));
    await page.fill('#lab-search', 'zzzz');
    await page.waitForTimeout(300);
    const empty = await page.evaluate(() => (document.querySelector('#lab-units .empty') || {}).textContent || '');
    await page.fill('#lab-search', '');
    await page.waitForTimeout(300);
    await tapBtn(page, '#lab-fam [data-v="sea"]');
    const sea = await page.evaluate(() => [...document.querySelectorAll('#lab-units [data-lab="unit"]')].map((b) => UNITS[b.dataset.v].mover));
    await tapBtn(page, '#lab-fam [data-v="all"]');
    const okSea = sea.length > 0 && sea.every((m) => m === 'sea' || m === 'amphib');
    add('lab-buscar', a.length > 0 && a.every((n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)) && empty.includes('zzzz') && okSea,
      `«${q}»: ${a.length} (${a.slice(0, 4).join(', ')}); sin resultados: «${empty}»; filtro de mar: ${sea.length} tropas, todas de agua (${okSea})`);
  });

  // ---------- Velocidad ----------
  await run('lab-velocidad', async () => {
    await openLab(page);
    await tapBtn(page, '#lab-speed [data-v="0"]');
    const t0 = await page.evaluate(() => FARO.game.time);
    await page.waitForTimeout(2000);
    const t1 = await page.evaluate(() => FARO.game.time);
    await tapBtn(page, '#lab-speed [data-lab="step"]');
    const t2 = await page.evaluate(() => FARO.game.time);
    const tag0 = await page.evaluate(() => ({ hidden: document.getElementById('lab-speedtag').hidden, t: document.getElementById('lab-speedtag').textContent }));
    await tapBtn(page, '#lab-speed [data-v="2"]');
    const tag2 = await page.evaluate(() => ({ hidden: document.getElementById('lab-speedtag').hidden, t: document.getElementById('lab-speedtag').textContent }));
    // Cuánto avanza el reloj de la partida con un mismo cuadro de 0,05 s en cada velocidad (sin esperar cuadros reales).
    const steps = await page.evaluate(() => {
      const g = FARO.game;
      const out = {};
      for (const k of [0.5, 1, 2, 4]) {
        g.lab.speed = k;
        const a = g.time;
        g.update(0.05);
        out[k] = Math.round((g.time - a) * 1000) / 1000;
      }
      g.lab.speed = 1;
      FARO.ui.labSpeedTag();
      return out;
    });
    await tapBtn(page, '#lab-speed [data-v="1"]');
    const tag1 = await page.evaluate(() => document.getElementById('lab-speedtag').hidden);
    const ok = t1 === t0 && Math.abs(t2 - t1 - 0.1) < 1e-6 && !tag0.hidden && tag0.t === 'II' && !tag2.hidden && tag2.t === '2×' && tag1 &&
      steps[0.5] === 0.025 && steps[1] === 0.05 && steps[2] === 0.1 && steps[4] === 0.2;
    add('lab-velocidad', ok, `en pausa el reloj no avanza (${t0.toFixed(2)} → ${t1.toFixed(2)}); «+1 paso» avanza ${(t2 - t1).toFixed(2)} s; marca del botón: pausa «${tag0.t}», 2× «${tag2.t}», 1× sin marca (${tag1}); con un cuadro de 0,05 s: 0,5× ${steps[0.5]} s, 1× ${steps[1]}, 2× ${steps[2]}, 4× ${steps[4]}`);
  });

  // ---------- Crear tropas tocando el mapa ----------
  const land = (c, g) => c.land && !c.bld && g.passable(c, 'land', 0) && !g.units.some((u) => u.alive && u.cell === c.i);
  const water = (c, g) => !c.land && g.passable(c, 'sea', 0) && !g.units.some((u) => u.alive && u.cell === c.i);
  const used = [];
  await run('lab-crear', async () => {
    const parts = [];
    let pass = true;
    // Una tropa tuya.
    await openLab(page);
    await tapBtn(page, '[data-lab="team"][data-v="0"]');
    await tapBtn(page, '[data-lab="n"][data-v="1"]');
    const r0 = await count(page, 0, 'rifle');
    await tapBtn(page, '#lab-units [data-v="rifle"]');
    const closed = await page.evaluate(() => document.getElementById('labpop').hidden);
    const bar0 = await placeText(page);
    const c1 = await tapCell(page, land, used);
    if (c1) used.push(c1.ci);
    const r1 = await count(page, 0, 'rifle');
    const bar1 = await placeText(page);
    const c2 = await tapCell(page, land, used);
    if (c2) used.push(c2.ci);
    const r2 = await count(page, 0, 'rifle');
    const bar2 = await placeText(page);
    await tapBtn(page, '#btn-place-cancel');
    const off = await page.evaluate(() => !FARO.input.placement);
    const ok1 = closed && r1 === r0 + 1 && r2 === r0 + 2 && /1 vez|once/.test(bar1) && /2 veces|2 times/.test(bar2) && off;
    if (!ok1) pass = false;
    parts.push(`${await page.evaluate(() => UNITS.rifle.name)} (rifle) tuyo: el panel se cierra (${closed}), barra «${bar0.slice(0, 80)}»; 1.er toque ${r0} → ${r1} («${bar1.slice(-16)}»), 2.º toque → ${r2} («${bar2.slice(-16)}»), «Terminar» sale (${off})`);
    // Cinco de golpe.
    await openLab(page);
    await tapBtn(page, '[data-lab="n"][data-v="5"]');
    const k0 = await count(page, 0, 'tank');
    await tapBtn(page, '#lab-units [data-v="tank"]');
    const c3 = await tapCell(page, land, used);
    if (c3) used.push(c3.ci);
    const k1 = await count(page, 0, 'tank');
    await tapBtn(page, '#btn-place-cancel');
    if (k1 !== k0 + 5) pass = false;
    parts.push(`×5 ${await page.evaluate(() => UNITS.tank.name)}: ${k0} → ${k1}`);
    // Un barco en tierra: no se crea y dice por qué.
    await openLab(page);
    await tapBtn(page, '[data-lab="n"][data-v="1"]');
    const d0 = await count(page, 0, 'destroyer');
    await tapBtn(page, '#lab-units [data-v="destroyer"]');
    await tapCell(page, land, used);
    const why = await lastToast(page);
    const d1 = await count(page, 0, 'destroyer');
    const cw = await tapCell(page, water, used);
    const d2 = await count(page, 0, 'destroyer');
    await tapBtn(page, '#btn-place-cancel');
    if (!(d1 === d0 && /agua|water/i.test(why) && (!cw || d2 === d0 + 1))) pass = false;
    parts.push(`${await page.evaluate(() => UNITS.destroyer.name)} en tierra: no se crea (${d0} → ${d1}), aviso «${why}»; en el agua: ${cw ? `${d0} → ${d2}` : 'no hubo agua a la vista'}`);
    // Una del rival.
    await openLab(page);
    await tapBtn(page, '[data-lab="team"][data-v="1"]');
    const e0 = await count(page, 1, 'rifle');
    await tapBtn(page, '#lab-units [data-v="rifle"]');
    const barR = await placeText(page);
    const c4 = await tapCell(page, land, used);
    if (c4) used.push(c4.ci);
    const e1 = await count(page, 1, 'rifle');
    await tapBtn(page, '#btn-place-cancel');
    await openLab(page);
    await tapBtn(page, '[data-lab="team"][data-v="0"]');
    if (e1 !== e0 + 1 || !/rival/i.test(barR)) pass = false;
    parts.push(`${await page.evaluate(() => UNITS.rifle.name)} del rival: ${e0} → ${e1} («${barR.slice(0, 60)}»)`);
    add('lab-crear', pass, parts.join(' · '));
  });

  // ---------- Dianas ----------
  await run('lab-dianas', async () => {
    await openLab(page);
    for (const k of ['inf', 'veh', 'air', 'ship', 'sub']) await tapBtn(page, `[data-lab="dummy"][data-v="${k}"]`);
    const toast = await lastToast(page);
    const s0 = await page.evaluate(() => {
      const g = FARO.game;
      const core = g.cells[g.players[0].core.cell];
      return g.units.filter((u) => u.alive && u.dummy).map((u) => ({ id: u.id, owner: u.owner, type: u.type, x: u.x, z: u.z, d: g.map.dist(g.cells[u.cell], core) }));
    });
    // Un rival normal a su lado sí se mueve con el tiempo; las dianas no: se dejan correr 3 s de partida.
    await page.evaluate(() => { const g = FARO.game; for (let i = 0; i < 30; i++) g.update(0.1); });
    const s1 = await page.evaluate((ids) => ids.map((id) => { const u = FARO.game.units.find((x) => x.id === id); return u ? { x: u.x, z: u.z, alive: u.alive, target: !!u.target } : null; }), s0.map((u) => u.id));
    const still = s1.every((u, i) => u && u.alive && Math.abs(u.x - s0[i].x) < 1e-6 && Math.abs(u.z - s0[i].z) < 1e-6 && !u.target);
    // Daño: no se rompen, cuentan el total y por segundo; tu tropa suma a «Daño hecho».
    const dmg = await page.evaluate(() => {
      const g = FARO.game;
      const d = g.units.find((u) => u.alive && u.dummy);
      const me = g.units.find((u) => u.alive && u.owner === 0 && u.type === 'rifle');
      const hp0 = d.hp;
      // El combate de verdad ya pudo pegarle: se mide lo que suman estos dos golpes.
      const before = d.labDmg || 0;
      const dealt0 = g.lab.dealt.rifle || 0;
      g.damage(d, 1000000, 0, me);
      g.damage(d, 50, 0, me);
      FARO.ui.renderLab();
      const rows = document.querySelectorAll('#lab-stats tbody tr').length;
      const dealt = document.getElementById('lab-dealt').textContent;
      return { alive: d.alive, hp: d.hp === hp0, total: d.labDmg - before, dps: Math.round(g.labDps(d)), rows, dealtRifle: (g.lab.dealt.rifle || 0) - dealt0, rifleName: UNITS.rifle.name, dealtShown: dealt.includes(UNITS.rifle.name) };
    });
    const dists = s0.map((u) => u.d);
    const ok = s0.length === 5 && s0.every((u) => u.owner === 1) && dists.every((d) => d >= 6 && d <= 10) && still && dmg.alive && dmg.hp && dmg.total === 1000050 &&
      dmg.dps > 0 && dmg.rows === 5 && dmg.dealtRifle === 1000050 && dmg.dealtShown;
    add('lab-dianas', ok, `5 dianas del rival (${s0.map((u) => u.type).join(', ')}) a ${Math.min(...dists)}-${Math.max(...dists)} casillas de tu Núcleo; aviso «${toast}»; ` +
      `en 3 s de partida no se mueven ni apuntan (${still}); con dos golpes de 1.000.000 y 50 siguen vivas (${dmg.alive}) y con la misma vida (${dmg.hp}); los dos golpes suman ${dmg.total} a su total, por segundo ${dmg.dps}; ` +
      `tabla con ${dmg.rows} filas; «Daño hecho»: ${dmg.rifleName} ${Math.round(dmg.dealtRifle)} (en el panel: ${dmg.dealtShown})`);
  });

  // ---------- Reglas: recursos, obras al instante, sin perder vida, bots ----------
  await run('lab-reglas', async () => {
    await openLab(page);
    const parts = [];
    const res1 = await page.evaluate(() => { const g = FARO.game; g.players[0].coins = 10; g.update(0.1); return Math.round(g.players[0].coins); });
    await tapBtn(page, '#lab-toggles [data-k="res"]');
    const res2 = await page.evaluate(() => { const g = FARO.game; g.players[0].coins = 10; g.update(0.1); return Math.round(g.players[0].coins); });
    await tapBtn(page, '#lab-toggles [data-k="res"]');
    parts.push(`recursos de sobra: con 10 monedas vuelve a ${res1}; apagado queda en ${res2}`);
    // Obras al instante.
    const build = async () => page.evaluate(() => {
      const g = FARO.game;
      const core = g.cells[g.players[0].core.cell];
      const c = g.cells.filter((x) => !g.placeInvalid(0, 'house', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
      const b = g.addBuilding(0, 'house', c.i, false);
      g.update(0.1);
      const built = !!b.built;
      g.kill(b);
      return built;
    });
    const slow = await build();
    await tapBtn(page, '#lab-toggles [data-k="instant"]');
    const fast = await build();
    await tapBtn(page, '#lab-toggles [data-k="instant"]');
    parts.push(`obras al instante: una Casa nueva queda hecha en 0,1 s apagado ${slow}, encendido ${fast}`);
    // Sin perder vida.
    const hurt = async () => page.evaluate(() => {
      const g = FARO.game;
      const core = g.cells[g.players[0].core.cell];
      const far = g.cells.filter((c) => c.land && !c.bld && g.passable(c, 'land', 0) && g.map.dist(c, core) >= 12).sort((a, b) => g.map.dist(b, core) - g.map.dist(a, core));
      const mine = g.labSpawn('tank', 0, far[0].i, 1).units[0];
      const foe = g.labSpawn('rifle', 1, far[1].i, 1).units[0];
      const life = (u) => u.hp + (u.shield || 0);
      const a = [life(mine), life(foe)];
      g.damage(mine, 30, 1, foe);
      g.damage(foe, 30, 0, mine);
      const b = [life(mine), life(foe)];
      for (const u of [mine, foe]) { u.alive = false; g.removed.push(u); }
      g.units = g.units.filter((u) => u.alive);
      return [b[0] < a[0], b[1] < a[1]];
    });
    const h0 = await hurt();
    await tapBtn(page, '#lab-toggles [data-k="inv0"]');
    const h1 = await hurt();
    await tapBtn(page, '#lab-toggles [data-k="inv1"]');
    const h2 = await hurt();
    await tapBtn(page, '#lab-toggles [data-k="inv0"]');
    await tapBtn(page, '#lab-toggles [data-k="inv1"]');
    const h3 = await hurt();
    parts.push(`pierden vida (tú, rival): normal ${h0}, «Tú no pierdes vida» ${h1}, las dos ${h2}, apagadas ${h3}`);
    // Bots del rival.
    await tapBtn(page, '#lab-toggles [data-k="ai"]');
    const ai1 = await page.evaluate(() => FARO.game.bots.map((b) => b.pid));
    await tapBtn(page, '#lab-toggles [data-k="ai"]');
    const ai0 = await page.evaluate(() => FARO.game.bots.map((b) => b.pid));
    parts.push(`bots del rival: encendidos ${JSON.stringify(ai1)}, apagados ${JSON.stringify(ai0)}`);
    const pressed = await page.evaluate(() => [...document.querySelectorAll('#lab-toggles [data-lab="toggle"]')].map((b) => b.dataset.k + '=' + b.getAttribute('aria-pressed')).join(' '));
    const ok = res1 === 500000 && res2 < 500000 && !slow && fast && h0[0] && h0[1] && !h1[0] && h1[1] && !h2[0] && !h2[1] && h3[0] && h3[1] &&
      ai1.includes(1) && !ai0.includes(1) && pressed === 'res=true instant=false inv0=false inv1=false ai=false';
    parts.push(`botones al final: ${pressed}`);
    add('lab-reglas', ok, parts.join(' · '));
  });

  // ---------- Guardar y volver: el Laboratorio y las dianas siguen ----------
  await run('lab-guardado', async () => {
    const s = await page.evaluate(() => {
      const g = FARO.game;
      g.lab.speed = 2;
      const data = JSON.parse(JSON.stringify(Save.serialize(g)));
      g.lab.speed = 1;
      const h = Save.deserialize(data);
      const d0 = g.units.filter((u) => u.alive && u.dummy).map((u) => u.id + ':' + u.labDmg).sort().join(',');
      const d1 = h.units.filter((u) => u.alive && u.dummy).map((u) => u.id + ':' + u.labDmg).sort().join(',');
      return { lab: !!h.lab, speed: h.lab && h.lab.speed, res: h.lab && h.lab.res, log: h.lab ? h.lab.log.length : 0, same: d0 === d1 && d0.length > 0, n: h.units.filter((u) => u.dummy).length };
    });
    add('lab-guardado', s.lab && s.speed === 2 && s.res && s.log > 0 && s.same && s.n === 5,
      `partida guardada y vuelta a abrir: Laboratorio ${s.lab}, velocidad ${s.speed}×, recursos de sobra ${s.res}, registro con ${s.log} líneas, las ${s.n} dianas con su daño igual (${s.same})`);
  });

  // ---------- Mover al instante ----------
  await run('lab-mover', async () => {
    await page.evaluate(() => { FARO.ui.togglePop(null); });
    await openLab(page);
    await tapBtn(page, '[data-lab="tp"]');
    const noSel = await lastToast(page);
    const ids = await page.evaluate(() => {
      const g = FARO.game;
      const sel = g.units.filter((u) => u.alive && u.owner === 0 && u.type === 'tank').slice(0, 3);
      FARO.setSelection(sel);
      return sel.map((u) => ({ id: u.id, cell: u.cell }));
    });
    await openLab(page);
    await tapBtn(page, '[data-lab="tp"]');
    const bar = await placeText(page);
    const at = await tapCell(page, (c, g) => c.land && !c.bld && g.passable(c, 'land', 0) && g.map.dist(c, g.cells[g.players[0].core.cell]) >= 3, used);
    const after = await page.evaluate((list) => list.map((x) => { const u = FARO.game.units.find((v) => v.id === x.id); return u.cell; }), ids);
    const dist = await page.evaluate(([cells, ci]) => cells.map((c) => FARO.game.map.dist(FARO.game.cells[c], FARO.game.cells[ci])), [after, at ? at.ci : 0]);
    const toast = await lastToast(page);
    const ok = /Elige|select/i.test(noSel) && ids.length === 3 && !!at && dist.every((d) => d <= 3) && new Set(after).size === 3 && /3/.test(toast);
    add('lab-mover', ok, `sin tropas elegidas avisa «${noSel}»; con 3 Tanques: barra «${bar.slice(0, 70)}», tras tocar el mapa quedan a ${dist.join(', ')} casillas del toque, en casillas distintas; aviso «${toast}»`);
  });

  // ---------- Quitar y registro ----------
  await run('lab-quitar', async () => {
    await openLab(page);
    await tapBtn(page, '#lab-speed [data-v="0"]');
    await tapBtn(page, '[data-lab="resetstats"]');
    const zero = await page.evaluate(() => FARO.game.units.filter((u) => u.alive && u.dummy).every((u) => u.labDmg === 0) && Object.keys(FARO.game.lab.dealt).length === 0);
    await tapBtn(page, '[data-lab="cleardummies"]');
    await tapBtn(page, '#lab-speed [data-v="1"]');
    const nd = await page.evaluate(() => FARO.game.units.filter((u) => u.alive && u.dummy).length);
    const before = await page.evaluate(() => FARO.game.units.filter((u) => u.alive).length);
    await tapBtn(page, '[data-lab="clearall"]');
    const armed = await page.evaluate(() => ({ t: document.querySelector('[data-lab="clearall"]').textContent, n: FARO.game.units.filter((u) => u.alive).length }));
    await tapBtn(page, '[data-lab="clearall"]');
    const left = await page.evaluate(() => {
      const g = FARO.game;
      const alive = g.units.filter((u) => u.alive);
      return { n: alive.length, builders: alive.every((u) => u.owner === 0 && u.def.builds), log: [...document.querySelectorAll('#lab-log li')].map((li) => li.textContent) };
    });
    const ok = zero && nd === 0 && armed.n === before && /Seguro|Sure/i.test(armed.t) && left.n > 0 && left.builders && left.log.length === 8;
    add('lab-quitar', ok, `«Contadores a cero» (${zero}); «Quitar dianas»: quedan ${nd}; «Quitar todas las tropas» pide otro toque («${armed.t}», siguen ${armed.n} de ${before}) y después quedan ${left.n}, solo tus constructores (${left.builders}); ` +
      `registro (últimas 8): ${left.log.slice(0, 4).join(' / ')}`);
  });

  // ---------- En una partida normal no hay Laboratorio ----------
  await run('lab-normal', async () => {
    await page.evaluate(() => { FARO.toMenu(); FARO.opts.mode = 'ffa'; delete FARO.opts.custom; FARO.makePreview(); FARO.startGame(); });
    await page.waitForFunction(() => FARO.state === 'play', null, { timeout: 180000 });
    const s = await page.evaluate(() => {
      const g = FARO.game;
      const a = g.time;
      g.update(0.05);
      return { lab: !!g.lab, hidden: document.getElementById('btn-lab').hidden, step: Math.round((g.time - a) * 1000) / 1000, mode: g.mode.name };
    });
    add('lab-normal', !s.lab && s.hidden && s.step === 0.05, `«${s.mode}»: sin Laboratorio (${!s.lab}), sin botón del matraz (${s.hidden}), el reloj avanza normal (${s.step} s por cuadro de 0,05 s)`);
  });

  // ---------- Pantallas chicas ----------
  await run('lab-pantallas', async () => {
    const parts = [];
    let pass = true;
    for (const [name, w, h] of [['celular horizontal', 844, 390], ['Poki 640×360', 640, 360], ['iPad vertical', 820, 1180]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.evaluate(() => { FARO.toMenu(); FARO.opts.mode = 'sandbox'; delete FARO.opts.custom; FARO.makePreview(); FARO.startGame(); });
      await page.waitForFunction(() => FARO.state === 'play', null, { timeout: 180000 });
      await page.waitForTimeout(1200);
      const free = await tapBtn(page, '#btn-lab');
      const s = await page.evaluate(() => {
        const el = document.getElementById('labpop');
        const r = el.getBoundingClientRect();
        const small = [...el.querySelectorAll('button, input')].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.height < 44; }).length;
        return { open: !el.hidden, inView: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, scrolls: el.scrollHeight > el.clientHeight, sideways: document.documentElement.scrollWidth > innerWidth, small };
      });
      const ok = free && s.open && s.inView && !s.sideways && s.small === 0;
      if (!ok) pass = false;
      parts.push(`${name}: matraz libre ${free}, panel dentro de la pantalla ${s.inView}${s.scrolls ? ' (se desplaza)' : ''}, sin desplazamiento lateral ${!s.sideways}, botones chicos ${s.small}`);
    }
    await page.setViewportSize({ width: 1180, height: 820 });
    add('lab-pantallas', pass, parts.join(' · '));
  });

  add('errores', page.errs.length === 0, page.errs.length ? page.errs.slice(0, 5).join(' | ') : 'sin errores en la consola');
  await page.context().close();
  await browser.close();
  const failed = results.filter((r) => !r.ok).map((r) => r.id);
  fs.writeFileSync(OUT, JSON.stringify({ game: GAME, version: ver, lang: LANG, ok: failed.length === 0, failed, panelText, results }, null, 1));
  console.log(failed.length ? `❌ fallan: ${failed.join(', ')}` : '✅ Laboratorio: todo bien');
})();
