import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintMaterialStream } from '../src/ui/pixel-material-stream';
import { paintMixedMaterialStream } from '../src/ui/pixel-mixed-stream';
import type { BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const palette = (element: BodyMaterial): Set<string> => new Set(SIGNATURE_RAMPS[element].map(c => c.join(',')));
const owned = (p: Pix, element: BodyMaterial): Set<number> => {
  const colors = palette(element), result = new Set<number>();
  for (let i = 0; i < p.w * p.h; i++) {
    if (p.data[i * 4 + 3] && colors.has(`${p.data[i * 4]},${p.data[i * 4 + 1]},${p.data[i * 4 + 2]}`)) result.add(i);
  }
  return result;
};
const render = (elements: BodyMaterial[], frame: number, large = false): Pix => {
  const p = new Pix(large ? 1000 : 180, large ? 400 : 105);
  paintMixedMaterialStream(p, large ? 500 : 90.5, large ? 200 : 52.5, large ? 100 : 15,
    elements.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })), frame);
  return p;
};
const samePixel = (a: Pix, b: Pix, i: number): boolean => [0, 1, 2, 3].every(k => a.data[i * 4 + k] === b.data[i * 4 + k]);
const neighbors = (width: number): number[] => [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

describe('Water follows the moving rigid ice contacts', () => {
  it('keeps a thick long face and a hard bevel instead of repeated triangular caps', () => {
    const p = render(['agua', 'gelo'], 0), ice = owned(p, 'gelo'), tops: number[] = [];
    // Four sections through the large plate's long face, away from its bevels.
    for (const u of [.55, .6, .65, .7]) {
      const x = Math.round(45.5 + u * 90), ys = [...ice].filter(i => i % p.w === x).map(i => Math.floor(i / p.w));
      expect(ys.length, `solid cross section u=${u}`).toBeGreaterThanOrEqual(6);
      tops.push(Math.min(...ys));
    }
    expect(Math.max(...tops) - Math.min(...tops), 'one oblique long face').toBeLessThanOrEqual(1);
    const darkSide = SIGNATURE_RAMPS.gelo[1];
    expect([...ice].filter(i => darkSide.every((c, k) => p.data[i * 4 + k] === c)).length).toBeGreaterThan(25);
  });

  it('wraps one connected blue current around the moving feet while preserving the primary tops', () => {
    for (let frame = 0; frame < 8; frame++) {
      const p = render(['gelo', 'agua'], frame), primary = new Pix(180, 105);
      paintMaterialStream(primary, 90.5, 52.5, 15, SIGNATURE_RAMPS.gelo, 'gelo', frame);
      const ice = owned(primary, 'gelo'), water = owned(p, 'agua');
      expect([...ice].filter(i => samePixel(p, primary, i)).length / ice.size, `retained faces f${frame}`).toBeGreaterThan(.78);
      let topCount = 0, topRetained = 0;
      for (let x = 64; x <= 129; x++) {
        let y = 0;
        while (y < p.h && !primary.data[(y * p.w + x) * 4 + 3]) y++;
        if (y === p.h) continue;
        topCount++;
        if (samePixel(p, primary, y * p.w + x)) topRetained++;
      }
      expect(topRetained / topCount, `primary upper silhouette f${frame}`).toBeGreaterThan(.94);
      const ys = [...water].map(i => Math.floor(i / p.w));
      expect(Math.max(...ys) - Math.min(...ys), `water bends around feet f${frame}`).toBeGreaterThanOrEqual(6);
      expect([...water].filter(i => neighbors(p.w).some(o => ice.has(i + o))).length / water.size,
        `water remains at the ice contact f${frame}`).toBeGreaterThan(.85);
      const remaining = new Set(water), stack = [remaining.values().next().value!];
      remaining.delete(stack[0]);
      while (stack.length) {
        const i = stack.pop()!;
        for (const offset of neighbors(p.w)) if (remaining.delete(i + offset)) stack.push(i + offset);
      }
      expect(remaining.size, `no detached water pixels f${frame}`).toBe(0);
    }
  });

  it('advects the contact current and rigid plates longitudinally at the same train speed', () => {
    // Scale 100 makes one frame's translation exact: 75 pixels right and 3 up.
    // This interior region excludes the source growth and final cut.
    for (const [elements, element] of [
      [['gelo', 'agua'], 'agua'], [['agua', 'gelo'], 'gelo']
    ] as [BodyMaterial[], BodyMaterial][]) {
      const a = owned(render(elements, 0, true), element), b = owned(render(elements, 1, true), element);
      let union = 0, shared = 0;
      for (let x = 350; x < 590; x++) for (let y = 140; y < 280; y++) {
        const before = a.has(y * 1000 + x), after = b.has((y - 3) * 1000 + x + 75);
        if (before || after) { union++; if (before && after) shared++; }
      }
      expect(union).toBeGreaterThan(1000);
      expect(shared / union, `${elements.join('/')} shared translation`).toBeGreaterThan(.99);
    }
  });

  it('lets the rooted third fire overlay the exact same water/ice contact in every pose', () => {
    for (let frame = 0; frame < 8; frame++) {
      const pair = render(['agua', 'gelo'], frame), trio = render(['agua', 'gelo', 'fogo'], frame), fire = owned(trio, 'fogo');
      expect(fire.size, `visible fire f${frame}`).toBeGreaterThan(25);
      for (let i = 0; i < pair.w * pair.h; i++) if (!fire.has(i)) expect(samePixel(pair, trio, i), `same contact f${frame} p${i}`).toBe(true);
      expect([...fire].some(i => neighbors(pair.w).some(o => pair.data[(i + o) * 4 + 3] === 255)), `rooted fire f${frame}`).toBe(true);
    }
  });
});
