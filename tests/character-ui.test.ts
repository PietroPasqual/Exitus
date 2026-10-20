// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARACTER_FILE_LIMIT, CHARACTER_KEY, encodeCharacter, newCharacter, normalizeCharacter, type Character } from '../src/core/character';
import { CHARACTER_LIBRARY_KEY, type CharacterLibrary } from '../src/core/character-library';
import { normalizeProject } from '../src/core/project';
import { applyProject, resetCircle } from '../src/ui/editor';
import { resetHistory } from '../src/ui/history';
import { setupCharacter } from '../src/ui/character';

const editorState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../src/ui/editor', () => ({
  applyProject: vi.fn((project: unknown) => { editorState.current = structuredClone(project); }),
  getProjectData: vi.fn(() => structuredClone(editorState.current)),
  resetCircle: vi.fn((_resetSession?: boolean) => { editorState.current = { nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }], spellInfo: { name: '', desc: '' } }; })
}));
vi.mock('../src/ui/history', () => ({ resetHistory: vi.fn() }));
const pdfText = vi.hoisted(() => ({ extract: vi.fn(async (_data: ArrayBuffer) => '') }));
vi.mock('../src/ui/pdf-import', async importOriginal => ({
  ...await importOriginal<typeof import('../src/ui/pdf-import')>(), extractPdfText: pdfText.extract
}));
vi.mock('../src/ui/store', () => ({ render: vi.fn(), store: { savedCircle: null } }));

function mount(): void {
  document.body.innerHTML = '<nav class="rpg-navigation" hidden><button id="btnCharacterLink" data-rpg-page="personagens"></button><button data-rpg-page="ficha"></button><button data-rpg-page="circulos"></button></nav><div class="workspace"></div><div id="characterPage" hidden></div><select id="presetSelect"></select><div id="fileMenu"></div><button id="btnOpenGrimoire"></button><button id="btnAccount"></button><div id="characterEditorContext" hidden><span id="circleOwnerLabel"></span><span id="circleStatus" role="status"></span><button id="btnReturnCharacter"></button><button id="btnSaveCharacterCircle"></button></div>';
  const shell = document.createElement('div'); shell.id = 'appShell';
  shell.append(...Array.from(document.body.childNodes)); document.body.append(shell);
}
const project = (name: string) => normalizeProject({ nodes: [{ id: 'p', shape: 'prism', lockedCenter: true }], spellInfo: { name, desc: '' } })!;
const click = (selector: string): void => { document.querySelector<HTMLButtonElement>(selector)!.click(); };
const stored = (): CharacterLibrary => JSON.parse(localStorage.getItem(CHARACTER_LIBRARY_KEY)!);
const nameInput = (): HTMLInputElement => document.querySelector<HTMLInputElement>('[data-character-field="nome"]')!;
function change(selector: string, value: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
}
function create(name = ''): void {
  click('[data-character-action="new"]');
  if (name) change('[data-character-field="nome"]', name);
}
function open(id: string): void { click(`[data-character-action="open-character"][data-id="${id}"]`); }
function legacy(data: Character): string {
  const json = JSON.stringify(data); localStorage.setItem(CHARACTER_KEY, json); setupCharacter();
  return json;
}
function openFirst(): void { click('[data-character-action="open-character"]'); }
async function importCharacter(json: string): Promise<void> {
  const input = document.getElementById('characterImport') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [{ size: new TextEncoder().encode(json).byteLength, text: async () => json }] });
  document.getElementById('characterStatus')!.textContent = '';
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.getElementById('characterStatus')!.textContent).toMatch(/importada|Arquivo inválido/));
}
const jsonFile = (name: string, json: string) => ({ name, size: new TextEncoder().encode(json).byteLength, text: async () => json });
async function importFiles(files: ReturnType<typeof jsonFile>[]): Promise<string> {
  const input = document.getElementById('characterImport') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  document.getElementById('characterStatus')!.textContent = '';
  input.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(document.getElementById('characterStatus')!.textContent).toMatch(/importada|Arquivo inválido|Nenhuma ficha/));
  return document.getElementById('characterStatus')!.textContent!;
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); mount(); editorState.current = project('Teste');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

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

