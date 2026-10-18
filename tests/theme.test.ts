// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import initialTheme from '../public/theme-init.js?raw';
import { currentTheme, restoreTheme, toggleTheme, type Theme } from '../src/ui/layout';

const boot = (): void => { new Function('document', 'localStorage', initialTheme)(document, localStorage); };
const surface = () => ({
  theme: currentTheme(), data: document.documentElement.dataset.theme,
  meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = '<meta name="theme-color" content="#081426">';
  document.body.className = '';
  document.body.innerHTML = '<button id="btnToggleTheme"></button><p id="canvasHint"></p>';
});

describe('Tema inicial e preferência persistida', () => {
  it.each([
    [null, 'grimorio'], ['', 'grimorio'], ['invalido', 'grimorio'], ['grimorio', 'grimorio'],
    ['pergaminho', 'pergaminho'], ['pauta', 'pauta'], ['caderno', 'pergaminho']
  ] as [string | null, Theme][])('aplica %s antes do conteúdo e mantém a mesma escolha na inicialização', (saved, expected) => {
    if (saved !== null) localStorage.setItem('circulos-tema', saved);
    boot();
    expect(currentTheme()).toBe(expected);
    const firstPaint = surface();
    document.body.className = 'theme-sketch theme-pauta';
    restoreTheme();
    expect(surface()).toEqual(firstPaint);
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(expected === 'grimorio' ? '#081426' : '#493222');
    expect(document.getElementById('btnToggleTheme')?.getAttribute('aria-label')).toContain('Tema:');
    expect(localStorage.getItem('circulos-tema')).toBe(saved);
  });

  it('abre escuro mesmo quando o armazenamento não está disponível', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('blocked'); });
    document.body.className = 'theme-sketch';
    boot();
    expect(currentTheme()).toBe('grimorio');
    restoreTheme();
    expect(currentTheme()).toBe('grimorio');
    expect(document.documentElement.dataset.theme).toBe('grimorio');
  });

  it('continua alternando, anuncia o próximo tema e restaura a escolha após recarga', () => {
    restoreTheme();
    for (const theme of ['pauta', 'pergaminho', 'grimorio'] as Theme[]) {
      toggleTheme();
      expect(currentTheme()).toBe(theme);
      expect(localStorage.getItem('circulos-tema')).toBe(theme);
      const selected = surface();
      boot();
      restoreTheme();
      expect(surface()).toEqual(selected);
    }
    expect(document.getElementById('btnToggleTheme')?.getAttribute('aria-label')).toBe('Tema: Grimório — toque para Caderno');
  });
});
