import type { Project } from '../core/types';
import { setHint } from './dom';
import { drag, render, renderPalette, store } from './store';

// Desfazer / Refazer (Ctrl+Z / Ctrl+Y).
// Depois de cada mudança, quando a tela fica parada um instante, guarda uma foto do desenho.
// Arrastar uma forma vira um passo só (a foto é tirada quando o dedo/mouse solta).

const LIMIT = 100;
const undoStack: string[] = [];
const redoStack: string[] = [];
let current = '';
let timer: number | undefined;
let restoring = false;

/** Só o desenho e a magia (o que se desfaz) */
function snapshot(): string {
  const { ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo, envelope, mage } = store.state;
  return JSON.stringify({ ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo, envelope: !!envelope, mage });
}

function commit(): void {
  timer = undefined;
  if (drag.nodeId) return; // durante o arrasto não; o soltar redesenha e agenda de novo
  const s = snapshot();
  if (s === current) return;
  if (current) {
    undoStack.push(current);
    if (undoStack.length > LIMIT) undoStack.shift();
  }
  redoStack.length = 0;
  current = s;
  updateButtons();
}

/** Chamado depois de cada redesenho */
export function scheduleHistory(): void {
  if (restoring) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(commit, 350);
}

function flush(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    commit();
  }
}

function restore(s: string): void {
  const p = JSON.parse(s) as Project & { envelope: boolean };
  const state = store.state;
  restoring = true;
  Object.assign(state, {
    ringStyle: p.ringStyle, strokeWidth: p.strokeWidth, showGrid: p.showGrid,
    nodes: p.nodes, connections: p.connections, circles: p.circles, spellInfo: p.spellInfo ?? null, envelope: p.envelope,
    ...(p.mage ? { mage: p.mage } : {}),
    connectSourceId: null
  });
  if (!state.nodes.some(n => n.id === state.selectedNodeId)) state.selectedNodeId = state.nodes[0].id;
  if (state.selectedCircleId && !state.circles.some(c => c.id === state.selectedCircleId)) state.selectedCircleId = null;
  if (state.activeLayer && !state.circles.some(c => c.id === state.activeLayer)) state.activeLayer = null;
  current = s;
  render();
  renderPalette();
  restoring = false;
  updateButtons();
}

export function undo(): void {
  flush();
  const prev = undoStack.pop();
  if (!prev) { setHint('Nada para desfazer.'); return; }
  redoStack.push(current);
  restore(prev);
  setHint('Desfeito. Ctrl+Y (ou ↷) refaz.');
}

export function redo(): void {
  flush();
  const next = redoStack.pop();
  if (!next) { setHint('Nada para refazer.'); return; }
  undoStack.push(current);
  restore(next);
  setHint('Refeito.');
}

function updateButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-action="undo"]').forEach(b => { b.disabled = !undoStack.length; });
  document.querySelectorAll<HTMLButtonElement>('[data-action="redo"]').forEach(b => { b.disabled = !redoStack.length; });
}

export function setupHistory(): void {
  window.addEventListener('keydown', e => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, [contenteditable]')) return; // não atrapalha quem está digitando
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  });
  updateButtons();
}
