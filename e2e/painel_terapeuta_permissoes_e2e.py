"""E2E: cada rota/ação do painel do terapeuta bloqueia no SERVIDOR sem permissão.

O teste não confia na UI: ele descobre os endpoints reais das server functions
administrativas (`admin*` e `equipe*`) lendo os módulos servidos pelo dev server
e os chama diretamente por HTTP.

Cenários cobertos:
  1. Sem sessão: toda função administrativa deve ser recusada pelo servidor.
  2. Com sessão real (injetada pelo sandbox) que NÃO tem a permissão exigida:
     a função continua recusada no servidor (nenhum dado sensível no corpo).
  3. Navegação: cada rota /admin/* redireciona quem não pode administrar.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso: python3 e2e/painel_terapeuta_permissoes_e2e.py
"""

import asyncio
import json
import os
import re
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MODULOS = ["/src/lib/raiz.functions.ts", "/src/lib/equipe.functions.ts"]

# Permissão exigida no servidor por função administrativa.
PERMISSAO_POR_FUNCAO = {
    "adminResumo": "ver_clientes",
    "adminGetCliente": "ver_clientes",
    "adminDefinirLiberacao": "gerenciar_liberacoes",
    "adminSalvarConteudo": "gerenciar_conteudos",
    "adminApagarConteudo": "gerenciar_conteudos",
    "adminSalvarEixo": "gerenciar_conteudos",
    "adminListarConteudos": "gerenciar_conteudos",
    "adminSalvarPacote": "gerenciar_pacotes",
    "adminVincularPacote": "gerenciar_pacotes",
    "adminAtualizarPagamento": "gerenciar_pacotes",
    "equipeListar": "gerenciar_equipe",
    "equipeConvidar": "gerenciar_equipe",
    "equipeCancelarConvite": "gerenciar_equipe",
    "equipeDefinirPermissoes": "gerenciar_equipe",
    "equipeRemover": "gerenciar_equipe",
    "equipeAuditoria": "gerenciar_equipe",
}

# Rotas do painel e a permissão que as sustenta.
ROTAS_ADMIN = [
    ("/admin", "ver_clientes"),
    ("/admin/conteudos", "gerenciar_conteudos"),
    ("/admin/pacotes", "gerenciar_pacotes"),
    ("/admin/equipe", "gerenciar_equipe"),
]

# Chaves que jamais podem aparecer no corpo de uma resposta bloqueada.
CHAVES_SENSIVEIS = ("clientes", "admins", "convites", "eventos", "conteudos", "pacotes")

PADRAO_RPC = re.compile(
    r'export const (\w+) = createServerFn\(\{ method: "(GET|POST)" \}\)'
    r'[\s\S]*?createClientRpc\("([^"]+)"\)'
)


def descobrir_endpoints() -> dict:
    """Lê os módulos transformados pelo dev server e extrai id + método das RPCs."""
    encontrados = {}
    for caminho in MODULOS:
        resp = requests.get(f"{BASE_URL}{caminho}", timeout=30)
        resp.raise_for_status()
        for nome, metodo, rpc_id in PADRAO_RPC.findall(resp.text):
            if nome in PERMISSAO_POR_FUNCAO:
                encontrados[nome] = {
                    "metodo": metodo,
                    "url": f"{BASE_URL}/_serverFn/{rpc_id}",
                    "permissao": PERMISSAO_POR_FUNCAO[nome],
                }
    faltando = sorted(set(PERMISSAO_POR_FUNCAO) - set(encontrados))
    assert not faltando, f"funções administrativas não encontradas no bundle: {faltando}"
    return encontrados


