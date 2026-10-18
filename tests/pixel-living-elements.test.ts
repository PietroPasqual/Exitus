import { describe, expect, it } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';
import { Pix, rgb } from '../src/ui/pixel';
import { paintSpellSprite, spellSpriteBounds, spellSpriteOf, type SpellSprite } from '../src/ui/pixel-spell-sprites';
import { appearanceForScene, boundsOfBeing, layoutScene } from '../src/ui/pixel-scene-layout';
import { renderPixelScene } from '../src/ui/pixel-scene';

const studies: [string, SpellSprite][] = [
  ['vento', 'wind-sphere'], ['natureza', 'nature-sphere'], ['sombra', 'shadow-sphere'], ['luz', 'light-sphere']
];
const palette = ['#101724', '#294254', '#4e7983', '#83b4ad', '#d5e6cb', '#fff5d9'].map(rgb);
const make = (element: string, patch: Partial<Being> = {}): Being => ({
  elements: [element], shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false, bond: null,
  closed: false, ...patch
});
const appearance = (beings: Being[]): Appearance => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const occupied = (p: Pix): number[] => {
  const pixels = [];
  for (let i = 0; i < p.w * p.h; i++) if (p.data[i * 4 + 3]) pixels.push(i);
  return pixels;
};
const identical = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean => a.every((value, i) => value === b[i]);
const border = (p: Pix): number[] => {
  const result = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
    if (x === 0 || y === 0 || x === p.w - 1 || y === p.h - 1)
      result.push(...p.data.subarray((y * p.w + x) * 4, (y * p.w + x) * 4 + 4));
  return result;
};

