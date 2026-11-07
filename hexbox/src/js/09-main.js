'use strict';
// Arranque y bucle principal.

const App = {
  state: 'menu',
  game: null,
  renderer: null,
  gl: null,
  input: null,
  ui: null,
  sound: null,
  selection: [],
  paused: false,
  quality: 'high',
  opts: { mode: 'ffa', mapKind: 'archipelago', difficulty: 'normal', fog: false, turbo: false, seed: 0 },
  last: 0,
  time: 0,
  miniT: 0,
  endTimer: null,

  init(hotData) {
    this.canvas = $('gl');
    this.overlay = $('overlay');
    try {
      const saved = JSON.parse(localStorage.getItem('hexbox-opts') || 'null');
      if (saved && MODES[saved.mode] && MAPS[saved.mapKind] && DIFFICULTY[saved.difficulty]) {
        Object.assign(this.opts, saved);
      }
      const q = localStorage.getItem('hexbox-quality');
      if (q === 'high' || q === 'low') this.quality = q;
    } catch (err) { /* sin almacenamiento */ }
    if (hotData && hotData.opts && MODES[hotData.opts.mode]) Object.assign(this.opts, hotData.opts);
    this.opts.seed = (Math.random() * 1e9) | 0;
    // Al republicar la página, conserva las opciones elegidas en el menú.
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => ({ opts: { ...this.opts } }));
    }

    try {
      this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      document.body.insertAdjacentHTML('beforeend',
        '<div class="screen"><div class="dialog panel"><h2>Sin 3D</h2><p>Tu navegador no pudo iniciar WebGL. Prueba con Safari o Chrome actualizados.</p></div></div>');
      return;
    }
    Thumbs.init();
    this.sound = new Sound();
    this.ui = new UI(this);
    this.input = new Input(this);
    this.makePreview();
    this.ui.showScreen('menu');

    window.addEventListener('resize', () => this.renderer && this.renderer.resize());
    // Safari en iPad: evita que el gesto de pellizco haga zoom a toda la página.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play' && !this.game.over) this.togglePause(true);
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  saveOpts() {
    try {
      const { mode, mapKind, difficulty, fog, turbo } = this.opts;
      localStorage.setItem('hexbox-opts', JSON.stringify({ mode, mapKind, difficulty, fog, turbo }));
    } catch (err) { /* sin almacenamiento */ }
  },

  setOption(key, value) {
    this.opts[key] = value;
    this.saveOpts();
    if (key === 'mode' || key === 'mapKind') this.makePreview();
  },

  reroll() {
    this.opts.seed = (Math.random() * 1e9) | 0;
    this.makePreview();
  },

  newRenderer(game) {
    if (this.renderer) this.renderer.dispose();
    this.renderer = new Renderer(this.gl, this.canvas, this.overlay, game, this.quality);
  },

  makePreview() {
    this.game = new Game({ ...this.opts });
    this.newRenderer(this.game);
    const r = this.renderer;
    r.cam.tx = 0;
    r.cam.tz = 0;
    r.cam.dist = this.game.map.R * 2.3;
    this.selection = [];
  },

  startGame() {
    clearTimeout(this.endTimer);
    this.input.cancelPlacement();
    this.input.boxMode = false;
    this.game = new Game({ ...this.opts });
    this.newRenderer(this.game);
    this.selection = [];
    this.paused = false;
    this.state = 'play';
    this.ui.showScreen('play');
    this.ui.startHud();
    this.sound.unlock();
    window.HEXBOX = this;
  },

  toMenu() {
    clearTimeout(this.endTimer);
    this.input.cancelPlacement();
    this.state = 'menu';
    this.paused = false;
    this.opts.seed = (Math.random() * 1e9) | 0;
    this.makePreview();
    this.ui.showScreen('menu');
  },

  togglePause(on) {
    if (this.state !== 'play') return;
    this.paused = on;
    $('pause').hidden = !on;
    document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('gold', b.dataset.quality === this.quality));
  },

  setQuality(q) {
    this.quality = q;
    try { localStorage.setItem('hexbox-quality', q); } catch (err) { /* sin almacenamiento */ }
    if (this.renderer) this.renderer.applyQuality(q);
    document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('gold', b.dataset.quality === q));
  },

  setSelection(list) {
    this.selection = list.filter((e) => e && e.alive && !e.inside);
    this.ui.demolishArm = -1;
    if (this.input.placement && this.input.placement.kind === 'found' && !this.selection.includes(this.input.placement.unit)) {
      this.input.cancelPlacement();
    }
    this.ui.renderSel(true);
  },

  quickSelect(kind) {
    const g = this.game;
    if (!g) return;
    const list = g.units.filter((u) => u.owner === 0 && u.alive && !u.inside && u.def.weapon && (
      kind === 'army' ? u.mover === 'land' : kind === 'sea' ? u.mover === 'sea' : u.mover === 'air'));
    if (!list.length) {
      this.ui.toast(kind === 'army' ? 'No tienes tropas de tierra' : kind === 'sea' ? 'No tienes barcos de combate' : 'No tienes unidades aéreas');
      return;
    }
    this.setSelection(list);
    this.sound.play('click');
  },

  focusCore() {
    const g = this.game;
    if (!g || !this.renderer) return;
    const core = g.players[0].core;
    this.renderer.cam.tx = core.x;
    this.renderer.cam.tz = core.z;
  },

  drainEvents() {
    const g = this.game;
    for (const ev of g.events) {
      if (ev.type === 'toast') this.ui.toast(ev.text, ev.kind);
      else if (ev.type === 'sound') {
        let vol = 1;
        if (ev.x !== undefined && this.renderer) {
          const d = Math.hypot(ev.x - this.renderer.cam.tx, ev.z - this.renderer.cam.tz);
          const reach = this.renderer.cam.dist * 1.2;
          if (d > reach) continue;
          vol = 1 - d / reach;
        }
        if (ev.pid !== undefined && ev.pid !== 0) continue;
        this.sound.play(ev.name, vol);
      } else if (ev.type === 'objective') this.ui.markObjective(ev.id);
      else if (ev.type === 'built' || ev.type === 'spawned') this.ui.selSig = '';
      else if (ev.type === 'over') {
        this.endTimer = setTimeout(() => this.ui.showEnd(ev.result), 1600);
        this.sound.play(ev.result === 'victory' ? 'done' : 'alarm');
      }
    }
    g.events.length = 0;
  },

  loop(now) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    try {
      if (this.state === 'play' && this.game) {
        if (!this.paused) this.game.update(dt);
        this.drainEvents();
        this.input.update(dt);
        if (this.selection.some((e) => !e.alive || e.inside)) this.setSelection(this.selection);
        if (this.input.placement && this.input.placement.kind === 'build') {
          this.input.placeT = (this.input.placeT || 0) - dt;
          if (this.input.placeT <= 0) {
            this.input.placeT = 1;
            this.input.refreshPlacement();
          }
        }
        this.renderer.frame(this.paused ? 0 : dt, this.time, this.selection);
        this.ui.update(dt);
        this.miniT -= dt;
        if (this.miniT <= 0) {
          this.miniT = 0.2;
          this.renderer.drawMinimap($('minimap'));
        }
      } else if (this.renderer) {
        this.renderer.cam.yaw += dt * 0.05;
        this.renderer.frame(dt, this.time, []);
      }
    } catch (err) {
      console.error('[HEXBOX] Error en el bucle:', err);
    }
    requestAnimationFrame((t) => this.loop(t));
  },
};

const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready((data) => App.init(data || {}));
else App.init((hot && hot.data) || {});
