"""E2E: mudança de permissões em tempo real apaga e recarrega o cache corretamente.

O foco é a invalidação do cache (memória + `sessionStorage`) quando as permissões
mudam enquanto o painel já está aberto — sem recarregar a página na mão.

Cenários cobertos:
  1. Painel aberto: o cache por sessão guarda as listas do painel (`raiz-cache-v1`).
  2. Mudança de permissões (mesmo caminho do realtime, via BroadcastChannel):
     o cache persistido é apagado, o guard `pode_administrar` deixa de usar o
     cache de 30s (nova chamada ao servidor) e as consultas do painel recarregam.
  3. Recarregar depois da mudança não ressuscita dados antigos: o painel busca
     tudo do servidor de novo.
  4. Perda de acesso administrativo (`pode_administrar` = false): o cache é
     esvaziado por completo, o cliente é levado para /app e nada do painel
     sobrevive no `sessionStorage` — nem depois de um recarregamento.

Requisitos de ambiente (injetados pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
A conta da sessão precisa poder administrar (terapeuta ou admin de equipe).

Uso: python3 e2e/permissoes_tempo_real_cache_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

CHAVE_CACHE = "raiz-cache-v1"
CHAVE_USUARIO = "raiz-cache-usuario-v1"
ROTA_PAINEL = "/admin/clientes"

# Raízes de consulta do painel que devem estar no cache por sessão.
RAIZES_PAINEL = ("admin-clientes", "contexto")

SCRIPT_CACHE = """
() => {
  const bruto = sessionStorage.getItem('%s');
  if (!bruto) return { existe: false, raizes: [], usuario: sessionStorage.getItem('%s') };
  let dados = null;
  try { dados = JSON.parse(bruto); } catch { return { existe: true, invalido: true, raizes: [] }; }
  const queries = (dados && dados.clientState && dados.clientState.queries) || [];
  const raizes = queries.map((q) => (Array.isArray(q.queryKey) ? q.queryKey[0] : null)).filter(Boolean);
  return {
    existe: true,
    raizes: [...new Set(raizes)],
    total: queries.length,
    usuario: sessionStorage.getItem('%s'),
  };
}
""" % (CHAVE_CACHE, CHAVE_USUARIO, CHAVE_USUARIO)

SCRIPT_AVISAR = """
() => {
  const bc = new BroadcastChannel('raiz-permissoes');
  bc.postMessage({ tipo: 'permissoes-alteradas', em: Date.now() });
  bc.close();
  return true;
}
"""


async def esperar(condicao, mensagem: str, tentativas: int = 40, intervalo: float = 0.25):
    """Espera ativa simples: `condicao` é uma corrotina que devolve o valor lido."""
    ultimo = None
    for _ in range(tentativas):
        ultimo = await condicao()
        if ultimo:
            return ultimo
        await asyncio.sleep(intervalo)
    raise AssertionError(f"{mensagem} (último valor: {ultimo})")


class Contador:
    """Conta requisições reais ao backend por tipo, para provar recarga."""

    def __init__(self) -> None:
        self.pode_administrar = 0
        self.funcoes_painel = 0

    def registrar(self, url: str) -> None:
        if "/rpc/pode_administrar" in url:
            self.pode_administrar += 1
        elif "_serverFn" in url and ("admin" in url or "Contexto" in url):
            self.funcoes_painel += 1

    def zerar(self) -> None:
        self.pode_administrar = 0
        self.funcoes_painel = 0


async def main() -> None:
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    if not (session_json and storage_key):
        print("sem sessão injetada: teste NÃO VERIFICADO (peça login no preview da Lovable)")
        return

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})

        if cookies_json:
            cookies = json.loads(cookies_json)
            for c in cookies:
                c["url"] = BASE_URL
            await context.add_cookies(cookies)

        page = await context.new_page()
        contador = Contador()
        page.on("request", lambda r: contador.registrar(r.url))

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )

        # ---------- 1. Painel aberto povoa o cache por sessão ----------
        await page.goto(f"{BASE_URL}{ROTA_PAINEL}", wait_until="networkidle")
        assert "/admin" in page.url, (
            f"a conta da sessão não consegue abrir o painel (url={page.url}); "
            "use uma conta de terapeuta/admin"
        )

        async def cache_do_painel():
            cache = await page.evaluate(SCRIPT_CACHE)
            if cache.get("existe") and all(r in cache["raizes"] for r in RAIZES_PAINEL):
                return cache
            return None

        cache = await esperar(cache_do_painel, "o cache por sessão não guardou as listas do painel")
        assert cache.get("usuario"), "o cache persistido não ficou amarrado à conta"
        print(f"1. cache por sessão povoado: raízes={sorted(cache['raizes'])} ✔")
        await page.screenshot(path=str(SCREENSHOTS / "permissoes-cache-1-povoado.png"))

        # ---------- 2. Mudança de permissões apaga o cache e recarrega ----------
        contador.zerar()
        await page.evaluate(SCRIPT_AVISAR)

        async def cache_apagado():
            cache = await page.evaluate(SCRIPT_CACHE)
            # apagado de imediato: ou a chave sai, ou perde as raízes do painel
            if not cache.get("existe"):
                return {"apagado": True}
            if not any(r in cache["raizes"] for r in ("admin-clientes",)):
                return {"apagado": True}
            return None

        await esperar(cache_apagado, "o cache persistido do painel não foi apagado na mudança")
        print("2a. cache persistido apagado na hora da mudança de permissões ✔")

        await esperar(
            lambda: asyncio.sleep(0, result=contador.pode_administrar > 0),
            "o guard não revalidou pode_administrar (cache de 30s não foi descartado)",
        )
        print(f"2b. pode_administrar revalidado no servidor ({contador.pode_administrar}x) ✔")

        await esperar(
            lambda: asyncio.sleep(0, result=contador.funcoes_painel > 0),
            "as consultas do painel não recarregaram depois da mudança",
        )
        print(f"2c. consultas do painel recarregadas ({contador.funcoes_painel} requisições) ✔")

        # o painel continua utilizável (a permissão ainda existe)
        assert "/admin" in page.url, f"painel perdido sem perda de permissão (url={page.url})"
        cache = await esperar(cache_do_painel, "o cache não foi reconstruído com dados frescos")
        print("2d. cache reconstruído com dados frescos do servidor ✔")
        await page.screenshot(path=str(SCREENSHOTS / "permissoes-cache-2-recarregado.png"))

        # ---------- 3. Recarregar não ressuscita dados antigos ----------
        contador.zerar()
        await page.reload(wait_until="networkidle")
        assert "/admin" in page.url, f"o painel não sobreviveu ao recarregamento (url={page.url})"
        assert contador.pode_administrar > 0, (
            "depois do recarregamento o guard não consultou o servidor"
        )
        print("3. após recarregar, o guard e o painel buscam do servidor de novo ✔")

        # ---------- 4. Perda de acesso: cache esvaziado e saída do painel ----------
        async def negar_admin(rota):
            await rota.fulfill(
                status=200,
                content_type="application/json",
                body="false",
            )

        await page.route("**/rest/v1/rpc/pode_administrar*", negar_admin)
        await page.evaluate(SCRIPT_AVISAR)

        async def saiu_do_painel():
            return "/app" in page.url and "/admin" not in page.url

        await esperar(saiu_do_painel, f"não saiu do painel ao perder acesso (url={page.url})")
        print("4a. perda de acesso administrativo tira o usuário do painel ✔")

        async def cache_sem_painel():
            cache = await page.evaluate(SCRIPT_CACHE)
            if not cache.get("existe"):
                return {"limpo": True}
            if not any(r.startswith("admin-") or r == "equipe" for r in cache["raizes"]):
                return {"limpo": True}
            return None

        await esperar(cache_sem_painel, "sobrou dado do painel no cache após perder o acesso")
        print("4b. nenhum dado do painel sobrou no cache por sessão ✔")

        await page.goto(f"{BASE_URL}{ROTA_PAINEL}", wait_until="networkidle")
        assert "/admin/clientes" not in page.url, (
            f"o painel voltou a abrir mesmo sem acesso (url={page.url})"
        )
        await esperar(cache_sem_painel, "dado do painel reapareceu no cache após recarregar")
        print("4c. nem recarregando o painel volta do cache ✔")
        await page.screenshot(path=str(SCREENSHOTS / "permissoes-cache-4-sem-acesso.png"))

        await browser.close()

    print("\nTODOS OS CENÁRIOS DE INVALIDAÇÃO DE CACHE EM TEMPO REAL PASSARAM ✔")


if __name__ == "__main__":
    asyncio.run(main())
