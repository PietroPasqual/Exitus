import type { MagicNode } from '../core/types';
import { escapeHtml } from '../core/format';
import { analyzeCircles, circleNumber, isRingId, endpointNode, getCircle, getEnvelope, radiusOf, getNodeCircles, getNodeShortLabel, getViewBox, hasPrismShape, isPrism, releasesEnergy, RING_R } from '../core/circles';
import { analyzeFlow } from '../core/flow';
import { simulateCharge, wireKey } from '../core/charge';
import { getShapeBoundaryPoint, ringPolygon } from '../core/geometry';
import { runeColor, RUNES } from '../data/runes';
import { byId, inputValue } from './dom';
import { renderRing } from './ornaments';
import { seeded, sketchCircle, sketchLine, sketchPolygon, sketchThrough, type Pt } from './sketch';
import { RUNE_FIT, renderNodeOrnaments, renderNodeShapeSVG, runeHalo } from './shapes-svg';
import { drag, store } from './store';

// Desenha o círculo mágico inteiro no SVG #magicCircleSvg.
// Nós têm data-node-id e cabos data-conn-id: os cliques são tratados em interaction.ts.
export function renderCanvas(): void {
  const state = store.state;
  const svg = byId('magicCircleSvg') as unknown as SVGSVGElement;
  const sw = state.strokeWidth;
  let html = `<defs><radialGradient id="manaHeart"><stop offset="0" stop-color="var(--heart)" stop-opacity="0.34"/><stop offset="0.55" stop-color="var(--heart)" stop-opacity="0.13"/><stop offset="1" stop-color="var(--heart)" stop-opacity="0"/></radialGradient></defs>`;

  // 1 + 2. Grade de apoio (opcional) e o anel externo de cada círculo
  // Círculo em volta de tudo (envolve os círculos separados ligados à magia)
  if (state.envelope && state.circles.length > 1) {
    const e = getEnvelope(state.circles);
    html += `<g class="envelope">${state.sketchy
      ? `<path d="${sketchCircle(e.x, e.y, e.r, seeded('envelope'))}" stroke="var(--stroke-circle)" stroke-width="${(sw * 1.1).toFixed(1)}" fill="none" stroke-linecap="round"/>`
      : `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" stroke="var(--stroke-circle)" stroke-width="${sw * 1.2}" fill="none"/>`}
      <circle cx="${e.x}" cy="${e.y}" r="${e.r - 12}" stroke="var(--stroke-circle)" stroke-width="1" fill="none" opacity="0.45"/></g>`;
  }

  // Camada ativa: só os selos desse círculo podem ser mexidos; os outros ficam apagados e por baixo
  const layer = state.activeLayer && state.circles.some(c => c.id === state.activeLayer) ? state.activeLayer : null;
  const nodeInLayer = (n: MagicNode): boolean => !layer || (isPrism(n) ? n.circleId === layer : getNodeCircles(state, n).includes(layer));
  const endInLayer = (id: string): boolean => {
    if (!layer) return true;
    const n = endpointNode(state, id);
    return !!n && (isRingId(id) ? id === 'ring:' + layer : nodeInLayer(n));
  };
  const layerColor = (circleId: string | undefined): string => LAYER_COLORS[Math.max(0, state.circles.findIndex(c => c.id === circleId)) % LAYER_COLORS.length];

  // O círculo da camada ativa é desenhado por cima
  const ordered = layer ? [...state.circles.filter(c => c.id !== layer), ...state.circles.filter(c => c.id === layer)] : state.circles;
  ordered.forEach(circle => {
    const { id, x: cx, y: cy, frame } = circle;
    const off = layer && id !== layer;
    const radius = radiusOf(circle);
    // Círculos menores (dentro de outros): o anel inteiro é desenhado em escala
    const k = radius / RING_R;
    const scaled = (inner: string): string => (k === 1 ? inner : `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(4)}) translate(${-cx} ${-cy})">${inner}</g>`);
    // Círculo dentro de um quadrado: efeito sustentado, não inerente
    if (frame === 'square') {
      const h = radius + 24;
      const pts: Pt[] = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]];
      html += state.sketchy
        ? `<path class="circle-frame" d="${sketchPolygon(pts, seeded('frame|' + id), 3)}" stroke="var(--stroke-circle)" stroke-width="${(sw * 0.9).toFixed(1)}" fill="none" stroke-linecap="round"/>`
        : `<rect class="circle-frame" x="${cx - h}" y="${cy - h}" width="${h * 2}" height="${h * 2}" stroke="var(--stroke-circle)" stroke-width="${sw}" fill="none"/>`;
    }
    if (state.showGrid) {
      html += scaled(`
            <g class="guide-grid" opacity="0.14" stroke="var(--stroke-circle)" stroke-width="1" stroke-dasharray="4 4" fill="none" transform="translate(${cx} ${cy})">
              <line x1="-320" y1="0" x2="320" y2="0" />
              <line x1="0" y1="-320" x2="0" y2="320" />
              <circle cx="0" cy="0" r="165" />
            </g>
          `);
    }

    const ringSvg = scaled(renderRing(state.ringStyle, cx, cy, sw, state.sketchy, id, circle.shape));
    html += off ? `<g class="layer-off">${ringSvg}</g>` : ringSvg;
    // Área de toque do anel: arrastar move o círculo inteiro; em Reta/Arco, liga anel a anel
    const src = state.connectSourceId === `ring:${id}`;
    const picked = state.selectedCircleId === id;
    const mark = src || picked;
    const ringAttrs = `class="ring-hit${src ? ' ring-source' : ''}${picked ? ' ring-picked' : ''}" data-ring-id="ring:${id}" fill="none" stroke="${src ? 'var(--accent-secondary)' : picked ? 'var(--accent)' : 'transparent'}" stroke-width="${mark ? 4 : 18}" stroke-dasharray="${mark ? '8 6' : 'none'}" pointer-events="${off ? 'none' : 'stroke'}"`;
    const ringTitle = '<title>Toque no anel para escolher o círculo · arraste para mover o círculo inteiro · no modo Reta/Arco, toque ou puxe para ligar a outro círculo</title>';
    html += circle.shape
      ? `<polygon ${ringAttrs} points="${ringPolygon(circle.shape, radius).map(([x, y]) => `${(cx + x).toFixed(1)},${(cy + y).toFixed(1)}`).join(' ')}" stroke-linejoin="round">${ringTitle}</polygon>`
      : `<circle ${ringAttrs} cx="${cx}" cy="${cy}" r="${radius.toFixed(1)}">${ringTitle}</circle>`;
  });

  // Energia: o estado de cada runa vem da energia infundida na Matriz
  const charge = simulateCharge(state, analyzeFlow(state), inputValue('missingMatSelect') === 'missing');
  /** Etiquetas de energia (por cima de tudo) */
  let energyLayer = '';

  // 3. Cabos e o ○ de saída
  const portPoints: { x: number; y: number }[] = [];
  const lineSw = Math.max(2.6, sw * 0.52);
  const crossingIds = new Set(analyzeCircles(state).crossing.map(c => c.id));

  // ⚡ Fluxo: por onde a mana passa. "live" = sai da Matriz e volta a ela (a magia funciona);
  // "open" = sai da Matriz mas não volta (vaza); o resto fica apagado.
  const manaOf = manaPaths(state.showFlow);

  state.connections.forEach(conn => {
    // Ponta pode ser uma forma ou o anel de um círculo (cabo por fora, de anel a anel)
    const nFrom = endpointNode(state, conn.from);
    const nTo = endpointNode(state, conn.to);
    if (!nFrom || !nTo) return;

    let pathD: string;
    let pStart: { x: number; y: number };
    let pEnd: { x: number; y: number };
    let mid: { x: number; y: number };
    /** Pontos do caminho, para o traço à mão */
    let trace: Pt[];

    if (conn.type === 'straight') {
      pStart = getShapeBoundaryPoint(nFrom, nTo.x, nTo.y);
      pEnd = getShapeBoundaryPoint(nTo, nFrom.x, nFrom.y);
      // Ir e voltar entre as mesmas formas: linha dupla (cada cabo de um lado)
      if (state.connections.some(o => o.from === conn.to && o.to === conn.from && o.type === 'straight')) {
        const len = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) || 1;
        const ox = (-(pEnd.y - pStart.y) / len) * 3.6, oy = ((pEnd.x - pStart.x) / len) * 3.6;
        pStart = { x: pStart.x + ox, y: pStart.y + oy };
        pEnd = { x: pEnd.x + ox, y: pEnd.y + oy };
      }
      pathD = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} L ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`;
      mid = { x: (pStart.x + pEnd.x) / 2, y: (pStart.y + pEnd.y) / 2 };
      trace = [[pStart.x, pStart.y], [pEnd.x, pEnd.y]];
    } else {
      // Arco curvo: a barriga aponta para fora do centro do círculo em que o cabo está
      const midX = (nFrom.x + nTo.x) / 2;
      const midY = (nFrom.y + nTo.y) / 2;
      const dx = nTo.x - nFrom.x;
      const dy = nTo.y - nFrom.y;
      const dist = Math.hypot(dx, dy) || 1;
      let { nx, ny } = arcOutward(nFrom, nTo);
      if (conn.type === 'arc-ccw') {
        nx = -nx;
        ny = -ny;
      }
      const curveBulge = Math.min(110, dist * 0.42);
      const ctrlX = midX + nx * curveBulge;
      const ctrlY = midY + ny * curveBulge;

      pStart = getShapeBoundaryPoint(nFrom, ctrlX, ctrlY);
      pEnd = getShapeBoundaryPoint(nTo, ctrlX, ctrlY);
      pathD = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`;
      // Meio da curva (t = 0,5); ali a tangente é paralela a pStart → pEnd
      mid = { x: 0.25 * pStart.x + 0.5 * ctrlX + 0.25 * pEnd.x, y: 0.25 * pStart.y + 0.5 * ctrlY + 0.25 * pEnd.y };
      trace = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8, u = 1 - t;
        trace.push([u * u * pStart.x + 2 * u * t * ctrlX + t * t * pEnd.x, u * u * pStart.y + 2 * u * t * ctrlY + t * t * pEnd.y]);
      }
    }

    const dashAttr = conn.mode === 'sequential' ? `stroke-dasharray="8 5"` : '';
    const releases = releasesEnergy(state, conn.from);
    const invalid = crossingIds.has(conn.id) || !releases;
    const mana = releases ? manaOf(conn.from) : 'off';
    const glow = state.showFlow && mana !== 'off' ? `<path class="mana-glow mana-${mana}" d="${pathD}" stroke-width="${(lineSw * 4.2).toFixed(1)}"/>` : '';
    const pulse = state.showFlow && mana !== 'off'
      ? `<path class="flow-pulse mana-${mana}" d="${pathD}" stroke-width="${(lineSw * 2.4).toFixed(1)}"/><path class="flow-core" d="${pathD}" stroke-width="${(lineSw * 0.95).toFixed(1)}"/>`
      : '';
    const ink = invalid ? 'var(--danger)' : 'var(--stroke-circle)';
    html += `
          <g class="conn-group${state.showFlow ? ` mana-${mana}` : ''}${endInLayer(conn.from) || endInLayer(conn.to) ? '' : ' layer-off'}" data-conn-id="${conn.id}">
            ${glow}
            ${cableInk(state.sketchy, conn.id, pathD, trace, ink, lineSw, dashAttr)}
            ${pulse}
            ${arrowAt(mid, pStart, pEnd, lineSw, ink)}
            <path class="conn-hit" d="${pathD}" stroke="transparent" stroke-width="18" fill="none">
              <title>Fluxo: ${getNodeShortLabel(state, conn.from)} ➔ ${getNodeShortLabel(state, conn.to)} (${conn.mode === 'simultaneous' ? 'Simultânea' : 'Sequencial'}) — clique inverte o sentido · Shift+clique remove</title>
            </path>
            ${Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) >= 46 ? `<circle class="curve-hit" data-curve-id="${conn.id}" cx="${mid.x.toFixed(1)}" cy="${mid.y.toFixed(1)}" r="12" fill="transparent"><title>Arraste a seta para curvar o cabo (por fora, por dentro ou reto) · clique inverte</title></circle>` : ''}
          </g>
        `;

    // Regra do cabo de energia: o ○ marca só a ORIGEM; a ponta sem ○ é o destino
    portPoints.push(pStart);

    // Energia que corre neste fio (ao lado da seta, para não cobri-la)
    if (state.showEnergy && charge.level !== 'inativo' && releases) {
      const same = state.connections.filter(o => o.from === conn.from && o.to === conn.to).length || 1;
      const value = charge.wires.get(wireKey(conn.from, conn.to));
      if (value !== undefined) {
        const len = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) || 1;
        const nx = -(pEnd.y - pStart.y) / len, ny = (pEnd.x - pStart.x) / len;
        energyLayer += energyTag(mid.x + nx * 17, mid.y + ny * 17, fmtE(value / same), 'wire');
      }
    }
  });

  // 4. Formas com a runa dentro
  // Os selos da camada ativa por último (ficam por cima, prontos para mexer)
  const nodesOrdered = layer ? [...state.nodes.filter(n => !nodeInLayer(n)), ...state.nodes.filter(nodeInLayer)] : state.nodes;
  nodesOrdered.forEach(node => {
    const isSelected = node.id === state.selectedNodeId && !state.selectedCircleId;
    const offLayer = !nodeInLayer(node);
    const isConnectSource = node.id === state.connectSourceId;
    const rune = node.rune ? RUNES[node.rune] : null;
    const runeScale = (node.size / 54) * 1.45 * (RUNE_FIT[node.shape] || 1);

    // Anel tracejado do estado (vem da energia): Perfeito (dourado) ou Instável (vermelho)
    let stateRing = '';
    const nodeState = charge.nodeState.get(node.id);
    if (nodeState === 'perfeito') {
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.72}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`;
    } else if (nodeState === 'instavel') {
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.74}" stroke="var(--danger)" stroke-width="1.6" stroke-dasharray="5 3" fill="none" opacity="0.8"/>`;
    }

    // A Matriz é o coração da magia: um brilho suave atrás dele
    const heart = isPrism(node) && hasPrismShape(node) ? `<circle class="prism-heart" cx="0" cy="0" r="${(node.size * 1.75).toFixed(1)}" fill="url(#manaHeart)" pointer-events="none"/>` : '';
    const manaClass = state.showFlow ? ` mana-${manaOf(node.id)}` : '';
    const color = rune ? runeColor(rune) : '';

    html += `
          <g class="svg-node${isSelected ? ' selected' : ''}${manaClass}${offLayer ? ' layer-off' : ''}"
             transform="translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${node.rot || 0})"
             data-node-id="${node.id}">
            ${heart}
            ${renderNodeShapeSVG(node, sw, state.sketchy)}
            ${node.double ? `<g class="double-star" transform="rotate(36)">${renderNodeShapeSVG({ ...node, id: node.id + '_2' }, sw, state.sketchy)}</g>` : ''}
            ${renderNodeOrnaments(node, sw, state.sketchy)}
            ${stateRing}
            ${isConnectSource ? `<circle cx="0" cy="0" r="${node.size + 8}" stroke="var(--accent-secondary)" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/>` : ''}
            ${node.inner?.length
              ? innerSpell(node)
              : rune ? `<g transform="rotate(${-(node.rot || 0)}) scale(${runeScale.toFixed(2)})" stroke="${color}" color="${color}"><g class="rune-halo" opacity="0.2">${runeHalo(rune.id, rune.svg)}</g>${rune.svg}</g>` : ''}
            ${node.layer ? layerTag(node, circleNumber(state, node.layer), layerColor(node.layer)) : ''}
            ${node.bond ? `<text class="bond-label" transform="rotate(${-(node.rot || 0)})" x="0" y="${(node.size + 17).toFixed(1)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="700" fill="var(--text-main)" stroke="var(--bg-canvas)" stroke-width="4" stroke-linejoin="round" paint-order="stroke" pointer-events="none">«${escapeHtml(node.bond)}»</text>` : ''}
          </g>
        `;
  });

  // 5. Os ○ de saída por cima das bordas
  portPoints.forEach(pt => {
    html += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.6" stroke="var(--stroke-circle)" stroke-width="2.2" fill="var(--port-fill)" pointer-events="none"/>`;
  });

  // 6. Energia que fica em cada selo (com as runas), em cima dele
  if (state.showEnergy && charge.level !== 'inativo') {
    state.nodes.forEach(node => {
      const used = charge.nodeEnergy.get(node.id);
      if (used === undefined) return;
      energyLayer += energyTag(node.x, node.y - node.size - 13, `⚡ ${fmtE(used)}`, `node state-${charge.nodeState.get(node.id) ?? 'sem'}`);
    });
    html += `<g class="energy-layer" pointer-events="none">${energyLayer}</g>`;
  }

  svg.innerHTML = html;
  renderLayerBar(layer, layerColor);
  // Enquadra todos os círculos (congelado durante o arrasto para o dedo não "escorregar")
  if (!drag.nodeId) applyView();
}

