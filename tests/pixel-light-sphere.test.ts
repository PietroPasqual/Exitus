import { describe, expect, it } from 'vitest';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { lightSphereBounds, paintLightSphere } from '../src/ui/pixel-light-sphere';

const ramp = ['#a65f00', '#f59f00', '#ffd43b', '#fff3bf', '#ffffff'].map(rgb);
const render = (s: number, frame: number, x = 40, y = 40, colors = ramp) => {
  const pix = new Pix(80, 80), box = paintLightSphere(pix, x, y, s, colors, frame);
  return { pix, box };
};
const occupied = (p: Pix): number[] => Array.from({ length: p.w * p.h }, (_, i) => i).filter(i => p.data[i * 4 + 3]);
const toneAt = (p: Pix, i: number, colors = ramp): number => colors.findIndex(c => c.every((n, k) => n === p.data[i * 4 + k]));

describe('Authored light sphere', () => {
  it('keeps its whole corona connected and inside the compact packing budget', () => {
    for (const s of [2.5, 3, 6, 15]) for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const x = 40 + offset, y = 40 - offset, { pix, box } = render(s, frame, x, y), q = lightSphereBounds(s);
      const pixels = occupied(pix), remaining = new Set(pixels), queue = [pixels[0]];
      remaining.delete(pixels[0]);
      for (let j = 0; j < queue.length; j++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[j] + dy * pix.w + dx;
        if (remaining.delete(next)) queue.push(next);
      }
      expect(pixels.length).toBeGreaterThan(10);
      expect(remaining.size, `${s}/${offset}/${frame}`).toBe(0);
      expect(pixels.every(i => {
        const px = i % pix.w, py = Math.floor(i / pix.w);
        return px >= x + q.l && px <= x + q.r && py >= y + q.t && py <= y + q.b;
      })).toBe(true);
      const xs = pixels.map(i => i % pix.w), ys = pixels.map(i => Math.floor(i / pix.w));
      expect(box).toEqual({ l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) });
      expect(q.r - q.l).toBeLessThanOrEqual(s * 2.1);
    }
  });

  it('travels over the corona, then recovers, without spinning its silhouette or flashing its face', () => {
    const frames = Array.from({ length: 8 }, (_, f) => render(15, f).pix), initial = occupied(frames[0]);
    expect(new Set(frames.map(p => p.data.join(','))).size).toBe(8);
    expect(new Set(frames.map(p => occupied(p).join(','))).size).toBe(1);
    const changed = initial.filter(i => frames.some(p => toneAt(p, i) !== toneAt(frames[0], i)));
    expect(changed.length / initial.length).toBeGreaterThan(.08);
    expect(changed.length / initial.length).toBeLessThan(.35);
    // Away from the stable heart, the travelling cream region rises over the
    // crown before reaching the right shoulder. A whole-frame pulse fails this.
    const center = (p: Pix) => {
      const points = initial.filter(i => toneAt(p, i) >= 3 && Math.hypot(i % p.w - 40, Math.floor(i / p.w) - 40) > 7);
      return [points.reduce((sum, i) => sum + i % p.w, 0) / points.length,
        points.reduce((sum, i) => sum + Math.floor(i / p.w), 0) / points.length];
    };
    expect(center(frames[4])[0]).toBeGreaterThan(center(frames[2])[0] + 7);
    expect(center(frames[3])[1]).toBeLessThan(center(frames[6])[1] - 4);
    for (const size of [2.5, 3, 6]) expect(new Set(Array.from({ length: 8 }, (_, f) => render(size, f).pix.data.join(','))).size).toBeGreaterThanOrEqual(3);
  });

  it('keeps white to a small luminous heart and preserves broad shaded planes for any palette', () => {
    // Deliberately non-monotonic luminance: topology is controlled by palette
    // indices, never by hard-coded white or a brightness threshold.
    const colors: RGB[] = [[240, 18, 24], [19, 22, 28], [190, 30, 230], [240, 220, 40], [30, 210, 190]];
    for (const s of [2.5, 3, 6, 15]) for (const offset of [0, .45]) for (let frame = 0; frame < 8; frame++) {
      const { pix } = render(s, frame, 40 + offset, 40 - offset, colors), pixels = occupied(pix);
      const tones = pixels.map(i => toneAt(pix, i, colors));
      expect(tones.every(n => n >= 0)).toBe(true);
      expect(tones.filter(n => n === 4).length / pixels.length).toBeLessThanOrEqual(.1);
      expect(tones.filter(n => n <= 1).length / pixels.length).toBeGreaterThan(s < 6 ? .25 : .43);
    }
  });

  it('wraps deterministic complete pause poses and handles empty or invalid input safely', () => {
    for (let f = 0; f < 8; f++) {
      expect(render(15, f).pix.data).toEqual(render(15, f + 8).pix.data);
      expect(render(15, f).pix.data).toEqual(render(15, f - 8).pix.data);
    }
    for (const f of [NaN, Infinity, -Infinity]) expect(render(15, f).pix.data).toEqual(render(15, 0).pix.data);
    const p = new Pix(30, 30), copy = p.data.slice();
    for (const [x, y, s] of [[NaN, 15, 6], [15, Infinity, 6], [15, 15, NaN], [15, 15, Infinity], [15, 15, 0], [15, 15, -6], [100, 100, 6]])
      expect(paintLightSphere(p, x, y, s, ramp, 0)).toEqual({ l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    paintLightSphere(p, 15, 15, 6, [], 0);
    expect(p.data).toEqual(copy);
    expect(lightSphereBounds(NaN)).toEqual({ l: 0, t: 0, r: 0, b: 0 });
    // Clipped paint reports only pixels that actually reached the canvas.
    const box = paintLightSphere(p, -.5, -.5, 6, ramp, 0);
    expect(box.l).toBe(0); expect(box.t).toBe(0);
  });
});
