import { describe, expect, it } from 'vitest';
import type { Being } from '../src/core/appearance';
import { Pix } from '../src/ui/pixel';
import { pairSpriteBounds, pairSpriteOf, paintPairSprite } from '../src/ui/pixel-pair-sprites';
import { appearanceForScene, boundsOfBeing, layoutParts, layoutScene } from '../src/ui/pixel-scene-layout';
import { renderPixelScene } from '../src/ui/pixel-scene';

const families = [
  { kind: 'water-lightning', elements: ['agua', 'raio'] },
  { kind: 'fire-wind', elements: ['fogo', 'vento'] },
  { kind: 'nature-water', elements: ['natureza', 'agua'] },
  { kind: 'light-shadow', elements: ['luz', 'sombra'] }
];
const orders = families.flatMap(family => [family.elements, [...family.elements].reverse()]
  .map(elements => ({ kind: family.kind, elements })));
const being = (elements: string[], extra: Partial<Being> = {}): Being => ({
  elements, shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false,
  bond: null, closed: false, ...extra
});
const identical = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);
const draw = (elements: string[], size: number, frame: number, reverse = false, offset = 0) => {
  const p = new Pix(64, 64), x = 32 + offset, y = 30 + offset;
  const sprite = pairSpriteOf(being(elements));
  if (!sprite) throw new Error(`Missing authored pair: ${elements.join('/')}`);
  return { p, x, y, sprite, painted: paintPairSprite(sprite, p, x, y, size, frame, reverse) };
};