const fmtE = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

/** Barra de camadas no desenho (aparece com dois círculos ou mais) */
function renderLayerBar(layer: string | null, color: (id: string) => string): void {
  const state = store.state;
  const bar = byId('layerBar');
  bar.hidden = state.circles.length < 2;
  if (bar.hidden) return;
  const chip = (arg: string, label: string, active: boolean, dot = ''): string =>
    `<button type="button" data-action="set-layer" data-arg="${arg}" class="${active ? 'active' : ''}" aria-pressed="${active}">${dot}${label}</button>`;
  bar.innerHTML = '<span class="layer-label">Camada</span>' + chip('all', 'Todas', !layer)
    + state.circles.map((c, i) => chip(c.id, String(i + 1), layer === c.id, `<i style="color:${color(c.id)}"></i>`)).join('');
  bar.title = 'Escolha a camada (círculo) para mexer só nos selos dela; os outros ficam apagados e travados';
}

/** Cor de cada camada (círculo), na barra de camadas e nas Estrelas */
export const LAYER_COLORS = ['#b45309', '#1c7ed6', '#2b8a3e', '#ae3ec9', '#d6336c', '#0b7285'];

/** Número da camada na Estrela (cada camada de um lado, para ver as duas quando estão alinhadas) */
function layerTag(node: MagicNode, num: number, color: string): string {
  const side = num % 2 === 1 ? 1 : -1;
  const d = node.size * 0.78;
  return `<g class="layer-tag" transform="rotate(${-(node.rot || 0)}) translate(${(side * d).toFixed(1)} ${(-d).toFixed(1)})" pointer-events="none"><circle r="9" fill="${color}" stroke="var(--bg-canvas)" stroke-width="2"/><text y="4" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" font-weight="800" fill="#fff">${num}</text></g>`;
}

