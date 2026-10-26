-- Concluir um território à mão (administrador): para os territórios ainda sem mapa no sistema
-- ou trabalhados sem marcar as quadras. Faz o mesmo que a conclusão automática: registra a
-- conclusão (conta no placar da campanha), atualiza a última data e começa um ciclo novo.
-- Só ACRESCENTA (colunas e função novas).

alter table public.conclusoes add column if not exists manual boolean not null default false;
alter table public.conclusoes add column if not exists concluida_por_nome text;

create or replace function public.concluir_territorio(p_numero integer, p_data date) returns void
language plpgsql security definer set search_path = public as $$
declare
  t territorios;
begin
  if not public.eh_admin() then
    raise exception 'Só administradores podem concluir um território à mão.';
  end if;
  if p_data is null or p_data > public.hoje_local() then
    raise exception 'A data da conclusão não pode ser no futuro.';
  end if;
  select * into t from territorios where numero = p_numero for update;
  if t.numero is null then raise exception 'Território não encontrado.'; end if;

  insert into conclusoes (territorio_numero, data, ciclo_iniciado_em, ciclo, manual, concluida_por_nome)
  values (t.numero, p_data, t.ultima_data, t.ciclo_atual, true, (select nome from perfis where id = auth.uid()));

  update territorios
     set ultima_data = greatest(coalesce(ultima_data, p_data), p_data),
         ciclo_atual = ciclo_atual + 1,
         atualizado_em = now()
   where numero = t.numero;
end;
$$;

revoke all on function public.concluir_territorio(integer, date) from public, anon;
grant execute on function public.concluir_territorio(integer, date) to authenticated;
