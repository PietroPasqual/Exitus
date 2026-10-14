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

/** Dois círculos se sobrepõem */
export const overlaps = (a: Circle, b: Circle): boolean => Math.hypot(a.x - b.x, a.y - b.y) < 2 * RING_R;

/** Círculo em volta de tudo: centro no meio dos círculos e raio que cobre todos */
export function getEnvelope(circles: Circle[]): { x: number; y: number; r: number } {
  const xs = circles.map(c => c.x), ys = circles.map(c => c.y);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const r = Math.max(...circles.map(c => Math.hypot(c.x - x, c.y - y))) + RING_R + 45;
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
export function getViewBox(circles: Circle[], envelope = false): { x: number; y: number; w: number; h: number } {
  if (envelope && circles.length > 1) {
    const e = getEnvelope(circles);
    const half = e.r + 40;
    return { x: Math.floor(e.x - half), y: Math.floor(e.y - half), w: Math.ceil(half * 2), h: Math.ceil(half * 2) };
  }
  const xs = circles.map(c => c.x), ys = circles.map(c => c.y);
  const x = Math.floor(Math.min(...xs) - 350), y = Math.floor(Math.min(...ys) - 350);
  return { x, y, w: Math.ceil(Math.max(...xs) + 350 - x), h: Math.ceil(Math.max(...ys) + 350 - y) };
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
export function analyzeCircles(m: Model): { pairs: CirclePair[]; crossing: Connection[]; links: Connection[] } {
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
  m.connections.forEach(c => {
    const f = m.nodes.find(n => n.id === c.from), t = m.nodes.find(n => n.id === c.to);
    if (!f || !t) return;
    const fc = getNodeCircles(m, f), tc = getNodeCircles(m, t);
    if (fc.some(id => tc.includes(id))) return;
    const touching = fc.some(a => tc.some(b => {
      const ca = getCircle(m, a), cb = getCircle(m, b);
      return !!ca && !!cb && overlaps(ca, cb);
    }));
    (touching || !fc.length || !tc.length ? crossing : links).push(c);
  });
  return { pairs, crossing, links };
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
