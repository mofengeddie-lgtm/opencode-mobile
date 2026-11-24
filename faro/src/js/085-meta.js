'use strict';
// Vestíbulo y progresión (documento págs. 14-27): jugar, modos, personalizado, tutorial, pase,
// misiones, premio diario, códigos, tienda, cofres, inventario, final de partida, volver a la
// partida (punto 16) y modo creador (punto 19). El progreso se guarda en este navegador.

const PROFILE_KEY = 'faro-profile-v1';
// v1.7: si el perfil guardado no se puede leer, se guarda tal cual aquí y no se pisa.
const PROFILE_BAK_KEY = 'faro-profile-v1-copia';
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
  ['frente', 'inf', 'comun'], ['frente', 'veh', 'raro'], ['frente', 'sea', 'raro'], ['frente', 'core', 'epico'],
  ['marea', 'inf', 'raro'], ['marea', 'veh', 'raro'], ['marea', 'sea', 'epico'], ['marea', 'core', 'legendario'],
].map(([look, slot, rar]) => ({ id: look + '_' + slot, look, slot, rar, name: `${SKIN_SLOTS[slot].name} ${SKIN_LOOKS[look].name}` }));
SKINS.push({ id: 'toxico_inf', look: 'toxico', slot: 'inf', rar: 'legendario', name: 'Brigada Tóxica' });
SKINS.push({ id: 'dorado_inf', look: 'dorado', slot: 'inf', rar: 'legendario', name: 'Soldado Dorado', special: 'Premio del Tutorial' });
const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s]));
// v1.2: planos y fragmentos. Un cofre da un aspecto (70 %), un plano (20 %) o fragmentos (10 %).
// Los repetidos se vuelven fragmentos; en el Taller, plano + fragmentos = aspecto.
const CHEST_SPLIT = { skin: 70, plan: 20 };
const FRAG_DUP = { comun: 15, raro: 30, epico: 60, legendario: 120 };
const FRAG_COST = { comun: 60, raro: 120, epico: 240, legendario: 480 };
const FRAG_PACK = [20, 40];
const FRAG_GAME = { play: 4, win: 8 };
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
// v1.3: los 3 pasos de tu documento de juego v2 (pág. 18), con la Barcaza que pide el PRD 1.5.
const TUTORIAL_STEPS = [
  { id: 'tut_build', text: '1 · Construí: pon otra Granja y una energía (Solar o Eólica)' },
  { id: 'tut_army', text: '2 · Producí: construye un Cuartel y entrena 3 soldados' },
  { id: 'kill', text: '3 · Atacá: cruza el mar en una Barcaza y toma la isla del bot' },
];
const LOBBY_MAPS = ['archipelago', 'open', 'continent', 'bay', 'reef', 'mesa', 'dunes'];
// v1.2: miniatura de cada mapa (se dibuja una vez con una semilla fija y se guarda).
const MAP_THUMBS = {};
// Lo que trae esta versión (ventana «Acerca de»).
const ABOUT_NEWS = [
  'El juego ahora está en español y en inglés: elige el idioma en Ajustes · Interfaz (si no, usa el de tu navegador).',
  'Todo viene dentro del juego: el motor 3D y las letras ya no se descargan de otros sitios.',
  'Funciona aunque el navegador no deje guardar (por ejemplo, en modo incógnito) y te avisa que el progreso no se guardará.',
  'Se ve bien también en pantallas apaisadas chicas, desde 640 × 360.',
  'Mientras juegas, espacio, flechas y rueda ya no mueven la página.',
  'Versión preparada para Poki: anuncios de Poki entre partidas y «🎬 Doble premio» opcional al terminar.',
];

// v1.7: Arsenal. Familias para los filtros y lo que se estrena en esta versión.
// v1.8: los filtros del PRD 1.8 del usuario (sección 56): drones, helicópteros y aviación por separado.
const ARSENAL_FILTERS = [['all', 'Todos'], ['inf', 'Infantería'], ['land', 'Tierra'], ['drone', 'Drones'], ['heli', 'Helicópteros'],
  ['plane', 'Aviación'], ['sea', 'Mar'], ['bld', 'Edificios'], ['strat', 'Estratégico']];
// v1.8: todo lo que entró del catálogo del usuario se marca «Nuevo».
const ARSENAL_NEW = ['scout', 'soldier', 'officer', 'radioman', 'sapper', 'mortar', 'paratrooper', 'marine', 'atguided', 'gunner', 'antidrone',
  'robodog', 'armoredcar', 'ifv', 'trooptruck', 'ambulance', 'recovery', 'supplytruck', 'tanker', 'commandveh', 'mobileradar', 'howitzer',
  'towedgun', 'tankdestroyer', 'amphib', 'bridgelayer', 'clearer', 'dozer', 'thermo', 'scoutdrone', 'cargodrone', 'interceptor', 'navaldrone',
  'subdrone', 'transheli', 'rescueheli', 'navalheli', 'attackjet', 'heavybomber', 'transportplane', 'awacs', 'tankerplane', 'ewplane', 'gunship',
  'gunboat', 'battleship', 'patrolboat', 'corvette', 'cruiser', 'landingship', 'logship', 'hospitalship', 'hovercraft', 'minesweeper',
  'minelayer', 'reconsub', 'stratsub', 'corral', 'powerplant', 'workshop', 'research', 'radarstation', 'dronecenter', 'shipyard', 'depot', 'hq',
  'bunker', 'gate', 'coastal', 'ciws', 'laser', 'watchtower', 'silo', 'bridge', 'dock'];
