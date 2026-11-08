'use strict';
// Modelos 3D de bajo polígono hechos con formas simples y fusionados en una sola
// geometría por tipo y color de jugador (menos llamadas de dibujo en el iPad).

const PAL = {
  stone: 0x8f8b82, dark: 0x3b4048, metal: 0x6e7782, wood: 0x8b5d3c, white: 0xefece4,
  olive: 0x5d6d3b, skin: 0xe0b089, yellow: 0xf1c232, field: 0xc9a54b, crop: 0x8dbf3d,
  brick: 0xb3653b, red: 0xd94141, gray: 0x8b939c, black: 0x24272c, orange: 0xf08a24,
  concrete: 0xb5b2aa, glass: 0x9fd6ee,
};

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  prism: new THREE.CylinderGeometry(1, 1, 1, 3),
  sphere: new THREE.SphereGeometry(1, 8, 6),
  half: new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, 0, Math.PI),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
  octa: new THREE.OctahedronGeometry(1, 0),
};

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();

class PartBuilder {
  constructor() {
    this.parts = [];
  }

  add(geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4();
    m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    this.parts.push({ g: geo, c: color, m });
    return this;
  }

  // Caja apoyada en y (la base queda en y).
  box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) {
    return this.add(GEO.box, color, x, y + h / 2, z, w, h, d, 0, ry, 0);
  }

  cyl(r, h, color, x = 0, y = 0, z = 0, geo = GEO.cyl8) {
    // Los prismas de 6 lados se giran 30° para alinearse con las casillas.
    const ry = geo === GEO.cyl6 ? Math.PI / 6 : 0;
    return this.add(geo, color, x, y + h / 2, z, r, h, r, 0, ry, 0);
  }

  // Tejado a dos aguas a lo largo del eje x, con la base en yBase.
  roof(len, halfDepth, height, color, x, yBase, z) {
    return this.add(GEO.prism, color, x, yBase + height * 0.5, z, halfDepth / 0.866, len, height,
      -Math.PI / 2, 0, Math.PI / 2);
  }

  build() {
    const pos = [];
    const nor = [];
    const col = [];
    const tmp = new THREE.Color();
    for (const p of this.parts) {
      const g = (p.g.index ? p.g.toNonIndexed() : p.g.clone()).applyMatrix4(p.m);
      const pa = g.attributes.position;
      const na = g.attributes.normal;
      tmp.set(p.c);
      for (let i = 0; i < pa.count; i++) {
        pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        nor.push(na.getX(i), na.getY(i), na.getZ(i));
        col.push(tmp.r, tmp.g, tmp.b);
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return geo;
  }
}

function shade(color, f) {
  const c = new THREE.Color(color);
  if (f >= 0) c.lerp(new THREE.Color(0xffffff), f);
  else c.multiplyScalar(1 + f);
  return c.getHex();
}

const MODEL_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0.05 });

