// Progresso da congregação: a contabilidade geral dos territórios (só números agregados, para todos).
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase.js';
import { SITUACOES } from '../lib/situacao.js';
import Abas from '../componentes/Abas.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import Campanha from '../componentes/Campanha.jsx';
import CopiaDeSeguranca from '../componentes/CopiaDeSeguranca.jsx';
import { Link } from 'react-router-dom';
import { useSessao } from '../sessao.jsx';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Gráfico de barras dos territórios concluídos por mês (uma série, sem legenda: o título diz o que é). */
function GraficoMeses({ dados }) {
  const [ativo, setAtivo] = useState(null);
  // Desenha na largura real da tela: o texto fica sempre do mesmo tamanho (não encolhe nem cresce).
  const caixa = useRef(null);
  const [L, setL] = useState(640);
  useEffect(() => {
    const obs = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(caixa.current);
    return () => obs.disconnect();
  }, []);
  const A = 240;
  const m = { cima: 28, baixo: 28, esq: 30, dir: 8 };
  const max = Math.max(4, ...dados.map((d) => d.concluidos));
  const topo = Math.ceil(max / 4) * 4;
  const largura = (L - m.esq - m.dir) / dados.length;
  const y = (v) => m.cima + (A - m.cima - m.baixo) * (1 - v / topo);
  const linhas = [0, topo / 4, topo / 2, (3 * topo) / 4, topo];
  const maior = dados.reduce((a, d, i) => (d.concluidos > dados[a].concluidos ? i : a), 0);
  const rotulo = (d) => {
    const [ano, mes] = d.mes.split('-').map(Number);
    return `${MESES_LONGOS[mes - 1]} de ${ano}: ${d.concluidos} ${d.concluidos === 1 ? 'território concluído' : 'territórios concluídos'}`;
  };

  return (
    <figure className="grafico" ref={caixa}>
      <svg width={L} height={A} viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Territórios concluídos por mês nos últimos 12 meses. Os números estão na tabela logo abaixo.">
        {linhas.map((v) => (
          <g key={v}>
            <line x1={m.esq} x2={L - m.dir} y1={y(v)} y2={y(v)} className="grade" />
            <text x={m.esq - 6} y={y(v) + 4} className="eixo" textAnchor="end">{v}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = m.esq + i * largura;
          const altura = y(0) - y(d.concluidos);
          const larguraBarra = Math.min(28, largura - 8);
          const xb = x + (largura - larguraBarra) / 2;
          const mes = Number(d.mes.slice(5, 7));
          const mostrarValor = i === maior || i === dados.length - 1 || ativo === i;
          return (
            <g key={d.mes} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
              {/* Área de toque maior que a barra */}
              <rect x={x} y={m.cima} width={largura} height={A - m.cima - m.baixo} fill="transparent" />
              {d.concluidos > 0 && (
                <path
                  className={`barra ${ativo === i ? 'ativa' : ''}`}
                  d={`M${xb},${y(0)} v${-(altura - 4)} q0,-4 4,-4 h${larguraBarra - 8} q4,0 4,4 v${altura - 4} z`}
                />
              )}
              {mostrarValor && (
                <text x={x + largura / 2} y={y(d.concluidos) - 6} textAnchor="middle" className="valor">{d.concluidos}</text>
              )}
              <text x={x + largura / 2} y={A - 8} textAnchor="middle" className="eixo">{MESES[mes - 1]}</text>
              <title>{rotulo(d)}</title>
            </g>
          );
        })}
        <line x1={m.esq} x2={L - m.dir} y1={y(0)} y2={y(0)} className="base" />
      </svg>
      <figcaption className="dica">
        {ativo !== null ? rotulo(dados[ativo]) : 'Passe o dedo ou o mouse numa barra para ver o número do mês.'}
      </figcaption>
      <details className="tabela-grafico">
        <summary>Ver os números em tabela</summary>
        <table>
          <thead><tr><th scope="col">Mês</th><th scope="col">Territórios concluídos</th></tr></thead>
          <tbody>
            {dados.map((d) => {
              const [ano, mes] = d.mes.split('-').map(Number);
              return <tr key={d.mes}><td>{MESES_LONGOS[mes - 1]} de {ano}</td><td>{d.concluidos}</td></tr>;
            })}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export default function Progresso() {
  const { perfil } = useSessao();
  const [p, setP] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    supabase.rpc('progresso_congregacao').then(({ data, error }) => (error ? setErro(error.message) : setP(data)));
  }, []);

  return (
    <div className="pagina larga">
      <BarraTopo />
      <Abas />
      <main id="conteudo">
        <section className="saudacao">
          <h1>Progresso da congregação</h1>
          <p>Como está o trabalho em todos os territórios da congregação.</p>
          {perfil.papel === 'admin' && (
            <div className="botoes-admin">
              <Link className="botao secundario pequeno" to="/relatorio"><Icone nome="lista" tamanho={18} /> Registro de designação (S-13) para imprimir</Link>
              <CopiaDeSeguranca />
            </div>
          )}
        </section>

        <Aviso tipo="erro">{erro && `Não foi possível carregar: ${erro}`}</Aviso>
        {!p && !erro && <Esqueleto rotulo="Carregando o progresso…" />}

        <Campanha />

        {p && (
          <>
            <div className="numeros-progresso">
              <div className="cartao numero-destaque recente">
                <strong>{pct(p.situacao.recente, p.total)}%</strong>
                <span>dos territórios trabalhados nos últimos 4 meses ({p.situacao.recente} de {p.total})</span>
              </div>
              <div className="cartao numero-destaque azul">
                <strong>{p.quadras_feitas} <small>de {p.quadras_total}</small></strong>
                <span>quadras feitas na volta atual ({pct(p.quadras_feitas, p.quadras_total)}%)</span>
              </div>
              <div className="cartao numero-destaque azul">
                <strong>{p.em_andamento}</strong>
                <span>{p.em_andamento === 1 ? 'território em andamento' : 'territórios em andamento'} (com quadras faltando)</span>
              </div>
              <div className="cartao numero-destaque sem-data">
                <strong>{p.desenhados} <small>de {p.total}</small></strong>
                <span>mapas desenhados no sistema</span>
              </div>
            </div>

            <section className="cartao" aria-labelledby="titulo-situacao-geral">
              <h2 id="titulo-situacao-geral"><Icone nome="relogio" /> Tempo desde a última conclusão</h2>
              <ul className="barra-situacao" aria-label="Territórios por tempo desde a última conclusão">
                {Object.entries(SITUACOES).map(([k, s]) => (
                  <li key={k} className={s.classe} style={{ flexGrow: p.situacao[k] || 0.0001 }}>
                    <span className="so-leitor">{s.rotulo}: {p.situacao[k]} territórios</span>
                  </li>
                ))}
              </ul>
              <ul className="legenda-situacao">
                {Object.entries(SITUACOES).map(([k, s]) => (
                  <li key={k} className={s.classe}>
                    <span className="etiqueta"><Icone nome={s.icone} tamanho={16} /> {s.rotulo}</span>
                    <strong>{p.situacao[k]}</strong> <span className="dica">({pct(p.situacao[k], p.total)}%)</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cartao" aria-labelledby="titulo-meses">
              <h2 id="titulo-meses"><Icone nome="calendario" /> Territórios concluídos por mês</h2>
              <GraficoMeses dados={p.por_mes} />
              <p className="dica">
                Conta as conclusões registradas no sistema e a data da última conclusão de cada território que veio da planilha.
                Meses antigos podem aparecer menores, porque a planilha guardava só a última data de cada território.
              </p>
            </section>

            <section className="cartao" aria-labelledby="titulo-grupos">
              <h2 id="titulo-grupos"><Icone nome="grupo" /> Por grupo</h2>
              <table className="tabela-programacao tabela-grupos">
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col">Trabalhados nos últimos 4 meses</th>
                    <th scope="col">Quadras da volta atual</th>
                  </tr>
                </thead>
                <tbody>
                  {p.por_grupo.map((g) => (
                    <tr key={g.grupo}>
                      <td data-rotulo="Grupo"><strong>{g.grupo}</strong> <small className="dica obs">{g.territorios} territórios</small></td>
                      <td data-rotulo="Últimos 4 meses">
                        {g.recentes} de {g.territorios} ({pct(g.recentes, g.territorios)}%)
                        <span className="progresso fino" aria-hidden="true"><span style={{ width: `${pct(g.recentes, g.territorios)}%` }} /></span>
                      </td>
                      <td data-rotulo="Quadras">
                        {g.feitas} de {g.quadras} ({pct(g.feitas, g.quadras)}%)
                        <span className="progresso fino" aria-hidden="true"><span style={{ width: `${pct(g.feitas, g.quadras)}%` }} /></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
