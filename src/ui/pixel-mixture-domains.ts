import type { Pix, RGB } from './pixel';

export interface MixtureBounds { l: number; t: number; r: number; b: number }
export type MixtureShape = 'compact' | 'plane' | 'long' | 'hollow' | 'branched' | 'stroke';
export type MixtureDetail = 'surface' | 'compact' | 'stroke' | 'subpixel';

export interface MixtureDomainOptions {
  reverse?: boolean;
  form?: string;
  /** Absolute scene coordinates by owner, already mirrored by the caller.
   * Owner 0 keeps its centre seed. Invalid/collapsed preferences use the
   * deterministic spread; infeasible preferences yield to the pixel budget. */
  preferredSeeds?: readonly ({ x: number; y: number } | null | undefined)[];
  /** Stable authored envelope. It does not authorize painting outside bounds. */
  surfaceBounds?: MixtureBounds;
  authoredRamp?: readonly RGB[];
  /** Body-sized, one byte per pixel. A nonzero entry is never owned or traversed. */
  protectedPixels?: ArrayLike<number>;
  /** Preserve authored peak highlights by default, including unlabelled eyes. */
  preserveHighlights?: boolean;
  /** Default true: recolour existing lit strokes only when erosion leaves no usable body. */
  allowThinStrokes?: boolean;
}

export interface MixtureContact {
  /** Nearest real shared edge, in this region's local coordinates. */
  u: number; v: number;
  /** Unit normal pointing from the other material into this one. */
  nx: number; ny: number;
}

export interface MixtureRegion {
  owner: number;
  pixelCount: number;
  bounds: MixtureBounds;
  seed: { x: number; y: number } | null;
  detail: MixtureDetail;
  /** Number of separate authored safe components, never bridges through holes. */
  components: number;
  /** Unit major axis in authored orientation; useful for long material ridges. */
  axis: { x: number; y: number };
  /** Geodesic span and cross-axis span, in native pixels (both at least one). */
  length: number;
  width: number;
  contact?: MixtureContact;
}

export interface MixtureDomainSample {
  owner: number;
  /** Bounding-box local coordinates, normalized and mirrored with the artwork. */
  u: number; v: number;
  /** Shape-following distance and cross-axis position, both normalized. */
  along: number; across: number;
  /** Nearest other actual region, or -1 if this component has no contact. */
  contactOwner: number;
  /** Graph distance in native pixels, or Infinity if no contact exists. */
  contactDistance: number;
  edgeDistance: number;
  contact?: MixtureContact;
}

export interface MixtureDomains {
  bounds: MixtureBounds;
  width: number;
  height: number;
  shape: MixtureShape;
  /** Arrays use (y - bounds.t) * width + x - bounds.l, not body indices. */
  owner: Int16Array;
  contactOwner: Int16Array;
  contactDistance: Uint16Array;
  edgeDistance: Uint16Array;
  regions: readonly MixtureRegion[];
  safePixelCount: number;
  /** Explicit budget report: no temporal cycling or repeated-index overwrite. */
  budget: { minimumRegionPixels: number; represented: number[]; subpixel: number[]; thinStrokes: boolean };
  ownerAt(x: number, y: number): number;
  sampleAt(x: number, y: number): MixtureDomainSample | null;
}

const NONE = 65535;
const MAX_MATERIALS = 16;
const luma = (r: number, g: number, b: number): number => r * .2126 + g * .7152 + b * .0722;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const validBounds = (b: MixtureBounds): boolean => [b.l, b.t, b.r, b.b].every(Number.isFinite) && b.r >= b.l && b.b >= b.t;

/**
 * Connected graph Voronoi cells on the existing body, not stripes in a box.
 * Seeds are spread by occupied-pixel distance. A single additive primary bias
 * enlarges the first material while retaining a connected minimum-sized cell
 * for every representable secondary. A common graph metric (not per-material
 * growth speeds) is important: it keeps shortest paths inside their own cells.
 *
 * No phase, palette animation, random row windows, persistent cache or mutation.
 * Cost is O(K * P + P log P), K <= 16, P = clipped body envelope;
 * memory is O(K * P), released after this allocation.
 * Independent safe components are never joined across an eye, cut or hole.
 */
