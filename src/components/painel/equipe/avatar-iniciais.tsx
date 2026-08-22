import { iniciaisDe } from "@/components/painel/navegacao";

export function AvatarIniciais({
  nome,
  email,
  className = "",
}: {
  nome?: string | null;
  email?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-salvia/15 text-sm font-medium text-floresta ${className}`}
    >
      {iniciaisDe(nome, email)}
    </span>
  );
}
