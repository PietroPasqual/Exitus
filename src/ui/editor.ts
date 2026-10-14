import { MAX_INNER } from '../core/project';
import { analyzeCircles, circleHasInnerSource, contains, radiusOf, circleNumber, CIRCLE_OFFSETS, RING_R, ensureCircles, getCircle, getNodeCircles, getPrisms, isMainPrism, isPrism, JOIN_SHAPES, MAX_CIRCLES, PRISM_SHAPES, releasesEnergy, RING_LIMIT } from '../core/circles';
import type { Activation, Circle, ConnectionMode, ConnectionType, InteractionMode, MagicNode, Project, RingStyle, ShapeId } from '../core/types';
import { PRESETS } from '../data/presets';
import { byId, inputValue, setHint } from './dom';
import { emptyState, render, renderPalette, selectedNode, store } from './store';

// Ações do editor: tudo que muda o círculo passa por aqui e termina em render().

const SQUARE_HINT = 'O Quadrado □ só pega: ele recebe energia mas nunca solta. Use outra forma como origem.';
const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
const globalMode = (): ConnectionMode => inputValue('globalSpecMode') as ConnectionMode;

// ---------- Seleção e modos ----------

export function selectNode(id: string): void {
  store.state.selectedNodeId = id;
  render();
  renderPalette();
}

export const selectCentralPrism = (): void => selectNode('prism_center');

export function setInteractionMode(mode: InteractionMode): void {
  store.state.interactionMode = mode;
  store.state.connectSourceId = null;
  byId('modeMoveBtn').classList.toggle('active', mode === 'move');
  byId('modeConnectBtn').classList.toggle('active', mode === 'connect');
  byId('modeArcBtn').classList.toggle('active', mode === 'arc');
  setHint(mode === 'move'
    ? 'Toque numa forma para selecionar e arraste para mover.'
    : mode === 'connect'
      ? 'Reta: toque no nó de origem (○) e depois no destino.'
      : 'Arco: toque no nó de origem (○) e depois no destino.');
  render();
}

export function toggleFlow(): void {
  store.state.showFlow = !store.state.showFlow;
  byId('flowBtn').classList.toggle('active', store.state.showFlow);
  render();
}

// ---------- Formas ----------

/**
 * Melhor lugar livre para uma forma nova: testa vários anéis e ângulos e fica
 * com o ponto mais longe de todas as formas (contando o tamanho delas).
 */
function findFreeSpot(size: number, circle: Circle): { x: number; y: number; clearance: number } {
  let best: { x: number; y: number; clearance: number } | null = null;
  const k = radiusOf(circle) / RING_R;
  for (const base of [170, 215, 110, 240]) {
    const radius = base * k;
    if (radius + size > radiusOf(circle) - (RING_R - RING_LIMIT)) continue;
    for (let deg = -90; deg < 270; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const x = circle.x + Math.cos(a) * radius;
      const y = circle.y + Math.sin(a) * radius;
      const clearance = Math.min(...store.state.nodes.map(n => Math.hypot(n.x - x, n.y - y) - n.size - size));
      if (!best || clearance > best.clearance + 0.5) best = { x, y, clearance };
    }
  }
  return best as { x: number; y: number; clearance: number };
}

export function addNode(shape: ShapeId): void {
  const state = store.state;
  const id = newId('node');

  // A forma nova vai para o círculo do nó selecionado
  const selected = selectedNode();
  const circle = getCircle(state, selected && getNodeCircles(state, selected)[0]) || state.circles[0];
  const prism = getPrisms(state).find(n => n.circleId === circle.id) || state.nodes[0];

  // Uma Estrela vai direto para uma sobreposição que ainda não está unida
  const unjoined = JOIN_SHAPES.includes(shape) ? analyzeCircles(state).pairs.find(pr => !pr.star) : undefined;
  let size = 56;
  let spot: { x: number; y: number; clearance: number };
  if (unjoined) {
    spot = { x: (unjoined.a.x + unjoined.b.x) / 2, y: (unjoined.a.y + unjoined.b.y) / 2, clearance: 99 };
    setHint(`Estrela dupla na sobreposição (uma para cada círculo): junta os círculos ${circleNumber(state, unjoined.a.id)} e ${circleNumber(state, unjoined.b.id)}.`);
  } else {
    // Diminui a forma até caber sem encostar nas outras (até 34)
    spot = findFreeSpot(size, circle);
    while (spot.clearance < 6 && size > 34) {
      size -= 4;
      spot = findFreeSpot(size, circle);
    }
    setHint(spot.clearance < 0
      ? 'Círculo cheio: use ❂ Simetria ou diminua/remova formas.'
      : 'Forma adicionada. Arraste para posicionar.');
  }

  // Na sobreposição já entra como Estrela dupla: uma para cada círculo
  state.nodes.push({ id, shape, x: spot.x, y: spot.y, size, rot: 0, rune: null, activation: 'ativacao', charge: 1, ...(unjoined && shape === 'star' ? { double: true } : {}) });
  state.selectedNodeId = id;
  // Liga o Prisma do círculo à forma nova, por conveniência
  addConnection(prism.id, id, 'straight', globalMode());
  render();
  renderPalette();
}

