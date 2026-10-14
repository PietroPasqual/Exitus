-- =============================================================================
-- Contas e círculos salvos (Supabase)
-- Já aplicado no projeto "circulo-magico" (região sa-east-1). Guardado aqui para
-- referência ou para recriar o banco em outro projeto.
-- O login usa o Supabase Auth (e-mail e senha); cada conta só lê e altera os
-- próprios círculos (Row Level Security).
-- =============================================================================

create table public.circulos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 80),
  projeto       jsonb not null check (pg_column_size(projeto) < 300000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index circulos_user_atualizado_idx on public.circulos (user_id, atualizado_em desc);

-- Cada pessoa só lê e altera os próprios círculos
alter table public.circulos enable row level security;

create policy "ver os próprios círculos" on public.circulos
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "salvar círculos na própria conta" on public.circulos
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "alterar os próprios círculos" on public.circulos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "excluir os próprios círculos" on public.circulos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- atualizado_em automático
create function public.tocar_atualizado_em() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger circulos_tocar_atualizado_em
  before update on public.circulos
  for each row execute function public.tocar_atualizado_em();
