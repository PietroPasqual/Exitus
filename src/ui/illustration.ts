import type { Appearance, Being } from '../core/appearance';
import { escapeHtml } from '../core/format';
import { jitter, seeded, sketchCircle, sketchLine, smoothPath, type Pt, type Rand } from './sketch';

// Ilustração da Aparência da Magia: a cena pintada a partir das runas.
// Nada de setas ou molduras de diagrama na imagem: o efeito é grande, no centro,
// pintado em camadas (luz, cor, sombra, brilho), com o cenário atrás.
// Quem lança fica à esquerda; a frente é para a direita; o chão embaixo.

const W = 360;
const H = 210;
const GROUND = 194;

const f = (n: number): string => n.toFixed(1);
const pts = (list: Pt[]): string => list.map(p => `${f(p[0])},${f(p[1])}`).join(' ');

// ---------- cores ----------

const rgb = (c: string): number[] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const hex = (v: number[]): string => '#' + v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number): string => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const light = (c: string, t: number): string => mix(c, '#ffffff', t);
const dark = (c: string, t: number): string => mix(c, '#000000', t);

/** Paleta de cada elemento: [brilho, claro, cor, escuro] */
type Pal = [string, string, string, string];
const PAL: Record<string, Pal> = {
  fogo: ['#fff6cc', '#ffb02e', '#f76707', '#b02a1b'],
  raio: ['#ffffff', '#fff3a1', '#fcc419', '#d9480f'],
  agua: ['#e7f5ff', '#74c0fc', '#1c7ed6', '#0b3d91'],
  gelo: ['#f3fbff', '#a5d8ff', '#4dabf7', '#1864ab'],
  vento: ['#e6fcf5', '#96f2d7', '#20c997', '#087f5b'],
  terra: ['#f0dcc0', '#c4976a', '#9a6b43', '#55351c'],
  metal: ['#f8f9fa', '#ced4da', '#868e96', '#343a40'],
  som: ['#f8e8fc', '#e599f7', '#be4bdb', '#862e9c'],
  natureza: ['#e6fcf5', '#8ce99a', '#37b24d', '#2b8a3e'],
  acido: ['#f4fce3', '#c0eb75', '#94c11f', '#5c940d'],
  ilusao: ['#f8f0fc', '#e599f7', '#cc5de8', '#7b2a91'],
  luz: ['#fffef5', '#ffec99', '#fcc419', '#e67700'],
  sombra: ['#adb5bd', '#5c5f66', '#343a40', '#101113'],
  materia: ['#f0d2b4', '#c08457', '#a0522d', '#5c2e12'],
  gravidade: ['#dbe4ff', '#91a7ff', '#4c6ef5', '#29359b'],
  espaco: ['#ece4ff', '#9775fa', '#5f3dc4', '#2b1a6b'],
  vida: ['#ebfbee', '#8ce99a', '#51cf66', '#2b8a3e'],
  morte: ['#dee2e6', '#868e96', '#495057', '#212529'],
  tempo: ['#fff9db', '#ffd43b', '#f59f00', '#a65f00'],
  movimento: ['#e3fafc', '#66d9e8', '#15aabf', '#0b7285'],
  pressao: ['#e7f0ff', '#91a7ff', '#4263eb', '#253c9c'],
  caos: ['#fff0f6', '#faa2c1', '#e64980', '#a61e4d'],
  infinito: ['#f3f0ff', '#b197fc', '#7950f2', '#4325a8'],
  vazio: ['#ced4da', '#495057', '#343a40', '#0b0c0e']
};
const palOf = (el: string | undefined): Pal => PAL[el ?? ''] ?? ['#fff8e6', '#e9d5a8', '#c9a86a', '#7a5f2e'];
/** Cor principal de um elemento (para o disco da mão e o rastro) */
export const elementColor = (el: string): string => palOf(el)[2];

/** Material em que o elemento pinta as formas */
type Mat = 'fire' | 'plasma' | 'water' | 'ice' | 'stone' | 'metal' | 'wind' | 'energy';
const MAT: Record<string, Mat> = {
  fogo: 'fire', raio: 'plasma', luz: 'plasma', agua: 'water', acido: 'water', gelo: 'ice',
  terra: 'stone', materia: 'stone', gravidade: 'stone', metal: 'metal', vento: 'wind', som: 'wind'
};

// ---------- definições (gradientes e filtros, escritos uma vez) ----------

