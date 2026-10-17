import { describe, expect, it } from 'vitest';
import { describeAppearance, type Appearance, type Being } from '../src/core/appearance';
import { analyzeFlow } from '../src/core/flow';
import { PRESETS } from '../src/data/presets';
import { PH, PW, renderPixelScene } from '../src/ui/pixel-scene';
import { modelOf } from './helpers';

const being = (elements: string[], shapes = ['forma_esfera']): Being => ({
  elements, shapes, concepts: [], placement: 'front', projectile: false, orbit: false,
  direction: null, guards: [], estado: false, linked: false, merged: false, bond: null, closed: false
});
const appearance = (b: Being): Appearance => ({ beings: [b], orbitCount: 0 });

describe('Pixel spell scene', () => {
  it('renders every example reproducibly at the original resolution without changing its interpretation', () => {
    for (const key of Object.keys(PRESETS)) {
      const m = modelOf(key);
      const ap = describeAppearance(m, analyzeFlow(m));
      const before = structuredClone(ap);
      for (const night of [false, true]) {
        const scene = renderPixelScene(ap, night);
        const again = renderPixelScene(ap, night);
        expect([scene.pix.w, scene.pix.h]).toEqual([180, 105]);
        expect(scene.pix.data.every((value, i) => value === again.pix.data[i]), `${key}/${night}`).toBe(true);
        expect(scene.labels).toEqual(again.labels);
      }
      expect(ap, key).toEqual(before);
    }
  });

  it('keeps the frame intact around complex projectiles and orbiting bodies', () => {
    const empty = renderPixelScene({ beings: [], orbitCount: 0 }, false).pix;
    for (const key of ['m_lanca_plasmatica', 'ex5', 'm_descarga']) {
      const m = modelOf(key), pix = renderPixelScene(describeAppearance(m, analyzeFlow(m)), false).pix;
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        if (x !== 0 && x !== PW - 1 && y !== 0 && y !== PH - 1) continue;
        const i = (y * PW + x) * 4;
        expect(pix.data.slice(i, i + 4)).toEqual(empty.data.slice(i, i + 4));
      }
    }
  });

  it('leaves the scenery visible inside a concept-only aura instead of adding a solid gold object', () => {
    const concept = being([], []);
    concept.concepts = ['tempo'];
    const pix = renderPixelScene(appearance(concept), false).pix;
    let visibleScenery = 0;
    for (let y = 45; y <= 51; y++) for (let x = 89; x <= 95; x++) {
      // The gold palette has almost no blue; the lit scenery remains beneath the aura.
      if (pix.data[(y * PW + x) * 4 + 2] > 90) visibleScenery++;
    }
    expect(visibleScenery).toBeGreaterThan(40);
  });

  it.each([['agua', 'acido'], ['luz', 'raio']])('shows the second element outside the body even when %s and %s share a material', (first, second) => {
    const single = renderPixelScene(appearance(being([first])), false).pix.data;
    const combined = renderPixelScene(appearance(being([first, second])), false).pix.data;
    let changedOutside = 0;
    // Exclude the body and its secondary inner core; look for the actual accents.
    for (let y = 22; y < 76; y++) for (let x = 60; x < 126; x++) {
      if (x >= 78 && x <= 106 && y >= 34 && y <= 62) continue;
      const i = (y * PW + x) * 4;
      if (single[i] !== combined[i] || single[i + 1] !== combined[i + 1] || single[i + 2] !== combined[i + 2]) changedOutside++;
    }
    expect(changedOutside).toBeGreaterThan(0);
  });
});