describe('Pure living-element spell artwork', () => {
  it.each(studies)('%s selects its body only for a single sphere and a single element', (element, sprite) => {
    expect(spellSpriteOf(make(element))).toBe(sprite);
    expect(spellSpriteOf(make(element, { concepts: ['tempo'] }))).toBe(sprite);
    for (const patch of [
      { shapes: ['forma_cubo'] }, { shapes: [] }, { shapes: ['forma_esfera', 'forma_esfera'] },
      { intentForm: 'espada' as const }, { intentGlyph: 'CURA' },
      { elements: [element, 'agua'] }, { elements: [element, 'agua', 'raio'] },
      { elements: ['agua', element] }
    ]) expect(spellSpriteOf(make(element, patch)), JSON.stringify(patch)).not.toBe(sprite);
  });

  it('preserves all eight previously authored sprite selections', () => {
    for (const [element, form, expected] of [
      ['fogo', undefined, 'fire-sphere'], ['agua', undefined, 'water-sphere'],
      ['gelo', undefined, 'ice-sphere'], ['terra', undefined, 'earth-sphere'], ['metal', undefined, 'metal-sphere'],
      ['fogo', 'lanca', 'fire-lance'], ['agua', 'dragao', 'water-dragon'], ['raio', 'anel', 'lightning-ring']
    ] as const) expect(spellSpriteOf(make(element, form ? { intentForm: form } : {}))).toBe(expected);
  });

  it.each(studies)('%s paints complete native and miniature poses inside the shared loop envelope', (_element, sprite) => {
    const errors: unknown[] = [], originalPalette = structuredClone(palette);
    for (const s of [2.5, 6, 15]) for (const offset of [0, .45]) for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(100, 90), x = 50 + offset, y = 44 - offset;
      const q = spellSpriteBounds(sprite, s), box = paintSpellSprite(sprite, p, x, y, s, palette, 3, frame);
      const pixels = occupied(p);
      if (!pixels.length || !Object.values(box).every(Number.isFinite)) errors.push({ s, offset, frame, empty: true });
      if (!pixels.every(i => {
        const px = i % p.w, py = Math.floor(i / p.w);
        return px >= x + q.l && px <= x + q.r && py >= y + q.t && py <= y + q.b
          && px >= Math.floor(box.l) && px <= Math.ceil(box.r) && py >= Math.floor(box.t) && py <= Math.ceil(box.b);
      })) errors.push({ s, offset, frame, clipped: true });
      // Decorative motion remains attached to one body, including miniature copies.
      const remaining = new Set(pixels), queue = pixels.length ? [pixels[0]] : [];
      remaining.delete(pixels[0]);
      for (let i = 0; i < queue.length; i++) for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
        const next = queue[i] + dy * p.w + dx;
        if (remaining.delete(next)) queue.push(next);
      }
      if (remaining.size) errors.push({ s, offset, frame, detached: remaining.size });
    }
    expect(errors).toEqual([]);
    expect(palette).toEqual(originalPalette);
  });

  it.each(studies)('%s has a deterministic eight-frame material animation at large and copy sizes', (_element, sprite) => {
    for (const size of [3, 15]) {
      const render = (frame: number) => {
        const p = new Pix(80, 80); paintSpellSprite(sprite, p, 40, 40, size, palette, 3, frame); return p.data;
      };
      const frames = Array.from({ length: 8 }, (_, f) => render(f));
      expect(new Set(frames.map(data => data.join(','))).size).toBeGreaterThanOrEqual(size === 3 ? 3 : 6);
      expect(frames.every((data, frame) => identical(data, render(frame + 8)))).toBe(true);
      expect(identical(render(-1), frames[7])).toBe(true);
      expect(identical(render(2.7), frames[2])).toBe(true);
      for (const frame of [NaN, Infinity, -Infinity]) expect(identical(render(frame), frames[0])).toBe(true);
    }
  });

  it.each(studies)('%s fits six copies and eight orbitals at every animation pose without mutating rules', (element) => {
    for (const kind of ['copies', 'orbitals'] as const) {
      const ap = appearance(kind === 'copies' ? [make(element, { intentCount: '6' })]
        : Array.from({ length: 8 }, () => make(element, { orbit: true })));
      const before = structuredClone(ap), visual = appearanceForScene(ap), errors: unknown[] = [];
      expect(visual.beings).toHaveLength(kind === 'copies' ? 6 : 8);
      for (let frame = 0; frame < 8; frame++) {
        const layout = layoutScene(visual, frame);
        const boxes = visual.beings.map(b => boundsOfBeing(b, layout.poses.get(b)!));
        if (!boxes.every(q => q.l >= 2 && q.t >= 2 && q.r <= 178 && q.b <= 99)) errors.push({ frame, outside: boxes });
        if (!boxes.every((q, i) => boxes.slice(i + 1).every(z => q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t)))
          errors.push({ frame, overlap: true });
        const scene = renderPixelScene(ap, true, frame);
        expect([scene.pix.w, scene.pix.h]).toEqual([180, 105]);
      }
      expect(errors).toEqual([]);
      expect(ap).toEqual(before);
    }
  });

  it.each(studies)('%s keeps frame, labels and inputs intact through transport and concept overlays', element => {
    for (const night of [false, true]) {
      const expectedBorder = border(renderPixelScene({ beings: [], orbitCount: 0 }, night, 0).pix);
      for (const patch of [
        { placement: 'front' as const }, { placement: 'flight' as const, projectile: true },
        { placement: 'self' as const, direction: 'back' as const },
        { concepts: ['tempo', 'vida'], estado: true, guards: ['lateral' as const] }
      ]) {
        const ap = appearance([make(element, patch)]), before = structuredClone(ap);
        for (const frame of [0, 3, 7]) {
          const scene = renderPixelScene(ap, night, frame), wrapped = renderPixelScene(ap, night, frame + 8);
          expect(border(scene.pix)).toEqual(expectedBorder);
          expect(identical(scene.pix.data, wrapped.pix.data)).toBe(true);
          expect(scene.labels).toEqual(wrapped.labels);
        }
        expect(ap).toEqual(before);
      }
    }
  });
});
