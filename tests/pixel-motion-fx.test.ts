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

function hashPixels(pix: Pix): number {
  let hash = 2166136261;
  for (const value of pix.data) hash = Math.imul(hash ^ value, 16777619);
  return hash >>> 0;
}
function samePixels(a: Pix, b: Pix): boolean {
  return a.data.length === b.data.length && a.data.every((value, index) => value === b.data[index]);
}
function transportFrame(kind: TransportKind, frame: number, element?: string): Pix {
  const pix = new Pix(100, 70);
  paintSpellTransport(pix, [10, 55], [50, 7], [90, 45], ramp, kind, element, frame);
  return pix;
}
function motionFrame(element: string, compact: boolean, frame: number): Pix {
  const pix = new Pix(100, 70);
  paintSpellMotion(pix, compact ? { l: 35, t: 30, r: 43, b: 38 } : { l: 35, t: 22, r: 68, b: 45 }, 34, ramp, element, true, frame);
  return pix;
}

describe('Animação de oito quadros', () => {
  // Frozen from the published still painter (53b2bab), not from animated output.
  const stillTransport: [TransportKind, string | undefined, number][] = [
    ['flight', undefined, 3950689773], ['projection', undefined, 1172076642], ['return', undefined, 1181974205],
    ['flight', 'sombra', 1183624789], ['projection', 'sombra', 405142473], ['return', 'sombra', 3629528184]
  ];
  const stillMotion: [string, boolean, number][] = [
    ['fogo', false, 3008709347], ['fogo', true, 3335513046], ['raio', false, 217250811], ['raio', true, 2188132282],
    ['agua', false, 2418084284], ['agua', true, 3512226454], ['acido', false, 2418084284], ['acido', true, 3512226454],
    ['gelo', false, 534027209], ['gelo', true, 297846042], ['metal', false, 534027209], ['metal', true, 297846042],
    ['terra', false, 534027209], ['terra', true, 297846042], ['materia', false, 534027209], ['materia', true, 297846042],
    ['vento', false, 501590755], ['vento', true, 863716882], ['som', false, 501590755], ['som', true, 863716882],
    ['luz', false, 501590755], ['luz', true, 863716882], ['sombra', false, 2283302856], ['sombra', true, 2118029108],
    ['morte', false, 2283302856], ['morte', true, 2118029108], ['vazio', false, 2283302856], ['vazio', true, 2118029108]
  ];
  it.each(stillTransport)('%s/%s mantém o quadro zero idêntico à arte estática publicada', (kind, element, hash) => {
    expect(hashPixels(transportFrame(kind, 0, element))).toBe(hash);
    expect(hashPixels(transportFrame(kind, 8, element))).toBe(hash);
  });
  it.each(stillMotion)('%s/compacto=%s mantém o quadro zero idêntico à arte estática publicada', (element, compact, hash) => {
    expect(hashPixels(motionFrame(element, compact, 0))).toBe(hash);
    expect(hashPixels(motionFrame(element, compact, 8))).toBe(hash);
  });

  it.each(kinds)('%s anima o fluxo mantendo destino e extensão da curva', kind => {
    const hashes = new Set<number>();
    for (let frame = 0; frame < 8; frame++) {
      const pix = transportFrame(kind, frame);
      hashes.add(hashPixels(pix));
      expect(visible(pix, 90, 45)).toBe(true);
      for (const [x, y] of points(pix)) {
        expect(x).toBeGreaterThanOrEqual(7); expect(x).toBeLessThanOrEqual(93);
        expect(y).toBeGreaterThanOrEqual(23); expect(y).toBeLessThanOrEqual(58);
      }
      expect(samePixels(pix, transportFrame(kind, frame + 8))).toBe(true);
    }
    expect(hashes.size).toBeGreaterThan(5);
  });

  it.each([false, true])('as setas de retorno caminham de from para to, invertido=%s', reverse => {
    const marks = (frame: number): number[] => {
      const pix = new Pix(100, 70);
      paintSpellTransport(pix, reverse ? [90, 35] : [10, 35], [50, 35], reverse ? [10, 35] : [90, 35], ramp, 'return', undefined, frame);
      return [...new Set(points(pix).filter(([x, y]) => y !== 35 && (reverse ? x > 15 : x < 85)).map(([x]) => x))].sort((a, b) => a - b);
    };
    expect(marks(1)).toEqual(marks(0).map(x => x + (reverse ? -10 : 10)));
  });

  it.each(elements)('%s desloca riscos inteiros sem piscar ou entrar na caixa', element => {
    for (const compact of [false, true]) {
      const hashes = new Set<number>();
      const reference = points(motionFrame(element, compact, 0)).length;
      for (let frame = 0; frame < 8; frame++) {
        const pix = motionFrame(element, compact, frame), pixels = points(pix);
        hashes.add(hashPixels(pix));
        expect(pixels.length).toBe(reference);
        for (const [x] of pixels) expect(x < 35 || x > (compact ? 43 : 68)).toBe(true);
        expect(samePixels(pix, motionFrame(element, compact, frame + 8))).toBe(true);
      }
      expect(hashes.size).toBeGreaterThan(2);
    }
  });

  it('não muda entradas e normaliza quadros negativos, fracionários ou inválidos', () => {
    const from: MotionPoint = [10, 55], control: MotionPoint = [50, 7], to: MotionPoint = [90, 45], box = { l: 35, t: 22, r: 68, b: 45 };
    const before = JSON.stringify({ from, control, to, box, ramp });
    for (let frame = 0; frame < 8; frame++) {
      paintSpellTransport(new Pix(100, 70), from, control, to, ramp, 'return', 'fogo', frame);
      paintSpellMotion(new Pix(100, 70), box, 34, ramp, 'fogo', true, frame);
    }
    expect(JSON.stringify({ from, control, to, box, ramp })).toBe(before);
    for (const [input, normalized] of [[-1, 7], [9, 1], [3.8, 3], [NaN, 0], [Infinity, 0], [-Infinity, 0]]) {
      expect(samePixels(transportFrame('projection', input), transportFrame('projection', normalized))).toBe(true);
      expect(samePixels(motionFrame('fogo', false, input), motionFrame('fogo', false, normalized))).toBe(true);
    }
  });

  it.each(['sombra', 'morte', 'vazio'])('%s conserva os tons escuros nos oito quadros', element => {
    for (let frame = 0; frame < 8; frame++) for (const pix of [transportFrame('return', frame, element), motionFrame(element, false, frame)]) {
      for (const [x, y] of points(pix)) {
        const color = Array.from(pix.data.slice((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 3));
        expect(ramp.slice(0, 3)).toContainEqual(color);
      }
    }
  });
});
