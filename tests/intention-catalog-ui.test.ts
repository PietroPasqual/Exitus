// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTENTION_CATALOG } from '../src/core/intention';
import { renderIntentionCatalog, setupIntentionCatalog } from '../src/ui/intention-catalog';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const options = () => [...el('intentionForms').querySelectorAll<HTMLButtonElement>('button')];

beforeEach(() => {
  document.body.innerHTML = `<input id="bondInput"><details id="intentionCatalog">
    <summary id="intentionCount"></summary><p id="intentionCatalogHint"></p>
    <input id="intentionSearch"><div id="intentionForms"></div><p id="intentionMatches"></p>
  </details>`;
  setupIntentionCatalog();
});

describe('Catálogo de formas no editor', () => {
  it('lista as formas sem abrir nem ocupar o inspetor antes da escolha', () => {
    expect(options()).toHaveLength(INTENTION_CATALOG.length);
    expect(el('intentionCount').textContent).toBe('45 formas ilustradas');
    expect(el<HTMLDetailsElement>('intentionCatalog').open).toBe(false);
    expect(el<HTMLInputElement>('bondInput').value).toBe('');
  });

  it('busca por sinônimo, plural e variação de acento', () => {
    const search = el<HTMLInputElement>('intentionSearch');
    for (const [query, form] of [['granadas', 'bomba'], ['DRAGOES', 'dragão'], ['cristais', 'cristal']]) {
      search.value = query;
      search.dispatchEvent(new Event('input'));
      expect(options()).toHaveLength(1);
      expect(options()[0].dataset.intentionWord).toBe(form);
    }
  });

  it('preenche a palavra e dispara feedback sem criar vínculo automaticamente', () => {
    const changed = vi.fn();
    const input = el<HTMLInputElement>('bondInput');
    input.addEventListener('input', changed);
    options().find(button => button.dataset.intentionWord === 'bomba')!.querySelector('strong')!.click();
    expect(input.value).toBe('bomba');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
    expect(el('intentionCatalog').dataset.bound).toBe('false');
  });

  it('permite consultar o catálogo após confirmar, sem mudar a palavra bloqueada', () => {
    const input = el<HTMLInputElement>('bondInput');
    input.value = 'espada';
    renderIntentionCatalog(true);
    expect(options().every(button => button.disabled)).toBe(true);
    options()[0].click();
    expect(input.value).toBe('espada');
    expect(el('intentionCatalogHint').textContent).toContain('Vínculo confirmado');
    renderIntentionCatalog(false);
    expect(options().some(button => button.disabled)).toBe(false);
  });

  it('mantém a busca e o estado vazio como texto seguro', () => {
    el<HTMLInputElement>('intentionSearch').value = '<img src=x onerror=alert(1)>';
    renderIntentionCatalog();
    expect(options()).toHaveLength(0);
    expect(document.querySelector('img')).toBeNull();
    expect(el('intentionMatches').textContent).toContain('palavra livre');
  });
});
