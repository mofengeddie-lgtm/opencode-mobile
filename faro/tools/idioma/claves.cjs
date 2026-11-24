// v1.9: revisor de idioma (parte 1): junta todas las claves que hay que traducir y las compara con el diccionario.
// Uso: node faro/tools/idioma/claves.cjs [--faltan] [--json]
//   código: T$('…') y L$`…` en src/js; datos: las tablas de 089-i18n-data.js; HTML fijo de la plantilla.
//   Escribe tools/idioma/salida/claves.json y dice cuántas faltan en src/i18n/en.json (y cuáles sobran).
// Los datos y el HTML se leen abriendo el juego armado (faro.html) en Chromium, en español.
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('./vendor/acorn.cjs');
const walk = require('./vendor/acorn-walk.cjs');

const FARO = path.resolve(__dirname, '..', '..');
const JS = path.join(FARO, 'src', 'js');
const OUT = path.join(__dirname, 'salida');

function codeKeys() {
  const keys = new Map();
  for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js')).sort()) {
    const src = fs.readFileSync(path.join(JS, f), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
    const add = (k, node) => {
      k = k.trim();
      if (!k) return;
      if (!keys.has(k)) keys.set(k, []);
      keys.get(k).push(`${f}:${node.loc.start.line}`);
    };
    walk.simple(ast, {
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'T$' && node.arguments[0] && node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') add(node.arguments[0].value, node);
      },
      TaggedTemplateExpression(node) {
        if (node.tag.type !== 'Identifier' || node.tag.name !== 'L$') return;
        const q = node.quasi.quasis;
        let k = q[0].value.cooked;
        for (let i = 1; i < q.length; i++) k += `{${i - 1}}` + q[i].value.cooked;
        add(k, node);
      },
    });
  }
  return keys;
}

async function pageKeys() {
  const { chromium } = require('playwright');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'language', { get: () => 'es-ES' });
    Object.defineProperty(navigator, 'languages', { get: () => ['es-ES'] });
  });
  await p.route('**/*', (r) => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
  await p.goto('file://' + path.join(FARO, 'faro.html'));
  // Las tablas y el HTML se leen apenas cargan los scripts (antes de que el juego cambie el HTML).
  await p.waitForFunction(() => typeof i18nTables === 'function' && window.FARO, null, { timeout: 240000 });
  const out = await p.evaluate(() => {
    const data = new Set();
    const isText = (t) => /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t);
    const walkObj = (o, seen, all) => {
      if (!o || typeof o !== 'object' || seen.has(o)) return;
      seen.add(o);
      const keys = Array.isArray(o) ? o.map((x, i) => i) : Object.keys(o);
      for (const k of keys) {
        const v = o[k];
        const text = all || (!Array.isArray(o) && I18N.TEXT_PROPS.has(k));
        if (typeof v === 'string') { if (text && isText(v)) data.add(v.trim()); } else if (v && typeof v === 'object') walkObj(v, seen, text);
      }
    };
    const t = i18nTables();
    for (const o of Object.values(t.objects)) walkObj(o, new Set(), false);
    for (const l of Object.values(t.lists)) for (const v of l) if (typeof v === 'string' && isText(v)) data.add(v.trim());
    for (const m of Object.values(t.maps)) for (const v of Object.values(m)) if (typeof v === 'string' && isText(v)) data.add(v.trim());
    for (const l of Object.values(t.pairs)) for (const pr of l) if (isText(pr[1])) data.add(pr[1].trim());
    return { data: [...data] };
  });
  await b.close();
  return out;
}

// HTML fijo de la plantilla (como lo ve I18N.applyStatic: cada texto entre etiquetas y los atributos de texto).
function staticKeys() {
  let h = fs.readFileSync(path.join(FARO, 'src', 'index.template.html'), 'utf8');
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const dec = (t) => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
  const out = new Set();
  for (const part of h.split(/<[^>]*>/)) {
    const t = dec(part).replace(/\s+/g, ' ').trim();
    if (t && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) out.add(t);
  }
  for (const m of h.matchAll(/\s(?:title|aria-label|placeholder|alt)="([^"]*)"/g)) {
    const t = dec(m[1]).replace(/\s+/g, ' ').trim();
    if (t && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) out.add(t);
  }
  return [...out];
}

(async () => {
  const code = codeKeys();
  const { data } = await pageKeys();
  const stat = staticKeys();
  const dict = JSON.parse(fs.readFileSync(path.join(FARO, 'src', 'i18n', 'en.json'), 'utf8'));
  const all = new Map();
  for (const [k, where] of code) all.set(k, { src: 'código', where });
  for (const k of data) if (!all.has(k)) all.set(k, { src: 'datos', where: [] });
  for (const k of stat) if (!all.has(k)) all.set(k, { src: 'html', where: [] });
  // Textos que no se traducen (nombres propios del juego, símbolos, idiomas).
  const KEEP = new Set(['Faro de Ámbar', 'Español', 'English', 'Idioma · Language', 'AIR DEFENSE', 'DF-17', 'DF-5C']);
  const missing = [...all.keys()].filter((k) => !(k in dict) && !KEEP.has(k));
  const unused = Object.keys(dict).filter((k) => !all.has(k));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'claves.json'), JSON.stringify({ total: all.size, code: code.size, data: data.length, html: stat.length, missing, unused,
    keys: Object.fromEntries([...all].map(([k, v]) => [k, v])) }, null, 1));
  console.log(`[Idioma] claves: ${all.size} (código ${code.size}, datos ${data.length}, HTML ${stat.length}) · en el diccionario: ${all.size - missing.length} · faltan: ${missing.length} · sobran: ${unused.length}`);
  if (process.argv.includes('--faltan')) for (const k of missing) console.log('  - ' + k.slice(0, 140) + '   ← ' + all.get(k).src + ' ' + (all.get(k).where[0] || ''));
  process.exitCode = missing.length ? 1 : 0;
})();
