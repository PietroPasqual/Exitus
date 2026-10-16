import { ringPolygon } from '../core/geometry';
import type { RingShape, RingStyle } from '../core/types';
import { jitter, seeded, sketchCircle, sketchPolygon, type Pt, type Rand } from './sketch';

// Enfeites do anel externo: inscrições rúnicas, pontos e losangos.
// O anel não muda durante o arrasto, então cada desenho é calculado uma vez e guardado.

/** Runas decorativas (inspiradas no Futhark antigo). Traços numa caixa de -4..4 × -7..7, y negativo = para fora */
const GLYPHS = [
  'M0,-7L0,7M0,-7L4,-3M0,-2L4,2',
  'M-3,7L-3,-7L3,-3L3,7',
  'M-2,-7L-2,7M-2,-4L3,0L-2,4',
  'M-2,-7L-2,7M-2,-7L3,-4M-2,-2L3,1',
  'M-3,7L-3,-7L3,-4L-3,0L3,7',
  'M3,-6L-3,0L3,6',
  'M-4,-7L4,7M4,-7L-4,7',
  'M-3,7L-3,-7L3,-4L-3,-1',
  'M-3,-7L-3,7M3,-7L3,7M-3,-3L3,3',
  'M0,-7L0,7M-3,-3L3,3',
  'M-1,-7L-4,-3L-1,1M1,-1L4,3L1,7',
  'M0,-7L0,7M0,-7L3,-4M0,7L-3,4',
  'M0,-7L0,7M0,-2L-4,-7M0,-2L4,-7',
  'M3,-7L-3,-2L3,2L-3,7',
  'M0,-7L0,7M-4,-3L0,-7L4,-3',
  'M-3,-7L-3,7M-3,-7L2,-4L-3,0L2,4L-3,7',
  'M-3,7L-3,-7L0,-3L3,-7L3,7',
  'M-3,7L-3,-7L3,-1M3,7L3,-7L-3,-1',
  'M-2,7L-2,-7L3,-3',
  'M0,-6L4,0L0,6L-4,0Z',
  'M-4,-6L-4,6L4,-6L4,6Z',
  'M-4,7L3,-1L0,-7L-3,-1L4,7'
];

const f = (n: number): string => n.toFixed(1);

/**
 * Ponto local (x ao longo do anel, y para dentro/fora) levado para o anel de raio r,
 * no ângulo a (0 = topo, sentido horário).
 */
function place(cx: number, cy: number, r: number, a: number, x: number, y: number): string {
  const s = Math.sin(a), c = Math.cos(a);
  const px = cx + (r - y) * s + x * c;
  const py = cy - (r - y) * c + x * s;
  return `${f(px)},${f(py)}`;
}

/**
 * Desenha um caminho M/L/Z (coordenadas locais) em volta do anel.
 * tilt gira a letra um pouquinho (letra escrita à mão).
 */
function placePath(d: string, cx: number, cy: number, r: number, a: number, scale = 1, tilt = 0): string {
  const s = Math.sin(tilt), c = Math.cos(tilt);
  return d.replace(/([ML])(-?[\d.]+),(-?[\d.]+)/g, (_, cmd: string, x: string, y: string) => {
    const gx = Number(x) * scale, gy = Number(y) * scale;
    return cmd + place(cx, cy, r, a, gx * c - gy * s, gx * s + gy * c);
  });
}

/** Losango sobre o anel (pedra de engaste); com rand, os cantos ficam um pouco tortos */
function stud(cx: number, cy: number, r: number, a: number, h: number, w: number, rand: Rand | null = null): string {
  const j = (v: number): number => (rand ? v + jitter(rand, 0.35) : v);
  return `M${place(cx, cy, r, a, j(0), j(-h))}L${place(cx, cy, r, a, j(w), j(0))}L${place(cx, cy, r, a, j(0), j(h))}L${place(cx, cy, r, a, j(-w), j(0))}Z`;
}

