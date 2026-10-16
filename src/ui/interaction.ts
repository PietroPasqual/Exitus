import { focusNodePanel } from './layout';
import { snapPolar } from '../core/geometry';
import { clampInsideRings, endpointNode, releasesEnergy, getCircle, getNodeCircles, isMainPrism, isPrism, radiusOf, RING_LIMIT, RING_R, JOIN_SHAPES } from '../core/circles';
import { byId, setHint } from './dom';
import { addConnection, connectTap, globalMode, removeConnection, reverseConnection, selectCircle, selectNode } from './editor';
import { applyView, arcOutward, setZoom, view } from './canvas';
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

  const changed = state.selectedNodeId !== nodeId || !!state.selectedCircleId;
  state.selectedNodeId = nodeId;
  state.selectedCircleId = null;
  if (changed) focusNodePanel();
  drag.nodeId = nodeId;
  // Arrastar a Matriz de um círculo secundário leva o círculo inteiro junto
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
    // A Matriz principal anda dentro do seu anel (perto do centro, encaixa no centro)
    const c = getCircle(state, node.circleId);
    if (!c) return;
    let ox = nx - c.x, oy = ny - c.y;
    if (Math.hypot(ox, oy) < 18) { ox = 0; oy = 0; }
    const max = radiusOf(c) - (RING_R - RING_LIMIT) - node.size;
    const d = Math.hypot(ox, oy);
    if (d > max) { ox *= max / d; oy *= max / d; }
    nx = c.x + ox;
    ny = c.y + oy;
  } else if (isPrism(node)) {
    // Círculo secundário: move o anel, a Matriz e as formas que só estão nele
    const c = getCircle(state, node.circleId);
    if (!c) return;
    // Move junto o anel (a Matriz pode estar fora do centro do anel)
    const dx = nx - node.x, dy = ny - node.y;
    c.x += dx;
    c.y += dy;
    drag.group.forEach(id => {
      const m = findNode(id);
      if (m) { m.x += dx; m.y += dy; }
    });
  } else {
    // Ímã polar: gruda em ângulos de 15° e na mesma distância de outras formas do círculo
    if (state.snap) {
      const cid = getNodeCircles(state, node)[0];
      const c = getCircle(state, cid) ?? state.circles[0];
      const radii = state.nodes.filter(o => o.id !== node.id && !isPrism(o) && getNodeCircles(state, o)[0] === c.id)
        .map(o => Math.hypot(o.x - c.x, o.y - c.y));
      ({ x: nx, y: ny } = snapPolar({ x: nx, y: ny }, c, radii));
    }
    ({ x: nx, y: ny } = clampInsideRings(state, node, nx, ny));
    // Estrela de uma camada: gruda na Estrela da outra camada quando chega perto (ficam alinhadas)
    if (node.layer && JOIN_SHAPES.includes(node.shape)) {
      const twin = state.nodes.find(o => o.id !== node.id && o.layer && o.layer !== node.layer && JOIN_SHAPES.includes(o.shape) && Math.hypot(o.x - nx, o.y - ny) < Math.max(18, o.size * 0.7));
      if (twin) { nx = twin.x; ny = twin.y; }
    }
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

// ---------- Puxar cabo, curvar pela seta, zoom e deslocamento ----------

/** Cabo sendo puxado de uma forma (modo Reta/Arco, ou Alt + arrastar) */
let cableDrag: { from: string; line: SVGLineElement; moved: boolean } | null = null;
/** Seta do meio sendo arrastada para curvar o cabo */
let curveDrag: { id: string; x: number; y: number; moved: boolean } | null = null;
/** Anel sendo arrastado: move o círculo com tudo o que está dentro */
let ringDrag: { circles: string[]; nodes: string[]; last: { x: number; y: number }; moved: boolean } | null = null;

function startRingDrag(evt: PointerEvent, circleId: string): void {
  const state = store.state;
  const c = getCircle(state, circleId);
  if (!c) return;
  const r = radiusOf(c);
  const inside = (x: number, y: number): boolean => Math.hypot(x - c.x, y - c.y) <= r + 1;
  const circles = state.circles.filter(o => o.id === c.id || (radiusOf(o) < r && inside(o.x, o.y))).map(o => o.id);
  const nodes = state.nodes.filter(n => (n.circleId && circles.includes(n.circleId)) || (!isPrism(n) && inside(n.x, n.y))).map(n => n.id);
  ringDrag = { circles, nodes, last: svgPoint(evt), moved: false };
}

function moveRing(evt: PointerEvent): void {
  if (!ringDrag) return;
  const state = store.state;
  const p = svgPoint(evt);
  const dx = p.x - ringDrag.last.x, dy = p.y - ringDrag.last.y;
  if (!ringDrag.moved && Math.hypot(dx, dy) < 3) return;
  ringDrag.moved = true;
  ringDrag.last = p;
  state.circles.forEach(c => { if (ringDrag?.circles.includes(c.id)) { c.x += dx; c.y += dy; } });
  state.nodes.forEach(n => { if (ringDrag?.nodes.includes(n.id)) { n.x += dx; n.y += dy; } });
  render();
}

/** Arrastar o fundo com zoom: desloca o desenho */
let pan: { x: number; y: number; cx: number; cy: number; scale: number } | null = null;
/** Dedos na tela (para a pinça) */
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { d: number; zoom: number } | null = null;
/** Depois de um gesto, o "click" que o navegador manda não deve inverter cabo nem selecionar */
let suppressClick = false;

const svgEl = (): SVGSVGElement => byId('magicCircleSvg') as unknown as SVGSVGElement;

function clientToSvg(x: number, y: number): { x: number; y: number } {
  const svg = svgEl();
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const ctm = svg.getScreenCTM();
  const t = ctm ? pt.matrixTransform(ctm.inverse()) : pt;
  return { x: t.x, y: t.y };
}

function startCableDrag(evt: PointerEvent, from: string): void {
  if (!releasesEnergy(store.state, from)) return; // o click avisa que o □ só pega
  const p = svgPoint(evt);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'temp-cable');
  line.setAttribute('x1', String(p.x));
  line.setAttribute('y1', String(p.y));
  line.setAttribute('x2', String(p.x));
  line.setAttribute('y2', String(p.y));
  svgEl().appendChild(line);
  cableDrag = { from, line, moved: false };
}

