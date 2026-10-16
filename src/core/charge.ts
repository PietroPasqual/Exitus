import { RUNES } from '../data/runes';
import { CALC } from '../data/rules';
import { baseUp, SHAPE_META, shapeName, STABLE_SHAPES, TRIANGLE_SHAPES } from '../data/shapes';
import { getSources, isPrism, type Model } from './circles';
import type { FlowResult } from './flow';
import type { Activation, Mage, MagicNode } from './types';

// Energia e Cargas Mágicas.
// O mago infunde uma quantia X de energia na Matriz. Ela corre pelos fios como um líquido
// (ou eletricidade) e cada selo e cada runa gasta conforme o estado em que fica:
//  • abaixo do Mínimo de todos, a magia não ativa;
//  • do Mínimo até a Ativação perfeita, é estável: a sobra sobe as runas para Perfeito,
//    na ordem do caminho (a 1ª runa depois da Matriz primeiro), e depois os selos;
//  • na Ativação perfeita (tudo em Perfeito), a magia não pode falhar;
//  • acima dela, instável: a chance de falha vai de 20% a 100% e a 1ª runa do caminho
//    é a primeira que pode falhar;
//  • na soma de tudo no Instável, autodestruição.

const EPS = 1e-6;
const STATES: Activation[] = ['ativacao', 'perfeito', 'instavel'];

export type ChargeLevel = 'inativo' | 'insuficiente' | 'estavel' | 'perfeito' | 'instavel' | 'autodestruicao';
/** Estado de uma parte; "sem" = a energia não chegou ao mínimo dela */
export type PartState = Activation | 'sem';

export interface ChargePart {
  node: string;
  kind: 'selo' | 'runa';
  /** Forma (selo) ou runa */
  id: string;
  name: string;
  cost: Record<Activation, number>;
  /** Energia que ficou nela */
  alloc: number;
  state: PartState;
}

export interface Charge {
  /** Energia infundida na Matriz */
  energy: number;
  /** A energia é a da Ativação perfeita (o mago não escolheu um valor) */
  auto: boolean;
  minimum: number;
  perfect: number;
  /** Autodestruição (todos no Instável) */
  destruction: number;
  level: ChargeLevel;
  /** Chance de falha (%) */
  failure: number;
  parts: ChargePart[];
  /** Estado de cada nó (pela sua runa; sem runa, pelo selo) */
  nodeState: Map<string, PartState>;
  /** Energia que cada nó gasta (selo + runas) */
  nodeEnergy: Map<string, number>;
  /** Energia que corre em cada fio: chave "de>para" */
  wires: Map<string, number>;
  /** Energia que volta à Matriz */
  returned: number;
  /** O primeiro que pode falhar (nó) */
  firstToFail: string | null;
  /** Runas fora de um Círculo: no estável, podem subir ou cair de estado por sorte ou azar */
  oscillating: string[];
  /** Triângulo: multiplicadores de cada nó */
  powerMult: Map<string, number>;
  effectMult: Map<string, number>;
  /** Pentágonos: entradas, se passam, quanto sai e quanto guardam */
  pentagons: { node: string; inputs: number; active: number; passes: boolean; out: number; stored: number }[];
  /** Quadrados: quantas fontes entram (cada uma reativa a runa) */
  squares: { node: string; sources: number }[];
  /** Estrelas sozinhas: guardam energia e devolvem 1,2 vez à fonte */
  stars: { node: string; stored: number; back: number }[];
  /** As Estrelas devolvem energia suficiente para reativar a magia */
  reactivates: boolean;
  /** Segundos para a energia ser infundida (energia ÷ velocidade × refino) */
  seconds: number;
  mage: Mage;
}

export const wireKey = (from: string, to: string): string => `${from}>${to}`;

/** Ficha do mago com os valores padrão */
export function mageOf(m: { mage?: Partial<Mage> }): Mage {
  return {
    refino: m.mage?.refino && m.mage.refino > 0 ? m.mage.refino : 1,
    energia: typeof m.mage?.energia === 'number' && m.mage.energia >= 0 ? m.mage.energia : null,
    velocidade: m.mage?.velocidade && m.mage.velocidade > 0 ? m.mage.velocidade : CALC.velocidadeMedia
  };
}

