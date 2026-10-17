import { ARCHETYPES, type ArchetypeId } from '../data/rpg-archetypes';

export const RPG_STATS = {
  forca: 'Força', constituicao: 'Constituição', destreza: 'Destreza', sentidos: 'Sentidos',
  sabedoria: 'Sabedoria', vontade: 'Vontade', charme: 'Charme', labia: 'Lábia', poder: 'Poder', energia: 'Energia'
} as const;
export const RPG_RESOURCES = { vida: 'Vida', fadiga: 'Fadiga', psicologico: 'Psicológico', energia: 'Energia' } as const;
export const RPG_ACTIONS = { acao: 'Ação', fisica: 'Física', mental: 'Mental', expressao: 'Expressão', energia: 'Energia' } as const;
export const RPG_STATES = ['Natural', 'Antinatural', 'Fragmentado', 'Estilhaçado'] as const;
export const INVENTORY_LOCATIONS = ['Acesso rápido', 'Mochila', 'Base', 'Perdido', 'Outros'] as const;
export const SKILL_EXECUTIONS = ['', 'Consequência', 'Ação', 'Consenso'] as const;
export const SKILL_TYPES = ['', 'Talento', 'Aprendizado', 'Dádiva'] as const;
export const RPG_LIST_LIMIT = 50;
export const RPG_INVENTORY_LIMIT = 100;
/** Limite técnico de armazenamento, sem estabelecer um teto para as regras do mestre. */
export const RPG_NUMBER_LIMIT = 1_000_000_000;
export type StatId = keyof typeof RPG_STATS;
export type ResourceId = keyof typeof RPG_RESOURCES;
export type ActionId = keyof typeof RPG_ACTIONS;
export interface RpgEntry { nome: string; valor: string; notas: string }
export interface RpgStat {
  valor: number; modificador: number; alteracao: string; dr: number; talento: number | null;
  limite: string; desbloqueada: boolean;
}
export interface RpgSkill {
  nome: string; etapa: string; grau: string; execucao: typeof SKILL_EXECUTIONS[number];
  tipo: typeof SKILL_TYPES[number]; efeito: string; condicao: string; complementar: string; fundamentos: string;
}
export interface RpgInventoryEntry {
  nome: string; quantidade: string; rank: string; local: typeof INVENTORY_LOCATIONS[number]; notas: string;
}
export interface RpgSheet {
  version: 1;
  descricao: {
    idade: number | null; sexo: string; raca: string; altura: string; peso: string;
    extra: string; aparencia: number | null; estetica: string;
  };
  arquetipo: ArchetypeId;
  progressao: {
    rank: string; avancos: number; ascensoes: number; existencia: number | null; pontosEvolutivos: number;
    classes: RpgEntry[]; subclasses: RpgEntry[]; estilos: RpgEntry[]; pilar: string; talentos: RpgEntry[];
  };
  elementos: {
    alma: string; almaDado: number | null; proficiencias: RpgEntry[]; elementario: string; pilar: string;
    extus: string; runas: RpgEntry[]; etereos: RpgEntry[];
  };
  estado: typeof RPG_STATES[number];
  estatisticas: Record<StatId, RpgStat>;
  recursos: Record<ResourceId, { atual: number; maximo: number }>;
  defesas: { fisica: string; mental: string; energetica: string; geral: string };
  efeitos: { primeiro: string; resumo: string };
  acoes: Record<ActionId, { atual: number; maximo: number; mvs: number; dr: number }>;
  pericias: RpgSkill[];
  inventario: RpgInventoryEntry[];
  caracteristicas: RpgEntry[];
  feitos: RpgEntry[];
  titulos: RpgEntry[];
  historia: { jornada: string; aprendizado: string };
  calculo: { elemento: number | null };
}

