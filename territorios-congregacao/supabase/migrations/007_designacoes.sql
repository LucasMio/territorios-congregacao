-- Designação de territórios: o dirigente só vê (e marca) os territórios designados a ele.
-- O administrador continua vendo tudo e é quem designa ou tira a designação.

create table if not exists public.designacoes (
  territorio_numero  integer not null references public.territorios (numero) on delete cascade,
  dirigente_id       uuid not null references public.perfis (id) on delete cascade,
  designado_em       date not null default public.hoje_local(),
  primary key (territorio_numero, dirigente_id)
);
create index if not exists designacoes_dirigente on public.designacoes (dirigente_id);

-- true se quem está logado pode ver o território: administrador, ou dirigente ativo com a designação.
create or replace function public.pode_ver_territorio(n integer) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin()
      or (public.eh_usuario_ativo() and exists (select 1 from designacoes where territorio_numero = n and dirigente_id = auth.uid()));
$$;
revoke all on function public.pode_ver_territorio(integer) from public, anon;
grant execute on function public.pode_ver_territorio(integer) to authenticated;

alter table public.designacoes enable row level security;

drop policy if exists "designacoes: ver as proprias ou admin" on public.designacoes;
create policy "designacoes: ver as proprias ou admin" on public.designacoes
  for select to authenticated using (public.eh_admin() or (dirigente_id = auth.uid() and public.eh_usuario_ativo()));

drop policy if exists "designacoes: admin altera" on public.designacoes;
create policy "designacoes: admin altera" on public.designacoes
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Territórios, quadras, marcações e conclusões: só o que a pessoa pode ver.
drop policy if exists "territorios: usuarios ativos veem" on public.territorios;
drop policy if exists "territorios: designados veem" on public.territorios;
create policy "territorios: designados veem" on public.territorios
  for select to authenticated using (public.pode_ver_territorio(numero));

drop policy if exists "quadras: usuarios ativos veem" on public.quadras;
drop policy if exists "quadras: designados veem" on public.quadras;
create policy "quadras: designados veem" on public.quadras
  for select to authenticated using (public.pode_ver_territorio(territorio_numero));

drop policy if exists "marcacoes: usuarios ativos veem" on public.marcacoes;
drop policy if exists "marcacoes: designados veem" on public.marcacoes;
create policy "marcacoes: designados veem" on public.marcacoes
  for select to authenticated using (public.pode_ver_territorio(territorio_numero));

drop policy if exists "conclusoes: usuarios ativos veem" on public.conclusoes;
drop policy if exists "conclusoes: designados veem" on public.conclusoes;
create policy "conclusoes: designados veem" on public.conclusoes
  for select to authenticated using (public.pode_ver_territorio(territorio_numero));

-- Marcar: além das regras anteriores, só em território designado (ou administrador).
drop policy if exists "marcacoes: dirigente marca" on public.marcacoes;
create policy "marcacoes: dirigente marca" on public.marcacoes
  for insert to authenticated
  with check (
    public.eh_usuario_ativo()
    and public.pode_ver_territorio(territorio_numero)
    and dirigente_id = auth.uid()
    and data between public.hoje_local() - 7 and public.hoje_local()
  );
