import { describe, expect, it } from 'vitest';
import type { Appearance, Being, Placement } from '../src/core/appearance';
import { appearanceForScene, boundsOfBeing, layoutParts, layoutScene } from '../src/ui/pixel-scene-layout';
import { spellSpriteBounds, spellSpriteOf } from '../src/ui/pixel-spell-sprites';
import { intentionBounds } from '../src/ui/pixel-intention';
import { glyphBounds } from '../src/ui/pixel-intention-glyph';

const being = (patch: Partial<Being> = {}): Being => ({
  elements: ['fogo'], shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false, ...patch
});
const appearance = (beings: Being[]): Appearance => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const repeat = (n: number, patch: Partial<Being>): Being[] => Array.from({ length: n }, () => being(structuredClone(patch)));
const shapes = ['forma_esfera', 'forma_cubo', 'forma_paralelepipedo', 'forma_piramide'];
const intentionForms = ['lanca', 'espada', 'escudo', 'flecha', 'martelo', 'parede', 'machado'] as const;
const intentionGlyphs = ['1', '0', '37', '3,14', 'a'.repeat(40), 'Coração', '魔法', 'Kael7'];

function assertBodiesFit(ap: Appearance): void {
  const result = layoutScene(ap);
  expect(result.poses.size).toBe(ap.beings.length);
  ap.beings.forEach(b => {
    const p = result.poses.get(b)!;
    expect(p.s).toBeGreaterThanOrEqual(2.5);
    const q = boundsOfBeing(b, p);
    expect(q.l).toBeGreaterThanOrEqual(3);
    expect(q.r).toBeLessThanOrEqual(177);
    expect(q.t).toBeGreaterThanOrEqual(3);
    expect(q.b).toBeLessThanOrEqual(97.001);
  });
}

describe('structural spell part layout', () => {
  it('leaves separate formats apart and closes only the seams for Ligação', () => {
    const source = being({ shapes: ['forma_esfera', 'forma_esfera', 'forma_esfera'] });
    const separate = layoutParts(source, 15), linked = layoutParts({ ...source, linked: true }, 15);
    expect(separate.width).toBeGreaterThan(linked.width + 8);
    expect(separate.parts[1].x - separate.parts[0].x - 15 * 1.64).toBeCloseTo(4.8);
    expect(linked.parts[1].x - linked.parts[0].x - 15 * 1.64).toBeCloseTo(-.5);
    expect(linked.parts.map(p => p.shape)).toEqual(source.shapes);
    const fused = layoutParts({ ...source, linked: true, merged: true }, 15);
    expect(fused.width).toBeLessThan(linked.width);
    expect(fused.parts.map(p => p.shape)).toEqual(source.shapes);
  });

  it.each(['front', 'touch', 'far', 'self', 'escort'] as Placement[])('assembles a projectile independently of %s placement', placement => {
    const b = being({ shapes: ['forma_piramide', 'forma_paralelepipedo', 'forma_esfera', 'forma_piramide'], projectile: true, placement });
    const expected = layoutParts({ ...b, placement: 'flight' }, 12);
    expect(layoutParts(b, 12)).toEqual(expected);
    expect(expected.parts.map(p => p.shape)).toEqual(['forma_paralelepipedo', 'forma_esfera', 'forma_piramide', 'forma_piramide']);
  });

  it('centres the asymmetric tip rather than letting it extend beyond the projectile box', () => {
    const s = 15, p = layoutParts(being({ shapes: ['forma_piramide'], projectile: true }), s);
    expect(p.parts[0].x).toBeCloseTo(-s * .25);
    expect(p.parts[0].x - s * .8).toBeCloseTo(-p.width / 2);
    expect(p.parts[0].x + s * 1.3).toBeCloseTo(p.width / 2);
    expect(p.top).toBeCloseTo(-s * .85);
  });

  it('includes the isometric depth of both blocks and the full tall geometry', () => {
    const cube = layoutParts(being({ shapes: ['forma_cubo'] }), 15);
    const vertical = layoutParts(being({ shapes: ['forma_paralelepipedo'] }), 15);
    const horizontal = layoutParts(being({ shapes: ['forma_paralelepipedo'], projectile: true }), 15);
    expect(cube.width).toBeGreaterThan(15 * 1.3);
    expect(cube.bottom - cube.top).toBeGreaterThan(15 * 1.3);
    expect(vertical.bottom - vertical.top).toBeGreaterThan(vertical.width * 1.8);
    expect(horizontal.width).toBeGreaterThan((horizontal.bottom - horizontal.top) * 1.7);
  });

  it('preserves every repeated format, the input order and all input flags', () => {
    const b = being({ projectile: true, linked: true, shapes: [...shapes, ...shapes] }), before = structuredClone(b);
    const result = layoutParts(b, 8);
    expect(result.parts.map(p => p.shape).sort()).toEqual([...b.shapes].sort());
    expect(b).toEqual(before);
  });
});

