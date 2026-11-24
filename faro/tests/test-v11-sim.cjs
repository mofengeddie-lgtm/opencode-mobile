// Pruebas de lógica de la v1.1 (H01, H02, H04, H06, H07, H08) con el juego sin gráficos.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} · ${ev}`); };
const { Game, UNITS } = ctx;
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const run = (g, sec, dt = 0.1, each) => { for (let t = 0; t < sec; t += dt) { g.update(dt); if (each) each(); } };

// ---------- H01 alianzas ----------
{
  seedRandom(1);
  const g = new Game({ mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 5 });
  run(g, 60);
  const answers = [];
  let ally = null;
  for (let pid = 1; pid < 6; pid++) {
    const r = g.proposeAlliance(0, pid);
    answers.push(`${g.players[pid].name} (${V('PERSONALITIES')[g.players[pid].persona].name}): ${r.ok ? 'acepta' : 'no'}`);
    if (r.ok && !ally) ally = g.players[pid];
  }
  const again = ally ? g.proposeAlliance(0, ally.id).text : '';
  const notEnemy = ally && !g.isEnemy(0, ally.id) && !g.isEnemy(ally.id, 0);
  // Visión compartida: lo de tu aliado se ve aunque no esté cerca de lo tuyo.
  g.updateVisibility && g.updateVisibility();
  const allyUnit = ally && g.units.find((u) => u.owner === ally.id);
  const seen = allyUnit ? allyUnit.visible !== false : false;
  // Chat de aliados: el mensaje del aliado llega marcado como aliado.
  const chatAlly = g.chat.some((m) => ally && m.pid === ally.id && m.ally);
  // Un aliado no ataca a tus tropas: una tropa suya junto a una tuya no busca blanco en ella.
  let noFire = true;
  if (ally) {
    const c = g.freeCellsNear(g.players[0].core.cell, 'land', 0, 20)[10];
    const mine = g.addUnit(0, 'rifle', c);
    const theirs = g.addUnit(ally.id, 'rifle', g.freeCellsNear(c, 'land', ally.id, 3)[1]);
    const t = g.acquire(theirs, UNITS.rifle.weapon, 0);
    noFire = !t || t.owner !== 0;
  }
  // Rechazo por haber atacado hace poco.
  const foe = g.players.find((p) => p.id !== 0 && p.team !== g.players[0].team && p.alive);
  foe.hurtBy = { 0: g.time };
  delete (g.players[0].allyAsk || {})[foe.id];
  const hurtAns = g.proposeAlliance(0, foe.id).text;
  // Romper la alianza.
  const err = g.breakAlliance(0);
  const broken = ally && g.isEnemy(0, ally.id);
  // Si solo quedan aliados, la alianza se rompe y la partida sigue (gana uno solo).
  delete (g.players[0].allyAsk || {})[ally.id];
  g.formAlliance(0, ally.id);
  for (const p of g.players) if (p.team !== g.players[0].team && p.alive) g.kill(p.core, 0);
  g.checkEnd();
  const dissolved = !g.over && g.isEnemy(0, ally.id);
  // En modos de equipos fijos no hay alianzas.
  const gd = new Game({ mode: 'duos', mapKind: 'archipelago', difficulty: 'normal', seed: 6 });
  const duosNo = gd.proposeAlliance(0, 2).text;
  check('H01', 'Alianzas: proponer (acepta o rechaza con su motivo), no se atacan, comparten visión, chat de aliados, romper',
    !!ally && notEnemy && seen && chatAlly && noFire && /atacaste/.test(hurtAns) && err === null && broken && dissolved && /no hay alianzas/.test(duosNo) && /ya es tu aliado/.test(again),
    `respuestas: ${answers.join('; ')}; otra vez al aliado: «${again}»; aliados no enemigos: ${notEnemy}; ves sus tropas: ${seen}; mensaje en el chat de aliados: ${chatAlly}; su Artillero no te elige de blanco: ${noFire}; ` +
    `a quien atacaste: «${hurtAns}»; romper: ${err === null ? 'hecho' : err} (vuelven a ser rivales: ${broken}); si solo quedan aliados la alianza se rompe y la partida sigue: ${dissolved}; en Dúos: «${duosNo}»`);
}

// ---------- H02 Dúos ----------
{
  const rows = [];
  let ok = true;
  for (const [mapKind, seed] of [['archipelago', 21], ['continent', 22], ['open', 23]]) {
    const g = new Game({ mode: 'duos', mapKind, difficulty: 'normal', seed });
    const teams = g.players.map((p) => p.team).join('');
    const d = (a, b) => g.map.dist(g.cells[g.players[a].core.cell], g.cells[g.players[b].core.cell]);
    const mate = d(0, 1);
    const others = Math.min(...[2, 3, 4, 5].map((i) => d(0, i)));
    if (!(teams === '001122' && mate < others)) ok = false;
    rows.push(`${mapKind}: equipos ${teams}, tu pareja a ${mate} casillas y el rival más cerca a ${others}`);
  }
  // Gana la última pareja: muere una pareja rival y luego la otra.
  const g = new Game({ mode: 'duos', mapKind: 'archipelago', difficulty: 'normal', seed: 21 });
  for (const id of [2, 3]) g.kill(g.players[id].core, 0);
  g.checkEnd();
  const mid = g.over;
  for (const id of [4, 5]) g.kill(g.players[id].core, 0);
  g.checkEnd();
  check('H02', 'Modo Dúos: 3 parejas que aparecen cerca; gana la última pareja', ok && !mid && g.over && g.result === 'victory',
    `${rows.join(' · ')}; con una pareja rival en pie la partida sigue (${!mid}); al caer la última: ${g.result}`);
}

