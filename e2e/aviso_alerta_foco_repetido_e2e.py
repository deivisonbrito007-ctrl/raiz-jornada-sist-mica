"""E2E: aviso `role="alert"` aberto várias vezes em sequência.

O aviso de remoção em tempo real rouba o foco para ser anunciado por leitor de
tela e, ao ser dispensado, precisa devolver o foco ao controle de origem. Este
teste repete o ciclo abrir → dispensar várias vezes e garante que, em CADA
ciclo, o foco volta para o elemento correto ANTES da dispensa seguinte:

  1. Foco num controle diferente da biblioteca em cada ciclo (1º, 2º, 3º...).
  2. Remoção pela API → o aviso aparece, recebe o foco e é único na tela.
  3. Dispensa alternando clique no atalho (ciclos ímpares) e Escape (pares).
  4. Depois da dispensa, o foco está EXATAMENTE no elemento de origem daquele
     ciclo (comparação por referência, não por texto), com foco visível, fora
     do aviso e nunca no <body>.
  5. Ciclo extra de sobreposição: nova remoção com o aviso anterior ainda
     aberto — a origem guardada não pode ser substituída pelo próprio aviso.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
  VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (lidos de .env)

A conta da sessão precisa poder gerenciar liberações (libera/remove para ela
mesma como cliente).

Uso: python3 e2e/aviso_alerta_foco_repetido_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

import requests
from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

CICLOS = 5

# Estado do foco atual, incluindo se é o mesmo elemento guardado em
# window.__e2eOrigem (identidade por referência, não por rótulo).
JS_FOCO = """() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { vazio: true, tag: 'body', ehOrigem: false };
  return {
    vazio: false,
    tag: el.tagName.toLowerCase(),
    nome: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    dentroDoAviso: !!el.closest('[role="alert"]'),
    ehOAviso: el.getAttribute('role') === 'alert',
    focusVisible: el.matches(':focus-visible'),
    ehOrigem: window.__e2eOrigem === el,
    origemConectada: !!(window.__e2eOrigem && window.__e2eOrigem.isConnected),
  };
}"""

# Foca o n-ésimo controle focável do documento e guarda a referência.
JS_FOCAR_INDICE = """(indice) => {
  const seletor = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const candidatos = Array.from(document.querySelectorAll(seletor)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.closest('[role="alert"]')) return false;
    if (el.hidden || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (!candidatos.length) return { ok: false, total: 0 };
  const alvo = candidatos[Math.min(indice, candidatos.length - 1)];
  window.__e2eOrigem = alvo;
  alvo.focus();
  return {
    ok: document.activeElement === alvo,
    total: candidatos.length,
    nome: (alvo.getAttribute('aria-label') || alvo.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    tag: alvo.tagName.toLowerCase(),
  };
}"""


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


async def esperar_aviso(page, timeout=20000):
    alerta = page.get_by_role("alert").first
    await alerta.wait_for(state="visible", timeout=timeout)
    return alerta


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
    if not eixos:
        print("SKIP: nenhum eixo cadastrado.")
        return
    eixo = eixos[0]

    def liberar() -> str:
        api.delete(
            "liberacoes",
            {"cliente_id": f"eq.{uid}", "eixo_id": f"eq.{eixo['id']}", "conteudo_id": "is.null"},
        )
        linha = api.insert(
            "liberacoes",
            {"cliente_id": uid, "eixo_id": eixo["id"], "conteudo_id": None, "status": "liberado"},
        )
        return linha["id"]

    def remover(liberacao_id: str) -> None:
        api.delete("liberacoes", {"id": f"eq.{liberacao_id}"})

    falhas: list[str] = []
    resumo: list[str] = []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()
        page.on("console", lambda m: m.type == "error" and print("console.error:", m.text[:200]))

        await restaurar_sessao(context, page, session, storage_key, cookies_json)

        liberacao_id = liberar()
        await page.goto(f"{BASE_URL}/app", wait_until="domcontentloaded")
        await page.wait_for_timeout(2500)

        # ---------- Ciclos repetidos ----------
        for ciclo in range(1, CICLOS + 1):
            if ciclo > 1:
                liberacao_id = liberar()
                await page.wait_for_timeout(1500)

            origem = await page.evaluate(JS_FOCAR_INDICE, ciclo - 1)
            if not origem.get("ok"):
                falhas.append(f"ciclo {ciclo}: não foi possível focar um controle de origem")
                break
            print(f"ciclo {ciclo}: origem = <{origem['tag']}> {origem['nome']!r}")

            remover(liberacao_id)
            alerta = await esperar_aviso(page)
            await page.wait_for_timeout(400)

            quantos = await page.get_by_role("alert").count()
            if quantos != 1:
                falhas.append(f"ciclo {ciclo}: {quantos} avisos na tela (esperado exatamente 1)")

            foco_aberto = await page.evaluate(JS_FOCO)
            if not foco_aberto.get("ehOAviso"):
                falhas.append(f"ciclo {ciclo}: o aviso não recebeu o foco ao abrir: {foco_aberto}")

            modo = "clique" if ciclo % 2 else "escape"
            if modo == "clique":
                await alerta.get_by_role("button", name="Entendi, dispensar aviso").click()
            else:
                await page.keyboard.press("Escape")
            await alerta.wait_for(state="detached", timeout=10000)
            await page.wait_for_timeout(300)

            depois = await page.evaluate(JS_FOCO)
            print(f"  dispensado por {modo}; foco após:", depois)
            if depois["vazio"]:
                falhas.append(f"ciclo {ciclo} ({modo}): o foco caiu no <body> após dispensar")
            elif depois["dentroDoAviso"]:
                falhas.append(f"ciclo {ciclo} ({modo}): o foco ficou preso dentro do aviso fechado")
            elif not depois["ehOrigem"]:
                if depois.get("origemConectada"):
                    falhas.append(
                        f"ciclo {ciclo} ({modo}): foco voltou para {depois['nome']!r} em vez do "
                        f"controle de origem {origem['nome']!r}"
                    )
                else:
                    print("  (origem saiu da tela; foco foi para o primeiro controle relevante)")
            if not depois["vazio"] and not depois["focusVisible"]:
                falhas.append(f"ciclo {ciclo} ({modo}): o elemento refocado não tem foco visível")

            resumo.append(
                f"ciclo {ciclo} ({modo}): origem={origem['nome']!r} → foco={depois.get('nome')!r} "
                f"origem_ok={depois.get('ehOrigem')}"
            )
            await page.screenshot(path=str(SCREENSHOTS / f"aviso_repetido_ciclo_{ciclo}.png"))

        # ---------- Ciclo de sobreposição ----------
        liberacao_id = liberar()
        await page.wait_for_timeout(1500)
        origem_sobre = await page.evaluate(JS_FOCAR_INDICE, 0)
        remover(liberacao_id)
        alerta = await esperar_aviso(page)
        await page.wait_for_timeout(300)

        # Segunda remoção com o aviso anterior ainda aberto.
        liberacao_id = liberar()
        await page.wait_for_timeout(800)
        remover(liberacao_id)
        await page.wait_for_timeout(1200)

        quantos = await page.get_by_role("alert").count()
        print("sobreposição: avisos na tela =", quantos)
        if quantos > 1:
            falhas.append(f"sobreposição: {quantos} avisos empilhados na tela")

        alerta = page.get_by_role("alert").first
        await alerta.get_by_role("button", name="Entendi, dispensar aviso").click()
        await alerta.wait_for(state="detached", timeout=10000)
        await page.wait_for_timeout(300)
        pos_sobre = await page.evaluate(JS_FOCO)
        print("sobreposição: foco após dispensar:", pos_sobre, "| origem:", origem_sobre["nome"])
        if pos_sobre["vazio"]:
            falhas.append("sobreposição: o foco caiu no <body> após dispensar")
        elif pos_sobre["dentroDoAviso"] or pos_sobre["ehOAviso"]:
            falhas.append("sobreposição: a origem guardada foi substituída pelo próprio aviso")
        elif not pos_sobre["ehOrigem"] and pos_sobre.get("origemConectada"):
            falhas.append(
                f"sobreposição: foco voltou para {pos_sobre['nome']!r} em vez de "
                f"{origem_sobre['nome']!r}"
            )
        await page.screenshot(path=str(SCREENSHOTS / "aviso_repetido_sobreposicao.png"))

        # ---------- Estado final ----------
        if await page.get_by_role("alert").count():
            falhas.append("sobrou um aviso na tela ao final dos ciclos")
        await page.keyboard.press("Tab")
        final = await page.evaluate(JS_FOCO)
        print("final: Tab levou o foco para:", final)
        if final["vazio"]:
            falhas.append("após todos os ciclos, Tab não encontra nenhum controle (foco perdido)")

        await browser.close()

    print("\nRESUMO")
    for linha in resumo:
        print(" -", linha)

    if falhas:
        print("\nFALHAS:")
        for f in falhas:
            print(" -", f)
        raise SystemExit(1)
    print(f"\nOK: {CICLOS} ciclos + sobreposição com foco restaurado corretamente.")


asyncio.run(main())