def chamar(endpoint: dict, token: str | None) -> tuple[int, str]:
    headers = {"Origin": BASE_URL, "Referer": f"{BASE_URL}/admin"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if endpoint["metodo"] == "GET":
        resp = requests.get(endpoint["url"], headers=headers, timeout=30)
    else:
        headers["Content-Type"] = "application/json"
        resp = requests.post(endpoint["url"], headers=headers, data="{}", timeout=30)
    return resp.status_code, resp.text[:2000]


def afirmar_bloqueado(nome: str, status: int, corpo: str, contexto: str) -> None:
    assert status >= 400, f"{contexto}: {nome} respondeu {status} (deveria bloquear)"
    baixo = corpo.lower()
    for chave in CHAVES_SENSIVEIS:
        assert f'"{chave}"' not in baixo, (
            f'{contexto}: {nome} devolveu dado sensível ("{chave}") mesmo bloqueando'
        )


def contexto_do_usuario(token: str) -> dict:
    """Lê getMeuContexto com a sessão injetada para saber o que ela pode fazer."""
    resp = requests.get(f"{BASE_URL}{MODULOS[0]}", timeout=30)
    resp.raise_for_status()
    achado = re.search(
        r'export const getMeuContexto[\s\S]*?createClientRpc\("([^"]+)"\)', resp.text
    )
    assert achado, "getMeuContexto não encontrado no bundle"
    r = requests.get(
        f"{BASE_URL}/_serverFn/{achado.group(1)}",
        headers={"Origin": BASE_URL, "Authorization": f"Bearer {token}"},
        timeout=30,
    )
    if r.status_code >= 400:
        return {}
    dados = r.json()
    return dados.get("result", dados) if isinstance(dados, dict) else {}


async def navegacao_bloqueada(session_json: str | None, storage_key: str | None,
                              cookies_json: str | None, pode_administrar: bool) -> None:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # 1) Sem sessão: toda rota do painel manda para /auth.
        for rota, _perm in ROTAS_ADMIN:
            await page.goto(f"{BASE_URL}{rota}", wait_until="networkidle")
            assert "/auth" in page.url, f"sem sessão, {rota} não redirecionou (url={page.url})"
        print("sem sessão: /admin/* redireciona para /auth ✔")

        if session_json and storage_key:
            if cookies_json:
                cookies = json.loads(cookies_json)
                for c in cookies:
                    c["url"] = BASE_URL
                await context.add_cookies(cookies)
            await page.goto(BASE_URL)
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
            for rota, _perm in ROTAS_ADMIN:
                await page.goto(f"{BASE_URL}{rota}", wait_until="networkidle")
                if pode_administrar:
                    assert "/auth" not in page.url, f"admin legítimo expulso de {rota}"
                else:
                    # o guard é client-side: aguarda a saída da rota protegida
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


def main() -> None:
    endpoints = descobrir_endpoints()
    print(f"{len(endpoints)} funções administrativas descobertas no bundle")

    # Cenário 1 — sem sessão nenhuma.
    for nome, ep in sorted(endpoints.items()):
        status, corpo = chamar(ep, None)
        afirmar_bloqueado(nome, status, corpo, "sem sessão")
    print("sem sessão: todas as funções administrativas bloqueadas no servidor ✔")

    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    pode_administrar = False
    if session_json:
        token = json.loads(session_json)["access_token"]
        ctx = contexto_do_usuario(token)
        papel = ctx.get("papel")
        permissoes = set(ctx.get("permissoes") or [])
        pode_administrar = bool(ctx.get("podeAdministrar"))
        print(f"sessão injetada: papel={papel} permissoes={sorted(permissoes)}")

        # Cenário 2 — sessão real sem a permissão exigida continua bloqueada.
        checadas = 0
        for nome, ep in sorted(endpoints.items()):
            if papel == "terapeuta" or ep["permissao"] in permissoes:
                continue  # tem direito: não é o caso sob teste
            status, corpo = chamar(ep, token)
            afirmar_bloqueado(nome, status, corpo, f"sessão sem {ep['permissao']}")
            checadas += 1
        if checadas:
            print(f"sessão autenticada: {checadas} funções sem permissão bloqueadas ✔")
        else:
            print("sessão injetada é terapeuta/tem todas as permissões: cenário 2 NÃO VERIFICADO")
    else:
        print("sem sessão injetada: cenário autenticado NÃO VERIFICADO")

    asyncio.run(navegacao_bloqueada(session_json, storage_key, cookies_json, pode_administrar))
    print("\nOK: painel do terapeuta bloqueia no servidor sem permissão.")


if __name__ == "__main__":
    main()
