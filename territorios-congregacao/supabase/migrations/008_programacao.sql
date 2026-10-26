-- Programação de campo: os territórios são designados para as SAÍDAS (dias), não para os dirigentes.
-- Cada saída tem data, horário, local, dirigente (vem da planilha mensal) e um território, escolhido
-- automaticamente pelo grupo do dia: primeiro o que está em andamento (faltam quadras), depois o que
-- está há mais tempo sem ser concluído. O administrador pode trocar o território ou o dirigente.
-- O dirigente vê o território das saídas dele (de 7 dias atrás em diante).

create table if not exists public.saidas (
  id                 bigint generated always as identity primary key,
  chave              text not null unique,       -- 'planilha:2026-11-04 18:00' ou 'domingo:2026-11-08:Tiago'
  data               date not null,
  horario            text,
  local              text,
  grupo              text,                       -- grupo de territórios do dia; null = sem regra (escolha manual)
  sem_territorio     boolean not null default false,  -- ex.: quartas de cartas
  dirigente_nome     text,
  dirigente_id       uuid references public.perfis (id) on delete set null,
  dirigente_manual   boolean not null default false,  -- trocado no site: a planilha não sobrescreve
  territorio_numero  integer references public.territorios (numero) on delete set null,
  territorio_manual  boolean not null default false,  -- escolhido pelo administrador (ou pela observação da planilha)
  observacao         text,
  atualizado_em      timestamptz not null default now()
);
create index if not exists saidas_data on public.saidas (data);
create index if not exists saidas_dirigente on public.saidas (dirigente_id, data);
create index if not exists saidas_territorio on public.saidas (territorio_numero, data);

alter table public.saidas enable row level security;

drop policy if exists "saidas: usuarios ativos veem" on public.saidas;
create policy "saidas: usuarios ativos veem" on public.saidas
  for select to authenticated using (public.eh_usuario_ativo());

drop policy if exists "saidas: admin altera" on public.saidas;
create policy "saidas: admin altera" on public.saidas
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Quem vê o território: administrador, ou o dirigente de uma saída com ele (de 7 dias atrás em diante,
-- para ainda poder marcar quadras que esqueceu).
create or replace function public.pode_ver_territorio(n integer) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin()
      or (public.eh_usuario_ativo() and exists (
            select 1 from saidas
             where territorio_numero = n and dirigente_id = auth.uid() and data >= public.hoje_local() - 7));
$$;

-- A designação por dirigente (modelo anterior) deixa de existir.
drop table if exists public.designacoes;

-- Escolhe o território das próximas saídas. Não mexe em saídas passadas, nas escolhidas à mão,
-- nem na de hoje que já tem território (o dirigente pode estar no campo).
create or replace function public.planejar_saidas() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s          record;
  escolhido  integer;
  usados     integer[];
  mudancas   integer := 0;
begin
  if auth.uid() is not null and not public.eh_usuario_ativo() then
    raise exception 'sem permissão';
  end if;

  -- Já reservados: escolhidos à mão em saídas futuras e os das saídas de hoje.
  select coalesce(array_agg(distinct territorio_numero), '{}') into usados
    from saidas
   where territorio_numero is not null
     and ((territorio_manual and data >= hoje_local()) or data = hoje_local());

  for s in
    select * from saidas
     where data >= hoje_local() and not territorio_manual and not sem_territorio and grupo is not null
       and not (data = hoje_local() and territorio_numero is not null)
     order by data, horario nulls last, grupo
  loop
    select t.numero into escolhido
      from territorios t
      left join progresso_territorios p on p.numero = t.numero
     where t.grupo = s.grupo and not (t.numero = any (usados))
     order by (coalesce(p.feitas_no_ciclo, 0) > 0) desc,   -- em andamento (faltam quadras) primeiro
              p.ultima_marcacao asc nulls last,            -- entre esses, o começado há mais tempo
              t.ultima_data asc nulls first,               -- depois, o mais tempo sem concluir
              t.numero
     limit 1;

    if escolhido is distinct from s.territorio_numero then
      update saidas set territorio_numero = escolhido, atualizado_em = now() where id = s.id;
      mudancas := mudancas + 1;
    end if;
    if escolhido is not null then
      usados := usados || escolhido;
    end if;
  end loop;
  return mudancas;
end;
$$;

revoke all on function public.planejar_saidas() from public, anon;
grant execute on function public.planejar_saidas() to authenticated;
