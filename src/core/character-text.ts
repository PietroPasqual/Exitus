import { ARCHETYPES } from '../data/rpg-archetypes';
import { newCharacter, readCharacter, type Character } from './character';
import {
  INVENTORY_LOCATIONS, RPG_ACTIONS, RPG_INVENTORY_LIMIT, RPG_LIST_LIMIT, RPG_STATES, RPG_STATS, SKILL_EXECUTIONS, SKILL_TYPES,
  type ActionId, type RpgEntry, type RpgInventoryEntry, type RpgSheet, type RpgSkill, type StatId
} from './rpg-sheet';

/**
 * Lê a ficha escrita em texto no modelo do Livro de Regras (copiada do Notion, exportada em
 * Markdown ou digitada num .txt). É uma leitura tolerante: o que não for reconhecido é
 * listado, e a ficha final passa pela mesma validação de uma importação JSON.
 */
export type CharacterTextReading =
  | { ok: true; character: Character; recognized: number; unrecognized: string[]; trimmed: boolean }
  | { ok: false; problem: string };

type Section = '' | 'descricao' | 'elementos' | 'status' | 'acoes' | 'habilidades' | 'pericias' | 'inventario'
  | 'conquistas' | 'caracteristicas' | 'historia' | 'explicacoes' | 'anotacoes';
const SECTIONS: Record<string, Section> = {
  descricao: 'descricao', elementos: 'elementos', status: 'status', estatisticas: 'status', acoes: 'acoes',
  habilidades: 'habilidades', pericias: 'pericias', inventario: 'inventario', conquistas: 'conquistas',
  caracteristicas: 'caracteristicas', historia: 'historia', explicacoes: 'explicacoes', anotacoes: 'anotacoes'
};

/** Minúsculas, sem acentos nem pontuação: "Sub. Classe" → "sub classe". */
const key = (value: string): string => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const clip = (value: string, max: number, state: { trimmed: boolean }): string => {
  if (value.length <= max) return value;
  state.trimmed = true;
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
const splitItems = (value: string): string[] => value.split(/\s*[,;]\s*/).map(uncount).filter(item => !placeholder(item));
/** "Guerreiro (D)" vira { nome: 'Guerreiro', valor: 'D' }; "Nome — nota" guarda a nota. */
function entry(item: string, state: { trimmed: boolean }): RpgEntry {
  let nome = item, valor = '', notas = '';
  const note = nome.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (note) { nome = note[1]; notas = note[2]; }
  const labelled = nome.match(/^([^:]+):\s*(.+)$/);
  if (labelled) { nome = labelled[1]; valor = labelled[2]; }
  const value = !labelled && nome.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (value) { nome = value[1]; valor = value[2]; }
  return { nome: clip(nome.trim(), 120, state), valor: clip(valor.trim(), 120, state), notas: clip(notas.trim(), 1000, state) };
}
function inventoryItem(item: string, local: RpgInventoryEntry['local'], state: { trimmed: boolean }): RpgInventoryEntry {
  let nome = item, quantidade = '', rank = '', notas = '';
  const rankMatch = nome.match(/\s*[([]\s*rank\s+([^)\]]+)[)\]]/i);
  if (rankMatch) { rank = rankMatch[1]; nome = nome.replace(rankMatch[0], ''); }
  const note = nome.match(/^(.+?)\s+[—–-]\s+(.+)$/);
  if (note) { nome = note[1]; notas = note[2]; }
  const labelled = nome.match(/^([^:]+):\s*(.+)$/);
  if (labelled) {
    nome = labelled[1];
    if (/^\d+$/.test(labelled[2].trim())) quantidade = labelled[2]; else notas = [labelled[2], notas].filter(Boolean).join(' — ');
  }
  const amount = nome.match(/^(\d+)\s*[x×]\s+(.+)$/i) ?? nome.match(/^(.+?)\s*[x×]\s*(\d+)$/i) ?? nome.match(/^(.+?)\s*\((\d+)\)$/);
  if (amount) {
    const leading = /^\d+$/.test(amount[1]);
    quantidade = leading ? amount[1] : amount[2]; nome = leading ? amount[2] : amount[1];
  }
  return {
    nome: clip(nome.trim(), 120, state), quantidade: clip(quantidade.trim(), 120, state), rank: clip(rank.trim(), 120, state),
    local, notas: clip(notas.trim(), 1000, state)
  };
}

