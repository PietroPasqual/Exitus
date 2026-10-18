import { inPoly, type Pix, type RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';

/** An authored material study only; it does not change spell or fusion rules. */
export interface FireEarthSphereBox { l: number; t: number; r: number; b: number }
export type FireEarthPrimary = 'fogo' | 'terra';
type Point = [number, number];
interface Rock { body: Point[]; crown: Point[]; cut: Point[]; chip: Point[] }
interface Surface { rocks: Int8Array; tones: Uint8Array; flags: Uint8Array; progress: Float64Array }
// Only immutable geometry and path coordinates are cached, never a pose. Exact
// centres preserve fractional rasterization; at most 16 entries / 264 KiB.
const surfaces = new BoundedPixelCache<Surface>(16,24576);
const BODY = 1, FOOT_FOLD = 2, WARM_FLOW = 8, HOT_FLOW = 16, TIP_FLOW = 32;

const ROCK: readonly RGB[] = [[34,24,27],[60,40,35],[90,60,45],[128,88,59],[168,125,82],[204,165,111]];
const HEAT: readonly RGB[] = [[94,25,28],[163,39,25],[218,59,22],[249,102,23],[255,159,39],[255,216,91],[255,244,169]];
const WARM: RGB = [177,88,43], LIT: RGB = [230,139,58];

// Three unequal interlocking boulders. The middle boulder projects over the
// channel: its deep cut hides the fire before it reappears at the right shoulder.
// Broad broken planes and short chips replace steel rails or noise textures.
const EARTH: Rock[] = [
  {
    body: [[-.98,-.04],[-.91,-.39],[-.71,-.68],[-.38,-.9],[-.03,-.96],[.32,-.82],[.4,-.6],[.19,-.4],[.01,-.37],[-.13,-.13],[-.46,-.03],[-.65,.15],[-.85,.13]],
    crown: [[-.91,-.39],[-.71,-.68],[-.38,-.9],[-.03,-.96],[.15,-.8],[-.06,-.57],[-.3,-.53],[-.48,-.28],[-.73,-.2]],
    cut: [[-.73,-.2],[-.48,-.28],[-.3,-.53],[-.06,-.57],[.15,-.8],[.32,-.82],[.4,-.6],[.19,-.4],[.01,-.37],[-.13,-.13],[-.46,-.03],[-.65,.15],[-.85,.13]],
    chip: [[-.63,-.51],[-.43,-.61],[-.25,-.59],[-.36,-.5],[-.54,-.44]],
  },
  {
    body: [[.24,-.58],[.54,-.71],[.77,-.6],[.91,-.31],[1,.04],[.85,.35],[.64,.48],[.51,.47],[.37,.39],[.14,.37],[.01,.13],[.07,-.12],[.25,-.22]],
    crown: [[.24,-.58],[.54,-.71],[.77,-.6],[.83,-.35],[.57,-.17],[.34,-.22],[.14,-.08],[.07,-.12],[.25,-.22]],
    cut: [[.57,-.17],[.83,-.35],[.91,-.31],[1,.04],[.85,.35],[.64,.48],[.51,.47],[.37,.39],[.14,.37],[.01,.13],[.14,.09],[.33,.16],[.5,.04]],
    chip: [[.43,-.4],[.53,-.47],[.68,-.43],[.6,-.35],[.48,-.32]],
  },
  {
    body: [[-.88,.3],[-.65,.28],[-.5,.4],[-.29,.39],[-.12,.54],[.12,.58],[.34,.7],[.6,.66],[.54,.83],[.17,.99],[-.21,.92],[-.5,.77],[-.7,.66],[-.91,.44]],
    crown: [[-.88,.3],[-.65,.28],[-.5,.4],[-.29,.39],[-.12,.54],[.12,.58],[.34,.7],[.02,.77],[-.25,.65],[-.47,.67],[-.65,.51],[-.8,.48]],
    cut: [[-.8,.48],[-.65,.51],[-.47,.67],[-.25,.65],[.02,.77],[.34,.7],[.6,.66],[.54,.83],[.17,.99],[-.21,.92],[-.5,.77],[-.7,.66]],
    chip: [[-.52,.48],[-.38,.49],[-.28,.59],[-.43,.57],[-.57,.58]],
  },
];
const FIRE: Rock[] = [
  {
    body: [[-.98,-.29],[-.79,-.6],[-.52,-.82],[-.19,-.74],[-.04,-.54],[-.13,-.32],[-.36,-.16],[-.63,-.15],[-.82,-.23]],
    crown: [[-.79,-.6],[-.52,-.82],[-.19,-.74],[-.37,-.52],[-.62,-.48],[-.72,-.34],[-.87,-.38]],
    cut: [[-.37,-.52],[-.19,-.74],[-.04,-.54],[-.13,-.32],[-.36,-.16],[-.63,-.15],[-.82,-.23],[-.72,-.34],[-.62,-.48]],
    chip: [[-.59,-.63],[-.4,-.67],[-.48,-.59],[-.65,-.54]],
  },
  {
    body: [[.29,.08],[.53,-.04],[.76,.02],[.93,.22],[.88,.5],[.7,.73],[.4,.89],[.13,.76],[.07,.53],[.22,.39]],
    crown: [[.29,.08],[.53,-.04],[.76,.02],[.8,.19],[.58,.3],[.4,.24],[.22,.39],[.16,.28]],
    cut: [[.58,.3],[.8,.19],[.93,.22],[.88,.5],[.7,.73],[.4,.89],[.13,.76],[.07,.53],[.3,.55],[.47,.45]],
    chip: [[.38,.39],[.53,.38],[.5,.48],[.32,.52]],
  },
];
const EARTH_FLOW: Point[] = [[-.79,.17],[-.5,.19],[-.25,.26],[-.07,.4],[.17,.49],[.45,.57],[.68,.5],[.88,.24],[.83,-.06],[.76,-.35],[.84,-.59],[.96,-.77]];
const FIRE_FLOW: Point[] = [[-.66,.06],[-.6,.38],[-.32,.57],[-.02,.48],[.14,.25],[.29,.02],[.56,-.2],[.82,-.28],[1.01,-.48],[.96,-.64],[.78,-.76]];
// A connected foreground fold submerges the right boulder's root. The block
// keeps its rigid silhouette; the small flame lip laps across its foot.
const FOOT: Point[] = [[-.04,.61],[.12,.67],[.29,.73],[.46,.72],[.61,.59],[.59,.75],[.43,.89],[.26,.92],[.08,.79],[-.03,.74]];
const FOOT_FLOW: Point[] = [[-.02,.66],[.18,.78],[.38,.81],[.54,.7]];
const FIRE_BODY: Point[] = [[-.91,-.32],[-.77,-.64],[-.43,-.88],[-.06,-.94],[.35,-.8],[.68,-.55],[.88,-.2],[.98,.18],[.88,.51],[.61,.8],[.21,.96],[-.2,.92],[-.55,.74],[-.83,.44],[-1,.08]];
const SEAM: Point[] = [[-.97,-.01],[-.82,-.14],[-.54,-.1],[-.22,-.23],[.06,-.37],[.29,-.62],[.59,-.68],[.86,-.43],[.98,-.13],[.98,.27],[.73,.57],[.52,.76],[.17,.81],[-.07,.63],[-.4,.48],[-.73,.39],[-.91,.29]];
const KERNEL: Point[] = [[-.71,-.13],[-.43,-.35],[-.12,-.56],[.17,-.53],[.37,-.31],[.34,-.02],[.13,.19],[-.03,.43],[-.24,.58],[-.5,.48],[-.67,.22]];
const HEART: Point[] = [[-.48,-.14],[-.23,-.35],[.01,-.33],[.12,-.11],[-.01,.09],[-.16,.26],[-.35,.3],[-.49,.12]];
const TIP_X = [1.12,1.24,1.27,1.19,1.03,.9,.93,1.02];
const TIP_Y = [-.95,-.88,-.77,-.82,-.93,-1.06,-1.08,-1.02];
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const radiusOf = (s: number): number => Math.max(1.5, Number.isFinite(s) ? Math.abs(s) * .9 : 1.5);

/** Conservative local envelope shared by all eight poses and fractional centres. */
export function fireEarthSphereBounds(s: number, _primary?: FireEarthPrimary): FireEarthSphereBox {
  const r = radiusOf(s);
  return { l: Math.floor(-1.04 * r) - 1, t: Math.floor(-1.12 * r) - 1,
    r: Math.ceil(1.31 * r) + 1, b: Math.ceil(1.03 * r) + 1 };
}

function along(u: number, v: number, path: Point[]): { distance: number; progress: number } {
  let distance = Infinity, progress = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dy)/(dx*dx+dy*dy)));
    const d = Math.hypot(u-a[0]-dx*t,v-a[1]-dy*t);
    if (d < distance) { distance = d; progress = (k - 1 + t) / (path.length - 1); }
  }
  return { distance, progress };
}

