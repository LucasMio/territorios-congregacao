import { useState } from 'react';
import { supabase } from '../supabase.js';
import { emailDoTelefone, linkEsqueciSenha, mascaraTelefone, normalizarTelefone } from '../lib/telefone.js';
import Aviso from '../componentes/Aviso.jsx';
import CampoSenha from '../componentes/CampoSenha.jsx';
import Icone from '../componentes/Icone.jsx';

export default function Entrar() {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    const tel = normalizarTelefone(telefone);
    if (!tel) {
      setErro('Telefone incompleto. Digite o DDD e o número, por exemplo: (66) 99999-1234.');
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailDoTelefone(tel), password: senha.trim() });
    setEnviando(false);
    if (error) {
      setErro(
        /invalid/i.test(error.message)
          ? 'Telefone ou senha não conferem. Confira os números e tente de novo. No primeiro acesso, use o código que você recebeu pelo WhatsApp. Esqueceu a senha? Use o botão lá embaixo.'
          : /fetch|network/i.test(error.message)
            ? 'Sem conexão com a internet. Confira o sinal e tente de novo.'
            : `Não foi possível entrar: ${error.message}`,
      );
    }
  }

  return (
    <main className="cartao-login">
      <div className="logo"><Icone nome="mapa" tamanho={34} /></div>
      <h1>Territórios</h1>
      <p className="dica">Congregação Vila Exemplo</p>
      <form onSubmit={entrar} noValidate>
        <div className="campo">
          <label htmlFor="telefone">Seu telefone (com DDD)</label>
          <input
            id="telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            placeholder="(66) 99999-1234"
            value={telefone}
            onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
            required
          />
        </div>
        <CampoSenha
          rotulo="Senha"
          explicacao="No primeiro acesso, use o código de 6 números que você recebeu."
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <Aviso tipo="erro">{erro}</Aviso>
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="dica">Depois de entrar, você continua conectado neste celular até tocar em "Sair".</p>
      <div className="esqueci-senha">
        <p className="dica">Esqueceu a senha? Peça um código novo ao responsável pelos territórios.</p>
        <a className="botao secundario" href={linkEsqueciSenha(telefone)} target="_blank" rel="noreferrer">
          <Icone nome="conversa" tamanho={20} /> Pedir código novo pelo WhatsApp
        </a>
      </div>
    </main>
  );
}