export function addCircle(): void {
  const state = store.state;
  if (state.circles.length >= MAX_CIRCLES) {
    setHint(`Máximo de ${MAX_CIRCLES} círculos.`);
    return;
  }
  const base = state.circles[0];
  const free = CIRCLE_OFFSETS
    .map(([ox, oy]) => ({ x: base.x + ox, y: base.y + oy }))
    .find(pos => state.circles.every(c => Math.hypot(c.x - pos.x, c.y - pos.y) > 200));
  if (!free) return;
  const id = 'c' + Date.now().toString(36);
  state.circles.push({ id, x: free.x, y: free.y });
  const prismId = 'prism_' + id;
  state.nodes.push({ id: prismId, shape: 'prism', x: free.x, y: free.y, size: 50, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: id });
  state.selectedNodeId = prismId;
  setHint('Novo círculo! Adicione uma Estrela ☆: ela vai para a sobreposição e junta os círculos.');
  render();
  renderPalette();
}

/**
 * Novo círculo separado (sem sobrepor), ligado à magia por cabo: 3º círculo.
 * Liga o círculo em volta de tudo.
 */
export function addLinkedCircle(): void {
  const state = store.state;
  if (state.circles.length >= MAX_CIRCLES) {
    setHint(`Máximo de ${MAX_CIRCLES} círculos.`);
    return;
  }
  const base = state.circles[0];
  const gap = 2 * RING_R + 110;
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
  const free = dirs.map(([dx, dy]) => ({ x: Math.round(base.x + dx * gap), y: Math.round(base.y + dy * gap) }))
    .find(pos => state.circles.every(c => Math.hypot(c.x - pos.x, c.y - pos.y) >= 2 * RING_R + 40));
  if (!free) return;
  const id = 'c' + Date.now().toString(36);
  state.circles.push({ id, x: free.x, y: free.y });
  const prismId = 'prism_' + id;
  state.nodes.push({ id: prismId, shape: 'prism', x: free.x, y: free.y, size: 50, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: id });
  state.envelope = true;
  state.selectedNodeId = prismId;
  setHint('Círculo ligado! Ligue uma forma da magia principal a uma forma dele (Reta ou Arco). O círculo em volta de tudo foi ligado.');
  render();
  renderPalette();
}

/** Novo círculo menor dentro do círculo da forma selecionada (magia dentro da magia) */
export function addInnerCircle(): void {
  const state = store.state;
  if (state.circles.length >= MAX_CIRCLES) {
    setHint(`Máximo de ${MAX_CIRCLES} círculos.`);
    return;
  }
  const sel = selectedNode();
  const outer = getCircle(state, sel && (isPrism(sel) ? sel.circleId : getNodeCircles(state, sel)[0])) || state.circles[0];
  const R = radiusOf(outer);
  const r = Math.round(R * 0.4);
  let best: { x: number; y: number; clearance: number } | null = null;
  for (let deg = 0; deg < 360; deg += 20) {
    const a = (deg * Math.PI) / 180;
    const x = outer.x + Math.cos(a) * (R - r - 12), y = outer.y + Math.sin(a) * (R - r - 12);
    const clearance = Math.min(
      ...state.nodes.map(n => Math.hypot(n.x - x, n.y - y) - n.size - r),
      ...state.circles.filter(c => c.id !== outer.id).map(c => Math.hypot(c.x - x, c.y - y) - radiusOf(c) - r)
    );
    if (!best || clearance > best.clearance) best = { x, y, clearance };
  }
  if (!best) return;
  const id = 'c' + Date.now().toString(36);
  state.circles.push({ id, x: Math.round(best.x), y: Math.round(best.y), r });
  const prismId = 'prism_' + id;
  state.nodes.push({ id: prismId, shape: 'prism', x: Math.round(best.x), y: Math.round(best.y), size: 30, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: id });
  state.selectedNodeId = prismId;
  setHint(best.clearance < 0
    ? 'Círculo dentro criado, mas está apertado: arraste o Prisma dele ou diminua o tamanho.'
    : 'Círculo dentro criado (magia dentro da magia). Ligue o Prisma dele às formas do círculo de fora.');
  render();
  renderPalette();
}

