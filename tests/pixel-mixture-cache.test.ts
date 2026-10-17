import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { BoundedPixelCache } from '../src/ui/pixel-bounded-cache';
import { MixtureGeometryCache } from '../src/ui/pixel-mixture-cache';
import { allocateMixtureDomains, type MixtureBounds, type MixtureDomains } from '../src/ui/pixel-mixture-domains';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS } from '../src/ui/pixel-mixture-signatures';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const bounds = { l: 4, t: 4, r: 35, b: 35 };
function shape(dx = 0, dy = 0): Pix {
  const p = new Pix(48, 48);
  p.shape(5 + dx, 5 + dy, 34 + dx, 34 + dy, (x, y) =>
    Math.hypot(x - 20 - dx, y - 20 - dy) < 15 ? [80, 125, 150] : null);
  return p;
}
function uncached(p: Pix, box: MixtureBounds, count: number, options = {}): MixtureDomains {
  const geometry = new Pix(p.w, p.h);
  for (let y = Math.max(0, Math.floor(box.t) - 1); y <= Math.min(p.h - 1, Math.ceil(box.b) + 1); y++)
    for (let x = Math.max(0, Math.floor(box.l) - 1); x <= Math.min(p.w - 1, Math.ceil(box.r) + 1); x++) {
      const i = (y * p.w + x) * 4;
      if (p.data[i + 3]) geometry.data.set([128, 128, 128, p.data[i + 3]], i);
    }
  return allocateMixtureDomains(geometry, box, count, { ...options, preserveHighlights: false });
}
function expectSame(a: MixtureDomains, b: MixtureDomains): void {
  const { ownerAt: _a, sampleAt: _as, ...aValues } = a;
  const { ownerAt: _b, sampleAt: _bs, ...bValues } = b;
  expect(aValues).toEqual(bValues);
  for (let y = a.bounds.t - 1; y <= a.bounds.b + 1; y++) for (let x = a.bounds.l - 1; x <= a.bounds.r + 1; x++) {
    expect(a.ownerAt(x, y)).toBe(b.ownerAt(x, y));
    expect(a.sampleAt(x, y)).toEqual(b.sampleAt(x, y));
  }
}

