-- Remove somente o acesso do usuário à organização.
-- O registro em auth.users é preservado para permitir novo convite ou cadastro próprio.
create or replace function public.remove_organization_member(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  active_organization_id uuid := public.current_organization_id();
  member_role text;
  member_email text;
begin
  if auth.uid() is null or not public.is_organization_admin(active_organization_id) then
    raise exception 'Somente administradores podem remover usuários.' using errcode = '42501';
  end if;

  if p_usuario_id = auth.uid() then
    raise exception 'Você não pode remover o próprio acesso.' using errcode = '42501';
  end if;

  select m.papel, lower(p.email)
    into member_role, member_email
    from public.membros_organizacao m
    left join public.perfis p on p.id = m.usuario_id
   where m.organizacao_id = active_organization_id
     and m.usuario_id = p_usuario_id;

  if member_role is null then
    raise exception 'Usuário não pertence à empresa.' using errcode = '22023';
  end if;

  if member_role = 'proprietario' then
    raise exception 'O proprietário principal não pode ser removido.' using errcode = '42501';
  end if;

  delete from public.membros_organizacao
   where organizacao_id = active_organization_id
     and usuario_id = p_usuario_id;

  if member_email is not null then
    delete from public.convites_organizacao
     where organizacao_id = active_organization_id
       and lower(email) = member_email
       and aceito_em is null;
  end if;

  -- Se o usuário ainda possuir outro tenant, garante um padrão ativo.
  if exists (
    select 1 from public.membros_organizacao
     where usuario_id = p_usuario_id and ativo = true
  ) then
    update public.membros_organizacao
       set padrao = false, atualizado_em = now()
     where usuario_id = p_usuario_id;

    update public.membros_organizacao
       set padrao = true, atualizado_em = now()
     where ctid = (
       select ctid
         from public.membros_organizacao
        where usuario_id = p_usuario_id and ativo = true
        order by padrao desc, criado_em asc
        limit 1
     );
  end if;
end;
$$;

grant execute on function public.remove_organization_member(uuid) to authenticated;
