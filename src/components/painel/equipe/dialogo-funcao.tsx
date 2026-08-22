import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { filtrarPermissoes, type Permissao } from "@/lib/permissoes";
import {
  FUNCAO_ESCOPO_PADRAO,
  FUNCAO_PERMISSOES,
  type EscopoEquipe,
  type FuncaoEquipe,
} from "@/lib/equipe-funcoes";
import { SeletorEscopo, SeletorFuncao, SeletorPermissoes } from "./seletor-permissoes";

export type DadosFuncao = {
  funcao: FuncaoEquipe;
  escopo: EscopoEquipe;
  permissoes: Permissao[];
};

export function DialogoFuncao({
  aberto,
  onAberto,
  titulo,
  descricao,
  inicial,
  bloqueado = false,
  salvando = false,
  onSalvar,
}: {
  aberto: boolean;
  onAberto: (v: boolean) => void;
  titulo: string;
  descricao: string;
  inicial: DadosFuncao;
  bloqueado?: boolean;
  salvando?: boolean;
  onSalvar: (dados: DadosFuncao) => void;
}) {
  const [funcao, setFuncao] = useState<FuncaoEquipe>(inicial.funcao);
  const [escopo, setEscopo] = useState<EscopoEquipe>(inicial.escopo);
  const [permissoes, setPermissoes] = useState<Permissao[]>(inicial.permissoes);

  useEffect(() => {
    if (!aberto) return;
    setFuncao(inicial.funcao);
    setEscopo(inicial.escopo);
    setPermissoes(filtrarPermissoes(inicial.permissoes));
    // Reabrir o diálogo sempre parte do estado atual do integrante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={onAberto}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-floresta">{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        {bloqueado ? (
          <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
            Esta é a conta principal do espaço: ela permanece administradora com acesso total para
            que ninguém fique de fora do painel.
          </p>
        ) : (
          <div className="space-y-5">
            <SeletorFuncao
              funcao={funcao}
              idPrefixo="dialogo"
              onEscolher={(f) => {
                setFuncao(f);
                setPermissoes([...FUNCAO_PERMISSOES[f]]);
                setEscopo(FUNCAO_ESCOPO_PADRAO[f]);
              }}
            />
            <SeletorEscopo escopo={escopo} onChange={setEscopo} idPrefixo="dialogo" />
            <SeletorPermissoes
              valor={permissoes}
              onChange={setPermissoes}
              idPrefixo="dialogo-perm"
              funcao={funcao}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onAberto(false)}>
            Fechar
          </Button>
          {!bloqueado && (
            <Button
              className="rounded-full bg-salvia text-salvia-foreground hover:bg-salvia/90"
              disabled={salvando}
              onClick={() => onSalvar({ funcao, escopo, permissoes })}
            >
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
