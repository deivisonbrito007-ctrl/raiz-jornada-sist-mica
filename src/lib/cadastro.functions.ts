import { createServerFn } from "@tanstack/react-start";

/**
 * Diz apenas se já existe algum terapeuta cadastrado (usado na tela de
 * cadastro para esconder a opção "sou terapeuta").
 *
 * Roda no servidor porque a função de banco `existe_terapeuta()` não é mais
 * executável sem login: nada do schema fica exposto para visitantes.
 */
export const existeTerapeuta = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("existe_terapeuta");
  // Falha fechado: na dúvida, esconde a opção de terapeuta.
  if (error) return { existe: true };
  return { existe: data !== false };
});
