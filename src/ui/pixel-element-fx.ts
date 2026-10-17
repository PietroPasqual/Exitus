import { darken, inPoly, lighten, mixRGB, type Pix, type RGB } from './pixel';
import { seeded } from './sketch';

/** Bounds of the existing spell body, in the scene's logical pixels. */
export interface EffectBox { l: number; t: number; r: number; b: number }

type Point = [number, number];
interface Palette { low: RGB; mid: RGB; rim: RGB; high: RGB; ink: RGB }

const center = (q: EffectBox): Point => [(q.l + q.r) / 2, (q.t + q.b) / 2];
const size = (q: EffectBox): Point => [Math.max(4, q.r - q.l), Math.max(4, q.b - q.t)];

/** A few continuous pixel clusters read better than a cloud of isolated specks. */
function arc(pix: Pix, x: number, y: number, rx: number, ry: number, a: number, b: number, c: RGB): void {
  const n = Math.max(3, Math.ceil((b - a) * Math.max(rx, ry) * 1.4));
  for (let k = 0; k <= n; k++) {
    const t = a + (b - a) * k / n;
    pix.set(x + Math.cos(t) * rx, y + Math.sin(t) * ry, c);
  }
}

/** Tiny faceted silhouettes; the split is clipped to the shard itself. */
function facet(pix: Pix, pts: Point[], p: Palette, split = 0.48): void {
  const l = Math.min(...pts.map(v => v[0])), r = Math.max(...pts.map(v => v[0]));
  const t = Math.min(...pts.map(v => v[1])), b = Math.max(...pts.map(v => v[1]));
  pix.shape(l, t, r, b, (x, y) => {
    if (!inPoly(pts, x + 0.5, y + 0.5)) return null;
    return x - l + (y - t) * 0.2 < (r - l) * split ? p.rim : p.mid;
  }, p.ink);
}

function droplet(pix: Pix, x: number, y: number, p: Palette): void {
  x = Math.round(x); y = Math.round(y);
  pix.set(x, y - 2, p.rim);
  pix.set(x, y - 1, p.high);
  pix.line(x - 1, y, x + 1, y, p.mid);
  pix.set(x - 1, y, p.rim);
  pix.set(x, y + 1, p.low);
}

function water(pix: Pix, q: EffectBox, p: Palette, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  // Two separated crests leave the original silhouette visible between them.
  arc(pix, x, y + h * 0.08, w * 0.58 + 2, h * 0.46 + 2, 0.1, 1.22, p.rim);
  arc(pix, x, y + h * 0.08, w * 0.58 + 2, h * 0.46 + 2, 1.45, 2.55, p.mid);
  arc(pix, x - w * 0.03, y + h * 0.08 - 1, w * 0.5 + 2, h * 0.4 + 2, 0.42, 0.95, p.high);
  droplet(pix, q.l - 4 - phase, y - h * 0.26, p);
  droplet(pix, flight ? q.l - 9 : q.r + 4, y + h * 0.24, p);
  droplet(pix, x + w * 0.21, q.t - 4, p);
}

function acid(pix: Pix, q: EffectBox, p: Palette, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const bubbles: [number, number, number][] = [
    [q.l - 4, y - h * 0.22, 2],
    [flight ? q.l - 9 : q.r + 4, y + h * 0.18, 1.5],
    [x + w * 0.2, q.t - 4 - phase, 2.5]
  ];
  bubbles.forEach(([bx, by, r]) => {
    pix.ellipse(bx, by, r, r, p.low);
    arc(pix, bx, by, r, r, Math.PI, Math.PI * 1.8, p.rim);
    pix.set(bx - 1, by - 1, p.high);
  });
  arc(pix, x, y + h * 0.12, w * 0.52 + 1, h * 0.43, 0.24, 1.4, p.rim);
  pix.line(q.l - 3, y + h * 0.27, q.l - 3, y + h * 0.27 + 2, p.mid);
}

function crystal(pix: Pix, x: number, y: number, h: number, lean: number, p: Palette): void {
  facet(pix, [[x + lean, y - h], [x + 2, y - 2], [x, y], [x - 2, y - 2]], p, 0.54);
  pix.line(x + lean, y - h + 1, x, y - 2, p.high);
}

