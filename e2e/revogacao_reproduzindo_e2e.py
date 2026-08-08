"""E2E: revogar/remover conteúdo enquanto o player está reproduzindo.

O que é verificado num fluxo real, sem recarregar a página:
  1. A prática abre liberada e a mídia (vídeo ou áudio) realmente toca.
  2. O terapeuta revoga (status bloqueado) → a reprodução é pausada sozinha.
  3. A mídia sai do DOM: nenhum <video>/<audio> continua montado ou tocando.
  4. Nenhum controle sobra acessível: Reproduzir/Pausar, Voltar 15, Avançar 15,
     a barra de progresso e os tempos (mm:ss) desaparecem da tela.
  5. A UI troca para o estado bloqueado: selo "Acesso revogado", aviso de que a
     prática não está mais liberada e leitura de tela "Player indisponível".
  6. Nada de progresso novo é gravado enquanto está bloqueado.
  7. O mesmo vale quando a liberação é removida (linha apagada), não só bloqueada.

Cada tipo de mídia disponível (vídeo e áudio) é exercitado separadamente.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações (terapeuta ou admin com a
permissão), porque o teste libera/revoga para ela mesma como cliente.

Uso: python3 e2e/revogacao_reproduzindo_e2e.py
"""

import asyncio
import base64
import json
import os
import re
import struct
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

TEMPO_MMSS = re.compile(r"\b\d{1,2}:\d{2}\b")


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


def midia_simulada(tipo: str, segundos: int = 600) -> str:
    """Mídia longa e silenciosa para o navegador, quando o acervo não tem arquivo.

    O caminho exercitado (play, revogação, desmontagem do player) é o mesmo com
    arquivo real; só a origem do stream muda.
    """
    taxa = 4000
    quadros = segundos * taxa
    dados = b"\x80" * quadros
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    # o elemento <video> também reproduz um stream só de áudio, o que basta aqui
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def texto_seroval(valor: str) -> dict:
    """Nó de string no formato que o TanStack Start usa para serializar respostas."""
    return {"t": 1, "s": valor}


async def preencher_url_simulada(page, url_simulada: str) -> None:
    """Preenche `url` na resposta do backend quando a prática não tem mídia enviada."""

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
                    chaves = pares["k"]
                    valores = pares["v"]
                    i_url = chaves.index("url")
                    atual = valores[i_url]
                    if not (isinstance(atual, dict) and atual.get("t") == 1):
                        valores[i_url] = texto_seroval(url_simulada)
                for v in no.values():
                    ajustar(v)
            elif isinstance(no, list):
                for v in no:
                    ajustar(v)

        ajustar(dados)
        await route.fulfill(response=resposta, body=json.dumps(dados))

    await page.route("**/_serverFn/**", handler)


def escolher_praticas(api: Api, uid: str) -> list[dict]:
    """Uma prática de vídeo e uma de áudio, cada uma num eixo que dá para liberar."""
    conteudos = api.get("conteudos", {"select": "id,titulo,tipo,eixo_id", "order": "ordem"})
    escolhidas: list[dict] = []
    eixos_usados: set[str] = set()
    for tipo in ("video", "audio"):
        alvo = next(
            (
                c
                for c in conteudos
                if c["tipo"] == tipo and c["eixo_id"] not in eixos_usados
            ),
            None,
        )
        if alvo:
            eixos_usados.add(alvo["eixo_id"])
            escolhidas.append(alvo)
    return escolhidas


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


async def espiar_pausas(page) -> None:
    await page.evaluate(
        """
        () => {
          window.__pausas = 0;
          window.__ultimaPosicao = 0;
          const orig = HTMLMediaElement.prototype.pause;
          HTMLMediaElement.prototype.pause = function () {
            window.__pausas += 1;
            window.__ultimaPosicao = this.currentTime;
            return orig.call(this);
          };
        }
        """
    )


async def dar_play(page, falhas: list[str], rotulo: str) -> bool:
    play = page.get_by_role("button", name="Reproduzir")
    try:
        await play.wait_for(timeout=25000)
    except Exception:
        corpo = " ".join((await page.locator("body").inner_text()).split())
        falhas.append(f"[{rotulo}] player não apareceu para dar play; tela: {corpo[:250]}")
        return False
    await play.click()
    await page.wait_for_timeout(1800)
    tocando = await page.evaluate(
        "!!document.querySelector('audio,video') && !document.querySelector('audio,video').paused"
    )
    if not tocando:
        falhas.append(f"[{rotulo}] a mídia não estava reproduzindo antes da revogação")
    return bool(tocando)


