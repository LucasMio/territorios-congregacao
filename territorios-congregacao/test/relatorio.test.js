import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { anoDeServico, montarDesignacoes } from '../src/lib/relatorio.js';

describe('registro de designação (S-13)', () => {
  it('ano de serviço vai de setembro a agosto', () => {
    assert.equal(anoDeServico('2026-08-31'), 2026);
    assert.equal(anoDeServico('2026-09-01'), 2027);
    assert.equal(anoDeServico('2027-03-10'), 2027);
  });
  it('junta as saídas até cada conclusão numa designação', () => {
    const saidas = [
      { data: '2026-09-05', nome: 'Fernando' },
      { data: '2026-09-12', nome: 'Carlos Brito' },
      { data: '2026-09-19', nome: 'Fernando' },
      { data: '2026-10-03', nome: 'Mateus' },
    ];
    assert.deepEqual(montarDesignacoes(saidas, ['2026-09-19']), [
      { desde: '2026-09-05', nomes: ['Fernando', 'Carlos Brito'], concluido: '2026-09-19' },
      { desde: '2026-10-03', nomes: ['Mateus'], concluido: null },
    ]);
  });
  it('conclusão sem saída registrada vira designação sem nome', () => {
    assert.deepEqual(montarDesignacoes([], ['2026-10-01']), [{ desde: null, nomes: [], concluido: '2026-10-01' }]);
  });
});
