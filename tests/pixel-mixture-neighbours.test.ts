import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { allocateMixtureDomains } from '../src/ui/pixel-mixture-domains';

describe('mixture graph traversal order', () => {
  it('preserves the original seeded reports and samples at edges and narrow dimensions', () => {
    // Captured from the original nested neighbour loops before unrolling.
    const fixtures: readonly [number, number, string][] = [
      [1, 1, '4321137b'], [1, 13, '4f0b4b1'], [13, 1, '43c70504'],
      [2, 2, 'ec64c78c'], [3, 7, '40b83c4c'], [31, 25, '876322b6'], [47, 35, '94ca266']
    ];
    for (const [width, height, expected] of fixtures) {
      let hash = 2166136261;
      for (const kind of ['solid', 'ring', 'split', 'diagonal']) for (const reverse of [false, true]) for (const count of [0, 1, 2, 4, 16]) {
        const p = new Pix(width, height);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if ((kind === 'ring' && Math.hypot(x - width / 2, y - height / 2) < Math.min(width, height) / 4) ||
            (kind === 'split' && x === Math.floor(width / 2)) ||
            (kind === 'diagonal' && Math.abs(x / width - y / height) > .1)) continue;
          p.set(x, y, [128, 128, 128]);
        }
        const domains = allocateMixtureDomains(p, { l: -.25, t: -.5, r: width - .75, b: height - .25 }, count, {
          reverse, preferredSeeds: [null, { x: width * .2 + .125, y: height * .75 + .25 },
            { x: width * .8 + .375, y: height * .5 + .75 }, { x: Infinity, y: NaN }]
        });
        const samples = [];
        for (let y = domains.bounds.t; y <= domains.bounds.b; y++) for (let x = domains.bounds.l; x <= domains.bounds.r; x++) samples.push(domains.sampleAt(x, y));
        const text = JSON.stringify([domains, samples]);
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
      }
      expect((hash >>> 0).toString(16), `${width} × ${height}`).toBe(expected);
    }
  });
});
