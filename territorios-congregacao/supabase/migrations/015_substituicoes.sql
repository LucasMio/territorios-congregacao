-- Substituição de dirigente (decisão do Ricardo, 21/10/2026): o dirigente pede um substituto pela
-- própria saída; os outros irmãos veem o pedido e um deles toca em "Eu assumo"; a saída passa para
-- quem assumiu (e o território vai junto) e o administrador vê a troca.
-- Só ACRESCENTA (tabela, coluna e funções novas). O lembrete do WhatsApp continua sendo trocado
-- pelo administrador no sistema de lembretes (npm run trocar) — a página mostra o comando pronto.

-- Nome como está na planilha (o sistema de lembretes troca pelo nome da planilha).
alter table public.saidas add column if not exists dirigente_planilha text;

create table if not exists public.pedidos_substituicao (
  id                 bigint generated always as identity primary key,
  saida_id           bigint not null references public.saidas (id) on delete cascade,
  pedido_por         uuid references public.perfis (id) on delete set null,
  pedido_por_nome    text,
  motivo             text,
  criado_em          timestamptz not null default now(),
  status             text not null default 'aberto' check (status in ('aberto', 'aceito', 'cancelado')),
  aceito_por         uuid references public.perfis (id) on delete set null,
  aceito_por_nome    text,
  aceito_em          timestamptz,
  trocado_no_whatsapp boolean not null default false
);
create unique index if not exists um_pedido_aberto_por_saida on public.pedidos_substituicao (saida_id) where status = 'aberto';

alter table public.pedidos_substituicao enable row level security;
drop policy if exists "pedidos: usuarios ativos veem" on public.pedidos_substituicao;
create policy "pedidos: usuarios ativos veem" on public.pedidos_substituicao
  for select to authenticated using (public.eh_usuario_ativo());
-- Gravar só pelas funções abaixo.

create or replace function public.pedir_substituicao(p_saida bigint, p_motivo text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  s saidas;
  pid bigint;
begin
  select * into s from saidas where id = p_saida;
  if s.id is null then raise exception 'Saída não encontrada.'; end if;
  if s.dirigente_id is distinct from auth.uid() or not public.eh_usuario_ativo() then
    raise exception 'Só o dirigente desta saída pode pedir substituto.';
  end if;
  if s.data < public.hoje_local() then raise exception 'Esta saída já passou.'; end if;
  if exists (select 1 from pedidos_substituicao where saida_id = s.id and status = 'aberto') then
    raise exception 'Já existe um pedido aberto para esta saída.';
  end if;
  insert into pedidos_substituicao (saida_id, pedido_por, pedido_por_nome, motivo)
  values (s.id, auth.uid(), (select nome from perfis where id = auth.uid()), nullif(trim(p_motivo), ''))
  returning id into pid;
  return pid;
end;
$$;

create or replace function public.cancelar_pedido_substituicao(p_pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  update pedidos_substituicao set status = 'cancelado'
   where id = p_pedido and status = 'aberto' and (pedido_por = auth.uid() or public.eh_admin());
  if not found then raise exception 'Pedido não encontrado ou já resolvido.'; end if;
end;
$$;

create or replace function public.assumir_saida(p_pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  ped pedidos_substituicao;
  s saidas;
  meu_nome text;
begin
  if not public.eh_usuario_ativo() then raise exception 'sem permissão'; end if;
  select * into ped from pedidos_substituicao where id = p_pedido for update;
  if ped.id is null or ped.status <> 'aberto' then raise exception 'Este pedido já foi resolvido.'; end if;
  if ped.pedido_por = auth.uid() then raise exception 'Você não pode assumir o seu próprio pedido.'; end if;
  select * into s from saidas where id = ped.saida_id;
  if s.data < public.hoje_local() then raise exception 'Esta saída já passou.'; end if;
  select nome into meu_nome from perfis where id = auth.uid();

  update saidas
     set dirigente_planilha = coalesce(dirigente_planilha, dirigente_nome),
         dirigente_id = auth.uid(), dirigente_nome = meu_nome, dirigente_manual = true, atualizado_em = now()
   where id = s.id;
  update pedidos_substituicao
     set status = 'aceito', aceito_por = auth.uid(), aceito_por_nome = meu_nome, aceito_em = now()
   where id = ped.id;
end;
$$;

create or replace function public.marcar_trocado_no_whatsapp(p_pedido bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só administradores.'; end if;
  update pedidos_substituicao set trocado_no_whatsapp = true where id = p_pedido and status = 'aceito';
end;
$$;

revoke all on function public.pedir_substituicao(bigint, text) from public, anon;
revoke all on function public.cancelar_pedido_substituicao(bigint) from public, anon;
revoke all on function public.assumir_saida(bigint) from public, anon;
revoke all on function public.marcar_trocado_no_whatsapp(bigint) from public, anon;
grant execute on function public.pedir_substituicao(bigint, text) to authenticated;
grant execute on function public.cancelar_pedido_substituicao(bigint) to authenticated;
grant execute on function public.assumir_saida(bigint) to authenticated;
grant execute on function public.marcar_trocado_no_whatsapp(bigint) to authenticated;
