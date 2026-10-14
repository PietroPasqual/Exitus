import type { MagicNode } from '../core/types';
import { analyzeCircles, endpointNode, getCircle, getEnvelope, radiusOf, getNodeCircles, getNodeShortLabel, getViewBox, hasPrismShape, isPrism, releasesEnergy, RING_R } from '../core/circles';
import { analyzeFlow } from '../core/flow';
import { getShapeBoundaryPoint } from '../core/geometry';
import { runeColor, RUNES } from '../data/runes';
import { byId } from './dom';
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

  state.circles.forEach(circle => {
    const { id, x: cx, y: cy, frame } = circle;
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
            <g opacity="0.14" stroke="var(--stroke-circle)" stroke-width="1" stroke-dasharray="4 4" fill="none" transform="translate(${cx} ${cy})">
              <line x1="-320" y1="0" x2="320" y2="0" />
              <line x1="0" y1="-320" x2="0" y2="320" />
              <circle cx="0" cy="0" r="165" />
            </g>
          `);
    }

    html += scaled(renderRing(state.ringStyle, cx, cy, sw, state.sketchy, id));
  });

  // 3. Cabos e o ○ de saída
  const portPoints: { x: number; y: number }[] = [];
  const lineSw = Math.max(2.6, sw * 0.52);
  const crossingIds = new Set(analyzeCircles(state).crossing.map(c => c.id));

  // ⚡ Fluxo: por onde a mana passa. "live" = sai do Prisma e volta a ele (a magia funciona);
  // "open" = sai do Prisma mas não volta (vaza); o resto fica apagado.
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
          <g class="conn-group${state.showFlow ? ` mana-${mana}` : ''}" data-conn-id="${conn.id}">
            ${glow}
            ${cableInk(state.sketchy, conn.id, pathD, trace, ink, lineSw, dashAttr)}
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
    const heart = isPrism(node) && hasPrismShape(node) ? `<circle class="prism-heart" cx="0" cy="0" r="${(node.size * 1.75).toFixed(1)}" fill="url(#manaHeart)" pointer-events="none"/>` : '';
    const manaClass = state.showFlow ? ` mana-${manaOf(node.id)}` : '';
    const color = rune ? runeColor(rune) : '';

    html += `
          <g class="svg-node${isSelected ? ' selected' : ''}${manaClass}"
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
    const vb = getViewBox(state.circles, !!state.envelope);
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

/** O traço visível do cabo: exato, ou à mão (um traço firme e outro fino por cima) */
function cableInk(sketchy: boolean, id: string, pathD: string, trace: Pt[], ink: string, lineSw: number, dashAttr: string): string {
  if (!sketchy) return `<path class="svg-connection" d="${pathD}" stroke="${ink}" stroke-width="${lineSw}" ${dashAttr} fill="none"/>`;
  const rand = seeded(`c|${id}`);
  const draw = (): string => (trace.length === 2 ? sketchLine(trace[0], trace[1], rand) : sketchThrough(trace, rand, 0.45));
  return `<path class="svg-connection" d="${draw()}" stroke="${ink}" stroke-width="${(lineSw * 0.9).toFixed(2)}" ${dashAttr} fill="none" stroke-linecap="round"/>`
    + `<path class="svg-connection conn-retrace" d="${draw()}" stroke="${ink}" stroke-width="${(lineSw * 0.4).toFixed(2)}" ${dashAttr} fill="none" stroke-linecap="round" opacity="0.45"/>`;
}

/**
 * Magia dentro da magia: as runas do Selo/Col em pequenos círculos ligados por um traço
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
    // Muitas runas: o pequeno Prisma (fonte) no meio e as outras em volta, ligadas a ele
    const orbit = r * 0.58;
    cell = Math.min(r * 0.22, (Math.PI * orbit / others.length) * 0.8);
    cells = [{ id: source, x: 0, y: 0, prism: true }, ...others.map((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / others.length;
      return { id, x: Math.cos(a) * orbit, y: Math.sin(a) * orbit, prism: false };
    })];
    links = cells.slice(1).map(c => `M0,0L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join('');
  } else {
    // Poucas runas: em roda, a primeira de dentro no pequeno Prisma
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
    // A magia de dentro também tem fonte: a primeira runa de dentro fica num pequeno Prisma ◇
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
