import { clamp01, type RGB } from './pixel';

/** Body materials only. Concept/aura runes never enter this registry. */
export const BODY_MATERIALS = [
  'fogo', 'terra', 'agua', 'vento', 'raio', 'metal', 'gelo', 'som',
  'natureza', 'acido', 'ilusao', 'luz', 'sombra', 'materia', 'gravidade', 'espaco'
] as const;
export type BodyMaterial = typeof BODY_MATERIALS[number];
export type MaterialVisualClass = 'solid' | 'liquid' | 'radiant' | 'flow' | 'organic' | 'field';
export type SignatureCue = 'body' | 'face' | 'ridge' | 'seam' | 'reflection' | 'channel' |
  'crest' | 'tongue' | 'kernel' | 'fork' | 'stream' | 'wave' | 'vein' | 'pool' | 'bubble' |
  'echo' | 'ray' | 'recess' | 'pressure' | 'fold' | 'star';
export interface MaterialSignatureDescriptor {
  readonly visualClass: MaterialVisualClass;
  readonly rigid: boolean;
  readonly structure: string;
  readonly motion: string;
}

/** These descriptions are art contracts, not new engine interactions. */
export const MATERIAL_SIGNATURES: Readonly<Record<BodyMaterial, MaterialSignatureDescriptor>> = {
  fogo: { visualClass: 'radiant', rigid: false, structure: 'Connected pointed hot folds, pale kernel, cooling edge', motion: 'Front rises through tongues; the edge cools one beat later' },
  terra: { visualClass: 'solid', rigid: true, structure: 'Matte irregular blocks with a broken mineral seam', motion: 'Blocks stay fixed; a restrained contact seam catches light' },
  agua: { visualClass: 'liquid', rigid: false, structure: 'One connected rounded current with a curled crest', motion: 'Crest rolls along the current and returns continuously' },
  vento: { visualClass: 'flow', rigid: false, structure: 'Two open, long, tapering streamlines', motion: 'A short front advects along each streamline and fades at wrap' },
  raio: { visualClass: 'radiant', rigid: false, structure: 'Angular fork with a narrow hot core and residual channel', motion: 'Channel holds, jumps once, then decays locally' },
  metal: { visualClass: 'solid', rigid: true, structure: 'Broad hard reflection plane and a one-pixel specular rail', motion: 'Reflection sweeps over a fixed face without billowing' },
  gelo: { visualClass: 'solid', rigid: true, structure: 'Large pale angular face, blue side, crisp crystal ridge', motion: 'Facets stay rigid; only a small refraction/contact pulse moves' },
  som: { visualClass: 'flow', rigid: false, structure: 'Regularly spaced curved pressure fronts', motion: 'Wave crests propagate with one shared wavelength' },
  natureza: { visualClass: 'organic', rigid: false, structure: 'A rooted vein with paired branching leaf ribs', motion: 'A slow bright pulse travels along fixed connected ribs' },
  acido: { visualClass: 'liquid', rigid: false, structure: 'Scalloped pooled meniscus and sparse hollow bubble marks', motion: 'A viscous local roll lags behind the meniscus' },
  ilusao: { visualClass: 'field', rigid: false, structure: 'Two offset incomplete internal planes', motion: 'The echo shifts against its source with opposite phase' },
  luz: { visualClass: 'radiant', rigid: false, structure: 'Broad clean radiant plane with a restrained straight ray', motion: 'Radiance sweeps smoothly without a bolt or strobe' },
  sombra: { visualClass: 'field', rigid: false, structure: 'Deep absorptive wedge and a readable purple lip', motion: 'The recess opens and closes locally' },
  materia: { visualClass: 'solid', rigid: true, structure: 'Dense ordered planes with a stepped orthogonal joint', motion: 'Constructed planes stay fixed; a joint catches contact light' },
  gravidade: { visualClass: 'field', rigid: false, structure: 'Nested curved trajectories compress into one inward ridge', motion: 'The trajectories draw inward and release slowly' },
  espaco: { visualClass: 'field', rigid: false, structure: 'An angular folded plane with sparse attached stellar points', motion: 'The fold shears locally; only two interior points twinkle' }
};

