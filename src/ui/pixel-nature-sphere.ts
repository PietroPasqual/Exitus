import { inPoly, Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Point = [number, number];
interface Leaf { root: Point; bend: Point; tip: Point; width: number; tone: number; delay: number }
interface VeinSegment { ax: number; ay: number; dx: number; dy: number; squared: number; at: number }
interface LeafPose { points: Point[]; segments: VeinSegment[]; bounds: IntentionBox; tone: number; head: number }
const OPEN = [0, .06, .13, .09, 0, -.055, -.085, -.045];
const LEAVES: Leaf[] = [
  { root: [.15, .66], bend: [-.88, .34], tip: [-.48, -.77], width: .23, tone: .40, delay: 4 },
  { root: [.09, .58], bend: [-.26, -.27], tip: [.1, -.91], width: .27, tone: .62, delay: 0 },
  { root: [-.12, .65], bend: [.79, .2], tip: [.68, -.64], width: .29, tone: .49, delay: 2 },
  { root: [.32, .65], bend: [-.59, .19], tip: [-.82, -.32], width: .23, tone: .68, delay: 1 },
  { root: [-.44, .60], bend: [.37, .60], tip: [.86, -.07], width: .23, tone: .62, delay: 5 },
  { root: [-.47, .22], bend: [-.04, .84], tip: [.61, .50], width: .18, tone: .48, delay: 3 }
];

/** A round seed and its attached leaf tips share this complete-loop envelope. */
export function natureSphereBounds(s: number): IntentionBox {
  if (!Number.isFinite(s) || s <= 0) return { l: 0, t: 0, r: 0, b: 0 };
  const r = s * .95;
  return { l: -r, t: -r, r, b: r };
}

function poseLeaf(leaf: Leaf, frame: number): LeafPose {
  // The root remains planted in the seed's lower shoulder. Opening bends the
  // blade at its stem; it never enlarges or translates the whole round mass.
  const opening = OPEN[(frame + leaf.delay) % 8];
  const tip: Point = [leaf.tip[0] + opening * Math.sign(leaf.tip[0]) * .3, leaf.tip[1] - opening * .55];
  const bend: Point = [leaf.bend[0] + opening * .12, leaf.bend[1] - opening * .28];
  const left: Point[] = [], right: Point[] = [], vein: Point[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, q = 1 - t;
    const u = q * q * leaf.root[0] + 2 * q * t * bend[0] + t * t * tip[0];
    const v = q * q * leaf.root[1] + 2 * q * t * bend[1] + t * t * tip[1];
    const dx = 2 * q * (bend[0] - leaf.root[0]) + 2 * t * (tip[0] - bend[0]);
    const dy = 2 * q * (bend[1] - leaf.root[1]) + 2 * t * (tip[1] - bend[1]);
    const len = Math.hypot(dx, dy) || 1;
    const width = leaf.width * Math.pow(Math.sin(Math.PI * t), .75) * (1 + opening);
    vein.push([u, v]);
    left.push([u - dy / len * width, v + dx / len * width]);
    right.push([u + dy / len * width, v - dx / len * width]);
  }
  const points = [...left, ...right.reverse()];
  const segments = vein.slice(1).map(([bx, by], i): VeinSegment => {
    const [ax, ay] = vein[i], dx = bx - ax, dy = by - ay;
    return { ax, ay, dx, dy, squared: dx * dx + dy * dy, at: i };
  });
  return {
    points, segments, tone: leaf.tone, head: ((frame + leaf.delay) % 8 + .5) / 8,
    bounds: { l: Math.min(...points.map(p => p[0])), t: Math.min(...points.map(p => p[1])),
      r: Math.max(...points.map(p => p[0])), b: Math.max(...points.map(p => p[1])) }
  };
}

// Geometry is immutable through the eight-frame loop; colours stay per call.
const POSES = Array.from({ length: 8 }, (_, frame) => LEAVES.map(leaf => poseLeaf(leaf, frame)));

function contains(leaf: LeafPose, u: number, v: number): boolean {
  const b = leaf.bounds;
  return u >= b.l && u <= b.r && v >= b.t && v <= b.b && inPoly(leaf.points, u, v);
}

function veinAt(u: number, v: number, segments: VeinSegment[]): { distance: number; along: number; side: number } {
  let bestSquared = Infinity, along = 0, side = 0, bestX = 0, bestY = 0;
  for (const { ax, ay, dx, dy, squared, at } of segments) {
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (squared || 1)));
    const ex = u - ax - t * dx, ey = v - ay - t * dy, d2 = ex * ex + ey * ey;
    if (d2 < bestSquared) {
      bestSquared = d2; bestX = ex; bestY = ey;
      along = (at + t) / segments.length; side = Math.sign(dx * ey - dy * ex);
    }
  }
  // Keep the original distance calculation for tone thresholds and rib spacing.
  return { distance: Math.hypot(bestX, bestY), along, side };
}

