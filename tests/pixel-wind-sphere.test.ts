import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintWindSphere, windSphereBounds } from '../src/ui/pixel-wind-sphere';

const ramp = ['#0b5a45', '#0ca678', '#38d9a9', '#96f2d7', '#e6fcf5'].map(rgb);
const paint = (s: number, frame: number, offset = 0): Pix => {
  const p = new Pix(80, 80); paintWindSphere(p, 40 + offset, 40 - offset, s, ramp, frame); return p;
};
const occupied = (p: Pix): number[] => Array.from({ length: p.w * p.h }, (_, i) => i).filter(i => p.data[i * 4 + 3]);
const equal = (a: Pix, b: Pix): boolean => a.data.every((v, i) => v === b.data[i]);

describe('Esfera autoral de vento', () => {
  it.each([2.5, 3, 6, 15])('mantém uma única corrente dentro do envelope em toda a volta na escala %s', s => {
    const q = windSphereBounds(s);
    for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(80, 80), x = 40 + offset, y = 40 - offset;
      const box = paintWindSphere(p, x, y, s, ramp, frame), pixels = occupied(p), pending = new Set(pixels);
      expect(pixels.length).toBeGreaterThan(0);
      const queue = [pixels[0]]; pending.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[i] + dx + dy * p.w;
        if (pending.delete(next)) queue.push(next);
      }
      expect(pending.size, `${s}/${offset}/${frame}`).toBe(0);
      const xs = pixels.map(i => i % p.w), ys = pixels.map(i => Math.floor(i / p.w));
      expect(box).toEqual({ l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) });
      expect(pixels.every(i => {
        const u = i % p.w - x, v = Math.floor(i / p.w) - y;
        return u >= q.l && u <= q.r && v >= q.t && v <= q.b;
      })).toBe(true);
    }
  });

  it('move a geometria no sentido horário e fecha oito poses sem uma pulsação de brilho', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => paint(15, frame));
    const moment = (p: Pix): [number, number] => occupied(p).reduce<[number, number]>((sum, i) => {
      const u = i % p.w - 40, v = Math.floor(i / p.w) - 40, weight = (u * u + v * v) ** 2;
      return [sum[0] + u * weight, sum[1] + v * weight];
    }, [0, 0]);
    const moments = frames.map(moment);
    for (let frame = 0; frame < 8; frame++) {
      expect(equal(frames[frame], paint(15, frame + 8))).toBe(true);
      const a = moments[frame], b = moments[(frame + 1) % 8];
      expect((a[0] * b[1] - a[1] * b[0]) / (Math.hypot(...a) * Math.hypot(...b))).toBeGreaterThan(.3);
    }
    const changed = frames[0].data.filter((v, i) => i % 4 === 3 && v !== frames[1].data[i]).length;
    expect(changed).toBeGreaterThan(70);
    expect(new Set(frames.map(p => Array.from(p.data).join(','))).size).toBe(8);
  });

  it('deixa canais vazios e concentra a luz em lábios curtos, sem preencher o núcleo de branco', () => {
    for (let frame = 0; frame < 8; frame++) {
      const p = paint(15, frame), pixels = occupied(p);
      const central = pixels.filter(i => Math.hypot(i % p.w - 40, Math.floor(i / p.w) - 40) < 10);
      const pale = pixels.filter(i => ramp[4].every((v, k) => p.data[i * 4 + k] === v));
      expect(central.length).toBeLessThan(240);
      expect(pixels.length).toBeGreaterThan(220);
      expect(pale.length / pixels.length).toBeLessThan(.1);
      expect(pale.every(i => Math.hypot(i % p.w - 40, Math.floor(i / p.w) - 40) > 3)).toBe(true);
    }
  });

  it('normaliza a pose, limita recortes e ignora entradas sem desenho válido', () => {
    expect(equal(paint(15, -1), paint(15, 7))).toBe(true);
    for (const frame of [NaN, Infinity]) expect(equal(paint(15, frame), paint(15, 0))).toBe(true);
    const clipped = new Pix(7, 7);
    expect(() => paintWindSphere(clipped, 0, 0, 15, ramp, 3)).not.toThrow();
    expect(occupied(clipped).length).toBeGreaterThan(0);
    for (const s of [0, -2, NaN, Infinity]) {
      const p = new Pix(20, 20); paintWindSphere(p, 10, 10, s, ramp, 0);
      expect(occupied(p)).toEqual([]);
      expect(windSphereBounds(s)).toEqual({ l: 0, t: 0, r: 0, b: 0 });
    }
    const p = new Pix(20, 20);
    paintWindSphere(p, 10, 10, 6, [], 0);
    paintWindSphere(p, NaN, 10, 6, ramp, 0);
    expect(occupied(p)).toEqual([]);
  });
});