function endCableDrag(evt: PointerEvent): void {
  if (!cableDrag) return;
  const { from, line, moved } = cableDrag;
  cableDrag = null;
  line.remove();
  if (!moved) return; // foi só um toque: o click cuida (escolher origem/destino)
  suppressClick = true;
  const hit = document.elementFromPoint(evt.clientX, evt.clientY)?.closest<SVGElement>('[data-node-id], [data-ring-id]');
  const to = hit?.dataset.nodeId ?? hit?.dataset.ringId;
  if (!to || to === from) {
    setHint('Solte o cabo em cima de outra forma para ligar.');
    return;
  }
  const state = store.state;
  addConnection(from, to, state.interactionMode === 'arc' ? 'arc-cw' : 'straight', globalMode());
  state.connectSourceId = null;
  setHint('Ligação criada! Arraste de uma forma para outra para ligar de novo.');
  render();
}

function moveCurve(evt: PointerEvent): void {
  if (!curveDrag) return;
  if (Math.hypot(evt.clientX - curveDrag.x, evt.clientY - curveDrag.y) > 5) curveDrag.moved = true;
  if (!curveDrag.moved) return;
  const state = store.state;
  const conn = state.connections.find(c => c.id === curveDrag?.id);
  if (!conn) return;
  const a = endpointNode(state, conn.from), b = endpointNode(state, conn.to);
  if (!a || !b) return;
  const p = svgPoint(evt);
  const { nx, ny } = arcOutward(a, b);
  const off = (p.x - (a.x + b.x) / 2) * nx + (p.y - (a.y + b.y) / 2) * ny;
  const type = Math.abs(off) < 16 ? 'straight' : off > 0 ? 'arc-cw' : 'arc-ccw';
  if (conn.type !== type) {
    conn.type = type;
    setHint(type === 'straight' ? 'Cabo reto.' : type === 'arc-cw' ? 'Arco por fora.' : 'Arco por dentro.');
    render();
  }
}

