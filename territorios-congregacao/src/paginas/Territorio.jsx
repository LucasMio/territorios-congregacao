import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import SaidasDoTerritorio from '../componentes/SaidasDoTerritorio.jsx';
import HistoricoTerritorio from '../componentes/HistoricoTerritorio.jsx';
import ConcluirAMao from '../componentes/ConcluirAMao.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import Mapa, { Contorno, Enquadrar, OndeEstou, Quadras } from '../componentes/Mapa.jsx';
import { useMouse, useTelaGrande } from '../lib/tela.js';
import { contornoValido, pontoDoNumero } from '../lib/quadras.js';
import { ehErroDeRede, guardarNaFila, lerFila, tirarDaFila } from '../lib/filaOffline.js';
import { SITUACOES, descreverTempo, formatarData, hojeLocal, situacaoDoTerritorio, somarDias } from '../lib/situacao.js';

const COR_FEITA = '#1d6b40';
const COR_PENDENTE = '#9aa5b1';

export default function Territorio() {
  const { numero } = useParams();
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const [t, setT] = useState(null);
  const [quadras, setQuadras] = useState([]);
  const [marcacoes, setMarcacoes] = useState([]); // do ciclo atual
  const [erro, setErro] = useState('');
  const [marcando, setMarcando] = useState(false);
  const [dataTrabalho, setDataTrabalho] = useState(hojeLocal());
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(null);
  const [marcadasAgora, setMarcadasAgora] = useState(0);
  const secaoMapa = useRef(null);
  const carregado = useRef(false);
  const [fila, setFila] = useState(() => lerFila());
  const mouse = useMouse();
  const telaGrande = useTelaGrande();

  const carregar = useCallback(async () => {
    const { data: territorio, error } = await supabase.from('territorios').select('*').eq('numero', Number(numero)).maybeSingle();
    if (error) {
      // Sem internet com a página já aberta: segue funcionando e guarda as marcações no celular.
      if (ehErroDeRede(error) && carregado.current) return setAviso('Sem internet agora. O que você marcar fica guardado no celular.');
      return setErro(ehErroDeRede(error) ? 'Sem internet. Abra este território uma vez com sinal; depois ele abre e marca mesmo sem internet.' : error.message);
    }
    if (!territorio) return setErro(admin ? 'Território não encontrado.' : 'Este território não está em nenhuma saída sua. Veja os seus dias na Programação.');
    const [{ data: qs }, { data: ms }] = await Promise.all([
      supabase.from('quadras').select('id, numero, geometria').eq('territorio_numero', territorio.numero).order('numero'),
      supabase
        .from('marcacoes')
        .select('id, quadra_id, data, dirigente_id, dirigente_nome, criada_em')
        .eq('territorio_numero', territorio.numero)
        .eq('ciclo', territorio.ciclo_atual),
    ]);
    if (!contornoValido(territorio.contorno)) territorio.contorno = null;
    carregado.current = true;
    setT(territorio);
    setQuadras(qs ?? []);
    setMarcacoes(ms ?? []);
    return territorio;
  }, [numero, admin]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Marcações guardadas sem internet: atualiza a tela quando a fila muda ou quando forem enviadas.
  useEffect(() => {
    const mudou = () => setFila(lerFila());
    const enviadas = () => { mudou(); carregar(); };
    window.addEventListener('fila-marcacoes', mudou);
    window.addEventListener('marcacoes-enviadas', enviadas);
    return () => {
      window.removeEventListener('fila-marcacoes', mudou);
      window.removeEventListener('marcacoes-enviadas', enviadas);
    };
  }, [carregar]);

  // Computador: a tecla Esc termina a marcação.
  useEffect(() => {
    if (!marcando) return;
    const tecla = (e) => e.key === 'Escape' && setMarcando(false);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [marcando]);

  const voltar = { voltarPara: '/territorios', voltarRotulo: admin ? 'Territórios' : 'Meus territórios' };
  if (erro) {
    return (
      <div className="pagina">
        <BarraTopo {...voltar} />
        <main><Aviso tipo="erro">{erro}</Aviso></main>
      </div>
    );
  }
  if (!t) {
    return (
      <div className="pagina">
        <BarraTopo {...voltar} />
        <main><h1 className="so-leitor">Território {numero}</h1><Esqueleto rotulo="Carregando o território…" tipo="territorio" /></main>
      </div>
    );
  }

  const s = SITUACOES[situacaoDoTerritorio(t.ultima_data)];
  const hoje = hojeLocal();
  const marcacaoDa = (quadraId) => marcacoes.filter((m) => m.quadra_id === quadraId).sort((a, b) => b.data.localeCompare(a.data))[0];
  const quadraPorNumero = (n) => quadras.find((q) => q.numero === n);
  const pendente = (quadraId) => fila.find((x) => x.quadra_id === quadraId && x.usuario === perfil.id);
  const feitaDe = (n) => {
    const id = quadraPorNumero(n)?.id;
    return Boolean(marcacaoDa(id) || pendente(id));
  };
  const feitas = quadras.filter((q) => marcacaoDa(q.id)).length;
  const dicaDaQuadra = (n) => {
    const m = marcacaoDa(quadraPorNumero(n)?.id);
    return m ? `Quadra ${n}: feita em ${formatarData(m.data)} por ${m.dirigente_nome ?? 'um dirigente'}` : `Quadra ${n}: falta fazer`;
  };
  // "Como chegar" leva à primeira quadra (menor número) que ainda falta fazer neste ciclo.
  const proximaQuadra = quadras.find((q) => !feitaDe(q.numero));
  const rotaAte = (q) => {
    const [lat, lng] = pontoDoNumero(q.geometria);
    return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
  };
  const porcento = quadras.length ? Math.round((feitas / quadras.length) * 100) : 0;

  function comecarMarcacao() {
    setMarcando(true);
    setAviso('');
    setConcluido(null);
    setMarcadasAgora(0);
    if (!telaGrande) secaoMapa.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function terminarMarcacao() {
    setMarcando(false);
    setAviso(marcadasAgora > 0 ? `Pronto! ${marcadasAgora} ${marcadasAgora === 1 ? 'quadra marcada' : 'quadras marcadas'}. Obrigado!` : '');
  }

  async function tocarQuadra(n) {
    const q = quadraPorNumero(n);
    if (!q) return;
    const m = marcacaoDa(q.id);

    const p = pendente(q.id);
    if (!marcando) {
      if (p) return setAviso(`Quadra ${n}: guardada no celular, esperando a internet para enviar.`);
      setAviso(
        m
          ? `Quadra ${n}: feita em ${formatarData(m.data)} por ${m.dirigente_nome ?? 'um dirigente'}.`
          : `Quadra ${n}: ainda não feita nesta volta. Para marcar, toque em "Marcar quadras trabalhadas".`,
      );
      return;
    }

    if (p) {
      tirarDaFila(q.id, perfil.id);
      setMarcadasAgora((x) => Math.max(0, x - 1));
      return setAviso(`Quadra ${n} desmarcada (ainda não tinha sido enviada).`);
    }

    const guardarSemInternet = () => {
      guardarNaFila({ quadra_id: q.id, territorio_numero: t.numero, data: dataTrabalho, usuario: perfil.id });
      setMarcadasAgora((x) => x + 1);
      setAviso(`Sem internet: a quadra ${n} ficou guardada no celular e será enviada sozinha quando o sinal voltar.`);
    };

    setSalvando(true);
    setAviso('');
    if (m) {
      // Mesma regra do banco: o próprio dirigente no dia em que marcou, ou o administrador.
      const podeDesmarcar = admin || (m.dirigente_id === perfil.id && hojeLocal(new Date(m.criada_em)) === hoje);
      if (!podeDesmarcar) {
        setSalvando(false);
        return setAviso(`A quadra ${n} foi marcada por ${m.dirigente_nome} em ${formatarData(m.data)}. Só ele (no mesmo dia) ou um administrador pode desmarcar.`);
      }
      const { error } = await supabase.from('marcacoes').delete().eq('id', m.id);
      if (error) setAviso(ehErroDeRede(error) ? 'Sem internet: para desmarcar, tente de novo quando o sinal voltar.' : `Não foi possível desmarcar: ${error.message}`);
      else {
        setAviso(`Quadra ${n} desmarcada.`);
        setMarcadasAgora((x) => Math.max(0, x - 1));
      }
      await carregar();
    } else if (!navigator.onLine) {
      guardarSemInternet();
    } else {
      const { error } = await supabase.from('marcacoes').insert({ quadra_id: q.id, territorio_numero: t.numero, data: dataTrabalho });
      if (error && ehErroDeRede(error)) {
        guardarSemInternet();
      } else if (error) {
        setAviso(`Não foi possível marcar: ${/fetch|network/i.test(error.message) ? 'sem conexão com a internet. Tente de novo.' : error.message}`);
        await carregar();
      } else {
        setMarcadasAgora((x) => x + 1);
        const antes = t.ciclo_atual;
        const atualizado = await carregar();
        if (atualizado && atualizado.ciclo_atual !== antes) {
          setConcluido(atualizado.ultima_data);
          setMarcando(false);
        } else {
          setAviso(`Quadra ${n} marcada como feita em ${formatarData(dataTrabalho)}.`);
        }
      }
    }
    setSalvando(false);
  }

  const verbo = mouse ? 'Clique' : 'Toque';

  const painelMarcacao = marcando && (
    <div className="painel-marcacao o5" role="region" aria-label="Marcação de quadras">
      <p className="titulo-painel"><Icone nome="check" /> {verbo} nas quadras trabalhadas</p>
      <p className="dica sem-margem">{mouse ? 'Clicou' : 'Tocou'} errado? {verbo} de novo para desmarcar.{mouse ? ' A tecla Esc termina.' : ''}</p>
      <div className="linha-painel">
        <div className="campo">
          <label htmlFor="data-trabalho">Dia do trabalho</label>
          <input id="data-trabalho" type="date" value={dataTrabalho} min={somarDias(hoje, -7)} max={hoje} onChange={(e) => setDataTrabalho(e.target.value || hoje)} />
        </div>
        <button onClick={terminarMarcacao}><Icone nome="check" /> Terminei</button>
      </div>
      <span className="dica" role="status">
        {marcadasAgora > 0 ? <><strong>{marcadasAgora}</strong> {marcadasAgora === 1 ? 'quadra marcada' : 'quadras marcadas'} agora · </> : null}
        {feitas} de {quadras.length} feitas nesta volta
      </span>
    </div>
  );

  return (
    <div className="pagina larga">
      <BarraTopo {...voltar} />
      <main id="conteudo" className="layout-territorio">
        <div className="coluna-lateral">
          <div className={`cartao cabecalho-territorio o1 ${s.classe}`}>
            <span className="numero grande" aria-hidden="true">{t.numero}</span>
            <div>
              <h1><span className="so-leitor">Território {t.numero}: </span>{t.bairro}</h1>
              <p><Icone nome="grupo" tamanho={16} /> {t.grupo ?? 'Sem grupo'}</p>
              <span className="etiqueta"><Icone nome={s.icone} tamanho={16} /> {s.rotulo}</span>
            </div>
          </div>

          <div className="o2">
            <Aviso tipo="sucesso">
              {concluido && `Território concluído em ${formatarData(concluido)}! Todas as quadras foram feitas. Agora começa uma volta nova.`}
            </Aviso>
          </div>

          {quadras.length > 0 && !marcando && (
            <div className="acao-principal o3">
              <button className="verde" onClick={comecarMarcacao}><Icone nome="check" /> Marcar quadras trabalhadas</button>
            </div>
          )}

          {painelMarcacao}

          <section className="cartao o6" aria-labelledby="titulo-situacao">
            <h2 id="titulo-situacao"><Icone nome="calendario" /> Situação</h2>
            <div className="resumo">
              <div>
                <div className="rotulo">Última vez concluído</div>
                <div className="valor">{t.ultima_data ? `${formatarData(t.ultima_data)} (${descreverTempo(t.ultima_data)})` : 'Sem registro'}</div>
              </div>
              {quadras.length > 0 && (
                <div>
                  <div className="rotulo">Volta atual</div>
                  <div className="valor">{feitas} de {quadras.length} quadras feitas ({porcento}%)</div>
                  <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={quadras.length} aria-valuenow={feitas} aria-label="Quadras feitas na volta atual">
                    <span style={{ width: `${porcento}%` }} />
                  </div>
                </div>
              )}
              {t.observacoes && (
                <div>
                  <div className="rotulo">Observações</div>
                  <div>{t.observacoes}</div>
                </div>
              )}
            </div>
            {admin && !marcando && (
              <div className="concluir-a-mao">
                <ConcluirAMao
                  territorio={t}
                  faltam={quadras.length - feitas}
                  aoConcluir={async (data) => {
                    await carregar();
                    setConcluido(data);
                  }}
                />
              </div>
            )}
          </section>

          {(t.link_localizacao || t.link_mapa || proximaQuadra) && (
            <nav className="acoes cartao o7" aria-label="Links do território">
              {proximaQuadra ? (
                <a className="botao" href={rotaAte(proximaQuadra)} target="_blank" rel="noreferrer">
                  <Icone nome="rota" /> Como chegar à quadra {proximaQuadra.numero}
                </a>
              ) : (
                t.link_localizacao && <a className="botao" href={t.link_localizacao} target="_blank" rel="noreferrer"><Icone nome="rota" /> Como chegar (Google Maps)</a>
              )}
              {proximaQuadra && t.link_localizacao && (
                <a className="botao secundario" href={t.link_localizacao} target="_blank" rel="noreferrer"><Icone nome="rota" /> Ver o território no Google Maps</a>
              )}
              {t.link_mapa && <a className="botao secundario" href={t.link_mapa} target="_blank" rel="noreferrer"><Icone nome="imagem" /> Ver o mapa antigo</a>}
            </nav>
          )}

          <div className="o8"><SaidasDoTerritorio numero={t.numero} /></div>
          <div className="o9"><HistoricoTerritorio numero={t.numero} cicloAtual={t.ciclo_atual} ultimaData={t.ultima_data} /></div>
        </div>

        <div className="coluna-mapa">
          <section className={`cartao o4 ${marcando ? 'marcando' : ''}`} ref={secaoMapa} aria-labelledby="titulo-mapa">
            <div className="titulo-secao">
              <h2 id="titulo-mapa"><Icone nome="mapa" /> Mapa{quadras.length ? ` · ${quadras.length} quadras` : ''}</h2>
              {admin && !marcando && (
                <Link className="botao secundario pequeno" to={`/territorio/${t.numero}/mapa`}>
                  <Icone nome="lapis" tamanho={18} /> {t.contorno ? 'Editar mapa' : 'Desenhar mapa'}
                </Link>
              )}
            </div>

            {!t.contorno && (
              <Aviso>
                O mapa deste território ainda não foi desenhado.{' '}
                {t.link_mapa ? 'Por enquanto, use o mapa antigo (botão "Ver o mapa antigo").' : ''}
              </Aviso>
            )}
            {!marcando && quadras.length > 0 && <p className="dica">{mouse ? 'Passe o mouse ou clique' : 'Toque'} numa quadra para ver quando foi feita e por quem.</p>}

            <Aviso>{aviso}</Aviso>

            <div className={salvando ? 'mapa-ocupado' : ''} aria-busy={salvando}>
              <Mapa centro={t.lat != null ? [t.lat, t.lng] : undefined} zoom={17}>
                <Enquadrar geometria={t.contorno} />
                <Contorno geometria={t.contorno} />
                <Quadras
                  quadras={quadras}
                  corDe={(n) => (feitaDe(n) ? COR_FEITA : COR_PENDENTE)}
                  feitaDe={feitaDe}
                  aoClicar={tocarQuadra}
                  dicaDe={mouse ? dicaDaQuadra : undefined}
                />
                <OndeEstou />
              </Mapa>
            </div>

            {quadras.length > 0 && (
              <>
                <p className="legenda-mapa">
                  <span><span className="amostra feita" /> Feita nesta volta (número verde)</span>
                  <span><span className="amostra pendente" /> Falta fazer (borda tracejada)</span>
                </p>
                <details className="lista-quadras" onToggle={(e) => !telaGrande && e.currentTarget.open && e.currentTarget.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
                  <summary><Icone nome="lista" /> Ver as quadras em lista{marcando ? ' (para marcar sem usar o mapa)' : ''}</summary>
                  <div className="grade-quadras">
                    {quadras.map((q) => {
                      const m = marcacaoDa(q.id);
                      return (
                        <button key={q.id} aria-pressed={Boolean(m || pendente(q.id))} disabled={salvando} onClick={() => tocarQuadra(q.numero)}>
                          <span>
                            {m && <Icone nome="check" tamanho={18} />} Quadra {q.numero}
                            <small>{pendente(q.id) ? 'Guardada no celular (será enviada)' : m ? `Feita em ${formatarData(m.data)}${m.dirigente_nome ? ` por ${m.dirigente_nome.split(' ')[0]}` : ''}` : 'Falta fazer'}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </details>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
