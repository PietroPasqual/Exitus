import { INTENTION_CATALOG } from '../core/intention';
import { escapeHtml } from '../core/format';
import { byId } from './dom';

const fold = (word: string): string => word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const wired = new WeakSet<HTMLElement>();

/** The catalogue only fills the field. The existing confirmation still binds it. */
export function renderIntentionCatalog(bound = false): void {
  const catalog = byId('intentionCatalog');
  catalog.dataset.bound = String(bound);
  const query = fold(byId<HTMLInputElement>('intentionSearch').value.trim());
  const forms = INTENTION_CATALOG.filter(form => [form.name, form.category, ...form.words].some(word => fold(word).includes(query)));
  const list = byId('intentionForms');
  const key = `${query}:${bound}`;
  if (list.dataset.rendered !== key) {
    list.dataset.rendered = key;
    list.innerHTML = forms.map(form => `<button type="button" class="intention-option" data-intention-word="${escapeHtml(form.name.toLocaleLowerCase('pt-BR'))}"${bound ? ' disabled' : ''}>
      <strong>${escapeHtml(form.name)}</strong><small>${escapeHtml(form.category)}</small>
    </button>`).join('');
  }
  byId('intentionCount').textContent = `${INTENTION_CATALOG.length} formas ilustradas`;
  byId('intentionMatches').textContent = forms.length ? `${forms.length} ${forms.length === 1 ? 'forma encontrada' : 'formas encontradas'}.` : 'Nenhuma forma encontrada. Você ainda pode vincular uma palavra livre.';
  byId('intentionCatalogHint').textContent = bound
    ? 'Vínculo confirmado. Para usar outra palavra, troque a runa de Intenção.'
    : 'Escolha uma forma para preencher o campo. Plurais e sinônimos também são reconhecidos; confirme em Vincular.';
}

export function setupIntentionCatalog(): void {
  const catalog = byId('intentionCatalog');
  if (wired.has(catalog)) return;
  wired.add(catalog);
  byId('intentionSearch').addEventListener('input', () => renderIntentionCatalog(catalog.dataset.bound === 'true'));
  catalog.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-intention-word]') : null;
    if (!target || !catalog.contains(target) || target.disabled || catalog.dataset.bound === 'true') return;
    const input = byId<HTMLInputElement>('bondInput');
    input.value = target.dataset.intentionWord ?? '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  renderIntentionCatalog();
}
