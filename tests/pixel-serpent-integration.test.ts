import { describe, expect, it, vi } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';
import { BODY_MATERIALS } from '../src/ui/pixel-mixture-signatures';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { renderPixelScene } from '../src/ui/pixel-scene';
import { appearanceForScene, boundsOfBeing, layoutScene } from '../src/ui/pixel-scene-layout';

vi.mock('../src/ui/pixel-mixture-compositor', { spy: true });
const allocation = vi.mocked(paintAllocatedMixture);
const being = (elements: string[]): Being => ({
  elements, shapes: ['forma_esfera'], concepts: [], intentForm: 'serpente',
  placement: 'front', projectile: false, orbit: false, direction: null,
  guards: [], estado: false, linked: false, merged: false, materialFusion: [], bond: null, closed: false
});
const appearance = (beings: Being[]): Appearance => ({ beings, orbitCount: beings.filter(b => b.orbit).length });

describe('serpent art in actual spell scenes', () => {
  it.each(BODY_MATERIALS)('keeps %s mixture ownership attached to one authored rest body through the loop', element => {
    const index = BODY_MATERIALS.indexOf(element);
    const ap = appearance([being([element, BODY_MATERIALS[(index + 1) % BODY_MATERIALS.length]])]);
    const input = JSON.stringify(ap);
    let rest: Uint8ClampedArray | undefined;
    for (let frame = 0; frame < 8; frame++) {
      allocation.mockClear();
      const rendered = renderPixelScene(ap, true, frame);
      const options = allocation.mock.calls[0]?.[3];
      const report = allocation.mock.results[0]?.value;
      expect(options?.form).toBe('serpente');
      expect(options?.preserveAuthoredPrimary).toBe(true);
      expect(options?.ownershipBody).toBeDefined();
      if (!rest) rest = options!.ownershipBody!.data.slice();
      else expect(options!.ownershipBody!.data.every((value, i) => value === rest![i])).toBe(true);
      expect(report?.budget.subpixel).toEqual([]);
      const wrapped = renderPixelScene(ap, true, frame + 8);
      expect(rendered.pix.data.every((value, i) => value === wrapped.pix.data[i])).toBe(true);
      expect(wrapped.labels).toEqual(rendered.labels);
      expect(JSON.stringify(ap)).toBe(input);
    }
  });

  it.each(['copies', 'return', 'orbits'] as const)('fits the full serpent envelope in %s without changing input or border', mode => {
    const source = being(['agua', 'metal', 'natureza']);
    if (mode === 'copies') source.intentCount = '6';
    if (mode === 'return') { source.placement = 'flight'; source.projectile = true; source.direction = 'back'; }
    if (mode === 'orbits') source.orbit = true;
    const ap = appearance(mode === 'orbits' ? Array.from({ length: 8 }, () => structuredClone(source)) : [source]);
    const before = JSON.stringify(ap), visual = appearanceForScene(ap);
    for (let frame = 0; frame < 8; frame++) {
      const layout = layoutScene(visual, frame), actual = renderPixelScene(ap, false, frame).pix;
      const empty = renderPixelScene(appearance([]), false, frame).pix;
      for (const body of visual.beings) {
        const box = boundsOfBeing(body, layout.poses.get(body)!);
        expect(box.l).toBeGreaterThanOrEqual(2); expect(box.r).toBeLessThanOrEqual(178);
        expect(box.t).toBeGreaterThanOrEqual(2); expect(box.b).toBeLessThanOrEqual(99.001);
      }
      let intact = true;
      for (let y = 0; y < actual.h; y++) for (let x = 0; x < actual.w; x++) {
        if (x && y && x !== actual.w - 1 && y !== actual.h - 1) continue;
        const i = (y * actual.w + x) * 4;
        for (let channel = 0; channel < 4; channel++) intact &&= actual.data[i + channel] === empty.data[i + channel];
      }
      expect(intact).toBe(true); expect(JSON.stringify(ap)).toBe(before);
    }
  });
});
