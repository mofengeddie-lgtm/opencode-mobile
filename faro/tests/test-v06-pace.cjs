// C01-C03 del PRD v0.6: Constructor inicial y ritmo de ataque de los bots.
const ctx = require('./sim.cjs');
const results = [];
const check = (id, name, ok, ev = '') => { results.push({ id, name, ok: !!ok, ev }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name} ${ev}`); };
// C01
{
  const rows = [];
  for (const mode of ['duel', 'ffa', 'conquest', 'teams', 'tutorial']) {
    const g = new ctx.Game({ mode, mapKind: mode === 'tutorial' ? 'continent' : 'archipelago', difficulty: 'normal', seed: 7 });
    for (const p of g.players) {
      const b = g.buildings.filter((x) => x.owner === p.id).map((x) => x.type).sort().join(',');
      const u = g.units.filter((x) => x.owner === p.id).map((x) => x.type).join(',');
      rows.push({ ok: b === 'core,farm' && u === 'builder', b, u });
    }
  }
  check('C01', 'cada imperio empieza con Núcleo, 1 Granja y 1 Constructor (sin soldados)', rows.every((r) => r.ok),
    `${rows.filter((r) => r.ok).length}/${rows.length} imperios en 5 modos (Duelo, Todos contra todos, Conquista, Equipos y Tutorial): edificios «core,farm», tropas «builder»`);
}
function pace(difficulty) {
  const firsts = []; let attackers = 0; let bots = 0; let errors = 0;
  for (const mapKind of ['archipelago', 'open', 'continent', 'bay', 'reef']) {
    for (const seed of [11, 22]) {
      let a = seed * 2654435761 >>> 0;
      ctx.Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const g = new ctx.Game({ mode: 'ffa', mapKind, difficulty, fog: false, turbo: false, seed });
      g.players[0].core.maxHp = g.players[0].core.hp = 1e9;
      try { for (let i = 0; i < 9000 && !g.over; i++) g.update(0.1); } catch (e) { errors++; }
      for (const b of g.bots) {
        bots++;
        const t = Math.min(b.firstWaveAt > 0 ? b.firstWaveAt : Infinity, b.firstRaidAt !== undefined ? b.firstRaidAt : Infinity);
        if (Number.isFinite(t)) { attackers++; firsts.push(t); }
      }
    }
  }
  firsts.sort((x, y) => x - y);
  return { pct: Math.round((attackers / bots) * 100), bots, med: firsts.length ? Math.round(firsts[Math.floor(firsts.length / 2)]) : Infinity, errors };
}
const normal = pace('normal');
check('C02', 'Normal: 80 % o más de los bots ataca un Núcleo y la primera oleada sale (mediana) a los 7 min o antes',
  normal.pct >= 80 && normal.med <= 420 && normal.errors === 0, `${normal.pct} % de ${normal.bots} bots atacan (v0.5: 57 %); primera oleada a los ${normal.med} s (${(normal.med / 60).toFixed(1)} min); errores ${normal.errors}`);
const easy = pace('easy');
const hard = pace('hard');
check('C03', 'Difícil ataca antes que Normal y Normal antes que Fácil', hard.med < normal.med && normal.med < easy.med && easy.errors + hard.errors === 0,
  `primera oleada (mediana): Difícil ${hard.med} s, Normal ${normal.med} s, Fácil ${easy.med} s; atacan ${hard.pct} % / ${normal.pct} % / ${easy.pct} %`);
require('fs').writeFileSync(__dirname + '/results-v06-pace.json', JSON.stringify(results, null, 1));
