-- FinWill Business - recursos empresariais simplificados para MEI e pequenos negócios
--
-- Esta migration é aditiva. Ela mantém compatibilidade com o frontend original,
-- adiciona contexto empresarial, contatos, convites, pró-labore/retiradas e faz
-- o saldo das contas acompanhar as transações de forma atômica no PostgreSQL.

begin;

set local search_path = public, extensions, auth;

alter table public.organizacoes
  add column if not exists nome_fantasia text,
  add column if not exists documento text,
  add column if not exists moeda char(3) not null default 'BRL',
  add column if not exists fuso_horario text not null default 'America/Sao_Paulo';

-- O papel "socio" pode operar o financeiro. "consulta" é somente leitura.
alter table public.membros_organizacao
  drop constraint if exists membros_organizacao_papel_check;

alter table public.membros_organizacao
  add constraint membros_organizacao_papel_check
  check (papel in (
    'proprietario', 'administrador', 'financeiro', 'socio',
    'membro', 'visualizador', 'consulta'
  ));

create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  tipo text not null default 'cliente' check (tipo in ('cliente', 'fornecedor', 'ambos')),
  email text,
  telefone text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contatos_org_nome_idx
  on public.contatos(organizacao_id, lower(nome));

create table if not exists public.convites_organizacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  email text not null check (btrim(email) <> ''),
  papel text not null default 'socio' check (papel in ('administrador', 'socio', 'consulta')),
  codigo_hash text not null unique,
  convidado_por uuid not null references auth.users(id) on delete cascade,
  expira_em timestamptz not null default (now() + interval '7 days'),
  aceito_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists convites_org_email_idx
  on public.convites_organizacao(organizacao_id, lower(email));

create table if not exists public.configuracoes_retirada (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  beneficiario_usuario_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null default 'Pró-labore mensal',
  valor numeric(14, 2) not null check (valor > 0),
  dia_vencimento smallint not null default 5 check (dia_vencimento between 1 and 31),
  conta_id uuid references public.contas(id) on delete set null,
  categoria_id uuid references public.categorias(id) on delete set null,
  proxima_competencia date not null default date_trunc('month', now())::date,
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (organizacao_id, beneficiario_usuario_id)
);

