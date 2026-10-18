/**
 * Exhaustive pair/catalog coverage through the unmodified production renderer.
 * Full sweep is intentionally a CLI job, rather than a long CI unit test.
 *
 * node scripts/check-universal-mixtures.mjs --shard 0/4 --output /tmp/mixtures-0.json
 * node scripts/check-universal-mixtures.mjs --groups animation,triples --output /tmp/motion.json
 *
 * Shards are zero based. Merge reports only when productionBundleHash, sourceHashes,
 * plan and shard.count agree, and every shard.index is present exactly once.
 * A background-opaque scene is never used to infer body alpha or readable materials.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const availableGroups = ['catalog', 'structural', 'animation', 'fusions', 'triples', 'many', 'glyphs', 'concepts', 'orbits'];
let shardIndex = 0, shardCount = 1, output, selected = availableGroups, limit = Infinity;
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--help') {
    console.log('Usage: node scripts/check-universal-mixtures.mjs [--shard 0/4] [--groups catalog,structural,animation,fusions,triples,many,glyphs,concepts,orbits] [--limit N] [--output /tmp/report.json]');
    process.exit(0);
  }
  const value = process.argv[++i];
  assert.ok(value && !value.startsWith('--'), `${arg} requires a value`);
  if (arg === '--shard') {
    assert.match(value, /^\d+\/\d+$/); [shardIndex, shardCount] = value.split('/').map(Number);
    assert.ok(shardCount > 0 && shardIndex >= 0 && shardIndex < shardCount, 'Invalid zero-based shard');
  } else if (arg === '--groups') {
    selected = [...new Set(value.split(','))];
    assert.ok(selected.length && selected.every(group => availableGroups.includes(group)), 'Unknown group');
  } else if (arg === '--output') output = path.resolve(value);
  else if (arg === '--limit') { limit = Number(value); assert.ok(Number.isInteger(limit) && limit > 0); }
  else throw new Error(`Unknown argument ${arg}`);
}
output ??= path.join(os.tmpdir(), `universal-mixtures-${shardIndex}-of-${shardCount}.json`);
const sha = data => createHash('sha256').update(data).digest('hex');
const started = performance.now();
const hashTree = directory => Object.fromEntries(fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? Object.entries(hashTree(file)) : entry.name.endsWith('.ts') ? [[path.relative(root, file), sha(fs.readFileSync(file))]] : [];
}));
const beforeBuildHashes = { ...hashTree(path.join(root, 'src')),
  'tests/fixtures/material-signature-pix.ts': sha(fs.readFileSync(path.join(root, 'tests/fixtures/material-signature-pix.ts'))) };
// Actual public entry points, without source rewriting, onLoad hooks or debug globals.
const bundle = await build({ stdin: { resolveDir: root, loader: 'ts', contents: `
  export { renderPixelScene, PW, PH } from './src/ui/pixel-scene';
  export { appearanceForScene, layoutScene, boundsOfBeing } from './src/ui/pixel-scene-layout';
  export { INTENTION_CATALOG } from './src/core/intention';
  export { CONCEPT_RUNES, familyOf } from './src/core/structural';
  export { Pix } from './src/ui/pixel';
  export { paintIntention } from './src/ui/pixel-intention';
  export { paintIntentionGlyph } from './src/ui/pixel-intention-glyph';
  export { paintMaterialInteraction } from './src/ui/pixel-material-interaction';
  export { paintAllocatedMixture } from './src/ui/pixel-mixture-compositor';
  export { BODY_MATERIALS, isBodyMaterial } from './src/ui/pixel-mixture-signatures';
  export { SIGNATURE_RAMPS } from './tests/fixtures/material-signature-pix';
` }, absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true });
const source = bundle.outputFiles[0].text;
const sourceHashes = Object.fromEntries(Object.keys(bundle.metafile.inputs).filter(file => file !== '<stdin>').sort()
  .map(file => [file, sha(fs.readFileSync(path.resolve(root, file)))]));
for (const [file, digest] of Object.entries(sourceHashes))
  assert.equal(digest, beforeBuildHashes[file], `Source changed while bundling: ${file}; rerun after edits finish`);
const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const forms = api.INTENTION_CATALOG.map(entry => entry.id), materials = [...api.BODY_MATERIALS];
const concepts = [...api.CONCEPT_RUNES];
assert.equal(forms.length, 200, 'Update the documented matrix when the public catalog changes');
assert.equal(new Set(forms).size, 200); assert.equal(materials.length, 16); assert.equal(concepts.length, 8);
assert.ok(concepts.every(concept => !api.isBodyMaterial(concept)), 'A concept entered the physical-material registry');
const pairs = materials.flatMap(a => materials.filter(b => b !== a).map(b => [a, b]));
assert.equal(pairs.length, 240);
const structural = ['forma_esfera', 'forma_cubo', 'forma_piramide', 'forma_paralelepipedo'];
const mat = { fogo: 'fire', raio: 'plasma', luz: 'plasma', agua: 'water', acido: 'water', gelo: 'ice',
  terra: 'stone', materia: 'stone', gravidade: 'stone', metal: 'metal', vento: 'wind', som: 'wind' };
const make = (elements, patch = {}) => ({ elements: [...elements], shapes: ['forma_esfera'], concepts: [],
  placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, ...patch });
const appearance = beings => ({ beings, orbitCount: beings.filter(being => being.orbit).length });
const scene = (elements, patch = {}) => appearance([make(elements, patch)]);
const paintMaterials = elements => elements.map(element => ({ element, ramp: api.SIGNATURE_RAMPS[element] }));
const confirmedGroups = elements => [...new Set(elements.map(api.familyOf))].map(family => ({ family,
  elements: elements.filter(element => api.familyOf(element) === family) })).filter(group => group.elements.length > 1);
const copy = pix => { const value = new api.Pix(pix.w, pix.h); value.data.set(pix.data); return value; };
const luma = color => color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
const colorAt = (data, i) => [data[i], data[i + 1], data[i + 2]];
const near = (a, b) => Math.max(...a.map((value, index) => Math.abs(value - b[index]))) <= 5;
const equalPixels = (a, b, label) => assert.equal(Buffer.compare(Buffer.from(a), Buffer.from(b)), 0, label);
function border(pix) {
  const result = [];
  for (let x = 0; x < pix.w; x++) {
    for (const y of [0, pix.h - 1]) { const i = (y * pix.w + x) * 4; result.push(...pix.data.subarray(i, i + 4)); }
  }
  for (let y = 1; y < pix.h - 1; y++) {
    for (const x of [0, pix.w - 1]) { const i = (y * pix.w + x) * 4; result.push(...pix.data.subarray(i, i + 4)); }
  }
  return result;
}
const emptyBorders = [false, true].map(night => border(api.renderPixelScene(appearance([]), night, 0).pix));
const groups = {}, failures = [], underBudgetExamples = [];
let globalIndex = 0, executed = 0;
const ensureGroup = group => groups[group] ??= { plannedCases: 0, assignedCases: 0, completedCases: 0,
  productionRenders: 0, directBodyRenders: 0, bodyAlphaChecks: 0, protectedColorChecks: 0,
  productionBoundsChecks: 0, borderChecks: 0, inputChecks: 0, wrapChecks: 0,
  bodyBudgetProbes: 0, underBudgetProbes: 0, missingMaterialSlots: 0,
  minimumSafePixels: null, maximumSafePixels: 0, budgetsBySize: {},
  sceneDigest: createHash('sha256'), bodyDigest: createHash('sha256') };
function checkScene(ap, frame, night, label, group, wrap = false) {
  const original = JSON.stringify(ap), visual = api.appearanceForScene(ap), layout = api.layoutScene(visual, frame);
  for (const being of visual.beings) {
    const pose = layout.poses.get(being); assert.ok(pose, `${label}: missing production pose`);
    const box = api.boundsOfBeing(being, pose);
    assert.ok(Object.values(box).every(Number.isFinite), `${label}: nonfinite bounds`);
    assert.ok(box.l >= 2 && box.r <= 178 && box.t >= 2 && box.b <= 99.001,
      `${label}: body outside scene ${JSON.stringify(box)}`);
    group.productionBoundsChecks++;
  }
  const rendered = api.renderPixelScene(ap, night, frame); group.productionRenders++;
  assert.equal(rendered.pix.w, api.PW); assert.equal(rendered.pix.h, api.PH);
  assert.equal(rendered.pix.data.length, api.PW * api.PH * 4);
  assert.equal(JSON.stringify(ap), original, `${label}: production input mutated`); group.inputChecks++;
  assert.deepEqual(border(rendered.pix), emptyBorders[Number(night)], `${label}: scene border changed`); group.borderChecks++;
  assert.ok(rendered.labels.every(label => Number.isFinite(label.x) && Number.isFinite(label.y)), `${label}: nonfinite label`);
  group.sceneDigest.update(label).update(Buffer.from(rendered.pix.data)).update(JSON.stringify(rendered.labels));
  if (wrap) {
    const wrapped = api.renderPixelScene(ap, night, frame + 8); group.productionRenders++;
    equalPixels(rendered.pix.data, wrapped.pix.data, `${label}: eight-frame production wrap changed`);
    assert.deepEqual(rendered.labels, wrapped.labels, `${label}: labels do not wrap`);
    assert.equal(JSON.stringify(ap), original, `${label}: wrapped input mutated`); group.inputChecks++; group.wrapChecks++;
  }
}
/** A separate transparent Pix measures real holes, cuts and budget. It is not a scene-alpha proxy. */
function checkBody(elements, form, size, frame, reverse, label, group, glyph = false, materialFusion = []) {
  const body = new api.Pix(96, 96), ramp = api.SIGNATURE_RAMPS[elements[0]];
  const bounds = (glyph ? api.paintIntentionGlyph : api.paintIntention)(body, form, 48, 48, size,
    ramp, mat[elements[0]] ?? 'energy', 3, elements[0], reverse);
  assert.ok(bounds.l >= 1 && bounds.t >= 1 && bounds.r < 95 && bounds.b < 95, `${label}: direct canvas clips the authored bounds`);
  const before = body.data.slice(), input = paintMaterials(elements), sourceInput = JSON.stringify(input);
  const options = { shapeForm: glyph ? 'glyph' : form, frame, seed: 3, reverse, authoredRamp: ramp, materialFusion };
  api.paintMaterialInteraction(body, bounds, input, options); group.directBodyRenders++;
  assert.equal(JSON.stringify(input), sourceInput, `${label}: direct materials mutated`); group.inputChecks++;
  const low = luma(ramp[0]), high = luma(ramp.at(-1));
  for (let i = 0; i < before.length; i += 4) {
    if (body.data[i + 3] !== before[i + 3]) throw new Error(`${label}: transparent mask changed at ${i / 4}`);
    if (!before[i + 3]) {
      if (body.data[i] !== before[i] || body.data[i + 1] !== before[i + 1] || body.data[i + 2] !== before[i + 2])
        throw new Error(`${label}: transparent colour changed at ${i / 4}`);
      group.protectedColorChecks++; continue;
    }
    const color = colorAt(before, i), light = luma(color);
    if (Math.max(...color) < 22 || light <= low + 1 || near(color, ramp[0]) || light >= high - 1 || near(color, ramp.at(-1))) {
      if (body.data[i] !== before[i] || body.data[i + 1] !== before[i + 1] || body.data[i + 2] !== before[i + 2])
        throw new Error(`${label}: protected cut/highlight changed at ${i / 4}`);
      group.protectedColorChecks++;
    }
  }
  group.bodyAlphaChecks += before.length / 4;
  group.bodyDigest.update(label).update(Buffer.from(body.data));
  // Probe the same public generic painter separately so the report includes
  // actual post-protection painted counts, rather than nominal owner regions.
  const budgetBody = new api.Pix(body.w, body.h); budgetBody.data.set(before);
  const budget = api.paintAllocatedMixture(budgetBody, bounds, input, { ...options, form: options.shapeForm });
  group.bodyBudgetProbes++;
  group.minimumSafePixels = Math.min(group.minimumSafePixels ?? Infinity, budget.safePixelCount);
  group.maximumSafePixels = Math.max(group.maximumSafePixels, budget.safePixelCount);
  const sizeStats = group.budgetsBySize[size] ??= { probes: 0, underBudget: 0, missingMaterialSlots: 0 };
  sizeStats.probes++;
  if (budget.budget.subpixel.length) {
    group.underBudgetProbes++; group.missingMaterialSlots += budget.budget.subpixel.length;
    sizeStats.underBudget++; sizeStats.missingMaterialSlots += budget.budget.subpixel.length;
    if (underBudgetExamples.length < 24) underBudgetExamples.push({ label, size, safePixels: budget.safePixelCount,
      materials: elements, paintedPixels: [...budget.paintedPixels], missing: budget.budget.subpixel.map(index => elements[index]) });
  }
  assert.equal(budget.paintedPixels.length, elements.length, `${label}: budget lost a physical input`);
  assert.ok(budget.budget.represented.every(index => budget.paintedPixels[index] > 0), `${label}: invisible owner reported visible`);
  return { before, body, bounds, input, options, budget };
}
function* cases(group) {
  if (group === 'catalog') for (let f = 0; f < forms.length; f++) for (let p = 0; p < pairs.length; p++)
    yield { id: `${forms[f]}/${pairs[p].join('+')}`, elements: pairs[p], form: forms[f], frame: 0, night: (f + p) % 2 === 0, direct: 15 };
  if (group === 'structural') for (const shape of structural) for (let p = 0; p < pairs.length; p++)
    yield { id: `${shape}/${pairs[p].join('+')}`, elements: pairs[p], patch: { shapes: [shape] }, frame: 0, night: p % 2 === 0 };
  if (group === 'animation') for (let i = 0; i < pairs.length; i++) for (const kind of ['flight', 'return', 'copies']) for (let frame = 0; frame < 8; frame++)
    yield { id: `${forms[i % forms.length]}/${pairs[i].join('+')}/${kind}/${frame}`, elements: pairs[i], form: forms[i % forms.length], frame,
      night: (i + frame) % 2 === 0, wrap: true, direct: kind === 'copies' ? 4 : 15, reverse: kind === 'return',
      patch: kind === 'copies' ? { intentCount: '6' } : { placement: 'flight', projectile: true, direction: kind === 'return' ? 'back' : 'forward' } };
  if (group === 'fusions') for (let index = 0; index < pairs.length; index++) {
    const elements = pairs[index], materialFusion = confirmedGroups(elements);
    yield { id: `${forms[index % forms.length]}/${elements.join('+')}`, elements, form: forms[index % forms.length], frame: index % 8,
      night: index % 2 === 0, wrap: true, direct: 15,
      patch: { linked: true, merged: materialFusion.length > 0, materialFusion } };
  }
  if (group === 'triples') for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) for (let c = b + 1; c < 16; c++)
    yield { id: [materials[a], materials[b], materials[c]].join('+'), elements: [materials[a], materials[b], materials[c]], frame: 0, night: true, form: 'esfera', direct: 15 };
  if (group === 'many') for (const count of [4, 8, 16]) for (let offset = 0; offset < 16; offset++) for (const reverse of [false, true])
    for (const form of ['lanca', 'anel', 'dragao', 'arvore', 'rede', 'roda', 'castelo', 'morcego']) {
      const elements = Array.from({ length: count }, (_, index) => materials[(index + offset) % 16]); if (reverse) elements.reverse();
      yield { id: `${count}/${offset}/${reverse}/${form}`, elements, form, frame: offset % 8, night: true, direct: 15, reverse, wrap: true,
        patch: { placement: 'flight', projectile: true, direction: reverse ? 'back' : 'forward',
          linked: true, merged: true, materialFusion: confirmedGroups(elements) } };
    }
  if (group === 'glyphs') for (const word of ['CURA', 'ECO', 'AURORA', 'NEXO', 'VÉU', 'A'.repeat(40)]) for (let p = 0; p < pairs.length; p++)
    yield { id: `${word}/${pairs[p].join('+')}`, elements: pairs[p], glyph: word, frame: p % 8, night: true, direct: 15, wrap: p < 8 };
  if (group === 'concepts') {
    for (const concept of concepts) for (let p = 0; p < pairs.length; p++) yield { id: `${concept}/${pairs[p].join('+')}`, elements: pairs[p], form: forms[p % forms.length],
      frame: p % 8, night: true, patch: { concepts: [concept] }, concept, direct: p < 8 ? 15 : undefined, wrap: p < 8 };
    for (const concept of concepts) yield { id: `incorporeal/${concept}`, elements: [], frame: 3, night: true, patch: { shapes: [], concepts: [concept] }, wrap: true };
  }
  if (group === 'orbits') for (const form of ['lanca', 'espada', 'anel', 'dragao', 'morcego', 'arvore', 'rede', 'roda', 'castelo', 'cachorro', 'teia', 'flor'])
    for (let index = 0; index < 16; index++) for (let frame = 0; frame < 8; frame++) {
      const elements = pairs[(index * 17) % pairs.length];
      yield { id: `${form}/${elements.join('+')}/${frame}`, elements, form, frame, night: index % 2 === 0, wrap: true, orbits: true };
    }
}
for (const groupName of selected) {
  const group = ensureGroup(groupName), groupStart = performance.now();
  for (const fixture of cases(groupName)) {
    group.plannedCases++; const assigned = globalIndex++ % shardCount === shardIndex;
    if (!assigned) continue; group.assignedCases++;
    if (executed >= limit) continue;
    const label = `${groupName}/${fixture.id}`;
    try {
      const patch = { ...(fixture.form ? { intentForm: fixture.form } : {}), ...(fixture.glyph ? { intentGlyph: fixture.glyph } : {}), ...fixture.patch };
      assert.ok(!fixture.form || forms.includes(fixture.form), `${label}: fixture is not a public catalog form`);
      const ap = fixture.orbits ? appearance(Array.from({ length: 8 }, () => make(fixture.elements, { ...patch, orbit: true }))) : scene(fixture.elements, patch);
      checkScene(ap, fixture.frame, fixture.night, label, group, fixture.wrap);
      if (fixture.direct) {
        const direct = checkBody(fixture.elements, fixture.glyph ?? fixture.form, fixture.direct, fixture.frame, fixture.reverse ?? false, label, group, !!fixture.glyph,
          fixture.patch?.materialFusion ?? []);
        if (fixture.concept) {
          const without = new api.Pix(direct.body.w, direct.body.h); without.data.set(direct.before);
          const withConcept = copy(without);
          api.paintAllocatedMixture(without, direct.bounds, direct.input, { ...direct.options, form: direct.options.shapeForm });
          api.paintAllocatedMixture(withConcept, direct.bounds, [...direct.input, { element: fixture.concept, ramp: api.SIGNATURE_RAMPS.luz }], { ...direct.options, form: direct.options.shapeForm });
          equalPixels(without.data, withConcept.data, `${label}: concept became a physical body region`);
        }
      }
      group.completedCases++;
    } catch (error) {
      failures.push({ label, message: String(error.message ?? error) });
      // Preserve a concise report for diagnosis, then stop this shard promptly.
      break;
    }
    executed++;
    if (executed % 1000 === 0) console.log(JSON.stringify({ shard: `${shardIndex}/${shardCount}`, completed: executed, group: groupName, seconds: Math.round((performance.now() - started) / 1000) }));
  }
  group.elapsedMs = Math.round(performance.now() - groupStart);
  if (failures.length) break;
}
for (const [file, digest] of Object.entries(sourceHashes))
  assert.equal(sha(fs.readFileSync(path.resolve(root, file))), digest, `Source changed during sweep: ${file}; rerun after edits finish`);
