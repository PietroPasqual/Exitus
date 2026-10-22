// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_KEY, createScene, newTable, normalizeTable, type TableState } from '../src/core/game-table';
import { setupGameTable } from '../src/ui/game-table';

const page = (): HTMLElement => document.getElementById('tablePage')!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = page().querySelector<T>(selector);
  expect(el, `Ausente: ${selector}`).not.toBeNull();
  return el!;
};
const click = (selector: string): void => $<HTMLButtonElement>(selector).click();
const saved = (): TableState => normalizeTable(JSON.parse(localStorage.getItem(TABLE_KEY)!))!;
const rows = (grid: string, colunas: number): string[] => grid.match(new RegExp(`.{${colunas}}`, 'g')) ?? [];
function open(state?: TableState): void {
  if (state) localStorage.setItem(TABLE_KEY, JSON.stringify(state));
  document.body.innerHTML = '<div id="characterPage"></div><main id="tablePage"></main>';
  setupGameTable();
  page().dispatchEvent(new Event('mesa:open'));
}
/** Sem layout no jsdom: o mapa ocupa o tamanho do atributo width/height do SVG, a partir de (0, 0). */
function stubBoard(): void {
  // O redesenho do arrasto espera o próximo quadro; aqui ele acontece na hora.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const w = Number(this.getAttribute('width') ?? 0), h = Number(this.getAttribute('height') ?? 0);
    return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
}
const zoom = (): number => Number($('#tableBoard svg').getAttribute('width')) / Number($('#tableBoard svg').getAttribute('viewBox')!.split(' ')[2]);
const at = (x: number, y: number): { clientX: number; clientY: number } => ({ clientX: (x + 0.5) * zoom(), clientY: (y + 0.5) * zoom() });
function mouse(type: string, x: number, y: number, target: Element = $('#tableBoard svg')): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...at(x, y) }));
}
function drag(from: [number, number], to: [number, number]): void {
  mouse('pointerdown', ...from); mouse('pointermove', ...to); mouse('pointerup', ...to);
}
function change(selector: string, value: string): void {
  const el = $<HTMLInputElement | HTMLSelectElement>(selector);
  el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }));
}
const scene = () => saved().cenas.find(c => c.id === saved().ativa)!;

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Criação da cena', () => {
  it('abre um formulário com tamanhos prontos e cria a cena com o modelo escolhido', async () => {
    open();
    click('[data-table-action="new-scene"]');
    expect(page().querySelectorAll('#tableNewSize option')).toHaveLength(5);
    change('#tableNewSize', 'grande');
    expect($<HTMLInputElement>('input[name="colunas"]').value).toBe('36');
    expect($<HTMLInputElement>('input[name="linhas"]').value).toBe('24');
    $<HTMLInputElement>('input[name="nome"]').value = 'Taverna';
    $<HTMLInputElement>('input[name="metros"]').value = '1';
    $<HTMLSelectElement>('select[name="modelo"]').value = 'sala';
    $('#tableNewScene').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await vi.waitFor(() => expect(saved().cenas).toHaveLength(2));
    const created = scene();
    expect(created).toMatchObject({ nome: 'Taverna', colunas: 36, linhas: 24, metros: 1 });
    expect(rows(created.terreno, 36)[0]).toBe('p'.repeat(36));
    expect(rows(created.terreno, 36)[12]).toBe('p' + '.'.repeat(34) + 'p');
    expect(page().querySelector('#tableNewScene')).toBeNull();
    expect($('#tableBoard svg').getAttribute('viewBox')).toBe('0 0 36 24');
  });
  it('cancelar fecha o formulário sem criar nada', () => {
    open();
    click('[data-table-action="new-scene"]');
    click('[data-table-action="cancel-scene"]');
    expect(page().querySelector('#tableNewScene')).toBeNull();
    expect(page().querySelectorAll('[data-table-input="scene"] option')).toHaveLength(1);
    expect(localStorage.getItem(TABLE_KEY)).toBeNull();
  });
  it('aplica um modelo e limpa o terreno, e dá para desfazer os dois', () => {
    open();
    $<HTMLSelectElement>('#tableTemplatePick').value = 'sala';
    click('[data-table-action="apply-template"]');
    const first = scene();
    expect(rows(first.terreno, first.colunas)[0]).toBe('p'.repeat(first.colunas));
    click('[data-table-action="clear-terrain"]');
    expect(scene().terreno).toMatch(/^\.+$/);
    click('[data-table-action="undo"]');
    expect(scene().terreno).toBe(first.terreno);
    click('[data-table-action="undo"]');
    expect(scene().terreno).toMatch(/^\.+$/);
    expect($<HTMLButtonElement>('[data-table-action="undo"]').disabled).toBe(true);
    click('[data-table-action="redo"]');
    expect(scene().terreno).toBe(first.terreno);
  });
});

