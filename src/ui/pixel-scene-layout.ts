import type { Appearance, Being } from '../core/appearance';
import { intentionBounds } from './pixel-intention';
import { glyphBounds } from './pixel-intention-glyph';
import { spellSpriteOf, spellSpriteBounds } from './pixel-spell-sprites';

/** Logical pixels in the 180 × 105 scene. The floor is at y = 97. */
export interface OrbitPose {
  count: number;
  angle: number;
  tangent: [number, number];
  c: [number, number];
  rx: number;
  ry: number;
  behind: boolean;
  /** Identical copies share one stable visual clock across the cyclic slot permutation. */
  renderIndex: number;
}
export interface Pose { x: number; y: number; s: number; orbit?: OrbitPose }
export interface SceneBox { l: number; t: number; r: number; b: number }
export interface PartLayout { parts: { shape: string; x: number }[]; width: number; top: number; bottom: number }
export interface SceneRing { c: [number, number]; rx: number; ry: number; element: string; members: Being[]; angularStep: number }
export interface SceneLayout {
  casterX: number;
  poses: Map<Being, Pose>;
  rings: SceneRing[];
  flightPos: [number, number];
  flightHalf: number;
}

export const INTENTION_SCENE_LIMIT = 6;

/**
 * Intenção numérica repeats only the illustrated manifestation. Six copies are
 * a visual sample for larger counts; the exact number and game rules stay in ap.
 */
export function appearanceForScene(ap: Appearance): Appearance {
  const countOf = (b: Being): number => {
    const count = b.intentCount;
    if (!count || !/^[1-9]\d*$/.test(count)) return 0;
    return count.length > 1 ? INTENTION_SCENE_LIMIT : Math.min(INTENTION_SCENE_LIMIT, Number(count));
  };
  if (!ap.beings.some(b => countOf(b))) return ap;
  const beings = ap.beings.flatMap(b => {
    const count = countOf(b);
    if (!count) return [b];
    return Array.from({ length: count }, (_, index): Being => {
      const copy: Being = {
        ...b, elements: [...b.elements], shapes: [...b.shapes], concepts: [...b.concepts], guards: [...b.guards],
        bond: index === 0 ? b.bond : null
      };
      // Mark the visual expansion as consumed; rendering it again is idempotent.
      delete copy.intentCount;
      return copy;
    });
  });
  return { ...ap, beings, orbitCount: beings.filter(b => b.orbit).length };
}

const FLOOR = 97;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const flying = (b: Being): boolean => b.projectile || b.placement === 'flight';

/** Bounds of the same primitives used by the raster renderer, before translation. */
function partBounds(shape: string, s: number, flight: boolean): SceneBox {
  if (shape === 'forma_esfera') return { l: -.82 * s, t: -.82 * s, r: .82 * s, b: .82 * s };
  if (shape === 'forma_piramide') return flight
    ? { l: -.8 * s, t: -.85 * s, r: 1.3 * s, b: .85 * s }
    : { l: -s, t: -1.15 * s, r: s, b: .95 * s };
  if (shape === 'forma_cubo' || shape === 'forma_paralelepipedo') {
    const w = shape === 'forma_cubo' ? 1.3 * s : (flight ? 2.2 : 1.1) * s;
    const h = shape === 'forma_cubo' ? 1.3 * s : (flight ? 1.05 : 2.45) * s;
    const d = Math.round(Math.min(w, h) * .38);
    // The half-pixel allowance also covers rounding the primitive's origin.
    return { l: -(w + d) / 2 - .5, t: -(h + d) / 2 - .5, r: (w + d) / 2 + .5, b: (h + d) / 2 + .5 };
  }
  return { l: -.82 * s, t: -.82 * s, r: .82 * s, b: .82 * s };
}

/** Ligação closes the seams; Projétil also turns the long axis and puts tips last. */
export function layoutParts(b: Being, scale: number): PartLayout {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const sprite = spellSpriteOf(b);
  if (sprite) {
    const q = spellSpriteBounds(sprite, s, b.placement === 'flight' && !b.orbit);
    // Asymmetric crowns and wakes reserve both orientations around the origin.
    const half = Math.max(-q.l, q.r);
    return { parts: b.intentForm ? [] : [{ shape: 'forma_esfera', x: 0 }], width: half * 2, top: q.t, bottom: q.b };
  }
  if (b.intentForm) {
    const q = intentionBounds(b.intentForm, s);
    return { parts: [], width: q.r - q.l, top: q.t, bottom: q.b };
  }
  if (b.intentGlyph) {
    const q = glyphBounds(b.intentGlyph, s);
    return { parts: [], width: q.r - q.l, top: q.t, bottom: q.b };
  }
  const flight = flying(b);
  const shapes = flight
    ? [...b.shapes.filter(q => q !== 'forma_piramide'), ...b.shapes.filter(q => q === 'forma_piramide')]
    : [...b.shapes];
  if (!shapes.length) return { parts: [], width: s * 1.6, top: -s * .8, bottom: s * .8 };
  const boxes = shapes.map(shape => partBounds(shape, s, flight));
  const gap = b.linked && b.merged ? -Math.max(.8, s * .15) : flight ? -.1 * s : b.linked ? -.5 : Math.max(3, s * .32);
  const width = boxes.reduce((sum, q) => sum + q.r - q.l, 0) + gap * (boxes.length - 1);
  let cursor = -width / 2;
  const parts = shapes.map((shape, i) => {
    const q = boxes[i], x = cursor - q.l;
    cursor += q.r - q.l + gap;
    return { shape, x };
  });
  return { parts, width, top: Math.min(...boxes.map(q => q.t)), bottom: Math.max(...boxes.map(q => q.b)) };
}