export function newRpgSheet(): RpgSheet {
  const estatisticas = {} as Record<StatId, RpgStat>;
  for (const key of Object.keys(RPG_STATS) as StatId[]) {
    estatisticas[key] = {
      valor: 0, modificador: -20, alteracao: '', dr: 0, talento: null, limite: '',
      desbloqueada: key !== 'poder' && key !== 'energia'
    };
  }
  const acoes = {} as RpgSheet['acoes'];
  for (const key of Object.keys(RPG_ACTIONS) as ActionId[]) acoes[key] = { atual: 1, maximo: 1, mvs: 0, dr: 0 };
  return {
    version: 1,
    descricao: { idade: null, sexo: '', raca: '', altura: '', peso: '', extra: '', aparencia: null, estetica: '' },
    arquetipo: '',
    progressao: {
      rank: '', avancos: 0, ascensoes: 0, existencia: null, pontosEvolutivos: 0,
      classes: [], subclasses: [], estilos: [], pilar: '', talentos: []
    },
    elementos: { alma: '', almaDado: null, proficiencias: [], elementario: '', pilar: '', extus: '', runas: [], etereos: [] },
    estado: 'Natural', estatisticas,
    recursos: {
      vida: { atual: 50, maximo: 50 }, fadiga: { atual: 20, maximo: 20 },
      psicologico: { atual: 10, maximo: 10 }, energia: { atual: 10, maximo: 10 }
    },
    defesas: { fisica: '', mental: '', energetica: '', geral: '' }, efeitos: { primeiro: '', resumo: '' }, acoes,
    pericias: [], inventario: [], caracteristicas: [], feitos: [], titulos: [],
    historia: { jornada: '', aprendizado: '' }, calculo: { elemento: null }
  };
}

class InvalidRpgSheet extends Error {}
type RawRecord = Record<string, unknown>;
function record(value: unknown): RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InvalidRpgSheet();
  return value as RawRecord;
}
function field(value: RawRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  // Campos herdados e getters não fazem parte de uma ficha JSON.
  if (!descriptor || !('value' in descriptor)) throw new InvalidRpgSheet();
  return descriptor.value;
}
function text(value: unknown, maximum = 120): string {
  if (typeof value !== 'string' || value.length > maximum) throw new InvalidRpgSheet();
  return value;
}
function number(value: unknown, minimum = -RPG_NUMBER_LIMIT, maximum = RPG_NUMBER_LIMIT, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum
    || (integer && !Number.isInteger(value))) throw new InvalidRpgSheet();
  return value;
}
function nullableNumber(value: unknown, minimum = -RPG_NUMBER_LIMIT, maximum = RPG_NUMBER_LIMIT): number | null {
  return value === null ? null : number(value, minimum, maximum);
}
function enumeration<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new InvalidRpgSheet();
  return value as T;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new InvalidRpgSheet();
  return value;
}
function list<T>(value: unknown, normalize: (raw: unknown) => T, maximum = RPG_LIST_LIMIT): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new InvalidRpgSheet();
  return Array.from(value, normalize);
}
function entry(raw: unknown): RpgEntry {
  const value = record(raw);
  return { nome: text(field(value, 'nome')), valor: text(field(value, 'valor')), notas: text(field(value, 'notas'), 1000) };
}
function skill(raw: unknown): RpgSkill {
  const value = record(raw);
  return {
    nome: text(field(value, 'nome')), etapa: text(field(value, 'etapa')), grau: text(field(value, 'grau')),
    execucao: enumeration(field(value, 'execucao'), SKILL_EXECUTIONS), tipo: enumeration(field(value, 'tipo'), SKILL_TYPES),
    efeito: text(field(value, 'efeito'), 1000), condicao: text(field(value, 'condicao'), 1000),
    complementar: text(field(value, 'complementar'), 1000), fundamentos: text(field(value, 'fundamentos'), 1000)
  };
}
function inventoryEntry(raw: unknown): RpgInventoryEntry {
  const value = record(raw);
  return {
    nome: text(field(value, 'nome')), quantidade: text(field(value, 'quantidade')), rank: text(field(value, 'rank')),
    local: enumeration(field(value, 'local'), INVENTORY_LOCATIONS), notas: text(field(value, 'notas'), 1000)
  };
}

