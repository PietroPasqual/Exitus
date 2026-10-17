import { darken, lighten, mixRGB, rgb, type Pix, type RGB } from './pixel';

/** Existing body bounds; these painters never move or resize the spell itself. */
export interface StructureBox { l: number; t: number; r: number; b: number }

type Point = [number, number];
const center = (q: StructureBox): Point => [(q.l + q.r) / 2, (q.t + q.b) / 2];

function corner(pix: Pix, x: number, y: number, sx: number, sy: number, c: RGB, n = 3): void {
  pix.line(x, y, x + sx * n, y, c);
  pix.line(x, y, x, y + sy * n, c);
}

/** State holds an existing manifestation steady, rather than enclosing it in a cage. */
export function paintState(pix: Pix, q: StructureBox, groundY: number): void {
  const gold = rgb('#d8ad57'), high = rgb('#fff0b6'), low = rgb('#8c6b36');
  const [x] = center(q), l = q.l - 3, r = q.r + 3, t = q.t - 3, b = q.b + 3;
  corner(pix, l, t, 1, 1, gold);
  corner(pix, r, t, -1, 1, low);
  corner(pix, l, b, 1, -1, gold);
  corner(pix, r, b, -1, -1, gold);
  pix.set(l + 1, t, high);
  pix.set(r - 1, b, high);
  // A short, level energy support reads as stability even for a floating body.
  const y = Math.abs(q.b - groundY) < 7 ? groundY + 1 : b + 1;
  pix.line(x - 4, y, x + 4, y, low);
  pix.line(x - 2, y - 1, x + 2, y - 1, gold);
  pix.set(x, y - 1, high);
}

/** Guides occupy only the axis constrained by the D.N. rune. */
export function paintGuard(pix: Pix, q: StructureBox, kind: 'vertical' | 'lateral'): void {
  const c = rgb('#9ad7ff'), high = rgb('#e7f5ff'), low = rgb('#46748f');
  const [cx, cy] = center(q);
  if (kind === 'vertical') {
    const half = Math.min(18, Math.max(6, (q.r - q.l) * 0.55));
    for (const side of [-1, 1]) {
      const y = side < 0 ? q.t - 5 : q.b + 5;
      // Broken rails and a middle pressure mark, with the small hooks facing in.
      pix.line(cx - half, y, cx - 3, y, c);
      pix.line(cx + 3, y, cx + half, y, c);
      pix.line(cx - half, y, cx - half, y - side * 2, low);
      pix.line(cx + half, y, cx + half, y - side * 2, low);
      pix.line(cx - 1, y + side * 2, cx + 1, y + side * 2, low);
      pix.set(cx, y, high);
      pix.set(cx, y - side, c);
    }
  } else {
    const half = Math.min(15, Math.max(6, (q.b - q.t) * 0.55));
    for (const side of [-1, 1]) {
      const x = side < 0 ? q.l - 5 : q.r + 5;
      pix.line(x, cy - half, x, cy - 3, c);
      pix.line(x, cy + 3, x, cy + half, c);
      pix.line(x, cy - half, x - side * 2, cy - half, low);
      pix.line(x, cy + half, x - side * 2, cy + half, low);
      pix.line(x + side * 2, cy - 1, x + side * 2, cy + 1, low);
      pix.set(x, cy, high);
      pix.set(x - side, cy, c);
    }
  }
}

function ellipsePoint(c: Point, rx: number, ry: number, a: number): Point {
  return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry];
}

function orbitStroke(pix: Pix, c: Point, rx: number, ry: number, from: number, to: number, color: RGB): void {
  const n = Math.max(3, Math.ceil((to - from) * Math.max(rx, ry) * 1.4));
  for (let k = 0; k <= n; k++) {
    const p = ellipsePoint(c, rx, ry, from + (to - from) * k / n);
    pix.set(p[0], p[1], color);
  }
}

/** The guide supports the orbit; moving bodies and attached wakes carry motion.
 * Both halves are painted behind their corresponding bodies, never over them.
 */
export function paintOrbitArc(pix: Pix, c: Point, rx: number, ry: number, color: RGB, half: 'back' | 'front'): void {
  const back = half === 'back';
  const base = darken(color, back ? .66 : .48);
  const intervals = back ? [[3.3, 3.8], [4.3, 4.7], [5.2, 5.8]] : [[.16, .65], [1.18, 1.62], [2.17, 2.7]];
  intervals.forEach(([a, b]) => orbitStroke(pix, c, rx, ry, a, b, base));
}

/** Local contact and remote projection deliberately use different footprints. */
export function paintSurfaceContact(pix: Pix, q: StructureBox, kind: 'touch' | 'far', ramp: RGB[], groundY: number): void {
  const colors: RGB[] = ramp.length ? ramp : [[52, 77, 86], [119, 175, 188], [226, 246, 248]];
  const mid = colors[Math.floor((colors.length - 1) / 2)], rim = colors[Math.max(0, colors.length - 2)];
  const high = lighten(colors[colors.length - 1], 0.1), low = mixRGB(colors[0], mid, 0.3);
  const [x] = center(q);
  if (kind === 'touch') {
    const radius = Math.max(3, Math.min(7, (q.r - q.l) * 0.22));
    const y = groundY;
    // One compact contact point: no wide shock wave or burst suggesting an attack.
    pix.ellipse(x, y + 1, radius, 1.3, low, 'front');
    pix.line(x - radius, y, x - 2, y, rim);
    pix.line(x + 2, y, x + radius, y, rim);
    pix.line(x, y - 2, x, y, high);
    pix.line(x - 1, y - 1, x + 1, y - 1, high);
    pix.set(x, y + 1, mid);
    return;
  }
  // The remote surface receives a projected boundary around the manifestation.
  // Only its corners are bright, so the material's shape remains the focal point.
  const l = q.l - 3, r = q.r + 3, t = q.t - 3, b = Math.min(groundY, q.b + 3);
  const n = Math.max(2, Math.min(5, (q.r - q.l) * 0.18));
  corner(pix, l, t, 1, 1, rim, n);
  corner(pix, r, t, -1, 1, mid, n);
  corner(pix, l, b, 1, -1, mid, n);
  corner(pix, r, b, -1, -1, rim, n);
  // A slanted baseline shows the receiving surface instead of radial impact rays.
  const foot = Math.min(groundY + 1, q.b + 4), span = Math.max(5, Math.min(17, (q.r - q.l) * 0.6));
  pix.line(x - span, foot, x - span + 3, foot - 2, low);
  pix.line(x - span + 3, foot - 2, x - 3, foot - 2, mid);
  pix.line(x + 3, foot - 2, x + span - 2, foot - 2, mid);
  pix.line(x + span - 2, foot - 2, x + span, foot, rim);
  pix.line(x - 2, foot, x + 2, foot, high);
  pix.set(x - 1, foot - 1, rim);
  pix.set(x + 1, foot - 1, rim);
}
