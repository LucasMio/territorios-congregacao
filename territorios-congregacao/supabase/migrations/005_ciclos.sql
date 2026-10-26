-- Ciclos numerados. Antes o ciclo atual era "marcações com data depois da última conclusão",
-- o que impedia marcar no mesmo dia em que o território foi concluído. Agora cada território
-- tem um número de ciclo; cada marcação pertence ao ciclo em que foi feita; a conclusão
-- passa o território para o ciclo seguinte.

alter table public.territorios add column if not exists ciclo_atual integer not null default 1;
alter table public.marcacoes add column if not exists ciclo integer;
alter table public.conclusoes add column if not exists ciclo integer;

update public.marcacoes m set ciclo = t.ciclo_atual from public.territorios t where t.numero = m.territorio_numero and m.ciclo is null;
alter table public.marcacoes alter column ciclo set not null;

-- Uma quadra conta uma vez por ciclo (pode ser feita no mesmo dia em ciclos diferentes).
alter table public.marcacoes drop constraint if exists marcacoes_quadra_id_data_key;
alter table public.marcacoes drop constraint if exists marcacoes_quadra_ciclo_unico;
alter table public.marcacoes add constraint marcacoes_quadra_ciclo_unico unique (quadra_id, ciclo);

-- Antes de gravar: confere a quadra, guarda o nome de quem marcou e o ciclo atual do território.
create or replace function public.conferir_marcacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from quadras where id = new.quadra_id and territorio_numero = new.territorio_numero) then
    raise exception 'A quadra % não pertence ao território %.', new.quadra_id, new.territorio_numero;
  end if;
  new.dirigente_nome := (select nome from perfis where id = new.dirigente_id);
  new.ciclo := (select ciclo_atual from territorios where numero = new.territorio_numero);
  return new;
end;
$$;

-- Depois de cada marcação: se todas as quadras foram feitas neste ciclo, conclui e abre o próximo.
create or replace function public.verificar_conclusao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t           record;
  total       integer;
  feitas      integer;
  data_final  date;
begin
  select numero, ultima_data, ciclo_atual into t from territorios where numero = new.territorio_numero for update;
  select count(*) into total from quadras where territorio_numero = t.numero;
  select count(distinct quadra_id), max(data) into feitas, data_final
    from marcacoes where territorio_numero = t.numero and ciclo = t.ciclo_atual;
  if total > 0 and feitas >= total then
    update territorios
       set ultima_data = greatest(coalesce(ultima_data, data_final), data_final),
           ciclo_atual = ciclo_atual + 1,
           atualizado_em = now()
     where numero = t.numero;
    insert into conclusoes (territorio_numero, data, ciclo_iniciado_em, ciclo)
      values (t.numero, data_final, t.ultima_data, t.ciclo_atual);
  end if;
  return new;
end;
$$;

drop view if exists public.progresso_territorios;
create view public.progresso_territorios with (security_invoker = true) as
select
  t.numero,
  t.ciclo_atual,
  (select count(*) from quadras q where q.territorio_numero = t.numero)::int as total_quadras,
  (select count(distinct m.quadra_id) from marcacoes m
     where m.territorio_numero = t.numero and m.ciclo = t.ciclo_atual)::int as feitas_no_ciclo,
  (select max(m.data) from marcacoes m where m.territorio_numero = t.numero) as ultima_marcacao
from territorios t;

grant select on public.progresso_territorios to authenticated;
