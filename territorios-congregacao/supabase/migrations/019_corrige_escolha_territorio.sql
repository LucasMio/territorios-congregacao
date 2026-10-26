-- Correção na escolha automática do território (planejar_saidas): o critério "começado há mais tempo"
-- valia para TODOS os territórios e não só para os em andamento. Assim, um território recém-concluído
-- (que tem marcações, mas zero quadras na volta nova) passava na frente dos nunca marcados no sistema.
-- Agora esse critério só desempata entre os que estão em andamento.

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

  select coalesce(array_agg(distinct territorio_numero), '{}') into usados
    from saidas
   where territorio_numero is not null and chave not like 'teste:%'
     and ((territorio_manual and data >= hoje_local()) or data = hoje_local());

  for s in
    select * from saidas
     where data >= hoje_local() and not territorio_manual and not sem_territorio and not escolha_do_dirigente
       and grupo is not null and chave not like 'teste:%'
       and not (data = hoje_local() and territorio_numero is not null)
     order by data, horario nulls last, grupo
  loop
    select t.numero into escolhido
      from territorios t
      left join progresso_territorios p on p.numero = t.numero
     where t.grupo = any (grupos_equivalentes(s.grupo)) and not (t.numero = any (usados))
     order by (coalesce(p.feitas_no_ciclo, 0) > 0) desc,
              case when coalesce(p.feitas_no_ciclo, 0) > 0 then p.ultima_marcacao end asc nulls last, -- só entre os em andamento
              t.ultima_data asc nulls first,
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
