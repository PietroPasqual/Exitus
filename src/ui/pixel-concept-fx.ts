import type { Pix, RGB } from './pixel';

/** These are the eight defined, nonphysical concepts, not additional materials. */
export const CONCEPT_MOTIFS = ['tempo', 'movimento', 'pressao', 'caos', 'infinito', 'vazio', 'vida', 'morte'] as const;
type Point = readonly [number, number];

export interface ConceptAuraOptions {
  /** Include airy interior echoes when the concept has no material body. */
  glow?: boolean;
  /** Existing eight-frame visual clock; this never moves the Being itself. */
  frame?: number;
  /** Legacy scene hint: omit secondary decoration on busy material mixtures. */
  ring?: boolean;
  /** Existing body half-extents + aura padding; only contracts the FX fit. */
  radii?: { x: number; y: number };
  /** Read-only by convention. The field never writes to this finished body. */
  body?: Pix;
  /** Scene-owned mask: previously composed bodies and the caster face. */
  protectedPixels?: Uint8Array;
  /** Required with body; limits the contour and hole-protection scan. */
  bodyBounds?: { l: number; t: number; r: number; b: number };
}

interface BodyAnalysis {
  clip: { l: number; t: number; w: number; h: number; open: Uint8Array };
  solid: Uint8Array;
  contour: Point[];
}
// One native-sized surface, never a frame-keyed history. Alpha is validated on
// reuse: callers may repaint a Pix between calls without stale hole/edge masks.
let recentBody: { target: Pix; body: Pix; cx: number; cy: number; value: BodyAnalysis } | undefined;
const MAX_CACHED_BODY_PIXELS = 65536;
function analyzeBody(pix: Pix, body: Pix, bounds: NonNullable<ConceptAuraOptions['bodyBounds']>, cx: number, cy: number): BodyAnalysis | undefined {
  const l = Math.max(0, Math.floor(bounds.l) - 2), t = Math.max(0, Math.floor(bounds.t) - 2);
  const w = Math.min(pix.w, body.w, Math.ceil(bounds.r) + 3) - l, h = Math.min(pix.h, body.h, Math.ceil(bounds.b) + 3) - t;
  if (w <= 0 || h <= 0) return undefined;
  const cached = recentBody;
  if (cached?.target === pix && cached.body === body && cached.cx === cx && cached.cy === cy &&
    cached.value.clip.l === l && cached.value.clip.t === t && cached.value.clip.w === w && cached.value.clip.h === h) {
    let unchanged = true;
    for (let y = 0; y < h && unchanged; y++) for (let x = 0; x < w; x++) {
      if (cached.value.solid[y * w + x] !== (body.data[((y + t) * body.w + x + l) * 4 + 3] ? 1 : 0)) { unchanged = false; break; }
    }
    if (unchanged) return cached.value;
  }
  const solid = new Uint8Array(w * h), open = new Uint8Array(w * h), queue = new Int32Array(w * h), contour: Point[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) solid[y * w + x] = body.data[((y + t) * body.w + x + l) * 4 + 3] ? 1 : 0;
  let head = 0, tail = 0;
  const visit = (at: number): void => { if (!solid[at] && !open[at]) { open[at] = 1; queue[tail++] = at; } };
  for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { visit(y * w); visit(y * w + w - 1); }
  while (head < tail) {
    const at = queue[head++], x = at % w, y = Math.floor(at / w);
    if (x) visit(at - 1); if (x < w - 1) visit(at + 1);
    if (y) visit(at - w); if (y < h - 1) visit(at + w);
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const at = y * w + x;
    if (open[at] && (solid[at - 1] || solid[at + 1] || solid[at - w] || solid[at + w])) contour.push([x + l - cx, y + t - cy]);
  }
  const value = { clip: { l, t, w, h, open }, solid, contour };
  recentBody = pix.w * pix.h <= MAX_CACHED_BODY_PIXELS && body.w * body.h <= MAX_CACHED_BODY_PIXELS ? { target: pix, body, cx, cy, value } : undefined;
  return value;
}

