// O18 (v1.8): lo que ya existía en la v1.7 no cambia sus números (precio, vida, daño, alcance, velocidad…).
// Compara faro/src/js/00-config.js con el de la v1.7 (CONFIG17=<archivo>, por defecto el commit final de la v1.7 en git).
const fs = require('fs');
const vm = require('vm');
const { execSync } = require('child_process');
const load = (code) => { const c = {}; vm.createContext(c); vm.runInContext(code + ';globalThis.o={UNITS,BUILDINGS,MODES,DIFFICULTY,CAMPAIGN};', c); return c.o; };
const old = load(process.env.CONFIG17 ? fs.readFileSync(process.env.CONFIG17, 'utf8') : execSync('git show 89fe158:faro/src/js/00-config.js', { cwd: __dirname }).toString());
const cur = load(fs.readFileSync(__dirname + '/../src/js/00-config.js', 'utf8'));
// Cambios planeados en el PRD v1.8 (no son números de balance): nombres del catálogo, productores sumados, la marca de dron,
// la defensa de punto de la Fragata de escolta y los textos.
const PLANNED = new Set(['name', 'desc', 'produces', 'drone', 'pointDefense', 'fem']);
const diffs = [];
const cmp = (a, b, p) => {
  if (typeof a !== typeof b) return diffs.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
  if (a && typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (p.split('.').length === 2 && PLANNED.has(k)) continue;
      cmp(a[k], b[k], `${p}.${k}`);
    }
  } else if (a !== b) diffs.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
};
for (const g of ['UNITS', 'BUILDINGS']) for (const k of Object.keys(old[g])) cmp(old[g][k], cur[g][k], `${g}.${k}`);
for (const g of ['DIFFICULTY', 'CAMPAIGN']) cmp(old[g], cur[g], g);
for (const k of Object.keys(old.MODES)) cmp(old.MODES[k], cur.MODES[k], `MODES.${k}`);
const nU = Object.keys(old.UNITS).length;
const nB = Object.keys(old.BUILDINGS).length;
console.log(diffs.length ? `❌ ${diffs.length} diferencias:\n` + diffs.join('\n') : `✅ ${nU} tropas, ${nB} edificios, modos, dificultades y campaña de la v1.7: mismos números`);
fs.writeFileSync(__dirname + '/results-v18-numbers.json', JSON.stringify({ ok: diffs.length === 0, units: nU, buildings: nB, diffs }, null, 1));
