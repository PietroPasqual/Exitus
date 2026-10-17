import {describe,it,expect} from 'vitest';
import {insideMaterialInterface, materialInterfaceAnchors, sharedContactPulse} from '../src/ui/pixel-mixture-contact';
import {BODY_MATERIALS} from '../src/ui/pixel-mixture-signatures';
describe('Material-owned interface construction',()=>{
 it('keeps first material centered and anchors all secondary identities independently of frame',()=>{
  const q={l:10,t:20,r:90,b:70};
  for(const element of BODY_MATERIALS){const a=materialInterfaceAnchors(['agua',element],q),b=materialInterfaceAnchors(['agua',element],q,true);expect(a[0]).toBeUndefined();expect(a[1]).toBeDefined();expect(a[1]!.x+b[1]!.x).toBeCloseTo(q.l+q.r);expect(a[1]!.y).toBe(b[1]!.y);}
  expect(materialInterfaceAnchors(['agua','gelo'],q)).not.toEqual(materialInterfaceAnchors(['gelo','agua'],q));
 });
 it('retains tiny/disconnected signatures rather than eroding away their pixel budget',()=>{
  for(const kind of ['solid','liquid','radiant','flow','organic','field'] as const){expect(insideMaterialInterface(kind,100,.4,10,10,12)).toBe(true);expect(insideMaterialInterface(kind,Infinity,.4,10,10,100)).toBe(true);expect(insideMaterialInterface(kind,0,.4,10,10,100)).toBe(true);}
 });
 it('shares a continuous normalized eight-frame contact clock',()=>{
  for(let i=0;i<8;i++)expect(sharedContactPulse(.3,.7,i+8)).toBeCloseTo(sharedContactPulse(.3,.7,i));
 });
});
