import { describe, it, expect } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { paintCoherentWaterDragon } from '../src/ui/pixel-coherent-dragon';
import { paintElementalSphere } from '../src/ui/pixel-elemental-spheres';
import { paintMaterialInteraction, usesAllocatedMixture } from '../src/ui/pixel-material-interaction';
import { SIGNATURE_RAMPS as ramps } from './fixtures/material-signature-pix';

const materials = (triple: boolean) => (triple ? ['agua', 'gelo', 'fogo'] as const : ['agua', 'gelo'] as const).map(element => ({element, ramp:ramps[element]}));
const isColor = (p:Pix, i:number, colors: readonly (readonly number[])[]) => colors.some(c => c[0]===p.data[i]&&c[1]===p.data[i+1]&&c[2]===p.data[i+2]);
function dragon(frame:number, reverse=false, s=15, triple=true) {
 const p=new Pix(96,80),bounds=paintCoherentWaterDragon(p,48,40,s,ramps.agua,3,frame,reverse);
 paintMaterialInteraction(p,bounds,materials(triple),{frame,reverse,form:'dragao',shapeForm:'dragao',materialFusion:[]});return p;
}
describe('Authored connected three-material folds',()=>{
 it('selects anatomy adapters narrowly, retaining generic treatment elsewhere',()=>{
  expect(usesAllocatedMixture(['agua','fogo','gelo'],'esfera')).toBe(false);
  expect(usesAllocatedMixture(['agua','gelo','fogo'],'dragao')).toBe(false);
  expect(usesAllocatedMixture(['agua','gelo','fogo'],undefined,'dragao')).toBe(true);
  expect(usesAllocatedMixture(['gelo','agua','fogo'],'dragao')).toBe(true);
  expect(usesAllocatedMixture(['agua','metal','gelo'],'dragao')).toBe(true);
 });
 it('keeps accepted dragon ice, face and alpha while fire stays one rooted fold',()=>{
  for(const s of [7,15]) for(const reverse of [false,true]) for(let frame=0;frame<8;frame++){
   const pair=dragon(frame,reverse,s,false),trio=dragon(frame,reverse,s,true),fire=new Set<number>();
   for(let y=0;y<80;y++)for(let x=0;x<96;x++){
    const i=(y*96+x)*4;expect(trio.data[i+3]).toBe(pair.data[i+3]);
    if(isColor(pair,i,ramps.gelo))expect([...trio.data.slice(i,i+4)]).toEqual([...pair.data.slice(i,i+4)]);
    const local=(x-48)*(reverse?-1:1)*15/s;
    if(local>11)expect([...trio.data.slice(i,i+4)]).toEqual([...pair.data.slice(i,i+4)]);
    if(trio.data[i+3]&&isColor(trio,i,ramps.fogo))fire.add(y*96+x);
   }
   expect(fire.size).toBeGreaterThan(4);
   const seen=new Set<number>(),pending=[fire.values().next().value!];
   while(pending.length){const k=pending.pop()!;if(seen.has(k))continue;seen.add(k);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const n=k+dy*96+dx;if(fire.has(n)&&!seen.has(n))pending.push(n);}}
   expect(seen.size).toBe(fire.size);
  }
 },20000);
 it('keeps the round water volume and three distinct material palettes in all poses',()=>{
  for(let frame=0;frame<8;frame++){
   const p=new Pix(64,64),bounds=paintElementalSphere(p,32,32,15,ramps.agua,'agua',frame),before=p.data.slice();
   paintMaterialInteraction(p,bounds,materials(true),{frame,form:'esfera',shapeForm:'forma_esfera',surfaceBounds:bounds,materialFusion:[]});
   const counts=[ramps.agua,ramps.gelo,ramps.fogo].map(colors=>{let n=0;for(let i=0;i<p.data.length;i+=4)if(p.data[i+3]&&isColor(p,i,colors))n++;return n;});
   expect(counts.every(n=>n>5)).toBe(true);
   for(let i=3;i<p.data.length;i+=4)expect(p.data[i]).toBe(before[i]);
  }
 });
 it('keeps a complete normalized loop and mirrors all poses exactly',()=>{
  expect(dragon(8).data).toEqual(dragon(0).data);
  for(let f=0;f<8;f++){const a=dragon(f),b=dragon(f,true);for(let y=0;y<80;y++)for(let x=1;x<96;x++)expect([...a.data.slice((y*96+x)*4,(y*96+x)*4+4)]).toEqual([...b.data.slice((y*96+96-x)*4,(y*96+96-x)*4+4)]);}
 },20000);
});
