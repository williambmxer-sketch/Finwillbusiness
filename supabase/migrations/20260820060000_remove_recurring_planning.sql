-- O planejamento recorrente não faz parte do escopo financeiro simplificado.
-- Remove os dados persistidos e a tabela exclusiva do recurso.
begin;

-- A função opcional de demonstração foi criada antes desta remoção e ainda
-- contém um insert na tabela. Reescreva-a sem esse bloco antes do DROP para
-- que o carregamento da demonstração continue funcionando.
do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.ensure_business_demo_data()'::regprocedure)
    into function_definition;

  if function_definition is not null and position('itens_planejamento' in function_definition) > 0 then
    function_definition := regexp_replace(
      function_definition,
      $pattern$\n  insert into public\.itens_planejamento \((?s:.*?)\n  return true;$pattern$,
      E'\n  return true;',
      'n'
    );

    if position('itens_planejamento' in function_definition) > 0 then
      raise exception 'Não foi possível remover a referência ao planejamento da função de demonstração.';
    end if;

    execute function_definition;
  end if;
end;
$migration$;

drop table if exists public.itens_planejamento cascade;

commit;
