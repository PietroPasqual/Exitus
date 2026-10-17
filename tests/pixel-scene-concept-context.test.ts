import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Being } from '../src/core/appearance';
import { paintConceptAura } from '../src/ui/pixel-concept-fx';
import { paintMaterialInteraction } from '../src/ui/pixel-material-interaction';
import { renderPixelScene } from '../src/ui/pixel-scene';
import { appearanceForScene, layoutScene } from '../src/ui/pixel-scene-layout';

vi.mock('../src/ui/pixel-concept-fx', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/ui/pixel-concept-fx')>();
  return { ...actual, paintConceptAura: vi.fn(actual.paintConceptAura) };
});
vi.mock('../src/ui/pixel-material-interaction', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/ui/pixel-material-interaction')>();
  return { ...actual, paintMaterialInteraction: vi.fn(actual.paintMaterialInteraction) };
});
const body = (extra: Partial<Being> = {}): Being => ({
  elements: ['agua','metal','gelo'], shapes: ['forma_esfera'], concepts: ['vida'], placement: 'front',
  projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false, ...extra
});
const aura = vi.mocked(paintConceptAura), material = vi.mocked(paintMaterialInteraction);

describe('concept contours receive the completed material surface', () => {
  beforeEach(() => { aura.mockClear(); material.mockClear(); });
  it.each([undefined, 'dragao', 'lanca'] as const)('passes actual %s body bounds after material contact', intentForm => {
    renderPixelScene({ beings: [body({ intentForm })], orbitCount: 0 }, true, 4);
    const options = aura.mock.lastCall?.[6];
    expect(options?.body).toBeDefined();
    expect(options?.bodyBounds).toBeDefined();
    expect(options?.glow).toBe(false);
    expect(options!.body!.data.some((value, i) => i % 4 === 3 && value > 0)).toBe(true);
    expect(aura.mock.invocationCallOrder[0]).toBeGreaterThan(material.mock.invocationCallOrder[0]);
  });
  it('does not invent a solid body for an incorporeal concept', () => {
    renderPixelScene({ beings: [body({ elements: [], shapes: [] })], orbitCount: 0 }, true, 4);
    expect(aura.mock.lastCall?.[6]?.body).toBeUndefined();
    expect(aura.mock.lastCall?.[6]?.glow).toBe(true);
    expect(material).not.toHaveBeenCalled();
  });
});


describe('scene-wide concept occlusion', () => {
  it.each([2, 5, 6])('keeps previous bodies and caster face intact at crowded phase %s', async phase => {
    const actual = await vi.importActual<typeof import('../src/ui/pixel-concept-fx')>('../src/ui/pixel-concept-fx');
    const all = ['tempo','movimento','pressao','caos','infinito','vazio','vida','morte'];
    const fixtures = [
      [body({ elements: ['agua'], concepts: all, placement: 'self', projectile: true, direction: 'back' }),
        ...Array.from({ length: 6 }, () => body({ elements: ['agua'], concepts: ['pressao','vida'], orbit: true }))],
      Array.from({ length: 8 }, () => body({ elements: ['agua'], shapes: [], intentGlyph: 'AB', concepts: all.slice(0, 4), orbit: true }))
    ];
    try {
      for (const beings of fixtures) {
        const ap = { beings, orbitCount: beings.filter(b => b.orbit).length };
        aura.mockImplementation(actual.paintConceptAura); aura.mockClear();
        const withAura = renderPixelScene(ap, true, phase).pix;
        const layers = aura.mock.calls.map(call => call[6]?.body).filter(layer => !!layer);
        expect(aura.mock.calls.every(call => call[6]?.protectedPixels?.length === 180 * 105)).toBe(true);
        aura.mockImplementation(() => {});
        const clean = renderPixelScene(ap, true, phase).pix;
        const { casterX } = layoutScene(appearanceForScene(ap), phase);
        for (let y = 0; y < 105; y++) for (let x = 0; x < 180; x++) {
          const at = (y * 180 + x) * 4;
          const face = Math.hypot((x + .5 - (casterX + 3)) / 2.6, (y + .5 - 74.5) / 3) <= 1;
          const visibleBody = layers.some(layer => layer!.data[at + 3] && [0, 1, 2].every(c => layer!.data[at + c] === clean.data[at + c]));
          if (face || visibleBody) expect(withAura.data.subarray(at, at + 4)).toEqual(clean.data.subarray(at, at + 4));
        }
      }
    } finally { aura.mockImplementation(actual.paintConceptAura); }
  });
});
