/** Número com uma casa e vírgula: 25,6 */
export const fmt = (v: number): string => v.toFixed(1).replace('.', ',');

/** Escapa texto que vai para dentro de HTML (nomes salvos, importados…) */
export function escapeHtml(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[ch]);
}

export const uniq = <T>(list: T[]): T[] => [...new Set(list)];
