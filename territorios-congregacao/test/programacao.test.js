import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { domingosDosGrupos, grupoDoDia, territorioDaObservacao } from '../src/lib/programacao.js';

describe('distribuição dos dias (novembro de 2026)', () => {
  it('segunda é Casa do Osvaldo', () => {
    assert.deepEqual(grupoDoDia('2026-11-02', 'Casa do SR. Osvaldo'), { grupo: 'Casa do Osvaldo', semTerritorio: false });
  });
  it('1ª e 2ª quartas: Salão do Reino; 3ª e 4ª: cartas', () => {
    assert.equal(grupoDoDia('2026-11-04').grupo, 'Salão do Reino');
    assert.equal(grupoDoDia('2026-11-11').grupo, 'Salão do Reino');
    assert.deepEqual(grupoDoDia('2026-11-18'), { grupo: null, semTerritorio: true });
    assert.deepEqual(grupoDoDia('2026-11-25'), { grupo: null, semTerritorio: true });
  });
  it('"Cartas" no local também tira o território', () => {
    assert.equal(grupoDoDia('2026-10-07', 'Salão do Reino (Cartas)').semTerritorio, true);
  });
  it('sábado e 1º domingo: Congregação', () => {
    assert.equal(grupoDoDia('2026-11-07', 'Salão do Reino').grupo, 'Congregação');
    assert.equal(grupoDoDia('2026-11-01').grupo, 'Congregação');
  });
  it('outros dias ficam sem regra', () => {
    assert.deepEqual(grupoDoDia('2026-09-24'), { grupo: null, semTerritorio: false });
    assert.equal(grupoDoDia('2026-11-08').grupo, null);
  });
  it('demais domingos do mês (para os chefes de grupo)', () => {
    assert.deepEqual(domingosDosGrupos(['2026-11']), ['2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']);
    assert.deepEqual(domingosDosGrupos(['2026-10']), ['2026-10-11', '2026-10-18', '2026-10-25']);
  });
  it('lê o território citado na observação', () => {
    assert.equal(territorioDaObservacao('Campanha — território n63'), 63);
    assert.equal(territorioDaObservacao('Território 7 (continuação)'), 7);
    assert.equal(territorioDaObservacao(null), null);
  });
});

describe('grupos que são a mesma reserva', async () => {
  const { gruposEquivalentes } = await import('../src/lib/programacao.js');
  it('Samuel foi unificado na Casa do Osvaldo', () => {
    assert.deepEqual(gruposEquivalentes('Samuel'), ['Casa do Osvaldo']);
    assert.deepEqual(gruposEquivalentes('Casa do Osvaldo'), ['Casa do Osvaldo']);
    assert.deepEqual(gruposEquivalentes('Tiago'), ['Tiago']);
  });
});
