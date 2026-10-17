import { describe, expect, it } from 'vitest';
import { analyzeCircuit } from '../src/core/analysis';
import { describeAppearance, type Appearance, type Being } from '../src/core/appearance';
import type { Model } from '../src/core/circles';
import { checkEstados } from '../src/core/estado';
import { analyzeFlow } from '../src/core/flow';
import { checkProjectiles } from '../src/core/projectile';
import { checkArea, checkIntencao, checkLigacao, checkSer, checkToque } from '../src/core/structural';
import { PRESETS } from '../src/data/presets';
import { appearanceForScene, layoutScene } from '../src/ui/pixel-scene-layout';
import legacyPresets from './fixtures/material-fusion-legacy.json';
import { cable, model, modelOf, node, prism } from './helpers';

function chain(groups: string[][], prefix = ''): Model {
  const nodes = [prism(null), ...groups.map((runes, i) => ({
    ...node(`${prefix}n${i}`, 'circle', Math.cos(i) * 170, Math.sin(i) * 170, runes[0]),
    ...(runes.length > 1 ? { inner: runes.slice(1) } : {})
  }))];
  return model(nodes, nodes.map((n, i) => cable(n.id, nodes[(i + 1) % nodes.length].id)));
}
const appearance = (m: Model): Appearance => describeAppearance(m, analyzeFlow(m));
const legacy = (ap: Appearance) => ({ ...ap, beings: ap.beings.map(({ materialFusion, ...being }) => {
  void materialFusion;
  return being;
}) });
const digest = async (text: string): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
)).map(byte => byte.toString(16).padStart(2, '0')).join('');
const options = { specMode: 'simultaneous', missingMat: false } as const;
const serialize = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item instanceof Set || item instanceof Map ? [...item] : item);
const fusionChain = (fireTogether: boolean, prefix = ''): Model => chain([
  ...(fireTogether ? [['fogo', 'raio']] : [['fogo'], ['raio']]),
  ['forma_esfera'], ['agua'], ['gelo'], ['forma_cubo'], ['mod_ligacao']
], prefix);

