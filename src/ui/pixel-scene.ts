import type { Appearance, Being } from '../core/appearance';
import { clamp01, darken, fbm, inPoly, lighten, mixRGB, Pix, rgb, type RGB } from './pixel';
import { jitter, seeded, type Rand } from './sketch';
import { materialPixel, type SpellMaterial } from './pixel-materials';
import { paintElementAccents } from './pixel-element-fx';

// Aparência da Magia em pixel art (estilo jogo 16-bit).
// A tela tem 180×105 pixels; o painel mostra cada pixel como um quadradinho (2×2 do viewBox).
// Quem lança fica à esquerda, a magia no centro, a frente é para a direita, o chão embaixo.

export const PW = 180;
export const PH = 105;
const G = 97;

type P2 = [number, number];
const R = Math.round;

// ---------- cores ----------

/** Degradê de cada elemento, do mais escuro ao brilho */
const RAMP_HEX: Record<string, string[]> = {
  fogo: ['#5c1408', '#b02a1b', '#f76707', '#ffa94d', '#ffe066', '#fff8e0'],
  raio: ['#7a3a00', '#d9480f', '#fcc419', '#fff3a1', '#ffffff'],
  luz: ['#a65f00', '#f59f00', '#ffd43b', '#fff3bf', '#ffffff'],
  agua: ['#102b4b', '#175775', '#24869a', '#54b6bd', '#a0e0d6', '#e2fbec'],
  gelo: ['#1c4f8a', '#3b82c4', '#74c0fc', '#a5d8ff', '#d0ebff', '#f3fbff'],
  vento: ['#0b5a45', '#0ca678', '#38d9a9', '#96f2d7', '#e6fcf5'],
  terra: ['#3b2412', '#5e3b1f', '#8a5a33', '#b07a4a', '#d6a878'],
  materia: ['#3f1d0b', '#6e3417', '#a0522d', '#c97b4e', '#e8b38f'],
  gravidade: ['#1b2266', '#2f3fa8', '#4c6ef5', '#91a7ff', '#dbe4ff'],
  metal: ['#25282c', '#495057', '#868e96', '#ced4da', '#f8f9fa'],
  som: ['#4b1460', '#862e9c', '#be4bdb', '#e599f7', '#f8e8fc'],
  natureza: ['#1e5e2a', '#2b8a3e', '#40c057', '#8ce99a', '#ebfbee'],
  acido: ['#3d6108', '#5c940d', '#94c11f', '#c0eb75', '#f4fce3'],
  ilusao: ['#4a1660', '#7b2a91', '#cc5de8', '#e599f7', '#f8f0fc'],
  sombra: ['#08090b', '#1a1b20', '#343a40', '#5c5f66', '#adb5bd'],
  espaco: ['#1a0f45', '#3b2390', '#5f3dc4', '#9775fa', '#ece4ff'],
  vida: ['#1e5e2a', '#2b8a3e', '#51cf66', '#8ce99a', '#ebfbee'],
  morte: ['#121417', '#2b2f33', '#495057', '#868e96', '#dee2e6'],
  tempo: ['#6b3d00', '#a65f00', '#f59f00', '#ffd43b', '#fff9db'],
  movimento: ['#074a57', '#0b7285', '#15aabf', '#66d9e8', '#e3fafc'],
  pressao: ['#18286b', '#253c9c', '#4263eb', '#91a7ff', '#e7f0ff'],
  caos: ['#6b0f2f', '#a61e4d', '#e64980', '#faa2c1', '#fff0f6'],
  infinito: ['#2a1670', '#4325a8', '#7950f2', '#b197fc', '#f3f0ff'],
  vazio: ['#050506', '#16181b', '#343a40', '#495057', '#ced4da']
};
const FALLBACK = ['#5c4520', '#7a5f2e', '#c9a86a', '#e9d5a8', '#fff8e6'];
const rampOf = (el: string | undefined): RGB[] => (RAMP_HEX[el ?? ''] ?? FALLBACK).map(rgb);
const FIRE = RAMP_HEX.fogo.map(rgb);
const WHITE: RGB = [255, 255, 255];
const top = (r: RGB[]): RGB => r[r.length - 1];
const mid = (r: RGB[]): RGB => r[Math.floor(r.length / 2)];
const light = (r: RGB[]): RGB => r[r.length - 2];
const ink = (r: RGB[]): RGB => darken(r[0], 0.45);

type Mat = SpellMaterial;
const MAT: Record<string, Mat> = {
  fogo: 'fire', raio: 'plasma', luz: 'plasma', agua: 'water', acido: 'water', gelo: 'ice',
  terra: 'stone', materia: 'stone', gravidade: 'stone', metal: 'metal', vento: 'wind', som: 'wind'
};

// ---------- formas ----------

/** Caixa de um objeto desenhado */
interface Box { l: number; t: number; r: number; b: number }
const cxOf = (q: Box): number => (q.l + q.r) / 2;
const cyOf = (q: Box): number => (q.t + q.b) / 2;
const union = (list: Box[]): Box => ({ l: Math.min(...list.map(q => q.l)), t: Math.min(...list.map(q => q.t)), r: Math.max(...list.map(q => q.r)), b: Math.max(...list.map(q => q.b)) });

interface Ctx { pix: Pix; ramp: RGB[]; mat: Mat; flight: boolean; seed: number; element?: string }

function surface(c: Ctx, px: number, py: number, q: Box, light: number): RGB {
  return materialPixel(c.ramp, c.mat, px, py, (px - q.l) / Math.max(1, q.r - q.l), (py - q.t) / Math.max(1, q.b - q.t), light, c.seed, c.element);
}

/** Esfera com luz de cima à esquerda, brilho e contorno */
function sphere(c: Ctx, x: number, y: number, r: number): Box {
  const { pix, ramp } = c;
  const L = [-0.5, -0.62, 0.6];
  const q = { l: x - r, t: y - r, r: x + r, b: y + r };
  pix.shape(x - r, y - r, x + r, y + r, (px, py) => {
    const dx = (px - x) / r, dy = (py - y) / r, d2 = dx * dx + dy * dy;
    if (d2 > 1) return null;
    const z = Math.sqrt(1 - d2);
    const light = clamp01((dx * L[0] + dy * L[1] + z * L[2]) * 0.85 + 0.2);
    return surface(c, px, py, q, light);
  }, ink(ramp));
  return q;
}

