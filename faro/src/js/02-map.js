'use strict';
// Generación del mapa hexagonal, pasabilidad y búsqueda de caminos (A*).

class GameMap {
  constructor(seed, kind, nPlayers) {
    this.seed = seed;
    this.kind = kind;
    this.n = nPlayers;
    this.R = nPlayers > 4 ? 22 : 21;
    this.cells = [];
    this.lookup = new Map();
    this.homes = [];
    this.points = [];
    this.startFarms = [];
    this.hubs = [];
    this.generate();
  }

  key(q, r) {
    return (q + 50) * 128 + (r + 50);
  }

  get(q, r) {
    const i = this.lookup.get(this.key(q, r));
    return i === undefined ? null : this.cells[i];
  }

  atWorld(x, z) {
    const h = worldToHex(x, z);
    return this.get(h.q, h.r);
  }

  dist(a, b) {
    return hexDist(a.q, a.r, b.q, b.r);
  }

  generate() {
    const rng = mulberry32(this.seed);
    const seed = this.seed;
    const R = this.R;
    const n = this.n;
    const kind = this.kind;

    for (let q = -R; q <= R; q++) {
      for (let r = -R; r <= R; r++) {
        if (hexDist(0, 0, q, r) > R) continue;
        const w = hexToWorld(q, r);
        const cell = {
          i: this.cells.length, q, r, x: w.x, z: w.z, t: 'deep', h: 0, land: false,
          owner: -1, ownerD: 99, ownerId: 0, bld: null, nb: [], comp: -1, bridge: false,
        };
        this.lookup.set(this.key(q, r), cell.i);
        this.cells.push(cell);
      }
    }
    for (const c of this.cells) {
      for (const [dq, dr] of HEX_DIRS) {
        const nb = this.get(c.q + dq, c.r + dr);
        if (nb) c.nb.push(nb.i);
      }
    }

    // Islas: una por jugador en un anillo, una central y varias pequeñas.
    const ringHex = n > 4 ? 15 : 14;
    const ring = ringHex * SQ3;
    const a0 = rng() * Math.PI * 2;
    const blobs = [];
    const homePos = [];
    const homeXZ = [];
    if (kind === 'reef') {
      // Arrecife Doble: dos grupos de islas, uno a cada lado, separados por agua navegable.
      const side = [[], []];
      for (let i = 0; i < n; i++) side[i % 2].push(i);
      for (let g = 0; g < 2; g++) {
        const sx = g === 0 ? -1 : 1;
        const k = side[g].length;
        side[g].forEach((pid, j) => {
          const zz = k === 1 ? 0 : (j - (k - 1) / 2) * (ring * (k === 2 ? 1.1 : 0.72));
          homeXZ[pid] = [sx * ring * 0.82, zz];
        });
        this.hubs.push({ x: sx * ring * 0.42, z: 0 });
      }
    } else {
      for (let i = 0; i < n; i++) {
        let ang = a0 + (i * Math.PI * 2) / n;
        let rad = ring;
        if (kind === 'bay') {
          // Bahía Gris: posiciones irregulares.
          ang += (rng() - 0.5) * 0.55;
          rad *= 0.86 + rng() * 0.2;
        }
        homeXZ[i] = [Math.cos(ang) * rad, Math.sin(ang) * rad];
      }
    }
    for (let i = 0; i < n; i++) {
      const cell = this.atWorld(homeXZ[i][0], homeXZ[i][1]);
      this.homes.push(cell.i);
      homePos.push({ x: cell.x, z: cell.z, ang: Math.atan2(cell.z, cell.x) });
      blobs.push({ x: cell.x, z: cell.z, r: 4.8 * SQ3 });
    }
    const centerR = kind === 'open' || kind === 'reef' ? 3.2 : 4.3;
    blobs.push({ x: 0, z: 0, r: centerR * SQ3 });
    const small = [];
    const addSmall = (ang, dist, rad) => {
      const c = this.atWorld(Math.cos(ang) * dist * SQ3, Math.sin(ang) * dist * SQ3);
      if (!c) return;
      small.push({ x: c.x, z: c.z, r: rad * SQ3, i: c.i });
      blobs.push(small[small.length - 1]);
    };
    if (kind === 'reef') {
      for (const h of this.hubs) {
        const c = this.atWorld(h.x, h.z);
        small.push({ x: c.x, z: c.z, r: 2.6 * SQ3, i: c.i, hub: true });
        blobs.push(small[small.length - 1]);
      }
      addSmall(Math.PI / 2, ringHex * 0.78, 1.8);
      addSmall(-Math.PI / 2, ringHex * 0.78, 1.8);
    } else if (n === 2) {
      addSmall(a0 + Math.PI / 2, 10, 2.4);
      addSmall(a0 - Math.PI / 2, 10, 2.4);
      addSmall(a0 + Math.PI / 2, 17, 1.7);
      addSmall(a0 - Math.PI / 2, 17, 1.7);
    } else {
      for (let i = 0; i < n; i++) {
        const ang = a0 + ((i + 0.5) * Math.PI * 2) / n;
        addSmall(ang, ringHex + 1, 1.9);
        if (kind !== 'continent') addSmall(ang, 8.6, 1.5);
      }
      if (kind === 'bay') {
        for (let k = 0; k < 3; k++) addSmall(rng() * Math.PI * 2, 6 + rng() * 10, 1.3 + rng() * 0.6);
      }
    }

    // Valor de tierra por casilla.
    const lakes = [];
    if (kind === 'continent') {
      for (let i = 0; i < n; i++) {
        const ang = a0 + ((i + 0.5) * Math.PI * 2) / n;
        lakes.push({ x: Math.cos(ang) * ring * 0.92, z: Math.sin(ang) * ring * 0.92, r: 2.7 * SQ3 });
      }
    }
    const bigR = (ringHex + 5.5) * SQ3;
    for (const c of this.cells) {
      const noise = (fbm(c.x * 0.17 + 100, c.z * 0.17, seed) - 0.5) * 0.6;
      let v;
      if (kind === 'continent') {
        v = 1 - Math.hypot(c.x, c.z) / bigR + noise;
        for (const l of lakes) {
          const d = Math.hypot(c.x - l.x, c.z - l.z) / l.r;
          if (d + noise * 0.8 < 1) v = -1;
        }
      } else {
        v = -1;
        for (const b of blobs) v = Math.max(v, 1 - Math.hypot(c.x - b.x, c.z - b.z) / b.r);
        v += noise;
      }
      c.land = v > 0.08;
      if (hexDist(0, 0, c.q, c.r) >= R - 1) c.land = false;
    }
    // El centro de cada isla de inicio siempre es tierra firme.
    for (const hi of this.homes) {
      const h = this.cells[hi];
      for (const c of this.cells) if (this.dist(c, h) <= 2) c.land = true;
    }
    if (kind !== 'continent') {
      for (const s of small) {
        const sc = this.cells[s.i];
        sc.land = true;
      }
      const cc = this.get(0, 0);
      for (const c of this.cells) if (this.dist(c, cc) <= 1) c.land = true;
    }

    // Puentes de arena: hacia la isla central (Archipiélago; en Bahía Gris solo algunos)
    // o hacia el centro de cada grupo (Arrecife Doble).
    const bridge = (ax, az, bx, bz) => {
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz || 1;
      for (const c of this.cells) {
        const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / len2, 0, 1);
        const d = Math.hypot(c.x - (ax + dx * t), c.z - (az + dz * t));
        if (d <= 0.95 && !c.land) {
          c.land = true;
          c.bridge = true;
        }
      }
    };
    if (kind === 'archipelago') for (const hp of homePos) bridge(hp.x, hp.z, 0, 0);
    if (kind === 'bay') homePos.forEach((hp, i) => { if (i % 2 === 0) bridge(hp.x, hp.z, 0, 0); });
    if (kind === 'reef') homePos.forEach((hp, i) => { const h = this.hubs[i % 2]; bridge(hp.x, hp.z, h.x, h.z); });