describe('bounded scene layout', () => {
  it('keeps the basic caster, floating spell and flight positions recognisable', () => {
    const front = being(), flight = being({ placement: 'flight', projectile: true });
    expect(layoutScene(appearance([front])).poses.get(front)).toEqual({ x: 92, y: 48, s: 15 });
    const result = layoutScene(appearance([flight]));
    expect(result.casterX).toBe(18);
    expect(result.flightPos).toEqual([102, 50]);
    expect(result.flightHalf).toBeCloseTo(layoutParts(flight, result.poses.get(flight)!.s).width / 2);
  });

  it.each(shapes)('fits eight %s formats in a single projectile without losing parts', shape => {
    const b = being({ placement: 'flight', projectile: true, shapes: Array(8).fill(shape) });
    const ap = appearance([b]);
    assertBodiesFit(ap);
    expect(layoutParts(b, layoutScene(ap).poses.get(b)!.s).parts).toHaveLength(8);
  });

  it.each(['touch', 'far', 'self'] as Placement[])('keeps a long projectile assembled and in frame when its placement is %s', placement => {
    const b = being({ placement, projectile: true, shapes: Array(8).fill('forma_paralelepipedo') });
    const ap = appearance([b]);
    assertBodiesFit(ap);
    const pose = layoutScene(ap).poses.get(b)!;
    const q = boundsOfBeing(b, pose);
    expect(q.r - q.l).toBeGreaterThan((q.b - q.t) * 6);
  });

  it.each(['touch', 'far'] as Placement[])('sets a single %s body on the visible surface instead of above its contact effect', placement => {
    for (const shape of shapes) {
      const b = being({ placement, shapes: [shape] }), result = layoutScene(appearance([b]));
      expect(boundsOfBeing(b, result.poses.get(b)!).b).toBeCloseTo(96);
    }
  });

  it.each(shapes)('places a returned %s on the torso while leaving the face visible', shape => {
    const b = being({ placement: 'self', shapes: [shape] }), result = layoutScene(appearance([b]));
    const p = result.poses.get(b)!, q = boundsOfBeing(b, p);
    expect(p.s).toBeLessThanOrEqual(7.5);
    expect(q.t).toBeGreaterThanOrEqual(77);
    expect(q.b).toBeLessThanOrEqual(99);
  });

  it.each([
    ['touch', 6], ['flight', 5], ['far', 6], ['front', 6], ['self', 3]
  ] as [Placement, number][])('fits the %s group of %i beings with distinct measured boxes', (placement, count) => {
    const ap = appearance(repeat(count, { placement, projectile: placement === 'flight' }));
    assertBodiesFit(ap);
    const result = layoutScene(ap), boxes = ap.beings.map(b => boundsOfBeing(b, result.poses.get(b)!));
    boxes.forEach((box, i) => boxes.slice(i + 1).forEach(other => {
      expect(box.r <= other.l || other.r <= box.l || box.b <= other.t || other.b <= box.t).toBe(true);
    }));
  });

  it.each(shapes)('fits eight %s orbitals at exactly equal angles without overlapping bodies', shape => {
    const ap = appearance(repeat(8, { orbit: true, shapes: [shape] }));
    assertBodiesFit(ap);
    const result = layoutScene(ap), r = result.rings[0];
    expect(result.casterX).toBe(55);
    expect(r.members).toHaveLength(8);
    const angles = r.members.map(b => {
      const p = result.poses.get(b)!;
      return Math.atan2((p.y - r.c[1]) / r.ry, (p.x - r.c[0]) / r.rx);
    }).sort((a, b) => a - b);
    angles.forEach((a, i) => expect(((angles[(i + 1) % angles.length] - a + Math.PI * 2) % (Math.PI * 2))).toBeCloseTo(Math.PI / 4));
    const boxes = r.members.map(b => boundsOfBeing(b, result.poses.get(b)!));
    boxes.forEach((q, i) => boxes.slice(i + 1).forEach(z => expect(q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t).toBe(true)));
  });

  it.each(['front', 'flight', 'touch', 'far', 'self'] as Placement[])('keeps eight orbitals visible around a %s anchor', placement => {
    for (const shape of shapes) {
      const anchor = being({ placement, shapes: [shape] });
      const ap = appearance([anchor, ...repeat(8, { orbit: true })]);
      assertBodiesFit(ap);
      const result = layoutScene(ap), q = boundsOfBeing(anchor, result.poses.get(anchor)!);
      result.rings[0].members.forEach(b => {
        const z = boundsOfBeing(b, result.poses.get(b)!);
        expect(q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t).toBe(true);
      });
      if (placement === 'self') expect(q.t).toBeGreaterThanOrEqual(77);
    }
  });

  it('places escorts around the entire assembled projectile with an accurate anchor width', () => {
    const flight = being({ placement: 'flight', projectile: true, shapes: [...shapes, ...shapes] });
    const ap = appearance([flight, ...repeat(8, { placement: 'escort', concepts: ['movimento'] })]);
    assertBodiesFit(ap);
    const result = layoutScene(ap), r = result.rings[0];
    expect(r.members).toHaveLength(8);
    expect(r.c).toEqual(result.flightPos);
    expect(result.flightHalf).toBeCloseTo(layoutParts(flight, result.poses.get(flight)!.s).width / 2);
  });

  it('fits a mixed scene and does not change any appearance semantics', () => {
    const ap = appearance([
      ...repeat(5, { placement: 'flight', projectile: true }), ...repeat(6, { placement: 'touch' }),
      ...repeat(6, { placement: 'far' }), ...repeat(8, { orbit: true })
    ]), before = structuredClone(ap);
    assertBodiesFit(ap);
    expect(ap).toEqual(before);
    const first = layoutScene(ap), second = layoutScene(ap);
    expect([...first.poses.values()]).toEqual([...second.poses.values()]);
    expect(first.rings.map(r => [r.c, r.rx, r.ry])).toEqual(second.rings.map(r => [r.c, r.rx, r.ry]));
  });
});