class Defs {
  private items = new Map<string, string>();
  private add(id: string, svg: string): string {
    if (!this.items.has(id)) this.items.set(id, svg);
    return `url(#${id})`;
  }
  /** Esfera: luz em cima à esquerda */
  orb(p: Pal, key: string): string {
    return this.add(`ilO${key}`, `<radialGradient id="ilO${key}" cx="36%" cy="32%" r="72%"><stop offset="0" stop-color="${p[0]}"/><stop offset="0.35" stop-color="${p[1]}"/><stop offset="0.75" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[3]}"/></radialGradient>`);
  }
  /** Núcleo quente (fogo, plasma): branco no meio */
  core(p: Pal, key: string): string {
    return this.add(`ilC${key}`, `<radialGradient id="ilC${key}" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#ffffff"/><stop offset="0.25" stop-color="${p[0]}"/><stop offset="0.55" stop-color="${p[1]}"/><stop offset="0.85" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[3]}"/></radialGradient>`);
  }
  /** Brilho: some nas bordas */
  glow(c: string): string {
    return this.add(`ilG${c.slice(1)}`, `<radialGradient id="ilG${c.slice(1)}"><stop offset="0" stop-color="${c}" stop-opacity="0.75"/><stop offset="0.45" stop-color="${c}" stop-opacity="0.28"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`);
  }
  /** Língua de fogo: escuro na base, claro na ponta */
  flame(p: Pal, key: string, dir: 'up' | 'back'): string {
    const id = `ilF${key}${dir}`;
    const [x1, y1, x2, y2] = dir === 'up' ? [0, 1, 0, 0] : [1, 0, 0, 0];
    return this.add(id, `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${p[3]}"/><stop offset="0.35" stop-color="${p[2]}"/><stop offset="0.75" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}" stop-opacity="0.7"/></linearGradient>`);
  }
  /** Rastro: transparente atrás, forte perto do objeto */
  trail(c: string): string {
    return this.add(`ilT${c.slice(1)}`, `<linearGradient id="ilT${c.slice(1)}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="0.7" stop-color="${c}" stop-opacity="0.45"/><stop offset="1" stop-color="${c}" stop-opacity="0.85"/></linearGradient>`);
  }
  /** Face de um sólido, do claro ao escuro */
  face(a: string, b: string, key: string, vertical = true): string {
    return this.add(`ilL${key}`, `<linearGradient id="ilL${key}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`);
  }
  blur(sd: number): string {
    const id = `ilB${String(sd).replace('.', '_')}`;
    return this.add(id, `<filter id="${id}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
  }
  /** Pincel: bordas de tinta */
  paint(scale = 2): string {
    const id = `ilP${String(scale).replace('.', '_')}`;
    return this.add(id, `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`);
  }
  /** Chama: bordas ondulantes */
  flicker(scale = 6): string {
    const id = `ilK${scale}`;
    return this.add(id, `<filter id="${id}" x="-40%" y="-50%" width="180%" height="200%"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.12" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`);
  }
  /** Textura dentro da silhueta */
  texture(kind: 'rock' | 'frost' | 'water' | 'metal' | 'ember' | 'paper' | 'grain'): string {
    const spec: Record<typeof kind, [string, number, string]> = {
      rock: ['0.55', 3, '0 0 0 0 0.16  0 0 0 0 0.11  0 0 0 0 0.07  0 0 0 2.3 -1.05'],
      frost: ['1.2', 2, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 3 -1.7'],
      water: ['0.08 0.16', 2, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 4 -2.2'],
      metal: ['0.012 0.5', 2, '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 3 -1.55'],
      ember: ['0.25', 2, '0 0 0 0 1  0 0 0 0 0.95  0 0 0 0 0.55  0 0 0 3.2 -1.8'],
      paper: ['0.9', 3, '0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.9 -0.42'],
      grain: ['0.8', 2, '0 0 0 0 0.2  0 0 0 0 0.16  0 0 0 0 0.12  0 0 0 0.8 -0.35']
    };
    const [freq, oct, m] = spec[kind];
    return this.add(`ilX${kind}`, `<filter id="ilX${kind}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${kind.length * 7}"/><feColorMatrix values="${m}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`);
  }
  toString(): string { return `<defs>${[...this.items.values()].join('')}</defs>`; }
}

// ---------- formas pintadas ----------

/** Uma forma pintada: o desenho, a caixa e a silhueta (para texturas) */
interface Solid { svg: string; l: number; t: number; r: number; b: number; mask: string }
const box = (q: Solid): { cx: number; cy: number; w: number; h: number } => ({ cx: (q.l + q.r) / 2, cy: (q.t + q.b) / 2, w: q.r - q.l, h: q.b - q.t });

interface Ctx { defs: Defs; rand: Rand; p: Pal; key: string; mat: Mat; flight: boolean }

const outline = (p: Pal, mat: Mat): string => (mat === 'fire' || mat === 'plasma' ? p[3] : dark(p[3], 0.25));

function paintSphere(x: number, y: number, r: number, c: Ctx): Solid {
  const { defs, p, key, mat, rand } = c;
  const fill = mat === 'fire' || mat === 'plasma' ? defs.core(p, key) : defs.orb(p, key);
  const clear = mat === 'water' || mat === 'ice';
  let svg = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${clear ? ' fill-opacity="0.88"' : ''}/>`;
  // sombra própria embaixo e luz de borda
  svg += `<path d="M${f(x - r * 0.92)},${f(y + r * 0.15)} A${f(r)},${f(r)} 0 0,0 ${f(x + r * 0.92)},${f(y + r * 0.15)} A${f(r * 1.1)},${f(r * 0.85)} 0 0,1 ${f(x - r * 0.92)},${f(y + r * 0.15)}Z" fill="${p[3]}" opacity="${mat === 'fire' || mat === 'plasma' ? 0.18 : 0.28}"/>`;
  svg += `<path d="${sketchCircle(x, y, r, rand)}" stroke="${outline(p, mat)}" stroke-width="1.3" fill="none" opacity="0.8"/>`;
  svg += `<ellipse cx="${f(x - r * 0.36)}" cy="${f(y - r * 0.42)}" rx="${f(r * 0.3)}" ry="${f(r * 0.17)}" fill="#fff" opacity="${clear ? 0.8 : 0.5}" transform="rotate(-32 ${f(x - r * 0.36)} ${f(y - r * 0.42)})"/>`;
  if (clear) svg += `<path d="M${f(x + r * 0.55)},${f(y + r * 0.2)} A${f(r * 0.6)},${f(r * 0.6)} 0 0,1 ${f(x + r * 0.05)},${f(y + r * 0.72)}" stroke="#fff" stroke-width="${f(r * 0.08)}" fill="none" opacity="0.55" stroke-linecap="round"/>`;
  return { svg, l: x - r, t: y - r, r: x + r, b: y + r, mask: `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>` };
}

/** Caixa com frente, topo e lateral (Cubo e Paralelepípedo) */
function paintBox(x: number, y: number, w: number, h: number, c: Ctx): Solid {
  const { defs, p, key, mat, rand } = c;
  const d = Math.min(w, h) * 0.42;
  const fx = x - w / 2 - d / 4, fy = y - h / 2 + d / 4;
  // pedra e gelo têm as quinas lascadas
  const chip = mat === 'stone' || mat === 'ice' ? Math.min(w, h) * 0.08 : 0;
  const j = (v: number): number => v + (chip ? jitter(rand, chip) : 0);
  const front: Pt[] = [[j(fx), j(fy)], [j(fx + w), j(fy)], [j(fx + w), j(fy + h)], [j(fx), j(fy + h)]];
  const top: Pt[] = [front[0], [j(fx + d), j(fy - d)], [j(fx + w + d), j(fy - d)], front[1]];
  const side: Pt[] = [front[1], top[2], [j(fx + w + d), j(fy + h - d)], front[2]];
  const hot = mat === 'fire' || mat === 'plasma';
  const fFront = hot ? defs.core(p, key) : defs.face(p[1], p[2], `${key}f`);
  const fTop = defs.face(p[0], p[1], `${key}t`);
  const fSide = defs.face(p[2], p[3], `${key}s`);
  const ink = outline(p, mat);
  const face = (q: Pt[], fill: string, op = 1): string => `<polygon points="${pts(q)}" fill="${fill}"${op < 1 ? ` fill-opacity="${op}"` : ''} stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const op = mat === 'water' || mat === 'ice' ? 0.88 : 1;
  let svg = face(side, fSide, op) + face(top, fTop, op) + face(front, fFront, op);
  // brilho na quina de cima e na aresta da frente
  svg += `<path d="M${f(front[3][0] + 2)},${f(front[3][1] - 3)}L${f(front[0][0] + 2)},${f(front[0][1] + 3)}L${f(front[1][0] - 3)},${f(front[1][1] + 2)}" stroke="#fff" stroke-width="1.4" fill="none" opacity="0.5" stroke-linecap="round"/>`;
  return { svg, l: fx, t: fy - d, r: fx + w + d, b: fy + h, mask: [front, top, side].map(q => `<polygon points="${pts(q)}"/>`).join('') };
}

/** Pirâmide: em pé (duas faces) ou deitada como ponta de lança, para a frente */
function paintPyramid(x: number, y: number, r: number, c: Ctx): Solid {
  const { defs, p, key, mat } = c;
  const ink = outline(p, mat);
  const face = (q: Pt[], fill: string): string => `<polygon points="${pts(q)}" fill="${fill}" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
  if (c.flight) {
    const tip: Pt = [x + r * 1.25, y], up: Pt = [x - r * 0.75, y - r * 0.82], dn: Pt = [x - r * 0.75, y + r * 0.82], mid: Pt = [x - r * 0.45, y + r * 0.06];
    const svg = face([tip, up, mid], defs.face(p[0], p[1], `${key}pu`)) + face([tip, mid, dn], defs.face(p[2], p[3], `${key}pd`))
      + `<path d="M${f(tip[0] - 2)},${f(tip[1])}L${f(up[0] + 3)},${f(up[1] + 3)}" stroke="#fff" stroke-width="1.3" opacity="0.6"/>`;
    return { svg, l: x - r * 0.75, t: y - r * 0.82, r: x + r * 1.25, b: y + r * 0.82, mask: `<polygon points="${pts([tip, up, dn])}"/>` };
  }
  const apex: Pt = [x + r * 0.1, y - r * 1.1], bl: Pt = [x - r, y + r * 0.75], bm: Pt = [x + r * 0.3, y + r * 0.92], br: Pt = [x + r * 0.95, y + r * 0.6];
  const svg = face([apex, bl, bm], defs.face(p[0], p[2], `${key}pl`)) + face([apex, bm, br], defs.face(p[2], p[3], `${key}pr`))
    + `<path d="M${f(apex[0])},${f(apex[1] + 2)}L${f(bl[0] + 3)},${f(bl[1] - 2)}" stroke="#fff" stroke-width="1.3" opacity="0.55"/>`;
  return { svg, l: bl[0], t: apex[1], r: br[0], b: bm[1], mask: `<polygon points="${pts([apex, bl, bm, br])}"/>` };
}

/** Elemento sem formato: uma massa de energia ondulada */
function paintBlob(x: number, y: number, r: number, c: Ctx): Solid {
  const { defs, p, key, rand } = c;
  const list: Pt[] = [];
  const phase = rand() * Math.PI;
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const rr = r * (1 + 0.13 * Math.sin(a * 5 + phase) + jitter(rand, 0.04));
    list.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const d = smoothPath(list) + 'Z';
  const svg = `<path d="${d}" fill="${defs.orb(p, key)}" fill-opacity="0.92"/><path d="${d}" stroke="${dark(p[3], 0.1)}" stroke-width="1.2" fill="none" opacity="0.7"/>`
    + `<ellipse cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.38)}" rx="${f(r * 0.28)}" ry="${f(r * 0.16)}" fill="#fff" opacity="0.45" transform="rotate(-30 ${f(x - r * 0.3)} ${f(y - r * 0.38)})"/>`;
  return { svg, l: x - r, t: y - r, r: x + r, b: y + r, mask: `<path d="${d}"/>` };
}

// ---------- efeitos de cada material ----------

/** Língua de fogo da base (bx,by) até a ponta (tx,ty) */
function tongue(bx: number, by: number, tx: number, ty: number, wid: number, fill: string, op = 1): string {
  const nx = -(ty - by), ny = tx - bx, len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * wid, oy = (ny / len) * wid;
  const m1: Pt = [bx + (tx - bx) * 0.45 + ox * 1.15, by + (ty - by) * 0.45 + oy * 1.15];
  const m2: Pt = [bx + (tx - bx) * 0.45 - ox * 1.15, by + (ty - by) * 0.45 - oy * 1.15];
  return `<path d="M${f(bx + ox)},${f(by + oy)} Q${f(m1[0])},${f(m1[1])} ${f(tx)},${f(ty)} Q${f(m2[0])},${f(m2[1])} ${f(bx - ox)},${f(by - oy)}Z" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
}

/** Fogo: quatro camadas de chamas (escura, laranja, amarela, branca); em voo, viram cauda */
function fire(s: Solid, c: Ctx): { back: string; front: string } {
  const { defs, p, key, rand, flight } = c;
  const { cx, cy, w, h } = box(s);
  const R = (flight ? Math.min(w, h) : Math.max(w, h)) / 2;
  const layers: [string, number, number][] = [[p[3], 1.0, 1], [p[2], 0.85, 0.95], [p[1], 0.62, 0.95], [p[0], 0.38, 0.9]];
  let back = '', front = '';
  layers.forEach(([color, scale, op], li) => {
    const n = flight ? 7 : 11;
    let layer = '';
    for (let i = 0; i < n; i++) {
      if (flight) {
        const a = Math.PI * (0.55 + (i / (n - 1)) * 0.9);
        const bx = cx + Math.cos(a) * (w / 2) * 0.9, by = cy + Math.sin(a) * (h / 2) * 0.9;
        const reach = R * 3.4 * scale * (0.65 + rand() * 0.55);
        layer += tongue(bx, by, bx - reach, by + jitter(rand, 3), R * 0.28 * scale, li === 0 ? defs.flame(p, key, 'back') : color, op);
      } else {
        const a = (i / n) * Math.PI * 2 + jitter(rand, 0.15);
        const bx = cx + Math.cos(a) * (w / 2) * 0.82, by = cy + Math.sin(a) * (h / 2) * 0.82;
        const up = (1 - Math.sin(a)) / 2;
        const reach = R * (0.4 + 1.6 * up) * scale * (0.8 + rand() * 0.4);
        layer += tongue(bx, by, bx + Math.cos(a) * R * 0.25, by - reach, R * 0.34 * scale, li === 0 ? defs.flame(p, key, 'up') : color, op);
      }
    }
    if (!flight) layer += tongue(cx, cy - R * 0.3, cx + jitter(rand, 3), cy - R * 2.8 * scale, R * 0.45 * scale, li === 0 ? defs.flame(p, key, 'up') : color, op);
    // as camadas claras ficam na frente do objeto (ele fica envolto no fogo), em voo tudo fica atrás
    if (li < 2 || flight) back += layer; else front += `<g opacity="0.75">${layer}</g>`;
  });
  return {
    back: `<g filter="${defs.blur(3)}" opacity="0.55">${back}</g><g filter="${defs.flicker(flight ? 5 : 7)}">${back}</g>`,
    front: front ? `<g filter="${defs.flicker(5)}">${front}</g>` : ''
  };
}

/** Raio que se ramifica (fractal) de a até b */
function bolt(a: Pt, b: Pt, rand: Rand, depth: number): string {
  const segs: Pt[] = [a];
  const n = 6;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const nx = -(b[1] - a[1]), ny = b[0] - a[0], len = Math.hypot(nx, ny) || 1;
    const off = jitter(rand, len * 0.12);
    segs.push([a[0] + (b[0] - a[0]) * t + (nx / len) * off, a[1] + (b[1] - a[1]) * t + (ny / len) * off]);
  }
  segs.push(b);
  let d = 'M' + segs.map(q => `${f(q[0])},${f(q[1])}`).join('L');
  if (depth > 0) {
    const k = 2 + Math.floor(rand() * 3);
    const from = segs[k];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + jitter(rand, 1.1);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.45;
    d += bolt(from, [from[0] + Math.cos(ang) * L, from[1] + Math.sin(ang) * L], rand, depth - 1).replace(/^/, '');
  }
  return d;
}

/** Plasma (raio, luz): raios ramificados saindo do objeto, com brilho */
function plasma(s: Solid, c: Ctx): string {
  const { defs, p, rand } = c;
  const { cx, cy, w, h } = box(s);
  const R = Math.min(w, h) / 2;
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + jitter(rand, 0.4);
    // saem de pontos ao longo do corpo (numa lança, do comprimento todo)
    const ox = cx + (w > h ? (rand() - 0.5) * (w - h) : 0), oy = cy + (h > w ? (rand() - 0.5) * (h - w) : 0);
    const from: Pt = [ox + Math.cos(a) * R * 0.6, oy + Math.sin(a) * R * 0.6];
    const to: Pt = [ox + Math.cos(a) * R * (1.6 + rand() * 0.6), oy + Math.sin(a) * R * (1.5 + rand() * 0.5)];
    d += bolt(from, to, rand, 1);
  }
  const path = (stroke: string, wd: number, op: number): string => `<path d="${d}" stroke="${stroke}" stroke-width="${wd}" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"/>`;
  return `<g filter="${defs.blur(2.2)}">${path(p[1], 4, 0.8)}</g>${path(p[2], 1.8, 0.95)}${path('#fff', 0.8, 1)}`;
}

/** Água: gotas e anéis de onda em volta */
function water(s: Solid, c: Ctx): string {
  const { p, rand } = c;
  const { cx, cy, w, h } = box(s);
  let out = '';
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2, r = Math.max(w, h) * (0.62 + rand() * 0.25), k = 0.7 + rand() * 0.6;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.8;
    out += `<path d="M${f(x)},${f(y - 5 * k)} q${f(3.4 * k)},${f(4.6 * k)} 0,${f(7 * k)} q${f(-3.4 * k)},${f(-2.4 * k)} 0,${f(-7 * k)}Z" fill="${p[1]}" stroke="${p[3]}" stroke-width="0.6" opacity="0.9"/><circle cx="${f(x - 0.8 * k)}" cy="${f(y)}" r="${f(0.8 * k)}" fill="#fff" opacity="0.8"/>`;
  }
  out += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w * 0.8)}" ry="${f(h * 0.62)}" fill="none" stroke="${p[1]}" stroke-width="1.2" opacity="0.45"/>`;
  return out;
}

