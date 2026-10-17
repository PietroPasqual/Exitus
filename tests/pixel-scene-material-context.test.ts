import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Being } from '../src/core/appearance';
import { paintMaterialInteraction } from '../src/ui/pixel-material-interaction';
import { renderPixelScene } from '../src/ui/pixel-scene';

vi.mock('../src/ui/pixel-material-interaction', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/ui/pixel-material-interaction')>();
  return { ...actual, paintMaterialInteraction: vi.fn(actual.paintMaterialInteraction) };
});

const body = (elements: string[], extra: Partial<Being> = {}): Being => ({
  elements, shapes: ['forma_esfera'], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: null, guards: [], estado: false, linked: false, merged: false,
  bond: null, closed: false, ...extra
});
const calls = vi.mocked(paintMaterialInteraction);
const render = (being: Being, frame = 0) => renderPixelScene({ beings: [being], orbitCount: 0 }, true, frame);

describe('production material geometry context', () => {
  beforeEach(() => { calls.mockClear(); });

  it('uses dragon anatomy only when the authored water dragon was selected', () => {
    render(body(['agua', 'gelo'], { intentForm: 'dragao' }));
    expect(calls.mock.lastCall?.[3]?.form).toBe('dragao');
    render(body(['gelo', 'agua'], { intentForm: 'dragao' }));
    expect(calls.mock.lastCall?.[3]?.form).toBeUndefined();
    render(body(['agua', 'gelo'], { intentGlyph: 'CURA' }));
    expect(calls.mock.lastCall?.[3]?.form).toBeUndefined();
  });

  it('does not apply a sphere-only material adapter to multipart shapes', () => {
    render(body(['sombra', 'gelo']));
    expect(calls).not.toHaveBeenCalled(); // Authored pair owns the whole single sphere.
    render(body(['sombra', 'gelo'], { shapes: ['forma_esfera', 'forma_cubo'] }));
    expect(calls.mock.calls.slice(-2).every(call => call[3]?.shapeForm === undefined)).toBe(true);
  });

  it.each([['agua', 'gelo'], ['gelo', 'agua']])('keeps the authored %s/%s sphere out of the generic recoloring pass', (a, b) => {
    for (let phase = 0; phase < 8; phase++) render(body([a, b]), phase);
    expect(calls).not.toHaveBeenCalled();
    render(body([a, b, 'fogo']));
    expect(calls.mock.lastCall?.[3]?.form).toBe('esfera');
  });

  it.each([['raio', 'metal'], ['metal', 'raio'], ['agua', 'metal'], ['metal', 'agua'], ['fogo', 'terra'], ['terra', 'fogo']])
    ('keeps %s/%s construction intact but leaves its third constituent on the full mixture path', (a, b) => {
      for (let phase = 0; phase < 8; phase++) render(body([a, b]), phase);
      expect(calls).not.toHaveBeenCalled();
      render(body([a, b, 'natureza']));
      expect(calls).toHaveBeenCalled();
      expect(calls.mock.lastCall?.[2].map(material => material.element)).toEqual([a, b, 'natureza']);
    });

  it('keeps other material mappings unchanged and mirrors actual returning dragon contacts', () => {
    render(body(['fogo', 'raio']));
    expect(calls.mock.lastCall?.[3]?.surfaceBounds).toBeUndefined();
    const returning = body(['agua', 'gelo'], { intentForm: 'dragao', placement: 'self', projectile: true, direction: 'back' });
    render(returning, 5);
    expect(calls.mock.lastCall?.[3]).toMatchObject({ form: 'dragao', reverse: true, frame: 5 });
  });

  it('does not infer palette fusion when exact physical groups are missing or empty', () => {
    const legacy = body(['fogo', 'raio'], { shapes: ['forma_esfera', 'forma_cubo'], linked: true, merged: true });
    const empty = { ...legacy, materialFusion: [] };
    for (const phase of [0, 3, 7]) expect(render(legacy, phase).pix.data).toEqual(render(empty, phase).pix.data);
    expect(render({ ...legacy, materialFusion: [{ family: 'materia', elements: ['fogo', 'raio'] }] }).pix.data)
      .not.toEqual(render(empty).pix.data);
  });

  it('keeps the ownership reference fixed while authored sphere and dragon bodies move', () => {
    for (const intentForm of [undefined, 'dragao'] as const) {
      calls.mockClear();
      const being = body(['agua', 'metal', 'gelo'], { intentForm });
      for (let phase = 0; phase < 8; phase++) render(being, phase);
      const refs = calls.mock.calls.map(call => call[3]?.ownershipBody);
      expect(refs.every(Boolean)).toBe(true);
      for (const p of refs) expect(p!.data.length === refs[0]!.data.length && p!.data.every((value, i) => value === refs[0]!.data[i])).toBe(true);
    }
  });
});
