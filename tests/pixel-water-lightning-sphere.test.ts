import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintWaterLightningSphere, waterLightningSphereBounds, type WaterLightningPrimary } from '../src/ui/pixel-water-lightning-sphere';

const WATER = new Set(['9,28,46','12,49,71','14,78,104','17,115,145','25,153,178','60,197,208','129,231,229','203,250,239']);
const CHARGE = new Set(['46,33,60','91,58,76','160,132,98','211,190,110','235,216,136','246,231,151','255,245,192','255,253,226']);
const color = (p: Pix,i: number): string => Array.from(p.data.subarray(i * 4,i * 4 + 3)).join(',');
const occupied = (p: Pix): number[] => Array.from({length: p.w * p.h},(_,i) => i).filter(i => p.data[i * 4 + 3]);
const render = (primary: WaterLightningPrimary,s = 15,frame = 0,offset = .5): Pix => {
  const p = new Pix(70,70); paintWaterLightningSphere(p,35 + offset,35 + offset,s,frame,primary); return p;
};
function connected(p: Pix): boolean {
  const cells = new Set(occupied(p)), stack = [cells.values().next().value!], seen = new Set(stack);
  while (stack.length) {
    const i = stack.pop()!, x = i % p.w, y = Math.floor(i / p.w);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || x + dx >= p.w || y + dy < 0 || y + dy >= p.h) continue;
      const n = (y + dy) * p.w + x + dx;
      if (cells.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  return cells.size > 0 && cells.size === seen.size;
}

describe('authored water/lightning gyre', () => {
  for (const primary of ['agua','raio'] as const) {
    it(`keeps ${primary}-led water and gold rooted at tiny sizes and fractional centres`, () => {
      for (const size of [1,2,3,7,15,20]) for (const offset of [0,.25,.5,.75]) for (let frame = 0; frame < 8; frame++) {
        const p = render(primary,size,frame,offset), cells = occupied(p), box = waterLightningSphereBounds(size,primary);
        expect(connected(p),`${primary}/${size}/${offset}/${frame}`).toBe(true);
        for (const i of cells) {
          const x = i % p.w - 35 - offset, y = Math.floor(i / p.w) - 35 - offset;
          expect(x).toBeGreaterThanOrEqual(box.l); expect(x).toBeLessThanOrEqual(box.r);
          expect(y).toBeGreaterThanOrEqual(box.t); expect(y).toBeLessThanOrEqual(box.b);
          expect(WATER.has(color(p,i)) || CHARGE.has(color(p,i))).toBe(true);
        }
        expect(cells.some(i => WATER.has(color(p,i)))).toBe(true);
        expect(cells.some(i => CHARGE.has(color(p,i)))).toBe(true);
        expect(cells.some(i => ['211,190,110','235,216,136','246,231,151','255,245,192','255,253,226'].includes(color(p,i)))).toBe(true);
      }
    });

    it(`advects the ${primary}-led hot front while preserving the hollow and material ownership`, () => {
      const frames = Array.from({length: 8},(_,f) => render(primary,20,f));
      const cells = occupied(frames[0]);
      let movingWater = 0, movingGold = 0;
      for (const i of cells) {
        const isGold = CHARGE.has(color(frames[0],i));
        expect(frames.every(p => CHARGE.has(color(p,i)) === isGold)).toBe(true);
        if (frames.some(p => color(p,i) !== color(frames[0],i))) isGold ? movingGold++ : movingWater++;
      }
      expect(movingGold).toBeGreaterThan(20); expect(movingWater).toBeGreaterThan(15);
      expect(movingWater).toBeLessThan(cells.length * .5);
      expect(frames.every(p => occupied(p).join(',') === cells.join(','))).toBe(true);
      // The internal negative space survives every beat; it is not black paint.
      expect(frames.every(p => p.data[(33 * p.w + 31) * 4 + 3] === 0)).toBe(true);
      expect(new Set(frames.map(p => Array.from(p.data).join(','))).size).toBe(8);
      for (let f = 0; f < 8; f++) expect(render(primary,20,f + 8).data).toEqual(frames[f].data);
      expect(render(primary,20,-1).data).toEqual(frames[7].data);
      expect(render(primary,20,NaN).data).toEqual(frames[0].data);
    });
  }

  it('gives lightning dominance a broader embedded charge without losing water', () => {
    const aqua = render('agua',20), electric = render('raio',20);
    const a = occupied(aqua), e = occupied(electric);
    const goldA = a.filter(i => CHARGE.has(color(aqua,i))).length, goldE = e.filter(i => CHARGE.has(color(electric,i))).length;
    expect(goldE).toBeGreaterThan(goldA * 1.55);
    expect(goldE).toBeGreaterThan(e.length * .2);
    expect(e.filter(i => WATER.has(color(electric,i))).length).toBeGreaterThan(e.length * .4);
  });

  it('returns exact clipped bounds without writing outside the canvas', () => {
    for (const [x,y] of [[1,2],[29.75,28.5],[-2,15],[15,-3]]) for (const primary of ['agua','raio'] as const) {
      const p = new Pix(30,30), writes: number[][] = [];
      const box = paintWaterLightningSphere({ w: p.w,h: p.h,set: (a,b,c) => { writes.push([a,b]); p.set(a,b,c); } },x,y,15,3,primary);
      expect(writes.length).toBeGreaterThan(0);
      expect(writes.every(([a,b]) => a >= 0 && b >= 0 && a < 30 && b < 30)).toBe(true);
      const cells = occupied(p), xs = cells.map(i => i % p.w), ys = cells.map(i => Math.floor(i / p.w));
      expect(box).toEqual({ l: Math.min(...xs),t: Math.min(...ys),r: Math.max(...xs),b: Math.max(...ys) });
    }
  });

  it('rejects non-finite geometry and fully offscreen work safely', () => {
    for (const [x,y,s] of [[NaN,10,15],[10,Infinity,15],[10,10,NaN],[10,10,Infinity],[1e20,1e20,15]]) {
      const p = new Pix(30,30), box = paintWaterLightningSphere(p,x,y,s,0,'agua');
      expect(occupied(p)).toEqual([]);
      expect(box).toEqual({ l: Infinity,t: Infinity,r: -Infinity,b: -Infinity });
    }
  });
});
