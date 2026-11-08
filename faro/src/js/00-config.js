'use strict';
// Faro de Ámbar: datos del juego (edificios, unidades, terreno, jugadores).
// Todo el balance vive aquí para poder ajustarlo sin tocar la lógica.

const SQ3 = Math.sqrt(3);
const GAME_NAME = 'Faro de Ámbar';
const GAME_VERSION = '0.9';
const START_COINS = 2000;
const START_ENERGY = 60;
// Tropas iniciales de cada imperio (v0.6: ritmo más rápido).
const START_UNITS = ['builder'];
// Comunidad (población) máxima: 180 desde la v0.9.
const MAX_POP = 180;

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
const NUKE = { cost: 20000, cooldown: 180, range: 40, radius: 3, dmg: 4000, flight: 9 };
// Casa: nivel 1 (+10 de comunidad) y nivel 2 = Apartamento (+20 más). Precio de la mejora.
const HOUSE_LEVELS = [0, 1500];
// Reparación del Ingeniero: vida por segundo y pausa tras recibir daño.
const REPAIR = { rate: 25, pause: 4 };
const HOUSE_LIMIT = 6;

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
};

const PLAYER_COLORS = [0x2f7fe0, 0xe0484d, 0xf0a030, 0x9b5de5, 0xe85d9f, 0x1fb5a3];
const PLAYER_NAMES = ['Tú', 'Rojo', 'Naranja', 'Violeta', 'Rosa', 'Turquesa'];

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
    fem: true, name: 'Eólica', cat: 'energy', cost: 300, hp: 400, build: 6, energy: 5, on: 'land', limit: 8,
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
    produces: ['builder', 'engineer', 'rifle', 'shotgun', 'ranger', 'sniper', 'breaker', 'hunter', 'rocket', 'medic'],
    desc: 'Entrena los 9 soldados, del Constructor al Cohetero.',
  },
  factory: {
    fem: true, name: 'Fábrica', cat: 'prod', cost: 3000, energyCost: 50, hp: 1500, build: 16, on: 'land', limit: 2, builtBy: 'land',
    produces: ['jeep', 'apc', 'lighttank', 'tank', 'heavytank', 'aa', 'arty', 'missiletruck', 'launcher'],
    desc: 'Fabrica tanques, camiones antiaéreos, jeeps y lanzamisiles.',
  },
  harbor: {
    name: 'Puerto', cat: 'prod', cost: 2200, hp: 1300, build: 14, on: 'coast', limit: 2, builtBy: 'land',
    produces: ['speedboat', 'boatEng', 'barge', 'lander', 'frigate', 'destroyer', 'sub', 'carrier'], heal: { cls: ['ship', 'sub'], rate: 25, range: 2 },
    desc: 'En agua junto a la orilla. Construye los 5 barcos y repara los cercanos.',
  },
  helipad: {
    name: 'Helipuerto', cat: 'prod', cost: 4000, energyCost: 80, hp: 1000, build: 18, on: 'land', limit: 6, builtBy: 'land',
    produces: ['heli', 'apache'], heal: { cls: ['air'], rate: 40, range: 2 },
    desc: 'Produce el Helicóptero y el Apache Guardián, y repara a los helicópteros cercanos. Hasta 6.',
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
    name: 'Muro', cat: 'def', cost: 150, hp: 1500, build: 3, on: 'land', limit: 40, builtBy: 'land',
    desc: 'Muralla que bloquea a las tropas enemigas y se une con los muros vecinos. Las tuyas pasan.',
  },
  hospital: {
    fem: true, name: 'Enfermería', cat: 'def', cost: 2000, hp: 700, build: 12, on: 'land', limit: 2, builtBy: 'land',
    heal: { cls: ['inf', 'veh'], pct: 0.03, range: 2 },
    healLevels: [null, { pct: 0.03, range: 2, name: 'Clínica' }, { pct: 0.05, range: 2, name: 'Mini hospital' }, { pct: 0.08, range: 3, name: 'Hospital grande' }],
    desc: 'Cura infantería y vehículos cercanos. Nivel 1 clínica (3 %/s), nivel 2 mini hospital (5 %/s), nivel 3 hospital grande (8 %/s).',
  },
  // v0.9: Aeropuerto militar (caza y bombardero furtivos) y Escudo antimisiles (derriba el misil nuclear).
  airport: {
    name: 'Aeropuerto militar', cat: 'prod', cost: 6000, energyCost: 100, hp: 1800, build: 22, on: 'land', limit: 2, builtBy: 'land',
    produces: ['fighter', 'bomber'], heal: { cls: ['air'], rate: 40, range: 2 },
    desc: 'Pista y hangares: fabrica el Caza furtivo y el Bombardero furtivo, y repara aviones cercanos.',
  },
  antinuke: {
    name: 'Escudo antimisiles', cat: 'def', cost: 9000, energyCost: 120, hp: 1400, build: 20, on: 'land', limit: 2, builtBy: 'land',
    maxLevel: 1, intercept: { range: 7, recharge: 120 },
    desc: 'Derriba el misil nuclear enemigo si cae a 7 casillas o menos. Una carga cada 2 minutos.',
  },
  outpost: {
    name: 'Puesto avanzado', cat: null, cost: 800, hp: 800, build: 8, claim: 2, vision: 4, limit: 6, maxLevel: 1,
    desc: 'Amplía tu territorio. Lo fundan los ingenieros y los barcos constructores.',
  },
};

