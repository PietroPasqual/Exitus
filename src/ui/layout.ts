import { byId } from './dom';
import { render, store } from './store';

// Abas e vistas (tablet e celular), menu de exportar e tema

export type View = 'pecas' | 'ligacoes' | 'no' | 'resultado';

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

/** Abas do painel esquerdo no computador: Formas & Runas | Ligações & Anel */
export function showLeftTab(target: 'tab-build' | 'tab-circle'): void {
  document.querySelectorAll<HTMLElement>('.panel-left > .panel-tabs .tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === target));
  byId('tab-build').hidden = target !== 'tab-build';
  byId('tab-circle').hidden = target !== 'tab-circle';
}

/** Vistas do tablet/celular: Peças, Ligações, Nó, Resultado */
export function setView(view: View): void {
  document.body.dataset.view = view;
  document.querySelectorAll<HTMLElement>('#viewNav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'pecas') showLeftTab('tab-build');
  if (view === 'ligacoes') showLeftTab('tab-circle');
}

/** Selo de carga no desenho: abre o Resultado */
export function showLoadDetails(): void {
  if (window.matchMedia(COMPACT_QUERY).matches) setView('resultado');
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

function applyTheme(dark: boolean): void {
  document.body.classList.toggle('theme-sketch', !dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121624' : '#efe2c2');
}

export function restoreTheme(): void {
  try {
    if (localStorage.getItem(THEME_KEY) === 'grimorio') applyTheme(true);
  } catch {
    // sem armazenamento: fica no tema Pergaminho
  }
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

export function toggleTheme(): void {
  const dark = document.body.classList.contains('theme-sketch');
  applyTheme(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'grimorio' : 'caderno');
  } catch {
    // ignora
  }
  render();
}

// ---------- Abas e menu ----------

export function setupLayout(): void {
  document.querySelectorAll<HTMLElement>('.panel-left > .panel-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showLeftTab(btn.dataset.tab as 'tab-build' | 'tab-circle'));
  });
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
