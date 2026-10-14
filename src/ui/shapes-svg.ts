import { getShapeOutline, pointsAttr, regularPolygonPoints, starPoints } from '../core/geometry';
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
