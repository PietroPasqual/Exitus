import { normalizeProject } from './project';
import type { Project } from './types';

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
    secoes: { atributos: [], pericias: [], recursos: [], habilidades: [], inventario: [] }, magias: []
  };
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): string => typeof v === 'string' ? v.slice(0, max) : '';
export function normalizeCharacter(raw: unknown): Character | null {
  if (!object(raw) || raw.kind !== 'circulos-rpg-character' || raw.version !== 1
    || !object(raw.identidade) || !object(raw.secoes) || !Array.isArray(raw.magias)) return null;
  const result = newCharacter();
  for (const field of Object.keys(CHARACTER_FIELDS) as CharacterField[]) {
    result.identidade[field] = text(raw.identidade[field], ['historia', 'notas', 'aparencia'].includes(field) ? 6000 : 160);
  }
  for (const section of Object.keys(CHARACTER_SECTIONS) as CharacterSection[]) {
    const rows = raw.secoes[section];
    if (!Array.isArray(rows) || rows.length > 50 || rows.some(r => !object(r))) return null;
    result.secoes[section] = rows.map(r => ({ nome: text(r.nome, 120), valor: text(r.valor, 120), notas: text(r.notas, 1000) }));
  }
  if (raw.magias.length > 20) return null;
  for (const spell of raw.magias) {
    if (!object(spell)) return null;
    const projeto = normalizeProject(spell.projeto);
    if (!projeto) return null;
    result.magias.push({ nome: text(spell.nome, 120) || 'Círculo sem nome', projeto });
  }
  return encodeCharacter(result) === null ? null : result;
}
