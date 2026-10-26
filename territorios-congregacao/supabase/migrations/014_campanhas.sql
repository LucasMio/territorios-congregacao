-- Mês de campanha (decisão do Ricardo, 21/10/2026): o administrador marca início e fim. Ao INICIAR
-- (só quando um administrador clica), todos os territórios começam um ciclo novo — quadras zeradas,
-- histórico mantido. Um placar mostra o que a congregação concluiu na campanha. Ao encerrar,
-- tudo segue normal (os ciclos continuam de onde estão).
-- Esta migração só ACRESCENTA tabelas e funções; nada muda até alguém iniciar uma campanha.

create table if not exists public.campanhas (
  id                bigint generated always as identity primary key,
  nome              text not null,
  inicio            date not null,
  fim               date not null,
  meta_territorios  integer,
  criada_por        uuid references public.perfis (id) on delete set null default auth.uid(),
  criada_em         timestamptz not null default now(),
  encerrada_em      timestamptz
);

-- Ciclo em que cada território entrou na campanha (o que vem a partir dele conta para o placar).
create table if not exists public.campanha_territorios (
  campanha_id        bigint not null references public.campanhas (id) on delete cascade,
  territorio_numero  integer not null references public.territorios (numero) on delete cascade,
  ciclo_inicio       integer not null,
  primary key (campanha_id, territorio_numero)
);

alter table public.campanhas enable row level security;
alter table public.campanha_territorios enable row level security;

drop policy if exists "campanhas: usuarios ativos veem" on public.campanhas;
create policy "campanhas: usuarios ativos veem" on public.campanhas
  for select to authenticated using (public.eh_usuario_ativo());
-- Criar/encerrar só pelas funções abaixo (que conferem se é administrador).

create or replace function public.iniciar_campanha(p_nome text, p_fim date, p_meta integer default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  cid bigint;
begin
  if not public.eh_admin() then
    raise exception 'Só administradores podem iniciar uma campanha.';
  end if;
  if exists (select 1 from campanhas where encerrada_em is null) then
    raise exception 'Já existe uma campanha em andamento. Encerre-a antes de começar outra.';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Dê um nome para a campanha.';
  end if;
  if p_fim is null or p_fim < public.hoje_local() then
    raise exception 'A data de fim precisa ser hoje ou depois.';
  end if;

  insert into campanhas (nome, inicio, fim, meta_territorios)
  values (trim(p_nome), public.hoje_local(), p_fim, p_meta)
  returning id into cid;

  -- O "reset": cada território começa um ciclo novo. As marcações antigas ficam no histórico.
  update territorios set ciclo_atual = ciclo_atual + 1, atualizado_em = now() where true;
  insert into campanha_territorios (campanha_id, territorio_numero, ciclo_inicio)
  select cid, numero, ciclo_atual from territorios;

  return cid;
end;
$$;

create or replace function public.encerrar_campanha() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    raise exception 'Só administradores podem encerrar a campanha.';
  end if;
  update campanhas set encerrada_em = now(), fim = least(fim, public.hoje_local())
   where encerrada_em is null;
end;
$$;

-- Placar da campanha em andamento (ou da última, se não houver nenhuma em andamento).
-- Números agregados para todos; a lista de territórios concluídos só para administradores.
create or replace function public.placar_campanha() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c campanhas;
  r jsonb;
begin
  if not public.eh_usuario_ativo() then
    raise exception 'sem permissão';
  end if;
  select * into c from campanhas order by (encerrada_em is null) desc, inicio desc, id desc limit 1;
  if c.id is null then
    return null;
  end if;

  with ct as (
    select ct.territorio_numero as numero, ct.ciclo_inicio, coalesce(t.grupo, 'Sem grupo') as grupo, t.bairro,
           (select count(*) from quadras q where q.territorio_numero = t.numero) as quadras
      from campanha_territorios ct join territorios t on t.numero = ct.territorio_numero
     where ct.campanha_id = c.id
  ),
  concl as (
    select ct.numero, min(co.data) as data
      from ct join conclusoes co on co.territorio_numero = ct.numero
     where co.ciclo >= ct.ciclo_inicio and co.data between c.inicio and c.fim
     group by ct.numero
  ),
  feitas as (
    select ct.numero, count(*) as quadras
      from ct join marcacoes m on m.territorio_numero = ct.numero
     where m.ciclo >= ct.ciclo_inicio and m.data between c.inicio and c.fim
     group by ct.numero
  )
  select jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'inicio', c.inicio, 'fim', c.fim, 'meta', c.meta_territorios,
    'encerrada', c.encerrada_em is not null,
    'hoje', public.hoje_local(),
    'territorios', (select count(*) from ct),
    'sem_mapa', (select count(*) from ct where quadras = 0),
    'concluidos', (select count(*) from concl),
    'em_andamento', (select count(*) from feitas f where not exists (select 1 from concl where concl.numero = f.numero)),
    'quadras_total', (select coalesce(sum(quadras), 0) from ct),
    'quadras_feitas', (select coalesce(sum(quadras), 0) from feitas),
    'por_grupo', (
      select coalesce(jsonb_agg(g order by g.grupo), '[]'::jsonb) from (
        select ct.grupo, count(*) as territorios, count(concl.numero) as concluidos,
               coalesce(sum(ct.quadras), 0) as quadras_total, coalesce(sum(f.quadras), 0) as quadras_feitas
          from ct left join concl on concl.numero = ct.numero left join feitas f on f.numero = ct.numero
         group by ct.grupo) g),
    'lista', case when public.eh_admin() then (
      select coalesce(jsonb_agg(jsonb_build_object('numero', concl.numero, 'bairro', ct.bairro, 'data', concl.data) order by concl.data, concl.numero), '[]'::jsonb)
        from concl join ct on ct.numero = concl.numero) end
  ) into r;
  return r;
end;
$$;

revoke all on function public.iniciar_campanha(text, date, integer) from public, anon;
revoke all on function public.encerrar_campanha() from public, anon;
revoke all on function public.placar_campanha() from public, anon;
grant execute on function public.iniciar_campanha(text, date, integer) to authenticated;
grant execute on function public.encerrar_campanha() to authenticated;
grant execute on function public.placar_campanha() to authenticated;
