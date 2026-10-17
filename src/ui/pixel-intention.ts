import type { IntentionForm } from '../core/intention';
import { darken, inPoly, type Pix, type RGB } from './pixel';
import { materialPixel, type SpellMaterial } from './pixel-materials';
import { part, rect, type IntentionPart as Part } from './pixel-intention-geometry';
import { WEAPON_FORMS } from './pixel-intention-weapons';
import { OBJECT_FORMS } from './pixel-intention-objects';
import { NATURE_FORMS } from './pixel-intention-nature';

export interface IntentionBox { l: number; t: number; r: number; b: number }
interface Geometry { parts: Part[]; body: IntentionBox; bounds: IntentionBox }

/** Authored at size 15. Every component is made from the spell's own material. */
const FORMS: Record<IntentionForm, Part[]> = {
  ...WEAPON_FORMS,
  ...OBJECT_FORMS,
  ...NATURE_FORMS,
  lanca: [
    rect(-24, -1.5, 7, 1.5, .52),
    rect(-24, -1.5, 7, -.5, .91),
    rect(-25, -2, -22, 2, .58),
    part(.94, [4, 0], [8, -5], [25, 0]),
    part(.31, [4, 0], [25, 0], [8, 5])
  ],
  espada: [
    rect(-21, -1.5, -9, 1.5, .51),
    rect(-20, -1.5, -11, -.5, .86),
    part(.62, [-24, 0], [-21, -3], [-18, 0], [-21, 3]),
    rect(-12, -7, -9, 7, .68),
    rect(-12, -7, -10.5, 7, .91),
    part(.91, [-9, 0], [-8, -4], [17, -4], [25, 0]),
    part(.29, [-9, 0], [25, 0], [17, 4], [-8, 4])
  ],
  escudo: [
    part(.65, [0, -18], [12, -14], [14, -1], [10, 11], [0, 18], [-10, 11], [-14, -1], [-12, -14]),
    part(.9, [0, -15], [0, 14], [-8, 8], [-11, -1], [-9, -12]),
    part(.32, [0, -15], [9, -12], [11, -1], [8, 8], [0, 14]),
    part(.74, [-1, -15], [1, -15], [1, 14], [0, 16], [-1, 14])
  ],
  flecha: [
    rect(-23, -1, 10, 1, .64),
    part(.91, [-23, -1], [-25, -7], [-17, -5], [-12, -1]),
    part(.36, [-23, 1], [-12, 1], [-17, 5], [-25, 7]),
    part(.94, [7, 0], [9, -5], [25, 0]),
    part(.32, [7, 0], [25, 0], [9, 5])
  ],
  martelo: [
    rect(-2, -11, 2, 19, .47),
    rect(-2, -9, -.5, 18, .86),
    rect(-4, 16, 4, 20, .59),
    rect(-12, -16, 11, -5, .65),
    part(.93, [-12, -16], [-8, -20], [15, -20], [11, -16]),
    part(.28, [11, -16], [15, -20], [15, -9], [11, -5]),
    rect(-12, -16, -10, -5, .86)
  ],
  parede: [
    rect(-21, -13, 17, 16, .62),
    part(.92, [-21, -13], [-17, -17], [21, -17], [17, -13]),
    part(.28, [17, -13], [21, -17], [21, 12], [17, 16]),
    rect(-21, -13, -19.5, 16, .86)
  ],
  machado: [
    rect(-3, -19, 0, 21, .47),
    rect(-3, -17, -1.5, 19, .85),
    rect(-5, 18, 2, 21, .57),
    rect(-7, -14, -2, -8, .61),
    part(.76, [-1, -15], [5, -17], [13, -14], [18, -9], [18, -3], [14, 3], [5, 5], [-1, 1], [4, -3], [7, -7], [4, -12]),
    part(.32, [-1, 1], [4, -3], [7, -7], [18, -3], [14, 3], [5, 5]),
    part(.94, [10, -14], [13, -14], [18, -9], [18, -3], [14, 3], [11, 3], [15, -4], [15, -9])
  ]
};

const geometryCache = new Map<string, Geometry>();

/** Layout and paint share the same centred geometry, including the pixel outline. */
function geometry(form: IntentionForm, size: number): Geometry {
  const scale = Math.max(.05, Number.isFinite(size) && size > 0 ? size / 15 : 1 / 15);
  const key = `${form}:${scale}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const authored = FORMS[form], points = authored.flatMap(p => p.points);
  const l = Math.min(...points.map(p => p[0])), r = Math.max(...points.map(p => p[0]));
  const t = Math.min(...points.map(p => p[1])), b = Math.max(...points.map(p => p[1]));
  const cx = (l + r) / 2, cy = (t + b) / 2;
  const body = { l: -(r - l) * scale / 2, t: -(b - t) * scale / 2, r: (r - l) * scale / 2, b: (b - t) * scale / 2 };
  // One outline pixel plus half a pixel for snapping the scene's floating origin.
  const halfW = Math.ceil(body.r + 1.5), halfH = Math.ceil(body.b + 1.5);
  const value: Geometry = {
    parts: authored.map(p => ({ light: p.light, points: p.points.map(([x, y]): [number, number] => [(x - cx) * scale, (y - cy) * scale]) })),
    body,
    bounds: { l: -halfW, t: -halfH, r: halfW, b: halfH }
  };
  if (geometryCache.size >= 128) geometryCache.delete(geometryCache.keys().next().value!);
  geometryCache.set(key, value);
  return value;
}

/** Local, centred bounds; no projectile or movement rule is inferred from the word. */
export function intentionBounds(form: IntentionForm, s: number): IntentionBox {
  return { ...geometry(form, s).bounds };
}

/** Recognisable silhouettes with the material shader used by the ordinary shapes. */
export function paintIntention(
  pix: Pix, form: IntentionForm, x: number, y: number, s: number,
  ramp: RGB[], mat: SpellMaterial, seed: number, element?: string, reverse = false
): IntentionBox {
  const g = geometry(form, s), originX = Math.round(x), originY = Math.round(y);
  const q = { l: originX + g.bounds.l, t: originY + g.bounds.t, r: originX + g.bounds.r, b: originY + g.bounds.b };
  const colors: RGB[] = ramp.length ? ramp : [[49, 48, 56], [119, 128, 144], [223, 234, 239]];
  const dir = reverse ? -1 : 1, width = g.body.r - g.body.l, height = g.body.b - g.body.t;
  let painted = false;
  pix.shape(q.l, q.t, q.r, q.b, (px, py) => {
    const lx = (px - originX) * dir, ly = py - originY;
    for (let i = g.parts.length - 1; i >= 0; i--) {
      const p = g.parts[i];
      if (!inPoly(p.points, lx, ly)) continue;
      painted = true;
      // Sampling in authored coordinates also mirrors the material's own texture.
      return materialPixel(colors, mat, lx, ly, (lx - g.body.l) / width, (ly - g.body.t) / height, p.light, seed, element);
    }
    return null;
  }, darken(colors[0], .4));
  // Very crowded layouts may shrink a form below one logical pixel.
  if (!painted) pix.set(originX, originY, colors[Math.floor(colors.length / 2)]);
  return q;
}
