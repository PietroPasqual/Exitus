// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLE_KEY, normalizeTable, type TableState } from '../src/core/game-table';
import { CHARACTER_LIBRARY_KEY } from '../src/core/character-library';
import { newCharacter } from '../src/core/character';
import { setupGameTable, startPlayerTable } from '../src/ui/game-table';

const page = (): HTMLElement => document.getElementById('tablePage')!;
const click = (selector: string): void => {
  const el = page().querySelector<HTMLButtonElement>(selector);
  expect(el, `Botão ausente: ${selector}`).not.toBeNull();
  el!.click();
};
const saved = (): TableState => normalizeTable(JSON.parse(localStorage.getItem(TABLE_KEY)!))!;
function open(): void {
  document.body.innerHTML = '<div id="characterPage"></div><main id="tablePage"></main>';
  setupGameTable();
  page().dispatchEvent(new Event('mesa:open'));
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Mesa do Mestre', () => {
  it('põe personagens das fichas e NPCs no mapa e guarda neste navegador', () => {
    const lira = newCharacter(); lira.identidade.nome = 'Lira';
    lira.rpg!.recursos.vida = { atual: 30, maximo: 50 };
    localStorage.setItem(CHARACTER_LIBRARY_KEY, JSON.stringify({ kind: 'circulos-rpg-library', version: 1, characters: [{ id: 'lira', data: lira }] }));
    open();
    expect(page().querySelector('#tableTitle')!.textContent).toBe('Primeira cena');
    click('[data-table-action="add-sheet"]');
    page().querySelector<HTMLInputElement>('#tableTokenName')!.value = 'Lobo sombrio';
    click('[data-table-action="add-token"]');
    const tokens = saved().cenas[0].tokens;
    expect(tokens.map(t => [t.nome, t.tipo, t.personagemId])).toEqual([['Lira', 'jogador', 'lira'], ['Lobo sombrio', 'inimigo', '']]);
    expect(tokens[0]).not.toMatchObject({ x: tokens[1].x, y: tokens[1].y });
    // A vida do token ligado vem da ficha: 30/50 vira uma barra de 60%.
    const bar = page().querySelector<SVGRectElement>(`[data-token="${tokens[0].id}"] .table-token-life`)!;
    expect(Number(bar.getAttribute('width'))).toBeCloseTo(0.76 * 0.6);

    // O Lobo está selecionado (último adicionado): ocultar e mudar a vida dele.
    const hidden = page().querySelector<HTMLInputElement>('[data-table-token="oculto"]')!;
    hidden.checked = true; hidden.dispatchEvent(new Event('change', { bubbles: true }));
    const life = page().querySelector<HTMLInputElement>('[data-table-token="vida-maximo"]')!;
    life.value = '12'; life.dispatchEvent(new Event('change', { bubbles: true }));
    expect(saved().cenas[0].tokens[1]).toMatchObject({ oculto: true, vida: { atual: 0, maximo: 12 } });
    click('[data-table-action="remove-token"]');
    expect(saved().cenas[0].tokens).toHaveLength(1);
  });

  it('rola dados no histórico, inclusive em segredo', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    open();
    click('[data-table-roll="1d20"]');
    page().querySelector<HTMLInputElement>('#tableRollInput')!.value = '2d6+1';
    page().querySelector<HTMLInputElement>('#tableRollSecret')!.checked = true;
    page().querySelector('#tableRollForm')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(saved().rolagens.map(r => [r.expressao, r.total, r.secreta])).toEqual([['1d20', 11, false], ['2d6+1', 9, true]]);
    expect(page().querySelectorAll('.table-roll-log li')).toHaveLength(2);
    page().querySelector<HTMLInputElement>('#tableRollInput')!.value = '2d';
    page().querySelector('#tableRollForm')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(page().querySelector('#tableStatus')!.textContent).toMatch(/não reconhecida/);
    expect(saved().rolagens).toHaveLength(2);
  });

  it('cria cenas, escolhe qual os jogadores veem e muda o tamanho da grade', async () => {
    open();
    click('[data-table-action="new-scene"]');
    expect(page().querySelector('#tableNewScene')).not.toBeNull();
    page().querySelector('#tableNewScene')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await vi.waitFor(() => expect(saved().cenas).toHaveLength(2));
    let state = saved();
    expect(state.cenas).toHaveLength(2);
    expect(state.ativa).toBe(state.cenas[1].id);
    expect(state.exibida).toBe(state.cenas[0].id);
    click('[data-table-action="show-players"]');
    expect(saved().exibida).toBe(state.cenas[1].id);
    const columns = page().querySelector<HTMLInputElement>('[data-table-input="colunas"]')!;
    columns.value = '30'; columns.dispatchEvent(new Event('change', { bubbles: true }));
    state = saved();
    expect(state.cenas[1]).toMatchObject({ colunas: 30, linhas: 16 });
    expect(state.cenas[1].terreno).toHaveLength(30 * 16);
    expect(page().querySelector('#tableBoard svg')!.getAttribute('viewBox')).toBe('0 0 30 16');
  });
});

describe('Janela dos jogadores', () => {
  it('espera o mestre e depois mostra só o que é público', () => {
    document.body.innerHTML = '<main id="entryGate"></main><div id="appShell"></div>';
    const state: TableState = JSON.parse(JSON.stringify(normalizeTable({ kind: 'existus-mesa', version: 1, cenas: [{ nome: 'Cripta' }] })));
    localStorage.setItem(TABLE_KEY, JSON.stringify(state));
    startPlayerTable();
    expect(document.getElementById('appShell')!.hidden).toBe(true);
    expect(document.querySelector('.table-player')!.textContent).toContain('Aguardando o mestre');

    const scene = state.cenas[0];
    scene.tokens = [
      { id: 'a', nome: 'Lira', cor: '#4cc3ff', tipo: 'jogador', x: 1, y: 1, tamanho: 1, oculto: false, sprite: '' as const, avatar: null, classe: '', personagemId: '', vida: null, notas: '' },
      { id: 'b', nome: 'Espião', cor: '#f2655c', tipo: 'inimigo', x: 2, y: 2, tamanho: 1, oculto: true, sprite: '' as const, avatar: null, classe: '', personagemId: '', vida: null, notas: 'segredo' }
    ];
    state.exibida = scene.id;
    localStorage.setItem(TABLE_KEY, JSON.stringify(state));
    window.dispatchEvent(new StorageEvent('storage', { key: TABLE_KEY }));
    const player = document.querySelector('.table-player')!;
    expect(player.querySelector('h1')!.textContent).toBe('Cripta');
    expect(player.querySelectorAll('[data-token]')).toHaveLength(1);
    expect(player.textContent).not.toContain('Espião');
  });
});
