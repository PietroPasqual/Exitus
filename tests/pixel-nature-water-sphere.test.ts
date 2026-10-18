import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { natureWaterSphereBounds, paintNatureWaterSphere } from '../src/ui/pixel-nature-water-sphere';

const green = new Set(['20,54,34', '30,94,42', '43,138,62', '64,192,87', '140,233,154']);
const liquid = new Set(['18,35,70', '23,70,106', '35,126,155', '77,186,197', '157,229,223', '236,255,241']);
const colorAt = (p: Pix, i: number): string => Array.from(p.data.subarray(i * 4, i * 4 + 3)).join(',');
const indices = (p: Pix): number[] => Array.from({ length: p.w * p.h }, (_, i) => i).filter(i => p.data[i * 4 + 3] !== 0);
const render = (primary: 'natureza' | 'agua', size = 20, frame = 0, offset = 0): Pix => {
  const p = new Pix(90, 90); paintNatureWaterSphere(p, 45 + offset, 43 + offset, size, frame, primary); return p;
};
function connected(p: Pix, occupied: number[]): number {
  const seen = new Set<number>([occupied[0]]), queue = [...seen];
  while (queue.length) {
    const at = queue.pop()!, x = at % p.w, y = Math.floor(at / p.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= p.w || y + dy >= p.h) continue;
      const next = (y + dy) * p.w + x + dx;
      if (p.data[next * 4 + 3] !== 0 && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen.size;
}

describe('authored Nature/Water volume', () => {
  for (const primary of ['natureza', 'agua'] as const) {
    it(`keeps ${primary}-led leaves and liquid joined through every pose and tiny LOD`, () => {
      const failures: string[] = [];
      for (const size of [1, 2, 3, 7, 15, 20, 28]) for (const offset of [0, .25, .5, .75]) for (let frame = 0; frame < 8; frame++) {
        const p = render(primary, size, frame, offset), occupied = indices(p);
        const leaves = occupied.filter(i => green.has(colorAt(p, i))).length;
        const water = occupied.filter(i => liquid.has(colorAt(p, i))).length;
        if (!leaves || !water || connected(p, occupied) !== occupied.length || leaves + water !== occupied.length) failures.push(`${size}/${offset}/${frame}`);
      }
      expect(failures).toEqual([]);
    });

    it(`reports exact inclusive clipped bounds for ${primary} without writing out of the envelope`, () => {
      const failures: string[] = [];
      for (const size of [1, 3, 7, 15, 28]) for (const offset of [0, .25, .5, .75]) for (const origin of [0, 7, 45, 89]) for (let frame = 0; frame < 8; frame++) {
        const p = new Pix(90, 90), x = origin + offset, y = origin + offset;
        const actual = paintNatureWaterSphere(p, x, y, size, frame, primary), pixels = indices(p);
        const expected = { l: Math.min(...pixels.map(i => i % p.w)), t: Math.min(...pixels.map(i => Math.floor(i / p.w))),
          r: Math.max(...pixels.map(i => i % p.w)), b: Math.max(...pixels.map(i => Math.floor(i / p.w))) };
        const box = natureWaterSphereBounds(size, primary);
        if (JSON.stringify(actual) !== JSON.stringify(expected) || pixels.some(i => {
          const px = i % p.w, py = Math.floor(i / p.w);
          return px < x + box.l || px > x + box.r || py < y + box.t || py > y + box.b;
        })) failures.push(`${size}/${offset}/${origin}/${frame}`);
      }
      expect(failures).toEqual([]);
    });

    it(`advects both ${primary}-led liquid and sap while looping exactly`, () => {
      const frames = Array.from({ length: 8 }, (_, frame) => render(primary, 28, frame, .5));
      const first = frames[0], occupied = indices(first);
      let movingLeaf = 0, movingWater = 0;
      for (const i of occupied) {
        if (!frames.some(p => colorAt(p, i) !== colorAt(first, i))) continue;
        if (green.has(colorAt(first, i))) movingLeaf++;
        else movingWater++;
      }
      expect(movingLeaf).toBeGreaterThan(12);
      expect(movingWater).toBeGreaterThan(12);
      expect(render(primary, 28, 8, .5).data).toEqual(first.data);
      expect(render(primary, 28, NaN, .5).data).toEqual(first.data);
      expect(render(primary, 28, -1, .5).data).toEqual(frames[7].data);
      // The contact motion stays inside the volume; no sparkling satellite
      // pixels or outline inflation appear as a leaf opens or a wave passes.
      for (const p of frames) expect(indices(p)).toEqual(occupied);
    });
  }

  it('changes construction with dominance rather than swapping surface colors', () => {
    for (const size of [7, 15, 20, 28]) {
      const n = render('natureza', size), w = render('agua', size);
      const nLeaf = indices(n).filter(i => green.has(colorAt(n, i))).length;
      const wLeaf = indices(w).filter(i => green.has(colorAt(w, i))).length;
      expect(nLeaf).toBeGreaterThan(wLeaf * 1.4);
      expect(indices(w).filter(i => liquid.has(colorAt(w, i))).length).toBeGreaterThan(wLeaf);
      expect(n.data).not.toEqual(w.data);
    }
  });

  it('rejects invalid inputs without drawing or reporting imaginary pixels', () => {
    for (const [x, y, s] of [[NaN, 20, 10], [20, Infinity, 10], [20, 20, NaN], [20, 20, 0], [20, 20, -1]]) {
      const p = new Pix(40, 40), box = paintNatureWaterSphere(p, x, y, s, 0, 'natureza');
      expect(indices(p)).toEqual([]);
      expect(box).toEqual({ l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    }
  });
});
