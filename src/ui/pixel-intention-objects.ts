import type { IntentionForm } from '../core/intention';
import { part, rect, type IntentionPart, type IntentionPoint } from './pixel-intention-geometry';

const polygon = (cx: number, cy: number, rx: number, ry: number, count: number, phase = 0): IntentionPoint[] =>
  Array.from({ length: count }, (_, i) => {
    const angle = phase + i / count * Math.PI * 2;
    return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
  });

/** Separate quads leave the central opening genuinely unpainted. */
function ring(cx: number, cy: number, outerX: number, outerY: number, innerX: number, innerY: number): IntentionPart[] {
  const outer = polygon(cx, cy, outerX, outerY, 16, -Math.PI / 2);
  const inner = polygon(cx, cy, innerX, innerY, 16, -Math.PI / 2);
  return outer.map((point, i) => {
    const next = (i + 1) % outer.length;
    return part(i < 5 || i > 12 ? .87 : i < 9 ? .3 : .58, point, outer[next], inner[next], inner[i]);
  });
}

function spiral(): IntentionPart[] {
  const points = Array.from({ length: 49 }, (_, i) => {
    const t = i / 48, angle = -Math.PI / 2 + t * Math.PI * 4;
    const radius = 4 + t * 13;
    return { angle, radius };
  });
  const edge = (at: typeof points[number], side: number): IntentionPoint =>
    [Math.cos(at.angle) * (at.radius + side * 1.4), Math.sin(at.angle) * (at.radius + side * 1.4)];
  return points.slice(0, -1).map((point, i) => part(i % 12 < 6 ? .86 : .42,
    edge(point, -1), edge(point, 1), edge(points[i + 1], 1), edge(points[i + 1], -1)));
}

const star = Array.from({ length: 10 }, (_, i): IntentionPoint => {
  const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? 8 : 19;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
});
const blast = Array.from({ length: 24 }, (_, i): IntentionPoint => {
  const angle = -Math.PI / 2 + i * Math.PI / 12;
  const radius = i % 2 ? 7 : [19, 15, 18, 17, 19, 15][(i / 2) % 6];
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
});

