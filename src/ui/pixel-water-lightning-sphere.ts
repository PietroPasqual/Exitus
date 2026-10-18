import { type Pix, type RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';

export interface WaterLightningSphereBox { l: number; t: number; r: number; b: number }
export type WaterLightningPrimary = 'agua' | 'raio';
type Point = readonly [number, number];
interface Path { points: readonly Point[]; lengths: readonly number[]; total: number }
interface Surface {
  material: Uint8Array;
  tone: Uint8Array;
  edge: Uint8Array;
  distance: Float32Array;
  progress: Float32Array;
}

// The blue-green current remains liquid, while the charge keeps the approved
// warm-gold family. They share a channel but never dissolve into a mixed ramp.
const WATER: readonly RGB[] = [[9,28,46],[12,49,71],[14,78,104],[17,115,145],
  [25,153,178],[60,197,208],[129,231,229],[203,250,239]];
const CHARGE: readonly RGB[] = [[46,33,60],[91,58,76],[160,132,98],[211,190,110],
  [235,216,136],[246,231,151],[255,245,192],[255,253,226]];
const surfaces = new BoundedPixelCache<Surface>(24,65536);
const empty = (): WaterLightningSphereBox => ({ l: Infinity,t: Infinity,r: -Infinity,b: -Infinity });
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const radiusOf = (s: number): number => Math.max(1.5,Math.abs(s) * .9);

function path(points: readonly Point[]): Path {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0],points[i][1] - points[i - 1][1]));
  return { points,lengths,total: lengths[lengths.length - 1] };
}

// The rounded liquid crest makes a broad turn before folding into the centre.
const CURRENT = path([[-.59,.36],[-.7,.02],[-.5,-.39],[-.19,-.65],[.18,-.65],
  [.31,-.43],[.57,-.46],[.49,-.14],[.71,.05],[.53,.4],[.22,.64],[-.12,.71],[-.43,.56],[-.59,.36]]);
// The exposed charge is an open, rooted zigzag. Its return disappears beneath
// the broad water fold; it never outlines the entire liquid ball.
const WATER_CHARGE = path([[.03,-.73],[.22,-.53],[.47,-.57],[.31,-.29],
  [.61,-.24],[.43,.04],[.64,.13],[.44,.39],[.25,.49]]);
const ELECTRIC_CURRENT = path([[-.02,-.79],[.21,-.56],[.51,-.61],[.34,-.3],
  [.66,-.26],[.44,.04],[.7,.16],[.47,.41],[.2,.59]]);
const BRANCH = path([[.21,-.55],[.01,-.43],[-.18,-.52],[-.32,-.34]]);
const RETURN_BRANCH = path([[.44,.04],[.18,.1],[.27,.27]]);
const INWARD_FOLD = path([[.68,.13],[.5,.42],[.13,.51],[-.08,.35],[.02,.16],[.23,.14],[.36,.28]]);

