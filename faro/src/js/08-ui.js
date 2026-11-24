'use strict';
// Interfaz HTML: menú, barra superior, panel de construcción, panel de selección,
// avisos, objetivos, pausa y pantalla final. También el sonido sintetizado.

const $ = (id) => document.getElementById(id);

const ICON_UP = '⬆';
const ICON = {
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pop: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10h10V5l7 7-7 7v-5H4z"/></svg>',
};
// Iconos de los botones de acción (v0.8). bi(nombre) devuelve el icono listo para poner antes del texto.
const BTN_ICON = {
  amove: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  formation: '<path d="M4 8h3M10.5 8h3M17 8h3M4 15h3M10.5 15h3M17 15h3"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  // v1.3: «Más detalles» (lista) y «Menos» (flecha arriba).
  more: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  // v1.4: patrullar (ida y vuelta), mantener posición (ancla), reparar, siempre (bucle).
  patrol: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  hold: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M6 14a6 6 0 0 0 12 0M4 12h3M17 12h3"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  less: '<path d="M6 15l6-6 6 6"/>',
  upgrade: '<path d="M12 19V6M6 11l6-6 6 6"/><path d="M6 20h12"/>',
  demolish: '<path d="M5 5l14 14M19 5 5 19"/>',
  rally: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5"/>',
  group: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  unload: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  found: '<path d="M6 21V4h10l-2 3.5L16 11H6M18 15v6M15 18h6"/>',
  dome: '<path d="M3 18a9 9 0 0 1 18 0zM2 18h20"/>',
  // v1.7: centrar la cámara y uso estratégico.
  center: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  strat: '<path d="M12 3l8 3.5v5c0 4.6-3.3 8-8 9.5-4.7-1.5-8-4.9-8-9.5v-5z"/><path d="M12 8v5M12 16.2v.3"/>',
};
const bi = (k) => `<span class="bi" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${BTN_ICON[k]}</svg></span>`;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

class UI {
  constructor(app) {
    this.app = app;
    this.tab = 'eco';
    this.selSig = '';
    this.buildSig = '';
    this.slowT = 0;
    this.lastToast = {};
    this.demolishArm = -1;
    this.playersSig = '';
    this.edgeAlerts = [];
    this.initHud();
  }

  showScreen(name) {
    $('menu').hidden = name !== 'menu';
    $('hud').hidden = name !== 'play';
    $('pause').hidden = true;
    $('end').hidden = true;
    $('brief').hidden = true;
    $('modal').hidden = true;
    if (this.app.lobby) {
      this.app.lobby.modal = null;
      if (name === 'menu') this.app.lobby.render();
    }
  }

  // Objetivos de la partida: en el Tutorial son sus 3 pasos.
  objList() {
    const g = this.app.game;
    return g && g.mode.tutorial ? TUTORIAL_STEPS : OBJECTIVES;
  }

  // ---------- campaña ----------
  // Historia y metas al empezar una misión. La partida espera en pausa hasta «¡A jugar!».
  showBrief() {
    const app = this.app;
    const m = Campaign.def(app.game.camp.id);
    app.paused = true;
    const el = $('brief');
    el.innerHTML = `<div class="dialog panel wide brief" role="dialog" aria-labelledby="brief-title">
      <small class="lbl">${L$`Campaña · Misión ${m.id} de ${CAMPAIGN.length}`}</small>
      <h2 id="brief-title">${esc(m.name)}</h2>
      <p class="story">${esc(m.story)}</p>
      <div class="brief-grid">
        <div><h3 class="lbl">${L$`Meta`}</h3><p><b>${esc(Campaign.goalText(m))}</b></p></div>
        <div><h3 class="lbl">${L$`Estrellas`}</h3><ul class="starlist"><li><b>${L$`★ Termina la misión`}</b></li>
          ${m.stars.map((s) => `<li><b>★ ${esc(Campaign.starText(s))}</b></li>`).join('')}</ul></div>
      </div>
      <p class="tip"><b>${L$`Consejo:`}</b> ${esc(m.tip)}</p>
      <div class="row brief-go"><button class="btn gold" type="button" id="btn-brief-go">${L$`¡A jugar!`}</button>
        <button class="btn" type="button" id="btn-brief-menu">${L$`Vestíbulo`}</button></div>
    </div>`;
    el.hidden = false;
    $('btn-brief-go').addEventListener('click', () => {
      app.sound.unlock();
      app.sound.play('click');
      this.hideBrief();
    });
    $('btn-brief-menu').addEventListener('click', () => {
      this.hideBrief();
      app.toMenu();
      app.abandonGame();
    });
  }

  hideBrief() {
    $('brief').hidden = true;
    this.app.paused = false;
  }

  // Panel de la misión: meta con su progreso y las estrellas (con su estado en vivo).
  renderMission(force) {
    const g = this.app.game;
    if (!g || !g.camp) return;
    const lines = Campaign.goalLines(g).map((l) => `<li class="${l.done ? 'done' : ''}">${esc(l.text)}</li>`);
    const stars = Campaign.stars(g).slice(1).map((s) =>
      `<li class="star ${s.live ? '' : 'lost'}"><span>${esc(s.text)}<small>${esc(s.live ? s.now : T$('ya no se puede'))}</small></span></li>`);
    const html = lines.join('') + stars.join('');
    if (!force && html === this.missionSig) return;
    this.missionSig = html;
    $('objlist').innerHTML = html;
  }

