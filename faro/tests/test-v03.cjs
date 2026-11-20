const H = require('./helpers.cjs');
// Pruebas de aceptación del PRD web v0.3 (W01–W12) en Chromium con toques simulados.
const { chromium } = require('playwright');
const SP = process.env.SP;
const results = [];
const check = (id, name, ok, extra = '') => results.push({ id, ok: !!ok, text: `${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${extra}` });

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

async function start(page, mode = 'duel', map = 'archipelago') {
  await page.evaluate(([m, k]) => { const a = window.FARO; a.setOption('mode', m); a.setOption('mapKind', k); a.startGame(); }, [mode, map]);
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.FARO.game.bots.forEach((b) => { b.update = () => {}; }); });
}

const step = (page, s) => page.evaluate((s) => { for (let i = 0; i < s * 10; i++) window.FARO.game.update(0.1); }, s);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const allErrors = [];

  // ---------- W01: iniciar, ganar, revancha y volver al menú (3 veces) ----------
  {
    const page = await newPage(browser);
    let okAll = true;
    for (let i = 0; i < 3; i++) {
      await page.evaluate((m) => { window.FARO.setOption('mode', m); window.FARO.startGame(); }, 'duel');
      await page.waitForTimeout(250);
      await page.evaluate(() => { const g = window.FARO.game; g.kill(g.players[1].core, 0); });
      const endOk = await page.waitForSelector('#end', { state: 'visible', timeout: 6000 }).then(() => true, () => false);
      await page.click('#btn-again');
      await page.waitForTimeout(250);
      const again = await page.evaluate(() => window.FARO.state === 'play' && window.FARO.game.time < 5 && !window.FARO.game.over);
      if (!endOk || !again) console.log('W01 ciclo', i, { endOk, again });
      await page.click('#btn-pause');
      await page.click('#btn-quit');
      await page.waitForTimeout(250);
      const menu = await page.isVisible('#menu');
      okAll = okAll && endOk && again && menu;
    }
    check('W01', 'victoria → revancha → menú, 3 ciclos', okAll);
    allErrors.push(...page.errors);
    await page.context().close();
  }

  // ---------- W02: vista previa, girar, confirmar, cancelar ----------
  {
    const page = await newPage(browser);
    await start(page);
    const info = await page.evaluate(() => {
      const app = window.FARO; const g = app.game;
      const valid = g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, 'farm', c.i));
      const invalid = g.cells.find((c) => c.owner === 0 && c.t === 'sand' && !c.bld && !c.point);
      const r = app.renderer; r.cam.tx = valid.x; r.cam.tz = valid.z; r.cam.dist = 18; r.updateCamera();
      app.paused = true; // congela los ingresos para medir el cobro exacto
      return { valid: valid.i, invalid: invalid.i, coins: Math.round(g.players[0].coins), farms0: g.count(0, 'farm') };
    });
    const proj = (ci) => page.evaluate((ci) => { const c = window.FARO.game.cells[ci]; return window.FARO.renderer.project(c.x, c.h, c.z); }, ci);
    await page.click('[data-b="farm"]');
    let p = await proj(info.invalid);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(150);
    const bad = await page.evaluate(() => {
      const r = window.FARO.renderer; const gh = r.ghost;
      return { visible: gh && gh.group.visible, red: gh && gh.parts[0].material === gh.badMat, okDisabled: document.getElementById('btn-place-ok').disabled,
        text: document.getElementById('placetext').textContent };
    });
    check('W02', 'casilla inválida: vista previa roja, motivo y botón bloqueado', bad.visible && bad.red && bad.okDisabled && /Solo/.test(bad.text), JSON.stringify(bad.text));
    p = await proj(info.valid);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(150);
    const good = await page.evaluate(() => ({ red: window.FARO.renderer.ghost.parts[0].material === window.FARO.renderer.ghost.badMat, ok: !document.getElementById('btn-place-ok').disabled, coins: Math.round(window.FARO.game.players[0].coins), farms: window.FARO.game.count(0, 'farm') }));
    check('W02', 'casilla válida: vista previa verde y sin cobrar todavía', !good.red && good.ok && good.farms === info.farms0 && good.coins >= info.coins, JSON.stringify(good));
    await page.click('#btn-place-rot');
    await page.click('#btn-place-rot');
    const coinsBefore = await page.evaluate(() => window.FARO.game.players[0].coins);
    await page.click('#btn-place-ok');
    const disabledAfter = await page.evaluate(() => document.getElementById('btn-place-ok').disabled);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const built = await page.evaluate((cb) => {
      const g = window.FARO.game; const f = g.buildings.filter((b) => b.type === 'farm' && b.owner === 0).pop();
      return { farms: g.count(0, 'farm'), paid: Math.round(cb - g.players[0].coins), rot: f && f.rot, keep: window.FARO.input.placement && window.FARO.input.placement.rot };
    }, coinsBefore);
    const twoThirds = (Math.PI * 2) / 3;
    check('W02', 'confirmar dos veces cobra una sola vez (300)', built.farms === info.farms0 + 1 && built.paid === 300 && disabledAfter, JSON.stringify(built));
    check('W02', 'el giro elegido se aplica y se conserva', Math.abs(built.rot - twoThirds) < 1e-6 && Math.abs(built.keep - twoThirds) < 1e-6);
    const c2 = await page.evaluate(() => window.FARO.game.players[0].coins);
    await page.click('#btn-place-cancel');
    const c3 = await page.evaluate(() => ({ coins: window.FARO.game.players[0].coins, placing: !!window.FARO.input.placement, farms: window.FARO.game.count(0, 'farm') }));
    check('W02', 'cancelar no cobra', !c3.placing && c3.farms === info.farms0 + 1 && Math.abs(c3.coins - c2) < 1);
    allErrors.push(...page.errors);
    await page.screenshot({ path: SP + '/shots/50-w02.png' });
    await page.context().close();
  }

  // ---------- W03–W10: reglas con la API del juego ----------
  {
    const page = await newPage(browser);
    await start(page);
    const r = await page.evaluate(() => {
      const out = {};
      const g = window.FARO.game;
      const me = g.players[0];
      me.coins = 100000;
      const free = (type) => g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, type, c.i));
      const run = (s) => { for (let i = 0; i < s * 10; i++) g.update(0.1); };

      // W03 energía
      const e0 = me.energy;
      // v0.5: el Molino pasa a ser la Eólica (+5 cada 10 s) y la obra la termina un constructor.
      g.place(0, 'wind', free('wind').i);
      { const w = g.buildings.find((b) => b.type === 'wind' && b.owner === 0); w.built = true; w.progress = 1; w.hp = w.maxHp; g.refreshEconomy(); }
      run(0.2);
      const e1 = me.energy;
      run(10);
      out.millGain = Math.round(me.energy - e1);
      const eBefore = me.energy;
      g.place(0, 'factory', free('factory').i);
      out.factoryEnergy = Math.round(eBefore - me.energy);
      const fac = g.buildings.find((b) => b.type === 'factory' && b.owner === 0);
      fac.progress = 1; fac.built = true; fac.hp = fac.maxHp; g.refreshEconomy();
      me.energy = 100;
      const coins0 = me.coins;
      const err = g.enqueue(fac, 'tank');
      out.tankPaid = [Math.round(coins0 - me.coins), Math.round(100 - me.energy), err];
      g.cancelQueue(fac, 0);
      out.tankRefund = [Math.round(me.coins - (coins0 - 3400)), Math.round(me.energy - 70)];
      me.energy = 10;
      out.noEnergy = g.enqueue(fac, 'tank');

      // W07 escudo de emergencia
      const core = me.core;
      core.hp = core.maxHp * 0.5;
      g.damage(core, core.maxHp * 0.4, 1);
      out.emerg1 = { hp: Math.round(core.hp), shield: core.shieldUntil > g.time };
      const hpShield = core.hp;
      g.damage(core, 500, 1);
      out.emergBlocks = core.hp === hpShield;
      run(21);
      const hpBefore = core.hp;
      g.damage(core, 200, 1);
      out.afterShield = Math.round(hpBefore - core.hp) === 200;
      core.hp = core.maxHp * 0.1;
      g.damage(core, 50, 1);
      out.emerg2 = core.shieldUntil > g.time;
      core.hp = core.maxHp;

      // W08 Cúpula
      // v0.5: la Cúpula pide Núcleo nivel 3 y la segunda compra la sube a nivel 2.
      out.domeLocked = g.buyDome(0);
      core.level = 3;
      const cBefore = me.coins;
      out.domeBuy = [g.buyDome(0), Math.round(cBefore - me.coins), me.dome.level];
      const farmCell = g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, 'solar', c.i) && g.map.dist(c, g.cells[core.cell]) <= 3);
      g.place(0, 'solar', farmCell.i);
      const farm = g.buildings.find((b) => b.type === 'solar' && b.owner === 0);
      farm.built = true; farm.progress = 1; farm.hp = farm.maxHp;
      const fakeShip = { cls: 'ship', type: 'destroyer', owner: 1 };
      const fakeRifle = { cls: 'inf', type: 'rifle', owner: 1 };
      const insideDome = g.domeCovers(0, farm);
      g.damage(farm, 100, 1, fakeShip);
      out.domeNaval = { inside: insideDome, farmFull: farm.hp === farm.maxHp, domeHp: me.dome.hp };
      g.damage(farm, 100, 1, fakeRifle);
      out.domeInf = { farmLost: Math.round(farm.maxHp - farm.hp), domeHp: me.dome.hp };
      g.damage(farm, 5000, 1, { cls: 'air', type: 'heli', owner: 1 });
      out.domeBroken = { hp: me.dome.hp, farmAlive: farm.alive };
      const fhp = farm.hp;
      g.damage(farm, 50, 1, fakeShip);
      out.afterBreak = fhp - farm.hp;
      run(61);
      out.domeBack = me.dome.hp === me.dome.maxHp;

      // W09 reparación y obra rápida
      const eng = g.units.find((u) => u.owner === 0 && u.type === 'engineer');
      farm.hp = farm.maxHp / 2;
      g.orderRepair([eng], farm);
      run(20);
      out.repaired = Math.round(farm.hp) === farm.maxHp;
      out.engState = eng.state;
      // obra con y sin ingeniero al lado
      const cA = g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, 'barracks', c.i) && g.map.dist(c, g.cells[eng.cell]) === 1);
      g.place(0, 'barracks', cA.i);
      const bA = g.buildings.find((b) => b.cell === cA.i);
      const cB = g.cells.find((c) => c.owner === 0 && !g.placeInvalid(0, 'barracks', c.i) && g.map.dist(c, g.cells[eng.cell]) >= 4);
      g.place(0, 'barracks', cB.i);
      const bB = g.buildings.find((b) => b.cell === cB.i);
      run(3);
      out.buildSpeed = [bA.progress.toFixed(2), bB.progress.toFixed(2)];

      // W09 sigilo del submarino
      const water = g.cells.filter((c) => c.t === 'deep' && hexDist(c.q, c.r, 0, 0) < g.map.R - 3);
      const subCell = water.find((c) => g.map.dist(c, g.cells[me.core.cell]) > 9 && g.buildings.every((b) => b.type !== 'harbor' || g.map.dist(g.cells[b.cell], c) > 4));
      const sub = g.addUnit(1, 'sub', subCell.i);
      const far = water.find((c) => g.map.dist(c, subCell) >= 7);
      const dd = g.addUnit(0, 'destroyer', far.i);
      g.updateVisibility();
      out.subHidden = { attackable: g.canAttack(dd, dd.def.weapon, sub), visible: sub.visible };
      const near = water.find((c) => g.map.dist(c, subCell) === 2);
      dd.x = near.x; dd.z = near.z; dd.cell = near.i;
      g.updateVisibility();
      out.subFound = { attackable: g.canAttack(dd, dd.def.weapon, sub), visible: sub.visible };
      sub.alive = false; dd.alive = false;

      // W09 bosque
      const forest = g.cells.find((c) => c.t === 'forest' && c.nb.length === 6);
      const foe = g.addUnit(1, 'rifle', forest.i);
      foe.x = forest.x; foe.z = forest.z;
      const at3 = g.cells.find((c) => TERRAIN[c.t].land && g.map.dist(c, forest) === 3);
      const at2 = g.cells.find((c) => TERRAIN[c.t].land && g.map.dist(c, forest) === 2);
      const sn = g.addUnit(0, 'sniper', at3.i);
      sn.x = at3.x; sn.z = at3.z;
      const r3 = g.inRange(sn, sn.def.weapon, foe);
      sn.x = at2.x; sn.z = at2.z;
      const r2 = g.inRange(sn, sn.def.weapon, foe);
      const heli = g.addUnit(0, 'heli', at3.i);
      heli.x = at3.x; heli.z = at3.z;
      // Se aísla la regla del bosque: el helicóptero tiene además su regla de cobertura propia.
      const cover = g.coverBetween;
      g.coverBetween = () => false;
      out.forest = { from3: r3, from2: r2, heliFrom3: g.inRange(heli, heli.def.weapon, foe) };
      g.coverBetween = cover;
      foe.alive = false; sn.alive = false; heli.alive = false;

      // W10 casas
      let placed = 0;
      for (let i = 0; i < 8; i++) {
        const c = free('house');
        if (c && !g.place(0, 'house', c.i)) placed++;
      }
      const lastErr = g.placeInvalid(0, 'house', (free('wind') || {}).i);
      const house = g.buildings.find((b) => b.type === 'house' && b.owner === 0);
      house.built = true; house.progress = 1;
      g.refreshEconomy();
      const cap1 = me.popCap;
      const ups = [];
      // v0.5: la mejora la hace un constructor; aquí se termina al instante para medir los niveles.
      for (let i = 0; i < 4; i++) { const r = g.upgrade(house); if (typeof r !== 'string') g.finishUpgrade(house); ups.push(typeof r === 'string' ? r : house.level); }
      g.refreshEconomy();
      me.coresKilled = 1;
      out.houses = { placed, lastErr, ups, popGain: me.popCap - cap1, limitAfterKill: g.limitFor(0, 'house') };
      return out;
    });
    check('W03', 'la Eólica suma +5 de energía cada 10 s', r.millGain === 5, 'ganó ' + r.millGain);
    check('W03', 'la Fábrica gasta 50 de energía', r.factoryEnergy === 50);
    check('W03', 'el Tanque cuesta 3.400 monedas y 30 de energía', r.tankPaid[0] === 3400 && r.tankPaid[1] === 30 && !r.tankPaid[2], JSON.stringify(r.tankPaid));
    check('W03', 'cancelar devuelve monedas y energía exactas', r.tankRefund[0] === 3400 && r.tankRefund[1] === 30, JSON.stringify(r.tankRefund));
    check('W03', 'sin energía no deja entrenar y explica el motivo', /Energía insuficiente/.test(r.noEnergy || ''), r.noEnergy);
    check('W07', 'al 25 % se activa el escudo y el Núcleo queda en 25 %', r.emerg1.shield && r.emerg1.hp === 1500, JSON.stringify(r.emerg1));
    check('W07', 'durante el escudo no recibe daño; después sí', r.emergBlocks && r.afterShield);
    check('W07', 'no se activa una segunda vez', r.emerg2 === false);
    check('W08', 'la Cúpula pide Núcleo nivel 3 y cuesta 6.000 (nivel 1)', /nivel 3/.test(r.domeLocked || '') && r.domeBuy[0] === null && r.domeBuy[1] === 6000 && r.domeBuy[2] === 1, JSON.stringify([r.domeLocked, r.domeBuy]));
    check('W08', 'absorbe el daño naval dentro de su radio', r.domeNaval.inside && r.domeNaval.farmFull && r.domeNaval.domeHp === 2900, JSON.stringify(r.domeNaval));
    check('W08', 'no absorbe el daño de infantería', r.domeInf.farmLost === 100 && r.domeInf.domeHp === 2900, JSON.stringify(r.domeInf));
    check('W08', 'se rompe, deja pasar el daño y vuelve a los 60 s', r.domeBroken.hp === 0 && r.afterBreak === 50 && r.domeBack, JSON.stringify(r.domeBroken));
    check('W09', 'el Ingeniero repara el edificio hasta el máximo', r.repaired, r.engState);
    check('W09', 'la obra junto al Ingeniero va el doble de rápido', Number(r.buildSpeed[0]) >= Number(r.buildSpeed[1]) * 1.9, JSON.stringify(r.buildSpeed));
    check('W09', 'submarino lejos: invisible e inatacable', !r.subHidden.attackable && !r.subHidden.visible, JSON.stringify(r.subHidden));
    check('W09', 'submarino a 2 casillas de un Destructor: detectado', r.subFound.attackable && r.subFound.visible, JSON.stringify(r.subFound));
    check('W09', 'bosque: no se ataca desde 3 casillas, sí desde 2 y desde el aire', !r.forest.from3 && r.forest.from2 && r.forest.heliFrom3, JSON.stringify(r.forest));
    check('W10', 'máximo 6 Casas', r.houses.placed === 6 && /Límite alcanzado \(6\)/.test(r.houses.lastErr || ''), JSON.stringify(r.houses));
    check('W10', 'Casa hasta nivel 4 (+15 de población) y no más', JSON.stringify(r.houses.ups.slice(0, 3)) === '[2,3,4]' && /máximo/.test(r.houses.ups[3]) && r.houses.popGain === 15);
    check('W10', 'destruir un Núcleo permite 2 Casas más', r.houses.limitAfterKill === 8);
    allErrors.push(...page.errors);
    await page.context().close();
  }

  // ---------- W04 / W05: Faro y Banderas ----------
  {
    const page = await newPage(browser);
    await start(page, 'duel', 'archipelago');
    const r = await page.evaluate(() => {
      const g = window.FARO.game; const out = {};
      const run = (s) => { for (let i = 0; i < s * 10; i++) g.update(0.1); };
      const faro = g.points.find((p) => p.type === 'faro');
      const around = (pt, d) => g.cells.filter((c) => TERRAIN[c.t].land && !c.bld && !c.point && g.map.dist(c, g.cells[pt.cell]) === d);
      const put = (pid, type, cell) => { const u = g.addUnit(pid, type, cell.i); u.x = cell.x; u.z = cell.z; u.cell = cell.i; return u; };
      // Disputa: enemigo sin armas a 2 casillas
      const mine = [put(0, 'rifle', around(faro, 1)[0]), put(0, 'rifle', around(faro, 1)[1])];
      mine.forEach((u) => { u.def = { ...u.def, weapon: null }; });
      const eng = put(1, 'engineer', around(faro, 2)[0]);
      run(3);
      out.contested = { flag: faro.contested, prog: faro.prog, owner: faro.owner };
      eng.alive = false;
      run(13);
      out.captured = faro.owner;
      g.refreshEconomy();
      out.income = { base: g.players[0].baseIncome, total: g.players[0].income };
      out.territory = g.cells.filter((c) => c.owner === 0 && g.map.dist(c, g.cells[faro.cell]) <= 3).length;
      // Recaptura por el enemigo
      mine.forEach((u) => { u.alive = false; });
      run(0.5);
      const foes = [put(1, 'rifle', around(faro, 1)[2]), put(1, 'rifle', around(faro, 1)[3])];
      run(13);
      out.neutral = faro.owner;
      run(13);
      out.recaptured = faro.owner;
      foes.forEach((u) => { u.alive = false; });
      // Bandera
      const flag = g.points.find((p) => p.type === 'flag' && g.cells[p.cell].comp === g.cells[g.players[0].core.cell].comp) || g.points.find((p) => p.type === 'flag');
      const fu = put(0, 'rifle', around(flag, 1)[0]);
      run(13);
      out.flagOwner = flag.owner;
      g.players[0].coins = 5000;
      const spot = g.cells.find((c) => c.owner === 0 && g.map.dist(c, g.cells[flag.cell]) <= 2 && !g.placeInvalid(0, 'wind', c.i));
      out.buildOnFlag = spot ? g.place(0, 'wind', spot.i) : 'sin casilla';
      g.refreshEconomy();
      out.flagIncome = g.players[0].baseIncome;
      return out;
    });
    await page.waitForTimeout(400);
    const hud = await page.textContent('#income');
    check('W04', 'con un enemigo a 2 casillas la captura se pausa', r.contested.flag && r.contested.prog === 0 && r.contested.owner === -1, JSON.stringify(r.contested));
    check('W04', 'infantería sola junto al Faro lo captura en 12 s', r.captured === 0);
    check('W04', 'el Faro da +50 % de ingresos', r.income.total === Math.round(r.income.base * 1.5), JSON.stringify(r.income));
    check('W04', 'se puede recapturar (primero neutral, luego enemigo)', r.neutral === -1 && r.recaptured === 1, `neutral=${r.neutral} dueño=${r.recaptured}`);
    check('W05', 'capturar una Bandera da territorio y deja construir', r.flagOwner === 0 && r.buildOnFlag === null, JSON.stringify(r.buildOnFlag));
    check('W05', 'la Bandera suma +200 monedas/min', r.flagIncome === 900 + 240 + 200, 'ingreso base=' + r.flagIncome + ' (Núcleo 900 + Granja inicial 240 + Bandera 200)');
    check('W04', 'el HUD muestra el ingreso actual', /\+[\d.]+\/min/.test(hud), hud);
    allErrors.push(...page.errors);
    await page.context().close();
  }

  // ---------- W06: Barcaza con soldados y tanque ----------
  {
    const page = await newPage(browser);
    await start(page, 'duel', 'archipelago');
    const r = await page.evaluate(() => {
      const g = window.FARO.game; const out = {};
      const run = (s) => { for (let i = 0; i < s * 10; i++) g.update(0.1); };
      const core = g.cells[g.players[0].core.cell];
      const coast = g.cells.filter((c) => c.t === 'shallow' && g.map.isCoast(c) && !c.bld).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
      const barge = g.addUnit(0, 'barge', coast.i);
      const land = g.freeCellsNear(core.i, 'land', 0, 6);
      const troops = [g.addUnit(0, 'rifle', land[3]), g.addUnit(0, 'rifle', land[4]), g.addUnit(0, 'tank', land[5])];
      g.orderBoard(troops, barge);
      run(25);
      out.slots = g.cargoSlots(barge);
      out.inside = troops.filter((u) => u.inside).length;
      const faro = g.cells[g.points.find((p) => p.type === 'faro').cell];
      const dest = g.cells.filter((c) => c.t === 'shallow' && g.map.isCoast(c) && c.comp === g.cells[barge.cell].comp)
        .sort((a, b) => g.map.dist(a, faro) - g.map.dist(b, faro))[0];
      g.orderMove([barge], dest.i);
      run(60);
      out.arrived = g.map.dist(g.cells[barge.cell], dest) <= 1;
      const res = g.unload(barge);
      out.unloaded = typeof res === 'string' ? res : res.length;
      out.onLand = troops.every((u) => !u.inside && TERRAIN[g.cells[u.cell].t].land);
      // lejos de la orilla
      const deep = g.cells.find((c) => c.t === 'deep' && c.nb.every((ni) => g.cells[ni].t === 'deep') && c.comp === g.cells[barge.cell].comp);
      const b2 = g.addUnit(0, 'barge', deep.i);
      const r2 = g.addUnit(0, 'rifle', land[0]);
      g.board(r2, b2);
      out.farErr = g.unload(b2);
      // pérdida de la barcaza: nadie queda atrapado
      g.kill(b2, 1);
      out.cargoDies = !r2.alive;
      return out;
    });
    check('W06', 'suben 2 soldados y 1 tanque (4 plazas)', r.slots === 4 && r.inside === 3, JSON.stringify(r));
    check('W06', 'la Barcaza cruza y desembarca a todos en tierra', r.arrived && r.unloaded === 3 && r.onLand);
    check('W06', 'lejos de la orilla avisa en vez de desembarcar', /orilla/.test(r.farErr || ''), r.farErr);
    check('W06', 'si hunden la Barcaza no quedan tropas atrapadas', r.cargoDies);
    allErrors.push(...page.errors);
    await page.context().close();
  }

  // ---------- W11: gestos y distribución ----------
  {
    const page = await newPage(browser);
    await start(page, 'duel');
    const res = await page.evaluate(async () => {
      const app = window.FARO; const g = app.game; const c = app.canvas;
      const u = g.units.find((x) => x.owner === 0 && x.type === 'rifle');
      app.setSelection([u]);
      const before = { dist: app.renderer.cam.dist, state: u.state, sel: app.selection.length };
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
      // pellizco
      ev('pointerdown', 1, 500, 400); ev('pointerdown', 2, 700, 400);
      for (let i = 1; i <= 6; i++) { ev('pointermove', 1, 500 - i * 15, 400); ev('pointermove', 2, 700 + i * 15, 400); }
      ev('pointerup', 2, 790, 400); ev('pointerup', 1, 410, 400);
      const afterPinch = { dist: app.renderer.cam.dist, state: u.state, sel: app.selection.length };
      // arrastre
      const tx = app.renderer.cam.tx; const tz = app.renderer.cam.tz;
      ev('pointerdown', 3, 600, 400);
      for (let i = 1; i <= 6; i++) ev('pointermove', 3, 600 - i * 20, 400 - i * 10);
      ev('pointerup', 3, 480, 340);
      return { before, afterPinch, afterDrag: { moved: Math.hypot(app.renderer.cam.tx - tx, app.renderer.cam.tz - tz) > 0.5, state: u.state, sel: app.selection.length } };
    });
    check('W11', 'el pellizco hace zoom sin dar órdenes ni cambiar la selección',
      res.afterPinch.dist < res.before.dist && res.afterPinch.state === 'idle' && res.afterPinch.sel === 1, JSON.stringify(res.afterPinch));
    check('W11', 'el arrastre mueve la cámara sin dar órdenes', res.afterDrag.moved && res.afterDrag.state === 'idle' && res.afterDrag.sel === 1);
    allErrors.push(...page.errors);
    await page.context().close();

    const sizes = [['iPad horizontal 4:3', 1180, 820], ['16:9', 1280, 720], ['iPad vertical', 820, 1180], ['celular horizontal', 844, 390], ['celular vertical', 390, 844]];
    const overlaps = [];
    for (const [name, w, h] of sizes) {
      const pg = await newPage(browser, w, h);
      await start(pg, 'king');
      await pg.evaluate(() => { const a = window.FARO; a.setSelection([a.game.players[0].core]); });
      await pg.waitForTimeout(400);
      const bad = await pg.evaluate(() => {
        const ids = ['objectives', 'buildpanel', 'miniwrap', 'quick', 'selpanel', 'btn-build', 'king'];
        const boxes = [];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (!el || el.hidden || getComputedStyle(el).display === 'none') continue;
          boxes.push([id, el.getBoundingClientRect()]);
        }
        document.querySelectorAll('.topbar > *').forEach((el, i) => boxes.push(['top' + i, el.getBoundingClientRect()]));
        const out = [];
        for (const [id, r] of boxes) if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push(id + ' fuera de pantalla');
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const [a, ra] = boxes[i]; const [b, rb] = boxes[j];
          if (ra.width === 0 || rb.width === 0) continue;
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 2 && oy > 2) out.push(`${a} tapa ${b}`);
        }
        return out;
      });
      await pg.screenshot({ path: `${SP}/shots/60-${w}x${h}.png` });
      if (bad.length) overlaps.push(`${name}: ${bad.join(', ')}`);
      allErrors.push(...pg.errors);
      await pg.context().close();
    }
    check('W11', 'nada tapado ni fuera de pantalla en 5 tamaños', overlaps.length === 0, overlaps.join(' | '));
  }

  // ---------- W12: seis modos y Rey del Faro ----------
  {
    const page = await newPage(browser);
    const modes = ['duel', 'ffa', 'teams', 'big', 'king', 'blitz'];
    const started = [];
    for (const m of modes) {
      await start(page, m);
      await page.evaluate(() => { window.FARO.game.bots.forEach((b) => { delete b.update; }); });
      await step(page, 20);
      const info = await page.evaluate(() => ({ n: window.FARO.game.players.length, t: Math.round(window.FARO.game.time), coins: Math.round(window.FARO.game.players[1].coins) }));
      started.push(`${m}:${info.n}j/${info.t}s`);
    }
    check('W12', 'los 6 modos arrancan y corren 20 s', started.length === 6, started.join(' '));
    const blitz = await page.evaluate(() => { const a = window.FARO; a.setOption('mode', 'blitz'); a.startGame(); return { coins: a.game.players[0].coins, energy: a.game.players[0].energy, speed: a.game.speed }; });
    check('W12', 'Relámpago: 6.000 monedas, 150 de energía y ritmo ×2', blitz.coins === 6000 && blitz.energy === 150 && blitz.speed === 2, JSON.stringify(blitz));
    await start(page, 'king');
    await page.evaluate(() => {
      const g = window.FARO.game; const faro = g.points.find((p) => p.type === 'faro');
      faro.owner = 0; faro.prog = 1; g.kingTime[g.players[0].team] = KING_TIME - 1;
    });
    await step(page, 1.5);
    await page.waitForTimeout(2000);
    const king = await page.evaluate(() => ({ over: window.FARO.game.over, result: window.FARO.game.result, text: document.getElementById('enddialog').textContent }));
    check('W12', 'Rey del Faro termina al cumplir 3 min con el Faro', king.over && king.result === 'victory' && /mantuvo el Faro/.test(king.text), JSON.stringify({ over: king.over, result: king.result }));
    await page.screenshot({ path: SP + '/shots/61-king-end.png' });
    allErrors.push(...page.errors);
    await page.context().close();
  }

  console.log(results.map((r) => r.text).join('\n'));
  console.log(`TOTAL ${results.filter((r) => r.ok).length}/${results.length}`);
  console.log('errores:', JSON.stringify(allErrors));
  await browser.close();
})();
