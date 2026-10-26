import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { configurado } from './supabase.js';
import { ProvedorSessao, useSessao } from './sessao.jsx';
import Entrar from './paginas/Entrar.jsx';
import TrocarSenha from './paginas/TrocarSenha.jsx';
import Territorios from './paginas/Territorios.jsx';
import Territorio from './paginas/Territorio.jsx';
import EditarMapa from './paginas/EditarMapa.jsx';
import MapaGeral from './paginas/MapaGeral.jsx';
import Acessos from './paginas/Acessos.jsx';
import Progresso from './paginas/Progresso.jsx';
import Relatorio from './paginas/Relatorio.jsx';
import EnvioPendente from './componentes/EnvioPendente.jsx';
import Programacao from './paginas/Programacao.jsx';
import Ajuda from './paginas/Ajuda.jsx';
import '@fontsource-variable/noto-sans';
import './estilo.css';

/** Decide qual tela mostrar conforme o login. */
function Rotas() {
  const { sessao, perfil, erroPerfil, sair } = useSessao();

  if (sessao === undefined) return <p className="centro" role="status">Carregando…</p>;
  if (!sessao) {
    return (
      <Routes>
        <Route path="*" element={<Entrar />} />
      </Routes>
    );
  }
  if (!perfil) {
    return (
      <div className="centro">
        <p>{erroPerfil ? `Erro ao carregar seu cadastro: ${erroPerfil}` : 'Carregando seu cadastro…'}</p>
        <button className="secundario" onClick={sair}>Sair</button>
      </div>
    );
  }
  if (!perfil.ativo) {
    return (
      <div className="centro">
        <p>Seu acesso está desativado. Fale com o responsável pelos territórios.</p>
        <button className="secundario" onClick={sair}>Sair</button>
      </div>
    );
  }
  if (perfil.precisa_trocar_senha) return <TrocarSenha />;
  return (
    <>
    <EnvioPendente />
    <Routes>
      <Route path="/" element={<Programacao />} />
      <Route path="/territorios" element={<Territorios />} />
      <Route path="/mapa" element={<MapaGeral />} />
      <Route path="/progresso" element={<Progresso />} />
      <Route path="/ajuda" element={<Ajuda />} />
      {perfil.papel === 'admin' && <Route path="/relatorio" element={<Relatorio />} />}
      {perfil.master && <Route path="/acessos" element={<Acessos />} />}
      <Route path="/territorio/:numero" element={<Territorio />} />
      {perfil.papel === 'admin' && <Route path="/territorio/:numero/mapa" element={<EditarMapa />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

function App() {
  if (!configurado) {
    return (
      <div className="centro">
        <h1>Falta configurar</h1>
        <p>Cole as chaves do Supabase no arquivo <code>.env.local</code> e reinicie o site.</p>
      </div>
    );
  }
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Rotas />
      </BrowserRouter>
    </ProvedorSessao>
  );
}

// Guarda no celular o que já foi aberto, para abrir mesmo sem internet (só no site publicado).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
