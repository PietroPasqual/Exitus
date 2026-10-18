import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { materialContactFinish, sharedContactPulse } from '../src/ui/pixel-mixture-contact';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS, MATERIAL_SIGNATURES, type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { GRAY_RAMP, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const pairs = BODY_MATERIALS.flatMap(a => BODY_MATERIALS.filter(b => b !== a).map(b => [a, b] as const));
const bounds = { l: 3, t: 3, r: 31, b: 29 };
function surface(): Pix {
  const p = new Pix(35, 33);
  for (let y = 4; y < 29; y++) for (let x = 4; x < 31; x++) {
    if (Math.hypot((x - 17) / 13, (y - 16) / 12) > 1 || Math.hypot(x - 17, y - 16) < 3) continue;
    p.set(x, y, GRAY_RAMP[x < 17 ? 3 : 2]);
  }
  p.line(12, 10, 17, 10, GRAY_RAMP[0]);
  p.set(21, 18, GRAY_RAMP.at(-1)!);
  return p;
}
function mirror(p: Pix): Pix {
  const q = new Pix(p.w, p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = (y * p.w + x) * 4, j = (y * p.w + p.w - 1 - x) * 4;
    q.data.set(p.data.subarray(i, i + 4), j);
  }
  return q;
}
function painted(original: Pix, elements: readonly BodyMaterial[], frame: number, reverse = false): Pix {
  const p = new Pix(original.w, original.h); p.data.set(original.data);
  paintAllocatedMixture(p, bounds, elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })),
    { frame, reverse, seed: 7, authoredRamp: GRAY_RAMP, ownershipBody: original, preserveAuthoredPrimary: true });
  return p;
}

describe('Integrated native-pixel material finishes', () => {
  it('models a wet meniscus above its darker inner channel and an adjacent organic vein', () => {
    const waterLip = materialContactFinish('agua', 'metal', 0, 1, .2, true);
    const waterChannel = materialContactFinish('agua', 'metal', 1, 1, .2, true);
    expect(waterLip.lift).toBeGreaterThan(.15);
    expect(waterChannel.lift).toBeLessThan(0);
    expect(waterLip.reflection).toBeGreaterThan(0);
    expect(waterChannel.reflection).toBe(0);
    const leafLip = materialContactFinish('natureza', 'agua', 0, 1, .2, true);
    const leafVein = materialContactFinish('natureza', 'agua', 1, 1, .2, true);
    expect(leafVein.lift).toBeGreaterThan(leafLip.lift + .1);
    expect(materialContactFinish('acido', 'metal', 0, 1, 0, true).lift)
      .toBeLessThan(materialContactFinish('agua', 'metal', 0, 1, 0, true).lift);
  });

  it('leaves a cooler hard shoulder after a hot front and a readable field fold', () => {
    for (const material of ['terra', 'metal', 'gelo', 'materia'] as const) {
      const front = materialContactFinish(material, 'fogo', 1, 1, 0, true);
      const wake = materialContactFinish(material, 'fogo', 1, 0, 1, true);
      expect(front.lift).toBeGreaterThan(0);
      expect(wake.lift).toBeLessThan(0);
    }
    for (const material of ['ilusao', 'sombra', 'gravidade', 'espaco'] as const) {
      expect(materialContactFinish(material, 'metal', 0, .7, .2, true).lift).toBeLessThan(0);
      expect(materialContactFinish(material, 'metal', 1, .7, .2, true).lift).toBeGreaterThan(0);
    }
  });

  it('confines borrowed hues to the touching lip, holds rigid geometry and simplifies tiny LODs for all ordered pairs', () => {
    for (const [a, b] of pairs) for (let frame = 0; frame < 8; frame++) {
      const pulse = sharedContactPulse(.3, .6, frame), trailing = sharedContactPulse(.3, .6, frame - 1);
      for (const distance of [0, 1, 2, 8, Infinity]) {
        const finish = materialContactFinish(a, b, distance, pulse, trailing, true);
        expect(Object.values(finish).every(Number.isFinite), `${a}/${b}/${distance}`).toBe(true);
        if (distance > 1) expect(finish.reflection).toBe(0);
        if (MATERIAL_SIGNATURES[a].rigid) expect(finish.bend).toBe(0);
        const tiny = materialContactFinish(a, b, distance, pulse, trailing, false);
        expect(tiny).toEqual(materialContactFinish(a, b, distance, 1 - pulse, 1 - trailing, false));
        expect(tiny.reflection).toBe(0); expect(tiny.bend).toBe(0);
      }
    }
  });

  it('returns the exact mirrored contact artwork for all 240 ordered pairs through the whole loop', () => {
    const original = surface(), returned = mirror(original);
    for (const elements of pairs) for (let frame = 0; frame < 8; frame++) {
      const forward = painted(original, elements, frame);
      const reversed = painted(returned, elements, frame, true);
      const expected = mirror(forward);
      expect(reversed.data.every((value, index) => value === expected.data[index]), `${elements}/${frame}`).toBe(true);
      if (!frame) expect(painted(original, elements, 8).data).toEqual(forward.data);
    }
  }, 30000);
});
