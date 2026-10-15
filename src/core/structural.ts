import { RUNES } from '../data/runes';
import { getNodeCircles, getNodeShortLabel, ringId, type Model } from './circles';
import type { FlowResult } from './flow';

// Runas estruturais (Propriedade), na ordem em que a energia passa:
// - Ser: as runas anteriores a ele viram um conjunto (um "ser"). Separa objetos ou elementos
//   para que sejam, ou não, afetados por outra runa.
// - Toque: a magia, ou a parte anterior a ele, interage direto com a superfície mais próxima.
//   Mostra a utilidade com runas de conceito (sem forma física), como a Vida.
// - Área: o mesmo, mas com a superfície mais distante (quase como se reprojetada).
//   Com runas de Espaço, cria âncoras de ativação.
// - Ligação: cola objetos ou elementos entre si, sem misturar. Recomendada com o Projétil;
//   objetos de elementos da mesma família (que se derivam) se mesclam.
// - Órbita: uma linha invisível paralela ao círculo; tudo ligado a ela orbita a magia,
//   com os seres divididos igualmente pela circunferência.
// - Intenção: põe a intenção de quem usa na runa anterior (ou no círculo anterior), com uma
//   palavra ou números de vínculo que não se desvinculam.

/**
 * Runas de conceito: sem forma física. Mesmo assim, os efeitos sobrenaturais delas
 * podem ser observados e dá para interagir com eles.
 */
export const CONCEPT_RUNES = new Set(['tempo', 'movimento', 'pressao', 'caos', 'infinito', 'vazio', 'vida', 'morte']);

/**
 * Famílias de elementos (o elemento de origem e os que se derivam dele).
 * A Ligação mescla objetos feitos de elementos da mesma família.
 */
export const ELEMENT_FAMILIES: Record<string, string[]> = {
  materia: ['materia', 'fogo', 'raio', 'ilusao', 'vida', 'luz', 'natureza', 'acido'],
  gravidade: ['gravidade', 'terra', 'metal', 'pressao'],
  tempo: ['tempo', 'agua', 'gelo', 'movimento', 'morte', 'infinito'],
  espaco: ['espaco', 'vento', 'som', 'caos', 'sombra', 'vazio']
};

/** Família de um elemento (ou ele mesmo, se não deriva de nenhum) */
export const familyOf = (element: string): string =>
  Object.keys(ELEMENT_FAMILIES).find(f => ELEMENT_FAMILIES[f].includes(element)) ?? element;

/** Objeto (formato) ou elemento */
const isObject = (id: string): boolean => {
  const c = RUNES[id]?.category;
  return c === 'elemental' || c === 'shape';
};

export interface Step { node: string; rune: string }
export type Seq = Step[] & { prism?: string };

