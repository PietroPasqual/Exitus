/** Pega um elemento pelo id (o HTML é nosso: se faltar, é erro de programação) */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el as T;
}

export const inputValue = (id: string): string => byId<HTMLInputElement | HTMLSelectElement>(id).value;

/** Dica que aparece embaixo do desenho */
export function setHint(text: string): void {
  byId('canvasHint').textContent = text;
}
