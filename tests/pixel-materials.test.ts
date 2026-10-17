import { describe, expect, it } from 'vitest';
import { materialPixel, type SpellMaterial } from '../src/ui/pixel-materials';
import { rgb, type RGB } from '../src/ui/pixel';

const materials: SpellMaterial[] = ['fire', 'plasma', 'water', 'ice', 'stone', 'metal', 'wind', 'energy'];
const ramp = ['#162c47', '#245078', '#3686a6', '#6ac4d2', '#b7e8eb', '#f2ffff'].map(rgb);

function sample(mat: SpellMaterial, seed = 7, illumination?: number, palette: RGB[] = ramp, element?: string): RGB[] {
  const pixels: RGB[] = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const u = x / 31, v = y / 31;
    pixels.push(materialPixel(palette, mat, x, y, u, v, illumination ?? (1 - (u + v) / 2), seed, element));
  }
  return pixels;
}

describe('pixel spell materials', () => {
  it.each(materials)('%s is deterministic, finite and restricted to its supplied palette', mat => {
    const original = structuredClone(ramp);
    const first = sample(mat);
    expect(sample(mat)).toEqual(first);
    for (const color of first) {
      expect(ramp).toContain(color);
      expect(color).toHaveLength(3);
      expect(color.every(c => Number.isFinite(c) && Number.isInteger(c) && c >= 0 && c <= 255)).toBe(true);
    }
    expect(ramp).toEqual(original);
    expect(new Set(first.map(c => c.join(','))).size).toBeGreaterThan(2);
  });

  it('gives the materials different surface structures even with the same palette and illumination', () => {
    const signatures = materials.map(mat => sample(mat, 7, .5).map(color => ramp.indexOf(color)).join(''));
    expect(new Set(signatures).size).toBe(materials.length);
  });

  it.each(materials)('%s retains connected colour clusters rather than alternating pixels', mat => {
    const pixels = sample(mat);
    let equal = 0, neighbors = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const at = y * 32 + x;
      if (x < 31) { neighbors++; if (pixels[at] === pixels[at + 1]) equal++; }
      if (y < 31) { neighbors++; if (pixels[at] === pixels[at + 32]) equal++; }
    }
    expect(equal / neighbors).toBeGreaterThan(.6);
  });

  it.each(materials)('%s responds to surface illumination without losing its material marks', mat => {
    const dark = sample(mat, 7, .1).map(color => ramp.indexOf(color));
    const lit = sample(mat, 7, .9).map(color => ramp.indexOf(color));
    expect(lit.reduce((sum, color) => sum + color, 0)).toBeGreaterThan(dark.reduce((sum, color) => sum + color, 0));
    expect(lit.every((color, i) => color >= dark[i])).toBe(true);
  });

  it('keeps the hottest fire core small and the rest coloured', () => {
    const pixels = sample('fire', 7, .65);
    const bright = pixels.filter(color => color === ramp[ramp.length - 1]).length;
    expect(bright).toBeGreaterThan(0);
    expect(bright / pixels.length).toBeLessThan(.15);
    expect(pixels.filter(color => ramp.indexOf(color) < ramp.length - 2).length / pixels.length).toBeGreaterThan(.6);
  });

  it('supports short palettes and clips local coordinates and illumination safely', () => {
    for (const mat of materials) {
      expect(materialPixel([ramp[0]], mat, 0, 0, -1, 2, 9, 7)).toBe(ramp[0]);
      expect(materialPixel([], mat, 0, 0, .5, .5, .5, 7)).toEqual([0, 0, 0]);
      const colors = sample(mat, 7, .5, [ramp[0], ramp[5]]);
      expect(colors.every(color => color === ramp[0] || color === ramp[5])).toBe(true);
    }
  });

  it('varies seeded currents reproducibly and keeps light broader than electricity', () => {
    expect(sample('fire', 42)).not.toEqual(sample('fire', 7));
    expect(sample('water', 42)).not.toEqual(sample('water', 7));
    const brightArea = (element: string) => sample('plasma', 7, .4, ramp, element).filter(color => ramp.indexOf(color) >= 4).length;
    expect(brightArea('luz')).toBeGreaterThan(brightArea('raio'));
  });

  it.each(['natureza', 'vida', 'sombra', 'morte', 'vazio', 'espaco', 'infinito'])('%s has its own palette-safe surface instead of the generic energy ring', element => {
    const pixels = sample('energy', 7, .5, ramp, element);
    expect(pixels).not.toEqual(sample('energy', 7, .5));
    expect(sample('energy', 7, .5, ramp, element)).toEqual(pixels);
    expect(pixels.every(color => ramp.includes(color))).toBe(true);
  });

  it('keeps shadow, death and void dark without a pale continuous rim', () => {
    for (const element of ['sombra', 'morte', 'vazio']) {
      const pixels = sample('energy', 7, .9, ramp, element);
      expect(pixels.filter(color => ramp.indexOf(color) >= 4)).toHaveLength(0);
      expect(pixels.filter(color => ramp.indexOf(color) <= 2).length / pixels.length).toBeGreaterThan(.9);
    }
    expect(sample('energy', 7, .5, ramp, 'vazio')).not.toEqual(sample('energy', 7, .5, ramp, 'morte'));
  });

  it('gives nature internal veins without a bright button-like perimeter', () => {
    const pixels = sample('energy', 7, .5, ramp, 'natureza');
    const edge: RGB[] = [], inside: RGB[] = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const radius = Math.hypot(x / 31 - .5, y / 31 - .5);
      if (radius > .39 && radius < .49) edge.push(pixels[y * 32 + x]);
      else if (radius < .3) inside.push(pixels[y * 32 + x]);
    }
    expect(edge.filter(color => ramp.indexOf(color) >= 4).length / edge.length).toBeLessThan(.1);
    expect(inside.some(color => ramp.indexOf(color) >= 3)).toBe(true);
  });

  it.each(['fire', 'plasma', 'water'] as const)('%s changes currents between adjacent piece seeds', mat => {
    const first = sample(mat, 7, .5), next = sample(mat, 8, .5);
    expect(first.filter((color, index) => color !== next[index]).length / first.length).toBeGreaterThan(.03);
  });
});

describe('Sculpted elemental planes', () => {
  const tone = (mat: SpellMaterial, u: number, v: number, element?: string): number =>
    ramp.indexOf(materialPixel(ramp, mat, Math.round(u * 32), Math.round(v * 32), u, v, .7, 7, element));

  it('places the fire heart inside a coloured, shadowed perimeter', () => {
    expect(tone('fire', .43, .64)).toBeGreaterThanOrEqual(4);
    expect(tone('fire', .06, .5)).toBeLessThanOrEqual(2);
    expect(tone('fire', .43, .64) - tone('fire', .06, .5)).toBeGreaterThanOrEqual(3);
  });

  it('separates the curved water reflection from its deep transparent basin', () => {
    expect(tone('water', .24, .24)).toBe(5);
    expect(tone('water', .62, .43)).toBeLessThanOrEqual(2);
  });

  it('gives ice broad opposing faces instead of a uniformly pale disc', () => {
    expect(tone('ice', .2, .3) - tone('ice', .8, .3)).toBeGreaterThanOrEqual(2);
  });

  it('bounds a narrow metal specular with a dark reflected band', () => {
    expect(tone('metal', .27, .5)).toBe(5);
    expect(tone('metal', .36, .5)).toBeLessThanOrEqual(1);
    expect(tone('metal', .6, .5)).toBeLessThan(4);
  });
});
