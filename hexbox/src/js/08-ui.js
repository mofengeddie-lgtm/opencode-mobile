'use strict';
// Interfaz HTML: menú, barra superior, panel de construcción, panel de selección,
// avisos, objetivos, pausa y pantalla final. También el sonido sintetizado.

const $ = (id) => document.getElementById(id);

const ICON = {
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pop: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/></svg>',
};

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
    this.initMenu();
    this.initHud();
  }

  // ---------- menú ----------
  initMenu() {
    const o = this.app.opts;
    const radios = (el, name, dict, selected) => {
      el.innerHTML = Object.entries(dict).map(([k, d]) => `
        <label class="opt"><input type="radio" name="${name}" id="${name}-${k}" value="${k}" ${k === selected ? 'checked' : ''}>
        <span><b>${esc(d.name)}</b>${d.desc ? `<small>${esc(d.desc)}</small>` : ''}</span></label>`).join('');
    };
    radios($('opt-mode'), 'mode', MODES, o.mode);
    radios($('opt-map'), 'map', MAPS, o.mapKind);
    const diffs = {};
    for (const [k, d] of Object.entries(DIFFICULTY)) diffs[k] = { name: d.name };
    radios($('opt-diff'), 'diff', diffs, o.difficulty);
    $('opt-fog').checked = !!o.fog;
    $('opt-turbo').checked = !!o.turbo;
    $('menu-form').addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'mode') this.app.setOption('mode', t.value);
      else if (t.name === 'map') this.app.setOption('mapKind', t.value);
      else if (t.name === 'diff') this.app.setOption('difficulty', t.value);
      else if (t.id === 'opt-fog') this.app.setOption('fog', t.checked);
      else if (t.id === 'opt-turbo') this.app.setOption('turbo', t.checked);
    });
    $('menu-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.app.sound.unlock();
      this.app.startGame();
    });
    $('btn-reroll').addEventListener('click', () => this.app.reroll());
  }

  showScreen(name) {
    $('menu').hidden = name !== 'menu';
    $('hud').hidden = name !== 'play';
    $('pause').hidden = true;
    $('end').hidden = true;
  }

  // ---------- HUD ----------
  initHud() {
    const app = this.app;
    $('btn-pause').addEventListener('click', () => app.togglePause(true));
    $('btn-resume').addEventListener('click', () => app.togglePause(false));
    $('btn-restart').addEventListener('click', () => app.startGame());
    $('btn-quit').addEventListener('click', () => app.toMenu());
    document.querySelectorAll('[data-quality]').forEach((b) => {
      b.addEventListener('click', () => app.setQuality(b.dataset.quality));
    });
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
    $('btn-home').addEventListener('click', () => app.focusCore());
    $('btn-box').addEventListener('click', () => {
      app.input.boxMode = !app.input.boxMode;
      $('btn-box').classList.toggle('on', app.input.boxMode);
      if (app.input.boxMode) this.toast('Arrastra para seleccionar varias tropas');
    });
    document.querySelectorAll('[data-quick]').forEach((b) => {
      b.addEventListener('click', () => app.quickSelect(b.dataset.quick));
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
    $('objectives').classList.remove('collapsed');
    $('btn-obj').textContent = 'Ocultar';
    $('objlist').innerHTML = OBJECTIVES.map((o) => `<li data-obj="${o.id}">${esc(o.text)}</li>`).join('');
    $('btn-box').classList.remove('on');
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
    const li = document.querySelector(`[data-obj="${id}"]`);
    if (li) li.classList.add('done');
    const all = OBJECTIVES.every((o) => this.app.game.objDone[o.id]);
    if (all) setTimeout(() => { $('objectives').hidden = true; }, 4000);
  }

  toast(text, kind = 'info') {
    const now = performance.now();
    if (this.lastToast[text] && now - this.lastToast[text] < 1200) return;
    this.lastToast[text] = now;
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 2800);
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
    if (p.kind === 'build') {
      const d = BUILDINGS[p.btype];
      text = p.valid && p.valid.size
        ? `Toca una casilla resaltada para colocar <b>${esc(d.name)}</b> · <span class="cost">${fmt(d.cost)}</span>`
        : `No hay casillas válidas para ${esc(d.name)} en tu territorio. ${esc(d.desc)}`;
    } else if (p.kind === 'found') {
      text = p.valid && p.valid.size
        ? 'Toca dónde fundar el <b>Puesto avanzado</b> · <span class="cost">800</span> al llegar'
        : 'No hay sitio alcanzable para fundar un puesto';
    } else if (p.kind === 'rally') {
      text = 'Toca el <b>punto de reunión</b> para las tropas nuevas';
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
        <div class="top"><b>${esc(d.name)}</b><span class="cost">${fmt(d.cost)}</span></div>
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
      const maxed = d.limit && n >= d.limit;
      const act = placing && placing.kind === 'build' && placing.btype === k;
      states.push([el, k, d, n, poor, maxed, act]);
      sig += `${k}${n}${poor}${maxed}${act}|`;
    });
    if (!force && sig === this.buildSig) return;
    this.buildSig = sig;
    for (const [el, k, d, n, poor, maxed, act] of states) {
      el.classList.toggle('poor', poor);
      el.classList.toggle('maxed', !!maxed);
      el.classList.toggle('active', !!act);
      const cnt = el.querySelector(`[data-count="${k}"]`);
      if (cnt) cnt.textContent = d.limit ? ` (${n}/${d.limit})` : n ? ` (${n})` : '';
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
    if (first.kind === 'bld') {
      sig += `|${first.built}|${first.queue.map((q) => q.type).join('.')}|${first.rally >= 0}|${this.demolishArm}`;
      if (first.def.produces) sig += '|' + first.def.produces.map((t) => p.coins >= UNITS[t].cost).join('');
      if (first.def.upgrade) sig += '|u' + (p.coins >= BUILDINGS[first.def.upgrade].cost);
    } else {
      sig += '|' + sel.map((u) => u.state === 'found').join('') + (p.coins >= 800) +
        sel.map((u) => (u.cargo ? u.cargo.length : '')).join('');
    }
    if (force || sig !== this.selSig) {
      this.selSig = sig;
      panel.hidden = false;
      if (first.kind === 'bld') panel.innerHTML = this.buildingHtml(first);
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
    if (d.income) extra.push(`+${fmt(d.income * g.incomeMult(g.players[b.owner]))} monedas/min`);
    if (d.pop) extra.push(`+${d.pop} de población`);
    const sub = (own ? '' : `<b style="color:${hexColor(PLAYER_COLORS[b.owner])}">${esc(g.players[b.owner].name)}</b> · `) +
      esc(d.desc) + (extra.length ? ' · ' + extra.join(' · ') : '');
    let html = this.head(b.type, PLAYER_COLORS[b.owner], esc(d.name), sub);
    if (!own) return html;
    if (d.produces && b.built) {
      const coins = g.players[0].coins;
      html += '<div class="cards">' + d.produces.map((t) => {
        const u = UNITS[t];
        return `<button class="card ${coins < u.cost ? 'poor' : ''}" type="button" data-act="train" data-type="${t}" title="${esc(u.desc)}">
          <img src="${Thumbs.get(t, PLAYER_COLORS[0])}" alt="">
          <b>${esc(u.name)}</b>
          <div class="meta"><span class="cost">${fmt(u.cost)}</span><span>${ICON.pop}${u.pop}</span></div>
        </button>`;
      }).join('') + '</div>';
      html += '<div class="queue" id="sel-queue">' + (b.queue.length
        ? 'En cola: ' + b.queue.map((q, i) => `<button class="qitem" type="button" data-act="cancel" data-idx="${i}" title="Cancelar ${esc(UNITS[q.type].name)}">
            <img src="${Thumbs.get(q.type, PLAYER_COLORS[0])}" alt=""><i style="width:0"></i></button>`).join('')
        : 'Toca una tropa para entrenarla. Toca la cola para cancelar.') + '</div>';
    }
    const acts = [];
    if (d.upgrade && b.built) {
      const to = BUILDINGS[d.upgrade];
      acts.push(`<button class="btn gold" type="button" data-act="upgrade">Mejorar a ${esc(to.name)} · ${fmt(to.cost)}</button>`);
    }
    if (d.produces && b.built) acts.push(`<button class="btn" type="button" data-act="rally">${b.rally >= 0 ? 'Mover punto de reunión' : 'Punto de reunión'}</button>`);
    if (b.type !== 'core') {
      acts.push(`<button class="btn danger" type="button" data-act="demolish">${this.demolishArm === b.id ? '¿Seguro? Toca otra vez' : 'Demoler'}</button>`);
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
    const ship = sel.length === 1 && first.def.capacity ? first : null;
    if (ship) {
      const g = this.app.game;
      html += `<div class="queue">Carga: ${g.cargoSlots(ship)}/${ship.def.capacity}` +
        (ship.cargo.length ? ' · ' + ship.cargo.map((u) => `<img class="qitem" style="cursor:default" src="${Thumbs.get(u.type, PLAYER_COLORS[0])}" alt="${esc(u.def.name)}">`).join('')
          : ' · Selecciona tropas de tierra y toca el transporte para subirlas.') + '</div>';
      if (ship.cargo.length) acts.push('<button class="btn gold" type="button" data-act="unload">Desembarcar</button>');
    }
    const founder = sel.find((u) => u.def.founds);
    if (founder) {
      acts.push(`<button class="btn gold" type="button" data-act="found">Fundar puesto · 800</button>`);
    }
    acts.push('<button class="btn" type="button" data-act="stop">Detener</button>');
    html += `<div class="actions">${acts.join('')}</div>`;
    return html;
  }

  inspectHtml(e) {
    const g = this.app.game;
    const owner = g.players[e.owner];
    const rel = g.isEnemy(e.owner, 0) ? 'Enemigo' : 'Aliado';
    const sub = `<b style="color:${hexColor(PLAYER_COLORS[e.owner])}">${esc(owner.name)}</b> · ${rel} · ${esc(e.def.desc)}`;
    return this.head(e.type, PLAYER_COLORS[e.owner], esc(e.def.name), sub);
  }

  updateSelLive(sel) {
    const hp = $('sel-hp');
    if (!hp) return;
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
        this.toast(`Mejorando a ${res.def.name}`, 'good');
      }
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
    }
  }

  demolishSelected() {
    const app = this.app;
    const b = app.selection[0];
    if (!b || b.kind !== 'bld' || b.owner !== 0 || b.type === 'core') return;
    if (this.demolishArm === b.id) {
      app.game.demolish(b);
      this.demolishArm = -1;
      app.setSelection([]);
      this.toast(`${b.def.name} demolido`);
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
    $('stat-pop').classList.toggle('full', p.popUsed >= p.popCap);
    $('clock').textContent = fmtTime(g.time);
    const sig = g.players.map((pl) => pl.alive).join(',');
    if (sig !== this.playersSig) {
      this.playersSig = sig;
      const myTeam = p.team;
      $('players').innerHTML = g.players.map((pl) => {
        const tag = pl.id === 0 ? '' : pl.team === myTeam ? '<em>aliado</em>' : '';
        return `<div class="pchip ${pl.alive ? '' : 'dead'}" title="${esc(pl.name)}"><i style="background:${hexColor(pl.color)}"></i><span>${esc(pl.name)}</span>${tag}</div>`;
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
  }

  showEnd(result) {
    const g = this.app.game;
    const s = g.players[0].stats;
    const win = result === 'victory';
    $('enddialog').className = 'dialog panel ' + (win ? 'result-victory' : 'result-defeat');
    $('enddialog').innerHTML = `
      <h2>${win ? 'Victoria' : 'Derrota'}</h2>
      <p>${win ? 'Todos los Núcleos rivales han caído. El archipiélago es tuyo.' : 'Tu Núcleo fue destruido. Prueba otra estrategia: más torretas, más economía o ataca antes.'}</p>
      <div class="stats">
        <div><b>${fmtTime(g.time)}</b><span>Duración</span></div>
        <div><b>${fmt(s.earned)}</b><span>Monedas ganadas</span></div>
        <div><b>${s.trained}</b><span>Tropas entrenadas</span></div>
        <div><b>${s.kills}</b><span>Enemigos destruidos</span></div>
        <div><b>${s.built}</b><span>Edificios construidos</span></div>
        <div><b>${s.lost}</b><span>Tropas perdidas</span></div>
      </div>
      <div class="row">
        <button class="btn gold" type="button" id="btn-again">Revancha</button>
        <button class="btn" type="button" id="btn-watch">Ver el mapa</button>
        <button class="btn" type="button" id="btn-menu">Menú</button>
      </div>`;
    $('end').hidden = false;
    $('btn-again').addEventListener('click', () => this.app.startGame());
    $('btn-menu').addEventListener('click', () => this.app.toMenu());
    $('btn-watch').addEventListener('click', () => { $('end').hidden = true; });
  }
}

// Sonido sintetizado con Web Audio (sin archivos externos).
class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.last = {};
    try {
      this.on = localStorage.getItem('hexbox-sound') !== 'off';
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
  }

  toggle() {
    this.on = !this.on;
    try {
      localStorage.setItem('hexbox-sound', this.on ? 'on' : 'off');
    } catch (err) { /* sin almacenamiento */ }
    if (this.on) this.unlock();
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

  burst(dur, filterType, freq, vol) {
    const c = this.ctx;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
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
    const gap = { bullet: 0.07, flak: 0.08, bolt: 0.12, hit: 0.08, boom: 0.09, rocket: 0.1, shell: 0.12, torpedo: 0.2 }[name] || 0.04;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const v = vol;
    switch (name) {
      case 'bullet': this.burst(0.05, 'highpass', 2200, 0.05 * v); break;
      case 'flak': this.burst(0.09, 'bandpass', 1400, 0.07 * v); break;
      case 'bolt': this.tone(520, 0.12, 'sawtooth', 0.04 * v, -300); break;
      case 'rocket': this.burst(0.18, 'bandpass', 800, 0.07 * v); break;
      case 'shell': this.tone(110, 0.2, 'sine', 0.14 * v, -70); this.burst(0.08, 'lowpass', 900, 0.06 * v); break;
      case 'torpedo': this.burst(0.3, 'lowpass', 400, 0.06 * v); break;
      case 'hit': this.burst(0.08, 'bandpass', 600, 0.05 * v); break;
      case 'boom': this.burst(0.55, 'lowpass', 520, 0.26 * v); this.tone(70, 0.4, 'sine', 0.12 * v, -40); break;
      case 'click': this.tone(880, 0.04, 'triangle', 0.04); break;
      case 'order': this.tone(520, 0.08, 'triangle', 0.05, 180); break;
      case 'place': this.tone(300, 0.12, 'triangle', 0.07, 140); break;
      case 'done': this.tone(660, 0.12, 'triangle', 0.06); this.tone(990, 0.16, 'triangle', 0.06, 0, 0.1); break;
      case 'ready': this.tone(740, 0.08, 'triangle', 0.045); break;
      case 'error': this.tone(200, 0.14, 'square', 0.04, -40); break;
      case 'alarm': this.tone(560, 0.15, 'square', 0.04); this.tone(420, 0.15, 'square', 0.04, 0, 0.18); break;
      default: break;
    }
  }
}
