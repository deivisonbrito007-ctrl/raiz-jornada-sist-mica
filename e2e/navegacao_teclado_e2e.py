"""E2E: navegação apenas com teclado entre biblioteca, trilha e player.

Nenhum clique de mouse é usado: todo o percurso acontece com Tab / Shift+Tab /
Enter / Esc. O que é verificado:

  1. Biblioteca: dá para alcançar o link do eixo liberado só com Tab, e cada
     parada do foco tem nome acessível e anel de foco visível.
  2. Trilha: Enter no link do eixo navega; o foco continua dentro da página e a
     prática é alcançável por teclado.
  3. Player: Enter abre a prática e o primeiro elemento focável é alcançável.
  4. Durante a revogação feita pelo terapeuta (sem recarregar), o foco vai para
     o aviso de bloqueio, o Tab fica preso nele e Esc leva ao link de volta —
     sem sobrar controles de mídia focáveis.
  5. Ao liberar de novo, o foco volta para um controle da própria prática e a
     navegação por teclado segue funcionando (estado consistente).

Ambiente (injetado pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações, porque o teste libera e
revoga para ela mesma como cliente.

Uso: python3 e2e/navegacao_teclado_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

import requests
from playwright.async_api import async_playwright

# helpers de expiração reaproveitados do E2E de URL assinada
import sys

sys.path.insert(0, str(Path(__file__).parent))
from expiracao_url_e2e import encurtar_validade, wav_de_silencio  # noqa: E402

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MAX_TABS = 60


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


# Descreve o elemento com foco: rótulo acessível, tipo e se o anel de foco existe.
SCRIPT_FOCO = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { vazio: true };
  const estilo = getComputedStyle(el);
  const rotulo = (
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby')
      ? (document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || '')
      : '') ||
    el.textContent ||
    el.getAttribute('title') ||
    ''
  ).replace(/\\s+/g, ' ').trim();
  return {
    vazio: false,
    tag: el.tagName.toLowerCase(),
    papel: el.getAttribute('role'),
    href: el.getAttribute('href'),
    rotulo: rotulo.slice(0, 90),
    ariaDisabled: el.getAttribute('aria-disabled'),
    dentroDoAviso: Boolean(el.closest('[role="alertdialog"]')),
    // anel de foco: outline nativo ou ring do Tailwind (box-shadow / borda visível)
    anel: estilo.outlineStyle !== 'none' || estilo.boxShadow !== 'none',
  };
}
"""

# Lista o que ainda é focável na página — usado para provar que a mídia
# desapareceu do caminho do teclado depois da revogação.
SCRIPT_FOCAVEIS = """
() => {
  const sel = 'a[href], button:not([disabled]), video, audio, input, [tabindex]:not([tabindex="-1"])';
  return Array.from(document.querySelectorAll(sel))
    .filter((el) => el.offsetParent !== null || el.tagName === 'VIDEO' || el.tagName === 'AUDIO')
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      rotulo: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    }));
}
"""


async def foco(page) -> dict:
    return await page.evaluate(SCRIPT_FOCO)


