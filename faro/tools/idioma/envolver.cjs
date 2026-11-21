// v1.9: envuelve los textos en español del código para poder traducirlos.
// Uso: node faro/tools/idioma/envolver.cjs [--aplicar] [archivo.js ...]
//   sin --aplicar: informe (cuántos textos envolvería y dónde, y qué constantes tienen textos de datos).
//   con --aplicar: reescribe los archivos de src/js: texto suelto → T('…'); texto con valores → L`…${x}…`;
//   dentro de HTML, solo las partes de texto (y title, aria-label, alt, placeholder).
// En español, T y L devuelven exactamente el mismo texto: el juego en español no cambia.
// Los textos de las constantes de arriba del archivo (datos: nombres, descripciones…) NO se envuelven:
// se traducen al arrancar con I18N.applyData (ver 005-i18n.js y 089-i18n-data.js).
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('./vendor/acorn.cjs');
const walk = require('./vendor/acorn-walk.cjs');

const FARO = path.resolve(__dirname, '..', '..');
const JS = path.join(FARO, 'src', 'js');
const SKIP_FILES = new Set(['005-i18n.js', '089-i18n-data.js', '045-save.js', '088-platform.js']);
const APPLY = process.argv.includes('--aplicar');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// ¿Es texto para el jugador (en español)? Se mira el texto sin etiquetas ni valores.
function isText(s) {
  const t = s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\{\d+\}/g, ' ').trim();
  if (!t || t.length < 2) return false;
  if (/^\[[A-Za-zÁ-ú]+\]/.test(t)) return false; // mensajes de consola «[Faro] …»
  if (/:\/\/|^data:|^#[0-9a-f]{3,8}$|rgba?\(|var\(--|^[.#[][\w-]|^\w+-\w+(-\w+)*$|[{}]|=>|\d+px\b|^[\w-]+:[\w-]+$|^\w+\/[\w+.-]+$|sans-serif|system-ui|translate\(|rotate\(|scale\(|^[\w-]+=["']|^[\w.{}-]+\.(txt|json|png|jpe?g|html|js)$/i.test(t)) return false;
  if (/[áéíóúñÁÉÍÓÚÑ¿¡ü]/.test(t)) return true;
  if (/[A-Za-z]{2,}[ ,.:;!?«»"()\-–—·/0-9%+×]+[A-Za-z]{2,}/.test(t)) return true;
  if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}[.!?…:]*$/.test(t)) return true;
  return false;
}

// Llamadas cuyos argumentos no son textos para el jugador.
const SKIP_CALLS = new Set(['addEventListener', 'removeEventListener', 'getElementById', '$', 'querySelector', 'querySelectorAll', 'closest',
  'matches', 'setItem', 'getItem', 'removeItem', 'add', 'remove', 'toggle', 'contains', 'getAttribute', 'hasAttribute', 'removeAttribute',
  'require', 'log', 'warn', 'error', 'info', 'debug', 'includes', 'indexOf', 'startsWith', 'endsWith', 'split', 'replace', 'test', 'match',
  'createElement', 'fetch', 'postMessage', 'Error', 'TypeError', 'RangeError', 'T', 'L', 'use', 'note', 'call', 'send', 'play', 'measure']);

function calleeName(c) {
  if (!c) return '';
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && !c.computed && c.property) return c.property.name;
  return '';
}

function inFunction(ancestors) {
  return ancestors.some((a) => a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression' || a.type === 'ArrowFunctionExpression');
}

// Contexto donde un texto es lógica (comparaciones, claves, selectores…), no algo que se muestra.
function skipContext(node, ancestors) {
  const parent = ancestors[ancestors.length - 2];
  if (!parent) return 'raíz';
  if (parent.type === 'Property' && parent.key === node) return 'clave';
  if (parent.type === 'MemberExpression' && parent.property === node) return 'propiedad';
  if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) return 'comparación';
  if (parent.type === 'SwitchCase' && parent.test === node) return 'case';
  if (parent.type === 'TaggedTemplateExpression') return 'etiquetada';
  if ((parent.type === 'CallExpression' || parent.type === 'NewExpression')) {
    const n = calleeName(parent.callee);
    if (n === 'setAttribute' && parent.arguments[0] === node) return 'atributo';
    if (SKIP_CALLS.has(n)) return 'llamada ' + n;
  }
  // Asignaciones a clases, estilos o atributos (className = 'a b c', style.transform = `…`).
  const NOT_TEXT_PROPS = new Set(['className', 'id', 'src', 'href', 'type', 'cssText', 'transform', 'background', 'font', 'width', 'height', 'display', 'left', 'top']);
  for (const a of ancestors) {
    if (a.type === 'AssignmentExpression' && a.left.type === 'MemberExpression' && !a.left.computed && NOT_TEXT_PROPS.has(a.left.property.name)) return 'asignación ' + a.left.property.name;
    if (a.type === 'AssignmentExpression' && a.left.type === 'MemberExpression' && a.left.object && a.left.object.type === 'MemberExpression' && a.left.object.property && a.left.object.property.name === 'style') return 'estilo';
  }
  // console.x(...) en cualquier nivel.
  for (const a of ancestors) {
    if (a.type === 'CallExpression' && a.callee.type === 'MemberExpression' && a.callee.object && a.callee.object.name === 'console') return 'consola';
  }
  return '';
}