export function toggleEnvelope(): void {
  store.state.envelope = !store.state.envelope;
  render();
}

/** Nome e moldura do círculo do centro selecionado */
export function updateSelectedCircle(field: 'name' | 'frame' | 'r', value: string): void {
  const node = selectedNode();
  if (!node || !isPrism(node)) return;
  const circle = getCircle(store.state, node.circleId);
  if (!circle) return;
  if (field === 'r') {
    const r = Math.min(600, Math.max(80, Number(value) || RING_R));
    circle.r = r;
    if (r === RING_R) delete circle.r;
  } else if (field === 'name') {
    const name = value.trim().slice(0, 80);
    if (name) circle.name = name; else delete circle.name;
  } else if (value === 'square') circle.frame = 'square';
  else delete circle.frame;
  render();
}

/** Por círculo: Prisma no centro e as formas do círculo em volta. Formas na sobreposição (como a Estrela) ficam onde estão. */
export function autoArrangeNodes(): void {
  const state = store.state;
  const owner = new Map<string, string>();
  state.nodes.filter(n => !isPrism(n)).forEach(n => {
    const cs = getNodeCircles(state, n);
    if (cs.length === 1) owner.set(n.id, cs[0]);
  });
  state.circles.forEach(circle => {
    // O Prisma volta ao centro, menos quando há círculos dentro (aí o centro é deles)
    if (!state.circles.some(o => contains(circle, o))) getPrisms(state).filter(p => p.circleId === circle.id).forEach(p => { p.x = circle.x; p.y = circle.y; });
    const outer = state.nodes.filter(n => owner.get(n.id) === circle.id);
    const count = outer.length;
    if (count === 0) return;
    // Um anel; as formas diminuem quando precisa para nunca encostarem
    const k = radiusOf(circle) / RING_R;
    const radius = (count > 6 ? 190 : 170) * k;
    const maxSize = Math.min(radiusOf(circle) - (RING_R - RING_LIMIT) - radius, (Math.PI * radius) / count - 6);
    outer.forEach((node, idx) => {
      const angle = (-Math.PI / 2) + (idx * (2 * Math.PI / count));
      node.x = circle.x + Math.cos(angle) * radius;
      node.y = circle.y + Math.sin(angle) * radius;
      node.size = Math.max(30, Math.min(node.size, Math.floor(maxSize)));
    });
  });
  render();
}

export function deleteSelectedNode(): void {
  const state = store.state;
  const selected = selectedNode();
  if (!selected) return;
  if (isMainPrism(state, selected)) {
    alert('O Prisma Central (Fonte) é essencial para o círculo mágico e não pode ser removido! Você pode limpar ou trocar a runa dele.');
    return;
  }
  let removed = [selected.id];
  if (isPrism(selected)) {
    // Excluir o Prisma de um círculo secundário exclui o círculo e as formas que só estão nele
    if (!confirm(`Excluir o Círculo ${circleNumber(state, selected.circleId)} inteiro?`)) return;
    removed = removed.concat(state.nodes.filter(n => !isPrism(n) && getNodeCircles(state, n).join() === selected.circleId).map(n => n.id));
    state.circles = state.circles.filter(c => c.id !== selected.circleId);
    removed.push('ring:' + selected.circleId);
  }
  state.nodes = state.nodes.filter(n => !removed.includes(n.id));
  state.connections = state.connections.filter(c => !removed.includes(c.from) && !removed.includes(c.to));
  state.selectedNodeId = 'prism_center';
  render();
  renderPalette();
}

