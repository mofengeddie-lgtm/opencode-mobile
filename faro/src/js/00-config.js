'use strict';
// Faro de Ámbar: datos del juego (edificios, unidades, terreno, jugadores).
// Todo el balance vive aquí para poder ajustarlo sin tocar la lógica.

const SQ3 = Math.sqrt(3);
// v1.2: color de un terreno según el mapa (Dunas Rojas tiene su propia paleta).
function terrainColor(mapKind, t) {
  const m = typeof MAPS !== 'undefined' && MAPS[mapKind];
  const pal = m && m.tint && typeof PALETTES !== 'undefined' ? PALETTES[m.tint] : null;
  return pal && pal[t] !== undefined ? pal[t] : TERRAIN[t].color;
}
const GAME_NAME = 'Faro de Ámbar';
const GAME_VERSION = '1.8';
const START_COINS = 2000;
const START_ENERGY = 60;
// Tropas iniciales de cada imperio (v0.6: ritmo más rápido).
const START_UNITS = ['builder'];
// Comunidad (población) máxima: 240 desde la v1.0 (180 en la v0.9).
const MAX_POP = 240;
// v1.5: desde esta distancia de cámara, cada tropa muestra un icono de su tipo.
const UNIT_ICON_DIST = 34;
// v1.2: tiempo que hay que mantener pulsado el mapa para abrir la rueda de selección.
const WHEEL_HOLD_MS = 450;
// v1.0: distancia máxima (centro a centro) a la que el constructor trabaja en una obra: pegado a ella.
const BUILD_REACH = 1.2;
// v1.0: «Mejoras automáticas» (Núcleo nivel 3): revisa cada 2 s y guarda una reserva de monedas para tropas.
const AUTO_UP = { every: 2, reserve: 1500, coreLevel: 3 };

// Puntos de captura (PRD 1.5 RF-07 y RF-12).
const CAPTURE = { time: 12, near: 1, clear: 2 };
const POINTS = {
  faro: { name: 'Faro', claim: 3, bonus: 0.5, income: 0, desc: '+50 % de ingresos para quien lo controle.' },
  flag: { name: 'Bandera', claim: 2, bonus: 0, income: 200, desc: '+200 monedas/min y territorio en la isla.' },
};
const KING_TIME = 180;

// Escudos del Núcleo (PRD 1.5 RF-11).
const EMERGENCY = { at: 0.25, time: 20 };
const DOME = { cost: 6000, hp: 3000, range: 3, recover: 60 };
// Misil nuclear (v0.9): lo lanza un AIR DEFENSE de nivel 4. Muy caro, recarga larga y aviso al rival.
// v1.4: ahorro de batería (unos 30 cuadros por segundo y menos partículas).
const BATTERY = { minFrameMs: 31, fx: 0.3 };
// v1.4: tropas veteranas. Estrellas por eliminaciones; cada estrella da +10 % de vida máxima y +8 % de daño.
const VETERAN = { kills: [3, 8, 15], hp: 0.10, dmg: 0.08 };
// v1.4: reparación sola (Constructores e Ingenieros libres) y producción continua.
const AUTO_REPAIR = { range: 4, every: 1.5 };
const LOOP_TRAIN = { every: 0.5 };
const NUKE = { cost: 20000, cooldown: 180, range: 40, radius: 3, dmg: 4000, flight: 9,
  // v1.0: 1 minuto de radiación donde cae; quema por segundo esta parte de la vida máxima de los enemigos.
  // El Núcleo se quema más despacio, para que un solo misil no decida la partida.
  rad: { time: 60, unit: 0.04, bld: 0.005, core: 0.0025 } };
// v1.7: Arsenal estratégico (opción de «Personalizado», apagada si no se elige). Con ella cada jugador tiene un solo
// uso estratégico por partida: el misil del AIR DEFENSE de nivel 4 o el del Lanzador nuclear móvil.
// prep: segundos de preparación al salir de la Fábrica; range: alcance del lanzador móvil en casillas.
const STRATEGIC = { uses: 1, prep: 60, range: 14 };
// v1.8: Centro de investigación (una a la vez; valen para todo tu ejército) y minas navales del Buque minador.
const RESEARCH = {
  armor: { name: 'Blindaje', pct: 0.1, cost: 2500, time: 45, desc: '+10 % de vida a tus vehículos.' },
  aim: { name: 'Puntería', pct: 0.1, cost: 2500, time: 45, desc: '+10 % de daño a tu infantería.' },
  engines: { name: 'Motores', pct: 0.15, cost: 2500, time: 45, desc: '+15 % de velocidad a tus aeronaves.' },
};
const MINES = { limit: 8, every: 4 };
// v1.8: en qué sección de «A tu manera» va cada control de la pausa.
const SETTINGS_LAYOUT = {
  interfaz: ['set-lang', 'ui-scale-wrap', 'btn-bigtext', 'btn-fps'],
  sonido: ['set-music', 'btn-sound2'],
  camara: ['set-quality', 'set-light'],
  accesibilidad: ['btn-cvd', 'btn-calm', 'btn-battery'],
  controles: ['help-list'],
};
// Casa: nivel 1 (+10 de comunidad) y nivel 2 = Apartamento (+20 más). Precio de la mejora.
const HOUSE_LEVELS = [0, 1500];
// Reparación del Ingeniero: vida por segundo y pausa tras recibir daño.
const REPAIR = { rate: 25, pause: 4 };
const HOUSE_LIMIT = 8;

// h = altura de la cara superior de la casilla.
const TERRAIN = {
  deep: { water: true, color: 0x175a85, h: -0.06, name: 'Mar profundo' },
  shallow: { water: true, color: 0x2a88a8, h: -0.03, name: 'Agua poco profunda' },
  oil: { water: true, color: 0x2a88a8, h: -0.03, name: 'Mancha de petróleo' },
  sand: { land: true, color: 0xd6b877, h: 0.26, name: 'Arena' },
  grass: { land: true, color: 0x6fae45, h: 0.42, name: 'Pasto' },
  forest: { land: true, color: 0x548f37, h: 0.42, slow: 1.45, cover: true, name: 'Bosque' },
  gold: { land: true, color: 0x9fb04a, h: 0.42, name: 'Veta de oro' },
  fertile: { land: true, color: 0x93a24b, h: 0.42, name: 'Tierra fértil' },
  oilland: { land: true, color: 0x6f7253, h: 0.42, name: 'Petróleo en tierra' },
  mount: { color: 0x9a958b, h: 0.6, cover: true, name: 'Montaña' },
  // v1.2: meseta alta (ventaja de altura) y duna del desierto.
  high: { land: true, color: 0xa8794e, h: 0.82, name: 'Meseta', highGround: true },
  dune: { land: true, color: 0xd9a066, h: 0.3, name: 'Duna' },
};

const PLAYER_COLORS = [0x2f7fe0, 0xe0484d, 0xf0a030, 0x9b5de5, 0xe85d9f, 0x1fb5a3];
const PLAYER_NAMES = ['Tú', 'Rojo', 'Naranja', 'Violeta', 'Rosa', 'Turquesa'];
// v1.4: colores para daltonismo. Elegidos con una simulación de protanopía, deuteranopía y
// tritanopía para que cualquier par se distinga (diferencia CIEDE2000 de 19 o más), todos claros
// para verse sobre el fondo oscuro; además, una forma distinta por jugador en el minimapa.
const BASE_COLORS = PLAYER_COLORS.slice();
const BASE_NAMES = PLAYER_NAMES.slice();
const CVD_COLORS = [0x3b6cce, 0xb82e2e, 0xfcfc88, 0x9da9e7, 0xef6c82, 0x88fce9];
const CVD_NAMES = ['Tú', 'Rojo', 'Amarillo', 'Lavanda', 'Rosa', 'Aguamarina'];
const PLAYER_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star', 'cross'];
function applyPalette(cvd) {
  const cols = cvd ? CVD_COLORS : BASE_COLORS;
  const names = cvd ? CVD_NAMES : BASE_NAMES;
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    PLAYER_COLORS[i] = cols[i];
    PLAYER_NAMES[i] = names[i];
  }
}

