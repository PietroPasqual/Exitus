/** Reproducible second-pair proof through the unmodified production dispatcher.
 * The historical filename is retained; no study dispatcher/source replacement exists.
 *
 * node scripts/proof-next-pair-studies.mjs output --baseline frozen-renderer.mjs
 * node scripts/proof-next-pair-studies.mjs output --current-only
 * Optional: --accepted-study folder-with-original-rgba-captures
 *
 * The frozen baseline must export renderPixelScene, layoutScene and boundsOfBeing.
 * Current-only mode makes no before/after or unchanged-control claims.
 */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let output = '/tmp/expanded-pair-production', baselineFile, acceptedStudyDirectory, currentOnly = false, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-next-pair-studies.mjs [output-directory] (--baseline frozen-renderer.mjs | --current-only) [--accepted-study capture-directory]');
    process.exit(0);
  }
  if (args[i] === '--baseline') {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), '--baseline needs a frozen module path');
    assert.ok(!baselineFile, 'Pass only one baseline');
    baselineFile = path.resolve(args[++i]);
  } else if (args[i] === '--accepted-study') {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), '--accepted-study needs a capture directory');
    acceptedStudyDirectory = path.resolve(args[++i]);
  } else if (args[i] === '--current-only') currentOnly = true;
  else if (!args[i].startsWith('--') && !outputGiven) {
    output = args[i]; outputGiven = true;
  } else throw new Error(`Unknown argument: ${args[i]}`);
}
assert.ok(Boolean(baselineFile) !== currentOnly,
  'Choose an explicit frozen --baseline path or --current-only; current production is never treated as "before".');
