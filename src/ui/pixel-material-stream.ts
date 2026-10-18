import { clamp01, type Pix, type RGB } from './pixel';
import { flameJetBounds, paintFlameFeed, paintFlameJet } from './pixel-flame-jet';
import type { BodyMaterial } from './pixel-mixture-signatures';

/** Every maintained material shares the fire jet's layout and source contract. */
export const materialStreamBounds = flameJetBounds;
type Bounds = ReturnType<typeof flameJetBounds>;
interface Surface { u: number; v: number; px: number; frame: number; phase: number }
type Ink = number | null;
const TAU = Math.PI * 2;
const frameOf = (frame: number): number => Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0;
const wrap = (n: number): number => n - Math.floor(n);
const smooth = (n: number): number => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const band = (n: number, width: number): number => clamp01(1 - Math.abs(n) / width);
const axis = (u: number): number => .25 - .24 * u;
const grow = (u: number): number => smooth(u / .2);
const tip = (u: number, start = .94): number => Math.sqrt(clamp01((1 - u) / (1 - start)));
const downstream = (s: Surface, frequency: number, offset = 0): number => Math.sin(s.u * TAU * frequency - s.phase + offset);
// Back-left, back-right, then the broader foreground prism.
const ICE_PRISMS = [[.2, .2, .47], [.76, .19, .43], [.48, .25, .53]] as const;
const EARTH_CLUSTERS = [[.27, .235, .74], [.79, .185, .51]] as const;
// Complementary unfolding keeps a readable blade present during the hand-off.
const NATURE_OPEN = [[.9, 1, 1, 1, .94, .78, .76, .82], [.75, .72, .75, .88, 1, 1, 1, .9]] as const;

/** Distances are in scale units, so a pixel has the same width on either axis. */
function segment(u: number, v: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = (bx - ax) * 6, dy = by - ay, x = (u - ax) * 6, y = v - ay;
  const t = clamp01((x * dx + y * dy) / Math.max(.0001, dx * dx + dy * dy));
  return Math.hypot(x - t * dx, y - t * dy);
}

function water(s: Surface): Ink {
  const g = grow(s.u), wave = downstream(s, 1.5);
  const center = axis(s.u) + wave * .085 * g;
  // A broad rounded current has a level underside and a travelling rolled crest.
  // It reaches its width early rather than opening into fire's two tongues.
  const upper = Math.max(s.px * .58, (.075 + g * (.29 + wave * .07)) * tip(s.u));
  const lower = Math.max(s.px * .58, (.07 + g * .23) * tip(s.u));
  const d = s.v - center;
  if (d < -upper || d > lower) return null;
  const crest = Math.abs(d + upper - .045);
  if (s.u > .16 && crest < Math.max(s.px * .65, .055)) return .88;
  const fold = -.07 + .075 * downstream(s, 1.5, -.8) * g;
  if (s.u > .2 && Math.abs(d - fold) < .045) return .24;
  if (d > lower - Math.max(s.px * .75, .055)) return .3;
  if (d < fold && d > fold - .12) return .64 + wave * .08;
  return .46 + band(d - .07, .12) * .13 + wave * .035;
}

