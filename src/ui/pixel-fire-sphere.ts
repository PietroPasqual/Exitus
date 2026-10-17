import { inPoly, Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Point = [number, number];
const TAU = Math.PI * 2;
const index = (ramp: RGB[], tone: number): RGB => ramp[Math.round(tone * (ramp.length - 1))];

// One rooted flame sheet grows along the right shoulder, rolls over the crown,
// cools back into the round volume, then grows again. These are silhouette poses,
// not a translated particle or a whole-sphere scale/breath pulse.
const CROWN_POSES: Point[][] = [
  [[.52,.66],[.99,.4],[1.25,.02],[1.3,-.32],[1.14,-.65],[.88,-.91],[.58,-1.1],[.2,-1.13],[.46,-.95],[.72,-.7],[.85,-.4],[.8,-.12],[.57,.2]],
  [[.52,.66],[1.05,.38],[1.36,-.05],[1.4,-.46],[1.13,-.83],[.79,-1.12],[.4,-1.32],[.02,-1.26],[.36,-1.04],[.69,-.74],[.9,-.38],[.83,-.06],[.57,.2]],
  [[.52,.66],[1.08,.32],[1.39,-.14],[1.35,-.55],[1.03,-.95],[.59,-1.28],[.12,-1.34],[-.22,-1.16],[.24,-1.12],[.62,-.79],[.93,-.36],[.86,.02],[.57,.2]],
  [[.52,.66],[1.02,.3],[1.29,-.16],[1.2,-.57],[.92,-.96],[.45,-1.24],[.04,-1.25],[-.24,-1.04],[.22,-.98],[.64,-.79],[.89,-.35],[.8,.03],[.57,.2]],
  [[.52,.66],[.98,.35],[1.15,-.04],[1.12,-.43],[.89,-.78],[.56,-1.04],[.19,-1.12],[-.06,-1.02],[.28,-.94],[.66,-.66],[.79,-.32],[.74,.07],[.57,.2]],
  [[.52,.66],[1.1,.44],[1.28,.11],[1.27,-.19],[1.1,-.5],[.88,-.68],[.7,-.84],[.57,-.88],[.71,-.69],[.78,-.49],[.85,-.24],[.79,.08],[.57,.2]],
  [[.52,.66],[1.13,.43],[1.4,.05],[1.43,-.22],[1.23,-.56],[.99,-.79],[.76,-.93],[.47,-.99],[.66,-.8],[.84,-.57],[.94,-.27],[.86,.06],[.57,.2]],
  [[.52,.66],[1.08,.41],[1.34,.03],[1.38,-.3],[1.21,-.65],[.96,-.89],[.68,-1.07],[.29,-1.1],[.52,-.91],[.78,-.65],[.9,-.34],[.83,-.04],[.57,.2]]
];

/** Layout and raster share the largest occupied envelope of the complete loop. */
export function fireSphereBounds(s: number): IntentionBox {
  if (s < 6) { const r = s * .82; return { l: -r, t: -r, r, b: r }; }
  const r = s * .9;
  return { l: -r * 1.2 - .5, t: -r * 1.4 - .5, r: r * 1.48 + .5, b: r * 1.04 + .5 };
}

/** An original round molten body with a clockwise, surface-attached flame front. */
export function paintCoherentFireSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  const phase = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const r = s * .9, turn = phase * TAU / 8;
  // Dense copies use a purpose-built tiny volume. Removing subpixel crown tips
  // keeps a readable hot nucleus and the original compact packing budget.
  if (s < 6) {
    const small = s * .82, q = fireSphereBounds(s);
    const box = { l: x + q.l, t: y + q.t, r: x + q.r, b: y + q.b };
    pix.shape(box.l, box.t, box.r, box.b, (px, py) => {
      const u = (px - x) / small, v = (py - y) / small, d = Math.hypot(u, v);
      if (d > 1) return null;
      let tone = v > .35 ? .3 : .55;
      if (Math.hypot(u + .25, v + .2) < .65) tone = .82;
      if (Math.hypot(u + .3, v + .18) < .3) tone = 1;
      const front = Math.atan2(v, u) + turn;
      if (d > .58 && d < .86 && Math.sin(front) > .6) tone = Math.max(tone, .66);
      return index(ramp, tone);
    });
    return box;
  }
  const breath = Math.sin(turn - 1) * .11;
  // The core stays round and still while its attached flame sheet rolls over it.
  const crown = CROWN_POSES[phase];
  const lip: Point[] = [[-.68, .18], [-1.02, .04], [-1.1, -.12 + breath], [-1.16, .19],
    [-.96, .57], [-.58, .82], [-.26, .8], [-.57, .55]];
  // One broad internal fold describes the curved front face. Its root joins
  // the hot central mass; only the underside receives the cool red shading.
  const fold: Point[] = [[-.73, .11], [-.63, .44], [-.31, .63], [.1, .66], [.48, .47],
    [.68, .15], [.67, -.2], [.49, -.47], [.2, -.57], [.43, -.58], [.74, -.39], [.88, -.03],
    [.78, .4], [.51, .7], [.08, .87], [-.34, .78], [-.66, .52], [-.81, .18]];
  const turnUnder: Point[] = [[-.02, -.76], [.35, -.66], [.6, -.43], [.71, -.12], [.59, .18],
    [.36, .37], [.48, .08], [.44, -.2], [.22, -.45]];
  const kernel: Point[] = [[-.58, -.25], [-.39, -.51], [-.12, -.56], [.11, -.43],
    [.18, -.17], [.07, .08], [-.18, .25], [-.33, .4], [-.55, .25], [-.65, .02]];
  const q = fireSphereBounds(s), box = { l: x + q.l, t: y + q.t, r: x + q.r, b: y + q.b };
  // A hot fold leaves the kernel, travels around the curved lower face, then
  // stretches into the attached crown. The root cools before the next fold.
  const path: Point[] = [[-.58, .24], [-.4, .44], [-.07, .56], [.28, .54], [.58, .37],
    [.77, .12], [.88, -.2], [.98, -.48], [.84, -.77], [.57, -.97]];
  let length = 0;
  const segments = path.slice(1).map((b, i) => {
    const a = path[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), at = length;
    length += len; return { a, dx, dy, len, squared: len * len, at };
  });
  const age = (phase + .35) / 8, head = age * length;
  const intensity = Math.sin(age * Math.PI);

  pix.shape(box.l, box.t, box.r, box.b, (px, py) => {
    const u = (px - x) / r, v = (py - y) / r;
    const radius = Math.hypot(u, v), a = Math.atan2(v, u);
    const edge = .98 + Math.sin(a * 3 + .6) * .015;
    const ball = radius <= edge;
    const tongue = inPoly(crown, u, v), rim = inPoly(lip, u, v);
    if (!ball && !tongue && !rim) return null;
    let tone = .49;
    const heat = Math.hypot((u + .2) * .91, (v + .16) * 1.06);
    if (ball && heat < .73) tone = .66;
    if (ball && v > .36 + u * -.23) tone = .36;
    if (ball && radius > .87 && v > .15) tone = .2;
    if (ball && inPoly(turnUnder, u, v)) tone = .5;
    const foldU = u + Math.sin(turn - v * 3.6) * .09;
    const foldV = v + Math.cos(turn - u * 3.1) * .065;
    if (inPoly(fold, foldU, foldV)) tone = v > .55 ? .5 : .58;
    if (ball && inPoly(kernel, u, v)) tone = .84;
    // The brightest pixels are a single off-centre kernel, not two islands.
    if (ball && Math.hypot((u + .32) * 1.08, (v + .11) * 1.15) < .22) tone = 1;
    if (tongue) {
      tone = .48;
      const flow = Math.hypot(u + .08, v + .02);
      if (flow > .95 && flow < 1.16 && v < .3) tone = .67;
      if (flow > 1.2 || v > .43) tone = .34;
    }
    if (rim && !ball) tone = u < -1.03 ? .34 : .5;
    // The animated material stays on the authored mass and never crosses the
    // core. Its yellow leading edge and orange cooling trail move in one flow.
    if (tone < .8 && (radius < .84 || tongue)) {
      let squaredDistance = Infinity, along = 0;
      for (const { a: start, dx, dy, len, squared, at } of segments) {
        const t = Math.max(0, Math.min(1, ((u - start[0]) * dx + (v - start[1]) * dy) / squared));
        const ex = u - start[0] - dx * t, ey = v - start[1] - dy * t, d2 = ex * ex + ey * ey;
        if (d2 < squaredDistance) { squaredDistance = d2; along = at + t * len; }
      }
      const behind = head - along, width = .14 + intensity * .09;
      if (squaredDistance < width * width && behind > -.2 && behind < 1.05) {
        const edge = 1 - Math.max(0, behind) / 1.05;
        tone = Math.max(tone, edge * intensity > .22 ? .72 : .52);
      }
      if (tongue && squaredDistance < .01 && behind > .8) tone = Math.min(tone, .5);
    }
    return index(ramp, tone);
  });
  return box;
}
