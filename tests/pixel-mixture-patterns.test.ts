import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { MixtureGeometryCache } from '../src/ui/pixel-mixture-cache';
import { allocateMixtureDomains, type MixtureDomains, type MixtureInterfacePattern } from '../src/ui/pixel-mixture-domains';

const patterns: MixtureInterfacePattern[] = ['flow', 'facet', 'fold', 'root', 'pulse'];
const box = { l: 1.25, t: 1.5, r: 53.75, b: 39.25 };
function fixture(kind = 'solid'): Pix {
  const p = new Pix(57, 43);
  for (let y = 3; y < 39; y++) for (let x = 3; x < 53; x++) {
    if (kind === 'ring' && Math.hypot(x - 28, y - 21) < 10) continue;
    if (kind === 'long' && (x < 40 ? y < 17 || y > 24 : Math.abs(y - 21) > (55 - x) * .6)) continue;
    if (kind === 'branched' && Math.abs(x - 28) > 6 && Math.abs(y - 20 - Math.abs(x - 28) * .5) > 6) continue;
    if (kind === 'split' && x >= 26 && x <= 30) continue;
    p.set(x, y, [128, 128, 128]);
  }
  return p;
}
function mirror(p: Pix): Pix {
  const result = new Pix(p.w, p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = (y * p.w + x) * 4;
    result.data.set(p.data.subarray(i, i + 4), (y * p.w + p.w - 1 - x) * 4);
  }
  return result;
}
function paths(d: MixtureDomains, owner: number): number[][] {
  const seen = new Set<number>(), components: number[][] = [];
  for (let i = 0; i < d.owner.length; i++) if (d.owner[i] === owner && !seen.has(i)) {
    const queue = [i]; seen.add(i);
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head], x = p % d.width, y = Math.floor(p / d.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= d.width || y + dy < 0 || y + dy >= d.height) continue;
        const n = p + dy * d.width + dx;
        if (d.owner[n] === owner && !seen.has(n)) { seen.add(n); queue.push(n); }
      }
    }
    components.push(queue);
  }
  return components;
}
function state(d: MixtureDomains): string {
  const samples = Array.from({ length: d.owner.length }, (_, i) => d.sampleAt(d.bounds.l + i % d.width, d.bounds.t + Math.floor(i / d.width)));
  return JSON.stringify([d, samples]);
}

