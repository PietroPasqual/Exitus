import { ARCHETYPES } from '../data/rpg-archetypes';
import { newCharacter, readCharacter, type Character } from './character';
import {
  INVENTORY_LOCATIONS, RPG_ACTIONS, RPG_EXTRA_RESOURCE_LIMIT, RPG_INVENTORY_LIMIT, RPG_RESOURCES, RPG_LIST_LIMIT, RPG_NOTES_LIMIT, RPG_STATES, RPG_STATS, SKILL_EXECUTIONS, SKILL_TYPES,
  type ActionId, type ResourceId, type RpgEntry, type RpgInventoryEntry, type RpgSheet, type RpgSkill, type StatId
} from './rpg-sheet';

/**
 * Lê a ficha escrita em texto no modelo do Livro de Regras (copiada do Notion, exportada em
 * Markdown ou digitada num .txt). É uma leitura tolerante: o que não for reconhecido é
 * listado, e a ficha final passa pela mesma validação de uma importação JSON.
 */
export type CharacterTextReading =
  | { ok: true; character: Character; recognized: number; unrecognized: string[]; trimmed: boolean; trimmedFields: string[] }
  | { ok: false; problem: string };

type Section = '' | 'descricao' | 'elementos' | 'status' | 'acoes' | 'habilidades' | 'pericias' | 'inventario'
  | 'conquistas' | 'caracteristicas' | 'historia' | 'explicacoes' | 'anotacoes';
const SECTIONS: Record<string, Section> = {
  descricao: 'descricao', elementos: 'elementos', status: 'status', estatisticas: 'status', acoes: 'acoes',
  habilidades: 'habilidades', pericias: 'pericias', inventario: 'inventario', conquistas: 'conquistas',
  caracteristicas: 'caracteristicas', historia: 'historia', explicacoes: 'explicacoes', anotacoes: 'anotacoes'
};

/** Minúsculas, sem acentos nem pontuação: "Sub. Classe" → "sub classe". */
const key = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
interface ClipState { trimmed: boolean; fields: string[] }
/** Corta no limite da ficha e anota o que foi cortado (`label`), para avisar quem importou. */
const clip = (value: string, max: number, state: ClipState, label = ''): string => {
  if (value.length <= max) return value;
  state.trimmed = true;
  if (label && state.fields.length < 6 && !state.fields.includes(label)) state.fields.push(label);
  return value.slice(0, max);
};
/** Remove contadores do modelo, como "(0/1)" ou "[0/3]". */
const uncount = (value: string): string => value.replace(/\s*[([]\s*\d+\s*\/\s*\d+\s*[)\]]\s*$/, '').trim();
/** Valores ainda não preenchidos no modelo: "- - -", "??", "?". */
const placeholder = (value: string): boolean => /^[\s\-–—?.…/]*$/.test(value);
/** Rótulos das regras transcritas junto do modelo; não são dados do personagem. */
const RULE_LABELS = new Set(['vantagens', 'desvantagens', 'especial', 'penalidades', 'fama']);
/** Linhas de referência que o modelo traz em "Anotações"; não são anotações do jogador. */
const TEMPLATE_NOTES = new Set([
  'pericia etapa grau', 'execucao consequencia acao consenso', 'tipo talento aprendizado dadiva', 'efeito', 'condicao',
  'complementar', 'fundamentos', 'titulos f e d c b a s ss z m', 'efeitos 100 250 750 1500 2500 5000 10000'
]);
const parseNumber = (value: string): number | null => {
  const match = value.trim().match(/^[+-]?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const number = Number(match[0].replace(',', '.'));
  return Number.isFinite(number) && Math.abs(number) <= 1_000_000_000 ? number : null;
};
const parseCount = (value: string): number | null => {
  const number = parseNumber(value);
  return number !== null && Number.isInteger(number) && number >= 0 ? number : null;
};
/** Uma única opção entre as permitidas; listas do modelo ("A / B / C") são ignoradas. */
function choice<T extends string>(value: string, options: readonly T[]): T | null {
  const wanted = key(value);
  return wanted ? options.find(option => option && key(option) === wanted) ?? null : null;
}
/**
 * Separa "A, B; C" em itens, sem cortar dentro de parênteses ou colchetes nem números como "13,7".
 * Com `semicolonOnly`, só o ponto e vírgula separa (descrições usam vírgulas).
 */
function splitItems(value: string, semicolonOnly = false): string[] {
  const parts: string[] = [];
  let depth = 0, current = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(' || char === '[') depth++;
    else if ((char === ')' || char === ']') && depth > 0) depth--;
    if (!depth && (char === ';' || !semicolonOnly && char === ',' && /\s/.test(value[i + 1] ?? ''))) { parts.push(current); current = ''; continue; }
    current += char;
  }
  parts.push(current);
  return parts.map(part => uncount(part.trim())).filter(item => !placeholder(item));
}
/** "Guerreiro (D)" vira { nome: 'Guerreiro', valor: 'D' }; "Nome — nota" guarda a nota. */
function entry(item: string, state: ClipState): RpgEntry {
  let nome = item, valor = '', notas = '';
  const note = nome.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (note) { nome = note[1]; notas = note[2]; }
  const labelled = nome.match(/^([^:]+):\s*(.+)$/);
  if (labelled) { nome = labelled[1]; valor = labelled[2]; }
  nome = nome.replace(/:\s*$/, '');
  const value = !labelled && nome.match(/^(.+?)\s*\(([^()]+)\)\.?$/);
  // "Injustiça (Quando morre, ao invés de morrer…)." traz uma descrição, não um rank ou valor curto.
  if (value && value[2].trim().split(/\s+/).length > 4) { nome = value[1]; notas = [value[2].trim(), notas].filter(Boolean).join('\n'); }
  else if (value) { nome = value[1]; valor = value[2]; }
  return { nome: clip(nome.trim(), 120, state), valor: clip(valor.trim(), 120, state), notas: clip(notas.trim(), RPG_NOTES_LIMIT, state) };
}
function inventoryItem(item: string, local: RpgInventoryEntry['local'], state: ClipState): RpgInventoryEntry {
  let nome = item, quantidade = '', rank = '', notas = '';
  // "[Rank D]" em qualquer lugar ou "(D)" no fim do nome, como em "Adaga da Crença (Lhudya) (D)".
  const rankMatch = nome.match(/\s*[([]\s*rank\s+([^)\]]+)[)\]]/i) ?? nome.match(/\s+\((F|E|D|C|B|A|S|SS|Z|M)\)\s*$/);
  if (rankMatch) { rank = rankMatch[1]; nome = nome.replace(rankMatch[0], ''); }
  const note = nome.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (note) { nome = note[1]; notas = note[2]; }
  const labelled = nome.match(/^([^:]+):\s*(.+)$/);
  if (labelled) {
    nome = labelled[1];
    if (/^\d+$/.test(labelled[2].trim())) quantidade = labelled[2]; else notas = [labelled[2], notas].filter(Boolean).join(' — ');
  }
  const amount = nome.match(/^(\d+)\s*[x×]?\s+(\D.*)$/i) ?? nome.match(/^(.+?)\s*[x×]\s*(\d+)$/i) ?? nome.match(/^(.+?)\s*\((\d+)\)$/);
  if (amount) {
    const leading = /^\d+$/.test(amount[1]);
    quantidade = leading ? amount[1] : amount[2]; nome = leading ? amount[2] : amount[1];
  }
  return {
    nome: clip(nome.trim(), 120, state), quantidade: clip(quantidade.trim(), 120, state), rank: clip(rank.trim(), 120, state),
    local, notas: clip(notas.trim(), RPG_NOTES_LIMIT, state)
  };
}

