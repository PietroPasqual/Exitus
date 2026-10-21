import { describe, expect, it } from 'vitest';
import { Pix } from '../src/ui/pixel';
import { type BodyMaterial } from '../src/ui/pixel-mixture-signatures';
import { materialStreamBounds, paintMaterialStream, paintMaterialStreamFeed } from '../src/ui/pixel-material-stream';
import { SIGNATURE_RAMPS } from './fixtures/material-signature-pix';

// Accepted-partial checkpoint fa1467de0b95c95eba32eab366fd2b454ae93857.
// Each hash includes all eight poses at scales 1, 3, 8 and 15. Only the three
// expressly selected body constructions may change; even their feeds stay exact.
const UNCHANGED_BODY_HASHES = {
  "fogo": "c036498cc8bf9ed2ae040a8dc8e948f603895948caaae2f6bba2ac4dae4ea1ba",
  "agua": "bc2d571b0cd9e769002511ede01ca5da6d57a459b8b1e96c5476dae07f027560",
  "vento": "d273a9deb9833b5c557287a56faec06f05a9f9d79ff201f397da8e27feb612aa",
  "raio": "d2bc4fb2d20345c58e2702e5d15137dc2946a5f7f5a14f6d0f00c5766b304290",
  "metal": "3a356dbbb99b5d06e31e5f39b8aa292eb68f5f2712f2d1f8210d81b50a4ccd9f",
  "som": "61a5c8d1145b9e2c1699a33b517226657d9df7cb91eb45547a9c5ad87c910735",
  "acido": "08e441e4620ec0789d19a79b4b720981296a3462ad15d3b4ded249f3c8ceece5",
  "ilusao": "f8f313c80c9a696f092219d9cf23cdb36c7daaa57f94fce916d0f88696c77893",
  "luz": "26039aa13120e7262166e03ff3b3ad388dc39b8beee25c76538907480e94689c",
  "sombra": "b353d62c70608d72a14241b2a2c8ced38a2c17709ea71ea45ca6524f8e338d19",
  "materia": "d788a3c42be49e11b026375d0b1bcaf496328b04731471df9382159a28591cb6",
  "gravidade": "87ec5de65a2ab8d4b60b336495fbd3ee0816c3a08f72b74c09ab556f9a53fe43",
  "espaco": "1fff30d2bedf54093bb5a78194f05b33a7eb3d8797ce61fb5359232b4c342aec"
} as const;
const UNCHANGED_FEED_HASHES = {
  "fogo": "e03ec7dbede97ad9fb706491ee321c12598c5d1d34490d0efb9f97b7bd8d6a90",
  "terra": "3d656d2e903e9fef326d21883202821c51da5ee14be33ed3c6ba28ed065b7e8c",
  "agua": "b23744bb7d8434e7da3d96ad49571acbe9b8847f039ddb0d61a4b989190f2317",
  "vento": "e5ecc877fe03eb5d865d761c788c0417317f399669de48c0807782d80513a3d1",
  "raio": "a00e3498e39b0a47aa2fb15d1f1fb46281f74da3a96c5cadb85c461364ed2258",
  "metal": "e43002bdc99425c1f6771186fcec6aa3af0663eba34c58bebfc572953dbe561f",
  "gelo": "2a7f0713d2f2754164971ab6368714d4c49fed8df38b3e7ee5890e58b3587fa7",
  "som": "1aac9bbe674b75869a1e458703d2d0c9c81fef420175da09324a0a7e7535cbc0",
  "natureza": "feccec7daaa5069069e29c452a43904662ebc3c3a1debc2674ee42c3ba783d3f",
  "acido": "682f40e087697bbc51bea1049fcb691d2559b991d6e13841f22f0221ddbdf55b",
  "ilusao": "5daecd4100b4d35d9150228b0c9c2c5cc33832ef5eb1075fe96ac6224f2cdae6",
  "luz": "cc366aab8f1ff13e623ec29a51bbd0cd911c6407045a2870566646174b16c637",
  "sombra": "b73fb897611f4d2617a3f8ed575d27c73326a902749aafde89dc136b9f033a40",
  "materia": "62bd720e2134992cfa35f5030fa1f506c458f26f6146aea5ee8095aefd49eacc",
  "gravidade": "944624cc39c8c60a91e1e3e9d38cce453cd128f4a894cb0dfcbfb51dfb26cb0a",
  "espaco": "e3a7e36d3a1e5c6ea6b6fce26e4e81fd904a6995e196c040d29d175b2e91b8c8"
} as const;
const REFINED = ['terra', 'gelo', 'natureza'] as const;