interface TextTarget { kind: 'text'; append: (line: string) => void }
interface ListTarget { kind: 'list'; add: (item: string) => void }
type Target = TextTarget | ListTarget | null;

/** Nome do arquivo sem extensão e sem o código que o Notion acrescenta na exportação. */
const fileStem = (name: string): string => name.replace(/\.[^.]+$/, '').replace(/\s+[0-9a-f]{32}$/i, '').trim();

export function readCharacterText(source: string, fileName = ''): CharacterTextReading {
  const character = newCharacter();
  const rpg = character.rpg as RpgSheet;
  const state = { trimmed: false };
  const recognized = new Set<string>();
  const unrecognized: string[] = [];
  let section: Section = '';
  let target: Target = null;
  let skill: RpgSkill | null = null;
  let table: { kind: 'status' | 'acoes'; columns: string[] } | null = null;
  let title = '';
  const notes: string[] = [];
  const mark = (name: string): void => { recognized.add(name); };

  /** Campo de texto que continua nas linhas seguintes (história, efeitos, extra…). */
  const longText = (name: string, max: number, read: () => string, write: (value: string) => void, first: string): Target => {
    const put = (line: string): void => {
      const current = read();
      write(clip(current ? `${current}\n${line}` : line, max, state));
      if (line.trim()) mark(name);
    };
    if (!placeholder(first)) put(first);
    return { kind: 'text', append: put };
  };
  const listOf = (name: string, list: RpgEntry[], first: string, limit = RPG_LIST_LIMIT): Target => {
    const add = (item: string): void => {
      if (placeholder(item)) return;
      if (list.length >= limit) { state.trimmed = true; return; }
      list.push(entry(item, state)); mark(name);
    };
    splitItems(first).forEach(add);
    return { kind: 'list', add };
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
  const newSkill = (heading: string): void => {
    const etapa = heading.match(/\[\s*etapa\s*([^\]]*)\]/i)?.[1] ?? '';
    const grau = heading.match(/\[\s*grau\s*([^\]]*)\]/i)?.[1] ?? '';
    const nome = heading.replace(/\[[^\]]*\]/g, '').trim();
    skill = {
      nome: clip(nome, 120, state), etapa: placeholder(etapa) ? '' : clip(etapa.trim(), 120, state),
      grau: placeholder(grau) ? '' : clip(grau.trim(), 120, state), execucao: '', tipo: '',
      efeito: '', condicao: '', complementar: '', fundamentos: ''
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
        const age = parseNumber(value);
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
        target = null; return true;
      }
      case 'rank': shortText('Rank', value, v => { rpg.progressao.rank = v; }); return true;
      case 'avancos': case 'avanco': count('Avanços', value, v => { rpg.progressao.avancos = v; }); return true;
      case 'ascensoes': case 'ascensao': count('Ascensões', value, v => { rpg.progressao.ascensoes = v; }); return true;
      case 'existencia': {
        const number = parseNumber(value);
        if (number !== null) { rpg.progressao.existencia = number; mark('Existência'); }
        return true;
      }
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
        return true;
      }
      case 'defesa f': case 'defesa fisica': case 'defesa m': case 'defesa mental':
      case 'defesa e': case 'defesa energetica': case 'defesa geral': case 'defesa g': {
        const slot = ({ f: 'fisica', fisica: 'fisica', m: 'mental', mental: 'mental', e: 'energetica', energetica: 'energetica', geral: 'geral', g: 'geral' } as const)[name.slice(7) as 'f'];
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
        const add = (item: string): void => {
          if (placeholder(item) || key(item).startsWith('por historia')) return;
          if (rpg.inventario.length >= RPG_INVENTORY_LIMIT) { state.trimmed = true; return; }
          rpg.inventario.push(inventoryItem(item, local, state)); mark('Inventário');
        };
        splitItems(plain).forEach(add);
        target = { kind: 'list', add }; return true;
      }
      case 'feitos': case 'feito': target = listOf('Feitos', rpg.feitos, plain); return true;
      case 'titulos': case 'titulo': target = listOf('Títulos', rpg.titulos, plain); return true;
      case 'caracteristicas': target = listOf('Características', rpg.caracteristicas, plain); return true;
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
      case 'pericia:execucao': {
        const chosen = choice(plain, SKILL_EXECUTIONS);
        if (chosen) { skill!.execucao = chosen; mark('Perícias'); }
        return true;
      }
      case 'pericia:tipo': {
        const chosen = choice(plain, SKILL_TYPES);
        if (chosen) { skill!.tipo = chosen; mark('Perícias'); }
        return true;
      }
      case 'pericia:efeito': case 'pericia:condicao': case 'pericia:complementar': case 'pericia:fundamentos': {
        const slot = name as 'efeito' | 'condicao' | 'complementar' | 'fundamentos';
        const current = skill!;
        target = longText('Perícias', 1000, () => current[slot], v => { current[slot] = v; }, plain); return true;
      }
      default: return false;
    }
  }

  const statIds = new Map((Object.entries(RPG_STATS) as [StatId, string][]).map(([id, label]) => [key(label), id]));
  const actionIds = new Map((Object.entries(RPG_ACTIONS) as [ActionId, string][]).map(([id, label]) => [key(label), id]));
  function tableRow(cells: string[], raw: string[]): void {
    const first = key(cells[0] ?? '');
    if (first === 'status' || first === 'estatistica' || first === 'estatisticas') { table = { kind: 'status', columns: cells.map(key) }; return; }
    if (first === 'tipos de acao' || first === 'acao' && cells.some(c => key(c) === 'usos')) { table = { kind: 'acoes', columns: cells.map(key) }; return; }
    if (cells.every(c => /^:?-{3,}:?$/.test(c) || !c)) return;
    if (!table) return;
    const column = (...names: string[]): string => {
      const index = table!.columns.findIndex(c => names.includes(c));
      return index >= 0 ? cells[index] ?? '' : '';
    };
    if (table.kind === 'status') {
      const name = cells[0].match(/^([^()]+)/)?.[1] ?? '';
      const id = statIds.get(key(name));
      if (!id) return;
      const stat = rpg.estatisticas[id];
      const valor = parseNumber(cells[0].match(/\(([^)]*)\)/)?.[1] ?? '');
      if (valor !== null) stat.valor = valor;
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
      stat.desbloqueada = !/~~/.test(raw[0] ?? '');
      mark('Status');
    } else {
      const id = actionIds.get(key(cells[0]));
      if (!id) return;
      const action = rpg.acoes[id];
      const uses = column('usos').match(/^\s*(\d+)\s*\/\s*(\d+)/);
      if (uses) { action.atual = Number(uses[1]); action.maximo = Number(uses[2]); }
      const mvs = parseCount(column('mvs', 'mv')), dr = parseCount(column('drs', 'dr'));
      if (mvs !== null) action.mvs = mvs;
      if (dr !== null) action.dr = dr;
      mark('Ações');
    }
  }

  const resource = /(Vida|Fadiga|Psicol[oó]gico|Energia)\s*:\s*(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)/gi;
  const lines = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (section === 'anotacoes' && !/^={3,}$/.test(trimmed)) {
      // Anotações são livres: guardam o texto como está, sem as linhas de referência do modelo.
      if (TEMPLATE_NOTES.has(key(trimmed))) continue;
      if (trimmed || notes.length) notes.push(rawLine.replace(/^\s{0,8}/, ''));
      continue;
    }
    if (/^([=_])\1{2,}$|^-{3,}$|^\*{3,}$/.test(trimmed)) {
      target = null; table = null;
      if (trimmed.startsWith('=')) { section = ''; skill = null; }
      continue;
    }
    if (trimmed.startsWith('|')) {
      const raw = trimmed.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      tableRow(raw.map(cell => cell.replace(/~~/g, '').replace(/\*\*/g, '').trim()), raw);
      continue;
    }
    table = null;
    const heading = /^#{1,6}\s/.test(trimmed);
    // Marcadores de lista, negrito e riscado do Markdown/Notion não fazem parte do valor.
    let line = trimmed.replace(/^#{1,6}\s+/, '').replace(/^(?:[-*•+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
      .replace(/\*\*/g, '').replace(/__/g, '').trim();
    const struck = /^~~.*~~$/.test(line);
    line = line.replace(/~~/g, '').trim();
    if (!line) {
      if (target?.kind === 'text') target.append('');
      continue;
    }
    if (section === 'explicacoes') continue;
    if (heading && !title && !SECTIONS[key(uncount(line))]) { title = line; continue; }
    if (struck && section !== 'status') continue;
    const sectionName = SECTIONS[key(uncount(line).replace(/:$/, ''))];
    if (sectionName && !/:\s*\S/.test(line)) {
      section = sectionName; target = null; skill = null;
      if (section === 'caracteristicas') target = listOf('Características', rpg.caracteristicas, '');
      if (section === 'habilidades') {
        const add = (item: string): void => {
          if (placeholder(item)) return;
          if (character.secoes.habilidades.length >= 50) { state.trimmed = true; return; }
          character.secoes.habilidades.push(entry(item, state)); mark('Habilidades');
        };
        target = { kind: 'list', add };
      }
      continue;
    }
    // "Vida: 30/50        Energia: 10/10" traz vários recursos na mesma linha.
    const resources = section === 'pericias' || section === 'inventario' ? [] : [...line.matchAll(resource)];
    if (resources.length) {
      for (const match of resources) {
        const id = key(match[1]) as 'vida' | 'fadiga' | 'psicologico' | 'energia';
        rpg.recursos[id] = { atual: Number(match[2].replace(',', '.')), maximo: Number(match[3].replace(',', '.')) };
        mark('Recursos');
      }
      target = null;
      continue;
    }
    if (section === 'pericias' && (/\[\s*(etapa|grau)\b/i.test(line) || !line.includes(':') && target?.kind !== 'text')) {
      newSkill(line); continue;
    }
    const labelled = line.match(/^([^:]{1,40}?)\s*:\s*(.*)$/);
    if (labelled) {
      const name = key(labelled[1]);
      if (SECTIONS[name] === 'status' && section !== 'inventario') { section = 'status'; target = null; continue; }
      if (field(labelled[1], labelled[2].trim())) continue;
      // Dentro de uma lista ou de um texto longo, "Algo: valor" é conteúdo, não um campo novo.
      if (target?.kind === 'list') { target.add(line); continue; }
      if (target?.kind === 'text') { target.append(line); continue; }
      if (name && !RULE_LABELS.has(name) && !placeholder(uncount(labelled[2])) && unrecognized.length < 8
        && !unrecognized.includes(labelled[1].trim())) unrecognized.push(labelled[1].trim());
      target = null;
      continue;
    }
    if (target?.kind === 'list') splitItems(line).forEach(target.add);
    else if (target?.kind === 'text') target.append(line);
  }
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
  rpg.efeitos.primeiro = tidy(rpg.efeitos.primeiro); rpg.efeitos.resumo = tidy(rpg.efeitos.resumo);

  if (!character.identidade.nome) {
    const fallback = title || fileStem(fileName);
    if (fallback) character.identidade.nome = clip(fallback, 160, state);
  }
  if (!recognized.size) return { ok: false, problem: 'não encontrei informações de ficha no texto (por exemplo, “Idade: 20” ou “Classe: Guerreiro”).' };
  const reading = readCharacter(JSON.parse(JSON.stringify(character)));
  if (!reading.ok) return reading;
  return { ok: true, character: reading.character, recognized: recognized.size, unrecognized, trimmed: state.trimmed };
}
