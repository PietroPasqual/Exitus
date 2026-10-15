import { RUNES } from '../data/runes';
import type { Model } from './circles';
import { checkEstados } from './estado';
import type { FlowResult } from './flow';
import { checkArea, checkIntencao, checkLigacao, checkToque, CONCEPT_RUNES, runeSequences, segments, type Step } from './structural';

// Aparência da Magia: como a magia ficaria na cena, lida das runas na ordem do ciclo.
// - Cada conjunto fechado por um Ser é um ser; o que não foi separado é a magia principal.
// - Os elementos dão a cor; as runas de formato dão a forma; as de conceito, uma aura.
// - Projétil = voa como um só objeto; Toque = na superfície mais próxima; Área = na mais
//   distante; Direção Contrária = volta para quem lança; Órbita = gira em volta da magia.

export type Placement = 'front' | 'flight' | 'touch' | 'far' | 'self' | 'escort';

export interface Being {
  /** Elementos (dão a cor), na ordem em que aparecem */
  elements: string[];
  /** Formatos (Esfera, Cubo, Paralelepípedo, Pirâmide), com repetição, na ordem */
  shapes: string[];
  /** Runas de conceito (sem forma física): aparecem como aura */
  concepts: string[];
  placement: Placement;
  /** Une os formatos num só objeto aerodinâmico */
  projectile: boolean;
  /** Gira em volta da magia (Órbita) */
  orbit: boolean;
  /** Direção: para a frente ou de volta para quem lança */
  direction: 'forward' | 'back' | null;
  /** D.N. Lateral / D.N. Vertical: não sai do rumo */
  guards: ('lateral' | 'vertical')[];
  /** O Estado mantém este ser estável */
  estado: boolean;
  /** A Ligação cola as partes */
  linked: boolean;
  /** Elementos que se mesclam (mesma família) */
  merged: boolean;
  /** Palavra de vínculo da Intenção */
  bond: string | null;
  /** Fechado por um Ser */
  closed: boolean;
}

export interface Appearance {
  beings: Being[];
  /** Quantos seres giram em volta da magia e o espaço entre eles */
  orbitCount: number;
}

const cat = (id: string): string | undefined => RUNES[id]?.category;
const isElement = (id: string): boolean => cat(id) === 'elemental' && !CONCEPT_RUNES.has(id);
const isShape = (id: string): boolean => cat(id) === 'shape';
const isObject = (id: string): boolean => cat(id) === 'elemental' || cat(id) === 'shape';

interface Draft { steps: Step[]; closed: boolean; mods: Set<string>; routes: Set<number>; prisms: Set<string> }

