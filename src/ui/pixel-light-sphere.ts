import { inPoly, type Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Point = [number, number];
const EMPTY = (): IntentionBox => ({ l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;

// An open, unevenly faceted shoulder. The light reaches its lower-right foot,
// cools there, then gathers at the source again; it never spins the whole orb.
const ARC: Point[] = [[-.56,.54],[-.74,.19],[-.7,-.24],[-.43,-.59],[-.03,-.75],
  [.41,-.63],[.7,-.31],[.77,.09],[.6,.45]];
const HEAD = [.02, .08, .22, .43, .65, .84, .97, .98];
const POWER = [.38, .68, .96, 1, .95, .76, .4, .12];
const CROWN: Point[] = [[-.57,-.53],[-.38,-.86],[-.15,-.82],[.02,-1.02],
  [.18,-.81],[.46,-.75],[.71,-.62],[.84,-.32],[1.025,-.1],[.87,.06],
  [.87,.36],[.64,.59],[.65,.33],[.74,.02],[.62,-.29],[.38,-.51],[.04,-.61],[-.31,-.47]];
const FACE: Point[] = [[-.54,-.27],[-.31,-.57],[.04,-.62],[.4,-.43],
  [.56,-.1],[.47,.23],[.2,.43],[-.13,.45],[-.43,.21]];
const UNDER: Point[] = [[-.69,.12],[-.41,.45],[-.02,.58],[.37,.5],[.65,.25],
  [.65,.54],[.38,.76],[-.03,.83],[-.46,.66],[-.76,.35]];
const segments = ARC.slice(1).map((b, i) => {
  const a = ARC[i], dx = b[0] - a[0], dy = b[1] - a[1];
  return { a, dx, dy, squared: dx * dx + dy * dy };
});

/** The same small all-frame envelope is used for packing and rasterization. */
export function lightSphereBounds(s: number): IntentionBox {
  if (!Number.isFinite(s) || s <= 0) return { l: 0, t: 0, r: 0, b: 0 };
  return { l: -s, t: -s, r: s, b: s };
}

/**
 * Original golden light volume: ochre undercuts, a small stable luminous heart,
 * and one travelling plane of light on an attached, segmented corona. No halo
 * or detached star pixels are added, including fractional miniature copies.
 */
export function paintLightSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  if (!ramp.length || ![x, y, s].every(Number.isFinite) || s <= 0) return EMPTY();
  const q = lightSphereBounds(s), left = Math.max(0, Math.ceil(x + q.l));
  const top = Math.max(0, Math.ceil(y + q.t)), right = Math.min(pix.w - 1, Math.floor(x + q.r));
  const bottom = Math.min(pix.h - 1, Math.floor(y + q.b));
  if (left > right || top > bottom) return EMPTY();
  const radius = s * .94, phase = phaseOf(frame), tiny = s < 6;
  const head = HEAD[phase], power = POWER[phase], out = EMPTY();
  const color = (tone: number): RGB => ramp[Math.round(tone / 4 * (ramp.length - 1))];
  // A miniature keeps one hot pixel, so the same core cannot become a white
  // disc when its neighbours are lost to fractional sampling.
  const coreX = Math.round(x - radius * .19), coreY = Math.round(y - radius * .12);
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const u = (px - x) / radius, v = (py - y) / radius, d = Math.hypot(u, v);
    const body = d <= .94, crown = !tiny && inPoly(CROWN, u, v);
    if (!body && !crown) continue;
    // Crisp broad planes keep a shaded golden volume at every pause frame.
    let tone = 1;
    if (body && inPoly(FACE, u, v)) tone = 2;
    if (v > .27 + u * -.25 || (d > .78 && u + v > -.05)) tone = 0;
    if (body && inPoly(UNDER, u, v)) tone = v > .57 ? 0 : 1;
    if (crown) tone = u + v < -.36 ? 2 : 1;
    // Each shoulder is a flat cut, joined to the same sphere. The dark joints
    // divide the corona by value, without holes or a beaded ring of particles.
    let nearest = Infinity, along = 0;
    for (let i = 0; i < segments.length; i++) {
      const { a, dx, dy, squared } = segments[i];
      const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / squared));
      const ex = u - a[0] - dx * t, ey = v - a[1] - dy * t, distance = ex * ex + ey * ey;
      if (distance < nearest) { nearest = distance; along = (i + t) / segments.length; }
    }
    const thickness = tiny ? .18 : .115;
    const joint = (along * segments.length) % 1;
    if (nearest < thickness * thickness) {
      tone = joint < .12 || joint > .91 ? 1 : 2;
      // A narrow front leads a wider gold/cream afterimage. The head accelerates
      // through the crown and fades at the foot; the rest of the face stays put.
      const behind = head - along;
      if (behind > -.055 && behind < .23 && power > .28) tone = 3;
      if (!tiny && behind > -.025 && behind < .045 && power > .7 && nearest < .0016) tone = 4;
      if (behind > .23 && behind < .37 && joint > .15 && joint < .86) tone = 2;
    }
    // An inset crescent reflects the passing front one pose later. Only this
    // narrow local plane responds, never the entire disc's brightness.
    if (!tiny && d < .72 && u > .1 && v > -.26 && v < .42) {
      const facet = Math.abs(u + v * .48 - (.34 + HEAD[(phase + 7) % 8] * .09));
      if (facet < .065 && phase >= 3 && phase <= 6) tone = 3;
    }
    const kernel = Math.hypot((u + .19) * 1.05, (v + .12) * 1.13);
    if (kernel < .32) tone = 3;
    if (tiny ? px === coreX && py === coreY : kernel < .155) tone = 4;
    pix.set(px, py, color(tone));
    out.l = Math.min(out.l, px); out.t = Math.min(out.t, py);
    out.r = Math.max(out.r, px); out.b = Math.max(out.b, py);
  }
  return out;
}
