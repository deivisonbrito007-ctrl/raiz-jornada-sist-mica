"""E2E: sessão expirando durante a reprodução.

Fluxo real verificado no navegador:
  1. Com a sessão válida, o player abre e a mídia toca.
  2. A sessão é invalidada (token vencido no armazenamento + cookies limpos),
     como acontece quando o login caduca com o app aberto.
  3. Ao voltar para a página do player, a mídia é interrompida: nenhum
     <audio>/<video> montado e nenhum controle de prática acessível
     (Reproduzir, Marcar como concluída, Renovar acesso).
  4. O app pede autenticação de novo (tela/rota de login).
  5. Depois de autenticar novamente (sessão restaurada), o player volta
     a abrir normalmente.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

Uso: python3 e2e/sessao_expirada_player_e2e.py
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

CONTROLES_BLOQUEADOS = ["Reproduzir", "Pausar", "Marcar como concluída", "Renovar acesso"]


def env_from_dotenv(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{name} não encontrado")


def get(tabela: str, params: dict, token: str) -> list:
    url = env_from_dotenv("VITE_SUPABASE_URL")
    key = env_from_dotenv("VITE_SUPABASE_PUBLISHABLE_KEY")
    r = requests.get(
        f"{url}/rest/v1/{tabela}",
        params=params,
        headers={"apikey": key, "Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def wav_de_silencio(segundos: int = 300, taxa: int = 4000) -> str:
    import base64
    import struct

    dados = b"\x80" * (segundos * taxa)
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def achar_midia_liberada(token: str, uid: str) -> tuple[dict, bool] | None:
    conteudos = get("conteudos", {"select": "id,titulo,tipo,storage_path", "order": "ordem"}, token)
    concluidos = {
        r["conteudo_id"]
        for r in get(
            "progresso",
            {"select": "conteudo_id,status", "cliente_id": f"eq.{uid}", "status": "eq.concluido"},
            token,
        )
    }
    midias = [c for c in conteudos if c["tipo"] in ("audio", "video") and c["id"] not in concluidos]
    for c in midias:
        if c.get("storage_path"):
            return c, True
    return (midias[0], False) if midias else None


async def preencher_url_simulada(page, url_simulada: str) -> None:
    """Completa a URL da mídia na resposta do servidor quando o acervo não tem arquivo."""

    async def handler(route):
        try:
            resposta = await route.fetch()
            corpo = await resposta.text()
        except Exception:
            await route.continue_()
            return
        if "urlExpiraEm" not in corpo:
            await route.fulfill(response=resposta, body=corpo)
            return
        try:
            dados = json.loads(corpo)
        except json.JSONDecodeError:
            await route.fulfill(response=resposta, body=corpo)
            return

        def ajustar(no):
            if isinstance(no, dict):
                pares = no.get("p")
                if isinstance(pares, dict) and "urlExpiraEm" in (pares.get("k") or []):
                    chaves, valores = pares["k"], pares["v"]
                    i_url = chaves.index("url")
                    atual = valores[i_url]
                    if not (isinstance(atual, dict) and atual.get("t") == 1):
                        valores[i_url] = {"t": 1, "s": url_simulada}
                for v in no.values():
                    ajustar(v)
            elif isinstance(no, list):
                for v in no:
                    ajustar(v)

        ajustar(dados)
        await route.fulfill(response=resposta, body=json.dumps(dados))

    await page.route("**/_serverFn/**", handler)


async def controles_visiveis(page) -> list[str]:
    presentes = []
    for nome in CONTROLES_BLOQUEADOS:
        if await page.get_by_role("button", name=nome).count() > 0:
            presentes.append(nome)
    return presentes


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    uid = session["user"]["id"]
    achado = achar_midia_liberada(session["access_token"], uid)
    if not achado:
        print("SKIP: nenhuma prática de áudio/vídeo liberada para esta sessão.")
        return
    conteudo, midia_real = achado
    url_simulada = None if midia_real else wav_de_silencio()
    print("prática de teste:", conteudo["titulo"], conteudo["tipo"])

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True, args=["--autoplay-policy=no-user-gesture-required"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, timezone_id="America/Sao_Paulo"
        )
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = BASE_URL
            await context.add_cookies(cookies)
        page = await context.new_page()

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
        )
        if url_simulada:
            await preencher_url_simulada(page, url_simulada)

        rota_player = f"{BASE_URL}/app/conteudo/{conteudo['id']}"

        # 1: sessão válida, player abre e a mídia toca
        await page.goto(rota_player, wait_until="domcontentloaded")
        assert "/auth" not in page.url, f"redirecionado para login com sessão válida: {page.url}"
        await page.get_by_role("heading", name=conteudo["titulo"]).wait_for(timeout=30000)
        play = page.get_by_role("button", name="Reproduzir")
        try:
            await play.wait_for(timeout=20000)
        except Exception:
            corpo = " ".join((await page.locator("body").inner_text()).split())
            print("FALHA: player não apareceu; tela:", corpo[:300])
            raise SystemExit(1)
        await play.click()
        await page.wait_for_timeout(1500)
        tocou = await page.evaluate(
            "!!document.querySelector('audio,video') && !document.querySelector('audio,video').paused"
        )
        print("estava tocando antes da sessão cair:", tocou)
        await page.screenshot(path=str(SCREENSHOTS / "sessao_1_tocando.png"))

        # 2: a sessão caduca com o app aberto
        sessao_vencida = dict(session)
        sessao_vencida["expires_at"] = 1
        sessao_vencida["expires_in"] = -1
        sessao_vencida["access_token"] = "sessao.expirada.e2e"
        sessao_vencida["refresh_token"] = "refresh-invalido-e2e"
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(sessao_vencida))})"
        )
        await context.clear_cookies()

        # 3 + 4: voltar para o player interrompe a mídia e pede novo login
        await page.goto(BASE_URL + "/auth", wait_until="domcontentloaded")
        await page.goto(rota_player, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)
        print("url após voltar sem sessão:", page.url)
        await page.screenshot(path=str(SCREENSHOTS / "sessao_2_bloqueado.png"))

        if await page.locator("audio, video").count() != 0:
            falhas.append("a mídia continuou montada no player sem sessão válida")
        presentes = await controles_visiveis(page)
        if presentes:
            falhas.append(f"controles acessíveis sem sessão: {', '.join(presentes)}")

        texto = " ".join((await page.locator("body").inner_text()).split())
        pede_login = "/auth" in page.url or "Entrar" in texto or "Criar conta" in texto
        if not pede_login:
            falhas.append(f"o app não pediu autenticação novamente; tela: {texto[:300]}")

        # a mídia segue bloqueada mesmo insistindo no deep link
        await page.goto(rota_player, wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        if await page.locator("audio, video").count() != 0:
            falhas.append("deep link voltou a montar a mídia sem sessão válida")
        presentes = await controles_visiveis(page)
        if presentes:
            falhas.append(f"controles acessíveis no deep link sem sessão: {', '.join(presentes)}")

        # 5: autenticando de novo, o player volta
        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = BASE_URL
            await context.add_cookies(cookies)
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
        )
        await page.goto(rota_player, wait_until="domcontentloaded")
        try:
            await page.get_by_role("heading", name=conteudo["titulo"]).wait_for(timeout=30000)
            await page.get_by_role("button", name="Reproduzir").wait_for(timeout=20000)
        except Exception:
            falhas.append("o player não voltou após autenticar novamente")
        await page.screenshot(path=str(SCREENSHOTS / "sessao_3_reautenticado.png"))

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nOK: sessão expirada interrompe a mídia e mantém os controles bloqueados até novo login.")


asyncio.run(main())