// Multiplicadores de daño por tipo de objetivo:
// inf = infantería, veh = vehículo, ship = barco, sub = submarino, air = aéreo, bld = edificio.
// Lugares (on): 'land' tierra libre · 'landcoast' tierra junto al agua · 'coast' agua junto a la orilla ·
// 'shallowcoast' agua poco profunda junto a la costa · 'deep' mar profundo · lista = solo esos terrenos.
// builtBy: 'land' Constructor/Ingeniero · 'sea' Barco constructor · 'engineer' solo Ingeniero.
const LEVEL_UP_COST = [0, 0.5, 1.0, 1.5]; // mejorar a nivel 2 = 50 % del precio; a nivel 3 = 100 %; a nivel 4 = 150 %
const lvlMult = (lv) => 1 + 0.6 * ((lv || 1) - 1); // v0.9: +60 % de vida, daño e ingresos por nivel
// Comunidad extra por pelear (v0.9): +2 por cada 10 tropas enemigas eliminadas y +15 por Núcleo destruido.
const POP_BONUS = { perKills: 10, killPop: 2, corePop: 15 };
// Escudo propio de cada edificio (v0.9): 20 % de su vida; se recarga si no lo atacan durante 8 s.
const BLD_SHIELD = { pct: 0.2, delay: 8, regen: 0.1 };
// Aeronaves con poca vida vuelven solas a repararse al Helipuerto o al Aeropuerto.
const AIR_RETREAT = 0.3;
const BUILDINGS = {
  core: {
    name: 'Núcleo', cat: null, cost: 0, hp: 6000, build: 20, income: 900, pop: 20, maxLevel: 3,
    claim: 4, vision: 6, size: 1.25, heal: { cls: ['inf', 'veh', 'air', 'ship', 'sub'], pct: 0.02, range: 2 },
    produces: ['builder'],
    levels: [null, { income: 900, pop: 20, hp: 6000, laser: { dmg: 45, range: 4, beams: 1 } },
      { cost: 2500, income: 1200, pop: 25, hp: 8000, laser: { dmg: 70, range: 5, beams: 1 } },
      { cost: 5000, income: 1500, pop: 30, hp: 10000, laser: { dmg: 70, range: 5, beams: 2 } }],
    weapon: { dmg: 45, cd: 1.0, range: 4, proj: 'laser', mult: { inf: 1.3, veh: 1, ship: 1, air: 1, bld: 0, sub: 0 } },
    desc: 'Tu base. Genera monedas, entrena Constructores, dispara un láser y cura a las tropas cercanas. Si cae, pierdes.',
  },
  farm: {
    fem: true, name: 'Granja', cat: 'eco', cost: 300, hp: 350, build: 6, income: 240, on: ['fertile'], limit: 14,
    builtBy: 'land', desc: '+240 monedas/min. Solo en tierra fértil (parcelas marcadas).',
  },
  pump: {
    fem: true, name: 'Bomba de petróleo', cat: 'eco', cost: 1400, hp: 700, build: 10, income: 650, on: ['oilland'], limit: 6,
    builtBy: 'land', desc: '+650 monedas/min. Solo en petróleo en tierra (manchas oscuras).',
  },
  mine: {
    fem: true, name: 'Mina de oro', cat: 'eco', cost: 1000, hp: 650, build: 10, income: 600, on: ['gold'], limit: 8,
    builtBy: 'land', desc: '+600 monedas/min. Solo en vetas de oro.',
  },
  rig: {
    fem: true, name: 'Plataforma petrolera', cat: 'eco', cost: 2000, hp: 900, build: 14, income: 1100, on: ['oil'], limit: 6,
    builtBy: 'sea', sea: true, desc: '+1100 monedas/min. En el petróleo del mar. La construye el Barco constructor.',
  },
  house: {
    fem: true, name: 'Casa', cat: 'eco', cost: 500, hp: 400, build: 6, pop: 10, on: 'land', limit: HOUSE_LIMIT, maxLevel: 2,
    popLevels: [0, 10, 30], levelNames: [null, 'Casa', 'Apartamento'],
    builtBy: 'land', desc: '+10 de comunidad. Se mejora una vez a Apartamento: +20 más (+30 en total).',
  },
  solar: {
    fem: true, name: 'Solar', cat: 'energy', cost: 200, hp: 300, build: 5, energy: 3, on: 'land', limit: 8,
    builtBy: 'land', desc: '+3 de energía cada 10 s. En cualquier tierra.',
  },
  wind: {
    // v1.8: nombre del catálogo del usuario («Molino»); mismos números.
    name: 'Molino eólico', cat: 'energy', cost: 300, hp: 400, build: 6, energy: 5, on: 'land', limit: 8,
    builtBy: 'land', desc: '+5 de energía cada 10 s. En cualquier tierra.',
  },
  hydro: {
    fem: true, name: 'Hidráulica', cat: 'energy', cost: 700, hp: 600, build: 9, energy: 8, on: 'landcoast', limit: 4,
    builtBy: 'land', desc: '+8 de energía cada 10 s. En tierra junto al agua.',
  },
  tidal: {
    fem: true, name: 'Mareomotriz', cat: 'energy', cost: 1000, hp: 700, build: 11, energy: 11, on: 'shallowcoast', limit: 4,
    builtBy: 'sea', sea: true, desc: '+11 de energía cada 10 s. En agua poco profunda junto a la costa. La construye el Barco constructor.',
  },
  wave: {
    fem: true, name: 'Undimotriz', cat: 'energy', cost: 1500, hp: 800, build: 13, energy: 15, on: 'deep', limit: 3,
    builtBy: 'sea', sea: true, desc: '+15 de energía cada 10 s. En mar profundo. La construye el Barco constructor.',
  },
  barracks: {
    name: 'Cuartel', cat: 'prod', cost: 1000, hp: 900, build: 10, on: 'land', limit: 3, builtBy: 'land',
    produces: ['builder', 'engineer', 'rifle', 'shotgun', 'ranger', 'sniper', 'breaker', 'hunter', 'rocket', 'medic',
      'scout', 'soldier', 'officer', 'radioman', 'sapper', 'mortar', 'paratrooper', 'marine', 'atguided', 'gunner', 'antidrone'],
    desc: 'Entrena los 21 soldados: del Constructor al Paracaidista.',
  },
  factory: {
    fem: true, name: 'Fábrica', cat: 'prod', cost: 3000, energyCost: 50, hp: 1500, build: 16, on: 'land', limit: 2, builtBy: 'land',
    produces: ['jeep', 'armoredcar', 'apc', 'ifv', 'trooptruck', 'lighttank', 'tank', 'heavytank', 'tankdestroyer', 'aa', 'arty',
      'mlrs', 'thermo', 'howitzer', 'towedgun', 'missiletruck', 'launcher', 'ambulance', 'recovery', 'supplytruck', 'tanker',
      'commandveh', 'mobileradar', 'amphib', 'bridgelayer', 'clearer', 'dozer', 'robodog', 'nukelauncher'],
    desc: 'Fabrica tanques, artillería, transportes y vehículos de apoyo.',
  },
  harbor: {
    name: 'Puerto', cat: 'prod', cost: 2200, hp: 1300, build: 14, on: 'coast', limit: 2, builtBy: 'land',
    produces: ['speedboat', 'missileboat', 'boatEng', 'barge', 'lander', 'patrolboat', 'gunboat', 'corvette', 'frigate', 'destroyer',
      'battleship', 'sub', 'carrier', 'logship', 'hovercraft', 'minesweeper', 'minelayer', 'navaldrone', 'subdrone'],
    heal: { cls: ['ship', 'sub'], rate: 25, range: 2 },
    desc: 'En agua junto a la orilla. Construye los barcos y repara los cercanos.',
  },
  helipad: {
    name: 'Helipuerto', cat: 'prod', cost: 4000, energyCost: 80, hp: 1000, build: 18, on: 'land', limit: 6, builtBy: 'land',
    produces: ['scoutdrone', 'fpv', 'drone', 'heli', 'apache', 'transheli', 'rescueheli', 'navalheli'], heal: { cls: ['air'], rate: 40, range: 2 },
    desc: 'Produce helicópteros y drones, y repara a las aeronaves cercanas. Hasta 6.',
  },
  turret: {
    fem: true, name: 'Torreta', cat: 'def', cost: 1500, hp: 1100, build: 10, on: 'land', limit: 20, vision: 5, builtBy: 'land', maxLevel: 4,
    weapon: { dmg: 40, cd: 0.9, range: 4, proj: 'bullet', mult: { inf: 1.5, veh: 1, ship: 1, air: 0.8, bld: 0.6, sub: 0 } },
    minigun: { dmg: 10, cd: 0.15, range: 3, mult: { inf: 1.2, veh: 0.8, ship: 0.5, air: 0.7, bld: 0, sub: 0 } },
    // Nivel 4: 3 miniguns con más daño y tiro antiaéreo (ayuda al AIR DEFENSE).
    aaLevel: 4, aaMult: { air: 1.8 }, aaMiniMult: { air: 1.6 },
    desc: 'Cañón contra tropas, barcos y helicópteros. Nivel 2: 1 minigun · nivel 3: 2 · nivel 4: 3 miniguns, más daño y antiaéreo. Hasta 20.',
  },
  miniturret: {
    fem: true, name: 'Torreta chica', cat: 'def', cost: 400, hp: 500, build: 5, on: 'land', limit: 4, vision: 4, builtBy: 'engineer',
    weapon: { dmg: 20, cd: 0.6, range: 3, proj: 'bullet', mult: { inf: 1.3, veh: 0.7, ship: 0.6, air: 0.5, bld: 0, sub: 0 } },
    desc: 'Torreta pequeña y barata. Solo la puede construir un Ingeniero.',
  },
  aadef: {
    name: 'AIR DEFENSE', cat: 'def', cost: 2000, hp: 1000, build: 12, on: 'land', limit: 6, vision: 6, builtBy: 'land', maxLevel: 4,
    // v0.9: el radar fija el blanco (0,5 s), prioriza aeronaves y lanza ráfagas de 2 misiles.
    weapon: { dmg: 90, cd: 2.4, range: 6, proj: 'missile', mult: { air: 2.2 }, salvo: 2, lock: 0.5 },
    prefersAir: true,
    // Nivel 4 (solo 3 por imperio): lanza el misil nuclear (ver NUKE).
    l4Limit: 3,
    desc: 'Misiles de largo alcance contra aeronaves. Nivel 4 (solo 3 de tus 6): lanza el misil nuclear.',
  },
  wall: {
    name: 'Muro', cat: 'def', cost: 30, hp: 1500, build: 3, on: 'land', limit: 40, builtBy: 'land',
    desc: 'Muralla que bloquea a las tropas enemigas y se une con los muros vecinos. Las tuyas pasan.',
  },
  hospital: {
    // v1.8: nombre del catálogo del usuario; mismos números.
    name: 'Hospital de campaña', cat: 'def', cost: 2000, hp: 700, build: 12, on: 'land', limit: 2, builtBy: 'land',
    heal: { cls: ['inf', 'veh'], pct: 0.03, range: 2 },
    healLevels: [null, { pct: 0.03, range: 2, name: 'Clínica' }, { pct: 0.05, range: 2, name: 'Mini hospital' }, { pct: 0.08, range: 3, name: 'Hospital grande' }],
    desc: 'Cura infantería y vehículos cercanos. Nivel 1 clínica (3 %/s), nivel 2 mini hospital (5 %/s), nivel 3 hospital grande (8 %/s).',
  },
  // v0.9: Aeropuerto militar (caza y bombardero furtivos) y Escudo antimisiles (derriba el misil nuclear).
  airport: {
    name: 'Aeropuerto militar', cat: 'prod', cost: 6000, energyCost: 100, hp: 1800, build: 22, on: 'land', limit: 2, builtBy: 'land',
    produces: ['fighter', 'bomber', 'attackjet', 'heavybomber', 'gunship', 'transportplane', 'awacs', 'tankerplane', 'ewplane'],
    heal: { cls: ['air'], rate: 40, range: 2 },
    desc: 'Pista y hangares: fabrica los aviones y repara a los cercanos.',
  },
  antinuke: {
    name: 'Escudo antimisiles', cat: 'def', cost: 9000, energyCost: 120, hp: 1400, build: 20, on: 'land', limit: 2, builtBy: 'land',
    maxLevel: 1, intercept: { range: 7, recharge: 120 },
    // v1.1: defensa de punto: también derriba misiles y cohetes enemigos que pasen cerca.
    pointDefense: { range: 3, cd: 1.5 },
    desc: 'Derriba el misil nuclear enemigo si cae a 7 casillas o menos (una carga cada 2 minutos), y misiles y cohetes enemigos a 3 casillas (uno cada 1,5 s).',
  },
  outpost: {
    name: 'Puesto avanzado', cat: null, cost: 800, hp: 800, build: 8, claim: 2, vision: 4, limit: 6, maxLevel: 1,
    desc: 'Amplía tu territorio. Lo fundan los ingenieros y los barcos constructores.',
  },  // ---------- v1.8: edificios del catálogo del usuario (PRD 1.8, secciones 51-54) y de su lista de equipamiento ----------
  // Números de juego propuestos para probar. aura: efectos sobre tropas cercanas (ver Game.updateAuras).
  corral: {
    name: 'Corral de ganadería', cat: 'eco', cost: 600, hp: 500, build: 7, income: 280, on: 'land', limit: 8, builtBy: 'land',
    desc: '+280 monedas/min. En cualquier tierra.',
  },
  powerplant: {
    fem: true, name: 'Central de energía', cat: 'energy', cost: 3000, hp: 1200, build: 14, energy: 25, on: 'land', limit: 2, builtBy: 'land',
    desc: '+25 de energía cada 10 s: la energía más fuerte.',
  },
  dronecenter: {
    name: 'Centro de drones', cat: 'prod', cost: 2200, energyCost: 20, hp: 1100, build: 12, on: 'land', limit: 2, builtBy: 'land',
    produces: ['drone', 'fpv', 'cargodrone', 'interceptor'], heal: { cls: ['air'], rate: 30, range: 2, droneOnly: true },
    desc: 'Produce drones y repara a los drones cercanos.',
  },
  shipyard: {
    name: 'Astillero mayor', cat: 'prod', cost: 4000, energyCost: 30, hp: 2200, build: 18, on: 'coast', limit: 1, builtBy: 'land',
    produces: ['frigate', 'cruiser', 'carrier', 'landingship', 'hospitalship', 'reconsub', 'stratsub'], heal: { cls: ['ship', 'sub'], rate: 25, range: 2 },
    desc: 'En agua junto a la orilla. Construye los buques grandes y los repara.',
  },
  workshop: {
    name: 'Taller de mantenimiento', cat: 'sup', cost: 1800, hp: 1200, build: 10, on: 'land', limit: 3, builtBy: 'land',
    heal: { cls: ['veh'], rate: 30, range: 2 },
    desc: 'Repara los vehículos cercanos (30 de vida por segundo).',
  },
  research: {
    name: 'Centro de investigación', cat: 'sup', cost: 3000, energyCost: 20, hp: 1400, build: 14, on: 'land', limit: 1, builtBy: 'land',
    maxLevel: 1,
    desc: 'Investiga mejoras para todo tu ejército: Blindaje, Puntería y Motores.',
  },
  radarstation: {
    fem: true, name: 'Estación de radar', cat: 'sup', cost: 2000, energyCost: 30, hp: 900, build: 10, on: 'land', limit: 2, builtBy: 'land',
    vision: 12, detect: 8,
    desc: 'Ve 12 casillas y descubre aviones furtivos, submarinos y minas a 8.',
  },
  depot: {
    name: 'Depósito logístico', cat: 'sup', cost: 2500, hp: 1300, build: 12, on: 'land', limit: 2, builtBy: 'land', energy: 5,
    aura: [{ kind: 'supply', pct: 0.2, range: 3 }],
    desc: 'Suministros: tus tropas a 3 casillas recargan un 20 % más rápido. +5 de energía cada 10 s.',
  },
  hq: {
    name: 'Centro de mando avanzado', cat: 'sup', cost: 3500, energyCost: 20, hp: 2400, build: 16, on: 'land', limit: 1, builtBy: 'land',
    claim: 3, vision: 6, maxLevel: 1, aura: [{ kind: 'dmg', pct: 0.1, range: 3 }],
    desc: 'Gana territorio (3 casillas) y da +10 % de daño a tus tropas a 3 casillas.',
  },
  bunker: {
    name: 'Búnker de guarnición', cat: 'def', cost: 1600, hp: 2000, build: 10, on: 'land', limit: 6, vision: 5, builtBy: 'land', maxLevel: 1,
    garrison: 4, garrisonDmg: 0.25,
    weapon: { dmg: 30, cd: 0.6, range: 4, proj: 'bullet', mult: { inf: 1.3, veh: 0.8, ship: 0.7, air: 0.6, bld: 0.5, sub: 0 } },
    desc: 'Dispara solo. Caben 4 soldados: cada uno suma un 25 % de daño. Si cae, salen.',
  },
  gate: {
    fem: true, name: 'Puerta reforzada', cat: 'def', cost: 400, hp: 2500, build: 5, on: 'land', limit: 10, builtBy: 'land', maxLevel: 1,
    desc: 'Muro con puerta: abierta deja pasar a tus tropas y aliados; cerrada no pasa nadie.',
  },
  coastal: {
    fem: true, name: 'Batería de defensa costera', cat: 'def', cost: 3000, energyCost: 20, hp: 1800, build: 14, on: 'landcoast', limit: 4, vision: 7,
    builtBy: 'land',
    weapon: { dmg: 220, cd: 3, range: 7, proj: 'shell', mult: { inf: 0.5, veh: 0.8, ship: 1.8, air: 0, bld: 0.8, sub: 1 } },
    desc: 'Cañón de 7 casillas contra barcos (×1,8). En tierra junto al agua.',
  },
  ciws: {
    fem: true, name: 'Defensa de punto', cat: 'def', cost: 1800, energyCost: 20, hp: 900, build: 10, on: 'land', limit: 6, vision: 4, builtBy: 'land',
    maxLevel: 1, pointDefense: { range: 3, cd: 1 }, prefersAir: true,
    weapon: { dmg: 16, cd: 0.12, range: 3, proj: 'bullet', droneMult: 2, mult: { inf: 0.3, veh: 0.2, ship: 0.2, air: 1.2, bld: 0, sub: 0 } },
    desc: 'Derriba misiles y cohetes a 3 casillas (uno por segundo) y dispara a drones y aeronaves.',
  },
  laser: {
    fem: true, name: 'Torre láser', cat: 'def', cost: 2500, energyCost: 40, hp: 900, build: 12, on: 'land', limit: 4, vision: 6, builtBy: 'land',
    maxLevel: 1, prefersAir: true,
    weapon: { dmg: 60, cd: 0.8, range: 5, proj: 'laser', droneMult: 2, mult: { inf: 0.2, veh: 0.1, ship: 0.1, air: 1.4, bld: 0, sub: 0 } },
    desc: 'Rayo contra aeronaves a 5 casillas; el doble contra drones.',
  },
  watchtower: {
    fem: true, name: 'Torre de observación', cat: 'def', cost: 600, hp: 600, build: 6, on: 'land', limit: 6, builtBy: 'land', maxLevel: 1,
    vision: 9, detect: 4,
    desc: 'Ve 9 casillas y descubre lo oculto a 4.',
  },
  silo: {
    name: 'Complejo estratégico', cat: 'def', cost: 15000, energyCost: 100, hp: 3000, build: 30, on: 'land', limit: 1, builtBy: 'land', maxLevel: 1,
    strategic: true,
    desc: 'Solo con «Arsenal estratégico»: lanza el DF-5C (misil nuclear). Comparte tu único uso estratégico.',
  },
  bridge: {
    name: 'Puente modular', cat: 'sup', cost: 800, hp: 1000, build: 8, on: 'shallowcoast', limit: 10, builtBy: 'land', maxLevel: 1,
    anyTerritory: true, walkable: true,
    desc: 'En agua poco profunda junto a tierra: las tropas de tierra cruzan por encima. Los barcos ya no pasan.',
  },
  dock: {
    name: 'Muelle logístico', cat: 'sup', cost: 1500, hp: 1000, build: 8, on: 'coast', limit: 3, builtBy: 'land',
    heal: { cls: ['ship', 'sub'], rate: 20, range: 2 },
    desc: 'En agua junto a la orilla: repara los barcos cercanos (20 por segundo).',
  },
  // Mina naval (la siembra el Buque minador; no se construye desde el menú).
  seamine: {
    fem: true, name: 'Mina naval', cat: null, cost: 0, hp: 200, build: 0, maxLevel: 1, stealth: true, walkable: true, sea: true,
    mine: { dmg: 500, range: 1 },
    desc: 'Oculta bajo el agua: explota con el primer barco enemigo que pasa cerca.',
  },
};

