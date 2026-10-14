import { clampInsideRings, getCircle, getNodeCircles, isMainPrism, isPrism } from '../core/circles';
import { byId, setHint } from './dom';
import { connectTap, removeConnection, reverseConnection, selectNode } from './editor';
import { drag, findNode, render, renderPalette, store } from './store';

// Arrastar formas com mouse ou dedo, tocar em nós e em cabos.
// O SVG é redesenhado a cada mudança, então os eventos são tratados no próprio <svg>.

function svgPoint(evt: PointerEvent): { x: number; y: number } {
  const svg = byId('magicCircleSvg') as unknown as SVGSVGElement;
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  const t = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  return { x: t.x, y: t.y };
}

function onNodePointerDown(evt: PointerEvent, nodeId: string): void {
  const state = store.state;
  if (state.interactionMode !== 'move') return;
  const node = findNode(nodeId);
  if (!node) return;

  const changed = state.selectedNodeId !== nodeId;
  state.selectedNodeId = nodeId;
  drag.nodeId = nodeId;
  // Arrastar o Prisma de um círculo secundário leva o círculo inteiro junto
  drag.group = (isPrism(node) && !isMainPrism(state, node))
    ? state.nodes.filter(n => !isPrism(n) && getNodeCircles(state, n).join() === node.circleId).map(n => n.id)
    : [];
  const p = svgPoint(evt);
  drag.offset = { x: p.x - node.x, y: p.y - node.y };
  render();
  if (changed) renderPalette();
}

function onPointerMove(evt: PointerEvent): void {
  if (!drag.nodeId) return;
  const state = store.state;
  const node = findNode(drag.nodeId);
  if (!node) return;

  const p = svgPoint(evt);
  let nx = p.x - drag.offset.x;
  let ny = p.y - drag.offset.y;

  if (isMainPrism(state, node)) {
    // O Prisma principal fica perto do centro (pode sair um pouco e volta ao centro)
    const c = getCircle(state, node.circleId);
    if (!c) return;
    let ox = nx - c.x, oy = ny - c.y;
    if (Math.hypot(ox, oy) < 18) { ox = 0; oy = 0; }
    nx = c.x + Math.max(-35, Math.min(35, ox));
    ny = c.y + Math.max(-35, Math.min(35, oy));
  } else if (isPrism(node)) {
    // Círculo secundário: move o anel, o Prisma e as formas que só estão nele
    const c = getCircle(state, node.circleId);
    if (!c) return;
    const dx = nx - c.x, dy = ny - c.y;
    c.x = nx;
    c.y = ny;
    drag.group.forEach(id => {
      const m = findNode(id);
      if (m) { m.x += dx; m.y += dy; }
    });
  } else {
    ({ x: nx, y: ny } = clampInsideRings(state, node, nx, ny));
  }

  node.x = nx;
  node.y = ny;
  render();
}

function stopDragging(): void {
  if (!drag.nodeId) return;
  drag.nodeId = null;
  render(); // reenquadra os círculos
}

/** Clique num cabo: inverte o sentido. Shift+clique: remove. */
function onConnectionClick(evt: MouseEvent, connId: string): void {
  if (evt.shiftKey) {
    removeConnection(connId);
    setHint('Cabo removido.');
    return;
  }
  if (reverseConnection(connId)) {
    setHint('Cabo invertido. Shift+clique (ou ✕ na aba Ligações) remove.');
  }
}

export function setupCanvasInteraction(): void {
  const svg = byId('magicCircleSvg');

  svg.addEventListener('pointerdown', evt => {
    const nodeEl = (evt.target as Element).closest<SVGGElement>('[data-node-id]');
    if (nodeEl) onNodePointerDown(evt, nodeEl.dataset.nodeId as string);
  });

  svg.addEventListener('click', evt => {
    const target = evt.target as Element;
    const nodeEl = target.closest<SVGGElement>('[data-node-id]');
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId as string;
      if (store.state.interactionMode === 'move') {
        if (store.state.selectedNodeId !== id) selectNode(id);
      } else {
        connectTap(id);
      }
      return;
    }
    const connEl = target.closest<SVGGElement>('[data-conn-id]');
    if (connEl) onConnectionClick(evt, connEl.dataset.connId as string);
  });

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);
}
