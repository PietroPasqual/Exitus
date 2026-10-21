import type { Character } from '../core/character';
import { escapeHtml } from '../core/format';
import { POWER_NOTES_LIMIT, POWER_PATHS, POWER_PATH_IDS, type PowerPathId } from '../core/power-paths';
import { rulebookLink } from './rulebook';

/** Caminhos escolhidos primeiro; os demais continuam à mão para consultar ou escolher. */
const ordered = (chosen: readonly PowerPathId[]): PowerPathId[] => [...chosen, ...POWER_PATH_IDS.filter(id => !chosen.includes(id))];

/** Ferramenta do caminho da Mana: os círculos mágicos guardados nesta ficha. */
function manaTool(character: Character): string {
  return `<div class="power-tool"><div class="character-editor-link"><p>Desenhe as magias no ateliê de runas e círculos e guarde uma cópia aqui.</p><button class="btn btn-primary" data-character-action="enter-editor">Abrir ateliê de círculos</button></div>
    <p class="character-help">A cópia guardada não muda quando o desenho é alterado depois no ateliê.</p>
    ${character.magias.length ? character.magias.map((spell, index) => `<div class="character-spell"><strong>${escapeHtml(spell.nome)}</strong><div><button class="btn" data-character-action="open-spell" data-index="${index}">Abrir no ateliê</button><button class="btn btn-danger" data-character-action="remove-spell" data-index="${index}" aria-label="Remover ${escapeHtml(spell.nome)} da ficha">Remover</button></div></div>`).join('') : '<div class="character-empty">Nenhum círculo guardado ainda.</div>'}</div>`;
}

/** Seção "Caminhos de poder" da ficha (mantém o id antigo da seção de círculos, usado nos atalhos). */
export function renderPowerPaths(character: Character): string {
  const chosen = character.poderes?.caminhos ?? [];
  return `<section class="character-card character-wide power-paths" id="character-section-magias"><div class="character-section-heading"><h3>Caminhos de poder</h3><span class="power-count">${chosen.length ? chosen.map(id => POWER_PATHS[id].nome).join(' · ') : 'Nenhum escolhido'}</span></div>
    <p class="character-help">Marque os caminhos que o personagem segue. Cada um é um pilar do Livro de Regras com sua própria forma de poder: o círculo mágico é a ferramenta da Mana, e os outros caminhos ganham ferramentas próprias aos poucos. Até lá, registre tudo nas anotações de cada um.</p>
    <div class="power-grid">${ordered(chosen).map(id => {
      const path = POWER_PATHS[id], on = chosen.includes(id);
      return `<article class="power-card${on ? ' is-chosen' : ''}" data-power="${id}">
        <header class="power-card-head"><label class="power-toggle"><input type="checkbox" data-power-toggle="${id}"${on ? ' checked' : ''}><span><strong>${path.nome}</strong><small>${path.pilar}</small></span></label><span class="power-state">${on ? 'Caminho escolhido' : 'Não escolhido'}</span></header>
        <p class="power-summary">${escapeHtml(path.resumo)}</p>
        <p class="power-status">${escapeHtml(path.estado)}</p>
        ${id === 'mana' ? manaTool(character) : `<label class="character-field"><span>Anotações de ${path.nome}</span><textarea data-power-note="${id}" maxlength="${POWER_NOTES_LIMIT}" rows="3" placeholder="${escapeHtml(path.guia)}">${escapeHtml(character.poderes?.notas[id] ?? '')}</textarea></label>`}
        <div class="rpg-rulebook-links">${rulebookLink(path.capitulo, `Regras: ${path.nome}`)}</div>
      </article>`;
    }).join('')}</div>
  </section>`;
}

/** Cartões de escolha usados na criação do personagem. */
export function renderPowerChoices(chosen: ReadonlySet<PowerPathId>): string {
  return `<div class="power-grid power-choices" role="group" aria-label="Caminhos de poder">${POWER_PATH_IDS.map(id => {
    const path = POWER_PATHS[id];
    return `<label class="power-card power-choice${chosen.has(id) ? ' is-chosen' : ''}"><span class="power-toggle"><input type="checkbox" data-creation-power="${id}"${chosen.has(id) ? ' checked' : ''}><span><strong>${path.nome}</strong><small>${path.pilar}</small></span></span><span class="power-summary">${escapeHtml(path.resumo)}</span><span class="power-status">${escapeHtml(path.estado)}</span></label>`;
  }).join('')}</div>`;
}