/** Gelo: estilhaços e brilhos frios em volta; espinhos no chão quando está apoiado */
function ice(s: Solid, c: Ctx, grounded: boolean): { under: string; over: string } {
  const { p, rand } = c;
  const { cx, cy, w, h } = box(s);
  let over = '', under = '';
  // rachaduras e facetas brancas dentro
  over += `<path d="M${f(cx - w * 0.2)},${f(cy - h * 0.25)}l${f(w * 0.12)},${f(h * 0.2)}l${f(-w * 0.06)},${f(h * 0.14)}l${f(w * 0.16)},${f(h * 0.18)}M${f(cx + w * 0.05)},${f(cy - h * 0.05)}l${f(w * 0.15)},${f(-h * 0.1)}" stroke="#fff" stroke-width="0.9" fill="none" opacity="0.85"/>`;
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2, r = Math.max(w, h) * (0.65 + rand() * 0.3), k = 2 + rand() * 3;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
    over += `<path d="M${f(x)},${f(y - k * 1.6)}L${f(x + k * 0.6)},${f(y)}L${f(x)},${f(y + k * 1.6)}L${f(x - k * 0.6)},${f(y)}Z" fill="${p[0]}" stroke="${p[2]}" stroke-width="0.6" opacity="0.9"/>`;
  }
  if (grounded) {
    const n = 11, span = w + 46, x0 = s.l - 23;
    for (let i = 0; i < n; i++) {
      const x = x0 + (i / (n - 1)) * span, mid = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
      const hgt = 10 + rand() * 12 + mid * 18, lean = (i - (n - 1) / 2) * 1.8 + jitter(rand, 3);
      under += `<path d="M${f(x - 5)},${GROUND} L${f(x + lean)},${f(GROUND - hgt)} L${f(x + 5)},${GROUND}Z" fill="${p[1]}" fill-opacity="0.92" stroke="${p[3]}" stroke-width="0.8"/><path d="M${f(x + lean * 0.4)},${f(GROUND - hgt * 0.75)}L${f(x + 1)},${f(GROUND - 2)}" stroke="#fff" stroke-width="0.9" opacity="0.8"/>`;
    }
  }
  return { under, over };
}

