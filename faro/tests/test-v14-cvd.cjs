// K10 (parte de colores): ¿se distinguen los 6 colores de jugador con daltonismo?
// Simulación de Machado, Oliveira y Fernandes (2009), severidad 1, y diferencia de color CIEDE2000.
const ctx = require('./sim.cjs');
const vm = require('vm');
const fs = require('fs');
const BASE = vm.runInContext('BASE_COLORS', ctx);
const CVD = vm.runInContext('CVD_COLORS', ctx);
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(lin);
const sim = (v, m) => (m ? m.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2]))) : v);
const lab = ([r, g, b]) => {
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  [x, y, z] = [f(x), f(y), f(z)];
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
function de2000(a, b) {
  const [L1, a1, b1] = a; const [L2, a2, b2] = b;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1); const C2 = Math.hypot(a2, b2); const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G); const a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1); const C2p = Math.hypot(a2p, b2);
  const h = (x, y) => { if (!x && !y) return 0; const v = Math.atan2(y, x) / rad; return v < 0 ? v + 360 : v; };
  const h1 = h(a1p, b1); const h2 = h(a2p, b2);
  const dL = L2 - L1; const dC = C2p - C1p;
  let dh = 0;
  if (C1p * C2p) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2; const Cpm = (C1p + C2p) / 2;
  let hm = h1 + h2;
  if (C1p * C2p) { if (Math.abs(h1 - h2) > 180) hm += h1 + h2 < 360 ? 360 : -360; hm /= 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTh = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cpm; const SH = 1 + 0.015 * Cpm * T;
  const RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}
const worst = (pal, kind) => {
  const L = pal.map((c) => lab(sim(rgb(c), M[kind])));
  let min = Infinity; let pair = '';
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const d = de2000(L[i], L[j]); if (d < min) { min = d; pair = `${i}-${j}`; } }
  return { min: +min.toFixed(1), pair };
};
const NAMES = vm.runInContext('BASE_NAMES', ctx);
const CN = vm.runInContext('CVD_NAMES', ctx);
const out = {};
for (const kind of ['normal', 'protan', 'deutan', 'tritan']) out[kind] = { base: worst(BASE, kind), cvd: worst(CVD, kind) };
const label = { normal: 'visión normal', protan: 'protanopía', deutan: 'deuteranopía', tritan: 'tritanopía' };
const pairName = (p, names) => p.split('-').map((i) => names[i]).join(' y ');
const okAll = ['protan', 'deutan', 'tritan'].every((k) => out[k].cvd.min >= 15 && out[k].cvd.min > out[k].base.min);
const ev = Object.entries(out).map(([k, v]) => `${label[k]}: colores de siempre, el par más parecido es ${pairName(v.base.pair, NAMES)} (diferencia ${v.base.min}); colores para daltonismo, ${pairName(v.cvd.pair, CN)} (${v.cvd.min})`).join('; ');
console.log(okAll ? 'OK  ' : 'FAIL', 'K10cvd', ev);
fs.writeFileSync(__dirname + '/results-v14-cvd.json', JSON.stringify([{ id: 'K10cvd', ok: okAll, ev: ev + ' (diferencia CIEDE2000; 15 o más se distingue bien a simple vista)' }], null, 1));
