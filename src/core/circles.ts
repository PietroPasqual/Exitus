import type { Circle, Connection, MagicNode, ShapeId } from './types';

// =========================================================================
// CÍRCULOS SOBREPOSTOS: vários anéis, cada um com seu Prisma. Uma Estrela ☆
// (Sobrepositor) na área de sobreposição junta os círculos; cabos só passam
// de um círculo para o outro através dela.
// =========================================================================

/** Partes do estado que as regras usam */
export interface Model {
  nodes: MagicNode[];
  connections: Connection[];
  circles: Circle[];
}

export const RING_R = 285;
/** Os nós precisam ficar dentro do anel externo */
export const RING_LIMIT = 280;
export const JOIN_SHAPES: ShapeId[] = ['star', 'redor'];
export const MAX_CIRCLES = 4;
export const CIRCLE_OFFSETS: [number, number][] = [[430, 0], [215, 372], [-215, 372], [-430, 0], [215, -372], [-215, -372]];
/** O Prisma nunca some: só pode ser ◇ ou ◇+□ */
export const PRISM_SHAPES: ShapeId[] = ['prism', 'corp'];

export const isPrism = (n: MagicNode): boolean => !!n.lockedCenter;

export const getPrisms = (m: Model): MagicNode[] => m.nodes.filter(isPrism);

export const getCircle = (m: Model, id: string | undefined): Circle | undefined => m.circles.find(c => c.id === id);

export const circleNumber = (m: Model, id: string | undefined): number => m.circles.findIndex(c => c.id === id) + 1;

export const isMainPrism = (m: Model, n: MagicNode): boolean => isPrism(n) && n.circleId === m.circles[0].id;

/** Garante pelo menos um círculo e que todo Prisma saiba a qual círculo pertence */
export function ensureCircles(m: { nodes: MagicNode[]; circles?: Circle[] }): Circle[] {
  if (!Array.isArray(m.circles) || m.circles.length === 0) {
    m.circles = [{ id: 'c1', x: 0, y: 0 }];
  }
  const first = m.circles[0].id;
  m.nodes.forEach(n => {
    if (n.lockedCenter && !n.circleId) n.circleId = first;
  });
  return m.circles;
}

/** Círculos cujo anel contém o nó (um nó na sobreposição pertence aos dois) */
export function getNodeCircles(m: Model, n: MagicNode): string[] {
  if (isPrism(n)) return [n.circleId as string];
  return m.circles.filter(c => Math.hypot(n.x - c.x, n.y - c.y) <= RING_R - n.size * 0.5).map(c => c.id);
}

/** Mantém o nó dentro de pelo menos um anel (o mais próximo, se saiu de todos) */
export function clampInsideRings(m: Model, n: MagicNode, x: number, y: number): { x: number; y: number } {
  let best: { x: number; y: number; moved: number } | null = null;
  for (const c of m.circles) {
    const maxR = RING_LIMIT - n.size;
    const dx = x - c.x, dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxR) return { x, y };
    const moved = dist - maxR;
    if (!best || moved < best.moved) best = { x: c.x + (dx / dist) * maxR, y: c.y + (dy / dist) * maxR, moved };
  }
  return best ? { x: best.x, y: best.y } : { x, y };
}

/** Área do desenho que enquadra todos os círculos */
export function getViewBox(circles: Circle[]): { x: number; y: number; w: number; h: number } {
  const xs = circles.map(c => c.x), ys = circles.map(c => c.y);
  const x = Math.floor(Math.min(...xs) - 350), y = Math.floor(Math.min(...ys) - 350);
  return { x, y, w: Math.ceil(Math.max(...xs) + 350 - x), h: Math.ceil(Math.max(...ys) + 350 - y) };
}

export interface CirclePair {
  a: Circle;
  b: Circle;
  /** Estrela que une os dois (se houver) */
  star: MagicNode | undefined;
}

/** Pares de círculos sobrepostos (unidos ou não por uma Estrela) e cabos que pulam de um círculo para outro */
export function analyzeCircles(m: Model): { pairs: CirclePair[]; crossing: Connection[] } {
  const pairs: CirclePair[] = [];
  for (let i = 0; i < m.circles.length; i++) {
    for (let j = i + 1; j < m.circles.length; j++) {
      const a = m.circles[i], b = m.circles[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) >= 2 * RING_R) continue;
      const star = m.nodes.find(n => JOIN_SHAPES.includes(n.shape) && !isPrism(n) &&
        getNodeCircles(m, n).includes(a.id) && getNodeCircles(m, n).includes(b.id));
      pairs.push({ a, b, star });
    }
  }
  const crossing = m.connections.filter(c => {
    const f = m.nodes.find(n => n.id === c.from), t = m.nodes.find(n => n.id === c.to);
    if (!f || !t) return false;
    const tc = getNodeCircles(m, t);
    return !getNodeCircles(m, f).some(id => tc.includes(id));
  });
  return { pairs, crossing };
}

/** □ Col só pega: não pode ser origem de um cabo */
export const releasesEnergy = (m: Model, id: string): boolean =>
  m.nodes.find(n => n.id === id)?.shape !== 'square';

/** "Prisma", "Prisma 2", "#3"… */
export function getNodeShortLabel(m: Model, nodeId: string): string {
  const idx = m.nodes.findIndex(n => n.id === nodeId);
  const node = m.nodes[idx];
  if (node && isPrism(node)) return m.circles.length > 1 ? `Prisma ${circleNumber(m, node.circleId)}` : 'Prisma';
  return '#' + idx;
}
