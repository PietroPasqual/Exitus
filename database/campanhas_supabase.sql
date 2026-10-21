-- =============================================================================
-- Campanhas online: o mestre cria a campanha e passa o código; o jogador pede para
-- entrar levando o resumo do personagem; só depois que o mestre aprova ele vê a mesa
-- (a cena que o mestre mostra, sem névoa revelada, tokens ocultos nem rolagens secretas).
-- Já aplicado no projeto Supabase "circulo-magico" (migração "campanhas_online").
-- Guardado aqui para referência ou para recriar o banco em outro projeto.
-- As funções security definer são chamadas pelo site de propósito e conferem auth.uid().
-- =============================================================================

create table public.campanhas (
  id            uuid primary key default gen_random_uuid(),
  mestre_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 60),
  codigo        text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  -- O que os jogadores aprovados veem: { scene, rolagens } sem a imagem de fundo
  mesa          jsonb not null default '{}'::jsonb check (pg_column_size(mesa) < 1000000),
  -- A imagem do mapa vai separada para não ser reenviada a cada token movido
  fundo         text not null default '' check (char_length(fundo) <= 2000000),
  fundo_em      timestamptz not null default now(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index campanhas_mestre_idx on public.campanhas (mestre_id);

create table public.campanha_membros (
  campanha_id   uuid not null references public.campanhas (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  campanha_nome text not null default '',
  jogador       text not null default '' check (char_length(jogador) <= 60),
  status        text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  -- Resumo do personagem (nome, raça, classe, vida, avatar…), não a ficha inteira
  personagem    jsonb not null default '{}'::jsonb check (pg_column_size(personagem) < 20000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (campanha_id, user_id)
);
create index campanha_membros_user_idx on public.campanha_membros (user_id);

alter table public.campanhas enable row level security;
alter table public.campanha_membros enable row level security;

-- Funções de apoio das políticas (definer: evitam a recursão entre as duas tabelas)
create function public.e_mestre_da_campanha(c uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.campanhas where id = c and mestre_id = (select auth.uid())) $$;
create function public.e_jogador_aprovado(c uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$ select exists (select 1 from public.campanha_membros where campanha_id = c and user_id = (select auth.uid()) and status = 'aprovado') $$;

-- Campanha: o mestre faz tudo; jogador aprovado só lê
create policy "mestre e jogadores aprovados veem a campanha" on public.campanhas
  for select to authenticated using (mestre_id = (select auth.uid()) or (select public.e_jogador_aprovado(id)));
create policy "mestre cria a campanha" on public.campanhas
  for insert to authenticated with check (mestre_id = (select auth.uid()));
create policy "mestre altera a campanha" on public.campanhas
  for update to authenticated using (mestre_id = (select auth.uid())) with check (mestre_id = (select auth.uid()));
create policy "mestre exclui a campanha" on public.campanhas
  for delete to authenticated using (mestre_id = (select auth.uid()));

-- Membros: cada um vê o próprio pedido; o mestre vê os da campanha. Entrar e aprovar só pelas funções.
create policy "jogador vê o próprio pedido e mestre vê os da campanha" on public.campanha_membros
  for select to authenticated using (user_id = (select auth.uid()) or (select public.e_mestre_da_campanha(campanha_id)));
create policy "jogador sai e mestre remove" on public.campanha_membros
  for delete to authenticated using (user_id = (select auth.uid()) or (select public.e_mestre_da_campanha(campanha_id)));

-- atualizado_em automático; fundo_em só quando a imagem muda
create function public.campanhas_tocar() returns trigger
  language plpgsql set search_path = ''
  as $$
begin
  new.atualizado_em := now();
  if new.fundo is distinct from old.fundo then new.fundo_em := now(); end if;
  new.mestre_id := old.mestre_id;
  return new;
end $$;
create trigger campanhas_tocar before update on public.campanhas
  for each row execute function public.campanhas_tocar();

-- No máximo 10 campanhas por mestre
create function public.campanhas_limite() returns trigger
  language plpgsql security definer set search_path = ''
  as $$
begin
  if (select count(*) from public.campanhas where mestre_id = new.mestre_id) >= 10 then
    raise exception 'limite de campanhas' using errcode = 'P0001', hint = 'Cada conta mestra até 10 campanhas.';
  end if;
  return new;
end $$;
create trigger campanhas_limite before insert on public.campanhas
  for each row execute function public.campanhas_limite();

-- Pedir para entrar (ou atualizar o personagem levado). Quem já foi aprovado continua aprovado.
create function public.entrar_campanha(p_codigo text, p_jogador text, p_personagem jsonb)
  returns table (campanha_id uuid, campanha_nome text, status text)
  language plpgsql security definer set search_path = ''
  as $$
#variable_conflict use_column
declare
  alvo public.campanhas%rowtype;
  eu uuid := (select auth.uid());
begin
  if eu is null then raise exception 'sem conta' using errcode = '42501'; end if;
  select * into alvo from public.campanhas c where c.codigo = upper(btrim(p_codigo));
  if not found then raise exception 'codigo invalido' using errcode = 'P0002'; end if;
  if alvo.mestre_id = eu then raise exception 'mestre da campanha' using errcode = 'P0001'; end if;
  if (select count(*) from public.campanha_membros m where m.campanha_id = alvo.id) >= 40
     and not exists (select 1 from public.campanha_membros m where m.campanha_id = alvo.id and m.user_id = eu) then
    raise exception 'campanha cheia' using errcode = 'P0001';
  end if;
  if (select count(*) from public.campanha_membros m where m.user_id = eu) >= 30
     and not exists (select 1 from public.campanha_membros m where m.campanha_id = alvo.id and m.user_id = eu) then
    raise exception 'limite de pedidos' using errcode = 'P0001';
  end if;
  insert into public.campanha_membros as m (campanha_id, user_id, campanha_nome, jogador, personagem)
    values (alvo.id, eu, alvo.nome, left(coalesce(p_jogador, ''), 60), coalesce(p_personagem, '{}'::jsonb))
    on conflict (campanha_id, user_id) do update
      set personagem = excluded.personagem, jogador = excluded.jogador, campanha_nome = excluded.campanha_nome,
          status = case when m.status = 'aprovado' then 'aprovado' else 'pendente' end, atualizado_em = now();
  return query select m.campanha_id, m.campanha_nome, m.status from public.campanha_membros m where m.campanha_id = alvo.id and m.user_id = eu;
end $$;

-- Mandar de novo o resumo do personagem (vida, classe…) a uma campanha em que já está
create function public.atualizar_personagem_campanha(p_campanha uuid, p_personagem jsonb) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  update public.campanha_membros set personagem = coalesce(p_personagem, '{}'::jsonb), atualizado_em = now()
    where campanha_id = p_campanha and user_id = (select auth.uid());
  if not found then raise exception 'pedido inexistente' using errcode = 'P0002'; end if;
end $$;

-- O mestre aprova ou recusa
create function public.responder_pedido_campanha(p_campanha uuid, p_jogador uuid, p_aprovar boolean) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not public.e_mestre_da_campanha(p_campanha) then raise exception 'so o mestre' using errcode = '42501'; end if;
  update public.campanha_membros set status = case when p_aprovar then 'aprovado' else 'recusado' end, atualizado_em = now()
    where campanha_id = p_campanha and user_id = p_jogador;
  if not found then raise exception 'pedido inexistente' using errcode = 'P0002'; end if;
end $$;

-- Privilégios mínimos
revoke all on table public.campanhas, public.campanha_membros from public, anon, authenticated;
grant select, insert, update, delete on table public.campanhas to authenticated;
grant select, delete on table public.campanha_membros to authenticated;
revoke execute on function public.e_mestre_da_campanha(uuid), public.e_jogador_aprovado(uuid), public.campanhas_tocar(),
  public.campanhas_limite(), public.entrar_campanha(text, text, jsonb), public.atualizar_personagem_campanha(uuid, jsonb),
  public.responder_pedido_campanha(uuid, uuid, boolean) from public, anon;
grant execute on function public.e_mestre_da_campanha(uuid), public.e_jogador_aprovado(uuid), public.entrar_campanha(text, text, jsonb),
  public.atualizar_personagem_campanha(uuid, jsonb), public.responder_pedido_campanha(uuid, uuid, boolean) to authenticated;
revoke execute on function public.campanhas_tocar(), public.campanhas_limite() from authenticated;
