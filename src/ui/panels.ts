import { getNodeShortLabel, isMainPrism, isPrism, PRISM_SHAPES } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { MagicNode, RuneFilter } from '../core/types';
import { getRuneType, RUNE_TYPES, runeColor, RUNES } from '../data/runes';
import { SHAPE_META } from '../data/shapes';
import { byId, inputValue } from './dom';
import { renderPalette, selectedNode, store } from './store';

// ---------- Lista de runas ----------

/** Filtros por tipo de runa: a cor do ponto é a mesma do desenho da runa */
export function renderRuneFilters(): void {
  const all = Object.values(RUNES);
  const current = store.state.runeCategoryFilter;
  const chip = (arg: string, label: string, count: number, color = ''): string => `
          <button class="chip${current === arg ? ' active' : ''}" data-action="rune-cat" data-arg="${arg}" aria-pressed="${current === arg}">
            ${color ? `<i style="background:${color}"></i>` : ''}${label} <small>${count}</small>
          </button>`;
  byId('runeFilters').innerHTML = chip('all', 'Todas', all.length)
    + Object.entries(RUNE_TYPES).map(([id, t]) => chip(id, t.label, all.filter(r => getRuneType(r) === id).length, t.color)).join('');
}

export function setRuneCat(cat: RuneFilter): void {
  store.state.runeCategoryFilter = cat;
  renderRuneFilters();
  renderPalette();
}

/** Para qual forma vai a runa tocada (e se ela já tem uma) */
function renderRuneTarget(): void {
  const state = store.state;
  const node = selectedNode() || state.nodes[0];
  const rune = node.rune ? RUNES[node.rune] : null;
  byId('runeTargetText').innerHTML = `Toque numa runa para pôr em <b>${escapeHtml(nodeName(node))}</b>`
    + (rune ? ` · agora: <b style="color:${runeColor(rune)}">${escapeHtml(rune.name.split(' (')[0])}</b>` : '');
  byId('btnClearRune').hidden = !rune;
  // Magia dentro do selo: só Selo ○ e Col □ que já têm uma runa
  const nest = (node.shape === 'circle' || node.shape === 'square') && !!rune;
  const toggle = byId('btnInnerMode');
  toggle.hidden = !nest;
  toggle.setAttribute('aria-pressed', String(nest && state.innerMode));
  if (nest && state.innerMode) {
    const list = [node.rune, ...(node.inner ?? [])].map(id => RUNES[id as string]).filter(Boolean)
      .map(r => `<b style="color:${runeColor(r)}">${escapeHtml(r.name.split(' (')[0])}</b>`).join(' + ');
    byId('runeTargetText').innerHTML = `Toque numa runa para pôr <b>dentro</b> de <b>${escapeHtml(nodeName(node))}</b>, junto com ${list}`;
  }
}

/** Nome curto da forma: "◇ Prisma", "○ Selo #2" */
export function nodeName(node: MagicNode): string {
  const state = store.state;
  const meta = SHAPE_META[node.shape] || SHAPE_META.circle;
  const symbol = meta.name.split(' ')[1] ?? '';
  if (isPrism(node)) return `${symbol} ${getNodeShortLabel(state, node.id)}`;
  return `${symbol} ${meta.short.split(' (')[0]} #${state.nodes.indexOf(node)}`;
}

export function renderRunePalette(): void {
  const state = store.state;
  const query = inputValue('runeSearch').toLowerCase().trim();
  const current = selectedNode()?.rune;

  renderRuneTarget();
  const filtered = Object.values(RUNES).filter(r => {
    if (state.runeCategoryFilter !== 'all' && getRuneType(r) !== state.runeCategoryFilter) return false;
    if (query && !r.name.toLowerCase().includes(query) && !r.sigil.toLowerCase().includes(query)) return false;
    return true;
  });

  if (!filtered.length) {
    byId('runesGrid').innerHTML = `<div class="muted empty">Nenhuma runa com esse nome.</div>`;
    return;
  }
  byId('runesGrid').innerHTML = filtered.map(r => `
          <div class="rune-item ${current === r.id ? 'selected' : ''}" data-action="assign-rune" data-arg="${r.id}" title="${escapeHtml(`${r.name} (${r.sigil})${r.desc ? ' — ' + r.desc : ''}`)}">
            <svg viewBox="-20 -20 40 40" style="stroke:${runeColor(r)}; color:${runeColor(r)};">${r.svg}</svg>
            <span>${r.name.split(' (')[0]}</span>
            <small>${r.sigil}</small>
          </div>
        `).join('');
}

// ---------- Inspetor do nó selecionado ----------

