import type { RingStyle } from '../core/types';

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

/** Desenha um caminho M/L/Z (coordenadas locais) em volta do anel */
function placePath(d: string, cx: number, cy: number, r: number, a: number, scale = 1): string {
  return d.replace(/([ML])(-?[\d.]+),(-?[\d.]+)/g, (_, cmd: string, x: string, y: string) =>
    cmd + place(cx, cy, r, a, Number(x) * scale, Number(y) * scale));
}

/** Losango sobre o anel (pedra de engaste) */
function stud(cx: number, cy: number, r: number, a: number, h: number, w: number): string {
  return `M${place(cx, cy, r, a, 0, -h)}L${place(cx, cy, r, a, w, 0)}L${place(cx, cy, r, a, 0, h)}L${place(cx, cy, r, a, -w, 0)}Z`;
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

/** Anel externo completo (traços + enfeites) de um círculo */
export function renderRing(style: RingStyle, cx: number, cy: number, sw: number): string {
  const key = `${style}|${cx}|${cy}|${sw}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const ink = 'var(--stroke-circle)';
  let html = '';
  let studs = '';

  if (style === 'single') {
    html += `<circle cx="${cx}" cy="${cy}" r="285" stroke="${ink}" stroke-width="${sw * 1.45}" fill="none"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="273" stroke="${ink}" stroke-width="1" fill="none" opacity="0.55"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="296" stroke="${ink}" stroke-width="1" fill="none" opacity="0.45"/>`;
    for (let i = 0; i < 4; i++) studs += stud(cx, cy, 285, (i * Math.PI) / 2, 10, 6.5);
    html += `<g fill="${ink}" opacity="0.7">${dots(cx, cy, 296, 8, 2.2, i => i % 2 === 0)}</g>`;
  } else if (style === 'double') {
    html += `<circle cx="${cx}" cy="${cy}" r="292" stroke="${ink}" stroke-width="${sw * 1.3}" fill="none"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="274" stroke="${ink}" stroke-width="${sw * 0.55}" fill="none"/>`;
    // Pontos entre os dois anéis, abrindo espaço para os losangos
    html += `<g fill="${ink}" opacity="0.75">${dots(cx, cy, 283, 64, 1.5, i => i % 8 === 0)}</g>`;
    for (let i = 0; i < 8; i++) studs += stud(cx, cy, 283, (i * Math.PI) / 4, 7.5, 5);
  } else {
    html += `<circle cx="${cx}" cy="${cy}" r="296" stroke="${ink}" stroke-width="${sw * 1.25}" fill="none"/>`;
    html += `<circle cx="${cx}" cy="${cy}" r="270" stroke="${ink}" stroke-width="${sw * 0.55}" fill="none"/>`;
    // Faixa de runas entre os anéis; a cada 9 posições, um losango separa as "palavras"
    const slots = 72;
    let glyphs = '';
    for (let i = 0; i < slots; i++) {
      const a = (i / slots) * Math.PI * 2;
      if (i % 9 === 0) {
        studs += stud(cx, cy, 283, a, 6.5, 4.5);
        continue;
      }
      glyphs += placePath(GLYPHS[(i * 7) % GLYPHS.length], cx, cy, 283, a, 0.95);
    }
    html += `<path d="${glyphs}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.85"/>`;
  }

  html += `<path d="${studs}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round" fill="var(--accent)"/>`;
  const out = `<g class="ring">${html}</g>`;
  cache.set(key, out);
  return out;
}
