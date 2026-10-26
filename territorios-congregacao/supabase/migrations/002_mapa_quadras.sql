-- Etapa 2: posição, contorno e quadras de cada território.

alter table public.territorios
  add column if not exists lat double precision,       -- ponto do link do Google Maps (para abrir o mapa no lugar certo)
  add column if not exists lng double precision,
  add column if not exists contorno jsonb;             -- GeoJSON (Polygon/MultiPolygon) desenhado pelo administrador

create table if not exists public.quadras (
  id                 bigint generated always as identity primary key,
  territorio_numero  integer not null references public.territorios (numero) on delete cascade,
  numero             integer not null,                -- 1, 2, 3... dentro do território
  geometria          jsonb not null,                  -- GeoJSON Polygon/MultiPolygon
  area_m2            integer,
  criada_em          timestamptz not null default now(),
  unique (territorio_numero, numero)
);

alter table public.quadras enable row level security;

drop policy if exists "quadras: usuarios ativos veem" on public.quadras;
create policy "quadras: usuarios ativos veem" on public.quadras
  for select to authenticated using (public.eh_usuario_ativo());

drop policy if exists "quadras: admin altera" on public.quadras;
create policy "quadras: admin altera" on public.quadras
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Salva o contorno e TODAS as quadras de um território de uma vez (tudo ou nada).
-- quadras = [{ "numero": 1, "geometria": {...}, "area_m2": 1234 }, ...]
create or replace function public.salvar_mapa_territorio(p_numero integer, p_contorno jsonb, p_quadras jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  total integer;
begin
  if not public.eh_admin() then
    raise exception 'Somente administradores podem alterar o mapa.';
  end if;
  update territorios set contorno = p_contorno, atualizado_em = now() where numero = p_numero;
  if not found then
    raise exception 'Território % não existe.', p_numero;
  end if;
  delete from quadras where territorio_numero = p_numero;
  insert into quadras (territorio_numero, numero, geometria, area_m2)
    select p_numero, (q ->> 'numero')::int, q -> 'geometria', (q ->> 'area_m2')::int
    from jsonb_array_elements(coalesce(p_quadras, '[]'::jsonb)) as q;
  get diagnostics total = row_count;
  return total;
end;
$$;

revoke all on function public.salvar_mapa_territorio(integer, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_mapa_territorio(integer, jsonb, jsonb) to authenticated;
