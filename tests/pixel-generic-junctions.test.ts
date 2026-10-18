import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { GRAY_RAMP, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';
import type { BodyMaterial } from '../src/ui/pixel-mixture-signatures';

const bounds = { l: 3, t: 3, r: 45, b: 37 };
function surface(hollow = false): Pix {
  const p = new Pix(49, 41);
  for (let y = 4; y < 37; y++) for (let x = 4; x < 45; x++) {
    if (Math.hypot((x - 24) / 20, (y - 20) / 16) > 1 ||
      (hollow && Math.hypot(x - 24, y - 20) < 5)) continue;
    p.set(x, y, GRAY_RAMP[x < 24 ? 3 : 2]);
  }
  // A carved cut and an authored peak must survive even at a material contact.
  p.line(20, 14, 25, 14, GRAY_RAMP[0]);
  p.set(28, 18, GRAY_RAMP.at(-1)!);
  return p;
}
function mirrored(p: Pix): Pix {
  const q = new Pix(p.w, p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
    q.data.set(p.data.subarray((y * p.w + x) * 4, (y * p.w + x + 1) * 4), (y * p.w + p.w - 1 - x) * 4);
  return q;
}
const pairs: BodyMaterial[][] = [['metal', 'raio'], ['agua', 'raio'], ['natureza', 'agua'], ['luz', 'sombra']];
function paint(original: Pix, elements: BodyMaterial[], frame: number, reverse = false) {
  const p = new Pix(original.w, original.h); p.data.set(original.data);
  const domains = paintAllocatedMixture(p, bounds,
    elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })),
    { frame, reverse, seed: 9, authoredRamp: GRAY_RAMP, ownershipBody: original, preserveAuthoredPrimary: true });
  return { p, domains };
}

describe('generic material junction artwork', () => {
  it('animates only the primary contact lip while preserving remote drawing, cuts, peaks and holes', () => {
    for (const elements of [...pairs, ['agua', 'metal', 'gelo'] as BodyMaterial[]]) for (const hollow of [false, true]) {
      const original = surface(hollow), active = new Set<number>();
      for (let frame = 0; frame < 8; frame++) {
        const { p, domains } = paint(original, elements, frame);
        expect(domains.budget.subpixel, elements.join('+')).toEqual([]);
        const palettes = elements.map(e => new Set(SIGNATURE_RAMPS[e].map(c => c.join(','))));
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          const i = (y * p.w + x) * 4, sample = domains.sampleAt(x, y);
          expect(p.data[i + 3]).toBe(original.data[i + 3]);
          const changed = p.data.subarray(i, i + 3).some((value, c) => value !== original.data[i + c]);
          if (sample?.owner === 0 && sample.contactDistance > 1) expect(changed).toBe(false);
          if (!sample || !original.data[i + 3] || original.data[i] === GRAY_RAMP[0][0] || (x === 28 && y === 18))
            expect(p.data.subarray(i, i + 4)).toEqual(original.data.subarray(i, i + 4));
          if (!sample || !changed) continue;
          if (sample.owner === 0) active.add(i);
          // Borrowed colour is confined to the touching bevel, not the body.
          if (!palettes[sample.owner].has(p.data.subarray(i, i + 3).join(',')))
            expect(sample.contactDistance).toBeLessThanOrEqual(1);
        }
      }
      expect(active.size, `${elements}/${hollow}`).toBeGreaterThan(0);
      const frames = Array.from({ length: 8 }, (_, f) => paint(original, elements, f).p.data.join(','));
      expect(new Set(frames).size, elements.join('+')).toBeGreaterThan(2);
    }
  });

  it('keeps every contact cyclic and the rigid/electric bevel aligned on mirrored returns', () => {
    for (const elements of pairs) for (const hollow of [false, true]) {
      const original = surface(hollow);
      for (let frame = 0; frame < 8; frame++) {
        const forward = paint(original, elements, frame).p;
        if (elements[0] === 'metal') {
          const returned = mirrored(forward);
          expect(paint(mirrored(original), elements, frame, true).p.data.every((v, i) => v === returned.data[i]), `${elements}/${hollow}/${frame}`).toBe(true);
        }
        expect(paint(original, elements, frame + 8).p.data.every((v, i) => v === forward.data[i]), `${elements}/${hollow}/${frame}`).toBe(true);
      }
    }
  });
});