/** Cópia validada do esquema: nunca corta listas/textos nem aplica regras de arquétipo aos dados salvos. */
export function normalizeRpgSheet(raw: unknown): RpgSheet | null {
  try {
    const value = record(raw);
    if (field(value, 'version') !== 1) return null;
    const descricao = record(field(value, 'descricao'));
    const progressao = record(field(value, 'progressao'));
    const elementos = record(field(value, 'elementos'));
    const estatisticas = record(field(value, 'estatisticas'));
    const recursos = record(field(value, 'recursos'));
    const defesas = record(field(value, 'defesas'));
    const efeitos = record(field(value, 'efeitos'));
    const acoes = record(field(value, 'acoes'));
    const historia = record(field(value, 'historia'));
    const calculo = record(field(value, 'calculo'));
    const result = newRpgSheet();
    result.descricao = {
      idade: nullableNumber(field(descricao, 'idade'), 0), sexo: text(field(descricao, 'sexo')),
      raca: text(field(descricao, 'raca')), altura: text(field(descricao, 'altura')), peso: text(field(descricao, 'peso')),
      extra: text(field(descricao, 'extra'), 1000), aparencia: nullableNumber(field(descricao, 'aparencia')),
      estetica: text(field(descricao, 'estetica'), 1000)
    };
    result.arquetipo = enumeration(field(value, 'arquetipo'), ['', ...ARCHETYPES.map(archetype => archetype.id)]);
    result.progressao = {
      rank: text(field(progressao, 'rank')),
      avancos: number(field(progressao, 'avancos'), 0, RPG_NUMBER_LIMIT, true),
      ascensoes: number(field(progressao, 'ascensoes'), 0, RPG_NUMBER_LIMIT, true),
      existencia: nullableNumber(field(progressao, 'existencia')),
      pontosEvolutivos: number(field(progressao, 'pontosEvolutivos'), 0),
      classes: list(field(progressao, 'classes'), entry), subclasses: list(field(progressao, 'subclasses'), entry),
      estilos: list(field(progressao, 'estilos'), entry), pilar: text(field(progressao, 'pilar')),
      talentos: list(field(progressao, 'talentos'), entry)
    };
    result.elementos = {
      alma: text(field(elementos, 'alma')), almaDado: nullableNumber(field(elementos, 'almaDado'), 1, 4),
      proficiencias: list(field(elementos, 'proficiencias'), entry), elementario: text(field(elementos, 'elementario')),
      pilar: text(field(elementos, 'pilar')), extus: text(field(elementos, 'extus'), 1000), runas: list(field(elementos, 'runas'), entry),
      etereos: list(field(elementos, 'etereos'), entry)
    };
    if (result.elementos.almaDado !== null && !Number.isInteger(result.elementos.almaDado)) return null;
    result.estado = enumeration(field(value, 'estado'), RPG_STATES);
    for (const key of Object.keys(RPG_STATS) as StatId[]) {
      const stat = record(field(estatisticas, key));
      result.estatisticas[key] = {
        valor: number(field(stat, 'valor')), modificador: number(field(stat, 'modificador')),
        alteracao: text(field(stat, 'alteracao')), dr: number(field(stat, 'dr'), 0, RPG_NUMBER_LIMIT, true),
        talento: nullableNumber(field(stat, 'talento')), limite: text(field(stat, 'limite')),
        desbloqueada: boolean(field(stat, 'desbloqueada'))
      };
    }
    for (const key of Object.keys(RPG_RESOURCES) as ResourceId[]) {
      const resource = record(field(recursos, key));
      result.recursos[key] = { atual: number(field(resource, 'atual')), maximo: number(field(resource, 'maximo')) };
    }
    result.defesas = {
      fisica: text(field(defesas, 'fisica'), 1000), mental: text(field(defesas, 'mental'), 1000),
      energetica: text(field(defesas, 'energetica'), 1000), geral: text(field(defesas, 'geral'), 1000)
    };
    result.efeitos = { primeiro: text(field(efeitos, 'primeiro'), 1000), resumo: text(field(efeitos, 'resumo'), 1000) };
    for (const key of Object.keys(RPG_ACTIONS) as ActionId[]) {
      const action = record(field(acoes, key));
      result.acoes[key] = {
        atual: number(field(action, 'atual'), 0, RPG_NUMBER_LIMIT, true), maximo: number(field(action, 'maximo'), 0, RPG_NUMBER_LIMIT, true),
        mvs: number(field(action, 'mvs'), 0, RPG_NUMBER_LIMIT, true), dr: number(field(action, 'dr'), 0, RPG_NUMBER_LIMIT, true)
      };
    }
    result.pericias = list(field(value, 'pericias'), skill);
    result.inventario = list(field(value, 'inventario'), inventoryEntry, RPG_INVENTORY_LIMIT);
    result.caracteristicas = list(field(value, 'caracteristicas'), entry);
    result.feitos = list(field(value, 'feitos'), entry);
    result.titulos = list(field(value, 'titulos'), entry);
    result.historia = { jornada: text(field(historia, 'jornada'), 6000), aprendizado: text(field(historia, 'aprendizado'), 6000) };
    result.calculo = { elemento: nullableNumber(field(calculo, 'elemento')) };
    return result;
  } catch (error) {
    if (error instanceof InvalidRpgSheet) return null;
    throw error;
  }
}

