-- Cidade Exemplo (MT) usa o horário de Cuiabá (UTC-4), uma hora atrás de Brasília.
-- "Hoje" (data padrão da marcação, limite de 7 dias e desmarcar no mesmo dia) passa a seguir Cuiabá.

create or replace function public.hoje_local() returns date
language sql stable as $$ select (now() at time zone 'America/Cuiaba')::date $$;

alter table public.marcacoes alter column data set default (now() at time zone 'America/Cuiaba')::date;

drop policy if exists "marcacoes: dirigente marca" on public.marcacoes;
create policy "marcacoes: dirigente marca" on public.marcacoes
  for insert to authenticated
  with check (
    public.eh_usuario_ativo()
    and dirigente_id = auth.uid()
    and data between public.hoje_local() - 7 and public.hoje_local()
  );

drop policy if exists "marcacoes: desmarcar" on public.marcacoes;
create policy "marcacoes: desmarcar" on public.marcacoes
  for delete to authenticated
  using (public.eh_admin() or (dirigente_id = auth.uid() and (criada_em at time zone 'America/Cuiaba')::date = public.hoje_local()));

drop function if exists public.hoje_brasil();
