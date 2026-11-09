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
  upgrade: '<path d="M12 19V6M6 11l6-6 6 6"/><path d="M6 20h12"/>',
  demolish: '<path d="M5 5l14 14M19 5 5 19"/>',
  rally: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5"/>',
  group: '<path d="M7 3h10v18l-5-4-5 4z"/>',
  unload: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  found: '<path d="M6 21V4h10l-2 3.5L16 11H6M18 15v6M15 18h6"/>',
  dome: '<path d="M3 18a9 9 0 0 1 18 0zM2 18h20"/>',
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
      <small class="lbl">Campaña · Misión ${m.id} de ${CAMPAIGN.length}</small>
      <h2 id="brief-title">${esc(m.name)}</h2>
      <p class="story">${esc(m.story)}</p>
      <div class="brief-grid">
        <div><h3 class="lbl">Meta</h3><p><b>${esc(Campaign.goalText(m))}</b></p></div>
        <div><h3 class="lbl">Estrellas</h3><ul class="starlist"><li><b>★ Termina la misión</b></li>
          ${m.stars.map((s) => `<li><b>★ ${esc(Campaign.starText(s))}</b></li>`).join('')}</ul></div>
      </div>
      <p class="tip"><b>Consejo:</b> ${esc(m.tip)}</p>
      <div class="row"><button class="btn gold" type="button" id="btn-brief-go">¡A jugar!</button>
        <button class="btn" type="button" id="btn-brief-menu">Vestíbulo</button></div>
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
      `<li class="star ${s.live ? '' : 'lost'}"><span>${esc(s.text)}<small>${esc(s.live ? s.now : 'ya no se puede')}</small></span></li>`);
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
      $('btn-obj').textContent = el.classList.contains('collapsed') ? 'Mostrar' : 'Ocultar';
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
      $('btn-mini').setAttribute('aria-label', w.classList.contains('min') ? 'Mostrar minimapa' : 'Plegar minimapa');
    });
    $('btn-home').addEventListener('click', () => app.focusCore());
    $('btn-box').addEventListener('click', () => {
      app.input.boxMode = !app.input.boxMode;
      $('btn-box').classList.toggle('on', app.input.boxMode);
      if (app.input.boxMode) this.toast('Arrastra para seleccionar varias tropas');
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
        this.toast(`Límite alcanzado (${def.limit})`, 'bad');
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

  updateMusicBtns() {
    const lv = this.app.music.level;
    document.querySelectorAll('[data-music]').forEach((b) => b.classList.toggle('gold', Number(b.dataset.music) === lv));
    const lb = $('btn-music-lobby');
    lb.classList.toggle('off', lv === 0);
    lb.setAttribute('aria-pressed', String(lv > 0));
    lb.title = lv > 0 ? 'Música: sí (toca para apagarla)' : 'Música: no (toca para encenderla)';
  }

  updateSoundBtn() {
    $('btn-sound2').textContent = this.app.sound.on ? 'Sonido: sí' : 'Sonido: no';
    $('btn-sound').innerHTML = this.app.sound.on ? ICON.soundOn : ICON.soundOff;
    $('btn-sound').setAttribute('aria-label', this.app.sound.on ? 'Silenciar' : 'Activar sonido');
  }

  startHud() {
    this.selSig = '';
    this.buildSig = '';
    this.playersSig = '';
    $('toasts').innerHTML = '';
    $('objectives').hidden = false;
    const camp = this.app.game.camp;
    // En pantallas chicas el panel de la misión empieza plegado (se abre con «Mostrar»).
    const small = window.innerWidth <= 860 || window.innerHeight <= 520;
    $('objectives').classList.toggle('collapsed', !!camp && small);
    $('btn-obj').textContent = camp && small ? 'Mostrar' : 'Ocultar';
    $('leftcol').classList.toggle('camp', !!camp);
    document.body.classList.toggle('camp-on', !!camp);
    $('objtitle').textContent = camp ? Campaign.mode(camp.id).name : 'Primeros pasos';
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
    const name = b.def.levelNames ? b.def.levelNames[level] : `${b.def.name} · nivel ${level}`;
    el.innerHTML = `<b>${ICON_UP} ${esc(name)}: qué mejoró</b><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
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
      b.textContent = 'Ver';
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
        b.textContent = 'Ver';
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
      { k: 'army', label: 'Tierra', n: count((u) => u.def.weapon && u.mover === 'land') },
      { k: 'sea', label: 'Mar', n: count((u) => u.def.weapon && u.mover === 'sea') },
      { k: 'air', label: 'Aire', n: count((u) => u.def.weapon && u.mover === 'air') },
      { k: 'all', label: 'Todo', n: count((u) => u.def.weapon) },
      { k: 'builders', label: 'Constructores', n: count((u) => u.def.builds) },
      { k: 'g1', label: 'Grupo 1', n: (app.groups[1] || []).filter((u) => u.alive).length },
      { k: 'g2', label: 'Grupo 2', n: (app.groups[2] || []).filter((u) => u.alive).length },
      { k: 'g3', label: 'Grupo 3', n: (app.groups[3] || []).filter((u) => u.alive).length },
    ];
    const R = 92;
    const cx = clamp(x, R + 50, window.innerWidth - R - 50);
    const cy = clamp(y, R + 40, window.innerHeight - R - 40);
    const el = document.createElement('div');
    el.id = 'wheel';
    el.setAttribute('role', 'menu');
    el.setAttribute('aria-label', 'Rueda de selección');
    el.innerHTML = `<div class="wheel-hub" style="left:${cx}px;top:${cy}px">Elegir</div>` + opts.map((o, i) => {
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
        this.toast(`¿Romper la alianza con ${g.players[pid].name}? Toca «Romper» otra vez`, 'bad');
        setTimeout(() => { if (this.breakArm === pid) this.breakArm = null; }, 4000);
        return;
      }
      this.breakArm = null;
      const err = g.breakAlliance(0);
      if (err) this.toast(err, 'bad');
      else {
        g.say(pid, 'Rompiste la alianza. Ahora somos rivales otra vez.', { force: true, toMe: true });
        this.toast(`Ya no eres aliado de ${g.players[pid].name}`, 'info');
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
      const who = m.mine ? 'Tú' : p.name + (m.ally ? ' (aliado)' : '');
      return `<p class="${m.mine ? 'mine' : ''}"><i style="background:${hexColor(p.color)}"></i><b>${esc(who)}:</b> ${esc(m.text)}<small>${fmtTime(m.time)}</small></p>`;
    }).join('') : `<p>${tab === 'ally' ? 'Todavía no hay mensajes de aliados.' : 'Todavía no hay mensajes.'}</p>`;
    const hasAllies = g.players.some((q) => q.id !== 0 && q.alive && !q.human && q.team === me.team) && me.alive;
    const quick = hasAllies ? `<div class="quickmsgs">${['¡Gracias!', '¡Bien hecho!', '¡Cuidado!'].map((t) => `<button class="btn mini" type="button" data-qmsg="${t}">${t}</button>`).join('')}
      <button class="btn mini gold" type="button" data-ally="help" data-pid="0">¡Ayuda!</button>
      <button class="btn mini gold" type="button" data-ally="attack" data-pid="0">¡Ataquemos!</button></div>`
      : '<p class="allyhint">Cuando tengas aliados, aquí puedes mandarles mensajes rápidos.</p>';
    return `<header><h4>Mensajes</h4><button class="btn icon" type="button" data-close aria-label="Cerrar">${ICON.close}</button></header>
      <div class="chattabs" role="tablist"><button class="btn mini" type="button" role="tab" data-chattab="all" aria-selected="${tab === 'all'}">Todos</button>
      <button class="btn mini" type="button" role="tab" data-chattab="ally" aria-selected="${tab === 'ally'}">Aliados</button></div>
      <div class="chatlog" id="chatlog">${rows}</div>${quick}`;
  }

  quickMsg(text) {
    const g = this.app.game;
    if (!g) return;
    const n = g.playerSay(text);
    this.chatKey = null;
    this.renderPop();
    this.app.sound.play('click');
    if (!n) this.toast('No tienes aliados que te lean', 'bad');
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
      this.toast(n ? `Tus aliados mandan ${n} tropas a tu base` : 'Tus aliados no tienen tropas libres', n ? 'good' : 'bad');
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
    } else $('score').innerHTML = this.scoreHtml(g);
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
    let html = '<header><h4>Monedas por minuto</h4><button class="btn icon" type="button" data-close aria-label="Cerrar">' + ICON.close + '</button></header><table><tbody>';
    html += rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="n">+${fmt(v)}</td></tr>`).join('');
    if (bonus > 0) {
      html += `<tr><td>Subtotal</td><td class="n">${fmt(p.baseIncome)}</td></tr><tr><td>Faro (+${Math.round(p.bonus * 100)} %)</td><td class="n">+${fmt(bonus)}</td></tr>`;
    }
    html += `<tr class="total"><td>Total</td><td class="n" id="econ-total">+${fmt(p.income)}</td></tr></tbody></table>`;
    if (!groups.has('farm') && !groups.has('mine')) html += '<p class="hint-press" style="margin:0">Construye Granjas y Minas para ganar más.</p>';
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
    let html = '<header><h4>Energía</h4><button class="btn icon" type="button" data-close aria-label="Cerrar">' + ICON.close + '</button></header><table><tbody>';
    if (!groups.size) html += '<tr><td>Sin energías</td><td class="n">+0 / 10 s</td></tr>';
    for (const [type, k] of groups) html += `<tr><td>${esc(BUILDINGS[type].name)} ×${k.n}</td><td class="n">+${k.sum} / 10 s</td></tr>`;
    html += `<tr class="total"><td>Disponible</td><td class="n">${fmt(p.energy)}</td></tr></tbody></table>`;
    html += '<p class="hint-press" style="margin:0">La producen Solar, Eólica, Hidráulica, Mareomotriz y Undimotriz. La gastan vehículos, buques de guerra, helicópteros, la Fábrica y el Helipuerto.</p>';
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
        ? `<button class="btn mini danger" type="button" data-ally="break" data-pid="${p.id}">Romper</button>`
        : `<button class="btn mini" type="button" data-ally="ask" data-pid="${p.id}">Aliarse</button>`;
      return `<tr class="${p.alive ? '' : 'dead'}" data-pid="${p.id}"><td><i class="dot" style="background:${hexColor(p.color)}"></i>${esc(p.name)}</td>
        <td>${esc(role)}${rel}${allyBtn}</td><td class="n">${Math.round(((terr.get(p.id) || 0) / land) * 100)} %</td>
        <td class="n">${army}</td><td class="n">${blds}</td><td class="n">${p.alive ? '+' + fmt(p.income) : '—'}</td><td class="n">${pts}</td></tr>`;
    }).join('');
    const hasAllies = g.players.some((q) => q.id !== 0 && q.alive && !q.human && q.team === myTeam) && g.players[0].alive;
    const orders = hasAllies ? `<div class="allyorders"><span>A tus aliados:</span>
      <button class="btn mini gold" type="button" data-ally="help" data-pid="0" id="btn-ally-help">¡Ayuda!</button>
      <button class="btn mini gold" type="button" data-ally="attack" data-pid="0" id="btn-ally-attack">¡Ataquemos!</button></div>` : '';
    const hint = g.alliancesAllowed() ? '<p class="allyhint">Toca «Aliarse» para proponer una alianza: los aliados no se atacan y comparten lo que ven. Al final solo puede ganar uno.</p>' : '';
    return `<header><h4>Marcador · ${fmtTime(g.time)}</h4><span class="row" style="gap:6px"><button class="btn mini" type="button" data-openchat id="btn-open-chat">Mensajes</button><button class="btn icon" type="button" data-close aria-label="Cerrar">${ICON.close}</button></span></header>${orders}${hint}
      <div class="wrap"><table><thead><tr><th>Imperio</th><th>Estilo</th><th>Territorio</th><th>Ejército</th><th>Edificios</th><th>Monedas/min</th><th>Puntos</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  // ---------- Aviones y Aeropuerto (v1.0) ----------
  planeState(u) {
    if (u.repairing) return 'Vuelve a repararse';
    if (u.autoTarget && u.autoTarget.alive) return 'En combate';
    if (u.moving) return 'En vuelo';
    return 'Patrulla en círculo';
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
      const cells = [`<span>Estado</span><b>${esc(this.planeState(u))}</b>`, `<span>Vida</span><b>${hp} %</b>`];
      if (type === 'fighter') {
        cells.push(`<span>Misiles aire-aire</span><b>${w.dmg} · ×${w.mult.air} a aviones</b>`, `<span>Alcance</span><b>${w.range} casillas</b>`);
      } else {
        const cd = Math.max(0, u.cd || 0);
        const seen = g.time - (u.lastShot || -99) < 3;
        cells.push(`<span>Bombas</span><b class="${cd > 0.2 ? 'radar-track' : 'radar-idle'}">${cd > 0.2 ? `Recargando ${Math.ceil(cd)} s` : 'Listas'}</b>`,
          `<span>Furtivo</span><b class="${seen ? 'radar-lock' : ''}">${seen ? 'Visible (acaba de soltar bombas)' : 'Oculto: solo se ve a 3 casillas'}</b>`);
      }
      rows.push(`<div class="planecard"><img src="${Thumbs.get(type, PLAYER_COLORS[0])}" alt="">
        <div><div class="radar-status"><b>${esc(d.name)}</b>${list.length > 1 ? ` ×${list.length}` : ''}</div><div class="numbers">${cells.join('')}</div></div></div>`);
    }
    const tip = planes.some((u) => u.type === 'bomber')
      ? '«Bombardear zona»: toca un lugar y los Bombarderos van atacando los edificios que encuentren.'
      : 'Los Cazas buscan solos aviones y helicópteros enemigos; con poca vida vuelven al Aeropuerto o al Helipuerto.';
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
      : '<span class="queue">Ningún avión en la pista ahora.</span>';
    return `<div class="radar airport"><div class="radar-scope" aria-hidden="true"><i></i></div><div class="radar-body">
      <div class="radar-status">Torre de control · <b>${nF} ${nF === 1 ? 'Caza' : 'Cazas'} · ${nB} ${nB === 1 ? 'Bombardero' : 'Bombarderos'}</b></div>
      <div class="pads">${pads}</div>
      <div class="queue">Repara ${Math.round(heal.rate)} de vida por segundo a los aviones y helicópteros cercanos; los dañados vuelven solos aquí.</div></div></div>`;
  }

  // ---------- AIR DEFENSE y Torreta (v0.9): alcance, recarga, contra qué sirve y qué sigue el radar ----------
  radarHtml(b) {
    const g = this.app.game;
    const w = g.weaponOf(b);
    const air = (w.mult.air || 0) > 0;
    const rows = [`<span>Alcance</span><b>${w.range} casillas</b>`,
      `<span>Recarga</span><b>${w.cd.toLocaleString('es-ES')} s${w.salvo ? ` · ráfaga de ${w.salvo}` : ''}</b>`,
      `<span>${w.salvo ? 'Daño a aeronaves por ráfaga' : 'Daño a aeronaves por tiro'}</span><b>${air ? fmt(w.dmg * w.mult.air * (w.salvo || 1)) : 'no'}</b>`];
    if (b.type === 'aadef' || (b.def.aaLevel && b.level >= b.def.aaLevel)) rows.push('<span>Detecta furtivos</span><b>a 3 casillas</b>');
    const t = b.lockOn && b.lockOn.alive && g.inRange(b, w, b.lockOn) ? b.lockOn : b.autoTarget && b.autoTarget.alive ? b.autoTarget : null;
    let status = '<b class="radar-idle">Sin blancos</b>';
    if (t) {
      const name = t.kind === 'bld' ? t.def.name : UNITS[t.type].name;
      const locking = w.lock && b.lockOn === t && b.lockT > 0;
      status = `<b class="${locking ? 'radar-track' : 'radar-lock'}">${locking ? 'Siguiendo' : 'Fijado'}: ${esc(name)}</b>`;
    }
    return `<div class="radar"><div class="radar-scope" aria-hidden="true"><i></i></div>
      <div class="radar-body"><div class="radar-status">Radar · ${status}</div><div class="numbers">${rows.join('')}</div></div></div>`;
  }

  // ---------- ficha de unidad ----------
  statsHtml(type) {
    const u = UNITS[type];
    const w = u.weapon;
    const parts = [`<div class="title">${esc(u.name)}</div>`];
    parts.push(`<div><span>Vida</span> <b>${fmt(u.hp)}</b></div>`);
    if (w) {
      parts.push(`<div><span>Daño/s</span> <b>${fmt(w.dmg / w.cd)}</b></div>`);
      parts.push(`<div><span>Alcance</span> <b>${w.range}</b> casillas</div>`);
    }
    parts.push(`<div><span>Velocidad</span> <b>${u.speed.toLocaleString('es-ES')}</b></div>`);
    parts.push(`<div><span>Población</span> <b>${u.pop}</b>${u.energy ? ` · <span>Energía</span> <b>${u.energy}</b>` : ''}</div>`);
    if (w) {
      const cls = ['inf', 'veh', 'ship', 'sub', 'air', 'bld'];
      const strong = cls.filter((c) => (w.mult[c] || 0) >= 1.3).map((c) => CAT_NAMES[c]);
      const none = cls.filter((c) => !(w.mult[c] > 0)).map((c) => CAT_NAMES[c]);
      if (strong.length) parts.push(`<div class="wide">Fuerte contra: <b>${strong.join(', ')}</b></div>`);
      if (none.length) parts.push(`<div class="wide">No ataca a: <b>${none.join(', ')}</b></div>`);
    } else {
      parts.push(`<div class="wide">No combate. ${esc(u.desc)}</div>`);
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
    $('btn-place-cancel').textContent = isBuild && p.placed ? 'Terminar' : 'Cancelar';
    if (isBuild) {
      // v1.0: tocar una casilla muestra la obra; «Construir» la pone; «Terminar» sale.
      const d = BUILDINGS[p.btype];
      const price = `<span class="cost">${fmt(d.cost)}</span>${d.energyCost ? ` <span class="ecost">${ICON.bolt}${d.energyCost}</span>` : ''}`;
      const placed = p.placed ? ` · <b>${p.placed}</b> ${p.placed === 1 ? 'puesta' : 'puestas'}` : '';
      if (p.err && p.cell >= 0) text = `<b>${esc(d.name)}</b> · <span class="err">${esc(p.err)}</span>${placed}`;
      else if (p.cell >= 0) text = `<b>${esc(d.name)}</b> · ${price} · Toca «Construir» para poner la obra aquí${placed}`;
      else if (p.valid && p.valid.size) text = `<b>${esc(d.name)}</b> · ${price} · Toca una casilla dorada y luego «Construir»${placed}`;
      else text = `No quedan casillas para ${esc(d.name)} en tu territorio${placed}. ${esc(d.desc)}`;
      $('btn-place-ok').disabled = p.cell < 0 || !!p.err;
      $('btn-place-rot').disabled = false;
    } else if (p.kind === 'found') {
      text = p.valid && p.valid.size
        ? 'Toca dónde fundar el <b>Puesto avanzado</b> · <span class="cost">800</span> al llegar'
        : 'No hay sitio alcanzable para fundar un puesto';
    } else if (p.kind === 'rally') {
      text = 'Toca el <b>punto de reunión</b> para las tropas nuevas';
    } else if (p.kind === 'nuke') {
      text = `Toca el blanco del <b>misil nuclear</b> · <span class="cost">${fmt(NUKE.cost)}</span> · llega en ${NUKE.flight} s`;
    } else if (p.kind === 'allyattack') {
      text = 'Toca un edificio, una tropa o el territorio del <b>rival</b> que quieres atacar con tus aliados';
    } else if (p.kind === 'bombzone') {
      text = `Toca la <b>zona a bombardear</b>: ${p.units.length} ${p.units.length === 1 ? 'Bombardero va' : 'Bombarderos van'} atacando los edificios que encuentren`;
    } else if (p.kind === 'nuke3') {
      text = `Toca el blanco de los <b>3 misiles nucleares</b> · <span class="cost">${fmt(NUKE.cost * 3)}</span> · llegan en ${NUKE.flight} s`;
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
    $('blist').innerHTML = tab.items.map((k) => {
      const d = BUILDINGS[k];
      return `<button class="bitem" type="button" data-b="${k}">
        <img src="${Thumbs.get(k, PLAYER_COLORS[0])}" alt="">
        <div class="top"><b>${esc(d.name)}</b><span class="costs"><span class="cost">${fmt(d.cost)}</span>${d.energyCost ? `<span class="ecost">${ICON.bolt}${d.energyCost}</span>` : ''}</span></div>
        <div class="desc">${esc(d.desc)}<span data-count="${k}"></span></div>
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
      states.push([el, k, d, n, poor, maxed, act, poorE, limit]);
      sig += `${k}${n}${poor}${maxed}${act}${poorE}${limit}|`;
    });
    if (!force && sig === this.buildSig) return;
    this.buildSig = sig;
    for (const [el, k, d, n, poor, maxed, act, poorE, limit] of states) {
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
        `|${g.time - first.lastWork > 1.5}|${first.lastType || ''}`;
      if (first.def.produces) {
        sig += '|' + first.def.produces.map((t) => p.coins >= UNITS[t].cost && p.energy >= (UNITS[t].energy || 0)).join('');
      }
      const uc = g.upgradeCost(first);
      if (uc) sig += '|u' + (p.coins >= uc);
      if (first.type === 'airport') sig += '|p' + g.units.filter((u) => u.alive && u.owner === 0 && u.cls === 'air' && Math.hypot(u.x - first.x, u.z - first.z) < 4.5).map((u) => u.id + ':' + Math.floor((u.hp / u.maxHp) * 10)).join(',') + g.units.filter((u) => u.def.plane && u.owner === 0).length;
      if (first.type === 'aadef' || first.type === 'turret') sig += `|r${first.lockOn && first.lockOn.alive ? first.lockOn.id + (first.lockT > 0 ? 't' : 'l') : first.autoTarget && first.autoTarget.alive ? 'a' + first.autoTarget.id : '-'}`;
      if (first.type === 'aadef' || first.type === 'antinuke') sig += `|n${Math.ceil(Math.max(0, (first.nukeReadyAt || first.chargeAt || 0) - g.time))}${p.coins >= NUKE.cost}${first.type === 'aadef' && first.level >= 4 ? g.salvoInvalid(0) : ''}`;
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
        sel.map((u) => (u.cargo ? u.cargo.length : '')).join('') + `|${this.app.formation}|${this.app.input.amoveArm}`;
      // Aviones (v1.0): estado, bombas y si el bombardero está oculto.
      for (const u of sel) if (u.def.plane) sig += `|${this.planeState(u)}${u.type === 'bomber' ? Math.ceil(Math.max(0, u.cd || 0)) + (g.time - (u.lastShot || -99) < 3 ? 'v' : 'o') : ''}`;
    }
    if (force || sig !== this.selSig) {
      this.selSig = sig;
      panel.hidden = false;
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
      <div style="min-width:0"><h3>${title}</h3><p>${sub}</p>
        ${hpId ? '<div class="hp" id="sel-hpbar"><i id="sel-hp"></i></div><div class="hptext" id="sel-hptext"></div>' : ''}
      </div>
      <button class="btn icon" type="button" data-act="close" aria-label="Cerrar">${ICON.close}</button>
    </div>`;
  }

  buildingHtml(b) {
    const g = this.app.game;
    const own = b.owner === 0;
    const d = b.def;
    const extra = [];
    const inc = g.bIncome(b);
    if (inc) extra.push(`+${fmt(inc * g.incomeMult(g.players[b.owner]))} monedas/min`);
    if (g.bPop(b)) extra.push(`+${g.bPop(b)} de población`);
    if (d.energy) extra.push(`+${g.bEnergy(b)} energía cada 10 s`);
    if (d.healLevels) extra.push(`${d.healLevels[b.level].name}: cura ${Math.round(d.healLevels[b.level].pct * 100)} %/s`);
    if (d.minigun) extra.push(b.level > 1 ? `${b.level - 1} minigun${b.level > 2 ? 's' : ''}` : 'sin minigun');
    const sub = (own ? '' : `<b style="color:${hexColor(PLAYER_COLORS[b.owner])}">${esc(g.players[b.owner].name)}</b> · `) +
      esc(d.desc) + (extra.length ? ' · ' + extra.join(' · ') : '');
    const maxLv = d.maxLevel;
    const lv = maxLv > 1
      ? ` <span class="lvtag">Nivel ${b.level}</span><span class="levels" title="Nivel ${b.level} de ${maxLv}">${Array.from({ length: maxLv }, (_, i) => `<i class="${i < b.level ? 'on' : ''}"></i>`).join('')}</span>` : '';
    const mkey = GLB[b.type + '_' + b.level] ? b.type + '_' + b.level : b.type;
    let html = this.head(mkey, PLAYER_COLORS[b.owner], esc(d.levelNames ? d.levelNames[b.level] : d.name) + lv, sub);
    if (!own) return html + (g.isEnemy(b.owner, 0) ? this.counterHtml(b) : '');
    // Obra o mejora en curso.
    if (!b.built || b.upgrading) {
      const k = b.upgrading ? b.upgrading.progress : b.progress;
      const idle = g.time - b.lastWork > 1.5 && b.type !== 'outpost';
      const by = d.builtBy === 'sea' ? 'un Barco constructor' : d.builtBy === 'engineer' ? 'un Ingeniero' : 'un Constructor o Ingeniero';
      html += `<div class="queue"><b>${b.upgrading ? `Mejorando a nivel ${b.upgrading.level}` : 'En construcción'}</b> · ${Math.floor(k * 100)} % · ` +
        (idle ? `<span style="color:#ffb4b5">Sin constructor: selecciona ${by} y toca la obra.</span>` : 'Un constructor está trabajando.') + '</div>';
    }
    if (b.type === 'core') {
      const p = g.players[0];
      const dome = p.dome;
      // v0.9: el estado del Núcleo en casillas claras.
      const L = d.levels[b.level];
      const emer = p.emergencyUsed
        ? (b.shieldUntil > g.time ? ['Activo', 'gold'] : ['Usado', 'muted']) : ['Listo', 'good'];
      const tiles = [
        ['Monedas', `+${fmt(g.bIncome(b) * g.incomeMult(p))}/min`, ''],
        ['Comunidad', `+${g.bPop(b)}`, ''],
        ['Láser', `${L.laser.beams > 1 ? '2 × ' : ''}${L.laser.dmg} · ${L.laser.range} cas.`, ''],
        ['Emergencia', emer[0], emer[1]],
        ['Cúpula', dome ? (dome.hp > 0 ? `Nivel ${dome.level} · ${Math.round((dome.hp / dome.maxHp) * 100)} %`
          : `Rota · ${Math.max(0, Math.ceil(DOME.recover - (g.time - dome.brokenAt)))} s`) : (b.level < 3 ? 'Núcleo nivel 3' : 'Disponible'),
        dome ? (dome.hp > 0 ? 'good' : 'bad') : 'muted'],
      ];
      html += `<div class="coretiles">${tiles.map(([k, v, c]) => `<div class="ctile ${c}"><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
      if (dome && dome.level >= 3 && dome.hp > 0) html += '<div class="queue">La Cúpula nivel 3 da escudo a tus tropas mientras están dentro de ella.</div>';
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
          <button class="btn gold" type="button" data-act="upall" id="btn-upall" ${can ? '' : 'disabled'}>${bi('upgrade')}Mejorar todo · ${can} de ${cand.length}</button>
          <button class="btn ${auto ? 'good' : ''}" type="button" data-act="autoup" id="btn-autoup" aria-pressed="${auto}">${bi('repeat')}Mejoras automáticas: ${auto ? 'sí' : 'no'}</button></div>
          <span class="queue">${cand.length ? `Quedan ${cand.length} mejoras (${fmt(total)} en total). «Mejorar todo» pone a mejorar las que alcanza tu dinero; las automáticas siguen hasta el máximo y guardan ${fmt(AUTO_UP.reserve)} para tropas.` : 'Todo está al máximo.'}</span></div>`;
      }
      if (!dome || dome.level < 3) {
        const next = dome ? dome.level + 1 : 1;
        const label = dome ? `Mejorar Cúpula a nivel ${next}` : 'Comprar Cúpula';
        const why = b.level < 3 ? 'Necesita el Núcleo en nivel 3.' : next === 3 ? 'Nivel 3: escudo personal para todas tus tropas.'
          : `Absorbe el daño de barcos, aeronaves y Lanzamisiles a ${DOME_LEVELS[next].range} casillas del Núcleo.`;
        html += `<div class="actions"><button class="btn gold" type="button" data-act="dome" ${derr && b.level < 3 ? 'disabled' : ''}>${bi('dome')}${label} · ${fmt(g.domeCost(0))}</button>
          <span class="queue" style="flex:1 1 200px">${why}</span></div>`;
      }
    }
    if (d.produces && b.built) {
      const pl = g.players[0];
      html += '<div class="cards">' + d.produces.map((t) => {
        const u = UNITS[t];
        const poor = pl.coins < u.cost || pl.energy < (u.energy || 0);
        return `<button class="card ${poor ? 'poor' : ''}" type="button" data-act="train" data-type="${t}" title="${esc(u.desc)}">
          <img src="${Thumbs.get(t, PLAYER_COLORS[0])}" alt="">
          <b>${esc(u.name)}</b>
          <div class="meta"><span class="cost">${fmt(u.cost)}</span>${u.energy ? `<span class="ecost">${ICON.bolt}${u.energy}</span>` : ''}<span>${ICON.pop}${u.pop}</span></div>
        </button>`;
      }).join('') + '</div>';
      if (b.lastType && d.produces.includes(b.lastType)) {
        // Repetir (v0.7): vuelve a poner la última tropa entrenada, una o cinco veces.
        const lu = UNITS[b.lastType];
        html += `<div class="actions repeat"><span class="queue">Última: <b>${esc(lu.name)}</b></span>
          <button class="btn" type="button" data-act="repeat" data-n="1" id="btn-repeat">${bi('repeat')}Repetir · ${fmt(lu.cost)}</button>
          <button class="btn" type="button" data-act="repeat" data-n="5" id="btn-repeat5">${bi('repeat')}×5 · ${fmt(lu.cost * 5)}</button></div>`;
      }
      const info = this.cardInfoType && d.produces.includes(this.cardInfoType) ? this.statsHtml(this.cardInfoType) : '';
      html += `<div class="cardinfo" id="cardinfo" ${info ? '' : 'hidden'}>${info}</div>`;
      html += '<div class="queue" id="sel-queue">' + (b.queue.length
        ? 'En cola: ' + b.queue.map((q, i) => `<button class="qitem" type="button" data-act="cancel" data-idx="${i}" title="Cancelar ${esc(UNITS[q.type].name)}">
            <img src="${Thumbs.get(q.type, PLAYER_COLORS[0])}" alt=""><i style="width:0"></i></button>`).join('')
        : 'Toca una tropa para entrenarla; mantenla pulsada para ver su ficha. Toca la cola para cancelar.') + '</div>';
    }
    if (b.built && d.weapon && (b.type === 'aadef' || b.type === 'turret')) html += this.radarHtml(b);
    if (b.type === 'aadef' && b.built && b.level >= 4) {
      // Misil nuclear (v0.9): muy caro, recarga de 3 min.
      const why = g.nukeInvalid(b);
      const wait = g.time < (b.nukeReadyAt || 0);
      html += `<div class="actions nukebox"><button class="btn danger" type="button" data-act="nuke" id="btn-nuke" ${why ? 'disabled' : ''}>☢ Misil nuclear · ${fmt(NUKE.cost)}</button>
        <span class="queue" style="flex:1 1 200px">${wait ? `Recargando: ${Math.ceil(b.nukeReadyAt - g.time)} s` : why || `Listo. Daña todo en ${NUKE.radius} casillas y deja ${NUKE.rad.time} s de radiación; un Escudo antimisiles lo puede derribar.`}</span></div>`;
      // v1.0: los 3 a la vez (un Escudo antimisiles solo derriba uno por carga).
      const why3 = g.salvoInvalid(0);
      html += `<div class="actions nukebox"><button class="btn danger" type="button" data-act="nuke3" id="btn-nuke3" ${why3 ? 'disabled' : ''}>☢☢☢ Lanzar los 3 · ${fmt(NUKE.cost * 3)}</button>
        <span class="queue" style="flex:1 1 200px">${why3 || 'Tus 3 AIR DEFENSE de nivel 4 disparan juntos al mismo blanco: un Escudo antimisiles solo puede derribar uno.'}</span></div>`;
    } else if (b.type === 'aadef' && b.built) {
      html += `<div class="queue">Nivel 4 (solo 3 de tus AIR DEFENSE): lanza el misil nuclear.</div>`;
    }
    if (b.type === 'airport' && b.built) html += this.airportHtml(b);
    if (b.type === 'antinuke' && b.built) {
      const ready = g.time >= (b.chargeAt || 0);
      html += `<div class="queue">${ready ? '<b style="color:var(--good)">Carga lista</b>: derriba un misil nuclear que caiga a 7 casillas.' : `Recargando: ${Math.ceil(b.chargeAt - g.time)} s`}</div>`;
      html += `<div class="queue">Defensa de punto: derriba misiles y cohetes enemigos a ${b.def.pointDefense.range} casillas · derribados: <b>${b.pdKills || 0}</b></div>`;
    }
    const acts = [];
    if (own && b.built && !b.upgrading && b.level < maxLv) {
      // v0.9: antes de pagar, qué vas a ganar con la mejora.
      const prev = g.upgradePreview(b).map((t) => t.replace(/^Ahora es /, 'Pasa a ser '));
      if (prev.length) html += `<div class="nextup"><small>Al mejorar a ${d.levelNames ? esc(d.levelNames[b.level + 1]) : `nivel ${b.level + 1}`}</small>${prev.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
    }
    if (b.built && !b.upgrading && b.level < maxLv) {
      const nextName = d.levelNames ? d.levelNames[b.level + 1] : `nivel ${b.level + 1}`;
      acts.push(`<button class="btn gold" type="button" data-act="upgrade">${bi('upgrade')}Mejorar a ${nextName} · ${fmt(g.upgradeCost(b))}</button>`);
    }
    if (d.produces && b.built) acts.push(`<button class="btn" type="button" data-act="rally">${bi('rally')}${b.rally >= 0 ? 'Mover punto de reunión' : 'Punto de reunión'}</button>`);
    if (b.type !== 'core') {
      acts.push(`<button class="btn danger" type="button" data-act="demolish">${bi('demolish')}${this.demolishArm === b.id ? '¿Seguro? Toca otra vez' : 'Demoler'}</button>`);
    }
    if (acts.length) html += `<div class="actions">${acts.join('')}</div>`;
    return html;
  }

  unitsHtml(sel) {
    const counts = new Map();
    for (const u of sel) counts.set(u.type, (counts.get(u.type) || 0) + 1);
    const first = sel[0];
    const title = sel.length === 1 ? esc(first.def.name) : `${sel.length} tropas`;
    const sub = sel.length === 1 ? esc(first.def.desc) : 'Toca un destino para moverlas o un enemigo para atacarlo.';
    let html = this.head(first.type, PLAYER_COLORS[0], title, sub);
    if (counts.size > 1) {
      html += '<div class="chips">' + [...counts.entries()].map(([t, n]) =>
        `<span class="chip"><img src="${Thumbs.get(t, PLAYER_COLORS[0])}" alt="">${n}× ${esc(UNITS[t].name)}</span>`).join('') + '</div>';
    }
    const acts = [];
    // Transportes (Barcaza, Lancha, Jeep, Transporte blindado) y hangar del Portaaviones.
    const ship = sel.length === 1 && (first.def.capacity || first.def.hangar) ? first : null;
    if (ship) {
      const g = this.app.game;
      const hangar = !!ship.def.hangar;
      const cap = ship.def.capacity || ship.def.hangar;
      const how = hangar ? 'Selecciona Cazas y toca el Portaaviones para guardarlos.'
        : ship.def.carries === 'inf' ? `Selecciona soldados y toca el ${ship.def.name} para subirlos.`
          : `Selecciona tropas de tierra y toca la ${ship.def.name} para subirlas.`;
      html += `<div class="queue">${hangar ? 'Hangar' : 'Carga'}: ${g.cargoSlots(ship)}/${cap}` +
        (ship.cargo.length ? ' · ' + ship.cargo.map((u) => `<img class="qitem" style="cursor:default" src="${Thumbs.get(u.type, PLAYER_COLORS[0])}" alt="${esc(u.def.name)}">`).join('')
          : ' · ' + how) + '</div>';
      const label = hangar ? 'Lanzar Cazas' : ship.mover === 'sea' ? 'Desembarcar' : 'Bajar soldados';
      if (ship.cargo.length) acts.push(`<button class="btn gold" type="button" data-act="unload">${bi('unload')}${label}</button>`);
    }
    const planes = sel.filter((u) => u.def.plane);
    if (planes.length) {
      html += this.planeHtml(planes);
      if (planes.some((u) => u.type === 'bomber')) {
        acts.push(`<button class="btn gold" type="button" data-act="bombzone" id="btn-bombzone">${bi('amove')}Bombardear zona</button>`);
      }
    }
    if (sel.some((u) => u.def.builds)) {
      html += `<div class="queue">Construye solo las obras pendientes. Tócalo y luego una obra para mandarlo; toca un edificio dañado para repararlo.</div>`;
    }
    const founder = sel.find((u) => u.def.founds);
    if (founder) {
      acts.push(`<button class="btn gold" type="button" data-act="found">${bi('found')}Fundar puesto · 800</button>`);
    }
    const app = this.app;
    if (sel.some((u) => u.def.weapon)) {
      acts.push(`<button class="btn ${app.input.amoveArm ? 'gold' : ''}" type="button" data-act="amove" id="btn-amove" title="Avanzar atacando (F)">${bi('amove')}${app.input.amoveArm ? 'Toca el destino…' : 'Avanzar atacando'}</button>`);
    }
    if (sel.length > 1) {
      acts.push(`<button class="btn" type="button" data-act="formation" id="btn-formation" title="Bloque: juntas · Línea: una al lado de otra, de frente al destino">${bi('formation')}Formación: ${app.formation === 'line' ? 'línea' : 'bloque'}</button>`);
    }
    acts.push(`<button class="btn" type="button" data-act="stop">${bi('stop')}Detener</button>`);
    html += `<div class="actions">${acts.join('')}</div>`;
    html += `<div class="actions groupsave"><span class="queue">${bi('group')}Guardar en</span>${[1, 2, 3].map((n) =>
      `<button class="btn" type="button" data-act="savegrp" data-v="${n}" title="Guardar en el grupo ${n} (Ctrl o Mayús + ${n})">${n}</button>`).join('')}</div>`;
    return html;
  }

  pointHtml(pt) {
    const g = this.app.game;
    const ownerTxt = pt.owner >= 0
      ? `<b style="color:${hexColor(PLAYER_COLORS[pt.owner])}">${esc(g.players[pt.owner].name)}</b>` : 'Sin dueño';
    const state = pt.contested ? 'En disputa: hay tropas de varios equipos cerca'
      : pt.owner < 0 && pt.prog > 0 ? `Capturando… ${Math.floor(pt.prog * 100)} %`
        : `Para capturarlo: infantería a 1 casilla y sin enemigos a ${CAPTURE.clear} casillas durante ${CAPTURE.time} s.`;
    let html = this.head(pt.type, pt.owner >= 0 ? PLAYER_COLORS[pt.owner] : NEUTRAL, esc(pt.def.name),
      `${ownerTxt} · ${esc(pt.def.desc)}`, false);
    html += `<div class="queue">${state}</div>`;
    if (g.mode.king && pt.type === 'faro') {
      const parts = Object.entries(g.kingTime).map(([team, t]) => {
        const pid = g.players.findIndex((p) => String(p.team) === team);
        return `<b style="color:${hexColor(PLAYER_COLORS[pid])}">${esc(g.players[pid].name)}</b> ${fmtTime(t)}`;
      });
      html += `<div class="queue">Rey del Faro (meta ${fmtTime(KING_TIME)}): ${parts.join(' · ') || 'nadie lo ha controlado aún'}</div>`;
    }
    return html;
  }

  inspectHtml(e) {
    const g = this.app.game;
    const owner = g.players[e.owner];
    const rel = g.isEnemy(e.owner, 0) ? 'Enemigo' : 'Aliado';
    const sub = `<b style="color:${hexColor(PLAYER_COLORS[e.owner])}">${esc(owner.name)}</b> · ${rel} · ${esc(e.def.desc)}`;
    return this.head(e.type, PLAYER_COLORS[e.owner], esc(e.def.name), sub) + (g.isEnemy(e.owner, 0) ? this.counterHtml(e) : '');
  }

  // Ficha del enemigo (v0.8): vida, nivel, contra qué es fuerte y qué conviene usar contra él.
  counterHtml(e) {
    const g = this.app.game;
    const cls = e.kind === 'bld' ? 'bld' : e.cls;
    const w = e.kind === 'bld' ? g.weaponOf(e) : e.def.weapon;
    const rows = [`<span>Vida</span><b id="enemy-hp">${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)} (${Math.round((Math.max(0, e.hp) / e.maxHp) * 100)} %)</b>`];
    if (e.kind === 'bld' && e.def.maxLevel > 1) rows.push(`<span>Nivel</span><b>${e.level} de ${e.def.maxLevel}</b>`);
    if (w && w.mult) {
      const strong = Object.entries(w.mult).filter(([k, v]) => v >= 1.2 && CAT_NAMES[k]).map(([k]) => CAT_NAMES[k]);
      const cant = Object.entries(w.mult).filter(([k, v]) => v === 0 && CAT_NAMES[k]).map(([k]) => CAT_NAMES[k]);
      rows.push(`<span>Fuerte contra</span><b>${strong.length ? strong.join(', ') : 'nada en especial'}</b>`);
      if (cant.length) rows.push(`<span>No ataca a</span><b>${cant.join(', ')}</b>`);
    } else {
      rows.push('<span>Ataque</span><b>no dispara</b>');
    }
    rows.push(`<span>Usa</span><b>${this.countersFor(cls).join(', ')}</b>`);
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
      $('sel-hptext').textContent = `${fmt(cur)} / ${fmt(max)}`;
    }
    if (first.kind === 'bld' && first.queue.length) {
      const q = first.queue[0];
      const bar0 = document.querySelector('#sel-queue .qitem i');
      if (bar0) bar0.style.width = Math.min(100, (q.t / UNITS[q.type].build) * 100) + '%';
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
        this.toast(`Mejora de ${res.def.name} pagada: un constructor la hará`, 'good');
      }
    } else if (act === 'upall') {
      const res = g.upgradeAll(0);
      if (typeof res === 'string') {
        this.toast(res, 'bad');
        app.sound.play('error');
      } else if (!res.n) {
        this.toast('No alcanza el dinero para ninguna mejora', 'bad');
        app.sound.play('error');
      } else {
        this.toast(`Mejorando ${res.n} ${res.n === 1 ? 'edificio' : 'edificios'} (−${fmt(res.spent)}): tus constructores van a cada obra`, 'good');
      }
      this.renderSel(true);
    } else if (act === 'autoup') {
      const pl = g.players[0];
      pl.autoUpgrade = !pl.autoUpgrade;
      this.toast(pl.autoUpgrade ? 'Mejoras automáticas encendidas: se mejora solo hasta el máximo' : 'Mejoras automáticas apagadas', pl.autoUpgrade ? 'good' : 'info');
      this.renderSel(true);
    } else if (act === 'dome') {
      const err = g.buyDome(0);
      if (err) {
        this.toast(err, 'bad');
        app.sound.play('error');
      } else {
        this.toast(`Cúpula nivel ${g.players[0].dome.level}`, 'good');
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
    } else if (act === 'stop') {
      g.orderStop(sel.filter((x) => x.kind === 'unit'));
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
        this.toast(`${added} en cola · ${err}`, 'bad');
      }
      this.renderSel(true);
    } else if (act === 'amove') {
      if (app.input.amoveArm) app.input.disarmAttackMove();
      else app.input.armAttackMove();
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
      el.innerHTML = '<span class="lbl">Producción</span>' + list.map((b) => {
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
    let label = text.replace(/^Atacan tu /, '').replace(/^Perdiste: /, 'Perdiste ').replace(/^Perdiste /, 'Perdiste ');
    if (/Núcleo/.test(text)) label = 'Núcleo';
    else if (/tropas/i.test(text)) label = 'Tropas';
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
      $('king').innerHTML = `Faro: ${ownerTeam < 0 ? 'libre' : esc(g.players[faro.owner].name)} · Tú ${bar(myT, hexColor(PLAYER_COLORS[0]))}` +
        (rival >= 0 ? ` ${esc(g.players[rival].name)} ${bar(bestT, hexColor(PLAYER_COLORS[rival]))}` : '');
    }
    $('stat-pop').classList.toggle('full', p.popUsed >= p.popCap);
    $('clock').textContent = fmtTime(g.time);
    const sig = g.players.map((pl) => pl.alive).join(',');
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

  showEnd() {
    const g = this.app.game;
    const win = g.result === 'victory';
    $('enddialog').className = 'dialog panel wide ' + (win ? 'result-victory' : 'result-defeat');
    $('enddialog').innerHTML = this.app.lobby.endHtml(g);
    $('end').hidden = false;
    $('btn-again').addEventListener('click', () => this.app.startGame());
    const next = $('btn-next');
    if (next) next.addEventListener('click', () => this.app.startMission(Number(next.dataset.v)));
    $('btn-menu').addEventListener('click', () => this.app.toMenu());
    $('btn-watch').addEventListener('click', () => { $('end').hidden = true; });
    const spec = $('btn-spectate');
    if (spec) spec.addEventListener('click', () => this.app.spectate());
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

  unlock() {
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
