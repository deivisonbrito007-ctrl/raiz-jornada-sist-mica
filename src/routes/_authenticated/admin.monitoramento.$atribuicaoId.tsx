import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CopyPlus, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadMidia } from "@/components/AdminConteudos/UploadMidia";
import {
  LinhaDoTempoPlano,
  type EventoTimeline,
} from "@/components/painel/monitoramento/linha-do-tempo-plano";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import {
  adminAlterarPrazoRevisao,
  adminEnviarOrientacao,
  adminLiberarProximaEtapa,
  adminMarcarRevisao,
  adminMonitoramentoPlano,
} from "@/lib/monitoramento.functions";
import { STATUS_ATRIBUICAO_LABEL, type StatusAtribuicao } from "@/lib/etapas";
import { statusClasse } from "@/lib/planos";
import { percentualProgresso, situacaoRevisao, textoAutorrelato } from "@/lib/monitoramento";
import { formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/admin/monitoramento/$atribuicaoId")({
  head: () => ({
    meta: [
      { title: "Plano em monitoramento — Raiz" },
      {
        name: "description",
        content:
          "Progresso etapa por etapa, registros da pessoa, revisões e ações de acompanhamento do plano.",
      },
      { property: "og:title", content: "Plano em monitoramento — Raiz" },
      {
        property: "og:description",
        content: "Acompanhe um plano liberado e responda com orientação ou devolutiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonitoramentoPlano;
});

function MonitoramentoPlano() {
  return null;
}
