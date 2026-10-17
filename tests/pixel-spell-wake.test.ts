import { describe, expect, it } from 'vitest';
import { Pix, rgb } from '../src/ui/pixel';
import { paintSpellWake, type MotionPoint } from '../src/ui/pixel-motion-fx';

const ramp = ['#163944', '#286276', '#489fac', '#a0d8de', '#e8ffff'].map(rgb);
const elements = ['fogo', 'raio', 'agua', 'acido', 'gelo', 'metal', 'terra', 'materia', 'vento', 'som', 'luz', 'sombra', 'morte', 'vazio'];
const box = { l: 35, t: 22, r: 65, b: 48 };
const occupied = (p: Pix, x: number, y: number): boolean => x >= 0 && y >= 0 && x < p.w && y < p.h && !!p.data[(y * p.w + x) * 4 + 3];
const pixels = (p: Pix): MotionPoint[] => Array.from({ length: p.w * p.h }, (_, i) => [i % p.w, Math.floor(i / p.w)] as MotionPoint).filter(([x, y]) => occupied(p, x, y));
function body(): Pix {
  const p = new Pix(100, 70);
  p.shape(35, 22, 65, 48, (x, y) => ((x - 50) / 15) ** 2 + ((y - 35) / 13) ** 2 <= 1 ? ramp[2] : null);
  return p;
}
function draw(element = 'fogo', frame = 0, direction: MotionPoint = [1, 0]): Pix {
  const p = new Pix(100, 70);
  paintSpellWake(p, body(), box, ramp, element, frame, direction);
  return p;
}
function components(p: Pix): number {
  const remaining = new Set(pixels(p).map(([x, y]) => y * p.w + x)); let count = 0;
  while (remaining.size) {
    const queue = [remaining.values().next().value!]; remaining.delete(queue[0]); count++;
    while (queue.length) {
      const i = queue.pop()!, x = i % p.w, y = Math.floor(i / p.w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= p.w || y + dy < 0 || y + dy >= p.h) continue;
        const next = (y + dy) * p.w + x + dx;
        if (remaining.delete(next)) queue.push(next);
      }
    }
  }
  return count;
}

