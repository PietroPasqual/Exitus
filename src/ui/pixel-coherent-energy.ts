import { inPoly, Pix, type RGB } from './pixel';
import type { IntentionBox } from './pixel-intention';

type Point = [number, number];
const phaseOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const cycle = (value: number, length = 8): number => ((value % length) + length) % length;
const index = (ramp: RGB[], tone: number): RGB => ramp[Math.round(Math.max(0, Math.min(1, tone)) * (ramp.length - 1))];

/** Stable origin-relative bounds enclose every frame and both lance directions. */
export function fireLanceBounds(s: number, launching = false): IntentionBox {
  const k = s / 15, reach = launching ? 41 : 31;
  return { l: Math.floor(-reach * k) - 1, t: Math.floor(-8 * k) - 1,
    r: Math.ceil(reach * k) + 1, b: Math.ceil(7 * k) + 1 };
}

/** The loop and both rooted forks are included; no glow margin is invented. */
export function lightningRingBounds(s: number): IntentionBox {
  const k = s / 15, loop = Math.max(1.18 * k, .72), fork = Math.max(.8 * k, .62);
  return { l: Math.floor(-16 * k - loop), t: Math.floor(Math.min(-13 * k - loop, -19 * k - fork)),
    r: Math.ceil(Math.max(17 * k + loop, 21 * k + fork)), b: Math.ceil(Math.max(13 * k + loop, 14 * k + fork)) };
}
const translated = (q: IntentionBox, x: number, y: number): IntentionBox => ({ l: q.l + x, t: q.t + y, r: q.r + x, b: q.b + y });
const drawable = (pix: Pix, q: IntentionBox): boolean => q.r >= -1 && q.b >= -1 && q.l <= pix.w && q.t <= pix.h;

// Authored wake poses, read from the trailing tip toward the fixed socket.
// A broad fold travels backwards through the sheet and rolls into its tail.
// Upper and lower banks belong to the same flame, never to detached speed lines.
interface PlumePose { tip: Point; upper: number[]; lower: number[] }
const PLUME_X = [-26, -21, -15, -9, -3, 2];
const PLUME_POSES: PlumePose[] = [
  { tip: [-29, -2], upper: [-2.2, -2.4, -2.5, -3.5, -4, -2], lower: [.4, 1.8, 2.4, 3.5, 3.3, 2] },
  { tip: [-29, -3], upper: [-2.8, -2.6, -3.1, -5, -3.3, -2], lower: [.2, 1.4, 3, 4.1, 2.6, 2] },
  { tip: [-31, -4.5], upper: [-4.2, -3.2, -5.4, -3.6, -2.6, -2], lower: [-1.5, 1.8, 4.6, 3, 2.3, 2] },
  { tip: [-31, -3], upper: [-3.9, -5.1, -4, -2.8, -2.3, -2], lower: [-.6, 4.3, 3.8, 2.4, 2.6, 2] },
  { tip: [-31, 0], upper: [-4.6, -3.2, -2.1, -2.3, -2.6, -2], lower: [3.5, 4.9, 3.1, 2.5, 2.8, 2] },
  { tip: [-30, 3], upper: [-.5, -1.7, -2.5, -3, -3, -2], lower: [4.6, 4.1, 3.2, 3, 3.3, 2] },
  { tip: [-29, 2], upper: [-.3, -1.9, -2.8, -3.1, -3.8, -2], lower: [3.8, 2.6, 2.4, 3, 3.8, 2] },
  { tip: [-29, 0], upper: [-1.2, -2.3, -2.7, -3, -3.9, -2], lower: [2.1, 2.2, 2.3, 3, 3.4, 2] }
];
const FOLD_ROLL = [-.4, -.9, -.5, .3, .7, .6, .1, -.3];
// A short preparation, two accelerating frames, then a slower cooling recovery.
// The tail has its own inertia: it cannot move as a rigid copy of the blade.
const LAUNCH_HEAD = [-3, -6, -4, 3, 11, 9, 5, 1];
const LAUNCH_TAIL = [-1, -2, -4, -5, -4, -1, 1, 0];
const LAUNCH_HEAT = [-.05, -.04, .02, .08, .1, .01, -.06, -.08];
// An elongated flame-forged spear: recurved shoulders leave two deliberate
// notches before the long cutting point. The neck grows out of the same shaft.
const LANCE_BODY: Point[] = [[-1, -1.6], [3, -1.8], [3, -5], [7, -4], [9, -8],
  [15, -6], [12, -4], [21, -3], [30, 0], [20, 3], [12, 6], [8, 7],
  [10, 3], [6, 2], [4, 4], [3, 1.6], [-1, 1.6]];
const LANCE_HEAD: Point[] = [[2, -.5], [5, -1.5], [5, -3], [8, -2.5], [10, -6],
  [12, -6], [10, -2.5], [20, -2], [29, 0], [18, 1], [11, 3.5], [9, 2], [5, 1]];
