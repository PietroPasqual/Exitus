import type { Being } from '../core/appearance';
import type { Pix, RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';
import { fireSphereBounds, paintCoherentFireSphere } from './pixel-fire-sphere';
import { fireLanceBounds, lightningRingBounds, paintCoherentFireLance, paintCoherentLightningRing } from './pixel-coherent-energy';
import { waterDragonBounds, paintCoherentWaterDragon } from './pixel-coherent-dragon';
import { elementalSphereBounds, paintElementalSphere } from './pixel-elemental-spheres';

/** Deliberately explicit coverage: other forms keep their own existing artwork. */
export type SpellSprite = 'fire-sphere' | 'water-sphere' | 'ice-sphere' | 'earth-sphere' | 'metal-sphere' |
  'fire-lance' | 'water-dragon' | 'lightning-ring';
const SPHERE_ELEMENT = { 'water-sphere': 'agua', 'ice-sphere': 'gelo', 'earth-sphere': 'terra', 'metal-sphere': 'metal' } as const;

export function spellSpriteOf(b: Being): SpellSprite | undefined {
  if (b.elements.length !== 1) return undefined;
  const element = b.elements[0];
  if (b.intentForm) {
    if (element === 'fogo' && b.intentForm === 'lanca') return 'fire-lance';
    if (element === 'agua' && b.intentForm === 'dragao') return 'water-dragon';
    if (element === 'raio' && b.intentForm === 'anel') return 'lightning-ring';
    return undefined;
  }
  if (b.intentGlyph || b.shapes.length !== 1 || b.shapes[0] !== 'forma_esfera') return undefined;
  return ({ fogo: 'fire-sphere', agua: 'water-sphere', gelo: 'ice-sphere', terra: 'earth-sphere', metal: 'metal-sphere' } as Record<string, SpellSprite>)[element];
}

/** The same loop envelope feeds packing, contact placement and raster copying. */
export function spellSpriteBounds(sprite: SpellSprite, s: number, launching = false): IntentionBox {
  if (sprite === 'fire-sphere') return fireSphereBounds(s);
  if (sprite === 'fire-lance') return fireLanceBounds(s, launching);
  if (sprite === 'water-dragon') return waterDragonBounds(s);
  if (sprite === 'lightning-ring') return lightningRingBounds(s);
  return elementalSphereBounds(s, SPHERE_ELEMENT[sprite]);
}

export function paintSpellSprite(sprite: SpellSprite, pix: Pix, x: number, y: number, s: number,
  ramp: RGB[], seed: number, frame: number, reverse = false, launching = false): IntentionBox {
  if (sprite === 'fire-sphere') return paintCoherentFireSphere(pix, x, y, s, ramp, frame);
  if (sprite === 'fire-lance') return paintCoherentFireLance(pix, x, y, s, ramp, frame, reverse, launching);
  if (sprite === 'water-dragon') return paintCoherentWaterDragon(pix, x, y, s, ramp, seed, frame, reverse);
  if (sprite === 'lightning-ring') return paintCoherentLightningRing(pix, x, y, s, ramp, frame);
  return paintElementalSphere(pix, x, y, s, ramp, SPHERE_ELEMENT[sprite], frame);
}
