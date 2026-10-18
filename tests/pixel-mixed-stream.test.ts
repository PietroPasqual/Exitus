import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintMaterialStream, materialStreamBounds } from '../src/ui/pixel-material-stream';
import { paintMixedMaterialStream, type StreamMaterial } from '../src/ui/pixel-mixed-stream';
import type { BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { GRAY_RAMP, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const CASES: readonly (readonly BodyMaterial[])[] = [
  ['agua', 'gelo'], ['gelo', 'agua'], ['raio', 'metal'], ['metal', 'raio'], ['agua', 'gelo', 'fogo']
];
const materials = (elements: readonly BodyMaterial[], gray = false): StreamMaterial[] => elements.map(element => ({ element, ramp: gray ? GRAY_RAMP : SIGNATURE_RAMPS[element] }));
const render = (elements: readonly BodyMaterial[], frame = 0, scale = 15, gray = false): Pix => {
  const p = new Pix(180, 105); paintMixedMaterialStream(p, 90.5, 52.5, scale, materials(elements, gray), frame); return p;
};
const pixels = (p: Pix): number[] => {
  const list: number[] = [];
  for (let i = 0; i < p.w * p.h; i++) if (p.data[i * 4 + 3]) list.push(i);
  return list;
};
const delta = (a: Pix, b: Pix): number => {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
};
const owned = (p: Pix, material: BodyMaterial): number[] => {
  const palette = new Set(SIGNATURE_RAMPS[material].map(c => c.join(',')));
  return pixels(p).filter(i => palette.has(`${p.data[i * 4]},${p.data[i * 4 + 1]},${p.data[i * 4 + 2]}`));
};

describe('Authored contact adapters for maintained mixed streams', () => {
  it('handles only the five reviewed exact ordered sequences, without dropping other materials', () => {
    for (const elements of CASES) expect(paintMixedMaterialStream(new Pix(180, 105), 90, 52, 15, materials(elements))).toEqual({ l: 45, r: 135, t: 37, b: 64 });
    for (const elements of [[], ['agua'], ['fogo'], ['agua', 'metal'], ['agua', 'gelo', 'metal'], ['gelo', 'agua', 'fogo'], ['agua', 'gelo', 'fogo', 'metal'], ['agua', 'gelo', 'gelo']] as BodyMaterial[][]) {
      const p = new Pix(180, 105), before = new Pix(180, 105); p.set(50, 50, [37, 45, 72]); before.data.set(p.data);
      expect(paintMixedMaterialStream(p, 90, 52, 15, materials(elements)), elements.join('/')).toBeUndefined();
      expect(delta(p, before)).toBe(0);
    }
    expect(paintMixedMaterialStream(new Pix(30, 20), 15, 10, 2, [{ element: 'agua', ramp: [] }, { element: 'gelo', ramp: SIGNATURE_RAMPS.gelo }])).toBeUndefined();
  });

  it('keeps all poses, contact additions and source pixels within the common envelope', () => {
    for (const elements of CASES) for (const scale of [1, 2, 3, 6, 10, 15]) for (let f = 0; f < 8; f++) {
      const p = render(elements, f, scale), q = materialStreamBounds(scale), list = pixels(p);
      expect(list.every(i => {
        const x = i % p.w, y = Math.floor(i / p.w);
        return x >= 90.5 + q.l && x <= 90.5 + q.r && y >= 52.5 + q.t && y <= 52.5 + q.b;
      }), `${elements} s${scale} f${f} bounds`).toBe(true);
      const left = Math.ceil(90.5 + q.l), sourceY = 52.5 + scale * .25;
      expect(list.some(i => i % p.w <= left + 1 && Math.abs(Math.floor(i / p.w) - sourceY) <= Math.max(1, scale * .12)), `${elements} s${scale} f${f} source`).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it('preserves primary volume and a visible second material in every native pose', () => {
    for (const elements of CASES) for (let f = 0; f < 8; f++) {
      const p = render(elements, f), primary = owned(p, elements[0]), secondary = owned(p, elements[1]);
      expect(primary.length, `${elements} f${f} primary volume`).toBeGreaterThan(secondary.length * 1.5);
      expect(secondary.length, `${elements} f${f} secondary contact`).toBeGreaterThan(50);
      const primaryOnly = new Pix(180, 105);
      paintMaterialStream(primaryOnly, 90.5, 52.5, 15, SIGNATURE_RAMPS[elements[0]], elements[0], f);
      expect(delta(p, primaryOnly), `${elements} actual contact work`).toBeGreaterThan(50);
    }
    for (const [a, b] of [[CASES[0], CASES[1]], [CASES[2], CASES[3]]]) expect(delta(render(a, 0, 15, true), render(b, 0, 15, true))).toBeGreaterThan(100);
  });

  it('contains only hard pixels from the participating palettes, with dark steel faces retained', () => {
    for (const elements of CASES) for (let f = 0; f < 8; f++) {
      const p = render(elements, f), palette = new Set(elements.flatMap(e => SIGNATURE_RAMPS[e].map(c => c.join(','))));
      expect(pixels(p).every(i => p.data[i * 4 + 3] === 255 && palette.has(`${p.data[i * 4]},${p.data[i * 4 + 1]},${p.data[i * 4 + 2]}`))).toBe(true);
      if (elements.includes('metal')) {
        const dark = SIGNATURE_RAMPS.metal[1];
        expect(pixels(p).filter(i => dark.every((n, k) => p.data[i * 4 + k] === n)).length, `${elements} f${f} dark steel`).toBeGreaterThan(6);
      }
    }
  });

  it('advects the third fire as a small rooted fold instead of a stationary colored patch', () => {
    const centroids: number[] = [];
    for (let f = 0; f < 8; f++) {
      const p = render(CASES[4], f), fire = owned(p, 'fogo'), count = pixels(p).length;
      expect(fire.length).toBeGreaterThan(count * .025); expect(fire.length).toBeLessThan(count * .2);
      centroids.push(fire.reduce((sum, i) => sum + i % p.w, 0) / fire.length);
      const contact = fire.some(i => {
        for (const offset of [-1, 1, -p.w, p.w]) {
          const n = i + offset;
          if (n >= 0 && p.data[n * 4 + 3] && !fire.includes(n)) return true;
        }
        return false;
      });
      expect(contact, `fire rooted f${f}`).toBe(true);
    }
    expect(centroids[2]).toBeGreaterThan(centroids[1]); expect(centroids[4]).toBeGreaterThan(centroids[2]);
    expect(Math.max(...centroids) - Math.min(...centroids)).toBeGreaterThan(50);
  });

  it('retains eight complete deterministic frames and a bounded loop seam', () => {
    for (const elements of CASES) {
      const frames = Array.from({ length: 8 }, (_, f) => render(elements, f));
      expect(new Set(frames.map(p => p.data.join(','))).size, elements.join('/')).toBe(8);
      expect(delta(render(elements, 8), frames[0])).toBe(0); expect(delta(render(elements, -1), frames[7])).toBe(0);
      expect(delta(render(elements, NaN), frames[0])).toBe(0);
      const changes = frames.map((p, f) => delta(p, frames[(f + 1) % 8]));
      expect(changes[7]).toBeLessThanOrEqual(Math.max(...changes.slice(0, 7)) * 1.4);
      const counts = frames.map(p => pixels(p).length);
      expect(Math.min(...counts)).toBeGreaterThan(Math.max(...counts) * .65);
    }
  });
});
