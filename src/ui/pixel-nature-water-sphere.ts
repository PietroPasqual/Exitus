import { inPoly, type Pix, type RGB } from './pixel';

export interface NatureWaterSphereBounds { l: number; t: number; r: number; b: number }
type Primary = 'natureza' | 'agua';
type Point = [number, number];
interface Leaf { root: Point; bend: Point; tip: Point; width: number; tone: number; delay: number }
interface Segment { ax: number; ay: number; dx: number; dy: number; squared: number; at: number }
interface LeafPose { points: Point[]; segments: Segment[]; box: NatureWaterSphereBounds; tone: number; delay: number }
const TAU = Math.PI * 2;
const C = {
  waterEdge: [18, 35, 70], waterDeep: [23, 70, 106], waterShade: [35, 126, 155],
  water: [77, 186, 197], crest: [157, 229, 223], gleam: [236, 255, 241],
  leafUnder: [20, 54, 34], leafDeep: [30, 94, 42], leaf: [43, 138, 62],
  leafLight: [64, 192, 87], vein: [140, 233, 154],
} satisfies Record<string, RGB>;

// Back blades shelter the upper shoulder; the last two fold across the liquid
// in front. Their stems share a planted lower root instead of orbiting a logo.
const NATURE_LEAVES: Leaf[] = [
  { root: [.10, .79], bend: [-.94, .18], tip: [-.42, -.90], width: .29, tone: .55, delay: 2 },
  { root: [.18, .72], bend: [-.24, -.35], tip: [.33, -.92], width: .25, tone: .68, delay: 0 },
  { root: [.24, .74], bend: [.94, -.06], tip: [.46, -.85], width: .25, tone: .48, delay: 4 },
  { root: [-.55, .47], bend: [-.78, -.27], tip: [.08, -.60], width: .24, tone: .72, delay: 1 },
  { root: [-.53, .53], bend: [.14, .75], tip: [.79, -.10], width: .26, tone: .61, delay: 3 },
];
const WATER_LEAVES: Leaf[] = [
  { root: [-.25, .79], bend: [-.98, .07], tip: [-.37, -.79], width: .20, tone: .55, delay: 2 },
  { root: [-.45, .65], bend: [-.75, -.20], tip: [-.06, -.49], width: .18, tone: .71, delay: 0 },
  { root: [-.53, .54], bend: [.11, .83], tip: [.65, .10], width: .19, tone: .62, delay: 3 },
];

function pose(leaf: Leaf, frame: number): LeafPose {
  const opening = Math.sin((frame + leaf.delay) * TAU / 8) * .026;
  const tip: Point = [leaf.tip[0] + opening * .3, leaf.tip[1] - opening * .5];
  const bend: Point = [leaf.bend[0] + opening, leaf.bend[1] - opening * .4];
  const left: Point[] = [], right: Point[] = [], vein: Point[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, q = 1 - t;
    const u = q * q * leaf.root[0] + 2 * q * t * bend[0] + t * t * tip[0];
    const v = q * q * leaf.root[1] + 2 * q * t * bend[1] + t * t * tip[1];
    const dx = 2 * q * (bend[0] - leaf.root[0]) + 2 * t * (tip[0] - bend[0]);
    const dy = 2 * q * (bend[1] - leaf.root[1]) + 2 * t * (tip[1] - bend[1]);
    const length = Math.hypot(dx, dy) || 1, width = leaf.width * Math.pow(Math.sin(t * Math.PI), .72);
    vein.push([u, v]); left.push([u - dy / length * width, v + dx / length * width]);
    right.push([u + dy / length * width, v - dx / length * width]);
  }
  const points = [...left, ...right.reverse()];
  return { points, tone: leaf.tone, delay: leaf.delay,
    box: { l: Math.min(...points.map(p => p[0])), t: Math.min(...points.map(p => p[1])),
      r: Math.max(...points.map(p => p[0])), b: Math.max(...points.map(p => p[1])) },
    segments: vein.slice(1).map(([bx, by], i) => {
      const [ax, ay] = vein[i], dx = bx - ax, dy = by - ay;
      return { ax, ay, dx, dy, squared: dx * dx + dy * dy, at: i };
    }) };
}