/** Pedra: rachaduras e pedaços voando (atrás em voo; saltando da base quando apoiada) */
function stone(s: Solid, c: Ctx, grounded: boolean): string {
  const { p, rand, flight } = c;
  const { cx, cy, w, h } = box(s);
  let out = `<path d="M${f(cx - w * 0.22)},${f(cy - h * 0.3)}l${f(w * 0.12)},${f(h * 0.18)}l${f(-w * 0.05)},${f(h * 0.16)}l${f(w * 0.18)},${f(h * 0.14)}M${f(cx + w * 0.1)},${f(cy - h * 0.1)}l${f(w * 0.12)},${f(h * 0.05)}" stroke="${p[3]}" stroke-width="1.1" fill="none" opacity="0.85"/>`;
  for (let i = 0; i < 10; i++) {
    const x = flight ? s.l - 8 - rand() * w * 1.6 : (rand() < 0.5 ? s.l - 6 - rand() * 18 : s.r + 6 + rand() * 18);
    const y = flight ? cy + jitter(rand, h * 0.6) : grounded ? GROUND - 3 - rand() * h * 0.7 : cy + jitter(rand, h * 0.7);
    const r = 1.6 + rand() * 2.8;
    const q: Pt[] = Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * Math.PI * 2 + rand(); return [x + Math.cos(a) * r, y + Math.sin(a) * r]; });
    out += `<polygon points="${pts(q)}" fill="${p[2]}" stroke="${p[3]}" stroke-width="0.6"/>`;
  }
  if (grounded) out += `<ellipse cx="${f(cx)}" cy="${GROUND - 2}" rx="${f(w * 0.95)}" ry="6" fill="#c8b48e" opacity="0.55"/>`;
  return out;
}

/** Vento (e som): faixas de ar girando em volta */
function wind(s: Solid, c: Ctx): string {
  const { defs, p, rand } = c;
  const { cx, cy, w, h } = box(s);
  const R = Math.max(w, h) / 2;
  let ribbons = '';
  for (let i = 0; i < 4; i++) {
    const rx = R * (1.15 + i * 0.22), ry = R * (0.45 + i * 0.12), a0 = rand() * 2;
    const start: Pt = [cx + Math.cos(a0) * rx, cy + Math.sin(a0) * ry];
    const end: Pt = [cx + Math.cos(a0 + 4.2) * rx, cy + Math.sin(a0 + 4.2) * ry];
    ribbons += `<path d="M${f(start[0])},${f(start[1])} A${f(rx)},${f(ry)} -12 1,1 ${f(end[0])},${f(end[1])}" stroke="${i % 2 ? p[1] : p[2]}" stroke-width="${f(2.6 - i * 0.4)}" fill="none" stroke-linecap="round" opacity="${f(0.85 - i * 0.12)}"/>`;
  }
  return `<g filter="${defs.blur(1.2)}" opacity="0.6">${ribbons}</g>${ribbons}`;
}

/** Energia (outros elementos): partículas e o detalhe de cada um */
function energy(el: string, s: Solid, c: Ctx): string {
  const { defs, p, rand } = c;
  const { cx, cy, w, h } = box(s);
  const R = Math.max(w, h) / 2;
  let out = '';
  if (el === 'ilusao' || el === 'sombra') {
    for (let i = 0; i < 9; i++) out += `<circle cx="${f(cx + jitter(rand, R * 1.4))}" cy="${f(cy + R * 0.2 + jitter(rand, R))}" r="${f(R * (0.35 + rand() * 0.35))}" fill="${i % 2 ? p[1] : p[2]}" opacity="0.5"/>`;
    return `<g filter="${defs.blur(3)}">${out}</g>`;
  }
  if (el === 'natureza' || el === 'vida') {
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2, x = cx + Math.cos(a) * R * 1.4, y = cy + Math.sin(a) * R * 1.2, rot = rand() * 360;
      out += `<path d="M${f(x)},${f(y)} q5,-7 11,0 q-6,7 -11,0Z" fill="${p[1]}" stroke="${p[3]}" stroke-width="0.7" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
    }
    return out;
  }
  if (el === 'espaco' || el === 'infinito') {
    for (let i = 0; i < 9; i++) { const a = rand() * Math.PI * 2, r = R * (1.1 + rand() * 0.8); out += sparkle(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1.5 + rand() * 2.5, p[0]); }
    return out;
  }
  for (let i = 0; i < 8; i++) { const a = rand() * Math.PI * 2, r = R * (1.1 + rand() * 0.7); out += `<circle cx="${f(cx + Math.cos(a) * r)}" cy="${f(cy + Math.sin(a) * r * 0.8)}" r="${f(0.8 + rand() * 1.6)}" fill="${p[0]}" opacity="0.85"/>`; }
  return out;
}

/** Estrelinha de brilho de 4 pontas */
const sparkle = (x: number, y: number, r: number, c: string): string =>
  `<path d="M${f(x)},${f(y - r)} Q${f(x + r * 0.16)},${f(y - r * 0.16)} ${f(x + r)},${f(y)} Q${f(x + r * 0.16)},${f(y + r * 0.16)} ${f(x)},${f(y + r)} Q${f(x - r * 0.16)},${f(y + r * 0.16)} ${f(x - r)},${f(y)} Q${f(x - r * 0.16)},${f(y - r * 0.16)} ${f(x)},${f(y - r)}Z" fill="${c}"/>`;

/** Faíscas soltas: em voo, um rastro; parado, subindo em volta */
function sparks(s: Solid, c: Ctx, color: string): string {
  const { rand, flight } = c;
  const { cx, cy, w, h } = box(s);
  let out = '';
  for (let i = 0; i < 10; i++) {
    const x = flight ? s.l - 6 - rand() * w * 1.7 : cx + jitter(rand, w * 0.95);
    const y = flight ? cy + jitter(rand, h * 0.75) : s.t - rand() * h * 0.8 + jitter(rand, 4);
    out += i % 3 === 0 ? sparkle(x, y, 1.6 + rand() * 1.6, color) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + rand() * 1.1)}" fill="${color}" opacity="${f(0.55 + rand() * 0.45)}"/>`;
  }
  return out;
}

// ---------- marcas das runas, sem cara de diagrama ----------

/** Estado: um selo rúnico dourado brilhando atrás */
function seal(cx: number, cy: number, r: number, defs: Defs): string {
  let ticks = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ticks += `<path d="M${f(cx + Math.cos(a) * r * 0.86)},${f(cy + Math.sin(a) * r * 0.86 * 0.45)}L${f(cx + Math.cos(a) * r * 0.96)},${f(cy + Math.sin(a) * r * 0.96 * 0.45)}" stroke="#f2c14e" stroke-width="1"/>`;
  }
  const ring = `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r)}" ry="${f(r * 0.45)}" fill="none" stroke="#f2c14e" stroke-width="1.6"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 0.8)}" ry="${f(r * 0.36)}" fill="none" stroke="#f2c14e" stroke-width="0.8" stroke-dasharray="3 3"/>`;
  return `<g opacity="0.8"><g filter="${defs.blur(2)}">${ring}</g>${ring}${ticks}</g>`;
}

/** D.N.: barreiras rúnicas (em cima e embaixo, ou na frente e atrás) */
function barrier(s: Solid, kind: 'vertical' | 'lateral', defs: Defs): string {
  const { cx, cy, w, h } = box(s);
  const arc = kind === 'vertical'
    ? `<path d="M${f(cx - w * 0.6)},${f(s.t - 8)} Q${f(cx)},${f(s.t - 18)} ${f(cx + w * 0.6)},${f(s.t - 8)}M${f(cx - w * 0.6)},${f(s.b + 8)} Q${f(cx)},${f(s.b + 18)} ${f(cx + w * 0.6)},${f(s.b + 8)}" `
    : `<path d="M${f(s.l - 8)},${f(cy - h * 0.6)} Q${f(s.l - 18)},${f(cy)} ${f(s.l - 8)},${f(cy + h * 0.6)}M${f(s.r + 8)},${f(cy - h * 0.6)} Q${f(s.r + 18)},${f(cy)} ${f(s.r + 8)},${f(cy + h * 0.6)}" `;
  return `<g filter="${defs.blur(1.6)}">${arc}stroke="#9ad7ff" stroke-width="4" fill="none" opacity="0.7"/></g>${arc}stroke="#e7f5ff" stroke-width="1.4" fill="none" stroke-dasharray="5 2 1 2"/>`;
}

