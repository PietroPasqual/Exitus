import { describe, expect, it } from 'vitest';
import { Pix, type RGB } from '../src/ui/pixel';
import { MixtureGeometryCache } from '../src/ui/pixel-mixture-cache';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { paintIntention } from '../src/ui/pixel-intention';
import { paintIntentionGlyph } from '../src/ui/pixel-intention-glyph';
import { BODY_MATERIALS } from '../src/ui/pixel-mixture-signatures';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const marks: RGB[] = [[20, 30, 40], [80, 100, 120], [160, 175, 190], [240, 245, 250]];
const box = { l: 2, t: 2, r: 28, b: 24 };
function body(): Pix {
  const p = new Pix(32, 28);
  for (let y = 3; y < 24; y++) for (let x = 3; x < 28; x++) p.set(x, y, marks[1]);
  return p;
}
function copy(source: Pix): Pix { const result = new Pix(source.w, source.h); result.data.set(source.data); return result; }
const state = (domains: unknown): string => JSON.stringify(domains);

describe('authored material budget marks', () => {
  it('excludes real dark cuts, near-palette cuts, highlights and transparent holes from grey geometry', () => {
    const p = body();
    const cuts: [number, number, RGB][] = [[8, 8, [10, 12, 18]], [9, 8, marks[0]], [10, 8, [25, 35, 45]],
      [11, 8, marks[3]], [12, 8, [235, 240, 245]]];
    for (const [x, y, color] of cuts) p.set(x, y, color);
    p.data[(15 * p.w + 15) * 4 + 3] = 0;
    const original = p.data.slice(), cache = new MixtureGeometryCache();
    const plain = cache.allocate(p, box, 4), marked = cache.allocate(p, box, 4, { authoredMarks: marks, interfacePattern: 'fold' });
    for (const [x, y] of cuts) { expect(plain.ownerAt(x, y)).toBeGreaterThanOrEqual(0); expect(marked.ownerAt(x, y)).toBe(-1); }
    expect(marked.ownerAt(15, 15)).toBe(-1);
    expect(marked.budget.subpixel).toEqual([]);
    expect(marked.regions.every(region => region.pixelCount >= 2)).toBe(true);
    expect(p.data).toEqual(original);
    expect(state(cache.allocate(p, box, 4, { authoredMarks: [] }))).toBe(state(plain));
  });

  it('keys the exact occupied/protected bits while reusing geometry across palette and animation history', () => {
    const reference = body(), cache = new MixtureGeometryCache(4, reference.w * reference.h * 4);
    const options = { authoredMarks: marks, interfacePattern: 'flow' as const };
    const first = cache.allocate(reference, box, 4, options), expected = state(first);
    expect(cache.size).toBe(1);
    for (let frame = 0; frame < 8; frame++) {
      const animated = copy(reference);
      for (let i = 0; i < animated.data.length; i += 4) if (animated.data[i + 3]) animated.data.set([frame * 30, 220, 30], i);
      expect(state(cache.allocate(animated, box, 4, options, reference))).toBe(expected);
    }
    expect(cache.size).toBe(1);
    const sameMask = marks.map(color => [...color] as RGB); sameMask[1] = [90, 110, 130];
    expect(state(cache.allocate(reference, box, 4, { ...options, authoredMarks: sameMask }))).toBe(expected);
    expect(cache.size).toBe(1);
    reference.set(12, 10, marks[0]);
    const cut = cache.allocate(reference, box, 4, options);
    expect(cut.ownerAt(12, 10)).toBe(-1); expect(cache.size).toBe(2);
    reference.set(12, 10, [24, 34, 44]);
    expect(state(cache.allocate(reference, box, 4, options))).toBe(state(cut)); expect(cache.size).toBe(2);
    reference.set(12, 10, marks[1]);
    expect(state(cache.allocate(reference, box, 4, options))).toBe(expected);
    first.owner.fill(15); first.budget.represented.length = 0;
    expect(state(cache.allocate(reference, box, 4, options))).toBe(expected);
  });

  it('keeps marked-body ownership fixed and mirror-exact after palette marks split safe components', () => {
    const p = body(); for (let y = 5; y < 23; y++) p.set(12, y, marks[0]);
    p.set(8, 10, marks[3]);
    const mirrored = new Pix(p.w, p.h);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      const i = (y * p.w + x) * 4; mirrored.data.set(p.data.subarray(i, i + 4), (y * p.w + p.w - 1 - x) * 4);
    }
    const cache = new MixtureGeometryCache(), preferredSeeds = [null, { x: 24.25, y: 19.75 }, { x: 6.5, y: 6.25 }, { x: 24.25, y: 7.5 }];
    const a = cache.allocate(p, box, 4, { authoredMarks: marks, interfacePattern: 'root', preferredSeeds });
    const b = cache.allocate(mirrored, { ...box, l: p.w - 1 - box.r, r: p.w - 1 - box.l }, 4, {
      authoredMarks: marks, interfacePattern: 'root', reverse: true,
      preferredSeeds: preferredSeeds.map(point => point && ({ x: p.w - 1 - point.x, y: point.y }))
    });
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) expect(b.ownerAt(p.w - 1 - x, y)).toBe(a.ownerAt(x, y));
    expect(b.regions.map(region => region.pixelCount)).toEqual(a.regions.map(region => region.pixelCount));
  });
});

