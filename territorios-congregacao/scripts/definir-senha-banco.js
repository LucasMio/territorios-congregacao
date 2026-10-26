// npm run senha-banco — pede a senha do banco (sem mostrar na tela) e grava no .env.local,
// já no formato certo dentro do SUPABASE_DB_URL (caracteres especiais incluídos).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './comum.js';

const arquivo = path.join(RAIZ, '.env.local');

function perguntarEscondido(pergunta) {
  return new Promise((resolve) => {
    process.stdout.write(pergunta);
    const entrada = process.stdin;
    entrada.setRawMode?.(true);
    entrada.resume();
    entrada.setEncoding('utf8');
    let valor = '';
    const aoDigitar = (tecla) => {
      for (const c of tecla) {
        if (c === '\r' || c === '\n') {
          entrada.setRawMode?.(false);
          entrada.pause();
          entrada.off('data', aoDigitar);
          process.stdout.write('\n');
          return resolve(valor);
        }
        if (c === '\u0003') process.exit(1); // Ctrl+C
        if (c === '\u0008' || c === '\u007f') {
          if (valor) {
            valor = valor.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          valor += c;
          process.stdout.write('*');
        }
      }
    };
    entrada.on('data', aoDigitar);
  });
}

const conteudo = fs.readFileSync(arquivo, 'utf8');
const linha = conteudo.match(/^SUPABASE_DB_URL=(.*)$/m);
if (!linha || !linha[1].trim().startsWith('postgresql://')) {
  console.error('\n❌ A linha SUPABASE_DB_URL do .env.local não tem o endereço postgresql://... Cole o endereço do "Session pooler" primeiro.\n');
  process.exit(1);
}

const senha = await perguntarEscondido('Digite a senha do banco do Supabase e aperte Enter: ');
if (!senha) {
  console.error('❌ Nenhuma senha digitada.');
  process.exit(1);
}

// Troca o que estiver entre "usuario:" e "@" pela senha (codificada para caracteres especiais).
const url = linha[1].trim().replace(/^(postgresql:\/\/[^:]+:)(.*)(@[^@]+)$/, (_t, ini, _velha, fim) => `${ini}${encodeURIComponent(senha)}${fim}`);
fs.writeFileSync(arquivo, conteudo.replace(/^SUPABASE_DB_URL=.*$/m, `SUPABASE_DB_URL=${url}`));
console.log('✅ Senha gravada no .env.local. Agora rode: npm run banco');
