// Tema da tela: "auto" (segue o celular), "claro" ou "escuro". Guardado só neste aparelho.
const CHAVE = 'territorios:tema';
export const TEMAS = ['auto', 'claro', 'escuro'];

export function lerTema() {
  try {
    const t = localStorage.getItem(CHAVE);
    return TEMAS.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function aplicarTema(tema) {
  const raiz = document.documentElement;
  if (tema === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // sem armazenamento: vale só até fechar
  }
}

// Tamanho da letra: "normal", "grande" ou "maior". Também guardado só neste aparelho.
const CHAVE_LETRA = 'territorios:letra';
export const LETRAS = ['normal', 'grande', 'maior'];

export function lerLetra() {
  try {
    const l = localStorage.getItem(CHAVE_LETRA);
    return LETRAS.includes(l) ? l : 'normal';
  } catch {
    return 'normal';
  }
}

export function aplicarLetra(letra) {
  const raiz = document.documentElement;
  if (letra === 'normal') raiz.removeAttribute('data-letra');
  else raiz.setAttribute('data-letra', letra);
  try {
    localStorage.setItem(CHAVE_LETRA, letra);
  } catch {
    // sem armazenamento: vale só até fechar
  }
}
