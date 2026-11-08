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
  quality: 'high', // calidad que se usa ahora: 'high' o 'low'
  qualityPref: 'auto', // la elegida en la pausa: 'auto', 'high' o 'low'
  showFps: false,
  fps: 0,
  fpsFrames: 0,
  fpsT: 0,
  lowFpsSecs: 0,
  opts: { mode: 'conquest', mapKind: 'archipelago', difficulty: 'normal', seed: 0 },
  suspended: null,
  lobby: null,
  saveT: 15,
  last: 0,
  time: 0,
  miniT: 0,
  endTimer: null,

  init(hotData) {
    window.FARO = this;
    this.canvas = $('gl');
    this.overlay = $('overlay');
    try {
      const q = localStorage.getItem('faro-quality');
      if (q === 'high' || q === 'low' || q === 'auto') this.qualityPref = q;
      this.showFps = localStorage.getItem('faro-fps') === 'on';
    } catch (err) { /* sin almacenamiento */ }
    Profile.load();
    this.quality = this.qualityPref === 'low' ? 'low' : 'high';
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
    // Primero los modelos de Blender; si fallan, se usan los modelos de código.
    this.ready = Promise.all([loadGLBModels().catch(() => 0), loadEnvMap(this.gl).catch(() => null)]).then(([n]) => {
      this.modelCount = n;
      this.ui = new UI(this);
      this.input = new Input(this);
      this.lobby = new Lobby(this);
      this.makePreview();
      this.ui.showScreen('menu');
      this.loaded = true;
      // Modo creador: solo si la plataforma confirma que quien abre el juego es su dueño.
      Creator.detect().then(() => this.lobby.render());
    });

    window.addEventListener('resize', () => this.renderer && this.renderer.resize());
    // Safari en iPad: evita que el gesto de pellizco haga zoom a toda la página.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play' && !this.game.over) {
        this.togglePause(true);
        Save.write(this.game);
      }
    });
    // Si se cierra la pestaña sin querer, la partida queda guardada.
    window.addEventListener('pagehide', () => {
      if (this.state === 'play' && this.game && !this.game.over) Save.write(this.game);
    });
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
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
    this.game.preview = true;
    this.newRenderer(this.game);
    const r = this.renderer;
    r.cam.tx = 0;
    r.cam.tz = 0;
    r.cam.dist = this.game.map.R * 2.3;
    this.selection = [];
  },

  // Opciones de la partida: las del vestíbulo, el aspecto equipado y el modo creador.
  gameOpts() {
    const o = { ...this.opts, looks: Profile.looks() };
    delete o.creator;
    delete o.instantBuild;
    if (Creator.active()) {
      o.creator = true;
      o.instantBuild = !!Profile.data.creator.instant;
    }
    return o;
  },

  startGame() {
    clearTimeout(this.endTimer);
    if (this.game && this.game.over && !this.game.preview) this.lobby.finish(this.game);
    this.input.cancelPlacement();
    this.input.boxMode = false;
    this.suspended = null;
    Save.clear();
    this.game = new Game(this.gameOpts());
    this.enterGame();
  },

  enterGame(keepRenderer) {
    if (!keepRenderer) this.newRenderer(this.game);
    this.selection = [];
    this.paused = false;
    this.state = 'play';
    this.saveT = 15;
    this.ui.showScreen('play');
    this.ui.startHud();
    this.sound.unlock();
    window.FARO = this;
  },

  // Salir al menú no borra la partida (punto 16): queda en pausa para «Volver a la partida».
  toMenu() {
    clearTimeout(this.endTimer);
    this.input.cancelPlacement();
    const g = this.game;
    if (g && !g.preview) {
      if (g.over) {
        this.lobby.finish(g);
        this.suspended = null;
        Save.clear();
      } else {
        this.suspended = g;
        Save.write(g);
      }
    }
    this.state = 'menu';
    this.paused = false;
    $('pause').hidden = true;
    if (!this.suspended) {
      this.opts.seed = (Math.random() * 1e9) | 0;
      this.makePreview();
    }
    this.ui.showScreen('menu');
  },

  resumeGame() {
    const g = this.suspended;
    if (!g || g.over) return;
    this.suspended = null;
    const same = this.game === g;
    this.game = g;
    this.enterGame(same);
    this.focusCore();
  },

  loadSavedGame() {
    const g = Save.read();
    if (!g) {
      Save.clear();
      this.ui.toast('No se pudo abrir la partida guardada', 'bad');
      this.lobby.render();
      return;
    }
    // El modo creador solo sigue activo para el dueño del juego.
    if (g.creator && !Creator.owner) {
      g.creator = false;
      g.opts.creator = false;
      g.opts.instantBuild = false;
    }
    this.suspended = null;
    this.game = g;
    this.enterGame(false);
    this.focusCore();
  },

  abandonGame() {
    this.suspended = null;
    Save.clear();
    this.opts.seed = (Math.random() * 1e9) | 0;
    this.makePreview();
    this.lobby.render();
  },

  togglePause(on) {
    if (this.state !== 'play') return;
    this.paused = on;
    $('pause').hidden = !on;
    this.markQuality();
  },

  markQuality() {
    document.querySelectorAll('[data-quality]').forEach((b) => b.classList.toggle('gold', b.dataset.quality === this.qualityPref));
    const note = $('quality-note');
    if (note) {
      note.textContent = this.qualityPref === 'auto'
        ? `Ahora: ${this.quality === 'high' ? 'alta calidad' : 'más fluido'}${this.fps ? ` · ${this.fps} cuadros por segundo` : ''}`
        : '';
    }
  },

  // Gráficos: «Automática» empieza en alta calidad y baja sola si el iPad no llega a 40 cuadros por segundo.
  setQuality(q) {
    this.qualityPref = q;
    try { localStorage.setItem('faro-quality', q); } catch (err) { /* sin almacenamiento */ }
    this.quality = q === 'low' ? 'low' : 'high';
    this.lowFpsSecs = 0;
    if (this.renderer) this.renderer.applyQuality(this.quality);
    this.markQuality();
  },

  toggleFps(on = !this.showFps) {
    this.showFps = on;
    try { localStorage.setItem('faro-fps', on ? 'on' : 'off'); } catch (err) { /* sin almacenamiento */ }
    $('fps').hidden = !on;
    $('btn-fps').textContent = `Contador de cuadros: ${on ? 'sí' : 'no'}`;
  },

  // Se llama una vez por segundo con los cuadros por segundo medidos.
  autoQuality(fps) {
    this.fps = fps;
    if (this.showFps) $('fps').textContent = `${fps} fps`;
    if (this.qualityPref !== 'auto' || this.quality !== 'high' || this.state !== 'play' || this.paused) {
      this.lowFpsSecs = 0;
      return false;
    }
    this.lowFpsSecs = fps < 40 ? this.lowFpsSecs + 1 : 0;
    if (this.lowFpsSecs < 4) return false;
    this.quality = 'low';
    this.lowFpsSecs = 0;
    if (this.renderer) this.renderer.applyQuality('low');
    this.ui.toast(`Gráficos: más fluido (automático, ${fps} cuadros por segundo)`, 'info');
    return true;
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

  focusAt(x, z) {
    if (!this.renderer) return;
    this.renderer.cam.tx = x;
    this.renderer.cam.tz = z;
    this.renderer.addPing(x, z, 'look');
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
      if (ev.type === 'toast') this.ui.toast(ev.text, ev.kind, ev.x !== undefined ? { x: ev.x, z: ev.z } : null);
      else if (ev.type === 'ping') this.renderer.addPing(ev.x, ev.z, ev.kind);
      else if (ev.type === 'chat') {
        this.ui.chat(ev.msg);
        if (ev.msg.toMe && ev.msg.x !== undefined) this.renderer.addPing(ev.msg.x, ev.msg.z, 'bad');
      }
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
        Save.clear();
        this.lobby.finish(g);
        this.endTimer = setTimeout(() => this.ui.showEnd(ev.result), 1600);
        this.sound.play(ev.result === 'victory' ? 'done' : 'alarm');
      }
    }
    g.events.length = 0;
  },

  loop(now) {
    if (!this.loaded) {
      this.last = now;
      requestAnimationFrame((t) => this.loop(t));
      return;
    }
    const raw = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, raw);
    this.last = now;
    // Cuadros por segundo reales (para el contador y la calidad automática).
    this.fpsFrames++;
    this.fpsT += raw;
    if (this.fpsT >= 1) {
      this.autoQuality(Math.round(this.fpsFrames / this.fpsT));
      this.fpsFrames = 0;
      this.fpsT = 0;
    }
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
        // Guardado automático cada 15 s.
        this.saveT -= dt;
        if (this.saveT <= 0) {
          this.saveT = 15;
          if (!this.game.over) Save.write(this.game);
        }
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
      console.error('[Faro] Error en el bucle:', err);
    }
    requestAnimationFrame((t) => this.loop(t));
  },
};

const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready((data) => App.init(data || {}));
else App.init((hot && hot.data) || {});
