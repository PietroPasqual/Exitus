import { describe, expect, it } from 'vitest';
import type { Appearance, Being, Placement } from '../src/core/appearance';
import { INTENTION_CATALOG, type IntentionForm } from '../src/core/intention';
import { inPoly } from '../src/ui/pixel';
import { intentionBounds } from '../src/ui/pixel-intention';
import { OBJECT_FORMS } from '../src/ui/pixel-intention-objects';
import { appearanceForScene, boundsOfBeing, INTENTION_SCENE_LIMIT, layoutScene } from '../src/ui/pixel-scene-layout';

const being = (intentForm: IntentionForm, patch: Partial<Being> = {}): Being => ({
  elements: ['fogo'], shapes: ['forma_esfera', 'forma_cubo'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false,
  bond: null, closed: false, intentForm, ...patch
});
const appearance = (beings: Being[]): Appearance => ({ beings, orbitCount: beings.filter(b => b.orbit).length });

/** Crowded catalog scenes can scale down; no body may leave the illustration. */
function assertFits(ap: Appearance): ReturnType<typeof layoutScene> {
  const before = structuredClone(ap), result = layoutScene(ap);
  expect(result.poses.size).toBe(ap.beings.length);
  ap.beings.forEach(b => {
    const p = result.poses.get(b)!;
    expect(Number.isFinite(p.x + p.y + p.s)).toBe(true);
    expect(p.s).toBeGreaterThan(0);
    const q = boundsOfBeing(b, p);
    expect(q.l).toBeGreaterThanOrEqual(3);
    expect(q.r).toBeLessThanOrEqual(177);
    expect(q.t).toBeGreaterThanOrEqual(3);
    expect(q.b).toBeLessThanOrEqual(97.001);
  });
  expect(ap).toEqual(before);
  return result;
}

describe('complete intention catalog scene bounds', () => {
  it('covers all 200 distinct catalog entries', () => {
    expect(INTENTION_CATALOG).toHaveLength(200);
    expect(new Set(INTENTION_CATALOG.map(entry => entry.id)).size).toBe(200);
  });

  it.each(INTENTION_CATALOG)('$id fits every destination and keeps structural flags intact', entry => {
    for (const placement of ['front', 'flight', 'touch', 'far', 'self', 'escort'] as Placement[]) {
      for (const projectile of [false, true]) {
        const b = being(entry.id, { placement, projectile, direction: placement === 'self' ? 'back' : null });
        const ap = appearance([b]), result = assertFits(ap), p = result.poses.get(b)!;
        const q = intentionBounds(entry.id, p.s), body = boundsOfBeing(b, p);
        expect(body.r - body.l).toBeCloseTo(q.r - q.l);
        expect(body.b - body.t).toBeCloseTo(q.b - q.t);
        if (placement === 'touch' || placement === 'far') expect(body.b).toBeCloseTo(96);
        if (placement === 'self') expect(body.t).toBeGreaterThanOrEqual(77);
      }
    }
  });

  it.each(INTENTION_CATALOG)('$id keeps counted manifestations complete and the original quantity exact', entry => {
    for (const [intentCount, expected] of [['3', 3], ['1000000000000000000000000000000000000000', INTENTION_SCENE_LIMIT]] as const) {
      const source = appearance([being(entry.id, { intentCount, projectile: true, placement: 'flight', bond: intentCount })]);
      const before = structuredClone(source), scene = appearanceForScene(source);
      expect(scene.beings).toHaveLength(expected);
      expect(new Set(scene.beings).size).toBe(expected);
      scene.beings.forEach(copy => {
        expect(copy.intentForm).toBe(entry.id);
        expect(copy.elements).toEqual(['fogo']);
        expect(copy.shapes).toEqual(['forma_esfera', 'forma_cubo']);
      });
      expect(assertFits(scene).poses.size).toBe(expected);
      expect(source).toEqual(before);
      expect(source.beings[0].intentCount).toBe(intentCount);
    }
  });

  it.each(INTENTION_CATALOG)('$id preserves eight equally spaced orbitals without clipping or overlapping bodies', entry => {
    const ap = appearance(Array.from({ length: 8 }, () => being(entry.id, { orbit: true })));
    const result = assertFits(ap), r = result.rings[0];
    expect(r.members).toHaveLength(8);
    const angles = r.members.map(b => {
      const p = result.poses.get(b)!;
      return Math.atan2((p.y - r.c[1]) / r.ry, (p.x - r.c[0]) / r.rx);
    }).sort((a, b) => a - b);
    angles.forEach((a, i) => expect((angles[(i + 1) % angles.length] - a + Math.PI * 2) % (Math.PI * 2)).toBeCloseTo(Math.PI / 4));
    const boxes = r.members.map(b => boundsOfBeing(b, result.poses.get(b)!));
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t).toBe(true)));
  });

  it.each(INTENTION_CATALOG)('$id counts the illustrated orbital copies without changing game appearance data', entry => {
    const source = appearance([being(entry.id, { intentCount: '3', orbit: true })]), before = structuredClone(source);
    const scene = appearanceForScene(source), result = assertFits(scene);
    expect(scene.orbitCount).toBe(3);
    expect(result.rings[0].members).toHaveLength(3);
    expect(source.orbitCount).toBe(1);
    expect(source).toEqual(before);
  });
});

describe('object silhouettes and real negative space', () => {
  it('defines exactly the 15 requested object and geometric silhouettes', () => {
    expect(Object.keys(OBJECT_FORMS).sort()).toEqual([
      'bomba', 'esfera', 'cubo', 'piramide', 'cone', 'anel', 'estrela', 'espiral',
      'cruz', 'coracao', 'coroa', 'chave', 'cristal', 'mao', 'explosao'
    ].sort());
    Object.values(OBJECT_FORMS).forEach(parts => parts.forEach(p => {
      expect(p.points.length).toBeGreaterThanOrEqual(3);
      expect(p.points.every(([x, y]) => Number.isFinite(x + y))).toBe(true);
      expect(p.light).toBeGreaterThanOrEqual(0);
      expect(p.light).toBeLessThanOrEqual(1);
    }));
  });

  it('leaves the openings of the ring, spiral and key unpainted', () => {
    for (const [parts, x, y] of [[OBJECT_FORMS.anel, 0, 0], [OBJECT_FORMS.espiral, 0, 0], [OBJECT_FORMS.chave, -11, -1]] as const) {
      expect(parts.some(p => inPoly(p.points, x, y))).toBe(false);
    }
  });

  it('gives the star five outer points and a bomb a substantial round body below its wick', () => {
    const starPoints = OBJECT_FORMS.estrela[0].points;
    expect(starPoints.filter(([x, y]) => Math.hypot(x, y) > 18)).toHaveLength(5);
    const bomb = OBJECT_FORMS.bomba;
    for (const [x, y] of [[0, 3], [-9, 3], [9, 3], [0, 12]]) expect(bomb.some(p => inPoly(p.points, x, y))).toBe(true);
    expect(Math.min(...bomb.flatMap(p => p.points.map(([, y]) => y)))).toBeLessThan(-18);
    expect(Math.max(...bomb.flatMap(p => p.points.map(([, y]) => y)))).toBeGreaterThan(15);
  });
});
