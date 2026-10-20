import './styles/index.css';
import { setupCharacter } from './ui/character';
import { setupAccount } from './cloud/account';
import { applyCachedRules, fetchRules } from './cloud/rules';
import { SHAPE_META } from './data/shapes';
import { setupRulesEditor } from './ui/rules-editor';
import { restoreEnergyView, setupMage } from './ui/mage';
import type { ShapeId } from './core/types';
import { PRESET_GROUPS, PRESETS } from './data/presets';
import { setupActions } from './ui/actions';
import { renderCanvas } from './ui/canvas';
import { renderDiagnostics, setupDiagnostics } from './ui/diagnostics';
import { byId } from './ui/dom';
import { loadPreset, updateSelectedCircle, updateCircleSettings, updateSelectedNode, updateSelectedNodeShape } from './ui/editor';
import { exportJson, exportPng, exportSkeleton, exportSvg, setupExportOptions, setupFileImport } from './ui/exporting';
import { refreshGrimoireRunes, setupGrimoire } from './ui/grimoire';
import { setupRulebook } from './ui/rulebook';
import { setupCanvasInteraction } from './ui/interaction';
import { restoreSnap, restoreStrokeStyle, restoreTheme, setStrokeStyle, setupLayout } from './ui/layout';
import { scheduleHistory, setupHistory } from './ui/history';
import { setupControls, syncControls } from './ui/controls';
import { renderConnections, renderInspector, renderRuneFilters, renderRunePalette } from './ui/panels';
import { onRender, onRenderPalette, render, renderPalette } from './ui/store';
import { renderIntentionFeedback } from './ui/intention-feedback';
import { setupIntentionCatalog } from './ui/intention-catalog';

// Ponto de entrada: monta a página e liga cada parte

/** Menu ★ Exemplos agrupado: caderno, Livro de Magias, estudos */
function buildPresetMenu(): void {
  const select = byId<HTMLSelectElement>('presetSelect');
  PRESET_GROUPS.forEach(([kind, label]) => {
    const group = document.createElement('optgroup');
    group.label = label;
    Object.entries(PRESETS).filter(([, p]) => p.info.kind === kind).forEach(([key, p]) => {
      group.appendChild(new Option(p.info.name, key));
    });
    select.appendChild(group);
  });
  select.addEventListener('change', () => { if (select.value) loadPreset(select.value); });
}

function wireInputs(): void {
  const on = (id: string, event: 'input' | 'change', fn: (value: string) => void): void => {
    const el = byId<HTMLInputElement | HTMLSelectElement>(id);
    el.addEventListener(event, () => fn(el.value));
  };
  on('runeSearch', 'input', () => renderPalette());
  on('bondInput', 'input', word => renderIntentionFeedback(word));
  on('ringStyleSelect', 'change', () => updateCircleSettings());
  on('strokeWidthRange', 'input', () => updateCircleSettings());
  on('gridToggleSelect', 'change', () => updateCircleSettings());
  on('strokeStyleSelect', 'change', v => setStrokeStyle(v));
  on('circleNameInput', 'change', v => updateSelectedCircle('name', v));
  on('circleFrameSelect', 'change', v => updateSelectedCircle('frame', v));
  on('circleShapeSelect', 'change', v => updateSelectedCircle('shape', v));
  on('circleRadiusRange', 'input', v => updateSelectedCircle('r', v));
  on('nodeShapeSelect', 'change', v => updateSelectedNodeShape(v as ShapeId));
  on('nodeSizeRange', 'input', v => updateSelectedNode('size', Number(v)));
  on('nodeSizeInput', 'change', v => updateSelectedNode('size', Math.min(160, Math.max(14, Math.round(Number(v) || 54)))));
  on('nodeRotRange', 'input', v => updateSelectedNode('rot', Number(v)));
  on('globalSpecMode', 'change', () => render());
  on('missingMatSelect', 'change', () => render());

  byId('btnExportPng').addEventListener('click', exportPng);
  byId('btnExportSvg').addEventListener('click', exportSvg);
  byId('btnExportJson').addEventListener('click', exportJson);
  byId('btnExportSkeleton').addEventListener('click', exportSkeleton);
  setupExportOptions();
  byId('btnImportJson').addEventListener('click', () => byId('fileInputJson').click());
}

/** Cartões de forma (Peças): o valor de cada forma vem das regras */
function refreshShapeCards(): void {
  document.querySelectorAll<HTMLElement>('.shape-card').forEach(card => {
    const shape = (card.dataset.action === 'select-prism' ? 'prism' : card.dataset.arg) as ShapeId | undefined;
    const meta = shape ? SHAPE_META[shape] : undefined;
    const p = card.querySelector('.shape-card-info p');
    if (!meta || !p) return;
    const label = (p.textContent ?? '').split(' · ')[0];
    const br = (n: number): string => String(n).replace('.', ',');
    p.textContent = `${label} · ${br(meta.cost.ativacao)}`;
    card.title = `${meta.role} (energia: ${br(meta.cost.ativacao)} ~ ${br(meta.cost.perfeito)} ~ ${br(meta.cost.instavel)})`;
  });
}

/** Regras mudaram (do banco ou do editor): redesenha tudo o que mostra os valores */
function refreshRules(): void {
  render();
  renderPalette();
  refreshGrimoireRunes();
  refreshShapeCards();
}

function start(): void {
  // As regras do aparelho valem antes do primeiro desenho; as do banco chegam logo depois
  applyCachedRules();
  restoreTheme();
  restoreStrokeStyle();
  restoreSnap();

  // O que redesenhar quando o círculo muda
  onRender(renderCanvas, { duringDrag: true });
  onRender(renderInspector);
  onRender(renderConnections);
  onRender(renderDiagnostics);
  onRender(syncControls); // por último: acompanha os valores que os painéis acabaram de pôr
  onRender(scheduleHistory);
  onRenderPalette(renderRunePalette);

  setupGrimoire();
  setupRulebook();
  buildPresetMenu();
  renderRuneFilters();
  setupControls();
  setupDiagnostics();
  setupMage();
  restoreEnergyView();
  setupHistory();
  setupActions();
  setupCanvasInteraction();
  setupLayout();
  wireInputs();
  setupIntentionCatalog();
  setupFileImport();
  setupAccount();
  setupRulesEditor(refreshRules);
  refreshShapeCards();

  // Abre com o Lança-Chamas, do caderno
  loadPreset('ex2');
  setupCharacter();
  void fetchRules(refreshRules);
}

start();
