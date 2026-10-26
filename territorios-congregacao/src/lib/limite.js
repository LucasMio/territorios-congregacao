// Compara o limite geral da congregação com os territórios desenhados: quanto da área está coberta
// e onde ficam as áreas sem território (para saber o que falta desenhar ou criar).
import * as turf from '@turf/turf';

export function areasSemTerritorio(limite, contornos, areaMinimaM2 = 20000) {
  let uniao = null;
  for (const c of contornos) {
    const f = turf.feature(c);
    uniao = uniao ? turf.union(turf.featureCollection([uniao, f])) ?? uniao : f;
  }
  const areaLimite = turf.area(limite);
  const coberto = uniao ? turf.intersect(turf.featureCollection([limite, uniao])) : null;
  const vazio = uniao ? turf.difference(turf.featureCollection([limite, uniao])) : limite;
  // Tira lascas pequenas (sobras entre um território e outro).
  const partes = !vazio ? [] : vazio.geometry.type === 'MultiPolygon' ? vazio.geometry.coordinates : [vazio.geometry.coordinates];
  const grandes = partes.map((p) => turf.polygon(p)).filter((p) => turf.area(p) >= areaMinimaM2);
  const areaCoberta = coberto ? turf.area(coberto) : 0;
  return {
    porcentagem: Math.round((areaCoberta / areaLimite) * 100),
    km2Limite: (areaLimite / 1e6).toFixed(1).replace('.', ','),
    km2Cobertos: (areaCoberta / 1e6).toFixed(1).replace('.', ','),
    vazios: turf.featureCollection(grandes),
  };
}
