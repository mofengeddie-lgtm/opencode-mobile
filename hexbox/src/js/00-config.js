'use strict';
// HEXBOX: datos del juego (edificios, unidades, terreno, jugadores).
// Todo el balance vive aquí para poder ajustarlo sin tocar la lógica.

const SQ3 = Math.sqrt(3);
const GAME_NAME = 'HEXBOX';
const START_COINS = 2000;
const MAX_POP = 80;

// h = altura de la cara superior de la casilla.
const TERRAIN = {
  deep: { water: true, color: 0x175a85, h: -0.06, name: 'Mar profundo' },
  shallow: { water: true, color: 0x2a88a8, h: -0.03, name: 'Agua poco profunda' },
  oil: { water: true, color: 0x2a88a8, h: -0.03, name: 'Mancha de petróleo' },
  sand: { land: true, color: 0xd6b877, h: 0.26, name: 'Arena' },
  grass: { land: true, color: 0x6fae45, h: 0.42, name: 'Pasto' },
  forest: { land: true, color: 0x548f37, h: 0.42, slow: 1.45, cover: true, name: 'Bosque' },
  gold: { land: true, color: 0x9fb04a, h: 0.42, name: 'Veta de oro' },
  mount: { color: 0x9a958b, h: 0.6, cover: true, name: 'Montaña' },
};

const PLAYER_COLORS = [0x2f7fe0, 0xe0484d, 0xf0a030, 0x9b5de5, 0xe85d9f, 0x1fb5a3];
const PLAYER_NAMES = ['Tú', 'Rojo', 'Ámbar', 'Violeta', 'Rosa', 'Turquesa'];

// Multiplicadores de daño por tipo de objetivo:
// inf = infantería, veh = vehículo, ship = barco, sub = submarino, air = aéreo, bld = edificio.
const BUILDINGS = {
  core: {
    name: 'Núcleo', cat: null, cost: 0, hp: 6000, build: 0, income: 900, pop: 10,
    claim: 4, vision: 6, size: 1.25,
    weapon: { dmg: 45, cd: 1.0, range: 4, proj: 'bolt', mult: { inf: 1.3, veh: 1, ship: 1, air: 1, bld: 0, sub: 0 } },
    desc: 'Tu base. Genera monedas y dispara a los enemigos. Si lo destruyen, pierdes.',
  },
  farm: {
    name: 'Granja', cat: 'eco', cost: 300, hp: 350, build: 6, income: 240, on: ['grass'],
    desc: '+240 monedas/min. Solo sobre pasto.',
  },
  mine: {
    name: 'Mina', cat: 'eco', cost: 1000, hp: 650, build: 10, income: 600, on: ['gold'],
    desc: '+600 monedas/min. Solo sobre vetas de oro.',
  },
  rig: {
    name: 'Plataforma', cat: 'eco', cost: 2000, hp: 900, build: 14, income: 1100, on: ['oil'],
    desc: '+1100 monedas/min. Solo sobre manchas de petróleo en el mar.',
  },
  house: {
    name: 'Casa', cat: 'eco', cost: 500, hp: 400, build: 6, pop: 5, on: 'land',
    desc: '+5 de población para tus tropas.',
  },
  barracks: {
    name: 'Cuartel', cat: 'prod', cost: 1000, hp: 900, build: 10, on: 'land', limit: 3,
    produces: ['engineer', 'rifle', 'sniper', 'rocket'],
    desc: 'Entrena infantería e ingenieros.',
  },
  factory: {
    name: 'Fábrica', cat: 'prod', cost: 3000, hp: 1500, build: 16, on: 'land', limit: 3,
    produces: ['jeep', 'tank', 'aa'],
    desc: 'Fabrica jeeps, tanques y antiaéreos.',
  },
  harbor: {
    name: 'Puerto', cat: 'prod', cost: 2200, hp: 1300, build: 14, on: 'coast', limit: 3,
    produces: ['speedboat', 'boatEng', 'destroyer', 'sub'], heal: { cls: ['ship', 'sub'], rate: 25, range: 2 },
    desc: 'En agua junto a la orilla. Construye barcos y repara los cercanos.',
  },
  helipad: {
    name: 'Helipuerto', cat: 'prod', cost: 4000, hp: 1000, build: 18, on: 'land', limit: 2,
    produces: ['heli'],
    desc: 'Produce helicópteros de ataque.',
  },
  turret: {
    name: 'Torreta', cat: 'def', cost: 1500, hp: 1100, build: 10, on: 'land', limit: 12, vision: 5,
    weapon: { dmg: 40, cd: 0.9, range: 4, proj: 'bullet', mult: { inf: 1.5, veh: 1, ship: 1, air: 0.8, bld: 0.6, sub: 0 } },
    desc: 'Dispara a tropas, barcos y helicópteros cercanos.',
  },
  wall: {
    name: 'Muro', cat: 'def', cost: 150, hp: 1500, build: 3, on: 'land',
    desc: 'Bloquea el paso a las tropas enemigas. Las tuyas pasan.',
  },
  hospital: {
    name: 'Enfermería', cat: 'def', cost: 2000, hp: 700, build: 12, on: 'land', limit: 2,
    heal: { cls: ['inf', 'veh'], pct: 0.04, range: 2 },
    desc: 'Cura infantería y vehículos cercanos (4% de vida por segundo).',
  },
  outpost: {
    name: 'Puesto avanzado', cat: null, cost: 800, hp: 800, build: 8, claim: 2, vision: 4,
    desc: 'Amplía tu territorio. Lo fundan los ingenieros.',
  },
};