const out = path.resolve(output), productionFile = path.join(out, 'production.bundle.mjs');
assert.notEqual(baselineFile, productionFile, 'The output production bundle cannot also be the frozen baseline');
const hash = value => createHash('sha256').update(value).digest('hex');
const snapshotSources = directory => Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const file = path.join(directory, item.name);
  return item.isDirectory() ? Object.entries(snapshotSources(file))
    : item.name.endsWith('.ts') ? [[path.relative(root, file), hash(fs.readFileSync(file))]] : [];
}));
const sourcesBefore = snapshotSources(path.join(root, 'src'));
const frozenSource = baselineFile ? fs.readFileSync(baselineFile, 'utf8') : undefined;
fs.mkdirSync(out, { recursive: true });
// No esbuild onLoad hook, source rewriting, or dispatcher substitution.
const result = await build({
  stdin: { contents: `
    export { renderPixelScene, PW, PH } from './src/ui/pixel-scene';
    export { layoutScene, boundsOfBeing } from './src/ui/pixel-scene-layout';
    export { pairSpriteOf } from './src/ui/pixel-pair-sprites';
  `, resolveDir: root, loader: 'ts' },
  absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
});
const productionSource = result.outputFiles[0].text;
const sourceHashes = Object.fromEntries(Object.keys(result.metafile.inputs).filter(file => file !== '<stdin>').sort().map(file => {
  const relative = path.relative(root, path.resolve(root, file));
  const digest = hash(fs.readFileSync(path.resolve(root, file)));
  if (relative in sourcesBefore) assert.equal(digest, sourcesBefore[relative], `Source changed during compilation: ${relative}`);
  return [relative, digest];
}));
fs.writeFileSync(productionFile, productionSource);
const current = await import(pathToFileURL(productionFile).href);
const versions = [['current', current]];
let baseline = null;
if (frozenSource !== undefined) {
  const copiedBaseline = path.join(out, 'baseline.bundle.mjs');
  // A frozen baseline is copied byte-for-byte so the proof directory is self-contained.
  fs.writeFileSync(copiedBaseline, frozenSource);
  const api = await import(pathToFileURL(copiedBaseline).href);
  for (const key of ['renderPixelScene', 'layoutScene', 'boundsOfBeing'])
    assert.equal(typeof api[key], 'function', `Baseline is missing ${key}`);
  assert.notEqual(hash(frozenSource), hash(productionSource), 'The frozen baseline is identical to current production');
  versions.unshift(['before', api]);
  baseline = { suppliedPath: baselineFile, file: 'baseline.bundle.mjs', bundleHash: hash(frozenSource) };
}
const cases = [
  { id: 'lightning-metal', label: 'Raio + Metal', elements: ['raio', 'metal'], kind: 'lightning-metal' },
  { id: 'metal-lightning', label: 'Metal + Raio', elements: ['metal', 'raio'], kind: 'lightning-metal' },
  { id: 'water-metal', label: 'Água + Metal', elements: ['agua', 'metal'], kind: 'water-metal' },
  { id: 'metal-water', label: 'Metal + Água', elements: ['metal', 'agua'], kind: 'water-metal' },
  { id: 'fire-earth', label: 'Fogo + Terra', elements: ['fogo', 'terra'], kind: 'fire-earth' },
  { id: 'earth-fire', label: 'Terra + Fogo', elements: ['terra', 'fogo'], kind: 'fire-earth' },
];
const makeBeing = (elements, overrides = {}) => ({
  elements: [...elements], shapes: ['forma_esfera'], concepts: [], placement: 'front',
  projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, materialFusion: [], ...overrides,
});
const makeAppearance = being => ({ beings: [being], orbitCount: 0 });
const crop = [65, 19, 120, 77], size = { width: 180, height: 105 };
const records = [], controlRecords = [], acceptedStudyRecords = [];
let unchangedInputs = 0, wrapChecks = 0, boundsChecks = 0;
function renderChecked(api, appearance, night, frame, label, fitCrop = false) {
  const snapshot = JSON.stringify(appearance), being = appearance.beings[0];
  const scene = api.renderPixelScene(appearance, night, frame);
  const pose = api.layoutScene(appearance, frame).poses.get(being);
  assert.ok(pose, `${label}: missing production pose`);
  const bounds = api.boundsOfBeing(being, pose);
  assert.equal(JSON.stringify(appearance), snapshot, `${label}: renderer/layout mutated the input`);
  unchangedInputs++;
  assert.equal(scene.pix.w, size.width); assert.equal(scene.pix.h, size.height);
  assert.equal(scene.pix.data.length, size.width * size.height * 4);
  assert.ok(Object.values(bounds).every(Number.isFinite), `${label}: non-finite bounds`);
  assert.ok(bounds.l >= 0 && bounds.r < size.width && bounds.t >= 0 && bounds.b < size.height,
    `${label}: conservative body bounds leave the scene`);
  if (fitCrop) assert.ok(bounds.l >= crop[0] && bounds.t >= crop[1] && bounds.r < crop[2] && bounds.b < crop[3],
    `${label}: comparison crop clips conservative body bounds`);
  boundsChecks++;
  return { scene, pose, bounds };
}
for (const fixture of cases) {
  const being = makeBeing(fixture.elements);
  assert.deepEqual(current.pairSpriteOf(being), { kind: fixture.kind, primary: fixture.elements[0] },
    `${fixture.id}: not selected by the real production dispatcher`);
  if (baseline && typeof versions[0][1].pairSpriteOf === 'function')
    assert.equal(versions[0][1].pairSpriteOf(being), undefined, `${fixture.id}: supplied baseline already selects this new pair`);
  for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) for (const [version, api] of versions) {
    const appearance = makeAppearance(makeBeing(fixture.elements));
    const label = `${fixture.id}/${night ? 'night' : 'day'}/${version}/${frame}`;
    const { scene, pose, bounds } = renderChecked(api, appearance, night, frame, label, true);
    const wrapped = renderChecked(api, appearance, night, frame + 8, `${label}+8`, true);
    assert.deepEqual(wrapped.scene.pix.data, scene.pix.data, `${label}: eight-frame wrap changes pixels`);
    assert.deepEqual(wrapped.pose, pose, `${label}: eight-frame wrap changes layout`);
    wrapChecks++;
    const theme = night ? 'night' : 'day', file = `${fixture.id}-${theme}-${version}-${frame}.rgba`;
    fs.writeFileSync(path.join(out, file), scene.pix.data);
    if (acceptedStudyDirectory) {
      const referenceVersion = version === 'current' ? 'study' : 'before';
      const referenceFile = `${fixture.id}-${theme}-${referenceVersion}-${frame}.rgba`;
      const reference = fs.readFileSync(path.join(acceptedStudyDirectory, referenceFile));
      assert.equal(Buffer.compare(Buffer.from(scene.pix.data), reference), 0,
        `${label}: differs from accepted-study capture ${referenceFile}`);
      acceptedStudyRecords.push({ file, referenceFile, referenceHash: hash(reference) });
    }
    records.push({ id: fixture.id, theme, version, frame, file, pose, bounds, hash: hash(scene.pix.data),
      fusionGroups: appearance.beings[0].materialFusion,
      ...(version === 'current' ? { dispatcher: current.pairSpriteOf(appearance.beings[0]) } : {}) });
  }
}
// New routing must not consume pure bodies, non-spheres, multipart forms,
// glyphs, dragons, triples, or change any previously accepted authored pair.
const controls = ['raio', 'metal', 'agua', 'fogo', 'terra'].map(element => ({
  id: `pure-${element}`, category: 'pure', being: makeBeing([element]), expected: undefined,
}));
for (const [kind, a, b] of [['fire-metal', 'fogo', 'metal'], ['water-ice', 'agua', 'gelo'], ['shadow-ice', 'sombra', 'gelo']])
  for (const elements of [[a, b], [b, a]]) controls.push({
    id: `accepted-${elements.join('-')}`, category: 'previously-accepted', being: makeBeing(elements),
    expected: { kind, primary: elements[0] },
  });
