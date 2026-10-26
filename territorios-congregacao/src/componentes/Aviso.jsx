// Mensagens na tela. role="status"/"alert" faz o leitor de tela anunciar a mensagem quando ela aparece.
import Icone from './Icone.jsx';

const TIPOS = {
  aviso: { icone: 'info', papel: 'status' },
  sucesso: { icone: 'check', papel: 'status' },
  erro: { icone: 'alerta', papel: 'alert' },
};

export default function Aviso({ tipo = 'aviso', children }) {
  if (!children) return null;
  const t = TIPOS[tipo];
  return (
    <p className={tipo} role={t.papel}>
      <Icone nome={t.icone} />
      <span>{children}</span>
    </p>
  );
}
