import { inPoly, type Pix, type RGB } from './pixel';
import { seeded } from './sketch';

/** Decoration follows the body bounds; it never changes the body's geometry. */
export interface RadianceBox { l: number; t: number; r: number; b: number }
type Point = [number, number];

interface Brush {
  compact: boolean;
  w: number;
  h: number;
  set(x: number, y: number, color: RGB): void;
  line(a: Point, b: Point, color: RGB): void;
  polygon(points: Point[], color: RGB): void;
}

/** Clip while drawing, including on ordinary spells which have no separate layer. */
function brush(pix: Pix, q: RadianceBox): Brush | null {
  if (![q.l, q.t, q.r, q.b].every(v => Number.isFinite(v) && Math.abs(v) <= 1e6) || q.r < q.l || q.b < q.t) return null;
  const w = Math.max(1, q.r - q.l), h = Math.max(1, q.b - q.t);
  const compact = Math.max(w, h) < 20, reach = compact ? 3 : 12;
  const l = Math.max(0, Math.floor(q.l - reach)), r = Math.min(pix.w - 1, Math.ceil(q.r + reach));
  const t = Math.max(0, Math.floor(q.t - reach)), b = Math.min(pix.h - 1, Math.ceil(q.b + reach));
  if (l > r || t > b) return null;
  const set = (x: number, y: number, color: RGB): void => {
    x = Math.round(x); y = Math.round(y);
    if (x >= l && x <= r && y >= t && y <= b) pix.set(x, y, color);
  };
  const line = (a: Point, z: Point, color: RGB): void => {
    // Clip before rasterizing: even an outlying imported box must cost no more
    // than a line across this small scene, rather than walking invisible pixels.
    const vx = z[0] - a[0], vy = z[1] - a[1];
    let lo = 0, hi = 1;
    for (const [direction, distance] of [[-vx, a[0] - l], [vx, r - a[0]], [-vy, a[1] - t], [vy, b - a[1]]]) {
      if (!direction) { if (distance < 0) return; continue; }
      const u = distance / direction;
      if (direction < 0) lo = Math.max(lo, u); else hi = Math.min(hi, u);
      if (lo > hi) return;
    }
    let x = Math.round(a[0] + vx * lo), y = Math.round(a[1] + vy * lo);
    const x1 = Math.round(a[0] + vx * hi), y1 = Math.round(a[1] + vy * hi);
    const dx = Math.abs(x1 - x), dy = -Math.abs(y1 - y), sx = x < x1 ? 1 : -1, sy = y < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      set(x, y, color);
      if (x === x1 && y === y1) break;
      const e = error * 2;
      if (e >= dy) { error += dy; x += sx; }
      if (e <= dx) { error += dx; y += sy; }
    }
  };
  return {
    compact, w, h, set, line,
    polygon(points, color) {
      const left = Math.max(l, Math.floor(Math.min(...points.map(p => p[0]))));
      const right = Math.min(r, Math.ceil(Math.max(...points.map(p => p[0]))));
      const top = Math.max(t, Math.floor(Math.min(...points.map(p => p[1]))));
      const bottom = Math.min(b, Math.ceil(Math.max(...points.map(p => p[1]))));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++)
        if (inPoly(points, x + .5, y + .5)) set(x, y, color);
    }
  };
}

const tone = (ramp: RGB[], value: number): RGB => ramp[Math.round(Math.max(0, Math.min(1, value)) * (ramp.length - 1))];
const center = (q: RadianceBox): Point => [(q.l + q.r) / 2, (q.t + q.b) / 2];
const cycle = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const drift = (frame: number): number => [0, -1, -2, -1, 0, 1, 2, 1][frame];
function chain(b: Brush, points: Point[], color: RGB): void {
  for (let i = 1; i < points.length; i++) b.line(points[i - 1], points[i], color);
}