for (const fixture of cases) for (const [category, overrides] of [
  ['cube', { shapes: ['forma_cubo'] }],
  ['multipart', { shapes: ['forma_esfera', 'forma_cubo'] }],
  ['glyph', { intentGlyph: 'CURA' }],
  ['dragon', { intentForm: 'dragao' }],
  ['triple', { elements: [...fixture.elements, 'gelo'] }],
]) controls.push({ id: `${category}-${fixture.id}`, category,
  being: makeBeing(fixture.elements, overrides), expected: undefined });
for (const fixture of controls) {
  assert.deepEqual(current.pairSpriteOf(fixture.being), fixture.expected, `${fixture.id}: routing exclusion changed`);
  for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
    const appearance = makeAppearance(structuredClone(fixture.being)), pixels = [];
    const record = { id: fixture.id, category: fixture.category, theme: night ? 'night' : 'day', frame, hashes: {} };
    for (const [version, api] of versions) {
      const label = `control/${fixture.id}/${record.theme}/${version}/${frame}`;
      const { scene } = renderChecked(api, appearance, night, frame, label);
      const wrapped = renderChecked(api, appearance, night, frame + 8, `${label}+8`);
      assert.deepEqual(wrapped.scene.pix.data, scene.pix.data, `${label}: eight-frame wrap changes pixels`);
      wrapChecks++;
      pixels.push(scene.pix.data); record.hashes[version] = hash(scene.pix.data);
    }
    if (baseline) assert.deepEqual(pixels[0], pixels[1], `Out-of-scope pixels changed: ${fixture.id}/${record.theme}/${frame}`);
    controlRecords.push(record);
  }
}
for (const [file, digest] of Object.entries(sourceHashes))
  assert.equal(hash(fs.readFileSync(path.join(root, file))), digest, `Source changed while the proof ran: ${file}`);
const composer = path.join(root, 'scripts/compose-next-pair-studies.py');
const manifest = {
  description: 'Unmodified production renderer and real pair-sphere dispatcher. Composition/coexistence only; no gameplay fusion is inferred or injected.',
  mode: baseline ? 'frozen-baseline-comparison' : 'current-only', renderedAt: new Date().toISOString(),
  size, crop, cases, records, controls: controlRecords, sourceHashes,
  productionBundleHash: hash(productionSource), baseline,
  acceptedStudy: acceptedStudyDirectory ? { path: acceptedStudyDirectory,
    note: 'Historical study pixels are a reference only; the new renderer has no study source substitution.',
    manifestHash: hash(fs.readFileSync(path.join(acceptedStudyDirectory, 'manifest.json'))),
    captures: acceptedStudyRecords } : null,
  proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
  animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
  checks: {
    captures: records.length, sourceSubstitutions: 0, productionDispatchCases: cases.length,
    appearanceUnchanged: true, unchangedInputChecks: unchangedInputs, eightFrameRepeat: true, eightFrameWrapChecks: wrapChecks,
    conservativeBodyBoundsFitScene: true, conservativeMainBodyBoundsFitCrop: true, boundsChecks,
    controlFixtures: controls.length,
    controlCategories: Object.fromEntries([...new Set(controls.map(c => c.category))].map(category => [category, controls.filter(c => c.category === category).length])),
    outOfScopeSceneChecks: controlRecords.length,
    baselineControlComparisons: baseline ? controlRecords.length : 0,
    outOfScopeByteIdenticalToBaseline: baseline ? true : null,
    acceptedStudyComparisons: acceptedStudyRecords.length,
    acceptedStudyByteIdentical: acceptedStudyDirectory ? true : null,
  },
};
assert.equal(records.length, baseline ? 192 : 96);
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
const composed = spawnSync('python', [composer, out], { stdio: 'inherit' });
assert.equal(composed.status, 0, 'Proof composition failed');
console.log(JSON.stringify({ out, mode: manifest.mode, checks: manifest.checks }, null, 2));
