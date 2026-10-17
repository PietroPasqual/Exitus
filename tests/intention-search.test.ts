import { describe, expect, it, vi } from 'vitest';
import { resolveIntentionForm } from '../src/core/intention';
import { searchIntentionCatalog } from '../src/ui/intention-search';

describe('Sugestões de grafia no catálogo de Intenção', () => {
  it.each([
    ['drgao', 'dragao', 'dragão'],
    ['espdaa', 'espada', 'espada'],
    ['relampgo', 'raio', 'relâmpago'],
    ['grnaada', 'bomba', 'granada'],
    ['RELLÂMPGO', 'raio', 'relâmpago']
  ])('sugere %s com alias explícito, sem mudar o reconhecimento da magia', (query, id, alias) => {
    const result = searchIntentionCatalog(query);
    expect(result.suggested).toBe(true);
    expect(result.matches[0]).toMatchObject({ form: { id }, alias });
    expect(result.matches.filter(match => match.form.id === id)).toHaveLength(1);
    expect(resolveIntentionForm(query)).toBeNull();
  });

  it('prioriza correspondências exatas e parciais, com acentos e caixa normalizados', () => {
    const exact = searchIntentionCatalog('  GRANADA  ');
    expect(exact.suggested).toBe(false);
    expect(exact.matches.map(match => match.form.id)).toEqual(['bomba']);
    expect(exact.matches[0].alias).toBe('granada');
    const partial = searchIntentionCatalog('drã');
    expect(partial.suggested).toBe(false);
    expect(partial.matches.some(match => match.form.id === 'dragao')).toBe(true);
    expect(searchIntentionCatalog('').suggested).toBe(false);
  });

  it('respeita a categoria e não substitui uma correspondência direta escondida pelo filtro', () => {
    const matching = searchIntentionCatalog('drgao', 'Natureza e criaturas');
    expect(matching.suggested).toBe(true);
    expect(matching.matches.every(match => match.form.category === 'Natureza e criaturas')).toBe(true);
    expect(searchIntentionCatalog('drgao', 'Armas')).toEqual({ matches: [], suggested: false });
    expect(searchIntentionCatalog('granada', 'Armas')).toEqual({ matches: [], suggested: false });
  });

  it.each(['drg', 'drgo', 'esdaa', 'relmpgo', '1234', '+3000', '-9999', '4espadas', 'drgao verde', 'drgao/espada', '<img src=x>', 'palavralivre', 'zzzzzzzzzz'])('não aproxima consulta curta, distante ou que não seja uma palavra: %s', query => {
    expect(searchIntentionCatalog(query)).toEqual({ matches: [], suggested: false });
  });

  it('limita a quatro opções distintas e mantém uma ordem estável', () => {
    const first = searchIntentionCatalog('coela');
    const second = searchIntentionCatalog('COELA');
    expect(first).toEqual(second);
    expect(first.matches.length).toBeLessThanOrEqual(4);
    expect(new Set(first.matches.map(match => match.form.id)).size).toBe(first.matches.length);
  });

  it('interrompe texto excessivo antes de normalizar ou comparar o catálogo', () => {
    const normalize = vi.spyOn(String.prototype, 'normalize');
    try {
      expect(searchIntentionCatalog('a'.repeat(100_000))).toEqual({ matches: [], suggested: false });
      expect(searchIntentionCatalog('a' + '\u0301'.repeat(100_000))).toEqual({ matches: [], suggested: false });
      expect(normalize).not.toHaveBeenCalled();
      expect(searchIntentionCatalog('x'.repeat(41))).toEqual({ matches: [], suggested: false });
    } finally {
      normalize.mockRestore();
    }
  });
});
