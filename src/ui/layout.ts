import { byId } from './dom';
import { render, store } from './store';

// Abas e vistas (tablet e celular), menu de exportar e tema

export type View = 'pecas' | 'ligacoes' | 'no' | 'resultado';

/** Layout compacto (tablet, celular em pé ou deitado): um painel por vez */
export const COMPACT_QUERY = '(max-width: 1199px), (orientation: landscape) and (max-height: 520px)';

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
  byId('loadMeter').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** "Trocar" a runa no painel da forma: leva à lista de runas */
export function goToRunes(): void {
  if (window.matchMedia(COMPACT_QUERY).matches) setView('pecas');
  else showLeftTab('tab-build');
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
    btn.addEventListener('click', () => setView(btn.dataset.view as View));
  });
  setView('pecas');

  // Menu de exportar: fecha ao escolher uma opção ou tocar fora
  const fileMenu = byId<HTMLDetailsElement>('fileMenu');
  fileMenu.querySelectorAll('.menu-list .btn').forEach(b => b.addEventListener('click', () => fileMenu.removeAttribute('open')));
  document.addEventListener('click', evt => {
    if (fileMenu.open && !fileMenu.contains(evt.target as Node)) fileMenu.removeAttribute('open');
  });
}
