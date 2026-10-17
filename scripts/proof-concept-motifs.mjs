/** Byte-exact Pix evidence: node scripts/proof-concept-motifs.mjs [output-directory]. */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] ?? '/tmp/concept-motif-proof');
const baseline = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
fs.mkdirSync(path.join(output, 'rgba'), { recursive: true });
const sourceHashes = {};
const bundle = await build({ stdin: { resolveDir: root, contents: `
  export { Pix, rgb } from './src/ui/pixel';
  export * from './src/ui/pixel-concept-fx';
  export { renderPixelScene } from './src/ui/pixel-scene';
  export { layoutScene } from './src/ui/pixel-scene-layout';
` }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'capture-proof-source', setup(build) {
    build.onLoad({ filter: /\.ts$/ }, args => {
      const contents = fs.readFileSync(args.path, 'utf8');
      sourceHashes[path.relative(root, args.path)] = createHash('sha256').update(contents).digest('hex');
      return { contents, loader: 'ts' };
    });
  } }] });
const painter = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const gray = ['#202a36', '#4a5969', '#78899a', '#a9bac9', '#e3edf5'].map(painter.rgb);
const colors = {
  tempo: ['#6b3d00', '#a65f00', '#f59f00', '#ffd43b', '#fff9db'],
  movimento: ['#074a57', '#0b7285', '#15aabf', '#66d9e8', '#e3fafc'],
  pressao: ['#18286b', '#253c9c', '#4263eb', '#91a7ff', '#e7f0ff'],
  caos: ['#6b0f2f', '#a61e4d', '#e64980', '#faa2c1', '#fff0f6'],
  infinito: ['#2a1670', '#4325a8', '#7950f2', '#b197fc', '#f3f0ff'],
  vazio: ['#080b13', '#161b2b', '#303953', '#505e79', '#b4c3d9'],
  vida: ['#1e5e2a', '#2b8a3e', '#51cf66', '#8ce99a', '#ebfbee'],
  morte: ['#121417', '#2b2f33', '#495057', '#868e96', '#dee2e6']
};
const records = [];
const save = (pix, data) => {
  const file = `${records.length}.rgba`;
  fs.writeFileSync(path.join(output, 'rgba', file), pix.data);
  records.push({ ...data, width: pix.w, height: pix.h, file });
};
for (const concept of painter.CONCEPT_MOTIFS) for (let frame = 0; frame < 8; frame++) {
  for (const samePalette of [false, true]) for (const glow of [false, true]) {
    const pix = new painter.Pix(56, 56);
    painter.paintConceptAura(pix, concept, 27.5, 27.5, 16, samePalette ? gray : colors[concept].map(painter.rgb), { frame, glow });
    save(pix, { type: 'isolated-painter', concept, frame, samePalette, glow });
  }
  for (const body of [false, true]) for (const night of [false, true]) {
    const being = { elements: body ? ['agua'] : [], shapes: body ? ['forma_esfera'] : [], concepts: [concept],
      placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false };
    const appearance = { beings: [being], orbitCount: 0 }, pose = painter.layoutScene(appearance).poses.get(being);
    const pix = painter.renderPixelScene(appearance, night, frame).pix;
    save(pix, { type: 'actual-production', concept, frame, body, night, center: { x: pose.x, y: pose.y } });
  }
}
for (const concept of painter.CONCEPT_MOTIFS) for (const form of ['dragon', 'cube', 'lance']) for (let frame = 0; frame < 8; frame++) for (const night of [false, true]) {
  const being = { elements: form === 'lance' ? ['fogo'] : ['agua'], shapes: form === 'cube' ? ['forma_cubo'] : [], concepts: [concept],
    ...(form === 'dragon' ? { intentForm: 'dragao' } : form === 'lance' ? { intentForm: 'lanca' } : {}), placement: 'front', projectile: false, orbit: false,
    direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false };
  const appearance = { beings: [being], orbitCount: 0 }, pose = painter.layoutScene(appearance).poses.get(being);
  save(painter.renderPixelScene(appearance, night, frame).pix,
    { type: 'actual-shaped-production', concept, form, frame, night, center: { x: pose.x, y: pose.y } });
}
for (const group of [['pressao', 'vida'], ['tempo', 'movimento', 'caos', 'infinito']]) for (const form of ['sphere', 'lance']) for (let frame = 0; frame < 8; frame++) for (const night of [false, true]) {
  const being = { elements: form === 'lance' ? ['fogo'] : ['agua'], shapes: form === 'sphere' ? ['forma_esfera'] : [], concepts: group,
    ...(form === 'lance' ? { intentForm: 'lanca' } : {}), placement: 'front', projectile: false, orbit: false,
    direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false };
  const appearance = { beings: [being], orbitCount: 0 }, pose = painter.layoutScene(appearance).poses.get(being);
  save(painter.renderPixelScene(appearance, night, frame).pix,
    { type: 'actual-crowded-production', group: group.join('+'), form, frame, night, center: { x: pose.x, y: pose.y } });
}
const productionIntegrated = fs.readFileSync(path.join(root, 'src/ui/pixel-scene.ts'), 'utf8').includes("from './pixel-concept-fx'");
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), productionIntegrated,
  ...(baseline ? { comparisonBaseline: baseline,
    baselineGifSha256: createHash('sha256').update(fs.readFileSync(path.join(baseline, 'production-8fps.gif'))).digest('hex'),
    baselineSourceHashes: JSON.parse(fs.readFileSync(path.join(baseline, 'manifest.json'), 'utf8')).sourceHashes } : {}),
  sourceHashes, concepts: painter.CONCEPT_MOTIFS, records,
  limitations: ['Isolated painter proves the signature geometry only. Production sheets use the actual renderer.',
    'Production fixtures cover concept-only, shaped water spheres, dragon/cube/fire-lance and two/four concept stacks at every phase; not every mixture or arrangement.',
    'Eight frames are illustration timing; they do not establish duration or alter rules.'] }, null, 2));
const compose = spawnSync('python', [path.join(root, 'scripts/compose-concept-motif-proof.py'), output, ...(baseline ? [baseline] : [])], { encoding: 'utf8' });
if (compose.status !== 0) throw new Error(compose.stderr);
console.log(compose.stdout.trim());
console.log(JSON.stringify({ output, captures: records.length, productionIntegrated }));