/** Caixa com frente, topo e lateral (Cubo e Paralelepípedo) */
function cube(c: Ctx, x: number, y: number, w: number, h: number): Box {
  const { pix, ramp } = c;
  const d = R(Math.min(w, h) * 0.38);
  const fx = R(x - w / 2 - d / 2), fy = R(y - h / 2 + d / 2), W = R(w), H = R(h);
  const topP: P2[] = [[fx, fy], [fx + d, fy - d], [fx + W + d, fy - d], [fx + W, fy]];
  const sideP: P2[] = [[fx + W, fy], [fx + W + d, fy - d], [fx + W + d, fy + H - d], [fx + W, fy + H]];
  const q = { l: fx, t: fy - d, r: fx + W + d, b: fy + H };
  pix.shape(fx, fy - d, fx + W + d, fy + H, (px, py) => {
    const inFront = px >= fx && px < fx + W && py >= fy && py < fy + H;
    if (inFront) {
      if (py === fy || px === fx) return light(ramp);
      const v = (py - fy) / H, u = (px - fx) / W;
      return surface(c, px, py, q, .68 - v * .23 - u * .1);
    }
    if (inPoly(topP, px + 0.5, py + 0.5)) return surface(c, px, py, q, .94);
    if (inPoly(sideP, px + 0.5, py + 0.5)) return surface(c, px, py, q, .23 - ((py - fy) / H) * .1);
    return null;
  }, ink(ramp));
  // aresta de cima da lateral, um fio de luz
  pix.line(fx + W + 1, fy - 1, fx + W + d - 1, fy - d + 1, light(ramp));
  return q;
}

/** Pirâmide: em pé (duas faces) ou deitada como ponta de lança para a frente */
function pyramid(c: Ctx, x: number, y: number, r: number): Box {
  const { pix, ramp } = c;
  if (c.flight) {
    const tip: P2 = [x + r * 1.3, y], up: P2 = [x - r * 0.8, y - r * 0.85], dn: P2 = [x - r * 0.8, y + r * 0.85], m: P2 = [x - r * 0.5, y];
    const box = { l: up[0], t: up[1], r: tip[0], b: dn[1] };
    pix.shape(up[0], up[1], tip[0], dn[1], (px, py) => {
      const q: P2 = [px + 0.5, py + 0.5];
      if (inPoly([tip, up, m], ...q)) return surface(c, px, py, box, .85 - (px - up[0]) / (tip[0] - up[0]) * .15);
      if (inPoly([tip, m, dn], ...q)) return surface(c, px, py, box, .25);
      return null;
    }, ink(ramp));
    pix.line(up[0] + 2, up[1] + 2, tip[0] - 2, tip[1], top(ramp));
    return box;
  }
  const apex: P2 = [x + r * 0.1, y - r * 1.15], bl: P2 = [x - r, y + r * 0.8], bm: P2 = [x + r * 0.3, y + r * 0.95], br: P2 = [x + r, y + r * 0.65];
  const box = { l: bl[0], t: apex[1], r: br[0], b: bm[1] };
  pix.shape(bl[0], apex[1], br[0], bm[1], (px, py) => {
    const q: P2 = [px + 0.5, py + 0.5];
    if (inPoly([apex, bl, bm], ...q)) return surface(c, px, py, box, .88 - (py - apex[1]) / (bm[1] - apex[1]) * .23);
    if (inPoly([apex, bm, br], ...q)) return surface(c, px, py, box, .29 - (py - apex[1]) / (bm[1] - apex[1]) * .1);
    return null;
  }, ink(ramp));
  pix.line(apex[0], apex[1] + 1, bm[0], bm[1] - 1, light(ramp));
  return box;
}

/** Sem formato: uma massa de energia ondulada */
function blob(c: Ctx, x: number, y: number, r: number): Box {
  const { pix, ramp, seed } = c;
  const q = { l: x - r, t: y - r, r: x + r, b: y + r };
  pix.shape(x - r * 1.2, y - r * 1.2, x + r * 1.2, y + r * 1.2, (px, py) => {
    const a = Math.atan2(py - y, px - x), d = Math.hypot(px - x, py - y);
    const rr = r * (0.95 + 0.14 * Math.sin(a * 5 + seed) + (fbm(Math.cos(a) * 2 + 3, Math.sin(a) * 2 + 3, seed) - 0.5) * 0.4);
    if (d > rr) return null;
    return surface(c, px, py, q, .85 - d / rr * .42 - (px - x + py - y) / (r * 6));
  }, ink(ramp));
  return q;
}

// ---------- efeitos ----------

/**
 * Fogo em pixel: um "campo de calor" em volta do corpo; o ruído recorta as línguas.
 * Parado, as chamas sobem; em voo, viram uma cauda para trás.
 */
function flames(pix: Pix, q: Box, flight: boolean, seed: number, ramp: RGB[] = FIRE, rise = .62): void {
  const cx = cxOf(q), cy = cyOf(q);
  const rx = Math.max(4, (q.r - q.l) / 2), ry = Math.max(4, (q.b - q.t) / 2);
  const rr = Math.min(rx, ry), compact = rise >= 1;
  const l = flight ? q.l - rr * 2.5 : q.l - rr * .6, r = q.r + rr * .6;
  const t = q.t - rr * (compact ? .7 : 1.5), b = q.b + rr * .4;
  for (let y = Math.floor(t); y <= b; y++) for (let x = Math.floor(l); x <= r; x++) {
    let dx = (x - cx) / rx, dy = (y - cy) / ry;
    // A corona stays near defined shapes. Unshaped fire can rise into a flame.
    if (flight) dx = x >= cx ? dx * 1.15 : ((x - cx) / rr) * .4;
    else dy = dy < 0 ? dy * rise : dy * 1.2;
    const bend = Math.sin(dy * 5 + seed) * .09;
    const dist = Math.hypot(dx + bend, dy);
    const n = fbm(Math.floor(x / 2) * .25, Math.floor(y / 2) * .14, seed);
    const heat = 1.12 - dist * .69 + (n - .5) * .35;
    if (heat < .24) continue;
    const tone = heat > .98 && Math.abs(dx) < .23 ? .98 : Math.min(.82, (heat - .24) * 1.03);
    pix.set(x, y, ramp[R(clamp01(tone) * (ramp.length - 1))]);
  }
}

/** Three attached tongues suggest heat without hiding the chosen geometry. */
function fireWisps(pix: Pix, q: Box, flight: boolean, seed: number): void {
  const cx = cxOf(q), cy = cyOf(q), rx = (q.r - q.l) / 2, ry = (q.b - q.t) / 2;
  for (let i = 0; i < 3; i++) {
    const a = [-2.6, -1.7, -.55][i];
    const x = flight ? q.l + 3 : cx + Math.cos(a) * rx * .84;
    const y = flight ? q.t + (i + 1) * (q.b - q.t) / 4 : cy + Math.sin(a) * ry * .84;
    const len = 5 + (seed + i * 3) % 4;
    const tx = flight ? x - len - 3 : x + (i === 1 ? 2 : -2), ty = flight ? y - 2 : y - len;
    const pts: P2[] = flight
      ? [[x + 2, y - 2], [x - 3, y - 2], [tx, ty], [x - 5, y + 1], [x, y + 3]]
      : [[x - 2, y + 2], [x - 3, y - 2], [tx, ty], [x + 2, y - 3], [x + 3, y + 2]];
    pix.shape(Math.min(tx, x - 3), Math.min(ty, y - 3), x + 3, y + 3, (px, py) => {
      if (!inPoly(pts, px + .5, py + .5)) return null;
      const heat = flight ? (px - tx) / (x + 3 - tx) : (py - ty) / (y + 3 - ty);
      return FIRE[heat > .7 ? 3 : heat > .4 ? 2 : 1];
    });
  }
}

