import './styles/index.css';
import { setupAccount } from './cloud/account';
import type { Activation, ShapeId } from './core/types';
import { PRESET_GROUPS, PRESETS } from './data/presets';
import { setupActions } from './ui/actions';
import { renderCanvas } from './ui/canvas';
import { renderDiagnostics } from './ui/diagnostics';
import { byId } from './ui/dom';
import { loadPreset, updateCircleSettings, updateSelectedNode, updateSelectedNodeShape } from './ui/editor';
import { exportJson, exportPng, exportSvg, setupFileImport } from './ui/exporting';
import { setupGrimoire } from './ui/grimoire';
import { setupCanvasInteraction } from './ui/interaction';
import { restoreTheme, setupLayout } from './ui/layout';
import { renderConnections, renderInspector, renderRuneLegend, renderRunePalette } from './ui/panels';
import { onRender, onRenderPalette, render, renderPalette } from './ui/store';

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
  on('ringStyleSelect', 'change', () => updateCircleSettings());
  on('strokeWidthRange', 'input', () => updateCircleSettings());
  on('gridToggleSelect', 'change', () => updateCircleSettings());
  on('nodeShapeSelect', 'change', v => updateSelectedNodeShape(v as ShapeId));
  on('nodeStateSelect', 'change', v => updateSelectedNode('activation', v as Activation));
  on('nodeSizeRange', 'input', v => updateSelectedNode('size', Number(v)));
  on('nodeRotRange', 'input', v => updateSelectedNode('rot', Number(v)));
  on('nodeChargeInput', 'change', v => updateSelectedNode('charge', Math.max(1, Number(v) || 1)));
  on('globalSpecMode', 'change', () => render());
  on('missingMatSelect', 'change', () => render());

  byId('btnExportPng').addEventListener('click', exportPng);
  byId('btnExportSvg').addEventListener('click', exportSvg);
  byId('btnExportJson').addEventListener('click', exportJson);
  byId('btnImportJson').addEventListener('click', () => byId('fileInputJson').click());
}

function start(): void {
  restoreTheme();

  // O que redesenhar quando o círculo muda
  onRender(renderCanvas);
  onRender(renderInspector);
  onRender(renderConnections);
  onRender(renderDiagnostics);
  onRenderPalette(renderRunePalette);

  setupGrimoire();
  buildPresetMenu();
  renderRuneLegend();
  setupActions();
  setupCanvasInteraction();
  setupLayout();
  wireInputs();
  setupFileImport();
  setupAccount();

  // Abre com o Lança-Chamas, do caderno
  loadPreset('ex2');
}

start();
