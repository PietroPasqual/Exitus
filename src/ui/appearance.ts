import { describeAppearance, describeBeing, type Appearance, type Being } from '../core/appearance';
import type { Model } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { FlowResult } from '../core/flow';
import { byId } from './dom';
import { jitter, seeded, sketchCircle, sketchLine, sketchPolygon, smoothPath, type Pt, type Rand } from './sketch';

// Aparência da Magia: um desenho, no traço do site, de como a magia ficaria na cena.
// Quem lança fica à esquerda; a frente é para a direita; o chão embaixo.
// Cada elemento tem a sua cor e o seu detalhe (chamas, faíscas, ondas, cristais…);
// os formatos têm volume (luz em cima à esquerda); as runas de conceito viram auras.

/** Cor de cada elemento e runa de conceito */
const COLORS: Record<string, string> = {
  fogo: '#e8590c', raio: '#f2b705', agua: '#1c7ed6', gelo: '#4dabf7', vento: '#20c997', terra: '#8b5a2b',
  metal: '#868e96', som: '#be4bdb', natureza: '#37b24d', acido: '#94c11f', ilusao: '#cc5de8', luz: '#fcc419',
  sombra: '#5c5f66', materia: '#a0522d', gravidade: '#4c6ef5', espaco: '#5f3dc4', vida: '#51cf66', morte: '#495057',
  tempo: '#f59f00', movimento: '#15aabf', pressao: '#4263eb', caos: '#e64980', infinito: '#7950f2', vazio: '#343a40'
};
const INK = 'var(--stroke-circle)';
const MUTED = 'var(--text-muted)';
const GROUND = 194;

const f = (n: number): string => n.toFixed(1);
const pts = (list: Pt[]): string => list.map(p => `${f(p[0])},${f(p[1])}`).join(' ');

// ---------- cores ----------

const rgb = (c: string): number[] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const hex = (v: number[]): string => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const light = (c: string, t: number): string => mix(c, '#ffffff', t);
const dark = (c: string, t: number): string => mix(c, '#000000', t);
/** Mistura de cores (elementos que se mesclam) */
const blend = (colors: string[]): string => hex([0, 1, 2].map(k => colors.reduce((s, c) => s + rgb(c)[k], 0) / colors.length));

