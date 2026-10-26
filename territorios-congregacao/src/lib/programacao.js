// Regras de distribuição dos dias de campo (combinadas com a congregação):
//   Segunda (toda):              Casa do Osvaldo
//   Quarta (1ª e 2ª do mês):     Salão do Reino
//   Quarta (3ª em diante):       cartas no salão — sem território
//   Sábado (todo):               Congregação
//   Domingo (1º do mês):         Congregação
//   Domingo (os demais):         uma saída para cada chefe de grupo, com território do grupo dele

export const CHEFES_DE_GRUPO = [
  { grupo: 'Lopes', nome: 'Márcio Lopes' },
  { grupo: 'Tiago', nome: 'Tiago Ramos' },
  { grupo: 'Samuel', nome: 'Samuel Rocha', territorios: 'Casa do Osvaldo' }, // o grupo do Samuel é o da Casa do Osvaldo
];
export const HORARIO_DOMINGO_GRUPOS = '08:30';

// Antes havia territórios marcados "Samuel"; foram unificados em "Casa do Osvaldo".
// Os dois nomes continuam valendo como o mesmo grupo (também no banco: grupos_equivalentes).
export const gruposEquivalentes = (g) => (['Samuel', 'Casa do Osvaldo'].includes(g) ? ['Casa do Osvaldo'] : [g]);

export const REGRAS_TEXTO = [
  'Segunda: Casa do Osvaldo',
  'Quarta (1ª e 2ª do mês): Salão do Reino',
  'Quarta (3ª em diante): cartas, sem território',
  'Sábado: Congregação',
  'Domingo (1º do mês): Congregação',
  `Demais domingos: uma saída por chefe de grupo (${CHEFES_DE_GRUPO.map((c) => c.nome).join(', ')}); o próprio chefe decide os territórios e quadras do grupo dele`,
  'O domingo do Samuel usa os territórios da Casa do Osvaldo',
];

const partes = (dataIso) => dataIso.split('-').map(Number);
/** 0 = domingo … 6 = sábado */
export const diaDaSemana = (dataIso) => {
  const [a, m, d] = partes(dataIso);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
};
/** 1 = primeira vez que esse dia da semana aparece no mês, 2 = segunda… */
export const ocorrenciaNoMes = (dataIso) => Math.ceil(partes(dataIso)[2] / 7);

/**
 * Grupo de territórios de uma saída da planilha.
 * @returns {{ grupo: string|null, semTerritorio: boolean }}
 */
export function grupoDoDia(dataIso, local = '') {
  if (/carta/i.test(local ?? '')) return { grupo: null, semTerritorio: true };
  const dia = diaDaSemana(dataIso);
  const n = ocorrenciaNoMes(dataIso);
  if (dia === 1) return { grupo: 'Casa do Osvaldo', semTerritorio: false };
  if (dia === 3) return n <= 2 ? { grupo: 'Salão do Reino', semTerritorio: false } : { grupo: null, semTerritorio: true };
  if (dia === 6) return { grupo: 'Congregação', semTerritorio: false };
  if (dia === 0 && n === 1) return { grupo: 'Congregação', semTerritorio: false };
  return { grupo: null, semTerritorio: false }; // sem regra: o administrador escolhe
}

/** "Campanha — território n63" -> 63 */
export function territorioDaObservacao(texto) {
  const m = String(texto ?? '').match(/territ[óo]rio\s*(?:n[ºo°.]?\s*)?(\d{1,3})/i);
  return m ? Number(m[1]) : null;
}

/** Domingos (exceto o primeiro) dos meses informados ("AAAA-MM"). */
export function domingosDosGrupos(meses) {
  const datas = [];
  for (const mes of meses) {
    const [a, m] = mes.split('-').map(Number);
    const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
    for (let d = 1; d <= dias; d++) {
      const iso = `${mes}-${String(d).padStart(2, '0')}`;
      if (diaDaSemana(iso) === 0 && ocorrenciaNoMes(iso) > 1) datas.push(iso);
    }
  }
  return datas;
}
