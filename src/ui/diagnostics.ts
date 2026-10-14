import { analyzeCircuit } from '../core/analysis';
import type { ConnectionMode } from '../core/types';
import { byId, inputValue } from './dom';
import { store } from './store';

const BADGE_CLASS = { ok: 'status-ok', warn: 'status-warn', danger: 'status-danger' } as const;
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

  byId('circuitEffectLog').innerHTML = a.logs.map(l => `
        <div class="effect-entry">
          <strong>${l.title}</strong>
          <div>${l.text}</div>
        </div>
      `).join('');
}
