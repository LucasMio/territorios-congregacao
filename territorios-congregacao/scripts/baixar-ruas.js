// npm run baixar-ruas — baixa do OpenStreetMap as ruas de toda a região dos territórios
// e guarda em public/ruas.json. A geração de quadras usa esse arquivo (rápido e sem depender
// dos servidores públicos, que vivem ocupados). Rode de novo se as ruas mudarem.
//
// Fonte principal: a API oficial do OpenStreetMap, em pedaços pequenos (é estável).
// Se ela falhar, tenta os servidores "Overpass".
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, executar, supabaseAdmin } from './comum.js';
import { consultaOverpass, ehRua } from '../src/lib/ruas.js';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const CABECALHO = { 'User-Agent': 'territorios-exemplo/1.0 (controle de territorios de congregacao)' };
const MARGEM_GRAUS = 0.01; // ~1 km de folga em volta dos territórios
const PEDACO_GRAUS = 0.02; // tamanho de cada pedaço pedido à API oficial
const arred = (n) => Math.round(n * 1e6) / 1e6;

/** API oficial, pedaço por pedaço. Devolve as vias (sem repetir) que separam quadras. */
async function pelaApiOficial([oeste, sul, leste, norte]) {
  const vias = new Map();
  const pedacos = [];
  for (let x = oeste; x < leste; x += PEDACO_GRAUS) {
    for (let y = sul; y < norte; y += PEDACO_GRAUS) pedacos.push([x, y, Math.min(x + PEDACO_GRAUS, leste), Math.min(y + PEDACO_GRAUS, norte)]);
  }
  for (const [i, p] of pedacos.entries()) {
    process.stdout.write(`\rBaixando pedaço ${i + 1} de ${pedacos.length}…`);
    const r = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${p.map((n) => n.toFixed(6)).join(',')}`, { headers: CABECALHO, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`API do OpenStreetMap respondeu ${r.status}`);
    const { elements } = await r.json();
    const nos = new Map(elements.filter((e) => e.type === 'node').map((e) => [e.id, [arred(e.lon), arred(e.lat)]]));
    for (const via of elements.filter((e) => e.type === 'way' && ehRua(e.tags))) {
      const pontos = via.nodes.map((id) => nos.get(id)).filter(Boolean);
      if (pontos.length >= 2 && !vias.has(via.id)) vias.set(via.id, pontos);
    }
  }
  console.log(' ok');
  return [...vias.values()];
}

async function peloOverpass(caixa) {
  for (const servidor of OVERPASS) {
    process.stdout.write(`Tentando ${new URL(servidor).host}… `);
    try {
      const r = await fetch(servidor, { method: 'POST', body: new URLSearchParams({ data: consultaOverpass(caixa, 180) }), headers: CABECALHO, signal: AbortSignal.timeout(200000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const dados = await r.json();
      console.log('ok');
      return dados.elements.filter((e) => e.type === 'way' && e.geometry?.length >= 2).map((e) => e.geometry.map((p) => [arred(p.lon), arred(p.lat)]));
    } catch (e) {
      console.log(`falhou (${e.message})`);
    }
  }
  throw new Error('Os servidores do OpenStreetMap não responderam. Tente de novo mais tarde.');
}

executar(async () => {
  const { data, error } = await supabaseAdmin().from('territorios').select('lat, lng').not('lat', 'is', null);
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error('Nenhum território com posição. Rode antes: npm run localizar-territorios');
  const caixa = [
    Math.min(...data.map((t) => t.lng)) - MARGEM_GRAUS,
    Math.min(...data.map((t) => t.lat)) - MARGEM_GRAUS,
    Math.max(...data.map((t) => t.lng)) + MARGEM_GRAUS,
    Math.max(...data.map((t) => t.lat)) + MARGEM_GRAUS,
  ];

  let ruas;
  try {
    ruas = await pelaApiOficial(caixa);
  } catch (e) {
    console.log(`\nAPI oficial falhou (${e.message}). Tentando os servidores Overpass…`);
    ruas = await peloOverpass(caixa);
  }

  const arquivo = path.join(RAIZ, 'public', 'ruas.json');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify({ baixado_em: new Date().toISOString(), caixa, ruas }));
  console.log(`✅ ${ruas.length} ruas salvas em public/ruas.json (${Math.round(fs.statSync(arquivo).size / 1024)} KB).`);
});