  // ---------- HUD ----------
  initHud() {
    const app = this.app;
    $('btn-pause').addEventListener('click', () => app.togglePause(true));
    $('btn-resume').addEventListener('click', () => app.togglePause(false));
    $('btn-restart').addEventListener('click', () => app.startGame());
    $('btn-spec-exit').addEventListener('click', () => app.toMenu());
    // v1.2: tocar un mensaje abre el panel de Mensajes.
    $('feed').addEventListener('click', (e) => { if (!e.target.closest('button')) { this.chatKey = null; if (this.pop !== 'chat') this.togglePop('chat'); } });
    $('btn-quit').addEventListener('click', () => app.toMenu());
    $('btn-fps').addEventListener('click', () => app.toggleFps());
    app.toggleFps(app.showFps);
    // v1.9: idioma. Se guarda y el juego se vuelve a abrir en ese idioma (la partida en curso queda guardada).
    document.querySelectorAll('[data-lang]').forEach((b) => {
      b.addEventListener('click', () => {
        const lang = b.dataset.lang;
        if (lang === I18N.lang) return;
        I18N.choose(lang);
        if (app.state === 'play' && app.game && !app.game.over && !app.game.spectating && !app.game.preview) Save.write(app.game);
        location.reload();
      });
    });
    this.markLang();
    document.querySelectorAll('[data-quality]').forEach((b) => {
      b.addEventListener('click', () => app.setQuality(b.dataset.quality));
    });
    // Música (v1.1): volumen en la pausa y botón en el vestíbulo.
    document.querySelectorAll('[data-music]').forEach((b) => {
      b.addEventListener('click', () => { app.sound.unlock(); app.music.setLevel(Number(b.dataset.music)); this.updateMusicBtns(); });
    });
    $('btn-music-lobby').addEventListener('click', () => {
      app.sound.unlock();
      const lv = app.music.level > 0 ? 0 : 0.6;
      app.music.setLevel(lv);
      if (lv > 0) app.music.play(app.state === 'play' ? 'battle' : 'lobby');
      this.updateMusicBtns();
    });
    this.updateMusicBtns();
    // v1.4: ahorro de batería, daltonismo y letra grande.
    $('btn-battery').addEventListener('click', () => app.setBattery(!app.battery));
    document.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => app.setLight(b.dataset.light)));
    this.updateLightBtns();
    $('btn-cvd').addEventListener('click', () => app.setCvd(!app.cvd));
    $('btn-bigtext').addEventListener('click', () => app.setBigText(!app.bigText));
    $('btn-calm').addEventListener('click', () => app.setCalm(!app.calm));
    $('ui-scale').addEventListener('input', (e) => app.setUiScale(Number(e.target.value)));
    // v1.8: Ajustes «A tu manera».
    $('btn-pause-settings').addEventListener('click', () => this.openSettings());
    $('btn-settings-back').addEventListener('click', () => this.closeSettings());
    $('btn-settings-reset').addEventListener('click', () => this.resetSettings());
    $('btn-orbit').addEventListener('click', () => app.setOrbit(app.orbit === false));
    $('settings').addEventListener('click', (e) => {
      const t = e.target.closest('[data-setsec]');
      if (t) this.showSettingsSection(t.dataset.setsec);
      else if (e.target === $('settings')) this.closeSettings();
    });
    // v1.7: ventana de confirmación del uso estratégico.
    $('strat').addEventListener('click', (e) => {
      if (e.target.closest('#btn-strat-ok')) this.confirmStrategic();
      else if (e.target.closest('#btn-strat-cancel') || e.target === $('strat')) this.closeStrategic();
    });
    this.updateA11yBtns();
    for (const id of ['btn-sound', 'btn-sound2']) {
      $(id).addEventListener('click', () => {
        app.sound.toggle();
        this.updateSoundBtn();
      });
    }
    this.updateSoundBtn();
    $('btn-obj').addEventListener('click', () => {
      const el = $('objectives');
      el.classList.toggle('collapsed');
      $('btn-obj').textContent = el.classList.contains('collapsed') ? T$('Mostrar') : T$('Ocultar');
    });
    $('btn-build').addEventListener('click', () => this.toggleBuild());
    $('btn-build-close').addEventListener('click', () => {
      if (window.innerWidth <= 860) this.toggleBuild(false);
      else $('buildpanel').classList.toggle('min');
    });
    $('btn-place-cancel').addEventListener('click', () => app.input.cancelPlacement());
    $('btn-place-rot').addEventListener('click', () => app.input.rotatePlacement());
    $('btn-place-ok').addEventListener('click', () => app.input.confirmPlacement());
    $('btn-mini').addEventListener('click', () => {
      const w = $('miniwrap');
      w.classList.toggle('min');
      $('btn-mini').setAttribute('aria-label', w.classList.contains('min') ? T$('Mostrar minimapa') : T$('Plegar minimapa'));
    });
    $('btn-home').addEventListener('click', () => app.focusCore());
    $('btn-box').addEventListener('click', () => {
      app.input.boxMode = !app.input.boxMode;
      $('btn-box').classList.toggle('on', app.input.boxMode);
      if (app.input.boxMode) this.toast(T$('Arrastra para seleccionar varias tropas'));
    });
    document.querySelectorAll('[data-quick]').forEach((b) => {
      b.addEventListener('click', () => app.quickSelect(b.dataset.quick));
    });
    document.querySelectorAll('[data-group]').forEach((b) => {
      b.addEventListener('click', () => app.selectGroup(Number(b.dataset.group)));
    });
    $('btn-builders').addEventListener('click', () => app.selectBuilders());
    $('prodbar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-prod]');
      if (!b || !app.game) return;
      const bld = app.game.buildings.find((x) => x.id === Number(b.dataset.prod) && x.alive);
      if (!bld) return;
      app.sound.play('click');
      app.setSelection([bld]);
      app.focusAt(bld.x, bld.z);
    });

    $('btabs').innerHTML = BUILD_TABS.map((t) =>
      `<button class="tab" role="tab" type="button" data-tab="${t.id}" aria-selected="${t.id === this.tab}">${esc(t.name)}</button>`).join('');
    $('btabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b) return;
      this.tab = b.dataset.tab;
      $('btabs').querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === this.tab)));
      this.renderBuildList();
    });
    $('blist').addEventListener('click', (e) => {
      const b = e.target.closest('[data-b]');
      if (!b || !app.game) return;
      app.sound.play('click');
      const type = b.dataset.b;
      const g = app.game;
      const def = BUILDINGS[type];
      if (def.limit && g.count(0, type) >= def.limit) {
        this.toast(L$`Límite alcanzado (${def.limit})`, 'bad');
        return;
      }
      app.setSelection([]);
      app.input.startPlacement({ kind: 'build', btype: type });
      if (window.innerWidth <= 860) this.toggleBuild(false);
    });

    $('selpanel').addEventListener('click', (e) => this.onSelClick(e));
    // Fichas de unidad: mantener pulsada una tarjeta (o pasar el ratón) muestra sus datos.
    const sp = $('selpanel');
    sp.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.card[data-type]');
      if (!card) return;
      clearTimeout(this.pressT);
      this.suppressClick = false;
      this.pressT = setTimeout(() => {
        this.suppressClick = true;
        this.showCardInfo(card.dataset.type);
      }, 450);
    });
    const endPress = () => clearTimeout(this.pressT);
    sp.addEventListener('pointerup', endPress);
    sp.addEventListener('pointercancel', endPress);
    sp.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse') return;
      const card = e.target.closest('.card[data-type]');
      if (card) this.showCardInfo(card.dataset.type);
    });
    sp.addEventListener('contextmenu', (e) => { if (e.target.closest('.card')) e.preventDefault(); });
    // Desglose de economía y marcador.
    document.querySelectorAll('[data-econ]').forEach((el) => {
      const open = () => this.togglePop('econ', el.dataset.econ);
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    $('players').addEventListener('click', () => this.togglePop('score'));
    $('players').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.togglePop('score'); } });
    // v1.8.1: Laboratorio.
    $('btn-lab').addEventListener('click', () => { app.sound.play('click'); this.togglePop('lab'); });
    $('labpop').addEventListener('click', (e) => this.onLabClick(e));
    $('labpop').addEventListener('input', (e) => {
      if (e.target.id !== 'lab-search') return;
      this.labSearch = e.target.value;
      this.renderLabUnits();
    });
    for (const id of ['econ', 'score', 'chatpop']) {
      $(id).addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) this.togglePop(null);
        const ab = e.target.closest('[data-ally]');
        if (ab) this.allyAction(ab.dataset.ally, Number(ab.dataset.pid));
        const ct = e.target.closest('[data-chattab]');
        if (ct) { this.chatTab = ct.dataset.chattab; this.chatKey = null; this.renderPop(); }
        const qm = e.target.closest('[data-qmsg]');
        if (qm) this.quickMsg(qm.dataset.qmsg);
        if (e.target.closest('[data-openchat]')) { this.chatKey = null; this.togglePop('chat'); }
      });
    }

    const mm = $('minimap');
    const moveCam = (e) => {
      if (!app.renderer || app.state !== 'play') return;
      const rect = mm.getBoundingClientRect();
      const w = app.renderer.minimapToWorld(mm, e.clientX - rect.left, e.clientY - rect.top);
      app.renderer.cam.tx = w.x;
      app.renderer.cam.tz = w.z;
    };
    mm.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { mm.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      this.mmDrag = true;
      moveCam(e);
    });
    mm.addEventListener('pointermove', (e) => { if (this.mmDrag) moveCam(e); });
    mm.addEventListener('pointerup', () => { this.mmDrag = false; });
    mm.addEventListener('pointercancel', () => { this.mmDrag = false; });
  }

  // ---------- v1.8: Ajustes «A tu manera» ----------
  // Los controles son los mismos de la pausa: al abrir se acomodan por secciones y al cerrar vuelven a su lugar.
  openSettings(sec = 'interfaz') {
    if (!this.setMoved) {
      this.setMoved = [];
      for (const [pane, ids] of Object.entries(SETTINGS_LAYOUT)) {
        const box = document.querySelector(`[data-setpane="${pane}"]`);
        const after = box.querySelector('h3');
        let ref = after.nextSibling;
        for (const id of ids) {
          const el = $(id);
          if (!el) continue;
          this.setMoved.push([el, el.parentNode, el.nextSibling]);
          box.insertBefore(el, ref);
        }
      }
    }
    $('settings').hidden = false;
    this.showSettingsSection(sec);
    this.app.sound.play('click');
  }

  showSettingsSection(sec) {
    document.querySelectorAll('#settings [data-setsec]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.setsec === sec)));
    document.querySelectorAll('#settings [data-setpane]').forEach((p) => { p.hidden = p.dataset.setpane !== sec; });
  }

  closeSettings() {
    if (this.setMoved) {
      for (let i = this.setMoved.length - 1; i >= 0; i--) {
        const [el, parent, next] = this.setMoved[i];
        parent.insertBefore(el, next);
      }
      this.setMoved = null;
    }
    $('settings').hidden = true;
  }

  // Vuelve todo a como viene el juego: calidad automática, luz nueva, sin ahorro, colores normales, 100 %,
  // con destellos, sin contador, música media, sonido y giro de la cámara.
  resetSettings() {
    const app = this.app;
    app.setQuality('auto');
    app.setLight('new');
    if (app.battery) app.setBattery(false);
    if (app.cvd) app.setCvd(false);
    app.setUiScale(100);
    app.setCalm(false);
    app.toggleFps(false);
    app.setOrbit(true);
    app.music.setLevel(0.6);
    if (!app.sound.on) app.sound.toggle();
    this.updateMusicBtns();
    this.updateSoundBtn();
    this.updateA11yBtns();
    this.toast(T$('Ajustes restablecidos'), 'good');
  }

  updateLightBtns() {
    const pref = lightPref();
    document.querySelectorAll('[data-light]').forEach((b) => {
      b.classList.toggle('gold', b.dataset.light === pref);
      b.setAttribute('aria-pressed', String(b.dataset.light === pref));
    });
  }

  updateA11yBtns() {
    const app = this.app;
    const set = (id, on, label) => {
      const b = $(id);
      if (!b) return;
      b.classList.toggle('gold', !!on);
      b.setAttribute('aria-pressed', String(!!on));
      b.textContent = `${label}: ${on ? T$('sí') : 'no'}`;
    };
    set('btn-battery', app.battery, T$('Ahorro de batería'));
    set('btn-cvd', app.cvd, T$('Colores para daltonismo'));
    set('btn-bigtext', app.bigText, T$('Letra grande'));
    // v1.7: tamaño de la interfaz y menos destellos.
    set('btn-calm', app.calm, T$('Reducir destellos'));
    set('btn-orbit', app.orbit !== false, T$('Giro de la cámara en el vestíbulo'));
    const sl = $('ui-scale');
    if (sl) {
      sl.value = String(app.uiScale || 100);
      const eff = app.uiScaleEff || app.uiScale || 100;
      $('ui-scale-val').textContent = `${app.uiScale || 100} %`;
      $('ui-scale-note').textContent = eff < (app.uiScale || 100) ? L$`En esta pantalla se usa ${eff} % para que todo quepa.` : T$('Agranda los paneles, las listas y los avisos. Los botones nunca bajan de 44 px.');
    }
  }

  updateMusicBtns() {
    const lv = this.app.music.level;
    document.querySelectorAll('[data-music]').forEach((b) => b.classList.toggle('gold', Number(b.dataset.music) === lv));
    const lb = $('btn-music-lobby');
    lb.classList.toggle('off', lv === 0);
    lb.setAttribute('aria-pressed', String(lv > 0));
    lb.title = lv > 0 ? T$('Música: sí (toca para apagarla)') : T$('Música: no (toca para encenderla)');
  }

  updateSoundBtn() {
    $('btn-sound2').textContent = this.app.sound.on ? T$('Sonido: sí') : T$('Sonido: no');
    $('btn-sound').innerHTML = this.app.sound.on ? ICON.soundOn : ICON.soundOff;
    $('btn-sound').setAttribute('aria-label', this.app.sound.on ? T$('Silenciar') : T$('Activar sonido'));
  }

  startHud() {
    this.closeStrategic();
    this.selSig = '';
    this.buildSig = '';
    this.playersSig = '';
    $('toasts').innerHTML = '';
    $('objectives').hidden = false;
    const camp = this.app.game.camp;
    // En pantallas chicas el panel de la misión empieza plegado (se abre con «Mostrar»).
    const small = window.innerWidth <= 860 || window.innerHeight <= 520;
    $('objectives').classList.toggle('collapsed', !!camp && small);
    $('btn-obj').textContent = camp && small ? T$('Mostrar') : T$('Ocultar');
    $('leftcol').classList.toggle('camp', !!camp);
    document.body.classList.toggle('camp-on', !!camp);
    $('objtitle').textContent = camp ? Campaign.mode(camp.id).name : T$('Primeros pasos');
    if (camp) this.renderMission(true);
    else $('objlist').innerHTML = this.objList().map((o) => `<li data-obj="${o.id}" class="${this.app.game.objDone[o.id] ? 'done' : ''}">${esc(o.text)}</li>`).join('');
    $('btn-box').classList.remove('on');
    this.groupsSig = '';
    this.renderGroups(true);
    this.prodSig = '';
    for (const a of this.edgeAlerts || []) if (a.el) a.el.remove();
    this.edgeAlerts = [];
    $('king').hidden = !this.app.game.mode.king;
    $('feed').innerHTML = '';
    // v1.8.1: el botón del Laboratorio solo está en el Campo de pruebas.
    const sandbox = !!this.app.game.mode.sandbox;
    if (sandbox) this.app.game.ensureLab();
    $('btn-lab').hidden = !sandbox;
    this.labSpeedTag();
    if (sandbox && !this.labHinted) {
      this.labHinted = true;
      setTimeout(() => this.toast(T$('Laboratorio: toca el matraz de arriba para crear tropas, poner dianas y cambiar la velocidad')), 700);
    }
    this.togglePop(null);
    this.cardInfoType = null;
    this.renderBuildList();
    this.hidePlaceBar();
    $('selpanel').hidden = true;
  }

  toggleBuild(force) {
    const el = $('buildpanel');
    const open = force === undefined ? !el.classList.contains('open') : force;
    el.classList.toggle('open', open);
  }

  markObjective(id) {
    if (this.app.game.camp) return;
    const li = document.querySelector(`[data-obj="${id}"]`);
    if (li) li.classList.add('done');
    const all = this.objList().every((o) => this.app.game.objDone[o.id]);
    if (all) setTimeout(() => { $('objectives').hidden = true; }, 4000);
  }

  // Tarjeta «Qué mejoró» (v0.9): sale al terminar cada mejora de un edificio tuyo.
  upgradeCard(b, level, lines) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast upcard good';
    const name = b.def.levelNames ? b.def.levelNames[level] : L$`${b.def.name} · nivel ${level}`;
    el.innerHTML = `<b>${L$`${ICON_UP} ${esc(name)}: qué mejoró`}</b><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', () => el.remove());
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 7000);
  }

  toast(text, kind = 'info', at = null) {
    const now = performance.now();
    if (this.lastToast[text] && now - this.lastToast[text] < 1200) return;
    this.lastToast[text] = now;
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (at && at.x !== undefined) {
      el.classList.add('has-btn');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mini-btn';
      b.textContent = T$('Ver');
      b.addEventListener('click', () => {
        this.app.focusAt(at.x, at.z);
        el.remove();
      });
      el.appendChild(b);
    }
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), at ? 5000 : 2800);
  }

  // Mensaje de un bot: al panel de mensajes (pantallas anchas) o como aviso (estrechas).
  chat(msg) {
    const g = this.app.game;
    if (!msg.toMe && !msg.ally && !msg.public) return;
    const p = g.players[msg.pid];
    const who = msg.ally ? `${p.name} (aliado)` : p.name;
    const at = msg.x !== undefined ? { x: msg.x, z: msg.z } : null;
    const feed = $('feed');
    const wide = feed.offsetParent !== null;
    if (wide) {
      const el = document.createElement('div');
      el.className = 'msg' + (msg.toMe ? ' bad' : '');
      el.innerHTML = `<i style="background:${hexColor(p.color)}"></i><div><b>${esc(who)}:</b> ${esc(msg.text)}</div>`;
      if (at) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini-btn';
        b.textContent = T$('Ver');
        b.addEventListener('click', () => this.app.focusAt(at.x, at.z));
        el.appendChild(b);
      }
      feed.appendChild(el);
      while (feed.children.length > 4) feed.removeChild(feed.firstChild);
      setTimeout(() => el.classList.add('old'), 15000);
      setTimeout(() => el.remove(), 40000);
    }
    if (msg.toMe || !wide) this.toast(`${who}: ${msg.text}`, msg.toMe ? 'bad' : 'info', msg.toMe ? at : null);
    if (msg.toMe) this.app.sound.play('alarm');
  }

  // ---------- tutorial que señala qué tocar (v1.2) ----------
  // Si sigues en modo construir (la obra ya está puesta y el modo sigue para poner más), primero se sale de él:
  // si no, tocar un edificio o una tropa no la elige.
  coachStep(g) {
    const step = this.coachStepRaw(g);
    const p = this.app.input.placement;
    if (step && p && !step.place) {
      return { sel: '#btn-place-cancel', text: p.placed ? T$('Toca «Terminar» para salir del modo construir') : T$('Toca «Cancelar» para salir de este modo') };
    }
    return step;
  }

  coachStepRaw(g) {
    const app = this.app;
    const me = g.players[0];
    const mine = g.units.filter((u) => u.owner === 0 && u.alive);
    const blds = g.buildings.filter((b) => b.owner === 0 && b.alive);
    const sel = app.selection;
    const core = me.core;
    const p = app.input.placement;
    const bp = $('buildpanel');
    // (offsetParent no sirve con paneles «position: fixed»; se mira si ocupa lugar en la pantalla.)
    const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    const panelOpen = shown(bp) && !bp.classList.contains('min') && (window.innerWidth > 860 || bp.classList.contains('open'));
    const buildFlow = (tab, type, name, tabName) => {
      if (p && p.kind === 'build' && p.btype === type) {
        if (p.cell < 0) {
          const c = [...(p.valid || [])].map((i) => g.cells[i]).sort((a, b) => g.map.dist(a, g.cells[core.cell]) - g.map.dist(b, g.cells[core.cell]))[0];
          return c ? { world: { x: c.x, y: c.h, z: c.z }, text: T$('Toca una casilla dorada (por ejemplo, esta)'), place: true } : { text: T$('No quedan casillas libres'), place: true };
        }
        return { sel: '#btn-place-ok', text: T$('Toca «Construir» para poner la obra'), place: true };
      }
      if (!panelOpen) return { sel: '#btn-build', text: T$('Abre «Construir»') };
      if (this.tab !== tab) return { sel: `#btabs [data-tab="${tab}"]`, text: L$`Abre la pestaña «${tabName}»` };
      return { sel: `.bitem[data-b="${type}"]`, text: `Elige «${name}»` };
    };
    const hasBuilder = mine.some((u) => u.def.builds) || core.queue.some((q) => q.type === 'builder');
    if (!hasBuilder) {
      if (!(sel.length === 1 && sel[0] === core)) return { world: { x: core.x, y: core.y + 1, z: core.z }, text: T$('Toca tu Núcleo') };
      return { sel: '[data-act="train"][data-type="builder"]', text: T$('Entrena un Constructor') };
    }
    // v1.3: los 3 pasos de tu documento. 1 Construí: otra Granja y una energía.
    const at = (e, dy = 0.5) => ({ x: e.x, y: (e.y || 0) + dy, z: e.z });
    const isSel = (e) => sel.length === 1 && sel[0] === e;
    if (blds.filter((b) => b.type === 'farm').length < 2) return buildFlow('eco', 'farm', T$('Granja'), T$('Economía'));
    if (!blds.some((b) => ['solar', 'wind', 'hydro', 'tidal', 'wave'].includes(b.type))) return buildFlow('energy', 'solar', T$('Solar'), T$('Energía'));
    // 2 Producí: un Cuartel y 3 soldados.
    const bar = blds.find((b) => b.type === 'barracks');
    if (!bar) return buildFlow('prod', 'barracks', T$('Cuartel'), T$('Producción'));
    const soldiers = mine.filter((u) => u.cls === 'inf' && u.def.weapon);
    const inQueue = bar.queue.filter((q) => UNITS[q.type].cls === 'inf' && UNITS[q.type].weapon).length;
    if (soldiers.length + inQueue < 3) {
      if (!bar.built) return { world: at(bar), text: T$('El Constructor va a la obra: espera a que termine el Cuartel') };
      if (!isSel(bar)) return { world: at(bar), text: T$('Toca tu Cuartel') };
      return { sel: '[data-act="train"][data-type="rifle"]', text: L$`Entrena Artilleros (tienes ${soldiers.length + inQueue} de 3)` };
    }
    // 3 Atacá: Puerto, Barcaza, subir a los soldados, cruzar y tomar la isla del bot.
    const foe = g.players.find((q) => q.id !== 0 && q.alive && q.core && q.core.alive);
    if (!foe) return null;
    const foeComp = g.cells[foe.core.cell].comp;
    const landed = soldiers.filter((u) => !u.inside && g.cells[u.cell].comp === foeComp);
    if (landed.length) {
      if (!sel.some((u) => u.kind === 'unit' && u.def.weapon)) return { sel: '[data-quick="army"]', text: T$('Toca «Ejército» para elegir a tus soldados') };
      return { world: at(foe.core, 1), text: T$('Toca el Núcleo del bot para tomar su isla') };
    }
    const harbor = blds.find((b) => b.type === 'harbor');
    if (!harbor) return buildFlow('prod', 'harbor', T$('Puerto'), T$('Producción'));
    const barge = mine.find((u) => u.type === 'barge');
    if (!barge) {
      if (!harbor.built) return { world: at(harbor), text: T$('El Constructor va a la obra: espera a que termine el Puerto') };
      if (harbor.queue.some((q) => q.type === 'barge')) return { world: at(harbor), text: T$('El Puerto fabrica la Barcaza: espera') };
      if (!isSel(harbor)) return { world: at(harbor), text: T$('Toca tu Puerto') };
      return { sel: '[data-act="train"][data-type="barge"]', text: T$('Entrena una Barcaza: lleva tropas por el mar') };
    }
    const ashore = soldiers.filter((u) => !u.inside);
    if (soldiers.length < 3) return { world: at(bar), text: L$`Espera a tus soldados (${soldiers.length} de 3)` };
    if (ashore.length) {
      if (ashore.every((u) => u.state === 'board')) return { world: at(barge, 0.3), text: T$('Los soldados suben a la Barcaza: espera') };
      if (!sel.some((u) => u.kind === 'unit' && u.cls === 'inf' && u.def.weapon)) return { sel: '[data-quick="army"]', text: T$('Toca «Ejército» para elegir a tus soldados') };
      return { world: at(barge, 0.3), text: T$('Toca la Barcaza para subirlos') };
    }
    // Todos a bordo: llevar la Barcaza junto a la isla del bot y desembarcar.
    const c0 = g.cells[barge.cell];
    const nearFoe = g.cells.some((c) => c.comp === foeComp && TERRAIN[c.t].land && g.map.dist(c, c0) <= 2);
    if (!nearFoe) {
      if (barge.path && barge.pathI < barge.path.length) return { world: at(barge, 0.3), text: T$('La Barcaza navega hacia la isla del bot: espera') };
      if (!isSel(barge)) return { world: at(barge, 0.3), text: T$('Toca tu Barcaza') };
      const dest = this.landingCell(g, foe, foeComp);
      return dest ? { world: { x: dest.x, y: 0.1, z: dest.z }, text: T$('Toca el mar junto a la isla del bot para llevarla') } : { text: T$('No hay costa libre junto a la isla del bot') };
    }
    if (!isSel(barge)) return { world: at(barge, 0.3), text: T$('Toca tu Barcaza') };
    return { sel: '[data-act="unload"]', text: T$('Toca «Desembarcar»') };
  }

  // Casilla de mar junto a la isla del bot, lo más cerca posible de su Núcleo.
  landingCell(g, foe, foeComp) {
    if (this._landing && this._landing.g === g && this._landing.pid === foe.id) return this._landing.c;
    const core = g.cells[foe.core.cell];
    const c = g.cells.filter((x) => TERRAIN[x.t].water && !x.bld && x.nb.some((ni) => g.cells[ni].comp === foeComp && TERRAIN[g.cells[ni].t].land))
      .sort((a, b) => g.map.dist(a, core) - g.map.dist(b, core))[0] || null;
    this._landing = { g, pid: foe.id, c };
    return c;
  }

  updateCoach() {
    const app = this.app;
    const g = app.game;
    let el = $('coach');
    const step = g && g.mode.tutorial && !g.over && app.state === 'play' && !app.paused ? this.coachStep(g) : null;
    if (!step) {
      if (el) el.hidden = true;
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'coach';
      el.setAttribute('aria-live', 'polite');
      el.innerHTML = '<div class="coach-ring"></div><div class="coach-tip"></div>';
      document.body.appendChild(el);
      this._tipKey = null;
    }
    let rect = null;
    let text = step.text;
    if (step.sel) {
      const t = document.querySelector(step.sel);
      if (t && t.getClientRects().length > 0) {
        const r = t.getBoundingClientRect();
        rect = { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 };
      }
    } else if (step.world && app.renderer) {
      const sp = app.renderer.project(step.world.x, step.world.y, step.world.z);
      const onScreen = sp.ok && sp.x > 24 && sp.x < window.innerWidth - 24 && sp.y > 24 && sp.y < window.innerHeight - 24;
      // ¿Lo tapa un panel? (por ejemplo, el de «Construir»): tocar ahí tocaría el panel, no el mapa.
      const top = onScreen ? document.elementFromPoint(sp.x, sp.y) : null;
      const covered = onScreen && !!top && top.id !== 'gl' && top.id !== 'overlay';
      if (onScreen && !covered) rect = { x: sp.x - 30, y: sp.y - 30, w: 60, h: 60, round: true };
      else {
        // Fuera de la pantalla: el aro señala ese lugar en el minimapa (tocarlo lleva la cámara allí).
        const mm = $('minimap');
        if (mm && mm.getClientRects().length > 0) {
          const r = mm.getBoundingClientRect();
          const m = app.renderer.worldToMinimap(mm, step.world.x, step.world.z);
          rect = { x: r.left + clamp(m.x, 0, r.width) - 16, y: r.top + clamp(m.y, 0, r.height) - 16, w: 32, h: 32, round: true };
          text = covered ? T$('Lo tapa un panel: toca este punto del minimapa para centrarlo')
            : T$('Está fuera de la pantalla: toca este punto del minimapa para ir allí');
        }
      }
    }
    el.hidden = false;
    const ring = el.querySelector('.coach-ring');
    const tip = el.querySelector('.coach-tip');
    ring.hidden = !rect;
    if (rect) Object.assign(ring.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`, borderRadius: rect.round ? '50%' : '12px' });
    // v1.4: se mide el texto de verdad (con «Letra grande» es más ancho y más alto).
    const tipKey = text + document.body.classList.contains('bigtext');
    if (this._tipKey !== tipKey || tip.textContent !== text) {
      tip.textContent = text;
      this._tipKey = tipKey;
      this._tipSize = { w: tip.offsetWidth || 220, h: tip.offsetHeight || 44 };
    }
    const { w: tw, h: th } = this._tipSize;
    const W = window.innerWidth;
    const Hh = window.innerHeight;
    const tx = rect ? clamp(rect.x + rect.w / 2 - tw / 2, 8, W - tw - 8) : W / 2 - tw / 2;
    const below = rect ? rect.y + rect.h + 8 : 120;
    const ty = clamp(rect && below + th + 8 > Hh ? rect.y - th - 8 : below, 8, Math.max(8, Hh - th - 8));
    Object.assign(tip.style, { left: `${tx}px`, top: `${ty}px` });
    this.coachText = text;
  }

  // ---------- rueda de selección del ejército (v1.2) ----------
  wheelOpen() {
    return !!this.wheel;
  }

  showWheel(x, y) {
    this.hideWheel();
    const app = this.app;
    const g = app.game;
    if (!g || app.state !== 'play') return;
    const count = (f) => g.units.filter((u) => u.owner === 0 && u.alive && !u.inside && f(u)).length;
    const opts = [
      { k: 'army', label: T$('Tierra'), n: count((u) => u.def.weapon && u.mover === 'land') },
      { k: 'sea', label: T$('Mar'), n: count((u) => u.def.weapon && u.mover === 'sea') },
      { k: 'air', label: T$('Aire'), n: count((u) => u.def.weapon && u.mover === 'air') },
      { k: 'all', label: T$('Todo'), n: count((u) => u.def.weapon) },
      { k: 'builders', label: T$('Constructores'), n: count((u) => u.def.builds === 'land') },
      { k: 'g1', label: 'Grupo 1', n: (app.groups[1] || []).filter((u) => u.alive).length },
      { k: 'g2', label: 'Grupo 2', n: (app.groups[2] || []).filter((u) => u.alive).length },
      { k: 'g3', label: 'Grupo 3', n: (app.groups[3] || []).filter((u) => u.alive).length },
    ];
    // Radio para que las 8 opciones (84 px de ancho) no se pisen entre sí.
    const R = 122;
    const cx = clamp(x, R + 50, window.innerWidth - R - 50);
    const cy = clamp(y, R + 40, window.innerHeight - R - 40);
    const el = document.createElement('div');
    el.id = 'wheel';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', T$('Rueda de selección'));
    el.innerHTML = `<div class="wheel-hub" style="left:${cx}px;top:${cy}px">${L$`Elegir`}</div>` + opts.map((o, i) => {
      const a = -Math.PI / 2 + (i / opts.length) * Math.PI * 2;
      return `<button type="button" role="menuitem" class="wheel-opt" data-wk="${o.k}" style="left:${cx + Math.cos(a) * R}px;top:${cy + Math.sin(a) * R}px" ${o.n ? '' : 'disabled'}>
        <b>${o.label}</b><small>${o.n}</small></button>`;
    }).join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-wk]');
      if (b && !b.disabled) this.pickWheel(b.dataset.wk);
      else if (!e.target.closest('.wheel-opt')) this.hideWheel();
    });
    document.body.appendChild(el);
    this.wheel = el;
    app.sound.play('click');
  }

  hoverWheel(x, y) {
    if (!this.wheel) return;
    const hit = document.elementFromPoint(x, y);
    this.wheel.querySelectorAll('.wheel-opt').forEach((b) => b.classList.toggle('hot', b === (hit && hit.closest('.wheel-opt'))));
  }

  releaseWheel(x, y) {
    if (!this.wheel) return;
    const hit = document.elementFromPoint(x, y);
    const b = hit && hit.closest('.wheel-opt');
    if (b && !b.disabled) this.pickWheel(b.dataset.wk);
  }

  pickWheel(k) {
    const app = this.app;
    this.hideWheel();
    if (k === 'builders') app.selectBuilders();
    else if (k[0] === 'g') app.selectGroup(Number(k[1]));
    else app.quickSelect(k);
  }

  hideWheel() {
    if (this.wheel) this.wheel.remove();
    this.wheel = null;
  }

  // ---------- alianzas y órdenes a los aliados (v1.1) ----------
  allyAction(kind, pid) {
    const app = this.app;
    const g = app.game;
    if (!g) return;
    if (kind === 'ask') {
      const res = g.proposeAlliance(0, pid);
      this.toast(res.text, res.ok ? 'good' : 'bad');
      app.sound.play(res.ok ? 'ready' : 'error');
    } else if (kind === 'break') {
      if (this.breakArm !== pid) {
        this.breakArm = pid;
        this.toast(L$`¿Romper la alianza con ${g.players[pid].name}? Toca «Romper» otra vez`, 'bad');
        setTimeout(() => { if (this.breakArm === pid) this.breakArm = null; }, 4000);
        return;
      }
      this.breakArm = null;
      const err = g.breakAlliance(0);
      if (err) this.toast(err, 'bad');
      else {
        g.say(pid, T$('Rompiste la alianza. Ahora somos rivales otra vez.'), { force: true, toMe: true });
        this.toast(L$`Ya no eres aliado de ${g.players[pid].name}`, 'info');
      }
    } else if (kind === 'help' || kind === 'attack') {
      this.allyOrder(kind);
      return;
    }
    this.renderPop();
  }

  // ---------- mensajes (v1.2): pestañas Todos / Aliados y mensajes rápidos ----------
  chatHtml(g) {
    const tab = this.chatTab || 'all';
    const me = g.players[0];
    const list = g.chat.filter((m) => (tab === 'ally' ? m.ally : (m.ally || m.toMe || m.public))).slice(-30);
    const rows = list.length ? list.map((m) => {
      const p = g.players[m.pid];
      const who = m.mine ? T$('Tú') : p.name + (m.ally ? ' (aliado)' : '');
      return `<p class="${m.mine ? 'mine' : ''}"><i style="background:${hexColor(p.color)}"></i><b>${esc(who)}:</b> ${esc(m.text)}<small>${fmtTime(m.time)}</small></p>`;
    }).join('') : `<p>${tab === 'ally' ? T$('Todavía no hay mensajes de aliados.') : T$('Todavía no hay mensajes.')}</p>`;
    const hasAllies = g.players.some((q) => q.id !== 0 && q.alive && !q.human && q.team === me.team) && me.alive;
    const quick = hasAllies ? `<div class="quickmsgs">${[T$('¡Gracias!'), T$('¡Bien hecho!'), T$('¡Cuidado!')].map((t) => `<button class="btn mini" type="button" data-qmsg="${t}">${t}</button>`).join('')}
      <button class="btn mini gold" type="button" data-ally="help" data-pid="0">${L$`¡Ayuda!`}</button>
      <button class="btn mini gold" type="button" data-ally="attack" data-pid="0">${L$`¡Ataquemos!`}</button></div>`
      : `<p class="allyhint">${L$`Cuando tengas aliados, aquí puedes mandarles mensajes rápidos.`}</p>`;
    return `<header><h4>${L$`Mensajes`}</h4><button class="btn icon" type="button" data-close aria-label="${L$`Cerrar`}">${ICON.close}</button></header>
      <div class="chattabs" role="tablist"><button class="btn mini" type="button" role="tab" data-chattab="all" aria-selected="${tab === 'all'}">${L$`Todos`}</button>
      <button class="btn mini" type="button" role="tab" data-chattab="ally" aria-selected="${tab === 'ally'}">${L$`Aliados`}</button></div>
      <div class="chatlog" id="chatlog">${rows}</div>${quick}`;
  }

  quickMsg(text) {
    const g = this.app.game;
    if (!g) return;
    const n = g.playerSay(text);
    this.chatKey = null;
    this.renderPop();
    this.app.sound.play('click');
    if (!n) this.toast(T$('No tienes aliados que te lean'), 'bad');
    const log = $('chatlog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  allyOrder(kind) {
    const app = this.app;
    const g = app.game;
    const bots = g.bots.filter((b) => b.p.alive && b.p.team === g.players[0].team && b.pid !== 0);
    if (!bots.length) return;
    if (kind === 'help') {
      const n = bots.reduce((a, b) => a + b.answerHelp(0), 0);
      this.toast(n ? L$`Tus aliados mandan ${n} tropas a tu base` : T$('Tus aliados no tienen tropas libres'), n ? 'good' : 'bad');
      app.sound.play('order');
    } else {
      this.togglePop(null);
      app.input.startPlacement({ kind: 'allyattack' });
    }
  }

  // ---------- desglose de economía y marcador ----------
  togglePop(which, sub) {
    const same = this.pop === which && this.popSub === sub;
    this.pop = same ? null : which;
    this.popSub = sub;
    $('econ').hidden = this.pop !== 'econ';
    $('score').hidden = this.pop !== 'score';
    $('chatpop').hidden = this.pop !== 'chat';
    $('labpop').hidden = this.pop !== 'lab';
    $('btn-lab').setAttribute('aria-expanded', String(this.pop === 'lab'));
    if (this.pop === 'lab') this.renderLab(true);
    this.renderPop();
  }

  renderPop() {
    const g = this.app.game;
    if (!g || !this.pop) return;
    if (this.pop === 'econ') $('econ').innerHTML = this.popSub === 'energy' ? this.energyHtml(g) : this.econHtml(g);
    else if (this.pop === 'chat') {
      // Solo se vuelve a dibujar si llegó un mensaje nuevo (para no cortar el desplazamiento).
      const key = `${g.chat.length}:${g.chat.length ? g.chat[g.chat.length - 1].time : 0}:${this.chatTab}`;
      if (key !== this.chatKey) { this.chatKey = key; $('chatpop').innerHTML = this.chatHtml(g); }
    } else if (this.pop === 'lab') this.renderLab();
    else $('score').innerHTML = this.scoreHtml(g);
  }

  // ---------- v1.8.1: Laboratorio (PRD v1.9 del usuario, sección 12) ----------
  labSpeedTag() {
    const g = this.app.game;
    const tag = $('lab-speedtag');
    if (!tag) return;
    const k = g && g.lab ? g.lab.speed : 1;
    tag.hidden = !g || !g.lab || k === 1;
    tag.textContent = k === 0 ? 'II' : labSpeedName(k);
  }

  labHtml(g) {
    const lab = g.lab;
    const fam = this.labFam || 'all';
    const team = this.labTeam || 0;
    const n = this.labN || 1;
    const on = (v) => `aria-pressed="${!!v}"`;
    const tog = (k, label, v) => `<button class="btn" type="button" data-lab="toggle" data-k="${k}" ${on(v)}>${label}</button>`;
    return `<header><h4>${T$('Laboratorio')}</h4><button class="btn icon" type="button" data-close aria-label="${T$('Cerrar')}">${ICON.close}</button></header>
      <p class="labnote">${T$('Para probar cada tropa en menos de un minuto. Solo en el Campo de pruebas: no da XP, cristales ni misiones.')}</p>
      <section class="labsec" aria-label="${T$('Velocidad')}">
        <span class="lbl">${T$('Velocidad')}</span>
        <div class="labseg" id="lab-speed">${LAB.speeds.map(([v]) => `<button class="btn" type="button" data-lab="speed" data-v="${v}" ${on(lab.speed === v)}>${labSpeedName(v)}</button>`).join('')}
          <button class="btn" type="button" data-lab="step" title="${T$('Avanza 0,1 s')}">${T$('+1 paso')}</button></div>
      </section>
      <section class="labsec" aria-label="${T$('Reglas')}">
        <span class="lbl">${T$('Reglas')}</span>
        <div class="labtoggles" id="lab-toggles">${tog('res', T$('Recursos de sobra'), lab.res)}${tog('instant', T$('Obras al instante'), lab.instant)}${tog('inv0', T$('Tú no pierdes vida'), lab.inv[0])}${tog('inv1', T$('El rival no pierde vida'), lab.inv[1])}${tog('ai', T$('Bots del rival'), lab.ai)}</div>
      </section>
      <section class="labsec" aria-label="${T$('Crear tropa')}">
        <span class="lbl">${L$`Crear tropa · ${Object.keys(UNITS).length} tipos`}</span>
        <input id="lab-search" type="search" placeholder="${T$('Buscar por nombre')}" autocomplete="off" spellcheck="false" aria-label="${T$('Buscar tropa por nombre')}" value="${esc(this.labSearch || '')}">
        <div class="labchips" id="lab-fam">${ARSENAL_FILTERS.filter(([k]) => k !== 'bld').map(([k, t]) => `<button type="button" data-lab="fam" data-v="${k}" ${on(fam === k)}>${t}</button>`).join('')}</div>
        <div class="labseg"><button class="btn" type="button" data-lab="team" data-v="0" ${on(team === 0)}>${T$('Tuya')}</button><button class="btn" type="button" data-lab="team" data-v="1" ${on(team === 1)}>${T$('Del rival')}</button>
          <button class="btn" type="button" data-lab="n" data-v="1" ${on(n === 1)}>×1</button><button class="btn" type="button" data-lab="n" data-v="5" ${on(n === 5)}>×5</button></div>
        <div class="labunits" id="lab-units"></div>
        <p class="small-note">${T$('Toca una tropa y después el mapa. Se crea gratis, sin esperar.')}</p>
      </section>
      <section class="labsec" aria-label="${T$('Dianas')}">
        <span class="lbl">${T$('Dianas de práctica')}</span>
        <div class="labseg">${LAB.dummies.map(([k]) => `<button class="btn" type="button" data-lab="dummy" data-v="${k}">${labDummyName(k)}</button>`).join('')}</div>
        <div id="lab-stats"></div>
      </section>
      <section class="labsec" aria-label="${T$('Daño hecho')}">
        <span class="lbl">${T$('Daño hecho por tus tropas')}</span>
        <div id="lab-dealt"></div>
      </section>
      <section class="labsec" aria-label="${T$('Escenario')}">
        <span class="lbl">${T$('Escenario')}</span>
        <div class="labrow"><button class="btn" type="button" data-lab="tp">${T$('Mover al instante')}</button><button class="btn" type="button" data-lab="resetstats">${T$('Contadores a cero')}</button>
          <button class="btn" type="button" data-lab="cleardummies">${T$('Quitar dianas')}</button><button class="btn danger" type="button" data-lab="clearall">${this.labClearArm ? T$('¿Seguro? Toca otra vez') : T$('Quitar todas las tropas')}</button></div>
      </section>
      <section class="labsec" aria-label="${T$('Registro')}">
        <span class="lbl">${T$('Registro')}</span>
        <ol id="lab-log"></ol>
      </section>`;
  }

  renderLabUnits() {
    const box = $('lab-units');
    if (!box) return;
    const fam = this.labFam || 'all';
    const plain = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = plain((this.labSearch || '').trim());
    const items = arsenalItems().filter((it) => it.kind === 'unit' && (fam === 'all' || it.fam === fam || it.also.includes(fam)) &&
      (!q || plain(it.def.name).includes(q)));
    box.innerHTML = items.length ? items.map((it) => {
      const d = it.def;
      // El texto entero va al diccionario: «mar» suelto ya es el mes de marzo («Mar») en inglés.
      const c = fmt(d.cost);
      const where = d.mover === 'sea' ? L$`mar · ${c}` : d.mover === 'air' ? L$`aire · ${c}` : d.mover === 'amphib' ? L$`anfibio · ${c}` : L$`tierra · ${c}`;
      return `<button type="button" data-lab="unit" data-v="${it.key}"><b>${esc(d.name)}</b><small>${where}</small></button>`;
    }).join('') : `<p class="empty">${L$`Ninguna tropa se llama «${esc(this.labSearch)}».`}</p>`;
  }

  renderLab(force) {
    const g = this.app.game;
    if (!g || !g.lab) return;
    const el = $('labpop');
    if (force || !el.querySelector('#lab-units')) {
      el.innerHTML = this.labHtml(g);
      this.renderLabUnits();
      this.labLogVer = -1;
    }
    const lab = g.lab;
    // Estado de los botones (sin volver a dibujar el buscador).
    el.querySelectorAll('[data-lab="speed"]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === lab.speed)));
    const tv = { res: lab.res, instant: lab.instant, inv0: lab.inv[0], inv1: lab.inv[1], ai: lab.ai };
    el.querySelectorAll('[data-lab="toggle"]').forEach((b) => b.setAttribute('aria-pressed', String(!!tv[b.dataset.k])));
    // Dianas: daño total y por segundo.
    const dummies = g.units.filter((u) => u.alive && u.dummy);
    $('lab-stats').innerHTML = dummies.length
      ? `<table class="labtable"><thead><tr><th>${T$('Diana')}</th><th class="n">${T$('Daño total')}</th><th class="n">${T$('Daño/s')}</th></tr></thead><tbody>${dummies.map((u) =>
        `<tr><td>${esc(labDummyName(u.dummy))} <small>${esc(u.def.name)}</small></td><td class="n">${fmt(u.labDmg || 0)}</td><td class="n">${fmt(g.labDps(u))}</td></tr>`).join('')}</tbody></table>`
      : `<p class="small-note">${T$('Pon una diana: aparece a 6-10 casillas de tu Núcleo. No se mueve, no dispara y no se rompe. Daño/s cuenta los últimos 10 s.')}</p>`;
    const dealt = Object.entries(lab.dealt || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('lab-dealt').innerHTML = dealt.length
      ? `<table class="labtable"><tbody>${dealt.map(([k, v]) => `<tr><td>${esc(UNITS[k] ? UNITS[k].name : k)}</td><td class="n">${fmt(v)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="small-note">${T$('Todavía nada. Cuenta el daño de tus tropas contra cualquier blanco.')}</p>`;
    if (this.labLogVer !== lab.ver) {
      this.labLogVer = lab.ver;
      $('lab-log').innerHTML = lab.log.length ? lab.log.slice(-8).reverse().map((e) => `<li><b>${fmtTime(e.t)}</b>${esc(e.text)}</li>`).join('')
        : `<li>${T$('Aquí aparece lo que haces en el Laboratorio y las tropas que caen.')}</li>`;
    }
  }

  onLabClick(e) {
    const app = this.app;
    const g = app.game;
    if (e.target.closest('[data-close]')) { this.togglePop(null); return; }
    const b = e.target.closest('[data-lab]');
    if (!b || !g || !g.lab) return;
    const lab = g.lab;
    const act = b.dataset.lab;
    const v = b.dataset.v;
    app.sound.play('click');
    if (act !== 'clearall') this.labClearArm = false;
    if (act === 'speed') {
      lab.speed = Number(v);
      g.labLog(L$`Velocidad: ${labSpeedName(lab.speed)}`);
      this.labSpeedTag();
    } else if (act === 'step') {
      if (lab.speed !== 0) { lab.speed = 0; this.labSpeedTag(); }
      g.labStep();
    } else if (act === 'toggle') {
      const k = b.dataset.k;
      if (k === 'ai') g.labSetAI(!lab.ai);
      else if (k === 'inv0' || k === 'inv1') {
        const i = k === 'inv0' ? 0 : 1;
        lab.inv[i] = !lab.inv[i];
        if (i === 0) g.labLog(lab.inv[0] ? T$('Tú: no pierde vida') : T$('Tú: pierde vida normal'));
        else g.labLog(lab.inv[1] ? T$('El rival: no pierde vida') : T$('El rival: pierde vida normal'));
      } else {
        lab[k] = !lab[k];
        if (k === 'res') g.labLog(lab.res ? T$('Recursos de sobra: sí') : T$('Recursos de sobra: no'));
        else g.labLog(lab.instant ? T$('Obras al instante: sí') : T$('Obras al instante: no'));
      }
    } else if (act === 'fam') {
      this.labFam = v;
      this.renderLab(true);
      return;
    } else if (act === 'team') {
      this.labTeam = Number(v);
      this.renderLab(true);
      return;
    } else if (act === 'n') {
      this.labN = Number(v);
      this.renderLab(true);
      return;
    } else if (act === 'unit') {
      // Se cierra el panel para ver el mapa; la barra de abajo dice qué tocar.
      this.togglePop(null);
      app.setSelection([]);
      app.input.startPlacement({ kind: 'labspawn', type: v, owner: this.labTeam || 0, n: this.labN || 1, placed: 0 });
      return;
    } else if (act === 'dummy') {
      const u = g.labDummy(v);
      if (typeof u === 'string') this.toast(u, 'bad');
      else {
        app.focusAt(u.x, u.z);
        this.toast(L$`Diana de ${labDummyName(u.dummy).toLowerCase()} puesta. Manda tus tropas a atacarla.`, 'good');
      }
    } else if (act === 'tp') {
      const sel = app.selection.filter((x) => x.kind === 'unit' && x.alive && !x.inside);
      if (!sel.length) { this.toast(T$('Elige primero las tropas que quieres mover'), 'bad'); return; }
      this.togglePop(null);
      app.input.startPlacement({ kind: 'labtp', units: sel });
      return;
    } else if (act === 'resetstats') {
      g.labResetStats();
    } else if (act === 'cleardummies') {
      g.labClear('dummies');
    } else if (act === 'clearall') {
      if (!this.labClearArm) {
        this.labClearArm = true;
        this.renderLab(true);
        return;
      }
      this.labClearArm = false;
      app.setSelection([]);
      g.labClear('all');
      this.renderLab(true);
      return;
    }
    this.renderLab();
  }

  econHtml(g) {
    const p = g.players[0];
    const rows = [];
    const groups = new Map();
    for (const b of g.buildings) {
      if (!b.alive || b.owner !== 0 || !b.built || !b.def.income) continue;
      const k = groups.get(b.type) || { n: 0, sum: 0 };
      k.n++;
      k.sum += b.def.income;
      groups.set(b.type, k);
    }
    for (const [type, k] of groups) rows.push([`${BUILDINGS[type].name}${k.n > 1 ? ` ×${k.n}` : ''}`, k.sum]);
    const flags = g.points.filter((pt) => pt.owner === 0 && pt.def.income);
    if (flags.length) rows.push([`Banderas ×${flags.length}`, flags.reduce((s, pt) => s + pt.def.income, 0)]);
    rows.sort((a, b) => b[1] - a[1]);
    const bonus = p.income - p.baseIncome;
    let html = `<header><h4>${L$`Monedas por minuto`}</h4><button class="btn icon" type="button" data-close aria-label="${L$`Cerrar`}">` + ICON.close + '</button></header><table><tbody>';
    html += rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="n">+${fmt(v)}</td></tr>`).join('');
    if (bonus > 0) {
      html += `<tr><td>${L$`Subtotal`}</td><td class="n">${fmt(p.baseIncome)}</td></tr><tr><td>Faro (+${Math.round(p.bonus * 100)} %)</td><td class="n">+${fmt(bonus)}</td></tr>`;
    }
    html += `<tr class="total"><td>${L$`Total`}</td><td class="n" id="econ-total">+${fmt(p.income)}</td></tr></tbody></table>`;
    if (!groups.has('farm') && !groups.has('mine')) html += `<p class="hint-press" style="margin:0">${L$`Construye Granjas y Minas para ganar más.`}</p>`;
    return html;
  }

  energyHtml(g) {
    const p = g.players[0];
    const groups = new Map();
    for (const b of g.buildings) {
      if (!b.alive || b.owner !== 0 || !b.built || !b.def.energy) continue;
      const k = groups.get(b.type) || { n: 0, sum: 0 };
      k.n++;
      k.sum += g.bEnergy(b);
      groups.set(b.type, k);
    }
    let html = `<header><h4>${L$`Energía`}</h4><button class="btn icon" type="button" data-close aria-label="${L$`Cerrar`}">` + ICON.close + '</button></header><table><tbody>';
    if (!groups.size) html += `<tr><td>${L$`Sin energías`}</td><td class="n">+0 / 10 s</td></tr>`;
    for (const [type, k] of groups) html += `<tr><td>${esc(BUILDINGS[type].name)} ×${k.n}</td><td class="n">+${k.sum} / 10 s</td></tr>`;
    html += `<tr class="total"><td>${L$`Disponible`}</td><td class="n">${fmt(p.energy)}</td></tr></tbody></table>`;
    html += `<p class="hint-press" style="margin:0">${L$`La producen Solar, Eólica, Hidráulica, Mareomotriz y Undimotriz. La gastan vehículos, buques de guerra, helicópteros, la Fábrica y el Helipuerto.`}</p>`;
    return html;
  }

  scoreHtml(g) {
    const land = g.cells.filter((c) => TERRAIN[c.t].land).length || 1;
    const terr = new Map();
    for (const c of g.cells) if (c.owner >= 0 && TERRAIN[c.t].land) terr.set(c.owner, (terr.get(c.owner) || 0) + 1);
    const myTeam = g.players[0].team;
    const rows = g.players.map((p) => {
      const army = g.units.filter((u) => u.alive && u.owner === p.id && u.def.weapon).length;
      const blds = g.buildings.filter((b) => b.alive && b.owner === p.id).length;
      const pts = g.points.filter((pt) => pt.owner === p.id).length;
      const role = p.human ? '—' : PERSONALITIES[p.persona].name;
      const rel = p.id === 0 ? '' : p.team === myTeam ? ' · aliado' : '';
      // v1.1: alianzas en los modos de todos contra todos.
      const canAlly = g.alliancesAllowed() && p.id !== 0 && p.alive && g.players[0].alive;
      const allyBtn = !canAlly ? '' : p.team === myTeam
        ? `<button class="btn mini danger" type="button" data-ally="break" data-pid="${p.id}">${L$`Romper`}</button>`
        : `<button class="btn mini" type="button" data-ally="ask" data-pid="${p.id}">${L$`Aliarse`}</button>`;
      return `<tr class="${p.alive ? '' : 'dead'}" data-pid="${p.id}"><td><i class="dot" style="background:${hexColor(p.color)}"></i>${esc(p.name)}</td>
        <td>${esc(role)}${rel}${allyBtn}</td><td class="n">${Math.round(((terr.get(p.id) || 0) / land) * 100)} %</td>
        <td class="n">${army}</td><td class="n">${blds}</td><td class="n">${p.alive ? '+' + fmt(p.income) : '—'}</td><td class="n">${pts}</td></tr>`;
    }).join('');
    const hasAllies = g.players.some((q) => q.id !== 0 && q.alive && !q.human && q.team === myTeam) && g.players[0].alive;
    const orders = hasAllies ? `<div class="allyorders"><span>${L$`A tus aliados:`}</span>
      <button class="btn mini gold" type="button" data-ally="help" data-pid="0" id="btn-ally-help">${L$`¡Ayuda!`}</button>
      <button class="btn mini gold" type="button" data-ally="attack" data-pid="0" id="btn-ally-attack">${L$`¡Ataquemos!`}</button></div>` : '';
    const hint = g.alliancesAllowed() ? `<p class="allyhint">${L$`Toca «Aliarse» para proponer una alianza: los aliados no se atacan y comparten lo que ven. Al final solo puede ganar uno.`}</p>` : '';
    return `<header><h4>Marcador · ${fmtTime(g.time)}</h4><span class="row" style="gap:6px"><button class="btn mini" type="button" data-openchat id="btn-open-chat">${L$`Mensajes`}</button><button class="btn icon" type="button" data-close aria-label="${L$`Cerrar`}">${ICON.close}</button></span></header>${orders}${hint}
      <div class="wrap"><table><thead><tr><th>${L$`Imperio`}</th><th>${L$`Estilo`}</th><th>${L$`Territorio`}</th><th>${L$`Ejército`}</th><th>${L$`Edificios`}</th><th>Monedas/min</th><th>${L$`Puntos`}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  // ---------- Aviones y Aeropuerto (v1.0) ----------
  planeState(u) {
    if (u.repairing) return 'Vuelve a repararse';
    if (u.autoTarget && u.autoTarget.alive) return T$('En combate');
    if (u.moving) return T$('En vuelo');
    return T$('Patrulla en círculo');
  }

  planeHtml(planes) {
    const g = this.app.game;
    const rows = [];
    for (const type of ['fighter', 'bomber']) {
      const list = planes.filter((u) => u.type === type);
      if (!list.length) continue;
      const d = UNITS[type];
      const w = d.weapon;
      const u = list[0];
      const hp = Math.round((list.reduce((a, x) => a + x.hp / x.maxHp, 0) / list.length) * 100);
      const cells = [`<span>${L$`Estado`}</span><b>${esc(this.planeState(u))}</b>`, `<span>${L$`Vida`}</span><b>${hp} %</b>`];
      if (type === 'fighter') {
        cells.push(`<span>${L$`Misiles aire-aire`}</span><b>${L$`${w.dmg} · ×${w.mult.air} a aviones`}</b>`, `<span>${L$`Alcance`}</span><b>${L$`${w.range} casillas`}</b>`);
      } else {
        const cd = Math.max(0, u.cd || 0);
        const seen = g.time - (u.lastShot || -99) < 3;
        cells.push(`<span>${L$`Bombas`}</span><b class="${cd > 0.2 ? 'radar-track' : 'radar-idle'}">${cd > 0.2 ? `Recargando ${Math.ceil(cd)} s` : T$('Listas')}</b>`,
          `<span>${L$`Furtivo`}</span><b class="${seen ? 'radar-lock' : ''}">${seen ? T$('Visible (acaba de soltar bombas)') : T$('Oculto: solo se ve a 3 casillas')}</b>`);
      }
      rows.push(`<div class="planecard"><img src="${Thumbs.get(type, PLAYER_COLORS[0])}" alt="">
        <div><div class="radar-status"><b>${esc(d.name)}</b>${list.length > 1 ? ` ×${list.length}` : ''}</div><div class="numbers">${cells.join('')}</div></div></div>`);
    }
    const tip = planes.some((u) => u.type === 'bomber')
      ? T$('«Bombardear zona»: toca un lugar y los Bombarderos van atacando los edificios que encuentren.')
      : T$('Los Cazas buscan solos aviones y helicópteros enemigos; con poca vida vuelven al Aeropuerto o al Helipuerto.');
    return rows.join('') + `<div class="queue">${tip}</div>`;
  }

  airportHtml(b) {
    const g = this.app.game;
    const heal = g.healOf(b);
    const R = heal.range * SQ3 + 0.6;
    const near = g.units.filter((u) => u.alive && !u.inside && u.owner === b.owner && u.cls === 'air' && Math.hypot(u.x - b.x, u.z - b.z) <= R);
    const mine = g.units.filter((u) => u.alive && u.owner === b.owner && u.def.plane);
    const nF = mine.filter((u) => u.type === 'fighter').length;
    const nB = mine.filter((u) => u.type === 'bomber').length;
    const pads = near.length
      ? near.map((u) => `<span class="padslot"><img src="${Thumbs.get(u.type, PLAYER_COLORS[u.owner])}" alt=""><b>${Math.round((u.hp / u.maxHp) * 100)} %</b></span>`).join('')
      : `<span class="queue">${L$`Ningún avión en la pista ahora.`}</span>`;
    return `<div class="radar airport"><div class="radar-scope" aria-hidden="true"><i></i></div><div class="radar-body">
      <div class="radar-status">${L$`Torre de control ·`} <b>${nF} ${nF === 1 ? T$('Caza') : T$('Cazas')} · ${nB} ${nB === 1 ? T$('Bombardero') : T$('Bombarderos')}</b></div>
      <div class="pads">${pads}</div>
      <div class="queue">${L$`Repara ${Math.round(heal.rate)} de vida por segundo a los aviones y helicópteros cercanos; los dañados vuelven solos aquí.`}</div></div></div>`;
  }

  // ---------- AIR DEFENSE y Torreta (v0.9): alcance, recarga, contra qué sirve y qué sigue el radar ----------
  radarHtml(b) {
    const g = this.app.game;
    const w = g.weaponOf(b);
    const air = (w.mult.air || 0) > 0;
    const rows = [`<span>${L$`Alcance`}</span><b>${L$`${w.range} casillas`}</b>`,
      `<span>${L$`Recarga`}</span><b>${w.cd.toLocaleString(I18N.locale())} s${w.salvo ? ` ${L$`· ráfaga de ${w.salvo}`}` : ''}</b>`,
      `<span>${w.salvo ? T$('Daño a aeronaves por ráfaga') : T$('Daño a aeronaves por tiro')}</span><b>${air ? fmt(w.dmg * w.mult.air * (w.salvo || 1)) : 'no'}</b>`];
    if (b.type === 'aadef' || (b.def.aaLevel && b.level >= b.def.aaLevel)) rows.push(`<span>${L$`Detecta furtivos`}</span><b>${L$`a 3 casillas`}</b>`);
    const t = b.lockOn && b.lockOn.alive && g.inRange(b, w, b.lockOn) ? b.lockOn : b.autoTarget && b.autoTarget.alive ? b.autoTarget : null;
    let status = `<b class="radar-idle">${L$`Sin blancos`}</b>`;
    if (t) {
      const name = t.kind === 'bld' ? t.def.name : UNITS[t.type].name;
      const locking = w.lock && b.lockOn === t && b.lockT > 0;
      status = `<b class="${locking ? 'radar-track' : 'radar-lock'}">${locking ? T$('Siguiendo') : T$('Fijado')}: ${esc(name)}</b>`;
    }
    return `<div class="radar"><div class="radar-scope" aria-hidden="true"><i></i></div>
      <div class="radar-body"><div class="radar-status">Radar · ${status}</div><div class="numbers">${rows.join('')}</div></div></div>`;
  }

  // ---------- ficha de unidad ----------
  // v1.6: por qué no se puede entrenar esta tropa ahora (vacío si se puede).
  trainWhy(p, u) {
    // v1.7: el Lanzador nuclear móvil depende del uso estratégico y de su límite (1).
    if (u.strategic) {
      const g = this.app.game;
      if (g.strategicLeft(p.id) <= 0) return T$('Uso estratégico agotado (0/1)');
      if (g.units.some((x) => x.alive && x.owner === p.id && x.type === u.key)) return T$('Límite: 1 de 1');
    }
    if (p.coins < u.cost) return L$`Faltan ${fmt(Math.ceil(u.cost - p.coins))} monedas`;
    if (p.energy < (u.energy || 0)) return L$`Faltan ${fmt(Math.ceil(u.energy - p.energy))} de energía`;
    if (p.popUsed + u.pop > p.popCap) return T$('Comunidad llena: construye Casas');
    return '';
  }

  // v1.5: «la próxima en 3 s · todo en 12 s» (o por qué no avanza).
  queueTimeText(b) {
    const g = this.app.game;
    if (!b.queue.length) return '';
    const rate = g.prodRate(b);
    if (!(rate > 0)) return T$('parada: falta energía');
    const q = b.queue[0];
    const first = Math.max(0, (UNITS[q.type].build - q.t) / rate);
    let total = first;
    for (let i = 1; i < b.queue.length; i++) total += UNITS[b.queue[i].type].build / rate;
    const f = (x) => (x < 60 ? `${Math.ceil(x)} s` : fmtTime(x));
    return b.queue.length > 1 ? L$`la próxima en ${f(first)} · todas en ${f(total)}` : L$`lista en ${f(first)}`;
  }

  // v1.5: ficha de una tropa: vida, daño, alcance, velocidad y contra qué es buena o mala.
  unitTilesHtml(u) {
    const d = u.def;
    const w = d.weapon;
    const tiles = [[T$('Vida máxima'), fmt(u.maxHp), u.vet ? 'gold' : '']];
    if (w) {
      const mult = 1 + (u.vet || 0) * VETERAN.dmg;
      tiles.push([T$('Daño/s'), fmt((w.dmg * mult) / w.cd), u.vet ? 'gold' : '']);
      tiles.push([T$('Alcance'), L$`${w.range} casillas`, '']);
    }
    tiles.push([T$('Velocidad'), d.speed.toLocaleString(I18N.locale()), '']);
    let html = `<div class="coretiles unittiles">${tiles.map(([k, v, c]) => `<div class="ctile ${c}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
    if (w) {
      const cls = ['inf', 'veh', 'ship', 'sub', 'air', 'bld'];
      const strong = cls.filter((c) => (w.mult[c] || 0) >= 1.2).map((c) => CAT_NAMES[c]);
      const weak = cls.filter((c) => w.mult[c] > 0 && w.mult[c] <= 0.5).map((c) => CAT_NAMES[c]);
      const none = cls.filter((c) => !(w.mult[c] > 0)).map((c) => CAT_NAMES[c]);
      const line = [];
      if (strong.length) line.push(`<span class="vs good">${L$`Fuerte contra:`} <b>${strong.join(', ')}</b></span>`);
      if (weak.length) line.push(`<span class="vs bad">${L$`Débil contra:`} <b>${weak.join(', ')}</b></span>`);
      if (none.length) line.push(`<span class="vs muted">${L$`No ataca a:`} <b>${none.join(', ')}</b></span>`);
      if (line.length) html += `<div class="vsline">${line.join('')}</div>`;
    }
    return html;
  }

  statsHtml(type) {
    const u = UNITS[type];
    const w = u.weapon;
    const parts = [`<div class="title">${esc(u.name)}</div>`];
    parts.push(`<div><span>${L$`Vida`}</span> <b>${fmt(u.hp)}</b></div>`);
    if (w) {
      parts.push(`<div><span>${L$`Daño/s`}</span> <b>${fmt(w.dmg / w.cd)}</b></div>`);
      parts.push(`<div><span>${L$`Alcance`}</span> <b>${w.range}</b> ${L$`casillas`}</div>`);
    }
    parts.push(`<div><span>${L$`Velocidad`}</span> <b>${u.speed.toLocaleString(I18N.locale())}</b></div>`);
    parts.push(`<div><span>${L$`Población`}</span> <b>${u.pop}</b>${u.energy ? ` · <span>${L$`Energía`}</span> <b>${u.energy}</b>` : ''}</div>`);
    if (w) {
      const cls = ['inf', 'veh', 'ship', 'sub', 'air', 'bld'];
      const strong = cls.filter((c) => (w.mult[c] || 0) >= 1.3).map((c) => CAT_NAMES[c]);
      const none = cls.filter((c) => !(w.mult[c] > 0)).map((c) => CAT_NAMES[c]);
      if (strong.length) parts.push(`<div class="wide">${L$`Fuerte contra:`} <b>${strong.join(', ')}</b></div>`);
      if (none.length) parts.push(`<div class="wide">${L$`No ataca a:`} <b>${none.join(', ')}</b></div>`);
    } else {
      parts.push(`<div class="wide">${L$`No combate. ${esc(u.desc)}`}</div>`);
    }
    return parts.join('');
  }

  showCardInfo(type) {
    this.cardInfoType = type;
    const el = $('cardinfo');
    if (!el) return;
    el.innerHTML = this.statsHtml(type);
    el.hidden = false;
  }

  showBox(x1, y1, x2, y2) {
    const el = $('boxsel');
    el.hidden = false;
    el.style.left = Math.min(x1, x2) + 'px';
    el.style.top = Math.min(y1, y2) + 'px';
    el.style.width = Math.abs(x2 - x1) + 'px';
    el.style.height = Math.abs(y2 - y1) + 'px';
  }

  hideBox() {
    $('boxsel').hidden = true;
  }

  showPlaceBar(p) {
    let text = '';
    const isBuild = p.kind === 'build';
    $('btn-place-rot').hidden = !isBuild;
    $('btn-place-ok').hidden = !isBuild;
    $('btn-place-cancel').hidden = false;
    $('btn-place-cancel').textContent = isBuild && p.placed ? T$('Terminar') : T$('Cancelar');
    if (p.kind === 'labspawn') $('btn-place-cancel').textContent = p.placed ? T$('Terminar') : T$('Cancelar');
    if (isBuild) {
      // v1.0: tocar una casilla muestra la obra; «Construir» la pone; «Terminar» sale.
      const d = BUILDINGS[p.btype];
      const price = `<span class="cost">${fmt(d.cost)}</span>${d.energyCost ? ` <span class="ecost">${ICON.bolt}${d.energyCost}</span>` : ''}`;
      const placed = p.placed ? ` · <b>${p.placed}</b> ${p.placed === 1 ? 'puesta' : 'puestas'}` : '';
      if (p.err && p.cell >= 0) text = `<b>${esc(d.name)}</b> · <span class="err">${esc(p.err)}</span>${placed}`;
      else if (p.cell >= 0) text = `<b>${esc(d.name)}</b> ${L$`· ${price} · Toca «Construir» para poner la obra aquí${placed}`}`;
      else if (p.valid && p.valid.size) text = `<b>${esc(d.name)}</b> ${L$`· ${price} · Toca una casilla dorada y luego «Construir»${placed}`}`;
      else text = L$`No quedan casillas para ${esc(d.name)} en tu territorio${placed}. ${esc(d.desc)}`;
      $('btn-place-ok').disabled = p.cell < 0 || !!p.err;
      $('btn-place-rot').disabled = false;
    } else if (p.kind === 'labspawn') {
      const d = UNITS[p.type];
      const who = p.owner === 0 ? T$('tuya') : T$('del rival');
      const times = !p.placed ? '' : p.placed === 1 ? T$(' · puesta 1 vez') : L$` · puesta ${p.placed} veces`;
      text = `<b>${esc(d.name)}</b> ×${p.n} · ${who} · ${T$('Toca el mapa donde aparece')}${times}`;
    } else if (p.kind === 'labtp') {
      text = p.units.length === 1 ? T$('Toca adónde mover al instante la tropa elegida')
        : L$`Toca adónde mover al instante las <b>${p.units.length}</b> tropas elegidas`;
    } else if (p.kind === 'found') {
      text = p.valid && p.valid.size
        ? `${L$`Toca dónde fundar el`} <b>${L$`Puesto avanzado`}</b> · <span class="cost">800</span> ${L$`al llegar`}`
        : T$('No hay sitio alcanzable para fundar un puesto');
    } else if (p.kind === 'rally') {
      text = `${L$`Toca el`} <b>${L$`punto de reunión`}</b> ${L$`para las tropas nuevas`}`;
    } else if (p.kind === 'mnuke') {
      text = p.valid && p.valid.size
        ? `${L$`Toca la zona del`} <b>${L$`misil del Lanzador nuclear móvil`}</b> ${L$`(alcance ${STRATEGIC.range} casillas). Después te pide confirmar.`}`
        : T$('No hay ninguna zona al alcance del lanzador: acércalo más.');
    } else if (p.kind === 'silo') {
      text = `${L$`Toca la zona del`} <b>DF-5C</b> ${L$`(alcance ${NUKE.range} casillas). Después te pide confirmar.`}`;
    } else if (p.kind === 'nuke') {
      text = `${L$`Toca el blanco del`} <b>${L$`misil nuclear`}</b> · <span class="cost">${fmt(NUKE.cost)}</span> ${L$`· llega en ${NUKE.flight} s${this.app.game.strategic ? T$(' · uso único: después te pide confirmar') : ''}`}`;
    } else if (p.kind === 'allyattack') {
      text = `${L$`Toca un edificio, una tropa o el territorio del`} <b>rival</b> ${L$`que quieres atacar con tus aliados`}`;
    } else if (p.kind === 'bombzone') {
      text = `${L$`Toca la`} <b>${L$`zona a bombardear`}</b>${L$`: ${p.units.length} ${p.units.length === 1 ? T$('Bombardero va') : T$('Bombarderos van')} atacando los edificios que encuentren`}`;
    } else if (p.kind === 'nuke3') {
      text = `${L$`Toca el blanco de los`} <b>${L$`3 misiles nucleares`}</b> · <span class="cost">${fmt(NUKE.cost * 3)}</span> ${L$`· llegan en ${NUKE.flight} s`}`;
    }
    $('placetext').innerHTML = text;
    $('placebar').hidden = false;
    $('selpanel').hidden = true;
  }

  hidePlaceBar() {
    $('placebar').hidden = true;
    this.selSig = '';
  }

  // ---------- panel de construcción ----------
  renderBuildList() {
    const tab = BUILD_TABS.find((t) => t.id === this.tab);
    const g0 = this.app.game;
    // v1.8: el Complejo estratégico solo aparece con «Arsenal estratégico».
    $('blist').innerHTML = tab.items.filter((k) => !g0 || g0.buildable(k)).map((k) => {
      const d = BUILDINGS[k];
      return `<button class="bitem" type="button" data-b="${k}">
        <img src="${Thumbs.get(k, PLAYER_COLORS[0])}" alt="">
        <div class="top"><b>${esc(d.name)}</b><span class="costs"><span class="cost">${fmt(d.cost)}</span>${d.energyCost ? `<span class="ecost">${ICON.bolt}${d.energyCost}</span>` : ''}</span></div>
        <div class="desc">${esc(d.desc)}<span data-count="${k}"></span></div>
        <small class="why" data-why="${k}"></small>
      </button>`;
    }).join('');
    this.buildSig = '';
    this.refreshBuild(true);
  }

  refreshBuild(force) {
    const g = this.app.game;
    if (!g) return;
    const p = g.players[0];
    const placing = this.app.input.placement;
    const items = $('blist').querySelectorAll('[data-b]');
    let sig = '';
    const states = [];
    items.forEach((el) => {
      const k = el.dataset.b;
      const d = BUILDINGS[k];
      const n = g.count(0, k);
      const poor = p.coins < d.cost;
      const poorE = !!d.energyCost && p.energy < d.energyCost;
      const limit = g.limitFor(0, k);
      const maxed = limit && n >= limit;
      const act = placing && placing.kind === 'build' && placing.btype === k;
      // v1.6: el motivo, con el número exacto (cambia con las monedas y la energía).
      const why = maxed ? L$`Límite: ${n} de ${limit}` : poor ? L$`Faltan ${fmt(Math.ceil(d.cost - p.coins))} monedas` : poorE ? L$`Faltan ${fmt(Math.ceil(d.energyCost - p.energy))} de energía` : '';
      states.push([el, k, d, n, poor, maxed, act, poorE, limit, why]);
      sig += `${k}${n}${poor}${maxed}${act}${poorE}${limit}${why}|`;
    });
    if (!force && sig === this.buildSig) return;
    this.buildSig = sig;
    for (const [el, k, d, n, poor, maxed, act, poorE, limit, why] of states) {
      const w = el.querySelector('.why');
      if (w && w.textContent !== why) w.textContent = why;
      el.classList.toggle('poor', poor);
      el.classList.toggle('poorE', poorE);
      el.classList.toggle('maxed', !!maxed);
      el.classList.toggle('active', !!act);
      const cnt = el.querySelector(`[data-count="${k}"]`);
      if (cnt) cnt.textContent = limit ? ` (${n}/${limit})` : n ? ` (${n})` : '';
    }
  }

  // ---------- panel de selección ----------
  renderSel(force) {
    const app = this.app;
    const g = app.game;
    const panel = $('selpanel');
    const sel = app.selection.filter((e) => e.alive);
    if (!sel.length || app.input.placement) {
      panel.hidden = true;
      this.selSig = '';
      return;
    }
    const p = g.players[0];
    let sig = sel.map((e) => e.id).join(',');
    const first = sel[0];
    if (first.kind === 'point') {
      sig += `|${first.owner}|${first.contested}|${Math.round(first.prog * 20)}`;
    } else if (first.kind === 'bld') {
      sig += `|${first.built}|${first.queue.map((q) => q.type).join('.')}|${first.rally >= 0}|${this.demolishArm}|${first.level}` +
        `|${first.upgrading ? first.upgrading.level + ':' + Math.floor(first.upgrading.progress * 20) : ''}|${first.built ? '' : Math.floor(first.progress * 20)}` +
        `|${g.time - first.lastWork > 1.5}|${first.lastType || ''}|${first.loop ? 1 : 0}${first.loopWait || ''}` +
        // v1.8: investigación, puerta, guarnición y silo.
        `|${first.researching ? first.researching.key + Math.floor(first.researching.t) : ''}${first.type === 'research' ? JSON.stringify(p.research || {}) + (p.coins >= RESEARCH.armor.cost) : ''}` +
        `|${first.closed ? 'c' : ''}${first.cargo ? 'g' + first.cargo.length : ''}${first.type === 'silo' ? g.siloState(first) + Math.ceil(Math.max(0, (first.builtAt || 0) + STRATEGIC.prep - g.time)) : ''}`;
      if (first.def.produces) {
        sig += '|' + g.producesOf(first).map((t) => p.coins >= UNITS[t].cost && p.energy >= (UNITS[t].energy || 0)).join('') + (g.strategic ? 'q' + g.strategicLeft(0) : '');
      }
      const uc = g.upgradeCost(first);
      if (uc) sig += '|u' + (p.coins >= uc);
      if (first.type === 'airport') sig += '|p' + g.units.filter((u) => u.alive && u.owner === 0 && u.cls === 'air' && Math.hypot(u.x - first.x, u.z - first.z) < 4.5).map((u) => u.id + ':' + Math.floor((u.hp / u.maxHp) * 10)).join(',') + g.units.filter((u) => u.def.plane && u.owner === 0).length;
      if (first.type === 'aadef' || first.type === 'turret') sig += `|r${first.lockOn && first.lockOn.alive ? first.lockOn.id + (first.lockT > 0 ? 't' : 'l') : first.autoTarget && first.autoTarget.alive ? 'a' + first.autoTarget.id : '-'}`;
      if (first.type === 'aadef' || first.type === 'antinuke') sig += `|n${Math.ceil(Math.max(0, (first.nukeReadyAt || first.chargeAt || 0) - g.time))}${p.coins >= NUKE.cost}${first.type === 'aadef' && first.level >= 4 ? g.salvoInvalid(0) : ''}${g.strategic ? 'q' + g.strategicLeft(0) : ''}`;
      if (first.type === 'core' && first.owner === 0) {
        const d = p.dome;
        sig += `|d${d ? d.level + ':' + (d.hp > 0 ? Math.ceil((d.hp / d.maxHp) * 10) : 'x') : ''}${p.coins >= g.domeCost(0)}|e${p.emergencyUsed}${first.shieldUntil > g.time}`;
        if (first.level >= AUTO_UP.coreLevel) {
          const cand = g.upgradeCandidates(0);
          sig += `|a${p.autoUpgrade ? 1 : 0}:${cand.length}:${cand.filter((x) => g.upgradeCost(x) <= p.coins).length}`;
        }
      }
    } else {
      sig += '|' + sel.map((u) => u.state === 'found').join('') + (p.coins >= 800) +
        sel.map((u) => (u.cargo ? u.cargo.length : '')).join('') + `|${this.app.formation}|${this.app.input.amoveArm}` +
        `|${sel.map((u) => `${u.patrol ? 'p' : ''}${u.hold ? 'h' : ''}${u.vet || 0}:${u.kills || 0}`).join(',')}|${g.players[0].autoRepair !== false}` +
        // v1.7: estado del Lanzador nuclear móvil y pasajeros en camino.
        `|${sel.map((u) => (u.def.strategic ? g.mobileState(u) + Math.ceil(Math.max(0, (u.armAt || 0) - g.time)) : '') + (u.cargo ? 'b' + g.units.filter((x) => x.alive && !x.inside && x.boardTarget === u).length : '')).join('')}` +
        // v1.8: lanzapuentes y minador (cambia el motivo del botón).
        `|${sel.map((u) => (u.def.layBridge ? g.layBridgeInvalid(u) : u.def.layMine ? g.layMineInvalid(u) : '')).join('')}`;
      // Aviones (v1.0): estado, bombas y si el bombardero está oculto.
      for (const u of sel) if (u.def.plane) sig += `|${this.planeState(u)}${u.type === 'bomber' ? Math.ceil(Math.max(0, u.cd || 0)) + (g.time - (u.lastShot || -99) < 3 ? 'v' : 'o') : ''}`;
    }
    if (force || sig !== this.selSig) {
      this.selSig = sig;
      panel.hidden = false;
      panel.classList.toggle('more', !!this.selMore);
      if (first.kind === 'point') panel.innerHTML = this.pointHtml(first);
      else if (first.kind === 'bld') panel.innerHTML = this.buildingHtml(first);
      else if (first.owner === 0) panel.innerHTML = this.unitsHtml(sel);
      else panel.innerHTML = this.inspectHtml(first);
    }
    this.updateSelLive(sel);
  }

  head(type, color, title, sub, hpId = true) {
    return `<div class="selhead">
      <img class="thumb" src="${Thumbs.get(type, color)}" alt="">
      <div style="min-width:0"><h3>${title}</h3><p class="sec">${sub}</p>
        ${hpId ? '<div class="hp" id="sel-hpbar"><i id="sel-hp"></i></div><div class="hptext" id="sel-hptext"></div>' : ''}
      </div>
      <div class="headbtns"><button class="btn seltoggle" type="button" data-act="seldetails" id="btn-seldetails" aria-expanded="${!!this.selMore}">${this.selMore ? L$`${bi('less')}Menos` : L$`${bi('more')}Más detalles`}</button>
      <button class="btn icon" type="button" data-act="close" aria-label="${L$`Quitar selección`}" title="${L$`Quitar selección`}">${ICON.close}</button></div>
    </div>`;
  }

  // ---------- v1.7: nombre del grupo, orden actual, cola y uso estratégico ----------
  groupName(sel) {
    const land = sel.every((u) => u.mover === 'land');
    const sea = sel.every((u) => u.mover === 'sea');
    const air = sel.every((u) => u.mover === 'air');
    return land ? T$('Escuadra terrestre') : sea ? T$('Flota') : air ? T$('Escuadrilla aérea') : T$('Grupo mixto');
  }

  orderOf(u) {
    const s = u.state;
    if (u.def.strategic && this.app.game.strategic && this.app.game.mobileState(u) === 'prep' && !u.moving) return 'preparando';
    if (s === 'move') return T$('moviéndose');
    if (s === 'amove') return 'avanzando y atacando';
    if (s === 'attack') return 'atacando';
    if (s === 'patrol') return 'patrullando';
    if (s === 'build') return 'construyendo';
    if (s === 'repair') return 'reparando';
    if (s === 'board') return T$('subiendo al transporte');
    if (s === 'found') return T$('yendo a fundar un puesto');
    if (u.hold) return T$('manteniendo posición');
    if (u.def.weapon && u.autoTarget && u.autoTarget.alive) return T$('disparando a lo que tiene a tiro');
    return T$('en espera');
  }

  orderText(sel) {
    const counts = new Map();
    for (const u of sel) {
      const o = this.orderOf(u);
      counts.set(o, (counts.get(o) || 0) + 1);
    }
    if (counts.size === 1) return [...counts.keys()][0];
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([o, n]) => `${n} ${o}`).join(' · ');
  }

  queueResText(b) {
    const p = this.app.game.players[b.owner];
    const pop = b.queue.reduce((s, q) => s + UNITS[q.type].pop, 0);
    return L$`${b.queue.length} en cola · ${pop} ${pop === 1 ? T$('plaza reservada') : T$('plazas reservadas')} · Comunidad al terminar: ${p.popUsed} / ${p.popCap}`;
  }

  // Contador del uso estratégico (1/1 → 0/1): el mismo para el AIR DEFENSE de nivel 4 y el Lanzador nuclear móvil.
  stratQuotaHtml() {
    const g = this.app.game;
    const left = g.strategicLeft(0);
    return `<div class="stratbox ${left ? '' : 'spent'}" id="stratbox"><span class="lbl">${L$`Arsenal estratégico · uso único`}</span>
      <b class="stratnum" id="strat-num">${left} / ${STRATEGIC.uses}</b>
      <span class="strattext" id="strat-text">${left ? T$('Uso estratégico disponible. Al usarlo queda en 0 / 1 por el resto de la partida.') : T$('Agotado: ya usaste tu único uso estratégico de esta partida.')}</span></div>`;
  }

  mobileHtml(u) {
    const g = this.app.game;
    if (!g.strategic) return '';
    const st = g.mobileState(u);
    const left = st === 'spent' || st === 'quota' ? 0 : 1;
    const secs = Math.ceil(Math.max(0, (u.armAt || 0) - g.time));
    const text = st === 'prep' ? L$`Preparando: faltan ${secs} s. Después podrás elegir la zona.`
      : st === 'ready' ? L$`Disponible. Alcance: ${STRATEGIC.range} casillas. Un Escudo antimisiles lo puede derribar.`
        : st === 'spent' ? T$('Agotado: este lanzador ya usó su único misil. Volver a fabricarlo no devuelve el uso.')
          : T$('Agotado: ya usaste tu único uso estratégico con otro lanzador, el silo o el AIR DEFENSE.');
    return `<div class="stratbox ${left ? '' : 'spent'}" id="stratbox"><span class="lbl">${L$`Arsenal estratégico · uso único`}</span>
      <b class="stratnum" id="strat-num">${left} / ${STRATEGIC.uses}</b>
      <span class="strattext" id="strat-text">${text}</span>
      <button class="btn danger" type="button" data-act="mnuke" id="btn-mnuke" ${st === 'ready' ? '' : 'disabled'}>${L$`${bi('strat')}Elegir zona`}</button></div>`;
  }

  // Confirmación del uso estratégico: una sola orden (un doble toque no lanza dos); cancelar no gasta nada.
  askStrategic(p, ci) {
    const g = this.app.game;
    this.strat = { p, ci, busy: false };
    const c = g.cells[ci];
    const who = p.kind === 'mnuke' ? p.unit.def.name : p.kind === 'silo' ? T$('Complejo estratégico (DF-5C)') : T$('AIR DEFENSE de nivel 4');
    const zone = c.owner >= 0 ? L$`territorio de ${esc(g.players[c.owner].name)}` : T$('zona sin dueño');
    $('strat-body').innerHTML = `<span class="lbl stratchip">${L$`Arsenal estratégico · revisar uso`}</span>
      <h2>${L$`¿Usar ahora?`}</h2>
      <p>${L$`Esta acción consume tu`} <b>${L$`única utilización estratégica`}</b> ${L$`de la partida.`}</p>
      <p class="sec" id="strat-zone">${L$`Sale del ${who}. Zona elegida: ${zone}. Llega en ${NUKE.flight} s y los rivales reciben el aviso. No se puede recuperar el uso.`}</p>
      <div class="stratbox"><span class="lbl">${L$`Disponibilidad`}</span><b class="stratnum">${g.strategicLeft(0)} / ${STRATEGIC.uses}</b>
        <span class="strattext">${L$`Después de usarlo: 0 / ${STRATEGIC.uses} · Agotado`}</span></div>
      <div class="row"><button class="btn gold" type="button" id="btn-strat-ok">${L$`Confirmar uso único`}</button>
        <button class="btn" type="button" id="btn-strat-cancel">${L$`Cancelar`}</button></div>`;
    $('strat').hidden = false;
  }

  closeStrategic() {
    this.strat = null;
    $('strat').hidden = true;
  }

  confirmStrategic() {
    const s = this.strat;
    if (!s || s.busy) return;
    s.busy = true;
    const app = this.app;
    const g = app.game;
    const err = s.p.kind === 'mnuke' ? g.launchMobileNuke(s.p.unit, s.ci) : s.p.kind === 'silo' ? g.launchSilo(s.p.building, s.ci) : g.launchNuke(s.p.building, s.ci);
    this.closeStrategic();
    if (err) {
      this.toast(err, 'bad');
      app.sound.play('error');
      return;
    }
    app.renderer.addMoveMarker(s.ci, 0xff4040);
    this.toast(L$`Uso estratégico gastado: 0 / ${STRATEGIC.uses}`, 'info');
    app.input.cancelPlacement();
    this.selSig = '';
  }

  buildingHtml(b) {
    const g = this.app.game;
    const own = b.owner === 0;
    const d = b.def;
    const extra = [];
    const inc = g.bIncome(b);
    if (inc) extra.push(L$`+${fmt(inc * g.incomeMult(g.players[b.owner]))} monedas/min`);
    if (g.bPop(b)) extra.push(L$`+${g.bPop(b)} de población`);
    if (d.energy) extra.push(L$`+${g.bEnergy(b)} energía cada 10 s`);
    if (d.healLevels) extra.push(`${d.healLevels[b.level].name}: cura ${Math.round(d.healLevels[b.level].pct * 100)} %/s`);
    if (d.minigun) extra.push(b.level > 1 ? `${b.level - 1} minigun${b.level > 2 ? 's' : ''}` : T$('sin minigun'));
    const sub = (own ? '' : `<b style="color:${hexColor(PLAYER_COLORS[b.owner])}">${esc(g.players[b.owner].name)}</b> · `) +
      esc(d.desc) + (extra.length ? ' · ' + extra.join(' · ') : '');
    const maxLv = d.maxLevel;
    const lv = maxLv > 1
      ? ` <span class="lvtag">${L$`Nivel ${b.level}`}</span><span class="levels" title="${L$`Nivel ${b.level} de ${maxLv}`}">${Array.from({ length: maxLv }, (_, i) => `<i class="${i < b.level ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const mkey = GLB[b.type + '_' + b.level] ? b.type + '_' + b.level : b.type;
    let html = this.head(mkey, PLAYER_COLORS[b.owner], esc(d.levelNames ? d.levelNames[b.level] : d.name) + lv, sub);
    if (!own) return html + (g.isEnemy(b.owner, 0) ? this.counterHtml(b) : '');
    // Obra o mejora en curso.
    if (!b.built || b.upgrading) {
      const k = b.upgrading ? b.upgrading.progress : b.progress;
      const idle = g.time - b.lastWork > 1.5 && b.type !== 'outpost';
      const by = d.builtBy === 'sea' ? T$('un Barco constructor') : d.builtBy === 'engineer' ? T$('un Ingeniero') : T$('un Constructor o Ingeniero');
      html += `<div class="queue"><b>${b.upgrading ? L$`Mejorando a nivel ${b.upgrading.level}` : T$('En construcción')}</b> · ${Math.floor(k * 100)} % · ` +
        (idle ? `<span style="color:#ffb4b5">${L$`Sin constructor: selecciona ${by} y toca la obra.`}</span>` : T$('Un constructor está trabajando.')) + '</div>';
    }
    if (b.type === 'core') {
      const p = g.players[0];
      const dome = p.dome;
      // v0.9: el estado del Núcleo en casillas claras.
      const L = d.levels[b.level];
      const emer = p.emergencyUsed
        ? (b.shieldUntil > g.time ? [T$('Activo'), 'gold'] : [T$('Usado'), 'muted']) : [T$('Listo'), 'good'];
      const tiles = [
        [T$('Monedas'), `+${fmt(g.bIncome(b) * g.incomeMult(p))}/min`, ''],
        [T$('Comunidad'), `+${g.bPop(b)}`, ''],
        [T$('Láser'), `${L.laser.beams > 1 ? '2 × ' : ''}${L.laser.dmg} · ${L.laser.range} cas.`, ''],
        [T$('Emergencia'), emer[0], emer[1]],
        [T$('Cúpula'), dome ? (dome.hp > 0 ? L$`Nivel ${dome.level} · ${Math.round((dome.hp / dome.maxHp) * 100)} %`
          : `Rota · ${Math.max(0, Math.ceil(DOME.recover - (g.time - dome.brokenAt)))} s`) : (b.level < 3 ? T$('Núcleo nivel 3') : T$('Disponible')),
        dome ? (dome.hp > 0 ? 'good' : 'bad') : 'muted'],
      ];
      html += `<div class="coretiles sec">${tiles.map(([k, v, c]) => `<div class="ctile ${c}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
      if (dome && dome.level >= 3 && dome.hp > 0) html += `<div class="queue sec">${L$`La Cúpula nivel 3 da escudo a tus tropas mientras están dentro de ella.`}</div>`;
      const derr = g.domeInvalid(0);
      // v1.0: con el Núcleo en nivel 3, mejorar todo de un clic o dejar las mejoras automáticas.
      if (b.level >= AUTO_UP.coreLevel) {
        const cand = g.upgradeCandidates(0);
        let total = 0;
        let can = 0;
        let left = p.coins;
        for (const x of cand) {
          const c = g.upgradeCost(x);
          total += c;
          if (c <= left) { left -= c; can++; }
        }
        const auto = !!p.autoUpgrade;
        html += `<div class="upall"><div class="actions">
          <button class="btn gold" type="button" data-act="upall" id="btn-upall" ${can ? '' : 'disabled'}>${L$`${bi('upgrade')}Mejorar todo · ${can} de ${cand.length}`}</button>
          <button class="btn ${auto ? 'good' : ''}" type="button" data-act="autoup" id="btn-autoup" aria-pressed="${auto}">${L$`${bi('repeat')}Mejoras automáticas: ${auto ? T$('sí') : 'no'}`}</button></div>
          <span class="queue sec">${cand.length ? L$`Quedan ${cand.length} mejoras (${fmt(total)} en total). «Mejorar todo» pone a mejorar las que alcanza tu dinero; las automáticas siguen hasta el máximo y guardan ${fmt(AUTO_UP.reserve)} para tropas.` : T$('Todo está al máximo.')}</span></div>`;
      }
      if (!dome || dome.level < 3) {
        const next = dome ? dome.level + 1 : 1;
        const label = dome ? L$`Mejorar Cúpula a nivel ${next}` : T$('Comprar Cúpula');
        const why = b.level < 3 ? T$('Necesita el Núcleo en nivel 3.') : next === 3 ? T$('Nivel 3: escudo personal para todas tus tropas.')
          : L$`Absorbe el daño de barcos, aeronaves y Lanzamisiles a ${DOME_LEVELS[next].range} casillas del Núcleo.`;
        html += `<div class="actions"><button class="btn gold" type="button" data-act="dome" ${derr && b.level < 3 ? 'disabled' : ''}>${bi('dome')}${label} · ${fmt(g.domeCost(0))}</button>
          <span class="queue sec" style="flex:1 1 200px">${why}</span></div>`;
      }
    }
    if (d.produces && b.built) {
      const pl = g.players[0];
      html += '<div class="cards">' + g.producesOf(b).map((t) => {
        const u = UNITS[t];
        const poor = pl.coins < u.cost || pl.energy < (u.energy || 0);
        return `<button class="card ${poor ? 'poor' : ''}" type="button" data-act="train" data-type="${t}" title="${esc(u.desc)}">
          <img src="${Thumbs.get(t, PLAYER_COLORS[0])}" alt="">
          <b>${esc(u.name)}</b>
          <div class="meta"><span class="cost">${fmt(u.cost)}</span>${u.energy ? `<span class="ecost">${ICON.bolt}${u.energy}</span>` : ''}<span>${ICON.pop}${u.pop}</span></div>
          <small class="why" data-why="${t}">${esc(this.trainWhy(pl, u))}</small>
        </button>`;
      }).join('') + '</div>';
      if (b.lastType && d.produces.includes(b.lastType)) {
        // Repetir (v0.7): vuelve a poner la última tropa entrenada, una o cinco veces.
        const lu = UNITS[b.lastType];
        html += `<div class="actions repeat"><span class="queue">${L$`Última:`} <b>${esc(lu.name)}</b></span>
          <button class="btn" type="button" data-act="repeat" data-n="1" id="btn-repeat">${bi('repeat')}Repetir · ${fmt(lu.cost)}</button>
          <button class="btn" type="button" data-act="repeat" data-n="5" id="btn-repeat5">${bi('repeat')}×5 · ${fmt(lu.cost * 5)}</button>
          <button class="btn ${b.loop ? 'good' : ''}" type="button" data-act="loop" id="btn-loop" aria-pressed="${!!b.loop}" title="${L$`Sigue entrenando la última tropa mientras alcance el dinero y la comunidad`}">${L$`${bi('repeat')}Siempre: ${b.loop ? T$('sí') : 'no'}`}</button></div>`;
        if (b.loop && b.loopWait && !b.queue.length) html += `<div class="queue" id="loop-wait">${L$`Esperando: ${esc(b.loopWait)}`}</div>`;
      }
      const info = this.cardInfoType && d.produces.includes(this.cardInfoType) ? this.statsHtml(this.cardInfoType) : '';
      html += `<div class="cardinfo" id="cardinfo" ${info ? '' : 'hidden'}>${info}</div>`;
      // v1.5: la cola dice cuánto falta y cada tropa tiene su «×» para quitarla (devuelve el dinero).
      html += `<div class="queue ${b.queue.length ? '' : 'sec'}" id="sel-queue">` + (b.queue.length
        ? `<span class="qhead">${L$`En cola ·`} <b id="sel-qtime">${this.queueTimeText(b)}</b></span><span class="qres" id="sel-qres">${esc(this.queueResText(b))}</span>` + b.queue.map((q, i) => `<button class="qitem" type="button" data-act="cancel" data-idx="${i}" title="${L$`Quitar ${esc(UNITS[q.type].name)} (te devuelve ${fmt(UNITS[q.type].cost)})`}" aria-label="${L$`Quitar ${esc(UNITS[q.type].name)}`}">
            <img src="${Thumbs.get(q.type, PLAYER_COLORS[0])}" alt=""><i style="width:0"></i><span class="qx" aria-hidden="true">×</span></button>`).join('') +
          `<span class="qnote">${L$`Toca una para quitarla: te devuelve el dinero.`}</span>`
        : T$('Toca una tropa para entrenarla; mantenla pulsada para ver su ficha.')) + '</div>';
    }
    if (b.built && d.weapon && (b.type === 'aadef' || b.type === 'turret')) html += this.radarHtml(b);
    if (b.type === 'aadef' && b.built && b.level >= 4) {
      // Misil nuclear (v0.9): muy caro, recarga de 3 min.
      const why = g.nukeInvalid(b);
      const wait = g.time < (b.nukeReadyAt || 0);
      if (g.strategic) html += this.stratQuotaHtml();
      html += `<div class="actions nukebox"><button class="btn danger" type="button" data-act="nuke" id="btn-nuke" ${why ? 'disabled' : ''}>${L$`☢ Misil nuclear · ${fmt(NUKE.cost)}`}</button>
        <span class="queue" style="flex:1 1 200px">${wait ? `Recargando: ${Math.ceil(b.nukeReadyAt - g.time)} s` : why || L$`Listo. Daña todo en ${NUKE.radius} casillas y deja ${NUKE.rad.time} s de radiación; un Escudo antimisiles lo puede derribar.`}</span></div>`;
      // v1.0: los 3 a la vez (un Escudo antimisiles solo derriba uno por carga).
      const why3 = g.salvoInvalid(0);
      html += `<div class="actions nukebox"><button class="btn danger" type="button" data-act="nuke3" id="btn-nuke3" ${why3 ? 'disabled' : ''}>${L$`☢☢☢ Lanzar los 3 · ${fmt(NUKE.cost * 3)}`}</button>
        <span class="queue" style="flex:1 1 200px">${why3 || T$('Tus 3 AIR DEFENSE de nivel 4 disparan juntos al mismo blanco: un Escudo antimisiles solo puede derribar uno.')}</span></div>`;
    } else if (b.type === 'aadef' && b.built) {
      html += `<div class="queue">${L$`Nivel 4 (solo 3 de tus AIR DEFENSE): lanza el misil nuclear.`}</div>`;
    }
    if (b.type === 'airport' && b.built) html += this.airportHtml(b);
    if (b.type === 'antinuke' && b.built) {
      const ready = g.time >= (b.chargeAt || 0);
      html += `<div class="queue">${ready ? `<b style="color:var(--good)">${L$`Carga lista`}</b>${L$`: derriba un misil nuclear que caiga a 7 casillas.`}` : `Recargando: ${Math.ceil(b.chargeAt - g.time)} s`}</div>`;
      html += `<div class="queue">${L$`Defensa de punto: derriba misiles y cohetes enemigos a ${b.def.pointDefense.range} casillas · derribados:`} <b>${b.pdKills || 0}</b></div>`;
    }
    if (b.built) html += this.extraBuildingHtml(b);
    const acts = [];
    if (own && b.built && !b.upgrading && b.level < maxLv) {
      // v0.9: antes de pagar, qué vas a ganar con la mejora.
      const prev = g.upgradePreview(b).map((t) => t.replace(/^Ahora es /, 'Pasa a ser '));
      if (prev.length) html += `<div class="nextup"><small>${L$`Nivel ${b.level} → ${d.levelNames ? esc(d.levelNames[b.level + 1]) : L$`nivel ${b.level + 1}`}`}</small>${prev.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
    }
    if (b.built && !b.upgrading && b.level < maxLv) {
      const nextName = d.levelNames ? d.levelNames[b.level + 1] : L$`nivel ${b.level + 1}`;
      acts.push(`<button class="btn gold" type="button" data-act="upgrade">${L$`${bi('upgrade')}Mejorar a ${nextName} · ${fmt(g.upgradeCost(b))}`}</button>`);
    }
    if (d.produces && b.built) acts.push(`<button class="btn" type="button" data-act="rally">${bi('rally')}${b.rally >= 0 ? T$('Mover punto de reunión') : T$('Punto de reunión')}</button>`);
    if (b.type !== 'core') {
      acts.push(`<button class="btn danger" type="button" data-act="demolish">${bi('demolish')}${this.demolishArm === b.id ? T$('¿Seguro? Toca otra vez') : T$('Demoler')}</button>`);
    }
    if (acts.length) html += `<div class="actions mainacts">${acts.join('')}</div>`;
    return html;
  }

  // v1.8: Centro de investigación, Puerta reforzada, Búnker de guarnición, Complejo estratégico y defensas nuevas.
  extraBuildingHtml(b) {
    const g = this.app.game;
    const p = g.players[0];
    const d = b.def;
    let html = '';
    if (b.type === 'research') {
      const r = b.researching;
      html += '<div class="research" id="research">' + Object.entries(RESEARCH).map(([k, R]) => {
        const done = p.research && p.research[k];
        const now = r && r.key === k;
        const why = done ? T$('Lista') : now ? `${Math.floor((r.t / R.time) * 100)} %` : g.researchInvalid(b, k) || `${fmt(R.cost)} · ${R.time} s`;
        return `<button class="btn ${done ? 'good' : now ? 'gold' : ''}" type="button" data-act="research" data-v="${k}" ${done || now || g.researchInvalid(b, k) ? 'disabled' : ''}>
          <b>${esc(R.name)}</b><small>${esc(R.desc)}</small><em>${esc(why)}</em></button>`;
      }).join('') + '</div>';
    }
    if (b.type === 'gate') {
      html += `<div class="actions"><button class="btn ${b.closed ? 'danger' : 'good'}" type="button" data-act="gate" id="btn-gate">${b.closed ? T$('Abrir puerta') : T$('Cerrar puerta')}</button>
        <span class="queue" style="flex:1 1 200px">${b.closed ? T$('Cerrada: no pasa nadie.') : T$('Abierta: pasan tus tropas y las de tus aliados.')}</span></div>`;
    }
    if (d.garrison) {
      const n = b.cargo ? b.cargo.length : 0;
      html += `<div class="paxbox" id="paxbox"><div class="paxhead"><b>${L$`Guarnición`}</b><span id="pax-count">${L$`${n} / ${d.garrison} soldados · +${Math.round(n * d.garrisonDmg * 100)} % de daño`}</span></div>` +
        (n ? `<ul class="paxlist">${b.cargo.map((u) => `<li class="on"><img src="${Thumbs.get(u.type, PLAYER_COLORS[0])}" alt=""><span>${esc(u.def.name)}</span><em>adentro</em></li>`).join('')}</ul>`
          : `<div class="queue">${L$`Selecciona soldados y toca el Búnker para que entren.`}</div>`) + '</div>';
      if (n) html += `<div class="actions"><button class="btn gold" type="button" data-act="unload">${L$`${bi('unload')}Sacar soldados`}</button></div>`;
    }
    if (b.type === 'silo' && g.strategic) {
      const st = g.siloState(b);
      const left = st === 'spent' || st === 'quota' ? 0 : 1;
      const secs = Math.ceil(Math.max(0, (b.builtAt || 0) + STRATEGIC.prep - g.time));
      const text = st === 'prep' ? L$`Preparando el DF-5C: faltan ${secs} s.` : st === 'ready' ? L$`DF-5C listo. Alcance: ${NUKE.range} casillas. Un Escudo antimisiles lo puede derribar.`
        : st === 'spent' ? T$('Agotado: el silo ya lanzó su misil.') : T$('Agotado: ya usaste tu único uso estratégico.');
      html += `<div class="stratbox ${left ? '' : 'spent'}" id="stratbox"><span class="lbl">${L$`Arsenal estratégico · DF-5C · uso único`}</span>
        <b class="stratnum" id="strat-num">${left} / ${STRATEGIC.uses}</b><span class="strattext" id="strat-text">${text}</span>
        <button class="btn danger" type="button" data-act="silo" id="btn-silo" ${st === 'ready' ? '' : 'disabled'}>${L$`${bi('strat')}Elegir zona`}</button></div>`;
    }
    const facts = [];
    if (d.detect) facts.push(L$`Descubre lo oculto a ${d.detect} casillas`);
    if (d.vision && d.vision >= 7) facts.push(L$`Ve ${d.vision} casillas`);
    if (d.pointDefense && b.type !== 'antinuke') facts.push(L$`Derribados: ${b.pdKills || 0}`);
    if (b.jam) facts.push(`<span style="color:#ffb4b5">${L$`Interferencia enemiga: dispara ${Math.round(b.jam * 100)} % más lento`}</span>`);
    if (facts.length) html += `<div class="queue">${facts.join(' · ')}</div>`;
    return html;
  }

  unitsHtml(sel) {
    const counts = new Map();
    for (const u of sel) counts.set(u.type, (counts.get(u.type) || 0) + 1);
    const first = sel[0];
    const stars = (u) => (u.vet ? ` <span class="vetstars" title="${L$`Veterana: ${u.kills} eliminaciones`}">${'★'.repeat(u.vet)}</span>` : '');
    const vets = sel.filter((u) => u.vet).length;
    const title = sel.length === 1 ? esc(first.def.name) + stars(first) : `${esc(this.groupName(sel))}${vets ? ` <span class="vetstars">★ ${vets}</span>` : ''}`;
    const sub = sel.length === 1 ? esc(first.def.desc) + (first.def.weapon ? ` ${L$`· ${first.kills || 0} eliminaciones${first.vet < 3 ? ` ${L$`(próxima estrella con ${VETERAN.kills[first.vet || 0]})`}` : ''}`}` : '') : L$`${sel.length} tropas elegidas. Toca un destino para moverlas o un enemigo para atacarlo.`;
    // v1.7: «Centrar» junto a «Quitar selección», y la orden actual siempre a la vista.
    let html = this.head(first.type, PLAYER_COLORS[0], title, sub).replace('<div class="headbtns">',
      `<div class="headbtns"><button class="btn icon" type="button" data-act="center" id="btn-center" aria-label="${L$`Centrar la cámara en la selección`}" title="${L$`Centrar`}">${bi('center')}</button>`);
    html += `<div class="queue selorder" id="sel-order">${L$`Orden actual:`} <b>${esc(this.orderText(sel))}</b></div>`;
    if (sel.length === 1) html += this.unitTilesHtml(first);
    if (sel.length === 1 && first.def.strategic) html += this.mobileHtml(first);
    if (counts.size > 1) {
      // v1.5: tocar un tipo deja elegidas solo esas tropas.
      html += '<div class="chips">' + [...counts.entries()].map(([t, n]) =>
        `<button class="chip" type="button" data-act="seltype" data-type="${t}" title="${L$`Elegir solo ${esc(UNITS[t].name)}`}"><img src="${Thumbs.get(t, PLAYER_COLORS[0])}" alt="">${n}× ${esc(UNITS[t].name)}</button>`).join('') + '</div>';
    }
    const acts = [];
    // Transportes (Barcaza, Lancha, Jeep, Transporte blindado) y hangar del Portaaviones.
    const ship = sel.length === 1 && (first.def.capacity || first.def.hangar) ? first : null;
    if (ship) {
      const g = this.app.game;
      const hangar = !!ship.def.hangar;
      const cap = ship.def.capacity || ship.def.hangar;
      const how = hangar ? T$('Selecciona Cazas y toca el Portaaviones para guardarlos.')
        : ship.def.carries === 'inf' ? L$`Selecciona soldados y toca el ${ship.def.name} para subirlos.`
          : L$`Selecciona tropas de tierra y toca la ${ship.def.name} para subirlas.`;
      // v1.7: lista de pasajeros con nombre, y los que vienen en camino.
      const coming = g.units.filter((x) => x.alive && !x.inside && x.boardTarget === ship);
      const pax = [...ship.cargo.map((u) => [u, 'a bordo']), ...coming.map((u) => [u, T$('en camino')])];
      html += `<div class="paxbox" id="paxbox"><div class="paxhead"><b>${hangar ? T$('Hangar') : T$('Pasajeros')}</b><span id="pax-count">${g.cargoSlots(ship)} / ${cap} plazas${coming.length ? ` ${L$`· ${coming.length} en camino`}` : ''}</span></div>` +
        (pax.length ? `<ul class="paxlist">${pax.map(([u, st]) => `<li class="${st === 'a bordo' ? 'on' : 'way'}"><img src="${Thumbs.get(u.type, PLAYER_COLORS[0])}" alt=""><span>${esc(u.def.name)}</span><em>${st}</em></li>`).join('')}</ul>`
          : `<div class="queue">${how}</div>`) + '</div>';
      const label = hangar ? T$('Lanzar Cazas') : ship.mover === 'sea' || ship.mover === 'amphib' ? T$('Desembarcar') : ship.def.airlift && ship.def.plane ? T$('Lanzar en paracaídas') : T$('Bajar soldados');
      if (ship.cargo.length) acts.push(`<button class="btn gold" type="button" data-act="unload">${bi('unload')}${label}</button>`);
    }
    const planes = sel.filter((u) => u.def.plane);
    if (planes.length) {
      html += this.planeHtml(planes);
      if (planes.some((u) => u.type === 'bomber')) {
        acts.push(`<button class="btn gold" type="button" data-act="bombzone" id="btn-bombzone">${L$`${bi('amove')}Bombardear zona`}</button>`);
      }
    }
    if (sel.some((u) => u.def.builds)) {
      html += `<div class="queue">${L$`Construye solo las obras pendientes. Tócalo y luego una obra para mandarlo; toca un edificio dañado para repararlo.`}</div>`;
    }
    // v1.8: Vehículo lanzapuentes y Buque minador.
    const layer = sel.find((u) => u.def.layBridge);
    if (layer) {
      const why = this.app.game.layBridgeInvalid(layer);
      acts.push(`<button class="btn gold" type="button" data-act="laybridge" id="btn-laybridge" ${why ? 'disabled' : ''} title="${esc(why || T$('Pone un Puente modular en el agua poco profunda de al lado'))}">${L$`${bi('found')}Tender puente · ${fmt(BUILDINGS.bridge.cost)}`}</button>`);
      if (why) html += `<div class="queue">${esc(why)}</div>`;
    }
    const mlayer = sel.find((u) => u.def.layMine);
    if (mlayer) {
      const why = this.app.game.layMineInvalid(mlayer);
      acts.push(`<button class="btn gold" type="button" data-act="laymine" id="btn-laymine" ${why ? 'disabled' : ''}>${L$`${bi('found')}Sembrar mina · ${this.app.game.count(0, 'seamine')} / ${MINES.limit}`}</button>`);
      if (why) html += `<div class="queue">${esc(why)}</div>`;
    }
    const founder = sel.find((u) => u.def.founds);
    if (founder) {
      acts.push(`<button class="btn gold" type="button" data-act="found">${L$`${bi('found')}Fundar puesto · 800`}</button>`);
    }
    const app = this.app;
    if (sel.some((u) => u.def.weapon)) {
      const arm = app.input.amoveArm;
      acts.push(`<button class="btn ${arm === true ? 'gold' : ''}" type="button" data-act="amove" id="btn-amove" title="${L$`Avanzar atacando (F)`}">${bi('amove')}${arm === true ? T$('Toca el destino…') : T$('Avanzar atacando')}</button>`);
      // v1.4: patrullar y mantener posición.
      const patrolling = sel.some((u) => u.patrol);
      acts.push(`<button class="btn ${arm === 'patrol' || patrolling ? 'gold' : ''}" type="button" data-act="patrol" id="btn-patrol" title="${L$`Van y vuelven entre aquí y el punto que toques, peleando en el camino`}">${bi('patrol')}${arm === 'patrol' ? T$('Toca el otro punto…') : patrolling ? T$('Patrullando') : T$('Patrullar')}</button>`);
      const holding = sel.filter((u) => u.def.weapon).every((u) => u.hold);
      acts.push(`<button class="btn ${holding ? 'gold' : ''}" type="button" data-act="hold" id="btn-hold" aria-pressed="${holding}" title="${L$`Se quedan quietas y solo disparan a lo que tienen a tiro`}">${L$`${bi('hold')}Mantener posición: ${holding ? T$('sí') : 'no'}`}</button>`);
    }
    if (sel.some((u) => u.def.repairs)) {
      // v1.4: los Constructores e Ingenieros libres reparan solos lo dañado cerca.
      const on = this.app.game.players[0].autoRepair !== false;
      acts.push(`<button class="btn ${on ? 'good' : ''}" type="button" data-act="autorep" id="btn-autorep" aria-pressed="${on}" title="${L$`Los Constructores e Ingenieros sin trabajo reparan solos los edificios dañados a ${AUTO_REPAIR.range} casillas`}">${L$`${bi('wrench')}Reparación sola: ${on ? T$('sí') : 'no'}`}</button>`);
    }
    if (sel.length > 1) {
      acts.push(`<button class="btn" type="button" data-act="formation" id="btn-formation" title="${L$`Bloque: juntas · Línea: una al lado de otra, de frente al destino`}">${L$`${bi('formation')}Formación: ${app.formation === 'line' ? T$('línea') : 'bloque'}`}</button>`);
    }
    acts.push(`<button class="btn" type="button" data-act="stop">${L$`${bi('stop')}Detener`}</button>`);
    html += `<div class="actions mainacts">${acts.join('')}</div>`;
    html += `<div class="actions groupsave"><span class="queue">${L$`${bi('group')}Guardar en`}</span>${[1, 2, 3].map((n) =>
      `<button class="btn" type="button" data-act="savegrp" data-v="${n}" title="${L$`Guardar en el grupo ${n} (Ctrl o Mayús + ${n})`}">${n}</button>`).join('')}</div>`;
    return html;
  }

  pointHtml(pt) {
    const g = this.app.game;
    const ownerTxt = pt.owner >= 0
      ? `<b style="color:${hexColor(PLAYER_COLORS[pt.owner])}">${esc(g.players[pt.owner].name)}</b>` : T$('Sin dueño');
    const state = pt.contested ? T$('En disputa: hay tropas de varios equipos cerca')
      : pt.owner < 0 && pt.prog > 0 ? `Capturando… ${Math.floor(pt.prog * 100)} %`
        : L$`Para capturarlo: infantería a 1 casilla y sin enemigos a ${CAPTURE.clear} casillas durante ${CAPTURE.time} s.`;
    let html = this.head(pt.type, pt.owner >= 0 ? PLAYER_COLORS[pt.owner] : NEUTRAL, esc(pt.def.name),
      `${ownerTxt} · ${esc(pt.def.desc)}`, false);
    html += `<div class="queue">${state}</div>`;
    if (g.mode.king && pt.type === 'faro') {
      const parts = Object.entries(g.kingTime).map(([team, t]) => {
        const pid = g.players.findIndex((p) => String(p.team) === team);
        return `<b style="color:${hexColor(PLAYER_COLORS[pid])}">${esc(g.players[pid].name)}</b> ${fmtTime(t)}`;
      });
      html += `<div class="queue">${L$`Rey del Faro (meta ${fmtTime(KING_TIME)}): ${parts.join(' · ') || T$('nadie lo ha controlado aún')}`}</div>`;
    }
    return html;
  }

  inspectHtml(e) {
    const g = this.app.game;
    const owner = g.players[e.owner];
    const rel = g.isEnemy(e.owner, 0) ? T$('Enemigo') : T$('Aliado');
    const sub = `<b style="color:${hexColor(PLAYER_COLORS[e.owner])}">${esc(owner.name)}</b> · ${rel} · ${esc(e.def.desc)}`;
    return this.head(e.type, PLAYER_COLORS[e.owner], esc(e.def.name), sub) + (g.isEnemy(e.owner, 0) ? this.counterHtml(e) : '');
  }

  // Ficha del enemigo (v0.8): vida, nivel, contra qué es fuerte y qué conviene usar contra él.
  counterHtml(e) {
    const g = this.app.game;
    const cls = e.kind === 'bld' ? 'bld' : e.cls;
    const w = e.kind === 'bld' ? g.weaponOf(e) : e.def.weapon;
    const rows = [`<span>${L$`Vida`}</span><b id="enemy-hp">${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} (${Math.round((Math.max(0, e.hp) / e.maxHp) * 100)} %)</b>`];
    if (e.kind === 'bld' && e.def.maxLevel > 1) rows.push(`<span>${L$`Nivel`}</span><b>${e.level} de ${e.def.maxLevel}</b>`);
    if (w && w.mult) {
      const strong = Object.entries(w.mult).filter(([k, v]) => v >= 1.2 && CAT_NAMES[k]).map(([k]) => CAT_NAMES[k]);
      const cant = Object.entries(w.mult).filter(([k, v]) => v === 0 && CAT_NAMES[k]).map(([k]) => CAT_NAMES[k]);
      rows.push(`<span>${L$`Fuerte contra`}</span><b>${strong.length ? strong.join(', ') : T$('nada en especial')}</b>`);
      if (cant.length) rows.push(`<span>${L$`No ataca a`}</span><b>${cant.join(', ')}</b>`);
    } else {
      rows.push(`<span>${L$`Ataque`}</span><b>${L$`no dispara`}</b>`);
    }
    rows.push(`<span>${L$`Usa`}</span><b>${this.countersFor(cls).join(', ')}</b>`);
    return `<div class="cardinfo enemycard" id="enemycard">${rows.join('')}</div>`;
  }

  // Las 3 tropas que más daño hacen a esa clase por cada moneda (daño por segundo × multiplicador).
  countersFor(cls) {
    return Object.entries(UNITS)
      .filter(([, d]) => d.weapon && (d.weapon.mult[cls] || 0) > 0 && !d.limit)
      .map(([t, d]) => [t, ((d.weapon.dmg / d.weapon.cd) * d.weapon.mult[cls]) / Math.sqrt(d.cost)])
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => UNITS[t].name);
  }

  updateSelLive(sel) {
    const ehp = $('enemy-hp');
    if (ehp && sel[0]) ehp.textContent = `${fmt(Math.max(0, sel[0].hp))} / ${fmt(sel[0].maxHp)} (${Math.round((Math.max(0, sel[0].hp) / sel[0].maxHp) * 100)} %)`;
    const hp = $('sel-hp');
    if (!hp || sel[0].kind === 'point') return;
    const first = sel[0];
    const bar = $('sel-hpbar');
    if (first.kind === 'bld' && !first.built) {
      bar.classList.add('build');
      hp.style.width = (first.progress * 100).toFixed(1) + '%';
      $('sel-hptext').textContent = `Construyendo… ${Math.floor(first.progress * 100)}%`;
    } else {
      bar.classList.remove('build');
      let cur = 0;
      let max = 0;
      for (const e of sel) {
        cur += Math.max(0, e.hp);
        max += e.maxHp;
      }
      const k = max ? cur / max : 0;
      hp.style.width = (k * 100).toFixed(1) + '%';
      hp.style.background = k > 0.55 ? 'var(--good)' : k > 0.28 ? '#f2c94c' : 'var(--bad)';
      $('sel-hptext').textContent = sel.length > 1 && first.kind === 'unit'
        ? L$`Vida del grupo · ${Math.round(k * 100)} % (${fmt(cur)} / ${fmt(max)})` : `${fmt(cur)} / ${fmt(max)}`;
    }
    // v1.7: orden actual y plazas reservadas, en vivo.
    const ord = $('sel-order');
    if (ord && first.kind === 'unit') {
      const t = this.orderText(sel);
      if (ord.dataset.t !== t) {
        ord.dataset.t = t;
        ord.innerHTML = `${L$`Orden actual:`} <b>${esc(t)}</b>`;
      }
    }
    const qres = $('sel-qres');
    if (qres && first.kind === 'bld') {
      const t = this.queueResText(first);
      if (qres.textContent !== t) qres.textContent = t;
    }
    // v1.6: el motivo de cada tarjeta de tropa se actualiza con las monedas, la energía y la comunidad.
    if (first.kind === 'bld' && first.owner === 0) {
      const pl = this.app.game.players[0];
      document.querySelectorAll('#selpanel .card[data-type]').forEach((c) => {
        const w = c.querySelector('.why');
        const t = this.trainWhy(pl, UNITS[c.dataset.type]);
        if (w && w.textContent !== t) w.textContent = t;
      });
    }
    if (first.kind === 'bld' && first.queue.length) {
      const q = first.queue[0];
      const bar0 = document.querySelector('#sel-queue .qitem i');
      if (bar0) bar0.style.width = Math.min(100, (q.t / UNITS[q.type].build) * 100) + '%';
      const qt = $('sel-qtime');
      if (qt) qt.textContent = this.queueTimeText(first);
    }
  }

  onSelClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const app = this.app;
    const g = app.game;
    const sel = app.selection.filter((x) => x.alive);
    const act = btn.dataset.act;
    if (act === 'train' && this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    app.sound.play('click');
    if (act === 'seldetails') {
      // v1.3: las partes largas del panel se pliegan; este botón las muestra u oculta.
      this.selMore = !this.selMore;
      this.renderSel(true);
      return;
    }
    if (act === 'close') {
      app.setSelection([]);
      return;
    }
    if (!sel.length) return;
    const b = sel[0];
    if (act === 'train') {
      const err = g.enqueue(b, btn.dataset.type);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      }
      this.renderSel(true);
    } else if (act === 'seltype') {
      const keep = this.app.selection.filter((e) => e.kind === 'unit' && e.type === btn.dataset.type);
      if (keep.length) this.app.setSelection(keep);
    } else if (act === 'cancel') {
      g.cancelQueue(b, Number(btn.dataset.idx));
      this.renderSel(true);
    } else if (act === 'rally') {
      app.input.startPlacement({ kind: 'rally', building: b });
    } else if (act === 'demolish') {
      this.demolishSelected();
    } else if (act === 'found') {
      const u = sel.find((x) => x.def.founds);
      if (u) {
        app.setSelection([u]);
        app.input.startPlacement({ kind: 'found', unit: u });
      }
    } else if (act === 'upgrade') {
      const res = g.upgrade(b);
      if (typeof res === 'string') {
        this.toast(res, 'bad');
        app.sound.play('error');
      } else {
        app.setSelection([res]);
        this.toast(L$`Mejora de ${res.def.name} pagada: un constructor la hará`, 'good');
      }
    } else if (act === 'upall') {
      const res = g.upgradeAll(0);
      if (typeof res === 'string') {
        this.toast(res, 'bad');
        app.sound.play('error');
      } else if (!res.n) {
        this.toast(T$('No alcanza el dinero para ninguna mejora'), 'bad');
        app.sound.play('error');
      } else {
        this.toast(L$`Mejorando ${res.n} ${res.n === 1 ? T$('edificio') : T$('edificios')} (−${fmt(res.spent)}): tus constructores van a cada obra`, 'good');
      }
      this.renderSel(true);
    } else if (act === 'autoup') {
      const pl = g.players[0];
      pl.autoUpgrade = !pl.autoUpgrade;
      this.toast(pl.autoUpgrade ? T$('Mejoras automáticas encendidas: se mejora solo hasta el máximo') : T$('Mejoras automáticas apagadas'), pl.autoUpgrade ? 'good' : 'info');
      this.renderSel(true);
    } else if (act === 'dome') {
      const err = g.buyDome(0);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else {
        this.toast(L$`Cúpula nivel ${g.players[0].dome.level}`, 'good');
      }
      this.renderSel(true);
    } else if (act === 'unload') {
      const res = g.unload(b);
      if (typeof res === 'string') {
        this.toast(res, 'bad');
        app.sound.play('error');
      } else {
        app.setSelection(res);
      }
    } else if (act === 'research') {
      const err = g.startResearch(b, btn.dataset.v);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else this.toast(L$`Investigando: ${RESEARCH[btn.dataset.v].name}`, 'good');
      this.renderSel(true);
    } else if (act === 'gate') {
      g.toggleGate(b);
      app.sound.play('click');
      this.renderSel(true);
    } else if (act === 'silo') {
      const err = g.siloInvalid(b);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else app.input.startPlacement({ kind: 'silo', building: b });
    } else if (act === 'laybridge' || act === 'laymine') {
      const u = sel.find((x) => x.kind === 'unit' && (act === 'laybridge' ? x.def.layBridge : x.def.layMine));
      const res = act === 'laybridge' ? g.layBridge(u) : g.layMine(u);
      if (typeof res === 'string') {
        this.toast(res, 'bad');
        app.sound.play('error');
      } else this.toast(act === 'laybridge' ? T$('Tendiendo el puente…') : T$('Mina sembrada (solo tú la ves)'), 'good');
      this.renderSel(true);
    } else if (act === 'stop') {
      g.orderStop(sel.filter((x) => x.kind === 'unit'));
    } else if (act === 'center') {
      const us = sel.filter((x) => x.kind === 'unit');
      if (us.length) app.focusAt(us.reduce((s, x) => s + x.x, 0) / us.length, us.reduce((s, x) => s + x.z, 0) / us.length);
    } else if (act === 'mnuke') {
      const err = g.mobileNukeInvalid(b);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else {
        app.input.startPlacement({ kind: 'mnuke', unit: b });
      }
    } else if (act === 'nuke') {
      const err = g.nukeInvalid(b);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else {
        app.input.startPlacement({ kind: 'nuke', building: b });
      }
    } else if (act === 'bombzone') {
      const bombers = sel.filter((x) => x.kind === 'unit' && x.type === 'bomber');
      if (bombers.length) app.input.startPlacement({ kind: 'bombzone', units: bombers });
    } else if (act === 'nuke3') {
      const err = g.salvoInvalid(0);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else {
        app.input.startPlacement({ kind: 'nuke3', building: b });
      }
    } else if (act === 'repeat') {
      const n = Number(btn.dataset.n) || 1;
      let added = 0;
      let err = null;
      for (let k = 0; k < n; k++) {
        err = g.enqueue(b, b.lastType);
        if (err) break;
        added++;
      }
      if (!added) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else if (added < n) {
        this.toast(L$`${added} en cola · ${err}`, 'bad');
      }
      this.renderSel(true);
    } else if (act === 'amove') {
      if (app.input.amoveArm === true) app.input.disarmAttackMove();
      else app.input.armAttackMove();
      this.renderSel(true);
    } else if (act === 'patrol') {
      const us = sel.filter((x) => x.kind === 'unit' && x.def.weapon);
      if (app.input.amoveArm === 'patrol') app.input.disarmAttackMove();
      else if (us.some((u) => u.patrol)) { g.orderStop(us); this.toast(T$('Dejaron de patrullar')); }
      else app.input.armAttackMove('patrol');
      this.renderSel(true);
    } else if (act === 'hold') {
      const us = sel.filter((x) => x.kind === 'unit' && x.def.weapon);
      const on = !us.every((u) => u.hold);
      g.setHold(us, on);
      this.toast(on ? T$('Mantienen la posición: solo disparan a lo que tienen a tiro') : T$('Vuelven a perseguir a los enemigos cercanos'));
      this.renderSel(true);
    } else if (act === 'autorep') {
      const p = g.players[0];
      p.autoRepair = p.autoRepair === false;
      this.toast(p.autoRepair ? T$('Los constructores libres repararán solos') : T$('Reparación sola apagada'));
      this.renderSel(true);
    } else if (act === 'loop') {
      b.loop = !b.loop;
      b.loopT = 0;
      if (b.loop) this.toast(L$`${b.def.name}: sigue entrenando ${UNITS[b.lastType].name} mientras alcance el dinero`, 'good');
      this.renderSel(true);
    } else if (act === 'formation') {
      app.toggleFormation();
      this.renderSel(true);
    } else if (act === 'savegrp') {
      app.saveGroup(Number(btn.dataset.v));
    }
  }

  // ---------- v0.8: barra de producción ----------
  // Tus edificios que entrenan, con su cola y su progreso. Los parados (sin cola) en amarillo.
  renderProd() {
    const app = this.app;
    const g = app.game;
    const el = $('prodbar');
    if (!g) return;
    const order = { core: 0, barracks: 1, factory: 2, harbor: 3, helipad: 4 };
    const list = g.buildings.filter((b) => b.alive && b.owner === 0 && b.built && b.def.produces)
      .sort((a, b) => order[a.type] - order[b.type] || a.id - b.id);
    const sig = list.map((b) => `${b.id}:${b.queue.length}:${b.queue[0] ? b.queue[0].type : ''}`).join(',');
    el.hidden = list.length < 2;
    document.body.classList.toggle('has-prod', !el.hidden);
    if (el.hidden) return;
    if (sig !== this.prodSig) {
      this.prodSig = sig;
      el.innerHTML = `<span class="lbl">${L$`Producción`}</span>` + list.map((b) => {
        const idle = !b.queue.length && b.type !== 'core';
        const q = b.queue[0];
        const tip = `${b.def.name}: ${q ? `entrenando ${UNITS[q.type].name}${b.queue.length > 1 ? ` (+${b.queue.length - 1})` : ''}` : 'parado'}`;
        return `<button class="pitem ${idle ? 'idle' : ''}" type="button" data-prod="${b.id}" title="${esc(tip)}" aria-label="${esc(tip)}">
          <img src="${Thumbs.get(q ? q.type : b.type, PLAYER_COLORS[0])}" alt="">${b.queue.length ? `<em>${b.queue.length}</em>` : ''}<i><s data-pbar="${b.id}"></s></i></button>`;
      }).join('');
    }
    for (const b of list) {
      const bar = el.querySelector(`[data-pbar="${b.id}"]`);
      const q = b.queue[0];
      if (bar) bar.style.width = q ? Math.min(100, (q.t / UNITS[q.type].build) * 100) + '%' : '0';
    }
  }

  // ---------- v0.8: avisos en el borde ----------
  // Si atacan algo tuyo fuera de la pantalla, una flecha en el borde apunta hacia allá.
  addEdgeAlert(text, x, z) {
    const now = performance.now();
    let label = text.replace(/^Atacan tu /, '').replace(/^Perdiste: /, T$('Perdiste ')).replace(/^Perdiste /, T$('Perdiste '));
    if (/Núcleo/.test(text)) label = T$('Núcleo');
    else if (/tropas/i.test(text)) label = T$('Tropas');
    if (label.length > 18) label = label.slice(0, 17) + '…';
    const near = this.edgeAlerts.find((a) => Math.hypot(a.x - x, a.z - z) < 5);
    if (near) {
      near.until = now + 8000;
      near.label = label;
      near.x = x;
      near.z = z;
      if (near.el) near.el.querySelector('span').textContent = label;
      return;
    }
    this.edgeAlerts.push({ x, z, label, until: now + 8000, el: null });
    if (this.edgeAlerts.length > 4) {
      const old = this.edgeAlerts.shift();
      if (old.el) old.el.remove();
    }
  }

  updateEdges() {
    const r = this.app.renderer;
    if (!r) return;
    const now = performance.now();
    const box = $('edges');
    for (const a of this.edgeAlerts) {
      if (a.until > now) continue;
      if (a.el) a.el.remove();
      a.el = null;
    }
    this.edgeAlerts = this.edgeAlerts.filter((a) => a.until > now);
    const W = r.width;
    const H = r.height;
    const m = 34;
    for (const a of this.edgeAlerts) {
      if (!a.el) {
        a.el = document.createElement('button');
        a.el.type = 'button';
        a.el.className = 'edge';
        a.el.innerHTML = `<i>${ICON.arrow}</i><span></span>`;
        a.el.querySelector('span').textContent = a.label;
        a.el.addEventListener('click', () => {
          this.app.focusAt(a.x, a.z);
          a.until = 0;
        });
        box.appendChild(a.el);
      }
      const s = r.project(a.x, 0.3, a.z);
      const inside = s.ok && s.x > m && s.x < W - m && s.y > 70 && s.y < H - m;
      a.el.hidden = inside;
      if (inside) continue;
      let dx = s.x - W / 2;
      let dy = s.y - H / 2;
      if (!s.ok) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const hw = W / 2 - m - 40;
      const hh = H / 2 - m - 40;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const t = Math.min(Math.abs(c) > 1e-6 ? hw / Math.abs(c) : 1e9, Math.abs(sn) > 1e-6 ? hh / Math.abs(sn) : 1e9);
      a.el.style.transform = `translate(${Math.round(W / 2 + c * t)}px, ${Math.round(H / 2 + sn * t)}px) translate(-50%, -50%)`;
      a.el.querySelector('i').style.transform = `rotate(${ang}rad)`;
    }
  }

  // Botones de grupo y de Constructores junto al minimapa: cuántas tropas tiene cada uno.
  renderGroups(force) {
    const app = this.app;
    const g = app.game;
    if (!g) return;
    const counts = [1, 2, 3].map((n) => app.groupUnits(n).length);
    const builders = g.units.filter((u) => u.owner === 0 && u.alive && u.def.builds === 'land');
    const idle = builders.filter((u) => u.state === 'idle' && !u.inside).length;
    const sig = counts.join(',') + '|' + idle + '/' + builders.length;
    if (!force && sig === this.groupsSig) return;
    this.groupsSig = sig;
    counts.forEach((k, i) => {
      const el = $('grp' + (i + 1));
      el.textContent = k ? String(k) : '—';
      el.parentElement.classList.toggle('has', k > 0);
    });
    $('bld-idle').textContent = builders.length ? `${idle}/${builders.length}` : '0';
    $('btn-builders').classList.toggle('alert', idle > 0);
  }

  demolishSelected() {
    const app = this.app;
    const b = app.selection[0];
    if (!b || b.kind !== 'bld' || b.owner !== 0 || b.type === 'core') return;
    if (this.demolishArm === b.id) {
      app.game.demolish(b);
      this.demolishArm = -1;
      app.setSelection([]);
      this.toast(`${b.def.name} ${b.def.fem ? 'demolida' : 'demolido'}`);
      return;
    }
    this.demolishArm = b.id;
    this.renderSel(true);
    setTimeout(() => {
      if (this.demolishArm === b.id) {
        this.demolishArm = -1;
        this.renderSel(true);
      }
    }, 3000);
  }

  // ---------- barra superior ----------
  updateTop() {
    const g = this.app.game;
    const p = g.players[0];
    $('coins').textContent = fmt(p.coins);
    $('income').textContent = `+${fmt(p.income)}/min`;
    $('income2').textContent = `+${fmt(p.income)}/min`;
    $('pop').textContent = `${p.popUsed}/${p.popCap}`;
    $('energy').textContent = fmt(p.energy);
    $('energyRate').textContent = `+${p.energyRate}/10 s`;
    if (g.mode.king) {
      const faro = g.points.find((pt) => pt.type === 'faro');
      const ownerTeam = faro && faro.owner >= 0 ? g.players[faro.owner].team : -1;
      const myT = g.kingTime[p.team] || 0;
      let best = -1;
      let bestT = 0;
      for (const [team, t] of Object.entries(g.kingTime)) {
        if (Number(team) !== p.team && t > bestT) { bestT = t; best = Number(team); }
      }
      const rival = best >= 0 ? g.players.findIndex((pl) => pl.team === best) : -1;
      const bar = (t, color) => `<span class="bar"><i style="width:${Math.min(100, (t / KING_TIME) * 100)}%;background:${color}"></i></span>`;
      $('king').innerHTML = L$`Faro: ${ownerTeam < 0 ? T$('libre') : esc(g.players[faro.owner].name)} · Tú ${bar(myT, hexColor(PLAYER_COLORS[0]))}` +
        (rival >= 0 ? ` ${esc(g.players[rival].name)} ${bar(bestT, hexColor(PLAYER_COLORS[rival]))}` : '');
    }
    $('stat-pop').classList.toggle('full', p.popUsed >= p.popCap);
    $('clock').textContent = fmtTime(g.time);
    // v1.3: también cambia con las alianzas (equipos), no solo cuando alguien cae.
    const sig = g.players.map((pl) => `${pl.alive}:${pl.team}`).join(',');
    if (sig !== this.playersSig) {
      this.playersSig = sig;
      const myTeam = p.team;
      $('players').innerHTML = g.players.map((pl) => {
        const tag = pl.id === 0 ? '' : pl.team === myTeam ? '<em>aliado</em>' : '';
        const style = pl.human ? '' : ` · ${PERSONALITIES[pl.persona].name}`;
        return `<div class="pchip ${pl.alive ? '' : 'dead'}" title="${esc(pl.name + style)}"><i style="background:${hexColor(pl.color)}"></i><span>${esc(pl.name)}</span>${tag}</div>`;
      }).join('');
    }
  }

  update(dt) {
    this.slowT -= dt;
    if (this.slowT > 0) return;
    this.slowT = 0.15;
    this.updateCoach();
    this.updateTop();
    this.refreshBuild();
    this.renderSel();
    this.renderMission();
    this.renderGroups();
    this.renderProd();
    this.popT = (this.popT || 0) - 0.15;
    if (this.pop && this.popT <= 0) {
      this.popT = 0.5;
      this.renderPop();
    }
  }

  markLang() {
    document.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('gold', b.dataset.lang === I18N.lang));
    const n = $('lang-note');
    if (n) n.textContent = I18N.chosen ? T$('Elegido por ti.') : T$('Automático: el idioma de tu navegador o de Poki.');
  }

  showEnd() {
    const g = this.app.game;
    const win = g.result === 'victory';
    $('enddialog').className = 'dialog panel wide ' + (win ? 'result-victory' : 'result-defeat');
    $('enddialog').innerHTML = this.app.lobby.endHtml(g);
    this.closeStrategic();
    $('end').hidden = false;
    $('btn-again').addEventListener('click', () => this.app.startGame());
    const next = $('btn-next');
    if (next) next.addEventListener('click', () => this.app.startMission(Number(next.dataset.v)));
    $('btn-menu').addEventListener('click', () => this.app.toMenu());
    $('btn-watch').addEventListener('click', () => { $('end').hidden = true; });
    const spec = $('btn-spectate');
    if (spec) spec.addEventListener('click', () => this.app.spectate());
    const dbl = $('btn-double');
    if (dbl) dbl.addEventListener('click', () => this.app.lobby.doubleReward(g, dbl));
    this.bindHistory(g);
  }

  // Gráficas del final: línea vertical y valores del momento al pasar el dedo o el ratón.
  bindHistory(g) {
    const H = g.history || [];
    document.querySelectorAll('#enddialog .histchart').forEach((fig) => {
      const key = fig.dataset.key;
      const svg = fig.querySelector('svg');
      const tip = fig.querySelector('.histtip');
      const cross = fig.querySelector('.hcross');
      const vb = svg.viewBox.baseVal;
      const L = 40;
      const R = 64;
      const tMax = Math.max(H[H.length - 1].t, 1);
      const show = (ev) => {
        const r = svg.getBoundingClientRect();
        const sx = ((ev.clientX - r.left) / r.width) * vb.width;
        const t = clamp((sx - L) / (vb.width - L - R), 0, 1) * tMax;
        let best = H[0];
        for (const h of H) if (Math.abs(h.t - t) < Math.abs(best.t - t)) best = h;
        const cx = L + (best.t / tMax) * (vb.width - L - R);
        cross.setAttribute('x1', cx);
        cross.setAttribute('x2', cx);
        cross.setAttribute('visibility', 'visible');
        const rows = g.players.map((p) => ({ p, v: best[key][p.id] })).sort((a, b) => b.v - a.v);
        tip.innerHTML = `<b>${fmtTime(best.t)}</b>` + rows.map((x) => `<span><i style="background:${cssColor(x.p.color)}"></i>${esc(x.p.name)}<em>${fmt(x.v)}</em></span>`).join('');
        tip.hidden = false;
        const px = (cx / vb.width) * r.width;
        tip.style.left = `${Math.min(r.width - 150, Math.max(0, px + 10))}px`;
      };
      const hide = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); };
      svg.addEventListener('pointermove', show);
      svg.addEventListener('pointerdown', show);
      svg.addEventListener('pointerleave', hide);
    });
  }
}

// Sonido sintetizado con Web Audio (sin archivos externos).
class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.last = {};
    try {
      this.on = localStorage.getItem('faro-sound') !== 'off';
    } catch (err) { /* sin almacenamiento */ }
  }

  // v1.9: durante un anuncio de Poki el sonido (efectos y música, que usan el mismo contexto) queda en pausa.
  hold(on) {
    this.held = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
  }

  unlock() {
    if (this.held) return;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          const len = this.ctx.sampleRate;
          this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          this.master = this.ctx.createGain();
          this.master.gain.value = 0.6;
          this.master.connect(this.ctx.destination);
        }
      } catch (err) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.ctx && !this.unlocked) {
      this.unlocked = true;
      if (this.onUnlock && this.on) this.onUnlock();
    }
  }

  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem('faro-sound', this.on ? 'on' : 'off');
    } catch (err) { /* sin almacenamiento */ }
    if (this.on) this.unlock();
    if (this.onToggle) this.onToggle();
  }

  // Límite de voces: si ya suenan muchas, los sonidos nuevos menos importantes se saltan.
  voice(dur) {
    const now = this.ctx.currentTime;
    this.ends = (this.ends || []).filter((t) => t > now);
    if (this.ends.length >= 24) return false;
    this.ends.push(now + dur);
    this.voices = (this.voices || 0) + 1;
    return true;
  }

  tone(freq, dur, type = 'sine', vol = 0.08, slide = 0, delay = 0) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Ruido filtrado; sweep cambia la frecuencia del filtro durante el sonido (zumbido de misil).
  burst(dur, filterType, freq, vol, delay = 0, sweep = 0, q = 0.8) {
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, t0);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  play(name, vol = 1) {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const gap = { bullet: 0.07, minigun: 0.05, flak: 0.08, bolt: 0.12, laser: 0.14, hit: 0.08, boom: 0.09, bigboom: 0.25,
      rocket: 0.1, missile: 0.2, shell: 0.12, torpedo: 0.2, build: 0.22, heal: 0.4 }[name] || 0.04;
    if (this.last[name] && now - this.last[name] < gap) return;
    const ui = ['click', 'order', 'place', 'done', 'ready', 'error', 'alarm', 'capture'].includes(name);
    if (!ui && !this.voice(0.4)) return;
    this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'bullet': this.burst(0.06, 'highpass', 2400, 0.06 * v); this.tone(180, 0.04, 'square', 0.02 * v, -80); break;
      case 'minigun':
        for (let i = 0; i < 4; i++) this.burst(0.03, 'bandpass', 2600 + i * 120, 0.045 * v, i * 0.028, 0, 2);
        break;
      case 'flak': this.burst(0.09, 'bandpass', 1400, 0.07 * v); this.tone(240, 0.08, 'triangle', 0.03 * v, -120); break;
      case 'bolt': this.tone(520, 0.12, 'sawtooth', 0.04 * v, -300); break;
      case 'laser':
        this.tone(1500, 0.16, 'sawtooth', 0.025 * v, -1100);
        this.tone(760, 0.18, 'square', 0.018 * v, -500);
        this.burst(0.1, 'highpass', 5000, 0.02 * v);
        break;
      case 'rocket': this.burst(0.22, 'bandpass', 700, 0.07 * v, 0, 900, 1.2); this.tone(130, 0.12, 'sine', 0.05 * v, -50); break;
      case 'missile': this.burst(0.5, 'bandpass', 500, 0.07 * v, 0, 1400, 1.5); this.tone(90, 0.25, 'sine', 0.06 * v, -40); break;
      case 'shell':
        this.tone(110, 0.22, 'sine', 0.15 * v, -70);
        this.burst(0.1, 'lowpass', 1100, 0.07 * v);
        this.burst(0.35, 'lowpass', 300, 0.04 * v, 0.05);
        break;
      case 'torpedo': this.burst(0.35, 'lowpass', 420, 0.06 * v, 0, -200); break;
      case 'hit': this.burst(0.08, 'bandpass', 600, 0.05 * v); break;
      case 'boom':
        this.burst(0.55, 'lowpass', 520, 0.24 * v);
        this.tone(70, 0.4, 'sine', 0.12 * v, -40);
        this.burst(0.25, 'bandpass', 1800, 0.03 * v, 0.08, 0, 1.5);
        break;
      case 'bigboom':
        this.burst(1.1, 'lowpass', 380, 0.3 * v);
        this.tone(52, 0.9, 'sine', 0.18 * v, -22);
        this.burst(0.6, 'bandpass', 1500, 0.04 * v, 0.12, -900, 1.2);
        this.burst(0.4, 'lowpass', 900, 0.08 * v, 0.3);
        break;
      case 'build': this.tone(900 + Math.random() * 140, 0.05, 'triangle', 0.035 * v, -300); this.burst(0.04, 'highpass', 3000, 0.02 * v); break;
      case 'heal': this.tone(660, 0.2, 'sine', 0.025 * v); this.tone(990, 0.25, 'sine', 0.02 * v, 0, 0.08); break;
      case 'capture':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.05, 0, i * 0.09));
        break;
      case 'click': this.tone(880, 0.04, 'triangle', 0.04); break;
      case 'order': this.tone(520, 0.08, 'triangle', 0.05, 180); break;
      case 'place': this.tone(300, 0.12, 'triangle', 0.07, 140); this.burst(0.06, 'lowpass', 900, 0.04); break;
      case 'done': this.tone(660, 0.12, 'triangle', 0.06); this.tone(990, 0.16, 'triangle', 0.06, 0, 0.1); break;
      case 'ready': this.tone(740, 0.08, 'triangle', 0.045); break;
      case 'error': this.tone(200, 0.14, 'square', 0.04, -40); break;
      case 'alarm': this.tone(560, 0.15, 'square', 0.04); this.tone(420, 0.15, 'square', 0.04, 0, 0.18); break;
      default: break;
    }
  }
}
