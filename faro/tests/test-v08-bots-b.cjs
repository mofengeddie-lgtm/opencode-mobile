// E06-E10 del PRD v0.8: comportamiento de los bots en partidas simuladas.
const ctx = require('./sim.cjs');
const fs = require('fs');
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
const seedRng = (s) => { let a = (s * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- E06 defensa en equipo ----------
{
  const runs = [];
  for (const [mapKind, seed] of [['continent', 777], ['archipelago', 31], ['bay', 9]]) {
    seedRng(seed);
    const g = new ctx.Game({ mode: 'duel', mapKind, difficulty: 'normal', seed });
    const bot = g.bots[0];
    const p = g.players[1];
    const core = g.cells[p.core.cell];
    const mine = g.freeCellsNear(core.i, 'land', 1, 14);
    const army = mine.slice(4, 12).map((ci) => g.addUnit(1, 'rifle', ci));
    // El ataque llega por un lado: 6 tropas tuyas a 3 casillas del Núcleo del bot.
    const side = g.cells.filter((c) => g.passable(c, 'land', 0) && g.map.dist(c, core) === 3 && c.comp === core.comp)[0];
    const attackers = g.freeCellsNear(side.i, 'land', 0, 6).map((ci) => g.addUnit(0, 'rifle', ci));
    p.coins = 6000;
    bot.defendT = 0;
    const units = g.units.filter((u) => u.owner === 1);
    bot.defend(units);
    const d = bot.lastDefense;
    const turret = g.buildings.find((b) => b.owner === 1 && b.type === 'turret');
    let off = null;
    if (turret) {
      const tc = g.cells[turret.cell];
      const a1 = Math.atan2(tc.z - core.z, tc.x - core.x);
      const a2 = Math.atan2(side.z - core.z, side.x - core.x);
      off = Math.abs(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2)));
    }
    for (let i = 0; i < 40; i++) g.update(0.1);
    const engaged = army.filter((u) => u.alive && (u.state === 'amove' || u.state === 'attack')).length;
    runs.push({ mapKind, near: d.near, sent: d.sent, ratio: d.sent / Math.max(1, d.near), turret: !!turret, off, engaged, alive: army.filter((u) => u.alive).length });
  }
  check('E06', 'Defensa en equipo: al atacar la base de un bot acuden 7 de cada 10 de sus tropas cercanas y levanta una Torreta de ese lado',
    runs.every((r) => r.ratio >= 0.7 && r.turret && r.off < 0.95),
    runs.map((r) => `${r.mapKind}: acuden ${r.sent} de ${r.near} tropas cercanas, Torreta ${r.turret ? `a ${(r.off * 57.3).toFixed(0)}° del lado del ataque` : 'no'}; a los 4 s pelean ${r.engaged}`).join(' · '));
}

// ---------- E07 oleadas ordenadas ----------
{
  const rows = [];
  for (const [mapKind, seed, diff] of [['continent', 11, 'normal'], ['archipelago', 22, 'normal'], ['continent', 33, 'hard'], ['archipelago', 44, 'hard']]) {
    seedRng(seed);
    const g = new ctx.Game({ mode: 'duel', mapKind, difficulty: diff, seed, personas: [null, 'aggro'] });
    g.players[0].core.maxHp = g.players[0].core.hp = 1e9;
    const bot = g.bots[0];
    let staged = null;
    let launched = null;
    let waves0 = 0;
    for (let i = 0; i < 20 * 600 && !(staged && launched); i++) {
      g.update(0.1);
      if (!staged && bot.raid && g.time - bot.raid.start > 1) {
        const land = bot.raid.units.filter((u) => u.alive && u.mover === 'land');
        if (land.length) staged = { n: land.length, line: land.filter((u) => u.faceYaw !== null && u.faceYaw !== undefined).length, amove: land.filter((u) => u.state === 'amove' || u.state === 'idle' || u.state === 'attack').length };
        waves0 = bot.wavesSent;
      }
      if (staged && !launched && bot.wavesSent > waves0) {
        const w = g.units.filter((u) => u.owner === 1 && u.role === 'wave' && u.alive);
        launched = { n: w.length, amove: w.filter((u) => u.state === 'amove' || u.state === 'attack').length };
      }
    }
    rows.push({ mapKind: mapKind + '/' + diff, staged, launched });
  }
  const ok = rows.filter((r) => r.staged && r.launched).length >= 3 &&
    rows.every((r) => !r.staged || r.staged.line / r.staged.n >= 0.8) && rows.every((r) => !r.launched || r.launched.amove / Math.max(1, r.launched.n) >= 0.8);
  check('E07', 'Las oleadas se forman en línea al reunirse y avanzan atacando',
    ok, rows.map((r) => `${r.mapKind}: ${r.staged ? `reunidas en línea ${r.staged.line}/${r.staged.n}` : 'sin oleada'}${r.launched ? `, avanzan atacando ${r.launched.amove}/${r.launched.n}` : ''}`).join(' · '));
}

