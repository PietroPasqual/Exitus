import { darken, inPoly, lighten, type Pix, type RGB } from './pixel';
import { seeded } from './sketch';

/** Bounds of the existing spell body, in the scene's logical pixels. */
export interface EffectBox { l: number; t: number; r: number; b: number }

type Point = [number, number];
interface Palette { low: RGB; mid: RGB; rim: RGB; high: RGB; ink: RGB }
const SUPPORTED = new Set(['agua', 'acido', 'gelo', 'terra', 'materia', 'gravidade', 'metal', 'vento', 'som', 'natureza', 'vida', 'sombra', 'morte', 'espaco', 'ilusao']);

const center = (q: EffectBox): Point => [(q.l + q.r) / 2, (q.t + q.b) / 2];
const size = (q: EffectBox): Point => [Math.max(4, q.r - q.l), Math.max(4, q.b - q.t)];
const cycle = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const relative = (values: readonly number[], frame: number, offset = 0): number => values[cycle(frame + offset)] - values[cycle(offset)];
// Flow fronts advance and respawn. A plant or dark fold instead holds its pose
// for two frames; none of these clocks depends on call order or wall time.
const advance = (frame: number, offset: number, step = 1): number => (cycle(frame + offset) - cycle(offset)) * step;
const fold = [0, 0, 1, 1, 1, 1, 0, 0] as const;
const leafTurn = [0, -.5, -1, -.5, 0, .5, .5, 0] as const;
const fall = [0, 0, 1, 2, 3, 4, 6, 8] as const;

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

function water(pix: Pix, q: EffectBox, p: Palette, flight: boolean, phase: number, frame: number, offset: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  // The crest's light-catching head travels along the ellipse, while its tail
  // thins. The second crest follows with a different age, never a mirrored bob.
  const wave = advance(frame, offset, .14), second = advance(frame, offset + 3, .12);
  const tail = [0, .08, .12, .06, 0, -.12, -.2, -.12][cycle(frame + offset)];
  crest(pix, x, y + 1, w * .54 + 2, h * .48 + 2, .17 + wave, 1.14 + wave + tail, p);
  crest(pix, x - 1, y, w * .54 + 2, h * .48 + 2, 1.55 + second, 2.72 + second - tail * .5, p);
  const curlX = q.l - 3, curlY = y + h * .2 + relative(fold, frame, offset) * .5;
  arc(pix, curlX, curlY, 3, 3, 2.5, 5.9, p.mid);
  arc(pix, curlX, curlY - 1, 2, 2, 3.1 + wave, 5.6 + wave, p.rim);
  pix.set(curlX + 1, curlY - 2, p.high);
  const drops: [number, number][] = [[q.l - 4 - phase, y - h * .3], [flight ? q.l - 9 : q.r + 4, y + h * .18], [x + w * .21, q.t - 4]];
  drops.forEach(([dx, dy], i) => {
    const start = cycle(offset + i * 3), age = cycle(frame + start);
    const descent = fall[age] * (i === 2 ? .42 : .7) - (i === 2 ? 1 : 2);
    const xx = dx - (flight ? advance(frame, start, .35) : 0), yy = i === 2 ? Math.min(q.t - 2, dy + descent) : dy + descent;
    if (age >= 6) {
      // A falling bead spreads into a short splash; it doesn't rise backwards.
      pix.line(xx - 1, yy + 1, xx + 1, yy + 1, p.mid);
      if (age === 6) pix.set(xx, yy, p.rim);
    } else droplet(pix, xx, yy, p);
  });
  if (flight) pix.line(q.l - 9, y + h * .18 + 2, q.l - 6, y + h * .18 + 2, p.low);
}

