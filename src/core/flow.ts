import { centerOf, fedThroughRing, getSources, ownSource, releasesEnergy, ringId, starBridges, type Model } from './circles';
import type { MagicNode, ShapeId } from './types';

// Regra fundamental: toda magia inicia na Matriz e finaliza nela.
// Cabos são direcionados (from = ○ de origem, to = destino).

export interface PrismFlow {
  prism: MagicNode;
  /** Tudo que recebe energia desta Matriz */
  fwd: Set<string>;
  starts: boolean;
  closes: boolean;
  /** Ciclos simples Matriz → … → Matriz (mais curtos primeiro) */
  routes: string[][];
}

export interface FlowResult {
  perPrism: PrismFlow[];
  /** Só funciona o que recebe energia de uma Matriz com ciclo fechado */
  working: Set<string>;
  starts: boolean;
  closes: boolean;
  unreached: MagicNode[];
  retained: MagicNode[];
  stuck: MagicNode[];
  /** Fios por onde a energia passa (de → para), inclusive pelos anéis */
  edges: [string, string][];
}

/** Quadrado/Matriz+Quadrado: entrada e bloqueio (retêm a energia) */
const BLOCK_SHAPES: ShapeId[] = ['square', 'corp'];

export function analyzeFlow(m: Model): FlowResult {
  const out: Record<string, string[]> = {}, inc: Record<string, string[]> = {};
  m.nodes.forEach(n => { out[n.id] = []; inc[n.id] = []; });
  m.circles.forEach(c => { out[ringId(c.id)] = []; inc[ringId(c.id)] = []; });
  const edges: [string, string][] = [];
  const edge = (from: string, to: string): void => {
    if (!out[from] || !inc[to]) return;
    edges.push([from, to]);
    out[from].push(to);
    inc[to].push(from);
  };
  m.connections.forEach(c => {
    if (!releasesEnergy(m, c.from)) return; // □ Quadrado só pega: nada sai dele
    edge(c.from, c.to);
  });
  // As duas Estrelas alinhadas da sobreposição (uma em cada camada) passam a energia entre si
  starBridges(m).forEach(([a, b]) => edge(a, b));
  // Cada círculo funciona sozinho: pelo anel ele manda a energia da sua fonte para fora,
  // e um círculo sem fonte própria recebe pelo anel e leva ao seu centro
  m.circles.forEach(c => {
    const ring = ringId(c.id);
    const own = ownSource(m, c.id);
    if (own && m.connections.some(x => x.from === ring)) edge(own.id, ring);
    // Energia que chega pelo anel entra na fonte do círculo (ou no centro, se ele não tem fonte)
    const entry = own ?? centerOf(m, c.id);
    if (entry && fedThroughRing(m, c.id)) edge(ring, entry.id);
  });

  const walk = (start: string, adj: Record<string, string[]>): Set<string> => {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      adj[stack.pop() as string].forEach(next => {
        if (!seen.has(next)) { seen.add(next); stack.push(next); }
      });
    }
    return seen;
  };

  // Rotas: ciclos simples que saem da Matriz e voltam a ela
  const routesOf = (prismId: string): string[][] => {
    const found: string[][] = [];
    const dfs = (id: string, path: string[]): void => {
      if (found.length >= 40) return;
      for (const next of out[id]) {
        if (next === prismId) found.push([...path, next]);
        else if (!path.includes(next)) dfs(next, [...path, next]);
      }
    };
    dfs(prismId, [prismId]);
    return found.sort((a, b) => a.length - b.length);
  };

  // A magia de cada círculo começa na sua Matriz e volta a ela
  const reached = new Set<string>();   // energia sai de alguma Matriz e chega aqui
  const returns = new Set<string>();   // daqui a energia consegue voltar a alguma Matriz
  const sources = getSources(m);
  const sourceIds = new Set(sources.map(s => s.id));
  const perPrism: PrismFlow[] = sources.map(p => {
    const fwd = walk(p.id, out);
    const back = walk(p.id, inc);
    fwd.forEach(id => reached.add(id));
    back.forEach(id => returns.add(id));
    return { prism: p, fwd, starts: out[p.id].length > 0, closes: out[p.id].some(id => back.has(id)), routes: routesOf(p.id) };
  });

  const working = new Set<string>();
  perPrism.filter(x => x.starts && x.closes).forEach(x => x.fwd.forEach(id => working.add(id)));
  const others = m.nodes.filter(n => !sourceIds.has(n.id));

  return {
    perPrism,
    working,
    starts: perPrism.every(x => x.starts),
    closes: perPrism.every(x => x.closes),
    unreached: others.filter(n => !reached.has(n.id)),
    retained: others.filter(n => reached.has(n.id) && !returns.has(n.id) && BLOCK_SHAPES.includes(n.shape)),
    stuck: others.filter(n => reached.has(n.id) && !returns.has(n.id) && !BLOCK_SHAPES.includes(n.shape)),
    edges
  };
}
