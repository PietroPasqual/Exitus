import { inPoly, type Pix, type RGB } from './pixel';

type Point = [number, number];
type Box = { l: number; t: number; r: number; b: number };

// Authored on the same 50 × 43 centred grid as dragao. The contour is a new
// profile: one curling tail, low ribcage, rising S-neck and long, horned head.
const TRUNK: Point[] = [
  [-24, 3], [-23, 7], [-21, 10], [-18, 11], [-15, 10], [-12, 7],
  [-10, 5], [-7, 2], [-3, 2], [0, 3], [3, 2], [5, 0], [5, -4],
  [6, -8], [8, -11], [11, -13], [13, -14], [16, -15], [20, -14],
  [23, -13], [25, -11], [24, -9], [22, -8], [20, -7], [16, -7], [13, -9],
  [11, -7], [10, -4], [11, 0], [11, 4], [10, 7], [8, 10],
  [5, 12], [1, 13], [-3, 12], [-7, 11], [-12, 14], [-17, 16],
  [-21, 15], [-23, 12], [-25, 8], [-25, 5]
];
const HORNS: Point[][] = [
  [[12, -13], [9, -20], [11, -19], [15, -15], [16, -13]],
  [[17, -14], [16, -20], [18, -18], [20, -13]]
];
const REAR_WING: Point[] = [
  [3, 5], [-1, -3], [-2, -10], [0, -16], [1, -14], [1, -10],
  [3, -7], [4, -2], [6, 2]
];
const REAR_LIMBS: Point[][] = [
  [[-7, 7], [-3, 9], [-6, 14], [-5, 17], [-1, 18], [-1, 20],
    [-7, 20], [-9, 16], [-9, 12]],
  [[6, 5], [9, 7], [10, 11], [13, 15], [17, 15], [18, 17],
    [12, 18], [9, 16], [6, 12], [4, 8]]
];
// A single sail with three curved membrane bays, all growing from one shoulder.
const WING: Point[] = [
  [1, 6], [-3, 1], [-5, -2], [-8, -2], [-11, 1], [-11, -3],
  [-13, -6], [-16, -7], [-19, -5], [-23, -1], [-21, -7],
  [-18, -13], [-15, -18], [-12, -21], [-9, -16], [-6, -11],
  [-4, -6], [-2, -1], [2, 4]
];
const FRONT_LIMBS: Point[][] = [
  [[-8, 6], [-4, 5], [-1, 7], [0, 10], [-3, 13], [-7, 16],
    [-7, 18], [-2, 19], [-1, 21], [-10, 21], [-11, 18],
    [-9, 14], [-10, 10]],
  [[5, 4], [8, 6], [8, 11], [9, 16], [11, 18], [16, 19],
    [17, 21], [8, 21], [6, 18], [4, 12], [3, 8]]
];
const BELLY: Point[] = [
  [-24, 10], [-21, 13], [-17, 14], [-12, 12], [-7, 8], [-3, 8],
  [0, 10], [4, 9], [7, 6], [9, 2], [9, -4], [12, -8], [14, -8],
  [11, -4], [12, 2], [9, 9], [5, 13], [0, 14], [-6, 12],
  [-13, 15], [-18, 17], [-23, 14]
];
const NECK_LIGHT: Point[] = [
  [5, 2], [6, -3], [7, -8], [10, -11], [14, -13], [19, -13],
  [22, -12], [16, -12], [12, -11], [9, -7], [8, -2], [8, 2], [6, 5]
];
// Broad transparent planes bend with the same body, rather than texturing its
// skin. Their darker lower edge gives the current a volume of water to cross.
const WATER_PLANES: Point[][] = [
  [[-24, 5], [-22, 9], [-18, 12], [-14, 11], [-10, 7], [-7, 4],
    [-3, 3], [1, 4], [5, 2], [7, -2], [9, -3], [9, 2], [7, 6],
    [3, 9], [-1, 10], [-6, 8], [-10, 11], [-15, 14], [-20, 14], [-23, 11]],
  [[10, -11], [14, -14], [19, -14], [23, -12], [24, -11],
    [20, -11], [17, -10], [14, -11], [11, -9], [9, -6], [8, -2],
    [7, -4], [8, -8]]
];
const DEEP_WATER: Point[] = [
  [-23, 13], [-18, 15], [-13, 13], [-8, 9], [-5, 10], [-1, 11],
  [3, 11], [7, 8], [9, 4], [10, 2], [10, 7], [6, 12], [1, 13],
  [-5, 11], [-11, 14], [-17, 16], [-21, 15]
];
const WING_MEMBRANE: Point[][] = [
  [[-12, -18], [-16, -12], [-20, -5], [-16, -8], [-12, -8], [-9, -5], [-10, -12]],
  [[-9, -13], [-8, -7], [-7, -3], [-4, -3], [-1, 2], [-4, -6], [-7, -12]]
];
const WING_FINGERS: Point[][] = [
  [[-12, -20], [-10, -16], [-8, -11], [-6, -6], [-3, 0], [1, 5]],
  [[-12, -19], [-13, -13], [-12, -8], [-11, -2]],
  [[-12, -18], [-16, -11], [-21, -4]]
];
// Both membrane currents start at the shoulder and curl into the same sail.
// They stay inside the membrane; the wing's structural fingers remain still.
const WING_CURRENTS: Point[][] = ([
  [[1, 4], [-3, -2], [-6, -7], [-9, -12], [-12, -19]],
  [[-1, 3], [-6, -3], [-9, -7], [-12, -12], [-15, -12], [-18, -8], [-21, -3]]
] as Point[][]).map(curve);
// This is a surface current, not an orbit around the sprite's bounding box.
const CURRENT: Point[] = curve([
  [-24, 6], [-22, 11], [-18, 13], [-14, 12], [-10, 9], [-6, 7],
  [-2, 8], [2, 8], [5, 6], [7, 3], [8, -1], [8, -5],
  [10, -8], [13, -10], [16, -9], [20, -9], [23, -10]
]);

