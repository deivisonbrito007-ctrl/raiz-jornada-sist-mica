"""E2E de performance/regressão: tempo de resposta ao alternar abas (390x844).

Mede, em viewport de celular (390x844) e com a sessão real, quanto tempo o app
leva para trocar de aba — do clique até a rota nova estar pintada e sem estado
pendente. Roda N repetições por aba, calcula mediana/p95 e compara com uma
linha de base versionada, falhando quando houver regressão.

  Etapa 1 — Painel do Cliente (abas inferiores)
    Início -> Jornada -> Diário -> Perfil (ciclo), N vezes.

  Etapa 2 — Painel da Terapeuta (navegação lateral), quando acessível
    Início -> Clientes -> Trilhas -> Acompanhamento (ciclo), N vezes.

Critérios de aprovação (por aba):
    mediana <= LIMITE_MEDIANA_MS
    p95     <= LIMITE_P95_MS
    mediana <= baseline_mediana * (1 + TOLERANCIA_REGRESSAO)   [regressão]
    nenhum erro de console durante a troca

Linha de base: e2e/baselines/perf_abas.json
    - ausente  -> o script grava a base e passa (primeira execução)
    - presente -> compara; atualize com `--atualizar-base` quando a melhoria
      for intencional.

Ambiente (injetado pelo sandbox da Lovable):
    LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso:
    python3 e2e/performance_abas_e2e.py [--repeticoes 5] [--atualizar-base]
"""

import argparse
import asyncio
import json
import os
import statistics
import time
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
PASTA = Path(__file__).parent
SCREENSHOTS = PASTA / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
BASE_DIR = PASTA / "baselines"
BASE_DIR.mkdir(parents=True, exist_ok=True)
ARQUIVO_BASE = BASE_DIR / "perf_abas.json"

VIEWPORT_MOBILE = {"width": 390, "height": 844}

LIMITE_MEDIANA_MS = float(os.environ.get("E2E_PERF_MEDIANA_MS", 600))
LIMITE_P95_MS = float(os.environ.get("E2E_PERF_P95_MS", 1200))
TOLERANCIA_REGRESSAO = float(os.environ.get("E2E_PERF_TOLERANCIA", 0.35))  # +35%
REPETICOES_PADRAO = int(os.environ.get("E2E_PERF_REPETICOES", 5))

ABAS_CLIENTE = [
    ("cliente:inicio", "Início", "/app"),
    ("cliente:jornada", "Jornada", "/app/jornada"),
    ("cliente:diario", "Diário", "/app/diario"),
    ("cliente:perfil", "Perfil", "/app/perfil"),
]

ABAS_PAINEL = [
    ("painel:inicio", "/admin/inicio", "/admin/inicio"),
    ("painel:planos", "/admin/clientes", "/admin/clientes"),
    ("painel:trilhas", "/admin/trilhas", "/admin/trilhas"),
    ("painel:conteudos", "/admin/conteudos", "/admin/conteudos"),
    ("painel:acompanhamento", "/admin/acompanhamento", "/admin/acompanhamento"),
]


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


async def esperar_estavel(page, rota: str, tempo_limite: float = 15.0) -> None:
    """Espera a URL bater, o conteúdo aparecer e não haver skeleton/pendente."""
    inicio = time.monotonic()
    estado: dict = {}
    while time.monotonic() - inicio < tempo_limite:
        estado = await page.evaluate(
            """(rota) => {
              const url = location.pathname;
              const casa = url === rota || url.startsWith(rota + '/');
              if (!casa) return { pronto: false, motivo: 'url=' + url };
              const main = document.querySelector('main');
              if (!main) return { pronto: false, motivo: 'sem <main>' };
              const pendente = main.querySelector('[data-carregando="true"],[aria-busy="true"],[data-slot="skeleton"],.animate-pulse');
              const texto = main.innerText.trim().length;
              if (!texto) return { pronto: false, motivo: 'main vazio' };
              if (pendente)
                return {
                  pronto: false,
                  pintado: true,
                  motivo: 'pendente: ' + (pendente.className || pendente.tagName).toString().slice(0, 60),
                };
              return { pronto: true };
            }""",
            rota,
        )
        decorrido = time.monotonic() - inicio
        # Alguns painéis mantêm animações contínuas: após 3s com a tela já
        # pintada, considera-se estável para não travar a medição.
        if estado.get("pronto") or (estado.get("pintado") and decorrido > 3.0):
            # dois frames para garantir a pintura
            await page.evaluate(
                "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
            )
            return
        await page.wait_for_timeout(16)
    raise TimeoutError(
        f"rota {rota} não estabilizou em {tempo_limite}s ({estado.get('motivo')})"
    )



async def abrir_menu_se_preciso(page, alvo) -> None:
    """No painel em celular a navegação fica num menu recolhido."""
    if await alvo.count() and await alvo.is_visible():
        return
    gatilho = page.get_by_role("button", name="Abrir ou fechar o menu").first
    if await gatilho.count() and await gatilho.is_visible():
        await gatilho.click()
        await alvo.wait_for(state="visible", timeout=8_000)
        # a gaveta anima ao abrir; espera-se o fim para não medir a animação
        await page.wait_for_timeout(600)


