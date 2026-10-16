import { RUNES } from '../data/runes';
import { sheetOf } from '../data/rules';
import { SHAPE_META } from '../data/shapes';
import type { Appearance, Being } from './appearance';
import { tierLabel, type CircuitAnalysis } from './analysis';
import type { Model } from './circles';
import type { ShapeId } from './types';

// Ficha da magia, como num livro de RPG: nome, escola, números (energia, conjuração,
// alcance, área, duração), efeitos e uma descrição com sabor de história, tudo lido do círculo.

export interface SpellEffect {
  /** Runa e nome do efeito (ex.: "Fogo — Combustão") */
  title: string;
  /** Texto do efeito (pode ter **negrito** e `código`) */
  text: string;
  /** Efeito do estado Perfeito, já ativo */
  perfect: boolean;
}

export interface SpellSheet {
  name: string;
  /** Linha de baixo do nome: círculo, escola (elementos) e tipo */
  tags: string[];
  /** Números da ficha: [rótulo, valor] */
  stats: [string, string][];
  effects: SpellEffect[];
  /** Descrição narrativa: uma frase por ser */
  description: string[];
  /** Como a magia é desenhada (selos e runas) */
  components: string;
}

const br = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
const runeName = (id: string): string => RUNES[id]?.name.split(' (')[0].split(' /')[0] ?? id;
const list = (items: string[]): string => items.join(', ').replace(/, ([^,]*)$/, ' e $1');

/** Como cada elemento aparece na cena */
const MATTER: Record<string, string> = {
  fogo: 'chamas crepitantes', raio: 'eletricidade estalante', agua: 'água cristalina', gelo: 'gelo cortante',
  vento: 'vento uivante', terra: 'rocha maciça', metal: 'metal polido', som: 'ondas sonoras vibrantes',
  natureza: 'vinhas e folhas vivas', acido: 'ácido borbulhante', ilusao: 'ilusão cintilante', luz: 'luz ofuscante',
  sombra: 'sombras densas', materia: 'matéria bruta', gravidade: 'gravidade esmagadora', espaco: 'espaço distorcido'
};
/** Runas de conceito: não têm corpo, aparecem como aura */
const AURA: Record<string, string> = {
  tempo: 'de tempo suspenso', movimento: 'de movimento incessante', pressao: 'de pressão esmagadora', caos: 'de caos imprevisível',
  infinito: 'de infinito', vazio: 'de vazio silencioso', vida: 'de vida pulsante', morte: 'de morte'
};
/** Formato do corpo: [um, dois ou mais] */
const SHAPE_NOUN: Record<string, [string, string]> = {
  forma_esfera: ['uma esfera', 'esferas'], forma_cubo: ['um cubo', 'cubos'],
  forma_paralelepipedo: ['um bloco alongado, como um pilar', 'blocos alongados'], forma_piramide: ['uma ponta piramidal', 'pontas piramidais']
};
const NUMBER = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito'];
const COUNT_WORD = ['', '', 'Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito'];

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Sujeito da frase: "Uma esfera de chamas crepitantes", "Um projétil de cubos e uma ponta piramidal…" */
function subject(b: Being): string {
  const matter = b.elements.length ? list(b.elements.map(e => MATTER[e] ?? runeName(e).toLowerCase())) : '';
  const fused = b.merged && b.elements.length > 1 ? ' fundidas' : '';
  const of = matter ? ` de ${matter}${fused}` : '';
  const counts = new Map<string, number>();
  b.shapes.forEach(s => counts.set(s, (counts.get(s) ?? 0) + 1));
  const parts = [...counts].map(([s, n]) => (n > 1 ? `${NUMBER[n] ?? n} ${SHAPE_NOUN[s]?.[1] ?? runeName(s)}` : SHAPE_NOUN[s]?.[0] ?? runeName(s)));
  let body: string;
  if (b.projectile && b.shapes.length > 1) body = `um único projétil aerodinâmico, feito de ${list(parts)},${of ? of.replace(/^ de/, ' todo de') : ''}`;
  else if (parts.length) body = `${list(parts)}${of}`;
  else if (matter) body = `uma massa${of}`;
  else body = b.concepts.length ? 'uma presença invisível' : 'um pulso de energia pura';
  const aura = b.concepts.length ? `, envolta numa aura ${list(b.concepts.map(c => AURA[c] ?? `de ${runeName(c).toLowerCase()}`))}` : '';
  return body.replace(/,$/, '') + aura;
}

