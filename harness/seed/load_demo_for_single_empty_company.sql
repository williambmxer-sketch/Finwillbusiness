-- Carrega a demonstração apenas quando há exatamente uma empresa real vazia.
-- O usuário proprietário é descoberto no próprio banco; nenhuma conta é criada.
do $$
declare
  target_user uuid;
  target_email text;
  target_organization uuid;
  eligible_count integer;
  seeded boolean;
begin
  select count(*) into eligible_count
  from public.organizacoes o
  where not exists (select 1 from public.contas c where c.organizacao_id = o.id)
    and not exists (select 1 from public.categorias c where c.organizacao_id = o.id)
    and not exists (select 1 from public.transacoes t where t.organizacao_id = o.id)
    and exists (
      select 1
      from public.membros_organizacao m
      join auth.users u on u.id = m.usuario_id
      where m.organizacao_id = o.id and m.ativo and m.papel = 'proprietario'
    );

  if eligible_count <> 1 then
    raise exception 'Esperava exatamente uma empresa real vazia; encontrou %.', eligible_count;
  end if;

  select u.id, u.email, o.id
    into target_user, target_email, target_organization
  from public.organizacoes o
  join public.membros_organizacao m
    on m.organizacao_id = o.id and m.ativo and m.papel = 'proprietario'
  join auth.users u on u.id = m.usuario_id
  where not exists (select 1 from public.contas c where c.organizacao_id = o.id)
    and not exists (select 1 from public.categorias c where c.organizacao_id = o.id)
    and not exists (select 1 from public.transacoes t where t.organizacao_id = o.id)
  limit 1;

  perform set_config('request.jwt.claim.sub', target_user::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', target_user, 'email', target_email, 'role', 'authenticated'
  )::text, true);

  if public.current_organization_id() is distinct from target_organization then
    perform public.switch_organization(target_organization);
  end if;

  seeded := public.ensure_business_demo_data();
  if not seeded then
    raise exception 'A demonstração não foi aplicada.';
  end if;
end;
$$;

select
  (select count(*) from public.categorias) as categorias,
  (select count(*) from public.contas) as contas,
  (select count(*) from public.cartoes) as cartoes,
  (select count(*) from public.contatos) as contatos,
  (select count(*) from public.transacoes) as transacoes,
  (select count(*) from public.transacoes where not esta_pago) as pendentes,
  (select count(*) from public.transacoes where natureza = 'pro_labore') as prolabores,
  (select count(*) from public.itens_planejamento) as planejamentos,
  (select coalesce(sum(saldo), 0) from public.contas) as caixa_total;
