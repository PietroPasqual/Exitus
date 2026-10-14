// Traço "à mão" para o pergaminho, mas caprichado: linhas quase retas com uma barriga
// mínima, cantos que se cruzam só um pouquinho, círculos que fecham quase no ponto
// e uma segunda passada de pena fina colada na primeira.
// Tudo usa números pseudoaleatórios com semente: o desenho não "treme" a cada redesenho.

export type Pt = [number, number];
export type Rand = () => number;

/** Gerador com semente (hash FNV-1a + mulberry32) */
export function seeded(key: string): Rand {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número entre -amp e +amp */
export const jitter = (rand: Rand, amp: number): number => (rand() * 2 - 1) * amp;

const f = (n: number): string => n.toFixed(1);
const pt = (p: Pt): string => `${f(p[0])},${f(p[1])}`;

/** Curva suave passando pelos pontos (Catmull-Rom convertida em Bézier) */
export function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

/** Linha à mão: uma barriga mínima e, se pedido, pontas que passam um pouquinho do ponto */
export function sketchLine(a: Pt, b: Pt, rand: Rand, overshoot = 0): string {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const o1 = overshoot * (0.3 + rand() * 0.7);
  const o2 = overshoot * (0.3 + rand() * 0.7);
  const s: Pt = [a[0] - ux * o1 + jitter(rand, 0.25), a[1] - uy * o1 + jitter(rand, 0.25)];
  const e: Pt = [b[0] + ux * o2 + jitter(rand, 0.25), b[1] + uy * o2 + jitter(rand, 0.25)];
  const bow = Math.min(len * 0.005 + 0.2, 1.3);
  const k1 = jitter(rand, bow), k2 = jitter(rand, bow);
  const m1: Pt = [a[0] + dx / 3 + nx * k1, a[1] + dy / 3 + ny * k1];
  const m2: Pt = [a[0] + (dx * 2) / 3 + nx * k2, a[1] + (dy * 2) / 3 + ny * k2];
  return `M${pt(s)}C${pt(m1)} ${pt(m2)} ${pt(e)}`;
}

/** Polígono à mão: cada lado é um traço, e os traços se cruzam um pouco nos cantos */
export function sketchPolygon(pts: Pt[], rand: Rand, overshoot: number): string {
  return pts.map((p, i) => sketchLine(p, pts[(i + 1) % pts.length], rand, overshoot)).join('');
}

/**
 * Círculo à mão: quase redondo, e a ponta final passa um pouquinho da inicial,
 * como num giro de pena. O desvio fica abaixo de 1px para o traço sair certinho.
 */
export function sketchCircle(cx: number, cy: number, r: number, rand: Rand): string {
  const n = Math.max(14, Math.round(r / 6));
  const start = rand() * Math.PI * 2;
  const overlap = 0.06 + rand() * 0.08;
  const steps = n + Math.ceil((n * overlap) / (Math.PI * 2));
  const drift = Math.min(r * 0.004 + 0.3, 0.9);
  const r0 = r + jitter(rand, drift);
  const r1 = r + jitter(rand, drift);
  const squash = Math.min(0.004, 1.2 / r);
  const sx = 1 + jitter(rand, squash);
  const sy = 1 + jitter(rand, squash);
  const amp = Math.min(r * 0.002 + 0.15, 0.45);
  const pts: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const ang = start + (Math.PI * 2 + overlap) * t;
    const rr = r0 + (r1 - r0) * t + jitter(rand, amp);
    pts.push([cx + Math.cos(ang) * rr * sx, cy + Math.sin(ang) * rr * sy]);
  }
  return smoothPath(pts);
}

/** Curva qualquer (amostrada em pontos) com um leve tremor no meio; as pontas ficam no lugar */
export function sketchThrough(pts: Pt[], rand: Rand, amp = 1): string {
  return smoothPath(pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [p[0] + jitter(rand, amp), p[1] + jitter(rand, amp)])));
}