describe('bounded geometry caches', () => {
  it('evicts by least recent access, capacity and total backing-pixel cost', () => {
    const cache = new BoundedPixelCache<number>(2, 10);
    cache.set('a', 1, 4); cache.set('b', 2, 4);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3, 4);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(2); expect(cache.pixelCount).toBe(8);
    cache.set('d', 4, 9);
    expect(cache.size).toBe(1); expect(cache.pixelCount).toBe(9);
    cache.set('oversize', 5, 11);
    expect(cache.size).toBe(1); expect(cache.get('d')).toBe(4);
    cache.set('d', 6, 1);
    expect(cache.pixelCount).toBe(1); expect(cache.get('d')).toBe(6);
    cache.clear(); expect(cache.size).toBe(0); expect(cache.pixelCount).toBe(0);
  });

  it('caps default entry count at sixteen and does not retain oversized geometry', () => {
    const cache = new BoundedPixelCache<number>();
    for (let i = 0; i < 30; i++) cache.set(String(i), i, 1);
    expect(cache.size).toBe(16); expect(cache.get('13')).toBeUndefined();
    const small = new MixtureGeometryCache(16, 100);
    small.allocate(shape(), bounds, 3);
    expect(small.size).toBe(0); expect(small.pixelCount).toBe(0);
  });

  it('matches the original allocation exactly across origins, orientations, forms and counts', () => {
    const cache = new MixtureGeometryCache();
    for (const [dx, dy] of [[0, 0], [5, 3], [-6, -6]]) for (const reverse of [false, true]) {
      const p = shape(dx, dy), box = { l: bounds.l + dx, t: bounds.t + dy, r: bounds.r + dx, b: bounds.b + dy };
      for (const [count, form, surfaceBounds] of [
        [0, '', box], [1, 'esfera', box], [2, 'cubo', box], [3, 'dragao', box],
        [8, 'corrente', { ...box, r: box.r + 80 }], [16, 'ave', box]
      ] as const) {
        const options = { reverse, form, surfaceBounds };
        const expected = uncached(p, box, count, options);
        expectSame(cache.allocate(p, box, count, options), expected);
        expectSame(cache.allocate(p, box, count, options), expected);
      }
    }
  }, 20000);

  it('invalidates exact occupied geometry and its erosion halo, even for a reused Pix', () => {
    const cache = new MixtureGeometryCache(), p = shape();
    cache.allocate(p, bounds, 3);
    p.data[(20 * p.w + 20) * 4 + 3] = 0;
    expectSame(cache.allocate(p, bounds, 3), uncached(p, bounds, 3));
    expect(cache.size).toBe(2);
    p.set(3, 20, [80, 125, 150]);
    expectSame(cache.allocate(p, bounds, 3), uncached(p, bounds, 3));
    expect(cache.size).toBe(3);
    p.data[(20 * p.w + 3) * 4 + 3] = 127;
    cache.allocate(p, bounds, 3);
    expect(cache.size).toBe(3); // All nonzero alpha values have identical ownership.
  });

  it('keys all domain-affecting options and ignores reference palette changes', () => {
    const cache = new MixtureGeometryCache(), p = shape();
    const opts = [{}, { reverse: true }, { form: 'cubo' }, { surfaceBounds: { ...bounds, r: 100 } }];
    for (const options of opts) expectSame(cache.allocate(p, bounds, 3, options), uncached(p, bounds, 3, options));
    cache.allocate(p, bounds, 2); expect(cache.size).toBe(5);
    for (let i = 0; i < p.data.length; i += 4) { p.data[i] = 255; p.data[i + 1] = 0; p.data[i + 2] = 0; }
    expectSame(cache.allocate(p, bounds, 3), uncached(p, bounds, 3));
    expect(cache.size).toBe(5);
  });

  it('keeps all mutable report state private from future hits', () => {
    const cache = new MixtureGeometryCache(), p = shape();
    const first = cache.allocate(p, bounds, 3);
    first.owner.fill(15); first.contactOwner.fill(15); first.edgeDistance.fill(0); first.contactDistance.fill(0);
    first.bounds.l = -999; first.budget.represented.length = 0; first.budget.subpixel.push(99);
    for (const region of first.regions) {
      region.bounds.l = -999; region.axis.x = 999;
      if (region.seed) region.seed.x = 999;
      if (region.contact) region.contact.u = 999;
    }
    const sample = first.sampleAt(20, 20);
    if (sample?.contact) sample.contact.u = 999;
    expectSame(cache.allocate(p, bounds, 3), uncached(p, bounds, 3));
  });

  it('keeps raster bytes and reports stable across all eight phases and palette history', () => {
    const reference = shape(), cases = BODY_MATERIALS.map((element, i) => [element, BODY_MATERIALS[(i + 3) % 16], BODY_MATERIALS[(i + 7) % 16]]);
    const render = (elements: typeof cases[number], frame: number) => {
      const p = shape(), ramp = SIGNATURE_RAMPS[elements[0]];
      for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) p.data.set(ramp[Math.floor(ramp.length / 2)], i);
      const report = paintAllocatedMixture(p, bounds, elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })), {
        ownershipBody: reference, frame, seed: 17, reverse: frame % 2 === 0,
        preserveAuthoredPrimary: frame % 3 === 0, materialFusion: [{ family: 'tempo', elements: ['agua', 'gelo'] }]
      });
      return { bytes: p.data, report };
    };
    const expected = cases.map(elements => Array.from({ length: 8 }, (_, frame) => render(elements, frame)));
    for (let i = cases.length - 1; i >= 0; i--) for (let frame = 7; frame >= 0; frame--) {
      const actual = render(cases[i], frame);
      expect(actual.bytes).toEqual(expected[i][frame].bytes);
      expect(actual.report.paintedPixels).toEqual(expected[i][frame].report.paintedPixels);
      expect(actual.report.budget).toEqual(expected[i][frame].report.budget);
    }
  }, 15_000); // 256 raster comparisons; allow shared CI CPU contention.
});
