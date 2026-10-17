import { describe, expect, it } from 'vitest';
import { seeded } from '../src/ui/sketch';
import { Pix, rgb } from '../src/ui/pixel';
import { paintElementAccents, type EffectBox } from '../src/ui/pixel-element-fx';

const elements = ['agua', 'acido', 'gelo', 'terra', 'materia', 'gravidade', 'metal', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao'];
const ramp = ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'].map(rgb);

function render(element: string, box: EffectBox, flight = false, seed = 23, frame = 0): Pix {
  const pix = new Pix(100, 80);
  expect(paintElementAccents(pix, element, box, ramp, seed, false, flight, frame)).toBe(true);
  return pix;
}
function signature(pix: Pix): string {
  let hash = 2166136261;
  for (const value of pix.data) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(16);
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
        for (let frame = 0; frame < 8; frame++) {
          const points = painted(render(element, box, flight, 23, frame));
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
    }
  });

  it.each(elements)('%s fecha o ciclo de oito quadros e mantém a semente independente do tempo', element => {
    const box = { l: 30, t: 25, r: 62, b: 49 }, zero = render(element, box);
    expect(render(element, box, false, 23, 8).data).toEqual(zero.data);
    expect(render(element, box, false, 23, Number.NaN).data).toEqual(zero.data);
    expect(render(element, box, false, 23, -1).data).toEqual(render(element, box, false, 23, 7).data);
    const frames = Array.from({ length: 8 }, (_, f) => signature(render(element, box, false, 23, f)));
    expect(new Set(frames).size).toBeGreaterThan(1);
    expect(signature(render(element, box, false, 23, 3))).toBe(frames[3]);
  });

  it('a exportação estática amostra o quadro zero sem forçar reflexos simultâneos', () => {
    const boxes = [{ l: 30, t: 25, r: 62, b: 49 }, { l: 42.4, t: 30.2, r: 45.6, b: 34.7 }];
    elements.forEach(element => boxes.forEach(q => {
      const still = new Pix(100, 80);
      paintElementAccents(still, element, q, ramp, 23, false, false);
      for (const frame of [0, 8, 16]) expect(render(element, q, false, 23, frame).data.every((value, i) => value === still.data[i])).toBe(true);
    }));
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
      for (let frame = 0; frame < 8; frame++) {
        const pix = new Pix(100, 80);
        paintElementAccents(pix, element, box, dark, 2, false, false, frame);
        expect(painted(pix).length).toBeGreaterThan(2);
        for (const [x, y] of painted(pix)) {
          for (let channel = 0; channel < 3; channel++) expect(pix.data[(y * pix.w + x) * 4 + channel]).toBeLessThanOrEqual(dark[2][channel]);
        }
      }
    }
  });

  it('distingue cada família de efeito com a mesma paleta, corpo e semente', () => {
    const box = { l: 30, t: 25, r: 62, b: 49 };
    const families = ['agua', 'acido', 'gelo', 'terra', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao'];
    const signatures = families.map(element => Array.from(render(element, box).data).join(','));
    expect(new Set(signatures).size).toBe(families.length);
  });

  it('gotas de água descem antes de se espalhar, em vez de fazer o vaivém das cristas', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 }, seed = 23;
    const offset = Math.floor(seeded(`element-clock:agua:${seed}`)() * 8), start = (offset + 6) % 8;
    const heights = [1, 2, 3, 4, 5].map(age => {
      const frame = (age - start + 8) % 8;
      const drop = painted(render('agua', q, false, seed, frame)).filter(([x, y]) => x >= 51 && x <= 55 && y < q.t);
      expect(drop.length).toBeGreaterThan(0);
      return Math.max(...drop.map(([, y]) => y));
    });
    expect(heights.at(-1)).toBeGreaterThan(heights[0]);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
  });

  it('rochas e cristais conservam suas posições enquanto os reflexos mudam', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    for (const element of ['terra', 'metal', 'gelo']) {
      const crop = (pix: Pix): [number, number][] => painted(pix).filter(([x, y]) => x < q.l && y > q.t + 1);
      const still = crop(render(element, q));
      for (let frame = 1; frame < 8; frame++) expect(crop(render(element, q, false, 23, frame))).toEqual(still);
    }
  });

  it('vento avança em faixas que afinam e apagam o brilho antes de renascer', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    const rhythms = [3, 20, 37].map(seed => Array.from({ length: 8 }, (_, frame) => {
      return painted(render('vento', q, false, seed, frame)).filter(([, y]) => y < 30).length;
    }));
    expect(new Set(rhythms.map(rhythm => rhythm.join(','))).size).toBeGreaterThan(1);
    for (const seed of [3, 20, 37]) {
      const offset = Math.floor(seeded(`element-clock:vento:${seed}`)() * 8);
      const upper = (age: number): [number, number][] => painted(render('vento', q, false, seed, (age - offset + 8) % 8)).filter(([, y]) => y < 30);
      const middle = (points: [number, number][]): number => points.reduce((sum, [x]) => sum + x, 0) / points.length;
      expect(middle(upper(4))).toBeGreaterThan(middle(upper(3)));
      expect(upper(0).length).toBeLessThan(upper(3).length * .5);
      expect(upper(7).length).toBeLessThan(upper(4).length * .5);
    }
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
