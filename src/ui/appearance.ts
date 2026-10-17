import { describeAppearance, type Appearance } from '../core/appearance';
import type { CircuitAnalysis } from '../core/analysis';
import { buildSpellSheet, type SpellSheet } from '../core/spellsheet';
import { rich } from './grimoire-runes';
import type { Model } from '../core/circles';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { PH, PW, renderPixelScene, type Label } from './pixel-scene';
import { INTENTION_SCENE_LIMIT } from './pixel-scene-layout';
import { createAppearanceAnimation } from './appearance-animation';

// A cena é ilustrativa. A ficha e os diagnósticos mantêm os valores reais do círculo.

const VW = 360;
const K = VW / PW;

let lastSceneKey = '';
let lastScene = '';
let initialFrames: { day?: string; night?: string } = {};
let animation: ReturnType<typeof createAppearanceAnimation> | undefined;
let appearanceReady = false;
let cleanupSetup: (() => void) | undefined;
const shownScenes = new WeakMap<Element, string>();

function updateScene(target: Element, scene: string): void {
  if (shownScenes.get(target) === scene) return;
  target.innerHTML = scene;
  shownScenes.set(target, scene);
}

function sceneSvg(ap: Appearance): string {
  const key = JSON.stringify(ap);
  if (key === lastSceneKey) return lastScene;
  const parts = (['day', 'night'] as const).map(mode => {
    const { pix, labels } = renderPixelScene(ap, mode === 'night');
    return { mode, url: pix.toDataURL(), labels };
  });
  const text = (x: number, y: number, t: string, size: number, anchor: string, fill: string, halo: string, cls: string): string =>
    `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-size="${size}" font-weight="600" fill="${fill}" stroke="${halo}" stroke-width="3" paint-order="stroke">${escapeHtml(t)}</text>`;
  const bond = (l: Label): string => {
    const letters = Array.from(l.text);
    const short = letters.length > 18 ? letters.slice(0, 17).join('') + '…' : l.text;
    return text(Math.max(100, Math.min(VW - 100, Math.round(l.x * K))), Math.max(18, Math.min(PH * K - 12, Math.round(l.y * K))), short, 10, 'middle', '#f6e6cd', '#241d30', 'ap-bond');
  };
  let out = '';
  parts.forEach(({ mode, url, labels }) => {
    const cls = mode === 'day' ? 'ap-day' : 'ap-night';
    out += `<g class="${cls}"><image href="${url}" x="0" y="0" width="${VW}" height="${PH * K}" preserveAspectRatio="none" class="ap-pixels"/>`;
    out += labels.map(bond).join('');
    out += '</g>';
  });
  initialFrames = Object.fromEntries(parts.map(({ mode, url }) => [mode, url]));
  lastSceneKey = key; lastScene = out;
  return lastScene;
}

/** Ficha da magia, como num livro de RPG */
function sheetHtml(sh: SpellSheet, ready: boolean): string {
  const head = `<div class="spell-sheet-head"><p class="spell-sheet-kicker">${ready ? 'Registro da magia' : 'Em construção'}</p><h4>${escapeHtml(sh.name)}</h4><p>${ready ? sh.tags.map(escapeHtml).join(' · ') : 'O próximo efeito começa nas suas runas.'}</p></div>`;
  if (!ready) return head + '<p class="spell-sheet-empty">Os efeitos e a descrição aparecerão aqui quando o círculo formar uma manifestação.</p>';
  return `${head}
    <dl class="spell-stats">${sh.stats.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
    ${sh.effects.length ? `<div class="spell-block"><h5>Efeito</h5>${sh.effects.map(e => `<p class="${e.perfect ? 'perfect' : ''}"><b>${e.perfect ? '★ ' : ''}${escapeHtml(e.title)}.</b> ${rich(e.text)}</p>`).join('')}</div>` : ''}
    <div class="spell-block"><h5>Descrição</h5>${sh.description.length ? sh.description.map(d => `<p>${escapeHtml(d)}</p>`).join('') : '<p class="muted">Ainda não há elemento nem formato no caminho da energia (que sai da Matriz e volta a ela): nada aparece na cena.</p>'}</div>
    <details class="spell-components"><summary>Selos e runas do círculo</summary><p>${escapeHtml(sh.components)}</p></details>`;
}

/** Release the preview clock and event observers when its view is replaced. */
export function teardownAppearance(): void {
  cleanupSetup?.();
  cleanupSetup = undefined;
  animation?.destroy();
  animation = undefined;
}

