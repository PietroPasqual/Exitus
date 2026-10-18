import { describe, expect, it } from 'vitest';
import type { Appearance, Being } from '../src/core/appearance';
import { appearanceForScene, layoutScene } from '../src/ui/pixel-scene-layout';
import { renderPixelScene } from '../src/ui/pixel-scene';
import { Pix, rgb } from '../src/ui/pixel';
import { paintSpellSprite, spellSpriteOf } from '../src/ui/pixel-spell-sprites';

const being = (element: string, shape = 'forma_esfera'): Being => ({
  elements: [element], shapes: [shape], concepts: [], placement: 'front',
  projectile: false, orbit: false, direction: null, guards: [], estado: false,
  linked: false, merged: false, bond: null, closed: false
});
const appearance = (b: Being): Appearance => ({ beings: [b], orbitCount: 0 });

describe('Protected sculpted spell bodies', () => {
  it.each(['raio'])('%s keeps its spherical material visible below every moving accent', element => {
    const ap = appearanceForScene(appearance(being(element)));
    const pose = layoutScene(ap).poses.get(ap.beings[0])!;
    const radius = pose.s * .82;
    for (const night of [false, true]) {
      const still = renderPixelScene(ap, night).pix;
      for (let frame = 1; frame < 8; frame++) {
        const next = renderPixelScene(ap, night, frame).pix;
        for (let y = Math.ceil(pose.y - radius); y <= pose.y + radius; y++)
          for (let x = Math.ceil(pose.x - radius); x <= pose.x + radius; x++) {
            if (Math.hypot(x - pose.x, y - pose.y) > radius) continue;
            const i = (y * still.w + x) * 4;
            expect(Array.from(next.data.slice(i, i + 4))).toEqual(Array.from(still.data.slice(i, i + 4)));
          }
      }
    }
  });

  it.each([
    ['vento', ['#0b5a45', '#0ca678', '#38d9a9', '#96f2d7', '#e6fcf5']],
    ['natureza', ['#1e5e2a', '#2b8a3e', '#40c057', '#8ce99a', '#ebfbee']],
    ['sombra', ['#10101d', '#242039', '#48415e', '#766b8d', '#b8adcf']],
    ['luz', ['#a65f00', '#f59f00', '#ffd43b', '#fff3bf', '#ffffff']]
  ] as const)('%s preserves every authored moving pixel below its exterior aura', (element, colors) => {
    const ap = appearance(being(element)), pose = layoutScene(ap).poses.get(ap.beings[0])!;
    const sprite = spellSpriteOf(ap.beings[0])!, ramp = colors.map(rgb);
    for (const night of [false, true]) for (let frame = 0; frame < 8; frame++) {
      const body = new Pix(180, 105), scene = renderPixelScene(ap, night, frame).pix;
      paintSpellSprite(sprite, body, pose.x, pose.y, pose.s, ramp, 3, frame);
      let pixels = 0, preserved = true;
      for (let i = 0; i < body.data.length; i += 4) {
        if (!body.data[i + 3]) continue;
        pixels++;
        for (let c = 0; c < 4; c++) preserved &&= body.data[i + c] === scene.data[i + c];
      }
      expect(pixels).toBeGreaterThan(0);
      expect(preserved).toBe(true);
    }
  });

  it('keeps the sky and terrain stable throughout the new flame silhouette loop', () => {
    const fire = being('fogo'); fire.shapes = [];
    const ap = appearance(fire), still = renderPixelScene(ap, true).pix;
    for (let frame = 1; frame < 8; frame++) {
      const next = renderPixelScene(ap, true, frame).pix;
      for (const [x, y] of [[10, 10], [70, 18], [150, 20], [80, 100], [130, 90]]) {
        const i = (y * still.w + x) * 4;
        expect(Array.from(next.data.slice(i, i + 4))).toEqual(Array.from(still.data.slice(i, i + 4)));
      }
    }
  });
});
