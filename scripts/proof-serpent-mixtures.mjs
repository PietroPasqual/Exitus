/** Faithful production comparison for the serpent and material-contact art revision.
 * node scripts/proof-serpent-mixtures.mjs [output] --baseline frozen-renderer.mjs
 * The supplied baseline is never rebuilt from current source; captures are temporary.
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
let output = path.join(root, 'docs/visuals/serpent-mixtures'), baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-serpent-mixtures.mjs [output] --baseline frozen-renderer.mjs');
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
assert.ok(baselineFile, 'Pass an explicit frozen --baseline; current source cannot stand in for the prior version.');
const out = path.resolve(output), hash = value => createHash('sha256').update(value).digest('hex');
const frozenSource = fs.readFileSync(baselineFile);
const baseline = await import(pathToFileURL(baselineFile).href);
for (const key of ['renderPixelScene', 'appearanceForScene', 'layoutScene', 'boundsOfBeing', 'spellSpriteOf', 'pairSpriteOf'])
  assert.equal(typeof baseline[key], 'function', `Frozen baseline lacks ${key}`);
function sourceSnapshot(directory) {
  return Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const file = path.join(directory, item.name);
    return item.isDirectory() ? Object.entries(sourceSnapshot(file))
      : item.name.endsWith('.ts') ? [[path.relative(root, file), hash(fs.readFileSync(file))]] : [];
  }));
}
const originalHashes = sourceSnapshot(path.join(root, 'src'));
const rampFixtureFile = path.join(root, 'tests/fixtures/material-signature-pix.ts');
const rampFixtureHash = hash(fs.readFileSync(rampFixtureFile));
// Bundle the real renderer unchanged, without source hooks or alternate routing.
const buildResult = await build({ stdin: { contents: `
  export {renderPixelScene,PW,PH} from './src/ui/pixel-scene';
  export {appearanceForScene,layoutScene,boundsOfBeing} from './src/ui/pixel-scene-layout';
  export {spellSpriteOf} from './src/ui/pixel-spell-sprites';
  export {pairSpriteOf} from './src/ui/pixel-pair-sprites';
  export {paintIntention} from './src/ui/pixel-intention';
  export {Pix} from './src/ui/pixel';
  export {INTENTION_CATALOG} from './src/core/intention';
  export {SIGNATURE_RAMPS} from './tests/fixtures/material-signature-pix';
`, resolveDir: root, loader: 'ts' }, absWorkingDir: root,
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true });
const productionSource = buildResult.outputFiles[0].text;
assert.notEqual(hash(productionSource), hash(frozenSource), 'Frozen baseline equals the current bundle');
const current = await import('data:text/javascript;base64,' + Buffer.from(productionSource).toString('base64'));
assert.equal(hash(fs.readFileSync(rampFixtureFile)), rampFixtureHash, 'Palette fixture changed during build');
const sourceHashes = Object.fromEntries(Object.keys(buildResult.metafile.inputs).filter(file => file !== '<stdin>').sort().map(file => {
  const relative = path.relative(root, path.resolve(root, file)), digest = hash(fs.readFileSync(path.resolve(root, file)));
  if (relative in originalHashes) assert.equal(digest, originalHashes[relative], `Source changed during build: ${relative}`);
  return [relative, digest];
}));
const materialIds = ['fogo', 'terra', 'agua', 'vento', 'raio', 'metal', 'gelo', 'som',
  'natureza', 'acido', 'ilusao', 'luz', 'sombra', 'materia', 'gravidade', 'espaco'];
const make = (elements, patch = {}) => ({ elements, shapes: ['forma_esfera'], concepts: [],
  placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, ...patch });
const appearance = beings => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const fixture = (id, label, elements, patch = {}, group = 'mixtures') => ({
  id, label, group, elements, appearance: appearance([make(elements, patch)])
});
const serpent = (id, label, elements, patch = {}) => fixture(id, label, elements, { intentForm: 'serpente', ...patch }, 'serpent');
const serpentCases = [
  serpent('serpent-water', 'Água · serpente', ['agua']),
  serpent('serpent-fire', 'Fogo · serpente', ['fogo']),
  serpent('serpent-metal', 'Metal · serpente', ['metal']),
  serpent('serpent-nature', 'Natureza · serpente', ['natureza']),
  serpent('serpent-fire-ice', 'Fogo + Gelo', ['fogo', 'gelo']),
  serpent('serpent-water-lightning', 'Água + Raio', ['agua', 'raio']),
  serpent('serpent-nature-shadow', 'Natureza + Sombra', ['natureza', 'sombra']),
  serpent('serpent-light-illusion', 'Luz + Ilusão', ['luz', 'ilusao']),
  serpent('serpent-gravity-space-return', 'Gravidade + Espaço · retorno', ['gravidade', 'espaco'], { placement: 'self', direction: 'back' }),
  serpent('serpent-wind-sound-flight', 'Vento + Som · lançamento', ['vento', 'som'], { placement: 'flight', projectile: true, direction: 'forward' }),
  serpent('serpent-water-acid-copies', 'Água + Ácido · seis cópias', ['agua', 'acido'], { intentCount: '6' }),
  { id: 'serpent-metal-ice-orbit', label: 'Metal + Gelo · quatro órbitas', group: 'serpent', elements: ['metal', 'gelo'],
    appearance: appearance(Array.from({ length: 4 }, () => make(['metal', 'gelo'], { intentForm: 'serpente', orbit: true }))) },
  serpent('serpent-trio', 'Água + Gelo + Fogo', ['agua', 'gelo', 'fogo']),
  serpent('serpent-four', 'Natureza, Água, Ácido e Terra', ['natureza', 'agua', 'acido', 'terra']),
  serpent('serpent-eight', 'Oito materiais', materialIds.slice(0, 8)),
  serpent('serpent-sixteen', 'Dezesseis materiais', materialIds)
];
const mixtureCases = [
  fixture('water-metal-sword', 'Água + Metal · espada', ['agua', 'metal'], { intentForm: 'espada' }),
  fixture('fire-wind-lance', 'Fogo + Vento · lança', ['fogo', 'vento'], { intentForm: 'lanca' }),
  fixture('ice-lightning-axe', 'Gelo + Raio · machado', ['gelo', 'raio'], { intentForm: 'machado' }),
  fixture('earth-metal-armor', 'Terra + Metal · armadura', ['terra', 'metal'], { intentForm: 'armadura' }),
  fixture('nature-acid-shield', 'Natureza + Ácido · escudo', ['natureza', 'acido'], { intentForm: 'escudo' }),
  fixture('water-nature-tree', 'Água + Natureza · árvore', ['agua', 'natureza'], { intentForm: 'arvore' }),
  fixture('acid-metal-flower', 'Ácido + Metal · flor', ['acido', 'metal'], { intentForm: 'flor' }),
  fixture('shadow-lightning-dragon', 'Sombra + Raio · dragão', ['sombra', 'raio'], { intentForm: 'dragao' }),
  fixture('light-illusion-bird', 'Luz + Ilusão · pássaro', ['luz', 'ilusao'], { intentForm: 'passaro' }),
  fixture('space-matter-castle', 'Espaço + Matéria · castelo', ['espaco', 'materia'], { intentForm: 'castelo' }),
  fixture('gravity-sound-temple', 'Gravidade + Som · templo', ['gravidade', 'som'], { intentForm: 'templo' }),
  fixture('lightning-ice-glyph', 'Raio + Gelo · palavra ELO', ['raio', 'gelo'], { intentGlyph: 'ELO' }),
  fixture('water-shadow-sphere', 'Água + Sombra · esfera', ['agua', 'sombra']),
  fixture('wind-earth-assembly', 'Vento + Terra · conjunto', ['vento', 'terra'], { shapes: ['forma_esfera', 'forma_cubo'], linked: true }),
  fixture('shadow-ice-wind-light-ring', 'Quatro materiais · anel', ['sombra', 'gelo', 'vento', 'luz'], { intentForm: 'anel' }),
  fixture('fire-water-metal-nature-sword', 'Quatro materiais · espada', ['fogo', 'agua', 'metal', 'natureza'], { intentForm: 'espada' })
];
const cases = [...serpentCases, ...mixtureCases];
const authoredPairs = [['fogo', 'metal'], ['agua', 'gelo'], ['sombra', 'gelo'], ['raio', 'metal'],
  ['agua', 'metal'], ['fogo', 'terra'], ['agua', 'raio'], ['fogo', 'vento'], ['natureza', 'agua'], ['luz', 'sombra']];
const controlFixtures = authoredPairs.flatMap(pair => [pair, [...pair].reverse()]).map(elements => ({
  id: `accepted-${elements.join('-')}`, category: 'authored-pair', appearance: appearance([make(elements)])
}));
for (const element of materialIds) controlFixtures.push({
  id: `pure-sphere-${element}`, category: 'pure-sphere', appearance: appearance([make([element])])
});
const otherForms = [
  [['fogo'], { intentForm: 'lanca' }, 'pure-fire-lance'],
  [['agua'], { intentForm: 'dragao' }, 'pure-water-dragon'],
  [['metal'], { intentForm: 'espada' }, 'pure-metal-sword'],
  [['terra'], { intentForm: 'armadura' }, 'pure-earth-armor'],
  [['natureza'], { intentForm: 'arvore' }, 'pure-nature-tree'],
  [['raio'], { intentForm: 'anel' }, 'pure-lightning-ring'],
  [['luz'], { intentGlyph: 'CURA' }, 'pure-light-glyph'],
  [['sombra'], { intentGlyph: 'ECO' }, 'pure-shadow-glyph'],
  [['vento'], { shapes: ['forma_esfera', 'forma_cubo'] }, 'pure-wind-assembly'],
  [['gelo'], { intentCount: '6' }, 'pure-ice-copies']
];
controlFixtures.push(...otherForms.map(([elements, patch, id]) => ({
  id, category: 'pure-other-form', appearance: appearance([make(elements, patch)])
})));
// Direct raster controls cover the complete unaffected intention catalog, not
// merely a few production examples. Baseline and current receive identical
// production palettes, materials, dimensions, seed and handedness.
const otherIntentionForms = current.INTENTION_CATALOG.map(entry => entry.id).filter(form => form !== 'serpente');
assert.equal(otherIntentionForms.length, 199);
const materialOf = { fogo: 'fire', raio: 'plasma', luz: 'plasma', agua: 'water', acido: 'water', gelo: 'ice',
  terra: 'stone', materia: 'stone', gravidade: 'stone', metal: 'metal', vento: 'wind', som: 'wind' };
const directHashes = { before: createHash('sha256'), current: createHash('sha256') };
let directOtherIntentionComparisons = 0;
for (const form of otherIntentionForms) for (const element of materialIds) for (const reverse of [false, true]) {
  const pixels = [], boxes = [];
  for (const [version, api] of [['before', baseline], ['current', current]]) {
    const pix = new api.Pix(96, 96), ramp = structuredClone(current.SIGNATURE_RAMPS[element]);
    const colorsBefore = JSON.stringify(ramp);
    const box = api.paintIntention(pix, form, 48, 48, 15, ramp, materialOf[element] ?? 'energy', 7, element, reverse);
    assert.equal(JSON.stringify(ramp), colorsBefore, `${form}/${element}/${reverse}: palette mutated`);
    directHashes[version].update(`${form}/${element}/${reverse}:`);
    directHashes[version].update(JSON.stringify(box)); directHashes[version].update(pix.data);
    pixels.push(Buffer.from(pix.data)); boxes.push(box);
  }
  assert.deepEqual(boxes[0], boxes[1], `${form}/${element}/${reverse}: other intention bounds changed`);
  assert.equal(Buffer.compare(...pixels), 0, `${form}/${element}/${reverse}: other intention raster changed`);
  directOtherIntentionComparisons++;
}
const directOtherIntentionHashes = Object.fromEntries(Object.entries(directHashes).map(([key, value]) => [key, value.digest('hex')]));
assert.equal(directOtherIntentionHashes.before, directOtherIntentionHashes.current);
assert.equal(directOtherIntentionComparisons, 6368);
console.log(JSON.stringify({ stage: 'other-intention-controls', comparisons: directOtherIntentionComparisons, hash: directOtherIntentionHashes.current }));
const size = { width: 180, height: 105 };
function envelopeOf(item) {
  const envelope = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (const api of [baseline, current]) for (let frame = 0; frame < 8; frame++) {
    const visual = api.appearanceForScene(structuredClone(item.appearance)), layout = api.layoutScene(visual, frame);
    for (const being of visual.beings) {
      const pose = layout.poses.get(being);
      assert.ok(pose, `${item.id}: missing crop pose`);
      const box = api.boundsOfBeing(being, pose);
      assert.ok(Object.values(box).every(Number.isFinite), `${item.id}: non-finite crop envelope`);
      envelope.l = Math.min(envelope.l, box.l); envelope.t = Math.min(envelope.t, box.t);
      envelope.r = Math.max(envelope.r, box.r); envelope.b = Math.max(envelope.b, box.b);
    }
  }
  return envelope;
}
const crops = Object.fromEntries(cases.map(item => {
  const box = envelopeOf(item);
  return [item.id, [Math.max(0, Math.floor(box.l) - 2), Math.max(0, Math.floor(box.t) - 2),
    Math.min(size.width, Math.ceil(box.r) + 3), Math.min(size.height, Math.ceil(box.b) + 3)]];
}));
const records = [], controls = [];
let captures = 0, immutableChecks = 0, boundsChecks = 0, wrapChecks = 0, borderChecks = 0, routeChecks = 0;
const border = pix => {
  const values = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++)
    if (x === 0 || y === 0 || x === pix.w - 1 || y === pix.h - 1)
      values.push(...pix.data.subarray((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 4));
  return Buffer.from(values);
};
const emptyBorders = new Map();
for (const [version, api] of [['before', baseline], ['current', current]])
  for (const night of [false, true]) emptyBorders.set(`${version}-${night}`, border(api.renderPixelScene(appearance([]), night, 0).pix));
function renderChecked(api, ap, night, frame, version, label, crop) {
  const before = JSON.stringify(ap), visual = api.appearanceForScene(ap), layout = api.layoutScene(visual, frame);
  for (const being of visual.beings) {
    const pose = layout.poses.get(being);
    assert.ok(pose, `${label}: missing production pose`);
    const box = api.boundsOfBeing(being, pose);
    assert.ok(Object.values(box).every(Number.isFinite), `${label}: non-finite body bounds`);
    assert.ok(box.l >= 2 && box.r <= 178 && box.t >= 2 && box.b <= 99.001, `${label}: body leaves scene`);
    if (crop) assert.ok(box.l >= crop[0] && box.r < crop[2] && box.t >= crop[1] && box.b < crop[3], `${label}: comparison crop clips body`);
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'serpent-mixtures-proof-'));
try {
  for (const item of cases) {
    for (const being of item.appearance.beings) {
      assert.equal(current.pairSpriteOf(being), undefined, `${item.id}: mixture collapsed to an authored sphere`);
      routeChecks++;
    }
    let revised = 0;
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: item.id, theme, before: [], current: [], changedPixels: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const label = `${item.id}/${theme}/${version}/${frame}`;
          const scene = renderChecked(api, structuredClone(item.appearance), night, frame, version, label, crops[item.id]);
          fs.writeFileSync(path.join(scratch, `${item.id}-${theme}-${version}-${frame}.rgba`), scene.pix.data);
          pixels.push(Buffer.from(scene.pix.data)); record[version].push(hash(scene.pix.data)); captures++;
        }
        const changed = changedPixels(...pixels); record.changedPixels.push(changed); revised += changed;
      }
      records.push(record);
    }
    if (item.group === 'serpent') assert.ok(revised > 0, `${item.id}: serpent did not change in either theme`);
    if ((cases.indexOf(item) + 1) % 8 === 0) console.log(JSON.stringify({ stage: 'gallery-captures', completed: cases.indexOf(item) + 1, total: cases.length }));
  }
  for (const item of controlFixtures) {
    for (const being of item.appearance.beings) {
      assert.deepEqual(current.pairSpriteOf(being), baseline.pairSpriteOf(being), `${item.id}: control pair route changed`);
      assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${item.id}: control primary route changed`);
      routeChecks++;
    }
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: item.id, category: item.category, theme, hashes: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const scene = renderChecked(api, structuredClone(item.appearance), night, frame, version, `${item.id}/${theme}/${version}/${frame}`);
          pixels.push(Buffer.from(scene.pix.data));
        }
        assert.equal(Buffer.compare(...pixels), 0, `Existing-art control changed: ${item.id}/${theme}/${frame}`);
        record.hashes.push(hash(pixels[0]));
      }
      controls.push(record);
    }
  }
  assert.deepEqual(sourceSnapshot(path.join(root, 'src')), originalHashes, 'Source changed during proof; rerun after edits finish');
  assert.equal(hash(fs.readFileSync(baselineFile)), hash(frozenSource), 'Frozen baseline changed during proof');
  assert.equal(hash(fs.readFileSync(rampFixtureFile)), rampFixtureHash, 'Palette fixture changed during proof');
  const composer = path.join(root, 'scripts/compose-serpent-mixtures.py');
  const manifest = {
    description: 'Sixteen serpent studies and sixteen other mixed-form examples, captured from unchanged production entry points. This visual sample does not exhaust all material subsets or all intentions.',
    mode: 'frozen-baseline-comparison', renderedAt: new Date().toISOString(), size, crops,
    baseline: { suppliedFile: path.basename(baselineFile), bundleHash: hash(frozenSource) },
    productionBundleHash: hash(productionSource), sourceHashes,
    proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
    animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
    materialIds, cases, records, controls, directOtherIntentionHashes,
    checks: { sourceSubstitutions: 0, captures, otherUnchangedIntentionForms: otherIntentionForms.length,
      directOtherIntentionComparisons, inputImmutable: true, immutableChecks,
      conservativeBoundsFit: true, boundsChecks, frameBorderIntact: true, borderChecks,
      eightFrameWrap: true, wrapChecks, productionRoutesChecked: true, routeChecks,
      serpentFixtures: serpentCases.length, otherMixedForms: mixtureCases.length,
      serpentFixturesWithVisibleChange: serpentCases.filter(item => records.some(record => record.id === item.id && record.changedPixels.some(Boolean))).length,
      otherMixturesWithVisibleChange: mixtureCases.filter(item => records.some(record => record.id === item.id && record.changedPixels.some(Boolean))).length,
      acceptedAuthoredDominances: authoredPairs.length * 2,
      controlFixtures: controlFixtures.length, controlSceneComparisons: controlFixtures.length * 16,
      existingPureOtherFormsAndAuthoredArtBytesIdentical: true, allHigherOrderSubsetsProven: false }
  };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  const composed = spawnSync('python', [composer, out, scratch], { stdio: 'inherit' });
  assert.equal(composed.status, 0, 'Serpent comparison composition failed');
  const artifacts = fs.readdirSync(out).filter(file => /\.(png|gif)$/.test(file)).sort();
  assert.equal(artifacts.length, 8, 'Expected eight compact visual artifacts');
  manifest.artifactHashes = Object.fromEntries(artifacts.map(file => [file, hash(fs.readFileSync(path.join(out, file)))]));
  manifest.artifactBytes = Object.fromEntries(artifacts.map(file => [file, fs.statSync(path.join(out, file)).size]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest) + '\n');
  console.log(JSON.stringify({ out, baselineHash: manifest.baseline.bundleHash, checks: manifest.checks,
    artifactBytes: Object.values(manifest.artifactBytes).reduce((sum, value) => sum + value, 0), artifacts }, null, 2));
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
