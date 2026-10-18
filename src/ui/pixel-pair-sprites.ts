import type { Being } from '../core/appearance';
import type { Pix, RGB } from './pixel';
import { fireMetalSphereBounds, paintFireMetalSphere } from './pixel-fire-metal-sphere';
import { waterIceSphereBounds, paintWaterIceSphere } from './pixel-water-ice-sphere';
import { shadowIceSphereBounds, paintShadowIceSphere } from './pixel-shadow-ice-sphere';
import { lightningMetalSphereBounds, paintLightningMetalSphere } from './pixel-lightning-metal-sphere';
import { waterMetalSphereBounds, paintWaterMetalSphere } from './pixel-water-metal-sphere';
import { fireEarthSphereBounds, paintFireEarthSphere } from './pixel-fire-earth-sphere';
import { waterLightningSphereBounds, paintWaterLightningSphere } from './pixel-water-lightning-sphere';
import { fireWindSphereBounds, paintFireWindSphere } from './pixel-fire-wind-sphere';
import { natureWaterSphereBounds, paintNatureWaterSphere } from './pixel-nature-water-sphere';
import { lightShadowSphereBounds, paintLightShadowSphere } from './pixel-light-shadow-sphere';

export type PairSprite =
  { kind: 'fire-metal'; primary: 'fogo' | 'metal' } |
  { kind: 'water-ice'; primary: 'agua' | 'gelo' } |
  { kind: 'shadow-ice'; primary: 'sombra' | 'gelo' } |
  { kind: 'lightning-metal'; primary: 'raio' | 'metal' } |
  { kind: 'water-metal'; primary: 'agua' | 'metal' } |
  { kind: 'fire-earth'; primary: 'fogo' | 'terra' } |
  { kind: 'water-lightning'; primary: 'agua' | 'raio' } |
  { kind: 'fire-wind'; primary: 'fogo' | 'vento' } |
  { kind: 'nature-water'; primary: 'natureza' | 'agua' } |
  { kind: 'light-shadow'; primary: 'luz' | 'sombra' };
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
  if ((a === 'agua' && z === 'raio') || (a === 'raio' && z === 'agua')) return { kind: 'water-lightning', primary: a };
  if ((a === 'fogo' && z === 'vento') || (a === 'vento' && z === 'fogo')) return { kind: 'fire-wind', primary: a };
  if ((a === 'natureza' && z === 'agua') || (a === 'agua' && z === 'natureza')) return { kind: 'nature-water', primary: a };
  if ((a === 'luz' && z === 'sombra') || (a === 'sombra' && z === 'luz')) return { kind: 'light-shadow', primary: a };
  return undefined;
}

function localPairBounds(sprite: PairSprite, s: number): PairSpriteBox {
  switch (sprite.kind) {
    case 'fire-metal': return fireMetalSphereBounds(s, sprite.primary);
    case 'water-ice': return waterIceSphereBounds(s);
    case 'shadow-ice': return shadowIceSphereBounds(s, sprite.primary);
    case 'lightning-metal': return lightningMetalSphereBounds(s, sprite.primary);
    case 'water-metal': return waterMetalSphereBounds(s, sprite.primary);
    case 'fire-earth': return fireEarthSphereBounds(s, sprite.primary);
    case 'water-lightning': return waterLightningSphereBounds(s, sprite.primary);
    case 'fire-wind': return fireWindSphereBounds(s, sprite.primary);
    case 'nature-water': return natureWaterSphereBounds(s, sprite.primary);
    case 'light-shadow': return lightShadowSphereBounds(s, sprite.primary);
  }
}

/** The authored all-cycle envelope is shared by packing and raster copying. */
export function pairSpriteBounds(sprite: PairSprite, s: number): PairSpriteBox {
  const q = localPairBounds(sprite, s);
  // Reflection about a fractional origin rounds to the native grid. Reserve
  // the same half-pixel in either orientation, including two-pixel copies.
  return { ...q, l: q.l - .5, r: q.r + .5 };
}

export function paintPairSprite(sprite: PairSprite, pix: Pix, x: number, y: number, s: number,
  frame: number, reverse = false): PairSpriteBox {
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  const local = localPairBounds(sprite, s);
  // Painters may clip before calling set(). On an edge-crossing return the
  // source side can be outside the canvas while its reflection is inside.
  // An integer translation gives that source a virtual canvas; clip only after
  // undoing the translation and reflecting into the actual destination.
  const shift = reverse && x + local.l < 0 ? Math.ceil(-x - local.l) + 1 : 0;
  const sourceX = x + shift;
  const sourceWidth = reverse ? Math.max(pix.w + shift, Math.ceil(sourceX + local.r) + 1) : pix.w;
  // Mirror only the authored surface. This lightweight target keeps every
  // original forward pixel and avoids allocating another full scene layer.
  const target = { w: sourceWidth, h: pix.h, set(px: number, py: number, color: RGB): void {
    const originalX = px - shift;
    const xx = Math.round(reverse ? 2 * x - originalX : originalX), yy = Math.round(py);
    if (xx < 0 || yy < 0 || xx >= pix.w || yy >= pix.h) return;
    pix.set(xx, yy, color);
    bounds.l = Math.min(bounds.l, xx); bounds.r = Math.max(bounds.r, xx);
    bounds.t = Math.min(bounds.t, yy); bounds.b = Math.max(bounds.b, yy);
  } };
  if (sprite.kind === 'fire-metal') paintFireMetalSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'water-ice') paintWaterIceSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'shadow-ice') paintShadowIceSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'lightning-metal') paintLightningMetalSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'water-metal') paintWaterMetalSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'fire-earth') paintFireEarthSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'water-lightning') paintWaterLightningSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'fire-wind') paintFireWindSphere(target, sourceX, y, s, frame, sprite.primary);
  else if (sprite.kind === 'nature-water') paintNatureWaterSphere(target, sourceX, y, s, frame, sprite.primary);
  else paintLightShadowSphere(target, sourceX, y, s, frame, sprite.primary);
  return Number.isFinite(bounds.l) ? bounds : { l: x, t: y, r: x, b: y };
}
