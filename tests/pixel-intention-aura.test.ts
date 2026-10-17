import { describe, expect, it } from 'vitest';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { paintIntentionAura } from '../src/ui/pixel-intention-aura';
import { paintIntention } from '../src/ui/pixel-intention';
import type { SpellMaterial } from '../src/ui/pixel-materials';

const materials: SpellMaterial[] = ['fire', 'plasma', 'water', 'ice', 'stone', 'metal', 'wind', 'energy'];
const ramp = ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'].map(rgb);
const background: RGB = [24, 31, 38], ink: RGB = [8, 9, 12];
const pixel = (pix: Pix, x: number, y: number): number[] => Array.from(pix.data.slice((y * pix.w + x) * 4, (y * pix.w + x) * 4 + 4));
function scene(w = 60, h = 40): Pix {
  const pix = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pix.set(x, y, background);
  return pix;
}
function rectangle(body: Pix, l = 16, t = 12, r = 43, b = 27): void {
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) body.set(x, y, ink);
}
function changed(pix: Pix): [number, number][] {
  const points: [number, number][] = [];
  for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
    if (pixel(pix, x, y).some((v, k) => v !== [...background, 255][k])) points.push([x, y]);
  }
  return points;
}

describe('Aura aderida à silhueta das Intenções', () => {
  it.each(materials)('%s cria faixas contínuas e curtas sem pontilhado', mat => {
    const pix = scene(), body = new Pix(60, 40);
    rectangle(body);
    paintIntentionAura(pix, body, ramp, mat);
    const radius = mat === 'plasma' ? 4 : mat === 'stone' || mat === 'metal' ? 2 : 3;
    for (let d = 1; d <= radius; d++) {
      const expected = pixel(pix, 24, 12 - d);
      expect(expected).not.toEqual([...background, 255]);
      for (let x = 18; x <= 41; x++) expect(pixel(pix, x, 12 - d)).toEqual(expected);
    }
    expect(pixel(pix, 24, 11 - radius)).toEqual([...background, 255]);
    expect(pixel(pix, 16, 12)).toEqual([...background, 255]);
    expect(pixel(pix, 0, 0)).toEqual([...background, 255]);
  });

  it('segue as pontas de uma lança e não preenche um oval em sua caixa', () => {
    const pix = scene(90, 60), body = new Pix(90, 60);
    paintIntention(body, 'lanca', 45, 30, 18, ramp, 'water', 7);
    paintIntentionAura(pix, body, ramp, 'water');
    expect(changed(pix).length).toBeGreaterThan(40);
    for (const [x, y] of changed(pix)) {
      expect(body.data[(y * body.w + x) * 4 + 3]).toBe(0);
      let near = false;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) * 10 + Math.min(Math.abs(dx), Math.abs(dy)) * 4 <= 30 && xx >= 0 && yy >= 0 && xx < body.w && yy < body.h && body.data[(yy * body.w + xx) * 4 + 3]) near = true;
      }
      expect(near).toBe(true);
    }
    expect(pixel(pix, 45, 14)).toEqual([...background, 255]);
  });

  it('preserva todo o interior transparente de anéis, olhos vazados e letras', () => {
    const pix = scene(), body = new Pix(60, 40);
    for (const [l, t, r, b] of [[15, 9, 44, 30], [23, 16, 36, 23]]) {
      body.line(l, t, r, t, ink); body.line(l, b, r, b, ink);
      body.line(l, t, l, b, ink); body.line(r, t, r, b, ink);
    }
    const exterior = paintIntentionAura(pix, body, ramp, 'plasma');
    for (let y = 10; y < 30; y++) for (let x = 16; x < 44; x++) expect(pixel(pix, x, y)).toEqual([...background, 255]);
    expect(pixel(pix, 30, 8)).not.toEqual([...background, 255]);
    expect(exterior.length).toBe(pix.w * pix.h);
    for (let y = 9; y <= 30; y++) for (let x = 15; x <= 44; x++) expect(exterior[y * pix.w + x]).toBe(0);
    expect(exterior[8 * pix.w + 30]).toBe(1);
    expect(exterior[0]).toBe(1);
  });

  it('mantém corredores abertos entre grades e cópias próximas sem uni-los com luz', () => {
    const pix = scene(), body = new Pix(60, 40);
    body.line(25, 10, 25, 29, ink); body.line(29, 10, 29, 29, ink);
    const exterior = paintIntentionAura(pix, body, ramp, 'plasma');
    for (let y = 10; y <= 29; y++) for (let x = 26; x < 29; x++) {
      expect(pixel(pix, x, y)).toEqual([...background, 255]);
      expect(exterior[y * pix.w + x]).toBe(0);
    }
    expect(pixel(pix, 24, 19)).not.toEqual([...background, 255]);
    expect(pixel(pix, 30, 19)).not.toEqual([...background, 255]);
  });

  it.each(['sombra', 'morte', 'vazio'])('%s usa somente tons escuros, sem a auréola branca do material', element => {
    const darkRamp = ['#050506', '#16181b', '#343a40', '#495057', '#ced4da'].map(rgb);
    const pix = scene(), body = new Pix(60, 40);
    rectangle(body);
    paintIntentionAura(pix, body, darkRamp, 'plasma', element);
    const points = changed(pix);
    expect(points.length).toBeGreaterThan(0);
    for (const [x, y] of points) expect(pixel(pix, x, y).slice(0, 3).every((value, k) => value <= background[k])).toBe(true);
    expect(pixel(pix, 24, 9)).toEqual([...background, 255]);
  });

  it.each(materials)('%s não altera o corpo, o contorno e os pixels já desenhados sobre ele', mat => {
    const pix = scene(), body = new Pix(60, 40);
    paintIntention(body, 'dragao', 30, 20, 12, ramp, mat, 7);
    for (let i = 0; i < body.data.length; i += 4) if (body.data[i + 3]) pix.data.set(body.data.slice(i, i + 4), i);
    const original = pix.data.slice(), mask = body.data.slice(), palette = structuredClone(ramp);
    paintIntentionAura(pix, body, ramp, mat);
    for (let i = 0; i < mask.length; i += 4) if (mask[i + 3]) expect(Array.from(pix.data.slice(i, i + 4))).toEqual(Array.from(original.slice(i, i + 4)));
    expect(body.data).toEqual(mask);
    expect(ramp).toEqual(palette);
  });

  it('é determinística e recorta corretamente o corpo em cada borda', () => {
    for (const [x, y] of [[0, 0], [59, 0], [0, 39], [59, 39]]) {
      const a = scene(), b = scene(), body = new Pix(60, 40);
      paintIntention(body, 'espada', x, y, 8, ramp, 'fire', 2);
      paintIntentionAura(a, body, ramp, 'fire'); paintIntentionAura(b, body, ramp, 'fire');
      expect(a.data).toEqual(b.data);
      expect(a.data.every(Number.isFinite)).toBe(true);
      expect(changed(a).length).toBeGreaterThan(0);
    }
  });

  it('aceita máscaras vazias, telas pequenas, dimensões diferentes e paletas curtas', () => {
    const pix = scene(), original = pix.data.slice(), empty = new Pix(60, 40);
    paintIntentionAura(pix, empty, ramp, 'water');
    expect(pix.data).toEqual(original);
    empty.set(30, 20, ink);
    paintIntentionAura(pix, empty, [], 'water');
    expect(pix.data).toEqual(original);
    for (const [w, h] of [[1, 1], [2, 3], [8, 9], [64, 48]]) {
      const body = new Pix(w, h); body.set(0, 0, ink);
      paintIntentionAura(pix, body, [ramp[0]], 'water');
      expect(pix.data.every(Number.isFinite)).toBe(true);
    }
  });

  it('usa a cor do elemento em cada faixa, sem flare branco nem ruído aleatório', () => {
    const a = scene(), b = scene(), body = new Pix(60, 40);
    rectangle(body);
    paintIntentionAura(a, body, [[220, 30, 10]], 'fire');
    paintIntentionAura(b, body, [[10, 30, 220]], 'fire');
    expect(changed(a)).toEqual(changed(b));
    expect(pixel(a, 25, 11)[0]).toBeGreaterThan(pixel(a, 25, 11)[2]);
    expect(pixel(b, 25, 11)[2]).toBeGreaterThan(pixel(b, 25, 11)[0]);
    const colors = new Set(changed(a).map(([x, y]) => pixel(a, x, y).join(',')));
    expect(colors.size).toBe(3);
  });

  it('retorna uma máscara utilizável para FX mesmo sem paleta e não bloqueia o fundo distante', () => {
    const pix = scene(), body = new Pix(60, 40);
    rectangle(body);
    const exterior = paintIntentionAura(pix, body, [], 'water');
    for (let y = 0; y < pix.h; y++) for (let x = 0; x < pix.w; x++) {
      expect(exterior[y * pix.w + x]).toBe(x >= 16 && x <= 43 && y >= 12 && y <= 27 ? 0 : 1);
    }
    const empty = paintIntentionAura(pix, new Pix(60, 40), ramp, 'water');
    expect(empty.every(value => value === 1)).toBe(true);
  });
});