/** Gradientes usados no desenho (um por cor), escritos uma vez em <defs> */
class Defs {
  private items = new Map<string, string>();
  sphere(c: string): string {
    const id = `apS${c.slice(1)}`;
    if (!this.items.has(id)) this.items.set(id, `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${light(c, 0.7)}"/><stop offset="0.45" stop-color="${c}"/><stop offset="1" stop-color="${dark(c, 0.35)}"/></radialGradient>`);
    return `url(#${id})`;
  }
  glow(c: string): string {
    const id = `apG${c.slice(1)}`;
    if (!this.items.has(id)) this.items.set(id, `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity="0.45"/><stop offset="0.55" stop-color="${c}" stop-opacity="0.14"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
    return `url(#${id})`;
  }
  flame(c: string): string {
    const id = `apF${c.slice(1)}`;
    if (!this.items.has(id)) this.items.set(id, `<linearGradient id="${id}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="0.6" stop-color="${light(c, 0.35)}"/><stop offset="1" stop-color="${light(c, 0.75)}" stop-opacity="0.8"/></linearGradient>`);
    return `url(#${id})`;
  }
  trail(c: string): string {
    const id = `apT${c.slice(1)}`;
    if (!this.items.has(id)) this.items.set(id, `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="1" stop-color="${c}" stop-opacity="0.55"/></linearGradient>`);
    return `url(#${id})`;
  }
  /** Desfoque para o brilho (luz em volta da energia) */
  blur(sd: number): string {
    const id = `apB${String(sd).replace('.', '_')}`;
    if (!this.items.has(id)) this.items.set(id, `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
    return `url(#${id})`;
  }
  /** Núcleo do fogo: branco no meio, amarelo, laranja e vermelho na borda */
  fireCore(): string {
    const id = 'apFireCore';
    if (!this.items.has(id)) this.items.set(id, `<radialGradient id="${id}" cx="45%" cy="42%" r="62%"><stop offset="0" stop-color="#fffbe6"/><stop offset="0.3" stop-color="#ffd43b"/><stop offset="0.68" stop-color="#f76707"/><stop offset="1" stop-color="#c92a2a"/></radialGradient>`);
    return `url(#${id})`;
  }
  /** Disco mágico: claro no meio */
  disc(c: string): string {
    const id = `apD${c.slice(1)}`;
    if (!this.items.has(id)) this.items.set(id, `<radialGradient id="${id}"><stop offset="0" stop-color="${light(c, 0.85)}"/><stop offset="0.6" stop-color="${light(c, 0.35)}"/><stop offset="1" stop-color="${c}"/></radialGradient>`);
    return `url(#${id})`;
  }
  toString(): string { return `<defs>${[...this.items.values()].join('')}</defs>`; }
}

// ---------- quem lança ----------

/** Mago de capuz, em pé no chão, com a mão estendida para a frente (x = centro do corpo) */
function caster(x: number, glow: string | null, defs: Defs, rand: Rand): string {
  const y0 = GROUND;
  const robe: Pt[] = [[x - 8, 146], [x + 8, 146], [x + 17, y0], [x - 17, y0]];
  const hand: Pt = [x + 26, 151];
  let out = `<ellipse cx="${x}" cy="${y0 + 1}" rx="20" ry="3.2" fill="${INK}" opacity="0.15"/>`;
  out += `<g stroke="#3b2a18" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${pts(robe).split(' ').join('L')}Z" fill="#fbf8f0" stroke="none"/>
    <path d="${sketchPolygon(robe, rand, 0.8)}"/>
    <path d="${sketchLine([x - 3, 152], [x - 6, y0 - 2], rand)}" opacity="0.45"/>
    <path d="${sketchLine([x + 4, 152], [x + 8, y0 - 2], rand)}" opacity="0.45"/>
    <path d="M${x - 10},146 Q${x - 11},128 ${x},124 Q${x + 11},128 ${x + 10},146 Z" fill="#fbf8f0"/>
    <path d="M${x - 3},132 Q${x + 2},128 ${x + 6},134 Q${x + 4},141 ${x - 1},141 Z" fill="#2b2118" opacity="0.9"/>
    <path d="${sketchLine([x + 6, 155], hand, rand)}"/>
  </g>`;
  if (glow) {
    out += `<circle cx="${hand[0] + 2}" cy="${hand[1]}" r="11" fill="${defs.glow(glow)}"/><circle cx="${hand[0] + 2}" cy="${hand[1]}" r="2.2" fill="${light(glow, 0.5)}"/>`;
  }
  return out;
}

// ---------- formatos com volume ----------

interface Solid { svg: string; top: number; bottom: number; left: number; right: number }

function sphere(x: number, y: number, r: number, c: string, defs: Defs, rand: Rand): Solid {
  const svg = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${defs.sphere(c)}"/>
    <path d="${sketchCircle(x, y, r, rand)}" stroke="${dark(c, 0.45)}" stroke-width="1.5" fill="none"/>
    <ellipse cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.4)}" rx="${f(r * 0.28)}" ry="${f(r * 0.17)}" fill="#fff" opacity="0.55" transform="rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.4)})"/>`;
  return { svg, top: y - r, bottom: y + r, left: x - r, right: x + r };
}

/** Caixa (Cubo ou Paralelepípedo) com a frente, o topo e a lateral */
function box(x: number, y: number, w: number, h: number, c: string, rand: Rand): Solid {
  const d = Math.min(w, h) * 0.45; // profundidade
  const fx = x - w / 2 - d / 4, fy = y - h / 2 + d / 4;
  const front: Pt[] = [[fx, fy], [fx + w, fy], [fx + w, fy + h], [fx, fy + h]];
  const top: Pt[] = [[fx, fy], [fx + d, fy - d], [fx + w + d, fy - d], [fx + w, fy]];
  const side: Pt[] = [[fx + w, fy], [fx + w + d, fy - d], [fx + w + d, fy + h - d], [fx + w, fy + h]];
  const ink = dark(c, 0.45);
  const face = (p: Pt[], fill: string): string => `<polygon points="${pts(p)}" fill="${fill}"/><path d="${sketchPolygon(p, rand, 0.5)}" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`;
  const svg = face(front, c) + face(top, light(c, 0.35)) + face(side, dark(c, 0.22))
    + `<path d="M${f(fx + 3)},${f(fy + h - 3)}L${f(fx + 3)},${f(fy + 3)}L${f(fx + w * 0.6)},${f(fy + 3)}" stroke="#fff" stroke-width="1" opacity="0.35" fill="none"/>`;
  return { svg, top: fy - d, bottom: fy + h, left: fx, right: fx + w + d };
}

/** Pirâmide: em pé (duas faces) ou deitada como ponta de lança, para a frente */
function pyramid(x: number, y: number, r: number, c: string, horizontal: boolean, rand: Rand): Solid {
  const ink = dark(c, 0.45);
  const face = (p: Pt[], fill: string): string => `<polygon points="${pts(p)}" fill="${fill}"/><path d="${sketchPolygon(p, rand, 0.5)}" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linejoin="round"/>`;
  if (horizontal) {
    const tip: Pt = [x + r * 1.1, y], up: Pt = [x - r * 0.8, y - r * 0.8], dn: Pt = [x - r * 0.8, y + r * 0.8], mid: Pt = [x - r * 0.55, y + r * 0.08];
    return { svg: face([tip, up, mid], light(c, 0.25)) + face([tip, mid, dn], dark(c, 0.15)), top: y - r * 0.8, bottom: y + r * 0.8, left: x - r * 0.8, right: x + r * 1.1 };
  }
  const apex: Pt = [x + r * 0.1, y - r * 1.05], bl: Pt = [x - r, y + r * 0.75], bm: Pt = [x + r * 0.3, y + r * 0.9], br: Pt = [x + r * 0.95, y + r * 0.6];
  return { svg: face([apex, bl, bm], light(c, 0.15)) + face([apex, bm, br], dark(c, 0.22)), top: apex[1], bottom: bm[1], left: bl[0], right: br[0] };
}

/** Elemento sem formato: uma massa ondulada que brilha */
function blob(x: number, y: number, r: number, c: string, defs: Defs, rand: Rand): Solid {
  const list: Pt[] = [];
  const phase = rand() * Math.PI;
  for (let k = 0; k <= 26; k++) {
    const a = (k / 26) * Math.PI * 2;
    const rr = r * (1 + 0.15 * Math.sin(a * 5 + phase) + jitter(rand, 0.04));
    list.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const d = smoothPath(list) + 'Z';
  return { svg: `<path d="${d}" fill="${defs.sphere(c)}" opacity="0.9"/><path d="${d}" stroke="${dark(c, 0.4)}" stroke-width="1.4" fill="none"/>`, top: y - r, bottom: y + r, left: x - r, right: x + r };
}

// ---------- detalhes de cada elemento ----------

function decorate(el: string, s: Solid, c: string, rand: Rand, flight: boolean, small = false): string {
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const w = s.right - s.left, h = s.bottom - s.top;
  const k = small ? 0.6 : 1;
  switch (el) {
    case 'fogo':
      // as labaredas ficam atrás do corpo (fireCorona); aqui só as brasas subindo
      return Array.from({ length: 4 }, () => `<circle cx="${f(cx + jitter(rand, w * 0.6) - (flight ? w * 0.5 : 0))}" cy="${f(s.top - 8 - rand() * 14)}" r="${f((0.8 + rand() * 1.1) * k)}" fill="${light(c, 0.45)}" opacity="0.85"/>`).join('');
    case 'raio':
      return electricArcs(s, c, rand, k);
    case 'agua':
      return [0, 1].map(i => { const x = s.right + 3 + i * 6, y = cy + 4 + i * 7; return `<path d="M${f(x)},${f(y - 4 * k)} q${f(3 * k)},${f(4 * k)} 0,${f(6 * k)} q${f(-3 * k)},${f(-2 * k)} 0,${f(-6 * k)}Z" fill="${light(c, 0.2)}" stroke="${dark(c, 0.3)}" stroke-width="0.7"/>`; }).join('');
    case 'gelo': {
      const star = (x: number, y: number, r: number): string => `<path d="M${f(x)},${f(y - r)}L${f(x)},${f(y + r)}M${f(x - r)},${f(y)}L${f(x + r)},${f(y)}M${f(x - r * 0.6)},${f(y - r * 0.6)}L${f(x + r * 0.6)},${f(y + r * 0.6)}M${f(x - r * 0.6)},${f(y + r * 0.6)}L${f(x + r * 0.6)},${f(y - r * 0.6)}" stroke="${light(c, 0.35)}" stroke-width="1" />`;
      return star(s.right + 4, s.top + 2, 4 * k) + star(s.left - 4, cy + 4, 3 * k) + star(cx + 6, s.top - 6, 2.5 * k);
    }
    case 'vento':
      return [0, 1, 2].map(i => {
        const y = s.top + h * (0.2 + i * 0.3), x = s.left - 6 - i * 3;
        return `<path d="M${f(x - 14 * k)},${f(y)} q${f(10 * k)},-1 ${f(16 * k)},0 q${f(5 * k)},1 ${f(4 * k)},${f(-4 * k)} q${f(-1 * k)},${f(-3 * k)} ${f(-4 * k)},${f(-1 * k)}" stroke="${dark(c, 0.1)}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.85"/>`;
      }).join('');
    case 'terra':
      return `<circle cx="${f(s.left - 3)}" cy="${f(s.bottom - 2)}" r="${f(2.2 * k)}" fill="${dark(c, 0.15)}"/><circle cx="${f(s.right + 4)}" cy="${f(s.bottom - 4)}" r="${f(1.6 * k)}" fill="${dark(c, 0.15)}"/>`;
    case 'metal':
      return `<path d="M${f(s.right)},${f(s.top - 2)}l3,-3M${f(s.right + 2)},${f(s.top + 2)}l4,0" stroke="${light(c, 0.4)}" stroke-width="1.1"/>`;
    case 'som':
      return [1, 2, 3].map(i => `<path d="M${f(s.right + 3 + i * 4)},${f(cy - 5 - i * 3)} q${f(4 + i)},${f(5 + i * 3)} 0,${f(10 + i * 6)}" stroke="${c}" stroke-width="1.3" fill="none" opacity="${f(1 - i * 0.22)}"/>`).join('');
    case 'natureza':
      return [[s.left - 2, s.top + 2, -30], [s.right + 1, cy, 25]].map(([x, y, a]) => `<path d="M${f(x)},${f(y)} q${f(5 * k)},${f(-6 * k)} ${f(10 * k)},0 q${f(-5 * k)},${f(6 * k)} ${f(-10 * k)},0Z" fill="${light(c, 0.2)}" stroke="${dark(c, 0.3)}" stroke-width="0.8" transform="rotate(${a} ${f(x)} ${f(y)})"/>`).join('');
    case 'acido':
      return [0, 1, 2].map(i => `<circle cx="${f(cx - 6 + i * 7)}" cy="${f(s.top - 4 - i * 4 - rand() * 3)}" r="${f((1.4 + rand() * 1.4) * k)}" fill="none" stroke="${dark(c, 0.1)}" stroke-width="1"/>`).join('')
        + `<path d="M${f(cx + 2)},${f(s.bottom)} q2,4 0,7 q-2,-3 0,-7Z" fill="${c}"/>`;
    case 'ilusao':
      return `<g opacity="0.45" transform="translate(${f(9 * k)} ${f(-5 * k)})"><path d="M${f(s.left)},${f(s.top)}h${f(w)}v${f(h)}h${f(-w)}Z" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/></g>`;
    case 'luz':
      return Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, r1 = Math.max(w, h) * 0.62, r2 = r1 + 6 * k; return `<path d="M${f(cx + Math.cos(a) * r1)},${f(cy + Math.sin(a) * r1)}L${f(cx + Math.cos(a) * r2)},${f(cy + Math.sin(a) * r2)}" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>`; }).join('');
    case 'sombra':
      return [0, 1].map(i => `<path d="M${f(cx - 8 + i * 10)},${f(s.top)} q${f(-6)},-6 0,-11 q6,-4 1,-10" stroke="${c}" stroke-width="2.4" fill="none" opacity="0.4" stroke-linecap="round"/>`).join('');
    case 'materia':
      return Array.from({ length: 7 }, () => `<circle cx="${f(cx + jitter(rand, w * 0.3))}" cy="${f(cy + jitter(rand, h * 0.3))}" r="0.9" fill="${dark(c, 0.45)}"/>`).join('');
    case 'gravidade':
      return [0, 1].map(i => `<path d="M${f(cx - 5)},${f(s.bottom + 4 + i * 5)}l5,4l5,-4" stroke="${c}" stroke-width="1.3" fill="none"/>`).join('');
    case 'espaco':
      return Array.from({ length: 5 }, () => { const a = rand() * Math.PI * 2, r = Math.max(w, h) * (0.65 + rand() * 0.3); return `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r)}" r="${f(0.8 + rand())}" fill="${light(c, 0.3)}"/>`; }).join('');
    default:
      return '';
  }
}

/** Labaredas em volta do objeto (atrás dele): de pé sobem; em voo, ficam para trás */
function fireCorona(s: Solid, c: string, defs: Defs, rand: Rand, flight: boolean): { back: string; front: string } {
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const rx = (s.right - s.left) / 2, ry = (s.bottom - s.top) / 2;
  const tongue = (bx: number, by: number, tx: number, ty: number, wid: number, fill: string, op: number): string => {
    const nx = -(ty - by), ny = tx - bx, len = Math.hypot(nx, ny) || 1;
    const ox = (nx / len) * wid, oy = (ny / len) * wid;
    const m1: Pt = [bx + (tx - bx) * 0.45 + ox * 1.1, by + (ty - by) * 0.45 + oy * 1.1];
    const m2: Pt = [bx + (tx - bx) * 0.45 - ox * 1.1, by + (ty - by) * 0.45 - oy * 1.1];
    return `<path d="M${f(bx + ox)},${f(by + oy)} Q${f(m1[0])},${f(m1[1])} ${f(tx)},${f(ty)} Q${f(m2[0])},${f(m2[1])} ${f(bx - ox)},${f(by - oy)}Z" fill="${fill}" opacity="${op}"/>`;
  };
  let outer = '', inner = '';
  const R = Math.max(rx, ry);
  if (flight) {
    // em voo: línguas compridas saindo da metade de trás
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.55 + (i / 6) * 0.9);
      const bx = cx + Math.cos(a) * rx * 0.92, by = cy + Math.sin(a) * ry * 0.92;
      const reach = R * 1.9 * (0.65 + rand() * 0.6);
      const tx = bx - reach, ty = by + jitter(rand, 3);
      outer += tongue(bx, by, tx, ty, R * 0.24, defs.flame(c), 0.92);
      inner += tongue(bx, by, bx + (tx - bx) * 0.6, by + (ty - by) * 0.6, R * 0.13, light(c, 0.55), 0.85);
    }
  } else {
    // parado: o fogo envolve o objeto e sobe, como uma tocha (mais alto em cima)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + jitter(rand, 0.12);
      const bx = cx + Math.cos(a) * rx * 0.85, by = cy + Math.sin(a) * ry * 0.85;
      const up = (1 - Math.sin(a)) / 2; // 1 em cima, 0 embaixo
      const reach = R * (0.45 + 1.35 * up) * (0.8 + rand() * 0.4);
      const tx = bx + Math.cos(a) * R * 0.25, ty = by - reach;
      outer += tongue(bx, by, tx, ty, R * 0.32, defs.flame(c), 0.9);
      if (up > 0.4) inner += tongue(bx, by, bx + (tx - bx) * 0.55, by + (ty - by) * 0.55, R * 0.16, light(c, 0.55), 0.85);
    }
    outer += tongue(cx, cy - R * 0.4, cx + jitter(rand, 3), cy - R * 2.5, R * 0.42, defs.flame(c), 0.92);
    inner += tongue(cx, cy - R * 0.4, cx, cy - R * 1.7, R * 0.22, light(c, 0.6), 0.9);
    // línguas finas por cima do objeto: ele fica envolto no fogo
    for (let i = 0; i < 5; i++) {
      const bx = cx + (i - 2) * rx * 0.38, by = cy + ry * (0.55 - Math.abs(i - 2) * 0.12);
      inner += `<g opacity="0.55">${tongue(bx, by, bx + jitter(rand, 2), by - R * (0.9 + rand() * 0.5), R * 0.15, light(c, 0.35), 1)}</g>`;
    }
  }
  // em voo, tudo fica atrás do objeto (a cauda); parado, o miolo do fogo fica na frente
  return flight ? { back: `<g class="ap-fire">${outer}${inner}</g>`, front: '' } : { back: `<g class="ap-fire">${outer}</g>`, front: `<g class="ap-fire">${inner}</g>` };
}