function pinchDistance(): number {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pinchMid(): { x: number; y: number } {
  const [a, b] = [...pointers.values()];
  return clientToSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
}

export function setupCanvasInteraction(): void {
  const svg = byId('magicCircleSvg');

  svg.addEventListener('pointerdown', evt => {
    // Gesto novo: um gesto anterior que terminou fora do desenho não "come" este clique
    if (pointers.size === 0) suppressClick = false;
    pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (pointers.size === 2) {
      // Dois dedos: pinça para aproximar (cancela o que estava sendo arrastado)
      drag.nodeId = null;
      ringDrag = null;
      cableDrag?.line.remove();
      cableDrag = null;
      curveDrag = null;
      pan = null;
      pinch = { d: pinchDistance(), zoom: view.zoom };
      return;
    }
    const target = evt.target as Element;
    const curveEl = target.closest<SVGElement>('[data-curve-id]');
    if (curveEl) {
      curveDrag = { id: curveEl.dataset.curveId as string, x: evt.clientX, y: evt.clientY, moved: false };
      return;
    }
    const nodeEl = target.closest<SVGGElement>('[data-node-id]');
    if (nodeEl) {
      const id = nodeEl.dataset.nodeId as string;
      if (store.state.interactionMode !== 'move' || evt.altKey) startCableDrag(evt, id);
      else onNodePointerDown(evt, id);
      return;
    }
    const ringEl = target.closest<SVGElement>('[data-ring-id]');
    if (ringEl) {
      const id = ringEl.dataset.ringId as string;
      if (store.state.interactionMode !== 'move' || evt.altKey) startCableDrag(evt, id);
      else startRingDrag(evt, id.slice('ring:'.length));
      return;
    }
    if (!target.closest('[data-conn-id]') && view.zoom > 1) {
      const ctm = svgEl().getScreenCTM();
      pan = { x: evt.clientX, y: evt.clientY, cx: view.cx, cy: view.cy, scale: ctm ? 1 / ctm.a : 1 };
    }
  });

  svg.addEventListener('click', evt => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
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
    const ringEl = target.closest<SVGElement>('[data-ring-id]');
    if (ringEl) {
      if (store.state.interactionMode !== 'move') connectTap(ringEl.dataset.ringId as string);
      else {
        selectCircle((ringEl.dataset.ringId as string).slice('ring:'.length));
        setHint('Círculo selecionado: nome, tamanho, formato do anel e moldura no painel. Arraste o anel para mover o círculo inteiro.');
      }
      return;
    }
    const connEl = target.closest<SVGGElement>('[data-conn-id]');
    if (connEl) onConnectionClick(evt, connEl.dataset.connId as string);
  });

  // Roda do mouse: aproxima ou afasta no ponto do cursor
  svg.addEventListener('wheel', evt => {
    evt.preventDefault();
    setZoom(view.zoom * (evt.deltaY < 0 ? 1.15 : 1 / 1.15), clientToSvg(evt.clientX, evt.clientY));
  }, { passive: false });

  window.addEventListener('pointermove', evt => {
    if (pointers.has(evt.pointerId)) pointers.set(evt.pointerId, { x: evt.clientX, y: evt.clientY });
    if (pinch && pointers.size >= 2) {
      setZoom(pinch.zoom * (pinchDistance() / (pinch.d || 1)), pinchMid());
      return;
    }
    if (cableDrag) {
      const p = svgPoint(evt);
      cableDrag.line.setAttribute('x2', String(p.x));
      cableDrag.line.setAttribute('y2', String(p.y));
      if (!cableDrag.moved && Math.hypot(Number(cableDrag.line.getAttribute('x1')) - p.x, Number(cableDrag.line.getAttribute('y1')) - p.y) > 12) cableDrag.moved = true;
      return;
    }
    if (curveDrag) { moveCurve(evt); return; }
    if (ringDrag) { moveRing(evt); return; }
    if (pan) {
      view.cx = pan.cx - (evt.clientX - pan.x) * pan.scale;
      view.cy = pan.cy - (evt.clientY - pan.y) * pan.scale;
      applyView();
      return;
    }
    onPointerMove(evt);
  });
  const end = (evt: PointerEvent): void => {
    pointers.delete(evt.pointerId);
    if (pinch) {
      if (pointers.size < 2) { pinch = null; suppressClick = true; }
      return;
    }
    if (cableDrag) endCableDrag(evt);
    if (ringDrag) {
      if (ringDrag.moved) { suppressClick = true; setHint('Círculo movido com tudo o que está dentro dele.'); }
      ringDrag = null;
      render();
    }
    if (curveDrag) {
      if (curveDrag.moved) suppressClick = true;
      curveDrag = null;
    }
    if (pan) {
      if (Math.hypot(evt.clientX - pan.x, evt.clientY - pan.y) > 5) suppressClick = true;
      pan = null;
    }
    stopDragging();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