// Cada constructor devuelve { main, turret?, turretY?, rotor?, rotorY?, crystal? } en geometrías.
const MODEL_BUILDERS = {
  core(tc) {
    const b = new PartBuilder();
    b.cyl(0.98, 0.22, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.78, 0.2, PAL.dark, 0, 0.22, 0, GEO.cyl6);
    b.cyl(0.36, 0.5, shade(tc, -0.25), 0, 0.42, 0, GEO.cyl6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      b.box(0.16, 0.55, 0.16, i % 2 ? tc : shade(tc, 0.35), Math.cos(a) * 0.72, 0.4, Math.sin(a) * 0.72, -a);
    }
    const c = new PartBuilder();
    c.add(GEO.box, tc, 0, 0, 0, 0.5, 0.5, 0.5, Math.PI / 4, 0, Math.PI / 4);
    return { main: b.build(), crystal: c.build(), crystalY: 1.35 };
  },
  farm(tc) {
    const b = new PartBuilder();
    b.box(1.35, 0.05, 1.05, PAL.field, 0.05, 0, 0.1);
    for (let i = 0; i < 5; i++) b.box(1.2, 0.09, 0.09, PAL.crop, 0.1, 0.05, -0.25 + i * 0.17);
    b.box(0.42, 0.34, 0.4, PAL.red, -0.48, 0, -0.42);
    b.roof(0.48, 0.24, 0.2, tc, -0.48, 0.34, -0.42);
    b.cyl(0.11, 0.55, PAL.white, -0.12, 0, -0.5);
    b.add(GEO.cone8, PAL.white, -0.12, 0.62, -0.5, 0.12, 0.14, 0.12);
    return { main: b.build() };
  },
  pump(tc) {
    const b = new PartBuilder();
    b.box(1.2, 0.06, 0.95, PAL.field, 0, 0, 0.05);
    b.box(0.5, 0.08, 0.3, PAL.dark, 0.05, 0.06, -0.05);
    b.add(GEO.box, PAL.metal, 0.05, 0.42, -0.17, 0.06, 0.75, 0.06, 0.3, 0, 0);
    b.add(GEO.box, PAL.metal, 0.05, 0.42, 0.07, 0.06, 0.75, 0.06, -0.3, 0, 0);
    b.box(0.3, 0.08, 0.06, PAL.metal, 0.05, 0.74, -0.05);
    b.cyl(0.2, 0.42, tc, -0.42, 0, -0.32);
    b.cyl(0.21, 0.04, PAL.white, -0.42, 0.42, -0.32);
    b.cyl(0.05, 0.3, PAL.dark, 0.05, 0.06, 0.42);
    b.box(0.04, 0.85, 0.04, PAL.dark, 0.5, 0, -0.38);
    b.box(0.26, 0.15, 0.02, tc, 0.64, 0.66, -0.38);
    const r = new PartBuilder();
    r.box(0.08, 0.08, 0.95, PAL.yellow, 0, -0.04, 0.1);
    r.add(GEO.box, PAL.yellow, 0, -0.12, 0.6, 0.1, 0.26, 0.16, 0.35, 0, 0);
    r.box(0.14, 0.14, 0.18, PAL.dark, 0, -0.07, -0.42);
    return { main: b.build(), rocker: r.build(), rockerY: 0.82, rockerZ: -0.05 };
  },
  mill(tc) {
    const b = new PartBuilder();
    b.cyl(0.42, 0.12, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.add(GEO.cyl8, PAL.white, 0, 0.62, 0, 0.26, 1.0, 0.26);
    b.add(GEO.cone8, tc, 0, 1.28, 0, 0.32, 0.32, 0.32);
    b.box(0.16, 0.24, 0.02, PAL.wood, 0, 0.12, 0.27);
    b.box(0.1, 0.1, 0.02, PAL.glass, 0, 0.62, 0.27);
    const r = new PartBuilder();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      r.add(GEO.box, PAL.wood, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0, 0.62, 0.05, 0.02, 0, 0, a);
      r.add(GEO.box, PAL.white, Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.015, 0.46, 0.14, 0.01, 0, 0, a);
    }
    r.add(GEO.cyl8, PAL.dark, 0, 0, 0, 0.06, 0.08, 0.06, Math.PI / 2, 0, 0);
    return { main: b.build(), blades: r.build(), bladesY: 1.0, bladesZ: 0.3 };
  },
  aadef(tc) {
    const b = new PartBuilder();
    b.cyl(0.5, 0.25, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.24, 0.2, PAL.dark, 0, 0.25, 0, GEO.cyl8);
    const t = new PartBuilder();
    t.box(0.5, 0.1, 0.36, PAL.olive, 0, 0, 0);
    t.add(GEO.box, tc, 0, 0.3, 0.02, 0.48, 0.3, 0.5, -0.5, 0, 0);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        t.add(GEO.cyl8, PAL.white, -0.15 + i * 0.15, 0.3 + j * 0.13 - 0.04, 0.28 + j * 0.06, 0.045, 0.06, 0.045, 1.07, 0, 0);
      }
    }
    return { main: b.build(), turret: t.build(), turretY: 0.45 };
  },
  mine(tc) {
    const b = new PartBuilder();
    b.add(GEO.dodeca, PAL.stone, 0, 0.2, 0.05, 0.75, 0.5, 0.65);
    b.box(0.32, 0.3, 0.2, PAL.black, 0, 0.02, 0.55);
    b.box(0.42, 0.06, 0.06, PAL.wood, 0, 0.32, 0.62);
    b.box(0.3, 0.16, 0.22, PAL.yellow, 0.55, 0, 0.45);
    for (let i = 0; i < 4; i++) b.add(GEO.octa, 0xffd23f, -0.35 + i * 0.22, 0.45 + (i % 2) * 0.12, -0.1, 0.08, 0.11, 0.08);
    b.box(0.03, 0.7, 0.03, PAL.dark, -0.6, 0, 0.35);
    b.box(0.25, 0.15, 0.02, tc, -0.48, 0.52, 0.35);
    return { main: b.build() };
  },
  rig(tc) {
    const b = new PartBuilder();
    for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) b.cyl(0.07, 0.75, PAL.yellow, x, -0.3, z);
    b.box(1.25, 0.12, 1.25, PAL.metal, 0, 0.4, 0);
    b.add(GEO.cone4, PAL.gray, -0.2, 1.0, -0.15, 0.32, 1.1, 0.32, 0, Math.PI / 4, 0);
    b.box(0.45, 0.3, 0.35, tc, 0.32, 0.52, 0.3);
    b.box(0.5, 0.04, 0.5, PAL.orange, 0.3, 0.52, -0.35);
    b.cyl(0.04, 0.5, PAL.dark, 0.55, 0.52, -0.55);
    return { main: b.build() };
  },
  house(tc) {
    const b = new PartBuilder();
    b.box(0.62, 0.38, 0.55, PAL.white, 0, 0, 0);
    b.roof(0.7, 0.32, 0.3, tc, 0, 0.38, 0);
    b.box(0.14, 0.22, 0.02, PAL.wood, 0, 0, 0.28);
    b.box(0.12, 0.1, 0.02, PAL.glass, -0.18, 0.15, 0.28);
    b.box(0.12, 0.1, 0.02, PAL.glass, 0.18, 0.15, 0.28);
    b.box(0.32, 0.3, 0.3, shade(PAL.white, -0.08), 0.48, 0, -0.2);
    return { main: b.build() };
  },
  barracks(tc) {
    const b = new PartBuilder();
    b.add(GEO.half, PAL.olive, 0, 0, 0, 0.45, 1.15, 0.45, 0, 0, Math.PI / 2);
    b.box(0.04, 0.3, 0.26, PAL.dark, 0.58, 0, 0);
    b.box(0.04, 0.9, 0.04, PAL.dark, -0.2, 0, 0.6);
    b.box(0.32, 0.2, 0.02, tc, -0.03, 0.66, 0.6);
    for (let i = 0; i < 3; i++) b.box(0.2, 0.1, 0.12, PAL.field, -0.55 + i * 0.2, 0, 0.62);
    b.box(0.2, 0.18, 0.2, PAL.olive, -0.62, 0, -0.5);
    return { main: b.build() };
  },
  factory(tc) {
    const b = new PartBuilder();
    b.box(1.15, 0.55, 0.85, PAL.brick, 0, 0, 0);
    b.box(1.16, 0.12, 0.86, tc, 0, 0.42, 0);
    b.box(0.5, 0.36, 0.04, PAL.dark, 0.1, 0, 0.43);
    b.cyl(0.1, 0.9, PAL.gray, -0.4, 0.3, -0.25);
    b.cyl(0.1, 0.75, PAL.gray, -0.15, 0.3, -0.25);
    for (let i = 0; i < 4; i++) b.box(0.16, 0.08, 0.02, 0xffe27a, -0.4 + i * 0.27, 0.3, -0.43);
    return { main: b.build() };
  },
  harbor(tc) {
    const b = new PartBuilder();
    b.box(1.35, 0.22, 1.1, PAL.concrete, 0, -0.08, 0);
    b.box(0.75, 0.42, 0.55, PAL.dark, -0.18, 0.14, -0.18);
    b.box(0.77, 0.08, 0.57, tc, -0.18, 0.56, -0.18);
    for (let i = 0; i < 3; i++) b.box(0.14, 0.06, 0.02, 0xffe27a, -0.4 + i * 0.22, 0.38, 0.1);
    b.box(0.06, 1.0, 0.06, PAL.yellow, 0.48, 0.14, 0.3);
    b.box(0.7, 0.06, 0.06, PAL.yellow, 0.3, 1.1, 0.3);
    b.box(0.08, 0.3, 0.02, PAL.dark, 0.0, 0.84, 0.3);
    return { main: b.build() };
  },
  helipad(tc) {
    const b = new PartBuilder();
    b.cyl(0.88, 0.12, PAL.dark, 0, 0, 0, GEO.cyl12);
    b.box(0.08, 0.02, 0.5, PAL.white, -0.18, 0.12, 0);
    b.box(0.08, 0.02, 0.5, PAL.white, 0.18, 0.12, 0);
    b.box(0.36, 0.02, 0.08, PAL.white, 0, 0.12, 0);
    b.box(0.26, 0.5, 0.26, tc, 0.66, 0, -0.55);
    b.box(0.3, 0.12, 0.3, PAL.glass, 0.66, 0.5, -0.55);
    return { main: b.build() };
  },
  turret(tc) {
    const b = new PartBuilder();
    b.cyl(0.46, 0.28, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.3, 0.22, PAL.dark, 0, 0.28, 0, GEO.cyl8);
    const t = new PartBuilder();
    t.box(0.42, 0.24, 0.42, tc, 0, 0, 0);
    t.add(GEO.cyl8, PAL.metal, -0.08, 0.12, 0.38, 0.05, 0.45, 0.05, Math.PI / 2, 0, 0);
    t.add(GEO.cyl8, PAL.metal, 0.08, 0.12, 0.38, 0.05, 0.45, 0.05, Math.PI / 2, 0, 0);
    return { main: b.build(), turret: t.build(), turretY: 0.5 };
  },
  wall(tc) {
    const b = new PartBuilder();
    b.cyl(0.9, 0.5, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.91, 0.07, tc, 0, 0.5, 0, GEO.cyl6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(0.22, 0.16, 0.22, shade(PAL.stone, 0.1), Math.cos(a) * 0.62, 0.56, Math.sin(a) * 0.62, -a);
    }
    return { main: b.build() };
  },
  hospital(tc) {
    const b = new PartBuilder();
    b.box(0.85, 0.4, 0.62, PAL.white, 0, 0, 0);
    b.box(0.3, 0.03, 0.09, PAL.red, 0, 0.4, 0);
    b.box(0.09, 0.03, 0.3, PAL.red, 0, 0.4, 0);
    b.box(0.2, 0.24, 0.02, PAL.dark, 0, 0, 0.32);
    b.box(0.04, 0.85, 0.04, PAL.dark, 0.58, 0, 0.4);
    b.box(0.26, 0.16, 0.02, tc, 0.72, 0.64, 0.4);
    return { main: b.build() };
  },
  outpost(tc) {
    const b = new PartBuilder();
    b.add(GEO.cone4, tc, -0.15, 0.3, 0, 0.5, 0.6, 0.5, 0, Math.PI / 4, 0);
    b.box(0.04, 1.0, 0.04, PAL.dark, 0.45, 0, -0.2);
    b.box(0.32, 0.18, 0.02, tc, 0.62, 0.78, -0.2);
    b.box(0.22, 0.2, 0.22, PAL.wood, 0.4, 0, 0.35);
    b.box(0.16, 0.14, 0.16, PAL.wood, 0.2, 0, 0.5);
    return { main: b.build() };
  },

  // --- Unidades (miran hacia +z) ---
  soldier(tc, extra) {
    const b = new PartBuilder();
    b.box(0.08, 0.13, 0.08, PAL.dark, -0.05, 0, 0);
    b.box(0.08, 0.13, 0.08, PAL.dark, 0.05, 0, 0);
    b.box(0.2, 0.2, 0.13, tc, 0, 0.13, 0);
    b.add(GEO.sphere, PAL.skin, 0, 0.4, 0, 0.075, 0.075, 0.075);
    const helmet = extra === 'engineer' ? PAL.yellow : extra === 'sniper' ? 0x4f6b2e : PAL.olive;
    b.add(GEO.sphere, helmet, 0, 0.43, 0, 0.085, 0.05, 0.085);
    if (extra === 'engineer') {
      b.box(0.14, 0.1, 0.08, PAL.orange, 0.13, 0.08, 0.05);
    } else if (extra === 'rocket') {
      b.add(GEO.cyl8, PAL.olive, 0.12, 0.33, 0.02, 0.05, 0.42, 0.05, Math.PI / 2, 0, 0);
    } else {
      const len = extra === 'sniper' ? 0.42 : 0.28;
      b.box(0.04, 0.04, len, PAL.black, 0.09, 0.22, 0.1 + len / 3);
    }
    return { main: b.build(), scale: 1.35 };
  },
  jeep(tc) {
    const b = new PartBuilder();
    for (const [x, z] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]]) {
      b.add(GEO.cyl8, PAL.black, x, 0.08, z, 0.08, 0.07, 0.08, 0, 0, Math.PI / 2);
    }
    b.box(0.42, 0.14, 0.7, tc, 0, 0.08, 0);
    b.box(0.38, 0.12, 0.22, PAL.glass, 0, 0.22, 0.05);
    b.box(0.06, 0.12, 0.06, PAL.dark, 0, 0.22, -0.18);
    b.box(0.04, 0.04, 0.3, PAL.black, 0, 0.33, -0.08);
    return { main: b.build(), scale: 1.15 };
  },
  tank(tc) {
    const b = new PartBuilder();
    b.box(0.14, 0.14, 0.82, PAL.black, -0.27, 0, 0);
    b.box(0.14, 0.14, 0.82, PAL.black, 0.27, 0, 0);
    b.box(0.5, 0.16, 0.78, PAL.olive, 0, 0.08, 0);
    b.box(0.52, 0.04, 0.2, tc, 0, 0.24, -0.25);
    const t = new PartBuilder();
    t.box(0.36, 0.15, 0.4, tc, 0, 0, -0.03);
    t.add(GEO.cyl8, PAL.dark, 0, 0.08, 0.38, 0.04, 0.5, 0.04, Math.PI / 2, 0, 0);
    return { main: b.build(), turret: t.build(), turretY: 0.24, scale: 1.15 };
  },
  aa(tc) {
    const b = new PartBuilder();
    for (const [x, z] of [[-0.21, -0.25], [0.21, -0.25], [-0.21, 0.25], [0.21, 0.25]]) {
      b.add(GEO.cyl8, PAL.black, x, 0.08, z, 0.08, 0.07, 0.08, 0, 0, Math.PI / 2);
    }
    b.box(0.44, 0.16, 0.8, PAL.olive, 0, 0.08, 0);
    b.box(0.4, 0.18, 0.22, tc, 0, 0.24, 0.26);
    const t = new PartBuilder();
    t.box(0.26, 0.12, 0.26, tc, 0, 0, 0);
    t.add(GEO.cyl8, PAL.dark, -0.07, 0.18, 0.14, 0.03, 0.4, 0.03, 0.9, 0, 0);
    t.add(GEO.cyl8, PAL.dark, 0.07, 0.18, 0.14, 0.03, 0.4, 0.03, 0.9, 0, 0);
    return { main: b.build(), turret: t.build(), turretY: 0.24, scale: 1.15 };
  },
  arty(tc) {
    const b = new PartBuilder();
    for (const z of [-0.28, 0, 0.28]) {
      for (const x of [-0.22, 0.22]) b.add(GEO.cyl8, PAL.black, x, 0.08, z, 0.08, 0.07, 0.08, 0, 0, Math.PI / 2);
    }
    b.box(0.44, 0.14, 0.86, PAL.olive, 0, 0.08, 0);
    b.box(0.42, 0.2, 0.22, tc, 0, 0.22, 0.32);
    b.box(0.36, 0.08, 0.14, PAL.glass, 0, 0.3, 0.38);
    const t = new PartBuilder();
    t.add(GEO.box, PAL.olive, 0, 0.12, -0.05, 0.38, 0.22, 0.5, -0.35, 0, 0);
    t.add(GEO.box, tc, 0, 0.12, 0.2, 0.39, 0.05, 0.08, -0.35, 0, 0);
    return { main: b.build(), turret: t.build(), turretY: 0.22, turretZ: -0.12, scale: 1.15 };
  },
  barge(tc) {
    const b = new PartBuilder();
    b.box(0.72, 0.16, 1.25, PAL.gray, 0, -0.02, 0);
    b.box(0.08, 0.2, 1.2, shade(PAL.gray, -0.15), -0.34, 0.12, 0);
    b.box(0.08, 0.2, 1.2, shade(PAL.gray, -0.15), 0.34, 0.12, 0);
    b.box(0.64, 0.06, 0.12, PAL.dark, 0, 0.12, 0.6);
    b.box(0.3, 0.26, 0.24, tc, 0.18, 0.12, -0.48);
    b.box(0.2, 0.08, 0.14, PAL.glass, 0.18, 0.3, -0.42);
    b.cyl(0.035, 0.32, PAL.dark, -0.2, 0.12, -0.52);
    return { main: b.build(), scale: 1.2 };
  },
  speedboat(tc) {
    const b = new PartBuilder();
    b.box(0.38, 0.14, 0.75, PAL.white, 0, 0, -0.05);
    b.add(GEO.cone4, PAL.white, 0, 0.07, 0.48, 0.27, 0.36, 0.1, Math.PI / 2, 0, 0);
    b.box(0.4, 0.04, 0.6, tc, 0, 0.1, -0.05);
    b.box(0.22, 0.12, 0.18, PAL.glass, 0, 0.14, 0.05);
    b.box(0.04, 0.04, 0.26, PAL.black, 0, 0.26, 0.15);
    return { main: b.build(), scale: 1.2 };
  },
  boatEng(tc) {
    const b = new PartBuilder();
    b.box(0.5, 0.18, 0.85, PAL.orange, 0, 0, -0.05);
    b.add(GEO.cone4, PAL.orange, 0, 0.09, 0.5, 0.36, 0.3, 0.12, Math.PI / 2, 0, 0);
    b.box(0.3, 0.22, 0.25, tc, 0, 0.18, -0.25);
    b.box(0.05, 0.45, 0.05, PAL.yellow, 0.12, 0.18, 0.18);
    b.box(0.05, 0.05, 0.4, PAL.yellow, 0.12, 0.6, 0.3);
    return { main: b.build(), scale: 1.2 };
  },
  destroyer(tc) {
    const b = new PartBuilder();
    b.box(0.5, 0.2, 1.4, PAL.gray, 0, 0, -0.1);
    b.add(GEO.cone4, PAL.gray, 0, 0.1, 0.78, 0.36, 0.45, 0.14, Math.PI / 2, 0, 0);
    b.box(0.52, 0.05, 1.2, tc, 0, 0.15, -0.15);
    b.box(0.3, 0.26, 0.42, shade(PAL.gray, 0.15), 0, 0.2, -0.3);
    b.box(0.2, 0.18, 0.2, shade(PAL.gray, 0.25), 0, 0.46, -0.32);
    b.cyl(0.07, 0.3, PAL.dark, 0, 0.46, -0.55);
    const t = new PartBuilder();
    t.box(0.24, 0.12, 0.26, shade(PAL.gray, -0.1), 0, 0, 0);
    t.add(GEO.cyl8, PAL.dark, 0, 0.06, 0.26, 0.035, 0.36, 0.035, Math.PI / 2, 0, 0);
    return { main: b.build(), turret: t.build(), turretY: 0.2, turretZ: 0.35, scale: 1.25 };
  },
  sub(tc) {
    const b = new PartBuilder();
    b.add(GEO.cyl8, PAL.black, 0, 0, 0, 0.16, 1.0, 0.16, Math.PI / 2, 0, 0);
    b.add(GEO.sphere, PAL.black, 0, 0, 0.5, 0.16, 0.16, 0.16);
    b.add(GEO.sphere, PAL.black, 0, 0, -0.5, 0.16, 0.16, 0.2);
    b.box(0.12, 0.2, 0.26, tc, 0, 0.1, 0.05);
    b.box(0.3, 0.02, 0.08, PAL.dark, 0, 0.0, -0.5);
    return { main: b.build(), scale: 1.2 };
  },
  heli(tc) {
    const b = new PartBuilder();
    b.add(GEO.sphere, tc, 0, 0.18, 0.05, 0.22, 0.2, 0.36);
    b.add(GEO.sphere, PAL.glass, 0, 0.22, 0.28, 0.15, 0.12, 0.14);
    b.box(0.07, 0.07, 0.6, shade(tc, -0.2), 0, 0.2, -0.45);
    b.box(0.03, 0.18, 0.12, shade(tc, -0.2), 0, 0.26, -0.72);
    b.box(0.03, 0.03, 0.5, PAL.dark, -0.16, -0.02, 0.05);
    b.box(0.03, 0.03, 0.5, PAL.dark, 0.16, -0.02, 0.05);
    b.box(0.5, 0.05, 0.06, PAL.dark, 0, 0.08, 0.05);
    b.box(0.06, 0.05, 0.12, PAL.olive, -0.26, 0.08, 0.05);
    b.box(0.06, 0.05, 0.12, PAL.olive, 0.26, 0.08, 0.05);
    const r = new PartBuilder();
    r.box(1.3, 0.02, 0.07, PAL.dark, 0, 0, 0);
    r.box(0.07, 0.02, 1.3, PAL.dark, 0, 0, 0);
    r.cyl(0.04, 0.08, PAL.dark, 0, -0.06, 0);
    return { main: b.build(), rotor: r.build(), rotorY: 0.42, scale: 1.1 };
  },
};

