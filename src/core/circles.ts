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
  envelope?: boolean;
}

export const RING_R = 285;
/** Os nós precisam ficar dentro do anel externo */
export const RING_LIMIT = 280;
export const JOIN_SHAPES: ShapeId[] = ['star', 'redor'];
export const MAX_CIRCLES = 6;
export const CIRCLE_OFFSETS: [number, number][] = [[430, 0], [215, 372], [-215, 372], [-430, 0], [215, -372], [-215, -372]];
/** O Prisma nunca some: só pode ser ◇ ou ◇+□ */
export const PRISM_SHAPES: ShapeId[] = ['prism', 'corp'];

export const isPrism = (n: MagicNode): boolean => !!n.lockedCenter;

export const getPrisms = (m: Model): MagicNode[] => m.nodes.filter(isPrism);

/** O centro do círculo tem forma de Prisma (◇ ou ◇+□) */
export const hasPrismShape = (n: MagicNode): boolean => PRISM_SHAPES.includes(n.shape);

/**
 * Fonte de cada círculo: o Prisma do centro; se o centro for outra forma, a fonte é o
 * pequeno Prisma de uma magia dentro de um Selo/Col desse círculo.
 */
export function getSources(m: Model): MagicNode[] {
  const out: MagicNode[] = [];
  m.circles.forEach(c => {
    const center = m.nodes.find(n => isPrism(n) && n.circleId === c.id);
    if (center && hasPrismShape(center)) { out.push(center); return; }
    const inner = m.nodes.find(n => !isPrism(n) && n.inner?.length && getNodeCircles(m, n).includes(c.id));
    if (inner) out.push(inner);
  });
  return out;
}

/** O círculo tem uma magia dentro de Selo que pode servir de fonte */
export const circleHasInnerSource = (m: Model, circleId: string | undefined): boolean =>
  m.nodes.some(n => !isPrism(n) && !!n.inner?.length && getNodeCircles(m, n).includes(circleId as string));

/** Raio do anel de um círculo */
export const radiusOf = (c: Circle): number => c.r ?? RING_R;

/** O círculo b está inteiro dentro do círculo a (magia dentro da magia) */
export const contains = (a: Circle, b: Circle): boolean =>
  a.id !== b.id && Math.hypot(a.x - b.x, a.y - b.y) + radiusOf(b) <= radiusOf(a) + 1;

/** Dois círculos se sobrepõem em parte (um não está dentro do outro) */
export const overlaps = (a: Circle, b: Circle): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) < radiusOf(a) + radiusOf(b) && !contains(a, b) && !contains(b, a);

/** Algum círculo está dentro de outro */
export const hasNestedCircles = (m: Pick<Model, 'circles'>): boolean => m.circles.some(a => m.circles.some(b => contains(a, b)));

/** Círculo em volta de tudo: centro no meio dos círculos e raio que cobre todos */
export function getEnvelope(circles: Circle[]): { x: number; y: number; r: number } {
  const xs = circles.map(c => c.x), ys = circles.map(c => c.y);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = Math.max(...circles.map(c => Math.hypot(c.x - x, c.y - y) + radiusOf(c))) + 45;
  return { x, y, r };
}

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
  const inside = m.circles.filter(c => Math.hypot(n.x - c.x, n.y - c.y) <= radiusOf(c) - n.size * 0.5);
  // Num círculo dentro de outro, a forma pertence ao de dentro
  return inside.filter(a => !inside.some(b => contains(a, b))).map(c => c.id);
}

/** Mantém o nó dentro de pelo menos um anel (o mais próximo, se saiu de todos) */
export function clampInsideRings(m: Model, n: MagicNode, x: number, y: number): { x: number; y: number } {
  let best: { x: number; y: number; moved: number } | null = null;
  for (const c of m.circles) {
    const maxR = radiusOf(c) - (RING_R - RING_LIMIT) - n.size;
    const dx = x - c.x, dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= maxR) return { x, y };
    const moved = dist - maxR;
    if (!best || moved < best.moved) best = { x: c.x + (dx / dist) * maxR, y: c.y + (dy / dist) * maxR, moved };
  }
  return best ? { x: best.x, y: best.y } : { x, y };
}

