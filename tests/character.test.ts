import { describe, expect, it } from 'vitest';
import { CHARACTER_FILE_LIMIT, encodeCharacter, newCharacter, normalizeCharacter, readCharacter } from '../src/core/character';
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
  it('explica o motivo de cada recusa na importação', () => {
    const problem = (raw: unknown) => { const r = readCharacter(raw); return r.ok ? '' : r.problem; };
    expect(problem({ nodes: [] })).toContain('não é uma ficha');
    expect(problem({ ...newCharacter(), version: 2 })).toContain('versão 2');
    expect(problem({ ...newCharacter(), magias: undefined })).toContain('círculos');
    const sections = newCharacter() as unknown as { secoes: Record<string, unknown> }; delete sections.secoes.inventario;
    expect(problem(sections)).toContain('“Inventário” está ausente');
    expect(problem({ ...newCharacter(), magias: Array.from({ length: 21 }, () => ({})) })).toContain('21 círculos');
    expect(problem({ ...newCharacter(), magias: [{ nome: 'x', projeto: null }] })).toContain('círculo 1 está corrompido');
    expect(problem({ ...newCharacter(), rpg: { version: 1 } })).toContain('ficha detalhada');
    const ok = readCharacter(JSON.parse(JSON.stringify(newCharacter())));
    expect(ok.ok && ok.character).toEqual(newCharacter());
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
  it('mede o JSON compacto em bytes UTF-8, inclusive texto multibyte', () => {
    const c = newCharacter();
    c.identidade.notas = 'a'.repeat(1_000_000);
    expect(encodeCharacter(c)).toBe(JSON.stringify(c));
    c.identidade.notas = '界'.repeat(1_000_000);
    expect(JSON.stringify(c).length).toBeLessThan(CHARACTER_FILE_LIMIT);
    expect(encodeCharacter(c)).toBeNull();
  });
  it('rejeita a ficha cujo total normalizado ultrapassa o limite', () => {
    const c = newCharacter();
    const projeto = normalizeProject({ nodes: Array.from({ length: 500 }, (_, i) => ({ id: `n${i}`, shape: 'prism', lockedCenter: i === 0, layer: 'x'.repeat(199) })) })!;
    c.magias = Array.from({ length: 20 }, () => ({ nome: 'Círculo', projeto }));
    expect(normalizeCharacter(c)).toBeNull();
  });
});
