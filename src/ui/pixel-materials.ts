import { clamp01, type RGB } from './pixel';

export type SpellMaterial = 'fire' | 'plasma' | 'water' | 'ice' | 'stone' | 'metal' | 'wind' | 'energy';

const TAU = Math.PI * 2;
const BLACK: RGB = [0, 0, 0];
const fract = (v: number): number => v - Math.floor(v);

/** Stable value for whole patches of texture, never alternating individual pixels. */
function patch(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 982451653);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Samples a material inside an already defined silhouette. u/v are local 0..1
 * coordinates; light is the face or surface illumination. Only supplied palette
 * colours are used: hard-edged bands and shared clusters keep the tiny sprites
 * legible without Bayer/checkerboard shading or browser/canvas dependencies.
 */
export function materialPixel(
  ramp: RGB[], mat: SpellMaterial, x: number, y: number,
  u: number, v: number, light: number, seed: number, element?: string
): RGB {
  if (!ramp.length) return BLACK;
  u = clamp01(u); v = clamp01(v); light = clamp01(light);
  const phase = ((seed >>> 0) % 997) / 997 * TAU;
  let tone: number;

  switch (mat) {
    case 'fire': {
      // Curving, nested tongues: a narrow ivory heart, gold, orange, red edge.
      const spine = .46 + Math.sin(v * 6 + phase) * .065 + Math.sin(v * 13 + phase) * .028;
      const width = .19 + v * .14;
      const heat = Math.max(0, 1 - Math.abs(u - spine) / width);
      tone = .18 + light * .2 + heat * .52;
      if (heat > .78 && v > .37 && v < .83) tone = .96;
      else if (heat > .4) tone = Math.max(tone, .69);
      // A secondary filament remains orange, so the body never washes to white.
      const filament = spine + .21 + Math.sin(v * 10 + phase) * .035;
      if (Math.abs(u - filament) < .035 && v > .26 && v < .88) tone = .68;
      break;
    }
    case 'plasma': {
      const radius = Math.hypot((u - .47) * 1.07, v - .49);
      tone = .3 + light * .2 + Math.max(0, .48 - radius) * .65;
      const arc = .48 + Math.sin(v * 13 + phase) * .08 + Math.sin(v * 27 + phase) * .025;
      if (Math.abs(u - arc) < .045) tone = .98;
      else if (Math.abs(u - arc) < .1) tone = .78;
      // Light is a broad radiance; electricity keeps its narrow current.
      if (element === 'luz' && radius < .2) tone = Math.max(tone, .86);
      if (radius > .4 && radius < .48 && u < .66) tone = Math.max(tone, .76);
      break;
    }
    case 'water': {
      const wave = fract((v + Math.sin(u * 5.5 + phase) * .065) * 3.2);
      tone = .19 + light * .48;
      if (wave > .73 && wave < .9) tone += .2;
      else if (wave < .15) tone -= .12;
      // An off-centre reflection and a shorter bounce, not a solid white outline.
      const shine = Math.abs(u - (.24 + (v - .2) * .32));
      if (shine < .045 && v > .15 && v < .4) tone = .97;
      if (shine < .09 && v > .19 && v < .33) tone = Math.max(tone, .8);
      if (u > .67 && u < .84 && Math.abs(v - (.74 - (u - .67) * .5)) < .025) tone = .8;
      break;
    }
    case 'ice': {
      // Large intersecting facets show a crystal even at a dozen pixels wide.
      const facet = u + v * .63;
      tone = .25 + light * .41;
      if (facet < .62) tone += .16;
      else if (u - v * .48 > .29) tone -= .13;
      else if (v > .64) tone += .08;
      if (Math.abs(facet - .63) < .035 || (v < .62 && Math.abs(u - v * .48 - .28) < .025)) tone = .86;
      if (u > .18 && u < .36 && v > .13 && v < .24) tone = .98;
      break;
    }
    case 'stone': {
      // Coarse angular mineral patches and one broken hairline fissure.
      const px = Math.floor((u + v * .3) * 4.2), py = Math.floor((v - u * .18) * 4.5);
      tone = .13 + light * .61 + (patch(px, py, seed) - .5) * .25;
      const crack = .57 + (v < .31 ? -.08 : v < .58 ? .02 : -.035);
      if (Math.abs(u - crack) < .018 && v > .16 && v < .86) tone = Math.min(tone, .19);
      if (v > .55 && v < .66 && Math.abs(u - (.59 + (v - .55) * 2)) < .02) tone = .18;
      break;
    }
    case 'metal': {
      // A clean reflection ribbon bounded by a dark reflected band.
      const reflection = u + v * .26;
      tone = .12 + light * .49;
      if (reflection > .27 && reflection < .4) tone = .87;
      else if (reflection >= .4 && reflection < .46) tone = .99;
      else if (reflection >= .46 && reflection < .58) tone = .23;
      else if (reflection > .77 && reflection < .84) tone = .68;
      break;
    }
    case 'wind': {
      // A dark, restrained body lets bright streams describe the volume.
      const stream = fract((v + Math.sin(u * 5 + phase) * .12) * 3.1);
      tone = .13 + light * .28;
      if (stream > .78 && stream < .9) tone = .77;
      else if (stream > .67 && stream < .78) tone = .52;
      if (u > .18 && u < .65 && stream > .84 && stream < .9) tone = .93;
      break;
    }
    case 'energy': {
      const radius = Math.hypot((u - .5) * 1.03, v - .5);
      tone = .18 + light * .34;
      if (radius > .37 && radius < .49) tone = .76;
      if (radius > .4 && radius < .47 && u + v < .82) tone = .96;
      const current = Math.abs(v - (.5 + Math.sin(u * 8 + phase) * .13));
      if (current < .025 && u > .15 && u < .85) tone = Math.max(tone, .72);
      // Rare two-pixel glints stay together instead of becoming texture noise.
      if (radius < .25 && patch(Math.floor(x / 2), Math.floor(y / 2), seed) > .985) tone = .86;
      break;
    }
  }

  return ramp[Math.round(clamp01(tone) * (ramp.length - 1))];
}
