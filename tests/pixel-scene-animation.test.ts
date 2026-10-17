import { describe, expect, it } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';
import { renderPixelScene } from '../src/ui/pixel-scene';

const being = (elements: string[]): Being => ({
  elements, shapes: ['forma_esfera'], concepts: [], placement: 'flight', projectile: true,
  orbit: false, direction: 'forward', guards: [], estado: false, linked: false,
  merged: false, bond: 'lança', closed: false, intentForm: 'lanca'
});
const appearance = (b: Being): Appearance => ({ beings: [b], orbitCount: 0 });
const identicalPixels = (a: Uint8ClampedArray, b: Uint8ClampedArray) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

describe('Quadros dos efeitos da magia', () => {
  it.each(['fogo', 'raio', 'agua', 'gelo', 'vento', 'sombra'])('%s tem movimento em um ciclo determinístico de oito quadros', element => {
    const ap = appearance(being([element])), before = structuredClone(ap);
    const still = renderPixelScene(ap, true);
    const signatures = new Set<string>();
    for (let frame = 0; frame < 8; frame++) {
      const scene = renderPixelScene(ap, true, frame);
      expect(identicalPixels(scene.pix.data, renderPixelScene(ap, true, frame + 8).pix.data)).toBe(true);
      expect(scene.labels).toEqual(still.labels);
      signatures.add(scene.pix.data.join(','));
      expect([scene.pix.w, scene.pix.h]).toEqual([180, 105]);
      let borderUnchanged = true;
      for (let y = 0; y < scene.pix.h; y++) for (let x = 0; x < scene.pix.w; x++) {
        if (x && y && x < scene.pix.w - 1 && y < scene.pix.h - 1) continue;
        const i = (y * scene.pix.w + x) * 4;
        for (let channel = 0; channel < 4; channel++)
          borderUnchanged &&= scene.pix.data[i + channel] === still.pix.data[i + channel];
      }
      expect(borderUnchanged).toBe(true);
    }
    expect(signatures.size).toBeGreaterThan(1);
    expect(ap).toEqual(before);
  });

  it('preserva o quadro estático para parâmetros inválidos e cenas vazias', () => {
    const ap = appearance(being(['fogo'])), still = renderPixelScene(ap, false).pix.data;
    for (const frame of [0, 8, 16, NaN, Infinity, -Infinity])
      expect(identicalPixels(renderPixelScene(ap, false, frame).pix.data, still)).toBe(true);
    const empty = { beings: [], orbitCount: 0 };
    for (let frame = 1; frame < 8; frame++)
      expect(renderPixelScene(empty, true, frame)).toEqual(renderPixelScene(empty, true));
  });
});
