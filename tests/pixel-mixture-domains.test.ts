import { describe, expect, it } from 'vitest';
import { INTENTION_CATALOG } from '../src/core/intention';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { paintIntention } from '../src/ui/pixel-intention';
import { paintSpellSprite, type SpellSprite } from '../src/ui/pixel-spell-sprites';
import { allocateMixtureDomains, type MixtureDomains } from '../src/ui/pixel-mixture-domains';

const ramp: RGB[] = ['#122346', '#17466a', '#237e9b', '#4dbac5', '#9de5df', '#ecfff1'].map(rgb);
const box = { l: 4, t: 4, r: 44, b: 44 };
function sphere(): Pix {
  const body = new Pix(49, 49);
  body.shape(5, 5, 43, 43, (x, y) => Math.hypot(x - 24, y - 24) <= 18 ? ramp[3] : null, ramp[0]);
  return body;
}
function components(d: MixtureDomains, owner: number): number[][] {
  const seen = new Set<number>(), result: number[][] = [];
  for (let i = 0; i < d.owner.length; i++) if (d.owner[i] === owner && !seen.has(i)) {
    const q = [i]; seen.add(i);
    for (let head = 0; head < q.length; head++) {
      const p = q[head], x = p % d.width, y = Math.floor(p / d.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= d.width || y + dy < 0 || y + dy >= d.height) continue;
        const n = p + dy * d.width + dx;
        if (d.owner[n] === owner && !seen.has(n)) { seen.add(n); q.push(n); }
      }
    }
    result.push(q);
  }
  return result;
}
function validate(body: Pix, d: MixtureDomains): void {
  expect(d.owner.length).toBe(d.width * d.height);
  expect(d.owner.length).toBeLessThanOrEqual(body.w * body.h);
  expect(d.regions.reduce((sum, r) => sum + r.pixelCount, 0)).toBe(d.safePixelCount);
  for (let y = 0; y < body.h; y++) for (let x = 0; x < body.w; x++) {
    const sample = d.sampleAt(x, y);
    if (!sample) { expect(d.ownerAt(x, y)).toBe(-1); continue; }
    const p = (y * body.w + x) * 4;
    expect(body.data[p + 3]).toBeGreaterThan(0);
    expect(sample.owner).toBeGreaterThanOrEqual(0);
    expect(sample.owner).toBeLessThan(d.regions.length);
    for (const n of [sample.u, sample.v, sample.along, sample.across]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(1); }
    expect(sample.edgeDistance).toBeGreaterThan(0);
    if (sample.contact) {
      expect(sample.contactOwner).not.toBe(sample.owner);
      expect(sample.contactDistance).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(sample.contact.nx, sample.contact.ny)).toBeCloseTo(1, 8);
    } else expect(sample.contactOwner).toBe(-1);
  }
}

