import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintSpellTransport, type MotionPoint, type TransportKind } from '../src/ui/pixel-motion-fx';

const ramp = ['#163944', '#286276', '#489fac', '#a0d8de', '#e8ffff'].map(rgb);
const kinds: TransportKind[] = ['flight', 'projection', 'return'];
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
describe('Animação de oito quadros', () => {
  it.each(kinds)('%s exporta a mesma amostra determinística do ciclo animado', kind => {
    for (const element of [undefined, 'sombra']) {
      const still = new Pix(100, 70);
      paintSpellTransport(still, [10, 55], [50, 7], [90, 45], ramp, kind, element);
      for (const frame of [0, 8, 16]) expect(samePixels(transportFrame(kind, frame, element), still)).toBe(true);
    }
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
  it('normaliza fases inválidas sem alterar coordenadas ou paleta', () => {
    for(const [input,expected] of [[-1,7],[9,1],[3.8,3],[NaN,0],[Infinity,0]])
      expect(transportFrame('projection',input).data).toEqual(transportFrame('projection',expected).data);
    const from: MotionPoint=[10,55],control: MotionPoint=[50,7],to: MotionPoint=[90,45];
    const before=JSON.stringify({from,control,to,ramp});
    for(let f=0;f<8;f++) paintSpellTransport(new Pix(100,70),from,control,to,ramp,'flight','fogo',f,true);
    expect(JSON.stringify({from,control,to,ramp})).toBe(before);
  });
  it('o transporte conectado termina sem seta nem ecos paralelos', () => {
    const joined=new Pix(100,70),ordinary=new Pix(100,70);
    paintSpellTransport(joined,[10,55],[50,45],[90,45],ramp,'flight','fogo',0,true);
    paintSpellTransport(ordinary,[10,55],[50,45],[90,45],ramp,'flight','fogo',0,false);
    expect(visible(joined,90,45)).toBe(true);
    expect(points(joined).length).toBeLessThan(points(ordinary).length);
    expect(points(joined).filter(([x])=>x>=86).every(([,y])=>y===45)).toBe(true);
  });

});
