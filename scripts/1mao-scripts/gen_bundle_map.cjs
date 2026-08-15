'use strict';
// 地图生成器：自动扫描 src/bundle/ 生成 BUNDLE_MAP.md（AI 检索入口）+ symbol_map.json（符号级索引）。
// 解决三层问题：① 文件名混淆看不懂（AI 靠特征反查落点）；② 改一处漏一处（反向索引 + 高危文件标记）；③ 短名/匿名组件不知道干嘛（符号级索引：混淆名 → 用途 → 落点 → 行号）。
// 用法：node scripts/gen_bundle_map.cjs   （或 npm run map）
// 不读 docs/逆向专用_ai 禁止读/，不依赖任何运行时包（用途推断用纯正则，借鉴 archived/tools/summarize.cjs 思路）。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle');
const OUT = path.join(BUNDLE, 'BUNDLE_MAP.md');

const REACT_HOOKS = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useLayoutEffect', 'useNavigate', 'useLocation', 'useParams', 'useSelector', 'useDispatch', 'useStore'];

function walk(dir, exts) {
  const out = [];
  const go = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = (d + '/' + e.name).replace(/\\/g, '/');
      if (e.isDirectory()) go(p);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  };
  go(dir);
  return out;
}

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function countLines(p) { return read(p).split('\n').length; }

// 顶层 chunk（*.js 直接位于 src/bundle/）
const topChunks = fs.readdirSync(BUNDLE)
  .filter((f) => f.endsWith('.js') && fs.statSync(path.join(BUNDLE, f)).isFile())
  .map((f) => ({ name: f, lines: countLines(path.join(BUNDLE, f)) }))
  .sort((a, b) => b.lines - a.lines);

// _components 目录
const compDirs = fs.readdirSync(BUNDLE)
  .filter((f) => f.endsWith('_components') && fs.statSync(path.join(BUNDLE, f)).isDirectory());

// 所有组件文件（+ 顶层 chunk 作为 dir='' 的特殊项纳入特征/反向索引）
const allCompFiles = [];
for (const d of compDirs) {
  for (const f of walk(path.join(BUNDLE, d), ['.jsx', '.js'])) {
    allCompFiles.push({ abs: f, rel: f.replace(BUNDLE + '/', ''), dir: d, lines: countLines(f), content: read(f) });
  }
}
// 顶层 chunk（不在 _components 内，但承载关键契约如 endpointConfig 的 18080/active_api_endpoint）
for (const tc of topChunks) {
  const abs = path.join(BUNDLE, tc.name);
  allCompFiles.push({ abs, rel: tc.name, dir: '', lines: tc.lines, content: read(abs) });
}

// 从 contracts.json 动态收集 KV 候选键（避免硬编码漏项）
let KV_CANDIDATES = [];
try {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/contracts.json'), 'utf8'));
  const set = new Set();
  for (const c of Object.values(dict.contracts)) {
    for (const p of c.patterns) {
      // 取字面量型模式里像 KV 键的（含下划线/连字符且非路径）
      if (p.type === 'fixed' && /^[a-zA-Z][a-zA-Z0-9_-]{3,}$/.test(p.value) && !p.value.includes('/')) set.add(p.value);
    }
  }
  KV_CANDIDATES = [...set];
} catch { KV_CANDIDATES = []; }