/** Conservative body box, excluding the intentionally soft glow and trails. */
export function boundsOfBeing(b: Being, p: Pose): SceneBox {
  const q = layoutParts(b, p.s);
  return { l: p.x - q.width / 2, r: p.x + q.width / 2, t: p.y + q.top, b: p.y + q.bottom };
}

interface Region { l: number; t: number; r: number; b: number }
const padding = (b: Being, s: number): number => 4 + s * .3 + (b.concepts.length ? 3 : 0);
const atScale = (b: Being, s: number): { w: number; h: number } => {
  const q = layoutParts(b, s), pad = padding(b, s);
  return { w: q.width + pad * 2, h: q.bottom - q.top + pad * 2 };
};

function largestScale(test: (s: number) => boolean, maximum: number): number {
  if (test(maximum)) return maximum;
  let lo = .05, hi = maximum;
  for (let i = 0; i < 32; i++) {
    const s = (lo + hi) / 2;
    if (test(s)) lo = s; else hi = s;
  }
  // Pixel bounds have exact steps; keep a feasible boundary such as 2.5 stable
  // instead of returning a binary-search epsilon below it.
  const snapped = Math.round(lo * 1e6) / 1e6;
  return snapped >= lo && test(snapped) ? snapped : lo;
}

/** Grid dimensions are selected by available body size, rather than a fixed offset. */
function pack(beings: Being[], region: Region, poses: Map<Being, Pose>, maximum: number, groundRow = false, margin = padding): void {
  if (!beings.length) return;
  const width = region.r - region.l, height = region.b - region.t;
  let best = { cols: beings.length, rows: 1, s: 0 };
  for (let cols = 1; cols <= beings.length; cols++) {
    const rows = Math.ceil(beings.length / cols);
    if (groundRow && rows !== 1) continue;
    const s = largestScale(scale => beings.every(b => {
      const q = layoutParts(b, scale), pad = margin(b, scale);
      return q.width + pad * 2 <= width / cols && q.bottom - q.top + pad * 2 <= height / rows;
    }), maximum);
    if (s > best.s + .001) best = { cols, rows, s };
  }
  const cellW = width / best.cols, cellH = height / best.rows;
  beings.forEach((b, i) => {
    const q = layoutParts(b, best.s);
    const row = Math.floor(i / best.cols), count = Math.min(best.cols, beings.length - row * best.cols);
    const x = (region.l + region.r) / 2 + (i % best.cols - (count - 1) / 2) * cellW;
    const y = groundRow
      ? region.b - margin(b, best.s) - q.bottom
      : region.t + (row + .5) * cellH - (q.top + q.bottom) / 2;
    poses.set(b, { x, y, s: best.s });
  });
}

const overlaps = (a: SceneBox, b: SceneBox, gap = 2): boolean => a.l < b.r + gap && a.r + gap > b.l && a.t < b.b + gap && a.b + gap > b.t;

/** Eight complete poses also serve as pause/reduced-motion stills. */
const scenePhase = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;

/** Only visually interchangeable members may permute slots when the cycle wraps. */
function sameOrbitAppearance(a: Being, b: Being): boolean {
  const key = (q: Being): string => JSON.stringify([
    q.elements, q.shapes, q.concepts, q.placement, q.projectile, q.direction,
    q.guards, q.estado, q.linked, q.merged, q.intentForm, q.intentGlyph, q.bond
  ]);
  return key(a) === key(b);
}

/**
 * Equal-angle travel on a shared, frame-independent ellipse. Eight identical
 * sprites advancing by 45° would only swap places and look stationary, so an
 * interchangeable cohort advances one slot over the whole eight-frame loop.
 * Distinct beings make a full turn and retain their own material identity.
 */
