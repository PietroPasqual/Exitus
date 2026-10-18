import { inPoly, type Pix, type RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';

/** Original composed sphere: this does not define a gameplay fusion or effect. */
export interface FireMetalSphereBox { l: number; t: number; r: number; b: number }
export type FireMetalPrimary = 'fogo' | 'metal';
type Point = [number, number];
interface StaticSurface {
  plates: Int8Array;
  body: Uint8Array;
  baseTone: Int8Array;
  contact: Float32Array;
}
// Only frame-independent construction is retained: no animation images or
// moving crown pixels. Exact centre/scale keys preserve subpixel rasterization.
// Seven bytes per cell; at most 24 entries / 65,536 cells (448 KiB payload).
const staticSurfaces = new BoundedPixelCache<StaticSurface>(24, 65536);

// Three unequal, overlapping pressed-steel plates. Their rigid shapes, rather
// than a spherical clipping mask, are responsible for the finished silhouette.
const SHELL_TOP: Point[] = [[-1,.02],[-.94,-.37],[-.65,-.76],[-.21,-.98],[.26,-.93],[.6,-.68],[.4,-.42],[.1,-.39],[.01,-.23],[-.15,-.23],[-.15,-.06],[-.37,.16],[-.72,.26]];
const SHELL_FRONT: Point[] = [[-.98,-.05],[-.65,-.35],[-.28,-.48],[.15,-.47],[.4,-.58],[.47,-.52],[.4,-.42],[.1,-.39],[.01,-.23],[-.15,-.23],[-.15,-.06],[-.37,.16],[-.72,.26]];
const SHELL_RIGHT: Point[] = [[.72,-.63],[.97,-.29],[1.04,.13],[.89,.52],[.59,.8],[.34,.84],[.18,.61],[.16,.33],[.27,.08],[.35,-.08],[.3,-.23],[.46,-.25]];
const SHELL_BASE: Point[] = [[-.96,.17],[-.76,.56],[-.35,.86],[.13,.99],[.59,.82],[.36,.59],[.01,.55],[-.24,.4],[-.43,.18],[-.7,.26]];
const APERTURE: Point[] = [[-.72,.33],[-.43,.11],[-.23,-.18],[.06,-.4],[.39,-.47],[.53,-.76],[.76,-.6],[.69,-.25],[.57,.08],[.46,.38],[.36,.67],[.05,.7],[-.25,.52]];

// The fire-led body has a solid, interrupted steel cradle, not an external ring.
// Its upper lip and lower shoe overlap at the left; its right end is open.
const RIB_TOP: Point[] = [[-.16,-.83],[-.57,-.77],[-.91,-.4],[-1.04,.02],[-.9,.3],[-.64,.24],[-.57,-.13],[-.38,-.45],[-.1,-.6]];
const RIB_BASE: Point[] = [[-.98,.05],[-.89,.51],[-.57,.85],[-.1,1.01],[.39,.92],[.72,.63],[.41,.66],[.04,.66],[-.31,.53],[-.57,.27],[-.64,.06]];
const RIB_TIP: Point[] = [[.35,.68],[.65,.53],[.85,.25],[.9,.48],[.73,.72],[.4,.93],[.13,.91]];
const FIRE_BODY: Point[] = [[-.53,-.69],[-.18,-.87],[.21,-.89],[.65,-.66],[.88,-.28],[.94,.11],[.76,.51],[.4,.77],[-.03,.85],[-.4,.66],[-.63,.35],[-.7,-.07]];
const FIRE_FOLD: Point[] = [[-.48,-.36],[-.31,-.56],[-.04,-.6],[.22,-.46],[.37,-.2],[.34,.1],[.16,.33],[-.13,.42],[-.36,.31],[-.17,.56],[.22,.61],[.57,.36],[.68,.02],[.54,-.4],[.23,-.69],[-.13,-.75],[-.43,-.59]];
const KERNEL: Point[] = [[-.4,-.29],[-.26,-.47],[-.04,-.49],[.13,-.31],[.16,-.07],[.02,.16],[-.19,.3],[-.37,.13],[-.48,-.06]];

const STEEL: readonly RGB[] = [[24,29,41],[48,60,77],[78,96,112],[124,145,153],[183,205,205],[238,244,220]];
const HEAT: readonly RGB[] = [[91,26,29],[164,42,26],[224,66,24],[255,119,30],[255,183,55],[255,225,117],[255,247,192]];
const CONTACT: RGB = [167,94,59];
const LIP: RGB = [229,148,70];
const TIP_X = [-.15,-.04,.14,.27,.25,.17,.06,-.08];
const TIP_Y = [-1.46,-1.36,-1.24,-1.18,-1.22,-1.28,-1.35,-1.43];

const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const radiusOf = (s: number): number => Math.max(1.5, Number.isFinite(s) ? Math.abs(s) * .9 : 1.5);

/** One conservative local envelope for every pose, including fractional centres. */
export function fireMetalSphereBounds(s: number, primary: FireMetalPrimary = 'metal'): FireMetalSphereBox {
  const r = radiusOf(s);
  return { l: Math.floor(-1.08 * r) - 1, t: Math.floor(-1.5 * r) - 1,
    r: Math.ceil((primary === 'fogo' ? 1.2 : 1.08) * r) + 1, b: Math.ceil(1.03 * r) + 1 };
}

function segmentDistance(u: number, v: number, a: Point, b: Point): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const at = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - a[0] - dx * at, v - a[1] - dy * at);
}
function pathDistance(u: number, v: number, points: Point[]): number {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) distance = Math.min(distance, segmentDistance(u, v, points[i - 1], points[i]));
  return distance;
}
function pathProgress(u: number, v: number, points: Point[]): number {
  let distance = Infinity, progress = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1], b = points[k], dx = b[0] - a[0], dy = b[1] - a[1];
    const at = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(u - a[0] - dx * at, v - a[1] - dy * at);
    if (d < distance) { distance = d; progress = (k - 1 + at) / (points.length - 1); }
  }
  return progress;
}

