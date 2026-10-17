// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { intentionFeedback, renderIntentionFeedback } from '../src/ui/intention-feedback';

describe('Feedback da palavra de Intenção', () => {
  it('informa a forma antes de confirmar sem prometer novos elementos', () => {
    expect(intentionFeedback('LANÇA')).toContain('Forma reconhecida: lança.');
    expect(intentionFeedback('LANÇA')).toContain('Mantém os elementos e as propriedades');
    expect(intentionFeedback('escudo', true)).toContain('Forma vinculada: escudo.');
  });

  it('aceita qualquer palavra e limita novos vínculos a um único termo', () => {
    expect(intentionFeedback('  ')).toContain('Escreva uma palavra ou um número');
    expect(intentionFeedback('Kael7')).toContain('formará os caracteres');
    expect(intentionFeedback('cura')).toContain('formará os caracteres');
    expect(intentionFeedback('魔法')).toContain('Caracteres sem glifo');
    expect(intentionFeedback('cura')).not.toContain('Caracteres sem glifo');
    expect(intentionFeedback('lança ou escudo')).toContain('uma única palavra');
    expect(intentionFeedback('lança de fogo', true)).toContain('Vínculo antigo preservado');
  });

  it('explica a quantidade e a amostragem, rejeitando quantidades inválidas', () => {
    expect(intentionFeedback('3')).toContain('Quantidade indicada: 3.');
    expect(intentionFeedback('10000', true)).toContain('Quantidade vinculada: 10000.');
    expect(intentionFeedback('10000')).toContain('até 6 cópias');
    for (const invalid of ['0', '-2', '3,5']) expect(intentionFeedback(invalid)).toContain('inteiro maior que zero');
  });

  it('mantém o feedback como texto seguro em todas as leituras', () => {
    document.body.innerHTML = '<input id="bondInput"><p id="bondPreview" role="status"></p>';
    renderIntentionFeedback('<img src=x onerror=alert(1)> lança');
    const target = document.getElementById('bondPreview')!;
    expect(target.textContent).toContain('uma única palavra');
    expect(target.children).toHaveLength(0);
    const input = document.getElementById('bondInput') as HTMLInputElement;
    expect(input.validity.valid).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    renderIntentionFeedback('espada', true);
    expect(target.textContent).toContain('Forma vinculada: espada.');
    expect(input.validity.valid).toBe(true);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });
});
