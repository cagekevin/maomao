'use strict';
/**
 * check-api-contract.cjs
 * API 契约双向静态校验 —— 前端「契约真源」apiRegistry ↔ 后端 router.ts 路由表的镜像错位防线。
 *
 * 背景（docs/26-API中转层连接优化-执行计划-2026-08-22.md §B1）：
 * 前端薄壳无中央端点登记表（PRD 缺口①），`BACKEND_ROUTES`/`API_ENDPOINTS` 实为字符串占位（缺口⑨）。
 * 本脚本把 `src/components/base/core/contracts.ts` 的 `apiRegistry`（唯一真源）与
 * `localTool/src/router.ts` 的 `routes` 表做程序化互检，防「前端调了后端没实现」的白实现、
 * 「前后端路径错位」的镜像漂移、「信封标注与 handler 形态不符」。
 *
 * 检查档位：
 *  - error（exit 1）：ACTIVE 端点后端无路由（白实现，运行必崩）｜ 方法与后端不符 ｜ 信封标注与可静态判定形态明显不符
 *                      ｜ ACTIVE 条目 fn 非「模块.符号[.符号]」形态（描述混入 fn，应拆 note 字段）｜
 *                      源码调用点真实存在但未登记（反向差集 D）
 *  - warn  （exit 1）：RESERVED 端点后端无路由（登记了却无对应实现）｜ ACTIVE 条目 fn 指向的模块无该导出（幽灵 ACTIVE，R5）
 *  - info  （exit 0）：后端有路由但前端未登记（待补登记，含 RESERVED）；信封形态无法静态判定（交由测试兜底）；
 *                      RESERVED 条目 fn 指向的模块无该导出（保留待实现，R5）；fn 模块未映射/读取失败（R5，不脆断）；
 *                      源码调用点路径变量化无法静态解析（反向差集 D，如 localToolApi.request() 泛化 helper）
 *
 * 豁免：`stream`/`sse`/`raw`/`probe`/`stub` 类型端点跳过信封形态检查（其形态本非统一信封，见 T3.1 豁免清单）。
 * 信封形态的「权威校验」由 B0 冻结测试承担；本脚本的检测为登记面的一致性防线，判定不了就 info，不脆断误伤。
 *
 * R5 盲区收口（docs/103-api契约校验盲区与全量扫描-审计与演进-2026-09-04.md，2026-09-04 实施）：
 *  - 4.1 废除 MODULE_FILES 手工白名单 → 目录自动发现：base/api/*.ts 文件名 + 全仓 src 导出符号双索引
 *       （兼容模块名=文件名 与 模块名=导出符号 两种形态，如 backendLogStream / logger）。
 *  - 4.2 fn 数据形态清洗：ACTIVE 的 fn 禁止夹描述（不合 模块.符号[.符号] → error，描述放 registry 的 note 字段）；
 *       两层导出校验：模块.对象.方法 同时验 `export const 对象` 存在 且 对象字面量含该方法名。
 *  - 4.3 新增反向方向 D：静态扫全 src 的 httpRequest/httpPost/httpRequestLogged 模板字面量调用点，
 *       归一化 `${encodeURIComponent(x)}`→{x} 后与登记表求差；未登记 → error；任意 URL 下载 / 非 /api/ 前缀豁免；
 *       路径变量化 helper → info 显式标注（防黑盒）。
 *  - 4.4 登记 fn 对齐真实消费链：relayProxy 原语条目加 consumer 字段（generate.* 门面），原语 + 门面双查。
 *
 * 用法：
 *   node scripts/check-api-contract.cjs
 * 挂载：package.json 的 `check:api` + `prebuild`/`pretest` 钩子（T1.2 落点）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const CONTRACTS = path.join(ROOT, 'src/components/base/core/contracts.ts');
const ROUTER = path.join(ROOT, 'localTool/src/router.ts');
const ROUTES_DIR = path.join(ROOT, 'localTool/src/routes');

const RESULT = { error: [], warn: [], info: [] };
const add = (level, msg) => RESULT[level].push(msg);

// 豁免：流式/裸值/探针/桩 不参与信封形态检查
const EXEMPT = new Set(['stream', 'sse', 'raw', 'probe', 'stub']);
const VALID_ENVELOPES = new Set([...EXEMPT, 'ok', 'code-data', 'items', 'success-data']);

// ── R5：前端 fn 存在性校验（防幽灵 ACTIVE）──
// 【4.1 收口】废除 MODULE_FILES 手工白名单 → 目录自动发现：
//  - byName：模块名 = 文件名（base/api/*.ts 优先 + 全仓同名文件兜底），兼容 localToolApi/filesApi/generate/backendLogStream 等
//  - bySymbol：模块名 = 导出符号（兼容 useLocalToolStatus/logger 等「模块即导出」形态）
// 首命中优先 base/api 与先扫到的文件；同名/同符号冲突取先者（本项目模块名均为文件名级唯一）。
const API_DIR = 'src/components/base/api';
const EXPORT_RE = /(?:export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)\s*[=:])/g;

let _moduleIndex = null;
function buildModuleIndex() {
  if (_moduleIndex) return _moduleIndex;
  const byName = new Map();
  const bySymbol = new Map();
  const seed = (relFile) => {
    const base = relFile
      .split('/')
      .pop()
      .replace(/\.(ts|tsx)$/, '');
    if (!byName.has(base)) byName.set(base, relFile);
    let src;
    try {
      src = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
    } catch {
      return;
    }
    for (const m of src.matchAll(EXPORT_RE)) {
      const sym = m[1] || m[2];
      if (sym && !bySymbol.has(sym)) bySymbol.set(sym, relFile);
    }
  };
  // 1) base/api/*.ts 优先（薄入口真源，避免被同文件名的测试/别名抢占）
  if (fs.existsSync(path.join(ROOT, API_DIR))) {
    for (const name of fs.readdirSync(path.join(ROOT, API_DIR)).sort()) {
      if (/\.ts$/.test(name) && !/\.(test|spec)\./.test(name)) seed(`${API_DIR}/${name}`);
    }
  }
  // 2) 全仓 src 兜底（hooks/core/utils 等模块名=文件名的消费点）
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
        seed(path.relative(ROOT, full));
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  _moduleIndex = { byName, bySymbol };
  return _moduleIndex;
}

function resolveModuleFile(moduleName) {
  const { byName, bySymbol } = buildModuleIndex();
  return byName.get(moduleName) || bySymbol.get(moduleName) || null;
}

// 常量命名空间（引用的是契约常量而非前端函数，豁免，如 API_ENDPOINTS.fileThumbnail）
const NON_FN_MODULES = new Set(['API_ENDPOINTS']);

// 纯点链：模块.符号 / 模块.对象.方法 / 单符号模块（不含空格、括号、+ 等描述后缀）。
// 【4.2】ACTIVE 条目 fn 必须符合此形态，否则 error；RESERVED 占位描述仍豁免。
const FN_CHAIN_RE = /^[\w$]+(\.[\w$]+)*$/;

// 提取源码文件的导出符号集合（export function / export async function / export const）。
// 只覆盖「函数/常量引用」形态；re-export（export { x } from）与 export default 不在登记 fn 形态内，不提取。
function collectExports(src) {
  const out = new Set();
  for (const m of src.matchAll(EXPORT_RE)) out.add(m[1] || m[2]);
  return out;
}

// 提取 `export const 对象 = { ... }` 对象字面量的键集合（两层校验用）。
// 返回 null 表示未定位到该对象定义（无法静态判定 → 不脆断）；定位到则返回键集合。
function extractConstObjectKeys(src, name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*(?::\\s*[^{=]+?)?=\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  let depth = 0;
  const start = m.index + m[0].length - 1; // '{' 位置
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        const body = src.slice(start + 1, i);
        const keys = new Set();
        for (const k of body.matchAll(/(?:^|[\s,{;])(['"`])?([\w$]+)\1?\s*(?=:)/g)) keys.add(k[2]);
        return keys;
      }
    }
  }
  return null;
}

// 读取缓存（模块索引建过 + 单条校验各读一次 → 去重，防大文件重复 IO）
const fileCache = new Map();
function readFileCached(relFile) {
  if (!fileCache.has(relFile))
    fileCache.set(relFile, fs.readFileSync(path.join(ROOT, relFile), 'utf8'));
  return fileCache.get(relFile);
}

// 校验单条 fn 链：单符号（useLocalToolStatus）/ 模块.符号 / 模块.对象.方法 三层形态。
//  - fn 不合形态：ACTIVE → error（4.2，描述混入 fn 是豁免洞根源）；RESERVED 占位描述 → 豁免。
//  - 模块无该导出 → ACTIVE warn（幽灵）/ RESERVED info（保留待实现）——维持既有档位。
//  - 模块.对象.方法：同时验对象字面量含该方法（4.2 两层校验，防只验第一层）。
//  - entry.consumer（4.4）：登记原语 + 真实门面双查（如 relayProxy.* 配 generate.* 门面）。
function checkFnExists(entry, key) {
  const fn = entry.fn;
  if (!fn) return;
  const first = fn.split('.')[0];
  if (NON_FN_MODULES.has(first)) return; // 常量命名空间 → 豁免
  if (!FN_CHAIN_RE.test(fn)) {
    // 【4.2】ACTIVE 的 fn 夹描述/占位 = 豁免洞 → 升级为 error；描述应放 registry 的 note 字段
    if (entry.status === 'ACTIVE') {
      add(
        'error',
        `fn 形态非法: ${key} fn='${fn}'（ACTIVE 必须为 模块.符号[.符号]，描述请放 note 字段）`,
      );
    }
    return;
  }
  const parts = fn.split('.');
  const moduleName = parts[0];
  const relFile = resolveModuleFile(moduleName);
  if (!relFile) {
    add('info', `fn 模块未映射: ${fn}（自动发现未找到模块 ${moduleName}）`);
    return;
  }
  let src;
  try {
    src = readFileCached(relFile);
  } catch {
    add('info', `fn 模块读取失败: ${fn}（${relFile}）`);
    return;
  }
  const exported = collectExports(src);
  const symbol = parts.length === 1 ? parts[0] : parts[1];
  if (!exported.has(symbol)) {
    add(
      entry.status === 'ACTIVE' ? 'warn' : 'info',
      entry.status === 'ACTIVE'
        ? `幽灵ACTIVE: ${fn}（模块 ${moduleName} 无导出 ${symbol}）`
        : `fn缺失(保留待实现): ${fn}（模块 ${moduleName} 无导出 ${symbol}）`,
    );
    return;
  }
  // 两层：模块.对象.方法 → 对象字面量须含该方法名（防只验第一层，方法名拼错永不发现）
  if (parts.length >= 3) {
    const keys = extractConstObjectKeys(src, parts[1]);
    if (keys && !keys.has(parts[2])) {
      add(
        entry.status === 'ACTIVE' ? 'warn' : 'info',
        entry.status === 'ACTIVE'
          ? `幽灵ACTIVE: ${fn}（${moduleName} 导出 ${parts[1]} 对象但无方法 ${parts[2]}）`
          : `fn缺失(保留待实现): ${fn}（${moduleName} 导出 ${parts[1]} 对象但无方法 ${parts[2]}）`,
      );
    }
  }
  // 4.4 consumer 门面链双查（校验原语存在 ≠ 前端仍走门面）
  for (const c of entry.consumer || []) {
    if (!c || !FN_CHAIN_RE.test(c)) {
      add('info', `consumer 形态非法: ${key} consumer='${c}'`);
      continue;
    }
    const cp = c.split('.');
    const cFile = resolveModuleFile(cp[0]);
    if (!cFile) {
      add('info', `consumer 模块未映射: ${key} consumer=${c}`);
      continue;
    }
    let cSrc;
    try {
      cSrc = readFileCached(cFile);
    } catch {
      add('info', `consumer 模块读取失败: ${key} consumer=${c}`);
      continue;
    }
    const cExp = collectExports(cSrc);
    const cSym = cp.length === 1 ? cp[0] : cp[1];
    if (!cExp.has(cSym)) {
      add('warn', `consumer 缺失: ${key} consumer=${c}（模块 ${cp[0]} 无导出 ${cSym}）`);
    }
  }
}

// 登记 path 比较模板：{id} → {x}
const patternKey = (p) => (p || '').replace(/\{[A-Za-z_][\w]*\}/g, '{x}');

// ── 后端路由提取（正则静态，不依赖 tsc）──
function patternToTemplate(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (t[0] === "'") return t.slice(1, -1); // 精确字符串
  if (t[0] === '/') {
    // RegExp 字面量：取出首尾 / 之间的源文本并翻译成模板
    const body = t
      .slice(1, t.lastIndexOf('/'))
      .replace(/\\\//g, '/') // 转义斜杠还原
      .replace(/^\^/, '') // 去 ^ 锚
      .replace(/\$$/, '') // 去 $ 锚
      .replace(/\([^)]*\)/g, '{x}') // 捕获/非捕获组 → 通配段
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
  // 按「路由对象」为单位切块解析（支持单行/多行两种写法），而非逐行。
  // 旧实现逐行用不跨行的 `pattern:\s*(\S+?),?\s*handler:` 提取，对「method/pattern/handler
  // 分多行展开」的路由对象整条漏解析 → 误报「后端无路由」（白实现/RESERVED 假阳性，2026-09-06 修）。
  // 新实现：先按括号深度切出每个 `{ ... },` 对象文本，再在块内正则提取，单行多行均兼容。
  const routes = [];
  let i = 0;
  const body = m[1];
  while (i < body.length) {
    const ob = body.indexOf('{', i);
    if (ob === -1) break;
    // 从 { 匹配到配对的 }（深度跟踪，兼容嵌套/注释内的花括号）
    let depth = 0;
    let inStr = null;
    let inLineComment = false;
    let inBlockComment = false;
    let j = ob;
    for (; j < body.length; j++) {
      const ch = body[j];
      const nxt = body[j + 1];
      if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && nxt === '/') {
          inBlockComment = false;
          j++;
        }
        continue;
      }
      if (inStr) {
        if (ch === '\\') {
          j++;
          continue;
        }
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '/' && nxt === '/') {
        inLineComment = true;
        j++;
        continue;
      }
      if (ch === '/' && nxt === '*') {
        inBlockComment = true;
        j++;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') inStr = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    if (depth !== 0) break; // 括号不配对，终止（交给下一条防御）
    const block = body.slice(ob, j);
    i = j;
    // 跳过注释/空对象
    const method = (block.match(/method\s*:\s*'([^']+)'/) || [])[1];
    if (!method) continue;
    const hm = (block.match(/handler\s*:\s*([A-Za-z_$][\w$]*)/) || [])[1];
    routes.push({
      method,
      template: patternToTemplate(extractPatternLiteral(block)),
      handler: hm || null,
      isCatchAll: /catchAll\s*:\s*true/.test(block),
    });
  }
  return routes;
}

/** 在路由对象文本内提取 `pattern: <值>` 的原始字面量文本（含引号/正则闭合符），
 * 供 patternToTemplate 归一。支持 'str' / "str" / /regex/ 三种，容忍跨行与转义斜杠。 */
