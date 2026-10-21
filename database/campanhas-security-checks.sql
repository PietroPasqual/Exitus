-- Executar como postgres no SQL Editor depois de campanhas_supabase.sql. Tudo é revertido no final.
-- Mestre M, jogadora J e intrusa X (contas temporárias, só nesta transação).
begin;
select set_config('t.m', gen_random_uuid()::text, true), set_config('t.j', gen_random_uuid()::text, true), set_config('t.x', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('t.m')::uuid), (current_setting('t.j')::uuid), (current_setting('t.x')::uuid);
set local role authenticated;

-- Mestre cria a campanha
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.m'), 'role', 'authenticated')::text, true);
insert into public.campanhas(nome) values ('Ruínas de Pagma');
select set_config('t.c', (select id::text from public.campanhas), true), set_config('t.code', (select codigo from public.campanhas), true);
do $$ begin
  if length(current_setting('t.code')) <> 8 then raise exception 'Código com tamanho errado'; end if;
  begin perform public.entrar_campanha(current_setting('t.code'), 'M', '{}'); raise exception 'Mestre entrou como jogador';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- Jogadora pede para entrar: ainda não vê a mesa
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.j'), 'role', 'authenticated')::text, true);
do $$ declare r record; begin
  select * into r from public.entrar_campanha(lower(current_setting('t.code')), 'Ana', '{"nome":"Lira"}');
  if r.status <> 'pendente' or r.campanha_nome <> 'Ruínas de Pagma' then raise exception 'Pedido não ficou pendente'; end if;
  if exists (select 1 from public.campanhas) then raise exception 'Pendente vê a campanha'; end if;
  if (select count(*) from public.campanha_membros) <> 1 then raise exception 'Jogadora não vê o próprio pedido'; end if;
  begin perform public.responder_pedido_campanha(current_setting('t.c')::uuid, auth.uid(), true); raise exception 'Jogadora se autorizou';
  exception when insufficient_privilege then null; end;
  begin insert into public.campanha_membros(campanha_id, user_id, status) values (current_setting('t.c')::uuid, auth.uid(), 'aprovado'); raise exception 'Insert direto permitido';
  exception when insufficient_privilege then null; end;
  begin update public.campanha_membros set status = 'aprovado'; raise exception 'Update direto permitido';
  exception when insufficient_privilege then null; end;
  begin perform public.entrar_campanha('ZZZZZZZZ', 'Ana', '{}'); raise exception 'Código inválido aceito';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- Intrusa: não vê nada de ninguém e não altera a campanha
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.x'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public.campanhas) or exists (select 1 from public.campanha_membros) then raise exception 'Intrusa vê dados'; end if;
  update public.campanhas set nome = 'roubada'; if found then raise exception 'Intrusa alterou campanha'; end if;
  delete from public.campanha_membros; if found then raise exception 'Intrusa removeu jogador'; end if;
end $$;

-- Mestre vê o pedido, autoriza e publica a mesa
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.m'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.campanha_membros where status = 'pendente') <> 1 then raise exception 'Mestre não vê o pedido'; end if;
  perform public.responder_pedido_campanha(current_setting('t.c')::uuid, current_setting('t.j')::uuid, true);
  update public.campanhas set mesa = '{"scene":null}', fundo = 'data:image/png;base64,AA==';
  update public.campanhas set mestre_id = current_setting('t.x')::uuid;
  if (select mestre_id from public.campanhas) <> auth.uid() then raise exception 'Campanha transferida'; end if;
end $$;

-- Jogadora autorizada lê a mesa, mas não altera
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.j'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select mesa->>'scene' from public.campanhas) is not null or (select fundo from public.campanhas) = '' then raise exception 'Autorizada não lê a mesa'; end if;
  update public.campanhas set nome = 'minha'; if found then raise exception 'Jogadora alterou a campanha'; end if;
  perform public.atualizar_personagem_campanha(current_setting('t.c')::uuid, '{"nome":"Lira","vida":{"atual":3,"maximo":5}}');
  perform public.entrar_campanha(current_setting('t.code'), 'Ana', '{"nome":"Lira"}');
  if (select status from public.campanha_membros) <> 'aprovado' then raise exception 'Reenviar o personagem tirou a autorização'; end if;
  delete from public.campanha_membros; if not found then raise exception 'Jogadora não conseguiu sair'; end if;
  if exists (select 1 from public.campanhas) then raise exception 'Quem saiu ainda vê a mesa'; end if;
end $$;

-- 40 pedidos recusados não lotam a campanha: a jogadora ainda consegue pedir de novo
reset role;
with novos as (insert into auth.users(id) select gen_random_uuid() from generate_series(1, 40) returning id)
insert into public.campanha_membros(campanha_id, user_id, status) select current_setting('t.c')::uuid, id, 'recusado' from novos;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.j'), 'role', 'authenticated')::text, true);
do $$ declare r record; begin
  select * into r from public.entrar_campanha(current_setting('t.code'), 'Ana', '{"nome":"Lira"}');
  if r.status <> 'pendente' then raise exception 'Recusados lotaram a campanha'; end if;
end $$;

-- Visitante sem conta
set local role anon;
select set_config('request.jwt.claims', '{}', true);
do $$ begin
  begin perform 1 from public.campanhas; raise exception 'Visitante acessa campanhas';
  exception when insufficient_privilege then null; end;
  begin perform public.entrar_campanha('X', '', '{}'); raise exception 'Visitante chama a função';
  exception when insufficient_privilege then null; end;
end $$;
select 'PASS: pedido fica pendente e sem mesa; só o mestre autoriza; autorizada só lê; recusados não lotam; intrusa e visitante sem acesso' as audit;
rollback;
