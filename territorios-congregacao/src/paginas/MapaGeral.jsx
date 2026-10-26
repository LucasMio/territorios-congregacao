// Mapa geral: todos os territórios desenhados juntos, cada um com sua cor e número.
// Os que ainda não foram desenhados aparecem como um círculo cinza tracejado no ponto do Google Maps,
// para enxergar onde faltam territórios.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GeoJSON, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import L from '../lib/leaflet-global.js';
import { contornoValido, pontoDoNumero } from '../lib/quadras.js';
import { areasSemTerritorio } from '../lib/limite.js';
import Desenho from '../componentes/Desenho.jsx';
import { SITUACOES, descreverTempo, formatarData, situacaoDoTerritorio } from '../lib/situacao.js';
import Abas from '../componentes/Abas.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import Mapa, { OndeEstou } from '../componentes/Mapa.jsx';

// Mesmas cores da legenda da planilha (fortes o bastante para o número branco em cima).
const COR_SITUACAO = { recente: '#1d6b40', atencao: '#a86400', urgente: '#a32617', sem_data: '#4b5563' };
const CORES_GRUPO = ['#1f5fbf', '#b5179e', '#0f7b6c', '#c2410c', '#6d28d9', '#a16207', '#be123c', '#0e7490'];

/** Cor própria de cada território: tons espalhados pelo "ângulo de ouro", vizinhos ficam bem diferentes. */
export const corDoTerritorio = (numero) => `hsl(${Math.round((numero * 137.508) % 360)} 70% 38%)`;

const MODOS = {
  territorio: 'Cada território uma cor',
  grupo: 'Por grupo',
  situacao: 'Por situação (tempo sem trabalhar)',
  andamento: 'Por andamento (volta atual)',
};

// Andamento da volta atual: um só tom (verde), do claro (pouco feito) ao escuro (quase pronto).
// Os dois tons claros usam número escuro por cima, para ter contraste.
export const FAIXAS_ANDAMENTO = [
  { ate: 0, cor: '#9ca3af', rotulo: 'Nada feito na volta atual', textoEscuro: true },
  { ate: 24, cor: '#b7e1b0', rotulo: '1% a 24% das quadras', textoEscuro: true },
  { ate: 49, cor: '#6cc06a', rotulo: '25% a 49%', textoEscuro: true },
  { ate: 74, cor: '#277a3c', rotulo: '50% a 74%' },
  { ate: 99, cor: '#135c2a', rotulo: '75% a 99%' },
];
export const faixaDoAndamento = (feitas, total) => {
  const pct = total ? Math.floor((feitas / total) * 100) : 0;
  return FAIXAS_ANDAMENTO.find((f) => pct <= f.ate) ?? FAIXAS_ANDAMENTO.at(-1);
};

