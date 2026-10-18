import { describe, expect, it } from 'vitest';
import { INTENTION_CATALOG } from '../src/core/intention';
import { CONCEPT_RUNES } from '../src/core/structural';
import { Pix, type RGB } from '../src/ui/pixel';
import { paintIntention } from '../src/ui/pixel-intention';
import { paintMaterialInteraction } from '../src/ui/pixel-material-interaction';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS, isBodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const pairs = BODY_MATERIALS.flatMap(a => BODY_MATERIALS.filter(b => b !== a).map(b => [a, b] as const));
const luma = (color: RGB): number => color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
const near = (a: RGB, b: RGB): boolean => Math.max(...a.map((value, index) => Math.abs(value - b[index]))) <= 5;
const copy = (pix: Pix): Pix => { const next = new Pix(pix.w, pix.h); next.data.set(pix.data); return next; };

describe('Universal mixtures across the public intention catalog', () => {
  it.each([15, 4].flatMap(size => BODY_MATERIALS.map((primary, index) => ({ size, primary, firstPair: index * 15 }))))(
    'keeps $primary silhouettes, holes, dark cuts and peaks intact at size $size', ({ size, firstPair }) => {
    // 240 fixtures cover every ordered pair and all 200 forms without making
    // the 48,000-case production CLI sweep part of ordinary unit-test runtime.
    for (let index = firstPair; index < firstPair + 15; index++) {
      const elements = pairs[index], form = INTENTION_CATALOG[index % INTENTION_CATALOG.length].id;
      const primary = SIGNATURE_RAMPS[elements[0]], pix = new Pix(96, 96);
      const bounds = paintIntention(pix, form, 48, 48, size, primary, 'energy', 3, elements[0], index % 2 === 0);
      const before = pix.data.slice(), patch = { shapeForm: form, frame: index % 8, seed: 3, reverse: index % 2 === 0 };
      const input = elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] }));
      paintMaterialInteraction(pix, bounds, input, patch);
      const low = luma(primary[0]), high = luma(primary[primary.length - 1]);
      for (let i = 0; i < before.length; i += 4) {
        if (pix.data[i + 3] !== before[i + 3]) throw new Error(`${form}/${elements}: alpha changed at ${i / 4}`);
        if (!before[i + 3]) continue;
        const color: RGB = [before[i], before[i + 1], before[i + 2]], light = luma(color);
        if (Math.max(...color) < 22 || light <= low + 1 || near(color, primary[0]) || light >= high - 1 || near(color, primary[primary.length - 1]))
          if (pix.data[i] !== before[i] || pix.data[i + 1] !== before[i + 1] || pix.data[i + 2] !== before[i + 2])
            throw new Error(`${form}/${elements}: protected anatomy changed at ${i / 4}`);
      }
    }
  });

  it('reports crowded material budgets honestly and excludes all eight concepts from physical ownership', () => {
    // Five existing pixels cannot represent sixteen simultaneous owners, even
    // if a better allocator recovers every usable stroke of a tiny drawing.
    const form = 'glyph', pix = new Pix(16, 16), ramp = SIGNATURE_RAMPS.fogo;
    for (let x = 5; x <= 9; x++) pix.set(x, 8, ramp[3]);
    const bounds = { l: 4, t: 7, r: 10, b: 9 };
    const inputs = BODY_MATERIALS.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] }));
    const options = { form, authoredRamp: ramp };
    const normal = copy(pix), report = paintAllocatedMixture(normal, bounds, inputs, options);
    expect(report.paintedPixels).toHaveLength(16);
    expect(report.budget.subpixel.length).toBeGreaterThan(0);
    expect(report.budget.represented.every(owner => report.paintedPixels[owner] > 0)).toBe(true);
    expect(report.budget.represented.length).toBeLessThanOrEqual(5);
    for (let i = 3; i < pix.data.length; i += 4) expect(normal.data[i]).toBe(pix.data[i]);
    for (const concept of CONCEPT_RUNES) {
      expect(isBodyMaterial(concept)).toBe(false);
      const next = copy(pix);
      const withConcept = paintAllocatedMixture(next, bounds, [...inputs, { element: concept, ramp: SIGNATURE_RAMPS.luz }], options);
      expect(withConcept.paintedPixels).toHaveLength(16);
      expect(next.data).toEqual(normal.data);
    }
  });

  it('measures miniature net ownership without demanding a historical missing-material failure', () => {
    const form = 'rede', pix = new Pix(96, 96), ramp = SIGNATURE_RAMPS.agua;
    const bounds = paintIntention(pix, form, 48, 48, 4, ramp, 'water', 3, 'agua');
    const before = pix.data.slice();
    const elements = ['agua', ...BODY_MATERIALS.filter(element => element !== 'agua')] as const;
    const inputs = elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] }));
    const report = paintAllocatedMixture(pix, bounds, inputs, { form, authoredRamp: ramp });
    expect(report.paintedPixels).toHaveLength(16);
    expect(report.budget.represented.every(owner => report.paintedPixels[owner] > 0)).toBe(true);
    for (let i = 3; i < pix.data.length; i += 4) expect(pix.data[i]).toBe(before[i]);
  });
});