/** Área do desenho que enquadra todos os círculos */
export function getViewBox(circles: Circle[], envelope = false): { x: number; y: number; w: number; h: number } {
  if (envelope && circles.length > 1) {
    const e = getEnvelope(circles);
    const half = e.r + 40;
    return { x: Math.floor(e.x - half), y: Math.floor(e.y - half), w: Math.ceil(half * 2), h: Math.ceil(half * 2) };
  }
  const pad = 65;
  const x = Math.floor(Math.min(...circles.map(c => c.x - radiusOf(c))) - pad);
  const y = Math.floor(Math.min(...circles.map(c => c.y - radiusOf(c))) - pad);
  return {
    x, y,
    w: Math.ceil(Math.max(...circles.map(c => c.x + radiusOf(c))) + pad - x),
    h: Math.ceil(Math.max(...circles.map(c => c.y + radiusOf(c))) + pad - y)
  };
}

export interface CirclePair {
  a: Circle;
  b: Circle;
  /** Estrela que une os dois (se houver) */
  star: MagicNode | undefined;
  /** Unidos certinho: duas Estrelas sobrepostas, uma para cada círculo */
  complete: boolean;
}

/** Pares de círculos sobrepostos (unidos ou não por uma Estrela) e cabos que pulam de um círculo para outro */
export function analyzeCircles(m: Model): { pairs: CirclePair[]; crossing: Connection[]; links: Connection[]; nestedLinks: Connection[] } {
  const pairs: CirclePair[] = [];
  for (let i = 0; i < m.circles.length; i++) {
    for (let j = i + 1; j < m.circles.length; j++) {
      const a = m.circles[i], b = m.circles[j];
      if (!overlaps(a, b)) continue;
      const star = m.nodes.find(n => JOIN_SHAPES.includes(n.shape) && !isPrism(n) &&
        getNodeCircles(m, n).includes(a.id) && getNodeCircles(m, n).includes(b.id));
      pairs.push({ a, b, star, complete: !!star?.double });
    }
  }
  // Cabos que saem de um círculo para outro: entre círculos sobrepostos só pela Estrela
  // (senão "cruza"); entre círculos separados é uma ligação de círculos (3º círculo)
  const crossing: Connection[] = [];
  const links: Connection[] = [];
  const nestedLinks: Connection[] = [];
  m.connections.forEach(c => {
    const f = m.nodes.find(n => n.id === c.from), t = m.nodes.find(n => n.id === c.to);
    if (!f || !t) return;
    const fc = getNodeCircles(m, f), tc = getNodeCircles(m, t);
    if (!fc.length || !tc.length) { crossing.push(c); return; }
    if (fc.some(id => tc.includes(id))) return;
    const pairsOf = fc.flatMap(a => tc.map(b => [getCircle(m, a), getCircle(m, b)] as const))
      .filter((p): p is readonly [Circle, Circle] => !!p[0] && !!p[1]);
    if (pairsOf.some(([a, b]) => contains(a, b) || contains(b, a) || m.circles.some(o => contains(o, a) && contains(o, b)))) nestedLinks.push(c);
    else if (pairsOf.some(([a, b]) => overlaps(a, b))) crossing.push(c);
    else links.push(c);
  });
  return { pairs, crossing, links, nestedLinks };
}

/** □ Col só pega: não pode ser origem de um cabo */
export const releasesEnergy = (m: Model, id: string): boolean =>
  m.nodes.find(n => n.id === id)?.shape !== 'square';

/** "Prisma", "Prisma 2", "#3"… */
export function getNodeShortLabel(m: Model, nodeId: string): string {
  const idx = m.nodes.findIndex(n => n.id === nodeId);
  const node = m.nodes[idx];
  if (node && isPrism(node)) {
    const word = hasPrismShape(node) ? 'Prisma' : 'Centro';
    return m.circles.length > 1 ? `${word} ${circleNumber(m, node.circleId)}` : word;
  }
  return '#' + idx;
}
