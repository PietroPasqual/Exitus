import { analyzeCircles, getCircle, getNodeCircles, getNodeShortLabel, getViewBox, isPrism, releasesEnergy } from '../core/circles';
import { analyzeFlow } from '../core/flow';
import { getShapeBoundaryPoint } from '../core/geometry';
import { runeColor, RUNES } from '../data/runes';
import { byId } from './dom';
import { renderRing } from './ornaments';
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
  state.circles.forEach(({ x: cx, y: cy }) => {
    if (state.showGrid) {
      html += `
            <g opacity="0.14" stroke="var(--stroke-circle)" stroke-width="1" stroke-dasharray="4 4" fill="none" transform="translate(${cx} ${cy})">
              <line x1="-320" y1="0" x2="320" y2="0" />
              <line x1="0" y1="-320" x2="0" y2="320" />
              <circle cx="0" cy="0" r="165" />
            </g>
          `;
    }

    html += renderRing(state.ringStyle, cx, cy, sw);
  });

  // 3. Cabos e o ○ de saída
  const portPoints: { x: number; y: number }[] = [];
  const lineSw = Math.max(2.6, sw * 0.52);
  const crossingIds = new Set(analyzeCircles(state).crossing.map(c => c.id));

  // ⚡ Fluxo: por onde a mana passa. "live" = sai do Prisma e volta a ele (a magia funciona);
  // "open" = sai do Prisma mas não volta (vaza); o resto fica apagado.
  const manaOf = manaPaths(state.showFlow);

  state.connections.forEach(conn => {
    const nFrom = state.nodes.find(n => n.id === conn.from);
    const nTo = state.nodes.find(n => n.id === conn.to);
    if (!nFrom || !nTo) return;

    let pathD: string;
    let pStart: { x: number; y: number };
    let pEnd: { x: number; y: number };
    let mid: { x: number; y: number };

    if (conn.type === 'straight') {
      pStart = getShapeBoundaryPoint(nFrom, nTo.x, nTo.y);
      pEnd = getShapeBoundaryPoint(nTo, nFrom.x, nFrom.y);
      pathD = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} L ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`;
      mid = { x: (pStart.x + pEnd.x) / 2, y: (pStart.y + pEnd.y) / 2 };
    } else {
      // Arco curvo: a barriga aponta para fora do centro do círculo em que o cabo está
      const midX = (nFrom.x + nTo.x) / 2;
      const midY = (nFrom.y + nTo.y) / 2;
      const dx = nTo.x - nFrom.x;
      const dy = nTo.y - nFrom.y;
      const dist = Math.hypot(dx, dy) || 1;
      let nx = -dy / dist;
      let ny = dx / dist;
      const fromCircles = getNodeCircles(state, nFrom);
      const home = getCircle(state, getNodeCircles(state, nTo).find(id => fromCircles.includes(id)) || fromCircles[0]) || state.circles[0];
      if (nx * (midX - home.x) + ny * (midY - home.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
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
          <g class="conn-group${state.showFlow ? ` mana-${mana}` : ''}" data-conn-id="${conn.id}">
            ${glow}
            <path class="svg-connection" d="${pathD}" stroke="${ink}" stroke-width="${lineSw}" ${dashAttr} fill="none"/>
            ${pulse}
            ${arrowAt(mid, pStart, pEnd, lineSw, ink)}
            <path class="conn-hit" d="${pathD}" stroke="transparent" stroke-width="18" fill="none">
              <title>Fluxo: ${getNodeShortLabel(state, conn.from)} ➔ ${getNodeShortLabel(state, conn.to)} (${conn.mode === 'simultaneous' ? 'Simultânea' : 'Sequencial'}) — clique inverte o sentido · Shift+clique remove</title>
            </path>
          </g>
        `;

    // Regra do cabo de energia: o ○ marca só a ORIGEM; a ponta sem ○ é o destino
    portPoints.push(pStart);
  });

  // 4. Formas com a runa dentro
  state.nodes.forEach(node => {
    const isSelected = node.id === state.selectedNodeId;
    const isConnectSource = node.id === state.connectSourceId;
    const rune = node.rune ? RUNES[node.rune] : null;
    const runeScale = (node.size / 54) * 1.45 * (RUNE_FIT[node.shape] || 1);

    // Anel tracejado do estado: Perfeito (dourado) ou Extremo (vermelho)
    let stateRing = '';
    if (node.activation === 'perfeito') {
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.72}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`;
    } else if (node.activation === 'instavel') {
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.74}" stroke="var(--danger)" stroke-width="1.6" stroke-dasharray="5 3" fill="none" opacity="0.8"/>`;
    }

    // O Prisma é o coração da magia: um brilho suave atrás dele
    const heart = isPrism(node) ? `<circle class="prism-heart" cx="0" cy="0" r="${(node.size * 1.75).toFixed(1)}" fill="url(#manaHeart)" pointer-events="none"/>` : '';
    const manaClass = state.showFlow ? ` mana-${manaOf(node.id)}` : '';
    const color = rune ? runeColor(rune) : '';

    html += `
          <g class="svg-node${isSelected ? ' selected' : ''}${manaClass}"
             transform="translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${node.rot || 0})"
             data-node-id="${node.id}">
            ${heart}
            ${renderNodeShapeSVG(node, sw)}
            ${renderNodeOrnaments(node, sw)}
            ${stateRing}
            ${isConnectSource ? `<circle cx="0" cy="0" r="${node.size + 8}" stroke="var(--accent-secondary)" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/>` : ''}
            ${rune ? `<g transform="rotate(${-(node.rot || 0)}) scale(${runeScale.toFixed(2)})" stroke="${color}" color="${color}"><g class="rune-halo" opacity="0.2">${runeHalo(rune.id, rune.svg)}</g>${rune.svg}</g>` : ''}
          </g>
        `;
  });

  // 5. Os ○ de saída por cima das bordas
  portPoints.forEach(pt => {
    html += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.6" stroke="var(--stroke-circle)" stroke-width="2.2" fill="var(--port-fill)" pointer-events="none"/>`;
  });

  svg.innerHTML = html;
  // Enquadra todos os círculos (congelado durante o arrasto para o dedo não "escorregar")
  if (!drag.nodeId) {
    const vb = getViewBox(state.circles);
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }
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
