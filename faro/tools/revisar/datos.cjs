// Lee el archivo real del juego (faro.html) y escribe sus datos en JSON: tropas, edificios, pestañas y modelos 3D.
// Uso: node datos.cjs <faro.html>
// Toma solo la parte «00-config.js» del juego (datos puros, sin gráficos) y la ejecuta aparte en Node.
const fs = require('fs');
const vm = require('vm');

const file = process.argv[2];
if (!file) {
  console.error('[Revisar] ❌ Falta la ruta de faro.html');
  process.exit(2);
}
const html = fs.readFileSync(file, 'utf8');
const start = html.indexOf('// ---- 00-config.js ----');
if (start < 0) {
  console.error('[Revisar] ❌ No encontré la sección 00-config.js dentro de', file);
  process.exit(2);
}
const end = html.indexOf('\n// ---- ', start + 10);
const config = html.slice(start, end);
const ctx = { console, Math, JSON, Object, Array, Set, Map, Number, String, Infinity };
vm.createContext(ctx);
vm.runInContext(config + '\n;globalThis.__out = { GAME_VERSION, UNITS, BUILDINGS, BUILD_TABS };', ctx);
const { GAME_VERSION, UNITS, BUILDINGS, BUILD_TABS } = ctx.__out;

// Modelos 3D incrustados: claves del objeto FARO_GLB.
const glbAt = html.indexOf('const FARO_GLB = ');
const glbLine = glbAt >= 0 ? html.slice(glbAt, html.indexOf('\n', glbAt)) : '';
const models = [...glbLine.matchAll(/"([A-Za-z0-9_@]+)":"/g)].map((m) => m[1]);

const producersOf = (key) => Object.entries(BUILDINGS).filter(([, b]) => (b.produces || []).includes(key)).map(([k]) => k);
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const units = {};
for (const [k, u] of Object.entries(UNITS)) {
  units[k] = Object.assign(pick(u, ['name', 'cls', 'mover', 'cost', 'energy', 'hp', 'speed', 'pop', 'build', 'vision', 'limit', 'cap', 'strategic', 'stealth', 'desc']), {
    weapon: u.weapon ? pick(u.weapon, ['dmg', 'cd', 'range', 'proj', 'salvo', 'splash']) : null,
    producers: producersOf(k),
  });
}
const buildings = {};
for (const [k, b] of Object.entries(BUILDINGS)) {
  const tab = (BUILD_TABS.find((t) => t.items.includes(k)) || {}).name || null;
  // «energy» de un edificio es lo que cuesta en energía (energyCost); lo que produce va en «energyRate».
  buildings[k] = Object.assign(pick(b, ['name', 'cat', 'cost', 'hp', 'build', 'limit', 'income', 'vision', 'claim', 'detect', 'desc', 'produces', 'strategic']), {
    energy: b.energyCost || 0, energyRate: b.energy || 0,
    tab, weapon: b.weapon ? pick(b.weapon, ['dmg', 'cd', 'range', 'proj']) : null,
  });
}
const out = { file, size: html.length, version: GAME_VERSION, units, buildings, tabs: BUILD_TABS, models };
process.stdout.write(JSON.stringify(out));
