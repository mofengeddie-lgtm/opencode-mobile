// v1.9: miniaturas para Poki (1024×1024, sin texto ni bordes), sacadas del juego con una cámara baja.
// Uso: node faro/build.mjs && node faro/tools/poki/miniaturas.cjs  →  faro/docs/poki/miniatura-1.png y miniatura-2.png
// Poki pide: cuadrada de 628×628 o más, sin texto, sin bordes y que no se confunda con su fondo #83FFE7.
const { chromium } = require('playwright');
const path = require('path');
const FARO = path.resolve(__dirname, '..', '..');
const OUT = path.join(FARO, 'docs', 'poki') + '/';
const SHOTS = [
  { name: 'miniatura-1', yaw: 0.6, pitch: 0.55, dist: 9.5, look: [0, 0.6, 0], army: ['heavytank', 'tank', 'tank', 'rifle', 'rifle', 'rifle', 'rocket', 'apache', 'fighter'], lvl: 3 },
  { name: 'miniatura-2', yaw: 2.3, pitch: 0.42, dist: 6.2, look: [0, 1.0, 0], army: ['heavytank', 'apache', 'apache', 'rifle', 'rifle'], lvl: 3, hero: 'heavytank' },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const S of SHOTS) {
    const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
    p.setDefaultTimeout(240000);
    await p.route('**/*', (r) => (r.request().url().startsWith('file:') || r.request().url().startsWith('data:') ? r.continue() : r.abort()));
    await p.goto('file://' + path.join(FARO, 'faro.html'));
    await p.waitForFunction(() => window.FARO && FARO.loaded, null, { polling: 200 });
    await p.evaluate((S) => {
      FARO.setQuality('high');
      FARO.opts = { mode: 'sandbox', mapKind: 'continent', difficulty: 'easy', seed: 77 };
      FARO.startGame();
      const g = FARO.game;
      const core = g.players[0].core;
      while (core.level < S.lvl) { core.upgrading = { level: core.level + 1, progress: 1 }; g.finishUpgrade(core); }
      const cells = g.freeCellsNear(core.cell, 'land', 0, 4).filter((c) => g.map.dist(g.cells[c], g.cells[core.cell]) >= 1);
      S.army.forEach((t, i) => { const u = g.addUnit(0, t, cells[i % cells.length]); if (u) { u.facing = S.yaw + Math.PI; } });
      if (S.hero) {
        const h = g.units.find((u) => u.type === S.hero);
        if (h) { h.x = core.x + Math.sin(S.yaw) * 2.6; h.z = core.z + Math.cos(S.yaw) * 2.6; h.facing = S.yaw; }
      }
      for (let i = 0; i < 30; i++) g.update(0.05);
      FARO.paused = true;
      // Cámara baja, mirando al Núcleo; sin interfaz.
      const r = FARO.renderer;
      r.updateCamera = function () {
        const c = core;
        const cp = Math.cos(S.pitch);
        this.camera.position.set(c.x + Math.sin(S.yaw) * cp * S.dist, Math.sin(S.pitch) * S.dist + S.look[1], c.z + Math.cos(S.yaw) * cp * S.dist);
        this.camera.lookAt(c.x + S.look[0], S.look[1], c.z + S.look[2]);
        this.camera.updateMatrixWorld();
        this.sun.position.set(c.x - 16, 34, c.z + 10);
        this.sun.target.position.set(c.x, 0, c.z);
      };
      const st = document.createElement('style');
      st.textContent = 'body > *:not(canvas):not(#c3d):not(#game) { visibility: hidden !important; } canvas { visibility: visible !important; } #minimap, #miniwrap, #miniwrap * { visibility: hidden !important; }';
      document.head.appendChild(st);
      document.querySelectorAll('.screen, #hud, #toasts, #fps, #armytag, #boot').forEach((e) => { e.style.visibility = 'hidden'; });
    }, S);
    await p.waitForTimeout(6000);
    const box = await p.evaluate(() => { const c = FARO.gl.domElement; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await p.screenshot({ path: OUT + S.name + '.png', clip: { x: box.x, y: box.y, width: Math.min(1024, box.w), height: Math.min(1024, box.h) } });
    console.log(S.name, JSON.stringify(box));
    await p.close();
  }
  await b.close();
})();
