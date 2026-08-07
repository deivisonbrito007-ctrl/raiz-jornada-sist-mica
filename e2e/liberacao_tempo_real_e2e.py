"""E2E: liberação e revogação do terapeuta refletem na hora na biblioteca e no player.

O que é verificado, sem nenhum recarregar manual da página:
  1. Biblioteca do cliente mostra a prática como bloqueada antes da liberação.
  2. Ao liberar, a prática aparece desbloqueada sozinha (tempo real).
  3. Com o player aberto, revogar o acesso bloqueia a mídia e mostra o aviso.
  4. Ao liberar de novo, o player volta a ficar disponível sozinho.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações (terapeuta ou admin com a
permissão), porque o teste faz a liberação/revogação para ela mesma como cliente.

Uso: python3 e2e/liberacao_tempo_real_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def env_from_dotenv(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{name} não encontrado")


class Api:
    """Chamadas REST como o próprio usuário da sessão (RLS aplicada)."""

    def __init__(self, token: str) -> None:
        self.url = env_from_dotenv("VITE_SUPABASE_URL")
        self.key = env_from_dotenv("VITE_SUPABASE_PUBLISHABLE_KEY")
        self.token = token

    def _headers(self, extra: dict | None = None) -> dict:
        headers = {"apikey": self.key, "Authorization": f"Bearer {self.token}"}
        headers.update(extra or {})
        return headers

    def get(self, tabela: str, params: dict) -> list:
        r = requests.get(
            f"{self.url}/rest/v1/{tabela}", params=params, headers=self._headers(), timeout=30
        )
        r.raise_for_status()
        return r.json()

    def insert(self, tabela: str, row: dict) -> dict:
        r = requests.post(
            f"{self.url}/rest/v1/{tabela}",
            json=row,
            headers=self._headers({"Content-Type": "application/json", "Prefer": "return=representation"}),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()[0]

    def patch(self, tabela: str, params: dict, row: dict) -> None:
        r = requests.patch(
            f"{self.url}/rest/v1/{tabela}",
            params=params,
            json=row,
            headers=self._headers({"Content-Type": "application/json"}),
            timeout=30,
        )
        r.raise_for_status()

    def delete(self, tabela: str, params: dict) -> None:
        r = requests.delete(
            f"{self.url}/rest/v1/{tabela}", params=params, headers=self._headers(), timeout=30
        )
        r.raise_for_status()

    def pode_gerenciar_liberacoes(self) -> bool:
        r = requests.post(
            f"{self.url}/rest/v1/rpc/pode",
            json={"_permissao": "gerenciar_liberacoes"},
            headers=self._headers({"Content-Type": "application/json"}),
            timeout=30,
        )
        return r.status_code == 200 and r.json() is True


async def restaurar_sessao(context, page, session: dict, storage_key: str, cookies_json) -> None:
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
    )


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    api = Api(session["access_token"])
    uid = session["user"]["id"]

    if not api.pode_gerenciar_liberacoes():
        print("SKIP: a sessão atual não pode gerenciar liberações; entre como terapeuta e repita.")
        return

    # escolhe um eixo bloqueado que tenha conteúdo — o cliente vê o eixo, não o título
    eixos = api.get("eixos", {"select": "id,nome", "order": "ordem"})
    conteudos = api.get("conteudos", {"select": "id,titulo,eixo_id,tipo", "order": "ordem"})
    liberadas = api.get("liberacoes", {"select": "eixo_id,conteudo_id", "cliente_id": f"eq.{uid}"})
    eixos_liberados = {l["eixo_id"] for l in liberadas}

    alvo = next(
        (
            (e, c)
            for e in eixos
            if e["id"] not in eixos_liberados
            for c in conteudos
            if c["eixo_id"] == e["id"]
        ),
        None,
    )
    if not alvo:
        print("SKIP: nenhum eixo bloqueado com conteúdo para testar.")
        return
    eixo, conteudo = alvo
    print("eixo de teste:", eixo["nome"], "| prática:", conteudo["titulo"])

    def liberar_eixo() -> None:
        existente = api.get(
            "liberacoes",
            {"select": "id", "cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"},
        )
        if existente:
            api.patch("liberacoes", {"id": f"eq.{existente[0]['id']}"}, {"status": "liberado"})
        else:
            api.insert(
                "liberacoes",
                {"cliente_id": uid, "eixo_id": eixo["id"], "conteudo_id": None, "status": "liberado"},
            )

    def revogar_eixo() -> None:
        """Mesma operação do painel: a linha fica com status bloqueado."""
        api.patch(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}"},
            {"status": "bloqueado", "liberar_em": None},
        )

    api.delete("liberacoes", {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"})

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        erros: list[str] = []
        page.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)

        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        # 1) biblioteca antes da liberação: eixo aparece bloqueado
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        cartao = page.locator("div").filter(has_text=eixo["nome"]).last
        await cartao.wait_for(timeout=20000)
        await page.screenshot(path=str(SCREENSHOTS / "lib_1_antes.png"))
        assert "será liberado" in (await cartao.inner_text()), "eixo deveria estar bloqueado"

        # 2) terapeuta libera — a biblioteca reage sozinha
        liberar_eixo()
        link_eixo = page.get_by_role("link").filter(has_text=eixo["nome"]).first
        await link_eixo.wait_for(timeout=20000)
        await page.screenshot(path=str(SCREENSHOTS / "lib_2_liberado.png"))
        print("OK: biblioteca liberou o eixo sem recarregar")

        # 3) abre a trilha e o player, e o terapeuta revoga
        await link_eixo.click()
        link_pratica = page.get_by_role("link").filter(has_text=conteudo["titulo"]).first
        await link_pratica.wait_for(timeout=20000)
        await link_pratica.click()
        await page.get_by_text(conteudo["titulo"], exact=False).first.wait_for(timeout=20000)
        await page.screenshot(path=str(SCREENSHOTS / "player_1_liberado.png"))

        revogar_eixo()
        await page.get_by_text("não está mais liberada", exact=False).first.wait_for(timeout=20000)
        await page.screenshot(path=str(SCREENSHOTS / "player_2_revogado.png"))
        print("OK: player bloqueou na hora após a revogação")

        # 4) libera de novo — player volta sozinho
        liberar_eixo()
        await page.get_by_text("liberada de novo", exact=False).first.wait_for(timeout=20000)
        await page.screenshot(path=str(SCREENSHOTS / "player_3_reliberado.png"))
        print("OK: player voltou a liberar sem recarregar")

        api.delete(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"},
        )

        graves = [e for e in erros if "Warning" not in e]
        assert not graves, f"erros de console durante o fluxo: {graves[:3]}"
        await browser.close()

    print("E2E de liberação/revogação em tempo real concluído.")


asyncio.run(main())