    // Bahía: agua dentro del territorio inicial para poder construir un puerto.
    homePos.forEach((hp, idx) => {
      const home = this.cells[this.homes[idx]];
      const ox = Math.cos(hp.ang);
      const oz = Math.sin(hp.ang);
      let best = null;
      let bestD = Infinity;
      for (const c of this.cells) {
        if (this.dist(c, home) !== 4) continue;
        const d = Math.hypot(c.x - (home.x + ox * 4 * SQ3), c.z - (home.z + oz * 4 * SQ3));
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best) {
        best.land = false;
        best.bridge = false;
        for (const ni of best.nb) {
          const nc = this.cells[ni];
          if (this.dist(nc, home) >= 4) { nc.land = false; nc.bridge = false; }
        }
      }
      hp.bay = best;
    });

    // Agua: poco profunda cerca de la costa, profunda lejos.
    const waterDist = this.bfsDistance((c) => c.land);
    for (const c of this.cells) {
      if (!c.land) c.t = waterDist[c.i] <= 2 ? 'shallow' : 'deep';
      else {
        const coastal = c.nb.some((ni) => !this.cells[ni].land);
        c.t = c.bridge || coastal ? 'sand' : 'grass';
      }
    }

    const nearHome = (c, d) => this.homes.some((hi) => this.dist(c, this.cells[hi]) <= d);
    const cc0 = this.get(0, 0);
    for (const c of this.cells) {
      if (c.t !== 'grass' || nearHome(c, 2)) continue;
      if (fbm(c.x * 0.3 + 40, c.z * 0.3 - 20, seed + 11) > 0.66 && this.dist(c, cc0) > 2) c.t = 'mount';
      else if (fbm(c.x * 0.36 - 60, c.z * 0.36 + 10, seed + 3) > 0.58) c.t = 'forest';
    }

