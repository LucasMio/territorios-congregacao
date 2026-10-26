import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ehErroDeRede, enviarFila, guardarNaFila, lerFila, tirarDaFila } from '../src/lib/filaOffline.js';

const armazem = () => {
  const dados = {};
  return { getItem: (k) => dados[k] ?? null, setItem: (k, v) => { dados[k] = v; } };
};
/** Supabase de mentira: responde cada insert com o próximo erro da lista (null = deu certo). */
const supabaseFalso = (respostas) => {
  const enviados = [];
  return {
    enviados,
    from: () => ({ insert: async (linha) => { enviados.push(linha); return { error: respostas.shift() ?? null }; } }),
  };
};

describe('marcação sem internet', () => {
  it('reconhece erro de rede', () => {
    assert.equal(ehErroDeRede({ message: 'TypeError: Failed to fetch' }), true);
    assert.equal(ehErroDeRede({ message: 'new row violates row-level security policy' }), false);
    assert.equal(ehErroDeRede(null), false);
  });
  it('guarda sem duplicar e tira da fila', () => {
    const a = armazem();
    guardarNaFila({ quadra_id: 1, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    guardarNaFila({ quadra_id: 1, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    guardarNaFila({ quadra_id: 2, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    assert.equal(lerFila(a).length, 2);
    tirarDaFila(1, 'u1', a);
    assert.deepEqual(lerFila(a).map((x) => x.quadra_id), [2]);
  });
  it('envia quando a internet volta; repetida conta como enviada; recusada avisa', async () => {
    const a = armazem();
    for (const q of [1, 2, 3]) guardarNaFila({ quadra_id: q, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    guardarNaFila({ quadra_id: 9, territorio_numero: 5, data: '2026-10-21', usuario: 'outro' }, a);
    const sb = supabaseFalso([null, { message: 'duplicate key value violates unique constraint "marcacoes_quadra_ciclo_unico"' }, { message: 'new row violates row-level security policy' }]);
    const r = await enviarFila(sb, 'u1', a);
    assert.equal(r.enviadas.length, 2);
    assert.equal(r.recusadas.length, 1);
    assert.equal(sb.enviados.length, 3, 'só as do próprio usuário');
    assert.deepEqual(lerFila(a).map((x) => x.usuario), ['outro']);
  });
  it('sem internet ainda: para e mantém tudo na fila', async () => {
    const a = armazem();
    guardarNaFila({ quadra_id: 1, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    guardarNaFila({ quadra_id: 2, territorio_numero: 5, data: '2026-10-21', usuario: 'u1' }, a);
    const r = await enviarFila(supabaseFalso([{ message: 'Failed to fetch' }]), 'u1', a);
    assert.equal(r.semRede, true);
    assert.equal(lerFila(a).length, 2);
  });
});