const MATERIAL_SET: ReadonlySet<string> = new Set(BODY_MATERIALS);
export function isBodyMaterial(element: string): element is BodyMaterial { return MATERIAL_SET.has(element); }

export interface MaterialSignatureInput {
  element: BodyMaterial;
  ramp: readonly RGB[];
  /** Stable coordinates in this material's allocated domain, not the whole body. */
  u: number;
  v: number;
  /** Original surface illumination, normalized to 0–1. */
  illumination: number;
  /** Eight frames, eight fps; values are normalized defensively. */
  frame: number;
  seed: number;
  scale: { width: number; height: number; pixels?: number };
  /** Domain-local contact position and inward normal; never expands the domain. */
  contact?: { u: number; v: number; nx: number; ny: number };
}
export interface MaterialSignatureSample {
  /** Exact member of the supplied palette; no hidden alpha or palette averaging. */
  color: RGB;
  tone: number;
  cue: SignatureCue;
  /** Guidance for preserving an authored primary, not secondary opacity. */
  strength: number;
}
interface Ink { tone: number; cue: SignatureCue; strength: number }
interface Surface {
  u: number; v: number; w: number; h: number; light: number;
  frame: number; phase: number; variant: number;
  compact: boolean; tiny: boolean; contact: number;
}
const TAU = Math.PI * 2;
const LIGHTNING_FLASH = [1, .8, .55, 1, .85, .6, .45, .7] as const;
const finite = (n: number, fallback = 0): number => Number.isFinite(n) ? n : fallback;
const ink = (tone: number, cue: SignatureCue = 'body', strength = .32): Ink => ({ tone, cue, strength });
const band = (distance: number, width: number): number => clamp01(1 - Math.abs(distance) / width);
const wrap = (n: number): number => n - Math.floor(n);
/** Pixel distance to an anisotropically scaled segment. No per-pixel path arrays. */
function segment(s: Surface, ax: number, ay: number, bx: number, by: number): number {
  const dx = (bx - ax) * s.w, dy = (by - ay) * s.h;
  const x = (s.u - ax) * s.w, y = (s.v - ay) * s.h;
  const t = clamp01((x * dx + y * dy) / Math.max(.0001, dx * dx + dy * dy));
  return Math.hypot(x - t * dx, y - t * dy);
}
const volume = (s: Surface, base: number, weight = .12): number => base + (s.light - .5) * weight;

function fire(s: Surface): Ink {
  const { u, v, phase } = s;
  // A broad connected lower fold feeds two unequal pointed tongues. The dark
  // cleft remains attached to the cooling flank instead of becoming freckles.
  const sway = Math.sin(phase) * .045;
  const spine = .46 + Math.sin(v * 4.5) * .055 + sway * (1 - v);
  const width = .038 + v * .29;
  const center = Math.abs(u - spine);
  const second = .73 - v * .13 + Math.sin(phase - .8) * .035;
  const side = !s.tiny && v > .26 && Math.abs(u - second) < .02 + (v - .26) * .16;
  const front = .5 + Math.sin(phase) * .22;
  const hot = band(v - front, .22);
  if (center < width || side) {
    const coreWidth = Math.max(.033, .5 / s.w);
    if (center < coreWidth && v > .38 && v < .81) return ink(.9 + hot * .09, 'kernel', 1);
    const fold = center / Math.max(.04, width);
    return ink(volume(s, .52 + (1 - fold) * .13 + hot * .17, .07), 'tongue', .96);
  }
  const cooling = band(center - width, .13);
  return ink(volume(s, .2 + cooling * .15 + s.contact * .08), 'body', .4);
}

