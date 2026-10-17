/** Reproducible proof of the production pair-sphere dispatcher.
 * No source substitutions, fixture fusion groups, or renderer patches are used.
 *
 * node scripts/proof-authored-pairs.mjs /tmp/pair-body-production
 * node scripts/proof-authored-pairs.mjs /tmp/pair-body-production \
 *   --baseline /path/to/previous-production.bundle.mjs
 *
 * A baseline is optional and must export renderPixelScene, layoutScene, and
 * boundsOfBeing. The generated production.bundle.mjs can be frozen for reuse.
 * Requires the project's esbuild dependency and Python with Pillow.
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let output = '/tmp/pair-body-production', baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-authored-pairs.mjs [output-directory] [--baseline frozen-renderer.mjs]');
    process.exit(0);
  }
  if (args[i] === '--baseline') {
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--baseline needs a module path');
    baselineFile = path.resolve(args[++i]);
  } else if (!args[i].startsWith('--') && !outputGiven) {
    output = args[i]; outputGiven = true;
  } else throw new Error(`Unknown argument: ${args[i]}`);
}
const out = path.resolve(output);
fs.mkdirSync(out, { recursive: true });
const digest = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = {};
const entry = `
export { renderPixelScene, PW, PH } from './src/ui/pixel-scene';
export { layoutScene, layoutParts, boundsOfBeing } from './src/ui/pixel-scene-layout';
export { pairSpriteOf, pairSpriteBounds } from './src/ui/pixel-pair-sprites';
`;
const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'record-unmodified-production-sources', setup(builder) {
    builder.onLoad({ filter: /\.ts$/ }, file => {
      const contents = fs.readFileSync(file.path, 'utf8');
      sourceHashes[path.relative(root, file.path)] = digest(contents);
      return { contents, loader: 'ts', resolveDir: path.dirname(file.path) };
    });
  } }],
});
const productionBundle = result.outputFiles[0].text;
const loadBundle = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const current = await loadBundle(productionBundle);
const versions = [['current', current]];
let baseline;
if (baselineFile) {
  const source = fs.readFileSync(baselineFile, 'utf8');
  const api = await loadBundle(source);
  for (const key of ['renderPixelScene', 'layoutScene', 'boundsOfBeing'])
    assert.equal(typeof api[key], 'function', `Baseline is missing ${key}`);
  versions.unshift(['before', api]);
  baseline = { path: baselineFile, bundleHash: digest(source) };
}
fs.writeFileSync(path.join(out, 'production.bundle.mjs'), productionBundle);

const cases = [
  { id: 'metal-fire', name: 'Metal + Fogo', elements: ['metal', 'fogo'], main: true,
    note: ['Aço com espessura', 'Calor segue a junta'] },
  { id: 'fire-metal', name: 'Fogo + Metal', elements: ['fogo', 'metal'], main: false,
    note: ['Núcleo quente', 'Aço sustenta a borda'] },
  { id: 'water-ice', name: 'Água + Gelo', elements: ['agua', 'gelo'], main: true,
    note: ['Corrente conectada', 'Gelo em placas'] },
  { id: 'ice-water', name: 'Gelo + Água', elements: ['gelo', 'agua'], main: false,
    note: ['Casca congelada', 'Água nos intervalos'] },
  { id: 'shadow-ice', name: 'Sombra + Gelo', elements: ['sombra', 'gelo'], main: true,
    note: ['Sombra envolve a base', 'Cristal mantém seus planos'] },
  { id: 'ice-shadow', name: 'Gelo + Sombra', elements: ['gelo', 'sombra'], main: false,
    note: ['Cristal dominante', 'Sombra na dobra'] },
];
const makeBeing = elements => ({
  elements: [...elements], shapes: ['forma_esfera'], concepts: [], placement: 'front',
  projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, materialFusion: [],
});
const records = [];
const crop = [67, 23, 117, 74];
for (const fixture of cases) for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
  for (const [version, api] of versions) {
    const being = makeBeing(fixture.elements), appearance = { beings: [being], orbitCount: 0 };
    const unchanged = JSON.stringify(appearance);
    const scene = api.renderPixelScene(appearance, night, frame);
    const pose = api.layoutScene(appearance, frame).poses.get(being);
    const bounds = api.boundsOfBeing(being, pose);
    assert.equal(JSON.stringify(appearance), unchanged, 'Renderer mutated its appearance fixture');
    assert.equal(scene.pix.w, 180); assert.equal(scene.pix.h, 105);
    assert.ok(bounds.l >= crop[0] && bounds.t >= crop[1] && bounds.r < crop[2] && bounds.b < crop[3],
      `Crop clips conservative body bounds: ${fixture.id}, ${version}, frame ${frame}`);
    const theme = night ? 'night' : 'day';
    const file = `${fixture.id}-${theme}-${version}-${frame}.rgba`;
    fs.writeFileSync(path.join(out, file), scene.pix.data);
    records.push({ id: fixture.id, theme, version, frame, pose, bounds,
      hash: digest(scene.pix.data), fusionGroups: being.materialFusion,
      ...(version === 'current' ? { dispatcher: current.pairSpriteOf(being) } : {}) });
  }
}
for (const fixture of cases) for (const night of [false, true]) for (const [version, api] of versions) {
  const appearance = { beings: [makeBeing(fixture.elements)], orbitCount: 0 };
  assert.deepEqual(api.renderPixelScene(appearance, night, 8).pix.data,
    api.renderPixelScene(appearance, night, 0).pix.data, `${version}: frame 8 differs from frame 0`);
}
const composer = path.join(root, 'scripts/compose-authored-pairs.py');
const manifest = {
  description: 'Unmodified production renderer and authored pair-sphere dispatcher. Composition/coexistence fixtures only; no gameplay fusion groups are inferred or injected.',
  renderedAt: new Date().toISOString(), size: { width: 180, height: 105 }, crop,
  cases, records, sourceHashes, productionBundleHash: digest(productionBundle),
  proofScriptHash: digest(fs.readFileSync(fileURLToPath(import.meta.url))),
  composerScriptHash: digest(fs.readFileSync(composer)), baseline: baseline ?? null,
  animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
  checks: { appearanceUnchanged: true, eightFrameRepeat: true,
    conservativeBodyBoundsFitCrop: true, captures: records.length, sourceSubstitutions: 0 },
};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
const composition = spawnSync('python', [composer, out], { stdio: 'inherit' });
assert.equal(composition.status, 0, 'Proof composition failed');
console.log(JSON.stringify({ out, captures: records.length, comparedWithBaseline: !!baseline,
  sources: Object.keys(sourceHashes).length, checks: manifest.checks }));
