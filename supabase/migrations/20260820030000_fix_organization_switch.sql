-- Evita colisão transitória no índice que garante uma única empresa padrão.
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

grant execute on function public.switch_organization(uuid) to authenticated;
