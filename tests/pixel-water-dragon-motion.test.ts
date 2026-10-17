import { describe, expect, it } from 'vitest';
import { Pix, type RGB } from '../src/ui/pixel';
import { paintCoherentWaterDragon, waterDragonBounds } from '../src/ui/pixel-coherent-dragon';

const ramp: RGB[] = [[18, 35, 70], [23, 70, 106], [35, 126, 155], [77, 186, 197], [157, 229, 223], [236, 255, 241]];
const draw = (s: number, frame: number, reverse = false, x = 90, y = 52): Pix => {
  const pix = new Pix(180, 105);
  paintCoherentWaterDragon(pix, x, y, s, ramp, 5, frame, reverse);
  return pix;
};
const occupied = (pix: Pix): number[] => {
  const result: number[] = [];
  for (let i = 0; i < pix.w * pix.h; i++) if (pix.data[i * 4 + 3]) result.push(i);
  return result;
};

describe('Water dragon creature motion', () => {
  it.each([6, 15])('moves the %s-size silhouette while keeping its feet rooted', s => {
    const frames = Array.from({ length: 8 }, (_, frame) => draw(s, frame));
    expect(new Set(frames.map(p => occupied(p).join(','))).size).toBeGreaterThanOrEqual(6);
    const floorRow = 52 + Math.ceil(19 * s / 15);
    const feet = frames.map(p => occupied(p).filter(i => Math.floor(i / p.w) >= floorRow));
    for (const foot of feet.slice(1)) expect(foot).toEqual(feet[0]);
  });

  it('keeps the protected eye attached to the nodding head', () => {
    for (let frame = 0; frame < 8; frame++) {
      const turn = frame * Math.PI / 4, pix = draw(15, frame);
      const x = 90 + Math.round(18 + 1.7 * Math.sin(turn));
      const y = 52 + Math.round(-13 - 1.75 * Math.sin(turn));
      expect(Array.from(pix.data.slice((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 3))).toEqual(ramp[5]);
    }
  });

  it('moves the miniature wing and tail without restoring the navy checkerboard', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => draw(2.1, frame));
    expect(new Set(frames.map(p => occupied(p).join(','))).size).toBeGreaterThanOrEqual(3);
    for (const pix of frames) for (const i of occupied(pix)) expect(pix.data[i * 4]).toBeGreaterThan(ramp[1][0]);
  });

  it.each([.5, 1, 2.1, 3.99, 4, 6, 15, 20])('encloses and connects every %s-size pose at fractional origins', s => {
    for (const fraction of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const x = 90 + fraction, y = 52 - fraction, pix = draw(s, frame, false, x, y);
      const mirrored = draw(s, frame, true, x, y), bounds = waterDragonBounds(s);
      const points = occupied(pix), pending = new Set(points);
      expect(points.length).toBeGreaterThan(0);
      for (const i of points) {
        const px = i % pix.w, py = Math.floor(i / pix.w), mx = 2 * Math.round(x) - px;
        expect(px).toBeGreaterThanOrEqual(x + bounds.l);
        expect(px).toBeLessThanOrEqual(x + bounds.r);
        expect(py).toBeGreaterThanOrEqual(y + bounds.t);
        expect(py).toBeLessThanOrEqual(y + bounds.b);
        expect(Array.from(pix.data.slice(i * 4, i * 4 + 4))).toEqual(Array.from(mirrored.data.slice((py * pix.w + mx) * 4, (py * pix.w + mx) * 4 + 4)));
      }
      const queue = [points[0]]; pending.delete(points[0]);
      for (let j = 0; j < queue.length; j++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const next = queue[j] + dx + dy * pix.w;
        if (pending.delete(next)) queue.push(next);
      }
      expect(pending.size).toBe(0);
    }
  }, 15_000); // 64 detailed rasters plus per-pixel assertions on shared CI CPUs.

  it('wraps every full cycle exactly, including negative phases and reverse', () => {
    for (const s of [2.1, 6, 15]) for (const reverse of [false, true]) {
      expect(draw(s, 8, reverse).data).toEqual(draw(s, 0, reverse).data);
      expect(draw(s, -1, reverse).data).toEqual(draw(s, 7, reverse).data);
    }
  });
});
