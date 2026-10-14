import { analyzeCircles, getCircle, getNodeCircles, getNodeShortLabel, getViewBox, RING_R, releasesEnergy } from '../core/circles';
import { getShapeBoundaryPoint } from '../core/geometry';
import { runeColor, RUNES } from '../data/runes';
import { byId } from './dom';
import { RUNE_FIT, renderNodeShapeSVG } from './shapes-svg';
import { drag, store } from './store';

// Desenha o círculo mágico inteiro no SVG #magicCircleSvg.
// Nós têm data-node-id e cabos data-conn-id: os cliques são tratados em interaction.ts.
export function renderCanvas(): void {
  const state = store.state;
  const svg = byId('magicCircleSvg') as unknown as SVGSVGElement;
  const sw = state.strokeWidth;
  let html = '';

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

    if (state.ringStyle === 'single') {
      html += `<circle cx="${cx}" cy="${cy}" r="${RING_R}" stroke="var(--stroke-circle)" stroke-width="${sw * 1.45}" fill="none" />`;
    } else if (state.ringStyle === 'double') {
      html += `
            <circle cx="${cx}" cy="${cy}" r="292" stroke="var(--stroke-circle)" stroke-width="${sw * 1.3}" fill="none" />
            <circle cx="${cx}" cy="${cy}" r="274" stroke="var(--stroke-circle)" stroke-width="${sw * 0.55}" fill="none" />
          `;
    } else if (state.ringStyle === 'runic') {
      html += `
            <circle cx="${cx}" cy="${cy}" r="296" stroke="var(--stroke-circle)" stroke-width="${sw * 1.25}" fill="none" />
            <circle cx="${cx}" cy="${cy}" r="270" stroke="var(--stroke-circle)" stroke-width="${sw * 0.55}" fill="none" />
          `;
      // Marcas rúnicas em volta do anel
      for (let i = 0; i < 36; i++) {
        const ang = (i * 10 * Math.PI) / 180;
        const r1 = i % 3 === 0 ? 270 : 276;
        const r2 = i % 3 === 0 ? 296 : 290;
        const x1 = cx + Math.cos(ang) * r1;
        const y1 = cy + Math.sin(ang) * r1;
        const x2 = cx + Math.cos(ang) * r2;
        const y2 = cy + Math.sin(ang) * r2;
        html += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--stroke-circle)" stroke-width="1.8" opacity="0.75"/>`;
      }
    }
  });

  // 3. Cabos e o ○ de saída
  const portPoints: { x: number; y: number }[] = [];
  const lineSw = Math.max(2.6, sw * 0.52);
  const crossingIds = new Set(analyzeCircles(state).crossing.map(c => c.id));

  state.connections.forEach(conn => {
    const nFrom = state.nodes.find(n => n.id === conn.from);
    const nTo = state.nodes.find(n => n.id === conn.to);
    if (!nFrom || !nTo) return;

    let pathD: string;
    let pStart: { x: number; y: number };
    let pEnd: { x: number; y: number };

    if (conn.type === 'straight') {
      pStart = getShapeBoundaryPoint(nFrom, nTo.x, nTo.y);
      pEnd = getShapeBoundaryPoint(nTo, nFrom.x, nFrom.y);
      pathD = `M ${pStart.x.toFixed(1)} ${pStart.y.toFixed(1)} L ${pEnd.x.toFixed(1)} ${pEnd.y.toFixed(1)}`;
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
    }

    const dashAttr = conn.mode === 'sequential' ? `stroke-dasharray="8 5"` : '';
    const releases = releasesEnergy(state, conn.from);
    const invalid = crossingIds.has(conn.id) || !releases;
    const pulse = state.showFlow && releases ? `<path class="flow-pulse" d="${pathD}"/>` : '';
    html += `
          <g class="conn-group" data-conn-id="${conn.id}">
            <path class="svg-connection" d="${pathD}" stroke="${invalid ? 'var(--danger)' : 'var(--stroke-circle)'}" stroke-width="${lineSw}" ${dashAttr} fill="none"/>
            ${pulse}
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
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.78}" stroke="var(--accent)" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity="0.65"/>`;
    } else if (node.activation === 'instavel') {
      stateRing = `<circle cx="0" cy="0" r="${node.size * 0.80}" stroke="var(--danger)" stroke-width="1.6" stroke-dasharray="5 3" fill="none" opacity="0.8"/>`;
    }

    html += `
          <g class="svg-node ${isSelected ? 'selected' : ''}"
             transform="translate(${node.x.toFixed(1)}, ${node.y.toFixed(1)}) rotate(${node.rot || 0})"
             data-node-id="${node.id}">
            ${renderNodeShapeSVG(node, sw)}
            ${stateRing}
            ${isConnectSource ? `<circle cx="0" cy="0" r="${node.size + 8}" stroke="var(--accent-secondary)" stroke-width="2.5" stroke-dasharray="4 4" fill="none"/>` : ''}
            ${rune ? `<g transform="rotate(${-(node.rot || 0)}) scale(${runeScale.toFixed(2)})" stroke="${runeColor(rune)}" color="${runeColor(rune)}">${rune.svg}</g>` : ''}
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