/** Aura das runas de conceito: um anel suave com o desenho de cada uma */
function aura(concept: string, cx: number, cy: number, r: number, defs: Defs, rand: Rand): string {
  const c = palOf(concept)[2];
  let mark = '';
  if (concept === 'tempo') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; mark += `<path d="M${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}L${f(cx + Math.cos(a) * (r - (i % 3 ? 3 : 6)))},${f(cy + Math.sin(a) * (r - (i % 3 ? 3 : 6)))}" stroke="${c}" stroke-width="1.2"/>`; }
  if (concept === 'movimento') for (let i = 0; i < 3; i++) { const a0 = i * 2.1, a1 = a0 + 0.9; mark += `<path d="M${f(cx + Math.cos(a0) * (r + 4))},${f(cy + Math.sin(a0) * (r + 4))}A${f(r + 4)},${f(r + 4)} 0 0,1 ${f(cx + Math.cos(a1) * (r + 4))},${f(cy + Math.sin(a1) * (r + 4))}" stroke="${c}" stroke-width="2" fill="none" stroke-linecap="round"/>`; }
  if (concept === 'pressao') for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; mark += `<path d="M${f(cx + Math.cos(a) * (r + 9))},${f(cy + Math.sin(a) * (r + 9))}L${f(cx + Math.cos(a) * (r + 1))},${f(cy + Math.sin(a) * (r + 1))}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`; }
  if (concept === 'caos') { const q: Pt[] = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = r * (k % 2 ? 0.85 : 1.12) + jitter(rand, 2); q.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } mark += `<polygon points="${pts(q)}" fill="none" stroke="${c}" stroke-width="1.3"/>`; }
  if (concept === 'vazio') mark += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.7)}" fill="#000" opacity="0.25"/>`;
  if (concept === 'infinito') mark += `<path d="M${f(cx)},${f(cy - r - 7)} c-6,-7 -14,0 -7,5 c7,5 7,-12 14,-7 c7,5 -1,12 -7,2" stroke="${c}" stroke-width="1.4" fill="none"/>`;
  if (concept === 'vida') mark += `<path d="M${f(cx - r)},${f(cy + r + 7)}h${f(r * 0.6)}l3,-6l4,11l3,-5h${f(r * 0.6)}" stroke="${c}" stroke-width="1.5" fill="none" stroke-linejoin="round"/>`;
  if (concept === 'morte') for (let i = 0; i < 3; i++) mark += `<path d="M${f(cx - r * 0.6 + i * r * 0.6)},${f(cy - r)} q-4,-7 0,-12 q4,-4 0,-9" stroke="${c}" stroke-width="1.5" fill="none" opacity="0.6" stroke-linecap="round"/>`;
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${defs.glow(c)}" opacity="0.6"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>${mark}`;
}

// ---------- um ser ----------

interface Pose { x: number; y: number; s: number; alpha?: number }

function paintBeing(b: Being, pose: Pose, defs: Defs, rand: Rand, idx: number): { svg: string; solid: Solid } {
  const { x, y, s } = pose;
  const el = b.elements[0] ?? b.concepts[0];
  const p = palOf(el);
  const mat: Mat = (el ? MAT[el] : undefined) ?? 'energy';
  const flight = b.placement === 'flight';
  const c: Ctx = { defs, rand, p, key: `${el ?? 'x'}${idx}`, mat, flight };

  // formas: em voo, enfileiradas com a Pirâmide na ponta; paradas, lado a lado
  const shapes = flight ? [...b.shapes.filter(q => q !== 'forma_piramide'), ...b.shapes.filter(q => q === 'forma_piramide')] : b.shapes;
  const widths = shapes.map(q => (q === 'forma_paralelepipedo' ? (flight ? s * 2.3 : s * 1.15) : q === 'forma_piramide' ? s * 1.7 : s * 1.6));
  let cursor = x - widths.reduce((a, v) => a + v, 0) / 2;
  const solids: Solid[] = shapes.map((q, i) => {
    const cx = cursor + widths[i] / 2;
    cursor += widths[i];
    if (q === 'forma_cubo') return paintBox(cx, y, s * 1.3, s * 1.3, c);
    if (q === 'forma_paralelepipedo') return flight ? paintBox(cx, y, s * 2.2, s * 1.05, c) : paintBox(cx, y, s * 1.05, s * 2.4, c);
    if (q === 'forma_piramide') return paintPyramid(cx, y, s, c);
    return paintSphere(cx, y, s * 0.85, c);
  });
  if (!solids.length) solids.push(mat === 'fire' || mat === 'plasma' || mat === 'water' || mat === 'ice' ? paintSphere(x, y, s * 0.78, c) : paintBlob(x, y, s * 0.85, c));
  const all: Solid = { svg: '', mask: solids.map(q => q.mask).join(''), l: Math.min(...solids.map(q => q.l)), t: Math.min(...solids.map(q => q.t)), r: Math.max(...solids.map(q => q.r)), b: Math.max(...solids.map(q => q.b)) };
  const { cx, cy, w, h } = box(all);
  const grounded = all.b >= GROUND - 12;

  let behind = '', body = solids.map(q => q.svg).join(''), over = '', under = '';
  // brilho grande por trás (luz da magia)
  const glowC = mat === 'fire' ? p[1] : mat === 'stone' || mat === 'metal' ? light(p[2], 0.5) : p[1];
  behind += `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(w / 2 + s * 0.9)}" ry="${f(h / 2 + s * 0.8)}" fill="${defs.glow(glowC)}" opacity="${mat === 'stone' || mat === 'metal' ? 0.45 : 0.9}"/>`;
  // segundo elemento sem mesclar: um núcleo dele dentro
  if (b.elements[1] && !b.merged) {
    const p2 = palOf(b.elements[1]);
    over += solids.map(q => { const bq = box(q); return `<circle cx="${f(bq.cx)}" cy="${f(bq.cy)}" r="${f(Math.min(bq.w, bq.h) * 0.2)}" fill="${defs.core(p2, `${b.elements[1]}n${idx}`)}" opacity="0.9"/>`; }).join('');
  }
  // texturas do material
  const tex = mat === 'stone' ? 'rock' : mat === 'ice' ? 'frost' : mat === 'water' ? 'water' : mat === 'metal' ? 'metal' : mat === 'fire' ? 'ember' : null;
  if (tex) body += `<g filter="${defs.texture(tex)}" opacity="${tex === 'rock' ? 0.9 : tex === 'ember' ? 0.4 : 0.7}">${all.mask}</g>`;
  body = `<g filter="${defs.paint(1.8)}">${body}</g>`;

  // efeito de cada material
  if (mat === 'fire') { const fx = fire(all, c); behind += fx.back; over += fx.front + sparks(all, c, p[0]); }
  if (mat === 'plasma') over += plasma(all, c) + sparks(all, c, p[0]);
  if (mat === 'water') over += water(all, c);
  if (mat === 'ice') { const fx = ice(all, c, grounded); under += fx.under; over += fx.over; }
  if (mat === 'stone') over += stone(all, c, grounded);
  if (mat === 'metal') over += `<path d="M${f(all.l + w * 0.28)},${f(all.t + h * 0.12)}l${f(-w * 0.13)},${f(h * 0.55)}M${f(all.l + w * 0.45)},${f(all.t + h * 0.12)}l${f(-w * 0.1)},${f(h * 0.4)}" stroke="#fff" stroke-width="2.4" opacity="0.7" stroke-linecap="round"/>` + sparks(all, c, '#fff');
  if (mat === 'wind') over += wind(all, c);
  if (mat === 'energy' && el) over += energy(el, all, c);
  // elementos seguintes também deixam a marca deles (ex.: Raio no Fogo da lança)
  b.elements.slice(1).forEach(e2 => {
    const m2 = MAT[e2];
    const c2: Ctx = { ...c, p: palOf(e2), key: `${e2}${idx}`, mat: m2 ?? 'energy' };
    if (m2 === 'plasma') over += plasma(all, c2);
    else if (m2 === 'fire') { const fx = fire(all, c2); behind += fx.back; }
    else over += sparks(all, c2, palOf(e2)[0]);
  });

  // runas de conceito: aura
  const R = Math.max(w, h) / 2 + 8;
  b.concepts.forEach((cn, i) => { behind = aura(cn, cx, cy, R + i * 7, defs, rand) + behind; });
  // Estado: selo dourado atrás; Ligação: faixas de energia entre as partes; D.N.: barreiras
  if (b.estado) behind = seal(cx, all.b - 2, Math.max(w * 0.75, s * 1.1), defs) + behind;
  if (b.linked && solids.length > 1) {
    const band = solids.slice(0, -1).map((q, i) => {
      const n = solids[i + 1];
      return `<path d="M${f((q.l + q.r) / 2)},${f(cy)}L${f((n.l + n.r) / 2)},${f(cy)}" stroke="${b.merged ? p[1] : '#fff'}" stroke-width="${b.merged ? 8 : 3}" stroke-linecap="round"/>`;
    }).join('');
    over = `<g filter="${defs.blur(2)}" opacity="0.8">${band}</g>` + over;
  }
  b.guards.forEach(g => { over += barrier(all, g, defs); });
  if (b.bond) {
    over += `<text x="${f(cx)}" y="${f(all.t - 16)}" text-anchor="middle" font-family="Cinzel, serif" font-size="9.5" font-weight="700" fill="#5f3dc4" stroke="#f8f0fc" stroke-width="3" paint-order="stroke">✦ ${escapeHtml(b.bond)} ✦</text>`;
  }
  const svg = `<g class="il-being"${pose.alpha !== undefined ? ` opacity="${pose.alpha}"` : ''}>${under}${behind}${body}${over}</g>`;
  return { svg, solid: all };
}

