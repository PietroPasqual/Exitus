/** Silhuetas visuais que a palavra de Intenção pode dar à matéria já existente. */
const FORM_NAMES = {
  lanca: 'Lança', espada: 'Espada', escudo: 'Escudo', flecha: 'Flecha',
  martelo: 'Martelo', parede: 'Parede', machado: 'Machado'
} as const;

export type IntentionForm = keyof typeof FORM_NAMES;

export interface IntentionReading {
  status: 'recognized' | 'unknown';
  form: IntentionForm | null;
  /** A forma ilustrada reconhecida, quando houver; outras palavras usam tipografia. */
  matches: IntentionForm[];
}

export interface IntentionWord {
  value: string;
  error: string | null;
}

/** Quantidade visual exata; nunca converte para Number nem altera o poder. */
export function intentionQuantity(raw: string): string | null {
  const value = raw.trim().normalize('NFC');
  if ([...value].length > 40 || !/^\+?\d+$/.test(value)) return null;
  const quantity = BigInt(value);
  return quantity > 0n ? quantity.toString() : null;
}

/** Uma única palavra ou número. Só normaliza a apresentação; nunca corta o texto. */
export function validateIntentionWord(raw: string): IntentionWord {
  const value = raw.trim().normalize('NFC');
  if (!value) return { value, error: 'Escreva uma palavra ou um número.' };
  if ([...value].length > 40) return { value, error: 'Use no máximo 40 caracteres na Intenção.' };
  if (intentionQuantity(value)) return { value, error: null };
  const numeric = /^[+\-\u2212]?(?:\p{Nd}+(?:[.,]\p{Nd}*)?|[.,]\p{Nd}+)$/u;
  if (numeric.test(value)) return { value, error: 'A quantidade deve ser um número inteiro maior que zero.' };
  const word = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-\u2010\u2011'’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u;
  if (!word.test(value)) {
    return { value, error: 'Use uma única palavra ou número, sem espaços nem outros símbolos.' };
  }
  return { value, error: null };
}

/** Nome de apresentação; os identificadores continuam sem acentos. */
export const intentionFormName = (form: IntentionForm): string => FORM_NAMES[form];

/**
 * Reconhece as silhuetas ilustradas de uma única palavra. Outras palavras moldam
 * a aparência através de seus caracteres; inteiros positivos indicam quantidade.
 * Não cria elemento, custo, poder, Projétil ou alcance. Vínculos antigos com mais
 * de uma palavra ficam preservados como texto, sem nova interpretação visual.
 */
export function inspectIntention(word: string): IntentionReading {
  const { value, error } = validateIntentionWord(word);
  if (error) return { status: 'unknown', form: null, matches: [] };
  const normalized = value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (!Object.hasOwn(FORM_NAMES, normalized)) return { status: 'unknown', form: null, matches: [] };
  const form = normalized as IntentionForm;
  return { status: 'recognized', form, matches: [form] };
}

export const resolveIntentionForm = (word: string): IntentionForm | null => inspectIntention(word).form;
