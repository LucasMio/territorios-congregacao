// npm run importar-territorios — envia os territórios de dados/territorios.json para o banco.
// Pode rodar de novo sem problema: atualiza os que já existem (pelo número).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, executar, supabaseAdmin } from './comum.js';

executar(async () => {
  const arquivo = path.join(RAIZ, 'dados', 'territorios.json');
  if (!fs.existsSync(arquivo)) throw new Error('Não achei dados/territorios.json (os territórios extraídos da planilha).');
  const lista = JSON.parse(fs.readFileSync(arquivo, 'utf8')).map((t) => ({
    numero: t.numero,
    bairro: t.bairro,
    grupo: t.responsavel,
    ultima_data: t.ultima_data,
    link_imagem: t.link_imagem,
    link_mapa: t.link_mapa,
    link_localizacao: t.link_localizacao,
    observacoes: t.observacoes,
    atualizado_em: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin().from('territorios').upsert(lista, { onConflict: 'numero' });
  if (error) throw new Error(`O banco recusou a importação: ${error.message}. Já rodou "npm run banco"?`);
  console.log(`✅ ${lista.length} territórios importados.`);
});