const LANCE_CORE: Point[] = [[2, 0], [9, -.5], [15, -1.2], [22, -.8], [29, 0],
  [20, .3], [13, .8], [8, .6]];
const LANCE_RECESS: Point[] = [[6, -1.4], [9, -3.5], [15, -3.4], [12, -1.8], [8, -.7]];
const LANCE_UNDERSIDE: Point[] = [[6, 1], [12, 2], [20, 1], [27, .3],
  [19, 2.2], [12, 4.6], [10, 5], [11, 3], [6, 2]];

/** Below three pixels of scale, a polygon can miss every raster sample.
 * A connected native-width spine keeps the wake joined to a tiny diamond head.
 * Everything is sampled around the supplied origin, so half-pixel mirrors agree.
 */
function paintCompactFireLance(pix: Pix, box: IntentionBox, x: number, y: number, k: number, ramp: RGB[], phase: number, reverse: boolean, launching: boolean): void {
  const headShift = launching ? LAUNCH_HEAD[phase] * k : 0, tailShift = launching ? LAUNCH_TAIL[phase] * k : 0;
  const direction = reverse ? -1 : 1, tail = Math.max(1.25, 30 * k) + headShift - tailShift;
  const tip = Math.max(1.35, 26 * k), shoulder = Math.max(.75, 12 * k), height = Math.max(.8, 7 * k);
  const bend = PLUME_POSES[phase].tip[1] * k * .7;
  const wake: Point[] = [[-tail, bend], [-tail * .55, bend * .4], [0, 0]];
  const head: Point[] = [[0, 0], [shoulder, -height], [tip, 0], [shoulder, height]];
  pix.shape(Math.max(-1, box.l), Math.max(-1, box.t), Math.min(pix.w, box.r), Math.min(pix.h, box.b), (px, py) => {
    const u = (px - x) * direction - headShift, v = py - y;
    if (u >= 0) {
      // This head/shaft junction is stationary even when the wake rolls over.
      if (!inPoly(head, u, v) && !(u <= tip && Math.abs(v) <= .58)) return null;
      return index(ramp, u >= shoulder && Math.abs(v) < .58 ? .99 : v < 0 ? .81 : .5);
    }
    let distance = Infinity;
    for (let i = 1; i < wake.length; i++) {
      const a = wake[i - 1], b = wake[i], dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(u - a[0] - dx * t, v - a[1] - dy * t));
    }
    if (distance > .62) return null;
    const flow = phaseOf(phase + Math.floor(-u * 1.8));
    return index(ramp, distance < .3 ? (flow < 3 ? .68 : .5) : .32);
  });
}