/** Raio: arcos elétricos em volta do objeto (amarelo com o miolo branco) */
function electricArcs(s: Solid, c: string, rand: Rand, k: number): string {
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const rx = (s.right - s.left) / 2 + 5, ry = (s.bottom - s.top) / 2 + 5;
  let out = '';
  for (let j = 0; j < 3; j++) {
    const a0 = rand() * Math.PI * 2, span = 1 + rand() * 0.8;
    const list: Pt[] = [];
    for (let t = 0; t <= 6; t++) {
      const a = a0 + (span * t) / 6, rr = 1 + (t % 2 ? 0.18 : -0.05) + jitter(rand, 0.08);
      list.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
    }
    const d = 'M' + list.map(p => `${f(p[0])},${f(p[1])}`).join('L');
    out += `<path d="${d}" stroke="${light(c, 0.1)}" stroke-width="${f(2.2 * k)}" fill="none" stroke-linejoin="round" opacity="0.9"/><path d="${d}" stroke="#fff" stroke-width="0.8" fill="none" stroke-linejoin="round"/>`;
  }
  return out;
}

/** Esfera de fogo: núcleo claro (branco, amarelo, laranja, vermelho na borda) */
function fireSphere(x: number, y: number, r: number, defs: Defs, rand: Rand): Solid {
  const svg = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.25)}" fill="#ffd43b" opacity="0.55" filter="${defs.blur(3)}"/>
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${defs.fireCore()}"/>
    <path d="${sketchCircle(x, y, r, rand)}" stroke="#a61e1e" stroke-width="1.1" fill="none" opacity="0.7"/>`;
  return { svg, top: y - r, bottom: y + r, left: x - r, right: x + r };
}

/** Partículas: em voo, um rastro de faíscas atrás; parado, faíscas em volta subindo */
function particles(s: Solid, c: string, rand: Rand, flight: boolean): string {
  let out = '';
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const w = s.right - s.left, h = s.bottom - s.top;
  for (let i = 0; i < 9; i++) {
    const x = flight ? s.left - 8 - rand() * w * 1.4 : cx + jitter(rand, w * 0.9);
    const y = flight ? cy + jitter(rand, h * 0.7) : cy - h * 0.2 + jitter(rand, h * 0.9);
    const r = 0.9 + rand() * 1.8;
    out += i % 3 === 0
      ? `<path d="M${f(x)},${f(y - r * 1.6)}L${f(x + r)},${f(y)}L${f(x)},${f(y + r * 1.6)}L${f(x - r)},${f(y)}Z" fill="${light(c, 0.2)}" opacity="${f(0.55 + rand() * 0.4)}"/>`
      : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.7)}" fill="${light(c, 0.35)}" opacity="${f(0.5 + rand() * 0.45)}"/>`;
  }
  return out;
}

