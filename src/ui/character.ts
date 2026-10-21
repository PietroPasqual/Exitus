import {
  CHARACTER_FIELDS, CHARACTER_SECTIONS, CHARACTER_KEY, CHARACTER_FILE_LIMIT, readCharacter,
  newCharacter, normalizeCharacter, encodeCharacter, type Character, type CharacterField, type CharacterSection
} from '../core/character';
import {
  CHARACTER_LIBRARY_KEY, CHARACTER_LIBRARY_LIMIT, CHARACTER_LIBRARY_FILE_LIMIT,
  newCharacterLibrary, normalizeCharacterLibrary, encodeCharacterLibrary, migrateLegacyCharacter,
  type CharacterLibrary, type CharacterRecord
} from '../core/character-library';
import { normalizeProject, copyName } from '../core/project';
import { changeCircleContext } from '../core/editor-context';
import { newRpgSheet, normalizeRpgSheet, RPG_NOTES_LIMIT } from '../core/rpg-sheet';
import { readCharacterText, type CharacterTextOptions } from '../core/character-text';
import { extractPdfText, PDF_FILE_LIMIT, PdfReadError } from './pdf-import';
import { DOCX_FILE_LIMIT, DocxReadError, extractDocxText } from './docx-import';
import type { Project } from '../core/types';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { applyProject, getProjectData, resetCircle } from './editor';
import { resetHistory } from './history';
import { render, store } from './store';
import { handleRpgAction, renderRpgSheet, updateRpgInput } from './rpg-sheet';
import { ARCHETYPES, ARCHETYPE_INTRO } from '../data/rpg-archetypes';
import { RACE_SUGGESTIONS } from '../data/rulebook-races';
import { CLASS_SUGGESTIONS } from '../data/rulebook';
import { AVATAR_PALETTES, newAvatar, type Avatar, type AvatarPart } from '../core/avatar';
import { renderAvatar, renderAvatarPicker } from './avatar';
import { canMaster, isPhone, onModeChange, setMode } from './play-mode';
import { POWER_PATHS, POWER_PATH_IDS, POWER_NOTES_LIMIT, togglePower, type PowerPathId } from '../core/power-paths';
import { renderPowerChoices, renderPowerPaths } from './power-paths';
import { renderSheetNavigation, setupSheetNavigation } from './sheet-navigation';

