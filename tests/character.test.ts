import { describe, expect, it } from 'vitest';
import { newCharacter, normalizeCharacter } from '../src/core/character';
import { normalizeProject } from '../src/core/project';

describe('Ficha independente de regras', () => {
  it('começa sem atributos ou regras inventadas', () => {
    const c = newCharacter();
    expect(Object.values(c.secoes).every(rows => rows.length === 0)).toBe(true);
    expect(normalizeCharacter(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
  it('preserva valores livres e círculos numa exportação e importação', () => {
    const c = newCharacter();
    c.identidade.nome = 'Lia'; c.identidade.historia = 'Árvore que virou druida';
    c.secoes.recursos.push({ nome: 'Energia', valor: '8 / 12', notas: 'Definido pelo mestre' });
    c.magias.push({ nome: 'Teste', projeto: normalizeProject({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }] })! });
    expect(normalizeCharacter(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });
  it('rejeita projeto de círculo, versão futura e dados incompletos como ficha', () => {
    expect(normalizeCharacter({ nodes: [] })).toBeNull();
    expect(normalizeCharacter({ ...newCharacter(), version: 2 })).toBeNull();
    expect(normalizeCharacter({ ...newCharacter(), secoes: {} })).toBeNull();
  });
  it('limita listas e textos e rejeita círculos inválidos', () => {
    const c = newCharacter(); c.identidade.nome = 'a'.repeat(200);
    expect(normalizeCharacter(c)?.identidade.nome.length).toBe(160);
    c.secoes.atributos = Array(51).fill({ nome: '', valor: '', notas: '' });
    expect(normalizeCharacter(c)).toBeNull();
    expect(normalizeCharacter({ ...newCharacter(), magias: [{ nome: 'x', projeto: {} }] })).toBeNull();
  });
  it('remove propriedades externas sem contaminar protótipos', () => {
    const raw = JSON.parse(JSON.stringify(newCharacter()));
    raw.identidade = JSON.parse('{"nome":"Lia","__proto__":{"admin":true}}');
    expect(normalizeCharacter(raw)?.identidade.nome).toBe('Lia');
    expect(Object.prototype).not.toHaveProperty('admin');
    expect(normalizeCharacter(raw)?.identidade).not.toHaveProperty('admin');
  });
});
