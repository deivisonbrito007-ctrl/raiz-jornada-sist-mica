import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, ShieldCheck, ShieldOff, Trash2, UserPlus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  equipeAuditoria,
  equipeCancelarConvite,
  equipeConvidar,
  equipeDefinirPermissoes,
  equipeListar,
  equipeRemover,
} from "@/lib/equipe.functions";
import { PERMISSAO_DESCRICAO, PERMISSAO_LABEL, PERMISSOES, type Permissao } from "@/lib/permissoes";
import { formatarData } from "@/lib/raiz-format";
import { avisarMudancaPermissoes } from "@/hooks/use-vigia-permissoes";
import { MatrizPermissoes, type LinhaMatriz } from "@/components/matriz-permissoes";
import { HistoricoAuditoria } from "@/components/historico-auditoria";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AvisoPermissao } from "@/components/aviso-permissao";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import { notificarErro } from "@/lib/erro-permissao";

export const Route = createFileRoute("/_authenticated/admin/equipe")({
  component: AdminEquipe,
});

function SeletorPermissoes({
  valor,
  onChange,
  idPrefixo,
}: {
  valor: Permissao[];
  onChange: (p: Permissao[]) => void;
  idPrefixo: string;
}) {
  function alternar(p: Permissao, marcado: boolean) {
    onChange(marcado ? [...valor, p] : valor.filter((x) => x !== p));
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {PERMISSOES.map((p) => (
        <label
          key={p}
          htmlFor={`${idPrefixo}-${p}`}
          className="flex items-start gap-3 rounded-2xl bg-secondary p-3 text-sm"
        >
          <Checkbox
            id={`${idPrefixo}-${p}`}
            checked={valor.includes(p)}
            onCheckedChange={(v) => alternar(p, v === true)}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-floresta">{PERMISSAO_LABEL[p]}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {PERMISSAO_DESCRICAO[p]}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function AdminEquipe() {
  const queryClient = useQueryClient();
  const listar = useServerFn(equipeListar);
  const convidar = useServerFn(equipeConvidar);
  const cancelar = useServerFn(equipeCancelarConvite);
  const definir = useServerFn(equipeDefinirPermissoes);
  const remover = useServerFn(equipeRemover);
  const auditoria = useServerFn(equipeAuditoria);

  const perms = useMinhasPermissoes();
  const bloqueado = perms.bloqueado("gerenciar_equipe");
  const {
    data,
    isLoading,
    error: erroEquipe,
    refetch: recarregarEquipe,
  } = useQuery({
    queryKey: ["equipe"],
    queryFn: () => listar(),
    enabled: !bloqueado,
    retry: false,
  });
  const auditoriaQuery = useQuery({
    queryKey: ["equipe-auditoria"],
    queryFn: () => auditoria(),
    enabled: !bloqueado,
    retry: false,
  });

  const [emailConvite, setEmailConvite] = useState("");
  const [permsConvite, setPermsConvite] = useState<Permissao[]>(["ver_clientes"]);
  const [emailPromover, setEmailPromover] = useState("");
  const [permsPromover, setPermsPromover] = useState<Permissao[]>(["ver_clientes"]);
  const [editando, setEditando] = useState<string | null>(null);
  const [permsEdicao, setPermsEdicao] = useState<Permissao[]>([]);
  const [motivoConvite, setMotivoConvite] = useState("");
  const [motivoPromover, setMotivoPromover] = useState("");
  const [motivoEdicao, setMotivoEdicao] = useState("");

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["equipe"] });
    queryClient.invalidateQueries({ queryKey: ["equipe-auditoria"] });
  }

  const mConvidar = useMutation({
    mutationFn: () =>
      convidar({
        data: { email: emailConvite, permissoes: permsConvite, motivo: motivoConvite },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Convite criado. Ao criar a conta, a pessoa já entra como admin.");
        setEmailConvite("");
        setMotivoConvite("");
        recarregar();
      } else {
        toast.error("Esse e-mail já tem conta. Use o bloco “Promover conta existente”.");
      }
    },
    onError: (e: Error) => notificarErro(e),
  });

  const mPromover = useMutation({
    mutationFn: (alvoId: string) =>
      definir({ data: { alvoId, permissoes: permsPromover, motivo: motivoPromover } }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Admin adicionado.");
      setEmailPromover("");
      setMotivoPromover("");
      recarregar();
    },
    onError: (e: Error) => notificarErro(e),
  });

  const mAtualizar = useMutation({
    mutationFn: (alvoId: string) =>
      definir({ data: { alvoId, permissoes: permsEdicao, motivo: motivoEdicao } }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Permissões atualizadas.");
      setEditando(null);
      setMotivoEdicao("");
      recarregar();
    },
    onError: (e: Error) => notificarErro(e),
  });

  const mRevogar = useMutation({
    mutationFn: (alvoId: string) =>
      definir({ data: { alvoId, permissoes: [], motivo: motivoEdicao } }),
    onSuccess: () => {
      toast.success("Permissões revogadas. O painel dessa pessoa é bloqueado na hora.");
      setEditando(null);
      setMotivoEdicao("");
      recarregar();
    },
    onError: (e: Error) => notificarErro(e),
  });


  const mRemover = useMutation({
    mutationFn: (alvoId: string) => remover({ data: { alvoId, motivo: motivoEdicao } }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Acesso removido.");
      setMotivoEdicao("");
      recarregar();
    },
    onError: (e: Error) => notificarErro(e),
  });

  const mCancelar = useMutation({
    mutationFn: (conviteId: string) => cancelar({ data: { conviteId, motivo: motivoEdicao } }),
    onSuccess: () => {
      avisarMudancaPermissoes();
      toast.success("Convite cancelado.");
      recarregar();
    },
    onError: (e: Error) => notificarErro(e),
  });

  const linhasMatriz: LinhaMatriz[] = [
    ...(data?.terapeutas ?? []).map((t) => ({
      id: t.userId,
      nome: t.nome,
      email: t.email,
      papel: "terapeuta" as const,
      permissoes: [],
      total: true,
    })),
    ...(data?.membros ?? []).map((m) => ({
      id: m.userId,
      nome: m.nome,
      email: m.email,
      papel: "admin" as const,
      permissoes: m.permissoes,
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

  if (bloqueado) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl text-floresta">Equipe</h1>
        <AvisoPermissao permissao="gerenciar_equipe" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl text-floresta">Equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Convide pessoas para ajudar a administrar o espaço e escolha exatamente o que cada uma
          pode ver e fazer.
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 rounded-3xl" />}

      {erroEquipe ? (
        <AvisoPermissao erro={erroEquipe} onTentarNovamente={() => recarregarEquipe()} />
      ) : null}

      {!isLoading && !erroEquipe && <MatrizPermissoes linhas={linhasMatriz} />}


      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="flex items-center gap-2 text-xl text-floresta">
          <ShieldCheck className="h-5 w-5 text-salvia" /> Membros
        </h2>

        <div className="mt-4 space-y-3">
          {(data?.terapeutas ?? []).map((t) => (
            <div key={t.userId} className="rounded-2xl bg-secondary p-4">
              <p className="font-medium text-floresta">{t.nome || t.email}</p>
              <p className="text-xs text-muted-foreground">
                {t.email} · terapeuta responsável (acesso total)
              </p>
            </div>
          ))}

          {(data?.membros ?? []).map((m) => (
            <div key={m.userId} className="rounded-2xl border border-border p-4">
              <div className="mb-3">
                <Label htmlFor={`motivo-${m.userId}`} className="text-xs text-muted-foreground">
                  Motivo (registrado no histórico)
                </Label>
                <Input
                  id={`motivo-${m.userId}`}
                  value={motivoEdicao}
                  onChange={(e) => setMotivoEdicao(e.target.value)}
                  placeholder="Ex.: saiu da equipe, mudança de função…"
                  maxLength={300}
                  className="mt-1 max-w-md rounded-full"
                />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-floresta">{m.nome || m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.email} · admin desde {formatarData(m.desde)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.permissoes.length === 0
                      ? "Sem permissões — não vê nada do painel."
                      : m.permissoes
                          .map((p) => PERMISSAO_LABEL[p as Permissao] ?? p)
                          .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full border-floresta/20 text-floresta"
                    onClick={() => {
                      setEditando(editando === m.userId ? null : m.userId);
                      setPermsEdicao(m.permissoes as Permissao[]);
                    }}
                  >
                    {editando === m.userId ? "Fechar" : "Editar permissões"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-terracota/30 text-terracota"
                    onClick={() => mRevogar.mutate(m.userId)}
                    disabled={m.permissoes.length === 0 || mRevogar.isPending}
                    aria-label={`Revogar permissões de ${m.email}`}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" /> Revogar permissões
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="rounded-full text-terracota"
                        aria-label={`Remover acesso de ${m.email}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-floresta">
                          Remover o acesso de {m.nome || m.email}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Todas as permissões são apagadas na hora e a pessoa deixa de ser admin.
                          O painel dela é bloqueado imediatamente. Ela continua com a conta de
                          cliente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
                          onClick={() => mRemover.mutate(m.userId)}
                        >
                          Remover acesso
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                </div>
              </div>

              {editando === m.userId && (
                <div className="mt-4 space-y-4">
                  <SeletorPermissoes
                    valor={permsEdicao}
                    onChange={setPermsEdicao}
                    idPrefixo={`edit-${m.userId}`}
                  />
                  <Button
                    onClick={() => mAtualizar.mutate(m.userId)}
                    disabled={mAtualizar.isPending}
                    className="rounded-full bg-salvia px-6 text-salvia-foreground hover:bg-salvia/90"
                  >
                    Salvar permissões
                  </Button>
                </div>
              )}
            </div>
          ))}

          {!isLoading && (data?.membros ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum admin ainda. Convide alguém abaixo.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="flex items-center gap-2 text-xl text-floresta">
          <Mail className="h-5 w-5 text-salvia" /> Convidar por e-mail
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ao criar a conta com este e-mail, a pessoa já entra como admin com as permissões
          marcadas.
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
          <SeletorPermissoes
            valor={permsConvite}
            onChange={setPermsConvite}
            idPrefixo="convite"
          />
          <div className="space-y-2">
            <Label htmlFor="motivo-convite">Motivo do convite (registrado no histórico)</Label>
            <Input
              id="motivo-convite"
              value={motivoConvite}
              onChange={(e) => setMotivoConvite(e.target.value)}
              placeholder="Ex.: vai apoiar as liberações semanais"
              maxLength={300}
              className="max-w-md rounded-full"
            />
          </div>
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
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4"
              >
                <div>
                  <p className="text-sm font-medium text-floresta">{c.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.permissoes.map((p) => PERMISSAO_LABEL[p as Permissao] ?? p).join(" · ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="rounded-full text-terracota"
                  onClick={() => mCancelar.mutate(c.id)}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="flex items-center gap-2 text-xl text-floresta">
          <UserPlus className="h-5 w-5 text-salvia" /> Promover conta existente
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
                Nenhuma conta com esse e-mail disponível para promover.
              </p>
            )}
            {candidato && (
              <p className="text-xs text-muted-foreground">
                Encontrada: {candidato.nome || candidato.email}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="motivo-promover">Motivo da promoção (registrado no histórico)</Label>
            <Input
              id="motivo-promover"
              value={motivoPromover}
              onChange={(e) => setMotivoPromover(e.target.value)}
              placeholder="Ex.: assumiu a gestão da biblioteca"
              maxLength={300}
              className="max-w-md rounded-full"
            />
          </div>
          <SeletorPermissoes
            valor={permsPromover}
            onChange={setPermsPromover}
            idPrefixo="promover"
          />
          <Button
            onClick={() => candidato && mPromover.mutate(candidato.userId)}
            disabled={!candidato || mPromover.isPending}
            className="rounded-full bg-floresta px-6 text-floresta-foreground hover:bg-floresta/90"
          >
            Tornar admin
          </Button>
        </div>
      </section>

      <HistoricoAuditoria
        registros={auditoriaQuery.data?.registros ?? []}
        carregando={auditoriaQuery.isLoading}
      />

    </div>
  );
}
