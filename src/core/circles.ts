import { polygonInset, ringPolygon } from './geometry';
import type { Circle, Connection, MagicNode, RingShape, ShapeId, Mage } from './types';

// =========================================================================
// CÍRCULOS SOBREPOSTOS: vários anéis; só um precisa de Matriz. Na área de
// sobreposição ficam duas Estrelas ☆ alinhadas, uma em cada camada (círculo):
// elas pegam a energia de um círculo e a transferem para o outro. Cabos só
// passam de um círculo para o outro através delas.
// =========================================================================

/** Partes do estado que as regras usam */
export interface Model {
  nodes: MagicNode[];
  connections: Connection[];
  circles: Circle[];
  envelope?: boolean;
  /** Quem faz a magia (energia infundida, refino, velocidade) */
  mage?: Partial<Mage>;
}

export const RING_R = 285;
/** Os nós precisam ficar dentro do anel externo */
export const RING_LIMIT = 280;
export const JOIN_SHAPES: ShapeId[] = ['star', 'redor'];
export const MAX_CIRCLES = 6;
/** Formatos do anel de fora (além do círculo) */
export const RING_SHAPES: RingShape[] = ['prism', 'square', 'triangle', 'hexagon', 'star'];
export const CIRCLE_OFFSETS: [number, number][] = [[430, 0], [215, 372], [-215, 372], [-430, 0], [215, -372], [-215, -372]];
/** A Matriz nunca some: só pode ser ◇ ou ◇+□ */
export const PRISM_SHAPES: ShapeId[] = ['prism', 'corp'];

export const isPrism = (n: MagicNode): boolean => !!n.lockedCenter;

/** Evoluir Forma: simples ↔ composta (○/△ → Círculo+Triângulo, ⬠/☆ → Pentágono+Estrela, ◇/□ → Matriz+Quadrado) */
const EVOLVE: Partial<Record<ShapeId, ShapeId>> = {
  prism: 'corp', square: 'corp', circle: 'salor', triangle: 'salor', hexagon: 'redor', star: 'redor',
  salor: 'circle', redor: 'hexagon'
};

/** Para qual forma a peça evolui (ou volta); o Matriz+Quadrado da Matriz volta a ser Matriz */
export function evolveTarget(node: MagicNode): ShapeId | undefined {
  if (node.shape === 'corp') return isPrism(node) ? 'prism' : 'square';
  return EVOLVE[node.shape];
}

export const getPrisms = (m: Model): MagicNode[] => m.nodes.filter(isPrism);

/** O centro do círculo tem forma de Matriz (◇ ou ◇+□) */
export const hasPrismShape = (n: MagicNode): boolean => PRISM_SHAPES.includes(n.shape);

/**
 * Fonte de cada círculo: a Matriz do centro; se o centro for outra forma, a fonte é o
 * pequena Matriz de uma magia dentro de um Círculo/Quadrado desse círculo.
 */
export function getSources(m: Model): MagicNode[] {
  const out: MagicNode[] = [];
  m.circles.forEach(c => {
    const own = ownSource(m, c.id);
    if (own) { out.push(own); return; }
    // Sem fonte própria, mas recebe energia pelo anel: o centro dele é por onde ela entra
    const center = centerOf(m, c.id);
    if (center && fedThroughRing(m, c.id)) out.push(center);
  });
  return out;
}

/** Fonte própria do círculo: Matriz no centro ou a Matriz de uma magia dentro de Selo */
export function ownSource(m: Model, circleId: string): MagicNode | undefined {
  const center = centerOf(m, circleId);
  if (center && hasPrismShape(center)) return center;
  return m.nodes.find(n => !isPrism(n) && n.inner?.length && getNodeCircles(m, n).includes(circleId));
}

/** O círculo tem uma magia dentro de Selo que pode servir de fonte */
export const circleHasInnerSource = (m: Model, circleId: string | undefined): boolean =>
  m.nodes.some(n => !isPrism(n) && !!n.inner?.length && getNodeCircles(m, n).includes(circleId as string));

// ---------- Anel como ponta de cabo ----------
// Um cabo pode sair do anel de um círculo ou chegar nele: o círculo inteiro manda ou
// recebe a energia, por fora. O que está dentro de cada círculo não mexe nos outros.