function ring(beings: Being[], c: [number, number], wanted: [number, number], start: number,
  poses: Map<Being, Pose>, maximum: number, frame: number, allBeings: Being[], anchor?: Being,
  moving = true, protectedFace?: SceneBox): SceneRing {
  const interchangeable = beings.every(b => sameOrbitAppearance(beings[0], b));
  const angularStep = moving ? Math.PI * 2 / (8 * (interchangeable ? beings.length : 1)) : 0;
  const candidates = (s: number): { rx: number; ry: number; local: PartLayout[] } => {
    const boxes = beings.map(b => layoutParts(b, s));
    const horizontal = Math.max(...boxes.map((q, i) => q.width / 2 + padding(beings[i], s)));
    const vertical = Math.max(...boxes.map((q, i) => Math.max(-q.top, q.bottom) + padding(beings[i], s)));
    return {
      local: boxes,
      rx: Math.min(wanted[0], c[0] - 4 - horizontal, 176 - c[0] - horizontal),
      ry: Math.min(wanted[1], c[1] - 4 - vertical, 101 - c[1] - vertical)
    };
  };
  const poseAt = (s: number, rx: number, ry: number, i: number, phase: number): Pose => {
    const angle = i / beings.length * Math.PI * 2 + start + phase * angularStep;
    return { x: c[0] + Math.cos(angle) * rx, y: c[1] + Math.sin(angle) * ry, s };
  };
  const anchorPose = anchor ? poses.get(anchor) : undefined;
  const anchorBox = anchor && anchorPose ? boundsOfBeing(anchor, anchorPose) : undefined;
  const s = largestScale(scale => {
    const q = candidates(scale);
    if (q.rx < 6 || q.ry < 5) return false;
    // Fit the entire animation once: neither bodies nor radii breathe when a
    // member crosses the near/far half. Sprite bounds already include every
    // authored material pose, including a dragon's nodding head and wing.
    for (let phase = 0; phase < (moving ? 8 : 1); phase++) {
      const boxes = q.local.map((body, i): SceneBox => {
        const p = poseAt(scale, q.rx, q.ry, i, phase);
        return { l: p.x - body.width / 2, r: p.x + body.width / 2, t: p.y + body.top, b: p.y + body.bottom };
      });
      if (!boxes.every((box, i) => box.b <= FLOOR && (!anchorBox || !overlaps(box, anchorBox, 2))
        // The far half is painted behind the hood. On the near half even tall
        // manifestations must leave the caster's face and eyes unobstructed.
        && (!protectedFace || Math.sin(i / beings.length * Math.PI * 2 + start + phase * angularStep) < -1e-9
          || !overlaps(box, protectedFace, 2))
        && boxes.slice(i + 1).every((other, j) => {
          const gap = beings[i].intentGlyph || beings[i + j + 1].intentGlyph ? 0 : 2;
          return !overlaps(box, other, gap);
        }))) return false;
    }
    return true;
  }, maximum);
  const { rx, ry } = candidates(s), phase = scenePhase(frame);
  beings.forEach((b, i) => {
    const p = poseAt(s, rx, ry, i, phase);
    if (moving) {
      const angle = i / beings.length * Math.PI * 2 + start + phase * angularStep;
      const dx = -rx * Math.sin(angle), dy = ry * Math.cos(angle), length = Math.hypot(dx, dy);
      p.orbit = { count: beings.length, angle, tangent: [dx / length, dy / length], c: [...c], rx, ry,
        behind: Math.sin(angle) < -1e-9,
        renderIndex: allBeings.indexOf(interchangeable ? beings[0] : b) };
    }
    poses.set(b, p);
  });
  return { c, rx, ry, angularStep, element: beings[0].elements[0] ?? beings[0].concepts[0] ?? 'movimento', members: [...beings] };
}

