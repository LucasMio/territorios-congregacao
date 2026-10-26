// Barra azul no topo de todas as telas: voltar (ou o nome do sistema), ajuda, letra e cores, e o botão Sair.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LETRAS, TEMAS, aplicarLetra, aplicarTema, lerLetra, lerTema } from '../lib/tema.js';
import { useSessao } from '../sessao.jsx';
import Icone from './Icone.jsx';

const NOMES_TEMA = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };
const ICONE_TEMA = { auto: 'automatico', claro: 'sol', escuro: 'lua' };
const NOMES_LETRA = { normal: 'Normal', grande: 'Grande', maior: 'Bem grande' };

/** Botão "Aa" que abre um quadrinho para escolher o tamanho da letra e as cores (fica guardado no aparelho). */
function LetraECores() {
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState(lerTema);
  const [letra, setLetra] = useState(lerLetra);
  const caixa = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!caixa.current?.contains(e.target)) setAberto(false); };
    const esc = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div className="letra-cores" ref={caixa}>
      <button className="pequeno botao-letra" aria-expanded={aberto} aria-controls="painel-letra-cores" onClick={() => setAberto(!aberto)} title="Letra e cores">
        <span aria-hidden="true"><span className="a-pequeno">A</span><span className="a-grande">a</span></span>
        <span className="so-leitor">Letra e cores</span>
        <span className="so-computador" aria-hidden="true">Letra e cores</span>
      </button>
      {aberto && (
        <div className="painel-letra-cores" id="painel-letra-cores">
          <fieldset>
            <legend>Tamanho da letra</legend>
            <div className="opcoes">
              {LETRAS.map((l) => (
                <button key={l} className={`opcao letra-${l}`} aria-pressed={letra === l} onClick={() => { aplicarLetra(l); setLetra(l); }}>
                  {letra === l && <Icone nome="check" tamanho={16} />} {NOMES_LETRA[l]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cores da tela</legend>
            <div className="opcoes">
              {TEMAS.map((t) => (
                <button key={t} className="opcao" aria-pressed={tema === t} onClick={() => { aplicarTema(t); setTema(t); }}>
                  <Icone nome={tema === t ? 'check' : ICONE_TEMA[t]} tamanho={16} /> {NOMES_TEMA[t]}
                </button>
              ))}
            </div>
            <p className="dica">Automático: igual ao celular.</p>
          </fieldset>
          <button className="secundario fechar" onClick={() => setAberto(false)}>Pronto</button>
        </div>
      )}
    </div>
  );
}

/** @param {{ voltarPara?: string, voltarRotulo?: string, aoVoltar?: () => void }} props */
export default function BarraTopo({ voltarPara, voltarRotulo = 'Voltar', aoVoltar }) {
  const { perfil, sair } = useSessao();

  function confirmarSaida() {
    if (!window.confirm('Sair do sistema? Para entrar de novo você vai precisar do telefone e da senha.')) return;
    // Apaga os dados de territórios guardados no celular para abrir sem internet.
    globalThis.caches?.delete('territorios-dados').catch(() => {});
    sair();
  }

  return (
    <header className="barra-topo">
      {aoVoltar ? (
        <button className="voltar" onClick={aoVoltar}><Icone nome="voltar" /> {voltarRotulo}</button>
      ) : voltarPara ? (
        <Link className="voltar" to={voltarPara}><Icone nome="voltar" /> {voltarRotulo}</Link>
      ) : (
        <span className="marca"><Icone nome="mapa" /> Territórios</span>
      )}
      <div className="direita">
        {perfil && (
          <span className="usuario so-computador">
            <Icone nome="pessoa" tamanho={18} /> {perfil.nome}{perfil.papel === 'admin' ? ' · administrador' : ''}
          </span>
        )}
        {perfil && (
          <Link className="botao pequeno botao-ajuda" to="/ajuda" title="Como usar">
            <span aria-hidden="true">?</span><span className="so-leitor">Ajuda: como usar</span>
            <span className="so-computador" aria-hidden="true">Ajuda</span>
          </Link>
        )}
        <LetraECores />
        <button className="pequeno" onClick={confirmarSaida}><Icone nome="sair" tamanho={18} /> Sair</button>
      </div>
    </header>
  );
}
