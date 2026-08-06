import logo from "@/assets/raiz-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function RaizLogo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Raiz"
      className={cn("h-10 w-auto select-none", className)}
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
