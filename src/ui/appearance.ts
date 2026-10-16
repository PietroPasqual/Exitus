import { describeAppearance, describeBeing, type Appearance } from '../core/appearance';
import type { Model } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { FlowResult } from '../core/flow';
import { byId } from './dom';
import { PH, PW, renderPixelScene, type Label } from './pixel-scene';

// Painel "Aparência da Magia": a cena em pixel art (dia nos temas claros, noite no escuro)
// e as notas em texto. Os textos (nome da magia, palavra de vínculo) vão por cima, em SVG.

const VW = 360;
const K = VW / PW;

function sceneSvg(ap: Appearance, title: string): string {
  const parts = (['day', 'night'] as const).map(mode => {
    const { pix, labels } = renderPixelScene(ap, mode === 'night');
    return { mode, url: pix.toDataURL(), labels };
  });
  const text = (x: number, y: number, t: string, size: number, anchor: string, fill: string, halo: string, cls: string): string =>
    `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" font-family="'Silkscreen', monospace" font-size="${size}" font-weight="700" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${escapeHtml(t)}</text>`;
  const bond = (l: Label, cls: string): string => text(Math.round(l.x * K), Math.round(l.y * K), `✦ ${l.text} ✦`, 10, 'middle', '#f3d9fa', '#4a1660', cls);
  let out = '';
  parts.forEach(({ mode, url, labels }) => {
    const cls = mode === 'day' ? 'ap-day' : 'ap-night';
    out += `<g class="${cls}"><image href="${url}" x="0" y="0" width="${VW}" height="${PH * K}" preserveAspectRatio="none" class="ap-pixels"/>`;
    out += labels.map(l => bond(l, '')).join('');
    if (title) out += text(12, 20, title.toUpperCase(), 12, 'start', mode === 'day' ? '#fff8e6' : '#f5ecd8', mode === 'day' ? '#2a2f78' : '#0a0d1c', '');
    if (!ap.beings.length) out += text(VW / 2, 100, 'Nada aparece na cena ainda', 11, 'middle', '#fff8e6', '#2a2f78', '');
    out += '</g>';
  });
  return out;
}

/** Desenha o painel (chamado a cada mudança do círculo) */
export function renderAppearance(m: Model, flow: FlowResult, title = ''): void {
  const ap = describeAppearance(m, flow);
  const svg = byId('appearanceSvg');
  svg.innerHTML = sceneSvg(ap, title);
  // Seres iguais (ex.: as 4 bolas de fogo) viram uma linha só: "4× …"
  const counts = new Map<string, number>();
  ap.beings.map(b => describeBeing(b, ap.orbitCount)).forEach(n => counts.set(n, (counts.get(n) ?? 0) + 1));
  const notes = [...counts].map(([n, c]) => (c > 1 ? `${c}× ${n}` : n));
  const empty = 'Ainda não há elemento nem formato no caminho da energia (que sai da Matriz e volta a ela): nada aparece na cena.';
  svg.setAttribute('aria-label', 'Aparência da magia: ' + (notes.length ? notes.join(' ') : empty));
  byId('appearanceNotes').innerHTML = notes.length
    ? notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')
    : `<li class="muted">${empty}</li>`;
}
