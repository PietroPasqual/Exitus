import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS, type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { GRAY_RAMP, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const bounds = { l: 3, t: 3, r: 45, b: 37 };
function authored(): Pix {
  const p = new Pix(49, 41);
  for (let y = 4; y < 37; y++) for (let x = 4; x < 45; x++) {
    if (Math.hypot((x - 24) / 20, (y - 20) / 16) > 1 ||
      (x > 27 && x < 32 && y > 15 && y < 22)) continue;
    p.set(x, y, GRAY_RAMP[y < 18 ? 3 : 2]);
  }
  p.line(15, 22, 23, 22, GRAY_RAMP[0]);
  p.set(28, 11, GRAY_RAMP.at(-1)!);
  return p;
}
function mirror(p: Pix): Pix {
  const out = new Pix(p.w, p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
    out.data.set(p.data.subarray((y * p.w + x) * 4, (y * p.w + x + 1) * 4), (y * p.w + p.w - 1 - x) * 4);
  return out;
}
function paint(source: Pix, elements: BodyMaterial[], frame = 3, reverse = false) {
  const body = new Pix(source.w, source.h); body.data.set(source.data);
  const report = paintAllocatedMixture(body, bounds,
    elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })),
    { authoredRamp: GRAY_RAMP, form: 'escudo', seed: 3, frame, reverse });
  return { body, report };
}

describe('universal interlocking material contacts', () => {
  it('keeps a painted region for every ordered pair while preserving cuts and holes', () => {
    const original = authored();
    for (const a of BODY_MATERIALS) for (const b of BODY_MATERIALS) if (a !== b) {
      const { body, report } = paint(original, [a, b]);
      expect(report.budget.subpixel, `${a}/${b}`).toEqual([]);
      expect(report.paintedPixels[1], `${a}/${b}`).toBeGreaterThan(8);
      let preserved = true;
      for (let i = 0; i < original.data.length; i += 4) {
        preserved &&= body.data[i + 3] === original.data[i + 3];
        if (!original.data[i + 3] || original.data[i] === GRAY_RAMP[0][0] || original.data[i] === GRAY_RAMP.at(-1)![0])
          for (let channel = 0; channel < 4; channel++) preserved &&= body.data[i + channel] === original.data[i + channel];
      }
      expect(preserved, `${a}/${b}`).toBe(true);
    }
  });

  it('returns all 240 ordered pair surfaces with the same material ridges and contact fronts', () => {
    const original = authored(), returned = mirror(original);
    for (const a of BODY_MATERIALS) for (const b of BODY_MATERIALS) if (a !== b) {
      const forward = paint(original, [a, b]).body, back = paint(returned, [a, b], 3, true).body;
      const expected = mirror(forward);
      expect(back.data.every((value, i) => value === expected.data[i]), `${a}/${b}`).toBe(true);
    }
  });
});