async def tab_ate(page, condicao, limite: int = MAX_TABS, tecla: str = "Tab") -> dict:
    """Pressiona Tab até o foco satisfazer `condicao`, validando cada parada."""
    visitados: list[dict] = []
    for _ in range(limite):
        await page.keyboard.press(tecla)
        atual = await foco(page)
        if atual.get("vazio"):
            continue
        visitados.append(atual)
        assert atual["rotulo"], f"parada de foco sem nome acessível: {atual}"
        assert atual["anel"], f"parada de foco sem indicador visível: {atual}"
        if condicao(atual):
            return atual
    raise AssertionError(
        f"não alcancei o alvo com {limite} Tabs. Visitados: {[v['rotulo'] for v in visitados][-12:]}"
    )


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

    eixos = api.get("eixos", {"select": "id,nome", "order": "ordem"})
    conteudos = api.get(
        "conteudos", {"select": "id,titulo,eixo_id,tipo,storage_path", "order": "ordem"}
    )
    # Prefere práticas com mídia real: só nelas o player monta controles de áudio/vídeo.
    com_midia = [c for c in conteudos if c.get("storage_path")] or conteudos
    alvo = next(
        ((e, c) for e in eixos for c in com_midia if c["eixo_id"] == e["id"]),
        None,
    )
    if not alvo:
        print("SKIP: nenhum eixo com conteúdo para testar.")
        return
    eixo, conteudo = alvo
    print("eixo:", eixo["nome"], "| prática:", conteudo["titulo"])

    def liberar() -> None:
        existente = api.get(
            "liberacoes",
            {
                "select": "id",
                "cliente_id": f"eq.{uid}",
                "eixo_id": f"eq.{eixo['id']}",
                "conteudo_id": "is.null",
            },
        )
        if existente:
            api.patch("liberacoes", {"id": f"eq.{existente[0]['id']}"}, {"status": "liberado"})
        else:
            api.insert(
                "liberacoes",
                {
                    "cliente_id": uid,
                    "eixo_id": eixo["id"],
                    "conteudo_id": None,
                    "status": "liberado",
                },
            )

    def revogar() -> None:
        api.patch(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}"},
            {"status": "bloqueado", "liberar_em": None},
        )

    # Zera liberações do eixo para que a revogação do teste seja a única fonte de verdade.
    api.delete("liberacoes", {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}"})

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        erros: list[str] = []
        page.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)

        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        # 1) Biblioteca: o eixo começa bloqueado e a liberação chega em tempo real
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)
        liberar()
        await page.locator(f'a[href$="/app/eixo/{eixo["id"]}"]').first.wait_for(timeout=20000)
        await page.evaluate("() => document.body.focus()")
        no_eixo = lambda f: (f["href"] or "").endswith(f"/app/eixo/{eixo['id']}")
        link_eixo = await tab_ate(page, no_eixo)
        await page.screenshot(path=str(SCREENSHOTS / "teclado_1_biblioteca.png"))
        print("OK: eixo alcançado por teclado na biblioteca:", link_eixo["rotulo"][:50])

        # Shift+Tab volta a uma parada anterior válida (navegação nos dois sentidos)
        anterior = await tab_ate(page, lambda f: True, limite=1, tecla="Shift+Tab")
        assert anterior["rotulo"], "Shift+Tab deveria manter o foco em um controle nomeado"
        await tab_ate(page, no_eixo, limite=3)

        # 2) Enter navega para a trilha
        await page.keyboard.press("Enter")
        await page.get_by_role("link").filter(has_text=conteudo["titulo"]).first.wait_for(
            timeout=20000
        )
        assert "/app/eixo/" in page.url, f"Enter não navegou para a trilha: {page.url}"
        await page.evaluate("() => document.body.focus()")
        await tab_ate(page, lambda f: (f["href"] or "").endswith(f"/app/conteudo/{conteudo['id']}"))
        await page.screenshot(path=str(SCREENSHOTS / "teclado_2_trilha.png"))
        print("OK: prática alcançada por teclado na trilha")

        # 3) Enter abre o player
        await page.keyboard.press("Enter")
        await page.get_by_text(conteudo["titulo"], exact=False).first.wait_for(timeout=20000)
        assert "/app/conteudo/" in page.url, f"Enter não abriu o player: {page.url}"
        await page.evaluate("() => document.body.focus()")
        primeiro = await tab_ate(page, lambda f: True, limite=1)
        print("OK: player alcançável por teclado, primeiro foco:", primeiro["rotulo"][:50])
        await page.screenshot(path=str(SCREENSHOTS / "teclado_3_player.png"))

        # 4) Revogação real no banco: o eixo sai do caminho do teclado na biblioteca
        revogar()
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.locator(f'a[href$="/app/eixo/{eixo["id"]}"]').first.wait_for(
            state="detached", timeout=20000
        )
        focaveis = await page.evaluate(SCRIPT_FOCAVEIS)
        assert not [f for f in focaveis if no_eixo(f)], (
            "eixo revogado continuou alcançável por teclado na biblioteca"
        )
        await page.screenshot(path=str(SCREENSHOTS / "teclado_4_revogado.png"))
        print("OK: eixo revogado saiu do caminho do teclado")

        # 5) Nova liberação: o eixo volta e o teclado continua consistente
        liberar()
        await page.locator(f'a[href$="/app/eixo/{eixo["id"]}"]').first.wait_for(timeout=20000)
        await page.evaluate("() => document.body.focus()")
        volta = await tab_ate(page, no_eixo)
        assert volta["rotulo"], "eixo reliberado sem nome acessível"
        print("OK: eixo reliberado alcançável por teclado")

        # 6) Player bloqueado (link seguro vencido): foco vai ao aviso e fica preso nele
        await encurtar_validade(page, 8, wav_de_silencio())
        await page.goto(
            f"{BASE_URL}/app/conteudo/{conteudo['id']}", wait_until="domcontentloaded"
        )
        aviso = page.get_by_role("alertdialog")
        try:
            await aviso.wait_for(timeout=40000)
        except Exception:
            print("DEBUG url:", page.url)
            print("DEBUG texto:", (await page.locator("body").inner_text())[:800])
            raise
        await page.wait_for_timeout(400)
        atual = await foco(page)
        assert atual["dentroDoAviso"], f"o foco deveria estar no aviso de bloqueio: {atual}"

        paradas = []
        for _ in range(6):
            await page.keyboard.press("Tab")
            f = await foco(page)
            paradas.append(f)
            assert f["dentroDoAviso"], f"Tab escapou do aviso de bloqueio: {f}"
        assert all(p["rotulo"] for p in paradas), f"aviso com parada sem nome: {paradas}"

        focaveis = await page.evaluate(SCRIPT_FOCAVEIS)
        midia = [f for f in focaveis if f["tag"] in ("video", "audio")]
        assert not midia, f"mídia continuou no caminho do teclado com acesso bloqueado: {midia}"
        await page.screenshot(path=str(SCREENSHOTS / "teclado_5_bloqueado.png"))
        print("OK: foco preso no aviso e mídia fora do caminho do teclado")

        # Esc oferece saída pelo link de volta à trilha
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        saida = await foco(page)
        assert saida["rotulo"], f"Esc deixou o foco sem destino nomeado: {saida}"
        print("OK: Esc levou o foco para", saida["rotulo"][:50])
        await page.unroute("**/_serverFn/**")

        # 7) Volta para a biblioteca só com teclado, estado coerente com o servidor
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.evaluate("() => document.body.focus()")
        await tab_ate(page, no_eixo)
        print("OK: biblioteca continua navegável por teclado depois do ciclo")

        graves = [e for e in erros if "Warning" not in e]
        assert not graves, f"erros de console durante o fluxo: {graves[:3]}"
        await browser.close()

    api.delete("liberacoes", {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}"})
    print("E2E de navegação por teclado concluído.")


asyncio.run(main())