describe('Seleção, criação e ficha dos personagens', () => {
  it('começa na seleção e só libera a ficha e o editor depois de criar um personagem', () => {
    setupCharacter();
    expect(document.getElementById('characterPage')!.hidden).toBe(false);
    expect(document.getElementById('characterRosterTitle')).not.toBeNull();
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(true);
    expect(document.getElementById('appShell')!.dataset.rpgView).toBe('personagens');
    expect(document.querySelector<HTMLButtonElement>('[data-rpg-page="ficha"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-rpg-page="circulos"]')!.disabled).toBe(true);
    click('[data-rpg-page="circulos"]');
    expect(resetCircle).not.toHaveBeenCalled();
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBeNull();
    create();
    expect(document.getElementById('characterTitle')).not.toBeNull();
    expect(document.getElementById('appShell')!.dataset.rpgView).toBe('ficha');
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(false);
    expect(document.activeElement).toBe(nameInput());
    expect(document.querySelector<HTMLButtonElement>('[data-rpg-page="circulos"]')!.disabled).toBe(false);
    expect(stored().characters).toHaveLength(1);
  });
  it('edita dois personagens independentemente e retorna à seleção depois de recarregar', () => {
    setupCharacter(); create('Pietro');
    const firstId = stored().characters[0].id;
    nameInput().focus(); change('[data-character-field="nome"]', 'Pietro, o druida');
    expect(document.activeElement).toBe(nameInput());
    click('[data-character-action="add"][data-section="atributos"]');
    change('[data-section="atributos"][data-entry="nome"]', 'Conexão');
    click('[data-character-action="roster"]'); create('Luna');
    const secondId = stored().characters[1].id;
    change('[data-character-field="historia"]', 'Segunda história');
    click('[data-character-action="roster"]'); open(firstId);
    expect(nameInput().value).toBe('Pietro, o druida');
    expect(document.querySelector<HTMLInputElement>('[data-section="atributos"][data-entry="nome"]')!.value).toBe('Conexão');
    expect(stored().characters[1].data.identidade.historia).toBe('Segunda história');
    mount(); setupCharacter();
    expect(document.getElementById('characterRosterTitle')).not.toBeNull();
    expect(document.querySelectorAll('.roster-card')).toHaveLength(2);
    open(secondId); expect(nameInput().value).toBe('Luna');
    expect(document.querySelector('[data-section="atributos"][data-entry="nome"]')).toBeNull();
    expect(document.querySelector<HTMLTextAreaElement>('[data-character-field="historia"]')!.value).toBe('Segunda história');
  });
  it('volta à seleção quando a aplicação entra após autenticação, preservando o personagem', () => {
    setupCharacter(); create('Viajante'); click('[data-character-action="enter-editor"]');
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(false);
    document.getElementById('characterPage')!.dispatchEvent(new Event('rpg:enter'));
    expect(document.getElementById('characterRosterTitle')).not.toBeNull();
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(true);
    openFirst(); expect(nameInput().value).toBe('Viajante');
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(false);
    click('[data-rpg-page="personagens"]');
    expect(document.querySelector<HTMLElement>('.rpg-navigation')!.hidden).toBe(true);
    expect(document.activeElement).toBe(document.getElementById('characterRosterTitle'));
    expect(document.getElementById('btnAccount')!.hidden).toBe(false);
  });
  it('migra a ficha anterior e seus círculos sem apagar nem modificar o backup original', () => {
    const c = newCharacter(); c.identidade.nome = 'Antigo'; c.magias.push({ nome: 'Memória', projeto: project('Memória') });
    const original = legacy(c);
    expect(document.getElementById('characterRosterTitle')).not.toBeNull();
    expect(stored().characters).toHaveLength(1);
    expect(stored().characters[0].data).toEqual(normalizeCharacter(c));
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(original);
    openFirst(); expect(nameInput().value).toBe('Antigo');
    expect(document.querySelectorAll('.character-spell')).toHaveLength(1);
    change('[data-character-field="nome"]', 'Novo nome');
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(original);
    mount(); setupCharacter();
    expect(stored().characters).toHaveLength(1); openFirst();
    expect(nameInput().value).toBe('Novo nome');
  });
  it('não resgata novamente o personagem legado quando a coleção válida já está vazia', () => {
    const c = newCharacter(); c.identidade.nome = 'Antigo'; legacy(c);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    click('[data-character-action="delete-character"]');
    expect(stored().characters).toHaveLength(0);
    mount(); setupCharacter();
    expect(document.querySelectorAll('.roster-card')).toHaveLength(0);
    expect(localStorage.getItem(CHARACTER_KEY)).not.toBeNull();
  });
  it('adiciona campos livres e remove somente com confirmação', () => {
    setupCharacter(); create(); click('[data-character-action="add"][data-section="atributos"]');
    change('[data-section="atributos"][data-entry="nome"]', 'Conexão');
    expect(stored().characters[0].data.secoes.atributos[0].nome).toBe('Conexão');
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    click('[data-character-action="remove"][data-section="atributos"]');
    expect(document.querySelector('[data-entry="nome"]')).not.toBeNull();
    confirmation.mockReturnValue(true); click('[data-character-action="remove"][data-section="atributos"]');
    expect(stored().characters[0].data.secoes.atributos).toHaveLength(0);
  });
  it('duplica sem compartilhar os campos e só exclui o personagem confirmado', () => {
    setupCharacter(); create('Original');
    click('[data-character-action="add"][data-section="atributos"]');
    change('[data-section="atributos"][data-entry="nome"]', 'Força');
    click('[data-character-action="roster"]'); click('[data-character-action="duplicate-character"]');
    expect(stored().characters).toHaveLength(2);
    expect(nameInput().value).not.toBe('Original');
    change('[data-section="atributos"][data-entry="nome"]', 'Magia');
    expect(stored().characters[0].data.secoes.atributos[0].nome).toBe('Força');
    click('[data-character-action="roster"]');
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    click('[data-character-action="delete-character"]'); expect(stored().characters).toHaveLength(2);
    confirmation.mockReturnValue(true); click('[data-character-action="delete-character"]');
    expect(stored().characters).toHaveLength(1);
    expect(stored().characters[0].data.secoes.atributos[0].nome).toBe('Magia');
  });
  it('renderiza nomes, campos e cartões importados como texto sem HTML ativo', () => {
    const c = newCharacter(); c.identidade.nome = '<img src=x onerror=alert(1)>';
    c.identidade.conceito = '<svg onload=alert(1)>';
    c.secoes.habilidades.push({ nome: '"><svg onload=alert(1)>', valor: '', notas: '</textarea><img src=x>' });
    legacy(c);
    expect(document.querySelector('#characterPage img,#characterPage script,#characterPage [onerror],#characterPage [onload],.roster-card svg')).toBeNull();
    expect(document.querySelector('.roster-card h3')!.textContent).toBe(c.identidade.nome);
    openFirst();
    expect(document.querySelector('#characterPage img,#characterPage svg,#characterPage [onerror],#characterPage [onload]')).toBeNull();
    expect(document.getElementById('characterName')!.textContent).toBe(c.identidade.nome);
  });
  it('importa como novo personagem sem substituir a ficha aberta ou pedir confirmação', async () => {
    setupCharacter(); create('Primeiro');
    const original = structuredClone(stored().characters[0]);
    const imported = newCharacter(); imported.identidade.nome = 'Segundo';
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await importCharacter(JSON.stringify(imported));
    expect(confirmation).not.toHaveBeenCalled();
    expect(stored().characters).toHaveLength(2);
    expect(stored().characters[0]).toEqual(original);
    expect(nameInput().value).toBe('Segundo');
  });
  it('confirma a importação com o nome da ficha e avisa quando o nome já existe', async () => {
    setupCharacter(); create('Lia');
    const imported = newCharacter(); imported.identidade.nome = 'Lia';
    const message = await importFiles([jsonFile('lia.json', JSON.stringify(imported))]);
    expect(message).toContain('Ficha “Lia” importada');
    expect(message).toContain('mesmo nome');
    expect(stored().characters.map(c => c.data.identidade.nome)).toEqual(['Lia', 'Lia']);
  });
  it('explica por que um arquivo foi recusado e aceita JSON salvo com BOM', async () => {
    setupCharacter();
    const tooMany = newCharacter(); tooMany.secoes.pericias = Array.from({ length: 51 }, () => ({ nome: '', valor: '', notas: '' }));
    expect(await importFiles([jsonFile('a.json', JSON.stringify(tooMany))])).toContain('a seção “Perícias” tem 51 registros; o limite é 50.');
    expect(await importFiles([jsonFile('b.json', '{ quebrado')])).toContain('não é um JSON válido');
    expect(await importFiles([jsonFile('c.json', JSON.stringify({ nodes: [] }))])).toContain('não é uma ficha de personagem deste site');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBeNull();
    const bom = newCharacter(); bom.identidade.nome = 'Com BOM';
    expect(await importFiles([jsonFile('bom.json', `\uFEFF${JSON.stringify(bom)}`)])).toContain('Ficha “Com BOM” importada');
  });
  it('importa vários arquivos de uma vez, mantém os válidos e lista os recusados', async () => {
    setupCharacter(); create('Existente'); click('[data-character-action="roster"]');
    const a = newCharacter(); a.identidade.nome = 'Aldo';
    const b = newCharacter(); b.identidade.nome = 'Bia';
    const message = await importFiles([jsonFile('aldo.json', JSON.stringify(a)), jsonFile('ruim.json', '[]'), jsonFile('bia.json', JSON.stringify(b))]);
    expect(message).toContain('2 fichas importadas: Aldo, Bia.');
    expect(message).toContain('ruim.json (o arquivo não é uma ficha de personagem deste site.)');
    expect(stored().characters.map(c => c.data.identidade.nome)).toEqual(['Existente', 'Aldo', 'Bia']);
    expect(document.getElementById('characterRosterTitle')).not.toBeNull();
  });
  it('não ultrapassa o limite de personagens ao importar vários arquivos', async () => {
    const full: CharacterLibrary = { kind: 'circulos-rpg-library', version: 1, characters: Array.from({ length: 23 }, (_, i) => {
      const c = newCharacter(); c.identidade.nome = `P${i}`; return { id: `p${i}`, data: c };
    }) };
    localStorage.setItem(CHARACTER_LIBRARY_KEY, JSON.stringify(full)); setupCharacter();
    const files = ['X', 'Y'].map(name => { const c = newCharacter(); c.identidade.nome = name; return jsonFile(`${name}.json`, JSON.stringify(c)); });
    const message = await importFiles(files);
    expect(message).toContain('Ficha “X” importada.');
    expect(message).toContain('Y.json (o limite é de 24 personagens neste navegador)');
    expect(stored().characters).toHaveLength(24);
  });
  it('importa a ficha escrita em texto e informa o que foi reconhecido', async () => {
    setupCharacter();
    const message = await importFiles([jsonFile('Kael.md', '# Kael\n\nIdade: 30\nRaça: Anão\nSigno: Sol\n')]);
    expect(message).toContain('Ficha “Kael” importada');
    expect(message).toContain('2 informações reconhecidas');
    expect(message).toContain('Campos não reconhecidos: Signo.');
    expect(stored().characters[0].data.rpg!.descricao).toMatchObject({ idade: 30, raca: 'Anão' });
    expect(nameInput().value).toBe('Kael');
    expect(await importFiles([jsonFile('lista.txt', 'leite, pão')])).toContain('não encontrei informações de ficha');
    expect(stored().characters).toHaveLength(1);
  });
  it('importa a ficha em PDF pelo texto extraído e explica PDFs sem texto', async () => {
    setupCharacter();
    const { PdfReadError } = await import('../src/ui/pdf-import');
    pdfText.extract.mockResolvedValueOnce('# Kael\nIdade: 30\n| STATUS | MOD | ALT | DR |\n| Poder (4) | -16 / ?? |  |  |');
    const pdf = { ...jsonFile('Kael.pdf', ''), type: 'application/pdf', arrayBuffer: async () => new ArrayBuffer(8) };
    const message = await importFiles([pdf]);
    expect(pdfText.extract).toHaveBeenCalledTimes(1);
    expect(message).toContain('Ficha “Kael” importada');
    expect(message).toContain('informações reconhecidas no PDF');
    const rpg = stored().characters[0].data.rpg!;
    expect(rpg.descricao.idade).toBe(30);
    expect(rpg.estatisticas.poder).toMatchObject({ valor: 4, desbloqueada: false });
    pdfText.extract.mockRejectedValueOnce(new PdfReadError('o PDF não tem texto selecionável (parece ser uma imagem ou digitalização).'));
    expect(await importFiles([{ ...pdf, name: 'foto.pdf' }])).toContain('Arquivo inválido: o PDF não tem texto selecionável');
    expect(stored().characters).toHaveLength(1);
  });
  it('importa fichas arrastadas para a página e ignora arrastos sem arquivos', async () => {
    setupCharacter();
    const page = document.getElementById('characterPage')!;
    const c = newCharacter(); c.identidade.nome = 'Arrastada';
    const drag = (type: string, types: string[], files: unknown[] = []) => {
      const evt = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(evt, 'dataTransfer', { value: { types, files, dropEffect: 'none' } });
      page.dispatchEvent(evt); return evt;
    };
    expect(drag('dragover', ['text/plain']).defaultPrevented).toBe(false);
    drag('dragenter', ['Files']);
    expect(page.classList.contains('is-importing')).toBe(true);
    expect(drag('drop', ['Files'], [jsonFile('arrastada.json', JSON.stringify(c))]).defaultPrevented).toBe(true);
    expect(page.classList.contains('is-importing')).toBe(false);
    await vi.waitFor(() => expect(document.getElementById('characterStatus')!.textContent).toContain('Ficha “Arrastada” importada'));
    expect(stored().characters).toHaveLength(1);
  });
  it('não apaga arquivos locais inválidos na inicialização', () => {
    localStorage.setItem(CHARACTER_KEY, '{broken'); setupCharacter();
    expect(localStorage.getItem(CHARACTER_KEY)).toBe('{broken');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBeNull();
    expect(document.getElementById('characterStatus')!.textContent).toContain('Não foi possível ler');
    localStorage.setItem(CHARACTER_LIBRARY_KEY, '{also-broken'); mount(); setupCharacter();
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe('{also-broken');
    expect(document.getElementById('characterStatus')!.textContent).toContain('Não foi possível ler');
  });
});

