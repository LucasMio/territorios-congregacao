import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailDoTelefone, formatarTelefone, linkEsqueciSenha, mascaraTelefone, normalizarTelefone } from '../src/lib/telefone.js';
import { mesesDesde, situacaoDoTerritorio } from '../src/lib/situacao.js';

describe('telefone', () => {
  it('aceita os formatos comuns e devolve 55 + DDD + número', () => {
    for (const t of ['(66) 99999-1234', '66999991234', '+55 66 99999-1234', '066 99999-1234']) {
      assert.equal(normalizarTelefone(t), '5566999991234', t);
    }
  });
  it('acrescenta o nono dígito de celular antigo e recusa números inválidos', () => {
    assert.equal(normalizarTelefone('66 8999-1234'), '5566989991234');
    assert.equal(normalizarTelefone('123'), null);
    assert.equal(normalizarTelefone('(66) 89999-1234'), null);
  });
  it('formata enquanto digita', () => {
    assert.equal(mascaraTelefone('66'), '(66');
    assert.equal(mascaraTelefone('669999'), '(66) 9999');
    assert.equal(mascaraTelefone('6699999'), '(66) 9999-9');
    assert.equal(mascaraTelefone('66999991234'), '(66) 99999-1234');
    assert.equal(mascaraTelefone('6699991234'), '(66) 9999-1234');
    assert.equal(mascaraTelefone('+55 66 99999-1234'), '(66) 99999-1234');
    assert.equal(mascaraTelefone(''), '');
  });
  it('formata e gera o login interno', () => {
    assert.equal(formatarTelefone('5566999991234'), '(66) 99999-1234');
    assert.equal(emailDoTelefone('5566999991234'), '5566999991234@login.exemplo.app');
  });
});

describe('situação do território (legenda da planilha)', () => {
  const hoje = new Date(2026, 9, 20); // 20/10/2026
  it('conta meses completos', () => {
    assert.equal(mesesDesde('2026-08-20', hoje), 2);
    assert.equal(mesesDesde('2026-08-21', hoje), 1);
    assert.equal(mesesDesde(null, hoje), null);
  });
  it('classifica em até 4, mais de 4, mais de 6 meses e sem registro', () => {
    assert.equal(situacaoDoTerritorio('2026-08-01', hoje), 'recente');
    assert.equal(situacaoDoTerritorio('2026-06-01', hoje), 'atencao');
    assert.equal(situacaoDoTerritorio('2026-04-01', hoje), 'urgente');
    assert.equal(situacaoDoTerritorio(null, hoje), 'sem_data');
  });
});

describe('horário de Cuiabá', async () => {
  const { hojeLocal } = await import('../src/lib/situacao.js');
  it('às 23:30 de Brasília ainda é o mesmo dia em Cuiabá (22:30)', () => {
    assert.equal(hojeLocal(new Date('2026-10-21T02:30:00Z')), '2026-10-20');
  });
  it('à 00:30 de Cuiabá já é o dia seguinte', () => {
    assert.equal(hojeLocal(new Date('2026-10-21T04:30:00Z')), '2026-10-21');
  });
});

describe('esqueci a senha', () => {
  it('abre o WhatsApp do responsável com a mensagem pronta', () => {
    const link = linkEsqueciSenha('(66) 99999-1234');
    assert.match(link, /^https:\/\/wa\.me\/5511900000000\?text=/);
    const texto = decodeURIComponent(link.split('text=')[1]);
    assert.match(texto, /Esqueci a senha/);
    assert.match(texto, /\(66\) 99999-1234/);
  });
  it('sem telefone completo, a mensagem não cita número', () => {
    const texto = decodeURIComponent(linkEsqueciSenha('(66) 999').split('text=')[1]);
    assert.doesNotMatch(texto, /telefone de acesso/);
  });
});