function earth(s: Surface): Ink {
  const { u, v } = s;
  // A fixed, uneven Y joint separates three matte rock planes. The secondary
  // bevel is a broad chipped face, deliberately unlike a metal reflection.
  const joint = Math.min(segment(s, .18, -.05, .47, .42), segment(s, .47, .42, .77, 1.05),
    segment(s, .47, .42, 1.05, .3));
  if (joint < (s.tiny ? .4 : .65)) return ink(.13 + s.contact * .17, 'seam', .98);
  if (joint < 1.35 && u < .64 && v < .69) return ink(.57 + s.contact * .16, 'ridge', .88);
  const top = v < .4 - (u - .47) * .2;
  const left = u < .47 + (v - .42) * .51;
  let tone = top ? .64 - u * .1 : left ? .44 - v * .08 : .25 + u * .06;
  // One stepped mineral chip belongs to the left plane, not random gravel.
  if (!s.compact && u > .13 && u < .34 && v > .53 && v < .71 - u * .2) tone += .12;
  return ink(volume(s, tone + s.contact * .08, .1), 'face', .7);
}

function water(s: Surface): Ink {
  const { u, v, phase } = s;
  const curl = Math.sin(phase) * .04;
  const cx = .48 + curl, cy = .47 + Math.cos(phase) * .025;
  const x = (u - cx) * .92, y = v - cy;
  const r = Math.hypot(x, y), angle = Math.atan2(y, x);
  // The pale lip turns over a dark inner channel; both return into the same
  // broad lower current. This is one rolling volume, not detached blue bands.
  const radial = Math.abs(r - .29), opening = angle > -.6 && angle < .45;
  const tail = segment(s, .28 + curl, .72, .9, .69 - curl);
  const crest = radial * Math.min(s.w / .92, s.h);
  const rolling = .5 + .5 * Math.cos(angle - phase);
  if ((!opening && crest < .78) || tail < .68) return ink(.71 + rolling * .22, 'crest', .98);
  if ((!opening && crest < 1.8) || tail < 1.7) return ink(.41 + rolling * .15 + s.contact * .08, 'channel', .9);
  if (r < .21 && u > .37) return ink(volume(s, .17 + r * .27), 'channel', .8);
  const underside = v > .76 ? .26 : .4 + (1 - v) * .1;
  return ink(volume(s, underside + s.contact * .09), 'body', .45);
}

function wind(s: Surface): Ink {
  const { u, v } = s;
  // Unequal spacing, opposite open ends, no repeated wave circles.
  const bend = .095 * Math.sin(u * 3.6 - .4);
  const a = .31 + bend, b = .7 - bend * .55;
  const d1 = Math.abs(v - a) * s.h, d2 = Math.abs(v - b) * s.h;
  const front = wrap(s.frame / 8 + s.variant * .23);
  const envelope = Math.sin(Math.PI * front); // Born/dies softly at the loop edge.
  const moving = band(u - front, .22) * envelope;
  const taper1 = .3 + .62 * Math.sin(clamp01(u / .93) * Math.PI);
  const taper2 = .25 + .5 * Math.sin(clamp01((u - .12) / .88) * Math.PI);
  if ((d1 < taper1 && u < .94) || (!s.tiny && d2 < taper2 && u > .12)) return ink(.65 + moving * .4, 'stream', .96);
  if (d1 < taper1 + .65 || (!s.tiny && d2 < taper2 + .5)) return ink(.39 + moving * .23 + s.contact * .08, 'channel', .8);
  // A quiet lee joins the streams while the front stays narrow and directional.
  const lee = v > a && v < b ? .28 : .17;
  return ink(volume(s, lee + moving * .1, .08), 'body', .4);
}