// ---------- cenário ----------

function scenery(rand: Rand, wall: boolean, target: boolean, defs: Defs): string {
  let out = `<defs>
    <linearGradient id="ilMtFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6c0cf"/><stop offset="1" stop-color="#d9dfe7"/></linearGradient>
    <linearGradient id="ilMtNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e9aab"/><stop offset="1" stop-color="#b9c2ce"/></linearGradient>
    <linearGradient id="ilMtNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34406a"/><stop offset="1" stop-color="#202842"/></linearGradient>
    <linearGradient id="ilGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a76c"/><stop offset="1" stop-color="#e2c896"/></linearGradient>
    <linearGradient id="ilSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dfb4" stop-opacity="0.2"/><stop offset="1" stop-color="#fff6e0" stop-opacity="0.8"/></linearGradient>
  </defs>`;
  out += `<g class="ap-day"><rect x="0" y="0" width="${W}" height="${GROUND}" fill="url(#ilSky)"/></g>`;
  const cloud = (x: number, y: number, k: number): string =>
    `<path d="M${f(x)},${f(y)} q${f(2 * k)},${f(-7 * k)} ${f(9 * k)},${f(-5 * k)} q${f(4 * k)},${f(-7 * k)} ${f(12 * k)},${f(-2 * k)} q${f(8 * k)},${f(-2 * k)} ${f(9 * k)},${f(5 * k)} q${f(6 * k)},${f(1 * k)} ${f(3 * k)},${f(4 * k)}Z" fill="#fffdf6" fill-opacity="0.9" stroke="#6b5636" stroke-width="1" stroke-opacity="0.5"/>`;
  out += `<g class="ap-day"><circle cx="312" cy="34" r="20" fill="#ffe066" opacity="0.3"/><circle cx="312" cy="34" r="11" fill="#ffd43b" stroke="#f08c00" stroke-width="1.2"/>`
    + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${f(312 + Math.cos(a) * 15)},${f(34 + Math.sin(a) * 15)}L${f(312 + Math.cos(a) * (i % 2 ? 19 : 22))},${f(34 + Math.sin(a) * (i % 2 ? 19 : 22))}" stroke="#f08c00" stroke-width="1.3" stroke-linecap="round"/>`; }).join('')
    + cloud(150, 32, 1.3) + cloud(236, 52, 0.9) + cloud(60, 50, 0.8) + '</g>';
  let stars = '';
  for (let i = 0; i < 28; i++) stars += `<circle cx="${f(10 + rand() * 340)}" cy="${f(8 + rand() * 95)}" r="${f(0.5 + rand() * 0.9)}" fill="#fff" opacity="${f(0.35 + rand() * 0.5)}"/>`;
  out += `<g class="ap-night">${stars}<path d="M306,18 a13,13 0 1,0 12,20 a10,10 0 1,1 -12,-20Z" fill="#ffe8a3"/></g>`;

  const range = (base: number, peaks: number[][]): string => {
    let d = `M0,${base}`;
    peaks.forEach(([x, y]) => { d += ` L${f(x + jitter(rand, 2))},${f(y)}`; });
    return d + ` L${W},${base} L${W},${GROUND} L0,${GROUND}Z`;
  };
  const farD = range(162, [[18, 142], [44, 152], [78, 120], [104, 138], [128, 130], [160, 150], [196, 114], [228, 140], [258, 126], [290, 146], [318, 122], [346, 144]]);
  const nearD = range(180, [[20, 168], [58, 158], [96, 172], [140, 154], [184, 170], [226, 158], [270, 172], [312, 160], [350, 170]]);
  const snow = [[78, 120], [196, 114], [318, 122]].map(([x, y]) => `<path d="M${x - 9},${y + 11} L${x},${y} L${x + 9},${y + 12} L${x + 4},${y + 9} L${x},${y + 13} L${x - 4},${y + 9}Z" fill="#fff" opacity="0.8"/>`).join('');
  const mtTex = `<g filter="${defs.texture('rock')}" opacity="0.16"><path d="${farD}"/><path d="${nearD}"/></g>`;
  out += `<g class="ap-day" filter="${defs.paint(3)}"><path d="${farD}" fill="url(#ilMtFar)"/><path d="${farD}" fill="none" stroke="#8792a1" stroke-width="0.9"/>${snow}<path d="${nearD}" fill="url(#ilMtNear)"/><path d="${nearD}" fill="none" stroke="#6f7a8a" stroke-width="0.9"/>${mtTex}</g>`;
  out += `<g class="ap-night" filter="${defs.paint(3)}"><path d="${farD}" fill="#2c3554"/><path d="${nearD}" fill="url(#ilMtNight)"/><path d="${nearD}" fill="none" stroke="#4a5577" stroke-width="0.9"/>${mtTex}</g>`;

  out += `<g class="ap-day"><rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="url(#ilGround)"/><g filter="${defs.texture('paper')}"><rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}"/></g></g>`;
  out += `<g class="ap-night"><rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#1d2338"/></g>`;
  out += `<path d="${sketchLine([2, GROUND], [W - 2, GROUND], rand, 1)}" stroke="#4a3520" stroke-width="1.5" fill="none" opacity="0.8"/>`;
  let grass = '';
  for (let i = 0; i < 14; i++) {
    const gx = 10 + i * 25.5 + jitter(rand, 9), hgt = 5 + rand() * 6;
    grass += `<path d="M${f(gx - 4)},${GROUND} q1,${f(-hgt * 0.7)} -2,${f(-hgt)} M${f(gx)},${GROUND} q0,${f(-hgt)} 1,${f(-hgt - 3)} M${f(gx + 4)},${GROUND} q-1,${f(-hgt * 0.7)} 3,${f(-hgt)}" stroke-linecap="round"/>`;
  }
  out += `<g class="ap-day" stroke="#5c940d" stroke-width="1.5" fill="none">${grass}</g><g class="ap-night" stroke="#2f6b46" stroke-width="1.5" fill="none">${grass}</g>`;
  const stoneAt = (x: number, r: number): string => {
    const q: Pt[] = Array.from({ length: 7 }, (_, k) => { const a = Math.PI + (k / 6) * Math.PI; return [x + Math.cos(a) * r * (0.85 + rand() * 0.3), GROUND + 0.5 + Math.sin(a) * r * (0.7 + rand() * 0.3)]; });
    return `<polygon points="${pts(q)}" fill="#9a9488" stroke="#4d4a44" stroke-width="0.9"/>`;
  };
  out += stoneAt(22, 6) + stoneAt(150, 4) + stoneAt(262, 5);

  if (wall) {
    const boulder = (x: number, y: number, r: number, shade: string): string => {
      const q: Pt[] = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return [x + Math.cos(a) * r * (0.8 + rand() * 0.35), y + Math.sin(a) * r * (0.75 + rand() * 0.3)]; });
      return `<polygon points="${pts(q)}" fill="${shade}" stroke="#3f3b35" stroke-width="1.1" stroke-linejoin="round"/><path d="M${f(x - r * 0.5)},${f(y - r * 0.4)} l${f(r * 0.4)},${f(-r * 0.2)}" stroke="#fff" stroke-width="0.9" opacity="0.45"/>`;
    };
    const pile = boulder(352, GROUND - 54, 16, '#8f8a80') + boulder(338, GROUND - 31, 18, '#a39e93') + boulder(357, GROUND - 22, 15, '#8a857b')
      + boulder(323, GROUND - 12, 13, '#b0aa9e') + boulder(345, GROUND - 8, 11, '#958f84') + boulder(351, GROUND - 78, 12, '#a39e93');
    out += `<g filter="${defs.paint(2)}">${pile}<g filter="${defs.texture('rock')}" opacity="0.5">${pile}</g></g>`;
  }
  if (target) {
    const x = 330;
    out += `<ellipse cx="${x}" cy="${GROUND + 1}" rx="12" ry="2.6" fill="#000" opacity="0.15"/>
      <g stroke="#4a3520" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" filter="${defs.paint(1.5)}">
        <rect x="${x - 2}" y="132" width="4" height="${GROUND - 132}" fill="#8b5e34"/>
        <rect x="${x - 15}" y="146" width="30" height="4" rx="1.5" fill="#8b5e34"/>
        <circle cx="${x}" cy="126" r="8" fill="#e9c46a"/>
        <path d="M${x - 6},120 l-4,-5 M${x + 6},120 l4,-5 M${x},118 l0,-6 M${x - 3},119 l-1,-6 M${x + 3},119 l1,-6" stroke="#c99a2e" stroke-width="1.1"/>
        <rect x="${x - 10}" y="142" width="20" height="26" rx="3" fill="#e0b96a"/>
        <circle cx="${x}" cy="155" r="7" fill="#fff" stroke="#c92a2a" stroke-width="1.4"/><circle cx="${x}" cy="155" r="4" fill="none" stroke="#c92a2a" stroke-width="1.2"/><circle cx="${x}" cy="155" r="1.6" fill="#c92a2a" stroke="none"/>
      </g>`;
  }
  const corner = (x: number, y: number, sx: number, sy: number): string =>
    `<path d="M${x},${y + sy * 16} L${x},${y} L${x + sx * 16},${y}" stroke="#6b4b2a" stroke-width="1.6" fill="none"/><path d="M${x + sx * 5},${y + sy * 5} m0,-3 l3,3 l-3,3 l-3,-3z" fill="#a8742e"/>`;
  out += corner(5, 5, 1, 1) + corner(W - 5, 5, -1, 1) + corner(5, H - 5, 1, -1) + corner(W - 5, H - 5, -1, -1);
  return out;
}

