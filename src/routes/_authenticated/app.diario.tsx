import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import {
  apagarDiario,
  definirVisibilidadeDiario,
  editarDiario,
  getConteudo,
  getPraticaSemReflexao,
  listarDiario,
  salvarDiario,
} from "@/lib/raiz.functions";
import { CHAVES, invalidarPorEvento } from "@/lib/cache-chaves";
import { useMeuContexto } from "@/hooks/use-meu-contexto";
import { blocosDoModo, normalizarModo } from "@/lib/modo-uso";
import {
  resumoDoDiario,
  type EntradaDiario,
  type FiltroDiario,
  type Visibilidade,
} from "@/lib/diario-cliente";
import { CabecalhoDiario } from "@/components/app-diario/cabecalho-diario";
import { ConviteEscrita } from "@/components/app-diario/convite-escrita";
import { FioContinuidade } from "@/components/app-diario/fio-continuidade";
import { ListaReflexoes } from "@/components/app-diario/lista-reflexoes";

export const Route = createFileRoute("/_authenticated/app/diario")({
  validateSearch: z.object({ conteudoId: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Diário de reflexão | Raiz" },
      {
        name: "description",
        content:
          "Seu espaço privado de escuta na Raiz: registre o que se move em cada prática e escolha o que deseja compartilhar com quem acompanha o seu processo.",
      },
      { property: "og:title", content: "Diário de reflexão | Raiz" },
      {
        property: "og:description",
        content: "Registre suas reflexões terapêuticas e acompanhe o caminho das suas palavras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diario,
});

function Diario() {
  const { conteudoId } = Route.useSearch();
  const queryClient = useQueryClient();
  const fetchDiario = useServerFn(listarDiario);
  const fetchConteudo = useServerFn(getConteudo);
  const fetchPraticaSemReflexao = useServerFn(getPraticaSemReflexao);
  const salvar = useServerFn(salvarDiario);
  const editar = useServerFn(editarDiario);
  const apagar = useServerFn(apagarDiario);
  const mudarVisibilidade = useServerFn(definirVisibilidadeDiario);

  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroDiario>("todas");

  const { data: contexto } = useMeuContexto();
  const modo = normalizarModo(contexto?.modo);
  const podeCompartilhar = blocosDoModo(modo).compartilharDiario;
  const primeiroNome = (contexto?.perfil?.nome || "").split(" ")[0] ?? "";

  const { data: entradas } = useQuery({ queryKey: CHAVES.diario, queryFn: () => fetchDiario() });
  const { data: conteudo } = useQuery({
    queryKey: ["conteudo", conteudoId],
    queryFn: () => fetchConteudo({ data: { conteudoId: conteudoId! } }),
    enabled: Boolean(conteudoId),
  });
  const { data: praticaSemReflexao } = useQuery({
    queryKey: ["diario", "pratica-sem-reflexao"],
    queryFn: () => fetchPraticaSemReflexao(),
    enabled: !conteudoId,
  });

  const lista = (entradas ?? []) as EntradaDiario[];
  const resumo = resumoDoDiario(lista);

  async function comCuidado(
    acao: () => Promise<unknown>,
    { emAndamento, sucesso }: { emAndamento: string; sucesso: string },
  ) {
    setAnuncio(emAndamento);
    try {
      await acao();
      await invalidarPorEvento(queryClient, "aoEscreverDiario");
      toast.success(sucesso);
      setAnuncio(sucesso);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Não foi possível salvar";
      toast.error(mensagem);
      setAnuncio(`Erro ao salvar: ${mensagem}`);
    }
  }

  async function enviar({ texto, visibilidade }: { texto: string; visibilidade: Visibilidade }) {
    setEnviando(true);
    await comCuidado(
      () => salvar({ data: { texto, conteudoId: conteudoId ?? null, visibilidade } }),
      { emAndamento: "Guardando sua reflexão...", sucesso: "Reflexão guardada." },
    );
    setEnviando(false);
  }

  async function aoEditar(id: string, texto: string) {
    setOcupado(true);
    await comCuidado(() => editar({ data: { id, texto } }), {
      emAndamento: "Atualizando sua reflexão...",
      sucesso: "Reflexão atualizada.",
    });
    setOcupado(false);
  }

  async function aoApagar(id: string) {
    setOcupado(true);
    await comCuidado(() => apagar({ data: { id } }), {
      emAndamento: "Apagando sua reflexão...",
      sucesso: "Reflexão apagada.",
    });
    setOcupado(false);
  }

  async function aoMudarVisibilidade(id: string, visibilidade: Visibilidade) {
    setOcupado(true);
    await comCuidado(() => mudarVisibilidade({ data: { id, visibilidade } }), {
      emAndamento: "Atualizando quem pode ler...",
      sucesso:
        visibilidade === "compartilhado"
          ? "Reflexão compartilhada com quem acompanha você."
          : "Reflexão guardada só para você.",
    });
    setOcupado(false);
  }

  return (
    <div>
      <CabecalhoDiario
        primeiroNome={primeiroNome}
        resumo={resumo}
        mostrarCompartilhadas={podeCompartilhar}
      />

      <p aria-live="polite" role="status" className="sr-only">
        {anuncio}
      </p>

      <ConviteEscrita
        tituloPratica={conteudoId ? (conteudo?.conteudo?.titulo ?? "esta prática") : null}
        eixoPratica={conteudoId ? (conteudo?.eixo?.nome ?? null) : null}
        conteudoId={conteudoId ?? null}
        podeCompartilhar={podeCompartilhar}
        enviando={enviando}
        onEnviar={enviar}
      />

      {!conteudoId && praticaSemReflexao && <FioContinuidade pratica={praticaSemReflexao} />}

      <ListaReflexoes
        entradas={lista}
        busca={busca}
        filtro={filtro}
        podeCompartilhar={podeCompartilhar}
        ocupado={ocupado}
        onBusca={setBusca}
        onFiltro={setFiltro}
        onEditar={aoEditar}
        onApagar={aoApagar}
        onVisibilidade={aoMudarVisibilidade}
      />
    </div>
  );
}
