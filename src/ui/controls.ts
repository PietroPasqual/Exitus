import { escapeHtml } from '../core/format';

// Controles dos menus.
// - Botões de opção: um <select data-seg> vira uma fileira de botões. O <select> continua
//   na página (escondido) e é ele que guarda o valor: o resto do código lê e escreve nele
//   como antes, e a fileira só acompanha.
// - Controles deslizantes: a parte já percorrida fica na cor do tema.

const groups: [HTMLSelectElement, HTMLElement, HTMLElement | null][] = [];

export function setupControls(): void {
  document.querySelectorAll<HTMLSelectElement>('select[data-seg]').forEach(sel => {
    const group = document.createElement('div');
    group.className = `seg${sel.dataset.seg ? ` seg-${sel.dataset.seg}` : ''}`;
    group.setAttribute('role', 'radiogroup');
    const label = document.querySelector<HTMLLabelElement>(`label[for="${sel.id}"]`);
    if (label) {
      label.id ||= `${sel.id}Label`;
      group.setAttribute('aria-labelledby', label.id);
    }

    [...sel.options].forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn';
      b.dataset.value = o.value;
      b.setAttribute('role', 'radio');
      b.title = o.text;
      const icon = o.dataset.icon ? `<svg class="ic" aria-hidden="true"><use href="#${o.dataset.icon}"/></svg>` : '';
      b.innerHTML = `${icon}<span>${escapeHtml(o.dataset.short ?? o.text)}</span>`;
      b.addEventListener('click', () => {
        if (sel.value === o.value || o.disabled) return;
        sel.value = o.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        syncControls();
      });
      group.appendChild(b);
    });

    // Frase curta explicando a opção escolhida (se as opções tiverem data-hint)
    let hint: HTMLElement | null = null;
    if ([...sel.options].some(o => o.dataset.hint)) {
      hint = document.createElement('p');
      hint.className = 'seg-hint';
    }

    sel.classList.add('seg-source');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');
    sel.after(group);
    if (hint) group.after(hint);
    groups.push([sel, group, hint]);
  });

  document.addEventListener('input', e => {
    const el = e.target as HTMLInputElement;
    if (el.type === 'range') paintRange(el);
  });
  syncControls();
}

function paintRange(el: HTMLInputElement): void {
  const min = Number(el.min || 0), max = Number(el.max || 100);
  const pct = max > min ? ((Number(el.value) - min) / (max - min)) * 100 : 0;
  el.style.setProperty('--fill', `${pct}%`);
}

/** Acompanha os valores atuais (chamado depois de cada redesenho) */
export function syncControls(): void {
  groups.forEach(([sel, group, hint]) => {
    group.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach(b => {
      const opt = [...sel.options].find(o => o.value === b.dataset.value);
      const on = b.dataset.value === sel.value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
      b.disabled = !!opt?.disabled;
    });
    if (hint) hint.textContent = sel.selectedOptions[0]?.dataset.hint ?? '';
  });
  document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(paintRange);
}
