import type { Pix, RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';

/** One intertwined body: flowing air owns a folded sheet, fire follows its inner bank. */
export interface FireWindSphereBox { l: number; t: number; r: number; b: number }
export type FireWindPrimary = 'fogo' | 'vento';
type Point = readonly [number, number];
interface Knot { x: number; y: number; width: number; t: number }
interface Sample { distance: number; across: number; t: number }
interface Segment { x: number; y: number; dx: number; dy: number; squared: number; length: number; width: number; widthStep: number; t: number; tStep: number; l: number; r: number; top: number; b: number }
interface Surface { material: Uint8Array; tone: Uint8Array }
const TAU = Math.PI * 2;
const FIRE: readonly RGB[] = [[59,16,41],[125,31,59],[203,60,53],[248,121,53],[255,196,92],[255,241,184],[255,253,241]];
const WIND: readonly RGB[] = [[11,90,69],[12,166,120],[56,217,169],[150,242,215],[230,252,245]];
// The upper wind sheet recedes behind the flame. Its broad lower shoulder
// passes in front, then narrows into an attached inner curl. The gap between
// the two banks is deliberate negative space, never a second detached ring.
const WIND_PATH: readonly Point[] = [[.72,-.7],[.34,-.89],[-.15,-.87],[-.58,-.64],[-.8,-.24],[-.78,.19],[-.53,.57],[-.12,.77],[.3,.71],[.63,.43],[.63,.08],[.36,-.13],[.06,-.12],[-.09,.08],[.02,.27],[.24,.25],[.3,.13]];
const FIRE_PATH: readonly Point[] = [[-.37,.39],[-.49,.13],[-.38,-.2],[-.1,-.45],[.27,-.49],[.6,-.29],[.77,.02],[.67,.3],[.41,.45],[.15,.35],[.07,.16],[.19,.02],[.36,.07],[.44,.2]];
// Cache raster-owned material and lighting only, never caller pixels or scenes.
// 24 poses and 65,536 cells bound the two-byte payload to 128 KiB.
const surfaces = new BoundedPixelCache<Surface>(24,65536);
const poseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const validScale = (s: number): boolean => Number.isFinite(s) && s > 0 && s <= 512;
const radiusOf = (s: number): number => Math.max(1.25,s * .92);
const anchorOf = (x: number,y: number): FireWindSphereBox => ({ l: Number.isFinite(x) ? x : 0,t: Number.isFinite(y) ? y : 0,r: Number.isFinite(x) ? x : 0,b: Number.isFinite(y) ? y : 0 });

/** Conservative local envelope for every pose, including fractional centres. */
export function fireWindSphereBounds(s: number, _primary: FireWindPrimary = 'fogo'): FireWindSphereBox {
  if (!validScale(s)) return { l: 0,t: 0,r: 0,b: 0 };
  const extent = radiusOf(s) * 1.1 + .5;
  return { l: -extent,t: -extent,r: extent,b: extent };
}

function curve(points: readonly Point[],phase: number,fire: boolean,fiery: boolean,r: number): Knot[] {
  const result: Knot[] = [], steps = 72, delayed = phase - .48;
  for (let step = 0; step <= steps; step++) {
    const t = step / steps, f = t * (points.length - 1), i = Math.min(points.length - 2,Math.floor(f)), v = f - i;
    const a = points[Math.max(0,i - 1)],b = points[i],c = points[i + 1],d = points[Math.min(points.length - 1,i + 2)];
    const cat = (k: 0 | 1): number => .5 * (2*b[k] + (-a[k]+c[k])*v + (2*a[k]-5*b[k]+4*c[k]-d[k])*v*v + (-a[k]+3*b[k]-3*c[k]+d[k])*v*v*v);
    // The body barely breathes; the pointed inner fire tongue catches the
    // approaching wind a fraction of a pose later, then bends with its bank.
    const sway = Math.sin((fire ? delayed : phase) - t * TAU) * (fire ? .065 : .032);
    const tip = fire ? Math.max(0,(t - .68) / .32) : 0;
    const x = cat(0) + sway * (fire ? .45 + tip * 1.4 : .6);
    const y = cat(1) + sway * (fire ? .35 - tip * .7 : .35);
    let width = fire
      ? (fiery ? .225 : .135) * (1 + .22 * Math.sin(t * Math.PI))
      : (fiery ? .115 : .18) * (1 + .22 * Math.sin(t * Math.PI));
    if (fire) width *= t > .7 ? Math.max(.05,(1 - t) / .3) : t < .08 ? .55 + t * 5.6 : 1;
    else width *= t > .75 ? Math.max(.1,(1 - t) / .25) : t < .08 ? .18 + t * 10.25 : 1;
    // A rounded one-pixel brush keeps tiny copies rooted and legible.
    width = Math.max((r < 5 ? .76 : .55) / r,width);
    result.push({ x,y,width,t });
  }
  return result;
}

function stroke(knots: readonly Knot[]): Segment[] {
  const result: Segment[] = [];
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i-1],b = knots[i],dx = b.x-a.x,dy = b.y-a.y,sq = dx*dx+dy*dy,width = Math.max(a.width,b.width);
    result.push({ x: a.x,y: a.y,dx,dy,squared: sq,length: Math.sqrt(sq),
      width: a.width,widthStep: b.width-a.width,t: a.t,tStep: b.t-a.t,
      l: Math.min(a.x,b.x)-width,r: Math.max(a.x,b.x)+width,top: Math.min(a.y,b.y)-width,b: Math.max(a.y,b.y)+width });
  }
  return result;
}

