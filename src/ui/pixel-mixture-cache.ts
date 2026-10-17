import { Pix } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';
import { allocateMixtureDomains, type MixtureBounds, type MixtureDomains, type MixtureDomainOptions } from './pixel-mixture-domains';

export interface MixtureGeometryOptions {
  reverse?: boolean;
  form?: string;
  surfaceBounds?: MixtureBounds;
  preferredSeeds?: MixtureDomainOptions['preferredSeeds'];
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
 * Only occupied reference geometry affects allocation, never palette or phase.
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
    // Preserve exact fractional anchors and distinguish non-finite inputs.
    // No reference to caller-owned points is retained by the cached geometry.
    const coordinate = (n: number): number | string => Number.isFinite(n) ? n : String(n);
    const seeds = options.preferredSeeds?.map(point => point ? [coordinate(point.x), coordinate(point.y)] : null);
    let key = JSON.stringify([body.w, body.h, bounds.l, bounds.t, bounds.r, bounds.b, materialCount,
      !!options.reverse, options.form ?? '', surface && [surface.l, surface.t, surface.r, surface.b], seeds]) + ':';
    // Pack 16 occupied flags into each character, preserving every bit.
    let bits = 0, bit = 0;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      if (ownership.data[(y * body.w + x) * 4 + 3]) bits |= 1 << bit;
      if (++bit === 16) { key += String.fromCharCode(bits); bits = 0; bit = 0; }
    }
    if (bit) key += String.fromCharCode(bits);
    let domains = this.entries.get(key);
    if (!domains) {
      const geometry = new Pix(body.w, body.h);
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
        const i = (y * body.w + x) * 4;
        if (ownership.data[i + 3]) {
          geometry.data[i] = 128; geometry.data[i + 1] = 128; geometry.data[i + 2] = 128;
          geometry.data[i + 3] = ownership.data[i + 3];
        }
      }
      domains = allocateMixtureDomains(geometry, bounds, materialCount, {
        reverse: options.reverse, form: options.form, surfaceBounds: surface, preferredSeeds: options.preferredSeeds,
        preserveHighlights: false
      });
      // Charge the whole backing raster, not just its occupied local envelope.
      this.entries.set(key, domains, body.w * body.h);
    }
    return copyDomains(domains);
  }
}
