// Mapa base (OpenStreetMap) e camadas do território: contorno e quadras numeradas.
import { useEffect } from 'react';
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from '../lib/leaflet-global.js';
import { pontoDoNumero } from '../lib/quadras.js';

// Centro de Cidade Exemplo, para quando o território ainda não tem posição.
export const CENTRO_PADRAO = [-16.4615, -54.6111];

export default function Mapa({ centro, zoom = 17, children }) {
  return (
    <MapContainer center={centro ?? CENTRO_PADRAO} zoom={zoom} maxZoom={20} className="mapa" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxNativeZoom={19}
        maxZoom={20}
      />
      {children}
    </MapContainer>
  );
}

/** Enquadra o mapa no contorno (quando ele muda). */
export function Enquadrar({ geometria }) {
  const mapa = useMap();
  useEffect(() => {
    if (!geometria) return;
    const limites = L.geoJSON(geometria).getBounds();
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [24, 24] });
  }, [geometria, mapa]);
  return null;
}

export function Contorno({ geometria }) {
  if (!geometria) return null;
  return <GeoJSON key={JSON.stringify(geometria).length + geometria.type} data={geometria} style={{ color: '#c0392b', weight: 3, dashArray: '8 6', fill: false }} interactive={false} />;
}

const iconeNumero = (numero, classe) =>
  L.divIcon({ className: `rotulo-quadra ${classe}`, html: String(numero), iconSize: [30, 30], iconAnchor: [15, 15] });

/**
 * @param {{numero:number, geometria:object}[]} quadras
 * @param {(numero:number)=>string} [corDe]        cor de preenchimento de cada quadra
 * @param {Set<number>} [selecionadas]
 * @param {(numero:number)=>void} [aoClicar]
 * @param {(numero:number)=>boolean} [feitaDe]  quadra feita: borda contínua e número verde;
 *        pendente: borda tracejada. Assim a diferença não depende só da cor (daltonismo).
 * @param {(numero:number)=>string} [dicaDe]  texto que aparece ao passar o mouse (computador)
 */
export function Quadras({ quadras, corDe = () => '#2e5fa3', selecionadas = new Set(), aoClicar, feitaDe, dicaDe }) {
  return quadras.map((q) => {
    const marcada = selecionadas.has(q.numero);
    const feita = feitaDe?.(q.numero);
    const pendente = feitaDe && !feita;
    const estilo = marcada
      ? { color: '#111', weight: 3, fillColor: '#ffb703', fillOpacity: 0.75 }
      : { color: pendente ? '#4b5563' : '#1f3864', weight: pendente ? 2 : feita ? 3 : 1, dashArray: pendente ? '6 5' : null, fillColor: corDe(q.numero), fillOpacity: feita ? 0.55 : pendente ? 0.25 : 0.45 };
    return (
      <span key={`${q.numero}-${marcada}-${feita}-${corDe(q.numero)}-${dicaDe?.(q.numero) ?? ''}-${JSON.stringify(q.geometria).length}`}>
        <GeoJSON data={q.geometria} style={estilo} eventHandlers={aoClicar ? { click: () => aoClicar(q.numero) } : undefined}>
          {dicaDe && <Tooltip sticky>{dicaDe(q.numero)}</Tooltip>}
        </GeoJSON>
        <Marker position={pontoDoNumero(q.geometria)} icon={iconeNumero(q.numero, marcada ? 'destaque' : feita ? 'feita' : '')} interactive={false} />
      </span>
    );
  });
}

const ROTULO_ONDE_ESTOU =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Onde estou';

/** Botão "Onde estou": mostra a posição do celular no mapa. */
export function OndeEstou() {
  const mapa = useMap();
  useEffect(() => {
    let marcador = null;
    const Controle = L.Control.extend({
      onAdd() {
        const botao = L.DomUtil.create('button', 'botao-onde-estou');
        botao.type = 'button';
        botao.setAttribute('aria-label', 'Mostrar onde estou no mapa');
        botao.innerHTML = ROTULO_ONDE_ESTOU;
        L.DomEvent.disableClickPropagation(botao);
        botao.onclick = () => {
          botao.textContent = 'Localizando…';
          mapa.locate({ setView: true, maxZoom: 18, enableHighAccuracy: true });
        };
        mapa.on('locationfound', (e) => {
          botao.innerHTML = ROTULO_ONDE_ESTOU;
          if (marcador) marcador.remove();
          marcador = L.layerGroup([
            L.circle(e.latlng, { radius: e.accuracy, color: '#2e5fa3', weight: 1, fillOpacity: 0.1 }),
            L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#2e5fa3', fillOpacity: 1 }),
          ]).addTo(mapa);
        });
        mapa.on('locationerror', () => {
          botao.innerHTML = ROTULO_ONDE_ESTOU;
          window.alert('Não foi possível pegar sua localização. Confira se o GPS está ligado e se o navegador tem permissão.');
        });
        return botao;
      },
    });
    const controle = new Controle({ position: 'topright' });
    controle.addTo(mapa);
    return () => {
      controle.remove();
      marcador?.remove();
      mapa.off('locationfound').off('locationerror');
    };
  }, [mapa]);
  return null;
}
