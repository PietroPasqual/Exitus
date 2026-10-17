import { inPoly, Pix, type RGB } from './pixel';

/** Authored material volumes: each sphere has its own contour and large planes. */
type Point = [number, number];
export interface ElementalSphereBox { l: number; t: number; r: number; b: number }
export type ElementalSphere = 'agua' | 'gelo' | 'terra' | 'metal';
const TAU = Math.PI * 2;
const sphereRadius = (s: number): number => Math.max(1.5, s * .9);
const ICE: Point[] = [[-.31, -1.02], [.29, -.98], [.75, -.66], [.99, -.15], [.87, .45], [.43, .87], [-.16, .98], [-.7, .73], [-.99, .21], [-.91, -.39]];
const ROCK: Point[] = [[-.45, -.91], [.13, -1.02], [.57, -.85], [.9, -.43], [1, .13], [.81, .61], [.31, .96], [-.26, .92], [-.73, .66], [-1, .16], [-.87, -.43]];
const ROCK_TILT = [.015, .04, .075, .105, .05, .015, 0, .005];
const ROCK_CONTACT: Point = [.31, .96];
const METAL: Point[] = [[-.37, -.96], [.34, -.96], [.73, -.69], [.94, -.31], [1, .22], [.76, .69], [.32, .95], [-.34, .95], [-.76, .66], [-.98, .21], [-.94, -.33], [-.74, -.7]];
const ICE_TOP: Point[] = [[-.85, -.4], [-.31, -.92], [.25, -.88], [.57, -.58], [.03, -.2], [-.57, -.06]];
const ICE_FRONT: Point[] = [[-.85, -.4], [-.57, -.06], [.03, -.2], [.35, .31], [-.12, .79], [-.63, .57], [-.87, .18]];
const ICE_UNDER: Point[] = [[-.12, .79], [.35, .31], [.74, .37], [.43, .87], [-.16, .98]];
const ICE_RIGHT: Point[] = [[.25, -.88], [.69, -.59], [.86, -.13], [.74, .37], [.35, .31], [.03, -.2], [.57, -.58]];
const ROCK_TOP: Point[] = [[-.77, -.4], [-.41, -.81], [.09, -.91], [.49, -.73], [.59, -.4], [.07, -.19], [-.33, -.24]];
const ROCK_FRONT: Point[] = [[-.77, -.4], [-.33, -.24], [.07, -.19], [.26, .3], [-.08, .7], [-.61, .52], [-.87, .1]];
const ROCK_RIGHT: Point[] = [[.49, -.73], [.79, -.38], [.85, .1], [.66, .51], [.26, .3], [.07, -.19], [.59, -.4]];

/** All-frame local bounds, rounded outward for fractional scene positions. */
export function elementalSphereBounds(s: number, element: ElementalSphere | string): ElementalSphereBox {
  const r = sphereRadius(s);
  const water = element === 'agua' || element === 'water';
  const earth = element === 'terra' || element === 'earth';
  const points = element === 'gelo' || element === 'ice' ? ICE : earth ? ROCK_TILT.flatMap(angle => ROCK.map(([u, v]): Point => {
    const dx = u - ROCK_CONTACT[0], dy = v - ROCK_CONTACT[1];
    return [ROCK_CONTACT[0] + dx * Math.cos(angle) - dy * Math.sin(angle), ROCK_CONTACT[1] + dx * Math.sin(angle) + dy * Math.cos(angle)];
  })) : METAL;
  const minX = water ? (r < 6 ? -.97 : -1.18) : Math.min(...points.map(p => p[0]));
  const maxX = water ? (r < 6 ? .97 : 1.18) : Math.max(...points.map(p => p[0]));
  const minY = water ? (r < 6 ? -.97 : -1.27) : Math.min(...points.map(p => p[1]));
  const maxY = water ? .97 : Math.max(...points.map(p => p[1]));
  return { l: Math.floor(minX * r), t: Math.floor(minY * r), r: Math.ceil(maxX * r), b: Math.ceil(maxY * r) };
}

function onSegment(u: number, v: number, a: Point, b: Point, width: number): boolean {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(u - a[0] - t * dx, v - a[1] - t * dy) < width;
}

/**
 * The eight-frame clock drives a material-local gesture, not whole-body travel:
 * water rolls, ice refracts across rigid faces, rock leans and settles, and metal
 * carries a moving curved reflection. The solid contours remain anchored.
 * Returns the exact inclusive bounds of the painted pixels, including edges.
 */