describe('intention silhouettes in scene layout', () => {
  it.each(intentionForms)('measures the full %s silhouette instead of its source formats', intentForm => {
    const source = being({ intentForm, shapes: [...shapes, ...shapes], linked: true, projectile: true });
    const before = structuredClone(source);
    for (const scale of [2.5, 7.5, 15]) {
      const sprite = spellSpriteOf(source);
      const q = sprite ? spellSpriteBounds(sprite, scale, source.placement === 'flight' && !source.orbit) : intentionBounds(intentForm, scale), parts = layoutParts(source, scale);
      expect(parts).toEqual({ parts: [], width: q.r - q.l, top: q.t, bottom: q.b });
      const p = { x: 92, y: 48, s: scale };
      expect(boundsOfBeing(source, p)).toEqual({ l: p.x + q.l, r: p.x + q.r, t: p.y + q.t, b: p.y + q.b });
    }
    expect(source).toEqual(before);
  });

  it.each(intentionForms)('fits %s at every destination without changing structural behaviour', intentForm => {
    for (const placement of ['front', 'flight', 'touch', 'far', 'self', 'escort'] as Placement[]) {
      for (const projectile of [false, true]) {
        const source = being({ intentForm, placement, projectile, shapes: ['forma_cubo'], direction: placement === 'self' ? 'back' : null });
        const before = structuredClone(source), ap = appearance([source]);
        assertBodiesFit(ap);
        const q = boundsOfBeing(source, layoutScene(ap).poses.get(source)!);
        if (placement === 'touch' || placement === 'far') expect(q.b).toBeCloseTo(96);
        if (placement === 'self') expect(q.t).toBeGreaterThanOrEqual(77);
        expect(source).toEqual(before);
      }
    }
  });

  it.each(intentionForms)('fits eight orbiting %s silhouettes with equal angles and every being preserved', intentForm => {
    const ap = appearance(repeat(8, { intentForm, orbit: true }));
    assertBodiesFit(ap);
    const result = layoutScene(ap), r = result.rings[0];
    expect(r.members).toHaveLength(8);
    const angles = r.members.map(b => {
      const p = result.poses.get(b)!;
      return Math.atan2((p.y - r.c[1]) / r.ry, (p.x - r.c[0]) / r.rx);
    }).sort((a, b) => a - b);
    angles.forEach((a, i) => expect((angles[(i + 1) % angles.length] - a + Math.PI * 2) % (Math.PI * 2)).toBeCloseTo(Math.PI / 4));
    const boxes = r.members.map(b => boundsOfBeing(b, result.poses.get(b)!));
    boxes.forEach((q, i) => boxes.slice(i + 1).forEach(z => expect(q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t).toBe(true)));
  });

  it.each(intentionForms)('keeps an intended %s anchor and eight orbitals visible at every main destination', intentForm => {
    for (const placement of ['front', 'flight', 'touch', 'far', 'self'] as Placement[]) {
      const anchor = being({ intentForm, placement });
      const ap = appearance([anchor, ...repeat(8, { orbit: true })]);
      assertBodiesFit(ap);
      const result = layoutScene(ap), q = boundsOfBeing(anchor, result.poses.get(anchor)!);
      result.rings[0].members.forEach(b => {
        const z = boundsOfBeing(b, result.poses.get(b)!);
        expect(q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t).toBe(true);
      });
    }
  });

  it('packs mixed intended bodies using their silhouettes and keeps the flight trail width accurate', () => {
    const ap = appearance([
      ...intentionForms.slice(0, 5).map(intentForm => being({ intentForm, placement: 'flight', projectile: true })),
      ...intentionForms.map(intentForm => being({ intentForm, placement: 'far' })),
      ...repeat(6, { placement: 'touch' }), ...repeat(8, { orbit: true })
    ]), before = structuredClone(ap);
    assertBodiesFit(ap);
    const result = layoutScene(ap), firstFlight = ap.beings[0];
    expect(result.flightHalf).toBeCloseTo(layoutParts(firstFlight, result.poses.get(firstFlight)!.s).width / 2);
    expect(ap).toEqual(before);
  });
});

