import { describeAppearance, describeBeing, type Appearance, type Being } from '../core/appearance';
import type { Model } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { FlowResult } from '../core/flow';
import { byId } from './dom';
import { seeded, sketchCircle, sketchLine, sketchPolygon, smoothPath, type Pt, type Rand } from './sketch';

// Aparência da Magia: um desenho pequeno, no traço do site, de como a magia ficaria na cena.
// Quem lança fica à esquerda; a frente é para a direita; o chão embaixo.

/** Cor de cada elemento e runa de conceito */
const COLORS: Record<string, string> = {
  fogo: '#e8590c', raio: '#f2b705', agua: '#1c7ed6', gelo: '#4dabf7', vento: '#20c997', terra: '#8b5a2b',
  metal: '#868e96', som: '#be4bdb', natureza: '#37b24d', acido: '#94c11f', ilusao: '#cc5de8', luz: '#fcc419',
  sombra: '#5c5f66', materia: '#a0522d', gravidade: '#4c6ef5', espaco: '#5f3dc4', vida: '#51cf66', morte: '#495057',
  tempo: '#f59f00', movimento: '#15aabf', pressao: '#4263eb', caos: '#e64980', infinito: '#7950f2', vazio: '#343a40'
};
const INK = 'var(--stroke-circle)';
const MUTED = 'var(--text-muted)';

const f = (n: number): string => n.toFixed(1);

/** Mistura de cores (elementos que se mesclam) */
function blend(colors: string[]): string {
  const rgb = colors.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
  const avg = [0, 1, 2].map(k => Math.round(rgb.reduce((s, c) => s + c[k], 0) / rgb.length));
  return '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
}

const GROUND = 192;

/** Quem lança, em pé no chão, com o braço para a frente (x = centro do corpo) */
function caster(x: number, rand: Rand): string {
  const robe: Pt[] = [[x - 7, 150], [x + 7, 150], [x + 15, GROUND], [x - 15, GROUND]];
  return `<g class="ap-caster" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${sketchCircle(x, 140, 7.5, rand)}" fill="var(--bg-panel)"/>
    <path d="${sketchPolygon(robe, rand, 0.8)}" fill="var(--bg-panel)"/>
    <path d="${sketchLine([x + 6, 156], [x + 24, 150], rand)}"/>
    <path d="M${x - 7},136 Q${x},124 ${x + 7},136" opacity="0.7"/>
  </g>`;
}

interface Pose { x: number; y: number; s: number; alpha?: number }

/** Uma forma (Esfera, Cubo, Paralelepípedo, Pirâmide) centrada em (x, y) */
function shapePath(shape: string, x: number, y: number, s: number, horizontal: boolean, rand: Rand): { d: string; fill: string; w: number } {
  if (shape === 'forma_cubo') {
    const h = s * 0.8;
    const pts: Pt[] = [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]];
    return { d: sketchPolygon(pts, rand, 0.6), fill: `M${pts.map(p => `${f(p[0])},${f(p[1])}`).join('L')}Z`, w: h * 2 };
  }
  if (shape === 'forma_paralelepipedo') {
    const [w, h] = horizontal ? [s * 1.3, s * 0.55] : [s * 0.6, s * 1.35];
    const pts: Pt[] = [[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]];
    return { d: sketchPolygon(pts, rand, 0.6), fill: `M${pts.map(p => `${f(p[0])},${f(p[1])}`).join('L')}Z`, w: w * 2 };
  }
  if (shape === 'forma_piramide') {
    const r = s * 0.95;
    const pts: Pt[] = horizontal
      ? [[x + r, y], [x - r * 0.8, y - r * 0.75], [x - r * 0.8, y + r * 0.75]]
      : [[x, y - r], [x + r * 0.9, y + r * 0.75], [x - r * 0.9, y + r * 0.75]];
    return { d: sketchPolygon(pts, rand, 0.6), fill: `M${pts.map(p => `${f(p[0])},${f(p[1])}`).join('L')}Z`, w: r * 1.8 };
  }
  // Esfera
  const r = s * 0.85;
  return { d: sketchCircle(x, y, r, rand), fill: `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,0 ${f(r * 2)},0a${f(r)},${f(r)} 0 1,0 ${f(-r * 2)},0Z`, w: r * 2 };
}

/** Elemento sem formato: uma chama/nuvem ondulada */
function blob(x: number, y: number, r: number, rand: Rand): string {
  const pts: Pt[] = [];
  const phase = rand() * Math.PI;
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const rr = r * (1 + 0.16 * Math.sin(a * 5 + phase));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return smoothPath(pts) + 'Z';
}

