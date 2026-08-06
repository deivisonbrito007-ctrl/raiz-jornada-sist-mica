"""E2E: cliente autenticado abre o popover do heatmap e os dados batem com o banco.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

Uso: python3 e2e/heatmap_cliente_e2e.py
"""

import asyncio
import json
import os
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

MESES_CURTOS = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
]


def env_from_dotenv(name: str) -> str:
    if os.environ.get(name):
        return os.environ[name]
    env_path = Path(__file__).resolve().parent.parent / ".env"
    for line in env_path.read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    raise RuntimeError(f"{name} não encontrado")


def dados_do_banco(session: dict) -> dict:
    """Lê progresso concluído do banco como o próprio usuário (RLS aplicada)."""
    url = env_from_dotenv("VITE_SUPABASE_URL")
    key = env_from_dotenv("VITE_SUPABASE_PUBLISHABLE_KEY")
    resp = requests.get(
        f"{url}/rest/v1/progresso",
        params={
            "select": "concluido_em,status,cliente_id,conteudos(titulo,duracao_segundos)",
            "status": "eq.concluido",
        },
        headers={"apikey": key, "Authorization": f"Bearer {session['access_token']}"},
        timeout=30,
    )
    resp.raise_for_status()
    rows = resp.json()
    uid = session["user"]["id"]
    assert all(r["cliente_id"] == uid for r in rows), "RLS vazou progresso de outro cliente"

    por_dia = defaultdict(lambda: {"total": 0, "segundos": 0, "titulos": []})
    for r in rows:
        dt = datetime.fromisoformat(r["concluido_em"].replace("Z", "+00:00")).astimezone()
        dia = por_dia[dt.strftime("%Y-%m-%d")]
        dia["total"] += 1
        dia["segundos"] += (r["conteudos"] or {}).get("duracao_segundos") or 0
        dia["titulos"].append((r["conteudos"] or {}).get("titulo"))
    return dict(por_dia)


def formatar_duracao(segundos: int) -> str:
    minutos = round(segundos / 60)
    if minutos < 60:
        return f"{minutos} min"
    horas, resto = divmod(minutos, 60)
    return f"{horas} h" if resto == 0 else f"{horas} h {resto} min"


async def main() -> None:
    session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
    storage_key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    esperado = dados_do_banco(session)
    assert esperado, "sem práticas concluídas no banco para validar o heatmap"
    print("dias com prática no banco:", {d: v["total"] for d, v in sorted(esperado.items())})

    falhas: list[str] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
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

        await page.goto(f"{BASE_URL}/app/progresso", wait_until="domcontentloaded")
        await page.get_by_role("heading", name="Calendário de prática").wait_for(timeout=30000)
        assert "/auth" not in page.url, f"redirecionado para login: {page.url}"

        # espera o heatmap hidratar com os dados do banco
        for _ in range(60):
            marcados = await page.get_by_role("button", name=re.compile(r"— \d+ prática")).count()
            if marcados >= len(esperado):
                break
            await page.wait_for_timeout(500)
        await page.screenshot(path=str(SCREENSHOTS / "1_progresso.png"))

        for dia, dados in sorted(esperado.items()):
            d = datetime.strptime(dia, "%Y-%m-%d")
            data_br = f"{d.day:02d} de {MESES_CURTOS[d.month - 1]}"
            plural = "" if dados["total"] == 1 else "s"
            botao = page.get_by_role(
                "button",
                name=re.compile(
                    rf"{data_br}\.? — {dados['total']} prática{plural}$"
                ),
            )
            if await botao.count() == 0:
                falhas.append(f"{data_br}: quadrado do dia não encontrado no heatmap")
                continue
            await botao.first.click()
            painel = page.get_by_role("dialog")
            await painel.wait_for(timeout=10000)
            texto = " ".join((await painel.inner_text()).split())

            resumo = f"{dados['total']} prática{plural} · {formatar_duracao(dados['segundos'])} registrados"
            if resumo not in texto:
                falhas.append(f"{data_br}: resumo esperado '{resumo}' ausente em '{texto}'")
            for titulo in dados["titulos"]:
                if titulo and titulo not in texto:
                    falhas.append(f"{data_br}: prática '{titulo}' não listada no popover")
            itens = await painel.locator("li").count()
            if itens != dados["total"]:
                falhas.append(f"{data_br}: {itens} itens no popover, esperado {dados['total']}")
            print(f"OK {data_br}: {texto}")
            await page.screenshot(path=str(SCREENSHOTS / f"popover_{dia}.png"))
            await page.keyboard.press("Escape")
            await painel.wait_for(state="detached", timeout=10000)

        # dia futuro não deve ser clicável
        amanha = datetime.now(timezone.utc).astimezone()
        futuros = await page.locator("span[title*='/']").count()
        print("quadrados futuros não interativos:", futuros, "(hoje:", amanha.date(), ")")

        await browser.close()

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print("\nE2E OK: popover do heatmap bate com o banco.")


asyncio.run(main())
