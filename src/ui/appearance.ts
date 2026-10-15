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
  toString(): string { return `<defs>${[...this.items.values()].join('')}</defs>`; }
}

// ---------- quem lança ----------

/** Mago de capuz, em pé no chão, com a mão estendida para a frente (x = centro do corpo) */
function caster(x: number, glow: string | null, defs: Defs, rand: Rand): string {
  const y0 = GROUND;
  const robe: Pt[] = [[x - 8, 146], [x + 8, 146], [x + 17, y0], [x - 17, y0]];
  const hand: Pt = [x + 26, 151];
  let out = `<ellipse cx="${x}" cy="${y0 + 1}" rx="20" ry="3.2" fill="${INK}" opacity="0.15"/>`;
  out += `<g stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${pts(robe).split(' ').join('L')}Z" fill="var(--bg-panel)" stroke="none"/>
    <path d="${sketchPolygon(robe, rand, 0.8)}"/>
    <path d="${sketchLine([x - 3, 152], [x - 6, y0 - 2], rand)}" opacity="0.45"/>
    <path d="${sketchLine([x + 4, 152], [x + 8, y0 - 2], rand)}" opacity="0.45"/>
    <path d="M${x - 10},146 Q${x - 11},128 ${x},124 Q${x + 11},128 ${x + 10},146 Z" fill="var(--bg-panel)"/>
    <path d="M${x - 3},132 Q${x + 2},128 ${x + 6},134 Q${x + 4},141 ${x - 1},141 Z" fill="${INK}" opacity="0.85"/>
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

function flames(cx: number, top: number, w: number, c: string, defs: Defs, rand: Rand): string {
  let out = '';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const h = 9 + rand() * 7;
    const x = cx + (i - (n - 1) / 2) * (w / n) + jitter(rand, 1.5);
    out += `<path d="M${f(x - 4)},${f(top + 2)} Q${f(x - 5)},${f(top - h * 0.5)} ${f(x + jitter(rand, 2))},${f(top - h)} Q${f(x + 5)},${f(top - h * 0.45)} ${f(x + 4)},${f(top + 2)}Z" fill="${defs.flame(c)}" stroke="${dark(c, 0.2)}" stroke-width="0.8"/>`;
  }
  // brasas subindo
  for (let i = 0; i < 3; i++) out += `<circle cx="${f(cx + jitter(rand, w / 2))}" cy="${f(top - 14 - rand() * 10)}" r="${f(0.9 + rand())}" fill="${light(c, 0.3)}" opacity="0.8"/>`;
  return out;
}

function decorate(el: string, s: Solid, c: string, defs: Defs, rand: Rand, flight: boolean, small = false): string {
  const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
  const w = s.right - s.left, h = s.bottom - s.top;
  const k = small ? 0.6 : 1;
  switch (el) {
    case 'fogo':
      return flight ? flamesBack(s, c, defs, rand) : flames(cx, s.top, w, c, defs, rand);
    case 'raio': {
      const bolt = (x: number, y: number, dx: number, dy: number): string => `<path d="M${f(x)},${f(y)}l${f(dx * 0.4)},${f(dy * 0.35)}l${f(-dx * 0.25)},${f(dy * 0.1)}l${f(dx * 0.85)},${f(dy * 0.55)}" stroke="${light(c, 0.2)}" stroke-width="${f(1.8 * k)}" fill="none" stroke-linejoin="round"/><path d="M${f(x)},${f(y)}l${f(dx * 0.4)},${f(dy * 0.35)}l${f(-dx * 0.25)},${f(dy * 0.1)}l${f(dx * 0.85)},${f(dy * 0.55)}" stroke="#fff" stroke-width="0.7" fill="none"/>`;
      return bolt(s.right - 2, s.top + 2, 12 * k, -12 * k) + bolt(s.left + 2, s.bottom - 2, -11 * k, 11 * k) + bolt(cx - 4, s.top + 3, 4 * k, -12 * k);
    }
    case 'agua':
      return `<path d="M${f(s.left + w * 0.18)},${f(cy + h * 0.12)} q${f(w * 0.16)},-5 ${f(w * 0.32)},0 t${f(w * 0.32)},0" stroke="#fff" stroke-width="1.3" fill="none" opacity="0.75"/>`
        + [0, 1].map(i => { const x = s.right + 3 + i * 6, y = cy + 4 + i * 7; return `<path d="M${f(x)},${f(y - 4 * k)} q${f(3 * k)},${f(4 * k)} 0,${f(6 * k)} q${f(-3 * k)},${f(-2 * k)} 0,${f(-6 * k)}Z" fill="${light(c, 0.2)}" stroke="${dark(c, 0.3)}" stroke-width="0.7"/>`; }).join('');
    case 'gelo': {
      const star = (x: number, y: number, r: number): string => `<path d="M${f(x)},${f(y - r)}L${f(x)},${f(y + r)}M${f(x - r)},${f(y)}L${f(x + r)},${f(y)}M${f(x - r * 0.6)},${f(y - r * 0.6)}L${f(x + r * 0.6)},${f(y + r * 0.6)}M${f(x - r * 0.6)},${f(y + r * 0.6)}L${f(x + r * 0.6)},${f(y - r * 0.6)}" stroke="${light(c, 0.35)}" stroke-width="1" />`;
      return `<path d="M${f(cx)},${f(s.top + h * 0.2)}L${f(cx - w * 0.18)},${f(cy)}L${f(cx)},${f(s.bottom - h * 0.2)}L${f(cx + w * 0.18)},${f(cy)}Z" stroke="#fff" stroke-width="0.9" fill="#fff" fill-opacity="0.18" opacity="0.8"/>`
        + star(s.right + 4, s.top + 2, 4 * k) + star(s.left - 4, cy + 4, 3 * k) + star(cx + 6, s.top - 6, 2.5 * k);
    }
    case 'vento':
      return [0, 1, 2].map(i => {
        const y = s.top + h * (0.2 + i * 0.3), x = s.left - 6 - i * 3;
        return `<path d="M${f(x - 14 * k)},${f(y)} q${f(10 * k)},-1 ${f(16 * k)},0 q${f(5 * k)},1 ${f(4 * k)},${f(-4 * k)} q${f(-1 * k)},${f(-3 * k)} ${f(-4 * k)},${f(-1 * k)}" stroke="${dark(c, 0.1)}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.85"/>`;
      }).join('');
    case 'terra':
      return `<path d="M${f(cx - w * 0.2)},${f(s.top + h * 0.3)}l${f(w * 0.12)},${f(h * 0.15)}l${f(-w * 0.05)},${f(h * 0.15)}l${f(w * 0.15)},${f(h * 0.12)}" stroke="${dark(c, 0.55)}" stroke-width="1.1" fill="none"/>`
        + `<circle cx="${f(s.left - 3)}" cy="${f(s.bottom - 2)}" r="${f(2.2 * k)}" fill="${dark(c, 0.15)}"/><circle cx="${f(s.right + 4)}" cy="${f(s.bottom - 4)}" r="${f(1.6 * k)}" fill="${dark(c, 0.15)}"/>`;
    case 'metal':
      return `<path d="M${f(s.left + w * 0.3)},${f(s.top + h * 0.15)}l${f(-w * 0.15)},${f(h * 0.5)}M${f(s.left + w * 0.5)},${f(s.top + h * 0.15)}l${f(-w * 0.12)},${f(h * 0.4)}" stroke="#fff" stroke-width="2" opacity="0.6" stroke-linecap="round"/>`
        + `<path d="M${f(s.right)},${f(s.top - 2)}l3,-3M${f(s.right + 2)},${f(s.top + 2)}l4,0" stroke="${light(c, 0.4)}" stroke-width="1.1"/>`;
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

/** Fogo em voo: língua de fogo saindo para trás do objeto */
function flamesBack(s: Solid, c: string, defs: Defs, rand: Rand): string {
  const cy = (s.top + s.bottom) / 2, h = s.bottom - s.top;
  let out = '';
  [-0.28, 0, 0.28].forEach((t, i) => {
    const y = cy + t * h, len = 16 + (i === 1 ? 8 : 0) + rand() * 4;
    out += `<path d="M${f(s.left + 2)},${f(y - 4)} Q${f(s.left - len * 0.5)},${f(y - 5)} ${f(s.left - len)},${f(y + jitter(rand, 2))} Q${f(s.left - len * 0.5)},${f(y + 5)} ${f(s.left + 2)},${f(y + 4)}Z" fill="${defs.flame(c)}" stroke="${dark(c, 0.2)}" stroke-width="0.7" opacity="0.9"/>`;
  });
  return out;
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
    else solid = sphere(cx, y, s * 0.82, main, defs, rand);
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
    const solid = blob(x, y, s * 0.92, main, defs, rand);
    solids.push(solid);
    body += solid.svg;
    if (second) body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.38)}" fill="${defs.sphere(second)}" opacity="0.85"/>`;
  }
  const all: Solid = solids.length
    ? { svg: '', top: Math.min(...solids.map(q => q.top)), bottom: Math.max(...solids.map(q => q.bottom)), left: Math.min(...solids.map(q => q.left)), right: Math.max(...solids.map(q => q.right)) }
    : { svg: '', top: y - s, bottom: y + s, left: x - s, right: x + s };

  // Brilho por trás e o detalhe de cada elemento
  const glow = solids.length ? `<ellipse cx="${f((all.left + all.right) / 2)}" cy="${f(y)}" rx="${f((all.right - all.left) / 2 + s * 0.9)}" ry="${f((all.bottom - all.top) / 2 + s * 0.8)}" fill="${defs.glow(main)}"/>` : '';
  b.elements.forEach((el, i) => { deco += decorate(el, all, COLORS[el] ?? main, defs, rand, flight, i > 0); });

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
  const svg = `<g class="ap-being"${p.alpha !== undefined ? ` opacity="${p.alpha}"` : ''}>${glow}${auras}${body}${deco}</g>`;
  return { svg, box: all };
}

