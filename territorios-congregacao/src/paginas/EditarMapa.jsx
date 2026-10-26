// Tela do administrador: desenhar o contorno do território, gerar as quadras e corrigi-las.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase.js';
import Mapa, { Contorno, Enquadrar, Quadras } from '../componentes/Mapa.jsx';
import Desenho from '../componentes/Desenho.jsx';
import Aviso from '../componentes/Aviso.jsx';
import BarraTopo from '../componentes/BarraTopo.jsx';
import Icone from '../componentes/Icone.jsx';
import { carregarRuas } from '../lib/ruas.js';
import { areaM2, caixaComMargem, contornoValido, dividirQuadra, gerarQuadras, juntarQuadras, renumerar } from '../lib/quadras.js';

const AJUDA = {
  contorno: 'Toque no mapa para marcar cada canto do território. Para fechar, toque no primeiro ponto.',
  ajustar: 'Arraste os pontos do contorno. Toque em "Concluir ajuste" quando terminar.',
  linha: 'Desenhe a linha que divide a quadra (ex.: uma rua que falta). Toque duas vezes no último ponto para terminar.',
};

export default function EditarMapa() {
  const { numero } = useParams();
  const navegar = useNavigate();
  const [territorio, setTerritorio] = useState(null);
  const [contorno, setContorno] = useState(null);
  const [quadras, setQuadras] = useState([]);
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [modo, setModo] = useState('nenhum');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [alterado, setAlterado] = useState(false);
  const lerAjuste = useRef(null);

  useEffect(() => {
    (async () => {
      const { data: t, error } = await supabase.from('territorios').select('numero, bairro, lat, lng, contorno, link_mapa').eq('numero', Number(numero)).maybeSingle();
      if (error || !t) return setErro(error?.message ?? 'Território não encontrado.');
      const { data: qs } = await supabase.from('quadras').select('numero, geometria, area_m2').eq('territorio_numero', t.numero).order('numero');
      setTerritorio(t);
      setContorno(contornoValido(t.contorno) ? t.contorno : null);
      setQuadras((qs ?? []).map((q) => ({ numero: q.numero, geometria: q.geometria, areaM2: q.area_m2 })));
    })();
  }, [numero]);

  // Computador: Esc cancela o que está fazendo (desenho, ajuste ou seleção).
  useEffect(() => {
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setModo('nenhum');
      setSelecionadas(new Set());
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const mudar = (novasQuadras) => {
    setQuadras(renumerar(novasQuadras));
    setSelecionadas(new Set());
    setAlterado(true);
  };

  const aoTerminarContorno = useCallback((geo) => {
    setContorno(geo);
    setModo('nenhum');
    setAlterado(true);
    setMensagem('Contorno desenhado. Agora toque em "Gerar quadras".');
  }, []);

  const aoTerminarLinha = useCallback(
    (pontos) => {
      setModo('nenhum');
      const [alvo] = [...selecionadas];
      const quadra = quadras.find((q) => q.numero === alvo);
      const pedacos = quadra && dividirQuadra(quadra.geometria, pontos);
      if (!pedacos) return setMensagem('A linha precisa atravessar a quadra de um lado ao outro. Tente de novo.');
      mudar([...quadras.filter((q) => q.numero !== alvo), ...pedacos]);
      setMensagem(`Quadra dividida em ${pedacos.length}.`);
    },
    [quadras, selecionadas],
  );

  const registrarAjuste = useCallback((f) => {
    lerAjuste.current = f;
  }, []);

  function concluirAjuste() {
    const geo = lerAjuste.current?.();
    if (geo) {
      setContorno(geo);
      setAlterado(true);
      setMensagem(quadras.length ? 'Contorno ajustado. Gere as quadras de novo para elas acompanharem o contorno.' : 'Contorno ajustado.');
    }
    setModo('nenhum');
  }

  async function gerar() {
    if (quadras.length && !window.confirm('Isso substitui as quadras atuais pelas geradas agora. Continuar?')) return;
    setErro('');
    setOcupado(true);
    try {
      const ruas = await carregarRuas(caixaComMargem(contorno), setMensagem);
      const geradas = gerarQuadras(contorno, ruas);
      mudar(geradas);
      setMensagem(
        geradas.length
          ? `${geradas.length} quadras geradas a partir de ${ruas.length} ruas. Confira: toque numa quadra para selecionar e apagar, juntar ou dividir.`
          : 'Nenhuma quadra encontrada dentro do contorno. Confira o desenho.',
      );
    } catch (e) {
      setErro(e.message);
      setMensagem('');
    } finally {
      setOcupado(false);
    }
  }

  const alternar = (n) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(n)) nova.delete(n);
      else nova.add(n);
      return nova;
    });

  function apagar() {
    mudar(quadras.filter((q) => !selecionadas.has(q.numero)));
    setMensagem(`${selecionadas.size} quadra(s) apagada(s).`);
  }

  function juntar() {
    const escolhidas = quadras.filter((q) => selecionadas.has(q.numero));
    const geometria = juntarQuadras(escolhidas.map((q) => q.geometria));
    if (!geometria) return setMensagem('Não consegui juntar essas quadras.');
    mudar([...quadras.filter((q) => !selecionadas.has(q.numero)), { geometria, areaM2: areaM2(geometria) }]);
    setMensagem(`${escolhidas.length} quadras juntadas em uma.`);
  }

  async function salvar() {
    if (!contornoValido(contorno)) return setErro('O contorno está vazio ou incompleto. Desenhe o contorno de novo antes de salvar.');
    const { data: prog } = await supabase.from('progresso_territorios').select('feitas_no_ciclo').eq('numero', territorio.numero).maybeSingle();
    if (prog?.feitas_no_ciclo > 0 && !window.confirm(`Este território tem ${prog.feitas_no_ciclo} ${prog.feitas_no_ciclo === 1 ? 'quadra marcada' : 'quadras marcadas'} na volta atual. Salvar o mapa novo apaga essas marcações. Continuar?`)) return;
    setOcupado(true);
    setErro('');
    const { error } = await supabase.rpc('salvar_mapa_territorio', {
      p_numero: territorio.numero,
      p_contorno: contorno,
      p_quadras: quadras.map((q) => ({ numero: q.numero, geometria: q.geometria, area_m2: q.areaM2 })),
    });
    setOcupado(false);
    if (error) return setErro(`Não foi possível salvar: ${error.message}`);
    setAlterado(false);
    navegar(`/territorio/${territorio.numero}`);
  }

  function sair() {
    if (alterado && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    navegar(`/territorio/${numero}`);
  }

  if (erro && !territorio) return <div className="pagina"><BarraTopo voltarPara="/territorios" voltarRotulo="Territórios" /><main><Aviso tipo="erro">{erro}</Aviso></main></div>;
  if (!territorio) return <div className="pagina"><BarraTopo voltarPara={`/territorio/${numero}`} /><main><p role="status">Carregando…</p></main></div>;

  const n = selecionadas.size;
  const centro = territorio.lat != null ? [territorio.lat, territorio.lng] : undefined;

  return (
    <div className="pagina larga">
      <BarraTopo aoVoltar={sair} voltarRotulo={`Território ${territorio.numero}`} />
      <main id="conteudo" className="layout-editor">
        <div className="coluna-lateral">
          <div className="o1">
            <h1>Desenhar mapa do território {territorio.numero}</h1>
            <p className="dica">{territorio.bairro}</p>
            <ol className="passos">
              <li>Desenhe o contorno</li>
              <li>Gere as quadras</li>
              <li>Confira, corrija e salve</li>
            </ol>
          </div>

          <div className="barra-ferramentas o2" role="toolbar" aria-label="Ferramentas do mapa">
            {modo === 'nenhum' && (
              <>
                <button className="secundario" onClick={() => setModo('contorno')} disabled={ocupado}><Icone nome="lapis" tamanho={18} /> {contorno ? 'Redesenhar contorno' : 'Desenhar contorno'}</button>
                {contorno && <button className="secundario" onClick={() => setModo('ajustar')} disabled={ocupado}>Ajustar pontos</button>}
                {contorno && <button onClick={gerar} disabled={ocupado}>{ocupado ? 'Gerando…' : quadras.length ? 'Gerar quadras de novo' : 'Gerar quadras'}</button>}
                {n >= 1 && <button className="perigo" onClick={apagar}>Apagar ({n})</button>}
                {n >= 2 && <button className="secundario" onClick={juntar}>Juntar ({n})</button>}
                {n === 1 && <button className="secundario" onClick={() => setModo('linha')}>Dividir quadra</button>}
              </>
            )}
            {modo === 'ajustar' && <button onClick={concluirAjuste}>Concluir ajuste</button>}
            {modo !== 'nenhum' && <button className="secundario" onClick={() => setModo('nenhum')}>Cancelar</button>}
          </div>

          <div className="o3">
            <Aviso>{modo !== 'nenhum' ? AJUDA[modo] : mensagem}</Aviso>
            <Aviso tipo="erro">{erro}</Aviso>
            {modo === 'nenhum' && quadras.length > 0 && !mensagem && <p className="dica">Clique ou toque nas quadras para selecionar (pode escolher várias).</p>}
            {territorio.link_mapa && (
              <a className="botao secundario largo so-computador" href={territorio.link_mapa} target="_blank" rel="noreferrer">
                <Icone nome="imagem" /> Abrir o mapa antigo em outra aba
              </a>
            )}
          </div>

          <div className="rodape-acoes o9">
            <span className="dica" role="status">{quadras.length} quadra(s){n ? ` · ${n} selecionada(s)` : ''}{alterado ? ' · não salvo ainda' : ''}</span>
            <button className="verde" onClick={salvar} disabled={ocupado || !alterado || !contornoValido(contorno)}>Salvar mapa</button>
          </div>
        </div>

        <div className="coluna-mapa o4">
          <Mapa centro={centro} zoom={17}>
            <Enquadrar geometria={contorno} />
            {modo !== 'ajustar' && <Contorno geometria={contorno} />}
            <Quadras quadras={quadras} selecionadas={selecionadas} aoClicar={modo === 'nenhum' ? alternar : undefined} />
            <Desenho modo={modo} contorno={contorno} aoTerminarContorno={aoTerminarContorno} aoTerminarLinha={aoTerminarLinha} registrarAjuste={registrarAjuste} />
          </Mapa>
        </div>
      </main>
    </div>
  );
}
