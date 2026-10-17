// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_LIBRARY_KEY, type CharacterLibrary } from '../src/core/character-library';
import { encodeCharacter, normalizeCharacter } from '../src/core/character';
import { newRpgSheet, RPG_STATS, type StatId } from '../src/core/rpg-sheet';
import { setupCharacter } from '../src/ui/character';
import { renderRpgSheet } from '../src/ui/rpg-sheet';

vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: vi.fn(), resetCircle: vi.fn() }));
vi.mock('../src/ui/history', () => ({ resetHistory: vi.fn() }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

const keys = Object.keys(RPG_STATS) as StatId[];
const section = (): HTMLElement => document.getElementById('rpg-section-estatisticas')!;
const control = (path: string): HTMLInputElement => document.querySelector<HTMLInputElement>(`[data-rpg-field="${path}"]`)!;
const stored = (): CharacterLibrary => JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY)!);

function render(sheet = newRpgSheet()): void {
  document.body.innerHTML = renderRpgSheet(sheet);
}
function mount(): void {
  document.body.innerHTML = '<button id="btnCharacterLink" data-rpg-page="personagens"></button><button data-rpg-page="ficha"></button><button data-rpg-page="circulos"></button><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button><div id="characterEditorContext" hidden><span id="circleOwnerLabel"></span><span id="circleStatus" role="status"></span><button id="btnReturnCharacter"></button><button id="btnSaveCharacterCircle"></button></div>';
  setupCharacter();
}
function click(selector: string): void {
  document.querySelector<HTMLButtonElement>(selector)!.click();
}
function edit(path: string, value: string): void {
  const input = control(path);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

describe('Tabela de status da ficha', () => {
  it('apresenta os dez atributos em uma tabela com os quatro cabeçalhos da referência', () => {
    render();
    const table = section().querySelector('table')!;
    expect(table).not.toBeNull();
    expect(Array.from(table.querySelectorAll('thead th')).map(cell => cell.textContent?.trim())).toEqual(['STATUS', 'MOD', 'ALT', 'DR']);
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(10);
    for (const [index, key] of keys.entries()) {
      expect(rows[index].querySelector('th[scope="row"]')?.textContent).toContain(RPG_STATS[key]);
      expect(rows[index].children).toHaveLength(4);
      expect(rows[index].querySelector(`[data-rpg-field="estatisticas.${key}.valor"]`)).not.toBeNull();
      expect(rows[index].children[1].querySelector(`[data-rpg-field="estatisticas.${key}.modificador"]`)).not.toBeNull();
      expect(rows[index].children[1].querySelector(`[data-rpg-field="estatisticas.${key}.limite"]`)).not.toBeNull();
      expect(rows[index].children[2].querySelector(`[data-rpg-field="estatisticas.${key}.alteracao"]`)).not.toBeNull();
      expect(rows[index].children[3].querySelector(`[data-rpg-field="estatisticas.${key}.dr"]`)).not.toBeNull();
    }
  });

  it('mantém um único controle rotulado para cada registro, inclusive nos detalhes de cálculo', () => {
    render();
    const all = Array.from(section().querySelectorAll<HTMLInputElement>('[data-rpg-field]'));
    expect(all).toHaveLength(70);
    expect(new Set(all.map(input => input.id)).size).toBe(70);
    for (const key of keys) {
      for (const property of ['valor', 'modificador', 'limite', 'alteracao', 'dr', 'talento', 'desbloqueada']) {
        const inputs = section().querySelectorAll<HTMLInputElement>(`[data-rpg-field="estatisticas.${key}.${property}"]`);
        expect(inputs, `${key}.${property}`).toHaveLength(1);
        const input = inputs[0];
        const label = [input.getAttribute('aria-label'), ...Array.from(input.labels ?? []).map(element => element.textContent)].filter(Boolean).join(' ');
        expect(label, `${key}.${property} precisa de um nome acessível`).toContain(RPG_STATS[key]);
      }
    }
  });

  it('usa o limite desconhecido como indicação visual sem preencher o registro ou impedir a edição de Poder e Energia', () => {
    const sheet = newRpgSheet();
    render(sheet);
    for (const key of keys) {
      expect(control(`estatisticas.${key}.limite`).value).toBe('');
      expect(control(`estatisticas.${key}.limite`).placeholder).toBe('??');
      expect(control(`estatisticas.${key}.modificador`).value).toBe('-20');
    }
    for (const key of ['poder', 'energia']) {
      expect(control(`estatisticas.${key}.desbloqueada`).checked).toBe(false);
      for (const property of ['valor', 'modificador', 'limite', 'alteracao', 'dr']) {
        expect(control(`estatisticas.${key}.${property}`).disabled).toBe(false);
        expect(control(`estatisticas.${key}.${property}`).readOnly).toBe(false);
      }
    }
    expect(sheet).toEqual(newRpgSheet());
  });

  it('exibe valores manuais e textos de ALT e limite sem interpretá-los como HTML', () => {
    const sheet = newRpgSheet();
    sheet.estatisticas.poder = { valor: 17.5, modificador: -3, alteracao: '\"><img src=x onerror=alert(1)>', dr: 4, talento: 8, limite: 'Mestre <script>alert(1)</script>', desbloqueada: false };
    const original = structuredClone(sheet);
    render(sheet);
    expect(control('estatisticas.poder.valor').value).toBe('17.5');
    expect(control('estatisticas.poder.modificador').value).toBe('-3');
    expect(control('estatisticas.poder.alteracao').value).toBe(sheet.estatisticas.poder.alteracao);
    expect(control('estatisticas.poder.limite').value).toBe(sheet.estatisticas.poder.limite);
    expect(control('estatisticas.poder.dr').value).toBe('4');
    expect(control('estatisticas.poder.talento').value).toBe('8');
    expect(section().querySelector('script, img, [onerror]')).toBeNull();
    expect(sheet).toEqual(original);
  });

  it('preserva os detalhes abertos e o foco ao recalcular talentos e alternar desbloqueio', () => {
    mount(); click('[data-character-action="new"]');
    let details = section().querySelector<HTMLDetailsElement>('details')!;
    details.open = true;
    section().querySelector<HTMLElement>('.rpg-status-table-scroll')!.scrollLeft = 120;
    const talento = control('estatisticas.poder.talento');
    talento.focus();
    edit('estatisticas.poder.talento', '8');
    details = section().querySelector<HTMLDetailsElement>('details')!;
    expect(details.open).toBe(true);
    expect(section().querySelector<HTMLElement>('.rpg-status-table-scroll')!.scrollLeft).toBe(120);
    expect(document.activeElement).toBe(control('estatisticas.poder.talento'));
    expect(control('estatisticas.poder.talento').value).toBe('8');
    const unlocked = control('estatisticas.poder.desbloqueada');
    unlocked.focus(); unlocked.click();
    expect(section().querySelector<HTMLDetailsElement>('details')!.open).toBe(true);
    expect(document.activeElement).toBe(control('estatisticas.poder.desbloqueada'));
    expect(control('estatisticas.poder.desbloqueada').checked).toBe(true);
    expect(stored().characters[0].data.rpg!.estatisticas.poder).toMatchObject({ talento: 8, desbloqueada: true });
  });

  it('salva os campos da nova tabela sem converter Valor em MOD e os recupera no recarregamento e no JSON', () => {
    mount(); click('[data-character-action="new"]');
    edit('estatisticas.energia.valor', '17.5');
    edit('estatisticas.energia.modificador', '-3');
    edit('estatisticas.energia.alteracao', '+2 durante a sessão');
    edit('estatisticas.energia.dr', '4');
    edit('estatisticas.energia.limite', 'Definido pelo mestre');
    edit('estatisticas.energia.talento', '8');
    const expected = { valor: 17.5, modificador: -3, alteracao: '+2 durante a sessão', dr: 4, limite: 'Definido pelo mestre', talento: 8, desbloqueada: false };
    const backup = normalizeCharacter(JSON.parse(encodeCharacter(stored().characters[0].data)!))!;
    expect(backup.rpg!.estatisticas.energia).toEqual(expected);
    mount(); click('[data-character-action="open-character"]');
    for (const [key, value] of Object.entries(expected)) {
      if (typeof value === 'boolean') expect(control(`estatisticas.energia.${key}`).checked).toBe(value);
      else expect(control(`estatisticas.energia.${key}`).value).toBe(String(value));
    }
    expect(stored().characters[0].data.rpg!.estatisticas.energia).toEqual(expected);
  });
});
