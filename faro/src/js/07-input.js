'use strict';
// Controles: toque (iPad/celular), ratón y teclado.
// Un dedo arrastra el mapa, dos dedos hacen zoom y giran, un toque selecciona u ordena.

class Input {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.pointers = new Map();
    this.drag = null;
    this.keys = new Set();
    this.boxMode = false;
    this.amoveArm = false; // «Avanzar atacando»: el siguiente toque en el mapa da la orden
    this.placement = null;
    this.lastTap = { t: 0, x: 0, y: 0, id: -1 };
    this.lastRot = {};
    this.bind();
  }

  get game() {
    return this.app.game;
  }

  get r() {
    return this.app.renderer;
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', () => { if (!this.pointers.size && this.r) this.r.setHover(-1); });
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  active() {
    return this.app.state === 'play' && this.game && this.r;
  }

  pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onDown(e) {
    if (!this.active()) return;
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    const p = this.pos(e);
    this.pointers.set(e.pointerId, p);
    const cam = this.r.cam;
    if (this.pointers.size === 1) {
      this.drag = {
        mode: null, sx: p.x, sy: p.y, x: p.x, y: p.y, moved: false,
        right: e.button === 2, shift: e.shiftKey, grab: this.r.screenToWorld(p.x, p.y, 0),
      };
      // v1.2: mantener pulsado el mapa (sin moverse) abre la rueda de selección del ejército.
      clearTimeout(this.holdTimer);
      if (e.button !== 2 && !this.placement && !this.amoveArm && !this.boxMode && !e.shiftKey) {
        const d0 = this.drag;
        this.holdTimer = setTimeout(() => {
          if (this.drag === d0 && !d0.moved && this.pointers.size === 1) {
            d0.mode = 'wheel';
            this.app.ui.showWheel(d0.sx, d0.sy);
          }
        }, WHEEL_HOLD_MS);
      }
    } else if (this.pointers.size === 2) {
      clearTimeout(this.holdTimer);
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.drag = {
        mode: 'pinch', moved: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        ang0: Math.atan2(b.y - a.y, b.x - a.x), dist0: cam.dist, yaw0: cam.yaw,
        grab: this.r.screenToWorld(mid.x, mid.y, 0),
      };
      this.app.ui.hideBox();
    }
  }

  onMove(e) {
    if (!this.active()) return;
    const p = this.pos(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && this.placement) this.hover(p.x, p.y);
      return;
    }
    this.pointers.set(e.pointerId, p);
    const d = this.drag;
    if (!d) return;
    const cam = this.r.cam;
    if (d.mode === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      cam.dist = clamp(d.dist0 * (d.d0 / dist), 9, 70);
      cam.yaw = d.yaw0 + (ang - d.ang0);
      this.r.updateCamera();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = this.r.screenToWorld(mid.x, mid.y, 0);
      if (w && d.grab) {
        cam.tx += d.grab.x - w.x;
        cam.tz += d.grab.z - w.z;
        this.r.updateCamera();
      }
      return;
    }
    if (this.pointers.size !== 1) return;
    if (d.mode === 'wheel') {
      this.app.ui.hoverWheel(p.x, p.y);
      return;
    }
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 9) {
      d.moved = true;
      clearTimeout(this.holdTimer);
      d.mode = this.boxMode || d.shift ? 'box' : 'pan';
    }
    if (d.mode === 'pan') {
      const w = this.r.screenToWorld(p.x, p.y, 0);
      if (w && d.grab) {
        cam.tx += d.grab.x - w.x;
        cam.tz += d.grab.z - w.z;
        this.r.updateCamera();
      }
    } else if (d.mode === 'box') {
      this.app.ui.showBox(d.sx, d.sy, p.x, p.y);
    }
    d.x = p.x;
    d.y = p.y;
    if (this.placement && e.pointerType === 'mouse') this.hover(p.x, p.y);
  }

  onUp(e, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pos(e);
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.mode === 'pinch') {
      if (this.pointers.size === 0) this.drag = null;
      else {
        const [rest] = [...this.pointers.values()];
        this.drag = { mode: 'pan', sx: rest.x, sy: rest.y, moved: true, grab: this.r.screenToWorld(rest.x, rest.y, 0) };
      }
      return;
    }
    if (this.pointers.size) return;
    this.drag = null;
    clearTimeout(this.holdTimer);
    if (d.mode === 'wheel') {
      // Si suelta el dedo sobre una opción, la elige; si no, la rueda queda abierta para tocar.
      if (!cancelled) this.app.ui.releaseWheel(p.x, p.y);
      return;
    }
    if (cancelled || !this.active()) return;
    if (d.mode === 'box') {
      this.app.ui.hideBox();
      const list = this.r.unitsInRect(d.sx, d.sy, p.x, p.y, (u) => u.owner === 0);
      this.app.setSelection(list);
      if (!list.length) this.app.ui.toast('No hay tropas tuyas en el recuadro');
      return;
    }
    if (!d.moved) this.tap(p.x, p.y, d.right);
  }

  onWheel(e) {
    if (!this.active()) return;
    e.preventDefault();
    const cam = this.r.cam;
    const p = this.pos(e);
    const before = this.r.screenToWorld(p.x, p.y, 0);
    cam.dist = clamp(cam.dist * (1 + clamp(e.deltaY, -120, 120) * 0.0012), 9, 70);
    this.r.updateCamera();
    const after = this.r.screenToWorld(p.x, p.y, 0);
    if (before && after) {
      cam.tx += before.x - after.x;
      cam.tz += before.z - after.z;
    }
  }

  onKey(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
    if (!down || !this.active()) return;
    // Grupos (v0.7): número elige; Ctrl, Cmd o Mayús + número guarda. Se usa e.code para que
    // Mayús + 1 funcione aunque el teclado escriba «!».
    const digit = /^Digit([1-3])$/.exec(e.code || '');
    if (digit) {
      const n = Number(digit[1]);
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        e.preventDefault();
        this.app.saveGroup(n);
      } else {
        this.app.selectGroup(n);
      }
      return;
    }
    if (k === 'tab') {
      e.preventDefault();
      if (this.app.ui.wheelOpen()) this.app.ui.hideWheel();
      else this.app.ui.showWheel(this.r.width / 2, this.r.height / 2);
      return;
    }
    if (k === 'escape' && this.app.ui.wheelOpen()) {
      this.app.ui.hideWheel();
      return;
    }
    if (k === 'escape') {
      if (this.amoveArm) this.disarmAttackMove();
      else if (this.placement) this.cancelPlacement();
      else if (this.app.selection.length) this.app.setSelection([]);
      else this.app.togglePause(true);
    } else if (k === 'r' && this.placement && this.placement.kind === 'build') this.rotatePlacement();
    else if (k === 'enter' && this.placement && this.placement.kind === 'build') this.confirmPlacement();
    else if (k === 'b') this.app.ui.toggleBuild();
    else if (k === ' ') {
      e.preventDefault();
      this.app.focusCore();
    } else if (k === 'delete' || k === 'backspace') {
      const s = this.app.selection;
      if (s.length === 1 && s[0].kind === 'bld' && s[0].owner === 0) this.app.ui.demolishSelected();
    } else if (k === 't') this.app.quickSelect('army');
    else if (k === 'p') this.app.togglePause(true);
    else if (k === 'f') this.armAttackMove();
    else if (k === 'c') this.app.selectBuilders();
  }

  update(dt) {
    if (!this.active()) return;
    const cam = this.r.cam;
    const sp = cam.dist * 1.1 * dt;
    let fx = 0;
    let fz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) fz -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) fz += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) fx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) fx += 1;
    if (fx || fz) {
      const s = Math.sin(cam.yaw);
      const c = Math.cos(cam.yaw);
      cam.tx += (fx * c + fz * s) * sp;
      cam.tz += (-fx * s + fz * c) * sp;
    }
    if (this.keys.has('q')) cam.yaw += dt * 1.6;
    if (this.keys.has('e')) cam.yaw -= dt * 1.6;
  }

  hover(x, y) {
    const c = this.r.pickCell(x, y);
    this.r.setHover(c ? c.i : -1);
  }

  // ---------- avanzar atacando ----------
  armAttackMove() {
    const armed = this.app.selection.filter((e) => e.kind === 'unit' && e.owner === 0 && e.alive && e.def.weapon);
    if (!armed.length) {
      this.app.ui.toast('Elige primero tropas que puedan pelear', 'bad');
      return false;
    }
    this.amoveArm = true;
    this.app.ui.selSig = '';
    this.app.ui.toast('Toca el destino: avanzarán peleando con todo lo que encuentren');
    return true;
  }

  disarmAttackMove() {
    if (!this.amoveArm) return;
    this.amoveArm = false;
    if (this.app.ui) this.app.ui.selSig = '';
  }

  // ---------- toques ----------
  tap(x, y, right) {
    const g = this.game;
    const app = this.app;
    if (this.placement && !right) {
      this.placementTap(x, y);
      return;
    }
    const amove = this.amoveArm;
    this.disarmAttackMove();
    const mine = app.selection.filter((e) => e.kind === 'unit' && e.owner === 0 && e.alive);
    const unit = this.r.pickUnit(x, y);
    const cell = this.r.pickCell(x, y);
    const bld = cell && cell.bld && cell.bld.alive ? cell.bld : null;
    const point = !unit && !bld && cell && cell.point ? cell.point : null;
    const target = unit || bld;
    const now = performance.now();
    const dbl = now - this.lastTap.t < 330 && Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 30;
    this.lastTap = { t: now, x, y, id: target ? target.id : -1 };

    // Avanzar atacando: a ese lugar, peleando en el camino (sobre un enemigo, se ataca directo).
    if (amove && mine.length && cell && !(target && g.isEnemy(target.owner, 0))) {
      g.orderMove(mine, cell.i, true, app.formation);
      this.r.addMoveMarker(cell.i, 0xff6060);
      app.ui.toast(`${mine.length === 1 ? 'Avanza' : `${mine.length} tropas avanzan`} atacando`);
      app.sound.play('order');
      return;
    }

    if (target && g.isEnemy(target.owner, 0)) {
      if (mine.length) {
        const armed = mine.filter((u) => u.def.weapon && g.canAttack(u, u.def.weapon, target));
        if (armed.length) {
          g.orderAttack(armed, target);
          this.r.addMoveMarker(target.kind === 'bld' ? target.cell : target.cell, 0xff6060);
          app.sound.play('order');
          const rest = mine.filter((u) => !armed.includes(u));
          if (rest.length) g.orderMove(rest, target.cell);
        } else {
          app.ui.toast('Tus tropas seleccionadas no pueden atacar eso', 'bad');
        }
        return;
      }
      app.setSelection([target]);
      return;
    }
    if (right) {
      if (mine.length && cell) this.moveTo(mine, cell.i);
      return;
    }
    // Constructores seleccionados + toque en una obra tuya = construir o mejorar.
    if (bld && bld.owner === 0 && g.needsWork(bld)) {
      const workers = mine.filter((u) => g.canBuildSite(u, bld));
      if (workers.length) {
        g.orderBuild(workers, bld);
        this.r.addMoveMarker(bld.cell, 0xf2ab38);
        app.ui.toast(`${workers.length === 1 ? 'Construyendo' : `${workers.length} constructores en`} ${bld.def.name}`);
        app.sound.play('order');
        return;
      }
    }
    // Ingeniero seleccionado + toque en un edificio tuyo dañado = reparar.
    if (bld && bld.owner === 0 && bld.hp < bld.maxHp && bld.built) {
      const fixers = mine.filter((u) => u.def.repairs);
      if (fixers.length) {
        g.orderRepair(fixers, bld);
        const rest = mine.filter((u) => !u.def.repairs);
        if (rest.length) g.orderMove(rest, bld.cell);
        this.r.addMoveMarker(bld.cell, 0x6dff8a);
        app.ui.toast(`Reparando ${bld.def.name}`);
        app.sound.play('order');
        return;
      }
    }
    // Toque en el Faro o una Bandera: con tropas seleccionadas, ir a capturarlo.
    if (point) {
      if (mine.length) {
        g.orderMove(mine, cell.i, true);
        this.r.addMoveMarker(cell.i, 0xffb63a);
        const inf = mine.some((u) => u.cls === 'inf');
        app.ui.toast(inf ? 'Quédate junto al punto sin enemigos cerca para capturarlo'
          : 'Solo la infantería captura puntos', inf ? 'info' : 'bad');
        app.sound.play('order');
      } else {
        app.setSelection([point]);
        app.sound.play('click');
      }
      return;
    }
    // Tropas seleccionadas + toque en tu transporte (Barcaza, Lancha, Jeep, Transporte, Portaaviones) = subir.
    if (target && target.owner === 0 && (target.def.capacity || target.def.hangar)) {
      const landers = mine.filter((u) => g.canBoard(u, target));
      if (landers.length) {
        g.orderBoard(landers, target);
        this.r.addMoveMarker(target.cell, 0x7dd3ff);
        app.ui.toast(`Subiendo ${landers.length} ${landers.length === 1 ? 'tropa' : 'tropas'} a ${target.def.name}`);
        app.sound.play('order');
        return;
      }
    }
    if (target && target.owner === 0) {
      if (target.kind === 'unit' && dbl) {
        const same = this.r.unitsInRect(0, 0, this.r.width, this.r.height, (u) => u.owner === 0 && u.type === target.type);
        app.setSelection(same.length ? same : [target]);
      } else {
        app.setSelection([target]);
      }
      app.sound.play('click');
      return;
    }
    if (target) {
      app.setSelection([target]);
      return;
    }
    if (mine.length && cell) {
      this.moveTo(mine, cell.i);
      return;
    }
    app.setSelection([]);
  }

  moveTo(units, ci) {
    const g = this.game;
    const founders = units.filter((u) => u.state === 'found');
    g.orderMove(units, ci, false, this.app.formation);
    for (const u of founders) u.foundCell = -1;
    this.r.addMoveMarker(ci);
    this.app.sound.play('order');
  }

  // ---------- colocación ----------
  startPlacement(p) {
    if (p.kind === 'build') {
      p.rot = this.lastRot[p.btype] || 0;
      p.cell = -1;
      p.err = null;
      p.placed = 0;
    }
    this.placement = p;
    this.refreshPlacement();
    this.app.ui.showPlaceBar(p);
  }

  previewAt(ci) {
    const p = this.placement;
    p.cell = ci;
    p.err = this.game.placeInvalid(0, p.btype, ci);
    this.r.setGhost(p.btype, ci, p.rot, !p.err);
    this.app.ui.showPlaceBar(p);
  }

  rotatePlacement() {
    const p = this.placement;
    if (!p || p.kind !== 'build') return;
    p.rot = (p.rot + Math.PI / 3) % (Math.PI * 2);
    this.lastRot[p.btype] = p.rot;
    if (p.cell >= 0) this.r.setGhost(p.btype, p.cell, p.rot, !p.err);
    this.app.sound.play('click');
  }

  // «Construir» (v1.0): tocar una casilla solo muestra la obra fantasma; este botón la pone.
  // Después se puede elegir otra casilla y volver a construir; «Terminar» sale.
  confirmPlacement() {
    const p = this.placement;
    if (!p || p.kind !== 'build') return;
    if (p.cell < 0) {
      this.app.ui.toast('Toca primero una casilla dorada', 'bad');
      this.app.sound.play('error');
      return;
    }
    this.buildAt(p.cell);
  }

  // Pone la obra en la casilla elegida y sigue en modo construir para poner más.
  buildAt(ci) {
    const g = this.game;
    const p = this.placement;
    p.cell = ci;
    const err = g.place(0, p.btype, p.cell, p.rot);
    if (err) {
      p.err = err;
      this.r.setGhost(p.btype, p.cell, p.rot, false);
      this.app.ui.showPlaceBar(p);
      this.app.ui.toast(err, 'bad');
      this.app.sound.play('error');
      return;
    }
    this.lastRot[p.btype] = p.rot;
    this.r.addMoveMarker(p.cell, 0xf5c542);
    this.app.ui.refreshBuild(true);
    p.placed++;
    p.cell = -1;
    p.err = null;
    this.r.setGhost(null, -1);
    this.r.setHover(-1);
    this.refreshPlacement();
    this.app.ui.showPlaceBar(p);
  }

  refreshPlacement() {
    const p = this.placement;
    if (!p || !this.game) return;
    const g = this.game;
    let cells = [];
    if (p.kind === 'build') {
      cells = g.cells.filter((c) => !g.placeInvalid(0, p.btype, c.i, true)).map((c) => c.i);
    } else if (p.kind === 'found') {
      const u = p.unit;
      const comp = g.cells[u.cell].comp;
      cells = g.cells.filter((c) => !g.foundInvalid(0, c.i, u.def.founds) &&
        (u.mover !== 'land' || c.comp === comp)).map((c) => c.i);
    } else if (p.kind === 'rally' || p.kind === 'bombzone' || p.kind === 'allyattack') {
      cells = [];
    } else if (p.kind === 'nuke') {
      cells = g.cells.filter((c) => !g.nukeInvalid(p.building, c.i) && g.map.dist(c, g.cells[p.building.cell]) <= NUKE.range).map((c) => c.i);
    } else if (p.kind === 'nuke3') {
      const silos = g.readySilos(0).slice(0, 3);
      cells = silos.length < 3 || g.salvoInvalid(0) ? [] : g.cells.filter((c) => silos.every((b) => !g.nukeInvalid(b, c.i))).map((c) => c.i);
    }
    p.valid = new Set(cells);
    this.r.setPlacement(cells);
    if (p.kind === 'build' && p.cell >= 0) {
      const err = g.placeInvalid(0, p.btype, p.cell);
      if (err !== p.err) {
        p.err = err;
        this.r.setGhost(p.btype, p.cell, p.rot, !err);
        this.app.ui.showPlaceBar(p);
      }
    }
  }

  cancelPlacement() {
    this.placement = null;
    if (this.r) {
      this.r.setPlacement(null);
      this.r.setGhost(null, -1);
      this.r.hoverMesh.material.color.set(0xffffff);
      this.r.setHover(-1);
    }
    this.app.ui.hidePlaceBar();
  }

  placementTap(x, y) {
    const g = this.game;
    const p = this.placement;
    const cell = this.r.pickCell(x, y);
    if (!cell) return;
    if (p.kind === 'build') {
      this.previewAt(cell.i);
      this.app.sound.play('click');
    } else if (p.kind === 'found') {
      if (!p.unit.alive) {
        this.cancelPlacement();
        return;
      }
      const err = g.orderFound(p.unit, cell.i);
      if (err) {
        this.app.ui.toast(err, 'bad');
        this.app.sound.play('error');
        return;
      }
      this.r.addMoveMarker(cell.i, 0xf5c542);
      this.app.ui.toast('El ingeniero va en camino (cuesta 800 al llegar)');
      this.cancelPlacement();
    } else if (p.kind === 'nuke') {
      const err = g.launchNuke(p.building, cell.i);
      if (err) {
        this.app.ui.toast(err, 'bad');
        this.app.sound.play('error');
        return;
      }
      this.r.addMoveMarker(cell.i, 0xff4040);
      this.cancelPlacement();
    } else if (p.kind === 'allyattack') {
      // El rival es el dueño de lo que tocaste: edificio, tropa cercana o territorio.
      let pid = cell.bld && cell.bld.alive ? cell.bld.owner : -1;
      if (pid < 0) {
        const u = g.units.find((x) => x.alive && Math.hypot(x.x - cell.x, x.z - cell.z) < 1.2 && g.isEnemy(0, x.owner));
        if (u) pid = u.owner;
      }
      if (pid < 0 && cell.owner >= 0) pid = cell.owner;
      if (pid < 0 || !g.isEnemy(0, pid)) {
        this.app.ui.toast('Toca algo de un rival', 'bad');
        this.app.sound.play('error');
        return;
      }
      const bots = g.bots.filter((b) => b.p.alive && b.p.team === g.players[0].team && b.pid !== 0);
      const n = bots.reduce((a, b) => a + b.answerAttack(pid), 0);
      this.r.addMoveMarker(cell.i, 0xff4040);
      this.app.ui.toast(`Tus aliados atacan a ${g.players[pid].name}${n ? ` con ${n} tropas` : ''}`, 'good');
      this.app.sound.play('order');
      this.cancelPlacement();
    } else if (p.kind === 'bombzone') {
      const bombers = p.units.filter((u) => u.alive);
      if (bombers.length) {
        g.orderMove(bombers, cell.i, true);
        this.r.addMoveMarker(cell.i, 0xff4040);
        this.app.ui.toast(`${bombers.length === 1 ? 'El Bombardero va' : 'Los Bombarderos van'} a bombardear la zona`, 'info');
        this.app.sound.play('order');
      }
      this.cancelPlacement();
    } else if (p.kind === 'nuke3') {
      const res = g.launchSalvo(0, cell.i);
      if (typeof res === 'string') {
        this.app.ui.toast(res, 'bad');
        this.app.sound.play('error');
        return;
      }
      this.r.addMoveMarker(cell.i, 0xff4040);
      this.app.ui.toast(`¡${res} misiles nucleares lanzados a la vez!`, 'info');
      this.cancelPlacement();
    } else if (p.kind === 'rally') {
      p.building.rally = cell.i;
      this.r.addMoveMarker(cell.i, 0xffffff);
      this.cancelPlacement();
      this.app.ui.toast('Punto de reunión fijado');
    }
  }
}
