alter table public.auditoria_operacoes
  add column if not exists usuario_nome text,
  add column if not exists descricao text;

create or replace function public.registrar_auditoria_operacao()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  current_row jsonb := coalesce(new_row, old_row);
  organization_id uuid := coalesce(nullif(current_row ->> 'organizacao_id', '')::uuid, public.current_organization_id());
  record_id text := coalesce(current_row ->> 'id', current_row ->> 'usuario_id', current_row ->> 'codigo_hash');
  action_name text;
  actor_name text;
  record_description text;
begin
  action_name := case
    when tg_op = 'INSERT' then 'criou'
    when tg_op = 'DELETE' then 'excluiu'
    when tg_table_name = 'transacoes' and old_row ->> 'esta_pago' = 'false' and new_row ->> 'esta_pago' = 'true' then 'baixou'
    when tg_table_name = 'transacoes' and old_row ->> 'esta_pago' = 'true' and new_row ->> 'esta_pago' = 'false' then 'estornou'
    else 'alterou'
  end;

  select coalesce(nullif(trim(nome_exibicao), ''), email)
    into actor_name
    from public.perfis
   where id = auth.uid();

  record_description := case tg_table_name
    when 'transacoes' then
      coalesce(current_row ->> 'descricao', 'Lançamento')
      || coalesce(' • Conta: ' || (select c.nome from public.contas c where c.id = nullif(current_row ->> 'conta_id', '')::uuid), '')
      || coalesce(' • Cartão: ' || (select c.nome from public.cartoes c where c.id = nullif(current_row ->> 'cartao_id', '')::uuid), '')
    when 'contas' then coalesce(current_row ->> 'nome', 'Conta')
    when 'cartoes' then coalesce(current_row ->> 'nome', 'Cartão')
    when 'categorias' then coalesce(current_row ->> 'nome', 'Categoria')
    when 'formas_pagamento' then coalesce(current_row ->> 'nome', 'Forma de pagamento')
    when 'contatos' then coalesce(current_row ->> 'nome', 'Contato')
    when 'membros_organizacao' then coalesce(current_row ->> 'usuario_id', 'Usuário')
    when 'convites_organizacao' then coalesce(current_row ->> 'email', 'Convite')
    when 'organizacoes' then coalesce(current_row ->> 'nome', 'Empresa')
    else tg_table_name
  end;

  insert into public.auditoria_operacoes (
    organizacao_id, usuario_id, usuario_nome, acao, entidade, entidade_id,
    tela, descricao, dados_anteriores, dados_novos
  ) values (
    organization_id, auth.uid(), actor_name, action_name, tg_table_name, record_id,
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
    record_description, old_row, new_row
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.list_audit_operations(
  p_inicio date default null,
  p_fim date default null,
  p_usuario_id uuid default null,
  p_acao text default null
)
returns table(
  id uuid,
  usuario_id uuid,
  usuario_nome text,
  acao text,
  tela text,
  descricao text,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    a.id,
    a.usuario_id,
    coalesce(nullif(a.usuario_nome, ''), nullif(p.nome_exibicao, ''), p.email, 'Sistema'),
    a.acao,
    a.tela,
    coalesce(
      nullif(a.descricao, ''),
      a.dados_novos ->> 'descricao',
      a.dados_novos ->> 'nome',
      a.dados_novos ->> 'email',
      a.dados_anteriores ->> 'descricao',
      a.dados_anteriores ->> 'nome',
      a.dados_anteriores ->> 'email',
      'Registro'
    ),
    a.criado_em
  from public.auditoria_operacoes a
  left join public.perfis p on p.id = a.usuario_id
  where a.organizacao_id = public.current_organization_id()
    and public.is_organization_admin(a.organizacao_id)
    and (p_inicio is null or a.criado_em >= p_inicio::timestamptz)
    and (p_fim is null or a.criado_em < (p_fim + 1)::timestamptz)
    and (p_usuario_id is null or a.usuario_id = p_usuario_id)
    and (nullif(trim(p_acao), '') is null or a.acao = p_acao)
  order by a.criado_em desc
  limit 500;
$$;

grant execute on function public.list_audit_operations(date, date, uuid, text) to authenticated;
