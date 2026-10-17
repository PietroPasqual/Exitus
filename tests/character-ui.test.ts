// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_FILE_LIMIT, CHARACTER_KEY, encodeCharacter, newCharacter, normalizeCharacter } from '../src/core/character';
import { normalizeProject } from '../src/core/project';
import { setupCharacter } from '../src/ui/character';

vi.mock('../src/ui/editor', () => ({ applyProject: vi.fn(), getProjectData: () => ({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }], spellInfo: { name: 'Teste', desc: '' } }) }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '<button data-rpg-page="circulos"></button><button id="btnCharacterLink" data-rpg-page="ficha"></button><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button>';
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const click = (selector: string): void => { document.querySelector<HTMLButtonElement>(selector)!.click(); };

// Projetos válidos com menos de 20 círculos, deixando só um byte livre na ficha.
function nearLimitSheet(): string {
  const c = newCharacter(); c.identidade.nome = 'Seguro';
  c.secoes.atributos.push({ nome: 'Força', valor: '1', notas: '' });
  c.magias = Array.from({ length: 19 }, (_, spell) => ({ nome: `Círculo ${spell}`, projeto: normalizeProject({
    nodes: Array.from({ length: 500 }, (_, i) => ({ id: `n${i}`, shape: 'prism', lockedCenter: i === 0, layer: 'x' }))
  })! }));
  let remaining = CHARACTER_FILE_LIMIT - 1 - new TextEncoder().encode(JSON.stringify(c)).byteLength;
  for (const spell of c.magias) for (const node of spell.projeto.nodes) {
    const extra = Math.min(198, remaining);
    node.layer = 'x'.repeat(1 + extra); remaining -= extra;
  }
  if (remaining !== 0) throw new Error('A ficha de teste não alcançou o limite.');
  return encodeCharacter(c)!;
}
const nearLimitJson = nearLimitSheet();

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
  it('recusa edição ou círculo que excederia o limite sem alterar ficha ou foco', () => {
    localStorage.setItem(CHARACTER_KEY, nearLimitJson); setupCharacter();
    const name = document.querySelector<HTMLInputElement>('[data-character-field="nome"]')!;
    name.focus(); name.value = 'Árvore antiga'; name.dispatchEvent(new Event('input', { bubbles: true }));
    expect(name.value).toBe('Seguro');
    expect(document.activeElement).toBe(name);
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(nearLimitJson);
    expect(document.getElementById('characterStatus')!.textContent).toContain('não foi aplicada');
    click('[data-character-action="attach"]');
    expect(document.querySelectorAll('.character-spell')).toHaveLength(19);
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(nearLimitJson);
    expect(document.getElementById('characterStatus')!.textContent).toContain('não foi aplicada');
    const value = document.querySelector<HTMLInputElement>('[data-entry="valor"]')!;
    value.value = 'Muito maior'; value.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value.value).toBe('1');
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(nearLimitJson);
  });
  it('exporta exatamente o JSON compacto aceito pela importação no limite', () => {
    localStorage.setItem(CHARACTER_KEY, nearLimitJson); setupCharacter();
    let exported = '';
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { exported = String(parts[0]); } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    click('[data-character-action="download"]');
    expect(exported).toBe(nearLimitJson);
    expect(new TextEncoder().encode(exported).byteLength).toBe(CHARACTER_FILE_LIMIT - 1);
    expect(normalizeCharacter(JSON.parse(exported))?.identidade.nome).toBe('Seguro');
    vi.runAllTimers();
  });
  it('não substitui a ficha se a normalização da importação exceder o limite', async () => {
    setupCharacter();
    const raw = JSON.parse(nearLimitJson);
    raw.identidade.nome = '界'.repeat(160);
    // O arquivo pequeno omite defaults que serão acrescentados ao normalizar.
    for (const spell of raw.magias) for (const node of spell.projeto.nodes) delete node.size;
    const json = JSON.stringify(raw);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(CHARACTER_FILE_LIMIT);
    const input = document.getElementById('characterImport') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [{ size: new TextEncoder().encode(json).byteLength, text: async () => json }] });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(document.getElementById('characterStatus')!.textContent).toContain('Arquivo inválido'));
    expect(confirm).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('[data-character-field="nome"]')!.value).toBe('');
    expect(localStorage.getItem(CHARACTER_KEY)).toBeNull();
  });
});
