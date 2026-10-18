import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintWaterIceSphere } from '../src/ui/pixel-water-ice-sphere';
import { paintWaterMetalSphere } from '../src/ui/pixel-water-metal-sphere';

const steel = new Set(['24,28,33','46,53,60','74,83,91','111,122,130','169,181,186','225,233,231']);
const ice = new Set(['48,88,146','69,127,178','112,178,211','172,219,235','218,243,247','243,254,251']);
const colorAt = (p: Pix, i: number): string => Array.from(p.data.subarray(i * 4, i * 4 + 3)).join(',');
const occupies = (p: Pix, i: number): boolean => p.data[i * 4 + 3] !== 0;
const sameSurface = (p: Pix, colors: Set<string>, i: number): boolean => occupies(p, i) && colors.has(colorAt(p, i));
const closeLiquid = (p: Pix, colors: Set<string>, i: number, reach: number): boolean => {
  const x = i % p.w, y = Math.floor(i / p.w);
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > reach || x + dx < 0 || x + dx >= p.w || y + dy < 0 || y + dy >= p.h) continue;
    const at = (y + dy) * p.w + x + dx;
    if (occupies(p, at) && !colors.has(colorAt(p, at))) return true;
  }
  return false;
};

describe('liquid contacts answer the passing current', () => {
  for (const primary of ['agua', 'metal'] as const) it(`keeps ${primary}-led steel rigid and confines animated reflections to its wet edge`, () => {
    for (const size of [12, 20, 28]) for (const offset of [0, .5]) {
      const frames = Array.from({length: 8}, (_, frame) => {
        const p = new Pix(90, 90); paintWaterMetalSphere(p, 45 + offset, 43 + offset, size, frame, primary); return p;
      });
      let movingSteel = 0, movedOutline = 0, changedOwnership = 0;
      const detachedReflections: number[] = [], flashingBevels: number[] = [];
      for (let i = 0; i < 90 * 90; i++) {
        const solid = sameSurface(frames[0], steel, i), first = colorAt(frames[0], i);
        for (const p of frames) {
          if (occupies(p, i) !== occupies(frames[0], i)) movedOutline++;
          if (sameSurface(p, steel, i) !== solid) changedOwnership++;
        }
        if (!solid || frames.every(p => colorAt(p, i) === first)) continue;
        movingSteel++;
        if (!closeLiquid(frames[0], steel, i, 2)) detachedReflections.push(i);
        // Existing polished bevels keep their constant peak, avoiding a flash
        // across the upper metal shoulder when a current passes underneath.
        if (first === '225,233,231') flashingBevels.push(i);
      }
      expect(movedOutline).toBe(0);
      expect(changedOwnership).toBe(0);
      expect(detachedReflections).toEqual([]);
      expect(flashingBevels).toEqual([]);
      expect(movingSteel).toBeGreaterThan(2);
    }
  });

  for (const primary of ['agua', 'gelo'] as const) it(`bends ${primary}-led ice glints back from submerged cuts without moving the shell`, () => {
    for (const size of [12, 20, 28]) {
      const frames = Array.from({length: 8}, (_, frame) => {
        const p = new Pix(90, 90); paintWaterIceSphere(p, 45.5, 43.5, size, frame, primary); return p;
      });
      let movingIce = 0, movedOutline = 0;
      const detachedRefractions: number[] = [];
      for (let i = 0; i < 90 * 90; i++) {
        for (const p of frames) if (occupies(p, i) !== occupies(frames[0], i)) movedOutline++;
        if (!frames.some(p => sameSurface(p, ice, i)) || frames.every(p => colorAt(p, i) === colorAt(frames[0], i))) continue;
        movingIce++;
        if (!frames.some(p => closeLiquid(p, ice, i, 3))) detachedRefractions.push(i);
      }
      expect(movedOutline).toBe(0);
      expect(detachedRefractions).toEqual([]);
      expect(movingIce).toBeGreaterThan(2);
    }
  });
});