function ice(pix: Pix, q: EffectBox, p: Palette, grounded: boolean, flight: boolean): void {
  const [, y] = center(q), [, h] = size(q);
  const bottom = grounded ? Math.min(96, q.b + 2) : y + h * 0.22;
  // Three readable shards replace the old ring of six identical snow pixels.
  crystal(pix, q.l - 4, y - h * 0.15, 5, -2, p);
  crystal(pix, flight ? q.l - 10 : q.r + 4, bottom, grounded ? 8 : 6, 2, p);
  crystal(pix, q.r - 1, q.t - 3, 4, 1, p);
  if (grounded) {
    crystal(pix, q.l - 1, bottom + 1, 5, -1, p);
    pix.line(q.l - 5, bottom + 1, q.l + 1, bottom + 1, p.rim);
  }
}

function fragment(pix: Pix, x: number, y: number, s: number, p: Palette): void {
  facet(pix, [[x - s, y - 1], [x - 1, y - s], [x + s, y - s + 1], [x + s, y + 1], [x, y + s], [x - s, y + 1]], p);
}

function mineral(pix: Pix, el: string, q: EffectBox, p: Palette, grounded: boolean, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const floor = grounded ? Math.min(96, q.b + 2) : y + h * 0.35;
  fragment(pix, q.l - 5, flight ? y - h * 0.18 : floor - 4, 2.5, p);
  fragment(pix, flight ? q.l - 12 : q.r + 5, y + h * 0.13 + phase, 2, p);
  fragment(pix, flight ? q.l - 8 : q.r + 2, flight ? y + h * 0.36 : floor + 1, 1.5, p);
  if (el === 'gravidade') {
    arc(pix, x, y, w * 0.59 + 3, h * 0.53 + 2, 0.05, 0.78, p.rim);
    arc(pix, x, y, w * 0.59 + 3, h * 0.53 + 2, 2.7, 3.65, p.mid);
  } else if (grounded) {
    // Broken dust strokes stay beneath the body, never across its unknown shape.
    pix.line(q.l - 6, floor + 2, q.l - 2, floor + 2, p.low);
    pix.line(q.r + 1, floor + 2, q.r + 5, floor + 2, p.mid);
  }
  if (el === 'metal') pix.sparkle(q.r + 2, q.t + 2, 2, p.rim, p.high);
}

function wind(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean): void {
  const [x, y] = center(q), [w, h] = size(q);
  if (el === 'som') {
    // Sound travels in paired wavefronts rather than looking like solid ribbons.
    for (let i = 0; i < 2; i++) {
      const rx = w * 0.55 + 3 + i * 4, ry = h * 0.47 + i * 2;
      arc(pix, x, y, rx, ry, -0.62, 0.62, i ? p.mid : p.high);
      if (!flight) arc(pix, x, y, rx, ry, Math.PI - 0.62, Math.PI + 0.62, p.rim);
    }
    return;
  }
  const rx = w * 0.58 + 3, ry = h * 0.38 + 2;
  arc(pix, x, y - 2, rx, ry, 3.3, 5.85, p.mid);
  arc(pix, x + 1, y - 3, rx, ry, 4.12, 5.73, p.rim);
  arc(pix, x - 1, y + 3, rx + 3, ry + 1, 0.05, 1.28, p.high);
  arc(pix, x - 1, y + 3, rx + 3, ry + 1, 1.47, 2.75, p.rim);
  const tip = 0.05;
  const tx = x - 1 + Math.cos(tip) * (rx + 3), ty = y + 3 + Math.sin(tip) * (ry + 1);
  pix.line(tx - 2, ty + 1, tx, ty, p.rim);
  if (flight) pix.line(q.l - 10, y + 2, q.l - 5, y + 2, p.mid);
}

function leaf(pix: Pix, x: number, y: number, dir: number, p: Palette): void {
  facet(pix, [[x, y], [x + dir * 2, y - 3], [x + dir * 5, y - 3], [x + dir * 4, y - 1]], p, 0.56);
  pix.line(x + dir, y - 1, x + dir * 3, y - 2, p.high);
}

