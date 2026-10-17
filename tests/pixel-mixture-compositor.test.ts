import { describe, it, expect } from 'vitest';
import { Pix, darken } from '../src/ui/pixel';
import { paintAllocatedMixture } from '../src/ui/pixel-mixture-compositor';
import { BODY_MATERIALS, type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';
const body = (primary: BodyMaterial): Pix => {
 const p=new Pix(40,40), ramp=SIGNATURE_RAMPS[primary];
 p.shape(5,5,35,35,(x,y)=>Math.hypot(x-20,y-20)<=15?ramp[Math.round((x<20?.6:.4)*(ramp.length-1))]:null,darken(ramp[0],.45)); return p;
};
const bounds={l:4,t:4,r:36,b:36};
function probe(elements: BodyMaterial[], frame=0){
 const p=body(elements[0]), before=p.data.slice();
 const domains=paintAllocatedMixture(p,bounds,elements.map(element=>({element,ramp:SIGNATURE_RAMPS[element]})),{frame,seed:3});
 const counts=elements.map(()=>0), colors=elements.map(e=>new Set(SIGNATURE_RAMPS[e].map(c=>c.join(','))));
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
  const i=(y*p.w+x)*4,owner=domains.ownerAt(x,y);
  if(p.data[i+3]!==before[i+3])throw Error('alpha changed');
  if(owner>0 && colors[owner].has(p.data.slice(i,i+3).join(',')))counts[owner]++;
 }
 return {p,domains,counts};
}
describe('Complete physical mixture composition',()=>{
 it('represents all240ordered pairs with a real palette-owned region',()=>{
  for(const a of BODY_MATERIALS)for(const b of BODY_MATERIALS)if(a!==b){
   const q=probe([a,b]);expect(q.domains.regions[1].pixelCount,`${a}+${b}`).toBeGreaterThan(30);
   expect(q.counts[1],`${a}+${b}`).toBeGreaterThan(20);
  }
 },20000);
 it('keeps all560unordered triples visible, including third-position ice',()=>{
  for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)for(let k=j+1;k<16;k++){
   const es=[BODY_MATERIALS[i],BODY_MATERIALS[j],BODY_MATERIALS[k]],q=probe(es);
   expect(q.domains.budget.subpixel,es.join('+')).toEqual([]);
   expect(q.counts[1],es.join('+')).toBeGreaterThan(3);expect(q.counts[2],es.join('+')).toBeGreaterThan(3);
  }
 },30000);
 it('keeps third and fourth ice visible in every phase of the reported regressions',()=>{
  for(const es of [['agua','fogo','gelo'],['agua','metal','gelo'],['agua','raio','gelo'],['raio','metal','gelo'],['agua','fogo','metal','gelo']] as BodyMaterial[][])
   for(let f=0;f<8;f++){const q=probe(es,f);expect(q.counts[es.indexOf('gelo')],`${es}/${f}`).toBeGreaterThan(5);}
 });
 it('never makes a secondary inherit shadow-primary near-black brightness',()=>{
  for(const e of ['agua','gelo','metal'] as BodyMaterial[]){const q=probe(['sombra',e]);let bright=0;
   for(let y=0;y<40;y++)for(let x=0;x<40;x++)if(q.domains.ownerAt(x,y)===1){const i=(y*40+x)*4;if(Math.max(...q.p.data.slice(i,i+3))>140)bright++;}
   expect(bright,e).toBeGreaterThan(10);
  }
 });
 it('allows secondary faces inside a generic shadow sphere without weakening authored cuts elsewhere',()=>{
  const ramp=SIGNATURE_RAMPS.sombra, p=new Pix(40,40);
  p.shape(5,5,35,35,(x,y)=>Math.hypot(x-20,y-20)<=15?ramp[0]:null,darken(ramp[0],.45));
  p.set(20,15,ramp[ramp.length-1]);
  const materials=[{element:'sombra',ramp},{element:'agua',ramp:SIGNATURE_RAMPS.agua}];
  for(const form of [undefined,'glyph','dragao']){
   const strict=new Pix(40,40);strict.data.set(p.data);
   paintAllocatedMixture(strict,bounds,materials,{form});
   expect(strict.data).toEqual(p.data);
  }
  const sphere=new Pix(40,40);sphere.data.set(p.data);
  const result=paintAllocatedMixture(sphere,bounds,materials,{form:'forma_esfera'});
  expect(result.paintedPixels[1]).toBeGreaterThan(30);
  for(let y=0;y<40;y++)for(let x=0;x<40;x++){
   const i=(y*40+x)*4;
   expect(sphere.data[i+3]).toBe(p.data[i+3]);
   if(Math.max(...p.data.slice(i,i+3))<22 || (x===20&&y===15))
    expect(sphere.data.slice(i,i+4)).toEqual(p.data.slice(i,i+4));
  }
 });
 it('does not allocate concept runes as physical material domains',()=>{
  const p=body('agua'),q=paintAllocatedMixture(p,bounds,[{element:'agua',ramp:SIGNATURE_RAMPS.agua},{element:'tempo',ramp:SIGNATURE_RAMPS.metal},{element:'gelo',ramp:SIGNATURE_RAMPS.gelo}]);
  expect(q.regions.length).toBe(2);
 });
 it('uses only exact fusion pair membership, including a later confirmed group',()=>{
  const p=body('agua'), mats=['agua','gelo','fogo'].map(element=>({element,ramp:SIGNATURE_RAMPS[element as BodyMaterial]}));
  const a=new Pix(40,40),b=new Pix(40,40);a.data.set(p.data);b.data.set(p.data);
  paintAllocatedMixture(a,bounds,mats,{frame:2,materialFusion:[]});
  paintAllocatedMixture(b,bounds,mats,{frame:2,materialFusion:[{family:'liquido',elements:['agua','gelo']}]});
  expect(a.data).not.toEqual(b.data);
 });
});