const POSES = {
  natureza: Array.from({ length: 8 }, (_, frame) => NATURE_LEAVES.map(leaf => pose(leaf, frame))),
  agua: Array.from({ length: 8 }, (_, frame) => WATER_LEAVES.map(leaf => pose(leaf, frame))),
};

function closest(u: number, v: number, segments: Segment[]): { distance: number; along: number; side: number } {
  let distance2 = Infinity, along = 0, side = 0;
  for (const { ax, ay, dx, dy, squared, at } of segments) {
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (squared || 1)));
    const ex = u - ax - dx * t, ey = v - ay - dy * t, d2 = ex * ex + ey * ey;
    if (d2 < distance2) { distance2 = d2; along = (at + t) / segments.length; side = Math.sign(dx * ey - dy * ex); }
  }
  return { distance: Math.sqrt(distance2), along, side };
}

function path(points: Point[]): Segment[] {
  return points.slice(1).map(([bx, by], i) => {
    const [ax, ay] = points[i], dx = bx - ax, dy = by - ay;
    return { ax, ay, dx, dy, squared: dx * dx + dy * dy, at: i };
  });
}

/** One compact round volume, with all roots and leaf tips inside its envelope. */
export function natureWaterSphereBounds(s: number, _primary: Primary = 'natureza'): NatureWaterSphereBounds {
  if (!Number.isFinite(s) || s <= 0) return { l: 0, t: 0, r: 0, b: 0 };
  const r = Math.max(1.5, s * .97);
  return { l: Math.floor(-r), t: Math.floor(-r), r: Math.ceil(r), b: Math.ceil(r) };
}