function along(u: number, v: number, route: Path): { distance: number; progress: number } {
  let best = Infinity, progress = 0;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0,Math.min(1,((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = (u - a[0] - dx * t) ** 2 + (v - a[1] - dy * t) ** 2;
    if (d < best) { best = d; progress = (route.lengths[i - 1] + (route.lengths[i] - route.lengths[i - 1]) * t) / route.total; }
  }
  return { distance: Math.sqrt(best),progress };
}

/** Local envelope for every pose; painting returns the exact clipped envelope. */
export function waterLightningSphereBounds(s: number, _primary: WaterLightningPrimary = 'agua'): WaterLightningSphereBox {
  if (!Number.isFinite(s)) return empty();
  const r = radiusOf(s);
  return { l: Math.floor(-1.05 * r) - 1,t: Math.floor(-1.05 * r) - 1,
    r: Math.ceil(1.05 * r) + 1,b: Math.ceil(1.05 * r) + 1 };
}

/**
 * One hollow gyre, not two overlaid balls. Charge is carried inside the liquid
 * fold; its passing head is followed one beat later by the neighbouring water's
 * caustic. Surface ownership and the silhouette stay steady through all poses.
 */
export function paintWaterLightningSphere(pix: Pick<Pix,'w'|'h'|'set'>, x: number, y: number,
  s: number, frame: number, primary: WaterLightningPrimary = 'agua'): WaterLightningSphereBox {
  const result = empty();
  if (![x,y,s,pix.w,pix.h].every(Number.isFinite) || pix.w <= 0 || pix.h <= 0) return result;
  const r = radiusOf(s), electric = primary === 'raio', tiny = r < 7, phase = phaseOf(frame);
  const envelope = waterLightningSphereBounds(s,primary);
  const left = Math.max(-1,Math.floor(x + envelope.l)), top = Math.max(-1,Math.floor(y + envelope.t));
  const right = Math.min(pix.w,Math.ceil(x + envelope.r)), bottom = Math.min(pix.h,Math.ceil(y + envelope.b));
  if (left > right || top > bottom) return result;
  const w = right - left + 1, h = bottom - top + 1;
  const key = `${x}|${y}|${s}|${primary}|${left}|${top}|${w}|${h}`;
  let surface = surfaces.get(key);
  const chargeWidth = Math.max(tiny ? .36 / r : .045,electric ? .135 : .065);
  if (!surface) {
    surface = { material: new Uint8Array(w * h),tone: new Uint8Array(w * h),edge: new Uint8Array(w * h),
      distance: new Float32Array(w * h),progress: new Float32Array(w * h) };
    const { material,tone,distance,progress,edge } = surface;
    const route = electric ? ELECTRIC_CURRENT : WATER_CHARGE;
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const i = row * w + col, u = (left + col - x) / r, v = (top + row - y) / r;
      const round = Math.hypot((u + .025) / .99,(v - .025) / .965);
      if (round > 1) continue;
      // The off-centre hollow is a visible eddy, not a dark painted dot. Its
      // lower-right tongue joins the main current and leaves a deep underpass.
      const fold = u > -.23 && v > .04 + (u + .23) * .55;
      const hole = r >= 5 && Math.hypot((u + .245) / (electric ? .265 : .215),(v + .13) / (electric ? .26 : .235)) < 1 && !fold;
      if (hole) continue;
      const flow = along(u,v,route), fork = along(u,v,BRANCH), returning = along(u,v,RETURN_BRANCH);
      const waterFlow = along(u,v,CURRENT), curl = along(u,v,INWARD_FOLD);
      let d = flow.distance, p = flow.progress;
      if (!tiny && fork.distance < d) { d = fork.distance; p = .19 - fork.progress * .16; }
      if (!tiny && returning.distance < d) { d = returning.distance; p = .65 + returning.progress * .15; }
      distance[i] = d; progress[i] = p;
      material[i] = 1;
      let level = v > .35 - u * .15 ? 2 : 3;
      if (u > .58 || v > .74 || u < -.79) level = 1;
      if (Math.hypot((u + .39) / .64,(v + .36) / .53) < 1) level = 4;
      // Broad banks locate the circulating ribbon. The cut beside the gold
      // retains real depth; the far bank catches a stable turquoise crest.
      if (waterFlow.distance < .12 && (u < -.27 || v < -.55)) level = 5;
      if (curl.distance < .2) level = 1;
      if (curl.distance < .14) level = 4;
      if (curl.distance < .075 && curl.progress < .76) level = 5;
      if (d < chargeWidth + .075) level = 1;
      // The exposed fork tapers at both buried ends. The lower current is
      // entirely water, so the electrical channel cannot read as a hoop.
      const tip = Math.min(1,Math.max(.32,Math.min(p,1 - p) * 9));
      const width = chargeWidth * tip;
      if (d < width) {
        material[i] = 2;
        level = d > width * .6 ? 2 : electric ? 4 : 3;
        if (v > .45) level = Math.min(level,3);
      }
      tone[i] = level;
    }
    // Keep only the rooted component. This removes single raster corner flecks
    // at tiny/fractional scales while retaining the hollow at readable sizes.
    let seed = -1, best = Infinity;
    for (let i = 0; i < material.length; i++) if (material[i]) {
      const d = (left + i % w - x) ** 2 + (top + Math.floor(i / w) - y - r * .65) ** 2;
      if (d < best) { best = d; seed = i; }
    }
    const seen = new Uint8Array(material.length), queue = seed < 0 ? [] : [seed];
    if (seed >= 0) seen[seed] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const at = queue[cursor], ax = at % w, ay = Math.floor(at / w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (ax + dx < 0 || ax + dx >= w || ay + dy < 0 || ay + dy >= h) continue;
        const n = (ay + dy) * w + ax + dx;
        if (material[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
      }
    }
    // Cropping may separate two visible banks of the same hollow body. Keep
    // both there; only a complete silhouette can identify a detached fleck.
    const clipped = left > Math.floor(x + envelope.l) || top > Math.floor(y + envelope.t)
      || right < Math.ceil(x + envelope.r) || bottom < Math.ceil(y + envelope.b);
    if (!clipped) for (let i = 0; i < material.length; i++) if (!seen[i]) material[i] = 0;
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const i = row * w + col;
      if (!material[i]) continue;
      if (row === 0 || col === 0 || row === h - 1 || col === w - 1 || !material[i - 1] || !material[i + 1] || !material[i - w] || !material[i + w]) edge[i] = 1;
    }
    surfaces.set(key,surface,w * h);
  }
  const { material,tone,edge,distance,progress } = surface;
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const i = row * w + col, kind = material[i], px = left + col, py = top + row;
    if (!kind || px < 0 || py < 0 || px >= pix.w || py >= pix.h) continue;
    const u = (px - x) / r, v = (py - y) / r;
    const front = (progress[i] - phase / 8 + 1) % 1;
    const delayed = (progress[i] - (phase - 1) / 8 + 1) % 1;
    let level = tone[i];
    if (kind === 2) {
      // A wide shoulder leads into a narrow hot head; the trail cools back to
      // ochre and violet. Even the dim phase retains a visible gold channel.
      if (front < .24) level = Math.max(level,5);
      if (front > .06 && front < .17 && distance[i] < chargeWidth * .65) level = 6;
      if (front > .09 && front < .145 && distance[i] < chargeWidth * .42) level = 7;
      if (edge[i]) level = tiny ? Math.max(3,Math.min(level,4)) : Math.min(level,u + v < -.5 ? 4 : 1);
      pix.set(px,py,CHARGE[level]);
    } else {
      const bank = distance[i] < chargeWidth + .085 && distance[i] >= chargeWidth;
      if (!tiny && bank && delayed < .31) level = Math.max(level,6);
      if (!tiny && bank && delayed > .1 && delayed < .2 && distance[i] < chargeWidth + .05) level = 7;
      // Keep one dark cooling edge beneath each heavy curve. The lit upper
      // silhouette remains turquoise and never becomes a white enclosing ring.
      if (edge[i]) level = u + v < -.38 ? Math.min(level,4) : 0;
      pix.set(px,py,WATER[level]);
    }
    result.l = Math.min(result.l,px); result.t = Math.min(result.t,py);
    result.r = Math.max(result.r,px); result.b = Math.max(result.b,py);
  }
  return result;
}
