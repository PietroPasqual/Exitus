import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintElementAccents, type EffectBox } from '../src/ui/pixel-element-fx';

const elements = ['agua', 'acido', 'gelo', 'terra', 'materia', 'gravidade', 'metal', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao'];
const ramp = ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'].map(rgb);

function render(element: string, box: EffectBox, flight = false, seed = 23): Pix {
  const pix = new Pix(100, 80);
  expect(paintElementAccents(pix, element, box, ramp, seed, false, flight)).toBe(true);
  return pix;
}

function painted(pix: Pix): [number, number][] {
  const points: [number, number][] = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    if (pix.data[(y * pix.w + x) * 4 + 3]) points.push([x, y]);
  }
  return points;
}

describe('Acentos elementais de pixel art', () => {
  it.each(elements)('%s acompanha cópias pequenas sem ocupar as órbitas vizinhas', element => {
    for (const box of [{ l: 39, t: 28, r: 53, b: 42 }, { l: 42.4, t: 30.2, r: 45.6, b: 34.7 }]) {
      for (const flight of [false, true]) {
        const points = painted(render(element, box, flight));
        expect(points.length).toBeGreaterThan(2);
        expect(points.length).toBeLessThan(35);
        for (const [x, y] of points) {
          expect(x).toBeGreaterThanOrEqual(Math.floor(box.l) - 3);
          expect(x).toBeLessThanOrEqual(Math.ceil(box.r) + 3);
          expect(y).toBeGreaterThanOrEqual(Math.floor(box.t) - 3);
          expect(y).toBeLessThanOrEqual(Math.ceil(box.b) + 3);
        }
      }
    }
  });

  it.each(elements)('%s é determinístico e respeita a paleta fornecida', element => {
    const box = { l: 30, t: 25, r: 62, b: 49 }, palette = structuredClone(ramp), originalBox = { ...box };
    const a = render(element, box, true), b = render(element, box, true);
    expect(a.data).toEqual(b.data);
    expect(ramp).toEqual(palette);
    expect(box).toEqual(originalBox);
    expect(painted(a).length).toBeGreaterThan(10);
    // No antialiasing or translucent haze: every painted pixel is fully opaque.
    for (const [x, y] of painted(a)) expect(a.data[(y * a.w + x) * 4 + 3]).toBe(255);
  });

  it.each(['sombra', 'morte'])('%s conserva tons escuros em vez de clarear a magia', element => {
    const dark = ['#050506', '#16181b', '#343a40', '#495057', '#ced4da'].map(rgb);
    for (const box of [{ l: 30, t: 25, r: 62, b: 49 }, { l: 42, t: 30, r: 48, b: 36 }]) {
      const pix = new Pix(100, 80);
      paintElementAccents(pix, element, box, dark, 2, false, false);
      expect(painted(pix).length).toBeGreaterThan(2);
      for (const [x, y] of painted(pix)) {
        for (let channel = 0; channel < 3; channel++) expect(pix.data[(y * pix.w + x) * 4 + channel]).toBeLessThanOrEqual(dark[2][channel]);
      }
    }
  });

  it('distingue cada família de efeito com a mesma paleta, corpo e semente', () => {
    const box = { l: 30, t: 25, r: 62, b: 49 };
    const families = ['agua', 'acido', 'gelo', 'terra', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao'];
    const signatures = families.map(element => Array.from(render(element, box).data).join(','));
    expect(new Set(signatures).size).toBe(families.length);
  });

  it('deixa elementos de outros pintores intactos', () => {
    const pix = new Pix(20, 20);
    pix.set(5, 5, [140, 80, 20]);
    const before = pix.data.slice();
    for (const element of ['fogo', 'raio', 'luz', 'vazio', 'desconhecido']) {
      expect(paintElementAccents(pix, element, { l: 4, t: 4, r: 14, b: 14 }, ramp, 3, false, false)).toBe(false);
      expect(pix.data).toEqual(before);
    }
  });

  it('aceita bordas da cena e paletas vazias ou com uma cor', () => {
    for (const element of elements) for (const palette of [[], [[40, 70, 90] as [number, number, number]]]) {
      const pix = new Pix(10, 8);
      expect(() => paintElementAccents(pix, element, { l: -2, t: -1, r: 10, b: 9 }, palette, 1, true, true)).not.toThrow();
      expect(pix.data.every(Number.isFinite)).toBe(true);
    }
  });
});