const BUILD_TABS = [
  { id: 'eco', name: 'Economía', items: ['farm', 'pump', 'mine', 'rig', 'house', 'corral'] },
  { id: 'energy', name: 'Energía', items: ['solar', 'wind', 'hydro', 'tidal', 'wave', 'powerplant'] },
  { id: 'prod', name: 'Producción', items: ['barracks', 'factory', 'harbor', 'helipad', 'airport', 'dronecenter', 'shipyard'] },
  { id: 'def', name: 'Defensa', items: ['turret', 'aadef', 'antinuke', 'wall', 'gate', 'bunker', 'coastal', 'ciws', 'laser', 'watchtower', 'hospital', 'miniturret', 'silo'] },
  // v1.8: pestaña nueva con los edificios de apoyo del catálogo del usuario.
  { id: 'sup', name: 'Apoyo', items: ['workshop', 'research', 'radarstation', 'depot', 'hq', 'bridge', 'dock'] },
];

// Cúpula: se compra con el Núcleo en nivel 3; nivel 3 da escudo personal a tus tropas.
const DOME_LEVELS = [null,
  { cost: 6000, hp: 3000, range: 3 },
  { cost: 4000, hp: 4500, range: 4 },
  { cost: 6000, hp: 6000, range: 4, unitShield: 0.25 }];
const UNIT_SHIELD = { regenDelay: 5, regen: 0.1 };