/** Seleção → ficha → editor. O desenho mantém seu editor e os dados ficam por personagem. */
export function setupCharacter(): void {
  const root = byId('characterPage');
  const sectionNavigation = setupSheetNavigation(root);
  const workspace = document.querySelector<HTMLElement>('.workspace')!;
  let library = newCharacterLibrary();
  let activeId: string | null = null;
  let character = newCharacter();
  let view: 'personagens' | 'ficha' | 'circulos' | 'mesa' | 'campanhas' = 'personagens';
  let persistenceWarning = '';
  let recoveryRequired = false;
  const drafts = new Map<string, Project>();
  try {
    const raw = localStorage.getItem(CHARACTER_LIBRARY_KEY);
    if (raw !== null) {
      const restored = new TextEncoder().encode(raw).byteLength <= CHARACTER_LIBRARY_FILE_LIMIT ? normalizeCharacterLibrary(JSON.parse(raw)) : null;
      if (restored) library = restored;
      else { recoveryRequired = true; persistenceWarning = 'Não foi possível ler os personagens guardados. O conteúdo original foi preservado.'; }
    } else {
      const legacy = localStorage.getItem(CHARACTER_KEY);
      if (legacy) {
        const migrated = new TextEncoder().encode(legacy).byteLength <= CHARACTER_FILE_LIMIT ? migrateLegacyCharacter(JSON.parse(legacy)) : null;
        if (migrated) {
          library = migrated;
          try { localStorage.setItem(CHARACTER_LIBRARY_KEY, encodeCharacterLibrary(library)!); }
          catch { persistenceWarning = 'Sua ficha antiga foi recuperada nesta sessão, mas não pôde ser salva. Baixe o JSON como backup.'; }
        } else { recoveryRequired = true; persistenceWarning = 'Não foi possível ler a ficha antiga. O conteúdo original foi preservado.'; }
      }
    }
  } catch { recoveryRequired = true; persistenceWarning = 'Não foi possível ler os personagens. Nada foi apagado; você pode importar uma ficha ou criar um personagem nesta sessão.'; }

  function status(message: string): void {
    const messageEl = document.getElementById('characterStatus');
    if (messageEl) messageEl.textContent = message;
    const circleMessage = document.getElementById('circleStatus');
    if (circleMessage) {
      circleMessage.textContent = message === 'Rascunho temporário. Guarde na ficha ou exporte o JSON.' ? 'Rascunho · não guardado' : message;
      circleMessage.title = message;
    }
  }
  function record(): CharacterRecord | undefined { return library.characters.find(c => c.id === activeId); }
  function newId(): string {
    let id: string;
    do { id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`; }
    while (library.characters.some(c => c.id === id));
    return id;
  }
  function commitLibrary(next: CharacterLibrary): boolean {
    const json = encodeCharacterLibrary(next);
    if (json === null) { status('O limite de personagens ou de 4 MB do grimório seria ultrapassado. A alteração não foi aplicada.'); return false; }
    if (recoveryRequired && !confirm('Os dados antigos não puderam ser lidos. Salvar esta coleção pode substituí-los. Continuar?')) return false;
    try { localStorage.setItem(CHARACTER_LIBRARY_KEY, json); persistenceWarning = ''; }
    catch { persistenceWarning = 'Não foi possível salvar neste navegador. Suas alterações ficam nesta sessão: baixe os JSONs para guardá-las.'; }
    recoveryRequired = false;
    library = JSON.parse(json) as CharacterLibrary;
    const selected = record();
    if (selected) character = selected.data;
    return true;
  }
  /** `redraw`: true redesenha a ficha inteira; 'rpg' só as seções da ficha RPG que mudaram. */
  function commit(next: Character, redraw: boolean | 'rpg' = false): boolean {
    if (encodeCharacter(next) === null) { status('A alteração ultrapassa o limite de 2 MB da ficha e não foi aplicada. Remova itens ou círculos para liberar espaço.'); return false; }
    if (!activeId) return false;
    if (!commitLibrary({ ...library, characters: library.characters.map(c => c.id === activeId ? { ...c, data: next } : c) })) return false;
    if (redraw === 'rpg') drawRpgSections();
    else if (redraw) drawSheet();
    status(persistenceWarning || 'Salvo neste navegador');
    refreshAvatar();
    const name = document.getElementById('characterName');
    if (name) name.textContent = character.identidade.nome.trim() || 'Seu personagem';
    return true;
  }
  const characterClass = (): string => character.rpg?.progressao.classes.find(entry => entry.nome.trim())?.nome ?? '';
  /** O avatar acompanha a classe: redesenha a prévia quando a ficha muda. */
  function refreshAvatar(): void {
    const host = root.querySelector<HTMLElement>('#character-avatar');
    if (!host) return;
    const html = renderAvatarPicker(character.avatar, characterClass());
    if (host.dataset.rendered !== html) { host.innerHTML = html; host.dataset.rendered = html; }
  }
  function rememberDraft(): void {
    if (view !== 'circulos' || !activeId) return;
    const snapshot = normalizeProject(getProjectData());
    if (snapshot) drafts.set(activeId, snapshot);
  }
  function updateNavigation(): void {
    changeCircleContext();
    document.getElementById('appShell')?.setAttribute('data-rpg-view', view);
    root.hidden = view === 'circulos' || view === 'mesa' || view === 'campanhas';
    workspace.hidden = view !== 'circulos';
    const table = document.getElementById('tablePage');
    if (table) table.hidden = view !== 'mesa';
    const campaigns = document.getElementById('campaignPage');
    if (campaigns) {
      if (view !== 'campanhas' && !campaigns.hidden) campaigns.dispatchEvent(new Event('campanhas:close'));
      campaigns.hidden = view !== 'campanhas';
    }
    // No celular só se joga; a Mesa do mestre aparece no computador com o modo mestre ligado.
    const master = canMaster();
    const modeButton = document.getElementById('btnPlayMode');
    if (modeButton) {
      modeButton.hidden = isPhone();
      modeButton.setAttribute('aria-pressed', String(master));
      modeButton.textContent = master ? 'Modo mestre · ligado' : 'Modo mestre';
    }
    const navigation = document.querySelector<HTMLElement>('.rpg-navigation');
    if (navigation) navigation.hidden = false;
    for (const id of ['presetSelect', 'fileMenu', 'btnOpenGrimoire']) byId(id).hidden = view !== 'circulos';
    const contextLabel = document.querySelector<HTMLElement>('.character-context-label');
    if (contextLabel) contextLabel.textContent = view === 'mesa' ? 'Mapa, tokens e dados da sessão' : view === 'campanhas' ? 'Jogue com o seu grupo' : activeId ? character.identidade.nome.trim() || 'Personagem sem nome' : 'Escolha ou crie um personagem para começar';
    const context = document.getElementById('characterEditorContext');
    if (context) context.hidden = view !== 'circulos';
    const owner = document.getElementById('circleOwnerLabel');
    if (owner) owner.textContent = character.identidade.nome.trim() || 'Personagem sem nome';
    document.querySelectorAll<HTMLButtonElement>('[data-rpg-page]').forEach(button => {
      const target = button.dataset.rpgPage;
      const active = target === view;
      button.disabled = target !== 'personagens' && target !== 'mesa' && target !== 'campanhas' && !activeId;
      if (target === 'mesa') button.hidden = !master;
      // O ateliê de círculos é a ferramenta do caminho da Mana: abre pela ficha, não pelo menu.
      if (target === 'circulos') button.hidden = view !== 'circulos';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (view === 'ficha') sectionNavigation.refresh();
    else sectionNavigation.clear();
  }
  function openRoster(focus = true): void {
    rememberDraft(); view = 'personagens'; drawRoster(); updateNavigation();
    if (focus) byId('characterRosterTitle').focus({ preventScroll: true });
    root.scrollTop = 0;
  }
  /** Campanhas online: a página é desenhada por campaigns ao receber `campanhas:open`. */
  function openCampaigns(campanhaId?: string): boolean {
    const page = document.getElementById('campaignPage');
    if (!page) return false;
    creation = null;
    rememberDraft(); view = 'campanhas'; updateNavigation();
    page.dispatchEvent(new CustomEvent('campanhas:open', { detail: campanhaId ? { campanhaId } : null }));
    return true;
  }
  /** Mesa do Mestre: a página é desenhada por game-table ao receber `mesa:open`. */
  function openTable(): void {
    const table = document.getElementById('tablePage');
    if (!table || !canMaster()) return;
    rememberDraft(); view = 'mesa'; updateNavigation();
    table.dispatchEvent(new Event('mesa:open'));
  }
  function openCharacter(id: string): void {
    const selected = library.characters.find(c => c.id === id);
    if (!selected) return;
    rememberDraft(); activeId = id; character = selected.data; view = 'ficha';
    drawSheet(); updateNavigation(); byId('characterTitle').focus({ preventScroll: true });
    root.scrollTop = 0;
  }
  function openEditor(project?: Project): void {
    if (!activeId || !record()) { openRoster(); status('Selecione ou crie um personagem antes de abrir o editor.'); return; }
    if (view === 'circulos' && !project) return;
    const draft = project ?? drafts.get(activeId);
    if (draft) applyProject(normalizeProject(draft)!);
    else resetCircle(true);
    store.savedCircle = null;
    resetHistory();
    view = 'circulos'; updateNavigation(); render();
    status('Rascunho temporário. Guarde na ficha ou exporte o JSON.');
    document.getElementById('btnReturnCharacter')?.focus();
  }
  function bindImport(): void {
    byId<HTMLInputElement>('characterImport').addEventListener('change', evt => {
      const input = evt.target as HTMLInputElement;
      const files = Array.from(input.files ?? []); input.value = '';
      void importFiles(files);
    });
  }
  /** Criação guiada: as escolhas principais primeiro, a ficha completa depois. */
  const CREATION_STEPS = ['Quem é', 'Origem', 'Aparência', 'Arquétipo', 'Poderes', 'Revisão'] as const;
  type CreationDraft = { nome: string; jogador: string; campanha: string; conceito: string; raca: string; idade: string; sexo: string; origem: string; classe: string; arquetipo: string };
  let creation: CreationDraft | null = null;
  let creationAvatar: Avatar = newAvatar();
  let creationPowers = new Set<PowerPathId>();
  /** Campanha em que o personagem está sendo criado (vem da página da campanha). */
  let creationCampaign: { campanhaId: string; campanhaNome: string } | null = null;
  let creationStep = 0;
  function openCreation(campaign: { campanhaId: string; campanhaNome: string } | null = null): void {
    if (library.characters.length >= CHARACTER_LIBRARY_LIMIT) { status('O limite é de 24 personagens neste navegador.'); return; }
    rememberDraft(); view = 'personagens';
    creationCampaign = campaign;
    creation = { nome: '', jogador: '', campanha: campaign?.campanhaNome ?? '', conceito: '', raca: '', idade: '', sexo: '', origem: '', classe: '', arquetipo: '' };
    creationAvatar = newAvatar();
    creationPowers = new Set();
    creationStep = 0; drawCreation(); updateNavigation();
    root.scrollTop = 0;
  }
  function creationProblem(step: number): string {
    if (!creation) return '';
    if (step === 0 && !creation.nome.trim()) return 'Dê um nome ao personagem para continuar.';
    if (step === 1 && creation.idade.trim() && !/^\d{1,6}$/.test(creation.idade.trim())) return 'A idade precisa ser um número inteiro de anos (ou fique em branco).';
    return '';
  }
  function drawCreation(): void {
    if (!creation) return;
    sectionNavigation.clear();
    const c = creation;
    const field = (key: keyof CreationDraft, label: string, extra = '', help = ''): string => `<label class="character-field"><span>${label}</span><input data-creation-field="${key}" maxlength="${key === 'nome' ? 160 : 120}" value="${escapeHtml(c[key])}" autocomplete="off"${extra}>${help ? `<small class="creation-help">${help}</small>` : ''}</label>`;
    const archetype = ARCHETYPES.find(item => item.id === c.arquetipo);
    const steps = [
      `<div class="character-fields">${field('nome', 'Nome do personagem *', ' required')}${field('jogador', 'Jogador')}${field('campanha', 'Campanha / mesa')}${field('conceito', 'Conceito', '', 'Uma frase: “druida exilado que busca a árvore-mãe”.')}</div>`,
      `<div class="character-fields">${field('raca', 'Raça', ' list="creation-races"', 'Espécie e classificação, como no Livro de Regras.')}${field('origem', 'Origem', '', 'Terra natal, família, ofício…')}${field('idade', 'Idade em anos', ' inputmode="numeric"')}${field('sexo', 'Sexo')}</div><datalist id="creation-races">${RACE_SUGGESTIONS.map(race => `<option value="${escapeHtml(race)}"></option>`).join('')}</datalist>`,
      `<div class="character-fields">${field('classe', 'Classe (opcional)', ' list="creation-classes"', 'A roupa do avatar acompanha a classe. Dá para escolher depois na ficha.')}</div><datalist id="creation-classes">${CLASS_SUGGESTIONS.map(name => `<option value="${escapeHtml(name)}"></option>`).join('')}</datalist><div id="creationAvatar">${renderAvatarPicker(creationAvatar, c.classe)}</div>`,
      `<p class="character-help">${escapeHtml(ARCHETYPE_INTRO)}</p><div class="creation-archetypes" role="radiogroup" aria-label="Arquétipo">${[{ id: '', nome: 'Decidir depois', especial: 'com o mestre', descricao: 'Crie a ficha agora e escolha o arquétipo quando a mesa decidir. Dá para mudar a qualquer momento na ficha.', vantagens: [] as string[], desvantagens: [] as string[] }, ...ARCHETYPES].map(item => `<label class="creation-archetype${item.id === c.arquetipo ? ' is-selected' : ''}"><input type="radio" name="creation-archetype" data-creation-field="arquetipo" value="${item.id}"${item.id === c.arquetipo ? ' checked' : ''}><span class="creation-archetype-name">${escapeHtml(item.nome)} <small>${escapeHtml(item.especial)}</small></span><span class="creation-archetype-text">${escapeHtml(item.descricao)}</span>${item.vantagens.length ? `<details><summary>Vantagens e desvantagens</summary><div class="rpg-rule-columns"><div><h4>Vantagens</h4><ul>${item.vantagens.map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul></div><div><h4>Desvantagens</h4><ul>${item.desvantagens.map(rule => `<li>${escapeHtml(rule)}</li>`).join('')}</ul></div></div></details>` : ''}</label>`).join('')}</div>`,
      `<p class="character-help">Escolha os caminhos de poder que o personagem vai seguir. O círculo mágico é a ferramenta da Mana; Aura, Espada e Relíquias ganham ferramentas próprias aos poucos. Dá para mudar depois na ficha, ou deixar em branco e decidir com o mestre.</p>${renderPowerChoices(creationPowers)}`,
      `<div class="creation-review">${renderAvatar(creationAvatar, c.classe, 96, c.nome || 'Avatar')}<dl class="creation-summary">${([['Nome', c.nome], ['Jogador', c.jogador], ['Campanha', c.campanha], ['Conceito', c.conceito], ['Raça', c.raca], ['Origem', c.origem], ['Idade', c.idade ? `${c.idade} anos` : ''], ['Sexo', c.sexo], ['Classe', c.classe], ['Caminhos de poder', POWER_PATH_IDS.filter(id => creationPowers.has(id)).map(id => POWER_PATHS[id].nome).join(', ') || 'Decidir depois'], ['Arquétipo', archetype ? `${archetype.nome} · ${archetype.especial}` : 'Decidir depois']] as [string, string][]).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value.trim() || '—')}</dd></div>`).join('')}</dl></div><p class="character-help">Ao criar, a ficha completa abre para você continuar: atributos, recursos, perícias, inventário, história e círculos mágicos. As regras que ainda faltam no livro ficam como campos livres para combinar com o mestre.</p>`
    ];
    root.innerHTML = `<div class="character-shell character-creation"><div class="character-breadcrumb"><button class="btn" data-character-action="creation-cancel">← Personagens</button><span>Criação de personagem</span></div>
      <div class="character-heading"><div><p class="character-eyebrow">Novo personagem · etapa ${creationStep + 1} de ${CREATION_STEPS.length}</p><h2 id="creationTitle" tabindex="-1">${CREATION_STEPS[creationStep]}</h2></div></div>
      <ol class="creation-steps" aria-label="Etapas da criação">${CREATION_STEPS.map((label, index) => `<li class="${index === creationStep ? 'is-current' : index < creationStep ? 'is-done' : ''}"${index === creationStep ? ' aria-current="step"' : ''}><button type="button" data-character-action="creation-goto" data-index="${index}"${index > creationStep ? ' disabled' : ''}><span>${index + 1}</span>${label}</button></li>`).join('')}</ol>
      <form class="character-card creation-card" id="creationForm" novalidate>${steps[creationStep]}
        <p class="character-status" id="characterStatus" role="status"></p>
        <div class="creation-actions">${creationStep ? '<button type="button" class="btn" data-character-action="creation-back">← Voltar</button>' : '<button type="button" class="btn" data-character-action="creation-cancel">Cancelar</button>'}
        ${creationStep < CREATION_STEPS.length - 1 ? '<button type="submit" class="btn btn-primary">Continuar →</button>' : '<button type="submit" class="btn btn-primary">Criar ficha →</button>'}</div>
      </form></div>`;
    const form = root.querySelector<HTMLFormElement>('#creationForm')!;
    form.addEventListener('submit', evt => { evt.preventDefault(); advanceCreation(); });
    (root.querySelector<HTMLElement>('[data-creation-field]:checked, input[data-creation-field]:not([type="radio"])') ?? byId('creationTitle')).focus({ preventScroll: true });
  }
  function advanceCreation(): void {
    if (!creation) return;
    const problem = creationProblem(creationStep);
    if (problem) { status(problem); root.querySelector<HTMLInputElement>('[data-creation-field="nome"], [data-creation-field="idade"]')?.focus(); return; }
    if (creationStep < CREATION_STEPS.length - 1) { creationStep++; drawCreation(); root.scrollTop = 0; return; }
    const c = creation;
    const data = newCharacter();
    data.identidade = { ...data.identidade, nome: c.nome.trim(), jogador: c.jogador.trim(), campanha: c.campanha.trim(), conceito: c.conceito.trim(), origem: c.origem.trim() };
    const sheet = data.rpg ?? newRpgSheet();
    data.rpg = {
      ...sheet, arquetipo: c.arquetipo,
      descricao: { ...sheet.descricao, raca: c.raca.trim(), sexo: c.sexo.trim(), idade: c.idade.trim() ? Number(c.idade.trim()) : null },
      progressao: { ...sheet.progressao, classes: c.classe.trim() ? [{ nome: c.classe.trim(), valor: '', notas: '' }] : sheet.progressao.classes }
    };
    data.avatar = { ...creationAvatar };
    if (creationPowers.size) data.poderes = { caminhos: POWER_PATH_IDS.filter(id => creationPowers.has(id)), notas: {} };
    const campaign = creationCampaign;
    if (campaign) data.campanhaId = campaign.campanhaId;
    creation = null; creationCampaign = null;
    addCharacter(data, `“${data.identidade.nome}” foi criado${campaign ? ` na campanha “${campaign.campanhaNome}”` : ''}. Continue a ficha: atributos, recursos, perícias e história.`);
    if (campaign && activeId) window.dispatchEvent(new CustomEvent('existus:personagem-criado', { detail: { characterId: activeId, campanhaId: campaign.campanhaId } }));
  }
  function drawRoster(): void {
    creation = null;
    sectionNavigation.clear();
    const count = library.characters.length;
    const full = count >= CHARACTER_LIBRARY_LIMIT ? ' disabled' : '';
    root.innerHTML = `<div class="character-roster illuminated-roster${count ? ' has-characters' : ''}"><div class="roster-shell">
      <header class="roster-heading"><div class="roster-heading-copy"><p class="character-eyebrow"><span aria-hidden="true">I</span> O seu grimório</p><h2 id="characterRosterTitle" tabindex="-1">Arquivo de <br><em>personagens.</em></h2><p>${count ? 'Fichas, jornadas e círculos em um só arquivo.' : 'Cada personagem, uma história por escrever. Abra sua ficha, registre a jornada e dê forma às suas magias.'}</p>
      <div class="roster-actions"><button class="btn btn-primary" data-character-action="create"${full}><span aria-hidden="true">+</span> Criar personagem</button><button class="btn" data-character-action="new"${full}>Ficha em branco</button><button class="btn" data-character-action="import"${full}>Importar ficha <span aria-hidden="true">↗</span></button></div></div>
      <div class="roster-frontispiece" aria-hidden="true"><span class="roster-frontispiece-caption">Fichas · Histórias · Círculos</span><svg viewBox="0 0 300 310" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M64 52 208 37l26 203-145 17z" fill="currentColor" fill-opacity=".035"/><path d="M64 52 208 37l26 203-145 17zM75 60l124-13 23 184-124 14z" stroke="currentColor" stroke-width="1.2"/><path d="m95 81 81-8M98 91l58-6m-43 115 80-8m-78 16 59-6" stroke="currentColor" stroke-width="1"/><path d="M136 112c-17 5-26 22-23 37 3 17 18 28 34 26s28-16 27-33c-1-18-18-32-38-30Z" stroke="currentColor"/><path d="m143 125 4 32m-14-23 20 17m-23-7 25-3" stroke="currentColor" stroke-linecap="round"/><path d="M216 269c-13-34-8-82 18-126m-16 102c12-4 22-13 24-26-14 0-24 8-27 18m1-11c-11-9-16-21-10-33 12 7 16 18 11 29m5-23c13-3 24-12 26-25-13 0-23 8-27 18m8-24c-7-12-7-23 2-33 9 11 8 24 2 31M79 275c-21-17-32-44-28-78m12 61c-14 0-25-6-29-17 13-3 24 1 28 12m-7-19c9-6 13-16 10-26-11 4-16 12-13 23m0-24c-11-4-17-13-15-24 12 2 18 10 15 20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 67h-9m4-4v8m213 30h-9m4-4v8M86 16h-6m3-3v6m173 181h-6m3-3v6" stroke="currentColor"/><path d="M83 284h134" stroke="currentColor" stroke-opacity=".4"/></svg><span class="roster-frontispiece-footer">Memórias de uma jornada</span></div></header>
      <div class="roster-collection-heading"><div><span class="roster-collection-kicker">A coleção</span><h3>Seus personagens <span>${String(count).padStart(2, '0')}</span></h3></div><p>Escolha uma história para continuar.</p></div>
      ${count ? `<div class="roster-grid">${library.characters.map((c, index) => {
        const name = c.data.identidade.nome.trim() || 'Personagem sem nome';
        const folio = String(index + 1).padStart(2, '0');
        const characterClass = c.data.rpg?.progressao.classes.find(entry => entry.nome.trim())?.nome;
        return `<article class="roster-card"><span class="roster-folio-spine" aria-hidden="true">SAVE · ${folio}</span><div class="roster-folio-top"><span>Slot ${folio}</span><span>${escapeHtml(c.data.rpg?.progressao.rank ? `Rank ${c.data.rpg.progressao.rank}` : 'Ficha de personagem')}</span></div><div class="roster-monogram roster-avatar" aria-hidden="true">${renderAvatar(c.data.avatar, characterClass ?? '', 72, name)}</div><div class="roster-card-body">${characterClass ? `<span class="roster-folio-class">${escapeHtml(characterClass)}</span>` : ''}<h3>${escapeHtml(name)}</h3><p>${escapeHtml(c.data.identidade.conceito || c.data.identidade.origem || 'Uma história esperando para ser escrita.')}</p>${c.data.identidade.campanha ? `<small>${escapeHtml(c.data.identidade.campanha)}</small>` : ''}</div><div class="roster-card-meta"><span>${escapeHtml(c.data.poderes?.caminhos.length ? c.data.poderes.caminhos.map(id => POWER_PATHS[id].nome).join(' · ') : 'Caminhos a escolher')}</span><span>${c.data.rpg?.pericias.length ?? 0} ${(c.data.rpg?.pericias.length ?? 0) === 1 ? 'perícia' : 'perícias'}</span></div><div class="roster-card-actions"><button class="btn btn-primary" data-character-action="open-character" data-id="${escapeHtml(c.id)}">Abrir personagem <span aria-hidden="true">→</span></button><div class="roster-folio-tools"><button class="btn" data-character-action="download-character" data-id="${escapeHtml(c.id)}">Baixar JSON</button><button class="btn" data-character-action="duplicate-character" data-id="${escapeHtml(c.id)}">Duplicar</button><button class="btn btn-danger" data-character-action="delete-character" data-id="${escapeHtml(c.id)}" aria-label="Excluir ${escapeHtml(name)}">Excluir</button></div></div></article>`;
      }).join('')}</div>` : `<div class="roster-empty"><div class="roster-empty-leaf" aria-hidden="true"><span>I</span><i></i><i></i><i></i></div><div class="roster-empty-copy"><p class="roster-collection-kicker">Uma página em branco</p><h3>O primeiro capítulo é seu.</h3><p>A criação guiada leva você pelo nome, pela origem e pelo arquétipo. Depois, a ficha completa: atributos, habilidades, inventário e círculos mágicos.</p><div class="roster-empty-actions"><button class="btn btn-primary" data-character-action="create">Criar meu primeiro personagem <span aria-hidden="true">→</span></button><button class="btn" data-character-action="new">Ficha em branco</button><button class="btn" data-character-action="import">Já tenho uma ficha</button></div></div></div>`}
      <p class="roster-status" id="characterStatus" role="status"><span aria-hidden="true">◇</span> ${escapeHtml(persistenceWarning || 'Personagens salvos somente neste navegador. Exporte as fichas como backup. Para importar, escolha ou arraste até esta página o JSON do site ou a ficha em texto, PDF ou Word (.txt, .md, .pdf ou .docx, como a do Notion).')}</p>
      <input type="file" id="characterImport" accept=".json,.txt,.md,.markdown,.pdf,.docx,application/json,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden></div></div>`;
    bindImport();
  }
  const input = (field: CharacterField): string => {
    const long = ['aparencia', 'historia', 'notas'].includes(field);
    const attrs = `id="character-${field}" data-character-field="${field}" maxlength="${long ? 6000 : 160}"`;
    return `<label class="character-field${long ? ' character-wide' : ''}"><span>${CHARACTER_FIELDS[field]}</span>${long
      ? `<textarea ${attrs} rows="4">${escapeHtml(character.identidade[field])}</textarea>`
      : `<input ${attrs} value="${escapeHtml(character.identidade[field])}" autocomplete="off">`}</label>`;
  };
  function drawSheet(): void {
    const sidebarScroll = root.querySelector<HTMLElement>('.character-section-sidebar')?.scrollTop ?? 0;
    root.innerHTML = `<div class="character-sheet-layout">${renderSheetNavigation()}<div class="character-shell"><div class="sheet-folio-line" aria-hidden="true"><span>Grimório de personagens</span><span>Inscrição · História · Magia</span></div><div class="character-breadcrumb">${character.campanhaId && document.getElementById('campaignPage') ? `<button class="btn" data-character-action="campaign">← ${escapeHtml(character.identidade.campanha.trim() || 'Campanha')}</button>` : '<button class="btn" data-character-action="roster">← Personagens</button>'}<span>Ficha do personagem</span></div>
      <div class="character-heading"><div><p class="character-eyebrow">Fólio de personagem</p>
        <h2 id="characterTitle" tabindex="-1"><span id="characterName">${escapeHtml(character.identidade.nome || 'Seu personagem')}</span></h2>
        <p>Seu personagem, suas anotações e seus círculos em um só lugar.</p></div>
        <div class="character-actions"><button class="btn" data-character-action="download">Baixar ficha JSON</button>
          <button class="btn" data-character-action="import">Importar ficha</button><button class="btn" data-character-action="create">Novo personagem</button></div></div>
      <div class="character-notice"><strong>Escreva a próxima parte da sua história.</strong> Escolha seu arquétipo e preencha as seções da ficha. Os cálculos aparecem para consulta; os campos que dependem do mestre continuam editáveis.</div>
      <p class="character-status" id="characterStatus" role="status">${escapeHtml(persistenceWarning || 'Este personagem fica neste navegador. Baixe o JSON como backup.')}</p>
      <div class="character-columns"><section class="character-card" id="character-section-identidade"><h3>Identidade</h3><div id="character-avatar">${renderAvatarPicker(character.avatar, characterClass())}</div><div class="character-fields">${(Object.keys(CHARACTER_FIELDS) as CharacterField[]).filter(f => !['historia', 'notas'].includes(f)).map(input).join('')}</div></section>
      <section class="character-card" id="character-section-historia"><h3>História livre e sessão</h3><div class="character-fields">${input('historia')}${input('notas')}</div></section></div>
      <div id="character-section-sistema">${renderRpgSheet(character.rpg ?? newRpgSheet())}</div>
      <details class="character-free-records" id="character-section-registros"${Object.values(character.secoes).some(rows => rows.length) ? ' open' : ''}><summary>Registros livres e fichas anteriores</summary><p class="character-help">Suas anotações antigas continuam aqui. Use estes campos também para habilidades e registros adicionais definidos pelo mestre.</p>
      <div class="character-columns">${(Object.entries(CHARACTER_SECTIONS) as [CharacterSection, string][]).map(([key, label]) => `
        <section class="character-card" id="character-section-${key}"><div class="character-section-heading"><h3>${label}</h3><button class="btn btn-small" data-character-action="add" data-section="${key}"${character.secoes[key].length >= 50 ? ' disabled' : ''}>+ Adicionar</button></div>
          <p class="character-help">${key === 'recursos' ? 'Anote valores atuais e máximos no formato que preferir.' : 'Defina os nomes e valores de acordo com o seu sistema.'}</p>
          ${character.secoes[key].length ? character.secoes[key].map((entry, index) => `<div class="character-entry">
            <label class="character-field"><span>Nome</span><input data-section="${key}" data-index="${index}" data-entry="nome" maxlength="120" value="${escapeHtml(entry.nome)}"></label>
            <label class="character-field"><span>Valor / descrição curta</span><input data-section="${key}" data-index="${index}" data-entry="valor" maxlength="120" value="${escapeHtml(entry.valor)}"></label>
            <label class="character-field character-wide"><span>Detalhes</span><textarea data-section="${key}" data-index="${index}" data-entry="notas" maxlength="${RPG_NOTES_LIMIT}" rows="2">${escapeHtml(entry.notas)}</textarea></label>
            <button class="btn btn-danger" data-character-action="remove" data-section="${key}" data-index="${index}" aria-label="Remover item de ${label}">Remover</button></div>`).join('') : `<div class="character-empty">Nenhum item em ${label.toLowerCase()}. Adicione quando quiser.</div>`}
        </section>`).join('')}</div></details>
      <div class="character-columns">
      ${renderPowerPaths(character)}
      </div><input type="file" id="characterImport" accept=".json,.txt,.md,.markdown,.pdf,.docx,application/json,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden></div></div>`;
    bindImport();
    rememberRpgSections();
    const sidebar = root.querySelector<HTMLElement>('.character-section-sidebar');
    if (sidebar) sidebar.scrollTop = sidebarScroll;
    sectionNavigation.refresh();
  }
  /** HTML de cada seção da ficha RPG como foi desenhado (para comparar no próximo desenho). */
  const renderedSections = new Map<string, string>();
  function rememberRpgSections(): void {
    renderedSections.clear();
    root.querySelectorAll<HTMLElement>('#character-section-sistema .rpg-section[id]').forEach(section => renderedSections.set(section.id, section.outerHTML));
  }
  /** Troca só as seções que mudaram: a ficha inteira tem milhares de elementos e redesenhá-la a cada edição trava a tela. */
  function drawRpgSections(): void {
    const host = root.querySelector<HTMLElement>('#character-section-sistema');
    if (!host) { drawSheet(); return; }
    const template = document.createElement('template');
    template.innerHTML = renderRpgSheet(character.rpg ?? newRpgSheet());
    const fresh = Array.from(template.content.querySelectorAll<HTMLElement>('.rpg-section[id]'));
    if (fresh.length !== host.querySelectorAll('.rpg-section[id]').length) { drawSheet(); return; }
    let changed = false;
    for (const section of fresh) {
      const html = section.outerHTML;
      if (renderedSections.get(section.id) === html) continue;
      const current = Array.from(host.querySelectorAll<HTMLElement>('.rpg-section[id]')).find(el => el.id === section.id);
      if (!current) { drawSheet(); return; }
      current.replaceWith(section);
      renderedSections.set(section.id, html);
      changed = true;
    }
    if (!changed) return;
    sectionNavigation.refresh();
  }
  function download(data: Character = character): void {
    const json = encodeCharacter(data);
    if (json === null) { status('A ficha ultrapassa o limite de 2 MB. Remova itens ou círculos antes de baixar.'); return; }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `ficha-${data.identidade.nome.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'personagem'}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Download solicitado. Guarde o JSON como backup deste personagem.');
  }
  /** Guarda um personagem novo na coleção; devolve o id ou null se nada foi salvo. */
  function storeCharacter(data: Character): string | null {
    if (library.characters.length >= CHARACTER_LIBRARY_LIMIT) { status('O limite é de 24 personagens neste navegador.'); return null; }
    const next = { id: newId(), data };
    return commitLibrary({ ...library, characters: [...library.characters, next] }) ? next.id : null;
  }
  function addCharacter(data: Character, message = 'Personagem criado e salvo neste navegador.'): void {
    const id = storeCharacter(data);
    if (!id) return;
    openCharacter(id);
    status(persistenceWarning || message);
    root.querySelector<HTMLInputElement>('[data-character-field="nome"]')?.focus();
  }
  /**
   * Lê um arquivo de ficha: o JSON exportado pelo site, a ficha escrita em texto no modelo do
   * Livro de Regras (.txt ou Markdown do Notion) ou essa mesma ficha em PDF ou .docx (Word,
   * Google Docs), cujo texto é extraído no próprio navegador. Devolve o personagem ou o motivo da recusa.
   */
  async function readCharacterFile(file: File): Promise<{ character: Character; note: string } | string> {
    const fromText = (text: string, options: CharacterTextOptions = {}, source = 'no texto', extra = ''): { character: Character; note: string } | string => {
      const reading = readCharacterText(text, file.name ?? '', options);
      if (!reading.ok) return reading.problem;
      const details = [`${reading.recognized} ${reading.recognized === 1 ? 'informação reconhecida' : 'informações reconhecidas'} ${source}; confira a ficha.`];
      if (reading.unrecognized.length) details.push(`Campos não reconhecidos: ${reading.unrecognized.join(', ')}.`);
      if (reading.trimmed) {
        details.push(reading.trimmedFields.length
          ? `Textos encurtados por passarem do limite da ficha: ${reading.trimmedFields.join(', ')}.`
          : 'Alguns textos ou listas passavam do limite da ficha e foram encurtados.');
      }
      if (extra) details.push(extra);
      return { character: reading.character, note: ` ${details.join(' ')}` };
    };
    const fromPdf = async (): Promise<{ character: Character; note: string } | string> => {
      if (file.size > PDF_FILE_LIMIT) return 'PDF muito grande; o limite é 20 MB.';
      status(`Lendo o PDF ${file.name || ''}…`.replace(/\s+…$/, '…'));
      let text: string;
      try { text = await extractPdfText(await file.arrayBuffer()); }
      catch (error) { return error instanceof PdfReadError ? error.message : 'não foi possível ler o PDF.'; }
      if (text.length > CHARACTER_FILE_LIMIT) return 'o texto do PDF passa do limite de 2 MB por ficha.';
      // O riscado do modelo não chega ao texto extraído; o bloqueio padrão das estatísticas é mantido.
      return fromText(text, { strikethrough: false }, 'no PDF', 'Estatísticas riscadas no PDF não são detectadas: confira o desbloqueio de Poder e Energia.');
    };
    const fromDocx = async (): Promise<{ character: Character; note: string } | string> => {
      if (file.size > DOCX_FILE_LIMIT) return 'documento muito grande; o limite é 20 MB.';
      let text: string;
      try { text = await extractDocxText(new Uint8Array(await file.arrayBuffer())); }
      catch (error) { return error instanceof DocxReadError ? error.message : 'não foi possível ler o documento do Word.'; }
      if (text.length > CHARACTER_FILE_LIMIT) return 'o texto do documento passa do limite de 2 MB por ficha.';
      return fromText(text, {}, 'no documento do Word');
    };
    const name = file.name ?? '';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) return fromPdf();
    if (/\.docx$/i.test(name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return fromDocx();
    if (/\.doc$/i.test(name) || file.type === 'application/msword') return 'o formato .doc antigo não é lido; no Word, salve como .docx ou PDF.';
    if (file.size > CHARACTER_FILE_LIMIT) return 'arquivo muito grande; o limite é 2 MB por ficha.';
    const content = (await file.text()).replace(/^\uFEFF/, '');
    if (content.startsWith('%PDF-')) return fromPdf();
    if (content.startsWith('PK\u0003\u0004')) return fromDocx();
    if (/^\s*[{[]/.test(content)) {
      let raw: unknown;
      try { raw = JSON.parse(content); }
      catch { return 'o conteúdo não é um JSON válido.'; }
      const reading = readCharacter(raw);
      return reading.ok ? { character: reading.character, note: '' } : reading.problem;
    }
    return fromText(content);
  }
  const characterLabel = (data: Character): string => data.identidade.nome.trim() || 'Personagem sem nome';
  /** A importação sempre adiciona; nunca substitui outro personagem. */
  async function importFiles(files: readonly File[]): Promise<void> {
    if (!files.length) return;
    const names = new Set(library.characters.map(c => c.data.identidade.nome.trim()).filter(Boolean));
    const added: Character[] = [], refused: string[] = [];
    let textNote = '';
    let lastId: string | null = null, repeated = false, stopped = 0;
    for (const [index, file] of files.entries()) {
      const fileName = file.name || 'arquivo';
      const read = await readCharacterFile(file);
      if (typeof read === 'string') { refused.push(files.length === 1 ? read : `${fileName} (${read})`); continue; }
      const result = read.character;
      textNote = read.note;
      if (library.characters.length >= CHARACTER_LIBRARY_LIMIT) { refused.push(`${fileName} (o limite é de 24 personagens neste navegador)`); continue; }
      const id = storeCharacter(result);
      // commitLibrary já explicou o motivo (limite de 4 MB ou gravação cancelada); os arquivos seguintes também não entrariam.
      if (!id) { if (!added.length) return; stopped = files.length - index; break; }
      if (names.has(result.identidade.nome.trim())) repeated = true;
      names.add(result.identidade.nome.trim());
      added.push(result); lastId = id;
    }
    const kept = 'Seus personagens foram mantidos.';
    if (!added.length) {
      status(files.length === 1 ? `Arquivo inválido: ${refused[0]} ${kept}` : `Nenhuma ficha foi importada. Arquivos inválidos: ${refused.join('; ')}. ${kept}`);
      return;
    }
    const note = repeated ? ' Já havia um personagem com o mesmo nome; os dois foram mantidos.' : '';
    const skipped = (refused.length ? ` Arquivos inválidos: ${refused.join('; ')}.` : '')
      + (stopped ? ` ${stopped === 1 ? '1 arquivo não foi adicionado' : `${stopped} arquivos não foram adicionados`}: o grimório chegou ao limite de 4 MB ou a gravação foi cancelada.` : '');
    if (added.length === 1 && files.length === 1) {
      openCharacter(lastId!);
      status(persistenceWarning || `Ficha “${characterLabel(added[0])}” importada e salva neste navegador.${textNote}${note}`);
      root.querySelector<HTMLInputElement>('[data-character-field="nome"]')?.focus();
      return;
    }
    openRoster(false);
    const summary = added.length === 1 ? `Ficha “${characterLabel(added[0])}” importada.` : `${added.length} fichas importadas: ${added.map(characterLabel).join(', ')}.`;
    status(`${persistenceWarning ? `${persistenceWarning} ` : ''}${summary}${note}${skipped}`);
  }
  function attachCircle(): void {
    if (!activeId || view !== 'circulos') return;
    if (character.magias.length >= 20) { status('Esta ficha já tem 20 círculos.'); return; }
    const projeto = normalizeProject(getProjectData());
    if (!projeto) { status('Não foi possível guardar este círculo.'); return; }
    const next = { ...character, magias: [...character.magias, { nome: projeto.spellInfo?.name || `Círculo ${character.magias.length + 1}`, projeto }] };
    if (commit(next)) { drafts.set(activeId, projeto); status(persistenceWarning || 'Cópia do círculo guardada na ficha deste personagem.'); }
  }
  function updateRpgControl(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
    if (!activeId || !el.dataset.rpgField) return;
    const update = updateRpgInput(character.rpg ?? newRpgSheet(), el);
    if (!update) return;
    const normalized = normalizeRpgSheet(update.sheet);
    if (!normalized) { status('Esse valor não é válido para a ficha. A alteração não foi salva.'); return; }
    const field = el.dataset.rpgField;
    const start = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.selectionStart : null;
    const end = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.selectionEnd : null;
    const scroll = root.scrollTop;
    const applied = commit({ ...character, rpg: normalized }, update.redraw ? 'rpg' : false);
    if (!applied) drawSheet();
    if (update.redraw || !applied) {
      const replacement = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-rpg-field]')).find(input => input.dataset.rpgField === field);
      replacement?.focus({ preventScroll: true });
      if ((replacement instanceof HTMLInputElement && ['text', 'search', 'tel', 'url', 'password'].includes(replacement.type)) || replacement instanceof HTMLTextAreaElement) {
        if (start !== null && end !== null) replacement.setSelectionRange(start, end);
      }
      root.scrollTop = scroll;
    }
  }
  root.addEventListener('change', evt => {
    const el = evt.target;
    if (el instanceof HTMLSelectElement) { updateRpgControl(el); return; }
    if (!(el instanceof HTMLInputElement) || el.type !== 'checkbox') return;
    const creationPower = el.dataset.creationPower as PowerPathId | undefined;
    if (creation && creationPower && Object.prototype.hasOwnProperty.call(POWER_PATHS, creationPower)) {
      if (el.checked) creationPowers.add(creationPower); else creationPowers.delete(creationPower);
      el.closest('.power-card')?.classList.toggle('is-chosen', el.checked);
      return;
    }
    const power = el.dataset.powerToggle as PowerPathId | undefined;
    if (!activeId || !power || !Object.prototype.hasOwnProperty.call(POWER_PATHS, power)) return;
    if (commit({ ...character, poderes: togglePower(character.poderes, power, el.checked) }, true)) {
      root.querySelector<HTMLInputElement>(`[data-power-toggle="${power}"]`)?.focus({ preventScroll: true });
      status(persistenceWarning || (el.checked ? `${POWER_PATHS[power].nome} agora é um caminho do personagem.` : `${POWER_PATHS[power].nome} saiu dos caminhos do personagem.`));
    }
  });
  root.addEventListener('focusout', evt => {
    const el = evt.target;
    if (!activeId || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.dataset.rpgField) return;
    const sheet = character.rpg ?? newRpgSheet();
    if (updateRpgInput(sheet, el)) return;
    let previous: unknown = sheet;
    for (const key of el.dataset.rpgField.split('.')) {
      if (!previous || typeof previous !== 'object' || !Object.prototype.hasOwnProperty.call(previous, key)) return;
      previous = (previous as Record<string, unknown>)[key];
    }
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = previous === true;
    else el.value = previous === null ? '' : String(previous);
    status('Valor inválido. O último valor salvo foi mantido.');
  });
  root.addEventListener('input', evt => {
    const el = evt.target;
    if (creation && el instanceof HTMLInputElement && el.dataset.creationField && Object.prototype.hasOwnProperty.call(creation, el.dataset.creationField)) {
      creation[el.dataset.creationField as keyof CreationDraft] = el.value;
      if (el.dataset.creationField === 'classe') {
        const host = root.querySelector<HTMLElement>('#creationAvatar');
        if (host) host.innerHTML = renderAvatarPicker(creationAvatar, creation.classe);
      }
      if (el.type === 'radio') {
        root.querySelectorAll('.creation-archetype').forEach(card => card.classList.toggle('is-selected', card.querySelector('input')?.checked === true));
      }
      return;
    }
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !activeId) return;
    if (el.dataset.rpgField) { updateRpgControl(el); return; }
    const powerNote = el.dataset.powerNote as PowerPathId | undefined;
    if (powerNote && Object.prototype.hasOwnProperty.call(POWER_PATHS, powerNote)) {
      const powers = character.poderes ?? { caminhos: [], notas: {} };
      const previous = powers.notas[powerNote] ?? '';
      if (!commit({ ...character, poderes: { ...powers, notas: { ...powers.notas, [powerNote]: el.value.slice(0, POWER_NOTES_LIMIT) } } })) el.value = previous;
      return;
    }
    const field = el.dataset.characterField;
    let next: Character, previousValue: string;
    if (field && Object.prototype.hasOwnProperty.call(CHARACTER_FIELDS, field)) {
      previousValue = character.identidade[field as CharacterField];
      next = { ...character, identidade: { ...character.identidade, [field]: el.value } };
    } else {
      const section = el.dataset.section as CharacterSection;
      const index = Number(el.dataset.index), entry = character.secoes[section]?.[index], key = el.dataset.entry;
      if (!entry || !['nome', 'valor', 'notas'].includes(key ?? '')) return;
      previousValue = entry[key as keyof typeof entry];
      next = { ...character, secoes: { ...character.secoes, [section]: character.secoes[section].map((row, i) => i === index ? { ...row, [key!]: el.value } : row) } };
    }
    if (!commit(next)) el.value = previousValue;
  });
  root.addEventListener('click', evt => {
    const swatch = (evt.target as Element).closest<HTMLButtonElement>('[data-avatar-part]');
    if (swatch) {
      const part = swatch.dataset.avatarPart as AvatarPart, color = swatch.dataset.avatarColor ?? '';
      if (!Object.prototype.hasOwnProperty.call(AVATAR_PALETTES, part) || !AVATAR_PALETTES[part].includes(color)) return;
      if (creation) {
        creationAvatar = { ...creationAvatar, [part]: color };
        const host = root.querySelector<HTMLElement>('#creationAvatar');
        if (host) host.innerHTML = renderAvatarPicker(creationAvatar, creation.classe);
      } else if (activeId) commit({ ...character, avatar: { ...(character.avatar ?? newAvatar()), [part]: color } });
      root.querySelector<HTMLElement>(`[data-avatar-part="${part}"][data-avatar-color="${color}"]`)?.focus();
      return;
    }
    const rpgButton = (evt.target as Element).closest<HTMLButtonElement>('[data-rpg-action]');
    if (rpgButton && activeId) {
      if (rpgButton.dataset.rpgAction?.startsWith('remove-') && !confirm('Remover este registro da ficha?')) return;
      const update = handleRpgAction(character.rpg ?? newRpgSheet(), rpgButton);
      if (update) {
        const normalized = normalizeRpgSheet(update.sheet);
        if (normalized && commit({ ...character, rpg: normalized }, 'rpg')) {
          if (update.message) status(persistenceWarning || update.message);
          const action = rpgButton.dataset.rpgAction!;
          const collection = action.slice(action.indexOf('-') + 1);
          const addButton = root.querySelector<HTMLButtonElement>(`[data-rpg-action="add-${collection}"]`);
          const scope = addButton?.closest('.rpg-list') ?? addButton?.closest('.rpg-section');
          const rows = scope?.querySelectorAll<HTMLElement>('.rpg-entry, .rpg-resource-extra');
          const rowIndex = action.startsWith('add-') ? (rows?.length ?? 0) - 1 : Math.min(Number(rpgButton.dataset.rpgIndex), (rows?.length ?? 0) - 1);
          const field = rows?.[rowIndex]?.querySelector<HTMLInputElement>('input');
          if (field) field.focus();
          else if (addButton && !addButton.disabled) addButton.focus();
          else {
            const heading = scope?.querySelector<HTMLElement>('h3, h4');
            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
          }
        }
      }
      return;
    }
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-character-action]');
    if (!button) return;
    const action = button.dataset.characterAction, index = Number(button.dataset.index), id = button.dataset.id;
    const section = button.dataset.section as CharacterSection;
    if (action === 'new') { addCharacter(newCharacter()); return; }
    if (action === 'create') { openCreation(); return; }
    if (action === 'creation-cancel') {
      const campaign = creationCampaign;
      creation = null; creationCampaign = null;
      if (!campaign || !openCampaigns(campaign.campanhaId)) openRoster();
      return;
    }
    if (action === 'creation-back' && creation) { creationStep = Math.max(0, creationStep - 1); drawCreation(); return; }
    if (action === 'creation-goto' && creation && index <= creationStep) { creationStep = index; drawCreation(); return; }
    if (action === 'roster') { openRoster(); return; }
    if (action === 'campaign') { if (!openCampaigns(character.campanhaId)) openRoster(); return; }
    if (action === 'open-character' && id) { openCharacter(id); return; }
    if (action === 'import') { byId<HTMLInputElement>('characterImport').click(); return; }
    const selected = id ? library.characters.find(c => c.id === id) : record();
    if (action === 'download' || action === 'download-character') { if (selected) download(selected.data); return; }
    if (action === 'duplicate-character' && selected) {
      const copy = normalizeCharacter(JSON.parse(encodeCharacter(selected.data)!))!;
      copy.identidade.nome = copyName(copy.identidade.nome || 'Personagem', library.characters.map(c => c.data.identidade.nome)).slice(0, 160);
      addCharacter(copy); return;
    }
    if (action === 'delete-character' && selected) {
      if (!confirm(`Excluir “${selected.data.identidade.nome || 'Personagem sem nome'}”? Baixe o JSON antes para guardar uma cópia.`)) return;
      if (!commitLibrary({ ...library, characters: library.characters.filter(c => c.id !== selected.id) })) return;
      drafts.delete(selected.id);
      if (activeId === selected.id) activeId = null;
      openRoster(); return;
    }
    if (!activeId || !record()) return;
    if (action === 'enter-editor') { openEditor(); return; }
    let next: Character;
    if (action === 'add' && Object.prototype.hasOwnProperty.call(CHARACTER_SECTIONS, section)) {
      if (character.secoes[section].length >= 50) return;
      next = { ...character, secoes: { ...character.secoes, [section]: [...character.secoes[section], { nome: '', valor: '', notas: '' }] } };
    } else if (action === 'remove' && character.secoes[section]?.[index]) {
      if (!confirm('Remover este item da ficha?')) return;
      next = { ...character, secoes: { ...character.secoes, [section]: character.secoes[section].filter((_, i) => i !== index) } };
    } else if (action === 'open-spell' && character.magias[index]) {
      rememberDraft(); openEditor(character.magias[index].projeto); return;
    } else if (action === 'remove-spell' && character.magias[index]) {
      if (!confirm('Remover esta cópia do círculo da ficha?')) return;
      next = { ...character, magias: character.magias.filter((_, i) => i !== index) };
    } else return;
    if (!commit(next, true)) return;
    if (action === 'add') root.querySelector<HTMLInputElement>(`input[data-section="${section}"][data-index="${character.secoes[section].length - 1}"]`)?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-rpg-page]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.rpgPage === 'personagens') openRoster();
      else if (button.dataset.rpgPage === 'mesa') openTable();
      else if (button.dataset.rpgPage === 'campanhas') openCampaigns();
      else if (button.dataset.rpgPage === 'circulos') openEditor();
      else if (activeId) openCharacter(activeId);
    });
  });
  document.getElementById('btnReturnCharacter')?.addEventListener('click', () => { if (activeId) openCharacter(activeId); });
  document.getElementById('btnSaveCharacterCircle')?.addEventListener('click', attachCircle);
  // Ao entrar no site, a primeira tela são as campanhas (sem a página, a seleção de personagens).
  root.addEventListener('rpg:enter', () => { if (!openCampaigns()) openRoster(false); });
  root.addEventListener('rpg:create', evt => {
    const detail = (evt as CustomEvent<{ campanhaId?: unknown; campanhaNome?: unknown } | null>).detail;
    openCreation(detail && typeof detail.campanhaId === 'string' ? { campanhaId: detail.campanhaId, campanhaNome: typeof detail.campanhaNome === 'string' ? detail.campanhaNome.slice(0, 160) : '' } : null);
  });
  // A página da campanha liga (ou desliga) um personagem à campanha.
  root.addEventListener('rpg:link-campaign', evt => {
    const detail = (evt as CustomEvent<{ characterId?: unknown; campanhaId?: unknown; campanhaNome?: unknown }>).detail;
    const target = library.characters.find(c => c.id === detail?.characterId);
    if (!target) return;
    const data: Character = { ...target.data };
    if (typeof detail.campanhaId === 'string' && /^[\w-]{1,64}$/.test(detail.campanhaId)) {
      data.campanhaId = detail.campanhaId;
      if (typeof detail.campanhaNome === 'string' && detail.campanhaNome.trim()) data.identidade = { ...data.identidade, campanha: detail.campanhaNome.trim().slice(0, 160) };
    } else delete data.campanhaId;
    commitLibrary({ ...library, characters: library.characters.map(c => c.id === target.id ? { ...c, data } : c) });
  });
  document.getElementById('btnPlayMode')?.addEventListener('click', () => setMode(canMaster() ? 'jogador' : 'mestre'));
  onModeChange(() => {
    if (view === 'mesa' && !canMaster()) { openRoster(false); return; }
    updateNavigation();
    if (view === 'campanhas') document.getElementById('campaignPage')?.dispatchEvent(new Event('campanhas:open'));
  });
  root.addEventListener('rpg:open-character', evt => {
    const id = (evt as CustomEvent<unknown>).detail;
    if (typeof id === 'string') openCharacter(id);
  });
  // Arrastar fichas JSON para a seleção ou para a ficha aberta importa como na escolha de arquivo.
  const carriesFiles = (evt: DragEvent): boolean => Array.from(evt.dataTransfer?.types ?? []).includes('Files');
  let dragDepth = 0;
  root.addEventListener('dragenter', evt => { if (!carriesFiles(evt)) return; evt.preventDefault(); dragDepth++; root.classList.add('is-importing'); });
  root.addEventListener('dragover', evt => { if (!carriesFiles(evt)) return; evt.preventDefault(); if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'copy'; });
  root.addEventListener('dragleave', evt => { if (!carriesFiles(evt)) return; if (--dragDepth <= 0) { dragDepth = 0; root.classList.remove('is-importing'); } });
  root.addEventListener('drop', evt => {
    if (!carriesFiles(evt)) return;
    evt.preventDefault(); dragDepth = 0; root.classList.remove('is-importing');
    void importFiles(Array.from(evt.dataTransfer?.files ?? []));
  });
  openRoster(false);
}
