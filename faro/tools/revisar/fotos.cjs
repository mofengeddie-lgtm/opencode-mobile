// Abre el juego real en Chromium (Playwright) y guarda la miniatura 3D de cada tropa y edificio.
// Uso: node fotos.cjs <faro.html> <salida.json>
// Si existe THREE_DIR (carpeta node_modules/three), usa three.js local en vez de bajarlo de internet.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const game = path.resolve(process.argv[2] || '');
const out = process.argv[3];
if (!fs.existsSync(game) || !out) {
  console.error('[Revisar] ❌ Uso: node fotos.cjs <faro.html> <salida.json>');
  process.exit(2);
}
const THREE_DIR = process.env.THREE_DIR || '';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.setDefaultTimeout(180000);
  if (THREE_DIR && fs.existsSync(THREE_DIR)) {
    await page.route('**/three.min.js', (r) => r.fulfill({ path: THREE_DIR + '/build/three.min.js', contentType: 'application/javascript' }));
    await page.route('**/GLTFLoader.js', (r) => r.fulfill({ path: THREE_DIR + '/examples/js/loaders/GLTFLoader.js', contentType: 'application/javascript' }));
  }
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file://' + game);
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 240000 });
  const shots = await page.evaluate(async () => {
    const keys = [...Object.keys(UNITS), ...Object.keys(BUILDINGS)];
    const res = {};
    for (const k of keys) {
      try {
        res[k] = Thumbs.get(k, PLAYER_COLORS[0]) || null;
      } catch (e) {
        res[k] = null;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    return res;
  });
  await browser.close();
  const sha = crypto.createHash('sha1').update(fs.readFileSync(game)).digest('hex');
  fs.writeFileSync(out, JSON.stringify({ game, sha, at: new Date().toISOString(), errors: errs, shots }));
  console.log(`[Revisar] ✅ ${Object.values(shots).filter(Boolean).length} miniaturas del juego guardadas en ${out}`);
})().catch((e) => {
  console.error('[Revisar] ❌ No pude sacar las miniaturas:', e.message);
  process.exit(1);
});
