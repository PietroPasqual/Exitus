import { escapeHtml } from '../core/format';
import { spellTier, spellTiers, tierLabel } from '../core/analysis';
import { PRESETS } from '../data/presets';
import { byId } from './dom';
import content from './grimoire-content.html?raw';
import { renderRuneData, renderSealTable } from './grimoire-runes';

// Grimório: regras, tabelas e o Livro de Magias

export function setupGrimoire(): void {
  const body = byId('grimoireModal').querySelector('.modal-body');
  if (body) {
    body.innerHTML = content;
    byId('grimoireRuneData').innerHTML = renderRuneData();
    byId('sealTable').innerHTML = renderSealTable();
    buildIndex(body);
    byId<HTMLSelectElement>('grimoireIndex').addEventListener('change', e => {
      const select = e.target as HTMLSelectElement;
      if (select.value) byId(select.value).scrollIntoView({ behavior: 'smooth', block: 'start' });
      select.value = '';
    });
  }

  // Livro de Magias (caderno + magias novas), com botão para abrir no editor
  byId('spellBook').innerHTML = Object.entries(PRESETS)
    .filter(([, p]) => p.info.kind === 'caderno' || p.info.kind === 'magia')
    .map(([key, p]) => `
          <div class="spell-entry">
            <div><strong>${escapeHtml(p.info.name)}</strong>${p.info.kind === 'caderno' ? ' <small>(do caderno)</small>' : ''} <small class="tier-badge${spellTier(p) > 1 ? ' tier-2' : ''}">${spellTiers(p).map(t => tierLabel(t)).join(' · ')}</small><p>${escapeHtml(p.info.desc)}</p></div>
            <button class="btn" data-action="open-spell" data-arg="${key}">Abrir ▸</button>
          </div>`).join('');

  // Magias Falhas: versão antiga + o que estava errado + link para a corrigida
  byId('failedBook').innerHTML = Object.entries(PRESETS)
    .filter(([, p]) => p.info.kind === 'falha')
    .map(([key, p]) => {
      const fixed = p.info.fixedIn ? PRESETS[p.info.fixedIn] : undefined;
      return `
          <div class="spell-entry failed-entry">
            <div><strong>${escapeHtml(p.info.name)}</strong>${fixed && fixed.info.name !== p.info.name ? ` <small>→ corrigida: ${escapeHtml(fixed.info.name)}</small>` : ''}
              <ul class="failed-errors">${(p.info.errors ?? []).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>
            <div class="failed-btns">
              <button class="btn" data-action="open-spell" data-arg="${key}">Ver falha</button>
              ${fixed ? `<button class="btn" data-action="open-spell" data-arg="${escapeHtml(p.info.fixedIn as string)}">Corrigida ▸</button>` : ''}
            </div>
          </div>`;
    }).join('');
}

/** Menu "Ir para…" com as seções do Grimório */
function buildIndex(body: Element): void {
  const select = byId<HTMLSelectElement>('grimoireIndex');
  const headings = [...body.querySelectorAll<HTMLElement>('.grimoire-card > h3')];
  select.innerHTML = '<option value="">Ir para…</option>' + headings.map((h, i) => {
    h.id = `grim-${i}`;
    return `<option value="${h.id}">${escapeHtml(h.textContent ?? '')}</option>`;
  }).join('');
}

/** Monta de novo a Tabela Geral e as fichas (quando as regras mudam) */
export function refreshGrimoireRunes(): void {
  const holder = document.getElementById('grimoireRuneData');
  const body = byId('grimoireModal').querySelector('.modal-body');
  if (!holder || !body) return;
  holder.innerHTML = renderRuneData();
  const seals = document.getElementById('sealTable');
  if (seals) seals.innerHTML = renderSealTable();
  buildIndex(body);
}

export const openGrimoire = (): void => byId('grimoireModal').classList.add('open');
export const closeGrimoire = (): void => byId('grimoireModal').classList.remove('open');