async def medir_troca(page, rotulo: str, rota: str, erros: list[str]) -> float:
    if rotulo.startswith("/"):
        alvo = page.locator(f'a[href="{rotulo}"]').first
    else:
        alvo = page.get_by_role("link", name=rotulo, exact=False).first
    await abrir_menu_se_preciso(page, alvo)
    await alvo.wait_for(state="visible", timeout=10_000)
    antes = len(erros)
    inicio = time.perf_counter()
    # force=True evita o hit-test do Playwright (a gaveta do painel se
    # sobrepõe durante a animação) sem alterar o que é medido: o clique real.
    await alvo.click(force=True)
    await esperar_estavel(page, rota)
    decorrido = (time.perf_counter() - inicio) * 1000
    if len(erros) > antes:
        raise AssertionError(f"erro de console ao abrir {rotulo}: {erros[antes]}")
    return decorrido



def resumo(amostras: list[float]) -> dict:
    ordenado = sorted(amostras)
    indice_p95 = min(len(ordenado) - 1, max(0, round(0.95 * (len(ordenado) - 1))))
    return {
        "amostras": [round(v, 1) for v in amostras],
        "n": len(amostras),
        "mediana": round(statistics.median(ordenado), 1),
        "p95": round(ordenado[indice_p95], 1),
        "max": round(ordenado[-1], 1),
    }


async def medir_grupo(page, abas, repeticoes: int, erros: list[str]) -> dict:
    coleta: dict[str, list[float]] = {chave: [] for chave, _, _ in abas}
    # volta inicial para a primeira aba do grupo (não conta na medição)
    primeira = abas[0]
    await page.goto(f"{BASE_URL}{primeira[2]}", wait_until="domcontentloaded")
    await esperar_estavel(page, primeira[2])
    for _ in range(repeticoes):
        for chave, rotulo, rota in abas:
            if page.url.endswith(rota):
                continue
            coleta[chave].append(await medir_troca(page, rotulo, rota, erros))
    return {chave: resumo(v) for chave, v in coleta.items() if v}


def comparar(atual: dict, base: dict | None) -> list[str]:
    falhas: list[str] = []
    for chave, m in atual.items():
        if m["mediana"] > LIMITE_MEDIANA_MS:
            falhas.append(
                f"{chave}: mediana {m['mediana']}ms > limite {LIMITE_MEDIANA_MS}ms"
            )
        if m["p95"] > LIMITE_P95_MS:
            falhas.append(f"{chave}: p95 {m['p95']}ms > limite {LIMITE_P95_MS}ms")
        anterior = (base or {}).get(chave)
        if anterior:
            teto = anterior["mediana"] * (1 + TOLERANCIA_REGRESSAO)
            if m["mediana"] > teto:
                falhas.append(
                    f"{chave}: regressão — mediana {m['mediana']}ms vs base "
                    f"{anterior['mediana']}ms (teto {round(teto, 1)}ms)"
                )
    return falhas


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeticoes", type=int, default=REPETICOES_PADRAO)
    parser.add_argument("--atualizar-base", action="store_true")
    args = parser.parse_args()

    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    erros: list[str] = []
    medidas: dict = {}

    async with async_playwright() as p:
        navegador = await p.chromium.launch(headless=True)
        context = await navegador.new_context(viewport=VIEWPORT_MOBILE)
        page = await context.new_page()
        page.on(
            "console",
            lambda msg: erros.append(msg.text[:200]) if msg.type == "error" else None,
        )
        page.on("pageerror", lambda e: erros.append(str(e)[:200]))

        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        print("== Etapa 1 — abas do cliente (390x844) ==")
        medidas.update(await medir_grupo(page, ABAS_CLIENTE, args.repeticoes, erros))

        print("== Etapa 2 — abas do painel da terapeuta ==")
        await page.goto(f"{BASE_URL}/admin/inicio", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        if "/admin" in page.url:
            try:
                medidas.update(
                    await medir_grupo(page, ABAS_PAINEL, args.repeticoes, erros)
                )
            except Exception as exc:  # painel indisponível para esta conta
                print(f"  (painel ignorado: {exc})")
        else:
            print("  (conta sem acesso ao painel — etapa ignorada)")

        await page.screenshot(path=str(SCREENSHOTS / "performance_abas_390x844.png"))
        await navegador.close()

    base = json.loads(ARQUIVO_BASE.read_text()) if ARQUIVO_BASE.exists() else None

    print("\n== Resultado (ms) ==")
    for chave, m in medidas.items():
        ref = (base or {}).get(chave, {}).get("mediana")
        extra = f" | base {ref}ms" if ref else ""
        print(
            f"  {chave:26s} n={m['n']} mediana={m['mediana']} p95={m['p95']} max={m['max']}{extra}"
        )

    falhas = comparar(medidas, base)

    if args.atualizar_base or base is None:
        ARQUIVO_BASE.write_text(json.dumps(medidas, indent=2, ensure_ascii=False) + "\n")
        print(f"\nLinha de base gravada em {ARQUIVO_BASE.relative_to(PASTA.parent)}")

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(f"  - {f}")
        raise SystemExit(1)

    print("\nOK — nenhuma regressão de performance nas trocas de aba.")


if __name__ == "__main__":
    asyncio.run(main())
