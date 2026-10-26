// Administrador: cadastra um território novo (ex.: nas áreas do limite que ainda não têm território)
// e já abre o editor para desenhar o contorno.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Aviso from './Aviso.jsx';
import Icone from './Icone.jsx';

export default function NovoTerritorio({ territorios }) {
  const navegar = useNavigate();
  const proximo = Math.max(0, ...territorios.map((t) => t.numero)) + 1;
  const grupos = [...new Set(territorios.map((t) => t.grupo).filter(Boolean))].sort();
  const [aberto, setAberto] = useState(false);
  const [numero, setNumero] = useState(String(proximo));
  const [bairro, setBairro] = useState('');
  const [grupo, setGrupo] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    const n = Number(numero);
    if (!Number.isInteger(n) || n < 1) return setErro('Número inválido.');
    if (territorios.some((t) => t.numero === n)) return setErro(`Já existe o território ${n}.`);
    setOcupado(true);
    const { error } = await supabase.from('territorios').insert({ numero: n, bairro: bairro.trim(), grupo: grupo || null });
    setOcupado(false);
    if (error) return setErro(`Não foi possível cadastrar: ${error.message}`);
    navegar(`/territorio/${n}/mapa`);
  }

  if (!aberto) {
    return (
      <button className="secundario pequeno" onClick={() => setAberto(true)}>
        <Icone nome="lapis" tamanho={18} /> Novo território
      </button>
    );
  }
  return (
    <form className="cartao form-novo-territorio" onSubmit={criar}>
      <h2><Icone nome="lapis" /> Novo território</h2>
      <p className="dica sem-margem">Depois de salvar, o editor abre para você desenhar o contorno. Use o Mapa geral (áreas em vermelho) para ver onde faltam territórios.</p>
      <div className="campo">
        <label htmlFor="novo-numero">Número</label>
        <input id="novo-numero" type="number" inputMode="numeric" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} required />
      </div>
      <div className="campo">
        <label htmlFor="novo-bairro">Bairro / nome</label>
        <input id="novo-bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Ex.: Granville II (parte norte)" required />
      </div>
      <div className="campo">
        <label htmlFor="novo-grupo">Grupo</label>
        <select id="novo-grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Sem grupo</option>
          {grupos.map((g) => <option key={g}>{g}</option>)}
        </select>
      </div>
      <div className="linha-botoes">
        <button type="submit" className="verde" disabled={ocupado || !bairro.trim()}>{ocupado ? 'Salvando…' : 'Cadastrar e desenhar'}</button>
        <button type="button" className="secundario" onClick={() => setAberto(false)}>Voltar</button>
      </div>
      <Aviso tipo="erro">{erro}</Aviso>
    </form>
  );
}
