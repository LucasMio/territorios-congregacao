// npm run enviar-acesso -- "(66) 9xxxx-xxxx" ["Nome do irmão" ...]   (telefone ou nome como está no sistema)
// Gera um código de acesso novo para cada irmão e coloca a mensagem na fila do sistema de
// lembretes (pasta "designações auto"), que envia pelo seu WhatsApp em até 1 minuto.
// O código não aparece na tela. Administradores recebem também a explicação de como desenhar os mapas.
import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { RAIZ, executar, supabaseAdmin } from './comum.js';
import { formatarTelefone, normalizarTelefone } from '../src/lib/telefone.js';
import { CHEFES_DE_GRUPO } from '../src/lib/programacao.js';

const SITE = 'https://territorios-exemplo.vercel.app';
const BANCO_LEMBRETES = path.join(RAIZ, '..', 'designações auto', 'dados', 'banco.sqlite');

function mensagem({ nome, telefone, papel }, codigo) {
  const partes = [
    `Olá, ${nome.split(' ')[0]}! Os territórios da congregação agora estão num sistema pelo celular. Nele você vê a programação de campo (dias, dirigentes e o território de cada dia) e marca no mapa as quadras trabalhadas.`,
    '',
    '*Como entrar*',
    `Site: ${SITE}`,
    `Telefone: ${formatarTelefone(telefone)}`,
    `Código de acesso: ${codigo}`,
    'No primeiro acesso o sistema pede para você criar sua senha. Dica: no menu do navegador, toque em "Adicionar à tela inicial" para ficar como um aplicativo.',
    '',
    '*Como usar no dia da saída*',
    '1. Na página inicial (*Programação*), as suas saídas aparecem em destaque, com o território do dia.',
    '2. Toque em *Abrir o território* para ver o mapa com as quadras.',
    '3. Depois do campo, toque em *Marcar quadras trabalhadas*, toque nas quadras feitas (ficam verdes) e em *Terminei*.',
    'Quando todas as quadras são feitas, o território é concluído sozinho.',
  ];
  const chefe = CHEFES_DE_GRUPO.find((c) => c.nome === nome);
  if (chefe) {
    partes.push(
      '',
      '*Domingos do seu grupo*',
      `Nos domingos (menos o primeiro do mês) você dirige o grupo e escolhe onde trabalhar: na semana do domingo, todos os territórios do grupo ${chefe.territorios ?? chefe.grupo} aparecem em *Meus territórios*. Depois do campo, marque as quadras feitas do mesmo jeito.`,
    );
  }
  if (papel === 'admin') {
    partes.push(
      '',
      'Você está como *administrador*: vê todos os territórios, pode trocar o território ou o dirigente de uma saída (botão *Alterar* na Programação) e ajudar a desenhar os mapas que faltam.',
      '',
      '*O trabalho de desenhar os territórios*',
      'Na aba *Mapa geral* aparecem todos os territórios já desenhados e, em cinza tracejado, os que faltam (a lista "Faltam desenhar" leva direto ao editor). Em cada um desenhamos só o contorno; o sistema divide em quadras sozinho, usando as ruas do mapa. Passo a passo:',
      '1. Abra o território e toque em *Desenhar mapa*.',
      '2. Use a imagem antiga do território como guia (botão para ver o mapa antigo).',
      '3. *Desenhar contorno*: toque em cada canto do território; para fechar, toque no primeiro ponto.',
      '4. *Gerar quadras*: o sistema recorta o contorno pelas ruas e numera as quadras.',
      '5. Confira e corrija tocando na quadra: *Apagar* (praça, área vazia), *Juntar* (duas quadras que são uma só), *Dividir quadra* (rua de terra que o mapa não tem: desenhe uma linha atravessando) e *Ajustar pontos* (arrastar os cantos).',
      '6. Toque em *Salvar mapa*.',
      'É mais confortável no computador ou tablet, mas dá para fazer no celular.',
      '',
      'Vamos combinar quais territórios cada um desenha, para ninguém fazer o mesmo duas vezes.',
    );
  }
  partes.push('', 'Qualquer dúvida, me chame!');
  return partes.join('\n');
}

executar(async () => {
  const telefones = process.argv.slice(2);
  if (!telefones.length) throw new Error('Use: npm run enviar-acesso -- "(66) 9xxxx-xxxx"');
  const admin = supabaseAdmin();
  const db = new DatabaseSync(BANCO_LEMBRETES);
  db.exec('PRAGMA busy_timeout = 10000;');
  if (!db.prepare('PRAGMA table_info(avulsas)').all().some((c) => c.name === 'telefone')) db.exec('ALTER TABLE avulsas ADD COLUMN telefone TEXT');

  for (const t of telefones) {
    const telefone = normalizarTelefone(t);
    const busca = admin.from('perfis').select('id, nome, telefone, papel');
    const { data: achados } = await (telefone ? busca.eq('telefone', telefone) : busca.ilike('nome', t));
    const p = achados?.length === 1 ? achados[0] : null;
    if (!p) {
      console.log(`⚠️  ${t}: ${achados?.length > 1 ? 'mais de um irmão com este nome' : 'ninguém cadastrado'} — pulado`);
      continue;
    }
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const { error } = await admin.auth.admin.updateUserById(p.id, { password: codigo });
    if (error) throw new Error(`${p.nome}: ${error.message}`);
    await admin.from('perfis').update({ precisa_trocar_senha: true }).eq('id', p.id);
    db.prepare(`INSERT INTO avulsas (criada_em, texto, telefone) VALUES (?, ?, ?)`).run(new Date().toISOString(), mensagem(p, codigo), p.telefone);
    console.log(`📨 ${p.nome}${p.papel === 'admin' ? ' (administrador)' : ''}: código novo gerado e mensagem na fila do WhatsApp`);
  }
  db.close();
  console.log('\nO sistema de lembretes envia em até 1 minuto (se estiver ligado). Confira com: npm run log  (na pasta "designações auto")');
});
