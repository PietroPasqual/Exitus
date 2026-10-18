import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintIntention } from '../src/ui/pixel-intention';
import { allocateMixtureDomains, type MixtureDomains } from '../src/ui/pixel-mixture-domains';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';
import type { BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import type { IntentionForm } from '../src/core/intention';

const recovered: [IntentionForm, BodyMaterial, BodyMaterial, number[]][] = [
  ['corrente', 'fogo', 'materia', [7, 5]],
  ['flauta', 'sombra', 'metal', [2, 2]],
  ['corrente', 'gravidade', 'agua', [7, 5]]
];
const limited: [IntentionForm, BodyMaterial, BodyMaterial][] = [
  ['chicote', 'fogo', 'sombra'], ['chicote', 'gravidade', 'terra']
];
function paint(form: IntentionForm, primary: BodyMaterial, secondary: BodyMaterial, frame: number, reverse: boolean) {
  const body = new Pix(96, 96), ramp = SIGNATURE_RAMPS[primary];
  const bounds = paintIntention(body, form, 48, 48, 4, ramp,
    primary === 'fogo' ? 'fire' : primary === 'gravidade' ? 'stone' : 'energy', 3, primary, reverse);
  const before = body.data.slice();
  const domains = paintAllocatedMixture(body, bounds,
    [{ element: primary, ramp }, { element: secondary, ramp: SIGNATURE_RAMPS[secondary] }],
    { form, frame, reverse, seed: 3, authoredRamp: ramp, materialFusion: [] });
  return { body, before, domains };
}
function owned(d: MixtureDomains, id: number): number[] {
  return Array.from(d.owner, (owner, index) => owner === id ? index : -1).filter(index => index >= 0);
}

describe('whole authored pieces in fragmented miniature mixtures', () => {
  it.each(recovered)('%s %s/%s uses a coherent native piece in every phase and direction', (form, primary, secondary, sizes) => {
    for (const reverse of [false, true]) {
      let reference: Int16Array | undefined;
      for (let frame = 0; frame < 8; frame++) {
        const { body, before, domains: d } = paint(form, primary, secondary, frame, reverse);
        expect(d.paintedPixels).toEqual(sizes);
        expect(d.budget.subpixel).toEqual([]);
        expect(d.regions[0].pixelCount).toBeGreaterThanOrEqual(d.regions[1].pixelCount);
        expect(d.regions[1].pixelCount).toBeGreaterThanOrEqual(d.budget.minimumRegionPixels);
        expect(d.regions[1].components).toBe(1);
        for (const region of d.regions) if (region.seed)
          expect(d.ownerAt(region.seed.x, region.seed.y)).toBe(region.owner);
        if (reference) expect(d.owner).toEqual(reference); else reference = d.owner.slice();
        const palette = SIGNATURE_RAMPS[primary];
        let alphaChanges = 0, protectedChanges = 0;
        for (let i = 0; i < before.length; i += 4) {
          alphaChanges += Number(body.data[i + 3] !== before[i + 3]);
          const color = before.subarray(i, i + 3);
          const protectedInk = !before[i + 3] || Math.max(...color) < 22 ||
            [palette[0], palette.at(-1)!].some(ink => ink.every((value, c) => Math.abs(value - color[c]) <= 5));
          if (protectedInk && body.data.subarray(i, i + 4).some((value, c) => value !== before[i + c])) protectedChanges++;
        }
        expect(alphaChanges).toBe(0); expect(protectedChanges).toBe(0);
        for (const index of owned(d, 1)) {
          const x = d.bounds.l + index % d.width, y = d.bounds.t + Math.floor(index / d.width);
          // A detached native piece has no invented contact across its cut.
          expect(d.sampleAt(x, y)?.contactOwner).toBe(-1);
          expect(d.sampleAt(x, y)?.contactDistance).toBe(Infinity);
        }
      }
    }
  });

  it.each(limited)('%s %s/%s keeps an honest budget when intact pieces cannot represent the partner', (form, primary, secondary) => {
    for (const reverse of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const { domains: d } = paint(form, primary, secondary, frame, reverse);
      expect(d.budget.subpixel).toEqual([1]);
      expect(d.paintedPixels[1]).toBe(0);
      expect(d.regions[1].seed).toBeNull();
    }
  });

  it('chooses a whole piece near the anatomical anchor, keeps seeds valid, and leaves unmarked allocation unchanged', () => {
    const body = new Pix(24, 14), bounds = { l: 0, t: 0, r: 23, b: 13 };
    // Neither five-pixel piece can split into two four-pixel signatures.
    for (const x of [3, 15]) for (let dx = 0; dx < 5; dx++) body.set(x + dx, 3, [128, 128, 128]);
    body.set(4, 10, [128, 128, 128]); body.set(17, 10, [128, 128, 128]);
    const options = { preferredSeeds: [undefined, { x: 18, y: 3 }] };
    const unmarked = allocateMixtureDomains(body, bounds, 2, options);
    expect(unmarked.budget.subpixel).toEqual([1]);
    const marked = allocateMixtureDomains(body, bounds, 2,
      { ...options, protectedPixels: new Uint8Array(body.w * body.h) });
    expect(marked.regions.map(region => region.pixelCount)).toEqual([7, 5]);
    for (let x = 15; x < 20; x++) expect(marked.ownerAt(x, 3)).toBe(1);
    for (let x = 3; x < 8; x++) expect(marked.ownerAt(x, 3)).toBe(0);
    for (const region of marked.regions) expect(marked.ownerAt(region.seed!.x, region.seed!.y)).toBe(region.owner);
    expect(allocateMixtureDomains(body, bounds, 2, options).owner).toEqual(unmarked.owner);
    const returned = new Pix(body.w, body.h);
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) {
      const i = (y * body.w + x) * 4;
      returned.data.set(body.data.subarray(i, i + 4), (y * body.w + body.w - 1 - x) * 4);
    }
    const reflected = allocateMixtureDomains(returned, bounds, 2,
      { reverse: true, preferredSeeds: [undefined, { x: 5, y: 3 }], protectedPixels: new Uint8Array(body.w * body.h) });
    for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++)
      expect(reflected.ownerAt(x, y)).toBe(marked.ownerAt(body.w - 1 - x, y));
  });

  it('does not turn single-pixel ornaments into sixteen material signatures', () => {
    const body = new Pix(16, 14), bounds = { l: 0, t: 0, r: 15, b: 13 };
    for (let x = 3; x < 6; x++) body.set(x, 3, [128, 128, 128]);
    body.set(10, 8, [128, 128, 128]); body.set(3, 10, [128, 128, 128]);
    const d = allocateMixtureDomains(body, bounds, 16, { protectedPixels: new Uint8Array(body.w * body.h) });
    expect(d.safePixelCount).toBe(5);
    expect(d.budget.represented).toEqual([0]);
    expect(d.budget.subpixel).toHaveLength(15);
    expect(d.regions[0].pixelCount).toBe(5);
  });
});
