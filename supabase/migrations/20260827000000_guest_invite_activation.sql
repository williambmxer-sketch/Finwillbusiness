-- Ativação de convidados no primeiro acesso.
-- Um usuário que chega com invite_code nunca recebe uma organização própria:
-- o trigger já o cria como membro do tenant que gerou o convite.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  invitation public.convites_organizacao%rowtype;
  new_organization_id uuid;
  display_name text;
  organization_name text;
  organization_slug text;
  invite_code text := nullif(btrim(new.raw_user_meta_data ->> 'invite_code'), '');
begin
  if invite_code is not null then
    select * into invitation
    from public.convites_organizacao
    where codigo_hash = encode(digest(upper(invite_code), 'sha256'), 'hex')
      and aceito_em is null
      and expira_em > now()
    for update;

    if invitation.id is null then
      raise exception 'Convite inválido ou expirado.' using errcode = '22023';
    end if;

    if lower(invitation.email) <> lower(coalesce(new.email, '')) then
      raise exception 'Este convite pertence a outro e-mail.' using errcode = '42501';
    end if;

    display_name := coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
      'Convidado'
    );

    insert into public.membros_organizacao (
      organizacao_id, usuario_id, papel, ativo, padrao, convidado_por
    ) values (
      invitation.organizacao_id, new.id, invitation.papel,
      true, true, invitation.convidado_por
    );

    insert into public.perfis (
      id, email, nome_exibicao, organizacao_padrao_id
    ) values (
      new.id, new.email, display_name, invitation.organizacao_id
    )
    on conflict (id) do update
      set email = excluded.email,
          nome_exibicao = excluded.nome_exibicao,
          organizacao_padrao_id = excluded.organizacao_padrao_id,
          atualizado_em = now();

    update public.convites_organizacao
      set aceito_em = now()
      where id = invitation.id;

    return new;
  end if;

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
    organizacao_id, usuario_id, papel, ativo, padrao
  ) values (
    new_organization_id, new.id, 'proprietario', true, true
  );

  insert into public.perfis (
    id, email, nome_exibicao, organizacao_padrao_id
  ) values (
    new.id, new.email, display_name, new_organization_id
  )
  on conflict (id) do update
    set email = excluded.email,
        nome_exibicao = excluded.nome_exibicao,
        organizacao_padrao_id = excluded.organizacao_padrao_id,
        atualizado_em = now();

  return new;
end;
$$;

-- O código é o segredo do convite. A consulta só retorna os dados de um
-- convite ainda válido e permite que a tela de login descubra o e-mail sem
-- pedir que o convidado se cadastre como proprietário.
create or replace function public.preview_organization_invite(p_codigo text)
returns table(email text, nome_organizacao text, papel text, expira_em timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select
    lower(c.email),
    o.nome,
    c.papel,
    c.expira_em
  from public.convites_organizacao c
  join public.organizacoes o on o.id = c.organizacao_id
  where c.codigo_hash = encode(digest(upper(btrim(p_codigo)), 'sha256'), 'hex')
    and c.aceito_em is null
    and c.expira_em > now()
  limit 1;
$$;

grant execute on function public.preview_organization_invite(text) to anon, authenticated;
