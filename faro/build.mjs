// Une la plantilla HTML y los scripts de src/js en un único archivo jugable.
// Uso: node faro/build.mjs [ruta-extra-sin-envoltorio.html]
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(ROOT, 'src', 'js');

const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
// Modelos 3D hechos con Blender (faro/blender/generate_models.py), incrustados en base64.
const MODEL_DIR = join(ROOT, 'assets', 'models');
let models = {};
try {
  for (const f of readdirSync(MODEL_DIR).filter((x) => x.endsWith('.glb')).sort()) {
    models[f.replace(/\.glb$/, '')] = readFileSync(join(MODEL_DIR, f)).toString('base64');
  }
} catch (err) {
  console.warn('[Faro] Sin modelos GLB:', err.message);
  models = {};
}
// Cielo de Poly Haven (CC0, «Kloofendal 48d Partly Cloudy», Greg Zaal) reducido a 256×128 para la luz de ambiente.
let envUri = '';
try {
  envUri = 'data:image/jpeg;base64,' + readFileSync(join(ROOT, 'assets', 'env', 'sky_env.jpg')).toString('base64');
} catch (err) {
  console.warn('[Faro] Sin cielo de ambiente:', err.message);
}
const modelJs = `// ---- modelos GLB (Blender) ----\nconst FARO_GLB = ${JSON.stringify(models)};\nconst FARO_ENV = ${JSON.stringify(envUri)};\n`;
const js = modelJs + files.map((f) => `// ---- ${f} ----\n${readFileSync(join(JS_DIR, f), 'utf8')}`).join('\n');
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

writeFileSync(join(ROOT, 'faro.html'), full);
console.log(`[Faro] faro.html listo (${(full.length / 1024).toFixed(0)} KB, ${files.length} scripts, ${Object.keys(models).length} modelos)`);

const extra = process.argv[2];
if (extra) {
  writeFileSync(extra, body);
  console.log(`[Faro] Versión sin envoltorio: ${extra}`);
}
