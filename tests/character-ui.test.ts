// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_KEY, newCharacter } from '../src/core/character';
import { setupCharacter } from '../src/ui/character';

vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: () => ({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }], spellInfo: { name: 'Teste', desc: '' } }) }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<button data-rpg-page="circulos"></button><button id="btnCharacterLink" data-rpg-page="ficha"></button><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button>';
});
afterEach(() => vi.restoreAllMocks());
const click = (selector: string): void => { document.querySelector<HTMLButtonElement>(selector)!.click(); };

describe('Ficha no editor', () => {
  it('alterna entre ficha e círculos e salva identidade sem perder foco', () => {
    setupCharacter(); click('[data-rpg-page="ficha"]');
    expect(document.getElementById('characterPage')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(true);
    const name = document.querySelector<HTMLInputElement>('[data-character-field="nome"]')!;
    name.focus(); name.value = 'Pietro'; name.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(name);
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)!).identidade.nome).toBe('Pietro');
    click('[data-rpg-page="circulos"]');
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(false);
    expect(document.getElementById('btnAccount')!.hidden).toBe(false);
  });
  it('adiciona campos livres, persiste e remove somente com confirmação', () => {
    setupCharacter(); click('[data-character-action="add"][data-section="atributos"]');
    const input = document.querySelector<HTMLInputElement>('[data-section="atributos"][data-entry="nome"]')!;
    input.value = 'Conexão'; input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)!).secoes.atributos[0].nome).toBe('Conexão');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    click('[data-character-action="remove"][data-section="atributos"]');
    expect(document.querySelector('[data-entry="nome"]')).not.toBeNull();
  });
  it('renderiza texto importado como texto, sem criar HTML ativo', () => {
    const c = newCharacter(); c.identidade.nome = '<img src=x onerror=alert(1)>';
    c.secoes.habilidades.push({ nome: '"><svg onload=alert(1)>', valor: '', notas: '</textarea><img src=x>' });
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(c)); setupCharacter();
    expect(document.querySelector('#characterPage img,#characterPage [onerror],#characterPage [onload]')).toBeNull();
    expect(document.getElementById('characterName')!.textContent).toBe(c.identidade.nome);
  });
  it('guarda uma cópia do círculo atual e avisa quando o armazenamento falha', () => {
    setupCharacter(); click('[data-character-action="attach"]');
    expect(JSON.parse(localStorage.getItem(CHARACTER_KEY)!).magias[0].nome).toBe('Teste');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    click('[data-character-action="add"][data-section="recursos"]');
    expect(document.getElementById('characterStatus')!.textContent).toContain('Não foi possível salvar');
  });
  it('não apaga um arquivo local inválido na inicialização', () => {
    localStorage.setItem(CHARACTER_KEY, '{broken'); setupCharacter();
    expect(localStorage.getItem(CHARACTER_KEY)).toBe('{broken');
    expect(document.getElementById('characterStatus')!.textContent).toContain('Não foi possível ler');
  });
});
