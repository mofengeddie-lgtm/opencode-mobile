// Une la plantilla HTML y los scripts de src/js en un único archivo jugable.
// Uso: node faro/build.mjs [--poki] [ruta-extra-sin-envoltorio.html]
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(ROOT, 'src', 'js');

const files = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
// Modelos 3D hechos con Blender (faro/blender/generate_models.py), incrustados en base64.
const MODEL_DIR = join(ROOT, 'assets', 'models');
// v1.9: si hay versión comprimida (assets/models-min, hecha con tools/modelos/comprimir.cjs) del mismo modelo
// (misma huella sha256 en models-min/fuentes.json), se usa esa (meshopt: un tercio menos de peso; se ve igual).
const MIN_DIR = process.env.FARO_MIN_DIR || join(ROOT, 'assets', 'models-min');
let models = {};
let minCount = 0;
// Huella (sha256) de cada modelo original en el momento de comprimirlo.
let minSources = {};
try { minSources = JSON.parse(readFileSync(join(MIN_DIR, 'fuentes.json'), 'utf8')); } catch (err) { minSources = {}; }
try {
  for (const f of readdirSync(MODEL_DIR).filter((x) => x.endsWith('.glb')).sort()) {
    let src = join(MODEL_DIR, f);
    const m = join(MIN_DIR, f);
    const same = !process.env.FARO_NO_MIN && existsSync(m) && minSources[f] === createHash('sha256').update(readFileSync(src)).digest('hex');
    if (same) { src = m; minCount++; }
    else if (existsSync(m)) console.warn(`[Faro] ${f}: el modelo cambió después de comprimirlo; se usa el original (vuelve a correr tools/modelos/comprimir.cjs)`);
    models[f.replace(/\.glb$/, '')] = readFileSync(src).toString('base64');
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
// Ciclos de caminar y correr sacados de la captura de movimiento de CMU (blender/cmu_gait.py).
let anim = null;
try {
  anim = JSON.parse(readFileSync(join(ROOT, 'assets', 'anim', 'cmu_gait.json'), 'utf8'));
} catch (err) {
  console.warn('[Faro] Sin animaciones de CMU:', err.message);
}
// v1.9: diccionarios de idiomas (src/i18n/<idioma>.json: clave = texto en español, valor = traducción).
const I18N_DIR = join(ROOT, 'src', 'i18n');
const dicts = {};
for (const f of readdirSync(I18N_DIR).filter((x) => x.endsWith('.json'))) dicts[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(I18N_DIR, f), 'utf8'));
const i18nJs = `const FARO_I18N = ${JSON.stringify(dicts)};\n`;
const modelJs = `// ---- modelos GLB (Blender) ----\nconst FARO_GLB = ${JSON.stringify(models)};\nconst FARO_ENV = ${JSON.stringify(envUri)};\n` +
  `const FARO_ANIM = ${JSON.stringify(anim)};\n`;
// v1.9: librerías y fuentes dentro del archivo (Poki no deja pedir nada a otros sitios).
const VENDOR = join(ROOT, 'vendor');
const vendorJs = ['three.r128.min.js', 'GLTFLoader.r128.js', 'meshopt_decoder.r128.js'].map((f) => `// ---- vendor/${f} ----\n${readFileSync(join(VENDOR, f), 'utf8')}`).join('\n');
const FONTS = [['Barlow', 400, 'barlow-latin-400-normal'], ['Barlow', 500, 'barlow-latin-500-normal'], ['Barlow', 600, 'barlow-latin-600-normal'],
  ['Chakra Petch', 500, 'chakra-petch-latin-500-normal'], ['Chakra Petch', 600, 'chakra-petch-latin-600-normal'], ['Chakra Petch', 700, 'chakra-petch-latin-700-normal']];
const fontCss = FONTS.map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;` +
  `src:url(data:font/woff2;base64,${readFileSync(join(VENDOR, 'fonts', f + '.woff2')).toString('base64')}) format('woff2');}`).join('');
// --poki: versión para Poki (faro/poki/index.html): script del SDK de Poki y sin zona de creadores.
const POKI = process.argv.includes('--poki');
const platformJs = `const FARO_PLATFORM = ${JSON.stringify(POKI ? 'poki' : 'web')};\n`;
const js = modelJs + platformJs + i18nJs + files.map((f) => `// ---- ${f} ----\n${readFileSync(join(JS_DIR, f), 'utf8')}`).join('\n');
const template = readFileSync(join(ROOT, 'src', 'index.template.html'), 'utf8');
if (!template.includes('/*__SCRIPTS__*/')) throw new Error('Falta el marcador /*__SCRIPTS__*/ en la plantilla');
// Función de reemplazo para que los "$" del código no se interpreten como patrones.
let body = template.replace('/*__SCRIPTS__*/', () => js).replace('/*__VENDOR__*/', () => vendorJs).replace('/*__FONTS__*/', () => fontCss);
if (POKI) body = body.replace('<title>', () => '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>\n<title>');

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

// FARO_OUT permite construir en otro archivo (para probar una versión sin tocar la publicada).
const OUT = process.env.FARO_OUT || (POKI ? join(ROOT, 'poki', 'index.html') : join(ROOT, 'faro.html'));
if (POKI) mkdirSync(join(ROOT, 'poki'), { recursive: true });
writeFileSync(OUT, full);
console.log(`[Faro] ${OUT.split('/').pop()} listo (${(full.length / 1024).toFixed(0)} KB, ${files.length} scripts, ${Object.keys(models).length} modelos, ${minCount} comprimidos)`);

const extra = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (extra) {
  writeFileSync(extra, body);
  console.log(`[Faro] Versión sin envoltorio: ${extra}`);
}