/** Smooth only the current's route; the authored pixel silhouette is unchanged. */
function curve(points: Point[]): Point[] {
  const smooth: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i];
    const c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    for (let step = 0; step < 4; step++) {
      const t = step / 4, t2 = t * t, t3 = t2 * t;
      smooth.push([0, 1].map(k => .5 * (2 * b[k] + (-a[k] + c[k]) * t
        + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2
        + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)) as Point);
    }
  }
  smooth.push(points[points.length - 1]);
  return smooth;
}

// Polygon extents are immutable. Reject pixels in the empty parts of the
// dragon envelope before walking every edge; inclusive bounds preserve edges.
const polygonExtents = new WeakMap<Point[], Box>();
function contains(path: Point[], x: number, y: number): boolean {
  let q = polygonExtents.get(path);
  if (!q) {
    q = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
    for (const [px, py] of path) {
      q.l = Math.min(q.l, px); q.t = Math.min(q.t, py);
      q.r = Math.max(q.r, px); q.b = Math.max(q.b, py);
    }
    polygonExtents.set(path, q);
  }
  return x >= q.l && x <= q.r && y >= q.t && y <= q.b && inPoly(path, x, y);
}

interface PathSegment { ax: number; ay: number; dx: number; dy: number; squared: number; len: number; at: number }
const measuredPaths = new WeakMap<Point[], { segments: PathSegment[]; length: number }>();

/** Cache immutable path measurements, not frames or images. */
function measure(path: Point[]): { segments: PathSegment[]; length: number } {
  const cached = measuredPaths.get(path);
  if (cached) return cached;
  let length = 0;
  const segments = path.slice(1).map(([bx, by], i) => {
    const [ax, ay] = path[i], dx = bx - ax, dy = by - ay, squared = dx * dx + dy * dy;
    const len = Math.sqrt(squared), segment = { ax, ay, dx, dy, squared, len, at: length };
    length += len; return segment;
  });
  const measured = { segments, length }; measuredPaths.set(path, measured); return measured;
}

