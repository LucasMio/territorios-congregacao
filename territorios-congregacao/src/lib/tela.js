// Tamanho da tela e tipo de uso (dedo ou mouse), para adaptar textos e o layout.
import { useEffect, useState } from 'react';

function useMidia(consulta) {
  const [ativa, setAtiva] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudar = () => setAtiva(m.matches);
    m.addEventListener('change', mudar);
    return () => m.removeEventListener('change', mudar);
  }, [consulta]);
  return ativa;
}

/** Computador ou tablet deitado: tela com pelo menos 1024px de largura. */
export const useTelaGrande = () => useMidia('(min-width: 1024px)');

/** Usa mouse (computador): os textos dizem "clique" em vez de "toque". */
export const useMouse = () => useMidia('(hover: hover) and (pointer: fine)');