/** Raio que se ramifica (andando em passos de 2 pixels) */
function bolt(pix: Pix, from: P2, to: P2, ramp: RGB[], rand: Rand, depth: number): void {
  const pts: P2[] = [from];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(3, Math.round(length / 3));
  const nx = -(to[1] - from[1]) / Math.max(1, length), ny = (to[0] - from[0]) / Math.max(1, length);
  for (let i = 1; i < n; i++) {
    const k = i / n, offset = jitter(rand, depth ? 2.1 : 1.2);
    pts.push([from[0] + (to[0] - from[0]) * k + nx * offset, from[1] + (to[1] - from[1]) * k + ny * offset]);
  }
  pts.push(to);
  if (depth) for (let i = 1; i < pts.length; i++) pix.line(pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1], mid(ramp));
  for (let i = 1; i < pts.length; i++) pix.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], depth ? top(ramp) : light(ramp));
  if (depth > 0) {
    const k = 1 + Math.floor(rand() * (pts.length - 2));
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]) + jitter(rand, 1.2);
    const L = length * .45;
    bolt(pix, pts[k], [pts[k][0] + Math.cos(ang) * L, pts[k][1] + Math.sin(ang) * L], ramp, rand, depth - 1);
  }
}

function plasma(pix: Pix, q: Box, ramp: RGB[], rand: Rand, radiant = false): void {
  const cx = cxOf(q), cy = cyOf(q), rx = (q.r - q.l) / 2, ry = (q.b - q.t) / 2;
  if (radiant) {
    // Light radiates in straight rays; electricity follows branching channels.
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 - .3, co = Math.cos(a), si = Math.sin(a);
      pix.line(cx + co * (rx + 3), cy + si * (ry + 3), cx + co * (rx + 7), cy + si * (ry + 7), light(ramp));
    }
    return;
  }
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .4, co = Math.cos(a), si = Math.sin(a);
    const from: P2 = [cx + co * rx * .85, cy + si * ry * .85];
    const end: P2 = [Math.max(3, Math.min(PW - 4, cx + co * (rx + 7 + rand() * 3))), Math.max(3, Math.min(PH - 4, cy + si * (ry + 7 + rand() * 3)))];
    bolt(pix, from, end, ramp, rand, 1);
  }
}

function sparks(pix: Pix, q: Box, color: RGB, rand: Rand, flight: boolean, n = 5): void {
  const w = q.r - q.l, h = q.b - q.t;
  for (let i = 0; i < n; i++) {
    const x = flight ? q.l - 4 - rand() * w * 1.6 : q.l + rand() * w;
    const y = flight ? q.t + rand() * h : q.t - 2 - rand() * h * 0.9;
    if (i % 3 === 0) pix.sparkle(R(x), R(y), 1, color); else pix.set(x, y, color);
  }
}

function energyFx(pix: Pix, el: string, q: Box, ramp: RGB[], rand: Rand): void {
  const cx = cxOf(q), cy = cyOf(q), rr = Math.max(q.r - q.l, q.b - q.t) / 2;
  if (el === 'natureza' || el === 'vida') {
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2, x = R(cx + Math.cos(a) * rr * 1.4), y = R(cy + Math.sin(a) * rr * 1.2);
      pix.shape(x - 2, y - 1, x + 2, y + 1, (px, py) => (Math.abs(px - x) + Math.abs(py - y) * 2 <= 2 ? (px < x ? ramp[3] : ramp[2]) : null), ink(ramp));
    }
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2, d = rr * (1.2 + rand() * 0.6);
    const x = R(cx + Math.cos(a) * d), y = R(cy + Math.sin(a) * d * 0.8);
    if (i % 2) pix.sparkle(x, y, 1 + (i % 3 === 0 ? 1 : 0), light(ramp)); else pix.set(x, y, top(ramp));
  }
}

/** Runas de conceito: anel pontilhado e o símbolo de cada uma */
function aura(pix: Pix, concept: string, cx: number, cy: number, r: number): void {
  const ramp = rampOf(concept), c = mid(ramp), hi = light(ramp);
  pix.halo(cx, cy, r, r, c, 0.25);
  pix.ellipse(cx, cy, r, r, c, 'all', 2);
  if (concept === 'tempo') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; pix.line(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a) * (r - (i % 3 ? 1 : 3)), cy + Math.sin(a) * (r - (i % 3 ? 1 : 3)), hi); }
  if (concept === 'movimento') for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) { const a = i * 2.1 + k * 0.1; pix.set(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), hi); }
  if (concept === 'pressao') for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; pix.line(cx + Math.cos(a) * (r + 5), cy + Math.sin(a) * (r + 5), cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1), hi); }
  if (concept === 'caos') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pix.set(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), hi); pix.set(cx + Math.cos(a + 0.2) * (r - 2), cy + Math.sin(a + 0.2) * (r - 2), hi); }
  if (concept === 'vazio') pix.halo(cx, cy, r * 0.7, r * 0.7, [0, 0, 0], 0.5);
  if (concept === 'infinito') for (let k = 0; k < 40; k++) { const a = (k / 40) * Math.PI * 2; pix.set(cx + Math.sin(a) * 6, cy - r - 4 + Math.sin(a * 2) * 2, hi); }
  if (concept === 'vida') { const y = cy + r + 3; pix.line(cx - 6, y, cx - 2, y, hi); pix.line(cx - 2, y, cx, y - 3, hi); pix.line(cx, y - 3, cx + 2, y + 2, hi); pix.line(cx + 2, y + 2, cx + 3, y, hi); pix.line(cx + 3, y, cx + 6, y, hi); }
  if (concept === 'morte') for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) pix.set(cx - 4 + i * 4 + (k % 2), cy - r - 1 - k, darken(c, 0.2));
}

/** Estado: selo rúnico dourado no chão (ou atrás, se estiver no ar) */
function seal(pix: Pix, cx: number, cy: number, r: number): void {
  const gold = rgb('#f2c14e'), hi = rgb('#fff3bf');
  pix.halo(cx, cy, r * 1.1, r * 0.4, gold, 0.4);
  pix.ellipse(cx, cy, r, r * 0.32, gold);
  pix.ellipse(cx, cy, r * 0.72, r * 0.22, gold, 'all', 2);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; pix.set(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.27, hi); }
}