function dots(cx: number, cy: number, r: number, count: number, rDot: number, skip: (i: number) => boolean = () => false): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    if (skip(i)) continue;
    const a = (i / count) * Math.PI * 2;
    out += `<circle cx="${f(cx + Math.sin(a) * r)}" cy="${f(cy - Math.cos(a) * r)}" r="${rDot}"/>`;
  }
  return out;
}

const cache = new Map<string, string>();

/**
 * Anel externo completo (traços + enfeites) de um círculo.
 * sketchy = traço à mão (pergaminho); seed deixa cada círculo com o seu próprio "rabisco".
 */
export function renderRing(style: RingStyle, cx: number, cy: number, sw: number, sketchy = false, seed = '', shape?: RingShape): string {
  if (shape) return renderShapedRing(shape, style, cx, cy, sw, sketchy, seed);
  const key = `${style}|${cx}|${cy}|${sw}|${sketchy}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ink = 'var(--stroke-circle)';
  const rand = sketchy ? seeded(`r|${seed}|${style}`) : null;
  let html = '';
  let studs = '';

  /** Um traço do anel: compasso (limpo) ou duas passadas de pena (à mão) */
  const ring = (r: number, w: number, opacity = 1): string => {
    const op = opacity < 1 ? ` opacity="${opacity}"` : '';
    if (!rand) return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${ink}" stroke-width="${w}" fill="none"${op}/>`;
    const main = `<path d="${sketchCircle(cx, cy, r, rand)}" stroke="${ink}" stroke-width="${(w * 0.8).toFixed(2)}" fill="none" stroke-linecap="round"${op}/>`;
    if (w < 2) return main;
    return main + `<path d="${sketchCircle(cx, cy, r, rand)}" stroke="${ink}" stroke-width="${(w * 0.45).toFixed(2)}" fill="none" stroke-linecap="round" opacity="${(0.55 * opacity).toFixed(2)}"/>`;
  };

  if (style === 'single') {
    html += ring(285, sw * 1.45);
    html += ring(273, 1, 0.55);
    html += ring(296, 1, 0.45);
    for (let i = 0; i < 4; i++) studs += stud(cx, cy, 285, (i * Math.PI) / 2, 10, 6.5, rand);
    html += `<g fill="${ink}" opacity="0.7">${dots(cx, cy, 296, 8, 2.2, i => i % 2 === 0)}</g>`;
  } else if (style === 'double') {
    html += ring(292, sw * 1.3);
    html += ring(274, sw * 0.55);
    // Pontos entre os dois anéis, abrindo espaço para os losangos
    html += `<g fill="${ink}" opacity="0.75">${dots(cx, cy, 283, 64, 1.5, i => i % 8 === 0)}</g>`;
    for (let i = 0; i < 8; i++) studs += stud(cx, cy, 283, (i * Math.PI) / 4, 7.5, 5, rand);
  } else {
    html += ring(296, sw * 1.25);
    html += ring(270, sw * 0.55);
    // Faixa de runas entre os anéis; a cada 9 posições, um losango separa as "palavras"
    const slots = 72;
    let glyphs = '';
    for (let i = 0; i < slots; i++) {
      const a = (i / slots) * Math.PI * 2;
      if (i % 9 === 0) {
        studs += stud(cx, cy, 283, a, 6.5, 4.5, rand);
        continue;
      }
      const g = GLYPHS[(i * 7) % GLYPHS.length];
      glyphs += rand
        ? placePath(g, cx, cy, 283 + jitter(rand, 0.5), a + jitter(rand, 0.003), 0.92 + rand() * 0.06, jitter(rand, 0.05))
        : placePath(g, cx, cy, 283, a, 0.95);
    }
    html += `<path d="${glyphs}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>`;
  }

  html += `<path d="${studs}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round" fill="var(--accent)"/>`;
  const out = `<g class="ring">${html}</g>`;
  cache.set(key, out);
  return out;
}

