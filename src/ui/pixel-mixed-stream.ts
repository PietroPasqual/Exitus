import { clamp01, type Pix, type RGB } from './pixel';
import { materialStreamBounds, paintMaterialStream } from './pixel-material-stream';
import type { BodyMaterial } from './pixel-mixture-signatures';

export interface StreamMaterial { readonly element: BodyMaterial; readonly ramp: readonly RGB[] }
type Bounds = ReturnType<typeof materialStreamBounds>;
const TAU = Math.PI * 2;
const wrap = (n: number): number => n - Math.floor(n);
const smooth = (n: number): number => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const tone = (ramp: readonly RGB[], n: number): RGB => ramp[Math.round(clamp01(n) * (ramp.length - 1))];
const axis = (u: number): number => .25 - .24 * u;
const growth = (u: number): number => smooth(u / .2);
const taper = (u: number): number => Math.sqrt(clamp01((1 - u) / .05));
const ICE_CONTACTS = [[.22, .11, .34], [.63, .15, .43], [.9, .055, .22]] as const;
// Must match pixel-material-stream.ts ICE_PRISMS: only the water contact uses
// these footprints; the primary still owns and paints every rigid ice face.
const ICE_PRIMARY_FEET = [[.2, .2, .47], [.76, .19, .43], [.48, .25, .53]] as const;
const STEEL_CONTACTS = [[.08, .052, .085], [.34, .09, .17], [.69, .05, .09]] as const;
// Select physical rail ends once per pose; every pixel shares this immutable
// result. The selection depends on world position, never a repeating cell ID.
const RAIL_SURGES: readonly (readonly [number, number])[] = Array.from({ length: 8 }, (_, frame) => {
  const phase = frame / 8, leader = wrap(phase + .08);
  let liveU = 0, liveSide = -1, nearest = Infinity;
  for (let side = -1; side <= 1; side += 2) {
    const contact = side < 0 ? .27 : .65;
    const cell = Math.max(Math.ceil(-phase - contact), Math.min(Math.floor(2.8 - phase - contact), Math.round(leader * 2.8 - phase - contact)));
    const end = (cell + phase + contact) / 2.8, gap = Math.abs(end - leader);
    if (gap < nearest) { nearest = gap; liveU = end; liveSide = side; }
  }
  return [liveU, liveSide] as const;
});

function distance(u: number, v: number, ax: number, ay: number, bx: number, by: number, horizontal = 6): number {
  const dx = (bx - ax) * horizontal, dy = by - ay, x = (u - ax) * horizontal, y = v - ay;
  const t = clamp01((x * dx + y * dy) / Math.max(.0001, dx * dx + dy * dy));
  return Math.hypot(x - t * dx, y - t * dy);
}

/** Fixed channel knots agree with the primary lightning stream. */
function boltAxis(u: number, frame: number): number {
  const jump = frame >= 3 && frame <= 4 ? .12 : 0;
  if (u < .18) return .25 + (u / .18) * -.09;
  if (u < .36) return .16 + ((u - .18) / .18) * (-.28 - jump);
  if (u < .46) return -.12 - jump + ((u - .36) / .1) * (.3 + jump);
  if (u < .68) return .18 + ((u - .46) / .22) * (-.38 + jump);
  if (u < .76) return -.2 + jump + ((u - .68) / .08) * (.3 - jump);
  return .1 + ((u - .76) / .24) * -.19;
}

