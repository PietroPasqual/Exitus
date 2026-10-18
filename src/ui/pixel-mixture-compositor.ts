import type { MaterialFusionGroup } from '../core/appearance';
import { clamp01, mixRGB, Pix, type RGB } from './pixel';
import type { MixtureBounds, MixtureDomains } from './pixel-mixture-domains';
import { MixtureGeometryCache } from './pixel-mixture-cache';
import { insideMaterialInterface, materialInterfaceAnchors, sharedContactPulse } from './pixel-mixture-contact';
import { isBodyMaterial, MATERIAL_SIGNATURES, sampleMaterialSignature, type MaterialVisualClass } from './pixel-mixture-signatures';

export interface MixtureMaterial { element: string; ramp: readonly RGB[] }
export interface MixturePaintOptions {
  frame?: number; seed?: number; reverse?: boolean; form?: string;
  surfaceBounds?: MixtureBounds; authoredRamp?: readonly RGB[];
  materialFusion?: readonly MaterialFusionGroup[];
  preserveAuthoredPrimary?: boolean;
  /** Stable authored rest-pose silhouette, in the same scene coordinates. */
  ownershipBody?: Pix;
}
export type MixturePaintReport = MixtureDomains & { paintedPixels: readonly number[] };
const luma = (r: number, g: number, b: number): number => r * .2126 + g * .7152 + b * .0722;
const TAU = Math.PI * 2;
const geometryCache = new MixtureGeometryCache();

/** Every class contact retains both material signatures; these are art, not rules. */
function contactResponse(own: MaterialVisualClass, other: MaterialVisualClass,
  distance: number, pulse: number, fused: boolean): { lift: number; bend: number } {
  const near = clamp01(1 - distance / (fused ? 3.5 : 2.5));
  const moving = .35 + pulse * .65;
  // Rigid planes stay rigid even beside liquids, fields or flame.
  if (own === 'solid') return { lift: near * (other === 'radiant' ? .19 * moving : other === 'field' ? -.12 : other === 'liquid' ? -.08 + pulse * .14 : .07), bend: 0 };
  if (own === 'liquid') return { lift: near * (other === 'solid' ? .15 * moving : other === 'radiant' ? .2 * moving : other === 'field' ? -.07 + pulse * .14 : .1 * moving), bend: near * (other === 'field' ? .095 : .055) };
  if (own === 'radiant') return { lift: near * (other === 'field' ? -.13 + pulse * .18 : other === 'solid' ? .12 : .15 * moving), bend: near * (other === 'flow' ? .075 : .035) };
  if (own === 'flow') return { lift: near * .13 * moving, bend: near * (other === 'solid' || other === 'organic' ? .1 : .065) };
  if (own === 'organic') return { lift: near * (other === 'radiant' ? .13 * moving : other === 'field' ? -.1 : .08 * moving), bend: near * (other === 'flow' ? .035 : .012) };
  return { lift: near * (other === 'radiant' ? .15 * moving : -.07 + pulse * .13), bend: near * .06 };
}

/** A native-pixel bevel, with a brief crest and a cooler following edge.
 * Both sides use the same front, rather than unrelated owner-local flashes.
 * Rigid materials only change reflected light; no geometry is displaced. */
