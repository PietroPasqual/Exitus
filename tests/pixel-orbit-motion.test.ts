import { describe, expect, it, vi } from 'vitest';
import type { Appearance, Being, Placement } from '../src/core/appearance';
import { appearanceForScene, boundsOfBeing, layoutScene, type SceneBox } from '../src/ui/pixel-scene-layout';
import { renderPixelScene } from '../src/ui/pixel-scene';
import * as spriteRenderer from '../src/ui/pixel-spell-sprites';

const being = (patch: Partial<Being> = {}): Being => ({
  elements: ['fogo'], shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false,
  bond: null, closed: false, ...patch
});
const appearance = (beings: Being[]): Appearance => ({ beings, orbitCount: beings.filter(b => b.orbit).length });
const cohort = (count: number, patch: Partial<Being> = {}): Being[] => Array.from({ length: count }, () => being({ orbit: true, ...structuredClone(patch) }));
const separate = (a: SceneBox, b: SceneBox): boolean => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;
const TAU = Math.PI * 2;
const angleDelta = (a: number, b: number): number => (b - a + TAU) % TAU;
const positionSet = (ap: Appearance, frame: number): string => {
  const scene = layoutScene(ap, frame);
  return ap.beings.filter(b => b.orbit).map(b => {
    const p = scene.poses.get(b)!;
    return `${Math.round(p.x)},${Math.round(p.y)}`;
  }).sort().join(';');
};

function assertCycleFits(ap: Appearance): void {
  const still = layoutScene(ap);
  for (let frame = 0; frame < 8; frame++) {
    const scene = layoutScene(ap, frame);
    expect(scene.rings.map(r => [r.c, r.rx, r.ry])).toEqual(still.rings.map(r => [r.c, r.rx, r.ry]));
    for (const b of ap.beings) {
      const p = scene.poses.get(b)!, q = boundsOfBeing(b, p);
      expect(p.s).toBe(still.poses.get(b)!.s);
      expect(q.l).toBeGreaterThanOrEqual(3);
      expect(q.r).toBeLessThanOrEqual(177);
      expect(q.t).toBeGreaterThanOrEqual(3);
      expect(q.b).toBeLessThanOrEqual(97.001);
    }
    for (const ring of scene.rings) {
      const boxes = ring.members.map(b => boundsOfBeing(b, scene.poses.get(b)!));
      boxes.forEach((box, i) => boxes.slice(i + 1).forEach(other => expect(separate(box, other)).toBe(true)));
      const anchor = ap.beings.find(b => !b.orbit && b.placement !== 'escort');
      if (anchor) {
        const q = boundsOfBeing(anchor, scene.poses.get(anchor)!);
        boxes.forEach(box => expect(separate(q, box)).toBe(true));
      }
    }
  }
}

