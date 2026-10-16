import { escapeHtml } from '../core/format';
import type { Activation, Rune } from '../core/types';
import { sheetOf } from '../data/rules';
import { RUNES } from '../data/runes';
import { SHAPE_META } from '../data/shapes';
import type { ShapeId } from '../core/types';

// Tabela Geral e fichas das runas do Grimório, montadas a partir dos dados.
// Assim, quando o admin muda uma runa pelo site, o Grimório mostra o valor novo.

const STATES: Activation[] = ['ativacao', 'perfeito', 'instavel'];
const STATE_LABEL: Record<Activation, string> = { ativacao: 'Mínimo (Ativação)', perfeito: 'Perfeito', instavel: 'Instável' };

/** Número no jeito brasileiro (vírgula), sem zeros sobrando */
export const br = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

/** Texto da ficha: escapado, com **negrito** e `código` */
export function rich(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

const elementals = (): Rune[] => Object.values(RUNES).filter(r => r.category === 'elemental');

function energyText(r: Rune): string {
  if (r.costPerPower) return `Escala ${STATES.map(s => br(r.costPerPower?.[s] ?? 0) + 'x').join(' ~ ')} por Poder`;
  if (!r.stats) return '—';
  return STATES.map(s => br(r.stats?.[s].cost ?? 0)).join(' ~ ') + (r.variable ? ' (variável)' : '');
}
const powerText = (r: Rune): string => (r.stats ? STATES.map(s => br(r.stats?.[s].power ?? 0)).join(' ~ ') + (r.variable ? ' (variável)' : '') : '—');

/** Efeito para a Tabela Geral: o da ficha ou, se não tiver, a passiva da runa */
function effectOf(r: Rune): string {
  const s = sheetOf(r.id);
  if (s.effect) return rich(s.effect);
  const [name, rest] = (r.passive ?? '').split(' (');
  return name ? `<strong>${escapeHtml(name)}:</strong> ${escapeHtml((rest ?? '').replace(/\)$/, ''))}` : '—';
}
function effect2Of(r: Rune): string {
  const s = sheetOf(r.id);
  if (s.effect2) return rich(s.effect2);
  return escapeHtml((r.perfectEffect ?? '').trim()) || '—';
}

function generalTable(): string {
  const rows = elementals().map(r => `<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${energyText(r)}</td><td>${powerText(r)}</td><td>${effectOf(r)}</td><td>${effect2Of(r)}</td></tr>`).join('');
  return `<div class="grimoire-card">
  <h3>▤ Tabela Geral de Energia, Poder e Efeitos</h3>
  <p style="color:var(--text-muted);">Energia e Poder em Mínimo ~ Perfeito ~ Instável. São estes os números usados nos cálculos do site.</p>
  <div class="table-scroll"><table class="grimoire-table">
    <thead><tr><th>Runa</th><th>Energia</th><th>Poder</th><th>Efeito Principal</th><th>2º Estágio / Limite</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</div>`;
}

/** Ficha de uma runa: citação, função, tabela por estado e os efeitos */
export function runeCard(r: Rune): string {
  const s = sheetOf(r.id);
  const parts: string[] = [];
  const sigil = r.sigil && r.sigil !== r.name.match(/\((.+)\)/)?.[1] ? ` — Sigilo: ${escapeHtml(r.sigil)}` : '';
  parts.push(`<h3>ᚱ Runa de ${escapeHtml(r.name)}${sigil}</h3>`);
  if (s.quote) parts.push(`<div class="quote">${rich(s.quote)}</div>`);
  if (s.role) parts.push(`<p><strong>Função Principal:</strong> ${rich(s.role)}</p>`);
  if (r.stats) {
    const head = ['Estado', 'Poder', 'Energia (Custo)', ...s.columns.map(c => escapeHtml(c.name))];
    const rows = STATES.map(st => {
      const label = STATE_LABEL[st] + (s.stateNames[st] ? ` — ${escapeHtml(s.stateNames[st])}` : '');
      const cost = r.costPerPower ? `${br((r.stats?.[st].power ?? 0) * (r.costPerPower[st] ?? 1))} (${br(r.costPerPower[st] ?? 1)}x)` : br(r.stats?.[st].cost ?? 0);
      const extra = s.columns.map(c => `<td>${rich(c.values[st])}${c.unit && c.values[st] ? ' ' + escapeHtml(c.unit) : ''}</td>`).join('');
      return `<tr><td>${label}</td><td>${br(r.stats?.[st].power ?? 0)}</td><td>${cost}</td>${extra}</tr>`;
    }).join('');
    parts.push(`<div class="table-scroll"><table class="grimoire-table"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`);
  }
  if (r.missingPenalty) {
    const pct = Math.round(r.missingPenalty * 100);
    parts.push(`<p><strong>Componentes Faltantes:</strong> ${s.missing ? rich(s.missing) + ', aumentando' : 'Sem a matéria no ambiente, a runa cria artificialmente, aumentando'} o Custo de Mana em <strong>+${pct}%</strong>.</p>`);
  }
  const passive = s.passiveTitle || s.passiveText
    ? `<strong>Passiva${s.passiveTitle ? ` (${escapeHtml(s.passiveTitle)})` : ''}:</strong> ${rich(s.passiveText)}`
    : r.passive ? `<strong>Passiva:</strong> ${escapeHtml(r.passive)}` : '';
  if (passive) parts.push(`<p>${passive}</p>`);
  const perfect = s.perfectTitle || s.perfectText
    ? `<strong>Aplicação Perfeita${s.perfectTitle ? ` (${escapeHtml(s.perfectTitle)})` : ''}:</strong> ${rich(s.perfectText)}`
    : r.perfectEffect ? `<strong>Aplicação Perfeita:</strong> ${escapeHtml(r.perfectEffect.trim())}` : '';
  if (perfect) parts.push(`<p>${perfect}</p>`);
  if (s.notes) parts.push(`<p>${rich(s.notes)}</p>`);
  return `<div class="grimoire-card rune-sheet" id="ficha-${r.id}">\n  ${parts.join('\n  ')}\n</div>`;
}

/** Tudo: Tabela Geral + uma ficha por runa elemental */
export function renderRuneData(): string {
  return generalTable() + elementals().map(runeCard).join('\n');
}

const SEAL_SHAPES: Record<ShapeId, string> = {
  prism: '◇ Losango', square: '□ Quadrado', circle: '○ Círculo', triangle: '△ Triângulo', hexagon: '⬠ Pentágono', star: '☆ Estrela',
  corp: '◇ + □ sobrepostos', salor: '○ + △ inscritos', redor: '⬠ + ☆ inscritos'
};

/** Tabela dos selos (nome, função, energia em cada estado), com as mudanças do admin */
export function renderSealTable(): string {
  const rows = (Object.keys(SHAPE_META) as ShapeId[]).map(id => {
    const m = SHAPE_META[id];
    const [name, fn] = [m.name.split(' (')[0], (m.name.match(/\((.+)\)/)?.[1] ?? '')];
    return `<tr><td><strong>${escapeHtml(name)}</strong><br/><small>${escapeHtml(fn)}</small></td><td>${SEAL_SHAPES[id]}</td><td>${rich(m.role)}</td><td>${STATES.map(s => br(m.cost[s])).join(' ~ ')}${m.provisional ? '<br/><small>(provisório)</small>' : ''}</td></tr>`;
  }).join('');
  return `<div class="table-scroll"><table class="grimoire-table"><thead><tr><th>Selo</th><th>Formato</th><th>Função</th><th>Energia</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
