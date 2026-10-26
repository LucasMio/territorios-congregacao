// Registro de designação de territórios (no modelo do S-13), para imprimir ou salvar em PDF.
// Ano de serviço = setembro a agosto. Cada "designação" é uma volta no território: quem dirigiu as
// saídas com ele, a partir de quando, e a data em que foi concluído. Só administradores.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase.js';
import { formatarData, hojeLocal } from '../lib/situacao.js';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Aviso from '../componentes/Aviso.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';
import { anoDeServico, limitesDoAno, montarDesignacoes } from '../lib/relatorio.js';

const COLUNAS_DESIGNACAO = 4;

export default function Relatorio() {
  const hoje = hojeLocal();
  const [ano, setAno] = useState(anoDeServico(hoje));
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [grupo, setGrupo] = useState('');
  const [soComMovimento, setSoComMovimento] = useState(false);

  useEffect(() => {
    const { inicio, fim } = limitesDoAno(ano);
    setDados(null);
    Promise.all([
      supabase.from('territorios').select('numero, bairro, grupo, ultima_data').order('numero'),
      supabase.from('saidas').select('data, dirigente_nome, territorio_numero').not('territorio_numero', 'is', null).gte('data', inicio).lte('data', fim < hoje ? fim : hoje).not('chave', 'like', 'teste:%'),
      supabase.from('conclusoes').select('territorio_numero, data').lte('data', fim),
    ]).then(([t, s, c]) => {
      const e = t.error || s.error || c.error;
      if (e) return setErro(e.message);
      setDados({ territorios: t.data, saidas: s.data, conclusoes: c.data });
    });
  }, [ano, hoje]);

  const linhas = useMemo(() => {
    if (!dados) return [];
    const { inicio } = limitesDoAno(ano);
    return dados.territorios
      .filter((t) => !grupo || t.grupo === grupo)
      .map((t) => {
        const conclusoes = dados.conclusoes.filter((c) => c.territorio_numero === t.numero).map((c) => c.data);
        if (t.ultima_data && !conclusoes.includes(t.ultima_data)) conclusoes.push(t.ultima_data);
        const antes = conclusoes.filter((d) => d < inicio).sort().at(-1) ?? null;
        const doAno = conclusoes.filter((d) => d >= inicio);
        const saidas = dados.saidas.filter((s) => s.territorio_numero === t.numero).map((s) => ({ data: s.data, nome: s.dirigente_nome }));
        return { ...t, antes, designacoes: montarDesignacoes(saidas, doAno) };
      })
      .filter((l) => !soComMovimento || l.designacoes.length > 0);
  }, [dados, ano, grupo, soComMovimento]);

  const grupos = [...new Set((dados?.territorios ?? []).map((t) => t.grupo).filter(Boolean))].sort();
  const anos = [anoDeServico(hoje) - 1, anoDeServico(hoje)];

  return (
    <div className="pagina larga relatorio">
      <div className="nao-imprimir">
        <BarraTopo voltarPara="/progresso" voltarRotulo="Progresso" />
      </div>
      <main id="conteudo">
        <div className="nao-imprimir">
          <h1>Registro de designação de territórios</h1>
          <p className="dica">No modelo do S-13. Toque em <strong>Imprimir / salvar PDF</strong> e escolha a impressora ou "Salvar como PDF".</p>
          <div className="filtros-relatorio">
            <div className="campo">
              <label htmlFor="ano-servico">Ano de serviço</label>
              <select id="ano-servico" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                {anos.map((a) => <option key={a} value={a}>{a} (set/{a - 1} a ago/{a})</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="grupo-relatorio">Grupo</label>
              <select id="grupo-relatorio" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                <option value="">Todos</option>
                {grupos.map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <label className="caixa-marcar">
              <input type="checkbox" checked={soComMovimento} onChange={(e) => setSoComMovimento(e.target.checked)} />
              Só territórios trabalhados neste ano de serviço
            </label>
            <button onClick={() => window.print()}><Icone nome="imagem" /> Imprimir / salvar PDF</button>
          </div>
          <Aviso tipo="erro">{erro}</Aviso>
          {!dados && !erro && <Esqueleto rotulo="Carregando o registro…" />}
        </div>

        {dados && (
          <>
            <h2 className="titulo-impressao">
              Registro de designação de territórios — Ano de serviço {ano}{grupo ? ` — ${grupo}` : ''}
            </h2>
            <div className="rolagem-tabela" tabIndex={0} role="region" aria-label="Tabela do registro (role para o lado para ver tudo)">
              <table className="tabela-s13">
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2}>Nº</th>
                    <th scope="col" rowSpan={2}>Bairro</th>
                    <th scope="col" rowSpan={2}>Última conclusão antes do ano</th>
                    {Array.from({ length: COLUNAS_DESIGNACAO }, (_, i) => (
                      <th scope="colgroup" colSpan={2} key={i}>Designado a</th>
                    ))}
                  </tr>
                  <tr>
                    {Array.from({ length: COLUNAS_DESIGNACAO }, (_, i) => [
                      <th scope="col" key={`d${i}`}>Designado em</th>,
                      <th scope="col" key={`c${i}`}>Concluído em</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const ds = l.designacoes.slice(-COLUNAS_DESIGNACAO);
                    return [
                      <tr key={`${l.numero}-n`} className="linha-nomes">
                        <th scope="row" rowSpan={2}>{l.numero}</th>
                        <td rowSpan={2}>{l.bairro}</td>
                        <td rowSpan={2}>{l.antes ? formatarData(l.antes) : '—'}</td>
                        {Array.from({ length: COLUNAS_DESIGNACAO }, (_, i) => (
                          <td colSpan={2} key={i} className="nome-designado">{ds[i] ? ds[i].nomes.join(', ') || '—' : ''}</td>
                        ))}
                      </tr>,
                      <tr key={`${l.numero}-d`}>
                        {Array.from({ length: COLUNAS_DESIGNACAO }, (_, i) => [
                          <td key={`d${i}`}>{ds[i]?.desde ? formatarData(ds[i].desde) : ''}</td>,
                          <td key={`c${i}`}>{ds[i] ? (ds[i].concluido ? formatarData(ds[i].concluido) : 'em andamento') : ''}</td>,
                        ])}
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <p className="dica rodape-relatorio">
              {linhas.length} território(s). Gerado em {formatarData(hoje)}. "Designado a" = quem dirigiu as saídas de campo com o território até a conclusão.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
