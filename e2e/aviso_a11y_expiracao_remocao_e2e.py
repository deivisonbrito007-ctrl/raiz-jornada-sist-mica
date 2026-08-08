"""E2E: leitor de tela e foco quando a prática expira ou sai do ar.

Em fluxo real de navegador, com a sessão do cliente já autenticada, checa que:

  Cenário A — o link seguro expira durante a reprodução
    1. A região assertiva (role="alert", aria-live="assertive") recebe
       "O link seguro desta prática expirou. A reprodução foi interrompida."
    2. O foco vai para dentro do aviso (role="alertdialog"), no botão
       "Renovar acesso" — antes de qualquer reautenticação.
    3. A região de estado (role="status") descreve "Acesso expirado".
    4. Tab circula dentro do aviso (o foco não escapa para a página atrás).

  Cenário B — a prática deixa de estar disponível (liberação removida)
    5. A mesma região assertiva anuncia que o acesso foi recolhido agora.
    6. O foco é movido para o aviso e o botão "Tentar novamente" está focado.

A expiração é simulada encurtando `urlExpiraEm` na resposta que chega ao
navegador; a remoção, respondendo sem o conteúdo (é o que o backend devolve
quando a RLS deixa de permitir a leitura). Nos dois casos o caminho exercitado
na interface é o real.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

Uso: python3 e2e/aviso_a11y_expiracao_remocao_e2e.py
"""

import asyncio
import base64
import json
import os
import struct
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

VALIDADE_CURTA_S = 20

ANUNCIO_EXPIROU = "O link seguro desta prática expirou. A reprodução foi interrompida."
ANUNCIO_RECOLHIDO = "O terapeuta recolheu o acesso agora. A reprodução foi interrompida."