export function describeAppearance(m: Model, flow: FlowResult): Appearance {
  const seqs = runeSequences(m, flow);
  const drafts: Draft[] = [];
  const main: Draft = { steps: [], closed: false, mods: new Set(), routes: new Set(), prisms: new Set() };
  // A runa do Prisma (matriz) é a fonte do círculo: vale para todos os seres que saem dele
  const prismRunes = new Map<string, Step[]>();

  seqs.forEach((seq, r) => {
    const prism = seq.prism ?? '';
    const own = seq.filter(s => s.node === prism);
    if (own.length && !prismRunes.has(prism)) prismRunes.set(prism, own);
    const rest = seq.filter(s => s.node !== prism);
    let previous: Draft | null = null;
    segments(rest).forEach(seg => {
      const hasObject = seg.steps.some(s => isObject(s.rune));
      if (!hasObject) {
        // Só modificadores (ex.: a Direção no fim): valem para o ser anterior da rota
        if (!seg.steps.length) return;
        const target = previous ?? main;
        seg.steps.forEach(s => target.mods.add(s.rune));
        target.routes.add(r);
        target.prisms.add(prism);
        return;
      }
      if (seg.closedBy) {
        const d: Draft = { steps: seg.steps, closed: true, mods: new Set(), routes: new Set([r]), prisms: new Set([prism]) };
        drafts.push(d);
        previous = d;
      } else {
        // O que não foi separado por um Ser é tudo uma coisa só: a magia principal
        main.steps.push(...seg.steps);
        main.routes.add(r);
        main.prisms.add(prism);
        previous = main;
      }
    });
  });

  // Rotas diferentes passando pelas mesmas formas: é o mesmo ser
  const nodesOf = (d: Draft): Set<string> => new Set(d.steps.filter(s => isObject(s.rune)).map(s => s.node));
  const merged: Draft[] = [];
  drafts.forEach(d => {
    const mine = nodesOf(d);
    const same = merged.find(o => {
      const theirs = nodesOf(o);
      return [...mine].every(n => theirs.has(n)) || [...theirs].every(n => mine.has(n));
    });
    if (!same) { merged.push(d); return; }
    if (mine.size > nodesOf(same).size) same.steps = d.steps;
    d.mods.forEach(x => same.mods.add(x));
    d.routes.forEach(x => same.routes.add(x));
    d.prisms.forEach(x => same.prisms.add(x));
  });
  // Prisma com runa cujo círculo não formou nenhum ser: a runa dele vai para a magia principal
  prismRunes.forEach((_, prism) => {
    if (![main, ...drafts].some(d => d.prisms.has(prism) && d.steps.length)) main.prisms.add(prism);
  });
  // A magia principal também pode ser o mesmo ser que um conjunto (ex.: Escudo d'Água)
  const prismSteps = (d: Draft): Step[] => [...d.prisms].flatMap(p => prismRunes.get(p) ?? []);
  if (main.steps.length || prismSteps(main).some(s => isObject(s.rune))) {
    const mine = nodesOf(main);
    const same = merged.find(o => [...nodesOf(o)].every(n => mine.has(n)) && [...mine].every(n => nodesOf(o).has(n)));
    if (same) {
      main.steps.forEach(s => { if (!isObject(s.rune)) same.mods.add(s.rune); });
      main.mods.forEach(x => same.mods.add(x));
      main.routes.forEach(x => same.routes.add(x));
      main.prisms.forEach(x => same.prisms.add(x));
    } else merged.unshift(main);
  }

  const orbitRoutes = new Set<number>();
  seqs.forEach((seq, r) => { if (seq.some(s => s.rune === 'mod_orbita')) orbitRoutes.add(r); });

  // O que as outras leituras já sabem: o que o Toque, a Área, a Ligação e o Estado pegam
  const touches = checkToque(m, flow), areas = checkArea(m, flow);
  const links = checkLigacao(m, flow), estados = checkEstados(m, flow), intents = checkIntencao(m, flow);
  const reaches = (runes: string[], whole: boolean, b: Draft): boolean =>
    whole || b.steps.some(s => isObject(s.rune) && runes.includes(s.rune));

  const beings: Being[] = merged.map(d => {
    d.steps = [...prismSteps(d), ...d.steps];
    const runes = [...d.steps.map(s => s.rune), ...d.mods];
    const has = (id: string): boolean => runes.includes(id);
    const elements = [...new Set(d.steps.map(s => s.rune).filter(isElement))];
    const shapes = d.steps.map(s => s.rune).filter(isShape);
    const concepts = [...new Set(d.steps.map(s => s.rune).filter(r => CONCEPT_RUNES.has(r)))];
    const far = has('mod_area') || areas.some(t => reaches(t.part, t.whole, d));
    const touch = has('mod_toque') || touches.some(t => reaches(t.part, t.whole, d));
    const placement: Placement = far ? 'far' : touch ? 'touch' : has('dir_contraria') ? 'self' : has('mod_projetil') ? 'flight' : 'front';
    const link = links.find(l => d.steps.some(s => l.bound.includes(s.rune)));
    const intent = intents.find(t => t.bond && (t.target ? runes.includes(t.target) : true));
    return {
      elements, shapes, concepts, placement,
      projectile: has('mod_projetil'),
      orbit: [...d.routes].some(r => orbitRoutes.has(r)),
      direction: has('dir_contraria') ? 'back' : has('dir_padrao') ? 'forward' : null,
      guards: [...(has('dir_lateral') ? ['lateral' as const] : []), ...(has('dir_vertical') ? ['vertical' as const] : [])],
      estado: has('mod_estado') || estados.some(e => d.steps.some(s => isObject(s.rune) && (e.kept.includes(s.rune) || e.together.includes(s.rune)))),
      linked: !!link || has('mod_ligacao'),
      merged: !!link?.merged.length,
      bond: intent?.bond ?? null,
      closed: d.closed
    } satisfies Being;
  });

  // Seres separados que não têm lugar próprio acompanham o objeto em voo (ex.: as bolas da lança)
  if (beings.some(b => b.placement === 'flight')) {
    beings.forEach(b => { if (b.closed && b.placement === 'front' && !b.orbit) b.placement = 'escort'; });
  }
  return { beings, orbitCount: beings.filter(b => b.orbit).length };
}

/** Frase curta de como cada ser aparece (para quem lê, e para o leitor de tela) */
export function describeBeing(b: Being, orbitCount: number): string {
  const name = (id: string): string => RUNES[id]?.name.split(' (')[0].split(' /')[0] ?? id;
  const list = (ids: string[]): string => ids.map(name).join(', ').replace(/, ([^,]*)$/, ' e $1');
  const what = [
    b.elements.length ? list(b.elements) : '',
    b.shapes.length ? `${b.elements.length ? 'em ' : ''}${list([...new Set(b.shapes)])}` : (b.elements.length || b.concepts.length ? '' : 'energia'),
    b.concepts.length ? `${b.elements.length || b.shapes.length ? 'com a aura de ' : 'Aura de '}${list(b.concepts)}` : ''
  ].filter(Boolean).join(' ');
  const parts: string[] = [];
  if (b.placement === 'flight') parts.push('voa como um só objeto aerodinâmico');
  if (b.placement === 'touch') parts.push('aparece na superfície mais próxima, como se tocasse');
  if (b.placement === 'far') parts.push('é reprojetado na superfície mais distante');
  if (b.placement === 'self') parts.push('volta para quem lançou');
  if (b.placement === 'front' && !b.orbit) parts.push('surge à frente de quem lança');
  if (b.placement === 'escort') parts.push(b.concepts.includes('movimento') ? 'acompanha o objeto em voo, girando em volta dele' : 'acompanha o objeto em voo');
  if (b.direction === 'forward' && b.placement !== 'far') parts.push('segue para a frente');
  if (b.orbit) parts.push(orbitCount > 1 ? `gira em volta da magia com outros ${orbitCount - 1}, um a cada ${Math.round(360 / orbitCount)}°` : 'gira em volta da magia');
  if (b.guards.length) parts.push(`não é desviado ${b.guards.map(g => (g === 'lateral' ? 'para os lados' : 'para cima ou para baixo')).join(' nem ')}`);
  if (b.linked) parts.push(b.merged ? 'as partes se mesclam' : 'as partes ficam coladas, sem misturar');
  if (b.estado) parts.push('fica estável (Estado)');
  if (b.bond) parts.push(`leva a intenção «${b.bond}»`);
  return `${what.charAt(0).toUpperCase()}${what.slice(1)}: ${parts.join('; ')}.`;
}