const BUILD_TABS = [
  { id: 'eco', name: 'Economía', items: ['farm', 'mine', 'rig', 'house'] },
  { id: 'prod', name: 'Producción', items: ['barracks', 'factory', 'harbor', 'helipad'] },
  { id: 'def', name: 'Defensa', items: ['turret', 'wall', 'hospital'] },
];

const UNITS = {
  engineer: {
    name: 'Ingeniero', cls: 'inf', mover: 'land', cost: 300, hp: 120, speed: 1.6, pop: 1, build: 5, vision: 3,
    founds: 'land', desc: 'Funda puestos avanzados para ampliar tu territorio.',
  },
  rifle: {
    name: 'Fusilero', cls: 'inf', mover: 'land', cost: 400, hp: 260, speed: 1.5, pop: 1, build: 5,
    weapon: { dmg: 16, cd: 0.7, range: 3, proj: 'bullet', mult: { inf: 1, veh: 0.6, ship: 0.5, air: 0.35, bld: 0.5, sub: 0 } },
    desc: 'Barato y versátil. Bueno en grupo.',
  },
  sniper: {
    name: 'Tirador', cls: 'inf', mover: 'land', cost: 900, hp: 170, speed: 1.3, pop: 1, build: 7,
    weapon: { dmg: 75, cd: 2.2, range: 5, proj: 'bullet', mult: { inf: 1.6, veh: 0.4, ship: 0.4, air: 0, bld: 0.3, sub: 0 } },
    desc: 'Largo alcance. Muy fuerte contra infantería.',
  },
  rocket: {
    name: 'Lanzacohetes', cls: 'inf', mover: 'land', cost: 1300, hp: 230, speed: 1.3, pop: 1, build: 8,
    weapon: { dmg: 95, cd: 2.6, range: 4, proj: 'rocket', mult: { inf: 0.6, veh: 1.8, ship: 1.4, air: 0, bld: 1.6, sub: 0 } },
    desc: 'Cohetes contra vehículos, barcos y edificios.',
  },
  jeep: {
    name: 'Jeep', cls: 'veh', mover: 'land', cost: 1600, hp: 750, speed: 2.6, pop: 2, build: 9,
    weapon: { dmg: 20, cd: 0.4, range: 3, proj: 'bullet', mult: { inf: 1.3, veh: 0.6, ship: 0.5, air: 0.5, bld: 0.5, sub: 0 } },
    desc: 'Rápido. Ideal para cazar infantería.',
  },
  tank: {
    name: 'Tanque', cls: 'veh', mover: 'land', cost: 3400, hp: 2200, speed: 1.2, pop: 3, build: 14,
    weapon: { dmg: 140, cd: 2.2, range: 4, proj: 'shell', mult: { inf: 0.9, veh: 1.3, ship: 1, air: 0, bld: 1.5, sub: 0 } },
    desc: 'Blindado y potente. No puede disparar al aire.',
  },
  aa: {
    name: 'Antiaéreo', cls: 'veh', mover: 'land', cost: 2400, hp: 900, speed: 1.8, pop: 2, build: 10,
    weapon: { dmg: 70, cd: 0.9, range: 5, proj: 'flak', mult: { inf: 0, veh: 0, ship: 0, air: 2.4, bld: 0, sub: 0 } },
    desc: 'Solo dispara a unidades aéreas, pero las destroza.',
  },
  speedboat: {
    name: 'Lancha', cls: 'ship', mover: 'sea', cost: 1400, hp: 650, speed: 2.8, pop: 1, build: 8,
    weapon: { dmg: 22, cd: 0.45, range: 3, proj: 'bullet', mult: { inf: 1.2, veh: 0.6, ship: 0.8, air: 0.4, bld: 0.5, sub: 0 } },
    desc: 'Barco rápido y ligero.',
  },
  boatEng: {
    name: 'Barco ingeniero', cls: 'ship', mover: 'sea', cost: 1600, hp: 500, speed: 2.2, pop: 1, build: 8,
    founds: 'sea', desc: 'Funda puestos avanzados en otras islas.',
  },
  destroyer: {
    name: 'Destructor', cls: 'ship', mover: 'sea', cost: 4500, hp: 2800, speed: 1.3, pop: 3, build: 16,
    weapon: { dmg: 120, cd: 1.7, range: 5, proj: 'shell', mult: { inf: 1, veh: 1, ship: 1.2, air: 0.3, bld: 1.3, sub: 1.4 } },
    desc: 'Cañón de largo alcance. Puede atacar la costa y submarinos.',
  },
  sub: {
    name: 'Submarino', cls: 'sub', mover: 'sea', cost: 3800, hp: 1400, speed: 1.6, pop: 2, build: 14,
    weapon: { dmg: 240, cd: 3, range: 3, proj: 'torpedo', waterOnly: true, mult: { ship: 1.5, sub: 1, bld: 1.5 } },
    desc: 'Torpedos contra barcos y edificios en el agua. Solo destructores y helicópteros pueden dañarlo.',
  },
  heli: {
    name: 'Helicóptero', cls: 'air', mover: 'air', cost: 5500, hp: 1500, speed: 2.4, pop: 2, build: 18,
    losBlock: true,
    weapon: { dmg: 60, cd: 0.8, range: 4, proj: 'rocket', mult: { inf: 1.2, veh: 1.2, ship: 1, air: 1, bld: 1, sub: 0.8 } },
    desc: 'Vuela sobre todo. Montañas y bosques le reducen el alcance a 2.',
  },
};

