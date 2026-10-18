import { describe, expect, it } from 'vitest';
import { Pix, type RGB } from '../src/ui/pixel';
import { paintFireMetalSphere } from '../src/ui/pixel-fire-metal-sphere';
import { paintFireEarthSphere } from '../src/ui/pixel-fire-earth-sphere';

const steel: RGB[] = [[24,29,41],[48,60,77],[78,96,112],[124,145,153],[183,205,205],[238,244,220]];
const stone: RGB[] = [[34,24,27],[60,40,35],[90,60,45],[128,88,59],[168,125,82],[204,165,111]];
const studies = [
  ...(['fogo','metal'] as const).map(primary => ({ name: `${primary}/steel`, palette: steel,
    draw: (p: Pix, s: number, f: number) => paintFireMetalSphere(p,50.5,49.25,s,f,primary) })),
  ...(['fogo','terra'] as const).map(primary => ({ name: `${primary}/stone`, palette: stone,
    draw: (p: Pix, s: number, f: number) => paintFireEarthSphere(p,50.5,49.25,s,f,primary) }))
];
const colorAt = (p: Pix, at: number): string => `${p.data[at * 4]},${p.data[at * 4 + 1]},${p.data[at * 4 + 2]}`;

describe('thermal contact between authored materials', () => {
  it('heats actual shared edges and their one-pixel bevel, preserving remote solid faces', () => {
    const failures: unknown[] = [];
    for (const study of studies) for (const size of [8.01,15,22]) {
      const neutral = new Set(study.palette.map(color => color.join(',')));
      const frames = Array.from({length: 8}, (_,frame) => {
        const p = new Pix(100,100); study.draw(p,size,frame); return p;
      });
      // Every solid pixel cools back to its authored palette during the loop.
      // Recover that rigid material mask without relying on private polygons.
      const solid = new Set<number>();
      for (const p of frames) for (let at = 0; at < p.w * p.h; at++)
        if (p.data[at * 4 + 3] && neutral.has(colorAt(p,at))) solid.add(at);
      const changing = new Set<number>();
      for (const [frame,p] of frames.entries()) for (const at of solid) {
        if (neutral.has(colorAt(p,at))) continue;
        changing.add(at);
        const x = at % p.w, y = Math.floor(at / p.w);
        let fireNear = false;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 2) continue;
          const other = (y + dy) * p.w + x + dx;
          if (!solid.has(other) && p.data[other * 4 + 3]) fireNear = true;
        }
        if (!fireNear) failures.push({name: study.name,size,frame,pixel: [x,y]});
      }
      expect(changing.size,study.name).toBeGreaterThan(2);
      expect(changing.size,study.name).toBeLessThan(solid.size * .55);
    }
    expect(failures).toEqual([]);
  });

  it('moves the hot front to different contact pixels instead of flashing every edge together', () => {
    for (const study of studies) {
      const neutral = new Set(study.palette.map(color => color.join(',')));
      const frames = Array.from({length: 8}, (_,frame) => {
        const p = new Pix(100,100); study.draw(p,22,frame); return p;
      });
      const solid = new Set<number>();
      for (const p of frames) for (let at = 0; at < p.w * p.h; at++)
        if (p.data[at * 4 + 3] && neutral.has(colorAt(p,at))) solid.add(at);
      const hot = frames.map(p => [...solid].filter(at => colorAt(p,at) ===
        (study.palette === steel ? '255,183,55' : '255,159,39')));
      const occupied = hot.filter(pixels => pixels.length > 0);
      expect(occupied.length,study.name).toBeGreaterThanOrEqual(4);
      const centroids = occupied.map(pixels => pixels.reduce((sum,at) => sum + Math.floor(at / 100),0) / pixels.length);
      expect(Math.max(...centroids) - Math.min(...centroids),study.name).toBeGreaterThan(7);
      expect(new Set(hot.map(pixels => pixels.join(','))).size,study.name).toBeGreaterThanOrEqual(5);
    }
  });
});
