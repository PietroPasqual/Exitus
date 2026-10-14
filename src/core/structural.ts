import { RUNES } from '../data/runes';
import { getNodeCircles, getNodeShortLabel, ringId, type Model } from './circles';
import type { FlowResult } from './flow';

// Runas estruturais (Propriedade), na ordem em que a energia passa:
// - Ser: as runas anteriores a ele viram um conjunto (um "ser"). Separa objetos ou elementos
//   para que sejam, ou não, afetados por outra runa.
// - Toque: a magia, ou a parte anterior a ele, interage direto com a superfície mais próxima.
//   Mostra a utilidade com runas sem forma física, como a Vida (só sobrenatural).
// - Área: o mesmo, mas com a superfície mais distante (quase como se reprojetada).
//   Com runas de Espaço, cria âncoras de ativação.
// - Ligação: cola objetos ou elementos entre si, sem misturar. Recomendada com o Projétil;
//   objetos do mesmo elemento se mesclam.
// - Órbita: uma linha invisível paralela ao círculo; tudo ligado a ela orbita a magia,
//   com os seres divididos igualmente pela circunferência.
// - Intenção: põe a intenção de quem usa na runa anterior (ou no círculo anterior), com uma
//   palavra ou números de vínculo que não se desvinculam.

/** Runas sem fator físico, só sobrenatural */
export const NON_PHYSICAL = new Set(['vida', 'morte']);

/** Objeto (formato) ou elemento */
const isObject = (id: string): boolean => {
  const c = RUNES[id]?.category;
  return c === 'elemental' || c === 'shape';
};

interface Step { node: string; rune: string }
type Seq = Step[] & { prism?: string };

/** Runas na ordem em que a energia passa (as de dentro de um Selo vêm junto com ele) */
function runeSequences(m: Model, flow: FlowResult): Seq[] {
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

/** Onde começa a "parte anterior" ao passo i: logo depois do último Ser (ou o começo) */
function partStart(seq: Step[], i: number): number {
  for (let j = i - 1; j >= 0; j--) if (seq[j].rune === 'mod_ser') return j + 1;
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
}

export interface SerCheck {
  groups: SerGroup[];
  orbits: OrbitUse[];
}

export function checkSer(m: Model, flow: FlowResult): SerCheck {
  const groups: SerGroup[] = [];
  const gKeys = new Set<string>();
  const orbitMap = new Map<string, { beings: Map<string, string[]>; separated: boolean }>();
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
      const entry = orbitMap.get(o.node) ?? { beings: new Map<string, string[]>(), separated: false };
      entry.separated ||= separated;
      segs.forEach(seg => {
        const objects = uniqList(seg.steps.map(s => s.rune).filter(isObject));
        if (objects.length) entry.beings.set(seg.steps.map(s => s.node + s.rune).join(), objects);
      });
      orbitMap.set(o.node, entry);
    });
  });
  const orbits: OrbitUse[] = [...orbitMap].map(([node, e]) => {
    const beings = [...e.beings.values()];
    return { node, beings, separated: e.separated, spacing: beings.length ? 360 / beings.length : 0 };
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
  /** Toque: runas sem forma física nessa parte (ex.: Vida) */
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
      const part = seq.slice(start, i).map(x => x.rune).filter(r => r !== runeId);
      const whole = start === 0 && part.length > 0 && seq.slice(i + 1).every(x => x.rune === runeId);
      const entry = byNode.get(s.node) ?? { part: [], whole: false, space: false };
      entry.part.push(...part);
      entry.whole ||= whole;
      entry.space ||= seq.some(x => x.rune === 'espaco');
      byNode.set(s.node, entry);
    });
  });
  return [...byNode].map(([node, e]) => {
    const part = uniqList(e.part);
    return { node, part, whole: e.whole, nonPhysical: part.filter(r => NON_PHYSICAL.has(r)), withSpace: e.space };
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
  /** Elementos que aparecem em mais de um objeto: esses se mesclam */
  merged: string[];
  /** Usada junto com o Projétil (recomendado) */
  withProjectile: boolean;
}

export function checkLigacao(m: Model, flow: FlowResult): LinkUse[] {
  const byNode = new Map<string, { bound: string[]; together: string[]; merged: Set<string>; proj: boolean }>();
  const seqs = runeSequences(m, flow);
  seqs.forEach(seq => {
    seq.forEach((s, i) => {
      if (s.rune !== 'mod_ligacao') return;
      const before = seq.slice(partStart(seq, i), i);
      // Ao mesmo tempo: o que corre em paralelo, saindo do mesmo Prisma (ex.: a lança)
      const parallel = parallelSteps(seqs, seq, s.node);
      const part = [...before, ...parallel].filter(x => isObject(x.rune));
      const entry = byNode.get(s.node) ?? { bound: [], together: [], merged: new Set<string>(), proj: false };
      entry.bound.push(...part.map(x => x.rune));
      entry.together.push(...parallel.filter(x => isObject(x.rune)).map(x => x.rune));
      // Mesmo elemento em objetos diferentes: os objetos se mesclam
      const objects = new Set(part.filter(x => RUNES[x.rune]?.category === 'shape').map(x => x.node));
      const elementNodes = new Map<string, Set<string>>();
      part.filter(x => RUNES[x.rune]?.category === 'elemental').forEach(x => {
        const set = elementNodes.get(x.rune) ?? new Set<string>();
        set.add(x.node);
        elementNodes.set(x.rune, set);
      });
      if (objects.size > 1) elementNodes.forEach((nodes, el) => { if (nodes.size > 1) entry.merged.add(el); });
      entry.proj ||= [...seq, ...parallel].some(x => x.rune === 'mod_projetil');
      byNode.set(s.node, entry);
    });
  });
  return [...byNode].map(([node, e]) => {
    const bound = uniqList(e.bound);
    const together = uniqList(e.together).filter(r => bound.includes(r));
    return { node, bound, together, merged: [...e.merged], withProjectile: e.proj };
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
