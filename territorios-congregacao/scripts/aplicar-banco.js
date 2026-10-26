// npm run banco — cria/atualiza as tabelas no Supabase (arquivos de supabase/migrations, em ordem).
// Cada arquivo é aplicado uma vez só; o que já foi aplicado fica anotado na tabela _migracoes.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { RAIZ, executar, variavel } from './comum.js';

executar(async () => {
  const url = variavel(
    'SUPABASE_DB_URL',
    'Supabase > botão "Connect" (topo da página) > "Session pooler" > copie a URI e troque [YOUR-PASSWORD] pela senha do banco',
  );
  const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await cliente.connect();
  try {
    await cliente.query('create table if not exists public._migracoes (arquivo text primary key, aplicada_em timestamptz default now())');
    await cliente.query('alter table public._migracoes enable row level security');
    const feitas = new Set((await cliente.query('select arquivo from public._migracoes')).rows.map((r) => r.arquivo));
    const pasta = path.join(RAIZ, 'supabase', 'migrations');
    const arquivos = fs.readdirSync(pasta).filter((a) => a.endsWith('.sql')).sort();
    let novas = 0;
    for (const arquivo of arquivos) {
      if (feitas.has(arquivo)) continue;
      const sql = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
      await cliente.query('begin');
      try {
        await cliente.query(sql);
        await cliente.query('insert into public._migracoes (arquivo) values ($1)', [arquivo]);
        await cliente.query('commit');
        console.log(`✅ Aplicado: ${arquivo}`);
        novas++;
      } catch (e) {
        await cliente.query('rollback');
        throw new Error(`Falha em ${arquivo}: ${e.message}`);
      }
    }
    console.log(novas ? `\nBanco atualizado (${novas} arquivo(s)).` : 'O banco já estava atualizado.');
  } finally {
    await cliente.end();
  }
});
