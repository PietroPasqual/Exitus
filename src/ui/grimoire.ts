import { escapeHtml } from '../core/format';
import { PRESETS } from '../data/presets';
import { byId } from './dom';
import content from './grimoire-content.html?raw';

// Grimório: regras, tabelas e o Livro de Magias

export function setupGrimoire(): void {
  const body = byId('grimoireModal').querySelector('.modal-body');
  if (body) {
    body.innerHTML = content;
    buildIndex(body);
  }

  // Livro de Magias (caderno + magias novas), com botão para abrir no editor
  byId('spellBook').innerHTML = Object.entries(PRESETS)
    .filter(([, p]) => p.info.kind !== 'estudo')
    .map(([key, p]) => `
          <div class="spell-entry">
            <div><strong>${escapeHtml(p.info.name)}</strong>${p.info.kind === 'caderno' ? ' <small>(do caderno)</small>' : ''}<p>${escapeHtml(p.info.desc)}</p></div>
            <button class="btn" data-action="open-spell" data-arg="${key}">Abrir ▸</button>
          </div>`).join('');
}

/** Menu "Ir para…" com as seções do Grimório */
function buildIndex(body: Element): void {
  const select = byId<HTMLSelectElement>('grimoireIndex');
  const headings = [...body.querySelectorAll<HTMLElement>('.grimoire-card > h3')];
  select.innerHTML = '<option value="">Ir para…</option>' + headings.map((h, i) => {
    h.id = `grim-${i}`;
    return `<option value="${h.id}">${escapeHtml(h.textContent ?? '')}</option>`;
  }).join('');
  select.addEventListener('change', () => {
    if (select.value) byId(select.value).scrollIntoView({ behavior: 'smooth', block: 'start' });
    select.value = '';
  });
}

export const openGrimoire = (): void => byId('grimoireModal').classList.add('open');
export const closeGrimoire = (): void => byId('grimoireModal').classList.remove('open');