for (const group of Object.values(groups)) {
  group.sceneDigest = group.sceneDigest.digest('hex'); group.bodyDigest = group.bodyDigest.digest('hex');
}
const shardComplete = !failures.length && Object.values(groups).every(group => group.completedCases === group.assignedCases) && selected.length === availableGroups.length;
const complete = shardComplete && shardCount === 1;
const report = { mode: 'production-and-isolated-body-contracts', complete, shardComplete, shard: { index: shardIndex, count: shardCount },
  runtime: { node: process.version, platform: process.platform, arch: process.arch }, elapsedMs: Math.round(performance.now() - started),
  productionBundleHash: sha(source), sourceHashes, scriptHash: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  plan: { groups: selected, fullGroups: availableGroups, catalogForms: forms, bodyMaterials: materials, orderedPairs: pairs,
    structuralForms: structural, conceptRunes: concepts, allCatalogPairsAtFrameZero: 48000, allStructuralPairsAtFrameZero: 960,
    allUnorderedTriples: 560, animationPairFixtures: 240, animationFrames: 8, limit: Number.isFinite(limit) ? limit : null },
  groups, underBudgetExamples, failures,
  interpretation: [
    'Production scenes are opaque. Body masks and protected colours are tested separately on transparent Pix objects through public painters.',
    'The pair/catalog product is exhaustive at frame zero only; 8-frame flight, return and six-copy coverage uses 240 balanced form/pair fixtures, not the entire product.',
    'Every catalog form occurs in the animated fixtures. All 240 ordered pairs occur there, with 40 repeated forms to balance the unequal axis sizes.',
    'Triples are exhaustive without order on one representative intention sphere. Larger sets, concepts, words and eight-member orbits are explicitly sampled axes.',
    'The separate fused/linked sample covers all ordered pairs and all catalog forms with a balanced240-fixture mapping; only actual shared families receive fusion metadata.',
    'Budget reports describe the generic public compositor after protected-pixel filtering. They do not claim every material is legible in every tiny sprite, or measure handcrafted sphere-body regions.',
    'No visual-quality score or mobile frame-rate claim is inferred from passing geometry checks.'
  ] };
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, complete, shardComplete, shard: report.shard, elapsedMs: report.elapsedMs,
  groups: Object.fromEntries(Object.entries(groups).map(([name, group]) => [name, { cases: group.completedCases, productionRenders: group.productionRenders,
    directBodyRenders: group.directBodyRenders, underBudgetProbes: group.underBudgetProbes }])), failures }, null, 2));
if (failures.length) process.exitCode = 1;