describe('Desenho com formas', () => {
  beforeEach(() => { stubBoard(); });
  it('contorno desenha só a borda, com pré-visualização enquanto arrasta, e o balde enche a sala', () => {
    open();
    click('[data-table-tool="terreno"]');
    click('[data-table-shape="contorno"]');
    mouse('pointerdown', 2, 2); mouse('pointermove', 7, 5);
    expect(page().querySelector('.table-preview rect')).not.toBeNull();
    // Enquanto arrasta é só pré-visualização: nada foi pintado nem salvo
    expect(localStorage.getItem(TABLE_KEY)).toBeNull();
    mouse('pointerup', 7, 5);
    expect(page().querySelector('.table-preview')).toBeNull();
    const walls = rows(scene().terreno, 24).slice(1, 7).map(row => row.slice(1, 9));
    expect(walls).toEqual(['........', '.pppppp.', '.p....p.', '.p....p.', '.pppppp.', '........']);

    click('[data-table-brush="a"]'); click('[data-table-shape="balde"]');
    mouse('pointerdown', 4, 3); mouse('pointerup', 4, 3);
    expect(rows(scene().terreno, 24)[3].slice(2, 8)).toBe('paaaap');
    expect(scene().terreno.split('a').length - 1).toBe(8);
    // Fora da sala, a água não vaza
    expect(rows(scene().terreno, 24)[0]).not.toContain('a');

    click('[data-table-action="undo"]');
    expect(scene().terreno).not.toContain('a');
    click('[data-table-action="undo"]');
    expect(scene().terreno).toMatch(/^\.+$/);
    click('[data-table-action="redo"]');
    click('[data-table-action="redo"]');
    expect(scene().terreno.split('a').length - 1).toBe(8);
  });
  it('pincel livre liga os quadrados mesmo arrastando rápido e usa o tamanho escolhido', () => {
    open();
    click('[data-table-tool="terreno"]');
    click('[data-table-size="2"]');
    drag([1, 1], [9, 1]);
    // Pincel par: o quadrado clicado e o seguinte (para baixo e para a direita)
    const grid = rows(scene().terreno, 24);
    expect(grid[0]).toMatch(/^\.+$/);
    expect(grid[1].slice(0, 12)).toBe('.pppppppppp.');
    expect(grid[2].slice(0, 12)).toBe('.pppppppppp.');
    expect(grid[3]).toMatch(/^\.+$/);
    // Um único gesto = um passo de desfazer
    click('[data-table-action="undo"]');
    expect(scene().terreno).toMatch(/^\.+$/);
  });
  it('Ctrl+Z e Ctrl+Y desfazem e refazem fora dos campos de texto, e linha usa a espessura', () => {
    open();
    click('[data-table-tool="terreno"]');
    click('[data-table-shape="linha"]');
    drag([2, 2], [8, 6]);
    const painted = scene().terreno;
    expect(painted).toContain('p');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(scene().terreno).toMatch(/^\.+$/);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(scene().terreno).toBe(painted);
    // Digitando num campo, Ctrl+Z é do campo
    const input = $<HTMLInputElement>('[data-table-input="nome"]');
    input.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(scene().terreno).toBe(painted);
  });
  it('a névoa usa as mesmas formas: cobrir e revelar um retângulo', () => {
    open();
    $<HTMLInputElement>('[data-table-input="nevoa"]').checked = true;
    $<HTMLInputElement>('[data-table-input="nevoa"]').dispatchEvent(new Event('change', { bubbles: true }));
    click('[data-table-tool="nevoa"]');
    click('[data-table-shape="retangulo"]');
    click('[data-table-fog="0"]');
    drag([3, 3], [5, 4]);
    const fog = rows(scene().coberto, 24);
    expect(fog[3].slice(2, 7)).toBe('10001'); expect(fog[4].slice(2, 7)).toBe('10001'); expect(fog[5].slice(2, 7)).toBe('11111');
  });
});

