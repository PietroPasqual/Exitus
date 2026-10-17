import { escapeHtml } from '../core/format';
import { CHARACTER_SECTIONS } from '../core/character';
import { RPG_SHEET_SECTIONS } from './rpg-sheet';

export const SHEET_SECTIONS = [
  { id: 'character-section-identidade', label: 'Identidade' },
  { id: 'character-section-historia', label: 'História livre e sessão' },
  ...RPG_SHEET_SECTIONS.map(([key, label]) => ({ id: `rpg-section-${key}`, label })),
  { id: 'character-section-registros', label: 'Registros livres' },
  ...Object.entries(CHARACTER_SECTIONS).map(([key, label]) => ({
    id: `character-section-${key}`, label: key === 'habilidades' ? label : `${label} ${key === 'inventario' ? 'livre' : 'livres'}`
  })),
  { id: 'character-section-magias', label: 'Círculos mágicos' }
];

export function renderSheetNavigation(): string {
  return `<aside class="character-section-sidebar"><nav class="character-section-nav" aria-label="Seções da ficha">
    <p class="character-eyebrow">Nesta ficha</p><h3>Ir para seção</h3>
    <select class="character-section-select" aria-label="Ir para seção da ficha">${SHEET_SECTIONS.map(section => `<option value="${section.id}">${escapeHtml(section.label)}</option>`).join('')}</select>
    <div class="character-section-links">${SHEET_SECTIONS.map((section, index) => `<a class="character-section-link" data-character-section="${section.id}" href="#${section.id}"${index === 0 ? ' aria-current="location"' : ''}><span class="character-section-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(section.label)}</a>`).join('')}</div>
  </nav></aside>`;
}

/** Um único conjunto de listeners atende aos redesenhos da ficha. */
export function setupSheetNavigation(root: HTMLElement): { refresh(): void; clear(): void } {
  let targets: HTMLElement[] = [];
  let activeId = SHEET_SECTIONS[0].id;
  let frame: number | undefined;

  function hiddenByDetails(element: HTMLElement): boolean {
    let ancestor = element.parentElement;
    while (ancestor && ancestor !== root) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open) return true;
      ancestor = ancestor.parentElement;
    }
    return false;
  }
  function markActive(id: string, keepVisible = false): void {
    activeId = id;
    let activeLink: HTMLAnchorElement | undefined;
    root.querySelectorAll<HTMLAnchorElement>('[data-character-section]').forEach(link => {
      if (link.dataset.characterSection === id) { link.setAttribute('aria-current', 'location'); activeLink = link; }
      else link.removeAttribute('aria-current');
    });
    const select = root.querySelector<HTMLSelectElement>('.character-section-select');
    if (select) select.value = id;
    const sidebar = root.querySelector<HTMLElement>('.character-section-sidebar');
    if (keepVisible && activeLink && sidebar) {
      const item = activeLink.getBoundingClientRect(), panel = sidebar.getBoundingClientRect();
      if (item.top < panel.top) sidebar.scrollTop += item.top - panel.top;
      else if (item.bottom > panel.bottom) sidebar.scrollTop += item.bottom - panel.bottom;
    }
  }
  function updateActive(): void {
    if (root.hidden || !root.isConnected || !targets.length) return;
    const top = root.getBoundingClientRect().top;
    let chosen: HTMLElement | undefined, chosenTop = -Infinity;
    for (const target of targets) {
      if (!target.isConnected || hiddenByDetails(target)) continue;
      const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 22;
      const targetTop = target.getBoundingClientRect().top - top;
      if (targetTop <= offset + 2 && (targetTop > chosenTop + 1 || (Math.abs(targetTop - chosenTop) <= 1 && target.id === activeId))) {
        chosen = target; chosenTop = targetTop;
      }
    }
    if (root.scrollHeight > root.clientHeight && root.scrollTop + root.clientHeight >= root.scrollHeight - 2) chosen = targets[targets.length - 1];
    const next = chosen?.id ?? targets[0].id;
    markActive(next, next !== activeId);
  }
  function cancelFrame(): void {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  }
  function schedule(): void {
    if (frame !== undefined || root.hidden || !targets.length) return;
    if (typeof window.requestAnimationFrame !== 'function') { updateActive(); return; }
    frame = window.requestAnimationFrame(() => { frame = undefined; updateActive(); });
  }
  function jump(id: string): void {
    const target = targets.find(section => section.id === id);
    if (!target || root.hidden) return;
    let ancestor: HTMLElement | null = target;
    while (ancestor && ancestor !== root) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const heading = target instanceof HTMLDetailsElement ? target.querySelector<HTMLElement>('summary') : target.querySelector<HTMLElement>('h3, h4');
    const focus = heading ?? target;
    focus.tabIndex = -1;
    focus.focus({ preventScroll: true });
    const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 22;
    const scrollTop = Math.max(0, target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - offset);
    markActive(id, true);
    // Rolagem direta mantém o atalho imediato e evita movimento desnecessário.
    if (typeof root.scrollTo === 'function') root.scrollTo({ top: scrollTop, behavior: 'auto' });
    else root.scrollTop = scrollTop;
  }

  root.addEventListener('scroll', schedule, { passive: true });
  root.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-character-section]');
    if (!link || !root.contains(link) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault(); jump(link.dataset.characterSection!);
  });
  root.addEventListener('change', event => {
    if (event.target instanceof HTMLSelectElement && event.target.classList.contains('character-section-select')) jump(event.target.value);
  });
  return {
    refresh(): void {
      cancelFrame();
      targets = SHEET_SECTIONS.map(section => root.querySelector<HTMLElement>(`#${section.id}`)).filter((target): target is HTMLElement => target !== null);
      updateActive();
    },
    clear(): void { cancelFrame(); targets = []; activeId = SHEET_SECTIONS[0].id; }
  };
}
