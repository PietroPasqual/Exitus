import { RUNES } from '../data/runes';
import type { Model } from './circles';
import type { FlowResult } from './flow';
import { runeSequences, type Seq } from './structural';
import type { MagicNode } from './types';

// Estado: mantém o estado da(s) runa(s) anterior(es), ou usadas ao mesmo tempo, o mais perto
// de estável ou funcional (ex.: o Fogo não é apagado pelo vento nem pela umidade do ambiente).
// Recomendado: logo depois de um conjunto de objetos (runas de formato) ou de elementos.

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
  /** Runas usadas ao mesmo tempo que ele (em paralelo) */
  together: string[];
  /** Vem logo depois de objetos ou elementos */
  wellPlaced: boolean;
}

/**
 * O Estado na posição i vem logo depois de objetos ou elementos?
 * Formas sem runa (ex.: o Sal △) não contam; um Ser logo antes vale pelo conjunto que fechou.
 */
function placedAt(seq: Seq, i: number): boolean {
  const prev = seq[i - 1];
  if (!prev) return false;
  if (prev.rune !== 'mod_ser') return keepable(prev.rune);
  for (let j = i - 2; j >= 0 && seq[j].rune !== 'mod_ser'; j--) if (keepable(seq[j].rune)) return true;
  return false;
}

export function checkEstados(m: Model, flow: FlowResult): EstadoUse[] {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const seqs = runeSequences(m, flow);
  const uses: EstadoUse[] = [];

  m.nodes.filter(n => n.rune === 'mod_estado').forEach(n => {
    const kept = new Set<string>();
    let placed = false;
    // Onde o Estado aparece na ordem das runas; um Estado que só recebe (ex.: num Col □)
    // fica logo depois de cada forma que manda energia para ele
    const spots: { seq: Seq; i: number }[] = [];
    seqs.forEach(seq => {
      const i = seq.findIndex(s => s.node === n.id && s.rune === 'mod_estado');
      // Estado no próprio Prisma: a energia sai e volta a ele, então mantém tudo o que passou na volta
      if (i === 0 && seq.prism === n.id) spots.push({ seq, i: seq.length });
      else if (i >= 0) spots.push({ seq, i });
    });
    if (!spots.length) {
      // Estado que só recebe (ex.: num Col □): fica logo depois de cada forma que manda
      // energia para ele, com tudo o que veio antes dela na rota
      const feeders = new Set(m.connections.filter(c => c.to === n.id).map(c => c.from));
      flow.perPrism.forEach(p => p.routes.forEach(route => {
        const k = route.findIndex(id => feeders.has(id));
        if (k < 0) return;
        const seq: Seq = [];
        route.slice(0, k + 1).forEach(id => {
          const f = byId.get(id);
          if (f) runesOf(f).forEach(r => seq.push({ node: id, rune: r }));
        });
        spots.push({ seq, i: seq.length });
      }));
    }
    spots.forEach(({ seq, i }) => {
      seq.slice(0, i).forEach(s => { if (keepable(s.rune) && s.node !== n.id) kept.add(s.rune); });
      if (placedAt(seq, i)) placed = true;
    });
    if (n.inner?.length) runesOf(n).filter(keepable).forEach(r => kept.add(r));

    // Ao mesmo tempo: formas que recebem do mesmo ponto que o Estado, em paralelo,
    // e as rotas do mesmo Prisma que correm ao lado da dele
    const together = new Set<string>();
    const feeders = new Set(m.connections.filter(c => c.to === n.id).map(c => c.from));
    m.connections.filter(c => feeders.has(c.from) && c.to !== n.id).forEach(c => {
      const sib = byId.get(c.to);
      if (sib && !sib.lockedCenter) runesOf(sib).filter(keepable).forEach(r => together.add(r));
    });
    flow.perPrism.forEach(p => {
      const mine = p.routes.filter(r => r.includes(n.id));
      if (!mine.length) return;
      const own = new Set(mine.flat());
      p.routes.filter(r => !r.includes(n.id)).flat().filter(id => !own.has(id)).forEach(id => {
        const other = byId.get(id);
        if (other && !other.lockedCenter) runesOf(other).filter(keepable).forEach(r => together.add(r));
      });
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
