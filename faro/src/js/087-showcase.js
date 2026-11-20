'use strict';
// v1.8: «Tu ejército» detrás del vestíbulo. La partida de fondo arma tu base con edificios y un desfile de
// tropas, vehículos, barcos y aeronaves, como la imagen del sitio y la pantalla 02 de la UI 0.4 del usuario.
// Es solo para mirar: los bots no juegan, nadie dispara y la partida de fondo no avanza.

const SHOWCASE = {
  // Edificios alrededor del Núcleo (tipo y nivel). Los que no caben en el mapa elegido se saltan.
  buildings: [['barracks', 2], ['factory', 2], ['helipad', 1], ['airport', 1], ['turret', 3], ['aadef', 2], ['house', 2],
    ['wind', 1], ['hospital', 2], ['radarstation', 1], ['watchtower', 1], ['bunker', 1], ['depot', 1], ['dronecenter', 1],
    ['harbor', 1], ['shipyard', 1], ['farm', 1]],
  land: 26, sea: 7, air: 7,
  // Con «Más fluido» o «Ahorro de batería», un desfile más chico.
  low: 0.55,
  // Siempre en el desfile: la cara del ejército (también de las tropas nuevas).
  featured: ['soldier', 'rifle', 'ranger', 'marine', 'officer', 'tank', 'heavytank', 'ifv', 'howitzer', 'apache', 'fighter', 'destroyer', 'corvette'],
};

const Showcase = {
  // Arma la escena en la partida g. Devuelve cuántas tropas desfilan.
  build(g, opts = {}) {
    g.showcase = true;
    g.bots = [];
    const p = g.players[0];
    const core = p.core;
    const home = g.cells[core.cell];
    core.level = 3;
    core.maxHp = g.bMaxHp(core.def, 3);
    core.hp = core.maxHp;
    const rng = mulberry32((g.opts.seed || 1) + 991);
    const shuffle = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    // Edificios: en la casilla libre de tu territorio más cercana al Núcleo.
    const free = (t) => g.cells.filter((c) => !g.placeInvalid(0, t, c.i, true))
      .sort((a, b) => g.map.dist(a, home) - g.map.dist(b, home))[0];
    for (const [t, lv] of SHOWCASE.buildings) {
      const c = free(t);
      if (!c) continue;
      const b = g.addBuilding(0, t, c.i, true);
      b.level = Math.min(lv, b.def.maxLevel);
      b.maxHp = g.bMaxHp(b.def, b.level);
      b.hp = b.maxHp;
    }
    // Tropas: las fijas y el resto al azar (cambian cada vez que vuelves al vestíbulo).
    const k = opts.low ? SHOWCASE.low : 1;
    const isAir = (d) => d.mover === 'air';
    const isSea = (d) => d.mover === 'sea' || (d.mover === 'amphib' && d.cls === 'ship');
    const ok = (key) => !UNITS[key].strategic && key !== 'builder';
    const pick = (test, n) => {
      const fixed = SHOWCASE.featured.filter((t) => test(UNITS[t]));
      const rest = shuffle(Object.keys(UNITS).filter((t) => ok(t) && test(UNITS[t]) && !fixed.includes(t)));
      return [...fixed, ...rest].slice(0, Math.max(1, Math.round(n * k)));
    };
    const landT = pick((d) => !isAir(d) && !isSea(d), SHOWCASE.land)
      .sort((a, b) => (UNITS[a].cls === 'inf' ? 0 : 1) - (UNITS[b].cls === 'inf' ? 0 : 1));
    const seaT = pick(isSea, SHOWCASE.sea);
    const airT = pick(isAir, SHOWCASE.air);
    const face = Math.atan2(home.x, home.z);
    let n = 0;
    const place = (types, cells) => {
      types.forEach((t, i) => {
        if (cells[i] === undefined) return;
        const u = g.addUnit(0, t, cells[i]);
        u.yaw = face + (rng() - 0.5) * 0.5;
        n++;
      });
    };
    const landCells = g.freeCellsNear(home.i, 'land', 0, landT.length + 6).filter((ci) => ci !== home.i);
    place(landT, [...new Set(landCells)]);
    if (seaT.length) {
      const seaCells = [...new Set(g.freeCellsNear(home.i, 'sea', 0, seaT.length * 2))].filter((_, i) => i % 2 === 0);
      if (seaCells.length && TERRAIN[g.cells[seaCells[0]].t].water) place(seaT, seaCells);
    }
    // Aeronaves: sobre la base, un poco más afuera que las tropas.
    const ring = g.cells.filter((c) => {
      const d = g.map.dist(c, home);
      return d >= 2 && d <= 4;
    });
    place(airT, shuffle(ring.map((c) => c.i)));
    g.showcaseCount = n;
    return n;
  },
};
