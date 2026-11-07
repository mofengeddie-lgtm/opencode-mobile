// Une la plantilla HTML y los scripts de src/js en un único archivo jugable.
// Uso: node hexbox/build.mjs [ruta-extra-sin-envoltorio.html]
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(ROOT, 'src', 'js');

const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => `// ---- ${f} ----\n${readFileSync(join(JS_DIR, f), 'utf8')}`).join('\n');
const template = readFileSync(join(ROOT, 'src', 'index.template.html'), 'utf8');
if (!template.includes('/*__SCRIPTS__*/')) throw new Error('Falta el marcador /*__SCRIPTS__*/ en la plantilla');
// Función de reemplazo para que los "$" del código no se interpreten como patrones.
const body = template.replace('/*__SCRIPTS__*/', () => js);

const full = [
  '<!doctype html>',
  '<html lang="es">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">',
  body,
  '</html>',
  '',
].join('\n');

writeFileSync(join(ROOT, 'hexbox.html'), full);
console.log(`[HEXBOX] hexbox.html listo (${(full.length / 1024).toFixed(0)} KB, ${files.length} scripts)`);

const extra = process.argv[2];
if (extra) {
  writeFileSync(extra, body);
  console.log(`[HEXBOX] Versión sin envoltorio: ${extra}`);
}
