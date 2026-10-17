import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { CONCEPT_MOTIFS, paintConceptAura, type ConceptAuraOptions } from '../src/ui/pixel-concept-fx';
import { RUNES } from '../src/data/runes';

const ramp = ['#202a36', '#4a5969', '#78899a', '#a9bac9', '#e3edf5'].map(rgb);
function render(concept: string, frame = 0, r = 14, options: ConceptAuraOptions = {}, center = 40.5): Pix {
  const pix = new Pix(82, 82);
  paintConceptAura(pix, concept, center, center, r, ramp, { frame, ...options });
  return pix;
}
const mask = (pix: Pix): string => [...pix.data].filter((_, i) => i % 4 === 3).join('');
const equalPixels = (a: Pix, b: Pix): boolean => a.data.length === b.data.length && a.data.every((value, i) => value === b.data[i]);

describe('Defined, nonphysical concept pixel motifs', () => {
  it('makes the eight concepts visually distinct at every pause pose using one palette', () => {
    for (const r of [4, 8, 14, 23]) for (const glow of [true, false]) for (const ring of [true, false]) for (let frame = 0; frame < 8; frame++) {
      const silhouettes = CONCEPT_MOTIFS.map(concept => mask(render(concept, frame, r, { glow, ring })));
      expect(new Set(silhouettes).size, `r=${r}, frame=${frame}, glow=${glow}, ring=${ring}`).toBe(8);
      for (const silhouette of silhouettes) expect(silhouette).toContain('255');
    }
  });

  it('stays inside the all-frame r+6 envelope even with fractional centers', () => {
    for (const r of [1, 2.5, 4, 8, 14, 23]) for (let frame = 0; frame < 8; frame++) for (const concept of CONCEPT_MOTIFS) {
      const p = render(concept, frame, r);
      let count = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3]) {
        expect(Math.hypot(x - 40.5, y - 40.5), `${concept}: ${x},${y}`).toBeLessThanOrEqual(r + 6);
        count++;
      }
      expect(count).toBeGreaterThan(0);
      // These are open marks; never a filled material body.
      expect(count).toBeLessThan(Math.PI * (r + 6) ** 2 * .43);
    }
  });

  it('normalizes the eight-frame clock deterministically, including invalid frames', () => {
    for (const concept of CONCEPT_MOTIFS) {
      const start = render(concept), end = render(concept, 7);
      expect(equalPixels(render(concept, 8), start), concept).toBe(true);
      expect(equalPixels(render(concept, -1), end), concept).toBe(true);
      expect(equalPixels(render(concept, -9), end), concept).toBe(true);
      expect(equalPixels(render(concept, 2.9), render(concept, 2)), concept).toBe(true);
      for (const frame of [NaN, Infinity, -Infinity]) expect(equalPixels(render(concept, frame), start), concept).toBe(true);
      const frames = Array.from({ length: 8 }, (_, phase) => render(concept, phase).data.join(','));
      // A held anticipation/contact pose is intentional at 8 fps. The cycle
      // must progress, but it need not invent a different silhouette every tick.
      expect(new Set(frames).size, concept).toBeGreaterThanOrEqual(3);
      expect(equalPixels(render(concept), start), concept).toBe(true);
    }
  });

  it('respects scene protection without changing unprotected art or the shared mask', () => {
    const protectedPixels = new Uint8Array(82 * 82);
    for (let y = 15; y < 65; y++) for (let x = 15; x < 65; x++) if ((x + y) % 3 === 0) protectedPixels[y * 82 + x] = 1;
    const original = protectedPixels.slice();
    let clipped = 0, overwritten = 0, changedUnprotected = 0;
    for (const concept of CONCEPT_MOTIFS) for (let frame = 0; frame < 8; frame++) {
      const full = render(concept, frame), safe = render(concept, frame, 14, { protectedPixels });
      for (let at = 0; at < protectedPixels.length; at++) {
        if (protectedPixels[at]) {
          if (full.data[at * 4 + 3]) clipped++;
          if (safe.data[at * 4 + 3]) overwritten++;
        } else for (let c = 0; c < 4; c++) if (safe.data[at * 4 + c] !== full.data[at * 4 + c]) changedUnprotected++;
      }
    }
    expect(clipped).toBeGreaterThan(0);
    expect(overwritten).toBe(0);
    expect(changedUnprotected).toBe(0);
    expect(protectedPixels).toEqual(original);
  });

  it('does not invent effects for undefined runes or malformed inputs', () => {
    const undefinedRunes = Object.values(RUNES).filter(rune => rune.semEfeito).map(rune => rune.id);
    expect(undefinedRunes).toHaveLength(11);
    for (const rune of [...undefinedRunes, 'unknown', '', 'agua']) expect(render(rune).data.every(v => v === 0)).toBe(true);
    for (const r of [0, -2, NaN, Infinity]) expect(render('vida', 0, r).data.every(v => v === 0)).toBe(true);
    const p = new Pix(82, 82);
    paintConceptAura(p, 'tempo', 40, 40, 14, []);
    paintConceptAura(p, 'tempo', NaN, 40, 14, ramp);
    expect(p.data.every(v => v === 0)).toBe(true);
  });

  it('keeps movement linear, empty-centered and separate from orbital choreography', () => {
    const poses = new Set<string>();
    for (let frame = 0; frame < 8; frame++) {
      const p = render('movimento', frame, 14, { glow: false });
      poses.add(mask(p));
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3]) {
        const dx = x - 40.5, dy = y - 40.5;
        // The folds stay in two opposed horizontal lanes, rather than moving
        // around the center. Their advancing tips and shortening tails may move.
        expect(Math.abs(dy)).toBeGreaterThanOrEqual(8);
        expect(Math.abs(dy)).toBeLessThanOrEqual(15.5);
        expect(dx * dy).toBeGreaterThan(0);
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(14 * .56);
      }
    }
    expect(poses.size).toBeGreaterThanOrEqual(3);
  });

  it('gives pressure a visible approach, held contact and recoil after contour fitting', () => {
    const body = new Pix(82, 82);
    body.shape(29, 29, 52, 52, (x, y) => Math.hypot(x - 40.5, y - 40.5) <= 11 ? ramp[2] : null);
    const sideDistance = (frame: number): number => {
      const p = render('pressao', frame, 14, { glow: false, ring: false, body, bodyBounds: { l: 29, t: 29, r: 52, b: 52 } });
      const distances: number[] = [];
      for (let y = 37; y <= 44; y++) for (let x = 0; x < p.w; x++)
        if (p.data[(y * p.w + x) * 4 + 3]) distances.push(Math.abs(x - 40.5));
      return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    };
    expect(sideDistance(0) - sideDistance(2)).toBeGreaterThan(1);
    expect(sideDistance(2) - sideDistance(4)).toBeGreaterThan(1);
    expect(Math.abs(sideDistance(3) - sideDistance(4))).toBeLessThan(1);
    expect(sideDistance(6) - sideDistance(4)).toBeGreaterThan(3);
  });

  it('retains eight distinct exterior signatures when a material body hides the center', () => {
    for (const r of [8, 14, 23]) for (const ring of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const silhouettes = CONCEPT_MOTIFS.map(concept => {
        const p = render(concept, frame, r, { glow: false, ring });
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (Math.hypot(x - 40.5, y - 40.5) <= r - 3) p.data.fill(0, (y * p.w + x) * 4, (y * p.w + x + 1) * 4);
        return mask(p);
      });
      expect(new Set(silhouettes).size, `r=${r}, frame=${frame}, ring=${ring}`).toBe(8);
      for (const silhouette of silhouettes) expect(silhouette).toContain('255');
    }
  });

  it('does not mutate inputs or a material layer composited afterwards', () => {
    const colors = ramp.map(c => [...c]);
    for (const concept of CONCEPT_MOTIFS) {
      const p = render(concept, 3, 14, { glow: false, ring: false });
      const body = new Pix(p.w, p.h);
      body.shape(30, 30, 50, 50, (x, y) => Math.hypot(x - 40.5, y - 40.5) <= 10 ? ramp[2] : null);
      for (let i = 0; i < body.data.length; i += 4) if (body.data[i + 3]) p.data.set(body.data.subarray(i, i + 4), i);
      for (let i = 0; i < body.data.length; i += 4) if (body.data[i + 3]) expect(p.data.subarray(i, i + 4)).toEqual(body.data.subarray(i, i + 4));
    }
    expect(ramp).toEqual(colors);
  });

  it('leaves the central negative space of material sprites and glyphs clear', () => {
    for (const concept of CONCEPT_MOTIFS) for (let frame = 0; frame < 8; frame++) {
      const p = render(concept, frame, 14, { glow: false });
      for (let y = 36; y <= 45; y++) for (let x = 36; x <= 45; x++) expect(p.data[(y * p.w + x) * 4 + 3], concept).toBe(0);
    }
  });

  it('fits narrow or tall bodies without enlarging the existing radial envelope', () => {
    for (const radii of [{ x: 23, y: 8 }, { x: 8, y: 23 }]) for (let frame = 0; frame < 8; frame++) {
      const silhouettes: string[] = [];
      for (const concept of CONCEPT_MOTIFS) {
        const p = render(concept, frame, 23, { glow: false, radii });
        silhouettes.push(mask(p));
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3]) {
          expect(Math.hypot(x - 40.5, y - 40.5)).toBeLessThanOrEqual(29);
          expect(Math.abs(x - 40.5)).toBeLessThanOrEqual(radii.x + 6);
          expect(Math.abs(y - 40.5)).toBeLessThanOrEqual(radii.y + 6);
        }
      }
      expect(new Set(silhouettes).size, `frame=${frame}, radii=${JSON.stringify(radii)}`).toBe(8);
    }
    for (const concept of CONCEPT_MOTIFS) for (const radii of [{ x: 99, y: 99 }, { x: NaN, y: Infinity }, { x: -1, y: 0 }])
      expect(equalPixels(render(concept, 0, 14, { radii }), render(concept)), concept).toBe(true);
  });

  it('protects the finished material and enclosed cutouts without mutating the body mask', () => {
    const body = new Pix(82, 82);
    body.shape(29, 29, 52, 52, (x, y) => {
      const d = Math.hypot(x - 40.5, y - 40.5);
      return d <= 11 && d >= 4 ? ramp[2] : null;
    });
    const original = body.data.slice(), bodyBounds = { l: 29, t: 29, r: 52, b: 52 };
    for (const concept of CONCEPT_MOTIFS) for (let frame = 0; frame < 8; frame++) {
      const p = render(concept, frame, 14, { glow: false, body, bodyBounds });
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        const at = (y * p.w + x) * 4;
        if (body.data[at + 3] || Math.hypot(x - 40.5, y - 40.5) < 4) expect(p.data[at + 3], concept).toBe(0);
      }
      expect(body.data.every((v, i) => v === original[i])).toBe(true);
    }
  });

  it('scans only the supplied body bounds plus the two-pixel contour margin', () => {
    const body = new Pix(82, 82), indices: number[] = [];
    body.shape(34, 35, 46, 45, () => ramp[2]);
    const traced = { w: body.w, h: body.h, data: new Proxy(body.data, {
      get(target, property): unknown {
        const i = Number(property);
        if (Number.isInteger(i)) { indices.push(i); return target[i]; }
        return Reflect.get(target, property);
      }
    }) } as Pix;
    render('pressao', 3, 14, { body: traced, bodyBounds: { l: 34, t: 35, r: 46, b: 45 } });
    expect(indices.length).toBeLessThanOrEqual(17 * 15);
    for (const index of indices) {
      const pixel = Math.floor(index / 4), x = pixel % body.w, y = Math.floor(pixel / body.w);
      expect(x).toBeGreaterThanOrEqual(32); expect(x).toBeLessThanOrEqual(48);
      expect(y).toBeGreaterThanOrEqual(33); expect(y).toBeLessThanOrEqual(47);
    }
  });

  it('uses connected shaded clusters for the stronger field gestures', () => {
    for (const concept of ['pressao', 'caos', 'infinito', 'vida']) for (let frame = 0; frame < 8; frame++) {
      const p = render(concept, frame, 16);
      let squares = 0;
      for (let y = 0; y < p.h - 1; y++) for (let x = 0; x < p.w - 1; x++) if ([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].every(([px, py]) => p.data[(py * p.w + px) * 4 + 3])) squares++;
      expect(squares, `${concept}, frame ${frame}`).toBeGreaterThan(4);
    }
  });
});
