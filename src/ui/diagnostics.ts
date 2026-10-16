import { renderAppearance } from './appearance';
import { analyzeCircuit, tierLabel } from '../core/analysis';
import type { ConnectionMode } from '../core/types';
import { byId, inputValue } from './dom';
import { store } from './store';
import { renderMage } from './mage';

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
let appearanceTimer = 0;

export function renderDiagnostics(): void {
  const a = analyzeCircuit(store.state, {
    specMode: inputValue('globalSpecMode') as ConnectionMode,
    missingMat: inputValue('missingMatSelect') === 'missing',
    spellInfo: store.state.spellInfo
  });

  // A ilustração (com filtros de pintura) espera o arrasto parar um instante para não pesar
  window.clearTimeout(appearanceTimer);
  appearanceTimer = window.setTimeout(() => renderAppearance(store.state, a, store.state.spellInfo?.name ?? ''), 120);

  const m = a.metrics;
  const text: [string, string][] = [
    ['metricPower', m.power], ['metricPowerSub', m.powerSub],
    ['metricCost', m.cost], ['metricCostSub', m.costSub],
    ['metricIntensity', m.intensity], ['metricIntensitySub', m.intensitySub],
    ['metricVolume', m.volume], ['metricVolumeSub', m.volumeSub],
    ['loadValue', a.loadView.value], ['loadSub', a.loadView.sub]
  ];
  text.forEach(([id, value]) => { byId(id).textContent = value; });

  const tier = byId('tierBadge');
  // Check-list: uma magia pode ser de 2º e de 3º círculo ao mesmo tempo
  tier.textContent = a.tiers.map(t => (t === 1 ? tierLabel(1) : '✓ ' + tierLabel(t))).join(' · ');
  tier.classList.toggle('tier-2', a.tier > 1);
  tier.title = [
    a.tiers.includes(2) ? '2º: magia dentro de um Círculo/Quadrado' : '',
    a.tiers.includes(2.5) ? '2,5º: círculos sobrepostos unidos pela Estrela' : '',
    a.tiers.includes(3) ? '3º: círculos separados ligados por cabo' : ''
  ].filter(Boolean).join(' · ') || 'Magia de 1º círculo';

  // Bolinha na aba Resultado (computador): verde, amarela ou vermelha
  const dot = byId('rtabDot');
  dot.className = `rtab-dot${a.badge.kind === 'ok' ? '' : ' ' + a.badge.kind}`;
  dot.title = a.badge.text;

  const badge = byId('circuitStabilityBadge');
  badge.className = `status-badge ${BADGE_CLASS[a.badge.kind]}`;
  badge.textContent = a.badge.text;

  const fill = byId('loadFill');
  fill.style.width = `${a.loadView.fill}%`;
  fill.style.background = a.loadView.color;

  byId('loadBands').innerHTML = a.loadView.bands;
  renderMage(a.charge);

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
