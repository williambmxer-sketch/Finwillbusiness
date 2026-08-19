-- FinWill Business - schema inicial multi-tenant
--
-- Esta migration cria um banco novo do zero para a edição empresarial.
-- Não cria usuários nem importa dados. Cada novo usuário autenticado recebe
-- automaticamente uma organização inicial; usuários adicionais podem ser
-- vinculados pela tabela membros_organizacao.
--
-- Compatibilidade com o frontend atual:
-- - mantém as tabelas e os nomes de coluna em português usados pela API;
-- - preenche organizacao_id automaticamente a partir do usuário autenticado;
-- - preserva usuario_id enviado pela aplicação, mas impede falsificação;
-- - aplica RLS por organização, mesmo quando a API faz select/update sem
--   informar explicitamente o tenant.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

set local search_path = public, extensions, auth;

create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  slug text not null unique check (btrim(slug) <> ''),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.organizacoes is 'Tenants empresariais do FinWill Business.';

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome_exibicao text,
  organizacao_padrao_id uuid references public.organizacoes(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.membros_organizacao (
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('proprietario', 'administrador', 'financeiro', 'membro', 'visualizador')),
  ativo boolean not null default true,
  padrao boolean not null default false,
  convidado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (organizacao_id, usuario_id)
);

create unique index if not exists membros_organizacao_um_padrao_por_usuario_idx
  on public.membros_organizacao(usuario_id)
  where padrao and ativo;

create unique index if not exists membros_organizacao_um_proprietario_por_tenant_idx
  on public.membros_organizacao(organizacao_id)
  where papel = 'proprietario' and ativo;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  icone text not null default 'Tag',
  cor text not null default '#f97316',
  tipo text not null check (tipo in ('receita', 'despesa')),
  mostrar_em_cartoes boolean not null default true,
  mostrar_em_contas boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists categorias_org_tipo_nome_idx
  on public.categorias(organizacao_id, tipo, lower(nome));

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  tipo text not null check (tipo in ('corrente', 'poupança', 'carteira', 'investimento')),
  saldo numeric(14, 2) not null default 0,
  cor text not null default '#f97316',
  icone text not null default 'Wallet',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists contas_org_nome_idx
  on public.contas(organizacao_id, lower(nome));

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  bandeira text not null default 'Mastercard',
  cor text not null default '#f97316',
  limite_credito numeric(14, 2) not null default 0 check (limite_credito >= 0),
  dia_fechamento smallint not null default 10 check (dia_fechamento between 1 and 31),
  dia_vencimento smallint not null default 17 check (dia_vencimento between 1 and 31),
  banco text not null default 'Banco',
  ultimos_quatro char(4) not null default '0000' check (ultimos_quatro ~ '^[0-9]{4}$'),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists cartoes_org_nome_idx
  on public.cartoes(organizacao_id, lower(nome));

create table if not exists public.formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  debitar_conta boolean not null default true,
  conta_id uuid references public.contas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists formas_pagamento_org_nome_idx
  on public.formas_pagamento(organizacao_id, lower(nome));

create index if not exists formas_pagamento_conta_id_idx
  on public.formas_pagamento(conta_id);

create table if not exists public.transacoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null check (btrim(descricao) <> ''),
  valor numeric(14, 2) not null check (valor > 0),
  data timestamptz not null default now(),
  tipo text not null check (tipo in ('receita', 'despesa')),
  categoria_id uuid references public.categorias(id) on delete set null,
  conta_id uuid references public.contas(id) on delete set null,
  cartao_id uuid references public.cartoes(id) on delete set null,
  parcelas integer not null default 1 check (parcelas >= 1),
  parcela_atual integer not null default 1 check (parcela_atual >= 1),
  -- É um UUID de agrupamento para parcelas/transferências; não aponta
  -- necessariamente para o id de uma linha existente.
  transacao_pai_id uuid,
  esta_pago boolean not null default false,
  data_pagamento timestamptz,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (parcela_atual <= parcelas)
);

create index if not exists transacoes_org_data_idx
  on public.transacoes(organizacao_id, data desc);

create index if not exists transacoes_org_categoria_idx
  on public.transacoes(organizacao_id, categoria_id);

create index if not exists transacoes_org_conta_idx
  on public.transacoes(organizacao_id, conta_id);

create index if not exists transacoes_org_cartao_idx
  on public.transacoes(organizacao_id, cartao_id);

create index if not exists transacoes_org_pai_idx
  on public.transacoes(organizacao_id, transacao_pai_id);

