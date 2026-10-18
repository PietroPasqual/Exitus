import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { natureSphereBounds, paintNatureSphere } from '../src/ui/pixel-nature-sphere';

const ramp = ['#1e5e2a', '#2b8a3e', '#40c057', '#8ce99a', '#ebfbee'].map(rgb);
const render = (s: number, frame = 0, offset = 0): Pix => {
  const p = new Pix(90, 90);
  paintNatureSphere(p, 45 + offset, 45 - offset, s, ramp, frame);
  return p;
};
const occupied = (p: Pix): number[] => Array.from({ length: p.w * p.h }, (_, i) => i).filter(i => p.data[i * 4 + 3]);

describe('Semente e folhas da esfera de natureza', () => {
  it.each([2.5, 3, 5.99, 6, 10, 15])('conserva uma massa ligada dentro do envelope durante todo o ciclo: %s', s => {
    const q = natureSphereBounds(s);
    for (const offset of [0, .25, .5, .9]) for (let frame = 0; frame < 8; frame++) {
      const p = render(s, frame, offset), pixels = occupied(p), unseen = new Set(pixels);
      expect(pixels.length).toBeGreaterThan(0);
      const queue = [pixels[0]]; unseen.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[i] + dy * p.w + dx;
        if (unseen.delete(next)) queue.push(next);
      }
      expect(unseen.size, `${s}/${offset}/${frame}`).toBe(0);
      expect(pixels.every(i => {
        const x = i % p.w - 45 - offset, y = Math.floor(i / p.w) - 45 + offset;
        return x >= q.l && x <= q.r && y >= q.t && y <= q.b;
      })).toBe(true);
      expect(Math.max(...pixels.map(i => Math.hypot(i % p.w - 45 - offset, Math.floor(i / p.w) - 45 + offset)))).toBeLessThanOrEqual(s * .95);
    }
  });

  it('abre lâminas enraizadas sem escalar o corpo nem deslocar a semente', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => render(15, frame));
    const alpha = frames.map(p => occupied(p).join(','));
    expect(new Set(alpha).size).toBeGreaterThanOrEqual(4);
    for (const p of frames) {
      // A stable dense centre and shoulder support every opening pose.
      for (const [x, y] of [[45, 45], [43, 40], [45, 52], [49, 48]]) expect(p.data[(y * p.w + x) * 4 + 3]).toBe(255);
    }
    const changed = frames[0].data.filter((v, i) => v !== frames[3].data[i]).length;
    expect(changed).toBeGreaterThan(45);
  });

  it('mostra folhas sobrepostas com nervuras claras e sombra lateral, sem apagar o centro', () => {
    const p = render(15), pixels = occupied(p);
    const colours = new Set(pixels.map(i => Array.from(p.data.slice(i * 4, i * 4 + 3)).join(',')));
    expect(colours.size).toBe(5);
    const is = (i: number, tone: number): boolean => ramp[tone].every((v, k) => p.data[i * 4 + k] === v);
    // Narrow bright veins are subordinate to the solid green leaf planes.
    expect(pixels.filter(i => is(i, 4)).length).toBeGreaterThan(6);
    expect(pixels.filter(i => is(i, 4)).length / pixels.length).toBeLessThan(.18);
    expect(pixels.filter(i => is(i, 0)).length / pixels.length).toBeGreaterThan(.12);
    expect(pixels.length).toBeGreaterThan(400);
  });

  it('leva seiva das raízes às pontas em vez de apenas clarear a esfera inteira', () => {
    const heights = Array.from({ length: 8 }, (_, frame) => {
      const p = render(15, frame), bright = occupied(p).filter(i => ramp[4].every((v, k) => p.data[i * 4 + k] === v));
      expect(bright.length).toBeGreaterThan(5);
      expect(bright.length).toBeLessThan(occupied(p).length * .18);
      return bright.reduce((sum, i) => sum + Math.floor(i / p.w), 0) / bright.length;
    });
    // The material's leading edge migrates substantially through the fixed body.
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(3);
  });

  it('fecha oito quadros, normaliza quadros negativos e mantém uma pose segura ao pausar', () => {
    for (let frame = 0; frame < 8; frame++) {
      expect(render(15, frame + 8).data).toEqual(render(15, frame).data);
      expect(render(15, frame - 8).data).toEqual(render(15, frame).data);
    }
    for (const frame of [NaN, Infinity, -Infinity]) expect(render(15, frame).data).toEqual(render(15, 0).data);
  });

  it('reutiliza poses sem contaminar cores nem quadros de outras magias', () => {
    const expected = render(15, 2, .25), alternate = [[17, 31, 219], [254, 81, 7]] as [number, number, number][];
    for (let frame = 7; frame >= 0; frame--) {
      const p = new Pix(90, 90);
      paintNatureSphere(p, 45.25, 44.75, 15, alternate, frame);
      for (const i of occupied(p)) expect(alternate.some(c => c.every((v, k) => p.data[i * 4 + k] === v))).toBe(true);
    }
    expect(render(15, 2, .25).data).toEqual(expected.data);
  });

  it('não desenha nem lança erro com medidas inválidas ou paleta vazia', () => {
    for (const s of [NaN, Infinity, -1, 0]) {
      expect(natureSphereBounds(s)).toEqual({ l: 0, t: 0, r: 0, b: 0 });
      expect(occupied(render(s))).toHaveLength(0);
    }
    const p = new Pix(10, 10);
    expect(() => paintNatureSphere(p, 5, 5, 3, [], 0)).not.toThrow();
    expect(() => paintNatureSphere(p, NaN, 5, 3, ramp, 0)).not.toThrow();
    expect(occupied(p)).toHaveLength(0);
  });
});
