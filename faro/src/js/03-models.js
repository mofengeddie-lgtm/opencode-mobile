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

const _modelCache = new Map();
function getModel(type, color) {
  const key = type + ':' + color;
  let m = _modelCache.get(key);
  if (!m) {
    const fn = UNIT_MODEL[type] || MODEL_BUILDERS[type];
    m = fn(color);
    _modelCache.set(key, m);
  }
  return m;
}

// Crea el grupo 3D de una entidad. Devuelve { group, turret, rotor, crystal }.
function createVisual(type, color) {
  const m = getModel(type, color);
  const group = new THREE.Group();
  const main = new THREE.Mesh(m.main, MODEL_MAT);
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  const out = { group, main, turret: null, rotor: null, crystal: null, rocker: null, blades: null };
  if (m.blades) {
    out.blades = new THREE.Mesh(m.blades, MODEL_MAT);
    out.blades.position.set(0, m.bladesY, m.bladesZ);
    out.blades.castShadow = true;
    group.add(out.blades);
  }
  if (m.rocker) {
    out.rocker = new THREE.Mesh(m.rocker, MODEL_MAT);
    out.rocker.position.set(0, m.rockerY, m.rockerZ || 0);
    out.rocker.castShadow = true;
    group.add(out.rocker);
  }
  if (m.turret) {
    out.turret = new THREE.Mesh(m.turret, MODEL_MAT);
    out.turret.position.set(0, m.turretY || 0, m.turretZ || 0);
    out.turretBaseY = m.turretY || 0;
    out.turret.castShadow = true;
    group.add(out.turret);
  }
  if (m.rotor) {
    out.rotor = new THREE.Mesh(m.rotor, MODEL_MAT);
    out.rotor.position.y = m.rotorY;
    group.add(out.rotor);
  }
  if (m.crystal) {
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.55, flatShading: true, roughness: 0.4,
    });
    out.crystal = new THREE.Mesh(m.crystal, mat);
    out.crystal.position.y = m.crystalY;
    out.crystal.castShadow = true;
    group.add(out.crystal);
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
    const main = new THREE.Mesh(b.build(), MODEL_MAT);
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
    const main = new THREE.Mesh(b.build(), MODEL_MAT);
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

  get(type, color) {
    const key = type + ':' + color;
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    if (this.renderer) {
      const isPoint = type === 'faro' || type === 'flag';
      const v = isPoint ? createPointVisual(type) : createVisual(type, color);
      if (isPoint) {
        v.own.color.set(color);
        if (v.beam) v.beam.visible = false;
      }
      v.group.scale.setScalar(1);
      if (v.crystal) v.crystal.position.y = 1.1;
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
};
