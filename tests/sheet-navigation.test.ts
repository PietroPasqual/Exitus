// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_LIBRARY_KEY } from '../src/core/character-library';
import { setupCharacter } from '../src/ui/character';
import { renderSheetNavigation, setupSheetNavigation } from '../src/ui/sheet-navigation';

vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: vi.fn(), resetCircle: vi.fn() }));
vi.mock('../src/ui/history', () => ({ resetHistory: vi.fn() }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

const rpgIds = ['descricao', 'arquetipo', 'formacao', 'classes', 'elementos', 'estado', 'combate', 'estatisticas', 'acoes', 'pericias', 'inventario', 'conquistas', 'historia', 'referencia'].map(key => `rpg-section-${key}`);
const legacyIds = ['atributos', 'pericias', 'recursos', 'habilidades', 'inventario'].map(key => `character-section-${key}`);
const expectedIds = ['character-section-identidade', 'character-section-historia', ...rpgIds, 'character-section-registros', ...legacyIds, 'character-section-magias'];

function mountCharacter(): HTMLElement {
  document.body.innerHTML = '<button id="btnCharacterLink" data-rpg-page="personagens"></button><button data-rpg-page="ficha"></button><button data-rpg-page="circulos"></button><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><div id="characterEditorContext" hidden><span id="circleOwnerLabel"></span><span id="circleStatus"></span><button id="btnReturnCharacter"></button><button id="btnSaveCharacterCircle"></button></div>';
  setupCharacter();
  document.querySelector<HTMLButtonElement>('[data-character-action="new"]')!.click();
  return document.getElementById('characterPage')!;
}
function rect(top: number): DOMRect {
  return { top, bottom: top + 100, left: 0, right: 500, width: 500, height: 100, x: 0, y: top, toJSON: () => ({}) };
}
function active(root: HTMLElement, id: string): void {
  const links = root.querySelectorAll<HTMLAnchorElement>('[aria-current="location"]');
  expect(links).toHaveLength(1);
  expect(links[0].dataset.characterSection).toBe(id);
  expect(root.querySelector<HTMLSelectElement>('.character-section-select')!.value).toBe(id);
}
function clickLink(root: HTMLElement, id: string): void {
  root.querySelector<HTMLElement>(`[data-character-section="${id}"] span`)!.click();
}
function controllerFixture(): { root: HTMLElement; controller: ReturnType<typeof setupSheetNavigation>; positions: Map<string, number> } {
  document.body.innerHTML = `<div id="characterPage">${renderSheetNavigation()}${expectedIds.map(id => `<section id="${id}"><h3>${id}</h3></section>`).join('')}</div>`;
  const root = document.getElementById('characterPage')!;
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(100));
  const positions = new Map(expectedIds.map((id, index) => [id, 1000 + index * 200]));
  for (const id of expectedIds) {
    const target = document.getElementById(id)!;
    target.style.scrollMarginTop = '30px';
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => rect(100 + positions.get(id)!));
  }
  Object.defineProperty(root, 'scrollTo', { configurable: true, value: vi.fn() });
  const controller = setupSheetNavigation(root);
  controller.refresh();
  return { root, controller, positions };
}
function frameQueue(): { flush(): void; callbacks: Map<number, FrameRequestCallback> } {
  let next = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.set(++next, callback); return next; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
  return { callbacks, flush(): void { const queued = [...callbacks.values()]; callbacks.clear(); queued.forEach(callback => callback(0)); } };
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('Atalhos laterais das seções da ficha', () => {
  it('oferece todas as seções reais uma única vez, incluindo as regras do RPG e os registros antigos', () => {
    const root = mountCharacter();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-character-section]')];
    expect(links.map(link => link.dataset.characterSection)).toEqual(expectedIds);
    expect([...root.querySelector<HTMLSelectElement>('.character-section-select')!.options].map(option => option.value)).toEqual(expectedIds);
    for (const link of links) {
      expect(root.querySelectorAll(link.getAttribute('href')!)).toHaveLength(1);
      expect(link.textContent!.trim()).not.toBe('');
    }
    expect(root.querySelectorAll('nav[aria-label="Seções da ficha"]')).toHaveLength(1);
    expect(root.querySelector('.character-creation-menu, [data-character-action="jump"], [data-rpg-action="jump"]')).toBeNull();
    active(root, 'character-section-identidade');
  });

  it('rola o painel até a seção, foca seu título e abre registros recolhidos pelos dois tipos de atalho', () => {
    const root = mountCharacter();
    const target = document.getElementById('rpg-section-estatisticas')!;
    root.scrollTop = 250;
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(90));
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(rect(600));
    target.style.scrollMarginTop = '34px';
    const scrollTo = vi.fn();
    Object.defineProperty(root, 'scrollTo', { configurable: true, value: scrollTo });
    const backup = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    clickLink(root, target.id);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 726, behavior: 'auto' });
    expect(document.activeElement).toBe(target.querySelector('h3'));
    active(root, target.id);

    const records = document.getElementById('character-section-registros') as HTMLDetailsElement;
    expect(records.open).toBe(false);
    const select = root.querySelector<HTMLSelectElement>('.character-section-select')!;
    select.value = 'character-section-habilidades';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(records.open).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('#character-section-habilidades h3'));
    active(root, 'character-section-habilidades');
    expect(scrollTo).toHaveBeenCalledTimes(2);

    records.open = false;
    const summary = records.querySelector('summary')!;
    const nativeTabIndex = summary.tabIndex;
    clickLink(root, records.id);
    expect(records.open).toBe(true);
    expect(document.activeElement).toBe(summary);
    expect(summary.tabIndex).toBe(nativeTabIndex);
    expect(summary.hasAttribute('tabindex')).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(backup);
  });

  it('mantém os atalhos funcionando uma vez por clique após trocar arquétipo e adicionar registros', () => {
    const root = mountCharacter();
    const scrollTo = vi.fn();
    Object.defineProperty(root, 'scrollTo', { configurable: true, value: scrollTo });
    clickLink(root, 'rpg-section-inventario');
    const originalNav = root.querySelector('.character-section-nav');
    const archetype = root.querySelector<HTMLSelectElement>('[data-rpg-field="arquetipo"]')!;
    archetype.value = 'ramo'; archetype.dispatchEvent(new Event('change', { bubbles: true }));
    // Só as seções que mudaram são redesenhadas: a navegação lateral continua a mesma
    expect(root.querySelector('.character-section-nav')).toBe(originalNav);
    expect(root.querySelector('#rpg-section-classes .rpg-counter')?.textContent).toBe('0/1');
    clickLink(root, 'rpg-section-classes');
    root.querySelector<HTMLButtonElement>('[data-rpg-action="add-classes"]')!.click();
    expect(root.querySelector('[data-rpg-field="progressao.classes.0.nome"]')).not.toBeNull();
    const backup = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    clickLink(root, 'character-section-magias');
    expect(scrollTo).toHaveBeenCalledTimes(3);
    active(root, 'character-section-magias');
    expect(document.activeElement).toBe(document.querySelector('#character-section-magias h3'));
    expect(root.querySelectorAll('.character-section-nav')).toHaveLength(1);
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(backup);
  });

  it('ao editar um recurso redesenha só a seção que mudou', () => {
    const root = mountCharacter();
    const descricao = root.querySelector('#rpg-section-descricao');
    const estado = root.querySelector('#rpg-section-estado');
    const life = root.querySelector<HTMLInputElement>('[data-rpg-field="recursos.vida.atual"]')!;
    life.value = '25';
    life.dispatchEvent(new Event('input', { bubbles: true }));
    expect(root.querySelector('#rpg-section-descricao')).toBe(descricao);
    expect(root.querySelector('#rpg-section-estado')).not.toBe(estado);
    expect(root.querySelector('.rpg-resource-vida .rpg-bar-text')?.textContent).toBe('25 / 50');
    expect(document.activeElement).toBe(root.querySelector('[data-rpg-field="recursos.vida.atual"]'));
  });

  it('acompanha a rolagem sem oscilar entre duas seções na mesma linha', () => {
    const frames = frameQueue();
    const { root, positions } = controllerFixture();
    const firstColumn = 'rpg-section-descricao', secondColumn = 'rpg-section-arquetipo';
    positions.set('character-section-identidade', -150);
    positions.set('character-section-historia', -100);
    positions.set(firstColumn, 20); positions.set(secondColumn, 20);
    clickLink(root, secondColumn);
    root.dispatchEvent(new Event('scroll')); root.dispatchEvent(new Event('scroll'));
    expect(frames.callbacks.size).toBe(1);
    frames.flush(); active(root, secondColumn);
    positions.set(firstColumn, -100); positions.set(secondColumn, -100);
    positions.set('rpg-section-formacao', 15);
    const focus = document.activeElement;
    root.dispatchEvent(new Event('scroll')); frames.flush();
    active(root, 'rpg-section-formacao');
    expect(document.activeElement).toBe(focus);
  });

  it('ignora a ficha oculta e cancela atualizações pendentes ao limpar a navegação', () => {
    const frames = frameQueue();
    const { root, controller, positions } = controllerFixture();
    localStorage.setItem('backup-ficha', 'preservado');
    const before = root.innerHTML;
    positions.set('rpg-section-formacao', 10);
    root.dispatchEvent(new Event('scroll'));
    root.hidden = true;
    frames.flush();
    clickLink(root, 'rpg-section-estatisticas');
    expect(root.scrollTo).not.toHaveBeenCalled();
    expect(root.innerHTML).toBe(before);
    root.hidden = false;
    root.dispatchEvent(new Event('scroll'));
    expect(frames.callbacks.size).toBe(1);
    const pending = [...frames.callbacks.values()][0];
    controller.clear();
    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(frames.callbacks.size).toBe(0);
    pending(0);
    expect(root.innerHTML).toBe(before);
    expect(localStorage.getItem('backup-ficha')).toBe('preservado');
  });
});
