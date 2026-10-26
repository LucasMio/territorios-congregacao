// Geração automática das quadras de um território.
// Ideia: as quadras são o que sobra do contorno depois de "apagar" as ruas.
// Cada rua do OpenStreetMap vira uma faixa com a largura da rua; o contorno menos todas as
// faixas se divide em pedaços — cada pedaço é uma quadra.
import * as turf from '@turf/turf';

/**
 * @param {object} contorno   GeoJSON Polygon ou MultiPolygon (o contorno desenhado)
 * @param {Array<Array<[number, number]>>} ruas  cada rua = lista de pontos [lng, lat]
 * @param {{ larguraRuaMetros?: number, areaMinimaM2?: number }} opcoes
 * @returns {{ numero: number, geometria: object, areaM2: number }[]}
 */
export function gerarQuadras(contorno, ruas, { larguraRuaMetros = 8, areaMinimaM2 = 300 } = {}) {
  const area = turf.feature(contorno);
  const caixa = turf.bboxPolygon(turf.bbox(turf.buffer(area, 50, { units: 'meters' })));

  const faixas = ruas
    .filter((pontos) => pontos.length >= 2)
    .map((pontos) => turf.lineString(pontos))
    .filter((linha) => turf.booleanIntersects(linha, caixa))
    .map((linha) => turf.buffer(linha, larguraRuaMetros / 2, { units: 'meters', steps: 4 }))
    .filter(Boolean);

  let resto = area;
  if (faixas.length) {
    const ruasUnidas = faixas.length === 1 ? faixas[0] : turf.union(turf.featureCollection(faixas));
    resto = turf.difference(turf.featureCollection([area, ruasUnidas]));
  }
  if (!resto) return [];

  const pedacos = turf
    .flatten(resto)
    .features.map((f) => ({ geometria: f.geometry, areaM2: Math.round(turf.area(f)), centro: turf.centroid(f).geometry.coordinates }))
    .filter((p) => p.areaM2 >= areaMinimaM2);

  return numerar(pedacos).map(({ geometria, areaM2 }, i) => ({ numero: i + 1, geometria, areaM2 }));
}

/**
 * Numera de cima para baixo e da esquerda para a direita, por "linhas" de quadras,
 * como se lê um mapa. Quadras com centro a menos de ~60 m de diferença de altura ficam na mesma linha.
 */
export function numerar(pedacos, faixaGraus = 0.00055) {
  const ordenados = [...pedacos].sort((a, b) => b.centro[1] - a.centro[1]);
  const linhas = [];
  for (const p of ordenados) {
    const linha = linhas.at(-1);
    if (linha && Math.abs(linha[0].centro[1] - p.centro[1]) < faixaGraus) linha.push(p);
    else linhas.push([p]);
  }
  return linhas.flatMap((linha) => linha.sort((a, b) => a.centro[0] - b.centro[0]));
}

/** Junta duas (ou mais) quadras numa só. */
export function juntarQuadras(geometrias) {
  const unidas = turf.union(turf.featureCollection(geometrias.map((g) => turf.feature(g))));
  return unidas?.geometry ?? null;
}

/**
 * Divide uma quadra com uma linha desenhada (ex.: rua que falta no mapa).
 * Devolve os pedaços (2 ou mais), ou null se a linha não atravessar a quadra.
 */
export function dividirQuadra(geometria, pontosDaLinha, larguraMetros = 2) {
  const faixa = turf.buffer(turf.lineString(pontosDaLinha), larguraMetros / 2, { units: 'meters', steps: 4 });
  const resto = turf.difference(turf.featureCollection([turf.feature(geometria), faixa]));
  if (!resto) return null;
  const pedacos = turf.flatten(resto).features.filter((f) => turf.area(f) >= 20);
  return pedacos.length >= 2 ? pedacos.map((f) => ({ geometria: f.geometry, areaM2: Math.round(turf.area(f)) })) : null;
}

/** Um ponto garantidamente dentro da quadra, para pôr o número. [lat, lng] */
export function pontoDoNumero(geometria) {
  const [lng, lat] = turf.pointOnFeature(turf.feature(geometria)).geometry.coordinates;
  return [lat, lng];
}

/** Área em m² de uma geometria GeoJSON. */
export function areaM2(geometria) {
  return Math.round(turf.area(turf.feature(geometria)));
}

/** Caixa [oeste, sul, leste, norte] do contorno, com uma margem em metros. */
export function caixaComMargem(geometria, margemMetros = 40) {
  return turf.bbox(turf.buffer(turf.feature(geometria), margemMetros, { units: 'meters' }));
}

/** Renumera uma lista de quadras (depois de apagar ou juntar). */
export function renumerar(quadras) {
  const comCentro = quadras.map((q) => ({ ...q, centro: turf.centroid(turf.feature(q.geometria)).geometry.coordinates }));
  return numerar(comCentro).map(({ centro, ...q }, i) => ({ ...q, numero: i + 1 }));
}

/** true se o contorno tem área de verdade (evita salvar/mostrar um contorno vazio, sem pontos). */
export function contornoValido(geometria) {
  try {
    if (!geometria || !['Polygon', 'MultiPolygon'].includes(geometria.type)) return false;
    const aneis = geometria.type === 'Polygon' ? [geometria.coordinates[0]] : geometria.coordinates.map((p) => p[0]);
    if (!aneis.some((a) => Array.isArray(a) && a.length >= 4)) return false;
    return turf.area(turf.feature(geometria)) > 1;
  } catch {
    return false;
  }
}