// ---------- quem lança ----------

/** Mago de capuz e capa, com a mão estendida segurando o disco mágico */
function mage(x: number, color: string | null, defs: Defs, rand: Rand): { svg: string; hand: Pt } {
  const g = GROUND;
  const hand: Pt = [x + 27, 150];
  const ink = '#3b2a18';
  let svg = `<defs><linearGradient id="ilRobe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfc8b8"/><stop offset="0.45" stop-color="#fdfaf2"/><stop offset="1" stop-color="#e2dccd"/></linearGradient>
    <linearGradient id="ilCape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8b0a0"/><stop offset="1" stop-color="#e8e2d4"/></linearGradient></defs>`;
  svg += `<ellipse cx="${x}" cy="${g + 1}" rx="22" ry="3.4" fill="#000" opacity="0.18"/>`;
  svg += `<g filter="${defs.paint(1.4)}" stroke="${ink}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">
    <path d="M${x - 9},${142} C${x - 16},${160} ${x - 22},${180} ${x - 20},${g} L${x - 4},${g} Z" fill="url(#ilCape)"/>
    <path d="M${x - 8},144 C${x - 12},162 ${x - 15},180 ${x - 15},${g} L${x + 16},${g} C${x + 15},178 ${x + 11},160 ${x + 8},144 Z" fill="url(#ilRobe)"/>
    <path d="M${x - 3},152 C${x - 5},166 ${x - 6},180 ${x - 7},${g - 2}M${x + 4},152 C${x + 5},168 ${x + 7},182 ${x + 8},${g - 2}" fill="none" opacity="0.4"/>
    <path d="M${x - 11},147 C${x - 12},132 ${x - 6},121 ${x + 1},119 C${x + 9},122 ${x + 12},133 ${x + 11},147 Z" fill="url(#ilRobe)"/>
    <path d="M${x - 3},132 C${x},126 ${x + 7},128 ${x + 8},135 C${x + 7},141 ${x + 1},143 ${x - 2},141 Z" fill="#241a10"/>
    <path d="M${x + 6},150 C${x + 13},149 ${x + 20},149 ${hand[0] - 2},${hand[1]}" fill="none" stroke-width="5" stroke="#e2dccd"/>
    <path d="M${x + 6},150 C${x + 13},149 ${x + 20},149 ${hand[0] - 2},${hand[1]}" fill="none"/>
    <path d="M${x - 2},158 h12" fill="none" stroke="#a8742e" stroke-width="2"/>
  </g>`;
  if (color) svg += `<circle cx="${hand[0]}" cy="${hand[1]}" r="9" fill="${defs.glow(color)}"/>`;
  // um traço de pena por cima, sem filtro, para não ficar borrado
  svg += `<path d="${sketchLine([x - 1, 120], [x + 1, 119], rand)}" stroke="${ink}" stroke-width="0.6" opacity="0.3"/>`;
  return { svg, hand };
}

