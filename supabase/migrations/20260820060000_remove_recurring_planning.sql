-- O planejamento recorrente não faz parte do escopo financeiro simplificado.
-- Remove os dados persistidos e a tabela exclusiva do recurso.
begin;

-- A função opcional de demonstração foi criada antes desta remoção e ainda
-- contém um insert na tabela. Reescreva-a sem esse bloco antes do DROP para
-- que o carregamento da demonstração continue funcionando.
do $migration$
declare
  function_definition text;
  insert_start integer;
  return_start integer;
  return_marker constant text := E'\n  return true;';
begin
  select pg_get_functiondef('public.ensure_business_demo_data()'::regprocedure)
    into function_definition;

  if function_definition is not null and position('itens_planejamento' in function_definition) > 0 then
    insert_start := position(E'\n  insert into public.itens_planejamento' in function_definition);
    return_start := position(return_marker in substring(function_definition from insert_start));

    if insert_start > 0 and return_start > 0 then
      return_start := insert_start + return_start - 1;
      function_definition := left(function_definition, insert_start - 1)
        || return_marker
        || substring(function_definition from return_start + length(return_marker));
    end if;

    if position('itens_planejamento' in function_definition) > 0 then
      raise exception 'Não foi possível remover a referência ao planejamento da função de demonstração.';
    end if;

    execute function_definition;
  end if;
end;
$migration$;

drop table if exists public.itens_planejamento cascade;

commit;