// Recorre un texto con HTML y devuelve los tramos de texto (fuera de etiquetas, o en atributos traducibles).
// pieces: [{type:'q', text, start}] y [{type:'e', start, end}] en orden. Devuelve tramos [{start, end, segs}].
const TR_ATTRS = new Set(['title', 'aria-label', 'alt', 'placeholder']);
function textRuns(pieces) {
  const runs = [];
  let cur = null;
  let state = 'text';
  let quote = '';
  let attrName = '';
  let attrBuf = '';
  const open = (pos) => { if (!cur) cur = { start: pos, end: pos, segs: [] }; };
  const close = () => { if (cur && cur.segs.length) runs.push(cur); cur = null; };
  for (const p of pieces) {
    if (p.type === 'e') {
      if (state === 'text' || state === 'tattr') {
        open(p.start);
        cur.segs.push({ type: 'e', start: p.start, end: p.end });
        cur.end = p.end;
      }
      continue;
    }
    const s = p.text;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const pos = p.start + i;
      if (state === 'text') {
        if (ch === '<' && /[A-Za-z/!]/.test(s[i + 1] || '')) { close(); state = 'tag'; attrBuf = ''; continue; }
        open(pos);
        const last = cur.segs[cur.segs.length - 1];
        if (last && last.type === 'q' && last.end === pos) { last.text += ch; last.end = pos + 1; } else cur.segs.push({ type: 'q', text: ch, start: pos, end: pos + 1 });
        cur.end = pos + 1;
      } else if (state === 'tag') {
        if (ch === '>') { state = 'text'; continue; }
        if (ch === '"' || ch === "'") {
          const m = /([\w-]+)\s*=\s*$/.exec(attrBuf);
          attrName = m ? m[1].toLowerCase() : '';
          quote = ch;
          state = TR_ATTRS.has(attrName) ? 'tattr' : 'attr';
          continue;
        }
        attrBuf += ch;
      } else if (state === 'attr') {
        if (ch === quote) { state = 'tag'; attrBuf = ''; }
      } else if (state === 'tattr') {
        if (ch === quote) { close(); state = 'tag'; attrBuf = ''; continue; }
        open(pos);
        const last = cur.segs[cur.segs.length - 1];
        if (last && last.type === 'q' && last.end === pos) { last.text += ch; last.end = pos + 1; } else cur.segs.push({ type: 'q', text: ch, start: pos, end: pos + 1 });
        cur.end = pos + 1;
      }
    }
  }
  close();
  // Recorta espacios de los bordes y se queda con los que tienen texto en español.
  const out = [];
  for (const r of runs) {
    const segs = r.segs;
    while (segs.length && segs[0].type === 'q' && !segs[0].text.trim()) segs.shift();
    while (segs.length && segs[segs.length - 1].type === 'q' && !segs[segs.length - 1].text.trim()) segs.pop();
    if (!segs.length) continue;
    const f = segs[0];
    if (f.type === 'q') { const lead = f.text.length - f.text.replace(/^\s+/, '').length; f.start += lead; f.text = f.text.slice(lead); }
    const l = segs[segs.length - 1];
    if (l.type === 'q') { const trail = l.text.length - l.text.replace(/\s+$/, '').length; l.end -= trail; l.text = l.text.slice(0, l.text.length - trail); }
    let n = 0;
    const key = segs.map((x) => (x.type === 'q' ? x.text : `{${n++}}`)).join('');
    if (!isText(key)) continue;
    out.push({ start: segs[0].start, end: segs[segs.length - 1].end, key });
  }
  return out;
}

