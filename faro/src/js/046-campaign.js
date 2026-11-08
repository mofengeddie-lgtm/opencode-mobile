'use strict';
// Campaña «La ruta del Faro» (v0.7): prepara cada misión, sigue su meta y calcula las estrellas.
// El estado de la misión vive en game.camp (solo datos simples, para que se guarde con la partida).

const Campaign = {
  def(id) {
    return CAMPAIGN.find((m) => m.id === id) || null;
  },

  // Modo de juego de una misión: todos contra todos. Las monedas extra son solo para ti.
  mode(id) {
    const m = this.def(id);
    const teams = [];
    for (let i = 0; i < m.players; i++) teams.push(i);
    return { name: `Misión ${m.id} · ${m.name}`, players: m.players, teams, campaign: m.id };
  },

  // Opciones para empezar una misión: mapa y semilla fijos, así siempre es la misma isla.
  opts(id) {
    const m = this.def(id);
    return { mode: 'campaign', mission: id, mapKind: m.mapKind, difficulty: m.difficulty, seed: m.seed, personas: m.personas.slice() };
  },

  // Una misión está abierta si es la primera, si terminaste la anterior o en modo creador.
  unlocked(id, P, creator) {
    if (creator || id === 1) return true;
    return !!(P && P.campaign && P.campaign.done[id - 1]);
  },

  goalText(m) {
    const g = m.goal;
    if (g.kind === 'eco') return `Llega a ${fmt(g.income)} monedas por minuto y ten ${g.army} tropas de combate.`;
    if (g.kind === 'survive') return `Aguanta ${Math.round(g.time / 60)} minutos con tu Núcleo en pie.`;
    if (g.kind === 'hold') return `Toma el Faro y mantenlo ${g.time} s en total.`;
    if (g.kind === 'flags') return `Captura ${g.count} Banderas de otras islas.`;
    return m.players > 2 ? 'Sé el último Núcleo en pie.' : 'Destruye el Núcleo enemigo.';
  },

  starText(s) {
    if (s.kind === 'time') return `En menos de ${Math.round(s.max / 60)} min`;
    if (s.kind === 'lostBld') return s.max === 0 ? 'Sin perder edificios' : `Pierdes ${s.max} edificios o menos`;
    if (s.kind === 'lostUnits') return `Pierdes ${s.max} tropas o menos`;
    if (s.kind === 'coreEnd') return `Núcleo sobre el ${Math.round(s.min * 100)} % al terminar`;
    return `Tu Núcleo nunca baja del ${Math.round(s.min * 100)} %`;
  },

  // ---------- preparación ----------
  setup(g) {
    const m = this.def(g.opts.mission);
    const me = g.players[0];
    g.camp = {
      id: m.id, lostBld: 0, minCore: 1, faroHold: 0, flags: [], won: false, checkT: 0,
      homeComp: g.cells[me.core.cell].comp,
    };
    if (m.coins) me.coins = m.coins;
    for (const bot of g.bots) {
      if (m.passive) bot.passive = true;
      if (m.firstWave) bot.nextWaveAt = m.firstWave + Math.random() * 15;
      if (m.waveEvery) bot.waveMult = m.waveEvery;
      if (m.enemyStart) this.giveStart(g, bot.pid, m.enemyStart);
      if (m.fortress) this.fortify(g, bot.pid);
      if (m.guardFlags) this.guardFlags(g, bot.pid, m.guardFlags);
      if (m.guardFaro) this.guardPoints(g, bot.pid, g.points.filter((pt) => pt.type === 'faro'), m.guardFaro.units);
    }
    if (m.myStart) this.giveStart(g, 0, m.myStart);
    g.recomputeTerritory();
    g.refreshEconomy();
  },

  // Casilla libre más cercana al Núcleo donde cabe ese edificio (en su territorio o en agua libre).
  spotFor(g, pid, type) {
    const core = g.cells[g.players[pid].core.cell];
    let best = -1;
    let bd = Infinity;
    for (const c of g.cells) {
      if (c.bld || c.point || (c.owner >= 0 && c.owner !== pid)) continue;
      const d = g.map.dist(c, core);
      if (d > 8 || d < 2) continue;
      const why = g.placeInvalid(pid, type, c.i, true);
      if (why && !(why === 'Fuera de tu territorio' && c.owner < 0 && type === 'harbor')) continue;
      if (type === 'harbor' && (c.t !== 'shallow' || !g.map.isCoast(c))) continue;
      if (d < bd) { bd = d; best = c.i; }
    }
    return best;
  },

  giveStart(g, pid, spec) {
    const p = g.players[pid];
    let harbor = null;
    for (const type of spec.buildings || []) {
      const ci = this.spotFor(g, pid, type);
      if (ci < 0) continue;
      const b = g.addBuilding(pid, type, ci, true);
      if (type === 'harbor') harbor = b;
      g.recomputeTerritory();
    }
    const sea = (spec.units || []).filter((t) => UNITS[t].mover === 'sea');
    const land = (spec.units || []).filter((t) => UNITS[t].mover !== 'sea');
    if (sea.length && harbor) {
      const cells = g.freeCellsNear(harbor.cell, 'sea', pid, sea.length);
      sea.forEach((t, k) => { if (cells[k] !== undefined) g.addUnit(pid, t, cells[k]); });
    }
    const cells = g.freeCellsNear(p.core.cell, 'land', pid, land.length + 2);
    land.forEach((t, k) => { if (cells[k + 2] !== undefined) g.addUnit(pid, t, cells[k + 2]); });
  },

  // Cruzar el mar: el rival ya tiene las Banderas de otras islas más cercanas a ti, con guardias.
  guardFlags(g, pid, spec) {
    const mine = g.cells[g.players[0].core.cell];
    const flags = g.points.filter((pt) => pt.type === 'flag' && g.cells[pt.cell].comp !== g.camp.homeComp)
      .sort((a, b) => g.map.dist(g.cells[a.cell], mine) - g.map.dist(g.cells[b.cell], mine)).slice(0, spec.count);
    this.guardPoints(g, pid, flags, spec.units);
  },

  // El rival empieza dueño de esos puntos, con guardias a su lado.
  guardPoints(g, pid, points, units) {
    for (const pt of points) {
      pt.owner = pid;
      pt.prog = 1;
      pt.capTeam = g.players[pid].team;
      const cells = g.freeCellsNear(pt.cell, 'land', pid, units.length);
      units.forEach((t, k) => {
        const u = g.addUnit(pid, t, cells[k]);
        u.role = 'guard';
      });
    }
    g.territoryDirty = true;
  },

  // Asedio: Núcleo en nivel 2, arco de murallas, Torretas de nivel 3 y 2 y AIR DEFENSE detrás.
  fortify(g, pid) {
    const core = g.players[pid].core;
    const cc = g.cells[core.cell];
    const mine = g.cells[g.players[0].core.cell];
    const dir = Math.atan2(mine.z - cc.z, mine.x - cc.x);
    const off = (c) => {
      let a = Math.atan2(c.z - cc.z, c.x - cc.x) - dir;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return Math.abs(a);
    };
    const free = (c) => !c.bld && !c.point && TERRAIN[c.t].land && !['gold', 'fertile', 'oilland'].includes(c.t);
    const ring = (d) => g.cells.filter((c) => g.map.dist(c, cc) === d && free(c)).sort((a, b) => off(a) - off(b));
    const level = (b, lv) => {
      if (lv <= 1) return;
      b.upgrading = { level: lv, progress: 1 };
      g.finishUpgrade(b);
    };
    level(core, 2);
    for (const c of ring(3)) if (off(c) < 1.3) g.addBuilding(pid, 'wall', c.i, true);
    const r2 = ring(2);
    const picks = [];
    const take = (ok) => {
      const c = r2.find((x) => !picks.includes(x) && ok(x) && picks.every((p) => g.map.dist(p, x) >= 2));
      if (c) picks.push(c);
      return c;
    };
    const front = take(() => true);
    if (front) level(g.addBuilding(pid, 'turret', front.i, true), 3);
    for (let k = 0; k < 2; k++) {
      const c = take((x) => off(x) > 0.45 && off(x) < 2);
      if (c) level(g.addBuilding(pid, 'turret', c.i, true), 2);
    }
    const back = [...r2].reverse().find((x) => !picks.includes(x) && off(x) > 1.8);
    if (back) g.addBuilding(pid, 'aadef', back.i, true);
  },

  // ---------- durante la partida ----------
  update(g, dt) {
    const c = g.camp;
    if (!c || g.over || g.preview) return;
    const core = g.players[0].core;
    if (core.alive) c.minCore = Math.min(c.minCore, core.hp / core.maxHp);
    c.checkT -= dt;
    if (c.checkT > 0) return;
    const step = 0.25 - c.checkT;
    c.checkT = 0.25;
    const m = this.def(c.id);
    if (m.goal.kind === 'hold') {
      const faro = g.points.find((pt) => pt.type === 'faro');
      if (faro && faro.owner === 0) c.faroHold += step;
    } else if (m.goal.kind === 'flags') {
      for (const pt of g.points) {
        if (pt.type === 'flag' && pt.owner === 0 && g.cells[pt.cell].comp !== c.homeComp && !c.flags.includes(pt.id)) {
          c.flags.push(pt.id);
          g.emit('toast', { text: `Bandera de otra isla: ${c.flags.length} de ${m.goal.count}`, kind: 'good' });
        }
      }
    }
    if (this.goalMet(g)) this.win(g);
  },

  army(g) {
    return g.units.filter((u) => u.alive && u.owner === 0 && u.def.weapon).length;
  },

  goalMet(g) {
    const c = g.camp;
    const goal = this.def(c.id).goal;
    const me = g.players[0];
    if (!me.alive) return false;
    if (goal.kind === 'eco') return me.income >= goal.income && this.army(g) >= goal.army;
    if (goal.kind === 'survive') return g.time >= goal.time;
    if (goal.kind === 'hold') return c.faroHold >= goal.time;
    if (goal.kind === 'flags') return c.flags.length >= goal.count;
    return false; // destroy: lo decide checkEnd cuando cae el último Núcleo rival
  },

  win(g) {
    if (g.over) return;
    g.over = true;
    g.result = 'victory';
    g.camp.won = true;
    g.emit('over', { result: 'victory', mission: true });
  },

  // Líneas de la meta con su progreso (para el panel de objetivos).
  goalLines(g) {
    const c = g.camp;
    const m = this.def(c.id);
    const goal = m.goal;
    const me = g.players[0];
    if (goal.kind === 'eco') {
      const army = this.army(g);
      return [
        { text: `Ingresos: ${fmt(me.income)} / ${fmt(goal.income)} por min`, done: me.income >= goal.income },
        { text: `Tropas de combate: ${Math.min(army, goal.army)} / ${goal.army}`, done: army >= goal.army },
      ];
    }
    if (goal.kind === 'survive') {
      return [{ text: `Aguanta: ${fmtTime(Math.min(g.time, goal.time))} / ${fmtTime(goal.time)}`, done: g.time >= goal.time }];
    }
    if (goal.kind === 'hold') {
      const faro = g.points.find((pt) => pt.type === 'faro');
      const now = faro && faro.owner === 0 ? ' · ¡es tuyo!' : '';
      return [{ text: `Faro en tu poder: ${Math.floor(Math.min(c.faroHold, goal.time))} / ${goal.time} s${now}`, done: c.faroHold >= goal.time }];
    }
    if (goal.kind === 'flags') {
      return [{ text: `Banderas de otras islas: ${Math.min(c.flags.length, goal.count)} / ${goal.count}`, done: c.flags.length >= goal.count }];
    }
    const rivals = g.players.filter((p) => !p.human);
    const down = rivals.filter((p) => !p.alive).length;
    if (rivals.length === 1) return [{ text: down ? 'Núcleo enemigo destruido' : 'Destruye el Núcleo enemigo', done: down > 0 }];
    return [{ text: `Núcleos rivales caídos: ${down} / ${rivals.length}`, done: down >= rivals.length }];
  },

  // Estrellas: la primera por terminar y dos por condiciones. final = al acabar la partida.
  stars(g) {
    const c = g.camp;
    const m = this.def(c.id);
    const me = g.players[0];
    const won = c.won || (g.over && g.result === 'victory');
    const core = me.core;
    const coreK = core && core.alive ? core.hp / core.maxHp : 0;
    const out = [{ text: 'Termina la misión', ok: won, live: true, why: won ? '' : 'No se cumplió la meta' }];
    for (const s of m.stars) {
      let ok;
      let live;
      let why;
      let now;
      if (s.kind === 'time') {
        live = g.time < s.max;
        ok = won && live;
        now = live ? `quedan ${fmtTime(s.max - g.time)}` : 'se acabó el tiempo';
        why = `Tardaste ${fmtTime(g.time)}`;
      } else if (s.kind === 'lostBld' || s.kind === 'lostUnits') {
        const n = s.kind === 'lostBld' ? c.lostBld : me.stats.lost;
        live = n <= s.max;
        ok = won && live;
        now = `llevas ${n}`;
        why = `Perdiste ${n} ${s.kind === 'lostBld' ? (n === 1 ? 'edificio' : 'edificios') : (n === 1 ? 'tropa' : 'tropas')}`;
      } else if (s.kind === 'coreEnd') {
        live = coreK >= s.min;
        ok = won && live;
        now = `ahora ${Math.round(coreK * 100)} %`;
        why = `Tu Núcleo terminó al ${Math.round(coreK * 100)} %`;
      } else {
        live = c.minCore >= s.min;
        ok = won && live;
        now = `mínimo ${Math.round(c.minCore * 100)} %`;
        why = `Tu Núcleo bajó al ${Math.round(c.minCore * 100)} %`;
      }
      if (!won && live) why = 'Hay que terminar la misión';
      out.push({ text: this.starText(s), ok, live, now, why: ok ? '' : why });
    }
    return out;
  },
};
