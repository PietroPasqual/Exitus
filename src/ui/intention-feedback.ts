import { inspectIntention, intentionFormName, intentionQuantity, validateIntentionWord } from '../core/intention';
import { INTENTION_SCENE_LIMIT } from './pixel-scene-layout';
import { glyphHasUnsupportedCharacters } from './pixel-intention-glyph';
import { byId } from './dom';

/** Feedback before the immutable bond is confirmed; text never becomes HTML. */
export function intentionFeedback(word: string, bound = false): string {
  if (!word.trim()) return 'Escreva uma palavra ou um número para definir a aparência.';
  const checked = validateIntentionWord(word);
  if (checked.error) return bound
    ? 'Vínculo antigo preservado. Novas intenções devem ter uma única palavra ou um único número.'
    : checked.error;
  const count = intentionQuantity(checked.value);
  if (count) return `Quantidade ${bound ? 'vinculada' : 'indicada'}: ${count}. Repete a manifestação completa; a prévia ilustra até ${INTENTION_SCENE_LIMIT} cópias. Energia e poder seguem as regras da ficha.`;
  const reading = inspectIntention(word);
  if (reading.form) {
    const form = intentionFormName(reading.form).toLocaleLowerCase('pt-BR');
    return `Forma ${bound ? 'vinculada' : 'reconhecida'}: ${form}. Mantém os elementos e as propriedades da magia.`;
  }
  return 'A matéria da magia formará os caracteres dessa intenção em pixel art. Conceitos sem matéria ou formato continuam como auras.'
    + (glyphHasUnsupportedCharacters(checked.value) ? ' Caracteres sem glifo nesta fonte aparecem como ?; o vínculo original é preservado.' : '');
}

export function renderIntentionFeedback(word: string, bound = false): void {
  const target = byId('bondPreview');
  const message = intentionFeedback(word, bound);
  if (target.textContent !== message) target.textContent = message;
  const input = document.getElementById('bondInput') as HTMLInputElement | null;
  if (input) {
    const error = !bound && word.trim() ? validateIntentionWord(word).error : null;
    input.setCustomValidity(error ?? '');
    if (error) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}
