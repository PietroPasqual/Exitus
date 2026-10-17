import { encodeCharacter, normalizeCharacter } from './character';
import type { Character } from './character';

export const CHARACTER_LIBRARY_KEY = 'circulos-personagens-v1';
export const CHARACTER_LIBRARY_LIMIT = 24;
export const CHARACTER_LIBRARY_FILE_LIMIT = 4_000_000;

export interface CharacterRecord { id: string; data: Character }
export interface CharacterLibrary {
  kind: 'circulos-rpg-library'; version: 1;
  characters: CharacterRecord[];
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

export function newCharacterLibrary(): CharacterLibrary {
  return { kind: 'circulos-rpg-library', version: 1, characters: [] };
}

function compactLibrary(library: CharacterLibrary): string | null {
  try {
    const json = JSON.stringify(library);
    return new TextEncoder().encode(json).byteLength <= CHARACTER_LIBRARY_FILE_LIMIT ? json : null;
  } catch {
    return null;
  }
}

/** Importa apenas fichas válidas, sem compartilhar referências com a origem. */
export function normalizeCharacterLibrary(raw: unknown): CharacterLibrary | null {
  if (!object(raw) || raw.kind !== 'circulos-rpg-library' || raw.version !== 1
    || !Array.isArray(raw.characters) || raw.characters.length > CHARACTER_LIBRARY_LIMIT) return null;
  const library = newCharacterLibrary();
  const ids = new Set<string>();
  for (const record of raw.characters) {
    if (!object(record) || !own(record, 'id') || !own(record, 'data')
      || !validId(record.id) || ids.has(record.id)) return null;
    const data = normalizeCharacter(record.data);
    if (!data) return null;
    ids.add(record.id);
    library.characters.push({ id: record.id, data });
  }
  return compactLibrary(library) === null ? null : library;
}

/** Aplica os limites de cada ficha e do conjunto antes de persistir. */
export function encodeCharacterLibrary(library: CharacterLibrary): string | null {
  try {
    const normalized = normalizeCharacterLibrary(library);
    if (!normalized || library.characters.some(record => encodeCharacter(record.data) === null)) return null;
    return compactLibrary(normalized);
  } catch {
    return null;
  }
}

/** Conserva a ficha anterior, incluindo seus círculos, ao iniciar a seleção. */
export function migrateLegacyCharacter(raw: unknown): CharacterLibrary | null {
  const data = normalizeCharacter(raw);
  if (!data) return null;
  return { kind: 'circulos-rpg-library', version: 1, characters: [{ id: 'personagem-importado', data }] };
}
