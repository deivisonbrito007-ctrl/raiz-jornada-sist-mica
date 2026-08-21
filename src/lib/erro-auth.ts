/**
 * Traduz as falhas do serviço de autenticação para mensagens humanas em
 * português. Nunca repassamos o texto cru do backend para a pessoa: as
 * mensagens originais são em inglês e falam de "credentials", "grant" e
 * outros termos que não ajudam quem só quer entrar no app.
 */

export type CategoriaErroAuth =
  | "credencial_invalida"
  | "email_nao_confirmado"
  | "email_em_uso"
  | "senha_fraca"
  | "email_invalido"
  | "muitas_tentativas"
  | "sem_conexao"
  | "link_expirado"
  | "senha_igual"
  | "desconhecido";

const REGRAS: { categoria: CategoriaErroAuth; trechos: string[] }[] = [
  {
    categoria: "credencial_invalida",
    trechos: ["invalid login credentials", "invalid_credentials", "invalid grant"],
  },
  {
    categoria: "email_nao_confirmado",
    trechos: ["email not confirmed", "email_not_confirmed"],
  },
  {
    categoria: "email_em_uso",
    trechos: [
      "user already registered",
      "already been registered",
      "user_already_exists",
      "email address already",
    ],
  },
  {
    categoria: "senha_fraca",
    trechos: ["password should be at least", "weak_password", "password is too short"],
  },
  {
    categoria: "email_invalido",
    trechos: ["unable to validate email", "invalid email", "email_address_invalid"],
  },
  {
    categoria: "muitas_tentativas",
    trechos: ["too many requests", "rate limit", "over_email_send_rate_limit", "429"],
  },
  {
    categoria: "sem_conexao",
    trechos: ["failed to fetch", "network", "load failed", "timeout"],
  },
  {
    categoria: "link_expirado",
    trechos: [
      "token has expired",
      "otp_expired",
      "invalid or expired",
      "auth session missing",
      "session not found",
    ],
  },
  {
    categoria: "senha_igual",
    trechos: ["should be different from the old password", "same_password"],
  },
];

export const MENSAGEM_POR_CATEGORIA_AUTH: Record<CategoriaErroAuth, string> = {
  credencial_invalida: "E-mail ou senha não conferem. Confira e tente de novo.",
  email_nao_confirmado:
    "Falta confirmar seu e-mail. Abra o link que enviamos para você antes de entrar.",
  email_em_uso: "Este e-mail já tem uma conta no Raiz. Entre com sua senha ou recupere o acesso.",
  senha_fraca: "Escolha uma senha com pelo menos 6 caracteres.",
  email_invalido: "Esse endereço de e-mail não parece válido. Confira e tente novamente.",
  muitas_tentativas: "Muitas tentativas em pouco tempo. Respire e tente novamente em instantes.",
  sem_conexao: "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.",
  link_expirado: "Este link já expirou. Peça um novo link de recuperação para continuar.",
  senha_igual: "A nova senha precisa ser diferente da anterior.",
  desconhecido: "Não foi possível continuar agora. Tente novamente em alguns instantes.",
};

export function classificarErroAuth(erro: unknown): CategoriaErroAuth {
  const bruto =
    erro instanceof Error
      ? `${erro.message} ${(erro as { code?: string }).code ?? ""}`
      : typeof erro === "string"
        ? erro
        : "";
  const texto = bruto.toLowerCase();
  if (!texto.trim()) return "desconhecido";
  for (const regra of REGRAS) {
    if (regra.trechos.some((t) => texto.includes(t))) return regra.categoria;
  }
  return "desconhecido";
}

/** Mensagem pronta para exibir ao usuário. */
export function mensagemErroAuth(erro: unknown): string {
  return MENSAGEM_POR_CATEGORIA_AUTH[classificarErroAuth(erro)];
}
