#!/usr/bin/env node
/**
 * Re-scan de segurança do projeto Raiz.
 *
 * Roda checagens estáticas (migrations SQL + código do app) e compara os
 * achados com a baseline em .github/security-baseline.json.
 * Novos achados => exit 1 (bloqueia o merge).
 *
 * Uso:
 *   node scripts/security-scan.mjs            # falha se houver novo finding
 *   node scripts/security-scan.mjs --update   # regrava a baseline
 *   node scripts/security-scan.mjs --json     # imprime achados em JSON
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.github/security-baseline.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const AS_JSON = args.includes('--json');

/** @type {{id:string,severity:'high'|'medium'|'low',rule:string,file:string,message:string}[]} */
const findings = [];

const fingerprint = (rule, file, detail) =>
  createHash('sha1').update(`${rule}|${file}|${detail}`).digest('hex').slice(0, 12);

function add(rule, severity, file, detail, message) {
  findings.push({
    id: fingerprint(rule, file, detail),
    rule,
    severity,
    file,
    message,
  });
}

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'coverage') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- SQL / RLS
const migrations = walk(join(ROOT, 'supabase/migrations'), ['.sql']).sort();
const sqlAll = migrations.map((f) => ({ file: relative(ROOT, f), sql: readFileSync(f, 'utf8') }));
const sqlJoined = sqlAll.map((m) => m.sql).join('\n');

const createdTables = new Set();
for (const { file, sql } of sqlAll) {
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)) {
    createdTables.add(m[1]);
    // guarda o arquivo onde foi criada para reportar melhor
    if (!createdTables.origem) createdTables.origem = new Map();
    createdTables.origem.set(m[1], file);
  }
}

for (const table of createdTables) {
  const file = createdTables.origem?.get(table) ?? 'supabase/migrations';
  const rlsRe = new RegExp(`alter\\s+table\\s+public\\.${table}[\\s\\S]{0,80}?enable\\s+row\\s+level\\s+security`, 'i');
  if (!rlsRe.test(sqlJoined)) {
    add('rls_missing', 'high', file, table, `Tabela public.${table} não habilita ROW LEVEL SECURITY.`);
  }
  const grantRe = new RegExp(`grant[\\s\\S]{0,120}?on\\s+(?:table\\s+)?public\\.${table}\\b`, 'i');
  if (!grantRe.test(sqlJoined)) {
    add('grant_missing', 'high', file, table, `Tabela public.${table} não possui GRANT para os papéis da Data API.`);
  }
  const policyRe = new RegExp(`create\\s+policy[\\s\\S]{0,200}?on\\s+public\\.${table}\\b`, 'i');
  if (!policyRe.test(sqlJoined)) {
    add('policy_missing', 'high', file, table, `Tabela public.${table} tem RLS sem nenhuma policy (acesso totalmente bloqueado ou esquecido).`);
  }
}

// SECURITY DEFINER sem search_path fixo
for (const { file, sql } of sqlAll) {
  const blocks = sql.split(/create\s+or\s+replace\s+function|create\s+function/i).slice(1);
  for (const block of blocks) {
    if (!/security\s+definer/i.test(block)) continue;
    const nome = block.match(/^\s*(?:public\.)?([a-z0-9_]+)/i)?.[1] ?? 'desconhecida';
    const head = block.split(/\$\$|\$function\$/)[0] ?? block;
    if (!/set\s+search_path/i.test(head)) {
      add('definer_search_path', 'high', file, nome, `Função SECURITY DEFINER ${nome}() sem "set search_path".`);
    }
  }
}

// ------------------------------------------------------- Código da aplicação
const codeFiles = walk(join(ROOT, 'src'), ['.ts', '.tsx']);
for (const full of codeFiles) {
  const file = relative(ROOT, full);
  const code = readFileSync(full, 'utf8');
  const isTest = /\.test\.(ts|tsx)$/.test(file);
  const isServer = /\.server\.(ts|tsx)$/.test(file) || file.startsWith('src/routes/api/');

  if (/SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(code) && !isServer && !isTest) {
    add('service_role_no_client', 'high', file, 'service_role', 'Chave service_role referenciada fora de código exclusivamente de servidor.');
  }
  if (/\bsupabaseAdmin\b/.test(code) && !isTest) {
    const moduleImport = /^import[^\n]*client\.server[^\n]*$/m.test(code);
    if (moduleImport && !isServer) {
      add('admin_client_module_scope', 'high', file, 'supabaseAdmin', 'Cliente admin importado no escopo do módulo (deve ser await import dentro do handler).');
    }
  }
  if (/(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})|sb_secret_[A-Za-z0-9_-]{10,}/.test(code)) {
    add('hardcoded_secret', 'high', file, 'token', 'Possível segredo/JWT embutido no código.');
  }
  if (/dangerouslySetInnerHTML/.test(code) && !isTest) {
    add('dangerous_html', 'medium', file, 'dangerouslySetInnerHTML', 'Uso de dangerouslySetInnerHTML — confirme sanitização.');
  }
  // server functions sensíveis sem guard de permissão
  if (/\.functions\.tsx?$/.test(file) && /createServerFn/.test(code)) {
    const temGuard = /garantirPermissao|requireSupabaseAuth|temPermissao/.test(code);
    if (!temGuard) {
      add('serverfn_sem_guard', 'medium', file, 'guard', 'Arquivo de server functions sem middleware de autenticação nem guard de permissão.');
    }
  }
}

// ------------------------------------------------------------------ baseline
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { findings: [] };
const conhecidos = new Set((baseline.findings ?? []).map((f) => f.id));
const novos = findings.filter((f) => !conhecidos.has(f.id));
const resolvidos = (baseline.findings ?? []).filter((f) => !findings.some((n) => n.id === f.id));

if (AS_JSON) {
  console.log(JSON.stringify({ findings, novos, resolvidos }, null, 2));
}

if (UPDATE) {
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ atualizadoEm: new Date().toISOString().slice(0, 10), findings }, null, 2)}\n`,
  );
  console.log(`Baseline atualizada com ${findings.length} achado(s).`);
  process.exit(0);
}

console.log(`Re-scan de segurança: ${findings.length} achado(s), ${conhecidos.size} na baseline.`);
if (resolvidos.length) {
  console.log(`\n${resolvidos.length} achado(s) da baseline não aparecem mais — rode "bun run security:baseline" para limpar.`);
}
if (!novos.length) {
  console.log('\nNenhum novo finding de segurança. Merge liberado.');
  process.exit(0);
}

console.error(`\n${novos.length} NOVO(S) finding(s) de segurança — merge bloqueado:\n`);
for (const f of novos) {
  console.error(`  [${f.severity.toUpperCase()}] ${f.rule} :: ${f.file}\n    ${f.message}\n    id: ${f.id}`);
}
console.error(
  '\nCorrija os itens acima. Se algum for aceito conscientemente, registre-o na baseline com "bun run security:baseline" e explique o motivo no PR.',
);
process.exit(1);
