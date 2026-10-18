import { byId, setHint as setHintText } from './dom';
import { render, store } from './store';

// Abas e vistas (tablet e celular), menu de exportar e tema

export type View = 'pecas' | 'ligacoes' | 'mago' | 'no' | 'resultado';
export type LeftTab = 'tab-build' | 'tab-circle' | 'tab-mage';

/** Layout compacto (tablet, celular em pé ou deitado): um painel por vez */
export const COMPACT_QUERY = '(max-width: 1199px), (orientation: landscape) and (max-height: 520px)';

/** Em pé (celular e tablet): desenho em cima e menu embaixo, que pode ser ampliado */
const PORTRAIT_QUERY = '(max-width: 1199px) and (orientation: portrait)';

// ---------- Menu ampliável (celular e tablet em pé) ----------

export function setSheet(tall: boolean): void {
  if (tall) document.body.dataset.sheet = 'tall';
  else delete document.body.dataset.sheet;
  byId('sheetLabel').textContent = tall ? 'Ver o desenho maior' : 'Ampliar menu';
  byId('sheetHandle').setAttribute('aria-expanded', String(tall));
}

const sheetIsTall = (): boolean => document.body.dataset.sheet === 'tall';

/**
 * Alça entre o desenho e o menu: toque alterna, arrastar para cima amplia e para baixo reduz.
 * O toque simples só muda no "click" (fim do toque): se mudasse antes, o menu subiria
 * debaixo do dedo e o mesmo toque apertaria o botão que parou ali.
 */
function setupSheetHandle(): void {
  const handle = byId('sheetHandle');
  let startY: number | null = null;
  let dragged = false;
  handle.addEventListener('pointerdown', e => {
    startY = e.clientY;
    dragged = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', e => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    startY = null;
    if (Math.abs(dy) > 24) {
      dragged = true;
      setSheet(dy < 0);
    }
  });
  handle.addEventListener('pointercancel', () => { startY = null; });
  handle.addEventListener('click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    setSheet(!sheetIsTall());
  });
}

/** Amplia o menu em pé quando o conteúdo pedido é longo (lista de runas, resultado) */
function growSheet(): void {
  if (window.matchMedia(PORTRAIT_QUERY).matches) setSheet(true);
}

