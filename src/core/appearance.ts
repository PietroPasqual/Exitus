import { isMaintainedFireJet, materialRelation } from './spell-narrative-semantics';
import { RUNES } from '../data/runes';
import { getNodeCircles, isRingId, ringCircleId, ringId, type Model } from './circles';
import { checkEstados } from './estado';
import type { FlowResult } from './flow';
import { intentionFormName, intentionQuantity, resolveIntentionForm, validateIntentionWord, type IntentionForm } from './intention';
import { checkIntencao, checkLigacao, CONCEPT_RUNES, runeSequences, type LinkFusionObservation, type Step } from './structural';

// Aparência da Magia: como a magia ficaria na cena, lida das runas na ordem do ciclo.
// - Cada conjunto fechado por um Ser é um ser; o que não foi separado é a magia principal.
// - Os elementos dão a cor; as runas de formato dão a forma; as de conceito, uma aura.
// - Projétil = voa como um só objeto; Toque = na superfície mais próxima; Área = na mais
//   distante; Direção Contrária = volta para quem lança; Órbita = gira em volta da magia.

export type Placement = 'front' | 'flight' | 'touch' | 'far' | 'self' | 'escort';

/** An actual checker-confirmed fusion group, scoped to one illustrated Being.
 * Optional for older/hand-authored appearances; absence never implies fusion.
 * Separate groups are not transitively unioned, even within the same family.
 */
export interface MaterialFusionGroup {
  readonly family: string;
  readonly elements: readonly string[];
}

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
  /** Presentation-only exact material membership; does not change the rules or legacy flags. */
  readonly materialFusion?: readonly MaterialFusionGroup[];
  /** Palavra de vínculo da Intenção */
  bond: string | null;
  /** Vínculos distintos de várias Intenções no mesmo alvo, na ordem de leitura. */
  intentBonds?: string[];
  /** Silhueta dada pela palavra de Intenção, sem substituir as runas de formato. */
  intentForm?: IntentionForm;
  /** Palavra moldada no próprio material quando não há silhueta ilustrada. */
  intentGlyph?: string;
  /** Quantidade visual exata; não muda custos, poder ou atributos. */
  intentCount?: string;
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

interface Draft { steps: Step[]; closed: boolean; mods: Step[]; closures: Step[]; routes: Set<number>; prisms: Set<string> }

/** Keep the closing Ser's identity: Intenção can refer to that exact grouping. */
function sceneSegments(steps: Step[]): { steps: Step[]; close: Step | null }[] {
  const out: { steps: Step[]; close: Step | null }[] = [];
  let current: Step[] = [];
  steps.forEach(step => {
    if (step.rune === 'mod_ser') { out.push({ steps: current, close: step }); current = []; }
    else current.push(step);
  });
  if (current.length) out.push({ steps: current, close: null });
  return out;
}

/** Same preceding segment used by the structural checkers, including a just-closed Ser. */
function previousPart(steps: Step[], at: number): Step[] {
  let from = at - 1;
  if (steps[from]?.rune === 'mod_ser') from--;
  for (; from >= 0; from--) if (steps[from].rune === 'mod_ser') break;
  return steps.slice(from + 1, at);
}