const UNIT_MODEL = {
  engineer: (tc) => MODEL_BUILDERS.soldier(tc, 'engineer'),
  rifle: (tc) => MODEL_BUILDERS.soldier(tc, 'rifle'),
  sniper: (tc) => MODEL_BUILDERS.soldier(tc, 'sniper'),
  rocket: (tc) => MODEL_BUILDERS.soldier(tc, 'rocket'),
  jeep: (tc) => MODEL_BUILDERS.jeep(tc),
  tank: (tc) => MODEL_BUILDERS.tank(tc),
  aa: (tc) => MODEL_BUILDERS.aa(tc),
  speedboat: (tc) => MODEL_BUILDERS.speedboat(tc),
  boatEng: (tc) => MODEL_BUILDERS.boatEng(tc),
  destroyer: (tc) => MODEL_BUILDERS.destroyer(tc),
  sub: (tc) => MODEL_BUILDERS.sub(tc),
  heli: (tc) => MODEL_BUILDERS.heli(tc),
  arty: (tc) => MODEL_BUILDERS.arty(tc),
  barge: (tc) => MODEL_BUILDERS.barge(tc),
};

// ---------- Modelos de Blender (GLB incrustados) ----------
// Cada GLB trae partes ('main', 'turret', 'rotor', 'blades', 'rocker', 'crystal'); los materiales
// EQUIPO y EQUIPO_OSC se pintan con el color del jugador.
const GLB = {};
const GLB_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.06 });
// v0.9 «Más fluido»: materiales Lambert, mucho más livianos para la tarjeta gráfica del iPad.
const GLB_MAT_FAST = new THREE.MeshLambertMaterial({ vertexColors: true });
const MODEL_MAT_FAST = new THREE.MeshLambertMaterial({ vertexColors: true });
let FAST_MATS = false;
function fastMat(mat, fast) {
  if (fast) return mat === GLB_MAT ? GLB_MAT_FAST : mat === MODEL_MAT ? MODEL_MAT_FAST : mat;
  return mat === GLB_MAT_FAST ? GLB_MAT : mat === MODEL_MAT_FAST ? MODEL_MAT : mat;
}
const PART_NAMES = ['main', 'turret', 'rotor', 'blades', 'rocker', 'crystal', 'legl', 'legr', 'shinl', 'shinr'];
// Caminar y correr de CMU (v0.8): ángulos de cadera y rodilla, inclinación y rebote por ciclo.
const CMU_GAIT = typeof FARO_ANIM !== 'undefined' && FARO_ANIM && FARO_ANIM.walk && FARO_ANIM.run ? FARO_ANIM : null;

