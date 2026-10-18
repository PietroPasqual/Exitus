import { describe,expect,it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { fireWindSphereBounds,paintFireWindSphere,type FireWindPrimary } from '../src/ui/pixel-fire-wind-sphere';

const primaries = ['fogo','vento'] as const;
const FIRE = new Set(['59,16,41','125,31,59','203,60,53','248,121,53','255,196,92','255,241,184','255,253,241']);
const WIND = new Set(['11,90,69','12,166,120','56,217,169','150,242,215','230,252,245']);
const colorAt = (p: Pix,at: number): string => [...p.data.slice(at*4,at*4+3)].join(',');
function render(primary: FireWindPrimary,s = 20,frame = 0,x = 32,y = 32): Pix {
  const p = new Pix(64,64); paintFireWindSphere(p,x,y,s,frame,primary); return p;
}
function owned(p: Pix,palette: Set<string>): number[] {
  const result: number[] = [];
  for (let at = 0; at < p.w*p.h; at++) if (p.data[at*4+3] && palette.has(colorAt(p,at))) result.push(at);
  return result;
}
function components(p: Pix): number {
  const occupied = new Set<number>();
  for (let at = 0; at < p.w*p.h; at++) if (p.data[at*4+3]) occupied.add(at);
  let count = 0;
  while (occupied.size) {
    count++; const queue = [occupied.values().next().value!]; occupied.delete(queue[0]);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor],x = at%p.w,y = Math.floor(at/p.w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x+dx < 0 || x+dx >= p.w || y+dy < 0 || y+dy >= p.h) continue;
        const next = (y+dy)*p.w+x+dx;
        if (occupied.delete(next)) queue.push(next);
      }
    }
  }
  return count;
}

describe('authored fire and wind junction', () => {
  it('forms one rooted body across the eight poses and fractional tiny copies', () => {
    const failures: unknown[] = [];
    for (const primary of primaries) for (const s of [1,2,3,7,15,20]) for (const fractional of [0,.25,.5,.75]) for (let frame = 0; frame < 8; frame++) {
      const p = render(primary,s,frame,32+fractional,32+fractional);
      if (components(p) !== 1 || !owned(p,FIRE).length || !owned(p,WIND).length)
        failures.push({ primary,s,fractional,frame });
    }
    expect(failures).toEqual([]);
  });

  it('changes material volume with dominance while retaining both connected banks', () => {
    for (let frame = 0; frame < 8; frame++) {
      const fire = render('fogo',20,frame),wind = render('vento',20,frame);
      expect(owned(fire,FIRE).length).toBeGreaterThan(owned(wind,FIRE).length*1.3);
      expect(owned(wind,WIND).length).toBeGreaterThan(owned(fire,WIND).length*1.25);
      for (const p of [fire,wind]) {
        const hot = new Set(owned(p,FIRE)),air = new Set(owned(p,WIND));
        const contact = [...hot].filter(at => [at-1,at+1,at-p.w,at+p.w].some(n => air.has(n)));
        expect(contact.length).toBeGreaterThan(10);
        // The winding junction traverses the body rather than bisecting it.
        const rows = contact.map(at => Math.floor(at/p.w));
        expect(Math.max(...rows)-Math.min(...rows)).toBeGreaterThanOrEqual(16);
      }
    }
  });

  it('keeps open inner channels and confines the pale flame to short moving lips', () => {
    for (const primary of primaries) {
      const poses: string[] = [];
      for (let frame = 0; frame < 8; frame++) {
        const p = render(primary,20,frame); let voids = 0,pale = 0;
        for (let y = 20; y <= 44; y++) for (let x = 20; x <= 44; x++)
          if (Math.hypot(x-32,y-32)<12 && !p.data[(y*p.w+x)*4+3]) voids++;
        for (const at of owned(p,FIRE)) if (p.data[at*4] === 255 && p.data[at*4+1] > 220) pale++;
        expect(voids).toBeGreaterThan(10);
        expect(pale).toBeLessThan(owned(p,FIRE).length*.15);
        poses.push(p.data.join(','));
      }
      expect(new Set(poses).size).toBe(8);
    }
  });

  it('reports exact occupied bounds and stays inside its declared envelope', () => {
    for (const primary of primaries) for (const s of [1,2,3,7,15,20]) for (const fraction of [0,.25,.5,.75]) for (let frame = 0; frame < 8; frame++) {
      const p = new Pix(64,64),x = 32+fraction,y = 32+fraction;
      const actual = paintFireWindSphere(p,x,y,s,frame,primary),envelope = fireWindSphereBounds(s,primary);
      const xs: number[] = [],ys: number[] = [];
      for (let at = 0; at < p.w*p.h; at++) if (p.data[at*4+3]) { xs.push(at%p.w); ys.push(Math.floor(at/p.w)); }
      expect(actual).toEqual({ l: Math.min(...xs),t: Math.min(...ys),r: Math.max(...xs),b: Math.max(...ys) });
      expect(actual.l).toBeGreaterThanOrEqual(x+envelope.l);
      expect(actual.t).toBeGreaterThanOrEqual(y+envelope.t);
      expect(actual.r).toBeLessThanOrEqual(x+envelope.r);
      expect(actual.b).toBeLessThanOrEqual(y+envelope.b);
    }
  });

  it('normalizes frame numbers and safely handles invalid geometry and clipping', () => {
    for (const primary of primaries) {
      expect(render(primary,20,8).data).toEqual(render(primary,20,0).data);
      expect(render(primary,20,-1).data).toEqual(render(primary,20,7).data);
      expect(render(primary,20,NaN).data).toEqual(render(primary,20,0).data);
      for (const s of [NaN,Infinity,-Infinity,0,-1]) {
        const p = render(primary,s); expect(p.data.some(v => v !== 0)).toBe(false);
        expect(fireWindSphereBounds(s,primary)).toEqual({ l: 0,t: 0,r: 0,b: 0 });
      }
      for (const [x,y] of [[NaN,32],[32,Infinity]]) {
        const p = render(primary,20,0,x,y); expect(p.data.some(v => v !== 0)).toBe(false);
      }
      for (const [x,y] of [[0,0],[63,0],[0,63],[63,63]]) {
        const p = new Pix(64,64),b = paintFireWindSphere(p,x,y,20,0,primary);
        expect(b.l).toBeGreaterThanOrEqual(0);expect(b.t).toBeGreaterThanOrEqual(0);
        expect(b.r).toBeLessThan(64);expect(b.b).toBeLessThan(64);
      }
    }
  });
});