function waterIce(u: number, v: number, px: number, frame: number, water: readonly RGB[], ice: readonly RGB[], iceFirst: boolean): RGB | null {
  const g = growth(u), a = axis(u);
  let color: RGB | null = null;
  if (iceFirst) {
    if (u >= .985) return null;
    // Follow the moving lower faces of the primary's unchanged prism train.
    // The foreground foot displaces the current; the gap beyond releases it.
    let floor = .045 * g, squeeze = 0, bend = 0;
    for (let i = 0; i < ICE_PRIMARY_FEET.length; i++) {
      const [offset, width, height] = ICE_PRIMARY_FEET[i];
      const q = (wrap(u - frame / 8 - offset + .5) - .5) / width;
      if (q < -1.32 || q > 1.28) continue;
      const local = Math.max(-1, Math.min(q, 1)), h = height * (.18 + g * .82);
      const bottom = h * (local < -.62 ? .25 + (local + 1) * .4 : local > .56 ? .4 - (local - .56) * .35 : .4);
      const foot = (i === 2 ? .13 : -.13) * g - local * .23 * g + bottom;
      const entry = smooth((q + 1.32) / .32), release = 1 - smooth((q - 1) / .28);
      const contact = (foot - .02 * g) * entry * release;
      if (contact > floor) { floor = contact; squeeze = entry * release; bend = 4 * entry * (1 - entry); }
    }
    const center = a + floor * taper(u), half = Math.max(px * .6, (.04 + g * (.065 - squeeze * .015 + bend * .025)) * taper(u));
    const d = v - center;
    if (Math.abs(d) < half) color = tone(water, d < -half + px * .62 ? .83 : d > half - px * .6 ? .29 : .5);
  } else {
    const wave = Math.sin(u * TAU * 1.5 - frame * TAU / 8), waterCenter = a + wave * .085 * g;
    const waterTaper = Math.sqrt(clamp01((1 - u) / .06));
    const waterTop = waterCenter - Math.max(px * .58, (.075 + g * (.29 + wave * .07)) * waterTaper);
    const waterBottom = waterCenter + Math.max(px * .58, (.07 + g * .23) * waterTaper);
    // Two unequal bevel-ended plates and one chip share their local coordinates
    // with the current. Broad planes and short ends keep the ice rigid.
    for (let i = 0; i < ICE_CONTACTS.length; i++) {
      const [offset, half, height] = ICE_CONTACTS[i];
      const q = (wrap(u - frame / 8 - offset + .5) - .5) / half;
      if (q < (i === 1 ? -1.55 : -1) || q > (i === 1 ? 1.8 : 1)) continue;
      const h = height * (.18 + g * .82) * taper(u), tilt = i === 1 ? -.035 : .025;
      const base = a - .015 + q * tilt * g, z = v - base;
      const top = -h * (q < -.64 ? .3 + (q + 1) * 1.94 : q > .57 ? 1 - (q - .57) * 1.42 : 1);
      const bottom = (.065 - Math.max(0, q - .57) * .07) * g;
      // Suppress the unrelated inner ripple through this contact corridor.
      // The silhouette/crest remains the primary water painter's own shape.
      if (i === 1 && z > -.18 * g && z < .2 * g && v > waterTop + px && v < waterBottom - px) color = tone(water, .5);
      if (Math.abs(q) <= 1 && z >= top && z <= bottom) {
        const ridge = -.28 * h + q * h * .065;
        if (q > .57) color = tone(ice, .46);
        else if (z > ridge) color = tone(ice, .25);
        else color = tone(ice, q < -.64 ? .63 : .83);
        if (z < top + px * .52 && q < .57) color = tone(ice, .95);
        if (Math.abs(z - ridge) < px * .38 && q > -.64 && q < .48) color = tone(ice, .63);
      }
      // The leading lip dives around the foot, tightens underneath, then rolls
      // upward after the short end. Its fold travels with the plate, not screen x.
      const channel = i !== 1 ? bottom + .005 : q < -1 ? -.1 + smooth((q + 1.55) / .55) * .19
        : q < .65 ? .09 - (q + 1) * .014
        : q < 1.35 ? .067 - smooth((q - .65) / .7) * .16
        : -.093 + smooth((q - 1.35) / .45) * .17;
      const width = Math.max(px * .6, (.05 + (q < -1 || q > 1 ? .02 : 0)) * g) * taper(u);
      const d = z - channel * g;
      // Water only crosses the submerged foot; it never wipes the broad top.
      if (Math.abs(d) < width && (Math.abs(q) > 1 || z > bottom - px * .75)) {
        color = tone(water, d < -width + px * .55 ? .83 : d > width - px * .4 ? .29 : .64);
      }
    }
  }
  return color;
}