/** Original botanical volume: folded leaves protect a dense germinating seed. */
export function paintNatureSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  if (![x, y, s].every(Number.isFinite) || s <= 0 || ramp.length === 0) return { l: 0, t: 0, r: 0, b: 0 };
  const q = natureSphereBounds(s), box = { l: x + q.l, t: y + q.t, r: x + q.r, b: y + q.b };
  const clock = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const small = s < 6, leaves = POSES[clock];
  const colour = (tone: number): RGB => ramp[Math.round(Math.max(0, Math.min(1, tone)) * (ramp.length - 1))];
  for (let py = Math.max(0, Math.ceil(box.t)); py <= Math.min(pix.h - 1, Math.floor(box.b)); py++) for (let px = Math.max(0, Math.ceil(box.l)); px <= Math.min(pix.w - 1, Math.floor(box.r)); px++) {
    const u = (px - x) / s, v = (py - y) / s, radius = Math.hypot(u, v);
    // Clipping the few extreme blade tips also keeps every pose in the same
    // compact packing budget as other sphere intentions, at fractional origins.
    if (radius > .94) continue;
    if (small) {
      if (radius > .84) continue;
      let tone = v > .3 ? .14 : .48;
      if (u < -.05 && v < .15 && radius < .64) tone = .72;
      // A curved folded blade and a warm, off-centre seed stay readable in 5px.
      if (Math.abs(v - .24 + u * .5) < .16 && u > -.62) tone = .28;
      const sap = (clock / 8 + 1 - (u + .7) / 1.4) % 1;
      if (Math.abs(v - .24 + u * .5) < .14 && sap < .23) tone = .72;
      if (Math.hypot((u + .22) * 1.5, (v + .18) * 1.8) < .34) tone = .94;
      pix.set(px, py, colour(tone));
      continue;
    }
    let tone = radius < .79 ? .18 : -1;
    if (radius < .73 && v < .2) tone = .31;
    // A solid foreground leaf completely covers all earlier layers. Resolve
    // visibility first, so hidden leaves never need a closest-vein calculation.
    let visible: LeafPose | undefined;
    for (let i = leaves.length - 1; i >= 3; i--) if (contains(leaves[i], u, v)) { visible = leaves[i]; break; }
    if (!visible) {
      // The seed lies behind the foreground leaves and ahead of the back blades.
      if (Math.hypot((u + .08) / .27, (v + .17) / .40) < 1) {
        tone = u + v < -.30 ? .79 : .68;
        if (u > .06 || v > .12) tone = .49;
        if (Math.hypot((u + .15) / .075, (v + .28) / .16) < 1) tone = .97;
      } else for (let i = 2; i >= 0; i--) if (contains(leaves[i], u, v)) { visible = leaves[i]; break; }
    }
    if (visible) {
      const leaf = visible, vein = veinAt(u, v, leaf.segments);
      tone = leaf.tone + (vein.side < 0 ? .11 : -.12);
      // Broad folded halves and an attached central rib describe volume. Short
      // secondary ribs meet that midrib instead of floating as glitter points.
      const blade = Math.sin(Math.PI * vein.along);
      if (vein.distance > .12 * blade && vein.side > 0) tone -= .21;
      if (vein.distance < .024 && vein.along > .13 && vein.along < .89) tone = .76;
      if (s >= 10 && vein.distance < .15 * blade && vein.distance > .04 && vein.along > .25 && vein.along < .79) {
        const rib = (vein.along * 5.5 + vein.distance * 5) % 1;
        if (rib < .13) tone = Math.min(.74, tone + .12);
      }
      // Sap advances root to tip with the opening gesture. The previous section
      // cools back to its leaf tone, giving a moving connected material front.
      const behind = leaf.head - vein.along;
      if (vein.distance < .046 && behind > -.04 && behind < .22 && vein.along < .87) tone = .97;
    }
    if (tone < 0) continue;
    if (radius > .73 && u + v > .35) tone = Math.min(tone, .08);
    if (radius > .64 && v > .52 && tone < .6) tone = .08;
    pix.set(px, py, colour(tone));
  }
  return box;
}