for (const [k, d] of Object.entries(BUILDINGS)) d.key = k;
for (const [k, d] of Object.entries(UNITS)) d.key = k;

const MODES = {
  duel: { name: 'Duelo', desc: 'Tú contra 1 rival', players: 2, teams: [0, 1] },
  ffa: { name: 'Todos contra todos', desc: '4 imperios, gana el último', players: 4, teams: [0, 1, 2, 3] },
  teams: { name: 'Equipos 2 vs 2', desc: 'Con Rojo como aliado', players: 4, teams: [0, 0, 1, 1] },
  big: { name: 'Gran batalla', desc: '6 imperios, mapa lleno', players: 6, teams: [0, 1, 2, 3, 4, 5] },
};

const MAPS = {
  archipelago: { name: 'Archipiélago', desc: 'Islas unidas por puentes de arena' },
  open: { name: 'Mar abierto', desc: 'Sin puentes: necesitas barcos o helicópteros' },
  continent: { name: 'Continente', desc: 'Una gran isla con lagos' },
};

const DIFFICULTY = {
  easy: { name: 'Fácil', income: 0.75, think: 3.0, firstWave: 260, wave: 8 },
  normal: { name: 'Normal', income: 1.0, think: 1.8, firstWave: 200, wave: 7 },
  hard: { name: 'Difícil', income: 1.3, think: 1.1, firstWave: 120, wave: 6 },
};

const OBJECTIVES = [
  { id: 'farm', text: 'Construye una Granja' },
  { id: 'barracks', text: 'Construye un Cuartel' },
  { id: 'army', text: 'Ten 5 tropas de combate' },
  { id: 'outpost', text: 'Funda un Puesto avanzado con un Ingeniero' },
  { id: 'kill', text: 'Destruye un Núcleo enemigo' },
];
