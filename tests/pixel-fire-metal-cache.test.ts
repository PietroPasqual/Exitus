import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintFireMetalSphere, type FireMetalPrimary } from '../src/ui/pixel-fire-metal-sphere';

describe('bounded rigid fire/metal surface cache', () => {
  it('preserves the reviewed contact-wave raster across scales, fractional centres, dominance and every phase', async () => {
    const bytes = new Uint8Array(448 * 80 * 80 * 4); let offset = 0;
    for (const size of [1.5, 3, 7.999, 8, 8.001, 15, 20])
      for (const x of [40, 40.5]) for (const y of [39.25, 39.75])
        for (const primary of ['fogo', 'metal'] as const) for (let frame = 0; frame < 8; frame++) {
          const p = new Pix(80, 80); paintFireMetalSphere(p, x, y, size, frame, primary);
          bytes.set(p.data, offset); offset += p.data.length;
        }
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    expect(Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join(''))
      .toBe('0bf113861530bf727c1c3946bbb6e65f0847709c702dea70fd852a5eb0d5a40a');
  });

  it('keeps A→B→A exact after eviction and reuse with a new target and moving phases', () => {
    const draw = (size: number, x: number, y: number, primary: FireMetalPrimary, frame: number) => {
      const p = new Pix(80, 80); paintFireMetalSphere(p, x, y, size, frame, primary); return p.data;
    };
    for (const primary of ['fogo', 'metal'] as const) for (let frame = 0; frame < 8; frame++) {
      const original = draw(15, 40.5, 39.25, primary, frame);
      for (let i = 0; i < 30; i++) draw(2 + i / 2, 39 + i % 4 * .25, 40 + i % 3 * .25,
        i % 2 ? 'metal' : 'fogo', i % 8);
      const repeated = draw(15, 40.5, 39.25, primary, frame);
      expect(repeated.every((v, i) => v === original[i])).toBe(true);
    }
  });
});
