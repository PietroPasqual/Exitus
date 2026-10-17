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

  it.each([['agua', 'gelo'], ['gelo', 'agua']])('keeps %s/%s crystal coordinates fixed while the liquid animates', (a, b) => {
    const being = body([a, b]);
    for (let phase = 0; phase < 8; phase++) render(being, phase);
    const options = calls.mock.calls.map(call => call[3]);
    expect(options).toHaveLength(8);
    expect(options[0]?.surfaceBounds).toBeDefined();
    expect(options.every(o => o?.form === 'esfera')).toBe(true);
    for (const o of options) expect(o?.surfaceBounds).toEqual(options[0]?.surfaceBounds);
  });

  it('keeps other material mappings unchanged and mirrors actual returning dragon contacts', () => {
    render(body(['fogo', 'raio']));
    expect(calls.mock.lastCall?.[3]?.surfaceBounds).toBeUndefined();
    const returning = body(['agua', 'gelo'], { intentForm: 'dragao', placement: 'self', projectile: true, direction: 'back' });
    render(returning, 5);
    expect(calls.mock.lastCall?.[3]).toMatchObject({ form: 'dragao', reverse: true, frame: 5 });
  });
});
