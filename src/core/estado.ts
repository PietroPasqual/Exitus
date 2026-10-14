import { RUNES } from '../data/runes';
import type { Model } from './circles';
import type { FlowResult } from './flow';
import type { MagicNode } from './types';

// Estado: mantém o estado da(s) runa(s) anterior(es), ou usadas ao mesmo tempo, o mais perto
// de estável ou funcional (ex.: o Fogo não é apagado pelo vento nem pela umidade do ambiente). Recomendado: logo depois de um conjunto de
// objetos (runas de formato) ou de elementos (runas elementais).

/** Runas de objeto (formato) ou de elemento que o Estado pode manter */
const keepable = (id: string | null | undefined): boolean => {
  const c = id ? RUNES[id]?.category : undefined;
  return c === 'elemental' || c === 'shape';
};

const runesOf = (n: MagicNode): string[] => [n.rune, ...(n.inner ?? [])].filter((r): r is string => !!r);

export interface EstadoUse {
  id: string;
  /** Runas que o Estado mantém (as anteriores a ele) */
  kept: string[];
  /** Runas usadas ao mesmo tempo que ele (que saem da mesma forma, em paralelo) */
  together: string[];
  /** Vem logo depois de objetos ou elementos */
  wellPlaced: boolean;
}

export function checkEstados(m: Model, flow: FlowResult): EstadoUse[] {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const uses: EstadoUse[] = [];

  // Estado como forma na rota da energia
  m.nodes.filter(n => n.rune === 'mod_estado').forEach(n => {
    const kept = new Set<string>();
    let placed = false, seen = false;
    flow.perPrism.forEach(p => p.routes.forEach(route => {
      const i = route.indexOf(n.id);
      if (i <= 0) return;
      seen = true;
      route.slice(0, i).forEach(id => { const prev = byId.get(id); if (prev) runesOf(prev).filter(keepable).forEach(r => kept.add(r)); });
      const prev = byId.get(route[i - 1]);
      if (prev && runesOf(prev).some(keepable)) placed = true;
    }));
    // Estado que só recebe (ex.: num Col □) mantém o que chega até ele
    if (!seen) {
      m.connections.filter(c => c.to === n.id).forEach(c => {
        const prev = byId.get(c.from);
        if (!prev) return;
        runesOf(prev).filter(keepable).forEach(r => kept.add(r));
        if (runesOf(prev).some(keepable)) placed = true;
      });
    }
    if (n.inner?.length) runesOf(n).filter(keepable).forEach(r => kept.add(r));
    // Ao mesmo tempo: formas que recebem do mesmo ponto que o Estado, em paralelo
    const together = new Set<string>();
    const feeders = new Set(m.connections.filter(c => c.to === n.id).map(c => c.from));
    m.connections.filter(c => feeders.has(c.from) && c.to !== n.id).forEach(c => {
      const sib = byId.get(c.to);
      if (sib && !sib.lockedCenter) runesOf(sib).filter(keepable).forEach(r => together.add(r));
    });
    uses.push({ id: n.id, kept: [...kept], together: [...together].filter(r => !kept.has(r)), wellPlaced: placed || together.size > 0 || runesOf(n).some(keepable) });
  });

  // Estado dentro de uma magia de Selo: mantém as runas que estão junto com ele
  m.nodes.filter(n => n.rune !== 'mod_estado' && n.inner?.includes('mod_estado')).forEach(n => {
    const kept = runesOf(n).filter(keepable);
    uses.push({ id: n.id, kept, together: [], wellPlaced: kept.length > 0 });
  });
  return uses;
}
