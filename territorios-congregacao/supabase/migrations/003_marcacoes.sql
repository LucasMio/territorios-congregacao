-- Etapa 3: o dirigente marca as quadras trabalhadas.
--
-- Ciclo: um território começa um ciclo depois da última conclusão (territorios.ultima_data).
-- Uma quadra está "feita no ciclo" se tem marcação com data DEPOIS da última conclusão.
-- Quando todas as quadras estão feitas, o território é concluído automaticamente:
-- ultima_data passa a ser a data da última marcação e o ciclo recomeça.

create table if not exists public.marcacoes (
  id                 bigint generated always as identity primary key,
  quadra_id          bigint not null references public.quadras (id) on delete cascade,
  territorio_numero  integer not null references public.territorios (numero) on delete cascade,
  data               date not null default (now() at time zone 'America/Sao_Paulo')::date,
  dirigente_id       uuid not null references public.perfis (id) default auth.uid(),
  criada_em          timestamptz not null default now(),
  unique (quadra_id, data)
);
create index if not exists marcacoes_territorio_data on public.marcacoes (territorio_numero, data);

-- Histórico: cada vez que um território foi trabalhado por completo.
create table if not exists public.conclusoes (
  id                 bigint generated always as identity primary key,
  territorio_numero  integer not null references public.territorios (numero) on delete cascade,
  data               date not null,
  ciclo_iniciado_em  date,                      -- data da conclusão anterior (null = primeiro ciclo)
  criada_em          timestamptz not null default now()
);

alter table public.marcacoes enable row level security;
alter table public.conclusoes enable row level security;

create or replace function public.hoje_brasil() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

drop policy if exists "marcacoes: usuarios ativos veem" on public.marcacoes;
create policy "marcacoes: usuarios ativos veem" on public.marcacoes
  for select to authenticated using (public.eh_usuario_ativo());

-- Marcar: só em nome próprio, com data de hoje até 7 dias atrás.
drop policy if exists "marcacoes: dirigente marca" on public.marcacoes;
create policy "marcacoes: dirigente marca" on public.marcacoes
  for insert to authenticated
  with check (
    public.eh_usuario_ativo()
    and dirigente_id = auth.uid()
    and data between public.hoje_brasil() - 7 and public.hoje_brasil()
  );

-- Desmarcar: o próprio dirigente, no mesmo dia em que marcou; o administrador, sempre.
drop policy if exists "marcacoes: desmarcar" on public.marcacoes;
create policy "marcacoes: desmarcar" on public.marcacoes
  for delete to authenticated
  using (public.eh_admin() or (dirigente_id = auth.uid() and (criada_em at time zone 'America/Sao_Paulo')::date = public.hoje_brasil()));

drop policy if exists "conclusoes: usuarios ativos veem" on public.conclusoes;
create policy "conclusoes: usuarios ativos veem" on public.conclusoes
  for select to authenticated using (public.eh_usuario_ativo());

drop policy if exists "conclusoes: admin altera" on public.conclusoes;
create policy "conclusoes: admin altera" on public.conclusoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- A quadra precisa ser do território informado (o site manda os dois).
create or replace function public.conferir_marcacao() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from quadras where id = new.quadra_id and territorio_numero = new.territorio_numero) then
    raise exception 'A quadra % não pertence ao território %.', new.quadra_id, new.territorio_numero;
  end if;
  return new;
end;
$$;

drop trigger if exists conferir_marcacao on public.marcacoes;
create trigger conferir_marcacao before insert on public.marcacoes
  for each row execute function public.conferir_marcacao();

-- Depois de cada marcação: se todas as quadras do território estão feitas no ciclo, conclui.
create or replace function public.verificar_conclusao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inicio      date;
  total       integer;
  feitas      integer;
  data_final  date;
begin
  select ultima_data into inicio from territorios where numero = new.territorio_numero for update;
  select count(*) into total from quadras where territorio_numero = new.territorio_numero;
  select count(distinct quadra_id), max(data) into feitas, data_final
    from marcacoes
   where territorio_numero = new.territorio_numero
     and (inicio is null or data > inicio);
  if total > 0 and feitas >= total then
    update territorios set ultima_data = data_final, atualizado_em = now() where numero = new.territorio_numero;
    insert into conclusoes (territorio_numero, data, ciclo_iniciado_em) values (new.territorio_numero, data_final, inicio);
  end if;
  return new;
end;
$$;

drop trigger if exists verificar_conclusao on public.marcacoes;
create trigger verificar_conclusao after insert on public.marcacoes
  for each row execute function public.verificar_conclusao();

-- Progresso de cada território no ciclo atual (respeita as regras de acesso de quem consulta).
create or replace view public.progresso_territorios with (security_invoker = true) as
select
  t.numero,
  (select count(*) from quadras q where q.territorio_numero = t.numero)::int as total_quadras,
  (select count(distinct m.quadra_id) from marcacoes m
     where m.territorio_numero = t.numero and (t.ultima_data is null or m.data > t.ultima_data))::int as feitas_no_ciclo,
  (select max(m.data) from marcacoes m where m.territorio_numero = t.numero) as ultima_marcacao
from territorios t;

grant select on public.progresso_territorios to authenticated;
