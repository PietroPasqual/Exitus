import { inPoly, type Pix, type RGB } from './pixel';
import { BoundedPixelCache } from './pixel-bounded-cache';

/** An authored material body, independent of spell rules and circle effects. */
export interface WaterMetalSphereBox { l: number; t: number; r: number; b: number }
export type WaterMetalPrimary = 'agua' | 'metal';
type Point = [number, number];
type Path = { points: Point[]; lengths: number[]; total: number };
interface Surface {
  material: Uint8Array;
  tone: Uint8Array;
  distance: Float32Array;
  progress: Float32Array;
}

// Frame-independent geometry only: four arrays, ten bytes per cell, limited
// to 24 exact centre/scale entries and 65,536 cells (640 KiB payload).
const surfaces = new BoundedPixelCache<Surface>(24, 65536);
const STEEL: readonly RGB[] = [[24,28,33],[46,53,60],[74,83,91],[111,122,130],[169,181,186],[225,233,231]];
const WATER: readonly RGB[] = [[11,32,67],[14,54,102],[18,85,142],[20,122,177],[29,165,205],[91,216,233],[174,243,243]];

// Water-led: a forged diagonal spine, with a flat oblique top and a thick
// charcoal cut. Both of its ends are embedded; this is not a ring or a cap.
const SPINE: Point[] = [[-.56,-.63],[-.38,-.78],[-.22,-.66],[.43,.27],[.49,.48],[.31,.58],[.11,.34],[-.45,-.41]];
const SPINE_CUT: Point[] = [[-.56,-.63],[-.45,-.41],[.11,.34],[.31,.58],[.49,.48],[.46,.62],[.27,.72],[.07,.5],[-.52,-.28],[-.63,-.49]];
const SPINE_PLANE: Point[] = [[-.38,-.78],[-.22,-.66],[.43,.27],[.49,.48],[.31,.58],[.21,.38],[-.34,-.42]];
const LOWER_SPINE: Point[] = [[.01,.07],[.19,.02],[.52,.34],[.53,.49],[.31,.6],[.15,.43],[-.01,.19]];

// Metal-led: opposing thick faces leave an S-shaped recessed window. The
// lower foot belongs to the right face and disappears beneath the liquid.
// Neither face is an upper/lower hemisphere or one of the accepted ice plates.
const LEFT_FACE: Point[] = [[-.94,-.13],[-.79,-.58],[-.42,-.91],[-.06,-.98],[.18,-.81],[.19,-.62],[.14,-.49],[.02,-.36],[-.15,-.24],[-.27,-.08],[-.3,.07],[-.23,.22],[-.08,.34],[-.02,.47],[-.04,.62],[-.14,.73],[-.32,.83],[-.59,.68],[-.87,.32]];
const LEFT_CUT: Point[] = [[.18,-.81],[.28,-.68],[.23,-.48],[.11,-.32],[-.07,-.18],[-.17,-.04],[-.19,.08],[-.12,.19],[.05,.31],[.11,.46],[.09,.65],[-.04,.82],[-.22,.9],[-.32,.83],[-.14,.73],[-.04,.62],[-.02,.47],[-.08,.34],[-.23,.22],[-.3,.07],[-.27,-.08],[-.15,-.24],[.02,-.36],[.14,-.49],[.19,-.62]];
const RIGHT_FACE: Point[] = [[.6,-.82],[.81,-.61],[1,-.2],[1.01,.18],[.87,.56],[.57,.87],[.35,.91],[.34,.7],[.51,.48],[.52,.35],[.46,.23],[.34,.11],[.32,-.02],[.38,-.19],[.53,-.39],[.61,-.55],[.63,-.62]];
const RIGHT_CUT: Point[] = [[.6,-.82],[.63,-.62],[.61,-.55],[.53,-.39],[.38,-.19],[.32,-.02],[.34,.11],[.46,.23],[.52,.35],[.51,.48],[.34,.7],[.35,.91],[.19,.81],[.2,.61],[.38,.42],[.39,.35],[.33,.27],[.22,.17],[.16,.04],[.19,-.12],[.31,-.33],[.42,-.46],[.49,-.71]];
const FOOT: Point[] = [[.43,.48],[.67,.56],[.57,.82],[.3,.96],[.06,.8],[.12,.61],[.26,.7]];

function makePath(points: Point[]): Path {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, lengths, total: lengths[lengths.length - 1] };
}

