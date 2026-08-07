"""E2E: nenhum endpoint ou tela devolve/aceita dados de outro usuário.

O teste roda no navegador real, com a sessão real do app (cliente ou terapeuta),
e exercita os dois caminhos que poderiam vazar dados:

  1. Data API (RLS): leituras e gravações apontando para o `cliente_id` de OUTRO
     usuário — devem voltar vazias ou falhar, nunca tocar a linha alheia.
  2. Server functions reais (`raiz.functions.ts`): mesmo quando o payload traz
     um `clienteId`/`userId` forjado, o servidor deriva o dono do token. A linha
     gravada precisa pertencer ao usuário autenticado.
  3. Telas: o painel do cliente mostra apenas os próprios registros e as rotas
     administrativas somem para quem não pode administrar.

As expectativas respeitam o papel/permissões reais da sessão: um terapeuta com
`ver_clientes` PODE ler clientes, mas nem ele pode gravar diário/progresso no
lugar de outra pessoa.

Ambiente (injetado pelo sandbox da Lovable):
  LOVABLE_BROWSER_SUPABASE_SESSION_JSON / _STORAGE_KEY / _COOKIES_JSON
Opcional (para exercitar explicitamente uma conta cliente):
  E2E_EMAIL_CLIENTE / E2E_SENHA_CLIENTE

Uso: python3 e2e/isolamento_dados_e2e.py
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

# UUID que não pertence a ninguém: serve de "outro usuário" para provar que
# nenhuma leitura/gravação atravessa a fronteira do dono.
OUTRO = "99999999-9999-4999-8999-999999999999"

SCRIPT_CONTEXTO = """
async () => {
  const fns = await import('/src/lib/raiz.functions.ts');
  const cli = await import('/src/integrations/supabase/client.ts');
  const { data } = await cli.supabase.auth.getUser();
  try {
    const ctx = await fns.getMeuContexto();
    return { ok: true, userId: data?.user?.id ?? null, ctx };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  }
}
"""

# Leituras diretas na Data API mirando o dono errado.
SCRIPT_LEITURAS = """
async ({ outro }) => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const alvos = [
    ['diario', 'cliente_id'],
    ['progresso', 'cliente_id'],
    ['notificacoes', 'cliente_id'],
    ['liberacoes', 'cliente_id'],
    ['clientes_pacotes', 'cliente_id'],
    ['profiles', 'id'],
    ['user_roles', 'user_id'],
  ];
  const saida = [];
  for (const [tabela, coluna] of alvos) {
    const { data, error } = await supabase.from(tabela).select('*').eq(coluna, outro);
    saida.push({ tabela, linhas: (data || []).length, erro: error ? error.message : null });
  }
  // Tabelas que nenhum papel de app deve ler pela Data API.
  for (const tabela of ['limites_uso']) {
    const { data, error } = await supabase.from(tabela).select('*').limit(1);
    saida.push({ tabela, fechada: true, linhas: (data || []).length, erro: error ? error.message : null });
  }
  return saida;
}
"""

# Gravações diretas na Data API em nome de outro usuário.
SCRIPT_GRAVACOES = """
async ({ outro }) => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const saida = [];
  const tentar = async (nome, promessa) => {
    const { data, error } = await promessa;
    saida.push({ nome, linhas: (data || []).length, erro: error ? error.message : null });
  };
  await tentar('insert diario alheio', supabase.from('diario')
    .insert({ cliente_id: outro, texto: 'e2e nao deve gravar' }).select());
  await tentar('insert progresso alheio', supabase.from('progresso')
    .insert({ cliente_id: outro, conteudo_id: outro, status: 'concluido' }).select());
  await tentar('insert notificacao alheia', supabase.from('notificacoes')
    .insert({ cliente_id: outro, titulo: 'e2e' }).select());
  await tentar('insert liberacao alheia', supabase.from('liberacoes')
    .insert({ cliente_id: outro, eixo_id: outro, status: 'liberado' }).select());
  await tentar('update diario alheio', supabase.from('diario')
    .update({ texto: 'e2e invadiu' }).eq('cliente_id', outro).select());
  await tentar('update progresso alheio', supabase.from('progresso')
    .update({ status: 'concluido' }).eq('cliente_id', outro).select());
  await tentar('delete diario alheio', supabase.from('diario')
    .delete().eq('cliente_id', outro).select());
  await tentar('promover papel', supabase.from('user_roles')
    .insert({ user_id: outro, role: 'terapeuta' }).select());
  await tentar('virar terapeuta', supabase.from('user_roles')
    .update({ role: 'terapeuta' }).eq('user_id', outro).select());
  return saida;
}
"""

# Server functions com dono forjado no payload.
SCRIPT_FORJAR_DONO = """
async ({ outro }) => {
  const fns = await import('/src/lib/raiz.functions.ts');
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const marca = 'e2e-isolamento-' + Date.now();
  const saida = { marca };

  try {
    await fns.salvarDiario({ data: { texto: marca, clienteId: outro, cliente_id: outro, userId: outro } });
    saida.diarioOk = true;
  } catch (e) {
    saida.diarioOk = false;
    saida.diarioErro = String((e && e.message) || e).slice(0, 300);
  }
  const { data: escritos } = await supabase.from('diario').select('cliente_id, texto').eq('texto', marca);
  saida.donos = (escritos || []).map((r) => r.cliente_id);

  // A entrada forjada nunca pode aparecer na listagem do "outro".
  const { data: doOutro } = await supabase.from('diario').select('id').eq('cliente_id', outro);
  saida.linhasDoOutro = (doOutro || []).length;

  try {
    await fns.marcarProgresso({ data: { conteudoId: outro, concluido: true, clienteId: outro } });
    saida.progressoOk = true;
  } catch (e) {
    saida.progressoOk = false;
    saida.progressoErro = String((e && e.message) || e).slice(0, 300);
  }
  const { data: progAlheio } = await supabase.from('progresso').select('id').eq('cliente_id', outro);
  saida.progressoAlheio = (progAlheio || []).length;

  try {
    await fns.definirMetaSemanal({ data: { metaSemanal: 4, userId: outro, id: outro } });
    saida.metaOk = true;
  } catch (e) {
    saida.metaOk = false;
  }
  const { data: perfilAlheio } = await supabase.from('profiles').select('meta_semanal').eq('id', outro);
  saida.perfilAlheio = (perfilAlheio || []).length;

  // Limpa a entrada de diário criada legitimamente pelo teste.
  await supabase.from('diario').delete().eq('texto', marca);
  return saida;
}
"""

# Mídia privada: nenhuma sessão pode baixar objeto do bucket sem liberação.
SCRIPT_MIDIA = """
async () => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const caminho = 'e2e/nao-liberado.mp4';
  const baixar = await supabase.storage.from('midias').download(caminho);
  const assinar = await supabase.storage.from('midias').createSignedUrl(caminho, 60);
  const listar = await supabase.storage.from('midias').list();
  return {
    baixouBytes: baixar.data ? baixar.data.size : 0,
    baixarErro: baixar.error ? baixar.error.message : null,
    assinou: !!(assinar.data && assinar.data.signedUrl),
    assinarErro: assinar.error ? assinar.error.message : null,
    listou: (listar.data || []).length,
    listarErro: listar.error ? listar.error.message : null,
  };
}
"""

SCRIPT_TELA_DIARIO = """
async () => {
  const { supabase } = await import('/src/integrations/supabase/client.ts');
  const { data } = await supabase.auth.getUser();
  const meu = data?.user?.id ?? null;
  const { data: linhas } = await supabase.from('diario').select('cliente_id');
  return {
    meu,
    total: (linhas || []).length,
    alheias: (linhas || []).filter((r) => r.cliente_id !== meu).length,
  };
}
"""


async def rodar_cenarios(page, rotulo: str) -> None:
    info = await page.evaluate(SCRIPT_CONTEXTO)
    assert info.get("ok"), f"{rotulo}: sessão inválida ({info.get('erro')})"
    ctx = info["ctx"]
    meu_id = info["userId"]
    papel = ctx.get("papel")
    permissoes = set(ctx.get("permissoes") or [])
    pode_administrar = bool(ctx.get("podeAdministrar"))
    ve_clientes = papel == "terapeuta" or "ver_clientes" in permissoes
    print(f"\n[{rotulo}] papel={papel} permissoes={sorted(permissoes)}")

    # ---- 1. Leituras apontando para outro dono ----
    leituras = await page.evaluate(SCRIPT_LEITURAS, {"outro": OUTRO})
    for r in leituras:
        assert r["linhas"] == 0, (
            f"{rotulo}: leitura de {r['tabela']} devolveu {r['linhas']} linha(s) de outro usuário"
        )
        # Tabela interna: sem política de leitura, precisa vir vazia (erro de
        # permissão ou zero linhas — em ambos os casos nada é exposto).
        if r.get("fechada"):
            assert r["linhas"] == 0, f"{rotulo}: {r['tabela']} expôs dados internos"
    print(f"[{rotulo}] leituras de dados alheios: 0 linhas em {len(leituras)} tabelas ✔")

    # ---- 2. Gravações em nome de outro dono ----
    gravacoes = await page.evaluate(SCRIPT_GRAVACOES, {"outro": OUTRO})
    for g in gravacoes:
        assert g["linhas"] == 0, f"{rotulo}: '{g['nome']}' afetou {g['linhas']} linha(s) alheia(s)"
        # INSERT sem política é recusado com erro; UPDATE/DELETE simplesmente
        # não encontram a linha alheia (0 linhas afetadas, já garantido acima).
        if g["nome"].startswith("insert") or g["nome"] == "promover papel":
            assert g["erro"], f"{rotulo}: '{g['nome']}' não foi recusado pelo banco"
    print(f"[{rotulo}] {len(gravacoes)} gravações em nome de outro usuário recusadas ✔")

    # ---- 3. Server functions ignoram dono forjado ----
    forjado = await page.evaluate(SCRIPT_FORJAR_DONO, {"outro": OUTRO})
    assert forjado["donos"] in ([], [meu_id]), (
        f"{rotulo}: diário gravado para {forjado['donos']} em vez de {meu_id}"
    )
    assert forjado["linhasDoOutro"] == 0, f"{rotulo}: diário forjado apareceu para o outro usuário"
    assert forjado["progressoAlheio"] == 0, f"{rotulo}: progresso gravado para outro usuário"
    assert forjado["perfilAlheio"] == 0, f"{rotulo}: meta semanal alterada em perfil alheio"
    print(f"[{rotulo}] server functions derivam o dono do token, não do payload ✔")

    # ---- 4. Mídia privada ----
    midia = await page.evaluate(SCRIPT_MIDIA)
    assert midia["baixouBytes"] == 0, f"{rotulo}: baixou mídia sem liberação"
    assert midia["baixarErro"], f"{rotulo}: download de mídia não liberada não foi recusado"
    assert not midia["assinou"], f"{rotulo}: cliente conseguiu assinar URL de mídia direto no bucket"
    assert midia["listou"] == 0, f"{rotulo}: bucket privado listou objetos para o app"
    print(f"[{rotulo}] bucket privado de mídias fechado ao cliente ✔")

    # ---- 5. Telas ----
    await page.goto(f"{BASE_URL}/app/diario", wait_until="networkidle")
    tela = await page.evaluate(SCRIPT_TELA_DIARIO)
    if not ve_clientes:
        assert tela["alheias"] == 0, f"{rotulo}: tela do diário recebeu {tela['alheias']} entradas alheias"
    await page.goto(f"{BASE_URL}/app/progresso", wait_until="networkidle")
    assert "/auth" not in page.url, f"{rotulo}: sessão legítima expulsa de /app/progresso"

    await page.goto(f"{BASE_URL}/admin", wait_until="networkidle")
    if pode_administrar:
        assert "/auth" not in page.url, f"{rotulo}: admin legítimo expulso de /admin"
    else:
        for _ in range(20):
            if "/admin" not in page.url:
                break
            await page.wait_for_timeout(500)
        assert "/admin" not in page.url, f"{rotulo}: conta sem acesso permaneceu em /admin"
    print(f"[{rotulo}] telas coerentes com o papel ✔")
    await page.screenshot(path=str(SCREENSHOTS / f"isolamento_{rotulo}.png"))


async def main() -> None:
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)

        # ---- Sem sessão: nada de dados ----
        ctx0 = await browser.new_context(viewport={"width": 1280, "height": 1800})
        p0 = await ctx0.new_page()
        await p0.goto(BASE_URL, wait_until="domcontentloaded")
        leituras = await p0.evaluate(SCRIPT_LEITURAS, {"outro": OUTRO})
        for r in leituras:
            assert r["linhas"] == 0, f"sem sessão: {r['tabela']} devolveu dados"
        gravacoes = await p0.evaluate(SCRIPT_GRAVACOES, {"outro": OUTRO})
        for g in gravacoes:
            assert g["linhas"] == 0, f"sem sessão: '{g['nome']}' gravou dados"
        await p0.goto(f"{BASE_URL}/app/diario", wait_until="networkidle")
        assert "/auth" in page_url(p0), "sem sessão: /app/diario não redirecionou para /auth"
        print("sem sessão: Data API muda e telas redirecionam para /auth ✔")

        # ---- Sessão real injetada ----
        if session_json and storage_key:
            ctx1 = await browser.new_context(viewport={"width": 1280, "height": 1800})
            if cookies_json:
                cookies = json.loads(cookies_json)
                for c in cookies:
                    c["url"] = BASE_URL
                await ctx1.add_cookies(cookies)
            p1 = await ctx1.new_page()
            await p1.goto(BASE_URL, wait_until="domcontentloaded")
            await p1.evaluate(
                f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
            )
            await p1.reload(wait_until="networkidle")
            await rodar_cenarios(p1, "sessao-injetada")
        else:
            print("sem sessão injetada: cenário autenticado NÃO VERIFICADO")

        # ---- Conta cliente explícita (opcional) ----
        email = os.environ.get("E2E_EMAIL_CLIENTE")
        senha = os.environ.get("E2E_SENHA_CLIENTE")
        if email and senha:
            ctx2 = await browser.new_context(viewport={"width": 1280, "height": 1800})
            p2 = await ctx2.new_page()
            await p2.goto(BASE_URL, wait_until="networkidle")
            erro = await p2.evaluate(
                """async ({ email, senha }) => {
                    const m = await import('/src/integrations/supabase/client.ts');
                    const { error } = await m.supabase.auth.signInWithPassword({ email, password: senha });
                    return error ? error.message : null;
                }""",
                {"email": email, "senha": senha},
            )
            assert erro is None, f"login do cliente falhou: {erro}"
            await p2.reload(wait_until="networkidle")
            await rodar_cenarios(p2, "cliente")
        else:
            print(
                "conta cliente explícita NÃO VERIFICADA "
                "(informe E2E_EMAIL_CLIENTE/E2E_SENHA_CLIENTE)"
            )

        await browser.close()

    print("\nOK: nenhum endpoint ou tela entregou/aceitou dados de outro usuário.")


def page_url(page) -> str:
    return page.url


if __name__ == "__main__":
    asyncio.run(main())
