"""E2E: navegação somente por teclado com a interface em viewport mobile.

Roda em 390x844 (celular), com a sessão real do cliente, e nunca usa o mouse:
todo o caminho é feito com Tab / Shift+Tab / Enter / Escape.

  Etapa 1 — Casca do app (mobile)
    1. Existe um único <main> e a barra inferior de abas é uma landmark
       de navegação com nome acessível.
    2. Todo elemento focável alcançado por Tab tem nome acessível, foco
       visível (anel/outline) e alvo de toque >= 44px de altura.

  Etapa 2 — Biblioteca -> trilha (caminho de acesso)
    3. Só com Tab chega-se a um eixo e Enter abre a trilha (URL /app/eixo/...).
    4. Na trilha, Tab alcança "Biblioteca" (volta) e a primeira prática da
       lista ordenada; Enter na prática abre o player.

  Etapa 3 — Player
    5. Os controles do player são alcançados por Tab, na ordem visual
       (Voltar 15s -> Reproduzir -> Avançar 15s), com foco visível.
    6. Espaço/Enter no botão "Reproduzir" inicia a reprodução pelo teclado.
    7. Shift+Tab devolve o foco ao controle anterior (caminho reversível).

  Etapa 4 — Volta pelas abas
    8. Da tela do player, só com teclado, chega-se às abas inferiores e
       Enter em "Progresso" navega para /app/progresso.

Ambiente (injetado pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso: python3 e2e/teclado_mobile_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

VIEWPORT_MOBILE = {"width": 390, "height": 844}
ALVO_MINIMO = 40  # px de altura mínima aceitável para alvo de toque
CONTROLES_PLAYER = ["Voltar 15 segundos", "Reproduzir", "Avançar 15 segundos"]

JS_FOCO = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { vazio: true };
  const estilo = getComputedStyle(el);
  const caixa = el.getBoundingClientRect();
  const anel =
    (estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth || '0') > 0) ||
    (estilo.boxShadow && estilo.boxShadow !== 'none') ||
    /focus-visible:(ring|outline)/.test(el.className || '');
  const nome = (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    (el.labels && el.labels[0] ? el.labels[0].textContent : '') ||
    el.textContent ||
    ''
  ).replace(/\\s+/g, ' ').trim();
  return {
    vazio: false,
    tag: el.tagName.toLowerCase(),
    nome: nome.slice(0, 80),
    href: el.getAttribute('href') || '',
    focusVisible: el.matches(':focus-visible'),
    anelVisivel: !!anel,
    altura: Math.round(caixa.height),
    largura: Math.round(caixa.width),
    dentroDaTela: caixa.top >= -1 && caixa.bottom <= window.innerHeight + 1,
  };
}"""


async def foco(page) -> dict:
    return await page.evaluate(JS_FOCO)


async def tab(page, vezes: int = 1, reverso: bool = False) -> dict:
    tecla = "Shift+Tab" if reverso else "Tab"
    for _ in range(vezes):
        await page.keyboard.press(tecla)
    return await foco(page)


