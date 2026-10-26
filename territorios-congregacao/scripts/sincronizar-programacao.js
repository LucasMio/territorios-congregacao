// npm run sincronizar-programacao — traz a programação dos dirigentes de campo (planilha mensal,
// já importada no sistema de lembretes, pasta "designações auto") para o site e escolhe os territórios.
// Roda sozinho depois de "npm run importar" e "npm run trocar" no sistema de lembretes.
//
// - Cada linha da planilha vira uma saída; o grupo de territórios sai da regra do dia (src/lib/programacao.js).
// - Os demais domingos de cada mês ganham uma saída por chefe de grupo.
// - O dirigente é ligado ao login pelo telefone do contato (ou pelo nome, se não tiver contato).
// - O que o administrador trocou no site (território ou dirigente) não é desfeito.
// - Saídas futuras que saíram da planilha são apagadas; as passadas ficam como histórico.
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { RAIZ, executar, supabaseAdmin } from './comum.js';
import { normalizarTelefone } from '../src/lib/telefone.js';
import { hojeLocal } from '../src/lib/situacao.js';
import { CHEFES_DE_GRUPO, HORARIO_DOMINGO_GRUPOS, domingosDosGrupos, grupoDoDia, territorioDaObservacao } from '../src/lib/programacao.js';

const BANCO_LEMBRETES = path.join(RAIZ, '..', 'designações auto', 'dados', 'banco.sqlite');
const simples = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

executar(async () => {
  if (!fs.existsSync(BANCO_LEMBRETES)) throw new Error(`Não achei o banco do sistema de lembretes em ${BANCO_LEMBRETES}`);
  const lembretes = new DatabaseSync(BANCO_LEMBRETES, { readOnly: true });
  const linhas = lembretes
    .prepare(
      `SELECT d.data, d.horario, d.nome, d.local, d.observacao,
              COALESCE(c.telefone, c2.telefone) AS telefone
         FROM designacoes d
         LEFT JOIN contatos c ON c.chave = d.chave
         LEFT JOIN apelidos a ON a.chave = d.chave
         LEFT JOIN contatos c2 ON c2.id = a.contato_id
        WHERE d.lista = 'dirigentes' AND d.ativa = 1
        ORDER BY d.data, d.horario`,
    )
    .all();
  lembretes.close();

  const admin = supabaseAdmin();
  const [{ data: perfis, error: e1 }, { data: existentes, error: e2 }, { data: territorios, error: e3 }] = await Promise.all([
    admin.from('perfis').select('id, nome, telefone').eq('ativo', true),
    admin.from('saidas').select('*'),
    admin.from('territorios').select('numero'),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 || e2 || e3).message);
  const numerosValidos = new Set(territorios.map((t) => t.numero));

  // Liga o nome da planilha ao login: pelo telefone do contato; senão pelo nome completo ou primeiro nome (se único).
  const naoLigados = new Set();
  function acharPerfil(nome, telefone) {
    const tel = telefone && normalizarTelefone(telefone);
    const porTelefone = tel && perfis.find((p) => p.telefone === tel);
    if (porTelefone) return porTelefone;
    const alvo = simples(nome);
    const exato = perfis.filter((p) => simples(p.nome) === alvo);
    if (exato.length === 1) return exato[0];
    const primeiro = perfis.filter((p) => simples(p.nome).split(' ')[0] === alvo.split(' ')[0]);
    if (primeiro.length === 1) return primeiro[0];
    naoLigados.add(nome);
    return null;
  }

  const novas = [];
  const vistas = new Map(); // duas saídas no mesmo dia e horário: a segunda ganha "#2"
  for (const l of linhas) {
    const regra = grupoDoDia(l.data, l.local);
    const doTexto = territorioDaObservacao(l.observacao);
    const p = acharPerfil(l.nome, l.telefone);
    const base = `planilha:${l.data} ${l.horario}`;
    vistas.set(base, (vistas.get(base) ?? 0) + 1);
    novas.push({
      chave: vistas.get(base) > 1 ? `${base}#${vistas.get(base)}` : base,
      data: l.data,
      horario: l.horario,
      local: l.local ?? null,
      grupo: regra.grupo,
      sem_territorio: regra.semTerritorio,
      dirigente_nome: p?.nome ?? l.nome,
      dirigente_id: p?.id ?? null,
      dirigente_planilha: l.nome, // como está na planilha (o sistema de lembretes troca por este nome)
      observacao: l.observacao ?? null,
      ...(doTexto && numerosValidos.has(doTexto) ? { territorio_numero: doTexto, territorio_manual: true } : {}),
    });
  }
  const meses = [...new Set(linhas.map((l) => l.data.slice(0, 7)))];
  // Só de hoje em diante: domingos passados que não estavam na planilha não aconteceram pelo sistema.
  for (const data of domingosDosGrupos(meses).filter((d) => d >= hojeLocal())) {
    for (const chefe of CHEFES_DE_GRUPO) {
      const p = acharPerfil(chefe.nome);
      novas.push({
        chave: `domingo:${data}:${chefe.grupo}`,
        data,
        horario: HORARIO_DOMINGO_GRUPOS,
        local: `Grupo ${chefe.grupo}`,
        grupo: chefe.territorios ?? chefe.grupo,
        sem_territorio: false,
        escolha_do_dirigente: true, // o chefe decide em quais territórios/quadras trabalhar
        dirigente_nome: p?.nome ?? chefe.nome,
        dirigente_id: p?.id ?? null,
        observacao: null,
      });
    }
  }

  const porChave = new Map(existentes.map((s) => [s.chave, s]));
  let inseridas = 0;
  let atualizadas = 0;
  for (const n of novas) {
    const antiga = porChave.get(n.chave);
    if (!antiga) {
      const { error } = await admin.from('saidas').insert(n);
      if (error) throw new Error(`${n.chave}: ${error.message}`);
      inseridas++;
      continue;
    }
    const mudar = { ...n };
    delete mudar.chave;
    if (antiga.dirigente_manual) {
      delete mudar.dirigente_nome;
      delete mudar.dirigente_id;
    }
    if (antiga.territorio_manual) {
      delete mudar.territorio_numero;
      delete mudar.territorio_manual;
    }
    const diferente = Object.entries(mudar).some(([k, v]) => (antiga[k] ?? null) !== (v ?? null));
    if (diferente) {
      const { error } = await admin.from('saidas').update({ ...mudar, atualizado_em: new Date().toISOString() }).eq('id', antiga.id);
      if (error) throw new Error(`${n.chave}: ${error.message}`);
      atualizadas++;
    }
  }

  const chavesNovas = new Set(novas.map((n) => n.chave));
  const sumiram = existentes.filter((s) => !chavesNovas.has(s.chave) && !s.chave.startsWith('teste:') && s.data >= hojeLocal());
  if (sumiram.length) {
    const { error } = await admin.from('saidas').delete().in('id', sumiram.map((s) => s.id));
    if (error) throw new Error(error.message);
  }

  const { data: mudancas, error: e4 } = await admin.rpc('planejar_saidas');
  if (e4) throw new Error(e4.message);

  console.log(`✅ Programação de campo no site: ${inseridas} nova(s), ${atualizadas} atualizada(s), ${sumiram.length} removida(s); ${mudancas} território(s) escolhido(s) automaticamente.`);
  if (naoLigados.size) {
    console.log(`⚠️  Sem login no site (não vão ver o território): ${[...naoLigados].join(', ')}. Cadastre com: npm run cadastrar -- "Nome" "(66) 9xxxx-xxxx"`);
  }
});