/** Amplia a mesma cena, sem gerar uma segunda interpretação da magia. */
export function setupAppearance(): void {
  teardownAppearance();
  const dialog = byId<HTMLDialogElement>('appearanceDialog');
  const trigger = byId<HTMLButtonElement>('btnExpandAppearance');
  const listeners: (() => void)[] = [];
  const listen = (element: EventTarget, type: string, handler: EventListener): void => {
    element.addEventListener(type, handler);
    listeners.push(() => element.removeEventListener(type, handler));
  };
  listen(trigger, 'click', () => { if (!dialog.open) dialog.showModal(); animation?.refresh(); });
  listen(byId('btnCloseAppearance'), 'click', () => dialog.close());
  listen(dialog, 'click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const pointer = event as MouseEvent;
    if (pointer.clientX < rect.left || pointer.clientX > rect.right || pointer.clientY < rect.top || pointer.clientY > rect.bottom) dialog.close();
  });
  listen(dialog, 'close', () => { animation?.refresh(); if (trigger.getClientRects().length) trigger.focus({ preventScroll: true }); });
  // Atalhos do editor não alteram o desenho por trás da janela de prévia.
  listen(dialog, 'keydown', event => { const key = event as KeyboardEvent; if ((key.ctrlKey || key.metaKey) && /^(z|y)$/i.test(key.key)) key.stopPropagation(); });
  const shell = document.getElementById('appShell');
  const observer = new MutationObserver(() => {
    if (dialog.open && shell && (shell.hidden || shell.dataset.rpgView !== 'circulos')) dialog.close();
    animation?.refresh();
  });
  if (shell) observer.observe(shell, { attributes: true, attributeFilter: ['hidden', 'data-rpg-view'] });
  animation = createAppearanceAnimation({
    inline: byId('appearanceSvg'), dialog, shell, themeRoot: document.body,
    buttons: ['btnToggleAppearanceAnimation', 'btnToggleExpandedAnimation'].flatMap(id => {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      return button ? [button] : [];
    }),
    isReady: () => appearanceReady,
    setFrame: (night, url, frame) => {
      for (const id of ['appearanceSvg', 'appearanceExpandedSvg']) {
        const svg = byId(id);
        svg.querySelector(`.${night ? 'ap-night' : 'ap-day'} image`)?.setAttribute('href', url);
        svg.dataset.animationFrame = String(frame);
      }
    }
  });
  cleanupSetup = () => { observer.disconnect(); listeners.forEach(remove => remove()); };
}

/** Desenha o painel (chamado a cada mudança do círculo) */
export function renderAppearance(m: Model, a: CircuitAnalysis, title = ''): void {
  const ap = describeAppearance(m, a.flow);
  const svg = byId('appearanceSvg');
  const scene = sceneSvg(ap);
  updateScene(svg, scene);
  const sheet = buildSpellSheet(m, a, ap, title);
  const said = sheet.description.join(' ');
  const label = 'Prévia ilustrativa da magia: ' + (said || 'nenhuma manifestação formada ainda.');
  svg.setAttribute('aria-label', label);
  const ready = ap.beings.length > 0;
  appearanceReady = ready;
  byId('appearanceCard').dataset.state = ready ? 'ready' : 'empty';
  const counts = ap.beings.flatMap(b => b.intentCount ? [b.intentCount] : []);
  const sampled = counts.some(count => BigInt(count) > BigInt(INTENTION_SCENE_LIMIT));
  const quantityNote = counts.length ? ` Quantidade indicada pela Intenção: ${counts.join(' · ')}.${sampled ? ` A prévia mostra uma amostra de até ${INTENTION_SCENE_LIMIT} cópias por manifestação.` : ''}` : '';
  const caption = ready ? 'Ilustração das runas do círculo. Consulte a energia para verificar a ativação.' + quantityNote : 'Adicione um elemento, formato ou conceito e feche o caminho de volta à Matriz.';
  byId('appearanceState').textContent = ready ? 'Efeito em cena' : 'Aguardando uma manifestação';
  byId('appearanceCaption').textContent = caption;
  const bonds = [...new Set(ap.beings.flatMap(being => being.intentBonds ?? (being.bond ? [being.bond] : [])))];
  const bindings = byId('appearanceBindings');
  bindings.hidden = !bonds.length;
  bindings.textContent = bonds.length ? 'Vínculos: ' + bonds.join(' · ') : '';
  const expanded = byId('appearanceExpandedSvg');
  updateScene(expanded, scene);
  expanded.setAttribute('aria-label', label);
  byId('appearanceDialogTitle').textContent = sheet.name;
  byId('appearanceExpandedCaption').textContent = bonds.length ? caption + ' Vínculos: ' + bonds.join(' · ') : caption;
  byId<HTMLButtonElement>('btnExpandAppearance').disabled = false;
  animation?.setSource(lastSceneKey, (night, frame) => renderPixelScene(ap, night, frame).pix.toDataURL(), initialFrames);
  const target = byId('spellSheet');
  const componentsOpen = target.querySelector<HTMLDetailsElement>('.spell-components')?.open;
  target.innerHTML = sheetHtml(sheet, ready);
  const components = target.querySelector<HTMLDetailsElement>('.spell-components');
  if (components && componentsOpen) components.open = true;
}