function ice(s: Surface): Ink {
  const a = axis(s.u), d = s.v - a, g = grow(s.u);
  let ink: Ink = s.u < .985 && Math.abs(d) < Math.max(s.px * .55, .065) ? .33 : null;
  // Rigid, bevel-ended prisms translate as one periodic train. The two rear
  // faces are higher and dimmer; the broad foreground face occludes them.
  // Their slanted long faces and dark thickness remain readable at native size.
  for (let i = 0; i < ICE_PRISMS.length; i++) {
    const [center, half, height] = ICE_PRISMS[i];
    const q = (wrap(s.u - s.frame / 8 - center + .5) - .5) / half;
    if (Math.abs(q) > 1) continue;
    const front = i === 2, h = height * (.18 + g * .82);
    const z = d - (front ? .13 : -.13) * g + q * .23 * g;
    const top = -h * (q < -.62 ? .25 + (q + 1) * 1.97 : q > .56 ? 1 - (q - .56) * 1.65 : 1);
    const bottom = h * (q < -.62 ? .25 + (q + 1) * .4 : q > .56 ? .4 - (q - .56) * .35 : .4);
    if (z < top || z > bottom) continue;
    // A final oblique cut reveals a short end face. The crystal keeps its
    // thickness until the cut reaches it, instead of stretching into a point.
    const finish = .94 + clamp01((z - top) / Math.max(.001, bottom - top)) * .038;
    if (s.u > finish) continue;
    const ridge = -.16 * h, edge = Math.max(s.px * .48, .025);
    if (q > .56) ink = front ? .43 : .33;
    else if (z > ridge) ink = front ? .37 : .23;
    else ink = front ? .81 : .64;
    if (Math.abs(z - ridge) < edge && q > -.67 && q < .59) ink = front ? .97 : .77;
    if (z < top + edge && q < .54) ink = front ? .97 : .81;
    // A short end bevel closes the solid rather than forming a thin triangle.
    if (q < -.72 && z > -.4 * h) ink = front ? .58 : .43;
    if (s.u > finish - .026) ink = front ? .58 : .43;
  }
  return ink;
}

function earth(s: Surface): Ink {
  const g = grow(s.u), a = axis(s.u) + .035 * downstream(s, 2) * g;
  const d = s.v - a, exit = clamp01((s.u - .73) / .27);
  const dust = (.07 + g * (.14 + .025 * downstream(s, 2))) * (1 - exit * .88);
  let ink: Ink = d > -Math.max(s.px * .65, dust * (1 - exit * .3)) && d < Math.max(s.px * .65, dust) ? (d < 0 ? .29 : .18) : null;
  // Two unequal, oblique aggregates compress and shear in a connected dust
  // current. Short recessed fractures open within the volume, never as a
  // repeating row of pebbles or a horizontal stripe across every rock.
  for (let i = 0; i < EARTH_CLUSTERS.length; i++) {
    const [center, half, height] = EARTH_CLUSTERS[i];
    const squeeze = Math.sin(s.phase + i * 2.2);
    const q = (wrap(s.u - s.frame / 8 - center + .5) - .5) / (half * (1 + squeeze * .065));
    if (Math.abs(q) > 1) continue;
    const h = height * (1 - squeeze * .07) * (.19 + g * .81);
    const z = d - (i ? .035 : -.015) * g + q * (.19 + Math.cos(s.phase + i) * .025) * g;
    let top = q < -.72 ? -.25 - (q + 1) * 2.1 : q < -.24 ? -.84 - (q + .72) * .24 : q < .32 ? -.955 + (q + .24) * .25 : q < .67 ? -.815 + (q - .32) * .35 : -.69 + (q - .67) * 1.65;
    if (i === 0 && q > -.21 && q < .08) top += .2;
    const bottom = q < -.57 ? .2 + (q + 1) * .64 : q < .36 ? .475 - (q + .57) * .1 : .382 - (q - .36) * .36;
    if (z < top * h || z > bottom * h) continue;
    // Shearing planes take bites out of the departing aggregate. They clip
    // existing faces rather than shrinking the rock, leaving connected dust.
    const shear = -.79 * (1 - exit) + (exit > .28 ? .065 : 0);
    if (exit > 0 && (d < shear || d > .31 * (1 - exit) || exit > .83)) continue;
    const face = (-.3 + q * .12) * h;
    ink = q > .55 ? .28 : z < face ? .67 : .47;
    if (z > bottom * h - Math.max(s.px * .62, .035)) ink = .28;
    if (z < top * h + Math.max(s.px * .48, .025) && q < .35) ink = .77;
    const crack = (-.15 + q * .62 + (q > -.04 ? .1 : 0)) * h;
    const opening = Math.max(s.px * .43, .027 + (.5 + .5 * squeeze) * .025);
    if (q > -.43 && q < .46 && Math.abs(z - crack) < opening) ink = .14;
    // One off-axis chipped plane gives the second mass a different structure.
    if (i === 1 && q < -.45 && z > -.25 * h && z < .1 * h) ink = .34;
    if (exit > 0) {
      const fracture = -.45 + exit * .67;
      if (Math.abs(d - fracture) < Math.max(s.px * .46, .035)) ink = .14;
      if (exit > .48 && d < shear + Math.max(s.px * .6, .045)) ink = .47;
    }
  }
  return ink;
}

