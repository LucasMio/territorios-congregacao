// Ajuda "Como usar": os 3 passos do dirigente, com figuras simples que imitam as telas do sistema.
import { Link } from 'react-router-dom';
import Abas from '../componentes/Abas.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Icone from '../componentes/Icone.jsx';
import { useSessao } from '../sessao.jsx';
import { useMouse } from '../lib/tela.js';

export default function Ajuda() {
  const { perfil } = useSessao();
  const admin = perfil.papel === 'admin';
  const toque = useMouse() ? 'Clique' : 'Toque';

  return (
    <div className="pagina">
      <BarraTopo voltarPara="/" voltarRotulo="Programação" />
      <Abas />
      <main id="conteudo" className="ajuda">
        <section className="saudacao">
          <h1>Como usar</h1>
          <p>São só 3 passos no dia da sua saída de campo.</p>
        </section>

        <ol className="passos-ajuda">
          <li className="cartao">
            <h2><span className="numero-passo" aria-hidden="true">1</span> Veja a sua saída</h2>
            <p>Na tela <strong>Programação</strong>, o quadro verde <strong>“Sua próxima saída”</strong> mostra o dia, a hora, o local e o território.</p>
            <div className="figura-ajuda" aria-hidden="true">
              <div className="fig-cartao">
                <span className="fig-titulo"><Icone nome="pessoa" tamanho={16} /> Sua próxima saída</span>
                <strong>Sábado, 08:30 · Salão do Reino</strong>
                <span>Nº 12 — Jardim Exemplo</span>
              </div>
            </div>
          </li>

          <li className="cartao">
            <h2><span className="numero-passo" aria-hidden="true">2</span> Abra o território</h2>
            <p>{toque} no botão verde <strong>“Abrir o território”</strong>. Aparece o mapa com as quadras numeradas.</p>
            <p>O botão <strong>“Como chegar à quadra”</strong> abre o caminho no Google Maps.</p>
            <div className="figura-ajuda" aria-hidden="true">
              <span className="fig-botao"><Icone nome="mapa" tamanho={18} /> Abrir o território 12</span>
            </div>
          </li>

          <li className="cartao">
            <h2><span className="numero-passo" aria-hidden="true">3</span> Marque as quadras feitas</h2>
            <p>Depois do trabalho, {toque.toLowerCase()} em <strong>“Marcar quadras trabalhadas”</strong> e {toque.toLowerCase()} em cada quadra que foi feita. Ela fica verde.</p>
            <p>{toque === 'Toque' ? 'Tocou' : 'Clicou'} errado? {toque} de novo para desmarcar. No fim, {toque.toLowerCase()} em <strong>“Terminei”</strong>.</p>
            <div className="figura-ajuda" aria-hidden="true">
              <div className="fig-quadras">
                {[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={n <= 3 ? 'feita' : ''}>{n <= 3 && <Icone nome="check" tamanho={14} />}{n}</span>)}
              </div>
            </div>
            <p className="dica">Quando todas as quadras ficam verdes, o território é concluído sozinho.</p>
          </li>
        </ol>

        <section className="cartao" aria-labelledby="titulo-duvidas">
          <h2 id="titulo-duvidas"><Icone nome="info" /> Outras dúvidas</h2>
          <dl className="duvidas">
            <dt>Não vou poder dirigir. E agora?</dt>
            <dd>No quadro “Sua próxima saída”, {toque.toLowerCase()} em <strong>“Preciso de substituto”</strong>. Outro dirigente pode assumir pelo sistema.</dd>
            <dt>E se a internet cair no campo?</dt>
            <dd>Abra o território em casa, com Wi-Fi. Depois, sem internet, ele abre e as quadras marcadas ficam guardadas no celular. Elas são enviadas sozinhas quando a internet voltar.</dd>
            <dt>Domingo dos grupos</dt>
            <dd>O chefe do grupo escolhe o território. Ele vê os territórios do grupo em <strong>“Meus territórios”</strong>.</dd>
            <dt>A letra está pequena / a tela está clara demais</dt>
            <dd>Na barra azul do topo, toque no botão <strong>“Aa”</strong>. Ali você escolhe a letra maior e as cores (claro ou escuro).</dd>
            <dt>Esqueci a senha</dt>
            <dd>Na tela de entrar, toque em <strong>“Pedir código novo pelo WhatsApp”</strong>. A mensagem já vai pronta para o responsável, que manda um código novo.</dd>
            {admin && (
              <>
                <dt>Administradores</dt>
                <dd>A aba <strong>Territórios</strong> mostra todos. Na página do território dá para desenhar o mapa e concluir à mão. Na <strong>Programação</strong>, o botão “Alterar” troca o dirigente ou o território do dia.</dd>
              </>
            )}
          </dl>
        </section>

        <p><Link className="botao" to="/"><Icone nome="calendario" tamanho={18} /> Ir para a Programação</Link></p>
      </main>
    </div>
  );
}