function _b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function _readGLB(name, gltf) {
  const model = { parts: {} };
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    // El objeto de Blender se llama como la parte; los meshes con varios materiales cuelgan de él.
    let holder = node;
    while (holder && !PART_NAMES.includes(holder.name.replace(/[._]\d+$/, '')) && holder.parent) holder = holder.parent;
    const part = PART_NAMES.includes((holder.name || '').replace(/[._]\d+$/, '')) ? holder.name.replace(/[._]\d+$/, '') : 'main';
    const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    // Geometría relativa al pivote de la parte.
    const rel = new THREE.Matrix4().copy(holder.matrixWorld).invert().multiply(node.matrixWorld);
    g.applyMatrix4(rel);
    const matName = (node.material && node.material.name) || '';
    const team = matName.startsWith('EQUIPO_OSC') ? 2 : matName.startsWith('EQUIPO') ? 1 : 0;
    const base = node.material && node.material.color ? node.material.color.clone() : new THREE.Color(0xaaaaaa);
    const entry = model.parts[part] || (model.parts[part] = { chunks: [], pos: holder.position.clone() });
    entry.chunks.push({ g, team, base });
  });
  GLB[name] = model;
}

// Carga todos los modelos. Si falta el cargador o algo falla, el juego usa los modelos de código.
function loadGLBModels() {
  if (typeof FARO_GLB === 'undefined' || !THREE.GLTFLoader) return Promise.resolve(0);
  const loader = new THREE.GLTFLoader();
  const names = Object.keys(FARO_GLB);
  return Promise.all(names.map((name) => new Promise((resolve) => {
    try {
      loader.parse(_b64ToBuffer(FARO_GLB[name]), '', (gltf) => {
        try { _readGLB(name, gltf); } catch (err) { console.warn('[Modelos] No se pudo leer', name, err); }
        resolve();
      }, (err) => {
        console.warn('[Modelos] Error en', name, err);
        resolve();
      });
    } catch (err) {
      console.warn('[Modelos] Error en', name, err);
      resolve();
    }
  }))).then(() => Object.keys(GLB).length);
}