/** Gelo no chão: espinhos de cristal em volta da base */
function iceSpikes(s: Solid, c: string, rand: Rand): string {
  let out = '';
  const n = 9, w = s.right - s.left + 34, x0 = s.left - 17;
  for (let i = 0; i < n; i++) {
    const x = x0 + (i / (n - 1)) * w, hgt = 12 + rand() * 22 * (1 - Math.abs(i - (n - 1) / 2) / n), lean = jitter(rand, 7) + (i - (n - 1) / 2) * 1.5;
    out += `<path d="M${f(x - 5)},${GROUND} L${f(x + lean)},${f(GROUND - hgt)} L${f(x + 5)},${GROUND}Z" fill="${light(c, 0.35)}" fill-opacity="0.85" stroke="${dark(c, 0.25)}" stroke-width="0.9"/><path d="M${f(x + lean * 0.5)},${f(GROUND - hgt * 0.5)}l0,${f(hgt * 0.4)}" stroke="#fff" stroke-width="0.7" opacity="0.8"/>`;
  }
  return out;
}

/** Terra e metal: pedaços voando (em voo, atrás; no chão, saltando da base) */
function debris(s: Solid, c: string, rand: Rand, flight: boolean, grounded: boolean): string {
  let out = '';
  const cy = (s.top + s.bottom) / 2, w = s.right - s.left, h = s.bottom - s.top;
  for (let i = 0; i < 9; i++) {
    const x = flight ? s.left - 6 - rand() * w * 1.5 : (rand() < 0.5 ? s.left - 4 - rand() * 14 : s.right + 4 + rand() * 14);
    const y = flight ? cy + jitter(rand, h * 0.6) : grounded ? GROUND - 3 - rand() * h * 0.8 : cy + jitter(rand, h * 0.7);
    const r = 1.4 + rand() * 2.4;
    const list: Pt[] = Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * Math.PI * 2 + rand(); return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
    out += `<polygon points="${pts(list)}" fill="${c}" stroke="${dark(c, 0.4)}" stroke-width="0.6" opacity="0.9"/>`;
  }
  if (grounded) out += `<ellipse cx="${f((s.left + s.right) / 2)}" cy="${GROUND - 2}" rx="${f(w * 0.85)}" ry="5" fill="#c8b48e" opacity="0.5"/>`;
  return out;
}

/** Ilusão e sombra: nuvem de fumaça em volta */
function smoke(s: Solid, c: string, defs: Defs, rand: Rand): string {
  let out = '';
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2, w = s.right - s.left, h = s.bottom - s.top;
  for (let i = 0; i < 8; i++) {
    out += `<circle cx="${f(cx + jitter(rand, w * 0.9))}" cy="${f(cy + h * 0.15 + jitter(rand, h * 0.6))}" r="${f(w * (0.3 + rand() * 0.3))}" fill="${light(c, 0.15 + rand() * 0.3)}" opacity="0.55" filter="${defs.blur(2)}"/>`;
  }
  return out;
}

/** Brilhos de energia (estrelinhas de 4 pontas) */
const sparkle = (x: number, y: number, r: number, c: string): string =>
  `<path d="M${f(x)},${f(y - r)} Q${f(x + r * 0.18)},${f(y - r * 0.18)} ${f(x + r)},${f(y)} Q${f(x + r * 0.18)},${f(y + r * 0.18)} ${f(x)},${f(y + r)} Q${f(x - r * 0.18)},${f(y + r * 0.18)} ${f(x - r)},${f(y)} Q${f(x - r * 0.18)},${f(y - r * 0.18)} ${f(x)},${f(y - r)}Z" fill="${c}"/>`;

/** Material de cada elemento na superfície de um formato */
function surface(el: string, s: Solid, c: string, rand: Rand): string {
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const w = s.right - s.left, h = s.bottom - s.top;
  switch (el) {
    case 'gelo':
      // facetas de cristal e um brilho frio
      return `<path d="M${f(cx)},${f(s.top + h * 0.12)}L${f(cx - w * 0.22)},${f(cy)}L${f(cx)},${f(s.bottom - h * 0.12)}L${f(cx + w * 0.22)},${f(cy)}Z M${f(cx - w * 0.22)},${f(cy)}L${f(cx + w * 0.22)},${f(cy)}" stroke="#fff" stroke-width="0.9" fill="#fff" fill-opacity="0.16" opacity="0.85"/>`;
    case 'agua':
      return `<path d="M${f(s.left + w * 0.15)},${f(cy + h * 0.15)} q${f(w * 0.17)},-5 ${f(w * 0.35)},0 t${f(w * 0.35)},0" stroke="#fff" stroke-width="1.3" fill="none" opacity="0.8"/>`
        + [0, 1, 2].map(i => `<circle cx="${f(cx - w * 0.15 + i * w * 0.14)}" cy="${f(cy - h * 0.05 - i * h * 0.08)}" r="${f(1 + i * 0.5)}" fill="none" stroke="#fff" stroke-width="0.8" opacity="0.8"/>`).join('');
    case 'terra':
      return `<path d="M${f(cx - w * 0.22)},${f(s.top + h * 0.28)}l${f(w * 0.13)},${f(h * 0.16)}l${f(-w * 0.06)},${f(h * 0.15)}l${f(w * 0.17)},${f(h * 0.13)}" stroke="${dark(c, 0.55)}" stroke-width="1.1" fill="none"/>`
        + Array.from({ length: 5 }, () => `<circle cx="${f(cx + jitter(rand, w * 0.3))}" cy="${f(cy + jitter(rand, h * 0.3))}" r="${f(0.8 + rand() * 0.8)}" fill="${dark(c, 0.4)}" opacity="0.7"/>`).join('');
    case 'metal':
      return `<path d="M${f(s.left + w * 0.28)},${f(s.top + h * 0.12)}l${f(-w * 0.14)},${f(h * 0.55)}M${f(s.left + w * 0.46)},${f(s.top + h * 0.12)}l${f(-w * 0.1)},${f(h * 0.4)}" stroke="#fff" stroke-width="2.2" opacity="0.65" stroke-linecap="round"/>`;
    default:
      return '';
  }
}

// ---------- auras das runas de conceito ----------

function aura(concept: string, x: number, y: number, r: number, c: string, rand: Rand): string {
  const ring = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-width="1" stroke-dasharray="3 3" opacity="0.8"/>`;
  switch (concept) {
    case 'tempo':
      return ring + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}L${f(x + Math.cos(a) * (r - (i % 3 ? 2.5 : 5)))},${f(y + Math.sin(a) * (r - (i % 3 ? 2.5 : 5)))}" stroke="${c}" stroke-width="1.2"/>`; }).join('');
    case 'movimento':
      return ring + [0, 2.1, 4.2].map(a0 => { const a1 = a0 + 0.9, p0: Pt = [x + Math.cos(a0) * (r + 3), y + Math.sin(a0) * (r + 3)], p1: Pt = [x + Math.cos(a1) * (r + 3), y + Math.sin(a1) * (r + 3)]; return `<path d="M${f(p0[0])},${f(p0[1])}A${f(r + 3)},${f(r + 3)} 0 0,1 ${f(p1[0])},${f(p1[1])}" stroke="${c}" stroke-width="1.6" fill="none"/>${arrowHead(p1, [p1[0] - Math.cos(a1 + Math.PI / 2) * 5, p1[1] - Math.sin(a1 + Math.PI / 2) * 5], c, 1.4)}`; }).join('');
    case 'pressao':
      return ring + [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4, o: Pt = [x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7)], t: Pt = [x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)]; return `<path d="M${f(o[0])},${f(o[1])}L${f(t[0])},${f(t[1])}" stroke="${c}" stroke-width="1.3"/>${arrowHead(t, o, c, 1.3)}`; }).join('');
    case 'caos': {
      const list: Pt[] = [];
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, rr = r * (k % 2 ? 0.82 : 1.12) + jitter(rand, 2); list.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      return `<polygon points="${pts(list)}" fill="${c}" fill-opacity="0.07" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/>`;
    }
    case 'infinito':
      return ring + `<path d="M${f(x)},${f(y - r - 6)} c-5,-6 -12,0 -6,4 c6,4 6,-10 12,-6 c6,4 -1,10 -6,2" stroke="${c}" stroke-width="1.3" fill="none"/>`;
    case 'vazio':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.4"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.72)}" fill="none" stroke="${c}" stroke-width="0.8" stroke-dasharray="2 3" opacity="0.7"/>`;
    case 'vida':
      return ring + `<path d="M${f(x - r)},${f(y + r + 6)}h${f(r * 0.6)}l3,-6l4,11l3,-5h${f(r * 0.6)}" stroke="${c}" stroke-width="1.4" fill="none" stroke-linejoin="round"/>`;
    case 'morte':
      return ring + [0, 1, 2].map(i => `<path d="M${f(x - r * 0.6 + i * r * 0.6)},${f(y - r)} q-4,-6 0,-11 q4,-4 0,-9" stroke="${c}" stroke-width="1.4" fill="none" opacity="0.5" stroke-linecap="round"/>`).join('');
    default:
      return ring;
  }
}

const arrowHead = (to: Pt, from: Pt, color = INK, width = 1.3): string => {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const l = 6;
  return `<path d="M${f(to[0] - Math.cos(a - 0.45) * l)},${f(to[1] - Math.sin(a - 0.45) * l)}L${f(to[0])},${f(to[1])}L${f(to[0] - Math.cos(a + 0.45) * l)},${f(to[1] - Math.sin(a + 0.45) * l)}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
};