/** Nearest point and distance along an authored polyline. */
function along(path: Point[], x: number, y: number): { d: number; side: number; at: number; length: number } {
  const measured = measure(path);
  let squared = Infinity, sign = 1, at = 0;
  for (const segment of measured.segments) {
    const { ax, ay, dx, dy, len } = segment;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / segment.squared));
    const px = x - ax - dx * u, py = y - ay - dy * u, candidate = px * px + py * py;
    if (candidate < squared) {
      squared = candidate; sign = dx * (y - ay) - dy * (x - ax) < 0 ? -1 : 1;
      at = segment.at + len * u;
    }
  }
  const d = Math.sqrt(squared);
  return { d, side: d * sign, at, length: measured.length };
}

/** A moving body of water, with an advected trough, broad volume and crest. */
function flowingBand(
  water: ReturnType<typeof along>, clock: number, width: number, sway: number
): number | null {
  const wave = water.at * .28 - clock;
  const edge = Math.min(1, water.at / 4, (water.length - water.at) / 4);
  const center = Math.sin(wave) * sway * edge;
  const breadth = width + Math.cos(wave - .8) * .25 * edge;
  const side = water.side - center;
  if (Math.abs(side) > breadth) return null;
  // The lower refraction and upper crest travel together. Changing their
  // position and cross-section makes water flow, rather than blink or glitter.
  if (side < -breadth + .38) return 2;
  const crest = .18 + Math.sin(wave * 2 + .7) * .16 * edge;
  if (Math.abs(side - crest) < .59 + .1 * Math.cos(wave)) return 4;
  return 3;
}

/** Occupied loop envelope relative to the sprite origin, shared with layout. */
export function waterDragonBounds(s: number): Box {
  const scale = Math.max(.05, Number.isFinite(s) && s > 0 ? s / 15 : 1 / 15);
  // The rooted cycle extends only the nodding head and its horns. Folding
  // wings and the tail remain inside the existing width/ground footprint.
  const tiny = scale < 4 / 15;
  const halfW = Math.ceil((tiny ? 25 : 26.7) * scale + 1.5);
  const halfH = Math.ceil((tiny ? 21.5 : 22) * scale + 1.5);
  return { l: -halfW, t: -halfH, r: halfW, b: halfH };
}

// At the eight-orbit scale (s = 2.1), separate outlines, fingers and refraction
// troughs become a checkerboard. This authored miniature keeps the identifying
// wing, forward muzzle and curled tail in one luminous, readable cluster.
const TINY_DRAGON = [
  '  3   3  ',
  ' 33  3344',
  '3333 3   ',
  '3 3333   ',
  ' 33332   ',
  '  3  3   ',
  '  2  2   '
] as const;
const SMALL_DRAGON = [' 3  344', '333 3  ', '3 333  ', ' 3323  ', '  2 2  '] as const;
const SMALLEST_DRAGON = [' 3 34', '3333 ', ' 33  '] as const;
// A quick water-wing stroke followed by a longer, softer reopening.
const WING_FOLD = [0, .48, 1, .86, .65, .42, .2, .06] as const;

/**
 * One original, palette-indexed water dragon. Rooted chest/neck motion leads a
 * folding wing and lagging curled tail; currents remain attached to anatomy.
 * Returns the complete eight-frame envelope, including its pixel outline.
 */