describe('Círculos vinculados ao personagem', () => {
  it('mantém o nome normalizado da cópia igual na tela, no backup e no navegador', () => {
    setupCharacter(); create('Pietro'); click('[data-character-action="enter-editor"]');
    const longName = 'Memória'.repeat(25);
    editorState.current = project(longName); click('#btnSaveCharacterCircle');
    click('#btnReturnCharacter');
    expect(document.querySelector('.character-spell strong')!.textContent).toBe(longName.slice(0, 120));
    let exported = '';
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { exported = String(parts[0]); } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    click('[data-character-action="download"]');
    expect(JSON.parse(exported)).toEqual(stored().characters[0].data);
    vi.runAllTimers();
  });
  it('abre o editor existente pela ficha, retorna e guarda a cópia no personagem correto', () => {
    setupCharacter(); create('Pietro'); click('[data-character-action="enter-editor"]');
    expect(document.getElementById('appShell')!.dataset.rpgView).toBe('circulos');
    expect(resetCircle).toHaveBeenCalledTimes(1); expect(resetHistory).toHaveBeenCalledTimes(1);
    expect(resetCircle).toHaveBeenCalledWith(true);
    expect(document.getElementById('characterPage')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(false);
    expect(document.getElementById('circleOwnerLabel')!.textContent).toBe('Pietro');
    editorState.current = project('Chama'); click('#btnSaveCharacterCircle');
    expect(stored().characters[0].data.magias[0].nome).toBe('Chama');
    editorState.current = project('Alterado depois');
    expect(stored().characters[0].data.magias[0].projeto.spellInfo?.name).toBe('Chama');
    click('#btnReturnCharacter');
    expect(document.getElementById('appShell')!.dataset.rpgView).toBe('ficha');
    expect(document.querySelector<HTMLElement>('.workspace')!.hidden).toBe(true);
    expect(document.querySelectorAll('.character-spell')).toHaveLength(1);
    click('[data-character-action="open-spell"]');
    expect(applyProject).toHaveBeenLastCalledWith(project('Chama'));
    expect(resetHistory).toHaveBeenCalledTimes(2);
  });
  it('mantém rascunhos de sessão e cópias dos círculos separados ao trocar personagens', () => {
    setupCharacter(); create('Árvore');
    const firstId = stored().characters[0].id;
    click('[data-character-action="enter-editor"]'); editorState.current = project('Raízes');
    click('#btnReturnCharacter'); create('Fênix');
    const secondId = stored().characters[1].id;
    click('[data-character-action="enter-editor"]');
    expect(resetCircle).toHaveBeenCalledTimes(2);
    editorState.current = project('Fogo'); click('#btnSaveCharacterCircle');
    click('[data-rpg-page="personagens"]'); open(firstId); click('[data-character-action="enter-editor"]');
    expect(applyProject).toHaveBeenLastCalledWith(project('Raízes'));
    expect(stored().characters[0].data.magias).toHaveLength(0);
    expect(stored().characters[1].data.magias[0].nome).toBe('Fogo');
    click('#btnSaveCharacterCircle');
    expect(stored().characters[0].data.magias[0].nome).toBe('Raízes');
    click('[data-rpg-page="personagens"]'); open(secondId); click('[data-character-action="enter-editor"]');
    expect(applyProject).toHaveBeenLastCalledWith(project('Fogo'));
    expect(document.getElementById('circleOwnerLabel')!.textContent).toBe('Fênix');
    expect(resetHistory).toHaveBeenCalledTimes(4);
  });
  it('avisa quando o armazenamento falha e conserva as alterações na sessão', () => {
    setupCharacter(); create('Seguro');
    const before = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    click('[data-character-action="add"][data-section="recursos"]');
    expect(document.getElementById('characterStatus')!.textContent).toContain('Não foi possível salvar');
    expect(document.querySelector('[data-section="recursos"][data-entry="nome"]')).not.toBeNull();
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
  });
});

describe('Limites e backups da ficha', () => {
  it('recusa edição ou círculo que excederia o limite sem alterar a ficha ou o foco', () => {
    localStorage.setItem(CHARACTER_KEY, nearLimitJson); setupCharacter(); openFirst();
    const before = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    const name = nameInput(); name.focus(); change('[data-character-field="nome"]', 'Árvore antiga');
    expect(name.value).toBe('Seguro'); expect(document.activeElement).toBe(name);
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
    expect(document.getElementById('characterStatus')!.textContent).toContain('não foi aplicada');
    click('[data-character-action="enter-editor"]'); editorState.current = project('Teste'); click('#btnSaveCharacterCircle');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
    expect(document.getElementById('circleStatus')!.textContent).toContain('não foi aplicada');
    click('#btnReturnCharacter'); expect(document.querySelectorAll('.character-spell')).toHaveLength(19);
    change('[data-entry="valor"]', 'Muito maior');
    expect(document.querySelector<HTMLInputElement>('[data-entry="valor"]')!.value).toBe('1');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
    expect(localStorage.getItem(CHARACTER_KEY)).toBe(nearLimitJson);
  });
  it('exporta exatamente o JSON compacto aceito pela importação no limite', () => {
    localStorage.setItem(CHARACTER_KEY, nearLimitJson); setupCharacter(); openFirst();
    let exported = '';
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { exported = String(parts[0]); } });
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); vi.useFakeTimers();
    click('[data-character-action="download"]');
    expect(exported).toBe(nearLimitJson);
    expect(new TextEncoder().encode(exported).byteLength).toBe(CHARACTER_FILE_LIMIT - 1);
    expect(normalizeCharacter(JSON.parse(exported))?.identidade.nome).toBe('Seguro');
    vi.runAllTimers();
  });
  it('não adiciona uma importação se a normalização expandir a ficha além do limite', async () => {
    setupCharacter(); create('Existente');
    const before = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    const raw = JSON.parse(nearLimitJson); raw.identidade.nome = '界'.repeat(160);
    // O arquivo pequeno omite defaults que serão acrescentados ao normalizar.
    for (const spell of raw.magias) for (const node of spell.projeto.nodes) delete node.size;
    const json = JSON.stringify(raw);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(CHARACTER_FILE_LIMIT);
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await importCharacter(json);
    expect(document.getElementById('characterStatus')!.textContent).toContain('Arquivo inválido');
    expect(confirmation).not.toHaveBeenCalled();
    expect(nameInput().value).toBe('Existente');
    expect(localStorage.getItem(CHARACTER_LIBRARY_KEY)).toBe(before);
  });
});