export function renderInspector(): void {
  const state = store.state;
  const node = selectedNode() || state.nodes[0];
  const meta = SHAPE_META[node.shape] || SHAPE_META.circle;

  byId('inspectorTitle').textContent = isPrism(node) ? `${nodeName(node)} · essencial` : nodeName(node);
  byId('inspectorBadge').textContent = meta.short;

  // Runa da forma
  const rune = node.rune ? RUNES[node.rune] : null;
  byId('nodeRuneIcon').innerHTML = rune ? `<svg viewBox="-20 -20 40 40" style="stroke:${runeColor(rune)};color:${runeColor(rune)}">${rune.svg}</svg>` : '';
  byId('nodeRuneName').innerHTML = rune ? `${escapeHtml(rune.name)} <small>${escapeHtml(rune.sigil)}</small>` : '<span class="muted">Sem runa</span>';
  renderRuneTarget();
  byId('nodeInnerList').innerHTML = (node.inner ?? []).map((id, i) => {
    const r = RUNES[id];
    if (!r) return '';
    return `<span class="inner-chip"><i style="background:${runeColor(r)}"></i>dentro: ${escapeHtml(r.name.split(' (')[0])}<button data-action="remove-inner" data-arg="${i}" aria-label="Tirar ${escapeHtml(r.name)} de dentro" title="Tirar de dentro">✕</button></span>`;
  }).join('');

  const shapeSel = byId<HTMLSelectElement>('nodeShapeSelect');
  shapeSel.value = node.shape;
  [...shapeSel.options].forEach(o => { o.disabled = isPrism(node) && !PRISM_SHAPES.includes(o.value as MagicNode['shape']); });

  byId<HTMLSelectElement>('nodeStateSelect').value = node.activation || 'ativacao';
  byId<HTMLInputElement>('nodeSizeRange').value = String(node.size);
  byId('lblNodeSize').textContent = String(node.size);
  byId<HTMLInputElement>('nodeRotRange').value = String(node.rot || 0);
  byId('lblNodeRot').textContent = String(node.rot || 0);
  byId<HTMLInputElement>('nodeChargeInput').value = String(node.charge || 1);
  // Cargas extras só valem para a Estrela e o Rad
  byId('nodeCustomPowerRow').hidden = !(node.shape === 'star' || node.shape === 'hexagon');
  byId('nodeRoleDesc').textContent = meta.role;
  byId('btnDeleteNode').hidden = isMainPrism(state, node);
  byId('btnDeleteNodeLabel').textContent = isPrism(node) ? 'Excluir este círculo' : 'Excluir forma';
}

// ---------- Ligações: seletores e lista de cabos ----------

function nodeLabel(node: MagicNode): string {
  const rune = node.rune ? RUNES[node.rune]?.name.split(' (')[0] : 'sem runa';
  return `${nodeName(node)} — ${rune}`;
}

/** Forma no item da lista de ligações: símbolo, nome e a runa na cor dela */
function connEnd(node: MagicNode): string {
  const rune = node.rune ? RUNES[node.rune] : null;
  return `<span class="conn-end">${escapeHtml(nodeName(node))}${rune ? ` <i style="color:${runeColor(rune)}">${escapeHtml(rune.name.split(' (')[0])}</i>` : ''}</span>`;
}

const CONN_TYPE: Record<string, string> = { straight: 'Reta', 'arc-cw': 'Arco por fora', 'arc-ccw': 'Arco por dentro' };

export function renderConnections(): void {
  const state = store.state;
  const fromSel = byId<HTMLSelectElement>('connFromSelect');
  const toSel = byId<HTMLSelectElement>('connToSelect');
  const prevFrom = fromSel.value;
  const prevTo = toSel.value;

  const opts = state.nodes.map(n => `<option value="${n.id}">${escapeHtml(nodeLabel(n))}</option>`).join('');
  fromSel.innerHTML = opts;
  toSel.innerHTML = opts;
  if (state.nodes.some(n => n.id === prevFrom)) fromSel.value = prevFrom;
  if (state.nodes.some(n => n.id === prevTo)) toSel.value = prevTo;
  else if (state.nodes.length > 1) toSel.value = state.nodes[1].id;

  const list = byId('connectionsList');
  byId('connCount').textContent = String(state.connections.length);
  if (state.connections.length === 0) {
    list.innerHTML = `<div class="muted empty">Nenhuma ligação ainda. Ligue o Prisma a uma forma e volte ao Prisma.</div>`;
    return;
  }
  list.innerHTML = state.connections.map(c => {
    const n1 = state.nodes.find(n => n.id === c.from);
    const n2 = state.nodes.find(n => n.id === c.to);
    if (!n1 || !n2) return '';
    return `
          <div class="connection-item">
            <div class="conn-route">
              ${connEnd(n1)}
              <span class="conn-arrow-txt" aria-label="para">→</span>
              ${connEnd(n2)}
              <small class="conn-meta">${CONN_TYPE[c.type] ?? 'Reta'} · ${c.mode === 'sequential' ? 'Sequencial' : 'Simultânea'}</small>
            </div>
            <span class="btns">
              <button class="btn btn-icon" title="Inverter o sentido" aria-label="Inverter o sentido" data-action="reverse-conn" data-arg="${c.id}"><svg class="ic" aria-hidden="true"><use href="#i-swap"/></svg></button>
              <button class="btn btn-icon btn-danger" title="Remover a ligação" aria-label="Remover a ligação" data-action="remove-conn" data-arg="${c.id}"><svg class="ic" aria-hidden="true"><use href="#i-close"/></svg></button>
            </span>
          </div>
        `;
  }).join('');
}