function acid(pix: Pix, q: EffectBox, p: Palette, flight: boolean, phase: number, frame: number, offset: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const rise = [0, 1, 2, 3, 4, 1, 0, 0][cycle(frame + offset)], wave = advance(frame, offset, .045);
  const bubbles: [number, number, number][] = [
    [q.l - 4, y - h * 0.22, 2],
    [flight ? q.l - 9 : q.r + 4, y + h * 0.18, 1.5],
    [x + w * 0.2, q.t - 4 - phase, 2.5]
  ];
  bubbles.forEach(([bx, originY, radius], i) => {
    const start = cycle(offset + i * 3), age = cycle(frame + start);
    const by = originY - age * .4, r = radius + (age > 3 && age < 6 ? .5 : 0);
    if (age >= 6) {
      arc(pix, bx, by, r, r * .55, 3.3, 4.8, p.rim);
      pix.line(bx + r - 1, by, bx + r, by + 1, p.low);
      return;
    }
    facet(pix, [[bx - r, by], [bx - r + 1, by - r], [bx + r - 1, by - r], [bx + r, by], [bx + r - 1, by + r], [bx - r + 1, by + r]], p);
    arc(pix, bx, by, r, r, Math.PI, Math.PI * 1.65, p.rim);
    pix.set(bx - 1, by - 1, p.high);
    pix.set(bx, by, p.low);
  });
  crest(pix, x, y + h * .12, w * .52 + 1, h * .43 + 1, .24 + wave, 1.4 + wave, p);
  const drip = q.l - 3, dy = y + h * .27;
  pix.line(drip, dy, drip, dy + 3 + rise, p.mid);
  pix.line(drip - 1, dy + 3 + rise, drip + 1, dy + 3 + rise, p.low);
  pix.set(drip - 1, dy + 2 + rise, p.rim);
  pix.line(q.r + 2, y + 2, q.r + 4, y + 3, p.mid);
}

function crystal(pix: Pix, x: number, y: number, h: number, lean: number, p: Palette, glint = 0, shining = true): void {
  facet(pix, [[x + lean, y - h], [x + 2, y - 2], [x, y], [x - 2, y - 2]], p, 0.54);
  pix.line(x + lean, y - h + 1, x - 1, y - 2, p.rim);
  pix.set(x + lean * (1 - glint / Math.max(1, h - 2)), y - h + 1 + glint, shining ? p.high : p.rim);
  pix.line(x - 1, y - 2, x + 1, y - 2, p.low);
}

function ice(pix: Pix, q: EffectBox, p: Palette, grounded: boolean, flight: boolean, frame: number, offset: number): void {
  const [, y] = center(q), [, h] = size(q);
  const bottom = grounded ? Math.min(96, q.b + 2) : y + h * 0.22;
  // Three readable shards replace the old ring of six identical snow pixels.
  const glint = Math.floor(cycle(frame + offset) / 3);
  const secondGlint = Math.floor(cycle(frame + offset + 3) / 2);
  crystal(pix, q.l - 4, y - h * 0.15, 5, -2, p, glint, cycle(frame + offset) < 2);
  crystal(pix, flight ? q.l - 10 : q.r + 4, bottom, grounded ? 8 : 6, 2, p, secondGlint, cycle(frame + offset + 3) < 2);
  crystal(pix, q.r - 1, q.t - 3, 4, 1, p, Math.min(1, secondGlint), cycle(frame + offset + 5) < 2);
  if (grounded) {
    crystal(pix, q.l - 1, bottom + 1, 5, -1, p, glint, cycle(frame + offset + 5) < 2);
    pix.line(q.l - 5, bottom + 1, q.l + 1, bottom + 1, p.rim);
  }
  // A forked frost needle reads as ice even against a pale daytime sky.
  const fx = q.l - 1, fy = q.t - 3;
  pix.line(fx - 2, fy - 1, fx + 2, fy + 1, p.rim);
  pix.line(fx, fy - 2, fx, fy + 2, cycle(frame + offset) < 2 ? p.high : p.rim);
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

function mineral(pix: Pix, el: string, q: EffectBox, p: Palette, grounded: boolean, flight: boolean, phase: number, frame: number, offset: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const floor = grounded ? Math.min(96, q.b + 2) : y + h * 0.35;
  const bob = el === 'gravidade' ? relative(fold, frame, offset) * .5 : 0;
  fragment(pix, q.l - 5, (flight ? y - h * 0.18 : floor - 4) + bob, el === 'terra' ? 3 : 2.5, p);
  fragment(pix, flight ? q.l - 12 : q.r + 5, y + h * 0.13 + phase - bob, 2, p);
  fragment(pix, flight ? q.l - 8 : q.r + 2, (flight ? y + h * 0.36 : floor + 1) + bob, 1.5, p);
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
    // A glint crosses one facet, rather than making every chip hover or blink.
    const age = cycle(frame + offset);
    const gx = q.r + 1 + Math.floor(age / 3), gy = q.t + 1 + Math.floor(age / 4);
    pix.line(gx - 1, gy, gx + 1, gy, p.rim);
    pix.set(gx, gy - 1, age < 2 ? p.high : p.mid);
  } else if (el === 'materia') {
    pix.line(q.r + 3, q.t - 2, q.r + 6, q.t - 2, p.rim);
    pix.line(q.r + 6, q.t - 2, q.r + 6, q.t + 1, p.mid);
    pix.set(q.r + 3 + Math.min(3, Math.floor(cycle(frame + offset) / 2)), q.t - 2, p.mid);
  } else if (el === 'terra') {
    const glint = Math.floor(cycle(frame + offset) / 3);
    pix.line(q.l - 6 + glint, (flight ? y - h * .18 : floor - 4) - 2, q.l - 5 + glint, (flight ? y - h * .18 : floor - 4) - 2, p.mid);
  }
}