// Follow the liquid from its heavy base, through the first underpass, round
// the side fold, then behind the upper plane. Closing the path makes 7→0 the
// same advection step as every other pair of frames, without a reset flash.
const WATER_FLOW = makePath([[.04,.76],[-.37,.64],[-.62,.35],[-.55,.06],[-.28,-.08],[.12,-.01],[.5,.09],[.73,-.08],[.7,-.43],[.4,-.7],[.03,-.79],[-.23,-.63],[-.3,-.37],[-.08,-.15],[.26,.05],[.5,.28],[.42,.58],[.04,.76]]);
const METAL_FLOW = makePath([[-.08,.76],[.14,.8],[.39,.74],[.55,.61],[.59,.43],[.5,.29],[.31,.19],[.07,.15],[-.04,.04],[-.03,-.11],[.1,-.29],[.29,-.5],[.39,-.74],[.1,-.87],[-.18,-.7],[-.36,-.42],[-.37,-.12],[-.42,.22],[-.3,.56],[-.08,.76]]);
const WATER_RAIL = makePath([[-.4,-.66],[.03,-.04]]);
const LOWER_RAIL = makePath([[.17,.16],[.37,.38]]);
const LEFT_RAIL = makePath([[-.72,-.45],[-.4,-.74],[-.11,-.81]]);
const RIGHT_RAIL = makePath([[.65,-.57],[.81,-.22],[.82,.14]]);
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const radiusOf = (s: number): number => Math.max(1.5, Number.isFinite(s) ? Math.abs(s) * .9 : 1.5);

/** Conservative local envelope covering all eight poses and subpixel centres. */
export function waterMetalSphereBounds(s: number, _primary: WaterMetalPrimary = 'agua'): WaterMetalSphereBox {
  const r = radiusOf(s);
  return { l: Math.floor(-1.06 * r) - 1, t: Math.floor(-1.06 * r) - 1,
    r: Math.ceil(1.06 * r) + 1, b: Math.ceil(1.06 * r) + 1 };
}

function alongPath(u: number, v: number, path: Path): { distance: number; progress: number } {
  let best = Infinity, progress = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = (u - a[0] - dx * t) ** 2 + (v - a[1] - dy * t) ** 2;
    if (d < best) { best = d; progress = (path.lengths[i - 1] + (path.lengths[i] - path.lengths[i - 1]) * t) / path.total; }
  }
  return { distance: Math.sqrt(best), progress };
}

