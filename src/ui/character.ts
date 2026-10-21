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
import { newRpgSheet, normalizeRpgSheet } from '../core/rpg-sheet';
import type { Project } from '../core/types';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { applyProject, getProjectData, resetCircle } from './editor';
import { resetHistory } from './history';
import { render, store } from './store';
import { handleRpgAction, renderRpgSheet, updateRpgInput } from './rpg-sheet';
import { renderSheetNavigation, setupSheetNavigation } from './sheet-navigation';

/** Seleção → ficha → editor. O desenho mantém seu editor e os dados ficam por personagem. */
export function setupCharacter(): void {
  const root = byId('characterPage');
  const sectionNavigation = setupSheetNavigation(root);
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
    document.getElementById('appShell')?.setAttribute('data-rpg-view', view);
    root.hidden = view === 'circulos';
    workspace.hidden = view !== 'circulos';
    const navigation = document.querySelector<HTMLElement>('.rpg-navigation');
    if (navigation) navigation.hidden = view === 'personagens';
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
    if (view === 'ficha') sectionNavigation.refresh();
    else sectionNavigation.clear();
  }
  function openRoster(focus = true): void {
    rememberDraft(); view = 'personagens'; drawRoster(); updateNavigation();
    if (focus) byId('characterRosterTitle').focus({ preventScroll: true });
    root.scrollTop = 0;
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
    byId<HTMLInputElement>('characterImport').addEventListener('change', evt => { void importFile(evt); });
  }
  function drawRoster(): void {
    sectionNavigation.clear();
    const count = library.characters.length;
    const full = count >= CHARACTER_LIBRARY_LIMIT ? ' disabled' : '';
    root.innerHTML = `<div class="character-roster illuminated-roster${count ? ' has-characters' : ''}"><div class="roster-shell">
      <header class="roster-heading"><div class="roster-heading-copy"><p class="character-eyebrow"><span aria-hidden="true">I</span> O seu grimório</p><h2 id="characterRosterTitle" tabindex="-1">Arquivo de <br><em>personagens.</em></h2><p>${count ? 'Fichas, jornadas e círculos em um só arquivo.' : 'Cada personagem, uma história por escrever. Abra sua ficha, registre a jornada e dê forma às suas magias.'}</p>
      <div class="roster-actions"><button class="btn btn-primary" data-character-action="new"${full}><span aria-hidden="true">+</span> Criar personagem</button><button class="btn" data-character-action="import"${full}>Importar ficha <span aria-hidden="true">↗</span></button></div></div>
      <div class="roster-frontispiece" aria-hidden="true"><span class="roster-frontispiece-caption">Fichas · Histórias · Círculos</span><svg viewBox="0 0 300 310" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M64 52 208 37l26 203-145 17z" fill="currentColor" fill-opacity=".035"/><path d="M64 52 208 37l26 203-145 17zM75 60l124-13 23 184-124 14z" stroke="currentColor" stroke-width="1.2"/><path d="m95 81 81-8M98 91l58-6m-43 115 80-8m-78 16 59-6" stroke="currentColor" stroke-width="1"/><path d="M136 112c-17 5-26 22-23 37 3 17 18 28 34 26s28-16 27-33c-1-18-18-32-38-30Z" stroke="currentColor"/><path d="m143 125 4 32m-14-23 20 17m-23-7 25-3" stroke="currentColor" stroke-linecap="round"/><path d="M216 269c-13-34-8-82 18-126m-16 102c12-4 22-13 24-26-14 0-24 8-27 18m1-11c-11-9-16-21-10-33 12 7 16 18 11 29m5-23c13-3 24-12 26-25-13 0-23 8-27 18m8-24c-7-12-7-23 2-33 9 11 8 24 2 31M79 275c-21-17-32-44-28-78m12 61c-14 0-25-6-29-17 13-3 24 1 28 12m-7-19c9-6 13-16 10-26-11 4-16 12-13 23m0-24c-11-4-17-13-15-24 12 2 18 10 15 20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 67h-9m4-4v8m213 30h-9m4-4v8M86 16h-6m3-3v6m173 181h-6m3-3v6" stroke="currentColor"/><path d="M83 284h134" stroke="currentColor" stroke-opacity=".4"/></svg><span class="roster-frontispiece-footer">Memórias de uma jornada</span></div></header>
      <div class="roster-collection-heading"><div><span class="roster-collection-kicker">A coleção</span><h3>Seus personagens <span>${String(count).padStart(2, '0')}</span></h3></div><p>Escolha uma história para continuar.</p></div>
      ${count ? `<div class="roster-grid">${library.characters.map((c, index) => {
        const name = c.data.identidade.nome.trim() || 'Personagem sem nome';
        const folio = String(index + 1).padStart(2, '0');
        const characterClass = c.data.rpg?.progressao.classes.find(entry => entry.nome.trim())?.nome;
        return `<article class="roster-card"><span class="roster-folio-spine" aria-hidden="true">SAVE · ${folio}</span><div class="roster-folio-top"><span>Slot ${folio}</span><span>${escapeHtml(c.data.rpg?.progressao.rank ? `Rank ${c.data.rpg.progressao.rank}` : 'Ficha de personagem')}</span></div><div class="roster-monogram" aria-hidden="true"><span>${escapeHtml(Array.from(name)[0].toLocaleUpperCase())}</span></div><div class="roster-card-body">${characterClass ? `<span class="roster-folio-class">${escapeHtml(characterClass)}</span>` : ''}<h3>${escapeHtml(name)}</h3><p>${escapeHtml(c.data.identidade.conceito || c.data.identidade.origem || 'Uma história esperando para ser escrita.')}</p>${c.data.identidade.campanha ? `<small>${escapeHtml(c.data.identidade.campanha)}</small>` : ''}</div><div class="roster-card-meta"><span>${c.data.magias.length} ${c.data.magias.length === 1 ? 'círculo guardado' : 'círculos guardados'}</span><span>${c.data.rpg?.pericias.length ?? 0} ${(c.data.rpg?.pericias.length ?? 0) === 1 ? 'perícia' : 'perícias'}</span></div><div class="roster-card-actions"><button class="btn btn-primary" data-character-action="open-character" data-id="${escapeHtml(c.id)}">Abrir personagem <span aria-hidden="true">→</span></button><div class="roster-folio-tools"><button class="btn" data-character-action="download-character" data-id="${escapeHtml(c.id)}">Baixar JSON</button><button class="btn" data-character-action="duplicate-character" data-id="${escapeHtml(c.id)}">Duplicar</button><button class="btn btn-danger" data-character-action="delete-character" data-id="${escapeHtml(c.id)}" aria-label="Excluir ${escapeHtml(name)}">Excluir</button></div></div></article>`;
      }).join('')}</div>` : `<div class="roster-empty"><div class="roster-empty-leaf" aria-hidden="true"><span>I</span><i></i><i></i><i></i></div><div class="roster-empty-copy"><p class="roster-collection-kicker">Uma página em branco</p><h3>O primeiro capítulo é seu.</h3><p>Comece pelo nome. A história, as habilidades e os círculos mágicos podem ganhar forma no seu ritmo.</p><div class="roster-empty-actions"><button class="btn btn-primary" data-character-action="new">Criar meu primeiro personagem <span aria-hidden="true">→</span></button><button class="btn" data-character-action="import">Já tenho uma ficha</button></div></div></div>`}
      <p class="roster-status" id="characterStatus" role="status"><span aria-hidden="true">◇</span> ${escapeHtml(persistenceWarning || 'Personagens salvos somente neste navegador. Exporte as fichas como backup.')}</p>
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
    const sidebarScroll = root.querySelector<HTMLElement>('.character-section-sidebar')?.scrollTop ?? 0;
    root.innerHTML = `<div class="character-sheet-layout">${renderSheetNavigation()}<div class="character-shell"><div class="sheet-folio-line" aria-hidden="true"><span>Grimório de personagens</span><span>Inscrição · História · Magia</span></div><div class="character-breadcrumb"><button class="btn" data-character-action="roster">← Personagens</button><span>Criação do personagem</span></div>
      <div class="character-heading"><div><p class="character-eyebrow">Fólio de personagem</p>
        <h2 id="characterTitle" tabindex="-1"><span id="characterName">${escapeHtml(character.identidade.nome || 'Seu personagem')}</span></h2>
        <p>Seu personagem, suas anotações e seus círculos em um só lugar.</p></div>
        <div class="character-actions"><button class="btn" data-character-action="download">Baixar ficha JSON</button>
          <button class="btn" data-character-action="import">Importar ficha</button><button class="btn" data-character-action="new">Novo personagem</button></div></div>
      <div class="character-notice"><strong>Escreva a próxima parte da sua história.</strong> Escolha seu arquétipo e preencha as seções da ficha. Os cálculos aparecem para consulta; os campos que dependem do mestre continuam editáveis.</div>
      <p class="character-status" id="characterStatus" role="status">${escapeHtml(persistenceWarning || 'Este personagem fica neste navegador. Baixe o JSON como backup.')}</p>
      <div class="character-columns"><section class="character-card" id="character-section-identidade"><h3>Identidade</h3><div class="character-fields">${(Object.keys(CHARACTER_FIELDS) as CharacterField[]).filter(f => !['historia', 'notas'].includes(f)).map(input).join('')}</div></section>
      <section class="character-card" id="character-section-historia"><h3>História livre e sessão</h3><div class="character-fields">${input('historia')}${input('notas')}</div></section></div>
      <div id="character-section-sistema">${renderRpgSheet(character.rpg ?? newRpgSheet())}</div>
      <details class="character-free-records" id="character-section-registros"${Object.values(character.secoes).some(rows => rows.length) ? ' open' : ''}><summary>Registros livres e fichas anteriores</summary><p class="character-help">Suas anotações antigas continuam aqui. Use estes campos também para habilidades e registros adicionais definidos pelo mestre.</p>
      <div class="character-columns">${(Object.entries(CHARACTER_SECTIONS) as [CharacterSection, string][]).map(([key, label]) => `
        <section class="character-card" id="character-section-${key}"><div class="character-section-heading"><h3>${label}</h3><button class="btn btn-small" data-character-action="add" data-section="${key}"${character.secoes[key].length >= 50 ? ' disabled' : ''}>+ Adicionar</button></div>
          <p class="character-help">${key === 'recursos' ? 'Anote valores atuais e máximos no formato que preferir.' : 'Defina os nomes e valores de acordo com o seu sistema.'}</p>
          ${character.secoes[key].length ? character.secoes[key].map((entry, index) => `<div class="character-entry">
            <label class="character-field"><span>Nome</span><input data-section="${key}" data-index="${index}" data-entry="nome" maxlength="120" value="${escapeHtml(entry.nome)}"></label>
            <label class="character-field"><span>Valor / descrição curta</span><input data-section="${key}" data-index="${index}" data-entry="valor" maxlength="120" value="${escapeHtml(entry.valor)}"></label>
            <label class="character-field character-wide"><span>Detalhes</span><textarea data-section="${key}" data-index="${index}" data-entry="notas" maxlength="1000" rows="2">${escapeHtml(entry.notas)}</textarea></label>
            <button class="btn btn-danger" data-character-action="remove" data-section="${key}" data-index="${index}" aria-label="Remover item de ${label}">Remover</button></div>`).join('') : `<div class="character-empty">Nenhum item em ${label.toLowerCase()}. Adicione quando quiser.</div>`}
        </section>`).join('')}</div></details>
      <div class="character-columns">
      <section class="character-card character-wide" id="character-section-magias"><div class="character-section-heading"><h3>Magias e círculos</h3><button class="btn btn-small" data-character-action="enter-editor">Criar círculo</button></div><div class="character-editor-link"><p>Abra o editor completo de runas e círculos para este personagem.</p><button class="btn btn-primary" data-character-action="enter-editor">Abrir criação de círculos</button></div>
        <p class="character-help">Guarda uma cópia do desenho que está no editor. Alterações futuras no editor não mudam a cópia da ficha.</p>
        ${character.magias.length ? character.magias.map((spell, index) => `<div class="character-spell"><strong>${escapeHtml(spell.nome)}</strong><div><button class="btn" data-character-action="open-spell" data-index="${index}">Abrir no editor</button><button class="btn btn-danger" data-character-action="remove-spell" data-index="${index}" aria-label="Remover ${escapeHtml(spell.nome)} da ficha">Remover</button></div></div>`).join('') : '<div class="character-empty">Crie um círculo no editor e guarde uma cópia aqui.</div>'}
      </section></div><input type="file" id="characterImport" accept=".json,application/json" hidden></div></div>`;
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
    if (evt.target instanceof HTMLSelectElement) updateRpgControl(evt.target);
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
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !activeId) return;
    if (el.dataset.rpgField) { updateRpgControl(el); return; }
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
          const rows = scope?.querySelectorAll<HTMLElement>('.rpg-entry');
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