function lightning(s: Surface): Ink {
  // Two held angular channels share endpoints. Only the interior fork jumps.
  const jump = s.frame >= 3 && s.frame <= 5 ? .1 : 0;
  const d = Math.min(segment(s, .51, -.06, .33 + jump, .38),
    segment(s, .33 + jump, .38, .67 - jump, .45), segment(s, .67 - jump, .45, .41, 1.06));
  const branch = s.tiny ? 100 : Math.min(segment(s, .57 - jump * .4, .61, .84, .48), segment(s, .84, .48, .76, .2));
  const distance = Math.min(d, branch);
  const flash = LIGHTNING_FLASH[s.frame];
  if (distance < .58) return ink(.78 + flash * .18, 'fork', 1);
  if (distance < 1.4) return ink(.29 + flash * .22, 'channel', .94);
  // The warm residual trough is connected to the channel, never a full flash.
  if (distance < 2.35 && !s.tiny) return ink(.24 + flash * .08 + s.contact * .07, 'channel', .68);
  return ink(volume(s, .15 + s.contact * .1, .08), 'body', .4);
}

function metal(s: Surface): Ink {
  const compact = s.compact || Math.min(s.w, s.h) < 15;
  const shift = Math.sin(s.phase) * (compact ? .055 : .1);
  const reflected = s.u + (s.v - .5) * .18;
  const rail = .45 + shift;
  const d = (reflected - rail) * s.w;
  // The pale rail is at most one native pixel, adjacent to a broad hard band.
  if (Math.abs(d) < .48) return ink(.99, 'reflection', 1);
  // A compact steel wedge needs a dark face, not another pale crystal plate.
  // Keep two quiet hard planes and one straight rail; omit the wide white band.
  if (compact) return ink(volume(s, (d > 0 ? .21 : .43) + s.contact * .07, .04), 'face', .9);
  if (d > .48 && d < Math.max(1.4, s.w * .17)) return ink(.19 + s.contact * .16, 'face', .96);
  if (d < -.48 && d > -Math.max(1.6, s.w * .26)) return ink(volume(s, .72 + s.contact * .1, .06), 'face', .85);
  return ink(volume(s, (s.u < .24 ? .38 : .49) + s.contact * .08, .1), 'face', .75);
}

function ice(s: Surface): Ink {
  const { u, v } = s;
  const ridge = .46 + (v < .43 ? (.43 - v) * .27 : (v - .43) * .38);
  const side = u > ridge;
  const cap = v < .29 - (u - .45) * .27;
  // Fixed large faces. Refraction changes one short ridge, never the facet edges.
  const onRidge = Math.abs(u - ridge) * s.w < .55;
  if (onRidge) return ink(.96, 'ridge', 1);
  const bottom = v > .79 - u * .13;
  if (bottom) return ink((side ? .35 : .63) + s.contact * .08, 'face', .95);
  if (cap) return ink(.93, 'face', .92);
  if (side) return ink(volume(s, .32, .06), 'face', .95);
  const refraction = band(v - (.48 + Math.sin(s.phase) * .25), .13) * s.contact;
  // Broad faces stay pale and rigid. A quiet diagonal internal plane adds depth
  // without multiplying crystal ridges or turning the whole plate white.
  const inner = !s.compact && v > .48 + u * .16 ? -.035 : 0;
  return ink(.8 + inner + refraction * .13, 'face', .94);
}

function sound(s: Surface): Ink {
  const { u, v } = s;
  // Fronts are regular curved *vertical* arcs. Wind's two horizontal streams
  // cannot become this motif even if the palettes are made identical.
  const curvature = .8 * Math.min(1, s.h / s.w * 2);
  const curved = u + (v - .5) * (v - .5) * curvature;
  const spacing = s.compact ? .48 : .35;
  const travel = s.frame / 8 * spacing;
  const cycle = wrap((curved - travel) / spacing);
  const distance = Math.min(cycle, 1 - cycle) * spacing * s.w;
  const edgeFade = clamp01(Math.min(u, 1 - u) * 8);
  if (distance < .65) return ink(.63 + edgeFade * .25, 'wave', .98);
  if (distance < 1.25) return ink(.4 + s.contact * .08, 'channel', .83);
  // Every bright compression has an adjacent dark rarefaction. Equal spacing
  // remains the identity; wind has unequal open, tapering ribbons instead.
  const rarefaction = cycle > .2 && cycle < .56;
  return ink(volume(s, rarefaction ? .14 : .29, .07), 'body', .45);
}