/** Rigid steel, advected broad liquid fronts; eight complete, pure Pix poses. */
export function paintWaterMetalSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: WaterMetalPrimary): WaterMetalSphereBox {
  const r = radiusOf(s), phase = phaseOf(frame), metal = primary === 'metal', tiny = r < 8;
  const box = waterMetalSphereBounds(s, primary), left = Math.floor(x + box.l), top = Math.floor(y + box.t);
  const right = Math.ceil(x + box.r), bottom = Math.ceil(y + box.b), w = right - left + 1, h = bottom - top + 1;
  const key = `${x}|${y}|${s}|${primary}`;
  let surface = surfaces.get(key);
  if (!surface) {
    surface = { material: new Uint8Array(w * h), tone: new Uint8Array(w * h), distance: new Float32Array(w * h), progress: new Float32Array(w * h) };
    const { material, tone, distance, progress } = surface;
    for (let row = 1; row < h - 1; row++) for (let col = 1; col < w - 1; col++) {
      const index = row * w + col, u = (left + col - x) / r, v = (top + row - y) / r;
      const round = Math.hypot((u + .02) * 1.015, (v - .025) * 1.015);
      let kind = round < .985 ? 1 : 0, level = 3;
      if (kind) {
        if (v > .47 - u * .21 || u < -.73 || u > .75) level = 2;
        if (v > .76 || (u > .58 && v > .3)) level = 1;
        if (Math.hypot((u + .32) * 1.2,(v + .4) * 1.3) < .49) level = 4;
      }
      if (!metal) {
        if (inPoly(SPINE_CUT,u,v)) { kind = 2; level = 1; }
        if (inPoly(SPINE,u,v)) { kind = 3; level = 3; }
        if (kind === 3 && inPoly(SPINE_PLANE,u,v)) level = 2;
        if (kind === 3 && v < -.48) level = 4;
        if (inPoly(LOWER_SPINE,u,v)) { kind = 3; level = u > .3 ? 2 : 3; }
        if (kind === 3 && alongPath(u,v,LOWER_RAIL).distance * r < (tiny ? .4 : .5)) level = 4;
        if (kind === 3 && alongPath(u,v,WATER_RAIL).distance * r < (tiny ? .5 : .55)) level = 5;
      } else {
        if (inPoly(LEFT_CUT,u,v)) { kind = 2; level = 1; }
        if (inPoly(LEFT_FACE,u,v)) {
          kind = 3; level = v < -.37 + u * .2 ? 3 : 2;
          if (v < -.64 - u * .1) level = 4;
          if (u < -.71) level = 1;
          if (v > .45) level = 1;
          if (alongPath(u,v,LEFT_RAIL).distance * r < (tiny ? .45 : .55)) level = 5;
        }
        if (inPoly(FOOT,u,v)) { kind = 2; level = 1; }
        if (inPoly(RIGHT_CUT,u,v)) { kind = 2; level = 0; }
        if (inPoly(RIGHT_FACE,u,v)) {
          kind = 3; level = u > .83 || v > .48 ? 1 : 2;
          if (u < .75 && v < .18) level = 3;
          if (v < -.49) level = 4;
          if (alongPath(u,v,RIGHT_RAIL).distance * r < (tiny ? .45 : .55)) level = 5;
        }
      }
      const flow = alongPath(u,v,metal ? METAL_FLOW : WATER_FLOW);
      // The recessed channel opens into a rounded basin beside the submerged
      // foot, so its turn reads as a heavy liquid fold rather than a crack.
      if (metal && round < .97 && Math.hypot((u - .3) / .46,(v - .64) / .29) < 1) { kind = 1; level = v > .72 ? 2 : 3; }
      // The middle fold washes over one joint in the short oblique spine; the
      // second, offset steel face reappears beneath it and sinks at its foot.
      if (!metal && round < .97 && u > -.22 && u < .31 && v > -.13 && v < .14 && flow.distance < .12) { kind = 1; level = 3; }
      // A low meniscus in front of the steel foot visibly buries its bottom.
      // Its silhouette is fixed; only the water pressure travelling along it moves.
      const grip = round < .97 && (metal
        ? v > .55 && v < .88 && u > -.12 && u < .67 && flow.distance < .155
        : v > .38 && v < .69 && u > .13 && u < .53 && flow.distance < .13);
      if (grip) { kind = 1; level = 3; }
      material[index] = kind; tone[index] = level;
      distance[index] = flow.distance; progress[index] = flow.progress;
    }
    // At s=3 and fractional centres the sharp endpoint can become diagonal.
    // Retain only the rooted four-connected body; no isolated flecks survive.
    let seed = -1, seedDistance = Infinity;
    for (let i = 0; i < material.length; i++) if (material[i]) {
      const d = (left + i % w - x) ** 2 + (top + Math.floor(i / w) - y) ** 2;
      if (d < seedDistance) { seedDistance = d; seed = i; }
    }
    const connected = new Uint8Array(w * h), queue: number[] = seed < 0 ? [] : [seed];
    if (seed >= 0) connected[seed] = 1;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const i = queue[cursor];
      for (const next of [i - 1,i + 1,i - w,i + w]) {
        if (next < 0 || next >= material.length || !material[next] || connected[next]) continue;
        connected[next] = 1; queue.push(next);
      }
    }
    for (let i = 0; i < material.length; i++) if (!connected[i]) material[i] = 0;
    surfaces.set(key,surface,w * h);
  }

  const { material, tone, distance, progress } = surface;
  const bounds: WaterMetalSphereBox = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let row = 1; row < h - 1; row++) for (let col = 1; col < w - 1; col++) {
    const index = row * w + col, kind = material[index];
    if (!kind) continue;
    const px = left + col, py = top + row, u = (px - x) / r, v = (py - y) / r;
    const a = material[index - 1], b = material[index + 1], c = material[index - w], d = material[index + w];
    const edge = !a || !b || !c || !d;
    let level = tone[index];
    if (kind === 1) {
      const width = metal ? .135 : .145, front = (progress[index] - phase / 8 + 1) % 1;
      // A wide dark bank locates the fold. The following broad bright fronts
      // move through it, disappear below a bridge, then reappear on its flank.
      if (distance[index] < width + .055) level = 1;
      if (distance[index] < width) level = 4;
      if (distance[index] < width * .72 && front > .04 && front < .35) level = 5;
      if (!tiny && distance[index] < width * .32 && front > .12 && front < .24) level = 6;
      // Water just beneath a hard plane remains deep enough to read as inset.
      if (c >= 2 && level < 5) level = Math.min(level,2);
      if (edge) level = u + v > -.3 ? 0 : 2;
      pix.set(px,py,WATER[level]);
    } else {
      if (edge && u + v > -.5) level = 0;
      else if (edge) level = Math.min(level,3);
      pix.set(px,py,STEEL[level]);
    }
    if (px >= 0 && px < pix.w && py >= 0 && py < pix.h) {
      bounds.l = Math.min(bounds.l,px); bounds.t = Math.min(bounds.t,py);
      bounds.r = Math.max(bounds.r,px); bounds.b = Math.max(bounds.b,py);
    }
  }
  return bounds;
}
