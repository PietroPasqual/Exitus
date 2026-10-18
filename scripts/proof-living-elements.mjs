/** Reproduce the four pure-element revisions through the real production routes.
 * node scripts/proof-living-elements.mjs output --baseline frozen-renderer.mjs
 * A baseline is mandatory: this script never recompiles current code as "before".
 * Raw RGBA and generated bundles are temporary; only PNG/GIF/JSON proofs remain.
 */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let output = path.join(root, 'docs/visuals/living-elements'), baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-living-elements.mjs [output] --baseline frozen-renderer.mjs');
    process.exit(0);
  }
  if (args[i] === '--baseline') {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), '--baseline requires a frozen renderer file');
    assert.ok(!baselineFile, 'Pass only one baseline');
    baselineFile = path.resolve(args[++i]);
  } else if (!args[i].startsWith('--') && !outputGiven) {
    output = args[i]; outputGiven = true;
  } else throw new Error(`Unknown argument: ${args[i]}`);
}
assert.ok(baselineFile, 'An explicit frozen --baseline is required; current code is never used as the prior version.');
const out = path.resolve(output), hash = value => createHash('sha256').update(value).digest('hex');
const frozenSource = fs.readFileSync(baselineFile);
const baseline = await import(pathToFileURL(baselineFile).href);
for (const key of ['renderPixelScene', 'appearanceForScene', 'layoutScene', 'boundsOfBeing', 'spellSpriteOf'])
  assert.equal(typeof baseline[key], 'function', `Frozen baseline lacks ${key}`);
const sourceSnapshot = directory => Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const file = path.join(directory, item.name);
  return item.isDirectory() ? Object.entries(sourceSnapshot(file))
    : item.name.endsWith('.ts') ? [[path.relative(root, file), hash(fs.readFileSync(file))]] : [];
}));
const originalHashes = sourceSnapshot(path.join(root, 'src'));
// Bundle the actual production renderer. No dispatcher substitutes or onLoad rewrites.
const buildResult = await build({ stdin: { contents: `
  export {renderPixelScene,PW,PH} from './src/ui/pixel-scene';
  export {appearanceForScene,layoutScene,boundsOfBeing} from './src/ui/pixel-scene-layout';
  export {spellSpriteOf} from './src/ui/pixel-spell-sprites';
  export {pairSpriteOf} from './src/ui/pixel-pair-sprites';
  export {modelOf} from './tests/helpers';
  export {analyzeFlow} from './src/core/flow';
  export {describeAppearance} from './src/core/appearance';
`, resolveDir: root, loader: 'ts' }, absWorkingDir: root,
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true });
const productionSource = buildResult.outputFiles[0].text;
assert.notEqual(hash(productionSource), hash(frozenSource), 'Frozen baseline matches the current bundle');
const current = await import('data:text/javascript;base64,' + Buffer.from(productionSource).toString('base64'));
const sourceHashes = Object.fromEntries(Object.keys(buildResult.metafile.inputs).filter(file => file !== '<stdin>').sort().map(file => {
  const relative = path.relative(root, path.resolve(root, file)), digest = hash(fs.readFileSync(path.resolve(root, file)));
  if (relative in originalHashes) assert.equal(digest, originalHashes[relative], `Source changed during build: ${relative}`);
  return [relative, digest];
}));
fs.mkdirSync(out, { recursive: true });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'living-elements-proof-'));
const size = { width: 180, height: 105 }, crop = [64, 17, 122, 79];
const elements = [
  { element: 'vento', sprite: 'wind-sphere', label: 'Vento' },
  { element: 'natureza', sprite: 'nature-sphere', label: 'Natureza' },
  { element: 'sombra', sprite: 'shadow-sphere', label: 'Sombra' },
  { element: 'luz', sprite: 'light-sphere', label: 'Luz' }
];
const make = (element, patch = {}) => ({ elements: [element], shapes: ['forma_esfera'], concepts: [],
  placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, ...patch });
