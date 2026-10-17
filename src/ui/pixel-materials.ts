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
  // Hash first so adjacent pieces have distinct currents even with seed + 1.
  const phase = patch(11, 17, seed) * TAU;
  let tone: number;

  switch (mat) {
    case 'fire': {
      // A warped heat volume keeps the ball round without drawing a ring/glyph.
      const curl = Math.sin(v * 8 + phase) * .047 + Math.sin(v * 15 + phase) * .017;
      const radius = Math.hypot((u - .45 + curl) * 1.08, (v - .53) * 1.03);
      const volume = Math.max(0, 1 - radius / .54);
      tone = .2 + light * .22 + volume * .42;
      if (radius < .13) tone = Math.max(tone, .8);
      // Short curved filaments sit within the larger orange/gold heat planes.
      const heart = .46 + Math.sin((v - .35) * 9 + phase * .3) * .045;
      if (Math.abs(u - heart) < .032 && v > .43 && v < .65) tone = .95;
      const filament = .42 + Math.sin(v * 8 + phase) * .15;
      if (Math.abs(u - filament) < .028 && v > .17 && v < .43) tone = Math.max(tone, .77);
      const fold = .62 - Math.sin(v * 6 + phase) * .13;
      if (Math.abs(u - fold) < .032 && v > .44 && v < .77 && radius > .23) tone -= .1;
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
      const dx = u - .49, dy = (v - .49) * 1.06;
      const radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      const volume = Math.max(0, 1 - radius / .66);
      // A spiral joins into broad curved streams around a quieter centre.
      const current = Math.sin(angle * 2 + radius * 10 + phase * .4);
      tone = .14 + light * .44 + volume * .13;
      if (current > .68 && radius > .12) tone += .18;
      else if (current < -.72 && radius > .16) tone -= .11;
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
      const dx = (u - .5) * 1.03, dy = v - .5;
      const radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      const volume = Math.max(0, 1 - radius / .62);
      if (element === 'sombra' || element === 'morte' || element === 'vazio') {
        // Shadow has dark depth and smoke folds, never the generic silver rim.
        tone = .025 + light * .24 + volume * .055;
        const smoke = Math.sin(angle * 2 + radius * 10 + phase);
        if (smoke > .68 && radius > .17 && radius < .43) tone += .12;
        if (radius > .4 && radius < .46 && angle > -2.6 && angle < -1.9) tone = Math.max(tone, .39);
        if (element === 'morte') {
          tone += .065;
          const fracture = Math.abs(u - (.52 + (v < .44 ? -.08 : .035)));
          if (fracture < .025 && v > .23 && v < .75) tone = .53;
        } else if (element === 'vazio') tone *= .65;
        break;
      }
      if (element === 'natureza' || element === 'vida') {
        // Growing planes and branching veins replace the ring of a green orb.
        tone = .13 + light * .43 + volume * .1;
        const stem = .44 + Math.sin(v * 4.8 + phase * .2) * .12;
        if (Math.abs(u - stem) < .035 && v > .18 && v < .85) tone = Math.max(tone, .67);
        const branch = Math.abs(v - (.27 + u * .52));
        if (branch < .027 && u > .2 && u < .73) tone = Math.max(tone, .61);
        if (u + v < .84 && v > .24 && u > .17) tone += .075;
        if (element === 'vida') {
          const heart = Math.hypot((u - .43) * 1.4, v - .44);
          if (heart < .13) tone = Math.max(tone, .78);
        }
        break;
      }
      if (element === 'espaco' || element === 'infinito') {
        tone = .08 + light * .25 + volume * .16;
        const spiral = Math.sin(angle * 2 + radius * 11 + phase);
        if (spiral > .76 && radius > .14 && radius < .44) tone = Math.max(tone, .66);
        if (element === 'infinito' && spiral < -.83 && radius > .2 && radius < .42) tone = Math.max(tone, .57);
        if (u > .27 && u < .34 && v > .23 && v < .3) tone = .9;
        break;
      }
      tone = .18 + light * .34;
      const rim = Math.sin(angle * 2 + phase);
      if (radius > .37 && radius < .49 && rim > -.28) tone = .76;
      if (radius > .4 && radius < .47 && u + v < .82 && rim > .15) tone = .96;
      const current = Math.abs(v - (.5 + Math.sin(u * 8 + phase) * .13));
      if (current < .025 && u > .15 && u < .85) tone = Math.max(tone, .72);
      // Rare two-pixel glints stay together instead of becoming texture noise.
      if (radius < .25 && patch(Math.floor(x / 2), Math.floor(y / 2), seed) > .985) tone = .86;
      break;
    }
  }

  return ramp[Math.round(clamp01(tone) * (ramp.length - 1))];
}
