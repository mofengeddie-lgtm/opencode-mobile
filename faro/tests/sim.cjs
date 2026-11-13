// Ejecuta la lógica del juego (sin gráficos) en Node para probar a los bots.
const fs = require('fs');
const vm = require('vm');
const dir = process.env.FARO_JS || '/home/user/opencode-mobile/faro/src/js/';
const files = ['00-config.js', '01-util.js', '02-map.js', '04-world.js', '046-campaign.js', '05-ai.js'];
const code = files.map((f) => fs.readFileSync(dir + f, 'utf8')).join('\n') +
  '\n;globalThis.Game=Game;globalThis.Campaign=Campaign;globalThis.CAMPAIGN=CAMPAIGN;globalThis.Bot=Bot;globalThis.BUILDINGS=BUILDINGS;globalThis.UNITS=UNITS;globalThis.PERSONALITIES=(typeof PERSONALITIES!=="undefined"?PERSONALITIES:{});globalThis.TERRAIN=TERRAIN;globalThis.DOME_LEVELS=(typeof DOME_LEVELS!=="undefined"?DOME_LEVELS:null);';
const ctx = { console, performance, Math: Object.assign(Object.create(Math), { random: Math.random }), JSON, Set, Map, Array, Object, Number, String, Float32Array, Int32Array, Uint32Array, Uint8Array, Infinity, isFinite };
vm.createContext(ctx);
vm.runInContext(code, ctx);
module.exports = ctx;

function summary(g) {
  return g.players.map((p) => {
    const b = {};
    g.buildings.filter((x) => x.owner === p.id).forEach((x) => { b[x.type] = (b[x.type] || 0) + 1; });
    const u = {};
    g.units.filter((x) => x.owner === p.id).forEach((x) => { u[x.type] = (u[x.type] || 0) + 1; });
    const bot = g.bots.find((bb) => bb.pid === p.id);
    const banks = bot ? ` eco${Math.round(bot.ecoBank)} mil${Math.round(bot.milBank)}` : '';
    return `${p.name}${p.alive ? '' : ' (muerto)'} coins${Math.round(p.coins)} inc${p.income} pop${p.popUsed}/${p.popCap}${banks} ${JSON.stringify(b)} ${JSON.stringify(u)}`;
  });
}

if (require.main === module) {
  const [mode = 'ffa', mapKind = 'archipelago', difficulty = 'normal', mins = '15', seed = '12345', every = '2'] = process.argv.slice(2);
  const g = new ctx.Game({ mode, mapKind, difficulty, fog: false, turbo: false, seed: Number(seed) });
  const steps = Number(mins) * 600;
  const t0 = Date.now();
  for (let i = 0; i < steps; i++) {
    g.update(0.1);
    if (i % (Number(every) * 600) === 0 || i === steps - 1) {
      console.log(`t=${Math.round(g.time)}s`);
      summary(g).forEach((l) => console.log('  ' + l));
    }
    if (g.over) {
      console.log('FIN', g.result, Math.round(g.time) + 's');
      summary(g).forEach((l) => console.log('  ' + l));
      break;
    }
  }
  console.log('ms', Date.now() - t0);
}
