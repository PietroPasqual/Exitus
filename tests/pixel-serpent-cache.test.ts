import { describe, expect, it, vi } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';

const fusedSerpent = (elements: string[]): Appearance => {
  const being: Being = {
    elements, shapes: ['forma_esfera'], concepts: [], intentForm: 'serpente',
    placement: 'front', projectile: false, orbit: false, direction: null,
    guards: [], estado: false, linked: true, merged: true,
    materialFusion: [{ family: 'materia', elements: ['natureza', 'ilusao'] }],
    bond: null, closed: false
  };
  return { beings: [being], orbitCount: 0 };
};

describe('serpent rest-reference cache identity', () => {
  it('keeps fused nature/illusion artwork independent of the previously rendered primary', async () => {
    // The two valid fusion orders share their averaged palette and energy
    // material, but their primary elements author different surface marks.
    const nature = fusedSerpent(['natureza', 'ilusao']);
    const illusion = fusedSerpent(['ilusao', 'natureza']);
    vi.resetModules();
    const cold = await import('../src/ui/pixel-scene');
    const expected = cold.renderPixelScene(illusion, true, 0);
    vi.resetModules();
    const warm = await import('../src/ui/pixel-scene');
    warm.renderPixelScene(nature, true, 0);
    const actual = warm.renderPixelScene(illusion, true, 0);
    expect(actual.pix.data).toEqual(expected.pix.data);
    expect(actual.labels).toEqual(expected.labels);
  });
});