describe('free intention glyphs in scene layout', () => {
  it.each(intentionGlyphs)('measures the complete raster for %s without discarding its original formats', intentGlyph => {
    const source = being({ intentGlyph, shapes: [...shapes, ...shapes], projectile: true, linked: true });
    const before = structuredClone(source);
    for (const scale of [2.5, 7.5, 15]) {
      const q = glyphBounds(intentGlyph, scale);
      expect(layoutParts(source, scale)).toEqual({ parts: [], width: q.r - q.l, top: q.t, bottom: q.b });
      expect(Number.isFinite(q.l + q.t + q.r + q.b)).toBe(true);
      expect(q.r).toBeGreaterThan(q.l);
      expect(q.b).toBeGreaterThan(q.t);
    }
    expect(source).toEqual(before);
  });

  it.each(intentionGlyphs)('keeps %s in frame at each destination while leaving placement and movement intact', intentGlyph => {
    for (const placement of ['front', 'flight', 'touch', 'far', 'self', 'escort'] as Placement[]) {
      const source = being({ intentGlyph, placement, projectile: placement === 'flight', shapes: ['forma_cubo'] });
      const ap = appearance([source]), before = structuredClone(ap);
      assertBodiesFit(ap);
      const q = boundsOfBeing(source, layoutScene(ap).poses.get(source)!);
      if (placement === 'touch' || placement === 'far') expect(q.b).toBeCloseTo(96);
      if (placement === 'self') expect(q.t).toBeGreaterThanOrEqual(77);
      expect(ap).toEqual(before);
    }
  });

  it.each(intentionGlyphs)('keeps all eight orbiting %s rasters visible with distinct bodies', intentGlyph => {
    const ap = appearance(repeat(8, { intentGlyph, orbit: true }));
    assertBodiesFit(ap);
    const result = layoutScene(ap), r = result.rings[0];
    expect(r.members).toHaveLength(8);
    const boxes = r.members.map(b => boundsOfBeing(b, result.poses.get(b)!));
    boxes.forEach((q, i) => boxes.slice(i + 1).forEach(z => expect(q.r <= z.l || z.r <= q.l || q.b <= z.t || z.b <= q.t).toBe(true)));
  });

  it('gives a recognized silhouette priority if both appearance hints are present', () => {
    const source = being({ intentForm: 'lanca', intentGlyph: '37' });
    expect(layoutParts(source, 15)).toEqual(layoutParts({ ...source, intentGlyph: undefined }, 15));
  });
});

