import { analyzeCircuit } from '../core/analysis';
import type { ConnectionMode } from '../core/types';
import { byId, inputValue } from './dom';
import { store } from './store';

const BADGE_CLASS = { ok: 'status-ok', warn: 'status-warn', danger: 'status-danger' } as const;

/** Partes da leitura que a pessoa abriu ou fechou (pelo título); o resto segue o padrão */
const toggled = new Map<string, boolean>();
/** Quantas partes da leitura começam abertas */
const OPEN_BY_DEFAULT = 3;
const titleKey = (html: string): string => html.replace(/<[^>]*>/g, '').trim();

export function setupDiagnostics(): void {
  // Guarda só o que a pessoa abriu/fechou (o clique acontece antes de a parte virar)
  byId('circuitEffectLog').addEventListener('click', e => {
    const summary = (e.target as Element).closest('summary');
    const d = summary?.parentElement as HTMLDetailsElement | undefined;
    if (d?.dataset.key) toggled.set(d.dataset.key, !d.open);
  });
}
const CHIP_CLASS = { ok: 'lvl-ok', warn: 'lvl-warn', danger: 'lvl-danger' } as const;

/** Mostra o resultado da análise: números, selo, medidor de carga e a leitura do círculo */
export function renderDiagnostics(): void {
  const a = analyzeCircuit(store.state, {
    specMode: inputValue('globalSpecMode') as ConnectionMode,
    missingMat: inputValue('missingMatSelect') === 'missing',
    spellInfo: store.state.spellInfo
  });

  const m = a.metrics;
  const text: [string, string][] = [
    ['metricPower', m.power], ['metricPowerSub', m.powerSub],
    ['metricCost', m.cost], ['metricCostSub', m.costSub],
    ['metricIntensity', m.intensity], ['metricIntensitySub', m.intensitySub],
    ['metricVolume', m.volume], ['metricVolumeSub', m.volumeSub],
    ['loadValue', a.loadView.value], ['loadSub', a.loadView.sub]
  ];
  text.forEach(([id, value]) => { byId(id).textContent = value; });

  const badge = byId('circuitStabilityBadge');
  badge.className = `status-badge ${BADGE_CLASS[a.badge.kind]}`;
  badge.textContent = a.badge.text;

  const fill = byId('loadFill');
  fill.style.width = `${a.loadView.fill}%`;
  fill.style.background = a.loadView.color;

  const chip = byId('loadChip');
  chip.className = `load-chip ${CHIP_CLASS[a.loadView.chipLevel]}`;
  chip.textContent = a.loadView.chip;

  byId('circuitEffectLog').innerHTML = a.logs.map((l, i) => {
    const key = titleKey(l.title);
    const open = toggled.get(key) ?? i < OPEN_BY_DEFAULT;
    return `
        <details class="effect-entry" data-key="${key.replace(/"/g, '&quot;')}"${open ? ' open' : ''}>
          <summary><strong>${l.title}</strong></summary>
          <div>${l.text}</div>
        </details>`;
  }).join('');
}
