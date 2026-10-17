import { Pix, type RGB } from './pixel';

export type MotionPoint = [number, number];
export type TransportKind = 'flight' | 'projection' | 'return';
export interface MotionBox { l: number; t: number; r: number; b: number }

const R = Math.round;
const darkElement = (element?: string): boolean => element === 'sombra' || element === 'morte' || element === 'vazio';
const tone = (ramp: RGB[], t: number): RGB => ramp[R(Math.max(0, Math.min(1, t)) * (ramp.length - 1))];
const safeNumber = (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= 1_000_000;
const finitePoint = (p: MotionPoint): boolean => p.every(safeNumber);
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const wrap = (value: number, period = 1): number => ((value % period) + period) % period;

/** Clip before rasterizing: off-screen curves never create long pixel loops. */
function line(pix: Pix, a: MotionPoint, b: MotionPoint, color: RGB): void {
  let enter = 0, leave = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0]], [dx, pix.w - 1 - a[0]], [-dy, a[1]], [dy, pix.h - 1 - a[1]]]) {
    if (!p) { if (q < 0) return; continue; }
    const t = q / p;
    if (p < 0) enter = Math.max(enter, t); else leave = Math.min(leave, t);
    if (enter > leave) return;
  }
  pix.line(a[0] + dx * enter, a[1] + dy * enter, a[0] + dx * leave, a[1] + dy * leave, color);
}

function curve(from: MotionPoint, control: MotionPoint, to: MotionPoint, t: number): MotionPoint {
  const u = 1 - t;
  return [u * u * from[0] + 2 * u * t * control[0] + t * t * to[0], u * u * from[1] + 2 * u * t * control[1] + t * t * to[1]];
}

function tangent(from: MotionPoint, control: MotionPoint, to: MotionPoint, t: number): MotionPoint {
  let x = (1 - t) * (control[0] - from[0]) + t * (to[0] - control[0]);
  let y = (1 - t) * (control[1] - from[1]) + t * (to[1] - control[1]);
  let length = Math.hypot(x, y);
  if (!length) { x = to[0] - from[0]; y = to[1] - from[1]; length = Math.hypot(x, y); }
  return length ? [x / length, y / length] : [1, 0];
}

/** A small open arrow remains a direction mark, rather than another spell. */
function chevron(pix: Pix, at: MotionPoint, unit: MotionPoint, size: number, color: RGB): void {
  for (const side of [-1, 1]) line(pix, at, [at[0] - unit[0] * size - unit[1] * side * size * .65, at[1] - unit[1] * size + unit[0] * side * size * .65], color);
}

/**
 * Authored pixel ribbons follow the existing quadratic trajectory exactly.
 * Flight has a tapering wake, projection has suspended segments, and return
 * carries two inward-facing chevrons. Eight frames move accents along this path;
 * the same local ages also define the still export. Paint before the spell body.
 */
