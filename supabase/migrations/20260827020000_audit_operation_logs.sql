-- Auditoria central das operações do sistema.
create table if not exists public.auditoria_operacoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid references public.organizacoes(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  tela text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists auditoria_operacoes_organizacao_data_idx
  on public.auditoria_operacoes (organizacao_id, criado_em desc);

alter table public.auditoria_operacoes enable row level security;

create policy auditoria_select_admin
  on public.auditoria_operacoes for select to authenticated
  using (organizacao_id is not null and public.is_organization_admin(organizacao_id));

create or replace function public.registrar_auditoria_operacao()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  organization_id uuid := coalesce(
    nullif(coalesce(new_row, old_row) ->> 'organizacao_id', '')::uuid,
    public.current_organization_id()
  );
  record_id text := coalesce(
    coalesce(new_row, old_row) ->> 'id',
    coalesce(new_row, old_row) ->> 'usuario_id',
    coalesce(new_row, old_row) ->> 'codigo_hash'
  );
  action_name text;
begin
  action_name := case
    when tg_op = 'INSERT' then 'criou'
    when tg_op = 'DELETE' then 'excluiu'
    when tg_table_name = 'transacoes'
      and old_row ->> 'esta_pago' = 'false'
      and new_row ->> 'esta_pago' = 'true' then 'baixou'
    when tg_table_name = 'transacoes'
      and old_row ->> 'esta_pago' = 'true'
      and new_row ->> 'esta_pago' = 'false' then 'estornou'
    else 'alterou'
  end;

  insert into public.auditoria_operacoes (
    organizacao_id, usuario_id, acao, entidade, entidade_id, tela,
    dados_anteriores, dados_novos
  ) values (
    organization_id, auth.uid(), action_name, tg_table_name, record_id,
    case tg_table_name
      when 'transacoes' then 'Lançamentos'
      when 'contas' then 'Contas'
      when 'cartoes' then 'Cartões'
      when 'categorias' then 'Categorias'
      when 'formas_pagamento' then 'Formas de pagamento'
      when 'contatos' then 'Contatos'
      when 'membros_organizacao' then 'Empresa e usuários'
      when 'convites_organizacao' then 'Convites'
      when 'organizacoes' then 'Empresa'
      else tg_table_name
    end,
    old_row, new_row
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'transacoes', 'contas', 'cartoes', 'categorias', 'formas_pagamento',
    'contatos', 'membros_organizacao', 'convites_organizacao', 'organizacoes'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'auditoria_' || table_name, table_name);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.registrar_auditoria_operacao()', 'auditoria_' || table_name, table_name);
  end loop;
end;
$$;

grant select on public.auditoria_operacoes to authenticated;