// Luz de ambiente (IBL) a partir del cielo de Poly Haven. Se calcula una vez por WebGLRenderer.
let ENV_MAP = null;
function loadEnvMap(gl) {
  if (typeof FARO_ENV === 'undefined' || !FARO_ENV || !gl) return Promise.resolve(null);
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(FARO_ENV, (tex) => {
      try {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.encoding = THREE.sRGBEncoding;
        const pmrem = new THREE.PMREMGenerator(gl);
        ENV_MAP = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
        tex.dispose();
        GLB_MAT.envMapIntensity = 0.55;
        resolve(ENV_MAP);
      } catch (err) {
        console.warn('[Modelos] Sin luz de ambiente:', err);
        resolve(null);
      }
    }, undefined, () => resolve(null));
  });
}

// Texturas del suelo (Poly Haven, CC0, v0.8): aportan el detalle escaneado; el color lo pone cada
// terreno (brillo medio 0,5, por eso el material las multiplica por 2).
const TERRAIN_TEX = {};
function loadTerrainTextures(gl) {
  if (typeof FARO_TEX === 'undefined' || !FARO_TEX) return Promise.resolve(0);
  const loader = new THREE.TextureLoader();
  const aniso = gl && gl.capabilities ? Math.min(4, gl.capabilities.getMaxAnisotropy()) : 1;
  return Promise.all(Object.entries(FARO_TEX).map(([k, uri]) => new Promise((resolve) => {
    loader.load(uri, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = aniso;
      TERRAIN_TEX[k] = { full: tex, small: null };
      resolve(1);
    }, undefined, () => resolve(0));
  }))).then((r) => r.reduce((a, b) => a + b, 0));
}

