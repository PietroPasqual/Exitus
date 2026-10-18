import { describe, expect, it } from 'vitest';
import { Pix, type RGB } from '../src/ui/pixel';
import { paintMixedMaterialStream } from '../src/ui/pixel-mixed-stream';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const ORDERS = [['raio', 'metal'], ['metal', 'raio']] as const;
const render = (order: typeof ORDERS[number], frame: number, scale = 12): Pix => {
  const pix = new Pix(180, 105);
  paintMixedMaterialStream(pix, 90.5, 52.5, scale, order.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })), frame);
  return pix;
};
const pixelsOf = (pix: Pix, color: RGB): number[] => {
  const result: number[] = [];
  for (let i = 0; i < pix.w * pix.h; i++) if (pix.data[i * 4 + 3] && color.every((v, c) => v === pix.data[i * 4 + c])) result.push(i);
  return result;
};
const whites = (pix: Pix): number[] => pixelsOf(pix, SIGNATURE_RAMPS.raio[5]);
const meanX = (pix: Pix): number => whites(pix).reduce((sum, i) => sum + i % pix.w, 0) / whites(pix).length;

// These exercise the actual ordered painter at native production-like size.
// Repeating frame 8 alone would not catch a cell-index phase that visibly
// jumps when the material train permutes between the last and first poses.
describe('One propagated charge through moving steel contacts', () => {
  it('reserves the bright peak for one compact contact in every pose', () => {
    for (const order of ORDERS) for (const scale of [12, 15]) for (let frame = 0; frame < 8; frame++) {
      const pix = render(order, frame, scale), xs = whites(pix).map(i => i % pix.w);
      expect(xs.length, `${order}, f${frame}, s${scale}`).toBeGreaterThan(2);
      expect(Math.max(...xs) - Math.min(...xs), `${order}, f${frame}: repeated cells must not flash together`).toBeLessThan(scale);
    }
  });

  it('gives the compact white peak a yellow contact base distinct from steel reflections', () => {
    for (const order of ORDERS) for (let frame = 0; frame < 8; frame++) {
      const pix = render(order, frame), bright = whites(pix), yellow = pixelsOf(pix, SIGNATURE_RAMPS.raio[3]);
      const rootedYellow = yellow.filter(i => bright.some(j => Math.abs(i % pix.w - j % pix.w) <= 2 && Math.abs(Math.floor(i / pix.w) - Math.floor(j / pix.w)) <= 2));
      expect(rootedYellow.length, `${order}, f${frame}: a bare white glint is not a charge pocket`).toBeGreaterThanOrEqual(2);
    }
  });

  it('hands the lightning-first peak among all three actual plates while overtaking their motion', () => {
    const owners: number[] = [], centers = [.08, .34, .69];
    for (let frame = 0; frame < 8; frame++) {
      const pix = render(ORDERS[0], frame), contactOwners = new Set<number>();
      for (const p of whites(pix)) {
        const u = (p % pix.w - 54.5) / 72;
        const gaps = centers.map(center => Math.abs(((u - frame / 8 - center + 1.5) % 1) - .5));
        contactOwners.add(gaps.indexOf(Math.min(...gaps)));
      }
      expect(contactOwners.size, `f${frame}: one plate should hold the peak`).toBe(1);
      owners.push([...contactOwners][0]);
    }
    expect(new Set(owners).size).toBe(3);
    expect(owners[7]).toBe(owners[0]); // The same plate crosses the boundary while its charge advances.
    for (const start of [0, 4]) for (let frame = start + 1; frame < start + 4; frame++) {
      expect(meanX(render(ORDERS[0], frame))).toBeGreaterThan(meanX(render(ORDERS[0], frame - 1)));
    }
  });

  it('carries the metal-first peak downstream through distinct rail cells and back through the source seam', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => render(ORDERS[1], frame));
    const positions = frames.map(meanX);
    for (let frame = 1; frame < 8; frame++) expect(positions[frame]).toBeGreaterThan(positions[frame - 1] + 1);
    expect(positions[0]).toBeLessThan(54.5 + 72 * .16);
    expect(positions[7]).toBeGreaterThan(54.5 + 72 * .88);
    expect(render(ORDERS[1], 8).data).toEqual(frames[0].data);
    expect(render(ORDERS[1], -1).data).toEqual(frames[7].data);
  });
});
