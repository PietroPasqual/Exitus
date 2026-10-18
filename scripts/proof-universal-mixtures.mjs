/** Render all ordered material pairs and curated mixed forms through production, using an explicit frozen prior build.
 * node scripts/proof-universal-mixtures.mjs [output] --baseline frozen-renderer.mjs
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
let output = path.join(root, 'docs/visuals/universal-mixtures'), baselineFile, outputGiven = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('Usage: node scripts/proof-universal-mixtures.mjs [output] --baseline frozen-renderer.mjs');
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
const materials = [
  { element: 'fogo', label: 'Fogo' }, { element: 'terra', label: 'Terra' },
  { element: 'agua', label: 'Água' }, { element: 'vento', label: 'Vento' },
  { element: 'raio', label: 'Raio' }, { element: 'metal', label: 'Metal' },
  { element: 'gelo', label: 'Gelo' }, { element: 'som', label: 'Som' },
  { element: 'natureza', label: 'Natureza' }, { element: 'acido', label: 'Ácido' },
  { element: 'ilusao', label: 'Ilusão' }, { element: 'luz', label: 'Luz' },
  { element: 'sombra', label: 'Sombra' }, { element: 'materia', label: 'Matéria' },
  { element: 'gravidade', label: 'Gravidade' }, { element: 'espaco', label: 'Espaço' }
];
const acceptedPairs = [['fogo', 'metal'], ['agua', 'gelo'], ['sombra', 'gelo'], ['raio', 'metal'],
  ['agua', 'metal'], ['fogo', 'terra'], ['agua', 'raio'], ['fogo', 'vento'], ['natureza', 'agua'], ['luz', 'sombra']];
const authored = new Set(acceptedPairs.flatMap(pair => [pair.join('+'), [...pair].reverse().join('+')]));
const matrixCases = materials.flatMap(primary => materials.map(secondary => {
  const elements = primary.element === secondary.element ? [primary.element] : [primary.element, secondary.element];
  const category = elements.length === 1 ? 'pure-diagonal' : authored.has(elements.join('+')) ? 'accepted-pair' : 'generic-pair';
  return { id: `matrix-${primary.element}-${secondary.element}`, group: 'matrix',
    primary: primary.element, secondary: secondary.element, elements, category,
    exact: category !== 'generic-pair', appearance: appearance([make(elements)]) };
}));
const fixture = (id, label, elements, patch = {}, group = 'gallery') => ({
  id, label, group, elements, appearance: appearance([make(elements, patch)])
});
const galleryCases = [
  fixture('water-metal-sword', 'Água + Metal · espada', ['agua', 'metal'], { intentForm: 'espada' }),
  fixture('fire-wind-lance', 'Fogo + Vento · lança', ['fogo', 'vento'], { intentForm: 'lanca' }),
  fixture('earth-ice-armor', 'Terra + Gelo · armadura', ['terra', 'gelo'], { intentForm: 'armadura' }),
  fixture('nature-acid-shield', 'Natureza + Ácido · escudo', ['natureza', 'acido'], { intentForm: 'escudo' }),
  fixture('shadow-lightning-dragon', 'Sombra + Raio · dragão', ['sombra', 'raio'], { intentForm: 'dragao' }),
  fixture('light-illusion-bird', 'Luz + Ilusão · pássaro', ['luz', 'ilusao'], { intentForm: 'passaro' }),
  fixture('nature-water-tree', 'Natureza + Água · árvore', ['natureza', 'agua'], { intentForm: 'arvore' }),
  fixture('acid-metal-flower', 'Ácido + Metal · flor', ['acido', 'metal'], { intentForm: 'flor' }),
  fixture('matter-space-castle', 'Matéria + Espaço · castelo', ['materia', 'espaco'], { intentForm: 'castelo' }),
  fixture('gravity-sound-temple', 'Gravidade + Som · templo', ['gravidade', 'som'], { intentForm: 'templo' }),
  fixture('lightning-ice-glyph', 'Raio + Gelo · palavra ELO', ['raio', 'gelo'], { intentGlyph: 'ELO' }),
  fixture('wind-earth-assembly', 'Vento + Terra · conjunto', ['vento', 'terra'], { shapes: ['forma_esfera', 'forma_cubo'], linked: true }),
  fixture('water-ice-fire-dragon', 'Água, Gelo e Fogo · dragão', ['agua', 'gelo', 'fogo'], { intentForm: 'dragao' }),
  fixture('four-material-sword', 'Quatro materiais · espada', ['fogo', 'agua', 'metal', 'natureza'], { intentForm: 'espada' }),
  fixture('eight-material-serpent', 'Oito materiais · serpente', materials.slice(0, 8).map(item => item.element), { intentForm: 'serpente' }),
  fixture('sixteen-material-body', 'Dezesseis materiais · esfera', materials.map(item => item.element))
];
const context = (id, label, elements, patch) => fixture(id, label, elements, patch, 'context');
const contexts = [
  context('fire-acid-flight', 'Fogo + Ácido · lançamento', ['fogo', 'acido'], { placement: 'flight', projectile: true, direction: 'forward' }),
  context('water-space-return', 'Água + Espaço · retorno', ['agua', 'espaco'], { placement: 'self', direction: 'back' }),
  context('nature-light-copies', 'Natureza + Luz · seis cópias', ['natureza', 'luz'], { intentCount: '6' }),
  { id: 'metal-illusion-orbits', label: 'Metal + Ilusão · oito órbitas', group: 'context', elements: ['metal', 'ilusao'],
    appearance: appearance(Array.from({ length: 8 }, () => make(['metal', 'ilusao'], { orbit: true }))) },
  context('three-material-concepts', 'Água, Terra e Luz · Tempo + Vida', ['agua', 'terra', 'luz'], { concepts: ['tempo', 'vida'], estado: true, guards: ['lateral'] }),
  context('four-material-ring', 'Quatro materiais · anel vazado', ['sombra', 'gelo', 'vento', 'luz'], { intentForm: 'anel' }),
  context('eight-material-glyph', 'Oito materiais · palavra ARCANO', materials.slice(8).map(item => item.element), { intentGlyph: 'ARCANO' }),
  context('water-ice-dragon', 'Água + Gelo · dragão refratado', ['agua', 'gelo'], { intentForm: 'dragao' })
];
const cases = [...matrixCases, ...galleryCases, ...contexts];
// Matrix diagonals and the 20 accepted authored orders are exact controls in
// their own captures. Do not render those scenes again merely to duplicate QA.
const controlFixtures = [
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
].map(([elements, patch, id]) => ({ id, category: 'pure-context', appearance: appearance([make(elements, patch)]) }));
const jet = current.modelOf('ex2');
controlFixtures.push({ id: 'real-flamethrower-ex2', category: 'preset', appearance: current.describeAppearance(jet, current.analyzeFlow(jet)) });
const size = { width: 180, height: 105 };
// These crops are computed from both actual production layouts across all
// eight poses. Independent hard scene limits are checked during every render.
function envelopeOf(fixtures) {
  const envelope = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (const item of fixtures) for (const api of [baseline, current]) for (let frame = 0; frame < 8; frame++) {
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
function cropOf(envelope) {
  assert.ok(Object.values(envelope).every(Number.isFinite), 'Cannot derive finite production crop');
  return [Math.max(0, Math.floor(envelope.l) - 2), Math.max(0, Math.floor(envelope.t) - 2),
    Math.min(size.width, Math.ceil(envelope.r) + 3), Math.min(size.height, Math.ceil(envelope.b) + 3)];
}
const matrixEnvelope = envelopeOf(matrixCases), matrixCrop = cropOf(matrixEnvelope);
const galleryCrops = Object.fromEntries(galleryCases.map(item => [item.id, cropOf(envelopeOf([item]))]));
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
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'universal-mixtures-proof-'));
try {
  for (const fixture of cases) {
    for (const being of fixture.appearance.beings) {
      if (fixture.exact) {
        assert.deepEqual(current.spellSpriteOf(being), baseline.spellSpriteOf(being), `${fixture.id}: accepted primary route changed`);
        assert.deepEqual(current.pairSpriteOf(being), baseline.pairSpriteOf(being), `${fixture.id}: accepted pair route changed`);
      }
      if (fixture.group !== 'matrix') assert.equal(current.pairSpriteOf(being), undefined, `${fixture.id}: mixed form collapsed to an authored sphere`);
      routeChecks++;
    }
    let revised = 0;
    for (const night of [false, true]) {
      const theme = night ? 'night' : 'day', record = { id: fixture.id, theme, before: [], current: [], changedPixels: [] };
      for (let frame = 0; frame < 8; frame++) {
        const pixels = [];
        for (const [version, api] of [['before', baseline], ['current', current]]) {
          const label = `${fixture.id}/${theme}/${version}/${frame}`;
          const scene = renderChecked(api, structuredClone(fixture.appearance), night, frame, version, label, fixture.group === 'matrix' ? matrixCrop : galleryCrops[fixture.id]);
          if (fixture.group !== 'matrix' || frame === 0)
            fs.writeFileSync(path.join(scratch, `${fixture.id}-${theme}-${version}-${frame}.rgba`), scene.pix.data);
          pixels.push(Buffer.from(scene.pix.data)); record[version].push(hash(scene.pix.data)); captures++;
        }
        const changed = changedPixels(...pixels); record.changedPixels.push(changed); revised += changed;
        if (fixture.exact) assert.equal(changed, 0, `${fixture.id}/${theme}/${frame}: accepted sphere pixels changed`);
      }
      records.push(record);
    }
    if (fixture.group === 'gallery') assert.ok(revised > 0, `${fixture.id}: curated generic mixture did not change in either theme`);
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
  const composer = path.join(root, 'scripts/compose-universal-mixtures.py');
  const manifest = {
    description: '240 ordered two-material sphere pairs and 16 pure diagonals; 16 curated mixed forms and eight contexts. This visual sample does not claim to exhaust every higher-order material subset or every intention.',
    mode: 'frozen-baseline-comparison', renderedAt: new Date().toISOString(), size, matrixCrop, matrixEnvelope, galleryCrops,
    baseline: { suppliedFile: path.basename(baselineFile), bundleHash: hash(frozenSource) },
    productionBundleHash: hash(productionSource), sourceHashes,
    proofScriptHash: hash(fs.readFileSync(fileURLToPath(import.meta.url))), composerScriptHash: hash(fs.readFileSync(composer)),
    animation: { frames: 8, durationMs: [120, 130, 120, 130, 120, 130, 120, 130], loopMs: 1000 },
    materials, cases: cases.map(({ appearance: ap, ...item }) => item.group === 'matrix' ? item : { ...item, appearance: ap }), records, controls,
    checks: { sourceSubstitutions: 0, captures, inputImmutable: true, immutableChecks,
      conservativeBoundsFit: true, boundsChecks, frameBorderIntact: true, borderChecks,
      eightFrameWrap: true, wrapChecks, acceptedAndIntentionRoutesChecked: true, routeChecks,
      orderedPairs: matrixCases.filter(item => item.elements.length === 2).length,
      pureDiagonals: materials.length, acceptedAuthoredDominances: authored.size,
      genericOrderedPairsWithVisibleChange: matrixCases.filter(item => item.category === 'generic-pair' && records.some(record => record.id === item.id && record.changedPixels.some(Boolean))).length,
      curatedMixedForms: galleryCases.length, productionContexts: contexts.length,
      controlFixtures: matrixCases.filter(item => item.exact).length + controlFixtures.length,
      controlSceneComparisons: (matrixCases.filter(item => item.exact).length + controlFixtures.length) * 16,
      existingPureAndAuthoredArtBytesIdentical: true,
      allHigherOrderSubsetsProven: false }
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
