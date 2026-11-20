// N12 (v1.7): partidas largas con chequeos automáticos cada segundo de juego. Como soak15, y además una de cada dos
// partidas es Personalizada con «Arsenal estratégico»: el piloto fabrica el Lanzador nuclear móvil y lo usa, los bots
// usan el AIR DEFENSE de nivel 4, y se comprueba que nadie lance más de un misil por partida.
// Uso: node soak17.cjs <desde> <hasta> [minutos]  → escribe soak17-<desde>.json
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const V = (e) => vm.runInContext(e, ctx);
const TERRAIN = V('TERRAIN');
const DIFF = V('DIFFICULTY');
const MAX_POP = V('MAX_POP');
const MODES = ['conquest', 'duos', 'league', 'king', 'blitz', 'duel', 'ffa', 'big', 'teams', 'fog'];
const MAPS = ['archipelago', 'open', 'continent', 'bay', 'reef', 'mesa', 'dunes'];
const DIFFS = ['easy', 'normal', 'hard'];
const from = Number(process.argv[2] || 0);
const to = Number(process.argv[3] || 30);
const mins = Number(process.argv[4] || 20);
const seedRandom = (seed) => { let a = (seed * 2654435761) >>> 0; ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const issues = {};
const games = [];
const add = (kind, ex) => { const k = kind; if (!issues[k]) issues[k] = { n: 0, ex: [] }; issues[k].n++; if (issues[k].ex.length < 4) issues[k].ex.push(ex); };
for (let gi = from; gi < to; gi++) {
  const mode = MODES[gi % MODES.length];
  const mapKind = MAPS[gi % MAPS.length];
  const difficulty = DIFFS[gi % 3];
  const seed = 5000 + gi * 17;
  seedRandom(seed);
  const tag = `${mode}/${mapKind}/${difficulty}/${seed}`;
  const strat = gi % 2 === 1;
  let g;
  try {
    g = strat ? new ctx.Game({ mode: 'conquest', mapKind, difficulty, seed, custom: { players: 6, teams: false, coins: 6000, fog: false, turbo: false, king: false, strategic: true } })
      : new ctx.Game({ mode, mapKind, difficulty, seed, fog: mode === 'fog' });
  } catch (e) { add('excepción al crear la partida', `${tag}: ${e.message}`); continue; }
  const fired = {};
  const made = {};
  { const os = g.spawnFrom.bind(g); g.spawnFrom = (b, type) => { made[type] = (made[type] || 0) + 1; return os(b, type); }; }
  if (strat) {
    const orig = g.fireNuke.bind(g);
    g.fireNuke = (owner, src, ci) => { fired[owner] = (fired[owner] || 0) + 1; if (fired[owner] > 1) add('más de un misil con Arsenal estratégico', `${tag} t=${Math.round(g.time)} j${owner}: ${fired[owner]}`); return orig(owner, src, ci); };
  }
  const pilot = new ctx.Bot(g, 0);
  pilot.tac = { ...DIFF.normal.tactics };
  pilot.update = function (dt) { if (!this.p.alive) return; this.t -= dt; this.defendT -= dt; if (this.t > 0) return; this.t = DIFF.normal.think * (0.8 + ctx.Math.random() * 0.4); this.think(); if (strat) stratPilot(); };
  // Con Arsenal estratégico, el piloto fabrica el Lanzador nuclear móvil, lo acerca a un rival y lo usa.
  const stratPilot = () => {
    if (g.time < 420 || g.strategicLeft(0) <= 0) return;
    const p = g.players[0];
    // Ayuda de la prueba: a los 7 minutos el piloto recibe 30.000 monedas y, si no tiene, una Fábrica terminada,
    // para que el lanzador llegue a usarse en todas las partidas con la opción.
    if (!stratPilot.gave) {
      stratPilot.gave = true;
      p.coins += 30000;
      p.energy = Math.max(p.energy, 120);
      if (!g.buildings.some((b) => b.alive && b.owner === 0 && b.type === 'factory') && p.core && p.core.alive) {
        const core = g.cells[p.core.cell];
        const c = g.cells.filter((x) => !g.placeInvalid(0, 'factory', x.i, true)).sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0];
        if (c) g.addBuilding(0, 'factory', c.i, true);
      }
    }
    const nl = g.units.find((u) => u.alive && u.owner === 0 && u.type === 'nukelauncher');
    if (!nl) {
      const fac = g.buildings.find((b) => b.alive && b.owner === 0 && b.type === 'factory' && b.built);
      if (fac && p.coins >= 22000 + 2000 && !fac.queue.some((q) => q.type === 'nukelauncher')) g.enqueue(fac, 'nukelauncher');
      return;
    }
    if (g.mobileState(nl) !== 'ready') return;
    const foes = g.buildings.filter((b) => b.alive && g.isEnemy(0, b.owner));
    const inRange = foes.filter((b) => !g.mobileNukeInvalid(nl, b.cell));
    if (inRange.length) { const why = g.launchMobileNuke(nl, inRange[0].cell); if (why) add('el lanzador no pudo lanzar', `${tag} t=${Math.round(g.time)}: ${why}`); return; }
    if (nl.state === 'idle' && foes.length) {
      const t = foes.sort((a, b) => g.map.dist(g.cells[a.cell], g.cells[nl.cell]) - g.map.dist(g.cells[b.cell], g.cells[nl.cell]))[0];
      g.orderMove([nl], t.cell);
    }
  };
  const st = new Map();
  const bq = new Map();
  const t0 = Date.now();
  let crashed = false;
  for (let i = 0; i < mins * 600 && !g.over; i++) {
    try { g.update(0.1); if (!g.over) pilot.update(0.1); } catch (e) { add('excepción en la partida', `${tag} t=${Math.round(g.time)}: ${e.message} ${String(e.stack).split('\n')[1] || ''}`); crashed = true; break; }
    if (i % 10) continue;
    const T = Math.round(g.time);
    for (const p of g.players) {
      if (!Number.isFinite(p.coins) || p.coins < -1) add('monedas raras', `${tag} t=${T} ${p.name}: ${p.coins}`);
      if (!Number.isFinite(p.energy)) add('energía rara', `${tag} t=${T} ${p.name}: ${p.energy}`);
      if (p.popUsed > MAX_POP + 10) add('comunidad por encima del máximo', `${tag} t=${T} ${p.name}: ${p.popUsed}`);
    }
    for (const u of g.units) {
      if (!u.alive) { st.delete(u); continue; }
      const ex = (msg) => `${tag} t=${T} ${u.type}#${u.id} (j${u.owner}) ${msg}`;
      if (![u.x, u.z, u.y, u.hp].every(Number.isFinite)) add('número raro en una tropa', ex(`x=${u.x} z=${u.z} hp=${u.hp}`));
      if (u.hp > u.maxHp + 0.01) add('vida mayor que el máximo', ex(`${u.hp}/${u.maxHp}`));
      if (u.inside) { if (!u.inside.alive) add('tropa dentro de un transporte destruido', ex(u.inside.type)); st.delete(u); continue; }
      const c = g.cells[u.cell];
      if (!c) { add('tropa en una casilla que no existe', ex(u.cell)); continue; }
      if (u.mover === 'land' && !TERRAIN[c.t].land) add('tropa de tierra en el agua', ex(`casilla ${u.cell} ${c.t} estado ${u.state}`));
      if (u.mover === 'sea' && !TERRAIN[c.t].water) add('barco en tierra', ex(`casilla ${u.cell} ${c.t}`));
      if (u.mover !== 'air' && Math.hypot(u.x - c.x, u.z - c.z) > 1.6) add('tropa lejos de su casilla', ex(`${Math.hypot(u.x - c.x, u.z - c.z).toFixed(2)}`));
      // Atascos: misma orden, misma casilla y sin progreso.
      let prog = '';
      if (u.state === 'build' && u.buildTarget) prog = `${(u.buildTarget.progress || 0).toFixed(3)}|${u.buildTarget.upgrading ? u.buildTarget.upgrading.progress.toFixed(3) : ''}`;
      else if (u.state === 'repair' && u.repairTarget) prog = Math.round(u.repairTarget.hp);
      else if (u.state === 'attack' && u.target) prog = `${Math.round(u.target.hp)}|${Math.round(u.target.shield || 0)}|${u.target.cell}`;
      // Disparando sin moverse (Avanzar atacando o Patrullar): cuenta como avance si el blanco pierde vida o escudo.
      const w = u.def.weapon;
      const ft = w && u.autoTarget && u.autoTarget.alive && g.inRange(u, w, u.autoTarget) ? u.autoTarget : null;
      if (ft && u.state !== 'attack') prog += `|ft${ft.id}:${Math.round(ft.hp)}:${Math.round(ft.shield || 0)}`;
      const key = `${u.state}|${u.cell}|${prog}`;
      const s = st.get(u);
      if (s && s.key === key) s.t++; else st.set(u, { key, t: 0 });
      const cur = st.get(u);
      if (cur.t === 60 && !['idle', 'guard'].includes(u.state)) add(`atascada en «${u.state}»`, ex(`casilla ${u.cell}${u.target ? ` objetivo ${u.target.type || u.target.kind}#${u.target.id}` : ''}${u.boardTarget ? ` transporte ${u.boardTarget.type}` : ''}${u.buildTarget ? ` obra ${u.buildTarget.type} built=${u.buildTarget.built}` : ''} path=${u.path ? u.path.length : 0}/${u.pathI}`));
    }
    for (const b of g.buildings) {
      if (!b.alive) { bq.delete(b); continue; }
      const ex = (msg) => `${tag} t=${T} ${b.type}#${b.id} (j${b.owner}) ${msg}`;
      if (!Number.isFinite(b.hp)) add('número raro en un edificio', ex(b.hp));
      if (b.hp > b.maxHp + 0.01) add('edificio con más vida que el máximo', ex(`${b.hp}/${b.maxHp}`));
      if (g.cells[b.cell].bld !== b) add('la casilla no sabe de su edificio', ex(`casilla ${b.cell}`));
      if (b.built && b.queue.length) {
        const q = b.queue[0];
        const key = `${q.type}|${q.t.toFixed(3)}`;
        const s = bq.get(b);
        if (s && s.key === key) s.t++; else bq.set(b, { key, t: 0 });
        const p = g.players[b.owner];
        if (bq.get(b).t === 60) add('cola de producción parada', ex(`${q.type} t=${q.t.toFixed(1)} energía ${Math.round(p.energy)} comunidad ${p.popUsed}/${p.popCap} prodRate ${g.prodRate ? g.prodRate(b).toFixed(2) : '?'}`));
      } else bq.delete(b);
    }
    // Celdas que apuntan a edificios muertos.
    if (i % 600 === 0) for (const c of g.cells) if (c.bld && !c.bld.alive) add('casilla con un edificio destruido', `${tag} t=${T} casilla ${c.i} ${c.bld.type}`);
  }
  games.push({ tag: tag + (strat ? '/estrategico' : ''), result: g.result || (crashed ? 'error' : 'sin terminar'), time: Math.round(g.time), ms: Date.now() - t0, nukes: fired,
    mobile: made.nukelauncher || 0, used: strat ? g.players.map((p) => p.stratUsed || 0) : null,
    newUnits: ['drone', 'fpv', 'mlrs', 'missileboat'].reduce((o, k) => { o[k] = made[k] || 0; return o; }, {}) });
  console.log(tag, g.result || (crashed ? 'error' : 'sin terminar'), Math.round(g.time), `${((Date.now() - t0) / 1000).toFixed(0)}s`, Object.keys(issues).length, 'tipos de problema');
}
fs.writeFileSync(`${__dirname}/${process.env.SOAKP || 'soak17'}-${from}.json`, JSON.stringify({ games, issues }, null, 1));