// ---------- E08 fuego concentrado ----------
{
  seedRng(5);
  const g = new ctx.Game({ mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 5 });
  const c0 = g.map.get(0, 0);
  const shooterB = g.addUnit(1, 'rifle', c0.i);
  const shooterH = g.addUnit(0, 'rifle', c0.i);
  const ring = g.freeCellsNear(c0.i, 'land', 1, 3);
  const mk = (owner, hp, k) => { const u = g.addUnit(owner, 'rifle', ring[k]); u.hp = hp; return u; };
  // Tres enemigos a tiro del bot: el más cercano tiene la vida llena.
  const e = [mk(0, 260, 0), mk(0, 120, 1), mk(0, 200, 2)];
  const botPick = g.acquire(shooterB, shooterB.def.weapon, 0);
  const f = [mk(1, 260, 0), mk(1, 120, 1), mk(1, 200, 2)];
  const humanPick = g.acquire(shooterH, shooterH.def.weapon, 0);
  const near = (list, s) => list.slice().sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
  // Peleas 8 contra 8 iguales (mismo lado, con y sin fuego concentrado).
  // El mismo lado (jugador 0) con y sin fuego concentrado, contra 8 iguales sin él.
  const fight = (focus) => {
    let surv = 0; let wins = 0;
    for (let r = 0; r < 10; r++) {
      seedRng(100 + r);
      const gg = new ctx.Game({ mode: 'duel', mapKind: 'continent', difficulty: 'normal', seed: 5 });
      gg.bots = []; for (const u of gg.units) u.alive = false; gg.units = [];
      gg.players[0].focusFire = focus; gg.players[1].focusFire = false;
      const types = ['rifle'];
      const A = gg.freeCellsNear(gg.map.get(-4, 2).i, 'land', 0, 8).map((ci, k) => gg.addUnit(0, types[k % types.length], ci));
      const B = gg.freeCellsNear(gg.map.get(4, -2).i, 'land', 1, 8).map((ci, k) => gg.addUnit(1, types[k % types.length], ci));
      gg.orderMove(A, gg.map.get(4, -2).i, true); gg.orderMove(B, gg.map.get(-4, 2).i, true);
      for (let i = 0; i < 1200; i++) { gg.update(0.1); if (!A.some((u) => u.alive) || !B.some((u) => u.alive)) break; }
      const a = A.filter((u) => u.alive).length;
      surv += a;
      if (a > 0) wins++;
    }
    return { surv: surv / 10, wins };
  };
  const off = fight(false);
  const on = fight(true);
  check('E08', 'Fuego concentrado: con varios enemigos a tiro, el bot dispara primero al más débil',
    botPick === e[1] && humanPick === near([...f, shooterB], shooterH),
    `el bot elige al de ${botPick.hp} de vida (había 260, 120 y 200); el jugador sigue eligiendo el más cercano (${humanPick.hp}); en 10 peleas de 8 Artilleros contra 8, el mismo lado termina con ${off.surv.toFixed(1)} tropas vivas sin fuego concentrado y ${on.surv.toFixed(1)} con él (en peleas iguales casi no cambia el resultado)`);
}

