import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMeuContexto } from "@/lib/raiz.functions";
import { SplashRaiz } from "@/components/splash-raiz";

export const Route = createFileRoute("/_authenticated/entrada")({
  component: Entrada,
});

function Entrada() {
  const navigate = useNavigate();
  const fetchContexto = useServerFn(getMeuContexto);
  const { data } = useQuery({ queryKey: ["contexto"], queryFn: () => fetchContexto() });

  useEffect(() => {
    if (!data) return;
    navigate({ to: data.papel === "terapeuta" ? "/admin" : "/app", replace: true });
  }, [data, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <RaizLogo className="h-20 animate-pulse" />
      <p className="text-sm text-muted-foreground">Preparando o seu espaço...</p>
    </div>
  );
}
