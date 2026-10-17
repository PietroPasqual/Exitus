import { describe, expect, it } from 'vitest';
import type { Being } from '../src/core/appearance';
import { Pix } from '../src/ui/pixel';
import { paintShadowIceSphere } from '../src/ui/pixel-shadow-ice-sphere';
import { pairSpriteOf, pairSpriteBounds, paintPairSprite } from '../src/ui/pixel-pair-sprites';
import { appearanceForScene, boundsOfBeing, layoutScene, layoutParts } from '../src/ui/pixel-scene-layout';
import { renderPixelScene } from '../src/ui/pixel-scene';

const pairs = [['fogo','metal'],['metal','fogo'],['agua','gelo'],['gelo','agua'],['sombra','gelo'],['gelo','sombra'],['raio','metal'],['metal','raio'],['agua','metal'],['metal','agua'],['fogo','terra'],['terra','fogo']];
const being = (elements: string[], extra: Partial<Being> = {}): Being => ({ elements, shapes: ['forma_esfera'], concepts: [],
 placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false, linked: false,
 merged: false, bond: null, closed: false, ...extra });

describe('authored two-material sphere construction', () => {
 it('selects only the exact pair and one actual sphere, without reordering or interpreting fusion', () => {
  for (const elements of pairs) {
   const b=being(elements), before=JSON.stringify(b), selected=pairSpriteOf(b);
   expect(selected?.primary).toBe(elements[0]); expect(JSON.stringify(b)).toBe(before);
   expect(pairSpriteOf({...b,linked:true,merged:true,materialFusion:[]})).toEqual(selected);
   for (const extra of [ {shapes:[]}, {shapes:['forma_cubo']}, {shapes:['forma_esfera','forma_cubo']},
    {shapes:['forma_esfera','forma_esfera']}, {intentForm:'dragao' as const}, {intentGlyph:'CURA'},
    {elements:[elements[0]]}, {elements:[elements[0],elements[0]]}, {elements:[...elements,'natureza']} ])
     expect(pairSpriteOf({...b,...extra})).toBeUndefined();
  }
  expect(pairSpriteOf(being(['fogo','raio']))).toBeUndefined();
 });
 it('keeps every pause pose connected, nonempty and inside the shared loop envelope', () => {
  const failures:unknown[]=[];
  for(const elements of pairs) for(const s of [1,2,3,7,15,20]) for(const offset of [0,.25,.5,.75]) for(const reverse of [false,true]) for(let frame=0;frame<8;frame++) {
   const p=new Pix(90,90), x=45+offset,y=43+offset,sprite=pairSpriteOf(being(elements))!,q=pairSpriteBounds(sprite,s),half=Math.max(-q.l,q.r);
   paintPairSprite(sprite,p,x,y,s,frame,reverse);
   const pixels=new Set<number>();
   for(let yy=0;yy<p.h;yy++)for(let xx=0;xx<p.w;xx++)if(p.data[(yy*p.w+xx)*4+3]){
    pixels.add(yy*p.w+xx);
    if(xx<x-half||xx>x+half||yy<y+q.t||yy>y+q.b)failures.push({elements,s,offset,reverse,frame,pixel:[xx,yy],q});
   }
   if(!pixels.size){failures.push({elements,s,offset,reverse,frame,empty:true});continue;}
   const seen=new Set<number>(),queue=[pixels.values().next().value!];
   while(queue.length){const at=queue.pop()!;if(seen.has(at))continue;seen.add(at);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const n=at+dy*p.w+dx;if(pixels.has(n)&&!seen.has(n))queue.push(n);
   }}
   if(seen.size!==pixels.size)failures.push({elements,s,offset,reverse,frame,disconnected:pixels.size-seen.size});
  }
  expect(failures).toEqual([]);
 },20000);
 it('normalizes frames and mirrors the full composition on an actual return',()=>{
  for(const elements of pairs){const sprite=pairSpriteOf(being(elements))!;
   const draw=(f:number,reverse=false)=>{const p=new Pix(90,90);paintPairSprite(sprite,p,45,43,15,f,reverse);return p;};
   expect(draw(8).data).toEqual(draw(0).data);expect(draw(-1).data).toEqual(draw(7).data);expect(draw(NaN).data).toEqual(draw(0).data);
   let mismatch=0;for(let f=0;f<8;f++){const a=draw(f),b=draw(f,true);for(let y=0;y<90;y++)for(let x=1;x<90;x++)for(let c=0;c<4;c++)if(a.data[(y*90+x)*4+c]!==b.data[(y*90+90-x)*4+c])mismatch++;}
   expect(mismatch).toBe(0);
  }
 });
 it('keeps exact shadow/crystal samples after contour work is shared', async()=>{
  const bytes=new Uint8Array(448*90*90*4);let offset=0;
  for(const size of [1,2,3,5,7,15,20])for(const delta of [0,.25,.5,.75])for(const primary of ['sombra','gelo'] as const)for(let frame=0;frame<8;frame++){
   const p=new Pix(90,90);paintShadowIceSphere(p,45+delta,43+delta,size,frame,primary);bytes.set(p.data,offset);offset+=p.data.length;
  }
  const digest=await crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  expect(hex).toBe('8158a9f995dcffb9387e86630dcef3ea62bfdccc0cdd496075f4e4945929935d');
 });
 it('uses the same stable envelope in touch, return, copies and actual orbit layouts',()=>{
  for(const elements of pairs)for(const extra of [{},{placement:'touch'},{placement:'far'},{placement:'self',direction:'back',projectile:true},{placement:'flight',projectile:true},{intentCount:'6'},{orbit:true,intentCount:'8'}] as Partial<Being>[]){
   const b=being(elements,extra),input={beings:[b],orbitCount:extra.orbit?1:0},before=JSON.stringify(input),ap=appearanceForScene(input);
   const sizeByBody=new Map<Being,number>();
   for(let f=0;f<8;f++){const plan=layoutScene(ap,f);
    for(const member of ap.beings){const pose=plan.poses.get(member)!;if(sizeByBody.has(member))expect(pose.s).toBe(sizeByBody.get(member));else sizeByBody.set(member,pose.s);
     const q=boundsOfBeing(member,pose),local=pairSpriteBounds(pairSpriteOf(member)!,pose.s),parts=layoutParts(member,pose.s);
     expect(parts.top).toBe(local.t);expect(parts.bottom).toBe(local.b);
     expect(q.l).toBeGreaterThanOrEqual(0);expect(q.r).toBeLessThan(180);expect(q.t).toBeGreaterThanOrEqual(0);expect(q.b).toBeLessThan(105);
    }
   }
   renderPixelScene(input,true,3);expect(JSON.stringify(input)).toBe(before);
  }
 });
});