/** Glifo colocado num ponto da borda, deitado ao longo dela (t = direção da borda, u = para fora) */
function placeAlong(d: string, px: number, py: number, t: Pt, u: Pt, scale: number): string {
  return d.replace(/([ML])(-?[\d.]+),(-?[\d.]+)/g, (_, cmd: string, x: string, y: string) => {
    const gx = Number(x) * scale, gy = Number(y) * scale;
    return `${cmd}${f(px + gx * t[0] - gy * u[0])},${f(py + gx * t[1] - gy * u[1])}`;
  });
}

/**
 * Anel de fora com o formato de um selo (losango, quadrado, triângulo, pentágono ou estrela),
 * nos mesmos três estilos do anel redondo: único, duplo e com inscrições rúnicas.
 */
function renderShapedRing(shape: RingShape, style: RingStyle, cx: number, cy: number, sw: number, sketchy: boolean, seed: string): string {
  const key = `shape:${shape}|${style}|${cx}|${cy}|${sw}|${sketchy}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ink = 'var(--stroke-circle)';
  const rand = sketchy ? seeded(`rs|${seed}|${shape}|${style}`) : null;
  const poly = (r: number): Pt[] => ringPolygon(shape, r).map(([x, y]) => [cx + x, cy + y] as Pt);
  const line = (r: number, w: number, opacity = 1): string => {
    const op = opacity < 1 ? ` opacity="${opacity}"` : '';
    const pts = poly(r);
    if (!rand) return `<polygon points="${pts.map(p => `${f(p[0])},${f(p[1])}`).join(' ')}" stroke="${ink}" stroke-width="${w}" fill="none" stroke-linejoin="round"${op}/>`;
    const main = `<path d="${sketchPolygon(pts, rand, 2)}" stroke="${ink}" stroke-width="${(w * 0.8).toFixed(2)}" fill="none" stroke-linecap="round"${op}/>`;
    if (w < 2) return main;
    return main + `<path d="${sketchPolygon(pts, rand, 1)}" stroke="${ink}" stroke-width="${(w * 0.45).toFixed(2)}" fill="none" stroke-linecap="round" opacity="${(0.55 * opacity).toFixed(2)}"/>`;
  };
  // Losangos nos cantos (como pedras de engaste)
  const corners = (r: number, h: number, w: number): string => ringPolygon(shape, r)
    .filter((_, i) => shape !== 'star' || i % 2 === 0)
    .map(([x, y]) => stud(cx, cy, Math.hypot(x, y), Math.atan2(x, -y), h, w, rand)).join('');

  let html = '';
  let studs = '';
  if (style === 'single') {
    html += line(285, sw * 1.45) + line(273, 1, 0.55) + line(296, 1, 0.45);
    studs += corners(285, 10, 6.5);
  } else if (style === 'double') {
    html += line(292, sw * 1.3) + line(274, sw * 0.55);
    studs += corners(283, 7.5, 5);
  } else {
    html += line(296, sw * 1.25) + line(270, sw * 0.55);
    studs += corners(283, 6.5, 4.5);
    // Faixa de runas ao longo da borda, entre os dois traços (longe dos cantos)
    const pts = poly(283);
    const edges = pts.map((p, i) => [p, pts[(i + 1) % pts.length]] as [Pt, Pt]);
    const step = 15.5;
    let glyphs = '', k = 0;
    edges.forEach(([p, q]) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const t: Pt = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
      const u: Pt = [t[1], -t[0]];
      const n = Math.max(0, Math.floor((len - 24) / step));
      const start = (len - (n - 1) * step) / 2;
      for (let i = 0; i < n; i++, k++) {
        const d = start + i * step;
        const g = GLYPHS[(k * 7) % GLYPHS.length];
        glyphs += placeAlong(g, p[0] + t[0] * d, p[1] + t[1] * d, t, u, rand ? 0.9 + rand() * 0.06 : 0.92);
      }
    });
    html += `<path d="${glyphs}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>`;
  }
  html += `<path d="${studs}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round" fill="var(--accent)"/>`;
  const out = `<g class="ring">${html}</g>`;
  cache.set(key, out);
  return out;
}