function lightningMetal(u: number, v: number, px: number, frame: number, lightning: readonly RGB[], metal: readonly RGB[]): RGB | null {
  let color: RGB | null = null;
  // One charge moves through the material train, rather than firing every
  // contact on its own clock. These cyclic intervals follow the actual gaps.
  const charge = wrap(frame / 8 + STEEL_CONTACTS[0][0]);
  for (let i = 0; i < STEEL_CONTACTS.length; i++) {
    const [offset, half, thickness] = STEEL_CONTACTS[i];
    const local = (wrap(u - frame / 8 - offset + .5) - .5) / half;
    if (local < -1.8 || local > 2.1) continue;
    const center = u - local * half, g = growth(center), height = Math.max(px * .65, thickness * g);
    // Rigid sheared planes stay dark underneath a narrow conducting rim.
    const tilt = i === 1 ? -.055 : .035, mid = boltAxis(center, frame);
    const y = mid + local * tilt, d = v - y;
    const bevel = Math.max(.25, Math.min((local + 1) / .2, (1 - local) / .18, 1));
    if (Math.abs(local) <= 1 && Math.abs(d) <= height * bevel) {
      if (local > -.68 && local < -.08 && Math.abs(d + height * .35) < px * .43) color = tone(metal, .96);
      else if (d < -height * .12) color = tone(metal, .56);
      else color = tone(metal, local > .64 ? .36 : .18);
    }
    const left = center - half, right = center + half;
    const entryY = mid - tilt - height * .25, rimLeft = mid - tilt - height, rimRight = mid + tilt - height;
    const exitY = mid + tilt - height * .25, join = right + .075;
    const approach = distance(u, v, left - .055, boltAxis(left - .055, frame), left, entryY);
    const entry = distance(u, v, left, entryY, left + half * .16, rimLeft);
    const rim = distance(u, v, left + half * .16, rimLeft, right - half * .14, rimRight);
    const exit = distance(u, v, right - half * .14, rimRight, right, exitY);
    const reconnect = distance(u, v, right, exitY, join, boltAxis(join, frame));
    const route = Math.min(approach, entry, rim, exit, reconnect), core = Math.max(px * .48, .027);
    if (route < core) color = tone(lightning, .4);
    const previous = STEEL_CONTACTS[(i + STEEL_CONTACTS.length - 1) % STEEL_CONTACTS.length][0];
    const next = STEEL_CONTACTS[(i + 1) % STEEL_CONTACTS.length][0];
    const before = wrap(offset - previous) * .5, after = wrap(next - offset) * .5;
    const lag = wrap(charge - offset + .5) - .5;
    if (lag < -before || lag >= after) continue;
    const progress = (lag + before) / (before + after), front = -1.35 + progress * 3;
    // An arriving leader becomes a held edge charge, then a downstream kick.
    // Only this physical contact owns a white peak; the others retain residue.
    // A two-pixel yellow pocket on the exterior bevel makes the held charge
    // readable at scene scale without whitening the broad dark lower plane.
    if (route < core * 1.7 && Math.abs(local - front) < .32 && (d < -height * .6 || Math.abs(local) > 1)) color = tone(lightning, .59);
    if (route < core && local < front && local > front - 1.2) color = tone(lightning, .68);
    if (route < core && Math.abs(local - front) < .57) color = tone(lightning, 1);
    if (progress > .32 && progress < .7) {
      if (entry < core * 1.7 && d < -height * .4) color = tone(lightning, .59);
      if (entry < core) color = tone(lightning, .86);
    }
    if (progress > .68) {
      const kneeX = right + .025, kneeY = exitY - .13 * g;
      const jump = Math.min(distance(u, v, right, exitY, kneeX, kneeY), distance(u, v, kneeX, kneeY, join, boltAxis(join, frame)));
      if (jump < core * 1.65) color = tone(lightning, .59);
      if (jump < core) color = tone(lightning, Math.abs(local - front) < .75 ? 1 : .68);
    }
  }
  // Between contacts the same leader runs along the existing angular channel.
  // It cannot paint over steel, grow a halo, or create a detached spark.
  const leader = wrap(u - frame / 4 - STEEL_CONTACTS[0][0] + .5) - .5;
  if (!color && leader > -.17 && leader < .055 && Math.abs(v - boltAxis(u, frame)) < Math.max(px * .48, .027)) color = tone(lightning, .68);
  return color;
}

function metalLightning(u: number, v: number, px: number, frame: number, metal: readonly RGB[], lightning: readonly RGB[]): RGB | null {
  const g = growth(u), z = v - axis(u), phase = frame / 8, q = wrap(u * 2.8 - phase), horizontal = 6 / 2.8;
  const core = Math.max(px * .48, .026), leader = wrap(phase + .08);
  let color: RGB | null = null;
  const [liveU, liveSide] = RAIL_SURGES[frame];
  // Cell identities permute at 7 -> 0; only a physical end owns the charge.
  // Draw the active lane last so a quiet crossing cannot erase its pocket.
  for (let pass = 0; pass < 2; pass++) {
    const side = pass === 1 ? liveSide : -liveSide;
    const contact = side < 0 ? .27 : .65, receive = contact + .15;
    const contactU = u + (contact - q) / 2.8;
    const active = side === liveSide && Math.abs(contactU - liveU) < .0001;
    const edgeY = side * .25 * g + .0345, targetY = -side * .25 * g + (side < 0 ? .017 : -.00075);
    const sourceX = contact - .14, sourceY = side * .055 * g;
    const approach = distance(q, z, sourceX, sourceY, contact - .045, edgeY, horizontal);
    const charge = distance(q, z, contact - .045, edgeY, contact, edgeY, horizontal);
    const kneeX = contact + .065, kneeY = (edgeY + targetY) * .5;
    const residual = Math.min(distance(q, z, contact, edgeY, kneeX, kneeY, horizontal), distance(q, z, kneeX, kneeY, receive, targetY, horizontal));
    const route = Math.min(approach, charge, residual);
    // Uncharged bridges are dark, fine traces. The steel retains its long
    // planes instead of becoming a regularly illuminated electrical ladder.
    if (route < core) color = tone(lightning, active ? .59 : 0);
    if (active) {
      const progress = clamp01((leader - contactU + .1) / .2), front = sourceX + progress * (receive - sourceX);
      if (route < core * 1.7 && Math.abs(q - front) < .06) color = tone(lightning, .59);
      if (route < core && q < front && q > front - .11) color = tone(lightning, .78);
      if (route < core && Math.abs(q - front) < .052) color = tone(lightning, 1);
      if (progress > .3 && progress < .62) {
        if (charge < core * 1.75 && q > contact - .055 && q < contact + .018) color = tone(lightning, .59);
        if (charge < core) color = tone(lightning, 1);
      }
      if (progress >= .62) {
        const turnX = contact + .035, turnY = edgeY - side * .32 * g;
        const kickX = contact + .095, kickY = targetY + side * .14 * g;
        const jump = Math.min(distance(q, z, contact, edgeY, turnX, turnY, horizontal),
          distance(q, z, turnX, turnY, kickX, kickY, horizontal), distance(q, z, kickX, kickY, receive, targetY, horizontal));
        if (jump < core * 1.65) color = tone(lightning, .59);
        if (jump < core) color = tone(lightning, q > front - .11 ? 1 : .78);
      }
    }
    if (!color && Math.abs(q - contact) < .016 && Math.abs(z - (edgeY + side * px)) < core) color = tone(metal, .79);
  }
  return color;
}