/** Limpa tudo, mantendo só o Prisma central */
export function resetCircle(): void {
  const fresh = emptyState();
  Object.assign(store.state, {
    circles: fresh.circles,
    nodes: fresh.nodes,
    connections: [],
    spellInfo: null,
    selectedNodeId: 'prism_center'
  });
  store.savedCircle = null;
  render();
  renderPalette();
}

// ---------- Runa e propriedades do nó ----------

/** Selo ○ e Col □ podem guardar uma magia dentro (várias runas) */
export const canNest = (node: MagicNode): boolean => node.shape === 'circle' || node.shape === 'square';

export function assignRuneToSelected(runeId: string | null): void {
  const node = selectedNode();
  if (!node) return;
  if (runeId && store.state.innerMode && canNest(node) && node.rune && node.rune !== runeId) {
    const inner = node.inner ?? [];
    if (inner.includes(runeId)) return;
    if (inner.length >= MAX_INNER) {
      setHint(`Cabem até ${MAX_INNER + 1} runas dentro de um Selo/Col.`);
      return;
    }
    node.inner = [...inner, runeId];
  } else {
    node.rune = runeId;
    if (!runeId) delete node.inner;
  }
  render();
  renderPalette();
}

/** Estrela dupla (uma para cada círculo sobreposto) */
export function toggleDoubleStar(): void {
  const node = selectedNode();
  if (!node || !(node.shape === 'star' || node.shape === 'redor')) return;
  if (node.double) delete node.double;
  else node.double = true;
  render();
}

export function toggleInnerMode(): void {
  store.state.innerMode = !store.state.innerMode;
  renderPalette();
}

/** Tira uma runa de dentro do Selo/Col (posição na lista de dentro) */
export function removeInnerRune(index: number): void {
  const node = selectedNode();
  if (!node?.inner) return;
  node.inner = node.inner.filter((_, i) => i !== index);
  if (!node.inner.length) delete node.inner;
  render();
  renderPalette();
}

export function updateSelectedNodeShape(shape: ShapeId): void {
  const node = selectedNode();
  if (!node) return;
  if (isPrism(node) && !PRISM_SHAPES.includes(shape) && !circleHasInnerSource(store.state, node.circleId)) {
    setHint('O centro só deixa de ser Prisma se o círculo tiver uma magia dentro de um Selo (com seu pequeno Prisma) como fonte.');
    render();
    return;
  }
  if (shape === 'square' && store.state.connections.some(c => c.from === node.id)) {
    setHint('Atenção: o Quadrado □ só pega. Os cabos que saem dele ficaram inválidos (em vermelho).');
  }
  node.shape = shape;
  render();
}

export function updateSelectedNode<K extends 'activation' | 'size' | 'rot' | 'charge'>(key: K, value: MagicNode[K]): void {
  const node = selectedNode();
  if (!node) return;
  node[key] = value;
  render();
}

export const updateSelectedNodeState = (v: Activation): void => updateSelectedNode('activation', v);

export function updateCircleSettings(): void {
  const state = store.state;
  state.ringStyle = inputValue('ringStyleSelect') as RingStyle;
  state.strokeWidth = Number(inputValue('strokeWidthRange'));
  byId('lblStrokeWidth').textContent = String(state.strokeWidth);
  state.showGrid = inputValue('gridToggleSelect') === 'true';
  render();
}

// ---------- Cabos ----------

export function addConnection(fromId: string, toId: string, type: ConnectionType = 'straight', mode: ConnectionMode = 'simultaneous'): void {
  const state = store.state;
  if (fromId === toId) return;
  if (!releasesEnergy(state, fromId)) {
    setHint(SQUARE_HINT);
    return;
  }
  const exists = state.connections.find(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId));
  if (exists) {
    // Mesmo par: a ligação mais nova define o sentido
    Object.assign(exists, { from: fromId, to: toId, type, mode });
    return;
  }
  state.connections.push({ id: newId('conn'), from: fromId, to: toId, type, mode });
}

export function removeConnection(connId: string): void {
  store.state.connections = store.state.connections.filter(c => c.id !== connId);
  render();
}

