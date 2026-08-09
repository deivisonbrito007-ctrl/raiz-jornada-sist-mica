import { createFileRoute } from "@tanstack/react-router";
import { PERMISSAO_LABEL, PERMISSAO_DESCRICAO, PERMISSOES } from "@/lib/permissoes";

export const Route = createFileRoute("/_authenticated/admin/ajuda")({
  component: AdminAjuda,
});

const areas = [
  {
    nome: "Clientes",
    texto:
      "Lista de todas as pessoas acompanhadas, com sequência de semanas, linha do tempo e progresso da trilha. Clique em alguém para ver o detalhe.",
  },
  {
    nome: "Planos de acompanhamento",
    texto:
      "Onde você convida clientes, atribui trilhas e define o ritmo de cada plano individual.",
  },
  {
    nome: "Monitoramento",
    texto:
      "Check-ins, revisões e pedidos de apoio recebidos entre sessões, com espaço para responder.",
  },
  {
    nome: "Trilhas",
    texto: "Estrutura das trilhas: etapas, ordem e instruções de cada passo.",
  },
  {
    nome: "Conteúdos",
    texto: "Biblioteca de mídias, textos e exercícios que alimentam as etapas das trilhas.",
  },
  { nome: "Pacotes", texto: "Pacotes de acompanhamento, valores e vínculo com cada cliente." },
  { nome: "Equipe", texto: "Convite, permissões e remoção de outras pessoas com acesso ao painel." },
  {
    nome: "Auditoria",
    texto: "Registro de ações administrativas e de tentativas de acesso sem permissão.",
  },
];

function AdminAjuda() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-floresta">Ajuda</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O que cada área do painel faz e o que cada permissão libera.
        </p>
      </div>

      <section aria-labelledby="titulo-areas" className="space-y-3">
        <h2 id="titulo-areas" className="font-display text-xl text-floresta">
          Áreas do painel
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {areas.map((a) => (
            <li key={a.nome} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
              <p className="font-medium text-floresta">{a.nome}</p>
              <p className="mt-1 text-sm text-muted-foreground">{a.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-permissoes" className="space-y-3">
        <h2 id="titulo-permissoes" className="font-display text-xl text-floresta">
          Permissões
        </h2>
        <dl className="space-y-3">
          {PERMISSOES.map((p) => (
            <div key={p} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
              <dt className="font-medium text-floresta">{PERMISSAO_LABEL[p]}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{PERMISSAO_DESCRICAO[p]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
