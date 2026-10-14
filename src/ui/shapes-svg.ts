import { getShapeOutline, pointsAttr, regularPolygonPoints, starPoints, type Point } from '../core/geometry';
import type { MagicNode, ShapeId } from '../core/types';

/** Formas com pouco espaço no meio: a runa fica menor para não encostar nas linhas */
export const RUNE_FIT: Partial<Record<ShapeId, number>> = { redor: 0.72, star: 0.8, salor: 0.85, triangle: 0.85 };

/** Contorno SVG de cada forma estrutural (coordenadas locais) */
export function renderNodeShapeSVG(node: MagicNode, strokeWidth: number): string {
  const r = node.size;
  const sw = Math.max(3, strokeWidth * 0.62);
  if (node.shape === 'circle') {
    return `<circle class="node-outline" cx="0" cy="0" r="${r}" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="var(--fill-node)"/>`;
  }
  if (node.shape === 'prism') {
    const d = r * 1.08;
    return `<polygon class="node-outline" points="0,${-d} ${d},0 0,${d} ${-d},0" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="var(--fill-node)" stroke-linejoin="round"/>`;
  }
  if (node.shape === 'square') {
    const s = r * 0.92;
    return `<rect class="node-outline" x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="var(--fill-node)" stroke-linejoin="round"/>`;
  }
  if (node.shape === 'triangle') {
    const p1 = `0,${-r * 1.08}`;
    const p2 = `${r * 1.02},${r * 0.82}`;
    const p3 = `${-r * 1.02},${r * 0.82}`;
    return `<polygon class="node-outline" points="${p1} ${p2} ${p3}" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="var(--fill-node)" stroke-linejoin="round"/>`;
  }
  if (node.shape === 'star') {
    // Red ☆: estrela de 5 pontas (como no caderno)
    return `<polygon class="node-outline" points="${pointsAttr(getShapeOutline(node) ?? [])}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.9}" fill="var(--fill-node)" stroke-linejoin="round"/>`;
  }
  if (node.shape === 'hexagon') {
    // Rad ⬠: pentágono (como no caderno). A chave 'hexagon' é mantida para compatibilidade com JSONs salvos.
    return `<polygon class="node-outline" points="${pointsAttr(getShapeOutline(node) ?? [])}" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="var(--fill-node)" stroke-linejoin="round"/>`;
  }
  if (node.shape === 'corp') {
    // Losango + Quadrado sobrepostos (Restrição)
    const s = r * 0.86;
    const d = r * 1.12;
    return `
          <rect class="node-outline" x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.88}" fill="var(--fill-node)" stroke-linejoin="round"/>
          <polygon class="node-outline" points="0,${-d} ${d},0 0,${d} ${-d},0" stroke="var(--stroke-circle)" stroke-width="${sw * 0.88}" fill="none" stroke-linejoin="round"/>
        `;
  }
  if (node.shape === 'salor') {
    // Círculo + Triângulo inscrito (Sobrecarga)
    const p1 = `0,${-r * 0.98}`;
    const p2 = `${r * 0.85},${r * 0.5}`;
    const p3 = `${-r * 0.85},${r * 0.5}`;
    return `
          <circle class="node-outline" cx="0" cy="0" r="${r}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.9}" fill="var(--fill-node)"/>
          <polygon class="node-outline" points="${p1} ${p2} ${p3}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.82}" fill="none" stroke-linejoin="round"/>
        `;
  }
  if (node.shape === 'redor') {
    // Pentágono + Estrela inscrita (Absorvedor). Só o contorno da estrela, sem linhas
    // cruzando o centro, para a runa do meio ficar legível.
    return `
          <polygon class="node-outline" points="${pointsAttr(regularPolygonPoints(5, r))}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.88}" fill="var(--fill-node)" stroke-linejoin="round"/>
          <polygon class="node-outline" points="${pointsAttr(starPoints(r * 0.96, r * 0.52))}" stroke="var(--stroke-circle)" stroke-width="${sw * 0.62}" fill="none" stroke-linejoin="round"/>
        `;
  }
  return '';
}

const scalePts = (pts: Point[], k: number, cy = 0): Point[] => pts.map(([x, y]) => [x * k, cy + (y - cy) * k]);

function studDots(pts: Point[], rDot: number): string {
  return pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rDot.toFixed(1)}"/>`).join('');
}

/**
 * Enfeites dentro da forma: um contorno fino por dentro (como gravado à mão) e
 * pontinhos nos cantos. Ficam por baixo da runa e não mudam a forma da peça.
 */
export function renderNodeOrnaments(node: MagicNode, strokeWidth: number): string {
  const r = node.size;
  const echoW = Math.max(1, strokeWidth * 0.17).toFixed(2);
  const rDot = Math.max(1.6, r * 0.042);
  let echo = '';
  let corners: Point[] = [];

  if (node.shape === 'circle') {
    const e = r * 0.84;
    echo = `<circle cx="0" cy="0" r="${e.toFixed(1)}"/>`;
    corners = [[0, -e], [e, 0], [0, e], [-e, 0]];
  } else if (node.shape === 'prism') {
    const d = r * 1.08 * 0.78;
    corners = [[0, -d], [d, 0], [0, d], [-d, 0]];
    echo = `<polygon points="${pointsAttr(corners)}"/>`;
  } else if (node.shape === 'square') {
    const s = r * 0.92 * 0.8;
    corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
    echo = `<polygon points="${pointsAttr(corners)}"/>`;
  } else if (node.shape === 'hexagon') {
    corners = regularPolygonPoints(5, r * 0.8);
    echo = `<polygon points="${pointsAttr(corners)}"/>`;
  } else if (node.shape === 'star') {
    // Só um ponto em cada braço: a runa do meio precisa de espaço
    corners = starPoints(r * 1.12 * 0.68, r * 0.52).filter((_, i) => i % 2 === 0);
  } else if (node.shape === 'triangle') {
    const outline = getShapeOutline(node) ?? [];
    corners = scalePts(outline, 0.7, r * 0.19);
  } else {
    return '';
  }

  return `<g class="node-ornament" pointer-events="none">`
    + (echo ? `<g stroke="var(--stroke-circle)" stroke-width="${echoW}" fill="none" opacity="0.55" stroke-linejoin="round">${echo}</g>` : '')
    + `<g fill="var(--stroke-circle)" opacity="0.7">${studDots(corners, rDot)}</g>`
    + `</g>`;
}

const haloCache = new Map<string, string>();

/** Traço largo e translúcido da runa, por baixo dela: um brilho de tinta */
export function runeHalo(id: string, svg: string): string {
  let out = haloCache.get(id);
  if (!out) {
    out = svg.replace(/stroke-width="([\d.]+)"/g, (_, w: string) => `stroke-width="${(Number(w) + 4.2).toFixed(1)}"`);
    haloCache.set(id, out);
  }
  return out;
}
