"""E2E: fluxo completo do player, com foco visível e navegação por teclado.

Percorre, num navegador real e com a sessão do cliente já autenticada, as
quatro situações do player, sempre operando apenas pelo teclado:

  Fase 1 — Mídia liberada
    1. O selo mostra "Mídia liberada" e descreve a situação (aria-label).
    2. Os controles ("Voltar 15 segundos", "Reproduzir", "Avançar 15 segundos")
       são alcançados por Tab, ficam com foco visível (:focus-visible + anel) e
       respondem a Enter/Espaço — o play começa pelo teclado.
    3. A barra de progresso expõe o tempo em aria-valuenow/aria-valuetext.

  Fase 2 — Acesso expirado
    4. Quando o link seguro vence, a mídia sai do ar: nenhum controle de
       reprodução continua acessível por teclado.
    5. O selo vira "Acesso expirado" e o aviso "O link seguro expirou" aparece.
    6. O foco vai para o botão "Renovar acesso", com foco visível, e o Tab
       circula dentro do aviso (role="alertdialog").

  Fase 3 — Renovação pelo teclado
    7. Enter no botão renova: o selo volta a "Mídia liberada", os controles
       voltam a existir e a reprodução retoma perto de onde parou.

  Fase 4 — Prática fora do ar (liberação recolhida)
    8. O selo vira "Acesso revogado", o aviso explica o bloqueio, o foco vai
       para "Tentar novamente" e não sobra CTA de conclusão na tela.

A expiração é simulada encurtando `urlExpiraEm` na resposta que chega ao
navegador; a revogação, respondendo sem o conteúdo (é o que o backend devolve
quando a RLS deixa de permitir a leitura). O restante — timers, pausa, aviso,
renovação, retomada — é o comportamento real do app.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

Uso: python3 e2e/player_fluxo_completo_e2e.py
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

# validade do primeiro link: dá tempo de operar o player pelo teclado
VALIDADE_CURTA_S = 25
# validade generosa após renovar, para a fase 3 não vencer no meio
VALIDADE_LONGA_S = 900

CONTROLES = ["Voltar 15 segundos", "Reproduzir", "Avançar 15 segundos"]

# null no formato serializado do TanStack Start
NULO = {"t": 2, "s": 0}


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


def wav_de_silencio(segundos: int = 600, taxa: int = 4000) -> str:
    """Mídia longa em silêncio, usada quando o acervo ainda não tem arquivo."""
    quadros = segundos * taxa
    dados = b"\x80" * quadros
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def achar_midia_liberada(api: Api, uid: str) -> tuple[dict, bool] | None:
    """Prática de áudio/vídeo liberada; o bool diz se a mídia é real ou simulada."""
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


def texto_seroval(valor: str) -> dict:
    """Nó de string no formato que o TanStack Start usa para serializar respostas."""
    return {"t": 1, "s": valor}


async def interceptar(page, segundos: int, url_simulada: str | None, remover: bool = False) -> None:
    """Reescreve a resposta do backend que chega ao navegador.

    Com `remover=True`, devolve a resposta sem o conteúdo (mesma forma do backend
    quando a liberação sai do ar). Caso contrário, apenas encurta a validade do
    link para o vencimento acontecer durante o teste.
    """

    async def entregar(route, resposta, corpo):
        try:
            await route.fulfill(response=resposta, body=corpo)
        except Exception:
            # a rota pode ter sido trocada no meio do caminho (unroute) — ignorável
            pass

    async def handler(route):
        try:
            resposta = await route.fetch()
            corpo = await resposta.text()
        except Exception:
            await route.continue_()
            return
        if "urlExpiraEm" not in corpo:
            await entregar(route, resposta, corpo)
            return
        prazo = (
            (datetime.now(timezone.utc) + timedelta(seconds=segundos))
            .isoformat()
            .replace("+00:00", "Z")
        )
        try:
            dados = json.loads(corpo)
        except json.JSONDecodeError:
            await entregar(route, resposta, corpo)
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
        await entregar(route, resposta, json.dumps(dados))

    await page.route("**/_serverFn/**", handler)


async def foco_atual(page) -> dict:
    """Descreve o elemento focado: nome acessível, se está no aviso e se o foco aparece."""
    return await page.evaluate(
        """() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { vazio: true };
          const estilo = getComputedStyle(el);
          const anel =
            (estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth || '0') > 0) ||
            (estilo.boxShadow && estilo.boxShadow !== 'none') ||
            /focus-visible:ring/.test(el.className || '');
          return {
            vazio: false,
            tag: el.tagName.toLowerCase(),
            nome: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
            focusVisible: el.matches(':focus-visible'),
            anelVisivel: !!anel,
            noAviso: !!el.closest('[role="alertdialog"]'),
          };
        }"""
    )


async def focar_por_teclado(page, nome: str, limite: int = 40) -> dict | None:
    """Chega até o controle usando só Tab e devolve o estado do foco."""
    for _ in range(limite):
        await page.keyboard.press("Tab")
        foco = await foco_atual(page)
        if not foco.get("vazio") and nome in (foco.get("nome") or ""):
            return foco
    return None


async def selo_texto(page) -> str:
    seletor = page.locator('[aria-label^="Status da mídia"]')
    try:
        return (await seletor.first.get_attribute("aria-label")) or ""
    except Exception:
        return ""


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

        # ================= Fase 1: mídia liberada =================
        await interceptar(page, VALIDADE_CURTA_S, url_simulada)
        await page.goto(f"{BASE_URL}/app/conteudo/{conteudo['id']}", wait_until="domcontentloaded")
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
        await page.get_by_role("heading", name=conteudo["titulo"]).wait_for(timeout=30000)

        try:
            await page.get_by_role("button", name="Reproduzir").wait_for(timeout=25000)
        except Exception:
            corpo = " ".join((await page.locator("body").inner_text()).split())
            print("FALHA: player não montou. Tela:", corpo[:300])
            raise SystemExit(1)

        selo = await selo_texto(page)
        if "Mídia liberada" not in selo:
            falhas.append(f"selo inicial não era 'Mídia liberada' (veio: {selo!r})")
        if "reproduzir esta prática" not in selo:
            falhas.append(f"selo sem descrição da situação (veio: {selo!r})")
        await page.screenshot(path=str(SCREENSHOTS / "player_1_liberada.png"))

        # 2: cada controle é alcançado por Tab e mostra foco visível
        await page.evaluate("() => document.body.focus?.()")
        for nome in CONTROLES:
            await page.evaluate("() => (document.activeElement)?.blur?.()")
            foco = await focar_por_teclado(page, nome)
            if not foco:
                falhas.append(f"controle '{nome}' não foi alcançado por Tab")
                continue
            if not foco["focusVisible"]:
                falhas.append(f"controle '{nome}' não ficou em :focus-visible ao chegar por Tab")
            if not foco["anelVisivel"]:
                falhas.append(f"controle '{nome}' sem indicador de foco visível")
            print("foco por teclado:", nome, "→", foco)

        # play acionado pelo teclado (Enter), pausa com Espaço
        botao_play = page.get_by_role("button", name="Reproduzir")
        await botao_play.focus()
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(1500)
        tocando = await page.evaluate(
            "() => { const m = document.querySelector('audio,video'); return !!m && !m.paused; }"
        )
        if not tocando:
            falhas.append("Enter no botão de reproduzir não iniciou a mídia")
        else:
            rotulo_pausar = await page.get_by_role("button", name="Pausar").count()
            if rotulo_pausar == 0:
                falhas.append("botão não passou a se chamar 'Pausar' durante a reprodução")

        # 3: barra de progresso descreve o tempo
        barra = page.get_by_role("progressbar", name="Progresso da reprodução")
        valor = await barra.get_attribute("aria-valuenow")
        texto_valor = await barra.get_attribute("aria-valuetext")
        print("progresso:", valor, "|", texto_valor)
        if valor is None or texto_valor is None or " de " not in (texto_valor or ""):
            falhas.append(
                f"barra de progresso sem tempo legível (valuenow={valor!r}, valuetext={texto_valor!r})"
            )

        # ================= Fase 2: acesso expirado =================
        aviso = page.get_by_role("alertdialog")
        await page.get_by_role("heading", name="O link seguro expirou").wait_for(
            timeout=(VALIDADE_CURTA_S + 30) * 1000
        )
        await aviso.wait_for(timeout=10000)
        await page.screenshot(path=str(SCREENSHOTS / "player_2_expirada.png"))

        # 4: nenhum controle de reprodução continua acessível
        if await page.locator("audio, video").count() != 0:
            falhas.append("a mídia continuou montada no player após a expiração")
        for nome in CONTROLES + ["Pausar"]:
            if await page.get_by_role("button", name=nome).count() != 0:
                falhas.append(f"controle '{nome}' continuou acessível com o acesso expirado")

        # 5: selo e aviso
        selo = await selo_texto(page)
        if "Acesso expirado" not in selo:
            falhas.append(f"selo não virou 'Acesso expirado' (veio: {selo!r})")

        # 6: foco no botão do aviso, com foco visível, e Tab preso no aviso
        foco = await foco_atual(page)
        print("foco após expirar:", foco)
        if not foco.get("noAviso"):
            falhas.append(f"o foco não foi movido para o aviso ao expirar (foco: {foco})")
        elif "Renovar acesso" not in (foco.get("nome") or ""):
            falhas.append(f"o foco não caiu em 'Renovar acesso' (foco: {foco})")
        if not foco.get("anelVisivel"):
            falhas.append("botão do aviso sem indicador de foco visível")
        for _ in range(6):
            await page.keyboard.press("Tab")
            f = await foco_atual(page)
            if not f.get("noAviso"):
                falhas.append(f"o foco escapou do aviso ao navegar por Tab (foi para: {f})")
                break

        # ================= Fase 3: renovação pelo teclado =================
        await page.unroute("**/_serverFn/**")
        await interceptar(page, VALIDADE_LONGA_S, url_simulada)
        botao = page.get_by_role("button", name="Renovar acesso")
        for _ in range(40):
            if await botao.is_enabled() and await botao.get_attribute("aria-disabled") != "true":
                break
            await page.wait_for_timeout(500)
        await botao.focus()
        foco_botao = await foco_atual(page)
        if not foco_botao.get("focusVisible"):
            print("aviso: botão de renovar sem :focus-visible ao focar por script (esperado)")
        await page.keyboard.press("Enter")

        try:
            await page.get_by_role("button", name="Reproduzir").wait_for(timeout=30000)
        except Exception:
            corpo = " ".join((await page.locator("body").inner_text()).split())
            falhas.append(f"o player não voltou após renovar pelo teclado; tela: {corpo[:300]}")
        else:
            selo = await selo_texto(page)
            if "Mídia liberada" not in selo:
                falhas.append(f"selo não voltou para 'Mídia liberada' após renovar (veio: {selo!r})")
            if await page.get_by_role("alertdialog").count() != 0:
                falhas.append("o aviso de bloqueio continuou na tela depois de renovar")
            posicao = await page.evaluate(
                "() => { const m = document.querySelector('audio,video'); return m ? m.currentTime : -1; }"
            )
            print("posição após renovar:", posicao)
            if posicao < 0:
                falhas.append("a mídia não voltou a ser montada após renovar")
        await page.screenshot(path=str(SCREENSHOTS / "player_3_renovada.png"))

        # ================= Fase 4: liberação recolhida =================
        await page.unroute("**/_serverFn/**")
        await interceptar(page, VALIDADE_LONGA_S, url_simulada, remover=True)
        await page.reload(wait_until="domcontentloaded")

        await page.get_by_role("heading", name="Prática não está mais liberada").wait_for(
            timeout=40000
        )
        await page.get_by_role("alertdialog").wait_for(timeout=10000)
        await page.screenshot(path=str(SCREENSHOTS / "player_4_revogada.png"))

        selo = await selo_texto(page)
        if selo and "Acesso revogado" not in selo:
            falhas.append(f"selo não virou 'Acesso revogado' (veio: {selo!r})")
        if await page.locator("audio, video").count() != 0:
            falhas.append("a mídia continuou montada com a liberação recolhida")
        if await page.get_by_role("button", name="Marcar como concluída").count() != 0:
            falhas.append("CTA de conclusão continuou disponível com a liberação recolhida")

        foco_b = await foco_atual(page)
        print("foco após recolher a liberação:", foco_b)
        if not foco_b.get("noAviso"):
            falhas.append(f"o foco não foi movido para o aviso da revogação (foco: {foco_b})")
        elif "Tentar novamente" not in (foco_b.get("nome") or ""):
            falhas.append(f"o foco não caiu em 'Tentar novamente' (foco: {foco_b})")

        if "/auth" in page.url:
            falhas.append("o app pediu login durante o fluxo do player")

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nOK: fluxo completo do player (selos, bloqueio, expiração, renovação) por teclado.")


asyncio.run(main())