function extractPatternLiteral(block) {
  const pm = block.match(/pattern\s*:\s*(\/|'|")/);
  if (!pm) return null;
  const quote = pm[1];
  const start = pm.index + pm[0].length - 1; // 值起始（含引号或 /）
  if (quote !== '/') {
    // 字符串字面量：读到配对引号（容忍转义）
    let end = start + 1;
    for (; end < block.length; end++) {
      const ch = block[end];
      if (ch === '\\') {
        end++;
        continue;
      }
      if (ch === quote) {
        end++;
        break;
      }
    }
    return block.slice(start, end);
  }
  // 正则字面量：从起始 / 读到真正闭合的 /（跳过转义 \/ 与字符类 [^/] 内的 /）
  let inClass = false;
  let end = start + 1;
  for (; end < block.length; end++) {
    const ch = block[end];
    if (ch === '\\') {
      end++;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      end++;
      break;
    }
  }
  return block.slice(start, end);
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
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
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
  ok: ['ok'],
  'code-data': ['code-data'],
  items: ['items'],
  'success-data': ['success-data'],
};

function checkEnvelope(entry, found, texts) {
  if (EXEMPT.has(entry.envelope)) return; // 豁免类型跳过信封形态
  const accept = ACCEPT_SHAPE_OF_ENVELOPE[entry.envelope];
  if (!accept) return; // 非法 envelope 已在上游报错
  const srcFile = findHandlerSource(found.handler, texts);
  if (!srcFile) {
    add('info', `信封形态待核对: ${entry.fn}（未定位 handler ${found.handler}）`);
    return;
  }
  const shapes = detectShapes(texts.get(srcFile), found.handler);
  if (shapes.has('unknown')) {
    add(
      'info',
      `信封形态无法静态判定(交由测试兜底): ${entry.fn} @ ${path.relative(ROOT, srcFile)}`,
    );
    return;
  }
  if (![...shapes].some((s) => accept.includes(s))) {
    add(
      'error',
      `信封标注不符: ${entry.fn} 标=${entry.envelope}，后端 ${found.handler} 检测=[${[...shapes].join(',')}]`,
    );
  }
}

// ── 反向方向 D（4.3）：源码调用点 → 登记表差集 ──
// 静态提取全 src 中 httpRequest/httpPost/httpRequestLogged 的【模板字面量】一参，
// 归一化 `${encodeURIComponent(x)}`→{x} 后与登记表 path 求差：
//  - 命中登记 → 计数（matched）
//  - 非 `/api/` 前缀 / 任意 URL 下载 → 豁免（exempt，非 localTool 业务端点）
//  - 路径来自变量（如 localToolApi.request() 的 `${API_BASE}${path}`）→ info 显式标注（unresolved，防黑盒）
//  - 未登记 → error（unresolved 之外的真漂移：新增端点漏登记）
// 局限：非字面量一参（变量 URL）的调用点静态不可见；该侧由登记 fn 存在性校验兜底。
const CALL_RE = /(?:\bhttpRequest\b|\bhttpPost\b|\bhttpRequestLogged\b)\s*\(\s*`([^`]*)`/g;

function scanFrontendCallSites(registry) {
  // 登记 path 索引（patternKey 归一 {frontTaskId}→{x}）
  const paths = new Map();
  for (const [k, e] of Object.entries(registry)) {
    const pk = patternKey(e.path);
    if (!paths.has(pk)) paths.set(pk, k);
  }
  const stat = { matched: 0, exempt: 0, unresolved: 0 };
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
        files.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'src'));

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(CALL_RE)) {
      const callFn = /\bhttpPost\b/.test(m[0])
        ? 'httpPost'
        : /\bhttpRequestLogged\b/.test(m[0])
          ? 'httpRequestLogged'
          : 'httpRequest';
      // 模板归一：${...}（含 encodeURIComponent(x)）→ {x}
      const t = m[1].replace(/\$\{[^}]*\}/g, '{x}');
      const rel = path.relative(ROOT, f);
      // 非 API_BASE 业务端点：任意 URL 下载 / 变量化路径 helper
      if (!t.startsWith('{x}/')) {
        if (t.startsWith('{x}{') || t === '{x}') {
          stat.unresolved++;
          add(
            'info',
            `调用点路径变量化无法静态解析: ${callFn} 于 ${rel}（模板 ${JSON.stringify(t)}，若为业务端点请登记）`,
          );
        } else {
          stat.exempt++; // 任意 URL 下载（非 API_BASE 前缀）
        }
        continue;
      }
      let p = t.slice('{x}'.length); // 剥 API_BASE
      const qi = p.indexOf('?');
      if (qi >= 0) p = p.slice(0, qi); // 剥 query（登记表不含 query）
      p = p.replace(/\/+$/, '');
      // 非 /api/ 前缀（/files/ 等资源服务）→ 豁免
      if (!p.startsWith('/api/')) {
        stat.exempt++;
        continue;
      }
      if (paths.has(patternKey(p))) {
        stat.matched++;
        continue;
      }
      // 真漂移：源码真实调用但未登记 → error
      add(
        'error',
        `源码调用点未登记: ${callFn} ${p}（${rel}）——新端点须在 contracts.ts apiRegistry 登记`,
      );
    }
  }
  return stat;
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
    } else {
      let found = samePath.find((r) => r.method === entry.method || entry.method === '*');
      const methodMismatch = !found;
      found = found || samePath[0];
      matchedBackend.add(found);
      if (methodMismatch) {
        const backendMethods = [...new Set(samePath.map((r) => r.method))].join('/');
        add(
          'error',
          `方法不一致: ${key} ${entry.path} 前端=${entry.method}，后端仅=${backendMethods}`,
        );
      }
      checkEnvelope(entry, found, texts);
    }
    // R5 fn 校验与后端路由解耦（修 docs/103 盲区⑤：后端无路由时不得跳过 fn 校验，避免只报前半段）
    checkFnExists(entry, key);
  }

  // 2) 反向方向 D：源码调用点 → 登记表差集（4.3，先于「后端有前端未登记」输出，error 并入 RESULT）
  const reverse = scanFrontendCallSites(registry);

  // 3) 后端有、前端未登记 → info（待补登记）
  for (const r of concrete) {
    if (matchedBackend.has(r)) continue;
    add('info', `后端有、前端未登记: [${r.method}] ${r.template} handler=${r.handler}`);
  }

  // 4) 输出
  const pad = (s, n) => s.toUpperCase().padEnd(n);
  console.log(
    `\napiRegistry 登记 ${Object.keys(registry).length} 条；解析后端路由 ${backendRoutes.length} 条（catch-all ${backendRoutes.length - concrete.length} 条豁免）`,
  );
  console.log(
    `[reverse] 源码调用点扫描：${reverse.matched} 命中登记 / ${reverse.exempt} 豁免(任意URL/非业务) / ${reverse.unresolved} 无法静态解析 / ${reverse.matched + reverse.exempt + reverse.unresolved} 处字面量调用`,
  );
  for (const level of ['error', 'warn', 'info']) {
    if (RESULT[level].length) {
      console.log(`\n[${level}] ${RESULT[level].length} 项`);
      RESULT[level].forEach((m) => console.log(`  ${pad(level, 5)} ${m}`));
    }
  }
  const fail = RESULT.error.length + RESULT.warn.length;
  if (fail > 0) {
    console.error(
      `\nAPI 契约校验未通过：error ${RESULT.error.length} / warn ${RESULT.warn.length} / info ${RESULT.info.length} ✖`,
    );
    process.exit(1);
  }
  console.log(`\nAPI 契约校验通过 ✔（error 0 / warn 0 / info ${RESULT.info.length}）`);
  process.exit(0);
}

main();