/** O que o ser faz na cena */
function action(b: Being, orbitCount: number): string[] {
  const out: string[] = [];
  if (b.placement === 'flight') out.push(b.projectile && b.shapes.length > 1 ? 'é disparado, cortando o ar' : 'é disparado como um só projétil, cortando o ar');
  if (b.placement === 'touch') out.push('se espalha pela superfície mais próxima, como um toque');
  if (b.placement === 'far') out.push('cai sobre a superfície mais distante, longe de quem lança');
  if (b.placement === 'self') out.push('se volta para quem lança, envolvendo quem a conjurou');
  if (b.placement === 'escort') out.push(b.concepts.includes('movimento') ? 'acompanha o projétil em voo, girando em volta dele' : 'acompanha o projétil em voo');
  if (b.placement === 'front' && !b.orbit) out.push(b.direction === 'forward' ? 'surge diante de quem lança e avança em linha reta' : 'surge diante de quem lança');
  else if (b.direction === 'forward' && b.placement !== 'far' && b.placement !== 'flight') out.push('segue para a frente');
  if (b.orbit) out.push(orbitCount > 1 ? `gira em volta da magia junto de outros ${orbitCount - 1}, um a cada ${Math.round(360 / orbitCount)}°` : 'gira em volta da magia');
  if (b.guards.length) out.push(`sem se desviar ${b.guards.map(g => (g === 'lateral' ? 'para os lados' : 'para cima ou para baixo')).join(' nem ')}`);
  if (b.linked) out.push(b.merged ? 'com as partes fundidas numa só forma' : 'com as partes coladas, sem se misturar');
  if (b.estado) out.push('mantendo-se estável, sem se apagar nem se desfazer');
  if (b.bond) out.push(`carregando a intenção «${b.bond}»`);
  return out;
}

