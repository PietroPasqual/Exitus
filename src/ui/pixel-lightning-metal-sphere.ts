import { inPoly, type Pix, type RGB } from './pixel';

/** Authored pair body; the element order changes only the painted body. */
export interface LightningMetalSphereBox { l: number; t: number; r: number; b: number }
export type LightningMetalPrimary = 'raio' | 'metal';
type Point = [number, number];

// Two unequal, interlocking plates. The smaller front plate sits in front of
// the left plate's folded lip. Their shared broken seam has physical depth.
const BACK_PLATE: Point[] = [[-.97,-.26],[-.72,-.69],[-.23,-.98],[.31,-.89],[.65,-.6],
  [.5,-.24],[.19,-.09],[.33,.2],[.02,.43],[-.19,.76],[-.65,.63],[-.92,.24]];
const FRONT_PLATE: Point[] = [[.49,-.67],[.82,-.39],[1.02,.02],[.87,.49],[.5,.82],
  [.02,.98],[-.47,.84],[-.73,.57],[-.34,.34],[-.19,.03],[.11,-.05],[.01,-.34]];
const BACK_FACE: Point[] = [[-.88,-.24],[-.64,-.57],[-.23,-.81],[.26,-.73],[.46,-.53],
  [.25,-.34],[.08,-.19],[-.29,-.19],[-.49,.13],[-.75,.24]];
const FRONT_FACE: Point[] = [[.5,-.5],[.75,-.26],[.87,.06],[.72,.39],[.43,.64],
  [.01,.78],[-.41,.64],[-.51,.5],[-.17,.29],[-.06,.05],[.2,-.05],[.1,-.31]];
const STEEL_SEAM: Point[] = [[-.27,-.79],[-.08,-.52],[-.24,-.23],[.17,-.14],
  [.04,.2],[.4,.39],[.32,.68]];
const BACK_RIM: Point[] = [[-.76,-.36],[-.52,-.62],[-.22,-.79],[.18,-.72]];
const FRONT_RIM: Point[] = [[.55,-.42],[.72,-.21],[.82,.05]];
const SECONDARY_SEAM: Point[] = [[-.24,-.23],[-.51,-.09],[-.43,.13]];

// The electrical body is rounded but locally angular. Its lobes and two steel
// teeth define its contour directly, rather than decorating a circular mask.
const CHARGE_BODY: Point[] = [[-.78,-.48],[-.48,-.79],[-.13,-.9],[.2,-.9],
  [.34,-.75],[.62,-.79],[.79,-.57],[.88,-.4],[.99,-.27],[.68,-.17],
  [.83,-.02],[.95,.1],[.81,.2],[.93,.35],[.7,.57],[.45,.78],[.12,.89],
  [-.19,.8],[-.48,.86],[-.55,.62],[-.88,.46],[-.57,.27],[-.86,.17],[-1.01,-.06],[-.84,-.25]];
const TOOTH_LEFT: Point[] = [[-1.01,-.18],[-.87,-.59],[-.54,-.85],[-.17,-.72],
  [-.14,-.51],[-.43,-.35],[-.49,-.12],[-.78,.11],[-.95,.02]];
const TOOTH_FACE: Point[] = [[-.88,-.29],[-.74,-.53],[-.51,-.73],[-.28,-.64],
  [-.26,-.53],[-.55,-.4],[-.64,-.19],[-.81,-.1]];
const TOOTH_RIGHT: Point[] = [[.45,.3],[.68,.28],[.88,.49],[.72,.74],[.39,.95],
  [.11,.89],[.13,.68],[.38,.59]];
const CHARGE_PATH: Point[] = [[-.25,-.53],[.13,-.48],[-.08,-.1],[.42,-.2],
  [.22,.17],[.58,.21],[.45,.58]];
const UPPER_BRANCH: Point[] = [[.02,-.32],[.12,-.65],[.38,-.68],[.52,-.53],[.73,-.37]];
const LEFT_BRANCH: Point[] = [[.05,-.08],[-.51,.02],[-.58,.15]];
const LOWER_BRANCH: Point[] = [[.45,.46],[.08,.64],[-.29,.56],[-.59,.43]];

const C = {
  outline: [23,26,42], steelDeep: [39,48,66], steelDark: [64,77,94],
  steel: [101,118,132], steelFace: [147,163,171], steelLight: [199,214,215],
  steelEdge: [229,237,226], reflection: [159,206,224], reflectionHot: [215,246,245],
  recess: [36,24,54], chargeDark: [61,39,88], chargeShade: [112,83,151],
  charge: [211,190,110], chargeLit: [246,231,151], chargeEdge: [255,245,192],
  core: [255,253,226], flash: [255,255,243], residue: [160,139,193],
} satisfies Record<string, RGB>;
const STEEL: readonly RGB[] = [C.outline,C.steelDeep,C.steelDark,C.steel,C.steelFace,C.steelLight,C.steelEdge];
const PHASE_REACH = [.17,.32,.46,.46,1,.83,.48,.12];
const PHASE_KICK = [0,0,0,0,.085,.035,0,0];
const PHASE_LIFT = [0,-.015,-.025,-.025,.045,.02,0,.005];
const radiusOf = (s: number): number => Math.max(1.5, Number.isFinite(s) ? Math.abs(s) * .9 : 1.5);
const phaseOf = (f: number): number => Number.isFinite(f) ? ((Math.floor(f) % 8) + 8) % 8 : 0;

