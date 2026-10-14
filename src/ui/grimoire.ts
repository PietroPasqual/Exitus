import { escapeHtml } from '../core/format';
import { PRESETS } from '../data/presets';
import { byId } from './dom';
import content from './grimoire-content.html?raw';

// Grimório: regras, tabelas e o Livro de Magias

export function setupGrimoire(): void {
  const body = byId('grimoireModal').querySelector('.modal-body');
  if (body) body.innerHTML = content;

  // Livro de Magias (caderno + magias novas), com botão para abrir no editor
  byId('spellBook').innerHTML = Object.entries(PRESETS)
    .filter(([, p]) => p.info.kind !== 'estudo')
    .map(([key, p]) => `
          <div class="spell-entry">
            <div><strong>${escapeHtml(p.info.name)}</strong>${p.info.kind === 'caderno' ? ' <small>(do caderno)</small>' : ''}<p>${escapeHtml(p.info.desc)}</p></div>
            <button class="btn" data-action="open-spell" data-arg="${key}">Abrir ▸</button>
          </div>`).join('');
}

export const openGrimoire = (): void => byId('grimoireModal').classList.add('open');
export const closeGrimoire = (): void => byId('grimoireModal').classList.remove('open');