/** Frase de um ser; seres iguais viram uma frase só ("Quatro iguais: …") */
export function narrate(b: Being, orbitCount: number, count = 1): string {
  const acts = action(b, orbitCount);
  const subj = cap(subject(b));
  // Sujeito com aposto (", feito de…", ", envolta numa aura…") pede vírgula antes do verbo
  const verb = acts.length ? `${subj.includes(',') ? ',' : ''} ${acts[0]}${acts.length > 1 ? ', ' + acts.slice(1).join(', ') : ''}` : '';
  const text = `${subj}${verb}.`;
  return count > 1 ? `${COUNT_WORD[count] ?? count} iguais: ${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

/** Alcance pelo lugar onde a magia aparece */
function rangeOf(beings: Being[]): string {
  const main = beings.find(b => b.placement !== 'escort' && !b.orbit) ?? beings[0];
  if (!main) return '—';
  return {
    front: main.direction === 'forward' ? 'À frente, em linha reta' : 'À frente de quem lança',
    flight: 'Projétil, em linha reta à frente',
    touch: 'Toque (superfície mais próxima)',
    far: 'Distante (superfície mais longe)',
    self: 'Pessoal (em quem lança)',
    escort: 'Junto do projétil'
  }[main.placement] + (beings.some(b => b.orbit) ? ' · órbita em volta' : '');
}

function areaOf(beings: Being[]): string {
  if (beings.some(b => b.placement === 'far')) return 'A superfície mais distante';
  if (beings.some(b => b.placement === 'touch')) return 'A superfície tocada';
  if (beings.some(b => b.placement === 'self')) return 'Quem lança';
  const escorts = beings.filter(b => b.placement === 'escort').length;
  if (beings.some(b => b.placement === 'flight')) return escorts ? `O que estiver no caminho (com ${escorts} em volta)` : 'O que estiver no caminho';
  if (beings.some(b => b.orbit)) return 'Em volta da magia';
  if (beings.length > 1) return `${beings.length} objetos à frente`;
  return beings.length ? 'Um alvo à frente' : '—';
}

/** "2º e 3º Círculo" */
const tiersText = (labels: string[]): string =>
  labels.length > 1 ? `${list(labels.map(l => l.replace(' Círculo', '')))} Círculo` : labels[0] ?? '';

export function buildSpellSheet(m: Model, a: CircuitAnalysis, ap: Appearance, title: string): SpellSheet {
  const c = a.charge;
  const working = m.nodes.filter(n => a.flow.working.has(n.id));
  const elementIds = [...new Set(working.flatMap(n => [n.rune, ...(n.inner ?? [])]).filter((r): r is string => !!r && RUNES[r]?.category === 'elemental'))];

  // Escola: os elementos; tipo: o que a magia faz no espaço
  const kind = ap.beings.some(b => b.placement === 'flight') ? 'Projétil'
    : ap.beings.some(b => b.placement === 'far') ? 'Área distante'
    : ap.beings.some(b => b.placement === 'touch') ? 'Toque'
    : ap.beings.some(b => b.placement === 'self') ? 'Pessoal'
    : ap.beings.some(b => b.orbit) ? 'Órbita' : 'Evocação';
  const tags = [tiersText(a.tiers.map(tierLabel)), elementIds.length ? list(elementIds.map(runeName)) : 'Mana pura', kind];

  const level = { inativo: 'não funciona', insuficiente: 'não ativa', estavel: 'estável', perfeito: 'perfeita', instavel: `instável (${br(c.failure)}% de falha)`, autodestruicao: 'autodestruição' }[c.level];
  const retained = a.flow.retained.length > 0;
  const stats: [string, string][] = [
    ['Energia', c.level === 'inativo' ? '—' : `${br(c.energy)} · ${level}`],
    ['Conjuração', c.level === 'inativo' ? '—' : `${br(c.seconds)} s`],
    ['Alcance', rangeOf(ap.beings)],
    ['Área', areaOf(ap.beings)],
    ['Duração', ap.beings.some(b => b.estado) ? 'Sustentada (Estado)' : retained ? 'Sustentada (Quadrado □)' : ap.beings.some(b => b.orbit) ? 'Contínua (órbita)' : 'Instantânea'],
    ['Poder', c.level === 'inativo' || a.metrics.power === '0.0' ? '—' : `${a.metrics.power.replace('.', ',')}${a.metrics.intensity !== '—' && !a.metrics.intensity.endsWith('Pwr') ? ` · ${a.metrics.intensity.replace(/(\d)\.(\d)/, '$1,$2')}` : ''}`]
  ];

  // Efeitos: a passiva de cada elemento e, no Perfeito, a aplicação perfeita
  const effects: SpellEffect[] = [];
  elementIds.forEach(id => {
    const r = RUNES[id], s = sheetOf(id);
    const states = working.filter(n => n.rune === id || n.inner?.includes(id)).map(n => c.nodeState.get(n.id));
    // A ficha do Grimório manda; sem ela, o efeito da Tabela Geral (**Nome:** texto); por último, a passiva da runa
    const fromEffect = s.effect.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    const passiveName = s.passiveTitle || fromEffect?.[1] || (r.passive ?? '').split(' (')[0];
    const passiveText = s.passiveText || (fromEffect ? cap(fromEffect[2]) : (r.passive ?? '').replace(/^[^(]*\(/, '').replace(/\)$/, ''));
    if (passiveName || passiveText) effects.push({ title: `${runeName(id)} — ${passiveName || 'Passiva'}`, text: passiveText, perfect: false });
    if (states.includes('perfeito') || states.includes('instavel')) {
      const pName = s.perfectTitle || (r.perfectEffect ?? '').replace(/^2º Estágio — /, '').split(' (')[0];
      const pText = s.perfectText || (r.perfectEffect ?? '').replace(/^2º Estágio — /, '');
      if (pName || pText) effects.push({ title: `${runeName(id)} — ${pName || 'Aplicação Perfeita'}`, text: pText === pName ? '' : pText, perfect: true });
    }
  });

  // Descrição: uma frase por ser; seres iguais juntos
  const groups = new Map<string, { b: Being; n: number }>();
  ap.beings.forEach(b => {
    const key = JSON.stringify(b);
    const g = groups.get(key);
    if (g) g.n++; else groups.set(key, { b, n: 1 });
  });
  const description = [...groups.values()].map(g => narrate(g.b, ap.orbitCount, g.n));

  // Componentes: os selos e as runas do desenho
  const shapeCount = new Map<ShapeId, number>();
  m.nodes.forEach(n => shapeCount.set(n.shape, (shapeCount.get(n.shape) ?? 0) + 1));
  const seals = [...shapeCount].map(([s, n]) => `${n} ${SHAPE_META[s].short}${n > 1 && !SHAPE_META[s].short.includes('+') ? (SHAPE_META[s].short.endsWith('z') ? 'es' : 's') : ''}`);
  const runes = [...new Set(m.nodes.flatMap(n => [n.rune, ...(n.inner ?? [])]).filter((r): r is string => !!r))].map(runeName);
  const circles = m.circles.length > 1 ? `${m.circles.length} círculos · ` : '';
  const components = `${circles}Selos: ${list(seals)}${runes.length ? ` · Runas: ${list(runes)}` : ''}`;

  return { name: title || 'Magia sem nome', tags, stats, effects, description, components };
}
