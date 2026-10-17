import { describe, it, expect } from 'vitest';
import type { Being } from '../src/core/appearance';
import { isSustainedFlameJet, flameJetBounds, paintFlameJet } from '../src/ui/pixel-flame-jet';
import { layoutScene, boundsOfBeing } from '../src/ui/pixel-scene-layout';
import { Pix } from '../src/ui/pixel';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const jet = (patch: Partial<Being> = {}): Being => ({ elements: ['fogo'], shapes: [], concepts: [], placement: 'front', projectile: false,
  orbit: false, direction: 'forward', estado: true, linked: false, merged: false, guards: [], bond: null, closed: false, ...patch });
const raster = (s: number, f: number, x = 64.5, y = 40.5): Pix => {
  const p = new Pix(130, 85); paintFlameJet(p, x, y, s, SIGNATURE_RAMPS.fogo, f); return p;
};

describe('Maintained directional flame emission', () => {
  it('uses the actual unshaped maintained forward fire semantics only', () => {
    expect(isSustainedFlameJet(jet())).toBe(true);
    expect(isSustainedFlameJet(jet({ elements: ['fogo', 'raio'] }))).toBe(true);
    for (const patch of [{ estado: false }, { direction: null }, { direction: 'back' }, { projectile: true }, { orbit: true },
      { placement: 'self' }, { placement: 'far' }, { placement: 'touch' }, { placement: 'flight' },
      { shapes: ['forma_esfera'] }, { intentForm: 'lanca' }, { intentGlyph: 'CURA' }, { elements: ['agua', 'fogo'] }] as Partial<Being>[])
      expect(isSustainedFlameJet(jet(patch))).toBe(false);
  });
  it('keeps every complete pose connected and inside its shared all-frame envelope', () => {
    for (const s of [1, 2, 3, 6, 10, 15]) for (let f = 0; f < 8; f++) {
      const p = raster(s, f), q = flameJetBounds(s), occupied = new Set<number>();
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.data[(y * p.w + x) * 4 + 3]) {
        expect(x).toBeGreaterThanOrEqual(64.5 + q.l); expect(x).toBeLessThanOrEqual(64.5 + q.r);
        expect(y).toBeGreaterThanOrEqual(40.5 + q.t); expect(y).toBeLessThanOrEqual(40.5 + q.b);
        occupied.add(y * p.w + x);
      }
      expect(occupied.size).toBeGreaterThan(0);
      const remaining = new Set(occupied), stack = [remaining.values().next().value!]; remaining.delete(stack[0]);
      while (stack.length) {
        const i = stack.pop()!;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (remaining.delete(i + dy * p.w + dx)) stack.push(i + dy * p.w + dx);
      }
      expect(remaining.size, `scale ${s} frame ${f}`).toBe(0);
    }
  });
  it('has actual downstream material motion with complete normalized pause frames', () => {
    const frames = Array.from({ length: 8 }, (_, f) => raster(15, f));
    expect(new Set(frames.map(p => p.data.join(','))).size).toBe(8);
    expect(raster(15, 8).data).toEqual(frames[0].data);
    expect(raster(15, -1).data).toEqual(frames[7].data);
    expect(raster(15, NaN).data).toEqual(frames[0].data);
    const transition = frames.map((p, f) => {
      let n = 0; for (let i = 0; i < p.data.length; i += 4) if (p.data.slice(i, i + 4).join(',') !== frames[(f + 1) % 8].data.slice(i, i + 4).join(',')) n++;
      return n;
    });
    expect(Math.min(...transition)).toBeGreaterThan(40);
    expect(transition[7]).toBeLessThanOrEqual(Math.max(...transition.slice(0, 7)) * 1.4);
  });
  it('anchors the single ex2 emission beside the hand and keeps crowd layout bounded', () => {
    const b = jet(), ap = { beings: [b], orbitCount: 0 }, layout = layoutScene(ap), pose = layout.poses.get(b)!;
    expect(boundsOfBeing(b, pose).l).toBeCloseTo(layout.casterX + 18);
    expect(pose.y + pose.s * .25).toBeCloseTo(77);
    for (const n of [1, 2, 3, 6]) {
      const beings = Array.from({ length: n }, () => jet()), l = layoutScene({ beings, orbitCount: 0 });
      for (const v of beings) { const q = boundsOfBeing(v, l.poses.get(v)!); expect(q.l).toBeGreaterThan(0); expect(q.r).toBeLessThan(180); expect(q.t).toBeGreaterThan(0); expect(q.b).toBeLessThan(101); }
    }
  });
});