/** A carved flame spearhead with two interwoven currents in its attached shaft. */
export function paintCoherentFireLance(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number, reverse = false, launching = false): IntentionBox {
  const box = translated(fireLanceBounds(s, launching), x, y);
  if (!ramp.length || ![x, y, s].every(Number.isFinite) || s <= 0 || !drawable(pix, box)) return box;
  const k = s / 15, dir = reverse ? -1 : 1, phase = phaseOf(frame), pose = PLUME_POSES[phase];
  if (s < 3) { paintCompactFireLance(pix, box, x, y, k, ramp, phase, reverse, launching); return box; }
  const headShift = launching ? LAUNCH_HEAD[phase] : 0, tailShift = launching ? LAUNCH_TAIL[phase] : 0;
  const heat = launching ? LAUNCH_HEAT[phase] : 0;
  // Map the one connected plume between the lagging tail and moving socket.
  // Its material coordinates stretch, so the hot folds stretch with the mass.
  const wakeStretch = (2 + headShift - pose.tip[0] - tailShift) / (2 - pose.tip[0]);
  const upper: Point[] = PLUME_X.map((u, i) => [u, pose.upper[i]]), lower: Point[] = PLUME_X.map((u, i) => [u, pose.lower[i]]);
  const plume: Point[] = [pose.tip, ...upper, ...lower.reverse()];
  // Cross-sections keep the hot fold embedded in its own silhouette. The fold
  // gets broader near the socket, and cools continuously toward the tip.
  const banks = (u: number): [number, number] => {
    let left = pose.tip[0], top = pose.tip[1], bottom = pose.tip[1];
    for (let i = 0; i < PLUME_X.length; i++) {
      const right = PLUME_X[i];
      if (u <= right) {
        const t = Math.max(0, Math.min(1, (u - left) / (right - left)));
        return [top + (pose.upper[i] - top) * t, bottom + (pose.lower[i] - bottom) * t];
      }
      left = right; top = pose.upper[i]; bottom = pose.lower[i];
    }
    return [-2, 2];
  };
  pix.shape(Math.max(-1, box.l), Math.max(-1, box.t), Math.min(pix.w, box.r), Math.min(pix.h, box.b), (px, py) => {
    const worldU = (px - x) / k * dir, u = worldU - headShift, v = (py - y) / k;
    const wakeU = 2 + (u - 2) / wakeStretch;
    // Blade and plume occupy opposite halves. Avoid walking either polygon
    // for pixels that cannot belong to it; the neck overlap still stays exact.
    const blade = u >= -1 && u <= 30 && inPoly(LANCE_BODY, u, v);
    const wake = !blade && wakeU <= 2 && inPoly(plume, wakeU, v);
    if (!blade && !wake) return null;
    let tone: number;
    if (blade) {
      // The cutting edge and carved planes retain their silhouette. A narrow
      // heat front travels along the ridge instead of flashing the whole blade.
      tone = v > .8 ? .22 : .4;
      if (inPoly(LANCE_HEAD, u, v)) tone = v < -.5 ? .71 : .56;
      if (inPoly(LANCE_UNDERSIDE, u, v)) tone = v > 2 ? .37 : .49;
      if (inPoly(LANCE_RECESS, u, v)) tone = u < 10 ? .3 : .47;
      if (inPoly(LANCE_CORE, u, v)) {
        const age = cycle(phase - u / 6);
        tone = (u < 10 ? .65 : u > 18 && v < .4 ? .87 : .76) + heat;
        if (age < 1.1) tone += .12;
        else if (age < 2.1) tone += .05;
      }
      // Two recessed shoulder seams keep the flame barbs visibly rooted.
      if (u > 4 && u < 7 && v < -1.5 && v > -3) tone = .25;
      if (u > 6 && u < 10 && v > 1.3 && v < 2.5) tone = .34;
    } else {
      const [top, bottom] = banks(wakeU), depth = (v - top) / Math.max(.1, bottom - top);
      tone = depth < .56 ? .48 : .29;
      if (depth > .85) tone = .19;
      if (wakeU < -22) tone = depth < .6 ? .37 : .22;
      // Two flame folds exchange the front plane along the shaft. They meet
      // at the neck and taper toward the tail; no detached ribbons or sparks.
      const station = (wakeU + 24) / 7, left = Math.floor(station), blend = station - left;
      const roll = FOLD_ROLL[phaseOf(phase + left)] * (1 - blend) + FOLD_ROLL[phaseOf(phase + left + 1)] * blend;
      const taper = Math.min(1, Math.max(0, (wakeU + 27) / 9));
      const neck = Math.min(1, Math.max(0, (-wakeU - 1) / 7));
      const center = (top + bottom) * .5;
      const twist = Math.sin((wakeU + 4) * .37 + phase * Math.PI / 4);
      const curl = twist * (bottom - top) * .28 * neck + roll * .25;
      const age = cycle(phase - (2 - wakeU) / 4);
      const crest = age < .8 ? .16 : age < 1.8 ? .09 : age < 3 ? .03 : 0;
      const width = .45 + (.35 + crest * 2) * taper;
      const front = center + curl, back = center - curl;
      if (wakeU > -26 && Math.abs(v - back) < width) tone = (taper > .5 ? .43 : .32) + crest * .4;
      if (wakeU > -25 && Math.abs(v - front) < width) tone = (taper > .6 ? .57 : .42) + crest;
      // An ochre underside sits between the folds where they open apart.
      if (Math.abs(curl) > .8 && v > center + .4 && v < front - width) tone = .23;
      // Stretching leaves a cooler red tail; fresh heat stays near the socket.
      tone += heat * Math.max(0, (wakeU + 25) / 27);
    }
    return index(ramp, tone);
  }, index(ramp, .13));
  return box;
}

const RING_POINTS: Point[] = [[-15, -2], [-16, -5], [-10, -8], [-9, -12], [-3, -10], [1, -13],
  [6, -10], [11, -10], [10, -6], [15, -3], [17, 1], [14, 4], [13, 8], [8, 7],
  [4, 12], [-1, 11], [-6, 13], [-9, 9], [-14, 8], [-12, 4], [-15, -2]];
const RING_PATHS: Point[][] = [RING_POINTS,
  [[-9, -12], [-11, -16], [-7, -15], [-9, -19]],
  [[13, 8], [18, 10], [16, 14], [21, 13]]];