function lightning(s: Surface): Ink {
  // Two held zigzag channels meet the same fixed endpoints. Only the interior
  // jumps; brighter surges move outward over an always-present residual path.
  const shift = s.frame >= 3 && s.frame <= 4 ? .12 : 0;
  const u = s.u, v = s.v;
  const a = segment(u, v, 0, .25, .18, .16);
  const b = segment(u, v, .18, .16, .36, -.12 - shift);
  const c = segment(u, v, .36, -.12 - shift, .46, .18);
  const d = segment(u, v, .46, .18, .68, -.2 + shift);
  const e = segment(u, v, .68, -.2 + shift, .76, .1);
  const f = segment(u, v, .76, .1, 1, -.09);
  const main = Math.min(a, b, c, d, e, f);
  const branch = Math.min(segment(u, v, .35, -.1 - shift, .57, -.58), segment(u, v, .57, -.58, .66, -.46),
    segment(u, v, .61, -.08, .78, .44), segment(u, v, .78, .44, .91, .28));
  const pulse = band(wrap(s.u - s.frame / 8 + .5) - .5, .2);
  const core = Math.max(s.px * .49, .028), residual = Math.max(s.px * 1.25, .105);
  if (main < core) return .51 + pulse * .49;
  if (branch < core * .85) return .37 + pulse * .58;
  if (main < residual) return .19 + pulse * .38;
  if (branch < residual * .65) return .17 + pulse * .2;
  return null;
}

function acid(s: Surface): Ink {
  const g = grow(s.u), q = wrap(s.u * 3.4 - s.frame / 8), roll = Math.cos(q * TAU);
  const center = axis(s.u) + .07 * g, upper = (.075 + g * (.31 + roll * .09)) * tip(s.u);
  const lower = (.075 + g * (.3 - roll * .06)) * tip(s.u), d = s.v - center;
  if (d < -Math.max(s.px * .6, upper) || d > Math.max(s.px * .6, lower)) return null;
  // The darker pockets sit inside thick scalloped lobes, never cut-out bubbles.
  const pocketX = (q - .5) * 1.75, pocketY = d + .025 - .055 * Math.sin(q * TAU);
  const pocket = Math.hypot(pocketX, pocketY * 1.45);
  if (s.u > .16 && pocket < .14 * g) return .17;
  if (s.u > .16 && pocket < .2 * g && pocketY < 0) return .79;
  if (d < -upper + Math.max(.035, s.px * .65)) return .78;
  if (d > lower - Math.max(.04, s.px * .7)) return .25;
  return d < 0 ? .58 + roll * .05 : .42 + roll * .05;
}

function metal(s: Surface): Ink {
  const g = grow(s.u), a = axis(s.u), d = s.v - a;
  let ink: Ink = Math.abs(d) < Math.max(s.px * .48, .055) ? .39 : null;
  // Long sheared strips overlap a fine steel feed. Broad dark faces make these
  // shavings read as metal, rather than ice's pale, deep triangular plates.
  for (let lane = -1; lane <= 1; lane++) {
    const q = wrap(s.u * 2.8 - s.frame / 8 + lane * .31);
    const offset = lane * .25 * g, z = d - offset - (q - .5) * .075;
    const half = (.035 + g * .075) * tip(s.u, .92);
    const bevel = Math.min(q / .14, (1 - q) / .1, 1);
    if (q > .035 && q < .96 && Math.abs(z) < Math.max(s.px * .48, half * bevel)) {
      if (Math.abs(z + half * .38) < s.px * .45) ink = .97;
      else ink = z < 0 ? .6 : .18;
      if (q > .82) ink = .36;
    }
  }
  return ink;
}