const appearance = beings => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const scenarios = [
  { id: 'hero', label: 'Corpo principal', make: e => appearance([make(e)]) },
  { id: 'flight', label: 'Lançamento', make: e => appearance([make(e, { placement: 'flight', projectile: true, direction: 'forward' })]) },
  { id: 'return', label: 'Retorno', make: e => appearance([make(e, { placement: 'self', direction: 'back' })]) },
  { id: 'copies', label: '6 manifestações', make: e => appearance([make(e, { intentCount: '6' })]) },
  { id: 'orbitals', label: '8 órbitas', make: e => appearance(Array.from({ length: 8 }, () => make(e, { orbit: true }))) },
  { id: 'concepts', label: 'Tempo + Vida', make: e => appearance([make(e, { concepts: ['tempo', 'vida'], estado: true, guards: ['lateral'] })]) }
];
const cases = scenarios.flatMap(scenario => elements.map(element => ({
  id: `${element.element}-${scenario.id}`, element: element.element, sprite: element.sprite,
  scenario: scenario.id, label: element.label, scenarioLabel: scenario.label,
  appearance: scenario.make(element.element)
})));
const records = [], controls = [];
let immutableChecks = 0, boundsChecks = 0, wrapChecks = 0, borderChecks = 0;
const emptyBorders = new Map();
const border = pix => {
  const values = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++)
    if (x === 0 || y === 0 || x === pix.w - 1 || y === pix.h - 1)
      values.push(...pix.data.subarray((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 4));
  return Buffer.from(values);
};
for (const night of [false, true]) emptyBorders.set(night, border(current.renderPixelScene(appearance([]), night, 0).pix));
function renderChecked(api, ap, night, frame, label, hero = false) {
  const before = JSON.stringify(ap), visual = api.appearanceForScene(ap), layout = api.layoutScene(visual, frame);
  const boxes = visual.beings.map(being => {
    const pose = layout.poses.get(being);
    assert.ok(pose, `${label}: missing production pose`);
    const box = api.boundsOfBeing(being, pose);
    assert.ok(Object.values(box).every(Number.isFinite), `${label}: invalid bounds`);
    assert.ok(box.l >= 2 && box.r <= 178 && box.t >= 2 && box.b <= 99.001, `${label}: body leaves scene`);
    if (hero) assert.ok(box.l >= crop[0] && box.r < crop[2] && box.t >= crop[1] && box.b < crop[3], `${label}: crop clips body`);
    boundsChecks++;
    return { pose, bounds: box };
  });
  const scene = api.renderPixelScene(ap, night, frame);
  assert.equal(JSON.stringify(ap), before, `${label}: input mutated`); immutableChecks++;
  assert.equal(scene.pix.w, size.width); assert.equal(scene.pix.h, size.height);
  assert.equal(scene.pix.data.length, size.width * size.height * 4);
  assert.equal(Buffer.compare(border(scene.pix), emptyBorders.get(night)), 0, `${label}: scene frame changed`); borderChecks++;
  return { scene, boxes };
}
try {
  for (const fixture of cases) {
    assert.equal(current.spellSpriteOf(fixture.appearance.beings[0]), fixture.sprite, `${fixture.id}: production route missing`);
    assert.equal(baseline.spellSpriteOf(fixture.appearance.beings[0]), undefined, `${fixture.id}: baseline already selects revision`);
    for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const hashes = {};
      for (const [version, api] of [['before', baseline], ['current', current]]) {
        const ap = structuredClone(fixture.appearance), theme = night ? 'night' : 'day';
        const label = `${fixture.id}/${theme}/${version}/${frame}`;
        const { scene, boxes } = renderChecked(api, ap, night, frame, label, fixture.scenario === 'hero');
        const file = `${fixture.id}-${theme}-${version}-${frame}.rgba`;
        fs.writeFileSync(path.join(scratch, file), scene.pix.data);
        hashes[version] = hash(scene.pix.data);
        records.push({ id: fixture.id, theme, version, frame, file, hash: hashes[version], boxes, labels: scene.labels });
        if (version === 'current') {
          const wrapped = api.renderPixelScene(ap, night, frame + 8);
          assert.equal(Buffer.compare(Buffer.from(scene.pix.data), Buffer.from(wrapped.pix.data)), 0, `${label}: loop does not wrap`);
          assert.deepEqual(scene.labels, wrapped.labels); wrapChecks++;
        }
      }
      assert.notEqual(hashes.before, hashes.current, `${fixture.id}: requested artwork did not change`);
    }
  }
  // Twelve accepted material dominances remain exact, including the sombra/gelo pair.
  const fixtures = [];
  for (const [a, b] of [['fogo', 'metal'], ['agua', 'gelo'], ['sombra', 'gelo'], ['raio', 'metal'], ['agua', 'metal'], ['fogo', 'terra']])
    for (const pair of [[a, b], [b, a]]) fixtures.push({ id: `pair-${pair.join('-')}`, category: 'accepted-pair', appearance: appearance([make(pair[0], { elements: pair })]) });
  for (const element of elements) for (const [category, patch] of [
    ['cube', { shapes: ['forma_cubo'] }], ['multipart', { shapes: ['forma_esfera', 'forma_cubo'] }],
    ['glyph', { intentGlyph: 'CURA' }], ['intention', { intentForm: 'espada' }],
    ['pair', { elements: [element.element, 'agua'] }], ['triple', { elements: [element.element, 'agua', 'raio'] }]
  ]) fixtures.push({ id: `${element.element}-${category}`, category: `new-element-${category}`, appearance: appearance([make(element.element, patch)]) });
  for (const element of ['fogo', 'agua', 'gelo', 'terra', 'metal', 'raio'])
    fixtures.push({ id: `pure-${element}`, category: 'existing-pure', appearance: appearance([make(element)]) });
  for (const [element, intentForm] of [['fogo', 'lanca'], ['agua', 'dragao'], ['raio', 'anel']])
    fixtures.push({ id: `${element}-${intentForm}`, category: 'existing-intention', appearance: appearance([make(element, { intentForm })]) });
  for (const pair of [['fogo', 'raio'], ['raio', 'fogo']]) fixtures.push({ id: `mixed-${pair.join('-')}`, category: 'existing-mixture', appearance: appearance([make(pair[0], { elements: pair })]) });
  const jet = current.modelOf('ex2');
  fixtures.push({ id: 'real-flamethrower-ex2', category: 'preset', appearance: current.describeAppearance(jet, current.analyzeFlow(jet)) });
  for (const fixture of fixtures) {
    for (const being of fixture.appearance.beings)
      assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${fixture.id}: excluded route changed`);
    for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const theme = night ? 'night' : 'day', hashes = {}, pixels = [];
      for (const [version, api] of [['before', baseline], ['current', current]]) {
        const { scene } = renderChecked(api, structuredClone(fixture.appearance), night, frame, `${fixture.id}/${theme}/${version}/${frame}`);
        pixels.push(Buffer.from(scene.pix.data)); hashes[version] = hash(scene.pix.data);
      }
      assert.equal(Buffer.compare(pixels[0], pixels[1]), 0, `Out-of-scope pixels changed: ${fixture.id}/${theme}/${frame}`);
      controls.push({ id: fixture.id, category: fixture.category, theme, frame, hashes });
    }
  }
  for (const [file, digest] of Object.entries(sourceHashes))
    assert.equal(hash(fs.readFileSync(path.join(root, file))), digest, `Source changed during proof: ${file}`);
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(frozenSource), 'Frozen baseline changed during proof');
  const composer = path.join(root, 'scripts/compose-living-elements.py');
  const manifest = {
    description: 'Four single-element sphere bodies through the unmodified production renderer. No rune, rule, palette or mixed-material revision.',
    mode: 'frozen-baseline-comparison', renderedAt: new Date().toISOString(), size, crop,
    baseline: { suppliedFile: path.basename(baselineFile), bundleHash: hash(frozenSource) },
    productionBundleHash: hash(productionSource), sourceHashes,
    proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
    animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
    cases, records, controls,
    checks: { sourceSubstitutions: 0, captures: records.length, inputImmutable: true, immutableChecks,
      conservativeBoundsFit: true, boundsChecks, frameBorderIntact: true, borderChecks,
      eightFrameWrap: true, wrapChecks, controlFixtures: fixtures.length,
      acceptedPairDominances: 12, controlSceneComparisons: controls.length, outOfScopeBytesIdentical: true }
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  const composed = spawnSync('python', [composer, out, scratch], { stdio: 'inherit' });
  assert.equal(composed.status, 0, 'Comparison composition failed');
  const artifacts = fs.readdirSync(out).filter(file => /\.(png|gif)$/.test(file)).sort();
  manifest.artifactHashes = Object.fromEntries(artifacts.map(file => [file, hash(fs.readFileSync(path.join(out, file)))]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  console.log(JSON.stringify({ out, baselineHash: manifest.baseline.bundleHash, checks: manifest.checks, artifacts }, null, 2));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
