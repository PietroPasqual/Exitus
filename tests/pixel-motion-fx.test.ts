import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintSpellMotion, paintSpellTransport, type MotionPoint, type TransportKind } from '../src/ui/pixel-motion-fx';

const ramp = ['#163944', '#286276', '#489fac', '#a0d8de', '#e8ffff'].map(rgb);
const kinds: TransportKind[] = ['flight', 'projection', 'return'];
const elements = ['fogo', 'raio', 'agua', 'acido', 'gelo', 'metal', 'terra', 'materia', 'vento', 'som', 'luz', 'sombra', 'morte', 'vazio'];
function points(pix: Pix): MotionPoint[] {
  const result: MotionPoint[] = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) if (pix.data[(y * pix.w + x) * 4 + 3]) result.push([x, y]);
  return result;
}
const visible = (pix: Pix, x: number, y: number): boolean => !!pix.data[(y * pix.w + x) * 4 + 3];

describe('Trajetórias de magia em pixel art', () => {
  it.each(kinds)('%s preserva os extremos e a curva de destino', kind => {
    const pix = new Pix(100, 70);
    paintSpellTransport(pix, [10, 55], [50, 7], [90, 45], ramp, kind);
    const pixels = points(pix);
    expect(visible(pix, 10, 55)).toBe(true);
    expect(visible(pix, 90, 45)).toBe(true);
    expect(pixels.some(([x, y]) => x > 40 && x < 60 && y < 33)).toBe(true);
    for (const [x, y] of pixels) {
      expect(x).toBeGreaterThanOrEqual(7); expect(x).toBeLessThanOrEqual(93);
      expect(y).toBeGreaterThanOrEqual(23); expect(y).toBeLessThanOrEqual(58);
    }
  });

  it('retorno aponta para o lançador sem inverter a curva recebida', () => {
    const pix = new Pix(100, 70);
    paintSpellTransport(pix, [80, 40], [50, 6], [15, 50], ramp, 'return');
    expect(visible(pix, 15, 50)).toBe(true);
    expect(points(pix).some(([x, y]) => x > 15 && x <= 20 && y < 50)).toBe(true);
    expect(points(pix).some(([x]) => x < 15)).toBe(false);
  });

  it('distingue lançamento, projeção e retorno sem preencher um halo', () => {
    const renders = kinds.map(kind => {
      const pix = new Pix(100, 70);
      paintSpellTransport(pix, [10, 55], [50, 7], [90, 45], ramp, kind);
      expect(points(pix).length).toBeLessThan(300);
      return pix.data;
    });
    expect(renders[0]).not.toEqual(renders[1]);
    expect(renders[1]).not.toEqual(renders[2]);
    expect(renders[0]).not.toEqual(renders[2]);
  });

  it.each(kinds)('%s é determinista e não altera posições ou paleta', kind => {
    const from: MotionPoint = [10, 50], control: MotionPoint = [40, 5], to: MotionPoint = [85, 40];
    const before = JSON.stringify({ from, control, to, ramp });
    const a = new Pix(100, 70), b = new Pix(100, 70);
    paintSpellTransport(a, from, control, to, ramp, kind);
    paintSpellTransport(b, from, control, to, ramp, kind);
    expect(a.data).toEqual(b.data);
    expect(JSON.stringify({ from, control, to, ramp })).toBe(before);
  });

  it.each(kinds)('%s recorta trajetórias fora da tela sem descaracterizar o trecho visível', kind => {
    const pix = new Pix(40, 25);
    paintSpellTransport(pix, [-1000, 12], [20, 12], [1000, 12], ramp, kind);
    expect(points(pix).length).toBeGreaterThan(10);
    expect(pix.data.length).toBe(40 * 25 * 4);
    for (const [, y] of points(pix)) { expect(y).toBeGreaterThanOrEqual(8); expect(y).toBeLessThanOrEqual(16); }
  });

  it('ignora trajetórias degeneradas, paletas vazias e coordenadas inválidas', () => {
    const pix = new Pix(40, 25);
    paintSpellTransport(pix, [10, 12], [10, 12], [10, 12], ramp, 'flight');
    paintSpellTransport(pix, [2, 12], [20, 12], [36, 12], [], 'projection');
    paintSpellTransport(pix, [NaN, 12], [20, 12], [36, 12], ramp, 'return');
    paintSpellTransport(pix, [-Number.MAX_VALUE, 12], [20, 12], [Number.MAX_VALUE, 12], ramp, 'flight');
    expect(points(pix)).toEqual([]);
  });

  it.each(['sombra', 'morte', 'vazio'])('%s usa apenas a faixa escura da paleta', element => {
    const pix = new Pix(100, 70);
    paintSpellTransport(pix, [10, 55], [50, 7], [90, 45], ramp, 'flight', element);
    for (let i = 0; i < pix.data.length; i += 4) if (pix.data[i + 3]) expect(Array.from(pix.data.slice(i, i + 3))).not.toEqual(ramp.at(-1));
    for (const [x, y] of points(pix)) {
      const color = Array.from(pix.data.slice((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 3));
      expect(ramp.slice(0, 3)).toContainEqual(color);
    }
  });
});

describe('Riscos de velocidade', () => {
  it.each(elements)('%s mantém todos os detalhes fora da caixa do sprite', element => {
    const pix = new Pix(100, 70), box = { l: 35, t: 22, r: 68, b: 45 };
    paintSpellMotion(pix, box, 34, ramp, element, true);
    expect(points(pix).length).toBeGreaterThan(12);
    for (const [x, y] of points(pix)) expect(x < box.l || x > box.r || y < box.t || y > box.b).toBe(true);
    expect(box).toEqual({ l: 35, t: 22, r: 68, b: 45 });
  });

  it('a indicação de direção só aparece quando pedida', () => {
    const a = new Pix(100, 70), b = new Pix(100, 70), box = { l: 35, t: 22, r: 68, b: 45 };
    paintSpellMotion(a, box, 34, ramp, 'fogo');
    paintSpellMotion(b, box, 34, ramp, 'fogo', true);
    expect(points(a).every(([x]) => x < box.l)).toBe(true);
    expect(points(b).some(([x]) => x > box.r)).toBe(true);
  });

  it('corpos pequenos recebem menos marcas e uma trilha mais curta', () => {
    const compact = new Pix(100, 70), large = new Pix(100, 70);
    paintSpellMotion(compact, { l: 35, t: 30, r: 43, b: 38 }, 34, ramp, 'raio');
    paintSpellMotion(large, { l: 35, t: 20, r: 70, b: 48 }, 34, ramp, 'raio');
    expect(points(compact).length).toBeLessThan(points(large).length);
    expect(Math.min(...points(compact).map(([x]) => x))).toBeGreaterThan(Math.min(...points(large).map(([x]) => x)));
  });

  it('não corta a seta na borda nem desenha com caixas inválidas', () => {
    const pix = new Pix(100, 70);
    paintSpellMotion(pix, { l: 70, t: 22, r: 94, b: 45 }, 34, ramp, 'agua', true);
    expect(points(pix).every(([x]) => x < 70)).toBe(true);
    const invalid = new Pix(100, 70);
    paintSpellMotion(invalid, { l: 60, t: 22, r: 35, b: 45 }, 34, ramp);
    paintSpellMotion(invalid, { l: 35, t: 22, r: 60, b: 45 }, NaN, ramp);
    paintSpellMotion(invalid, { l: 35, t: 22, r: 60, b: 45 }, 34, []);
    expect(points(invalid)).toEqual([]);
  });
});
