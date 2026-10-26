import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { SITUACOES, descreverTempo, formatarData, hojeLocal, situacaoDoTerritorio } from '../lib/situacao.js';
import Aviso from '../componentes/Aviso.jsx';
import Abas from '../componentes/Abas.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import NovoTerritorio from '../componentes/NovoTerritorio.jsx';
import { useMouse, useTelaGrande } from '../lib/tela.js';

const ORDENS = {
  numero: { rotulo: 'Número', comparar: (a, b) => a.numero - b.numero },
  antigos: {
    rotulo: 'Mais tempo sem trabalhar',
    // Sem data primeiro, depois do mais antigo para o mais recente.
    comparar: (a, b) => (a.ultima_data ?? '0000').localeCompare(b.ultima_data ?? '0000') || a.numero - b.numero,
  },
};

// Com poucos territórios (o normal para um dirigente), busca e filtros só atrapalham.
const POUCOS = 6;

export default function Territorios() {
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const telaGrande = useTelaGrande();
  const verbo = useMouse() ? 'Clique' : 'Toque';
  const [territorios, setTerritorios] = useState(null);
  const [progresso, setProgresso] = useState({});
  const [designacoes, setDesignacoes] = useState({}); // número -> próxima saída de campo
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const [situacao, setSituacao] = useState('');
  const [ordem, setOrdem] = useState('numero');
  const [filtroDesignacao, setFiltroDesignacao] = useState('');

  useEffect(() => {
    supabase
      .from('territorios')
      .select('numero, bairro, grupo, ultima_data, observacoes')
      .order('numero')
      .then(({ data, error }) => (error ? setErro(error.message) : setTerritorios(data)));
    supabase
      .from('progresso_territorios')
      .select('numero, total_quadras, feitas_no_ciclo')
      .then(({ data }) => setProgresso(Object.fromEntries((data ?? []).map((p) => [p.numero, p]))));
    // Próxima saída de campo de cada território (da programação).
    supabase
      .from('saidas')
      .select('territorio_numero, data, dirigente_nome')
      .not('territorio_numero', 'is', null)
      .gte('data', hojeLocal())
      .order('data')
      .then(({ data }) => {
        const mapa = {};
        for (const d of data ?? []) mapa[d.territorio_numero] ??= d;
        setDesignacoes(mapa);
      });
  }, [admin]);

  const grupos = useMemo(() => [...new Set((territorios ?? []).map((t) => t.grupo).filter(Boolean))].sort(), [territorios]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (territorios ?? [])
      .filter((t) => !termo || String(t.numero) === termo || t.bairro.toLowerCase().includes(termo))
      .filter((t) => !grupo || t.grupo === grupo)
      .filter((t) => !situacao || situacaoDoTerritorio(t.ultima_data) === situacao)
      .filter((t) => !filtroDesignacao || (filtroDesignacao === 'livres') === !designacoes[t.numero])
      .sort(ORDENS[ordem].comparar);
  }, [territorios, busca, grupo, situacao, ordem, designacoes, filtroDesignacao]);

  const contagem = useMemo(() => {
    const c = {};
    for (const t of territorios ?? []) c[situacaoDoTerritorio(t.ultima_data)] = (c[situacaoDoTerritorio(t.ultima_data)] ?? 0) + 1;
    return c;
  }, [territorios]);

  const comFiltros = admin || (territorios?.length ?? 0) > POUCOS;
  const filtrando = busca || grupo || situacao || filtroDesignacao;
  const limpar = () => { setBusca(''); setGrupo(''); setSituacao(''); setFiltroDesignacao(''); };

  return (
    <div className="pagina larga">
      <a className="pular" href="#lista">Pular para a lista de territórios</a>
      <BarraTopo />
      <Abas />
      <main id="conteudo">

      <section className="saudacao">
        <h1>{admin ? 'Territórios' : 'Meus territórios'}</h1>
        {admin && territorios && <div className="acao-novo-territorio"><NovoTerritorio territorios={territorios} /></div>}
        <p>
          Olá, {perfil.nome.split(' ')[0]}{admin ? ' (administrador)' : ''}.{' '}
          {admin ? `${verbo} num território para ver o mapa, desenhar ou concluir.` : `${verbo} no território para ver o mapa e marcar as quadras.`}
        </p>
      </section>

      <div className={comFiltros ? 'layout-lista' : ''}>
      {comFiltros && (
        <aside className="painel-filtros" aria-label="Filtros">
          <div className="legenda" role="group" aria-label="Filtrar pela situação">
            {Object.entries(SITUACOES).map(([chave, s]) => (
              <button key={chave} className={s.classe} aria-pressed={situacao === chave} onClick={() => setSituacao(situacao === chave ? '' : chave)}>
                <Icone nome={s.icone} tamanho={18} /> {s.rotulo} <strong>{contagem[chave] ?? 0}</strong>
              </button>
            ))}
          </div>

          <div className="filtros">
            <div className="busca">
              <Icone nome="buscar" />
              <label htmlFor="busca" className="so-leitor">Buscar território</label>
              <input id="busca" type="search" placeholder="Número ou bairro" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <details className="mais-filtros" open={telaGrande || Boolean(grupo || filtroDesignacao || ordem !== 'numero') || undefined}>
              <summary>Mais filtros e ordem{grupo || filtroDesignacao || ordem !== 'numero' ? ' (em uso)' : ''}</summary>
              <div className="grade-filtros">
            <label className="so-leitor" htmlFor="grupo">Grupo</label>
            <select id="grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">Todos os grupos</option>
              {grupos.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <label className="so-leitor" htmlFor="ordem">Ordem</label>
            <select id="ordem" value={ordem} onChange={(e) => setOrdem(e.target.value)}>
              {Object.entries(ORDENS).map(([chave, o]) => (
                <option key={chave} value={chave}>Ordem: {o.rotulo}</option>
              ))}
            </select>
            {admin && (
              <>
                <label className="so-leitor" htmlFor="designacao">Saída marcada</label>
                <select id="designacao" value={filtroDesignacao} onChange={(e) => setFiltroDesignacao(e.target.value)}>
                  <option value="">Com e sem saída marcada</option>
                  <option value="designados">Só com saída marcada</option>
                  <option value="livres">Só sem saída marcada</option>
                </select>
              </>
            )}
              </div>
            </details>
          </div>
        </aside>
      )}
      <div className="resultados">

      <Aviso tipo="erro">{erro && `Não foi possível carregar os territórios: ${erro}`}</Aviso>
      {!territorios && !erro && <Esqueleto rotulo="Carregando os territórios…" tipo="lista" quantos={5} />}

      {territorios && territorios.length === 0 && (
        <div className="cartao vazio">
          <Icone nome="mapa" tamanho={40} />
          <h2>Nenhum território com você</h2>
          <p>Aqui aparecem os territórios das saídas de campo que você vai dirigir. Veja os seus dias na aba <Link to="/">Programação</Link>.</p>
        </div>
      )}

      {territorios && territorios.length > 0 && comFiltros && (
        <p className="contagem" role="status">
          Mostrando {visiveis.length} de {territorios.length} territórios
          {filtrando && <> · <button className="link" onClick={limpar}>Limpar filtros</button></>}
        </p>
      )}

      <ul className="lista" id="lista">
        {visiveis.map((t) => {
          const s = SITUACOES[situacaoDoTerritorio(t.ultima_data)];
          const p = progresso[t.numero];
          const prox = designacoes[t.numero];
          return (
            <li key={t.numero}>
              <Link to={`/territorio/${t.numero}`} className={`item ${s.classe}`}>
                <span className="numero" aria-hidden="true">{t.numero}</span>
                <span className="info">
                  <span className="titulo"><span className="so-leitor">Território {t.numero}, </span>{t.bairro}</span>
                  <span className="linha">
                    <span className="etiqueta"><Icone nome={s.icone} tamanho={16} /> {s.rotulo}</span>
                    <span>{t.ultima_data ? `Concluído em ${formatarData(t.ultima_data)} (${descreverTempo(t.ultima_data)})` : 'Sem data de conclusão'}</span>
                  </span>
                  <span className="linha">
                    <span><Icone nome="grupo" tamanho={16} /> {t.grupo ?? 'Sem grupo'}</span>
                    <span className={`designado ${prox ? '' : 'livre'}`}>
                      <Icone nome="calendario" tamanho={16} /> {prox ? `Próxima saída: ${formatarData(prox.data).slice(0, 5)} · ${prox.dirigente_nome}` : 'Sem saída marcada'}
                    </span>
                  </span>
                  {p?.feitas_no_ciclo > 0 && (
                    <>
                      <span className="andamento">Em andamento: {p.feitas_no_ciclo} de {p.total_quadras} quadras feitas</span>
                      <span className="progresso fino" aria-hidden="true"><span style={{ width: `${Math.round((p.feitas_no_ciclo / p.total_quadras) * 100)}%` }} /></span>
                    </>
                  )}
                </span>
                <Icone nome="voltar" className="seta" />
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
      </div>
      </main>
    </div>
  );
}
