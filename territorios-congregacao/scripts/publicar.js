// npm run publicar         — publica o SITE OFICIAL (só a partir do ramo "main" do git, sem nada pendente).
// npm run publicar-teste   — publica o SITE DE TESTE (projeto separado), para revisar melhorias antes.
// Envia para a Vercel só as chaves PÚBLICAS do site (VITE_...). A chave secreta e a senha do banco ficam no seu PC.
import { spawnSync } from 'node:child_process';
import { RAIZ, executar, variavel } from './comum.js';

const TESTE = process.argv.includes('--teste');
const PROJETO = TESTE ? 'territorios-exemplo-teste' : 'territorios-exemplo';
const EQUIPE = 'SEU-ESCOPO-NA-VERCEL'; // área pessoal "Ricardo" (plano Hobby)

function comando(cmd, args, entrada) {
  const r = spawnSync(cmd, args, { cwd: RAIZ, input: entrada, encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: r.status === 0, saida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function vercel(args, entrada) {
  const { ok, saida } = comando('npx', ['--yes', 'vercel@latest', ...args, '--token', process.env.VERCEL_TOKEN, '--scope', EQUIPE], entrada);
  if (!ok) throw new Error(`A Vercel recusou "${args[0]}":\n${saida.split('\n').filter((l) => !/telemetry|^>/.test(l)).slice(-8).join('\n')}`);
  return saida;
}

executar(async () => {
  // Trava: o site oficial só recebe o que está no ramo "main" (o que você aprovou), sem nada pendente.
  if (!TESTE) {
    const ramo = comando('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (ramo.ok && ramo.saida.trim() !== 'main') {
      throw new Error(`Você está no ramo "${ramo.saida.trim()}" (melhorias ainda não aprovadas). O site oficial só é publicado do ramo main. Para o site de teste: npm run publicar-teste`);
    }
    const pendente = comando('git', ['status', '--porcelain']);
    if (pendente.ok && pendente.saida.trim()) throw new Error('Há mudanças não registradas no git. Registre (commit) antes de publicar o site oficial.');
  }

  variavel('VERCEL_TOKEN', 'vercel.com/account/tokens (na conta pessoal)');
  const url = variavel('VITE_SUPABASE_URL', 'Supabase > Project Settings > Data API');
  const anon = variavel('VITE_SUPABASE_ANON_KEY', 'Supabase > Project Settings > API Keys');

  console.log(`1/3 Ligando a pasta ao projeto "${PROJETO}" na Vercel…`);
  vercel(['link', '--yes', '--project', PROJETO]);

  console.log('2/3 Enviando as chaves públicas do Supabase…');
  for (const [nome, valor] of [['VITE_SUPABASE_URL', url], ['VITE_SUPABASE_ANON_KEY', anon]]) {
    // São chaves públicas (vão para o site de qualquer jeito): guardadas como configuração, não como segredo.
    vercel(['env', 'add', nome, '--environment', 'production', '--force', '--yes', '--no-sensitive', '--non-interactive'], valor);
  }

  console.log('3/3 Publicando (leva 1 a 2 minutos)…');
  const saida = vercel(['deploy', '--prod', '--yes']);
  const endereco = saida.match(/https:\/\/[^\s]+\.vercel\.app/g)?.at(-1);
  console.log(`\n✅ ${TESTE ? 'Site de TESTE' : 'Site oficial'} publicado${endereco ? `: ${endereco}` : '.'}`);
  console.log(`   Endereço fixo: https://${PROJETO}.vercel.app`);
  if (TESTE) console.log('   Atenção: o site de teste usa o MESMO banco de dados do oficial (mesmos irmãos e territórios).');
  // Deixa a pasta ligada de novo ao projeto oficial (o padrão).
  if (TESTE) vercel(['link', '--yes', '--project', 'territorios-exemplo']);
});
