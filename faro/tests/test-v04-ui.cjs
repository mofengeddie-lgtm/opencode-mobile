const H = require('./helpers.cjs');
// Pruebas de interfaz del PRD v0.4 (A10–A15 y diseño de A16) en Chromium.
const { chromium } = require('playwright');
const SP = process.env.SP;
const results = [];
const check = (id, name, ok, extra = '') => results.push({ ok: !!ok, text: `${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${extra}` });

async function newPage(browser, w = 1180, h = 820) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) page.errors.push(m.text()); });
  await page.route('**/three.min.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/build/three.min.js', contentType: 'application/javascript' }));
  await H.routes(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('file:///home/user/opencode-mobile/faro/faro.html');
  await H.compat(page);
  await page.waitForTimeout(600);
  return page;
}
async function start(page, mode = 'ffa') {
  await page.evaluate((m) => { const a = window.FARO; a.setOption('mode', m); a.setOption('mapKind', 'archipelago'); a.startGame(); }, mode);
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.FARO.game.bots.forEach((b) => { b.update = () => {}; }); });
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const errors = [];
  const page = await newPage(browser);
  await start(page);

  // ---------- A10: alertas con «Ver» y pulso en el minimapa ----------
  const spot = await page.evaluate(() => {
    const app = window.FARO; const g = app.game; const me = g.players[0];
    me.coins = 50000;
    const c = g.cells.find((x) => x.owner === 0 && !g.placeInvalid(0, 'farm', x.i) && g.map.dist(x, g.cells[me.core.cell]) >= 3);
    g.place(0, 'farm', c.i);
    const farm = g.buildings.find((b) => b.type === 'farm' && b.owner === 0);
    farm.built = true;
    app.renderer.cam.tx = 999; app.renderer.cam.tz = 999;
    g.damage(farm, 10, 1, { cls: 'inf', type: 'rifle', owner: 1 });
    return { x: farm.x, z: farm.z };
  });
  await page.waitForTimeout(300);
  const btn = page.locator('.toast button', { hasText: 'Ver' }).first();
  const hasBtn = await btn.count();
  if (hasBtn) await btn.click();
  await page.waitForTimeout(150);
  const cam = await page.evaluate(() => ({ tx: window.FARO.renderer.cam.tx, tz: window.FARO.renderer.cam.tz, pings: window.FARO.renderer.pings.length }));
  check('A10', 'un ataque a tu edificio muestra un aviso con «Ver»', hasBtn > 0);
  check('A10', '«Ver» lleva la cámara al lugar del ataque', Math.hypot(cam.tx - spot.x, cam.tz - spot.z) < 0.5, JSON.stringify({ cam: [cam.tx.toFixed(1), cam.tz.toFixed(1)], spot: [spot.x.toFixed(1), spot.z.toFixed(1)] }));
  check('A10', 'el minimapa marca el lugar con un pulso', cam.pings >= 1, `${cam.pings} pulsos`);
  await page.evaluate(() => { const g = window.FARO.game; const c = g.players[1].core; g.say(1, '¡Prepárate, voy por ti!', { toMe: true, kind: 'bad', x: c.x, z: c.z, force: true }); });
  // El mensaje se dibuja en el siguiente cuadro; en el emulador sin GPU un cuadro tarda ~0,5 s.
  await page.waitForFunction(() => /voy por ti/.test(document.getElementById('feed').textContent), null, { timeout: 5000 }).catch(() => {});
  const feed = await page.evaluate(() => ({ n: document.querySelectorAll('#feed .msg').length, text: document.getElementById('feed').textContent, ver: document.querySelectorAll('#feed .msg button').length }));
  check('A10', 'el mensaje de ataque de un bot aparece en el panel con «Ver»', feed.n >= 1 && /voy por ti/.test(feed.text) && feed.ver >= 1, feed.text.trim().slice(0, 60));
  await page.screenshot({ path: SP + '/shots/80-alerts.png' });

  // ---------- A11: ficha de unidad con pulsación larga ----------
  await page.evaluate(() => {
    const app = window.FARO; const g = app.game; const me = g.players[0];
    const c = g.cells.find((x) => x.owner === 0 && !g.placeInvalid(0, 'barracks', x.i));
    g.place(0, 'barracks', c.i);
    const b = g.buildings.find((x) => x.type === 'barracks' && x.owner === 0);
    b.built = true; b.progress = 1; b.hp = b.maxHp;
    app.renderer.cam.tx = b.x; app.renderer.cam.tz = b.z; app.renderer.updateCamera();
    app.paused = true;
    app.setSelection([b]);
  });
  await page.waitForTimeout(300);
  const card = page.locator('.card[data-type="rocket"]');
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterPress = await page.evaluate(() => ({
    queue: window.FARO.game.buildings.find((x) => x.type === 'barracks' && x.owner === 0).queue.length,
    info: !document.getElementById('cardinfo').hidden, text: document.getElementById('cardinfo').textContent,
  }));
  check('A11', 'mantener pulsada la tarjeta muestra la ficha sin entrenar', afterPress.queue === 0 && afterPress.info && /Daño\/s/.test(afterPress.text) && /Fuerte contra/.test(afterPress.text), afterPress.text.replace(/\s+/g, ' ').slice(0, 90));
  await page.screenshot({ path: SP + '/shots/81-cardinfo.png' });
  await page.locator('.card[data-type="rifle"]').scrollIntoViewIfNeeded();
  const box2 = await page.locator('.card[data-type="rifle"]').boundingBox();
  await page.touchscreen.tap(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.waitForTimeout(200);
  const q2 = await page.evaluate(() => window.FARO.game.buildings.find((x) => x.type === 'barracks' && x.owner === 0).queue.length);
  check('A11', 'un toque normal sí entrena', q2 === 1, 'cola=' + q2);

  // ---------- A15: indicador de producción ----------
  await page.evaluate(() => { window.FARO.paused = false; });
  // Se espera a que un cuadro nuevo dibuje el indicador (en el emulador sin GPU un cuadro tarda ~0,5 s).
  await page.waitForFunction(() => window.FARO.renderer.prodBadges === 1, null, { timeout: 5000 }).catch(() => {});
  const badge1 = await page.evaluate(() => window.FARO.renderer.prodBadges);
  await page.screenshot({ path: SP + '/shots/82-prodbadge.png' });
  await page.evaluate(() => { const g = window.FARO.game; for (let i = 0; i < 70; i++) g.update(0.1); });
  await page.waitForFunction(() => window.FARO.renderer.prodBadges === 0, null, { timeout: 5000 }).catch(() => {});
  const badge2 = await page.evaluate(() => window.FARO.renderer.prodBadges);
  console.log('colas', await page.evaluate(() => JSON.stringify(window.FARO.game.buildings.filter((b) => b.owner === 0 && b.queue.length).map((b) => ({ t: b.type, built: b.built, q: b.queue.map((x) => x.type + ':' + (x.t || 0).toFixed(1)), pop: window.FARO.game.players[0].popUsed + '/' + window.FARO.game.players[0].popCap })))));
  check('A15', 'el indicador aparece mientras entrena y desaparece al vaciar la cola', badge1 === 1 && badge2 === 0, `durante=${badge1} después=${badge2}`);

  // ---------- A14: círculo de alcance ----------
  const ring = await page.evaluate(() => {
    const app = window.FARO; const g = app.game;
    const u = g.units.find((x) => x.owner === 0 && x.type === 'rifle');
    app.setSelection([u]);
    app.renderer.frame(0.016, 1, app.selection);
    const r1 = { visible: app.renderer.rangeRing.visible, radius: app.renderer.rangeRing.userData.radius };
    app.setSelection([]);
    app.renderer.frame(0.016, 1, app.selection);
    return { ...r1, hidden: !app.renderer.rangeRing.visible, expected: 3 * Math.sqrt(3) + 0.35 };
  });
  check('A14', 'el círculo coincide con el alcance del Fusilero y se oculta al deseleccionar', ring.visible && Math.abs(ring.radius - ring.expected) < 1e-6 && ring.hidden, JSON.stringify(ring));
  await page.evaluate(() => { const app = window.FARO; app.setSelection([app.game.units.find((x) => x.owner === 0 && x.type === 'rifle')]); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/83-range.png' });

  // ---------- A12: desglose de economía ----------
  await page.evaluate(() => {
    const g = window.FARO.game; const me = g.players[0];
    const faro = g.points.find((p) => p.type === 'faro');
    faro.owner = 0; faro.prog = 1; g.territoryDirty = true;
    for (let i = 0; i < 2; i++) { const c = g.cells.find((x) => x.owner === 0 && !g.placeInvalid(0, 'farm', x.i)); g.place(0, 'farm', c.i); }
    for (const b of g.buildings) if (b.owner === 0) { b.built = true; b.progress = 1; }
    g.refreshEconomy();
  });
  await page.waitForTimeout(400);
  await page.click('.stat.coins');
  await page.waitForTimeout(200);
  const econ = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#econ tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
    const num = (t) => Number(t.replace(/[^\d-]/g, ''));
    const items = rows.filter((r) => !/Subtotal|Faro|Total/.test(r[0]));
    const sumItems = items.reduce((s, r) => s + num(r[1]), 0);
    const total = num(rows.find((r) => r[0] === 'Total')[1]);
    const hud = num(document.getElementById('income').textContent);
    const faroRow = rows.find((r) => /^Faro/.test(r[0]));
    return { visible: !document.getElementById('econ').hidden, sumItems, total, hud, faro: faroRow ? num(faroRow[1]) : 0, rows: rows.map((r) => r.join(' ')).join(' | ') };
  });
  check('A12', 'el desglose suma lo mismo que la barra superior (con el bono del Faro)',
    econ.visible && econ.total === econ.hud && econ.sumItems + econ.faro === econ.total && econ.faro > 0, econ.rows);
  await page.screenshot({ path: SP + '/shots/84-econ.png' });
  await page.click('#econ [data-close]');
  const econClosed = await page.evaluate(() => document.getElementById('econ').hidden);
  await page.click('.stat.energy');
  await page.waitForTimeout(150);
  const energyPop = await page.evaluate(() => document.getElementById('econ').textContent);
  check('A12', 'se cierra con la X y la energía tiene su propio resumen', econClosed && /Solar|Eólica|Hidráulica|Mareomotriz|Undimotriz|Sin energías/.test(energyPop) && /Disponible/.test(energyPop), energyPop.replace(/\s+/g, ' ').slice(0, 120));
  await page.click('#econ [data-close]');

  // ---------- A13: marcador ----------
  await page.click('#players');
  await page.waitForTimeout(250);
  const score = await page.evaluate(() => ({
    visible: !document.getElementById('score').hidden,
    rows: document.querySelectorAll('#score tbody tr').length,
    text: document.getElementById('score').textContent,
  }));
  const personas = ['Agresivo', 'Constructor', 'Almirante', 'Guardián del Faro'].filter((n) => score.text.includes(n)).length;
  check('A13', 'el marcador muestra 4 filas con la personalidad de cada bot', score.visible && score.rows === 4 && personas === 3, `${score.rows} filas, ${personas} personalidades`);
  await page.screenshot({ path: SP + '/shots/85-score.png' });
  await page.click('#score [data-close]');
  check('A13', 'el marcador se cierra', await page.evaluate(() => document.getElementById('score').hidden));
  errors.push(...page.errors);
  await page.context().close();

  // ---------- A16: diseño con el panel de mensajes y los paneles nuevos ----------
  const sizes = [['iPad horizontal 4:3', 1180, 820], ['16:9', 1280, 720], ['iPad vertical', 820, 1180], ['celular horizontal', 844, 390], ['celular vertical', 390, 844]];
  const bad = [];
  for (const [name, w, h] of sizes) {
    const pg = await newPage(browser, w, h);
    await start(pg, 'king');
    await pg.evaluate(() => {
      const a = window.FARO; const g = a.game;
      for (let i = 0; i < 4; i++) g.say(1 + (i % 3), 'Mensaje de prueba número ' + i + ' con algo de texto', { toMe: true, kind: 'bad', x: 0, z: 0, force: true });
      a.setSelection([g.players[0].core]);
    });
    await pg.waitForTimeout(400);
    const issues = await pg.evaluate(() => {
      const ids = ['objectives', 'feed', 'buildpanel', 'miniwrap', 'quick', 'selpanel', 'btn-build', 'king'];
      const boxes = [];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.offsetParent === null || getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (id === 'feed') {
          // El panel de mensajes cuenta por sus mensajes visibles.
          const msgs = [...el.children].map((m) => m.getBoundingClientRect()).filter((m) => m.bottom > r.top && m.height > 0);
          if (!msgs.length) continue;
          boxes.push(['feed', { left: r.left, right: r.right, top: Math.max(r.top, Math.min(...msgs.map((m) => m.top))), bottom: r.bottom, width: r.width }]);
          continue;
        }
        boxes.push([id, r]);
      }
      document.querySelectorAll('.topbar > *').forEach((el, i) => boxes.push(['top' + i, el.getBoundingClientRect()]));
      const out = [];
      for (const [id, r] of boxes) if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(id + ' fuera');
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, ra] = boxes[i]; const [b, rb] = boxes[j];
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 2 && oy > 2) out.push(`${a}/${b}`);
      }
      return out;
    });
    // Los paneles emergentes deben caber en pantalla.
    await pg.click('.stat.coins');
    await pg.waitForTimeout(150);
    const econFits = await pg.evaluate(() => { const r = document.getElementById('econ').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
    await pg.click('#econ [data-close]');
    const playersVisible = await pg.evaluate(() => document.getElementById('players').offsetParent !== null);
    let scoreFits = true;
    if (playersVisible) {
      await pg.click('#players');
      await pg.waitForTimeout(150);
      scoreFits = await pg.evaluate(() => { const r = document.getElementById('score').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
      await pg.screenshot({ path: `${SP}/shots/86-score-${w}x${h}.png` });
      await pg.click('#score [data-close]');
    }
    await pg.screenshot({ path: `${SP}/shots/87-${w}x${h}.png` });
    if (issues.length || !econFits || !scoreFits) bad.push(`${name}: ${issues.join(', ')}${econFits ? '' : ' desglose fuera'}${scoreFits ? '' : ' marcador fuera'}`);
    errors.push(...pg.errors);
    await pg.context().close();
  }
  check('A16', 'nada tapado ni fuera de pantalla en 5 tamaños (con mensajes y paneles nuevos)', bad.length === 0, bad.join(' | '));

  console.log(results.map((r) => r.text).join('\n'));
  console.log(`TOTAL ${results.filter((r) => r.ok).length}/${results.length}`);
  console.log('errores:', JSON.stringify(errors));
  await browser.close();
})();