function raster(material: BodyMaterial, frame: number): Pix {
  const p = new Pix(180, 105);
  paintMaterialStream(p, 90.5, 52.5, 15, SIGNATURE_RAMPS[material], material, frame);
  return p;
}
async function sha256(data: Uint8Array | Uint8ClampedArray): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function hashFrames(material: BodyMaterial, feed = false): Promise<string> {
  const bytes = new Uint8Array(4 * 8 * 180 * 105 * 4);
  let offset = 0;
  for (const scale of [1, 3, 8, 15]) for (let frame = 0; frame < 8; frame++) {
    const p = new Pix(180, 105), ramp = SIGNATURE_RAMPS[material];
    if (feed) paintMaterialStreamFeed(p, [12, 20], [41 + scale, 27], ramp, material, frame);
    else paintMaterialStream(p, 90.5, 52.5, scale, ramp, material, frame);
    bytes.set(p.data, offset); offset += p.data.length;
  }
  return sha256(bytes);
}
function occupied(p: Pix): number[] {
  const result: number[] = [];
  for (let i = 0; i < p.w * p.h; i++) if (p.data[i * 4 + 3]) result.push(i);
  return result;
}
function changedPixels(a: Pix, b: Pix): number {
  let count = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) count++;
  }
  return count;
}

describe('Scoped solid and organic maintained-stream refinement', () => {
  it('preserves every byte of the other thirteen accepted-partial profiles', async () => {
    for (const [material, expected] of Object.entries(UNCHANGED_BODY_HASHES)) {
      expect(await hashFrames(material as BodyMaterial), material).toBe(expected);
    }
  });

  it('preserves every byte of all sixteen hand-to-source feeds', async () => {
    for (const [material, expected] of Object.entries(UNCHANGED_FEED_HASHES)) {
      expect(await hashFrames(material as BodyMaterial, true), material).toBe(expected);
    }
  });

  it('keeps complete native-pixel poses, the fixed source and the shared envelope', () => {
    const b = materialStreamBounds(15), left = Math.ceil(90.5 + b.l), right = Math.floor(90.5 + b.r);
    for (const material of REFINED) for (let frame = 0; frame < 8; frame++) {
      const p = raster(material, frame), pixels = occupied(p), ramp = SIGNATURE_RAMPS[material];
      const colors = new Set(ramp.map(rgb => rgb.join(',')));
      expect(pixels.some(i => i % p.w <= left + 1 && Math.abs(Math.floor(i / p.w) - 56.25) <= 2), `${material} ${frame} source`).toBe(true);
      expect(pixels.every(i => {
        const x = i % p.w, y = Math.floor(i / p.w);
        return x >= left && x <= right && y >= 52.5 + b.t && y <= 52.5 + b.b;
      }), `${material} ${frame} envelope`).toBe(true);
      for (const i of pixels) {
        expect(p.data[i * 4 + 3]).toBe(255);
        expect(colors.has(Array.from(p.data.slice(i * 4, i * 4 + 3)).join(','))).toBe(true);
      }
      // Every interior longitudinal slice remains part of a maintained current.
      // Individual rigid faces may separate, but the route never becomes a shot.
      for (let x = left + 2; x < right - 1; x++) {
        expect(pixels.some(i => i % p.w === x), `${material} ${frame} x${x}`).toBe(true);
      }
      const heights = Array.from({ length: right - left - 1 }, (_, n) => {
        const ys = pixels.filter(i => i % p.w === left + n + 1).map(i => Math.floor(i / p.w));
        return ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
      });
      expect(Math.max(...heights), `${material} ${frame} local volume`).toBeGreaterThanOrEqual(8);
      expect(Math.max(...heights) - Math.min(...heights), `${material} ${frame} local taper`).toBeGreaterThanOrEqual(4);
    }
  });

  it('retains eight distinct complete poses and an ordinary 7-to-0 transition', async () => {
    for (const material of REFINED) {
      const frames = Array.from({ length: 8 }, (_, frame) => raster(material, frame));
      expect(new Set(await Promise.all(frames.map(p => sha256(p.data)))).size).toBe(8);
      expect(changedPixels(raster(material, 8), frames[0])).toBe(0);
      expect(changedPixels(raster(material, -1), frames[7])).toBe(0);
      const changes = frames.map((p, f) => changedPixels(p, frames[(f + 1) % 8]));
      expect(changes[7], `${material} wrap`).toBeLessThanOrEqual(Math.max(...changes.slice(0, 7)) * 1.25);
      const areas = frames.map(p => occupied(p).length);
      expect(Math.min(...areas), `${material} full paused poses`).toBeGreaterThan(Math.max(...areas) * .65);
    }
  });
});
