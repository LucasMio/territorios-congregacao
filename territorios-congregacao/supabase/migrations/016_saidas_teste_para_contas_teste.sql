-- Saídas de teste (chave 'teste:...') também ficam visíveis para as contas TEMPORÁRIAS de teste
-- (telefone começando com 55999, números que não existem), para testar fluxos entre dois usuários
-- (ex.: um pede substituto, o outro assume) sem que nenhum irmão de verdade veja nada.
-- Compatível com o site oficial: para os irmãos, nada muda.

create or replace function public.eh_conta_teste() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and telefone like '55999%');
$$;
revoke all on function public.eh_conta_teste() from public, anon;
grant execute on function public.eh_conta_teste() to authenticated;

drop policy if exists "saidas: usuarios ativos veem" on public.saidas;
create policy "saidas: usuarios ativos veem" on public.saidas
  for select to authenticated
  using (public.eh_usuario_ativo() and (chave not like 'teste:%' or dirigente_id = auth.uid() or public.eh_conta_teste()));
