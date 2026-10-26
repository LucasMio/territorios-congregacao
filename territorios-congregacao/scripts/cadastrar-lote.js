// npm run cadastrar-lote -- dados/dirigentes.json
// Cadastra vários irmãos de uma vez. O arquivo é uma lista: [{ "nome": "...", "telefone": "...", "papel": "dirigente" }]
// Os códigos de acesso NÃO aparecem na tela: as mensagens prontas para o WhatsApp vão para
// dados/acessos-para-enviar.txt (fora da internet e do git). Quem já está cadastrado é pulado.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, executar, supabaseAdmin } from './comum.js';
import { emailDoTelefone, formatarTelefone, normalizarTelefone } from '../src/lib/telefone.js';

const SITE = 'https://territorios-exemplo.vercel.app';

executar(async () => {
  const entrada = process.argv[2];
  if (!entrada) throw new Error('Use: npm run cadastrar-lote -- dados/dirigentes.json');
  const lista = JSON.parse(fs.readFileSync(path.resolve(RAIZ, entrada), 'utf8'));
  const admin = supabaseAdmin();
  const { data: existentes, error } = await admin.from('perfis').select('nome, telefone');
  if (error) throw new Error(error.message);
  const jaTem = new Map(existentes.map((p) => [p.telefone, p.nome]));

  const mensagens = [];
  for (const irmao of lista) {
    const telefone = normalizarTelefone(irmao.telefone);
    if (!telefone) {
      console.log(`⚠️  ${irmao.nome}: telefone inválido (${irmao.telefone}) — pulado`);
      continue;
    }
    if (jaTem.has(telefone)) {
      console.log(`•  ${irmao.nome}: já cadastrado (como ${jaTem.get(telefone)}) — pulado`);
      continue;
    }
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const { data, error: e1 } = await admin.auth.admin.createUser({ email: emailDoTelefone(telefone), password: codigo, email_confirm: true, user_metadata: { nome: irmao.nome } });
    if (e1) {
      console.log(`❌ ${irmao.nome}: ${e1.message}`);
      continue;
    }
    const { error: e2 } = await admin.from('perfis').insert({ id: data.user.id, nome: irmao.nome, telefone, papel: irmao.papel ?? 'dirigente' });
    if (e2) {
      await admin.auth.admin.deleteUser(data.user.id);
      console.log(`❌ ${irmao.nome}: ${e2.message}`);
      continue;
    }
    jaTem.set(telefone, irmao.nome);
    console.log(`✅ ${irmao.nome} cadastrado (${formatarTelefone(telefone)})`);
    mensagens.push(
      [
        `===== Para: ${irmao.nome} — ${formatarTelefone(telefone)} =====`,
        `Olá, ${irmao.nome.split(' ')[0]}! Agora os territórios da congregação estão num sistema pelo celular, onde o dirigente marca as quadras trabalhadas.`,
        '',
        `Acesse: ${SITE}`,
        `Telefone: ${formatarTelefone(telefone)}`,
        `Código de acesso: ${codigo}`,
        '',
        'No primeiro acesso o sistema pede para você criar sua senha. Dica: no menu do navegador, use "Adicionar à tela inicial".',
        '',
      ].join('\n'),
    );
  }

  if (mensagens.length) {
    const arquivo = path.join(RAIZ, 'dados', 'acessos-para-enviar.txt');
    fs.appendFileSync(arquivo, `\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })}\n\n${mensagens.join('\n')}`);
    console.log(`\n📄 ${mensagens.length} mensagem(ns) com os códigos em: dados\\acessos-para-enviar.txt`);
  }
});