const rotulo = (numero, cor, faltaDesenhar, textoEscuro = false) =>
  L.divIcon({
    className: `rotulo-territorio${faltaDesenhar ? ' falta' : ''}${textoEscuro ? ' texto-escuro' : ''}`,
    html: `<span style="--cor:${cor}">${numero}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

/** Enquadra todos os territórios na primeira vez. */
function EnquadrarTodos({ territorios }) {
  const mapa = useMap();
  const [feito, setFeito] = useState(false);
  useEffect(() => {
    if (feito || !territorios.length) return;
    const grupo = L.featureGroup(
      territorios.map((t) => (t.contorno ? L.geoJSON(t.contorno) : L.marker([t.lat, t.lng]))),
    );
    const limites = grupo.getBounds();
    if (limites.isValid()) mapa.fitBounds(limites, { padding: [10, 10] });
    setFeito(true);
  }, [territorios, mapa, feito]);
  return null;
}

/** Números menores quando o mapa está longe, para não ficarem uns em cima dos outros. */
function TamanhoDosNumeros() {
  const mapa = useMapEvents({ zoomend: () => ajustar() });
  const ajustar = () => {
    const z = mapa.getZoom();
    const c = mapa.getContainer().classList;
    c.toggle('rotulos-pequenos', z <= 15);
    c.toggle('rotulos-mini', z <= 14);
  };
  useEffect(ajustar, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function MapaGeral() {
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const [territorios, setTerritorios] = useState(null);
  const [erro, setErro] = useState('');
  const [modo, setModo] = useState('territorio');
  const [mostrarFaltando, setMostrarFaltando] = useState(true);
  const [progresso, setProgresso] = useState({});
  const [limite, setLimite] = useState(null);
  const [mostrarLimite, setMostrarLimite] = useState(true);
  const [mostrarVazios, setMostrarVazios] = useState(false);
  const [infoLimite, setInfoLimite] = useState(null);
  const [ajustandoLimite, setAjustandoLimite] = useState(false);
  const [avisoLimite, setAvisoLimite] = useState('');
  const lerLimiteAjustado = useRef(null);
  const registrarAjuste = useCallback((f) => { lerLimiteAjustado.current = f; }, []);

  async function salvarLimite() {
    const geo = lerLimiteAjustado.current?.();
    if (!geo) return setAvisoLimite('O limite ficou incompleto. Ajuste de novo ou toque em Cancelar.');
    const { error } = await supabase.rpc('salvar_limite_congregacao', { p_geometria: geo });
    if (error) return setAvisoLimite(`Não foi possível salvar: ${error.message}`);
    setLimite({ type: 'Feature', properties: {}, geometry: geo });
    setInfoLimite({ atualizado_em: new Date().toISOString(), atualizado_por: perfil.nome });
    setAjustandoLimite(false);
    setAvisoLimite('Limite salvo. Todos já veem a linha nova.');
  }

  useEffect(() => {
    supabase
      .from('territorios')
      .select('numero, bairro, grupo, ultima_data, contorno, lat, lng')
      .order('numero')
      .then(({ data, error }) =>
        error ? setErro(error.message) : setTerritorios(data.map((t) => ({ ...t, contorno: contornoValido(t.contorno) ? t.contorno : null }))),
      );
    supabase
      .from('progresso_territorios')
      .select('numero, total_quadras, feitas_no_ciclo')
      .then(({ data }) => setProgresso(Object.fromEntries((data ?? []).map((p) => [p.numero, p]))));
    // Limite geral da congregação: guardado no banco (o master pode ajustar); se faltar, usa o traçado inicial.
    supabase.from('limite_congregacao').select('geometria, atualizado_em, atualizado_por').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) {
        setLimite({ type: 'Feature', properties: {}, geometry: data.geometria });
        setInfoLimite(data);
      } else {
        fetch('/limite-congregacao.geojson').then((x) => (x.ok ? x.json() : null)).then(setLimite, () => setLimite(null));
      }
    });
  }, []);

  const grupos = useMemo(() => [...new Set((territorios ?? []).map((t) => t.grupo ?? 'Sem grupo'))].sort(), [territorios]);
  const corDoGrupo = (g) => CORES_GRUPO[grupos.indexOf(g ?? 'Sem grupo') % CORES_GRUPO.length];
  const andamentoDe = (t) => faixaDoAndamento(progresso[t.numero]?.feitas_no_ciclo ?? 0, progresso[t.numero]?.total_quadras ?? 0);
  const corDe = (t) =>
    modo === 'andamento' ? andamentoDe(t).cor : modo === 'grupo' ? corDoGrupo(t.grupo) : modo === 'situacao' ? COR_SITUACAO[situacaoDoTerritorio(t.ultima_data)] : corDoTerritorio(t.numero);

  const desenhados = (territorios ?? []).filter((t) => t.contorno);
  const faltando = (territorios ?? []).filter((t) => !t.contorno);
  const visiveis = [...desenhados, ...(mostrarFaltando ? faltando.filter((t) => t.lat != null) : [])];
  const analise = useMemo(() => (limite && territorios ? areasSemTerritorio(limite, desenhados.map((t) => t.contorno)) : null), [limite, territorios]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pagina larga">
      <BarraTopo />
      <Abas />
      <main id="conteudo" className="layout-mapa-geral">
        <div className="coluna-lateral">
          <div className="o1">
            <h1>Mapa geral</h1>
            {territorios && (
              <p className="dica">
                <strong>{desenhados.length}</strong> {desenhados.length === 1 ? 'desenhado' : 'desenhados'} · <strong>{faltando.length}</strong> sem desenho
              </p>
            )}
          </div>

          <div className="cartao o3">
            <div className="campo">
              <label htmlFor="modo-cor">Colorir</label>
              <select id="modo-cor" value={modo} onChange={(e) => setModo(e.target.value)}>
                {Object.entries(MODOS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <label className="caixa-marcar">
              <input type="checkbox" checked={mostrarFaltando} onChange={(e) => setMostrarFaltando(e.target.checked)} />
              Mostrar os que faltam desenhar (círculo cinza tracejado)
            </label>
            {limite && (
              <label className="caixa-marcar">
                <input type="checkbox" checked={mostrarLimite} onChange={(e) => setMostrarLimite(e.target.checked)} />
                Mostrar o limite da congregação (linha amarela)
              </label>
            )}
            {perfil.master && limite && (
              <div className="ajuste-limite">
                {!ajustandoLimite ? (
                  <button className="secundario pequeno" onClick={() => { setAjustandoLimite(true); setMostrarLimite(true); setAvisoLimite(''); }}>
                    <Icone nome="lapis" tamanho={18} /> Ajustar o limite
                  </button>
                ) : (
                  <>
                    <p className="dica sem-margem">
                      <strong>Arraste os pontos</strong> da linha vermelha para o lugar certo. Para <strong>criar um ponto</strong>, arraste o pontinho do meio de um lado.
                      Para <strong>apagar um ponto</strong>, clique nele com o botão direito (no celular, toque e segure).
                    </p>
                    <div className="linha-botoes">
                      <button className="verde pequeno" onClick={salvarLimite}><Icone nome="check" tamanho={18} /> Salvar limite</button>
                      <button className="secundario pequeno" onClick={() => { setAjustandoLimite(false); setAvisoLimite(''); }}>Cancelar</button>
                    </div>
                  </>
                )}
                {infoLimite?.atualizado_por && <p className="dica sem-margem">Última alteração: {infoLimite.atualizado_por}, {new Date(infoLimite.atualizado_em).toLocaleDateString('pt-BR')}</p>}
                <Aviso>{avisoLimite}</Aviso>
              </div>
            )}
            {admin && analise && (
              <>
                <label className="caixa-marcar">
                  <input type="checkbox" checked={mostrarVazios} onChange={(e) => setMostrarVazios(e.target.checked)} />
                  Destacar áreas dentro do limite sem território desenhado (vermelho)
                </label>
                <p className="dica">
                  Os territórios desenhados cobrem <strong>{analise.porcentagem}%</strong> da área dentro do limite
                  ({analise.km2Cobertos} de {analise.km2Limite} km²). O limite foi traçado a partir da imagem da planilha e pode ter
                  diferença de algumas dezenas de metros.
                </p>
              </>
            )}

            {modo !== 'territorio' && (
              <ul className="legenda-cores" aria-label="Legenda das cores">
                {modo === 'grupo' &&
                  grupos.map((g) => (
                    <li key={g}><span className="amostra" style={{ background: corDoGrupo(g) }} /> {g}</li>
                  ))}
                {modo === 'andamento' &&
                  FAIXAS_ANDAMENTO.map((f) => (
                    <li key={f.ate}><span className="amostra" style={{ background: f.cor }} /> {f.rotulo}</li>
                  ))}
                {modo === 'situacao' &&
                  Object.entries(SITUACOES).map(([k, s]) => (
                    <li key={k}><span className="amostra" style={{ background: COR_SITUACAO[k] }} /> <Icone nome={s.icone} tamanho={16} /> {s.rotulo}</li>
                  ))}
              </ul>
            )}
          </div>

          {admin && faltando.length > 0 && (
            <div className="cartao o5">
              <h2><Icone nome="lapis" /> Faltam desenhar ({faltando.length})</h2>
              <p className="dica">Toque no número para abrir e desenhar.</p>
              <ul className="numeros-faltando">
                {faltando.map((t) => (
                  <li key={t.numero}>
                    <Link to={`/territorio/${t.numero}/mapa`} title={t.bairro} aria-label={`Desenhar território ${t.numero}, ${t.bairro}`}>{t.numero}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="coluna-mapa o4">
          <Aviso tipo="erro">{erro && `Não foi possível carregar: ${erro}`}</Aviso>
          {!territorios && !erro && <Esqueleto rotulo="Carregando os territórios…" tipo="lista" quantos={2} />}
          <Mapa zoom={14}>
            {territorios && <EnquadrarTodos territorios={visiveis} />}
            <TamanhoDosNumeros />
            {visiveis.map((t) => {
              const cor = corDe(t);
              const s = SITUACOES[situacaoDoTerritorio(t.ultima_data)];
              const pos = t.contorno ? pontoDoNumero(t.contorno) : [t.lat, t.lng];
              const popup = (
                <Popup>
                  <strong>Território {t.numero}</strong>
                  <br />
                  {t.bairro}
                  <br />
                  {t.grupo ?? 'Sem grupo'} · {s.rotulo}
                  {progresso[t.numero]?.total_quadras > 0 && (
                    <>
                      <br />
                      Volta atual: {progresso[t.numero].feitas_no_ciclo} de {progresso[t.numero].total_quadras} quadras feitas
                    </>
                  )}
                  <br />
                  {t.ultima_data ? `Concluído em ${formatarData(t.ultima_data)} (${descreverTempo(t.ultima_data)})` : 'Sem data de conclusão'}
                  {!t.contorno && (
                    <>
                      <br />
                      <em>Mapa ainda não desenhado</em>
                    </>
                  )}
                  <br />
                  <Link to={`/territorio/${t.numero}`}>Abrir o território</Link>
                  {admin && !t.contorno && <> · <Link to={`/territorio/${t.numero}/mapa`}>Desenhar</Link></>}
                </Popup>
              );
              return (
                <span key={`${t.numero}-${modo}-${cor}`}>
                  {t.contorno && (
                    <GeoJSON data={t.contorno} style={{ color: cor, weight: 3, fillColor: cor, fillOpacity: 0.28 }}>
                      {popup}
                    </GeoJSON>
                  )}
                  <Marker position={pos} icon={rotulo(t.numero, t.contorno ? cor : '#6b7280', !t.contorno, modo === 'andamento' && t.contorno && andamentoDe(t).textoEscuro)} title={`Território ${t.numero}`}>
                    {popup}
                  </Marker>
                </span>
              );
            })}
            {ajustandoLimite && <Desenho modo="ajustar" contorno={limite.geometry} registrarAjuste={registrarAjuste} />}
            {mostrarLimite && limite && !ajustandoLimite && <GeoJSON key={`limite-${JSON.stringify(limite.geometry).length}`} data={limite} style={{ color: '#d4a106', weight: 5, dashArray: '10 6', fill: false }} interactive={false} />}
            {admin && mostrarVazios && analise && !ajustandoLimite && <GeoJSON key={`vazios-${analise.porcentagem}`} data={analise.vazios} style={{ color: '#b91c1c', weight: 1, fillColor: '#ef4444', fillOpacity: 0.3 }} interactive={false} />}
            <OndeEstou />
          </Mapa>
          <p className="legenda-mapa">
            <span><span className="amostra" style={{ background: 'rgb(31 95 191 / 30%)', border: '3px solid #1f5fbf' }} /> Território desenhado (número no meio)</span>
            <span><span className="amostra pendente" style={{ borderRadius: '50%' }} /> Falta desenhar</span>
          </p>
        </div>
      </main>
    </div>
  );
}
