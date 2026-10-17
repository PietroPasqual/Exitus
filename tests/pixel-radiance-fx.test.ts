import { describe, expect, it } from 'vitest';
import { seeded } from '../src/ui/sketch';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { paintEmbers, paintEnergyAccents, paintFireWisps, paintRadiance, type RadianceBox } from '../src/ui/pixel-radiance-fx';

const fire = ['#5c1408', '#b02a1b', '#f76707', '#ffa94d', '#ffe066', '#fff8e0'].map(rgb);
const electric = ['#7a3a00', '#d9480f', '#fcc419', '#fff3a1', '#ffffff'].map(rgb);
const shadow = ['#050506', '#16181b', '#343a40', '#495057', '#ced4da'].map(rgb);
type Painter = (pix: Pix, q: RadianceBox, ramp: RGB[], seed: number, frame?: number) => void;
const painters: [string, Painter][] = [
  ['chamas', (p, q, r, s, f) => paintFireWisps(p, q, false, s, r, f)],
  ['chamas em voo', (p, q, r, s, f) => paintFireWisps(p, q, true, s, r, f)],
  ['brasas', (p, q, r, s, f) => paintEmbers(p, q, r, s, false, f)],
  ['brasas em voo', (p, q, r, s, f) => paintEmbers(p, q, r, s, true, f)],
  ['raio', (p, q, r, s, f) => paintRadiance(p, q, r, s, false, f)],
  ['luz', (p, q, r, s, f) => paintRadiance(p, q, r, s, true, f)],
  ['energia', (p, q, r, s, f) => paintEnergyAccents(p, 'caos', q, r, s, f)],
  ['folhas', (p, q, r, s, f) => paintEnergyAccents(p, 'vida', q, r, s, f)]
];
function signature(pix: Pix): string {
  let hash = 2166136261;
  for (const value of pix.data) hash = Math.imul(hash ^ value, 16777619);
  return (hash >>> 0).toString(16);
}
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
      for (let frame = 0; frame < 8; frame++) {
        const pix = new Pix(90, 60);
        paint(pix, q, fire, 3, frame);
        expect(pixels(pix).length).toBeGreaterThan(0);
        for (const [x, y] of pixels(pix)) {
          expect(x).toBeGreaterThanOrEqual(Math.floor(q.l - 3));
          expect(x).toBeLessThanOrEqual(Math.ceil(q.r + 3));
          expect(y).toBeGreaterThanOrEqual(Math.floor(q.t - 3));
          expect(y).toBeLessThanOrEqual(Math.ceil(q.b + 3));
        }
      }
    }
  });

  it.each(painters)('%s anima somente acentos e fecha o ciclo sem depender da ordem das chamadas', (_, paint) => {
    const q = { l: 30, t: 25, r: 62, b: 49 }, palette = structuredClone(fire);
    const render = (frame: number): Pix => { const p = new Pix(100, 80); paint(p, q, fire, 23, frame); return p; };
    const zero = render(0);
    expect(render(8).data).toEqual(zero.data);
    expect(render(Number.NaN).data).toEqual(zero.data);
    expect(render(Number.POSITIVE_INFINITY).data).toEqual(zero.data);
    expect(render(-1).data).toEqual(render(7).data);
    expect(render(3).data).toEqual(render(3).data);
    expect(new Set(Array.from({ length: 8 }, (_, f) => signature(render(f)))).size).toBeGreaterThan(1);
    expect(fire).toEqual(palette);
  });

  it('o quadro estático usa a mesma idade local dos quadros zero e oito', () => {
    const ramp = ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'].map(rgb);
    const boxes = [{ l: 30, t: 25, r: 62, b: 49 }, { l: 42.4, t: 30.2, r: 45.6, b: 34.7 }];
    painters.forEach(([, paint]) => boxes.forEach(q => {
      const still = new Pix(100, 80); paint(still, q, ramp, 23);
      for (const frame of [0, 8, 16]) {
        const animated = new Pix(100, 80); paint(animated, q, ramp, 23, frame);
        expect(animated.data.every((value, i) => value === still.data[i])).toBe(true);
      }
    }));
  });

  it('o raio descarrega brevemente e deixa canais residuais sem um clarão de cena', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    const frames = Array.from({ length: 8 }, (_, f) => {
      const p = new Pix(100, 80); paintRadiance(p, q, electric, 23, false, f); return p;
    });
    const coverage = frames.map(p => pixels(p).length);
    const white = frames.map(p => pixels(p).filter(([, , color]) => color.every(v => v === 255)).length);
    expect(new Set(frames.map(signature)).size).toBeGreaterThan(5);
    expect(Math.min(...coverage)).toBeGreaterThan(8);
    expect(Math.min(...coverage)).toBeLessThan(Math.max(...coverage) * .65);
    expect(Math.max(...coverage)).toBeLessThan(120);
    expect(Math.max(...white)).toBeLessThan(15);
    expect(white.filter(count => count < Math.max(...white)).length).toBeGreaterThanOrEqual(6);
    for (const p of frames) for (const [x, y] of pixels(p)) {
      expect(x).toBeGreaterThanOrEqual(q.l - 12); expect(x).toBeLessThanOrEqual(q.r + 12);
      expect(y).toBeGreaterThanOrEqual(q.t - 12); expect(y).toBeLessThanOrEqual(q.b + 12);
    }
  });

  it('o quadro zero não reacende canais cuja idade local já passou da descarga', () => {
    const seed = Array.from({ length: 100 }, (_, i) => i).find(value => [0, 1, 2].every(i => Math.floor(seeded(`surge-age:${value}:${i}`)() * 8) >= 2));
    expect(seed).toBeDefined();
    const p = new Pix(100, 80);
    paintRadiance(p, { l: 30, t: 25, r: 62, b: 49 }, electric, seed!, false, 0);
    expect(pixels(p).filter(([, , color]) => color.every(v => v === 255))).toHaveLength(0);
    expect(pixels(p).length).toBeGreaterThan(8);
  });

  it('as línguas mudam comprimento e massa em vez de deslizar como um bloco', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    for (const flight of [false, true]) {
      const frames = Array.from({ length: 8 }, (_, f) => {
        const p = new Pix(100, 80); paintFireWisps(p, q, flight, 23, fire, f); return pixels(p);
      });
      expect(new Set(frames.map(points => points.length)).size).toBeGreaterThan(4);
      const tips = frames.map(points => Math.min(...points.map(([x, y]) => flight ? x : y)));
      expect(new Set(tips).size).toBeGreaterThan(1);
      // A planted root survives while a different tongue curls or dissolves.
      expect(frames.every(points => points.some(([x, y]) => flight ? x >= q.l : y >= q.t))).toBe(true);
    }
  });

  it('brasas têm vidas escalonadas, com subida, resfriamento e renascimento separados', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    const frames = Array.from({ length: 8 }, (_, f) => {
      const p = new Pix(100, 80); paintEmbers(p, q, fire, 23, false, f); return pixels(p);
    });
    expect(frames.every(points => points.length >= 3)).toBe(true);
    expect(new Set(frames.map(points => points.length)).size).toBeGreaterThan(2);
    const lifetimes = [0, 1, 2].map(i => frames.map(points => points.filter(([x]) => x >= q.l + i * 10 && x < q.l + (i + 1) * 10).length).join(','));
    expect(new Set(lifetimes).size).toBe(3);
    expect(frames.some(points => points.some(([, , color]) => color.toString() === fire[2].toString()))).toBe(true);
  });

  it('sementes diferentes mudam o momento da descarga, não apenas a posição dos pixels', () => {
    const q = { l: 30, t: 25, r: 62, b: 49 };
    const rhythms = [3, 20, 37].map(seed => Array.from({ length: 8 }, (_, f) => {
      const p = new Pix(100, 80); paintRadiance(p, q, electric, seed, false, f);
      return pixels(p).filter(([, , color]) => color.every(v => v === 255)).length;
    }).join(','));
    expect(new Set(rhythms).size).toBe(3);
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
    for (let frame = 0; frame < 8; frame++) {
      const pix = new Pix(100, 70), q = { l: 30, t: 25, r: 65, b: 45 };
      paintEnergyAccents(pix, el, q, shadow, 3, frame);
      expect(pixels(pix).length).toBeGreaterThan(5);
      for (const [, , color] of pixels(pix)) {
        expect(shadow.slice(0, 3)).toContainEqual(color);
        expect(Math.max(...color)).toBeLessThanOrEqual(64);
      }
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