function nature(s: Surface): Ink {
  const { u, v } = s;
  const rib = .47 + (v - .5) * .12;
  const spine = segment(s, .41, -.02, .53, 1.04);
  const branches = Math.min(segment(s, .44, .25, .13, .07), segment(s, .47, .5, .86, .23),
    segment(s, .49, .66, .14, .41), segment(s, .51, .86, .86, .63));
  const distance = s.tiny ? spine : Math.min(spine, branches);
  // A rooted sap pulse travels along fixed leaf ribs. The wide leaf halves are
  // shaded differently so the ribs belong to a leaf, not a neon skeleton.
  const wave = .5 + .5 * Math.cos(v * TAU - s.phase), pulse = wave * wave * wave;
  if (distance < .6) return ink(.61 + pulse * .28 + s.contact * .08, 'vein', 1);
  if (distance < 1.3) return ink(.22 + s.contact * .08, 'seam', .84);
  const leaf = Math.abs(u - rib) < (.44 - Math.abs(v - .5) * .63);
  const plane = leaf ? (u < rib ? .49 - v * .05 : .32 + v * .06) : .2;
  return ink(volume(s, plane + pulse * .04 + s.contact * .08), 'face', .65);
}

function acid(s: Surface): Ink {
  const { u, v } = s;
  const slow = Math.sin(s.phase) * .025;
  const scallop = .39 + Math.abs(Math.sin((u + .06) * Math.PI * 2.5)) * .12 + slow;
  const meniscus = Math.abs(v - scallop) * s.h;
  // Hollow bubbles use a dark center; they are not white water spray.
  if (!s.compact) {
    const bubbleA = Math.hypot((u - .29) * s.w, (v - .7 - slow) * s.h);
    const bubbleB = Math.hypot((u - .72) * s.w, (v - .62 + slow) * s.h);
    const bubble = Math.min(bubbleA, bubbleB);
    if (bubble < .62) return ink(.16, 'bubble', .94);
    if (bubble < 1.4) return ink(.78, 'bubble', .9);
  }
  if (meniscus < .68) return ink(.87 + s.contact * .08, 'crest', 1);
  if (v > scallop && meniscus < 1.6) return ink(.25, 'pool', .94);
  if (v > scallop) {
    const lower = .76 + Math.sin(u * 4 + s.phase - .9) * .035;
    if (Math.abs(v - lower) * s.h < .65 && u > .15 && u < .84) return ink(.56, 'pool', .8);
    return ink(volume(s, (v > .84 ? .24 : .44 + (v - scallop) * .15) + s.contact * .09, .08), 'pool', .78);
  }
  return ink(volume(s, .19 + s.contact * .07, .09), 'body', .4);
}

function illusion(s: Surface): Ink {
  const { u, v } = s;
  const offset = Math.sin(s.phase) * .06;
  // Broken rectangular planes shift against each other. No spatial stars,
  // gravity rings, or fully dark shadow cavity.
  const source = Math.min(segment(s, .31 + offset, -.04, .31 + offset, .74), segment(s, -.04, .21 + offset, .72, .21 + offset));
  const echo = Math.min(segment(s, .73 - offset, .29, .73 - offset, 1.04), segment(s, .28, .79 - offset, 1.04, .79 - offset));
  if (source < .65) return ink(.85, 'echo', .97);
  if (echo < .65) return ink(.61 + s.contact * .14, 'echo', .94);
  const firstPlane = u > .31 + offset && u < .73 - offset && v < .74;
  const secondPlane = u > .28 && v > .29 && v < .79 - offset;
  return ink(volume(s, firstPlane !== secondPlane ? .5 : firstPlane ? .2 : .32, .06), 'face', .61);
}