    // Vetas de oro.
    const pick = (list, k) => {
      const out = [];
      const pool = list.slice();
      while (out.length < k && pool.length) {
        const i = Math.floor(rng() * pool.length);
        const c = pool.splice(i, 1)[0];
        if (out.some((o) => this.dist(o, c) <= 1)) continue;
        out.push(c);
      }
      return out;
    };
    for (const hi of this.homes) {
      const h = this.cells[hi];
      const cand = this.cells.filter((c) => c.land && !c.bridge && this.dist(c, h) === 3 && c.t !== 'mount');
      for (const c of pick(cand, 2)) c.t = 'gold';
    }
    if (kind !== 'continent') {
      const cand = this.cells.filter((c) => c.land && !c.bridge && this.dist(c, cc0) <= 2 && this.dist(c, cc0) > 0);
      for (const c of pick(cand, 3)) c.t = 'gold';
    } else {
      for (let i = 0; i < n; i++) {
        const ang = a0 + ((i + 0.5) * Math.PI * 2) / n;
        const c = this.atWorld(Math.cos(ang) * ring * 0.55, Math.sin(ang) * ring * 0.55);
        if (c && c.land) c.t = 'gold';
      }
      const cand = this.cells.filter((c) => c.land && this.dist(c, cc0) <= 2);
      for (const c of pick(cand, 3)) c.t = 'gold';
    }
    // Islas pequeñas: bandera en el centro y una veta de oro al lado.
    for (const s of small) {
      const sc = this.cells[s.i];
      if (!sc.land || this.points.some((pt) => this.dist(this.cells[pt.cell], sc) < 4)) continue;
      if (this.homes.some((hi) => this.dist(this.cells[hi], sc) < 6)) continue;
      sc.t = 'grass';
      this.points.push({ type: 'flag', cell: sc.i });
      const nb = sc.nb.map((ni) => this.cells[ni]).find((c) => c.land && !c.bridge);
      if (nb) nb.t = 'gold';
    }