def env_from_dotenv(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{name} não encontrado")


class Api:
    """Leituras REST como o próprio usuário da sessão (RLS aplicada)."""

    def __init__(self, token: str) -> None:
        self.url = env_from_dotenv("VITE_SUPABASE_URL")
        self.key = env_from_dotenv("VITE_SUPABASE_PUBLISHABLE_KEY")
        self.token = token

    def get(self, tabela: str, params: dict) -> list:
        r = requests.get(
            f"{self.url}/rest/v1/{tabela}",
            params=params,
            headers={"apikey": self.key, "Authorization": f"Bearer {self.token}"},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()


def wav_de_silencio(segundos: int = 300, taxa: int = 4000) -> str:
    """Mídia longa em silêncio, usada quando o acervo ainda não tem arquivo."""
    quadros = segundos * taxa
    dados = b"\x80" * quadros
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def achar_midia_liberada(api: Api, uid: str) -> tuple[dict, bool] | None:
    conteudos = api.get("conteudos", {"select": "id,titulo,tipo,storage_path", "order": "ordem"})
    concluidos = {
        r["conteudo_id"]
        for r in api.get(
            "progresso",
            {"select": "conteudo_id,status", "cliente_id": f"eq.{uid}", "status": "eq.concluido"},
        )
    }
    midias = [c for c in conteudos if c["tipo"] in ("audio", "video") and c["id"] not in concluidos]
    for c in midias:
        if c.get("storage_path"):
            return c, True
    return (midias[0], False) if midias else None


# null no formato serializado do TanStack Start
NULO = {"t": 2, "s": 0}


def texto_seroval(valor: str) -> dict:
    """Nó de string no formato que o TanStack Start usa para serializar respostas."""
    return {"t": 1, "s": valor}


async def interceptar(page, segundos: int, url_simulada: str | None, remover: bool = False) -> None:
    """Reescreve a resposta do backend que chega ao navegador.

    Com `remover=True`, devolve a resposta sem o conteúdo (mesma forma do
    backend quando a liberação sai do ar). Caso contrário, apenas encurta a
    validade do link para o vencimento acontecer durante o teste.
    """

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
        prazo = (
            (datetime.now(timezone.utc) + timedelta(seconds=segundos))
            .isoformat()
            .replace("+00:00", "Z")
        )
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
                    i_prazo = chaves.index("urlExpiraEm")
                    if remover:
                        if "conteudo" in chaves:
                            valores[chaves.index("conteudo")] = NULO
                        valores[i_url] = NULO
                        valores[i_prazo] = NULO
                    else:
                        atual = valores[i_url]
                        tem_url = isinstance(atual, dict) and atual.get("t") == 1
                        if url_simulada and not tem_url:
                            valores[i_url] = texto_seroval(url_simulada)
                            tem_url = True
                        if tem_url:
                            valores[i_prazo] = texto_seroval(prazo)
                for v in no.values():
                    ajustar(v)
            elif isinstance(no, list):
                for v in no:
                    ajustar(v)

        ajustar(dados)
        await route.fulfill(response=resposta, body=json.dumps(dados))

    await page.route("**/_serverFn/**", handler)


async def texto_assertivo(page) -> str:
    return " ".join(
        (
            await page.evaluate(
                """() => Array.from(document.querySelectorAll('[aria-live="assertive"]'))
                       .map(el => el.textContent || '').join(' ')"""
            )
        ).split()
    )


async def foco_atual(page) -> dict:
    return await page.evaluate(
        """() => {
          const el = document.activeElement;
          if (!el) return { dentro: false, nome: null, tag: null };
          const caixa = el.closest('[role="alertdialog"]');
          return {
            dentro: !!caixa,
            tag: el.tagName.toLowerCase(),
            nome: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
          };
        }"""
    )


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
    print("prática de teste:", conteudo["titulo"], f"({conteudo['tipo']})")

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True, args=["--autoplay-policy=no-user-gesture-required"]
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, timezone_id="America/Sao_Paulo"
        )
        if cookies_json:
            for c in json.loads(cookies_json):
                c["url"] = BASE_URL
                await context.add_cookies([c])
        page = await context.new_page()

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
        )

        # ---------- Cenário A: expiração do link seguro ----------
        await interceptar(page, VALIDADE_CURTA_S, url_simulada)
        await page.goto(f"{BASE_URL}/app/conteudo/{conteudo['id']}", wait_until="domcontentloaded")
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
        await page.get_by_role("heading", name=conteudo["titulo"]).wait_for(timeout=30000)

        play = page.get_by_role("button", name="Reproduzir")
        try:
            await play.wait_for(timeout=20000)
            await play.click()
            await page.wait_for_timeout(1200)
        except Exception:
            corpo = " ".join((await page.locator("body").inner_text()).split())
            print("aviso: não foi possível dar play; segue o teste do aviso. Tela:", corpo[:200])

        aviso = page.get_by_role("alertdialog")
        await page.get_by_role("heading", name="O link seguro expirou").wait_for(
            timeout=(VALIDADE_CURTA_S + 25) * 1000
        )
        await aviso.wait_for(timeout=10000)
        await page.screenshot(path=str(SCREENSHOTS / "a11y_1_expirou.png"))

        # 1: anúncio assertivo do que acabou de acontecer
        assertivo = await texto_assertivo(page)
        if ANUNCIO_EXPIROU not in assertivo:
            falhas.append(f"live region assertiva sem o anúncio de expiração (veio: {assertivo!r})")

        # 2: foco dentro do aviso, no botão de renovar — antes de reautenticar
        foco = await foco_atual(page)
        print("foco após expirar:", foco)
        if not foco["dentro"]:
            falhas.append(f"o foco não foi movido para o aviso após expirar (foco: {foco})")
        elif "Renovar acesso" not in foco["nome"]:
            falhas.append(f"o foco não caiu no botão 'Renovar acesso' (foco: {foco})")

        # 3: estado do player descrito para leitor de tela
        estado = " ".join((await page.get_by_role("status").all_inner_texts())).strip()
        if "Acesso expirado" not in estado:
            falhas.append(f"role=status não descreveu 'Acesso expirado' (veio: {estado!r})")

        # 4: Tab não escapa do aviso
        for _ in range(6):
            await page.keyboard.press("Tab")
            f = await foco_atual(page)
            if not f["dentro"]:
                falhas.append(f"o foco escapou do aviso ao navegar por Tab (foi para: {f})")
                break

        # ---------- Cenário B: a liberação sai do ar ----------
        await page.unroute("**/_serverFn/**")
        await interceptar(page, VALIDADE_CURTA_S, url_simulada, remover=True)
        await page.reload(wait_until="domcontentloaded")

        await page.get_by_role("heading", name="Prática não está mais liberada").wait_for(
            timeout=40000
        )
        await page.get_by_role("alertdialog").wait_for(timeout=10000)
        await page.screenshot(path=str(SCREENSHOTS / "a11y_2_removida.png"))

        # 5: anúncio assertivo da remoção do acesso
        assertivo_b = await texto_assertivo(page)
        if ANUNCIO_RECOLHIDO not in assertivo_b:
            falhas.append(
                f"live region assertiva sem o anúncio de acesso recolhido (veio: {assertivo_b!r})"
            )

        # 6: foco movido para o aviso, no botão de nova tentativa
        foco_b = await foco_atual(page)
        print("foco após remoção:", foco_b)
        if not foco_b["dentro"]:
            falhas.append(f"o foco não foi movido para o aviso após a remoção (foco: {foco_b})")
        elif "Tentar novamente" not in foco_b["nome"]:
            falhas.append(f"o foco não caiu no botão 'Tentar novamente' (foco: {foco_b})")

        # A reautenticação nunca foi necessária para chegar até aqui
        if "/auth" in page.url:
            falhas.append("o app pediu login antes de anunciar o bloqueio")

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nOK: anúncio em ARIA live e foco no alerta em expiração e remoção.")


asyncio.run(main())