/** Inverte o sentido do cabo (o ○ passa para a outra ponta) */
export function reverseConnection(connId: string): boolean {
  const conn = store.state.connections.find(c => c.id === connId);
  if (!conn) return false;
  if (!releasesEnergy(store.state, conn.to)) {
    setHint(SQUARE_HINT);
    return false;
  }
  [conn.from, conn.to] = [conn.to, conn.from];
  render();
  return true;
}

export function createConnectionFromForm(): void {
  const fromId = inputValue('connFromSelect');
  const toId = inputValue('connToSelect');
  if (!fromId || !toId || fromId === toId) {
    setHint('Escolha duas formas diferentes para ligar.');
    return;
  }
  addConnection(fromId, toId, inputValue('connTypeSelect') as ConnectionType, inputValue('connModeSelect') as ConnectionMode);
  render();
}

/** Botão ⇅ da Nova Ligação: troca origem e destino */
export function swapConnectionEnds(): void {
  const from = byId<HTMLSelectElement>('connFromSelect');
  const to = byId<HTMLSelectElement>('connToSelect');
  [from.value, to.value] = [to.value, from.value];
}

/** Clique num nó no modo Reta/Arco: primeiro a origem (○), depois o destino */
export function connectTap(nodeId: string): void {
  const state = store.state;
  if (!state.connectSourceId && !releasesEnergy(state, nodeId)) {
    setHint(SQUARE_HINT);
    return;
  }
  if (!state.connectSourceId) {
    state.connectSourceId = nodeId;
    setHint('Agora toque no nó de destino.');
  } else if (state.connectSourceId === nodeId) {
    state.connectSourceId = null;
    setHint('Ligação cancelada. Toque num nó de origem.');
  } else {
    addConnection(state.connectSourceId, nodeId, state.interactionMode === 'arc' ? 'arc-cw' : 'straight', globalMode());
    state.connectSourceId = null;
    setHint('Ligação criada! Toque em outro nó para ligar de novo.');
  }
  render();
}

// ---------- Projeto: exemplos, arquivos e círculos salvos ----------

function syncCircleControls(): void {
  const state = store.state;
  byId<HTMLSelectElement>('ringStyleSelect').value = state.ringStyle;
  byId<HTMLInputElement>('strokeWidthRange').value = String(state.strokeWidth);
  byId('lblStrokeWidth').textContent = String(state.strokeWidth);
  byId<HTMLSelectElement>('gridToggleSelect').value = String(state.showGrid);
}

/** Só o desenho e a magia (sem estado de tela como modo, seleção, filtros) */
export function getProjectData(): Project {
  const { ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo, envelope } = store.state;
  return JSON.parse(JSON.stringify({ ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo: spellInfo || null, ...(envelope ? { envelope: true } : {}) }));
}

/** Abre um projeto (arquivo JSON ou círculo salvo) */
export function applyProject(p: Project): void {
  const state = store.state;
  Object.assign(state, {
    ringStyle: p.ringStyle || 'single',
    strokeWidth: p.strokeWidth || 6,
    showGrid: !!p.showGrid,
    nodes: p.nodes,
    connections: p.connections || [],
    circles: p.circles,
    spellInfo: p.spellInfo || null,
    envelope: !!p.envelope,
    interactionMode: 'move',
    connectSourceId: null
  });
  state.circles = ensureCircles(state);
  state.selectedNodeId = state.nodes[0].id;
  byId<HTMLSelectElement>('presetSelect').value = '';
  syncCircleControls();
  setInteractionMode('move');
  renderPalette();
}

/** Carrega um exemplo do caderno, do Livro de Magias ou dos estudos */
export function loadPreset(key: string): void {
  const preset = PRESETS[key];
  if (!preset) return;
  const state = store.state;
  store.savedCircle = null;
  const p = JSON.parse(JSON.stringify(preset)) as typeof preset;
  Object.assign(state, {
    ringStyle: p.ringStyle,
    strokeWidth: p.strokeWidth,
    showGrid: p.showGrid,
    nodes: p.nodes,
    connections: p.connections,
    circles: p.circles || [{ id: 'c1', x: 0, y: 0 }],
    spellInfo: p.info || null,
    envelope: !!p.envelope,
    selectedNodeId: 'prism_center'
  });
  state.circles = ensureCircles(state);
  byId('flowBtn').classList.toggle('active', state.showFlow);
  byId<HTMLSelectElement>('presetSelect').value = key;
  syncCircleControls();
  render();
  renderPalette();
}

