import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintLightningMetalSphere } from '../src/ui/pixel-lightning-metal-sphere';
import { paintShadowIceSphere } from '../src/ui/pixel-shadow-ice-sphere';

const colorAt = (p: Pix, x: number, y: number): string =>
  Array.from(p.data.subarray((y * p.w + x) * 4, (y * p.w + x) * 4 + 3)).join(',');
const shadowColors = new Set(['16,15,28', '33,26,52', '56,40,70', '91,66,109', '148,113,164']);
const iceColors = new Set(['35,50,79', '61,98,148', '97,157,201', '144,216,231', '197,241,239', '244,255,255']);
const drawCharge = (frame: number, primary: 'metal' | 'raio' = 'metal', size = 22, delta = 0): Pix => {
  const p = new Pix(64, 64); paintLightningMetalSphere(p, 32 + delta, 32 + delta, size, frame, primary); return p;
};
const drawCrystal = (frame: number, primary: 'sombra' | 'gelo' = 'sombra', size = 22, delta = 0): Pix => {
  const p = new Pix(64, 64); paintShadowIceSphere(p, 32 + delta, 32 + delta, size, frame, primary); return p;
};

describe('grounded energy junctions', () => {
  it('conducts two warm reflected leaders from the electrodes toward the middle and lets them cool', () => {
    const warmPixels = (frame: number) => {
      const p = drawCharge(frame), positions: { x: number; y: number }[] = [];
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++)
        if (colorAt(p, x, y) === '246,231,151') positions.push({ x, y });
      return positions;
    };
    const roots = warmPixels(0), contact = warmPixels(4);
    expect(roots.some(p => p.y < 25)).toBe(true);
    expect(roots.some(p => p.y > 39)).toBe(true);
    expect(contact.length).toBeGreaterThan(0);
    expect(contact.every(p => Math.abs(p.y - 32) < 5)).toBe(true);
    expect(warmPixels(6)).toHaveLength(0);
    expect(warmPixels(7)).toHaveLength(0);
  });

  it('lights the seam without flashing or eroding the rigid steel volume', () => {
    const poses = Array.from({ length: 8 }, (_, frame) => drawCharge(frame));
    let occupied = 0, unchanged = 0, steel = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const at = (y * 64 + x) * 4;
      if (!poses[0].data[at + 3]) continue;
      occupied++;
      expect(poses.every(p => p.data[at + 3] === 255)).toBe(true);
      if (poses.every(p => colorAt(p, x, y) === colorAt(poses[0], x, y))) unchanged++;
      if (['101,118,132', '147,163,171', '64,77,94'].includes(colorAt(poses[0], x, y))) steel++;
    }
    expect(unchanged / occupied).toBeGreaterThan(.65);
    expect(steel / occupied).toBeGreaterThan(.3);
  });

  it('keeps the shadow lapping at a connected crystal root, with cold planes above it', () => {
    for (const primary of ['sombra', 'gelo'] as const) {
      const poses = Array.from({ length: 8 }, (_, frame) => drawCrystal(frame, primary));
      let exchanges = 0, upperExchanges = 0;
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const colors = poses.map(p => colorAt(p, x, y));
        if (colors.some(c => shadowColors.has(c)) && colors.some(c => iceColors.has(c))) {
          exchanges++;
          if (y < 22) upperExchanges++;
        }
      }
      expect(exchanges).toBeGreaterThan(6);
      expect(upperExchanges).toBe(0);
      for (const pose of poses) {
        const colors = new Set<string>();
        let dark = 0, ice = 0;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          const at = (y * 64 + x) * 4;
          if (!pose.data[at + 3]) continue;
          const color = colorAt(pose, x, y); colors.add(color);
          if (shadowColors.has(color)) dark++;
          if (iceColors.has(color)) ice++;
          expect(shadowColors.has(color) || iceColors.has(color)).toBe(true);
        }
        // Broad blue planes and the black-purple void remain separately legible.
        expect(colors.has('144,216,231')).toBe(true);
        expect(colors.has('61,98,148')).toBe(true);
        expect(colors.has('16,15,28')).toBe(true);
        expect(dark).toBeGreaterThan(ice * .5);
        expect(ice).toBeGreaterThan(70);
      }
    }
  });

  it('retains exact loops and occupied masks through tiny and fractional junctions', () => {
    for (const size of [1, 3, 7, 15, 22]) for (const delta of [0, .25, .5, .75]) {
      for (const primary of ['sombra', 'gelo'] as const) {
        const rest = drawCrystal(0, primary, size, delta);
        for (let frame = 0; frame < 8; frame++) {
          const pose = drawCrystal(frame, primary, size, delta);
          expect(pose.data.every((v, i) => i % 4 !== 3 || v === rest.data[i])).toBe(true);
          expect(drawCrystal(frame + 8, primary, size, delta).data.every((v, i) => v === pose.data[i])).toBe(true);
        }
      }
      for (const primary of ['metal', 'raio'] as const) for (let frame = 0; frame < 8; frame++) {
        const pose = drawCharge(frame, primary, size, delta);
        expect(drawCharge(frame + 8, primary, size, delta).data.every((v, i) => v === pose.data[i])).toBe(true);
      }
    }
  });
});