/** D.N.: barreiras rúnicas (em cima e embaixo, ou na frente e atrás) */
function barrier(pix: Pix, q: Box, kind: 'vertical' | 'lateral'): void {
  const c = rgb('#9ad7ff'), hi = rgb('#e7f5ff');
  const cx = cxOf(q), cy = cyOf(q), w = q.r - q.l, h = q.b - q.t;
  for (let k = -1; k <= 1; k += 2) for (let i = -10; i <= 10; i++) {
    const u = i / 10;
    if (kind === 'vertical') { const x = cx + u * w * 0.6, y = (k < 0 ? q.t - 4 : q.b + 4) + k * (1 - u * u) * 3; pix.glow(x, y + k, c, 0.5); pix.set(x, y, i % 4 === 0 ? WHITE : hi); }
    else { const y = cy + u * h * 0.6, x = (k < 0 ? q.l - 4 : q.r + 4) + k * (1 - u * u) * 3; pix.glow(x + k, y, c, 0.5); pix.set(x, y, i % 4 === 0 ? WHITE : hi); }
  }
}

// ---------- um ser ----------

interface Pose { x: number; y: number; s: number }
export interface Label { x: number; y: number; text: string }

function paintBeing(pix: Pix, b: Being, pose: Pose, rand: Rand, idx: number, labels: Label[]): Box {
  const { x, y, s } = pose;
  const el = b.elements[0] ?? b.concepts[0];
  const ramp = rampOf(el);
  const mat: Mat = (el ? MAT[el] : undefined) ?? 'energy';
  const flight = b.placement === 'flight';
  const seed = idx * 17 + 3;
  const c: Ctx = { pix, ramp: mat === 'fire' ? FIRE : ramp, mat, flight, seed, element: el };

  // onde fica cada formato: em voo, enfileirados com a Pirâmide na ponta
  const shapes = flight ? [...b.shapes.filter(q => q !== 'forma_piramide'), ...b.shapes.filter(q => q === 'forma_piramide')] : b.shapes;
  const widths = shapes.map(q => (q === 'forma_paralelepipedo' ? (flight ? s * 2.3 : s * 1.2) : q === 'forma_piramide' ? s * 1.8 : s * 1.7));
  let cursor = x - widths.reduce((a, v) => a + v, 0) / 2;
  const centers = widths.map(w => { const cx = cursor + w / 2; cursor += w; return cx; });
  // caixa aproximada antes de desenhar (para o brilho e as chamas de trás)
  const guess: Box = shapes.length
    ? { l: cursor - widths.reduce((a, v) => a + v, 0), t: y - s * (shapes.includes('forma_paralelepipedo') && !flight ? 1.25 : 0.9), r: cursor, b: y + s * (shapes.includes('forma_paralelepipedo') && !flight ? 1.25 : 0.9) }
    : { l: x - s * 0.85, t: y - s * 0.85, r: x + s * 0.85, b: y + s * 0.85 };
  const grounded = guess.b >= G - 6;
  const gcx = cxOf(guess), gcy = cyOf(guess), gw = guess.r - guess.l, gh = guess.b - guess.t;

  // atrás: aura de conceito, selo, brilho, chamas
  b.concepts.forEach((cn, i) => aura(pix, cn, gcx, gcy, Math.max(gw, gh) / 2 + 5 + i * 4));
  if (b.estado) seal(pix, gcx, grounded ? G - 1 : guess.b + 3, Math.max(gw * 0.7, s * 1.1));
  pix.halo(gcx, gcy, gw / 2 + s * 0.9, gh / 2 + s * 0.8, mat === 'stone' || mat === 'metal' ? light(ramp) : mat === 'fire' ? FIRE[3] : ramp[ramp.length - 2], mat === 'stone' || mat === 'metal' ? 0.3 : 0.55);
  const fireIn = mat === 'fire' || b.elements.slice(1).some(e => MAT[e] === 'fire');
  const unshapedFire = mat === 'fire' && !shapes.length;
  if (fireIn && !unshapedFire) {
    flames(pix, guess, flight, seed, FIRE, 1.05);
    fireWisps(pix, guess, flight, seed);
  }

  // o corpo
  const boxes: Box[] = [];
  if (unshapedFire) {
    const q = { l: x - s * .8, t: y - s * .8, r: x + s * .8, b: y + s * .8 };
    flames(pix, q, flight, seed, FIRE, .62); boxes.push(q);
  } else {
    shapes.forEach((q, i) => {
      const cx = centers[i];
      if (q === 'forma_cubo') boxes.push(cube(c, cx, y, s * 1.3, s * 1.3));
      else if (q === 'forma_paralelepipedo') boxes.push(flight ? cube(c, cx, y, s * 2.2, s * 1.05) : cube(c, cx, y, s * 1.1, s * 2.45));
      else if (q === 'forma_piramide') boxes.push(pyramid(c, cx, y, s));
      else boxes.push(sphere(c, cx, y, s * 0.82));
    });
    if (!boxes.length) boxes.push(mat === 'plasma' || mat === 'water' || mat === 'ice' ? sphere(c, x, y, s * 0.78) : blob(c, x, y, s * 0.8));
  }
  const all = union(boxes);

  // segundo elemento sem mesclar: um núcleo dele dentro de cada peça
  if (b.elements[1] && !b.merged && MAT[b.elements[1]] !== 'fire') {
    const c2: Ctx = { ...c, ramp: rampOf(b.elements[1]), mat: MAT[b.elements[1]] === 'plasma' ? 'plasma' : 'energy', element: b.elements[1] };
    boxes.forEach(q => sphere(c2, cxOf(q), cyOf(q), Math.max(2, Math.min(q.r - q.l, q.b - q.t) * 0.2)));
  }
  // ligação: faixa de luz entre as peças
  if (b.linked && boxes.length > 1) {
    const col = light(c.ramp);
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1].r - 1, z = boxes[i].l + 1;
      // Join the seams rather than washing a white beam over every material.
      for (let px = Math.min(a, z); px <= Math.max(a, z); px++) { pix.glow(px, y - 1, col, .3); pix.set(px, y, col); }
    }
  }

  // na frente: o efeito do material
  const fx = (m: Mat, r2: RGB[], e: string): void => {
    if (m === 'fire') sparks(pix, all, FIRE[4], rand, flight);
    else if (m === 'plasma') { plasma(pix, all, r2, rand, e === 'luz'); sparks(pix, all, top(r2), rand, flight, 3); }
    else if (!paintElementAccents(pix, e, all, r2, seed, grounded, flight)) energyFx(pix, e, all, r2, rand);
  };
  fx(mat, c.ramp, el ?? '');
  b.elements.slice(1).forEach(e2 => { const m2 = MAT[e2] ?? 'energy'; if (e2 !== el) fx(m2, m2 === 'fire' ? FIRE : rampOf(e2), e2); });
  b.guards.forEach(g => barrier(pix, all, g));
  if (b.bond) labels.push({ x: cxOf(all), y: all.t - 6, text: b.bond });
  return all;
}

// ---------- cenário ----------