describe('Imagem do mapa e aparência da grade', () => {
  const withImage = (): TableState => {
    const base = createScene({ nome: 'Mapa', fundo: 'data:image/jpeg;base64,AAAA', razao: 2, quadradosNaLargura: 20 });
    const state = newTable();
    return { ...state, cenas: [base], ativa: base.id, exibida: base.id };
  };
  it('mostra a imagem sem deformar e deixa calibrar: quadrados na largura, deslocamento e ajuste da grade', () => {
    open(withImage());
    expect(scene()).toMatchObject({ colunas: 20, linhas: 10 });
    const image = (): Element => $('#tableBoard image');
    expect([image().getAttribute('width'), image().getAttribute('height')]).toEqual(['20', '10']);
    change('[data-table-input="fundoLargura"]', '30');
    expect([image().getAttribute('width'), image().getAttribute('height')]).toEqual(['30', '15']);
    change('[data-table-input="fundoX"]', '-1.5');
    expect(image().getAttribute('x')).toBe('-1.5');
    expect(scene()).toMatchObject({ fundoLargura: 30, fundoX: -1.5, colunas: 20 });
    click('[data-table-action="fit-grid"]');
    expect(scene()).toMatchObject({ colunas: 29, linhas: 15 });
    expect(scene().terreno).toHaveLength(29 * 15);
    expect($('#tableBoard svg').getAttribute('viewBox')).toBe('0 0 29 15');
    change('[data-table-input="fundoLargura"]', '9999');
    expect(scene().fundoLargura).toBe(200);
  });
  it('imagem antiga (esticada) pode ser medida para parar de deformar', () => {
    const state = withImage(); state.cenas[0] = { ...state.cenas[0], fundoRazao: 0 };
    open(state);
    expect($('#tableBoard image').getAttribute('width')).toBe('20');
    expect($('[data-table-action="measure-image"]')).toBeTruthy();
    expect(page().querySelector('[data-table-input="fundoLargura"]')).toBeNull();
  });
  it('cor e opacidade da linha, e coordenadas nos quadrados', () => {
    open();
    const line = (): Element => $('#tableBoard .table-grid-line');
    expect(line().getAttribute('stroke-opacity')).toBe('0.35');
    expect(line().getAttribute('style')).toBeNull();
    change('[data-table-input="gradeCor"]', 'escura');
    expect(line().getAttribute('style')).toBe('stroke:#000000');
    change('[data-table-input="gradeOpacidade"]', '80');
    expect(line().getAttribute('stroke-opacity')).toBe('0.8');
    expect(scene()).toMatchObject({ gradeCor: 'escura', gradeOpacidade: 0.8 });
    expect(page().querySelector('.table-coords')).toBeNull();
    $<HTMLInputElement>('[data-table-input="coordenadas"]').checked = true;
    $<HTMLInputElement>('[data-table-input="coordenadas"]').dispatchEvent(new Event('change', { bubbles: true }));
    const labels = [...page().querySelectorAll('.table-coords text')].map(t => t.textContent);
    expect(labels.slice(0, 3)).toEqual(['A', 'B', 'C']);
    expect(labels).toContain('16');
  });
  it('mudar o tamanho da grade esquece o histórico para não restaurar pintura do tamanho antigo', () => {
    open();
    $<HTMLSelectElement>('#tableTemplatePick').value = 'sala';
    click('[data-table-action="apply-template"]');
    change('[data-table-input="colunas"]', '30');
    expect($<HTMLButtonElement>('[data-table-action="undo"]').disabled).toBe(true);
    click('[data-table-action="undo"]');
    expect(scene().terreno).toHaveLength(30 * 16);
  });
});
