// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_KEY, normalizeTable, type TableState } from '../src/core/game-table';
import { CHARACTER_LIBRARY_KEY } from '../src/core/character-library';
import { newCharacter } from '../src/core/character';
import { setupGameTable } from '../src/ui/game-table';

const page = (): HTMLElement => document.getElementById('tablePage')!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = page().querySelector<T>(selector);
  expect(el, `Ausente: ${selector}`).not.toBeNull();
  return el!;
};
const click = (selector: string): void => $<HTMLButtonElement>(selector).click();
const saved = (): TableState => normalizeTable(JSON.parse(localStorage.getItem(TABLE_KEY)!))!;
const scene = () => saved().cenas[0];
function open(): void {
  document.body.innerHTML = '<div id="characterPage"></div><main id="tablePage"></main>';
  setupGameTable();
  page().dispatchEvent(new Event('mesa:open'));
}
function stubBoard(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const w = Number(this.getAttribute('width') ?? 0), h = Number(this.getAttribute('height') ?? 0);
    return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
}
const zoom = (): number => Number($('#tableBoard svg').getAttribute('width')) / Number($('#tableBoard svg').getAttribute('viewBox')!.split(' ')[2]);
function mouse(type: string, x: number, y: number): void {
  $('#tableBoard svg').dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: (x + 0.5) * zoom(), clientY: (y + 0.5) * zoom() }));
}
const tap = (x: number, y: number): void => { mouse('pointerdown', x, y); mouse('pointerup', x, y); };
function change(selector: string, value: string): void {
  const el = $<HTMLInputElement | HTMLSelectElement>(selector);
  el.value = value; el.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); stubBoard(); });