function sky(pix: Pix, night: boolean, rand: Rand): void {
  const zenith = rgb(night ? '#111c2a' : '#8caaa9');
  const horizon = rgb(night ? '#455259' : '#e6d6af');
  // Broad, quiet bands keep the silhouettes and the magic readable at small sizes.
  for (let y = 0; y < G; y++) {
    const color = mixRGB(zenith, horizon, Math.pow(Math.min(1, Math.floor(y / 3) * 3 / 87), .85));
    for (let x = 0; x < PW; x++) pix.set(x, y, color);
  }
  if (night) {
    for (let i = 0; i < 21; i++) {
      const x = R(5 + rand() * (PW - 10)), y = R(5 + rand() * 46);
      if (i % 11 === 0) pix.sparkle(x, y, 1, rgb('#748d96'), rgb('#c9d7d0'));
      else pix.set(x, y, i % 3 ? rgb('#7d949c') : rgb('#b4c2ba'));
    }
    // A small ivory crescent, without the bright yellow outline of an effect.
    pix.halo(151, 17, 12, 12, rgb('#c9d2ba'), .12);
    pix.shape(144, 10, 158, 24, (x, y) => (Math.hypot(x - 151, y - 17) <= 6.5 && Math.hypot(x - 154, y - 15) > 5.5 ? (x < 149 ? rgb('#e6e1bf') : rgb('#b9c3ac')) : null));
    return;
  }
  pix.halo(151, 18, 17, 15, rgb('#f4dfac'), .18);
  pix.shape(145, 12, 157, 24, (x, y) => Math.hypot(x - 151, y - 18) <= 5.5 ? rgb('#f5e6bc') : null);
  // Low, elongated cloud banks instead of high-contrast white puffs.
  const cloud = (cx: number, cy: number, k: number): void => {
    const blobs: [number, number, number][] = [[-10, 1, 4], [-4, -1, 5], [3, 0, 4.5], [10, 1, 3]].map(([a, b2, r]) => [cx + a * k, cy + b2 * k, r * k]);
    pix.shape(cx - 15 * k, cy - 6 * k, cx + 15 * k, cy + 4 * k, (x, y) => {
      if (y > cy + 2 * k) return null;
      const hit = blobs.some(([bx, by, r]) => Math.hypot(x - bx, (y - by) * 1.5) <= r);
      if (!hit) return null;
      return y >= cy ? rgb('#c2c7b2') : rgb('#d5d6bf');
    });
  };
  cloud(35, 21, 1.1); cloud(102, 31, .8);
}

function mountains(pix: Pix, night: boolean, rand: Rand): void {
  const ridge = (peaks: P2[], base: number): number[] => {
    const hs: number[] = [];
    for (let x = 0; x < PW; x++) {
      let y = base;
      for (let i = 0; i < peaks.length - 1; i++) {
        const [x0, y0] = peaks[i], [x1, y1] = peaks[i + 1];
        if (x >= x0 && x <= x1) y = y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
      }
      hs.push(y + (fbm(x * 0.045, 3, 5) - 0.5) * 1.5);
    }
    return hs;
  };
  const far = ridge([[0, 75], [17, 65], [31, 71], [48, 54], [66, 70], [85, 62], [104, 73], [126, 58], [146, 71], [163, 62], [180, 72]], 78);
  const near = ridge([[0, 87], [22, 79], [44, 85], [69, 75], [91, 82], [115, 77], [140, 86], [161, 79], [180, 85]], 88);
  const paint = (hs: number[], cols: string[], snowLine: number): void => {
    const [lit, base, shade, edge] = cols.map(rgb);
    for (let x = 0; x < PW; x++) {
      const h = hs[x], slope = (hs[Math.min(PW - 1, x + 1)] - hs[Math.max(0, x - 1)]) / 2;
      for (let y = Math.ceil(h); y < G; y++) {
        const depth = y - h;
        let c = slope < -0.15 ? (depth < 9 ? lit : base) : slope > 0.15 ? shade : base;
        if (y < snowLine && depth < 3) c = night ? rgb('#657375') : rgb('#d3d2b9');
        pix.set(x, y, depth < 1 ? edge : c);
      }
    }
  };
  paint(far, night ? ['#45555d', '#3b4b53', '#34444d', '#4c5c62'] : ['#a5b4a8', '#96a89e', '#899f98', '#b1bdac'], 60);
  // Haze separates the broad ridges; no stippled texture across the whole sky.
  const haze = rgb(night ? '#536367' : '#d3cfac');
  for (let y = 65; y < G; y++) for (let x = 0; x < PW; x++) if (y > far[x]) pix.blend(x, y, haze, .08 + (y - 65) * .004);
  paint(near, night ? ['#304548', '#293d40', '#23363b', '#35494b'] : ['#788d7c', '#6b8272', '#60786b', '#82917c'], 0);
  // A distant tree line frames the clearing without competing with the spell.
  const tree = rgb(night ? '#203436' : '#536f5f');
  for (let i = 0; i < 14; i++) {
    const x = R(i * 14 + jitter(rand, 3)), base = 89 + R(rand() * 3), h = 5 + R(rand() * 4);
    const points: P2[] = [[x, base - h], [x - 3, base - 3], [x - 1, base - 3], [x - 4, base], [x + 4, base], [x + 1, base - 3], [x + 3, base - 3]];
    pix.shape(x - 4, base - h, x + 4, base, (px, py) => inPoly(points, px + .5, py + .5) ? tree : null);
  }
  const clearing = rgb(night ? '#2b3d3c' : '#7b8768');
  for (let y = 92; y < G; y++) for (let x = 0; x < PW; x++) pix.set(x, y, mixRGB(clearing, haze, (G - y) * .035));
}

function ground(pix: Pix, night: boolean, rand: Rand): void {
  const [g1, g2, g3, d1, d2, d3] = (night ? ['#526050', '#3c4b42', '#2c3d36', '#2a3030', '#22292a', '#40453b'] : ['#9a9e70', '#737e50', '#5e6c45', '#786a4d', '#62583f', '#928262']).map(rgb);
  for (let y = G; y < PH; y++) for (let x = 0; x < PW; x++) {
    const tuft = fbm(x * .12, 2, 4) > .55;
    let c: RGB = y === G ? (tuft ? g1 : g2) : y < G + 3 ? (tuft ? g2 : g3) : d1;
    if (y > G + 3 && fbm(x * .16, y * .3, 4) > .62) c = d2;
    if (y > G + 4 && fbm(x * .15, y * .3, 8) > .72) c = d3;
    pix.set(x, y, c);
  }
  // Sparse moss and grass, leaving an even silhouette for grounded objects.
  for (let i = 0; i < 15; i++) {
    const x = R(3 + i * 12 + jitter(rand, 3)), hgt = 1 + R(rand() * 2);
    pix.set(x, G - 1, g2); for (let k = 1; k <= hgt; k++) pix.set(x + (k > 1 ? (i % 2 ? 1 : -1) : 0), G - k, k === hgt ? g1 : g2);
    pix.set(x + 2, G - 1, g3); pix.set(x + 2, G - 2, g2);
  }
  // pedrinhas
  for (const [x, r] of [[11, 3], [75, 2], [131, 2.5]] as [number, number][]) {
    pix.shape(x - r, G - r, x + r, G, (px, py) => (Math.hypot((px - x) / r, (py - G) / r) <= 1 && py < G ? (py < G - r / 2 ? rgb(night ? '#68716a' : '#aaa486') : rgb(night ? '#444e48' : '#807b63')) : null), rgb(night ? '#26342f' : '#515845'));
  }
}

