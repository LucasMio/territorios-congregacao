// Substituição de dirigente: "Preciso de substituto" (na saída do próprio dirigente),
// "Eu assumo" (para os outros irmãos) e, para o administrador, as trocas a passar para o WhatsApp.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { formatarData, hojeLocal } from '../lib/situacao.js';
import Aviso from './Aviso.jsx';
import Icone from './Icone.jsx';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const quando = (s) => `${DIAS[new Date(`${s.data}T12:00:00`).getDay()]}, ${formatarData(s.data).slice(0, 5)}${s.horario ? ` às ${s.horario}` : ''}`;

export function usePedidos() {
  const [pedidos, setPedidos] = useState([]);
  const recarregar = useCallback(async () => {
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await supabase
      .from('pedidos_substituicao')
      .select('id, status, motivo, pedido_por, pedido_por_nome, aceito_por_nome, aceito_em, trocado_no_whatsapp, saidas(id, data, horario, local, territorio_numero, dirigente_planilha, chave)')
      .or(`status.eq.aberto,aceito_em.gte.${desde}`)
      .order('criado_em');
    setPedidos((data ?? []).filter((p) => p.saidas && (p.status !== 'aberto' || p.saidas.data >= hojeLocal())));
  }, []);
  useEffect(() => {
    recarregar();
  }, [recarregar]);
  return [pedidos, recarregar];
}

/** Botão do dirigente na própria saída: pedir substituto (ou cancelar o pedido aberto). */
export function BotaoSubstituto({ saida, pedido, aoMudar, compacto = false }) {
  const [abrindo, setAbrindo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function pedir(e) {
    e.preventDefault();
    setOcupado(true);
    const { error } = await supabase.rpc('pedir_substituicao', { p_saida: saida.id, p_motivo: motivo });
    setOcupado(false);
    if (error) return setErro(error.message);
    setAbrindo(false);
    aoMudar();
  }

  async function cancelar() {
    if (!window.confirm('Cancelar o pedido de substituto? Você continua como dirigente desta saída.')) return;
    const { error } = await supabase.rpc('cancelar_pedido_substituicao', { p_pedido: pedido.id });
    if (error) return setErro(error.message);
    aoMudar();
  }

  if (pedido) {
    return (
      <span className="pedido-aberto">
        <span className="selo atencao-selo">Pedido de substituto aberto</span>
        <button className="link" onClick={cancelar}>Cancelar pedido</button>
        <Aviso tipo="erro">{erro}</Aviso>
      </span>
    );
  }
  if (!abrindo) {
    return (
      <button className={`secundario ${compacto ? 'pequeno' : ''}`} onClick={() => setAbrindo(true)}>
        <Icone nome="pessoa" tamanho={18} /> Preciso de substituto
      </button>
    );
  }
  return (
    <form className="form-substituto" onSubmit={pedir}>
      <div className="campo">
        <label htmlFor={`motivo-${saida.id}`}>Motivo <small>(opcional — os irmãos vão ver)</small></label>
        <input id={`motivo-${saida.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: vou viajar" maxLength={120} />
      </div>
      <p className="dica sem-margem">Todos os irmãos vão ver o pedido. Quem puder toca em "Eu assumo" e a saída passa para ele.</p>
      <div className="linha-botoes">
        <button type="submit" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Pedir substituto'}</button>
        <button type="button" className="secundario" onClick={() => setAbrindo(false)}>Voltar</button>
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
    </form>
  );
}

/** Pedidos abertos de outros irmãos, com o botão "Eu assumo". */
export function PedidosAbertos({ pedidos, perfil, aoMudar }) {
  const [erro, setErro] = useState('');
  const abertos = pedidos.filter((p) => p.status === 'aberto' && p.pedido_por !== perfil.id);
  if (!abertos.length) return null;

  async function assumir(p) {
    if (!window.confirm(`Você vai dirigir a saída de ${quando(p.saidas)}${p.saidas.local ? ` (${p.saidas.local})` : ''} no lugar de ${p.pedido_por_nome}. Confirmar?`)) return;
    const { error } = await supabase.rpc('assumir_saida', { p_pedido: p.id });
    if (error) return setErro(error.message);
    aoMudar();
  }

  return (
    <section className="cartao pedidos-substituicao" aria-labelledby="titulo-pedidos">
      <h2 id="titulo-pedidos"><Icone nome="alerta" /> Precisa-se de dirigente</h2>
      <ul>
        {abertos.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{quando(p.saidas)}</strong>
              {p.saidas.local ? ` · ${p.saidas.local}` : ''}
              {p.saidas.territorio_numero ? ` · território ${p.saidas.territorio_numero}` : ''}
              <small className="dica obs">{p.pedido_por_nome} pediu substituto{p.motivo ? `: “${p.motivo}”` : ''}</small>
            </div>
            <button className="verde pequeno" onClick={() => assumir(p)}><Icone nome="check" tamanho={18} /> Eu assumo</button>
          </li>
        ))}
      </ul>
      <Aviso tipo="erro">{erro}</Aviso>
    </section>
  );
}

/** Administrador: trocas aceitas (últimos 30 dias) e o comando para o lembrete do WhatsApp acompanhar. */
export function TrocasRecentes({ pedidos, aoMudar }) {
  const aceitos = pedidos.filter((p) => p.status === 'aceito');
  if (!aceitos.length) return null;

  async function feito(p) {
    await supabase.rpc('marcar_trocado_no_whatsapp', { p_pedido: p.id });
    aoMudar();
  }

  return (
    <section className="cartao trocas-recentes" aria-labelledby="titulo-trocas">
      <h2 id="titulo-trocas"><Icone nome="pessoa" /> Substituições feitas (administrador)</h2>
      <ul>
        {aceitos.map((p) => {
          const daPlanilha = !p.saidas.chave?.startsWith('domingo:'); // domingos de grupo não têm lembrete no WhatsApp
          const comando = `npm run trocar -- ${formatarData(p.saidas.data)} "${p.saidas.dirigente_planilha ?? p.pedido_por_nome}" "${p.aceito_por_nome}"`;
          return (
            <li key={p.id}>
              <div>
                <strong>{quando(p.saidas)}</strong>: {p.pedido_por_nome} → <strong>{p.aceito_por_nome}</strong>
                {p.motivo && <small className="dica obs">Motivo: {p.motivo}</small>}
              </div>
              {daPlanilha && !p.trocado_no_whatsapp && (
                <div className="passar-whatsapp">
                  <small>Para o lembrete do WhatsApp ir para {p.aceito_por_nome}, rode no computador (pasta "designações auto"):</small>
                  <code>{comando}</code>
                  <button className="secundario pequeno" onClick={() => feito(p)}>Já troquei no WhatsApp</button>
                </div>
              )}
              {daPlanilha && p.trocado_no_whatsapp && <small className="dica obs">Lembrete do WhatsApp já trocado.</small>}
              {!daPlanilha && <small className="dica obs">Domingo de grupo: não há lembrete no WhatsApp para trocar.</small>}
            </li>
          );
        })}
      </ul>
      <p className="dica"><Link to="/">Programação</Link> já mostra o novo dirigente.</p>
    </section>
  );
}
