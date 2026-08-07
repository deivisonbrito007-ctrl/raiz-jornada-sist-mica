"""E2E: expiração da URL assinada no navegador real.

O que é verificado num fluxo real, sem recarregar a página:
  1. O player abre com o selo "Mídia liberada" e a mídia toca.
  2. Quando a validade do link assinado acaba, a reprodução é pausada sozinha.
  3. A UI mostra o selo "Acesso expirado" e o aviso "O link seguro expirou"
     com o botão "Renovar acesso".
  4. Nada de progresso é registrado enquanto o acesso está expirado: o botão
     "Marcar como concluída" avisa o bloqueio e o banco não muda.
  5. Ao renovar, o player volta e retoma do ponto onde a pessoa parou.

A expiração é simulada encurtando, na resposta que chega ao navegador, o campo
`urlExpiraEm` do backend — o link segue válido, mas o app o trata como vencido,
que é exatamente o caminho que queremos exercitar na interface.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

Uso: python3 e2e/expiracao_url_e2e.py
"""

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

# validade forçada do primeiro link: tempo suficiente para dar play e ver a UI
VALIDADE_CURTA_S = 6


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


# WAV de 30s em silêncio, usado só quando o acervo ainda não tem mídia enviada
def wav_de_silencio(segundos: int = 30, taxa: int = 8000) -> str:
    import base64
    import struct

    quadros = segundos * taxa
    dados = b"\x80" * quadros
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def achar_midia_liberada(api: Api, uid: str) -> tuple[dict, bool] | None:
    """Prática de áudio/vídeo liberada; o bool diz se a mídia é real ou simulada.

    A leitura passa pela RLS, então só vêm práticas realmente liberadas para a
    sessão. Sem nenhum arquivo enviado ainda, o teste segue com uma mídia
    simulada no navegador — o fluxo de expiração exercitado é o mesmo.
    """
    conteudos = api.get(
        "conteudos",
        {"select": "id,titulo,tipo,eixo_id,storage_path", "order": "ordem"},
    )
    midias = [c for c in conteudos if c["tipo"] in ("audio", "video")]
    for c in midias:
        if c.get("storage_path"):
            return c, True
    return (midias[0], False) if midias else None


def progresso_atual(api: Api, uid: str, conteudo_id: str) -> dict | None:
    linhas = api.get(
        "progresso",
        {
            "select": "status,posicao_segundos",
            "cliente_id": f"eq.{uid}",
            "conteudo_id": f"eq.{conteudo_id}",
        },
    )
    return linhas[0] if linhas else None