function light(s: Surface): Ink {
  const { u, v } = s;
  const sweep = .47 + Math.sin(s.phase) * .12;
  const distance = Math.abs(u - sweep);
  // One broad clean plane; the short perpendicular ray is still attached.
  if (distance * s.w < .7 || (Math.abs(v - .36) * s.h < .6 && u > .19 && u < .82)) return ink(.98, 'ray', .96);
  if (distance < .2) return ink(volume(s, .76 + s.contact * .1, .05), 'face', .9);
  if (distance < .35) return ink(.55 + s.contact * .1, 'face', .74);
  // A firm ochre flank gives the luminous plane volume without a white wash.
  return ink(volume(s, u < sweep ? .34 : .23, .08), 'body', .45);
}

function shadow(s: Surface): Ink {
  const { u, v } = s;
  const close = Math.sin(s.phase) * .045;
  const lip = .37 + .18 * Math.abs(v - .46) + close;
  const d = (u - lip) * s.w;
  if (d > -.65 && d < .15 && v > .08 && v < .92) return ink(.57 + s.contact * .12, 'ridge', .96);
  if (d >= .15 && u < .82 - (v - .5) * .16) {
    const depth = band(v - .5, .38);
    return ink(.12 - depth * .07, 'recess', .98);
  }
  // Only the closing outer fold catches light; the deep wedge stays absorptive.
  const fold = u > .82 - (v - .5) * .16 ? .26 + s.contact * .1 : .31;
  return ink(volume(s, fold, .06), 'body', .55);
}

function matter(s: Surface): Ink {
  const { u, v } = s;
  // Ordered stepped masonry, fixed in time. Earth has no such right-angle joint.
  const step = v < .43 ? .62 : .37;
  const vertical = Math.abs(u - step) * s.w;
  const horizontal = Math.abs(v - .43) * s.h;
  const seam = Math.min(vertical, u > .37 && u < .62 ? horizontal : 100);
  if (seam < .55) return ink(.13 + s.contact * .08, 'seam', 1);
  if ((u < step && vertical < 1.25) || (v < .43 && horizontal < 1.2 && u > .37 && u < .62)) return ink(.71 + s.contact * .08, 'ridge', .87);
  // The lowered inset is broad and orthogonal, unlike earth's irregular chip.
  const inset = !s.compact && u > .74 && v > .59 ? -.08 : 0;
  return ink(volume(s, (u < step ? (v < .43 ? .64 : .43) : .3) + inset + s.contact * .1, .08), 'face', .82);
}

function gravity(s: Surface): Ink {
  const { u, v } = s;
  const pressure = Math.sin(s.phase) * .045;
  const y = v - .5;
  // Both trajectories turn toward the same inner ridge and nearly meet there.
  const inward = .37 + y * y * 1.05 + pressure;
  const outer = .76 - y * y * .37 - pressure * .5;
  const d1 = Math.abs(u - inward) * s.w, d2 = Math.abs(u - outer) * s.w;
  if (d1 < .7) return ink(.76 + band(v - .5, .28) * .17, 'pressure', .98);
  if (!s.tiny && d2 < .55 && v > .14 && v < .86) return ink(.55, 'pressure', .86);
  if (u > inward && u < outer) {
    const compressed = clamp01((u - inward) / Math.max(.03, outer - inward));
    return ink(volume(s, .14 + compressed * .13, .06), 'recess', .87);
  }
  return ink(volume(s, .36 + s.contact * .08, .08), 'body', .44);
}

function space(s: Surface): Ink {
  const { u, v } = s;
  const shear = Math.sin(s.phase) * .04;
  const fold = v < .48 ? .27 + v * .7 + shear : .606 - (v - .48) * .56 + shear;
  const distance = (u - fold) * s.w;
  if (Math.abs(distance) < .55) return ink(.81, 'fold', 1);
  // Only two sparse points, attached inside the sampled field domain.
  if (!s.compact) {
    const a = Math.abs(u - .23) * s.w < .5 && Math.abs(v - .57) * s.h < .5;
    const b = Math.abs(u - .76) * s.w < .5 && Math.abs(v - .24) * s.h < .5;
    if (a || b) return ink(a ? .86 + .1 * Math.sin(s.phase) : .75 + .14 * Math.cos(s.phase), 'star', .98);
  }
  const plane = distance < 0 ? .16 + u * .1 : v < .48 ? .55 : .32;
  const innerFold = !s.compact && distance > .55 && distance < 1.55 ? .11 : 0;
  return ink(volume(s, plane + innerFold + s.contact * .08, .05), 'face', .82);
}

