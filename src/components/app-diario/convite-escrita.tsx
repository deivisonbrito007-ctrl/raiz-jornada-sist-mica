import { useEffect, useMemo, useState } from "react";
import { Feather, Lock, RefreshCw, Send, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CONVITES,
  SENTIMENTOS,
  TRILHOS_CONVITE,
  chaveRascunho,
  comporTexto,
  conviteDoDia,
  convitePorIndice,
  convitesDoTrilho,
  type Visibilidade,
} from "@/lib/diario-cliente";

/**
 * Convite de escrita: uma pergunta que abre, um campo generoso, palavras
 * opcionais para nomear o que ficou e — só no modo acompanhado — a escolha
 * explícita de guardar para si ou compartilhar com quem acompanha.
 */
export function ConviteEscrita({
  tituloPratica,
  eixoPratica,
  conteudoId,
  podeCompartilhar,
  enviando,
  eixos = [],
  onEnviar,
}: {
  tituloPratica?: string | null;
  eixoPratica?: string | null;
  conteudoId?: string | null;
  podeCompartilhar: boolean;
  enviando: boolean;
  eixos?: Array<{ id: string; nome: string }>;
  onEnviar: (dados: {
    texto: string;
    visibilidade: Visibilidade;
    eixos: string[];
  }) => Promise<void> | void;
}) {
  const [indiceConvite, setIndiceConvite] = useState<number | null>(null);
  const [trilho, setTrilho] = useState<string | null>(null);
  const [indiceTrilho, setIndiceTrilho] = useState(0);
  const [texto, setTexto] = useState("");
  const [sentimentos, setSentimentos] = useState<string[]>([]);
  const [eixosMarcados, setEixosMarcados] = useState<string[]>([]);
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("somente_eu");

  const chave = chaveRascunho(conteudoId);

  // O que foi escrito não se perde ao trocar de aba ou recarregar sem enviar.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      if (salvo) setTexto(salvo);
    } catch {
      // sem armazenamento: segue apenas em memória
    }
  }, [chave]);

  useEffect(() => {
    try {
      if (texto.trim()) window.localStorage.setItem(chave, texto);
      else window.localStorage.removeItem(chave);
    } catch {
      // sem armazenamento: segue apenas em memória
    }
  }, [chave, texto]);

  const convite = useMemo(() => {
    if (trilho) {
      const lista = convitesDoTrilho(trilho);
      if (lista.length > 0) return lista[indiceTrilho % lista.length]!;
    }
    if (tituloPratica) return `Depois de "${tituloPratica}": o que se moveu em você?`;
    return indiceConvite === null ? conviteDoDia() : convitePorIndice(indiceConvite);
  }, [indiceConvite, indiceTrilho, trilho, tituloPratica]);

  function escolherTrilho(chaveTrilho: string) {
    setTrilho((atual) => {
      if (atual === chaveTrilho) {
        setIndiceTrilho((i) => i + 1);
        return atual;
      }
      setIndiceTrilho(0);
      return chaveTrilho;
    });
  }

  function alternarEixo(id: string) {
    setEixosMarcados((atuais) =>
      atuais.includes(id) ? atuais.filter((e) => e !== id) : [...atuais, id],
    );
  }

  function alternarSentimento(chaveSentimento: string) {
    setSentimentos((atuais) =>
      atuais.includes(chaveSentimento)
        ? atuais.filter((s) => s !== chaveSentimento)
        : [...atuais, chaveSentimento],
    );
  }

  async function enviar() {
    if (!texto.trim()) return;
    await onEnviar({ texto: comporTexto(texto, sentimentos), visibilidade, eixos: eixosMarcados });
    setTexto("");
    setSentimentos([]);
    setEixosMarcados([]);
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // nada a limpar
    }
  }

  return (
    <section
      aria-labelledby="titulo-nova-reflexao"
      className="mt-7 rounded-[2rem] bg-card p-6 shadow-organico"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="titulo-nova-reflexao"
            className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
          >
            <Feather className="h-3.5 w-3.5" aria-hidden="true" /> Convite de escrita
          </h2>
          <label
            htmlFor="campo-reflexao"
            className="mt-3 block font-display text-xl leading-snug text-floresta"
          >
            {convite}
          </label>
          {eixoPratica && (
            <p className="mt-2 text-xs text-muted-foreground">Eixo {eixoPratica}</p>
          )}
        </div>
        {!tituloPratica && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Trocar a pergunta"
            onClick={() =>
              setIndiceConvite((atual) =>
                atual === null
                  ? 1
                  : (atual + 1) % CONVITES.length === 0
                    ? 1
                    : (atual + 1) % CONVITES.length,
              )
            }
            className="shrink-0 rounded-full text-salvia hover:text-floresta"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div
        role="group"
        aria-label="Por onde você quer entrar hoje"
        className="mt-4 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1"
      >
        {TRILHOS_CONVITE.map((t) => (
          <button
            key={t.chave}
            type="button"
            aria-pressed={trilho === t.chave}
            onClick={() => escolherTrilho(t.chave)}
            className={`min-h-10 shrink-0 snap-start rounded-full px-4 text-sm transition ${
              trilho === t.chave
                ? "bg-floresta text-floresta-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            {t.rotulo}
          </button>
        ))}
        {trilho && (
          <button
            type="button"
            onClick={() => setTrilho(null)}
            className="min-h-10 shrink-0 rounded-full px-3 text-xs text-muted-foreground underline decoration-dotted underline-offset-4"
          >
            voltar ao convite do dia
          </button>
        )}
      </div>

      <Textarea
        id="campo-reflexao"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        aria-describedby="dica-reflexao"
        placeholder="Escreva sem filtro. Não precisa ficar bonito — só verdadeiro."
        className="mt-4 resize-none rounded-2xl border-border bg-background text-[15px] leading-relaxed"
      />

      <fieldset className="mt-5">
        <legend className="text-xs font-medium uppercase tracking-wider text-salvia">
          O que ficou em você? (opcional)
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SENTIMENTOS.map((s) => {
            const ativo = sentimentos.includes(s.chave);
            return (
              <button
                key={s.chave}
                type="button"
                aria-pressed={ativo}
                onClick={() => alternarSentimento(s.chave)}
                className={`min-h-10 rounded-full px-4 text-sm transition ${
                  ativo
                    ? "bg-floresta text-floresta-foreground"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                }`}
              >
                {s.rotulo}
              </button>
            );
          })}
        </div>
      </fieldset>

      {eixos.length > 0 && (
        <fieldset className="mt-5">
          <legend className="text-xs font-medium uppercase tracking-wider text-salvia">
            A que eixo isso pertence? (opcional)
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {eixos.map((eixo) => {
              const ativo = eixosMarcados.includes(eixo.id);
              return (
                <button
                  key={eixo.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alternarEixo(eixo.id)}
                  className={`min-h-10 rounded-full px-4 text-sm transition ${
                    ativo
                      ? "bg-salvia text-floresta-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {eixo.nome}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {podeCompartilhar ? (
        <fieldset className="mt-5 rounded-2xl bg-secondary p-4">
          <legend className="px-1 text-xs font-medium uppercase tracking-wider text-salvia">
            Quem pode ler
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  valor: "somente_eu" as Visibilidade,
                  icone: Lock,
                  titulo: "Só para mim",
                  descricao: "Ninguém além de você lê esta reflexão.",
                },
                {
                  valor: "compartilhado" as Visibilidade,
                  icone: Share2,
                  titulo: "Compartilhar",
                  descricao: "Quem acompanha o seu processo poderá ler.",
                },
              ] as const
            ).map((opcao) => {
              const Icone = opcao.icone;
              const ativo = visibilidade === opcao.valor;
              return (
                <label
                  key={opcao.valor}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                    ativo ? "border-floresta bg-card" : "border-transparent bg-card/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibilidade-reflexao"
                    value={opcao.valor}
                    checked={ativo}
                    onChange={() => setVisibilidade(opcao.valor)}
                    className="mt-1 accent-[hsl(var(--floresta))]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-floresta">
                      <Icone className="h-4 w-4" aria-hidden="true" /> {opcao.titulo}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {opcao.descricao}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Este diário é privado: só você lê o
          que escreve aqui.
        </p>
      )}

      <p id="dica-reflexao" className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {podeCompartilhar
          ? "Você escolhe, a cada reflexão, se ela fica só com você ou se acompanha o seu processo com a terapeuta. Pode mudar depois."
          : "Suas palavras ficam guardadas apenas para você, neste dispositivo e na sua conta."}
      </p>

      <Button
        onClick={enviar}
        disabled={enviando || !texto.trim()}
        aria-busy={enviando}
        className="mt-4 min-h-12 w-full rounded-full bg-terracota text-base text-terracota-foreground hover:bg-terracota/90"
      >
        <Send className="mr-2 h-4 w-4" aria-hidden="true" />
        {enviando ? "Guardando..." : "Guardar reflexão"}
      </Button>
    </section>
  );
}
