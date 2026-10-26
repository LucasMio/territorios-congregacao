-- Progresso da congregação (contabilidade geral). Só leitura e só números agregados:
-- qualquer irmão ativo vê o total, sem ver os territórios que não são dele.
-- (Melhoria nova: só acrescenta uma função; não muda nada do que já existe.)

create or replace function public.progresso_congregacao() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoje date := public.hoje_local();
  r jsonb;
begin
  if not public.eh_usuario_ativo() then
    raise exception 'sem permissão';
  end if;

  with t as (
    select t.numero, coalesce(t.grupo, 'Sem grupo') as grupo, t.ultima_data,
           (t.contorno is not null) as desenhado,
           coalesce(p.total_quadras, 0) as quadras, coalesce(p.feitas_no_ciclo, 0) as feitas
      from territorios t
      left join progresso_territorios p on p.numero = t.numero
  ),
  -- Cada conclusão conhecida: as registradas pelo sistema + a última data vinda da planilha.
  concl as (
    select territorio_numero as numero, data from conclusoes
    union
    select numero, ultima_data from territorios where ultima_data is not null
  )
  select jsonb_build_object(
    'hoje', hoje,
    'total', (select count(*) from t),
    'desenhados', (select count(*) from t where desenhado),
    'quadras_total', (select coalesce(sum(quadras), 0) from t),
    'quadras_feitas', (select coalesce(sum(feitas), 0) from t),
    'em_andamento', (select count(*) from t where feitas > 0),
    'situacao', jsonb_build_object(
      'recente', (select count(*) from t where ultima_data > hoje - interval '4 months'),
      'atencao', (select count(*) from t where ultima_data <= hoje - interval '4 months' and ultima_data > hoje - interval '6 months'),
      'urgente', (select count(*) from t where ultima_data <= hoje - interval '6 months'),
      'sem_data', (select count(*) from t where ultima_data is null)),
    'por_grupo', (
      select coalesce(jsonb_agg(g order by g.grupo), '[]'::jsonb) from (
        select grupo,
               count(*) as territorios,
               count(*) filter (where ultima_data > hoje - interval '4 months') as recentes,
               coalesce(sum(quadras), 0) as quadras,
               coalesce(sum(feitas), 0) as feitas
          from t group by grupo) g),
    'por_mes', (
      select jsonb_agg(jsonb_build_object(
               'mes', to_char(m, 'YYYY-MM'),
               'concluidos', (select count(distinct numero) from concl where date_trunc('month', data) = m))
             order by m)
        from generate_series(date_trunc('month', hoje) - interval '11 months', date_trunc('month', hoje), interval '1 month') m)
  ) into r;
  return r;
end;
$$;

revoke all on function public.progresso_congregacao() from public, anon;
grant execute on function public.progresso_congregacao() to authenticated;
