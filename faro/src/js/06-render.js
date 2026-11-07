'use strict';
// Escena 3D: terreno instanciado, decoración, fronteras, entidades, efectos,
// barras de vida (capa 2D), minimapa y cámara.

class Renderer {
  constructor(gl, canvas, overlay, game, quality) {
    this.game = game;
    this.canvas = canvas;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.quality = quality;
    this.renderer = gl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyQuality(quality);

    const scene = new THREE.Scene();
    this.scene = scene;
    const sky = 0x8fcbe0;
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 70, 140);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);

    scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x4d6a45, 0.62));
    // Luz de ambiente del cielo de Poly Haven para los modelos de Blender.
    if (ENV_MAP) scene.environment = ENV_MAP;
    const sun = new THREE.DirectionalLight(0xfff1dc, 0.88);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    const home = game.cells[game.map.homes[0]];
    this.cam = { tx: home.x, tz: home.z, dist: 24, yaw: Math.atan2(home.x, home.z), pitch: 0.95 };
    this.vis = new Map();
    this.raycaster = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._p = new THREE.Vector3();
    this.selection = [];
    this.placement = null;
    this.hoverCell = -1;
    this.markers = [];
    this.pings = [];
    this.lastTerritory = -1;
    this.lastBuildCount = -1;
    this.miniDirty = true;

    this.buildTerrain();
    this.buildDecor();
    this.buildBorders();
    this.buildFx();
    this.buildPoints();
    this.buildShields();
    this.resize();
  }

  applyQuality(q) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 1.75) : 1);
    this.renderer.shadowMap.enabled = q === 'high';
    this.renderer.shadowMap.needsUpdate = true;
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.material) o.material.needsUpdate = true;
      });
    }
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.fov = w < h ? 55 : 42;
      this.camera.updateProjectionMatrix();
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(w * dpr);
    this.overlay.height = Math.round(h * dpr);
    this.octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- terreno ----------
  buildTerrain() {
    const cells = this.game.cells;
    const geo = new THREE.CylinderGeometry(0.985, 0.985, 1, 6, 1, false, Math.PI / 6);
    geo.translate(0, -0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const rng = mulberry32(this.game.opts.seed + 5);
    this.baseColors = [];
    for (const c of cells) {
      const h = c.h;
      m.makeScale(1, h + 1.4, 1);
      m.setPosition(c.x, h, c.z);
      mesh.setMatrixAt(c.i, m);
      const col = new THREE.Color(TERRAIN[c.t].color);
      const v = (rng() - 0.5) * (TERRAIN[c.t].water ? 0.04 : 0.09);
      col.offsetHSL(0, 0, v);
      this.baseColors.push(col);
      mesh.setColorAt(c.i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.terrain = mesh;
    this.scene.add(mesh);

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ color: 0x175a85, roughness: 0.6 }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.09;
    ocean.receiveShadow = true;
    this.scene.add(ocean);
  }

  tintTerritory() {
    const g = this.game;
    const tmp = new THREE.Color();
    for (const c of g.cells) {
      tmp.copy(this.baseColors[c.i]);
      if (c.owner >= 0) tmp.lerp(new THREE.Color(PLAYER_COLORS[c.owner]), TERRAIN[c.t].water ? 0.1 : 0.16);
      this.terrain.setColorAt(c.i, tmp);
    }
    this.terrain.instanceColor.needsUpdate = true;
  }

  buildDecor() {
    const g = this.game;
    const rng = mulberry32(g.opts.seed + 9);
    const trees = [];
    const peaks = [];
    const golds = [];
    const oils = [];
    const rocks = [];
    for (const c of g.cells) {
      if (c.t === 'forest') {
        const k = 2 + Math.floor(rng() * 2);
        c.trees = [];
        for (let i = 0; i < k; i++) {
          const a = rng() * Math.PI * 2;
          const r = 0.2 + rng() * 0.45;
          c.trees.push(trees.length);
          trees.push({ x: c.x + Math.cos(a) * r, y: c.h, z: c.z + Math.sin(a) * r, s: 0.75 + rng() * 0.5, c: c.i });
        }
      } else if (c.t === 'mount') {
        peaks.push({ x: c.x + (rng() - 0.5) * 0.2, y: c.h, z: c.z + (rng() - 0.5) * 0.2, s: 0.85 + rng() * 0.35, c: c.i });
      } else if (c.t === 'gold') {
        c.golds = [];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + rng();
          c.golds.push(golds.length);
          golds.push({ x: c.x + Math.cos(a) * 0.4, y: c.h + 0.1, z: c.z + Math.sin(a) * 0.4, s: 0.12 + rng() * 0.06, c: c.i });
        }
      } else if (c.t === 'oil') {
        c.oil = oils.length;
        oils.push({ x: c.x, y: c.h + 0.015, z: c.z, s: 0.62, c: c.i });
      } else if ((c.t === 'grass' || c.t === 'sand') && rng() < 0.07) {
        rocks.push({ x: c.x + (rng() - 0.5) * 1.1, y: c.h, z: c.z + (rng() - 0.5) * 1.1, s: 0.09 + rng() * 0.08, c: c.i });
      }
    }
    const inst = (geo, mat, list, place, shadow = true) => {
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      mesh.count = list.length;
      const m = new THREE.Matrix4();
      list.forEach((it, i) => mesh.setMatrixAt(i, place(it, m)));
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
    const trunkGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.25, 5);
    trunkGeo.translate(0, 0.125, 0);
    const crownGeo = new THREE.ConeGeometry(0.26, 0.62, 6);
    crownGeo.translate(0, 0.52, 0);
    const placeTree = (it, m) => m.makeScale(it.s, it.s, it.s).setPosition(it.x, it.y, it.z);
    this.trees = trees;
    this.treeTrunks = inst(trunkGeo, flat(0x7a5232), trees, placeTree);
    this.treeCrowns = inst(crownGeo, flat(0x3f8a3a), trees, placeTree);
    const tc = new THREE.Color();
    trees.forEach((t, i) => {
      tc.set(0x3f8a3a).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.12);
      this.treeCrowns.setColorAt(i, tc);
    });

    const peakGeo = new THREE.ConeGeometry(0.88, 1.5, 6);
    peakGeo.translate(0, 0.75, 0);
    const capGeo = new THREE.ConeGeometry(0.36, 0.6, 6);
    capGeo.translate(0, 1.21, 0);
    const placePeak = (it, m) => m.makeScale(it.s, it.s, it.s).setPosition(it.x, it.y, it.z);
    inst(peakGeo, flat(0x8f8a80), peaks, placePeak);
    inst(capGeo, flat(0xf4f6f8), peaks, placePeak);

    this.golds = golds;
    this.goldMesh = inst(new THREE.OctahedronGeometry(1, 0),
      flat(0xffcf3a, { emissive: 0x8a6400, emissiveIntensity: 0.5, roughness: 0.4 }), golds,
      (it, m) => m.makeScale(it.s, it.s * 1.5, it.s).setPosition(it.x, it.y + it.s, it.z));
    this.oils = oils;
    const oilGeo = new THREE.CylinderGeometry(1, 1, 0.02, 10);
    this.oilMesh = inst(oilGeo, flat(0x161a20, { roughness: 0.25, metalness: 0.4 }), oils,
      (it, m) => m.makeScale(it.s, 1, it.s * 0.8).setPosition(it.x, it.y, it.z), false);
    inst(new THREE.DodecahedronGeometry(1, 0), flat(0x9a978f), rocks,
      (it, m) => m.makeScale(it.s, it.s * 0.7, it.s).setPosition(it.x, it.y + it.s * 0.4, it.z));
  }

  // Oculta árboles, oro y petróleo bajo los edificios.
  refreshDecor() {
    const g = this.game;
    const m = new THREE.Matrix4();
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.trees.forEach((t, i) => {
      const hidden = !!g.cells[t.c].bld;
      const mat = hidden ? zero : m.makeScale(t.s, t.s, t.s).setPosition(t.x, t.y, t.z);
      this.treeTrunks.setMatrixAt(i, mat);
      this.treeCrowns.setMatrixAt(i, mat);
    });
    this.treeTrunks.instanceMatrix.needsUpdate = true;
    this.treeCrowns.instanceMatrix.needsUpdate = true;
    this.golds.forEach((it, i) => {
      const hidden = !!g.cells[it.c].bld;
      this.goldMesh.setMatrixAt(i, hidden ? zero : m.makeScale(it.s, it.s * 1.5, it.s).setPosition(it.x, it.y + it.s, it.z));
    });
    this.goldMesh.instanceMatrix.needsUpdate = true;
    this.oils.forEach((it, i) => {
      const hidden = !!g.cells[it.c].bld;
      this.oilMesh.setMatrixAt(i, hidden ? zero : m.makeScale(it.s, 1, it.s * 0.8).setPosition(it.x, it.y, it.z));
    });
    this.oilMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- fronteras de territorio ----------
  buildBorders() {
    this.borderMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false });
    this.borderMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.borderMat);
    this.borderMesh.renderOrder = 2;
    this.scene.add(this.borderMesh);
  }

  rebuildBorders() {
    const g = this.game;
    const pos = [];
    const col = [];
    const tmp = new THREE.Color();
    for (const c of g.cells) {
      if (c.owner < 0) continue;
      tmp.set(PLAYER_COLORS[c.owner]);
      const y = Math.max(c.h, 0) + 0.035;
      for (const [dq, dr] of HEX_DIRS) {
        const n = g.map.get(c.q + dq, c.r + dr);
        if (n && n.owner === c.owner) continue;
        const w = hexToWorld(dq, dr);
        const a = Math.atan2(w.z, w.x);
        const a1 = a - Math.PI / 6;
        const a2 = a + Math.PI / 6;
        const o = 0.97;
        const i = 0.8;
        const p1 = [c.x + Math.cos(a1) * o, y, c.z + Math.sin(a1) * o];
        const p2 = [c.x + Math.cos(a2) * o, y, c.z + Math.sin(a2) * o];
        const p3 = [c.x + Math.cos(a2) * i, y, c.z + Math.sin(a2) * i];
        const p4 = [c.x + Math.cos(a1) * i, y, c.z + Math.sin(a1) * i];
        pos.push(...p1, ...p3, ...p2, ...p1, ...p4, ...p3);
        for (let k = 0; k < 6; k++) col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.borderMesh.geometry.dispose();
    this.borderMesh.geometry = geo;
  }

  // ---------- efectos ----------
  buildFx() {
    const MAXT = 400;
    const tg = new THREE.BufferGeometry();
    this.tracerPos = new Float32Array(MAXT * 6);
    this.tracerCol = new Float32Array(MAXT * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3));
    this.tracerLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }));
    this.tracerLines.frustumCulled = false;
    this.scene.add(this.tracerLines);
    this.tracers = [];
    this.MAXT = MAXT;

    this.booms = [];
    const sphere = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 70; i++) {
      const mesh = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.booms.push({ mesh, t: 1, dur: 1, s: 1, kind: 'fire', vy: 0 });
    }

    this.projMeshes = { rocket: [], shell: [], torpedo: [], missile: [] };
    this.projGeo = {
      rocket: new THREE.CylinderGeometry(0.035, 0.035, 0.28, 6).rotateX(Math.PI / 2),
      missile: new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6).rotateX(Math.PI / 2),
      shell: new THREE.SphereGeometry(0.07, 6, 5),
      torpedo: new THREE.CylinderGeometry(0.05, 0.05, 0.35, 6).rotateX(Math.PI / 2),
    };
    this.projMat = {
      rocket: new THREE.MeshBasicMaterial({ color: 0xffe08a }),
      missile: new THREE.MeshBasicMaterial({ color: 0xfff6e6 }),
      shell: new THREE.MeshBasicMaterial({ color: 0x2b2b2b }),
      torpedo: new THREE.MeshBasicMaterial({ color: 0xd8f3ff }),
    };

    const ringGeo = new THREE.RingGeometry(0.46, 0.56, 28).rotateX(-Math.PI / 2);
    this.ringGeo = ringGeo;
    this.rings = [];
    this.ringMatOwn = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    this.ringMatEnemy = new THREE.MeshBasicMaterial({ color: 0xff5050, transparent: true, opacity: 0.9, depthWrite: false });
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 1, depthWrite: false });

    this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rangeRing.renderOrder = 5;
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);

    const hexGeo = new THREE.CircleGeometry(0.9, 6).rotateX(-Math.PI / 2);
    this.placeMesh = new THREE.InstancedMesh(hexGeo, new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.45, depthWrite: false }), this.game.cells.length);
    this.placeMesh.count = 0;
    this.placeMesh.renderOrder = 3;
    this.scene.add(this.placeMesh);
    this.hoverMesh = new THREE.Mesh(hexGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.hoverMesh.visible = false;
    this.hoverMesh.renderOrder = 4;
    this.scene.add(this.hoverMesh);

    const flag = new PartBuilder();
    flag.box(0.04, 0.9, 0.04, PAL.dark, 0, 0, 0);
    flag.box(0.34, 0.22, 0.02, 0xffffff, 0.17, 0.62, 0);
    this.rallyFlag = new THREE.Mesh(flag.build(), MODEL_MAT);
    this.rallyFlag.visible = false;
    this.scene.add(this.rallyFlag);
  }

  spawnBoom(x, y, z, s, small) {
    const pick = () => this.booms.find((b) => b.t >= b.dur) || this.booms[Math.floor(Math.random() * this.booms.length)];
    const fire = pick();
    fire.t = 0;
    fire.dur = small ? 0.28 : 0.45;
    fire.s = s;
    fire.kind = 'fire';
    fire.x = x; fire.y = y; fire.z = z;
    fire.mesh.material.color.set(small ? 0xffc260 : 0xff8a30);
    fire.mesh.visible = true;
    if (!small) {
      for (let i = 0; i < 2; i++) {
        const sm = pick();
        sm.t = 0;
        sm.dur = 1.1 + Math.random() * 0.4;
        sm.s = s * (0.7 + Math.random() * 0.4);
        sm.kind = 'smoke';
        sm.x = x + (Math.random() - 0.5) * s * 0.6;
        sm.y = y + 0.1;
        sm.z = z + (Math.random() - 0.5) * s * 0.6;
        sm.mesh.material.color.set(0x55595f);
        sm.mesh.visible = true;
      }
    }
  }

  // Láser del Núcleo (punto 17): un rayo ámbar brillante que dura un instante.
  spawnLaser(f) {
    if (!this.lasers) {
      this.lasers = [];
      this.laserGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).rotateX(Math.PI / 2);
    }
    let L = this.lasers.find((l) => l.t >= l.dur);
    if (!L) {
      if (this.lasers.length >= 12) return;
      const outer = new THREE.Mesh(this.laserGeo, new THREE.MeshBasicMaterial({ color: 0xffb63a, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      const inner = new THREE.Mesh(this.laserGeo, new THREE.MeshBasicMaterial({ color: 0xfff4d6, transparent: true, opacity: 0.95, depthWrite: false }));
      const grp = new THREE.Group();
      grp.add(outer);
      grp.add(inner);
      this.scene.add(grp);
      L = { grp, outer, inner, t: 1, dur: 0.18 };
      this.lasers.push(L);
    }
    const a = new THREE.Vector3(f.x1, f.y1, f.z1);
    const b = new THREE.Vector3(f.x2, f.y2, f.z2);
    const len = a.distanceTo(b);
    L.grp.position.copy(a).add(b).multiplyScalar(0.5);
    L.grp.lookAt(b);
    L.outer.scale.set(0.09, 0.09, len);
    L.inner.scale.set(0.035, 0.035, len);
    L.grp.visible = true;
    L.t = 0;
  }

  updateLasers(dt) {
    if (!this.lasers) return;
    for (const L of this.lasers) {
      if (L.t >= L.dur) { L.grp.visible = false; continue; }
      L.t += dt;
      const k = 1 - L.t / L.dur;
      L.outer.material.opacity = 0.6 * k;
      L.inner.material.opacity = 0.95 * k;
    }
    this.laserCount = this.lasers.filter((L) => L.t < L.dur).length;
  }

  spawnHeal(x, y, z) {
    const b = this.booms.find((bb) => bb.t >= bb.dur);
    if (!b) return;
    b.t = 0;
    b.dur = 0.8;
    b.s = 0.08;
    b.kind = 'heal';
    b.x = x; b.y = y; b.z = z;
    b.mesh.material.color.set(0x6dff8a);
    b.mesh.visible = true;
  }

  consumeFx() {
    const g = this.game;
    for (const f of g.fx) {
      if (f.k === 'laser') this.spawnLaser(f);
      else if (f.k === 'tracer') {
        if (this.tracers.length < this.MAXT) this.tracers.push({ ...f, t: 0, dur: f.heavy ? 0.12 : 0.07 });
      } else if (f.k === 'boom') this.spawnBoom(f.x, f.y, f.z, f.s, f.small);
      else if (f.k === 'spark') this.spawnBoom(f.x, f.y, f.z, f.s, true);
      else if (f.k === 'heal') this.spawnHeal(f.x, f.y, f.z);
    }
    g.fx.length = 0;
  }

  updateFx(dt) {
    // Trazadoras
    let n = 0;
    const tmp = new THREE.Color();
    this.tracers = this.tracers.filter((t) => (t.t += dt) < t.dur);
    for (const t of this.tracers) {
      tmp.set(t.color).lerp(new THREE.Color(0xffffff), 0.55);
      const o = n * 6;
      this.tracerPos[o] = t.x1; this.tracerPos[o + 1] = t.y1; this.tracerPos[o + 2] = t.z1;
      this.tracerPos[o + 3] = t.x2; this.tracerPos[o + 4] = t.y2; this.tracerPos[o + 5] = t.z2;
      for (let k = 0; k < 2; k++) {
        this.tracerCol[o + k * 3] = tmp.r;
        this.tracerCol[o + k * 3 + 1] = tmp.g;
        this.tracerCol[o + k * 3 + 2] = tmp.b;
      }
      n++;
    }
    this.tracerLines.geometry.setDrawRange(0, n * 2);
    this.tracerLines.geometry.attributes.position.needsUpdate = true;
    this.tracerLines.geometry.attributes.color.needsUpdate = true;

    for (const b of this.booms) {
      if (b.t >= b.dur) {
        b.mesh.visible = false;
        continue;
      }
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      if (b.kind === 'fire') {
        b.mesh.scale.setScalar(b.s * (0.25 + 0.75 * Math.sqrt(k)) * 0.6);
        b.mesh.material.opacity = 1 - k;
        b.mesh.position.set(b.x, b.y, b.z);
      } else if (b.kind === 'smoke') {
        b.mesh.scale.setScalar(b.s * (0.25 + 0.55 * k));
        b.mesh.material.opacity = 0.55 * (1 - k);
        b.mesh.position.set(b.x, b.y + k * 1.2, b.z);
      } else {
        b.mesh.scale.setScalar(b.s);
        b.mesh.material.opacity = 1 - k;
        b.mesh.position.set(b.x, b.y + k * 0.6, b.z);
      }
    }

    // Proyectiles
    const used = { rocket: 0, shell: 0, torpedo: 0, missile: 0 };
    for (const p of this.game.projectiles) {
      const list = this.projMeshes[p.kind];
      if (!list) continue;
      let mesh = list[used[p.kind]];
      if (!mesh) {
        mesh = new THREE.Mesh(this.projGeo[p.kind], this.projMat[p.kind]);
        this.scene.add(mesh);
        list.push(mesh);
      }
      used[p.kind]++;
      const k = Math.min(1, p.time / p.dur);
      const arc = p.kind === 'shell' ? Math.sin(Math.PI * k) * 1.1 : p.kind === 'rocket' ? Math.sin(Math.PI * k) * 0.35
        : p.kind === 'missile' ? Math.sin(Math.PI * k) * 2.6 : 0;
      const y = p.kind === 'torpedo' ? -0.02 : p.sy + (p.ty - p.sy) * k + arc;
      mesh.position.set(p.sx + (p.tx - p.sx) * k, y, p.sz + (p.tz - p.sz) * k);
      mesh.lookAt(p.tx, p.kind === 'torpedo' ? -0.02 : p.ty, p.tz);
      mesh.visible = true;
    }
    for (const kind of Object.keys(this.projMeshes)) {
      const list = this.projMeshes[kind];
      for (let i = used[kind]; i < list.length; i++) list[i].visible = false;
    }

    this.markers = this.markers.filter((mk) => {
      mk.t += dt;
      const k = mk.t / 0.6;
      if (k >= 1) {
        this.scene.remove(mk.mesh);
        return false;
      }
      mk.mesh.scale.setScalar(1.6 - k);
      mk.mesh.material.opacity = 1 - k;
      return true;
    });
  }

  addPing(x, z, kind = 'bad') {
    this.pings.push({ x, z, kind, t: performance.now() });
    if (this.pings.length > 12) this.pings.shift();
  }

  addMoveMarker(ci, color = 0x7dffa8) {
    const c = this.game.cells[ci];
    const mesh = new THREE.Mesh(this.ringGeo, this.markerMat.clone());
    mesh.material.color.set(color);
    mesh.position.set(c.x, Math.max(c.h, 0) + 0.06, c.z);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.markers.push({ mesh, t: 0 });
  }

  // ---------- Faro, Banderas, Cúpulas y escudos ----------
  buildPoints() {
    this.pointVis = this.game.points.map((pt) => {
      const v = createPointVisual(pt.type);
      v.group.position.set(pt.x, pt.y, pt.z);
      this.scene.add(v.group);
      return v;
    });
  }

  updatePoints(time) {
    const tmp = new THREE.Color();
    this.game.points.forEach((pt, i) => {
      const v = this.pointVis[i];
      tmp.set(pt.owner >= 0 ? PLAYER_COLORS[pt.owner] : NEUTRAL);
      if (!v.own.color.equals(tmp)) v.own.color.copy(tmp);
      if (v.beam) v.beam.rotation.y = time * 0.9;
      if (v.cloth) v.cloth.rotation.y = Math.sin(time * 2.4 + i) * 0.25;
    });
  }

  buildShields() {
    this.shieldVis = this.game.players.map((p) => {
      const r = DOME.range * SQ3 + 0.5;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.08, depthWrite: false }));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 48).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.7, depthWrite: false }));
      dome.add(rim);
      dome.renderOrder = 6;
      dome.visible = false;
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 14),
        new THREE.MeshBasicMaterial({ color: 0xffb63a, transparent: true, opacity: 0.3, depthWrite: false }));
      bubble.renderOrder = 6;
      bubble.visible = false;
      this.scene.add(dome);
      this.scene.add(bubble);
      return { dome, rim, bubble };
    });
  }

  updateShields(time) {
    const g = this.game;
    g.players.forEach((p, i) => {
      const v = this.shieldVis[i];
      const core = p.core;
      const domeOn = p.alive && core.alive && p.dome && p.dome.hp > 0;
      v.dome.visible = !!domeOn;
      if (domeOn) {
        const k = p.dome.hp / p.dome.maxHp;
        const col = k > 0.6 ? 0x4aa8ff : k > 0.3 ? 0xf2c94c : 0xef5350;
        v.dome.material.color.set(col);
        v.rim.material.color.set(col);
        const hit = g.time - p.dome.lastHit < 0.25;
        v.dome.material.opacity = hit ? 0.22 : 0.08;
        v.dome.position.set(core.x, core.y, core.z);
      }
      const shield = p.alive && core.alive && core.shieldUntil > g.time;
      v.bubble.visible = !!shield;
      if (shield) {
        v.bubble.position.set(core.x, core.y + 0.6, core.z);
        v.bubble.material.opacity = 0.22 + Math.sin(time * 6) * 0.08;
      }
    });
  }

  // ---------- vista previa de construcción ----------
  setGhost(type, ci, rot, valid) {
    if (this.ghost && (this.ghost.type !== type)) {
      this.scene.remove(this.ghost.group);
      this.ghost = null;
    }
    if (!type || ci < 0) {
      if (this.ghost) this.ghost.group.visible = false;
      return;
    }
    if (!this.ghost) {
      const m = getModel(type === 'wall' && GLB.wall_post ? 'wall_post' : type, PLAYER_COLORS[0]);
      // Holograma ámbar (documento pág. 7); rojo cuando no se puede.
      const okMat = new THREE.MeshBasicMaterial({ color: 0xffb63a, transparent: true, opacity: 0.55, depthWrite: false });
      const badMat = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.55, depthWrite: false });
      const group = new THREE.Group();
      const parts = [];
      const pp = m.partPos || {};
      for (const key of ['main', 'turret', 'rotor', 'rocker', 'blades', 'crystal']) {
        if (!m[key]) continue;
        const mesh = new THREE.Mesh(m[key], okMat);
        if (pp[key]) mesh.position.copy(pp[key]);
        else if (key === 'turret') mesh.position.set(0, m.turretY || 0, m.turretZ || 0);
        else if (key === 'rocker') mesh.position.set(0, m.rockerY, m.rockerZ || 0);
        else if (key === 'blades') mesh.position.set(0, m.bladesY, m.bladesZ);
        else if (key === 'crystal') mesh.position.y = m.crystalY;
        mesh.renderOrder = 7;
        group.add(mesh);
        parts.push(mesh);
      }
      this.scene.add(group);
      this.ghost = { type, group, parts, okMat, badMat };
    }
    const c = this.game.cells[ci];
    const gh = this.ghost;
    gh.group.visible = true;
    gh.group.position.set(c.x, c.h, c.z);
    gh.group.rotation.y = rot;
    for (const mesh of gh.parts) mesh.material = valid ? gh.okMat : gh.badMat;
    this.hoverMesh.material.color.set(valid ? 0x8dffb0 : 0xff6b6b);
    this.setHover(ci);
  }

  // Aspecto equipado en el Inventario: solo para tus tropas y tu Núcleo.
  lookFor(e) {
    const looks = this.game.opts.looks;
    if (!looks || e.owner !== 0) return null;
    return looks[skinSlotOf(e.kind === 'bld' ? 'bld' : 'unit', e.type)] || null;
  }

  // ---------- entidades ----------
  syncEntities(dt, time) {
    const g = this.game;
    for (const e of g.removed) {
      const v = this.vis.get(e.id);
      if (v) {
        this.scene.remove(v.group);
        this.vis.delete(e.id);
      }
    }
    g.removed.length = 0;

    const myTeam = g.players[0].team;
    for (const b of g.buildings) {
      // Núcleo, Torreta y Enfermería tienen un modelo distinto por nivel.
      const mkey = GLB[b.type + '_' + b.level] ? b.type + '_' + b.level : b.type;
      let v = this.vis.get(b.id);
      if (v && v.mkey !== mkey) {
        this.scene.remove(v.group);
        this.vis.delete(b.id);
        v = null;
      }
      if (!v) {
        v = b.type === 'wall' ? this.createWall(b) : createVisual(mkey, PLAYER_COLORS[b.owner], this.lookFor(b));
        v.mkey = mkey;
        v.group.rotation.y = b.type === 'wall' ? 0 : b.rot;
        v.group.position.set(b.x, b.y, b.z);
        this.scene.add(v.group);
        this.vis.set(b.id, v);
      }
      if (b.type === 'wall') this.updateWall(b, v);
      const k = b.built ? 1 : 0.2 + 0.8 * b.progress;
      v.main.scale.y = k;
      // Andamio mientras se construye o se mejora.
      const working = !b.built || !!b.upgrading;
      if (working && !v.scaffold && GLB.scaffold) {
        v.scaffold = new THREE.Mesh(getModel('scaffold', PLAYER_COLORS[b.owner]).main, GLB_MAT);
        v.scaffold.rotation.y = -v.group.rotation.y;
        if (b.type === 'core') v.scaffold.scale.set(1.35, 1.6, 1.35);
        v.group.add(v.scaffold);
      }
      if (v.scaffold) v.scaffold.visible = working;
      if (v.turret) {
        v.turret.position.y = v.turretBaseY * k;
        v.turret.rotation.y = b.aimYaw - b.rot;
      }
      if (v.blades && b.built) {
        if (b.type === 'hydro') v.blades.rotation.x += dt * 1.6;
        else v.blades.rotation.z += dt * 2.2;
      }
      if (v.rocker) {
        v.rocker.visible = b.built;
        v.rocker.rotation.x = b.built ? Math.sin(time * 2.2 + b.id) * (b.type === 'wave' ? 0.12 : 0.28) : 0;
      }
      if (v.rotor && b.built) v.rotor.rotation.y += dt * 1.6;
      if (v.crystal) {
        v.crystal.rotation.y = time * 0.8;
        v.crystal.position.y = (v.crystalBaseY || 1.35) + Math.sin(time * 1.6) * 0.08;
      }
    }
    for (const u of g.units) {
      let v = this.vis.get(u.id);
      if (!v) {
        v = createVisual(u.type, PLAYER_COLORS[u.owner], this.lookFor(u));
        this.scene.add(v.group);
        this.vis.set(u.id, v);
      }
      const seen = !u.inside && (u.visible || g.players[u.owner].team === myTeam);
      v.group.visible = seen;
      if (!seen) continue;
      let y = u.y;
      if (u.mover === 'sea') y += Math.sin(time * 2.2 + u.id) * 0.025;
      if (u.mover === 'air') y += Math.sin(time * 1.7 + u.id) * 0.06;
      v.group.position.set(u.x, y, u.z);
      v.group.rotation.y = u.yaw;
      if (u.mover === 'air') v.group.rotation.x = u.moving ? 0.12 : 0;
      if (v.turret) {
        const aiming = u.autoTarget && u.autoTarget.alive;
        const want = aiming ? u.aimYaw - u.yaw : 0;
        v.turret.rotation.y = lerpAngle(v.turret.rotation.y, want, Math.min(1, dt * 6));
      }
      if (v.rotor) v.rotor.rotation.y += dt * 22;
      if (v.legl) {
        // Paso: las piernas se balancean mientras la tropa camina.
        const sw = u.moving && !u.inside ? Math.sin(time * 10 + u.id) * 0.55 : 0;
        v.legl.rotation.x += (sw - v.legl.rotation.x) * Math.min(1, dt * 12);
        v.legr.rotation.x = -v.legl.rotation.x;
      }
    }
    this.updateUnitShields(time);
    this.updateSkyBeams(time);
  }

  // ---------- muralla: torreón + tramos hacia los muros vecinos ----------
  createWall(b) {
    const color = PLAYER_COLORS[b.owner];
    const v = createVisual(GLB.wall_post ? 'wall_post' : 'wall', color);
    v.segs = new THREE.Group();
    v.group.add(v.segs);
    v.mask = -1;
    return v;
  }

  updateWall(b, v) {
    const g = this.game;
    const c = g.cells[b.cell];
    let mask = 0;
    HEX_DIRS.forEach(([dq, dr], i) => {
      const n = g.map.get(c.q + dq, c.r + dr);
      if (n && n.bld && n.bld.alive && n.bld.type === 'wall' && n.bld.owner === b.owner) mask |= 1 << i;
    });
    if (mask === v.mask) return;
    v.mask = mask;
    while (v.segs.children.length) v.segs.remove(v.segs.children[0]);
    if (!GLB.wall_seg) return;
    const geo = getModel('wall_seg', PLAYER_COLORS[b.owner]).main;
    HEX_DIRS.forEach(([dq, dr], i) => {
      if (!(mask & (1 << i))) return;
      const w = hexToWorld(dq, dr);
      const seg = new THREE.Mesh(geo, GLB_MAT);
      seg.castShadow = true;
      seg.receiveShadow = true;
      seg.rotation.y = Math.atan2(w.x, w.z);
      v.segs.add(seg);
    });
  }

  // ---------- escudo personal de las tropas (Cúpula nivel 3) ----------
  updateUnitShields(time) {
    const g = this.game;
    if (!this.shieldMesh) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const mat = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.22, wireframe: true, depthWrite: false });
      this.shieldMesh = new THREE.InstancedMesh(geo, mat, 200);
      this.shieldMesh.count = 0;
      this.shieldMesh.renderOrder = 6;
      this.shieldMesh.frustumCulled = false;
      this.scene.add(this.shieldMesh);
    }
    const m = new THREE.Matrix4();
    let n = 0;
    const myTeam = g.players[0].team;
    for (const u of g.units) {
      if (n >= 200) break;
      if (!u.alive || u.inside || !(u.shield > 0)) continue;
      if (!u.visible && g.players[u.owner].team !== myTeam) continue;
      const s = (u.cls === 'inf' ? 0.42 : u.cls === 'ship' || u.cls === 'sub' ? 0.85 : 0.6) * (0.96 + Math.sin(time * 3 + u.id) * 0.04);
      m.makeScale(s, s, s).setPosition(u.x, u.y + s * 0.6, u.z);
      this.shieldMesh.setMatrixAt(n++, m);
    }
    this.shieldMesh.count = n;
    this.shieldMesh.instanceMatrix.needsUpdate = true;
    this.shieldCount = n;
  }

  // ---------- rayo ámbar al cielo sobre cada Núcleo (documento pág. 13) ----------
  updateSkyBeams(time) {
    const g = this.game;
    if (!this.skyBeams) {
      const geo = new THREE.CylinderGeometry(0.09, 0.22, 26, 10, 1, true);
      geo.translate(0, 13, 0);
      this.skyBeams = g.players.map(() => {
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0xffb63a, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        }));
        mesh.renderOrder = 4;
        this.scene.add(mesh);
        return mesh;
      });
    }
    g.players.forEach((p, i) => {
      const beam = this.skyBeams[i];
      const c = p.core;
      beam.visible = p.alive && c.alive;
      if (!beam.visible) return;
      beam.position.set(c.x, c.y + 1.2, c.z);
      beam.material.opacity = 0.18 + Math.sin(time * 2 + i) * 0.05;
    });
  }

  updateSelectionRings(selection) {
    const items = selection.filter((e) => e.alive);
    while (this.rings.length < items.length) {
      const r = new THREE.Mesh(this.ringGeo, this.ringMatOwn);
      r.renderOrder = 5;
      this.scene.add(r);
      this.rings.push(r);
    }
    this.rings.forEach((r, i) => {
      const e = items[i];
      if (!e) {
        r.visible = false;
        return;
      }
      r.visible = true;
      r.material = e.owner === 0 || (e.kind === 'point' && e.owner < 0) ? this.ringMatOwn : this.ringMatEnemy;
      const s = e.kind === 'bld' || e.kind === 'point' ? 1.85 : e.cls === 'inf' ? 0.75 : e.cls === 'ship' || e.cls === 'sub' ? 1.4 : 1.1;
      r.scale.setScalar(s);
      const y = e.kind === 'bld' || e.kind === 'point' ? e.y + 0.05 : e.mover === 'air' ? Math.max(this.game.cells[e.cell].h, 0) + 0.05 : Math.max(e.y, 0) + 0.04;
      r.position.set(e.x, y, e.z);
    });
    // Círculo de alcance de la tropa o defensa seleccionada.
    const one = items.length === 1 ? items[0] : null;
    const w = one && one.def && one.def.weapon;
    if (w && !one.inside) {
      const R = w.range * SQ3 + (one.kind === 'bld' ? 0.75 : 0.35);
      this.rangeRing.visible = true;
      this.rangeRing.scale.setScalar(R);
      this.rangeRing.userData.radius = R;
      const gy = one.kind === 'bld' ? one.y : Math.max(this.game.cells[one.cell].h, 0);
      this.rangeRing.position.set(one.x, gy + 0.06, one.z);
      this.rangeRing.material.color.set(one.owner === 0 ? 0xffffff : 0xff7070);
    } else {
      this.rangeRing.visible = false;
    }
    const b = items.length === 1 && items[0].kind === 'bld' && items[0].owner === 0 ? items[0] : null;
    if (b && b.rally >= 0) {
      const c = this.game.cells[b.rally];
      this.rallyFlag.visible = true;
      this.rallyFlag.position.set(c.x, Math.max(c.h, 0), c.z);
    } else this.rallyFlag.visible = false;
  }

  setPlacement(cells) {
    const m = new THREE.Matrix4();
    let n = 0;
    if (cells) {
      for (const ci of cells) {
        const c = this.game.cells[ci];
        m.makeTranslation(c.x, Math.max(c.h, 0) + 0.05, c.z);
        this.placeMesh.setMatrixAt(n++, m);
      }
    }
    this.placeMesh.count = n;
    this.placeMesh.instanceMatrix.needsUpdate = true;
  }

  setHover(ci) {
    if (ci < 0) {
      this.hoverMesh.visible = false;
      return;
    }
    const c = this.game.cells[ci];
    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(c.x, Math.max(c.h, 0) + 0.07, c.z);
  }

  // ---------- cámara ----------
  updateCamera() {
    const c = this.cam;
    const R = this.game.map.R * 1.5;
    const len = Math.hypot(c.tx, c.tz);
    if (len > R) {
      c.tx *= R / len;
      c.tz *= R / len;
    }
    c.dist = clamp(c.dist, 9, 70);
    const zt = (c.dist - 9) / 61;
    c.pitch = 0.78 + zt * 0.42;
    const cp = Math.cos(c.pitch);
    this.camera.position.set(
      c.tx + Math.sin(c.yaw) * cp * c.dist,
      Math.sin(c.pitch) * c.dist,
      c.tz + Math.cos(c.yaw) * cp * c.dist,
    );
    this.camera.lookAt(c.tx, 0, c.tz);
    this.camera.updateMatrixWorld();
    this.sun.position.set(c.tx - 16, 34, c.tz + 10);
    this.sun.target.position.set(c.tx, 0, c.tz);
    const span = clamp(c.dist * 1.1, 22, 60);
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - span) > 2) {
      sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
      sc.updateProjectionMatrix();
    }
  }

  screenToWorld(sx, sy, planeY = 0) {
    this._ndc.set((sx / this.width) * 2 - 1, -(sy / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this._ndc, this.camera);
    this._plane.constant = -planeY;
    const hit = this.raycaster.ray.intersectPlane(this._plane, this._p);
    return hit ? { x: hit.x, z: hit.z } : null;
  }

  pickCell(sx, sy) {
    const map = this.game.map;
    let p = this.screenToWorld(sx, sy, 0.3);
    if (!p) return null;
    let c = map.atWorld(p.x, p.z);
    if (!c) return null;
    p = this.screenToWorld(sx, sy, Math.max(c.h, 0));
    const c2 = p && map.atWorld(p.x, p.z);
    return c2 || c;
  }

  project(x, y, z) {
    this._p.set(x, y, z).project(this.camera);
    return { x: (this._p.x + 1) * 0.5 * this.width, y: (1 - this._p.y) * 0.5 * this.height, ok: this._p.z < 1 && this._p.z > -1 };
  }

  pickUnit(sx, sy, filter) {
    let best = null;
    let bd = Math.max(16, 520 / this.cam.dist);
    for (const u of this.game.units) {
      if (!u.alive || u.inside || (filter && !filter(u))) continue;
      if (!u.visible && this.game.players[u.owner].team !== this.game.players[0].team) continue;
      const s = this.project(u.x, u.y + 0.25, u.z);
      if (!s.ok) continue;
      const d = Math.hypot(s.x - sx, s.y - sy);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  unitsInRect(x1, y1, x2, y2, filter) {
    const lx = Math.min(x1, x2);
    const hx = Math.max(x1, x2);
    const ly = Math.min(y1, y2);
    const hy = Math.max(y1, y2);
    return this.game.units.filter((u) => {
      if (!u.alive || u.inside || (filter && !filter(u))) return false;
      const s = this.project(u.x, u.y + 0.2, u.z);
      return s.ok && s.x >= lx && s.x <= hx && s.y >= ly && s.y <= hy;
    });
  }

  // ---------- capa 2D: barras de vida ----------
  drawOverlay(selection) {
    const ctx = this.octx;
    ctx.clearRect(0, 0, this.width, this.height);
    const g = this.game;
    const sel = new Set(selection);
    const myTeam = g.players[0].team;
    const bar = (e, w, hTop) => {
      const s = this.project(e.x, e.y + hTop, e.z);
      if (!s.ok || s.x < -40 || s.y < -40 || s.x > this.width + 40 || s.y > this.height + 40) return;
      const x = Math.round(s.x - w / 2);
      const y = Math.round(s.y);
      ctx.fillStyle = 'rgba(12,16,22,0.75)';
      ctx.fillRect(x - 1, y - 1, w + 2, 6);
      if (e.kind === 'bld' && !e.built) {
        ctx.fillStyle = '#f5c542';
        ctx.fillRect(x, y, w * e.progress, 4);
        return;
      }
      const k = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = k > 0.55 ? '#5ee07a' : k > 0.28 ? '#f2c94c' : '#ef5350';
      ctx.fillRect(x, y, w * k, 4);
      ctx.fillStyle = hexColor(PLAYER_COLORS[e.owner]);
      ctx.fillRect(x - 1, y - 1, 3, 6);
    };
    // Progreso de captura sobre el Faro y las Banderas.
    for (const pt of g.points) {
      const busy = pt.contested || (pt.prog > 0 && pt.prog < 1) || (pt.owner >= 0 && pt.prog < 1);
      if (!busy && !sel.has(pt)) continue;
      const s = this.project(pt.x, pt.y + (pt.type === 'faro' ? 3.3 : 1.7), pt.z);
      if (!s.ok) continue;
      const R = pt.type === 'faro' ? 15 : 12;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(12,16,22,0.7)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
      ctx.stroke();
      const capColor = pt.owner >= 0 ? PLAYER_COLORS[pt.owner]
        : pt.capTeam >= 0 ? PLAYER_COLORS[g.players.findIndex((p) => p.team === pt.capTeam)] : NEUTRAL;
      ctx.strokeStyle = hexColor(capColor);
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(pt.prog, 0, 1));
      ctx.stroke();
      if (pt.contested) {
        ctx.fillStyle = '#ffd36a';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('En disputa', s.x, s.y + R + 14);
      }
    }
    // Obras: «En construcción» o «Mejorando», con progreso y aviso si no hay constructor.
    for (const bl of g.buildings) {
      if (!bl.alive || g.players[bl.owner].team !== myTeam) continue;
      const working = !bl.built || bl.upgrading;
      if (!working && bl.level < 2) continue;
      const s = this.project(bl.x, bl.y + (bl.type === 'core' ? 2.4 : 1.45), bl.z);
      if (!s.ok || s.x < -60 || s.y < -30 || s.x > this.width + 60 || s.y > this.height + 30) continue;
      if (working) {
        const k = bl.upgrading ? bl.upgrading.progress : bl.progress;
        const idle = g.time - bl.lastWork > 1.5 && bl.type !== 'outpost';
        const text = (bl.upgrading ? `Mejorando a nivel ${bl.upgrading.level}` : 'En construcción') + ` · ${Math.floor(k * 100)} %`;
        ctx.font = '600 11px system-ui, sans-serif';
        const w = Math.max(ctx.measureText(text).width, idle ? ctx.measureText('Sin constructor').width : 0) + 14;
        const h = idle ? 32 : 20;
        ctx.fillStyle = 'rgba(12,16,22,0.85)';
        ctx.fillRect(s.x - w / 2, s.y - h, w, h);
        ctx.fillStyle = '#f2ab38';
        ctx.fillRect(s.x - w / 2, s.y - 3, w * clamp(k, 0, 1), 3);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#edf3f7';
        ctx.fillText(text, s.x, s.y - h + 13);
        if (idle) {
          ctx.fillStyle = '#ff9a9b';
          ctx.fillText('Sin constructor', s.x, s.y - h + 26);
        }
      } else if (bl.owner === 0) {
        // Nivel 2 o 3: marcas doradas.
        for (let i = 0; i < bl.level - 1; i++) {
          const x = s.x - (bl.level - 2) * 5 + i * 10;
          ctx.fillStyle = '#f2ab38';
          ctx.beginPath();
          ctx.moveTo(x, s.y - 12);
          ctx.lineTo(x + 4, s.y - 8);
          ctx.lineTo(x, s.y - 4);
          ctx.lineTo(x - 4, s.y - 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Icono de combate donde hay peleas.
    for (const f of g.fights) {
      const age = g.time - f.t;
      if (age > 1.6) continue;
      const s = this.project(f.x, (f.y || 0) + 1.1, f.z);
      if (!s.ok) continue;
      const c = g.cells[f.cell];
      if (g.fog && c && c.owner !== 0 && !g.units.some((u) => u.owner === 0 && Math.hypot(u.x - f.x, u.z - f.z) < 7)) continue;
      const r = 8 + Math.sin(age * 12) * 1.5;
      ctx.globalAlpha = 1 - age / 1.6;
      ctx.fillStyle = '#ff8a30';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    this.fightIcons = g.fights.filter((f) => g.time - f.t <= 1.6).length;
    // Producción a la vista: progreso y cola sobre tus edificios que entrenan.
    for (const bl of g.buildings) {
      if (!bl.alive || bl.owner !== 0 || !bl.queue.length) continue;
      const s = this.project(bl.x, bl.y + 1.55, bl.z);
      if (!s.ok || s.x < -30 || s.y < -30 || s.x > this.width + 30 || s.y > this.height + 30) continue;
      const q = bl.queue[0];
      const k = clamp(q.t / UNITS[q.type].build, 0, 1);
      ctx.fillStyle = 'rgba(12,16,22,0.82)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f2ab38';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
      ctx.stroke();
      ctx.fillStyle = '#edf3f7';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(bl.queue.length), s.x, s.y + 0.5);
      ctx.textBaseline = 'alphabetic';
    }
    this.prodBadges = g.buildings.filter((bl) => bl.alive && bl.owner === 0 && bl.queue.length).length;
    const recent = g.time - 4;
    for (const b of g.buildings) {
      if (!b.alive) continue;
      if (b.hp < b.maxHp || !b.built || sel.has(b) || b.lastHit > recent) bar(b, b.type === 'core' ? 56 : 40, b.type === 'core' ? 2.0 : 1.15);
    }
    for (const u of g.units) {
      if (!u.alive || u.inside) continue;
      if (!u.visible && g.players[u.owner].team !== myTeam) continue;
      if (u.hp < u.maxHp || sel.has(u)) bar(u, u.cls === 'inf' ? 22 : 30, u.mover === 'air' ? 0.7 : u.cls === 'inf' ? 0.8 : 0.75);
    }
  }

  // ---------- minimapa ----------
  minimapTransform(size) {
    const R = this.game.map.R;
    const ext = SQ3 * R + 1.2;
    const s = size / (ext * 2);
    return { s, ox: size / 2, oz: size / 2 };
  }

  drawMinimap(canvas) {
    const g = this.game;
    const size = canvas.width;
    const ctx = canvas.getContext('2d');
    const T = this.minimapTransform(size);
    if (!this.miniBase || this.miniBase.width !== size || this.miniDirty) {
      this.miniDirty = false;
      const base = this.miniBase && this.miniBase.width === size ? this.miniBase : document.createElement('canvas');
      base.width = size;
      base.height = size;
      const b = base.getContext('2d');
      b.fillStyle = '#16405a';
      b.fillRect(0, 0, size, size);
      const r = T.s * 1.02;
      const tmp = new THREE.Color();
      for (const c of g.cells) {
        tmp.set(TERRAIN[c.t].color);
        if (c.t === 'deep') continue;
        if (c.owner >= 0) tmp.lerp(new THREE.Color(PLAYER_COLORS[c.owner]), TERRAIN[c.t].water ? 0.35 : 0.45);
        b.fillStyle = '#' + tmp.getHexString();
        const cx = T.ox + c.x * T.s;
        const cy = T.oz + c.z * T.s;
        b.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r;
          if (k === 0) b.moveTo(px, py);
          else b.lineTo(px, py);
        }
        b.fill();
      }
      this.miniBase = base;
    }
    ctx.drawImage(this.miniBase, 0, 0);
    const myTeam = g.players[0].team;
    for (const pt of g.points) {
      const x = T.ox + pt.x * T.s;
      const y = T.oz + pt.z * T.s;
      ctx.fillStyle = pt.owner >= 0 ? hexColor(PLAYER_COLORS[pt.owner]) : '#e6e8ea';
      ctx.strokeStyle = pt.type === 'faro' ? '#ffb63a' : '#1b2630';
      ctx.lineWidth = pt.type === 'faro' ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    for (const bl of g.buildings) {
      ctx.fillStyle = hexColor(PLAYER_COLORS[bl.owner]);
      const x = T.ox + bl.x * T.s;
      const y = T.oz + bl.z * T.s;
      const s = bl.type === 'core' ? 7 : 4;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      if (bl.type === 'core') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - s / 2, y - s / 2, s, s);
      }
    }
    for (const u of g.units) {
      if (u.inside || (!u.visible && g.players[u.owner].team !== myTeam)) continue;
      ctx.fillStyle = hexColor(PLAYER_COLORS[u.owner]);
      ctx.beginPath();
      ctx.arc(T.ox + u.x * T.s, T.oz + u.z * T.s, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pulsos de alerta
    const now = performance.now();
    this.pings = this.pings.filter((pg) => now - pg.t < 5000);
    for (const pg of this.pings) {
      const k = ((now - pg.t) % 1000) / 1000;
      ctx.strokeStyle = pg.kind === 'bad' ? `rgba(255,90,90,${1 - k})` : `rgba(242,171,56,${1 - k})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(T.ox + pg.x * T.s, T.oz + pg.z * T.s, 4 + k * 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Vista de la cámara
    const corners = [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]];
    const pts = corners.map(([x, y]) => this.screenToWorld(x, y, 0));
    if (pts.every(Boolean)) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = T.ox + p.x * T.s;
        const y = T.oz + p.z * T.s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }

  minimapToWorld(canvas, mx, my) {
    const T = this.minimapTransform(canvas.width);
    const k = canvas.width / canvas.clientWidth;
    return { x: (mx * k - T.ox) / T.s, z: (my * k - T.oz) / T.s };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.isInstancedMesh || o === this.borderMesh || o === this.tracerLines) {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material !== MODEL_MAT) o.material.dispose();
      }
    });
  }

  // ---------- cuadro ----------
  frame(dt, time, selection) {
    const g = this.game;
    if (g.territoryVersion !== this.lastTerritory) {
      this.lastTerritory = g.territoryVersion;
      this.tintTerritory();
      this.rebuildBorders();
      this.miniDirty = true;
    }
    const bkey = g.buildings.length * 1e6 + (g.buildings.length ? g.buildings[g.buildings.length - 1].id : 0);
    if (bkey !== this.lastBuildCount) {
      this.lastBuildCount = bkey;
      this.refreshDecor();
    }
    if (this.placeMesh.count) this.placeMesh.material.opacity = 0.32 + Math.sin(time * 4) * 0.14;
    this.consumeFx();
    this.syncEntities(dt, time);
    this.updateFx(dt);
    this.updateLasers(dt);
    this.updatePoints(time);
    this.updateShields(time);
    this.updateSelectionRings(selection);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(selection);
  }
}