function escTpl(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function analyze(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const edits = [];
  const data = {};
  const skipped = {};
  const lineOf = (pos) => src.slice(0, pos).split('\n').length;
  walk.ancestor(ast, {
    Literal(node, ancestors) {
      if (typeof node.value !== 'string') return;
      const v = node.value;
      const hasTags = /<[A-Za-z/][^>]*>/.test(v);
      if (!hasTags && !isText(v)) return;
      if (hasTags && !textRuns([{ type: 'q', text: v, start: 0 }]).length) return;
      if (!inFunction(ancestors)) {
        // Dato de arriba del archivo: se anota la propiedad que lo guarda.
        const parent = ancestors[ancestors.length - 2];
        const prop = parent && parent.type === 'Property' && parent.value === node ? (parent.key.name || parent.key.value) : (parent && parent.type === 'ArrayExpression' ? '[]' : parent ? parent.type : '?');
        data[prop] = (data[prop] || 0) + 1;
        return;
      }
      const why = skipContext(node, ancestors);
      if (why) { skipped[why] = (skipped[why] || 0) + 1; return; }
      if (!hasTags) {
        edits.push({ start: node.start, end: node.end, text: `T(${src.slice(node.start, node.end)})`, key: v.trim(), line: lineOf(node.start) });
      } else {
        // Texto con HTML entre comillas: pasa a plantilla con las partes de texto envueltas.
        const runs = textRuns([{ type: 'q', text: v, start: 0 }]);
        let out = '';
        let at = 0;
        for (const r of runs) {
          out += escTpl(v.slice(at, r.start)) + '${L`' + escTpl(v.slice(r.start, r.end)) + '`}';
          at = r.end;
        }
        out += escTpl(v.slice(at));
        edits.push({ start: node.start, end: node.end, text: '`' + out + '`', key: runs.map((r) => r.key).join(' | '), line: lineOf(node.start) });
      }
    },
    TemplateLiteral(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent && parent.type === 'TaggedTemplateExpression') return;
      const pieces = [];
      node.quasis.forEach((q, i) => {
        pieces.push({ type: 'q', text: q.value.raw, start: q.start });
        if (i < node.expressions.length) pieces.push({ type: 'e', start: q.end, end: node.quasis[i + 1].start });
      });
      const runs = textRuns(pieces);
      if (!runs.length) return;
      if (!inFunction(ancestors)) {
        data['`plantilla`'] = (data['`plantilla`'] || 0) + 1;
        return;
      }
      const why = skipContext(node, ancestors);
      if (why) { skipped[why] = (skipped[why] || 0) + 1; return; }
      const inner = { start: node.start + 1, end: node.end - 1 };
      if (runs.length === 1 && runs[0].start === inner.start && runs[0].end === inner.end) {
        edits.push({ start: node.start, end: node.start, text: 'L', key: runs[0].key, line: lineOf(node.start) });
        return;
      }
      for (const r of runs) {
        edits.push({ start: r.start, end: r.end, text: '${L`' + src.slice(r.start, r.end) + '`}', key: r.key, line: lineOf(r.start) });
      }
    },
  });
  return { src, edits, data, skipped };
}

// Aplica sin encimar: primero los de adentro; los de afuera se hacen en la vuelta siguiente.
function applyEdits(src, edits) {
  const sorted = edits.slice().sort((a, b) => (a.end - a.start) - (b.end - b.start));
  const taken = [];
  for (const e of sorted) {
    const overlap = taken.some((t) => (e.start < t.end && t.start < e.end) || (e.start === e.end && e.start > t.start && e.start < t.end)
      || (t.start === t.end && t.start > e.start && t.start < e.end));
    if (!overlap) taken.push(e);
  }
  taken.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of taken) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { out, n: taken.length };
}

module.exports = { isText, textRuns, analyze };
if (require.main !== module) return;
const files = (only.length ? only : fs.readdirSync(JS).filter((f) => f.endsWith('.js') && !SKIP_FILES.has(f)).sort()).map((f) => (path.isAbsolute(f) ? f : path.join(JS, f)));
let total = 0;
for (const f of files) {
  let { src, edits, data, skipped } = analyze(f);
  if (!APPLY) {
    total += edits.length;
    console.log(`${path.basename(f).padEnd(18)} ${String(edits.length).padStart(4)} para envolver · datos arriba: ${JSON.stringify(data)} · saltados: ${JSON.stringify(skipped)}`);
    if (process.argv.includes('--ver')) for (const e of edits) console.log(`   ${e.line}: ${e.key.slice(0, 110)}`);
    continue;
  }
  let rounds = 0;
  let done = 0;
  while (edits.length && rounds < 8) {
    const r = applyEdits(src, edits);
    src = r.out;
    done += r.n;
    acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); // que siga siendo JS válido
    fs.writeFileSync(f, src);
    ({ edits } = analyze(f));
    rounds++;
  }
  total += done;
  console.log(`${path.basename(f).padEnd(18)} ${done} envueltos en ${rounds} vueltas${edits.length ? ` · quedan ${edits.length}` : ''}`);
}
console.log(APPLY ? `✅ ${total} textos envueltos` : `ℹ️ ${total} textos para envolver`);
