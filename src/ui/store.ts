import type { EditorState, MagicNode } from '../core/types';

/** Estado inicial: só a Matriz central */
export function emptyState(): EditorState {
  return {
    ringStyle: 'single',
    strokeWidth: 6,
    showGrid: true,
    interactionMode: 'move',
    selectedNodeId: 'prism_center',
    connectSourceId: null,
    runeCategoryFilter: 'all',
    showFlow: true,
    sketchy: true,
    innerMode: false,
    snap: false,
    showEnergy: false,
    selectedCircleId: null,
    activeLayer: null,
    spellInfo: null,
    mage: { refino: 1, energia: null, velocidade: 30 },
    nodes: [
      { id: 'prism_center', shape: 'prism', x: 0, y: 0, size: 54, rot: 0, rune: null, activation: 'ativacao', charge: 1, lockedCenter: true, circleId: 'c1' }
    ],
    connections: [],
    // Anéis do círculo mágico. Cada um tem sua Matriz (nó com lockedCenter + circleId).
    circles: [{ id: 'c1', x: 0, y: 0 }]
  };
}

export const store = {
  state: emptyState(),
  /** Círculo salvo na conta que está aberto no editor (para "Atualizar") */
  savedCircle: null as { id: string; nome: string } | null
};

/** Arrasto em andamento */
export const drag = {
  nodeId: null as string | null,
  /** Nós que andam junto ao arrastar a Matriz de um círculo secundário */
  group: [] as string[],
  offset: { x: 0, y: 0 }
};

export const findNode = (id: string | null | undefined): MagicNode | undefined =>
  store.state.nodes.find(n => n.id === id);

export const selectedNode = (): MagicNode | undefined => findNode(store.state.selectedNodeId);

// ---- Redesenho ----
// Os módulos de tela se registram aqui; as ações só chamam render()/renderPalette().
type Renderer = () => void;
const renderers: Renderer[] = [];
/** Os que acompanham o mouse durante um arrasto (o desenho); os painéis esperam soltar */
const dragRenderers: Renderer[] = [];
const paletteRenderers: Renderer[] = [];

export function onRender(fn: Renderer, options: { duringDrag?: boolean } = {}): void {
  renderers.push(fn);
  if (options.duringDrag) dragRenderers.push(fn);
}

export function onRenderPalette(fn: Renderer): void {
  paletteRenderers.push(fn);
}

let pendingFrame = 0;

/** Redesenha o círculo, os painéis e o resultado */
export function render(): void {
  if (pendingFrame) { cancelAnimationFrame(pendingFrame); pendingFrame = 0; }
  renderers.forEach(fn => fn());
}

/**
 * Arrasto: redesenha só o círculo, no máximo uma vez por quadro (vários movimentos do mouse viram
 * um desenho só). Os painéis são atualizados pelo render() completo ao soltar.
 */
export function renderSoon(): void {
  if (pendingFrame) return;
  pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; dragRenderers.forEach(fn => fn()); });
}

/** Redesenha a lista de runas (seleção ou filtro mudou) */
export function renderPalette(): void {
  paletteRenderers.forEach(fn => fn());
}
