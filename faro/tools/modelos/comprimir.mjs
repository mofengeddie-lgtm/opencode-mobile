// v1.9: comprime los modelos 3D con meshopt (EXT_meshopt_compression) SIN cuantizar: los vértices siguen en float,
// así la tarjeta gráfica no tiene que convertirlos (con cuantización, la carga pasaba de 7 s a 90 s en Chromium sin
// tarjeta gráfica). Sin pérdida: mismos triángulos y mismas posiciones. three.js r128 lo lee con su MeshoptDecoder.
// Uso (la primera vez instala las dependencias de esta carpeta):
//   cd faro/tools/modelos && npm install && node comprimir.mjs
// Lee faro/assets/models/*.glb y escribe faro/assets/models-min/*.glb y fuentes.json (huella de cada original:
// build.mjs usa la versión comprimida solo si el original no cambió). Medido en la v1.9: 2,44 MB → 2,00 MB.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const FARO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(FARO, 'assets', 'models');
const DST = path.join(FARO, 'assets', 'models-min');
const MAN = path.join(DST, 'fuentes.json');

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
fs.mkdirSync(DST, { recursive: true });
let man = {};
try { man = JSON.parse(fs.readFileSync(MAN, 'utf8')); } catch (err) { man = {}; }
const only = process.argv.slice(2);
const files = (only.length ? only : fs.readdirSync(SRC).filter((f) => f.endsWith('.glb'))).sort();
let before = 0;
let after = 0;
for (const f of files) {
  const src = path.join(SRC, f);
  const doc = await io.read(src);
  // Reordena para comprimir mejor; método QUANTIZE sin pasar por quantize(): los datos float se comprimen sin pérdida.
  await doc.transform(reorder({ encoder: MeshoptEncoder, target: 'size' }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(path.join(DST, f), doc);
  man[f] = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  before += fs.statSync(src).size;
  after += fs.statSync(path.join(DST, f)).size;
}
fs.writeFileSync(MAN, JSON.stringify(Object.fromEntries(Object.entries(man).sort()), null, 1));
console.log(`[Modelos] ${files.length} comprimidos: ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB`);
