"""E2E: expiração do acesso e renovação, fim a fim (terapeuta libera → cliente retoma).

Fluxo real no navegador, com a liberação sendo mexida de verdade no backend:

  Fase 1 — Terapeuta libera
    1. Antes da liberação, a biblioteca do cliente mostra o eixo bloqueado.
    2. O terapeuta libera e a prática aparece sozinha (tempo real), sem recarregar.
    3. O player abre com selo "Mídia liberada" e a prática toca (avança o tempo).

  Fase 2 — Acesso expira
    4. Quando o link seguro vence, a mídia sai do ar e os controles desaparecem.
    5. O selo vira "Acesso expirado", o aviso explica e o CTA "Renovar acesso"
       recebe o foco dentro do role="alertdialog".

  Fase 3 — Cliente renova e retoma
    6. Clicar em "Renovar acesso" traz um link novo: o selo volta a "Mídia
       liberada", os controles voltam e a reprodução retoma de onde parou.

  Fase 4 — Terapeuta recolhe e renova a liberação
    7. Revogado: aviso "não está mais liberada", CTA de conclusão fora da tela.
    8. O terapeuta libera de novo (renovação) e o player volta a ficar
       disponível via "Tentar novamente", retomando a posição salva.

A liberação/revogação é feita de verdade via REST como o próprio terapeuta (RLS
aplicada). Só a validade do link assinado é encurtada na resposta que chega ao
navegador, para o vencimento acontecer durante o teste.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações (terapeuta/admin), porque o
teste libera para ela mesma como cliente.

Uso: python3 e2e/expiracao_renovacao_e2e.py
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

VALIDADE_CURTA_S = 12
VALIDADE_LONGA_S = 900

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


def wav_de_silencio(segundos: int = 600, taxa: int = 4000) -> str:
    """Mídia longa em silêncio, usada quando o acervo ainda não tem arquivo."""
    quadros = segundos * taxa
    dados = b"\x80" * quadros
    cabecalho = b"RIFF" + struct.pack("<I", 36 + len(dados)) + b"WAVE"
    cabecalho += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, taxa, taxa, 1, 8)
    cabecalho += b"data" + struct.pack("<I", len(dados))
    return "data:audio/wav;base64," + base64.b64encode(cabecalho + dados).decode()


def texto_seroval(valor: str) -> dict:
    return {"t": 1, "s": valor}


async def interceptar(page, estado: dict) -> None:
    """Encurta a validade do link assinado que chega ao navegador.

    `estado` é lido a cada resposta: {"segundos": int, "url": str | None}, então
    o teste muda a validade no meio do caminho sem trocar a rota.
    """

    async def handler(route):
        try:
            resposta = await route.fetch()
            corpo = await resposta.text()
        except Exception:
            await route.continue_()
            return
        if "urlExpiraEm" not in corpo:
            try:
                await route.fulfill(response=resposta, body=corpo)
            except Exception:
                pass
            return
        prazo = (
            (datetime.now(timezone.utc) + timedelta(seconds=estado["segundos"]))
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
                    atual = valores[i_url]
                    tem_url = isinstance(atual, dict) and atual.get("t") == 1
                    if estado.get("url") and not tem_url:
                        valores[i_url] = texto_seroval(estado["url"])
                        tem_url = True
                    if tem_url:
                        valores[i_prazo] = texto_seroval(prazo)
                for v in no.values():
                    ajustar(v)
            elif isinstance(no, list):
                for v in no:
                    ajustar(v)

        ajustar(dados)
        try:
            await route.fulfill(response=resposta, body=json.dumps(dados))
        except Exception:
            pass

    await page.route("**/_serverFn/**", handler)


async def selo_texto(page) -> str:
    seletor = page.locator('[aria-label^="Status da mídia"]')
    try:
        return (await seletor.first.get_attribute("aria-label")) or ""
    except Exception:
        return ""


async def tempo_atual(page) -> float:
    return await page.evaluate(
        """() => {
          const el = document.querySelector('audio, video');
          return el ? el.currentTime : -1;
        }"""
    )


async def foco_atual(page) -> dict:
    return await page.evaluate(
        """() => {
          const el = document.activeElement;
          if (!el || el === document.body) return { vazio: true };
          return {
            vazio: false,
            nome: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
            noAviso: !!el.closest('[role="alertdialog"]'),
          };
        }"""
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
    liberadas = api.get(
        "liberacoes",
        {"select": "eixo_id", "cliente_id": f"eq.{uid}", "status": "eq.liberado"},
    )
    eixos_liberados = {l["eixo_id"] for l in liberadas}

    alvo = next(
        (
            (e, c)
            for e in eixos
            if e["id"] not in eixos_liberados
            for c in conteudos
            if c["eixo_id"] == e["id"] and c["tipo"] in ("audio", "video")
        ),
        None,
    )
    if not alvo:
        print("SKIP: nenhum eixo bloqueado com prática de áudio/vídeo para testar.")
        return
    eixo, conteudo = alvo
    midia_real = bool(conteudo.get("storage_path"))
    estado = {
        "segundos": VALIDADE_CURTA_S,
        "url": None if midia_real else wav_de_silencio(),
    }
    print(
        "eixo:", eixo["nome"], "| prática:", conteudo["titulo"],
        f"(mídia {'enviada' if midia_real else 'simulada no navegador'})",
    )

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

    def limpar() -> None:
        api.delete(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"},
        )

    limpar()
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
        await interceptar(page, estado)

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
        )

        # ============ Fase 1: terapeuta libera ============
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        cartao = page.locator("div").filter(has_text=eixo["nome"]).last
        await cartao.wait_for(timeout=25000)
        if "será liberado" not in (await cartao.inner_text()):
            falhas.append("eixo deveria aparecer bloqueado antes da liberação")
        await page.screenshot(path=str(SCREENSHOTS / "renov_1_bloqueado.png"))

        liberar()
        link_eixo = page.get_by_role("link").filter(has_text=eixo["nome"]).first
        await link_eixo.wait_for(timeout=25000)
        print("OK: liberação do terapeuta apareceu sozinha na biblioteca")

        await page.goto(
            f"{BASE_URL}/app/conteudo/{conteudo['id']}", wait_until="domcontentloaded"
        )
        try:
            await page.get_by_role("button", name="Reproduzir").wait_for(timeout=30000)
        except Exception:
            corpo = " ".join((await page.locator("body").inner_text()).split())
            print("FALHA: player não montou. Tela:", corpo[:300])
            limpar()
            raise SystemExit(1)

        selo = await selo_texto(page)
        if "Mídia liberada" not in selo:
            falhas.append(f"selo inicial não era 'Mídia liberada' (veio: {selo!r})")

        await page.get_by_role("button", name="Reproduzir").click()
        await page.wait_for_timeout(3000)
        pos_antes = await tempo_atual(page)
        if pos_antes < 1:
            falhas.append(f"a prática não avançou o tempo ao reproduzir (t={pos_antes})")
        await page.screenshot(path=str(SCREENSHOTS / "renov_2_tocando.png"))
        print(f"OK: prática reproduzindo (t={pos_antes:.1f}s)")

        # ============ Fase 2: acesso expira ============
        await page.get_by_role("alertdialog").wait_for(timeout=30000)
        aviso = page.get_by_role("alertdialog")
        texto_aviso = await aviso.inner_text()
        if "expirou" not in texto_aviso:
            falhas.append(f"aviso de expiração sem a explicação certa: {texto_aviso[:120]!r}")
        selo = await selo_texto(page)
        if "Acesso expirado" not in selo:
            falhas.append(f"selo não virou 'Acesso expirado' (veio: {selo!r})")
        if await page.get_by_role("button", name="Reproduzir").count():
            falhas.append("controles de reprodução continuaram acessíveis após expirar")
        cta = page.get_by_role("button", name="Renovar acesso")
        if not await cta.count():
            falhas.append("CTA 'Renovar acesso' não apareceu ao expirar")
        foco = await foco_atual(page)
        if not foco.get("noAviso"):
            falhas.append(f"foco não foi para o aviso ao expirar (foco: {foco})")
        await page.screenshot(path=str(SCREENSHOTS / "renov_3_expirado.png"))
        print("OK: expiração pausou a mídia e mostrou o CTA de renovação")

        # ============ Fase 3: cliente renova e retoma ============
        estado["segundos"] = VALIDADE_LONGA_S
        await cta.first.click()
        await page.get_by_role("button", name="Reproduzir").wait_for(timeout=30000)
        selo = await selo_texto(page)
        if "Mídia liberada" not in selo:
            falhas.append(f"selo não voltou a 'Mídia liberada' após renovar (veio: {selo!r})")
        await page.wait_for_timeout(1500)
        pos_depois = await tempo_atual(page)
        if pos_depois + 5 < pos_antes:
            falhas.append(
                f"a prática não retomou de onde parou (antes {pos_antes:.1f}s, depois {pos_depois:.1f}s)"
            )
        await page.screenshot(path=str(SCREENSHOTS / "renov_4_renovado.png"))
        print(f"OK: acesso renovado e prática retomada (t={pos_depois:.1f}s)")

        # ============ Fase 4: terapeuta recolhe e renova a liberação ============
        revogar()
        await page.get_by_text("não está mais liberada", exact=False).first.wait_for(timeout=30000)
        selo = await selo_texto(page)
        if "Acesso revogado" not in selo:
            falhas.append(f"selo não virou 'Acesso revogado' (veio: {selo!r})")
        if await page.get_by_role("button", name="Marcar como concluída").count():
            falhas.append("CTA de conclusão continuou visível com o acesso revogado")
        foco = await foco_atual(page)
        if not foco.get("noAviso"):
            falhas.append(f"foco não foi para o aviso ao revogar (foco: {foco})")
        await page.screenshot(path=str(SCREENSHOTS / "renov_5_revogado.png"))
        print("OK: revogação bloqueou o player e recolheu o CTA de conclusão")

        liberar()
        tentar = page.get_by_role("button", name="Tentar novamente")
        if await tentar.count():
            await tentar.first.click()
        await page.get_by_role("button", name="Reproduzir").wait_for(timeout=30000)
        selo = await selo_texto(page)
        if "Mídia liberada" not in selo:
            falhas.append(f"selo não voltou após a renovação do terapeuta (veio: {selo!r})")
        await page.wait_for_timeout(1500)
        pos_final = await tempo_atual(page)
        if pos_final + 5 < pos_antes:
            falhas.append(
                f"a retomada após a renovação perdeu a posição (esperado ≥ {pos_antes:.1f}s, veio {pos_final:.1f}s)"
            )
        await page.screenshot(path=str(SCREENSHOTS / "renov_6_reliberado.png"))
        print(f"OK: renovação do terapeuta devolveu o acesso e a posição (t={pos_final:.1f}s)")

        limpar()
        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E de expiração e renovação concluído sem falhas.")


asyncio.run(main())