// «Más fluido»: la misma textura a 256 px (se hace una vez y se reutiliza).
function terrainTex(k, quality) {
  const t = TERRAIN_TEX[k];
  if (!t) return null;
  if (quality === 'high') return t.full;
  if (!t.small) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    c.getContext('2d').drawImage(t.full.image, 0, 0, 256, 256);
    t.small = new THREE.CanvasTexture(c);
    t.small.wrapS = THREE.RepeatWrapping;
    t.small.wrapT = THREE.RepeatWrapping;
  }
  return t.small;
}

function glbKey(type) {
  if (GLB[type]) return type;
  if (GLB[type + '_1']) return type + '_1';
  return null;
}

// Aspectos de la Tienda: solo cambian los colores del modelo (vida, daño y velocidad iguales).
const SKIN_LOOKS = {
  selva: { name: 'Selva', tints: [0x4e6b34, 0x6b5a3a, 0x3d5530], mix: 0.55 },
  artico: { name: 'Ártico', tints: [0xeef4f7, 0xc9dde8], mix: 0.62, teamDark: 0xdfe9ef },
  castillo: { name: 'Castillo', tints: [0x8c7b63, 0x6e6252, 0xa39478], mix: 0.6 },
  neon: { name: 'Neón', tints: [0x1b1830, 0x231d3d], mix: 0.8, glow: true },
  dorado: { name: 'Dorado', tints: [0xf2c14e, 0xd9a638], mix: 0.72, teamDark: 0xb8862a },
  // Brigada Tóxica: cambia la forma (capucha y máscara de gas), no solo el color.
  toxico: { name: 'Tóxico', tints: [], mix: 0, geo: true },
};

function _skinColor(base, look, i) {
  const L = SKIN_LOOKS[look];
  if (!L || !L.tints.length) return base;
  return base.clone().lerp(new THREE.Color(L.tints[i % L.tints.length]), L.mix);
}

