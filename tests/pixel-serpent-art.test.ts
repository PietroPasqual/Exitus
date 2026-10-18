import { describe, expect, it } from 'vitest';
import { darken, inPoly, Pix } from '../src/ui/pixel';
import { intentionBounds, paintIntention } from '../src/ui/pixel-intention';
import { NATURE_FORMS } from '../src/ui/pixel-intention-nature';
import { serpentSurfaceLight } from '../src/ui/pixel-serpent-surface';
import { BODY_MATERIALS, type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import type { SpellMaterial } from '../src/ui/pixel-materials';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const material: Record<BodyMaterial, SpellMaterial> = {
  fogo: 'fire', terra: 'stone', agua: 'water', vento: 'wind', raio: 'plasma', metal: 'metal',
  gelo: 'ice', som: 'energy', natureza: 'energy', acido: 'water', ilusao: 'energy', luz: 'plasma',
  sombra: 'energy', materia: 'stone', gravidade: 'energy', espaco: 'energy'
};
function draw(element: BodyMaterial, size: number, frame: number, reverse = false): Pix {
  const pix = new Pix(128, 96);
  paintIntention(pix, 'serpente', 64, 48, size, SIGNATURE_RAMPS[element], material[element], 7, element, reverse, frame);
  return pix;
}
const mask = (pix: Pix): string => Array.from({ length: pix.data.length / 4 }, (_, i) => pix.data[i * 4 + 3] ? '1' : '0').join('');
const authoredBody = (x: number, y: number): boolean => NATURE_FORMS.serpente.some(p => inPoly(p.points, x, y));

describe('Serpent coil, anatomy and localized surface animation', () => {
  it('keeps two transparent S bends, a continuous thick neck and a tapered tail', () => {
    for (const [x, y] of [[-8, -7], [-8, 7], [10, 2]]) expect(authoredBody(x, y)).toBe(false);
    for (const [x, y] of [[-16, -5], [-7, 1], [1, 6], [6, -9], [10, -10], [18, -13], [-19, 16]])
      expect(authoredBody(x, y), `${x},${y}`).toBe(true);
    expect(intentionBounds('serpente', 15)).toEqual({ l: -26, t: -20, r: 26, b: 20 });
    const pix = draw('agua', 22, 0), occupied = new Set<number>();
    for (let i = 0; i < pix.data.length / 4; i++) if (pix.data[i * 4 + 3]) occupied.add(i);
    const seen = new Set<number>(), queue = [occupied.values().next().value!];
    while (queue.length) {
      const i = queue.pop()!;
      if (seen.has(i)) continue;
      seen.add(i);
      const x = i % pix.w, y = Math.floor(i / pix.w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= pix.w || y + dy < 0 || y + dy >= pix.h) continue;
        const next = i + dx + dy * pix.w;
        if (occupied.has(next) && !seen.has(next)) queue.push(next);
      }
    }
    expect(seen.size).toBe(occupied.size);
  });

  it.each(BODY_MATERIALS)('%s retains its palette, static silhouette, exact reflection and loop at every supported size', element => {
    const allowed = new Set([...SIGNATURE_RAMPS[element], darken(SIGNATURE_RAMPS[element][0], .4)]
      .map(color => color.map(Math.round).join(',')));
    for (const size of [4, 9, 15, 22]) {
      const frames = Array.from({ length: 8 }, (_, frame) => draw(element, size, frame));
      const alpha = mask(frames[0]), bounds = intentionBounds('serpente', size);
      expect(frames[0].data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true);
      if (size === 15) expect(new Set(frames.map(pix => pix.data.join(','))).size).toBe(8);
      for (let frame = 0; frame < 8; frame++) {
        const pix = frames[frame], reverse = draw(element, size, frame, true);
        expect(mask(pix)).toBe(alpha);
        let outside = 0, invalid = 0, reflectionErrors = 0;
        for (let y = 0; y < pix.h; y++) for (let x = 1; x < pix.w; x++) {
          const i = (y * pix.w + x) * 4, reflected = (y * pix.w + 128 - x) * 4;
          for (let c = 0; c < 4; c++) if (pix.data[i + c] !== reverse.data[reflected + c]) reflectionErrors++;
          if (!pix.data[i + 3]) continue;
          if (x < 64 + bounds.l || x > 64 + bounds.r || y < 48 + bounds.t || y > 48 + bounds.b) outside++;
          if (!allowed.has([...pix.data.slice(i, i + 3)].join(','))) invalid++;
        }
        expect({ outside, invalid, reflectionErrors }, `size ${size}, frame ${frame}`)
          .toEqual({ outside: 0, invalid: 0, reflectionErrors: 0 });
      }
      expect(draw(element, size, 8).data).toEqual(frames[0].data);
      expect(draw(element, size, -1).data).toEqual(frames[7].data);
    }
  });

  it('moves highlights locally while keeping eyes, cuts and peak glints authored', () => {
    const values = [0, .16, .2, .24, .96, .98, 1];
    for (let frame = -8; frame < 16; frame++) for (const light of values)
      expect(serpentSurfaceLight(17, -13, 1, light, frame)).toBe(light);
    for (const scale of [4 / 15, 9 / 15, 1, 22 / 15]) {
      let changed = 0, occupied = 0;
      for (let y = -18; y <= 18; y++) for (let x = -24; x <= 25; x++) {
        if (!authoredBody(x, y)) continue;
        occupied++;
        const a = serpentSurfaceLight((x - .5) * scale, y * scale, scale, .63, 0);
        const b = serpentSurfaceLight((x - .5) * scale, y * scale, scale, .63, 1);
        if (a !== b) changed++;
        expect(a).toBeGreaterThan(.24);
        expect(a).toBeLessThan(.96);
        expect(serpentSurfaceLight((x - .5) * scale, y * scale, scale, .63, 8)).toBe(a);
      }
      expect(changed).toBeGreaterThan(occupied * .08);
      expect(changed).toBeLessThan(occupied * .7);
    }
  });
});