function wind(s: Surface): Ink {
  const g = grow(s.u), a = axis(s.u), pulse = .5 + .5 * downstream(s, 1.8);
  let ink: Ink = null;
  // Three unequal open streamlines. Their ends remain open; no orbiting rings.
  for (let lane = -1; lane <= 1; lane++) {
    const bend = Math.sin(s.u * Math.PI * (lane === 0 ? 1 : 1.2)) * .14;
    const center = a + lane * (.3 * g + bend) + (lane === 0 ? -.06 * g : 0);
    const finish = lane === -1 ? .94 : lane === 1 ? .87 : 1;
    const width = Math.max(s.px * .48, (.035 + .045 * Math.sin(s.u * Math.PI)) * clamp01((finish - s.u) / .09));
    const d = Math.abs(s.v - center);
    if (s.u <= finish && d < width) ink = .52 + pulse * .35;
    else if (s.u <= finish && d < width + s.px * .45 && pulse > .7) ink ??= .25;
  }
  return ink;
}

function sound(s: Surface): Ink {
  const a = axis(s.u), d = s.v - a, radius = .09 + grow(s.u) * .62;
  const z = Math.abs(d) / radius;
  if (z > 1) return null;
  // Equal-wavelength outward fronts widen downstream. The small continuous
  // axis is quiet enough to leave the open curved pressure fronts readable.
  const wave = s.u * 4.6 - s.frame / 8 + z * z * .2;
  const q = wrap(wave), distance = Math.min(q, 1 - q) * (6 / 4.6);
  if (distance < Math.max(s.px * .48, .045)) return .79 - z * .17;
  if (distance < Math.max(s.px * 1.1, .09)) return .34;
  if (Math.abs(d) < Math.max(s.px * .45, .035)) return .27;
  return null;
}

function nature(s: Surface): Ink {
  const g = grow(s.u), a = axis(s.u), p = s.u - s.frame / 8;
  const taper = tip(s.u, .92), bend = Math.sin(p * TAU);
  // The woody midrib and its delayed fine root share the leaf's material
  // coordinate: a leaf never slides along a differently moving parent stem.
  const main = a - .015 * g + bend * .055 * g - smooth((s.u - .83) / .17) * .07;
  const root = a + (.085 + Math.sin((p + .13) * TAU) * .075) * g;
  const mainWidth = Math.max(s.px * .58, (.055 + .035 * g) * taper);
  const rootWidth = Math.max(s.px * .46, (.03 + .016 * g) * taper);
  const mainD = s.v - main, rootD = s.v - root;
  let ink: Ink = null;
  if (s.u < .96 && Math.abs(rootD) < rootWidth) ink = rootD < 0 ? .44 : .23;
  if (Math.abs(mainD) < mainWidth) ink = mainD < -mainWidth * .2 ? .51 : mainD > mainWidth * .4 ? .23 : .39;
  // One broad, asymmetric blade leads a smaller folded sheath. The dark leaf
  // plane opens, holds and recoils around a travelling diagonal midrib; the
  // curled leading edge turns back into the blade rather than making a wave.
  for (let leaf = 0; leaf < 2; leaf++) {
    const side = leaf === 0 ? -1 : 1, half = leaf === 0 ? .255 : .22;
    const q = (wrap(p - (leaf === 0 ? .36 : .83) + .5) - .5) / half;
    if (Math.abs(q) > 1) continue;
    const t = (q + 1) / 2;
    const opening = NATURE_OPEN[leaf][s.frame];
    const h = (leaf === 0 ? .74 : .65) * (.2 + g * .8) * opening * taper;
    const outer = t < .28 ? t / .28 : t < .63 ? 1 - (t - .28) * .45 : t < .82 ? .8425 - (t - .63) * 1.35 : .586 - (t - .82) * 2.15;
    const inner = t < .42 ? t * .22 : t < .82 ? .0924 + (t - .42) * .67 : .3604 - (t - .82) * .82;
    const z = (s.v - main) * side;
    if (z >= inner * h && z <= outer * h && t < .94) {
      const vein = (t < .28 ? t * 1.55 : .434 + (t - .28) * .18) * h;
      ink = z > vein ? .31 : .46;
      if (z > outer * h - Math.max(s.px * .44, .027)) ink = .58;
      if (z < inner * h + Math.max(s.px * .42, .025)) ink = .22;
      if (Math.abs(z - vein) < Math.max(s.px * .42, .026) && t > .18 && t < .58) ink = .66;
    }
    // A short returned lip occludes the forward face. Its asymmetric dark
    // inset opens toward the leaf, so this is a rolled edge, not a leaf hole.
    const curlX = (t - .89) / .073, curlY = (z - h * .4) / Math.max(.001, h * (.12 + opening * .11));
    if (t > .82 && curlX * curlX + curlY * curlY < 1) {
      ink = curlY > 0 ? .57 : .36;
      const insetX = (t - .863) / .06, insetY = (z - h * .405) / Math.max(.001, h * .115);
      if (insetX * insetX + insetY * insetY < 1 && t < .915) ink = .18;
      else if (curlY > .3) ink = .64;
    }
  }
  return ink;
}

