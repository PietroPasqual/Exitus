import { RUNES } from '../data/runes';
import type { Model } from './circles';
import type { FlowResult } from './flow';

// Runas estruturais (Propriedade): Ser e Toque.
// - Ser: as runas anteriores a ele viram um conjunto. Separa objetos ou elementos para
//   que sejam, ou não, afetados por outra runa (ex.: sem Ser, todos os objetos orbitam juntos).
// - Toque: a magia, ou a parte anterior a ele, interage direto com a superfície mais próxima.
//   Mostra a utilidade com runas sem forma física, como a Vida (só sobrenatural).

/** Runas sem fator físico, só sobrenatural */
export const NON_PHYSICAL = new Set(['vida', 'morte']);

/** Objeto (formato) ou elemento */
const isObject = (id: string): boolean => {
  const c = RUNES[id]?.category;
  return c === 'elemental' || c === 'shape';
};

interface Step { node: string; rune: string }

/** Runas na ordem em que a energia passa (as de dentro de um Selo vêm junto com ele) */
function runeSequences(m: Model, flow: FlowResult): Step[][] {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const seqs: Step[][] = [];
  const seen = new Set<string>();
  flow.perPrism.forEach(p => p.routes.forEach(route => {
    const seq: Step[] = [];
    route.slice(0, -1).forEach(id => {
      const n = byId.get(id);
      if (!n) return; // anel
      [n.rune, ...(n.inner ?? [])].forEach(r => { if (r) seq.push({ node: id, rune: r }); });
    });
    const key = seq.map(s => s.node + ':' + s.rune).join('|');
    if (!seen.has(key)) { seen.add(key); seqs.push(seq); }
  }));
  return seqs;
}

/** Trechos separados pelo Ser (o Ser fecha o trecho em que está) */
function segments(seq: Step[]): { steps: Step[]; closedBy: string | null }[] {
  const out: { steps: Step[]; closedBy: string | null }[] = [];
  let cur: Step[] = [];
  seq.forEach(s => {
    if (s.rune === 'mod_ser') { out.push({ steps: cur, closedBy: s.node }); cur = []; }
    else cur.push(s);
  });
  out.push({ steps: cur, closedBy: null });
  return out;
}

const uniqList = (ids: string[]): string[] => [...new Set(ids)];

export interface SerGroup {
  /** Forma que tem o Ser que fecha este conjunto */
  ser: string;
  /** Runas do conjunto (as anteriores ao Ser) */
  runes: string[];
}

export interface OrbitUse {
  node: string;
  /** Objetos e elementos que orbitam juntos */
  objects: string[];
  /** Há um Ser separando conjuntos nessa rota */
  separated: boolean;
}

export interface SerCheck {
  groups: SerGroup[];
  orbits: OrbitUse[];
}

export function checkSer(m: Model, flow: FlowResult): SerCheck {
  const groups: SerGroup[] = [];
  const gKeys = new Set<string>();
  // Cada Órbita junta o que ela leva em todas as rotas; se alguma rota separa com Ser, vale a separação
  const orbitMap = new Map<string, { sep: Set<string>; all: Set<string>; separated: boolean }>();
  runeSequences(m, flow).forEach(seq => {
    const segs = segments(seq);
    const separated = segs.length > 1;
    segs.forEach(seg => {
      const runes = uniqList(seg.steps.map(s => s.rune));
      if (seg.closedBy) {
        const key = seg.closedBy + '|' + runes.join();
        if (!gKeys.has(key)) { gKeys.add(key); groups.push({ ser: seg.closedBy, runes }); }
      }
      seg.steps.filter(s => s.rune === 'mod_orbita').forEach(o => {
        const entry = orbitMap.get(o.node) ?? { sep: new Set<string>(), all: new Set<string>(), separated: false };
        runes.filter(isObject).forEach(r => (separated ? entry.sep : entry.all).add(r));
        entry.separated ||= separated;
        orbitMap.set(o.node, entry);
      });
    });
  });
  const orbits: OrbitUse[] = [...orbitMap].map(([node, e]) => ({ node, separated: e.separated, objects: [...(e.separated ? e.sep : e.all)] }));
  return { groups, orbits };
}

export interface ToqueUse {
  node: string;
  /** A parte anterior ao Toque (desde o último Ser ou o começo) */
  part: string[];
  /** O Toque é o último passo: vale para a magia inteira */
  whole: boolean;
  /** Runas sem forma física nessa parte (ex.: Vida) */
  nonPhysical: string[];
}

export function checkToque(m: Model, flow: FlowResult): ToqueUse[] {
  // Um Toque pode estar em várias rotas: junta o que vem antes dele em todas
  const byNode = new Map<string, { part: string[]; whole: boolean }>();
  runeSequences(m, flow).forEach(seq => {
    seq.forEach((s, i) => {
      if (s.rune !== 'mod_toque') return;
      let start = 0;
      for (let j = i - 1; j >= 0; j--) if (seq[j].rune === 'mod_ser') { start = j + 1; break; }
      const part = seq.slice(start, i).map(x => x.rune).filter(r => r !== 'mod_toque');
      const whole = start === 0 && part.length > 0 && seq.slice(i + 1).every(x => x.rune === 'mod_toque');
      const entry = byNode.get(s.node) ?? { part: [], whole: false };
      entry.part.push(...part);
      entry.whole ||= whole;
      byNode.set(s.node, entry);
    });
  });
  return [...byNode].map(([node, e]) => {
    const part = uniqList(e.part);
    return { node, part, whole: e.whole, nonPhysical: part.filter(r => NON_PHYSICAL.has(r)) };
  });
}