/** Runas na ordem em que a energia passa (as de dentro de um Selo vêm junto com ele) */
export function runeSequences(m: Model, flow: FlowResult): Seq[] {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const seqs: Seq[] = [];
  const seen = new Set<string>();
  flow.perPrism.forEach(p => p.routes.forEach(route => {
    const seq: Seq = [];
    seq.prism = p.prism.id;
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

/** Rotas do mesmo Prisma que não passam por esta forma: correm ao mesmo tempo, em paralelo */
function parallelSteps(seqs: Seq[], seq: Seq, nodeId: string): Step[] {
  const own = new Set(seq.map(s => s.node));
  return seqs.filter(o => o !== seq && o.prism === seq.prism && !o.some(s => s.node === nodeId))
    .flatMap(o => o.filter(s => !own.has(s.node)));
}

/** Trechos separados pelo Ser (o Ser fecha o trecho em que está) */
export function segments(seq: Step[]): { steps: Step[]; closedBy: string | null }[] {
  const out: { steps: Step[]; closedBy: string | null }[] = [];
  let cur: Step[] = [];
  seq.forEach(s => {
    if (s.rune === 'mod_ser') { out.push({ steps: cur, closedBy: s.node }); cur = []; }
    else cur.push(s);
  });
  out.push({ steps: cur, closedBy: null });
  return out;
}

/**
 * Onde começa a "parte anterior" ao passo i: logo depois do último Ser (ou o começo).
 * Se o passo vem logo depois de um Ser, a parte anterior é o conjunto que esse Ser fechou.
 */
function partStart(seq: Step[], i: number): number {
  let from = i - 1;
  if (from >= 0 && seq[from].rune === 'mod_ser') from--; // logo depois de um Ser: o conjunto dele
  for (let j = from; j >= 0; j--) if (seq[j].rune === 'mod_ser') return j + 1;
  return 0;
}

const uniqList = (ids: string[]): string[] => [...new Set(ids)];

// ---------------- Ser e Órbita ----------------

export interface SerGroup {
  /** Forma que tem o Ser que fecha este conjunto */
  ser: string;
  /** Runas do conjunto (as anteriores ao Ser) */
  runes: string[];
}

export interface OrbitUse {
  node: string;
  /** Cada ser na órbita (um conjunto de objetos/elementos) */
  beings: string[][];
  /** Há um Ser separando os seres */
  separated: boolean;
  /** Distância entre os seres, em graus da circunferência */
  spacing: number;
  /** Dois ou mais objetos (formatos) diferentes num ser só: orbitam grudados */
  crowded: boolean;
}

export interface SerCheck {
  groups: SerGroup[];
  orbits: OrbitUse[];
}

export function checkSer(m: Model, flow: FlowResult): SerCheck {
  const groups: SerGroup[] = [];
  const gKeys = new Set<string>();
  const orbitMap = new Map<string, { beings: Map<string, string[]>; shapes: Map<string, number>; separated: boolean }>();
  runeSequences(m, flow).forEach(seq => {
    const segs = segments(seq);
    const separated = segs.length > 1;
    segs.forEach(seg => {
      if (!seg.closedBy) return;
      const runes = uniqList(seg.steps.map(s => s.rune));
      const key = seg.closedBy + '|' + runes.join();
      if (!gKeys.has(key)) { gKeys.add(key); groups.push({ ser: seg.closedBy, runes }); }
    });
    // Toda runa ligada à linha da Órbita orbita: cada conjunto fechado pelo Ser é um ser
    seq.filter(s => s.rune === 'mod_orbita').forEach(o => {
      const entry = orbitMap.get(o.node) ?? { beings: new Map<string, string[]>(), shapes: new Map<string, number>(), separated: false };
      entry.separated ||= separated;
      segs.forEach(seg => {
        const objects = uniqList(seg.steps.map(s => s.rune).filter(isObject));
        const key = seg.steps.map(s => s.node + s.rune).join();
        if (objects.length) {
          entry.beings.set(key, objects);
          entry.shapes.set(key, new Set(seg.steps.filter(s => RUNES[s.rune]?.category === 'shape').map(s => s.node)).size);
        }
      });
      orbitMap.set(o.node, entry);
    });
  });
  const orbits: OrbitUse[] = [...orbitMap].map(([node, e]) => {
    const beings = [...e.beings.values()];
    const crowded = beings.length === 1 && Math.max(0, ...e.shapes.values()) > 1;
    return { node, beings, separated: e.separated, spacing: beings.length ? 360 / beings.length : 0, crowded };
  });
  return { groups, orbits };
}

// ---------------- Toque e Área ----------------

export interface SurfaceUse {
  node: string;
  /** A parte anterior (desde o último Ser ou o começo) */
  part: string[];
  /** É o último passo: vale para a magia inteira */
  whole: boolean;
  /** Toque: runas de conceito (sem forma física) nessa parte (ex.: Vida) */
  nonPhysical: string[];
  /** Área: há runa de Espaço junto (âncoras de ativação) */
  withSpace: boolean;
}

/** Toque (superfície mais próxima) e Área (superfície mais distante) */
function checkSurface(m: Model, flow: FlowResult, runeId: string): SurfaceUse[] {
  // Uma runa pode estar em várias rotas: junta o que vem antes dela em todas
  const byNode = new Map<string, { part: string[]; whole: boolean; space: boolean }>();
  runeSequences(m, flow).forEach(seq => {
    seq.forEach((s, i) => {
      if (s.rune !== runeId) return;
      const start = partStart(seq, i);
      const part = seq.slice(start, i).map(x => x.rune).filter(r => r !== runeId && r !== 'mod_ser');
      const whole = start === 0 && part.length > 0 && !seq.slice(0, i).some(x => x.rune === 'mod_ser') && seq.slice(i + 1).every(x => x.rune === runeId);
      const entry = byNode.get(s.node) ?? { part: [], whole: false, space: false };
      entry.part.push(...part);
      entry.whole ||= whole;
      entry.space ||= seq.some(x => x.rune === 'espaco');
      byNode.set(s.node, entry);
    });
  });
  return [...byNode].map(([node, e]) => {
    const part = uniqList(e.part);
    return { node, part, whole: e.whole, nonPhysical: part.filter(r => CONCEPT_RUNES.has(r)), withSpace: e.space };
  });
}

export const checkToque = (m: Model, flow: FlowResult): SurfaceUse[] => checkSurface(m, flow, 'mod_toque');
export const checkArea = (m: Model, flow: FlowResult): SurfaceUse[] => checkSurface(m, flow, 'mod_area');

// ---------------- Ligação ----------------

export interface LinkUse {
  node: string;
  /** Objetos e elementos colados (sem misturar) */
  bound: string[];
  /** Desses, os que vêm de uma rota em paralelo (ao mesmo tempo) */
  together: string[];
  /** Elementos da mesma família (ou o mesmo elemento) em objetos diferentes: esses se mesclam */
  merged: { family: string; elements: string[] }[];
  /** Usada junto com o Projétil (recomendado) */
  withProjectile: boolean;
}

export function checkLigacao(m: Model, flow: FlowResult): LinkUse[] {
  const byNode = new Map<string, { bound: string[]; together: string[]; merged: Map<string, Set<string>>; proj: boolean }>();
  const seqs = runeSequences(m, flow);
  seqs.forEach(seq => {
    seq.forEach((s, i) => {
      if (s.rune !== 'mod_ligacao') return;
      const before = seq.slice(partStart(seq, i), i).filter(x => x.rune !== 'mod_ser');
      // Ao mesmo tempo: o que corre em paralelo, saindo do mesmo Prisma (ex.: a lança)
      const parallel = parallelSteps(seqs, seq, s.node);
      const part = [...before, ...parallel].filter(x => isObject(x.rune));
      const entry = byNode.get(s.node) ?? { bound: [], together: [], merged: new Map<string, Set<string>>(), proj: false };
      entry.bound.push(...part.map(x => x.rune));
      entry.together.push(...parallel.filter(x => isObject(x.rune)).map(x => x.rune));
      // Objetos feitos do mesmo elemento, ou de elementos que derivam do mesmo, se mesclam
      const objects = new Set(part.filter(x => RUNES[x.rune]?.category === 'shape').map(x => x.node));
      const families = new Map<string, { nodes: Set<string>; elements: Set<string> }>();
      part.filter(x => RUNES[x.rune]?.category === 'elemental').forEach(x => {
        const f = familyOf(x.rune);
        const g = families.get(f) ?? { nodes: new Set<string>(), elements: new Set<string>() };
        g.nodes.add(x.node);
        g.elements.add(x.rune);
        families.set(f, g);
      });
      if (objects.size > 1) {
        families.forEach((g, f) => {
          if (g.nodes.size < 2) return;
          const set = entry.merged.get(f) ?? new Set<string>();
          g.elements.forEach(el => set.add(el));
          entry.merged.set(f, set);
        });
      }
      entry.proj ||= [...seq, ...parallel].some(x => x.rune === 'mod_projetil');
      byNode.set(s.node, entry);
    });
  });
  return [...byNode].map(([node, e]) => {
    const bound = uniqList(e.bound);
    const together = uniqList(e.together).filter(r => bound.includes(r));
    return { node, bound, together, merged: [...e.merged].map(([family, els]) => ({ family, elements: [...els] })), withProjectile: e.proj };
  });
}

// ---------------- Intenção ----------------

export interface IntentUse {
  node: string;
  /** Runa que recebe a intenção (a anterior), ou null: vai para o círculo anterior */
  target: string | null;
  /** Nome do círculo anterior, quando a intenção vai para ele */
  circle: string | null;
  /** Palavra ou números de vínculo */
  bond: string | null;
}

export function checkIntencao(m: Model, flow: FlowResult): IntentUse[] {
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const byNode = new Map<string, IntentUse>();
  /** Círculo que manda energia para o anel do círculo desta forma */
  const previousCircle = (nodeId: string): string | null => {
    const n = byId.get(nodeId);
    const cid = n ? getNodeCircles(m, n)[0] : undefined;
    if (!cid || cid === 'envelope') return null;
    const feed = m.connections.find(c => c.to === ringId(cid));
    if (!feed) return null;
    return getNodeShortLabel(m, feed.from);
  };
  runeSequences(m, flow).forEach(seq => {
    seq.forEach((s, i) => {
      if (s.rune !== 'mod_intencao' || byNode.has(s.node)) return;
      const prev = i > 0 ? seq[i - 1].rune : null;
      byNode.set(s.node, {
        node: s.node,
        target: prev,
        circle: prev ? null : previousCircle(s.node),
        bond: byId.get(s.node)?.bond ?? null
      });
    });
  });
  // Intenção fora de rota (ex.: só recebendo num Col): ainda mostra a palavra
  m.nodes.filter(n => (n.rune === 'mod_intencao' || n.inner?.includes('mod_intencao')) && !byNode.has(n.id))
    .forEach(n => byNode.set(n.id, { node: n.id, target: null, circle: null, bond: n.bond ?? null }));
  return [...byNode.values()];
}
