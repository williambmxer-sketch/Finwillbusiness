-- Executado pelo endpoint de administração dentro de uma única transação.
-- Nenhum usuário ou dado de teste persiste porque o script termina em ROLLBACK.

begin;

do $$
declare
  owner_id uuid := '10000000-0000-4000-8000-000000000001';
  partner_id uuid := '10000000-0000-4000-8000-000000000002';
  owner_email text := 'owner-rollback@finwillbusiness.example';
  partner_email text := 'partner-rollback@finwillbusiness.example';
  invite_code text;
  owner_org uuid;
  target_account uuid;
  target_category uuid;
  balance_before numeric;
  balance_after numeric;
  seeded boolean;
  member_count integer;
  transaction_count integer;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    owner_id, 'authenticated', 'authenticated', owner_email, '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Owner Rollback"}'::jsonb, now(), now()
  );

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    partner_id, 'authenticated', 'authenticated', partner_email, '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Partner Rollback"}'::jsonb, now(), now()
  );

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', owner_id, 'email', owner_email, 'role', 'authenticated'
  )::text, true);

  owner_org := public.current_organization_id();
  if owner_org is null then
    raise exception 'Organização inicial não foi criada para o proprietário.';
  end if;

  seeded := public.ensure_business_demo_data();
  if not seeded then
    raise exception 'Carga demonstrativa não foi criada em organização vazia.';
  end if;

  if public.ensure_business_demo_data() then
    raise exception 'Carga demonstrativa não é idempotente.';
  end if;

  select codigo into invite_code
  from public.create_organization_invite(partner_email, 'socio');

  if invite_code is null then
    raise exception 'Código de convite não foi gerado.';
  end if;

  perform set_config('request.jwt.claim.sub', partner_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', partner_id, 'email', partner_email, 'role', 'authenticated'
  )::text, true);

  if public.accept_organization_invite(invite_code) <> owner_org then
    raise exception 'Convite não ativou a empresa compartilhada.';
  end if;

  select count(*) into member_count
  from public.membros_organizacao
  where organizacao_id = owner_org and ativo;
  if member_count <> 2 then
    raise exception 'Empresa deveria possuir dois usuários ativos; encontrou %.', member_count;
  end if;

  select id, saldo into target_account, balance_before
  from public.contas
  where organizacao_id = owner_org and nome = 'Conta PJ';
  select id into target_category
  from public.categorias
  where organizacao_id = owner_org and tipo = 'despesa'
  order by criado_em
  limit 1;

  insert into public.transacoes (
    organizacao_id, usuario_id, descricao, valor, data, tipo,
    categoria_id, conta_id, esta_pago, data_pagamento, natureza
  ) values (
    owner_org, partner_id, 'Teste atômico do sócio', 50, now(), 'despesa',
    target_category, target_account, true, now(), 'operacional'
  );

  select saldo into balance_after from public.contas where id = target_account;
  if balance_after <> balance_before - 50 then
    raise exception 'Trigger de saldo falhou: antes %, depois %.', balance_before, balance_after;
  end if;

  update public.transacoes
    set esta_pago = false
    where organizacao_id = owner_org and descricao = 'Teste atômico do sócio';
  select saldo into balance_after from public.contas where id = target_account;
  if balance_after <> balance_before then
    raise exception 'Estorno atômico falhou: esperado %, encontrado %.', balance_before, balance_after;
  end if;

  select count(*) into transaction_count
  from public.transacoes where organizacao_id = owner_org;
  if transaction_count < 20 then
    raise exception 'Carga demonstrativa insuficiente: % lançamentos.', transaction_count;
  end if;
end;
$$;

-- Exercita as políticas RLS como o segundo usuário.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","email":"partner-rollback@finwillbusiness.example","role":"authenticated"}',
  true
);

do $$
declare
  shared_count integer;
  isolated_count integer;
  personal_org uuid;
  shared_org uuid;
  target_account uuid;
  target_category uuid;
begin
  select count(*) into shared_count from public.transacoes;
  if shared_count < 20 then
    raise exception 'Sócio não conseguiu ler os dados compartilhados via RLS.';
  end if;

  select organizacao_id into personal_org
  from public.membros_organizacao
  where usuario_id = auth.uid() and papel = 'proprietario';
  select organizacao_id into shared_org
  from public.membros_organizacao
  where usuario_id = auth.uid() and papel = 'socio';

  select id into target_account from public.contas where nome = 'Conta PJ';
  select id into target_category
  from public.categorias where tipo = 'despesa' order by criado_em limit 1;

  insert into public.transacoes (
    organizacao_id, usuario_id, descricao, valor, data, tipo,
    categoria_id, conta_id, esta_pago, natureza
  ) values (
    shared_org, auth.uid(), 'Teste RLS do sócio', 1, now(), 'despesa',
    target_category, target_account, false, 'operacional'
  );
  delete from public.transacoes
  where organizacao_id = shared_org and descricao = 'Teste RLS do sócio';

  perform public.switch_organization(personal_org);
  select count(*) into isolated_count from public.transacoes;
  if isolated_count <> 0 then
    raise exception 'RLS permitiu dados da outra empresa: % linhas.', isolated_count;
  end if;

  perform public.switch_organization(shared_org);
end;
$$;

-- Confirma que o perfil de consulta continua lendo, mas não escreve nem usa
-- funções SECURITY DEFINER para gerar compromissos.
reset role;

do $$
begin
  update public.membros_organizacao
    set papel = 'consulta'
    where usuario_id = '10000000-0000-4000-8000-000000000002'
      and organizacao_id = public.current_organization_id();

  update public.configuracoes_retirada
    set proxima_competencia = date_trunc('month', current_date)::date
    where organizacao_id = public.current_organization_id();
end;
$$;

set local role authenticated;

do $$
declare
  config_before date;
  config_after date;
  generated integer;
  write_was_denied boolean := false;
  target_category uuid;
begin
  select proxima_competencia into config_before
  from public.configuracoes_retirada limit 1;

  generated := public.generate_due_prolabore();
  if generated <> 0 then
    raise exception 'Usuário de consulta gerou % compromisso(s).', generated;
  end if;

  select proxima_competencia into config_after
  from public.configuracoes_retirada limit 1;
  if config_after is distinct from config_before then
    raise exception 'Usuário de consulta alterou a recorrência de pró-labore.';
  end if;

  select id into target_category
  from public.categorias where tipo = 'despesa' order by criado_em limit 1;

  begin
    insert into public.transacoes (
      organizacao_id, usuario_id, descricao, valor, data, tipo,
      categoria_id, esta_pago, natureza
    ) values (
      public.current_organization_id(), auth.uid(), 'Escrita indevida de consulta',
      1, now(), 'despesa', target_category, false, 'operacional'
    );
  exception when insufficient_privilege then
    write_was_denied := true;
  end;

  if not write_was_denied then
    raise exception 'Política RLS permitiu escrita para usuário de consulta.';
  end if;
end;
$$;

select
  (select count(*) from public.contas) as contas_visiveis,
  (select count(*) from public.contatos) as contatos_visiveis,
  (select count(*) from public.transacoes) as transacoes_visiveis,
  (select count(*) from public.membros_organizacao where organizacao_id = public.current_organization_id() and ativo) as usuarios_ativos,
  (select saldo from public.contas where nome = 'Conta PJ') as saldo_conta_pj;

rollback;
