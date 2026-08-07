"""E2E: cada rota/ação do painel do terapeuta bloqueia no SERVIDOR sem permissão.

O teste não confia na UI. Ele importa, dentro do navegador, os módulos reais de
server functions do painel (`admin*` e `equipe*`) e os invoca pelo caminho real
cliente -> servidor (mesma serialização e mesmo middleware de autenticação).
Toda função administrativa precisa falhar no servidor com "Acesso restrito"
(ou "Unauthorized" sem sessão) e nunca devolver dados sensíveis.

Cenários cobertos:
  1. Sem sessão: todas as funções administrativas são recusadas no servidor.
  2. Com a sessão real injetada pelo sandbox: as funções cuja permissão o
     usuário NÃO possui continuam recusadas no servidor.
  3. Navegação: cada rota /admin/* redireciona quem não pode administrar.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso: python3 e2e/painel_terapeuta_permissoes_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

UUID = "11111111-1111-4111-8111-111111111111"

# Cada função administrativa: módulo, permissão exigida no servidor e payload
# válido (para o bloqueio ser de permissão, nunca de validação de entrada).
FUNCOES = [
    ("raiz", "adminResumo", "ver_clientes", None),
    ("raiz", "adminGetCliente", "ver_clientes", {"clienteId": UUID}),
    ("raiz", "adminListarConteudos", "gerenciar_conteudos", None),
    (
        "raiz",
        "adminDefinirLiberacao",
        "gerenciar_liberacoes",
        {"clienteId": UUID, "eixoId": UUID, "liberar": True, "motivo": "teste e2e"},
    ),
    (
        "raiz",
        "adminSalvarConteudo",
        "gerenciar_conteudos",
        {"eixoId": UUID, "tipo": "texto", "titulo": "E2E não deve gravar"},
    ),
    ("raiz", "adminApagarConteudo", "gerenciar_conteudos", {"id": UUID}),
    ("raiz", "adminSalvarEixo", "gerenciar_conteudos", {"nome": "E2E não deve gravar"}),
    (
        "raiz",
        "adminSalvarPacote",
        "gerenciar_pacotes",
        {"nome": "E2E não deve gravar", "tipoCobranca": "pagamento_unico"},
    ),
    ("raiz", "adminVincularPacote", "gerenciar_pacotes", {"clienteId": UUID, "pacoteId": UUID}),
    (
        "raiz",
        "adminAtualizarPagamento",
        "gerenciar_pacotes",
        {"id": UUID, "statusPagamento": "pago"},
    ),
    ("equipe", "equipeListar", "gerenciar_equipe", None),
    (
        "equipe",
        "equipeConvidar",
        "gerenciar_equipe",
        {"email": "e2e-bloqueado@example.com", "permissoes": ["ver_clientes"]},
    ),
    ("equipe", "equipeCancelarConvite", "gerenciar_equipe", {"conviteId": UUID}),
    (
        "equipe",
        "equipeDefinirPermissoes",
        "gerenciar_equipe",
        {"alvoId": UUID, "permissoes": ["ver_clientes"]},
    ),
    ("equipe", "equipeRemover", "gerenciar_equipe", {"alvoId": UUID}),
    ("equipe", "equipeAuditoria", "gerenciar_equipe", None),
]

ROTAS_ADMIN = ["/admin", "/admin/conteudos", "/admin/pacotes", "/admin/equipe"]

# Chaves que jamais podem voltar de uma chamada bloqueada.
CHAVES_SENSIVEIS = ("clientes", "admins", "convites", "eventos", "conteudos", "pacotes", "diario")

SCRIPT_CHAMADAS = """
async ({ funcoes }) => {
  const mods = {
    raiz: await import('/src/lib/raiz.functions.ts'),
    equipe: await import('/src/lib/equipe.functions.ts'),
  };
  const saida = [];
  for (const [mod, nome, permissao, payload] of funcoes) {
    const fn = mods[mod][nome];
    if (typeof fn !== 'function') {
      saida.push({ nome, permissao, existe: false });
      continue;
    }
    try {
      const r = await (payload === null ? fn() : fn({ data: payload }));
      saida.push({ nome, permissao, existe: true, ok: true, corpo: JSON.stringify(r).slice(0, 800) });
    } catch (e) {
      saida.push({
        nome,
        permissao,
        existe: true,
        ok: false,
        erro: String((e && (e.message || e.statusText)) || e).slice(0, 300),
        status: (e && e.status) || null,
      });
    }
  }
  return saida;
}
"""

SCRIPT_CONTEXTO = """
async () => {
  const mod = await import('/src/lib/raiz.functions.ts');
  try {
    return { ok: true, ctx: await mod.getMeuContexto() };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  }
}
"""


def afirmar_bloqueio(res: dict, cenario: str) -> None:
    nome = res["nome"]
    assert res.get("existe"), f"{cenario}: função {nome} não existe mais no módulo"
    assert not res.get("ok"), (
        f"{cenario}: {nome} respondeu com sucesso sem a permissão "
        f"{res['permissao']} — corpo={res.get('corpo')}"
    )
    erro = (res.get("erro") or "").lower()
    assert (
        "acesso restrito" in erro
        or "unauthorized" in erro
        or "não autenticado" in erro
        or "nao autenticado" in erro
    ), f"{cenario}: {nome} falhou por outro motivo (esperado bloqueio): {res.get('erro')}"
    for chave in CHAVES_SENSIVEIS:
        assert f'"{chave}"' not in erro, f"{cenario}: {nome} vazou dado sensível no erro"


async def main() -> None:
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ---------- Cenário 1: sem sessão ----------
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        resultados = await page.evaluate(SCRIPT_CHAMADAS, {"funcoes": FUNCOES})
        assert len(resultados) == len(FUNCOES)
        for res in resultados:
            afirmar_bloqueio(res, "sem sessão")
        print(f"sem sessão: {len(resultados)} funções administrativas bloqueadas no servidor ✔")

        for rota in ROTAS_ADMIN:
            await page.goto(f"{BASE_URL}{rota}", wait_until="networkidle")
            assert "/auth" in page.url, f"sem sessão, {rota} não redirecionou (url={page.url})"
        print("sem sessão: /admin/* redireciona para /auth ✔")

        # ---------- Cenário 2: sessão real do sandbox ----------
        if not (session_json and storage_key):
            print("sem sessão injetada: cenário autenticado NÃO VERIFICADO")
            await browser.close()
            return

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = BASE_URL
            await context.add_cookies(cookies)
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
        await page.reload(wait_until="domcontentloaded")

        info = await page.evaluate(SCRIPT_CONTEXTO)
        assert info.get("ok"), f"sessão injetada inválida: {info.get('erro')}"
        ctx = info["ctx"]
        papel = ctx.get("papel")
        permissoes = set(ctx.get("permissoes") or [])
        pode_administrar = bool(ctx.get("podeAdministrar"))
        print(f"sessão injetada: papel={papel} permissoes={sorted(permissoes)}")

        alvo = [
            f
            for f in FUNCOES
            if papel != "terapeuta" and f[2] not in permissoes
        ]
        if alvo:
            resultados = await page.evaluate(SCRIPT_CHAMADAS, {"funcoes": alvo})
            for res in resultados:
                afirmar_bloqueio(res, f"sessão sem permissão ({res['permissao']})")
            print(f"sessão autenticada: {len(resultados)} funções sem permissão bloqueadas ✔")
        else:
            print(
                "a sessão injetada é terapeuta/tem todas as permissões: "
                "cenário autenticado sem permissão NÃO VERIFICADO"
            )

        for rota in ROTAS_ADMIN:
            await page.goto(f"{BASE_URL}{rota}", wait_until="networkidle")
            if pode_administrar:
                assert "/auth" not in page.url, f"admin legítimo expulso de {rota}"
            else:
                for _ in range(20):
                    if rota not in page.url:
                        break
                    await page.wait_for_timeout(500)
                assert rota not in page.url, (
                    f"sessão sem acesso administrativo permaneceu em {rota} (url={page.url})"
                )
        estado = "com acesso" if pode_administrar else "sem acesso"
        print(f"sessão {estado}: navegação coerente em /admin/* ✔")
        await page.screenshot(path=str(SCREENSHOTS / "painel_permissoes.png"))

        await browser.close()

    print("\nOK: painel do terapeuta bloqueia no servidor sem permissão.")


if __name__ == "__main__":
    asyncio.run(main())
