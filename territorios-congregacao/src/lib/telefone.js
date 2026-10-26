// Telefone brasileiro -> só dígitos com 55 + DDD + número (com o nono dígito).
// Usado no login (site) e nos comandos de administração.

/** "(66) 99999-1234" -> "5566999991234"; devolve null se não parecer um celular/fixo válido. */
export function normalizarTelefone(entrada, dddPadrao = '') {
  let d = String(entrada ?? '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if ((d.length === 8 || d.length === 9) && dddPadrao) d = String(dddPadrao).replace(/\D/g, '') + d;
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2);
  let numero = d.slice(2);
  if (Number(ddd) < 11) return null;
  if (numero.length === 8 && Number(numero[0]) >= 6) numero = `9${numero}`; // celular antigo sem o 9
  if (numero.length === 9 && numero[0] !== '9') return null;
  return `55${ddd}${numero}`;
}

/** "5566999991234" -> "(66) 99999-1234" */
export function formatarTelefone(digitos) {
  const d = String(digitos ?? '').replace(/^55/, '');
  if (d.length < 10) return digitos ?? '';
  const ddd = d.slice(0, 2);
  const n = d.slice(2);
  return `(${ddd}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
}

// O login do Supabase usa e-mail + senha. Para o irmão entrar só com o telefone,
// cada telefone vira um "e-mail" interno. Nenhum e-mail é enviado para esse endereço.
const DOMINIO_INTERNO = 'login.exemplo.app';

export function emailDoTelefone(telefoneNormalizado) {
  return `${telefoneNormalizado}@${DOMINIO_INTERNO}`;
}

/** Formata enquanto a pessoa digita: "6699999" -> "(66) 9999-9", até "(66) 99999-1234". */
export function mascaraTelefone(texto) {
  const d = String(texto ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const n = d.slice(2);
  if (n.length <= 4) return `(${ddd}) ${n}`;
  const corte = n.length === 9 ? 5 : 4; // o traço muda de lugar quando chega o 9º dígito
  return `(${ddd}) ${n.slice(0, corte)}${n.length > corte ? `-${n.slice(corte)}` : ''}`;
}

// Responsável pelos territórios (o Ricardo): recebe no WhatsApp os pedidos de código novo.
export const RESPONSAVEL = { nome: 'Ricardo', telefone: '5511900000000' };

/** Link do WhatsApp do responsável com a mensagem pronta pedindo um código novo (inclui o telefone digitado, se completo). */
export function linkEsqueciSenha(telefoneDigitado) {
  const tel = normalizarTelefone(telefoneDigitado);
  const texto = `Olá, ${RESPONSAVEL.nome}! Esqueci a senha do sistema de territórios.`
    + (tel ? ` Meu telefone de acesso é ${formatarTelefone(tel)}.` : '')
    + ' Pode me mandar um código novo?';
  return `https://wa.me/${RESPONSAVEL.telefone}?text=${encodeURIComponent(texto)}`;
}
