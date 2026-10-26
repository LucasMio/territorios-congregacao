// Lógica do registro de designação de territórios (S-13), separada da tela para poder ser testada.

/** Ano de serviço que contém a data: 2027 = 01/09/2026 a 31/08/2027. */
export function anoDeServico(iso) {
  const [a, m] = iso.split('-').map(Number);
  return m >= 9 ? a + 1 : a;
}
export const limitesDoAno = (ano) => ({ inicio: `${ano - 1}-09-01`, fim: `${ano}-08-31` });

/**
 * Junta as saídas e as conclusões de um território em "designações" (voltas):
 * as saídas até cada conclusão formam uma volta concluída; as que sobram, a volta em andamento.
 */
export function montarDesignacoes(saidas, conclusoes) {
  const s = [...saidas].sort((a, b) => a.data.localeCompare(b.data));
  const c = [...conclusoes].sort((a, b) => a.localeCompare(b));
  const voltas = [];
  let i = 0;
  for (const data of c) {
    const grupo = [];
    while (i < s.length && s[i].data <= data) grupo.push(s[i++]);
    voltas.push({ desde: grupo[0]?.data ?? null, nomes: [...new Set(grupo.map((x) => x.nome))], concluido: data });
  }
  if (i < s.length) {
    const resto = s.slice(i);
    voltas.push({ desde: resto[0].data, nomes: [...new Set(resto.map((x) => x.nome))], concluido: null });
  }
  return voltas;
}
