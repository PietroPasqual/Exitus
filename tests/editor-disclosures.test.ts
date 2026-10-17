// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupEditorDisclosures } from '../src/ui/layout';

vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { state: {} } }));

const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
let media: EventTarget & { matches: boolean };
let listeners: [string, EventListenerOrEventListenerObject][];
let observers: MutationObserver[];

function expectOpen(which: 'menu' | 'tools', open: boolean): void {
  const button = el(which === 'menu' ? 'btnEditorMenu' : 'btnEditorTools');
  const panel = el(which === 'menu' ? 'editorMenuActions' : 'editorToolActions');
  expect(button.getAttribute('aria-expanded')).toBe(String(open));
  expect(panel.classList.contains('is-open')).toBe(open);
}

function escape(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.activeElement!.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  document.body.innerHTML = `<main id="appShell" data-rpg-view="circulos">
    <button id="btnEditorMenu" aria-expanded="false" aria-controls="editorMenuActions"><span id="menuIcon">Menu</span></button>
    <div id="editorMenuActions">
      <select id="example"><option>Exemplo</option></select>
      <details id="fileMenu"><summary id="exportSummary">Exportar</summary><button id="export"><span id="exportIcon">JSON</span></button></details>
      <button id="theme">Tema</button>
    </div>
    <button id="btnEditorTools" aria-expanded="false" aria-controls="editorToolActions">Ferramentas</button>
    <div id="editorToolActions"><button id="snap">Ímã</button><span id="toolLabel">Desenho</span></div>
    <button id="outside">Voltar à ficha</button>
  </main>`;
  media = Object.assign(new EventTarget(), { matches: true });
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const NativeMutationObserver = globalThis.MutationObserver;
  observers = [];
  vi.stubGlobal('MutationObserver', class extends NativeMutationObserver {
    constructor(callback: MutationCallback) { super(callback); observers.push(this); }
  });
  listeners = [];
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    listeners.push([type, listener]);
    add(type, listener, options);
  });
  setupEditorDisclosures();
});

afterEach(() => {
  listeners.forEach(([type, listener]) => document.removeEventListener(type, listener));
  observers.forEach(observer => observer.disconnect());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Menus compactos do editor', () => {
  it('abre pelo ícone, alterna o mesmo menu e permite apenas um painel aberto', () => {
    el('menuIcon').click();
    expectOpen('menu', true);
    expectOpen('tools', false);
    el('btnEditorMenu').click();
    expectOpen('menu', false);
    el('btnEditorMenu').click();
    el('btnEditorTools').click();
    expectOpen('menu', false);
    expectOpen('tools', true);
    el('btnEditorMenu').click();
    expectOpen('menu', true);
    expectOpen('tools', false);
  });

  it('preserva o menu ao escolher um exemplo e fecha ao executar uma ação sem impedir seu clique', () => {
    const action = vi.fn();
    el('export').addEventListener('click', action);
    el('btnEditorMenu').click();
    el('example').focus();
    el('example').click();
    el('example').dispatchEvent(new Event('change', { bubbles: true }));
    expectOpen('menu', true);
    el<HTMLDetailsElement>('fileMenu').open = true;
    el('export').focus();
    el('exportIcon').click();
    expect(action).toHaveBeenCalledOnce();
    expectOpen('menu', false);
    expect(el<HTMLDetailsElement>('fileMenu').open).toBe(false);
    expect(document.activeElement).toBe(el('btnEditorMenu'));
  });

  it('mantém cliques no painel e fecha ao clicar fora preservando o foco no destino', () => {
    el('btnEditorTools').click();
    el('toolLabel').click();
    expectOpen('tools', true);
    el('outside').focus();
    el('outside').click();
    expectOpen('tools', false);
    expect(document.activeElement).toBe(el('outside'));
  });

  it('fecha primeiro a exportação com Escape, depois o menu, devolvendo o foco a cada acionador', () => {
    el('btnEditorMenu').click();
    el<HTMLDetailsElement>('fileMenu').open = true;
    el('export').focus();
    expect(escape().defaultPrevented).toBe(true);
    expect(el<HTMLDetailsElement>('fileMenu').open).toBe(false);
    expectOpen('menu', true);
    expect(document.activeElement).toBe(el('exportSummary'));
    expect(escape().defaultPrevented).toBe(true);
    expectOpen('menu', false);
    expect(document.activeElement).toBe(el('btnEditorMenu'));
    expect(escape().defaultPrevented).toBe(false);
  });

  it.each(['breakpoint', 'view'])('limpa painéis e exportação ao mudar %s', async change => {
    el('btnEditorMenu').click();
    el<HTMLDetailsElement>('fileMenu').open = true;
    el('export').focus();
    if (change === 'breakpoint') {
      media.matches = false;
      media.dispatchEvent(new Event('change'));
    } else {
      el('appShell').dataset.rpgView = 'ficha';
      await Promise.resolve();
    }
    expectOpen('menu', false);
    expectOpen('tools', false);
    expect(el<HTMLDetailsElement>('fileMenu').open).toBe(false);
    expect(document.activeElement).toBe(el('btnEditorMenu'));
    el('btnEditorMenu').click();
    expectOpen('menu', true);
    expect(el<HTMLDetailsElement>('fileMenu').open).toBe(false);
  });

  it('não toma o foco dos controles do computador quando nenhum painel compacto está aberto', async () => {
    media.matches = false;
    el<HTMLDetailsElement>('fileMenu').open = true;
    el('export').focus();
    el('exportIcon').click();
    expect(document.activeElement).toBe(el('export'));
    expect(escape().defaultPrevented).toBe(false);
    media.dispatchEvent(new Event('change'));
    el('appShell').dataset.rpgView = 'ficha';
    await Promise.resolve();
    expect(document.activeElement).toBe(el('export'));
    expect(el<HTMLDetailsElement>('fileMenu').open).toBe(true);
    expectOpen('menu', false);
    expectOpen('tools', false);
  });
});