/** Etiqueta de energia (um balãozinho com o número) */
function energyTag(x: number, y: number, text: string, kind: string): string {
  const w = 10 + text.length * 7.4;
  return `<g class="energy-tag ${kind}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${(-w / 2).toFixed(1)}" y="-10" width="${w.toFixed(1)}" height="20" rx="10"/><text x="0" y="4.5" text-anchor="middle">${escapeHtml(text)}</text></g>`;
}

// ---------- Zoom e deslocamento ----------

/** Aproximação atual: 1 = mostra tudo; o centro só vale com zoom > 1 */
export const view = { zoom: 1, cx: 0, cy: 0 };
export const MAX_ZOOM = 24;
/** Afastar: até 10% (o desenho fica pequeno, com espaço em volta) */
export const MIN_ZOOM = 0.1;

/** Aplica o zoom ao desenho, sem sair da área dos círculos */
export function applyView(): void {
  const state = store.state;
  const svg = byId('magicCircleSvg');
  const base = getViewBox(state.circles, !!state.envelope);
  if (Math.abs(view.zoom - 1) < 0.001) {
    view.zoom = 1;
    view.cx = base.x + base.w / 2;
    view.cy = base.y + base.h / 2;
    svg.setAttribute('viewBox', `${base.x} ${base.y} ${base.w} ${base.h}`);
    return;
  }
  const w = base.w / view.zoom, h = base.h / view.zoom;
  if (view.zoom > 1) {
    // Aproximado: anda só dentro do desenho
    view.cx = Math.min(base.x + base.w - w / 2, Math.max(base.x + w / 2, view.cx));
    view.cy = Math.min(base.y + base.h - h / 2, Math.max(base.y + h / 2, view.cy));
  } else {
    // Afastado: o centro da vista fica dentro do desenho (ele nunca some da tela)
    view.cx = Math.min(base.x + base.w, Math.max(base.x, view.cx));
    view.cy = Math.min(base.y + base.h, Math.max(base.y, view.cy));
  }
  svg.setAttribute('viewBox', `${(view.cx - w / 2).toFixed(1)} ${(view.cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
}

/** Muda o zoom mantendo parado o ponto (do desenho) que está sob o dedo/mouse */
export function setZoom(zoom: number, anchor?: { x: number; y: number }): void {
  let z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  // Passando por 100%, para nele (volta ao desenho inteiro e centralizado)
  if ((view.zoom > 1 && z < 1) || (view.zoom < 1 && z > 1)) z = 1;
  if (anchor && view.zoom > 0) {
    view.cx = anchor.x + (view.cx - anchor.x) * (view.zoom / z);
    view.cy = anchor.y + (view.cy - anchor.y) * (view.zoom / z);
  }
  view.zoom = z;
  applyView();
  document.querySelectorAll('[data-action="zoom-reset"]').forEach(b => { b.textContent = `${Math.round(z * 100)}%`; });
}

/**
 * Para que lado o arco "estufa": para fora do centro do círculo onde está o cabo.
 * O Arco por dentro usa o lado oposto.
 */
export function arcOutward(nFrom: MagicNode, nTo: MagicNode): { nx: number; ny: number } {
  const state = store.state;
  const midX = (nFrom.x + nTo.x) / 2, midY = (nFrom.y + nTo.y) / 2;
  const dx = nTo.x - nFrom.x, dy = nTo.y - nFrom.y;
  const dist = Math.hypot(dx, dy) || 1;
  let nx = -dy / dist, ny = dx / dist;
  const fromCircles = getNodeCircles(state, nFrom);
  const home = getCircle(state, getNodeCircles(state, nTo).find(id => fromCircles.includes(id)) || fromCircles[0]) || state.circles[0];
  if (nx * (midX - home.x) + ny * (midY - home.y) < 0) { nx = -nx; ny = -ny; }
  return { nx, ny };
}

type Mana = 'live' | 'open' | 'off';

/** Para cada nó: a mana passa por ele numa magia que funciona, vaza, ou não chega */
function manaPaths(enabled: boolean): (id: string) => Mana {
  if (!enabled) return () => 'off';
  const flow = analyzeFlow(store.state);
  const open = new Set<string>();
  flow.perPrism.forEach(p => {
    if (p.starts && !p.closes) p.fwd.forEach(id => open.add(id));
  });
  return id => (flow.working.has(id) ? 'live' : open.has(id) ? 'open' : 'off');
}

/** Seta no meio do cabo apontando da origem (○) para o destino */
function arrowAt(mid: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }, lineSw: number, ink: string): string {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 46) return '';
  const ang = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  const k = Math.max(1, lineSw / 2.6);
  return `<path class="conn-arrow" d="M ${(-4.5 * k).toFixed(1)} ${(-5.5 * k).toFixed(1)} L ${(3.5 * k).toFixed(1)} 0 L ${(-4.5 * k).toFixed(1)} ${(5.5 * k).toFixed(1)}" transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) rotate(${ang.toFixed(1)})" stroke="${ink}" stroke-width="${(lineSw * 0.95).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none" pointer-events="none"/>`;
}

/** O traço visível do cabo: exato, ou à mão (um traço firme e outro fino por cima) */
function cableInk(sketchy: boolean, id: string, pathD: string, trace: Pt[], ink: string, lineSw: number, dashAttr: string): string {
  if (!sketchy) return `<path class="svg-connection" d="${pathD}" stroke="${ink}" stroke-width="${lineSw}" ${dashAttr} fill="none"/>`;
  const rand = seeded(`c|${id}`);
  const draw = (): string => (trace.length === 2 ? sketchLine(trace[0], trace[1], rand) : sketchThrough(trace, rand, 0.45));
  return `<path class="svg-connection" d="${draw()}" stroke="${ink}" stroke-width="${(lineSw * 0.9).toFixed(2)}" ${dashAttr} fill="none" stroke-linecap="round"/>`
    + `<path class="svg-connection conn-retrace" d="${draw()}" stroke="${ink}" stroke-width="${(lineSw * 0.4).toFixed(2)}" ${dashAttr} fill="none" stroke-linecap="round" opacity="0.45"/>`;
}

/**
 * Magia dentro da magia: as runas do Círculo/Quadrado em pequenos círculos ligados por um traço
 * fino (como no caderno). A forma de fora só delimita essa função.
 */
function innerSpell(node: MagicNode): string {
  const valid = (r: string | null | undefined): r is string => !!r && !!RUNES[r];
  const r = node.size;
  const others = [node.rune, ...(node.inner ?? []).slice(1)].filter(valid);
  const source = node.inner?.[0];
  type Cell = { id: string; x: number; y: number; prism: boolean };
  let cells: Cell[];
  let cell: number;
  let links: string;
  if (valid(source) && others.length >= 3) {
    // Muitas runas: a pequena Matriz (fonte) no meio e as outras em volta, ligadas a ela
    const orbit = r * 0.58;
    cell = Math.min(r * 0.22, (Math.PI * orbit / others.length) * 0.8);
    cells = [{ id: source, x: 0, y: 0, prism: true }, ...others.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / others.length;
      return { id, x: Math.cos(a) * orbit, y: Math.sin(a) * orbit, prism: false };
    })];
    links = cells.slice(1).map(c => `M0,0L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('');
  } else {
    // Poucas runas: em roda, a primeira de dentro na pequena Matriz
    const ids = [node.rune, ...(node.inner ?? [])].filter(valid);
    const n = ids.length;
    const orbit = n === 2 ? r * 0.38 : r * 0.42;
    cell = n === 2 ? r * 0.34 : r * 0.28;
    cells = ids.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n + (n === 2 ? Math.PI / 4 : 0);
      return { id, x: Math.cos(a) * orbit, y: Math.sin(a) * orbit, prism: i === 1 };
    });
    links = cells.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('') + (n > 2 ? 'Z' : '');
  }
  let out = `<g transform="rotate(${-(node.rot || 0)})" pointer-events="none">`;
  // traço que liga as runas de dentro
  out += `<path d="${links}" stroke="var(--stroke-circle)" stroke-width="1.3" fill="none" opacity="0.7"/>`;
  cells.forEach(({ id, x, y, prism }) => {
    const rune = RUNES[id];
    const c = runeColor(rune);
    // A magia de dentro também tem fonte: a primeira runa de dentro fica num pequena Matriz ◇
    if (prism) {
      const d = cell * 1.25;
      out += `<polygon points="${x.toFixed(1)},${(y - d).toFixed(1)} ${(x + d).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + d).toFixed(1)} ${(x - d).toFixed(1)},${y.toFixed(1)}" fill="var(--fill-node)" stroke="var(--stroke-circle)" stroke-width="1.3" stroke-linejoin="round"/>`;
    } else {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cell.toFixed(1)}" fill="var(--fill-node)" stroke="var(--stroke-circle)" stroke-width="1.3"/>`;
    }
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(cell / 22).toFixed(2)})" stroke="${c}" color="${c}">${rune.svg}</g>`;
  });
  return out + '</g>';
}