const ARSENAL_ON = { land: 'en tierra', landcoast: 'en tierra junto al agua', coast: 'en el agua junto a la orilla', shallowcoast: 'en agua baja junto a la costa', deep: 'en mar profundo' };
function arsenalItems() {
  const out = [];
  for (const [k, d] of Object.entries(UNITS)) {
    // v1.8: aire separado en drones, helicópteros y aviación (los drones de mar también están en «Drones»).
    const air = d.drone ? 'drone' : d.plane ? 'plane' : 'heli';
    const fam = d.strategic ? 'strat' : d.cls === 'inf' ? 'inf' : d.cls === 'veh' ? 'land' : d.cls === 'air' ? air : 'sea';
    const also = d.strategic ? [d.mover === 'sea' ? 'sea' : 'land'] : (k === 'navaldrone' || k === 'subdrone') ? ['drone'] : [];
    out.push({ key: k, kind: 'unit', def: d, fam, also });
  }
  for (const [k, d] of Object.entries(BUILDINGS)) {
    if (k === 'seamine') continue;
    out.push({ key: k, kind: 'bld', def: d, fam: 'bld', also: k === 'antinuke' || k === 'aadef' || k === 'silo' ? ['strat'] : [] });
  }
  return out;
}
function arsenalRole(it) {
  const d = it.def;
  if (it.kind === 'bld') {
    const tab = BUILD_TABS.find((t) => t.items.includes(it.key));
    return tab ? tab.name : it.key === 'core' ? T$('Base') : T$('Especial');
  }
  if (d.strategic) return T$('Estratégico');
  return { inf: T$('Infantería'), veh: T$('Vehículo'), ship: d.drone ? T$('Dron naval') : T$('Barco'), sub: T$('Submarino'), air: d.drone ? T$('Dron') : d.plane ? T$('Avión') : T$('Helicóptero') }[d.cls] || '';
}
// Sin tildes ni mayúsculas, para buscar «canon» y encontrar «Cañón».
function plainText(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// v1.5: iconos dibujados del vestíbulo (antes eran letras sueltas).
const LOBBY_ICONS = (() => {
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  return {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
    modes: svg('<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    map: svg('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>'),
    dice: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>'),
    pass: svg('<path d="M10 21h4l-.8-11h-2.4z"/><path d="M9.5 10h5M10.5 6h3l.7 4h-4.4z"/><path d="M12 3v3M15 7.5l4.5-2M9 7.5l-4.5-2"/>'),
    missions: svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="m8.5 12 2 2 4-4M8.5 17.5h7"/>'),
    daily: svg('<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3.5-5-4-5-1.5S10 9 12 9zm0 0c1.5-3.5 5-4 5-1.5S14 9 12 9z"/>'),
    codes: svg('<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2.5 2.5M14 9l2 2"/>'),
    backup: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
    creator: svg('<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/>'),
    about: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  };
})();

function mapThumb(kind, players = 6) {
  const key = kind + ':' + players;
  if (MAP_THUMBS[key]) return MAP_THUMBS[key];
  let url = '';
  try {
    const m = new GameMap(4321, kind, players, false);
    const S = 132;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#' + terrainColor(kind, 'deep').toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, S, S);
    const ext = Math.max(...m.cells.map((c) => Math.max(Math.abs(c.x), Math.abs(c.z)))) + 1;
    const k = (S / 2 - 3) / ext;
    for (const c of m.cells) {
      if (c.t === 'deep') continue;
      ctx.fillStyle = '#' + terrainColor(kind, c.t).toString(16).padStart(6, '0');
      ctx.beginPath();
      ctx.arc(S / 2 + c.x * k, S / 2 + c.z * k, k * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const hi of m.homes) {
      const c = m.cells[hi];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(S / 2 + c.x * k, S / 2 + c.z * k, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    const f = m.cells[m.points[0].cell];
    ctx.fillStyle = '#f2ab38';
    ctx.beginPath();
    ctx.arc(S / 2 + f.x * k, S / 2 + f.z * k, 4, 0, Math.PI * 2);
    ctx.fill();
    url = cv.toDataURL('image/png');
  } catch (err) {
    console.warn('[Vestíbulo] Sin miniatura de mapa:', err);
  }
  MAP_THUMBS[key] = url;
  return url;
}
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
  return L$`${d} ${MONTHS[m - 1]} ${y}`;
}

function cssColor(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

// ---------- perfil del jugador ----------
// Trazo de cada imperio en las gráficas del final (además del color): Tú, línea continua.
const HIST_DASH = ['', '7 4', '2 4', '10 3 2 3', '4 3', '1 3'];

// Rangos (v1.3, como tu documento de juego v2): 6 rangos propios, solo en la Liga 3 vs 3 y desde el
// nivel 10. Ganar suma 25 y perder resta 15. Almirante del Faro: en Roblox serán los 50 mejores; aquí,
// sin servidores, desde 2.400 puntos.
const RANKS = ['Recluta', 'Cabo', 'Sargento', 'Capitán', 'Comandante', 'Almirante del Faro'];
const RANK_MIN = [0, 300, 700, 1200, 1800, 2400];
const RANK_ICONS = ['R', 'C', 'S', 'Cp', 'Cm', 'A'];
const RANK_WIN = 25;
const RANK_LOSS = 15;
const RANK_COLORS = ['#8a9aa6', '#b87333', '#c0c7cf', '#f2c94c', '#7fc8ff', '#f2ab38'];
const RANKED_MODE = 'league';
const RANKED_LEVEL = 10;
// Temporadas (v1.3): de unos 2 meses. La 1 es noviembre-diciembre de 2026. Al empezar una nueva,
// el pase vuelve a empezar y bajas 1 rango (no a cero).
const SEASON_START = { y: 2026, m: 10 };
const SEASON_MONTHS = 2;
function seasonOf(d = new Date()) {
  const months = (d.getFullYear() - SEASON_START.y) * 12 + d.getMonth() - SEASON_START.m;
  const no = Math.max(0, Math.floor(months / SEASON_MONTHS)) + 1;
  const m0 = SEASON_START.m + (no - 1) * SEASON_MONTHS;
  const start = new Date(SEASON_START.y, m0, 1);
  const end = new Date(SEASON_START.y, m0 + SEASON_MONTHS, 1);
  return { no, start, end };
}
// Tabla de la Liga 3 vs 3 (v1.2): 20 comandantes bot con nombres propios. Sus puntos salen de tu
// semilla y se mueven un poco con cada partida que juegas (no son jugadores reales).
const LADDER_NAMES = ['Capitana Brisa', 'Coronel Basalto', 'Almirante Coral', 'Sargento Pino', 'Mariscal Ceniza', 'Teniente Ámbar',
  'Comandante Niebla', 'Capitán Granito', 'General Duna', 'Cabo Relámpago', 'Comodoro Marea', 'Brigadier Roble', 'Capitana Aurora',
  'Coronela Cobre', 'Mayor Tormenta', 'Teniente Alba', 'Almirante Faro', 'Sargenta Lava', 'General Escarcha', 'Capitán Bruma'];
function ladderRows(P) {
  const rng = mulberry32((P.seed || 1) + 4242);
  const games = (P.ranked && P.ranked.games) || 0;
  const rows = LADDER_NAMES.map((name, i) => {
    const base = Math.round(60 + rng() * 2550);
    const drift = Math.round(Math.sin((games + 1) * 0.7 + i) * 18 + games * (rng() * 6 - 1));
    return { name, points: Math.max(0, base + drift), bot: true };
  });
  rows.push({ name: T$('Tú'), points: (P.ranked && P.ranked.points) || 0, me: true });
  return rows.sort((a, b) => b.points - a.points || (a.me ? -1 : 1)).map((r, i) => ({ ...r, pos: i + 1 }));
}
function rankIndex(points) {
  let i = 0;
  while (i + 1 < RANK_MIN.length && Math.max(0, points) >= RANK_MIN[i + 1]) i++;
  return i;
}
function rankName(points) {
  return RANKS[rankIndex(points)];
}
// Desde Sargento, los rivales de la Liga 3 vs 3 juegan en Difícil.
function rankedDifficulty(points) {
  return rankIndex(points) >= 2 ? 'hard' : 'normal';
}

// v1.4: logros. Cada uno con su insignia (inicial y color propios) y cristales al lograrlo.
// done(c): c = { P, g, me, win } al terminar una partida. prog(P): [actual, meta] para los acumulados.
const ACHIEVEMENTS = [
  { id: 'primer_faro', name: 'Primer Faro', desc: 'Termina el Tutorial.', icon: 'PF', color: '#f2ab38', crystals: 0,
    done: (c) => c.P.tutorialDone },
  { id: 'intacto', name: 'Sin un rasguño', desc: 'Gana una partida sin perder ningún edificio.', icon: 'SR', color: '#5ee07a', crystals: 100,
    done: (c) => c.win && !c.g.mode.tutorial && c.g.time >= 180 && !(c.me.stats.lostBld > 0) },
  { id: 'guardian', name: 'Guardián del Faro', desc: 'Captura el Faro 3 veces.', icon: 'GF', color: '#ffd36a', crystals: 100,
    done: (c) => (c.P.stats.faro || 0) >= 3, prog: (P) => [P.stats.faro || 0, 3] },
  { id: 'lobo_mar', name: 'Lobo de mar', desc: 'Desembarca tropas en otra isla con una Barcaza.', icon: 'LM', color: '#7fc8ff', crystals: 75,
    done: (c) => (c.me.stats.landings || 0) > 0 },
  { id: 'veterano', name: 'Veterano', desc: 'Consigue una tropa con 3 estrellas.', icon: '★', color: '#ffb347', crystals: 100,
    done: (c) => (c.me.stats.bestVet || 0) >= 3 },
  { id: 'incansable', name: 'Constructor incansable', desc: 'Termina 25 edificios en una partida.', icon: 'CI', color: '#c0c7cf', crystals: 75,
    done: (c) => c.me.stats.built >= 25 },
  { id: 'cien', name: 'Ejército de cien', desc: 'Entrena 100 tropas (en total).', icon: '100', color: '#b87333', crystals: 100,
    done: (c) => (c.P.stats.trained || 0) >= 100, prog: (P) => [P.stats.trained || 0, 100] },
  { id: 'diez', name: 'Diez victorias', desc: 'Gana 10 partidas.', icon: '10', color: '#f2c94c', crystals: 150,
    done: (c) => c.P.stats.wins >= 10, prog: (P) => [P.stats.wins, 10] },
  { id: 'expres', name: 'Victoria exprés', desc: 'Gana una partida en menos de 10 minutos.', icon: 'VE', color: '#ef8a5a', crystals: 100,
    done: (c) => c.win && !c.g.mode.tutorial && !c.g.camp && c.g.time < 600 },
  { id: 'cielo', name: 'Cielo despejado', desc: 'Derriba 10 aeronaves en una partida.', icon: 'CD', color: '#9fd3ff', crystals: 100,
    done: (c) => (c.me.stats.airKills || 0) >= 10 },
  { id: 'sargento', name: 'Sargento de la Liga', desc: 'Llega a Sargento (700 puntos) en la Liga 3 vs 3.', icon: 'S', color: '#c0c7cf', crystals: 150,
    done: (c) => (c.P.ranked.best || 0) >= 700, prog: (P) => [Math.min(P.ranked.best || 0, 700), 700] },
  { id: 'semanal', name: 'Desafío de la semana', desc: 'Gana un desafío semanal.', icon: 'DS', color: '#e88bd0', crystals: 100,
    done: (c) => c.win && !!c.g.opts.weekly },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// v1.4: desafío semanal. Cambia los lunes; mapa, semilla y una regla fijos toda la semana.
const WEEKLY_CHALLENGES = [
  { id: 'nofactory', name: 'Sin fábricas', desc: 'No puedes construir la Fábrica: gana con soldados, barcos y aeronaves.', mode: 'conquest', mapKind: 'continent', difficulty: 'normal', rule: 'nofactory' },
  { id: 'noair', name: 'Cielo cerrado', desc: 'Sin Helipuerto ni Aeropuerto: todo se decide en tierra y mar.', mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', rule: 'noair' },
  { id: 'poor', name: 'Bolsillos vacíos', desc: 'Empiezas con 800 monedas en vez de 2.000.', mode: 'conquest', mapKind: 'mesa', difficulty: 'normal', startCoins: 800 },
  { id: 'fog', name: 'Niebla de guerra', desc: 'Niebla y bots en Difícil.', mode: 'conquest', mapKind: 'bay', difficulty: 'hard', fog: true },
  { id: 'sea', name: 'Todo por mar', desc: 'Mar abierto: sin puentes, cada isla se toma por mar o por aire.', mode: 'conquest', mapKind: 'open', difficulty: 'normal' },
  { id: 'duel', name: 'Duelo en las dunas', desc: 'Uno contra uno en Dunas Rojas, contra un bot en Difícil.', mode: 'duel', mapKind: 'dunes', difficulty: 'hard' },
];
const WEEKLY_CRYSTALS = 150;
function weekNumber(d = new Date()) {
  return Math.floor((dayNum(dayKey(d)) + 3) / 7);
}
function weeklyFor(d = new Date()) {
  const n = weekNumber(d);
  const ch = WEEKLY_CHALLENGES[n % WEEKLY_CHALLENGES.length];
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + ((8 - next.getDay()) % 7 || 7));
  return { ...ch, week: 'w' + n, seed: 90000 + n * 37, next };
}

// v1.4: Top jugadores (tu documento, pág. 20): tú y comandantes bot, por temporada.
const TOP_PREFIX = ['Brisa', 'Coral', 'Roca', 'Marea', 'Ancla', 'Bruma', 'Duna', 'Ámbar', 'Lince', 'Ola'];
const TOP_SUFFIX = ['Norte', 'Sur', 'Veloz', 'Real', 'Azul', 'Roja', 'Gris', 'Dorada', 'Firme', 'Alta'];
function topRows(P, tab) {
  const S = seasonOf(Profile.now());
  const rng = mulberry32((P.seed || 1) + 777 + S.no * 13);
  const games = (P.ranked && P.ranked.games) || 0;
  const liga = ladderRows(P).filter((r) => r.bot);
  const extra = [];
  for (let i = 0; i < 30; i++) {
    const name = `${TOP_PREFIX[Math.floor(rng() * 10)]}${TOP_SUFFIX[Math.floor(rng() * 10)]}_${10 + Math.floor(rng() * 89)}`;
    extra.push({ name, points: Math.max(0, Math.round(40 + rng() * 2500 + Math.sin(games + i) * 15)), bot: true });
  }
  const bots = [...liga, ...extra].map((r, i) => {
    const r2 = mulberry32((P.seed || 1) + 91 + i * 7 + S.no);
    const pct = 0.42 + Math.min(0.32, r.points / 8000) + r2() * 0.06;
    const ranked = Math.round(20 + r.points / 9 + r2() * 30);
    return { name: r.name, bot: true, points: r.points, pct, wins: Math.round(ranked * pct + r2() * 120), islands: Math.round(r2() * 900 + r.points / 6) };
  });
  const R = P.ranked;
  const me = { name: T$('Tú'), me: true, points: R.points, pct: R.games ? R.wins / R.games : 0, wins: P.stats.wins, islands: P.stats.islands };
  const key = tab === 'wins' ? 'wins' : tab === 'islands' ? 'islands' : 'points';
  return [...bots, me].sort((a, b) => b[key] - a[key] || (a.me ? -1 : 1)).map((r, i) => ({ ...r, pos: i + 1 }));
}

const Profile = {
  data: null,
  memoryOnly: false,

  defaults() {
    return {
      v: 1, seed: (Math.random() * 1e9) | 0, since: dayKey(), xp: 0, crystals: 0,
      stats: { games: 0, wins: 0, islands: 0, cores: 0, kills: 0, trained: 0, faro: 0 },
      achievements: {}, weekly: {},
      owned: {}, equipped: { inf: null, veh: null, sea: null, core: null }, badges: {},
      tutorialDone: false, pass: {}, daily: { idx: 0, last: null, lost: 0 }, codes: {},
      missions: { day: null, daily: [], rerolled: false, week: null, weekly: [] },
      chests: { pity: 0, opened: 0 },
      play: { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal' },
      custom: { kind: 'conquest', players: 4, mapKind: 'archipelago', coins: START_COINS, difficulty: 'normal', teams: false, fog: false, turbo: false, strategic: false },
      creator: { on: true, instant: false },
      campaign: { done: {}, stars: {} },
      ranked: { points: 0, best: 0, games: 0, wins: 0, history: [], shield: false },
      fragments: 0, plans: {},
      season: { no: 0, passXp: 0, notice: null },
    };
  },

  // v1.7: perfil seguro. Tres casos: no hay nada guardado (perfil nuevo); lo guardado se entiende (se revisa dato por
  // dato y se repara solo lo que vino mal); o no se entiende (no se pisa: queda una copia, se avisa y no se guarda nada
  // encima hasta que el jugador elija «Empezar de nuevo» o cargue una copia).
  load() {
    const d = this.defaults();
    this.loadError = null;
    this.repaired = [];
    this.locked = false;
    let raw = null;
    try {
      raw = localStorage.getItem(PROFILE_KEY);
    } catch (err) {
      this.memoryOnly = true;
    }
    if (raw) {
      let saved;
      try { saved = JSON.parse(raw); } catch (err) { saved = undefined; }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved) || saved.v !== 1) {
        this.loadError = 'unreadable';
        this.locked = true;
        try { localStorage.setItem(PROFILE_BAK_KEY, raw); } catch (err) { /* sin espacio para la copia */ }
      } else {
        this.merge(d, saved);
      }
    }
    // v1.4: logros; quien ya terminó el Tutorial tiene «Primer Faro».
    d.achievements = d.achievements || {};
    if (d.tutorialDone && !d.achievements.primer_faro) d.achievements.primer_faro = d.since || dayKey();
    // v1.3: la Clasificatoria aparte pasa a ser la Liga 3 vs 3.
    if (d.play.mode === 'ranked') d.play.mode = RANKED_MODE;
    if (!MODES[d.play.mode] || !MODES[d.play.mode].lobby) d.play.mode = 'conquest';
    if (!MAPS[d.play.mapKind]) d.play.mapKind = 'archipelago';
    if (!DIFFICULTY[d.play.difficulty]) d.play.difficulty = 'normal';
    this.data = d;
    this.refresh();
    return d;
  },

  // Copia lo guardado sobre los valores de fábrica, revisando el tipo de cada dato. Un dato con el tipo equivocado
  // (un número que llegó como texto, una lista que llegó como número…) se repara o vuelve a su valor de fábrica; el
  // resto se conserva. Los datos que este juego no conoce se dejan como están.
  merge(d, saved) {
    const fix = (path, def, val) => {
      if (typeof def === 'number') {
        if (typeof val === 'number' && Number.isFinite(val)) return val;
        const n = typeof val === 'string' && val.trim() !== '' ? Number(val) : NaN;
        this.repaired.push(path);
        return Number.isFinite(n) ? n : def;
      }
      if (typeof def === 'boolean') {
        if (typeof val === 'boolean') return val;
        this.repaired.push(path);
        return def;
      }
      if (Array.isArray(def)) {
        if (Array.isArray(val)) return val;
        this.repaired.push(path);
        return def;
      }
      if (def && typeof def === 'object') {
        if (!val || typeof val !== 'object' || Array.isArray(val)) {
          this.repaired.push(path);
          return def;
        }
        for (const k of Object.keys(val)) def[k] = k in def ? fix(path + '.' + k, def[k], val[k]) : val[k];
        return def;
      }
      if (typeof def === 'string' && typeof val !== 'string') {
        this.repaired.push(path);
        return def;
      }
      return val;
    };
    for (const k of Object.keys(saved)) d[k] = k in d ? fix(k, d[k], saved[k]) : saved[k];
  },

  // «Empezar de nuevo» después de un perfil que no se pudo leer: la copia queda guardada aparte.
  startFresh() {
    this.locked = false;
    this.loadError = null;
    this.data = this.defaults();
    this.refresh();
    this.save();
  },

  save() {
    // Mientras haya un perfil sin leer y el jugador no haya elegido, no se escribe nada encima.
    if (this.locked) return;
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(this.data));
    } catch (err) {
      this.memoryOnly = true;
    }
  },

  level(xp = this.data.xp) {
    return 1 + Math.floor(xp / LEVEL_XP);
  },

  // v1.3: copia del progreso para llevarlo a otro iPad o navegador (sin servidores, no hay cuentas).
  // Código = «FARO1.» + suma de control + «.» + el perfil en base64.
  exportCode() {
    const json = JSON.stringify(this.data);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `FARO1.${hashStr(json).toString(36)}.${btoa(bin)}`;
  },

  importCode(code) {
    const m = String(code || '').trim().replace(/\s+/g, '').match(/^FARO1\.([0-9a-z]+)\.([A-Za-z0-9+/=]+)$/);
    if (!m) return { err: T$('Ese texto no es una copia del progreso de Faro de Ámbar') };
    let json;
    try {
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      json = new TextDecoder().decode(bytes);
    } catch (err) {
      return { err: T$('La copia está incompleta: cópiala entera otra vez') };
    }
    if (hashStr(json).toString(36) !== m[1]) return { err: T$('La copia está incompleta o cambiada: cópiala entera otra vez') };
    let data;
    try { data = JSON.parse(json); } catch (err) { return { err: T$('La copia no se puede leer') }; }
    if (!data || data.v !== 1 || typeof data.xp !== 'number') return { err: T$('La copia no es de este juego') };
    return { data };
  },

  restore(data) {
    this.locked = false;
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); } catch (err) { this.memoryOnly = true; }
    if (this.memoryOnly) {
      this.data = data;
      return;
    }
    this.load();
  },

  // XP: el nivel cuenta toda la XP; el pase, solo la de esta temporada.
  addXp(n) {
    this.data.xp += n;
    this.data.season.passXp = (this.data.season.passXp || 0) + n;
  },

  now() {
    return new Date();
  },

  // Al empezar una temporada nueva: el pase vuelve a empezar y la Liga baja 1 rango (no a cero).
  checkSeason() {
    const P = this.data;
    const cur = seasonOf(this.now()).no;
    if (!P.season.no) {
      // Perfiles de antes de la v1.3: se quedan con lo que llevaban en el pase.
      P.season.no = cur;
      P.season.passXp = P.xp;
      return false;
    }
    if (P.season.no >= cur) return false;
    const R = P.ranked;
    const from = rankName(R.points);
    const idx = rankIndex(R.points);
    R.points = RANK_MIN[Math.max(0, idx - 1)];
    R.shield = false;
    P.pass = {};
    P.season.passXp = 0;
    P.season.notice = { no: cur, from, to: rankName(R.points) };
    P.season.no = cur;
    return true;
  },

  passTier() {
    return Math.min(PASS_TIERS, Math.floor((this.data.season.passXp || 0) / PASS_TIER_XP));
  },

  // Cambio de día o de semana: misiones nuevas y racha del premio diario.
  refresh() {
    const P = this.data;
    this.checkSeason();
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
  if (t % 10 === 0) return { chest: 'faro', text: T$('Cofre del Faro') };
  if (t % 5 === 0) return { chest: 'isla', text: T$('Cofre de Isla') };
  const n = 20 + 5 * Math.floor((t - 1) / 10);
  return { crystals: n, text: L$`${n} cristales` };
}

// ---------- modo creador (solo la cuenta dueña del juego) ----------
// v1.8: zona de creadores con contraseña. Se guarda solo la huella SHA-256 (con sal) de la contraseña, nunca la contraseña.
// Se pide otra vez cada vez que se abre el juego (queda abierta mientras la pestaña siga abierta). Tras 5 intentos fallidos,
// hay que esperar 60 s. Ojo: en una página web esto frena a los jugadores, no a quien sepa leer el código; en Roblox la
// contraseña se comprobará en el servidor.
const CREATOR_PASS = { salt: 'faro-ambar|creadores|', hash: '4659ef1a787caaa20a5786b97d05eaa2ef23fc625f078fb571e1692d415f8f97', tries: 5, wait: 60 };
const CREATOR_KEY = 'faro-creator-ok';

const Creator = {
  owner: false,
  platform: false,
  byPass: false,
  checked: false,

  // La plataforma de Claude dice si quien abre el enlace es el dueño. Sin plataforma, nadie lo es.
  // v1.8: también es creador quien entró con la contraseña en esta pestaña.
  async detect() {
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        const user = await window.claude.use('user');
        this.platform = !!(user && (await user.isOwner()));
      }
    } catch (err) {
      this.platform = false;
    }
    try { this.byPass = sessionStorage.getItem(CREATOR_KEY) === CREATOR_PASS.hash; } catch (err) { /* sin almacenamiento */ }
    this.owner = this.platform || this.byPass;
    this.checked = true;
    return this.owner;
  },

  // Segundos que faltan para poder volver a intentar (0 si se puede).
  lockLeft() {
    try {
      const until = Number(sessionStorage.getItem('faro-creator-lock') || 0);
      return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    } catch (err) {
      return 0;
    }
  },

  // Devuelve null si la contraseña es correcta; si no, el motivo.
  tryPassword(pw) {
    const left = this.lockLeft();
    if (left > 0) return L$`Demasiados intentos. Espera ${left} s.`;
    const ok = sha256Hex(CREATOR_PASS.salt + String(pw || '').trim()) === CREATOR_PASS.hash;
    let fails = 0;
    try { fails = Number(sessionStorage.getItem('faro-creator-fails') || 0); } catch (err) { /* sin almacenamiento */ }
    if (!ok) {
      fails++;
      try {
        sessionStorage.setItem('faro-creator-fails', String(fails >= CREATOR_PASS.tries ? 0 : fails));
        if (fails >= CREATOR_PASS.tries) sessionStorage.setItem('faro-creator-lock', String(Date.now() + CREATOR_PASS.wait * 1000));
      } catch (err) { /* sin almacenamiento */ }
      return fails >= CREATOR_PASS.tries ? L$`Contraseña incorrecta. Espera ${CREATOR_PASS.wait} s para volver a intentar.`
        : L$`Contraseña incorrecta (${CREATOR_PASS.tries - fails} ${CREATOR_PASS.tries - fails === 1 ? 'intento' : T$('intentos')} más).`;
    }
    this.byPass = true;
    this.owner = true;
    try {
      sessionStorage.setItem(CREATOR_KEY, CREATOR_PASS.hash);
      sessionStorage.removeItem('faro-creator-fails');
    } catch (err) { /* sin almacenamiento */ }
    return null;
  },

  // Cerrar la zona: deja de ser creador en esta pestaña (salvo el dueño confirmado por la plataforma).
  lock() {
    this.byPass = false;
    this.owner = this.platform;
    try { sessionStorage.removeItem(CREATOR_KEY); } catch (err) { /* sin almacenamiento */ }
    if (!this.owner && Profile.data) Profile.data.creator.on = false;
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
    // v1.7: buscador del Arsenal (solo se vuelven a dibujar las tarjetas, para no perder el cursor).
    $('menu').addEventListener('input', (e) => {
      if (e.target.id !== 'ars-search') return;
      this.arsQuery = e.target.value;
      this.arsenalRefresh();
    });
    $('modal').addEventListener('click', (e) => {
      if (e.target === $('modal')) this.closeModal();
      else this.onClick(e);
    });
    $('modal').addEventListener('change', (e) => {
      if (e.target.id !== 'bk-filein' || !e.target.files || !e.target.files[0]) return;
      e.target.files[0].text().then((txt) => {
        const box = $('bk-in');
        if (box) box.value = txt.trim();
        this.loadBackup(txt, $('btn-bk-load'));
      });
    });
    $('modal').addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.id === 'code-form') this.redeem($('code-input').value);
      // v1.8: contraseña de la zona de creadores.
      if (e.target.id === 'creator-form') {
        const err = Creator.tryPassword($('creator-pw').value);
        if (err) {
          this.app.sound.play('error');
          this.openModal('creatorpw', { msg: err });
          const box = $('creator-pw');
          if (box && !box.disabled) box.focus();
        } else {
          this.app.ui.toast(T$('Zona de creadores abierta'), 'good');
          this.app.sound.play('done');
          this.render();
          this.openModal('creator');
        }
      }
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
    if (sub === 'weekly') {
      const W = weeklyFor(Profile.now());
      return { mode: W.mode, mapKind: W.mapKind, difficulty: W.difficulty, seed: W.seed, fog: !!W.fog, rule: W.rule || null, startCoins: W.startCoins || 0, weekly: W.week, weeklyName: W.name };
    }
    if (sub === 'custom') {
      const c = P.custom;
      return {
        mode: c.kind === 'king' ? 'king' : 'conquest', mapKind: c.mapKind, difficulty: c.difficulty,
        custom: { players: c.players, teams: c.teams, coins: c.coins, fog: c.fog, turbo: c.turbo, king: c.kind === 'king', strategic: !!c.strategic },
      };
    }
    if (sub === 'tutorial') return { mode: 'tutorial', mapKind: 'open', difficulty: 'easy' };
    // Campaña: el fondo del vestíbulo sigue con la isla de «Jugar»; cada misión trae su propio mapa.
    // Liga 3 vs 3 (con rango): la dificultad la pone tu rango.
    if (MODES[P.play.mode] && MODES[P.play.mode].ranked) return { mode: P.play.mode, mapKind: P.play.mapKind, difficulty: rankedDifficulty(P.ranked.points) };
    return { mode: P.play.mode, mapKind: P.play.mapKind, difficulty: P.play.difficulty };
  }

  syncOpts(first) {
    const next = this.optsFor();
    const o = this.app.opts;
    const players = (x) => (x.custom ? x.custom.players + ':' + x.custom.teams : MODES[x.mode].players);
    const changed = first || o.mode !== next.mode || o.mapKind !== next.mapKind || players(o) !== players(next);
    // El desafío semanal trae su propia semilla (el mismo mapa toda la semana).
    this.app.opts = { ...next, seed: next.seed || o.seed || ((Math.random() * 1e9) | 0) };
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
    $('lvl-badge').textContent = L$`Nivel ${Profile.level()}`;
    $('creator-badge').hidden = !Creator.active();
    document.querySelectorAll('#lobby-tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === this.view)));
    const body = $('lobby-body');
    const ver = $('game-version');
    if (ver) ver.textContent = 'v' + GAME_VERSION;
    body.classList.toggle('wide', this.view !== 'play');
    if (this.view === 'missions') body.innerHTML = this.missionsViewHtml();
    else if (this.view === 'shop') body.innerHTML = this.shopHtml();
    else if (this.view === 'inv') body.innerHTML = this.invHtml();
    else if (this.view === 'arsenal') body.innerHTML = this.arsenalHtml();
    else body.innerHTML = this.leftHtml() + `<div class="lmain">${this.mainHtml()}</div>` + this.sideHtml();
    // v1.3: aviso (una vez) de que empezó una temporada nueva.
    const note = P.season && P.season.notice;
    if (note && !this.modal) {
      P.season.notice = null;
      Profile.save();
      this.openModal('info', { title: L$`Empieza la Temporada ${note.no}`,
        text: L$`El Pase del Faro vuelve a empezar desde el nivel 1. En la Liga 3 vs 3 bajas 1 rango: de ${note.from} a ${note.to}.` });
      return;
    }
    if (this.modal) this.renderModal();
  }

  leftHtml() {
    const item = (sub, label, hint) => `<button type="button" data-act="sub" data-sub="${sub}" class="${this.sub === sub ? 'on' : ''}"><span class="lm-label">${label}</span>${hint ? `<small>${hint}</small>` : ''}</button>`;
    // v1.9: en Poki no se nombra a otra plataforma: sin los botones que esperan servidores de Roblox.
    const off = (label) => (Platform.name === 'poki' ? '' : `<button type="button" disabled title="${L$`Necesita servidores`}"><span class="lm-label">${label}</span><small>${L$`Roblox`}</small></button>`);
    return `<nav class="lmenu panel" aria-label="${L$`Menú del vestíbulo`}">
      ${item('main', T$('Jugar'))}
      ${item('campaign', T$('Campaña'), L$`${this.campaignStars()} de ${CAMPAIGN.length * 3} ★`)}
      ${item('custom', T$('Personalizado'), T$('mitad de XP'))}
      ${item('tutorial', T$('Tutorial'), this.P.tutorialDone ? T$('hecho') : T$('premio'))}
      ${item('ranks', T$('Rangos'), rankName(this.P.ranked.points))}
      ${item('top', T$('Top jugadores'), `T. ${seasonOf(Profile.now()).no}`)}
      ${item('weekly', T$('Desafío semanal'), ((this.P.weekly || {})[weeklyFor(Profile.now()).week] || {}).won ? 'ganado' : T$('nuevo'))}
      <button type="button" data-act="settings"><span class="lm-label">${L$`Ajustes`}</span><small>${L$`A tu manera`}</small></button>
      ${Platform.name === 'poki' ? '' : `<button type="button" data-act="creatorzone" id="btn-creatorzone"><span class="lm-label">${L$`Creadores`}</span><small>${Creator.owner ? T$('abierta') : T$('con contraseña')}</small></button>`}${off(T$('Servidores'))}
    </nav>`;
  }

  resumeHtml() {
    const app = this.app;
    if (app.suspended && !app.suspended.over) {
      const g = app.suspended;
      return `<div class="resume"><p><b>${L$`Partida en pausa`}</b> · ${esc(g.mode.name)} · ${fmtTime(g.time)}</p>
        <div class="row"><button class="btn gold" type="button" data-act="resume">${L$`Volver a la partida`}</button>
        <button class="btn" type="button" data-act="abandon">${L$`Abandonar`}</button></div></div>`;
    }
    const s = Save.peek();
    if (s) {
      return `<div class="resume"><p><b>${L$`Partida guardada`}</b> · ${esc(s.mode || '')} · ${esc(s.map || '')} · ${fmtTime(s.time || 0)}</p>
        <div class="row"><button class="btn gold" type="button" data-act="load">${L$`Continuar partida guardada`}</button>
        <button class="btn" type="button" data-act="abandon">${L$`Borrar`}</button></div></div>`;
    }
    return '';
  }

  mainHtml() {
    const P = this.P;
    const resume = this.resumeHtml();
    if (this.sub === 'custom') return resume + this.customHtml();
    if (this.sub === 'tutorial') return resume + this.tutorialHtml();
    if (this.sub === 'campaign') return resume + this.campaignHtml();
    if (this.sub === 'ranks') return resume + this.ranksHtml();
    if (this.sub === 'top') return resume + this.topHtml();
    if (this.sub === 'weekly') return resume + this.weeklyHtml();
    const m = MODES[P.play.mode];
    const diffs = Object.entries(DIFFICULTY).map(([k, d]) => `<button type="button" data-act="diff" data-v="${k}" class="${P.play.difficulty === k ? 'on' : ''}">${d.name}</button>`).join('');
    const st = P.stats;
    const pct = st.games ? Math.round((st.wins / st.games) * 100) : 0;
    const cover = Thumbs.cover();
    const ranked = MODES[P.play.mode] && MODES[P.play.mode].ranked;
    const diffName = ranked ? DIFFICULTY[rankedDifficulty(P.ranked.points)].name : DIFFICULTY[P.play.difficulty].name;
    const mapName = MAPS[P.play.mapKind] ? MAPS[P.play.mapKind].name : '';
    const thumb = LOBBY_MAPS.includes(P.play.mapKind) ? mapThumb(P.play.mapKind, Math.max(2, m.players || 6)) : '';
    const tile = (n, label) => `<div><b>${n}</b><span>${label}</span></div>`;
    // v1.5: portada nueva: la imagen grande con JUGAR adentro, el modo con la miniatura del mapa y tus números en fichas.
    return `${resume}
      <section class="cover hero panel"${cover ? ` style="--cover:url('${cover}')"` : ''}>
        <div class="cover-img" aria-hidden="true"></div>
        <div class="cover-text">
          <div class="cover-brand"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3 57 17.5v29L32 61 7 46.5v-29z" fill="#1a2834" stroke="#f2ab38" stroke-width="3"/><path d="M26 50h12l-2-24h-8z" fill="#eef1f3"/><path d="M27.2 40h9.6l.5 5h-10.6zM28 31h8l.4 4h-8.8z" fill="#c0392b"/><rect x="27" y="20" width="10" height="6" rx="1" fill="#f2ab38"/><path d="M26 20l6-6 6 6z" fill="#eef1f3"/><path d="M37 21l15-6v10z" fill="#f2ab38" opacity=".55"/><path d="M27 21 12 15v10z" fill="#f2ab38" opacity=".35"/></svg>
            <small>${L$`Versión ${GAME_VERSION}`}</small></div>
          <h2>${L$`Faro de`} <span>${L$`Ámbar`}</span></h2>
          <p>${L$`Construye tu isla, arma tu ejército de tierra, mar y aire y toma el Faro.`}</p>
          <ul class="cover-news" aria-label="${L$`Novedades`}">${[T$('93 tropas y 42 edificios'), T$('Tu ejército en la portada'), T$('Campo de pruebas'), T$('Español e inglés'), T$('Ajustes a tu manera')].map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>
        <div class="hero-play">
          <button class="btn gold hero-btn" type="button" data-act="play" id="btn-play">${LOBBY_ICONS.play}<span>${L$`Jugar`}</span></button>
          <span class="hero-mode">${esc(m.name)} · ${esc(mapName)} · ${esc(diffName)}</span>
          ${STORAGE_OK ? '' : `<span class="nosave" id="nosave">${L$`Este navegador no deja guardar: tu progreso se perderá al cerrar el juego.`}</span>`}
        </div>
      </section>
      <section class="lcard panel modecard">
        ${thumb ? `<img class="modethumb" alt="" src="${thumb}">` : ''}
        <div class="mode-now"><small>${L$`Modo`}</small><b>${esc(m.name)}</b><span>${esc(m.desc)}</span>
          <span>${L$`Mapa:`} <b>${esc(mapName)}</b></span></div>
        <div class="modebtns">
          <button class="btn" type="button" data-act="modal" data-m="modes">${L$`${LOBBY_ICONS.modes}Cambiar modo`}</button>
          <button class="btn" type="button" data-act="modal" data-m="maps">${L$`${LOBBY_ICONS.map}Mapa`}</button>
          <button class="btn" type="button" data-act="reroll">${L$`${LOBBY_ICONS.dice}Otra isla`}</button>
        </div>
        ${ranked ? `<p class="queue modefoot">${L$`Liga 3 vs 3 · ${rankName(P.ranked.points)} · ${P.ranked.points} puntos. La dificultad la pone tu rango (${DIFFICULTY[rankedDifficulty(P.ranked.points)].name}).`}</p>`
          : `<div class="field modefoot"><label>${L$`Dificultad de los bots`}</label><div class="seg">${diffs}</div></div>`}
      </section>
      <section class="lcard panel">
        <h3>${L$`Tus números`}</h3>
        <div class="stattiles numbers">
          ${tile(st.games, T$('Partidas'))}${tile(st.wins, T$('Victorias'))}${tile(`${pct} %`, T$('De victorias'))}
          ${tile(st.islands, T$('Islas tomadas'))}${tile(st.cores, T$('Núcleos destruidos'))}${tile(prettyDate(P.since), T$('Jugando desde'))}
        </div>
      </section>`;
  }

  customHtml() {
    const c = this.P.custom;
    const seg = (key, list) => `<div class="seg">${list.map(([v, label]) => `<button type="button" data-act="cset" data-k="${key}" data-v="${v}" class="${String(c[key]) === String(v) ? 'on' : ''}">${label}</button>`).join('')}</div>`;
    return `<section class="lcard panel">
      <h2>${L$`Personalizado`}</h2>
      <p>${L$`Arma tu partida contra bots. Da la mitad de XP.`}</p>
      <div class="field"><label>${L$`Modo`}</label>${seg('kind', [['conquest', T$('Conquista')], ['king', T$('Rey del Faro')]])}</div>
      <div class="field"><label>${L$`Jugadores`}</label>${seg('players', [[2, T$('2 (Duelo 1 vs 1)')], [3, '3'], [4, '4'], [5, '5'], [6, '6']])}</div>
      <div class="field"><label>${L$`Mapa`}</label><div class="mapthumbs">${LOBBY_MAPS.map((k) => `<button type="button" data-act="cset" data-k="mapKind" data-v="${k}" class="mapopt ${c.mapKind === k ? 'on' : ''}"><img alt="" src="${mapThumb(k, Math.max(2, c.players))}"><span>${esc(MAPS[k].name)}</span></button>`).join('')}</div></div>
      <div class="field"><label>${L$`Monedas iniciales`}</label>${seg('coins', [[2000, '2.000'], [4000, '4.000'], [6000, '6.000'], [10000, '10.000']])}</div>
      <div class="field"><label>${L$`Dificultad`}</label>${seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.name]))}</div>
      <div class="field"><label>${L$`Equipos`}</label>${seg('teams', [[false, T$('Todos contra todos')], [true, T$('Dos equipos')]])}</div>
      <div class="field"><label>${L$`Extras`}</label>${seg('fog', [[false, T$('Sin niebla')], [true, T$('Niebla')]])}${seg('turbo', [[false, T$('Ritmo normal')], [true, 'Turbo ×2']])}</div>
      <div class="field" id="field-strategic"><label>${L$`Arsenal estratégico · opción experimental`}</label>${seg('strategic', [[false, T$('Desactivado')], [true, T$('Activado')]])}
        <small class="fieldnote">${L$`Activado: cada jugador tiene`} <b>${L$`un solo uso estratégico`}</b> ${L$`en toda la partida, con el misil del AIR DEFENSE de nivel 4 o con el Lanzador nuclear móvil (que solo existe con esta opción). Desactivado: todo sigue como siempre.`}</small></div>
      <div class="row">
        <button class="btn gold" type="button" data-act="play" id="btn-play-custom">${L$`Jugar personalizado`}</button>
        ${Platform.name === 'poki' ? '' : `<button class="btn" type="button" disabled>${L$`Unirse con código · Disponible en Roblox`}</button>`}
      </div>
    </section>`;
  }

  campaignStars() {
    const st = this.P.campaign.stars;
    return CAMPAIGN.reduce((n, m) => n + (st[m.id] || 0), 0);
  }

  // Campaña «La ruta del Faro»: 6 misiones; cada una se abre al terminar la anterior.
  campaignHtml() {
    const P = this.P;
    const creator = Creator.active();
    const cards = CAMPAIGN.map((m) => {
      const open = Campaign.unlocked(m.id, P, creator);
      const got = P.campaign.stars[m.id] || 0;
      const done = !!P.campaign.done[m.id];
      const stars = [0, 1, 2].map((k) => `<i class="${k < got ? 'on' : ''}" aria-hidden="true">★</i>`).join('');
      const extra = m.stars.map((s) => Campaign.starText(s)).join(' · ');
      return `<article class="mcard ${open ? '' : 'locked'} ${done ? 'done' : ''}">
        <div class="mnum">${m.id}</div>
        <div class="mbody"><b>${esc(m.name)}</b><span>${esc(Campaign.goalText(m))}</span>
          <small>★ ${esc(extra)}</small></div>
        <div class="mside"><span class="mstars" title="${L$`${got} de 3 estrellas`}">${stars}</span>
          ${open ? `<button class="btn ${done ? '' : 'gold'}" type="button" data-act="mission" data-v="${m.id}" id="btn-mission-${m.id}">${done ? T$('Repetir') : T$('Jugar')}</button>`
            : `<span class="mlock">${L$`Termina la misión ${m.id - 1}`}</span>`}</div>
      </article>`;
    }).join('');
    return `<section class="lcard panel">
      <h2>${L$`La ruta del Faro`}</h2>
      <p>${L$`Seis misiones para volver a encender el Faro de Ámbar. Cada una se abre al terminar la anterior y da hasta 3 estrellas:
        una por terminarla y dos por las condiciones marcadas con ★.${creator ? T$(' Modo creador: todas abiertas.') : ''}`}</p>
      <div class="missions">${cards}</div>
      <p class="small-note">${L$`Premio la primera vez: cristales (50 a 250) y XP. Cada estrella nueva: +${CAMPAIGN_STAR_CRYSTALS} cristales. Tienes ${this.campaignStars()} de ${CAMPAIGN.length * 3} estrellas.`}</p>
    </section>`;
  }

  tutorialHtml() {
    const done = this.P.tutorialDone;
    return `<section class="lcard panel">
      <h2>${L$`Tutorial`}</h2>
      <p>${L$`Tres pasos contra un bot lento con un Núcleo débil, que está en otra isla: para llegar hace falta una Barcaza.`}</p>
      <ol class="steps">${TUTORIAL_STEPS.map((s) => `<li>${esc(s.text)}</li>`).join('')}</ol>
      <div class="prizes">
        <div><b>${L$`Primer Faro`}</b><span>${L$`Insignia`}</span></div>
        <div><b>${L$`150 cristales`}</b><span>${L$`Una sola vez`}</span></div>
        <div><b>${L$`Soldado Dorado`}</b><span>${L$`Aspecto legendario`}</span></div>
      </div>
      <p>${done ? T$('Ya recibiste el premio. Puedes repetir el tutorial cuando quieras.') : T$('El premio se entrega la primera vez que lo terminas.')}</p>
      <div class="row"><button class="btn gold" type="button" data-act="play" id="btn-play-tutorial">${L$`Empezar tutorial`}</button></div>
    </section>`;
  }

  // Rangos (v1.3): tu rango, los 6 rangos de tu documento, la temporada, la tabla y tus partidas.
  ranksHtml() {
    const P = this.P;
    const R = P.ranked;
    const idx = rankIndex(R.points);
    const top = idx === RANKS.length - 1;
    const lo = RANK_MIN[idx];
    const hi = top ? lo : RANK_MIN[idx + 1];
    const pct = top ? 100 : Math.round(((R.points - lo) / (hi - lo)) * 100);
    const ladder = RANKS.map((n, i) => `<li class="${i === idx ? 'on' : i < idx ? 'past' : ''}"><i style="background:${RANK_COLORS[i]}"></i>${n}<small>${fmt(RANK_MIN[i])}</small></li>`).join('');
    const hist = (R.history || []).slice(0, 8).map((h) => `<li class="${h.win ? 'win' : 'loss'}"><b>${h.win ? T$('Victoria') : h.forfeit ? T$('Abandono') : T$('Derrota')}</b><span>${h.delta >= 0 ? '+' : ''}${h.delta}</span><small>${esc(h.rank)} · ${prettyDate(h.day)}</small></li>`).join('');
    const diff = DIFFICULTY[rankedDifficulty(R.points)].name;
    const S = seasonOf(Profile.now());
    const ends = L$`${S.end.getDate()} de ${MONTHS[S.end.getMonth()]}`;
    const lv = Profile.level();
    const locked = lv < RANKED_LEVEL && !Creator.active();
    return `<section class="lcard panel ranked">
        <div class="rankhead"><div class="rankbadge" style="--rk:${RANK_COLORS[idx]}"><b>${RANK_ICONS[idx]}</b></div>
          <div><small>${L$`Tu rango · Temporada ${S.no}`}</small><h2 id="rank-name">${RANKS[idx]}</h2><span>${L$`${fmt(R.points)} puntos · mejor: ${rankName(R.best || 0)}`}</span></div></div>
        <div class="rankbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <p class="queue">${L$`${top ? T$('Estás en el rango más alto.') : L$`${fmt(hi - R.points)} puntos para ${RANKS[idx + 1]}.`} Solo cuentan las partidas de la Liga 3 vs 3 (aliados bots; rivales en ${diff}). Ganar: +${RANK_WIN} · perder o abandonar: −${RANK_LOSS}.`}</p>
        <p class="queue" id="rank-rules">${L$`${R.shield ? `<b>${L$`Protección activa:`}</b> ${L$`acabas de subir, tu primera derrota no te baja de rango.`} ` : T$('Recién llegado a un rango, la primera derrota no te baja. ')}La temporada termina el ${ends}: entonces bajas 1 rango (no a cero) y el pase vuelve a empezar.`}</p>
        <div class="row"><button class="btn gold" type="button" data-act="ranked" id="btn-ranked" ${locked ? 'aria-disabled="true"' : ''}>${L$`Jugar Liga 3 vs 3`}</button>${locked ? `<small class="lockmsg">${L$`Desde nivel ${RANKED_LEVEL} (tienes ${lv})`}</small>` : ''}</div>
      </section>
      <section class="lcard panel"><h3>${L$`Los 6 rangos`}</h3><ol class="ranklist">${ladder}</ol>
        <p class="queue">${Platform.name === 'poki' ? L$`Almirante del Faro: desde ${fmt(RANK_MIN[5])} puntos.` : L$`Almirante del Faro: en Roblox serán los 50 mejores; aquí, sin servidores, desde ${fmt(RANK_MIN[5])} puntos.`}</p></section>
      <section class="lcard panel"><h3>${L$`Tabla de la Liga 3 vs 3`}</h3>
        <p class="queue">${L$`Comandantes bot del juego (sin servidores no hay otros jugadores reales). Tu puesto cambia con tus puntos.`}</p>
        <ol class="ladder" id="ladder">${ladderRows(P).map((r) => `<li class="${r.me ? 'me' : ''}"><b>${r.pos}.º</b><span>${esc(r.name)}${r.bot ? ' <small>bot</small>' : ''}</span><i style="background:${RANK_COLORS[rankIndex(r.points)]}"></i><em>${rankName(r.points)}</em><strong>${r.points}</strong></li>`).join('')}</ol></section>
      <section class="lcard panel"><h3>${L$`Últimas partidas · ${R.wins || 0} de ${R.games || 0} ganadas`}</h3>${hist ? `<ul class="rankhist">${hist}</ul>` : `<p class="queue">${L$`Todavía no jugaste la Liga 3 vs 3.`}</p>`}</section>`;
  }

  // v1.8: misiones (lo mismo que la ventana de Misiones), también como pestaña del vestíbulo (UI 0.4, pantalla 02).
  missionsInner() {
    const P = this.P;
    const row = (m, i, kind) => {
      const d = MISSION_BY_ID[m.id];
      const prog = Math.min(d.goal, m.prog);
      return `<div class="mission ${m.done ? 'done' : ''}"><span>${esc(d.text)}</span>
        <span>${m.done ? T$('Hecha') : `${prog} / ${d.goal}`}${kind === 'daily' && !m.done && !P.missions.rerolled ? ` <button class="mini-btn" type="button" data-act="reroll-m" data-v="${i}">${L$`Cambiar`}</button>` : ''}</span>
        <div class="xpbar"><i style="width:${(prog / d.goal) * 100}%"></i></div></div>`;
    };
    return `<p>${L$`Cada misión da ${XP_REWARD.mission} XP y cristales (${MISSION_CRYSTALS.daily} las diarias, ${MISSION_CRYSTALS.weekly} las semanales). Se completan al terminar una partida.`}</p>
      <h3>${L$`Diarias${P.missions.rerolled ? T$(' · ya cambiaste una hoy') : T$(' · puedes cambiar 1 al día')}`}</h3>${P.missions.daily.map((m, i) => row(m, i, 'daily')).join('')}
      <h3>${L$`Semanales`}</h3>${P.missions.weekly.map((m, i) => row(m, i, 'weekly')).join('')}`;
  }

  missionsViewHtml() {
    const can = Profile.dailyClaimable();
    const passN = Profile.passClaimable();
    return `<section class="lcard panel missionsview"><h2>${L$`Misiones`}</h2>${this.missionsInner()}
      <div class="row"><button class="btn ${can ? 'gold' : ''}" type="button" data-act="modal" data-m="daily">${L$`Premio diario${can ? T$(' · ¡listo!') : ''}`}</button>
        <button class="btn ${passN ? 'gold' : ''}" type="button" data-act="modal" data-m="pass">${L$`Pase del Faro${passN ? ` ${L$`· ${passN} para reclamar`}` : ''}`}</button></div></section>`;
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
      <div class="lcard panel"><h3>${L$`Nivel ${lv}`}</h3><div class="xpbar"><i style="width:${(into / LEVEL_XP) * 100}%"></i></div>
        <p>${fmt(into)} / ${fmt(LEVEL_XP)} XP</p></div>
      ${btn('pass', LOBBY_ICONS.pass, T$('Pase del Faro'), L$`Nivel ${tier} de ${PASS_TIERS}`, passN || '')}
      ${btn('missions', LOBBY_ICONS.missions, T$('Misiones'), L$`${missionsLeft} por hacer`, '')}
      ${btn('daily', LOBBY_ICONS.daily, T$('Premio diario'), Profile.dailyClaimable() ? T$('¡Listo para reclamar!') : T$('Vuelve mañana'), Profile.dailyClaimable() ? '1' : '')}
      ${btn('codes', LOBBY_ICONS.codes, T$('Códigos'), T$('Canjea un código'), '')}
      ${btn('backup', LOBBY_ICONS.backup, T$('Copia de tu progreso'), T$('Llévalo a otro iPad'), '')}
      ${btn('about', LOBBY_ICONS.about, T$('Acerca de'), L$`Versión ${GAME_VERSION} y créditos`, '')}
      ${Creator.owner ? btn('creator', LOBBY_ICONS.creator, T$('Modo creador'), Creator.active() ? T$('Activado') : T$('Apagado'), '') : ''}
    </aside>`;
  }

  shopHtml() {
    const P = this.P;
    // v1.9: en Poki no hay ninguna pantalla de compras (regla de Poki): sin la pestaña «Cristales» de los paquetes.
    if (Platform.name === 'poki' && this.shopTab === 'crystals') this.shopTab = 'skins';
    const tabs = [['skins', T$('Apariencias')], ['chests', T$('Cofres')], ['workshop', T$('Taller')], ['crystals', T$('Cristales')]]
      .filter(([k]) => !(Platform.name === 'poki' && k === 'crystals'))
      .map(([k, l]) => `<button type="button" data-act="shoptab" data-v="${k}" class="${this.shopTab === k ? 'on' : ''}">${l}</button>`).join('');
    let inner = '';
    if (this.shopTab === 'skins') {
      inner = `<p>${L$`Solo cambian cómo se ven tus tropas y tu Núcleo: vida, daño y velocidad = iguales.`}</p>
        <div class="shopgrid">${SKINS.filter((s) => !s.special).map((s) => {
    const own = Profile.owns(s.id);
    const price = RARITY[s.rar].price;
    return `<div class="item ${own ? 'owned' : ''}">
            <img alt="" src="${Thumbs.get(SKIN_SLOTS[s.slot].model, PLAYER_COLORS[0], s.look)}">
            <b>${esc(s.name)}</b><span class="rar ${s.rar}">${RARITY[s.rar].name}</span>
            ${own ? `<small>${L$`Ya es tuyo`}</small>` : `<button class="btn" type="button" data-act="buy" data-id="${s.id}" ${P.crystals < price ? 'disabled' : ''}>${L$`${fmt(price)} cristales`}</button>`}
          </div>`;
  }).join('')}</div>`;
    } else if (this.shopTab === 'chests') {
      inner = `<div class="mode-cards">${Object.entries(CHESTS).map(([k, C]) => `<div class="chest">
          <b>${C.name}</b>
          <div class="probs">${Object.entries(C.odds).map(([r, pct]) => `<span class="rar ${r}">${RARITY[r].name}</span><div class="xpbar"><i style="width:${pct}%"></i></div><span>${pct} %</span>`).join('')}</div>
          <button class="btn gold" type="button" data-act="chest" data-v="${k}" ${P.crystals < C.cost && !Creator.active() ? 'disabled' : ''}>${L$`Abrir · ${fmt(C.cost)} cristales`}</button>
        </div>`).join('')}</div>
        <p>${L$`Cada cofre da un aspecto (${CHEST_SPLIT.skin} %), un plano (${CHEST_SPLIT.plan} %) o fragmentos (${100 - CHEST_SPLIT.skin - CHEST_SPLIT.plan} %). Garantía: 1 legendario cada ${CHEST_PITY} cofres (te faltan ${CHEST_PITY - P.chests.pity}). Un aspecto repetido se convierte en fragmentos (${Object.entries(FRAG_DUP).map(([r, n]) => `${RARITY[r].name} ${n}`).join(', ')}).`}</p>`;
    } else if (this.shopTab === 'workshop') {
      // v1.2: Taller: plano + fragmentos = aspecto.
      const plans = SKINS.filter((s) => (P.plans || {})[s.id] && !P.owned[s.id]);
      inner = `<p>${L$`Tienes`} <b id="frag-count">${P.fragments || 0}</b> ${L$`fragmentos. Ganas fragmentos con los aspectos repetidos, en algunos cofres y jugando (+${FRAG_GAME.play} por partida, +${FRAG_GAME.win} si ganas).`}</p>
        ${plans.length ? `<div class="shopgrid">${plans.map((s) => `<div class="item plan">
          <img alt="" src="${Thumbs.get(SKIN_SLOTS[s.slot].model, PLAYER_COLORS[0], s.look)}">
          <b>${esc(s.name)}</b><span class="rar ${s.rar}">${RARITY[s.rar].name}</span>
          <button class="btn gold" type="button" data-act="craft" data-id="${s.id}" ${(P.fragments || 0) < FRAG_COST[s.rar] ? 'disabled' : ''}>${L$`Fabricar · ${FRAG_COST[s.rar]} fragmentos`}</button></div>`).join('')}</div>`
        : `<p class="queue">${L$`Todavía no tienes planos: salen en los cofres.`}</p>`}`;
    } else {
      inner = `<p>${L$`Los cristales se ganan jugando: partidas, misiones, pase y premio diario. Comprarlos con dinero real solo estará en Roblox.`}</p>
        <div class="shopgrid">${CRYSTAL_PACKS.map((c) => `<div class="item"><b>${esc(c.name)}</b><span>${L$`${fmt(c.amount)} cristales`}</span>
          <button class="btn" type="button" disabled>${L$`Solo en Roblox`}</button></div>`).join('')}</div>`;
    }
    return `<section class="lcard panel"><header class="rowx"><h2>${L$`Tienda`}</h2><span class="crystals"><i></i><b>${Creator.active() ? '∞' : fmt(P.crystals)}</b></span></header>
      <div class="subtabs">${tabs}</div>${inner}</section>`;
  }

  // ---------- v1.7: Arsenal («Conoce tu ejército») ----------
  arsenalList() {
    const q = plainText(this.arsQuery || '');
    const f = this.arsFilter || 'all';
    return arsenalItems().filter((it) => (f === 'all' || it.fam === f || it.also.includes(f)) && (!q || plainText(it.def.name).includes(q)));
  }

  arsenalCards(list) {
    return list.map((it) => `<button type="button" class="item arsitem ${it.key === this.arsPick ? 'on' : ''}" data-act="arspick" data-k="${it.key}">
      <img alt="" src="${Thumbs.get(it.key, PLAYER_COLORS[0])}"><b>${esc(it.def.name)}</b><small>${esc(arsenalRole(it))}</small>${ARSENAL_NEW.includes(it.key) ? `<span class="newtag">${L$`Nuevo`}</span>` : ''}</button>`).join('') ||
      `<p class="arsempty">${L$`Nada con ese nombre en este filtro.`}</p>`;
  }

  arsenalSheet(it) {
    const d = it.def;
    const rows = [];
    let extra = '';
    const notes = [];
    if (it.kind === 'unit') {
      const makers = Object.values(BUILDINGS).filter((b) => b.produces && b.produces.includes(it.key)).map((b) => b.name);
      rows.push([T$('Precio'), L$`${fmt(d.cost)} monedas${d.energy ? ` ${L$`y ${d.energy} de energía`}` : ''}`]);
      rows.push([T$('Comunidad'), `${d.pop} ${d.pop === 1 ? 'plaza' : 'plazas'}`]);
      rows.push([T$('Tiempo'), `${d.build} s`]);
      rows.push([T$('Se produce en'), makers.join(', ') || '—']);
      extra = this.app.ui.unitTilesHtml({ def: d, maxHp: d.hp, vet: 0 });
      const w = d.weapon;
      if (w && w.salvo > 1) notes.push(L$`Dispara salvas de ${w.salvo}.`);
      if (w && w.splash) notes.push(L$`Daño en área: a lo que esté a ${w.splash.r.toLocaleString(I18N.locale())} casillas del blanco le llega el ${Math.round(w.splash.pct * 100)} %.`);
      if (d.kamikaze) notes.push(T$('Un solo uso: se destruye al atacar.'));
      if (d.capacity) notes.push(L$`Lleva ${d.capacity} plazas de ${d.carries === 'inf' ? T$('infantería') : T$('tropas de tierra')}.`);
      if (d.hangar) notes.push(L$`Hangar para ${d.hangar} Cazas.`);
      if (d.stealth) notes.push(T$('Sigilo: solo se ve de cerca o con detectores.'));
      if (d.detects) notes.push(T$('Detecta submarinos.'));
      if (d.builds) notes.push(T$('Construye y repara.'));
      if (d.healAura) notes.push(T$('Cura a los soldados cercanos.'));
      if (d.strategic) notes.push(L$`Solo con «Arsenal estratégico» (Personalizado). Un misil, un uso por partida; alcance ${STRATEGIC.range} casillas; ${STRATEGIC.prep} s de preparación.`);
      if (!w && !d.strategic && !d.builds && !d.healAura) notes.push(T$('No pelea.'));
    } else {
      rows.push([T$('Precio'), d.cost ? L$`${fmt(d.cost)} monedas${d.energyCost ? ` ${L$`y ${d.energyCost} de energía`}` : ''}` : T$('Empiezas con uno')]);
      rows.push([T$('Tiempo de obra'), `${d.build} s`]);
      rows.push([T$('Vida'), fmt(d.hp)]);
      if (d.limit) rows.push([T$('Límite'), L$`${d.limit} por jugador`]);
      if (d.on) rows.push([T$('Dónde'), Array.isArray(d.on) ? T$('solo en ') + d.on.map((t) => TERRAIN[t].name.toLowerCase()).join(' o ') : ARSENAL_ON[d.on] || String(d.on)]);
      if (d.income) rows.push([T$('Ingreso'), L$`+${fmt(d.income)} monedas/min`]);
      if (d.maxLevel) rows.push([T$('Niveles'), L$`hasta ${d.maxLevel}`]);
      if (d.produces) rows.push([T$('Produce'), d.produces.map((t) => UNITS[t].name).join(', ')]);
      if (d.weapon) rows.push([T$('Alcance'), L$`${d.weapon.range} casillas`]);
      if (it.key === 'aadef') notes.push(T$('En nivel 4 lanza el misil nuclear. Con «Arsenal estratégico» comparte el único uso con el Lanzador nuclear móvil.'));
    }
    return `<div class="arsbig"><img alt="" src="${Thumbs.get(it.key, PLAYER_COLORS[0])}"></div>
      <span class="lbl">${ARSENAL_NEW.includes(it.key) ? T$('Nuevo · ') : ''}${esc(arsenalRole(it))}</span>
      <h3 id="ars-name">${esc(d.name)}</h3>
      <p>${esc(d.desc || '')}</p>
      <dl class="arsrows">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${extra}
      ${notes.length ? `<ul class="arsnotes">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}`;
  }

  arsenalHtml() {
    const all = arsenalItems();
    const nU = all.filter((x) => x.kind === 'unit').length;
    const list = this.arsenalList();
    if (!list.some((x) => x.key === this.arsPick)) this.arsPick = list.length ? list[0].key : null;
    const pick = list.find((x) => x.key === this.arsPick);
    const f = this.arsFilter || 'all';
    return `<section class="lcard panel arsenal">
      <div class="arshead"><div><h2>${L$`Conoce tu ejército`}</h2><p>${L$`Todo lo que hoy existe en el juego. Toca una tarjeta para ver su ficha.`}</p></div>
        <span class="arscount" id="ars-count">${L$`${nU} tropas · ${all.length - nU} edificios`}</span></div>
      <input type="search" id="ars-search" class="arssearch" placeholder="${L$`Buscar tropa o edificio…`}" value="${esc(this.arsQuery || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${L$`Buscar tropa o edificio`}">
      <div class="arsfilters">${ARSENAL_FILTERS.map(([k, label]) => `<button type="button" class="arsf ${f === k ? 'on' : ''}" data-act="arsfilter" data-v="${k}" aria-pressed="${f === k}">${label}</button>`).join('')}</div>
      <div class="arsbody"><div class="shopgrid arsgrid" id="ars-grid">${this.arsenalCards(list)}</div>
        <aside class="arssheet" id="ars-sheet" aria-live="polite">${pick ? this.arsenalSheet(pick) : ''}</aside></div>
    </section>`;
  }

  arsenalRefresh() {
    const grid = $('ars-grid');
    if (!grid) return;
    const list = this.arsenalList();
    if (!list.some((x) => x.key === this.arsPick)) this.arsPick = list.length ? list[0].key : null;
    const pick = list.find((x) => x.key === this.arsPick);
    grid.innerHTML = this.arsenalCards(list);
    $('ars-sheet').innerHTML = pick ? this.arsenalSheet(pick) : '';
  }

  invHtml() {
    const P = this.P;
    const rows = Object.entries(SKIN_SLOTS).map(([slot, S]) => {
      const mine = SKINS.filter((s) => s.slot === slot && Profile.owns(s.id));
      const eq = P.equipped[slot];
      const none = `<button type="button" class="item ${!eq ? 'equipped' : ''}" data-act="equip" data-slot="${slot}" data-id="">
        <img alt="" src="${Thumbs.get(S.model, PLAYER_COLORS[0])}"><b>${L$`Normal`}</b><small>${!eq ? T$('Equipado') : T$('Equipar')}</small></button>`;
      return `<div class="field"><label>${S.name}</label><div class="shopgrid">${none}${mine.map((s) => `
        <button type="button" class="item ${eq === s.id ? 'equipped' : 'owned'}" data-act="equip" data-slot="${slot}" data-id="${s.id}">
          <img alt="" src="${Thumbs.get(S.model, PLAYER_COLORS[0], s.look)}"><b>${esc(s.name)}</b>
          <span class="rar ${s.rar}">${RARITY[s.rar].name}</span><small>${eq === s.id ? T$('Equipado') : T$('Equipar')}</small></button>`).join('')}
        </div></div>`;
    }).join('');
    return `<section class="lcard panel"><h2>${L$`Inventario`}</h2>
      <p>${L$`Toca un aspecto para equiparlo. Se ve en tus tropas y tu Núcleo en la próxima partida.`}</p>
      ${rows}</section>` + this.achievementsHtml();
  }

  // ---------- ventanas ----------
  // Descarga la copia como archivo. En el enlace publicado se usa el permiso de descargas del visor
  // (te pide confirmar); abierto como archivo suelto, la descarga normal del navegador.
  async saveBackupFile() {
    const filename = L$`faro-de-ambar-progreso-${dayKey()}.txt`;
    const data = Profile.exportCode();
    if (window.claude && typeof window.claude.use === 'function') {
      let dl = null;
      try { dl = await window.claude.use('downloads'); } catch (err) { dl = null; }
      if (!dl) {
        this.openModal('backup', { msg: T$('Aquí no se puede descargar el archivo: usa «Copiar» y guarda el texto.') });
        return;
      }
      try {
        await dl.save({ filename, data });
        this.openModal('backup', { msg: T$('Archivo guardado. En el otro iPad, usa «Elegir archivo».') });
      } catch (err) {
        const code = err && err.code;
        if (code === 'declined') return;
        this.openModal('backup', { msg: code === 'rate_limited' ? T$('Espera un momento y vuelve a tocar «Descargar archivo».')
          : T$('Aquí no se puede descargar el archivo: usa «Copiar» y guarda el texto.') });
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // Carga una copia: primero avisa que reemplaza el progreso (toca otra vez para confirmar).
  loadBackup(code, btn) {
    const r = Profile.importCode(code);
    if (r.err) {
      this.openModal('backup', { msg: r.err });
      return;
    }
    if (!this.bkArm || this.bkArm !== code) {
      this.bkArm = code;
      if (btn) btn.textContent = L$`¿Reemplazar? Nivel ${Profile.level(r.data.xp)} · toca otra vez`;
      return;
    }
    this.bkArm = null;
    Profile.restore(r.data);
    this.openModal('backup', { msg: L$`Listo: cargaste tu progreso (nivel ${Profile.level()}, ${fmt(Profile.data.crystals)} cristales).` });
    this.render();
  }

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
    const head = (t) => `<header><h2>${t}</h2><button class="btn icon" type="button" data-act="close" aria-label="${L$`Cerrar`}">${ICON.close}</button></header>`;
    let html = '';
    const n = this.modal;
    if (n === 'about') {
      // v1.6: versión, novedades y créditos.
      html = head(T$('Acerca de Faro de Ámbar')) + `<p><span class="about-ver">${L$`Versión ${GAME_VERSION}`}</span> ${L$`· prototipo web de un juego de estrategia sobre islas de hexágonos, hecho para jugar en el iPad.`}</p>
        <h3>${L$`Novedades de esta versión`}</h3>
        <ul class="about-news">${ABOUT_NEWS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <h3>${L$`Créditos`}</h3>
        <div class="about-credits"><span>${L$`Modelos 3D hechos con Blender para este juego.`}</span>
          <span>${L$`Cielo de ambiente: Poly Haven (CC0).`}</span>
          <span>${L$`Caminar y correr: CMU Graphics Lab Motion Capture Database.`}</span>
          <span>${L$`Motor 3D: three.js r128.`}</span></div>
        <div class="row"><button class="btn gold" type="button" data-act="close">${L$`Cerrar`}</button></div>`;
    } else if (n === 'modes') {
      const lv = Profile.level();
      html = head(T$('Elige un modo')) + `<div class="mode-cards">${Object.entries(MODES).filter(([, m]) => m.lobby).map(([k, m]) => {
        const locked = m.minLevel && lv < m.minLevel && !Creator.active();
        return `<button type="button" class="mode-card ${P.play.mode === k ? 'on' : ''}" data-act="pickmode" data-v="${k}" ${locked ? 'disabled' : ''}>
          <b>${esc(m.name)}</b><small>${esc(m.desc)}</small>${locked ? `<em>${L$`Desde nivel ${m.minLevel}`}</em>` : ''}</button>`;
      }).join('')}</div>`;
    } else if (n === 'maps') {
      html = head(T$('Elige un mapa')) + `<div class="mode-cards">${LOBBY_MAPS.map((k) => `<button type="button" class="mode-card mapcard ${P.play.mapKind === k ? 'on' : ''}" data-act="pickmap" data-v="${k}">
        <img class="mapthumb" alt="" src="${mapThumb(k)}"><b>${esc(MAPS[k].name)}</b><small>${esc(MAPS[k].desc)}</small></button>`).join('')}</div>`;
    } else if (n === 'pass') {
      const tier = Profile.passTier();
      const tiers = [];
      for (let t = 1; t <= PASS_TIERS; t++) {
        const r = passReward(t);
        const reached = t <= tier;
        const claimed = !!P.pass[t];
        tiers.push(`<div class="tier ${reached ? 'reached' : ''} ${claimed ? 'claimed' : ''}"><b>${t}</b><span>${r.text}</span>
          ${claimed ? `<small>${L$`Reclamado`}</small>` : reached ? `<button class="mini-btn" type="button" data-act="passclaim" data-v="${t}">${L$`Reclamar`}</button>` : `<small>${fmt(t * PASS_TIER_XP)} XP</small>`}</div>`);
      }
      const S = seasonOf(Profile.now());
      html = head(L$`Pase del Faro · Temporada ${S.no}`) + `<p>${L$`Pista gratis de ${PASS_TIERS} niveles. Cada ${PASS_TIER_XP} XP subes un nivel del pase. Esta temporada llevas ${fmt(P.season.passXp || 0)} XP (nivel ${tier}). Termina el ${L$`${S.end.getDate()} de ${MONTHS[S.end.getMonth()]}`}: entonces el pase vuelve a empezar.`}</p>
        ${Profile.passClaimable() ? `<div class="row"><button class="btn gold" type="button" data-act="passall">${L$`Reclamar todo`}</button></div>` : ''}
        <div class="tiers">${tiers.join('')}</div>`;
    } else if (n === 'missions') {
      html = head(T$('Misiones')) + this.missionsInner();
    } else if (n === 'missions-old') {
      const row = (m, i, kind) => {
        const d = MISSION_BY_ID[m.id];
        const prog = Math.min(d.goal, m.prog);
        return `<div class="mission ${m.done ? 'done' : ''}"><span>${esc(d.text)}</span>
          <span>${m.done ? T$('Hecha') : `${prog} / ${d.goal}`}${kind === 'daily' && !m.done && !P.missions.rerolled ? ` <button class="mini-btn" type="button" data-act="reroll-m" data-v="${i}">${L$`Cambiar`}</button>` : ''}</span>
          <div class="xpbar"><i style="width:${(prog / d.goal) * 100}%"></i></div></div>`;
      };
      html = head(T$('Misiones')) + `<p>${L$`Cada misión da ${XP_REWARD.mission} XP y cristales (${MISSION_CRYSTALS.daily} las diarias, ${MISSION_CRYSTALS.weekly} las semanales). Se completan al terminar una partida.`}</p>
        <h3>${L$`Diarias${P.missions.rerolled ? T$(' · ya cambiaste una hoy') : T$(' · puedes cambiar 1 al día')}`}</h3>${P.missions.daily.map((m, i) => row(m, i, 'daily')).join('')}
        <h3>${L$`Semanales`}</h3>${P.missions.weekly.map((m, i) => row(m, i, 'weekly')).join('')}`;
    } else if (n === 'daily') {
      const D = P.daily;
      const can = Profile.dailyClaimable();
      html = head(T$('Premio diario')) + `<p>${L$`Entra cada día para avanzar. Si faltas un día, la racha baja 1.${D.lost ? ` Faltaste y bajaste ${D.lost}.` : ''}`}</p>
        <div class="daygrid">${DAILY_REWARDS.map((r, i) => `<div class="day ${i < D.idx ? 'done' : ''} ${i === D.idx && can ? 'today' : ''} ${r === 'faro' ? 'big' : ''}">
          <span>${L$`Día ${i + 1}`}</span><b>${r === 'faro' ? T$('Cofre') : r}</b><small>${r === 'faro' ? T$('del Faro') : T$('cristales')}</small></div>`).join('')}</div>
        <div class="row"><button class="btn gold" type="button" data-act="dailyclaim" ${can ? '' : 'disabled'}>${can ? L$`Reclamar día ${D.idx + 1}` : T$('Ya reclamaste hoy')}</button></div>`;
    } else if (n === 'codes') {
      html = head(T$('Códigos')) + `<form id="code-form" class="field"><label for="code-input">${L$`Escribe un código`}</label>
        <input type="text" id="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="FARO2026">
        <button class="btn gold" type="submit">${L$`Canjear`}</button></form>
        ${this.modalData && this.modalData.msg ? `<div class="advice">${esc(this.modalData.msg)}</div>` : ''}
        <p>${L$`Cada código se usa una vez. Los códigos nuevos se anuncian en las actualizaciones.`}</p>`;
    } else if (n === 'backup') {
      const D = this.modalData || {};
      html = head(T$('Copia de tu progreso')) + `<p>${L$`Tu nivel, cristales, aspectos y rango se guardan solo en este navegador. Con esta copia los llevas a otro iPad o navegador${Platform.name === 'poki' ? '' : T$(' (en Roblox se guardarán en tu cuenta)')}.`}</p>
        <div class="field"><label for="bk-out">${L$`1 · Guardar: copia este texto o descárgalo`}</label>
          <textarea id="bk-out" readonly rows="3" spellcheck="false">${esc(Profile.exportCode())}</textarea>
          <div class="row"><button class="btn gold" type="button" data-act="bk-copy" id="btn-bk-copy">${L$`Copiar`}</button>
          <button class="btn" type="button" data-act="bk-file" id="btn-bk-file">${L$`Descargar archivo`}</button></div></div>
        <div class="field"><label for="bk-in">${L$`2 · Cargar: pega aquí una copia (reemplaza tu progreso de este navegador)`}</label>
          <textarea id="bk-in" rows="3" spellcheck="false" placeholder="FARO1...."></textarea>
          <div class="row"><button class="btn gold" type="button" data-act="bk-load" id="btn-bk-load">${L$`Cargar copia`}</button>
          <label class="btn" for="bk-filein">${L$`Elegir archivo`}</label><input type="file" id="bk-filein" accept=".txt,.json,text/plain,application/json" hidden></div></div>
        ${D.msg ? `<div class="advice" id="bk-msg">${esc(D.msg)}</div>` : ''}`;
    } else if (n === 'creator') {
      const C = P.creator;
      html = head(T$('Zona de creadores')) + `<p>${L$`${Creator.platform ? T$('Solo lo ves tú: la plataforma confirma que eres el dueño de este juego.') : T$('Entraste con la contraseña de creadores. Se vuelve a pedir cada vez que abres el juego.')} Los demás jugadores no pueden abrirla.`}</p>
        <div class="field"><label>${L$`Monedas y energía infinitas · todo desbloqueado`}</label><div class="seg">
          <button type="button" data-act="creator" data-k="on" data-v="true" class="${C.on ? 'on' : ''}">${L$`Activado`}</button>
          <button type="button" data-act="creator" data-k="on" data-v="false" class="${!C.on ? 'on' : ''}">${L$`Apagado`}</button></div></div>
        <div class="field"><label>${L$`Construcción rápida`}</label><div class="seg">
          <button type="button" data-act="creator" data-k="instant" data-v="true" class="${C.instant ? 'on' : ''}">${L$`Sí`}</button>
          <button type="button" data-act="creator" data-k="instant" data-v="false" class="${!C.instant ? 'on' : ''}">No</button></div></div>
        <p>${L$`Las partidas en modo creador no dan XP ni cristales. En Roblox se hará igual, con tu UserId comprobado en el servidor.`}</p>
        ${Creator.byPass ? `<div class="row"><button class="btn" type="button" data-act="creatorlock" id="btn-creatorlock">${L$`Cerrar la zona de creadores`}</button></div>` : ''}`;
    } else if (n === 'creatorpw') {
      const D = this.modalData || {};
      const left = Creator.lockLeft();
      html = head(T$('Zona de creadores')) + `<p>${L$`Solo para los creadores del juego. Escribe la contraseña para entrar.`}</p>
        <form id="creator-form" class="field"><label for="creator-pw">${L$`Contraseña`}</label>
          <input type="password" id="creator-pw" inputmode="numeric" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32" ${left ? 'disabled' : ''}>
          <button class="btn gold" type="submit" id="btn-creator-enter" ${left ? 'disabled' : ''}>${L$`Entrar`}</button></form>
        ${D.msg ? `<div class="advice" id="creator-msg" role="alert">${esc(D.msg)}</div>` : ''}
        <p class="sec">${L$`Se vuelve a pedir cada vez que abres el juego. Después de ${CREATOR_PASS.tries} intentos fallidos hay que esperar ${CREATOR_PASS.wait} s.`}</p>`;
    } else if (n === 'chestopen') {
      const r = this.modalData;
      if (r.kind === 'frags') {
        html = head(esc(r.chest)) + `<div class="item equipped" style="cursor:default"><div class="fragicon" aria-hidden="true"></div>
          <b>${L$`${r.frags} fragmentos`}</b><small>${L$`Ahora tienes ${this.P.fragments}. Úsalos en el Taller con un plano.`}</small></div>
          <div class="row"><button class="btn gold" type="button" data-act="close">${L$`Genial`}</button></div>`;
      } else if (r.kind === 'plan') {
        html = head(esc(r.chest)) + `<div class="item equipped plan" style="cursor:default">
          <img alt="" src="${Thumbs.get(SKIN_SLOTS[r.item.slot].model, PLAYER_COLORS[0], r.item.look)}">
          <b>${L$`Plano: ${esc(r.item.name)}`}</b><span class="rar ${r.item.rar}">${RARITY[r.item.rar].name}</span>
          <small>${L$`Fabrícalo en el Taller con ${FRAG_COST[r.item.rar]} fragmentos (tienes ${this.P.fragments}).`}</small></div>
          <div class="row"><button class="btn gold" type="button" data-act="close">${L$`Genial`}</button>
          <button class="btn" type="button" data-act="shoptab" data-v="workshop">${L$`Ir al Taller`}</button></div>`;
      } else {
        html = head(esc(r.chest)) + `<div class="item ${r.dup ? 'owned' : 'equipped'}" style="cursor:default">
          <img alt="" src="${Thumbs.get(SKIN_SLOTS[r.item.slot].model, PLAYER_COLORS[0], r.item.look)}">
          <b>${esc(r.item.name)}</b><span class="rar ${r.item.rar}">${RARITY[r.item.rar].name}</span>
          <small>${r.dup ? L$`Repetido: se convierte en ${r.frags} fragmentos` : T$('¡Nuevo! Ya está en tu Inventario')}</small></div>
          <div class="row"><button class="btn gold" type="button" data-act="close">${L$`Genial`}</button>
          ${r.dup ? '' : `<button class="btn" type="button" data-act="equip" data-slot="${r.item.slot}" data-id="${r.item.id}">${L$`Equipar`}</button>`}</div>`;
      }
    } else if (n === 'info') {
      html = head(esc(this.modalData.title)) + `<p>${esc(this.modalData.text)}</p><div class="row"><button class="btn gold" type="button" data-act="close">${L$`Aceptar`}</button></div>`;
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
    } else if (act === 'settings') {
      app.ui.openSettings();
    } else if (act === 'creatorzone') {
      if (Platform.name === 'poki') return;
      if (Creator.owner) this.openModal('creator');
      else this.openModal('creatorpw');
    } else if (act === 'creatorlock') {
      Creator.lock();
      Profile.save();
      this.closeModal();
      this.render();
      app.ui.toast(T$('Zona de creadores cerrada'), 'info');
    } else if (act === 'play') {
      this.syncOpts();
      app.startGame();
    } else if (act === 'toptab') {
      this.topTab = b.dataset.v;
      this.render();
    } else if (act === 'weekly') {
      this.sub = 'weekly';
      this.syncOpts();
      app.startGame();
    } else if (act === 'ranked') {
      if (Profile.level() < RANKED_LEVEL && !Creator.active()) {
        this.openModal('info', { title: T$('Liga 3 vs 3'), text: L$`La Liga 3 vs 3 se abre en el nivel ${RANKED_LEVEL}. Ahora estás en el nivel ${Profile.level()}: juega otras partidas para subir.` });
        return;
      }
      this.P.play.mode = RANKED_MODE;
      Profile.save();
      this.sub = 'main';
      this.syncOpts();
      app.startGame();
    } else if (act === 'mission') {
      app.startMission(Number(b.dataset.v));
    } else if (act === 'reroll') {
      app.reroll();
    } else if (act === 'diff') {
      this.setPlay('difficulty', b.dataset.v);
    } else if (act === 'arsfilter') {
      this.arsFilter = b.dataset.v;
      document.querySelectorAll('#menu .arsf').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      this.arsenalRefresh();
    } else if (act === 'arspick') {
      this.arsPick = b.dataset.k;
      this.arsenalRefresh();
      // En pantallas angostas la ficha queda debajo de la lista: se lleva a la vista.
      const sheet = $('ars-sheet');
      if (sheet && window.innerWidth < 760) sheet.scrollIntoView({ block: 'nearest' });
    } else if (act === 'cset') {
      let v = b.dataset.v;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^\d+$/.test(v)) v = Number(v);
      this.setPlay(b.dataset.k, v);
    } else if (act === 'modal') {
      this.openModal(b.dataset.m);
    } else if (act === 'close') {
      this.closeModal();
    } else if (act === 'bk-copy') {
      const t = $('bk-out');
      t.select();
      const done = () => this.openModal('backup', { msg: T$('Copiado. Pégalo en «Cargar» en el otro iPad o navegador.') });
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(done, () => { try { document.execCommand('copy'); } catch (err) { /* nada */ } done(); });
      else { try { document.execCommand('copy'); } catch (err) { /* nada */ } done(); }
    } else if (act === 'bk-file') {
      this.saveBackupFile();
    } else if (act === 'bk-load') {
      this.loadBackup($('bk-in').value, b);
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
      this.view = 'shop';
      if (this.modal) this.closeModal();
      this.render();
    } else if (act === 'craft') {
      const err = this.craft(b.dataset.id);
      if (err) this.openModal('info', { title: T$('Taller'), text: err });
      else this.openModal('info', { title: T$('Taller'), text: L$`¡Fabricaste ${SKIN_BY_ID[b.dataset.id].name}! Ya está en tu Inventario.` });
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
    if (r.xp) Profile.addXp(r.xp);
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
      this.app.ui.toast(L$`+${r} cristales`, 'good');
    }
    Profile.save();
    this.render();
  }

  redeem(raw) {
    const P = this.P;
    const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    let msg;
    if (!code) msg = T$('Escribe un código.');
    else if (!CODES[code]) msg = T$('Ese código no existe.');
    else if (P.codes[code]) msg = T$('Ya usaste este código.');
    else {
      P.codes[code] = dayKey();
      msg = L$`¡Listo! ${CODES[code].text}.`;
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
    this.app.ui.toast(L$`Compraste ${s.name}`, 'good');
    this.render();
  }

  // Taller (v1.2): fabrica un aspecto con su plano y fragmentos.
  craft(id) {
    const P = this.P;
    const s = SKIN_BY_ID[id];
    if (!s || !(P.plans || {})[id]) return T$('No tienes el plano de ese aspecto');
    if (P.owned[id]) return T$('Ya tienes ese aspecto');
    const cost = FRAG_COST[s.rar];
    if ((P.fragments || 0) < cost) return L$`Te faltan ${cost - (P.fragments || 0)} fragmentos`;
    P.fragments -= cost;
    delete P.plans[id];
    P.owned[id] = true;
    Profile.save();
    return null;
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
    // v1.2: aspecto, plano o fragmentos (la garantía del legendario siempre da el aspecto).
    P.fragments = P.fragments || 0;
    P.plans = P.plans || {};
    const split = rar === 'legendario' && P.chests.pity === 0 ? 0 : Math.random() * 100;
    let kindOut = split < CHEST_SPLIT.skin ? 'skin' : split < CHEST_SPLIT.skin + CHEST_SPLIT.plan ? 'plan' : 'frags';
    let planItem = null;
    if (kindOut === 'plan') {
      const cand = SKINS.filter((s) => !s.special && !P.owned[s.id] && !P.plans[s.id]);
      if (cand.length) planItem = cand[Math.floor(Math.random() * cand.length)];
      else kindOut = 'frags';
    }
    let frags = 0;
    let dup = false;
    if (kindOut === 'skin') {
      dup = !!P.owned[item.id];
      if (dup) frags = FRAG_DUP[rar];
      else P.owned[item.id] = true;
    } else if (kindOut === 'plan') {
      P.plans[planItem.id] = true;
    } else {
      frags = FRAG_PACK[0] + Math.floor(Math.random() * (FRAG_PACK[1] - FRAG_PACK[0] + 1));
    }
    P.fragments += frags;
    Profile.save();
    const result = { chest: C.name, item: kindOut === 'plan' ? planItem : item, dup, frags, kind: kindOut };
    if (!quiet) {
      this.openModal('chestopen', result);
      this.render();
    }
    return result;
  }

  // ---------- logros (v1.4) ----------
  checkAchievements(c) {
    const P = c.P;
    P.achievements = P.achievements || {};
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (P.achievements[a.id]) continue;
      let ok = false;
      try { ok = !!a.done(c); } catch (err) { ok = false; }
      if (ok) {
        P.achievements[a.id] = dayKey();
        got.push(a);
      }
    }
    return got;
  }

  achievementsHtml() {
    const P = this.P;
    const A = P.achievements || {};
    const n = ACHIEVEMENTS.filter((a) => A[a.id]).length;
    return `<section class="lcard panel" id="logros"><h3>${L$`Logros · ${n} de ${ACHIEVEMENTS.length}`}</h3><div class="achs">${ACHIEVEMENTS.map((a) => {
      const on = !!A[a.id];
      const pr = !on && a.prog ? a.prog(P) : null;
      return `<div class="ach ${on ? 'on' : ''}" data-ach="${a.id}"><span class="achbadge" style="--ac:${a.color}">${esc(a.icon)}</span>
        <div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        ${pr ? `<div class="xpbar"><i style="width:${Math.min(100, (pr[0] / pr[1]) * 100)}%"></i></div><small>${fmt(pr[0])} / ${fmt(pr[1])}</small>` : ''}
        <em>${on ? L$`Logrado el ${prettyDate(A[a.id])}` : a.crystals ? L$`${a.crystals} cristales` : T$('Insignia')}</em></div></div>`;
    }).join('')}</div></section>`;
  }

  // ---------- Top jugadores (v1.4, tu documento pág. 20) ----------
  topHtml() {
    const P = this.P;
    const tab = this.topTab || 'liga';
    const rows = topRows(P, tab);
    const me = rows.find((r) => r.me);
    const S = seasonOf(Profile.now());
    const tabs = [['liga', T$('Liga 3 vs 3')], ['wins', T$('Victorias')], ['islands', T$('Islas tomadas')]]
      .map(([k, l]) => `<button type="button" data-act="toptab" data-v="${k}" class="${tab === k ? 'on' : ''}" aria-pressed="${tab === k}">${l}</button>`).join('');
    const head = tab === 'liga' ? `<th>${L$`Rango`}</th><th>${L$`Puntos`}</th><th>${L$`% victorias`}</th>` : tab === 'wins' ? `<th>${L$`Victorias`}</th>` : `<th>${L$`Islas tomadas`}</th>`;
    const cells = (r) => (tab === 'liga' ? `<td>${rankName(r.points)}</td><td>${fmt(r.points)}</td><td>${Math.round(r.pct * 100)} %</td>`
      : tab === 'wins' ? `<td>${fmt(r.wins)}</td>` : `<td>${fmt(r.islands)}</td>`);
    const row = (r) => `<tr class="${r.me ? 'me' : ''}"><td>${r.pos <= 3 ? `<span class="medal m${r.pos}" aria-label="${[T$('Oro'), T$('Plata'), T$('Bronce')][r.pos - 1]}">${r.pos}</span>` : r.pos}</td>
      <td>${esc(r.name)}${r.bot ? ' <small>bot</small>' : ` <small>${L$`(tú)`}</small>`}</td>${cells(r)}</tr>`;
    const top = rows.slice(0, 10);
    const body = top.map(row).join('') + (me.pos > 10 ? `<tr class="gap"><td colspan="5">···</td></tr>${row(me)}` : '');
    return `<section class="lcard panel"><h2>${L$`Top jugadores · Temporada ${S.no}`}</h2>
      <p class="queue">${L$`${tab === 'liga' ? T$('Los mejores de la Liga 3 vs 3 en esta temporada.') : tab === 'wins' ? T$('Más victorias (todos los modos).') : T$('Más islas tomadas (todos los modos).')} ${Platform.name === 'poki' ? T$('Los demás son comandantes bot. Tu fila siempre se ve.') : T$('Sin servidores, los demás son comandantes bot; en Roblox serán jugadores reales. Tu fila siempre se ve.')}`}</p>
      <div class="subtabs">${tabs}</div>
      <table class="toptable" id="toptable"><thead><tr><th>#</th><th>${L$`Jugador`}</th>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
  }

  // ---------- desafío semanal (v1.4) ----------
  weeklyHtml() {
    const W = weeklyFor(Profile.now());
    const rec = (this.P.weekly || {})[W.week] || { tries: 0, won: false, best: null };
    const days = Math.max(1, Math.round((W.next - new Date(Profile.now().getFullYear(), Profile.now().getMonth(), Profile.now().getDate())) / 86400000));
    return `<section class="lcard panel weekly"><h2>${L$`Desafío semanal: ${esc(W.name)}`}</h2>
      <div class="weeklybox"><img class="mapthumb" alt="" src="${mapThumb(W.mapKind, MODES[W.mode].players)}">
      <div><p id="weekly-desc">${esc(W.desc)}</p>
      <p class="queue">${L$`${esc(MODES[W.mode].name)} · ${esc(MAPS[W.mapKind].name)} · bots en ${DIFFICULTY[W.difficulty].name}. Es el mismo mapa toda la semana; cambia en ${days} ${days === 1 ? T$('día') : T$('días')} (el lunes).`}</p>
      <p>${L$`${rec.won ? `<b>${L$`Ganado.`}</b> ${L$`Tu mejor tiempo:`} <b id="weekly-best">${fmtTime(rec.best)}</b>${L$`. Intenta bajarlo.`}` : `${L$`Premio la primera vez que lo ganas:`} <b>${L$`${WEEKLY_CRYSTALS} cristales`}</b>.`} Intentos: ${rec.tries}.`}</p>
      <div class="row"><button class="btn gold" type="button" data-act="weekly" id="btn-weekly">${L$`Jugar desafío`}</button></div></div></div></section>`;
  }

  // ---------- Liga 3 vs 3 (v1.3) ----------
  // Gana +25, pierde −15. Recién llegado a un rango, la primera derrota no te baja de él.
  rankedResult(win, forfeit = false) {
    const R = this.P.ranked;
    const before = R.points;
    const idx0 = rankIndex(before);
    let delta = win ? RANK_WIN : -Math.min(RANK_LOSS, before);
    let saved = false;
    if (!win && R.shield && rankIndex(before + delta) < idx0) {
      delta = RANK_MIN[idx0] - before;
      saved = true;
    }
    if (!win) R.shield = false;
    R.points = Math.max(0, before + delta);
    if (rankIndex(R.points) > idx0) R.shield = true;
    R.best = Math.max(R.best || 0, R.points);
    R.games = (R.games || 0) + 1;
    if (win) R.wins = (R.wins || 0) + 1;
    R.history = [{ day: dayKey(), win, delta, rank: rankName(R.points), forfeit }, ...(R.history || [])].slice(0, 12);
    Profile.save();
    return { before, after: R.points, delta, from: rankName(before), to: rankName(R.points), saved, forfeit };
  }

  rankedLine(r) {
    return L$`Liga 3 vs 3${r.forfeit ? ' (abandonada)' : ''}: ${r.delta >= 0 ? '+' : ''}${r.delta} puntos · ${r.from === r.to ? r.to : `${r.from} → ${r.to}`}${r.saved ? T$(' · protección de rango: no bajaste') : ''}`;
  }

  // Abandonar una partida de la Liga (o empezar otra encima) cuenta como derrota.
  forfeitRanked() {
    const r = this.rankedResult(false, true);
    this.app.ui.toast(this.rankedLine(r), 'bad');
    return r;
  }

  // ---------- final de partida ----------
  finish(game) {
    if (game.rewarded) return game.reward || null;
    game.rewarded = true;
    const P = this.P;
    const me = game.players[0];
    const win = game.result === 'victory';
    const out = { xp: 0, crystals: 0, lines: [], missions: [], levelUp: false, creator: !!game.creator, tutorial: null };
    if (game.creator || game.mode.sandbox) {
      // v1.8: el Campo de pruebas no da XP, cristales ni misiones.
      if (game.mode.sandbox) out.lines.push(T$('Campo de pruebas: sin XP, cristales ni misiones'));
      game.reward = out;
      return out;
    }
    Profile.refresh();
    const lv0 = Profile.level();
    const half = game.opts.custom ? 0.5 : 1;
    const parts = [
      [T$('Jugar'), XP_REWARD.play],
      [T$('Ganar'), win ? XP_REWARD.win : 0],
      [L$`Islas tomadas (${me.stats.captures})`, me.stats.captures * XP_REWARD.island],
      [L$`Núcleos destruidos (${me.coresKilled})`, me.coresKilled * XP_REWARD.core],
    ];
    for (const [label, n] of parts) {
      const v = Math.round(n * half);
      if (v > 0) {
        out.xp += v;
        out.lines.push(`${label}: +${v} XP`);
      }
    }
    if (half < 1) out.lines.push(T$('Personalizado: mitad de XP'));
    out.crystals = Math.round((GAME_CRYSTALS.play + (win ? GAME_CRYSTALS.win : 0)) * half);
    // v1.2: fragmentos por jugar.
    out.frags = Math.round((FRAG_GAME.play + (win ? FRAG_GAME.win : 0)) * half);
    P.fragments = (P.fragments || 0) + out.frags;
    if (out.frags) out.lines.push(L$`Fragmentos: +${out.frags}`);
    P.stats.games++;
    if (win) P.stats.wins++;
    P.stats.islands += me.stats.captures;
    P.stats.cores += me.coresKilled;
    P.stats.kills += me.stats.kills;
    P.stats.trained = (P.stats.trained || 0) + me.stats.trained;
    P.stats.faro = (P.stats.faro || 0) + (me.stats.faro || 0);
    // v1.4: desafío semanal: mejor tiempo y premio la primera vez que lo ganas.
    if (game.opts.weekly) {
      const W = P.weekly[game.opts.weekly] || (P.weekly[game.opts.weekly] = { tries: 0, won: false, best: null });
      W.tries++;
      if (win) {
        if (!W.won) {
          out.crystals += WEEKLY_CRYSTALS;
          out.lines.push(L$`Desafío semanal ganado: +${WEEKLY_CRYSTALS} cristales`);
        }
        W.won = true;
        W.best = W.best === null ? Math.round(game.time) : Math.min(W.best, Math.round(game.time));
        out.weekly = W.best;
      }
    }
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
      out.tutorial = T$('Insignia «Primer Faro», 150 cristales y el aspecto Soldado Dorado');
    }
    // Campaña: premio la primera vez que terminas la misión y cristales por cada estrella nueva.
    if (game.camp) {
      const m = Campaign.def(game.camp.id);
      const got = Campaign.stars(game).filter((s) => s.ok).length;
      const prev = P.campaign.stars[m.id] || 0;
      out.camp = { id: m.id, got, prev, first: 0, newStars: 0 };
      if (win && !P.campaign.done[m.id]) {
        P.campaign.done[m.id] = true;
        out.camp.first = m.crystals;
        out.crystals += m.crystals;
      }
      if (got > prev) {
        out.camp.newStars = got - prev;
        out.crystals += out.camp.newStars * CAMPAIGN_STAR_CRYSTALS;
        P.campaign.stars[m.id] = got;
      }
    }
    // Liga 3 vs 3: puntos y rango.
    if (game.mode.ranked && !game.opts.custom) {
      out.ranked = this.rankedResult(win);
      out.lines.push(this.rankedLine(out.ranked));
    }
    // v1.4: logros nuevos de esta partida.
    out.achievements = this.checkAchievements({ P, g: game, me, win });
    for (const a of out.achievements) {
      out.crystals += a.crystals;
      out.lines.push(L$`Logro: ${a.name}${a.crystals ? ` ${L$`(+${a.crystals} cristales)`}` : ''}`);
    }
    Profile.addXp(out.xp);
    P.crystals += out.crystals;
    out.level = Profile.level();
    out.levelUp = out.level > lv0;
    Profile.save();
    game.reward = out;
    return out;
  }

  positions(game) {
    // Solo hay «Ganador» si queda un equipo (o en Rey del Faro); si siguen varios, todos «Seguía en pie».
    const aliveTeams = new Set(game.players.filter((p) => p.alive).map((p) => p.team));
    const winTeam = game.kingWinner !== undefined ? game.kingWinner : aliveTeams.size === 1 ? [...aliveTeams][0] : -999;
    const alive = game.players.filter((p) => p.alive).sort((a, b) => (b.team === winTeam) - (a.team === winTeam));
    const list = [];
    let rank = 0;
    let lastWin = null;
    alive.forEach((p, i) => {
      const w = p.team === winTeam;
      if (!(w && lastWin)) rank = i + 1;
      lastWin = w;
      list.push({ p, rank, note: w ? T$('Ganador') : T$('Seguía en pie') });
    });
    for (let i = game.elimOrder.length - 1; i >= 0; i--) {
      const e = game.elimOrder[i];
      list.push({ p: game.players[e.pid], rank: list.length + 1, note: L$`Cayó a los ${fmtTime(e.time)}` });
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
      bld: T$('Las torretas y defensas enemigas te hicieron mucho daño. Atácalas desde lejos con Tanques o Lanzamisiles.'),
      inf: T$('La infantería enemiga te desgastó. Prueba Escopeteros, Jeeps o Torretas mejoradas con miniguns.'),
      veh: T$('Los vehículos enemigos te superaron. Los Cazadores y Coheteros hacen más daño a tanques.'),
      air: T$('Te atacaron desde el aire. Construye AIR DEFENSE y Camiones antiaéreos cerca del Núcleo.'),
      sea: T$('Los barcos atacaron tu costa. Pon Torretas en la costa, ten Destructores y mejora el Núcleo para la Cúpula.'),
      arty: T$('Los Lanzamisiles te atacaron de lejos. Sube el Núcleo a nivel 3 y compra la Cúpula.'),
    };
    if (top && tips[top[0]]) return tips[top[0]];
    return T$('Entrena Constructores pronto y construye más Granjas y energía: con más monedas tendrás un ejército más grande.');
  }

  // Final de una misión: estrellas, por qué faltó cada una y «Siguiente misión».
  missionEndHtml(game) {
    const r = this.finish(game);
    const m = Campaign.def(game.camp.id);
    const me = game.players[0];
    const win = game.result === 'victory';
    const stars = Campaign.stars(game);
    if (!win) stars[0].why = T$('Tu Núcleo cayó');
    const got = stars.filter((s) => s.ok).length;
    const next = Campaign.def(m.id + 1);
    const nextOpen = !!next && Campaign.unlocked(next.id, this.P, Creator.active());
    const c = r.camp;
    const opened = nextOpen && !!c && c.first > 0;
    const text = !win ? T$('Tu Núcleo cayó. Puedes repetir la misión cuando quieras.')
      : next ? L$`Misión cumplida.${opened ? ` ${L$`Se abrió la misión ${next.id}: ${next.name}.`}` : ''}`
        : T$('¡Terminaste la campaña! El Faro de Ámbar vuelve a brillar.');
    const why = c ? [c.first ? L$`Primera vez: ${c.first}` : '', c.newStars ? `${c.newStars === 1 ? T$('1 estrella nueva') : L$`${c.newStars} estrellas nuevas`}: ${c.newStars * CAMPAIGN_STAR_CRYSTALS}` : '',
      r.missions.length ? 'misiones' : ''].filter(Boolean).join(' · ') : '';
    const prizes = r.creator
      ? `<div><b>${L$`Modo creador`}</b><span>${L$`Sin XP ni cristales`}</span></div>`
      : `<div><b>+${fmt(r.xp)} XP</b><span>${r.lines.map(esc).join(' · ')}</span></div>
         <div><b>${L$`+${fmt(r.crystals)} cristales`}</b><span>${esc(why || T$('Por jugar'))}</span></div>
         <div><b>${L$`Nivel ${r.level}`}</b><span>${r.levelUp ? T$('¡Subiste de nivel!') : `${fmt(this.P.xp % LEVEL_XP)} / ${fmt(LEVEL_XP)} XP`}</span></div>`;
    const core = me.core;
    return `
      <div class="endhero"><div><small class="lbl">${L$`Campaña · Misión ${m.id} de ${CAMPAIGN.length}`}</small>
        <h2>${win ? T$('¡Misión cumplida!') : T$('Misión fallida')}</h2><p>${esc(m.name)} · ${esc(text)}</p></div>
        <div class="bigstars" role="img" aria-label="${L$`${got} de 3 estrellas`}">${stars.map((s) => `<i class="${s.ok ? 'on' : ''}">★</i>`).join('')}</div></div>
      <ol class="starlist">${stars.map((s) => `<li class="${s.ok ? 'ok' : 'no'}"><b>${esc(s.text)}</b><span>${s.ok ? T$('Conseguida') : esc(s.why)}</span></li>`).join('')}</ol>
      <div class="endstats">
        <div><b>${fmtTime(game.time)}</b><span>${L$`Tiempo`}</span></div>
        <div><b>${me.stats.lost}</b><span>${L$`Tropas perdidas`}</span></div>
        <div><b>${game.camp.lostBld}</b><span>${L$`Edificios perdidos`}</span></div>
        <div><b>${core.alive ? Math.round((core.hp / core.maxHp) * 100) : 0} %</b><span>${L$`Vida del Núcleo`}</span></div>
      </div>
      <h3 class="lbl">${L$`Premios`}</h3>
      <div class="prizes">${prizes}</div>
      ${r.missions.length ? `<div class="advice">${L$`Misiones completadas: ${r.missions.map(esc).join(', ')}`}</div>` : ''}
      ${win ? '' : `<div class="advice"><b>${L$`Consejo:`}</b> ${esc(m.tip)}</div>`}
      <div class="row">
        <button class="btn" type="button" id="btn-watch">${L$`Mirar el final`}</button>
        ${win && next ? `<button class="btn gold" type="button" id="btn-next" data-v="${next.id}">${L$`Siguiente misión`}</button>` : ''}
        <button class="btn ${win && next ? '' : 'gold'}" type="button" id="btn-again">${L$`Repetir`}</button>
        <button class="btn" type="button" id="btn-menu">${L$`Vestíbulo`}</button>
      </div>`;
  }

  // ---------- gráficas del final (v1.1) ----------
  // Dos gráficas (no un solo eje doble): monedas por minuto y tropas de combate de cada imperio.
  // Cada línea tiene el color de su imperio y además su propio trazo y su nombre al final.
  historyHtml(game) {
    const H = game.history || [];
    if (H.length < 2) return '';
    const ids = game.players.map((p) => p.id);
    return `<h3 class="lbl">${L$`Cómo fue la partida`}</h3>
      <div class="histcharts">${this.historyChart(game, 'inc', T$('Monedas por minuto'))}${this.historyChart(game, 'army', T$('Tropas de combate'))}</div>
      <div class="histlegend">${ids.map((i) => `<span><svg width="26" height="8" aria-hidden="true"><line x1="1" y1="4" x2="25" y2="4" stroke="${cssColor(game.players[i].color)}" stroke-width="2" stroke-dasharray="${HIST_DASH[i]}" stroke-linecap="round"/></svg>${esc(game.players[i].name)}</span>`).join('')}</div>
      <details class="histtable"><summary>${L$`Ver como tabla`}</summary><table><thead><tr><th>${L$`Imperio`}</th><th>${L$`Monedas/min (final)`}</th><th>${L$`Monedas/min (máx.)`}</th><th>${L$`Tropas (máx.)`}</th></tr></thead><tbody>
        ${ids.map((i) => `<tr><td>${esc(game.players[i].name)}</td><td>${fmt(H[H.length - 1].inc[i])}</td><td>${fmt(Math.max(...H.map((h) => h.inc[i])))}</td><td>${Math.max(...H.map((h) => h.army[i]))}</td></tr>`).join('')}
      </tbody></table></details>`;
  }

  historyChart(game, key, title) {
    const H = game.history;
    const W = 560;
    const Ht = 170;
    const L = 40;
    const R = 64;
    const T = 10;
    const B = 22;
    const tMax = Math.max(H[H.length - 1].t, 1);
    const vMax = Math.max(1, ...H.map((h) => Math.max(...h[key])));
    const nice = Math.pow(10, Math.floor(Math.log10(vMax)));
    const yMax = Math.ceil(vMax / nice) * nice;
    const x = (t) => L + (t / tMax) * (W - L - R);
    const y = (v) => T + (1 - v / yMax) * (Ht - T - B);
    const grid = [0, 0.5, 1].map((k) => `<line x1="${L}" x2="${W - R}" y1="${y(yMax * k)}" y2="${y(yMax * k)}" class="hgrid"/>
      <text x="${L - 6}" y="${y(yMax * k) + 4}" text-anchor="end" class="haxis">${fmt(Math.round(yMax * k))}</text>`).join('');
    const mins = Math.max(1, Math.round(tMax / 60));
    const step = mins > 20 ? 10 : mins > 8 ? 5 : mins > 3 ? 2 : 1;
    let xt = '';
    for (let m = 0; m * 60 <= tMax; m += step) xt += `<text x="${x(m * 60)}" y="${Ht - 6}" text-anchor="middle" class="haxis">${m} min</text>`;
    // Nombres al final de cada línea; si se tocan, se separan un poco.
    const ends = game.players.map((p) => ({ id: p.id, v: H[H.length - 1][key][p.id] })).sort((a, b) => b.v - a.v);
    let lastY = -99;
    const labels = ends.map((e) => {
      let ly = y(e.v) + 4;
      if (ly - lastY < 11) ly = lastY + 11;
      lastY = ly;
      return `<text x="${W - R + 6}" y="${ly}" class="hend">${esc(game.players[e.id].name)}</text>`;
    }).join('');
    const lines = game.players.map((p) => {
      const pts = H.map((h) => `${x(h.t).toFixed(1)},${y(h[key][p.id]).toFixed(1)}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${cssColor(p.color)}" stroke-width="${p.id === 0 ? 2.5 : 2}" stroke-dasharray="${HIST_DASH[p.id]}" stroke-linejoin="round" stroke-linecap="round"/>`;
    }).join('');
    return `<figure class="histchart" data-key="${key}"><figcaption>${title}</figcaption>
      <div class="histwrap"><svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${L$`${title} de cada imperio a lo largo de la partida`}">
        ${grid}${xt}${lines}${labels}<line class="hcross" x1="0" x2="0" y1="${T}" y2="${Ht - B}" visibility="hidden"/>
        <rect class="hhit" x="${L}" y="${T}" width="${W - L - R}" height="${Ht - T - B}" fill="transparent"/></svg>
        <div class="histtip" hidden></div></div></figure>`;
  }

  endHtml(game) {
    if (game.camp) return this.missionEndHtml(game);
    const r = this.finish(game);
    const me = game.players[0];
    const s = me.stats;
    const win = game.result === 'victory';
    const pos = this.positions(game);
    const winnerName = game.spectateWinner >= 0 && game.players[game.spectateWinner] ? game.players[game.spectateWinner].name : null;
    const text = game.kingWinner !== undefined
      ? (win ? L$`Tu equipo mantuvo el Faro ${fmtTime(KING_TIME)}.` : T$('Otro imperio mantuvo el Faro el tiempo necesario.'))
      : (win ? T$('Todos los Núcleos rivales cayeron. El archipiélago es tuyo.') : winnerName ? L$`Tu Núcleo fue destruido. Seguiste mirando: ganó ${winnerName}.` : T$('Tu Núcleo fue destruido.'));
    const prizes = r.creator
      ? `<div><b>${L$`Modo creador`}</b><span>${L$`Sin XP ni cristales`}</span></div>`
      : `<div><b>+${fmt(r.xp)} XP</b><span>${r.lines.map(esc).join(' · ')}</span></div>
         <div><b>${L$`+${fmt(r.crystals)} cristales`}</b><span>${r.missions.length ? T$('Incluye misiones') : T$('Por jugar') + (win ? ' y ganar' : '')}</span></div>
         <div><b>${L$`Nivel ${r.level}`}</b><span>${r.levelUp ? T$('¡Subiste de nivel!') : `${fmt(this.P.xp % LEVEL_XP)} / ${fmt(LEVEL_XP)} XP`}</span></div>`;
    // v1.7: como en la UI 0.4: tres fichas arriba (Duración, Territorio, Experiencia) y los botones siempre a la vista.
    const land = Math.max(me.peakLand || 0, game.cells.reduce((n, c) => n + (c.owner === 0 ? 1 : 0), 0));
    return `
      <div class="endhero"><div><span class="lbl endchip">${L$`Partida finalizada`}</span><h2>${win ? T$('¡Victoria!') : T$('Derrota')}</h2><p>${esc(text)}</p></div></div>
      <div class="endstats endmain" id="endmain">
        <div><b>${fmtTime(game.time)}</b><span>${L$`Duración`}</span></div>
        <div><b>${fmt(land)}</b><span>${L$`Territorio máximo (casillas)`}</span></div>
        <div class="xp"><b>${r.creator ? '—' : '+' + fmt(r.xp)}</b><span>${L$`Experiencia`}</span></div>
      </div>
      <div class="endstats endmore">
        <div><b>${s.captures}</b><span>${L$`Islas tomadas`}</span></div>
        <div><b>${s.trained}</b><span>${L$`Tropas entrenadas`}</span></div>
        <div><b>${me.coresKilled}</b><span>${L$`Núcleos destruidos`}</span></div>
      </div>
      <h3 class="lbl">${L$`Posiciones`}</h3>
      <div class="positions">${pos.map((x) => `<div class="${x.p.id === 0 ? 'me' : ''}"><b>${x.rank}.º</b><i style="background:${cssColor(x.p.color)}"></i>
        <span>${esc(x.p.name)}</span><small>${esc(x.note)}</small></div>`).join('')}</div>
      <h3 class="lbl">${L$`Premios${r.creator ? '' : ' <span class="endok">· confirmados</span>'}`}</h3>
      <div class="prizes">${prizes}</div>
      ${r.missions.length ? `<div class="advice">${L$`Misiones completadas: ${r.missions.map(esc).join(', ')}`}</div>` : ''}
      ${r.tutorial ? `<div class="advice">${L$`Premio del Tutorial: ${esc(r.tutorial)}`}</div>` : ''}
      ${win ? '' : `<div class="advice"><b>${L$`Consejo:`}</b> ${esc(this.advice(game))}</div>`}
      ${this.historyHtml(game)}
      <div class="row endrow">
        ${game.canSpectate() ? `<button class="btn" type="button" id="btn-spectate">${L$`Seguir mirando`}</button>` : ''}
        <button class="btn" type="button" id="btn-watch">${L$`Mirar el mapa`}</button>
        <button class="btn" type="button" id="btn-again">${L$`Revancha`}</button>
        <button class="btn gold" type="button" id="btn-menu">${L$`Volver al vestíbulo`}</button>
        ${this.canDouble(game) ? `<button class="btn reward" type="button" id="btn-double">${L$`🎬 Doble premio`}</button>` : ''}
      </div>`;
  }

  // v1.9: «🎬 Doble premio» (anuncio con premio de Poki): solo en Poki, una vez por partida y si hubo premio.
  canDouble(game) {
    const r = game.reward;
    return Platform.hasAds() && !!r && !r.creator && !game.doubled && !game.mode.sandbox && !game.opts.tutorial && (r.xp > 0 || r.crystals > 0);
  }

  doubleReward(game, btn) {
    if (!this.canDouble(game)) return;
    const r = game.reward;
    btn.disabled = true;
    Platform.rewardedBreak(this.app).then((ok) => {
      // Sin video (bloqueador o sin anuncio): sin premio y sin mensaje; Poki avisa por su lado.
      if (!ok || game.doubled) {
        btn.disabled = false;
        return;
      }
      game.doubled = true;
      Profile.addXp(r.xp);
      this.P.crystals += r.crystals;
      Profile.save();
      btn.remove();
      const box = document.querySelector('#enddialog .prizes');
      if (box) box.insertAdjacentHTML('beforeend', `<div class="doubled"><b>×2</b><span>${L$`Premio doble: +${fmt(r.xp)} XP y +${fmt(r.crystals)} cristales más`}</span></div>`);
      this.app.ui.toast(L$`¡Premio doble! +${fmt(r.xp)} XP y +${fmt(r.crystals)} cristales`, 'good');
      this.app.sound.play('done');
      this.render();
    });
  }
}
