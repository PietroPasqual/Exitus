/**
 * Original material sampler and actual production-renderer evidence.
 * Run: node scripts/proof-material-signatures.mjs [output-directory]
 * Requires installed project esbuild and Python/Pillow for contact sheets/GIFs.
 * Sampler plates are intentionally labelled separately from production scenes.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] ?? '/tmp/material-signature-proof');
fs.mkdirSync(output, { recursive: true });
const sourceHashes = {};
const result = await build({ stdin: { contents: `
  export * from './src/ui/pixel-mixture-signatures';
  export * from './tests/fixtures/material-signature-pix';
  export { renderPixelScene } from './src/ui/pixel-scene';
  export { appearanceForScene, layoutScene } from './src/ui/pixel-scene-layout';
  export { spellSpriteOf } from './src/ui/pixel-spell-sprites';
`, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'capture-render-source', setup(build) {
    build.onLoad({ filter: /\.ts$/ }, args => {
      const contents = fs.readFileSync(args.path, 'utf8');
      sourceHashes[path.relative(root, args.path)] = createHash('sha256').update(contents).digest('hex');
      return { contents, loader: 'ts' };
    });
  } }]
});
const renderer = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const raw = path.join(output, 'rgba'); fs.mkdirSync(raw, { recursive: true });
const records = [];
for (const element of renderer.BODY_MATERIALS) for (const role of ['whole', 'primary', 'secondary']) {
  for (const diameter of [25, 11]) for (const grayscale of [false, true]) for (let frame = 0; frame < 8; frame++) {
    const proof = renderer.renderSignaturePix(element, frame, role, diameter, grayscale);
    const file = `plate-${element}-${role}-${diameter}-${grayscale}-${frame}.rgba`;
    fs.writeFileSync(path.join(raw, file), proof.pix.data);
    records.push({ type: 'isolated-sampler', element, role, diameter, grayscale, frame, file,
      width: proof.pix.w, height: proof.pix.h, pixels: proof.pixels, cues: proof.cues, bounds: proof.bounds });
  }
}
const being = elements => ({ elements, shapes: ['forma_esfera'], concepts: [], placement: 'front',
  projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false });
for (const element of renderer.BODY_MATERIALS) {
  const peer = element === 'metal' ? 'agua' : element === 'raio' ? 'natureza' : 'metal';
  for (const role of ['whole', 'primary', 'secondary']) for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
    const source = being(role === 'whole' ? [element] : role === 'primary' ? [element, peer] : [peer, element]);
    const ap = { beings: [source], orbitCount: 0 };
    const pix = renderer.renderPixelScene(ap, night, frame).pix;
    const transformed = renderer.appearanceForScene(ap), b = transformed.beings[0];
    const pose = renderer.layoutScene(transformed).poses.get(b);
    const file = `production-${element}-${role}-${night}-${frame}.rgba`;
    fs.writeFileSync(path.join(raw, file), pix.data);
    records.push({ type: 'production', element, peer, role, night, frame, file, width: pix.w, height: pix.h,
      center: { x: pose.x, y: pose.y }, sprite: renderer.spellSpriteOf(source) ?? 'generic-sphere' });
  }
}

const metadata = { generatedAt: new Date().toISOString(), sourceHashes, elements: renderer.BODY_MATERIALS,
  registry: renderer.MATERIAL_SIGNATURES,
  limits: ['Isolated plates validate the sampler only; their simple clipping regions are not the production allocator.',
    'Production pairs here use a single peer per material. They do not establish all 120 pairs, all modes, or full artistic acceptance.',
    'Compact 11px bodies intentionally simplify detail. Tiny regions do not establish individually legible sixteen-material rendering.'], records };
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(metadata, null, 2));
const composed = spawnSync('python', [path.join(root, 'scripts/compose-material-signature-proof.py'), output], { encoding: 'utf8' });
if (composed.status !== 0) { console.error(composed.stderr); process.exitCode = 1; }
else console.log(composed.stdout.trim());
console.log(JSON.stringify({ output, isolatedPlates: records.filter(r => r.type === 'isolated-sampler').length,
  productionScenes: records.filter(r => r.type === 'production').length }));