function rootedFire(u: number, v: number, px: number, frame: number, fire: readonly RGB[]): RGB | null {
  const q = (wrap(u - frame / 8 - .34 + .5) - .5 + .14) / .3;
  if (q < 0 || q > 1) return null;
  const g = growth(u), phase = frame * TAU / 8, wave = Math.sin(u * TAU * 1.5 - phase);
  const waterTop = axis(u) + wave * .085 * g - (.075 + g * (.29 + wave * .07)) * taper(u);
  const base = waterTop + .085, h = (.1 + g * .26) * Math.sin(q * Math.PI) * taper(u);
  const lower = -.035 * Math.sin(q * Math.PI), upper = -h * (1 + .23 * Math.sin(q * TAU));
  const d = v - base;
  if (d < upper || d > lower) return null;
  if (d > lower - Math.max(px * .45, .028)) return tone(fire, .31);
  const fold = upper * .45 - q * .035;
  if (d < fold && d > fold - Math.max(px * .55, .035)) return tone(fire, .91);
  return tone(fire, d < fold ? .58 : .43);
}

/**
 * Explicit art adapters for reviewed ordered mixtures. This does not decide
 * spell eligibility. Unsupported lists return undefined without touching Pix,
 * allowing the scene's ordinary compositor to remain the bounded fallback.
 */
export function paintMixedMaterialStream(pix: Pix, x: number, y: number, scale: number,
  materials: readonly StreamMaterial[], frame = 0): Bounds | undefined {
  const key = materials.map(m => m.element).join('/');
  if (!['agua/gelo', 'gelo/agua', 'raio/metal', 'metal/raio', 'agua/gelo/fogo'].includes(key) || materials.some(m => !m.ramp.length)) return undefined;
  const first = materials[0], second = materials[1], f = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  // The conducting adapters reserve the brightest peak for the active contact:
  // quiet the old bolt front or the long steel reflection, using existing tones.
  const primaryRamp = key === 'raio/metal' ? first.ramp.map((_, i) => tone(first.ramp, i / Math.max(1, first.ramp.length - 1) >= .5 ? .4 : 0))
    : key === 'metal/raio' ? first.ramp.map((color, i) => i === first.ramp.length - 1 ? tone(first.ramp, .75) : color) : first.ramp;
  const bounds = paintMaterialStream(pix, x, y, scale, primaryRamp, first.element, f), s = (bounds.r - bounds.l) / 6, px = 1 / s;
  for (let yy = Math.ceil(bounds.t); yy <= Math.floor(bounds.b); yy++) for (let xx = Math.ceil(bounds.l); xx <= Math.floor(bounds.r); xx++) {
    const u = (xx - bounds.l) / (6 * s), v = (yy - y) / s;
    let color: RGB | null = null;
    if (key === 'agua/gelo' || key === 'agua/gelo/fogo') color = waterIce(u, v, px, f, first.ramp, second.ramp, false);
    else if (key === 'gelo/agua') color = waterIce(u, v, px, f, second.ramp, first.ramp, true);
    else if (key === 'raio/metal') color = lightningMetal(u, v, px, f, first.ramp, second.ramp);
    else if (key === 'metal/raio') color = metalLightning(u, v, px, f, first.ramp, second.ramp);
    if (key === 'agua/gelo/fogo') color = rootedFire(u, v, px, f, materials[2].ramp) ?? color;
    if (color) pix.set(xx, yy, color);
  }
  return bounds;
}