    // Lugares de recursos: tierra fértil (Granjas) y petróleo en tierra (Bombas).
    const spot = (center, dmin, dmax, k, type, loose = false) => {
      const cand = this.cells.filter((c) => (c.t === 'grass' || (loose && (c.t === 'forest' || c.t === 'sand'))) &&
        !c.bridge && this.dist(c, center) >= dmin &&
        this.dist(c, center) <= dmax && !this.points.some((pt) => pt.cell === c.i) && c.i !== center.i);
      const got = pick(cand, k);
      for (const c of got) c.t = type;
      return got;
    };
    // Tierra fértil en zonas grandes (v0.9): dos manchas de hasta 4 casillas juntas por base.
    const patch = (center, dmin, dmax) => {
      const seeds = spot(center, dmin, dmax, 1, 'fertile');
      for (const sc of seeds) {
        const nb = sc.nb.map((ni) => this.cells[ni]).filter((c) => c.t === 'grass' && !c.bridge && c.i !== center.i &&
          !this.points.some((pt) => pt.cell === c.i) && !this.homes.includes(c.i));
        for (const c of nb.slice(0, 3)) c.t = 'fertile';
      }
    };
    for (const hi of this.homes) {
      const h = this.cells[hi];
      const first = spot(h, 2, 2, 1, 'fertile');
      this.startFarms.push(first.length ? first[0].i : -1);
      spot(h, 2, 4, 3, 'fertile');
      patch(h, 3, 4);
      patch(h, 3, 5);
      // Al menos 8 casillas fértiles a 4 de cada Núcleo (si el agua tapó una mancha, se completa al lado).
      const fert = () => this.cells.filter((c) => c.t === 'fertile' && this.dist(c, h) <= 4).length;
      for (let tries = 0; tries < 3 && fert() < 8; tries++) patch(h, 2, 4);
      if (fert() < 8) spot(h, 2, 4, 8 - fert(), 'fertile', true);
      if (!spot(h, 3, 4, 1, 'oilland').length) spot(h, 2, 4, 1, 'oilland', true);
    }
    const hubCells = small.filter((s) => s.hub).map((s) => this.cells[s.i]);
    for (const hc of hubCells) {
      spot(hc, 1, 2, 2, 'fertile');
      spot(hc, 1, 2, 1, 'oilland');
    }
    if (kind !== 'continent') {
      spot(cc0, 1, 3, 3, 'fertile');
      spot(cc0, 1, 3, 2, 'oilland');
    } else {
      for (let i = 0; i < n; i++) {
        const ang = a0 + ((i + 0.5) * Math.PI * 2) / n;
        const c = this.atWorld(Math.cos(ang) * ring * 0.45, Math.sin(ang) * ring * 0.45);
        if (c) { spot(c, 0, 2, 2, 'fertile'); spot(c, 0, 2, 1, 'oilland'); }
      }
    }

    // Manchas de petróleo junto a islas pequeñas, la isla central y fuera de cada bahía.
    const waterNear = (center, dmin, dmax) => this.cells.filter((c) => !c.land && c.t !== 'oil' &&
      this.dist(c, center) >= dmin && this.dist(c, center) <= dmax && waterDist[c.i] <= 2);
    for (const s of small) pick(waterNear(this.cells[s.i], 2, 3), 1).forEach((c) => { c.t = 'oil'; });
    if (kind !== 'continent') pick(waterNear(cc0, centerR + 1, centerR + 3), 2).forEach((c) => { c.t = 'oil'; });
    homePos.forEach((hp) => {
      if (!hp.bay) return;
      const target = this.atWorld(hp.bay.x + Math.cos(hp.ang) * 1.6 * SQ3, hp.bay.z + Math.sin(hp.ang) * 1.6 * SQ3);
      if (target && !target.land) target.t = 'oil';
    });
    for (const l of lakes) {
      const c = this.atWorld(l.x, l.z);
      if (c && !c.land) c.t = 'oil';
    }

