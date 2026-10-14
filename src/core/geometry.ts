import type { MagicNode } from './types';

export type Point = [number, number];

export function regularPolygonPoints(n: number, r: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI / n) * i - Math.PI / 2;
    pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  return pts;
}

export function starPoints(rOut: number, rIn: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? rOut : rIn;
    pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr]);
  }
  return pts;
}

export const pointsAttr = (pts: Point[]): string =>
  pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Contorno da forma (coordenadas locais, sem rotação), usado para pôr o ○ exatamente na borda */
export function getShapeOutline(node: MagicNode): Point[] | null {
  const r = node.size;
  if (node.shape === 'triangle') return [[0, -r * 1.08], [r * 1.02, r * 0.82], [-r * 1.02, r * 0.82]];
  if (node.shape === 'hexagon' || node.shape === 'redor') return regularPolygonPoints(5, r);
  if (node.shape === 'star') return starPoints(r * 1.12, r * 0.52);
  return null;
}

/** Distância do centro até a borda do polígono, na direção do ângulo */
export function rayPolygonDistance(pts: Point[], angle: number): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (x1 * ey - y1 * ex) / den;      // distância ao longo do raio
    const u = (x1 * dy - y1 * dx) / den;      // posição ao longo da aresta
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return best;
}

/** Ponto na borda da forma na direção de (targetX, targetY) — onde o cabo encosta */
export function getShapeBoundaryPoint(node: MagicNode, targetX: number, targetY: number): { x: number; y: number } {
  const dx = targetX - node.x;
  const dy = targetY - node.y;
  const angle = Math.atan2(dy, dx);
  const r = node.size;

  if (node.shape === 'circle') {
    return { x: node.x + Math.cos(angle) * r, y: node.y + Math.sin(angle) * r };
  }

  if (node.shape === 'prism') {
    // Losango: |x|/r + |y|/r = 1
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const denom = Math.abs(cos) + Math.abs(sin) || 1;
    const dist = (r * 1.08) / denom;
    return { x: node.x + cos * dist, y: node.y + sin * dist };
  }

  if (node.shape === 'square') {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const maxComp = Math.max(Math.abs(cos), Math.abs(sin)) || 1;
    const dist = (r * 0.92) / maxComp;
    return { x: node.x + cos * dist, y: node.y + sin * dist };
  }

  const outline = getShapeOutline(node);
  if (outline) {
    const rot = ((node.rot || 0) * Math.PI) / 180;
    const dist = rayPolygonDistance(outline, angle - rot);
    if (isFinite(dist)) {
      return { x: node.x + Math.cos(angle) * dist, y: node.y + Math.sin(angle) * dist };
    }
  }

  // Aproximação pelo raio
  return { x: node.x + Math.cos(angle) * (r * 0.95), y: node.y + Math.sin(angle) * (r * 0.95) };
}

/**
 * Ímã polar: perto de um ângulo múltiplo de 15° (ou da mesma distância do centro que outra
 * forma), a posição "gruda" nele. Fora do raio de atração, fica onde o dedo/mouse está.
 */
export function snapPolar(
  pos: { x: number; y: number },
  center: { x: number; y: number },
  siblingRadii: number[],
  opts = { angleStepDeg: 15, radiusStep: 20, threshold: 12 }
): { x: number; y: number } {
  const dx = pos.x - center.x, dy = pos.y - center.y;
  const dist = Math.hypot(dx, dy);
  if (dist < opts.threshold) return { x: center.x, y: center.y };
  let angle = Math.atan2(dy, dx);
  const step = (opts.angleStepDeg * Math.PI) / 180;
  const snapped = Math.round(angle / step) * step;
  if (Math.abs(angle - snapped) * dist < opts.threshold) angle = snapped;
  let radius = dist;
  const same = siblingRadii.find(r => Math.abs(r - dist) < opts.threshold);
  if (same !== undefined) radius = same;
  else {
    const ring = Math.round(dist / opts.radiusStep) * opts.radiusStep;
    if (Math.abs(ring - dist) < opts.threshold / 2) radius = ring;
  }
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}

/**
 * Centro da "lente" onde dois círculos se sobrepõem (onde vai a Estrela dupla).
 * Vale também para círculos de tamanhos diferentes.
 */
export function lensCenter(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): { x: number; y: number } {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  // ponto do eixo entre os centros no meio da faixa que os dois anéis cobrem
  const t = ((d - b.r) + a.r) / 2;
  return { x: a.x + ((b.x - a.x) / d) * t, y: a.y + ((b.y - a.y) / d) * t };
}