const BUILD_TABS = [
  { id: 'eco', name: 'Economía', items: ['farm', 'pump', 'mine', 'rig', 'house'] },
  { id: 'energy', name: 'Energía', items: ['solar', 'wind', 'hydro', 'tidal', 'wave'] },
  { id: 'prod', name: 'Producción', items: ['barracks', 'factory', 'harbor', 'helipad', 'airport'] },
  { id: 'def', name: 'Defensa', items: ['turret', 'aadef', 'antinuke', 'wall', 'hospital', 'miniturret'] },
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
    name: 'Transporte blindado', cls: 'veh', mover: 'land', cost: 2000, energy: 15, hp: 1600, speed: 2.0, pop: 2, build: 10, capacity: 6, carries: 'inf',
    weapon: { dmg: 14, cd: 0.3, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.4, ship: 0.3, air: 0.3, bld: 0.3, sub: 0 } },
    desc: 'Lleva 6 soldados protegidos y tiene una ametralladora.',
  },
  launcher: {
    name: 'Lanzador de misiles', cls: 'veh', mover: 'land', cost: 7000, energy: 70, hp: 1200, speed: 0.8, pop: 4, build: 24,
    weapon: { dmg: 900, cd: 14, range: 9, proj: 'missile', mult: { inf: 0.3, veh: 0.6, ship: 0.6, air: 0, bld: 1.6, sub: 0 } },
    desc: 'Camión gigante con un misil de muy largo alcance contra bases. Lento y caro.',
  },
  medic: {
    name: 'Médico', cls: 'inf', mover: 'land', cost: 900, hp: 220, speed: 1.6, pop: 1, build: 8, vision: 3,
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
    name: 'Fragata antiaérea', cls: 'ship', mover: 'sea', cost: 3600, energy: 30, detects: true, hp: 2200, speed: 1.7, pop: 3, build: 14,
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
    name: 'Caza furtivo', cls: 'air', mover: 'air', cost: 6000, energy: 60, hp: 1400, speed: 3.6, pop: 3, build: 18, plane: true,
    weapon: { dmg: 140, cd: 1.2, range: 5, proj: 'missile', mult: { inf: 0.1, veh: 0.2, ship: 0.2, air: 2.3, bld: 0.3, sub: 0 } },
    desc: 'Caza de quinta generación: muy rápido, misiles aire-aire. Limpia el cielo de aviones y helicópteros.',
  },
  bomber: {
    name: 'Bombardero furtivo', cls: 'air', mover: 'air', cost: 9000, energy: 90, hp: 2600, speed: 2.0, pop: 5, build: 28, plane: true,
    stealth: true, prefersBld: true,
    weapon: { dmg: 650, cd: 6, range: 1, proj: 'bomb', mult: { inf: 0.5, veh: 0.8, ship: 1, air: 0, bld: 2, sub: 0 } },
    desc: 'Ala volante invisible al radar: las defensas solo lo ven de muy cerca. Suelta bombas pesadas sobre edificios.',
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
  conquest: { name: 'Conquista de islas', desc: '6 imperios. Gana el último Núcleo en pie.', players: 6, teams: [0, 1, 2, 3, 4, 5], lobby: true },
  fog: { name: 'Islas en la niebla', desc: 'Solo ves lo que está cerca de tus tropas y edificios.', players: 6, teams: [0, 1, 2, 3, 4, 5], fog: true, lobby: true },
  turbo: { name: 'Turbo ×2', desc: 'Monedas y tropas salen el doble de rápido.', players: 6, teams: [0, 1, 2, 3, 4, 5], speed: 2, lobby: true },
  league: { name: 'Liga 3 vs 3', desc: 'Dos equipos de 3. Tus aliados son bots.', players: 6, teams: [0, 0, 0, 1, 1, 1], lobby: true, minLevel: 10 },
  king: { name: 'Rey del Faro', desc: 'Mantén el Faro 3 min en total.', players: 4, teams: [0, 1, 2, 3], king: true, lobby: true },
  blitz: { name: 'Relámpago', desc: '6.000 monedas y ritmo ×2.', players: 4, teams: [0, 1, 2, 3], coins: 6000, energy: 150, speed: 2, lobby: true },
  duel: { name: 'Duelo 1 vs 1', desc: 'Tú contra 1 rival', players: 2, teams: [0, 1] },
  ffa: { name: 'Todos contra todos', desc: '4 imperios, gana el último', players: 4, teams: [0, 1, 2, 3] },
  teams: { name: 'Equipos 2 vs 2', desc: 'Con Rojo como aliado', players: 4, teams: [0, 0, 1, 1] },
  big: { name: 'Gran batalla', desc: '6 imperios, mapa lleno', players: 6, teams: [0, 1, 2, 3, 4, 5] },
  tutorial: { name: 'Tutorial', desc: 'Aprende a jugar contra un bot lento.', players: 2, teams: [0, 1], tutorial: true },
};

