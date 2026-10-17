import type { IntentionBox } from './pixel-intention';
import { darken, type Pix, type RGB } from './pixel';
import { materialPixel, type SpellMaterial } from './pixel-materials';

/** A real 5 × 7 alphabet: unfamiliar words keep every letter, not a random sigil. */
const FONT: Record<string, string> = {
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01111/10000/10000/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/10001/10001/11110',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01111/10000/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '01110/00100/00100/00100/00100/00100/01110',
  J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/11001/11001/10101/10011/10011/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/01010/00100/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  '.': '00000/00000/00000/00000/00000/00100/00100',
  ',': '00000/00000/00000/00000/00100/00100/01000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  ':': '00000/00100/00100/00000/00100/00100/00000',
  '/': '00001/00001/00010/00100/01000/10000/10000',
  '!': '00100/00100/00100/00100/00100/00000/00100',
  '?': '01110/10001/00001/00010/00100/00000/00100',
  '(': '00010/00100/01000/01000/01000/00100/00010',
  ')': '01000/00100/00010/00010/00010/00100/01000',
  "'": '00100/00100/01000/00000/00000/00000/00000',
  ' ': '00000/00000/00000/00000/00000/00000/00000'
};

interface Bitmap { width: number; height: number; unit: number; pixels: Uint8Array }
const bitmapCache = new Map<string, Bitmap>();

/** Normalisation is visual only: callers retain the original Intenção binding. */
function displayWord(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
    .replace(/Æ/g, 'AE').replace(/Œ/g, 'OE').replace(/Ø/g, 'O').replace(/Ł/g, 'L')
    .replace(/Ð/g, 'D').replace(/Þ/g, 'TH').replace(/\u2212/g, '-')
    .replace(/[\u2010\u2011]/g, '-').replace(/[\u2018\u2019]/g, "'")
    .replace(/[\t\r]/g, ' ').trim() || '?';
}

/** Lets the UI explain replacement glyphs while preserving the original binding. */
export function glyphHasUnsupportedCharacters(word: string): boolean {
  return Array.from(displayWord(word)).some(c => c !== '\n' && !Object.hasOwn(FONT, c));
}

/** Wrap at eight characters, centring shorter rows and retaining every glyph. */
function bitmap(word: string): Bitmap {
  const text = displayWord(word), cached = bitmapCache.get(text);
  if (cached) return cached;
  const lines: string[][] = [], chars = Array.from(text);
  let line: string[] = [];
  for (const c of chars) {
    if (c === '\n') { lines.push(line); line = []; continue; }
    if (line.length === 8) { lines.push(line); line = []; }
    line.push(c);
  }
  if (line.length || !lines.length) lines.push(line);
  const width = Math.max(1, ...lines.map(l => l.length * 6 - 1)), height = lines.length * 8 - 1;
  const pixels = new Uint8Array(width * height);
  lines.forEach((row, rowIndex) => {
    const offset = Math.floor((width - (row.length * 6 - 1)) / 2);
    row.forEach((letter, letterIndex) => {
      // '?' is an explicit replacement glyph for unsupported scripts, never a
      // generated approximation of a character we cannot faithfully render.
      const glyph = (FONT[letter] ?? FONT['?']).split('/');
      glyph.forEach((bits, y) => {
        for (let x = 0; x < 5; x++) if (bits[x] === '1') pixels[(rowIndex * 8 + y) * width + offset + letterIndex * 6 + x] = 1;
      });
    });
  });
  // A short word is larger. Five rows keep complete 5 × 7 letters at unit one
  // rather than deleting a row to force forty characters into a smaller height.
  const unit = Math.min(2, 50 / width, lines.length < 5 ? 36 / height : 1);
  const value = { width, height, pixels, unit };
  if (bitmapCache.size >= 64) bitmapCache.delete(bitmapCache.keys().next().value!);
  bitmapCache.set(text, value);
  return value;
}

function dimensions(word: string, s: number): { bitmap: Bitmap; unit: number; bounds: IntentionBox } {
  const b = bitmap(word), scale = Math.max(.01, Number.isFinite(s) && s > 0 ? s / 15 : 1 / 15);
  const unit = b.unit * scale;
  const w = Math.ceil(b.width * unit / 2 + 1.5), h = Math.ceil(b.height * unit / 2 + 1.5);
  return { bitmap: b, unit, bounds: { l: -w, t: -h, r: w, b: h } };
}

/** Local centred bounds, including the same contour and snapping margin as paint. */
export function glyphBounds(word: string, s: number): IntentionBox {
  return dimensions(word, s).bounds;
}

/** The complete bitmap word is made from the current spell material. */
export function paintIntentionGlyph(
  pix: Pix, word: string, x: number, y: number, s: number, ramp: RGB[],
  mat: SpellMaterial, seed: number, element?: string, reverse = false
): IntentionBox {
  const { bitmap: b, unit, bounds } = dimensions(word, s), ox = Math.round(x), oy = Math.round(y);
  const q = { l: ox + bounds.l, t: oy + bounds.t, r: ox + bounds.r, b: oy + bounds.b };
  const colors: RGB[] = ramp.length ? ramp : [[44, 52, 66], [131, 158, 178], [230, 244, 244]];
  // Return direction belongs to the scene's movement cues. Text remains readable.
  void reverse;
  let painted = false;
  pix.shape(q.l, q.t, q.r, q.b, (px, py) => {
    const lx = px - ox, ly = py - oy;
    const col = Math.floor(lx / unit + b.width / 2), row = Math.floor(ly / unit + b.height / 2);
    if (col < 0 || row < 0 || col >= b.width || row >= b.height || !b.pixels[row * b.width + col]) return null;
    painted = true;
    const light = .9 - (row % 8) / 7 * .34;
    return materialPixel(colors, mat, lx, ly, (lx / unit + b.width / 2) / b.width, (ly / unit + b.height / 2) / b.height, light, seed, element);
  }, darken(colors[0], .38));
  if (!painted) pix.set(ox, oy, colors[Math.floor(colors.length / 2)]);
  return q;
}