describe('Rastro material ligado ao contorno', () => {
  it.each(elements)('%s mantém uma massa contínua ligada ao corpo em todos os quadros', element => {
    for (let f = 0; f < 8; f++) {
      const p = draw(element, f), mask = body();
      expect(components(p)).toBe(1);
      expect(pixels(p).some(([x, y]) => occupied(mask, x, y))).toBe(true);
      expect(pixels(p).some(([x]) => x < box.l)).toBe(true);
      expect(pixels(p).every(([x, y]) => x >= box.l - 29 && x <= 50 && y >= 24 && y <= 46)).toBe(true);
    }
  });
  it('acompanha a direção real sem criar uma seta destacada à frente', () => {
    expect(pixels(draw('fogo', 3)).every(([x]) => x < 50)).toBe(true);
    expect(pixels(draw('fogo', 3, [-1, 0])).every(([x]) => x > 50)).toBe(true);
    expect(pixels(draw('agua', 3, [0, 1])).every(([, y]) => y < 35)).toBe(true);
    expect(pixels(draw('agua', 3, [0, -1])).every(([, y]) => y > 35)).toBe(true);
  });
  it('usa o contorno ocupado em vez da borda vazia de uma caixa aproximada', () => {
    const p = new Pix(100, 70), mask = new Pix(100, 70);
    mask.line(44, 35, 65, 35, ramp[2]);
    paintSpellWake(p, mask, box, ramp, 'fogo');
    expect(pixels(p).some(([x, y]) => occupied(mask, x, y))).toBe(true);
    expect(pixels(p).some(([x]) => x === 44)).toBe(true);
  });
  it('segue uma curva elíptica analítica com ligação contínua, inclusive no início do ciclo', () => {
    for (const angle of [0, .2, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const mask = new Pix(100, 70), x = 50 + Math.cos(angle) * 30, y = 35 + Math.sin(angle) * 20;
      mask.shape(x - 3, y - 3, x + 3, y + 3, (px, py) => Math.hypot(px - x, py - y) <= 3 ? ramp[2] : null);
      const p = new Pix(100, 70);
      paintSpellWake(p, mask, { l:x-3,t:y-3,r:x+3,b:y+3 }, ramp, 'agua', 0, [-30*Math.sin(angle),20*Math.cos(angle)], { angle,c:[50,35],rx:30,ry:20 });
      expect(components(p)).toBe(1);
      expect(pixels(p).some(([px, py]) => occupied(mask, px, py))).toBe(true);
      expect(pixels(p).length).toBeLessThan(50);
    }
  });
  it('normaliza o ciclo sem alterar a máscara ou os parâmetros', () => {
    const mask = body(), before = Array.from(mask.data), p = new Pix(100, 70);
    paintSpellWake(p, mask, box, ramp, 'fogo', 3);
    expect(Array.from(mask.data)).toEqual(before);
    for (const [a,b] of [[8,0],[-1,7],[NaN,0],[Infinity,0],[3.8,3]]) expect(draw('fogo', a).data).toEqual(draw('fogo', b).data);
    expect(new Set(Array.from({length:8},(_,f)=>Array.from(draw('fogo',f).data).join(','))).size).toBeGreaterThan(4);
  });
  it('reduz a extensão nas cópias pequenas', () => {
    const mask = new Pix(100,70), p = new Pix(100,70);
    mask.line(45,35,48,35,ramp[2]);
    paintSpellWake(p,mask,{l:45,t:34,r:48,b:36},ramp,'fogo');
    expect(pixels(p).length).toBeLessThan(pixels(draw()).length);
    expect(components(p)).toBe(1);
  });
  it('escala a base e a extensão com a seção real da esfera', () => {
    const measurements = [3, 6, 12, 18].map(radius => {
      const mask = new Pix(140,100), wake = new Pix(140,100), x = 75, y = 50;
      mask.shape(x-radius,y-radius,x+radius,y+radius,(px,py)=>Math.hypot(px-x,py-y)<=radius?ramp[2]:null);
      paintSpellWake(wake,mask,{l:x-radius,t:y-radius,r:x+radius,b:y+radius},ramp,'fogo');
      const visible = pixels(wake).filter(([px,py])=>!occupied(mask,px,py));
      return { length: x-radius-Math.min(...visible.map(([px])=>px)), width: Math.max(...visible.map(([,py])=>py))-Math.min(...visible.map(([,py])=>py)) };
    });
    for(let i=1;i<measurements.length;i++) {
      expect(measurements[i].length).toBeGreaterThan(measurements[i-1].length);
      expect(measurements[i].width).toBeGreaterThan(measurements[i-1].width);
    }
  });
  it('a ponta larga de uma lança não infla o rastro de sua haste fina', () => {
    const mask = new Pix(140,100), wake = new Pix(140,100);
    for(let y=49;y<=51;y++) mask.line(50,y,100,y,ramp[2]);
    mask.shape(90,36,112,64,(x,y)=>Math.abs(x-101)/11+Math.abs(y-50)/14<=1?ramp[2]:null);
    paintSpellWake(wake,mask,{l:50,t:36,r:112,b:64},ramp,'fogo');
    const tail=pixels(wake).filter(([x])=>x<50);
    expect(tail.length).toBeGreaterThan(0);
    expect(Math.max(...tail.map(([,y])=>y))-Math.min(...tail.map(([,y])=>y))).toBeLessThanOrEqual(4);
  });
  it.each(['sombra','morte','vazio'])('%s permanece na faixa escura', element => {
    for(let f=0;f<8;f++) {
      const p=draw(element,f);
      for(const [x,y] of pixels(p)) expect(ramp.slice(0,3)).toContainEqual(Array.from(p.data.slice((y*p.w+x)*4,(y*p.w+x)*4+3)));
    }
  });
  it('ignora máscaras vazias, caixas e direções inválidas', () => {
    const p = new Pix(100,70);
    paintSpellWake(p,new Pix(100,70),box,ramp);
    paintSpellWake(p,body(),box,[]);
    paintSpellWake(p,body(),{...box,l:NaN},ramp);
    paintSpellWake(p,body(),box,ramp,'fogo',0,[0,0]);
    paintSpellWake(p,body(),box,ramp,'fogo',0,[Infinity,0]);
    expect(pixels(p)).toEqual([]);
  });
});
