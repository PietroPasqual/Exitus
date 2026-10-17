import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { lightningMetalSphereBounds, paintLightningMetalSphere } from '../src/ui/pixel-lightning-metal-sphere';
import { waterMetalSphereBounds, paintWaterMetalSphere } from '../src/ui/pixel-water-metal-sphere';
import { fireEarthSphereBounds, paintFireEarthSphere } from '../src/ui/pixel-fire-earth-sphere';

const studies = [
  ...(['raio', 'metal'] as const).map(primary => ({ name: `lightning/${primary}`,
    bounds: (s: number) => lightningMetalSphereBounds(s, primary),
    paint: (p: Pix, x: number, y: number, s: number, f: number) => paintLightningMetalSphere(p, x, y, s, f, primary) })),
  ...(['agua', 'metal'] as const).map(primary => ({ name: `water/${primary}`,
    bounds: (s: number) => waterMetalSphereBounds(s, primary),
    paint: (p: Pix, x: number, y: number, s: number, f: number) => paintWaterMetalSphere(p, x, y, s, f, primary) })),
  ...(['fogo', 'terra'] as const).map(primary => ({ name: `earth/${primary}`,
    bounds: (s: number) => fireEarthSphereBounds(s, primary),
    paint: (p: Pix, x: number, y: number, s: number, f: number) => paintFireEarthSphere(p, x, y, s, f, primary) }))
];

describe('second-batch authored pair body helpers', () => {
  it('keeps complete connected poses inside conservative envelopes at fractional centres', () => {
    const failures: unknown[] = [];
    for (const study of studies) for (const s of [1, 2, 3, 6.99, 7, 15, 24])
      for (const delta of [0, .25, .5, .75]) for (let frame = 0; frame < 8; frame++) {
        const p = new Pix(90, 90), x = 45 + delta, y = 44 + delta, q = study.bounds(s);
        study.paint(p, x, y, s, frame);
        const occupied = new Set<number>();
        for (let yy = 0; yy < p.h; yy++) for (let xx = 0; xx < p.w; xx++) if (p.data[(yy * p.w + xx) * 4 + 3]) {
          occupied.add(yy * p.w + xx);
          if (xx < x + q.l || xx > x + q.r || yy < y + q.t || yy > y + q.b)
            failures.push({ name: study.name, s, delta, frame, pixel: [xx, yy], bounds: q });
        }
        if (!occupied.size) { failures.push({ name: study.name, s, delta, frame, empty: true }); continue; }
        const queue = [occupied.values().next().value!], seen = new Set<number>();
        while (queue.length) {
          const at = queue.pop()!; if (seen.has(at)) continue; seen.add(at);
          for (const next of [at - 1, at + 1, at - p.w, at + p.w])
            if (occupied.has(next) && !seen.has(next)) queue.push(next);
        }
        if (seen.size !== occupied.size) failures.push({ name: study.name, s, delta, frame, disconnected: true });
      }
    expect(failures).toEqual([]);
  }, 20000);

  it('normalizes each full loop and remains exact after different cache histories and destinations', () => {
    const draw = (study: typeof studies[number], f: number, s = 15, offset = .5) => {
      const p = new Pix(90, 90); study.paint(p, 45 + offset, 44 + offset, s, f); return p.data;
    };
    for (const study of studies) {
      for (const [a, b] of [[0, 8], [7, -1], [0, NaN], [2, 2.75]]) {
        const expected = draw(study, a), actual = draw(study, b);
        expect(actual.every((v, i) => v === expected[i])).toBe(true);
      }
      for (let frame = 0; frame < 8; frame++) {
        const expected = draw(study, frame);
        for (let i = 0; i < 28; i++) draw(studies[i % studies.length], i % 8, 1 + i * .7, i % 4 * .25);
        const actual = draw(study, frame);
        expect(actual.every((v, i) => v === expected[i])).toBe(true);
      }
    }
  });
});
