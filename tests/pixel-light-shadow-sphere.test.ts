import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { lightShadowSphereBounds, paintLightShadowSphere } from '../src/ui/pixel-light-shadow-sphere';

const primaries = ['luz', 'sombra'] as const;
const empty = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
const palette = new Set(['166,95,0', '245,159,0', '255,212,59', '255,243,191',
  '16,16,29', '36,32,57', '72,65,94', '118,107,141']);
const render = (s: number, frame: number, primary: typeof primaries[number] = 'luz', x = 32, y = 32) => {
  const pix = new Pix(64, 64), box = paintLightShadowSphere(pix, x, y, s, frame, primary);
  return { pix, box };
};
const pixels = (pix: Pix): number[] => Array.from({ length: pix.w * pix.h }, (_, i) => i).filter(i => pix.data[i * 4 + 3]);
const color = (pix: Pix, i: number): string => Array.from(pix.data.slice(i * 4, i * 4 + 3)).join(',');
const gold = (pix: Pix, i: number): boolean => pix.data[i * 4] > 150 && pix.data[i * 4 + 1] > 80;

describe('Authored light/shadow overlap', () => {
  it('paints one solid connected volume, exact clipped bounds and a compact all-frame envelope at fractional sizes', () => {
    for (const primary of primaries) for (const s of [1, 2, 3, 7, 15, 20]) for (const offset of [0, .25, .5, .75]) {
      const x = 32 + offset, y = 32 - offset, local = lightShadowSphereBounds(s, primary);
      for (let f = 0; f < 8; f++) {
        const { pix, box } = render(s, f, primary, x, y), points = pixels(pix);
        expect(points.length, `${primary}/${s}/${offset}/${f}`).toBeGreaterThan(0);
        const remaining = new Set(points), queue = [points[0]];
        remaining.delete(points[0]);
        for (let n = 0; n < queue.length; n++) for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
          const next = queue[n] + dx + dy * pix.w;
          if (remaining.delete(next)) queue.push(next);
        }
        expect(remaining.size).toBe(0);
        const xs = points.map(i => i % pix.w), ys = points.map(i => Math.floor(i / pix.w));
        expect(box).toEqual({ l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) });
        expect(points.every(i => {
          const px = i % pix.w, py = Math.floor(i / pix.w);
          return px >= x + local.l && px <= x + local.r && py >= y + local.t && py <= y + local.b
            && palette.has(color(pix, i));
        })).toBe(true);
        expect(local.r).toBeLessThan(s * 1.1 + 1);
      }
    }
    for (const primary of primaries) {
      const { pix, box } = render(15, 2, primary, -.25, -.5), points = pixels(pix);
      expect(box.l).toBe(0); expect(box.t).toBe(0);
      expect(points.length).toBeGreaterThan(30);
      expect(box.r).toBe(Math.max(...points.map(i => i % pix.w)));
    }
  });

  it('keeps both material masses readable, with substantially more gold when light is primary and no white core', () => {
    for (const size of [7, 15, 20]) for (let frame = 0; frame < 8; frame++) {
      const fractions = primaries.map(primary => {
        const { pix } = render(size, frame, primary), points = pixels(pix);
        const golden = points.filter(i => gold(pix, i)).length / points.length;
        const deep = points.filter(i => color(pix, i) === '16,16,29').length / points.length;
        const cream = points.filter(i => color(pix, i) === '255,243,191').length / points.length;
        expect(golden).toBeGreaterThan(.15);
        expect(golden).toBeLessThan(.75);
        if (primary === 'luz') expect(golden).toBeGreaterThan(.52);
        else expect(golden).toBeLessThan(.34);
        expect(deep).toBeGreaterThan(.12);
        expect(cream).toBeLessThan(.15);
        expect(points.every(i => palette.has(color(pix, i)))).toBe(true);
        return golden;
      });
      expect(fractions[0] - fractions[1]).toBeGreaterThan(.22);
    }
    for (const size of [1, 2, 3]) for (const offset of [0, .25, .5, .75]) for (const primary of primaries) {
      const { pix } = render(size, 0, primary, 32 + offset, 32 - offset), points = pixels(pix);
      expect(points.some(i => gold(pix, i))).toBe(true);
      expect(points.some(i => !gold(pix, i))).toBe(true);
    }
  });

  it('travels through the lower opening while the eclipse remains anchored instead of pulsing the whole face', () => {
    for (const primary of primaries) {
      const frames = Array.from({ length: 8 }, (_, f) => render(20, f, primary).pix), points = pixels(frames[0]);
      expect(new Set(frames.map(p => p.data.join(','))).size).toBe(8);
      expect(new Set(frames.map(p => pixels(p).join(','))).size).toBe(1);
      const changed = points.filter(i => frames.some(p => color(p, i) !== color(frames[0], i))).length / points.length;
      expect(changed).toBeGreaterThan(.08);
      expect(changed).toBeLessThan(.29);
      // Exclude the stationary upper shoulder. The visible lower light front
      // first moves to the right, then climbs as it tapers out of the fold.
      const head = (f: number) => {
        const pts = points.filter(i => Math.floor(i / 64) > 33 && i % 64 > 22
          && color(frames[f], i) === '255,243,191');
        return [pts.reduce((n, i) => n + i % 64, 0) / pts.length,
          pts.reduce((n, i) => n + Math.floor(i / 64), 0) / pts.length];
      };
      expect(head(3)[0] - head(0)[0]).toBeGreaterThan(8);
      expect(head(1)[1] - head(4)[1]).toBeGreaterThan(3);
      // The hollow stays dark throughout; it never becomes an eye or star.
      const center = (30 * 64 + 44) * 4;
      expect(frames.every(p => p.data[center] < 80)).toBe(true);
    }
  });

  it('normalizes the eight-pose clock and safely rejects non-finite geometry or a fully clipped body', () => {
    for (const primary of primaries) for (let f = 0; f < 8; f++) {
      expect(render(15, f, primary).pix.data).toEqual(render(15, f + 8, primary).pix.data);
      expect(render(15, f, primary).pix.data).toEqual(render(15, f - 8, primary).pix.data);
    }
    for (const f of [NaN, Infinity, -Infinity]) expect(render(15, f).pix.data).toEqual(render(15, 0).pix.data);
    expect(render(15, -1).pix.data).toEqual(render(15, 7).pix.data);
    expect(render(15, 2.9).pix.data).toEqual(render(15, 2).pix.data);
    for (const [x, y, s] of [[NaN, 15, 7], [15, Infinity, 7], [15, 15, NaN], [15, 15, Infinity],
      [15, 15, 0], [15, 15, -3], [100, 100, 7], [-100, -100, 7]]) {
      const pix = new Pix(30, 30), copy = pix.data.slice();
      expect(paintLightShadowSphere(pix, x, y, s, 0, 'luz')).toEqual(empty);
      expect(pix.data).toEqual(copy);
    }
    for (const size of [NaN, Infinity, -3, 0]) expect(lightShadowSphereBounds(size)).toEqual({ l: 0, t: 0, r: 0, b: 0 });
  });
});