/** Eight exact 8-fps poses; steel stays rigid and the hot front feeds its own tongue. */
export function paintFireMetalSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: FireMetalPrimary): FireMetalSphereBox {
  const phase = phaseOf(frame), r = radiusOf(s), fireFirst = primary === 'fogo', tiny = s <= 8;
  const q = fireMetalSphereBounds(s, primary), bounds = { l: x + q.l, t: y + q.t, r: x + q.r, b: y + q.b };
  // The tip peaks two beats after heat reaches the upper throat. All roots stay
  // in place, so the gesture is a flame rolling out of a seam, never bobbing.
  const tipX = TIP_X[phase], tipY = TIP_Y[phase];
  const crown: Point[] = fireFirst
    ? [[.35,.34],[.88,.15],[1.14,-.19],[1.16,-.48],[1.03,-.79],[.72,-1.04],[tipX,tipY * .83],[.3,-.99],[.48,-.75],[.45,-.46],[.35,-.15]]
    : [[.1,-.25],[.49,-.34],[.72,-.65],[.76,-.94],[.55,-1.18],[tipX,tipY],[.3,-1.04],[.37,-.83],[.3,-.59],[.02,-.4]];
  const plates = fireFirst ? [RIB_TOP,RIB_TIP,RIB_BASE] : [SHELL_TOP,SHELL_RIGHT,SHELL_BASE];
  const flow: Point[] = fireFirst
    ? [[-.34,.26],[.02,.46],[.38,.35],[.67,.06],[.85,-.27],[.8,-.62],[.52,-.9],[tipX,tipY * .83 + .1]]
    : [[-.46,.27],[-.21,.3],[.04,.24],[.12,.04],[.21,-.22],[.4,-.43],[.48,-.75],[.43,-1.05]];
  const rails: Point[][] = fireFirst
    ? [[[-.85,-.3],[-.57,-.63],[-.21,-.71]],[[-.79,.37],[-.48,.66],[-.07,.81],[.26,.78]],[[.6,.65],[.73,.46]]]
    : [[[-.83,-.31],[-.59,-.65],[-.23,-.83],[.16,-.8]],[[.62,-.2],[.7,.03],[.61,.24]], [[-.65,.44],[-.34,.64]]];
  // The plate samples the same rising channel as its neighbouring flame. The
  // moving tip is excluded, so heat cannot slide across a rigid steel surface.
  const contactFlow = fireFirst ? flow.slice(0, -1) : flow;
  const left = Math.floor(bounds.l), top = Math.floor(bounds.t), width = Math.ceil(bounds.r) - left + 1, height = Math.ceil(bounds.b) - top + 1;
  const surfaceKey = `${x}|${y}|${s}|${primary}`;
  const cachedSurface = staticSurfaces.get(surfaceKey);
  const surface: StaticSurface = cachedSurface ?? {
    plates: new Int8Array(width * height).fill(-1), body: new Uint8Array(width * height),
    baseTone: new Int8Array(width * height).fill(2), contact: new Float32Array(width * height)
  };
  const material = new Int8Array(width * height).fill(-2);
  const tone = new Int8Array(width * height);

  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const u = (left + i - x) / r, v = (top + j - y) / r, index = j * width + i;
    let plate = cachedSurface ? surface.plates[index] : -1;
    if (!cachedSurface) {
      // Last plate wins in overlaps; reverse traversal can stop at that hit.
      for (let k = plates.length - 1; k >= 0; k--) if (inPoly(plates[k],u,v)) { plate = k; break; }
      surface.plates[index] = plate;
      if (plate < 0 && inPoly(fireFirst ? FIRE_BODY : APERTURE,u,v)) surface.body[index] = 1;
    }
    const isFlame = plate < 0 && inPoly(crown,u,v), isBody = surface.body[index] !== 0;
    if (plate < 0 && !isFlame && !isBody) continue;
    material[index] = plate;
    if (plate >= 0) {
      // Broad flat planes share one light source and a narrow fixed reflection.
      // Plate edges stay rigid while the adjoining heat travels upward.
      if (cachedSurface) {
        tone[index] = surface.baseTone[index];
        continue;
      }
      let level = plate === 0 ? 3 : 2;
      if (plate === 1 && (u > .83 || v > .48)) level = 1;
      if (plate === 0 && v < -.55 - u * .13) level = 4;
      if (plate === 0 && u < -.72) level = 2;
      if (!fireFirst && plate === 0 && inPoly(SHELL_FRONT,u,v)) level = 2;
      if (!fireFirst && plate === 1 && u < .7 && v < .42) level = 3;
      if (!fireFirst && plate === 1 && v > .25 + (u - .3) * .55) level = 1;
      if (plate === 2 && v > .68 + u * .1) level = 1;
      if (plate === 2 && v > .48 && v < .59 && u < -.32) level = 3;
      const rail = pathDistance(u,v,rails[fireFirst ? (plate === 1 ? 2 : plate === 2 ? 1 : 0) : plate]);
      if (rail * r < (tiny ? .45 : .56)) level = plate === 2 ? 4 : 5;
      if (!fireFirst && plate === 0 && !tiny && segmentDistance(u,v,[-.58,-.34],[-.1,-.49]) * r < .5) level = 1;
      if (!tiny && rail * r > .56 && rail * r < 1.5) level = Math.min(level,2);
      surface.contact[index] = pathProgress(u,v,contactFlow);
      surface.baseTone[index] = level;
      tone[index] = level;
    } else {
      let level = cachedSurface ? surface.baseTone[index] : isBody ? 3 : 2;
      if (!cachedSurface && fireFirst && isBody) {
        if (v > .41 - u * .15) level = 2;
        if (inPoly(FIRE_FOLD,u,v)) level = 4;
        if (inPoly(KERNEL,u,v)) level = 5;
        if (Math.hypot(u + .2,v + .12) < (tiny ? .21 : .16)) level = 6;
      } else if (!cachedSurface && isBody) {
        if (u < .04 && v > .22) level = 2;
        if (u > -.18 && u < .35 && v > -.28 && v < .43) level = 3;
        if (segmentDistance(u,v,[-.19,.24],[.14,-.02]) * r < (tiny ? .48 : .65)) level = 4;
      }
      if (!cachedSurface) surface.baseTone[index] = level;
      // A single luminous front advances up a connected curving channel.
      // The trailing segment cools first, while the tip responds two beats later.
      for (let k = 0; k < flow.length - 1; k++) {
        const behind = (phase - k + 8) % 8;
        if (behind > 2) continue;
        if (segmentDistance(u,v,flow[k],flow[k + 1]) * r < (tiny ? .58 : 1.1)) level = Math.max(level, behind === 0 ? 6 : behind === 1 ? 4 : 3);
      }
      if (isFlame && v < -.73 && pathDistance(u,v,flow) * r < (tiny ? .48 : .68)) level = Math.max(level,4);
      tone[index] = level;
    }
  }
  if (!cachedSurface) staticSurfaces.set(surfaceKey, surface, width * height);
  // At native miniature sizes a polygon tip can rasterize diagonally away
  // from its root. Keep the single rooted mass; never emit a detached spark.
  const connected = new Uint8Array(width * height);
  const seed = Math.round(y - top) * width + Math.round(x - left);
  const queue = material[seed] !== -2 ? [seed] : [];
  connected[seed] = 1;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const at = queue[cursor];
    for (let direction = 0; direction < 4; direction++) {
      const next = direction === 0 ? at - 1 : direction === 1 ? at + 1 : direction === 2 ? at - width : at + width;
      if (next < 0 || next >= material.length || material[next] === -2 || connected[next]) continue;
      connected[next] = 1; queue.push(next);
    }
  }
  for (let j = 1; j < height - 1; j++) for (let i = 1; i < width - 1; i++) {
    const index = j * width + i, plate = material[index];
    if (!connected[index]) continue;
    const u = (left + i - x) / r, v = (top + j - y) / r;
    const a = material[index - 1], b = material[index + 1], c = material[index - width], d = material[index + width];
    const edge = a === -2 || b === -2 || c === -2 || d === -2;
    const innerEdge = plate >= 0 && (a === -1 || b === -1 || c === -1 || d === -1);
    let level = tone[index];
    if (plate >= 0) {
      if (edge && u + v > -.45) level = 0;
      else if (edge) level = Math.min(level,3);
      // A dark one-pixel recess under a plate gives the fire a physical depth.
      if (innerEdge) level = plate === 0 ? Math.max(2,level - 1) : 0;
      const age = (phase / 8 - surface.contact[index] + 1) % 1;
      // Only a real steel/fire edge receives heat. One bright leading pixel
      // passes along it, followed by a copper lip and then the dark recess.
      let color = STEEL[level];
      if (innerEdge && !edge && age < .46)
        color = tiny ? CONTACT : age < .12 ? HEAT[4] : age < .25 ? LIP : CONTACT;
      // A single reflected bevel sits behind the live edge, never across an
      // entire plate. Keep the outer silhouette and fixed steel rails intact.
      else if (!tiny && !edge && level > 0 && level < 4 && age < .16
        && (material[index - 2] === -1 || material[index + 2] === -1
          || material[index - width * 2] === -1 || material[index + width * 2] === -1)) color = CONTACT;
      pix.set(left + i,top + j,color);
    } else {
      // The flame root and the bevel brighten together on opposite sides of
      // the same joint; no detached ember is added to the silhouette.
      const steel = a >= 0 ? index - 1 : b >= 0 ? index + 1 : c >= 0 ? index - width : d >= 0 ? index + width : -1;
      if (steel >= 0 && (phase / 8 - surface.contact[steel] + 1) % 1 < .25)
        level = Math.max(level,tiny ? 4 : 5);
      if (edge) level = v > .25 ? 0 : Math.min(level,2);
      pix.set(left + i,top + j,HEAT[level]);
    }
  }
  return bounds;
}
