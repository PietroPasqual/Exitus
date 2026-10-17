import {
  CHARACTER_FIELDS, CHARACTER_SECTIONS, CHARACTER_KEY, CHARACTER_FILE_LIMIT,
  newCharacter, normalizeCharacter, encodeCharacter, type Character, type CharacterField, type CharacterSection
} from '../core/character';
import {
  CHARACTER_LIBRARY_KEY, CHARACTER_LIBRARY_LIMIT, CHARACTER_LIBRARY_FILE_LIMIT,
  newCharacterLibrary, normalizeCharacterLibrary, encodeCharacterLibrary, migrateLegacyCharacter,
  type CharacterLibrary, type CharacterRecord
} from '../core/character-library';
import { normalizeProject, copyName } from '../core/project';
import { changeCircleContext } from '../core/editor-context';
import type { Project } from '../core/types';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { applyProject, getProjectData, resetCircle } from './editor';
import { resetHistory } from './history';
import { render, store } from './store';

/** Seleção → ficha → editor. O desenho mantém seu editor e os dados ficam por personagem. */
export function setupCharacter(): void {
  const root = byId('characterPage');
  const workspace = document.querySelector<HTMLElement>('.workspace')!;
  let library = newCharacterLibrary();
  let activeId: string | null = null;
  let character = newCharacter();
  let view: 'personagens' | 'ficha' | 'circulos' = 'personagens';
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
    if (circleMessage) circleMessage.textContent = message;
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
    library = next;
    const selected = record();
    if (selected) character = selected.data;
    return true;
  }
  function commit(next: Character, redraw = false): boolean {
    if (encodeCharacter(next) === null) { status('A alteração ultrapassa o limite de 2 MB da ficha e não foi aplicada. Remova itens ou círculos para liberar espaço.'); return false; }
    if (!activeId) return false;
    if (!commitLibrary({ ...library, characters: library.characters.map(c => c.id === activeId ? { ...c, data: next } : c) })) return false;
    if (redraw) drawSheet();
    status(persistenceWarning || 'Salvo neste navegador');
    const name = document.getElementById('characterName');
    if (name) name.textContent = character.identidade.nome.trim() || 'Seu personagem';
    return true;
  }
  function rememberDraft(): void {
    if (view !== 'circulos' || !activeId) return;
    const snapshot = normalizeProject(getProjectData());
    if (snapshot) drafts.set(activeId, snapshot);
  }
  function updateNavigation(): void {
    changeCircleContext();
    root.hidden = view === 'circulos';
    workspace.hidden = view !== 'circulos';
    for (const id of ['presetSelect', 'fileMenu', 'btnOpenGrimoire']) byId(id).hidden = view !== 'circulos';
    const contextLabel = document.querySelector<HTMLElement>('.character-context-label');
    if (contextLabel) contextLabel.textContent = activeId ? character.identidade.nome.trim() || 'Personagem sem nome' : 'Escolha um personagem para começar';
    const context = document.getElementById('characterEditorContext');
    if (context) context.hidden = view !== 'circulos';
    const owner = document.getElementById('circleOwnerLabel');
    if (owner) owner.textContent = character.identidade.nome.trim() || 'Personagem sem nome';
    document.querySelectorAll<HTMLButtonElement>('[data-rpg-page]').forEach(button => {
      const target = button.dataset.rpgPage;
      const active = target === view;
      button.disabled = target !== 'personagens' && !activeId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }
  function openRoster(focus = true): void {
    rememberDraft(); view = 'personagens'; drawRoster(); updateNavigation();
    if (focus) byId('characterRosterTitle').focus();
  }
  function openCharacter(id: string): void {
    const selected = library.characters.find(c => c.id === id);
    if (!selected) return;
    rememberDraft(); activeId = id; character = selected.data; view = 'ficha';
    drawSheet(); updateNavigation(); byId('characterTitle').focus();
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
    status('Rascunho da sessão. Use Guardar na ficha ou exporte o JSON antes de recarregar.');
    document.getElementById('btnReturnCharacter')?.focus();
  }
  function bindImport(): void {
    byId<HTMLInputElement>('characterImport').addEventListener('change', evt => { void importFile(evt); });
  }
  function drawRoster(): void {
    root.innerHTML = `<div class="character-roster"><div class="roster-shell">
      <div class="roster-heading"><div><p class="character-eyebrow">Seu grimório de personagens</p><h2 id="characterRosterTitle" tabindex="-1">Escolha sua próxima história</h2><p>Selecione um personagem para editar a ficha e criar seus círculos mágicos.</p></div>
      <div class="roster-actions"><button class="btn btn-primary" data-character-action="new"${library.characters.length >= CHARACTER_LIBRARY_LIMIT ? ' disabled' : ''}>+ Criar personagem</button><button class="btn" data-character-action="import"${library.characters.length >= CHARACTER_LIBRARY_LIMIT ? ' disabled' : ''}>Importar ficha JSON</button></div></div>
      <p class="roster-status" id="characterStatus" role="status">${escapeHtml(persistenceWarning || 'Personagens salvos somente neste navegador. Exporte as fichas como backup.')}</p>
      ${library.characters.length ? `<div class="roster-grid">${library.characters.map(c => {
        const name = c.data.identidade.nome.trim() || 'Personagem sem nome';
        return `<article class="roster-card"><div class="roster-monogram" aria-hidden="true">${escapeHtml(name[0].toLocaleUpperCase())}</div><div class="roster-card-body"><h3>${escapeHtml(name)}</h3><p>${escapeHtml(c.data.identidade.conceito || c.data.identidade.origem || 'Uma história esperando para ser escrita.')}</p>${c.data.identidade.campanha ? `<small>${escapeHtml(c.data.identidade.campanha)}</small>` : ''}<div class="roster-card-meta">${c.data.magias.length} círculo(s) · ${Object.values(c.data.secoes).reduce((n, rows) => n + rows.length, 0)} registro(s)</div></div><div class="roster-card-actions"><button class="btn btn-primary" data-character-action="open-character" data-id="${escapeHtml(c.id)}">Abrir personagem</button><button class="btn" data-character-action="download-character" data-id="${escapeHtml(c.id)}">Baixar JSON</button><button class="btn" data-character-action="duplicate-character" data-id="${escapeHtml(c.id)}">Duplicar</button><button class="btn btn-danger" data-character-action="delete-character" data-id="${escapeHtml(c.id)}" aria-label="Excluir ${escapeHtml(name)}">Excluir</button></div></article>`;
      }).join('')}</div>` : '<div class="roster-empty"><h3>O primeiro capítulo é seu.</h3><p>Crie seu primeiro personagem. Você poderá preencher a ficha no seu ritmo e abrir o editor de círculos por dentro dela.</p><button class="btn btn-primary" data-character-action="new">Criar meu primeiro personagem</button></div>'}
      <input type="file" id="characterImport" accept=".json,application/json" hidden></div></div>`;
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
    root.innerHTML = `<div class="character-shell"><div class="character-breadcrumb"><button class="btn" data-character-action="roster">← Personagens</button><span>Criação do personagem</span></div>
      <div class="character-heading"><div><p class="character-eyebrow">Ficha de personagem · base inicial</p>
        <h2 id="characterTitle" tabindex="-1"><span id="characterName">${escapeHtml(character.identidade.nome || 'Seu personagem')}</span></h2>
        <p>Seu personagem, suas anotações e seus círculos em um só lugar.</p></div>
        <div class="character-actions"><button class="btn" data-character-action="download">Baixar ficha JSON</button>
          <button class="btn" data-character-action="import">Importar ficha</button><button class="btn" data-character-action="new">Novo personagem</button></div></div>
      <div class="character-notice"><strong>Vamos montar as regras juntos.</strong> Os campos abaixo são livres. Atributos, perícias, limites e cálculos serão adaptados quando você enviar o sistema do RPG.</div>
      <p class="character-status" id="characterStatus" role="status">${escapeHtml(persistenceWarning || 'Este personagem fica neste navegador. Baixe o JSON como backup.')}</p>
      <nav class="character-creation-menu" aria-label="Opções de criação">${[['identidade', 'Identidade'], ['historia', 'História'], ...Object.entries(CHARACTER_SECTIONS), ['magias', 'Círculos mágicos']].map(([key, label]) => `<button class="btn" data-character-action="jump" data-target="${key}">${label}</button>`).join('')}</nav>
      <div class="character-columns"><section class="character-card" id="character-section-identidade"><h3>Identidade</h3><div class="character-fields">${(Object.keys(CHARACTER_FIELDS) as CharacterField[]).filter(f => !['historia', 'notas'].includes(f)).map(input).join('')}</div></section>
      <section class="character-card" id="character-section-historia"><h3>História e sessão</h3><div class="character-fields">${input('historia')}${input('notas')}</div></section></div>
      <div class="character-columns">${(Object.entries(CHARACTER_SECTIONS) as [CharacterSection, string][]).map(([key, label]) => `
        <section class="character-card" id="character-section-${key}"><div class="character-section-heading"><h3>${label}</h3><button class="btn btn-small" data-character-action="add" data-section="${key}"${character.secoes[key].length >= 50 ? ' disabled' : ''}>+ Adicionar</button></div>
          <p class="character-help">${key === 'recursos' ? 'Anote valores atuais e máximos no formato que preferir.' : 'Defina os nomes e valores de acordo com o seu sistema.'}</p>
          ${character.secoes[key].length ? character.secoes[key].map((entry, index) => `<div class="character-entry">
            <label class="character-field"><span>Nome</span><input data-section="${key}" data-index="${index}" data-entry="nome" maxlength="120" value="${escapeHtml(entry.nome)}"></label>
            <label class="character-field"><span>Valor / descrição curta</span><input data-section="${key}" data-index="${index}" data-entry="valor" maxlength="120" value="${escapeHtml(entry.valor)}"></label>
            <label class="character-field character-wide"><span>Detalhes</span><textarea data-section="${key}" data-index="${index}" data-entry="notas" maxlength="1000" rows="2">${escapeHtml(entry.notas)}</textarea></label>
            <button class="btn btn-danger" data-character-action="remove" data-section="${key}" data-index="${index}" aria-label="Remover item de ${label}">Remover</button></div>`).join('') : `<div class="character-empty">Nenhum item em ${label.toLowerCase()}. Adicione quando quiser.</div>`}
        </section>`).join('')}
      <section class="character-card" id="character-section-magias"><div class="character-section-heading"><h3>Magias e círculos</h3><button class="btn btn-small" data-character-action="enter-editor">Criar círculo</button></div><div class="character-editor-link"><p>Abra o editor completo de runas e círculos para este personagem.</p><button class="btn btn-primary" data-character-action="enter-editor">Abrir criação de círculos</button></div>
        <p class="character-help">Guarda uma cópia do desenho que está no editor. Alterações futuras no editor não mudam a cópia da ficha.</p>
        ${character.magias.length ? character.magias.map((spell, index) => `<div class="character-spell"><strong>${escapeHtml(spell.nome)}</strong><div><button class="btn" data-character-action="open-spell" data-index="${index}">Abrir no editor</button><button class="btn btn-danger" data-character-action="remove-spell" data-index="${index}" aria-label="Remover ${escapeHtml(spell.nome)} da ficha">Remover</button></div></div>`).join('') : '<div class="character-empty">Crie um círculo no editor e guarde uma cópia aqui.</div>'}
      </section></div><input type="file" id="characterImport" accept=".json,application/json" hidden></div>`;
    bindImport();
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
  function addCharacter(data: Character): void {
    if (library.characters.length >= CHARACTER_LIBRARY_LIMIT) { status('O limite é de 24 personagens neste navegador.'); return; }
    const next = { id: newId(), data };
    if (!commitLibrary({ ...library, characters: [...library.characters, next] })) return;
    openCharacter(next.id);
    status(persistenceWarning || 'Personagem criado e salvo neste navegador.');
    root.querySelector<HTMLInputElement>('[data-character-field="nome"]')?.focus();
  }
  async function importFile(evt: Event): Promise<void> {
    const fileInput = evt.target as HTMLInputElement;
    const file = fileInput.files?.[0]; fileInput.value = '';
    if (!file) return;
    if (file.size > CHARACTER_FILE_LIMIT) { status('Arquivo muito grande. O limite é 2 MB por ficha.'); return; }
    try {
      const next = normalizeCharacter(JSON.parse(await file.text()));
      if (!next) { status('Arquivo inválido ou versão incompatível. Importe um JSON de ficha deste site.'); return; }
      addCharacter(next); // A importação adiciona; nunca substitui outro personagem.
    } catch { status('Não foi possível abrir o arquivo. Seus personagens foram mantidos.'); }
  }
  function attachCircle(): void {
    if (!activeId || view !== 'circulos') return;
    if (character.magias.length >= 20) { status('Esta ficha já tem 20 círculos.'); return; }
    const projeto = normalizeProject(getProjectData());
    if (!projeto) { status('Não foi possível guardar este círculo.'); return; }
    const next = { ...character, magias: [...character.magias, { nome: projeto.spellInfo?.name || `Círculo ${character.magias.length + 1}`, projeto }] };
    if (commit(next)) { drafts.set(activeId, projeto); status(persistenceWarning || 'Cópia do círculo guardada na ficha deste personagem.'); }
  }
  root.addEventListener('input', evt => {
    const el = evt.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !activeId) return;
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
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-character-action]');
    if (!button) return;
    const action = button.dataset.characterAction, index = Number(button.dataset.index), id = button.dataset.id;
    const section = button.dataset.section as CharacterSection;
    if (action === 'new') { addCharacter(newCharacter()); return; }
    if (action === 'roster') { openRoster(); return; }
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
    if (action === 'jump') { document.getElementById(`character-section-${button.dataset.target}`)?.scrollIntoView?.({ block: 'start' }); return; }
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
      else if (button.dataset.rpgPage === 'circulos') openEditor();
      else if (activeId) openCharacter(activeId);
    });
  });
  document.getElementById('btnReturnCharacter')?.addEventListener('click', () => { if (activeId) openCharacter(activeId); });
  document.getElementById('btnSaveCharacterCircle')?.addEventListener('click', attachCircle);
  root.addEventListener('rpg:enter', () => openRoster(false));
  openRoster(false);
}