function illusion(s: Surface): Ink {
  const a = axis(s.u), d = s.v - a, g = grow(s.u);
  let ink: Ink = Math.abs(d) < Math.max(s.px * .46, .035) ? .36 : null;
  // Staggered open parallelograms overlap with hard-pixel broken interiors.
  // Nothing blends alpha with its neighbours or applies a screen-space halo.
  for (let layer = 0; layer < 2; layer++) {
    const q = wrap(s.u * 2.5 - s.frame / 8 + layer * .43);
    const offset = layer === 0 ? -.19 * g : .18 * g, z = d - offset - (q - .5) * .19;
    const h = (.06 + g * .2) * tip(s.u, .95), end = Math.min(q, 1 - q);
    if (q < .035 || q > .94 || Math.abs(z) > h) continue;
    const edge = Math.abs(Math.abs(z) - h);
    if (edge < Math.max(s.px * .5, .03) || end < .065) ink = layer ? .53 : .83;
    else if (Math.abs(z + h * .28) < s.px * .48 && q < .65) ink = .31;
    else if (q < .55 && z < 0 && Math.floor((q * 6 + z) / s.px) % 3 === 0) ink ??= .24;
  }
  return ink;
}

function light(s: Surface): Ink {
  const a = axis(s.u), d = Math.abs(s.v - a), g = grow(s.u);
  const front = .5 + .5 * downstream(s, 2);
  const core = Math.max(s.px * .6, .055 + .045 * g);
  if (d < core) return .86 + front * .14;
  if (d < core + .055 * g && s.u < .96) return .57 + front * .18;
  // Narrow straight rays fan from one throat, with different physical ends.
  const rays = Math.min(segment(s.u, s.v, 0, .25, .94, -.45), segment(s.u, s.v, 0, .25, .82, .46));
  if (rays < Math.max(s.px * .48, .028)) return .52 + front * .27;
  if (s.u > .18 && s.u < .89 && d < .15 * g && front > .75) return .45;
  return null;
}

function shadow(s: Surface): Ink {
  const g = grow(s.u), wave = downstream(s, 1.25), a = axis(s.u) - .05 * g;
  const upper = (.08 + g * (.39 + wave * .08)) * tip(s.u, .93);
  const lower = (.07 + g * (.26 - wave * .04)) * tip(s.u, .93), d = s.v - a;
  if (d < -Math.max(s.px * .58, upper) || d > Math.max(s.px * .58, lower)) return null;
  if (d < -upper + Math.max(s.px * .65, .035)) return s.u > .24 && s.u < .73 ? .73 : .55;
  const fold = -.11 + downstream(s, 1.25, -.65) * .15 * g;
  if (Math.abs(d - fold) < Math.max(s.px * .55, .035)) return .41;
  if (d < fold) return .21 + wave * .03;
  if (d > lower - s.px * .65) return .37;
  return .05;
}

function matter(s: Surface): Ink {
  const g = grow(s.u), a = axis(s.u), d = s.v - a;
  const q = wrap(s.u * 2.6 - s.frame / 8), width = (.075 + g * .29) * tip(s.u, .94);
  const stepped = q < .18 ? width * .84 : q < .68 ? width : width * .9;
  if (Math.abs(d) > Math.max(s.px * .6, stepped)) return null;
  // Granules fuse into a dense irregular extrusion with only a few broad joints.
  // Its connected packed faces differ from earth's separated chipped aggregates.
  if (q < .055 && s.u > .15) return .22;
  const cross = d + (q > .52 ? .085 : -.055);
  if (Math.abs(cross) < s.px * .48 && s.u > .16) return .26;
  if (d < -stepped + s.px * .8) return .68;
  if (q > .76 && d > -.07) return .34;
  if (q > .2 && q < .34 && d > .08 && d < .16) return .53;
  return cross < 0 ? .57 : .43;
}