function sample(u: number,v: number,path: readonly Segment[]): Sample {
  let best = Infinity,across = 0,t = 0;
  for (const segment of path) {
    // A segment cannot own this pixel outside its widest swept box. Distances
    // above one never paint, so discard them before projecting onto the path.
    if (u < segment.l || u > segment.r || v < segment.top || v > segment.b) continue;
    const p = Math.max(0,Math.min(1,segment.squared ? ((u-segment.x)*segment.dx+(v-segment.y)*segment.dy)/segment.squared : 0));
    const ex = u-segment.x-segment.dx*p,ey = v-segment.y-segment.dy*p,width = segment.width+segment.widthStep*p;
    const squared = (ex*ex+ey*ey)/(width*width);
    // Only a potential winner needs a square root. Retain the exact hypot
    // comparison at near-ties so fractional copies keep their original pixels.
    if (squared > best*best + 1e-14) continue;
    const distance = Math.hypot(ex,ey)/width;
    if (distance < best) {
      best = distance; across = segment.squared ? (segment.dx*ey-segment.dy*ex)/(segment.length*width) : 0;t = segment.t+segment.tStep*p;
    }
  }
  return { distance: best,across,t };
}

/** Inclusive clipped bounds of a deterministic eight-pose material junction. */
export function paintFireWindSphere(pix: Pick<Pix,'w'|'h'|'set'>,x: number,y: number,s: number,frame: number,primary: FireWindPrimary): FireWindSphereBox {
  const anchor = anchorOf(x,y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !validScale(s) || !Number.isFinite(pix.w) || !Number.isFinite(pix.h) || pix.w <= 0 || pix.h <= 0) return anchor;
  const radius = radiusOf(s),pose = poseOf(frame),phase = pose * TAU / 8,fiery = primary === 'fogo';
  const box = fireWindSphereBounds(s,primary),left = Math.floor(x+box.l),top = Math.floor(y+box.t),right = Math.ceil(x+box.r),bottom = Math.ceil(y+box.b);
  const w = right-left+1,h = bottom-top+1,key = `${x}|${y}|${s}|${pose}|${primary}`;
  let surface = surfaces.get(key);
  if (!surface) {
    const material = new Uint8Array(w*h),tone = new Uint8Array(w*h);
    const wind = stroke(curve(WIND_PATH,phase,false,fiery,radius)),fire = stroke(curve(FIRE_PATH,phase,true,fiery,radius));
    // A tongue roots in the outer hot shoulder and is combed upward by the
    // air's leading bank. Its tip lags that bank rather than blinking on/off.
    const tongue = stroke(curve([[.4,-.42],[.69,-.37],[.86,-.52],
      [.92 + Math.sin(phase-.48)*.075,-.81 + Math.cos(phase-.48)*.06]],phase,true,fiery,radius)
      .map(k => ({ ...k,width: Math.max(.35/radius,(fiery ? .24 : .16) * Math.pow(1-k.t,.92)) })));
    const lowerTongue = stroke(curve([[.56,-.08],[.8,.03],
      [1.03 + Math.sin(phase-.8)*.035,-.18 + Math.cos(phase-.8)*.07]],phase,true,fiery,radius)
      .map(k => ({ ...k,width: Math.max(.35/radius,(fiery ? .17 : .105) * Math.pow(1-k.t,.9)) })));
    for (let row = 1; row < h-1; row++) for (let col = 1; col < w-1; col++) {
      const at = row*w+col,u = (left+col-x)/radius,v = (top+row-y)/radius;
      const air = sample(u,v,wind),bodyFlame = sample(u,v,fire),upperTip = sample(u,v,tongue),lowerTip = sample(u,v,lowerTongue);
      const tip = upperTip.distance < lowerTip.distance ? { ...upperTip,t: .35 + upperTip.t*.25 } : { ...lowerTip,t: .65 + lowerTip.t*.2 };
      const flame = tip.distance < bodyFlame.distance ? tip : bodyFlame;
      const hasAir = air.distance <= 1,hasFire = flame.distance <= 1;
      if (!hasAir && !hasFire) continue;
      // The lower/inner air bank crosses the flame in the foreground. The
      // opposite shoulder is occluded by fire, so neither reads as an outline.
      const airFront = air.t > .31 && air.t < .74;
      const isFire = hasFire && (!hasAir || !airFront);
      material[at] = isFire ? 1 : 2;
      if (isFire) {
        const front = (flame.t - pose / 8 + 1) % 1;
        let light = flame.across > .56 ? 1 : flame.across > -.05 ? 2 : 3;
        // A broad amber wave advances along the flame, opening onto a short
        // pale inner lip. The brightest colour never fills its centre.
        if (flame.distance < .55 && front > .17 && front < .36) light = 4;
        if (radius >= 6 && flame.across < -.53 && front > .205 && front < .27) light = 5;
        if (flame.distance > .84 && flame.across > .2) light = 1;
        if (hasAir && air.distance > .82 && !airFront && flame.across < -.55) light = Math.max(3,light);
        tone[at] = light;
      } else {
        const front = (air.t - pose / 8 + 1) % 1;
        let light = air.across > .55 ? 0 : air.across > -.1 ? 1 : 2;
        if (air.t > .32 && air.t < .75 && air.across < .2) light = 2;
        if (air.across < -.35 && front > .09 && front < .43) light = 3;
        if (radius >= 7 && air.across < -.68 && front > .18 && front < .26) light = 4;
        if (air.t < .29 && air.across > -.25) light = Math.min(light,1);
        tone[at] = light;
      }
    }
    // Thin endpoints can undersample at a fractional centre. Keep the largest
    // eight-connected rooted body; never invent scattered air or ember pixels.
    const visited = new Uint8Array(w*h); let largest: number[] = [];
    for (let first = 0; first < material.length; first++) {
      if (!material[first] || visited[first]) continue;
      const queue = [first]; visited[first] = 1;
      for (let head = 0; head < queue.length; head++) {
        const at = queue[head];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const next = at + dy*w + dx;
          if ((!dx && !dy) || next < 0 || next >= material.length || !material[next] || visited[next] || Math.abs(next%w-at%w) > 1) continue;
          visited[next] = 1; queue.push(next);
        }
      }
      if (queue.length > largest.length) largest = queue;
    }
    const rooted = new Uint8Array(w*h); for (const at of largest) rooted[at] = 1;
    for (let at = 0; at < material.length; at++) if (!rooted[at]) material[at] = 0;
    // One short warm lip at the actual air/fire contact transmits the heat.
    // It is interrupted along the curl: no pasted orange perimeter or halo.
    if (radius >= 5) for (let row = 1; row < h-1; row++) for (let col = 1; col < w-1; col++) {
      const at = row*w+col;
      if (material[at] !== 2 || tone[at] < 2) continue;
      if (![at-1,at+1,at-w,at+w].some(n => material[n] === 1)) continue;
      const u = (left+col-x)/radius,v = (top+row-y)/radius,air = sample(u,v,wind);
      if (air.t > .48 && air.t < .68 && (air.t-pose/8+1)%1 < .45) material[at] = 3;
    }
    surface = { material,tone }; surfaces.set(key,surface,w*h);
  }
  const bounds: FireWindSphereBox = { l: Infinity,t: Infinity,r: -Infinity,b: -Infinity };
  for (let row = 1; row < h-1; row++) for (let col = 1; col < w-1; col++) {
    const at = row*w+col,kind = surface.material[at],px = left+col,py = top+row;
    if (!kind || px < 0 || py < 0 || px >= pix.w || py >= pix.h) continue;
    const color = kind === 3 ? FIRE[3] : kind === 1 ? FIRE[surface.tone[at]] : WIND[surface.tone[at]];
    pix.set(px,py,color); bounds.l = Math.min(bounds.l,px); bounds.t = Math.min(bounds.t,py); bounds.r = Math.max(bounds.r,px); bounds.b = Math.max(bounds.b,py);
  }
  return Number.isFinite(bounds.l) ? bounds : anchor;
}