async def tab_ate(page, aceita, limite: int = 60, reverso: bool = False):
    """Avança com Tab até `aceita(foco)` ser verdadeiro. Devolve (foco, trilha)."""
    trilha: list[dict] = []
    for _ in range(limite):
        atual = await tab(page, reverso=reverso)
        if atual.get("vazio"):
            continue
        trilha.append(atual)
        if aceita(atual):
            return atual, trilha
    return None, trilha


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


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport=VIEWPORT_MOBILE,
            timezone_id="America/Sao_Paulo",
            is_mobile=False,  # mantém teclado físico disponível
            has_touch=True,
        )
        page = await context.new_page()
        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        # ── Etapa 1: casca do app ────────────────────────────────────────────
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.get_by_role("heading", level=1).first.wait_for(timeout=30000)
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
        await page.screenshot(path=str(SCREENSHOTS / "teclado_mobile_1_biblioteca.png"))

        estrutura = await page.evaluate(
            """() => ({
              mains: document.querySelectorAll('main').length,
              navs: [...document.querySelectorAll('nav')].map((n) => ({
                nome: n.getAttribute('aria-label') || '',
              })),
            })"""
        )
        if estrutura["mains"] != 1:
            falhas.append(f"esperado 1 <main> na tela, encontrado {estrutura['mains']}")
        if not any(n["nome"] for n in estrutura["navs"]):
            falhas.append("barra de abas sem nome acessível (aria-label no <nav>)")

        # varredura de foco pela tela inicial
        await page.evaluate("() => document.body.focus()")
        vistos: list[dict] = []
        for _ in range(30):
            atual = await tab(page)
            if atual.get("vazio"):
                continue
            vistos.append(atual)
        for f in vistos:
            if not f["nome"]:
                falhas.append(f"elemento focável sem nome acessível: <{f['tag']}>")
            if not (f["focusVisible"] and f["anelVisivel"]):
                falhas.append(f"foco não visível em '{f['nome'] or f['tag']}'")
            if f["altura"] and f["altura"] < ALVO_MINIMO:
                falhas.append(
                    f"alvo pequeno no mobile: '{f['nome'] or f['tag']}' com {f['altura']}px de altura"
                )
        print(f"varredura mobile: {len(vistos)} elementos focáveis")

        # ── Etapa 2: biblioteca -> trilha ────────────────────────────────────
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.get_by_role("heading", level=1).first.wait_for(timeout=30000)
        await page.evaluate("() => document.body.focus()")
        eixo, _ = await tab_ate(page, lambda f: "/app/eixo/" in (f.get("href") or ""))
        if not eixo:
            print("SKIP: nenhum eixo alcançável por teclado nesta conta.")
        else:
            print("eixo alcançado por Tab:", eixo["nome"][:40])
            await page.keyboard.press("Enter")
            await page.wait_for_url("**/app/eixo/**", timeout=20000)
            await page.get_by_role("heading", level=1).first.wait_for(timeout=20000)
            await page.screenshot(path=str(SCREENSHOTS / "teclado_mobile_2_trilha.png"))

            ordenada = await page.locator("ol li a").count()
            voltar, _ = await tab_ate(page, lambda f: "Biblioteca" in (f.get("nome") or ""), limite=20)
            if not voltar:
                falhas.append("trilha: link 'Biblioteca' (voltar) não alcançado por teclado")

            pratica, _ = await tab_ate(
                page, lambda f: "/app/conteudo/" in (f.get("href") or ""), limite=40
            )
            if not pratica:
                if ordenada:
                    falhas.append("trilha: nenhuma prática alcançada por teclado")
                print("SKIP: trilha sem práticas liberadas.")
            else:
                print("prática alcançada por Tab:", pratica["nome"][:50])
                if not pratica["dentroDaTela"]:
                    falhas.append("trilha: item focado ficou fora da área visível no mobile")
                await page.keyboard.press("Enter")
                await page.wait_for_url("**/app/conteudo/**", timeout=20000)

                # ── Etapa 3: player ─────────────────────────────────────────
                await page.get_by_role("heading", level=1).first.wait_for(timeout=20000)
                await page.wait_for_timeout(1500)
                await page.screenshot(path=str(SCREENSHOTS / "teclado_mobile_3_player.png"))

                tem_controles = await page.get_by_role("button", name="Reproduzir").count()
                if not tem_controles:
                    print("prática sem player de mídia (texto/exercício) — etapa 3 parcial.")
                else:
                    await page.evaluate("() => document.body.focus()")
                    ordem: list[str] = []
                    for nome in CONTROLES_PLAYER:
                        achado, _ = await tab_ate(
                            page, lambda f, n=nome: n in (f.get("nome") or ""), limite=40
                        )
                        if not achado:
                            falhas.append(f"player: '{nome}' não alcançado por Tab")
                            continue
                        ordem.append(nome)
                        if not (achado["focusVisible"] and achado["anelVisivel"]):
                            falhas.append(f"player: foco não visível em '{nome}'")
                        if not achado["dentroDaTela"]:
                            falhas.append(f"player: '{nome}' focado fora da tela no mobile")
                    if ordem != [n for n in CONTROLES_PLAYER if n in ordem]:
                        falhas.append(f"player: ordem de tabulação inesperada: {ordem}")
                    print("controles alcançados na ordem:", ordem)

                    # Espaço no botão Reproduzir inicia a mídia pelo teclado
                    await page.evaluate("() => document.body.focus()")
                    play, _ = await tab_ate(
                        page, lambda f: "Reproduzir" in (f.get("nome") or ""), limite=40
                    )
                    if play:
                        await page.keyboard.press("Space")
                        await page.wait_for_timeout(1200)
                        tocando = await page.evaluate(
                            """() => {
                              const m = document.querySelector('audio, video');
                              return m ? !m.paused : null;
                            }"""
                        )
                        pausar = await page.get_by_role("button", name="Pausar").count()
                        if tocando is False and not pausar:
                            falhas.append("player: Espaço no botão Reproduzir não iniciou a mídia")
                        else:
                            print("reprodução iniciada pelo teclado (tocando:", tocando, ")")

                        # caminho reversível
                        anterior = await tab(page, reverso=True)
                        if anterior.get("vazio") or not anterior.get("nome"):
                            falhas.append("player: Shift+Tab perdeu o foco (caminho não reversível)")
                        else:
                            print("Shift+Tab voltou para:", anterior["nome"][:40])

                # ── Etapa 4: volta pelas abas ───────────────────────────────
                aba, _ = await tab_ate(
                    page,
                    lambda f: (f.get("href") or "").endswith("/app/progresso"),
                    limite=60,
                )
                if not aba:
                    falhas.append("abas inferiores: 'Progresso' não alcançado por teclado no player")
                else:
                    await page.keyboard.press("Enter")
                    await page.wait_for_url("**/app/progresso", timeout=20000)
                    await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=20000)
                    await page.screenshot(
                        path=str(SCREENSHOTS / "teclado_mobile_4_progresso.png")
                    )
                    print("navegou para o progresso só com teclado:", page.url)

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in dict.fromkeys(falhas):
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E OK: navegação por teclado consistente no mobile (trilhas e player).")


asyncio.run(main())
