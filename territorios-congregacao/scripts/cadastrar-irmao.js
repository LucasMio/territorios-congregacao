// npm run cadastrar -- "Nome do Irmão" "(66) 99999-1234" [dirigente|admin]
//   Cadastra um irmão e gera um CÓDIGO DE ACESSO de 6 dígitos. No primeiro acesso ele entra
//   com o telefone + esse código e cria a senha dele.
// npm run cadastrar -- --novo-codigo "(66) 99999-1234"
//   Gera um código novo (para quem esqueceu a senha).
import crypto from 'node:crypto';
import { executar, supabaseAdmin } from './comum.js';
import { emailDoTelefone, formatarTelefone, normalizarTelefone } from '../src/lib/telefone.js';

const codigo = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

function instrucoes(nome, telefone, cod) {
  console.log(`\nMande para ${nome} pelo WhatsApp:\n`);
  console.log('──────────────────────────────────────────');
  console.log(`Olá, ${nome.split(' ')[0]}! Seu acesso ao sistema de territórios:`);
  console.log(`Telefone: ${formatarTelefone(telefone)}`);
  console.log(`Código de acesso: ${cod}`);
  console.log('No primeiro acesso o sistema vai pedir para você criar sua senha.');
  console.log('──────────────────────────────────────────\n');
}

executar(async () => {
  const args = process.argv.slice(2);
  const admin = supabaseAdmin();

  if (args[0] === '--novo-codigo') {
    const telefone = normalizarTelefone(args[1]);
    if (!telefone) throw new Error('Use: npm run cadastrar -- --novo-codigo "(66) 99999-1234"');
    const { data: perfil, error: e1 } = await admin.from('perfis').select('id, nome').eq('telefone', telefone).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!perfil) throw new Error(`Nenhum irmão cadastrado com o telefone ${formatarTelefone(telefone)}.`);
    const cod = codigo();
    const { error: e2 } = await admin.auth.admin.updateUserById(perfil.id, { password: cod });
    if (e2) throw new Error(e2.message);
    await admin.from('perfis').update({ precisa_trocar_senha: true }).eq('id', perfil.id);
    console.log(`✅ Novo código gerado para ${perfil.nome}.`);
    instrucoes(perfil.nome, telefone, cod);
    return;
  }

  const [nome, telBruto, papel = 'dirigente'] = args;
  const telefone = normalizarTelefone(telBruto);
  if (!nome || !telefone || !['dirigente', 'admin'].includes(papel)) {
    throw new Error('Use: npm run cadastrar -- "Nome do Irmão" "(66) 99999-1234" [dirigente|admin]');
  }
  const cod = codigo();
  const { data, error } = await admin.auth.admin.createUser({
    email: emailDoTelefone(telefone),
    password: cod,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error) {
    if (/already/i.test(error.message)) throw new Error(`Esse telefone já está cadastrado. Para gerar outro código: npm run cadastrar -- --novo-codigo "${telBruto}"`);
    throw new Error(error.message);
  }
  const { error: e3 } = await admin.from('perfis').insert({ id: data.user.id, nome, telefone, papel });
  if (e3) {
    await admin.auth.admin.deleteUser(data.user.id); // não deixa login sem perfil
    throw new Error(`Não consegui salvar o perfil: ${e3.message}`);
  }
  console.log(`✅ ${nome} cadastrado como ${papel === 'admin' ? 'administrador' : 'dirigente'}.`);
  instrucoes(nome, telefone, cod);
});
