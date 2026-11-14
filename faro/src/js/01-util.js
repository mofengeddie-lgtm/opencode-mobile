'use strict';
// Utilidades: azar con semilla, matemática hexagonal, ruido y montículo binario.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hexágonos de cara plana con coordenadas axiales (q, r). Radio de casilla = 1.
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

function hexDist(aq, ar, bq, br) {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function hexToWorld(q, r) {
  return { x: 1.5 * q, z: SQ3 * (r + q / 2) };
}

function hexRound(q, r) {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function worldToHex(x, z) {
  return hexRound((2 / 3) * x, (-1 / 3) * x + (SQ3 / 3) * z);
}

// Desplazamientos ordenados por distancia, para buscar casillas libres en espiral.
const SPIRAL = (() => {
  const out = [];
  const R = 9;
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      const d = hexDist(0, 0, q, r);
      if (d <= R) out.push({ q, r, d });
    }
  }
  out.sort((a, b) => a.d - b.d || a.q - b.q || a.r - b.r);
  return out;
})();

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x, z, seed) {
  return valueNoise(x, z, seed) * 0.6 + valueNoise(x * 2.1, z * 2.1, seed + 7) * 0.3 +
    valueNoise(x * 4.3, z * 4.3, seed + 13) * 0.1;
}

class MinHeap {
  constructor() {
    this.items = [];
    this.prio = [];
  }

  get size() {
    return this.items.length;
  }

  push(item, p) {
    const it = this.items;
    const pr = this.prio;
    let i = it.length;
    it.push(item);
    pr.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      it[i] = it[parent];
      pr[i] = pr[parent];
      i = parent;
    }
    it[i] = item;
    pr[i] = p;
  }

  pop() {
    const it = this.items;
    const pr = this.prio;
    const top = it[0];
    const lastI = it.pop();
    const lastP = pr.pop();
    const n = it.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        let mp = lastP;
        if (l < n && pr[l] < mp) { m = l; mp = pr[l]; }
        if (r < n && pr[r] < mp) { m = r; mp = pr[r]; }
        if (m === i) break;
        it[i] = it[m];
        pr[i] = pr[m];
        i = m;
      }
      it[i] = lastI;
      pr[i] = lastP;
    }
    return top;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function fmt(n) {
  return Math.floor(n).toLocaleString('es-ES');
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function hexColor(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// Escudos en 3 etapas (v0.9): azul = bien, amarillo = a medias, rojo = débil.
function SHIELD_CSS(k) {
  return k > 0.66 ? '#4aa8ff' : k > 0.33 ? '#f2c94c' : '#ef5350';
}
function SHIELD_HEX(k) {
  return k > 0.66 ? 0x4aa8ff : k > 0.33 ? 0xf2c94c : 0xef5350;
}