function _buildPart(entry, color, look) {
  const pos = [];
  const nor = [];
  const col = [];
  const L = SKIN_LOOKS[look];
  const team = new THREE.Color(color);
  const teamDark = new THREE.Color(shade(color, -0.3));
  if (L && L.glow) {
    team.lerp(new THREE.Color(0xffffff), 0.25);
    teamDark.copy(team);
  } else if (L && L.teamDark) teamDark.set(L.teamDark);
  entry.chunks.forEach((ch, idx) => {
    const pa = ch.g.attributes.position;
    const na = ch.g.attributes.normal;
    const c = ch.team === 1 ? team : ch.team === 2 ? teamDark : L ? _skinColor(ch.base, look, idx) : ch.base;
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      if (na) nor.push(na.getX(i), na.getY(i), na.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nor.length) geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  else geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

const _modelCache = new Map();
function getModel(type, color, look) {
  const key = type + ':' + color + ':' + (look || '');
  let m = _modelCache.get(key);
  if (m) return m;
  // Algunos aspectos traen su propio modelo (por ejemplo «rifle@toxico»).
  const gk = look && GLB[type + '@' + look] ? type + '@' + look : glbKey(type);
  if (gk) {
    const src = GLB[gk];
    m = { glb: true, partPos: {} };
    for (const [part, entry] of Object.entries(src.parts)) {
      m[part] = _buildPart(entry, color, look);
      m.partPos[part] = entry.pos;
    }
  } else {
    const base = type.replace(/_\d+$/, '');
    const fn = UNIT_MODEL[type] || MODEL_BUILDERS[type] || UNIT_MODEL[base] || MODEL_BUILDERS[base];
    m = fn ? fn(color) : MODEL_BUILDERS.house(color);
  }
  _modelCache.set(key, m);
  return m;
}

function _partMesh(geo, mat, out, group, name, pos) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  if (pos) mesh.position.copy(pos);
  group.add(mesh);
  out[name] = mesh;
  return mesh;
}

// Crea el grupo 3D de una entidad. Devuelve { group, main, turret, rotor, blades, rocker, crystal }.
function createVisual(type, color, look) {
  const m = getModel(type, color, look);
  const group = new THREE.Group();
  const out = { group, main: null, turret: null, rotor: null, crystal: null, rocker: null, blades: null, type };
  const mat = fastMat(m.glb ? GLB_MAT : MODEL_MAT, FAST_MATS);
  _partMesh(m.main, mat, out, group, 'main', null).receiveShadow = true;
  const pp = m.partPos || {};
  if (m.blades) _partMesh(m.blades, mat, out, group, 'blades', pp.blades || new THREE.Vector3(0, m.bladesY, m.bladesZ));
  if (m.rocker) _partMesh(m.rocker, mat, out, group, 'rocker', pp.rocker || new THREE.Vector3(0, m.rockerY, m.rockerZ || 0));
  if (m.turret) {
    _partMesh(m.turret, mat, out, group, 'turret', pp.turret || new THREE.Vector3(0, m.turretY || 0, m.turretZ || 0));
    out.turretBaseY = out.turret.position.y;
  }
  if (m.rotor) _partMesh(m.rotor, mat, out, group, 'rotor', pp.rotor || new THREE.Vector3(0, m.rotorY, 0));
  // Piernas de los soldados (se mueven al caminar).
  if (m.legl) _partMesh(m.legl, mat, out, group, 'legl', pp.legl);
  if (m.legr) _partMesh(m.legr, mat, out, group, 'legr', pp.legr);
  // La pierna cuelga del muslo: gira en la rodilla y sigue a la cadera.
  if (m.shinl && out.legl) _partMesh(m.shinl, mat, out, out.legl, 'shinl', pp.shinl.clone().sub(pp.legl));
  if (m.shinr && out.legr) _partMesh(m.shinr, mat, out, out.legr, 'shinr', pp.shinr.clone().sub(pp.legr));
  if (m.crystal) {
    const cmat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.55, flatShading: true, roughness: 0.4,
    });
    _partMesh(m.crystal, cmat, out, group, 'crystal', pp.crystal || new THREE.Vector3(0, m.crystalY, 0));
    out.crystalBaseY = out.crystal.position.y;
  }
  if (m.scale) group.scale.setScalar(m.scale);
  return out;
}

// El Faro y las Banderas: partes neutras + piezas que cambian de color según el dueño.
const NEUTRAL = 0xd9dcdf;
function createPointVisual(type) {
  const group = new THREE.Group();
  const own = new THREE.MeshStandardMaterial({ color: NEUTRAL, flatShading: true, roughness: 0.7 });
  const out = { group, own, beam: null, lamp: null };
  const b = new PartBuilder();
  if (type === 'faro') {
    b.cyl(0.95, 0.18, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.62, 0.22, shade(PAL.stone, 0.12), 0, 0.18, 0, GEO.cyl6);
    const levels = 5;
    for (let i = 0; i < levels; i++) {
      const r0 = 0.42 - i * 0.035;
      b.add(GEO.cyl12, i % 2 ? 0xc0392b : PAL.white, 0, 0.4 + i * 0.36 + 0.18, 0, r0, 0.36, r0);
    }
    b.cyl(0.34, 0.06, PAL.dark, 0, 2.2, 0, GEO.cyl12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(0.03, 0.34, 0.03, PAL.dark, Math.cos(a) * 0.24, 2.26, Math.sin(a) * 0.24);
    }
    b.add(GEO.cone8, PAL.dark, 0, 2.78, 0, 0.3, 0.32, 0.3);
    b.box(0.2, 0.3, 0.02, PAL.wood, 0, 0.4, 0.44);
    const main = new THREE.Mesh(b.build(), fastMat(MODEL_MAT, FAST_MATS));
    main.castShadow = true;
    group.add(main);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffc35a, emissive: 0xffa21f, emissiveIntensity: 1.4 }));
    lamp.position.y = 2.42;
    group.add(lamp);
    const beamGeo = new THREE.ConeGeometry(0.7, 5, 16, 1, true);
    beamGeo.translate(0, -2.5, 0);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffc35a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }));
    const pivot = new THREE.Group();
    pivot.position.y = 2.42;
    pivot.add(beam);
    group.add(pivot);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.08, 6, 1, false, Math.PI / 6), own);
    band.position.y = 0.42;
    group.add(band);
    out.beam = pivot;
    out.lamp = lamp;
  } else {
    b.cyl(0.32, 0.1, PAL.stone, 0, 0, 0, GEO.cyl6);
    b.cyl(0.035, 1.25, PAL.dark, 0, 0.1, 0);
    b.add(GEO.sphere, PAL.yellow, 0, 1.38, 0, 0.05, 0.05, 0.05);
    const main = new THREE.Mesh(b.build(), fastMat(MODEL_MAT, FAST_MATS));
    main.castShadow = true;
    group.add(main);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.02), own);
    cloth.position.set(0.27, 1.16, 0);
    cloth.castShadow = true;
    group.add(cloth);
    out.cloth = cloth;
  }
  return out;
}