create table if not exists public.itens_planejamento (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null check (btrim(descricao) <> ''),
  valor numeric(14, 2) not null check (valor > 0),
  tipo text not null check (tipo in ('receita', 'despesa')),
  mes_inicio date not null,
  duracao_meses integer not null default 1 check (duracao_meses >= 0),
  categoria_id uuid references public.categorias(id) on delete set null,
  conta_id uuid references public.contas(id) on delete set null,
  cartao_id uuid references public.cartoes(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.transacoes
  add column if not exists data_vencimento timestamptz,
  add column if not exists competencia_mes date,
  add column if not exists natureza text not null default 'operacional',
  add column if not exists contato_id uuid references public.contatos(id) on delete set null,
  add column if not exists beneficiario_usuario_id uuid references auth.users(id) on delete set null,
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null,
  add column if not exists baixado_por uuid references auth.users(id) on delete set null,
  add column if not exists versao integer not null default 1;

alter table public.transacoes
  drop constraint if exists transacoes_natureza_check;

alter table public.transacoes
  add constraint transacoes_natureza_check check (natureza in (
    'operacional', 'pro_labore', 'retirada_extra', 'aporte_socio',
    'transferencia', 'pagamento_fatura', 'ajuste_saldo'
  ));

create index if not exists transacoes_org_vencimento_idx
  on public.transacoes(organizacao_id, data_vencimento);
create index if not exists transacoes_org_natureza_idx
  on public.transacoes(organizacao_id, natureza);
create index if not exists transacoes_org_contato_idx
  on public.transacoes(organizacao_id, contato_id);

-- Auditoria empresarial sem mudar a compatibilidade do usuario_id histórico.
create or replace function public.apply_transaction_business_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    new.atualizado_por := coalesce(new.atualizado_por, auth.uid());
    if new.esta_pago then
      new.baixado_por := coalesce(new.baixado_por, auth.uid());
      new.data_pagamento := coalesce(new.data_pagamento, new.data, now());
    end if;
  else
    new.criado_por := old.criado_por;
    new.atualizado_por := auth.uid();
    new.versao := old.versao + 1;

    if new.esta_pago and not old.esta_pago then
      new.baixado_por := auth.uid();
      new.data_pagamento := coalesce(new.data_pagamento, now());
    elsif not new.esta_pago then
      new.baixado_por := null;
      new.data_pagamento := null;
    else
      new.baixado_por := old.baixado_por;
    end if;
  end if;

  new.data_vencimento := coalesce(new.data_vencimento, new.data);
  new.competencia_mes := coalesce(
    new.competencia_mes,
    date_trunc('month', new.data at time zone 'America/Sao_Paulo')::date
  );

  if new.observacoes like 'transferencia:%' then
    new.natureza := 'transferencia';
  elsif new.observacoes like 'pagamento_fatura:%' then
    new.natureza := 'pagamento_fatura';
  elsif new.observacoes = 'Ajuste manual de saldo' then
    new.natureza := 'ajuste_saldo';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_transacoes_business_fields on public.transacoes;
create trigger zz_transacoes_business_fields
  before insert or update on public.transacoes
  for each row execute function public.apply_transaction_business_fields();

-- Um lançamento pago com conta tem impacto real de caixa. Compra de cartão só
-- movimenta conta no registro técnico do pagamento da fatura.
create or replace function public.transaction_cash_impact(
  p_tipo text,
  p_valor numeric,
  p_esta_pago boolean,
  p_conta_id uuid,
  p_cartao_id uuid,
  p_natureza text,
  p_observacoes text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when not coalesce(p_esta_pago, false) or p_conta_id is null then 0::numeric
    when p_cartao_id is not null
      and coalesce(p_natureza, 'operacional') <> 'pagamento_fatura'
      and coalesce(p_observacoes, '') not like 'pagamento_fatura:%'
      then 0::numeric
    when p_tipo = 'receita' then coalesce(p_valor, 0)
    else -coalesce(p_valor, 0)
  end;
$$;

create or replace function public.sync_account_balance_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  old_impact numeric := 0;
  new_impact numeric := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_impact := public.transaction_cash_impact(
      old.tipo, old.valor, old.esta_pago, old.conta_id, old.cartao_id,
      old.natureza, old.observacoes
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    new_impact := public.transaction_cash_impact(
      new.tipo, new.valor, new.esta_pago, new.conta_id, new.cartao_id,
      new.natureza, new.observacoes
    );
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.conta_id is not null and old_impact <> 0 then
    update public.contas
      set saldo = saldo - old_impact,
          atualizado_em = now()
      where id = old.conta_id and organizacao_id = old.organizacao_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.conta_id is not null and new_impact <> 0 then
    update public.contas
      set saldo = saldo + new_impact,
          atualizado_em = now()
      where id = new.conta_id and organizacao_id = new.organizacao_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_transacoes_sync_account_balance on public.transacoes;
create trigger zz_transacoes_sync_account_balance
  after insert or update or delete on public.transacoes
  for each row execute function public.sync_account_balance_from_transaction();

-- Amplia a validação de referências para os novos campos.
create or replace function public.ensure_same_organization_references()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.conta_id is not null and not exists (
    select 1 from public.contas c
    where c.id = new.conta_id and c.organizacao_id = new.organizacao_id
  ) then
    raise exception 'A conta referenciada pertence a outra organização ou não existe.' using errcode = '23503';
  end if;

  -- A função também atende formas_pagamento, cujo registro NEW não possui
  -- cartao_id/categoria_id/contato_id. O bloco aninhado evita resolver campos
  -- que não existem quando o trigger é executado naquela tabela.
  if tg_table_name = 'transacoes' then
    if new.cartao_id is not null and not exists (
      select 1 from public.cartoes c
      where c.id = new.cartao_id and c.organizacao_id = new.organizacao_id
    ) then
      raise exception 'O cartão referenciado pertence a outra organização ou não existe.' using errcode = '23503';
    end if;

    if new.categoria_id is not null and not exists (
      select 1 from public.categorias c
      where c.id = new.categoria_id and c.organizacao_id = new.organizacao_id
    ) then
      raise exception 'A categoria referenciada pertence a outra organização ou não existe.' using errcode = '23503';
    end if;

    if new.contato_id is not null and not exists (
      select 1 from public.contatos c
      where c.id = new.contato_id and c.organizacao_id = new.organizacao_id
    ) then
      raise exception 'O contato referenciado pertence a outra organização ou não existe.' using errcode = '23503';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.is_organization_editor(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.membros_organizacao m
    where m.organizacao_id = target_organization_id
      and m.usuario_id = auth.uid()
      and m.ativo
      and m.papel in ('proprietario', 'administrador', 'financeiro', 'socio')
  );
$$;

create or replace function public.switch_organization(p_organizacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.is_organization_member(p_organizacao_id) then
    raise exception 'Você não pertence a esta empresa.' using errcode = '42501';
  end if;

  -- O índice parcial permite somente uma empresa padrão por usuário. Fazer isso
  -- em duas instruções evita uma colisão transitória quando o PostgreSQL atualiza
  -- a nova linha padrão antes da antiga na mesma instrução.
  update public.membros_organizacao
    set padrao = false, atualizado_em = now()
    where usuario_id = auth.uid() and ativo and padrao;

  update public.membros_organizacao
    set padrao = true, atualizado_em = now()
    where usuario_id = auth.uid()
      and organizacao_id = p_organizacao_id
      and ativo;

  update public.perfis
    set organizacao_padrao_id = p_organizacao_id, atualizado_em = now()
    where id = auth.uid();

  return p_organizacao_id;
end;
$$;

create or replace function public.create_organization_invite(
  p_email text,
  p_papel text default 'socio'
)
returns table(codigo text, expira_em timestamptz)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  active_organization_id uuid := public.current_organization_id();
  generated_code text;
  expiration timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null or not public.is_organization_admin(active_organization_id) then
    raise exception 'Somente administradores podem convidar usuários.' using errcode = '42501';
  end if;

  if p_papel not in ('administrador', 'socio', 'consulta') then
    raise exception 'Perfil de convite inválido.' using errcode = '22023';
  end if;

  if nullif(btrim(p_email), '') is null then
    raise exception 'E-mail é obrigatório.' using errcode = '22023';
  end if;

  generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  delete from public.convites_organizacao
   where organizacao_id = active_organization_id
     and lower(email) = lower(btrim(p_email))
     and aceito_em is null;

  insert into public.convites_organizacao (
    organizacao_id, email, papel, codigo_hash, convidado_por, expira_em
  ) values (
    active_organization_id,
    lower(btrim(p_email)),
    p_papel,
    encode(digest(generated_code, 'sha256'), 'hex'),
    auth.uid(),
    expiration
  );

  return query select generated_code, expiration;
end;
$$;

create or replace function public.list_current_organization_members()
returns table(
  organizacao_id uuid,
  usuario_id uuid,
  papel text,
  ativo boolean,
  padrao boolean,
  email text,
  nome_exibicao text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    m.organizacao_id,
    m.usuario_id,
    m.papel,
    m.ativo,
    m.padrao,
    p.email,
    p.nome_exibicao
  from public.membros_organizacao m
  left join public.perfis p on p.id = m.usuario_id
  where m.organizacao_id = public.current_organization_id()
    and public.is_organization_member(m.organizacao_id)
  order by
    case m.papel when 'proprietario' then 0 when 'administrador' then 1 when 'socio' then 2 else 3 end,
    coalesce(p.nome_exibicao, p.email);
$$;

create or replace function public.update_organization_member(
  p_usuario_id uuid,
  p_papel text,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_organization_id uuid := public.current_organization_id();
  current_role text;
begin
  if auth.uid() is null or not public.is_organization_admin(active_organization_id) then
    raise exception 'Somente administradores podem alterar usuários.' using errcode = '42501';
  end if;

  if p_papel not in ('administrador', 'socio', 'consulta') then
    raise exception 'Perfil inválido.' using errcode = '22023';
  end if;

  select papel into current_role
  from public.membros_organizacao
  where organizacao_id = active_organization_id and usuario_id = p_usuario_id;

  if current_role is null then
    raise exception 'Usuário não pertence à empresa.' using errcode = '22023';
  end if;

  if current_role = 'proprietario' then
    raise exception 'O proprietário principal não pode ser alterado por esta ação.' using errcode = '42501';
  end if;

  update public.membros_organizacao
    set papel = p_papel, ativo = p_ativo, atualizado_em = now()
    where organizacao_id = active_organization_id and usuario_id = p_usuario_id;
end;
$$;

create or replace function public.accept_organization_invite(p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  invitation public.convites_organizacao%rowtype;
  authenticated_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;

  select * into invitation
  from public.convites_organizacao
  where codigo_hash = encode(digest(upper(btrim(p_codigo)), 'sha256'), 'hex')
    and aceito_em is null
    and expira_em > now()
  for update;

  if invitation.id is null then
    raise exception 'Convite inválido ou expirado.' using errcode = '22023';
  end if;

  if lower(invitation.email) <> authenticated_email then
    raise exception 'Este convite pertence a outro e-mail.' using errcode = '42501';
  end if;

  update public.membros_organizacao
    set padrao = false, atualizado_em = now()
    where usuario_id = auth.uid();

  insert into public.membros_organizacao (
    organizacao_id, usuario_id, papel, ativo, padrao, convidado_por
  ) values (
    invitation.organizacao_id, auth.uid(), invitation.papel,
    true, true, invitation.convidado_por
  )
  on conflict (organizacao_id, usuario_id) do update
    set papel = excluded.papel,
        ativo = true,
        padrao = true,
        convidado_por = excluded.convidado_por,
        atualizado_em = now();

  update public.perfis
    set organizacao_padrao_id = invitation.organizacao_id, atualizado_em = now()
    where id = auth.uid();

  update public.convites_organizacao
    set aceito_em = now()
    where id = invitation.id;

  return invitation.organizacao_id;
end;
$$;

create or replace function public.generate_due_prolabore()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  config record;
  generated_count integer := 0;
  due_date date;
  authenticated_user_id uuid := auth.uid();
  active_organization_id uuid := public.current_organization_id();
begin
  if authenticated_user_id is null then
    raise exception 'Autenticação obrigatória.' using errcode = '28000';
  end if;

  if active_organization_id is null
    or not public.is_organization_editor(active_organization_id)
  then
    return 0;
  end if;

  for config in
    select cr.*
    from public.configuracoes_retirada cr
    where cr.organizacao_id = active_organization_id
      and cr.ativo
      and cr.proxima_competencia <= date_trunc('month', current_date)::date
  loop
    due_date := make_date(
      extract(year from config.proxima_competencia)::int,
      extract(month from config.proxima_competencia)::int,
      least(
        config.dia_vencimento,
        extract(day from (date_trunc('month', config.proxima_competencia) + interval '1 month - 1 day'))::int
      )
    );

    if not exists (
      select 1 from public.transacoes t
      where t.organizacao_id = config.organizacao_id
        and t.natureza = 'pro_labore'
        and t.beneficiario_usuario_id = config.beneficiario_usuario_id
        and t.competencia_mes = config.proxima_competencia
    ) then
      insert into public.transacoes (
        organizacao_id, usuario_id, descricao, valor, data, data_vencimento,
        competencia_mes, tipo, categoria_id, conta_id, esta_pago, natureza,
        beneficiario_usuario_id, observacoes, criado_por, atualizado_por
      ) values (
        config.organizacao_id, authenticated_user_id, config.descricao, config.valor,
        due_date::timestamptz, due_date::timestamptz, config.proxima_competencia,
        'despesa', config.categoria_id, null, false, 'pro_labore',
        config.beneficiario_usuario_id, 'Pró-labore recorrente',
        authenticated_user_id, authenticated_user_id
      );
      generated_count := generated_count + 1;
    end if;

    update public.configuracoes_retirada
      set proxima_competencia = (config.proxima_competencia + interval '1 month')::date,
          atualizado_em = now()
      where id = config.id;
  end loop;

  return generated_count;
end;
$$;

drop trigger if exists contatos_tenant_audit on public.contatos;
create trigger contatos_tenant_audit
  before insert or update on public.contatos
  for each row execute function public.apply_tenant_audit_fields();

alter table public.contatos enable row level security;
alter table public.convites_organizacao enable row level security;
alter table public.configuracoes_retirada enable row level security;
alter table public.itens_planejamento enable row level security;

create policy contatos_select_tenant on public.contatos
  for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy contatos_insert_tenant on public.contatos
  for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy contatos_update_tenant on public.contatos
  for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy contatos_delete_tenant on public.contatos
  for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

create policy convites_select_admin on public.convites_organizacao
  for select to authenticated
  using (public.is_organization_admin(organizacao_id));

create policy configuracoes_retirada_select_tenant on public.configuracoes_retirada
  for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy configuracoes_retirada_insert_admin on public.configuracoes_retirada
  for insert to authenticated
  with check (
    organizacao_id = public.current_organization_id()
    and public.is_organization_admin(organizacao_id)
    and criado_por = auth.uid()
  );
create policy configuracoes_retirada_update_admin on public.configuracoes_retirada
  for update to authenticated
  using (public.is_organization_admin(organizacao_id))
  with check (public.is_organization_admin(organizacao_id));
create policy configuracoes_retirada_delete_admin on public.configuracoes_retirada
  for delete to authenticated
  using (public.is_organization_admin(organizacao_id));

create policy itens_planejamento_select_tenant on public.itens_planejamento
  for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy itens_planejamento_insert_tenant on public.itens_planejamento
  for insert to authenticated
  with check (
    organizacao_id = public.current_organization_id()
    and public.is_organization_editor(organizacao_id)
    and usuario_id = auth.uid()
  );
create policy itens_planejamento_update_tenant on public.itens_planejamento
  for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy itens_planejamento_delete_tenant on public.itens_planejamento
  for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

grant select, insert, update, delete on
  public.contatos,
  public.configuracoes_retirada,
  public.itens_planejamento
to authenticated;
grant select on public.convites_organizacao to authenticated;
grant execute on function public.switch_organization(uuid) to authenticated;
grant execute on function public.create_organization_invite(text, text) to authenticated;
grant execute on function public.accept_organization_invite(text) to authenticated;
grant execute on function public.list_current_organization_members() to authenticated;
grant execute on function public.update_organization_member(uuid, text, boolean) to authenticated;
grant execute on function public.generate_due_prolabore() to authenticated;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'contatos', 'convites_organizacao', 'configuracoes_retirada', 'itens_planejamento'
    ] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end;
$$;

commit;