// ---------- um ser ----------

interface Pose { x: number; y: number; s: number; alpha?: number }

function drawBeing(b: Being, p: Pose, defs: Defs, rand: Rand): { svg: string; box: Solid } {
  const { x, y, s } = p;
  const colors = b.elements.map(e => COLORS[e] ?? '#888');
  const conceptColors = b.concepts.map(c => COLORS[c] ?? '#888');
  const main = b.merged && colors.length > 1 ? blend(colors) : colors[0] ?? (conceptColors.length ? light(conceptColors[0], 0.55) : '#b8a98a');
  const second = !b.merged && colors.length > 1 ? colors[1] : null;
  const flight = b.placement === 'flight';
  let body = '', deco = '';

  // Formatos: em voo, enfileirados com a ponta (Pirâmide) para a frente; parados, lado a lado
  const shapes = flight ? [...b.shapes.filter(sh => sh !== 'forma_piramide'), ...b.shapes.filter(sh => sh === 'forma_piramide')] : b.shapes;
  const solids: Solid[] = [];
  const widths = shapes.map(sh => (sh === 'forma_paralelepipedo' ? (flight ? s * 2.2 : s * 1.1) : sh === 'forma_piramide' ? s * 1.6 : s * 1.55));
  const total = widths.reduce((a, w) => a + w, 0);
  let cursor = x - total / 2;
  shapes.forEach((sh, i) => {
    const cx = cursor + widths[i] / 2;
    cursor += widths[i];
    let solid: Solid;
    if (sh === 'forma_cubo') solid = box(cx, y, s * 1.3, s * 1.3, main, rand);
    else if (sh === 'forma_paralelepipedo') solid = flight ? box(cx, y, s * 2.1, s * 1.05, main, rand) : box(cx, y, s * 1.05, s * 2.3, main, rand);
    else if (sh === 'forma_piramide') solid = pyramid(cx, y, s * 0.95, main, flight, rand);
    else solid = b.elements[0] === 'fogo' && !b.merged ? fireSphere(cx, y, s * 0.82, defs, rand) : sphere(cx, y, s * 0.82, main, defs, rand);
    solids.push(solid);
    body += solid.svg;
    // Dois elementos sem mesclar: um núcleo da segunda cor
    if (second) body += `<circle cx="${f(cx)}" cy="${f(y)}" r="${f(s * 0.24)}" fill="${defs.sphere(second)}" opacity="0.9"/>`;
  });
  if (!shapes.length && !colors.length && conceptColors.length) {
    // Só runa de conceito: um núcleo de energia translúcido (o efeito se vê, sem forma física)
    const solid = blob(x, y, s * 0.7, light(conceptColors[0], 0.25), defs, rand);
    solids.push(solid);
    body += `<g opacity="0.55">${solid.svg}</g>`;
  }
  if (!shapes.length && colors.length) {
    // Fogo sem formato é uma bola de fogo; os outros elementos, uma massa ondulada
    const solid = b.elements[0] === 'fogo' ? fireSphere(x, y, s * 0.7, defs, rand) : blob(x, y, s * 0.92, main, defs, rand);
    solids.push(solid);
    body += solid.svg;
    if (second) body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.38)}" fill="${defs.sphere(second)}" opacity="0.85"/>`;
  }
  const all: Solid = solids.length
    ? { svg: '', top: Math.min(...solids.map(q => q.top)), bottom: Math.max(...solids.map(q => q.bottom)), left: Math.min(...solids.map(q => q.left)), right: Math.max(...solids.map(q => q.right)) }
    : { svg: '', top: y - s, bottom: y + s, left: x - s, right: x + s };

  // Brilho por trás e o detalhe de cada elemento
  const gcx = (all.left + all.right) / 2;
  const glow = solids.length
    ? `<ellipse cx="${f(gcx)}" cy="${f(y)}" rx="${f((all.right - all.left) / 2 + s * 0.55)}" ry="${f((all.bottom - all.top) / 2 + s * 0.5)}" fill="${light(main, 0.25)}" opacity="0.6" filter="${defs.blur(7)}"/>`
    : '';
  b.elements.forEach((el, i) => { deco += decorate(el, all, COLORS[el] ?? main, rand, flight, i > 0); });

  // Aura das runas de conceito (sem forma física, mas o efeito se vê e se toca)
  let auras = '';
  const R = Math.max(all.right - all.left, all.bottom - all.top) / 2 + 7;
  b.concepts.forEach((cn, i) => { auras += aura(cn, (all.left + all.right) / 2, y, R + i * 6, conceptColors[i], rand); });

  // Ligação: elos entre as partes (sem misturar)
  if (b.linked && !b.merged) {
    for (let i = 0; i < solids.length - 1; i++) {
      const mx = (solids[i].right + solids[i + 1].left) / 2;
      deco += `<g stroke="${INK}" stroke-width="1.3" fill="var(--bg-panel)"><ellipse cx="${f(mx - 2.6)}" cy="${f(y + s * 0.55)}" rx="3.4" ry="2.1"/><ellipse cx="${f(mx + 2.6)}" cy="${f(y + s * 0.55)}" rx="3.4" ry="2.1" fill="none"/></g>`;
    }
  }
  // Estado: uma moldura de selo, pontilhada, que segura o estado
  if (b.estado) {
    deco += `<rect x="${f(all.left - 6)}" y="${f(all.top - 6)}" width="${f(all.right - all.left + 12)}" height="${f(all.bottom - all.top + 12)}" rx="8" fill="none" stroke="${INK}" stroke-width="1.1" stroke-dasharray="1.5 3" opacity="0.8"/>`;
    deco += `<path d="M${f(all.right + 6)},${f(all.top - 6)}m-3,0l3,-3l3,3l-3,3z" fill="${INK}" opacity="0.75"/>`;
  }
  // D.N. Vertical: travas em cima e embaixo; D.N. Lateral: travas na frente e atrás
  b.guards.forEach(g => {
    const midX = (all.left + all.right) / 2;
    deco += g === 'vertical'
      ? `<path d="M${f(midX - 8)},${f(all.top - 10)}h16M${f(midX - 8)},${f(all.bottom + 10)}h16" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M${f(midX)},${f(all.top - 10)}v-4M${f(midX)},${f(all.bottom + 10)}v4" stroke="${INK}" stroke-width="1.2"/>`
      : `<path d="M${f(all.left - 10)},${f(y - 8)}v16M${f(all.right + 10)},${f(y - 8)}v16" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M${f(all.left - 10)},${f(y)}h-4M${f(all.right + 10)},${f(y)}h4" stroke="${INK}" stroke-width="1.2"/>`;
  });
  if (b.bond) {
    deco += `<text x="${f((all.left + all.right) / 2)}" y="${f(all.top - 14)}" text-anchor="middle" font-family="Inter, sans-serif" font-size="9.5" font-weight="700" fill="${INK}" stroke="var(--bg-canvas)" stroke-width="3" paint-order="stroke">✦ «${escapeHtml(b.bond)}»</text>`;
  }
  // Labaredas atrás do corpo; material de cada elemento por cima de cada formato
  const fireIdx = b.elements.indexOf('fogo');
  const corona = fireIdx >= 0 ? fireCorona(all, b.merged ? main : COLORS.fogo, defs, rand, flight) : { back: '', front: '' };
  let surf = '';
  const matEl = b.elements.find(el => ['gelo', 'agua', 'terra', 'metal'].includes(el));
  if (matEl) solids.forEach(q => { surf += surface(matEl, q, COLORS[matEl], rand); });
  // Água e gelo são translúcidos
  const clear = b.elements.length > 0 && b.elements.every(el => el === 'agua' || el === 'gelo');
  if (clear) body = `<g opacity="0.82">${body}</g>`;
  // Brilhos de energia em volta
  let sparks = '';
  if (solids.length && b.elements.length) {
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2, r = Math.max(all.right - all.left, all.bottom - all.top) * (0.6 + rand() * 0.25);
      sparks += sparkle((all.left + all.right) / 2 + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, 2 + rand() * 2, light(main, 0.5));
    }
  }
  // Efeitos de cada elemento: partículas, espinhos de gelo, detritos de terra, fumaça
  let fx = '', under = '';
  const grounded = all.bottom >= GROUND - 10;
  b.elements.forEach(el => {
    const c = COLORS[el] ?? main;
    if (el === 'gelo' && grounded) under += iceSpikes(all, c, rand);
    if (el === 'terra' || el === 'metal') fx += debris(all, el === 'terra' ? '#7a5230' : '#868e96', rand, flight, grounded);
    if (el === 'ilusao' || el === 'sombra') under += smoke(all, c, defs, rand);
    if (el !== 'terra' && el !== 'metal') fx += particles(all, c, rand, flight);
  });
  if (fireIdx >= 0) fx += `<g filter="${defs.blur(2.5)}" opacity="0.7">${corona.back}</g>`;
  if (b.elements.includes('raio')) fx += `<g filter="${defs.blur(2)}" opacity="0.8">${electricArcs(all, COLORS.raio, rand, 1.3)}</g>`;
  const svg = `<g class="ap-being"${p.alpha !== undefined ? ` opacity="${p.alpha}"` : ''}>${glow}${under}${auras}${corona.back}${body}${corona.front}${surf}${deco}${fx}${sparks}</g>`;
  return { svg, box: all };
}