// ---------- a cena ----------

/** Monta a cena inteira */
export function renderAppearanceSvg(ap: Appearance): string {
  const rand = seeded('aparencia');
  const defs = new Defs();
  let back = '', mid = '', front = '';

  // Chão com algumas marcas, e a superfície distante (só se houver algo lá)
  back += `<path d="${sketchLine([6, GROUND], [354, GROUND], rand, 1)}" stroke="${INK}" stroke-width="1.5" fill="none" opacity="0.85"/>`;
  for (let i = 0; i < 9; i++) {
    const gx = 20 + i * 38 + jitter(rand, 8);
    back += `<path d="M${f(gx)},${GROUND + 5}h${f(5 + rand() * 7)}" stroke="${INK}" stroke-width="1" opacity="0.3" stroke-linecap="round"/>`;
  }
  const far = ap.beings.filter(b => b.placement === 'far');
  if (far.length) {
    back += `<path d="${sketchLine([342, GROUND], [342, 92], rand, 1)}" stroke="${INK}" stroke-width="1.5" fill="none" opacity="0.7"/>`;
    for (let yy = 104; yy < GROUND; yy += 14) back += `<path d="M342,${yy}l8,-6" stroke="${INK}" stroke-width="0.9" opacity="0.35"/>`;
    back += `<text x="336" y="88" text-anchor="end" font-family="Inter, sans-serif" font-size="8" fill="${MUTED}">superfície distante</text>`;
  }

  // Órbita em volta de quem lança: a pessoa vai um pouco para dentro, para a órbita caber
  const aroundCaster = ap.beings.some(b => b.orbit) && !ap.beings.some(b => !b.orbit);
  const cx = aroundCaster ? 84 : 40;
  const CASTER: Pt = [cx, 160];
  const HAND: Pt = [cx + 28, 151];
  const firstColor = ap.beings.flatMap(b => b.elements)[0];
  back += caster(cx, firstColor ? COLORS[firstColor] ?? null : null, defs, rand);

  const S = 19;
  const flight = ap.beings.find(b => b.placement === 'flight');
  const flightPos: Pt = [208, 112];
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
  group('touch').forEach((b, i) => poses.set(b, { x: cx + 62 + i * 42, y: GROUND - S + 2, s: S }));
  group('far').forEach((b, i) => poses.set(b, { x: 312 - (i % 2) * 36, y: GROUND - S + 2 - Math.floor(i / 2) * 38, s: S }));
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

  mid += drawn.join('') + orbitFront;
  if (!ap.beings.length) {
    front += `<text x="200" y="118" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="${MUTED}">Nada aparece na cena ainda</text>`;
  }
  return defs.toString() + back + mid + front;
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
