// Situação de um território pelo tempo desde a última vez que foi trabalhado,
// seguindo a legenda da planilha: até 4 meses, mais de 4 e mais de 6 meses.

export const SITUACOES = {
  recente: { rotulo: 'Até 4 meses', classe: 'recente', icone: 'check' },
  atencao: { rotulo: 'Mais de 4 meses', classe: 'atencao', icone: 'relogio' },
  urgente: { rotulo: 'Mais de 6 meses', classe: 'urgente', icone: 'alerta' },
  sem_data: { rotulo: 'Sem registro', classe: 'sem-data', icone: 'info' },
};

/** Meses completos entre a data (AAAA-MM-DD) e hoje. */
export function mesesDesde(dataIso, hoje = new Date()) {
  if (!dataIso) return null;
  const [a, m, d] = dataIso.split('-').map(Number);
  let meses = (hoje.getFullYear() - a) * 12 + (hoje.getMonth() + 1 - m);
  if (hoje.getDate() < d) meses -= 1;
  return Math.max(0, meses);
}

export function situacaoDoTerritorio(ultimaData, hoje = new Date()) {
  const meses = mesesDesde(ultimaData, hoje);
  if (meses === null) return 'sem_data';
  if (meses >= 6) return 'urgente';
  if (meses >= 4) return 'atencao';
  return 'recente';
}

/** "2026-08-01" -> "01/08/2026" */
export function formatarData(dataIso) {
  if (!dataIso) return '—';
  const [a, m, d] = dataIso.split('-');
  return `${d}/${m}/${a}`;
}

/** Data de hoje no horário de Cuiabá (Cidade Exemplo, UTC-4), "AAAA-MM-DD". */
export function hojeLocal(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

/** Soma (ou subtrai) dias de uma data "AAAA-MM-DD". */
export function somarDias(dataIso, dias) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** "este mês", "há 1 mês", "há 5 meses" (ou null sem data). */
export function descreverTempo(dataIso, hoje = new Date()) {
  const meses = mesesDesde(dataIso, hoje);
  if (meses === null) return null;
  if (meses === 0) return 'este mês';
  return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}