/** Placement and structural composition are independent: a projectile may also touch or return. */
export function layoutScene(ap: Appearance, animationFrame = 0): SceneLayout {
  const poses = new Map<Being, Pose>(), rings: SceneRing[] = [];
  const group = (placement: Being['placement']): Being[] => ap.beings.filter(b => !b.orbit && b.placement === placement);
  const orbiting = ap.beings.filter(b => b.orbit);
  const nonOrbit = ap.beings.filter(b => !b.orbit);
  const orbitAnchor = nonOrbit.find(b => b.placement !== 'escort') ?? nonOrbit[0];
  const wideSelf = group('self').some(b => layoutParts(b, 3).width > 28);
  const casterX = wideSelf || (orbiting.length && (!nonOrbit.length || orbitAnchor?.placement === 'self')) ? 55 : 18;
  const fronts = group('front'), flights = group('flight'), touches = group('touch'), far = group('far');
  const farLeft = far.length ? 174 - Math.max(48, ...far.map(b => Math.min(98, atScale(b, 2.7).w))) : 126;
  const primaryRight = far.length ? Math.min(136, farLeft + 10) : 160;
  const primaryBottom = touches.length ? 66 : 91;
  const primaryMid = (48 + primaryRight) / 2;
  pack(fronts, { l: 48, r: flights.length ? primaryMid - 3 : primaryRight, t: 14, b: primaryBottom }, poses, 15);
  pack(flights, { l: fronts.length ? primaryMid + 3 : 48, r: primaryRight, t: 14, b: primaryBottom }, poses, 15);
  pack(touches, { l: casterX + 24, r: far.length ? 132 : 149, t: 58, b: 100 }, poses, 15, true);
  pack(far, { l: farLeft, r: 174, t: 16, b: 100 }, poses, 15);
  const selfHalf = wideSelf ? 45 : 18;
  // Returned magic rests over the robe; leave the face and hood above y = 77 clear.
  pack(group('self'), { l: Math.max(2, casterX - selfHalf), r: casterX + selfHalf, t: 77, b: 99 }, poses, 7.5, false, (_, s) => 1.5 + s * .15);

  // Keep simple scenes recognisable; packed scenes use the same measured bounds.
  if (fronts.length === 1 && !flights.length) {
    const b = fronts[0], p = poses.get(b)!;
    const q = layoutParts(b, p.s), pad = padding(b, p.s);
    p.x = clamp(92, 48 + q.width / 2 + pad, primaryRight - q.width / 2 - pad);
    const grounded = !b.intentForm && !b.intentGlyph && !flying(b) && b.shapes.length > 0 && b.shapes.every(q => q === 'forma_cubo' || q === 'forma_paralelepipedo');
    p.y = grounded && !touches.length && !orbiting.length ? FLOOR - layoutParts(b, p.s).bottom : 48;
  }
  if (flights.length === 1 && !fronts.length) {
    const b = flights[0], p = poses.get(b)!, q = layoutParts(b, p.s), pad = padding(b, p.s);
    p.x = clamp(102, 48 + q.width / 2 + pad, primaryRight - q.width / 2 - pad); p.y = 50;
  }
  if (touches.length === 1) {
    const b = touches[0], p = poses.get(b)!, q = layoutParts(b, p.s), pad = padding(b, p.s);
    p.x = clamp(casterX + 45, casterX + 24 + q.width / 2 + pad, (far.length ? 132 : 149) - q.width / 2 - pad);
    p.y = 96 - q.bottom;
  }
  if (far.length === 1) {
    const b = far[0], p = poses.get(b)!, q = layoutParts(b, p.s), pad = padding(b, p.s);
    p.x = clamp(150, farLeft + q.width / 2 + pad, 174 - q.width / 2 - pad);
    p.y = 96 - q.bottom;
  }

  const flight = flights[0];
  const flightPose = flight ? poses.get(flight)! : { x: 102, y: 50, s: 15 };
  const flightPos: [number, number] = [flightPose.x, flightPose.y];
  let flightHalf = flight ? layoutParts(flight, flightPose.s).width / 2 : 15;
  const escorts = group('escort');
  if (escorts.length) {
    const wanted: [number, number] = [Math.max(22, flightHalf + 10), 23];
    const r = ring(escorts, flightPos, wanted, -Math.PI / 2, poses, 7.5, 0, ap.beings, flight, false);
    if (escorts.some(b => b.concepts.includes('movimento'))) { r.element = 'movimento'; rings.push(r); }
  }
  if (orbiting.length) {
    const anchor = orbitAnchor;
    const p = anchor ? poses.get(anchor)! : undefined;
    if (anchor && p) {
      const returning = anchor.placement === 'self';
      p.s = largestScale(s => { const q = layoutParts(anchor, s); return q.width <= 62 && q.bottom - q.top <= (returning ? 10.5 : 28); }, p.s);
      // Leave room for the near side to pass beside the caster; a returned
      // spell keeps its actual robe position as the centre of its orbit.
      if (!returning) p.x = clamp(p.x, casterX + 65, 125);
      p.y = returning ? Math.max(82.5, 77 - layoutParts(anchor, p.s).top) : Math.min(p.y, 60);
    }
    const c: [number, number] = p ? [p.x, p.y] : [casterX + 1, 65];
    const bounds = anchor && p ? layoutParts(anchor, p.s) : undefined;
    const rx = bounds ? Math.max(37, bounds.width / 2 + 16) : 43;
    const ry = bounds ? Math.max(21, (bounds.bottom - bounds.top) / 2 + 13) : 23;
    rings.push(ring(orbiting, c, [rx, ry], anchor ? Math.PI / 2 : 0, poses, 9.9, animationFrame, ap.beings, anchor, true, { l: casterX - 6, r: casterX + 8, t: 65, b: 78 }));
  }
  if (flight) { flightPos[0] = flightPose.x; flightPos[1] = flightPose.y; flightHalf = layoutParts(flight, flightPose.s).width / 2; }
  return { casterX, poses, rings, flightPos, flightHalf };
}