export function allocateMixtureDomains(
  body: Pix, bounds: MixtureBounds, materialCount: number, options: MixtureDomainOptions = {}
): MixtureDomains {
  const count = Number.isFinite(materialCount) ? Math.max(0, Math.min(MAX_MATERIALS, Math.floor(materialCount))) : 0;
  const box: MixtureBounds = validBounds(bounds)
    ? { l: Math.max(0, Math.ceil(bounds.l)), t: Math.max(0, Math.ceil(bounds.t)), r: Math.min(body.w - 1, Math.floor(bounds.r)), b: Math.min(body.h - 1, Math.floor(bounds.b)) }
    : { l: 0, t: 0, r: -1, b: -1 };
  const width = Math.max(0, box.r - box.l + 1), height = Math.max(0, box.b - box.t + 1), area = width * height;
  const owner = new Int16Array(area).fill(-1), contactOwner = new Int16Array(area).fill(-1);
  const contactDistance = new Uint16Array(area).fill(NONE), edgeDistance = new Uint16Array(area);
  const contactAt = new Int32Array(area).fill(-1), contactAcross = new Int32Array(area).fill(-1);
  const along = new Float32Array(area), across = new Float32Array(area);
  const mask = new Uint8Array(area), raw = new Uint8Array(area), opaque = new Uint8Array(area);
  const reverse = !!options.reverse;
  const xAt = (i: number): number => box.l + i % width;
  const yAt = (i: number): number => box.t + Math.floor(i / width);
  const order = (i: number): number => Math.floor(i / width) * width + (reverse ? width - 1 - i % width : i % width);
  const regions: MixtureRegion[] = Array.from({ length: count }, (_, i) => ({
    owner: i, pixelCount: 0, bounds: { l: 0, t: 0, r: -1, b: -1 }, seed: null,
    detail: 'subpixel', components: 0, axis: { x: reverse ? -1 : 1, y: 0 }, length: 1, width: 1
  }));

  // Native pixel art uses diagonal attachments. All paths remain on occupied
  // safe pixels, including a one-pixel diagonal glyph; nothing crosses a gap.
  const firstNeighbour = reverse ? 1 : -1;
  const neighbours = (i: number, visit: (j: number) => void): void => {
    const x = i % width;
    const before = reverse ? x < width - 1 : x > 0;
    const after = reverse ? x > 0 : x < width - 1;
    // Preserve the original row-major (or mirrored row-major) visit order:
    // queue tie-breaks are visible in ownership and contact orientation.
    if (i >= width) {
      if (before) visit(i - width + firstNeighbour);
      visit(i - width);
      if (after) visit(i - width - firstNeighbour);
    }
    if (before) visit(i + firstNeighbour);
    if (after) visit(i - firstNeighbour);
    if (i < area - width) {
      if (before) visit(i + width + firstNeighbour);
      visit(i + width);
      if (after) visit(i + width - firstNeighbour);
    }
  };
  const near = (i: number, c: RGB): boolean => Math.max(Math.abs(body.data[i] - c[0]), Math.abs(body.data[i + 1] - c[1]), Math.abs(body.data[i + 2] - c[2])) <= 5;
  const ramp = options.authoredRamp, first = ramp?.[0], peak = ramp?.[ramp.length - 1];
  const low = first ? luma(...first) : 0, high = peak ? luma(...peak) : 256;
  let rawCount = 0, interiorCount = 0;
  for (let i = 0; i < area; i++) {
    const x = xAt(i), y = yAt(i), bi = y * body.w + x, p = bi * 4;
    if (!body.data[p + 3]) continue;
    opaque[i] = 1;
    const light = luma(body.data[p], body.data[p + 1], body.data[p + 2]);
    if (options.protectedPixels?.[bi] || Math.max(body.data[p], body.data[p + 1], body.data[p + 2]) < 22 || light <= low + 1 || (first && near(p, first))) continue;
    if (options.preserveHighlights !== false && peak && (light >= high - 1 || near(p, peak))) continue;
    raw[i] = 1; rawCount++;
    let interior = true;
    for (let dy = -1; dy <= 1 && interior; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= body.w || y + dy >= body.h || !body.data[((y + dy) * body.w + x + dx) * 4 + 3]) { interior = false; break; }
    }
    if (interior) { mask[i] = 1; interiorCount++; }
  }
  // Below this budget, eroding a lit stroke removes the object itself. The
  // fallback admits existing coloured pixels, never its dark contour or alpha.
  const thinStrokes = options.allowThinStrokes !== false && interiorCount < Math.min(12, rawCount * .22);
  if (thinStrokes) mask.set(raw);
  const safePixelCount = thinStrokes ? rawCount : interiorCount;
  const minimum = safePixelCount >= Math.max(64, count * 12) ? 8 : safePixelCount >= count * 6 ? 4 : 2;

  const components: number[][] = [], componentOf = new Int32Array(area).fill(-1), queue = new Int32Array(area);
  for (let i = 0; i < area; i++) if (mask[i] && componentOf[i] < 0) {
    const component: number[] = [], id = components.length;
    let head = 0, tail = 0; queue[tail++] = i; componentOf[i] = id;
    while (head < tail) {
      const p = queue[head++]; component.push(p);
      neighbours(p, n => { if (mask[n] && componentOf[n] < 0) { componentOf[n] = id; queue[tail++] = n; } });
    }
    components.push(component);
  }
  // Distance from an actual safe-domain edge, in pixels; used for thick seeds.
  let head = 0, tail = 0;
  for (let i = 0; i < area; i++) if (mask[i]) {
    const x = i % width, y = Math.floor(i / width);
    let boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    neighbours(i, n => { if (!mask[n]) boundary = true; });
    if (boundary) { edgeDistance[i] = 1; queue[tail++] = i; }
  }
  while (head < tail) {
    const p = queue[head++];
    neighbours(p, n => { if (mask[n] && !edgeDistance[n]) { edgeDistance[n] = Math.min(NONE - 1, edgeDistance[p] + 1); queue[tail++] = n; } });
  }

  const walk = (seed: number, onlyOwner = -1): Int32Array => {
    const dist = new Int32Array(area).fill(-1);
    let h = 0, t = 0; queue[t++] = seed; dist[seed] = 0;
    while (h < t) {
      const p = queue[h++];
      neighbours(p, n => { if (mask[n] && dist[n] < 0 && (onlyOwner < 0 || owner[n] === onlyOwner)) { dist[n] = dist[p] + 1; queue[t++] = n; } });
    }
    return dist;
  };
  const ranked = components.map((pixels, id) => ({ pixels, id, slots: 1, capacity: Math.max(1, Math.floor(pixels.length / minimum)) }))
    .sort((a, b) => b.pixels.length - a.pixels.length || order(a.pixels[0]) - order(b.pixels[0]));
  const assignments = ranked.map(() => [0]);
  let wholeComponentPixels = 0;
  // Later materials receive their own connected cell in one substantial
  // component. Tiny detached highlights are not selected as material tokens.
  for (let k = 1; k < count; k++) {
    let selected = -1, best = -1, whole = false;
    for (let c = 0; c < ranked.length; c++) {
      const q = ranked[c];
      if (q.slots < q.capacity) {
        const room = q.pixels.length / (q.slots + 1);
        if (room > best) { best = room; selected = c; whole = false; }
      }
      // A chain link or separate rigid plane can be a whole coherent domain.
      // Reserving a primary seed in every such component would hide later
      // materials despite ample total pixels. Keep a global primary reserve.
      if (c > 0 && assignments[c].length === 1 && assignments[c][0] === 0 && q.pixels.length >= minimum && q.pixels.length <= safePixelCount / (count + 1) &&
        wholeComponentPixels + q.pixels.length <= safePixelCount * .4 && q.pixels.length * .75 > best) {
        best = q.pixels.length * .75; selected = c; whole = true;
      }
    }
    if (selected < 0) break;
    if (whole) {
      assignments[selected] = [k]; ranked[selected].slots = ranked[selected].capacity;
      wholeComponentPixels += ranked[selected].pixels.length;
    } else { ranked[selected].slots++; assignments[selected].push(k); }
  }

  for (let c = 0; c < ranked.length && count; c++) {
    const pixels = ranked[c].pixels, ids = assignments[c];
    let mx = 0, my = 0;
    for (const p of pixels) { mx += xAt(p); my += yAt(p); }
    mx /= pixels.length; my /= pixels.length;
    let seed = pixels[0], best = Infinity;
    for (const p of pixels) {
      const cost = (xAt(p) - mx) ** 2 + (yAt(p) - my) ** 2 - edgeDistance[p] * .3;
      if (cost < best || (cost === best && order(p) < order(seed))) { best = cost; seed = p; }
    }
    // Preferences never select an isolated ornament or cross a protected cut:
    // assignment above already chose the substantial connected component.
    const preferred = (id: number, used: readonly number[]): number => {
      const point = options.preferredSeeds?.[id];
      if (!id || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return -1;
      let nearest = -1, distance = Infinity;
      for (const p of pixels) {
        const d = Math.hypot(xAt(p) - point.x, yAt(p) - point.y);
        if (d < distance || (d === distance && (nearest < 0 || order(p) < order(nearest)))) { nearest = p; distance = d; }
      }
      // A coincident anchor does not manufacture an adjacent one-pixel token.
      return nearest < 0 || used.includes(nearest) ? -1 : nearest;
    };
    // At most one bounded retry: if the anchors cannot retain a coherent
    // minimum cell and primary dominance, use the original deterministic spread.
    for (let attempt = 0; attempt < 2; attempt++) {
      const firstPreference = attempt === 0 ? preferred(ids[0], []) : -1;
      const seeds = [firstPreference < 0 ? seed : firstPreference], distances = [walk(seeds[0])];
      let anchored = firstPreference >= 0;
      while (seeds.length < ids.length) {
        let next = attempt === 0 ? preferred(ids[seeds.length], seeds) : -1;
        if (next >= 0) anchored = true;
        else {
          let far = -1; next = pixels[0];
          for (const p of pixels) {
            let d = Infinity;
            for (const dist of distances) d = Math.min(d, dist[p]);
            // A thicker native patch wins nearby ties; long tips still qualify.
            const score = d + Math.min(3, edgeDistance[p]) * .32;
            if (score > far || (score === far && order(p) < order(next))) { far = score; next = p; }
          }
        }
        seeds.push(next); distances.push(walk(next));
      }
      const secondary = new Int16Array(area).fill(-1), margin = new Int32Array(area);
      const margins: number[][] = ids.map(() => []);
      for (const p of pixels) {
        let closest = -1, d = Infinity;
        for (let k = 1; k < ids.length; k++) if (distances[k][p] < d) { closest = k; d = distances[k][p]; }
        secondary[p] = closest;
        margin[p] = closest < 0 ? -area : distances[0][p] - d;
        if (closest >= 0) margins[closest].push(margin[p]);
      }
      // Additive bias preserves connected Voronoi cells. Limit it independently
      // for every constituent so a later ice/metal cell cannot disappear.
      let cap = area;
      for (let k = 1; k < ids.length; k++) {
        margins[k].sort((a, b) => b - a);
        cap = Math.min(cap, (margins[k][Math.min(minimum, margins[k].length) - 1] ?? 0) - 1);
      }
      const target = Math.ceil(pixels.length * (ids.length === 2 ? .61 : .5));
      const sorted = pixels.map(p => margin[p]).sort((a, b) => a - b);
      const upper = sorted[Math.min(target - 1, sorted.length - 1)];
      const lowerCount = sorted.findIndex(value => value >= upper);
      const after = sorted.findIndex(value => value > upper), upperCount = after < 0 ? pixels.length : after;
      // Distances are integer pixels: a whole diagonal may share a threshold.
      // Choose the closer side of that step, rather than systematically giving
      // the whole diagonal to the primary and inflating its intended area.
      const threshold = target - lowerCount < upperCount - target ? upper - 1 : upper;
      let bias = ids.length === 1 ? area : Math.min(cap, threshold);
      if (anchored && ids[0] === 0) {
        const dominantAt = (value: number): boolean => {
          const sizes = ids.map(() => 0);
          for (const p of pixels) sizes[secondary[p] < 0 || margin[p] <= value ? 0 : secondary[p]]++;
          return sizes.every(n => n <= sizes[0]);
        };
        if (!dominantAt(bias)) {
          if (!dominantAt(cap)) continue;
          // Increase the same additive bias only as far as needed, without
          // shrinking any anchored cell below its existing minimum budget.
          let lo = bias, hi = cap;
          while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (dominantAt(mid)) hi = mid; else lo = mid + 1; }
          bias = lo;
        }
      }
      for (const p of pixels) owner[p] = secondary[p] < 0 || margin[p] <= bias ? ids[0] : ids[secondary[p]];
      if (ids[0] === 0) {
        // Legacy unanchored allocation keeps its exact whole-cell fallback.
        // An explicit anatomical anchor is never exchanged for another cell.
        const sizes = ids.map(id => pixels.reduce((n, p) => n + Number(owner[p] === id), 0));
        let largest = 0;
        for (let k = 1; k < ids.length; k++) if (sizes[k] > sizes[largest]) largest = k;
        if (largest && !anchored) {
          const other = ids[largest];
          for (const p of pixels) if (owner[p] === 0) owner[p] = other; else if (owner[p] === other) owner[p] = 0;
          [seeds[0], seeds[largest]] = [seeds[largest], seeds[0]];
          [sizes[0], sizes[largest]] = [sizes[largest], sizes[0]];
        }
        // Do not claim a one-pixel fleck is a material signature. If the shape's
        // branches cannot sustain its nominal pixel budget, preserve the authored
        // base there and explicitly report this constituent as subpixel.
        for (let k = 1; k < ids.length; k++) if (sizes[k] < 2) for (const p of pixels) if (owner[p] === ids[k]) owner[p] = 0;
      }
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k];
        if (!regions[id].seed) regions[id].seed = { x: xAt(seeds[k]), y: yAt(seeds[k]) };
      }
      break;
    }
  }

  // Shape classification describes geometry only; it never infers a fusion.
  let holePixels = 0;
  const exterior = new Uint8Array(area); head = 0; tail = 0;
  for (let i = 0; i < area; i++) if (!opaque[i] && (i < width || i >= area - width || i % width === 0 || i % width === width - 1)) {
    exterior[i] = 1; queue[tail++] = i;
  }
  while (head < tail) {
    const p = queue[head++], x = p % width, y = Math.floor(p / width);
    for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
      if (n >= 0 && !opaque[n] && !exterior[n]) { exterior[n] = 1; queue[tail++] = n; }
    }
  }
  for (let i = 0; i < area; i++) if (!opaque[i] && !exterior[i]) holePixels++;
  // One missing highlight pixel is not an annulus. A real opening must occupy
  // a material part of the envelope before signatures use arc coordinates.
  const hole = holePixels >= Math.max(4, area * .045);
  const surface = options.surfaceBounds && validBounds(options.surfaceBounds) ? options.surfaceBounds : box;
  const sw = surface.r - surface.l + 1, sh = surface.b - surface.t + 1;
  const shape: MixtureShape = thinStrokes ? 'stroke' : hole ? 'hollow' : Math.max(sw, sh) > Math.min(sw, sh) * 2.1 ? 'long'
    : /cubo|piramide|paralelepipedo|escudo|livro|parede|porta/.test(options.form ?? '') ? 'plane'
      : /dragao|animal|lobo|ave|aguia|arvore|criatura|golem/.test(options.form ?? '') || safePixelCount < area * .32 ? 'branched' : 'compact';

  const members: number[][] = regions.map(() => []);
  for (let i = 0; i < area; i++) if (owner[i] >= 0) members[owner[i]].push(i);
  for (let k = 0; k < count; k++) {
    const pixels = members[k], region = regions[k];
    if (!pixels.length) continue;
    const q = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    let mx = 0, my = 0;
    const seenComponents = new Set<number>();
    for (const p of pixels) {
      const x = xAt(p), y = yAt(p); q.l = Math.min(q.l, x); q.r = Math.max(q.r, x); q.t = Math.min(q.t, y); q.b = Math.max(q.b, y);
      mx += x; my += y; seenComponents.add(componentOf[p]);
    }
    mx /= pixels.length; my /= pixels.length;
    let xx = 0, xy = 0, yy = 0;
    for (const p of pixels) { const x = xAt(p) - mx, y = yAt(p) - my; xx += x * x; xy += x * y; yy += y * y; }
    const angle = .5 * Math.atan2(2 * xy, xx - yy);
    let ax = Math.cos(angle), ay = Math.sin(angle);
    if ((Math.abs(ax) >= Math.abs(ay) && ax * (reverse ? -1 : 1) < 0) || (Math.abs(ay) > Math.abs(ax) && ay < 0)) { ax = -ax; ay = -ay; }
    let lo = Infinity, hi = -Infinity, crossLo = Infinity, crossHi = -Infinity, endpoint = pixels[0];
    for (const p of pixels) {
      const a = xAt(p) * ax + yAt(p) * ay, b = -xAt(p) * ay + yAt(p) * ax;
      if (a < lo || (a === lo && order(p) < order(endpoint))) { lo = a; endpoint = p; }
      hi = Math.max(hi, a); crossLo = Math.min(crossLo, b); crossHi = Math.max(crossHi, b);
    }
    // Arc/stroke progress travels along the material itself, never across a hole.
    const dist = walk(endpoint, k);
    let length = 0;
    for (const p of pixels) length = Math.max(length, dist[p]);
    for (const p of pixels) {
      along[p] = dist[p] >= 0 ? dist[p] / Math.max(1, length) : clamp((xAt(p) * ax + yAt(p) * ay - lo) / Math.max(1, hi - lo));
      across[p] = clamp((-xAt(p) * ay + yAt(p) * ax - crossLo) / Math.max(1, crossHi - crossLo));
    }
    Object.assign(region, { pixelCount: pixels.length, bounds: q, components: seenComponents.size, axis: { x: ax, y: ay }, length: Math.max(1, length), width: Math.max(1, crossHi - crossLo), detail: thinStrokes ? 'stroke' : pixels.length >= 16 ? 'surface' : 'compact' });
  }

  // Multi-source contact distance propagates inside each region. A neighbouring
  // component across a dark seam is deliberately not a shared-surface contact.
  head = 0; tail = 0;
  for (let i = 0; i < area; i++) if (owner[i] >= 0) {
    let other = -1;
    neighbours(i, n => { if (owner[n] >= 0 && owner[n] !== owner[i] && (other < 0 || owner[n] < owner[other] || (owner[n] === owner[other] && order(n) < order(other)))) other = n; });
    if (other >= 0) { contactOwner[i] = owner[other]; contactDistance[i] = 0; contactAt[i] = i; contactAcross[i] = other; queue[tail++] = i; }
  }
  while (head < tail) {
    const p = queue[head++];
    neighbours(p, n => {
      if (owner[n] === owner[p] && contactDistance[n] === NONE) {
        contactOwner[n] = contactOwner[p]; contactDistance[n] = Math.min(NONE - 1, contactDistance[p] + 1);
        contactAt[n] = contactAt[p]; contactAcross[n] = contactAcross[p]; queue[tail++] = n;
      }
    });
  }
  const contactFor = (i: number): MixtureContact | undefined => {
    const at = contactAt[i], other = contactAcross[i];
    if (at < 0 || other < 0 || owner[i] < 0) return undefined;
    const q = regions[owner[i]].bounds, dx = xAt(at) - xAt(other), dy = yAt(at) - yAt(other), d = Math.hypot(dx, dy);
    const u = clamp(((xAt(at) + xAt(other)) * .5 - q.l) / Math.max(1, q.r - q.l));
    return { u: reverse ? 1 - u : u, v: clamp(((yAt(at) + yAt(other)) * .5 - q.t) / Math.max(1, q.b - q.t)), nx: dx / d * (reverse ? -1 : 1), ny: dy / d };
  };
  for (let k = 0; k < count; k++) {
    const touching = members[k].find(p => contactDistance[p] === 0);
    if (touching !== undefined) regions[k].contact = contactFor(touching);
  }
  const index = (x: number, y: number): number => Number.isInteger(x) && Number.isInteger(y) && x >= box.l && x <= box.r && y >= box.t && y <= box.b ? (y - box.t) * width + x - box.l : -1;
  return {
    bounds: box, width, height, shape, owner, contactOwner, contactDistance, edgeDistance, regions, safePixelCount,
    budget: { minimumRegionPixels: Math.min(minimum, ...regions.filter(r => r.pixelCount).map(r => r.pixelCount)), represented: regions.filter(r => r.pixelCount).map(r => r.owner), subpixel: regions.filter(r => !r.pixelCount).map(r => r.owner), thinStrokes },
    ownerAt(x, y) { const i = index(x, y); return i < 0 ? -1 : owner[i]; },
    sampleAt(x, y) {
      const i = index(x, y);
      if (i < 0 || owner[i] < 0) return null;
      const q = regions[owner[i]].bounds, u = clamp((x - q.l) / Math.max(1, q.r - q.l));
      return { owner: owner[i], u: reverse ? 1 - u : u, v: clamp((y - q.t) / Math.max(1, q.b - q.t)), along: along[i], across: across[i], contactOwner: contactOwner[i], contactDistance: contactDistance[i] === NONE ? Infinity : contactDistance[i], edgeDistance: edgeDistance[i], contact: contactFor(i) };
    }
  };
}