const UNITS = {
  builder: {
    name: 'Constructor', cls: 'inf', mover: 'land', cost: 200, hp: 100, speed: 1.6, pop: 1, build: 4, vision: 3,
    builds: 'land', buildRate: 1, repairs: true,
    desc: 'Construye y repara edificios. Casi no pelea.',
  },
  engineer: {
    name: 'Ingeniero', cls: 'inf', mover: 'land', cost: 500, hp: 140, speed: 1.6, pop: 1, build: 6, vision: 3,
    builds: 'land', buildRate: 2, repairs: true, founds: 'land',
    desc: 'Construye el doble de rápido, repara, funda puestos avanzados y pone la Torreta chica.',
  },
  rifle: {
    name: 'Artillero', cls: 'inf', mover: 'land', cost: 400, hp: 260, speed: 1.5, pop: 1, build: 5,
    weapon: { dmg: 16, cd: 0.7, range: 3, proj: 'bullet', mult: { inf: 1, veh: 0.6, ship: 0.5, air: 0.35, bld: 0.5, sub: 0 } },
    desc: 'Ametralladora. Barato, bueno en grupo y para tomar islas.',
  },
  shotgun: {
    name: 'Escopetero', cls: 'inf', mover: 'land', cost: 600, hp: 320, speed: 1.5, pop: 1, build: 6,
    weapon: { dmg: 48, cd: 1.1, range: 2, proj: 'bullet', mult: { inf: 1.3, veh: 0.6, ship: 0.5, air: 0.3, bld: 0.5, sub: 0 } },
    desc: 'Mucho daño de cerca, poco alcance.',
  },
  ranger: {
    name: 'Ranger', cls: 'inf', mover: 'land', cost: 700, hp: 360, speed: 1.6, pop: 1, build: 7,
    weapon: { dmg: 24, cd: 0.6, range: 3, proj: 'bullet', mult: { inf: 1.15, veh: 0.7, ship: 0.6, air: 0.4, bld: 0.5, sub: 0 } },
    desc: 'Artillero de élite: casco, chaleco y rifle.',
  },
  sniper: {
    name: 'Francotirador', cls: 'inf', mover: 'land', cost: 900, hp: 170, speed: 1.3, pop: 1, build: 7,
    weapon: { dmg: 75, cd: 2.2, range: 5, proj: 'bullet', mult: { inf: 1.6, veh: 0.4, ship: 0.4, air: 0, bld: 0.3, sub: 0 } },
    desc: 'Rifle de largo alcance. Muy fuerte contra infantería, poca vida.',
  },
  breaker: {
    name: 'Rompedor', cls: 'inf', mover: 'land', cost: 950, hp: 380, speed: 1.5, pop: 1, build: 7,
    weapon: { dmg: 15, cd: 0.25, range: 2, proj: 'bullet', mult: { inf: 1.4, veh: 0.5, ship: 0.4, air: 0.3, bld: 0.4, sub: 0 } },
    desc: 'Escopeta automática. Dispara muy rápido de cerca.',
  },
  hunter: {
    name: 'Cazador', cls: 'inf', mover: 'land', cost: 1300, hp: 200, speed: 1.2, pop: 1, build: 9,
    weapon: { dmg: 130, cd: 2.6, range: 6, proj: 'bullet', mult: { inf: 1.4, veh: 0.9, ship: 0.6, air: 0, bld: 0.4, sub: 0 } },
    desc: 'Rifle pesado: dispara más lejos y pega más fuerte que el Francotirador.',
  },
  rocket: {
    name: 'Cohetero', cls: 'inf', mover: 'land', cost: 1500, hp: 230, speed: 1.3, pop: 1, build: 8,
    weapon: { dmg: 95, cd: 2.6, range: 4, proj: 'rocket', mult: { inf: 0.6, veh: 1.8, ship: 1.4, air: 0, bld: 1.6, sub: 0 } },
    desc: 'Cohetes que rompen tanques, barcos y edificios.',
  },
  jeep: {
    name: 'Jeep', cls: 'veh', mover: 'land', cost: 1600, energy: 10, hp: 750, speed: 2.6, pop: 2, build: 9, capacity: 4, carries: 'inf',
    weapon: { dmg: 20, cd: 0.4, range: 3, proj: 'bullet', mult: { inf: 1.3, veh: 0.6, ship: 0.5, air: 0.5, bld: 0.5, sub: 0 } },
    desc: 'Rápido. Ideal para cazar infantería.',
  },
  tank: {
    name: 'Tanque', cls: 'veh', mover: 'land', cost: 3400, energy: 30, hp: 2200, speed: 1.2, pop: 3, build: 14,
    weapon: { dmg: 140, cd: 2.2, range: 4, proj: 'shell', mult: { inf: 0.9, veh: 1.3, ship: 1, air: 0, bld: 1.5, sub: 0 } },
    desc: 'Blindado y potente contra soldados y edificios. No dispara al aire.',
  },
  aa: {
    name: 'Camión antiaéreo', cls: 'veh', mover: 'land', cost: 2400, energy: 20, hp: 900, speed: 1.8, pop: 2, build: 10,
    weapon: { dmg: 70, cd: 0.9, range: 5, proj: 'flak', mult: { inf: 0, veh: 0, ship: 0, air: 2.4, bld: 0, sub: 0 } },
    desc: 'Protege a tus tropas desde el cielo: solo dispara a unidades aéreas.',
  },
  arty: {
    name: 'Lanzamisiles', cls: 'veh', mover: 'land', cost: 3800, energy: 40, hp: 700, speed: 1.0, pop: 2, build: 14,
    weapon: { dmg: 380, cd: 6, range: 7, proj: 'missile', mult: { bld: 1 } },
    desc: 'Artillería de muy largo alcance. Solo ataca edificios.',
  },
  lighttank: {
    name: 'Tanque ligero', cls: 'veh', mover: 'land', cost: 2200, energy: 15, hp: 1300, speed: 2.0, pop: 2, build: 10,
    weapon: { dmg: 70, cd: 1.1, range: 3, proj: 'shell', mult: { inf: 1.1, veh: 1.1, ship: 0.8, air: 0, bld: 0.9, sub: 0 } },
    desc: 'Rápido y barato: bueno para flanquear y apoyar a la infantería.',
  },
  heavytank: {
    name: 'Tanque pesado', cls: 'veh', mover: 'land', cost: 5200, energy: 45, hp: 3600, speed: 0.9, pop: 4, build: 20,
    weapon: { dmg: 210, cd: 2.2, range: 3, proj: 'shell', mult: { inf: 0.9, veh: 1.5, ship: 1, air: 0, bld: 1.4, sub: 0 } },
    desc: 'Lento y muy blindado: rompe tanques y defensas.',
  },
  missiletruck: {
    name: 'Camión de misiles', cls: 'veh', mover: 'land', cost: 4200, energy: 40, hp: 800, speed: 1.4, pop: 2, build: 16,
    weapon: { dmg: 420, cd: 8, range: 6, proj: 'missile', mult: { bld: 1.8 } },
    desc: 'Lanza misiles de largo alcance solo contra edificios. Necesita escolta.',
  },
  apc: {
    name: 'Transporte blindado de personal', cls: 'veh', mover: 'land', cost: 2000, energy: 15, hp: 1600, speed: 2.0, pop: 2, build: 10, capacity: 6, carries: 'inf',
    weapon: { dmg: 14, cd: 0.3, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.4, ship: 0.3, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Lleva 6 soldados protegidos y tiene una ametralladora.',
  },
  launcher: {
    // v1.7: el «Lanzador de misiles» pasa a llamarse Lanzador DF-17 y estrena modelo (mismos números).
    name: 'Lanzador DF-17', cls: 'veh', mover: 'land', cost: 7000, energy: 70, hp: 1200, speed: 0.8, pop: 4, build: 24,
    weapon: { dmg: 900, cd: 14, range: 9, proj: 'missile', mult: { inf: 0.3, veh: 0.6, ship: 0.6, air: 0, bld: 1.6, sub: 0 } },
    desc: 'Camión con un misil a la vista, de muy largo alcance contra bases. Lento y caro.',
  },
  // v1.7: solo existe con «Arsenal estratégico». Un contenedor, un misil nuclear, un uso por partida (ver STRATEGIC).
  nukelauncher: {
    name: 'Lanzador nuclear móvil', cls: 'veh', mover: 'land', cost: 22000, energy: 80, hp: 1400, speed: 0.8, pop: 4, build: 40,
    limit: 1, strategic: true,
    desc: 'Camión largo con un solo misil nuclear: un uso por partida. No pelea; necesita escolta.',
  },
  medic: {
    name: 'Médico de campaña', cls: 'inf', mover: 'land', cost: 900, hp: 220, speed: 1.6, pop: 1, build: 8, vision: 3,
    healAura: { cls: ['inf'], pct: 0.05, range: 1 },
    desc: 'Cura a los soldados cercanos (5 % de su vida por segundo). No pelea.',
  },
  speedboat: {
    name: 'Lancha rápida', cls: 'ship', mover: 'sea', cost: 1400, hp: 650, speed: 2.8, pop: 1, build: 8,
    weapon: { dmg: 22, cd: 0.45, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.6, ship: 0.8, air: 0.4, bld: 0.5, sub: 0 } },
    desc: 'La más rápida. Explora y ataca la costa.',
  },
  boatEng: {
    name: 'Barco constructor', cls: 'ship', mover: 'sea', cost: 1600, hp: 500, speed: 2.2, pop: 1, build: 8,
    builds: 'sea', buildRate: 1, repairs: true, founds: 'sea',
    desc: 'Construye Plataformas, Mareomotrices y Undimotrices, y funda puestos en otras islas.',
  },
  barge: {
    name: 'Barcaza', cls: 'ship', mover: 'sea', cost: 1800, hp: 900, speed: 1.8, pop: 1, build: 10, capacity: 6,
    desc: 'Lleva 6 tropas de tierra a otras islas (un vehículo ocupa 2).',
  },
  lander: {
    name: 'Lancha de desembarco', cls: 'ship', mover: 'sea', cost: 2600, hp: 1600, speed: 2.2, pop: 1, build: 12, capacity: 10,
    desc: 'Más rápida y resistente que la Barcaza: lleva 10 lugares (un vehículo ocupa 2) y desembarca en la playa.',
  },
  frigate: {
    // v1.8: «Fragata de escolta» del catálogo del usuario; mismos números y defensa de punto (derriba misiles y cohetes cerca).
    name: 'Fragata de escolta', cls: 'ship', mover: 'sea', cost: 3600, energy: 30, detects: true, hp: 2200, speed: 1.7, pop: 3, build: 14,
    pointDefense: { range: 2, cd: 2 },
    weapon: { dmg: 95, cd: 1.3, range: 6, proj: 'missile', mult: { inf: 0.3, veh: 0.3, ship: 0.6, air: 2.1, bld: 0.3, sub: 0.4 } },
    desc: 'Barco con misiles antiaéreos de largo alcance. Protege a la flota de aviones y helicópteros.',
  },
  carrier: {
    name: 'Portaaviones', cls: 'ship', mover: 'sea', cost: 15000, energy: 120, detects: true, hp: 9000, speed: 1.0, pop: 8, build: 40,
    hangar: 4, heal: { cls: ['air'], rate: 40, range: 2 },
    weapon: { dmg: 14, cd: 0.12, range: 3, proj: 'bullet', mult: { inf: 0.6, veh: 0.5, ship: 0.5, air: 1.6, bld: 0.3, sub: 0 } },
    desc: 'El buque más grande: lleva hasta 4 Cazas en su hangar, repara aviones cercanos y tiene defensas de corto alcance.',
  },
  destroyer: {
    name: 'Destructor', cls: 'ship', mover: 'sea', cost: 4500, energy: 30, detects: true, hp: 2800, speed: 1.3, pop: 4, build: 16,
    weapon: { dmg: 120, cd: 1.7, range: 5, proj: 'shell', mult: { inf: 1, veh: 1, ship: 1.2, air: 0.3, bld: 1.3, sub: 1.4 } },
    desc: 'Mucha vida. Dispara lejos a barcos, submarinos y la costa.',
  },
  sub: {
    name: 'Submarino', cls: 'sub', mover: 'sea', cost: 3800, energy: 30, stealth: true, hp: 1400, speed: 1.6, pop: 3, build: 14,
    weapon: { dmg: 240, cd: 3, range: 3, proj: 'torpedo', waterOnly: true, mult: { ship: 1.5, sub: 1, bld: 1.5 } },
    desc: 'Va escondido bajo el agua y rompe barcos. Solo lo ven Destructores, Helicópteros y Puertos cercanos.',
  },
  // v0.9: el Helicóptero tiene lo que tenía el Apache (y su precio); el Apache sube de nivel.
  heli: {
    name: 'Helicóptero', cls: 'air', mover: 'air', cost: 7500, energy: 60, detects: true, hp: 2400, speed: 2.3, pop: 4, build: 20,
    losBlock: true, doorGun: true,
    weapon: { dmg: 75, cd: 0.7, range: 4, proj: 'rocket', mult: { inf: 1.2, veh: 1.4, ship: 1.2, air: 1.1, bld: 1.1, sub: 0.8 } },
    gun: { dmg: 12, cd: 0.12, range: 3, mult: { inf: 1.3, veh: 0.6, ship: 0.5, air: 0.8, bld: 0.3, sub: 0 } },
    desc: 'Cohetes, cañón y minigun de puerta. Vuela sobre todo; montañas y bosques le reducen el alcance a 2.',
  },
  apache: {
    name: 'Apache Guardián', cls: 'air', mover: 'air', cost: 10000, energy: 80, detects: true, hp: 3200, speed: 2.1, pop: 5, build: 26,
    losBlock: true, flares: 20,
    weapon: { dmg: 100, cd: 0.6, range: 4, proj: 'rocket', mult: { inf: 1.2, veh: 1.5, ship: 1.3, air: 1.2, bld: 1.2, sub: 0.9 } },
    gun: { dmg: 16, cd: 0.1, range: 3, mult: { inf: 1.4, veh: 0.7, ship: 0.6, air: 0.9, bld: 0.4, sub: 0 } },
    // Misiles guiados contra tanques y edificios, de largo alcance.
    missile: { dmg: 320, cd: 6, range: 6, proj: 'missile', mult: { inf: 0.4, veh: 1.6, ship: 1.4, air: 0, bld: 1.3, sub: 0.6 } },
    desc: 'Cañón de 30 mm, cohetes y misiles guiados de largo alcance contra tanques. Bengalas: esquiva un misil antiaéreo cada 20 s.',
  },
  fighter: {
    name: 'Avión de combate furtivo', cls: 'air', mover: 'air', cost: 6000, energy: 60, hp: 1400, speed: 3.6, pop: 3, build: 18, plane: true,
    weapon: { dmg: 140, cd: 1.2, range: 5, proj: 'missile', mult: { inf: 0.1, veh: 0.2, ship: 0.2, air: 2.3, bld: 0.3, sub: 0 } },
    desc: 'Caza de quinta generación: muy rápido, misiles aire-aire. Limpia el cielo de aviones y helicópteros.',
  },
  bomber: {
    name: 'Bombardero furtivo', cls: 'air', mover: 'air', cost: 9000, energy: 90, hp: 2600, speed: 2.0, pop: 5, build: 28, plane: true,
    stealth: true, prefersBld: true,
    weapon: { dmg: 650, cd: 6, range: 1, proj: 'bomb', mult: { inf: 0.5, veh: 0.8, ship: 1, air: 0, bld: 2, sub: 0 } },
    desc: 'Ala volante invisible al radar: las defensas solo lo ven de muy cerca. Suelta bombas pesadas sobre edificios.',
  },
  // ---------- v1.7: primer lote del equipo que pidió el usuario (números de juego, a probar) ----------
  // splash: daño en área: a los enemigos a «r» casillas del impacto les llega la parte «pct» del daño.
  // salvo: cohetes por descarga (salen de a uno). kamikaze: se destruye al atacar.
  drone: {
    name: 'Dron de ataque', cls: 'air', mover: 'air', cost: 2600, energy: 25, hp: 520, speed: 2.6, pop: 1, build: 10, vision: 6, drone: true,
    weapon: { dmg: 110, cd: 3.2, range: 5, proj: 'missile', mult: { inf: 0.8, veh: 1.3, ship: 1, air: 0, bld: 0.8, sub: 0 } },
    desc: 'Avión sin piloto: barato, ve lejos y dispara un misil guiado. Poca vida: cuídalo de los antiaéreos.',
  },
  fpv: {
    name: 'Dron kamikaze', cls: 'air', mover: 'air', cost: 900, energy: 5, hp: 90, speed: 3.4, pop: 1, build: 5, kamikaze: true, drone: true,
    weapon: { dmg: 380, cd: 1, range: 1, proj: 'ram', splash: { r: 0.6, pct: 0.5 }, mult: { inf: 1, veh: 1.5, ship: 1, air: 0, bld: 0.8, sub: 0 } },
    desc: 'Se estrella contra su blanco y explota: sirve una sola vez. Muy frágil; fuerte contra vehículos.',
  },
  mlrs: {
    name: 'Lanzacohetes múltiple', cls: 'veh', mover: 'land', cost: 4800, energy: 45, hp: 800, speed: 1.3, pop: 3, build: 18,
    weapon: { dmg: 80, cd: 9, range: 7, proj: 'rocket', salvo: 6, splash: { r: 0.9, pct: 0.5 }, mult: { inf: 1.2, veh: 0.9, ship: 0.7, air: 0, bld: 0.9, sub: 0 } },
    desc: 'Suelta una salva de 6 cohetes que daña todo alrededor del blanco. Tarda en recargar y tiene poca vida.',
  },
  missileboat: {
    name: 'Lancha misilera', cls: 'ship', mover: 'sea', cost: 2600, energy: 20, hp: 800, speed: 2.4, pop: 2, build: 11,
    weapon: { dmg: 260, cd: 5, range: 5, proj: 'missile', mult: { inf: 0.2, veh: 0.5, ship: 1.6, air: 0, bld: 0.9, sub: 0 } },
    desc: 'Rápida y frágil: misiles antibuque de largo alcance. Ataca por sorpresa a los barcos grandes.',
  },  // ---------- v1.8: tropas del catálogo del usuario (PRD 1.8, secciones 37-50) y de su lista de equipamiento ----------
  // Números de juego propuestos para probar. Campos nuevos: aura (ver Game.updateAuras), detect (casillas a las que
  // descubre lo oculto), mover 'amphib' (tierra y agua poco profunda), airlift (baja tropas en cualquier tierra),
  // para (cae en paracaídas), layBridge, layMine, demine, droneMult (más daño a drones), defMult (más daño a defensas),
  // wallMult (más daño a muros), onlyType (solo ataca ese edificio).
  scout: {
    name: 'Explorador', cls: 'inf', mover: 'land', cost: 250, hp: 140, speed: 2.0, pop: 1, build: 4, vision: 6, captureMult: 1.5,
    weapon: { dmg: 8, cd: 0.8, range: 3, proj: 'bullet', mult: { inf: 1.1, veh: 0.4, ship: 0.3, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Ve 6 casillas y captura Banderas y el Faro un 50 % más rápido. Pelea poco.',
  },
  soldier: {
    name: 'Soldado', cls: 'inf', mover: 'land', cost: 300, hp: 220, speed: 1.5, pop: 1, build: 4,
    weapon: { dmg: 13, cd: 0.7, range: 3, proj: 'bullet', mult: { inf: 1.1, veh: 0.5, ship: 0.4, air: 0.3, bld: 0.5, sub: 0 } },
    desc: 'Combatiente básico y barato. Bueno en número.',
  },
  officer: {
    name: 'Oficial de campo', cls: 'inf', mover: 'land', cost: 1200, hp: 260, speed: 1.5, pop: 1, build: 8,
    aura: [{ kind: 'dmg', pct: 0.15, range: 2 }],
    weapon: { dmg: 10, cd: 0.8, range: 3, proj: 'bullet', mult: { inf: 1.1, veh: 0.4, ship: 0.3, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Mando: tus tropas a 2 casillas hacen un 15 % más de daño (no se suma con otro mando).',
  },
  radioman: {
    name: 'Operador de comunicaciones', cls: 'inf', mover: 'land', cost: 900, hp: 200, speed: 1.5, pop: 1, build: 7, vision: 8, detect: 3,
    weapon: { dmg: 8, cd: 0.8, range: 3, proj: 'bullet', mult: { inf: 1.1, veh: 0.4, ship: 0.3, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Ve 8 casillas y descubre submarinos, minas y furtivos a 3.',
  },
  sapper: {
    name: 'Zapador', cls: 'inf', mover: 'land', cost: 800, hp: 300, speed: 1.5, pop: 1, build: 7, demine: true,
    weapon: { dmg: 60, cd: 2.5, range: 1, proj: 'bullet', wallMult: 4, mult: { inf: 0.5, veh: 0.8, ship: 0.5, air: 0, bld: 3, sub: 0 } },
    desc: 'Cargas explosivas: ×3 a edificios y ×4 a muros. Desactiva minas cercanas.',
  },
  mortar: {
    name: 'Equipo de mortero', cls: 'inf', mover: 'land', cost: 1100, hp: 300, speed: 1.1, pop: 2, build: 9,
    weapon: { dmg: 70, cd: 4, range: 6, proj: 'shell', splash: { r: 0.8, pct: 0.5 }, mult: { inf: 1.3, veh: 0.7, ship: 0.6, air: 0, bld: 0.9, sub: 0 } },
    desc: 'Tiro curvo de 6 casillas con daño en área.',
  },
  paratrooper: {
    name: 'Paracaidista', cls: 'inf', mover: 'land', cost: 900, hp: 300, speed: 1.6, pop: 1, build: 8, para: true,
    weapon: { dmg: 20, cd: 0.6, range: 3, proj: 'bullet', mult: { inf: 1.15, veh: 0.6, ship: 0.5, air: 0.35, bld: 0.5, sub: 0 } },
    desc: 'Si tienes Aeropuerto militar, cae en paracaídas en el punto de reunión. Los aviones de transporte lo llevan.',
  },
  marine: {
    name: 'Infante de marina', cls: 'inf', mover: 'amphib', cost: 800, hp: 320, speed: 1.5, pop: 1, build: 7,
    weapon: { dmg: 18, cd: 0.6, range: 3, proj: 'bullet', mult: { inf: 1.15, veh: 0.6, ship: 0.7, air: 0.35, bld: 0.5, sub: 0 } },
    desc: 'Anfibio: camina por el agua poco profunda de la costa.',
  },
  atguided: {
    name: 'Equipo antitanque', cls: 'inf', mover: 'land', cost: 1600, hp: 240, speed: 1.2, pop: 1, build: 9,
    weapon: { dmg: 180, cd: 4, range: 6, proj: 'missile', mult: { inf: 0.3, veh: 2, ship: 1.2, air: 0, bld: 0.8, sub: 0 } },
    desc: 'Misil guiado de 6 casillas que cae sobre el techo de los tanques (×2 a vehículos).',
  },
  gunner: {
    name: 'Ametrallador pesado', cls: 'inf', mover: 'land', cost: 1000, hp: 340, speed: 1.2, pop: 1, build: 8,
    weapon: { dmg: 9, cd: 0.12, range: 3, proj: 'bullet', mult: { inf: 1.4, veh: 0.4, ship: 0.3, air: 0.4, bld: 0.3, sub: 0 } },
    desc: 'Ametralladora rotativa: lluvia de balas contra infantería.',
  },
  antidrone: {
    name: 'Soldado antidrones', cls: 'inf', mover: 'land', cost: 700, hp: 220, speed: 1.5, pop: 1, build: 6,
    weapon: { dmg: 40, cd: 0.8, range: 4, proj: 'bolt', droneMult: 6, mult: { inf: 0.3, veh: 0.2, ship: 0.1, air: 0.5, bld: 0.1, sub: 0 } },
    desc: 'Fusil inhibidor: corta la señal de los drones (×6). Poco daño a lo demás.',
  },
  robodog: {
    name: 'Perro robot', cls: 'veh', mover: 'land', cost: 1200, energy: 5, hp: 400, speed: 2.4, pop: 1, build: 7, vision: 7, detect: 3,
    desc: 'Patrulla con cámaras: ve 7 casillas y descubre lo oculto a 3. No pelea.',
  },
  armoredcar: {
    name: 'Blindado ligero', cls: 'veh', mover: 'land', cost: 1900, energy: 10, hp: 1000, speed: 2.4, pop: 2, build: 9,
    weapon: { dmg: 30, cd: 0.6, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.8, ship: 0.6, air: 0.4, bld: 0.5, sub: 0 } },
    desc: 'Rápido, con ruedas y cañón automático.',
  },
  ifv: {
    name: 'Vehículo de combate de infantería', cls: 'veh', mover: 'land', cost: 2800, energy: 20, hp: 1700, speed: 1.8, pop: 3, build: 12,
    capacity: 4, carries: 'inf',
    weapon: { dmg: 45, cd: 0.8, range: 4, proj: 'shell', mult: { inf: 1.1, veh: 1, ship: 0.8, air: 0.4, bld: 0.7, sub: 0 } },
    desc: 'Lleva 4 soldados y pelea con su cañón.',
  },
  trooptruck: {
    name: 'Camión de tropas', cls: 'veh', mover: 'land', cost: 1200, energy: 5, hp: 700, speed: 2.2, pop: 2, build: 7, capacity: 8, carries: 'inf',
    desc: 'Lleva 8 soldados. Poca protección.',
  },
  ambulance: {
    fem: true, name: 'Ambulancia militar', cls: 'veh', mover: 'land', cost: 1500, energy: 10, hp: 800, speed: 2.2, pop: 2, build: 8,
    healAura: { cls: ['inf'], pct: 0.06, range: 2 },
    desc: 'Cura a los soldados a 2 casillas (6 % de su vida por segundo).',
  },
  recovery: {
    name: 'Vehículo de recuperación', cls: 'veh', mover: 'land', cost: 2200, energy: 15, hp: 1800, speed: 1.4, pop: 2, build: 10,
    healAura: { cls: ['veh'], pct: 0.04, range: 1 },
    desc: 'Repara los vehículos de al lado (4 % de su vida por segundo).',
  },
  supplytruck: {
    name: 'Camión de suministros', cls: 'veh', mover: 'land', cost: 1600, energy: 10, hp: 800, speed: 2.0, pop: 2, build: 8,
    aura: [{ kind: 'supply', pct: 0.2, range: 2 }],
    desc: 'Suministros: tus tropas a 2 casillas recargan un 20 % más rápido.',
  },
  tanker: {
    name: 'Camión cisterna militar', cls: 'veh', mover: 'land', cost: 1500, energy: 5, hp: 900, speed: 2.0, pop: 2, build: 8,
    aura: [{ kind: 'fuel', pct: 0.2, range: 2, cls: ['veh'] }],
    desc: 'Combustible: tus vehículos a 2 casillas van un 20 % más rápido.',
  },
  commandveh: {
    name: 'Vehículo de mando', cls: 'veh', mover: 'land', cost: 3000, energy: 20, hp: 1600, speed: 1.6, pop: 3, build: 12,
    aura: [{ kind: 'dmg', pct: 0.15, range: 3 }],
    weapon: { dmg: 14, cd: 0.4, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.4, ship: 0.3, air: 0.4, bld: 0.3, sub: 0 } },
    desc: 'Mando: +15 % de daño a tus tropas a 3 casillas (no se suma con el Oficial).',
  },
  mobileradar: {
    name: 'Radar móvil', cls: 'veh', mover: 'land', cost: 2400, energy: 20, hp: 900, speed: 1.5, pop: 2, build: 10, vision: 10, detect: 8,
    desc: 'Ve 10 casillas y descubre aviones furtivos, submarinos y minas a 8.',
  },
  howitzer: {
    name: 'Obús autopropulsado', cls: 'veh', mover: 'land', cost: 4600, energy: 40, hp: 1500, speed: 0.9, pop: 3, build: 16,
    weapon: { dmg: 220, cd: 5, range: 8, proj: 'shell', splash: { r: 0.8, pct: 0.5 }, mult: { inf: 1, veh: 1, ship: 0.9, air: 0, bld: 1.3, sub: 0 } },
    desc: 'Artillería de 8 casillas con daño en área.',
  },
  towedgun: {
    fem: true, name: 'Artillería remolcada', cls: 'veh', mover: 'land', cost: 2600, energy: 10, hp: 800, speed: 0.7, pop: 2, build: 11,
    weapon: { dmg: 170, cd: 5, range: 7, proj: 'shell', splash: { r: 0.7, pct: 0.5 }, mult: { inf: 1, veh: 0.9, ship: 0.8, air: 0, bld: 1.2, sub: 0 } },
    desc: 'Cañón de 7 casillas barato y lento.',
  },
  tankdestroyer: {
    name: 'Cazacarros', cls: 'veh', mover: 'land', cost: 3600, energy: 30, hp: 1900, speed: 1.4, pop: 3, build: 14,
    weapon: { dmg: 200, cd: 2.6, range: 5, proj: 'shell', mult: { inf: 0.6, veh: 1.8, ship: 1.1, air: 0, bld: 1, sub: 0 } },
    desc: 'Cañón largo de 5 casillas, especialista contra tanques (×1,8).',
  },
  amphib: {
    name: 'Transporte anfibio', cls: 'veh', mover: 'amphib', cost: 2400, energy: 15, hp: 1500, speed: 1.8, pop: 2, build: 10, capacity: 6, carries: 'inf',
    weapon: { dmg: 12, cd: 0.4, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.4, ship: 0.4, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Anfibio: va por tierra y por agua poco profunda. Lleva 6 soldados.',
  },
  bridgelayer: {
    name: 'Vehículo lanzapuentes', cls: 'veh', mover: 'land', cost: 2600, energy: 20, hp: 1600, speed: 1.4, pop: 2, build: 10, layBridge: true,
    desc: '«Tender puente»: pone un Puente modular en el agua poco profunda de al lado (paga el puente).',
  },
  clearer: {
    name: 'Vehículo de despeje', cls: 'veh', mover: 'land', cost: 2000, energy: 15, hp: 2000, speed: 1.3, pop: 2, build: 9, demine: true,
    weapon: { dmg: 90, cd: 2, range: 1, proj: 'shell', mult: { inf: 0.6, veh: 0.6, ship: 0.5, air: 0, bld: 2.5, sub: 0 } },
    desc: 'Abre paso: rompe muros y obras (×2,5) y desactiva minas cercanas.',
  },
  dozer: {
    fem: true, name: 'Topadora blindada', cls: 'veh', mover: 'land', cost: 1800, energy: 10, hp: 2200, speed: 1.3, pop: 2, build: 9,
    builds: 'land', buildRate: 2, repairs: true,
    desc: 'Construye y repara como un Ingeniero, con blindaje.',
  },
  thermo: {
    name: 'Lanzacohetes termobárico', cls: 'veh', mover: 'land', cost: 5200, energy: 45, hp: 1300, speed: 1.0, pop: 3, build: 18,
    weapon: { dmg: 60, cd: 10, range: 5, proj: 'rocket', salvo: 8, splash: { r: 1, pct: 0.6 }, mult: { inf: 1.6, veh: 0.7, ship: 0.6, air: 0, bld: 1, sub: 0 } },
    desc: 'Salva de 8 cohetes: nube de fuego muy fuerte contra infantería.',
  },
  scoutdrone: {
    name: 'Dron explorador', cls: 'air', mover: 'air', cost: 800, energy: 5, hp: 150, speed: 3.2, pop: 1, build: 5, vision: 8, drone: true,
    desc: 'Ve 8 casillas desde el aire. No pelea.',
  },
  cargodrone: {
    name: 'Dron de carga', cls: 'air', mover: 'air', cost: 1200, energy: 10, hp: 250, speed: 2.6, pop: 1, build: 6, drone: true,
    aura: [{ kind: 'supply', pct: 0.2, range: 2 }],
    desc: 'Suministros desde el aire: tus tropas a 2 casillas recargan un 20 % más rápido.',
  },
  interceptor: {
    name: 'Dron interceptor', cls: 'air', mover: 'air', cost: 1400, energy: 10, hp: 300, speed: 3.6, pop: 1, build: 6, drone: true, prefersAir: true,
    weapon: { dmg: 60, cd: 1, range: 3, proj: 'missile', droneMult: 2, mult: { inf: 0, veh: 0, ship: 0, air: 1, bld: 0, sub: 0 } },
    desc: 'Caza drones y helicópteros (×2 a drones).',
  },
  navaldrone: {
    name: 'Dron naval de superficie', cls: 'ship', mover: 'sea', cost: 1000, energy: 5, hp: 400, speed: 3.0, pop: 1, build: 6, vision: 7, detect: 3,
    desc: 'Explora el mar: ve 7 casillas y descubre submarinos y minas a 3.',
  },
  subdrone: {
    name: 'Dron submarino', cls: 'sub', mover: 'sea', cost: 1200, energy: 5, hp: 300, speed: 2.0, pop: 1, build: 6, stealth: true, detect: 3,
    desc: 'Va oculto bajo el agua y descubre submarinos y minas a 3.',
  },
  transheli: {
    name: 'Helicóptero de transporte', cls: 'air', mover: 'air', cost: 5000, energy: 40, hp: 2000, speed: 2.4, pop: 3, build: 14,
    capacity: 8, carries: 'inf', airlift: true,
    desc: 'Lleva 8 soldados y los baja en cualquier tierra.',
  },
  rescueheli: {
    name: 'Helicóptero de rescate', cls: 'air', mover: 'air', cost: 4000, energy: 30, hp: 1600, speed: 2.5, pop: 3, build: 12,
    healAura: { cls: ['inf', 'air'], pct: 0.05, range: 2 },
    desc: 'Cura a los soldados y repara las aeronaves a 2 casillas.',
  },
  navalheli: {
    name: 'Helicóptero de patrulla naval', cls: 'air', mover: 'air', cost: 6000, energy: 50, hp: 2000, speed: 2.3, pop: 4, build: 16, detect: 4,
    weapon: { dmg: 200, cd: 4, range: 3, proj: 'torpedo', waterOnly: true, mult: { ship: 1, sub: 2, bld: 0.6 } },
    desc: 'Descubre submarinos a 4 casillas y los ataca con torpedos (×2).',
  },
  attackjet: {
    name: 'Avión de apoyo terrestre', cls: 'air', mover: 'air', cost: 7000, energy: 60, hp: 2600, speed: 2.4, pop: 4, build: 20, plane: true,
    weapon: { dmg: 40, cd: 0.25, range: 3, proj: 'bullet', mult: { inf: 1, veh: 1.8, ship: 1, air: 0, bld: 0.8, sub: 0 } },
    desc: 'Cañón de 30 mm: vuela bajo y destruye tanques (×1,8).',
  },
  heavybomber: {
    name: 'Bombardero convencional', cls: 'air', mover: 'air', cost: 11000, energy: 100, hp: 4200, speed: 1.6, pop: 6, build: 30, plane: true,
    prefersBld: true,
    weapon: { dmg: 900, cd: 7, range: 1, proj: 'bomb', splash: { r: 1, pct: 0.4 }, mult: { inf: 0.6, veh: 0.8, ship: 1, air: 0, bld: 2, sub: 0 } },
    desc: 'Bombardero pesado con bombas guiadas: destruye bases. Se ve en el radar.',
  },
  transportplane: {
    name: 'Avión de transporte militar', cls: 'air', mover: 'air', cost: 6000, energy: 50, hp: 3000, speed: 2.0, pop: 4, build: 18, plane: true,
    capacity: 10, carries: 'inf', airlift: true,
    desc: 'Lleva 10 soldados y los lanza en paracaídas en cualquier tierra.',
  },
  awacs: {
    name: 'Avión de vigilancia aérea', cls: 'air', mover: 'air', cost: 7500, energy: 60, hp: 2200, speed: 1.8, pop: 4, build: 20, plane: true,
    vision: 14, detect: 8,
    desc: 'Ve 14 casillas y descubre aviones furtivos y submarinos a 8.',
  },
  tankerplane: {
    name: 'Avión de reabastecimiento', cls: 'air', mover: 'air', cost: 6500, energy: 50, hp: 2600, speed: 2.0, pop: 4, build: 18, plane: true,
    healAura: { cls: ['air'], pct: 0.03, range: 3 },
    desc: 'Repara tus aeronaves a 3 casillas (3 % de su vida por segundo).',
  },
  ewplane: {
    name: 'Avión de apoyo electrónico', cls: 'air', mover: 'air', cost: 8000, energy: 70, hp: 2400, speed: 2.2, pop: 4, build: 22, plane: true,
    prefersBld: true, aura: [{ kind: 'jam', pct: 0.4, range: 4 }],
    weapon: { dmg: 300, cd: 8, range: 6, proj: 'missile', defMult: 2, mult: { inf: 0, veh: 0.3, ship: 0.3, air: 0, bld: 1, sub: 0 } },
    desc: 'Interferencia: las defensas enemigas a 4 casillas disparan un 40 % más lento. Misil antirradar (×2 a defensas).',
  },
  gunship: {
    name: 'Avión artillado', cls: 'air', mover: 'air', cost: 9500, energy: 80, hp: 3800, speed: 1.4, pop: 5, build: 26, plane: true,
    weapon: { dmg: 120, cd: 1.5, range: 5, proj: 'shell', splash: { r: 0.8, pct: 0.5 }, mult: { inf: 1.3, veh: 1, ship: 0.9, air: 0, bld: 1, sub: 0 } },
    desc: 'Da vueltas sobre el blanco y dispara de costado con daño en área.',
  },
  gunboat: {
    fem: true, name: 'Cañonera', cls: 'ship', mover: 'sea', cost: 2200, energy: 15, hp: 1300, speed: 2.0, pop: 2, build: 10,
    weapon: { dmg: 90, cd: 1.8, range: 4, proj: 'shell', mult: { inf: 1, veh: 1, ship: 1, air: 0, bld: 1.2, sub: 0 } },
    desc: 'Apoyo naval barato contra la costa.',
  },
  battleship: {
    name: 'Acorazado', cls: 'ship', mover: 'sea', cost: 12000, energy: 100, hp: 7000, speed: 0.9, pop: 6, build: 34,
    weapon: { dmg: 400, cd: 4, range: 7, proj: 'shell', salvo: 2, splash: { r: 0.8, pct: 0.5 }, mult: { inf: 1, veh: 1, ship: 1.3, air: 0, bld: 1.5, sub: 0.5 } },
    desc: 'El buque más fuerte: salvas de 2 obuses a 7 casillas contra bases y barcos.',
  },
  patrolboat: {
    fem: true, name: 'Patrullera costera', cls: 'ship', mover: 'sea', cost: 1600, energy: 10, hp: 900, speed: 2.6, pop: 1, build: 8, vision: 7, detect: 3,
    weapon: { dmg: 16, cd: 0.5, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.5, ship: 0.7, air: 0.5, bld: 0.4, sub: 0 } },
    desc: 'Vigila la costa: ve 7 casillas y descubre submarinos a 3.',
  },
  corvette: {
    fem: true, name: 'Corbeta', cls: 'ship', mover: 'sea', cost: 3200, energy: 25, hp: 2000, speed: 2.0, pop: 3, build: 12, detects: true,
    pointDefense: { range: 2, cd: 2 },
    weapon: { dmg: 80, cd: 1.2, range: 5, proj: 'shell', mult: { inf: 1, veh: 1, ship: 1.1, air: 0.6, bld: 1, sub: 0.8 } },
    desc: 'Cañón de proa y defensa de punto: derriba misiles y cohetes cerca.',
  },
  cruiser: {
    name: 'Crucero de mando', cls: 'ship', mover: 'sea', cost: 9000, energy: 80, hp: 5200, speed: 1.1, pop: 5, build: 28, detects: true,
    pointDefense: { range: 3, cd: 1.5 }, aura: [{ kind: 'dmg', pct: 0.15, range: 3, cls: ['ship', 'sub'] }],
    weapon: { dmg: 260, cd: 3, range: 7, proj: 'missile', mult: { inf: 0.8, veh: 1, ship: 1.4, air: 1.2, bld: 1.3, sub: 0.6 } },
    desc: 'Misiles de 7 casillas, mando naval (+15 % de daño a tus barcos cerca) y defensa de punto.',
  },
  landingship: {
    name: 'Buque de desembarco', cls: 'ship', mover: 'sea', cost: 4200, energy: 30, hp: 3200, speed: 1.4, pop: 4, build: 16, capacity: 12,
    desc: 'Lleva 12 lugares (un vehículo ocupa 2) y los baja en la costa.',
  },
  logship: {
    name: 'Buque logístico', cls: 'ship', mover: 'sea', cost: 3500, energy: 20, hp: 2600, speed: 1.3, pop: 3, build: 14,
    healAura: { cls: ['ship', 'sub'], pct: 0.02, range: 3 }, aura: [{ kind: 'supply', pct: 0.2, range: 3, cls: ['ship', 'sub'] }],
    desc: 'Repara tus barcos a 3 casillas y los hace recargar un 20 % más rápido.',
  },
  hospitalship: {
    name: 'Buque hospital', cls: 'ship', mover: 'sea', cost: 4000, energy: 20, hp: 3000, speed: 1.2, pop: 3, build: 14,
    healAura: { cls: ['ship', 'sub', 'inf'], pct: 0.03, range: 3 },
    desc: 'Repara tus barcos y cura a tus soldados a 3 casillas.',
  },
  hovercraft: {
    name: 'Aerodeslizador militar', cls: 'ship', mover: 'amphib', cost: 2600, energy: 20, hp: 1400, speed: 2.8, pop: 2, build: 10, capacity: 6,
    desc: 'Anfibio: va por el agua y sube a la costa. Lleva 6 lugares (también vehículos).',
  },
  minesweeper: {
    name: 'Dragaminas', cls: 'ship', mover: 'sea', cost: 2000, energy: 15, hp: 1400, speed: 1.8, pop: 2, build: 10, detect: 3, demine: true,
    weapon: { dmg: 120, cd: 1, range: 3, proj: 'bullet', onlyType: 'seamine', mult: { bld: 1 } },
    desc: 'Descubre y destruye minas a 3 casillas.',
  },
  minelayer: {
    name: 'Buque minador', cls: 'ship', mover: 'sea', cost: 2500, energy: 20, hp: 1500, speed: 1.6, pop: 2, build: 10, layMine: true,
    desc: '«Sembrar mina»: deja una mina oculta donde está (hasta 8). Explota con barcos enemigos.',
  },
  reconsub: {
    name: 'Submarino de reconocimiento', cls: 'sub', mover: 'sea', cost: 3000, energy: 25, hp: 1200, speed: 1.8, pop: 2, build: 12,
    stealth: true, vision: 8, detect: 3,
    desc: 'Oculto: ve 8 casillas y descubre submarinos y minas a 3.',
  },
  // Solo con «Arsenal estratégico»: comparte el uso único con el Lanzador nuclear móvil y el Complejo estratégico.
  stratsub: {
    name: 'Submarino estratégico', cls: 'sub', mover: 'sea', cost: 24000, energy: 100, hp: 2600, speed: 1.2, pop: 5, build: 40,
    limit: 1, strategic: true, stealth: true,
    desc: 'Oculto, con un solo misil nuclear: un uso por partida. No pelea.',
  },
};

for (const [k, d] of Object.entries(BUILDINGS)) {
  d.key = k;
  if (!d.maxLevel) d.maxLevel = 3;
}
// v0.9: toda tropa armada puede dañar edificios y Núcleos (las antiaéreas, poco).
for (const d of Object.values(UNITS)) {
  if (d.weapon && !(d.weapon.mult.bld > 0)) d.weapon.mult.bld = 0.3;
}
for (const [k, d] of Object.entries(UNITS)) d.key = k;

// Modos del vestíbulo (lobby: true) y modos internos para Personalizado y pruebas.
const MODES = {
  // v1.1: alliances = se pueden formar y romper alianzas durante la partida (todos contra todos).
  conquest: { name: 'Conquista de islas', desc: '6 imperios. Gana el último Núcleo en pie. Puedes aliarte desde el marcador.', players: 6, teams: [0, 1, 2, 3, 4, 5], lobby: true, alliances: true },
  fog: { name: 'Islas en la niebla', desc: 'Solo ves lo que está cerca de tus tropas y edificios.', players: 6, teams: [0, 1, 2, 3, 4, 5], fog: true, lobby: true, alliances: true },
  turbo: { name: 'Turbo ×2', desc: 'Monedas y tropas salen el doble de rápido.', players: 6, teams: [0, 1, 2, 3, 4, 5], speed: 2, lobby: true, alliances: true },
  duos: { name: 'Dúos', desc: '3 parejas: tú y un aliado bot aparecen juntos. Gana la última pareja en pie.', players: 6, teams: [0, 0, 1, 1, 2, 2], lobby: true, duos: true },
  // v1.3: la Clasificatoria aparte (v1.1) ya no se elige; queda para abrir partidas guardadas antes.
  ranked: { name: 'Liga 3 vs 3', desc: 'Dos equipos de 3 con aliados bots. Da puntos de rango.', players: 6, teams: [0, 0, 0, 1, 1, 1], ranked: true },
  league: { name: 'Liga 3 vs 3', desc: 'Dos equipos de 3 con aliados bots. Da puntos de rango: ganar +25, perder −15.', players: 6, teams: [0, 0, 0, 1, 1, 1], lobby: true, minLevel: 10, ranked: true },
  king: { name: 'Rey del Faro', desc: 'Mantén el Faro 3 min en total.', players: 4, teams: [0, 1, 2, 3], king: true, lobby: true },
  blitz: { name: 'Choque exprés', desc: '6.000 monedas y ritmo ×2.', players: 4, teams: [0, 1, 2, 3], coins: 6000, energy: 150, speed: 2, lobby: true, alliances: true },
  duel: { name: 'Duelo 1 vs 1', desc: 'Tú contra 1 rival', players: 2, teams: [0, 1] },
  ffa: { name: 'Todos contra todos', desc: '4 imperios, gana el último', players: 4, teams: [0, 1, 2, 3], alliances: true },
  teams: { name: 'Equipos 2 vs 2', desc: 'Con Rojo como aliado', players: 4, teams: [0, 0, 1, 1] },
  big: { name: 'Gran batalla', desc: '6 imperios, mapa lleno', players: 6, teams: [0, 1, 2, 3, 4, 5], alliances: true },
  tutorial: { name: 'Tutorial', desc: 'Aprende a jugar contra un bot lento en otra isla.', players: 2, teams: [0, 1], tutorial: true, coins: 6000 },
  // v1.8: para mirar y probar todo el catálogo. El rival no ataca, hay Arsenal estratégico y no da XP ni misiones.
  sandbox: { name: 'Campo de pruebas', desc: 'Todos los productores ya hechos, 500.000 monedas y energía de sobra. El rival no ataca: prueba cada tropa y edificio. No da XP.',
    players: 2, teams: [0, 1], coins: 500000, energy: 9999, lobby: true, sandbox: true, strategic: true },
};
// v1.8: lo que ya está construido al empezar el Campo de pruebas (lo que no cabe en tu isla, lo construyes tú).
const SANDBOX_BUILDINGS = ['barracks', 'factory', 'helipad', 'airport', 'dronecenter', 'research', 'harbor', 'shipyard', 'house', 'house', 'powerplant'];

const MAPS = {
  archipelago: { name: 'Archipiélago Ámbar', desc: 'Islas en círculo unidas por puentes de arena.' },
  open: { name: 'Mar abierto', desc: 'Sin puentes: necesitas barcos o helicópteros.' },
  continent: { name: 'Continente', desc: 'Una gran isla con lagos.' },
  bay: { name: 'Bahía Gris', desc: 'Islas irregulares; solo algunas tienen puente.', palette: 'cold' },
  reef: { name: 'Arrecife Doble', desc: 'Dos grupos de islas separados por agua navegable.' },
  // v1.2: variantes con nombres propios.
  mesa: { name: 'Mesetas de Cobre', desc: 'Un continente con mesetas altas: desde lo alto se dispara y se ve 1 casilla más lejos.', base: 'continent' },
  dunes: { name: 'Dunas Rojas', desc: 'Desierto de islas con puentes y oasis fértiles.', base: 'archipelago', tint: 'desert' },
};

// Colores alternativos por mapa (Bahía Gris).
const PALETTES = {
  // v1.2: Dunas Rojas.
  desert: { deep: 0x1f5f7a, shallow: 0x3aa0a8, oil: 0x3aa0a8, sand: 0xe3bf7e, grass: 0xbfa75c, forest: 0x7f8f3e,
    gold: 0xc9b04a, mount: 0xb07a52, fertile: 0x93a84a, oilland: 0x7a6a4e, dune: 0xd9a066 },
  cold: { deep: 0x1d4a63, shallow: 0x3a7891, oil: 0x3a7891, sand: 0xb9b6a6, grass: 0x6f9a74, forest: 0x4f7a5d,
    gold: 0x95a36a, mount: 0x8d949a, fertile: 0x8a9a62, oilland: 0x5e6458 },
};

// Tácticas por dificultad: agrupar oleadas, retirarse, contrarrestar y atacar defensas primero.
const DIFFICULTY = {
  // v0.8: focus = fuego concentrado, harass = hostigar la economía, turret = Torreta del lado del
  // ataque, teamwork = aliados atacan juntos y se ayudan.
  // v1.0, solo Difícil: snipe = busca primero Constructores y economía; medevac = retira antes a los
  // heridos; earlyAA = defensa antiaérea en cuanto ve aviones; fastUp = mejora antes; earlyNuke = misil antes.
  easy: { name: 'Fácil', income: 0.75, think: 3.0, firstWave: 230, wave: 8,
    tactics: { group: false, retreat: false, counter: false, focusDefense: false, focus: false, harass: false, turret: false, teamwork: true } },
  normal: { name: 'Normal', income: 1.0, think: 1.8, firstWave: 150, wave: 7,
    tactics: { group: true, retreat: true, counter: true, focusDefense: false, focus: true, harass: true, turret: true, teamwork: true } },
  hard: { name: 'Difícil', income: 1.7, think: 0.8, firstWave: 80, wave: 6,
    tactics: { group: true, retreat: true, counter: true, focusDefense: true, focus: true, harass: true, turret: true, teamwork: true,
      snipe: true, medevac: true, earlyAA: true, fastUp: true, earlyNuke: true } },
};

// Personalidades de los bots. plan = peso de cada tipo de tropa en su ejército.
const PERSONALITIES = {
  aggro: {
    name: 'Agresivo', firstWave: 0.6, waveEvery: 0.7, waveSize: 0.8, milShare: 0.12, turrets: 0.5, capture: 0,
    plan: { inf: 3, veh: 3, sea: 1, air: 1 },
    lines: { attack: ['¡Prepárate, voy por ti!', 'Tu base será mía.', '¡A la carga!'], faro: ['El Faro es mío. ¡Ven a quitármelo!'],
      fall: ['Esto no ha terminado…'], provoked: ['¿Me atacas? Te arrepentirás.'] },
  },
  builder: {
    name: 'Constructor', firstWave: 1.5, waveEvery: 1.3, waveSize: 1.4, milShare: -0.08, turrets: 1.6, capture: 0,
    plan: { inf: 3, veh: 3, sea: 1, air: 2 },
    lines: { attack: ['Mi ejército está listo. Allá voy.', 'He preparado algo grande para ti.'], faro: ['El Faro alimentará mi imperio.'],
      fall: ['Mis murallas no bastaron.'], provoked: ['Reforzaré mis defensas… y luego iré por ti.'] },
  },
  admiral: {
    name: 'Almirante', firstWave: 1.1, waveEvery: 1.0, waveSize: 1.0, milShare: 0, turrets: 1, capture: 0, harborFirst: true,
    plan: { inf: 3, veh: 1, sea: 4, air: 1 },
    lines: { attack: ['Mi flota zarpa hacia tu costa.', 'Rumbo a tu isla. ¡Zafarrancho!'], faro: ['Ese Faro guiará a mi flota.'],
      fall: ['Abandonen el barco…'], provoked: ['¿Disparas a mis barcos? Error.'] },
  },
  keeper: {
    name: 'Guardián del Faro', firstWave: 1.0, waveEvery: 1.0, waveSize: 1.0, milShare: 0, turrets: 1, capture: 2,
    plan: { inf: 3, veh: 2, sea: 1, air: 1 },
    lines: { attack: ['Despejaré el camino al Faro, empezando por ti.', 'Nadie amenaza el Faro.'], faro: ['La luz del Faro es mía.'],
      fall: ['Que otro cuide el Faro…'], provoked: ['Aléjate de mis Banderas.'] },
  },
};
const PERSONALITY_ORDER = ['aggro', 'builder', 'admiral', 'keeper'];
const ALLY_LINES = { attack: 'Voy a atacar a {t}. ¡Cúbreme!', faro: 'Tomé el Faro para el equipo.', flag: 'Tomé una Bandera para el equipo.' };
const CAT_NAMES = { inf: 'infantería', veh: 'vehículos', ship: 'buques', sub: 'submarinos', air: 'aeronaves', bld: 'edificios' };

// Campaña «La ruta del Faro» (v0.7). goal = lo que hay que lograr para ganar; stars = las 2 estrellas
// extra (la primera estrella es terminar la misión). personas: personalidad de cada bot por número.
// Tipos de meta: eco (ingresos y tropas), survive (aguantar), hold (Faro en tu poder), flags (Banderas
// de otras islas), destroy (todos los Núcleos rivales). Estrellas: time (menos de X s), lostBld y
// lostUnits (perder X o menos), coreEnd (Núcleo sobre X al final), coreMin (Núcleo nunca bajo X).
const CAMPAIGN = [
  {
    id: 1, name: 'Primera luz', mapKind: 'continent', seed: 7101, players: 2, difficulty: 'easy',
    personas: [null, 'builder'], passive: true, crystals: 50,
    story: 'Tu colonia acaba de llegar a una isla tranquila. El Faro de Ámbar lleva años apagado y nadie vigila la costa. Antes de pensar en batallas, pon en marcha la economía y arma una pequeña guardia.',
    tip: 'Las Granjas van en la tierra fértil. El Cuartel entrena Artilleros y Escopeteros. Tu vecino de esta isla no atacará.',
    goal: { kind: 'eco', income: 1600, army: 5 },
    stars: [{ kind: 'time', max: 360 }, { kind: 'lostBld', max: 0 }],
  },
  {
    id: 2, name: 'Defender la costa', mapKind: 'archipelago', seed: 7202, players: 2, difficulty: 'normal',
    personas: [null, 'admiral'], coins: 4000, crystals: 75, firstWave: 100, waveEvery: 0.9,
    enemyStart: { buildings: ['harbor'], units: ['speedboat', 'speedboat', 'rifle', 'rifle', 'shotgun'] },
    myStart: { buildings: ['turret'] },
    story: 'Un Almirante quiere tu isla para su flota y sus barcos ya zarparon. Levanta defensas en la costa y aguanta hasta que llegue la ayuda.',
    tip: 'Las Torretas disparan a barcos. Pon algunas entre el agua y tu Núcleo, y repara con Constructores.',
    goal: { kind: 'survive', time: 360 },
    stars: [{ kind: 'coreEnd', min: 0.5 }, { kind: 'lostBld', max: 3 }],
  },
  {
    id: 3, name: 'El Faro', mapKind: 'archipelago', seed: 7303, players: 2, difficulty: 'normal',
    personas: [null, 'keeper'], crystals: 100, myStart: { units: ['rifle', 'rifle', 'rifle'] },
    guardFaro: { units: ['rifle', 'rifle', 'rifle', 'shotgun'] },
    story: 'El Faro está en la isla del centro y un Guardián del Faro ya lo tomó con 4 guardias. Tienes 3 Artilleros: junta más tropas, quítale el Faro y mantenlo encendido.',
    tip: 'Solo la infantería captura: quédate junto al Faro sin enemigos cerca. El tiempo se suma aunque lo pierdas un rato. Usa «Avanzar atacando».',
    goal: { kind: 'hold', time: 60 },
    stars: [{ kind: 'time', max: 480 }, { kind: 'lostUnits', max: 6 }],
  },
  {
    id: 4, name: 'Cruzar el mar', mapKind: 'open', seed: 7404, players: 2, difficulty: 'normal',
    personas: [null, 'keeper'], crystals: 125, myStart: { buildings: ['harbor'], units: ['barge'] },
    guardFlags: { count: 2, units: ['rifle', 'rifle', 'shotgun'] },
    story: 'Más allá del mar hay islas con Banderas. Tu Puerto y una Barcaza ya están listos, pero un Guardián del Faro puso guardias en las Banderas más cercanas. Entrena infantería, cruza el mar y quítaselas.',
    tip: 'Construye un Cuartel y entrena Artilleros o Escopeteros. Selecciónalos y toca la Barcaza para subirlos; muévela junto a otra isla y toca «Desembarcar».',
    goal: { kind: 'flags', count: 2 },
    stars: [{ kind: 'time', max: 600 }, { kind: 'lostUnits', max: 8 }],
  },
  {
    id: 5, name: 'Asedio', mapKind: 'continent', seed: 7505, players: 2, difficulty: 'hard',
    personas: [null, 'builder'], coins: 8000, crystals: 150, fortress: true,
    story: 'Un imperio se encerró tras murallas, Torretas de nivel 2 y 3 y AIR DEFENSE. Tienes 8.000 monedas para preparar el asedio. Rompe sus defensas y destruye su Núcleo.',
    tip: 'Los Tanques y los Lanzamisiles pegan fuerte a los edificios. La AIR DEFENSE derriba helicópteros: déjalos para el final.',
    goal: { kind: 'destroy' },
    stars: [{ kind: 'time', max: 720 }, { kind: 'lostUnits', max: 15 }],
  },
  {
    id: 6, name: 'La gran batalla', mapKind: 'archipelago', seed: 7606, players: 4, difficulty: 'normal',
    personas: [null, 'builder', 'aggro', 'admiral'], coins: 4000, crystals: 250,
    story: 'Tres imperios quieren la luz del Faro de Ámbar. Solo uno quedará en pie. Que sea el tuyo.',
    tip: 'Empiezas con 4.000 monedas. Los rivales también pelean entre ellos: defiende tu Núcleo (la estrella pide que nunca baje del 50 %) y ataca al más débil. Ahora tienen aviones y misiles: ten AIR DEFENSE.',
    goal: { kind: 'destroy' },
    stars: [{ kind: 'time', max: 1500 }, { kind: 'coreMin', min: 0.5 }],
  },
];
const CAMPAIGN_STAR_CRYSTALS = 20;

const OBJECTIVES = [
  { id: 'builder', text: 'Entrena un Constructor más en el Núcleo' },
  { id: 'energy', text: 'Construye una energía (Solar o Eólica)' },
  { id: 'barracks', text: 'Construye un Cuartel' },
  { id: 'army', text: 'Ten 5 tropas de combate' },
  { id: 'capture', text: 'Captura una Bandera o el Faro con infantería' },
  { id: 'kill', text: 'Destruye un Núcleo enemigo' },
];
