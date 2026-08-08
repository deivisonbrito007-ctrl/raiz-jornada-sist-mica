"""E2E: live region anuncia conclusão de prática e mudança de meta/sequência, sem repetir.

Fluxo verificado (cliente autenticado, navegação real entre telas):
  1. /app/progresso  -> live region anuncia meta semanal + concluídas + sequência
  2. Aumentar meta   -> live region anuncia o novo número
  3. sai e volta para /app/progresso sem mudanças -> live region fica VAZIA (dedup)
  4. abre uma prática liberada e marca como concluída -> anúncio da conclusão
  5. volta ao player pela navegação -> não repete o anúncio da conclusão
  6. /app/progresso  -> anuncia os números atualizados (concluídas/sequência)

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso: python3 e2e/live_region_progresso_e2e.py
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

LIVE = "[data-testid='anuncio-live']"


def env_from_dotenv(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{name} não encontrado")


def liberar_uma_pratica_para_concluir(session: dict) -> str | None:
    """Reabre uma prática já concluída para o fluxo poder concluí-la de novo.

    A alteração é feita como o próprio cliente (RLS aplicada) e o próprio teste
    recoloca a prática em "concluído" ao clicar em Marcar como concluída.
    """
    url = env_from_dotenv("VITE_SUPABASE_URL")
    key = env_from_dotenv("VITE_SUPABASE_PUBLISHABLE_KEY")
    cabecalhos = {
        "apikey": key,
        "Authorization": f"Bearer {session['access_token']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.get(
        f"{url}/rest/v1/progresso",
        params={"select": "id,conteudo_id,status", "status": "eq.concluido", "limit": "1"},
        headers=cabecalhos,
        timeout=30,
    )
    resp.raise_for_status()
    linhas = resp.json()
    if not linhas:
        return None
    patch = requests.patch(
        f"{url}/rest/v1/progresso",
        params={"id": f"eq.{linhas[0]['id']}"},
        headers=cabecalhos,
        json={"status": "em_andamento", "concluido_em": None},
        timeout=30,
    )
    patch.raise_for_status()
    return linhas[0]["conteudo_id"]


async def texto_live(page) -> str:
    """Texto atual da live region da tela (primeira, que é a de progresso)."""
    regiao = page.locator(LIVE).first
    if await regiao.count() == 0:
        return ""
    return " ".join((await regiao.inner_text()).split())


async def esperar_live(page, padrao: re.Pattern, tentativas: int = 60) -> str:
    for _ in range(tentativas):
        texto = await texto_live(page)
        if padrao.search(texto):
            return texto
        await page.wait_for_timeout(250)
    return await texto_live(page)


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    conteudo_reaberto = liberar_uma_pratica_para_concluir(session)
    print("prática reaberta para concluir no fluxo:", conteudo_reaberto)

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
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
        # garante a preferência padrão (anúncios completos)
        await page.evaluate("window.localStorage.removeItem('raiz:preferencia-anuncios')")

        # ---------- 1. anúncio inicial de meta/sequência ----------
        await page.goto(f"{BASE_URL}/app/progresso", wait_until="domcontentloaded")
        await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=30000)
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"

        padrao_meta = re.compile(r"Meta semanal de (\d+) prática", re.I)
        inicial = await esperar_live(page, padrao_meta)
        print("1) live region inicial:", repr(inicial))
        if not padrao_meta.search(inicial):
            falhas.append(f"anúncio inicial de meta ausente: {inicial!r}")
        if not re.search(r"Sequência atual de \d+ dia", inicial):
            falhas.append(f"anúncio inicial sem sequência: {inicial!r}")
        if not re.search(r"\d+ conclu", inicial):
            falhas.append(f"anúncio inicial sem concluídas da semana: {inicial!r}")
        await page.screenshot(path=str(SCREENSHOTS / "live_1_progresso.png"))

        meta_antes = int(padrao_meta.search(inicial).group(1)) if padrao_meta.search(inicial) else 0

        # papel do live region: precisa ser status/polite e invisível na tela
        atributos = await page.locator(LIVE).first.evaluate(
            "el => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live'),"
            " atomic: el.getAttribute('aria-atomic'), classe: el.className })"
        )
        print("   atributos:", atributos)
        if atributos["role"] != "status" or atributos["live"] != "polite":
            falhas.append(f"live region com semântica errada: {atributos}")
        if "sr-only" not in (atributos["classe"] or ""):
            falhas.append("live region deveria ser sr-only")

        # ---------- 2. alterar a meta anuncia o novo número ----------
        aumentar = page.get_by_role("button", name="Aumentar meta")
        await aumentar.wait_for(timeout=15000)
        if await aumentar.is_disabled():
            aumentar = page.get_by_role("button", name="Diminuir meta")
        await aumentar.click()
        esperado = re.compile(rf"Meta semanal de (?!{meta_antes} )\d+ prática", re.I)
        depois = await esperar_live(page, esperado)
        print("2) live region após alterar a meta:", repr(depois))
        if not esperado.search(depois):
            falhas.append(f"mudança de meta não foi anunciada (antes {meta_antes}): {depois!r}")
        meta_nova_m = padrao_meta.search(depois)
        meta_nova = int(meta_nova_m.group(1)) if meta_nova_m else meta_antes
        await page.screenshot(path=str(SCREENSHOTS / "live_2_meta.png"))

        # ---------- 3. navegar e voltar não repete o mesmo anúncio ----------
        # navegação client-side (sem recarregar), como a pessoa faz pelas abas
        await page.get_by_role("link", name="Início").first.click()
        await page.wait_for_url(re.compile(r"/app$"), timeout=20000)
        await page.wait_for_timeout(800)
        await page.get_by_role("link", name="Progresso").first.click()
        await page.wait_for_url(re.compile(r"/app/progresso"), timeout=20000)
        await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=30000)
        await page.wait_for_timeout(2500)
        revisita = await texto_live(page)
        print("3) live region ao voltar (esperado vazio):", repr(revisita))
        if revisita:
            falhas.append(f"anúncio repetido ao voltar para progresso: {revisita!r}")

        # ---------- 4. concluir uma prática anuncia a conclusão ----------
        await page.get_by_role("link", name="Início").first.click()
        await page.wait_for_url(re.compile(r"/app$"), timeout=20000)
        await page.wait_for_timeout(1500)
        alvo = None
        if conteudo_reaberto:
            especifico = page.locator(f"a[href*='/app/conteudo/{conteudo_reaberto}']")
            if await especifico.count() > 0:
                alvo = especifico.first
        if alvo is None:
            praticas = page.locator("a[href*='/app/conteudo/']")
            if await praticas.count() > 0:
                alvo = praticas.first

        if alvo is None:
            print("4) nenhuma prática acessível na biblioteca: fase de conclusão não exercida")
        else:
            await alvo.click()
            await page.wait_for_url(re.compile(r"/app/(conteudo|eixo)/"), timeout=20000)
            if "/app/eixo/" in page.url:
                item = page.locator("a[href*='/app/conteudo/']").first
                if await item.count() > 0:
                    await item.click()
                    await page.wait_for_url(re.compile(r"/app/conteudo/"), timeout=20000)

            botao = page.get_by_role("button", name=re.compile("Marcar como concluída", re.I))
            if await botao.count() == 0:
                print("4) prática já concluída ou bloqueada: conclusão não exercida em", page.url)
            else:
                url_player = page.url
                await botao.first.click()
                anuncio = await esperar_live(page, re.compile("Prática concluída:", re.I))
                print("4) live region após concluir:", repr(anuncio))
                if "Prática concluída:" not in anuncio:
                    falhas.append(f"conclusão não anunciada na live region: {anuncio!r}")
                await page.screenshot(path=str(SCREENSHOTS / "live_4_concluida.png"))

                # ---------- 5. voltar ao player não repete a conclusão ----------
                await page.get_by_role("link", name="Início").first.click()
                await page.wait_for_url(re.compile(r"/app$"), timeout=20000)
                await page.wait_for_timeout(800)
                await page.locator(f"a[href*='{url_player.split('/app')[-1].split('?')[0]}']").first.click()
                await page.wait_for_url(re.compile(r"/app/conteudo/"), timeout=20000)
                await page.wait_for_timeout(2500)
                repetido = await texto_live(page)
                print("5) live region ao reabrir o player (esperado vazio):", repr(repetido))
                if "Prática concluída:" in repetido:
                    falhas.append(f"anúncio de conclusão repetido ao reabrir o player: {repetido!r}")

                # ---------- 6. progresso anuncia os números atualizados ----------
                await page.get_by_role("link", name="Progresso").first.click()
                await page.wait_for_url(re.compile(r"/app/progresso"), timeout=20000)
                await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=30000)
                atualizado = await esperar_live(page, padrao_meta)
                print("6) live region no progresso após concluir:", repr(atualizado))
                if not padrao_meta.search(atualizado):
                    falhas.append(f"progresso não anunciou os números atualizados: {atualizado!r}")
                elif atualizado == inicial:
                    falhas.append("progresso repetiu o anúncio antigo em vez do atualizado")
                await page.screenshot(path=str(SCREENSHOTS / "live_6_progresso.png"))

        # ---------- 7. preferência desativada silencia a live region ----------
        await page.evaluate(
            "window.localStorage.setItem('raiz:preferencia-anuncios', 'desativado')"
        )
        await page.goto(f"{BASE_URL}/app/progresso", wait_until="domcontentloaded")
        await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=30000)
        aumentar = page.get_by_role("button", name="Aumentar meta")
        if await aumentar.is_disabled():
            aumentar = page.get_by_role("button", name="Diminuir meta")
        await aumentar.click()
        await page.wait_for_timeout(2000)
        silencio = await page.locator(LIVE).count()
        print("7) live regions com anúncios desativados:", silencio)
        if silencio != 0:
            falhas.append("preferência 'desativado' não removeu a live region de rotina")

        # restaura a meta original para não deixar o dado alterado
        await page.evaluate("window.localStorage.removeItem('raiz:preferencia-anuncios')")
        if meta_nova > meta_antes:
            await page.get_by_role("button", name="Diminuir meta").click()
        elif meta_nova < meta_antes:
            await page.get_by_role("button", name="Aumentar meta").click()
        await page.wait_for_timeout(1500)

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E OK: live region anuncia conclusão e meta/sequência, sem repetir após navegar.")


asyncio.run(main())
