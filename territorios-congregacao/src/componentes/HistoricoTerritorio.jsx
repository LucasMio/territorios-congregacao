// Histórico do território: as conclusões (com quanto tempo cada volta levou) e o trabalho de cada dia
// (quem marcou e quantas quadras). Usa só dados que já existem; respeita quem pode ver o território.
import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { formatarData } from '../lib/situacao.js';
import Icone from './Icone.jsx';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaSemana = (iso) => DIAS[new Date(`${iso}T12:00:00`).getDay()];
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

export default function HistoricoTerritorio({ numero, cicloAtual, ultimaData }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from('conclusoes').select('id, data, ciclo, ciclo_iniciado_em, manual, concluida_por_nome').eq('territorio_numero', numero).order('data', { ascending: false }),
      supabase.from('marcacoes').select('data, ciclo, dirigente_nome').eq('territorio_numero', numero).order('data', { ascending: false }).limit(500),
    ]).then(([c, m]) => setDados({ conclusoes: c.data ?? [], marcacoes: m.data ?? [] }));
  }, [numero, cicloAtual]);

  if (!dados) return null;

  // Trabalho por dia: data + dirigente → quantidade de quadras.
  const dias = [];
  for (const m of dados.marcacoes) {
    const ult = dias.at(-1);
    if (ult && ult.data === m.data && ult.nome === m.dirigente_nome && ult.ciclo === m.ciclo) ult.quadras++;
    else dias.push({ data: m.data, nome: m.dirigente_nome ?? 'Dirigente', ciclo: m.ciclo, quadras: 1 });
  }
  // A última data da planilha entra como conclusão, se o sistema ainda não a registrou.
  const conclusoes = [...dados.conclusoes];
  if (ultimaData && !conclusoes.some((c) => c.data === ultimaData)) conclusoes.push({ id: 'planilha', data: ultimaData, planilha: true });
  conclusoes.sort((a, b) => b.data.localeCompare(a.data));

  return (
    <section className="cartao historico" aria-labelledby={`titulo-historico-${numero}`}>
      <h2 id={`titulo-historico-${numero}`}><Icone nome="relogio" /> Histórico</h2>

      <h3>Conclusões</h3>
      {conclusoes.length === 0 ? (
        <p className="dica">Nenhuma conclusão registrada ainda.</p>
      ) : (
        <ul className="linha-do-tempo">
          {conclusoes.slice(0, 8).map((c) => (
            <li key={c.id}>
              <strong>{formatarData(c.data)}</strong>
              <small className="dica obs">
                {c.planilha
                  ? 'registrada na planilha antiga'
                  : c.manual
                    ? `concluído à mão${c.concluida_por_nome ? ` por ${c.concluida_por_nome}` : ''}`
                    : c.ciclo_iniciado_em
                    ? `volta completa em ${diasEntre(c.ciclo_iniciado_em, c.data)} dias (desde ${formatarData(c.ciclo_iniciado_em)})`
                    : 'concluído pelo sistema'}
              </small>
            </li>
          ))}
        </ul>
      )}

      <h3>Trabalho por dia</h3>
      {dias.length === 0 ? (
        <p className="dica">Nenhuma quadra marcada ainda.</p>
      ) : (
        <ul className="linha-do-tempo">
          {dias.slice(0, 15).map((d) => (
            <li key={`${d.data}-${d.nome}-${d.ciclo}`} className={d.ciclo === cicloAtual ? 'ciclo-atual' : ''}>
              <strong>{diaSemana(d.data)} {formatarData(d.data)}</strong> · {d.nome}
              <small className="dica obs">
                {d.quadras} {d.quadras === 1 ? 'quadra' : 'quadras'}{d.ciclo === cicloAtual ? ' · volta atual' : ' · volta anterior'}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
