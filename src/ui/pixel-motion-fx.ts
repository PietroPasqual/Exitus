import { Pix, type RGB } from './pixel';

export type MotionPoint = [number, number];
export type TransportKind = 'flight' | 'projection' | 'return';
export interface MotionBox { l: number; t: number; r: number; b: number }

const R = Math.round;
const darkElement = (element?: string): boolean => element === 'sombra' || element === 'morte' || element === 'vazio';
const tone = (ramp: RGB[], t: number): RGB => ramp[R(Math.max(0, Math.min(1, t)) * (ramp.length - 1))];
const safeNumber = (value: number): boolean => Number.isFinite(value) && Math.abs(value) <= 1_000_000;
const finitePoint = (p: MotionPoint): boolean => p.every(safeNumber);

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
 * carries two inward-facing chevrons. Call before the body to keep its art intact.
 */
export function paintSpellTransport(pix: Pix, from: MotionPoint, control: MotionPoint, to: MotionPoint, ramp: RGB[], kind: TransportKind, element?: string): void {
  if (!ramp.length || !finitePoint(from) || !finitePoint(control) || !finitePoint(to)) return;
  const length = Math.hypot(control[0] - from[0], control[1] - from[1]) + Math.hypot(to[0] - control[0], to[1] - control[1]);
  if (length < 2) return;
  const dark = darkElement(element), dim = tone(ramp, dark ? .12 : .26), body = tone(ramp, dark ? .3 : .56), bright = tone(ramp, dark ? .44 : .86);
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
    if (kind === 'projection' && Math.floor(distance / 4) % 2) continue;
    if (kind === 'return' && distance % 13 > 10) continue;
    line(pix, curve(from, control, to, t), curve(from, control, to, next), kind === 'projection' ? bright : t > .7 ? bright : body);
  }
  // Short off-axis echoes make flight feel fast while keeping the curve readable.
  if (kind === 'flight' && length > 24) {
    for (const [start, end, side] of [[.26, .4, -1], [.49, .63, 1]]) {
      let previous: MotionPoint | undefined;
      for (let k = 0; k <= 12; k++) {
        const t = start + (end - start) * k / 12, p = curve(from, control, to, t), u = tangent(from, control, to, t);
        const width = Math.sin(k / 12 * Math.PI) * 1.5 + 1;
        const next: MotionPoint = [p[0] - u[1] * side * width, p[1] + u[0] * side * width];
        if (previous) line(pix, previous, next, dim);
        previous = next;
      }
    }
  }
  if (kind === 'return' && length > 20) {
    for (const t of [.38, .72]) chevron(pix, curve(from, control, to, t), tangent(from, control, to, t), 2.5, bright);
  }
  chevron(pix, to, tangent(from, control, to, 1), kind === 'projection' ? 3 : 3.5, bright);
}

/**
 * Speed accents stay outside the spell box. The leading open arrow shows aim;
 * it does not imply that a target was hit. Compact bodies receive fewer marks.
 */
export function paintSpellMotion(pix: Pix, box: MotionBox, centerY: number, ramp: RGB[], element?: string, forward = false): void {
  if (!ramp.length || ![box.l, box.t, box.r, box.b, centerY].every(safeNumber) || box.l > box.r || box.t > box.b) return;
  const size = Math.max(box.r - box.l, box.b - box.t), compact = size < 16;
  const tail = compact ? 5 : Math.max(7, Math.min(12, size * .3));
  const spread = compact ? 2 : Math.max(3, Math.min(6, (box.b - box.t) * .4));
  const dark = darkElement(element), dim = tone(ramp, dark ? .15 : .3), body = tone(ramp, dark ? .32 : .62), bright = tone(ramp, dark ? .45 : .9);
  const edge = box.l - 3, y = Math.max(box.t, Math.min(box.b, centerY));
  const strokes = compact ? [-1, 1] : [-1, 0, 1];
  for (const i of strokes) {
    const yy = y + i * spread, end = edge - Math.abs(i), start = end - tail + Math.abs(i) * 2;
    if (element === 'raio') {
      line(pix, [start, yy + 1], [start + tail * .45, yy - 1], dim);
      line(pix, [start + tail * .45, yy - 1], [start + tail * .65, yy + 1], body);
      line(pix, [start + tail * .65, yy + 1], [end, yy], bright);
    } else if (element === 'fogo') {
      line(pix, [start, yy - i], [start + tail * .5, yy], dim);
      line(pix, [start + tail * .5, yy], [end, yy], i === 0 ? bright : body);
      if (!compact && i) pix.set(end - 1, yy - i, bright);
    } else if (element === 'agua' || element === 'acido') {
      line(pix, [start + 2, yy], [end, yy], body);
      pix.set(start, yy + 1, dim);
      if (!compact) pix.set(end - 1, yy - 1, bright);
    } else if (element === 'gelo' || element === 'metal' || element === 'terra' || element === 'materia') {
      line(pix, [start, yy], [end, yy], i === 0 ? bright : body);
      if (!compact && i) { pix.set(start + 1, yy + i, dim); pix.set(start + 2, yy + i, body); }
    } else {
      line(pix, [start, yy + i], [start + tail * .45, yy], dim);
      line(pix, [start + tail * .45, yy], [end, yy], i === 0 ? bright : body);
    }
  }
  if (forward && box.r < pix.w - 17) {
    const tip: MotionPoint = [box.r + (compact ? 7 : 10), y];
    line(pix, [box.r + 4, y], tip, body);
    chevron(pix, tip, [1, 0], compact ? 2 : 2.5, bright);
  }
}
