import { ArrowLeft, HeartHandshake, Sparkles } from "lucide-react";
import { CampoEmail } from "@/components/auth/campo-email";
import { CampoSenha } from "@/components/auth/campo-senha";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CaminhoEntrada = "convite" | "propria";

const CAMINHOS = [
  {
    valor: "convite" as const,
    icone: HeartHandshake,
    titulo: "Fui convidada pela terapeuta",
    texto: "Seu plano e as trilhas chegam pela terapeuta que te acompanha.",
  },
  {
    valor: "propria" as const,
    icone: Sparkles,
    titulo: "Quero usar por conta própria",
    texto: "Escolha um pacote e percorra as trilhas autoguiadas no seu ritmo.",
  },
];

/**
 * Cadastro em dois passos: primeiro os dados, depois o caminho de uso. Isso
 * mantém a primeira tela curta no mobile.
 */
export function FormularioCadastro({
  etapa,
  nome,
  email,
  senha,
  caminho,
  souTerapeuta,
  mostrarOpcaoTerapeuta,
  onNome,
  onEmail,
  onSenha,
  onCaminho,
  onSouTerapeuta,
  onAvancar,
  onVoltar,
  onEnviar,
  carregando,
}: {
  etapa: 1 | 2;
  nome: string;
  email: string;
  senha: string;
  caminho: CaminhoEntrada;
  souTerapeuta: boolean;
  mostrarOpcaoTerapeuta: boolean;
  onNome: (v: string) => void;
  onEmail: (v: string) => void;
  onSenha: (v: string) => void;
  onCaminho: (v: CaminhoEntrada) => void;
  onSouTerapeuta: (v: boolean) => void;
  onAvancar: (e: React.FormEvent) => void;
  onVoltar: () => void;
  onEnviar: (e: React.FormEvent) => void;
  carregando: boolean;
}) {
  if (etapa === 1) {
    return (
      <form onSubmit={onAvancar} className="space-y-5">
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
      <button
        type="button"
        onClick={onVoltar}
        className="flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar
      </button>

      {!souTerapeuta && (
        <fieldset className="space-y-3">
          <legend className="font-display text-lg text-floresta">
            Como você vai usar o Raiz?
          </legend>
          <div className="grid gap-3">
            {CAMINHOS.map((opcao) => (
              <label
                key={opcao.valor}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm transition-colors ${
                  caminho === opcao.valor
                    ? "border-terracota bg-secondary"
                    : "border-border bg-card hover:bg-secondary/60"
                }`}
              >
                <input
                  type="radio"
                  name="caminho"
                  value={opcao.valor}
                  checked={caminho === opcao.valor}
                  onChange={() => onCaminho(opcao.valor)}
                  className="sr-only"
                />
                <opcao.icone aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-salvia" />
                <span>
                  <span className="font-medium text-foreground">{opcao.titulo}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {opcao.texto}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {caminho === "convite" && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Use o mesmo e-mail que recebeu o convite — assim seu acesso já entra vinculado à
              terapeuta.
            </p>
          )}
        </fieldset>
      )}

      {mostrarOpcaoTerapeuta && (
        <label className="flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
          <Checkbox
            checked={souTerapeuta}
            onCheckedChange={(v) => onSouTerapeuta(v === true)}
            className="mt-0.5"
          />
          <span>
            Sou a terapeuta responsável por este espaço.
            <span className="mt-1 block text-xs">
              Disponível apenas para a primeira conta de terapeuta.
            </span>
          </span>
        </label>
      )}

      <Button
        type="submit"
        disabled={carregando}
        className="h-13 w-full rounded-full bg-terracota text-base font-semibold text-terracota-foreground shadow-organico hover:bg-terracota/90"
      >
        {carregando ? "Preparando seu espaço..." : "Criar conta"}
      </Button>
    </form>
  );
}
