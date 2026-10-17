import {
  CHARACTER_FIELDS, CHARACTER_SECTIONS, CHARACTER_KEY, CHARACTER_FILE_LIMIT,
  newCharacter, normalizeCharacter, type CharacterField, type CharacterSection
} from '../core/character';
import { normalizeProject } from '../core/project';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { applyProject, getProjectData } from './editor';
import { render, store } from './store';

/** Ficha local independente de regras. O editor existente continua sendo a fonte dos desenhos. */
export function setupCharacter(): void {
  const root = byId('characterPage');
  const workspace = document.querySelector<HTMLElement>('.workspace')!;
  let character = newCharacter();
  let restoreWarning = '';
  try {
    const saved = localStorage.getItem(CHARACTER_KEY);
    if (saved) {
      const restored = saved.length <= CHARACTER_FILE_LIMIT ? normalizeCharacter(JSON.parse(saved)) : null;
      if (restored) character = restored;
      else restoreWarning = 'A ficha guardada não pôde ser aberta. Nada foi substituído; editar ou importar uma ficha substituirá o conteúdo local.';
    }
  } catch { restoreWarning = 'Não foi possível ler a ficha neste navegador. Você pode preencher e baixar uma cópia.'; }

  function status(message: string): void { byId('characterStatus').textContent = message; }
  function save(): void {
    try {
      const json = JSON.stringify(character);
      if (json.length > CHARACTER_FILE_LIMIT) throw new Error('large');
      localStorage.setItem(CHARACTER_KEY, json);
      status('Salvo neste navegador');
    } catch { status('Não foi possível salvar neste navegador. Baixe o JSON para guardar suas alterações.'); }
    byId('characterName').textContent = character.identidade.nome.trim() || 'Seu personagem';
  }
  function switchPage(page: 'ficha' | 'circulos'): void {
    const sheet = page === 'ficha';
    root.hidden = !sheet;
    workspace.hidden = sheet;
    for (const id of ['presetSelect', 'fileMenu', 'btnOpenGrimoire', 'btnAccount']) byId(id).hidden = sheet;
    document.querySelectorAll<HTMLButtonElement>('[data-rpg-page]').forEach(button => {
      const active = button.dataset.rpgPage === page;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (sheet) byId('characterTitle').focus();
    else { render(); byId('btnCharacterLink').focus(); }
  }
  document.querySelectorAll<HTMLButtonElement>('[data-rpg-page]').forEach(button => {
    button.addEventListener('click', () => switchPage(button.dataset.rpgPage === 'ficha' ? 'ficha' : 'circulos'));
  });
  const input = (field: CharacterField): string => {
    const long = ['aparencia', 'historia', 'notas'].includes(field);
    const attrs = `id="character-${field}" data-character-field="${field}" maxlength="${long ? 6000 : 160}"`;
    return `<label class="character-field${long ? ' character-wide' : ''}"><span>${CHARACTER_FIELDS[field]}</span>${long
      ? `<textarea ${attrs} rows="4">${escapeHtml(character.identidade[field])}</textarea>`
      : `<input ${attrs} value="${escapeHtml(character.identidade[field])}" autocomplete="off">`}</label>`;
  };
  function draw(): void {
    root.innerHTML = `<div class="character-shell">
      <div class="character-heading"><div><p class="character-eyebrow">Ficha de personagem · base inicial</p>
        <h2 id="characterTitle" tabindex="-1"><span id="characterName">${escapeHtml(character.identidade.nome || 'Seu personagem')}</span></h2>
        <p>Seu personagem, suas anotações e seus círculos em um só lugar.</p></div>
        <div class="character-actions"><button class="btn" data-character-action="download">Baixar ficha JSON</button>
          <button class="btn" data-character-action="import">Importar ficha</button><button class="btn" data-character-action="new">Nova ficha</button></div></div>
      <div class="character-notice"><strong>Vamos montar as regras juntos.</strong> Os campos abaixo são livres. Atributos, perícias, limites e cálculos serão adaptados quando você enviar o sistema do RPG.</div>
      <p class="character-status" id="characterStatus" role="status">${escapeHtml(restoreWarning || 'Ficha local: fica somente neste navegador. Baixe o JSON como backup.')}</p>
      <div class="character-columns"><section class="character-card"><h3>Identidade</h3><div class="character-fields">${(Object.keys(CHARACTER_FIELDS) as CharacterField[]).filter(f => !['historia', 'notas'].includes(f)).map(input).join('')}</div></section>
      <section class="character-card"><h3>História e sessão</h3><div class="character-fields">${input('historia')}${input('notas')}</div></section></div>
      <div class="character-columns">${(Object.entries(CHARACTER_SECTIONS) as [CharacterSection, string][]).map(([key, label]) => `
        <section class="character-card"><div class="character-section-heading"><h3>${label}</h3><button class="btn btn-small" data-character-action="add" data-section="${key}"${character.secoes[key].length >= 50 ? ' disabled' : ''}>+ Adicionar</button></div>
          <p class="character-help">${key === 'recursos' ? 'Anote valores atuais e máximos no formato que preferir.' : 'Defina os nomes e valores de acordo com o seu sistema.'}</p>
          ${character.secoes[key].length ? character.secoes[key].map((entry, index) => `<div class="character-entry">
            <label class="character-field"><span>Nome</span><input data-section="${key}" data-index="${index}" data-entry="nome" maxlength="120" value="${escapeHtml(entry.nome)}"></label>
            <label class="character-field"><span>Valor / descrição curta</span><input data-section="${key}" data-index="${index}" data-entry="valor" maxlength="120" value="${escapeHtml(entry.valor)}"></label>
            <label class="character-field character-wide"><span>Detalhes</span><textarea data-section="${key}" data-index="${index}" data-entry="notas" maxlength="1000" rows="2">${escapeHtml(entry.notas)}</textarea></label>
            <button class="btn btn-danger" data-character-action="remove" data-section="${key}" data-index="${index}" aria-label="Remover item de ${label}">Remover</button></div>`).join('') : `<div class="character-empty">Nenhum item em ${label.toLowerCase()}. Adicione quando quiser.</div>`}
        </section>`).join('')}
      <section class="character-card"><div class="character-section-heading"><h3>Magias e círculos</h3><button class="btn btn-small" data-character-action="attach"${character.magias.length >= 20 ? ' disabled' : ''}>+ Guardar círculo atual</button></div>
        <p class="character-help">Guarda uma cópia do desenho que está no editor. Alterações futuras no editor não mudam a cópia da ficha.</p>
        ${character.magias.length ? character.magias.map((spell, index) => `<div class="character-spell"><strong>${escapeHtml(spell.nome)}</strong><div><button class="btn" data-character-action="open-spell" data-index="${index}">Abrir no editor</button><button class="btn btn-danger" data-character-action="remove-spell" data-index="${index}" aria-label="Remover ${escapeHtml(spell.nome)} da ficha">Remover</button></div></div>`).join('') : '<div class="character-empty">Crie um círculo no editor e guarde uma cópia aqui.</div>'}
      </section></div><input type="file" id="characterImport" accept=".json,application/json" hidden></div>`;
    byId<HTMLInputElement>('characterImport').addEventListener('change', evt => { void importFile(evt); });
  }
  function download(): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `ficha-${character.identidade.nome.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60) || 'personagem'}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('Download solicitado. Guarde o arquivo como backup da ficha.');
  }
  async function importFile(evt: Event): Promise<void> {
    const fileInput = evt.target as HTMLInputElement;
    const file = fileInput.files?.[0]; fileInput.value = '';
    if (!file) return;
    if (file.size > CHARACTER_FILE_LIMIT) { status('Arquivo muito grande. O limite é 2 MB.'); return; }
    try {
      const next = normalizeCharacter(JSON.parse(await file.text()));
      if (!next) { status('Arquivo inválido ou versão incompatível. Importe um JSON de ficha deste site.'); return; }
      if (!confirm('Importar esta ficha substituirá a ficha aberta. Baixe sua ficha atual antes, se quiser guardá-la. Continuar?')) return;
      character = next; restoreWarning = ''; draw(); save();
    } catch { status('Não foi possível abrir o arquivo. Sua ficha atual foi mantida.'); }
  }
  root.addEventListener('input', evt => {
    const el = evt.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    const field = el.dataset.characterField;
    if (field && Object.prototype.hasOwnProperty.call(CHARACTER_FIELDS, field)) character.identidade[field as CharacterField] = el.value;
    else {
      const section = el.dataset.section as CharacterSection;
      const entry = character.secoes[section]?.[Number(el.dataset.index)];
      const key = el.dataset.entry;
      if (!entry || !['nome', 'valor', 'notas'].includes(key ?? '')) return;
      entry[key as keyof typeof entry] = el.value;
    }
    save();
  });
  root.addEventListener('click', evt => {
    const button = (evt.target as Element).closest<HTMLButtonElement>('[data-character-action]');
    if (!button) return;
    const action = button.dataset.characterAction, index = Number(button.dataset.index);
    const section = button.dataset.section as CharacterSection;
    if (action === 'download') { download(); return; }
    if (action === 'import') { byId<HTMLInputElement>('characterImport').click(); return; }
    if (action === 'new') {
      if (!confirm('Criar uma nova ficha substituirá a ficha aberta. Baixe um JSON antes para guardá-la. Continuar?')) return;
      character = newCharacter();
    } else if (action === 'add' && Object.prototype.hasOwnProperty.call(CHARACTER_SECTIONS, section)) {
      if (character.secoes[section].length >= 50) return;
      character.secoes[section].push({ nome: '', valor: '', notas: '' });
    } else if (action === 'remove' && character.secoes[section]?.[index]) {
      if (!confirm('Remover este item da ficha?')) return;
      character.secoes[section].splice(index, 1);
    } else if (action === 'attach') {
      if (character.magias.length >= 20) return;
      const projeto = normalizeProject(getProjectData());
      if (!projeto) { status('Não foi possível guardar este círculo.'); return; }
      character.magias.push({ nome: projeto.spellInfo?.name || `Círculo ${character.magias.length + 1}`, projeto });
    } else if (action === 'open-spell' && character.magias[index]) {
      if (!confirm('Abrir esta cópia substituirá o desenho atual no editor. Continuar?')) return;
      const projeto = normalizeProject(character.magias[index].projeto)!;
      applyProject(projeto); store.savedCircle = null; switchPage('circulos'); return;
    } else if (action === 'remove-spell' && character.magias[index]) {
      if (!confirm('Remover esta cópia do círculo da ficha?')) return;
      character.magias.splice(index, 1);
    } else return;
    restoreWarning = ''; draw(); save();
    if (action === 'add') root.querySelector<HTMLInputElement>(`input[data-section="${section}"][data-index="${character.secoes[section].length - 1}"]`)?.focus();
  });
  draw(); // Não grava automaticamente: preserva um backup inválido até uma ação explícita.
}