function drawBeing(b: Being, p: Pose, rand: Rand): string {
  const { x, y, s } = p;
  const colors = b.elements.map(e => COLORS[e] ?? '#888');
  const conceptColors = b.concepts.map(c => COLORS[c] ?? '#888');
  const main = b.merged && colors.length > 1 ? blend(colors) : colors[0] ?? conceptColors[0] ?? '#999';
  const edge = b.merged ? main : colors[1] ?? main;
  let out = '';

  // Aura das runas de conceito (sem forma física, mas o efeito se vê)
  conceptColors.forEach((c, i) => {
    out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * (1.75 + i * 0.3))}" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  });

  // Formatos: em voo, enfileirados com a ponta (Pirâmide) para a frente; parados, lado a lado
  const horizontal = b.placement === 'flight';
  const shapes = horizontal ? [...b.shapes.filter(sh => sh !== 'forma_piramide'), ...b.shapes.filter(sh => sh === 'forma_piramide')] : b.shapes;
  const step = s * 1.45;
  const start = x - ((shapes.length - 1) * step) / 2;
  const centers: Pt[] = shapes.map((_, i) => [start + i * step, y]);
  if (!shapes.length && colors.length) {
    out += `<path d="${blob(x, y, s * 0.95, rand)}" fill="${main}" fill-opacity="0.38" stroke="${edge}" stroke-width="1.8"/>`;
    if (colors.length > 1 && !b.merged) out += `<path d="${blob(x, y, s * 0.5, rand)}" fill="${colors[1]}" fill-opacity="0.5" stroke="none"/>`;
  }
  shapes.forEach((sh, i) => {
    const sp = shapePath(sh, centers[i][0], centers[i][1], s, horizontal, rand);
    out += `<path d="${sp.fill}" fill="${main}" fill-opacity="0.32" stroke="none"/>`;
    out += `<path d="${sp.d}" stroke="${edge}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    // Dois elementos sem mesclar: um núcleo da segunda cor
    if (colors.length > 1 && !b.merged) out += `<circle cx="${f(centers[i][0])}" cy="${f(centers[i][1])}" r="${f(s * 0.28)}" fill="${colors[1]}" fill-opacity="0.65"/>`;
  });

  // Ligação: elos entre as partes (sem misturar)
  if (b.linked && !b.merged) {
    for (let i = 0; i < centers.length - 1; i++) {
      const mx = (centers[i][0] + centers[i + 1][0]) / 2;
      out += `<g stroke="${INK}" stroke-width="1.2" fill="none"><ellipse cx="${f(mx - 2.5)}" cy="${f(y)}" rx="3.2" ry="2"/><ellipse cx="${f(mx + 2.5)}" cy="${f(y)}" rx="3.2" ry="2"/></g>`;
    }
  }

  const half = shapes.length ? (shapes.length * step) / 2 : s;
  // Estado: uma moldura pontilhada que segura o estado
  if (b.estado) {
    out += `<rect x="${f(x - half - 4)}" y="${f(y - s - 5)}" width="${f(half * 2 + 8)}" height="${f(s * 2 + 10)}" rx="7" fill="none" stroke="${INK}" stroke-width="1.1" stroke-dasharray="2 3" opacity="0.75"/>`;
  }
  // D.N. Vertical: travas em cima e embaixo; D.N. Lateral: travas na frente e atrás
  b.guards.forEach(g => {
    if (g === 'vertical') {
      out += `<path d="M${f(x - 7)},${f(y - s - 9)}h14M${f(x - 7)},${f(y + s + 9)}h14" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    } else {
      out += `<path d="M${f(x - half - 9)},${f(y - 6)}v12M${f(x + half + 9)},${f(y - 6)}v12" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    }
  });
  if (b.bond) {
    out += `<text x="${f(x)}" y="${f(y - s - 10)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9" font-weight="700" fill="${MUTED}">«${escapeHtml(b.bond)}»</text>`;
  }
  return `<g class="ap-being"${p.alpha !== undefined ? ` opacity="${p.alpha}"` : ''}>${out}</g>`;
}

const arrowHead = (to: Pt, from: Pt): string => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const l = 6;
  return `M${f(to[0] - Math.cos(a - 0.45) * l)},${f(to[1] - Math.sin(a - 0.45) * l)}L${f(to[0])},${f(to[1])}L${f(to[0] - Math.cos(a + 0.45) * l)},${f(to[1] - Math.sin(a + 0.45) * l)}`;
};

/** Monta a cena inteira */
export function renderAppearanceSvg(ap: Appearance): string {
  const rand = seeded('aparencia');
  let back = '', mid = '', front = '';

  // Chão e a superfície mais distante (só se houver algo lá)
  back += `<path d="${sketchLine([8, GROUND], [352, GROUND], rand, 1)}" stroke="${INK}" stroke-width="1.4" fill="none" opacity="0.8"/>`;
  const far = ap.beings.filter(b => b.placement === 'far');
  if (far.length) back += `<path d="${sketchLine([342, GROUND], [342, 96], rand, 1)}" stroke="${INK}" stroke-width="1.4" fill="none" opacity="0.6"/><text x="338" y="92" text-anchor="end" font-family="Inter, sans-serif" font-size="8" fill="${MUTED}">superfície distante</text>`;
  // Órbita em volta de quem lança: a pessoa vai um pouco para dentro, para a órbita caber
  const aroundCaster = ap.beings.some(b => b.orbit) && !ap.beings.some(b => !b.orbit);
  const cx = aroundCaster ? 80 : 38;
  const CASTER: Pt = [cx, 160];
  const HAND: Pt = [cx + 24, 150];
  back += caster(cx, rand);

  const S = 19;
  const flight = ap.beings.find(b => b.placement === 'flight');
  const flightPos: Pt = [205, 112];
  // Tamanho do objeto em voo (para as escoltas girarem por fora dele)
  const flightHalf = flight ? Math.max(1, flight.shapes.length) * S * 0.75 : S;

  // Onde fica cada ser
  const poses = new Map<Being, Pose>();
  const group = (pl: Being['placement']): Being[] => ap.beings.filter(b => b.placement === pl && !b.orbit);
  // Parado e sólido (Cubo, Paralelepípedo): fica apoiado no chão
  const grounded = (b: Being): boolean => b.shapes.length > 0 && b.shapes.every(sh => sh === 'forma_cubo' || sh === 'forma_paralelepipedo');
  group('front').forEach((b, i) => {
    const tall = b.shapes.includes('forma_paralelepipedo') ? S * 1.35 : S * 0.8;
    poses.set(b, { x: 135 + i * 58, y: grounded(b) ? GROUND - tall - (b.estado ? 6 : 1) : 122 + (i % 2) * 20, s: S });
  });
  group('flight').forEach((b, i) => poses.set(b, { x: flightPos[0] - i * 30, y: flightPos[1] + i * 26, s: S }));
  group('touch').forEach((b, i) => poses.set(b, { x: 92 + i * 40, y: GROUND - S - 2, s: S }));
  group('far').forEach((b, i) => poses.set(b, { x: 318 - (i % 2) * 34, y: GROUND - S - 2 - Math.floor(i / 2) * 36, s: S }));
  group('self').forEach(b => poses.set(b, { x: CASTER[0], y: CASTER[1], s: S * 1.6, alpha: 0.75 }));
  const escorts = group('escort');
  escorts.forEach((b, i) => {
    const a = (i / escorts.length) * Math.PI * 2 - Math.PI / 2;
    poses.set(b, { x: flightPos[0] + Math.cos(a) * (flightHalf + 30), y: flightPos[1] + Math.sin(a) * 42, s: S * 0.55, alpha: Math.sin(a) < 0 ? 0.6 : 1 });
  });

  // Órbita: linha invisível em volta da magia (ou de quem lança), seres divididos igualmente
  const orbiting = ap.beings.filter(b => b.orbit);
  if (orbiting.length) {
    const anchor = ap.beings.find(b => !b.orbit && poses.has(b));
    const c: Pt = anchor ? [poses.get(anchor)!.x, poses.get(anchor)!.y] : [CASTER[0] + 4, CASTER[1] - 12];
    const rx = anchor ? 62 : 58, ry = anchor ? 28 : 26;
    back += `<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${rx}" ry="${ry}" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="3 4" opacity="0.7"/>`;
    orbiting.forEach((b, i) => {
      const a = (i / orbiting.length) * Math.PI * 2 + Math.PI / 2;
      poses.set(b, { x: c[0] + Math.cos(a) * rx, y: c[1] + Math.sin(a) * ry, s: S * 0.8, alpha: Math.sin(a) < 0 ? 0.55 : 1 });
    });
    // seta do giro
    const p1: Pt = [c[0] + rx * 0.7, c[1] - ry * 0.71], p0: Pt = [c[0] + rx * 0.2, c[1] - ry * 0.98];
    back += `<path d="${arrowHead(p1, p0)}" stroke="${INK}" stroke-width="1.2" fill="none" opacity="0.8"/>`;
  }

  // Rastros e setas
  ap.beings.forEach(b => {
    const p = poses.get(b);
    if (!p) return;
    if (b.placement === 'flight') {
      // rastro desde a mão e riscos de velocidade
      mid += `<path d="M${HAND[0] + 4},${HAND[1]} Q${f((HAND[0] + p.x) / 2)},${f(p.y - 30)} ${f(p.x - 34)},${f(p.y)}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="3 4" fill="none"/>`;
      [-7, 0, 7].forEach(dy => { mid += `<path d="M${f(p.x - 52)},${f(p.y + dy)}h${14 - Math.abs(dy)}" stroke="${MUTED}" stroke-width="1.4" stroke-linecap="round"/>`; });
    }
    if (b.placement === 'far') {
      const to: Pt = [p.x - 6, p.y - S - 6];
      mid += `<path d="M${HAND[0] + 4},${HAND[1] - 2} Q${f((HAND[0] + to[0]) / 2)},40 ${f(to[0])},${f(to[1])}" stroke="${MUTED}" stroke-width="1.2" stroke-dasharray="4 4" fill="none"/>`;
      mid += `<path d="${arrowHead(to, [to[0] - 8, to[1] - 14])}" stroke="${MUTED}" stroke-width="1.2" fill="none"/>`;
    }
    if (b.placement === 'touch') {
      mid += `<path d="M${f(p.x - 16)},${GROUND + 5}q4,-4 8,0M${f(p.x + 8)},${GROUND + 5}q4,-4 8,0" stroke="${MUTED}" stroke-width="1.2" fill="none"/>`;
      mid += `<path d="M${HAND[0] + 2},${HAND[1] + 2} Q${f(p.x - 14)},${f(HAND[1] + 4)} ${f(p.x - 8)},${f(p.y - 8)}" stroke="${MUTED}" stroke-width="1.1" stroke-dasharray="2 3" fill="none"/>`;
    }
    if (b.direction === 'forward' && (b.placement === 'front' || b.placement === 'flight')) {
      const from: Pt = [p.x + p.s * 2.4, p.y], to: Pt = [Math.min(p.x + p.s * 2.4 + 34, 350), p.y];
      front += `<path d="M${f(from[0])},${f(from[1])}L${f(to[0])},${f(to[1])}${arrowHead(to, from)}" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    }
    if (b.direction === 'back' || b.placement === 'self') {
      front += `<path d="M${f(CASTER[0] + 34)},${f(CASTER[1] - 40)} Q${f(CASTER[0] + 50)},${f(CASTER[1] - 6)} ${f(CASTER[0] + 20)},${f(CASTER[1] - 2)}${arrowHead([CASTER[0] + 20, CASTER[1] - 2], [CASTER[0] + 40, CASTER[1] - 6])}" stroke="${INK}" stroke-width="1.4" fill="none"/>`;
    }
    if (b.placement === 'escort' && b.concepts.includes('movimento')) {
      // giro em volta do objeto em voo
      back += `<ellipse cx="${flightPos[0]}" cy="${flightPos[1]}" rx="${f(flightHalf + 30)}" ry="42" fill="none" stroke="${COLORS.movimento}" stroke-width="1" stroke-dasharray="3 4" opacity="0.6"/>`;
    }
  });

  // Seres de trás primeiro (os mais apagados), depois os da frente
  const ordered = [...ap.beings].sort((a, b) => (poses.get(a)?.alpha ?? 1) - (poses.get(b)?.alpha ?? 1));
  ordered.forEach(b => { const p = poses.get(b); if (p) mid += drawBeing(b, p, rand); });

  if (!flight && !ap.beings.length) {
    front += `<text x="200" y="120" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${MUTED}">Nada aparece na cena ainda</text>`;
  }
  return back + mid + front;
}

/** Desenha o painel (chamado a cada mudança do círculo) */
export function renderAppearance(m: Model, flow: FlowResult): void {
  const ap = describeAppearance(m, flow);
  const svg = byId('appearanceSvg');
  svg.innerHTML = renderAppearanceSvg(ap);
  // Seres iguais (ex.: as 4 bolas de fogo) viram uma linha só: "4× …"
  const counts = new Map<string, number>();
  ap.beings.map(b => describeBeing(b, ap.orbitCount)).forEach(n => counts.set(n, (counts.get(n) ?? 0) + 1));
  const notes = [...counts].map(([n, c]) => (c > 1 ? `${c}× ${n}` : n));
  const empty = 'Ainda não há elemento nem formato no caminho da energia (que sai do Prisma e volta a ele): nada aparece na cena.';
  svg.setAttribute('aria-label', 'Aparência da magia: ' + (notes.length ? notes.join(' ') : empty));
  byId('appearanceNotes').innerHTML = notes.length
    ? notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')
    : `<li class="muted">${empty}</li>`;
}