interface TextTarget { kind: 'text'; append: (line: string) => void }
/**
 * Lista em bloco (características, habilidades, feitos, títulos, inventário): as linhas mais
 * recuadas que o rótulo da lista são itens, e o que vem recuado abaixo de um item são as notas dele.
 */
/** `step`: quanto o primeiro filho é mais recuado que a linha. */
interface LineShape { children: boolean; group: boolean; leaf: boolean; step: number }
/**
 * `flat`: linha sem recuo maior que o rótulo (texto colado, sem a estrutura do Notion). Logo
 * abaixo de um item com título, frases e "Rótulo: valor" são notas dele, não itens novos.
 */
interface Block {
  depth: number; line: (text: string, depth: number, shape: LineShape) => void; flat: (text: string) => void;
  /** Há um item com título recebendo notas em texto sem recuo. */
  open: () => boolean;
}
interface ListTarget { kind: 'list'; add: (item: string) => void; block?: Block }
type Target = TextTarget | ListTarget | null;
/** Rótulos que, dentro de outra lista em bloco, começam a sua própria lista ("Feitos" dentro de "Conquistas"). */
const BLOCK_LISTS = new Set(['feitos', 'feito', 'titulos', 'titulo', 'caracteristicas']);

/**
 * Título de item: tem conteúdo logo abaixo e pouco mais recuado (não uma célula centralizada de
 * tabela lá à direita), é curto, não termina como frase e não é um campo "Rótulo: valor".
 */
const headingLike = (text: string, shape: LineShape): boolean => shape.children && shape.step <= 8 && text.length <= 90
  && !/[.:;,]$/.test(text) && !/^[^:]{1,40}:\s/.test(text);

/** Nome do arquivo sem extensão e sem o código que o Notion acrescenta na exportação. */
const fileStem = (name: string): string => name.replace(/\.[^.]+$/, '').replace(/\s+[0-9a-f]{32}$/i, '').trim();

export interface CharacterTextOptions {
  /** Falso quando a origem não preserva o riscado (PDF): o bloqueio das estatísticas fica como no padrão. */
  strikethrough?: boolean;
}

