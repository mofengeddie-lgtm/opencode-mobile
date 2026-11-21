'use strict';
// v1.9: idiomas del juego: español (el original) e inglés.
// - T('texto') traduce un texto suelto; L`texto ${valor}` traduce un texto con valores (marcas {0}, {1}… en el diccionario,
//   así la traducción puede cambiar el orden). En español los dos devuelven exactamente lo mismo que antes.
// - El diccionario (src/i18n/en.json) usa como clave el texto en español, sin espacios en los bordes.
// - Los datos (nombres y descripciones de tropas, edificios, modos, misiones…) se traducen una vez al arrancar
//   (I18N.applyData) y el HTML fijo de la página también (I18N.applyStatic).
// - Idioma: el que elegiste en Ajustes; si no, el de Poki (PokiSDK.getLanguage) o el del navegador.

const I18N = {
  lang: 'es',
  dict: null,
  supported: ['es', 'en'],
  // Textos que faltan en el diccionario (para el revisor de idioma).
  missing: new Set(),
  // Elegido a mano en Ajustes (null: automático).
  chosen: null,

  init() {
    let chosen = null;
    try { chosen = localStorage.getItem('faro-lang'); } catch (err) { /* sin almacenamiento */ }
    this.chosen = this.supported.includes(chosen) ? chosen : null;
    this.set(this.chosen || this.detect());
  },

  // Idioma automático: Poki da el del jugador; si no, el del navegador. Español si empieza con «es»; si no, inglés.
  detect() {
    let l = null;
    try {
      if (typeof window !== 'undefined' && window.PokiSDK && typeof window.PokiSDK.getLanguage === 'function') l = window.PokiSDK.getLanguage();
    } catch (err) { l = null; }
    if (!l && typeof navigator !== 'undefined') l = (navigator.languages && navigator.languages[0]) || navigator.language || 'es';
    l = String(l || 'es').toLowerCase().slice(0, 2);
    return l === 'es' ? 'es' : 'en';
  },

  set(lang) {
    this.lang = this.supported.includes(lang) ? lang : 'es';
    this.dict = this.lang === 'en' && typeof FARO_I18N !== 'undefined' ? FARO_I18N.en : null;
    if (this.lang === 'en' && !this.dict) this.lang = 'es';
    if (typeof document !== 'undefined') document.documentElement.lang = this.lang;
  },

  // Cambia el idioma desde Ajustes: se guarda y el juego se vuelve a abrir en ese idioma.
  choose(lang) {
    try { localStorage.setItem('faro-lang', lang); } catch (err) { /* sin almacenamiento: vale solo hasta cerrar */ }
    this.chosen = lang;
  },

  // Traducción de una clave ya recortada; undefined si no está.
  get(k) {
    if (!this.dict || !k) return undefined;
    const v = this.dict[k];
    if (v === undefined) this.missing.add(k);
    return v;
  },

  // Propiedades de los datos que son texto para el jugador.
  TEXT_PROPS: new Set(['name', 'desc', 'story', 'tip', 'text', 'special', 'title', 'label', 'sub', 'hint', 'note', 'lines', 'why',
    'short', 'plural', 'role', 'goal', 'brief', 'win', 'lose', 'help', 'body', 'msg', 'say', 'line', 'detail', 'tag', 'caption', 'faro', 'flag', 'inf', 'veh',
    'land', 'landcoast', 'coast', 'shallowcoast', 'deep']),

  // Traduce en su lugar los textos de una tabla de datos (objetos y listas anidadas).
  applyData(obj, seen = new Set(), textArr = false) {
    if (this.lang === 'es' || !obj || typeof obj !== 'object' || seen.has(obj)) return obj;
    seen.add(obj);
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const v = obj[i];
        if (typeof v === 'string') { if (textArr) obj[i] = T(v); } else if (v && typeof v === 'object') this.applyData(v, seen, textArr);
      }
      return obj;
    }
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') {
        if (this.TEXT_PROPS.has(k)) obj[k] = T(v);
      } else if (Array.isArray(v)) {
        this.applyData(v, seen, this.TEXT_PROPS.has(k));
      } else if (v && typeof v === 'object' && !(typeof Node !== 'undefined' && v instanceof Node)) {
        this.applyData(v, seen, false);
      }
    }
    return obj;
  },

  // Lista de textos sueltos (como ['Hola', 'Chau']): se traduce cada uno.
  applyList(arr) {
    if (this.lang === 'es' || !Array.isArray(arr)) return arr;
    for (let i = 0; i < arr.length; i++) if (typeof arr[i] === 'string') arr[i] = T(arr[i]);
    return arr;
  },

  // HTML fijo de la página: textos y atributos title, aria-label, placeholder y alt.
  applyStatic(root) {
    if (this.lang === 'es' || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (!n.nodeValue.trim()) continue;
      const t = T(n.nodeValue.replace(/\s+/g, ' '));
      if (t.trim() !== n.nodeValue.replace(/\s+/g, ' ').trim()) n.nodeValue = t;
    }
    for (const el of root.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
      for (const a of ['title', 'aria-label', 'placeholder', 'alt']) {
        const v = el.getAttribute(a);
        if (v && v.trim()) el.setAttribute(a, T(v));
      }
    }
  },

  // Números: «12.345» en español, «12,345» en inglés.
  num(n) {
    return Math.floor(n).toLocaleString(this.lang === 'en' ? 'en-US' : 'es-ES');
  },

  // Ordinal de posiciones: «1.º» / «1st».
  ord(n) {
    if (this.lang !== 'en') return `${n}.º`;
    const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${s}`;
  },
};

// Texto suelto.
function T(s) {
  if (I18N.lang === 'es' || typeof s !== 'string') return s;
  const k = s.trim();
  const v = I18N.get(k);
  if (v === undefined) return s;
  if (k === s) return v;
  const at = s.indexOf(k);
  return s.slice(0, at) + v + s.slice(at + k.length);
}

// Texto con valores: L`Entrena ${n} tropas` → clave «Entrena {0} tropas».
function L(strings, ...vals) {
  if (I18N.lang === 'es') {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += vals[i] + strings[i + 1];
    return out;
  }
  let key = strings[0];
  for (let i = 0; i < vals.length; i++) key += `{${i}}` + strings[i + 1];
  const k = key.trim();
  const v = I18N.get(k);
  if (v === undefined) {
    let out = strings[0];
    for (let i = 0; i < vals.length; i++) out += vals[i] + strings[i + 1];
    return out;
  }
  const filled = v.replace(/\{(\d+)\}/g, (m, i) => (Number(i) < vals.length ? String(vals[Number(i)]) : m));
  const at = key.indexOf(k);
  return key.slice(0, at) + filled + key.slice(at + k.length);
}

I18N.init();
