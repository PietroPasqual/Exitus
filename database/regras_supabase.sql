-- =============================================================================
-- Regras do Sistema: energia, poder, densidade, volume, textos do Grimório,
-- formas e números de cálculo que a conta admin muda pelo site.
-- Todos leem; só quem está na lista de admins altera. Cada versão salva vai
-- para o histórico (dá para voltar a uma versão anterior pelo site).
-- Já aplicado no projeto Supabase "circulo-magico".
-- =============================================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;
-- cada conta só consegue ver se ela mesma é admin; ninguém entra na lista pelo site
create policy "cada conta vê se é admin" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.e_admin() returns boolean
  language sql stable security invoker set search_path = ''
  as $$ select exists (select 1 from public.admins a where a.user_id = (select auth.uid())) $$;

create table if not exists public.regras (
  id text primary key default 'atual' check (id = 'atual'),
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);
alter table public.regras enable row level security;
create policy "todos leem as regras" on public.regras
  for select to anon, authenticated using (true);
create policy "só admin altera as regras" on public.regras
  for update to authenticated using ((select public.e_admin())) with check ((select public.e_admin()));
create policy "só admin cria as regras" on public.regras
  for insert to authenticated with check ((select public.e_admin()));

create table if not exists public.regras_historico (
  id bigint generated always as identity primary key,
  dados jsonb not null,
  salvo_em timestamptz not null,
  salvo_por uuid references auth.users (id) on delete set null
);
alter table public.regras_historico enable row level security;
create policy "só admin vê o histórico" on public.regras_historico
  for select to authenticated using ((select public.e_admin()));

-- Antes de cada mudança, guarda a versão anterior e marca quem/quando mudou
create or replace function public.regras_guardar_versao() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  insert into public.regras_historico (dados, salvo_em, salvo_por) values (old.dados, old.atualizado_em, old.atualizado_por);
  new.atualizado_em := now();
  new.atualizado_por := (select auth.uid());
  return new;
end $$;
revoke all on function public.regras_guardar_versao() from public, anon, authenticated;
create trigger regras_guardar_versao before update on public.regras
  for each row execute function public.regras_guardar_versao();

insert into public.regras (id) values ('atual') on conflict (id) do nothing;

-- Para colocar alguém como admin (a pessoa precisa ter conta criada no site):
--   insert into public.admins (user_id)
--   select id from auth.users where lower(email) = lower('email-da-pessoa@exemplo.com');
