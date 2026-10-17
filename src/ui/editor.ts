import { baseUp } from '../data/shapes';
import { view } from './canvas';
import { MAX_INNER } from '../core/project';
import { changeCircleContext } from '../core/editor-context';
import { validateIntentionWord } from '../core/intention';
import { analyzeCircles, evolveTarget, circleHasInnerSource, contains, radiusOf, circleNumber, CIRCLE_OFFSETS, RING_R, ensureCircles, getCircle, getNodeCircles, getPrisms, isMainPrism, isPrism, JOIN_SHAPES, lensPoint, MAX_CIRCLES, ringInset as ringInsetOf, RING_SHAPES, PRISM_SHAPES, releasesEnergy, RING_LIMIT } from '../core/circles';
import type { Circle, RingShape, ConnectionMode, ConnectionType, InteractionMode, MagicNode, Project, RingStyle, ShapeId } from '../core/types';
import { PRESETS } from '../data/presets';
import { byId, inputValue, setHint } from './dom';
import { focusNodePanel } from './layout';
import { emptyState, render, renderPalette, selectedNode, store } from './store';

// Ações do editor: tudo que muda o círculo passa por aqui e termina em render().

const SQUARE_HINT = 'O Quadrado □ só pega: ele recebe energia mas nunca solta. Use outra forma como origem.';
const newId = (prefix: string): string => `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
export const globalMode = (): ConnectionMode => inputValue('globalSpecMode') as ConnectionMode;

// ---------- Seleção e modos ----------

export function selectNode(id: string): void {
  store.state.selectedNodeId = id;
  store.state.selectedCircleId = null;
  render();
  renderPalette();
}

/** Toque no anel: seleciona o círculo (nome, tamanho, moldura, formato do anel, excluir) */
export function selectCircle(id: string): void {
  store.state.selectedCircleId = id;
  focusNodePanel();
  render();
  renderPalette();
}

/** Depois de mudar o formato ou o tamanho do anel: as Estrelas que saíram da sobreposição voltam para dentro dela */
function refitStars(circle: Circle): void {
  const state = store.state;
  state.circles.filter(o => o.id !== circle.id).forEach(o => {
    const lens = lensPoint(circle, o);
    if (lens.room < 0) return;
    // As Estrelas da sobreposição destes dois círculos (uma em cada camada, ou a dupla antiga)
    const pairStars = state.nodes.filter(n => JOIN_SHAPES.includes(n.shape) && ((n.layer === circle.id || n.layer === o.id) || (n.double && !n.layer))
      && Math.hypot(n.x - lens.x, n.y - lens.y) < Math.min(radiusOf(circle), radiusOf(o)));
    const fits = (n: MagicNode): boolean => [circle, o].every(c => ringInsetOf(c, n.x, n.y) >= n.size * 0.5);
    // Se alguma saiu da área de sobreposição, as duas voltam juntas (alinhadas) para o meio dela
    if (pairStars.length && !pairStars.every(fits)) pairStars.forEach(n => { n.x = lens.x; n.y = lens.y; n.size = Math.min(n.size, Math.max(18, Math.floor(lens.room * 1.6))); });
  });
}

/** Camada ativa: mexe só nos selos desse círculo ('all' = todas) */
export function setActiveLayer(id: string): void {
  const state = store.state;
  state.activeLayer = id === 'all' || !getCircle(state, id) ? null : id;
  // A seleção fica na camada escolhida
  const sel = selectedNode();
  if (state.activeLayer && sel && !(isPrism(sel) ? sel.circleId === state.activeLayer : getNodeCircles(state, sel).includes(state.activeLayer))) {
    state.selectedCircleId = state.activeLayer;
  }
  setHint(state.activeLayer
    ? `Camada ${circleNumber(state, state.activeLayer)}: só os selos dela respondem ao toque; os outros ficam apagados.`
    : 'Todas as camadas: todos os selos respondem ao toque.');
  render();
  renderPalette();
}

/** Círculo que o painel está editando: o do anel tocado ou o da Matriz selecionada */
export function editedCircle(): Circle | undefined {
  const state = store.state;
  if (state.selectedCircleId) return getCircle(state, state.selectedCircleId);
  const node = selectedNode();
  return node && isPrism(node) ? getCircle(state, node.circleId) : undefined;
}

/** Duas Estrelas alinhadas na sobreposição, uma em cada camada (círculo) */
function pushStarPair(a: Circle, b: Circle, at: { x: number; y: number }, size = 46, shape: ShapeId = 'star'): [MagicNode, MagicNode] {
  const mk = (layer: string): MagicNode => ({ id: newId('star'), shape, x: at.x, y: at.y, size, rot: 0, rune: null, activation: 'ativacao', charge: 1, layer });
  const pair: [MagicNode, MagicNode] = [mk(a.id), mk(b.id)];
  store.state.nodes.push(...pair);
  return pair;
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

  // A forma nova vai para a camada ativa, ou para o círculo do anel/nó selecionado
  const selected = selectedNode();
  const circle = getCircle(state, state.activeLayer ?? undefined) || getCircle(state, state.selectedCircleId ?? undefined)
    || getCircle(state, selected && getNodeCircles(state, selected)[0]) || state.circles[0];
  // A ligação de conveniência sai da Matriz do círculo; num círculo sem Matriz, da Estrela da camada dele
  const prism = getPrisms(state).find(n => n.circleId === circle.id)
    || state.nodes.find(n => n.layer === circle.id && JOIN_SHAPES.includes(n.shape))
    || state.nodes[0];

  // Uma Estrela vai direto para uma sobreposição que ainda não está unida
  const unjoined = JOIN_SHAPES.includes(shape) ? analyzeCircles(state).pairs.find(pr => !pr.star) : undefined;
  let size = 56;
  let spot: { x: number; y: number; clearance: number };
  if (unjoined) {
    // No meio da área onde os dois anéis se cruzam (certo também para tamanhos e formatos diferentes)
    spot = { ...lensPoint(unjoined.a, unjoined.b), clearance: 99 };
    setHint(`Duas Estrelas alinhadas na sobreposição, uma em cada camada: juntam os círculos ${circleNumber(state, unjoined.a.id)} e ${circleNumber(state, unjoined.b.id)}.`);
  } else {
    // Diminui a forma até caber sem encostar nas outras (até 18)
    spot = findFreeSpot(size, circle);
    while (spot.clearance < 6 && size > 18) {
      size -= 4;
      spot = findFreeSpot(size, circle);
    }
    setHint(spot.clearance < 0
      ? 'Círculo cheio: use ❂ Simetria ou diminua/remova formas.'
      : 'Forma adicionada. Arraste para posicionar.');
  }

  if (unjoined) {
    // Na sobreposição entram duas Estrelas alinhadas, uma em cada camada
    const pair = pushStarPair(unjoined.a, unjoined.b, spot, 46, shape);
    const own = pair.find(st => st.layer === prism.circleId) ?? pair[0];
    state.selectedNodeId = own.id;
    state.selectedCircleId = null;
    focusNodePanel();
    if (isPrism(prism) && prism.circleId === own.layer) addConnection(prism.id, own.id, 'straight', globalMode());
    render();
    renderPalette();
    return;
  }
  state.nodes.push({ id, shape, x: spot.x, y: spot.y, size, rot: 0, rune: null, activation: 'ativacao', charge: 1 });
  state.selectedNodeId = id;
  state.selectedCircleId = null;
  focusNodePanel();
  // Liga a Matriz do círculo à forma nova, por conveniência
  if (prism.circleId === circle.id || prism.layer === circle.id) addConnection(prism.id, id, 'straight', globalMode());
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
  const circle: Circle = { id, x: free.x, y: free.y };
  state.circles.push(circle);
  // Sem Matriz: a energia chega pelas duas Estrelas da sobreposição (uma em cada camada)
  const partner = state.circles.find(c => c.id !== id && Math.hypot(c.x - circle.x, c.y - circle.y) < radiusOf(c) + radiusOf(circle));
  if (partner) pushStarPair(partner, circle, lensPoint(partner, circle));
  state.selectedCircleId = id;
  focusNodePanel();
  setHint('Novo círculo sobreposto, sem Matriz: as duas Estrelas da sobreposição (uma em cada camada) passam a energia para ele. Ligue os selos dele à Estrela da camada dele.');
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
  state.selectedCircleId = null;
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
  state.selectedCircleId = null;
  setHint(best.clearance < 0
    ? 'Círculo dentro criado, mas está apertado: arraste a Matriz dele ou diminua o tamanho.'
    : 'Círculo dentro criado (magia dentro da magia). Ligue a Matriz dele às formas do círculo de fora.');
  render();
  renderPalette();
}

export function toggleEnvelope(): void {
  store.state.envelope = !store.state.envelope;
  render();
}

/** Nome, tamanho, moldura e formato do anel do círculo selecionado (pelo anel ou pela Matriz) */
export function updateSelectedCircle(field: 'name' | 'frame' | 'r' | 'shape', value: string): void {
  const circle = editedCircle();
  if (!circle) return;
  if (field === 'shape') {
    if (RING_SHAPES.includes(value as RingShape)) circle.shape = value as RingShape;
    else delete circle.shape;
    refitStars(circle);
    render();
    return;
  }
  if (field === 'r') {
    const r = Math.min(900, Math.max(40, Number(value) || RING_R));
    circle.r = r;
    if (r === RING_R) delete circle.r;
    refitStars(circle);
  } else if (field === 'name') {
    const name = value.trim().slice(0, 80);
    if (name) circle.name = name; else delete circle.name;
  } else if (value === 'square') circle.frame = 'square';
  else delete circle.frame;
  render();
}

/** Por círculo: Matriz no centro e as formas do círculo em volta. Formas na sobreposição (como a Estrela) ficam onde estão. */
export function autoArrangeNodes(): void {
  const state = store.state;
  const owner = new Map<string, string>();
  state.nodes.filter(n => !isPrism(n)).forEach(n => {
    const cs = getNodeCircles(state, n);
    if (cs.length === 1) owner.set(n.id, cs[0]);
  });
  state.circles.forEach(circle => {
    // A Matriz volta ao centro, menos quando há círculos dentro (aí o centro é deles)
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
      node.size = Math.max(16, Math.min(node.size, Math.floor(maxSize)));
    });
  });
  render();
}

/** Exclui um círculo inteiro (menos o principal) e os selos que só estão nele */
function deleteCircle(circleId: string): void {
  const state = store.state;
  if (circleId === state.circles[0].id) {
    alert('O círculo principal não pode ser excluído. Você pode limpar o desenho no botão Limpar.');
    return;
  }
  if (!confirm(`Excluir o Círculo ${circleNumber(state, circleId)} inteiro?`)) return;
  const removed = state.nodes.filter(n => (isPrism(n) && n.circleId === circleId) || (!isPrism(n) && getNodeCircles(state, n).join() === circleId)).map(n => n.id);
  removed.push('ring:' + circleId);
  state.circles = state.circles.filter(c => c.id !== circleId);
  state.nodes = state.nodes.filter(n => !removed.includes(n.id));
  state.connections = state.connections.filter(c => !removed.includes(c.from) && !removed.includes(c.to));
  if (state.activeLayer === circleId) state.activeLayer = null;
  state.selectedCircleId = null;
  state.selectedNodeId = 'prism_center';
  render();
  renderPalette();
}

export function deleteSelectedNode(): void {
  const state = store.state;
  if (state.selectedCircleId) { deleteCircle(state.selectedCircleId); return; }
  const selected = selectedNode();
  if (!selected) return;
  if (isMainPrism(state, selected)) {
    alert('A Matriz Central (Fonte) é essencial para o círculo mágico e não pode ser removido! Você pode limpar ou trocar a runa dele.');
    return;
  }
  const removed = [selected.id];
  // Excluir a Matriz de um círculo secundário exclui o círculo e as formas que só estão nele
  if (isPrism(selected)) { deleteCircle(selected.circleId as string); return; }
  state.nodes = state.nodes.filter(n => !removed.includes(n.id));
  state.connections = state.connections.filter(c => !removed.includes(c.from) && !removed.includes(c.to));
  state.selectedNodeId = 'prism_center';
  render();
  renderPalette();
}

/** Limpa tudo, mantendo só a Matriz central */
export function resetCircle(resetSession = false): void {
  changeCircleContext();
  const fresh = emptyState();
  Object.assign(store.state, {
    ...(resetSession ? { mage: { ...fresh.mage }, envelope: false, connectSourceId: null, interactionMode: 'move', innerMode: false } : {}),
    circles: fresh.circles,
    nodes: fresh.nodes,
    connections: [],
    spellInfo: null,
    selectedNodeId: 'prism_center',
    selectedCircleId: null,
    activeLayer: null
  });
  store.savedCircle = null;
  render();
  renderPalette();
}

// ---------- Runa e propriedades do nó ----------

/** Círculo ○ e Quadrado □ podem guardar uma magia dentro (várias runas) */
export const canNest = (node: MagicNode): boolean => node.shape === 'circle' || node.shape === 'square';

export function assignRuneToSelected(runeId: string | null): void {
  const node = selectedNode();
  if (!node) return;
  if (runeId && store.state.innerMode && canNest(node) && node.rune && node.rune !== runeId) {
    const inner = node.inner ?? [];
    if (inner.includes(runeId)) return;
    if (inner.length >= MAX_INNER) {
      setHint(`Cabem até ${MAX_INNER + 1} runas dentro de um Círculo/Quadrado.`);
      return;
    }
    node.inner = [...inner, runeId];
  } else {
    node.rune = runeId;
    if (!runeId) delete node.inner;
  }
  // A palavra de vínculo pertence à runa de Intenção: trocando a runa, ela vai embora
  if (node.bond && !hasIntent(node)) delete node.bond;
  render();
  renderPalette();
}

export const hasIntent = (node: MagicNode): boolean => node.rune === 'mod_intencao' || !!node.inner?.includes('mod_intencao');

/** Intenção: vincula a palavra (ou números). Uma vez vinculada, não se desvincula. */
export function bindWord(): void {
  const node = selectedNode();
  if (!node || !hasIntent(node) || node.bond) return;
  const input = byId<HTMLInputElement>('bondInput');
  const { value: word, error } = validateIntentionWord(input.value);
  if (error) {
    input.setCustomValidity(error);
    input.setAttribute('aria-invalid', 'true');
    setHint(error);
    input.focus();
    return;
  }
  input.setCustomValidity('');
  input.removeAttribute('aria-invalid');
  if (!confirm(`Vincular «${word}» a esta Intenção?\n\nDepois de vinculada, a palavra não pode ser desvinculada (só trocando a runa).`)) return;
  node.bond = word;
  input.value = '';
  setHint(`Vínculo feito: «${word}».`);
  render();
}

/** Estrela dupla (uma para cada círculo sobreposto) */
/**
 * Estrela da sobreposição em camadas: a Estrela dupla antiga vira duas Estrelas (uma em cada camada),
 * e uma Estrela sozinha na sobreposição ganha a parceira da outra camada, alinhada em cima dela.
 */
export function layerStar(): void {
  const state = store.state;
  const node = selectedNode();
  if (!node || !JOIN_SHAPES.includes(node.shape)) return;
  const pair = analyzeCircles(state).pairs.find(p => p.stars.some(st => st.id === node.id));
  if (!pair) { setHint('Leve a Estrela para a área onde dois círculos se sobrepõem.'); return; }
  const { a, b } = pair;
  if (!node.layer) {
    // Fica na camada do círculo de onde vem a energia (o que tem cabo para ela), e a outra recebe a parceira
    const fromA = state.connections.some(c => c.to === node.id && getNodeCircles(state, state.nodes.find(n => n.id === c.from) ?? node).includes(a.id));
    node.layer = fromA || !getPrisms(state).some(p => p.circleId === b.id) ? a.id : b.id;
    delete node.double;
  }
  const other = node.layer === a.id ? b : a;
  if (state.nodes.some(n => n.layer === other.id && JOIN_SHAPES.includes(n.shape) && Math.hypot(n.x - node.x, n.y - node.y) < node.size * 2)) {
    setHint('Esta sobreposição já tem a Estrela da outra camada.');
    render();
    return;
  }
  const twin: MagicNode = { id: newId('star'), shape: node.shape, x: node.x, y: node.y, size: node.size, rot: node.rot, rune: null, activation: 'ativacao', charge: 1, layer: other.id };
  state.nodes.push(twin);
  // Os cabos que vêm do outro círculo passam a ir para a Estrela da camada dele
  state.connections.forEach(c => {
    const end = c.from === node.id ? c.to : c.to === node.id ? c.from : null;
    const n = end ? state.nodes.find(x => x.id === end) : undefined;
    if (!n || getNodeCircles(state, n).includes(node.layer as string)) return;
    if (c.from === node.id) c.from = twin.id; else c.to = twin.id;
  });
  setHint(`Estrelas em camadas: ${circleNumber(state, node.layer)} e ${circleNumber(state, other.id)}. Escolha a camada no desenho para ajustar cada uma.`);
  render();
}

export function evolveSelectedShape(): void {
  const node = selectedNode();
  if (!node) return;
  const target = evolveTarget(node);
  if (target) updateSelectedNodeShape(target);
}

export function toggleInnerMode(): void {
  store.state.innerMode = !store.state.innerMode;
  renderPalette();
}

/** Tira uma runa de dentro do Círculo/Quadrado (posição na lista de dentro) */
export function removeInnerRune(index: number): void {
  const node = selectedNode();
  if (!node?.inner) return;
  node.inner = node.inner.filter((_, i) => i !== index);
  if (!node.inner.length) delete node.inner;
  if (node.bond && !hasIntent(node)) delete node.bond;
  render();
  renderPalette();
}

export function updateSelectedNodeShape(shape: ShapeId): void {
  const node = selectedNode();
  if (!node) return;
  if (isPrism(node) && !PRISM_SHAPES.includes(shape) && !circleHasInnerSource(store.state, node.circleId)) {
    setHint('O centro só deixa de ser Matriz se o círculo tiver uma magia dentro de um Selo (com seu pequena Matriz) como fonte.');
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


/** Triângulo: vira a base para cima (EfeitoX) ou para baixo (PoderX) */
export function flipTriangle(): void {
  const node = selectedNode();
  if (!node) return;
  updateSelectedNode('rot', baseUp(node.rot) ? 0 : 180);
}

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
  const { ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo, envelope, mage } = store.state;
  return JSON.parse(JSON.stringify({ ringStyle, strokeWidth, showGrid, nodes, connections, circles, spellInfo: spellInfo || null, ...(envelope ? { envelope: true } : {}), ...(mage ? { mage } : {}) }));
}

/** Abre um projeto (arquivo JSON ou círculo salvo) */
export function applyProject(p: Project): void {
  changeCircleContext();
  const state = store.state;
  view.zoom = 1;
  Object.assign(state, {
    ringStyle: p.ringStyle || 'single',
    strokeWidth: p.strokeWidth || 6,
    showGrid: !!p.showGrid,
    nodes: p.nodes,
    connections: p.connections || [],
    circles: p.circles,
    spellInfo: p.spellInfo || null,
    envelope: !!p.envelope,
    // O mago é quem lança: o arquivo traz a energia; sem ela, fica a do mago atual com energia automática
    mage: p.mage ? { ...p.mage } : { ...state.mage, energia: null },
    interactionMode: 'move',
    connectSourceId: null
  });
  state.circles = ensureCircles(state);
  state.selectedNodeId = state.nodes[0].id;
  state.selectedCircleId = null;
  state.activeLayer = null;
  byId<HTMLSelectElement>('presetSelect').value = '';
  syncCircleControls();
  setInteractionMode('move');
  renderPalette();
}

/** Carrega um exemplo do caderno, do Livro de Magias ou dos estudos */
export function loadPreset(key: string): void {
  const preset = PRESETS[key];
  if (!preset) return;
  changeCircleContext();
  view.zoom = 1; // abre o desenho inteiro
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
    // Exemplo novo: o mesmo mago (refino e velocidade), com a energia da Ativação perfeita
    mage: { ...state.mage, energia: null },
    selectedNodeId: 'prism_center',
    selectedCircleId: null,
    activeLayer: null
  });
  state.circles = ensureCircles(state);
  byId('flowBtn').classList.toggle('active', state.showFlow);
  byId<HTMLSelectElement>('presetSelect').value = key;
  syncCircleControls();
  render();
  renderPalette();
}

