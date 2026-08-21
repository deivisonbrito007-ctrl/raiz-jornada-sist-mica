import { Link } from "@tanstack/react-router";
import { Leaf, PlayCircle, Sparkles } from "lucide-react";
import { formatarDuracao, TIPO_LABEL } from "@/lib/raiz-format";
import type { ConviteDeHoje } from "@/lib/inicio-cliente";

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="titulo-pratica-hoje"
      className="mt-6 rounded-[2rem] border border-ocre/30 bg-card p-6 shadow-organico"
    >
      {children}
    </section>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-salvia">{texto}</p>
  );
}

/**
 * O coração da aba Início: uma única coisa para fazer agora — retomar o que
 * ficou no meio ou começar a próxima prática. Quando não há nada pendente,
 * o cartão vira um convite ao descanso.
 */
export function PraticaDeHoje({
  convite,
  primeiroNome = "",
}: {
  convite: ConviteDeHoje;
  primeiroNome?: string;
}) {
  const nome = primeiroNome.trim();
  if (convite.estado === "retomar") {
    const p = convite.pratica;
    const restante = Math.max(0, p.duracaoSegundos - p.posicaoSegundos);
    return (
      <Moldura>
        <Selo texto={nome ? `${nome}, você parou no meio` : "Você parou no meio"} />
        <h2 id="titulo-pratica-hoje" className="mt-2 font-display text-2xl leading-snug text-floresta">
          {p.titulo}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {p.eixoNome} · {TIPO_LABEL[p.tipo] ?? p.tipo} · parou em{" "}
          {formatarDuracao(p.posicaoSegundos)}
          {p.duracaoSegundos ? ` · faltam ${formatarDuracao(restante)}` : ""}
        </p>
        <Link
          to="/app/conteudo/$conteudoId"
          params={{ conteudoId: p.id }}
          search={{ retomar: true }}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-floresta px-6 text-sm font-medium text-floresta-foreground transition hover:bg-floresta/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Continuar de onde parei
        </Link>
      </Moldura>
    );
  }

  if (convite.estado === "comecar") {
    const p = convite.pratica;
    return (
      <Moldura>
        <Selo texto={nome ? `A prática de hoje para ${nome}` : "Sua prática de hoje"} />
        <h2 id="titulo-pratica-hoje" className="mt-2 font-display text-2xl leading-snug text-floresta">
          {p.titulo}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {p.eixoNome} · {TIPO_LABEL[p.tipo] ?? p.tipo}
          {p.duracaoSegundos ? ` · ${formatarDuracao(p.duracaoSegundos)}` : ""}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Reserve um momento em que você possa ficar sem pressa. Se hoje não der, ela continua aqui
          amanhã.
        </p>
        <Link
          to="/app/conteudo/$conteudoId"
          params={{ conteudoId: p.id }}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-terracota px-6 text-sm font-medium text-terracota-foreground transition hover:bg-terracota/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Começar agora
        </Link>
      </Moldura>
    );
  }

  if (convite.estado === "ciclo_fechado") {
    return (
      <Moldura>
        <Selo texto="Nada pendente" />
        <h2 id="titulo-pratica-hoje" className="mt-2 font-display text-2xl leading-snug text-floresta">
          Você fechou este ciclo
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {nome ? `${nome}, todas as práticas liberadas foram concluídas.` : "Todas as práticas liberadas foram concluídas."}{" "} Descansar também é parte do processo — se
          quiser, escreva no diário o que se moveu.
        </p>
        <Link
          to="/app/diario"
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-floresta px-6 text-sm font-medium text-floresta-foreground transition hover:bg-floresta/90"
        >
          <Leaf className="h-4 w-4" aria-hidden="true" /> Escrever no diário
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <Selo texto="Seu caminho está sendo preparado" />
      <h2 id="titulo-pratica-hoje" className="mt-2 font-display text-2xl leading-snug text-floresta">
        Ainda não há prática liberada
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Assim que um eixo for aberto para você, ele aparece aqui como o próximo passo. Enquanto isso,
        o diário está disponível para o que quiser registrar.
      </p>
    </Moldura>
  );
}