function organic(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean): void {
  const [, y] = center(q), [, h] = size(q);
  const lx = q.l - 3, ly = y + h * 0.34;
  pix.line(lx, ly, lx - 2, ly - 5, p.low);
  pix.line(lx - 2, ly - 5, lx - 1, ly - 8, p.mid);
  leaf(pix, lx - 2, ly - 4, -1, p);
  leaf(pix, lx - 1, ly - 7, 1, p);
  leaf(pix, flight ? q.l - 9 : q.r + 2, y - h * 0.26, flight ? -1 : 1, p);
  if (el === 'vida') {
    pix.sparkle(q.r + 3, y + h * 0.27, 1, p.rim, p.high);
  } else {
    const rx = q.r + 3, by = Math.min(97, q.b + 1);
    pix.line(rx, by, rx + 2, by - 3, p.low);
    pix.line(rx + 2, by - 3, rx + 5, by - 4, p.mid);
  }
}

function spectral(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const rx = w * 0.55 + 3, ry = h * 0.46 + 3;
  if (el === 'espaco' || el === 'ilusao') {
    arc(pix, x - 1, y, rx, ry * 0.63, 0.18, 1.33, p.high);
    arc(pix, x - 1, y, rx, ry * 0.63, 2.85, 4.65, p.mid);
    arc(pix, x + 2, y - 2, rx + 1, ry * 0.65, 4.86, 5.97, p.rim);
    pix.sparkle(q.l - 4, y - h * 0.27, 1, p.rim, p.high);
    if (el === 'espaco') pix.sparkle(q.r + 4, q.t + 1, 2, p.rim, p.high);
    else facet(pix, [[q.r + 3, y], [q.r + 5, y - 3], [q.r + 7, y], [q.r + 5, y + 2]], p);
    return;
  }
  // Smoke has a darker body and a thin cool rim, with open gaps around the spell.
  arc(pix, x, y + 1, rx + 1, ry, 3.55, 5.05, p.low);
  arc(pix, x, y, rx + 1, ry, 3.9, 4.84, p.rim);
  arc(pix, x, y + 1, rx + 2, ry, 0.3, 1.62, p.low);
  arc(pix, x, y, rx + 2, ry, 0.34, 1.08, p.mid);
  const bx = flight ? q.l - 7 : q.r + 5, by = y + h * 0.2 - phase;
  pix.line(bx, by, bx - 1, by - 2, p.mid);
  pix.set(bx - 1, by - 3, p.rim);
  if (el === 'morte') pix.line(q.l - 5, y - h * 0.2, q.l - 4, y - h * 0.2 - 3, p.rim);
}

/**
 * Pixel accents only: the caller owns shape, placement, size and elemental rules.
 * Returns false for materials handled by the scene's other effect painters.
 */
export function paintElementAccents(pix: Pix, element: string, q: EffectBox, ramp: RGB[], seed: number, grounded: boolean, flight: boolean): boolean {
  const r = ramp.length ? ramp : [[60, 58, 68], [130, 135, 145], [230, 235, 240]] as RGB[];
  const p: Palette = {
    low: r[Math.min(1, r.length - 1)], mid: r[Math.floor((r.length - 1) / 2)],
    rim: r[Math.max(0, r.length - 2)], high: lighten(r[r.length - 1], 0.12), ink: darken(r[0], 0.4)
  };
  // Tiny seeded offsets vary clusters without scattering particles over the scene.
  const phase = seeded(`element-accents:${element}:${seed}`)() * 2 - 1;
  switch (element) {
    case 'agua': water(pix, q, p, flight, phase); break;
    case 'acido': acid(pix, q, p, flight, phase); break;
    case 'gelo': ice(pix, q, p, grounded, flight); break;
    case 'terra': case 'materia': case 'gravidade': case 'metal':
      mineral(pix, element, q, p, grounded, flight, phase); break;
    case 'vento': case 'som': wind(pix, element, q, p, flight); break;
    case 'natureza': case 'vida': organic(pix, element, q, p, flight); break;
    case 'sombra': case 'morte': case 'espaco': case 'ilusao':
      if (element === 'sombra' || element === 'morte') p.rim = mixRGB(p.rim, [159, 151, 189], 0.28);
      spectral(pix, element, q, p, flight, phase); break;
    default: return false;
  }
  return true;
}
