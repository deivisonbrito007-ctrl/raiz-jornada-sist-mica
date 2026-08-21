import marca from "@/assets/raiz-marca.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Símbolo Raiz. Usa o arquivo recortado no desenho (sem margem vazia) e em alta
 * resolução, para renderizar nítido em telas retina e em qualquer tamanho.
 */
export function RaizLogo({ className }: { className?: string }) {
  return (
    <img
      src={marca.url}
      alt="Raiz"
      width={1016}
      height={1152}
      decoding="async"
      className={cn("h-10 w-auto select-none object-contain", className)}
      draggable={false}
    />
  );
}

export function RaizWordmark({
  className,
  invert = false,
}: {
  className?: string;
  invert?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <RaizLogo className="h-9" />
      <span
        className={cn(
          "font-display text-2xl font-semibold tracking-tight",
          invert ? "text-floresta-foreground" : "text-floresta",
        )}
      >
        Raiz
      </span>
    </span>
  );
}
