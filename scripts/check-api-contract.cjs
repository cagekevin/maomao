'use strict';
/**
 * check-api-contract.cjs
 * API 契约双向静态校验 —— 前端「契约真源」apiRegistry ↔ 后端 router.ts 路由表的镜像错位防线。
 *
 * 背景（docs/26-API中转层连接优化-执行计划-2026-08-22.md §B1）：
 * 前端薄壳无中央端点登记表（PRD 缺口①），`BACKEND_ROUTES`/`API_ENDPOINTS` 实为字符串占位（缺口⑨）。
 * 本脚本把 `src/components/base/contracts.ts` 的 `apiRegistry`（唯一真源）与
 * `localTool/src/router.ts` 的 `routes` 表做程序化互检，防「前端调了后端没实现」的白实现、
 * 「前后端路径错位」的镜像漂移、「信封标注与 handler 形态不符」。
 *
 * 检查档位：
 *  - error（exit 1）：ACTIVE 端点后端无路由（白实现，运行必崩）｜ 方法与后端不符 ｜ 信封标注与可静态判定形态明显不符
 *  - warn  （exit 1）：RESERVED 端点后端无路由（登记了却无对应实现）｜ ACTIVE 条目 fn 指向的模块无该导出（幽灵 ACTIVE，R5）
 *  - info  （exit 0）：后端有路由但前端未登记（待补登记，含 RESERVED）；信封形态无法静态判定（交由测试兜底）；
 *                      RESERVED 条目 fn 指向的模块无该导出（保留待实现，R5）；fn 模块未映射/读取失败（R5，不脆断）
 *
 * 豁免：`stream`/`sse`/`raw`/`probe`/`stub` 类型端点跳过信封形态检查（其形态本非统一信封，见 T3.1 豁免清单）。
 * 信封形态的「权威校验」由 B0 冻结测试承担；本脚本的检测为登记面的一致性防线，判定不了就 info，不脆断误伤。
 *
 * 用法：
 *   node scripts/check-api-contract.cjs
 * 挂载：package.json 的 `check:api` + `prebuild`/`pretest` 钩子（T1.2 落点）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const CONTRACTS = path.join(ROOT, 'src/components/base/contracts.ts');
const ROUTER = path.join(ROOT, 'localTool/src/router.ts');
const ROUTES_DIR = path.join(ROOT, 'localTool/src/routes');

const RESULT = { error: [], warn: [], info: [] };
const add = (level, msg) => RESULT[level].push(msg);

// 豁免：流式/裸值/探针/桩 不参与信封形态检查
const EXEMPT = new Set(['stream', 'sse', 'raw', 'probe', 'stub']);
const VALID_ENVELOPES = new Set([...EXEMPT, 'ok', 'code-data', 'items', 'success-data']);

// ── R5：前端 fn 存在性校验（防幽灵 ACTIVE）──
// 只校验「形如 模块.符号 或 模块.对象.方法」（无空格/括号/+）的 fn，其余占位/描述一律豁免（保守，避免误伤）。
const MODULE_FILES = {
  localToolApi: 'src/components/base/api/localToolApi.ts',
  filesApi: 'src/components/base/api/filesApi.ts',
  pollTask: 'src/components/base/api/pollTask.ts',
  proxyGenerate: 'src/components/base/api/proxyGenerate.ts',
  agentRuntime: 'src/components/agent/runtime/agentRuntime.js',
};

// 常量命名空间（引用的是契约常量而非前端函数，豁免，如 API_ENDPOINTS.fileThumbnail）
const NON_FN_MODULES = new Set(['API_ENDPOINTS']);

// 纯点链：模块.符号 / 模块.对象.方法（不含空格、括号、+ 等描述后缀）
const FN_CHAIN_RE = /^[\w$]+(\.[\w$]+)+$/;
const EXPORT_RE = /(?:export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*[=:])/g;

// 登记 path 比较模板：{id} → {x}
const patternKey = (p) => (p || '').replace(/\{[A-Za-z_][\w]*\}/g, '{x}');

// ── 后端路由提取（正则静态，不依赖 tsc）──
function patternToTemplate(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (t[0] === "'") return t.slice(1, -1); // 精确字符串
  if (t[0] === '/') {
    // RegExp 字面量：取出首尾 / 之间的源文本并翻译成模板
    const body = t.slice(1, t.lastIndexOf('/'))
      .replace(/\\\//g, '/')          // 转义斜杠还原
      .replace(/^\^/, '')             // 去 ^ 锚
      .replace(/\$$/, '')             // 去 $ 锚
      .replace(/\([^)]*\)/g, '{x}')   // 捕获/非捕获组 → 通配段
      .replace(/\[[^\]]*\]/g, '{x}'); // 字符类 [^/]+ → 通配段
    return body;
  }
  return null;
}
// 模板逐段匹配：{x} 通配任意单个 pathname 段；registry 多余段必须全为通配才接受（前缀型 startsWith 路由）
function templatesMatch(backendTemplate, registryTemplate) {
  if (!backendTemplate || !registryTemplate) return false;
  const b = backendTemplate.split('/');
  const r = registryTemplate.split('/');
  if (b.length > r.length) return false;
  for (let i = 0; i < b.length; i++) {
    if (r[i] === '{x}') continue;
    if (b[i] !== r[i]) return false;
  }
  for (let i = b.length; i < r.length; i++) {
    if (r[i] !== '{x}') return false;
  }
  return true;
}

function extractBackendRoutes() {
  const src = fs.readFileSync(ROUTER, 'utf8');
  const m = src.match(/export\s+const\s+routes[\s\S]*?=\s*\[([\s\S]*?)\n\];/);
  if (!m) throw new Error('未能在 router.ts 定位 `export const routes = [...]`');
  const routes = [];
  for (const line of m[1].split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
    const method = (line.match(/method:\s*'([^']+)'/) || [])[1];
    if (!method) continue;
    const pm = (line.match(/pattern:\s*(\S+?),?\s*handler:/) || [])[1];
    const hm = (line.match(/handler:\s*([A-Za-z_$][\w$]*)/) || [])[1];
    routes.push({
      method,
      template: patternToTemplate(pm),
      handler: hm || null,
      isCatchAll: /catchAll\s*:\s*true/.test(line),
    });
  }
  return routes;
}

// ── 信封形态检测（读 handler 函数体，宽松扫描响应字面量）──
function loadHandlerTexts() {
  const map = new Map();
  if (fs.existsSync(ROUTES_DIR)) {
    for (const name of fs.readdirSync(ROUTES_DIR)) {
      if (!/\.(?:js|ts)$/.test(name)) continue;
      map.set(path.join(ROUTES_DIR, name), fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8'));
    }
  }
  map.set(ROUTER, fs.readFileSync(ROUTER, 'utf8')); // router.ts 内的闭包 handler
  return map;
}

function findHandlerSource(handlerName, texts) {
  if (!handlerName) return null;
  // 兼容 TS 类型注解：`const foo: Handler = (…)` / `const foo = (…)` / `function foo(…)`
  for (const [full, src] of texts) {
    const re = new RegExp(
      `(?:function\\s+${handlerName}\\s*\\(` +
      `|const\\s+${handlerName}\\s*(?::\\s*[A-Za-z_$][\\w$<>, ]*)?\\s*=\\s*(?:\\(|async)` +
      `|\\b${handlerName}\\s*=\\s*(?:\\(|async))`,
    );
    if (re.test(src)) return full;
  }
  return null;
}

function extractFunctionBody(src, name) {
  const re = new RegExp(
    `(?:function\\s+${name}\\s*\\([^)]*\\)|const\\s+${name}\\s*(?::\\s*[A-Za-z_$][\\w$<>, ]*)?\\s*=\\s*\\(?[^;{]*=>|\\b${name}\\s*=\\s*\\(?[^;{]*=>)[\\s\\S]*?\\{`,
  );
  const m = src.match(re);
  if (!m) return null;
  let depth = 0;
  const open = m.index + m[0].length - 1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return null;
}

// 返回 handler 响应信封的命中形状集合；空集合+unknown 表示无法静态判定
function detectShapes(src, name) {
  const body = extractFunctionBody(src, name);
  if (!body) return new Set(['unknown']);
  const out = new Set();
  if (/\bsuccess\s*:\s*true/.test(body) && /\bdata\s*:/.test(body)) out.add('success-data');
  if (/\bcode\s*:\s*0\b/.test(body) && /\bdata\s*:/.test(body)) out.add('code-data');
  if (/json\s*\(\s*res\s*,\s*\{\s*ok\s*:/.test(body)) out.add('ok');
  if (/json\s*\(\s*res\s*,\s*\{\s*items\s*:/.test(body)) out.add('items');
  if (out.size === 0) out.add('unknown');
  return out;
}

// expectShape：按登记 envelope 判定「命中形状集合里是否存在接受形态」
const ACCEPT_SHAPE_OF_ENVELOPE = {
  'ok':            ['ok'],
  'code-data':     ['code-data'],
  'items':         ['items'],
  'success-data':  ['success-data'],
};

function checkEnvelope(entry, found, texts) {
  if (EXEMPT.has(entry.envelope)) return; // 豁免类型跳过信封形态
  const accept = ACCEPT_SHAPE_OF_ENVELOPE[entry.envelope];
  if (!accept) return; // 非法 envelope 已在上游报错
  const srcFile = findHandlerSource(found.handler, texts);
  if (!srcFile) { add('info', `信封形态待核对: ${entry.fn}（未定位 handler ${found.handler}）`); return; }
  const shapes = detectShapes(texts.get(srcFile), found.handler);
  if (shapes.has('unknown')) {
    add('info', `信封形态无法静态判定(交由测试兜底): ${entry.fn} @ ${path.relative(ROOT, srcFile)}`);
    return;
  }
  if (![...shapes].some((s) => accept.includes(s))) {
    add('error', `信封标注不符: ${entry.fn} 标=${entry.envelope}，后端 ${found.handler} 检测=[${[...shapes].join(',')}]`);
  }
}

// ── R5：前端 fn 存在性校验 ──
// 静态提取模块文件的导出符号（export function / export async function / export const），
// 只覆盖「函数引用」形态；re-export（export { x } from …）与 export default 不在登记 fn 形态内，不提取。
function extractExports(filePath) {
  const out = new Set();
  const src = fs.readFileSync(filePath, 'utf8');
  for (const m of src.matchAll(EXPORT_RE)) out.add(m[1] || m[2]);
  return out;
}

// 校验单条登记：fn 必须是「模块.符号」链且模块真实导出该符号，否则报 warn（ACTIVE 幽灵）/ info（RESERVED 保留）。
// 占位/描述（含空格/括号/+、单符号、常量命名空间、`(前端零消费)` 等）一律豁免，不脆断误伤。
function checkFnExists(entry) {
  const fn = entry.fn;
  if (!fn || !FN_CHAIN_RE.test(fn)) return; // 空 / 占位描述 → 豁免
  const parts = fn.split('.');
  const moduleName = parts[0];
  if (NON_FN_MODULES.has(moduleName)) return; // 常量命名空间 → 豁免
  const relFile = MODULE_FILES[moduleName];
  if (!relFile) {
    add('info', `fn 模块未映射: ${fn}（需在 check-api-contract.cjs 的 MODULE_FILES 登记）`);
    return;
  }
  let exported;
  try {
    exported = extractExports(path.join(ROOT, relFile));
  } catch (e) {
    add('info', `fn 模块读取失败: ${fn}（${relFile}）`);
    return;
  }
  const symbol = parts[1];
  if (!exported.has(symbol)) {
    add(
      entry.status === 'ACTIVE' ? 'warn' : 'info',
      entry.status === 'ACTIVE'
        ? `幽灵ACTIVE: ${fn}（模块 ${moduleName} 无导出 ${symbol}）`
        : `fn缺失(保留待实现): ${fn}（模块 ${moduleName} 无导出 ${symbol}）`,
    );
  }
}

async function main() {
  let registry;
  try {
    const mod = await import(pathToFileURL(CONTRACTS).href);
    registry = mod.apiRegistry || {};
  } catch (e) {
    console.error('  ✖ 无法加载 contracts.ts apiRegistry：', e.message);
    process.exit(1);
  }
  const texts = loadHandlerTexts();

  let backendRoutes;
  try {
    backendRoutes = extractBackendRoutes();
  } catch (e) {
    console.error('  ✖ 无法解析后端路由表：', e.message);
    process.exit(1);
  }
  const concrete = backendRoutes.filter((r) => !r.isCatchAll);

  // 1) 前端登记 → 后端存在性 / 方法一致性 / 信封形态
  const matchedBackend = new Set();
  for (const [key, entry] of Object.entries(registry)) {
    if (!VALID_ENVELOPES.has(entry.envelope)) {
      add('error', `信封类型非法: ${key} envelope='${entry.envelope}'`);
      continue;
    }
    const rt = patternKey(entry.path);
    // 同一 path 可能存在多 method 路由（如 /api/providers GET/PUT）：优先按 method 精确匹配
    const samePath = concrete.filter((r) => templatesMatch(r.template, rt));
    if (!samePath.length) {
      if (entry.status === 'RESERVED') add('warn', `RESERVED 后端无路由: ${key} ${entry.path}`);
      else add('error', `白实现(前端有、后端无): ${key} fn=${entry.fn} path=${entry.path}`);
      continue;
    }
    let found = samePath.find((r) => r.method === entry.method || entry.method === '*');
    const methodMismatch = !found;
    found = found || samePath[0];
    matchedBackend.add(found);
    if (methodMismatch) {
      const backendMethods = [...new Set(samePath.map((r) => r.method))].join('/');
      add('error', `方法不一致: ${key} ${entry.path} 前端=${entry.method}，后端仅=${backendMethods}`);
    }
    checkEnvelope(entry, found, texts);
    checkFnExists(entry);
  }

  // 2) 后端有、前端未登记 → info（待补登记）
  for (const r of concrete) {
    if (matchedBackend.has(r)) continue;
    add('info', `后端有、前端未登记: [${r.method}] ${r.template} handler=${r.handler}`);
  }

  // 3) 输出
  const pad = (s, n) => s.toUpperCase().padEnd(n);
  console.log(`\napiRegistry 登记 ${Object.keys(registry).length} 条；解析后端路由 ${backendRoutes.length} 条（catch-all ${backendRoutes.length - concrete.length} 条豁免）`);
  for (const level of ['error', 'warn', 'info']) {
    if (RESULT[level].length) {
      console.log(`\n[${level}] ${RESULT[level].length} 项`);
      RESULT[level].forEach((m) => console.log(`  ${pad(level, 5)} ${m}`));
    }
  }
  const fail = RESULT.error.length + RESULT.warn.length;
  if (fail > 0) {
    console.error(`\nAPI 契约校验未通过：error ${RESULT.error.length} / warn ${RESULT.warn.length} / info ${RESULT.info.length} ✖`);
    process.exit(1);
  }
  console.log(`\nAPI 契约校验通过 ✔（error 0 / warn 0 / info ${RESULT.info.length}）`);
  process.exit(0);
}

main();