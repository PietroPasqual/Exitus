import { describe, expect, it } from 'vitest';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { paintEmbers, paintEnergyAccents, paintFireWisps, paintRadiance, type RadianceBox } from '../src/ui/pixel-radiance-fx';

const fire = ['#5c1408', '#b02a1b', '#f76707', '#ffa94d', '#ffe066', '#fff8e0'].map(rgb);
const electric = ['#7a3a00', '#d9480f', '#fcc419', '#fff3a1', '#ffffff'].map(rgb);
const shadow = ['#050506', '#16181b', '#343a40', '#495057', '#ced4da'].map(rgb);
type Painter = (pix: Pix, q: RadianceBox, ramp: RGB[], seed: number) => void;
const painters: [string, Painter][] = [
  ['chamas', (p, q, r, s) => paintFireWisps(p, q, false, s, r)],
  ['chamas em voo', (p, q, r, s) => paintFireWisps(p, q, true, s, r)],
  ['brasas', (p, q, r, s) => paintEmbers(p, q, r, s, false)],
  ['brasas em voo', (p, q, r, s) => paintEmbers(p, q, r, s, true)],
  ['raio', (p, q, r, s) => paintRadiance(p, q, r, s)],
  ['luz', (p, q, r, s) => paintRadiance(p, q, r, s, true)],
  ['energia', (p, q, r, s) => paintEnergyAccents(p, 'caos', q, r, s)],
  ['folhas', (p, q, r, s) => paintEnergyAccents(p, 'vida', q, r, s)]
];
function pixels(pix: Pix): [number, number, number[]][] {
  const points: [number, number, number[]][] = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    const i = (y * pix.w + x) * 4;
    if (pix.data[i + 3]) points.push([x, y, Array.from(pix.data.slice(i, i + 3))]);
  }
  return points;
}

describe('Efeitos de fogo, raio, luz e energia em pixel art', () => {
  it.each(painters)('%s é determinístico e reutiliza somente a paleta recebida', (_, paint) => {
    const a = new Pix(100, 70), b = new Pix(100, 70), q = { l: 30, t: 25, r: 65, b: 45 };
    const palette = structuredClone(fire), bounds = { ...q };
    paint(a, q, fire, 19); paint(b, q, fire, 19);
    expect(a.data).toEqual(b.data);
    expect(pixels(a).length).toBeGreaterThan(3);
    for (const [, , color] of pixels(a)) expect(fire).toContainEqual(color);
    expect(fire).toEqual(palette);
    expect(q).toEqual(bounds);
  });

  it.each(painters)('%s contém cópias pequenas em uma margem máxima de três pixels', (_, paint) => {
    for (const q of [{ l: 30, t: 25, r: 40, b: 33 }, { l: 30.4, t: 25.8, r: 49.3, b: 29.2 }]) {
      const pix = new Pix(90, 60);
      paint(pix, q, fire, 3);
      expect(pixels(pix).length).toBeGreaterThan(0);
      for (const [x, y] of pixels(pix)) {
        expect(x).toBeGreaterThanOrEqual(Math.floor(q.l - 3));
        expect(x).toBeLessThanOrEqual(Math.ceil(q.r + 3));
        expect(y).toBeGreaterThanOrEqual(Math.floor(q.t - 3));
        expect(y).toBeLessThanOrEqual(Math.ceil(q.b + 3));
      }
    }
  });

  it.each(painters)('%s tolera recorte de tela e paleta curta, sem inventar pixels brancos', (_, paint) => {
    for (const q of [{ l: -3, t: -2, r: 9, b: 6 }, { l: 42, t: 30, r: 55, b: 43 }]) {
      const pix = new Pix(48, 36);
      paint(pix, q, [fire[1]], 7);
      for (const [, , color] of pixels(pix)) expect(color).toEqual(fire[1]);
    }
    const empty = new Pix(48, 36);
    paint(empty, { l: 10, t: 10, r: 30, b: 20 }, [], 7);
    expect(pixels(empty)).toHaveLength(0);
    paint(empty, { l: Number.NaN, t: 10, r: 30, b: 20 }, fire, 7);
    expect(pixels(empty)).toHaveLength(0);
    paint(empty, { l: -Number.MAX_VALUE, t: -1, r: Number.MAX_VALUE, b: 3 }, fire, 7);
    expect(pixels(empty)).toHaveLength(0);
    paint(empty, { l: 999_999, t: 999_999, r: 1_000_000, b: 1_000_000 }, fire, 7);
    expect(pixels(empty)).toHaveLength(0);
  });

  it.each(['sombra', 'morte', 'vazio'])('%s mantém fumaça e dobras nos tons escuros', el => {
    const pix = new Pix(100, 70), q = { l: 30, t: 25, r: 65, b: 45 };
    paintEnergyAccents(pix, el, q, shadow, 3);
    expect(pixels(pix).length).toBeGreaterThan(5);
    for (const [, , color] of pixels(pix)) {
      expect(shadow.slice(0, 3)).toContainEqual(color);
      expect(Math.max(...color)).toBeLessThanOrEqual(64);
    }
  });

  it('raio e luz têm desenhos distintos em vez de uma mesma estrela com outra cor', () => {
    const lightning = new Pix(100, 70), light = new Pix(100, 70), q = { l: 30, t: 25, r: 65, b: 45 };
    paintRadiance(lightning, q, electric, 3);
    paintRadiance(light, q, electric, 3, true);
    expect(lightning.data).not.toEqual(light.data);
    expect(pixels(lightning).filter(([, , c]) => c[0] === 255 && c[1] === 255 && c[2] === 255).length).toBeLessThan(15);
  });
});
