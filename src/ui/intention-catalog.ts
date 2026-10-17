import { INTENTION_CATALOG, resolveIntentionForm, type IntentionForm } from '../core/intention';
import { escapeHtml } from '../core/format';
import { byId } from './dom';
import { Pix, type RGB } from './pixel';
import { intentionBounds, paintIntention } from './pixel-intention';

const fold = (word: string): string => word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const wired = new WeakSet<HTMLElement>();
const thumbnails = new Map<IntentionForm, Uint8ClampedArray>();
const THUMB_WIDTH = 60, THUMB_HEIGHT = 48;
const THUMB_RAMP: RGB[] = [[69, 46, 23], [124, 84, 40], [185, 138, 69], [226, 189, 119], [255, 228, 170]];

/** The same polygons and material painter as the spell preview, with no scene effects. */
function paintThumbnails(): void {
  if (!byId<HTMLDetailsElement>('intentionCatalog').open) return;
  byId('intentionForms').querySelectorAll<HTMLCanvasElement>('canvas[data-intention-form]').forEach(canvas => {
    if (canvas.dataset.painted === 'true') return;
    const form = canvas.dataset.intentionForm as IntentionForm;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let pixels = thumbnails.get(form);
    if (!pixels) {
      const bounds = intentionBounds(form, 15);
      const size = 15 * Math.min(1, (THUMB_WIDTH - 8) / (bounds.r - bounds.l), (THUMB_HEIGHT - 8) / (bounds.b - bounds.t));
      const pix = new Pix(THUMB_WIDTH, THUMB_HEIGHT);
      paintIntention(pix, form, THUMB_WIDTH / 2, THUMB_HEIGHT / 2, size, THUMB_RAMP, 'metal', 37);
      pixels = pix.data;
      thumbnails.set(form, pixels);
    }
    const image = ctx.createImageData(THUMB_WIDTH, THUMB_HEIGHT);
    image.data.set(pixels);
    ctx.putImageData(image, 0, 0);
    canvas.dataset.painted = 'true';
  });
}

/** The catalogue only fills the field. The existing confirmation still binds it. */
export function renderIntentionCatalog(bound = false, word?: string): void {
  const catalog = byId('intentionCatalog');
  const input = byId<HTMLInputElement>('bondInput');
  const currentWord = word ?? (bound ? catalog.dataset.boundWord ?? input.value : input.value);
  catalog.dataset.bound = String(bound);
  if (bound) catalog.dataset.boundWord = currentWord;
  else delete catalog.dataset.boundWord;
  const query = fold(byId<HTMLInputElement>('intentionSearch').value.trim());
  const categories = [...new Set(INTENTION_CATALOG.map(form => form.category))];
  const categorySelect = byId<HTMLSelectElement>('intentionCategory');
  if (!categorySelect.dataset.ready) {
    categorySelect.innerHTML = '<option value="">Todas as categorias</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    categorySelect.dataset.ready = 'true';
  }
  const category = categorySelect.value;
  const forms = INTENTION_CATALOG.filter(form => (!category || form.category === category)
    && [form.name, form.category, ...form.words].some(value => fold(value).includes(query)));
  const list = byId('intentionForms');
  const key = JSON.stringify([query, category, bound]);
  if (list.dataset.rendered !== key) {
    list.dataset.rendered = key;
    list.innerHTML = forms.map(form => {
      const alias = query && !fold(form.name).includes(query)
        ? form.words.find(value => fold(value) === query) ?? form.words.find(value => fold(value).includes(query))
        : undefined;
      const caption = alias ? `Também: ${alias}` : form.category;
      return `<button type="button" class="intention-option" data-intention-word="${escapeHtml(form.name.toLocaleLowerCase('pt-BR'))}" data-intention-form="${form.id}" aria-pressed="false"${bound ? ' disabled' : ''}>
        <span class="intention-option-art" aria-hidden="true"><canvas width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" data-intention-form="${form.id}"></canvas></span>
        <strong>${escapeHtml(form.name)}</strong><small title="${escapeHtml(caption)}">${escapeHtml(caption)}</small>
      </button>`;
    }).join('');
  }
  const selected = resolveIntentionForm(currentWord);
  list.querySelectorAll<HTMLButtonElement>('button[data-intention-form]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.intentionForm === selected));
  });
  byId('intentionCount').textContent = `${INTENTION_CATALOG.length} formas ilustradas`;
  byId('intentionMatches').textContent = forms.length
    ? `${forms.length} de ${INTENTION_CATALOG.length} ${forms.length === 1 ? 'forma encontrada' : 'formas encontradas'}.`
    : 'Nenhuma forma encontrada. Você ainda pode vincular uma palavra livre.';
  byId('intentionCatalogHint').textContent = bound
    ? 'Vínculo confirmado. Para usar outra palavra, troque a runa de Intenção.'
    : selected
      ? `«${currentWord}» no campo. Confirme em Vincular.`
      : 'Escolha uma forma; depois confirme em Vincular. Sinônimos e plurais também são aceitos.';
  paintThumbnails();
}

export function setupIntentionCatalog(): void {
  const catalog = byId('intentionCatalog');
  if (wired.has(catalog)) return;
  wired.add(catalog);
  const refresh = (): void => renderIntentionCatalog(catalog.dataset.bound === 'true');
  byId('intentionSearch').addEventListener('input', refresh);
  byId('intentionCategory').addEventListener('change', refresh);
  byId('bondInput').addEventListener('input', refresh);
  catalog.addEventListener('toggle', paintThumbnails);
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