// 抽取单文件特征
function extractFeatures(file) {
  const c = file.content;
  const feats = { apis: new Set(), kvKeys: new Set(), hooks: new Set(), exports: new Set(), components: new Set(), importCount: 0 };
  // API 路径
  const apiRe = /\/api\/[a-zA-Z0-9_/-]+|\/v1\/[a-zA-Z0-9_/-]+|\/public\/[a-zA-Z0-9_/-]+|\/files\/[a-zA-Z0-9_/-]*|\/proxy[a-zA-Z0-9_/-]*/g;
  let m;
  while ((m = apiRe.exec(c))) feats.apis.add(m[0]);
  // KV 键（动态候选，命中即记）
  for (const k of KV_CANDIDATES) {
    if (c.includes(k)) feats.kvKeys.add(k);
  }
  // React hooks
  for (const h of REACT_HOOKS) {
    if (new RegExp('\\b' + h + '\\s*[\\(<]').test(c)) feats.hooks.add(h);
  }
  // 导出组件名 export function Xxx / export const Xxx = / export default function Xxx
  const expRe = /export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z0-9_$]+)/g;
  while ((m = expRe.exec(c))) feats.exports.add(m[1]);
  const defRe = /export\s+default\s+function\s+([A-Za-z0-9_]+)/g;
  while ((m = defRe.exec(c))) feats.components.add(m[1]);
  // 聚合导出 export { a, b, c }（混淆 barrel 模块，如 _cmp_xs）
  const aggRe = /export\s*\{([^}]+)\}/g;
  while ((m = aggRe.exec(c))) {
    const names = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean);
    for (const n of names.slice(0, 6)) feats.exports.add(n);
    feats._aggExport = true;
  }
  // 模块扇入（相对 import 数，粗略反映规模）
  const impRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]\.\.?\/[^'"]+['"]/g;
  feats.importCount = (c.match(impRe) || []).length;
  return feats;
}