const RING_PREFIX = 'ring:';
export const ringId = (circleId: string): string => RING_PREFIX + circleId;
export const isRingId = (id: string): boolean => id.startsWith(RING_PREFIX);
export const ringCircleId = (id: string): string => id.slice(RING_PREFIX.length);

/** Ponta de cabo: uma forma, ou o anel de um círculo (como uma forma redonda do tamanho do anel) */
export function endpointNode(m: Model, id: string): MagicNode | undefined {
  if (!isRingId(id)) return m.nodes.find(n => n.id === id);
  const c = m.circles.find(x => x.id === ringCircleId(id));
  return c ? { id, shape: 'circle', x: c.x, y: c.y, size: radiusOf(c), rot: 0, rune: null, activation: 'ativacao', charge: 1 } : undefined;
}

/** Centro (âncora) de um círculo */
export const centerOf = (m: Model, circleId: string): MagicNode | undefined => m.nodes.find(n => n.lockedCenter && n.circleId === circleId);

/** O círculo recebe energia pelo anel, vinda de fora */
export const fedThroughRing = (m: Model, circleId: string): boolean => m.connections.some(c => c.to === ringId(circleId));

/** Raio do anel de um círculo */
export const radiusOf = (c: Circle): number => c.r ?? RING_R;

/** Distância do ponto até o anel de dentro para fora: positiva dentro do anel (que pode ter formato de selo) */
export function ringInset(c: Circle, x: number, y: number): number {
  if (!c.shape) return radiusOf(c) - Math.hypot(x - c.x, y - c.y);
  const pts = ringPolygon(c.shape, radiusOf(c));
  return polygonInset(pts, x - c.x, y - c.y);
}

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

/** Garante pelo menos um círculo e que toda Matriz saiba a qual círculo pertence */
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
  // Estrela de uma camada: pertence só ao círculo dela
  if (n.layer && m.circles.some(c => c.id === n.layer)) return [n.layer];
  if (isRingId(n.id)) {
    // O anel fica na borda: conta como do próprio círculo e do círculo em volta dele
    const c = getCircle(m, ringCircleId(n.id));
    if (!c) return [];
    const parents = m.circles.filter(o => contains(o, c));
    const direct = parents.filter(a => !parents.some(b => contains(a, b)));
    return [c.id, ...direct.map(o => o.id)];
  }
  const inside = insideCircles(m, n);
  // Fora de todos os anéis, mas dentro do círculo em volta de tudo
  if (!inside.length && m.envelope && m.circles.length > 1) {
    const e = getEnvelope(m.circles);
    if (Math.hypot(n.x - e.x, n.y - e.y) <= e.r - n.size) return ['envelope'];
  }
  // Num círculo dentro de outro, a forma pertence ao de dentro
  return inside.filter(a => !inside.some(b => contains(a, b))).map(c => c.id);
}

/** Anéis que contêm o selo pela geometria (sem olhar a camada) */
export const insideCircles = (m: Model, n: MagicNode): Circle[] => m.circles.filter(c => ringInset(c, n.x, n.y) >= n.size * 0.5);

