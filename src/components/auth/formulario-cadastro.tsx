import { ArrowLeft, Check, HeartHandshake, Sparkles, Stethoscope } from "lucide-react";
import { CampoEmail } from "@/components/auth/campo-email";
import { CampoSenha } from "@/components/auth/campo-senha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CaminhoEntrada = "convite" | "propria" | "terapeuta";

const CAMINHOS = [
  {
    valor: "convite" as const,
    icone: HeartHandshake,
    titulo: "Sou cliente de uma terapeuta",
    texto: "Sua terapeuta libera as trilhas e acompanha cada passo com você.",
    detalhe: "Use o mesmo e-mail que recebeu o convite.",
  },
  {
    valor: "propria" as const,
    icone: Sparkles,
    titulo: "Quero começar por conta própria",
    texto: "Você escolhe um pacote e percorre as trilhas autoguiadas no seu ritmo.",
    detalhe: "Pode pedir acompanhamento depois, sem perder nada.",
  },
];

const CARTAO_TERAPEUTA = {
  valor: "terapeuta" as const,
  icone: Stethoscope,
  titulo: "Sou a terapeuta responsável",
  texto: "Você cria as trilhas, os planos e acompanha as pessoas neste espaço.",
  detalhe: "Disponível apenas para a primeira conta de terapeuta.",
};

export const ROTULO_CAMINHO: Record<CaminhoEntrada, string> = {
  convite: "Com acompanhamento",
  propria: "Por conta própria",
  terapeuta: "Conta de terapeuta",
};

type Opcao = (typeof CAMINHOS)[number] | typeof CARTAO_TERAPEUTA;

/**
 * Cadastro em dois passos, agora com a escolha do caminho em primeiro lugar:
 * ninguém digita dados sem saber (e ver) que tipo de conta está criando.
 */
export function FormularioCadastro({
  etapa,
  nome,
  email,
  senha,
  caminho,
  mostrarOpcaoTerapeuta,
  onNome,
  onEmail,
  onSenha,
  onCaminho,
  onAvancar,
  onVoltar,
  onEnviar,
  carregando,
  escolhaVeioDeFora,
  avisoConvite,
  rotuloEnviar,
}: {
  etapa: 1 | 2;
  nome: string;
  email: string;
  senha: string;
  caminho: CaminhoEntrada;
  mostrarOpcaoTerapeuta: boolean;
  onNome: (v: string) => void;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  onCaminho: (v: CaminhoEntrada) => void;
  onAvancar: (e: React.FormEvent) => void;
  onVoltar: () => void;
  onEnviar: (e: React.FormEvent) => void;
  carregando: boolean;
  escolhaVeioDeFora?: boolean;
  avisoConvite?: React.ReactNode;
  rotuloEnviar?: string;
}) {
  const opcoes: Opcao[] = mostrarOpcaoTerapeuta ? [...CAMINHOS, CARTAO_TERAPEUTA] : [...CAMINHOS];

  if (etapa === 1) {
    return (
      <form onSubmit={onAvancar} className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Passo 1 de 2
        </p>
        <fieldset className="space-y-3">
          <legend className="font-display text-lg text-floresta">Como você vai usar o Raiz?</legend>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Isso define o que aparece no seu espaço. Você confirma antes de criar a conta.
          </p>
          <div className="grid gap-3">
            {opcoes.map((opcao) => {
              const ativo = caminho === opcao.valor;
              return (
                <label
                  key={opcao.valor}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition-colors ${
                    ativo
                      ? "border-terracota bg-secondary shadow-organico"
                      : "border-border bg-card hover:bg-secondary/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="caminho"
                    value={opcao.valor}
                    checked={ativo}
                    onChange={() => onCaminho(opcao.valor)}
                    className="sr-only"
                  />
                  <opcao.icone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-salvia" />
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{opcao.titulo}</span>
                      {ativo && escolhaVeioDeFora && (
                        <span className="rounded-full bg-terracota/15 px-2 py-0.5 text-[11px] font-semibold text-terracota">
                          Sua escolha
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {opcao.texto}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground/80">
                      {opcao.detalhe}
                    </span>
                  </span>
                  {ativo && (
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-terracota" />
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="submit"
          className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
        >
          Continuar
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onEnviar} className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Passo 2 de 2
      </p>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Check aria-hidden="true" className="h-4 w-4 text-salvia" />
          {ROTULO_CAMINHO[caminho]}
        </span>
        <button
          type="button"
          onClick={onVoltar}
          className="text-sm font-semibold text-floresta underline underline-offset-4"
        >
          trocar
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome">Como podemos te chamar?</Label>
        <Input
          id="nome"
          value={nome}
          onChange={(e) => onNome(e.target.value)}
          autoComplete="name"
          required
          className="h-13 rounded-2xl border-border bg-background text-base focus-visible:ring-terracota"
        />
      </div>
      <CampoEmail valor={email} onChange={onEmail} />
      <CampoSenha
        valor={senha}
        onChange={onSenha}
        autoComplete="new-password"
        dica="Pelo menos 6 caracteres."
      />

      {avisoConvite}

      <Button
        type="submit"
        disabled={carregando}
        className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
      >
        {carregando ? "Preparando seu espaço..." : (rotuloEnviar ?? "Criar conta")}
      </Button>

      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar para a escolha
      </button>
    </form>
  );
}
