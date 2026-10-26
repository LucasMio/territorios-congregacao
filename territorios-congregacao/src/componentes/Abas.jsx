// Navegação entre as telas principais (abaixo da barra azul).
import { NavLink } from 'react-router-dom';
import { useSessao } from '../sessao.jsx';
import Icone from './Icone.jsx';

export default function Abas() {
  const { perfil } = useSessao();
  const admin = perfil?.papel === 'admin';
  const abas = [
    { para: '/', rotulo: 'Programação', icone: 'calendario', fim: true },
    { para: '/territorios', rotulo: admin ? 'Territórios' : 'Meus territórios', icone: 'lista' },
    { para: '/mapa', rotulo: 'Mapa geral', icone: 'mapa' },
    { para: '/progresso', rotulo: 'Progresso', icone: 'grafico' },
    ...(perfil?.master ? [{ para: '/acessos', rotulo: 'Acessos', icone: 'pessoa' }] : []),
  ];
  return (
    <nav className="abas" aria-label="Telas do sistema">
      {abas.map((a) => (
        <NavLink key={a.para} to={a.para} end={a.fim} className={({ isActive }) => (isActive ? 'ativa' : '')}>
          <Icone nome={a.icone} tamanho={20} /> <span>{a.rotulo}</span>
        </NavLink>
      ))}
    </nav>
  );
}
