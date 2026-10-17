import { clamp01, type RGB } from './pixel';
import { materialPixel, type SpellMaterial } from './pixel-materials';

/**
 * Intention sprites have authored faces, eyes and carved marks. Their local
 * illumination takes priority over the large material's reflection/current, so
 * a metal ribbon or a fire core cannot paint across a dark facial detail.
 * Material texture is retained as a smaller change of palette index; no new
 * colours, alternating pixels or smoothing are introduced.
 */
export function intentionMaterialPixel(
  ramp: RGB[], mat: SpellMaterial, x: number, y: number,
  u: number, v: number, light: number, seed: number, element?: string
): RGB {
  const sampled = materialPixel(ramp, mat, x, y, u, v, light, seed, element);
  if (ramp.length < 2) return sampled;
  const face = clamp01(light);
  const texture = ramp.indexOf(sampled) / (ramp.length - 1);

  // Eyes, mouths, keyholes and incisions always belong to the dark palette end.
  // The tiny modulation keeps the supplied material without washing marks out.
  if (face <= .24) {
    const tone = .015 + face * .25 + texture * .035;
    return ramp[Math.round(tone * (ramp.length - 1))];
  }

  // A shadow body keeps depth in its dark tones rather than gaining silver skin.
  const shadow = mat === 'energy' && (element === 'sombra' || element === 'morte' || element === 'vazio');
  if (shadow) {
    const ceiling = element === 'vazio' ? .36 : element === 'morte' ? .48 : .44;
    const tone = .025 + face * ceiling + (texture - .2) * .13;
    return ramp[Math.round(Math.min(ceiling, clamp01(tone)) * (ramp.length - 1))];
  }

  // Broad authored planes carry the volume. Currents/reflections still form
  // connected clusters, increasingly restrained on the unlit side of a sprite.
  const textureWeight = .6 * clamp01((face - .24) / .26);
  const tone = -.035 + face * .94 + (texture - .5) * textureWeight;
  // Reserve the brightest entry for a small specular intersection. Broad lit
  // faces keep a saturated colour, so creatures do not become white cut-outs.
  const litTone = face > .88 && texture < .85 ? Math.min(.86, tone) : tone;
  return ramp[Math.round(clamp01(litTone) * (ramp.length - 1))];
}