/** Disco mágico na mão, brilhando na cor da magia */
function disc(hand: Pt, color: string, defs: Defs): string {
  const hx = hand[0] + 10, hy = hand[1] - 2, p = palOf(Object.keys(PAL).find(k => PAL[k][2] === color));
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ticks += `<path d="M${f(hx + Math.cos(a) * 6.4)},${f(hy + Math.sin(a) * 16)}L${f(hx + Math.cos(a) * 7.8)},${f(hy + Math.sin(a) * 19.5)}" stroke="${p[3]}" stroke-width="1"/>`;
  }
  return `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="15" ry="30" fill="${p[1]}" opacity="0.7" filter="${defs.blur(5)}"/>`
    + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="8.5" ry="21" fill="${defs.orb([p[0], p[0], p[1], p[2]], `disc${p[2].slice(1)}`)}" stroke="${p[3]}" stroke-width="1.6"/>`
    + `<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="5.2" ry="13" fill="none" stroke="${p[3]}" stroke-width="0.9" stroke-dasharray="2 2"/>`
    + ticks + `<path d="M${f(hx)},${f(hy - 8)}L${f(hx + 3)},${f(hy)}L${f(hx)},${f(hy + 8)}L${f(hx - 3)},${f(hy)}Z" fill="#fff" stroke="${p[3]}" stroke-width="0.9"/>`;
}

// ---------- a cena ----------

export function renderIllustration(ap: Appearance, title = ''): string {
  const rand = seeded('ilustracao');
  const defs = new Defs();
  let back = '', mid = '', front = '';

  const far = ap.beings.filter(b => b.placement === 'far');
  const aimed = !far.length && ap.beings.some(b => b.direction === 'forward' || b.placement === 'flight');
  back += scenery(rand, far.length > 0, aimed, defs);

  // Órbita em volta de quem lança: a pessoa vai um pouco para dentro, para a órbita caber
  const aroundCaster = ap.beings.some(b => b.orbit) && !ap.beings.some(b => !b.orbit);
  const cx = aroundCaster ? 92 : 36;
  const firstEl = ap.beings.flatMap(b => [...b.elements, ...b.concepts])[0];
  const firstColor = firstEl ? palOf(firstEl)[2] : null;
  const caster = mage(cx, firstColor, defs, rand);
  const HAND = caster.hand;

  const S = 30;
  const flight = ap.beings.find(b => b.placement === 'flight');
  // em voo, o objeto todo cabe em ~130 de comprimento (uma lança de 4 peças fica menor)
  const span = (b: Being): number => b.shapes.reduce((a, q) => a + (q === 'forma_paralelepipedo' ? 2.3 : q === 'forma_piramide' ? 1.7 : 1.6), 0) || 1.6;
  const flightS = flight ? Math.min(S, 130 / span(flight)) : S;
  const escorted = ap.beings.some(b => b.placement === 'escort');
  const flightPos: Pt = [escorted ? 206 : 200, 100];
  const flightHalf = flight ? (span(flight) * flightS) / 2 : S;

  // onde fica cada ser
  const poses = new Map<Being, Pose>();
  const group = (pl: Being['placement']): Being[] => ap.beings.filter(b => b.placement === pl && !b.orbit);
  const grounded = (b: Being): boolean => b.shapes.length > 0 && b.shapes.every(q => q === 'forma_cubo' || q === 'forma_paralelepipedo');
  const fronts = group('front');
  fronts.forEach((b, i) => {
    const half = b.shapes.includes('forma_paralelepipedo') ? S * 1.2 : S * 0.62;
    const xs = fronts.length === 1 ? 182 : 140 + i * Math.min(70, 190 / fronts.length);
    poses.set(b, { x: xs, y: grounded(b) ? GROUND - half - 2 : 100 + (i % 2) * 18, s: S });
  });
  group('flight').forEach((b, i) => poses.set(b, { x: flightPos[0] - i * 34, y: flightPos[1] + i * 30, s: i ? S : flightS }));
  group('touch').forEach((b, i) => poses.set(b, { x: cx + 90 + i * 50, y: GROUND - S + 2, s: S }));
  group('far').forEach((b, i) => poses.set(b, { x: 292 - (i % 2) * 40, y: GROUND - S + 1 - Math.floor(i / 2) * 40, s: S }));
  group('self').forEach(b => poses.set(b, { x: cx, y: 160, s: S * 1.4, alpha: 0.7 }));
  const escorts = group('escort');
  escorts.forEach((b, i) => {
    const a = (i / escorts.length) * Math.PI * 2 - Math.PI / 2;
    poses.set(b, { x: flightPos[0] + Math.cos(a) * (flightHalf + 18), y: flightPos[1] + Math.sin(a) * 42, s: S * 0.5, alpha: Math.sin(a) < -0.2 ? 0.6 : 1 });
  });

  // órbita: um anel de luz; a metade da frente passa por cima dos seres
  let ringFront = '';
  const ring = (c: Pt, rx: number, ry: number, color: string): void => {
    const half = (sweep: 0 | 1): string => `M${f(c[0] - rx)},${f(c[1])}A${f(rx)},${f(ry)} 0 0,${sweep} ${f(c[0] + rx)},${f(c[1])}`;
    back += `<g filter="${defs.blur(1.5)}" opacity="0.5"><path d="${half(1)}" stroke="${color}" stroke-width="4" fill="none"/></g><path d="${half(1)}" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.8"/>`;
    ringFront += `<g filter="${defs.blur(1.5)}" opacity="0.5"><path d="${half(0)}" stroke="${color}" stroke-width="4" fill="none"/></g><path d="${half(0)}" stroke="${color}" stroke-width="1.4" fill="none" opacity="0.9"/>`;
  };
  const orbiting = ap.beings.filter(b => b.orbit);
  if (orbiting.length) {
    const anchor = ap.beings.find(b => !b.orbit && poses.has(b));
    const c: Pt = anchor ? [poses.get(anchor)!.x, poses.get(anchor)!.y] : [cx + 2, 152];
    const rx = anchor ? 74 : 90, ry = anchor ? 30 : 26;
    ring(c, rx, ry, palOf(orbiting[0].elements[0] ?? orbiting[0].concepts[0])[1]);
    orbiting.forEach((b, i) => {
      const a = (i / orbiting.length) * Math.PI * 2 + (anchor ? Math.PI / 2 : 0.3);
      poses.set(b, { x: c[0] + Math.cos(a) * rx, y: c[1] + Math.sin(a) * ry, s: S * 0.72, alpha: Math.sin(a) < -0.2 ? 0.62 : 1 });
    });
  }
  if (escorts.some(b => b.concepts.includes('movimento'))) ring(flightPos, flightHalf + 18, 42, palOf('movimento')[1]);

  // sombras no chão
  ap.beings.forEach(b => {
    const p = poses.get(b);
    if (!p || b.placement === 'self') return;
    const height = Math.max(0, GROUND - p.y);
    back += `<ellipse cx="${f(p.x)}" cy="${GROUND + 1}" rx="${f(p.s * (1.3 - height / 240))}" ry="3" fill="#000" opacity="${f(Math.max(0.05, 0.22 - height / 600))}"/>`;
  });

  back += caster.svg;

  // os seres (os de trás primeiro)
  const solids = new Map<Being, Solid>();
  const drawn: string[] = [];
  [...ap.beings].sort((a, b) => (poses.get(a)?.alpha ?? 1) - (poses.get(b)?.alpha ?? 1)).forEach((b, i) => {
    const p = poses.get(b);
    if (!p) return;
    const r = paintBeing(b, p, defs, rand, i);
    solids.set(b, r.solid);
    drawn.push(r.svg);
  });

  // rastros, impactos e movimento (sem setas de diagrama)
  ap.beings.forEach(b => {
    const p = poses.get(b), s = solids.get(b);
    if (!p || !s) return;
    const el = b.elements[0] ?? b.concepts[0];
    const pal = palOf(el);
    if (b.placement === 'flight') {
      // cometa: uma cauda de luz desde a mão, afinando
      const start: Pt = [HAND[0] + 12, HAND[1] - 2], end: Pt = [s.l + 4, p.y];
      const ctl: Pt = [(start[0] + end[0]) / 2, Math.min(start[1], end[1]) - 30];
      const tail = `M${f(start[0])},${f(start[1])} Q${f(ctl[0])},${f(ctl[1])} ${f(end[0])},${f(end[1] - 9)} L${f(end[0])},${f(end[1] + 9)} Q${f(ctl[0])},${f(ctl[1] + 12)} ${f(start[0])},${f(start[1] + 1)}Z`;
      mid += `<path d="${tail}" fill="${defs.trail(pal[1])}" filter="${defs.blur(2)}"/><path d="${tail}" fill="${defs.trail(pal[0])}" opacity="0.6"/>`;
      for (let i = 0; i < 4; i++) mid += `<path d="M${f(s.l - 36 - i * 6)},${f(p.y - 12 + i * 8)}h${f(18 - i * 2)}" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
    }
    if (b.direction === 'forward' && b.placement === 'front') {
      // ímpeto para a frente: riscos de luz
      for (let i = 0; i < 3; i++) front += `<path d="M${f(s.r + 10 + i * 9)},${f(p.y - 8 + i * 8)}h${f(16 - i * 3)}" stroke="${pal[1]}" stroke-width="2" stroke-linecap="round" opacity="0.75"/>`;
    }
    if (b.placement === 'far') {
      const to: Pt = [p.x - 4, s.t - 6];
      const arc = `M${f(HAND[0] + 12)},${f(HAND[1] - 4)} Q${f((HAND[0] + to[0]) / 2)},26 ${f(to[0])},${f(to[1])}`;
      mid += `<g filter="${defs.blur(1.8)}"><path d="${arc}" stroke="${pal[1]}" stroke-width="4" fill="none" opacity="0.6"/></g><path d="${arc}" stroke="${pal[0]}" stroke-width="1.4" fill="none" stroke-dasharray="6 5"/>`;
      // impacto: estouro de luz e estilhaços
      for (let i = 0; i < 11; i++) {
        const a = Math.PI + (i / 10) * Math.PI, r1 = (s.r - s.l) / 2 + 6, r2 = r1 + 8 + (i % 2) * 6;
        front += `<path d="M${f(p.x + Math.cos(a) * r1)},${f(GROUND - 1 + Math.sin(a) * r1 * 0.9)}L${f(p.x + Math.cos(a) * r2)},${f(GROUND - 1 + Math.sin(a) * r2 * 0.9)}" stroke="${pal[1]}" stroke-width="1.6" stroke-linecap="round"/>`;
      }
    }
    if (b.placement === 'touch') {
      front += `<ellipse cx="${f(p.x)}" cy="${GROUND}" rx="${f(p.s * 1.5)}" ry="5" fill="${pal[1]}" opacity="0.55" filter="${defs.blur(2)}"/>`
        + `<path d="M${f(p.x - 26)},${GROUND + 6}q6,-5 12,0M${f(p.x + 14)},${GROUND + 6}q6,-5 12,0M${f(p.x - 9)},${GROUND + 10}q9,-5 18,0" stroke="${pal[2]}" stroke-width="1.4" fill="none" opacity="0.85"/>`;
    }
    if (b.placement === 'self' || b.direction === 'back') {
      front += `<ellipse cx="${cx}" cy="160" rx="26" ry="40" fill="none" stroke="${pal[1]}" stroke-width="2" opacity="0.6" filter="${defs.blur(1.5)}"/>`;
    }
  });

  mid += drawn.join('') + ringFront;
  if (ap.beings.length && firstColor) front += disc(HAND, firstColor, defs);
  if (!ap.beings.length) {
    front += `<text x="200" y="110" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#7a6a52">Nada aparece na cena ainda</text>`;
  }
  if (title) {
    const t = escapeHtml(title.toUpperCase());
    const text = (fill: string, halo: string, cls: string): string => `<text class="${cls}" x="16" y="22" font-family="Cinzel, serif" font-size="11.5" font-weight="700" letter-spacing="0.6" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${t}</text>`;
    front += text('#3b2a18', '#f5ecd8', 'ap-day') + text('#f5ecd8', '#121624', 'ap-night');
  }
  return defs.toString() + back + mid + front;
}
