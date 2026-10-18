/** Render element junctions through production, using an explicit frozen prior build.
 * node scripts/proof-element-junctions.mjs [output] --baseline frozen-renderer.mjs
 * Captures and bundles remain temporary; only the review PNG/GIF/manifest persist.
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
let output = path.join(root, 'docs/visuals/element-junctions'), baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-element-junctions.mjs [output] --baseline frozen-renderer.mjs');
    process.exit(0);
  }
  if (args[i] === '--baseline') {
    assert.ok(args[i + 1] && !args[i + 1].startsWith('--'), '--baseline requires a frozen renderer');
    assert.ok(!baselineFile, 'Pass only one baseline');
    baselineFile = path.resolve(args[++i]);
  } else if (!args[i].startsWith('--') && !outputGiven) {
    output = args[i]; outputGiven = true;
  } else throw new Error(`Unknown argument: ${args[i]}`);
}
assert.ok(baselineFile, 'An explicit frozen --baseline is required. Current sources are never used as the prior version.');
const out = path.resolve(output), hash = value => createHash('sha256').update(value).digest('hex');
const frozenSource = fs.readFileSync(baselineFile);
const baseline = await import(pathToFileURL(baselineFile).href);
for (const key of ['renderPixelScene', 'appearanceForScene', 'layoutScene', 'boundsOfBeing', 'spellSpriteOf', 'pairSpriteOf'])
  assert.equal(typeof baseline[key], 'function', `Frozen baseline lacks ${key}`);
const sourceSnapshot = directory => Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
  const file = path.join(directory, item.name);
  return item.isDirectory() ? Object.entries(sourceSnapshot(file))
    : item.name.endsWith('.ts') ? [[path.relative(root, file), hash(fs.readFileSync(file))]] : [];
}));
const originalHashes = sourceSnapshot(path.join(root, 'src'));
// This is the unmodified production entry point. No onLoad rewrites or routing substitutes.
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
assert.notEqual(hash(productionSource), hash(frozenSource), 'Frozen baseline equals the current bundle');
const current = await import('data:text/javascript;base64,' + Buffer.from(productionSource).toString('base64'));
const sourceHashes = Object.fromEntries(Object.keys(buildResult.metafile.inputs).filter(file => file !== '<stdin>').sort().map(file => {
  const relative = path.relative(root, path.resolve(root, file)), digest = hash(fs.readFileSync(path.resolve(root, file)));
  if (relative in originalHashes) assert.equal(digest, originalHashes[relative], `Source changed during build: ${relative}`);
  return [relative, digest];
}));
const make = (elements, patch = {}) => ({ elements, shapes: ['forma_esfera'], concepts: [],
  placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, ...patch });
const appearance = beings => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const pairDefinitions = [
  { elements: ['fogo', 'metal'], label: 'Fogo + Metal' },
  { elements: ['agua', 'gelo'], label: 'Água + Gelo' },
  { elements: ['sombra', 'gelo'], label: 'Sombra + Gelo' },
  { elements: ['raio', 'metal'], label: 'Raio + Metal' },
  { elements: ['agua', 'metal'], label: 'Água + Metal' },
  { elements: ['fogo', 'terra'], label: 'Fogo + Terra' }
];
const generalDefinitions = [
  { elements: ['agua', 'raio'], label: 'Água + Raio' },
  { elements: ['fogo', 'vento'], label: 'Fogo + Vento' },
  { elements: ['natureza', 'agua'], label: 'Natureza + Água' },
  { elements: ['luz', 'sombra'], label: 'Luz + Sombra' }
];
const heroes = pairDefinitions.flatMap(pair => [pair.elements, [...pair.elements].reverse()].map(elements => ({
  id: elements.join('-'), group: 'authored', label: pair.label, primary: elements[0],
  appearance: appearance([make(elements)])
}))).concat(generalDefinitions.map(pair => ({
  id: pair.elements.join('-'), group: 'general', label: pair.label, primary: pair.elements[0],
  appearance: appearance([make(pair.elements)])
})));
const context = (id, label, elements, patch) => ({ id, label, group: 'context', appearance: appearance([make(elements, patch)]) });
const contexts = [
  context('fire-metal-flight', 'Fogo + Metal · lançamento', ['fogo', 'metal'], { placement: 'flight', projectile: true, direction: 'forward' }),
  context('lightning-metal-return', 'Raio + Metal · retorno', ['raio', 'metal'], { placement: 'self', direction: 'back' }),
  context('water-ice-copies', 'Água + Gelo · seis manifestações', ['agua', 'gelo'], { intentCount: '6' }),
  { id: 'shadow-ice-orbits', label: 'Sombra + Gelo · oito órbitas', group: 'context',
    appearance: appearance(Array.from({ length: 8 }, () => make(['sombra', 'gelo'], { orbit: true }))) },
  context('fire-earth-concepts', 'Fogo + Terra · aura de Tempo + Vida', ['fogo', 'terra'], { concepts: ['tempo', 'vida'], estado: true, guards: ['lateral'] }),
  context('water-metal-sword', 'Água + Metal · espada', ['agua', 'metal'], { intentForm: 'espada' }),
  context('water-lightning-lance', 'Água + Raio · lança', ['agua', 'raio'], { intentForm: 'lanca', projectile: true, placement: 'flight', direction: 'forward' }),
  context('nature-water-glyph', 'Natureza + Água · palavra', ['natureza', 'agua'], { intentGlyph: 'CURA' }),
  context('fire-water-metal', 'Três materiais · Fogo, Água e Metal', ['fogo', 'agua', 'metal'], {}),
  context('nature-water-light', 'Três materiais · Natureza, Água e Luz', ['natureza', 'agua', 'luz'], {}),
  context('fire-wind-assembly', 'Fogo + Vento · formas ligadas', ['fogo', 'vento'], { shapes: ['forma_esfera', 'forma_cubo'], linked: true, merged: true }),
  context('water-lightning-ring', 'Água + Raio · anel vazado', ['agua', 'raio'], { intentForm: 'anel' })
];
const cases = [...heroes, ...contexts];
const controlFixtures = ['fogo', 'terra', 'agua', 'vento', 'raio', 'metal', 'gelo', 'som',
  'natureza', 'acido', 'ilusao', 'luz', 'sombra', 'materia', 'gravidade', 'espaco'].map(element => ({
  id: `pure-${element}`, appearance: appearance([make([element])])
}));
for (const [element, patch, suffix] of [
  ['agua', { intentForm: 'dragao' }, 'dragon'], ['fogo', { intentForm: 'lanca' }, 'lance'],
  ['luz', { intentGlyph: 'CURA' }, 'glyph'], ['natureza', { intentCount: '6' }, 'copies'],
  ['sombra', { shapes: ['forma_esfera', 'forma_cubo'] }, 'assembly']
]) controlFixtures.push({ id: `pure-${element}-${suffix}`, appearance: appearance([make([element], patch)]) });
const jet = current.modelOf('ex2');
controlFixtures.push({ id: 'real-flamethrower-ex2', appearance: current.describeAppearance(jet, current.analyzeFlow(jet)) });
// Tight shared crop around every all-cycle hero envelope. Its fit is asserted
// for both revisions on every frame before any enlargement takes place.
const size = { width: 180, height: 105 }, crop = [68, 22, 118, 70];
const records = [], controls = [];
let captures = 0, immutableChecks = 0, boundsChecks = 0, wrapChecks = 0, borderChecks = 0, routeChecks = 0;
const emptyBorders = new Map();
const border = pix => {
  const values = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++)
    if (x === 0 || y === 0 || x === pix.w - 1 || y === pix.h - 1)
      values.push(...pix.data.subarray((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 4));
  return Buffer.from(values);
};
for (const [version, api] of [['before', baseline], ['current', current]])
  for (const night of [false, true]) emptyBorders.set(`${version}-${night}`, border(api.renderPixelScene(appearance([]), night, 0).pix));
function renderChecked(api, ap, night, frame, version, label, hero = false) {
  const before = JSON.stringify(ap), visual = api.appearanceForScene(ap), layout = api.layoutScene(visual, frame);
  for (const being of visual.beings) {
    const pose = layout.poses.get(being);
    assert.ok(pose, `${label}: missing production pose`);
    const box = api.boundsOfBeing(being, pose);
    assert.ok(Object.values(box).every(Number.isFinite), `${label}: non-finite body bounds`);
    assert.ok(box.l >= 2 && box.r <= 178 && box.t >= 2 && box.b <= 99.001, `${label}: body leaves scene`);
    if (hero) assert.ok(box.l >= crop[0] && box.r < crop[2] && box.t >= crop[1] && box.b < crop[3], `${label}: comparison crop clips body`);
    boundsChecks++;
  }
  const scene = api.renderPixelScene(ap, night, frame);
  assert.equal(JSON.stringify(ap), before, `${label}: input mutated`); immutableChecks++;
  assert.equal(scene.pix.w, size.width); assert.equal(scene.pix.h, size.height);
  assert.equal(scene.pix.data.length, size.width * size.height * 4);
  assert.equal(Buffer.compare(border(scene.pix), emptyBorders.get(`${version}-${night}`)), 0, `${label}: scene border changed`); borderChecks++;
  const wrapped = api.renderPixelScene(ap, night, frame + 8);
  assert.equal(Buffer.compare(Buffer.from(scene.pix.data), Buffer.from(wrapped.pix.data)), 0, `${label}: cycle does not wrap`);
  assert.deepEqual(scene.labels, wrapped.labels, `${label}: labels do not wrap`); wrapChecks++;
  return scene;
}
function changedPixels(a, b) {
  let count = 0;
  for (let offset = 0; offset < a.length; offset += 4)
    if (a[offset] !== b[offset] || a[offset + 1] !== b[offset + 1] || a[offset + 2] !== b[offset + 2] || a[offset + 3] !== b[offset + 3]) count++;
  return count;
}
fs.mkdirSync(out, { recursive: true });
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'element-junctions-proof-'));
try {
  for (const fixture of cases) {
    for (const being of fixture.appearance.beings) {
      assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${fixture.id}: primary sprite route changed`);
      assert.deepEqual(current.pairSpriteOf(being), baseline.pairSpriteOf(being), `${fixture.id}: pair sprite route changed`);
      if (fixture.group === 'authored') assert.ok(current.pairSpriteOf(being), `${fixture.id}: authored pair missing`);
      if (fixture.group === 'general') assert.equal(current.pairSpriteOf(being), undefined, `${fixture.id}: general pair bypassed compositor`);
      routeChecks++;
    }
    let revised = 0;
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: fixture.id, theme, before: [], current: [], changedPixels: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const label = `${fixture.id}/${theme}/${version}/${frame}`;
          const scene = renderChecked(api, structuredClone(fixture.appearance), night, frame, version, label, fixture.group !== 'context');
          fs.writeFileSync(path.join(scratch, `${fixture.id}-${theme}-${version}-${frame}.rgba`), scene.pix.data);
          pixels.push(Buffer.from(scene.pix.data)); record[version].push(hash(scene.pix.data)); captures++;
        }
        const changed = changedPixels(...pixels); record.changedPixels.push(changed); revised += changed;
      }
      records.push(record);
    }
    if (fixture.group !== 'context') assert.ok(revised > 0, `${fixture.id}: requested junction did not change in either theme`);
  }
  for (const fixture of controlFixtures) {
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: fixture.id, theme, hashes: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const scene = renderChecked(api, structuredClone(fixture.appearance), night, frame, version, `${fixture.id}/${theme}/${version}/${frame}`);
          pixels.push(Buffer.from(scene.pix.data));
        }
        assert.equal(Buffer.compare(...pixels), 0, `Pure-element control changed: ${fixture.id}/${theme}/${frame}`);
        record.hashes.push(hash(pixels[0]));
      }
      controls.push(record);
    }
  }
  assert.deepEqual(sourceSnapshot(path.join(root, 'src')), originalHashes, 'Source changed during proof; rerun after edits finish');
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(frozenSource), 'Frozen baseline changed during proof');
  const composer = path.join(root, 'scripts/compose-element-junctions.py');
  const manifest = {
    description: 'Authored and allocated element junctions through the actual production renderer. Pure-element bodies and the real flame jet are exact-byte controls.',
    mode: 'frozen-baseline-comparison', renderedAt: new Date().toISOString(), size, crop,
    baseline: { suppliedFile: path.basename(baselineFile), bundleHash: hash(frozenSource) },
    productionBundleHash: hash(productionSource), sourceHashes,
    proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
    animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
    pairDefinitions, generalDefinitions, cases, records, controls,
    checks: { sourceSubstitutions: 0, captures, inputImmutable: true, immutableChecks,
      conservativeBoundsFit: true, boundsChecks, frameBorderIntact: true, borderChecks,
      eightFrameWrap: true, wrapChecks, unchangedSpriteRoutes: true, routeChecks,
      authoredPairDominances: 12, generalPairHeroes: 4, productionContexts: contexts.length,
      controlFixtures: controlFixtures.length, controlSceneComparisons: controls.length * 8,
      pureElementsAndJetBytesIdentical: true }
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  const composed = spawnSync('python', [composer, out, scratch], { stdio: 'inherit' });
  assert.equal(composed.status, 0, 'Junction comparison composition failed');
  const artifacts = fs.readdirSync(out).filter(file => /\.(png|gif)$/.test(file)).sort();
  manifest.artifactHashes = Object.fromEntries(artifacts.map(file => [file, hash(fs.readFileSync(path.join(out, file)))]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  console.log(JSON.stringify({ out, baselineHash: manifest.baseline.bundleHash, checks: manifest.checks, artifacts }, null, 2));
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
