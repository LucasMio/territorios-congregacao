// Blocos cinza no formato da tela enquanto os dados chegam (no lugar de "Carregando…").
// O leitor de tela ouve o texto do rótulo; os blocos ficam escondidos dele.

/** @param {{ rotulo: string, tipo?: 'cartoes' | 'lista' | 'territorio' | 'mapa', quantos?: number }} props */
export default function Esqueleto({ rotulo, tipo = 'cartoes', quantos = 3 }) {
  const linhas = Array.from({ length: quantos }, (_, i) => i);
  return (
    <div className={`esqueleto esqueleto-${tipo}`} role="status">
      <span className="so-leitor">{rotulo}</span>
      <div aria-hidden="true">
        {tipo === 'territorio' && (
          <>
            <div className="cartao esq-cabecalho"><span className="esq-bloco esq-numero" /><span className="esq-linhas"><span className="esq-bloco esq-linha larga" /><span className="esq-bloco esq-linha" /></span></div>
            <span className="esq-bloco esq-botao" />
            <div className="cartao"><span className="esq-bloco esq-mapa" /></div>
          </>
        )}
        {tipo === 'mapa' && <div className="cartao"><span className="esq-bloco esq-mapa alto" /></div>}
        {tipo === 'lista' && linhas.map((i) => (
          <div key={i} className="cartao esq-item"><span className="esq-bloco esq-numero pequeno" /><span className="esq-linhas"><span className="esq-bloco esq-linha larga" /><span className="esq-bloco esq-linha" /></span></div>
        ))}
        {tipo === 'cartoes' && linhas.map((i) => (
          <div key={i} className="cartao"><span className="esq-bloco esq-linha media" /><span className="esq-bloco esq-linha larga" /><span className="esq-bloco esq-linha" /></div>
        ))}
        <p className="esq-texto">{rotulo}</p>
      </div>
    </div>
  );
}
