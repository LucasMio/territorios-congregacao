-- Etapa 1: usuários (perfis) e territórios, com regras de acesso (RLS).
-- Quem pode o quê:
--   administrador: vê e altera tudo;
--   dirigente:     vê os territórios (marcar quadras vem na etapa 3);
--   ninguém sem login vê nada.

-- Recursos de mapa (contornos e quadras), usados a partir da etapa 2.
create extension if not exists postgis with schema extensions;

-- Perfil de cada irmão que entra no sistema (o login em si fica em auth.users).
create table if not exists public.perfis (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nome                  text not null,
  telefone              text not null unique,          -- só dígitos, com 55 + DDD
  papel                 text not null default 'dirigente' check (papel in ('admin', 'dirigente')),
  ativo                 boolean not null default true,
  precisa_trocar_senha  boolean not null default true,  -- primeiro acesso: troca o código pela senha dele
  criado_em             timestamptz not null default now()
);

create table if not exists public.territorios (
  numero            integer primary key,
  bairro            text not null,
  grupo             text,                -- grupo / ponto de saída responsável
  ultima_data       date,                -- última vez que foi trabalhado por completo
  link_imagem       text,
  link_mapa         text,
  link_localizacao  text,
  observacoes       text,
  atualizado_em     timestamptz not null default now()
);

-- Funções auxiliares usadas nas regras. "security definer" para poderem ler perfis
-- sem cair nas próprias regras da tabela.
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin' and ativo);
$$;

create or replace function public.eh_usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo);
$$;

-- Depois de trocar a senha no primeiro acesso, o próprio irmão marca que já trocou.
create or replace function public.marcar_senha_trocada() returns void
language sql security definer set search_path = public as $$
  update perfis set precisa_trocar_senha = false where id = auth.uid();
$$;

revoke all on function public.eh_admin() from public, anon;
revoke all on function public.eh_usuario_ativo() from public, anon;
revoke all on function public.marcar_senha_trocada() from public, anon;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.eh_usuario_ativo() to authenticated;
grant execute on function public.marcar_senha_trocada() to authenticated;

-- Regras de acesso
alter table public.perfis enable row level security;
alter table public.territorios enable row level security;

drop policy if exists "perfis: ver o proprio ou admin ve todos" on public.perfis;
create policy "perfis: ver o proprio ou admin ve todos" on public.perfis
  for select to authenticated using (id = auth.uid() or public.eh_admin());

drop policy if exists "perfis: admin altera" on public.perfis;
create policy "perfis: admin altera" on public.perfis
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "territorios: usuarios ativos veem" on public.territorios;
create policy "territorios: usuarios ativos veem" on public.territorios
  for select to authenticated using (public.eh_usuario_ativo());

drop policy if exists "territorios: admin altera" on public.territorios;
create policy "territorios: admin altera" on public.territorios
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
