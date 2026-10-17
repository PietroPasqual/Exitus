import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintIntention } from '../src/ui/pixel-intention';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';
import { MixtureGeometryCache } from '../src/ui/pixel-mixture-cache';
import { allocateMixtureDomains, type MixtureDomainOptions, type MixtureDomains } from '../src/ui/pixel-mixture-domains';

const box = { l: 2.25, t: 2.5, r: 28.75, b: 22.25 };
function fixture(kind = 'solid'): Pix {
  const p = new Pix(31, 25);
  if (kind === 'stroke') p.line(3, 12, 27, 12, [128, 128, 128]);
  else for (let y = 3; y < 22; y++) for (let x = 3; x < 28; x++) {
    if (kind === 'ring' && Math.hypot(x - 15, y - 12) < 5) continue;
    if (kind === 'split' && x >= 14 && x <= 16) continue;
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
function digest(d: MixtureDomains): string {
  const samples = [];
  for (let y = d.bounds.t; y <= d.bounds.b; y++) for (let x = d.bounds.l; x <= d.bounds.r; x++) samples.push(d.sampleAt(x, y));
  const text = JSON.stringify([d, samples]); let n = 2166136261;
  for (let i = 0; i < text.length; i++) n = Math.imul(n ^ text.charCodeAt(i), 16777619);
  return (n >>> 0).toString(16);
}
function expectHealthy(d: MixtureDomains): void {
  expect(d.regions.reduce((sum, r) => sum + r.pixelCount, 0)).toBe(d.safePixelCount);
  expect(d.regions[0].pixelCount).toBeGreaterThanOrEqual(Math.max(...d.regions.map(r => r.pixelCount)));
  const seeds = d.regions.filter(r => r.pixelCount).map(r => `${r.seed?.x},${r.seed?.y}`);
  expect(new Set(seeds).size).toBe(seeds.length);
  for (const r of d.regions.filter(r => r.pixelCount)) {
    expect(r.pixelCount).toBeGreaterThanOrEqual(2);
    if (r.seed) expect(d.ownerAt(r.seed.x, r.seed.y)).toBe(r.owner);
  }
}

describe('preferred material domain seeds', () => {
  it('preserves complete pre-anchor reports and samples byte-for-byte when omitted', () => {
    // Captured from the original allocator before adding preferredSeeds.
    const expected = ['4cbb6b44', '887d81a8', '5e67948a', '4a7db254', '37983ea3', '87dcfe47',
      '6c2104e0', 'd6db21b4', '983b28dc', '5c1f954b', 'a2974ffc', 'fcc2aec',
      'bc8c3e36', '514c0bfa', 'a4c15d40', '86984d06', '5be9041a', '1c7ed074',
      '8caac571', 'f4319b4d', '615e4427', 'bbac4de6', '427ac5a4', '519cb250'];
    let i = 0;
    for (const kind of ['solid', 'ring', 'split', 'stroke']) for (const reverse of [false, true]) for (const count of [2, 4, 16]) {
      const p = fixture(kind), baseline = allocateMixtureDomains(p, box, count, { reverse });
      expect(digest(baseline), `${kind}:${reverse}:${count}`).toBe(expected[i++]);
      for (const preferredSeeds of [[], [null, undefined], [{ x: 0, y: 0 }]]) {
        expect(digest(allocateMixtureDomains(p, box, count, { reverse, preferredSeeds }))).toBe(digest(baseline));
      }
    }
  });

  it('honours distinct lower and side anchors while leaving the primary centre unchanged', () => {
    const p = fixture(), original = p.data.slice();
    const baseline = allocateMixtureDomains(p, box, 2);
    for (const point of [{ x: 15, y: 20 }, { x: 26, y: 12 }, { x: 4, y: 12 }]) {
      const d = allocateMixtureDomains(p, box, 2, { preferredSeeds: [null, point] });
      expect(d.regions[0].seed).toEqual(baseline.regions[0].seed);
      expect(d.regions[1].seed).toEqual(point);
      expect(d.owner).not.toEqual(baseline.owner);
      expectHealthy(d);
    }
    expect(p.data).toEqual(original);
  });

  it.each(['solid', 'ring', 'split', 'stroke'])('mirrors absolute fractional anchors exactly on %s geometry', kind => {
    const p = fixture(kind), other = mirror(p);
    const preferredSeeds = [null, { x: 5.25, y: 19.5 }, { x: 24.75, y: 17.25 }, { x: 22.5, y: 4.5 }];
    const a = allocateMixtureDomains(p, box, 4, { preferredSeeds });
    const b = allocateMixtureDomains(other, { ...box, l: p.w - 1 - box.r, r: p.w - 1 - box.l }, 4,
      { reverse: true, preferredSeeds: preferredSeeds.map(point => point && ({ x: p.w - 1 - point.x, y: point.y })) });
    expectHealthy(a); expectHealthy(b);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) expect(b.ownerAt(p.w - 1 - x, y)).toBe(a.ownerAt(x, y));
    for (let k = 0; k < a.regions.length; k++) {
      const sa = a.regions[k].seed, sb = b.regions[k].seed;
      expect(sb).toEqual(sa && { x: p.w - 1 - sa.x, y: sa.y });
    }
  });

  it('snaps away from holes, explicit protected cuts, highlights and tiny disconnected ornaments', () => {
    const p = fixture('ring'), protectedPixels = new Uint8Array(p.w * p.h);
    for (let y = 6; y <= 18; y++) protectedPixels[y * p.w + 24] = 1;
    p.set(22, 15, [250, 250, 250]);
    const options = { protectedPixels, authoredRamp: [[0, 0, 0], [128, 128, 128], [250, 250, 250]] as [number, number, number][] };
    const baseline = allocateMixtureDomains(p, box, 2, options), point = { x: 17.5, y: 12.25 };
    const d = allocateMixtureDomains(p, box, 2, { ...options, preferredSeeds: [null, point] });
    const eligible: { x: number; y: number }[] = [];
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (baseline.ownerAt(x, y) >= 0) eligible.push({ x, y });
    eligible.sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y) || a.y - b.y || a.x - b.x);
    expect(d.regions[1].seed).toEqual(eligible[0]);
    expect(d.ownerAt(15, 12)).toBe(-1); expect(d.ownerAt(22, 15)).toBe(-1);
    for (let y = 6; y <= 18; y++) expect(d.ownerAt(24, y)).toBe(-1);
    expectHealthy(d);

    const detached = new Pix(42, 25);
    for (let y = 3; y < 22; y++) for (let x = 3; x < 28; x++) detached.set(x, y, [128, 128, 128]);
    detached.set(38, 12, [128, 128, 128]);
    const onBody = allocateMixtureDomains(detached, { l: 0, t: 0, r: 41, b: 24 }, 2, { preferredSeeds: [null, { x: 38, y: 12 }] });
    expect(onBody.regions[1].seed?.x).toBeLessThan(28);
    expect(onBody.ownerAt(38, 12)).toBe(-1);
    expectHealthy(onBody);
  });

  it('backs off infeasible anatomy preferences instead of exchanging anchored material IDs', () => {
    const p = fixture(), preferredSeeds = [null, { x: 16, y: 12 }, { x: 15, y: 13 }, { x: 14, y: 12 }];
    // Three neighbours surround the centre and leave no dominant primary cell
    // at the existing secondary minimum-budget cap.
    const baseline = allocateMixtureDomains(p, box, 4);
    const d = allocateMixtureDomains(p, box, 4, { preferredSeeds });
    expect(digest(d)).toBe(digest(baseline));
    expect(d.regions[0].seed).toEqual({ x: 15, y: 12 });
    expectHealthy(d);
  });

  it('falls back deterministically for invalid, coincident, crowded and tiny anchors without duplicate seeds', () => {
    for (const kind of ['solid', 'stroke']) for (const reverse of [false, true]) {
      const p = fixture(kind), baseline = allocateMixtureDomains(p, box, 4, { reverse });
      for (const point of [{ x: NaN, y: 12 }, { x: Infinity, y: 12 }, baseline.regions[0].seed!]) {
        const d = allocateMixtureDomains(p, box, 4, { reverse, preferredSeeds: Array(4).fill(point) });
        expect(digest(d)).toBe(digest(baseline));
      }
      for (const count of [8, 16]) {
        const options = { reverse, preferredSeeds: Array(count).fill({ x: 25.5, y: 19.5 }) };
        const d = allocateMixtureDomains(p, box, count, options);
        expectHealthy(d);
        expect(digest(allocateMixtureDomains(p, box, count, options))).toBe(digest(d));
      }
    }
    const tiny = new Pix(3, 3); tiny.set(1, 1, [128, 128, 128]);
    const d = allocateMixtureDomains(tiny, { l: 0, t: 0, r: 2, b: 2 }, 16, { preferredSeeds: Array(16).fill({ x: 1, y: 1 }) });
    expect(d.budget.subpixel).toHaveLength(15);
    expect(d.ownerAt(1, 1)).toBe(0);
    expect(d.regions[0].seed).toEqual({ x: 1, y: 1 });
  });

  it('keys exact fractional anchors and isolates caller mutations through eight repeated phases and A→B→A', () => {
    const cache = new MixtureGeometryCache(4, 31 * 25 * 4), p = fixture();
    const points = [null, { x: 15.125, y: 20.25 }, { x: 25.25, y: 7.75 }];
    const options: MixtureDomainOptions = { preferredSeeds: points };
    const first = cache.allocate(p, box, 3, options), expected = digest(first);
    const alternate = { preferredSeeds: [null, { x: 4.25, y: 12.75 }, { x: 25.25, y: 7.75 }] };
    expect(digest(cache.allocate(p, box, 3, alternate))).not.toBe(expected);
    expect(digest(cache.allocate(p, box, 3, options))).toBe(expected);
    points[1]!.x += .125;
    cache.allocate(p, box, 3, options);
    expect(cache.size).toBe(3); // Even an anchor that snaps to the same pixel has an exact key.
    points[1]!.x -= .125;
    first.owner.fill(15); first.regions[1].seed!.x = -999;
    for (let phase = 0; phase < 8; phase++) for (const reverse of [false, true]) {
      for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) p.data.set([20 + phase * 10, 80, 230 - phase * 10], i);
      const opts = { ...options, reverse };
      const reference = allocateMixtureDomains(fixture(), box, 3, { ...opts, preserveHighlights: false });
      expect(digest(cache.allocate(p, box, 3, opts))).toBe(digest(reference));
      expect(cache.size).toBeLessThanOrEqual(4);
      expect(cache.pixelCount).toBeLessThanOrEqual(31 * 25 * 4);
    }
    expect(digest(cache.allocate(p, box, 3, options))).toBe(expected);
  });

  it('keeps actual generic bodies stable at fractional centres in both directions over repeated eight-phase renders', () => {
    const materials = ['agua', 'metal', 'gelo', 'fogo'] as const;
    for (const form of ['escudo', 'bomba', 'arvore', 'lanca'] as const) for (const reverse of [false, true]) {
      const render = (frame: number) => {
        const p = new Pix(110, 90), bounds = paintIntention(p, form, 55.25, 45.75, 15, SIGNATURE_RAMPS.agua, 'water', 7, 'agua', reverse);
        const original = p.data.slice(), reference = new Pix(p.w, p.h); reference.data.set(original);
        const d = paintAllocatedMixture(p, bounds, materials.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })),
          { form, reverse, frame, seed: 7, ownershipBody: reference, preserveAuthoredPrimary: true });
        expectHealthy(d);
        expect(d.budget.subpixel, `${form}:${reverse}:${frame}`).toEqual([]);
        expect(p.data.every((value, i) => i % 4 !== 3 || value === original[i])).toBe(true);
        return { bytes: p.data, owner: d.owner, painted: d.paintedPixels };
      };
      const expected = Array.from({ length: 8 }, (_, frame) => render(frame));
      for (let frame = 7; frame >= 0; frame--) {
        const actual = render(frame);
        expect(actual.bytes.every((value, i) => value === expected[frame].bytes[i])).toBe(true);
        expect(actual.painted).toEqual(expected[frame].painted);
        expect(actual.owner.every((value, i) => value === expected[frame].owner[i] && value === expected[0].owner[i])).toBe(true);
      }
    }
  });
});