describe('numeric intention as visual quantity', () => {
  it('retains the original appearance identity when no count needs illustration', () => {
    const ap = appearance([being({ intentForm: 'lanca' }), being({ intentGlyph: 'Kael7' })]);
    expect(appearanceForScene(ap)).toBe(ap);
  });

  it('creates three complete manifestations and three poses for the count3', () => {
    const source = being({ intentCount: '3', intentForm: 'lanca', shapes: [...shapes], bond: '3', projectile: true, placement: 'flight' });
    const ap = appearance([source]), before = structuredClone(ap), scene = appearanceForScene(ap);
    expect(scene).not.toBe(ap);
    expect(scene.beings).toHaveLength(3);
    expect(new Set(scene.beings).size).toBe(3);
    scene.beings.forEach((copy, i) => {
      expect(copy).not.toBe(source);
      expect(copy.shapes).toEqual(source.shapes);
      expect(copy.elements).toEqual(source.elements);
      expect(copy.intentForm).toBe('lanca');
      expect(copy.projectile).toBe(true);
      expect(copy.placement).toBe('flight');
      expect(copy.intentCount).toBeUndefined();
      expect(copy.bond).toBe(i === 0 ? '3' : null);
    });
    expect(layoutScene(scene).poses.size).toBe(3);
    assertBodiesFit(scene);
    expect(ap).toEqual(before);
    expect(source.intentCount).toBe('3');
  });

  it.each(['6', '7', '37', '1000000000000000000000000000000000000000'])('samples count%s with six bodies while preserving its exact source value', intentCount => {
    const ap = appearance([being({ intentCount })]), before = structuredClone(ap), scene = appearanceForScene(ap);
    expect(scene.beings).toHaveLength(6);
    expect(layoutScene(scene).poses.size).toBe(6);
    expect(ap.beings[0].intentCount).toBe(intentCount);
    expect(ap).toEqual(before);
  });

  it('updates the illustrated orbit count and keeps the original orbit rule untouched', () => {
    const ap = appearance([being(), being({ intentCount: '3', orbit: true, bond: '3' })]), before = structuredClone(ap);
    const scene = appearanceForScene(ap), result = layoutScene(scene);
    expect(scene.orbitCount).toBe(3);
    expect(result.rings[0].members).toHaveLength(3);
    expect(ap.orbitCount).toBe(1);
    expect(ap).toEqual(before);
  });

  it('does not expand a visual sample twice and keeps copied arrays separate from the source', () => {
    const source = being({ intentCount: '3' }), ap = appearance([source]), scene = appearanceForScene(ap);
    expect(appearanceForScene(scene)).toBe(scene);
    scene.beings[1].shapes.push('forma_piramide');
    expect(source.shapes).toEqual(['forma_esfera']);
    expect(scene.beings[0].shapes).toEqual(['forma_esfera']);
  });

  it('leaves invalid counts unexpanded, including zero, signs and decimal notation', () => {
    for (const intentCount of ['0', '-3', '3,14', '3.14', '01', '3e2', '<3>']) {
      const ap = appearance([being({ intentCount })]);
      expect(appearanceForScene(ap)).toBe(ap);
    }
  });
});