/** Curled tongues have a warm outer edge and a short, bright inner fold. */
export function paintFireWisps(pix: Pix, q: RadianceBox, flight: boolean, seed: number, ramp: RGB[], frame = 0): void {
  const b = brush(pix, q);
  if (!b || !ramp.length) return;
  const rand = seeded(`fire-wisps:${seed}`), count = b.compact ? 2 : 3, sway = drift(cycle(frame)) * (b.compact ? .3 : .65);
  const length = b.compact ? 4 : Math.min(10, 5 + Math.max(b.w, b.h) * .13);
  for (let i = 0; i < count; i++) {
    const k = (i + .65) / (count + .3), curl = (i % 2 ? -1.6 : 1.7) + sway * (i % 2 ? -.7 : 1);
    const x = flight ? q.l + 1 : q.l + b.w * k;
    const y = flight ? q.t + b.h * k : q.t + 1;
    const len = length * (.76 + rand() * .24), width = b.compact ? 1.25 : 2.5;
    const at = (u: number, v: number): Point => flight ? [x + v, y + u] : [x + u, y + v];
    const outer = [[-width, 1], [-width, -len * .28], [curl - 1, -len * .55], [curl + 1, -len],
      [curl + 2, -len * .66], [width, -len * .25], [width, 1]].map(([u, v]) => at(u, v));
    b.polygon(outer, tone(ramp, .37));
    b.polygon([[0, 1], [-width + 1, -len * .24], [curl, -len * .68], [1, -len * .3], [width - .3, 1]].map(([u, v]) => at(u, v)), tone(ramp, .64));
    chain(b, [at(0, 0), at(-.5, -len * .2), at(curl * .6, -len * .43)], tone(ramp, .84));
  }
}

/** Detached two-tone cinders suggest movement without a field of white stars. */
export function paintEmbers(pix: Pix, q: RadianceBox, ramp: RGB[], seed: number, flight: boolean, frame = 0): void {
  const b = brush(pix, q);
  if (!b || !ramp.length) return;
  const rand = seeded(`embers:${seed}`), count = b.compact ? 2 : 3, f = cycle(frame);
  const rise = Math.floor(f / (b.compact ? 4 : 2));
  for (let i = 0; i < count; i++) {
    const k = (i + .4) / count, distance = b.compact ? 2 : 4 + rand() * 5;
    const x = Math.round((flight ? q.l - distance : q.l + b.w * k + rand() * 2) - (flight ? rise : 0));
    const y = Math.round((flight ? q.t + b.h * k : q.t - distance) - rise);
    // Only the last cinder fades before respawning; the whole effect never blinks.
    if (f === 7 && i === count - 1) continue;
    b.set(x, y, tone(ramp, .84 - (f >= 5 ? .18 : 0)));
    b.set(x + 1, y + 1, tone(ramp, .47));
    if (!b.compact && i === 1) b.set(x, y + 1, tone(ramp, .64));
  }
}

