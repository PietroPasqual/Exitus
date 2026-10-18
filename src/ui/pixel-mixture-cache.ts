import { Pix, type RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';
import { allocateMixtureDomains, type MixtureBounds, type MixtureDomains, type MixtureDomainOptions } from './pixel-mixture-domains';

export interface MixtureGeometryOptions {
  reverse?: boolean;
  form?: string;
  surfaceBounds?: MixtureBounds;
  preferredSeeds?: MixtureDomainOptions['preferredSeeds'];
  interfacePattern?: MixtureDomainOptions['interfacePattern'];
  /** Original authored palette. Dark cuts and peak highlights on the stable
   * ownership body cannot seed or consume a constituent's paint budget. */
  authoredMarks?: readonly RGB[];
}

/**
 * Cached ownership is private. Returned reports can be annotated or edited
 * without changing a later render, including their arrays and nested regions.
 * The allocator's sampling closures only read its unexposed original geometry.
 */
function copyDomains(domains: MixtureDomains): MixtureDomains {
  return {
    ...domains,
    bounds: { ...domains.bounds },
    owner: domains.owner.slice(),
    contactOwner: domains.contactOwner.slice(),
    contactDistance: domains.contactDistance.slice(),
    edgeDistance: domains.edgeDistance.slice(),
    regions: domains.regions.map(region => ({
      ...region, bounds: { ...region.bounds }, seed: region.seed && { ...region.seed },
      axis: { ...region.axis }, ...(region.contact && { contact: { ...region.contact } })
    })),
    budget: { ...domains.budget, represented: [...domains.budget.represented], subpixel: [...domains.budget.subpixel] }
  };
}

/**
 * Occupied reference geometry and optional authored marks affect allocation,
 * never an animated palette or phase. Marks are evaluated on the stable
 * ownership body, not the body's current reflection colours.
 * Include the one-pixel halo used by erosion, exact absolute bounds and every
 * geometry option. The exact occupancy string has no hash collision risk and
 * catches edits to a reused Pix. Absolute coordinates avoid translation drift
 * in floating-point principal axes and shape-following coordinates.
 */
export class MixtureGeometryCache {
  private readonly entries: BoundedPixelCache<MixtureDomains>;

  constructor(maxEntries = 16, maxPixels = 262144) {
    this.entries = new BoundedPixelCache(maxEntries, maxPixels);
  }

  get size(): number { return this.entries.size; }
  get pixelCount(): number { return this.entries.pixelCount; }
  clear(): void { this.entries.clear(); }

  allocate(body: Pix, bounds: MixtureBounds, materialCount: number,
    options: MixtureGeometryOptions = {}, ownership: Pix = body): MixtureDomains {
    const l = Math.max(0, Math.floor(bounds.l) - 1), t = Math.max(0, Math.floor(bounds.t) - 1);
    const r = Math.min(body.w - 1, Math.ceil(bounds.r) + 1), b = Math.min(body.h - 1, Math.ceil(bounds.b) + 1);
    const surface = options.surfaceBounds;
    const interfacePattern = typeof options.interfacePattern === 'string' &&
      ['flow', 'facet', 'fold', 'root', 'pulse'].includes(options.interfacePattern) ? options.interfacePattern : undefined;
    const marks = options.authoredMarks?.length ? options.authoredMarks : undefined;
    const first = marks?.[0], peak = marks?.[marks.length - 1];
    const luma = (r: number, g: number, b: number): number => r * .2126 + g * .7152 + b * .0722;
    const low = first ? luma(...first) : -Infinity, high = peak ? luma(...peak) : Infinity;
    const protectedAt = (i: number): boolean => {
      const r = ownership.data[i], g = ownership.data[i + 1], b = ownership.data[i + 2];
      const light = luma(r, g, b);
      return Math.max(r, g, b) < 22 || light <= low + 1 || light >= high - 1 ||
        !!first && Math.max(Math.abs(r - first[0]), Math.abs(g - first[1]), Math.abs(b - first[2])) <= 5 ||
        !!peak && Math.max(Math.abs(r - peak[0]), Math.abs(g - peak[1]), Math.abs(b - peak[2])) <= 5;
    };
    // Preserve exact fractional anchors and distinguish non-finite inputs.
    // No reference to caller-owned points is retained by the cached geometry.
    const coordinate = (n: number): number | string => Number.isFinite(n) ? n : String(n);
    const seeds = options.preferredSeeds?.map(point => point ? [coordinate(point.x), coordinate(point.y)] : null);
    let key = JSON.stringify([body.w, body.h, bounds.l, bounds.t, bounds.r, bounds.b, materialCount,
      !!options.reverse, options.form ?? '', surface && [surface.l, surface.t, surface.r, surface.b], seeds,
      interfacePattern]) + ':';
    // Keep the original one-bit key when marks are omitted. Authored geometry
    // has two independent bits per pixel: occupied and protected. The exact
    // mask, not the palette itself, determines whether geometry can be reused.
    if (marks) key += 'marks:';
    let bits = 0, bit = 0;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const i = (y * body.w + x) * 4;
      if (ownership.data[i + 3]) {
        bits |= 1 << bit;
        if (marks && protectedAt(i)) bits |= 2 << bit;
      }
      bit += marks ? 2 : 1;
      if (bit === 16) { key += String.fromCharCode(bits); bits = 0; bit = 0; }
    }
    if (bit) key += String.fromCharCode(bits);
    let domains = this.entries.get(key);
    if (!domains) {
      const geometry = new Pix(body.w, body.h);
      const protectedPixels = marks ? new Uint8Array(body.w * body.h) : undefined;
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        const i = (y * body.w + x) * 4;
        if (ownership.data[i + 3]) {
          geometry.data[i] = 128; geometry.data[i + 1] = 128; geometry.data[i + 2] = 128;
          geometry.data[i + 3] = ownership.data[i + 3];
          if (protectedPixels && protectedAt(i)) protectedPixels[i / 4] = 1;
        }
      }
      domains = allocateMixtureDomains(geometry, bounds, materialCount, {
        reverse: options.reverse, form: options.form, surfaceBounds: surface, preferredSeeds: options.preferredSeeds,
        interfacePattern, protectedPixels,
        preserveHighlights: false
      });
      // Charge the whole backing raster, not just its occupied local envelope.
      this.entries.set(key, domains, body.w * body.h);
    }
    return copyDomains(domains);
  }
}
