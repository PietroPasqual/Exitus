import { describe, expect, it } from 'vitest';
import { BODY_MATERIALS, MATERIAL_SIGNATURES, sampleMaterialSignature,
  type BodyMaterial, type MaterialSignatureSample, type SignatureCue } from '../src/ui/pixel-mixture-signatures';
import { GRAY_RAMP } from './fixtures/material-signature-pix';

const shapes = [{ width: 9, height: 11 }, { width: 38, height: 5 }, { width: 5, height: 38 }];
function surface(element: BodyMaterial, width: number, height: number, frame: number,
  contact = true): MaterialSignatureSample[] {
  const samples: MaterialSignatureSample[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sample = sampleMaterialSignature({ element, ramp: GRAY_RAMP,
      u: x / (width - 1), v: y / (height - 1), illumination: .6,
      scale: { width, height, pixels: width * height }, frame, seed: 3,
      ...(contact ? { contact: { u: .55, v: .5, nx: 1, ny: 0 } } : {}) });
    expect(sample).not.toBeNull();
    samples.push(sample!);
  }
  return samples;
}
const tones = (samples: MaterialSignatureSample[]): string => samples.map(s => s.tone).join(',');
const changes = (a: MaterialSignatureSample[], b: MaterialSignatureSample[]): number =>
  a.reduce((count, sample, index) => count + Number(sample.color !== b[index].color), 0);

// These probes intentionally inspect sampled artwork rather than duplicating
// any shader's equations. Production allocation/masking has its own tests.
describe('Material anatomy on compact and elongated spell surfaces', () => {
  it.each(shapes)('keeps all 16 materials distinct in grayscale on a $width×$height surface', ({ width, height }) => {
    for (let frame = 0; frame < 8; frame++) {
      const signatures = BODY_MATERIALS.map(element => {
        const samples = surface(element, width, height, frame);
        expect(new Set(samples.map(s => s.tone)).size, `${element}/${frame}`).toBeGreaterThanOrEqual(3);
        expect(samples.some(s => s.cue !== 'body'), element).toBe(true);
        for (const sample of samples) expect(GRAY_RAMP).toContain(sample.color);
        return tones(samples);
      });
      expect(new Set(signatures).size, `frame ${frame}`).toBe(16);
    }
  });

  it.each(BODY_MATERIALS.filter(e => !MATERIAL_SIGNATURES[e].rigid || e === 'metal'))(
    '%s retains localized animation through narrow blades and compact surfaces', element => {
      for (const { width, height } of shapes) {
        const frames = Array.from({ length: 8 }, (_, frame) => surface(element, width, height, frame));
        expect(new Set(frames.map(tones)).size, `${width}×${height}`).toBeGreaterThan(1);
        const transitions = frames.map((samples, frame) => changes(samples, frames[(frame + 1) % 8]));
        expect(Math.max(...transitions)).toBeLessThan(width * height * .75);
        expect(transitions[7]).toBeLessThanOrEqual(Math.max(...transitions.slice(0, 7)) * 1.35 + 2);
        expect(tones(surface(element, width, height, 8))).toBe(tones(frames[0]));
      }
    });

  it.each(['terra', 'materia', 'gelo'] as const)('%s keeps rigid anatomy fixed even on thin strokes', element => {
    for (const { width, height } of shapes) {
      const cues = surface(element, width, height, 0).map(s => s.cue);
      for (let frame = 1; frame < 8; frame++) expect(surface(element, width, height, frame).map(s => s.cue)).toEqual(cues);
    }
  });

  it('carries the main rib, fold, rail or luminous channel along a blade instead of clipping it to one end', () => {
    const anatomy: Partial<Record<BodyMaterial, readonly SignatureCue[]>> = {
      fogo: ['tongue', 'kernel'], raio: ['fork'], metal: ['reflection'], gelo: ['ridge'],
      natureza: ['vein'], ilusao: ['echo'], luz: ['ray'], sombra: ['recess', 'ridge'],
      gravidade: ['pressure'], espaco: ['fold']
    };
    for (const [element, cues] of Object.entries(anatomy) as [BodyMaterial, readonly SignatureCue[]][])
      for (let frame = 0; frame < 8; frame++) {
        const samples = surface(element, 38, 5, frame, false), quarters = new Set<number>();
        samples.forEach((sample, index) => {
          if (cues.includes(sample.cue)) quarters.add(Math.floor(index % 38 / 10));
        });
        expect(quarters.size, `${element}/${frame}`).toBeGreaterThanOrEqual(3);
      }
  });

  it('keeps thin sound fronts connected across the stroke instead of scattering isolated crest pixels', () => {
    const width = 38, height = 5;
    for (let frame = 0; frame < 8; frame++) {
      const samples = surface('som', width, height, frame, false), visited = new Set<number>();
      let tallestFront = 0;
      for (let i = 0; i < samples.length; i++) {
        if (samples[i].cue !== 'wave' || visited.has(i)) continue;
        const pending = [i], rows = new Set<number>(); visited.add(i);
        while (pending.length) {
          const index = pending.pop()!, x = index % width, y = Math.floor(index / width); rows.add(y);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy, next = ny * width + nx;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited.has(next) || samples[next].cue !== 'wave') continue;
            visited.add(next); pending.push(next);
          }
        }
        tallestFront = Math.max(tallestFront, rows.size);
      }
      expect(tallestFront, `frame ${frame}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps contact lighting local to its supplied root instead of recoloring the whole material', () => {
    const width = 25, height = 25, contact = { u: .55, v: .5, nx: 1, ny: 0 };
    const reach = Math.max(3, Math.min(width, height) * .45);
    for (const element of BODY_MATERIALS) for (let frame = 0; frame < 8; frame++) {
      const withContact = surface(element, width, height, frame), without = surface(element, width, height, frame, false);
      for (let i = 0; i < withContact.length; i++) {
        const u = i % width / (width - 1), v = Math.floor(i / width) / (height - 1);
        if (Math.hypot((u - contact.u) * width, (v - contact.v) * height) >= reach)
          expect(withContact[i]).toEqual(without[i]);
      }
    }
  });
});