// ---------- H04 defensa de punto ----------
{
  const g = new Game({ mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 7, fog: false });
  g.bots = [];
  for (const p of g.players) { p.coins = 1e6; p.energy = 1e5; }
  const core = g.cells[g.players[0].core.cell];
  const c = g.cells.find((x) => !g.placeInvalid(0, 'antinuke', x.i, true) && g.map.dist(x, core) <= 3);
  const an = g.addBuilding(0, 'antinuke', c.i, true);
  const sp = g.cells.filter((x) => g.map.dist(x, c) === 5 && g.passable(x, 'land', 1));
  g.addUnit(1, 'launcher', sp[0].i);
  g.addUnit(1, 'missiletruck', sp[1].i);
  const hp0 = an.hp + an.shield;
  run(g, 30);
  const kills = an.pdKills || 0;
  // Sigue derribando el misil nuclear.
  const silo = g.addBuilding(1, 'aadef', g.cells.filter((x) => g.map.dist(x, core) === 9 && !x.bld && V('TERRAIN')[x.t].land)[0].i, true);
  while (silo.level < 4) { silo.upgrading = { level: silo.level + 1, progress: 1 }; g.finishUpgrade(silo); }
  g.players[1].coins = 1e6;
  const tgt = g.cells.filter((x) => g.map.dist(x, c) === 2)[0];
  g.launchNuke(silo, tgt.i);
  run(g, V('NUKE').flight + 1);
  check('H04', 'El Escudo antimisiles derriba misiles y cohetes enemigos cerca, sin dejar de derribar el misil nuclear',
    kills >= 3 && g.nukesIntercepted === 1,
    `Lanzacohetes y Camión de misiles enemigos a 5 casillas durante 30 s: derribó ${kills} (vida y escudo del Escudo: ${Math.round(hp0)} → ${Math.round(an.hp + an.shield)}); misil nuclear a 2 casillas: derribado (${g.nukesIntercepted})`);
}

// ---------- H06 órdenes a aliados ----------
{
  seedRandom(3);
  const g = new Game({ mode: 'league', mapKind: 'continent', difficulty: 'normal', seed: 31 });
  run(g, 240);
  const allies = g.bots.filter((b) => b.p.team === g.players[0].team);
  const sent = allies.map((b) => b.answerHelp(0));
  const helpers = g.units.filter((u) => u.role === 'help' && u.alive && g.players[u.owner].team === g.players[0].team);
  const toBase = helpers.filter((u) => u.path && u.path.length && g.map.dist(g.cells[u.path[u.path.length - 1]], g.cells[g.players[0].core.cell]) <= 2).length;
  const foe = g.players.find((p) => p.team !== g.players[0].team && p.alive);
  const att = allies.map((b) => b.answerAttack(foe.id));
  const focus = allies.every((b) => b.focusPid === foe.id && b.chooseEnemyCore() === foe.core);
  const said = g.chat.filter((m) => allies.some((b) => b.pid === m.pid) && /ayudarte|Vamos por|tropas|aguanta|oleada/.test(m.text)).length;
  check('H06', '«¡Ayuda!» y «¡Ataquemos!»: los aliados responden y mandan tropas',
    sent.reduce((a, b) => a + b, 0) > 0 && att.reduce((a, b) => a + b, 0) > 0 && focus && said >= 2,
    `«¡Ayuda!»: tus 2 aliados mandan ${sent.join(' y ')} tropas (${toBase} van hacia tu Núcleo); «¡Ataquemos!» a ${foe.name}: mandan ${att.join(' y ')} y lo eligen como blanco de sus oleadas (${focus}); mensajes en el chat: ${said}`);
}

// ---------- H07 espectador y H08 historia ----------
{
  seedRandom(4);
  const g = new Game({ mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 41 });
  run(g, 120);
  g.kill(g.players[0].core, 1);
  g.checkEnd();
  const lost = g.over && g.result === 'defeat';
  const can = g.canSpectate();
  const started = g.startSpectating();
  const t0 = g.time;
  const units0 = g.units.length;
  // La partida sigue entre los bots; para no esperar 30 min, se terminan a mano los rivales salvo uno.
  run(g, 60);
  const advanced = g.time > t0 + 50 && !g.over;
  const alive = g.players.filter((p) => p.alive);
  for (const p of alive.slice(1)) g.kill(p.core, alive[0].id);
  g.checkEnd();
  const ended = g.over && !g.spectating && g.spectateWinner === alive[0].id;
  const H = g.history;
  check('H07', 'Al perder, «Seguir mirando» deja ver la partida hasta el final',
    lost && can && started && advanced && ended,
    `al caer tu Núcleo: derrota (${lost}); se puede seguir mirando (${can}); la partida siguió ${Math.round(g.time - t0 - 0)} s más sin terminar; cuando queda un imperio termina y muestra al ganador (${g.players[g.spectateWinner].name})`);
  check('H08', 'Historia de la partida para las gráficas: monedas por minuto y ejército de cada imperio',
    H.length >= 18 && H.every((h) => h.inc.length === 6 && h.army.length === 6) && H[H.length - 1].t > H[0].t,
    `${H.length} muestras (cada 10 s), de ${H[0].t} s a ${H[H.length - 1].t} s; última: monedas/min ${H[H.length - 1].inc.join(', ')} · tropas ${H[H.length - 1].army.join(', ')}`);
}

fs.writeFileSync(__dirname + '/results-v11-sim.json', JSON.stringify(results, null, 1));
console.log(results.filter((r) => r.ok).length + ' de ' + results.length + ' bien');
