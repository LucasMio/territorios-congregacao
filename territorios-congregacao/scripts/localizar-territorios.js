// npm run localizar-territorios — lê o ponto (latitude/longitude) de cada link do Google Maps
// e grava no território, para o mapa abrir no lugar certo.
// Só preenche quem ainda não tem ponto (use --todos para refazer todos).
import { executar, supabaseAdmin } from './comum.js';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Segue os redirecionamentos do link curto (maps.app.goo.gl) e acha as coordenadas na URL final. */
async function coordenadasDoLink(link) {
  let url = link;
  for (let i = 0; i < 8; i++) {
    const m =
      url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
      url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
      url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/) ||
      url.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const destino = r.headers.get('location');
    if (!destino) break;
    url = new URL(destino, url).href;
  }
  return null;
}

executar(async () => {
  const todos = process.argv.includes('--todos');
  const admin = supabaseAdmin();
  const { data, error } = await admin.from('territorios').select('numero, bairro, link_localizacao, lat').order('numero');
  if (error) throw new Error(`${error.message}. Já rodou "npm run banco"?`);
  const pendentes = data.filter((t) => t.link_localizacao && (todos || t.lat == null));
  console.log(`Localizando ${pendentes.length} território(s)...`);
  const falhas = [];
  for (const t of pendentes) {
    try {
      const c = await coordenadasDoLink(t.link_localizacao);
      if (!c) {
        falhas.push(`${t.numero} (${t.bairro})`);
        continue;
      }
      const { error: e } = await admin.from('territorios').update(c).eq('numero', t.numero);
      if (e) throw e;
      process.stdout.write('.');
    } catch (e) {
      falhas.push(`${t.numero} (${e.message})`);
    }
    await esperar(300); // não sobrecarregar o Google
  }
  console.log(`\n✅ ${pendentes.length - falhas.length} localizado(s).`);
  if (falhas.length) console.log(`⚠️  Sem ponto: ${falhas.join(', ')}. Nesses, o mapa abre na cidade e você navega até o lugar.`);
});
