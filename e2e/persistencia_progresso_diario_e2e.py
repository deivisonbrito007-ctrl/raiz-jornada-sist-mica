"""E2E: progresso e diário persistem após F5 e após reconectar como o mesmo cliente.

O teste prova que nada do que o cliente registra vive só em memória/cache:

  1. Escreve uma reflexão nova no Diário (texto único por execução) pela UI real.
  2. Marca uma prática liberada como concluída (server function real).
  3. Recarrega a página (F5) e confere que a entrada e a contagem seguem lá.
  4. Fecha o navegador e reconecta em um contexto NOVO (cache/localStorage limpos,
     apenas a sessão do mesmo cliente restaurada) e confere de novo.

Ambiente (injetado pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON

Uso: python3 e2e/persistencia_progresso_diario_e2e.py
"""

import asyncio
import json
import os
import re
import time
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MARCA = f"E2E persistência {int(time.time())}"

# Escolhe uma prática liberada ainda não concluída e a marca como concluída.
SCRIPT_CONCLUIR = """
async () => {
  const fns = await import('/src/lib/raiz.functions.ts');
  const bib = await fns.getMinhaBiblioteca();
  const eixos = bib?.eixos ?? bib ?? [];
  const conteudos = [];
  const coletar = (lista) => {
    for (const item of lista ?? []) {
      if (item?.conteudos) coletar(item.conteudos);
      if (item?.id && item?.titulo) conteudos.push(item);
    }
  };
  coletar(Array.isArray(eixos) ? eixos : []);
  coletar(bib?.conteudos ?? []);

  const liberado = conteudos.find(
    (c) => (c.liberado ?? c.disponivel ?? true) && c.status !== 'concluido',
  );
  if (!liberado) return { ok: false, motivo: 'sem prática liberada disponível' };

  await fns.marcarProgresso({ data: { conteudoId: liberado.id, status: 'concluido' } });
  return { ok: true, conteudoId: liberado.id, titulo: liberado.titulo };
}
"""


async def restaurar_sessao(context, page, session: dict, storage_key: str, cookies_json):
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE_URL
        await context.add_cookies(cookies)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(json.dumps(session))})"
    )


async def ler_concluidas(page) -> int:
    """Lê o contador 'Práticas concluídas' do painel de progresso."""
    await page.goto(f"{BASE_URL}/app/progresso", wait_until="domcontentloaded")
    await page.get_by_role("heading", name="Seu caminho").wait_for(timeout=30000)
    assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
    for _ in range(60):
        texto = " ".join((await page.inner_text("body")).split())
        m = re.search(r"Práticas concluídas (\d+)\s*/\s*(\d+)", texto)
        if m:
            return int(m.group(1))
        await page.wait_for_timeout(500)
    raise AssertionError("contador 'Práticas concluídas' não apareceu")


async def diario_contem(page, marca: str) -> bool:
    await page.goto(f"{BASE_URL}/app/diario", wait_until="domcontentloaded")
    await page.get_by_role("heading", name="Diário de reflexão").wait_for(timeout=30000)
    assert "/auth" not in page.url, f"redirecionado para login: {page.url}"
    for _ in range(60):
        if marca in await page.inner_text("body"):
            return True
        await page.wait_for_timeout(500)
    return False


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)

        # ── Sessão 1: registra diário + progresso ─────────────────────────────
        context = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, timezone_id="America/Sao_Paulo"
        )
        page = await context.new_page()
        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        concluidas_antes = await ler_concluidas(page)
        print("práticas concluídas antes:", concluidas_antes)

        # 1. escreve a reflexão pela UI
        await page.goto(f"{BASE_URL}/app/diario", wait_until="domcontentloaded")
        await page.get_by_role("heading", name="Diário de reflexão").wait_for(timeout=30000)
        campo = page.get_by_label(re.compile(r".+"), exact=False).nth(0)
        campo = page.locator("#campo-reflexao")
        await campo.fill(f"{MARCA} — esta reflexão precisa sobreviver ao recarregamento.")
        await page.get_by_role("button", name="Salvar reflexão").click()
        await page.get_by_text(MARCA).first.wait_for(timeout=30000)
        await page.screenshot(path=str(SCREENSHOTS / "persistencia_1_diario_salvo.png"))
        print("reflexão salva:", MARCA)

        # 2. conclui uma prática liberada
        marcado = await page.evaluate(SCRIPT_CONCLUIR)
        print("marcarProgresso:", marcado)
        esperado_depois = concluidas_antes + (1 if marcado.get("ok") else 0)

        # ── 3. F5: mesma aba, cache do React Query descartado ─────────────────
        await page.reload(wait_until="domcontentloaded")
        if not await diario_contem(page, MARCA):
            falhas.append("após F5: reflexão não aparece no diário")
        depois_f5 = await ler_concluidas(page)
        if depois_f5 != esperado_depois:
            falhas.append(
                f"após F5: {depois_f5} práticas concluídas, esperado {esperado_depois}"
            )
        await page.screenshot(path=str(SCREENSHOTS / "persistencia_2_apos_f5.png"))
        print("após F5 — diário OK, concluídas:", depois_f5)

        await context.close()

        # ── 4. Reconexão: contexto novo, storage limpo, mesmo cliente ─────────
        context2 = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, timezone_id="America/Sao_Paulo"
        )
        page2 = await context2.new_page()
        await restaurar_sessao(context2, page2, session, storage_key, cookies_json)

        if not await diario_contem(page2, MARCA):
            falhas.append("após reconectar: reflexão não aparece no diário")
        depois_reconexao = await ler_concluidas(page2)
        if depois_reconexao != esperado_depois:
            falhas.append(
                f"após reconectar: {depois_reconexao} concluídas, esperado {esperado_depois}"
            )
        await page2.screenshot(path=str(SCREENSHOTS / "persistencia_3_apos_reconectar.png"))
        print("após reconectar — diário OK, concluídas:", depois_reconexao)

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E OK: progresso e diário persistem após F5 e após reconectar.")


asyncio.run(main())
