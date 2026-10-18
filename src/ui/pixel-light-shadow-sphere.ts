import type { Pix, RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Primary = 'luz' | 'sombra';
type Point = readonly [number, number];
const EMPTY = (): IntentionBox => ({ l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
const TAU = Math.PI * 2;
const C = {
  ochre: [166, 95, 0], gold: [245, 159, 0], sun: [255, 212, 59], cream: [255, 243, 191],
  void: [16, 16, 29], dark: [36, 32, 57], smoke: [72, 65, 94], violet: [118, 107, 141],
} satisfies Record<string, RGB>;

const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const radiusOf = (s: number): number => Math.max(1.3, s * .94);

/** Compact packing envelope shared by the two material dominances. */
export function lightShadowSphereBounds(s: number, _primary: Primary = 'luz'): IntentionBox {
  if (!Number.isFinite(s) || s <= 0) return { l: 0, t: 0, r: 0, b: 0 };
  const extent = radiusOf(s) * 1.025;
  return { l: -extent, t: -extent, r: extent, b: extent };
}

function alongPath(u: number, v: number, points: readonly Point[]): { distance: number; progress: number } {
  let distance = Infinity, progress = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(u - a[0] - dx * t, v - a[1] - dy * t);
    if (d < distance) { distance = d; progress = (i - 1 + t) / (points.length - 1); }
  }
  return { distance, progress };
}

/**
 * A gold volume eclipsed by a thick smoke fold. Light passes behind the raised
 * violet lip, then reappears as one broad, tapering plane through the lower gap.
 * Both materials belong to the same compact body; its dark hollow is opaque,
 * never a transparent hole or a ring of detached particles.
 */
export function paintLightShadowSphere(
  pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: Primary,
): IntentionBox {
  if (![x, y, s].every(Number.isFinite) || s <= 0) return EMPTY();
  const local = lightShadowSphereBounds(s), left = Math.max(0, Math.ceil(x + local.l));
  const top = Math.max(0, Math.ceil(y + local.t)), right = Math.min(pix.w - 1, Math.floor(x + local.r));
  const bottom = Math.min(pix.h - 1, Math.floor(y + local.b));
  if (left > right || top > bottom) return EMPTY();
  const r = radiusOf(s), clock = phaseOf(frame), turn = clock * TAU / 8, dark = primary === 'sombra';
  const tiny = s < 5, opening = .5 + .5 * Math.sin(turn - .7), roll = Math.sin(turn) * .045;
  // Two unequal centres keep the eclipse offset. Its left contour is an open,
  // curved overlap rather than a diagonal colour partition or a circular iris.
  const voidX = dark ? .14 : .55, voidRX = dark ? .87 : .53, voidRY = dark ? .87 : .73;
  const lipShift = dark ? 0 : .19, foldBend = Math.sin(turn - .4) * .105;
  const lip: Point[] = [[.52 + lipShift, -.71], [.13 + lipShift, -.68], [-.16 + lipShift, -.45],
    [-.25 + lipShift + foldBend, -.13], [-.1 + lipShift + foldBend, .08 + roll],
    [.15 + lipShift, .16 + roll + opening * .055], [.4 + lipShift, .04], [.51 + lipShift, -.18]];
  const reveal: Point[] = [[-.55, .25], [-.37, .46], [-.08, .58], [.24, .52],
    [.49, .34 + roll], [.68, .13 + roll], [.76, .035 + roll]];
  const brokenArc: Point[] = [[-.72, .3], [-.81, -.08], [-.66, -.44], [-.35, -.7], [.01, -.8], [.29, -.72]];
  const out = EMPTY();
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const u = (px - x) / r, v = (py - y) / r, d = Math.hypot(u, v);
    // The same round, solid silhouette remains stable for the complete loop.
    if (d > .965) continue;
    let color: RGB;
    if (tiny) {
      // Dense copies keep a broad gold shoulder and a single readable dark fold.
      const shadow = dark ? u > -.18 + v * .2 : u > .35 + v * -.42 || v > .63;
      if (shadow) color = u + v > .3 ? C.void : C.dark;
      else color = u + v < -.45 ? C.sun : C.gold;
      if (shadow && u < .42 && u > -.17 && v < .05 && v > -.7) color = C.smoke;
      if (!shadow && clock >= 2 && clock <= 5 && u < -.2 && v < .2) color = C.cream;
    } else {
      const warpedU = u + Math.sin((v + .12) * 4.2) * .055;
      const eclipse = Math.hypot((warpedU - voidX) / voidRX, (v - .095) / voidRY);
      const shadow = eclipse < 1;
      color = u + v > .42 || d > .86 ? C.ochre : C.gold;
      if (Math.hypot((u + .29) / .7, (v + .29) / .66) < .92) color = C.sun;
      if (shadow) {
        color = C.dark;
        if (eclipse < .7 || (v > .51 && u > -.03)) color = C.void;
        if (eclipse > .84 && u < voidX && v < .41) color = C.smoke;
      }
      const arc = alongPath(u, v, brokenArc);
      // An interrupted gold shoulder, with no white perimeter or giant core.
      if (!shadow && arc.distance < .075 && (arc.progress < .57 || arc.progress > .74)) color = C.cream;
      if (!shadow && arc.distance < .15 && arc.distance > .075) color = C.gold;

      const light = alongPath(u, v, reveal), fold = alongPath(u, v, lip);
      const width = (dark ? .105 : .16) * (1.04 - light.progress * .77);
      const gate = .3 + opening * .22;
      // The main beam enters under the thick lip, then clears its lower edge.
      // It tapers continuously: no electric zigzag, detached ray or white star.
      if (light.distance < width + .055 && light.progress > .12 && light.progress < .98) color = C.void;
      if (light.distance < width && light.progress > .13 && light.progress < .98) {
        color = C.gold;
        if (light.distance < width * .63) color = C.sun;
        const front = (light.progress - clock / 8 + 1) % 1;
        if (front > .08 && front < .38 && light.distance < width * .39) color = C.cream;
      }
      // A raised purple shoulder covers the upper reach of the light. Its
      // opening moves locally; the rest of the dark volume does not flash.
      if (fold.distance < (dark ? .135 : .125) && fold.progress < .92) color = C.dark;
      if (fold.distance < .075 && fold.progress < .9) color = C.smoke;
      const lipFront = (fold.progress - clock / 8 + 1) % 1;
      if (fold.distance < .035 && lipFront > .08 && lipFront < .4 && fold.progress < .9) color = C.violet;
      if (u > -.22 && u < .2 && v > .23 && v < gate && light.distance > width * .7) color = C.void;
      // A small reflected gold plane sits directly below the purple overlap;
      // it is visible through the gap and never lights the entire shadow face.
      if (fold.progress > .27 && fold.progress < .62 && fold.distance > .083 && fold.distance < .13
        && v > -.28 && v < .2 && opening > .28) color = opening > .82 ? C.sun : C.ochre;
      if (d > .9 && u + v > .32) color = shadow ? C.void : C.ochre;
    }
    pix.set(px, py, color);
    out.l = Math.min(out.l, px); out.t = Math.min(out.t, py);
    out.r = Math.max(out.r, px); out.b = Math.max(out.b, py);
  }
  return out;
}