// Recorded from ddf4e5d322647b35d7b0bc02b69d1040d379e3bc before adding display
// metadata. Only that new property is stripped; every legacy field is compared.
describe('Read-only fusion presentation and original rule semantics', () => {
  it('retains the full 45-preset release baseline', () => {
    expect(Object.keys(PRESETS)).toHaveLength(45);
    expect(Object.keys(legacyPresets)).toEqual(Object.keys(PRESETS));
  });

  it.each(Object.entries(legacyPresets))('%s preserves every legacy appearance and checker outcome', async (key, baseline) => {
    const m = modelOf(key), flow = analyzeFlow(m), before = serialize({ m, flow });
    const ap = describeAppearance(m, flow);
    expect(legacy(ap)).toEqual(baseline.appearance);
    const checks = {
      analysis: analyzeCircuit(m, options), ser: checkSer(m, flow), toque: checkToque(m, flow),
      area: checkArea(m, flow), links: checkLigacao(m, flow), intents: checkIntencao(m, flow),
      estados: checkEstados(m, flow), projectiles: checkProjectiles(m, flow)
    };
    expect(await digest(serialize(checks))).toBe(baseline.checkerDigest);
    expect(serialize({ m, flow })).toBe(before);
  });

  it('distinguishes identical legacy appearances with different actual checker groups', () => {
    const one = fusionChain(true), both = fusionChain(false);
    const first = appearance(one), second = appearance(both);
    expect(legacy(first)).toEqual(legacy(second));
    expect(first.beings[0]).toMatchObject({ merged: true, linked: true });
    expect(first.beings[0].materialFusion).toEqual([{ family: 'tempo', elements: ['agua', 'gelo'] }]);
    expect(second.beings[0].materialFusion).toEqual([
      { family: 'materia', elements: ['fogo', 'raio'] }, { family: 'tempo', elements: ['agua', 'gelo'] }
    ]);
    for (const m of [one, both]) expect(appearance(m).beings[0].materialFusion)
      .toEqual(checkLigacao(m, analyzeFlow(m))[0].merged);
  });

  it('never infers fusion from matching families on one node or mere co-presence', () => {
    for (const groups of [
      [['fogo', 'raio'], ['forma_esfera'], ['forma_cubo'], ['mod_ligacao']],
      [['fogo'], ['raio'], ['forma_esfera'], ['forma_cubo']],
      [['fogo'], ['agua'], ['forma_esfera'], ['forma_cubo'], ['mod_ligacao']]
    ]) expect(appearance(chain(groups)).beings[0].materialFusion ?? []).toEqual([]);
  });

  it('projects a checker-confirmed group supported by a concept without requiring two physical nodes', () => {
    const m = chain([['fogo', 'raio'], ['vida'], ['forma_esfera'], ['forma_cubo'], ['mod_ligacao']]);
    const flow = analyzeFlow(m), before = serialize({ m, flow });
    const links = checkLigacao(m, flow), ap = describeAppearance(m, flow);
    expect(links[0].merged).toEqual([{ family: 'materia', elements: ['fogo', 'raio', 'vida'] }]);
    expect(ap.beings[0].materialFusion).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
    expect(legacy(ap)).toEqual({
      beings: [{
        elements: ['fogo', 'raio'], shapes: ['forma_esfera', 'forma_cubo'], concepts: ['vida'],
        placement: 'front', projectile: false, orbit: false, direction: null, guards: [],
        estado: false, linked: true, merged: true, bond: null, closed: false
      }], orbitCount: 0
    });
    expect(checkLigacao(m, flow)).toEqual(links);
    expect(serialize({ m, flow })).toBe(before);
  });

  it('projects physical membership only after scoping all contributing concept members', () => {
    const m = chain([['vida'], ['luz'], ['forma_esfera'], ['forma_cubo'], ['mod_ligacao']]);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([
      { family: 'materia', elements: ['vida', 'luz'] }
    ]);
    expect(appearance(m).beings[0]).toMatchObject({
      elements: ['luz'], concepts: ['vida'], linked: true, merged: true
    });
    // Concept support confirms a checker group, not repeated physical Luz.
    expect(appearance(m).beings[0].materialFusion ?? []).toEqual([]);
    const concepts = chain([['movimento'], ['tempo'], ['forma_esfera'], ['forma_cubo'], ['mod_ligacao']]);
    expect(checkLigacao(concepts, analyzeFlow(concepts))[0].merged).toHaveLength(1);
    expect(appearance(concepts).beings[0].materialFusion ?? []).toEqual([]);
  });

  it('does not borrow concept support from a different parallel Ser being', () => {
    const fire = node('fire', 'circle', 20, -80, 'fogo'); fire.inner = ['raio'];
    const m = model([
      prism(null), fire, node('sphere', 'circle', 70, -80, 'forma_esfera'),
      node('link', 'circle', 130, -80, 'mod_ligacao'), node('fire-ser', 'circle', 160, -80, 'mod_ser'),
      node('life', 'circle', 20, 80, 'vida'), node('cube', 'circle', 70, 80, 'forma_cubo'),
      node('life-ser', 'circle', 130, 80, 'mod_ser')
    ], [
      cable('prism_center', 'fire'), cable('fire', 'sphere'), cable('sphere', 'link'),
      cable('link', 'fire-ser'), cable('fire-ser', 'prism_center'),
      cable('prism_center', 'life'), cable('life', 'cube'), cable('cube', 'life-ser'),
      cable('life-ser', 'prism_center')
    ]);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([
      { family: 'materia', elements: ['fogo', 'raio', 'vida'] }
    ]);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.every(being => !being.materialFusion?.length)).toBe(true);
  });

  it('does not leak a prior fusion across Ser to another pair with the same rune names', () => {
    const ap = appearance(chain([
      ['fogo'], ['forma_esfera'], ['raio'], ['forma_cubo'], ['mod_ligacao'], ['mod_ser'],
      ['fogo'], ['forma_esfera'], ['raio'], ['forma_cubo'], ['mod_ser']
    ]));
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings[0].materialFusion).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
    expect(ap.beings[1].materialFusion ?? []).toEqual([]);
  });

  it('keeps successful groups separate when the legacy checker summary unions routes at one link', () => {
    const m = model([prism(null), node('link', 'circle', 150, 0, 'mod_ligacao')], []);
    for (const [i, secondary] of ['raio', 'luz'].entries()) {
      const route = ['fogo', secondary, 'forma_esfera', 'forma_cubo'].map((rune, n) =>
        node(`route${i}-${n}`, 'circle', 25 + n * 25, 60 * (i ? 1 : -1), rune));
      m.nodes.push(...route);
      const ids = ['prism_center', ...route.map(n => n.id), 'link'];
      m.connections.push(...ids.slice(0, -1).map((id, n) => cable(id, ids[n + 1])));
    }
    m.connections.push(cable('link', 'prism_center'));
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([
      { family: 'materia', elements: ['fogo', 'raio', 'luz'] }
    ]);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0].materialFusion).toEqual([
      { family: 'materia', elements: ['fogo', 'raio'] },
      { family: 'materia', elements: ['fogo', 'luz'] }
    ]);
    expect(ap.beings[0].materialFusion!.some(group =>
      group.elements.includes('raio') && group.elements.includes('luz'))).toBe(false);
  });

  it('keeps later actual groups even when the untouched legacy first-link flag is false', () => {
    const m = chain([
      ['fogo'], ['forma_esfera'], ['mod_ligacao'], ['raio'], ['forma_cubo'], ['mod_ligacao']
    ]);
    const links = checkLigacao(m, analyzeFlow(m));
    expect(links[0].merged).toEqual([]);
    expect(links[1].merged).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
    expect(appearance(m).beings[0]).toMatchObject({
      linked: true, merged: false, materialFusion: [{ family: 'materia', elements: ['fogo', 'raio'] }]
    });
  });

  it('preserves an actual same-material merge without inventing extra constituents', () => {
    const m = chain([['fogo'], ['forma_esfera'], ['fogo'], ['forma_cubo'], ['mod_ligacao']]);
    expect(appearance(m).beings[0].materialFusion).toEqual([{ family: 'materia', elements: ['fogo'] }]);
  });

  it('uses occurrence identity across two inner Ser closures in one seal', () => {
    const m = chain([['raio', 'forma_cubo', 'mod_ligacao', 'mod_ser', 'raio', 'forma_cubo', 'mod_ser']]);
    m.nodes[0].rune = 'fogo'; m.nodes[0].inner = ['forma_esfera'];
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.map(being => being.elements)).toEqual([['fogo', 'raio'], ['fogo', 'raio']]);
    expect(ap.beings[0].materialFusion).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
    expect(ap.beings[1].materialFusion ?? []).toEqual([]);
  });

  it('keeps two parallel Ser beings separate even when the checker merges their materials', () => {
    const m = model([
      prism(null), node('fire', 'circle', 20, -80, 'fogo'), node('sphere', 'circle', 70, -80, 'forma_esfera'),
      node('link', 'circle', 130, -80, 'mod_ligacao'), node('fire-ser', 'circle', 160, -80, 'mod_ser'),
      node('lightning', 'circle', 20, 80, 'raio'), node('cube', 'circle', 70, 80, 'forma_cubo'),
      node('lightning-ser', 'circle', 130, 80, 'mod_ser')
    ], [
      cable('prism_center', 'fire'), cable('fire', 'sphere'), cable('sphere', 'link'),
      cable('link', 'fire-ser'), cable('fire-ser', 'prism_center'),
      cable('prism_center', 'lightning'), cable('lightning', 'cube'), cable('cube', 'lightning-ser'),
      cable('lightning-ser', 'prism_center')
    ]);
    expect(checkLigacao(m, analyzeFlow(m))[0].merged).toEqual([{ family: 'materia', elements: ['fogo', 'raio'] }]);
    const ap = appearance(m);
    expect(ap.beings).toHaveLength(2);
    expect(ap.beings.every(being => !(being.materialFusion?.length))).toBe(true);
  });

  it('isolates observer copies from checker state and leaves the public return unchanged', () => {
    const m = fusionChain(false), flow = analyzeFlow(m), before = checkLigacao(m, flow);
    const observed = checkLigacao(m, flow, group => {
      // Deliberately bypass readonly at this test boundary: the collector must
      // still never hand out references to the checker's sets, model or steps.
      (group.elements as string[]).push('not-a-rune');
      (group.members[0] as { rune: string }).rune = 'not-a-rune';
    });
    expect(observed).toEqual(before);
    expect(checkLigacao(m, flow)).toEqual(before);
    expect(appearance(m).beings[0].materialFusion).toEqual(before[0].merged);
  });

  it('does not infer cross-family membership because another family made merged true', () => {
    const ap = appearance(fusionChain(true)), groups = ap.beings[0].materialFusion!;
    expect(groups.some(group => group.elements.includes('fogo'))).toBe(false);
    expect(groups.some(group => group.elements.includes('raio'))).toBe(false);
    expect(groups.some(group => group.elements.includes('agua') && group.elements.includes('gelo'))).toBe(true);
  });

  it('clones every level of fusion metadata for numeric visual copies', () => {
    const source = appearance(fusionChain(false)); source.beings[0].intentCount = '3';
    const before = structuredClone(source), copies = appearanceForScene(source);
    expect(copies.beings).toHaveLength(3);
    for (const copy of copies.beings) {
      expect(copy.materialFusion).toEqual(source.beings[0].materialFusion);
      expect(copy.materialFusion).not.toBe(source.beings[0].materialFusion);
      copy.materialFusion!.forEach((group, i) => {
        expect(group).not.toBe(source.beings[0].materialFusion![i]);
        expect(group.elements).not.toBe(source.beings[0].materialFusion![i].elements);
      });
    }
    expect(copies.beings[0].materialFusion![0]).not.toBe(copies.beings[1].materialFusion![0]);
    expect(appearanceForScene(copies)).toBe(copies);
    expect(source).toEqual(before);
  });

  it('keeps old hand-authored fixtures conservative and does not manufacture metadata in copies', () => {
    const source = legacy(appearance(fusionChain(false)));
    source.beings[0].intentCount = '2';
    expect(source.beings[0].merged).toBe(true);
    expect(appearanceForScene(source).beings.every(being => !('materialFusion' in being))).toBe(true);
  });
});

