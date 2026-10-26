// Administrador: concluir o território à mão (ex.: território sem mapa, ou trabalhado sem marcar as quadras).
import { useState } from 'react';
import { supabase } from '../supabase.js';
import { formatarData, hojeLocal } from '../lib/situacao.js';
import Aviso from './Aviso.jsx';
import Icone from './Icone.jsx';

export default function ConcluirAMao({ territorio, faltam, aoConcluir }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hojeLocal());
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function concluir(e) {
    e.preventDefault();
    const aviso = faltam > 0 ? `\n\n${faltam === 1 ? 'Ainda falta 1 quadra' : `Ainda faltam ${faltam} quadras`} no mapa; elas também vão contar como feitas.` : '';
    if (!window.confirm(`Marcar o território ${territorio.numero} como concluído em ${formatarData(data)}?${aviso}\n\nEle começa uma volta nova, e a conclusão conta no placar (se houver campanha).`)) return;
    setOcupado(true);
    const { error } = await supabase.rpc('concluir_territorio', { p_numero: territorio.numero, p_data: data });
    setOcupado(false);
    if (error) return setErro(error.message);
    setAberto(false);
    aoConcluir(data);
  }

  if (!aberto) {
    return (
      <button className="secundario pequeno" onClick={() => setAberto(true)}>
        <Icone nome="check" tamanho={18} /> Marcar como concluído (à mão)
      </button>
    );
  }
  return (
    <form className="form-concluir" onSubmit={concluir}>
      <p className="dica sem-margem">
        Use quando o território foi trabalhado inteiro sem marcar as quadras no sistema (por exemplo, os que ainda não têm mapa).
      </p>
      <div className="campo">
        <label htmlFor="data-conclusao">Concluído em</label>
        <input id="data-conclusao" type="date" value={data} max={hojeLocal()} onChange={(e) => setData(e.target.value)} required />
      </div>
      <div className="linha-botoes">
        <button type="submit" className="verde" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Concluir território'}</button>
        <button type="button" className="secundario" onClick={() => setAberto(false)}>Voltar</button>
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
    </form>
  );
}
