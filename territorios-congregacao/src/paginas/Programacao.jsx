// Página inicial: programação de campo (datas, dirigentes e territórios), com o usuário em destaque.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { formatarData, hojeLocal, somarDias } from '../lib/situacao.js';
import { REGRAS_TEXTO, gruposEquivalentes } from '../lib/programacao.js';
import Abas from '../componentes/Abas.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import { FaixaCampanha } from '../componentes/Campanha.jsx';
import { BotaoSubstituto, PedidosAbertos, TrocasRecentes, usePedidos } from '../componentes/Substituicao.jsx';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const diaDaSemana = (iso) => DIAS[new Date(`${iso}T12:00:00`).getDay()];
const nomeDoMes = (iso) => {
  const m = MESES[Number(iso.slice(5, 7)) - 1];
  return `${m[0].toUpperCase()}${m.slice(1)} de ${iso.slice(0, 4)}`;
};

// Dica do primeiro acesso: aparece até o irmão tocar em "Ver como usar" ou "Já sei usar" (guardado no celular).
const CHAVE_DICA = 'territorios:dica-ajuda-vista';
function DicaPrimeiraVez() {
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_DICA) === '1';
    } catch {
      return false;
    }
  });
  if (vista) return null;
  function marcarVista() {
    try {
      localStorage.setItem(CHAVE_DICA, '1');
    } catch {
      // sem armazenamento: some só até recarregar
    }
    setVista(true);
  }
  return (
    <section className="cartao dica-primeira-vez" aria-label="Dica para quem está começando">
      <p><strong>Primeira vez aqui?</strong> Veja em 3 passos como usar o sistema no dia da sua saída.</p>
      <div className="acoes">
        <Link className="botao" to="/ajuda" onClick={marcarVista}><Icone nome="info" tamanho={18} /> Ver como usar</Link>
        <button className="secundario" onClick={marcarVista}>Já sei usar</button>
      </div>
    </section>
  );
}

function DescricaoTerritorio({ s, podeAbrir, passou }) {
  if (s.sem_territorio) return <span className="dica">Cartas — sem território</span>;
  if (s.escolha_do_dirigente && !s.territorio_numero) {
    const texto = `O chefe escolhe (grupo ${gruposEquivalentes(s.grupo).join(' / ')})`;
    return podeAbrir ? <Link to="/territorios">{texto}</Link> : <span>{texto}</span>;
  }
  if (!s.territorio_numero) return <span className="dica">{passou ? '—' : s.grupo ? 'Nenhum livre no grupo' : 'A definir'}</span>;
  const texto = (
    <>
      <strong>Nº {s.territorio_numero}</strong>
      {s.territorios?.bairro ? ` — ${s.territorios.bairro}` : ''}
    </>
  );
  return podeAbrir ? <Link to={`/territorio/${s.territorio_numero}`}>{texto}</Link> : <span>{texto}</span>;
}

