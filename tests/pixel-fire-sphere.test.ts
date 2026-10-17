import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { fireSphereBounds, paintCoherentFireSphere } from '../src/ui/pixel-fire-sphere';

const ramp = ['#3b1029', '#7d1f3b', '#cb3c35', '#f87935', '#ffc45c', '#fff1b8', '#fffdf1'].map(rgb);
const paint = (s: number, frame: number, offset = 0): Pix => {
  const p = new Pix(160, 120); paintCoherentFireSphere(p, 80 + offset, 60 - offset, s, ramp, frame); return p;
};
const occupied = (p: Pix): number[] => Array.from({ length: p.w * p.h }, (_, i) => i).filter(i => p.data[i * 4 + 3]);

describe('Ciclo da dobra de fogo', () => {
  it.each([1, 2, 3, 5.99, 6, 7, 15, 20])('mantém a coroa ligada ao núcleo e dentro do envelope na escala %s', s => {
    const q = fireSphereBounds(s);
    for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const p = paint(s, frame, offset), pixels = occupied(p), pending = new Set(pixels);
      expect(pixels.length).toBeGreaterThan(0);
      const queue = [pixels[0]]; pending.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[i] + dx + dy * p.w;
        if (pending.delete(next)) queue.push(next);
      }
      expect(pending.size, `${s}/${offset}/${frame}`).toBe(0);
      expect(pixels.every(i => {
        const x = i % p.w - 80 - offset, y = Math.floor(i / p.w) - 60 + offset;
        return x >= q.l && x <= q.r && y >= q.t && y <= q.b;
      })).toBe(true);
    }
  });

  it('enrola a silhueta da chama sem mover nem dividir o núcleo mais quente', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => paint(15, frame));
    const top = frames.map(p => Math.min(...occupied(p).map(i => Math.floor(i / p.w))));
    expect(Math.max(...top) - Math.min(...top)).toBeGreaterThanOrEqual(4);
    const changedAlpha = frames[0].data.filter((v, i) => i % 4 === 3 && v !== frames[2].data[i]).length;
    expect(changedAlpha).toBeGreaterThan(35);
    for (const p of frames) {
      const kernel = (59 * p.w + 76) * 4;
      expect(Array.from(p.data.slice(kernel, kernel + 3))).toEqual(ramp[6]);
    }
  });

  it('fecha o ciclo de oito quadros e oferece poses completas para pausar', () => {
    for (let frame = 0; frame < 8; frame++) {
      const p = paint(15, frame), loop = paint(15, frame + 8);
      expect(p.data.every((v, i) => v === loop.data[i])).toBe(true);
      expect(occupied(p).length).toBeGreaterThan(500);
    }
    const still = paint(15, 0);
    for (const invalid of [NaN, Infinity]) expect(paint(15, invalid).data.every((v, i) => v === still.data[i])).toBe(true);
  });
});
