import type { IntentionForm } from '../core/intention';
import { part, rect, type IntentionPart } from './pixel-intention-geometry';

type Point = [number, number];

/** Hollow loops remain transparent inside; even their rim uses the spell material. */
function loop(cx: number, cy: number, rx: number, ry: number, thickness: number): IntentionPart[] {
  const result: IntentionPart[] = [], n = 12;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
    const p = (angle: number, inset: number): Point => [cx + Math.cos(angle) * (rx - inset), cy + Math.sin(angle) * (ry - inset)];
    result.push(part(Math.sin((a + b) / 2) < 0 ? .9 : .36, p(a, 0), p(b, 0), p(b, thickness), p(a, thickness)));
  }
  return result;
}

/** A single tapered ribbon has no gaps at the joins of a bent cord or limb. */
function ribbon(points: Point[], widths: number[], light: number): IntentionPart {
  const left: Point[] = [], right: Point[] = [];
  points.forEach(([x, y], i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy) || 1;
    const width = (widths[i] ?? widths[widths.length - 1]) / 2;
    left.push([x - dy / length * width, y + dx / length * width]);
    right.push([x + dy / length * width, y - dx / length * width]);
  });
  return part(light, ...left, ...right.reverse());
}

/** Authored at size 15; no handle, string, blade or link forces a material colour. */
export const WEAPON_FORMS = {
  adaga: [
    rect(-18, -1.5, -7, 1.5, .51),
    rect(-18, -1.5, -8, -.5, .87),
    part(.64, [-21, 0], [-18, -2.5], [-15, 0], [-18, 2.5]),
    rect(-9, -6, -6.5, 6, .65),
    rect(-9, -6, -8, 6, .91),
    part(.93, [-6.5, 0], [-4, -4], [4, -4], [20, 0]),
    part(.31, [-6.5, 0], [20, 0], [4, 4], [-4, 4])
  ],
  foice: [
    part(.5, [-14, -13], [-11, -13], [-8, 19], [-11, 20]),
    part(.88, [-14, -13], [-12.5, -13], [-9.5, 19.5], [-11, 20]),
    part(.7, [-15, -15], [-8, -19], [3, -19], [14, -15], [24, -7], [14, -10], [4, -12], [-5, -11], [-14, -9]),
    part(.93, [-15, -15], [-8, -19], [3, -19], [14, -15], [24, -7], [13, -12], [3, -16], [-7, -16]),
    part(.34, [-14, -9], [-5, -11], [4, -12], [14, -10], [24, -7], [9, -8], [-3, -8])
  ],
  arco: [
    rect(-8.5, -17, -7.5, 17, .65),
    part(.58, [-9, -20], [-3, -19], [3, -14], [8, -6], [10, 0], [8, 6], [3, 14], [-3, 19], [-9, 20], [-6, 16], [-1, 12], [3, 5], [5, 0], [3, -5], [-1, -12], [-6, -16]),
    ribbon([[-7, -19], [-2, -16], [3, -9], [7, 0], [3, 9], [-2, 16], [-7, 19]], [1, 1, 1, 1.3, 1, 1, 1], .91),
    rect(4.5, -3, 9, 3, .43),
    rect(4.5, -3, 6, 3, .83)
  ],
  tridente: [
    rect(-24, -1.5, 10, 1.5, .53),
    rect(-24, -1.5, 8, -.5, .9),
    rect(-24, -2, -21, 2, .59),
    part(.7, [5, -1], [8, -8], [20, -8], [20, -5], [10, -5], [8, 1]),
    part(.37, [5, 1], [8, 8], [20, 8], [20, 5], [10, 5], [8, -1]),
    rect(8, -1.5, 21, 1.5, .66),
    part(.93, [18, -7], [20, -10], [25, -7]),
    part(.33, [18, -7], [25, -7], [20, -4]),
    part(.94, [19, 0], [20, -3], [26, 0]),
    part(.33, [19, 0], [26, 0], [20, 3]),
    part(.9, [18, 7], [20, 4], [25, 7]),
    part(.3, [18, 7], [25, 7], [20, 10])
  ],
  chicote: [
    part(.52, [-23, 15], [-20, 5], [-16, 6], [-19, 17]),
    part(.88, [-23, 15], [-20, 5], [-18.5, 5.5], [-21.5, 16]),
    part(.63, [-23, 15], [-19, 17], [-20, 20], [-24, 18]),
    ribbon([[-18, 7], [-15, -2], [-7, -10], [4, -13], [15, -10], [22, -4], [23, 3], [19, 8], [11, 9], [6, 5], [8, 0], [14, -1], [17, 2]], [3.5, 3.4, 3.2, 3, 2.8, 2.6, 2.4, 2.2, 2, 1.7, 1.4, 1.1, .7], .59),
    ribbon([[-18.7, 6], [-15.5, -2.5], [-7, -10.7], [4, -13.7], [15, -10.6], [22, -4.5]], [1, 1, 1, 1, .8, .6], .91)
  ],
  corrente: [
    ...loop(-20, -3, 4.5, 3, 1.4),
    ...loop(-12, -6, 4.5, 3, 1.4),
    ...loop(-4, -5, 4.5, 3, 1.4),
    ...loop(4, -1, 4.5, 3, 1.4),
    ...loop(12, 4, 4.5, 3, 1.4),
    ...loop(20, 6, 4.5, 3, 1.4)
  ],
  cajado: [
    rect(-1.5, -8, 1.5, 20, .48),
    rect(-1.5, -8, -.5, 19, .87),
    rect(-3, 17, 3, 20, .62),
    part(.68, [-3, -7], [-4, -10], [4, -10], [3, -7]),
    ...loop(0, -13, 7, 6.5, 1.9),
    part(.93, [0, -17], [3, -13], [0, -10]),
    part(.32, [0, -17], [0, -10], [-3, -13])
  ],
  picareta: [
    part(.5, [-13, 18], [-10, 20], [10, -10], [7, -13]),
    part(.88, [-13, 18], [-11.7, 18.9], [8.7, -11.3], [7, -13]),
    part(.67, [-23, -3], [-16, -12], [-5, -17], [7, -16], [17, -10], [23, -1], [12, -7], [4, -10], [-5, -11], [-14, -8]),
    part(.93, [-23, -3], [-16, -12], [-5, -17], [7, -16], [17, -10], [23, -1], [15, -9], [5, -13], [-5, -14], [-14, -10]),
    part(.32, [-14, -8], [-5, -11], [4, -10], [12, -7], [23, -1], [10, -6], [3, -8], [-5, -9])
  ],
  kunai: [
    ...loop(-19, 0, 4.5, 4, 1.5),
    rect(-15, -1.5, -3, 1.5, .51),
    rect(-15, -1.5, -4, -.5, .88),
    part(.93, [-5, 0], [5, -7], [25, 0]),
    part(.3, [-5, 0], [25, 0], [5, 7])
  ],
  agulha: [
    ...loop(-20, 0, 4, 3, 1.1),
    rect(-17, -.85, 20, .85, .66),
    part(.94, [-17, -.85], [20, -.85], [25, 0], [-17, 0]),
    part(.35, [-17, 0], [25, 0], [20, .85], [-17, .85])
  ]
} satisfies Partial<Record<IntentionForm, IntentionPart[]>>;
