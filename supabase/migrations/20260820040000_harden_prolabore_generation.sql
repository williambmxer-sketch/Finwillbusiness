-- A função é SECURITY DEFINER para conseguir criar a recorrência completa.
-- Por isso a permissão de edição precisa ser validada explicitamente no corpo.
begin;

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

grant execute on function public.generate_due_prolabore() to authenticated;

commit;
