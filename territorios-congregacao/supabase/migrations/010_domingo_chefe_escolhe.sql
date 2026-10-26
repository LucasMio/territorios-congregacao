-- Domingos dos grupos: o chefe do grupo decide em quais territórios/quadras trabalhar.
-- Essas saídas não recebem território automático; o chefe (dirigente da saída) passa a ver e marcar
-- todos os territórios do grupo dele, de 7 dias antes do domingo até 7 dias depois.

alter table public.saidas add column if not exists escolha_do_dirigente boolean not null default false;

update public.saidas
   set escolha_do_dirigente = true,
       territorio_numero = case when territorio_manual then territorio_numero else null end,
       atualizado_em = now()
 where chave like 'domingo:%';

create or replace function public.pode_ver_territorio(n integer) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_admin()
      or (public.eh_usuario_ativo() and (
            -- território escolhido para uma saída dele
            exists (select 1 from saidas
                     where territorio_numero = n and dirigente_id = auth.uid() and data >= public.hoje_local() - 7)
            -- chefe de grupo no domingo: todos os territórios do grupo
         or exists (select 1 from saidas s join territorios t on t.numero = n
                     where s.escolha_do_dirigente and s.dirigente_id = auth.uid()
                       and s.data between public.hoje_local() - 7 and public.hoje_local() + 7
                       and t.grupo = any (public.grupos_equivalentes(s.grupo)))));
$$;

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
   where territorio_numero is not null
     and ((territorio_manual and data >= hoje_local()) or data = hoje_local());

  for s in
    select * from saidas
     where data >= hoje_local() and not territorio_manual and not sem_territorio and not escolha_do_dirigente
       and grupo is not null
       and not (data = hoje_local() and territorio_numero is not null)
     order by data, horario nulls last, grupo
  loop
    select t.numero into escolhido
      from territorios t
      left join progresso_territorios p on p.numero = t.numero
     where t.grupo = any (grupos_equivalentes(s.grupo)) and not (t.numero = any (usados))
     order by (coalesce(p.feitas_no_ciclo, 0) > 0) desc,
              p.ultima_marcacao asc nulls last,
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