/** Mantém o nó dentro de pelo menos um anel (o mais próximo, se saiu de todos) */
export function clampInsideRings(m: Model, n: MagicNode, x: number, y: number): { x: number; y: number } {
  // Com o círculo em volta de tudo, a forma pode ficar entre os círculos
  if (m.envelope && m.circles.length > 1) {
    const e = getEnvelope(m.circles);
    const max = e.r - 16 - n.size;
    const d = Math.hypot(x - e.x, y - e.y);
    return d <= max ? { x, y } : { x: e.x + ((x - e.x) / d) * max, y: e.y + ((y - e.y) / d) * max };
  }
  let best: { x: number; y: number; moved: number } | null = null;
  // Estrela de uma camada fica dentro do círculo dela
  const rings = n.layer && m.circles.some(c => c.id === n.layer) ? m.circles.filter(c => c.id === n.layer) : m.circles;
  const margin = (RING_R - RING_LIMIT) + n.size;
  for (const c of rings) {
    if (ringInset(c, x, y) >= margin) return { x, y };
    // Puxa em direção ao centro do anel até caber (busca binária no caminho)
    let lo = 0, hi = 1;
    for (let k = 0; k < 24; k++) {
      const t = (lo + hi) / 2;
      if (ringInset(c, c.x + (x - c.x) * t, c.y + (y - c.y) * t) >= margin) lo = t; else hi = t;
    }
    const px = c.x + (x - c.x) * lo, py = c.y + (y - c.y) * lo;
    const moved = Math.hypot(x - px, y - py);
    if (!best || moved < best.moved) best = { x: px, y: py, moved };
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
  /** As Estrelas da sobreposição: uma em cada camada (ou a Estrela dupla antiga) */
  stars: MagicNode[];
  /** As duas Estrelas estão uma em cima da outra */
  aligned: boolean;
  /** Unidos certinho: duas Estrelas sobrepostas e alinhadas, uma para cada círculo */
  complete: boolean;
}

/** Duas Estrelas estão alinhadas (uma em cima da outra) */
export const starsAligned = (a: MagicNode, b: MagicNode): boolean =>
  Math.hypot(a.x - b.x, a.y - b.y) <= Math.max(6, Math.min(a.size, b.size) * 0.35);

/** Pares de círculos sobrepostos (unidos ou não por uma Estrela) e cabos que pulam de um círculo para outro */
export function analyzeCircles(m: Model): { pairs: CirclePair[]; crossing: Connection[]; links: Connection[]; nestedLinks: Connection[] } {
  const pairs: CirclePair[] = [];
  for (let i = 0; i < m.circles.length; i++) {
    for (let j = i + 1; j < m.circles.length; j++) {
      const a = m.circles[i], b = m.circles[j];
      if (!overlaps(a, b)) continue;
      // Estrela de cada camada, na área de sobreposição dos dois anéis
      const inLens = (n: MagicNode): boolean => JOIN_SHAPES.includes(n.shape) && !isPrism(n) && ringInset(a, n.x, n.y) >= n.size * 0.5 && ringInset(b, n.x, n.y) >= n.size * 0.5;
      // A Estrela de uma camada conta para a sobreposição mesmo um pouco fora dela (aí fica "desalinhada")
      const nearLens = (n: MagicNode, other: Circle): boolean => JOIN_SHAPES.includes(n.shape) && !isPrism(n) && ringInset(other, n.x, n.y) >= -n.size * 1.5;
      const sa = m.nodes.find(n => n.layer === a.id && nearLens(n, b));
      const sb = m.nodes.find(n => n.layer === b.id && nearLens(n, a));
      // Estrela dupla antiga (as duas desenhadas juntas numa peça só) ou uma Estrela sem camada
      const legacy = m.nodes.find(n => !n.layer && inLens(n) && getNodeCircles(m, n).includes(a.id) && getNodeCircles(m, n).includes(b.id));
      if (sa || sb) {
        const stars = [sa, sb].filter((x): x is MagicNode => !!x);
        const aligned = !!(sa && sb && starsAligned(sa, sb) && inLens(sa) && inLens(sb));
        pairs.push({ a, b, star: sa ?? sb, stars, aligned, complete: aligned });
      } else {
        pairs.push({ a, b, star: legacy, stars: legacy ? [legacy] : [], aligned: !!legacy?.double, complete: !!legacy?.double });
      }
    }
  }
  // Cabos que saem de um círculo para outro: entre círculos sobrepostos só pela Estrela
  // (senão "cruza"); entre círculos separados é uma ligação de círculos (3º círculo)
  const crossing: Connection[] = [];
  const links: Connection[] = [];
  const nestedLinks: Connection[] = [];
  m.connections.forEach(c => {
    const f = endpointNode(m, c.from), t = endpointNode(m, c.to);
    if (!f || !t) return;
    const fc = getNodeCircles(m, f), tc = getNodeCircles(m, t);
    if (!fc.length || !tc.length) { crossing.push(c); return; }
    // Forma solta entre os círculos (dentro do círculo em volta de tudo): ligação de círculos
    if (fc.includes('envelope') || tc.includes('envelope')) { links.push(c); return; }
    if (fc.some(id => tc.includes(id))) return;
    const pairsOf = fc.flatMap(a => tc.map(b => [getCircle(m, a), getCircle(m, b)] as const))
      .filter((p): p is readonly [Circle, Circle] => !!p[0] && !!p[1]);
    if (pairsOf.some(([a, b]) => contains(a, b) || contains(b, a) || m.circles.some(o => contains(o, a) && contains(o, b)))) nestedLinks.push(c);
    else if (pairsOf.some(([a, b]) => overlaps(a, b))) crossing.push(c);
    else links.push(c);
  });
  return { pairs, crossing, links, nestedLinks };
}

/** □ Quadrado só pega: não pode ser origem de um cabo */
export const releasesEnergy = (m: Model, id: string): boolean =>
  m.nodes.find(n => n.id === id)?.shape !== 'square';

/** "Matriz", "Matriz 2", "#3"… */
export function getNodeShortLabel(m: Model, nodeId: string): string {
  if (isRingId(nodeId)) {
    const c = getCircle(m, ringCircleId(nodeId));
    return `Anel ${circleNumber(m, ringCircleId(nodeId))}${c?.name ? ` (${c.name})` : ''}`;
  }
  const idx = m.nodes.findIndex(n => n.id === nodeId);
  const node = m.nodes[idx];
  if (node && isPrism(node)) {
    const word = hasPrismShape(node) ? 'Matriz' : 'Centro';
    return m.circles.length > 1 ? `${word} ${circleNumber(m, node.circleId)}` : word;
  }
  return '#' + idx;
}

/** Fios invisíveis entre as duas Estrelas alinhadas: a energia passa de uma camada para a outra */
export function starBridges(m: Model): [string, string][] {
  const out: [string, string][] = [];
  analyzeCircles(m).pairs.forEach(p => {
    if (p.complete && p.stars.length === 2) out.push([p.stars[0].id, p.stars[1].id], [p.stars[1].id, p.stars[0].id]);
  });
  return out;
}

/** Estrelas que unem círculos (não guardam energia como Carregador) */
export function joiningStars(m: Model): Set<string> {
  const out = new Set<string>();
  analyzeCircles(m).pairs.forEach(p => { if (p.complete) p.stars.forEach(s => out.add(s.id)); });
  return out;
}

/**
 * Círculos que recebem a energia pela Estrela: não precisam de Matriz própria.
 * Começa nos que têm fonte (Matriz, magia dentro de selo ou energia pelo anel) e segue pelas sobreposições unidas.
 */
export function starFedCircles(m: Model): Set<string> {
  const fed = new Set(m.circles.filter(c => ownSource(m, c.id) || fedThroughRing(m, c.id)).map(c => c.id));
  const pairs = analyzeCircles(m).pairs.filter(p => p.complete);
  const out = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    pairs.forEach(p => {
      const [x, y] = fed.has(p.a.id) && !fed.has(p.b.id) ? [p.a, p.b] : fed.has(p.b.id) && !fed.has(p.a.id) ? [p.b, p.a] : [null, null];
      if (x && y) { fed.add(y.id); out.add(y.id); grew = true; }
    });
  }
  return out;
}

