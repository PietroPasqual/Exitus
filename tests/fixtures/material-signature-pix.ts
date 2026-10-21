import { clamp01, darken, Pix, rgb, type RGB } from '../../src/ui/pixel';
import { BODY_MATERIALS, sampleMaterialSignature, type BodyMaterial, type SignatureCue } from '../../src/ui/pixel-mixture-signatures';

/** Production palettes copied explicitly for isolated shader probes. */
export const SIGNATURE_RAMPS: Record<BodyMaterial, RGB[]> = Object.fromEntries(Object.entries({
  fogo: ['#32142b', '#762040', '#c63a48', '#f66c42', '#ffb65f', '#ffe4a4', '#fff7df'],
  terra: ['#302632', '#57403a', '#8a6343', '#bb955d', '#e0c68d'],
  agua: ['#122346', '#17466a', '#237e9b', '#4dbac5', '#9de5df', '#ecfff1'],
  vento: ['#0b5a45', '#0ca678', '#38d9a9', '#96f2d7', '#e6fcf5'],
  raio: ['#1b204d', '#3b4d9d', '#438fd3', '#5adce4', '#b6f9ee', '#f3fff5'],
  metal: ['#202b43', '#45526c', '#8196a4', '#c8d8d6', '#f5fff1'],
  gelo: ['#26345e', '#3d6294', '#619dc9', '#90d8e7', '#c5f1ef', '#f4ffff'],
  som: ['#4b1460', '#862e9c', '#be4bdb', '#e599f7', '#f8e8fc'],
  natureza: ['#1e5e2a', '#2b8a3e', '#40c057', '#8ce99a', '#ebfbee'],
  acido: ['#3d6108', '#5c940d', '#94c11f', '#c0eb75', '#f4fce3'],
  ilusao: ['#4a1660', '#7b2a91', '#cc5de8', '#e599f7', '#f8f0fc'],
  luz: ['#563049', '#a15c3b', '#e5ac53', '#ffe9a4', '#fffce0'],
  sombra: ['#10101d', '#242039', '#48415e', '#766b8d', '#b8adcf'],
  materia: ['#3f1d0b', '#6e3417', '#a0522d', '#c97b4e', '#e8b38f'],
  gravidade: ['#1b2266', '#2f3fa8', '#4c6ef5', '#91a7ff', '#dbe4ff'],
  espaco: ['#1a0f45', '#3b2390', '#5f3dc4', '#9775fa', '#ece4ff']
}).map(([element, colors]) => [element, colors.map(rgb)])) as Record<BodyMaterial, RGB[]>;
export const GRAY_RAMP = ['#17202c', '#36404c', '#596370', '#7c8794', '#a8b2bd', '#d8dfe3', '#faffff'].map(rgb);
export type SignatureRole = 'whole' | 'primary' | 'secondary';
interface DomainPixel { x: number; y: number; light: number }
export interface SignaturePixProof {
  pix: Pix;
  mask: Pix;
  bounds: { l: number; t: number; r: number; b: number };
  cues: Record<string, number>;
  cuePixels: Partial<Record<SignatureCue, number[]>>;
  pixels: number;
}

/**
 * Isolated signature proof on a real Pix raster. This intentionally does not
 * pretend to be the production domain allocator or its contact compositor.
 * A 25px body gives the secondary a curved 9px-wide region, not a full tile.
 */
export function renderSignaturePix(element: BodyMaterial, frame = 0, role: SignatureRole = 'whole',
  diameter = 25, grayscale = false, seed = 3): SignaturePixProof {
  const pix = new Pix(36, 36), mask = new Pix(36, 36), center = 17, radius = (diameter - 1) / 2;
  const ramp = grayscale ? GRAY_RAMP : SIGNATURE_RAMPS[element];
  const pixels: DomainPixel[] = [];
  const boundary = center + radius * .19;
  const interior = (x: number, y: number): boolean => Math.hypot(x - center, y - center) <= radius;
  const selected = (x: number): boolean => role === 'whole' || (role === 'primary' ? x <= boundary : x > boundary);
  pix.shape(center - radius, center - radius, center + radius, center + radius, (x, y) => {
    if (!interior(x, y)) return null;
    const dx = (x - center) / radius, dy = (y - center) / radius;
    const light = clamp01(.35 + (-.5 * dx - .62 * dy + .6 * Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))) * .75);
    // Preserve the production-style one-pixel contour and its neighbors.
    if (selected(x) && interior(x - 1, y) && interior(x + 1, y) && interior(x, y - 1) && interior(x, y + 1)) pixels.push({ x, y, light });
    return GRAY_RAMP[Math.round((.2 + light * .46) * (GRAY_RAMP.length - 1))];
  }, darken(ramp[0], .45));
  mask.data.set(pix.data);
  const bounds = { l: Math.min(...pixels.map(p => p.x)), t: Math.min(...pixels.map(p => p.y)),
    r: Math.max(...pixels.map(p => p.x)), b: Math.max(...pixels.map(p => p.y)) };
  const w = Math.max(1, bounds.r - bounds.l), h = Math.max(1, bounds.b - bounds.t);
  const cues: Record<string, number> = {}, cuePixels: Partial<Record<SignatureCue, number[]>> = {};
  for (const { x, y, light } of pixels) {
    const sample = sampleMaterialSignature({ element, ramp, u: (x - bounds.l) / w, v: (y - bounds.t) / h,
      illumination: light, frame, seed, scale: { width: w + 1, height: h + 1, pixels: pixels.length },
      contact: { u: role === 'primary' ? 1 : 0, v: .55, nx: role === 'primary' ? -1 : 1, ny: 0 } });
    if (!sample) continue;
    pix.set(x, y, sample.color);
    cues[sample.cue] = (cues[sample.cue] ?? 0) + 1;
    (cuePixels[sample.cue] ??= []).push(y * pix.w + x);
  }
  return { pix, mask, bounds, cues, cuePixels, pixels: pixels.length };
}

export const SIGNATURE_PROOF_CASES = BODY_MATERIALS.flatMap(element =>
  (['whole', 'primary', 'secondary'] as const).flatMap(role =>
    Array.from({ length: 8 }, (_, frame) => ({ element, role, frame }))));
