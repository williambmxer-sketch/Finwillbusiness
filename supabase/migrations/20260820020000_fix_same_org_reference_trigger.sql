-- Corrige a função compartilhada pelos triggers de transações e formas de pagamento.
-- Em formas_pagamento o registro NEW não possui os campos exclusivos de transações,
-- portanto essas referências precisam ser avaliadas dentro de um bloco por tabela.
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
