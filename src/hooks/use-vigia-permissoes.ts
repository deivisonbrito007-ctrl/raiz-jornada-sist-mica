import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { limparCacheAdmin } from "@/lib/acesso-admin";

const CANAL_LOCAL = "raiz-permissoes";

/**
 * Revalida as permissões do painel em tempo real: qualquer mudança em
 * equipe_admins / equipe_permissoes chega por realtime (ou por outra aba via
 * BroadcastChannel) e derruba na hora as rotas já abertas — sem polling nem
 * dependência de foco.
 */
export function useVigiaPermissoes(ativo = true) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    if (!ativo || typeof window === "undefined") return;
    let cancelado = false;

    async function revalidar() {
      if (cancelado) return;
      // O guard do painel reaproveita a última resposta por 30s: ao mudar
      // permissões precisamos descartar esse cache antes de revalidar.
      limparCacheAdmin();
      const { data: podeAdministrar } = await supabase.rpc("pode_administrar");
      if (cancelado) return;

      if (podeAdministrar !== true) {
        await queryClient.cancelQueries();
        queryClient.clear();
        toast.error("Seu acesso administrativo foi removido.");
        navigate({ to: "/app", replace: true });
        return;
      }

      await queryClient.invalidateQueries();
      await router.invalidate();
    }

    const canal = supabase
      .channel("vigia-permissoes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipe_permissoes" },
        revalidar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "equipe_admins" },
        revalidar,
      )
      .subscribe();

    const bc = "BroadcastChannel" in window ? new BroadcastChannel(CANAL_LOCAL) : null;
    if (bc) bc.onmessage = () => revalidar();

    return () => {
      cancelado = true;
      bc?.close();
      supabase.removeChannel(canal);
    };
  }, [ativo, queryClient, navigate, router]);
}

/** Avisa as outras telas/abas deste navegador que as permissões mudaram. */
export function avisarMudancaPermissoes() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  const bc = new BroadcastChannel(CANAL_LOCAL);
  bc.postMessage({ tipo: "permissoes-alteradas", em: Date.now() });
  bc.close();
}