/** Objects and geometric symbols, authored at size 15 in the spell material. */
export const OBJECT_FORMS = {
  bomba: [
    part(.6, ...polygon(0, 3, 14, 14, 16, -Math.PI / 2)),
    part(.89, [-12, 0], [-10, -5], [-5, -9], [2, -10], [-2, -4], [-5, 1], [-6, 8], [-10, 6]),
    part(.3, [6, -9], [12, -4], [14, 3], [12, 10], [6, 15], [-1, 17], [4, 9], [6, 1]),
    rect(-4, -13, 4, -9, .46),
    rect(-4, -13, 4, -11, .86),
    part(.72, [-1, -13], [0, -17], [3, -20], [6, -20], [9, -17], [7, -15], [5, -18], [3, -17], [2, -13]),
    part(.98, [10, -22], [11, -19], [15, -20], [12, -17], [15, -15], [11, -15], [10, -11], [9, -15], [6, -14], [8, -17], [6, -20], [9, -19])
  ],
  esfera: [
    part(.63, ...polygon(0, 0, 17, 17, 16, -Math.PI / 2)),
    part(.87, [-15, -5], [-11, -12], [-3, -16], [5, -15], [1, -9], [-5, -5], [-8, 2], [-14, 5]),
    part(.3, [10, -13], [16, -6], [17, 3], [12, 12], [3, 17], [-5, 16], [4, 11], [9, 3]),
    part(.98, ...polygon(-7, -8, 3, 2, 8))
  ],
  cubo: [
    part(.88, [0, -17], [16, -9], [0, 0], [-16, -9]),
    part(.61, [-16, -9], [0, 0], [0, 17], [-16, 8]),
    part(.29, [0, 0], [16, -9], [16, 8], [0, 17]),
    part(.94, [-16, -9], [-14, -8], [0, 0], [0, 2], [-16, -7])
  ],
  piramide: [
    part(.89, [0, -18], [-17, 10], [1, 17]),
    part(.3, [0, -18], [1, 17], [17, 10]),
    part(.54, [-17, 10], [1, 17], [17, 10], [1, 9]),
    part(.97, [0, -18], [-1, -13], [1, 13], [2, 15])
  ],
  cone: [
    part(.7, [0, -18], [15, 10], [13, 14], [7, 17], [0, 18], [-7, 17], [-13, 14], [-15, 10]),
    part(.9, [0, -18], [-15, 10], [-6, 13], [-2, -7]),
    part(.36, [0, -18], [15, 10], [10, 14], [4, 15]),
    part(.3, ...polygon(0, 11, 15, 5, 16)),
    part(.68, [-14, 10], [-9, 7], [0, 6], [9, 7], [14, 10], [6, 9], [-6, 9])
  ],
  anel: ring(0, 0, 18, 15, 10, 7),
  estrela: [
    part(.68, ...star),
    part(.93, star[0], star[1], [0, 1], star[9]),
    part(.83, star[2], star[3], [0, 1], star[1]),
    part(.35, star[4], star[5], [0, 1], star[3]),
    part(.46, star[6], star[7], [0, 1], star[5]),
    part(.76, star[8], star[9], [0, 1], star[7])
  ],
  espiral: spiral(),
  cruz: [
    part(.62, [-5, -18], [5, -18], [5, -6], [16, -6], [16, 2], [5, 2], [5, 18], [-5, 18], [-5, 2], [-16, 2], [-16, -6], [-5, -6]),
    rect(-5, -18, -2, 18, .9),
    rect(-16, -6, 16, -4, .87),
    rect(3, 2, 5, 18, .3)
  ],
  coracao: [
    part(.64, [0, 17], [-15, 4], [-18, -5], [-16, -12], [-10, -17], [-4, -16], [0, -11], [4, -16], [10, -17], [16, -12], [18, -5], [15, 4]),
    part(.9, [-14, -4], [-12, -10], [-7, -13], [-3, -11], [-6, -8], [-8, -2], [-7, 4]),
    part(.32, [12, -15], [17, -9], [18, -3], [13, 6], [0, 17], [4, 7], [9, 1])
  ],
  coroa: [
    part(.68, [-19, 9], [-21, -13], [-11, -5], [-2, -18], [7, -5], [20, -14], [17, 10]),
    part(.91, [-21, -13], [-17, -5], [-14, 9], [-19, 9]),
    part(.9, [-2, -18], [-5, -6], [-2, 7], [1, -6]),
    part(.32, [20, -14], [17, 10], [11, 9], [13, 0]),
    rect(-19, 7, 17, 15, .54),
    rect(-19, 7, 17, 9, .92),
    part(.94, [-4, 11], [-1, 9], [2, 11], [-1, 14])
  ],
  chave: [
    ...ring(-11, -1, 10, 10, 5, 5),
    rect(-3, -3, 21, 1, .65),
    rect(-3, -3, 21, -1, .91),
    rect(10, 0, 14, 8, .54),
    rect(17, 0, 21, 6, .36)
  ],
  cristal: [
    part(.63, [0, -20], [-9, -12], [-14, 9], [-5, 18], [0, 20], [8, 16], [13, 9], [9, -12]),
    part(.93, [0, -20], [-3, -9], [-5, 18], [0, 20], [4, 15], [5, -9]),
    part(.79, [0, -20], [-9, -12], [-14, 9], [-5, 18], [-3, -9]),
    part(.28, [0, -20], [9, -12], [13, 9], [8, 16], [4, 15], [5, -9]),
    part(.48, [-14, 9], [-3, 7], [13, 9], [4, 15], [0, 20], [-5, 18])
  ],
  mao: [
    part(.65, [-8, 19], [7, 19], [7, 12], [13, 8], [17, 1], [16, -3], [13, -3], [9, 2], [7, 4], [8, -11], [7, -14], [5, -14], [4, -12], [3, -4], [3, -17], [1, -19], [-1, -18], [-2, -15], [-2, -5], [-4, -17], [-6, -18], [-8, -16], [-7, -4], [-11, -12], [-13, -13], [-15, -11], [-13, -1], [-13, 7], [-9, 14]),
    part(.86, [-8, -1], [-5, -2], [-3, 2], [-3, 10], [-7, 14], [-10, 7]),
    part(.32, [5, 0], [7, 4], [13, -3], [16, -3], [12, 4], [8, 10], [5, 13]),
    rect(-8, 14, 7, 17, .85)
  ],
  explosao: [
    part(.68, ...blast),
    part(.94, ...polygon(-1, -1, 8, 8, 8, -Math.PI / 2)),
    part(.98, [20, -9], [22, -7], [20, -5], [18, -7]),
    part(.86, [-20, 9], [-18, 11], [-20, 13], [-22, 11]),
    part(.87, [14, 13], [16, 15], [14, 17], [12, 15])
  ]
} satisfies Partial<Record<IntentionForm, IntentionPart[]>>;
