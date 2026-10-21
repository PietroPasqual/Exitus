import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Sessão da conta compartilhada com as partes do site que usam o banco (campanhas),
 * sem que elas dependam do editor de círculos. A conta avisa com `existus:sessao`.
 */
const current = { client: null as SupabaseClient | null, user: null as User | null };

export const sessionClient = (): SupabaseClient | null => current.client;
export const sessionUser = (): User | null => current.user;
export function setSession(client: SupabaseClient | null, user: User | null): void {
  const changed = current.client !== client || current.user?.id !== user?.id;
  current.client = client; current.user = user;
  if (changed) window.dispatchEvent(new Event('existus:sessao'));
}