export function paintElementalSphere(pix: Pix, x: number, y: number, s: number, ramp: RGB[], element: ElementalSphere | string, frame: number): ElementalSphereBox {
  const r = sphereRadius(s), small = r < 6, detailed = r >= 9;
  const clock = Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0, turn = clock * TAU / 8;
  const crestTurn = .34 * Math.sin(turn) + .08 * Math.sin(turn * 2);
  const crestCos = Math.cos(crestTurn), crestSin = Math.sin(crestTurn);
  const curl = .12 * Math.sin(turn - .4), crestRise = 1 + .07 * Math.sin(turn);
  const rollCos = Math.cos(turn), rollSin = Math.sin(turn);
  const refractPosition = [-1.08, -.76, -.44, -.12, .2, .52, .84, 1.16][clock];
  // A slow rigid lean followed by a quicker weighted settle. The pivot is the
  // lowest rock corner: its contour, facets, and seams move as one solid object.
  const rockCos = Math.cos(ROCK_TILT[clock]), rockSin = Math.sin(ROCK_TILT[clock]);
  const metalTurn = .19 + .44 * Math.sin(turn), metalShift = .12 * Math.sin(turn + .6);
  const metalCos = Math.cos(metalTurn), metalSin = Math.sin(metalTurn);
  const metalGlint: Point = [.5 * Math.sin(turn - .85), -.48 - .22 * Math.cos(turn - .85)];
  // The lip is attached to the top of a nearly round water mass; it folds into
  // the surface instead of making a detached orbit or a flame-shaped tail.
  const crestBase: Point[] = [[-.76, -.51], [-.54, -.88], [-.18, -1.13], [.22, -1.11],
    [.5, -.91], [.61, -.63], [.49, -.4], [.33, -.48], [.4, -.67], [.22, -.84], [-.08, -.88], [-.35, -.68]];
  const crest: Point[] = crestBase.map(([u, v], i) => {
    const lip = i >= 5 && i <= 8 ? curl : 0;
    return [(u + lip) * crestCos - v * crestRise * crestSin, (u + lip) * crestSin + v * crestRise * crestCos];
  });
  const waterFold: Point[] = [[-.77, -.13], [-.73, .23], [-.48, .57], [-.1, .74], [.35, .69], [.66, .45], [.79, .1],
    [.64, .26], [.34, .43], [-.02, .45], [-.32, .3], [-.47, .06], [-.46, -.24], [-.28, -.46], [-.02, -.52],
    [.21, -.43], [.35, -.2], [.31, .07], [.49, -.06], [.53, -.37], [.34, -.62], [.03, -.72], [-.32, -.59], [-.59, -.36]];
  const waterDeep: Point[] = [[-.25, -.34], [.05, -.47], [.31, -.32], [.34, -.04], [.16, .15], [-.11, .2],
    [.08, .31], [.36, .28], [.56, .04], [.61, -.31], [.4, -.63], [.04, -.73], [-.26, -.56]];
  const local = elementalSphereBounds(s, element);
  const left = Math.floor(x + local.l) - 1, top = Math.floor(y + local.t) - 1;
  const right = Math.ceil(x + local.r) + 1, bottom = Math.ceil(y + local.b) + 1;
  const w = right - left + 1, h = bottom - top + 1;
  const tones = new Float32Array(w * h).fill(-1);
  const toneAt = (u: number, v: number): number => {
    if (element === 'agua' || element === 'water') {
      const d = Math.hypot(u, v), lip = !small && inPoly(crest, u, v);
      if (d > .97 && !lip) return -1;
      let tone = .38;
      if (Math.hypot((u + .19) * 1.03, (v + .22) * 1.06) < .77) tone = .61;
      if (u > .48) tone = .39;
      if (v > .36 - u * .23) tone = .24;
      if (d > .84 && v > .24) tone = .15;
      // A connected current rolls through the body. The underside lighting
      // stays in world space, so this reads as flowing liquid rather than spin.
      const flowU = u * rollCos + v * rollSin, flowV = -u * rollSin + v * rollCos;
      if (inPoly(waterFold, flowU, flowV)) tone = v > .47 ? .59 : .72;
      if (inPoly(waterDeep, flowU, flowV)) tone = .25;
      // A substantial, curved transparent belly, with a short caustic at its
      // lower-right shoulder. There is deliberately no full bright rim.
      if (v > .5 && u > -.15 && u < .64 && d > .72 && d < .9) tone = .7;
      if (lip) tone = v < -.95 ? .76 : .59;
      if (!small && onSegment(u, v, [-.69, -.34], [-.5, -.57], .055)) tone = .96;
      if (!small && onSegment(u, v, [-.5, -.57], [-.27, -.66], .045)) tone = .9;
      if (small && u < -.16 && v < -.15 && d < .7) tone = .85;
      return tone;
    }
    if (element === 'gelo' || element === 'ice') {
      if (!inPoly(ICE, u, v)) return -1;
      let tone = .37;
      if (inPoly(ICE_TOP, u, v)) tone = .82;
      if (inPoly(ICE_FRONT, u, v)) tone = .65;
      if (inPoly(ICE_RIGHT, u, v)) tone = .45;
      if (inPoly(ICE_UNDER, u, v)) tone = .27;
      if (v > .73 && u < .35) tone = .48;
      // Three broad planes meet at one off-centre vertex, with a narrow bevel.
      if (!small && onSegment(u, v, [-.57, -.06], [.03, -.2], .035)) tone = .91;
      if (!small && onSegment(u, v, [.03, -.2], [.35, .31], .035)) tone = .72;
      if (!small && onSegment(u, v, [.35, .31], [.74, .37], .035)) tone = .58;
      if (!small && onSegment(u, v, [-.83, -.35], [-.38, -.79], .065)) tone = .97;
      // A narrow refracted plane sweeps across the crystal, changing direction
      // at its facet junction. It is clipped to fixed faces, not a jelly pulse.
      const front = inPoly(ICE_FRONT, u, v), side = inPoly(ICE_RIGHT, u, v);
      const refraction = side ? u - .42 * v - .08 : u + .38 * v;
      const caustic = refraction - refractPosition;
      if ((front || side || inPoly(ICE_TOP, u, v)) && caustic > -.13 && caustic < .13) {
        tone = side ? .78 : .96;
        if (caustic < -.055) tone = side ? .59 : .78;
      }
      if (small && Math.abs(u + .38 * v - refractPosition) < .23) tone = .96;
      return tone;
    }
    if (element === 'terra' || element === 'earth') {
      const dx = u - ROCK_CONTACT[0], dy = v - ROCK_CONTACT[1];
      u = ROCK_CONTACT[0] + dx * rockCos + dy * rockSin;
      v = ROCK_CONTACT[1] - dx * rockSin + dy * rockCos;
      if (!inPoly(ROCK, u, v)) return -1;
      let tone = .24;
      if (inPoly(ROCK_TOP, u, v)) tone = .74;
      if (inPoly(ROCK_FRONT, u, v)) tone = .51;
      if (inPoly(ROCK_RIGHT, u, v)) tone = .35;
      if (v > .61 + u * .15) tone = .16;
      if (!small && onSegment(u, v, [-.39, -.78], [.06, -.87], .045)) tone = .92;
      if (!small && onSegment(u, v, [-.77, -.34], [-.65, .06], .035)) tone = .67;
      // Sparse broken seams explain the planes; no noisy all-over rock fill.
      if (detailed && (onSegment(u, v, [.08, -.21], [.22, .04], .035) ||
        onSegment(u, v, [.22, .04], [.17, .24], .035) ||
        onSegment(u, v, [-.58, .23], [-.41, .31], .032))) tone = .1;
      if (detailed && onSegment(u, v, [.25, .05], [.31, .2], .025)) tone = .57;
      return tone;
    }
    if (!inPoly(METAL, u, v)) return -1;
    // Polished metal reflects a broad bright sky, a curved dark horizon, and
    // a muted underside. These connected bands follow the formed round body.
    const horizon = v * metalCos + u * metalSin - .2 * u * u - metalShift;
    let tone = .54;
    if (horizon < -.19) tone = .76;
    if (horizon < -.42 && u < .32) tone = .87;
    if (horizon > -.08 && horizon < .21) tone = .13;
    if (horizon >= .21) tone = .43;
    if (horizon > .53) tone = .25;
    if (u > .64) tone = horizon < -.1 ? .48 : .19;
    if (u < -.75 && v < .42) tone = .44;
    if (v > .67 && u > -.4 && u < .49) tone = .57;
    // One elongated highlight, never a starburst or moving fire tongue.
    if (!small && onSegment(u, v, [metalGlint[0] - .12, metalGlint[1] + .06], [metalGlint[0] + .12, metalGlint[1] - .06], .075)) tone = .95;
    if (small && Math.hypot(u - metalGlint[0], v - metalGlint[1]) < .28) tone = .95;
    return tone;
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    tones[j * w + i] = toneAt((left + i - x) / r, (top + j - y) / r);
  }
  const bounds = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    let tone = tones[j * w + i];
    if (tone < 0) continue;
    const u = (left + i - x) / r, v = (top + j - y) / r;
    const edge = tones[j * w + i - 1] < 0 || tones[j * w + i + 1] < 0 || tones[(j - 1) * w + i] < 0 || tones[(j + 1) * w + i] < 0;
    // An inside, one-pixel bevel keeps the silhouettes crisp at small sizes.
    // Lit upper edges use material colour; the lower/right edge anchors volume.
    if (edge && !small) {
      if (element === 'agua' || element === 'water') tone = u + v > .25 ? .08 : Math.min(.65, tone);
      else if (element === 'gelo' || element === 'ice') tone = u + v < -.35 ? .88 : Math.min(.28, tone);
      else if (element === 'terra' || element === 'earth') tone = u + v < -.6 ? .64 : .04;
      else tone = u + v < -.55 ? .64 : .04;
    }
    const px = left + i, py = top + j;
    pix.set(px, py, ramp[Math.round(Math.max(0, Math.min(1, tone)) * (ramp.length - 1))]);
    bounds.l = Math.min(bounds.l, px); bounds.t = Math.min(bounds.t, py);
    bounds.r = Math.max(bounds.r, px); bounds.b = Math.max(bounds.b, py);
  }
  return bounds;
}
