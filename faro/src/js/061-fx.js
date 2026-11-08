'use strict';
// Efectos con partículas (v0.6): fuego, humo, restos, chispas, fogonazos, estelas y salpicaduras.
// Todas las partículas de un tipo de mezcla se dibujan en una sola pasada (THREE.Points), con un
// tope fijo: cuando se llena, la partícula más vieja se reutiliza. Así los efectos no ponen lento
// al iPad aunque haya muchas peleas.

const FX_VERT = `
attribute float psize;
attribute float palpha;
attribute vec3 pcolor;
uniform float scale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = pcolor;
  vAlpha = palpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * scale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FX_FRAG = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.12, d));
}`;

class Particles {
  constructor(scene, max, additive) {
    this.max = max;
    this.head = 0;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('palpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } },
      vertexShader: FX_VERT,
      fragmentShader: FX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 9 : 8;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) {
      this.p.push({ t: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0, fade: 1 });
    }
  }

  spawn(o) {
    const p = this.p[this.head];
    this.head = (this.head + 1) % this.max;
    p.t = 0;
    p.life = o.life;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.s0 = o.s0; p.s1 = o.s1 === undefined ? o.s0 : o.s1;
    p.r = o.r; p.g = o.g; p.b = o.b;
    p.a = o.a === undefined ? 1 : o.a;
    p.grav = o.grav || 0;
    p.drag = o.drag || 0;
    p.fade = o.fade || 1;
  }

