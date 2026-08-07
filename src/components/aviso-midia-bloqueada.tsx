import { Link } from "@tanstack/react-router";
import { TimerOff, Lock, AlertCircle, Hourglass } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type MotivoBloqueio = "validade" | "revogado" | "falha" | "limite";


interface Props {
  motivo: MotivoBloqueio;
  renovando: boolean;
  emEspera: boolean;
  /** instante (ms) em que a nova tentativa volta a ser permitida */
  esperaAte?: number | null;
  eixoId?: string;
  onRenovar: () => void;
  /** Esc dentro do aviso: devolve o foco para fora (ex.: link "Voltar à trilha"). */
  onSair?: () => void;
}

/** Segundos que faltam para liberar o botão — atualiza a cada segundo. */
function useContagem(esperaAte?: number | null) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!esperaAte) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [esperaAte]);
  if (!esperaAte) return 0;
  return Math.max(0, Math.ceil((esperaAte - agora) / 1000));
}

export function AvisoMidiaBloqueada({
  motivo,
  renovando,
  emEspera,
  esperaAte,
  eixoId,
  onRenovar,
  onSair,
}: Props) {
  const segundos = useContagem(emEspera ? esperaAte : null);

  const configs: Record<MotivoBloqueio, {
    icone: React.ReactNode;
    titulo: string;
    texto: string;
    botao: string;
    tom: "ocre" | "terracota" | "muted";
  }> = {
    validade: {
      icone: <TimerOff className="mt-0.5 h-5 w-5 shrink-0 text-ocre" aria-hidden="true" />,
      titulo: "O link seguro expirou",
      texto:
        "O link de reprodução desta mídia tem tempo de validade por segurança e acabou de encerrar. Não se preocupe: o ponto onde você parou está guardado e nenhum progresso foi perdido.",
      botao: "Renovar acesso",
      tom: "ocre",
    },
    revogado: {
      icone: <Lock className="mt-0.5 h-5 w-5 shrink-0 text-terracota" aria-hidden="true" />,
      titulo: "Prática não está mais liberada",
      texto:
        "O terapeuta recolheu o acesso a esta prática por enquanto. A reprodução fica indisponível e nada novo é registrado até que ela seja liberada novamente. O que você já praticou permanece salvo.",
      botao: "Tentar novamente",
      tom: "terracota",
    },
    falha: {
      icone: <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />,
      titulo: "Não conseguimos renovar agora",
      texto:
        "Aconteceu uma falha de conexão ao verificar o acesso. Aguarde um instante e tente de novo — o link anterior expirou, mas a prática ainda pode estar liberada.",
      botao: "Tentar novamente",
      tom: "muted",
    },
    limite: {
      icone: <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-ocre" aria-hidden="true" />,
      titulo: "Muitos pedidos em pouco tempo",
      texto:
        "Para proteger sua conta, limitamos quantos links seguros podem ser gerados por minuto. Você chegou nesse limite: aguarde alguns segundos e tente de novo. Nada foi perdido — seu progresso e o ponto onde você parou seguem salvos.",
      botao: "Tentar novamente",
      tom: "ocre",
    },
  };


  const cfg = configs[motivo];

  const borda =
    cfg.tom === "ocre"
      ? "border-ocre/30 bg-ocre/10"
      : cfg.tom === "terracota"
        ? "border-terracota/30 bg-terracota/10"
        : "border-border bg-muted/30";

  const idTitulo = useId();
  const idTexto = useId();
  const idAjuda = useId();
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);

  // O aviso é o único caminho possível daqui: o foco vai para ele assim que
  // aparece, para quem usa teclado ou leitor de tela não continuar em controles
  // do player que já não funcionam.
  useEffect(() => {
    const alvo = botaoRef.current?.disabled ? caixaRef.current : botaoRef.current;
    alvo?.focus();
  }, [motivo]);

  /** Tab circula entre os controles do aviso; Esc devolve o foco para fora. */
  const aoTeclar = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onSair?.();
        return;
      }
      if (e.key !== "Tab") return;
      const caixa = caixaRef.current;
      if (!caixa) return;
      const focaveis = Array.from(
        caixa.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      ).filter((el) => el.getAttribute("aria-hidden") !== "true");
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (ativo === primeiro || ativo === caixa)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    },
    [onSair],
  );

  const situacao = renovando
    ? "Estamos pedindo um novo link seguro ao servidor e conferindo se a prática segue liberada."
    : emEspera
      ? `Aguarde ${segundos > 0 ? `${segundos} segundos` : "um instante"} antes de tentar de novo: o botão fica em espera para evitar pedidos repetidos ao servidor. Ele volta a funcionar sozinho.`
      : `Ao acionar “${cfg.botao}”, pedimos um link seguro novo e verificamos a liberação. Se continuar bloqueada, o botão espera alguns segundos antes de permitir outra tentativa.`;

  return (
    <div
      ref={caixaRef}
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={idTitulo}
      aria-describedby={`${idTexto} ${idAjuda}`}
      aria-busy={renovando}
      tabIndex={-1}
      onKeyDown={aoTeclar}
      className={`mt-6 rounded-3xl border p-6 outline-none focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2 ${borda}`}
    >
      <div className="flex items-start gap-3">
        {cfg.icone}
        <div className="flex-1">
          <h2 id={idTitulo} className="text-lg text-floresta">
            {cfg.titulo}
          </h2>
          <p id={idTexto} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {cfg.texto}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              ref={botaoRef}
              onClick={onRenovar}
              disabled={renovando || emEspera}
              aria-describedby={idAjuda}
              className="rounded-full bg-floresta px-6 text-floresta-foreground hover:bg-floresta/90 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
            >
              {renovando ? "Renovando..." : cfg.botao}
            </Button>

            {motivo === "revogado" && eixoId && (
              <Link
                to="/app/eixo/$eixoId"
                params={{ eixoId }}
                className="inline-flex items-center rounded-full border border-floresta/20 px-6 py-2 text-sm text-floresta hover:bg-floresta/5 focus-visible:ring-2 focus-visible:ring-floresta focus-visible:ring-offset-2"
              >
                Voltar à trilha
              </Link>
            )}
          </div>

          <p
            id={idAjuda}
            className="mt-3 text-xs leading-relaxed text-muted-foreground"
            aria-live="polite"
          >
            {situacao}
          </p>

          <p className="mt-2 text-xs text-muted-foreground/80">
            Pressione Esc para voltar ao início da prática.
          </p>
        </div>
      </div>
    </div>
  );

}