function wind(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean, frame: number, offset: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  // Fade the ends of a band's own life, not a global frame. It respawns while
  // short and dim, so a full-strength arc never teleports back across the body.
  const envelope = [.2, .5, .8, 1, 1, .8, .5, .2];
  const aged = (age: number): Palette => age === 0 || age === 7
    ? { ...p, rim: p.mid, high: p.rim } : p;
  if (el === 'som') {
    for (let i = 0; i < 2; i++) {
      const age = cycle(frame + offset + i * 4), palette = aged(age);
      const rx = w * .55 + 3 + i * 3 + (age - 3.5) * .55, ry = h * .47 + i * 2;
      const span = .62 * (.6 + envelope[age] * .4);
      arc(pix, x, y, rx + 1, ry, -span * .9, span * .9, palette.low);
      arc(pix, x, y, rx, ry, -span, span, i || age > 3 ? palette.rim : palette.high);
      if (!flight) arc(pix, x, y, rx, ry, Math.PI - span, Math.PI + span, palette.rim);
    }
    pix.line(q.r + 2, y - 1, q.r + 2, y + 1, p.mid);
    return;
  }
  const rx = w * .58 + 3, ry = h * .38 + 2;
  const upperAge = cycle(frame + offset), lowerAge = cycle(frame + offset + 3), wakeAge = cycle(frame + offset + 5);
  const upper = (upperAge - 3.5) * .65, lower = (lowerAge - 3.5) * .65, wake = (wakeAge - 3.5) * .65;
  const upperSpan = 1.275 * envelope[upperAge], lowerSpan = .615 * envelope[lowerAge], wakeSpan = .64 * envelope[wakeAge];
  crest(pix, x + upper, y - 2, rx, ry, 4.575 - upperSpan, 4.575 + upperSpan, aged(upperAge));
  crest(pix, x - 1 + lower, y + 3, rx + 2, ry + 1, .665 - lowerSpan, .665 + lowerSpan, aged(lowerAge));
  arc(pix, x - 1 + wake, y + 3, rx + 3, ry + 1, 2.11 - wakeSpan, 2.11 + wakeSpan, aged(wakeAge).rim);
  // The leading hook disappears with its ribbon, rather than remaining a
  // stationary bright dot while the rest of the band starts over.
  if (lowerAge > 0 && lowerAge < 7) {
    const tip = .665 - lowerSpan, tx = x - 1 + lower + Math.cos(tip) * (rx + 3), ty = y + 3 + Math.sin(tip) * (ry + 1);
    pix.line(tx - 2, ty + 1, tx, ty, p.rim);
    arc(pix, tx - 2, ty - 1, 2, 2, -.4, 1.6, p.rim);
  }
  if (flight) {
    pix.line(q.l - 9 + wake, y + 2, q.l - 9 + wake + 5 * envelope[wakeAge], y + 2, aged(wakeAge).mid);
    pix.line(q.l - 7 + upper, y - 3, q.l - 7 + upper + 4 * envelope[upperAge], y - 3, p.low);
  }
}

function leaf(pix: Pix, x: number, y: number, dir: number, p: Palette, sway = 0): void {
  facet(pix, [[x, y], [x + dir * 2, y - 3 + sway * .5], [x + dir * 5, y - 3 + sway], [x + dir * 4, y - 1 + sway * .5]], p, 0.56);
  pix.line(x + dir, y - 1, x + dir * 3, y - 2 + sway * .5, p.high);
}

function organic(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean, frame: number, offset: number): void {
  const [, y] = center(q), [, h] = size(q);
  const lx = q.l - 3, ly = y + h * 0.34;
  pix.line(lx, ly, lx - 2, ly - 5, p.low);
  pix.line(lx - 2, ly - 5, lx - 1, ly - 8, p.mid);
  const sway = relative(leafTurn, frame, offset);
  leaf(pix, lx - 2, ly - 4, -1, p, sway);
  leaf(pix, lx - 1, ly - 7, 1, p, relative(leafTurn, frame, offset + 2));
  leaf(pix, flight ? q.l - 9 : q.r + 2, y - h * 0.26, flight ? -1 : 1, p, sway);
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
    leaf(pix, rx + 2, by - 3, 1, p, sway);
    pix.set(rx + 2, by - 2, p.rim);
  }
}