  update(dt) {
    let n = 0;
    for (const p of this.p) {
      if (p.t >= p.life) continue;
      p.t += dt;
      if (p.t >= p.life) continue;
      p.vy -= p.grav * dt;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k; p.vy *= k; p.vz *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.grav && p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; }
      const k = p.t / p.life;
      const o = n * 3;
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z;
      this.col[o] = p.r; this.col[o + 1] = p.g; this.col[o + 2] = p.b;
      this.size[n] = p.s0 + (p.s1 - p.s0) * k;
      this.alpha[n] = p.a * Math.pow(1 - k, p.fade);
      n++;
    }
    this.count = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    if (n) {
      g.attributes.position.needsUpdate = true;
      g.attributes.pcolor.needsUpdate = true;
      g.attributes.palpha.needsUpdate = true;
      g.attributes.psize.needsUpdate = true;
    }
  }

  setScale(px) {
    this.mat.uniforms.scale.value = px;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Efectos compuestos. glow = mezcla aditiva (fuego, fogonazo, chispas); soft = normal (humo, restos, agua).
class FxSystem {
  constructor(scene) {
    this.glow = new Particles(scene, 520, true);
    this.soft = new Particles(scene, 720, false);
    this.scale = 1; // 0,5 en «Más fluido»: la mitad de partículas.
    this.spawned = 0;
  }

  n(k) {
    // Cantidad según la calidad: en «Más fluido» se reparte la mitad (redondeando al azar).
    const v = k * this.scale;
    return Math.floor(v) + (Math.random() < v - Math.floor(v) ? 1 : 0);
  }

  add(sys, o) {
    sys.spawn(o);
    this.spawned++;
  }

  explosion(x, y, z, s, bld) {
    const big = bld ? 1.3 : 1;
    this.add(this.glow, { x, y: y + 0.1, z, life: 0.16, s0: s * 1.4 * big, s1: s * 1.9 * big, r: 1, g: 0.95, b: 0.75, a: 1 });
    for (let i = this.n(bld ? 10 : 6); i > 0; i--) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(0.4, 1.4) * s;
      this.add(this.glow, { x, y: y + rnd(0, 0.3) * s, z, vx: Math.cos(a) * sp, vy: rnd(0.4, 1.2) * s, vz: Math.sin(a) * sp, drag: 3,
        life: rnd(0.35, 0.6), s0: s * rnd(0.5, 0.8) * big, s1: s * rnd(0.9, 1.3) * big, r: 1, g: rnd(0.45, 0.7), b: 0.15, a: 0.95, fade: 1.4 });
    }
    for (let i = this.n(bld ? 9 : 4); i > 0; i--) {
      const a = Math.random() * Math.PI * 2;
      this.add(this.soft, { x: x + Math.cos(a) * 0.2 * s, y: y + 0.2, z: z + Math.sin(a) * 0.2 * s, vx: Math.cos(a) * 0.25, vy: rnd(0.5, 1.1), vz: Math.sin(a) * 0.25,
        drag: 0.8, life: rnd(1.4, 2.4), s0: s * 0.55 * big, s1: s * 1.35 * big, r: 0.3, g: 0.31, b: 0.33, a: 0.5, fade: 1.2 });
    }
    for (let i = this.n(bld ? 12 : 6); i > 0; i--) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(1.2, 2.8) * s;
      this.add(this.soft, { x, y: y + 0.2, z, vx: Math.cos(a) * sp, vy: rnd(1.5, 3.2) * s, vz: Math.sin(a) * sp, grav: 6,
        life: rnd(0.7, 1.2), s0: rnd(0.07, 0.13) * big, r: 0.16, g: 0.15, b: 0.14, a: 1, fade: 0.4 });
    }
    this.sparks(x, y + 0.2, z, s, bld ? 8 : 5);
  }

  sparks(x, y, z, s, k = 4) {
    for (let i = this.n(k); i > 0; i--) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(1.5, 3.5) * Math.max(0.5, s);
      this.add(this.glow, { x, y, z, vx: Math.cos(a) * sp, vy: rnd(0.8, 2.6), vz: Math.sin(a) * sp, grav: 7,
        life: rnd(0.2, 0.42), s0: 0.08, s1: 0.03, r: 1, g: 0.85, b: 0.4, a: 1 });
    }
  }

  flash(x, y, z, s = 0.28) {
    this.add(this.glow, { x, y, z, life: 0.07, s0: s, s1: s * 1.4, r: 1, g: 0.9, b: 0.55, a: 1 });
  }

  impact(x, y, z, s) {
    this.add(this.glow, { x, y, z, life: 0.22, s0: s * 1.2, s1: s * 1.8, r: 1, g: 0.75, b: 0.3, a: 0.9 });
    this.sparks(x, y, z, s, 3);
    if (this.n(1)) this.add(this.soft, { x, y, z, vy: 0.5, life: 0.9, s0: s * 0.7, s1: s * 1.6, r: 0.35, g: 0.35, b: 0.37, a: 0.5 });
  }

  splash(x, z, s) {
    for (let i = this.n(9); i > 0; i--) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(0.3, 1.1) * s;
      this.add(this.soft, { x, y: 0.02, z, vx: Math.cos(a) * sp, vy: rnd(2, 3.6) * s, vz: Math.sin(a) * sp, grav: 8,
        life: rnd(0.5, 0.8), s0: rnd(0.1, 0.18), s1: 0.05, r: 0.86, g: 0.95, b: 1, a: 0.9, fade: 0.6 });
    }
    this.add(this.soft, { x, y: 0.03, z, life: 0.6, s0: s * 0.6, s1: s * 1.8, r: 0.9, g: 0.97, b: 1, a: 0.55 });
  }

  trail(x, y, z) {
    this.add(this.soft, { x, y, z, vy: 0.15, life: 0.55, s0: 0.1, s1: 0.32, r: 0.78, g: 0.78, b: 0.8, a: 0.55, drag: 1 });
  }

  smoke(x, y, z, s) {
    this.add(this.soft, { x: x + rnd(-0.12, 0.12), y, z: z + rnd(-0.12, 0.12), vx: rnd(-0.1, 0.1), vy: rnd(0.45, 0.8), vz: rnd(-0.1, 0.1),
      drag: 0.4, life: rnd(1.8, 2.8), s0: s * 0.5, s1: s * 1.9, r: 0.24, g: 0.25, b: 0.27, a: 0.5, fade: 1.3 });
    if (this.n(0.5)) this.add(this.glow, { x, y: y - 0.05, z, vy: 0.3, life: 0.4, s0: s * 0.45, s1: s * 0.2, r: 1, g: 0.5, b: 0.12, a: 0.7 });
  }

  heal(x, y, z) {
    this.add(this.glow, { x, y, z, vy: 0.7, life: 0.8, s0: 0.14, s1: 0.06, r: 0.42, g: 1, b: 0.54, a: 0.9 });
  }

  update(dt) {
    this.glow.update(dt);
    this.soft.update(dt);
  }

  get count() {
    return this.glow.count + this.soft.count;
  }

  get capacity() {
    return this.glow.max + this.soft.max;
  }

  setScale(px) {
    this.glow.setScale(px);
    this.soft.setScale(px);
  }

  dispose() {
    this.glow.dispose();
    this.soft.dispose();
  }
}
