import type { Being } from '../core/appearance';
import type { Pix, RGB } from './pixel';
import { fireMetalSphereBounds, paintFireMetalSphere } from './pixel-fire-metal-sphere';
import { waterIceSphereBounds, paintWaterIceSphere } from './pixel-water-ice-sphere';
import { shadowIceSphereBounds, paintShadowIceSphere } from './pixel-shadow-ice-sphere';
import { lightningMetalSphereBounds, paintLightningMetalSphere } from './pixel-lightning-metal-sphere';
import { waterMetalSphereBounds, paintWaterMetalSphere } from './pixel-water-metal-sphere';
import { fireEarthSphereBounds, paintFireEarthSphere } from './pixel-fire-earth-sphere';

export type PairSprite =
  { kind: 'fire-metal'; primary: 'fogo' | 'metal' } |
  { kind: 'water-ice'; primary: 'agua' | 'gelo' } |
  { kind: 'shadow-ice'; primary: 'sombra' | 'gelo' } |
  { kind: 'lightning-metal'; primary: 'raio' | 'metal' } |
  { kind: 'water-metal'; primary: 'agua' | 'metal' } |
  { kind: 'fire-earth'; primary: 'fogo' | 'terra' };
export interface PairSpriteBox { l: number; t: number; r: number; b: number }

/** A single sphere with exactly two constituents. Never collapses assemblies,
 * reorders dominance, consumes a third material or infers gameplay fusion. */
export function pairSpriteOf(b: Being): PairSprite | undefined {
  if (b.intentForm || b.intentGlyph || b.shapes.length !== 1 || b.shapes[0] !== 'forma_esfera' || b.elements.length !== 2) return undefined;
  const [a, z] = b.elements;
  if ((a === 'fogo' && z === 'metal') || (a === 'metal' && z === 'fogo')) return { kind: 'fire-metal', primary: a };
  if ((a === 'agua' && z === 'gelo') || (a === 'gelo' && z === 'agua')) return { kind: 'water-ice', primary: a };
  if ((a === 'sombra' && z === 'gelo') || (a === 'gelo' && z === 'sombra')) return { kind: 'shadow-ice', primary: a };
  if ((a === 'raio' && z === 'metal') || (a === 'metal' && z === 'raio')) return { kind: 'lightning-metal', primary: a };
  if ((a === 'agua' && z === 'metal') || (a === 'metal' && z === 'agua')) return { kind: 'water-metal', primary: a };
  if ((a === 'fogo' && z === 'terra') || (a === 'terra' && z === 'fogo')) return { kind: 'fire-earth', primary: a };
  return undefined;
}

/** The authored all-cycle envelope is shared by packing and raster copying. */
export function pairSpriteBounds(sprite: PairSprite, s: number): PairSpriteBox {
  const q = sprite.kind === 'fire-metal' ? fireMetalSphereBounds(s, sprite.primary)
    : sprite.kind === 'water-ice' ? waterIceSphereBounds(s)
      : sprite.kind === 'shadow-ice' ? shadowIceSphereBounds(s, sprite.primary)
        : sprite.kind === 'lightning-metal' ? lightningMetalSphereBounds(s, sprite.primary)
          : sprite.kind === 'water-metal' ? waterMetalSphereBounds(s, sprite.primary)
            : fireEarthSphereBounds(s, sprite.primary);
  // Reflection about a fractional origin rounds to the native grid. Reserve
  // the same half-pixel in either orientation, including two-pixel copies.
  return { ...q, l: q.l - .5, r: q.r + .5 };
}

export function paintPairSprite(sprite: PairSprite, pix: Pix, x: number, y: number, s: number,
  frame: number, reverse = false): PairSpriteBox {
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  // Mirror only the authored surface. This lightweight target keeps every
  // original forward pixel and avoids allocating another full scene layer.
  const target = { w: pix.w, h: pix.h, set(px: number, py: number, color: RGB): void {
    const xx = Math.round(reverse ? 2 * x - px : px), yy = Math.round(py);
    if (xx < 0 || yy < 0 || xx >= pix.w || yy >= pix.h) return;
    pix.set(xx, yy, color);
    bounds.l = Math.min(bounds.l, xx); bounds.r = Math.max(bounds.r, xx);
    bounds.t = Math.min(bounds.t, yy); bounds.b = Math.max(bounds.b, yy);
  } };
  if (sprite.kind === 'fire-metal') paintFireMetalSphere(target, x, y, s, frame, sprite.primary);
  else if (sprite.kind === 'water-ice') paintWaterIceSphere(target, x, y, s, frame, sprite.primary);
  else if (sprite.kind === 'shadow-ice') paintShadowIceSphere(target, x, y, s, frame, sprite.primary);
  else if (sprite.kind === 'lightning-metal') paintLightningMetalSphere(target, x, y, s, frame, sprite.primary);
  else if (sprite.kind === 'water-metal') paintWaterMetalSphere(target, x, y, s, frame, sprite.primary);
  else paintFireEarthSphere(target, x, y, s, frame, sprite.primary);
  return Number.isFinite(bounds.l) ? bounds : { l: x, t: y, r: x, b: y };
}