/** All eight poses fit this local envelope, also at fractional pixel centres. */
export function lightningMetalSphereBounds(s: number, primary: LightningMetalPrimary = 'metal'): LightningMetalSphereBox {
  const r = radiusOf(s), electric = primary === 'raio';
  return { l: Math.floor(-(electric ? 1.04 : 1.01) * r) - 1, t: Math.floor(-1.02 * r) - 1,
    r: Math.ceil(1.04 * r) + 1, b: Math.ceil(1.01 * r) + 1 };
}

function along(u: number, v: number, path: Point[]): { distance: number; progress: number } {
  let distance = Infinity, progress = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0,Math.min(1,((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(u - a[0] - dx * t,v - a[1] - dy * t);
    if (d < distance) { distance = d; progress = (k - 1 + t) / (path.length - 1); }
  }
  return { distance, progress };
}

/**
 * Contact leaders approach, hold for two beats, jump, then cool in their seam.
 * Steel never moves or flashes globally. No detached sparks, halo, or timer.
 * Scratch storage is linear in the clipped painting area and is never cached.
 */
export function paintLightningMetalSphere(pix: Pick<Pix,'w'|'h'|'set'>, x: number, y: number, s: number,
  frame: number, primary: LightningMetalPrimary): LightningMetalSphereBox {
  const result: LightningMetalSphereBox = { l: Infinity,t: Infinity,r: -Infinity,b: -Infinity };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return result;
  const r = radiusOf(s), phase = phaseOf(frame), electric = primary === 'raio', tiny = r < 7.5;
  const envelope = lightningMetalSphereBounds(s,primary);
  // One guard cell around the visible canvas retains the true edge at clipping.
  const left = Math.max(-1,Math.floor(x + envelope.l)), top = Math.max(-1,Math.floor(y + envelope.t));
  const right = Math.min(pix.w,Math.ceil(x + envelope.r)), bottom = Math.min(pix.h,Math.ceil(y + envelope.b));
  if (right < left || bottom < top) return result;
  const w = right - left + 1, h = bottom - top + 1;
  const material = new Uint8Array(w * h), colors: (RGB | undefined)[] = new Array(w * h);
  const kick = PHASE_KICK[phase], reach = PHASE_REACH[phase];
  const fixedPath = electric ? CHARGE_PATH : STEEL_SEAM;
  const path: Point[] = fixedPath.map(([u,v],k) => k > 1 && k < 5 ? [u + (k % 2 ? kick : -kick),v] : [u,v]);
  const body = electric ? CHARGE_BODY.map(([u,v],k): Point => k > 2 && k < 10 ? [u,v + PHASE_LIFT[phase]] : [u,v]) : CHARGE_BODY;
  const channelWidth = Math.max(tiny ? .43 : .58,r * (electric ? .045 : .036));
  const grooveWidth = Math.max(tiny ? .65 : 1.1,r * .12);
  const electrodeWidth = tiny ? .22 : .14;

  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const index = j * w + i, u = (left + i - x) / r, v = (top + j - y) / r;
    let plate = -1, color: RGB | undefined;
    let bodyChannel: ReturnType<typeof along> | undefined;
    if (electric) {
      if (inPoly(body,u,v)) {
        // Three broad, rooted branches build the electrical volume. The
        // purple cuts between them are irregular depth, not a stamped bolt.
        const trunk = bodyChannel = along(u,v,path), crown = along(u,v,UPPER_BRANCH), returning = along(u,v,LOWER_BRANCH);
        const leftFork = along(u,v,LEFT_BRANCH), side = Math.min(returning.distance,leftFork.distance);
        color = C.chargeDark;
        if (trunk.distance < .24 || crown.distance < .19 || side < .19) color = C.chargeShade;
        if (trunk.distance < .17 || crown.distance < .13 || side < .13) color = C.charge;
        if (trunk.distance < .105 || crown.distance < .0455 || side < .075) color = C.chargeLit;
        if (crown.distance < .045 && crown.progress > .2 && crown.progress < .72) color = C.chargeEdge;
        // The rootward side of each branch is brighter; shadow sits below it.
        if (returning.distance < .035 && returning.progress > .18 && returning.progress < .8) color = C.chargeEdge;
      }
      if (inPoly(TOOTH_LEFT,u,v)) plate = 0;
      if (inPoly(TOOTH_RIGHT,u,v)) plate = 1;
    } else {
      if (inPoly(BACK_PLATE,u,v)) plate = 0;
      if (inPoly(FRONT_PLATE,u,v)) plate = 1;
    }
    if (!color && plate < 0) continue;
    // The electrical volume and its contact leader use the exact same path.
    // In six phases that path is also the rigid seam: reuse its projection,
    // rather than evaluating the same segments up to three times per pixel.
    const channel = bodyChannel ?? along(u,v,path);
    const seam = kick === 0 ? channel : along(u,v,fixedPath);
    const secondary = electric ? null : along(u,v,SECONDARY_SEAM);
    const leading = channel.progress < reach * .5 || channel.progress > 1 - reach * .5;
    const active = phase === 5 || leading;
    const endpoint = Math.min(Math.hypot(u - fixedPath[0][0],v - fixedPath[0][1]),
      Math.hypot(u - fixedPath[6][0],v - fixedPath[6][1]));
    if (plate >= 0) {
      let tone = plate === 0 ? 3 : 2;
      if (electric) {
        if (plate === 0 && inPoly(TOOTH_FACE,u,v)) tone = 5;
        if (plate === 0 && u > -.62 && v > -.48) tone = 1;
        if (plate === 1 && u > .4 && v < .65) tone = 4;
        if (plate === 1 && v > .72 - u * .08) tone = 1;
        if (plate === 0 && v < -.63 + u * .1) tone = 6;
        if (plate === 1 && v > .55 && v < .63 && u < .52) tone = 5;
      } else {
        if (plate === 0 && inPoly(BACK_FACE,u,v)) tone = 4;
        if (plate === 0 && v < -.49 - u * .14) tone = 5;
        if (plate === 0 && v > -.03 - u * .25) tone = 2;
        if (plate === 1 && inPoly(FRONT_FACE,u,v)) tone = 3;
        if (plate === 1 && v > .49 - u * .24) tone = 2;
        if (plate === 1 && u > .68) tone = 1;
        if (plate === 1 && v > .65 && u < .35) tone = 3;
        const rim = along(u,v,plate === 0 ? BACK_RIM : FRONT_RIM);
        if (rim.distance * r < (tiny ? .45 : .52)) tone = plate === 0 ? 6 : 4;
      }
      color = STEEL[tone];
      // A narrow cold reflection is attached to the live seam/contact only.
      if (active && seam.distance * r > grooveWidth && seam.distance * r < grooveWidth + .85) {
        color = phase === 4 ? C.reflectionHot : C.reflection;
      }
    }
    const channelExposed = electric ? plate < 0 || endpoint < electrodeWidth : seam.distance * r < grooveWidth;
    if (channelExposed) {
      if (!electric && seam.distance * r < grooveWidth) color = C.recess;
      if (electric && phase > 4 && channel.distance * r < channelWidth + .3) color = C.chargeShade;
      if (!electric && seam.distance * r < grooveWidth && seam.distance * r > grooveWidth - .7) color = C.chargeDark;
      if (channel.distance * r < channelWidth) {
        if (!electric || phase > 4) color = C.residue;
        if (active) color = phase === 4 ? C.flash : phase === 5 ? C.chargeEdge : phase === 6 ? C.chargeShade : C.core;
      }
      // Contacts are small rectangular roots embedded in the rigid planes.
      if (endpoint < electrodeWidth && channel.distance * r < channelWidth + .45) {
        color = phase === 4 ? C.flash : phase === 6 ? C.residue : C.chargeEdge;
      }
    }
    if (secondary && secondary.distance * r < Math.max(tiny ? .35 : .68,r * .065)) {
      color = C.recess;
      if (secondary.distance * r < (tiny ? .2 : .38) && phase >= 3 && phase <= 5) {
        color = phase === 4 ? C.core : phase === 5 ? C.residue : C.chargeLit;
      }
    }
    material[index] = plate >= 0 ? plate + 2 : 1;
    colors[index] = color;
  }

  // Preserve one four-connected object at tiny and fractional raster sizes.
  // The centre belongs to the body; a nearest occupied fallback handles clips.
  let seed = -1, nearest = Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (material[j * w + i]) {
    const distance = (left + i - x) ** 2 + (top + j - y) ** 2;
    if (distance < nearest) { nearest = distance; seed = j * w + i; }
  }
  if (seed < 0) return result;
  const connected = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let end = 1; queue[0] = seed; connected[seed] = 1;
  for (let cursor = 0; cursor < end; cursor++) {
    const at = queue[cursor], col = at % w;
    for (const next of [col > 0 ? at - 1 : -1,col + 1 < w ? at + 1 : -1,at - w,at + w]) {
      if (next < 0 || next >= material.length || !material[next] || connected[next]) continue;
      connected[next] = 1; queue[end++] = next;
    }
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const index = j * w + i;
    if (!connected[index]) continue;
    const px = left + i, py = top + j;
    if (px < 0 || py < 0 || px >= pix.w || py >= pix.h) continue;
    const u = (px - x) / r, v = (py - y) / r;
    const edge = i === 0 || i + 1 === w || j === 0 || j + 1 === h ||
      !material[index - 1] || !material[index + 1] || !material[index - w] || !material[index + w];
    let color = colors[index]!;
    if (edge && u + v > .12) color = material[index] > 1 ? C.outline : C.chargeDark;
    else if (edge && material[index] === 1) color = C.chargeShade;
    pix.set(px,py,color);
    result.l = Math.min(result.l,px); result.t = Math.min(result.t,py);
    result.r = Math.max(result.r,px); result.b = Math.max(result.b,py);
  }
  return result;
}
