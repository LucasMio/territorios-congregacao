// Só para o administrador master: quem já entrou no sistema, quem ainda não, último uso e quadras marcadas.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase.js';
import { formatarTelefone } from '../lib/telefone.js';
import { formatarData } from '../lib/situacao.js';
import Abas from '../componentes/Abas.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Esqueleto from '../componentes/Esqueleto.jsx';
import Icone from '../componentes/Icone.jsx';

/** "hoje às 09:56", "ontem às 18:10", "há 5 dias", "nunca" */
function quando(iso) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  const fmt = (x) => x.toLocaleDateString('en-CA', { timeZone: 'America/Cuiaba' });
  const dias = Math.round((new Date(fmt(new Date())) - new Date(fmt(d))) / 86400000);
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit' });
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  return `há ${dias} dias (${d.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })})`;
}

const FILTROS = { todos: 'Todos', faltam: 'Ainda não entraram', entraram: 'Já entraram' };

export default function Acessos() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    supabase.rpc('painel_acessos').then(({ data, error }) => (error ? setErro(error.message) : setLista(data)));
  }, []);

  const entraram = (lista ?? []).filter((p) => p.entrou).length;
  const visiveis = useMemo(
    () =>
      (lista ?? [])
        .filter((p) => filtro === 'todos' || (filtro === 'entraram') === p.entrou)
        // Quem ainda não entrou primeiro; depois quem usou há mais tempo.
        .sort((a, b) => a.entrou - b.entrou || (a.ultimo_uso ?? '').localeCompare(b.ultimo_uso ?? '') || a.nome.localeCompare(b.nome)),
    [lista, filtro],
  );

  return (
    <div className="pagina larga">
      <BarraTopo />
      <Abas />
      <main id="conteudo">
        <section className="saudacao">
          <h1>Acessos dos irmãos</h1>
          <p>Só você (administrador master) vê esta página.</p>
        </section>

        <Aviso tipo="erro">{erro && `Não foi possível carregar: ${erro}`}</Aviso>
        {!lista && !erro && <Esqueleto rotulo="Carregando os acessos…" tipo="lista" quantos={4} />}

        {lista && (
          <>
            <div className="resumo-acessos">
              <div className="cartao numero-destaque recente">
                <strong>{entraram}</strong> de {lista.length}
                <span>já entraram e criaram a senha</span>
              </div>
              <div className="cartao numero-destaque atencao">
                <strong>{lista.length - entraram}</strong>
                <span>ainda não entraram</span>
              </div>
            </div>

            <div className="barra-filtros-prog" role="group" aria-label="Filtrar">
              {Object.entries(FILTROS).map(([k, v]) => (
                <button key={k} className="secundario pequeno" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{v}</button>
              ))}
            </div>

            <section className="cartao">
              <table className="tabela-programacao tabela-acessos">
                <caption className="so-leitor">Irmãos cadastrados e situação do acesso</caption>
                <thead>
                  <tr>
                    <th scope="col">Irmão</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Último uso</th>
                    <th scope="col">Quadras marcadas</th>
                    <th scope="col">Próxima saída</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((p) => (
                    <tr key={p.id} className={p.entrou ? '' : 'falta-entrar'}>
                      <td data-rotulo="Irmão">
                        <strong>{p.nome}</strong>
                        {p.papel === 'admin' && <span className="selo">Admin</span>}
                        {!p.ativo && <span className="selo inativo">Desativado</span>}
                        <small className="dica obs">{formatarTelefone(p.telefone)}</small>
                      </td>
                      <td data-rotulo="Situação">
                        {p.entrou ? (
                          <span className="etiqueta recente"><Icone nome="check" tamanho={16} /> Entrou</span>
                        ) : (
                          <span className="etiqueta atencao"><Icone nome="relogio" tamanho={16} /> Ainda não entrou</span>
                        )}
                      </td>
                      <td data-rotulo="Último uso">{p.entrou ? quando(p.ultimo_uso) : '—'}</td>
                      <td data-rotulo="Quadras">
                        {p.quadras_marcadas || '0'}
                        {p.ultima_marcacao && <small className="dica obs">última em {formatarData(p.ultima_marcacao)}</small>}
                      </td>
                      <td data-rotulo="Próxima saída">{p.proxima_saida ? formatarData(p.proxima_saida).slice(0, 5) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <p className="dica">
              Alguém perdeu o código ou esqueceu a senha? Peça para gerar um código novo e enviar pelo WhatsApp
              (no computador: <code>npm run enviar-acesso -- "Nome do irmão"</code>, na pasta territorios).
            </p>
          </>
        )}
      </main>
    </div>
  );
}
