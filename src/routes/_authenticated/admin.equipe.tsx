import { createFileRoute } from "@tanstack/react-router";
import { mensagemPainel } from "@/lib/erro-permissao";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { SecaoSemPermissao } from "@/components/permissao-ui";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, RefreshCw, UserPlus } from "lucide-react";

import {
  equipeAlterarStatus,
  equipeAtualizarConvite,
  equipeAuditoria,
  equipeCancelarConvite,
  equipeConvidar,
  equipeDefinirFuncao,
  equipeListar,
  equipeReenviarConvite,
  equipeRemover,
  equipeVincularClientes,
} from "@/lib/equipe.functions";
import {
  FUNCAO_LABEL,
  FUNCAO_PERMISSOES,
  FUNCAO_ESCOPO_PADRAO,
  ESCOPO_LABEL,
  type EscopoEquipe,
  type FuncaoEquipe,
} from "@/lib/equipe-funcoes";
import { PERMISSAO_LABEL, filtrarPermissoes, type Permissao } from "@/lib/permissoes";
import { formatarData } from "@/lib/raiz-format";
import { avisarMudancaPermissoes } from "@/hooks/use-vigia-permissoes";
import { MatrizPermissoes, type LinhaMatriz } from "@/components/matriz-permissoes";
import { HistoricoAuditoria } from "@/components/historico-auditoria";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SeletorEscopo,
  SeletorFuncao,
  SeletorPermissoes,
} from "@/components/painel/equipe/seletor-permissoes";
import { ListaMembros } from "@/components/painel/equipe/lista-membros";
import { DialogoFuncao } from "@/components/painel/equipe/dialogo-funcao";
import { DialogoVinculos } from "@/components/painel/equipe/dialogo-vinculos";
import type { MembroEquipe } from "@/components/painel/equipe/tipos";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: AdminEquipe,
  head: () => ({
    meta: [
      { title: "Equipe e permissões | Raiz" },
      {
        name: "description",
        content:
          "Convide integrantes, defina funções, abrangência de clientes e permissões do painel Raiz.",
      },
    ],
  }),
});

