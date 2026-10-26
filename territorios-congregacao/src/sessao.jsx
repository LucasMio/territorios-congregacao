// Quem está logado: a sessão do Supabase + o perfil do irmão (nome, papel, se precisa trocar a senha).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const Contexto = createContext(null);

export function ProvedorSessao({ children }) {
  const [sessao, setSessao] = useState(undefined); // undefined = ainda carregando
  const [perfil, setPerfil] = useState(null);
  const [erroPerfil, setErroPerfil] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => setSessao(novaSessao));
    return () => data.subscription.unsubscribe();
  }, []);

  const carregarPerfil = useCallback(async () => {
    if (!sessao) {
      setPerfil(null);
      return;
    }
    const { data, error } = await supabase.from('perfis').select('id, nome, telefone, papel, ativo, precisa_trocar_senha, master').eq('id', sessao.user.id).maybeSingle();
    if (error) setErroPerfil(error.message);
    setPerfil(data ?? null);
    if (data) supabase.rpc('registrar_acesso').then(() => {}, () => {}); // "último uso" para a página Acessos
  }, [sessao]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  const sair = () => supabase.auth.signOut();

  return <Contexto.Provider value={{ sessao, perfil, erroPerfil, carregarPerfil, sair }}>{children}</Contexto.Provider>;
}

export const useSessao = () => useContext(Contexto);
