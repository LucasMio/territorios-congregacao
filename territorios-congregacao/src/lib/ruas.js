// Busca as ruas de uma área no OpenStreetMap (serviço gratuito "Overpass").
// Os servidores públicos às vezes ficam sobrecarregados: tenta um de cada vez.

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Vias que separam quadras. "service" (entradas de garagem, estacionamentos) e calçadas ficam de fora.
export const TIPOS_DE_RUA = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|road|pedestrian';

// Em bairros novos, quem mapeou no OpenStreetMap às vezes cadastrou ruas de verdade como
// "caminho" (path), "estrada de terra" (track) ou "em obras". Esses só contam se tiverem nome
// (ex.: "Rua G"), para um caminho sem nome dentro de uma praça não cortar a quadra ao meio.
export const TIPOS_SO_COM_NOME = 'path|track|footway|cycleway|service|construction';

/** true se a via (tags do OpenStreetMap) separa quadras. */
export function ehRua(tags = {}) {
  const tipo = tags.highway ?? '';
  if (new RegExp(`^(${TIPOS_DE_RUA})$`).test(tipo)) return true;
  return new RegExp(`^(${TIPOS_SO_COM_NOME})$`).test(tipo) && Boolean(tags.name?.trim());
}

/** Consulta Overpass com as duas regras acima. sul, oeste, norte, leste em graus. */
export function consultaOverpass([oeste, sul, leste, norte], timeout = 50) {
  const caixa = `(${sul},${oeste},${norte},${leste})`;
  return `[out:json][timeout:${timeout}];(way["highway"~"^(${TIPOS_DE_RUA})$"]${caixa};way["highway"~"^(${TIPOS_SO_COM_NOME})$"]["name"]${caixa};);out geom;`;
}

/**
 * @param {[number, number, number, number]} caixa  [oeste, sul, leste, norte] em graus
 * @param {(msg: string) => void} [aviso]           recebe mensagens de progresso
 * @returns {Promise<Array<Array<[number, number]>>>}  cada rua = pontos [lng, lat]
 */
export async function buscarRuas([oeste, sul, leste, norte], aviso = () => {}) {
  const consulta = consultaOverpass([oeste, sul, leste, norte]);
  let ultimoErro = null;
  for (const [i, servidor] of SERVIDORES.entries()) {
    aviso(i === 0 ? 'Buscando as ruas no OpenStreetMap… (pode levar até 1 minuto)' : `Servidor ocupado, tentando outro (${i + 1}/${SERVIDORES.length})…`);
    try {
      const resposta = await fetch(servidor, {
        method: 'POST',
        body: new URLSearchParams({ data: consulta }),
        signal: AbortSignal.timeout(60000),
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const dados = await resposta.json();
      return dados.elements.filter((e) => e.type === 'way' && e.geometry).map((e) => e.geometry.map((p) => [p.lon, p.lat]));
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw new Error(`Não consegui buscar as ruas agora (${ultimoErro?.message}). Os servidores do OpenStreetMap estão ocupados; tente de novo em alguns minutos.`);
}

// Ruas da região inteira, baixadas por "npm run baixar-ruas" (public/ruas.json).
let ruasDaRegiao = null;

const sobrepoe = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const caixaDaRua = (pontos) => [
  Math.min(...pontos.map((p) => p[0])),
  Math.min(...pontos.map((p) => p[1])),
  Math.max(...pontos.map((p) => p[0])),
  Math.max(...pontos.map((p) => p[1])),
];

/**
 * Ruas de uma área: usa o arquivo da região (instantâneo) e só busca na internet
 * se a área estiver fora da região baixada.
 */
export async function carregarRuas(caixa, aviso = () => {}) {
  if (!ruasDaRegiao) {
    aviso('Carregando as ruas da região…');
    try {
      const r = await fetch('/ruas.json');
      if (r.ok) {
        const dados = await r.json();
        ruasDaRegiao = { caixa: dados.caixa, ruas: dados.ruas.map((pontos) => ({ pontos, caixa: caixaDaRua(pontos) })) };
      }
    } catch {
      ruasDaRegiao = null;
    }
  }
  const dentroDaRegiao =
    ruasDaRegiao && caixa[0] >= ruasDaRegiao.caixa[0] && caixa[1] >= ruasDaRegiao.caixa[1] && caixa[2] <= ruasDaRegiao.caixa[2] && caixa[3] <= ruasDaRegiao.caixa[3];
  if (dentroDaRegiao) return ruasDaRegiao.ruas.filter((r) => sobrepoe(r.caixa, caixa)).map((r) => r.pontos);
  return buscarRuas(caixa, aviso);
}