const orbit = (beings: Being[]): Appearance => ({ beings: beings.map(being => ({ ...being, orbit: true })), orbitCount: beings.length });

describe('Fusion identity in homogeneous orbit cohorts', () => {
  it('does not permute beings with distinct actual fusion groups despite equal legacy appearances', () => {
    const members = [appearance(fusionChain(true)).beings[0], appearance(fusionChain(false)).beings[0]];
    const ap = orbit(members);
    expect(layoutScene(ap).rings[0].angularStep).toBeCloseTo(Math.PI / 4);
    for (let frame = 0; frame < 8; frame++) {
      const scene = layoutScene(ap, frame);
      ap.beings.forEach((being, i) => expect(scene.poses.get(being)!.orbit!.renderIndex).toBe(i));
    }
  });

  it('permutes equal visual fusion groups with different source-node provenance', () => {
    const members = Array.from({ length: 8 }, (_, i) => appearance(fusionChain(false, `copy${i}-`)).beings[0]);
    const ap = orbit(members);
    expect(layoutScene(ap).rings[0].angularStep).toBeCloseTo(Math.PI / 32);
    expect(new Set(Array.from({ length: 8 }, (_, frame) => {
      const scene = layoutScene(ap, frame);
      return ap.beings.map(being => {
        const pose = scene.poses.get(being)!;
        expect(pose.orbit!.renderIndex).toBe(0);
        return `${Math.round(pose.x)},${Math.round(pose.y)}`;
      }).sort().join(';');
    })).size).toBe(8);
  });

  it('normalizes visual group/member order without unioning overlapping groups', () => {
    const source = appearance(fusionChain(false)).beings[0];
    const reordered = { ...source, materialFusion: [...source.materialFusion!].reverse().map(group => ({
      family: group.family, elements: [...group.elements].reverse()
    })) };
    expect(layoutScene(orbit([source, reordered])).rings[0].angularStep).toBeCloseTo(Math.PI / 8);
    const separated = { ...source, materialFusion: [
      { family: 'materia', elements: ['fogo', 'raio'] }, { family: 'materia', elements: ['fogo', 'luz'] }
    ] };
    const combined = { ...source, materialFusion: [{ family: 'materia', elements: ['fogo', 'raio', 'luz'] }] };
    expect(layoutScene(orbit([separated, combined])).rings[0].angularStep).toBeCloseTo(Math.PI / 4);
  });
});