// ---------- o cenário ----------

/**
 * Fundo da cena, como uma ilustração: céu (de dia nos temas claros, de noite no Grimório),
 * duas camadas de montanhas, chão de terra com grama e pedras; um monte de pedras quando a
 * magia vai para a superfície distante e um boneco de treino quando ela vai para a frente.
 */
function scenery(rand: Rand, wall: boolean, target: boolean): string {
  let out = '';
  const cloud = (x: number, y: number, k: number): string =>
    `<path d="M${f(x)},${f(y)} q${f(2 * k)},${f(-7 * k)} ${f(9 * k)},${f(-5 * k)} q${f(4 * k)},${f(-7 * k)} ${f(12 * k)},${f(-2 * k)} q${f(8 * k)},${f(-2 * k)} ${f(9 * k)},${f(5 * k)} q${f(6 * k)},${f(1 * k)} ${f(3 * k)},${f(4 * k)}Z" fill="#fffdf6" fill-opacity="0.85" stroke="#5c4a32" stroke-width="1" stroke-opacity="0.55"/>`;
  out += `<g class="ap-day">
    <circle cx="306" cy="34" r="16" fill="#ffe066" opacity="0.35"/>
    <circle cx="306" cy="34" r="10.5" fill="#ffd43b" stroke="#f08c00" stroke-width="1.2"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${f(306 + Math.cos(a) * 14)},${f(34 + Math.sin(a) * 14)}L${f(306 + Math.cos(a) * (i % 2 ? 18 : 21))},${f(34 + Math.sin(a) * (i % 2 ? 18 : 21))}" stroke="#f08c00" stroke-width="1.3" stroke-linecap="round"/>`; }).join('')}
    ${cloud(150, 34, 1.3)}${cloud(232, 54, 0.9)}${cloud(48, 46, 0.85)}
  </g>`;
  let stars = '';
  for (let i = 0; i < 26; i++) stars += `<circle cx="${f(10 + rand() * 340)}" cy="${f(8 + rand() * 90)}" r="${f(0.5 + rand() * 0.9)}" fill="#fff" opacity="${f(0.35 + rand() * 0.5)}"/>`;
  out += `<g class="ap-night">${stars}<path d="M300,20 a13,13 0 1,0 12,20 a10,10 0 1,1 -12,-20Z" fill="#ffe8a3" opacity="0.9"/></g>`;

  // Montanhas: picos ao longe e uma serra mais perto (azul-acinzentadas de dia, escuras à noite)
  const range = (base: number, peaks: number[][]): string => {
    let d = `M0,${base}`;
    peaks.forEach(([x, y]) => { d += ` L${f(x + jitter(rand, 2))},${f(y)}`; });
    return d + ` L360,${base} L360,${GROUND} L0,${GROUND}Z`;
  };
  const farD = range(160, [[18, 140], [44, 150], [78, 118], [104, 136], [128, 128], [160, 148], [196, 112], [228, 138], [258, 124], [290, 144], [318, 120], [346, 142]]);
  const nearD = range(178, [[20, 166], [58, 156], [96, 170], [140, 152], [184, 168], [226, 156], [270, 170], [312, 158], [350, 168]]);
  // neve nos picos mais altos
  const snow = [[78, 118], [196, 112], [318, 120]].map(([x, y]) => `<path d="M${x - 9},${y + 11} L${x},${y} L${x + 9},${y + 12} L${x + 4},${y + 9} L${x},${y + 13} L${x - 4},${y + 9}Z" fill="#fff" opacity="0.75"/>`).join('');
  out += `<g class="ap-day"><path d="${farD}" fill="#c3cbd6"/><path d="${farD}" fill="none" stroke="#8792a1" stroke-width="0.9"/>${snow}<path d="${nearD}" fill="#aab4c1"/><path d="${nearD}" fill="none" stroke="#7a8595" stroke-width="0.9"/></g>`;
  out += `<g class="ap-night"><path d="${farD}" fill="#2c3554"/><path d="${nearD}" fill="#232b47"/><path d="${nearD}" fill="none" stroke="#4a5577" stroke-width="0.9"/></g>`;

  // Chão: terra, linha do chão, grama verde e pedras
  out += `<g class="ap-day"><rect x="0" y="${GROUND}" width="360" height="${210 - GROUND}" fill="#d9bf8c"/></g>`;
  out += `<g class="ap-night"><rect x="0" y="${GROUND}" width="360" height="${210 - GROUND}" fill="#1d2338"/></g>`;
  out += `<path d="${sketchLine([2, GROUND], [358, GROUND], rand, 1)}" stroke="${INK}" stroke-width="1.6" fill="none" opacity="0.85"/>`;
  let grass = '';
  for (let i = 0; i < 13; i++) {
    const gx = 10 + i * 27 + jitter(rand, 9), hgt = 5 + rand() * 6;
    grass += `<path d="M${f(gx - 4)},${GROUND} q1,${f(-hgt * 0.7)} -2,${f(-hgt)} M${f(gx)},${GROUND} q0,${f(-hgt)} 1,${f(-hgt - 3)} M${f(gx + 4)},${GROUND} q-1,${f(-hgt * 0.7)} 3,${f(-hgt)}" stroke-linecap="round"/>`;
  }
  out += `<g class="ap-day" stroke="#5c940d" stroke-width="1.5" fill="none">${grass}</g><g class="ap-night" stroke="#2f6b46" stroke-width="1.5" fill="none">${grass}</g>`;
  const stone = (x: number, y: number, r: number): string => {
    const list: Pt[] = Array.from({ length: 7 }, (_, k) => { const a = Math.PI + (k / 6) * Math.PI; return [x + Math.cos(a) * r * (0.85 + rand() * 0.3), y + Math.sin(a) * r * (0.7 + rand() * 0.3)]; });
    return `<polygon points="${pts(list)}" fill="#9a9488" stroke="#4d4a44" stroke-width="0.9"/><path d="M${f(x - r * 0.4)},${f(y - r * 0.5)}l${f(r * 0.3)},${f(-r * 0.15)}" stroke="#fff" stroke-width="0.8" opacity="0.5"/>`;
  };
  out += stone(24, GROUND + 0.5, 6) + stone(150, GROUND + 0.5, 4) + stone(262, GROUND + 0.5, 5);
  for (let i = 0; i < 8; i++) out += `<ellipse cx="${f(14 + i * 46 + jitter(rand, 10))}" cy="${f(GROUND + 7 + rand() * 6)}" rx="${f(1.8 + rand() * 2)}" ry="${f(1 + rand())}" fill="#7a6a52" opacity="0.45"/>`;

  // Monte de pedras: a superfície mais distante
  if (wall) {
    const boulder = (x: number, y: number, r: number, shade: string): string => {
      const list: Pt[] = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return [x + Math.cos(a) * r * (0.8 + rand() * 0.35), y + Math.sin(a) * r * (0.75 + rand() * 0.3)]; });
      return `<polygon points="${pts(list)}" fill="${shade}" stroke="#3f3b35" stroke-width="1.1" stroke-linejoin="round"/><path d="M${f(x - r * 0.5)},${f(y - r * 0.4)} l${f(r * 0.4)},${f(-r * 0.2)}" stroke="#fff" stroke-width="0.9" opacity="0.45"/>`;
    };
    out += boulder(352, GROUND - 52, 16, '#8f8a80') + boulder(338, GROUND - 30, 18, '#a39e93') + boulder(356, GROUND - 22, 15, '#8a857b')
      + boulder(322, GROUND - 12, 13, '#b0aa9e') + boulder(344, GROUND - 8, 11, '#958f84') + boulder(350, GROUND - 76, 12, '#a39e93');
  }

  // Boneco de treino: o alvo, quando a magia vai para a frente
  if (target) {
    const x = 330;
    out += `<ellipse cx="${x}" cy="${GROUND + 1}" rx="12" ry="2.6" fill="#000" opacity="0.15"/>
      <g stroke="#4a3520" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
        <rect x="${x - 2}" y="132" width="4" height="${GROUND - 132}" fill="#8b5e34"/>
        <rect x="${x - 15}" y="146" width="30" height="4" rx="1.5" fill="#8b5e34"/>
        <circle cx="${x}" cy="126" r="8" fill="#e9c46a"/>
        <path d="M${x - 6},120 l-4,-5 M${x + 6},120 l4,-5 M${x},118 l0,-6 M${x - 3},119 l-1,-6 M${x + 3},119 l1,-6" stroke="#c99a2e" stroke-width="1.1"/>
        <rect x="${x - 10}" y="142" width="20" height="26" rx="3" fill="#e0b96a"/>
        <circle cx="${x}" cy="155" r="7" fill="#fff" stroke="#c92a2a" stroke-width="1.4"/><circle cx="${x}" cy="155" r="4" fill="none" stroke="#c92a2a" stroke-width="1.2"/><circle cx="${x}" cy="155" r="1.6" fill="#c92a2a" stroke="none"/>
      </g>`;
  }

  // Moldura: cantos enfeitados, como os losangos dos anéis
  const corner = (x: number, y: number, sx: number, sy: number): string =>
    `<path d="M${x},${y + sy * 16} L${x},${y} L${x + sx * 16},${y}" stroke="#6b4b2a" stroke-width="1.6" fill="none"/><path d="M${x + sx * 5},${y + sy * 5} m0,-3 l3,3 l-3,3 l-3,-3z" fill="#a8742e"/>`;
  out += corner(5, 5, 1, 1) + corner(355, 5, -1, 1) + corner(5, 205, 1, -1) + corner(355, 205, -1, -1);
  return out;
}

// ---------- a cena ----------

/** Monta a cena inteira */
export function renderAppearanceSvg(ap: Appearance, title = ''): string {
  const rand = seeded('aparencia');
  const defs = new Defs();
  let back = '', mid = '', front = '';

  const far = ap.beings.filter(b => b.placement === 'far');
  const aimed = !far.length && ap.beings.some(b => b.direction === 'forward' || b.placement === 'flight');
  back += scenery(rand, far.length > 0, aimed);

  // Órbita em volta de quem lança: a pessoa vai um pouco para dentro, para a órbita caber
  const aroundCaster = ap.beings.some(b => b.orbit) && !ap.beings.some(b => !b.orbit);
  const cx = aroundCaster ? 84 : 40;
  const CASTER: Pt = [cx, 160];
  const HAND: Pt = [cx + 28, 151];
  const firstColor = ap.beings.flatMap(b => b.elements)[0];
  back += caster(cx, firstColor ? COLORS[firstColor] ?? null : null, defs, rand);

  const S = 22;
  const flight = ap.beings.find(b => b.placement === 'flight');
  const flightPos: Pt = [214, 110];
  const flightHalf = flight ? Math.max(1, flight.shapes.length) * S * 0.8 : S;

  // Onde fica cada ser
  const poses = new Map<Being, Pose>();
  const group = (pl: Being['placement']): Being[] => ap.beings.filter(b => b.placement === pl && !b.orbit);
  // Parado e sólido (Cubo, Paralelepípedo): fica apoiado no chão
  const grounded = (b: Being): boolean => b.shapes.length > 0 && b.shapes.every(sh => sh === 'forma_cubo' || sh === 'forma_paralelepipedo');
  group('front').forEach((b, i) => {
    const half = b.shapes.includes('forma_paralelepipedo') ? S * 1.15 : S * 0.55;
    poses.set(b, { x: 140 + i * 62, y: grounded(b) ? GROUND - half - 3 : 120 + (i % 2) * 22, s: S });
  });
  group('flight').forEach((b, i) => poses.set(b, { x: flightPos[0] - i * 30, y: flightPos[1] + i * 26, s: S }));
  group('touch').forEach((b, i) => poses.set(b, { x: cx + 82 + i * 46, y: GROUND - S + 2, s: S }));
  group('far').forEach((b, i) => poses.set(b, { x: 296 - (i % 2) * 36, y: GROUND - S + 2 - Math.floor(i / 2) * 38, s: S }));
  group('self').forEach(b => poses.set(b, { x: CASTER[0], y: CASTER[1] - 4, s: S * 1.5, alpha: 0.72 }));
  const escorts = group('escort');
  escorts.forEach((b, i) => {
    const a = (i / escorts.length) * Math.PI * 2 - Math.PI / 2;
    poses.set(b, { x: flightPos[0] + Math.cos(a) * (flightHalf + 30), y: flightPos[1] + Math.sin(a) * 44, s: S * 0.6, alpha: Math.sin(a) < -0.2 ? 0.62 : 1 });
  });

  // Órbita: linha invisível em volta da magia (ou de quem lança), seres divididos igualmente
  const orbiting = ap.beings.filter(b => b.orbit);
  let orbitFront = '';
  const ringHalves = (c: Pt, rx: number, ry: number, color: string): void => {
    back += `<path d="M${f(c[0] - rx)},${f(c[1])}A${rx},${ry} 0 0,1 ${f(c[0] + rx)},${f(c[1])}" stroke="${color}" stroke-width="1.2" stroke-dasharray="3 4" fill="none" opacity="0.6"/>`;
    orbitFront += `<path d="M${f(c[0] + rx)},${f(c[1])}A${rx},${ry} 0 0,1 ${f(c[0] - rx)},${f(c[1])}" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 4" fill="none" opacity="0.85"/>`;
    const p1: Pt = [c[0] + rx * 0.72, c[1] - ry * 0.69], p0: Pt = [c[0] + rx * 0.3, c[1] - ry * 0.95];
    back += arrowHead(p1, p0, color, 1.3);
  };
  if (orbiting.length) {
    const anchor = ap.beings.find(b => !b.orbit && poses.has(b));
    const c: Pt = anchor ? [poses.get(anchor)!.x, poses.get(anchor)!.y] : [CASTER[0] + 4, CASTER[1] - 14];
    const rx = anchor ? 64 : 62, ry = anchor ? 28 : 26;
    ringHalves(c, rx, ry, INK);
    orbiting.forEach((b, i) => {
      const a = (i / orbiting.length) * Math.PI * 2 + Math.PI / 2;
      poses.set(b, { x: c[0] + Math.cos(a) * rx, y: c[1] + Math.sin(a) * ry, s: S * 0.78, alpha: Math.sin(a) < -0.2 ? 0.6 : 1 });
    });
  }
  if (escorts.some(b => b.concepts.includes('movimento'))) ringHalves(flightPos, flightHalf + 30, 44, COLORS.movimento);

  // Sombras no chão (quanto mais alto, mais clara)
  ap.beings.forEach(b => {
    const p = poses.get(b);
    if (!p || b.placement === 'self') return;
    const height = Math.max(0, GROUND - p.y);
    back += `<ellipse cx="${f(p.x)}" cy="${GROUND + 1}" rx="${f(p.s * (1.2 - height / 260))}" ry="2.6" fill="${INK}" opacity="${f(Math.max(0.05, 0.22 - height / 600))}"/>`;
  });

  // Desenha os seres (os de trás primeiro, mais apagados) e guarda o tamanho de cada um
  const boxes = new Map<Being, Solid>();
  const ordered = [...ap.beings].sort((a, b) => (poses.get(a)?.alpha ?? 1) - (poses.get(b)?.alpha ?? 1));
  const drawn: string[] = [];
  ordered.forEach(b => {
    const p = poses.get(b);
    if (!p) return;
    const r = drawBeing(b, p, defs, rand);
    boxes.set(b, r.box);
    drawn.push(r.svg);
  });

  // Rastros, impactos e setas
  ap.beings.forEach(b => {
    const p = poses.get(b);
    const bx = boxes.get(b);
    if (!p || !bx) return;
    const color = COLORS[b.elements[0]] ?? COLORS[b.concepts[0]] ?? '#999';
    if (b.placement === 'flight') {
      // cauda colorida desde a mão, afinando, e riscos de velocidade
      const start: Pt = [HAND[0] + 4, HAND[1]], end: Pt = [bx.left - 4, p.y];
      const ctl: Pt = [(start[0] + end[0]) / 2, Math.min(start[1], end[1]) - 26];
      mid += `<path d="M${f(start[0])},${f(start[1])} Q${f(ctl[0])},${f(ctl[1])} ${f(end[0])},${f(end[1] - 5)} L${f(end[0])},${f(end[1] + 5)} Q${f(ctl[0])},${f(ctl[1] + 8)} ${f(start[0])},${f(start[1] + 1)}Z" fill="${defs.trail(color)}"/>`;
      mid += `<path d="M${f(start[0])},${f(start[1])} Q${f(ctl[0])},${f(ctl[1])} ${f(end[0])},${f(end[1])}" stroke="${MUTED}" stroke-width="1" stroke-dasharray="2 4" fill="none"/>`;
      [-8, 0, 8].forEach(dy => { mid += `<path d="M${f(bx.left - 30)},${f(p.y + dy)}h${16 - Math.abs(dy)}" stroke="${MUTED}" stroke-width="1.4" stroke-linecap="round"/>`; });
    }
    if (b.placement === 'far') {
      const to: Pt = [p.x - 4, bx.top - 8];
      mid += `<path d="M${HAND[0] + 4},${HAND[1] - 2} Q${f((HAND[0] + to[0]) / 2)},36 ${f(to[0])},${f(to[1])}" stroke="${color}" stroke-width="1.4" stroke-dasharray="4 4" fill="none" opacity="0.8"/>`;
      mid += arrowHead(to, [to[0] - 6, to[1] - 14], color, 1.4);
      // impacto na superfície distante
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI, r1 = (bx.right - bx.left) / 2 + 5, r2 = r1 + 6 + (i % 2) * 4;
        front += `<path d="M${f(p.x + Math.cos(a) * r1)},${f(GROUND - 1 + Math.sin(a) * r1 * 0.9)}L${f(p.x + Math.cos(a) * r2)},${f(GROUND - 1 + Math.sin(a) * r2 * 0.9)}" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>`;
      }
    }
    if (b.placement === 'touch') {
      front += `<path d="M${f(p.x - 22)},${GROUND + 6}q5,-5 10,0M${f(p.x + 12)},${GROUND + 6}q5,-5 10,0M${f(p.x - 8)},${GROUND + 9}q8,-5 16,0" stroke="${color}" stroke-width="1.3" fill="none" opacity="0.8"/>`;
      mid += `<path d="M${HAND[0] + 2},${HAND[1] + 2} Q${f(p.x - 12)},${f(HAND[1] + 2)} ${f(bx.left)},${f(bx.top + 4)}" stroke="${MUTED}" stroke-width="1.1" stroke-dasharray="2 3" fill="none"/>`;
    }
    if (b.direction === 'forward' && (b.placement === 'front' || b.placement === 'flight')) {
      const from: Pt = [bx.right + 10, p.y], to: Pt = [Math.min(bx.right + 46, 352), p.y];
      front += `<path d="M${f(from[0])},${f(from[1])}L${f(to[0])},${f(to[1])}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>${arrowHead(to, from, INK, 1.6)}`;
    }
    if (b.direction === 'back' || b.placement === 'self') {
      const tip: Pt = [CASTER[0] + 14, CASTER[1] - 6];
      front += `<path d="M${f(CASTER[0] + 54)},${f(CASTER[1] - 46)} Q${f(CASTER[0] + 58)},${f(CASTER[1] - 8)} ${f(tip[0])},${f(tip[1])}" stroke="${INK}" stroke-width="1.5" fill="none"/>${arrowHead(tip, [CASTER[0] + 34, CASTER[1] - 8], INK, 1.5)}`;
    }
  });

  // Disco mágico na mão de quem lança, brilhando na cor da magia
  if (ap.beings.length && firstColor) {
    const c = COLORS[firstColor] ?? '#999', hx = HAND[0] + 10, hy = HAND[1] - 2;
    let ticks = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ticks += `<path d="M${f(hx + Math.cos(a) * 6.2)},${f(hy + Math.sin(a) * 15.5)}L${f(hx + Math.cos(a) * 7.6)},${f(hy + Math.sin(a) * 19)}" stroke="${dark(c, 0.15)}" stroke-width="1"/>`;
    }
    front += `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="13" ry="27" fill="${light(c, 0.2)}" opacity="0.7" filter="${defs.blur(5)}"/>`
      + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="8" ry="20" fill="${defs.disc(c)}" stroke="${dark(c, 0.1)}" stroke-width="1.8"/>`
      + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="5" ry="12.5" fill="none" stroke="${dark(c, 0.2)}" stroke-width="1" stroke-dasharray="2 2"/>`
      + ticks + `<path d="M${f(hx)},${f(hy - 8)}L${f(hx + 3)},${f(hy)}L${f(hx)},${f(hy + 8)}L${f(hx - 3)},${f(hy)}Z" fill="#fff" stroke="${dark(c, 0.2)}" stroke-width="0.9"/>`;
  }
  mid += drawn.join('') + orbitFront;
  if (!ap.beings.length) {
    front += `<text x="200" y="118" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${MUTED}">Nada aparece na cena ainda</text>`;
  }
  if (title) {
    const t = escapeHtml(title.toUpperCase());
    const text = (fill: string, halo: string, cls: string): string => `<text class="${cls}" x="16" y="22" font-family="Cinzel, serif" font-size="11.5" font-weight="700" letter-spacing="0.6" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${t}</text>`;
    front += text('#3b2a18', '#f5ecd8', 'ap-day') + text('#f5ecd8', '#121624', 'ap-night');
  }
  return defs.toString() + back + mid + front;
}

/** Desenha o painel (chamado a cada mudança do círculo) */
export function renderAppearance(m: Model, flow: FlowResult, title = ''): void {
  const ap = describeAppearance(m, flow);
  const svg = byId('appearanceSvg');
  svg.innerHTML = renderAppearanceSvg(ap, title);
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