const SAMPLERS: Readonly<Record<BodyMaterial, (s: Surface) => Ink>> = {
  fogo: fire, terra: earth, agua: water, vento: wind, raio: lightning, metal, gelo: ice,
  som: sound, natureza: nature, acido: acid, ilusao: illusion, luz: light,
  sombra: shadow, materia: matter, gravidade: gravity, espaco: space
};

/**
 * Sample one existing, allocated surface pixel. The caller owns membership,
 * alpha, contours, semantic marks, and connected material-domain allocation.
 * This function cannot draw, create particles, fill a hole, or alter geometry.
 * Tiny regions keep the main value split/rib; secondary bubbles/stars/ribs are
 * dropped. A two-pixel region is a material token, not full artistic legibility.
 */
export function sampleMaterialSignature(input: MaterialSignatureInput): MaterialSignatureSample | null {
  const { u, v, ramp, element } = input;
  if (!isBodyMaterial(element) || !ramp.length || !Number.isFinite(u) || !Number.isFinite(v) ||
    u < 0 || u > 1 || v < 0 || v > 1 || !Number.isFinite(input.scale.width) ||
    !Number.isFinite(input.scale.height) || input.scale.width <= 0 || input.scale.height <= 0) return null;
  const w = Math.max(1, input.scale.width), h = Math.max(1, input.scale.height);
  const pixels = Math.max(1, finite(input.scale.pixels ?? w * h, w * h));
  const frame = ((Math.floor(finite(input.frame)) % 8) + 8) % 8;
  const seed = Math.trunc(finite(input.seed));
  const variant = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const turn = frame * TAU / 8, phase = turn + variant * TAU;
  let contact = 0;
  if (input.contact) {
    const c = input.contact;
    if (Number.isFinite(c.u) && Number.isFinite(c.v) && Number.isFinite(c.nx) && Number.isFinite(c.ny)) {
      const norm = Math.hypot(c.nx, c.ny);
      const x = (u - c.u) * w, y = (v - c.v) * h;
      const facing = norm > .0001 ? clamp01(.5 + (x * c.nx + y * c.ny) / norm * .2) : 1;
      contact = band(Math.hypot(x, y), Math.max(3, Math.min(w, h) * .45)) * facing * (.5 + .5 * Math.sin(phase - .8));
    }
  }
  const elongated = w > h * 2.4;
  // Blades, rays and glyph strokes expose length/across coordinates. Upright
  // motifs turn with that surface so a flame fold or root remains connected
  // along the stroke instead of being clipped to a short transverse fragment.
  const turnAlong = elongated && (element === 'fogo' || element === 'raio' || element === 'metal' ||
    element === 'gelo' || element === 'natureza' || element === 'sombra' ||
    element === 'ilusao' || element === 'luz' || element === 'gravidade' || element === 'espaco');
  const sampled = SAMPLERS[element]({
    u: turnAlong ? v : u, v: turnAlong ? 1 - u : v,
    w: turnAlong ? h : w, h: turnAlong ? w : h,
    light: clamp01(finite(input.illumination, .5)), frame, phase, variant,
    tiny: Math.min(w, h) < 5 || pixels < 20,
    compact: Math.min(w, h) < 9 || pixels < 70, contact
  });
  const index = Math.round(clamp01(sampled.tone) * (ramp.length - 1));
  return { color: ramp[index], tone: ramp.length > 1 ? index / (ramp.length - 1) : 0, cue: sampled.cue, strength: sampled.strength };
}