describe('Shape-following material domains', () => {
  it.each([2, 3, 4, 6, 16])('allocates %i ordered constituents as coherent cells with primary dominance', count => {
    const body = sphere(), copy = body.data.slice();
    const d = allocateMixtureDomains(body, box, count, { authoredRamp: ramp });
    validate(body, d);
    expect(body.data).toEqual(copy);
    expect(d.budget.subpixel).toEqual([]);
    expect(d.budget.represented).toEqual(Array.from({ length: count }, (_, i) => i));
    for (const r of d.regions) {
      expect(r.pixelCount).toBeGreaterThanOrEqual(d.budget.minimumRegionPixels);
      expect(components(d, r.owner)).toHaveLength(1);
      expect(r.pixelCount).toBeLessThanOrEqual(d.regions[0].pixelCount);
    }
    if (count <= 4) for (const r of d.regions) expect(r.pixelCount).toBeGreaterThan(40);
    expect(allocateMixtureDomains(body, box, count, { authoredRamp: ramp }).owner).toEqual(d.owner);
  });

  it('preserves a real hollow centre, a dark carved face, highlights and an explicit semantic mask', () => {
    const body = sphere(), protectedPixels = new Uint8Array(body.w * body.h);
    for (let y = 19; y <= 29; y++) for (let x = 19; x <= 29; x++) body.data[(y * body.w + x) * 4 + 3] = 0;
    body.set(34, 23, ramp[0]); body.set(34, 24, [10, 12, 18]); body.set(34, 25, ramp[5]);
    protectedPixels[26 * body.w + 34] = 1;
    const d = allocateMixtureDomains(body, box, 4, { authoredRamp: ramp, protectedPixels });
    validate(body, d);
    expect(d.shape).toBe('hollow');
    for (const [x, y] of [[24, 24], [34, 23], [34, 24], [34, 25], [34, 26]]) expect(d.ownerAt(x, y)).toBe(-1);
    for (let k = 0; k < 4; k++) expect(components(d, k)).toHaveLength(1);
    expect(d.regions.every(r => r.pixelCount >= 20)).toBe(true);
  });

  it('uses actual ring paths for contact distance instead of a shortcut through the opening', () => {
    const body = new Pix(49, 49);
    body.shape(6, 6, 42, 42, (x, y) => {
      const r = Math.hypot(x - 24, y - 24); return r >= 12 && r <= 18 ? ramp[3] : null;
    }, ramp[0]);
    const d = allocateMixtureDomains(body, box, 3, { authoredRamp: ramp });
    expect(d.shape).toBe('hollow');
    expect(d.ownerAt(24, 24)).toBe(-1);
    expect(d.regions.every(r => r.pixelCount > 35)).toBe(true);
    for (const r of d.regions) expect(components(d, r.owner)).toHaveLength(1);
    expect(Math.max(...d.contactDistance.filter(n => n < 65535))).toBeGreaterThan(8);
  });

  it('uses a bounded negative primary bias rather than confining a partner to a tiny peripheral cap', () => {
    for (const sprite of ['fire-sphere', 'metal-sphere', 'water-sphere'] as const) {
      const body = new Pix(110, 90), q = paintSpellSprite(sprite, body, 55, 45, 15, ramp, 3, 0);
      const d = allocateMixtureDomains(body, q, 2, { authoredRamp: ramp });
      expect(d.regions[0].pixelCount / d.safePixelCount).toBeGreaterThan(.5);
      expect(d.regions[0].pixelCount / d.safePixelCount).toBeLessThan(.71);
      expect(d.regions[1].pixelCount).toBeGreaterThan(100);
    }
  });

  it('keeps geometry-only proxy allocation fixed while authored metal highlights move', () => {
    let reference: Int16Array | undefined;
    for (let frame = 0; frame < 8; frame++) {
      const body = new Pix(110, 90), q = paintSpellSprite('metal-sphere', body, 55, 45, 15, ramp, 3, frame);
      const proxy = new Pix(body.w, body.h);
      for (let i = 0; i < body.data.length; i += 4) if (body.data[i + 3]) proxy.data.set([...ramp[3], body.data[i + 3]], i);
      const d = allocateMixtureDomains(proxy, q, 4, { authoredRamp: ramp });
      if (reference) expect(d.owner).toEqual(reference); else reference = d.owner;
    }
  });

  it('partitions a long weapon along its occupied shaft and head rather than horizontal rows', () => {
    const body = new Pix(80, 24);
    body.shape(3, 6, 76, 18, (x, y) => (x < 56 ? y >= 10 && y <= 14 : Math.abs(y - 12) <= (77 - x) * .29) ? ramp[3] : null, ramp[0]);
    const d = allocateMixtureDomains(body, { l: 0, t: 0, r: 79, b: 23 }, 4, { authoredRamp: ramp, form: 'lanca' });
    expect(d.shape).toBe('long');
    expect(d.budget.subpixel).toEqual([]);
    for (const r of d.regions) { expect(components(d, r.owner)).toHaveLength(1); expect(r.bounds.r - r.bounds.l).toBeGreaterThan(4); }
    expect(d.regions[0].pixelCount).toBeGreaterThan(Math.max(...d.regions.slice(1).map(r => r.pixelCount)));
  });

  it('keeps the allocation mirror-exact in authored coordinates', () => {
    const a = sphere();
    a.set(31, 28, ramp[0]); a.set(31, 29, ramp[5]);
    const b = new Pix(a.w, a.h);
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) b.data.set(a.data.subarray((y * a.w + x) * 4, (y * a.w + x) * 4 + 4), (y * a.w + a.w - 1 - x) * 4);
    const da = allocateMixtureDomains(a, box, 4, { authoredRamp: ramp });
    const db = allocateMixtureDomains(b, box, 4, { authoredRamp: ramp, reverse: true });
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
      expect(db.ownerAt(a.w - 1 - x, y)).toBe(da.ownerAt(x, y));
      const sa = da.sampleAt(x, y), sb = db.sampleAt(a.w - 1 - x, y);
      if (sa && sb) { expect(sa.u).toBeCloseTo(sb.u, 8); expect(sa.v).toBeCloseTo(sb.v, 8); }
    }
  });

  it('declares tiny/16-material budgets without single-pixel tokens or temporal rotation', () => {
    const body = new Pix(12, 12);
    body.line(2, 5, 9, 5, ramp[3]);
    const d = allocateMixtureDomains(body, { l: 0, t: 0, r: 11, b: 11 }, 16, { authoredRamp: ramp });
    validate(body, d);
    expect(d.shape).toBe('stroke');
    expect(d.budget.minimumRegionPixels).toBe(2);
    expect(d.budget.represented.length).toBeGreaterThanOrEqual(2);
    expect(d.budget.subpixel.length).toBeGreaterThan(0);
    for (const r of d.regions.filter(r => r.pixelCount)) expect(r.pixelCount).toBeGreaterThanOrEqual(2);
    for (const k of d.budget.subpixel) expect(d.regions[k].detail).toBe('subpixel');
    expect(allocateMixtureDomains(body, { l: 0, t: 0, r: 11, b: 11 }, 16, { authoredRamp: ramp }).owner).toEqual(d.owner);
    const strict = allocateMixtureDomains(body, { l: 0, t: 0, r: 11, b: 11 }, 16, { authoredRamp: ramp, allowThinStrokes: false });
    expect(strict.safePixelCount).toBe(0);
  });

  it('does not make contact between disconnected authored pieces', () => {
    const body = new Pix(50, 24);
    for (const x of [3, 29]) body.shape(x, 4, x + 13, 18, () => ramp[3], ramp[0]);
    const d = allocateMixtureDomains(body, { l: 0, t: 0, r: 49, b: 23 }, 4, { authoredRamp: ramp });
    validate(body, d);
    expect(d.ownerAt(24, 12)).toBe(-1);
    for (let k = 1; k < 4; k++) expect(components(d, k)).toHaveLength(1);
    for (let y = 0; y < body.h; y++) for (let x = 17; x < 29; x++) expect(d.sampleAt(x, y)).toBeNull();
  });

  it('normalizes invalid counts, clipped bounds and non-finite input without changing the body', () => {
    const body = sphere(), before = body.data.slice();
    for (const count of [0, -1, Infinity, NaN]) expect(allocateMixtureDomains(body, box, count).regions).toHaveLength(0);
    expect(allocateMixtureDomains(body, box, 3.9).regions).toHaveLength(3);
    expect(allocateMixtureDomains(body, box, 1000).regions).toHaveLength(16);
    const outside = allocateMixtureDomains(body, { l: -1e6, t: -1e6, r: 1e6, b: 1e6 }, 3);
    expect(outside.owner.length).toBe(body.w * body.h);
    for (const q of [{ l: NaN, t: 0, r: 50, b: 50 }, { l: 20, t: 20, r: 5, b: 5 }, { l: 100, t: 100, r: 110, b: 110 }]) expect(allocateMixtureDomains(body, q, 4).owner.length).toBe(0);
    expect(outside.sampleAt(.5, 20)).toBeNull(); expect(outside.ownerAt(Infinity, 20)).toBe(-1);
    expect(body.data).toEqual(before);
  });

  const sprites: SpellSprite[] = ['fire-sphere', 'water-sphere', 'ice-sphere', 'earth-sphere', 'metal-sphere', 'fire-lance', 'water-dragon', 'lightning-ring'];
  it.each(sprites)('gives actual %s a defined four-material allocation at native and tiny sizes', sprite => {
    for (const size of [3, 7, 15]) {
      const body = new Pix(110, 90), q = paintSpellSprite(sprite, body, 55, 45, size, ramp, 3, 0);
      const d = allocateMixtureDomains(body, q, 4, { authoredRamp: ramp, form: sprite.split('-')[1] });
      validate(body, d);
      expect(d.budget.represented.length + d.budget.subpixel.length).toBe(4);
      expect(d.regions[0].pixelCount).toBeGreaterThanOrEqual(Math.max(...d.regions.slice(1).map(r => r.pixelCount)));
      if (size === 15) {
        expect(d.budget.subpixel).toEqual([]);
        for (let k = 1; k < 4; k++) { expect(d.regions[k].pixelCount).toBeGreaterThanOrEqual(d.budget.minimumRegionPixels); expect(components(d, k)).toHaveLength(1); }
      }
    }
  });

  it('keeps all 200 actual intention masks safe and deterministic at native and compact scales', () => {
    for (const { id } of INTENTION_CATALOG) for (const size of [5, 15]) {
      const body = new Pix(160, 100), q = paintIntention(body, id, 80, 50, size, ramp, 'water', 7, 'agua');
      const original = body.data.slice(), d = allocateMixtureDomains(body, q, 4, { authoredRamp: ramp, form: id });
      expect(body.data.every((v, i) => v === original[i]), `${id}:${size} immutable`).toBe(true);
      expect(d.regions.reduce((n, r) => n + r.pixelCount, 0), `${id}:${size} coverage`).toBe(d.safePixelCount);
      if (size === 15) expect(d.budget.subpixel, `${id}: normal-size constituent visibility`).toEqual([]);
      expect(d.owner, `${id}:${size} deterministic`).toEqual(allocateMixtureDomains(body, q, 4, { authoredRamp: ramp, form: id }).owner);
      for (let k = 1; k < 4; k++) if (d.regions[k].pixelCount) expect(components(d, k), `${id}:${size}:${k} connected`).toHaveLength(1);
      for (let i = 0; i < d.owner.length; i++) if (d.owner[i] >= 0) {
        const p = ((d.bounds.t + Math.floor(i / d.width)) * body.w + d.bounds.l + i % d.width) * 4;
        if (!body.data[p + 3] || ramp[0].every((v, k) => body.data[p + k] === v) || ramp[5].every((v, k) => body.data[p + k] === v)) throw new Error(`${id}:${size} owns a protected pixel`);
      }
    }
  }, 20_000);
});
