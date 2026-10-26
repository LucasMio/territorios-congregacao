// Ferramentas de desenho no mapa (geoman): desenhar contorno, ajustar os pontos dele
// e desenhar uma linha para dividir uma quadra.
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from '../lib/leaflet-global.js';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import { contornoValido } from '../lib/quadras.js';

/**
 * @param {'nenhum'|'contorno'|'ajustar'|'linha'} modo
 * @param {object|null} contorno            contorno atual (para o modo "ajustar")
 * @param {(geo:object)=>void} aoTerminarContorno
 * @param {(pontos:Array<[number,number]>)=>void} aoTerminarLinha
 * @param {(ajustado:() => object|null)=>void} registrarAjuste  recebe uma função que lê o contorno ajustado
 */
export default function Desenho({ modo, contorno, aoTerminarContorno, aoTerminarLinha, registrarAjuste }) {
  const mapa = useMap();

  useEffect(() => {
    mapa.pm.setLang('pt_br');
    mapa.pm.setGlobalOptions({ snappable: true, snapDistance: 15, allowSelfIntersection: false });
  }, [mapa]);

  useEffect(() => {
    if (modo !== 'contorno' && modo !== 'linha') return undefined;
    const tipo = modo === 'contorno' ? 'Polygon' : 'Line';
    mapa.pm.enableDraw(tipo, { finishOn: modo === 'linha' ? 'dblclick' : null, templineStyle: { color: '#c0392b' }, hintlineStyle: { color: '#c0392b', dashArray: '5 5' } });
    const aoCriar = (e) => {
      const geo = e.layer.toGeoJSON().geometry;
      mapa.removeLayer(e.layer);
      if (modo === 'contorno') aoTerminarContorno(geo);
      else aoTerminarLinha(geo.coordinates);
    };
    mapa.on('pm:create', aoCriar);
    return () => {
      mapa.off('pm:create', aoCriar);
      mapa.pm.disableDraw();
    };
  }, [modo, mapa, aoTerminarContorno, aoTerminarLinha]);

  // Ajustar: o contorno vira uma camada com os pontos arrastáveis.
  useEffect(() => {
    if (modo !== 'ajustar' || !contorno) return undefined;
    const camada = L.geoJSON(contorno, { style: { color: '#c0392b', weight: 3 } }).addTo(mapa);
    camada.eachLayer((l) => l.pm.enable({ allowSelfIntersection: false }));
    registrarAjuste(() => {
      const geo = camada.toGeoJSON().features[0]?.geometry ?? null;
      return contornoValido(geo) ? geo : null; // tirou todos os pontos? ignora
    });
    return () => {
      camada.eachLayer((l) => l.pm.disable());
      mapa.removeLayer(camada);
      registrarAjuste(null);
    };
  }, [modo, contorno, mapa, registrarAjuste]);

  return null;
}
