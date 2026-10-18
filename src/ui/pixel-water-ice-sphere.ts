import { inPoly, type Pix, type RGB } from './pixel';

/** Authored sphere composition. Element order controls construction, never fusion rules. */
export interface WaterIceSphereBounds { l: number; t: number; r: number; b: number }
type Point = [number, number];
type Primary = 'agua' | 'gelo';
interface Plate { top: Point[]; front: Point[]; side: Point[]; bevel: Point[]; wetEdge: Point[]; anchor: Point }
const TAU = Math.PI * 2;
const C = {
  edge: [13, 37, 79], deep: [19, 61, 119], waterShadow: [22, 88, 154],
  water: [25, 128, 189], current: [35, 167, 210], crest: [80, 211, 232],
  caustic: [158, 240, 246], iceDeep: [48, 88, 146], iceSide: [69, 127, 178],
  iceFront: [112, 178, 211], ice: [172, 219, 235], iceLight: [218, 243, 247],
  iceEdge: [243, 254, 251],
} satisfies Record<string, RGB>;

// Three pieces of one broken frozen shell. Each has a broad surface and a
// downward-facing cut: these are thick plates, not diamond stickers or shards.
const PLATES: Plate[] = [
  {
    top: [[-.76, -.59], [-.19, -1.08], [.23, -.75], [-.24, -.34]],
    front: [[-.76, -.59], [-.24, -.34], [-.19, -.15], [-.69, -.4]],
    side: [[-.24, -.34], [.23, -.75], [.29, -.54], [-.19, -.15]],
    bevel: [[-.76, -.59], [-.19, -1.08], [.23, -.75]],
    wetEdge: [[-.69, -.4], [-.19, -.15], [.29, -.54]], anchor: [-.23, -.58],
  },
  {
    top: [[.47, -.63], [.94, -.39], [1.04, .04], [.59, .24], [.28, -.09]],
    front: [[.28, -.09], [.59, .24], [.58, .41], [.27, .09]],
    side: [[.59, .24], [1.04, .04], [.97, .23], [.58, .41]],
    bevel: [[.47, -.63], [.94, -.39], [1.04, .04]],
    wetEdge: [[.27, .09], [.58, .41], [.97, .23]], anchor: [.65, -.1],
  },
  {
    top: [[-.81, .3], [-.45, .1], [-.08, .38], [-.23, .65], [-.67, .72]],
    front: [[-.81, .3], [-.67, .72], [-.59, .86], [-.75, .57]],
    side: [[-.67, .72], [-.23, .65], [-.08, .38], [-.03, .53], [-.18, .8], [-.59, .86]],
    bevel: [[-.81, .3], [-.45, .1], [-.08, .38]],
    wetEdge: [[-.75, .57], [-.59, .86], [-.18, .8], [-.03, .53]], anchor: [-.44, .47],
  },
];

const radius = (s: number): number => Math.max(1.5, Math.abs(s) * .9);

/** Stable local envelope for every pose, including the short frozen corners. */
export function waterIceSphereBounds(s: number): WaterIceSphereBounds {
  const r = radius(s);
  return { l: Math.floor(-1.04 * r), t: Math.floor(-1.09 * r), r: Math.ceil(1.06 * r), b: Math.ceil(r) };
}

function alongPath(u: number, v: number, points: Point[]): { distance: number; progress: number } {
  let distance = Infinity, progress = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], length2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / length2));
    const d = Math.hypot(u - a[0] - t * dx, v - a[1] - t * dy);
    if (d < distance) { distance = d; progress = (i - 1 + t) / (points.length - 1); }
  }
  return { distance, progress };
}

/**
 * Pure eight-frame Pix painter: fixed plate geometry, moving liquid folds.
 * Frame zero is a complete pause pose. The caller retains the existing clock.
 * No halo, detached particles, imported imagery, or inferred fusion metadata.
 */
