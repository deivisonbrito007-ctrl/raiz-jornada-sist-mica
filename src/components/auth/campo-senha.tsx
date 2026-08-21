import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Campo de senha com alternância mostrar/ocultar. O botão tem alvo de toque
 * confortável e nome acessível que muda com o estado.
 */
export function CampoSenha({
  id = "senha",
  rotulo = "Senha",
  valor,
  onChange,
  autoComplete,
  dica,
}: {
  id?: string;
  rotulo?: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  dica?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const idDica = dica ? `${id}-dica` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Lock
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={6}
          required
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={idDica}
          className="h-13 rounded-2xl border-border bg-background pl-11 pr-12 text-base focus-visible:ring-terracota"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota"
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {dica && (
        <p id={idDica} className="text-xs text-muted-foreground">
          {dica}
        </p>
      )}
    </div>
  );
}