function gravity(s: Surface): Ink {
  const a = axis(s.u) + Math.sin(s.u * Math.PI) * .065, d = s.v - a;
  const radius = (.1 + grow(s.u) * .62) * (1 - s.u * .53);
  const z = Math.abs(d) / Math.max(.03, radius);
  if (z > 1) return null;
  // Fronts compress as they advance. These are open inward-curved bands, with
  // narrowing spacing/height, unlike sound's equal wavelength widening arcs.
  const p = Math.pow(s.u, 1.7) * 5.2 - s.frame / 8 + z * z * .09;
  const q = wrap(p), distance = Math.min(q, 1 - q) * 1.15;
  if (distance < Math.max(s.px * .6, .05)) return .73 - z * .15;
  if (distance < Math.max(s.px * 1.3, .105)) return .31;
  if (Math.abs(d) < Math.max(s.px * .46, .035)) return .4 + s.u * .15;
  return null;
}

function space(s: Surface): Ink {
  const a = axis(s.u), d = s.v - a, g = grow(s.u);
  let ink: Ink = Math.abs(d) < Math.max(s.px * .46, .035) ? .29 : null;
  const p = s.u * 3.2 - s.frame / 4, q = wrap(p), cell = Math.floor(p), side = (cell & 1) ? 1 : -1;
  const h = (.07 + g * .48) * tip(s.u, .95), z = d * side;
  // Orthogonal stepped apertures shear into folded planes along the emission.
  // The attached corner is solid; the recessed opening stays visibly empty.
  const ledge = q < .25 ? h * .44 : q < .7 ? h : h * .66;
  const edge = Math.max(s.px * .52, .035);
  if (q > .05 && q < .94 && z >= -.055 && z < ledge) {
    if (Math.abs(z - ledge) < edge || q < .115 || (q > .7 && q < .77 && z > h * .35)) ink = .7;
    else if (q > .79 || z < .03) ink = .44;
    else if (z > ledge - h * .2 && q < .68) ink = .24;
    else if (q > .46 && q < .54 && Math.abs(z - h * .46) < edge) ink = .96;
  }
  return ink;
}

const PAINTERS: Record<Exclude<BodyMaterial, 'fogo'>, (s: Surface) => Ink> = {
  agua: water, gelo: ice, terra: earth, raio: lightning, acido: acid, metal,
  vento: wind, som: sound, natureza: nature, ilusao: illusion, luz: light,
  sombra: shadow, materia: matter, gravidade: gravity, espaco: space
};

/**
 * Authored maintained streams, not projectiles or recoloured flames. Every pose
 * is a complete native-pixel drawing. The stable phase-zero silhouette is also
 * suitable for deterministic material ownership in a mixed-body compositor.
 */
export function paintMaterialStream(pix: Pix, x: number, y: number, scale: number,
  ramp: readonly RGB[], material: BodyMaterial, frame = 0): Bounds {
  if (material === 'fogo') return paintFlameJet(pix, x, y, scale, ramp, frame);
  const q = materialStreamBounds(scale), s = (q.r - q.l) / 6;
  const bounds = { l: x + q.l, r: x + q.r, t: y + q.t, b: y + q.b };
  if (!ramp.length) return bounds;
  const f = frameOf(frame), sample = PAINTERS[material];
  const surface: Surface = { u: 0, v: 0, px: 1 / s, frame: f, phase: f * TAU / 8 };
  for (let yy = Math.ceil(bounds.t); yy <= Math.floor(bounds.b); yy++) for (let xx = Math.ceil(bounds.l); xx <= Math.floor(bounds.r); xx++) {
    surface.u = (xx - bounds.l) / (6 * s); surface.v = (yy - y) / s;
    let ink = sample(surface);
    // Fixed throat: every material remains attached to the same hand/feed point.
    if (surface.u < .07 && Math.abs(surface.v - axis(surface.u)) < Math.max(.08, surface.px * .65)) ink ??= .58;
    // At six-to-twelve pixels across, retain a one-pixel current beneath the
    // authored facets/fronts instead of losing the route to subpixel rounding.
    if (s <= 2 && Math.abs(surface.v - axis(surface.u)) < surface.px * .65) ink ??= .4;
    if (ink !== null) pix.set(xx, yy, ramp[Math.round(clamp01(ink) * (ramp.length - 1))]);
  }
  return bounds;
}

