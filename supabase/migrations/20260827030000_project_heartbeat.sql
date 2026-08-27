-- Ponto de atividade usado pelo monitor gratuito do GitHub Actions.
-- Não contém dados de usuários e não concede acesso de leitura ao banco.
create table if not exists public.sistema_heartbeat (
  id boolean primary key default true check (id),
  ultima_atividade timestamptz not null default now()
);

insert into public.sistema_heartbeat (id)
values (true)
on conflict (id) do nothing;

alter table public.sistema_heartbeat enable row level security;

revoke all on public.sistema_heartbeat from anon, authenticated;

create or replace function public.keep_project_active()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_at timestamptz;
begin
  update public.sistema_heartbeat
     set ultima_atividade = now()
   where id = true
   returning ultima_atividade into activity_at;

  return activity_at;
end;
$$;

revoke all on function public.keep_project_active() from public, authenticated;
grant execute on function public.keep_project_active() to anon;