/** Lightning grows through irregular channels; light diffracts into thin facets. */
export function paintRadiance(pix: Pix, q: RadianceBox, ramp: RGB[], seed: number, radiant = false, frame = 0): void {
  const b = brush(pix, q);
  if (!b || !ramp.length) return;
  const rand = seeded(`${radiant ? 'diffraction' : 'lightning'}:${seed}`), [x, y] = center(q), f = cycle(frame);
  const rx = b.w / 2, ry = b.h / 2, reach = b.compact ? 3 : Math.min(10, 4 + Math.max(b.w, b.h) * .14);
  const angles = radiant ? [-1.4, -.28, 1.18, 2.85] : [-1.22, .29, 2.6];
  for (let i = 0; i < (b.compact ? 2 : angles.length); i++) {
    const angle = angles[i] + (rand() - .5) * .24, co = Math.cos(angle), si = Math.sin(angle);
    const start: Point = [x + co * (rx + .6), y + si * (ry + .6)];
    const length = reach * (.72 + rand() * .28) + (radiant ? drift(f) * (b.compact ? .2 : .45) : 0);
    const end: Point = [start[0] + co * length, start[1] + si * length];
    if (radiant) {
      // Narrow asymmetric shards rather than a regular star around every body.
      const spread = b.compact ? .7 : 1.2;
      b.polygon([[start[0] - si * spread, start[1] + co * spread], end,
        [start[0] + si * spread, start[1] - co * spread]], tone(ramp, .53));
      b.line(start, [end[0] - co, end[1] - si], tone(ramp, .86));
      b.set(start[0], start[1], tone(ramp, 1));
      continue;
    }
    const n = b.compact ? 3 : 5, points: Point[] = [start];
    for (let k = 1; k < n; k++) {
      const u = k / n, kink = (k % 2 ? 1 : -1) * ((b.compact ? .8 : 1.2 + rand()) + (f === 4 ? .9 : 0));
      points.push([start[0] + co * length * u - si * kink, start[1] + si * length * u + co * kink]);
    }
    points.push(end);
    // One darker shoulder and a discontinuous high core give the bolt thickness.
    chain(b, points.map(p => [p[0] + 1, p[1]]), tone(ramp, .5));
    chain(b, points, tone(ramp, .83));
    b.line(points[0], points[1], tone(ramp, 1));
    if (!b.compact) {
      const joint = points[2], branchAngle = angle + (i % 2 ? -.92 : .9);
      const branch: Point = [joint[0] + Math.cos(branchAngle) * length * .5, joint[1] + Math.sin(branchAngle) * length * .5];
      chain(b, [joint, [joint[0] + co * 1.2, joint[1] + si * 1.2], branch], tone(ramp, .66));
      b.set(branch[0], branch[1], tone(ramp, .83));
    }
  }
  if (radiant && !b.compact) {
    const px = q.r + 3, py = q.t - 3 + Math.round(drift(f) / 2);
    b.line([px - 1, py], [px + 1, py], tone(ramp, .66));
    b.line([px, py - 2], [px, py + 1], tone(ramp, .83));
    b.set(px, py, tone(ramp, 1));
  }
}

/** Small motifs distinguish abstract energies without turning darkness silver. */
export function paintEnergyAccents(pix: Pix, el: string, q: RadianceBox, ramp: RGB[], seed: number, frame = 0): void {
  const b = brush(pix, q);
  if (!b || !ramp.length) return;
  const rand = seeded(`energy-accents:${el}:${seed}`), [x, y] = center(q), sway = drift(cycle(frame));
  const dark = el === 'sombra' || el === 'morte' || el === 'vazio';
  const count = b.compact ? 2 : 3, reach = b.compact ? 2 : 4;
  for (let i = 0; i < count; i++) {
    const angle = [-2.25, .55, -1.05][i] + (rand() - .5) * .35;
    const px = Math.round(x + Math.cos(angle) * (b.w / 2 + reach) + sway * (i % 2 ? .4 : -.4));
    const py = Math.round(y + Math.sin(angle) * (b.h / 2 + reach) - Math.abs(sway) * .4);
    if (dark) {
      const s = b.compact ? 1 : 2, direction = i % 2 ? -1 : 1;
      const fold: Point[] = [[px - 2, py + s], [px - 1, py], [px + 1, py], [px + 2, py - s], [px + 1, py - s - 1]];
      chain(b, fold, tone(ramp, el === 'vazio' ? .04 : .19));
      b.line([px - 1, py + s * direction], [px + 1, py + s * direction], tone(ramp, el === 'morte' ? .35 : .2));
    } else if (el === 'vida' || el === 'natureza') {
      const s = b.compact ? 1 : 2;
      b.polygon([[px - s, py], [px, py - s], [px + s + 1, py], [px, py + 1]], tone(ramp, .48));
      b.line([px - s, py], [px, py - 1], tone(ramp, .72));
      b.set(px + s, py + 1, tone(ramp, .25));
    } else {
      const direction = i % 2 ? -1 : 1;
      chain(b, [[px - 2, py + direction], [px - 1, py], [px + 1, py], [px + 2, py - direction]], tone(ramp, .49));
      b.set(px, py - direction, tone(ramp, .76));
    }
  }
}