/** Reflected spell light only touches scenery, before characters and effects are painted. */
function groundLight(pix: Pix, x: number, radius: number, color: RGB, strength: number): void {
  for (let py = G - 2; py < PH; py++) for (let px = Math.floor(x - radius); px <= x + radius; px++) {
    const d = Math.hypot((px - x) / radius, (py - G) / 7);
    if (d < 1) pix.blend(px, py, color, (1 - d) * strength);
  }
}

/** Monte de pedras (o alvo das magias que vão longe) */
function rockPile(pix: Pix): void {
  const rocks: [number, number, number][] = [[176, G - 27, 8], [169, G - 16, 9], [178, G - 11, 7.5], [161, G - 6, 6.5], [172, G - 4, 5.5], [175, G - 39, 6]];
  const ramp = ['#4e4a43', '#6f6a61', '#8f8a80', '#b0aa9e', '#cfc9bd'].map(rgb);
  rocks.forEach(([x, y, r], i) => {
    pix.shape(x - r, y - r, x + r, y + r, (px, py) => {
      const a = Math.atan2(py - y, px - x), d = Math.hypot(px - x, py - y), rr = r * (0.85 + 0.15 * Math.cos(a * 3 + i));
      if (d > rr) return null;
      return pix.pick(px, py, 0.75 - (px - x + (py - y) * 1.3) / (r * 3) - (fbm(px * 0.4, py * 0.4, i) - 0.5) * 0.5, ramp);
    }, rgb('#2e2b27'));
  });
}

/** Boneco de treino com alvo */
function dummy(pix: Pix, x: number): void {
  const wood = rgb('#8b5e34'), woodL = rgb('#b07a45'), out = rgb('#3b2414');
  pix.shape(x - 1, G - 32, x + 1, G, (px) => (px === x - 1 ? woodL : wood), out);
  pix.shape(x - 8, G - 27, x + 8, G - 25, (_px, py) => (py === G - 27 ? woodL : wood), out);
  pix.shape(x - 5, G - 26, x + 5, G - 12, (px, py) => (px < x - 2 ? rgb('#f1cf7e') : py > G - 15 ? rgb('#c99a3e') : rgb('#e0b96a')), out);
  pix.shape(x - 4, G - 37, x + 4, G - 29, (px, py) => (Math.hypot(px - x, py - (G - 33)) <= 4 ? (px < x ? rgb('#f1cf7e') : rgb('#d9ad55')) : null), out);
  for (const dx of [-3, -1, 1, 3]) pix.set(x + dx, G - 38 - (dx % 2 ? 0 : 1), rgb('#c99a2e'));
  // alvo
  pix.shape(x - 4, G - 23, x + 4, G - 15, (px, py) => {
    const d = Math.hypot(px - x, py - (G - 19));
    return d > 4 ? null : d > 3 ? rgb('#e03131') : d > 2 ? WHITE : d > 1 ? rgb('#e03131') : WHITE;
  }, rgb('#7a1414'));
  pix.halo(x, G + 1, 6, 1.5, [0, 0, 0], 0.4);
}

// ---------- quem lança ----------

/** Mago de capuz e capa, com cajado e a mão estendida */
function mage(pix: Pix, x0: number, eyes: RGB, night: boolean): P2 {
  const robe = (night ? ['#1d2b36', '#2e4651', '#4a626b', '#778a88'] : ['#253641', '#3a515b', '#596f74', '#8a9890']).map(rgb);
  const cape = rgb(night ? '#352632' : '#51343c'), capeL = rgb(night ? '#513c46' : '#6f4d50');
  const gold = rgb('#c7af79'), goldD = rgb('#87704a'), leather = rgb('#604a35');
  const out = rgb('#141f25');
  const hand: P2 = [x0 + 12, G - 20];
  pix.halo(x0, G + 1, 12, 2, rgb('#111b1d'), .4);
  // Crooked ash staff, brass bindings and a small inlaid stone.
  pix.line(x0 - 9, G - 34, x0 - 8, G - 2, out);
  pix.line(x0 - 8, G - 34, x0 - 7, G - 1, rgb('#8a7652'));
  pix.line(x0 - 7, G - 32, x0 - 6, G - 2, rgb('#5b4b36'));
  for (const dy of [28, 17, 7]) pix.line(x0 - 8, G - dy, x0 - 6, G - dy, goldD);
  pix.line(x0 - 10, G - 37, x0 - 11, G - 34, goldD);
  pix.line(x0 - 11, G - 34, x0 - 8, G - 31, gold);
  pix.line(x0 - 8, G - 31, x0 - 4, G - 35, goldD);
  pix.set(x0 - 5, G - 37, gold);
  // capa, corpo, capuz, braço
  const capeP: P2[] = [[x0 - 3, G - 22], [x0 - 12, G - 1], [x0 + 2, G - 2]];
  const body: P2[] = [[x0 - 4, G - 20], [x0 + 4, G - 20], [x0 + 8, G], [x0 - 8, G]];
  const hoodTip: P2[] = [[x0 - 6, G - 22], [x0 - 5, G - 30], [x0 - 1, G - 31], [x0 + 3, G - 26]];
  const arm: P2[] = [[x0 + 1, G - 19], [x0 + 10, G - 22], [x0 + 11, G - 19], [x0 + 2, G - 15]];
  pix.shape(x0 - 12, G - 32, x0 + 12, G - 1, (px, py) => {
    const q: P2 = [px + 0.5, py + 0.5];
    const hood = Math.hypot(px + 0.5 - (x0 + 1), py + 0.5 - (G - 23)) <= 5.2;
    if (px >= x0 + 9 && px <= x0 + 11 && py >= G - 22 && py <= G - 19) return null; // a mão é desenhada depois
    if (inPoly(arm, ...q)) return px >= x0 + 7 ? goldD : py <= G - 20 ? robe[3] : robe[2];
    if (hood) {
      const face = Math.hypot((px + 0.5 - (x0 + 3)) / 2.6, (py + 0.5 - (G - 22.5)) / 3);
      if (face <= 1) return rgb('#152027');
      if (face <= 1.3 && px >= x0 + 1 && py < G - 20) return goldD;
      return px < x0 ? robe[3] : px < x0 + 3 ? robe[2] : robe[1];
    }
    if (inPoly(hoodTip, ...q)) return robe[2];
    if (inPoly(body, ...q)) {
      if (py >= G - 2) return py === G - 2 ? goldD : out;
      if (py === G - 12) return px === x0 + 1 ? gold : leather;
      if (px === x0 || px === x0 + 1) return robe[0];
      return px < x0 - 3 ? robe[2] : px < x0 + 3 ? robe[1] : robe[2];
    }
    if (inPoly(capeP, ...q)) return px < x0 - 6 ? capeL : cape;
    return null;
  }, out);
  // Folded cape, shoulder clasp and a travel pouch give the silhouette a story.
  pix.line(x0 - 4, G - 18, x0 - 9, G - 3, capeL);
  pix.line(x0 - 3, G - 9, x0 - 5, G - 3, robe[3]);
  pix.line(x0 + 3, G - 9, x0 + 5, G - 3, robe[0]);
  pix.set(x0 + 1, G - 18, gold); pix.set(x0 + 2, G - 18, goldD);
  pix.line(x0 - 3, G - 18, x0 - 5, G - 11, leather);
  pix.shape(x0 - 6, G - 10, x0 - 3, G - 6, (px, py) => px < x0 - 6 || px > x0 - 3 || py < G - 10 || py > G - 6 ? null : py === G - 10 ? rgb('#9b835c') : px === x0 - 6 ? rgb('#7e6547') : leather, out);
  // olhos brilhando na sombra do capuz
  pix.set(x0 + 3, G - 23, eyes); pix.set(x0 + 5, G - 23, eyes);
  // mão
  pix.shape(hand[0] - 2, hand[1] - 2, hand[0], hand[1], (px, py) => (px === hand[0] - 2 && py === hand[1] - 2 ? rgb('#dfc8a3') : rgb('#bfa17e')), out);
  // pedra do cajado
  pix.shape(x0 - 10, G - 38, x0 - 5, G - 33, (px, py) => (Math.abs(px - (x0 - 7.5)) + Math.abs(py - (G - 35.5)) <= 2.3 ? (px < x0 - 7 ? lighten(eyes, .25) : eyes) : null), out);
  pix.halo(x0 - 7.5, G - 35.5, 5, 5, eyes, .25);
  return hand;
}

