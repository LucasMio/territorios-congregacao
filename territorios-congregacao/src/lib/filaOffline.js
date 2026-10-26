// Marcação sem internet: quando o sinal cai no campo, a marcação fica guardada no celular
// (localStorage) e é enviada sozinha quando a internet volta.

const CHAVE = 'territorios:fila-marcacoes';

/** Erro de rede (sem sinal), e não um erro de regra do banco. */
export function ehErroDeRede(erro) {
  return Boolean(erro) && /failed to fetch|fetch failed|networkerror|network request failed|load failed|internet/i.test(erro.message ?? String(erro));
}

export function lerFila(armazem = globalThis.localStorage) {
  try {
    return JSON.parse(armazem?.getItem(CHAVE) ?? '[]');
  } catch {
    return [];
  }
}

function gravar(fila, armazem) {
  try {
    armazem?.setItem(CHAVE, JSON.stringify(fila));
  } catch {
    // armazenamento cheio ou bloqueado: nada a fazer
  }
  globalThis.dispatchEvent?.(new Event('fila-marcacoes'));
}

/** Guarda uma marcação para enviar depois. Não duplica a mesma quadra/usuário. */
export function guardarNaFila(item, armazem = globalThis.localStorage) {
  const fila = lerFila(armazem).filter((x) => !(x.quadra_id === item.quadra_id && x.usuario === item.usuario));
  fila.push({ ...item, guardada_em: new Date().toISOString() });
  gravar(fila, armazem);
}

export function tirarDaFila(quadraId, usuario, armazem = globalThis.localStorage) {
  gravar(lerFila(armazem).filter((x) => !(x.quadra_id === quadraId && x.usuario === usuario)), armazem);
}

/**
 * Envia as marcações guardadas deste usuário. Já marcadas por outro (repetida) saem da fila;
 * as recusadas por regra (ex.: mais de 7 dias) saem da fila e voltam como "recusadas" para avisar.
 * Se ainda não houver internet, ficam para a próxima tentativa.
 * @returns {Promise<{enviadas: object[], recusadas: {item: object, motivo: string}[], semRede: boolean}>}
 */
export async function enviarFila(supabase, usuario, armazem = globalThis.localStorage) {
  const resultado = { enviadas: [], recusadas: [], semRede: false };
  for (const item of lerFila(armazem).filter((x) => x.usuario === usuario)) {
    const { error } = await supabase.from('marcacoes').insert({ quadra_id: item.quadra_id, territorio_numero: item.territorio_numero, data: item.data });
    if (error && ehErroDeRede(error)) {
      resultado.semRede = true;
      break;
    }
    tirarDaFila(item.quadra_id, usuario, armazem);
    if (!error || /duplicate|unique|marcacoes_quadra_ciclo_unico/i.test(error.message)) resultado.enviadas.push(item);
    else resultado.recusadas.push({ item, motivo: error.message });
  }
  return resultado;
}