export function describeAppearance(m: Model, flow: FlowResult): Appearance {
  const seqs = runeSequences(m, flow);
  // A shared route prefix is one physical rune. Repeated inner runes in the same
  // node remain distinct occurrences; different nodes with the same rune do too.
  const keys = new WeakMap<Step, string>();
  const identify = (steps: Step[]): Step[] => {
    const occurrences = new Map<string, number>();
    steps.forEach(step => {
      const base = JSON.stringify([step.node, step.rune]);
      const count = occurrences.get(base) ?? 0;
      occurrences.set(base, count + 1); keys.set(step, `${base}:${count}`);
    });
    return steps;
  };
  seqs.forEach(identify);
  const nodeSteps = new Map(m.nodes.map(node => [node.id, identify([node.rune, ...(node.inner ?? [])]
    .filter((rune): rune is string => !!rune).map(rune => ({ node: node.id, rune })))]));
  const keyOf = (step: Step): string => keys.get(step)!;
  const unique = (steps: Step[]): Step[] => [...new Map(steps.map(step => [keyOf(step), step])).values()];
  const drafts: Draft[] = [];
  const main: Draft = { steps: [], closed: false, mods: [], closures: [], routes: new Set(), prisms: new Set() };
  // A runa da Matriz (matriz) é a fonte do círculo: vale para todos os seres que saem dele
  const prismRunes = new Map<string, Step[]>();

  seqs.forEach((seq, r) => {
    const prism = seq.prism ?? '';
    const own = seq.filter(s => s.node === prism);
    // A Ser inside the source separates its own runes too. Those groups cannot
    // subsequently be re-injected into every being as a global source colour.
    if (own.length && !prismRunes.has(prism)) prismRunes.set(prism, own.some(step => step.rune === 'mod_ser') ? [] : own);
    // A source-only return is not an extra manifestation when another route
    // already emits its Ser groups (for example, the plasma lance's escorts).
    if (!own.some(step => step.rune === 'mod_ser') && seq.every(step => step.node === prism)) return;
    let previous: Draft | null = null;
    sceneSegments(seq).forEach(seg => {
      const hasObject = seg.steps.some(s => isObject(s.rune));
      if (!hasObject) {
        // Só modificadores (ex.: a Direção no fim): valem para o ser anterior da rota
        if (!seg.steps.length) return;
        const target = previous ?? main;
        target.mods.push(...seg.steps);
        if (seg.close) target.closures.push(seg.close);
        target.routes.add(r);
        target.prisms.add(prism);
        return;
      }
      if (seg.close) {
        const d: Draft = { steps: seg.steps, closed: true, mods: [], closures: [seg.close], routes: new Set([r]), prisms: new Set([prism]) };
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
  main.steps = unique(main.steps);

  // Rotas diferentes passando pelas mesmas formas: é o mesmo ser
  const objectsOfDraft = (d: Draft): Set<string> => new Set(d.steps.filter(s => isObject(s.rune)).map(keyOf));
  const merged: Draft[] = [];
  drafts.forEach(d => {
    const mine = objectsOfDraft(d);
    const same = merged.find(o => {
      const theirs = objectsOfDraft(o);
      return [...mine].every(n => theirs.has(n)) || [...theirs].every(n => mine.has(n));
    });
    if (!same) { merged.push(d); return; }
    if (mine.size > objectsOfDraft(same).size) same.steps = unique([...d.steps, ...same.steps.filter(s => !isObject(s.rune))]);
    else same.steps = unique([...same.steps, ...d.steps.filter(s => !isObject(s.rune))]);
    same.mods.push(...d.mods);
    same.closures.push(...d.closures);
    d.routes.forEach(x => same.routes.add(x));
    d.prisms.forEach(x => same.prisms.add(x));
  });
  // Matriz com runa cujo círculo não formou nenhum ser: a runa dele vai para a magia principal
  prismRunes.forEach((steps, prism) => {
    if (![main, ...drafts].some(d => d.prisms.has(prism) && d.steps.length)) {
      main.prisms.add(prism);
      if (steps.some(step => isObject(step.rune))) main.steps.push(...steps);
    }
  });
  main.steps = unique(main.steps);
  // A magia principal também pode ser o mesmo ser que um conjunto (ex.: Escudo d'Água)
  const prismSteps = (d: Draft): Step[] => [...d.prisms].flatMap(p => prismRunes.get(p) ?? []);
  if (main.steps.length || prismSteps(main).some(s => isObject(s.rune))) {
    const mine = objectsOfDraft(main);
    const same = merged.find(o => [...objectsOfDraft(o)].every(n => mine.has(n)) && [...mine].every(n => objectsOfDraft(o).has(n)));
    if (same) {
      same.mods.push(...main.steps.filter(s => !isObject(s.rune)), ...main.mods);
      same.closures.push(...main.closures);
      main.routes.forEach(x => same.routes.add(x));
      main.prisms.forEach(x => same.prisms.add(x));
    } else merged.unshift(main);
  }

  const orbitRoutes = new Set<number>();
  seqs.forEach((seq, r) => { if (seq.some(s => s.rune === 'mod_orbita')) orbitRoutes.add(r); });

  // Preserve the checkers' scope using physical step identities. Their public
  // rune-name summaries are suitable for prose, but not for matching two beings
  // that happen to contain the same element or shape.
  const fusionGroups: LinkFusionObservation[] = [];
  const links = checkLigacao(m, flow, group => fusionGroups.push(group));
  const estados = checkEstados(m, flow), intents = checkIntencao(m, flow);
  const touches = new Set<string>(), areas = new Set<string>(), kept = new Set<string>();
  const touchPrisms = new Set<string>(), areaPrisms = new Set<string>(), statePrisms = new Set<string>();
  const linkTargets = new Map<string, Set<string>>(), intentTargets = new Map<string, Set<string>>();
  const addObjects = (target: Set<string>, steps: Step[]): void => {
    steps.filter(step => isObject(step.rune)).forEach(step => target.add(keyOf(step)));
  };
  const addTargets = (map: Map<string, Set<string>>, node: string, steps: Step[]): void => {
    const target = map.get(node) ?? new Set<string>();
    steps.forEach(step => target.add(keyOf(step))); map.set(node, target);
  };
  seqs.forEach(seq => seq.forEach((step, index) => {
    if (step.rune === 'mod_toque' || step.rune === 'mod_area') {
      const part = previousPart(seq, index);
      addObjects(step.rune === 'mod_toque' ? touches : areas, part);
      // A final surface modifier without Ser applies to this source's entire
      // circle, including its parallel groups; it does not reach other circles.
      if (seq.prism && part.some(previous => previous.rune !== step.rune && previous.rune !== 'mod_ser')
        && !seq.slice(0, index).some(previous => previous.rune === 'mod_ser')
        && seq.slice(index + 1).every(next => next.rune === step.rune)) {
        (step.rune === 'mod_toque' ? touchPrisms : areaPrisms).add(seq.prism);
      }
    }
    if (step.rune === 'mod_ligacao') {
      const own = new Set(seq.map(s => s.node));
      const parallel = seqs.filter(other => other !== seq && other.prism === seq.prism && !other.some(s => s.node === step.node))
        .flatMap(other => other.filter(s => !own.has(s.node)));
      addTargets(linkTargets, step.node, [...previousPart(seq, index), ...parallel].filter(s => isObject(s.rune)));
    }
    if (step.rune === 'mod_intencao' && index > 0) addTargets(intentTargets, step.node, [seq[index - 1]]);
  }));

  // Estado's previous and simultaneous objects follow checkEstados, including
  // receiving-only squares and Estado embedded with other runes in one seal.
  const byNode = new Map(m.nodes.map(node => [node.id, node]));
  estados.forEach(use => {
    const node = byNode.get(use.id)!;
    const targets: Step[] = [];
    if (node.rune === 'mod_estado') {
      let inRoute = false;
      seqs.forEach(seq => {
        const at = seq.findIndex(step => step.node === node.id && step.rune === 'mod_estado');
        if (at < 0) return;
        inRoute = true;
        targets.push(...seq.slice(0, at === 0 && seq.prism === node.id ? seq.length : at).filter(step => step.node !== node.id));
      });
      const feeders = new Set(m.connections.filter(connection => connection.to === node.id).map(connection => connection.from));
      if (!inRoute) flow.perPrism.forEach(prism => prism.routes.forEach(route => {
        const at = route.findIndex(id => feeders.has(id));
        if (at >= 0) targets.push(...route.slice(0, at + 1).flatMap(id => nodeSteps.get(id) ?? []));
      }));
      if (node.inner?.length) targets.push(...(nodeSteps.get(node.id) ?? []));
      m.connections.filter(connection => feeders.has(connection.from) && connection.to !== node.id).forEach(connection => {
        const sibling = byNode.get(connection.to);
        if (sibling && !sibling.lockedCenter) targets.push(...(nodeSteps.get(sibling.id) ?? []));
      });
      flow.perPrism.forEach(prism => {
        const mine = prism.routes.filter(route => route.includes(node.id));
        if (!mine.length) return;
        const own = new Set(mine.flat());
        prism.routes.filter(route => !route.includes(node.id)).flat().filter(id => !own.has(id)).forEach(id => {
          const other = byNode.get(id);
          if (other && !other.lockedCenter) targets.push(...(nodeSteps.get(id) ?? []));
        });
      });
    } else targets.push(...(nodeSteps.get(node.id) ?? []));
    addObjects(kept, targets.filter(step => use.kept.includes(step.rune) || use.together.includes(step.rune)));
    // Estado embedded in an undivided source maintains the source itself, whose
    // contribution is inherited by all of the beings emitted by that source.
    if ((prismRunes.get(node.id) ?? []).some(step => isObject(step.rune)) && node.inner?.includes('mod_estado')) statePrisms.add(node.id);
  });

  // Intenção with no preceding rune can name the previous circle. An unconnected
  // Intenção has no global target and must not label unrelated beings.
  const intentCircles = new Map<string, Set<string>>();
  intents.filter(intent => !intent.target && intent.circle && intent.bond).forEach(intent => {
    const node = byNode.get(intent.node);
    const circle = node ? getNodeCircles(m, node)[0] : undefined;
    const feed = circle ? m.connections.find(connection => connection.to === ringId(circle)) : undefined;
    const source = feed ? byNode.get(feed.from) : undefined;
    const circles = feed && isRingId(feed.from) ? [ringCircleId(feed.from)] : source ? getNodeCircles(m, source) : [];
    intentCircles.set(intent.node, new Set(circles));
  });
  const objectsOf = (draft: Draft): Step[] => draft.steps.filter(step => isObject(step.rune));
  const affects = (target: Set<string> | undefined, steps: Step[]): boolean => !!target && steps.some(step => target.has(keyOf(step)));
  const fromSource = (draft: Draft, sources: Set<string>): boolean => [...draft.prisms].some(prism => sources.has(prism));

  const beings: Being[] = merged.map(d => {
    const objects = objectsOf(d);
    const membership = unique([...d.steps, ...d.mods, ...d.closures]);
    const steps = unique([...prismSteps(d), ...d.steps]);
    const runes = [...steps, ...d.mods].map(step => step.rune);
    const has = (id: string): boolean => runes.includes(id);
    const elements = [...new Set(steps.map(s => s.rune).filter(isElement))];
    const shapes = steps.map(s => s.rune).filter(isShape);
    const concepts = [...new Set(steps.map(s => s.rune).filter(r => CONCEPT_RUNES.has(r)))];
    const far = affects(areas, objects) || fromSource(d, areaPrisms);
    const touch = affects(touches, objects) || fromSource(d, touchPrisms);
    const placement: Placement = far ? 'far' : touch ? 'touch' : has('dir_contraria') ? 'self' : has('mod_projetil') ? 'flight' : 'front';
    const link = links.find(use => affects(linkTargets.get(use.node), objects));
    const ownElementalMembers = new Set(steps.filter(step => cat(step.rune) === 'elemental').map(keyOf));
    // Observe only groups the existing checker actually merged, then project
    // their physical occurrences onto this Being. Ser is a visual boundary:
    // another Being's occurrence cannot supply a missing material or node here.
    const materialFusion = fusionGroups.flatMap(group => {
      if (!affects(linkTargets.get(group.node), objects)) return [];
      const members = group.members.filter(member => ownElementalMembers.has(
        `${JSON.stringify([member.node, member.rune])}:${member.occurrence}`
      ));
      // Scope the complete successful group before projecting its materials:
      // concepts such as Vida can be contributing nodes in the existing rule.
      // Requiring two physical nodes here would silently change that result.
      if (new Set(members.map(member => member.node)).size < 2) return [];
      const present = new Set(members.map(member => member.rune));
      const elements = group.elements.filter(element => present.has(element) && isElement(element));
      // A projected singleton is a physical merge only when that material has
      // multiple contributing nodes. Vida + Luz alone must not claim two Luz
      // parts, while a confirmed Fogo + Fogo group retains its singleton ID.
      if (elements.length === 1 && new Set(members.filter(member => member.rune === elements[0])
        .map(member => member.node)).size < 2) return [];
      return elements.length ? [{ family: group.family, elements }] : [];
    });
    // Repeated shared routes can observe the same visual group more than once.
    // Deduplicate exact membership only; overlapping groups remain independent.
    const uniqueFusion = [...new Map(materialFusion.map(group => [
      JSON.stringify([group.family, [...group.elements].sort()]), group
    ])).values()];
    const applicableIntents = intents.filter(use => use.bond && (affects(intentTargets.get(use.node), membership)
      || (fromSource(d, new Set([use.node])) && affects(intentTargets.get(use.node), prismRunes.get(use.node) ?? []))
      || [...d.prisms].some(prism => {
        const source = byNode.get(prism);
        return source && getNodeCircles(m, source).some(circle => intentCircles.get(use.node)?.has(circle));
      })));
    const intentBonds = [...new Set(applicableIntents.map(use => use.bond!))];
    const words = intentBonds.map(validateIntentionWord).filter(word => !word.error).map(word => word.value);
    const intentCount = words.map(intentionQuantity).find((quantity): quantity is string => !!quantity);
    const firstWord = words.find(word => !intentionQuantity(word));
    const visualWord = firstWord && (elements.length || shapes.length) ? firstWord : null;
    const intentForm = visualWord ? resolveIntentionForm(visualWord) : null;
    return {
      elements, shapes, concepts, placement,
      projectile: has('mod_projetil'),
      orbit: [...d.routes].some(r => orbitRoutes.has(r)),
      direction: has('dir_contraria') ? 'back' : has('dir_padrao') ? 'forward' : null,
      guards: [...(has('dir_lateral') ? ['lateral' as const] : []), ...(has('dir_vertical') ? ['vertical' as const] : [])],
      estado: affects(kept, objects) || fromSource(d, statePrisms),
      linked: !!link,
      merged: !!link?.merged.length,
      ...(uniqueFusion.length ? { materialFusion: uniqueFusion } : {}),
      bond: applicableIntents[0]?.bond ?? null,
      ...(intentBonds.length > 1 ? { intentBonds } : {}),
      ...(intentForm ? { intentForm } : {}),
      ...(visualWord && !intentForm ? { intentGlyph: visualWord } : {}),
      ...(intentCount ? { intentCount } : {}),
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
    b.intentForm ? `${b.elements.length ? '' : 'energia '}em forma de ${intentionFormName(b.intentForm).toLowerCase()} pela Intenção`
      : b.intentGlyph ? `${b.elements.length ? '' : 'energia '}em forma dos caracteres «${b.intentGlyph}» pela Intenção`
      : isMaintainedFireJet(b) ? 'em um jato'
      : b.shapes.length ? `${b.elements.length ? 'em ' : ''}${list([...new Set(b.shapes)])}` : (b.elements.length || b.concepts.length ? '' : 'energia'),
    b.concepts.length ? `${b.elements.length || b.shapes.length ? 'com a aura de ' : 'Aura de '}${list(b.concepts)}` : ''
  ].filter(Boolean).join(' ');
  const parts: string[] = [];
  if (b.placement === 'flight') parts.push('voa como um só objeto aerodinâmico');
  if (b.placement === 'touch') parts.push('aparece na superfície mais próxima, como se tocasse');
  if (b.placement === 'far') parts.push('é reprojetado na superfície mais distante');
  if (b.placement === 'self') parts.push('volta para quem lançou');
  if (b.placement === 'front' && !b.orbit) parts.push('surge à frente de quem lança');
  if (b.placement === 'escort') parts.push('acompanha o objeto em voo');
  if (b.direction === 'forward' && b.placement !== 'far') parts.push('segue para a frente');
  if (b.orbit) parts.push(orbitCount > 1 ? `gira em volta da magia com outros ${orbitCount - 1}, um a cada ${Math.round(360 / orbitCount)}°` : 'gira em volta da magia');
  if (b.guards.length) parts.push(`não é desviado ${b.guards.map(g => (g === 'lateral' ? 'para os lados' : 'para cima ou para baixo')).join(' nem ')}`);
  parts.push(...materialRelation(b));
  if (b.estado) parts.push('fica estável (Estado)');
  if (b.bond) parts.push(`leva a intenção ${(b.intentBonds ?? [b.bond]).map(bond => `«${bond}»`).join(' e ')}`);
  const count = b.intentCount ? `${b.intentCount} ${b.intentCount === '1' ? 'manifestação' : 'manifestações'}: ` : '';
  return `${count}${what.charAt(0).toUpperCase()}${what.slice(1)}${parts.length ? ': ' + parts.join('; ') : ''}.`;
}