/** Folded botanical shell and submerged current share the same eight-frame beat. */
export function paintNatureWaterSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: Primary): NatureWaterSphereBounds {
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  if (![x, y, s].every(Number.isFinite) || s <= 0) return bounds;
  const r = Math.max(1.5, s * .97), botanical = primary === 'natureza', tiny = s < 6;
  const clock = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const leaves = POSES[primary][clock];
  const envelope = natureWaterSphereBounds(s, primary);
  const left = Math.floor(x + envelope.l) - 1, top = Math.floor(y + envelope.t) - 1;
  const right = Math.ceil(x + envelope.r) + 1, bottom = Math.ceil(y + envelope.b) + 1;
  const w = right - left + 1, h = bottom - top + 1;
  const colors: (RGB | null)[] = new Array(w * h).fill(null), green = new Uint8Array(w * h);
  // A liquid scroll begins behind the left blade, turns across the uncovered
  // seed, and returns underneath the folded lower leaf. The small outer reach
  // emerges again in front of its rooted tip: a deliberate over/under weave.
  const scroll = path(botanical
    ? [[-.40, -.48], [-.06, -.67], [.36, -.46], [.49, -.13], [.25, .14], [-.04, .12], [-.13, -.08], [.06, -.20]]
    : [[-.53, -.58], [-.05, -.75], [.46, -.53], [.67, -.10], [.43, .30], [.02, .38], [-.22, .14], [-.08, -.10], [.17, -.13]]);
  const returnFlow = path([[-.66, .43], [-.45, .65], [-.06, .76], [.34, .61], [.61, .34], [.67, .09]]);
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const u = (px - x) / r, v = (py - y) / r, d = Math.hypot(u, v);
    if (d > .96) continue;
    const at = (py - top) * w + px - left;
    let color: RGB = C.waterShade, isGreen = false;
    if (tiny) {
      // A broad folded flank and a curved turquoise opening survive in 3–9px.
      const leaf = botanical ? v > .12 + u * .4 || u < -.28 : u < -.28 || v > .48 - u * .22;
      isGreen = leaf;
      color = leaf ? (v > .35 ? C.leafDeep : C.leafLight) : (u + v > .4 ? C.waterShade : C.water);
      if (!leaf && u < .4 && v < -.1) color = clock < 4 ? C.crest : C.water;
      if (leaf && Math.abs(v - .23 + u * .5) < .16) color = C.vein;
    } else {
      // Broad stable light and shadow planes retain a heavy round water mass.
      if (Math.hypot(u + .10, v + .10) < .80) color = C.water;
      if (u < -.76 || v > .65 || u > .70 && v > .02) color = C.waterDeep;
      const flow = closest(u, v, scroll), width = botanical ? .095 : .14;
      if (flow.distance < width + .045) color = C.waterDeep;
      if (flow.distance < width) color = C.waterShade;
      const front = (flow.along - clock / 8 + 2) % 1;
      if (flow.distance < width * .72 && front > .035 && front < .47) color = C.water;
      if (flow.distance < width * .36 && front > .13 && front < .32) color = C.crest;
      if (s >= 15 && flow.distance < .023 && front > .18 && front < .25) color = C.gleam;
      // Resolve the foreground leaf first; all material detail belongs to its
      // own broad folded face, never a scatter of independent green flecks.
      let visible: LeafPose | undefined;
      for (let n = leaves.length - 1; n >= 0; n--) {
        const leaf = leaves[n], b = leaf.box;
        if (u >= b.l && u <= b.r && v >= b.t && v <= b.b && inPoly(leaf.points, u, v)) { visible = leaf; break; }
      }
      if (visible) {
        isGreen = true;
        const rib = closest(u, v, visible.segments), breadth = Math.sin(rib.along * Math.PI);
        let tone = visible.tone + (rib.side < 0 ? .13 : -.17);
        if (rib.side > 0 && rib.distance > breadth * .12) tone -= .20;
        color = tone < .25 ? C.leafUnder : tone < .46 ? C.leafDeep : tone < .70 ? C.leaf : C.leafLight;
        if (rib.distance < .028 && rib.along > .13 && rib.along < .90) color = C.leafLight;
        if (s >= 13 && rib.distance > .035 && rib.distance < breadth * .15 && rib.along > .2 && rib.along < .82) {
          if ((rib.along * 5.5 + rib.distance * 4) % 1 < .16) color = C.leafLight;
        }
        // The pulse travels from the immersed root into the blade, returning
        // its dark fold after passing. It does not flash the whole leaf face.
        const sap = (rib.along - clock / 8 + visible.delay / 8 + 2) % 1;
        if (rib.distance < .040 && rib.along > .12 && rib.along < .84 && sap > .04 && sap < .23) color = C.vein;
      }
      const returning = closest(u, v, returnFlow);
      // The lower return current crosses over the leaf's foot only at its
      // immersed outer lip; the rest of the blade continues across in front.
      const wetLip = returning.along < .79 && returning.distance < (botanical ? .060 : .080);
      if (wetLip && (v > .52 || u < -.48)) {
        isGreen = false;
        const front = (returning.along - clock / 8 + 2) % 1;
        color = front > .06 && front < .43 ? C.water : C.waterShade;
        if (returning.distance < .032 && front > .13 && front < .30) color = C.crest;
      }
    }
    colors[at] = color; green[at] = isGreen ? 1 : 0;
  }
  for (let row = 1; row < h - 1; row++) for (let col = 1; col < w - 1; col++) {
    const at = row * w + col;
    let color = colors[at]; if (!color) continue;
    const px = left + col, py = top + row, u = (px - x) / r, v = (py - y) / r;
    const neighbors = [at - 1, at + 1, at - w, at + w];
    const edge = neighbors.some(i => colors[i] === null);
    if (edge && u + v > .12) color = green[at] ? C.leafUnder : C.waterEdge;
    // A meniscus and a leaf rib answer together along the actual wet boundary.
    // This short changing contact is shared by both materials; no global glow.
    if (!tiny && !edge && neighbors.some(i => colors[i] !== null && green[i] !== green[at])) {
      const around = (Math.atan2(v - .1, u + .08) / TAU + 1) % 1;
      const pulse = (around - clock / 8 + 2) % 1;
      if (pulse > .04 && pulse < .20) color = green[at] ? C.vein : C.crest;
      else if (!green[at] && v > .08) color = C.water;
    }
    if (px < 0 || py < 0 || px >= pix.w || py >= pix.h) continue;
    pix.set(px, py, color);
    bounds.l = Math.min(bounds.l, px); bounds.t = Math.min(bounds.t, py);
    bounds.r = Math.max(bounds.r, px); bounds.b = Math.max(bounds.b, py);
  }
  return bounds;
}