type Material = typeof BODY_MATERIALS[number];
const mat: Partial<Record<Material, string>> = { fogo: 'fire', raio: 'plasma', luz: 'plasma', agua: 'water', acido: 'water', gelo: 'ice',
  terra: 'stone', materia: 'stone', gravidade: 'stone', metal: 'metal', vento: 'wind', som: 'wind' };
const many: readonly [number, boolean, string][] = [
  [0, false, 'rede'], [1, false, 'rede'], [1, true, 'rede'], [2, true, 'rede'], [6, false, 'rede'],
  [7, false, 'lanca'], [7, true, 'rede'], [8, true, 'lanca'], [10, false, 'rede'], [11, false, 'rede'],
  [11, true, 'rede'], [12, true, 'rede'], [13, false, 'rede'], [14, false, 'rede'], [14, true, 'rede'], [15, true, 'rede'],
  [1, false, 'dragao'], [2, true, 'dragao'], [5, false, 'dragao'], [6, true, 'dragao'], [13, false, 'dragao'], [14, true, 'dragao']
];
const cases = [
  ...many.map(([offset, reverse, form]) => {
    const elements = Array.from({ length: 16 }, (_, i) => BODY_MATERIALS[(i + offset) % 16]); if (reverse) elements.reverse();
    return { name: `${form}:16:${offset}:${reverse}`, form, elements, reverse, frame: offset % 8, size: 15, glyph: false };
  }),
  ...Array.from({ length: 8 }, (_, frame) => ({ name: `nunchaku:compact:${frame}`, form: 'nunchaku',
    elements: ['natureza', 'luz'] as Material[], reverse: false, frame, size: 4, glyph: false })),
  ...(['terra', 'gelo', 'materia', 'gravidade'] as const).flatMap(primary => (['ilusao', 'espaco'] as const).map(secondary => ({
    name: `VÉU:${primary}+${secondary}`, form: 'VÉU', elements: [primary, secondary], reverse: false, frame: 3, size: 15, glyph: true
  })))
];

describe('previously hidden material signatures', () => {
  it.each(cases)('$name retains every constituent in actual paintable authored pixels', fixture => {
    const p = new Pix(96, 96), primary = fixture.elements[0], ramp = SIGNATURE_RAMPS[primary];
    const material = (mat[primary] ?? 'energy') as Parameters<typeof paintIntention>[6];
    const bounds = fixture.glyph ? paintIntentionGlyph(p, fixture.form, 48, 48, fixture.size, ramp, material, 3, primary, fixture.reverse)
      : paintIntention(p, fixture.form as Parameters<typeof paintIntention>[1], 48, 48, fixture.size, ramp, material, 3, primary, fixture.reverse);
    const before = p.data.slice();
    const report = paintAllocatedMixture(p, bounds, fixture.elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })), {
      form: fixture.glyph ? 'glyph' : fixture.form, authoredRamp: ramp, frame: fixture.frame, seed: 3, reverse: fixture.reverse
    });
    expect(report.budget.subpixel).toEqual([]);
    expect(report.paintedPixels.every(count => count >= 2)).toBe(true);
    const first = ramp[0], peak = ramp[ramp.length - 1], luma = (c: ArrayLike<number>) => c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
    for (let i = 0; i < before.length; i += 4) {
      expect(p.data[i + 3]).toBe(before[i + 3]);
      const color = before.subarray(i, i + 3), light = luma(color);
      const near = (c: RGB) => Math.max(...Array.from(color, (v, k) => Math.abs(v - c[k]))) <= 5;
      if (!before[i + 3] || Math.max(...color) < 22 || light <= luma(first) + 1 || near(first) || light >= luma(peak) - 1 || near(peak)) {
        expect(p.data.subarray(i, i + 3)).toEqual(color);
      }
    }
  });
});
