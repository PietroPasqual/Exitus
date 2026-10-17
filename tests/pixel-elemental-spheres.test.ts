import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { elementalSphereBounds, paintElementalSphere, type ElementalSphere } from '../src/ui/pixel-elemental-spheres';

const ramps = {
  agua: ['#122346', '#17466a', '#237e9b', '#4dbac5', '#9de5df', '#ecfff1'],
  gelo: ['#26345e', '#3d6294', '#619dc9', '#90d8e7', '#c5f1ef', '#f4ffff'],
  terra: ['#302632', '#57403a', '#8a6343', '#bb955d', '#e0c68d'],
  metal: ['#202b43', '#45526c', '#8196a4', '#c8d8d6', '#f5fff1']
};
const elements = Object.keys(ramps) as ElementalSphere[];
const render = (element: ElementalSphere, size: number, frame: number, x = 40, y = 40) => {
  const pix = new Pix(80, 80);
  const box = paintElementalSphere(pix, x, y, size, ramps[element].map(rgb), element, frame);
  return { pix, box };
};
const occupied = (pix: Pix): number[] => {
  const result: number[] = [];
  for (let i = 0; i < pix.w * pix.h; i++) if (pix.data[i * 4 + 3]) result.push(i);
  return result;
};

describe('Authored elemental sphere bodies', () => {
  it.each(elements)('%s remains a single connected mass at every copy size and frame', element => {
    for (const size of [3, 4, 5, 6, 15, 20]) for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const { pix } = render(element, size, frame, 40 + offset, 40 - offset);
      const pixels = occupied(pix), pending = new Set(pixels), queue = [pixels[0]];
      pending.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        for (const q of [p - 1, p + 1, p - pix.w, p + pix.w]) if (pending.delete(q)) queue.push(q);
      }
      expect(pixels.length).toBeGreaterThan(12);
      expect(pending.size).toBe(0);
    }
  });

  it.each(elements)('%s reports exact painted bounds inside its shared all-frame layout bounds', element => {
    for (const size of [3, 4, 5, 6, 15, 20]) for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const x = 40 + offset, y = 40 - offset, { pix, box } = render(element, size, frame, x, y);
      const pixels = occupied(pix), xs = pixels.map(p => p % pix.w), ys = pixels.map(p => Math.floor(p / pix.w));
      expect(box).toEqual({ l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) });
      const bound = elementalSphereBounds(size, element);
      expect(box.l).toBeGreaterThanOrEqual(x + bound.l);
      expect(box.t).toBeGreaterThanOrEqual(y + bound.t);
      expect(box.r).toBeLessThanOrEqual(x + bound.r);
      expect(box.b).toBeLessThanOrEqual(y + bound.b);
    }
  });

  it.each(elements)('%s wraps a substantial material-local eight-frame cycle', element => {
    const first = render(element, 15, 0).pix;
    const masks = new Set<string>(), frames = new Set<string>();
    for (let frame = 0; frame < 8; frame++) {
      const pix = render(element, 15, frame).pix;
      expect(pix.data).toEqual(render(element, 15, frame + 8).pix.data);
      masks.add(occupied(pix).join(','));
      frames.add(pix.data.join(','));
    }
    if (element === 'gelo' || element === 'metal') expect(masks.size).toBe(1);
    else expect(masks.size).toBeGreaterThanOrEqual(4);
    expect(frames.size).toBeGreaterThanOrEqual(7);
    for (const frame of [NaN, Infinity, -Infinity]) expect(render(element, 15, frame).pix.data).toEqual(first.data);
  });

  it.each(elements)('%s moves readable material regions rather than merely blinking a few pixels', element => {
    const frames = Array.from({ length: 8 }, (_, frame) => render(element, 15, frame).pix);
    const changed = new Set<number>();
    for (const pix of frames) for (let i = 0; i < pix.data.length; i += 4)
      if (pix.data.slice(i, i + 4).some((value, k) => value !== frames[0].data[i + k])) changed.add(i);
    expect(changed.size / occupied(frames[0]).length).toBeGreaterThan(.2);
    // Spatially travelling material changes include both brighter and darker
    // regions. A uniform opacity/brightness pulse does not satisfy this.
    let brighter = 0, darker = 0;
    const before = frames[1].data, after = frames[3].data;
    for (let i = 0; i < before.length; i += 4) if (before[i + 3] && after[i + 3]) {
      const delta = after[i] + after[i + 1] + after[i + 2] - before[i] - before[i + 1] - before[i + 2];
      if (delta > 10) brighter++;
      if (delta < -10) darker++;
    }
    expect(brighter).toBeGreaterThan(4);
    expect(darker).toBeGreaterThan(4);
    for (const size of [3, 4, 5, 6]) {
      const tiny = Array.from({ length: 8 }, (_, frame) => render(element, size, frame).pix.data.join(','));
      expect(new Set(tiny).size).toBeGreaterThanOrEqual(3);
    }
  });

  it('leans the rock as one rigid volume while keeping its bottom contact anchored', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => render('terra', 15, frame));
    expect(new Set(frames.map(({ box }) => box.b)).size).toBe(1);
    const areas = frames.map(({ pix }) => occupied(pix).length);
    expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(1.04);
    // Every frame still has a substantial common core, without airborne chips.
    const masks = frames.map(({ pix }) => new Set(occupied(pix)));
    const common = [...masks[0]].filter(pixel => masks.every(mask => mask.has(pixel)));
    expect(common.length / masks[0].size).toBeGreaterThan(.85);
  });

  it('curls the water crest while retaining the dense round liquid core', () => {
    for (let frame = 0; frame < 8; frame++) {
      const { pix } = render('agua', 15, frame);
      for (let y = 31; y <= 49; y++) for (let x = 31; x <= 49; x++) {
        if (Math.hypot(x - 40, y - 40) < 9) expect(pix.data[(y * pix.w + x) * 4 + 3]).toBe(255);
      }
    }
  });

  it('uses distinct authored silhouettes, rather than recolouring one circular mask', () => {
    const masks = elements.map(element => occupied(render(element, 15, 0).pix).join(','));
    expect(new Set(masks).size).toBe(4);
  });
});