async def encurtar_validade(page, segundos: int, url_simulada: str | None = None) -> None:
    """Reescreve `urlExpiraEm` nas respostas do backend para vencer logo.

    Com `url_simulada`, também preenche a URL da mídia quando o acervo ainda não
    tem arquivo enviado, mantendo o resto do fluxo real.
    """

    async def handler(route):
        try:
            resposta = await route.fetch()
            corpo = await resposta.text()
        except Exception:
            await route.continue_()
            return
        if "urlExpiraEm" not in corpo and "posicaoSegundos" not in corpo:
            await route.fulfill(response=resposta, body=corpo)
            return
        novo_prazo = (datetime.now(timezone.utc) + timedelta(seconds=segundos)).isoformat()
        try:
            dados = json.loads(corpo)
        except json.JSONDecodeError:
            await route.fulfill(response=resposta, body=corpo)
            return

        def ajustar(no):
            if isinstance(no, dict):
                if "urlExpiraEm" in no:
                    if url_simulada and not no.get("url"):
                        no["url"] = url_simulada
                    if no.get("url"):
                        no["urlExpiraEm"] = novo_prazo.replace("+00:00", "Z")
                for v in no.values():
                    ajustar(v)
            elif isinstance(no, list):
                for v in no:
                    ajustar(v)

        ajustar(dados)
        await route.fulfill(response=resposta, body=json.dumps(dados))

    await page.route("**/*", handler)


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    api = Api(session["access_token"])
    uid = session["user"]["id"]

    achado = achar_midia_liberada(api, uid)
    if not achado:
        print("SKIP: nenhuma prática de áudio/vídeo liberada para esta sessão.")
        return
    conteudo, midia_real = achado
    url_simulada = None if midia_real else wav_de_silencio()
    print(
        "prática de teste:",
        conteudo["titulo"],
        f"({conteudo['tipo']}, mídia {'enviada' if midia_real else 'simulada no navegador'})",
    )

    antes = progresso_atual(api, uid, conteudo["id"])
    print("progresso antes:", antes)
    if antes and antes["status"] == "concluido":
        print("SKIP: prática já concluída; o bloqueio de progresso não seria observável.")
        return

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
        erros: list[str] = []
        page.on("console", lambda m: erros.append(m.text) if m.type == "error" else None)

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
        )

        await encurtar_validade(page, VALIDADE_CURTA_S, url_simulada)
        await page.goto(
            f"{BASE_URL}/app/conteudo/{conteudo['id']}", wait_until="domcontentloaded"
        )
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
        await page.get_by_role("heading", name=conteudo["titulo"]).wait_for(timeout=30000)

        selo = page.get_by_role("status")
        try:
            await selo.get_by_text("Mídia liberada").wait_for(timeout=15000)
        except Exception:
            falhas.append(
                f"selo inicial não era 'Mídia liberada' (veio: {await selo.inner_text()})"
            )
        await page.screenshot(path=str(SCREENSHOTS / "exp_1_liberada.png"))

        # registra as pausas feitas pelo app, para provar que a mídia parou sozinha
        await page.evaluate(
            """
            window.__pausas = 0;
            const orig = HTMLMediaElement.prototype.pause;
            HTMLMediaElement.prototype.pause = function () {
              window.__pausas += 1;
              window.__ultimaPosicao = this.currentTime;
              return orig.call(this);
            };
            """
        )

        # dá play e deixa avançar um pouco antes do link vencer
        await page.get_by_role("button", name="Reproduzir").click()
        await page.wait_for_timeout(1500)
        tocou = await page.evaluate(
            "!!document.querySelector('audio,video') && !document.querySelector('audio,video').paused"
        )
        print("estava tocando antes de vencer:", tocou)

        # 2 + 3: o link vence, a mídia para e a UI explica o bloqueio
        aviso = page.get_by_role("heading", name="O link seguro expirou")
        await aviso.wait_for(timeout=(VALIDADE_CURTA_S + 20) * 1000)
        await page.screenshot(path=str(SCREENSHOTS / "exp_2_expirada.png"))

        if await page.locator("audio, video").count() != 0:
            falhas.append("a mídia continuou montada no player após a expiração")
        pausas = await page.evaluate("window.__pausas || 0")
        if tocou and not pausas:
            falhas.append("a reprodução não foi pausada quando o link venceu")
        posicao_guardada = await page.evaluate("window.__ultimaPosicao || 0")
        print("pausas registradas:", pausas, "| posição no momento da pausa:", posicao_guardada)

        try:
            await selo.get_by_text("Acesso expirado").wait_for(timeout=10000)
        except Exception:
            falhas.append(f"selo não virou 'Acesso expirado' (veio: {await selo.inner_text()})")
        if await page.get_by_role("button", name="Renovar acesso").count() == 0:
            falhas.append("botão 'Renovar acesso' ausente no aviso de expiração")

        # 4: com o acesso expirado, nada de progresso é registrado
        await page.get_by_role("button", name="Marcar como concluída").click()
        try:
            await page.get_by_text(
                "Acesso à mídia expirado. Renove antes de concluir a prática."
            ).wait_for(timeout=10000)
        except Exception:
            falhas.append("sem aviso ao tentar concluir com o acesso expirado")
        await page.wait_for_timeout(1500)
        depois = progresso_atual(api, uid, conteudo["id"])
        print("progresso depois da tentativa:", depois)
        if depois and depois["status"] == "concluido":
            falhas.append("o progresso foi gravado como concluído mesmo com o acesso expirado")
        await page.screenshot(path=str(SCREENSHOTS / "exp_3_progresso_bloqueado.png"))

        # 5: renovar traz o player de volta a partir do ponto onde parou
        # a partir daqui a validade volta ao normal (mídia simulada segue presente)
        await page.unroute("**/*")
        await encurtar_validade(page, 600, url_simulada)
        botao = page.get_by_role("button", name="Renovar acesso")
        for _ in range(30):
            if await botao.is_enabled():
                break
            await page.wait_for_timeout(500)
        await botao.click()
        try:
            await page.locator("audio, video").first.wait_for(timeout=20000)
        except Exception:
            falhas.append("player não voltou depois de renovar o acesso")
        else:
            await page.wait_for_timeout(1000)
            retomou = await page.evaluate(
                "document.querySelector('audio,video')?.currentTime || 0"
            )
            print("posição após renovar:", retomou)
            if posicao_guardada > 2 and retomou < posicao_guardada - 3:
                falhas.append(
                    f"não retomou do ponto salvo ({retomou:.1f}s vs {posicao_guardada:.1f}s)"
                )
        await page.screenshot(path=str(SCREENSHOTS / "exp_4_renovada.png"))

        graves = [e for e in erros if "Failed to load resource" not in e]
        if graves:
            print("erros de console:", graves[:5])

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E OK: expiração da URL assinada pausa a mídia, avisa na tela e bloqueia progresso.")


asyncio.run(main())
