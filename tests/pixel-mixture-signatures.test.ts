import { describe, expect, it } from 'vitest';
import { CONCEPT_RUNES } from '../src/core/structural';
import { RUNES } from '../src/data/runes';
import { BODY_MATERIALS, MATERIAL_SIGNATURES, isBodyMaterial, sampleMaterialSignature,
  type BodyMaterial, type MaterialSignatureInput } from '../src/ui/pixel-mixture-signatures';
import { GRAY_RAMP, renderSignaturePix, SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const input = (element: BodyMaterial, overrides: Partial<MaterialSignatureInput> = {}): MaterialSignatureInput => ({
  element, ramp: GRAY_RAMP, u: .4, v: .4, illumination: .6, frame: 0, seed: 3,
  scale: { width: 25, height: 25, pixels: 400 }, ...overrides
});
const signature = (element: BodyMaterial, frame = 0, role: 'whole' | 'primary' | 'secondary' = 'whole'): string =>
  Array.from(renderSignaturePix(element, frame, role, 25, true).pix.data).join(',');
const changed = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
  let count = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
  return count;
};

describe('Complete body-material signature registry', () => {
  it('covers the exact 16 engine body materials, never the eight concepts', () => {
    const bodies = Object.keys(RUNES).filter(key => RUNES[key].category === 'elemental' && !CONCEPT_RUNES.has(key));
    expect([...BODY_MATERIALS].sort()).toEqual(bodies.sort());
    expect(Object.keys(MATERIAL_SIGNATURES).sort()).toEqual(bodies.sort());
    expect(CONCEPT_RUNES.size).toBe(8);
    for (const concept of CONCEPT_RUNES) {
      expect(isBodyMaterial(concept)).toBe(false);
      expect(sampleMaterialSignature(input(concept as BodyMaterial))).toBeNull();
    }
    expect(new Set(BODY_MATERIALS.map(e => MATERIAL_SIGNATURES[e].structure)).size).toBe(16);
    expect(new Set(BODY_MATERIALS.map(e => MATERIAL_SIGNATURES[e].motion)).size).toBe(16);
  });

  it.each(BODY_MATERIALS)('%s is finite, immutable, exact-palette, and deterministic through eight normalized frames', element => {
    const ramp = SIGNATURE_RAMPS[element];
    const original = structuredClone(ramp);
    for (let frame = 0; frame < 8; frame++) for (const [u, v] of [[0, 0], [.3, .7], [.5, .5], [1, 1]]) {
      const value = input(element, { ramp, frame, u, v });
      const before = structuredClone(value), sample = sampleMaterialSignature(value)!;
      expect(value).toEqual(before);
      expect(ramp.includes(sample.color)).toBe(true);
      expect(sample.tone).toBeGreaterThanOrEqual(0); expect(sample.tone).toBeLessThanOrEqual(1);
      expect(sample.strength).toBeGreaterThan(0); expect(sample.strength).toBeLessThanOrEqual(1);
      for (const shift of [-16, -8, .9, 8, 16]) expect(sampleMaterialSignature({ ...value, frame: frame + shift })).toEqual(sample);
    }
    expect(ramp).toEqual(original);
    for (const frame of [NaN, Infinity, -Infinity]) expect(sampleMaterialSignature(input(element, { frame }))).toEqual(sampleMaterialSignature(input(element)));
  });

  it('rejects coordinates outside the supplied domain and invalid scales without inventing a fallback material', () => {
    for (const overrides of [{ u: -.01 }, { u: 1.01 }, { v: -.01 }, { v: 1.01 }, { u: NaN }, { v: Infinity }, { ramp: [] },
      { scale: { width: 0, height: 25 } }, { scale: { width: 25, height: NaN } }]) expect(sampleMaterialSignature(input('agua', overrides))).toBeNull();
    expect(sampleMaterialSignature(input('unknown' as BodyMaterial))).toBeNull();
  });

  it.each(['whole', 'primary', 'secondary'] as const)('all sixteen have different grayscale structure in the %s role at frame zero', role => {
    const signatures = BODY_MATERIALS.map(element => signature(element, 0, role));
    expect(new Set(signatures).size).toBe(16);
  });

  it.each(BODY_MATERIALS)('%s has native structural pixels and a visible value split even in a partial secondary sphere', element => {
    for (const role of ['primary', 'secondary'] as const) for (let frame = 0; frame < 8; frame++) {
      const { pix, mask, cues, pixels } = renderSignaturePix(element, frame, role);
      const structural = Object.entries(cues).filter(([cue]) => cue !== 'body').reduce((sum, [, count]) => sum + count, 0);
      expect(structural, `${element}/${role}/${frame}`).toBeGreaterThan(3);
      expect(structural / pixels).toBeGreaterThan(.06);
      const colors = new Set<string>();
      for (let i = 0; i < pix.data.length; i += 4) {
        expect(pix.data[i + 3]).toBe(mask.data[i + 3]);
        if (pix.data[i] !== mask.data[i] || pix.data[i + 1] !== mask.data[i + 1] || pix.data[i + 2] !== mask.data[i + 2]) colors.add(Array.from(pix.data.slice(i, i + 3)).join(','));
      }
      expect(colors.size).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(BODY_MATERIALS.filter(e => !MATERIAL_SIGNATURES[e].rigid || e === 'metal'))('%s has localized motion in both roles without a special last-frame reset', element => {
    for (const role of ['primary', 'secondary'] as const) {
      const frames = Array.from({ length: 8 }, (_, frame) => renderSignaturePix(element, frame, role));
      expect(new Set(frames.map(f => Array.from(f.pix.data).join(','))).size).toBeGreaterThan(1);
      const changes = frames.map((f, i) => changed(f.pix.data, frames[(i + 1) % 8].pix.data));
      // A discrete electric channel jump is intended. The loop must not change
      // the whole domain or introduce a larger jump than the authored beats.
      expect(changes[7]).toBeLessThanOrEqual(Math.max(...changes.slice(0, 7)) * 1.35 + 2);
      expect(Math.max(...changes) / frames[0].pixels).toBeLessThan(.75);
    }
  });

  it.each(['terra', 'materia', 'gelo'] as const)('%s keeps all rigid facet and seam geometry fixed throughout the cycle', element => {
    for (const role of ['primary', 'secondary'] as const) {
      const reference = renderSignaturePix(element, 0, role).cuePixels;
      for (let frame = 1; frame < 8; frame++) expect(renderSignaturePix(element, frame, role).cuePixels).toEqual(reference);
    }
  });

  it('keeps metal reflection narrow and ice a broad pale face plus a blue side', () => {
    for (let frame = 0; frame < 8; frame++) {
      const metal = renderSignaturePix('metal', frame), ice = renderSignaturePix('gelo', frame);
      const rows = new Map<number, number>();
      for (const index of metal.cuePixels.reflection ?? []) rows.set(Math.floor(index / 36), (rows.get(Math.floor(index / 36)) ?? 0) + 1);
      expect(Math.max(...rows.values())).toBeLessThanOrEqual(1);
      expect((metal.cues.reflection ?? 0) / metal.pixels).toBeLessThan(.09);
      expect((ice.cues.face ?? 0) / ice.pixels).toBeGreaterThan(.8);
      const pale = SIGNATURE_RAMPS.gelo.slice(-2).map(c => c.join(','));
      let paleCount = 0, darkSide = 0;
      for (const index of ice.cuePixels.face ?? []) {
        const c = Array.from(ice.pix.data.slice(index * 4, index * 4 + 3)).join(',');
        if (pale.includes(c)) paleCount++;
        if (c === SIGNATURE_RAMPS.gelo[2].join(',')) darkSide++;
      }
      expect(paleCount / ice.pixels).toBeGreaterThan(.3);
      expect(darkSide / ice.pixels).toBeGreaterThan(.2);
    }
  });

  it('keeps a compact metal wedge dark steel with one narrow straight rail, never a broad ice-like pale face', () => {
    const ramp = SIGNATURE_RAMPS.metal;
    for (let frame = 0; frame < 8; frame++) {
      let dark = 0, mid = 0, reflections = 0;
      for (let y = 0; y < 13; y++) {
        let rowRail = 0;
        for (let x = 0; x < 20; x++) {
          const sample = sampleMaterialSignature(input('metal', {
            ramp, frame, u: x / 19, v: y / 12,
            scale: { width: 20, height: 13, pixels: 107 }
          }))!;
          if (sample.cue === 'reflection') { rowRail++; reflections++; expect(sample.color).toBe(ramp[4]); }
          else {
            expect(sample.cue).toBe('face');
            expect([ramp[1], ramp[2]]).toContain(sample.color);
            if (sample.color === ramp[1]) dark++;
            else mid++;
          }
        }
        expect(rowRail).toBeLessThanOrEqual(1);
      }
      expect(dark).toBeGreaterThan(80);
      expect(mid).toBeGreaterThan(70);
      expect(reflections).toBeGreaterThan(5);
      expect(reflections).toBeLessThanOrEqual(13);
    }
  });

  it('leaves the existing large-domain metal reflection recipe unchanged', () => {
    const ramp = SIGNATURE_RAMPS.metal, seed = 3;
    const variant = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let frame = 0; frame < 8; frame++) for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) {
      const u = x / 24, v = y / 24, light = .6;
      const d = (u + (v - .5) * .18 - .45 - Math.sin(frame * Math.PI / 4 + variant * Math.PI * 2) * .1) * 25;
      const expected = Math.abs(d) < .48 ? .99 : d > .48 && d < 25 * .17 ? .19
        : d < -.48 && d > -25 * .26 ? .72 + (light - .5) * .06
          : (u < .24 ? .38 : .49) + (light - .5) * .1;
      const sample = sampleMaterialSignature(input('metal', { ramp, frame, seed, u, v, illumination: light }))!;
      expect(sample.color).toBe(ramp[Math.round(expected * (ramp.length - 1))]);
    }
  });

  it('deliberately omits bubbles and stars from tiny regions while keeping a main structural cue', () => {
    for (const element of BODY_MATERIALS) {
      const cues = new Set<string>();
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const sample = sampleMaterialSignature(input(element, { u: x / 3, v: y / 3, scale: { width: 4, height: 4, pixels: 12 } }))!;
        expect(sample).not.toBeNull(); cues.add(sample.cue);
      }
      expect(cues.has('star')).toBe(false); expect(cues.has('bubble')).toBe(false);
      expect([...cues].some(cue => cue !== 'body')).toBe(true);
    }
  });
});