const MAPS = {
  archipelago: { name: 'Archipiélago Ámbar', desc: 'Islas en círculo unidas por puentes de arena.' },
  open: { name: 'Mar abierto', desc: 'Sin puentes: necesitas barcos o helicópteros.' },
  continent: { name: 'Continente', desc: 'Una gran isla con lagos.' },
  bay: { name: 'Bahía Gris', desc: 'Islas irregulares y paleta fría; solo algunas tienen puente.', palette: 'cold' },
  reef: { name: 'Arrecife Doble', desc: 'Dos grupos de islas separados por agua navegable.' },
};

// Colores alternativos por mapa (Bahía Gris).
const PALETTES = {
  cold: { deep: 0x1d4a63, shallow: 0x3a7891, oil: 0x3a7891, sand: 0xb9b6a6, grass: 0x6f9a74, forest: 0x4f7a5d,
    gold: 0x95a36a, mount: 0x8d949a, fertile: 0x8a9a62, oilland: 0x5e6458 },
};

// Tácticas por dificultad: agrupar oleadas, retirarse, contrarrestar y atacar defensas primero.
const DIFFICULTY = {
  // v0.8: focus = fuego concentrado, harass = hostigar la economía, turret = Torreta del lado del
  // ataque, teamwork = aliados atacan juntos y se ayudan.
  easy: { name: 'Fácil', income: 0.75, think: 3.0, firstWave: 230, wave: 8,
    tactics: { group: false, retreat: false, counter: false, focusDefense: false, focus: false, harass: false, turret: false, teamwork: true } },
  normal: { name: 'Normal', income: 1.0, think: 1.8, firstWave: 150, wave: 7,
    tactics: { group: true, retreat: true, counter: true, focusDefense: false, focus: true, harass: true, turret: true, teamwork: true } },
  hard: { name: 'Difícil', income: 1.3, think: 1.1, firstWave: 95, wave: 6,
    tactics: { group: true, retreat: true, counter: true, focusDefense: true, focus: true, harass: true, turret: true, teamwork: true } },
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
  { id: 'builder', text: 'Entrena un Constructor en el Núcleo' },
  { id: 'energy', text: 'Construye una energía (Solar o Eólica)' },
  { id: 'barracks', text: 'Construye un Cuartel' },
  { id: 'army', text: 'Ten 5 tropas de combate' },
  { id: 'capture', text: 'Captura una Bandera o el Faro con infantería' },
  { id: 'kill', text: 'Destruye un Núcleo enemigo' },
];
