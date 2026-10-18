import { inPoly, Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Point = [number, number];
const TAU = Math.PI * 2;
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
// A single thick fold turns inward across the face before returning to the
// shoulder. Its two turns have different centres: this is smoke, not an iris.
const FOLD: Point[] = [[-.71,-.32],[-.43,-.49],[-.07,-.45],[.2,-.24],
  [.17,.03],[-.08,.21],[-.21,.4],[-.06,.58],[.27,.66],[.58,.48]];
const BACK_FOLD: Point[] = [[.18,-.82],[.54,-.62],[.7,-.3],[.64,.03],
  [.52,-.15],[.44,-.4],[.14,-.63],[-.19,-.67]];
const UNDER: Point[] = [[-.46,.61],[-.08,.73],[.36,.61],[.66,.33],[.78,-.01],
  [.72,.33],[.52,.64],[.17,.83],[-.17,.8]];
const segments = FOLD.slice(1).map((b, i) => {
  const a = FOLD[i], dx = b[0] - a[0], dy = b[1] - a[1];
  return { a, dx, dy, length: Math.hypot(dx, dy), squared: dx * dx + dy * dy };
});
const length = segments.reduce((sum, segment) => sum + segment.length, 0);
const stations = segments.map((_, i) => segments.slice(0, i).reduce((sum, segment) => sum + segment.length, 0));

/** The complete smoke loop stays within the compact sphere's packing budget. */
export function shadowSphereBounds(s: number): IntentionBox {
  const extent = Math.max(0, Number.isFinite(s) ? s : 0) * .95;
  return { l: -extent, t: -extent, r: extent, b: extent };
}

/**
 * An original dark smoke volume. A short purple lip flows along one connected
 * fold, while the core and the lower shaded mass stay anchored. No glow pass or
 * detached particles are emitted; the lightest supplied palette entry is unused.
 */
export function paintShadowSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  const local = shadowSphereBounds(s);
  const box = { l: x + local.l, t: y + local.t, r: x + local.r, b: y + local.b };
  if (!ramp.length || ![x, y, s].every(Number.isFinite) || s <= 0) return box;
  if (box.r < 0 || box.b < 0 || box.l >= pix.w || box.t >= pix.h) return box;
  const radius = s * .95, phase = phaseOf(frame), turn = phase * TAU / 8, small = s < 6;
  // These are material-local bends. Neither the dark core nor the complete
  // silhouette is translated or scaled between the eight poses.
  const bend = Math.sin(turn) * .035, roll = Math.cos(turn) * .028;
  const toneColor = (tone: number): RGB => ramp[Math.min(ramp.length - 1, Math.round(tone * (ramp.length - 1) / 4))];
  const head = (phase + .45) * length / 8;
  pix.shape(Math.max(-1, box.l), Math.max(-1, box.t), Math.min(pix.w, box.r), Math.min(pix.h, box.b), (px, py) => {
    const u = (px - x) / radius, v = (py - y) / radius;
    const d = Math.hypot(u, v), angle = Math.atan2(v, u);
    // Broad lobes give the outer mass weight. Two open bites reveal the dark
    // fold turning back into the body without cutting the centre into a ring.
    const edge = small ? .91 : .925 + Math.sin(angle * 3 + .4) * .018 + Math.sin(angle * 5 - turn) * .012;
    if (d > edge) return null;
    if (!small && (Math.hypot(u - .68, v + .77 + bend) < .225 || Math.hypot(u + .87, v - .29 - roll) < .19)) return null;
    let tone = d > .82 || v > .55 ? 0 : 1;
    if (small) {
      // One dark nucleus and one curved smoke shoulder survive dense copies.
      const fold = Math.hypot(u + .2, v + .17);
      if (u < .22 && fold > .36 && fold < .74 && v < .36) tone = 2;
      if (fold > .4 && fold < .72 && Math.cos(Math.atan2(v + .17, u + .2) - turn) > .83) tone = 3;
      if (Math.hypot(u - .13, v - .1) < .34) tone = 0;
      return toneColor(tone);
    }
    // Two restrained planes support the moving lip, including a dark crease
    // immediately beneath it. There is no bright perimeter around the sphere.
    if (inPoly(BACK_FOLD, u - bend, v + roll)) tone = 2;
    if (inPoly(UNDER, u, v)) tone = 1;
    const fu = u + Math.sin(v * 3.5 - turn) * .035;
    const fv = v + Math.sin(u * 2.7 - turn) * .025;
    let distance2 = Infinity, along = 0;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i], t = Math.max(0, Math.min(1, ((fu - segment.a[0]) * segment.dx + (fv - segment.a[1]) * segment.dy) / segment.squared));
      const dx = fu - segment.a[0] - segment.dx * t, dy = fv - segment.a[1] - segment.dy * t, square = dx * dx + dy * dy;
      if (square < distance2) { distance2 = square; along = stations[i] + t * segment.length; }
    }
    // The lip's leading edge is followed by a thicker cooling shoulder. Only
    // this short portion reaches purple, rather than flashing the whole mass.
    const behind = head - along;
    if (distance2 < .024 && d < .88) tone = Math.max(tone, distance2 < .009 ? 2 : 1);
    if (behind > -.14 && behind < .68 && distance2 < .018 && d < .87) {
      tone = behind < .18 && distance2 < .007 ? 3 : 2;
    }
    // Negative space reads as a heavy overlapping smoke fold. The permanent
    // dark nucleus is offset from the bright path and never turns into an eye.
    if (fv > -.12 && fv < .29 && fu > .26 && fu < .61 && distance2 > .009) tone = 0;
    if (Math.hypot(u - .12, v - .12) < .19 || (v > .65 && d > .74)) tone = 0;
    return toneColor(tone);
  });
  return box;
}