/** Administrador: trocar o território e/ou o dirigente de uma saída. */
function EditarSaida({ s, territorios, perfis, aoSalvar, aoCancelar }) {
  const [territorio, setTerritorio] = useState(s.territorio_manual ? String(s.territorio_numero ?? '') : 'auto');
  const [dirigente, setDirigente] = useState(s.dirigente_id ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const doGrupo = territorios.filter((t) => gruposEquivalentes(s.grupo).includes(t.grupo));
  const outros = territorios.filter((t) => !gruposEquivalentes(s.grupo).includes(t.grupo));

  async function salvar() {
    setSalvando(true);
    const mudar = {};
    if (territorio === 'auto') Object.assign(mudar, { territorio_manual: false });
    else Object.assign(mudar, { territorio_manual: true, territorio_numero: territorio ? Number(territorio) : null });
    if (dirigente !== (s.dirigente_id ?? '')) {
      const p = perfis.find((x) => x.id === dirigente);
      Object.assign(mudar, { dirigente_id: p?.id ?? null, dirigente_nome: p?.nome ?? s.dirigente_nome, dirigente_manual: true });
    }
    const { error } = await supabase.from('saidas').update({ ...mudar, atualizado_em: new Date().toISOString() }).eq('id', s.id);
    if (error) {
      setSalvando(false);
      return setErro(error.message);
    }
    await supabase.rpc('planejar_saidas');
    aoSalvar();
  }

  return (
    <div className="editar-saida">
      <div className="campo">
        <label htmlFor={`terr-${s.id}`}>Território</label>
        <select id={`terr-${s.id}`} value={territorio} onChange={(e) => setTerritorio(e.target.value)}>
          <option value="auto">{s.escolha_do_dirigente ? 'O chefe do grupo escolhe no dia' : `Automático (o sistema escolhe${s.grupo ? ` no grupo ${s.grupo}` : ''})`}</option>
          <option value="">Nenhum</option>
          {doGrupo.length > 0 && (
            <optgroup label={`Grupo ${gruposEquivalentes(s.grupo).join(' / ')}`}>
              {doGrupo.map((t) => <option key={t.numero} value={t.numero}>{t.numero} — {t.bairro}</option>)}
            </optgroup>
          )}
          <optgroup label="Outros grupos">
            {outros.map((t) => <option key={t.numero} value={t.numero}>{t.numero} — {t.bairro} ({t.grupo ?? 'sem grupo'})</option>)}
          </optgroup>
        </select>
      </div>
      <div className="campo">
        <label htmlFor={`dir-${s.id}`}>Dirigente (substituir)</label>
        <select id={`dir-${s.id}`} value={dirigente} onChange={(e) => setDirigente(e.target.value)}>
          {!s.dirigente_id && <option value="">{s.dirigente_nome} (sem login)</option>}
          {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
      <div className="linha-botoes">
        <button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        <button className="secundario" onClick={aoCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

export default function Programacao() {
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const hoje = hojeLocal();
  const [saidas, setSaidas] = useState(null);
  const [erro, setErro] = useState('');
  const [soMinhas, setSoMinhas] = useState(false);
  const [anteriores, setAnteriores] = useState(false);
  const [editando, setEditando] = useState(null);
  const [territorios, setTerritorios] = useState([]);
  const [perfis, setPerfis] = useState([]);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('saidas')
      .select('id, data, horario, local, grupo, sem_territorio, dirigente_nome, dirigente_id, dirigente_manual, territorio_numero, territorio_manual, escolha_do_dirigente, observacao, territorios(bairro)')
      .gte('data', anteriores ? somarDias(hoje, -60) : hoje) // começa hoje; os dias que passaram ficam no botão "Ver dias anteriores"
      .order('data')
      .order('horario')
      .order('local');
    if (error) setErro(error.message);
    else setSaidas(data);
  }, [anteriores, hoje]);

  useEffect(() => {
    // Atualiza a escolha automática dos territórios (rápido) e depois carrega.
    supabase.rpc('planejar_saidas').then(carregar, carregar);
  }, [carregar]);

  useEffect(() => {
    if (!admin) return;
    supabase.from('territorios').select('numero, bairro, grupo').order('numero').then(({ data }) => setTerritorios(data ?? []));
    supabase.from('perfis').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => setPerfis(data ?? []));
  }, [admin]);

  const [pedidos, recarregarPedidos] = usePedidos();
  const pedidoAberto = (s) => pedidos.find((p) => p.status === 'aberto' && p.saidas.id === s.id);
  const aoMudarPedidos = async () => {
    await recarregarPedidos();
    await carregar();
  };

  const minha = (s) => s.dirigente_id === perfil.id;
  const visiveis = useMemo(() => (saidas ?? []).filter((s) => !soMinhas || minha(s)), [saidas, soMinhas]); // eslint-disable-line react-hooks/exhaustive-deps
  const proxima = (saidas ?? []).find((s) => minha(s) && s.data >= hoje);
  const meses = useMemo(() => {
    const m = new Map();
    for (const s of visiveis) (m.get(s.data.slice(0, 7)) ?? m.set(s.data.slice(0, 7), []).get(s.data.slice(0, 7))).push(s);
    return [...m.entries()];
  }, [visiveis]);

  return (
    <div className="pagina larga">
      <BarraTopo />
      <Abas />
      <main id="conteudo">
        <section className="saudacao">
          <h1>Programação de campo</h1>
          <p>Olá, <strong>{perfil.nome.split(' ')[0]}</strong>! Aqui estão as saídas de campo: dia, local, dirigente e território. As suas aparecem em amarelo.</p>
        </section>

        <DicaPrimeiraVez />

        <FaixaCampanha />

        <PedidosAbertos pedidos={pedidos} perfil={perfil} aoMudar={aoMudarPedidos} />
        {admin && <TrocasRecentes pedidos={pedidos} aoMudar={aoMudarPedidos} />}

        {proxima && (
          <section className="cartao minha-proxima" aria-labelledby="titulo-proxima">
            <h2 id="titulo-proxima"><Icone nome="pessoa" /> {proxima.data === hoje ? 'Hoje você dirige!' : 'Sua próxima saída'}</h2>
            <p className="quando">
              {diaDaSemana(proxima.data)}, {formatarData(proxima.data)} às {proxima.horario ?? '—'}
              {proxima.local ? ` · ${proxima.local}` : ''}
            </p>
            <p><DescricaoTerritorio s={proxima} podeAbrir={false} /></p>
            {proxima.escolha_do_dirigente && !proxima.territorio_numero && (
              <>
                <p className="dica">Você escolhe em quais territórios e quadras o grupo vai trabalhar. Todos os territórios do seu grupo aparecem em "Meus territórios".</p>
                <Link className="botao verde" to="/territorios"><Icone nome="lista" /> Ver os territórios do grupo</Link>
              </>
            )}
            {proxima.territorio_numero && (
              <Link className="botao verde" to={`/territorio/${proxima.territorio_numero}`}><Icone nome="mapa" /> Abrir o território {proxima.territorio_numero}</Link>
            )}
            <div className="substituto-proxima">
              <BotaoSubstituto saida={proxima} pedido={pedidoAberto(proxima)} aoMudar={aoMudarPedidos} />
            </div>
          </section>
        )}

        <div className="barra-filtros-prog">
          <button className="secundario pequeno" aria-pressed={soMinhas} onClick={() => setSoMinhas(!soMinhas)}>
            <Icone nome="pessoa" tamanho={18} /> {soMinhas ? 'Mostrando só as minhas' : 'Só as minhas saídas'}
          </button>
          <button className="secundario pequeno" aria-pressed={anteriores} onClick={() => setAnteriores(!anteriores)}>
            <Icone nome="relogio" tamanho={18} /> {anteriores ? 'Mostrando dias anteriores' : 'Ver dias anteriores'}
          </button>
        </div>

        <Aviso tipo="erro">{erro && `Não foi possível carregar a programação: ${erro}`}</Aviso>
        {!saidas && !erro && <Esqueleto rotulo="Carregando a programação…" />}
        {saidas && visiveis.length === 0 && (
          <div className="cartao vazio">
            <Icone nome="calendario" tamanho={40} />
            <h2>{soMinhas ? 'Você não tem saídas nesta programação' : 'Nenhuma saída programada'}</h2>
            <p>A programação aparece aqui quando a planilha mensal dos dirigentes é importada.</p>
          </div>
        )}

        {meses.map(([mes, lista]) => (
          <section key={mes} className="cartao mes-programacao" aria-labelledby={`mes-${mes}`}>
            <h2 id={`mes-${mes}`} className="titulo-mes"><Icone nome="calendario" /> {nomeDoMes(`${mes}-01`)}</h2>
            <table className="tabela-programacao cartoes-saida">
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col">Horário</th>
                  <th scope="col">Local</th>
                  <th scope="col">Dirigente</th>
                  <th scope="col">Território</th>
                  {admin && <th scope="col"><span className="so-leitor">Ações</span></th>}
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => {
                  const eu = minha(s);
                  const passou = s.data < hoje;
                  return (
                    <Fragment key={s.id}>
                      <tr className={`${eu ? 'minha' : ''} ${s.data === hoje ? 'hoje' : ''} ${passou ? 'passou' : ''}`}>
                        <td data-rotulo="Dia">
                          <strong>{diaDaSemana(s.data)}</strong> {formatarData(s.data).slice(0, 5)}
                          {s.data === hoje && <span className="selo hoje">Hoje</span>}
                        </td>
                        <td data-rotulo="Horário">{s.horario ?? '—'}</td>
                        <td data-rotulo="Local">{s.local ?? '—'}</td>
                        <td data-rotulo="Dirigente">
                          {eu ? <strong className="voce">{s.dirigente_nome}</strong> : s.dirigente_nome}
                          {eu && <span className="selo">Você</span>}
                          {!eu && pedidoAberto(s) && <span className="selo atencao-selo">Precisa de substituto</span>}
                          {eu && !passou && s.id !== proxima?.id && (
                            <span className="substituto-linha"><BotaoSubstituto saida={s} pedido={pedidoAberto(s)} aoMudar={aoMudarPedidos} compacto /></span>
                          )}
                          {s.dirigente_manual && admin && <small className="dica"> (substituído no site)</small>}
                        </td>
                        <td data-rotulo="Território">
                          <DescricaoTerritorio s={s} podeAbrir={admin || eu} passou={passou} />
                          {admin && s.territorio_numero && <small className="dica"> {s.territorio_manual ? '(escolhido)' : '(automático)'}</small>}
                          {s.observacao && <small className="dica obs">{s.observacao}</small>}
                        </td>
                        {admin && (
                          <td data-rotulo="">
                            {!passou && (
                              <button
                                className="secundario pequeno"
                                aria-expanded={editando === s.id}
                                aria-label={`Alterar saída de ${diaDaSemana(s.data)} ${formatarData(s.data)}`}
                                onClick={() => setEditando(editando === s.id ? null : s.id)}
                              >
                                <Icone nome="lapis" tamanho={16} /> Alterar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {editando === s.id && (
                        <tr className="linha-edicao">
                          <td colSpan={6}>
                            <EditarSaida
                              s={s}
                              territorios={territorios}
                              perfis={perfis}
                              aoCancelar={() => setEditando(null)}
                              aoSalvar={async () => { setEditando(null); await carregar(); }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}

        {admin && (
          <details className="cartao regras">
            <summary><Icone nome="info" /> Como o território de cada dia é escolhido</summary>
            <ul>
              {REGRAS_TEXTO.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <p>
              Nos domingos dos grupos, o próprio chefe decide: ele vê todos os territórios do grupo dele e marca as quadras que trabalhar. Nos outros dias, dentro do grupo do dia, o sistema escolhe primeiro o território <strong>em andamento</strong> (faltam quadras para terminar) e depois o que está
              <strong> há mais tempo sem ser concluído</strong>, sem repetir o mesmo território em duas saídas. A escolha é refeita sozinha conforme as quadras
              são marcadas. Use <strong>Alterar</strong> para escolher outro território ou substituir o dirigente; o que você escolher não é desfeito pela planilha.
            </p>
            <p className="dica">
              A programação vem da planilha mensal dos dirigentes, importada no sistema de lembretes (npm run importar-dirigentes). Os domingos dos chefes de grupo são criados automaticamente.
            </p>
          </details>
        )}
      </main>
    </div>
  );
}
