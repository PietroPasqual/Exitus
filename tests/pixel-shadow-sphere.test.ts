import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintShadowSphere, shadowSphereBounds } from '../src/ui/pixel-shadow-sphere';

const ramp = ['#10101d', '#242039', '#48415e', '#766b8d', '#b8adcf'].map(rgb);
const paint = (s: number, frame: number, offset = 0): Pix => {
  const pix = new Pix(100, 100);
  paintShadowSphere(pix, 50 + offset, 50 - offset, s, ramp, frame);
  return pix;
};
const occupied = (pix: Pix): number[] => Array.from({ length: pix.w * pix.h }, (_, i) => i).filter(i => pix.data[i * 4 + 3] !== 0);
const colorAt = (pix: Pix, at: number): number => ramp.findIndex(color => color.every((channel, k) => channel === pix.data[at * 4 + k]));

describe('Esfera autoral de sombra', () => {
  it.each([2.5, 3, 5.99, 6, 9, 15, 20])('mantém a fumaça conectada e dentro de seu envelope em escala %s', s => {
    const q = shadowSphereBounds(s);
    for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const pix = paint(s, frame, offset), pixels = occupied(pix), pending = new Set(pixels);
      expect(pixels.length).toBeGreaterThan(0);
      const queue = [pixels[0]]; pending.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[i] + dx + dy * pix.w;
        if (pending.delete(next)) queue.push(next);
      }
      expect(pending.size, `${s}/${offset}/${frame}`).toBe(0);
      expect(pixels.every(i => {
        const x = i % pix.w - 50 - offset, y = Math.floor(i / pix.w) - 50 + offset;
        return x >= q.l && x <= q.r && y >= q.t && y <= q.b;
      })).toBe(true);
    }
  });

  it('preserva a matéria escura e um núcleo ancorado em todos os quadros', () => {
    for (let frame = 0; frame < 8; frame++) {
      const pix = paint(15, frame), colors = occupied(pix).map(at => colorAt(pix, at));
      expect(colors.every(tone => tone >= 0 && tone < 4)).toBe(true);
      expect(colors.filter(tone => tone <= 2).length / colors.length).toBeGreaterThan(.95);
      expect(colors.filter(tone => tone === 3).length).toBeGreaterThan(0);
      expect(colorAt(pix, 52 * pix.w + 52)).toBe(0);
    }
  });

  it('faz a crista percorrer a dobra sem mover todo o corpo nem cintilar o contorno', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => paint(15, frame));
    const crests = frames.map(pix => occupied(pix).filter(at => colorAt(pix, at) === 3));
    const centres = crests.map(points => [points.reduce((sum, at) => sum + at % 100, 0) / points.length,
      points.reduce((sum, at) => sum + Math.floor(at / 100), 0) / points.length]);
    expect(Math.max(...centres.map(p => p[0])) - Math.min(...centres.map(p => p[0]))).toBeGreaterThan(10);
    expect(Math.max(...centres.map(p => p[1])) - Math.min(...centres.map(p => p[1]))).toBeGreaterThan(10);
    const originalMask = new Set(occupied(frames[0]));
    for (const pix of frames) {
      const pixels = occupied(pix), shared = pixels.filter(at => originalMask.has(at)).length;
      expect(shared / Math.max(pixels.length, originalMask.size)).toBeGreaterThan(.96);
    }
    const fingerprints = frames.map(pix => Array.from(pix.data).join(','));
    expect(new Set(fingerprints).size).toBe(8);
  });

  it('fecha oito fases, suporta quadros negativos e normaliza quadros inválidos', () => {
    for (let frame = -8; frame < 8; frame++) {
      const pix = paint(15, frame), loop = paint(15, frame + 8);
      expect(pix.data.every((value, i) => value === loop.data[i])).toBe(true);
    }
    const still = paint(15, 0);
    for (const invalid of [NaN, Infinity, -Infinity]) expect(paint(15, invalid).data.every((value, i) => value === still.data[i])).toBe(true);
  });

  it('não altera a paleta nem escreve fora de tela', () => {
    const before = ramp.map(color => color.slice()), pix = new Pix(6, 6);
    paintShadowSphere(pix, -2.5, .25, 6, ramp, 3);
    expect(ramp).toEqual(before);
    expect(occupied(pix).length).toBeGreaterThan(0);
    const empty = new Pix(6, 6);
    paintShadowSphere(empty, 50, 50, 15, ramp, 0);
    paintShadowSphere(empty, 3, 3, 0, ramp, 0);
    paintShadowSphere(empty, 3, 3, 15, [], 0);
    expect(occupied(empty)).toHaveLength(0);
  });
});
