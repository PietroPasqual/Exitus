// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTENTION_CATALOG } from '../src/core/intention';
import { renderIntentionCatalog, setupIntentionCatalog } from '../src/ui/intention-catalog';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const options = () => [...el('intentionForms').querySelectorAll<HTMLButtonElement>('button')];
const searchFor = (value: string): void => {
  el<HTMLInputElement>('intentionSearch').value = value;
  el('intentionSearch').dispatchEvent(new Event('input'));
};
const filterBy = (value: string): void => {
  el<HTMLSelectElement>('intentionCategory').value = value;
  el('intentionCategory').dispatchEvent(new Event('change'));
};
let images: Uint8ClampedArray[];
let getContext: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  images = [];
  const context = {
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: (image: ImageData) => images.push(image.data.slice())
  } as unknown as CanvasRenderingContext2D;
  getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  document.body.innerHTML = `<input id="bondInput"><details id="intentionCatalog">
    <summary id="intentionCount"></summary><p id="intentionCatalogHint"></p>
    <input id="intentionSearch"><select id="intentionCategory"></select>
    <div id="intentionForms"></div><p id="intentionMatches"></p>
  </details>`;
  setupIntentionCatalog();
});

describe('Catálogo de formas no editor', () => {
  it('lista as formas recolhidas e adia o desenho até abrir o índice', () => {
    expect(options()).toHaveLength(INTENTION_CATALOG.length);
    expect(el('intentionCount').textContent).toBe(`${INTENTION_CATALOG.length} formas ilustradas`);
    expect(el<HTMLDetailsElement>('intentionCatalog').open).toBe(false);
    expect(el<HTMLInputElement>('bondInput').value).toBe('');
    expect(options().every(button => button.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('desenha silhuetas reais, distintas e com transparência, uma vez por opção', () => {
    const catalog = el<HTMLDetailsElement>('intentionCatalog');
    catalog.open = true;
    catalog.dispatchEvent(new Event('toggle'));
    expect(images).toHaveLength(INTENTION_CATALOG.length);
    expect(images.every(image => image.some((value, i) => i % 4 === 3 && value === 255))).toBe(true);
    expect(images.every(image => image[3] === 0 && image[image.length - 1] === 0)).toBe(true);
    expect(new Set(images.map(image => Array.from(image).join(','))).size).toBe(INTENTION_CATALOG.length);
    renderIntentionCatalog();
    expect(images).toHaveLength(INTENTION_CATALOG.length);
  });

  it('busca por sinônimo, plural e variação de acento e explica o alias encontrado', () => {
    for (const [query, form, alias] of [['granadas', 'bomba', 'granadas'], ['DRAGOES', 'dragão', 'dragões'], ['cristais', 'cristal', 'cristais']]) {
      searchFor(query);
      expect(options()).toHaveLength(1);
      expect(options()[0].dataset.intentionWord).toBe(form);
      expect(options()[0].querySelector('small')!.textContent).toBe(`Também: ${alias}`);
    }
  });

  it('combina categoria com a busca e permite voltar ao catálogo completo', () => {
    const categories = [...new Set(INTENTION_CATALOG.map(form => form.category))];
    expect(el<HTMLSelectElement>('intentionCategory').options.length).toBe(categories.length + 1);
    filterBy('Armas');
    expect(options()).toHaveLength(INTENTION_CATALOG.filter(form => form.category === 'Armas').length);
    searchFor('granada');
    expect(options()).toHaveLength(0);
    expect(el('intentionMatches').textContent).toContain('Nenhuma forma');
    filterBy('');
    expect(options().map(button => button.dataset.intentionWord)).toEqual(['bomba']);
    searchFor('');
    expect(options()).toHaveLength(INTENTION_CATALOG.length);
  });

  it('preenche a palavra e marca a escolha sem vincular automaticamente', () => {
    const changed = vi.fn();
    const input = el<HTMLInputElement>('bondInput');
    input.addEventListener('input', changed);
    const bomb = options().find(button => button.dataset.intentionWord === 'bomba')!;
    bomb.querySelector('canvas')!.click();
    expect(input.value).toBe('bomba');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
    expect(el('intentionCatalog').dataset.bound).toBe('false');
    expect(bomb.getAttribute('aria-pressed')).toBe('true');
    expect(options().filter(button => button.getAttribute('aria-pressed') === 'true')).toHaveLength(1);
    expect(el('intentionCatalogHint').textContent).toBe('«bomba» no campo. Confirme em Vincular.');
  });

  it('acompanha uma palavra digitada ou sinônimo sem forçar uma escolha', () => {
    const input = el<HTMLInputElement>('bondInput');
    input.value = 'GRANADA';
    input.dispatchEvent(new Event('input'));
    expect(options().find(button => button.getAttribute('aria-pressed') === 'true')!.dataset.intentionWord).toBe('bomba');
    input.value = 'palavralivre';
    input.dispatchEvent(new Event('input'));
    expect(options().some(button => button.getAttribute('aria-pressed') === 'true')).toBe(false);
    expect(input.value).toBe('palavralivre');
  });

  it('permite consultar após confirmar e mantém a forma do vínculo bloqueado', () => {
    const input = el<HTMLInputElement>('bondInput');
    input.value = 'espada';
    renderIntentionCatalog(true, 'granada');
    expect(options().every(button => button.disabled)).toBe(true);
    expect(options().find(button => button.getAttribute('aria-pressed') === 'true')!.dataset.intentionWord).toBe('bomba');
    options()[0].click();
    expect(input.value).toBe('espada');
    expect(el('intentionCatalogHint').textContent).toContain('Vínculo confirmado');
    searchFor('granada');
    expect(options()).toHaveLength(1);
    expect(options()[0].disabled).toBe(true);
    expect(options()[0].getAttribute('aria-pressed')).toBe('true');
    filterBy('Objetos e geometria');
    expect(options()[0].disabled).toBe(true);
    expect(input.value).toBe('espada');
    renderIntentionCatalog(false);
    expect(options()[0].disabled).toBe(false);
    expect(options()[0].getAttribute('aria-pressed')).toBe('false');
  });

  it('não duplica eventos quando o inspetor é iniciado novamente', () => {
    const changed = vi.fn();
    el('bondInput').addEventListener('input', changed);
    setupIntentionCatalog();
    options()[0].click();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('mantém busca, palavra livre e feedback como texto seguro', () => {
    searchFor('<img src=x onerror=alert(1)>');
    expect(options()).toHaveLength(0);
    expect(document.querySelector('img')).toBeNull();
    expect(el('intentionMatches').textContent).toContain('palavra livre');
    renderIntentionCatalog(false, '<script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
  });
});
