-- Privilégios mínimos, mantendo as políticas RLS existentes.
revoke all on table public.circulos, public.admins, public.regras, public.regras_historico from public, anon, authenticated;
grant select, insert, update, delete on table public.circulos to authenticated;
grant select on table public.admins to authenticated;
grant select on table public.regras to anon, authenticated;
grant insert, update on table public.regras to authenticated;
grant select on table public.regras_historico to authenticated;
revoke all on sequence public.regras_historico_id_seq from public, anon, authenticated;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;