function spectral(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean, phase: number, frame: number, offset: number): void {
  const [x, y] = center(q), [w, h] = size(q);
  const rx = w * 0.55 + 3, ry = h * 0.46 + 3;
  const wave = (el === 'espaco' || el === 'ilusao') ? advance(frame, offset, .045) : relative(fold, frame, offset) * .09;
  if (el === 'espaco' || el === 'ilusao') {
    arc(pix, x - 1, y, rx, ry * 0.63, 0.18 + wave, 1.33 + wave, p.high);
    arc(pix, x - 1, y, rx, ry * 0.63, 2.85 + wave, 4.65 + wave, p.mid);
    arc(pix, x + 2, y - 2, rx + 1, ry * 0.65, 4.86 + wave, 5.97 + wave, p.rim);
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
  crest(pix, x, y + 1, rx, ry, 3.55 + wave, 5.05 + wave, p);
  arc(pix, x, y + 1, rx + 1, ry, .3 + wave, 1.62 + wave, p.low);
  arc(pix, x, y, rx + 1, ry, .34 + wave, 1.08 + wave, p.mid);
  const bx = flight ? q.l - 7 : q.r + 5, by = y + h * 0.2 - phase - relative(fold, frame, offset + 3);
  pix.line(bx, by, bx - 1, by - 2, p.mid);
  pix.set(bx - 1, by - 3, p.rim);
  if (el === 'morte') {
    const ax = q.l - 5, ay = y - h * .2;
    facet(pix, [[ax - 1, ay], [ax, ay - 3], [ax + 2, ay - 2], [ax + 1, ay + 1]], p);
    pix.line(ax - 2, ay - 3, ax - 3, ay - 5, p.low);
  }
}

/** Orbit copies get local motifs rather than miniature full-size emitters. */
function compact(pix: Pix, el: string, q: EffectBox, p: Palette, flight: boolean, frame: number, offset: number): void {
  const middle = center(q), age = cycle(frame + offset);
  const dark = el === 'sombra' || el === 'morte', mineral = ['gelo', 'terra', 'materia', 'metal', 'gravidade'].includes(el);
  const flow = Math.max(-1, Math.min(1, advance(frame, offset, .5)));
  const stepX = dark ? relative(fold, frame, offset) : mineral ? 0 : flow;
  const stepY = el === 'agua' || el === 'acido' ? Math.max(-1, Math.min(1, advance(frame, offset + 3, .4))) : dark ? -relative(fold, frame, offset + 2) : mineral ? 0 : relative(leafTurn, frame, offset);
  const x = middle[0] + stepX, y = middle[1] + stepY, l = Math.round(q.l) - 2, r = Math.round(q.r) + 2;
  if (mineral) p = { ...p, high: age < 2 ? p.high : p.rim, rim: age < 4 ? p.rim : p.mid };
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
export function paintElementAccents(pix: Pix, element: string, q: EffectBox, ramp: RGB[], seed: number, grounded: boolean, flight: boolean, frame = 0): boolean {
  if (!SUPPORTED.has(element)) return false;
  const f = cycle(frame), offset = Math.floor(seeded(`element-clock:${element}:${seed}`)() * 8);
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
    compact(pix, element, q, p, flight, f, offset);
    return true;
  }
  // Tiny seeded offsets vary clusters without scattering particles over the scene.
  const phase = seeded(`element-accents:${element}:${seed}`)() * 2 - 1;
  switch (element) {
    case 'agua': water(pix, q, p, flight, phase, f, offset); break;
    case 'acido': acid(pix, q, p, flight, phase, f, offset); break;
    case 'gelo': ice(pix, q, p, grounded, flight, f, offset); break;
    case 'terra': case 'materia': case 'gravidade': case 'metal':
      mineral(pix, element, q, p, grounded, flight, phase, f, offset); break;
    case 'vento': case 'som': wind(pix, element, q, p, flight, f, offset); break;
    case 'natureza': case 'vida': organic(pix, element, q, p, flight, f, offset); break;
    case 'sombra': case 'morte': case 'espaco': case 'ilusao':
      spectral(pix, element, q, p, flight, phase, f, offset); break;
    default: return false;
  }
  return true;
}
