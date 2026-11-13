// Ayudas para correr las pruebas de v0.1-v0.4 en la v0.5 (vestíbulo nuevo y sin tropas iniciales).
const SP = __dirname;
async function routes(page) {
  await page.route('**/GLTFLoader.js', (r) => r.fulfill({ path: SP + '/three/node_modules/three/examples/js/loaders/GLTFLoader.js', contentType: 'application/javascript' }));
}
// Después de cargar: setOption y tropas de la v0.4 (Ingeniero + 2 Fusileros) para las pruebas viejas.
async function compat(page) {
  await page.waitForFunction(() => window.FARO && window.FARO.loaded, null, { timeout: 30000 });
  await page.evaluate(() => {
    const a = window.FARO;
    a.setOption = (k, v) => { a.opts[k] = v; delete a.opts.custom; if (k === 'mode' || k === 'mapKind') a.makePreview(); };
    const orig = a.startGame.bind(a);
    a.startGame = () => {
      orig();
      if (a.__legacy === false) return;
      const g = a.game;
      for (const p of g.players) {
        const spawn = g.freeCellsNear(g.map.homes[p.id], 'land', p.id, 3);
        g.addUnit(p.id, 'engineer', spawn[0]);
        g.addUnit(p.id, 'rifle', spawn[1]);
        g.addUnit(p.id, 'rifle', spawn[2]);
      }
    };
  });
}
async function start(page, mode = 'ffa', mapKind) {
  await compat(page);
  await page.evaluate(([m, k]) => { const a = window.FARO; a.setOption('mode', m); if (k) a.setOption('mapKind', k); a.startGame(); }, [mode, mapKind]);
}
module.exports = { routes, compat, start };
