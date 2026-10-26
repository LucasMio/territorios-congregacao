// Saídas de campo (da programação) que usam este território: recentes e próximas.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { formatarData, hojeLocal, somarDias } from '../lib/situacao.js';
import Icone from './Icone.jsx';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function SaidasDoTerritorio({ numero }) {
  const { perfil } = useSessao();
  const [saidas, setSaidas] = useState(null);
  const hoje = hojeLocal();

  useEffect(() => {
    supabase
      .from('saidas')
      .select('id, data, horario, local, dirigente_nome, dirigente_id')
      .eq('territorio_numero', numero)
      .gte('data', somarDias(hoje, -7))
      .order('data')
      .then(({ data }) => setSaidas(data ?? []));
  }, [numero, hoje]);

  if (!saidas) return null;
  return (
    <section className="cartao saidas-territorio" aria-labelledby="titulo-saidas">
      <h2 id="titulo-saidas"><Icone nome="calendario" /> Saídas de campo</h2>
      {saidas.length === 0 ? (
        <p className="dica">Nenhuma saída programada com este território. Veja a <Link to="/">Programação</Link>.</p>
      ) : (
        <ul>
          {saidas.map((s) => (
            <li key={s.id} className={s.dirigente_id === perfil.id ? 'minha' : ''}>
              <strong>{DIAS[new Date(`${s.data}T12:00:00`).getDay()]} {formatarData(s.data).slice(0, 5)}</strong> {s.horario ?? ''}
              {s.data === hoje && <span className="selo hoje">Hoje</span>}
              {s.data < hoje && <small className="dica"> (já passou)</small>}
              <small>{s.dirigente_nome}{s.dirigente_id === perfil.id ? ' (você)' : ''}{s.local ? ` · ${s.local}` : ''}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
