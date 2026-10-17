export { isMaintainedFireJet as isSustainedFlameJet } from '../core/spell-narrative-semantics';
import { clamp01, type Pix, type RGB } from './pixel';

export function flameJetBounds(scale: number): { l: number; t: number; r: number; b: number } {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return { l: -3 * s, r: 3 * s, t: -s, b: .8 * s };
}

/** Continuous narrow feed, composited behind other bodies in crowded scenes. */
export function paintFlameFeed(pix: Pix, source: readonly [number, number], target: readonly [number, number],
  ramp: readonly RGB[], frame = 0): void {
  if (!ramp.length) return;
  const phase = (Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0) * Math.PI / 4;
  const dx = target[0] - source[0], dy = target[1] - source[1];
  const length = Math.hypot(dx, dy), steps = Math.max(2, Math.ceil(length * 2));
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, ease = t * t * (3 - 2 * t);
    const x = source[0] + dx * t, y = source[1] + dy * ease;
    const pulse = .5 + .5 * Math.sin(t * Math.PI * 4 - phase);
    pix.set(x, y + 1, ramp[Math.round(.42 * (ramp.length - 1))]);
    pix.set(x, y, ramp[Math.round((.71 + pulse * .2) * (ramp.length - 1))]);
  }
}

/**
 * One continuous hot throat widens into two rolling, connected flame sheets.
 * Material fronts move source → tip; neither the source nor the whole jet blinks.
 * The analytical wave repeats exactly after eight complete readable poses.
 */
export function paintFlameJet(pix: Pix, x: number, y: number, scale: number,
  ramp: readonly RGB[], frame = 0): { l: number; t: number; r: number; b: number } {
  const q = flameJetBounds(scale), s = (q.r - q.l) / 6;
  const phase = (Number.isFinite(frame) ? ((Math.floor(frame) % 8) + 8) % 8 : 0) * Math.PI / 4;
  const l = x + q.l, r = x + q.r, t = y + q.t, b = y + q.b;
  if (!ramp.length) return { l, r, t, b };
  const tone = (v: number): RGB => ramp[Math.round(clamp01(v) * (ramp.length - 1))];
  for (let xx = Math.ceil(l); xx <= Math.floor(r); xx++) {
    const u = (xx - l) / Math.max(1, r - l);
    // The source is narrow and rigid. Turbulence develops downstream rather
    // than wobbling the caster's connection or becoming a floating campfire.
    const wave = u * Math.PI * 4 - phase;
    const axis = y + s * (.25 - .36 * u) + Math.sin(wave) * s * .055 * u;
    const taper = Math.sqrt(clamp01((1 - u) / .12));
    const open = (.11 + .61 * Math.pow(u, .72)) * (u < .88 ? 1 : taper);
    const swell = 1 + Math.sin(wave - .55) * .23 * u;
    const upper = Math.max(.55, s * open * swell);
    const lower = Math.max(.55, s * open * (1 - Math.sin(wave + .7) * .14 * u));
    for (let yy = Math.max(Math.ceil(t), Math.floor(axis - upper)); yy <= Math.min(Math.floor(b), Math.ceil(axis + lower)); yy++) {
      const offset = yy - axis, edge = offset < 0 ? -offset / upper : offset / lower;
      if (edge > 1) continue;
      // Two unequal tongues unravel downstream. Their roots overlap the
      // continuous sheet, while the cooler gap opens only at the dying tip.
      if (u > .79) {
        const split = clamp01((u - .79) / .2);
        const upperCenter = -s * .4 * split;
        const lowerCenter = s * .36 * split;
        const upperEnd = .96 + .04 * Math.sin(phase);
        const upperWidth = s * .34 * Math.sqrt(clamp01((upperEnd - u) / .17));
        const lowerEnd = .93 + .06 * Math.sin(phase + Math.PI);
        const lowerWidth = s * .31 * Math.sqrt(clamp01((lowerEnd - u) / .14));
        if ((u > upperEnd || Math.abs(offset - upperCenter) > Math.max(.35, upperWidth)) &&
          (u > lowerEnd || Math.abs(offset - lowerCenter) > Math.max(.35, lowerWidth))) continue;
      }
      const current = Math.sin(wave + offset / Math.max(1, s) * 3);
      // A hotter upper fold rolls over a cooler lower sheet. The off-centre
      // dark groove describes their overlap; it is never a cut through alpha.
      const foldAt = -.16 + .24 * Math.sin(wave - .65) * u;
      const fold = offset / Math.max(1, upper + lower) * 2 - foldAt;
      let heat = .33 + (1 - edge) * .31 + current * .055 * u;
      if (Math.abs(fold) < .12 && u > .2 && u < .9) heat -= .16;
      if (fold < -.12 && fold > -.43 && u > .12 && u < .91) heat += .14;
      if (u < .2 && Math.abs(offset) < Math.max(.5, s * open * .38)) heat = .96 - u * .3;
      // Discrete broad hot pockets travel through the sheet. The pale part
      // does not form a stationary ruler from the hand to the far endpoint.
      const pocket = clamp01((Math.sin(wave - .3) + .25) / 1.25);
      const coreAxis = -upper * (.15 + .2 * Math.sin(wave - .5));
      if (u >= .2 && u < .84 && Math.abs(offset - coreAxis) < (upper + lower) * (.13 + pocket * .17))
        heat = .56 + pocket * .38;
      if (u > .82) heat -= (u - .82) * 1.1;
      pix.set(xx, yy, tone(heat));
    }
  }
  return { l, r, t, b };
}
