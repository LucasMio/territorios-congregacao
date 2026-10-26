// Mês de campanha: placar (todos veem) e, para o administrador, iniciar/encerrar a campanha.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { formatarData, hojeLocal, somarDias } from '../lib/situacao.js';
import Aviso from './Aviso.jsx';
import Icone from './Icone.jsx';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

export function useCampanha() {
  const [placar, setPlacar] = useState(undefined); // undefined = carregando, null = nunca houve campanha
  const recarregar = useCallback(() => {
    supabase.rpc('placar_campanha').then(({ data, error }) => setPlacar(error ? null : data));
  }, []);
  useEffect(recarregar, [recarregar]);
  return [placar, recarregar];
}

/** Faixa curta para a Programação: só aparece durante a campanha. */
export function FaixaCampanha() {
  const [p] = useCampanha();
  if (!p || p.encerrada) return null;
  const terminou = p.hoje > p.fim;
  const alvo = p.meta || p.territorios;
  return (
    <Link to="/progresso" className="faixa-campanha">
      <Icone nome="grafico" />
      <span>
        <strong>{p.nome}</strong>: {p.concluidos} de {alvo} territórios {p.meta ? '(meta)' : ''} ·{' '}
        {terminou ? 'terminou' : (diasEntre(p.hoje, p.fim) === 1 ? 'falta 1 dia' : `faltam ${diasEntre(p.hoje, p.fim)} dias`)}
      </span>
      <span className="faixa-progresso" aria-hidden="true"><span style={{ width: `${Math.min(100, pct(p.concluidos, alvo))}%` }} /></span>
    </Link>
  );
}

/** Placar completo (página Progresso) + controles do administrador. */
export default function Campanha() {
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const [p, recarregar] = useCampanha();
  const [nome, setNome] = useState('');
  const [fim, setFim] = useState(somarDias(hojeLocal(), 30));
  const [meta, setMeta] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (p === undefined) return null;
  const ativa = p && !p.encerrada;

  async function iniciar(e) {
    e.preventDefault();
    setErro('');
    const texto =
      `Iniciar a campanha "${nome}" até ${formatarData(fim)}?\n\n` +
      'TODOS os territórios vão começar uma volta nova: as quadras ficam zeradas no mapa ' +
      '(o histórico e a data da última conclusão continuam guardados).\n\nIsso não pode ser desfeito pelo site.';
    if (!window.confirm(texto)) return;
    setOcupado(true);
    const { error } = await supabase.rpc('iniciar_campanha', { p_nome: nome, p_fim: fim, p_meta: meta ? Number(meta) : null });
    setOcupado(false);
    if (error) return setErro(error.message);
    recarregar();
  }

  async function encerrar() {
    if (!window.confirm(`Encerrar a campanha "${p.nome}"? O placar fica guardado como resultado final e tudo segue normal.`)) return;
    setOcupado(true);
    const { error } = await supabase.rpc('encerrar_campanha');
    setOcupado(false);
    if (error) return setErro(error.message);
    recarregar();
  }

  return (
    <>
      {p && (ativa || diasEntre(p.fim, p.hoje) <= 30) && <Placar p={p} />}

      {admin && (
        <section className="cartao" aria-labelledby="titulo-adm-campanha">
          <h2 id="titulo-adm-campanha"><Icone nome="lapis" /> Campanha (administrador)</h2>
          {ativa ? (
            <>
              <p>
                A campanha <strong>{p.nome}</strong> está em andamento ({formatarData(p.inicio)} a {formatarData(p.fim)}).
                {p.hoje > p.fim && ' A data de fim já passou: encerre para guardar o resultado.'}
              </p>
              <button className="perigo" onClick={encerrar} disabled={ocupado}>Encerrar a campanha</button>
            </>
          ) : (
            <form className="form-campanha" onSubmit={iniciar}>
              <p className="dica">
                Ao iniciar, <strong>todos os territórios começam uma volta nova</strong> (quadras zeradas, histórico guardado) e o placar
                passa a contar o que a congregação concluir até a data de fim.
              </p>
              <div className="campo">
                <label htmlFor="nome-campanha">Nome da campanha</label>
                <input id="nome-campanha" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Campanha de dezembro" required />
              </div>
              <div className="campo">
                <label htmlFor="fim-campanha">Termina em</label>
                <input id="fim-campanha" type="date" value={fim} min={hojeLocal()} onChange={(e) => setFim(e.target.value)} required />
              </div>
              <div className="campo">
                <label htmlFor="meta-campanha">Meta de territórios <small>(opcional)</small></label>
                <input id="meta-campanha" type="number" inputMode="numeric" min="1" max="200" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Ex.: 40" />
              </div>
              <button type="submit" disabled={ocupado || !nome.trim()}>{ocupado ? 'Iniciando…' : 'Iniciar campanha'}</button>
            </form>
          )}
          <Aviso tipo="erro">{erro}</Aviso>
        </section>
      )}
    </>
  );
}