describe('Ferramenta Objetos', () => {
  it('mostra a paleta com a arte de cada objeto e o terreno com a textura de cada tipo', () => {
    open();
    click('[data-table-tool="terreno"]');
    const brushes = [...page().querySelectorAll<HTMLElement>('.table-brush')];
    expect(brushes).toHaveLength(10);
    for (const brush of brushes) expect(brush.getAttribute('style')).toMatch(/--tile:url\('data:image\/png;base64,/);
    click('[data-table-tool="objeto"]');
    expect(page().querySelectorAll('.table-prop-btn')).toHaveLength(16);
    expect($('[data-table-prop="bau"]').getAttribute('aria-label')).toBe('Baú');
    expect($('[data-table-prop="porta"]').getAttribute('aria-pressed')).toBe('true');
    expect($('[data-table-prop="apagar"]')).toBeTruthy();
  });
  it('põe objetos tocando no mapa, gira ao tocar de novo e arrasta para pôr vários', () => {
    open();
    click('[data-table-tool="objeto"]');
    tap(3, 2);
    expect(scene().objetos).toMatchObject([{ tipo: 'porta', x: 3, y: 2, rot: 0, oculto: false }]);
    expect(page().querySelectorAll('.table-prop')).toHaveLength(1);
    tap(3, 2);
    expect(scene().objetos[0].rot).toBe(1);
    expect($('#tableBoard .table-prop').getAttribute('transform')).toBe('translate(3 2) rotate(90 .5 .5)');
    click('[data-table-prop="bau"]');
    mouse('pointerdown', 1, 5); mouse('pointermove', 6, 5); mouse('pointerup', 6, 5);
    expect(scene().objetos.filter(o => o.tipo === 'bau').map(o => o.x)).toEqual([1, 2, 3, 4, 5, 6]);
    // Arrastar por cima do mesmo tipo não gira: só tocar gira
    expect(scene().objetos.filter(o => o.tipo === 'bau').every(o => o.rot === 0)).toBe(true);
  });
  it('gira o objeto que vai ser posto, e deixa pôr oculto dos jogadores', () => {
    open();
    click('[data-table-tool="objeto"]');
    click('[data-table-prop="armadilha"]');
    click('[data-table-action="rotate-prop"]');
    expect($('[data-table-action="rotate-prop"]').textContent).toContain('90°');
    const hidden = $<HTMLInputElement>('#tablePropHidden');
    hidden.checked = true; hidden.dispatchEvent(new Event('change', { bubbles: true }));
    tap(4, 4);
    expect(scene().objetos).toMatchObject([{ tipo: 'armadilha', x: 4, y: 4, rot: 1, oculto: true }]);
    expect(page().querySelector('.table-prop.is-hidden')).not.toBeNull();
    expect($<HTMLInputElement>('#tablePropHidden').checked).toBe(true);
  });
  it('apaga objetos e tudo isso entra no desfazer e refazer', () => {
    open();
    click('[data-table-tool="objeto"]');
    click('[data-table-prop="mesa"]');
    mouse('pointerdown', 2, 2); mouse('pointermove', 4, 2); mouse('pointerup', 4, 2);
    expect(scene().objetos).toHaveLength(3);
    click('[data-table-prop="apagar"]');
    tap(3, 2);
    expect(scene().objetos.map(o => o.x)).toEqual([2, 4]);
    click('[data-table-action="undo"]');
    expect(scene().objetos).toHaveLength(3);
    click('[data-table-action="undo"]');
    expect(scene().objetos).toHaveLength(0);
    click('[data-table-action="redo"]');
    expect(scene().objetos).toHaveLength(3);
  });
  it('modelo de cena traz as portas e "Limpar objetos" as tira (dá para desfazer)', () => {
    open();
    $<HTMLSelectElement>('#tableTemplatePick').value = 'salas';
    click('[data-table-action="apply-template"]');
    expect(scene().objetos.filter(o => o.tipo === 'porta')).toHaveLength(8);
    click('[data-table-action="clear-props"]');
    expect(scene().objetos).toHaveLength(0);
    expect($<HTMLButtonElement>('[data-table-action="clear-props"]').disabled).toBe(true);
    click('[data-table-action="undo"]');
    expect(scene().objetos).toHaveLength(8);
    expect(scene().terreno).toContain('p');
  });
});

describe('Retratos nos tokens', () => {
  it('NPC com retrato de criatura: escolhido ao criar e trocável depois', () => {
    open();
    $<HTMLInputElement>('#tableTokenName').value = 'Gruk';
    $<HTMLSelectElement>('#tableTokenSprite').value = 'orc';
    click('[data-table-action="add-token"]');
    expect(scene().tokens[0]).toMatchObject({ nome: 'Gruk', sprite: 'orc', tipo: 'inimigo' });
    expect($('#tableBoard [data-token] use').getAttribute('transform')).toContain('scale(0.84)');
    expect(page().querySelector('#tableBoard [data-token] .table-token-initials')).toBeNull();
    expect(page().querySelector('.table-token-face')).not.toBeNull();
    change('[data-table-token="sprite"]', 'dragao');
    expect(scene().tokens[0].sprite).toBe('dragao');
    change('[data-table-token="sprite"]', '');
    expect(scene().tokens[0].sprite).toBe('');
    expect($('#tableBoard [data-token] .table-token-initials').textContent).toBe('GR');
  });
  it('personagem das fichas aparece com o avatar e a roupa da classe, e o token guarda uma cópia', () => {
    const lira = newCharacter();
    lira.identidade.nome = 'Lira';
    lira.avatar = { pele: '#8d5a36', olhos: '#3f7d3a', cabelo: '#b8442a' };
    lira.rpg!.progressao.classes = [{ nome: 'Mago', valor: '', notas: '' }];
    localStorage.setItem(CHARACTER_LIBRARY_KEY, JSON.stringify({ kind: 'circulos-rpg-library', version: 1, characters: [{ id: 'lira', data: lira }] }));
    open();
    click('[data-table-action="add-sheet"]');
    expect(scene().tokens[0]).toMatchObject({ personagemId: 'lira', classe: 'Mago', avatar: { pele: '#8d5a36', cabelo: '#b8442a' }, sprite: '' });
    expect($('#tableBoard [data-token] use').getAttribute('transform')).toContain('scale(0.84)');
    expect($('#tableBoard image.table-px').getAttribute('href')).toMatch(/^data:image\/png;base64,/);
    // Sem ficha (por exemplo na tela de um jogador), o retrato vem da cópia guardada no token
    localStorage.removeItem(CHARACTER_LIBRARY_KEY);
    open();
    expect($('#tableBoard [data-token] use')).toBeTruthy();
  });
});
