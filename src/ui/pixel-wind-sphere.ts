import { Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

const TAU = Math.PI * 2;
const emptyBox = (x = 0, y = 0): IntentionBox => ({ l: x, t: y, r: x, b: y });
const validScale = (s: number): boolean => Number.isFinite(s) && s > 0;

/** The complete eight-pose wind coil fits inside this compact local envelope. */
export function windSphereBounds(s: number): IntentionBox {
  if (!validScale(s)) return emptyBox();
  const r = s * .95;
  return { l: -r, t: -r, r, b: r };
}

/**
 * One continuous, clockwise ribbon of air, with open channels between its turns.
 * The mint lip, jade underside and narrow eye describe a curled sheet rather
 * than a solid green ball. Geometry advances while its lighting stays anchored.
 * Returns the inclusive world bounds of the pixels actually painted.
 */
export function paintWindSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  const anchor = emptyBox(Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !validScale(s) || !ramp.length ||
      ramp.some(c => !c || c.length < 3 || c.some(v => !Number.isFinite(v)))) return anchor;
  const pose = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const turn = pose * TAU / 8, radius = s * .83, small = s < 6;
  const local = windSphereBounds(s);
  const left = Math.max(0, Math.ceil(x + local.l)), top = Math.max(0, Math.ceil(y + local.t));
  const right = Math.min(pix.w - 1, Math.floor(x + local.r)), bottom = Math.min(pix.h - 1, Math.floor(y + local.b));
  if (left > right || top > bottom) return anchor;
  const width = right - left + 1, height = bottom - top + 1;
  const nearest = new Float32Array(width * height).fill(Infinity);
  const across = new Float32Array(width * height);
  const progress = new Float32Array(width * height);
  const depth = new Float32Array(width * height).fill(-Infinity);
  // A single strip winds inward, so every visible filament has a material root.
  // Tiny copies use one broad curl rather than undersampled parallel threads.
  const steps = Math.max(48, Math.min(256, Math.ceil(s * 12)));
  const path = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, a = -.28 + turn + t * TAU * (small ? 1.18 : 1.62);
    const r = .9 - t * .74, z = Math.sin(a + .35);
    // The near shoulder is a broad, rolling sheet; the receding shoulder thins
    // into an attached filament. Its open channels remain roughly spherical.
    return { x: x + Math.cos(a) * r * radius, y: y + Math.sin(a) * r * radius, z, t };
  });
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dy = b.y - a.y;
    const squared = dx * dx + dy * dy, length = Math.sqrt(squared);
    const t = (a.t + b.t) * .5;
    // The front shoulder is substantial; the inward end narrows into a clean
    // curled tip. The minimum brush width keeps subpixel copies connected.
    const half = Math.max(.74, radius * (.105 + .04 * Math.sin(t * Math.PI) + Math.max(0, (a.z + b.z) * .5) * .055));
    const l = Math.max(left, Math.ceil(Math.min(a.x, b.x) - half));
    const r = Math.min(right, Math.floor(Math.max(a.x, b.x) + half));
    const q = Math.max(top, Math.ceil(Math.min(a.y, b.y) - half));
    const d = Math.min(bottom, Math.floor(Math.max(a.y, b.y) + half));
    for (let py = q; py <= d; py++) for (let px = l; px <= r; px++) {
      const at = squared ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / squared)) : 0;
      const ex = px - a.x - dx * at, ey = py - a.y - dy * at;
      const distance = Math.hypot(ex, ey) / half, index = (py - top) * width + px - left;
      const z = a.z + (b.z - a.z) * at;
      if (distance > 1 || z < depth[index] - .08 || (Math.abs(z - depth[index]) <= .08 && distance >= nearest[index])) continue;
      nearest[index] = distance;
      across[index] = length ? (dx * ey - dy * ex) / (length * half) : 0;
      progress[index] = a.t + (b.t - a.t) * at;
      depth[index] = z;
    }
  }
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const i = (py - top) * width + px - left;
    if (nearest[i] > 1) continue;
    const u = (px - x) / radius, v = (py - y) / radius;
    const edge = across[i], t = progress[i];
    let tone = edge > .46 ? .24 : edge > -.18 ? .49 : .72;
    if (!small && depth[i] < -.15) tone = edge < -.3 ? .48 : .23;
    if (!small && u > .15 && v < .2) tone = Math.min(tone, .48);
    // Fixed underside lighting keeps the rotation from looking like a flat
    // spinning emblem. Jade occupies the curl's inner wall and lower shoulder.
    if (u + v > .58 && edge > -.5) tone = Math.min(tone, .35);
    if (edge > .77) tone = .08;
    // Only a short leading lip reaches the palest colour; there is no white
    // centre or complete white outline. The short glint travels with the curl.
    if (!small && edge < -.58 && t > .13 && t < .24) tone = .96;
    if (!small && edge < -.62 && t > .57 && t < .77) tone = .78;
    if (small && u + v < -.25 && edge < .15) tone = .76;
    pix.set(px, py, ramp[Math.round(Math.max(0, Math.min(1, tone)) * (ramp.length - 1))]);
    bounds.l = Math.min(bounds.l, px); bounds.t = Math.min(bounds.t, py);
    bounds.r = Math.max(bounds.r, px); bounds.b = Math.max(bounds.b, py);
  }
  return Number.isFinite(bounds.l) ? bounds : anchor;
}