/** Triângulo: base para baixo = Poder ×3 e custo ×5; base para cima = efeito ×2 e custo ×4 */
export function triangleOf(n: MagicNode): { power: number; effect: number; cost: number } {
  if (!TRIANGLE_SHAPES.includes(n.shape)) return { power: 1, effect: 1, cost: 1 };
  return baseUp(n.rot) ? { power: 1, effect: 2, cost: 4 } : { power: 3, effect: 1, cost: 5 };
}

/** Energia de uma runa num nó, em cada estado */
export function runeCosts(n: MagicNode, runeId: string, missingMat: boolean): Record<Activation, number> {
  const r = RUNES[runeId];
  const mult = triangleOf(n).cost;
  const out = { ativacao: 0, perfeito: 0, instavel: 0 };
  if (!r?.stats) return out;
  STATES.forEach(st => {
    const s = r.stats?.[st] ?? r.stats?.ativacao;
    if (!s) return;
    let cost = r.costPerPower ? s.power * (r.costPerPower[st] ?? r.costPerPower.ativacao) : s.cost;
    if (missingMat && r.category === 'elemental' && r.missingPenalty) cost *= 1 + r.missingPenalty;
    out[st] = cost * mult;
  });
  return out;
}

const stateOf = (p: { cost: Record<Activation, number>; alloc: number }): PartState => {
  if (p.alloc > p.cost.perfeito + EPS) return 'instavel';
  if (p.alloc >= p.cost.perfeito - EPS) return 'perfeito';
  if (p.alloc >= p.cost.ativacao - EPS) return 'ativacao';
  return 'sem';
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function simulateCharge(m: Model, flow: FlowResult, missingMat = false): Charge {
  const mage = mageOf(m);
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const sources = getSources(m);
  const sourceIds = new Set(sources.map(s => s.id));

  // Fios do circuito
  const outAdj = new Map<string, string[]>(), incAdj = new Map<string, string[]>();
  flow.edges.forEach(([a, b]) => {
    if (!outAdj.has(a)) outAdj.set(a, []);
    if (!incAdj.has(b)) incAdj.set(b, []);
    outAdj.get(a)?.push(b);
    incAdj.get(b)?.push(a);
  });
  const isPentagon = (id: string): boolean => { const n = byId.get(id); return !!n && (n.shape === 'hexagon' || n.shape === 'redor'); };

  // Pentágono (Comparador): só passa quando todas as entradas ligadas a ele estão ativas.
  // O que só recebe energia por um Pentágono travado fica sem energia.
  let fedSet = new Set<string>();
  const blocked = new Set<string>();
  for (let round = 0; round < 6; round++) {
    const reach = new Set<string>();
    const stack = sources.map(x => x.id).filter(id => flow.working.has(id));
    stack.forEach(id => reach.add(id));
    while (stack.length) {
      const u = stack.pop() as string;
      if (blocked.has(u)) continue;
      (outAdj.get(u) ?? []).forEach(v => { if (!reach.has(v)) { reach.add(v); stack.push(v); } });
    }
    fedSet = reach;
    let changed = false;
    reach.forEach(u => {
      if (!isPentagon(u) || blocked.has(u)) return;
      if ((incAdj.get(u) ?? []).some(a => !reach.has(a))) { blocked.add(u); changed = true; }
    });
    if (!changed) break;
  }
  const live = (id: string): boolean => flow.working.has(id) && fedSet.has(id);

  // Ordem do caminho: como a energia passa pelas rotas (as mais curtas primeiro)
  const order: MagicNode[] = [];
  const seen = new Set<string>();
  const push = (id: string): void => {
    const n = byId.get(id);
    if (n && live(id) && !seen.has(id)) { seen.add(id); order.push(n); }
  };
  flow.perPrism.filter(p => p.starts && p.closes).forEach(p => { push(p.prism.id); p.routes.forEach(r => r.forEach(push)); });
  m.nodes.forEach(n => push(n.id));

  // Partes: o selo de cada nó e as runas escritas nele
  const parts: ChargePart[] = [];
  order.forEach(n => {
    parts.push({ node: n.id, kind: 'selo', id: n.shape, name: shapeName(n.shape), cost: { ...SHAPE_META[n.shape].cost }, alloc: 0, state: 'sem' });
    [n.rune, ...(n.inner ?? [])].filter((r): r is string => !!r && !!RUNES[r]).forEach(r => {
      parts.push({ node: n.id, kind: 'runa', id: r, name: RUNES[r].name.split(' (')[0], cost: runeCosts(n, r, missingMat), alloc: 0, state: 'sem' });
    });
  });
  const sum = (st: Activation): number => parts.reduce((a, p) => a + p.cost[st], 0);
  const minimum = round1(sum('ativacao')), perfect = round1(sum('perfeito')), destruction = round1(sum('instavel'));
  const auto = mage.energia === null;
  const energy = auto ? perfect : mage.energia as number;

  // Distribui a energia
  let level: ChargeLevel;
  let firstToFail: string | null = null;
  if (!parts.length) level = 'inativo';
  else if (energy < minimum - EPS) {
    level = 'insuficiente';
    let left = energy;
    for (const p of parts) { const give = Math.min(left, p.cost.ativacao); p.alloc = give; left -= give; if (left <= EPS) break; }
  } else {
    parts.forEach(p => { p.alloc = p.cost.ativacao; });
    let surplus = energy - minimum;
    const raise = (list: ChargePart[], to: Activation): void => {
      for (const p of list) {
        if (surplus <= EPS) return;
        const room = p.cost[to] - p.alloc;
        if (room <= 0) continue;
        const give = Math.min(room, surplus);
        p.alloc += give; surplus -= give;
      }
    };
    // 1º as runas sobem para Perfeito, na ordem do caminho; depois os selos
    raise(parts.filter(p => p.kind === 'runa'), 'perfeito');
    raise(parts.filter(p => p.kind === 'selo'), 'perfeito');
    // Passou da Ativação perfeita: a sobra vai para o Instável, a começar pela 1ª runa do caminho
    // (a Matriz, que é a fonte, fica por último)
    const atSource = (p: ChargePart): boolean => sourceIds.has(p.node);
    const overload = [...parts.filter(p => !atSource(p) && p.kind === 'runa'), ...parts.filter(p => !atSource(p) && p.kind === 'selo'), ...parts.filter(atSource)];
    if (surplus > EPS) firstToFail = overload[0]?.node ?? null;
    raise(overload, 'instavel');
    if (energy >= destruction - EPS) level = 'autodestruicao';
    else if (energy > perfect + EPS) level = 'instavel';
    else if (energy >= perfect - EPS) level = 'perfeito';
    else level = 'estavel';
  }
  parts.forEach(p => { p.state = stateOf(p); });

  // Chance de falha: 20% logo acima da Ativação perfeita até 100% na Autodestruição
  let failure = 0;
  if (level === 'autodestruicao') failure = 100;
  else if (level === 'instavel') {
    const lo = perfect + 0.1, hi = destruction - 0.1;
    failure = hi > lo ? CALC.falhaInicial + (100 - CALC.falhaInicial) * Math.min(1, Math.max(0, (energy - lo) / (hi - lo))) : CALC.falhaInicial;
  }

  const nodeEnergy = new Map<string, number>();
  const nodeState = new Map<string, PartState>();
  parts.forEach(p => nodeEnergy.set(p.node, (nodeEnergy.get(p.node) ?? 0) + p.alloc));
  order.forEach(n => {
    const own = parts.filter(p => p.node === n.id);
    const main = own.find(p => p.kind === 'runa' && p.id === n.rune) ?? own[0];
    if (main) nodeState.set(n.id, main.state);
  });

  // ---- A energia em cada fio ----
  // Cada fio leva a energia que o que vem depois dele vai gastar; onde a energia se junta
  // (várias entradas), cada entrada leva uma parte igual. A sobra (acima da Autodestruição) volta à Matriz.
  const main = order.find(n => sourceIds.has(n.id)) ?? null;
  const wires = new Map<string, number>();
  const pentagons: Charge['pentagons'] = [];
  const squares: Charge['squares'] = [];
  const stars: Charge['stars'] = [];
  let returned = 0;
  if (main && level !== 'inativo') {
    // Ordem topológica a partir da Matriz; os fios que voltam (ciclo) ficam de fora
    const mark = new Map<string, 1 | 2>();
    const post: string[] = [];
    const back = new Set<string>();
    const dfs = (u: string): void => {
      mark.set(u, 1);
      if (!blocked.has(u)) for (const v of outAdj.get(u) ?? []) {
        if (sourceIds.has(v) || mark.get(v) === 1) { back.add(wireKey(u, v)); continue; }
        if (!mark.has(v)) dfs(v);
      }
      mark.set(u, 2);
      post.push(u);
    };
    dfs(main.id);
    const forwardIns = (v: string): string[] => (incAdj.get(v) ?? []).filter(a => mark.has(a) && !back.has(wireKey(a, v)) && !blocked.has(a));
    const need = new Map<string, number>();
    post.forEach(u => {
      let total = nodeEnergy.get(u) ?? 0;
      if (!blocked.has(u)) (outAdj.get(u) ?? []).forEach(v => {
        const k = wireKey(u, v);
        if (back.has(k)) { wires.set(k, wires.get(k) ?? 0); return; }
        const share = (need.get(v) ?? 0) / Math.max(1, forwardIns(v).length);
        wires.set(k, (wires.get(k) ?? 0) + share);
        total += share;
      });
      need.set(u, total);
    });
    // Sobra: a energia que ninguém gastou volta à Matriz pelos fios de volta
    const spent = parts.reduce((a, p) => a + p.alloc, 0);
    returned = Math.max(0, energy - spent);
    const backs = [...back].filter(k => sourceIds.has(k.split('>')[1]));
    if (returned > EPS && backs.length) backs.forEach(k => wires.set(k, (wires.get(k) ?? 0) + returned / backs.length));

    post.forEach(u => {
      const n = byId.get(u);
      if (!n) return;
      const ins = incAdj.get(u) ?? [];
      const activeIns = ins.filter(a => fedSet.has(a) && !blocked.has(a));
      if (isPentagon(u)) {
        const inputs = Math.max(1, ins.length);
        const passes = !blocked.has(u);
        const inside = (need.get(u) ?? 0);
        const out = passes ? inside - (nodeEnergy.get(u) ?? 0) : 0;
        pentagons.push({ node: u, inputs, active: activeIns.length, passes, out: inputs > 1 ? out / inputs : out, stored: inputs > 1 ? out - out / inputs : 0 });
      }
      if (n.shape === 'square') squares.push({ node: u, sources: activeIns.length });
      if ((n.shape === 'star' || n.shape === 'redor') && !n.double) {
        const used = nodeEnergy.get(u) ?? 0;
        stars.push({ node: u, stored: used, back: used * CALC.estrelaRetorno });
      }
    });
    pentagons.reverse(); squares.reverse(); stars.reverse();
  }
  // Pentágonos travados que nem chegaram a ser visitados
  blocked.forEach(u => {
    if (pentagons.some(p => p.node === u)) return;
    const ins = incAdj.get(u) ?? [];
    pentagons.push({ node: u, inputs: ins.length, active: ins.filter(a => fedSet.has(a)).length, passes: false, out: 0, stored: 0 });
  });
  const starBack = stars.reduce((a, s) => a + s.back, 0);

  // Runas fora de um Círculo podem oscilar de estado no estável (o Círculo segura)
  const oscillating = level === 'estavel'
    ? order.filter(n => n.rune && !isPrism(n) && !STABLE_SHAPES.includes(n.shape)).map(n => n.id)
    : [];

  const powerMult = new Map<string, number>(), effectMult = new Map<string, number>();
  order.forEach(n => { const t = triangleOf(n); powerMult.set(n.id, t.power); effectMult.set(n.id, t.effect); });

  return {
    energy, auto, minimum, perfect, destruction, level, failure, parts, nodeState, nodeEnergy, wires, returned,
    firstToFail, oscillating, powerMult, effectMult, pentagons, squares, stars,
    reactivates: stars.length > 0 && starBack >= minimum - EPS && level !== 'insuficiente',
    seconds: energy / (mage.velocidade * mage.refino),
    mage
  };
}

/** Os limites da magia em texto: [nome, valor] */
export function thresholds(c: Pick<Charge, 'minimum' | 'perfect' | 'destruction'>): [ChargeLevel, string, string][] {
  const b = (n: number): string => String(round1(n)).replace('.', ',');
  return [
    ['insuficiente', 'Mínimo para ativação', b(c.minimum)],
    ['estavel', 'Ativação estável', c.perfect - c.minimum >= 0.1 ? `${b(c.minimum)} ~ ${b(c.perfect - 0.1)}` : b(c.minimum)],
    ['perfeito', 'Ativação perfeita', b(c.perfect)],
    ['instavel', 'Instabilidade por sobrecarga', `${b(c.perfect + 0.1)} ~ ${b(c.destruction - 0.1)}`],
    ['autodestruicao', 'Autodestruição por sobrecarga', b(c.destruction)]
  ];
}