-- O frontend usa um canal Realtime amplo para atualizar qualquer alteração
-- financeira. O bloco é tolerante a projetos onde a publicação ainda não
-- existe e a cada tabela já adicionada.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'organizacoes',
      'perfis',
      'membros_organizacao',
      'categorias',
      'contas',
      'cartoes',
      'formas_pagamento',
      'transacoes'
    ] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      exception
        when duplicate_object then null;
      end;
    end loop;
  end if;
end;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select p.organizacao_padrao_id
      from public.perfis p
      join public.membros_organizacao m
        on m.organizacao_id = p.organizacao_padrao_id
       and m.usuario_id = p.id
       and m.ativo
      where p.id = auth.uid()
      limit 1
    ),
    (
      select m.organizacao_id
      from public.membros_organizacao m
      where m.usuario_id = auth.uid()
        and m.ativo
      order by m.padrao desc, m.criado_em
      limit 1
    )
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.membros_organizacao m
    where m.organizacao_id = target_organization_id
      and m.usuario_id = auth.uid()
      and m.ativo
  );
$$;

create or replace function public.is_organization_editor(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.membros_organizacao m
    where m.organizacao_id = target_organization_id
      and m.usuario_id = auth.uid()
      and m.ativo
      and m.papel in ('proprietario', 'administrador', 'financeiro')
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.membros_organizacao m
    where m.organizacao_id = target_organization_id
      and m.usuario_id = auth.uid()
      and m.ativo
      and m.papel in ('proprietario', 'administrador')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_organization_id uuid;
  display_name text;
  organization_name text;
  organization_slug text;
begin
  display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'Novo usuário'
  );

  organization_name := 'Empresa de ' || display_name;
  organization_slug := lower(regexp_replace(display_name, '[^a-zA-Z0-9]+', '-', 'g'));
  organization_slug := trim(both '-' from organization_slug);
  organization_slug := left(coalesce(nullif(organization_slug, ''), 'organizacao'), 40)
    || '-' || left(replace(new.id::text, '-', ''), 8);

  insert into public.organizacoes (nome, slug, criado_por)
  values (organization_name, organization_slug, new.id)
  returning id into new_organization_id;

  insert into public.membros_organizacao (
    organizacao_id,
    usuario_id,
    papel,
    ativo,
    padrao
  )
  values (new_organization_id, new.id, 'proprietario', true, true);

  insert into public.perfis (
    id,
    email,
    nome_exibicao,
    organizacao_padrao_id
  )
  values (new.id, new.email, display_name, new_organization_id)
  on conflict (id) do update
    set email = excluded.email,
        nome_exibicao = excluded.nome_exibicao,
        organizacao_padrao_id = excluded.organizacao_padrao_id,
        atualizado_em = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_tenant_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, auth
as $$
declare
  authenticated_user_id uuid := auth.uid();
  active_organization_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Usuário autenticado é obrigatório.' using errcode = '28000';
  end if;

  if tg_op = 'INSERT' then
    active_organization_id := public.current_organization_id();

    new.usuario_id := coalesce(new.usuario_id, authenticated_user_id);
    new.organizacao_id := coalesce(new.organizacao_id, active_organization_id);

    if new.usuario_id <> authenticated_user_id then
      raise exception 'usuario_id não corresponde ao usuário autenticado.' using errcode = '42501';
    end if;

    if new.organizacao_id is null or not public.is_organization_member(new.organizacao_id) then
      raise exception 'Usuário não pertence à organização informada.' using errcode = '42501';
    end if;

    new.criado_em := coalesce(new.criado_em, now());
  else
    if not public.is_organization_member(old.organizacao_id) then
      raise exception 'Usuário não pertence à organização do registro.' using errcode = '42501';
    end if;

    new.organizacao_id := old.organizacao_id;
    new.usuario_id := old.usuario_id;
    new.criado_em := old.criado_em;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.ensure_same_organization_references()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.conta_id is not null and not exists (
    select 1 from public.contas c
    where c.id = new.conta_id
      and c.organizacao_id = new.organizacao_id
  ) then
    raise exception 'A conta referenciada pertence a outra organização ou não existe.' using errcode = '23503';
  end if;

  if tg_table_name = 'transacoes' and new.cartao_id is not null and not exists (
    select 1 from public.cartoes c
    where c.id = new.cartao_id
      and c.organizacao_id = new.organizacao_id
  ) then
    raise exception 'O cartão referenciado pertence a outra organização ou não existe.' using errcode = '23503';
  end if;

  if tg_table_name = 'transacoes' and new.categoria_id is not null and not exists (
    select 1 from public.categorias c
    where c.id = new.categoria_id
      and c.organizacao_id = new.organizacao_id
  ) then
    raise exception 'A categoria referenciada pertence a outra organização ou não existe.' using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger categorias_tenant_audit
  before insert or update on public.categorias
  for each row execute function public.apply_tenant_audit_fields();

