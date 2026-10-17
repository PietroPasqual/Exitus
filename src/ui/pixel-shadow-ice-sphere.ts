import { inPoly, Pix, rgb, type RGB } from './pixel';

/** Authored sphere composition with rigid ice emerging from a connected shadow fold. */
type Point = [number, number];
export interface ShadowIceSphereBox { l: number; t: number; r: number; b: number }
const SHADOW = ['#100f1c','#211a34','#382846','#5b426d','#9471a4'].map(rgb);
const ICE = ['#23324f','#3d6294','#619dc9','#90d8e7','#c5f1ef','#f4ffff'].map(rgb);
const MAIN: Point[] = [[-.12,.62],[-.28,-.05],[.25,-1.04],[.72,-.36],[.53,.41]];
const FRONT: Point[] = [[-.12,.62],[-.28,-.05],[.25,-1.04],[.18,-.07]];
const SIDE: Point[] = [[.25,-1.04],[.72,-.36],[.53,.41],[.18,-.07]];
const SMALL: Point[] = [[-.59,.25],[-.56,-.33],[-.34,-.68],[-.08,-.21],[-.14,.4]];
const SMALL_FACE: Point[] = [[-.59,.25],[-.56,-.33],[-.34,-.68],[-.31,-.12]];
const TAU = Math.PI * 2;
const segment = (u: number, v: number, a: Point, b: Point): { distance: number; t: number } => {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy)));
  return {distance:Math.hypot(u-a[0]-t*dx,v-a[1]-t*dy),t};
};
export function shadowIceSphereBounds(s: number, _primary: 'sombra'|'gelo' = 'sombra'): ShadowIceSphereBox {
  const r=Math.max(1.5,s*.9);
  return {l:Math.floor(-r-1),t:Math.floor(-1.3*r-1),r:Math.ceil(r+1),b:Math.ceil(r+1)};
}

/** A round dark fold clasps connected crystalline planes; each retains its own substance. */
export function paintShadowIceSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number,
  primary: 'sombra'|'gelo' = 'sombra'): ShadowIceSphereBox {
  const r=Math.max(1.5,s*.9), phase=Number.isFinite(frame)?((Math.floor(frame)%8)+8)%8:0,turn=phase*TAU/8;
  const iceScale=primary==='gelo'?1.18:.86;
  const local=shadowIceSphereBounds(s,primary);
  const box={l:Math.floor(x+local.l),t:Math.floor(y+local.t),r:Math.ceil(x+local.r),b:Math.ceil(y+local.b)};
  const sample=(px:number,py:number): {color:RGB; ice:boolean}|null=>{
    const u=(px-x)/r,v=(py-y)/r;
    const body=Math.hypot(u/.94,(v-.06)/.94)<1;
    // The crystal emerges obliquely from the sphere, rather than standing on a pedestal.
    const angle=.48, a=(u*Math.cos(angle)+v*Math.sin(angle))/iceScale, b=(-u*Math.sin(angle)+v*Math.cos(angle))/iceScale;
    const main=inPoly(MAIN,a,b),small=inPoly(SMALL,a,b);
    if(!body&&!main&&!small)return null;
    // The void belongs to the sphere's curved volume, not a complete black ring.
    let color=SHADOW[v>.59||u>.66?0:u<-.58?2:u<-.28&&v<.25?3:1],isIce=false;
    if(main||small){
      isIce=true;
      if(main)color=inPoly(FRONT,a,b)?ICE[3]:inPoly(SIDE,a,b)?ICE[1]:ICE[2];
      else color=inPoly(SMALL_FACE,a,b)?ICE[2]:ICE[1];
      // Two facets meet along a short hard ridge; the broad face stays blue.
      const ridge=main?segment(a,b,[.25,-1.04],[.18,-.07]):segment(a,b,[-.34,-.68],[-.31,-.12]);
      if(ridge.distance<.055&&ridge.t<.7)color=ICE[4];
      if(main&&a>.1&&b<-.72&&ridge.distance<.035)color=ICE[5];
      const reflection=.15+Math.sin(turn-.6)*.23;
      if(main&&inPoly(FRONT,a,b)&&Math.abs(b-(reflection-a*.6))<.065)color=ICE[4];
    }
    // One connected foreground crescent reaches round both crystal roots.
    // Its moving fold exposes/occludes only their bases; the upper planes stay rigid.
    const root=.22+.55*u+.085*Math.sin(u*3.5-turn);
    const lowerFold=body&&v>root&&u>-.68&&u<.73;
    const leftWrap=body&&u<-.42&&v>-.42&&v<.55;
    if(lowerFold||leftWrap){
      isIce=false;
      const edge=Math.abs(v-root);
      color=edge<.1&&u<.08?SHADOW[3]:v>root+.23?SHADOW[1]:SHADOW[2];
      if(leftWrap&&u<-.58&&v<.22)color=SHADOW[2];
      // One short moving lip turns around the root; no continuous bowl rim.
      if(edge<.075&&u>-.5&&u<.18&&Math.abs(u-(-.18+Math.sin(turn)*.19))<.15)color=SHADOW[4];
    }
    // A rooted fissure carries the shadow front into the crystal and back.
    // It is a visual contact, not a new gameplay effect or crystal disappearance.
    if(main){
      const channel:Point[]=[[.03,.5],[.14,.25],[.02,.04],[.2,-.13],[.17,-.42]];
      const reach=[.3,.5,.72,.93,.93,.7,.48,.3][phase];
      for(let k=1;k<channel.length;k++){
        const hit=segment(a,b,channel[k-1],channel[k]);
        if(hit.distance<.047&&(k-1+hit.t)/(channel.length-1)<reach){color=SHADOW[1];isIce=false;}
      }
    }
    return {color,ice:isIce};
  };
  // Resolve the material once per local pixel. Four-neighbour contour tests
  // reuse those exact samples, including a one-pixel halo outside the envelope.
  const width=box.r-box.l+3,height=box.b-box.t+3;
  const samples: ({color:RGB;ice:boolean}|null)[]=new Array(width*height);
  for(let row=0;row<height;row++)for(let col=0;col<width;col++)samples[row*width+col]=sample(box.l-1+col,box.t-1+row);
  let l=Infinity,t=Infinity,rr=-Infinity,bb=-Infinity;
  for(let py=box.t;py<=box.b;py++)for(let px=box.l;px<=box.r;px++){
    const at=(py-box.t+1)*width+px-box.l+1,hit=samples[at];if(!hit)continue;
    let color=hit.color;
    const outer=!samples[at-1]||!samples[at+1]||!samples[at-width]||!samples[at+width];
    if(outer&&py>y-.25*r)color=hit.ice?ICE[1]:SHADOW[0];
    pix.set(px,py,color);l=Math.min(l,px);t=Math.min(t,py);rr=Math.max(rr,px);bb=Math.max(bb,py);
  }
  return Number.isFinite(l)?{l,t,r:rr,b:bb}:{l:Math.round(x),t:Math.round(y),r:Math.round(x),b:Math.round(y)};
}
