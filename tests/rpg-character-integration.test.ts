// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_KEY, encodeCharacter, newCharacter, normalizeCharacter, type Character } from '../src/core/character';
import { CHARACTER_LIBRARY_KEY, type CharacterLibrary } from '../src/core/character-library';
import { normalizeProject } from '../src/core/project';
import { setupCharacter } from '../src/ui/character';

const editorState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../src/ui/editor', () => ({
  applyProject: vi.fn((project: unknown) => { editorState.current = structuredClone(project); }),
  getProjectData: vi.fn(() => structuredClone(editorState.current)),
  resetCircle: vi.fn(() => { editorState.current = { nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }] }; })
}));
vi.mock('../src/ui/history', () => ({ resetHistory: vi.fn() }));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

function mount(): void {
  document.body.innerHTML = '<button id="btnCharacterLink" data-rpg-page="personagens"></button><button data-rpg-page="ficha"></button><button data-rpg-page="circulos"></button><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button><div id="characterEditorContext" hidden><span id="circleOwnerLabel"></span><span id="circleStatus" role="status"></span><button id="btnReturnCharacter"></button><button id="btnSaveCharacterCircle"></button></div>';
}
function click(selector: string): void {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button, `Botão ausente: ${selector}`).not.toBeNull();
  button!.click();
}
function edit(selector: string, value: string): void {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
  expect(element, `Campo ausente: ${selector}`).not.toBeNull();
  element!.value = value;
  element!.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const field = (path: string): string => `[data-rpg-field="${path}"]`;
const editRpg = (path: string, value: string): void => edit(field(path), value);
const value = (path: string): string => document.querySelector<HTMLInputElement>(field(path))!.value;
const stored = (): CharacterLibrary => JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY)!);
const first = (): Character => stored().characters[0].data;
function create(name = 'Árvore'): void {
  click('[data-character-action="new"]');
  edit('[data-character-field="nome"]', name);
}
function counter(collection: string): string {
  return document.querySelector(`[data-rpg-action="add-${collection}"]`)!.closest('.rpg-list-heading')!.querySelector('.rpg-counter')!.textContent!;
}
const add = (collection: string): void => click(`[data-rpg-action="add-${collection}"]`);
const openFirst = (): void => click('[data-character-action="open-character"]');
async function importCharacter(character: unknown): Promise<void> {
  const json = JSON.stringify(character);
  const input = document.getElementById('characterImport') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [{ size: new TextEncoder().encode(json).byteLength, text: async () => json }] });
  document.getElementById('characterStatus')!.textContent = '';
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.getElementById('characterStatus')!.textContent).toMatch(/importada|Arquivo inválido/));
}

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mount();
  editorState.current = normalizeProject({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }] });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Regras de criação integradas à seleção e à persistência de personagens', () => {
  // Reconstrói a ficha completa a cada transição; reserva margem para a CPU do CI.
  it('recalcula espaços por arquétipo sem apagar subclasses, perícias ou talentos já registrados', { timeout: 10_000 }, () => {
    setupCharacter(); create();
    editRpg('arquetipo', 'ramo');
    expect(counter('subclasses')).toBe('0/2');
    add('subclasses'); editRpg('progressao.subclasses.0.nome', 'Guardião');
    add('subclasses');
    expect(document.activeElement).toBe(document.querySelector(field('progressao.subclasses.1.nome')));
    editRpg('progressao.subclasses.1.nome', 'Druida');
    expect(document.querySelector<HTMLButtonElement>('[data-rpg-action="add-subclasses"]')!.disabled).toBe(true);

    editRpg('arquetipo', 'justo');
    expect(counter('subclasses')).toBe('2/1');
    expect(value('progressao.subclasses.1.nome')).toBe('Druida');
    expect(counter('pericias')).toBe('0/4');
    editRpg('progressao.avancos', '2');
    expect(counter('pericias')).toBe('0/6');
    for (let index = 0; index < 6; index++) add('pericias');
    editRpg('pericias.5.nome', 'Sobrevivência');

    editRpg('arquetipo', 'tales');
    editRpg('progressao.ascensoes', '1');
    expect(counter('talentos')).toBe('0/8');
    expect(counter('pericias')).toBe('6/3');
    expect(value('pericias.5.nome')).toBe('Sobrevivência');
    for (let index = 0; index < 8; index++) add('talentos');
    editRpg('progressao.talentos.7.nome', 'Memória ancestral');
    editRpg('arquetipo', 'ramo');
    expect(counter('talentos')).toBe('8/1');
    expect(value('progressao.talentos.7.nome')).toBe('Memória ancestral');
    expect(first().rpg!.progressao.subclasses.map(row => row.nome)).toEqual(['Guardião', 'Druida']);
    expect(first().rpg!.pericias).toHaveLength(6);
    expect(first().rpg!.progressao.talentos).toHaveLength(8);
    expect(document.querySelector('.rpg-over-limit')!.textContent).toMatch(/2\/1|8\/1/);
  });

  it('atualiza fórmulas ao editar MOD e preserva valores de estatística e recursos manuais', () => {
    setupCharacter(); create();
    editRpg('recursos.vida.atual', '19'); editRpg('recursos.vida.maximo', '80');
    editRpg('estatisticas.constituicao.valor', '99');
    editRpg('estatisticas.constituicao.modificador', '2');
    const life = Array.from(document.querySelectorAll('.rpg-resource')).find(resource => resource.querySelector('h4')?.textContent === 'Vida')!;
    expect(life.querySelector('.rpg-resource-formula strong')!.textContent).toBe('145');
    expect(value('estatisticas.constituicao.valor')).toBe('99');
    expect(value('recursos.vida.atual')).toBe('19');
    expect(value('recursos.vida.maximo')).toBe('80');
    expect(first().rpg!.estatisticas.constituicao).toMatchObject({ valor: 99, modificador: 2 });
    expect(first().rpg!.recursos.vida).toEqual({ atual: 19, maximo: 80 });
    editRpg('estatisticas.constituicao.valor', '150');
    expect(value('estatisticas.constituicao.modificador')).toBe('2');
  });

  it('restaura o último DR inteiro salvo quando uma edição fracionária é abandonada', () => {
    setupCharacter(); create();
    editRpg('estatisticas.forca.dr', '3');
    const before = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    editRpg('estatisticas.forca.dr', '1.5');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
    document.querySelector<HTMLInputElement>(field('estatisticas.forca.dr'))!.dispatchEvent(new Event('focusout', { bubbles: true }));
    expect(value('estatisticas.forca.dr')).toBe('3');
    expect(first().rpg!.estatisticas.forca.dr).toBe(3);
    expect(document.getElementById('characterStatus')!.textContent).toContain('Valor inválido');
  });

  it('salva e recarrega detalhes de perícias e local de inventário também no backup normalizado', () => {
    setupCharacter(); create(); add('pericias'); add('inventario');
    const skill = {
      nome: 'Botânica', etapa: 'Despertar', grau: 'II', execucao: 'Consenso', tipo: 'Dádiva',
      efeito: 'Reconhecer plantas', condicao: 'Em uma floresta', complementar: 'Fotossíntese', fundamentos: 'Vivência ancestral'
    };
    for (const [key, text] of Object.entries(skill)) editRpg(`pericias.0.${key}`, text);
    const item = { nome: 'Semente antiga', quantidade: '3', rank: 'E', local: 'Acesso rápido', notas: 'Guardada em um frasco' };
    for (const [key, text] of Object.entries(item)) editRpg(`inventario.0.${key}`, text);
    editRpg('estado', 'Fragmentado');
    const backup = normalizeCharacter(JSON.parse(encodeCharacter(first())!))!;
    expect(backup.rpg!.pericias).toEqual([skill]);
    expect(backup.rpg!.inventario).toEqual([item]);
    mount(); setupCharacter(); openFirst();
    expect(value('pericias.0.execucao')).toBe('Consenso');
    expect(value('pericias.0.tipo')).toBe('Dádiva');
    expect(value('pericias.0.fundamentos')).toBe(skill.fundamentos);
    expect(value('inventario.0.local')).toBe('Acesso rápido');
    expect(value('estado')).toBe('Fragmentado');
    expect(stored().characters[0].data).toEqual(backup);
  });

  it('preserva elementos etérios e sua porcentagem manual ao recarregar e normalizar o backup', () => {
    setupCharacter(); create();
    add('etereos');
    editRpg('elementos.etereos.0.nome', 'Fogo');
    editRpg('elementos.etereos.0.valor', '0,1%');
    editRpg('elementos.etereos.0.notas', 'Resultado confirmado na roleta com o mestre.');
    const expected = { nome: 'Fogo', valor: '0,1%', notas: 'Resultado confirmado na roleta com o mestre.' };
    const backup = normalizeCharacter(JSON.parse(encodeCharacter(first())!))!;
    expect(backup.rpg!.elementos.etereos).toEqual([expected]);
    mount(); setupCharacter(); openFirst();
    expect(value('elementos.etereos.0.nome')).toBe('Fogo');
    expect(value('elementos.etereos.0.valor')).toBe('0,1%');
    expect(value('elementos.etereos.0.notas')).toBe(expected.notas);
    expect(first().rpg!.elementos.etereos).toEqual([expected]);
  });

  it('duplica a ficha completa e mantém suas listas e recursos independentes entre personagens', () => {
    setupCharacter(); create('Original');
    editRpg('arquetipo', 'ente'); add('runas');
    editRpg('elementos.runas.0.nome', 'Fogo'); editRpg('recursos.energia.atual', '4');
    const originalId = stored().characters[0].id;
    click('[data-character-action="roster"]'); click('[data-character-action="duplicate-character"]');
    editRpg('elementos.runas.0.nome', 'Água'); editRpg('recursos.energia.atual', '9');
    const duplicateId = stored().characters[1].id;
    expect(stored().characters[0].data.rpg!.elementos.runas[0].nome).toBe('Fogo');
    expect(stored().characters[0].data.rpg!.recursos.energia.atual).toBe(4);
    mount(); setupCharacter();
    click(`[data-character-action="open-character"][data-id="${originalId}"]`);
    expect(value('elementos.runas.0.nome')).toBe('Fogo'); expect(value('recursos.energia.atual')).toBe('4');
    click('[data-character-action="roster"]');
    click(`[data-character-action="open-character"][data-id="${duplicateId}"]`);
    expect(value('elementos.runas.0.nome')).toBe('Água'); expect(value('recursos.energia.atual')).toBe('9');
  });

  it('preserva uma ficha antiga sem RPG e só adiciona o esquema quando o usuário começa a preenchê-lo', () => {
    const old = newCharacter(); delete old.rpg;
    old.identidade.nome = 'Legado'; old.identidade.historia = 'Era uma árvore.';
    old.secoes.atributos.push({ nome: 'Fotossíntese', valor: '3', notas: 'Depende da luz.' });
    old.magias.push({ nome: 'Raízes', projeto: normalizeProject({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }], spellInfo: { name: 'Raízes', desc: '' } })! });
    const original = JSON.stringify(old);
    expect(normalizeCharacter(JSON.parse(original))).toEqual(old);
    localStorage.setItem(CHARACTER_KEY, original); setupCharacter(); openFirst();
    expect(first().rpg).toBeUndefined();
    expect(document.querySelectorAll('.character-spell')).toHaveLength(1);
    edit('[data-character-field="nome"]', 'Legado preservado');
    expect(first().rpg).toBeUndefined();
    editRpg('descricao.raca', 'Árvore humanoide');
    expect(first().rpg!.descricao.raca).toBe('Árvore humanoide');
    expect(first().identidade.historia).toBe(old.identidade.historia);
    expect(first().secoes).toEqual(old.secoes);
    expect(first().magias).toEqual(old.magias);
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(original);
  });

  it('recusa importar RPG conhecido mas inválido e mantém todos os personagens salvos', async () => {
    setupCharacter(); create('Seguro');
    const invalid = newCharacter(); invalid.rpg!.inventario.push({ nome: 'Item', quantidade: '1', rank: 'E', local: 'Local desconhecido' as never, notas: '' });
    expect(normalizeCharacter(invalid)).toBeNull();
    const before = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    await importCharacter(invalid);
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
    expect(document.getElementById('characterStatus')!.textContent).toContain('Arquivo inválido');
    const malformed = { ...newCharacter(), rpg: { version: 1 } };
    expect(normalizeCharacter(malformed)).toBeNull();
  });

  it('renderiza textos importados da ficha detalhada sem injetar elementos ou atributos executáveis', () => {
    const character = newCharacter();
    character.rpg!.descricao.raca = '\"><img src=x onerror=alert(1)>';
    character.rpg!.historia.jornada = '</textarea><svg onload=alert(1)>';
    character.rpg!.pericias.push({ nome: '<script>alert(1)</script>', etapa: '', grau: '', execucao: 'Ação', tipo: 'Talento', efeito: '</textarea><img src=x>', condicao: '', complementar: '', fundamentos: '' });
    character.rpg!.inventario.push({ nome: '\" onfocus=alert(1)', quantidade: '1', rank: 'E', local: 'Base', notas: '</textarea><iframe src=javascript:alert(1)>' });
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(character)); setupCharacter(); openFirst();
    expect(document.querySelector('#characterPage img,#characterPage svg:not(.pixel-avatar),#characterPage script,#characterPage iframe,#characterPage [onerror],#characterPage [onload],#characterPage [onfocus]')).toBeNull();
    expect(value('descricao.raca')).toBe(character.rpg!.descricao.raca);
    expect(value('historia.jornada')).toBe(character.rpg!.historia.jornada);
    expect(value('pericias.0.nome')).toBe(character.rpg!.pericias[0].nome);
    expect(value('inventario.0.notas')).toBe(character.rpg!.inventario[0].notas);
  });

  it('registra recursos extras, CRI, rank do status e nível, e mostra o novo recurso com barra', () => {
    setupCharacter(); create();
    expect(counter('recursosExtras')).toBe('0 registro(s)');
    add('recursosExtras');
    editRpg('recursosExtras.0.nome', 'Energia Celestial');
    editRpg('recursosExtras.0.atual', '89.4');
    editRpg('recursosExtras.0.maximo', '110');
    editRpg('estatisticas.forca.critico', '2');
    editRpg('estatisticas.forca.rank', 'E');
    const rpg = first().rpg!;
    expect(rpg.recursosExtras).toEqual([{ nome: 'Energia Celestial', atual: 89.4, maximo: 110 }]);
    expect(rpg.estatisticas.forca).toMatchObject({ critico: 2, rank: 'E' });
    expect(document.querySelector('.rpg-resource-extra .rpg-bar-text')!.textContent).toBe('89,4 / 110');

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    click('[data-rpg-action="remove-recursosExtras"]');
    expect(first().rpg!.recursosExtras).toEqual([]);
  });
});