// Miniaturas para los menús: se renderizan una vez con un renderizador pequeño.
const Thumbs = {
  cache: new Map(),
  renderer: null,
  scene: null,
  camera: null,

  init() {
    try {
      const canvas = document.createElement('canvas');
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(112, 112);
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
      const sun = new THREE.DirectionalLight(0xffffff, 0.8);
      sun.position.set(3, 5, 4);
      this.scene.add(sun);
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    } catch (err) {
      console.warn('[Thumbs] Sin miniaturas:', err);
      this.renderer = null;
    }
  },

  get(type, color, look) {
    const key = type + ':' + color + ':' + (look || '');
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    if (this.renderer) {
      const isPoint = type === 'faro' || type === 'flag';
      const v = isPoint ? createPointVisual(type) : createVisual(type, color, look);
      if (isPoint) {
        v.own.color.set(color);
        if (v.beam) v.beam.visible = false;
      }
      v.group.scale.setScalar(1);
      this.scene.add(v.group);
      const box = new THREE.Box3().setFromObject(v.group);
      const size = box.getSize(new THREE.Vector3()).length();
      const center = box.getCenter(new THREE.Vector3());
      const d = size * 1.75;
      this.camera.position.set(center.x + d * 0.62, center.y + d * 0.55, center.z + d * 0.62);
      this.camera.lookAt(center);
      this.renderer.render(this.scene, this.camera);
      url = this.renderer.domElement.toDataURL('image/png');
      this.scene.remove(v.group);
    }
    this.cache.set(key, url);
    return url;
  },

  // Portada (v0.9): una escena con los modelos del juego, dibujada una sola vez como imagen.
  coverUrl: '',
  cover(w = 1200, h = 330) {
    if (this.coverUrl || !this.renderer) return this.coverUrl;
    try {
      const r = this.renderer;
      const scene = new THREE.Scene();
      const sky = document.createElement('canvas');
      sky.width = 4;
      sky.height = 256;
      const sctx = sky.getContext('2d');
      const grad = sctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#16283a');
      grad.addColorStop(0.55, '#d9874a');
      grad.addColorStop(1, '#f6c46a');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 4, 256);
      scene.background = new THREE.CanvasTexture(sky);
      scene.fog = new THREE.Fog(0xe0a060, 12, 30);
      if (ENV_MAP) scene.environment = ENV_MAP;
      scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2d4a5a, 0.75));
      const sun = new THREE.DirectionalLight(0xffc98a, 1.05);
      sun.position.set(-6, 5, 3);
      scene.add(sun);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 40),
        new THREE.MeshStandardMaterial({ color: 0x2b6f93, roughness: 0.25, metalness: 0.1 }));
      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.12;
      scene.add(water);
      // Isla de casillas hexagonales.
      const hexGeo = new THREE.CylinderGeometry(0.98, 0.98, 0.3, 6);
      const grass = new THREE.MeshStandardMaterial({ color: 0x6f9c55, roughness: 0.95, flatShading: true });
      const sand = new THREE.MeshStandardMaterial({ color: 0xd8c38a, roughness: 0.95, flatShading: true });
      const rock = new THREE.MeshStandardMaterial({ color: 0x8b8f87, roughness: 0.95, flatShading: true });
      for (let q = -6; q <= 14; q++) {
        for (let rr = -5; rr <= 4; rr++) {
          const x = q * 1.5;
          const z = rr * 1.732 + (q & 1) * 0.866;
          const d = Math.hypot((x - 4.5) * 0.48, z);
          if (d > 5.6 || z > 3.6) continue;
          const edge = d > 4.6 || z > 2.6;
          const hill = q >= 6 && q <= 7 && rr <= -1;
          const t = new THREE.Mesh(hexGeo, edge ? sand : hill ? rock : grass);
          t.position.set(x, hill ? 0.18 : 0, z);
          scene.add(t);
        }
      }
      const blue = PLAYER_COLORS[0];
      const red = PLAYER_COLORS[1];
      const put = (type, x, y, z, yaw = 0, s = 1, color = blue, look) => {
        const v = createVisual(type, color, look);
        v.group.position.set(x, y, z);
        v.group.rotation.y = yaw;
        if (s !== 1) v.group.scale.multiplyScalar(s);
        scene.add(v.group);
        return v;
      };
      const faro = createPointVisual('faro');
      faro.own.color.set(0xf2ab38);
      faro.group.position.set(9.6, 0.33, -2.8);
      faro.group.scale.setScalar(1.1);
      scene.add(faro.group);
      put('core_3', 0.8, 0.15, -2.4, 0.3);
      put('aadef_4', 3.0, 0.15, -3.2, 0.8);
      put('turret_4', 1.8, 0.15, 0.4, 1.0);
      put('apc', 3.2, 0.15, -0.6, 1.2, 1.15);
      put('heavytank', 4.4, 0.15, 0.9, 1.15, 1.15);
      put('tank', 6.0, 0.15, -0.2, 1.25, 1.15);
      put('launcher', 7.6, 0.33, -2.2, 1.3, 1.1);
      ['rifle', 'rocket', 'rifle', 'medic', 'sniper', 'rifle'].forEach((k, i) =>
        put(k, 4.6 + i * 0.6, 0.15, 2.2 - (i % 2) * 0.4, 1.4, 1.5));
      const heli = put('heli', 3.4, 2.0, 0.6, 1.3, 1.2);
      if (heli.rotor) heli.rotor.rotation.y = 0.5;
      const apache = put('apache', 6.8, 2.5, -0.6, 1.25, 1.2);
      if (apache.rotor) apache.rotor.rotation.y = 1.1;
      const jet = put('fighter', 9.2, 3.3, 0.6, 1.9, 1.3);
      jet.group.rotation.z = -0.35;
      put('frigate', 11.2, -0.1, 2.6, -0.4, 1.2, red);
      const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 80);
      cam.position.set(4.6, 3.1, 9.6);
      cam.lookAt(5.0, 0.8, 0);
      r.setSize(w, h);
      r.render(scene, cam);
      this.coverUrl = r.domElement.toDataURL('image/jpeg', 0.86);
      hexGeo.dispose();
      [grass, sand, rock, water.material].forEach((m) => m.dispose());
      water.geometry.dispose();
      scene.background.dispose();
      r.setSize(112, 112);
    } catch (err) {
      console.warn('[Thumbs] Sin portada:', err);
      this.coverUrl = '';
    }
    return this.coverUrl;
  },
};