create trigger contas_tenant_audit
  before insert or update on public.contas
  for each row execute function public.apply_tenant_audit_fields();

create trigger cartoes_tenant_audit
  before insert or update on public.cartoes
  for each row execute function public.apply_tenant_audit_fields();

create trigger formas_pagamento_tenant_audit
  before insert or update on public.formas_pagamento
  for each row execute function public.apply_tenant_audit_fields();

create trigger transacoes_tenant_audit
  before insert or update on public.transacoes
  for each row execute function public.apply_tenant_audit_fields();

create trigger zz_formas_pagamento_same_org_refs
  before insert or update on public.formas_pagamento
  for each row execute function public.ensure_same_organization_references();

create trigger zz_transacoes_same_org_refs
  before insert or update on public.transacoes
  for each row execute function public.ensure_same_organization_references();

alter table public.organizacoes enable row level security;
alter table public.perfis enable row level security;
alter table public.membros_organizacao enable row level security;
alter table public.categorias enable row level security;
alter table public.contas enable row level security;
alter table public.cartoes enable row level security;
alter table public.formas_pagamento enable row level security;
alter table public.transacoes enable row level security;

create policy organizacoes_select_member
  on public.organizacoes for select to authenticated
  using (public.is_organization_member(id));

create policy organizacoes_update_admin
  on public.organizacoes for update to authenticated
  using (public.is_organization_admin(id))
  with check (public.is_organization_admin(id));

create policy perfis_select_self
  on public.perfis for select to authenticated
  using (id = auth.uid());

create policy perfis_insert_self
  on public.perfis for insert to authenticated
  with check (
    id = auth.uid()
    and (
      organizacao_padrao_id is null
      or public.is_organization_member(organizacao_padrao_id)
    )
  );

create policy perfis_update_self
  on public.perfis for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      organizacao_padrao_id is null
      or public.is_organization_member(organizacao_padrao_id)
    )
  );

create policy membros_select_member
  on public.membros_organizacao for select to authenticated
  using (public.is_organization_member(organizacao_id));

create policy membros_insert_admin
  on public.membros_organizacao for insert to authenticated
  with check (public.is_organization_admin(organizacao_id));

create policy membros_update_admin
  on public.membros_organizacao for update to authenticated
  using (public.is_organization_admin(organizacao_id))
  with check (public.is_organization_admin(organizacao_id));

create policy membros_delete_admin
  on public.membros_organizacao for delete to authenticated
  using (public.is_organization_admin(organizacao_id));

-- Políticas comuns aos dados financeiros. A organização é a fronteira de
-- segurança; o papel controla escrita e leitura nunca atravessa tenants.
create policy categorias_select_tenant
  on public.categorias for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy categorias_insert_tenant
  on public.categorias for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy categorias_update_tenant
  on public.categorias for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy categorias_delete_tenant
  on public.categorias for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

create policy contas_select_tenant
  on public.contas for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy contas_insert_tenant
  on public.contas for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy contas_update_tenant
  on public.contas for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy contas_delete_tenant
  on public.contas for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

create policy cartoes_select_tenant
  on public.cartoes for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy cartoes_insert_tenant
  on public.cartoes for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy cartoes_update_tenant
  on public.cartoes for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy cartoes_delete_tenant
  on public.cartoes for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

create policy formas_pagamento_select_tenant
  on public.formas_pagamento for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy formas_pagamento_insert_tenant
  on public.formas_pagamento for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy formas_pagamento_update_tenant
  on public.formas_pagamento for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy formas_pagamento_delete_tenant
  on public.formas_pagamento for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

create policy transacoes_select_tenant
  on public.transacoes for select to authenticated
  using (organizacao_id = public.current_organization_id());
create policy transacoes_insert_tenant
  on public.transacoes for insert to authenticated
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy transacoes_update_tenant
  on public.transacoes for update to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id))
  with check (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));
create policy transacoes_delete_tenant
  on public.transacoes for delete to authenticated
  using (organizacao_id = public.current_organization_id() and public.is_organization_editor(organizacao_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.organizacoes,
  public.perfis,
  public.membros_organizacao,
  public.categorias,
  public.contas,
  public.cartoes,
  public.formas_pagamento,
  public.transacoes
to authenticated;

grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_editor(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;

commit;