/** Abas do painel esquerdo no computador: Formas & Runas | Ligações & Anel | Mago & Pergaminho */
export function showLeftTab(target: LeftTab): void {
  document.querySelectorAll<HTMLElement>('.panel-left > .panel-tabs .tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === target));
  (['tab-build', 'tab-circle', 'tab-mage'] as const).forEach(id => { byId(id).hidden = target !== id; });
}

/** Vistas do tablet/celular: Peças, Ligações, Nó, Resultado */
export function setView(view: View): void {
  document.body.dataset.view = view;
  document.querySelectorAll<HTMLElement>('#viewNav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'pecas') showLeftTab('tab-build');
  if (view === 'ligacoes') showLeftTab('tab-circle');
  if (view === 'mago') showLeftTab('tab-mage');
}

/** Painel da direita no computador: Nó | Resultado (no tablet e no celular são as abas de vista) */
export type RightTab = 'no' | 'resultado';
let rightTab: RightTab = 'no';

export function showRightTab(tab: RightTab): void {
  rightTab = tab;
  document.querySelectorAll<HTMLElement>('.right-tabs .tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.rtab === tab));
  syncRightTabs();
}

/** As abas da direita só valem no computador */
function syncRightTabs(): void {
  if (window.matchMedia(COMPACT_QUERY).matches) delete document.body.dataset.rtab;
  else document.body.dataset.rtab = rightTab;
}

/** Selecionou outro selo: no computador, mostra o painel do Nó */
export function focusNodePanel(): void {
  if (!window.matchMedia(COMPACT_QUERY).matches && rightTab !== 'no') showRightTab('no');
}

/** Selo de carga no desenho: abre o Resultado */
export function showLoadDetails(): void {
  if (window.matchMedia(COMPACT_QUERY).matches) setView('resultado');
  else showRightTab('resultado');
  growSheet();
  byId('loadMeter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** "Trocar" a runa no painel da forma: leva à lista de runas */
export function goToRunes(): void {
  if (window.matchMedia(COMPACT_QUERY).matches) setView('pecas');
  else showLeftTab('tab-build');
  growSheet();
  byId('runeSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Tema (lembra a escolha neste aparelho) ----------

const THEME_KEY = 'circulos-tema';

/** Os 3 temas: Pergaminho (claro), Grimório (escuro) e Caderno (folha pautada) */
export type Theme = 'pergaminho' | 'grimorio' | 'pauta';
const THEMES: Theme[] = ['pergaminho', 'grimorio', 'pauta'];
const THEME_NAMES: Record<Theme, string> = { pergaminho: 'Pergaminho', grimorio: 'Grimório', pauta: 'Caderno' };
const THEME_BAR: Record<Theme, string> = { pergaminho: '#493222', grimorio: '#081426', pauta: '#493222' };

export const currentTheme = (): Theme =>
  document.body.classList.contains('theme-pauta') ? 'pauta' : document.body.classList.contains('theme-sketch') ? 'pergaminho' : 'grimorio';

function applyTheme(theme: Theme): void {
  // O Caderno é um tema claro: usa a base do Pergaminho com as próprias cores por cima
  document.body.classList.toggle('theme-sketch', theme !== 'grimorio');
  document.body.classList.toggle('theme-pauta', theme === 'pauta');
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR[theme]);
  const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  const btn = document.getElementById('btnToggleTheme');
  const label = `Tema: ${THEME_NAMES[theme]} — toque para ${THEME_NAMES[next]}`;
  btn?.setAttribute('title', label);
  btn?.setAttribute('aria-label', label);
}

export function restoreTheme(): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    // sem armazenamento: fica no tema Grimório
  }
  // 'caderno' era o nome antigo do tema claro (hoje Pergaminho)
  applyTheme(saved === 'pergaminho' || saved === 'caderno' ? 'pergaminho' : saved === 'pauta' ? 'pauta' : 'grimorio');
}

// ---------- Traço do desenho (também lembrado no aparelho) ----------

const STROKE_KEY = 'circulos-traco';

export function restoreStrokeStyle(): void {
  try {
    if (localStorage.getItem(STROKE_KEY) === 'clean') store.state.sketchy = false;
  } catch {
    // sem armazenamento: fica rabiscado
  }
  byId<HTMLSelectElement>('strokeStyleSelect').value = store.state.sketchy ? 'sketch' : 'clean';
}

export function setStrokeStyle(value: string): void {
  store.state.sketchy = value !== 'clean';
  try {
    localStorage.setItem(STROKE_KEY, store.state.sketchy ? 'sketch' : 'clean');
  } catch {
    // ignora
  }
  render();
}

// ---------- Ímã polar (lembrado no aparelho) ----------

const SNAP_KEY = 'circulos-ima';

export function restoreSnap(): void {
  try {
    store.state.snap = localStorage.getItem(SNAP_KEY) === '1';
  } catch {
    // sem armazenamento: ímã desligado
  }
  syncSnapButtons();
}

function syncSnapButtons(): void {
  document.querySelectorAll('[data-action="toggle-snap"]').forEach(b => b.setAttribute('aria-pressed', String(store.state.snap)));
}

export function toggleSnap(): void {
  store.state.snap = !store.state.snap;
  try {
    localStorage.setItem(SNAP_KEY, store.state.snap ? '1' : '0');
  } catch {
    // ignora
  }
  syncSnapButtons();
  setHintText(store.state.snap ? 'Ímã ligado: ao arrastar, a forma gruda em ângulos de 15° e nas mesmas distâncias do centro.' : 'Ímã desligado.');
}

/** Passa para o próximo tema: Pergaminho → Grimório → Caderno → Pergaminho */
export function toggleTheme(): void {
  const next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
  applyTheme(next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // ignora
  }
  setHintText(`Tema ${THEME_NAMES[next]}.`);
  render();
}

// ---------- Abas e menu ----------

/** Disclosures do editor móvel: os mesmos controles continuam disponíveis no computador. */
export function setupEditorDisclosures(): void {
  const pairs = [
    ['btnEditorMenu', 'editorMenuActions'],
    ['btnEditorTools', 'editorToolActions']
  ].flatMap(([buttonId, panelId]) => {
    const button = document.getElementById(buttonId);
    const panel = document.getElementById(panelId);
    return button && panel ? [{ button, panel }] : [];
  });
  const close = ({ button, panel }: typeof pairs[number]): void => {
    if (button.getAttribute('aria-expanded') !== 'true') return;
    if (panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    button.setAttribute('aria-expanded', 'false');
    panel.classList.remove('is-open');
    panel.querySelectorAll('details[open]').forEach(menu => menu.removeAttribute('open'));
  };
  pairs.forEach(pair => {
    pair.button.addEventListener('click', () => {
      const open = pair.button.getAttribute('aria-expanded') !== 'true';
      pairs.forEach(close);
      if (open) {
        pair.button.setAttribute('aria-expanded', 'true');
        pair.panel.classList.add('is-open');
      }
    });
  });
  document.addEventListener('click', event => {
    const target = event.target as Element;
    pairs.forEach(pair => {
      if (pair.button.contains(target)) return;
      if (!pair.panel.contains(target) || target.closest('button')) close(pair);
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = pairs.find(pair => pair.button.getAttribute('aria-expanded') === 'true');
    if (!open) return;
    // Primeiro fecha o submenu de exportação, depois o menu principal.
    const nested = open.panel.querySelector<HTMLDetailsElement>('details[open]');
    if (nested) {
      nested.open = false;
      nested.querySelector<HTMLElement>('summary')?.focus();
    } else {
      close(open);
      open.button.focus({ preventScroll: true });
    }
    event.preventDefault();
  });
  window.matchMedia('(max-width: 699px)').addEventListener('change', () => pairs.forEach(close));
  const shell = document.getElementById('appShell');
  if (shell && pairs.length) new MutationObserver(() => pairs.forEach(close))
    .observe(shell, { attributes: true, attributeFilter: ['data-rpg-view'] });
}

export function setupLayout(): void {
  setupEditorDisclosures();
  document.querySelectorAll<HTMLElement>('.panel-left > .panel-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showLeftTab(btn.dataset.tab as LeftTab));
  });
  document.querySelectorAll<HTMLElement>('.right-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showRightTab(btn.dataset.rtab as RightTab));
  });
  window.matchMedia(COMPACT_QUERY).addEventListener('change', syncRightTabs);
  syncRightTabs();
  document.querySelectorAll<HTMLElement>('#viewNav button').forEach(btn => {
    btn.addEventListener('click', () => {
      // Tocar de novo na aba aberta amplia/reduz o menu (em pé)
      if (btn.classList.contains('active') && window.matchMedia(PORTRAIT_QUERY).matches) setSheet(!sheetIsTall());
      else setView(btn.dataset.view as View);
    });
  });
  setView('pecas');
  setupSheetHandle();

  // Menu de exportar: fecha ao escolher uma opção ou tocar fora
  const fileMenu = byId<HTMLDetailsElement>('fileMenu');
  fileMenu.querySelectorAll('.menu-list .btn').forEach(b => b.addEventListener('click', () => fileMenu.removeAttribute('open')));
  document.addEventListener('click', evt => {
    if (fileMenu.open && !fileMenu.contains(evt.target as Node)) fileMenu.removeAttribute('open');
  });
}
