import { describeAppearance, describeBeing } from '../core/appearance';
import type { Model } from '../core/circles';
import { escapeHtml } from '../core/format';
import type { FlowResult } from '../core/flow';
import { byId } from './dom';
import { renderIllustration } from './illustration';

// Painel "Aparência da Magia": a ilustração (illustration.ts) e as notas em texto.

/** Desenha o painel (chamado a cada mudança do círculo) */
export function renderAppearance(m: Model, flow: FlowResult, title = ''): void {
  const ap = describeAppearance(m, flow);
  const svg = byId('appearanceSvg');
  svg.innerHTML = renderIllustration(ap, title);
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