describe('woven element pair production integration', () => {
  it('selects all eight dominances only for exactly two elements and one sphere', () => {
    for (const order of orders) {
      const b = being(order.elements), before = JSON.stringify(b), selected = pairSpriteOf(b);
      expect(selected).toEqual({ kind: order.kind, primary: order.elements[0] });
      // The illustration never supplies fusion, projectile or intention rules.
      expect(pairSpriteOf({ ...b, linked: true, merged: true, materialFusion: [] })).toEqual(selected);
      expect(pairSpriteOf({ ...b, intentCount: '6' })).toEqual(selected);
      for (const patch of [
        { shapes: [] }, { shapes: ['forma_cubo'] }, { shapes: ['forma_esfera', 'forma_cubo'] },
        { shapes: ['forma_esfera', 'forma_esfera'] }, { intentGlyph: 'CURA' },
        { intentForm: 'dragao' as const }, { elements: [order.elements[0]] },
        { elements: [order.elements[0], order.elements[0]] },
        { elements: [...order.elements, 'terra'] }
      ]) expect(pairSpriteOf({ ...b, ...patch })).toBeUndefined();
      expect(JSON.stringify(b)).toBe(before);
    }
    expect(pairSpriteOf(being(['fogo', 'raio']))).toBeUndefined();
    expect(pairSpriteOf(being(['agua', 'luz']))).toBeUndefined();
    for (const family of families) {
      const a = draw(family.elements, 20, 0).p;
      const b = draw([...family.elements].reverse(), 20, 0).p;
      expect(identical(a.data, b.data)).toBe(false);
    }
  });

  it('keeps tiny, fractional and mirrored poses connected inside the actual shared envelope', () => {
    const failures: unknown[] = [];
    for (const order of orders) for (const size of [1, 3, 7, 15, 20])
      for (const offset of [0, .5]) for (const reverse of [false, true]) for (let frame = 0; frame < 8; frame++) {
        const { p, x, y, sprite, painted } = draw(order.elements, size, frame, reverse, offset);
        const bounds = pairSpriteBounds(sprite, size), half = Math.max(-bounds.l, bounds.r);
        const occupied = new Uint8Array(p.w * p.h), queue = new Int32Array(p.w * p.h);
        let count = 0, first = -1, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        let outside = false;
        for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) {
          const at = yy * p.w + xx;
          if (!p.data[at * 4 + 3]) continue;
          occupied[at] = 1; first = first < 0 ? at : first; count++;
          l = Math.min(l, xx); t = Math.min(t, yy); r = Math.max(r, xx); b = Math.max(b, yy);
          if (xx < x - half || xx > x + half || yy < y + bounds.t || yy > y + bounds.b) outside = true;
        }
        const context = { elements: order.elements, size, offset, reverse, frame };
        if (!count || outside) failures.push({ ...context, count, outside, bounds });
        if (painted.l !== l || painted.t !== t || painted.r !== r || painted.b !== b)
          failures.push({ ...context, painted, occupied: { l, t, r, b } });
        let end = 0;
        if (first >= 0) { queue[end++] = first; occupied[first] = 2; }
        for (let cursor = 0; cursor < end; cursor++) {
          const at = queue[cursor], xx = at % p.w, yy = Math.floor(at / p.w);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = xx + dx, ny = yy + dy;
            if (nx < 0 || nx >= p.w || ny < 0 || ny >= p.h) continue;
            const next = ny * p.w + nx;
            if (occupied[next] !== 1) continue;
            occupied[next] = 2; queue[end++] = next;
          }
        }
        if (end !== count) failures.push({ ...context, disconnected: count - end });
      }
    expect(failures).toEqual([]);
  }, 15000);

  it('mirrors the complete native raster and normalizes the eight-frame clock', () => {
    const failures: unknown[] = [];
    for (const order of orders) {
      const poses = new Set(Array.from({ length: 8 }, (_, frame) => draw(order.elements, 20, frame).p.data.join(',')));
      if (poses.size < 4) failures.push({ elements: order.elements, distinctAnimationPoses: poses.size });
    }
    for (const order of orders) for (const offset of [0, .5]) for (let frame = 0; frame < 8; frame++) {
      const forward = draw(order.elements, 15, frame, false, offset);
      const reverse = draw(order.elements, 15, frame, true, offset);
      let mismatch = false;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const mx = Math.round(2 * forward.x - x);
        if (mx < 0 || mx >= 64) continue;
        for (let channel = 0; channel < 4; channel++)
          if (forward.p.data[(y * 64 + x) * 4 + channel] !== reverse.p.data[(y * 64 + mx) * 4 + channel]) mismatch = true;
      }
      if (mismatch) failures.push({ elements: order.elements, offset, frame, mirror: true });
      for (const normalized of [frame + 8, frame - 8, frame + .75])
        if (!identical(draw(order.elements, 15, normalized, false, offset).p.data, forward.p.data))
          failures.push({ elements: order.elements, offset, frame, normalized });
    }
    for (const order of orders)
      if (!identical(draw(order.elements, 15, NaN).p.data, draw(order.elements, 15, 0).p.data))
        failures.push({ elements: order.elements, nonFiniteFrame: true });
    expect(failures).toEqual([]);
  });

  it('clips at the canvas edge exactly as a crop of the complete authored body', () => {
    const failures: unknown[] = [];
    for (const order of orders) for (const reverse of [false, true]) for (const frame of [0, 3, 7])
      for (const cx of [3.5, 33.5]) for (const cy of [4.5, 28.5]) {
      const sprite = pairSpriteOf(being(order.elements))!, full = new Pix(96, 96), clipped = new Pix(37, 33);
      paintPairSprite(sprite, full, 48.5, 46.5, 15, frame, reverse);
      const bounds = paintPairSprite(sprite, clipped, cx, cy, 15, frame, reverse), dx = 48.5 - cx, dy = 46.5 - cy;
      let mismatch = false;
      for (let y = 0; y < clipped.h; y++) for (let x = 0; x < clipped.w; x++) for (let c = 0; c < 4; c++)
        if (clipped.data[(y * clipped.w + x) * 4 + c] !== full.data[((y + dy) * full.w + x + dx) * 4 + c]) mismatch = true;
      if (mismatch) failures.push({ elements: order.elements, reverse, frame, cx, cy, cropMismatch: true });
      if (bounds.l < 0 || bounds.t < 0 || bounds.r >= clipped.w || bounds.b >= clipped.h)
        failures.push({ elements: order.elements, reverse, frame, cx, cy, bounds });
    }
    expect(failures).toEqual([]);
  });

  it('copies the new authored artwork into the real day and night scene, without recoloring its body', () => {
    const failures: unknown[] = [];
    for (const order of orders) {
      const member = being(order.elements), input = { beings: [member], orbitCount: 0 };
      for (let frame = 0; frame < 8; frame++) {
        const pose = layoutScene(input, frame).poses.get(member)!, authored = new Pix(180, 105);
        paintPairSprite(pairSpriteOf(member)!, authored, pose.x, pose.y, pose.s, frame);
        for (const night of [false, true]) {
          const scene = renderPixelScene(input, night, frame).pix;
          let pixels = 0, mismatch = false;
          for (let at = 0; at < authored.data.length; at += 4) {
            if (!authored.data[at + 3]) continue;
            pixels++;
            for (let channel = 0; channel < 4; channel++)
              if (authored.data[at + channel] !== scene.data[at + channel]) mismatch = true;
          }
          if (pixels < 20 || mismatch) failures.push({ elements: order.elements, frame, night, pixels, bodyRecolored: mismatch });
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('uses the same envelopes in production copies, orbitals, flight and return without changing the input', () => {
    const contexts: Partial<Being>[] = [
      {}, { placement: 'flight', projectile: true, direction: 'forward' },
      { placement: 'self', direction: 'back', projectile: true },
      { intentCount: '6' }, { orbit: true, intentCount: '8' }
    ];
    const failures: unknown[] = [];
    for (const order of orders) for (const patch of contexts) {
      const input = { beings: [being(order.elements, patch)], orbitCount: patch.orbit ? 1 : 0 };
      const before = JSON.stringify(input), ap = appearanceForScene(input), sizes = new Map<Being, number>();
      expect(ap.beings).toHaveLength(patch.intentCount ? 6 : 1);
      for (let frame = 0; frame < 8; frame++) {
        const layout = layoutScene(ap, frame);
        for (const member of ap.beings) {
          const pose = layout.poses.get(member)!, sprite = pairSpriteOf(member)!;
          const local = pairSpriteBounds(sprite, pose.s), parts = layoutParts(member, pose.s), box = boundsOfBeing(member, pose);
          if (sizes.has(member) && sizes.get(member) !== pose.s)
            failures.push({ elements: order.elements, patch, frame, unstableScale: pose.s });
          sizes.set(member, pose.s);
          if (parts.top !== local.t || parts.bottom !== local.b || parts.width < local.r - local.l)
            failures.push({ elements: order.elements, patch, frame, local, parts });
          if (![box.l, box.t, box.r, box.b].every(Number.isFinite) || box.l < 0 || box.t < 0 || box.r >= 180 || box.b >= 105)
            failures.push({ elements: order.elements, patch, frame, box });
          const p = new Pix(180, 105);
          paintPairSprite(sprite, p, pose.x, pose.y, pose.s, frame, patch.direction === 'back');
          for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
            if (p.data[(y * p.w + x) * 4 + 3] && (x < box.l || x > box.r || y < box.t || y > box.b))
              failures.push({ elements: order.elements, patch, frame, pose, pixel: [x, y], box });
        }
        const scene = renderPixelScene(input, frame % 2 === 0, frame);
        if (scene.pix.w !== 180 || scene.pix.h !== 105 || JSON.stringify(input) !== before)
          failures.push({ elements: order.elements, patch, frame, inputChanged: JSON.stringify(input) !== before });
      }
    }
    expect(failures).toEqual([]);
  }, 15000);
});
