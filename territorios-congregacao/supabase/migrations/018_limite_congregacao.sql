-- Limite geral da congregação no banco, para o administrador master ajustar no Mapa geral.
-- Começa com o traçado feito a partir da imagem da aba MAPA da planilha. Só acrescenta (tabela nova).

create table if not exists public.limite_congregacao (
  id              integer primary key default 1 check (id = 1),   -- uma linha só
  geometria       jsonb not null,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text
);

alter table public.limite_congregacao enable row level security;
drop policy if exists "limite: usuarios ativos veem" on public.limite_congregacao;
create policy "limite: usuarios ativos veem" on public.limite_congregacao
  for select to authenticated using (public.eh_usuario_ativo());

-- Só o administrador master grava (pela função abaixo, que confere).
create or replace function public.salvar_limite_congregacao(p_geometria jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_master() then
    raise exception 'Só o administrador master pode ajustar o limite da congregação.';
  end if;
  if p_geometria->>'type' not in ('Polygon', 'MultiPolygon') or jsonb_array_length(p_geometria->'coordinates'->0) < 4 then
    raise exception 'O limite precisa ser um contorno fechado com pelo menos 3 pontos.';
  end if;
  insert into limite_congregacao (id, geometria, atualizado_em, atualizado_por)
  values (1, p_geometria, now(), (select nome from perfis where id = auth.uid()))
  on conflict (id) do update set geometria = excluded.geometria, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
end;
$$;
revoke all on function public.salvar_limite_congregacao(jsonb) from public, anon;
grant execute on function public.salvar_limite_congregacao(jsonb) to authenticated;

-- (o limite da congregação é desenhado pelo administrador master em "Mapa geral > Ajustar o limite")
