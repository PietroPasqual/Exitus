import { describe, expect, it } from 'vitest';
import { newCharacter } from '../src/core/character';
import {
  CHARACTER_LIBRARY_FILE_LIMIT, CHARACTER_LIBRARY_LIMIT, encodeCharacterLibrary,
  migrateLegacyCharacter, newCharacterLibrary, normalizeCharacterLibrary
} from '../src/core/character-library';
import { normalizeProject } from '../src/core/project';

function withHeroes() {
  const library = newCharacterLibrary();
  const first = newCharacter();
  first.identidade.nome = 'Lia';
  first.secoes.recursos.push({ nome: 'Energia', valor: '8 / 12', notas: 'Definido pelo mestre' });
  const second = newCharacter();
  second.identidade.nome = 'Orion';
  library.characters.push({ id: 'lia-1', data: first }, { id: 'orion_2', data: second });
  return library;
}

function largeCharacter() {
  const character = newCharacter();
  const projeto = normalizeProject({ nodes: Array.from({ length: 500 }, (_, i) => ({
    id: `n${i}`, shape: 'prism', lockedCenter: i === 0, layer: '界'.repeat(199)
  })) })!;
  character.magias = Array.from({ length: 2 }, () => ({ nome: 'Círculo', projeto }));
  return character;
}

describe('Seleção de personagens', () => {
  it('permite iniciar e restaurar uma seleção vazia', () => {
    const library = newCharacterLibrary();
    expect(library.characters).toEqual([]);
    expect(normalizeCharacterLibrary(JSON.parse(encodeCharacterLibrary(library)!))).toEqual(library);
  });

  it('preserva duas fichas independentes ao salvar e restaurar', () => {
    const library = withHeroes();
    const restored = normalizeCharacterLibrary(JSON.parse(encodeCharacterLibrary(library)!))!;
    expect(restored).toEqual(library);
    restored.characters[0].data.identidade.nome = 'Lia atualizada';
    restored.characters[0].data.secoes.recursos[0].valor = '5 / 12';
    expect(library.characters[0].data.identidade.nome).toBe('Lia');
    expect(restored.characters[1].data.identidade.nome).toBe('Orion');
    expect(restored.characters[1].data.secoes.recursos).toEqual([]);
  });

  it('rejeita identificadores repetidos, herdados ou impróprios para a seleção', () => {
    const library = withHeroes();
    library.characters[1].id = library.characters[0].id;
    expect(normalizeCharacterLibrary(library)).toBeNull();
    expect(encodeCharacterLibrary(library)).toBeNull();
    for (const id of ['', 'a'.repeat(81), '<script>', 'a/b', 'nome com espaços', 'á']) {
      library.characters = [{ id, data: newCharacter() }];
      expect(normalizeCharacterLibrary(library)).toBeNull();
    }
    library.characters = [Object.assign(Object.create({ id: 'inherited' }), { data: newCharacter() })];
    expect(normalizeCharacterLibrary(library)).toBeNull();
    library.characters = [{ id: 'a'.repeat(80), data: newCharacter() }];
    expect(normalizeCharacterLibrary(library)).not.toBeNull();
  });

  it('rejeita versões, formatos e fichas inválidos sem descartar fichas silenciosamente', () => {
    expect(normalizeCharacterLibrary(newCharacter())).toBeNull();
    expect(normalizeCharacterLibrary({ ...newCharacterLibrary(), version: 2 })).toBeNull();
    expect(normalizeCharacterLibrary({ ...newCharacterLibrary(), characters: {} })).toBeNull();
    const library = withHeroes();
    library.characters[1].data = { ...newCharacter(), magias: [{ nome: 'Quebrada', projeto: {} as never }] };
    expect(normalizeCharacterLibrary(library)).toBeNull();
    expect(encodeCharacterLibrary(library)).toBeNull();
  });

  it('limita a quantidade de personagens e remove propriedades externas', () => {
    const library = newCharacterLibrary();
    library.characters = Array.from({ length: CHARACTER_LIBRARY_LIMIT }, (_, i) => ({ id: `hero-${i}`, data: newCharacter() }));
    expect(normalizeCharacterLibrary(library)?.characters).toHaveLength(CHARACTER_LIBRARY_LIMIT);
    library.characters.push({ id: 'extra', data: newCharacter() });
    expect(normalizeCharacterLibrary(library)).toBeNull();
    const raw = JSON.parse(JSON.stringify(withHeroes()));
    raw.admin = true;
    raw.characters[0].extra = 'ignored';
    expect(normalizeCharacterLibrary(raw)).toEqual(withHeroes());
    expect(Object.prototype).not.toHaveProperty('admin');
  });

  it('conta os bytes UTF-8 de todas as fichas normalizadas, incluindo seus círculos', () => {
    const library = newCharacterLibrary();
    library.characters = Array.from({ length: 5 }, (_, i) => ({ id: `hero-${i}`, data: largeCharacter() }));
    const below = encodeCharacterLibrary(library)!;
    expect(below).not.toBeNull();
    expect(normalizeCharacterLibrary(JSON.parse(below))).toEqual(library);
    library.characters.push({ id: 'hero-5', data: largeCharacter() });
    const json = JSON.stringify(library);
    expect(json.length).toBeLessThan(CHARACTER_LIBRARY_FILE_LIMIT);
    expect(new TextEncoder().encode(json).byteLength).toBeGreaterThan(CHARACTER_LIBRARY_FILE_LIMIT);
    expect(normalizeCharacterLibrary(library)).toBeNull();
    expect(encodeCharacterLibrary(library)).toBeNull();
  });

  it('não permite persistir uma ficha individual acima do limite', () => {
    const library = withHeroes();
    library.characters[0].data.identidade.notas = '界'.repeat(1_000_000);
    expect(encodeCharacterLibrary(library)).toBeNull();
  });

  it('migra a ficha anterior sem perder recursos nem alterar os desenhos dos círculos', () => {
    const legacy = newCharacter();
    legacy.identidade.nome = 'Druida';
    legacy.secoes.habilidades.push({ nome: 'Fotossíntese', valor: '', notas: 'Recupera energia na floresta' });
    legacy.magias.push({ nome: 'Raízes', projeto: normalizeProject({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }] })! });
    const original = JSON.stringify(legacy);
    const migrated = migrateLegacyCharacter(legacy)!;
    expect(migrated.characters).toEqual([{ id: 'personagem-importado', data: legacy }]);
    expect(JSON.stringify(legacy)).toBe(original);
    expect(migrated.characters[0].data).not.toBe(legacy);
    expect(normalizeCharacterLibrary(JSON.parse(encodeCharacterLibrary(migrated)!))).toEqual(migrated);
    expect(migrateLegacyCharacter(null)).toBeNull();
    expect(migrateLegacyCharacter(newCharacterLibrary())).toBeNull();
  });
});