function AdminEquipe() {
  const queryClient = useQueryClient();
  const listar = useServerFn(equipeListar);
  const convidar = useServerFn(equipeConvidar);
  const cancelar = useServerFn(equipeCancelarConvite);
  const reenviar = useServerFn(equipeReenviarConvite);
  const atualizarConvite = useServerFn(equipeAtualizarConvite);
  const definirFuncao = useServerFn(equipeDefinirFuncao);
  const vincular = useServerFn(equipeVincularClientes);
  const alterarStatus = useServerFn(equipeAlterarStatus);
  const remover = useServerFn(equipeRemover);
  const auditoria = useServerFn(equipeAuditoria);

  const { pode, carregando: carregandoPermissoes } = useMinhasPermissoes();
  const podeGerenciar = pode("gerenciar_equipe");

  const { data, isLoading } = useQuery({
    queryKey: ["equipe"],
    queryFn: () => listar(),
    enabled: podeGerenciar,
  });
  const auditoriaQuery = useQuery({
    queryKey: ["equipe-auditoria"],
    queryFn: () => auditoria(),
    enabled: podeGerenciar,
  });

  const membros = (data?.membros ?? []) as MembroEquipe[];

  // Convite novo
  const [emailConvite, setEmailConvite] = useState("");
  const [funcaoConvite, setFuncaoConvite] = useState<FuncaoEquipe>("terapeuta");
  const [escopoConvite, setEscopoConvite] = useState<EscopoEquipe>("vinculados");
  const [permsConvite, setPermsConvite] = useState<Permissao[]>([
    ...FUNCAO_PERMISSOES.terapeuta,
  ]);

  // Diálogos
  const [alvoFuncao, setAlvoFuncao] = useState<MembroEquipe | null>(null);
  const [alvoVinculos, setAlvoVinculos] = useState<MembroEquipe | null>(null);

  // Convite em edição
  const [conviteEditando, setConviteEditando] = useState<string | null>(null);
  const [funcaoConviteEdicao, setFuncaoConviteEdicao] = useState<FuncaoEquipe>("terapeuta");
  const [escopoConviteEdicao, setEscopoConviteEdicao] = useState<EscopoEquipe>("vinculados");
  const [permsConviteEdicao, setPermsConviteEdicao] = useState<Permissao[]>([]);

  // Promover conta existente
  const [emailPromover, setEmailPromover] = useState("");
  const [funcaoPromover, setFuncaoPromover] = useState<FuncaoEquipe>("terapeuta");
  const [escopoPromover, setEscopoPromover] = useState<EscopoEquipe>("vinculados");
  const [permsPromover, setPermsPromover] = useState<Permissao[]>([
    ...FUNCAO_PERMISSOES.terapeuta,
  ]);

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["equipe"] });
    queryClient.invalidateQueries({ queryKey: ["equipe-auditoria"] });
  }

  const mConvidar = useMutation({
    mutationFn: () =>
      convidar({
        data: {
          email: emailConvite,
          funcao: funcaoConvite,
          escopo: escopoConvite,
          permissoes: permsConvite,
        },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Convite criado. Ao criar a conta, a pessoa já entra com essa função.");
        setEmailConvite("");
        recarregar();
      } else {
        toast.error("Esse e-mail já tem conta. Use o bloco “Adicionar conta existente”.");
      }
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mDefinirFuncao = useMutation({
    mutationFn: (dados: {
      alvoId: string;
      funcao: FuncaoEquipe;
      escopo: EscopoEquipe;
      permissoes: Permissao[];
    }) => definirFuncao({ data: dados }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Função e permissões salvas.");
      setAlvoFuncao(null);
      setEmailPromover("");
      recarregar();
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mVincular = useMutation({
    mutationFn: (dados: { alvoId: string; clientes: string[] }) => vincular({ data: dados }),
    onSuccess: () => {
      toast.success("Vínculos atualizados.");
      setAlvoVinculos(null);
      recarregar();
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mStatus = useMutation({
    mutationFn: (dados: { alvoId: string; status: "ativo" | "suspenso" }) =>
      alterarStatus({ data: dados }),
    onSuccess: (_r, v) => {
      avisarMudancaPermissoes();
      toast.success(v.status === "suspenso" ? "Acesso suspenso." : "Acesso reativado.");
      recarregar();
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mRemover = useMutation({
    mutationFn: (alvoId: string) => remover({ data: { alvoId } }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Integrante removido da equipe.");
      recarregar();
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mAtualizarConvite = useMutation({
    mutationFn: (conviteId: string) =>
      atualizarConvite({
        data: {
          conviteId,
          funcao: funcaoConviteEdicao,
          escopo: escopoConviteEdicao,
          permissoes: permsConviteEdicao,
        },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Convite atualizado.");
        setConviteEditando(null);
        recarregar();
      } else {
        toast.error("Esse convite já não está pendente.");
      }
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mReenviar = useMutation({
    mutationFn: (conviteId: string) => reenviar({ data: { conviteId } }),
    onSuccess: (r) =>
      r.ok
        ? (toast.success("Convite reenviado com novo prazo."), recarregar())
        : toast.error("Esse convite já não está pendente."),
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const mCancelar = useMutation({
    mutationFn: (conviteId: string) => cancelar({ data: { conviteId } }),
    onSuccess: () => {
      toast.success("Convite cancelado.");
      recarregar();
    },
    onError: (e: Error) => toast.error(mensagemPainel(e)),
  });

  const linhasMatriz: LinhaMatriz[] = [
    ...membros.map((m) => ({
      id: m.userId,
      nome: m.nome,
      email: m.email,
      papel: (m.funcao === "terapeuta" ? "terapeuta" : "admin") as LinhaMatriz["papel"],
      permissoes: m.permissoes,
      total: m.principal,
    })),
    ...(data?.convites ?? []).map((c) => ({
      id: c.id,
      nome: "",
      email: c.email,
      papel: "convite" as const,
      permissoes: c.permissoes,
    })),
  ];

  const candidato = (data?.candidatos ?? []).find(
    (c) => c.email.toLowerCase() === emailPromover.trim().toLowerCase(),
  );

  if (!carregandoPermissoes && !podeGerenciar) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl text-floresta">Equipe</h1>
        <SecaoSemPermissao permissao="gerenciar_equipe" titulo="Gestão de equipe restrita" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-floresta">Equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cada pessoa recebe uma função, uma abrangência de clientes e apenas as permissões que
          precisa — o menor acesso possível para fazer o trabalho dela.
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 rounded-3xl" />}

      {!isLoading && <MatrizPermissoes linhas={linhasMatriz} />}

      {!isLoading && (
        <ListaMembros
          membros={membros}
          meuId={data?.meuId ?? ""}
          onEditarFuncao={setAlvoFuncao}
          onVincular={setAlvoVinculos}
          onAlterarStatus={(m, status) => mStatus.mutate({ alvoId: m.userId, status })}
          onRemover={(m) => mRemover.mutate(m.userId)}
        />
      )}

      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="flex items-center gap-2 text-xl text-floresta">
          <Mail className="h-5 w-5 text-salvia" /> Convidar por e-mail
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ao criar a conta com este e-mail, a pessoa já entra com a função e as permissões
          escolhidas aqui.
        </p>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-convite">E-mail</Label>
            <Input
              id="email-convite"
              type="email"
              value={emailConvite}
              onChange={(e) => setEmailConvite(e.target.value)}
              className="max-w-sm rounded-full"
            />
          </div>
          <SeletorFuncao
            funcao={funcaoConvite}
            idPrefixo="convite"
            onEscolher={(f) => {
              setFuncaoConvite(f);
              setPermsConvite([...FUNCAO_PERMISSOES[f]]);
              setEscopoConvite(FUNCAO_ESCOPO_PADRAO[f]);
            }}
          />
          <SeletorEscopo escopo={escopoConvite} onChange={setEscopoConvite} idPrefixo="convite" />
          <SeletorPermissoes
            valor={permsConvite}
            onChange={setPermsConvite}
            idPrefixo="convite-perm"
            funcao={funcaoConvite}
          />
          <Button
            onClick={() => mConvidar.mutate()}
            disabled={!emailConvite || permsConvite.length === 0 || mConvidar.isPending}
            className="rounded-full bg-terracota px-6 text-terracota-foreground hover:bg-terracota/90"
          >
            <UserPlus className="mr-2 h-4 w-4" /> Criar convite
          </Button>
        </div>

        {(data?.convites ?? []).length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs uppercase tracking-wider text-salvia">Convites pendentes</p>
            {(data?.convites ?? []).map((c) => (
              <div key={c.id} className="rounded-2xl bg-secondary p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-floresta">{c.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {FUNCAO_LABEL[c.funcao as FuncaoEquipe] ?? c.funcao} ·{" "}
                      {ESCOPO_LABEL[c.escopo as EscopoEquipe] ?? c.escopo} · criado em{" "}
                      {formatarData(c.created_at)}
                      {c.reenviado_em ? ` · reenviado em ${formatarData(c.reenviado_em)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.permissoes.map((p) => PERMISSAO_LABEL[p as Permissao] ?? p).join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full border-salvia text-salvia"
                      onClick={() => {
                        setConviteEditando(conviteEditando === c.id ? null : c.id);
                        setFuncaoConviteEdicao(c.funcao as FuncaoEquipe);
                        setEscopoConviteEdicao(c.escopo as EscopoEquipe);
                        setPermsConviteEdicao(filtrarPermissoes(c.permissoes));
                      }}
                    >
                      {conviteEditando === c.id ? "Fechar" : "Ajustar acesso"}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full border-floresta/20 text-floresta"
                      onClick={() => mReenviar.mutate(c.id)}
                      disabled={mReenviar.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" /> Reenviar
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-full text-terracota"
                      onClick={() => mCancelar.mutate(c.id)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>

                {conviteEditando === c.id && (
                  <div className="mt-4 space-y-4">
                    <SeletorFuncao
                      funcao={funcaoConviteEdicao}
                      idPrefixo={`conv-${c.id}`}
                      onEscolher={(f) => {
                        setFuncaoConviteEdicao(f);
                        setPermsConviteEdicao([...FUNCAO_PERMISSOES[f]]);
                        setEscopoConviteEdicao(FUNCAO_ESCOPO_PADRAO[f]);
                      }}
                    />
                    <SeletorEscopo
                      escopo={escopoConviteEdicao}
                      onChange={setEscopoConviteEdicao}
                      idPrefixo={`conv-${c.id}`}
                    />
                    <SeletorPermissoes
                      valor={permsConviteEdicao}
                      onChange={setPermsConviteEdicao}
                      idPrefixo={`conv-perm-${c.id}`}
                      funcao={funcaoConviteEdicao}
                    />
                    <Button
                      onClick={() => mAtualizarConvite.mutate(c.id)}
                      disabled={permsConviteEdicao.length === 0 || mAtualizarConvite.isPending}
                      className="rounded-full bg-salvia px-6 text-salvia-foreground hover:bg-salvia/90"
                    >
                      Salvar convite
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="flex items-center gap-2 text-xl text-floresta">
          <UserPlus className="h-5 w-5 text-salvia" /> Adicionar conta existente
        </h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-promover">E-mail de quem já tem conta</Label>
            <Input
              id="email-promover"
              type="email"
              value={emailPromover}
              onChange={(e) => setEmailPromover(e.target.value)}
              className="max-w-sm rounded-full"
            />
            {emailPromover && !candidato && (
              <p className="text-xs text-terracota">
                Nenhuma conta com esse e-mail disponível para adicionar.
              </p>
            )}
            {candidato && (
              <p className="text-xs text-muted-foreground">
                Encontrada: {candidato.nome || candidato.email}
              </p>
            )}
          </div>
          <SeletorFuncao
            funcao={funcaoPromover}
            idPrefixo="promover"
            onEscolher={(f) => {
              setFuncaoPromover(f);
              setPermsPromover([...FUNCAO_PERMISSOES[f]]);
              setEscopoPromover(FUNCAO_ESCOPO_PADRAO[f]);
            }}
          />
          <SeletorEscopo
            escopo={escopoPromover}
            onChange={setEscopoPromover}
            idPrefixo="promover"
          />
          <SeletorPermissoes
            valor={permsPromover}
            onChange={setPermsPromover}
            idPrefixo="promover-perm"
            funcao={funcaoPromover}
          />
          <Button
            onClick={() =>
              candidato &&
              mDefinirFuncao.mutate({
                alvoId: candidato.userId,
                funcao: funcaoPromover,
                escopo: escopoPromover,
                permissoes: permsPromover,
              })
            }
            disabled={!candidato || mDefinirFuncao.isPending}
            className="rounded-full bg-floresta px-6 text-floresta-foreground hover:bg-floresta/90"
          >
            Adicionar à equipe
          </Button>
        </div>
      </section>

      <HistoricoAuditoria
        registros={auditoriaQuery.data?.registros ?? []}
        carregando={auditoriaQuery.isLoading}
      />

      {alvoFuncao && (
        <DialogoFuncao
          aberto={Boolean(alvoFuncao)}
          onAberto={(v) => !v && setAlvoFuncao(null)}
          titulo={`Acesso de ${alvoFuncao.nome || alvoFuncao.email}`}
          descricao="Escolha a função, a abrangência de clientes e ajuste permissão por permissão."
          bloqueado={alvoFuncao.principal}
          salvando={mDefinirFuncao.isPending}
          inicial={{
            funcao: alvoFuncao.funcao,
            escopo: alvoFuncao.escopo,
            permissoes: filtrarPermissoes(alvoFuncao.permissoes),
          }}
          onSalvar={(dados) =>
            mDefinirFuncao.mutate({ alvoId: alvoFuncao.userId, ...dados })
          }
        />
      )}

      <DialogoVinculos
        aberto={Boolean(alvoVinculos)}
        onAberto={(v) => !v && setAlvoVinculos(null)}
        membro={alvoVinculos}
        clientes={data?.clientes ?? []}
        salvando={mVincular.isPending}
        onSalvar={(clientes) =>
          alvoVinculos && mVincular.mutate({ alvoId: alvoVinculos.userId, clientes })
        }
      />
    </div>
  );
}
