import { escapeHtml } from '../core/format';
import { ARCHETYPES, ARCHETYPE_INTRO } from '../data/rpg-archetypes';
import {
  ACTION_REFERENCE, REST_REFERENCE, RANKS, SPECIAL_RANKS, ROLL_CATEGORIES, ADVANTAGE_REFERENCE, FORMULA_REFERENCE
} from '../data/rpg-reference';
import { RULEBOOK, type RuleBlock, type RuleChapter, type RuleSection } from '../data/rulebook';
import { byId } from './dom';

// Livro de Regras: capítulos com índice lateral e busca

/** **assim** vira negrito (o resto é escapado) */
const rich = (text: string): string => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

function table(caption: string, head: string[], rows: string[][]): string {
  return `<div class="rb-table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(caption)}"><table class="rb-table"><caption>${escapeHtml(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${rich(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function block(b: RuleBlock): string {
  switch (b.t) {
    case 'p': return `<p>${rich(b.text)}</p>`;
    case 'nota': return `<p class="rb-note"><span>P.s.</span> ${rich(b.text)}</p>`;
    case 'lista': return `${b.titulo ? `<h5 class="rb-list-title${b.tom ? ` rb-${b.tom}` : ''}">${escapeHtml(b.titulo)}</h5>` : ''}<ul class="rb-list${b.tom ? ` rb-${b.tom}` : ''}">${b.items.map(i => `<li>${rich(i)}</li>`).join('')}</ul>`;
    case 'termos': return `<dl class="rb-terms">${b.items.map(([k, v]) => `<div><dt>${rich(k)}</dt><dd>${rich(v)}</dd></div>`).join('')}</dl>`;
    case 'tabela': return table(b.caption, b.head, b.rows);
    case 'tags': return `${b.titulo ? `<h4 class="rb-tags-title">${escapeHtml(b.titulo)} <small>${b.items.length}</small></h4>` : ''}<ul class="rb-tags">${b.items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
    case 'formulas': return `<dl class="rb-formulas">${b.items.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v)}</code></dd></div>`).join('')}</dl>`;
  }
}

/** Arquétipos e Jogo vêm das mesmas tabelas que a ficha usa */
function extraChapters(): RuleChapter[] {
  const archetypes: RuleSection[] = ARCHETYPES.map(a => ({
    id: a.id, titulo: a.nome,
    blocos: [
      { t: 'p', text: `**${a.nome}** é o arquétipo ${a.foco}. ${a.descricao}` },
      { t: 'termos', items: [['Característica especial', a.especial]] },
      { t: 'lista', titulo: 'Vantagens', tom: 'bom', items: a.vantagens },
      ...a.grupos.map((g): RuleBlock => ({ t: 'lista', titulo: `Desvantagens · penalidade de ${g.de}`, tom: 'ruim', items: g.regras })),
      ...(a.penalidade.length ? [{ t: 'nota', text: `Quem não escolhe ${a.nome} recebe: ${a.penalidade.join(' ')}` } as RuleBlock] : [])
    ]
  }));
  const formulaGroups = [...new Set(FORMULA_REFERENCE.map(f => f.grupo))];
  return [
    {
      id: 'arquetipos', numeral: 'IV', titulo: 'Arquétipos', resumo: 'As áreas de atuação que decidem como a ficha evolui.',
      secoes: [
        {
          id: 'arquetipo', titulo: 'O que é um Arquétipo',
          blocos: [
            { t: 'p', text: ARCHETYPE_INTRO },
            { t: 'tabela', caption: 'Resumo dos arquétipos', head: ['Arquétipo', 'Foco', 'Especial', 'Impõe aos outros'], rows: ARCHETYPES.map(a => [a.nome, a.foco.replace(/^d[aeo]s? /, ''), a.especial, a.penalidade.length ? `${a.penalidade.length} desvantagens` : '—']) }
          ]
        },
        ...archetypes
      ]
    },
    {
      id: 'jogo', numeral: 'V', titulo: 'Jogo e cálculos', resumo: 'Ações, descansos, rolagens, ranks e fórmulas da ficha.',
      secoes: [
        { id: 'acoes', titulo: 'Ações', blocos: [
          { t: 'p', text: `Uma rodada tem **${ACTION_REFERENCE.roundSeconds}s**; uma rotação tem **${ACTION_REFERENCE.rotationSeconds}s**.` },
          { t: 'tabela', caption: 'Tipos de ação', head: ['Tipo', 'Usos', 'Tempo', 'Explicação'], rows: ACTION_REFERENCE.rows.map(r => [r.tipo, r.usos, r.tempo, r.explicacao]) }
        ] },
        { id: 'descansos', titulo: 'Descansos', blocos: [
          { t: 'tabela', caption: 'Recuperação por descanso', head: ['Descanso', 'Usos', 'Condição', 'Tempo', 'Fadiga', 'Energia', 'Vida'], rows: REST_REFERENCE.rows.map(r => [r.descanso, r.usos, r.condicao, r.tempo, r.fadiga, r.energia, r.vida]) },
          { t: 'nota', text: REST_REFERENCE.interruption }
        ] },
        { id: 'rolagens', titulo: 'Rolagens e vantagens', blocos: [
          { t: 'tabela', caption: 'Categorias de rolagem (1d20)', head: ['Resultado', 'Categoria'], rows: ROLL_CATEGORIES.map(c => [c.min === c.max ? String(c.min) : `${c.min}–${c.max}`, c.nome]) },
          { t: 'termos', items: ADVANTAGE_REFERENCE.rows.map(r => [r.nome, r.explicacao] as [string, string]) },
          { t: 'nota', text: ADVANTAGE_REFERENCE.cancellation }
        ] },
        { id: 'ranks', titulo: 'Ranks', blocos: [
          { t: 'tags', titulo: 'Escala', items: RANKS.map(r => `${r.id} · ${r.nome}`) },
          { t: 'tags', titulo: 'Fora da escala', items: SPECIAL_RANKS.map(r => `${r.id} · ${r.nome}`) }
        ] },
        ...formulaGroups.map((g): RuleSection => ({
          id: `formulas-${g.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`, titulo: `Fórmulas · ${g}`,
          blocos: [
            { t: 'formulas', items: FORMULA_REFERENCE.filter(f => f.grupo === g).map(f => [f.nome, f.formula] as [string, string]) },
            ...FORMULA_REFERENCE.filter(f => f.grupo === g && f.nota).map((f): RuleBlock => ({ t: 'nota', text: `${f.nome}: ${f.nota}` }))
          ]
        }))
      ]
    }
  ];
}

export const RULEBOOK_CHAPTERS: RuleChapter[] = [...RULEBOOK, ...extraChapters()];
const sectionId = (c: RuleChapter, s: RuleSection): string => `rb-${c.id}-${s.id}`;

export function renderRulebookToc(): string {
  return RULEBOOK_CHAPTERS.map(c => `<div class="rb-toc-chapter"><a href="#rb-${c.id}" data-rb-goto="rb-${c.id}"><span>${c.numeral}</span>${escapeHtml(c.titulo)}</a><ol>${c.secoes.map(s => `<li><a href="#${sectionId(c, s)}" data-rb-goto="${sectionId(c, s)}">${escapeHtml(s.titulo)}</a></li>`).join('')}</ol></div>`).join('');
}

export function renderRulebookPages(): string {
  return RULEBOOK_CHAPTERS.map(c => `<section class="rb-chapter" id="rb-${c.id}" data-rb-chapter="${c.id}">
    <div class="rb-chapter-head"><span class="rb-numeral">${c.numeral}</span><div><h3>${escapeHtml(c.titulo)}</h3><p>${escapeHtml(c.resumo)}</p></div></div>
    ${c.secoes.map(s => `<article class="rb-section" id="${sectionId(c, s)}"><h4>${escapeHtml(s.titulo)}</h4>${s.blocos.map(block).join('')}</article>`).join('')}
  </section>`).join('');
}

/** Normaliza para busca sem acento nem caixa */
const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Mostra só as seções que têm o termo; devolve quantas sobraram */
export function filterRulebook(root: HTMLElement, query: string): number {
  const q = fold(query.trim());
  let shown = 0;
  root.querySelectorAll<HTMLElement>('.rb-chapter').forEach(chapter => {
    let any = false;
    chapter.querySelectorAll<HTMLElement>('.rb-section').forEach(section => {
      const hit = !q || fold(section.textContent ?? '').includes(q);
      section.hidden = !hit;
      if (hit) { any = true; shown++; }
    });
    chapter.hidden = !any;
  });
  root.querySelectorAll<HTMLAnchorElement>('[data-rb-goto]').forEach(link => {
    const target = document.getElementById(link.dataset.rbGoto as string);
    link.closest('li, .rb-toc-chapter')?.toggleAttribute('hidden', !!target?.hidden);
  });
  return shown;
}

let lastFocus: HTMLElement | null = null;

export function setupRulebook(): void {
  const modal = document.getElementById('rulebookModal');
  if (!modal) return;
  const pages = byId('rulebookPages'), toc = byId('rulebookToc');
  pages.innerHTML = renderRulebookPages();
  toc.innerHTML = renderRulebookToc();
  const search = byId<HTMLInputElement>('rulebookSearch'), status = byId('rulebookStatus');
  search.addEventListener('input', () => {
    const shown = filterRulebook(modal, search.value);
    status.textContent = search.value.trim() ? (shown ? `${shown} seção(ões) encontrada(s)` : 'Nada encontrado') : '';
    pages.scrollTop = 0;
  });
  modal.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-rb-goto]');
    if (!link) return;
    event.preventDefault();
    goTo(link.dataset.rbGoto as string);
    modal.classList.remove('rb-toc-open');
  });
  byId('rulebookTocToggle').addEventListener('click', () => modal.classList.toggle('rb-toc-open'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) { closeRulebook(); event.preventDefault(); }
  });
}

/** Atalho "Ver no Livro de Regras" (usa o data-action global; sem SVG porque vai dentro da ficha) */
export const rulebookLink = (at: string, label = 'Ver no Livro de Regras'): string =>
  `<button type="button" class="btn rb-link" data-action="open-rulebook" data-arg="${escapeHtml(at)}">${escapeHtml(label)}</button>`;

function goTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  target.classList.add('rb-flash');
  window.setTimeout(() => target.classList.remove('rb-flash'), 1200);
}

/** Abre o livro; `at` é "capitulo" ou "capitulo-secao" (ex.: "pilares-aura") */
export function openRulebook(at?: string): void {
  const modal = byId('rulebookModal');
  lastFocus = document.activeElement as HTMLElement | null;
  // Vindo do Grimório: troca uma janela pela outra
  document.getElementById('grimoireModal')?.classList.remove('open');
  modal.classList.add('open');
  const search = byId<HTMLInputElement>('rulebookSearch');
  if (search.value) { search.value = ''; filterRulebook(modal, ''); byId('rulebookStatus').textContent = ''; }
  if (at) requestAnimationFrame(() => goTo(`rb-${at}`));
  else byId('rulebookPages').scrollTop = 0;
  byId<HTMLButtonElement>('rulebookClose').focus({ preventScroll: true });
}

export function closeRulebook(): void {
  byId('rulebookModal').classList.remove('open', 'rb-toc-open');
  lastFocus?.focus({ preventScroll: true });
}