export function paintCoherentWaterDragon(
  body: Pix, x: number, y: number, s: number, ramp: RGB[], seed: number, phase: number, reverse = false
): Box {
  const scale = Math.max(.05, Number.isFinite(s) && s > 0 ? s / 15 : 1 / 15);
  const ox = Math.round(x), oy = Math.round(y);
  const direction = reverse ? -1 : 1;
  const bounds = waterDragonBounds(s);
  const q = { l: ox + bounds.l, t: oy + bounds.t, r: ox + bounds.r, b: oy + bounds.b };
  const colors: RGB[] = ramp.length ? ramp : [[18, 35, 70], [23, 70, 106], [35, 126, 155], [77, 186, 197], [157, 229, 223], [236, 255, 241]];
  const c = (i: number): RGB => colors[Math.round(i * (colors.length - 1) / 5)];
  const insideAny = (parts: Point[][], px: number, py: number): boolean => parts.some(p => contains(p, px, py));
  const frame = ((Math.round(Number.isFinite(phase) ? phase : 0) % 8) + 8) % 8;
  const offset = ((Math.trunc(seed) % 3) + 3) % 3;
  const clock = (frame + offset) * Math.PI / 4;
  const turn = frame * Math.PI / 4;
  const lift = -.85 * Math.sin(turn), headX = 1.7 * Math.sin(turn), headY = -.9 * Math.sin(turn);
  const fold = WING_FOLD[frame];
  const tailSwing = 2.2 * Math.sin(turn - Math.PI / 2), tailCurl = 1.4 * Math.sin(turn - Math.PI / 4);
  const clamp = (v: number): number => Math.max(0, Math.min(1, v));

  if (scale < 4 / 15) {
    const halfW = Math.max(2, Math.floor(25 * scale) + 1);
    const halfH = Math.max(1, Math.floor(21.5 * scale));
    const smallest = halfH < 2, small = halfH === 2;
    const pixels = smallest ? SMALLEST_DRAGON : small ? SMALL_DRAGON : TINY_DRAGON;
    const gridX = smallest ? 2 : small ? 3 : 4, gridY = smallest ? 1 : small ? 2 : 3;
    for (let dy = -halfH; dy <= halfH; dy++) for (let dx = -halfW; dx <= halfW; dx++) {
      const u = Math.round(dx * gridX / halfW), v = Math.round(dy * gridY / halfH);
      const value = pixels[v + gridY][u + gridX];
      if (value === ' ') continue;
      // One restrained crest moves across a consistently cyan body. The muzzle
      // and silhouette never blink, and no navy cuts through the tiny anatomy.
      const crest = !smallest && v === 1 && u === [-3, -3, -2, -1, 0, 0, -1, -2][frame];
      const wingDrop = dx < 0 && dy < 0 ? Math.round(fold * Math.min(1, halfH * .3) * -dy / halfH) : 0;
      const tailBend = dx < -halfW * .45 && dy >= 0
        ? Math.round(Math.sin(turn - Math.PI / 2) * Math.min(1, halfH * .25) * clamp((-dx - halfW * .45) / (halfW * .55))) : 0;
      body.set(ox + dx * direction, oy + dy + wingDrop + tailBend, c(crest ? 4 : Number(value)));
    }
    return q;
  }
  let painted = false;

  // Inverse sampling keeps the existing immutable polygon/path measurements.
  // No generated frame, deformed geometry or image is cached.
  const neckWeight = (u: number, v: number): number => clamp((u - 2) / 11) * clamp((3 - v) / 11);
  const chestWeight = (u: number, v: number): number => clamp((18 - v) / 13) * clamp((u + 14) / 8);
  const tailOffset = (u: number): number => {
    const w = clamp((-u - 7) / 18);
    return tailSwing * w + tailCurl * w * w;
  };
  const unwarp = (a: number, b: number): Point => {
    let u = a, v = b;
    for (let i = 0; i < 3; i++) {
      const neck = neckWeight(u, v), chest = chestWeight(u, v);
      const tail = tailOffset(u);
      u = a - headX * neck;
      v = b - lift * chest - headY * neck - tail;
    }
    return [u, v];
  };
  const warp = (u: number, v: number): Point => {
    const neck = neckWeight(u, v);
    return [u + headX * neck, v + lift * chestWeight(u, v) + headY * neck + tailOffset(u)];
  };
  const wingX = 1 - .22 * fold, wingY = 1 - .24 * fold;
  const rearFold = WING_FOLD[(frame + 7) % 8];
  const rearX = 1 - .16 * rearFold, rearY = 1 - .2 * rearFold;

  body.shape(q.l, q.t, q.r, q.b, (px, py) => {
    const a = (px - ox) * direction / scale, b = (py - oy) / scale;
    const [u, v] = unwarp(a, b);
    const wu = 1 + (a - 1) / wingX, wv = 5 + (b - lift - 5) / wingY;
    const ru = 3 + (a - 3) / rearX, rv = 5 + (b - lift - 5) / rearY;
    let lv = b;
    for (let i = 0; i < 2; i++) lv = b - lift * chestWeight(a, lv);
    const trunk = contains(TRUNK, u, v), horn = insideAny(HORNS, u, v);
    const rear = contains(REAR_WING, ru, rv) || insideAny(REAR_LIMBS, a, lv);
    const wing = contains(WING, wu, wv), limb = insideAny(FRONT_LIMBS, a, lv);
    if (!(trunk || horn || rear || wing || limb)) return null;
    painted = true;
    // Far forms remain cooler than the front, but no longer disappear into a
    // flat navy silhouette against the night scene.
    let color = c(2);

    if (trunk || horn) {
      color = c(2);
      if (insideAny(WATER_PLANES, u, v)) color = c(3);
      if (contains(BELLY, u, v)) color = c(2);
      if (contains(DEEP_WATER, u, v)) color = c(1);
      if (contains(NECK_LIGHT, u, v)) color = c(3);
      // Small angular crests are part of the head, never floating particles.
      if (horn && u < 16 && u + v < -3) color = c(3);
    }

    if (limb) {
      color = c(3);
      if ((a < -5 && lv > 12) || (a > 4 && a < 7 && lv > 11)) color = c(2);
      if ((a > -7 && a < -3 && lv > 7 && lv < 10) || (a > 6 && a < 8 && lv > 7 && lv < 12)) color = c(4);
    }

    if (wing) {
      color = c(2);
      if (insideAny(WING_MEMBRANE, wu, wv)) color = c(3);
      if (WING_FINGERS.some(p => along(p, wu, wv).d < .6)) color = c(3);
      // The wing root flows into the shoulder, rather than ending in a block.
      if (wu > -3 && wv > 0) color = c(3);
      for (let i = 0; i < WING_CURRENTS.length; i++) {
        const current = along(WING_CURRENTS[i], wu, wv);
        const level = flowingBand(current, clock - i * .8, .9, .45);
        if (level !== null) color = c(level);
      }
    }
    // The current crosses the haunch and shoulder as one continuous ribbon;
    // drawing it after those planes prevents isolated decorative cyan spots.
    if (trunk) {
      const water = along(CURRENT, u, v);
      const width = u < -13 ? 1.15 : 1.8;
      // Flow settles before the cheek, keeping the eye, mouth and facial
      // highlights identical in every frame, even in the smaller copies.
      const settle = Math.max(0, Math.min(1, (13 - u) / 3));
      if (settle > 0) {
        const level = flowingBand(water, clock, width, .72 * settle);
        if (level !== null) color = c(level);
      } else if (water.d < 1.65) color = c(water.d < .52 ? 4 : 3);
    }
    return color;
  }, c(0));

  // Surface details are clipped to the painted silhouette. Draw these last so
  // neither the travelling reflection nor the wing can erase the face.
  const mark = (u: number, v: number, color: RGB): void => {
    const [a, b] = warp(u, v);
    const px = ox + Math.round(a * scale) * direction, py = oy + Math.round(b * scale);
    if (px < q.l || px > q.r || py < q.t || py > q.b || px < 0 || px >= body.w || py < 0 || py >= body.h) return;
    if (body.data[(py * body.w + px) * 4 + 3]) body.set(px, py, color);
  };
  const line = (path: Point[], color: RGB): void => {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) * scale));
      for (let j = 0; j <= steps; j++) mark(a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps, color);
    }
  };
  if (scale >= .6) {
    // Restrained foreleg joints and two toes, not an all-over scale texture.
    line([[-6, 10], [-4, 11], [-6, 13]], c(2));
    line([[8, 13], [8, 16], [10, 18]], c(4));
    mark(-7, 20, c(0)); mark(-4, 20, c(0)); mark(11, 20, c(0)); mark(14, 20, c(0));
    line([[14, -12], [17, -13], [19, -12]], c(4));
    line([[19, -10], [23, -10]], c(0));
    mark(23, -12, c(0));
    mark(17, -12, c(0)); mark(18, -12, c(0));
    mark(18, -13, c(5));
  } else if (scale >= .3) {
    mark(18, -12, c(0)); mark(18, -13, c(4));
    mark(22, -10, c(0));
  }
  if (!painted) body.set(ox, oy, c(2));
  return q;
}
