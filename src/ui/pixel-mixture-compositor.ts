import type { MaterialFusionGroup } from '../core/appearance';
import { clamp01, mixRGB, Pix, type RGB } from './pixel';
import type { MixtureBounds, MixtureDomains } from './pixel-mixture-domains';
import { MixtureGeometryCache } from './pixel-mixture-cache';
import { insideMaterialInterface, materialContactFinish, materialInterfaceAnchors, materialInterfacePattern, sharedContactPulse } from './pixel-mixture-contact';
import { isBodyMaterial, MATERIAL_SIGNATURES, sampleMaterialSignature } from './pixel-mixture-signatures';

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
// Mirrored fractions such as 1 - 2/3 can land on opposite sides of a palette
// threshold. Canonical surface coordinates keep returned artwork identical.
const canonical = (n: number): number => Math.round(n * 1e9) / 1e9;

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
  const interfacePattern = materialInterfacePattern(materials.map(m => m.element));
  // An authored object or word contains marks that cannot carry a material.
  // Reserve space using the stable reference's actual ink, so an entire small
  // constituent is not assigned to an eye, cut, letter highlight or empty rail.
  // Plain elemental volumes retain their deliberately dark interior tones.
  const authoredMarks = options.form && options.form !== 'esfera' && !options.form.startsWith('forma_') ? authored : undefined;
  const domains = geometryCache.allocate(body, bounds, materials.length,
    { ...options, preferredSeeds, interfacePattern, authoredMarks }, options.ownershipBody ?? body);
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
    const fused = !!other && !!options.materialFusion?.some(group => group.elements.includes(material.element) && group.elements.includes(other.element));
    // Advect a boundary gesture along the actual region. The same clock and
    // local orientation as the authored sprite also hold for returned lances.
    const globalU = (x - l) / Math.max(1, r - l), globalV = (y - t) / Math.max(1, b - t);
    const surfaceU = canonical(options.reverse ? 1 - globalU : globalU);
    const surfaceV = canonical(globalV);
    // The two sides light the midpoint of their actual touching pixels. A
    // region-local seed must not give water and stone unrelated pulse phases.
    const contactU = canonical(q.contactDistance === 0 && q.contact
      ? surfaceU - Math.sign(q.contact.nx) * .5 / Math.max(1, r - l) : surfaceU);
    const contactV = canonical(q.contactDistance === 0 && q.contact
      ? surfaceV - Math.sign(q.contact.ny) * .5 / Math.max(1, b - t) : surfaceV);
    const pulse = sharedContactPulse(contactU, contactV, frame);
    const detailed = region.pixelCount >= 36 && region.width >= 4;
    const facing = q.contact ? clamp01(.5 - q.contact.nx * .3 - q.contact.ny * .4) : .5;
    const response = materialContactFinish(material.element,
      other && isBodyMaterial(other.element) ? other.element : material.element,
      q.contactDistance, pulse, sharedContactPulse(contactU, contactV, frame - 1), detailed, fused, facing);
    // Reflecting the major axis reverses its perpendicular coordinate too.
    // Undo that handedness so a returned ring/blade keeps the same material
    // ridge and contact illumination instead of moving them to its far face.
    let u = canonical(alongShape ? q.along : q.u), v = canonical(alongShape ? (options.reverse ? 1 - q.across : q.across) : q.v);
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
    const contact = q.contact && { ...q.contact, u: canonical(q.contact.u), v: canonical(q.contact.v) };
    const sampled = sampleMaterialSignature({ element: material.element, ramp: material.ramp, u: canonical(u), v: canonical(v),
      illumination, frame, seed: seed + q.owner * 23,
      scale: { width: alongShape ? region.length : region.bounds.r - region.bounds.l + 1,
        height: alongShape ? region.width : region.bounds.b - region.bounds.t + 1, pixels: region.pixelCount },
      contact: alongShape ? undefined : contact });
    if (!sampled) continue;
    // Primary authored anatomy remains the dominant drawing. Only a strong
    // material ridge or actual contact can replace it; secondary faces own
    // their brightness and do not vanish under a dark primary's luminance.
    // Keep the broad modelling of an authored wing, armour plate or blade.
    // Strong signature marks stay crisp; a secondary owns its own luminance.
    const relief = q.owner === 0 ? (domains.shape === 'plane' || domains.shape === 'branched' ? .24 : .14) : .065;
    const baseTone = clamp01(sampled.tone + (illumination - .5) * relief * (1 - sampled.strength * .65));
    let color = material.ramp[Math.round(baseTone * (material.ramp.length - 1))];
    if (q.contactDistance <= 2) {
      const tone = clamp01(baseTone + response.lift);
      color = material.ramp[Math.round(tone * (material.ramp.length - 1))];
      // Reflection is restricted to the touching lip, never a global palette
      // average. A local pulse leaves both parent materials recognizable.
      if (other && response.reflection > 0) {
        const reflection = Math.floor(response.reflection * 16) / 16;
        color = mixRGB(color, other.ramp[Math.round(response.reflectedTone * (other.ramp.length - 1))], reflection);
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