describe('Real orbital travel in the eight-frame scene', () => {
  it.each([1, 2, 3, 4, 6, 8])('%i identical members visibly change their native position set every frame', count => {
    const members = cohort(count), ap = appearance([being({ elements: ['espaco'] }), ...members]);
    const sets = Array.from({ length: 8 }, (_, frame) => positionSet(ap, frame));
    expect(new Set(sets).size).toBe(8);
    const step = TAU / count / 8;
    for (let frame = 0; frame < 8; frame++) {
      const now = layoutScene(ap, frame), next = layoutScene(ap, (frame + 1) % 8), ring = now.rings[0];
      expect(ring.angularStep).toBeCloseTo(step);
      members.forEach((b, i) => {
        const pose = now.poses.get(b)!, orbit = pose.orbit!;
        const nextMember = frame === 7 ? members[(i + 1) % count] : b;
        expect(angleDelta(orbit.angle, next.poses.get(nextMember)!.orbit!.angle)).toBeCloseTo(step);
        expect(((pose.x - ring.c[0]) / ring.rx) ** 2 + ((pose.y - ring.c[1]) / ring.ry) ** 2).toBeCloseTo(1);
        expect(Math.hypot(...orbit.tangent)).toBeCloseTo(1);
        expect(orbit.renderIndex).toBe(1);
      });
    }
    assertCycleFits(ap);
  });

  it('moves each mixed identity through the complete ellipse and switches its depth without reseeding', () => {
    const members = ['fogo', 'metal', 'sombra', 'luz'].map(element => being({ orbit: true, elements: [element] }));
    const ap = appearance([being({ elements: ['espaco'] }), ...members]);
    const before = structuredClone(ap);
    for (const [i, b] of members.entries()) {
      const poses = Array.from({ length: 8 }, (_, frame) => layoutScene(ap, frame).poses.get(b)!);
      expect(new Set(poses.map(p => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(8);
      expect(new Set(poses.map(p => p.orbit!.behind))).toEqual(new Set([false, true]));
      for (let frame = 0; frame < 8; frame++) {
        const p = poses[frame], next = poses[(frame + 1) % 8];
        expect(angleDelta(p.orbit!.angle, next.orbit!.angle)).toBeCloseTo(TAU / 8);
        expect(p.orbit!.renderIndex).toBe(i + 1);
        expect(p.orbit!.behind).toBe(Math.sin(p.orbit!.angle) < -1e-9);
      }
    }
    assertCycleFits(ap);
    expect(ap).toEqual(before);
  });

  it('passes moving positions and stable original material seeds to the actual sprite renderer', () => {
    const anchor = being({ elements: ['espaco'] });
    const members = [being({ orbit: true }), being({ orbit: true, elements: ['agua'] })];
    const ap = appearance([anchor, ...members]);
    const paint = vi.spyOn(spriteRenderer, 'paintSpellSprite');
    try {
      for (let frame = 0; frame < 8; frame++) {
        paint.mockClear();
        const scene = layoutScene(ap, frame);
        renderPixelScene(ap, true, frame);
        for (const [i, b] of members.entries()) {
          const pose = scene.poses.get(b)!;
          const call = paint.mock.calls.find(args => args[0] === (i ? 'water-sphere' : 'fire-sphere'));
          expect(call).toBeDefined();
          expect(call![2]).toBe(pose.x);
          expect(call![3]).toBe(pose.y);
          expect(call![6]).toBe((i + 1) * 17 + 3);
          expect(call![7]).toBe((frame + (i + 1) * 3) % 8);
        }
      }
    } finally { paint.mockRestore(); }
  });

  it.each([1, 2, 3, 4, 6, 8])('renders eight different native body masks for %i identical fire satellites', count => {
    const ap = appearance([being({ elements: ['espaco'] }), ...cohort(count)]);
    const masks = new Set<string>();
    for (let frame = 0; frame < 8; frame++) {
      const pix = renderPixelScene(ap, true, frame).pix, occupied: number[] = [];
      // Warm body pixels exclude the purple anchor and cool fixed scenery. This
      // is a rendered silhouette-set assertion, not just a moving centroid.
      for (let y = 15; y < 87; y++) for (let x = 40; x < 150; x++) {
        const i = (y * pix.w + x) * 4, [r, g, b] = pix.data.slice(i, i + 3);
        if (r > 160 && g > 65 && b < 170 && r > g * 1.06) occupied.push(y * pix.w + x);
      }
      expect(occupied.length).toBeGreaterThan(count * 2);
      masks.add(occupied.join(','));
      expect(renderPixelScene(ap, true, frame + 8).pix.data).toEqual(pix.data);
    }
    expect(masks.size).toBe(8);
  });

  it.each(['front', 'flight', 'touch', 'far', 'self'] as Placement[])('fits every phase around the actual %s anchor', placement => {
    const anchor = being({ placement, direction: placement === 'self' ? 'back' : null });
    const ap = appearance([anchor, ...cohort(8)]);
    assertCycleFits(ap);
    for (let frame = 0; frame < 8; frame++) {
      const scene = layoutScene(ap, frame), p = scene.poses.get(anchor)!;
      expect(scene.rings[0].c).toEqual([p.x, p.y]);
      if (placement === 'self') {
        expect(p.x).toBe(scene.casterX);
        expect(boundsOfBeing(anchor, p).t).toBeGreaterThanOrEqual(77);
      }
    }
  });

  it.each([
    { shapes: ['forma_paralelepipedo'] }, { intentForm: 'escudo' }, { intentForm: 'parede' },
    { intentForm: 'lanca' }, { intentForm: 'dragao', elements: ['agua'] }, { intentGlyph: 'a'.repeat(40) }
  ] as Partial<Being>[])('uses the complete all-phase envelope for $intentForm $intentGlyph $shapes', patch => {
    for (const withAnchor of [false, true]) {
      const ap = appearance([...(withAnchor ? [being({ elements: ['espaco'] })] : []), ...cohort(8, patch)]);
      assertCycleFits(ap);
    }
  });

  it('keeps a returned anchor on the caster even when another non-orbit spell is present', () => {
    const anchor = being({ placement: 'self', direction: 'back' });
    const ap = appearance([anchor, being({ placement: 'far', elements: ['metal'] }), ...cohort(4)]);
    for (let frame = 0; frame < 8; frame++) {
      const scene = layoutScene(ap, frame), p = scene.poses.get(anchor)!;
      expect(p.x).toBe(scene.casterX);
      expect(scene.rings[0].c).toEqual([p.x, p.y]);
    }
  });

  it('preserves numeric-copy semantics and does not expand or mutate the input again', () => {
    const source = appearance([being({ elements: ['espaco'] }), being({ orbit: true, intentCount: '6', intentForm: 'espada', bond: '6' })]);
    const before = structuredClone(source), ap = appearanceForScene(source);
    expect(ap.beings).toHaveLength(7);
    expect(ap.beings.filter(b => b.bond)).toHaveLength(1);
    for (let frame = 0; frame < 8; frame++) {
      const layout = layoutScene(ap, frame);
      expect(layout.poses.size).toBe(7);
      expect(layout.rings[0].members).toHaveLength(6);
      expect(renderPixelScene(source, true, frame).labels).toHaveLength(1);
    }
    expect(appearanceForScene(ap)).toBe(ap);
    expect(source).toEqual(before);
  });

  it('normalizes frame arguments and keeps every pause/reduced-motion still complete', () => {
    const ap = appearance([being({ elements: ['espaco'] }), ...cohort(4)]), still = layoutScene(ap);
    for (const invalid of [NaN, Infinity, -Infinity, 8, 16]) expect(layoutScene(ap, invalid)).toEqual(still);
    expect(layoutScene(ap, -1)).toEqual(layoutScene(ap, 7));
    expect(layoutScene(ap, 2.9)).toEqual(layoutScene(ap, 2));
    for (let frame = 0; frame < 8; frame++) {
      expect(layoutScene(ap, frame).poses.size).toBe(ap.beings.length);
      const pix = renderPixelScene(ap, true, frame).pix, initial = renderPixelScene(ap, true).pix;
      for (let x = 0; x < pix.w; x++) for (const y of [0, pix.h - 1]) {
        const i = (y * pix.w + x) * 4;
        expect(pix.data.slice(i, i + 4)).toEqual(initial.data.slice(i, i + 4));
      }
    }
  });

  it.each([
    { shapes: ['forma_paralelepipedo'] }, { intentForm: 'parede' }, { intentForm: 'escudo' },
    { elements: ['agua'], intentForm: 'dragao' }, { intentGlyph: 'a'.repeat(40) }
  ] as Partial<Being>[])('reserves the caster face throughout tall unanchored $intentForm $intentGlyph $shapes travel', patch => {
    for (const count of [1, 2, 3, 4, 6, 8]) for (let frame = 0; frame < 8; frame++) {
      const ap = appearance(cohort(count, patch)), scene = layoutScene(ap, frame);
      const face = { l: scene.casterX - 6, r: scene.casterX + 8, t: 65, b: 78 };
      for (const b of ap.beings) {
        const p = scene.poses.get(b)!;
        if (!p.orbit!.behind) expect(separate(boundsOfBeing(b, p), face)).toBe(true);
      }
    }
  });

  it('preserves the caster face across the unanchored orbit cycle', () => {
    const ap = appearance(cohort(8)), cx = layoutScene(ap).casterX, still = renderPixelScene(ap, true).pix;
    for (let frame = 1; frame < 8; frame++) {
      const pix = renderPixelScene(ap, true, frame).pix;
      for (let y = 71; y <= 76; y++) for (let x = cx + 1; x <= cx + 6; x++) {
        const i = (y * pix.w + x) * 4;
        expect(pix.data.slice(i, i + 4)).toEqual(still.data.slice(i, i + 4));
      }
    }
  });
});