/**
 * Original pixel fields, painted BEHIND the material body. Their short shaded
 * ribbons remain connected clusters rather than a shower of decorative ticks.
 * illustrate the source concepts without inventing a solid substance or rule:
 * dilation, velocity, reduction, shuffling, feedback, nullity, preservation,
 * regression. No common circular ring, particles, bloom or body displacement.
 * Every complete pause pose retains an identifying gesture. The r + 6
 * all-frame radial envelope matches the old concept decoration allowance.
 */
export function paintConceptAura(
  pix: Pix, concept: string, cx: number, cy: number, r: number, ramp: RGB[],
  { glow = true, frame = 0, ring = true, radii, body, bodyBounds, protectedPixels }: ConceptAuraOptions = {}
): void {
  if (!(CONCEPT_MOTIFS as readonly string[]).includes(concept) || !ramp.length ||
    !Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r <= 0) return;
  const phase = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const color = (tone: number): RGB => ramp[Math.round(tone * (ramp.length - 1))];
  // Dark concepts need a readable broken edge on the night sky as well as the
  // daytime ridge. The core stays unpainted; this is contrast, not bright bloom.
  const darkConcept = concept === 'vazio' || concept === 'morte';
  const quiet = color(darkConcept ? .58 : .35), main = color(darkConcept ? .79 : .58), light = color(darkConcept ? 1 : .79);
  const extent = r + 6, radius2 = extent * extent;
  const fit = (value: number | undefined): number => value !== undefined && Number.isFinite(value) && value > 0 ? Math.min(1, value / r) : 1;
  const scaleX = fit(radii?.x), scaleY = fit(radii?.y);
  const analysis = body && bodyBounds && [bodyBounds.l, bodyBounds.t, bodyBounds.r, bodyBounds.b].every(Number.isFinite)
    ? analyzeBody(pix, body, bodyBounds, cx, cy) : undefined;
  const bodyClip = analysis?.clip, contour = analysis?.contour ?? [];
  const plot = (x: number, y: number, ink: RGB): void => {
    const px = Math.round(cx + x), py = Math.round(cy + y);
    if (px < 0 || py < 0 || px >= pix.w || py >= pix.h || protectedPixels?.[py * pix.w + px]) return;
    if (bodyClip && px >= bodyClip.l && px < bodyClip.l + bodyClip.w && py >= bodyClip.t && py < bodyClip.t + bodyClip.h &&
      !bodyClip.open[(py - bodyClip.t) * bodyClip.w + px - bodyClip.l]) return;
    if ((px - cx) ** 2 + (py - cy) ** 2 <= radius2) pix.set(px, py, ink);
  };
  const attach = ([x, y]: Point): Point => {
    if (!contour.length || !bodyClip) return [x, y];
    const px = Math.round(cx + x), py = Math.round(cy + y);
    if (px >= bodyClip.l && px < bodyClip.l + bodyClip.w && py >= bodyClip.t && py < bodyClip.t + bodyClip.h &&
      !bodyClip.open[(py - bodyClip.t) * bodyClip.w + px - bodyClip.l]) return [x, y];
    let nearest: Point = contour[0], distance2 = Infinity;
    for (const p of contour) {
      const d = (x - p[0]) ** 2 + (y - p[1]) ** 2;
      if (d < distance2) { nearest = p; distance2 = d; }
    }
    const distance = Math.sqrt(distance2);
    const radial = Math.hypot(x / Math.max(1, r * scaleX), y / Math.max(1, r * scaleY));
    const gap = Math.min(distance, 1.3 + Math.max(0, radial - .85) * 6);
    return distance > 2.25 ? [nearest[0] + (x - nearest[0]) / distance * gap, nearest[1] + (y - nearest[1]) / distance * gap] : [x, y];
  };
  const fieldWidth = Math.max(1.6, Math.min(3.2, Math.min(r * scaleX, r * scaleY) * .19));
  /** A tapered, two-plane strip, rasterized directly on the native pixel grid. */
  const ribbon = (path: readonly Point[], width = fieldWidth, clock = phase,
    { cut, offset = [0, 0] }: { cut?: readonly [number, number]; offset?: Point } = {}): void => {
    const points = path.map(([x, y]): Point => {
      const fitted = attach([x * scaleX, y * scaleY]);
      // A choreographed offset is applied AFTER contour fitting. Contact can
      // guide the end of a gesture without erasing its visible approach/recoil.
      return [fitted[0] + offset[0], fitted[1] + offset[1]];
    });
    const lengths: number[] = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = lengths[lengths.length - 1];
    if (!total) return;
    // Cache the exact accumulated-length differences used by the original
    // rasterizer. Segment order and strict nearest-distance ties stay unchanged.
    const segments = [];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1], [bx, by] = points[i], dx = bx - ax, dy = by - ay;
      const length = lengths[i] - lengths[i - 1];
      if (length) segments.push({ ax, ay, dx, dy, length, length2: length * length, before: lengths[i - 1],
        l: Math.min(ax, bx) - width, r: Math.max(ax, bx) + width, t: Math.min(ay, by) - width, b: Math.max(ay, by) + width });
    }
    const left = Math.max(0, Math.floor(cx + Math.min(...points.map(p => p[0])) - width)), right = Math.min(pix.w - 1, Math.ceil(cx + Math.max(...points.map(p => p[0])) + width));
    const top = Math.max(0, Math.floor(cy + Math.min(...points.map(p => p[1])) - width)), bottom = Math.min(pix.h - 1, Math.ceil(cy + Math.max(...points.map(p => p[1])) + width));
    const pulse = (((clock % 8) + 8) % 8) / 8;
    const centerWidth = Math.max(1, r * scaleX), centerHeight = Math.max(1, r * scaleY);
    for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
      const x = px - cx, y = py - cy;
      // These pixels would be rejected by plot regardless of the nearest strip.
      if (protectedPixels?.[py * pix.w + px] || x * x + y * y > radius2) continue;
      if (bodyClip && px >= bodyClip.l && px < bodyClip.l + bodyClip.w && py >= bodyClip.t && py < bodyClip.t + bodyClip.h &&
        !bodyClip.open[(py - bodyClip.t) * bodyClip.w + px - bodyClip.l]) continue;
      if (!glow && Math.hypot(x / centerWidth, y / centerHeight) < .56) continue;
      let distance = Infinity, along = 0, signed = 0;
      for (const segment of segments) {
        // The actual half-width never exceeds width/2. A full-width box is
        // deliberately conservative, leaving a margin at floating-point edges.
        if (x < segment.l || x > segment.r || y < segment.t || y > segment.b) continue;
        const { ax, ay, dx, dy, length } = segment;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / segment.length2));
        const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
        if (d < distance) { distance = d; along = (segment.before + length * t) / total; signed = ((x - ax) * dy - (y - ay) * dx) / length; }
      }
      if (cut && along >= cut[0] && along <= cut[1]) continue;
      const taper = .48 + .52 * Math.pow(Math.sin(Math.PI * along), .65);
      if (distance > width * .5 * taper) continue;
      const wave = Math.min(Math.abs(along - pulse), 1 - Math.abs(along - pulse));
      const cutLip = cut && (Math.abs(along - cut[0]) < .065 || Math.abs(along - cut[1]) < .065);
      const ink = cutLip ? light : signed > width * .12 ? quiet : wave < .17 || (signed < -.3 && distance < width * .32) ? light : main;
      plot(x, y, ink);
    }
  };
  const arcPoints = (radius: number, start: number, sweep: number, count = 13): Point[] => Array.from({ length: count }, (_, i) => {
    const angle = start + i / (count - 1) * sweep;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });

  if (concept === 'tempo') {
    // Held frames and uneven outward advances separate local time echoes from
    // physical motion. Each short history plane remains open and nonphysical.
    const advance = [0, 0, 1, 3, 5, 5, 2, 0][phase];
    for (let side = 0; side < 2; side++) {
      const start = -Math.PI * .74 + side * Math.PI;
      const angle = start + .46, outward: Point = [Math.cos(angle), Math.sin(angle)];
      ribbon(arcPoints(Math.max(2, r - 2), start, .93), fieldWidth + .35, phase + side * 4);
      for (let echo = 1; echo <= (ring ? 2 : 1); echo++) {
        const delay = [0, 0, 1, 3, 5, 5, 2, 0][(phase + 8 - echo) % 8];
        const distance = echo + (echo === 1 ? advance : delay) * .75;
        ribbon(arcPoints(Math.max(2, r - 1), start + echo * .04, .9), fieldWidth * .85, phase + echo * 2 + side * 4,
          { offset: [outward[0] * distance, outward[1] * distance] });
      }
    }
    return;
  }

  if (concept === 'movimento') {
    // Opposed linear folds accelerate while their tails shorten. The field
    // changes its own local velocity; the Being never acquires an orbit here.
    const step = [0, 0, 1, 3, 5, 6, 3, 1][phase];
    for (const sign of [-1, 1]) {
      const y = sign * Math.max(3, r * .62), lead = r * .92 + step * .4;
      const tail = r - Math.max(5, r * .6) + step * .75;
      ribbon([[sign * tail, y + sign * 2], [sign * (tail + lead) / 2, y], [sign * lead, y]], fieldWidth + .9, phase + (sign < 0 ? 0 : 4), { offset: [sign * step * .2, sign * 2] });
      if ((ring || glow) && phase <= 4) ribbon([[sign * (tail - 2), y], [sign * (lead - 4), y]], fieldWidth * .78, phase + 3, { offset: [0, sign * 5] });
    }
    return;
  }

  if (concept === 'pressao') {
    // Four clear beats: held apart, two-step approach, contact/hold, fast recoil.
    // These wide energy planes travel 5 native pixels; the body never deforms.
    const lift = [5, 5, 2.8, 0, 0, 4, 5, 5][phase];
    const weight = [1.1, 1.35, 1.7, 2, 1.8, .5, .35, .7][phase];
    for (const sign of [-1, 1]) {
      const fold: Point[] = [[sign * (r - 1), -r * .54], [sign * (r - 3), -r * .25], [sign * (r - 3.7), 0], [sign * (r - 3), r * .25], [sign * (r - 1), r * .54]];
      ribbon(fold, fieldWidth + weight, phase + (sign < 0 ? 0 : 4), { offset: [sign * lift, 0] });
      if (phase >= 2 && phase <= 4) ribbon([[-r * .4, sign * (r - 1.5)], [0, sign * (r - 3)], [r * .4, sign * (r - 1.5)]], fieldWidth + .3, phase + 2);
      if (ring && (phase < 2 || phase > 5)) ribbon([[sign * (r - 3), -r * .22], [sign * (r - 4), 0], [sign * (r - 3), r * .22]], fieldWidth * .65, phase + 5, { offset: [sign * (lift + 2), 0] });
    }
    return;
  }

  if (concept === 'caos') {
    // Two held arrangements with a staggered, local change of interlocking
    // planes. Each fragment changes its joint, not merely its highlight.
    const d = Math.max(3, r), swap = [0, 0, .45, 1, 1, .55, 0, 0][phase];
    const from: Point[][] = [
      [[-.96 * d, -.18 * d], [-.86 * d, -.62 * d], [-.42 * d, -.96 * d], [-.1 * d, -.72 * d]],
      [[.28 * d, -.86 * d], [.8 * d, -.53 * d], [.66 * d, -.1 * d], [.98 * d, .14 * d]],
      [[.78 * d, .53 * d], [.2 * d, .94 * d], [-.25 * d, .68 * d], [-.86 * d, .59 * d]]
    ];
    const to: Point[][] = [
      [[-.96 * d, -.18 * d], [-.61 * d, -.9 * d], [-.18 * d, -.7 * d], [.12 * d, -.98 * d]],
      [[.28 * d, -.86 * d], [.94 * d, -.25 * d], [.72 * d, .24 * d], [.97 * d, .5 * d]],
      [[.78 * d, .53 * d], [.48 * d, .7 * d], [-.14 * d, .98 * d], [-.86 * d, .59 * d]]
    ];
    from.forEach((path, i) => {
      const fitted = path.map(([x, y], j): Point => [x + (to[i][j][0] - x) * swap, y + (to[i][j][1] - y) * swap]);
      ribbon(fitted, fieldWidth + (i === (swap > .5 ? 1 : 0) ? 1 : .2), Math.floor(phase / 2) * 2 + i * 3,
        { offset: i === 0 ? [-swap * 1.5, -swap] : i === 1 ? [swap * 1.5, swap * 2] : [-swap * 2, 0] });
    });
    if (glow) {
      ribbon([[-4, -3], [-1, -3], [-1, 2]], fieldWidth * .8, phase);
      ribbon([[4, 3], [1, 3], [1, -2]], fieldWidth * .8, phase + 4);
    }
    return;
  }

  if (concept === 'infinito') {
    // An arched outgoing current and a folded returning current share a turn
    // outside the right flank. Their deliberate asymmetry avoids a circular
    // orbit badge; the turn belongs to the continuous feedback field.
    const outgoing: Point[] = [[-r - 1, -.08 * r], [-.87 * r, -.55 * r], [-.38 * r, -.92 * r], [.32 * r, -.91 * r], [.8 * r, -.58 * r], [r + 1, -.15 * r]];
    const returning: Point[] = [[r + 1, .12 * r], [.77 * r, .53 * r], [.25 * r, .53 * r], [-.05 * r, .98 * r], [-.62 * r, .74 * r], [-r - 1, .16 * r]];
    ribbon([[r, -.2 * r], [r + 2, 0], [r + .5, .25 * r], [.77 * r, .3 * r]], fieldWidth + .7, phase);
    for (let side = 0; side < 2; side++) {
      const tick = (phase + side * 4) % 8;
      const reach = [.42, .55, .78, 1, 1, .8, .6, .42][tick];
      const path = side ? returning : outgoing;
      const end = reach * (path.length - 1), last = Math.floor(end);
      const current = path.slice(0, last + 1);
      if (last < path.length - 1) current.push([path[last][0] + (path[last + 1][0] - path[last][0]) * (end - last), path[last][1] + (path[last + 1][1] - path[last][1]) * (end - last)]);
      ribbon(current, fieldWidth + (tick >= 2 && tick <= 4 ? .9 : .15), tick);
    }
    return;
  }

  if (concept === 'vazio') {
    // The traveling notch removes and restores ONLY this field's own strip.
    // The dark plane and bright cut lip never consume or repaint the material.
    const notch = [.4, .4, .48, .56, .67, .7, .53, .44][phase];
    const gap = [.09, .1, .14, .21, .24, .13, .08, .09][phase];
    for (const sign of [-1, 1]) {
      const path: Point[] = [[-.12 * r, -r - 1], [-.5 * r, -r - 1], [-.86 * r, -.6 * r], [-r - .5, -.24 * r], [-r + 1, .18 * r]];
      ribbon(path.map(([x, y]) => [sign * x, sign * y]), fieldWidth + 1, 7 - phase, { cut: [notch - gap / 2, notch + gap / 2] });
      if (ring) ribbon([[sign * (-r + 3), sign * .24 * r], [sign * (-r + 2), sign * .46 * r]], fieldWidth * .7, 7 - phase + 3);
    }
    return;
  }

  if (concept === 'vida') {
    // Interrupted protective contours extend to close their seams, hold for
    // two frames, then reopen. The preserved material never grows or heals.
    const span = [1.05, 1.25, 1.75, 2.25, 2.65, 2.65, 1.9, 1.2][phase];
    for (let side = 0; side < 2; side++) {
      const start = -Math.PI * .9 + side * Math.PI;
      ribbon(arcPoints(Math.max(2, r - .5), start, span, 18), fieldWidth + .45, phase === 5 ? 4 : phase + side * 4);
      if ((ring || glow) && phase >= 2 && phase <= 5)
        ribbon(arcPoints(r + 2, start + span - .6, .72, 8), fieldWidth * .8, phase + side * 4 + 2);
    }
    return;
  }

  // Morte regresses: offset contour echoes are gathered back into the held
  // original edge in sequence. No skull, destruction or body erasure is added.
  const returning = [5, 5, 4, 2, 0, 0, 0, 3][phase];
  for (let side = 0; side < 2; side++) {
    const start = Math.PI * .78 + side * Math.PI;
    const direction = side ? 1 : -1;
    ribbon(arcPoints(Math.max(2, r - 2), start, 1.13), fieldWidth * .7, 7 - phase);
    ribbon(arcPoints(Math.max(2, r - 1), start - .08, 1.06), fieldWidth + .6, 7 - phase + side * 4, { offset: [direction * returning, 0] });
    if (ring) {
      const delayed = [5, 5, 4, 2, 0, 0, 0, 3][(phase + 6) % 8];
      ribbon(arcPoints(Math.max(2, r - 1), start - .14, .88), fieldWidth * .8, 7 - phase + 3, { offset: [direction * delayed * .7, 0] });
    }
  }
}
