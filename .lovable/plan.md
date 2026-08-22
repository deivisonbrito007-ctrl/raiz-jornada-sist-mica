# Aba Equipe com funções, permissões e escopo por cliente

## Como fica a estrutura de pessoas

- Sua conta atual continua a mesma, com acesso irrestrito, agora chamada **Proprietário** (nome de exibição "Brito", editável no perfil).
- A terapeuta convidada recebe o perfil **Terapeuta** e vê apenas os clientes vinculados a ela — como só existe uma terapeuta, o vínculo usa o campo "terapeuta responsável" que já existe no cadastro de cada cliente, com a possibilidade de você marcar exceções (autorização específica) por integrante.
- Os outros perfis existem para quando a equipe crescer, todos com o mínimo de acesso.

## Perfis e o que cada um recebe por padrão

| Perfil | Acesso padrão |
| --- | --- |
| Proprietário | Tudo, inclusive equipe e auditoria. Nunca pode ser removido nem suspenso. |
| Administrador | Tudo, exceto gerenciar equipe (opcional por marcação). |
| Terapeuta | Ver e editar clientes vinculados, criar planos, monitorar trilhas, ver registros compartilhados desses clientes. |
| Editor de conteúdo | Criar e publicar conteúdos. Nenhum dado de cliente. |
| Assistente administrativo | Ver clientes (dados cadastrais), gerenciar pacotes. Sem diário, sem check-ins. |
| Suporte | Ver clientes (cadastro) e ver auditoria. Sem conteúdos, sem registros sensíveis. |

Cada perfil é só um ponto de partida: depois de escolher, você pode marcar/desmarcar permissões individualmente e o cartão passa a mostrar "Terapeuta (personalizado)".

## Permissões separadas

Visualizar clientes · Editar clientes · Criar planos · Monitorar trilhas · Ver registros compartilhados (diário e check-ins) · Criar conteúdos · Publicar conteúdos · Gerenciar pacotes · Gerenciar equipe · Ver auditoria.

Regras de menor acesso aplicadas no banco, não só na tela:
- "Ver registros compartilhados" é uma permissão isolada; sem ela, diário e check-ins não carregam nem por requisição direta.
- Quem tem escopo "somente clientes vinculados" só lê e escreve dados dos clientes cuja responsável é ela (ou dos clientes liberados por exceção).
- "Publicar conteúdos" é separado de "Criar conteúdos": editor sem publicação deixa em revisão.

## Listagem de integrantes

Cada linha mostra: iniciais em círculo (ou foto quando houver), nome, e-mail, etiqueta de função, status (Ativo / Suspenso / Convite pendente), número de clientes vinculados, último acesso real e data do convite. Menu de ações em cada linha com: Reenviar convite, Editar função, Definir permissões, Vincular clientes, Suspender/Reativar acesso, Remover da equipe. Filtro por função e por status, e busca por nome/e-mail. Convidar integrante fica no topo, escolhendo a função e ajustando permissões antes de enviar.

## Suspensão e último acesso

- Suspender mantém o registro e o histórico, mas bloqueia tudo imediatamente (as próprias funções de banco passam a negar), com aviso na tela da pessoa e desconexão na próxima navegação.
- "Último acesso" vem do sistema de autenticação, lido no servidor por quem gerencia a equipe; nunca exposto a outros integrantes.

## Auditoria

Passam a ser registrados com autor, alvo e antes/depois: convite criado, reenviado e cancelado, mudança de função, alteração de permissões, vínculo de clientes alterado, suspensão, reativação e remoção. Aparecem no histórico já existente da aba, com destaque para as ações que retiram acesso.

## Detalhes técnicos

- Migração: nova tabela `equipe_membros` (user_id, funcao enum `equipe_funcao`, status enum `equipe_status`, escopo enum `equipe_escopo` = `todos`/`vinculados`, convidado_em, criado_por, timestamps) substituindo o papel implícito de `equipe_admins`; `convites_equipe` ganha `funcao`, `escopo` e `reenviado_em`; nova `equipe_clientes` (user_id, cliente_id) para exceções de vínculo. GRANTs + RLS restritas a `gerenciar_equipe` em todas.
- Ampliar `PERMISSOES` para as 10 permissões (`ver_clientes`, `editar_clientes`, `criar_planos`, `monitorar_trilhas`, `ver_registros`, `criar_conteudos`, `publicar_conteudos`, `gerenciar_pacotes`, `gerenciar_equipe`, `ver_auditoria`) com mapa de migração das antigas (`ver_diario`→`ver_registros`, `gerenciar_conteudos`→`criar_conteudos`+`publicar_conteudos`, `gerenciar_liberacoes`→`criar_planos`+`monitorar_trilhas`).
- Funções security definer atualizadas: `tem_permissao` passa a exigir status `ativo`; `pode_administrar` idem; nova `escopo_cliente(_user_id, _cliente)` usada em `acompanha_cliente` para restringir por `clientes_acesso.terapeuta_id` ou `equipe_clientes`. RLS de `diario`, `checkins`, `revisoes`, `progresso`, `atribuicoes`, `conteudos` e `pacotes` reescritas sobre as novas permissões.
- `src/lib/equipe-funcoes.ts` novo: enum de funções, rótulos, descrições e matriz função→permissões padrão. `src/lib/permissoes.ts` atualizado.
- `src/lib/equipe.functions.ts`: novas funções `equipeReenviarConvite`, `equipeDefinirFuncao`, `equipeVincularClientes`, `equipeAlterarStatus`; `equipeListar` passa a devolver função, status, contagem de vínculos, último acesso (via cliente administrativo, apenas `last_sign_in_at`) e data do convite. Todas com `garantirPermissao('gerenciar_equipe')` e `registrarAuditoria`.
- `src/lib/auditoria-equipe.ts`: novas ações `funcao_alterada`, `convite_reenviado`, `vinculos_alterados`, `acesso_suspenso`, `acesso_reativado`.
- UI: `src/components/painel/equipe/` com `lista-membros.tsx`, `linha-membro.tsx`, `dialogo-convite.tsx`, `dialogo-funcao.tsx`, `dialogo-vinculos.tsx`, `avatar-iniciais.tsx`; `admin.equipe.tsx` reduz a composição. `use-minhas-permissoes` e a barra lateral passam a considerar as novas permissões e o status suspenso.
- Testes: `equipe-funcoes.test.ts` (matriz de perfis e menor acesso), `equipe-escopo.rls.test.ts` (editor não lê cliente; assistente não lê diário/check-ins; terapeuta só vê vinculados; suspenso não lê nada) e teste da listagem/ações na tela.
