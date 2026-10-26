import { useState } from 'react';
import { supabase } from '../supabase.js';
import { useSessao } from '../sessao.jsx';
import { formatarTelefone } from '../lib/telefone.js';
import Aviso from '../componentes/Aviso.jsx';
import CampoSenha from '../componentes/CampoSenha.jsx';

export default function TrocarSenha() {
  const { perfil, carregarPerfil, sair } = useSessao();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 letras ou números.');
    if (senha !== confirmacao) return setErro('As duas senhas não estão iguais. Digite de novo.');
    if (/^\d{6}$/.test(senha)) return setErro('Escolha uma senha diferente do código de acesso (não use só 6 números).');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      setEnviando(false);
      return setErro(`Não foi possível salvar: ${error.message}`);
    }
    await supabase.rpc('marcar_senha_trocada');
    await carregarPerfil();
  }

  return (
    <main className="cartao-login">
      <h1>Bem-vindo, {perfil.nome.split(' ')[0]}!</h1>
      <p>Agora crie a sua senha. É ela que você vai usar nas próximas vezes, junto com o telefone.</p>
      <form onSubmit={salvar} noValidate>
        {/* Escondido: faz o celular salvar a nova senha junto com o telefone (gerenciador de senhas). */}
        <input type="text" name="username" autoComplete="username" value={formatarTelefone(perfil.telefone)} readOnly hidden />
        <CampoSenha
          rotulo="Nova senha"
          explicacao="Pelo menos 6 letras ou números. Toque no olho para ver o que digitou."
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <CampoSenha rotulo="Repita a nova senha" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required />
        <Aviso tipo="erro">{erro}</Aviso>
        <button type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar senha e entrar'}</button>
      </form>
      <button className="link" onClick={sair}>Sair</button>
    </main>
  );
}
