// Fica de olho nas marcações guardadas sem internet: tenta enviar quando o sinal volta
// (e a cada 30 segundos) e mostra um aviso no canto da tela enquanto houver algo guardado.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { enviarFila, lerFila } from '../lib/filaOffline.js';
import Icone from './Icone.jsx';

export default function EnvioPendente() {
  const { perfil } = useSessao();
  const [pendentes, setPendentes] = useState(0);
  const [mensagem, setMensagem] = useState('');
  const [semInternet, setSemInternet] = useState(() => !navigator.onLine);

  useEffect(() => {
    const caiu = () => setSemInternet(true);
    const voltou = () => {
      setSemInternet(false);
      setMensagem((m) => m || 'Internet de volta.');
    };
    window.addEventListener('offline', caiu);
    window.addEventListener('online', voltou);
    return () => {
      window.removeEventListener('offline', caiu);
      window.removeEventListener('online', voltou);
    };
  }, []);

  const atualizar = useCallback(() => setPendentes(lerFila().filter((x) => x.usuario === perfil?.id).length), [perfil?.id]);

  const tentar = useCallback(async () => {
    if (!perfil || !lerFila().some((x) => x.usuario === perfil.id) || !navigator.onLine) return atualizar();
    const r = await enviarFila(supabase, perfil.id);
    atualizar();
    if (r.enviadas.length) {
      setMensagem(`Internet de volta: ${r.enviadas.length} ${r.enviadas.length === 1 ? 'quadra guardada foi enviada' : 'quadras guardadas foram enviadas'}.`);
      window.dispatchEvent(new Event('marcacoes-enviadas'));
    }
    if (r.recusadas.length) {
      setMensagem(`Não foi possível enviar ${r.recusadas.length === 1 ? '1 quadra' : `${r.recusadas.length} quadras`}: ${r.recusadas[0].motivo}. Fale com o responsável pelos territórios.`);
    }
  }, [perfil, atualizar]);

  useEffect(() => {
    tentar();
    const intervalo = setInterval(tentar, 30000);
    window.addEventListener('online', tentar);
    window.addEventListener('fila-marcacoes', atualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('online', tentar);
      window.removeEventListener('fila-marcacoes', atualizar);
    };
  }, [tentar, atualizar]);

  useEffect(() => {
    if (!mensagem) return;
    const t = setTimeout(() => setMensagem(''), 8000);
    return () => clearTimeout(t);
  }, [mensagem]);

  return (
    <div className="envio-pendente" role="status" aria-live="polite">
      {semInternet && pendentes === 0 && (
        <p className="aviso-offline">
          <Icone nome="alerta" tamanho={20} />
          <span><strong>Sem internet agora.</strong> O que você já abriu continua aparecendo, e dá para marcar quadras: elas ficam guardadas e são enviadas depois.</span>
        </p>
      )}
      {pendentes > 0 && (
        <p className="aviso-sem-internet">
          <Icone nome="alerta" tamanho={20} />
          <span>
            <strong>{pendentes} {pendentes === 1 ? 'quadra guardada' : 'quadras guardadas'} no celular.</strong> Serão enviadas sozinhas quando a internet voltar.
            Não feche o navegador nem saia do sistema.
          </span>
        </p>
      )}
      {mensagem && <p className="aviso-enviado"><Icone nome="check" tamanho={20} /> <span>{mensagem}</span></p>}
    </div>
  );
}