// 顶层符号提取（函数/变量声明）+ 用途推断（纯正则，零依赖）
// 借鉴 archived/tools/summarize.cjs 的 inferPurpose 思路：从中文文案/hooks/API 调用/data 字段反推语义。
function extractSymbols(file) {
  const c = file.content;
  const lines = c.split('\n');
  const syms = [];
  const re = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)\s*(?:=|\(|\{)/gm;
  let m;
  while ((m = re.exec(c))) {
    const name = m[1];
    // 行号
    let line = 1;
    for (let i = 0; i <= m.index; i++) if (c[i] === '\n') line++;
    // 取该符号的源码片段（从声明起 ~40 行内，用于推断）
    const start = m.index;
    let end = c.indexOf('\n', start);
    let depth = 0, braceStart = -1, found = false;
    for (let i = start; i < c.length && i < start + 40000; i++) {
      if (c[i] === '{') { depth++; if (braceStart < 0) braceStart = i; }
      else if (c[i] === '}') { depth--; if (depth === 0 && braceStart >= 0) { end = i + 1; found = true; break; } }
    }
    if (!found) end = Math.min(c.length, start + 3000);
    const body = c.slice(start, end);
    syms.push({ name, line, body });
  }
  // 对每个符号推断用途
  for (const s of syms) s.role = inferSymbolRole(s.body, file);
  return syms;
}

// 推断单个符号/文件的用途（返回中文短标签）
function inferSymbolRole(body, file) {
  const clues = [];
  // 中文文案（UI 组件/面板）
  const cn = [...body.matchAll(/>([\u4e00-\u9fff][\u4e00-\u9fff\s，。！？、；：""''（）《》\-+]{1,})/g)].map((x) => x[1].trim());
  if (cn.length >= 2) clues.push('UI:' + [...new Set(cn)].slice(0, 4).join('|'));
  // hooks → 组件
  const hooks = [...new Set(body.match(/\b(use[A-Z]\w+)\s*[\(<]/g) || [])].map((h) => h.replace(/[\s(<]/g, ''));
  if (hooks.length) clues.push('hooks:' + hooks.slice(0, 6).join(','));
  // API 路径
  const apis = [...new Set(body.match(/\/api\/[a-zA-Z0-9_/-]+|\/v1\/[a-zA-Z0-9_/-]+|\/public\/[a-zA-Z0-9_/-]+|\/files\/[a-zA-Z0-9_/-]*/g) || [])];
  if (apis.length) clues.push('api:' + apis.slice(0, 4).join(','));
  // 契约键（local-tool / proxyMode 等）
  if (/\blocal-tool\b/.test(body)) clues.push('local-tool');
  if (/\bproxyMode\b/.test(body)) clues.push('proxyMode');
  // data 字段（区分"读/写节点数据"）
  const fields = [...new Set([...body.matchAll(/(?:data|n|t)\.([A-Za-z][A-Za-z0-9]{2,})/g)].map((x) => x[1]))].filter((f) => !['type', 'id', 'label', 'selected', 'expanded', 'loading', 'hasChanged', 'width', 'height'].includes(f));
  if (fields.length) clues.push('字段:' + fields.slice(0, 6).join(','));
  // fetch 调用
  if (/\bfetch\(/.test(body)) clues.push('fetch');
  // 事件发布
  if (/dispatchEvent|window\.postMessage/.test(body)) clues.push('派发事件');
  if (!clues.length) {
    // 无特征：可能是纯工具函数，标"无特征（工具/空壳）"
    if (body.trim().length < 200) return '短函数';
    return '';
  }
  return clues.join(' · ');
}

for (const f of allCompFiles) f.feats = extractFeatures(f);
for (const f of allCompFiles) f.symbols = extractSymbols(f);

// 反向索引：契约字符串 -> 文件
const REVERSE_KEYS = ['/api/proxy', '18080', '9004', '/public/platform', 'transitResources', 'active_api_endpoint', 'canvas-state-v1', 'proxyMode', 'local-tool', 'x-proxy-url'];
const reverseIndex = {};
for (const k of REVERSE_KEYS) {
  const files = [];
  for (const f of allCompFiles) {
    const n = f.content.split(k).length - 1;
    if (n > 0) files.push({ rel: f.rel, n });
  }
  reverseIndex[k] = files.sort((a, b) => b.n - a.n);
}

// 依赖图：统计每个文件被多少其他文件 import
const importCount = {};
const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
for (const f of allCompFiles) {
  let m;
  const seen = new Set();
  while ((m = importRe.exec(f.content))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // 只统计相对引用（同 bundle 内）
    const resolved = path.resolve(path.dirname(f.abs), spec).replace(/\\/g, '/');
    let rel = resolved.replace(BUNDLE + '/', '');
    if (!rel.endsWith('.js') && !rel.endsWith('.jsx')) rel += '.jsx';
    if (seen.has(rel)) continue;
    seen.add(rel);
    importCount[rel] = (importCount[rel] || 0) + 1;
  }
}
// 也统计顶层 chunk 作为 facade 指向的组件文件
for (const tc of topChunks) {
  const c = read(path.join(BUNDLE, tc.name));
  const re = /from\s+['"]\.\/([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(c))) {
    const rel = m[1].replace(/^\.\//, '');
    importCount[rel] = (importCount[rel] || 0) + 1;
  }
}

// ---- 生成 Markdown ----
const L = [];
L.push('# BUNDLE_MAP.md · src/bundle 逆向源码地图');
L.push('');
L.push('> 自动生成（scripts/gen_bundle_map.cjs）。AI 改 `src/bundle/` 前先读本图，按特征反查落点，避免"找不到/改漏"。');
L.push('> 文件名是混淆名（如 `H_.jsx` 12668 行），**不要凭文件名判断职责**，看「特征」列。');
L.push('> 配套：CONTRACTS.md（契约分布）+ scripts/contract_scan.cjs（漏改检测）。');
L.push('');
L.push('## 一、顶层 chunk 总表（14 个，均为 facade 或运行时垫片）');
L.push('');
L.push('| chunk | 行数 | 类型 | 说明 |');
L.push('|---|---|---|---|');
for (const tc of topChunks) {
  let type = 'facade', note = '';
  if (/vendor|runtime|shim|jsx_runtime|browser-external/.test(tc.name)) { type = '运行时'; note = '勿改（React 单实例/外链垫片）'; }
  else if (tc.name === 'endpointConfig-Bt85xi8d.js') { type = '逻辑'; note = '接入点/端口/18080 配置（契约 critical）'; }
  else if (tc.name === 'main-CYvt_zul.js') { type = '入口'; note = '应用入口'; }
  else if (tc.name === 'share-CyPsaet6.js') { type = '入口'; note = '分享页入口'; }
  else if (tc.name === 'mediabunny-mp3-encoder-CZeRAvEV.js') { type = '库'; note = 'MP3 编码器'; }
  else if (tc.name.startsWith('src-')) { type = 'facade'; note = '映射至同名 _components'; }
  else { note = '映射至同名 _components'; }
  L.push(`| \`${tc.name}\` | ${tc.lines} | ${type} | ${note} |`);
}
L.push('');
L.push('## 二、_components 目录规模');
L.push('');
L.push('| 目录 | 文件数 | 角色 |');
L.push('|---|---|---|');
const compRole = {
  'App-BX6o9fW5_components': '主应用（画布编辑器核心 UI/状态）',
  'httpClient-BknZwXjG_components': 'HTTP 客户端层（代理/请求/资源/转场，最大 141 文件）',
  'src-_qSScO88_components': '运行时模块',
  'src-kC58-PF2_components': '入口胶水',
};
for (const d of compDirs) {
  const n = allCompFiles.filter((f) => f.dir === d).length;
  L.push(`| \`${d}/\` | ${n} | ${compRole[d] || '—'} |`);
}
L.push('');
L.push('## 三、大文件索引（>500 行，按特征反查）');
L.push('');
L.push('> 这些文件 AI 最可能要进。特征列从代码自动抽取：用到哪些 API 路径、KV 键、React hooks、导出组件。');
L.push('');
L.push('| 文件 | 行数 | API 路径 | KV 键 | Hooks | 导出组件 |');
L.push('|---|---|---|---|---|---|');
const big = allCompFiles.filter((f) => f.lines > 500).sort((a, b) => b.lines - a.lines);
for (const f of big) {
  const ft = f.feats;
  // 聚合导出模块（混淆 barrel）标注角色，避免 AI 误当业务大文件
  const roleTag = ft._aggExport ? ' 📦聚合导出' : '';
  const expShow = ([...ft.components, ...ft.exports].slice(0, 4).join(' ') || '—') + roleTag;
  L.push(`| \`${f.rel}\` | ${f.lines} | ${([...ft.apis].slice(0, 5).join(' ') || '—')} | ${([...ft.kvKeys].join(' ') || '—')} | ${([...ft.hooks].slice(0, 4).join(' ') || '—')} | ${expShow} |`);
}
L.push('');
L.push('## 四、反向索引（契约字符串 → 在哪改）');
L.push('');
L.push('> 改某个契约前，先看右边列确认要动几个文件。完整分布见 CONTRACTS.md。');
L.push('');
L.push('| 契约字符串 | 命中文件数 | 文件（按命中次数降序） |');
L.push('|---|---|---|');
for (const k of REVERSE_KEYS) {
  const fs2 = reverseIndex[k];
  if (!fs2.length) {
    // 区分「契约存在但 bundle 内无字面量」（如 9004 经变量拼接、x-proxy-url 在 localTool）与真遗漏
    const note = { '9004': 'bundle 内无字面量（前端经变量拼接，见 contracts.json scope=localTool/apimart）', 'x-proxy-url': 'bundle 内无字面量（上游头，见 contracts.json scope=localTool）' }[k] || 'bundle 内未命中，确认是否只在 localTool/apimart 端';
    L.push(`| \`${k}\` | 0 | ⚠ ${note} |`);
    continue;
  }
  const detail = fs2.slice(0, 12).map((x) => `${x.rel}(${x.n})`).join(' · ');
  L.push(`| \`${k}\` | ${fs2.length} | ${detail} |`);
}
L.push('');
L.push('## 五、高危文件（被大量 import，改它影响面最大）');
L.push('');
L.push('> 这些文件是「改一处漏一处」重灾区。改前务必全文 grep 确认所有引用方，改后跑 `npm run contracts` + `npm run build`。');
L.push('');
L.push('| 文件 | 被引用次数 |');
L.push('|---|---|');
const topDeps = Object.entries(importCount).filter(([k]) => k.includes('_components')).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [f, n] of topDeps) L.push(`| \`${f}\` | ${n} |`);
L.push('');
L.push('## 六、同名影子文件警示（重要）');
L.push('');
// 6.1 src/bundle/ 内部跨目录同名文件（真·影子文件：AI 改一个极易漏另一个）
const byBase = {};
for (const f of allCompFiles) {
  if (!f.dir) continue; // 顶层 chunk 不参与同名比对
  const base = f.rel.split('/').pop();
  (byBase[base] = byBase[base] || []).push(f.rel);
}
const shadow = Object.entries(byBase).filter(([, arr]) => arr.length > 1).sort((a, b) => b[1].length - a[1].length);
if (shadow.length) {
  L.push('> ⚠ **`src/bundle/` 内部同名影子文件**：以下文件名在多个 `_components` 目录中重复出现，是「改一处漏一处」最高危陷阱。改其中之一前，必须逐个确认所有同名文件是否要同步改，改完跑 `npm run contracts` + `npm run build`。');
  L.push('');
  L.push('| 同名文件 | 出现目录数 | 落点（按目录） |');
  L.push('|---|---|---|');
  for (const [base, arr] of shadow) {
    const dirs = [...new Set(arr.map((r) => r.split('/')[0]))].join(' · ');
    L.push(`| \`${base}\` | ${arr.length} | ${dirs} |`);
  }
  L.push('');
} else {
  L.push('- `src/bundle/` 内部暂未发现跨目录同名影子文件。');
  L.push('');
}
L.push('- `public/assets/*.js` 是 1.4.0 时期遗留的**死副本**（12 个 JS 已于 2026-08-02 删除），被 build 产物覆盖不生效。grep 该路径若再现，是缓存/未清理产物，勿改。');
L.push('- `public/assets/*.css`（src-DoQUrSOl.css / httpClient-DFxwm5B3.css / vendor-Qkhkn02K.css）是**活文件**，Vite 不产出，由 post-build-fixups 补引用，保留勿删。');
L.push('- `dist/` 是构建产物，运行时只读它；改前端一律改 `src/bundle/` 后 `npm run build` 回灌（见 CLAUDE.md §四.2/§四.5）。');
L.push('');

// 第八章：功能域速查（AI「改某功能该看哪」的入口，基于特征自动归类）
const DOMAINS = [
  { name: '应用入口 / 启动', match: (f) => /main-CYvt_zul|App-BX6o9fW5\.js|share-CyPsaet6|src-kC58-PF2/.test(f.rel) },
  { name: '接入点 / 端口 / 代理配置', match: (f) => /endpointConfig|proxyMode|local-tool|18080|x-proxy-url|\/api\/proxy/.test(f.content) },
  { name: 'HTTP 客户端 / 代理转发层', match: (f) => /httpClient-BknZwXjG/.test(f.dir) && /proxyMode|local-tool|\/api\/proxy|x-proxy-url|9004/.test(f.content) },
  { name: '画布编辑器核心 UI / 状态', match: (f) => /App-BX6o9fW5_components/.test(f.dir) && (f.feats.hooks.size > 0) },
  { name: '资源 / 文件上传', match: (f) => /\/api\/assets\/upload|\/api\/files|\/files\/resources|upload/.test(f.content) },
  { name: '任务 / 工作流管理', match: (f) => /\/api\/tasks|\/v1\/gateway\/task|\/api\/workflow|task\/save|batch-save/.test(f.content) },
  { name: '分享页（ShareAppPage）', match: (f) => /ShareAppPage|share-CyPsaet6|share\//.test(f.rel) },
  { name: 'AI 对话 / 绘图接口', match: (f) => /\/v1\/chat\/completions|\/v1\/draw\/completions|\/v1\/images\/generations|\/v1\/images\/edits/.test(f.content) },
  { name: '视频生成', match: (f) => /\/v1\/video\/generations|\/v1\/videos/.test(f.content) },
];
L.push('## 七、功能域速查（改某功能先看哪）');
L.push('');
L.push('> 基于文件特征（API 路径 / 契约字符串 / 目录）自动归类，供 AI 定位「我要改 X 功能该进哪个文件」。同一文件可能命中多域。');
L.push('');
for (const dom of DOMAINS) {
  const hits = allCompFiles.filter((f) => dom.match(f)).sort((a, b) => b.lines - a.lines).slice(0, 8);
  if (!hits.length) continue;
  L.push(`### ${dom.name}`);
  L.push('');
  L.push('| 文件 | 行数 | 关键特征 |');
  L.push('|---|---|---|');
  for (const f of hits) {
    const sig = [...f.feats.apis].slice(0, 2).join(' ');
    L.push(`| \`${f.rel}\` | ${f.lines} | ${sig || (f.content.includes('proxyMode') ? 'proxyMode 配置' : '—')} |`);
  }
  L.push('');
}

// ---- 符号级索引（第八章，AI 按功能反查符号+落点）----
// 生成 symbol_map.json（全局符号 → 文件/行号/用途/被引用数），并在 BUNDLE_MAP.md 内嵌高价值符号表。
const SYMBOL_MAP = {};
for (const f of allCompFiles) {
  for (const s of f.symbols) {
    // 去重：同名符号可能跨文件（同名影子），统一存数组
    const key = s.name;
    (SYMBOL_MAP[key] = SYMBOL_MAP[key] || []).push({
      file: f.rel,
      line: s.line,
      role: s.role,
      apis: [...f.feats.apis].slice(0, 3),
    });
  }
}
// 写入 symbol_map.json（供工具/脚本查询，不内嵌进 md 以免过大）
const SYMBOL_JSON_PATH = path.join(BUNDLE, 'symbol_map.json');
try {
  fs.writeFileSync(SYMBOL_JSON_PATH, JSON.stringify(SYMBOL_MAP, null, 2));
} catch (e) { console.warn('[symbol_map.json 写入失败]', e.message); }

// 选择内嵌 md 的高价值符号：优先"有实质用途"（api/hooks/UI/fetch 等），排除无用的短函数噪音；
// 同名×N 反而降低优先级（影子文件，AI 更需谨慎，不属于"优先看"）。
function symbolScore(entries) {
  let score = 0;
  for (const e of entries) {
    const r = e.role || '';
    // 噪音：短函数 / 无特征 —— 不计分
    if (!r || r === '短函数') continue;
    // 实质用途加分（api/hooks/UI/fetch/local-tool/proxyMode 是强信号）
    if (/api:|hooks:|UI:|local-tool|proxyMode|fetch|派发事件/.test(r)) score += 12;
    else if (/字段:/.test(r)) score += 4;
    else score += 6;
  }
  return score;
}
const rankedSymbols = Object.entries(SYMBOL_MAP)
  .map(([name, entries]) => ({ name, entries, score: symbolScore(entries) }))
  .filter((s) => s.score > 0) // 只留至少一个"有实质用途"的符号
  .sort((a, b) => b.score - a.score)
  .slice(0, 40);

L.push('## 八、符号级索引（混淆名 → 用途 → 落点，AI 反查用）');
L.push('');
L.push('> 自动生成。`src/bundle/symbol_map.json` 是**全量**符号表（所有顶层函数/变量 → 文件/行号/用途），本文只内嵌**最有用的前 40 个**（带用途、被引用多的，尤其聚合导出与同名影子）。');
L.push('> **怎么用**：看到一个短名（`Bl`/`Vr`/`_Component128`）不知干嘛 → 查本表或 `symbol_map.json` → 直接得用途 + 落点 + 行号，不靠猜。');
L.push('> ⚠️ 行号为**定义位置**；同名符号可能跨文件（同名影子），改前务必确认是哪个文件。');
L.push('');
L.push('| 符号 | 用途/角色 | 落点（文件:行） |');
L.push('|---|---|---|');
for (const s of rankedSymbols) {
  const first = s.entries.find((e) => e.role) || s.entries[0];
  const role = first.role || '—';
  const allLocs = s.entries.map((e) => `\`${e.file}:${e.line}\``).join(' · ');
  const extra = s.entries.length > 1 ? ` ⚠同名×${s.entries.length}` : '';
  L.push(`| \`${s.name}\`${extra} | ${role.replace(/\|/g, ' / ')} | ${allLocs} |`);
}
L.push('');
L.push('> 全量符号（含无用途推断的短函数）见 `src/bundle/symbol_map.json`。');
L.push('');

L.push('## 九、重建命令');
L.push('');
L.push('```bash');
L.push('npm run map        # 重建本图 + symbol_map.json');
L.push('npm run contracts  # 校验契约全端同步（漏改检测）');
L.push('npm run contracts -- --resnap  # 混淆重排后重建基线');
L.push('```');
L.push('');

fs.writeFileSync(OUT, L.join('\n'));

// ---- AI_NAVIGATION.md（AI 改代码第一站：极简导航，主推 npm run ask）----
// 目的：让 AI 只记一条必用命令，其余靠它自动取用生成物，零记忆成本。
const NAV = [];
NAV.push('# AI_NAVIGATION.md · AI 改代码第一站（极简导航）');
NAV.push('');
NAV.push('> 自动生成（scripts/gen_bundle_map.cjs）。**改 `src/bundle/` 前先看本表**，别凭混淆文件名猜。');
NAV.push('');
NAV.push('## 一、遇到"X 是啥" → 只记这一条命令（必用）');
NAV.push('');
NAV.push('```');
NAV.push('npm run ask -- symbol <短名>      # 查符号：用途 + 落点 + 同名影子警示');
NAV.push('npm run ask -- contract <键>      # 查契约：影响哪些文件/端');
NAV.push('npm run ask -- file <关键词>      # 查功能/特征：进哪个文件');
NAV.push('```');
NAV.push('');
NAV.push('改码前不确定任何东西，先跑 `npm run ask`，答案秒出，不用自己翻大文件。');
NAV.push('');
NAV.push('## 二、改动完成验证');
NAV.push('');
NAV.push('```');
NAV.push('npm run test:smoke    # 契约漂移/React单实例/chunk完整性');
NAV.push('npm run build        # 回灌 dist/');
NAV.push('```');
NAV.push('');
NAV.push('## 三、铁律速记');
NAV.push('');
NAV.push('- **运行时只认 `dist/`**，改前端一律改 `src/bundle/` 后 `npm run build` 回灌。');
NAV.push('- **BUNDLE_MAP.md / symbol_map.json / CONTRACTS.md 是自动生成物，禁止手改**（`npm run map` / `npm run contracts` 重建）。');
NAV.push('- **React 单实例不可破**（`_react_shim.js`/`_jsx_runtime.js`/`vendor` 勿改）；**字符串契约零损伤**。');
NAV.push('');
const NAV_OUT = path.join(BUNDLE, 'AI_NAVIGATION.md');
fs.writeFileSync(NAV_OUT, NAV.join('\n'));

console.log('✓ 地图已生成 → src/bundle/BUNDLE_MAP.md');
console.log('✓ 符号表已生成 → src/bundle/symbol_map.json');
console.log('✓ AI 导航已生成 → src/bundle/AI_NAVIGATION.md');
console.log(`  顶层 chunk: ${topChunks.length}, _components 目录: ${compDirs.length}, 组件文件: ${allCompFiles.length}, 大文件(>500行): ${big.length}, 高危文件标记: ${topDeps.length}, 符号: ${Object.keys(SYMBOL_MAP).length}`);