/**
 * Eight cyclic poses use the caller's clock. Rock contours stay rigid while a
 * hot front moves beneath their joint, lights one contact face, then cools.
 * No particles, halos, timers, random texture, or inferred fusion metadata.
 */
export function paintFireEarthSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: FireEarthPrimary): FireEarthSphereBox {
  const r = radiusOf(s), phase = phaseOf(frame), fiery = primary === 'fogo', tiny = r < 8;
  const envelope = fireEarthSphereBounds(s,primary);
  const left = Math.floor(x + envelope.l), top = Math.floor(y + envelope.t);
  const right = Math.ceil(x + envelope.r), bottom = Math.ceil(y + envelope.b);
  const w = right - left + 1, h = bottom - top + 1;
  const material = new Int8Array(w * h).fill(-2), tones = new Uint8Array(w * h);
  const contact = new Uint8Array(w * h), rocks = fiery ? FIRE : EARTH;
  const flow = fiery ? FIRE_FLOW : EARTH_FLOW;
  // The tongue grows sideways out of the exposed shoulder and folds inward.
  // Its fixed foot shares the fissure; this is not a flame perched on a rock.
  const tongue: Point[] = fiery
    ? [[.34,.02],[.72,-.1],[1.04,-.3],[1.18,-.54],[TIP_X[phase],TIP_Y[phase] * .82],
      [.61,-.86],[.72,-.7],[.74,-.54],[.59,-.4],[.35,-.36],[.21,-.2]]
    : [[.68,.06],[.94,-.09],[1.08,-.32],[1.15,-.55],[TIP_X[phase],TIP_Y[phase]],
      [.87,-.76],[.75,-.63],[.62,-.42],[.56,-.18]];

  const surfaceKey = `${x}|${y}|${s}|${primary}`;
  const cached = surfaces.get(surfaceKey);
  const surface: Surface = cached ?? { rocks: new Int8Array(w * h).fill(-1),
    tones: new Uint8Array(w * h), flags: new Uint8Array(w * h), progress: new Float64Array(w * h) };
  if (!cached) {
    const width = (tiny ? .74 : 1.08) / r;
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const at = j * w + i, u = (left + i - x) / r, v = (top + j - y) / r;
      let rock = -1;
      for (let k = rocks.length - 1; k >= 0; k--) if (inPoly(rocks[k].body,u,v)) { rock = k; break; }
      const body = inPoly(fiery ? FIRE_BODY : SEAM,u,v), foot = fiery && inPoly(FOOT,u,v);
      if (foot) rock = -1;
      const current = along(u,v,flow);
      surface.rocks[at] = rock;
      surface.progress[at] = current.progress;
      surface.flags[at] = (body ? BODY : 0) | (foot ? FOOT_FOLD : 0)
        | (current.distance < width * 1.9 ? WARM_FLOW : 0)
        | (current.distance < width ? HOT_FLOW : 0) | (current.distance < (tiny ? .12 : .09) ? TIP_FLOW : 0);
      let level = fiery ? 3 : 2;
      if (rock >= 0) {
        const shape = rocks[rock];
        level = 3;
        if (inPoly(shape.cut,u,v)) level = 2;
        if (inPoly(shape.crown,u,v)) level = rock === 0 ? 4 : 3;
        // Broad broken faces have differently angled, permanently dark feet.
        if (rock === 0 && u < -.63 && v > -.38) level = 2;
        if (rock === 0 && v < -.71 - .26 * u) level = 5;
        if (rock === 1 && u > .67 + v * .21) level = 1;
        if (rock === 1 && v > (fiery ? .49 : .18) + u * .2) level = 1;
        if (rock === 2 && v > .71 + u * .1) level = 1;
        if (!tiny && inPoly(shape.chip,u,v)) level = rock === 1 ? 3 : 2;
      } else if (fiery && body) {
        if (v > .57 || u < -.82) level = 2;
        if (inPoly(KERNEL,u,v)) level = 5;
        if (inPoly(HEART,u,v)) level = 6;
        if (u > .23 && v < -.39) level = 4;
      }
      surface.tones[at] = level;
    }
    surfaces.set(surfaceKey,surface,w * h);
  }
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const at = j * w + i, u = (left + i - x) / r, v = (top + j - y) / r;
    if (left + i < 0 || top + j < 0 || left + i >= pix.w || top + j >= pix.h) continue;
    const rock = surface.rocks[at], flags = surface.flags[at];
    const flame = rock < 0 && inPoly(tongue,u,v);
    if (rock < 0 && !(flags & BODY) && !flame) continue;
    material[at] = rock;
    const age = (phase / 8 - surface.progress[at] + 1) % 1;
    let level = surface.tones[at];
    if (rock >= 0) {
      // Store the passing front for the real shared edge, resolved below. A
      // narrow hand-drawn centreline must not leave a fire-touching face cold.
      if (age < .4) contact[at] = age < .13 ? 3 : age < .25 ? 2 : 1;
    } else {
      if ((flags & WARM_FLOW) && age < .35) level = Math.max(level,3);
      if ((flags & HOT_FLOW) && age < .28) level = Math.max(level,age < .13 ? 6 : age < .21 ? 5 : 3);
      if (flame && v < -.48 && (flags & TIP_FLOW)) level = Math.max(level,4);
      if (flags & FOOT_FOLD) {
        level = 3;
        const lip = along(u,v,FOOT_FLOW), front = (phase / 8 - lip.progress + 1) % 1;
        if (lip.distance * r < (tiny ? .62 : .74)) level = front < .26 ? 5 : 4;
      }
    }
    tones[at] = level;
  }

  // Prune only detached subpixel tips, retaining one four-connected object.
  // Choose the nearest occupied pixel, including when the centre is fractional.
  let seed = -1, best = Infinity;
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const at = j * w + i;
    if (material[at] === -2) continue;
    const d = (left + i - x) ** 2 + (top + j - y) ** 2;
    if (d < best) { best = d; seed = at; }
  }
  const connected = new Uint8Array(w * h), queue: number[] = seed < 0 ? [] : [seed];
  if (seed >= 0) connected[seed] = 1;
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k];
    for (const next of [at - 1,at + 1,at - w,at + w]) {
      if (next < 0 || next >= material.length || material[next] === -2 || connected[next]) continue;
      connected[next] = 1; queue.push(next);
    }
  }
  const bounds: FireEarthSphereBox = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const at = j * w + i;
    if (!connected[at]) continue;
    const rock = material[at], u = (left + i - x) / r, v = (top + j - y) / r;
    const neighbors = [material[at - 1],material[at + 1],material[at - w],material[at + w]];
    const edge = neighbors.includes(-2), joint = rock >= 0 && neighbors.includes(-1);
    let level = tones[at], color: RGB;
    if (rock >= 0) {
      if (edge && u + v > -.58) level = 0;
      else if (edge) level = Math.min(level,3);
      // Occlusion stays visibly dark beneath the overhanging central block.
      if (joint && (v > -.28 || rock > 0)) level = 0;
      color = ROCK[level];
      if (joint && !edge && contact[at])
        color = tiny ? WARM : contact[at] === 3 ? HEAT[4] : contact[at] === 2 ? LIT : WARM;
      // A warm bevel one pixel behind the seam makes the boulder feel thick.
      // Its broad faces, chips and dark outer rim retain their stone values.
      else if (!tiny && !edge && level > 0 && level < 4 && contact[at] === 3
        && (material[at - 2] === -1 || material[at + 2] === -1
          || material[at - w * 2] === -1 || material[at + w * 2] === -1)) color = WARM;
    } else {
      if (neighbors.some(neighbor => neighbor >= 0)) {
        const age = (phase / 8 - surface.progress[at] + 1) % 1;
        if (age < .25) level = Math.max(level,tiny ? 4 : 5);
      }
      if (edge) level = v > .35 ? 0 : Math.min(level,2);
      color = HEAT[level];
    }
    const px = left + i, py = top + j;
    pix.set(px,py,color);
    if (px >= 0 && py >= 0 && px < pix.w && py < pix.h) {
      bounds.l = Math.min(bounds.l,px); bounds.t = Math.min(bounds.t,py);
      bounds.r = Math.max(bounds.r,px); bounds.b = Math.max(bounds.b,py);
    }
  }
  return bounds;
}
