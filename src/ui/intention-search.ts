import { INTENTION_CATALOG, type IntentionCatalogEntry } from '../core/intention';

const fold = (word: string): string => word.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const MAX_QUERY_LENGTH = 40;
const MAX_SUGGESTIONS = 4;
const indexed = INTENTION_CATALOG.map(form => ({
  form,
  name: fold(form.name),
  category: fold(form.category),
  words: form.words.map(word => ({ word, key: fold(word) }))
}));

export interface IntentionSearchMatch {
  readonly form: IntentionCatalogEntry;
  /** Alias que explica o resultado; nunca é aplicado ao vínculo automaticamente. */
  readonly alias?: string;
}

export interface IntentionSearchResult {
  readonly matches: readonly IntentionSearchMatch[];
  readonly suggested: boolean;
}

/** Distância de grafia limitada; uma troca de letras vizinhas também vale um erro. */
function spellingDistance(query: string, candidate: string, limit: number): number {
  if (Math.abs(query.length - candidate.length) > limit) return limit + 1;
  const outside = limit + 1;
  let previous = Array.from({ length: candidate.length + 1 }, (_, i) => Math.min(i, outside));
  let beforePrevious = previous;
  for (let row = 1; row <= query.length; row++) {
    const current = Array<number>(candidate.length + 1).fill(outside);
    current[0] = Math.min(row, outside);
    const start = Math.max(1, row - limit), end = Math.min(candidate.length, row + limit);
    let minimum = outside;
    for (let col = start; col <= end; col++) {
      let value = Math.min(current[col - 1] + 1, previous[col] + 1, previous[col - 1] + Number(query[row - 1] !== candidate[col - 1]));
      if (row > 1 && col > 1 && query[row - 1] === candidate[col - 2] && query[row - 2] === candidate[col - 1]) {
        value = Math.min(value, beforePrevious[col - 2] + 1);
      }
      current[col] = Math.min(value, outside);
      minimum = Math.min(minimum, current[col]);
    }
    if (minimum > limit) return outside;
    beforePrevious = previous;
    previous = current;
  }
  return previous[candidate.length];
}

/** Busca apenas no índice da UI. Não reconhece nem corrige palavras da Intenção. */
export function searchIntentionCatalog(raw: string, category = ''): IntentionSearchResult {
  // Limita trabalho antes de normalizar entradas coladas, inclusive marcas combinantes.
  if (raw.length > MAX_QUERY_LENGTH * 4) return { matches: [], suggested: false };
  const query = fold(raw.trim());
  if (query.length > MAX_QUERY_LENGTH) return { matches: [], suggested: false };
  const direct = indexed.filter(entry => [entry.name, entry.category, ...entry.words.map(word => word.key)].some(value => value.includes(query)));
  if (direct.length) {
    return {
      matches: direct.filter(entry => !category || entry.form.category === category).map(entry => ({
        form: entry.form,
        alias: query && !entry.name.includes(query)
          ? (entry.words.find(word => word.key === query) ?? entry.words.find(word => word.key.includes(query)))?.word
          : undefined
      })),
      suggested: false
    };
  }
  // Aproximação de grafia só para palavras, sem interpretar números, frases ou símbolos.
  if (query.length < 4 || !/^[a-z]+(?:-[a-z]+)*$/.test(query)) return { matches: [], suggested: false };
  const limit = query.length < 8 ? 1 : 2;
  const candidates = indexed.filter(entry => !category || entry.form.category === category).flatMap(entry => {
    const best = entry.words
      .filter(word => word.key.length >= 4 && Math.abs(word.key.length - query.length) <= limit)
      .map(word => ({ ...word, distance: spellingDistance(query, word.key, limit), canonical: word.key === entry.name }))
      .filter(word => word.distance <= limit)
      .sort((a, b) => a.distance - b.distance || Number(b.canonical) - Number(a.canonical) || Math.abs(a.key.length - query.length) - Math.abs(b.key.length - query.length) || a.key.localeCompare(b.key, 'pt-BR'))[0];
    return best ? [{ form: entry.form, alias: best.word, distance: best.distance, canonical: best.canonical, difference: Math.abs(best.key.length - query.length) }] : [];
  });
  candidates.sort((a, b) => a.distance - b.distance || Number(b.canonical) - Number(a.canonical) || a.difference - b.difference || a.form.name.localeCompare(b.form.name, 'pt-BR'));
  const matches = candidates.slice(0, MAX_SUGGESTIONS).map(({ form, alias }) => ({ form, alias }));
  return { matches, suggested: matches.length > 0 };
}