export function readCharacterText(source: string, fileName = '', options: CharacterTextOptions = {}): CharacterTextReading {
  const character = newCharacter();
  const rpg = character.rpg as RpgSheet;
  const state: ClipState = { trimmed: false, fields: [] };
  const recognized = new Set<string>();
  const unrecognized: string[] = [];
  let section: Section = '';
  let target: Target = null;
  let skill: RpgSkill | null = null;
  let table: { kind: 'status' | 'acoes'; columns: string[] } | null = null;
  let title = '';
  // Linha em leitura e o seu recuo (as células de uma tabela herdam os da linha).
  let lineIndex = -1, lineDepth = 0;
  const notes: string[] = [];
  const mark = (name: string): void => { recognized.add(name); };
  const report = (name: string): void => { if (unrecognized.length < 8 && !unrecognized.includes(name)) unrecognized.push(name); };

  /** Campo de texto que continua nas linhas seguintes (história, efeitos, extra…). */
  const longText = (name: string, max: number, read: () => string, write: (value: string) => void, first: string): Target => {
    const put = (line: string): void => {
      const current = read();
      write(clip(current ? `${current}\n${line}` : line, max, state, name));
      if (line.trim()) mark(name);
    };
    if (!placeholder(first)) put(first);
    return { kind: 'text', append: put };
  };
  const appendNote = (item: { nome: string; notas: string }, text: string): void => {
    item.notas = clip(item.notas ? `${item.notas}\n${text}` : text, RPG_NOTES_LIMIT, state, item.nome);
  };
  /** Lista em bloco a partir da linha de recuo `depth`; `create` devolve o item criado (ou null). */
  const blockOf = (depth: number, create: (text: string) => { nome: string; notas: string } | null): Block => {
    let item: { nome: string; notas: string } | null = null, itemDepth = -1;
    let titled: { nome: string; notas: string } | null = null;
    let group: { name: string; depth: number } | null = null;
    return {
      depth,
      line(text, lineDepth, shape) {
        const heading = headingLike(text, shape);
        if (item && lineDepth > itemDepth && !heading) {
          // "???" de títulos ainda ocultos não são anotações.
          if (!placeholder(text)) appendNote(item, text);
          return;
        }
        item = null;
        if (group && lineDepth <= group.depth) group = null;
        const name = uncount(text).replace(/:$/, '');
        // "Conquistas" dentro de "Títulos" é só o nome da seção, não um item.
        if (shape.children && SECTIONS[key(name)]) return;
        if (shape.group && !shape.leaf && heading) {
          // Grupos sem texto próprio, como "Aura" ou "Selos 2/3", dão nome aos itens de dentro.
          group = placeholder(name) ? null : { name, depth: lineDepth };
          return;
        }
        const named = (part: string): string => group ? `${group.name} · ${part}` : part;
        if (shape.children) {
          item = create(named(text));
          itemDepth = lineDepth;
        } else splitItems(text, true).forEach(part => { create(named(part)); });
        titled = null;
      },
      open: () => titled !== null,
      flat(text) {
        // Marcações como "[Evo. 9]" ou "(Lhudya)" não contam como pontuação de frase.
        const sentence = /[.!?…:]$/.test(text) || /[.!?]\s/.test(text.replace(/\[[^\]]*\]|\([^)]*\)/g, '')) || text.length > 90 || text.split(/\s+/).length > 10
          || /^[^:]{1,40}:\s*\S/.test(text);
        if (titled && sentence) {
          if (!placeholder(text)) appendNote(titled, text);
          return;
        }
        item = null;
        // Só um título (sem "Rótulo:") pode receber as notas das linhas seguintes.
        const parts = sentence ? [text] : splitItems(text);
        let last: { nome: string; notas: string } | null = null;
        parts.forEach(part => { last = create(part); });
        titled = parts.length === 1 && !/^[^:]{1,40}:/.test(text) ? last : null;
      }
    };
  };
  const listOf = (name: string, list: RpgEntry[], first: string, limit = RPG_LIST_LIMIT, block = false): Target => {
    const make = (item: string): RpgEntry | null => {
      if (placeholder(item)) return null;
      if (list.length >= limit) { state.trimmed = true; return null; }
      const made = entry(item, state);
      list.push(made); mark(name);
      return made;
    };
    const add = (item: string): void => { make(item); };
    splitItems(first).forEach(add);
    return { kind: 'list', add, block: block ? blockOf(lineDepth, make) : undefined };
  };
  /** História escrita direto na seção, sem "Jornada:": vai para a Jornada e continua na História livre. */
  const storyText = (): Target => {
    // Quando a Jornada enche, todo o resto segue na História livre, sem voltar e inverter a ordem.
    let overflow = false;
    return {
      kind: 'text',
      append(line) {
        const add = (current: string): string => current ? `${current}\n${line}` : line;
        if (!overflow && add(rpg.historia.jornada).length <= 6000) rpg.historia.jornada = add(rpg.historia.jornada);
        else {
          overflow = true;
          character.identidade.historia = clip(add(character.identidade.historia), 6000, state, 'História');
        }
        if (line.trim()) mark('Jornada');
      }
    };
  };
  const shortText = (name: string, value: string, write: (value: string) => void, max = 120): void => {
    const clean = uncount(value);
    if (placeholder(clean)) return;
    write(clip(clean, max, state)); mark(name);
  };
  const count = (name: string, value: string, write: (value: number) => void): void => {
    const number = parseCount(value);
    if (number !== null) { write(number); mark(name); }
  };
  const appendSkill = (slot: 'complementar', text: string): void => {
    if (!skill) return;
    skill[slot] = clip(skill[slot] ? `${skill[slot]}\n${text}` : text, 1000, state);
    mark('Perícias');
  };
  const newSkill = (heading: string): void => {
    const etapa = heading.match(/\[\s*etapa\s*([^\]]*)\]/i)?.[1] ?? '';
    const grau = heading.match(/\[\s*grau\s*([^\]]*)\]/i)?.[1] ?? '';
    // Marcações das fichas novas, como [Tier 1] [Xp 85,7/250], ficam no Complementar.
    const extras = [...heading.matchAll(/\[\s*(tier|xp)\s*([^\]]*)\]/gi)].filter(m => !placeholder(m[2]))
      .map(m => `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}: ${m[2].trim()}`);
    const nome = heading.replace(/\[[^\]]*\]/g, '').trim();
    skill = {
      nome: clip(nome, 120, state), etapa: placeholder(etapa) ? '' : clip(etapa.trim(), 120, state),
      grau: placeholder(grau) ? '' : clip(grau.trim(), 120, state), execucao: '', tipo: '',
      efeito: '', condicao: '', complementar: clip(extras.join('\n'), 1000, state), fundamentos: ''
    };
    if (rpg.pericias.length >= RPG_LIST_LIMIT) { state.trimmed = true; return; }
    rpg.pericias.push(skill);
    target = null;
  };

  function field(label: string, value: string): boolean {
    const name = key(label);
    const plain = uncount(value);
    switch (section === 'pericias' && skill ? `pericia:${name}` : name) {
      case 'nome': case 'nome do personagem': case 'personagem':
        shortText('Nome', value, v => { character.identidade.nome = v; }, 160); return true;
      case 'jogador': case 'jogadora':
        shortText('Jogador', value, v => { character.identidade.jogador = v; }, 160); return true;
      case 'campanha': shortText('Campanha', value, v => { character.identidade.campanha = v; }, 160); return true;
      case 'conceito': shortText('Conceito', value, v => { character.identidade.conceito = v; }, 160); return true;
      case 'origem': shortText('Origem', value, v => { character.identidade.origem = v; }, 160); return true;
      case 'idade': {
        // "3 Dias (26 Anos)": vale a idade em anos quando ela aparece.
        const years = value.match(/(\d+(?:[.,]\d+)?)\s*anos?\b/i);
        const age = parseNumber(years ? years[1] : value);
        if (age !== null && age >= 0) { rpg.descricao.idade = age; mark('Idade'); }
        return true;
      }
      case 'sexo': shortText('Sexo', value, v => { rpg.descricao.sexo = v; }); return true;
      case 'raca': shortText('Raça', value, v => { rpg.descricao.raca = v; }); return true;
      case 'altura': shortText('Altura', value, v => { rpg.descricao.altura = v; }); return true;
      case 'peso': shortText('Peso', value, v => { rpg.descricao.peso = v; }); return true;
      case 'extra':
        target = longText('Extra', 1000, () => rpg.descricao.extra, v => { rpg.descricao.extra = v; }, plain); return true;
      case 'aparencia': {
        // "9 [Elegante]": o número é a Aparência e o texto entre colchetes, a estética.
        const number = /^\s*\d*d\d+/i.test(plain) ? null : parseNumber(plain);
        if (number !== null) { rpg.descricao.aparencia = number; mark('Aparência'); }
        const style = plain.match(/\[([^\]]+)\]/)?.[1] ?? (number === null && !/^\s*\d*d\d+/i.test(plain) ? plain : '');
        if (style && !style.includes('…') && !placeholder(style)) { rpg.descricao.estetica = clip(style.trim(), 1000, state); mark('Estética'); }
        return true;
      }
      case 'estetica':
        target = longText('Estética', 1000, () => rpg.descricao.estetica, v => { rpg.descricao.estetica = v; }, plain); return true;
      case 'arquetipo': {
        const wanted = key(plain).split(' ')[0];
        const archetype = plain.includes('/') ? undefined : ARCHETYPES.find(a => key(a.nome) === wanted || a.id === wanted);
        if (archetype) { rpg.arquetipo = archetype.id; mark('Arquétipo'); }
        // Arquétipo fora do Livro de Regras ("Neutro", "Pilarasdaar") fica registrado como está.
        else if (!plain.includes('/') && !placeholder(plain)) shortText('Arquétipo', plain, v => { rpg.arquetipo = v; });
        target = null; return true;
      }
      case 'rank': shortText('Rank', value, v => { rpg.progressao.rank = v; }); return true;
      // Nível e status total são calculados pelos modificadores das estatísticas; o texto não os guarda.
      case 'nivel': case 'status total': case 'existencia': return true;
      case 'avancos': case 'avanco': count('Avanços', value, v => { rpg.progressao.avancos = v; }); return true;
      case 'ascensoes': case 'ascensao': count('Ascensões', value, v => { rpg.progressao.ascensoes = v; }); return true;
      case 'pontos evolutivos': {
        const number = parseNumber(value);
        if (number !== null && number >= 0) { rpg.progressao.pontosEvolutivos = number; mark('Pontos evolutivos'); }
        return true;
      }
      case 'classe': case 'classes': target = listOf('Classe', rpg.progressao.classes, plain); return true;
      case 'sub classe': case 'subclasse': case 'sub classes': case 'subclasses':
        target = listOf('Subclasse', rpg.progressao.subclasses, plain); return true;
      case 'estilo de combate': case 'estilos de combate': case 'estilo': case 'estilos':
        target = listOf('Estilo de combate', rpg.progressao.estilos, plain); return true;
      case 'talento': case 'talentos': target = listOf('Talento', rpg.progressao.talentos, plain); return true;
      case 'pilar':
        if (section === 'elementos') shortText('Pilar elemental', value, v => { rpg.elementos.pilar = v; });
        else shortText('Pilar', value, v => { rpg.progressao.pilar = v; });
        return true;
      case 'alma':
        if (key(plain) !== '1d4 e roleta') shortText('Alma', value, v => { rpg.elementos.alma = v; });
        return true;
      case 'proficiencia': case 'proficiencias': case 'proficiencia elemental':
        target = listOf('Proficiências', rpg.elementos.proficiencias, plain); return true;
      case 'elementario': shortText('Elementário', value, v => { rpg.elementos.elementario = v; }); return true;
      case 'extus':
        target = longText('Extus', 1000, () => rpg.elementos.extus, v => { rpg.elementos.extus = v; }, plain); return true;
      case 'runa': case 'runas': target = listOf('Runas', rpg.elementos.runas, plain); return true;
      case 'etereos': case 'elementos etereos': case 'eterios': case 'elementos eterios':
        target = listOf('Elementos etéreos', rpg.elementos.etereos, plain); return true;
      case 'estado': case 'estado atual': {
        const chosen = choice(plain, RPG_STATES);
        if (chosen) { rpg.estado = chosen; mark('Estado'); }
        else if (!plain.includes('/') && !placeholder(plain)) shortText('Estado', plain, v => { rpg.estado = v; });
        return true;
      }
      case 'defesa f': case 'defesa fisica': case 'defesa m': case 'defesa mental':
      case 'defesa e': case 'defesa energetica': case 'defesa geral': case 'defesa g': case 'defesas': {
        // "Defesas: 60 ; 60…" de um item do inventário (armadura, amuleto) é nota do item.
        if (section === 'inventario') return false;
        const slot = name === 'defesas' ? 'geral'
          : ({ f: 'fisica', fisica: 'fisica', m: 'mental', mental: 'mental', e: 'energetica', energetica: 'energetica', geral: 'geral', g: 'geral' } as const)[name.slice(7) as 'f'];
        if (!/^0\s*\+\s*\(\s*\?\s*\)$/.test(plain)) shortText('Defesas', value, v => { rpg.defesas[slot] = v; }, 1000);
        return true;
      }
      case 'efeito 1': case 'primeiro efeito':
        target = longText('Efeitos', 1000, () => rpg.efeitos.primeiro, v => { rpg.efeitos.primeiro = v; }, plain); return true;
      case 'efeito resumo': case 'resumo dos efeitos':
        target = longText('Efeitos', 1000, () => rpg.efeitos.resumo, v => { rpg.efeitos.resumo = v; }, plain); return true;
      case 'acesso rapido': case 'mochila': case 'base': case 'perdido': case 'outros': {
        if (section !== 'inventario') return false;
        const local = choice(label.trim(), INVENTORY_LOCATIONS) ?? 'Outros';
        // A observação do modelo ("Por Historia (… vai de acordo com o Mestre)") não é item; um número
        // sozinho antes de um item é a quantidade dele.
        let note = false, quantity = '';
        const make = (raw: string): RpgInventoryEntry | null => {
          let item = raw;
          if (note || key(item).startsWith('por historia')) {
            const end = item.search(/mestre\s*\)/i);
            note = end < 0;
            item = end < 0 ? '' : item.slice(end).replace(/^mestre\s*\)/i, '').trim();
          }
          if (placeholder(item)) return null;
          if (/^\d+$/.test(item)) { quantity = item; return null; }
          if (rpg.inventario.length >= RPG_INVENTORY_LIMIT) { state.trimmed = true; return null; }
          const made = inventoryItem(item, local, state);
          if (quantity && !made.quantidade) made.quantidade = quantity;
          quantity = '';
          rpg.inventario.push(made); mark('Inventário');
          return made;
        };
        splitItems(plain).forEach(item => { make(item); });
        target = { kind: 'list', add: item => { make(item); }, block: blockOf(lineDepth, make) }; return true;
      }
      case 'feitos': case 'feito': target = listOf('Feitos', rpg.feitos, plain, RPG_LIST_LIMIT, true); return true;
      case 'titulos': case 'titulo': target = listOf('Títulos', rpg.titulos, plain, RPG_LIST_LIMIT, true); return true;
      case 'caracteristicas': target = listOf('Características', rpg.caracteristicas, plain, RPG_LIST_LIMIT, true); return true;
      case 'jornada':
        target = longText('Jornada', 6000, () => rpg.historia.jornada, v => { rpg.historia.jornada = v; }, plain); return true;
      case 'aprendizado':
        target = longText('Aprendizado', 6000, () => rpg.historia.aprendizado, v => { rpg.historia.aprendizado = v; }, plain); return true;
      case 'historia':
        target = longText('História', 6000, () => character.identidade.historia, v => { character.identidade.historia = v; }, plain); return true;
      case 'notas': case 'anotacoes':
        target = longText('Anotações', 6000, () => character.identidade.notas, v => { character.identidade.notas = v; }, plain); return true;
      case 'pericia:etapa': shortText('Perícias', value, v => { skill!.etapa = v; }); return true;
      case 'pericia:grau': shortText('Perícias', value, v => { skill!.grau = v; }); return true;
      case 'pericia:execucao': case 'pericia:regente': {
        const chosen = choice(plain, SKILL_EXECUTIONS);
        if (chosen) { skill!.execucao = chosen; mark('Perícias'); }
        return true;
      }
      case 'pericia:tipo': case 'pericia:classe': {
        const chosen = choice(plain, SKILL_TYPES);
        if (chosen) { skill!.tipo = chosen; mark('Perícias'); }
        return true;
      }
      case 'pericia:criterio':
        // Campo das fichas novas sem lugar próprio: fica no Complementar, com o nome.
        if (!placeholder(plain)) appendSkill('complementar', `Critério: ${plain}`);
        target = null; return true;
      case 'pericia:efeito': case 'pericia:buffs': case 'pericia:buff':
      case 'pericia:condicao': case 'pericia:complementar': case 'pericia:fundamentos': {
        const slot = (name.startsWith('buff') ? 'efeito' : name) as 'efeito' | 'condicao' | 'complementar' | 'fundamentos';
        const current = skill!;
        target = longText('Perícias', 1000, () => current[slot], v => { current[slot] = v; }, plain); return true;
      }
      default: return false;
    }
  }

  const statIds = new Map((Object.entries(RPG_STATS) as [StatId, string][]).map(([id, label]) => [key(label), id]));
  const actionIds = new Map((Object.entries(RPG_ACTIONS) as [ActionId, string][]).map(([id, label]) => [key(label), id]));
  // Nomes das fichas novas: Pensamento é a ação Mental e Comunicação, a de Expressão.
  actionIds.set('pensamento', 'mental'); actionIds.set('comunicacao', 'expressao');
  /** Lê uma linha das tabelas de Status ou Ações; devolve falso quando a linha não pertence a nenhuma delas. */
  function tableRow(cells: string[], raw: string[]): boolean {
    const first = key(cells[0] ?? '');
    if (first === 'status' || first === 'estatistica' || first === 'estatisticas') { table = { kind: 'status', columns: cells.map(key) }; return true; }
    if (first === 'tipos de acao' || first === 'acao' && cells.some(c => key(c) === 'usos')) { table = { kind: 'acoes', columns: cells.map(key) }; return true; }
    if (cells.every(c => /^:?-{3,}:?$/.test(c) || !c)) return true;
    if (!table) return false;
    const column = (...names: string[]): string => {
      const index = table!.columns.findIndex(c => names.includes(c));
      return index >= 0 ? cells[index] ?? '' : '';
    };
    if (table.kind === 'status') {
      const name = cells[0].match(/^([^()]+)/)?.[1] ?? '';
      const id = statIds.get(key(name));
      if (!id) return true;
      const stat = rpg.estatisticas[id];
      // Fichas novas têm a coluna VALOR; nas antigas o valor vem entre parênteses ("Força (12)").
      // Com a coluna VALOR, um número entre parênteses ("Força (0,005)") é o talento da fórmula;
      // em qualquer ficha, letras ("Força (E)") são o rank da estatística.
      const valueColumn = table.columns.includes('valor');
      const beside = cells[0].match(/\(([^)]*)\)/)?.[1]?.trim() ?? '';
      const besideNumber = parseNumber(beside);
      const valor = parseNumber(valueColumn ? column('valor') : besideNumber !== null ? beside : '');
      if (valor !== null) stat.valor = valor;
      if (valueColumn && besideNumber !== null) stat.talento = besideNumber;
      if (besideNumber === null && !placeholder(beside)) stat.rank = clip(beside, 120, state);
      const critical = parseNumber(column('cri', 'crit', 'critico', 'criticos'));
      if (critical !== null) stat.critico = critical;
      const [modifier, limit = ''] = column('mod', 'modificador').split('/');
      const mod = parseNumber(modifier ?? '');
      if (mod !== null) stat.modificador = mod;
      if (!placeholder(limit)) stat.limite = clip(limit.trim(), 120, state);
      const alt = column('alt', 'alteracao');
      if (!placeholder(alt)) stat.alteracao = clip(alt, 120, state);
      const dr = parseCount(column('dr', 'drs'));
      if (dr !== null) stat.dr = dr;
      const talent = parseNumber(column('talento', 'tal', 'talentos'));
      if (talent !== null) stat.talento = talent;
      // No modelo, estatísticas riscadas (~~Poder~~) ainda não foram desbloqueadas.
      if (options.strikethrough !== false) stat.desbloqueada = !/~~/.test(raw[0] ?? '');
      mark('Status');
    } else {
      const id = actionIds.get(key(cells[0]));
      if (!id) return true;
      const action = rpg.acoes[id];
      const uses = column('usos').match(/^\s*(\d+)\s*\/\s*(\d+)/);
      if (uses) { action.atual = Number(uses[1]); action.maximo = Number(uses[2]); }
      const mvs = parseCount(column('mvs', 'mv')), dr = parseCount(column('drs', 'dr'));
      if (mvs !== null) action.mvs = mvs;
      if (dr !== null) action.dr = dr;
      mark('Ações');
    }
    return true;
  }

  const sourceLines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const depthOf = (line: string): number => line.match(/^[ \t]*/)![0].replace(/\t/g, '    ').length;
  // Estrutura pelo recuo: a linha tem filhos (a próxima com texto é mais recuada), é um grupo
  // (algum filho direto também tem filhos, como "Aura" > "Cópia de Mentalidade" > descrição) e
  // tem texto próprio (algum filho direto sem filhos).
  const lineShape: LineShape[] = sourceLines.map(() => ({ children: false, group: false, leaf: false, step: 0 }));
  {
    const parents: number[] = sourceLines.map(() => -1);
    const open: number[] = [];
    let previous = -1;
    sourceLines.forEach((line, i) => {
      if (!line.trim()) return;
      const depth = depthOf(line);
      if (previous >= 0 && depth > depthOf(sourceLines[previous])) {
        lineShape[previous].children = true;
        lineShape[previous].step = depth - depthOf(sourceLines[previous]);
      }
      while (open.length && depthOf(sourceLines[open[open.length - 1]]) >= depth) open.pop();
      parents[i] = open.length ? open[open.length - 1] : -1;
      open.push(i); previous = i;
    });
    lineShape.forEach((shape, i) => {
      if (parents[i] < 0 || !sourceLines[i].trim()) return;
      const text = sourceLines[i].trim().replace(/^(?:[-*•+]|\d+[.)])\s+/, '').replace(/\*\*|~~/g, '');
      if (headingLike(text, shape)) lineShape[parents[i]].group = true;
      else lineShape[parents[i]].leaf = true;
    });
  }
  // "Nome: atual/máximo"; os quatro principais têm lugar próprio e os outros ("Energia C.") são recursos extras.
  const resource = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .]{0,29}?)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/g;
  const mainResource = (name: string): ResourceId | null => {
    const id = key(name) === 'vitalidade' ? 'vida' : key(name);
    return id in RPG_RESOURCES ? id as ResourceId : null;
  };
  function readLine(rawLine: string): void {
    const trimmed = rawLine.trim();
    if (section === 'anotacoes' && !/^={3,}$/.test(trimmed)) {
      // Anotações são livres: guardam o texto como está, sem as linhas de referência do modelo
      // (campos vazios, listas de opções "A / B / C" e o molde de perícia).
      const noteKey = key(trimmed);
      const noteValue = trimmed.match(/^[^:]{1,40}:\s*(.*)$/)?.[1];
      if (TEMPLATE_NOTES.has(noteKey) || /^pericia etapa/.test(noteKey)
        || noteValue !== undefined && (placeholder(noteValue) || /^[^/]+(\s\/\s[^/]+){2,}$/.test(noteValue))) return;
      if (trimmed || notes.length) notes.push(rawLine.replace(/^\s{0,8}/, ''));
      return;
    }
    if (/^([=_])\1{2,}$|^-{3,}$|^\*{3,}$/.test(trimmed)) {
      target = null; table = null;
      if (trimmed.startsWith('=')) { section = ''; skill = null; }
      return;
    }
    if (trimmed.startsWith('|')) {
      const raw = trimmed.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      if (tableRow(raw.map(cell => cell.replace(/~~/g, '').replace(/\*\*/g, '').trim()), raw)) return;
      const filled = raw.filter(cell => cell.trim());
      // Tabela dentro de um item (custos, membros…): a linha inteira vai para as notas dele.
      if (target?.kind === 'list' && target.block && lineDepth > target.block.depth) {
        if (filled.length) target.block.line(filled.join(' | '), lineDepth, { children: false, group: false, leaf: false, step: 0 });
        return;
      }
      // Outras tabelas (recursos lado a lado num PDF, "Idade | 24" no Word): cada célula vale como uma linha.
      if (filled.length === 2 && !filled[0].includes(':')) readLine(`${filled[0]}: ${filled[1]}`);
      else filled.forEach(readLine);
      return;
    }
    table = null;
    const heading = /^#{1,6}\s/.test(trimmed);
    // Marcadores de lista, negrito e riscado do Markdown/Notion não fazem parte do valor.
    // Inclui os símbolos que o Word grava como marcador (fonte Symbol/Wingdings, como U+F0B7) e o "o" do 2º nível.
    let line = trimmed.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*•+–◦▪▫■□●○‣⁃\uF000-\uF0FF]|\d+[.)]|o(?=\s{2}))\s+(?:\[[ xX]\]\s+)?/, '')
      .replace(/\*\*/g, '').replace(/__/g, '').trim();
    const struck = /^~~.*~~$/.test(line);
    line = line.replace(/~~/g, '').trim();
    if (!line) {
      if (target?.kind === 'text') target.append('');
      return;
    }
    if (section === 'explicacoes') return;
    if (heading && !title && !SECTIONS[key(uncount(line))]) { title = line; return; }
    if (struck && section !== 'status') return;
    if (target?.kind === 'list' && target.block && lineDepth > target.block.depth) {
      const bare = key(uncount(line).replace(/:$/, ''));
      // "Feitos" ou "Títulos" dentro de outra lista começam a própria lista, com o mesmo recuo.
      if (BLOCK_LISTS.has(bare) && !/:\s*\S/.test(line)) { field(bare, ''); return; }
      target.block.line(line, lineDepth, lineShape[lineIndex] ?? { children: false, group: false, leaf: false, step: 0 });
      return;
    }
    const sectionName = SECTIONS[key(uncount(line).replace(/:$/, ''))];
    if (sectionName && !/:\s*\S/.test(line)) {
      section = sectionName; target = null; skill = null;
      if (section === 'caracteristicas') target = listOf('Características', rpg.caracteristicas, '', RPG_LIST_LIMIT, true);
      if (section === 'habilidades') target = listOf('Habilidades', character.secoes.habilidades, '', 50, true);
      if (section === 'historia') target = storyText();
      return;
    }
    // "Vida: 30/50        Energia: 10/10" traz vários recursos na mesma linha.
    // Fora do topo da ficha, "Usos do Selo: 2/3" ou "Durabilidade: 92/100" não são recursos do personagem.
    const resources = section === 'pericias' || section === 'inventario' ? [] : [...line.matchAll(resource)]
      .filter(match => mainResource(match[1]) || section === '' && !SECTIONS[key(match[1])]);
    if (resources.length) {
      for (const match of resources) {
        const amounts = { atual: Number(match[2].replace(',', '.')), maximo: Number(match[3].replace(',', '.')) };
        const id = mainResource(match[1]);
        if (id) rpg.recursos[id] = amounts;
        else if (rpg.recursosExtras.length < RPG_EXTRA_RESOURCE_LIMIT) rpg.recursosExtras.push({ nome: clip(match[1].trim(), 120, state), ...amounts });
        else state.trimmed = true;
        mark('Recursos');
      }
      target = null;
      return;
    }
    if (section === 'pericias' && (/\[\s*(etapa|grau)\b/i.test(line) || !line.includes(':') && target?.kind !== 'text')) {
      newSkill(line); return;
    }
    const labelled = line.match(/^([^:]{1,40}?)\s*:\s*(.*)$/);
    if (labelled) {
      const name = key(labelled[1]);
      // Título de seção com um valor ao lado ("Descrição: Natural", "Status: Adicionar…").
      if (SECTIONS[name] && name !== 'historia' && section !== 'inventario' && !(section === 'pericias' && skill)) {
        section = SECTIONS[name]; target = null; skill = null;
        if (section === 'caracteristicas') target = listOf('Características', rpg.caracteristicas, labelled[2], RPG_LIST_LIMIT, true);
        if (section === 'habilidades') target = listOf('Habilidades', character.secoes.habilidades, labelled[2], 50, true);
        return;
      }
      if (field(labelled[1], labelled[2].trim())) return;
      // Outro local do inventário ("Itens KalLuniA:") fica em "Outros".
      // Já "Material: ??" logo abaixo de um item, em texto sem recuo, é só um detalhe ainda vazio dele.
      if (section === 'inventario' && placeholder(uncount(labelled[2])) && target?.kind === 'list' && lineDepth <= (target.block?.depth ?? 0)) {
        if (target.block?.open() && labelled[2].trim()) return;
        field('Outros', ''); return;
      }
      // Dentro de uma lista ou de um texto longo, "Algo: valor" é conteúdo, não um campo novo.
      if (target?.kind === 'list') { if (target.block) target.block.flat(line); else target.add(line); return; }
      if (target?.kind === 'text') { target.append(line); return; }
      // Na Descrição, outros traços (Pele, Cabelo, Olhos…) completam o Extra.
      if (section === 'descricao' && !placeholder(uncount(labelled[2]))) {
        rpg.descricao.extra = clip(rpg.descricao.extra ? `${rpg.descricao.extra}\n${line}` : line, 1000, state);
        mark('Extra'); return;
      }
      if (name && !RULE_LABELS.has(name) && !placeholder(uncount(labelled[2]))) report(labelled[1].trim());
      target = null;
      return;
    }
    if (target?.kind === 'list') { if (target.block) target.block.flat(line); else splitItems(line).forEach(target.add); }
    else if (target?.kind === 'text') target.append(line);
  }
  sourceLines.forEach((rawLine, index) => {
    lineIndex = index; lineDepth = depthOf(rawLine);
    readLine(rawLine);
  });
  if (notes.length) {
    const text = notes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (text) { character.identidade.notas = clip([character.identidade.notas, text].filter(Boolean).join('\n'), 6000, state); mark('Anotações'); }
  }
  // Perícias do modelo que continuam vazias ("Perícia [Etapa -] [Grau -]") não viram registros.
  rpg.pericias = rpg.pericias.filter(s => !(key(s.nome) === 'pericia' && !s.etapa && !s.grau && !s.execucao && !s.tipo
    && !s.efeito.trim() && !s.condicao.trim() && !s.complementar.trim() && !s.fundamentos.trim()));
  // Textos longos sem as linhas em branco das pontas e sem parágrafos vazios repetidos.
  const tidy = (value: string): string => value.replace(/\n{3,}/g, '\n\n').trim();
  for (const s of rpg.pericias) for (const slot of ['efeito', 'condicao', 'complementar', 'fundamentos'] as const) s[slot] = tidy(s[slot]);
  rpg.historia.jornada = tidy(rpg.historia.jornada); rpg.historia.aprendizado = tidy(rpg.historia.aprendizado);
  character.identidade.historia = tidy(character.identidade.historia);
  rpg.descricao.extra = tidy(rpg.descricao.extra); rpg.descricao.estetica = tidy(rpg.descricao.estetica);
  rpg.elementos.extus = tidy(rpg.elementos.extus);
  // "Quantidade: 40/40" escrito nas notas de um item vira a quantidade dele.
  for (const item of rpg.inventario) {
    const amount = !item.quantidade && item.notas.match(/^Quantidade:\s*(.+)$/im)?.[1].trim();
    if (amount && !placeholder(amount)) item.quantidade = clip(amount, 120, state);
  }
  rpg.efeitos.primeiro = tidy(rpg.efeitos.primeiro); rpg.efeitos.resumo = tidy(rpg.efeitos.resumo);

  if (!character.identidade.nome) {
    const fallback = title || fileStem(fileName);
    if (fallback) character.identidade.nome = clip(fallback, 160, state);
  }
  if (!recognized.size) return { ok: false, problem: 'não encontrei informações de ficha no texto (por exemplo, “Idade: 20” ou “Classe: Guerreiro”).' };
  const reading = readCharacter(JSON.parse(JSON.stringify(character)));
  if (!reading.ok) return reading;
  return { ok: true, character: reading.character, recognized: recognized.size, unrecognized, trimmed: state.trimmed, trimmedFields: state.fields };
}