function junctionBevel(own: MaterialVisualClass, other: MaterialVisualClass,
  distance: number, pulse: number, trailing: number, detailed: boolean): { lift: number; reflection: number } {
  const front = clamp01((pulse - .58) / .42), wake = clamp01((trailing - .62) / .38);
  const lip = distance === 0, shoulder = distance === 1;
  if (!lip && !shoulder) return { lift: 0, reflection: 0 };
  if (own === 'solid') {
    if (other === 'radiant') return { lift: front * (lip ? .14 : .08) + wake * .025,
      reflection: front * (lip ? .34 : .12) };
    if (other === 'liquid') return { lift: detailed ? (lip ? -.13 + front * .09 : front * .14) : front * .06,
      reflection: lip ? front * .22 : 0 };
    return { lift: lip && detailed ? -.075 + front * .08 : 0, reflection: 0 };
  }
  if (own === 'liquid') return { lift: lip ? .06 + front * .14 : detailed ? -.07 + wake * .08 : 0,
    reflection: lip ? front * (other === 'radiant' ? .32 : other === 'solid' ? .16 : .08) : 0 };
  if (own === 'organic') return { lift: other === 'liquid' && detailed
    ? lip ? -.10 + front * .08 : front * .14 : front * .075,
    reflection: lip && (other === 'liquid' || other === 'radiant') ? front * .16 : 0 };
  if (own === 'field') return { lift: detailed && lip ? -.10 + wake * .035 : front * .12,
    reflection: shoulder && other === 'radiant' ? front * .16 : 0 };
  if (own === 'flow') return { lift: front * (lip ? .13 : .04),
    reflection: lip && other === 'radiant' ? front * .24 : 0 };
  return { lift: lip ? front * .12 : wake * .045, reflection: 0 };
}

/**
 * Paint every constituent into its own connected occupied region. The first
 * keeps the largest region and authored relief; later elements cannot overwrite
 * one another. Thin forms use existing coloured strokes, never new alpha.
 */
