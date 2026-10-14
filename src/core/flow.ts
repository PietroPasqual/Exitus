import { getSources, releasesEnergy, type Model } from './circles';
import type { MagicNode, ShapeId } from './types';

// Regra fundamental: toda magia inicia no Prisma e finaliza nele.
// Cabos são direcionados (from = ○ de origem, to = destino).

export interface PrismFlow {
  prism: MagicNode;
  /** Tudo que recebe energia deste Prisma */
  fwd: Set<string>;
  starts: boolean;
  closes: boolean;
  /** Ciclos simples Prisma → … → Prisma (mais curtos primeiro) */
  routes: string[][];
}

export interface FlowResult {
  perPrism: PrismFlow[];
  /** Só funciona o que recebe energia de um Prisma com ciclo fechado */
  working: Set<string>;
  starts: boolean;
  closes: boolean;
  unreached: MagicNode[];
  retained: MagicNode[];
  stuck: MagicNode[];
}

/** Col/Corp: entrada e bloqueio (retêm a energia) */
const BLOCK_SHAPES: ShapeId[] = ['square', 'corp'];

export function analyzeFlow(m: Model): FlowResult {
  const out: Record<string, string[]> = {}, inc: Record<string, string[]> = {};
  m.nodes.forEach(n => { out[n.id] = []; inc[n.id] = []; });
  m.connections.forEach(c => {
    if (!out[c.from] || !inc[c.to]) return;
    if (!releasesEnergy(m, c.from)) return; // □ Col só pega: nada sai dele
    out[c.from].push(c.to);
    inc[c.to].push(c.from);
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

  // Rotas: ciclos simples que saem do Prisma e voltam a ele
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

  // A magia de cada círculo começa no seu Prisma e volta a ele
  const reached = new Set<string>();   // energia sai de algum Prisma e chega aqui
  const returns = new Set<string>();   // daqui a energia consegue voltar a algum Prisma
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
    stuck: others.filter(n => reached.has(n.id) && !returns.has(n.id) && !BLOCK_SHAPES.includes(n.shape))
  };
}