export function paintSpellTransport(pix: Pix, from: MotionPoint, control: MotionPoint, to: MotionPoint, ramp: RGB[], kind: TransportKind, element?: string, frame = 0, joinsBody = false): void {
  if (!ramp.length || !finitePoint(from) || !finitePoint(control) || !finitePoint(to)) return;
  const length = Math.hypot(control[0] - from[0], control[1] - from[1]) + Math.hypot(to[0] - control[0], to[1] - control[1]);
  if (length < 2) return;
  const dark = darkElement(element), dim = tone(ramp, dark ? .12 : .26), body = tone(ramp, dark ? .3 : .56), bright = tone(ramp, dark ? .44 : .86);
  const phase = phaseOf(frame);
  const samples = Math.max(8, Math.min((pix.w + pix.h) * 3, Math.ceil(length * 1.6)));
  // The lower seam adds volume without a cloud of glow or scattered pixels.
  if (kind === 'flight') {
    for (let k = 0; k < samples; k++) {
      const t = k / samples, next = (k + 1) / samples;
      if (t > .8) break;
      const a = curve(from, control, to, t), b = curve(from, control, to, next);
      line(pix, [a[0], a[1] + 1], [b[0], b[1] + 1], dim);
    }
  }
  for (let k = 0; k < samples; k++) {
    const t = k / samples, next = (k + 1) / samples;
    // Spacing is measured along the authored path, not from frame randomness.
    const distance = t * Math.min(length, 1000);
    if (kind === 'projection' && Math.floor((distance - phase) / 4) % 2) continue;
    if (kind === 'return' && (phase ? wrap(distance - phase * 13 / 8, 13) : distance % 13) > 10) continue;
    // A bright band travels towards the supplied destination, over a stable seam.
    const leading = wrap(t - phase / 8) > .8;
    line(pix, curve(from, control, to, t), curve(from, control, to, next), kind === 'projection' ? bright : leading ? bright : body);
  }
  // Short off-axis echoes make flight feel fast while keeping the curve readable.
  if (kind === 'flight' && length > 24 && !joinsBody) {
    for (const [start, end, side] of [[.26, .4, -1], [.49, .63, 1]]) {
      let previous: MotionPoint | undefined, previousT = -1;
      for (let k = 0; k <= 12; k++) {
        const origin = start + (end - start) * k / 12;
        const t = phase ? wrap(origin + phase / 8) : origin, p = curve(from, control, to, t), u = tangent(from, control, to, t);
        // Wrapped echoes restart at the source, never draw a chord across the
        // curve, and always travel in the same from-to direction as its core.
        if (t < previousT) previous = undefined;
        const width = Math.sin(k / 12 * Math.PI) * 1.5 + 1;
        const next: MotionPoint = [p[0] - u[1] * side * width, p[1] + u[0] * side * width];
        if (previous) line(pix, previous, next, dim);
        previous = next; previousT = t;
      }
    }
  }
  if (kind === 'return' && length > 20) {
    for (const start of [.38, .72]) {
      const t = phase ? wrap(start + phase / 8) : start;
      chevron(pix, curve(from, control, to, t), tangent(from, control, to, t), 2.5, bright);
    }
  }
  if (!joinsBody) chevron(pix, to, tangent(from, control, to, 1), kind === 'projection' ? 3 : 3.5, bright);
}

export interface WakeOrbit { count?: number; angle: number; c: MotionPoint; rx: number; ry: number }

/**
 * A single material ribbon grows from an occupied trailing edge, rather than
 * floating outside an approximate bounding box. Draw it before the body: the
 * small overlap is intentional and the sprite keeps its authored face/detail.
 * Orbital tails sample the analytic ellipse, never a wrapped member position.
 */
