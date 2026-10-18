/** Render four newly authored elemental pair bodies through production, using an explicit frozen prior build.
 * node scripts/proof-woven-junctions.mjs [output] --baseline frozen-renderer.mjs
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
let output = path.join(root, 'docs/visuals/woven-junctions'), baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-woven-junctions.mjs [output] --baseline frozen-renderer.mjs');
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
  { elements: ['agua', 'raio'], label: 'Água + Raio' },
  { elements: ['fogo', 'vento'], label: 'Fogo + Vento' },
  { elements: ['natureza', 'agua'], label: 'Natureza + Água' },
  { elements: ['luz', 'sombra'], label: 'Luz + Sombra' }
];
const heroes = pairDefinitions.flatMap(pair => [pair.elements, [...pair.elements].reverse()].map(elements => ({
  id: elements.join('-'), group: 'hero', route: 'new-pair', label: pair.label, primary: elements[0],
  appearance: appearance([make(elements)])
})));
const context = (id, label, elements, patch, route = 'new-pair') => ({
  id, label, group: 'context', route, appearance: appearance([make(elements, patch)])
});
const contexts = [
  context('water-lightning-flight', 'Água + Raio · lançamento', ['agua', 'raio'], { placement: 'flight', projectile: true, direction: 'forward' }),
  context('lightning-water-return', 'Raio + Água · retorno', ['raio', 'agua'], { placement: 'self', direction: 'back' }),
  context('fire-wind-copies', 'Fogo + Vento · seis manifestações', ['fogo', 'vento'], { intentCount: '6' }),
  { id: 'wind-fire-orbits', label: 'Vento + Fogo · oito órbitas', group: 'context', route: 'new-pair',
    appearance: appearance(Array.from({ length: 8 }, () => make(['vento', 'fogo'], { orbit: true }))) },
  context('nature-water-concepts', 'Natureza + Água · Tempo + Vida', ['natureza', 'agua'], { concepts: ['tempo', 'vida'], estado: true, guards: ['lateral'] }),
  context('light-shadow-flight', 'Luz + Sombra · lançamento', ['luz', 'sombra'], { placement: 'flight', projectile: true, direction: 'forward' }),
  context('water-lightning-lance', 'Preservada · Água + Raio em lança', ['agua', 'raio'], { intentForm: 'lanca' }, 'unchanged'),
  context('nature-water-glyph', 'Preservada · palavra de Natureza + Água', ['natureza', 'agua'], { intentGlyph: 'CURA' }, 'unchanged'),
  context('shadow-light-ring', 'Preservado · anel de Sombra + Luz', ['sombra', 'luz'], { intentForm: 'anel' }, 'unchanged'),
  context('nature-water-light', 'Preservados · Natureza, Água e Luz', ['natureza', 'agua', 'luz'], {}, 'unchanged'),
  context('fire-wind-earth', 'Preservados · Fogo, Vento e Terra', ['fogo', 'vento', 'terra'], {}, 'unchanged'),
  context('fire-wind-assembly', 'Preservadas · formas ligadas', ['fogo', 'vento'], { shapes: ['forma_esfera', 'forma_cubo'], linked: true, merged: true }, 'unchanged')
];
const cases = [...heroes, ...contexts];
const controlFixtures = ['fogo', 'terra', 'agua', 'vento', 'raio', 'metal', 'gelo', 'som',
  'natureza', 'acido', 'ilusao', 'luz', 'sombra', 'materia', 'gravidade', 'espaco'].map(element => ({
  id: `pure-${element}`, category: 'pure-element', appearance: appearance([make([element])])
}));
for (const pair of [['fogo', 'metal'], ['agua', 'gelo'], ['sombra', 'gelo'], ['raio', 'metal'], ['agua', 'metal'], ['fogo', 'terra']])
  for (const elements of [pair, [...pair].reverse()]) controlFixtures.push({
    id: `accepted-${elements.join('-')}`, category: 'accepted-pair', appearance: appearance([make(elements)])
  });
for (const [elements, patch, suffix] of [
  [['agua'], { intentForm: 'dragao' }, 'water-dragon'],
  [['fogo'], { intentForm: 'lanca' }, 'fire-lance'],
  [['luz'], { intentGlyph: 'CURA' }, 'light-glyph'],
  [['natureza'], { intentCount: '6' }, 'nature-copies'],
  [['sombra'], { shapes: ['forma_esfera', 'forma_cubo'] }, 'shadow-assembly'],
  [['fogo', 'vento'], { intentForm: 'espada' }, 'fire-wind-sword'],
  [['agua', 'raio'], { shapes: ['forma_cubo'] }, 'water-lightning-cube'],
  [['natureza', 'agua'], { intentForm: 'dragao' }, 'nature-water-dragon'],
  [['luz', 'sombra'], { intentGlyph: 'ECO' }, 'light-shadow-glyph']
]) controlFixtures.push({ id: suffix, category: elements.length === 1 ? 'pure-context' : 'excluded-pair-context',
  appearance: appearance([make(elements, patch)]) });
const jet = current.modelOf('ex2');
controlFixtures.push({ id: 'real-flamethrower-ex2', category: 'preset', appearance: current.describeAppearance(jet, current.analyzeFlow(jet)) });
const size = { width: 180, height: 105 };
// Derive one shared crop from both production layouts, in all eight poses.
// Every body's absolute scene bounds are separately checked against hard scene
// limits; fitting a crop never relaxes those constraints or rescales a body.
const heroEnvelope = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
for (const fixture of heroes) for (const api of [baseline, current]) for (let frame = 0; frame < 8; frame++) {
  const visual = api.appearanceForScene(structuredClone(fixture.appearance)), layout = api.layoutScene(visual, frame);
  for (const being of visual.beings) {
    const box = api.boundsOfBeing(being, layout.poses.get(being));
    heroEnvelope.l = Math.min(heroEnvelope.l, box.l); heroEnvelope.t = Math.min(heroEnvelope.t, box.t);
    heroEnvelope.r = Math.max(heroEnvelope.r, box.r); heroEnvelope.b = Math.max(heroEnvelope.b, box.b);
  }
}
assert.ok(Object.values(heroEnvelope).every(Number.isFinite), 'Cannot derive finite production hero envelope');
const crop = [Math.max(0, Math.floor(heroEnvelope.l) - 2), Math.max(0, Math.floor(heroEnvelope.t) - 2),
  Math.min(size.width, Math.ceil(heroEnvelope.r) + 3), Math.min(size.height, Math.ceil(heroEnvelope.b) + 3)];
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'woven-junctions-proof-'));
try {
  for (const fixture of cases) {
    for (const being of fixture.appearance.beings) {
      assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${fixture.id}: underlying primary route changed`);
      if (fixture.route === 'new-pair') {
        assert.equal(baseline.pairSpriteOf(being), undefined, `${fixture.id}: baseline already has new authored pair`);
        const route = current.pairSpriteOf(being);
        assert.ok(route, `${fixture.id}: new production pair route missing`);
        assert.equal(route.primary, being.elements[0], `${fixture.id}: material dominance changed`);
      } else {
        assert.deepEqual(current.pairSpriteOf(being), baseline.pairSpriteOf(being), `${fixture.id}: excluded pair route changed`);
        assert.equal(current.pairSpriteOf(being), undefined, `${fixture.id}: excluded shape entered pair route`);
      }
      routeChecks++;
    }
    let revised = 0;
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: fixture.id, theme, before: [], current: [], changedPixels: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const label = `${fixture.id}/${theme}/${version}/${frame}`;
          const scene = renderChecked(api, structuredClone(fixture.appearance), night, frame, version, label, fixture.group === 'hero');
          fs.writeFileSync(path.join(scratch, `${fixture.id}-${theme}-${version}-${frame}.rgba`), scene.pix.data);
          pixels.push(Buffer.from(scene.pix.data)); record[version].push(hash(scene.pix.data)); captures++;
        }
        const changed = changedPixels(...pixels); record.changedPixels.push(changed); revised += changed;
        if (fixture.route === 'unchanged') assert.equal(changed, 0, `${fixture.id}/${theme}/${frame}: excluded context pixels changed`);
      }
      records.push(record);
    }
    if (fixture.route === 'new-pair') assert.ok(revised > 0, `${fixture.id}: new authored pair did not change in either theme`);
  }
  for (const fixture of controlFixtures) {
    for (const being of fixture.appearance.beings) {
      assert.deepEqual(current.pairSpriteOf(being), baseline.pairSpriteOf(being), `${fixture.id}: control pair route changed`);
      assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${fixture.id}: control primary route changed`);
      routeChecks++;
    }
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: fixture.id, category: fixture.category, theme, hashes: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const scene = renderChecked(api, structuredClone(fixture.appearance), night, frame, version, `${fixture.id}/${theme}/${version}/${frame}`);
          pixels.push(Buffer.from(scene.pix.data));
        }
        assert.equal(Buffer.compare(...pixels), 0, `Existing-art control changed: ${fixture.id}/${theme}/${frame}`);
        record.hashes.push(hash(pixels[0]));
      }
      controls.push(record);
    }
  }
  assert.deepEqual(sourceSnapshot(path.join(root, 'src')), originalHashes, 'Source changed during proof; rerun after edits finish');
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(frozenSource), 'Frozen baseline changed during proof');
  const composer = path.join(root, 'scripts/compose-woven-junctions.py');
  const manifest = {
    description: 'Four newly authored two-material spheres, both dominant orders, through the production renderer. Prior six authored pairs, pure elements, excluded intentions/triples/assemblies and the real flame jet remain exact-byte controls.',
    mode: 'frozen-baseline-comparison', renderedAt: new Date().toISOString(), size, crop, heroEnvelope,
    baseline: { suppliedFile: path.basename(baselineFile), bundleHash: hash(frozenSource) },
    productionBundleHash: hash(productionSource), sourceHashes,
    proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
    animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
    pairDefinitions, cases, records, controls,
    checks: { sourceSubstitutions: 0, captures, inputImmutable: true, immutableChecks,
      conservativeBoundsFit: true, boundsChecks, frameBorderIntact: true, borderChecks,
      eightFrameWrap: true, wrapChecks, expectedProductionRoutes: true, routeChecks,
      newAuthoredPairDominances: 8, unchangedAcceptedDominances: 12, productionContexts: contexts.length,
      exactExcludedContexts: contexts.filter(fixture => fixture.route === 'unchanged').length,
      controlFixtures: controlFixtures.length, controlSceneComparisons: controls.length * 8,
      existingArtAndExcludedRoutesBytesIdentical: true }
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
