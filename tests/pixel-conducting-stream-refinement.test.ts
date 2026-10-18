import { describe, expect, it } from 'vitest';
import { Pix, type RGB } from '../src/ui/pixel';
import { materialStreamBounds, paintMaterialStream } from '../src/ui/pixel-material-stream';
import { paintMixedMaterialStream } from '../src/ui/pixel-mixed-stream';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const ORDERS = [['raio', 'metal'], ['metal', 'raio']] as const;
type Order = typeof ORDERS[number];
const render = (order: Order, frame: number, scale = 15): Pix => {
  const pix = new Pix(180, 105);
  paintMixedMaterialStream(pix, 90.5, 52.5, scale, order.map(element => ({ element, ramp: SIGNATURE_RAMPS[element] })), frame);
  return pix;
};
const key = (pix: Pix, i: number): string => `${pix.data[i * 4]},${pix.data[i * 4 + 1]},${pix.data[i * 4 + 2]}`;
const palettePixels = (pix: Pix, ramp: readonly RGB[]): number[] => {
  const colors = new Set(ramp.map(color => color.join(',')));
  return Array.from({ length: pix.w * pix.h }, (_, i) => i).filter(i => pix.data[i * 4 + 3] && colors.has(key(pix, i)));
};
const components = (pix: Pix, points: readonly number[]): number[][] => {
  const remaining = new Set(points), result: number[][] = [];
  while (remaining.size) {
    const seed = remaining.values().next().value as number, group = [seed]; remaining.delete(seed);
    for (let i = 0; i < group.length; i++) {
      const p = group[i], x = p % pix.w, y = Math.floor(p / pix.w);
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        const q = yy * pix.w + xx;
        if (xx >= 0 && xx < pix.w && yy >= 0 && yy < pix.h && remaining.delete(q)) group.push(q);
      }
    }
    result.push(group);
  }
  return result;
};

// These are tests of rasterized contact behavior, not screenshots of a mockup.
describe('Moving steel contacts in the two conducting stream orders', () => {
  it('keeps a complete source-to-tip route and exact common bounds in all paused poses', () => {
    for (const order of ORDERS) for (const scale of [3, 6, 10, 15]) for (let frame = 0; frame < 8; frame++) {
      const pix = render(order, frame, scale), b = materialStreamBounds(scale);
      const left = Math.ceil(90.5 + b.l), right = Math.floor(90.5 + b.r);
      for (let x = left; x <= right; x++) {
        expect(Array.from({ length: pix.h }, (_, y) => pix.data[(y * pix.w + x) * 4 + 3]).some(Boolean), `${order} f${frame} s${scale} x${x}`).toBe(true);
      }
      for (let i = 0; i < pix.w * pix.h; i++) if (pix.data[i * 4 + 3]) {
        expect(pix.data[i * 4 + 3]).toBe(255);
        expect(i % pix.w).toBeGreaterThanOrEqual(left); expect(i % pix.w).toBeLessThanOrEqual(right);
        expect(Math.floor(i / pix.w)).toBeGreaterThanOrEqual(52.5 + b.t);
        expect(Math.floor(i / pix.w)).toBeLessThanOrEqual(52.5 + b.b);
      }
    }
  });

  it('retains broad dark steel planes through arrival, charge, jump, and residue', () => {
    for (const order of ORDERS) for (let frame = 0; frame < 8; frame++) {
      const pix = render(order, frame), steel = palettePixels(pix, SIGNATURE_RAMPS.metal);
      // Metal-first deliberately keeps long reflections one existing tone below
      // its compact electrical white peak; lightning-first plates keep the tip.
      const dark = palettePixels(pix, [SIGNATURE_RAMPS.metal[1]]);
      const reflection = palettePixels(pix, [SIGNATURE_RAMPS.metal[order[0] === 'metal' ? 3 : 4]]);
      expect(dark.length, `${order} f${frame} dark face`).toBeGreaterThan(steel.length * .4);
      expect(reflection.length, `${order} f${frame} cold reflection`).toBeGreaterThan(3);
      if (order[0] === 'metal') {
        const base = new Pix(180, 105); paintMaterialStream(base, 90.5, 52.5, 15, SIGNATURE_RAMPS.metal, 'metal', frame);
        expect(dark.length).toBeGreaterThan(palettePixels(base, [SIGNATURE_RAMPS.metal[1]]).length * .72);
        expect(steel.length).toBeGreaterThan(palettePixels(pix, SIGNATURE_RAMPS.raio).length * 3);
      }
    }
  });

  it('reserves lightning-first white peaks for moving contacts rather than the old free-running front', () => {
    const contacts = [[.08, .052], [.34, .09], [.69, .05]] as const;
    for (let frame = 0; frame < 8; frame++) {
      const pix = render(ORDERS[0], frame), bright = palettePixels(pix, [SIGNATURE_RAMPS.raio[5]]);
      expect(bright.length).toBeGreaterThan(3);
      for (const index of bright) {
        const u = ((index % pix.w) - 45.5) / 90;
        if (u < .07) continue;
        expect(contacts.some(([offset, half]) => {
          const local = (u - frame / 8 - offset + .5) - Math.floor(u - frame / 8 - offset + .5) - .5;
          return local >= -half * 1.8 && local <= half * 2.1;
        }), `white pixel outside a physical contact: f${frame}, u${u}`).toBe(true);
      }
    }
  });

  it('draws actual cross-rail bridges rooted in nearby steel rather than detached glints', () => {
    for (let frame = 0; frame < 8; frame++) {
      const pix = render(ORDERS[1], frame), electrical = palettePixels(pix, SIGNATURE_RAMPS.raio);
      const base = new Pix(180, 105); paintMaterialStream(base, 90.5, 52.5, 15, SIGNATURE_RAMPS.metal, 'metal', frame);
      const bridges = components(pix, electrical).filter(group => {
        const ys = group.map(i => Math.floor(i / pix.w));
        return group.length >= 6 && Math.max(...ys) - Math.min(...ys) >= 4;
      });
      expect(bridges.length, `f${frame} cross-rail span`).toBeGreaterThan(0);
      for (const bridge of bridges) {
        const roots = bridge.filter(i => base.data[i * 4 + 3]);
        expect(roots.length, `f${frame} steel-rooted bridge`).toBeGreaterThanOrEqual(3);
      }
      for (const index of electrical) {
        const x = index % pix.w, y = Math.floor(index / pix.w);
        let nearSteel = false;
        for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
          if (xx >= 0 && xx < pix.w && yy >= 0 && yy < pix.h && base.data[(yy * pix.w + xx) * 4 + 3]) nearSteel = true;
        }
        expect(nearSteel, `f${frame} remote electrical pixel`).toBe(true);
      }
    }
  });

  it('keeps all eight frames distinct and exactly repeatable across the loop seam', () => {
    for (const order of ORDERS) {
      const frames = Array.from({ length: 8 }, (_, frame) => render(order, frame));
      expect(new Set(frames.map(pix => pix.data.join(','))).size).toBe(8);
      expect(render(order, 8).data).toEqual(frames[0].data);
      expect(render(order, -1).data).toEqual(frames[7].data);
      expect(render(order, Infinity).data).toEqual(frames[0].data);
    }
  });
});
