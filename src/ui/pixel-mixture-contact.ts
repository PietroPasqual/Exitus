import { clamp01 } from './pixel';
import { isBodyMaterial, MATERIAL_SIGNATURES, type BodyMaterial, type MaterialVisualClass } from './pixel-mixture-signatures';
import type { MixtureInterfacePattern } from './pixel-mixture-domains';

const ANCHORS: Readonly<Record<string, readonly [number, number]>> = {
  fogo: [.68, .18], raio: [.8, .4], luz: [.32, .18],
  terra: [.25, .72], metal: [.78, .48], gelo: [.24, .31], materia: [.2, .55],
  agua: [.63, .8], acido: [.3, .75], vento: [.82, .58], som: [.56, .82],
  natureza: [.28, .73], ilusao: [.74, .28], sombra: [.74, .72],
  gravidade: [.2, .4], espaco: [.8, .33]
};

/** One shared, static growth metric keeps the materials interlocked. The
 * dominant motifs choose its gesture; this is never a gameplay fusion. */
export function materialInterfacePattern(elements: readonly string[]): MixtureInterfacePattern {
  const kinds = elements.filter(isBodyMaterial).map(element => MATERIAL_SIGNATURES[element].visualClass);
  if (kinds.includes('organic')) return 'root';
  if (kinds.includes('field')) return 'fold';
  if (kinds.includes('liquid') || kinds.includes('flow')) return 'flow';
  if (kinds.includes('solid')) return 'facet';
  return 'pulse';
}

/** Stable material-owned origins: liquids pool along lower curves, hard faces
 * enter from the sides, radiance follows a crest, and fields fold at a flank.
 * These are compositional choices only. They never change the Being's motion,
 * direction or any interpreted effect. Real occupied pixels determine the
 * final connected region, including holes, long blades and glyph strokes.
 */
export function materialInterfaceAnchors(elements: readonly string[], bounds: { l: number; t: number; r: number; b: number }, reverse = false): (undefined | { x: number; y: number })[] {
  return elements.map((element, index) => {
    const point = ANCHORS[element];
    if (!index || !point) return undefined;
    return { x: bounds.l + (reverse ? 1 - point[0] : point[0]) * (bounds.r - bounds.l),
      y: bounds.t + point[1] * (bounds.b - bounds.t) };
  });
}

/**
 * A material grows from its real shared edge instead of filling every remote
 * corner of a Voronoi cell. These bounded, static interface silhouettes leave
 * the original body's volume visible around them. Motion belongs to the
 * material shader, not to changing ownership or teleporting a colour patch.
 */
export function insideMaterialInterface(
  kind: MaterialVisualClass, distance: number, along: number,
  width: number, length: number, pixels: number
): boolean {
  // Small LODs and disconnected authored pieces cannot afford another erosion.
  if (pixels < 36 || !Number.isFinite(distance)) return true;
  const span = Math.max(2, Math.min(width, length) * .62);
  const arch = Math.sin(Math.PI * Math.max(0, Math.min(1, along)));
  let profile: number;
  if (kind === 'solid') profile = along < .32 ? .42 + along * 1.6 : along < .68 ? .94 : 1.52 - along * .85;
  else if (kind === 'liquid') profile = .58 + arch * .42;
  else if (kind === 'radiant') profile = .28 + arch * .78;
  else if (kind === 'flow') profile = .3 + arch * .62;
  else if (kind === 'organic') profile = .45 + arch * .5;
  else profile = .4 + .6 * Math.max(0, 1 - Math.abs(along - .4) * 1.5);
  return distance <= Math.max(1.5, span * profile);
}

/** Both touching materials follow one surface-local clock. Sharing visual
 * timing does not imply a gameplay fusion; confirmed groups get a wider lip. */
export function sharedContactPulse(u: number, v: number, frame: number): number {
  return .5 + .5 * Math.sin((u * .63 + v * .37) * Math.PI * 2 - frame * Math.PI / 4);
}

export interface MaterialContactFinish {
  /** Illumination in the owner's own palette, including the adjacent recess. */
  lift: number;
  /** Only fluid/energy signatures bend. Rigid facets remain fixed. */
  bend: number;
  /** Borrowed hue belongs to a touching native-pixel lip only. */
  reflection: number;
  reflectedTone: number;
}

/** A continuous crest passes along a real material contact. Each side models
 * the same crest differently: a wet meniscus has a darker inner channel, a
 * hot hard edge leaves a cooling shoulder, and a field folds into a recess.
 * These surface finishes never create an interaction in the RPG rules. */