    // Banderas: tierra fértil y petróleo cerca, para que valga la pena tomarlas.
    for (const pt of this.points) {
      const pc = this.cells[pt.cell];
      spot(pc, 1, 2, 2, 'fertile');
      spot(pc, 1, 2, 1, 'oilland');
    }

    // Continente: banderas entre las bases, a medio camino del centro.
    if (kind === 'continent') {
      for (let i = 0; i < n; i++) {
        const ang = a0 + ((i + 0.5) * Math.PI * 2) / n;
        for (const k of [0.7, 0.62, 0.78]) {
          const c = this.atWorld(Math.cos(ang) * ring * k, Math.sin(ang) * ring * k);
          if (!c || !c.land || c.t === 'gold' || c.t === 'mount') continue;
          if (this.points.some((pt) => this.dist(this.cells[pt.cell], c) < 4)) continue;
          if (this.homes.some((hi) => this.dist(this.cells[hi], c) < 6)) continue;
          c.t = 'grass';
          this.points.push({ type: 'flag', cell: c.i });
          break;
        }
      }
    }

    // El Faro ocupa el centro del mapa.
    const center = this.get(0, 0);
    center.land = true;
    center.bridge = false;
    center.t = 'grass';
    for (const ni of center.nb) {
      const c = this.cells[ni];
      if (c.t === 'mount' || c.t === 'gold' || c.t === 'fertile' || c.t === 'oilland') c.t = 'grass';
    }
    this.points.unshift({ type: 'faro', cell: center.i });

    for (const c of this.cells) c.h = TERRAIN[c.t].h;
    this.computeComponents();

    // Garantiza los caminos a pie que el mapa promete (al centro, o al centro de cada grupo).
    if (kind === 'archipelago' || kind === 'continent' || kind === 'reef' || kind === 'bay') {
      const target = this.get(0, 0).comp;
      const bad = kind === 'reef'
        ? this.homes.some((hi, i) => this.cells[hi].comp !== this.atWorld(this.hubs[i % 2].x, this.hubs[i % 2].z).comp)
        : kind === 'bay'
          ? this.homes.some((hi, i) => i % 2 === 0 && this.cells[hi].comp !== target)
          : this.homes.some((hi) => this.cells[hi].comp !== target);
      if (bad) {
        for (const c of this.cells) if (c.t === 'mount') { c.t = 'forest'; c.h = TERRAIN.forest.h; }
        this.computeComponents();
      }
    }
  }

  bfsDistance(isSource) {
    const dist = new Int32Array(this.cells.length).fill(999);
    const queue = [];
    for (const c of this.cells) if (isSource(c)) { dist[c.i] = 0; queue.push(c.i); }
    for (let h = 0; h < queue.length; h++) {
      const ci = queue[h];
      for (const ni of this.cells[ci].nb) {
        if (dist[ni] > dist[ci] + 1) { dist[ni] = dist[ci] + 1; queue.push(ni); }
      }
    }
    return dist;
  }

  // Componentes conexas: tierra (sin montañas) y agua por separado.
  computeComponents() {
    for (const c of this.cells) c.comp = -1;
    let id = 0;
    for (const c of this.cells) {
      if (c.comp !== -1 || c.t === 'mount') continue;
      const isLand = TERRAIN[c.t].land === true;
      const stack = [c.i];
      c.comp = id;
      while (stack.length) {
        const ci = stack.pop();
        for (const ni of this.cells[ci].nb) {
          const nc = this.cells[ni];
          if (nc.comp !== -1 || nc.t === 'mount') continue;
          if ((TERRAIN[nc.t].land === true) !== isLand) continue;
          nc.comp = id;
          stack.push(ni);
        }
      }
      id++;
    }
  }

  isCoast(c) {
    return TERRAIN[c.t].water && c.nb.some((ni) => TERRAIN[this.cells[ni].t].land);
  }
}
