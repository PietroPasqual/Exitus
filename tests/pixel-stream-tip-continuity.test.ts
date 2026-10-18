import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { materialStreamBounds, paintMaterialStream } from '../src/ui/pixel-material-stream';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

const REFINED = ['natureza', 'terra', 'gelo'] as const;
// These prefix hashes come from d89b9299a2c4e1c36107b5b0e6318e60ec7f4e81,
// before terminal polishing. Each includes eight frames at scales 1, 3, 8, 15.
const FROZEN_PREFIXES = [
  { material: 'gelo', until: .89, hash: '2627509f1e3ab7e3639b2af25dada708956db27aa5d94dda51e077a77be9548f' },
  { material: 'terra', until: .73, hash: '967702659234617367ed664791e9dd1c1dee4c51b5162b1b105743cb60924428' },
] as const;

function raster(material: BodyMaterial, frame: number, scale = 15, x = 90.5, y = 52.5): Pix {
  const p = new Pix(180, 105);
  paintMaterialStream(p, x, y, scale, SIGNATURE_RAMPS[material], material, frame);
  return p;
}
function occupied(p: Pix): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < p.w * p.h; i++) if (p.data[i * 4 + 3]) result.add(i);
  return result;
}
function componentSizes(p: Pix): number[] {
  const remaining = occupied(p), sizes: number[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value!;
    const stack = [start]; remaining.delete(start); let size = 0;
    while (stack.length) {
      const i = stack.pop()!, x = i % p.w, y = Math.floor(i / p.w); size++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= p.w || y + dy < 0 || y + dy >= p.h) continue;
        const next = i + dx + dy * p.w;
        if (remaining.delete(next)) stack.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}
async function sha256(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

describe('Purposeful maintained-stream tips and coherent leaf transport', () => {
  it('keeps accepted ice prisms and earth faces byte-exact before their exit regions', async () => {
    for (const { material, until, hash } of FROZEN_PREFIXES) {
      const bytes = new Uint8Array(4 * 8 * 180 * 105 * 4); let offset = 0;
      for (const scale of [1, 3, 8, 15]) for (let frame = 0; frame < 8; frame++) {
        const p = raster(material, frame, scale), b = materialStreamBounds(scale);
        const end = 90.5 + b.l + (b.r - b.l) * until;
        for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
          if (x >= end) p.data.fill(0, (y * p.w + x) * 4, (y * p.w + x) * 4 + 4);
        }
        bytes.set(p.data, offset); offset += p.data.length;
      }
      expect(await sha256(bytes), material).toBe(hash);
    }
  });

  it('keeps every leaf root and solid exit attached at integer and fractional native layouts', () => {
    for (const material of REFINED) for (const scale of [1, 2.1, 3, 7, 8, 15]) {
      for (const [x, y] of [[90, 52], [90.5, 52.5], [90.2, 52.8]]) for (let frame = 0; frame < 8; frame++) {
        const p = raster(material, frame, scale, x, y), sizes = componentSizes(p);
        expect(sizes.length, `${material} scale=${scale} center=${x},${y} frame=${frame}`).toBe(1);
        expect(sizes[0]).toBeGreaterThan(0);
      }
    }
  });

  it('advects nature leaves and stems together through all eight transitions', () => {
    const frames = Array.from({ length: 8 }, (_, frame) => {
      const p = new Pix(300, 140);
      paintMaterialStream(p, 150, 70, 32, SIGNATURE_RAMPS.natureza, 'natureza', frame);
      return p;
    });
    // The 192-pixel train advances 24 pixels per pose. Compare the mature
    // interior only, outside its source growth and terminal closing regions.
    // Half-speed was the former mismatch between the fibers and their leaves.
    const transportError = (frame: number, shift: number): number => {
      let error = 0;
      for (let y = 35; y < 99; y++) for (let x = 103; x < 185; x++) {
        const a = (y * 300 + x) * 4, b = (y * 300 + x + shift) * 4;
        for (let c = 0; c < 4; c++) error += Math.abs(frames[frame].data[a + c] - frames[(frame + 1) % 8].data[b + c]);
      }
      return error;
    };
    for (let frame = 0; frame < 8; frame++) {
      const moving = transportError(frame, 24);
      for (const shift of [0, 12, 36]) expect(moving, `transition ${frame}, alternate speed ${shift}`).toBeLessThan(transportError(frame, shift));
    }
  });

  it('ends earth in connected dust and ice in a short closed face', () => {
    const b = materialStreamBounds(15), left = 90.5 + b.l, length = b.r - b.l;
    for (let frame = 0; frame < 8; frame++) {
      const earth = raster('terra', frame), ice = raster('gelo', frame);
      for (let x = Math.ceil(left + length * .96); x <= Math.floor(left + length); x++) {
        const column = [...occupied(earth)].filter(i => i % earth.w === x);
        expect(column.length, `earth dust ${frame}, x=${x}`).toBeGreaterThan(0);
        expect(column.length, `earth dust ${frame}, x=${x}`).toBeLessThanOrEqual(2);
      }
      expect([...occupied(ice)].every(i => i % ice.w < left + length * .985), `ice finite tip ${frame}`).toBe(true);
      expect(componentSizes(earth).length).toBe(1);
      expect(componentSizes(ice).length).toBe(1);
    }
  });
});