/**
 * Melhor ponto da área de sobreposição de dois anéis (qualquer formato): o mais longe das duas bordas.
 * Devolve também a folga (quanto cabe de raio ali); negativa = os anéis não se cruzam de verdade.
 */
export function lensPoint(a: Circle, b: Circle): { x: number; y: number; room: number } {
  const ra = radiusOf(a), rb = radiusOf(b);
  const x0 = Math.max(a.x - ra, b.x - rb), x1 = Math.min(a.x + ra, b.x + rb);
  const y0 = Math.max(a.y - ra, b.y - rb), y1 = Math.min(a.y + ra, b.y + rb);
  let best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, room: -Infinity };
  if (x1 <= x0 || y1 <= y0) return best;
  const scan = (cx0: number, cx1: number, cy0: number, cy1: number, n: number): void => {
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = cx0 + ((cx1 - cx0) * i) / n, y = cy0 + ((cy1 - cy0) * j) / n;
      const room = Math.min(ringInset(a, x, y), ringInset(b, x, y));
      if (room > best.room) best = { x, y, room };
    }
  };
  scan(x0, x1, y0, y1, 24);
  // Refina em volta do melhor ponto
  const dx = (x1 - x0) / 24, dy = (y1 - y0) / 24;
  scan(best.x - dx, best.x + dx, best.y - dy, best.y + dy, 12);
  return { x: Math.round(best.x * 10) / 10, y: Math.round(best.y * 10) / 10, room: best.room };
}