export function paintAllocatedMixture(body: Pix, bounds: MixtureBounds,
  input: readonly MixtureMaterial[], options: MixturePaintOptions = {}): MixturePaintReport {
  const materials = input.filter((m, i) => isBodyMaterial(m.element) && m.ramp.length && input.findIndex(o => o.element === m.element) === i);
  const authored = options.authoredRamp?.length ? options.authoredRamp : materials[0]?.ramp;
  // Ownership follows occupied geometry, not the colour of an animated
  // reflection. Otherwise a metal glint can move an entire ice region. The
  // real body's dark marks/highlights are checked separately before painting.
  const preferredSeeds = materialInterfaceAnchors(materials.map(m => m.element), options.surfaceBounds ?? bounds, !!options.reverse);
  const domains = geometryCache.allocate(body, bounds, materials.length, { ...options, preferredSeeds }, options.ownershipBody ?? body);
  const paintedPixels = materials.map(() => 0);
  const report = Object.assign(domains, { paintedPixels });
  if (materials.length < 2 || !authored?.length) return report;
  const frame = Number.isFinite(options.frame) ? ((Math.floor(options.frame!) % 8) + 8) % 8 : 0;
  const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed!) : 0;
  const low = luma(...authored[0]), high = luma(...authored[authored.length - 1]);
  const phase = frame * TAU / 8;
  const alongShape = domains.shape === 'long' || domains.shape === 'hollow' || domains.shape === 'stroke';
  const { l, t, r, b } = domains.bounds;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const q = domains.sampleAt(x, y);
    if (!q) continue;
    const material = materials[q.owner], region = domains.regions[q.owner];
    if (!isBodyMaterial(material.element)) continue;
    const other = materials[q.contactOwner];
    const ownClass = MATERIAL_SIGNATURES[material.element].visualClass;
    const i = (y * body.w + x) * 4;
    if (q.owner === 0 && body.data[i + 3]) paintedPixels[0]++;
    // These decisions do not depend on a sampled material. Avoid calculating
    // signatures/contact waves for pixels whose authored surface stays exact.
    if (options.preserveAuthoredPrimary && q.owner === 0 && q.contactDistance > 1) continue;
    if (q.owner > 0 && !insideMaterialInterface(ownClass, q.contactDistance, q.along,
      region.width, region.length, region.pixelCount)) continue;
    const otherClass = other && isBodyMaterial(other.element) ? MATERIAL_SIGNATURES[other.element].visualClass : ownClass;
    const fused = !!other && !!options.materialFusion?.some(group => group.elements.includes(material.element) && group.elements.includes(other.element));
    // Advect a boundary gesture along the actual region. The same clock and
    // local orientation as the authored sprite also hold for returned lances.
    const globalU = (x - l) / Math.max(1, r - l), globalV = (y - t) / Math.max(1, b - t);
    const surfaceU = options.reverse ? 1 - globalU : globalU;
    const pulse = sharedContactPulse(surfaceU, globalV, frame);
    const response = contactResponse(ownClass, otherClass, q.contactDistance, pulse, fused);
    // Reflecting the major axis reverses its perpendicular coordinate too.
    // Undo that handedness so a returned ring/blade keeps the same material
    // ridge and contact illumination instead of moving them to its far face.
    let u = alongShape ? q.along : q.u, v = alongShape ? (options.reverse ? 1 - q.across : q.across) : q.v;
    if (q.contact && response.bend) {
      const gesture = Math.sin(phase - q.along * TAU) * response.bend;
      if (alongShape) {
        // Arc coordinates already follow the occupied path. A scene-space
        // normal here would turn a mirrored contact into a different bend.
        u = clamp01(u - gesture * .35); v = clamp01(v + gesture);
      } else {
        u = clamp01(u - q.contact.ny * gesture); v = clamp01(v + q.contact.nx * gesture);
      }
    }
    const light = luma(body.data[i], body.data[i + 1], body.data[i + 2]);
    const near = (c: RGB): boolean => Math.max(Math.abs(body.data[i] - c[0]), Math.abs(body.data[i + 1] - c[1]), Math.abs(body.data[i + 2] - c[2])) <= 5;
    // A generic shadow sphere has a void tone, not an eye or carved anatomy.
    // A secondary face may occupy that interior; authored forms/glyphs and
    // multipart bodies retain the strict dark-cut protection.
    const shadowVolume = q.owner > 0 && options.form === 'forma_esfera' && materials[0].element === 'sombra';
    if (!body.data[i + 3] || Math.max(body.data[i], body.data[i + 1], body.data[i + 2]) < 22 || (!shadowVolume && (light <= low + 1 || near(authored[0]))) ||
      light >= high - 1 || near(authored[authored.length - 1])) continue;
    const illumination = clamp01((light - low) / Math.max(1, high - low));
    const sampled = sampleMaterialSignature({ element: material.element, ramp: material.ramp, u, v,
      illumination, frame, seed: seed + q.owner * 23,
      scale: { width: alongShape ? region.length : region.bounds.r - region.bounds.l + 1,
        height: alongShape ? region.width : region.bounds.b - region.bounds.t + 1, pixels: region.pixelCount },
      contact: alongShape ? undefined : q.contact });
    if (!sampled) continue;
    // Primary authored anatomy remains the dominant drawing. Only a strong
    // material ridge or actual contact can replace it; secondary faces own
    // their brightness and do not vanish under a dark primary's luminance.
    let color = sampled.color;
    if (q.contactDistance <= 2) {
      const bevel = junctionBevel(ownClass, otherClass, q.contactDistance, pulse,
        sharedContactPulse(surfaceU, globalV, frame - 1), region.pixelCount >= 36 && region.width >= 4);
      const tone = clamp01(sampled.tone + response.lift + bevel.lift + (fused && q.contactDistance <= 1 ? pulse * .18 : 0));
      color = material.ramp[Math.round(tone * (material.ramp.length - 1))];
      // Reflection is restricted to the touching lip, never a global palette
      // average. A local pulse leaves both parent materials recognizable.
      if (other && bevel.reflection > 0) {
        const reflectedTone = otherClass === 'radiant' ? .78 : .65;
        color = mixRGB(color, other.ramp[Math.round(reflectedTone * (other.ramp.length - 1))], bevel.reflection);
      }
    }
    body.data[i] = color[0]; body.data[i + 1] = color[1]; body.data[i + 2] = color[2];
    if (q.owner > 0) paintedPixels[q.owner]++;
  }
  // A nominal three-pixel domain can consist entirely of protected eye/edge
  // colours. Report that honestly instead of claiming an invisible material.
  domains.budget.represented = domains.budget.represented.filter(owner => paintedPixels[owner] > 0);
  domains.budget.subpixel = [...new Set([...domains.budget.subpixel, ...paintedPixels.flatMap((count, owner) => count ? [] : [owner])])];
  return report;
}
