import type { Pix, RGB } from './pixel';
import type { SpellMaterial } from './pixel-materials';

interface AuraStyle { tones: number[]; opacity: number[] }

// A few solid bands follow the actual sprite instead of a large glowing oval.
// Even the innermost band is quiet enough to leave the dark outline readable.
const STYLES: Record<SpellMaterial, AuraStyle> = {
  fire: { tones: [.6, .4, .2], opacity: [.25, .125, .0625] },
  plasma: { tones: [.6, .45, .3, .15], opacity: [.25, .1875, .125, .0625] },
  water: { tones: [.6, .4, .2], opacity: [.25, .125, .0625] },
  ice: { tones: [.6, .4, .2], opacity: [.25, .125, .0625] },
  stone: { tones: [.4, .2], opacity: [.125, .0625] },
  metal: { tones: [.45, .2], opacity: [.1875, .0625] },
  wind: { tones: [.5, .3, .1], opacity: [.1875, .125, .0625] },
  energy: { tones: [.55, .35, .15], opacity: [.25, .125, .0625] }
};
const DARK: AuraStyle = { tones: [.24, .08], opacity: [.25, .125] };
const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;

/**
 * Paint behind an Intention layer, using its alpha in the same coordinates as
 * pix. The caller composites the untouched body afterwards. Enclosed holes and
 * narrow open slots stay clear, so letters, nets and separate copies keep their
 * negative space. Work is bounded by the occupied box plus at most five pixels.
 * Returns an exterior mask in pix coordinates (1 = clear for decorative FX),
 * including the same protection for holes and narrow slots used by the aura.
 */
export function paintIntentionAura(pix: Pix, body: Pix, ramp: RGB[], mat: SpellMaterial, element?: string): Uint8Array {
  const exterior = new Uint8Array(pix.w * pix.h).fill(1);
  if (!pix.w || !pix.h || !body.w || !body.h) return exterior;
  const style = element === 'sombra' || element === 'morte' || element === 'vazio' ? DARK : STYLES[mat];
  const radius = style.tones.length, limit = radius * 10;
  const canvasW = Math.min(pix.w, body.w), canvasH = Math.min(pix.h, body.h);
  let left = canvasW, top = canvasH, right = -1, bottom = -1;
  for (let y = 0; y < canvasH; y++) for (let x = 0; x < canvasW; x++) {
    if (!body.data[(y * body.w + x) * 4 + 3]) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) return exterior;
  left = Math.max(0, left - radius - 1); top = Math.max(0, top - radius - 1);
  right = Math.min(canvasW - 1, right + radius + 1); bottom = Math.min(canvasH - 1, bottom + radius + 1);
  const w = right - left + 1, h = bottom - top + 1, n = w * h;
  const solid = new Uint8Array(n), outside = new Uint8Array(n), distance = new Uint16Array(n);
  distance.fill(limit + 14);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = y * w + x;
    if (body.data[((y + top) * body.w + x + left) * 4 + 3]) { solid[at] = 1; distance[at] = 0; }
  }

  // Four-connected flood fill cannot leak through diagonal one-pixel outlines.
  // Its queue is bounded once; it is not rebuilt for each silhouette pixel.
  const queue = new Int32Array(n);
  let head = 0, tail = 0;
  const visit = (at: number): void => {
    if (!solid[at] && !outside[at]) { outside[at] = 1; queue[tail++] = at; }
  };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const at = queue[head++], x = at % w, y = Math.floor(at / w);
    if (x) visit(at - 1); if (x < w - 1) visit(at + 1);
    if (y) visit(at - w); if (y < h - 1) visit(at + w);
  }

  // A 10/14 chamfer gives a rounded, stepped contour in two linear passes.
  // Distance is measured to all occupied pixels, including the ink outline.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = y * w + x;
    if (x) distance[at] = Math.min(distance[at], distance[at - 1] + 10);
    if (y) {
      distance[at] = Math.min(distance[at], distance[at - w] + 10);
      if (x) distance[at] = Math.min(distance[at], distance[at - w - 1] + 14);
      if (x < w - 1) distance[at] = Math.min(distance[at], distance[at - w + 1] + 14);
    }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const at = y * w + x;
    if (x < w - 1) distance[at] = Math.min(distance[at], distance[at + 1] + 10);
    if (y < h - 1) {
      distance[at] = Math.min(distance[at], distance[at + w] + 10);
      if (x) distance[at] = Math.min(distance[at], distance[at + w - 1] + 14);
      if (x < w - 1) distance[at] = Math.min(distance[at], distance[at + w + 1] + 14);
    }
  }

  // Keep a small opening open even when it connects to the exterior: bars or
  // lettering on opposite sides should not add up into a luminous solid block.
  const ray = (x: number, y: number, dx: number, dy: number): number => {
    for (let step = 1; step <= radius + 1; step++) {
      const xx = x + dx * step, yy = y + dy * step;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) break;
      if (solid[yy * w + xx]) return step;
    }
    return 0;
  };
  const colors = style.tones.map(tone => ramp[Math.round(tone * (ramp.length - 1))]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = y * w + x, d = distance[at], target = (y + top) * pix.w + x + left;
    if (!outside[at]) { exterior[target] = 0; continue; }
    if (!d || d > limit) continue;
    if (AXES.some(([dx, dy]) => ray(x, y, dx, dy) && ray(x, y, -dx, -dy))) { exterior[target] = 0; continue; }
    if (!ramp.length) continue;
    const band = Math.min(radius - 1, Math.ceil(d / 10) - 1);
    pix.blend(x + left, y + top, colors[band], style.opacity[band]);
  }
  return exterior;
}