describe('stable interlocking material interfaces', () => {
  it.each(patterns)('%s retains coherent budgets, dominance and occupied topology', interfacePattern => {
    for (const kind of ['solid', 'ring', 'long', 'branched', 'split']) for (const count of [2, 4, 16]) {
      const p = fixture(kind), original = p.data.slice();
      const d = allocateMixtureDomains(p, box, count, { interfacePattern });
      expect(d.budget.subpixel, `${kind}:${count}`).toEqual([]);
      expect(d.regions.reduce((sum, region) => sum + region.pixelCount, 0)).toBe(d.safePixelCount);
      expect(d.regions[0].pixelCount).toBeGreaterThanOrEqual(Math.max(...d.regions.map(r => r.pixelCount)));
      for (const r of d.regions) {
        expect(r.pixelCount, `${kind}:${count}:${r.owner}`).toBeGreaterThanOrEqual(d.budget.minimumRegionPixels);
        expect(paths(d, r.owner).length, `${kind}:${count}:${r.owner}`).toBe(r.components);
        expect(d.ownerAt(r.seed!.x, r.seed!.y), `${kind}:${count}:${r.owner} seed`).toBe(r.owner);
        // Weighted ownership distances must not escape into native spans.
        expect(r.length).toBeLessThan(r.pixelCount);
      }
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (d.ownerAt(x, y) >= 0) {
        expect(p.data[(y * p.w + x) * 4 + 3]).toBe(255);
        const sample = d.sampleAt(x, y)!;
        for (const v of [sample.along, sample.across]) expect(v >= 0 && v <= 1).toBe(true);
      }
      expect(p.data).toEqual(original);
    }
  });

  it.each(patterns)('%s mirrors regions and stable anchors in authored coordinates', interfacePattern => {
    for (const kind of ['solid', 'ring', 'long', 'branched']) {
      const p = fixture(kind), other = mirror(p), preferredSeeds = [null, { x: 48.25, y: 31.5 }, { x: 10.75, y: 8.25 }, { x: 45.5, y: 8.5 }];
      const a = allocateMixtureDomains(p, box, 4, { interfacePattern, preferredSeeds });
      const b = allocateMixtureDomains(other, { ...box, l: p.w - 1 - box.r, r: p.w - 1 - box.l }, 4, {
        reverse: true, interfacePattern,
        preferredSeeds: preferredSeeds.map(point => point && ({ x: p.w - 1 - point.x, y: point.y }))
      });
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        expect(b.ownerAt(p.w - 1 - x, y), `${kind}:${x},${y}`).toBe(a.ownerAt(x, y));
        const sa = a.sampleAt(x, y), sb = b.sampleAt(p.w - 1 - x, y);
        if (!sa || !sb) continue;
        expect(sb.contactOwner).toBe(sa.contactOwner); expect(sb.contactDistance).toBe(sa.contactDistance);
        expect(sb.along).toBeCloseTo(sa.along, 7);
        expect(!!sb.contact).toBe(!!sa.contact);
        if (sa.contact && sb.contact) for (const key of ['u', 'v', 'nx', 'ny'] as const) {
          expect(sb.contact[key], `${kind}:${x},${y} contact ${key}`).toBeCloseTo(sa.contact[key], 7);
        }
      }
      expect(b.regions.map(r => r.pixelCount)).toEqual(a.regions.map(r => r.pixelCount));
    }
  });

  it('changes broad material interfaces while preserving exact omitted, invalid and tiny allocations', () => {
    const p = fixture(), baseline = allocateMixtureDomains(p, box, 4);
    const owners = patterns.map(interfacePattern => {
      const d = allocateMixtureDomains(p, box, 4, { interfacePattern });
      expect(d.owner.filter((owner, i) => owner !== baseline.owner[i]).length).toBeGreaterThan(d.safePixelCount * .1);
      return Array.from(d.owner).join(',');
    });
    expect(new Set(owners).size).toBe(patterns.length);
    for (const invalid of ['', 'noise', null, 17, {}, NaN]) {
      expect(state(allocateMixtureDomains(p, box, 4, { interfacePattern: invalid as MixtureInterfacePattern }))).toBe(state(baseline));
    }
    const tiny = new Pix(12, 12); tiny.line(2, 5, 9, 5, [128, 128, 128]);
    const tinyBox = { l: 0, t: 0, r: 11, b: 11 }, small = state(allocateMixtureDomains(tiny, tinyBox, 16));
    for (const interfacePattern of patterns) expect(state(allocateMixtureDomains(tiny, tinyBox, 16, { interfacePattern }))).toBe(small);
  });

  it.each(patterns)('%s never traverses transparent holes, semantic cuts or authored highlights', interfacePattern => {
    const p = fixture('ring'), protectedPixels = new Uint8Array(p.w * p.h);
    for (let y = 10; y <= 32; y++) protectedPixels[y * p.w + 45] = 1;
    p.set(43, 23, [0, 0, 0]); p.set(43, 24, [250, 250, 250]);
    const d = allocateMixtureDomains(p, box, 4, { interfacePattern, protectedPixels,
      authoredRamp: [[0, 0, 0], [128, 128, 128], [250, 250, 250]] });
    expect(d.shape).toBe('hollow'); expect(d.ownerAt(28, 21)).toBe(-1);
    expect(d.ownerAt(43, 23)).toBe(-1); expect(d.ownerAt(43, 24)).toBe(-1);
    for (let y = 10; y <= 32; y++) expect(d.ownerAt(45, y)).toBe(-1);
    for (const r of d.regions.filter(r => r.pixelCount)) expect(paths(d, r.owner).length).toBe(r.components);
  });

  it.each(patterns)('%s reports progress and contact distance in actual pixel steps', interfacePattern => {
    for (const kind of ['ring', 'long']) {
      const d = allocateMixtureDomains(fixture(kind), box, 4, { interfacePattern });
      for (let y = d.bounds.t; y <= d.bounds.b; y++) for (let x = d.bounds.l; x <= d.bounds.r; x++) {
        const sample = d.sampleAt(x, y);
        if (!sample) continue;
        const progress = sample.along * d.regions[sample.owner].length;
        expect(Math.abs(progress - Math.round(progress))).toBeLessThan(.0001);
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const next = d.sampleAt(x + dx, y + dy);
          if (!next || next.owner !== sample.owner) continue;
          expect(Math.abs(sample.along - next.along) * d.regions[sample.owner].length).toBeLessThan(1.0001);
          if (Number.isFinite(sample.contactDistance) && Number.isFinite(next.contactDistance)) {
            expect(Math.abs(sample.contactDistance - next.contactDistance)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('keys pattern geometry independently of palettes and repeated animation phases', () => {
    const p = fixture(), cache = new MixtureGeometryCache(6, p.w * p.h * 6);
    const expected = new Map(patterns.map(interfacePattern => [interfacePattern, state(cache.allocate(p, box, 4, { interfacePattern }))]));
    expect(cache.size).toBe(5);
    for (let frame = 7; frame >= 0; frame--) for (const interfacePattern of patterns.slice().reverse()) {
      for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) p.data.set([20 + frame * 30, 230 - frame * 20, frame * 20], i);
      const d = cache.allocate(p, box, 4, { interfacePattern });
      expect(state(d)).toBe(expected.get(interfacePattern));
      expect(state(d)).toBe(state(allocateMixtureDomains(fixture(), box, 4, { interfacePattern, preserveHighlights: false })));
      d.owner.fill(15); d.regions[0].seed!.x = -999;
    }
    const plain = state(cache.allocate(p, box, 4));
    expect(state(cache.allocate(p, box, 4, { interfacePattern: 'invalid' as MixtureInterfacePattern }))).toBe(plain);
    expect(cache.size).toBe(6); expect(cache.pixelCount).toBe(p.w * p.h * 6);
  });
});
