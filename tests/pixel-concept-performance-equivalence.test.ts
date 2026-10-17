import { describe, expect, it } from 'vitest';
import type { Being } from '../src/core/appearance';
import { Pix, rgb, type RGB } from '../src/ui/pixel';
import { CONCEPT_MOTIFS, paintConceptAura, type ConceptAuraOptions } from '../src/ui/pixel-concept-fx';
import { renderPixelScene } from '../src/ui/pixel-scene';

// Goldens captured before the exact-output optimization (including scene
// protection). They guard bytes, not an approximate image-distance threshold.
const BASELINE_SOURCE_SHA256 = 'bc2bb9fd663cbb218b4dc994bd9a2ca615266c7969330784b41540c59d6b51b8';
const EXPECTED: Record<string, string> = {
  "isolated": "ac242157e0e606c842697e98f5c63e3c9411f9c05f299c3f91c95728d2ff244e",
  "bodies": "efb7ca5f6202c541565355b298ebd031ba26c657883bf004e3503e0c4e73ecca",
  "mutations": "f65dfe814a68f18c36dd135b152c9654680475868c8f297be039b80e66cf42c3",
  "scenes": "d971cf3aba6e5863624627904045944ff0a1c1d89201d5339e9985f798f1ca5a"
};
const ramp = ['#202a36', '#4a5969', '#78899a', '#a9bac9', '#e3edf5'].map(rgb);
const hash = (): { update(data: Uint8ClampedArray): void; digest(): Promise<string> } => {
  const chunks: Uint8Array[] = [];
  return {
    update(data) { chunks.push(new Uint8Array(data)); },
    async digest() {
      const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }
  };
};
const protectedMask = (): Uint8Array => Uint8Array.from({ length: 96 * 96 }, (_, i) => (i % 96 * 3 + Math.floor(i / 96) * 7) % 17 === 0 ? 1 : 0);

export async function conceptPixelDigests(paint = paintConceptAura): Promise<Record<string, string>> {
  const isolated = hash(), bodies = hash(), mutations = hash();
  const configurations: Array<{ r: number; center: number; options: ConceptAuraOptions }> = [
    { r: 1, center: 47.5, options: {} }, { r: 4, center: 47, options: { glow: false, ring: false } },
    { r: 8, center: 47.2, options: {} }, { r: 14, center: 47.75, options: { glow: false } },
    { r: 23, center: 47.5, options: { radii: { x: 23, y: 8 } } },
    { r: 23, center: 47.5, options: { radii: { x: 8, y: 23 }, glow: false, ring: false } },
    { r: 16, center: 47.5, options: { protectedPixels: protectedMask() } },
    { r: 14, center: -1.2, options: {} }
  ];
  for (const configuration of configurations) for (const concept of CONCEPT_MOTIFS) for (let frame = 0; frame < 8; frame++) {
    const p = new Pix(96, 96), { r, center, options } = configuration;
    paint(p, concept, center, center, r, ramp, { ...options, frame }); isolated.update(p.data);
  }
  for (const kind of ['sphere', 'hole', 'lance', 'stepped']) {
    const body = new Pix(96, 96), p = new Pix(96, 96), bounds = { l: 20, t: 24, r: 75, b: 71 };
    body.shape(20, 24, 75, 71, (x, y): RGB | null => {
      const dx = x - 47.5, dy = y - 47.5, d = Math.hypot(dx, dy);
      const inside = kind === 'sphere' ? d <= 13 : kind === 'hole' ? d <= 13 && d >= 4 :
        kind === 'lance' ? Math.abs(dy) <= 6 - Math.abs(dx) * .2 : Math.abs(dx) <= 18 && Math.abs(dy) <= (dx < -4 ? 14 : dx < 7 ? 6 : 10);
      return inside ? ramp[2] : null;
    });
    for (let frame = 0; frame < 8; frame++) for (const concept of CONCEPT_MOTIFS) {
      p.data.fill(0);
      paint(p, concept, 47.5, 47.5, 22, ramp, { frame, glow: false, body, bodyBounds: bounds,
        radii: kind === 'lance' ? { x: 22, y: 8 } : undefined, protectedPixels: protectedMask() });
      bodies.update(p.data);
    }
    // Cached geometry must survive color-only changes and invalidate on alpha,
    // bounds, center, destination identity, and frame-to-frame Pix reuse.
    for (let frame = 0; frame < 8; frame++) {
      for (let y = 40; y <= 55; y++) {
        const i = (y * 96 + 47) * 4;
        body.data[i] = frame * 27; body.data[i + 3] = frame % 2 ? 255 : 0;
      }
      p.data.fill(0);
      for (const concept of CONCEPT_MOTIFS) paint(p, concept, 47.5 + frame % 2, 47.5, 22, ramp,
        { frame, body, bodyBounds: frame < 4 ? bounds : { l: 27, t: 31, r: 67, b: 63 }, glow: false });
      mutations.update(p.data);
    }
  }
  return { isolated: await isolated.digest(), bodies: await bodies.digest(), mutations: await mutations.digest() };
}

export async function conceptSceneDigest(render = renderPixelScene): Promise<string> {
  const all = [...CONCEPT_MOTIFS], four = ['tempo', 'movimento', 'caos', 'infinito'];
  const being = (extra: Partial<Being> = {}): Being => ({ elements: ['agua'], shapes: ['forma_esfera'], concepts: four,
    placement: 'front', projectile: false, orbit: false, direction: null, guards: [], estado: false,
    linked: false, merged: false, bond: null, closed: false, ...extra });
  const scenes: Being[][] = [
    [being()], [being({ shapes: [], intentForm: 'dragao' })],
    [being({ elements: ['fogo'], shapes: [], intentForm: 'lanca', concepts: all })],
    [being({ shapes: [], intentGlyph: 'AB', concepts: all })],
    [being({ elements: [], shapes: [], concepts: all })],
    Array.from({ length: 6 }, () => being({ orbit: true })),
    Array.from({ length: 8 }, (_, i) => being({ orbit: true, concepts: all, shapes: [], intentForm: i % 2 ? 'dragao' : 'lanca' })),
    [being({ concepts: all, placement: 'self', projectile: true, direction: 'back' }),
      ...Array.from({ length: 6 }, () => being({ orbit: true, concepts: ['pressao', 'vida'] }))]
  ];
  const digest = hash();
  for (const beings of scenes) for (const night of [false, true]) for (let frame = 0; frame < 8; frame++)
    digest.update(render({ beings, orbitCount: beings.filter(b => b.orbit).length }, night, frame).pix.data);
  return digest.digest();
}

describe('concept painter exact-output performance refactor', () => {
  it('matches frozen native pixels across all eight motifs, fits, cutouts and changing masks', async () => {
    expect(BASELINE_SOURCE_SHA256).toHaveLength(64);
    expect(await conceptPixelDigests()).toEqual({ isolated: EXPECTED.isolated, bodies: EXPECTED.bodies, mutations: EXPECTED.mutations });
  });
  it('matches 128 complete day/night frames with four/eight concepts and crowded placements', async () => {
    expect(await conceptSceneDigest()).toBe(EXPECTED.scenes);
  });
});
