import { normalizeProject } from './project';
import type { Project } from './types';
import { newRpgSheet, normalizeRpgSheet, RPG_NOTES_LIMIT, type RpgSheet } from './rpg-sheet';

export const CHARACTER_KEY = 'circulos-personagem-v1';
export const CHARACTER_FILE_LIMIT = 2_000_000;
export const CHARACTER_SECTIONS = {
  atributos: 'Atributos', pericias: 'Perícias', recursos: 'Recursos',
  habilidades: 'Habilidades', inventario: 'Inventário'
} as const;
export type CharacterSection = keyof typeof CHARACTER_SECTIONS;
export const CHARACTER_FIELDS = {
  nome: 'Nome do personagem', jogador: 'Jogador', campanha: 'Campanha',
  conceito: 'Conceito', origem: 'Origem', aparencia: 'Aparência',
  historia: 'História', notas: 'Anotações da sessão'
} as const;
export type CharacterField = keyof typeof CHARACTER_FIELDS;
export interface CharacterEntry { nome: string; valor: string; notas: string }
export interface Character {
  kind: 'circulos-rpg-character'; version: 1;
  identidade: Record<CharacterField, string>;
  secoes: Record<CharacterSection, CharacterEntry[]>;
  magias: { nome: string; projeto: Project }[];
  rpg?: RpgSheet;
}
/** A mesma representação compacta serve para persistência e backups reimportáveis. */
export function encodeCharacter(character: Character): string | null {
  const json = JSON.stringify(character);
  return new TextEncoder().encode(json).byteLength <= CHARACTER_FILE_LIMIT ? json : null;
}
export function newCharacter(): Character {
  return {
    kind: 'circulos-rpg-character', version: 1,
    identidade: { nome: '', jogador: '', campanha: '', conceito: '', origem: '', aparencia: '', historia: '', notas: '' },
    secoes: { atributos: [], pericias: [], recursos: [], habilidades: [], inventario: [] }, magias: [],
    rpg: newRpgSheet()
  };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): string => typeof v === 'string' ? v.slice(0, max) : '';
export type CharacterReading = { ok: true; character: Character } | { ok: false; problem: string };
/** Valida e limpa uma ficha; quando recusa, explica o motivo em linguagem de jogador. */
export function readCharacter(raw: unknown): CharacterReading {
  const fail = (problem: string): CharacterReading => ({ ok: false, problem });
  if (!object(raw) || raw.kind !== 'circulos-rpg-character') return fail('o arquivo não é uma ficha de personagem deste site.');
  if (raw.version !== 1) {
    return fail(typeof raw.version === 'number' ? `a ficha é da versão ${raw.version}, e este site lê apenas a versão 1.` : 'a versão da ficha não foi informada.');
  }
  if (!object(raw.identidade)) return fail('a identidade do personagem está ausente ou corrompida.');
  if (!object(raw.secoes)) return fail('as seções da ficha estão ausentes ou corrompidas.');
  if (!Array.isArray(raw.magias)) return fail('a lista de círculos está ausente ou corrompida.');
  const result = newCharacter();
  if (Object.prototype.hasOwnProperty.call(raw, 'rpg')) {
    const rpg = normalizeRpgSheet(raw.rpg);
    if (!rpg) return fail('a ficha detalhada (arquétipo, atributos, perícias, inventário…) tem valores fora das regras.');
    result.rpg = rpg;
  } else {
    // Backups anteriores continuam válidos e conservam seu tamanho original.
    delete result.rpg;
  }
  for (const field of Object.keys(CHARACTER_FIELDS) as CharacterField[]) {
    result.identidade[field] = text(raw.identidade[field], ['historia', 'notas', 'aparencia'].includes(field) ? 6000 : 160);
  }
  for (const section of Object.keys(CHARACTER_SECTIONS) as CharacterSection[]) {
    const rows = raw.secoes[section], label = CHARACTER_SECTIONS[section];
    if (!Array.isArray(rows) || rows.some(r => !object(r))) return fail(`a seção “${label}” está ausente ou corrompida.`);
    if (rows.length > 50) return fail(`a seção “${label}” tem ${rows.length} registros; o limite é 50.`);
    result.secoes[section] = rows.map(r => ({ nome: text(r.nome, 120), valor: text(r.valor, 120), notas: text(r.notas, RPG_NOTES_LIMIT) }));
  }
  if (raw.magias.length > 20) return fail(`a ficha tem ${raw.magias.length} círculos; o limite é 20.`);
  for (const [index, spell] of raw.magias.entries()) {
    const projeto = object(spell) ? normalizeProject(spell.projeto) : null;
    if (!object(spell) || !projeto) return fail(`o círculo ${index + 1} está corrompido.`);
    result.magias.push({ nome: text(spell.nome, 120) || 'Círculo sem nome', projeto });
  }
  return encodeCharacter(result) === null ? fail('a ficha passaria de 2 MB depois de verificada.') : { ok: true, character: result };
}
export function normalizeCharacter(raw: unknown): Character | null {
  const reading = readCharacter(raw);
  return reading.ok ? reading.character : null;
}
