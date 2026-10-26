// Funções compartilhadas pelos comandos de administração (npm run ...).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local'), quiet: true });

/** Lê uma variável do .env.local; se faltar, para com uma mensagem clara. */
export function variavel(nome, ondeAchar) {
  const valor = process.env[nome]?.trim();
  if (!valor) {
    console.error(`\n❌ Falta "${nome}" no arquivo .env.local.\n   Onde achar: ${ondeAchar}\n`);
    process.exit(1);
  }
  return valor;
}

/** Cliente com a chave de administração (ignora as regras de acesso). Só para estes comandos. */
export function supabaseAdmin() {
  const url = variavel('VITE_SUPABASE_URL', 'Supabase > Project Settings > Data API > Project URL');
  const chave = variavel('SUPABASE_SERVICE_ROLE_KEY', 'Supabase > Project Settings > API Keys > service_role (secret)');
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function executar(principal) {
  principal().catch((e) => {
    console.error(`\n❌ ${e.message}\n`);
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  });
}
