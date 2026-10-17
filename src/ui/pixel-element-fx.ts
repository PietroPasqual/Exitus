import { darken, inPoly, lighten, type Pix, type RGB } from './pixel';
import { seeded } from './sketch';

/** Bounds of the existing spell body, in the scene's logical pixels. */
export interface EffectBox { l: number; t: number; r: number; b: number }

type Point = [number, number];
interface Palette { low: RGB; mid: RGB; rim: RGB; high: RGB; ink: RGB }
const SUPPORTED = new Set(['agua', 'acido', 'gelo', 'terra', 'materia', 'gravidade', 'metal', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao']);

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

/** A tapered band has a shaded underside and a short light-catching crest. */
function crest(pix: Pix, x: number, y: number, rx: number, ry: number, a: number, b: number, p: Palette): void {
  const n = Math.max(4, Math.ceil((b - a) * Math.max(rx, ry) * 1.4));
  for (let k = 0; k <= n; k++) {
    const t = a + (b - a) * k / n, weight = Math.sin(k / n * Math.PI);
    const xx = x + Math.cos(t) * rx, yy = y + Math.sin(t) * ry;
    pix.set(xx, yy + (weight > .35 ? 1 : 0), p.low);
    pix.set(xx, yy, weight > .45 ? p.rim : p.mid);
    if (weight > .82) pix.set(xx, yy - 1, p.high);
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
  // Broken, thick crests suggest moving water without closing into a halo.
  crest(pix, x, y + 1, w * .54 + 2, h * .48 + 2, .17, 1.14, p);
  crest(pix, x - 1, y, w * .54 + 2, h * .48 + 2, 1.55, 2.72, p);
  const curlX = q.l - 3, curlY = y + h * .2;
  arc(pix, curlX, curlY, 3, 3, 2.5, 5.9, p.mid);
  arc(pix, curlX, curlY - 1, 2, 2, 3.1, 5.6, p.rim);
  pix.set(curlX + 1, curlY - 2, p.high);
  droplet(pix, q.l - 4 - phase, y - h * .3, p);
  droplet(pix, flight ? q.l - 9 : q.r + 4, y + h * .18, p);
  droplet(pix, x + w * .21, q.t - 4, p);
  if (flight) pix.line(q.l - 9, y + h * .18 + 2, q.l - 6, y + h * .18 + 2, p.low);
}

function acid(pix: Pix, q: EffectBox, p: Palette, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const bubbles: [number, number, number][] = [
    [q.l - 4, y - h * 0.22, 2],
    [flight ? q.l - 9 : q.r + 4, y + h * 0.18, 1.5],
    [x + w * 0.2, q.t - 4 - phase, 2.5]
  ];
  bubbles.forEach(([bx, by, r]) => {
    facet(pix, [[bx - r, by], [bx - r + 1, by - r], [bx + r - 1, by - r], [bx + r, by], [bx + r - 1, by + r], [bx - r + 1, by + r]], p);
    arc(pix, bx, by, r, r, Math.PI, Math.PI * 1.65, p.rim);
    pix.set(bx - 1, by - 1, p.high);
    pix.set(bx, by, p.low);
  });
  crest(pix, x, y + h * .12, w * .52 + 1, h * .43 + 1, .24, 1.4, p);
  const drip = q.l - 3, dy = y + h * .27;
  pix.line(drip, dy, drip, dy + 3, p.mid);
  pix.line(drip - 1, dy + 3, drip + 1, dy + 3, p.low);
  pix.set(drip - 1, dy + 2, p.rim);
  pix.line(q.r + 2, y + 2, q.r + 4, y + 3, p.mid);
}

function crystal(pix: Pix, x: number, y: number, h: number, lean: number, p: Palette): void {
  facet(pix, [[x + lean, y - h], [x + 2, y - 2], [x, y], [x - 2, y - 2]], p, 0.54);
  pix.line(x + lean, y - h + 1, x - 1, y - 2, p.rim);
  pix.set(x + lean, y - h + 1, p.high);
  pix.line(x - 1, y - 2, x + 1, y - 2, p.low);
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
  // A forked frost needle reads as ice even against a pale daytime sky.
  const fx = q.l - 1, fy = q.t - 3;
  pix.line(fx - 2, fy - 1, fx + 2, fy + 1, p.rim);
  pix.line(fx, fy - 2, fx, fy + 2, p.high);
  pix.set(fx - 1, fy - 2, p.mid);
  pix.set(fx + 1, fy + 2, p.mid);
}

function fragment(pix: Pix, x: number, y: number, s: number, p: Palette): void {
  facet(pix, [[x - s, y - 1], [x - 1, y - s], [x + s, y - s + 1], [x + s, y + 1], [x, y + s], [x - s, y + 1]], p);
  if (s >= 2) {
    pix.line(x - s + 1, y - 1, x, y - s + 1, p.rim);
    pix.line(x, y + 1, x + s - 1, y, p.low);
  }
}

function mineral(pix: Pix, el: string, q: EffectBox, p: Palette, grounded: boolean, flight: boolean, phase: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const floor = grounded ? Math.min(96, q.b + 2) : y + h * 0.35;
  fragment(pix, q.l - 5, flight ? y - h * 0.18 : floor - 4, el === 'terra' ? 3 : 2.5, p);
  fragment(pix, flight ? q.l - 12 : q.r + 5, y + h * 0.13 + phase, 2, p);
  fragment(pix, flight ? q.l - 8 : q.r + 2, flight ? y + h * 0.36 : floor + 1, 1.5, p);
  if (el === 'gravidade') {
    crest(pix, x, y, w * .55 + 3, h * .5 + 2, .05, .78, p);
    arc(pix, x, y, w * .55 + 3, h * .5 + 2, 2.7, 3.65, p.mid);
    // Falling chips bend toward the centre instead of forming a starry aura.
    pix.line(q.r + 6, y - h * .2 - 3, q.r + 5, y - h * .2, p.low);
    pix.line(q.l - 6, y + h * .2, q.l - 5, y + h * .2 + 2, p.rim);
  } else if (grounded) {
    // Broken dust strokes stay beneath the body, never across its unknown shape.
    pix.line(q.l - 6, floor + 2, q.l - 2, floor + 2, p.low);
    pix.line(q.r + 1, floor + 2, q.r + 5, floor + 2, p.mid);
    pix.set(q.l - 3, floor + 1, p.rim);
    pix.set(q.r + 3, floor + 1, p.low);
  } else if (el === 'terra') {
    pix.line(q.l - 6, y + h * .4, q.l - 3, y + h * .4, p.low);
    pix.line(q.r + 3, y + h * .2 + 4, q.r + 5, y + h * .2 + 4, p.mid);
  }
  if (el === 'metal') {
    facet(pix, [[q.l - 7, y - 3], [q.l - 3, y - 5], [q.l - 4, y - 2], [q.l - 7, y - 1]], p);
    pix.sparkle(q.r + 2, q.t + 2, 2, p.rim, p.high);
  } else if (el === 'materia') {
    pix.line(q.r + 3, q.t - 2, q.r + 6, q.t - 2, p.rim);
    pix.line(q.r + 6, q.t - 2, q.r + 6, q.t + 1, p.mid);
  }
}

function wind(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean): void {
  const [x, y] = center(q), [w, h] = size(q);
  if (el === 'som') {
    // Sound travels in paired wavefronts rather than looking like solid ribbons.
    for (let i = 0; i < 2; i++) {
      const rx = w * 0.55 + 3 + i * 3, ry = h * 0.47 + i * 2;
      arc(pix, x, y, rx + 1, ry, -.55, .55, p.low);
      arc(pix, x, y, rx, ry, -0.62, 0.62, i ? p.rim : p.high);
      if (!flight) arc(pix, x, y, rx, ry, Math.PI - 0.62, Math.PI + 0.62, p.rim);
    }
    pix.line(q.r + 2, y - 1, q.r + 2, y + 1, p.mid);
    return;
  }
  const rx = w * 0.58 + 3, ry = h * 0.38 + 2;
  crest(pix, x, y - 2, rx, ry, 3.3, 5.85, p);
  crest(pix, x - 1, y + 3, rx + 2, ry + 1, .05, 1.28, p);
  arc(pix, x - 1, y + 3, rx + 3, ry + 1, 1.47, 2.75, p.rim);
  const tip = 0.05;
  const tx = x - 1 + Math.cos(tip) * (rx + 3), ty = y + 3 + Math.sin(tip) * (ry + 1);
  pix.line(tx - 2, ty + 1, tx, ty, p.rim);
  // A short hooked tip gives each stream a visible direction.
  arc(pix, tx - 2, ty - 1, 2, 2, -.4, 1.6, p.rim);
  if (flight) {
    pix.line(q.l - 10, y + 2, q.l - 5, y + 2, p.mid);
    pix.line(q.l - 8, y - 3, q.l - 4, y - 3, p.low);
  }
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
    const bx = q.r + 4, by = y + h * .27;
    // Four petal clusters and a warm centre, rather than another generic star.
    pix.line(bx - 2, by, bx + 2, by, p.mid);
    pix.line(bx, by - 2, bx, by + 2, p.rim);
    pix.set(bx - 1, by - 1, p.high); pix.set(bx + 1, by + 1, p.low);
    pix.set(bx, by, p.high);
    pix.line(q.l - 5, y - h * .1, q.l - 4, y - h * .1 - 2, p.rim);
  } else {
    const rx = q.r + 3, by = Math.min(97, q.b + 1);
    pix.line(rx, by, rx + 2, by - 3, p.low);
    pix.line(rx + 2, by - 3, rx + 5, by - 4, p.mid);
    leaf(pix, rx + 2, by - 3, 1, p);
    pix.set(rx + 2, by - 2, p.rim);
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
    if (el === 'espaco') {
      const sx = q.r + 4, sy = q.t + 1;
      facet(pix, [[sx, sy - 3], [sx + 2, sy], [sx, sy + 3], [sx - 2, sy]], p);
      pix.set(sx, sy - 1, p.high);
      pix.line(sx - 3, sy + 3, sx - 1, sy + 4, p.mid);
    } else {
      const sx = q.r + 4;
      facet(pix, [[sx - 1, y], [sx + 1, y - 3], [sx + 3, y], [sx + 1, y + 2]], p);
      pix.line(sx + 3, y - 3, sx + 5, y, p.low);
      pix.line(sx + 5, y, sx + 3, y + 2, p.mid);
    }
    return;
  }
  // Smoke has a darker body and a thin cool rim, with open gaps around the spell.
  crest(pix, x, y + 1, rx, ry, 3.55, 5.05, p);
  arc(pix, x, y + 1, rx + 1, ry, .3, 1.62, p.low);
  arc(pix, x, y, rx + 1, ry, .34, 1.08, p.mid);
  const bx = flight ? q.l - 7 : q.r + 5, by = y + h * 0.2 - phase;
  pix.line(bx, by, bx - 1, by - 2, p.mid);
  pix.set(bx - 1, by - 3, p.rim);
  if (el === 'morte') {
    const ax = q.l - 5, ay = y - h * .2;
    facet(pix, [[ax - 1, ay], [ax, ay - 3], [ax + 2, ay - 2], [ax + 1, ay + 1]], p);
    pix.line(ax - 2, ay - 3, ax - 3, ay - 5, p.low);
  }
}

/** Orbit copies get local motifs rather than miniature full-size emitters. */
function compact(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean): void {
  const [x, y] = center(q), l = Math.round(q.l) - 2, r = Math.round(q.r) + 2;
  const t = Math.round(q.t) - 2, b = Math.round(q.b) + 2;
  switch (el) {
    case 'agua':
      pix.line(l, y, l + 1, y + 2, p.mid); pix.set(l, y - 1, p.rim);
      pix.line(x, b, x + 2, b, p.rim); pix.set(x + 1, b - 1, p.high); break;
    case 'acido':
      pix.line(l, y - 1, l + 1, y - 1, p.rim); pix.set(l - 1, y, p.low);
      pix.set(l + 1, y, p.mid); pix.line(r, y + 1, r, y + 2, p.rim); break;
    case 'gelo':
      pix.line(l, y + 1, l + 1, y - 2, p.rim); pix.line(l + 1, y - 2, l + 2, y + 1, p.mid);
      pix.set(x, t, p.high); pix.set(x + 1, t + 1, p.rim); break;
    case 'terra': case 'materia': case 'metal': case 'gravidade':
      pix.line(l, y, l + 1, y - 1, p.rim); pix.line(l, y + 1, l + 1, y + 1, p.low);
      pix.line(r - 1, y + 1, r, y + 1, el === 'metal' ? p.high : p.mid);
      if (el === 'gravidade') pix.line(x - 1, b, x + 1, b, p.rim);
      else pix.set(r, y + 2, p.low); break;
    case 'vento': case 'som':
      pix.line(l, y - 1, l - 1, y, p.mid); pix.line(l - 1, y, l, y + 1, p.rim);
      pix.line(r - 1, y - 2, r, y - 1, p.rim); pix.line(r, y - 1, r, y + 1, p.high);
      if (el === 'vento') pix.line(x - 1, b, x + 1, b, p.mid); break;
    case 'natureza': case 'vida':
      pix.line(l, y + 2, l + 1, y - 1, p.low); pix.line(l, y, l - 1, y - 1, p.rim);
      pix.set(l + 1, y - 2, p.high); pix.line(r - 1, y - 1, r, y - 2, p.rim);
      if (el === 'vida') pix.set(r, y, p.high); break;
    case 'espaco': case 'ilusao':
      pix.line(l, y - 1, l + 1, y, p.rim); pix.set(l, y + 1, p.mid);
      pix.line(r, y - 1, r + 1, y, p.high); pix.line(r + 1, y, r, y + 1, p.mid); break;
    default:
      pix.line(l + 1, y - 2, l, y - 1, p.mid); pix.line(l, y - 1, l, y + 1, p.low);
      pix.line(r, y, r - 1, y + 2, p.rim); break;
  }
  if (flight) pix.set(l - 1, y + 1, p.low);
}

/**
 * Pixel accents only: the caller owns shape, placement, size and elemental rules.
 * Returns false for materials handled by the scene's other effect painters.
 */
export function paintElementAccents(pix: Pix, element: string, q: EffectBox, ramp: RGB[], seed: number, grounded: boolean, flight: boolean): boolean {
  if (!SUPPORTED.has(element)) return false;
  const r = ramp.length ? ramp : [[60, 58, 68], [130, 135, 145], [230, 235, 240]] as RGB[];
  const p: Palette = {
    low: r[Math.min(1, r.length - 1)], mid: r[Math.floor((r.length - 1) / 2)],
    rim: r[Math.max(0, r.length - 2)], high: lighten(r[r.length - 1], 0.12), ink: darken(r[0], 0.4)
  };
  // Darkness keeps a dark rim: the final white entry is for other materials.
  if (element === 'sombra' || element === 'morte') {
    p.low = darken(r[0], .15); p.mid = r[Math.min(1, r.length - 1)];
    p.rim = r[Math.min(2, Math.floor((r.length - 1) / 2))]; p.high = p.rim;
  }
  if (Math.max(q.r - q.l, q.b - q.t) < 20) {
    compact(pix, element, q, p, flight);
    return true;
  }
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
      spectral(pix, element, q, p, flight, phase); break;
    default: return false;
  }
  return true;
}