/** Círculo mágico na mão, de perfil, brilhando na cor da magia */
function disc(pix: Pix, hand: P2, ramp: RGB[]): void {
  const x = hand[0] + 4, y = hand[1] - 1;
  pix.halo(x, y, 8, 14, ramp[ramp.length - 2], 0.6);
  pix.ellipse(x, y, 3, 9, mid(ramp));
  pix.ellipse(x, y, 2, 6.5, light(ramp), 'all', 2);
  pix.line(x, y - 4, x, y + 4, top(ramp));
  pix.set(x - 1, y, top(ramp)); pix.set(x + 1, y, top(ramp));
  for (const dy of [-9, 9]) pix.set(x, y + dy, WHITE);
}

// ---------- a cena ----------

export interface PixelScene { pix: Pix; labels: Label[] }

export function renderPixelScene(ap: Appearance, night: boolean): PixelScene {
  const pix = new Pix(PW, PH);
  const rand = seeded('pixel');
  const labels: Label[] = [];

  sky(pix, night, rand);
  mountains(pix, night, rand);
  ground(pix, night, rand);

  const far = ap.beings.filter(b => b.placement === 'far');
  const aimed = !far.length && ap.beings.some(b => b.direction === 'forward' || b.placement === 'flight');
  if (far.length) rockPile(pix);
  if (aimed) dummy(pix, 166);

  const aroundCaster = ap.beings.some(b => b.orbit) && !ap.beings.some(b => !b.orbit);
  const cx = aroundCaster ? 44 : 18;
  const firstEl = ap.beings.flatMap(b => [...b.elements, ...b.concepts])[0];
  const firstRamp = firstEl ? (MAT[firstEl] === 'fire' ? FIRE : rampOf(firstEl)) : rampOf('vento').map(c => mixRGB(c, [200, 200, 200], 0.6));

  // onde fica cada ser
  const S = 15;
  const flight = ap.beings.find(b => b.placement === 'flight');
  const span = (b: Being): number => b.shapes.reduce((a, q) => a + (q === 'forma_paralelepipedo' ? 2.3 : q === 'forma_piramide' ? 1.8 : 1.7), 0) || 1.7;
  const flightS = flight ? Math.min(S, 68 / span(flight)) : S;
  const flightPos: P2 = [102, 50];
  const flightHalf = flight ? (span(flight) * flightS) / 2 : S;
  const poses = new Map<Being, Pose>();
  const group = (pl: Being['placement']): Being[] => ap.beings.filter(b => b.placement === pl && !b.orbit);
  const grounded = (b: Being): boolean => b.shapes.length > 0 && b.shapes.every(q => q === 'forma_cubo' || q === 'forma_paralelepipedo');
  const fronts = group('front');
  fronts.forEach((b, i) => {
    const half = b.shapes.includes('forma_paralelepipedo') ? S * 1.25 : S * 0.7;
    const x = fronts.length === 1 ? 92 : 72 + i * Math.min(35, 95 / fronts.length);
    poses.set(b, { x, y: grounded(b) ? G - half : 48 + (i % 2) * 9, s: S });
  });
  group('flight').forEach((b, i) => poses.set(b, { x: flightPos[0] - i * 17, y: flightPos[1] + i * 15, s: i ? S : flightS }));
  group('touch').forEach((b, i) => poses.set(b, { x: cx + 45 + i * 25, y: G - S * 0.9, s: S }));
  group('far').forEach((b, i) => poses.set(b, { x: 150 - (i % 2) * 20, y: G - S * 0.95 - Math.floor(i / 2) * 20, s: S }));
  group('self').forEach(b => poses.set(b, { x: cx, y: G - 44, s: S * 0.6 }));
  const escorts = group('escort');
  const escortR: P2 = [flightHalf + 9, 21];
  escorts.forEach((b, i) => {
    const a = (i / escorts.length) * Math.PI * 2 - Math.PI / 2;
    poses.set(b, { x: flightPos[0] + Math.cos(a) * escortR[0], y: flightPos[1] + Math.sin(a) * escortR[1], s: S * 0.5 });
  });
  const rings: { c: P2; rx: number; ry: number; color: RGB }[] = [];
  const orbiting = ap.beings.filter(b => b.orbit);
  if (orbiting.length) {
    const anchor = ap.beings.find(b => !b.orbit && poses.has(b));
    const c: P2 = anchor ? [poses.get(anchor)!.x, poses.get(anchor)!.y] : [cx + 1, G - 20];
    const rx = anchor ? 37 : 44, ry = anchor ? 15 : 12;
    rings.push({ c, rx, ry, color: light(rampOf(orbiting[0].elements[0] ?? orbiting[0].concepts[0])) });
    orbiting.forEach((b, i) => {
      const a = (i / orbiting.length) * Math.PI * 2 + (anchor ? Math.PI / 2 : 0.3);
      poses.set(b, { x: c[0] + Math.cos(a) * rx, y: c[1] + Math.sin(a) * ry, s: S * 0.66 });
    });
  }
  if (escorts.some(b => b.concepts.includes('movimento'))) rings.push({ c: flightPos, rx: escortR[0], ry: escortR[1], color: light(rampOf('movimento')) });

  // Discreet reflected light anchors luminous magic to the clearing.
  ap.beings.forEach(b => {
    const p = poses.get(b), element = b.elements[0] ?? b.concepts[0];
    if (!p || !element) return;
    const material = MAT[element] ?? 'energy';
    if (material !== 'fire' && material !== 'plasma' && material !== 'energy') return;
    const height = Math.max(0, G - p.y), ramp = rampOf(element);
    groundLight(pix, p.x, p.s * 2, light(ramp), (night ? .2 : .11) * (1 - Math.min(.6, height / 120)));
  });

  // sombras no chão
  ap.beings.forEach(b => {
    const p = poses.get(b);
    if (!p || b.placement === 'self') return;
    const hgt = Math.max(0, G - p.y);
    pix.halo(p.x, G, p.s * (1.2 - hgt / 150), 1.8, [0, 0, 0], Math.max(0.12, 0.45 - hgt / 150));
  });

  // anel de órbita (metade de trás), o mago, e os seres de trás
  rings.forEach(r => { pix.ellipse(r.c[0], r.c[1] + 1, r.rx, r.ry, darken(r.color, 0.3), 'back'); pix.ellipse(r.c[0], r.c[1], r.rx, r.ry, r.color, 'back'); });
  const behind = (b: Being): boolean => {
    const p = poses.get(b);
    return !!p && (b.orbit || b.placement === 'escort') && rings.some(r => p.y < r.c[1] - 2);
  };
  ap.beings.filter(behind).forEach((b, i) => paintBeing(pix, b, poses.get(b)!, rand, 100 + i, labels));

  // rastros (antes do corpo, para ficar atrás)
  const HAND = mage(pix, cx, light(firstRamp), night);
  ap.beings.forEach(b => {
    const p = poses.get(b);
    if (!p) return;
    const ramp = rampOf(b.elements[0] ?? b.concepts[0]);
    const col = MAT[b.elements[0] ?? ''] === 'fire' ? FIRE[3] : light(ramp);
    if (b.placement === 'flight') {
      const a: P2 = [HAND[0] + 6, HAND[1] - 1], z: P2 = [p.x - flightHalf, p.y];
      const ctl: P2 = [(a[0] + z[0]) / 2, Math.min(a[1], z[1]) - 14];
      for (let k = 0; k <= 60; k++) {
        const t = k / 60, u = 1 - t;
        const x = u * u * a[0] + 2 * u * t * ctl[0] + t * t * z[0], y = u * u * a[1] + 2 * u * t * ctl[1] + t * t * z[1];
        const w = 0.5 + t * 4;
        for (let dy = -w; dy <= w; dy++) pix.glow(x, y + dy, col, t * 0.7 * (1 - Math.abs(dy) / (w + 1)));
      }
    }
    if (b.placement === 'far') {
      const a: P2 = [HAND[0] + 6, HAND[1] - 2], z: P2 = [p.x - 2, p.y - S];
      const ctl: P2 = [(a[0] + z[0]) / 2, 8];
      for (let k = 0; k <= 90; k++) {
        if (Math.floor(k / 4) % 2) continue;
        const t = k / 90, u = 1 - t;
        const x = u * u * a[0] + 2 * u * t * ctl[0] + t * t * z[0], y = u * u * a[1] + 2 * u * t * ctl[1] + t * t * z[1];
        pix.glow(x, y + 1, col, 0.5); pix.set(x, y, top(ramp));
      }
    }
  });

  // os seres da frente
  const boxes = new Map<Being, Box>();
  ap.beings.filter(b => !behind(b)).forEach((b, i) => {
    const p = poses.get(b);
    if (!p) return;
    if (b.placement === 'self') {
      const ramp = rampOf(b.elements[0] ?? b.concepts[0]);
      pix.halo(cx, G - 14, 16, 22, light(ramp), 0.55);
      pix.ellipse(cx, G - 14, 13, 19, light(ramp), 'all', 3);
    }
    boxes.set(b, paintBeing(pix, b, p, rand, i, labels));
  });
  rings.forEach(r => { pix.ellipse(r.c[0], r.c[1] + 1, r.rx, r.ry, darken(r.color, 0.3), 'front'); pix.ellipse(r.c[0], r.c[1], r.rx, r.ry, r.color, 'front'); });

  // movimento e impacto
  ap.beings.forEach(b => {
    const p = poses.get(b), q = boxes.get(b);
    if (!p || !q) return;
    const ramp = rampOf(b.elements[0] ?? b.concepts[0]);
    if (b.placement === 'flight' || (b.direction === 'forward' && b.placement === 'front')) {
      // riscos de velocidade
      const x0 = b.placement === 'flight' ? q.l - 22 : q.r + 4, dir = b.placement === 'flight' ? 1 : 1;
      for (let i = 0; i < 3; i++) { const y = R(p.y - 6 + i * 6), x = x0 + (i % 2) * 4; pix.line(x, y, x + (9 - i * 2) * dir, y, i === 1 ? WHITE : light(ramp)); }
    }
    if (b.placement === 'far') {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI, r1 = (q.r - q.l) / 2 + 3, r2 = r1 + 4 + (i % 2) * 3;
        pix.line(p.x + Math.cos(a) * r1, G - 1 + Math.sin(a) * r1 * 0.8, p.x + Math.cos(a) * r2, G - 1 + Math.sin(a) * r2 * 0.8, i % 2 ? WHITE : light(ramp));
      }
    }
    if (b.placement === 'touch') {
      pix.halo(p.x, G, p.s * 1.6, 3, light(ramp), 0.7);
      for (let i = -1; i <= 1; i++) pix.ellipse(p.x, G + 3, p.s * (1.1 + i * 0.35) + 4, 1.6, light(ramp), 'front', 2);
    }
    if (b.direction === 'back' && b.placement !== 'self') pix.ellipse(cx, G - 14, 14, 20, light(ramp), 'all', 3);
  });

  if (ap.beings.length) disc(pix, HAND, firstRamp);

  // moldura de pixel
  const frame = night ? rgb('#142127') : rgb('#4b4233'), corner = rgb('#b39a67');
  for (let x = 0; x < PW; x++) { pix.set(x, 0, frame); pix.set(x, PH - 1, frame); }
  for (let y = 0; y < PH; y++) { pix.set(0, y, frame); pix.set(PW - 1, y, frame); }
  for (const [x, y] of [[2, 2], [PW - 3, 2], [2, PH - 3], [PW - 3, PH - 3]]) { pix.set(x, y, corner); pix.set(x + (x < 9 ? 1 : -1), y, corner); pix.set(x, y + (y < 9 ? 1 : -1), corner); }
  return { pix, labels };
}
