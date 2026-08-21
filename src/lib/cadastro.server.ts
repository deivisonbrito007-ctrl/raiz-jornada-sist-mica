import { createHash } from "node:crypto";

/**
 * O controle de limite do banco espera um uuid de usuário, mas a conferência de
 * convite acontece antes de existir conta. Derivamos um uuid estável do e-mail
 * (hash), assim o limite vale por endereço sem guardar o e-mail em claro na
 * tabela de limites.
 */
export function chaveLimitePorEmail(email: string): string {
  const h = createHash("sha256").update(`convite:${email.trim().toLowerCase()}`).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join(
    "-",
  );
}
