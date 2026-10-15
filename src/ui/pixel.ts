// Motor de pixel art: uma tela pequena (cada pixel vira um quadradinho na tela),
// com pontilhado (dithering) para os degradês e contorno de 1 pixel nos objetos.

export type RGB = [number, number, number];

export const rgb = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as RGB;
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t) as RGB;
export const darken = (c: RGB, t: number): RGB => mixRGB(c, [0, 0, 0], t);
export const lighten = (c: RGB, t: number): RGB => mixRGB(c, [255, 255, 255], t);

// Matriz de Bayer 4×4: decide, pixel a pixel, entre duas cores vizinhas do degradê
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bayer = (x: number, y: number): number => BAYER[((y & 3) << 2) + (x & 3)];

// Ruído suave (para chamas, rocha, nuvens)
function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Ruído em camadas, de 0 a 1 */
export const fbm = (x: number, y: number, seed = 1): number =>
  vnoise(x, y, seed) * 0.57 + vnoise(x * 2.03, y * 2.03, seed + 7) * 0.29 + vnoise(x * 4.1, y * 4.1, seed + 13) * 0.14;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ponto dentro do polígono */
export function inPoly(pts: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export class Pix {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  private idx(x: number, y: number): number {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : (y * this.w + x) * 4;
  }
  set(x: number, y: number, c: RGB): void {
    const i = this.idx(x, y);
    if (i < 0) return;
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255;
  }
  /** Mistura a cor por cima (a de 0 a 1) */
  blend(x: number, y: number, c: RGB, a: number): void {
    const i = this.idx(x, y);
    if (i < 0 || a <= 0) return;
    if (this.data[i + 3] === 0) a = 1;
    for (let k = 0; k < 3; k++) this.data[i + k] = this.data[i + k] + (c[k] - this.data[i + k]) * Math.min(1, a);
    this.data[i + 3] = 255;
  }
  /** Luz: mistura em degraus de 25%, pontilhada (o brilho fica com cara de pixel) */
  glow(x: number, y: number, c: RGB, a: number): void {
    const q = Math.floor(clamp01(a) * 4 + bayer(Math.round(x), Math.round(y))) / 4;
    if (q > 0) this.blend(x, y, c, q);
  }
  /** Escolhe a cor do degradê (t de 0 a 1), pontilhando entre os tons */
  pick(x: number, y: number, t: number, ramp: RGB[]): RGB {
    const v = clamp01(t) * (ramp.length - 1);
    const i = Math.floor(v);
    return ramp[Math.min(ramp.length - 1, v - i > bayer(x, y) ? i + 1 : i)];
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  /**
   * Um objeto: para cada pixel da caixa, fn diz a cor (ou null = fora).
   * Com contorno, os pixels de fora encostados no objeto ganham a cor do contorno.
   */
  shape(l: number, t: number, r: number, b: number, fn: (x: number, y: number) => RGB | null, outline: RGB | null = null): void {
    l = Math.floor(l) - 1; t = Math.floor(t) - 1; r = Math.ceil(r) + 1; b = Math.ceil(b) + 1;
    const W = r - l + 1, H = b - t + 1;
    const cols: (RGB | null)[] = new Array(W * H).fill(null);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cols[y * W + x] = fn(l + x, t + y);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = cols[y * W + x];
      if (c) { this.set(l + x, t + y, c); continue; }
      if (!outline) continue;
      const near = (x > 0 && cols[y * W + x - 1]) || (x < W - 1 && cols[y * W + x + 1]) || (y > 0 && cols[(y - 1) * W + x]) || (y < H - 1 && cols[(y + 1) * W + x]);
      if (near) this.set(l + x, t + y, outline);
    }
  }
  /** Contorno de elipse (só a metade de trás, a da frente, ou toda) */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB, half: 'back' | 'front' | 'all' = 'all', dash = 0): void {
    const n = Math.ceil((rx + ry) * 4);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, s = Math.sin(a);
      if ((half === 'back' && s > 0) || (half === 'front' && s <= 0)) continue;
      if (dash && Math.floor(k / dash) % 2) continue;
      this.set(cx + Math.cos(a) * rx, cy + s * ry, c);
    }
  }
  /** Brilho redondo pontilhado */
  halo(cx: number, cy: number, rx: number, ry: number, c: RGB, strength = 0.5): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d < 1) this.glow(x, y, c, (1 - d) * (1 - d) * strength * 1.6);
    }
  }
  /** Brilho de 4 pontas (estrelinha) */
  sparkle(x: number, y: number, r: number, c: RGB, core: RGB = [255, 255, 255]): void {
    for (let k = 1; k <= r; k++) { this.set(x + k, y, c); this.set(x - k, y, c); this.set(x, y + k, c); this.set(x, y - k, c); }
    this.set(x, y, core);
  }
  /** Vira imagem PNG (só no navegador) */
  toDataURL(): string {
    const canvas = document.createElement('canvas');
    canvas.width = this.w; canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
