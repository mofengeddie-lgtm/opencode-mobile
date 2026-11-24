'use strict';
// v1.9: plataforma donde corre el juego. En Poki habla con su SDK (eventos de juego y anuncios);
// en la versión web, o si el SDK no carga (bloqueador de anuncios, sin conexión), cada llamada no hace nada
// y el juego sigue igual. Reglas de Poki que cuida este módulo:
// - gameLoadingFinished una sola vez, al terminar de cargar;
// - gameplayStart con el primer toque o tecla de la partida (no al cargar) y gameplayStop en pausa, menú o final;
// - nunca dos eventos iguales seguidos y ninguno mientras dura un anuncio;
// - durante un anuncio, sonido y controles apagados y la partida quieta.

const Platform = {
  name: typeof FARO_PLATFORM !== 'undefined' ? FARO_PLATFORM : 'web',
  sdk: null,
  ok: false,
  loaded: false,
  playing: false,
  inAd: false,
  last: null,
  // Registro de lo que se mandó (para las pruebas y para revisar en la consola: Platform.log).
  log: [],

  // Arranca el SDK si está. Devuelve una promesa que siempre se cumple (con o sin SDK).
  init() {
    const S = typeof window !== 'undefined' ? window.PokiSDK : null;
    if (this.name !== 'poki' || !S || typeof S.init !== 'function') return Promise.resolve(false);
    this.sdk = S;
    // Si el SDK no contesta (red cortada, bloqueador a medias), el juego no se queda en la pantalla de carga:
    // a los 6 s sigue cargando igual (el SDK puede terminar después; las llamadas no se pierden).
    let p;
    try { p = S.init(); } catch (err) { p = Promise.reject(err); }
    const init = Promise.resolve(p).then(() => { this.ok = true; this.note('init'); return true; })
      .catch(() => { this.ok = false; this.note('init-falló'); return false; });
    return Promise.race([init, new Promise((res) => setTimeout(() => { if (!this.ok) this.note('init-sin-respuesta'); res(false); }, this.INIT_WAIT))]);
  },

  // Esperas de seguridad (no son temporizadores de anuncios: Poki decide cuándo hay anuncio).
  INIT_WAIT: 6000,
  // Si el anuncio no empieza en 8 s, el juego sigue; si empezó, a lo sumo 150 s.
  AD_NO_START: 8000,
  AD_MAX: 150000,

  // Espera la promesa de un anuncio, pero sin quedarse trabado si el SDK nunca contesta.
  guard(promise, flags) {
    return new Promise((res) => {
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(t1);
        clearTimeout(t2);
        res(v);
      };
      const t1 = setTimeout(() => { if (!flags.started) { this.note('anuncio-sin-respuesta'); finish(undefined); } }, this.AD_NO_START);
      const t2 = setTimeout(() => { this.note('anuncio-sin-final'); finish(undefined); }, this.AD_MAX);
      Promise.resolve(promise).then(finish, () => finish(undefined));
    });
  },

  note(ev) {
    this.log.push({ ev, t: Math.round(performance.now()) });
    if (this.log.length > 400) this.log.shift();
  },

  // Llama a una función del SDK sin dejar que un error del SDK rompa el juego.
  call(fn, ...args) {
    if (!this.sdk || typeof this.sdk[fn] !== 'function') return undefined;
    try {
      return this.sdk[fn](...args);
    } catch (err) {
      console.error('[Platform] Falló', fn, err && err.message);
      return undefined;
    }
  },

  send(ev) {
    if (this.inAd || this.last === ev) return false;
    this.last = ev;
    this.note(ev);
    this.call(ev);
    return true;
  },

  loadingFinished() {
    if (this.loaded) return;
    this.loaded = true;
    this.note('gameLoadingFinished');
    this.call('gameLoadingFinished');
  },

  gameplayStart() {
    if (this.inAd || this.playing) return;
    if (this.send('gameplayStart')) this.playing = true;
  },

  gameplayStop() {
    if (this.inAd || !this.playing) return;
    if (this.send('gameplayStop')) this.playing = false;
  },

  // ¿Hay anuncios? Solo en Poki con el SDK presente (aunque init haya fallado, el SDK responde sin anuncio).
  hasAds() {
    return !!this.sdk && typeof this.sdk.commercialBreak === 'function';
  },

  // Antes de volver a jugar (empezar partida o salir de la pausa). Poki decide si de verdad muestra un anuncio.
  commercialBreak(app) {
    if (!this.hasAds() || this.inAd) return Promise.resolve();
    this.gameplayStop();
    this.adBegin(app);
    this.note('commercialBreak');
    const flags = { started: false };
    let p;
    try {
      p = this.sdk.commercialBreak(() => { flags.started = true; this.note('anuncio-empieza'); });
    } catch (err) {
      p = null;
    }
    return this.guard(p, flags).then(() => { this.adEnd(app); this.note('commercialBreak-fin'); });
  },

  // Anuncio con premio: devuelve true solo si el video se vio. Con bloqueador o sin SDK: false (sin premio y sin mensaje).
  rewardedBreak(app) {
    if (!this.sdk || typeof this.sdk.rewardedBreak !== 'function' || this.inAd) return Promise.resolve(false);
    this.gameplayStop();
    this.adBegin(app);
    this.note('rewardedBreak');
    const flags = { started: false };
    let p;
    try {
      p = this.sdk.rewardedBreak(() => { flags.started = true; this.note('anuncio-empieza'); });
    } catch (err) {
      p = null;
    }
    return this.guard(p, flags).then((ok) => !!ok)
      .then((ok) => { this.adEnd(app); this.note('rewardedBreak-' + (ok ? 'visto' : 'no')); return ok; });
  },

  // Durante el anuncio: sonido en pausa, partida quieta y una capa que frena toques, clics y teclas.
  adBegin(app) {
    this.inAd = true;
    document.body.classList.add('in-ad');
    const sh = document.getElementById('adshield');
    if (sh) sh.hidden = false;
    if (app && app.sound) app.sound.hold(true);
    if (app) {
      this.adPaused = app.state === 'play' && !app.paused;
      if (this.adPaused) app.paused = true;
    }
  },

  adEnd(app) {
    this.inAd = false;
    document.body.classList.remove('in-ad');
    const sh = document.getElementById('adshield');
    if (sh) sh.hidden = true;
    if (app && app.sound) app.sound.hold(false);
    if (app && this.adPaused) app.paused = false;
    this.adPaused = false;
  },

  // Idioma del jugador según Poki («es», «en», «pt»…) o null si no se sabe.
  language() {
    const l = this.call('getLanguage');
    return typeof l === 'string' && l ? l.toLowerCase().slice(0, 2) : null;
  },

  // En el celular, la «píldora» de Poki va arriba; se puede correr un poco para que no tape botones.
  movePill(topPercent, topPx) {
    this.call('movePill', topPercent, topPx);
  },
};

// Teclas y rueda: en Poki el juego está dentro de una página más larga; que espacio, flechas y rueda no la muevan.
// La rueda sigue desplazando las listas del juego (arsenal, ajustes…) mientras tengan para dónde ir.
window.addEventListener('keydown', (ev) => {
  if (Platform.inAd) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    return;
  }
  const tag = ev.target && ev.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (ev.key === ' ' && (tag === 'BUTTON' || tag === 'A')) return;
  if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' ', 'PageDown', 'PageUp'].includes(ev.key)) ev.preventDefault();
}, true);
window.addEventListener('keyup', (ev) => {
  if (Platform.inAd) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  }
}, true);
window.addEventListener('wheel', (ev) => {
  let el = ev.target;
  while (el && el.nodeType === 1 && el !== document.body) {
    const st = getComputedStyle(el);
    if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      const can = ev.deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
      if (can) return;
      break;
    }
    el = el.parentElement;
  }
  ev.preventDefault();
}, { passive: false });