export function paintSpellWake(pix: Pix, bodyMask: Pix, box: MotionBox, ramp: RGB[], element?: string, frame = 0, direction: MotionPoint = [1, 0], orbit?: WakeOrbit): void {
  if (!ramp.length || ![box.l, box.t, box.r, box.b, ...direction].every(safeNumber) || box.l > box.r || box.t > box.b) return;
  const magnitude = Math.hypot(...direction);
  if (magnitude < .001) return;
  if (orbit && (!finitePoint(orbit.c) || ![orbit.angle, orbit.rx, orbit.ry].every(safeNumber) || orbit.rx <= 0 || orbit.ry <= 0)) return;
  const u: MotionPoint = [direction[0] / magnitude, direction[1] / magnitude], n: MotionPoint = [-u[1], u[0]];
  const center: MotionPoint = [(box.l + box.r) / 2, (box.t + box.b) / 2];
  const span = Math.abs(n[0]) * (box.r - box.l) + Math.abs(n[1]) * (box.b - box.t);
  const searchWidth = Math.max(.85, Math.min(4.2, span * .15));
  let rear = Infinity, root: MotionPoint | undefined;
  // A bounded scan avoids selecting a wingtip or flame crown as the tail root.
  for (let y = Math.max(0, Math.floor(box.t)); y <= Math.min(bodyMask.h - 1, Math.ceil(box.b)); y++) {
    for (let x = Math.max(0, Math.floor(box.l)); x <= Math.min(bodyMask.w - 1, Math.ceil(box.r)); x++) {
      if (!bodyMask.data[(y * bodyMask.w + x) * 4 + 3]) continue;
      const dx = x - center[0], dy = y - center[1], side = dx * n[0] + dy * n[1];
      if (Math.abs(side) > Math.max(1, searchWidth * .75)) continue;
      const along = dx * u[0] + dy * u[1];
      if (along < rear) { rear = along; root = [x, y]; }
    }
  }
  if (!root) return;
  const axialSpan = Math.abs(u[0]) * (box.r - box.l) + Math.abs(u[1]) * (box.b - box.t);
  const depth = Math.max(1, Math.min(orbit ? 1.5 : 6, axialSpan * .12));
  let sideLow = Infinity, sideHigh = -Infinity;
  // Measure the occupied cross-section just inside the attachment, not the
  // widest part of the bounding box: a spearhead must not inflate its shaft.
  for (let yy = Math.max(0, Math.floor(box.t)); yy <= Math.min(bodyMask.h - 1, Math.ceil(box.b)); yy++) {
    for (let xx = Math.max(0, Math.floor(box.l)); xx <= Math.min(bodyMask.w - 1, Math.ceil(box.r)); xx++) {
      if (!bodyMask.data[(yy * bodyMask.w + xx) * 4 + 3]) continue;
      const dx = xx - root[0], dy = yy - root[1], along = dx * u[0] + dy * u[1];
      if (along < depth - 1 || along > depth + 1) continue;
      const side = dx * n[0] + dy * n[1];
      sideLow = Math.min(sideLow, side); sideHigh = Math.max(sideHigh, side);
    }
  }
  const crossSection = Number.isFinite(sideLow) ? sideHigh - sideLow + 1 : 1;
  // Sparse orbits have room for a fuller root. Crowded cohorts retain the
  // compact envelope so a large tail cannot wash across a neighbouring spell.
  const sparseOrbit = !!orbit && (orbit.count ?? 8) <= 2;
  const halfWidth = Math.max(.8, Math.min(orbit ? sparseOrbit ? 3 : 2 : 9, span * .29, crossSection * .45));
  const materialScale = Math.max(crossSection, Math.min(axialSpan, span) * .8);
  // The large base is seated inside the real contour and revealed gradually as
  // it leaves the body. Tiny copies keep short tails and never inherit a hero's
  // ribbon width; orbital tails keep their separately verified clearance cap.
  root = [root[0] + u[0] * depth, root[1] + u[1] * depth];
  const length = orbit ? Math.max(3.5, Math.min(sparseOrbit ? 10 : 8, materialScale * .8)) : Math.max(4, Math.min(28, materialScale * 1.05));
  const phase = phaseOf(frame), time = phase * Math.PI / 4;
  const dark = darkElement(element), fire = element === 'fogo', fluid = element === 'agua' || element === 'acido';
  const solid = ['gelo', 'metal', 'terra', 'materia'].includes(element ?? '');
  const dim = tone(ramp, dark ? .08 : .22), body = tone(ramp, dark ? .25 : .48), light = tone(ramp, dark ? .4 : fire ? .76 : .68);
  const speed = orbit ? Math.max(1, Math.hypot(orbit.rx * Math.sin(orbit.angle), orbit.ry * Math.cos(orbit.angle))) : 1;
  const samples = Math.ceil(length * 3), coverage = new Map<number, number>();
  // Old material is narrower and darker. A single interior fold travels away
  // from the root while the base stays joined in every representative pose.
  for (let k = samples; k >= 0; k--) {
    const t = k / samples, distance = t * length;
    let x = root[0] - u[0] * distance, y = root[1] - u[1] * distance;
    if (orbit) {
      const angle = orbit.angle - Math.min(.6, distance / speed);
      x = root[0] + orbit.rx * (Math.cos(angle) - Math.cos(orbit.angle));
      y = root[1] + orbit.ry * (Math.sin(angle) - Math.sin(orbit.angle));
    } else {
      const bend = Math.sin(t * Math.PI) * (solid ? .3 : .8) + Math.sin(t * Math.PI * 2 - time) * t * (fire ? Math.max(1, halfWidth * .4) : fluid ? Math.max(.7, halfWidth * .25) : .4);
      x += n[0] * bend; y += n[1] * bend;
    }
    const radius = Math.max(.45, halfWidth * Math.pow(1 - t, .8));
    const fold = Math.sin(t * Math.PI * 3 - time) * .35;
    for (let yy = Math.floor(y - radius); yy <= Math.ceil(y + radius); yy++) for (let xx = Math.floor(x - radius); xx <= Math.ceil(x + radius); xx++) {
      if (xx < 0 || yy < 0 || xx >= pix.w || yy >= pix.h) continue;
      const dx = xx - x, dy = yy - y, d = Math.hypot(dx, dy);
      if (d > radius + .2) continue;
      const key = yy * pix.w + xx, closeness = 1 - d / (radius + .2);
      if (closeness <= (coverage.get(key) ?? -1)) continue;
      coverage.set(key, closeness);
      const side = (dx * n[0] + dy * n[1]) / Math.max(1, radius);
      pix.set(xx, yy, t > .8 || d > radius * .82 ? dim : t < .72 && Math.abs(side - fold) < .38 ? light : body);
    }
  }
}