export function paintWaterIceSphere(pix: Pick<Pix, 'w' | 'h' | 'set'>, x: number, y: number, s: number, frame: number, primary: Primary): WaterIceSphereBounds {
  const r = radius(s), tiny = r < 8;
  const clock = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
  const phase = clock * TAU / 8, icy = primary === 'gelo';
  const plates = PLATES.slice(0, icy ? 3 : 2).map((plate, index): Plate => {
    const scale = icy ? 1 : index === 0 ? .82 : .78;
    const lift = !icy && index === 0 ? -.085 : 0;
    const transform = (points: Point[]): Point[] => points.map(([u, v]) => [
      plate.anchor[0] + (u - plate.anchor[0]) * scale,
      plate.anchor[1] + (v - plate.anchor[1]) * scale + lift,
    ]);
    return { top: transform(plate.top), front: transform(plate.front), side: transform(plate.side),
      bevel: transform(plate.bevel), wetEdge: transform(plate.wetEdge), anchor: plate.anchor };
  });
  // This S-shaped reach passes below the upper plate, through the central gap,
  // then turns around the right plate's foot into the translucent lower belly.
  // Only its pressure ridge moves. Its route and all solid boundaries persist.
  const sway = Math.sin(phase) * .025;
  const stream: Point[] = [[-.84, -.23], [-.59, -.04], [-.29, .025 + sway],
    [-.04, .19], [-.015, .42], [.23, .6 + sway], [.54, .55], [.77, .36], [.81, .16]];
  const returnFlow: Point[] = [[-.88, -.04], [-.88, .26], [-.7, .59], [-.41, .79],
    [-.06, .85], [.29, .78], [.58, .59], [.73, .35]];
  const neck: Point[] = [[.04, -.91], [.32, -.8], [.4, -.59], [.27, -.34], [.08, -.1]];
  const envelope = waterIceSphereBounds(s), left = Math.floor(x + envelope.l) - 1, top = Math.floor(y + envelope.t) - 1;
  const right = Math.ceil(x + envelope.r) + 1, bottom = Math.ceil(y + envelope.b) + 1;
  const w = right - left + 1, h = bottom - top + 1;
  const colors: (RGB | null)[] = new Array(w * h).fill(null);
  const solids = new Uint8Array(w * h);
  // Actual cut-face contacts provide one shared route for liquid menisci and
  // their bent refraction inside the plate; no whole-face flashing stripes.
  const contactDistance = new Float32Array(w * h).fill(Infinity);
  const contactProgress = new Float32Array(w * h);

  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const u = (px - x) / r, v = (py - y) / r, d = Math.hypot(u, v);
    const index = (py - top) * w + px - left;
    let color: RGB | null = null;
    if (d <= .985) {
      // Broad clustered values describe one heavy, round liquid volume.
      color = C.waterShadow;
      if (u < .61 && v < .55 && Math.hypot(u + .13, v + .12) < .91) color = C.water;
      if (u < -.79 || v > .69 || (u > .67 && v > .1)) color = C.deep;
      if (u > .2 && v > .42 && d < .82) color = C.water;
      if (!icy && Math.hypot((u + .26) * 1.1, (v - .32) * 1.15) < .4) color = C.waterShadow;
      const flow = alongPath(u, v, stream), back = alongPath(u, v, neck), returning = alongPath(u, v, returnFlow);
      const width = (icy ? .095 : .14) + Math.sin(flow.progress * Math.PI) * .035;
      const front = (flow.progress - clock / 8 + 1) % 1;
      if (flow.distance < width + .05) color = C.deep;
      if (flow.distance < width) color = C.current;
      // Advected bands are long pieces of the same current, never round dots.
      if (flow.distance < width * .54 && front > .06 && front < .36) color = C.crest;
      if (!tiny && flow.distance < width * .25 && front > .12 && front < .26) color = C.caustic;
      if (back.distance < (icy ? .08 : .115)) color = C.current;
      if (back.distance < .045 && ((back.progress + clock / 8) % 1) < .3) color = C.crest;
      // The folded lower lip curls back into the mass below the right ice foot.
      const lipWidth = icy ? .065 : .12;
      if (returning.distance < lipWidth + .045 && returning.progress < .94) color = C.deep;
      if (returning.distance < lipWidth && returning.progress < .94) color = C.current;
      const lipFront = (returning.progress - clock / 8 + 1) % 1;
      if (returning.distance < lipWidth * .45 && lipFront > .08 && lipFront < .48) color = C.crest;
      if (!tiny && returning.distance < .028 && lipFront > .16 && lipFront < .31) color = C.caustic;
    }
    for (let n = 0; n < plates.length; n++) {
      const plate = plates[n], face = inPoly(plate.top, u, v);
      const front = inPoly(plate.front, u, v), side = inPoly(plate.side, u, v);
      if (!face && !front && !side) continue;
      solids[index] = 1;
      if (side) color = n === 0 ? C.iceDeep : C.iceSide;
      if (front) color = n === 0 ? C.iceFront : C.iceDeep;
      if (face) {
        color = n === 0 ? C.ice : C.iceFront;
        // The sloping shell catches light on separate planar shoulders.
        if (n === 0 && v < -.69 + u * .34) color = C.iceLight;
        if (n === 1 && u < .61 + v * .2) color = C.ice;
        if (n === 2 && v < .3 - u * .12) color = C.ice;
        const edge = alongPath(u, v, plate.bevel);
        if (edge.distance < (tiny ? .045 : .036) && edge.progress < .67) color = C.iceEdge;
      }
    }
    if (!tiny && d < .96) for (let n = 0; n < plates.length; n++) {
      const seam = alongPath(u, v, plates[n].wetEdge);
      if (seam.distance < contactDistance[index]) {
        contactDistance[index] = seam.distance;
        contactProgress[index] = seam.progress + n * .23;
      }
    }
    // A meniscus grips the cut face of the lower-left plate. This is the
    // foreground turn of the same current; its broad foot remains submerged.
    if (icy && d < .96 && u > -.77 && u < -.15) {
      const grip = alongPath(u, v, [[-.75, .57], [-.57, .73], [-.31, .74], [-.15, .62]]);
      if (grip.distance < .042 + .012 * Math.sin(phase - grip.progress * TAU)) {
        color = grip.progress < .47 ? C.current : C.crest;
        solids[index] = 0;
      }
    }
    colors[index] = color;
  }

  const bounds: WaterIceSphereBounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let row = 1; row < h - 1; row++) for (let col = 1; col < w - 1; col++) {
    const index = row * w + col;
    let color = colors[index];
    if (!color) continue;
    const px = left + col, py = top + row, u = (px - x) / r, v = (py - y) / r;
    const edge = !colors[index - 1] || !colors[index + 1] || !colors[index - w] || !colors[index + w];
    if (edge && !solids[index]) color = u + v > .2 ? C.edge : C.waterShadow;
    if (edge && solids[index] && u + v > .65) color = C.iceDeep;
    if (!tiny && !edge) {
      const distance = contactDistance[index] * r;
      const front = (contactProgress[index] - clock / 8 + 2) % 1;
      // A narrow bright head and its broad trailing shoulder travel along the
      // submerged cuts. The same head refracts back into ice, so both materials
      // answer at their actual meeting point while the shell stays rigid.
      const shoulder = front > .035 && front < .38;
      const head = front > .12 && front < .23;
      if (!solids[index] && distance < 1.15) {
        color = shoulder ? C.crest : C.current;
        if (head && distance < .62) color = C.caustic;
      } else if (solids[index] && distance < 1.55 && shoulder) {
        color = head && distance < .8 ? C.iceLight : C.ice;
      }
    }
    pix.set(px, py, color);
    // Report the actual inclusive pixels written, consistent with Pix clipping.
    if (px >= 0 && py >= 0 && px < pix.w && py < pix.h) {
      bounds.l = Math.min(bounds.l, px); bounds.t = Math.min(bounds.t, py);
      bounds.r = Math.max(bounds.r, px); bounds.b = Math.max(bounds.b, py);
    }
  }
  return bounds;
}