// Material distance, rather than unrelated segment clocks, carries one discharge
// clockwise around the actual jagged circuit. Fork roots share that same clock.
const RING_DISTANCE = [0];
for (let i = 1; i < RING_POINTS.length; i++) {
  const a = RING_POINTS[i - 1], b = RING_POINTS[i];
  RING_DISTANCE.push(RING_DISTANCE[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
}
const RING_LENGTH = RING_DISTANCE[RING_DISTANCE.length - 1];
const FORK_ROOTS = [0, RING_DISTANCE[3], RING_DISTANCE[12]];
// Electricity catches at a root, leaps across several channels, then decays.
// Unequal spacing prevents a continuously rotating loading-indicator rhythm.
const HEAD_STEPS = [0, .045, .23, .29, (FORK_ROOTS[2] - FORK_ROOTS[1]) / RING_LENGTH, .49, .76, .9];
const HEAD_WIDTH = [.48, .2, .65, .28, .58, .2, .65, .32];
const HEAD_SURGE = [1, .8, 1, .88, 1, .78, 1, .86];
const REROUTE_VERTICES = new Set([2, 4, 6, 8, 11, 13, 15, 17, 19]);
const rootAge = (phase: number, branch: number): number => cycle(phase - (branch === 2 ? 4 : 0));
const ringHead = (phase: number): number => cycle(FORK_ROOTS[1] + HEAD_STEPS[phase] * RING_LENGTH, RING_LENGTH);

function ringSegments(phase: number) {
  const head = ringHead(phase);
  return RING_PATHS.flatMap((path, branch) => {
    const energized = branch ? rootAge(phase, branch) : 0;
    const rerouted = path.map(([u, v], i): Point => {
      if (!branch && REROUTE_VERTICES.has(i)) {
        const behind = cycle(head - RING_DISTANCE[i], RING_LENGTH);
        // Short outward channel snaps immediately behind the traveling head.
        // Extrema, fork sockets and the open center never migrate.
        const push = behind < 6 ? 1.05 : behind < 13 ? .5 : 0;
        const radius = Math.hypot(u, v);
        return [u + u / radius * push, v + v / radius * push];
      }
      // Each rooted fork reforms its elbow as current passes, then settles.
      // All alternate routes remain within its existing measured envelope.
      if (branch === 1 && i === 1 && energized < 1.1) return [u + .9, v];
      if (branch === 1 && i === 2 && energized > .5 && energized < 1.7) return [u, v - .8];
      if (branch === 2 && i === 1 && energized < 1.1) return [u, v - .8];
      if (branch === 2 && i === 2 && energized > .5 && energized < 1.7) return [u - .5, v - .6];
      return [u, v];
    });
    let distance = 0;
    return rerouted.slice(1).map((b, i) => {
      const a = rerouted[i], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      const materialLength = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      const at = distance; distance += materialLength;
      return { a, dx, dy, length, materialLength, at, branch };
    });
  });
}

/** A traveling electrical head, cooling rim and two sequential rooted discharges. */
export function paintCoherentLightningRing(pix: Pix, x: number, y: number, s: number, ramp: RGB[], frame: number): IntentionBox {
  const box = translated(lightningRingBounds(s), x, y);
  if (!ramp.length || ![x, y, s].every(Number.isFinite) || s <= 0 || !drawable(pix, box)) return box;
  const k = s / 15, phase = phaseOf(frame), segments = ringSegments(phase);
  const head = ringHead(phase);
  pix.shape(Math.max(-1, box.l), Math.max(-1, box.t), Math.min(pix.w, box.r), Math.min(pix.h, box.b), (px, py) => {
    const u = (px - x) / k, v = (py - y) / k;
    let nearest = Infinity, at = 0, branch = 0;
    for (const segment of segments) {
      const { a, dx, dy, length } = segment;
      const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (length * length)));
      const d = Math.hypot(u - a[0] - dx * t, v - a[1] - dy * t);
      if (d < nearest) { nearest = d; at = segment.at + t * segment.materialLength; branch = segment.branch; }
    }
    // The residual channel always stays closed, including tiny orbit copies.
    if (nearest > (branch ? Math.max(.8, .62 / k) : Math.max(1.18, .72 / k))) return null;
    const core = nearest < (branch ? Math.max(.4, .28 / k) : Math.max(.5, .32 / k));
    let tone: number;
    if (branch) {
      // Propagation begins at the actual root and reaches the tip later.
      const age = cycle(rootAge(phase, branch) - at / 10);
      tone = core
        ? age < .55 ? 1 : age < 1.4 ? .76 : age < 2.3 ? .48 : age < 3 ? .28 : .13
        : age < .55 ? .7 : age < 1.4 ? .45 : age < 2.3 ? .23 : age < 3 ? .15 : .06;
    } else {
      const age = cycle(head - at, RING_LENGTH) / RING_LENGTH * 8;
      tone = core
        ? age < HEAD_WIDTH[phase] ? HEAD_SURGE[phase] : age < 1.15 ? .68 : age < 2 ? .54 : age < 3 ? .38 : .22
        : age < HEAD_WIDTH[phase] ? HEAD_SURGE[phase] * .76 : age < 1.15 ? .48 : age < 2 ? .32 : age < 3 ? .18 : .08;
    }
    return index(ramp, tone);
  });
  return box;
}
