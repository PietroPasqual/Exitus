import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { BODY_MATERIALS, type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { flameJetBounds, paintFlameFeed, paintFlameJet } from '../src/ui/pixel-flame-jet';
import { materialStreamBounds, paintMaterialStream, paintMaterialStreamFeed } from '../src/ui/pixel-material-stream';
import { GRAY_RAMP, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const raster = (material: BodyMaterial, frame = 0, scale = 15, gray = false): Pix => {
  const p = new Pix(180, 105);
  paintMaterialStream(p, 90.5, 52.5, scale, gray ? GRAY_RAMP : SIGNATURE_RAMPS[material], material, frame);
  return p;
};
const alpha = (p: Pix, x: number, y: number): number => p.data[(y * p.w + x) * 4 + 3] ?? 0;
const occupied = (p: Pix): number[] => {
  const result: number[] = [];
  for (let i = 0; i < p.w * p.h; i++) if (p.data[i * 4 + 3]) result.push(i);
  return result;
};
const delta = (a: Pix, b: Pix): number => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
};

describe('Native maintained material stream art', () => {
  it('preserves the accepted fire body and hand-feed exactly', () => {
    for (const scale of [1, 3, 8, 15]) for (let frame = 0; frame < 8; frame++) {
      const expected = new Pix(180, 105), actual = new Pix(180, 105);
      const a = paintFlameJet(expected, 90.5, 52.5, scale, SIGNATURE_RAMPS.fogo, frame);
      const b = paintMaterialStream(actual, 90.5, 52.5, scale, SIGNATURE_RAMPS.fogo, 'fogo', frame);
      expect(b).toEqual(a); expect(delta(actual, expected)).toBe(0);
      paintFlameFeed(expected, [12, 20], [41, 27], SIGNATURE_RAMPS.fogo, frame);
      paintMaterialStreamFeed(actual, [12, 20], [41, 27], SIGNATURE_RAMPS.fogo, 'fogo', frame);
      expect(delta(actual, expected)).toBe(0);
    }
  });

  it('uses the shared all-frame envelope and keeps the source present in every pose', () => {
    for (const material of BODY_MATERIALS) for (const scale of [1, 2, 3, 6, 10, 15]) for (let frame = 0; frame < 8; frame++) {
      const p = raster(material, frame, scale), q = materialStreamBounds(scale), pixels = occupied(p);
      expect(q).toEqual(flameJetBounds(scale)); expect(pixels.length).toBeGreaterThan(0);
      expect(pixels.every(i => {
        const x = i % p.w, y = Math.floor(i / p.w);
        return x >= 90.5 + q.l && x <= 90.5 + q.r && y >= 52.5 + q.t && y <= 52.5 + q.b;
      }), `${material} s${scale} f${frame} bounds`).toBe(true);
      const left = Math.ceil(90.5 + q.l), sourceY = 52.5 + scale * .25;
      expect(pixels.some(i => i % p.w <= left + 1 && Math.abs(Math.floor(i / p.w) - sourceY) <= Math.max(1, scale * .12)), `${material} s${scale} f${frame} source`).toBe(true);
      for (let region = 0; region < 4; region++) {
        expect(pixels.some(i => {
          const u = (i % p.w - 90.5 - q.l) / (q.r - q.l);
          return u >= region / 4 && u <= (region + 1) / 4;
        }), `${material} s${scale} f${frame} quarter${region}`).toBe(true);
      }
    }
  });

  it('renders exact supplied palette pixels with no translucent edge or borrowed fire texture', () => {
    const grayscaleBodies = new Set<string>(), silhouettes = new Set<string>();
    for (const material of BODY_MATERIALS) {
      const p = raster(material, 0, 15, true), palette = new Set(GRAY_RAMP.map(c => c.join(',')));
      grayscaleBodies.add(p.data.join(',')); silhouettes.add(occupied(p).join(','));
      for (const i of occupied(p)) {
        expect(p.data[i * 4 + 3]).toBe(255);
        expect(palette.has(Array.from(p.data.slice(i * 4, i * 4 + 3)).join(','))).toBe(true);
      }
    }
    expect(grayscaleBodies.size).toBe(BODY_MATERIALS.length);
    expect(silhouettes.size).toBe(BODY_MATERIALS.length);
  });

  it('has eight distinct complete poses and a bounded cyclic transition for every material', () => {
    for (const material of BODY_MATERIALS) {
      const frames = Array.from({ length: 8 }, (_, f) => raster(material, f));
      expect(new Set(frames.map(p => p.data.join(','))).size, material).toBe(8);
      expect(delta(raster(material, 8), frames[0])).toBe(0);
      expect(delta(raster(material, -1), frames[7])).toBe(0);
      expect(delta(raster(material, NaN), frames[0])).toBe(0);
      const changes = frames.map((p, f) => delta(p, frames[(f + 1) % 8]));
      expect(Math.min(...changes), `${material} moving front`).toBeGreaterThan(0);
      expect(changes[7], `${material} cyclic seam`).toBeLessThanOrEqual(Math.max(...changes.slice(0, 7)) * 1.4);
      const counts = frames.map(p => occupied(p).length);
      expect(Math.min(...counts), `${material} complete poses`).toBeGreaterThan(Math.max(...counts) * .4);
    }
  });

  it('makes the lightning surge move from source toward the tip over its residual channel', () => {
    const bright = (f: number): number => {
      const p = raster('raio', f), last = SIGNATURE_RAMPS.raio[SIGNATURE_RAMPS.raio.length - 1];
      const xs = occupied(p).filter(i => last.every((v, k) => p.data[i * 4 + k] === v)).map(i => i % p.w);
      return xs.reduce((sum, n) => sum + n, 0) / xs.length;
    };
    expect(bright(2)).toBeGreaterThan(bright(1));
    expect(bright(4)).toBeGreaterThan(bright(2));
    expect(bright(6)).toBeGreaterThan(bright(4));
  });

  it('keeps every material feed attached at both ends and visually material-specific', () => {
    const feeds = new Set<string>();
    for (const material of BODY_MATERIALS) for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(80, 35);
      paintMaterialStreamFeed(p, [5, 12], [66, 18], GRAY_RAMP, material, frame);
      expect(alpha(p, 5, 12), material).toBe(255); expect(alpha(p, 66, 18), material).toBe(255);
      for (let x = 5; x <= 66; x++) expect(occupied(p).some(i => i % p.w === x), `${material} feed x${x}`).toBe(true);
      if (frame === 0) feeds.add(p.data.join(','));
    }
    expect(feeds.size).toBe(BODY_MATERIALS.length);
  });

  it('normalizes invalid scales and treats empty palettes as an empty draw', () => {
    for (const material of BODY_MATERIALS) {
      for (const scale of [0, -1, NaN, Infinity]) expect(delta(raster(material, 0, scale), raster(material, 0, 1))).toBe(0);
      const p = new Pix(30, 20);
      expect(paintMaterialStream(p, 15, 10, 2, [], material)).toEqual({ l: 9, r: 21, t: 8, b: 11.6 });
      paintMaterialStreamFeed(p, [2, 3], [15, 10], [], material);
      expect(occupied(p)).toHaveLength(0);
    }
  });
});