export function materialContactFinish(own: BodyMaterial, other: BodyMaterial,
  distance: number, pulse: number, trailing: number, detailed: boolean,
  fused = false, facing = .5): MaterialContactFinish {
  const a = MATERIAL_SIGNATURES[own].visualClass, b = MATERIAL_SIGNATURES[other].visualClass;
  const near = clamp01(1 - distance / (fused ? 3.5 : 2.5));
  const moving = .35 + pulse * .65;
  const front = clamp01((pulse - .48) / .52), wake = clamp01((trailing - .5) / .5);
  const lip = distance === 0, shoulder = distance === 1;
  const lightSide = .7 + clamp01(facing) * .3;
  let lift = 0, bend = 0, reflection = 0;
  const reflectedTone = b === 'radiant' ? .78 : b === 'field' ? .72 : .65;

  // At small LODs one clean own-palette lip is enough. Do not introduce
  // animated points, extra channels or borrowed-colour glitter into 2px rails.
  if (!detailed) return { lift: lip ? .045 : 0, bend: 0, reflection: 0, reflectedTone };

  if (a === 'solid') {
    if (b === 'radiant') {
      lift = near * (.06 + front * .13 - wake * .065);
      if (lip) lift += .08 + front * .13;
      if (shoulder) lift -= wake * .08;
      reflection = lip ? front * (own === 'metal' ? .38 : own === 'gelo' ? .29 : .25) : shoulder ? front * .12 : 0;
    } else if (b === 'liquid') {
      // The narrow dark wet joint and its pale outer shoulder describe depth.
      lift = lip ? -.16 + front * .10 : shoulder ? .065 + front * .11 - wake * .035 : 0;
      reflection = lip ? (.08 + front * .18) * (own === 'terra' ? .65 : 1) : 0;
    } else if (b === 'field') lift = lip ? -.19 + front * .055 : shoulder ? .055 + front * .07 : 0;
    else lift = lip ? -.095 + front * .075 : shoulder ? front * .055 : 0;
  } else if (a === 'liquid') {
    // Viscous acid rolls behind the shared front while water has a clear lip.
    const roll = own === 'acido' ? front * .6 + wake * .4 : front;
    lift = lip ? .10 + roll * .19 - wake * .035 : shoulder ? -.145 + roll * .075 : near * roll * .035;
    reflection = lip ? (.05 + roll * (b === 'radiant' ? .3 : b === 'solid' ? .22 : .13)) : 0;
    bend = near * (b === 'field' ? .09 : own === 'acido' ? .035 : .055);
  } else if (a === 'organic') {
    // A connected bright vein grows beside the seam, never as detached dots.
    lift = b === 'field' ? (lip ? -.14 : shoulder ? front * .10 : 0)
      : lip ? -.09 + front * .08 : shoulder ? .035 + front * (b === 'liquid' ? .19 : .13) : near * front * .06;
    reflection = lip && (b === 'liquid' || b === 'radiant') ? front * (b === 'radiant' ? .22 : .18) : 0;
    bend = near * (b === 'flow' ? .03 : .012);
  } else if (a === 'field') {
    const depth = own === 'sombra' ? .18 : own === 'gravidade' ? .15 : .12;
    lift = lip ? -depth + (b === 'radiant' ? front * .16 : wake * .055)
      : shoulder ? .115 + front * .15 : near * front * .035;
    reflection = lip && b === 'radiant' ? front * .22 : 0;
    bend = near * (own === 'gravidade' ? .075 : .055);
  } else if (a === 'flow') {
    lift = lip ? .035 + front * .18 : shoulder ? -.065 + wake * .10 : near * front * .04;
    reflection = lip ? front * (b === 'radiant' ? .28 : b === 'liquid' ? .13 : 0) : 0;
    bend = near * (b === 'solid' || b === 'organic' ? .095 : .065);
  } else {
    // A bright front stays attached to its own cooling edge, including light.
    lift = lip ? .075 + front * .16 : shoulder ? -.055 + wake * .075 : near * moving * .055;
    if (b === 'field' && lip) lift -= .095;
    bend = near * (b === 'flow' ? .075 : .035);
  }
  if (lift > 0) lift *= lightSide;
  reflection *= lightSide;
  if (fused && distance <= 1) lift += pulse * .18;
  return { lift, bend, reflection, reflectedTone };
}