/** A narrow hand-to-source conduit. This is behind the maintained body. */
export function paintMaterialStreamFeed(pix: Pix, source: readonly [number, number], target: readonly [number, number],
  ramp: readonly RGB[], material: BodyMaterial, frame = 0): void {
  if (material === 'fogo') { paintFlameFeed(pix, source, target, ramp, frame); return; }
  if (!ramp.length) return;
  const f = frameOf(frame), phase = f * TAU / 8, dx = target[0] - source[0], dy = target[1] - source[1];
  const steps = Math.max(2, Math.ceil(Math.hypot(dx, dy) * 2));
  const tone = (n: number): RGB => ramp[Math.round(clamp01(n) * (ramp.length - 1))];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps, x = source[0] + dx * u, y = source[1] + dy * smooth(u);
    const pulse = .5 + .5 * Math.sin(u * TAU * 2 - phase), taper = Math.sin(u * Math.PI);
    const front = wrap(u * 4 - f / 8), tick = front < .16;
    switch (material) {
      case 'agua':
        pix.set(x, y + 1, tone(.32)); pix.set(x, y, tone(.55 + pulse * .24)); break;
      case 'acido':
        pix.set(x, y + 1, tone(tick ? .23 : .42)); pix.set(x, y, tone(.62 + pulse * .12));
        if (tick && taper > .6) pix.set(x, y + 2, tone(.32)); break;
      case 'gelo':
        pix.set(x, y, tone(.76)); pix.set(x, y + 1, tone(.3));
        if (tick && taper > .55) pix.set(x, y - 1, tone(.94)); break;
      case 'terra':
        pix.set(x, y, tone(tick ? .58 : .36)); pix.set(x, y + 1, tone(.23));
        if (tick && taper > .55) pix.set(x, y - 1, tone(.44)); break;
      case 'metal':
        pix.set(x, y + 1, tone(.18)); pix.set(x, y, tone(tick ? .97 : .51)); break;
      case 'raio': {
        const offset = Math.round(Math.sin(u * TAU * 2) * taper);
        pix.set(x, y + offset, tone(.43 + pulse * .49)); break;
      }
      case 'vento':
        pix.set(x, y, tone(.44 + pulse * .25));
        if (taper > .6) pix.set(x, y - 2 * taper, tone(.32 + pulse * .16)); break;
      case 'som':
        pix.set(x, y, tone(.34));
        if (tick && taper > .45) { pix.set(x, y - 1, tone(.71)); pix.set(x, y + 1, tone(.58)); } break;
      case 'natureza':
        pix.set(x, y, tone(.47 + pulse * .24));
        if (tick && taper > .45) pix.set(x, y + (front < .08 ? -1 : 1), tone(.39)); break;
      case 'ilusao':
        pix.set(x, y, tone(.51));
        if (front < .5 && taper > .4) pix.set(x, y - 1, tone(.3 + pulse * .2)); break;
      case 'luz':
        pix.set(x, y, tone(.76 + pulse * .24)); break;
      case 'sombra':
        pix.set(x, y, tone(.42)); pix.set(x, y + 1, tone(.08));
        if (taper > .6) pix.set(x, y + 2, tone(.19)); break;
      case 'materia':
        pix.set(x, y, tone(tick ? .3 : .59)); pix.set(x, y + 1, tone(.32)); break;
      case 'gravidade':
        pix.set(x, y, tone(.44 + pulse * .17));
        if (tick && taper > .55) pix.set(x, y - 1, tone(.68)); break;
      case 'espaco':
        pix.set(x, y, tone(.4));
        if (front < .3 && taper > .45) pix.set(x, y - 1, tone(tick ? .7 : .25)); break;
    }
  }
}
