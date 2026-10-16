-- Executar como postgres no SQL Editor. Tudo é revertido no final.
-- Contas temporárias sem senha, sem envio de e-mail, visíveis só nesta transação.
begin;
select set_config('security_test.user_a', gen_random_uuid()::text, true);
select set_config('security_test.user_b', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('security_test.user_a')::uuid),
  (current_setting('security_test.user_b')::uuid);
insert into public.circulos(user_id,nome,projeto) values
  (current_setting('security_test.user_a')::uuid,'security-fixture-a','{}'),
  (current_setting('security_test.user_b')::uuid,'security-fixture-b','{}');
select set_config('request.jwt.claims', json_build_object('sub',current_setting('security_test.user_a'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.circulos) <> 1 then raise exception 'A não vê somente seu círculo'; end if;
  insert into public.circulos(nome,projeto) values('security-own-insert','{}');
  update public.circulos set nome='security-own-updated' where nome='security-own-insert';
  if not found then raise exception 'Update próprio falhou'; end if;
  begin
    update public.circulos set user_id=current_setting('security_test.user_b')::uuid where nome='security-own-updated';
    raise exception 'Transferência indevida permitida';
  exception when insufficient_privilege then null; end;
  update public.circulos set nome='security-foreign-update' where user_id=current_setting('security_test.user_b')::uuid;
  if found then raise exception 'Update alheio permitido'; end if;
  delete from public.circulos where user_id=current_setting('security_test.user_b')::uuid;
  if found then raise exception 'Delete alheio permitido'; end if;
  delete from public.circulos where nome='security-own-updated';
  if not found then raise exception 'Delete próprio falhou'; end if;
  if public.e_admin() then raise exception 'Conta comum virou admin'; end if;
  if exists(select 1 from public.regras_historico) then raise exception 'Histórico exposto'; end if;
  begin
    insert into public.admins(user_id) values(auth.uid());
    raise exception 'Autopromoção permitida';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.circulos(user_id,nome,projeto) values(current_setting('security_test.user_b')::uuid,'security-foreign-insert','{}');
    raise exception 'Insert alheio permitido';
  exception when insufficient_privilege then null; end;
  update public.regras set dados=dados where id='atual';
  if found then raise exception 'Usuário comum alterou regras'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',current_setting('security_test.user_b'),'role','authenticated')::text, true);
do $$ begin
  if (select count(*) from public.circulos) <> 1 then raise exception 'B não vê somente seu círculo'; end if;
  if exists(select 1 from public.circulos where user_id<>auth.uid()) then raise exception 'Dados cruzados expostos'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
  begin
    perform 1 from public.circulos;
    raise exception 'Visitante tem acesso a círculos';
  exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.regras where id='atual') then raise exception 'Regras públicas inacessíveis'; end if;
end $$;
select 'PASS: duas contas isoladas; CRUD próprio permitido; acesso cruzado, transferência, autopromoção e alteração de regras bloqueados; visitante só lê regras' as audit;
rollback;