// ---------- E09 hostigamiento ----------
{
  const rows = [];
  for (const mapKind of ['archipelago', 'continent', 'open', 'bay', 'reef']) {
    for (const diff of ['normal', 'hard']) {
      seedRng(31);
      const g = new ctx.Game({ mode: 'duel', mapKind, difficulty: diff, seed: 31, personas: [null, 'aggro'] });
      g.players[0].persona = 'builder';
      const pilot = new ctx.Bot(g, 0);
      pilot.tac = { ...pilot.tac, harass: false };
      g.players[0].focusFire = false;
      g.players[0].core.maxHp = g.players[0].core.hp = 1e7;
      const b = g.bots[0];
      const targets = [];
      let last = null;
      for (let i = 0; i < 15 * 600; i++) {
        g.update(0.1); pilot.update(0.1);
        if (b.lastHarass && b.lastHarass !== last) { last = b.lastHarass; targets.push(`${last.units.join('+')}→${last.target}`); }
      }
      rows.push({ mapKind, diff, n: b.harassSent, first: b.firstHarassAt, targets });
    }
  }
  const withH = rows.filter((r) => r.n > 0).length;
  const easy = (() => { seedRng(31); const g = new ctx.Game({ mode: 'duel', mapKind: 'continent', difficulty: 'easy', seed: 31 }); for (let i = 0; i < 15 * 600; i++) g.update(0.1); return g.bots[0].harassSent; })();
  check('E09', 'Hostigamiento: en Normal y Difícil hay ataques chicos a Granjas o Minas alejadas',
    withH >= 7 && easy === 0 && rows.every((r) => r.targets.every((t) => /→(farm|mine|pump|rig)$/.test(t))),
    `${withH} de ${rows.length} partidas de 15 min con hostigamiento (5 mapas × Normal/Difícil); ejemplos: ${rows.filter((r) => r.n).slice(0, 4).map((r) => `${r.mapKind}/${r.diff} ${r.n} (${r.targets[0]}, primero a ${Math.round(r.first)} s)`).join('; ')}; en Fácil: ${easy}`.replace(/farm/g, 'Granja').replace(/mine/g, 'Mina').replace(/pump/g, 'Bomba').replace(/rig/g, 'Plataforma').replace(/jeep/g, 'Jeep').replace(/ranger/g, 'Ranger').replace(/speedboat/g, 'Lancha').replace(/heli/g, 'Helicóptero'));
}

// ---------- E10 aliados coordinados ----------
{
  const rows = [];
  for (const [mapKind, seed] of [['archipelago', 7], ['continent', 8], ['bay', 9]]) {
    seedRng(seed);
    const g = new ctx.Game({ mode: 'league', mapKind, difficulty: 'normal', seed });
    g.players[0].core.maxHp = g.players[0].core.hp = 1e9;
    let same = 0; let total = 0;
    for (const bot of g.bots) {
      const orig = bot.launch.bind(bot);
      bot.launch = (units, target, announced) => {
        const mates = g.bots.filter((b) => b !== bot && b.p.team === bot.p.team && b.p.alive && b.lastTarget && b.lastTarget.alive);
        const sent = orig(units, target, announced);
        if (sent.length && mates.length) { total++; if (mates.some((m) => m.lastTarget === bot.lastTarget)) same++; }
        return sent;
      };
    }
    // A los 8 min, 6 Tanques enemigos aparecen junto al Núcleo del bot 4 (equipo 1), y sus aliados tienen tropas libres.
    let helped = null;
    for (let i = 0; i < 15 * 600; i++) {
      g.update(0.1);
      if (Math.abs(g.time - 480) < 0.05) {
        // Los aliados del bot 4 tienen 5 tropas libres en casa (en Liga suelen estar peleando).
        for (const pid of [3, 5]) {
          if (!g.players[pid].alive) continue;
          g.freeCellsNear(g.players[pid].core.cell, 'land', pid, 8).slice(3).forEach((ci) => { const u = g.addUnit(pid, 'rifle', ci); u.role = 'home'; });
        }
        const ac = g.players[4].core.cell;
        g.freeCellsNear(ac, 'land', 0, 10).slice(4).forEach((ci) => g.addUnit(1, 'tank', ci));
      }
      if (!helped && g.time > 480) {
        const h = g.bots.find((b) => b.lastHelp && b.lastHelp.ally === 4 && b.lastHelp.t >= 480);
        if (h) helped = { by: h.pid, t: Math.round(h.lastHelp.t - 480), units: h.lastHelp.units };
      }
    }
    rows.push({ mapKind, same, total, helped, helps: g.bots.reduce((s, b) => s + b.helpSent, 0) });
  }
  const sameAll = rows.reduce((s, r) => s + r.same, 0);
  const totAll = rows.reduce((s, r) => s + r.total, 0);
  check('E10', 'Aliados coordinados en Liga 3 vs 3: atacan al mismo rival y ayudan al aliado atacado',
    totAll > 0 && sameAll / totAll >= 0.6 && rows.filter((r) => r.helped).length >= 2,
    `oleadas al mismo rival que un aliado: ${sameAll} de ${totAll} (${Math.round((sameAll / Math.max(1, totAll)) * 100)} %); ayuda al aliado atacado: ${rows.map((r) => `${r.mapKind} ${r.helped ? `bot ${r.helped.by} manda ${r.helped.units} tropas a los ${r.helped.t} s` : 'sin ayuda'}`).join(' · ')}; ayudas en total: ${rows.map((r) => r.helps).join('/')}`);
}

fs.writeFileSync(__dirname + '/results-v08-bots-on-v11.json', JSON.stringify(results, null, 1));
