import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Campo de e-mail com teclado e autocorreção adequados ao mobile. */
export function CampoEmail({
  id = "email",
  valor,
  onChange,
}: {
  id?: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>E-mail</Label>
      <div className="relative">
        <Mail
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-13 rounded-2xl border-border bg-background pl-11 text-base focus-visible:ring-terracota"
        />
      </div>
    </div>
  );
}
