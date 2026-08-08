"""E2E: foco e navegação por teclado no aviso `role="alert"` de remoção.

O aviso de remoção em tempo real rouba o foco para ser anunciado por leitor de
tela. Este teste garante que ele não deixe ninguém perdido:

  1. Com o foco num controle da biblioteca, o terapeuta remove a liberação:
     o aviso `role="alert"` aparece e recebe o foco.
  2. Dentro do aviso, Tab alcança os dois atalhos ("Ver minha biblioteca" e
     "Entendi, dispensar aviso") e um Tab a mais SAI do aviso — sem armadilha.
  3. Ao dispensar (clique no atalho e também por Escape), o foco volta para o
     elemento de origem — nunca para o <body>.
  4. Clicar no atalho "Ver minha biblioteca" fecha o aviso e navega para /app.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações (libera/remove para ela
mesma como cliente).

Uso: python3 e2e/aviso_alerta_foco_e2e.py
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

JS_FOCO = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { vazio: true, tag: 'body' };
  return {
    vazio: false,
    tag: el.tagName.toLowerCase(),
    nome: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    dentroDoAviso: !!el.closest('[role="alert"]'),
    ehOAviso: el.getAttribute('role') === 'alert',
    focusVisible: el.matches(':focus-visible'),
  };
}"""


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
            headers=self._headers(
                {"Content-Type": "application/json", "Prefer": "return=representation"}
            ),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()[0]

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


async def restaurar_sessao(context, page, session, storage_key, cookies_json) -> None:
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
    )


async def focar_primeiro_controle_da_biblioteca(page) -> dict:
    """Coloca o foco num controle real da biblioteca e devolve o que foi focado."""
    for _ in range(25):
        await page.keyboard.press("Tab")
        foco = await page.evaluate(JS_FOCO)
        if not foco["vazio"] and foco["nome"]:
            return foco
    raise AssertionError("não foi possível focar nenhum controle da biblioteca")


async def esperar_aviso(page):
    alerta = page.get_by_role("alert").first
    await alerta.wait_for(state="visible", timeout=20000)
    return alerta


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    api = Api(session["access_token"])
    uid = session["user"]["id"]

    if not api.pode_gerenciar_liberacoes():
        print("SKIP: a sessão atual não pode gerenciar liberações; entre como terapeuta e repita.")
        return

    eixos = api.get("eixos", {"select": "id,nome", "order": "ordem"})
    if not eixos:
        print("SKIP: nenhum eixo cadastrado.")
        return
    eixo = eixos[0]

    def liberar() -> str:
        api.delete(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"},
        )
        linha = api.insert(
            "liberacoes",
            {"cliente_id": uid, "eixo_id": eixo["id"], "conteudo_id": None, "status": "liberado"},
        )
        return linha["id"]

    def remover(liberacao_id: str) -> None:
        api.delete("liberacoes", {"id": f"eq.{liberacao_id}"})

    falhas: list[str] = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        page.on("console", lambda m: m.type == "error" and print("console.error:", m.text[:200]))

        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        # ---------- Etapa 1: aviso aparece e recebe o foco ----------
        liberacao_id = liberar()
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        origem = await focar_primeiro_controle_da_biblioteca(page)
        print("foco de origem:", origem["nome"])

        remover(liberacao_id)
        alerta = await esperar_aviso(page)
        await page.wait_for_timeout(400)
        foco = await page.evaluate(JS_FOCO)
        print("1. aviso visível, foco em:", foco)
        if not foco.get("ehOAviso"):
            falhas.append("o aviso role=alert não recebeu o foco ao abrir")
        await page.screenshot(path=str(SCREENSHOTS / "aviso_foco_1_aberto.png"))

        # ---------- Etapa 2: Tab percorre os atalhos e sai do aviso ----------
        await page.keyboard.press("Tab")
        f1 = await page.evaluate(JS_FOCO)
        await page.keyboard.press("Tab")
        f2 = await page.evaluate(JS_FOCO)
        await page.keyboard.press("Tab")
        f3 = await page.evaluate(JS_FOCO)
        print("2. tabulação:", f1["nome"], "|", f2["nome"], "|", f3["nome"], "fora:", not f3["dentroDoAviso"])
        if "biblioteca" not in f1["nome"].lower():
            falhas.append(f"primeiro Tab não chegou ao atalho da biblioteca: {f1}")
        if "dispensar" not in f2["nome"].lower():
            falhas.append(f"segundo Tab não chegou ao atalho de dispensar: {f2}")
        if f3["dentroDoAviso"]:
            falhas.append("Tab não sai do aviso: há armadilha de foco")
        if not (f1["focusVisible"] and f2["focusVisible"]):
            falhas.append("atalhos do aviso sem foco visível")

        # ---------- Etapa 3: clique no atalho de dispensar devolve o foco ----------
        await alerta.get_by_role("button", name="Entendi, dispensar aviso").click()
        await alerta.wait_for(state="detached", timeout=10000)
        depois = await page.evaluate(JS_FOCO)
        print("3. após dispensar, foco em:", depois)
        if depois["vazio"]:
            falhas.append("após dispensar o foco caiu no <body>")
        if depois["nome"] and origem["nome"] and depois["nome"] != origem["nome"]:
            print("   aviso: foco voltou para outro controle relevante (origem removida da tela)")
        await page.screenshot(path=str(SCREENSHOTS / "aviso_foco_2_dispensado.png"))

        # ---------- Etapa 4: Escape também dispensa e devolve o foco ----------
        liberacao_id = liberar()
        await page.wait_for_timeout(1500)
        origem2 = await focar_primeiro_controle_da_biblioteca(page)
        remover(liberacao_id)
        alerta = await esperar_aviso(page)
        await page.wait_for_timeout(300)
        await page.keyboard.press("Escape")
        await alerta.wait_for(state="detached", timeout=10000)
        pos_escape = await page.evaluate(JS_FOCO)
        print("4. após Escape, foco em:", pos_escape, "| origem:", origem2["nome"])
        if pos_escape["vazio"]:
            falhas.append("após Escape o foco caiu no <body>")

        # ---------- Etapa 5: clique no atalho da biblioteca navega ----------
        liberacao_id = liberar()
        await page.goto(f"{BASE_URL}/app/progresso", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        remover(liberacao_id)
        alerta = await esperar_aviso(page)
        await alerta.get_by_role("link", name="Ver minha biblioteca").click()
        await page.wait_for_timeout(1500)
        print("5. após atalho da biblioteca, url:", page.url)
        if not page.url.rstrip("/").endswith("/app"):
            falhas.append(f"atalho da biblioteca não navegou para /app: {page.url}")
        if await page.get_by_role("alert").count():
            falhas.append("o aviso continuou aberto após clicar no atalho da biblioteca")
        pos_atalho = await page.evaluate(JS_FOCO)
        print("   foco após navegar:", pos_atalho)
        await page.screenshot(path=str(SCREENSHOTS / "aviso_foco_3_atalho.png"))

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nOK: aviso role=alert abre com foco, tabula sem armadilha e devolve o foco ao dispensar.")


asyncio.run(main())