export interface RpgCalculations {
  recursos: Record<ResourceId, number>;
  estatisticas: Record<StatId, { valorDiario: number | null; limiteDeGanho: number | null; valorPorIdade: number | null }>;
  consenso: number | null;
  cadeiaDeSubstancia: number | null;
  energias: { demoniaca: number | null; celeste: number | null; pilar: number | null };
}

/** Somente as equações explícitas da referência; não grava máximos nem converte Valor em MOD. */
export function calculateRpgSheet(sheet: RpgSheet): RpgCalculations {
  const mod = (key: StatId): number => sheet.estatisticas[key].modificador;
  const estatisticas = {} as RpgCalculations['estatisticas'];
  for (const key of Object.keys(RPG_STATS) as StatId[]) {
    const talento = sheet.estatisticas[key].talento;
    const valorDiario = talento === null ? null : 0.04 + talento / 16;
    estatisticas[key] = {
      valorDiario,
      limiteDeGanho: valorDiario === null ? null : valorDiario * 10,
      valorPorIdade: valorDiario === null || sheet.descricao.idade === null ? null : sheet.descricao.idade * 365 * valorDiario
    };
  }
  const existencia = sheet.progressao.existencia;
  const elemento = sheet.calculo.elemento;
  return {
    recursos: {
      vida: (mod('constituicao') + 25) * 5 + 10,
      fadiga: (mod('constituicao') + mod('vontade') + 40) * 3 + 10,
      psicologico: mod('vontade') + 10 + 20,
      energia: (mod('energia') + 20) * 2 + 10
    }, estatisticas,
    consenso: existencia,
    cadeiaDeSubstancia: existencia === null ? null : existencia * (mod('poder') + mod('energia')) / 100,
    energias: {
      demoniaca: elemento === null ? null : (mod('energia') + 20) * 5 + elemento + 30,
      celeste: elemento === null ? null : (mod('energia') + 10) * 2 + elemento + 10,
      pilar: elemento === null ? null : (mod('energia') + 20) * 2 + elemento + 5
    }
  };
}

/** Capacidades de referência. Mudá-las não descarta escolhas já existentes. */
export function rpgCapacities(sheet: RpgSheet): {
  classes: number; subclasses: number; estilos: number; talentos: number; pericias: number; runas: number; proficiencias: number;
} {
  return {
    classes: 1, subclasses: sheet.arquetipo === 'ramo' ? 2 : 1, estilos: 2,
    talentos: sheet.arquetipo === 'tales' ? 5 + sheet.progressao.avancos + sheet.progressao.ascensoes : 1,
    pericias: sheet.arquetipo === 'justo' ? 4 + sheet.progressao.avancos : 3,
    runas: 10, proficiencias: 3
  };
}
