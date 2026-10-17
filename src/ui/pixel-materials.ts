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
      // Three interlocking heat planes, with a small off-centre molten heart.
      // The dark curl is intentional negative space, not noise on an orange disc.
      const curl = Math.sin(v * 7 + phase) * .065;
      const radius = Math.hypot((u - .47 + curl) * 1.05, (v - .58) * .95);
      tone = .11 + light * .15;
      if (radius < .43) tone += .2;
      if (radius < .31) tone += .19;
      const tongue = .39 + Math.sin(v * 6 + phase * .35) * .1;
      const width = .025 + Math.max(0, v - .23) * .17;
      if (v > .23 && v < .8 && Math.abs(u - tongue) < width) tone = .78 + light * .08;
      const heart = Math.hypot((u - .43 - curl * .4) * 1.2, v - .64);
      if (heart < .12) tone = .98;
      // A broad red fold breaks the hot mass into two sculpted flame lobes.
      const fold = .58 + Math.sin(v * 6.3 + phase * .2) * .09;
      if (v > .19 && v < .65 && Math.abs(u - fold) < .045) tone = .26 + light * .1;
      const lip = .63 + Math.sin(v * 6.3 + phase * .2) * .09;
      if (v > .3 && v < .66 && Math.abs(u - lip) < .026 && radius < .4) tone = .74;
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
      const dx = u - .5, dy = (v - .5) * 1.05;
      const radius = Math.hypot(dx, dy);
      // A deep transparent basin sits between a curved upper reflection and
      // a thick lower caustic. Few connected planes keep tiny water readable.
      const bend = Math.sin(v * 5.3 + phase) * .09;
      tone = .08 + light * .43;
      if (u + v * .34 < .66) tone += .11;
      const basin = Math.hypot((u - .59 + bend * .8) * 1.15, (v - .47) * .9);
      if (basin < .25 && u > .43) tone -= .1;
      const rim = Math.hypot((u - .5 + bend) * 1.04, (v - .43) * 1.13);
      if (rim > .31 && rim < .4 && v > .57 && u > .24 && u < .84) tone = .7 + light * .08;
      const reflection = Math.hypot((u - .48) * .96, (v - .5) * 1.05);
      if (reflection > .31 && reflection < .4 && u < .48 && v < .49) tone = .82;
      if (reflection > .335 && reflection < .38 && u < .43 && v < .38) tone = .98;
      const crest = .65 - Math.sin(u * 5 + phase) * .11;
      if (u > .3 && u < .77 && Math.abs(v - crest) < .025 && radius < .38) tone = Math.max(tone, .59);
      break;
    }
    case 'ice': {
      // Three broad crystal planes and a single lit fracture; no speckled ice.
      const diagonal = u + v * .64;
      tone = diagonal < .68 ? .62 : u - v * .5 > .24 ? .23 : .42;
      tone += light * .2;
      if (v > .7 && u > .28 && u < .75) tone += .1;
      if (Math.abs(diagonal - .68) < .028 && v < .72) tone = .91;
      if (u > .2 && u < .37 && v > .14 && v < .26) tone = .99;
      break;
    }
    case 'stone': {
      // Chiselled planes meet along one branching seam, rather than a noisy ball.
      const left = u + v * .45 < .66, base = v - u * .25 > .57;
      tone = .12 + light * .35 + (left ? .24 : base ? -.05 : .1);
      const cut = .58 + (v < .34 ? (v - .34) * .6 : v < .62 ? 0 : (v - .62) * -.6);
      if (Math.abs(u - cut) < .022 && v > .2 && v < .83) tone = .13;
      if (v > .48 && v < .61 && Math.abs(u - (.58 - (v - .48) * 1.4)) < .018) tone = .16;
      if (Math.abs(u - cut + .035) < .014 && v > .3 && v < .59) tone += .14;
      tone += (patch(Math.floor(u * 3), Math.floor(v * 3), seed) - .5) * .07;
      break;
    }
    case 'metal': {
      // A narrow white reflection, a blue-black reflected band, and quiet steel.
      const reflection = u + v * .23;
      tone = .1 + light * .33;
      if (reflection > .24 && reflection < .36) tone = .68 + light * .12;
      else if (reflection >= .36 && reflection < .43) tone = .98;
      else if (reflection >= .43 && reflection < .57) tone = .1 + light * .08;
      else if (reflection >= .57 && reflection < .76) tone = .34 + light * .24;
      else if (reflection >= .76 && reflection < .82) tone = .69;
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
        tone = .035 + light * .24 + volume * .04;
        const smoke = Math.sin(angle * 2 + radius * 10 + phase);
        if (smoke > .35 && radius > .18 && radius < .43) tone += .15;
        if (radius < .16) tone *= .55;
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
