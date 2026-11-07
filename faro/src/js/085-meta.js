'use strict';
// Vestíbulo y progresión (documento págs. 14-27): jugar, modos, personalizado, tutorial, pase,
// misiones, premio diario, códigos, tienda, cofres, inventario, final de partida, volver a la
// partida (punto 16) y modo creador (punto 19). El progreso se guarda en este navegador.

const PROFILE_KEY = 'faro-profile-v1';
const XP_REWARD = { play: 40, win: 60, island: 10, core: 20, mission: 50 };
const LEVEL_XP = 1000;
const PASS_TIERS = 40;
const PASS_TIER_XP = 300;
const DAILY_REWARDS = [20, 20, 30, 30, 40, 40, 'faro'];
const GAME_CRYSTALS = { play: 10, win: 20 };
const MISSION_CRYSTALS = { daily: 25, weekly: 80 };
const CODES = {
  FARO2026: { text: '+100 cristales', crystals: 100 },
  PRIMERAISLA: { text: 'Un Cofre de Isla gratis', chest: 'isla' },
  AMBAR: { text: '+300 XP', xp: 300 },
};
const RARITY = {
  comun: { name: 'Común', price: 150, refund: 20 },
  raro: { name: 'Raro', price: 300, refund: 50 },
  epico: { name: 'Épico', price: 600, refund: 120 },
  legendario: { name: 'Legendario', price: 1200, refund: 300 },
};
const CHESTS = {
  isla: { name: 'Cofre de Isla', cost: 350, odds: { comun: 60, raro: 28, epico: 10, legendario: 2 } },
  faro: { name: 'Cofre del Faro', cost: 600, odds: { comun: 40, raro: 38, epico: 17, legendario: 5 } },
};
const CHEST_PITY = 30;
const SKIN_SLOTS = {
  inf: { name: 'Soldados', model: 'rifle' },
  veh: { name: 'Vehículos', model: 'tank' },
  sea: { name: 'Barcos', model: 'destroyer' },
  core: { name: 'Núcleo', model: 'core' },
};
const SKINS = [
  ['selva', 'inf', 'comun'], ['selva', 'veh', 'comun'], ['selva', 'sea', 'raro'], ['selva', 'core', 'epico'],
  ['artico', 'inf', 'comun'], ['artico', 'veh', 'raro'], ['artico', 'sea', 'raro'], ['artico', 'core', 'epico'],
  ['castillo', 'inf', 'raro'], ['castillo', 'veh', 'raro'], ['castillo', 'sea', 'epico'], ['castillo', 'core', 'legendario'],
  ['neon', 'inf', 'raro'], ['neon', 'veh', 'epico'], ['neon', 'sea', 'epico'], ['neon', 'core', 'legendario'],
].map(([look, slot, rar]) => ({ id: look + '_' + slot, look, slot, rar, name: `${SKIN_SLOTS[slot].name} ${SKIN_LOOKS[look].name}` }));
SKINS.push({ id: 'toxico_inf', look: 'toxico', slot: 'inf', rar: 'legendario', name: 'Brigada Tóxica' });
SKINS.push({ id: 'dorado_inf', look: 'dorado', slot: 'inf', rar: 'legendario', name: 'Soldado Dorado', special: 'Premio del Tutorial' });
const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
const CRYSTAL_PACKS = [
  { name: 'Bolsa de cristales', amount: 100 },
  { name: 'Caja de cristales', amount: 550 },
  { name: 'Cofre de cristales', amount: 1200 },
  { name: 'Tesoro del Faro', amount: 2600 },
];
const MISSIONS = {
  daily: [
    { id: 'd_play', text: 'Juega 2 partidas', stat: 'games', goal: 2 },
    { id: 'd_win', text: 'Gana 1 partida', stat: 'wins', goal: 1 },
    { id: 'd_build', text: 'Construye 12 edificios', stat: 'built', goal: 12 },
    { id: 'd_train', text: 'Entrena 15 tropas', stat: 'trained', goal: 15 },
    { id: 'd_cap', text: 'Captura 2 Banderas o el Faro', stat: 'captures', goal: 2 },
    { id: 'd_kill', text: 'Destruye 25 enemigos', stat: 'kills', goal: 25 },
    { id: 'd_up', text: 'Mejora 3 edificios', stat: 'upgrades', goal: 3 },
  ],
  weekly: [
    { id: 'w_win', text: 'Gana 5 partidas', stat: 'wins', goal: 5 },
    { id: 'w_play', text: 'Juega 10 partidas', stat: 'games', goal: 10 },
    { id: 'w_core', text: 'Destruye 5 Núcleos', stat: 'cores', goal: 5 },
    { id: 'w_build', text: 'Construye 60 edificios', stat: 'built', goal: 60 },
    { id: 'w_kill', text: 'Destruye 150 enemigos', stat: 'kills', goal: 150 },
    { id: 'w_cap', text: 'Captura 12 Banderas o el Faro', stat: 'captures', goal: 12 },
  ],
};
const MISSION_BY_ID = Object.fromEntries([...MISSIONS.daily, ...MISSIONS.weekly].map((m) => [m.id, m]));
const TUTORIAL_STEPS = [
  { id: 'energy', text: '1 · Construí: entrena un Constructor en el Núcleo y construye una energía (Solar o Eólica)' },
  { id: 'army', text: '2 · Producí: construye un Cuartel y ten 5 tropas de combate' },
  { id: 'kill', text: '3 · Atacá: destruye el Núcleo del bot' },
];
const LOBBY_MAPS = ['archipelago', 'open', 'continent', 'bay', 'reef'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function skinSlotOf(kind, type) {
  if (kind === 'bld') return type === 'core' ? 'core' : null;
  const d = UNITS[type];
  if (!d) return null;
  if (d.mover === 'sea') return 'sea';
  if (d.cls === 'inf') return 'inf';
  if (d.cls === 'veh') return 'veh';
  return null;
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayNum(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

function keyOfDay(n) {
  const d = new Date(n * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Semana que empieza el lunes (el 1 de enero de 1970 fue jueves).
function weekKey(d = new Date()) {
  return 'w' + Math.floor((dayNum(dayKey(d)) + 3) / 7);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function cssColor(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

// ---------- perfil del jugador ----------
const Profile = {
  data: null,
  memoryOnly: false,

  defaults() {
    return {
      v: 1, seed: (Math.random() * 1e9) | 0, since: dayKey(), xp: 0, crystals: 0,
      stats: { games: 0, wins: 0, islands: 0, cores: 0, kills: 0 },
      owned: {}, equipped: { inf: null, veh: null, sea: null, core: null }, badges: {},
      tutorialDone: false, pass: {}, daily: { idx: 0, last: null, lost: 0 }, codes: {},
      missions: { day: null, daily: [], rerolled: false, week: null, weekly: [] },
      chests: { pity: 0, opened: 0 },
      play: { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal' },
      custom: { kind: 'conquest', players: 4, mapKind: 'archipelago', coins: START_COINS, difficulty: 'normal', teams: false, fog: false, turbo: false },
      creator: { on: true, instant: false },
    };
  },

  load() {
    const d = this.defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (saved && saved.v === 1) {
        for (const k of Object.keys(saved)) {
          if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && saved[k] && typeof saved[k] === 'object') Object.assign(d[k], saved[k]);
          else d[k] = saved[k];
        }
      }
    } catch (err) {
      this.memoryOnly = true;
    }
    if (!MODES[d.play.mode] || !MODES[d.play.mode].lobby) d.play.mode = 'conquest';
    if (!MAPS[d.play.mapKind]) d.play.mapKind = 'archipelago';
    if (!DIFFICULTY[d.play.difficulty]) d.play.difficulty = 'normal';
    this.data = d;
    this.refresh();
    return d;
  },

  save() {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.data));
    } catch (err) {
      this.memoryOnly = true;
    }
  },

  level(xp = this.data.xp) {
    return 1 + Math.floor(xp / LEVEL_XP);
  },

  passTier() {
    return Math.min(PASS_TIERS, Math.floor(this.data.xp / PASS_TIER_XP));
  },

  // Cambio de día o de semana: misiones nuevas y racha del premio diario.
  refresh() {
    const P = this.data;
    const today = dayKey();
    const M = P.missions;
    if (M.day !== today) {
      M.day = today;
      M.daily = this.pick(MISSIONS.daily, 3, 'd' + today).map((m) => ({ id: m.id, prog: 0, done: false }));
      M.rerolled = false;
    }
    const wk = weekKey();
    if (M.week !== wk) {
      M.week = wk;
      M.weekly = this.pick(MISSIONS.weekly, 3, wk).map((m) => ({ id: m.id, prog: 0, done: false }));
    }
    // Premio diario: si faltas un día, la racha baja 1 (por cada día que faltes).
    const D = P.daily;
    if (D.last) {
      const gap = dayNum(today) - dayNum(D.last);
      if (gap > 1) {
        const missed = gap - 1;
        D.lost = Math.min(D.idx, missed);
        D.idx = Math.max(0, D.idx - missed);
        D.last = keyOfDay(dayNum(today) - 1);
      }
    }
    this.save();
  },

  pick(pool, n, key) {
    const rng = mulberry32(hashStr(key) ^ this.data.seed);
    const list = pool.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list.slice(0, n);
  },

  rerollDaily(i) {
    const M = this.data.missions;
    const cur = M.daily[i];
    if (!cur || cur.done || M.rerolled) return false;
    const used = new Set(M.daily.map((m) => m.id));
    const options = MISSIONS.daily.filter((m) => !used.has(m.id));
    if (!options.length) return false;
    const next = options[Math.floor(Math.random() * options.length)];
    M.daily[i] = { id: next.id, prog: 0, done: false };
    M.rerolled = true;
    this.save();
    return true;
  },

  dailyClaimable() {
    return this.data.daily.last !== dayKey();
  },

  passClaimable() {
    let n = 0;
    for (let t = 1; t <= this.passTier(); t++) if (!this.data.pass[t]) n++;
    return n;
  },

  owns(id) {
    return !!this.data.owned[id] || (Creator.active() && !!SKIN_BY_ID[id]);
  },

  looks() {
    const out = {};
    for (const [slot, id] of Object.entries(this.data.equipped)) {
      if (id && SKIN_BY_ID[id] && this.owns(id)) out[slot] = SKIN_BY_ID[id].look;
    }
    return out;
  },
};

function passReward(t) {
  if (t % 10 === 0) return { chest: 'faro', text: 'Cofre del Faro' };
  if (t % 5 === 0) return { chest: 'isla', text: 'Cofre de Isla' };
  const n = 20 + 5 * Math.floor((t - 1) / 10);
  return { crystals: n, text: `${n} cristales` };
}

// ---------- modo creador (solo la cuenta dueña del juego) ----------
const Creator = {
  owner: false,
  checked: false,

  // La plataforma de Claude dice si quien abre el enlace es el dueño. Sin plataforma, nadie lo es.
  async detect() {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const user = await window.claude.use('user');
        this.owner = !!(user && (await user.isOwner()));
      }
    } catch (err) {
      this.owner = false;
    }
    this.checked = true;
    return this.owner;
  },

  active() {
    return this.owner && !!(Profile.data && Profile.data.creator.on);
  },
};

// ---------- vestíbulo ----------
class Lobby {
  constructor(app) {
    this.app = app;
    this.view = 'play';
    this.sub = 'main';
    this.shopTab = 'skins';
    this.modal = null;
    $('lobby-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-view]');
      if (!b) return;
      this.view = b.dataset.view;
      if (this.view === 'play') this.syncOpts();
      this.render();
    });
    $('menu').addEventListener('click', (e) => this.onClick(e));
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal')) this.closeModal();
      else this.onClick(e);
    });
    $('modal').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.id === 'code-form') this.redeem($('code-input').value);
    });
    this.syncOpts(true);
    this.render();
  }

  get P() {
    return Profile.data;
  }

  // Opciones de la partida según la vista (Jugar, Personalizado o Tutorial).
  optsFor(sub = this.sub) {
    const P = this.P;
    if (sub === 'custom') {
      const c = P.custom;
      return {
        mode: c.kind === 'king' ? 'king' : 'conquest', mapKind: c.mapKind, difficulty: c.difficulty,
        custom: { players: c.players, teams: c.teams, coins: c.coins, fog: c.fog, turbo: c.turbo, king: c.kind === 'king' },
      };
    }
    if (sub === 'tutorial') return { mode: 'tutorial', mapKind: 'continent', difficulty: 'easy' };
    return { mode: P.play.mode, mapKind: P.play.mapKind, difficulty: P.play.difficulty };
  }

  syncOpts(first) {
    const next = this.optsFor();
    const o = this.app.opts;
    const players = (x) => (x.custom ? x.custom.players + ':' + x.custom.teams : MODES[x.mode].players);
    const changed = first || o.mode !== next.mode || o.mapKind !== next.mapKind || players(o) !== players(next);
    this.app.opts = { ...next, seed: o.seed || ((Math.random() * 1e9) | 0) };
    if (changed && !first && this.app.loaded) this.app.makePreview();
  }

  setPlay(key, value) {
    if (this.sub === 'custom') this.P.custom[key] = value;
    else this.P.play[key] = value;
    Profile.save();
    this.syncOpts();
    this.render();
  }

  // ---------- dibujo ----------
  render() {
    if (!Profile.data) return;
    const P = this.P;
    $('crystals').textContent = Creator.active() ? '∞' : fmt(P.crystals);
    $('lvl-badge').textContent = `Nivel ${Profile.level()}`;
    $('creator-badge').hidden = !Creator.active();
    document.querySelectorAll('#lobby-tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === this.view)));
    const body = $('lobby-body');
    body.classList.toggle('wide', this.view !== 'play');
    if (this.view === 'shop') body.innerHTML = this.shopHtml();
    else if (this.view === 'inv') body.innerHTML = this.invHtml();
    else body.innerHTML = this.leftHtml() + `<div class="lmain">${this.mainHtml()}</div>` + this.sideHtml();
    if (this.modal) this.renderModal();
  }

  leftHtml() {
    const item = (sub, label, hint) => `<button type="button" data-act="sub" data-sub="${sub}" class="${this.sub === sub ? 'on' : ''}">${label}${hint ? `<small>${hint}</small>` : ''}</button>`;
    const off = (label) => `<button type="button" disabled title="Necesita servidores">${label}<small>Roblox</small></button>`;
    return `<nav class="lmenu panel" aria-label="Menú del vestíbulo">
      ${item('main', 'Jugar')}
      ${item('custom', 'Personalizado', 'mitad de XP')}
      ${item('tutorial', 'Tutorial', this.P.tutorialDone ? 'hecho' : 'premio')}
      ${off('Rangos')}${off('Top jugadores')}${off('Servidores')}
    </nav>`;
  }

  resumeHtml() {
    const app = this.app;
    if (app.suspended && !app.suspended.over) {
      const g = app.suspended;
      return `<div class="resume"><p><b>Partida en pausa</b> · ${esc(g.mode.name)} · ${fmtTime(g.time)}</p>
        <div class="row"><button class="btn gold" type="button" data-act="resume">Volver a la partida</button>
        <button class="btn" type="button" data-act="abandon">Abandonar</button></div></div>`;
    }
    const s = Save.peek();
    if (s) {
      return `<div class="resume"><p><b>Partida guardada</b> · ${esc(s.mode || '')} · ${esc(s.map || '')} · ${fmtTime(s.time || 0)}</p>
        <div class="row"><button class="btn gold" type="button" data-act="load">Continuar partida guardada</button>
        <button class="btn" type="button" data-act="abandon">Borrar</button></div></div>`;
    }
    return '';
  }

  mainHtml() {
    const P = this.P;
    const resume = this.resumeHtml();
    if (this.sub === 'custom') return resume + this.customHtml();
    if (this.sub === 'tutorial') return resume + this.tutorialHtml();
    const m = MODES[P.play.mode];
    const diffs = Object.entries(DIFFICULTY).map(([k, d]) => `<button type="button" data-act="diff" data-v="${k}" class="${P.play.difficulty === k ? 'on' : ''}">${d.name}</button>`).join('');
    const st = P.stats;
    const pct = st.games ? Math.round((st.wins / st.games) * 100) : 0;
    return `${resume}
      <section class="lcard panel">
        <div class="mode-now"><small>Modo</small><b>${esc(m.name)}</b><span>${esc(m.desc)}</span>
          <span>Mapa: <b>${esc(MAPS[P.play.mapKind].name)}</b></span></div>
        <div class="play-row">
          <button class="btn" type="button" data-act="modal" data-m="modes">Cambiar</button>
          <button class="btn gold" type="button" data-act="play" id="btn-play">Play</button>
          <button class="btn" type="button" data-act="modal" data-m="maps">Mapa</button>
        </div>
        <div class="field"><label>Dificultad de los bots</label><div class="seg">${diffs}</div></div>
        <div class="row"><button class="btn" type="button" data-act="reroll">Otra isla</button></div>
      </section>
      <section class="lcard panel">
        <h3>Tus números</h3>
        <div class="numbers">
          <span>Partidas</span><b>${st.games}</b>
          <span>Victorias</span><b>${st.wins}</b>
          <span>% de victorias</span><b>${pct} %</b>
          <span>Islas tomadas</span><b>${st.islands}</b>
          <span>Núcleos destruidos</span><b>${st.cores}</b>
          <span>Jugando desde</span><b>${prettyDate(P.since)}</b>
        </div>
      </section>`;
  }

  customHtml() {
    const c = this.P.custom;
    const seg = (key, list) => `<div class="seg">${list.map(([v, label]) => `<button type="button" data-act="cset" data-k="${key}" data-v="${v}" class="${String(c[key]) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
    return `<section class="lcard panel">
      <h2>Personalizado</h2>
      <p>Arma tu partida contra bots. Da la mitad de XP.</p>
      <div class="field"><label>Modo</label>${seg('kind', [['conquest', 'Conquista'], ['king', 'Rey del Faro']])}</div>
      <div class="field"><label>Jugadores</label>${seg('players', [[2, '2 (Duelo 1 vs 1)'], [3, '3'], [4, '4'], [5, '5'], [6, '6']])}</div>
      <div class="field"><label>Mapa</label>${seg('mapKind', LOBBY_MAPS.map((k) => [k, MAPS[k].name]))}</div>
      <div class="field"><label>Monedas iniciales</label>${seg('coins', [[2000, '2.000'], [4000, '4.000'], [6000, '6.000'], [10000, '10.000']])}</div>
      <div class="field"><label>Dificultad</label>${seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.name]))}</div>
      <div class="field"><label>Equipos</label>${seg('teams', [[false, 'Todos contra todos'], [true, 'Dos equipos']])}</div>
      <div class="field"><label>Extras</label>${seg('fog', [[false, 'Sin niebla'], [true, 'Niebla']])}${seg('turbo', [[false, 'Ritmo normal'], [true, 'Turbo ×2']])}</div>
      <div class="row">
        <button class="btn gold" type="button" data-act="play" id="btn-play-custom">Jugar personalizado</button>
        <button class="btn" type="button" disabled>Unirse con código · Disponible en Roblox</button>
      </div>
    </section>`;
  }

  tutorialHtml() {
    const done = this.P.tutorialDone;
    return `<section class="lcard panel">
      <h2>Tutorial</h2>
      <p>Tres pasos contra un bot lento con un Núcleo débil.</p>
      <ol class="steps">${TUTORIAL_STEPS.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>
      <div class="prizes">
        <div><b>Primer Faro</b><span>Insignia</span></div>
        <div><b>150 cristales</b><span>Una sola vez</span></div>
        <div><b>Soldado Dorado</b><span>Aspecto legendario</span></div>
      </div>
      <p>${done ? 'Ya recibiste el premio. Puedes repetir el tutorial cuando quieras.' : 'El premio se entrega la primera vez que lo terminas.'}</p>
      <div class="row"><button class="btn gold" type="button" data-act="play" id="btn-play-tutorial">Empezar tutorial</button></div>
    </section>`;
  }

  sideHtml() {
    const P = this.P;
    const lv = Profile.level();
    const into = P.xp % LEVEL_XP;
    const tier = Profile.passTier();
    const passN = Profile.passClaimable();
    const missionsLeft = [...P.missions.daily, ...P.missions.weekly].filter((m) => !m.done).length;
    const btn = (m, ic, title, sub, badge) => `<button class="sidebtn" type="button" data-act="modal" data-m="${m}">
      <span class="ic">${ic}</span><span><b>${title}</b><small>${sub}</small></span>${badge ? `<span class="badge">${badge}</span>` : '<span></span>'}</button>`;
    return `<aside class="lside">
      <div class="lcard panel"><h3>Nivel ${lv}</h3><div class="xpbar"><i style="width:${(into / LEVEL_XP) * 100}%"></i></div>
        <p>${fmt(into)} / ${fmt(LEVEL_XP)} XP</p></div>
      ${btn('pass', 'P', 'Pase del Faro', `Nivel ${tier} de ${PASS_TIERS}`, passN || '')}
      ${btn('missions', 'M', 'Misiones', `${missionsLeft} por hacer`, '')}
      ${btn('daily', 'D', 'Premio diario', Profile.dailyClaimable() ? '¡Listo para reclamar!' : 'Vuelve mañana', Profile.dailyClaimable() ? '1' : '')}
      ${btn('codes', 'C', 'Códigos', 'Canjea un código', '')}
      ${Creator.owner ? btn('creator', '★', 'Modo creador', Creator.active() ? 'Activado' : 'Apagado', '') : ''}
    </aside>`;
  }

  shopHtml() {
    const P = this.P;
    const tabs = [['skins', 'Apariencias'], ['chests', 'Cofres'], ['crystals', 'Cristales']]
      .map(([k, l]) => `<button type="button" data-act="shoptab" data-v="${k}" class="${this.shopTab === k ? 'on' : ''}">${l}</button>`).join('');
    let inner = '';
    if (this.shopTab === 'skins') {
      inner = `<p>Solo cambian cómo se ven tus tropas y tu Núcleo: vida, daño y velocidad = iguales.</p>
        <div class="shopgrid">${SKINS.filter((s) => !s.special).map((s) => {
    const own = Profile.owns(s.id);
    const price = RARITY[s.rar].price;
    return `<div class="item ${own ? 'owned' : ''}">
            <img alt="" src="${Thumbs.get(SKIN_SLOTS[s.slot].model, PLAYER_COLORS[0], s.look)}">
            <b>${esc(s.name)}</b><span class="rar ${s.rar}">${RARITY[s.rar].name}</span>
            ${own ? '<small>Ya es tuyo</small>' : `<button class="btn" type="button" data-act="buy" data-id="${s.id}" ${P.crystals < price ? 'disabled' : ''}>${fmt(price)} cristales</button>`}
          </div>`;
  }).join('')}</div>`;
    } else if (this.shopTab === 'chests') {
      inner = `<div class="mode-cards">${Object.entries(CHESTS).map(([k, C]) => `<div class="chest">
          <b>${C.name}</b>
          <div class="probs">${Object.entries(C.odds).map(([r, pct]) => `<span class="rar ${r}">${RARITY[r].name}</span><div class="xpbar"><i style="width:${pct}%"></i></div><span>${pct} %</span>`).join('')}</div>
          <button class="btn gold" type="button" data-act="chest" data-v="${k}" ${P.crystals < C.cost && !Creator.active() ? 'disabled' : ''}>Abrir · ${fmt(C.cost)} cristales</button>
        </div>`).join('')}</div>
        <p>Garantía: 1 legendario cada ${CHEST_PITY} cofres (te faltan ${CHEST_PITY - P.chests.pity}). Si sale un aspecto repetido, te devolvemos cristales (${Object.values(RARITY).map((r) => `${r.name} ${r.refund}`).join(', ')}).</p>`;
    } else {
      inner = `<p>Los cristales se ganan jugando: partidas, misiones, pase y premio diario. Comprarlos con dinero real solo estará en Roblox.</p>
        <div class="shopgrid">${CRYSTAL_PACKS.map((c) => `<div class="item"><b>${esc(c.name)}</b><span>${fmt(c.amount)} cristales</span>
          <button class="btn" type="button" disabled>Solo en Roblox</button></div>`).join('')}</div>`;
    }
    return `<section class="lcard panel"><header class="rowx"><h2>Tienda</h2><span class="crystals"><i></i><b>${Creator.active() ? '∞' : fmt(P.crystals)}</b></span></header>
      <div class="subtabs">${tabs}</div>${inner}</section>`;
  }

  invHtml() {
    const P = this.P;
    const rows = Object.entries(SKIN_SLOTS).map(([slot, S]) => {
      const mine = SKINS.filter((s) => s.slot === slot && Profile.owns(s.id));
      const eq = P.equipped[slot];
      const none = `<button type="button" class="item ${!eq ? 'equipped' : ''}" data-act="equip" data-slot="${slot}" data-id="">
        <img alt="" src="${Thumbs.get(S.model, PLAYER_COLORS[0])}"><b>Normal</b><small>${!eq ? 'Equipado' : 'Equipar'}</small></button>`;
      return `<div class="field"><label>${S.name}</label><div class="shopgrid">${none}${mine.map((s) => `
        <button type="button" class="item ${eq === s.id ? 'equipped' : 'owned'}" data-act="equip" data-slot="${slot}" data-id="${s.id}">
          <img alt="" src="${Thumbs.get(S.model, PLAYER_COLORS[0], s.look)}"><b>${esc(s.name)}</b>
          <span class="rar ${s.rar}">${RARITY[s.rar].name}</span><small>${eq === s.id ? 'Equipado' : 'Equipar'}</small></button>`).join('')}
        </div></div>`;
    }).join('');
    const badges = P.badges.primerFaro ? '<span class="lvl">Insignia: Primer Faro</span>' : '<p>Termina el Tutorial para ganar la insignia «Primer Faro».</p>';
    return `<section class="lcard panel"><h2>Inventario</h2>
      <p>Toca un aspecto para equiparlo. Se ve en tus tropas y tu Núcleo en la próxima partida.</p>
      ${rows}<h3>Insignias</h3>${badges}</section>`;
  }

  // ---------- ventanas ----------
  openModal(name, data) {
    this.modal = name;
    this.modalData = data || null;
    $('modal').hidden = false;
    this.renderModal();
  }

  closeModal() {
    this.modal = null;
    $('modal').hidden = true;
  }

  renderModal() {
    const P = this.P;
    const head = (t) => `<header><h2>${t}</h2><button class="btn icon" type="button" data-act="close" aria-label="Cerrar">${ICON.close}</button></header>`;
    let html = '';
    const n = this.modal;
    if (n === 'modes') {
      const lv = Profile.level();
      html = head('Elige un modo') + `<div class="mode-cards">${Object.entries(MODES).filter(([, m]) => m.lobby).map(([k, m]) => {
        const locked = m.minLevel && lv < m.minLevel && !Creator.active();
        return `<button type="button" class="mode-card ${P.play.mode === k ? 'on' : ''}" data-act="pickmode" data-v="${k}" ${locked ? 'disabled' : ''}>
          <b>${esc(m.name)}</b><small>${esc(m.desc)}</small>${locked ? `<em>Desde nivel ${m.minLevel}</em>` : ''}</button>`;
      }).join('')}</div>`;
    } else if (n === 'maps') {
      html = head('Elige un mapa') + `<div class="mode-cards">${LOBBY_MAPS.map((k) => `<button type="button" class="mode-card ${P.play.mapKind === k ? 'on' : ''}" data-act="pickmap" data-v="${k}">
        <b>${esc(MAPS[k].name)}</b><small>${esc(MAPS[k].desc)}</small></button>`).join('')}</div>`;
    } else if (n === 'pass') {
      const tier = Profile.passTier();
      const tiers = [];
      for (let t = 1; t <= PASS_TIERS; t++) {
        const r = passReward(t);
        const reached = t <= tier;
        const claimed = !!P.pass[t];
        tiers.push(`<div class="tier ${reached ? 'reached' : ''} ${claimed ? 'claimed' : ''}"><b>${t}</b><span>${r.text}</span>
          ${claimed ? '<small>Reclamado</small>' : reached ? `<button class="mini-btn" type="button" data-act="passclaim" data-v="${t}">Reclamar</button>` : `<small>${fmt(t * PASS_TIER_XP)} XP</small>`}</div>`);
      }
      html = head('Pase del Faro') + `<p>Pista gratis de ${PASS_TIERS} niveles. Cada ${PASS_TIER_XP} XP subes un nivel del pase. Llevas ${fmt(P.xp)} XP (nivel ${tier}).</p>
        ${Profile.passClaimable() ? '<div class="row"><button class="btn gold" type="button" data-act="passall">Reclamar todo</button></div>' : ''}
        <div class="tiers">${tiers.join('')}</div>`;
    } else if (n === 'missions') {
      const row = (m, i, kind) => {
        const d = MISSION_BY_ID[m.id];
        const prog = Math.min(d.goal, m.prog);
        return `<div class="mission ${m.done ? 'done' : ''}"><span>${esc(d.text)}</span>
          <span>${m.done ? 'Hecha' : `${prog} / ${d.goal}`}${kind === 'daily' && !m.done && !P.missions.rerolled ? ` <button class="mini-btn" type="button" data-act="reroll-m" data-v="${i}">Cambiar</button>` : ''}</span>
          <div class="xpbar"><i style="width:${(prog / d.goal) * 100}%"></i></div></div>`;
      };
      html = head('Misiones') + `<p>Cada misión da ${XP_REWARD.mission} XP y cristales (${MISSION_CRYSTALS.daily} las diarias, ${MISSION_CRYSTALS.weekly} las semanales). Se completan al terminar una partida.</p>
        <h3>Diarias${P.missions.rerolled ? ' · ya cambiaste una hoy' : ' · puedes cambiar 1 al día'}</h3>${P.missions.daily.map((m, i) => row(m, i, 'daily')).join('')}
        <h3>Semanales</h3>${P.missions.weekly.map((m, i) => row(m, i, 'weekly')).join('')}`;
    } else if (n === 'daily') {
      const D = P.daily;
      const can = Profile.dailyClaimable();
      html = head('Premio diario') + `<p>Entra cada día para avanzar. Si faltas un día, la racha baja 1.${D.lost ? ` Faltaste y bajaste ${D.lost}.` : ''}</p>
        <div class="daygrid">${DAILY_REWARDS.map((r, i) => `<div class="day ${i < D.idx ? 'done' : ''} ${i === D.idx && can ? 'today' : ''} ${r === 'faro' ? 'big' : ''}">
          <span>Día ${i + 1}</span><b>${r === 'faro' ? 'Cofre' : r}</b><small>${r === 'faro' ? 'del Faro' : 'cristales'}</small></div>`).join('')}</div>
        <div class="row"><button class="btn gold" type="button" data-act="dailyclaim" ${can ? '' : 'disabled'}>${can ? `Reclamar día ${D.idx + 1}` : 'Ya reclamaste hoy'}</button></div>`;
    } else if (n === 'codes') {
      html = head('Códigos') + `<form id="code-form" class="field"><label for="code-input">Escribe un código</label>
        <input type="text" id="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="FARO2026">
        <button class="btn gold" type="submit">Canjear</button></form>
        ${this.modalData && this.modalData.msg ? `<div class="advice">${esc(this.modalData.msg)}</div>` : ''}
        <p>Cada código se usa una vez. Los códigos nuevos se anuncian en las actualizaciones.</p>`;
    } else if (n === 'creator') {
      const C = P.creator;
      html = head('Modo creador') + `<p>Solo lo ves tú: la plataforma confirma que eres el dueño de este juego. Los demás jugadores no pueden abrirlo.</p>
        <div class="field"><label>Monedas y energía infinitas · todo desbloqueado</label><div class="seg">
          <button type="button" data-act="creator" data-k="on" data-v="true" class="${C.on ? 'on' : ''}">Activado</button>
          <button type="button" data-act="creator" data-k="on" data-v="false" class="${!C.on ? 'on' : ''}">Apagado</button></div></div>
        <div class="field"><label>Construcción rápida</label><div class="seg">
          <button type="button" data-act="creator" data-k="instant" data-v="true" class="${C.instant ? 'on' : ''}">Sí</button>
          <button type="button" data-act="creator" data-k="instant" data-v="false" class="${!C.instant ? 'on' : ''}">No</button></div></div>
        <p>Las partidas en modo creador no dan XP ni cristales. En Roblox se hará igual, con tu UserId comprobado en el servidor.</p>`;
    } else if (n === 'chestopen') {
      const r = this.modalData;
      html = head(esc(r.chest)) + `<div class="item ${r.dup ? 'owned' : 'equipped'}" style="cursor:default">
        <img alt="" src="${Thumbs.get(SKIN_SLOTS[r.item.slot].model, PLAYER_COLORS[0], r.item.look)}">
        <b>${esc(r.item.name)}</b><span class="rar ${r.item.rar}">${RARITY[r.item.rar].name}</span>
        <small>${r.dup ? `Repetido: te devolvemos ${r.refund} cristales` : '¡Nuevo! Ya está en tu Inventario'}</small></div>
        <div class="row"><button class="btn gold" type="button" data-act="close">Genial</button>
        ${r.dup ? '' : `<button class="btn" type="button" data-act="equip" data-slot="${r.item.slot}" data-id="${r.item.id}">Equipar</button>`}</div>`;
    } else if (n === 'info') {
      html = head(esc(this.modalData.title)) + `<p>${esc(this.modalData.text)}</p><div class="row"><button class="btn gold" type="button" data-act="close">Aceptar</button></div>`;
    }
    $('modal-body').innerHTML = html;
  }

  // ---------- acciones ----------
  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const P = this.P;
    const act = b.dataset.act;
    const app = this.app;
    app.sound.unlock();
    app.sound.play('click');
    if (act === 'sub') {
      this.sub = b.dataset.sub;
      this.syncOpts();
      this.render();
    } else if (act === 'play') {
      this.syncOpts();
      app.startGame();
    } else if (act === 'reroll') {
      app.reroll();
    } else if (act === 'diff') {
      this.setPlay('difficulty', b.dataset.v);
    } else if (act === 'cset') {
      let v = b.dataset.v;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^\d+$/.test(v)) v = Number(v);
      this.setPlay(b.dataset.k, v);
    } else if (act === 'modal') {
      this.openModal(b.dataset.m);
    } else if (act === 'close') {
      this.closeModal();
    } else if (act === 'pickmode') {
      P.play.mode = b.dataset.v;
      Profile.save();
      this.closeModal();
      this.syncOpts();
      this.render();
    } else if (act === 'pickmap') {
      P.play.mapKind = b.dataset.v;
      Profile.save();
      this.closeModal();
      this.syncOpts();
      this.render();
    } else if (act === 'resume') {
      app.resumeGame();
    } else if (act === 'load') {
      app.loadSavedGame();
    } else if (act === 'abandon') {
      app.abandonGame();
    } else if (act === 'passclaim') {
      this.claimTier(Number(b.dataset.v));
    } else if (act === 'passall') {
      for (let t = 1; t <= Profile.passTier(); t++) if (!P.pass[t]) this.claimTier(t, true);
      this.render();
    } else if (act === 'reroll-m') {
      Profile.rerollDaily(Number(b.dataset.v));
      this.render();
    } else if (act === 'dailyclaim') {
      this.claimDaily();
    } else if (act === 'shoptab') {
      this.shopTab = b.dataset.v;
      this.render();
    } else if (act === 'buy') {
      this.buySkin(b.dataset.id);
    } else if (act === 'chest') {
      this.openChest(b.dataset.v, false);
    } else if (act === 'equip') {
      P.equipped[b.dataset.slot] = b.dataset.id || null;
      Profile.save();
      if (this.modal === 'chestopen') this.closeModal();
      this.render();
    } else if (act === 'creator') {
      if (!Creator.owner) return;
      P.creator[b.dataset.k] = b.dataset.v === 'true';
      Profile.save();
      this.render();
    }
  }

  give(r) {
    const P = this.P;
    if (r.crystals) P.crystals += r.crystals;
    if (r.xp) P.xp += r.xp;
    if (r.chest) return this.openChest(r.chest, true);
    return null;
  }

  claimTier(t, quiet) {
    const P = this.P;
    if (t < 1 || t > Profile.passTier() || P.pass[t]) return;
    P.pass[t] = true;
    const r = passReward(t);
    if (r.chest) this.openChest(r.chest, true, quiet);
    else this.give(r);
    Profile.save();
    if (!quiet) this.render();
  }

  claimDaily() {
    const P = this.P;
    if (!Profile.dailyClaimable()) return;
    const D = P.daily;
    const r = DAILY_REWARDS[D.idx];
    D.last = dayKey();
    D.lost = 0;
    D.idx = (D.idx + 1) % DAILY_REWARDS.length;
    if (r === 'faro') this.openChest('faro', true);
    else {
      P.crystals += r;
      this.app.ui.toast(`+${r} cristales`, 'good');
    }
    Profile.save();
    this.render();
  }

  redeem(raw) {
    const P = this.P;
    const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    let msg;
    if (!code) msg = 'Escribe un código.';
    else if (!CODES[code]) msg = 'Ese código no existe.';
    else if (P.codes[code]) msg = 'Ya usaste este código.';
    else {
      P.codes[code] = dayKey();
      msg = `¡Listo! ${CODES[code].text}.`;
      const c = CODES[code];
      if (c.chest) {
        Profile.save();
        this.openChest(c.chest, true);
        return;
      }
      this.give(c);
    }
    Profile.save();
    this.modalData = { msg };
    this.render();
  }

  buySkin(id) {
    const P = this.P;
    const s = SKIN_BY_ID[id];
    if (!s || Profile.owns(id) || s.special) return;
    const price = RARITY[s.rar].price;
    if (P.crystals < price) return;
    P.crystals -= price;
    P.owned[id] = true;
    Profile.save();
    this.app.ui.toast(`Compraste ${s.name}`, 'good');
    this.render();
  }

  openChest(kind, free, quiet) {
    const P = this.P;
    const C = CHESTS[kind];
    if (!C) return null;
    if (!free && !Creator.active()) {
      if (P.crystals < C.cost) return null;
      P.crystals -= C.cost;
    }
    P.chests.opened++;
    P.chests.pity++;
    let roll = Math.random() * 100;
    let rar = 'comun';
    for (const [r, pct] of Object.entries(C.odds)) {
      if (roll < pct) {
        rar = r;
        break;
      }
      roll -= pct;
    }
    // Garantía: si llevas 29 cofres sin legendario, el siguiente lo es.
    if (P.chests.pity >= CHEST_PITY) rar = 'legendario';
    if (rar === 'legendario') P.chests.pity = 0;
    const pool = SKINS.filter((s) => s.rar === rar && !s.special);
    const item = pool[Math.floor(Math.random() * pool.length)];
    const dup = !!P.owned[item.id];
    const refund = dup ? RARITY[rar].refund : 0;
    if (dup) P.crystals += refund;
    else P.owned[item.id] = true;
    Profile.save();
    const result = { chest: C.name, item, dup, refund };
    if (!quiet) {
      this.openModal('chestopen', result);
      this.render();
    }
    return result;
  }

  // ---------- final de partida ----------
  finish(game) {
    if (game.rewarded) return game.reward || null;
    game.rewarded = true;
    const P = this.P;
    const me = game.players[0];
    const win = game.result === 'victory';
    const out = { xp: 0, crystals: 0, lines: [], missions: [], levelUp: false, creator: !!game.creator, tutorial: null };
    if (game.creator) {
      game.reward = out;
      return out;
    }
    Profile.refresh();
    const lv0 = Profile.level();
    const half = game.opts.custom ? 0.5 : 1;
    const parts = [
      ['Jugar', XP_REWARD.play],
      ['Ganar', win ? XP_REWARD.win : 0],
      [`Islas tomadas (${me.stats.captures})`, me.stats.captures * XP_REWARD.island],
      [`Núcleos destruidos (${me.coresKilled})`, me.coresKilled * XP_REWARD.core],
    ];
    for (const [label, n] of parts) {
      const v = Math.round(n * half);
      if (v > 0) {
        out.xp += v;
        out.lines.push(`${label}: +${v} XP`);
      }
    }
    if (half < 1) out.lines.push('Personalizado: mitad de XP');
    out.crystals = Math.round((GAME_CRYSTALS.play + (win ? GAME_CRYSTALS.win : 0)) * half);
    P.stats.games++;
    if (win) P.stats.wins++;
    P.stats.islands += me.stats.captures;
    P.stats.cores += me.coresKilled;
    P.stats.kills += me.stats.kills;
    // Misiones: suman lo que hiciste en esta partida.
    const delta = { games: 1, wins: win ? 1 : 0, built: me.stats.built, trained: me.stats.trained, captures: me.stats.captures,
      kills: me.stats.kills, upgrades: me.stats.upgrades, cores: me.coresKilled };
    for (const kind of ['daily', 'weekly']) {
      for (const m of P.missions[kind]) {
        if (m.done) continue;
        const d = MISSION_BY_ID[m.id];
        m.prog += delta[d.stat] || 0;
        if (m.prog >= d.goal) {
          m.done = true;
          out.xp += XP_REWARD.mission;
          out.crystals += MISSION_CRYSTALS[kind];
          out.missions.push(d.text);
        }
      }
    }
    // Tutorial: premio único al terminarlo por primera vez.
    if (game.mode.tutorial && win && !P.tutorialDone) {
      P.tutorialDone = true;
      P.badges.primerFaro = true;
      P.owned.dorado_inf = true;
      out.crystals += 150;
      out.tutorial = 'Insignia «Primer Faro», 150 cristales y el aspecto Soldado Dorado';
    }
    P.xp += out.xp;
    P.crystals += out.crystals;
    out.level = Profile.level();
    out.levelUp = out.level > lv0;
    Profile.save();
    game.reward = out;
    return out;
  }

  positions(game) {
    const winTeam = game.kingWinner !== undefined ? game.kingWinner : (game.players.find((p) => p.alive) || {}).team;
    const alive = game.players.filter((p) => p.alive).sort((a, b) => (b.team === winTeam) - (a.team === winTeam));
    const list = [];
    let rank = 0;
    let lastWin = null;
    alive.forEach((p, i) => {
      const w = p.team === winTeam;
      if (!(w && lastWin)) rank = i + 1;
      lastWin = w;
      list.push({ p, rank, note: w ? 'Ganador' : 'Seguía en pie' });
    });
    for (let i = game.elimOrder.length - 1; i >= 0; i--) {
      const e = game.elimOrder[i];
      list.push({ p: game.players[e.pid], rank: list.length + 1, note: `Cayó a los ${fmtTime(e.time)}` });
    }
    return list;
  }

  advice(game) {
    const hb = game.players[0].stats.hitBy || {};
    const groups = {};
    for (const [k, v] of Object.entries(hb)) {
      const d = UNITS[k];
      const g = k === 'bld' ? 'bld' : !d ? 'other' : k === 'arty' ? 'arty' : d.cls === 'inf' ? 'inf' : d.cls === 'veh' ? 'veh' : d.cls === 'air' ? 'air' : 'sea';
      groups[g] = (groups[g] || 0) + v;
    }
    const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
    const tips = {
      bld: 'Las torretas y defensas enemigas te hicieron mucho daño. Atácalas desde lejos con Tanques o Lanzamisiles.',
      inf: 'La infantería enemiga te desgastó. Prueba Escopeteros, Jeeps o Torretas mejoradas con miniguns.',
      veh: 'Los vehículos enemigos te superaron. Los Cazadores y Coheteros hacen más daño a tanques.',
      air: 'Te atacaron desde el aire. Construye AIR DEFENSE y Camiones antiaéreos cerca del Núcleo.',
      sea: 'Los barcos atacaron tu costa. Pon Torretas en la costa, ten Destructores y mejora el Núcleo para la Cúpula.',
      arty: 'Los Lanzamisiles te atacaron de lejos. Sube el Núcleo a nivel 3 y compra la Cúpula.',
    };
    if (top && tips[top[0]]) return tips[top[0]];
    return 'Entrena Constructores pronto y construye más Granjas y energía: con más monedas tendrás un ejército más grande.';
  }

  endHtml(game) {
    const r = this.finish(game);
    const me = game.players[0];
    const s = me.stats;
    const win = game.result === 'victory';
    const pos = this.positions(game);
    const text = game.kingWinner !== undefined
      ? (win ? `Tu equipo mantuvo el Faro ${fmtTime(KING_TIME)}.` : 'Otro imperio mantuvo el Faro el tiempo necesario.')
      : (win ? 'Todos los Núcleos rivales cayeron. El archipiélago es tuyo.' : 'Tu Núcleo fue destruido.');
    const prizes = r.creator
      ? '<div><b>Modo creador</b><span>Sin XP ni cristales</span></div>'
      : `<div><b>+${fmt(r.xp)} XP</b><span>${r.lines.map(esc).join(' · ')}</span></div>
         <div><b>+${fmt(r.crystals)} cristales</b><span>${r.missions.length ? 'Incluye misiones' : 'Por jugar' + (win ? ' y ganar' : '')}</span></div>
         <div><b>Nivel ${r.level}</b><span>${r.levelUp ? '¡Subiste de nivel!' : `${fmt(this.P.xp % LEVEL_XP)} / ${fmt(LEVEL_XP)} XP`}</span></div>`;
    return `
      <div class="endhero"><div><h2>${win ? '¡Victoria!' : 'Derrota'}</h2><p>${esc(text)}</p></div></div>
      <div class="endstats">
        <div><b>${fmtTime(game.time)}</b><span>Tiempo</span></div>
        <div><b>${s.captures}</b><span>Islas tomadas</span></div>
        <div><b>${s.trained}</b><span>Tropas entrenadas</span></div>
        <div><b>${me.coresKilled}</b><span>Núcleos destruidos</span></div>
      </div>
      <h3 class="lbl">Posiciones</h3>
      <div class="positions">${pos.map((x) => `<div class="${x.p.id === 0 ? 'me' : ''}"><b>${x.rank}.º</b><i style="background:${cssColor(x.p.color)}"></i>
        <span>${esc(x.p.name)}</span><small>${esc(x.note)}</small></div>`).join('')}</div>
      <h3 class="lbl">Premios</h3>
      <div class="prizes">${prizes}</div>
      ${r.missions.length ? `<div class="advice">Misiones completadas: ${r.missions.map(esc).join(', ')}</div>` : ''}
      ${r.tutorial ? `<div class="advice">Premio del Tutorial: ${esc(r.tutorial)}</div>` : ''}
      ${win ? '' : `<div class="advice"><b>Consejo:</b> ${esc(this.advice(game))}</div>`}
      <div class="row">
        <button class="btn" type="button" id="btn-watch">Mirar el final</button>
        <button class="btn gold" type="button" id="btn-again">Revancha</button>
        <button class="btn" type="button" id="btn-menu">Vestíbulo</button>
      </div>`;
  }
}
