import { describe, expect, it, vi } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';
import { INTENTION_CATALOG } from '../src/core/intention';
import { Pix } from '../src/ui/pixel';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS } from '../src/ui/pixel-mixture-signatures';
import { paintMaterialInteraction, usesAllocatedMixture } from '../src/ui/pixel-material-interaction';
import { paintCoherentWaterDragon } from '../src/ui/pixel-coherent-dragon';
import { pairSpriteOf } from '../src/ui/pixel-pair-sprites';
import { renderPixelScene } from '../src/ui/pixel-scene';
import { SIGNATURE_RAMPS as ramps } from './fixtures/material-signature-pix';

vi.mock('../src/ui/pixel-mixture-compositor', { spy: true });
const allocation = vi.mocked(paintAllocatedMixture);
const shapes = ['forma_esfera', 'forma_cubo', 'forma_paralelepipedo', 'forma_piramide'];
const being = (elements = ['agua', 'metal']): Being => ({
  elements, shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false,
  merged: false, materialFusion: [], bond: null, closed: false
});
const scene = (beings: Being[]): Appearance => ({ beings, orbitCount: 0 });
const render = (b: Being, frame = 0) => renderPixelScene(scene([b]), true, frame).pix;
const unchanged = (before: Uint8ClampedArray, after: Uint8ClampedArray, i: number) =>
  before[i] === after[i] && before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2] && before[i + 3] === after[i + 3];

describe('Universal physical mixture routing', () => {
  it('admits all 240 ordered physical pairs for every intention, structural shape, glyph and unshaped body', () => {
    const forms = [undefined, 'glyph', ...shapes, ...INTENTION_CATALOG.map(form => form.id)];
    let routes = 0;
    for (const a of BODY_MATERIALS) for (const b of BODY_MATERIALS) if (a !== b) for (const form of forms) {
      expect(usesAllocatedMixture([a, b], undefined, form), `${a}/${b}/${form}`).toBe(true); routes++;
    }
    expect(routes).toBe(240 * forms.length);
    expect(usesAllocatedMixture(['agua', 'gelo'], 'dragao', 'dragao')).toBe(false);
    expect(usesAllocatedMixture(['agua', 'gelo', 'fogo'], 'dragao', 'dragao')).toBe(false);
    expect(usesAllocatedMixture(['gelo', 'agua'], undefined, 'dragao')).toBe(true);
    expect(usesAllocatedMixture(['agua', 'gelo', 'fogo', 'vento'], 'dragao', 'dragao')).toBe(true);
  });

  it('actually calls the universal painter for all 200 intention silhouettes in production scenes', () => {
    expect(INTENTION_CATALOG).toHaveLength(200);
    for (const form of INTENTION_CATALOG) {
      const b = being(); b.intentForm = form.id;
      const before = structuredClone(b); allocation.mockClear();
      render(b, 3);
      expect(allocation, form.id).toHaveBeenCalled();
      expect(allocation.mock.calls.every(call => call[2].map(m => m.element).join('+') === 'agua+metal'), form.id).toBe(true);
      expect(b).toEqual(before);
    }
  }, 20000);

  it('covers every material in structural, glyph, multipart and unformatted scene paths', () => {
    for (let i = 0; i < BODY_MATERIALS.length; i++) {
      const pair = [BODY_MATERIALS[i], BODY_MATERIALS[(i + 1) % BODY_MATERIALS.length]];
      const fixtures = shapes.map(shape => ({ ...being(pair), shapes: [shape] }));
      fixtures.push({ ...being(pair), intentGlyph: 'RUNA' }, { ...being(pair), shapes: [] },
        { ...being(pair), shapes: ['forma_cubo', 'forma_piramide'], linked: true });
      for (const b of fixtures) {
        allocation.mockClear(); render(b, 2);
        if (pairSpriteOf(b)) expect(allocation).not.toHaveBeenCalled();
        else expect(allocation, `${pair}/${b.intentGlyph ?? b.shapes.join(',')}`).toHaveBeenCalled();
      }
    }
  }, 20000);

  it('keeps stable reference geometry for each deforming coherent body, unshaped fire and sustained jet', () => {
    const fixtures: Being[] = [
      { ...being(['fogo', 'natureza']), intentForm: 'lanca', placement: 'flight' },
      { ...being(['agua', 'metal']), intentForm: 'dragao' },
      { ...being(['raio', 'agua']), intentForm: 'anel' },
      { ...being(['fogo', 'vento']), shapes: [] },
      { ...being(['fogo', 'raio']), shapes: [], materialFusion: [{ family: 'plasma', elements: ['fogo', 'raio'] }] },
      { ...being(['fogo', 'vento']), shapes: [], estado: true, direction: 'forward' }
    ];
    for (const b of fixtures) {
      let reference: Uint8ClampedArray | undefined;
      for (const frame of [0, 1, 4, 7]) {
        allocation.mockClear(); render(b, frame);
        const ownership = allocation.mock.calls[0]?.[3]?.ownershipBody;
        expect(ownership, `${b.elements}/${b.intentForm}/${b.estado}`).toBeDefined();
        if (!b.shapes.length && b.elements[0] === 'fogo' && !b.estado)
          expect(allocation.mock.calls[0]?.[3]?.authoredRamp).toEqual(ramps.fogo);
        if (!reference) reference = ownership!.data.slice();
        else expect(ownership!.data).toEqual(reference);
      }
      expect(render(b, 8).data).toEqual(render(b, 0).data);
    }
  }, 20000);

  it('retains exact loops and input data in copied, returning and orbital mixtures', () => {
    const fixtures = [
      { ...being(['fogo', 'agua', 'natureza']), intentForm: 'espada' as const, intentCount: '3', placement: 'flight' as const },
      { ...being(['metal', 'sombra', 'luz']), intentGlyph: 'RUNA', direction: 'back' as const },
      { ...being(['agua', 'raio', 'terra']), intentForm: 'dragao' as const, orbit: true }
    ];
    for (const b of fixtures) {
      const ap = scene([being(['vento', 'natureza']), b]), original = structuredClone(ap);
      const first = renderPixelScene(ap, false, 0).pix;
      expect(renderPixelScene(ap, false, 8).pix.data).toEqual(first.data);
      expect(renderPixelScene(ap, false, -8).pix.data).toEqual(first.data);
      expect(ap).toEqual(original);
    }
  }, 20000);

  it('preserves the authored water dragon face, cuts, holes and alpha in its retained icy anatomy', () => {
    for (const reverse of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(96, 80), q = paintCoherentWaterDragon(p, 48, 40, 15, ramps.agua, 3, frame, reverse);
      const before = p.data.slice();
      allocation.mockClear();
      paintMaterialInteraction(p, q, ['agua', 'gelo', 'fogo'].map(element => ({ element, ramp: ramps[element as keyof typeof ramps] })),
        { form: 'dragao', shapeForm: 'dragao', frame, reverse, materialFusion: [] });
      expect(allocation).not.toHaveBeenCalled();
      let changed = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const i = (y * p.w + x) * 4;
        expect(p.data[i + 3]).toBe(before[i + 3]);
        if (!before[i + 3] || (reverse ? x < 35 : x > 61)) expect(unchanged(before, p.data, i)).toBe(true);
        if (!unchanged(before, p.data, i)) changed++;
      }
      expect(changed).toBeGreaterThan(25);
    }
  }, 20000);
});
