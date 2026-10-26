// Campo de senha com o botão "Mostrar", para conferir o que foi digitado.
import { useId, useState } from 'react';
import Icone from './Icone.jsx';

export default function CampoSenha({ rotulo, explicacao, ...props }) {
  const [visivel, setVisivel] = useState(false);
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {explicacao && <small id={`${id}-exp`}>{explicacao}</small>}
      <div className="com-botao">
        <input id={id} type={visivel ? 'text' : 'password'} aria-describedby={explicacao ? `${id}-exp` : undefined} {...props} />
        <button type="button" onClick={() => setVisivel(!visivel)} aria-pressed={visivel} aria-label={visivel ? 'Esconder senha' : 'Mostrar senha'}>
          <Icone nome={visivel ? 'olhoFechado' : 'olho'} />
        </button>
      </div>
    </div>
  );
}
