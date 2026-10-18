import type { IntentionForm } from '../core/intention';
import { darken, inPoly, type Pix, type RGB } from './pixel';
import type { SpellMaterial } from './pixel-materials';
import { intentionMaterialPixel } from './pixel-intention-material';
import { serpentSurfaceLight } from './pixel-serpent-surface';
import type { IntentionPart as Part } from './pixel-intention-geometry';
import { WEAPON_FORMS } from './pixel-intention-weapons';
import { OBJECT_FORMS } from './pixel-intention-objects';
import { NATURE_FORMS } from './pixel-intention-nature';
import { EQUIPMENT_FORMS } from './pixel-intention-equipment';
import { CREATURE_FORMS } from './pixel-intention-creatures';
import { SYMBOL_FORMS } from './pixel-intention-symbols';
import { WILDLIFE_FORMS } from './pixel-intention-wildlife';
import { MYTHICAL_FORMS } from './pixel-intention-mythical';
import { CONSTRUCTION_FORMS } from './pixel-intention-constructions';
import { TOOL_FORMS } from './pixel-intention-tools';
import { ARSENAL_FORMS } from './pixel-intention-arsenal';
import { ANIMAL_FORMS } from './pixel-intention-animals';
import { LEGEND_FORMS } from './pixel-intention-legends';
import { BOTANY_FORMS } from './pixel-intention-botany';
import { ARTIFACT_FORMS } from './pixel-intention-artifacts';
import { BUILDING_FORMS } from './pixel-intention-buildings';
import { CLASSIC_FORMS } from './pixel-intention-classic';

export interface IntentionBox { l: number; t: number; r: number; b: number }
interface Geometry { parts: Part[]; body: IntentionBox; bounds: IntentionBox }

/** Authored at size 15. Every component is made from the spell's own material. */
const FORMS: Record<IntentionForm, Part[]> = {
  ...WEAPON_FORMS,
  ...OBJECT_FORMS,
  ...NATURE_FORMS,
  ...EQUIPMENT_FORMS,
  ...CREATURE_FORMS,
  ...SYMBOL_FORMS,
  ...WILDLIFE_FORMS,
  ...MYTHICAL_FORMS,
  ...CONSTRUCTION_FORMS,
  ...TOOL_FORMS,
  ...ARSENAL_FORMS,
  ...ANIMAL_FORMS,
  ...LEGEND_FORMS,
  ...BOTANY_FORMS,
  ...ARTIFACT_FORMS,
  ...BUILDING_FORMS,
  ...CLASSIC_FORMS
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

/** Recognisable silhouettes with sculpted faces and the spell's own material. */
export function paintIntention(
  pix: Pix, form: IntentionForm, x: number, y: number, s: number,
  ramp: RGB[], mat: SpellMaterial, seed: number, element?: string, reverse = false, frame = 0
): IntentionBox {
  const g = geometry(form, s), originX = Math.round(x), originY = Math.round(y);
  const q = { l: originX + g.bounds.l, t: originY + g.bounds.t, r: originX + g.bounds.r, b: originY + g.bounds.b };
  const colors: RGB[] = ramp.length ? ramp : [[49, 48, 56], [119, 128, 144], [223, 234, 239]];
  const dir = reverse ? -1 : 1, width = g.body.r - g.body.l, height = g.body.b - g.body.t;
  const serpentScale = form === 'serpente' ? Math.max(.05, Number.isFinite(s) && s > 0 ? s / 15 : 1 / 15) : 0;
  let painted = false;
  pix.shape(q.l, q.t, q.r, q.b, (px, py) => {
    const lx = (px - originX) * dir, ly = py - originY;
    for (let i = g.parts.length - 1; i >= 0; i--) {
      const p = g.parts[i];
      if (!inPoly(p.points, lx, ly)) continue;
      painted = true;
      // Sampling in authored coordinates also mirrors the material's own texture.
      const light = serpentScale ? serpentSurfaceLight(lx, ly, serpentScale, p.light, frame) : p.light;
      return intentionMaterialPixel(colors, mat, lx, ly, (lx - g.body.l) / width, (ly - g.body.t) / height, light, seed, element);
    }
    return null;
  }, darken(colors[0], .4));
  // Very crowded layouts may shrink a form below one logical pixel.
  if (!painted) pix.set(originX, originY, colors[Math.floor(colors.length / 2)]);
  return q;
}