async def conferir_estado_bloqueado(page, falhas: list[str], rotulo: str, tocava: bool) -> None:
    """Player parado, sem mídia montada e sem nenhum controle ou tempo na tela."""
    await page.get_by_text("não está mais liberada", exact=False).first.wait_for(timeout=25000)

    if await page.locator("audio, video").count() != 0:
        falhas.append(f"[{rotulo}] a mídia continuou montada no player após a revogação")
    ainda_tocando = await page.evaluate(
        """
        Array.from(document.querySelectorAll('audio,video'))
          .some((m) => !m.paused && !m.ended)
        """
    )
    if ainda_tocando:
        falhas.append(f"[{rotulo}] a reprodução continuou depois da revogação")
    pausas = await page.evaluate("window.__pausas || 0")
    if tocava and not pausas:
        falhas.append(f"[{rotulo}] a reprodução não foi pausada ao revogar o acesso")

    for controle in ("Pausar", "Reproduzir", "Voltar 15 segundos", "Avançar 15 segundos"):
        if await page.get_by_role("button", name=controle).count() != 0:
            falhas.append(f"[{rotulo}] controle '{controle}' continuou acessível no bloqueio")
    if await page.get_by_role("progressbar", name="Progresso da reprodução").count() != 0:
        falhas.append(f"[{rotulo}] barra de progresso continuou visível no bloqueio")
    if await page.get_by_role("group", name="Controles de reprodução").count() != 0:
        falhas.append(f"[{rotulo}] grupo de controles continuou no DOM no bloqueio")

    visivel = " ".join((await page.locator("main").inner_text()).split())
    tempos = TEMPO_MMSS.findall(visivel)
    if tempos:
        falhas.append(f"[{rotulo}] tempos de progresso ainda visíveis no bloqueio: {tempos[:3]}")

    selo = page.get_by_role("status").first
    try:
        await selo.get_by_text("Acesso revogado").wait_for(timeout=10000)
    except Exception:
        falhas.append(f"[{rotulo}] selo não virou 'Acesso revogado' (veio: {await selo.inner_text()})")
    leitura = " ".join((await page.locator("main").inner_text(timeout=5000)).split())
    if "Player indisponível" not in await page.locator("main").inner_html():
        # o texto é sr-only; a leitura por innerText pode não trazê-lo
        if "Player indisponível" not in leitura:
            falhas.append(f"[{rotulo}] leitor de tela não anunciou 'Player indisponível'")


async def conferir_progresso_bloqueado(
    page, api: Api, uid: str, conteudo_id: str, falhas: list[str], rotulo: str
) -> None:
    botao = page.get_by_role("button", name="Marcar como concluída")
    if await botao.count() == 0:
        return
    await botao.click()
    await page.wait_for_timeout(1500)
    depois = progresso_atual(api, uid, conteudo_id)
    if depois and depois["status"] == "concluido":
        falhas.append(f"[{rotulo}] progresso foi gravado como concluído mesmo bloqueado")


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    api = Api(session["access_token"])
    uid = session["user"]["id"]

    if not api.pode_gerenciar_liberacoes():
        print("SKIP: a sessão atual não pode gerenciar liberações; entre como terapeuta e repita.")
        return

    praticas = escolher_praticas(api, uid)
    if not praticas:
        print("SKIP: nenhuma prática de vídeo ou áudio no acervo.")
        return
    print("práticas de teste:", [(p["tipo"], p["titulo"]) for p in praticas])

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
        await preencher_url_simulada(page, midia_simulada("audio"))

        for indice, pratica in enumerate(praticas):
            eixo_id = pratica["eixo_id"]
            rotulo = pratica["tipo"]
            # "revogar" no primeiro caso (status bloqueado) e "remover" no segundo
            remover = indice % 2 == 1

            def liberar() -> None:
                existente = api.get(
                    "liberacoes",
                    {
                        "select": "id",
                        "cliente_id": f"eq.{uid}",
                        "eixo_id": f"eq.{eixo_id}",
                        "conteudo_id": "is.null",
                    },
                )
                if existente:
                    api.patch(
                        "liberacoes",
                        {"id": f"eq.{existente[0]['id']}"},
                        {"status": "liberado", "liberar_em": None},
                    )
                else:
                    api.insert(
                        "liberacoes",
                        {
                            "cliente_id": uid,
                            "eixo_id": eixo_id,
                            "conteudo_id": None,
                            "status": "liberado",
                        },
                    )

            def limpar() -> None:
                api.delete(
                    "liberacoes",
                    {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo_id}"},
                )

            limpar()
            liberar()

            await page.goto(
                f"{BASE_URL}/app/conteudo/{pratica['id']}", wait_until="domcontentloaded"
            )
            assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
            await page.get_by_role("heading", name=pratica["titulo"]).wait_for(timeout=30000)
            await espiar_pausas(page)

            tocava = await dar_play(page, falhas, rotulo)
            await page.screenshot(path=str(SCREENSHOTS / f"rev_{rotulo}_1_tocando.png"))

            if remover:
                limpar()  # remoção da liberação
            else:
                api.patch(
                    "liberacoes",
                    {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo_id}"},
                    {"status": "bloqueado", "liberar_em": None},
                )
            print(
                f"[{rotulo}] {'liberação removida' if remover else 'acesso revogado'}"
                f" durante a reprodução (tocava: {tocava})"
            )

            await conferir_estado_bloqueado(page, falhas, rotulo, tocava)
            await page.screenshot(path=str(SCREENSHOTS / f"rev_{rotulo}_2_bloqueado.png"))
            await conferir_progresso_bloqueado(page, api, uid, pratica["id"], falhas, rotulo)

            limpar()

        graves = [
            e
            for e in erros
            if "Failed to load resource" not in e and "Warning" not in e
        ]
        if graves:
            print("erros de console:", graves[:5])

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print(
        "\nE2E OK: revogar/remover conteúdo durante a reprodução para a mídia, "
        "desmonta o player e não deixa controles nem tempos acessíveis."
    )


asyncio.run(main())
