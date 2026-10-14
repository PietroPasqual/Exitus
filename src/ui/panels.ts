import { getNodeShortLabel, isMainPrism, isPrism, PRISM_SHAPES } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { MagicNode, RuneFilter } from '../core/types';
import { RUNE_TYPES, runeColor, RUNES } from '../data/runes';
import { SHAPE_META } from '../data/shapes';
import { byId, inputValue } from './dom';
import { renderPalette, selectedNode, store } from './store';

// ---------- Lista de runas ----------

export function renderRuneLegend(): void {
  byId('runeLegend').innerHTML = Object.values(RUNE_TYPES)
    .map(t => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('');
}

export function setRuneCat(cat: RuneFilter): void {
  store.state.runeCategoryFilter = cat;
  document.querySelectorAll<HTMLElement>('[data-action="rune-cat"]').forEach(b => b.classList.toggle('active', b.dataset.arg === cat));
  renderPalette();
}

export function renderRunePalette(): void {
  const state = store.state;
  const query = inputValue('runeSearch').toLowerCase().trim();
  const current = selectedNode()?.rune;

  const filtered = Object.values(RUNES).filter(r => {
    if (state.runeCategoryFilter !== 'all' && r.category !== state.runeCategoryFilter) return false;
    if (query && !r.name.toLowerCase().includes(query) && !r.sigil.toLowerCase().includes(query)) return false;
    return true;
  });

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
  const idx = state.nodes.indexOf(node);
  const meta = SHAPE_META[node.shape] || SHAPE_META.circle;

  byId('inspectorTitle').textContent = isPrism(node) ? `${getNodeShortLabel(state, node.id)} (Essencial)` : `Nó #${idx}: ${meta.name}`;
  byId('inspectorBadge').textContent = meta.short;

  const shapeSel = byId<HTMLSelectElement>('nodeShapeSelect');
  shapeSel.value = node.shape;
  [...shapeSel.options].forEach(o => { o.disabled = isPrism(node) && !PRISM_SHAPES.includes(o.value as MagicNode['shape']); });

  byId<HTMLSelectElement>('nodeStateSelect').value = node.activation || 'ativacao';
  byId<HTMLInputElement>('nodeSizeRange').value = String(node.size);
  byId('lblNodeSize').textContent = String(node.size);
  byId<HTMLInputElement>('nodeRotRange').value = String(node.rot || 0);
  byId('lblNodeRot').textContent = String(node.rot || 0);
  byId<HTMLInputElement>('nodeChargeInput').value = String(node.charge || 1);
  byId('nodeRoleDesc').textContent = meta.role;
  const del = byId('btnDeleteNode');
  del.hidden = isMainPrism(state, node);
  del.textContent = isPrism(node) ? 'Excluir Círculo' : 'Excluir Nó';
}

// ---------- Ligações: seletores e lista de cabos ----------

function nodeLabel(node: MagicNode, idx: number): string {
  const shape = SHAPE_META[node.shape]?.short || node.shape;
  const rune = node.rune ? RUNES[node.rune]?.name : 'Vazio';
  return `${isPrism(node) ? '★ ' + getNodeShortLabel(store.state, node.id) : `Nó #${idx} (${shape})`} — [${rune}]`;
}

export function renderConnections(): void {
  const state = store.state;
  const fromSel = byId<HTMLSelectElement>('connFromSelect');
  const toSel = byId<HTMLSelectElement>('connToSelect');
  const prevFrom = fromSel.value;
  const prevTo = toSel.value;

  const opts = state.nodes.map((n, i) => `<option value="${n.id}">${escapeHtml(nodeLabel(n, i))}</option>`).join('');
  fromSel.innerHTML = opts;
  toSel.innerHTML = opts;
  if (state.nodes.some(n => n.id === prevFrom)) fromSel.value = prevFrom;
  if (state.nodes.some(n => n.id === prevTo)) toSel.value = prevTo;
  else if (state.nodes.length > 1) toSel.value = state.nodes[1].id;

  const list = byId('connectionsList');
  if (state.connections.length === 0) {
    list.innerHTML = `<div class="muted">Nenhuma conexão ativa.</div>`;
    return;
  }
  list.innerHTML = state.connections.map(c => {
    const n1 = state.nodes.find(n => n.id === c.from);
    const n2 = state.nodes.find(n => n.id === c.to);
    if (!n1 || !n2) return '';
    return `
          <div class="connection-item">
            <span>${getNodeShortLabel(state, n1.id)} ➔ ${getNodeShortLabel(state, n2.id)} <small class="muted">(${c.type === 'straight' ? 'Reta' : 'Arco'})</small></span>
            <span class="btns">
              <button class="btn" title="Inverter direção do fluxo" data-action="reverse-conn" data-arg="${c.id}">⇄</button>
              <button class="btn btn-danger" title="Remover cabo" data-action="remove-conn" data-arg="${c.id}">✕</button>
            </span>
          </div>
        `;
  }).join('');
}
