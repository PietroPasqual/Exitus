import type { MaterialVisualClass } from './pixel-mixture-signatures';

const ANCHORS: Readonly<Record<string, readonly [number, number]>> = {
  fogo: [.68, .18], raio: [.8, .4], luz: [.32, .18],
  terra: [.25, .72], metal: [.78, .48], gelo: [.24, .31], materia: [.2, .55],
  agua: [.63, .8], acido: [.3, .75], vento: [.82, .58], som: [.56, .82],
  natureza: [.28, .73], ilusao: [.74, .28], sombra: [.74, .72],
  gravidade: [.2, .4], espaco: [.8, .33]
};

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

/** Both sides of a confirmed fusion follow the same surface-local clock. */
export function sharedContactPulse(u: number, v: number, frame: number): number {
  return .5 + .5 * Math.sin((u * .63 + v * .37) * Math.PI * 2 - frame * Math.PI / 4);
}
