import { describe, expect, it } from 'vitest';
import { analyzeFlow } from '../src/core/flow';
import { describeAppearance } from '../src/core/appearance';
import { isMaintainedDirectedStream } from '../src/core/spell-narrative-semantics';
import { BODY_MATERIALS } from '../src/ui/pixel-mixture-signatures';
import { materialStreamBounds } from '../src/ui/pixel-material-stream';
import { renderPixelScene } from '../src/ui/pixel-scene';
import { appearanceForScene, boundsOfBeing, layoutParts, layoutScene } from '../src/ui/pixel-scene-layout';
import baseline from './fixtures/directed-stream-controls.json';
import { modelOf } from './helpers';

const variants = ['no-state', 'no-direction', 'return', 'shape', 'projectile', 'orbit'] as const;
type Variant = typeof variants[number];
const interpret = (material: string, variant?: Variant) => {
  const m = modelOf('ex2');
  m.nodes.forEach(n => {
    if (n.rune === 'fogo') n.rune = material;
    if (variant === 'no-state' && n.rune === 'mod_estado') n.rune = null;
    if (variant === 'no-direction' && n.rune === 'dir_padrao') n.rune = null;
    if (variant === 'return' && n.rune === 'dir_padrao') n.rune = 'dir_contraria';
  });
  const top = m.nodes.find(n => n.id === 'n_top')!;
  if (variant === 'shape') top.inner = ['forma_esfera'];
  if (variant === 'projectile') top.inner = ['mod_projetil'];
  if (variant === 'orbit') top.inner = ['mod_orbita'];
  return describeAppearance(m, analyzeFlow(m));
};
const hash = async (data: Uint8ClampedArray): Promise<string> => Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', new Uint8Array(data))
)).map(n => n.toString(16).padStart(2, '0')).join('');

describe('Maintained material streams in the actual scene', () => {
  it.each(BODY_MATERIALS)('%s uses the same source/layout in all eight complete poses', material => {
    const ap = interpret(material), b = ap.beings[0], snapshot = JSON.stringify(ap);
    expect(isMaintainedDirectedStream(b)).toBe(true);
    const signatures: string[] = [];
    for (let frame = 0; frame < 8; frame++) {
      const l = layoutScene(ap, frame), p = l.poses.get(b)!, q = materialStreamBounds(p.s);
      expect(layoutParts(b, p.s)).toMatchObject({ width: q.r - q.l, top: q.t, bottom: q.b });
      expect(boundsOfBeing(b, p).l).toBeCloseTo(l.casterX + 18);
      expect(p.y + p.s * .25).toBeCloseTo(77);
      signatures.push(renderPixelScene(ap, true, frame).pix.data.join(','));
    }
    expect(new Set(signatures).size).toBe(8);
    expect(renderPixelScene(ap, true, 8).pix.data.join(',')).toBe(signatures[0]);
    expect(renderPixelScene(ap, true, -1).pix.data.join(',')).toBe(signatures[7]);
    expect(renderPixelScene(ap, true, NaN).pix.data.join(',')).toBe(signatures[0]);
    expect(JSON.stringify(ap)).toBe(snapshot);
  });

  it.each(BODY_MATERIALS)('%s preserves released pixels outside the structural gate', async material => {
    for (const variant of variants) {
      const ap = interpret(material, variant);
      expect(ap.beings.every(b => !isMaintainedDirectedStream(b)), variant).toBe(true);
      const hashes: string[] = [];
      for (const night of [false, true]) for (const frame of [0, 3, 7]) hashes.push(await hash(renderPixelScene(ap, night, frame).pix.data));
      expect(hashes, variant).toEqual(baseline.entries[material][variant]);
    }
  });

  it('keeps the released pure-fire scene byte-identical', async () => {
    const ap = interpret('fogo'), hashes: string[] = [];
    for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) hashes.push(await hash(renderPixelScene(ap, night, frame).pix.data));
    expect(hashes).toEqual(baseline.fire);
  });

  it.each(BODY_MATERIALS)('%s keeps the existing six-copy limit bounded', material => {
    const original = interpret(material); original.beings[0].intentCount = '8';
    const ap = appearanceForScene(original);
    expect(ap.beings).toHaveLength(6);
    for (let frame = 0; frame < 8; frame++) {
      const l = layoutScene(ap, frame);
      for (const b of ap.beings) {
        expect(isMaintainedDirectedStream(b)).toBe(true);
        const q = boundsOfBeing(b, l.poses.get(b)!);
        expect(q.l).toBeGreaterThan(0); expect(q.r).toBeLessThan(180);
        expect(q.t).toBeGreaterThan(0); expect(q.b).toBeLessThan(101);
      }
    }
  });

  it.each([
    ['agua', 'gelo'], ['gelo', 'agua'], ['raio', 'metal'], ['metal', 'raio'], ['agua', 'gelo', 'fogo']
  ])('keeps the real mixed model order for %s / %s / %s', (...elements: string[]) => {
    const m = modelOf('ex2'); let index = 0;
    m.nodes.forEach(n => { if (n.rune === 'fogo') n.rune = elements[index++]; });
    if (elements.length === 3) m.nodes.find(n => n.id === 'n_top')!.inner = [elements[2]];
    const ap = describeAppearance(m, analyzeFlow(m)), before = JSON.stringify(ap);
    expect(ap.beings).toHaveLength(1);
    expect(ap.beings[0].elements).toEqual(elements);
    expect(isMaintainedDirectedStream(ap.beings[0])).toBe(true);
    for (const night of [false, true]) {
      const signatures = Array.from({ length: 8 }, (_, frame) => renderPixelScene(ap, night, frame).pix.data.join(','));
      expect(new Set(signatures).size).toBe(8);
      expect(renderPixelScene(ap, night, 8).pix.data.join(',')).toBe(signatures[0]);
    }
    expect(JSON.stringify(ap)).toBe(before);
  });

});