function Placar({ p }) {
  const alvo = p.meta || p.territorios;
  const terminou = p.encerrada || p.hoje > p.fim;
  const dias = diasEntre(p.hoje, p.fim);
  return (
    <section className="cartao placar-campanha" aria-labelledby="titulo-placar">
      <h2 id="titulo-placar"><Icone nome="grafico" /> {p.nome}</h2>
      <p className="dica">
        {formatarData(p.inicio)} a {formatarData(p.fim)} ·{' '}
        {p.encerrada ? 'resultado final' : terminou ? 'terminou (aguardando encerrar)' : dias === 0 ? 'último dia!' : dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}
      </p>

      <div className="placar-principal">
        <strong>{p.concluidos}</strong>
        <span>
          {p.concluidos === 1 ? 'território concluído' : 'territórios concluídos'}
          {p.meta ? ` de uma meta de ${p.meta}` : ` de ${p.territorios}`} ({pct(p.concluidos, alvo)}%)
        </span>
      </div>
      <div
        className="progresso grande"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={alvo}
        aria-valuenow={p.concluidos}
        aria-label={p.meta ? 'Territórios concluídos em relação à meta' : 'Territórios concluídos na campanha'}
      >
        <span style={{ width: `${Math.min(100, pct(p.concluidos, alvo))}%` }} />
      </div>

      <ul className="placar-numeros">
        <li><strong>{p.quadras_feitas}</strong> de {p.quadras_total} quadras feitas ({pct(p.quadras_feitas, p.quadras_total)}%)</li>
        <li><strong>{p.em_andamento}</strong> {p.em_andamento === 1 ? 'território em andamento' : 'territórios em andamento'}</li>
        {p.sem_mapa > 0 && <li className="dica">{p.sem_mapa} territórios ainda sem mapa no sistema não entram na contagem de quadras</li>}
      </ul>

      <table className="tabela-programacao tabela-grupos">
        <caption className="so-leitor">Placar da campanha por grupo</caption>
        <thead><tr><th scope="col">Grupo</th><th scope="col">Concluídos</th><th scope="col">Quadras</th></tr></thead>
        <tbody>
          {p.por_grupo.map((g) => (
            <tr key={g.grupo}>
              <td data-rotulo="Grupo"><strong>{g.grupo}</strong></td>
              <td data-rotulo="Concluídos">{g.concluidos} de {g.territorios}</td>
              <td data-rotulo="Quadras">
                {g.quadras_feitas} de {g.quadras_total} ({pct(g.quadras_feitas, g.quadras_total)}%)
                <span className="progresso fino" aria-hidden="true"><span style={{ width: `${pct(g.quadras_feitas, g.quadras_total)}%` }} /></span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {p.lista?.length > 0 && (
        <details className="lista-quadras">
          <summary><Icone nome="lista" /> Territórios concluídos na campanha ({p.lista.length})</summary>
          <ul className="concluidos-campanha">
            {p.lista.map((t) => (
              <li key={t.numero}><Link to={`/territorio/${t.numero}`}>Nº {t.numero} — {t.bairro}</Link> <small className="dica">em {formatarData(t.data)}</small></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
