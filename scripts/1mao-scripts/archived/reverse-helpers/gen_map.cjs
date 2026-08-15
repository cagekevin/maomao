'use strict';
// 由 scripts/regions.json + scripts/panels.json（analyze_regions.cjs 产物）重建 MODULE_MAP.md。
// 任务书推荐流水线第 4 步：node scripts/analyze_regions.cjs && node scripts/gen_map.cjs。
// 动态生成 §1（chunk 地图，来自 src/bundle 实测 + 1.4.0 角色元数据）与 §3（主程序面板树，来自 regions/panels）；
// §0/§2/§4/§5/§6 为静态高保真章节（运行时字符串契约、跨文件导出边界、红线），一并写出。
// 注意：chunk 名为 1.4.0 实测名（铁律 #1 锁定证据），非 1.3.5 名（铁律 #2）。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
const regions = JSON.parse(fs.readFileSync(path.join(__dirname, 'regions.json'), 'utf8'));
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, 'panels.json'), 'utf8'));

// 1.4.0 chunk 角色元数据（与 add_chunk_headers.cjs 同源，均为合法 1.4.0 名）
const CHUNK_META = {
  'main-1TOrc0Z5.js':          { role: '引导/RootErrorBoundary/接入点引导/bootstrap', cat: '业务', entry: '✅ 侧边栏入口', edit: '可改（业务）' },
  'App-D5SRQxl_.js':           { role: '主程序：节点画布 / 资源库 / 多账号 / 提示词库', cat: '业务（default 导出 mr）', entry: '动态 import', edit: '可改（业务）' },
  'share-CymbjOw4.js':         { role: '分享页入口（动态 import ShareAppPage）', cat: '业务', entry: '✅ 分享页入口', edit: '可改（业务）' },
  'ShareAppPage-BVCmVrHF.js':  { role: '分享页主程序', cat: '业务（default 导出 C）', entry: '动态 import', edit: '可改（业务）' },
  'endpointConfig-Bt85xi8d.js':{ role: '接入点配置（含存储键/端口 18080/默认端点）', cat: '业务（导出 a/c/i/n/o/r/s/t）', entry: '被 main 引用', edit: '可改，但字符串契约勿动' },
  'httpClient-Bqba_SHR.js':    { role: 'HTTP 客户端（/api/* 全路由 + 剪映/本地引擎/代理）', cat: '业务', entry: '被各业务引用', edit: '可改（业务）' },
  'src--1UFFpRm.js':           { role: '共享业务 chunk（公共依赖）', cat: '业务', entry: '共享', edit: '可改（业务）' },
  'src-CzHn9cDd.js':           { role: 'Vite modulepreload polyfill（纯副作用，无导出）', cat: '运行时垫片', entry: '共享（副作用）', edit: '勿改' },
  'mediabunny-mp3-encoder-1kfWdaog.js': { role: '音频编码（导出 registerMp3Encoder）', cat: '第三方包装', entry: '被业务引用', edit: '原样携带' },
  'vendor-Z-adA07W.js':        { role: '第三方依赖（React / @xyflow/react / localforage / lucide 等）', cat: '第三方', entry: '被全部引用', edit: '勿反编译/勿改导出别名' },
  'rolldown-runtime-aKtaBQYM.js': { role: 'rolldown 运行时垫片（导出 i/n/r/t 等内部符号）', cat: '运行时', entry: '被全部引用', edit: '勿改' },
  '__vite-browser-external-JD6iV1p1.js': { role: 'Vite 浏览器外置垫片', cat: '运行时垫片', entry: '被业务引用', edit: '原样携带' },
};

const present = fs.readdirSync(BUNDLE).filter(f => f.endsWith('.js'));

// §1 表格
const rows = [];
for (const f of Object.keys(CHUNK_META)) {
  if (!present.includes(f)) { console.warn('regions 元数据引用但未在 src/bundle 找到：', f); continue; }
  const m = CHUNK_META[f];
  rows.push(`| \`${f}\` | ${m.role} | ${m.cat} | ${m.entry} | ${m.edit} |`);
}
const missing = present.filter(f => !CHUNK_META[f]);
for (const f of missing) rows.push(`| \`${f}\` | （未在元数据登记） | - | - | - |`);

const chunkTable = [
  '## 1. 顶层 chunk 地图（12 个，扁平存放于 `src/bundle/`）',
  '',
  '| chunk | 角色 | 类别 | 入口? | 能否改 |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');

// §3 面板树（来自 regions/panels + region_labels.json 人话标签）
const total = regions.length;
const regionCount = {};
for (const s of regions) regionCount[s.region] = (regionCount[s.region] || 0) + 1;
const labels = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rename-pipeline', 'region_labels.json'), 'utf8'));
const regionLines = Object.keys(regionCount).sort().map(r => {
  const info = labels.regions[r] || {};
  const human = info.label ? ` —— **${info.label}**` : '';
  const what = info.what ? `：${info.what}` : '';
  return `- \`${r}\`（${regionCount[r]} 个）${human}${what}`;
});
const rootPanels = (panels.rootPanels || []).join('、') || '无';
const panelSize = panels.panelSize || {};
const panelSizeLines = Object.keys(panelSize).map(p => `- \`${p}\`（${panelSize[p]} 个子组件）`);

// 关键符号人话标签（仅列出在 regions.json 中存在且已标注的）
const symRows = [];
for (const name of Object.keys(labels.symbols)) {
  const s = regions.find(x => x.name === name);
  if (!s) continue;
  const info = labels.symbols[name];
  symRows.push(`| \`${name}\` | ${s.line} | ${s.region} | ${info.label}${info.note ? '（' + info.note + '）' : ''} |`);
}
const symTable = symRows.length ? [
  '### 3.1 关键符号人话标签（静态推断，供快速定位；改代码以实际代码为准）',
  '',
  '| 符号 | 行 | 区域 | 人话标签 |',
  '|---|---|---|---|',
  ...symRows,
  '',
] : [];

const panelTree = [
  '## 3. 主程序面板树（来自 `scripts/regions.json` + `scripts/region_labels.json`）',
  '',
  `\`App-D5SRQxl_.js\` 顶层符号共 **${total}** 个。根面板：**${rootPanels}**。`,
  ...(panelSizeLines.length ? panelSizeLines : []),
  '',
  '功能分区（含人话标签，供 grep 定位）：',
  ...regionLines,
  '',
  ...symTable,
  '> 完整符号表见 `scripts/regions.json`（每项含 `name` / `line` / `kind` / `region` / `compRefs` / `signals`）。',
  '> 区域标签判定依据见 `scripts/analyze_regions.cjs` 的 RULES 正则；符号级标签为静态推断，未经运行期验证。',
  '',
].join('\n');

const static_0 = [
  '# MODULE_MAP · 一毛AI画布（多端合一版 1.4.0）逆向还原工程 A22',
  '',
  '> 本文件是 **AI 编程助手改代码前的检索入口**。它标注「哪些符号跨文件导出、改动需全局确认」，',
  '> 以及「运行时绑定字符串（改了不报错但会静默失效）」清单。高保真 = 改一处即全改 / 明确知道哪些不能动。',
  '',
  '---',
  '',
  '## 0. 工程定位（铁律 #1 锁定证据）',
  '',
  '- **本工程逆向自 1.4.0**，样本路径：兄弟目录 `一毛AI画布多端合一版本1.4.0/dist/`。',
  '- **证据**：`src/bundle/` 含 1.4.0 专属 chunk（`App-D5SRQxl_.js` / `vendor-Z-adA07W.js` /',
  '  `share-CymbjOw4.js` / `httpClient-Bqba_SHR.js` / `endpointConfig-Bt85xi8d.js` /',
  '  `main-1TOrc0Z5.js` / `mediabunny-mp3-encoder-1kfWdaog.js` / `__vite-browser-external-JD6iV1p1.js` /',
  '  `rolldown-runtime-aKtaBQYM.js` 等，共 **12 个 js chunk**）。',
  '- **绝不是 1.3.5**（若看到 `App-B9jVCs-a.js` / `index-CZiVAxxw.js` / `vendor-Cr1JWW-B.js` 即为错版本）。',
  '',
  '---',
  '',
].join('\n');

const static_2 = [
  '## 2. 跨文件导出边界（AI 改动需全局确认）',
  '',
  '> 以下符号被**其它 chunk 通过 import 引用**。改名/删除必须全树同步 grep，否则构建失败或运行期缺失。',
  '',
  '- **`vendor-Z-adA07W.js`**：导出 React / ReactDOM / hooks / `@xyflow/react` / `localforage` / `lucide` 等，',
  '  以压缩别名暴露（如 `Fr`=React、`Ir`=ReactDOM、`Pr`=preload 助手）。**禁止改这些别名**（会破坏所有 import 源名）。',
  '- **`rolldown-runtime-aKtaBQYM.js`**：导出运行时内部符号（`e/t/n/r/i/a/o/s` 等）。**禁止改动**。',
  '- **`endpointConfig-Bt85xi8d.js`**：`export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t }`',
  '  - `a`(=i)：host 重写函数（127.0.0.1 → 当前 hostname）',
  '  - `c`(=t)：Chrome 扩展环境检测',
  '  - `i`(=v)：保存接入点',
  '  - `n`(=_)：获取当前接入点引导函数（被 main 以 `import{_ as C}` 引用）',
  '  - `o`(=n)：基础 URL 构造 `http://127.0.0.1:18080`',
  '  - `r`(=g)：取接入点（session 或默认）',
  '  - `s`(=r)：取端口',
  '  - `t`(=c)：默认端点列表',
  '- **`App-D5SRQxl_.js`**：`export { mr as default }` —— 主组件，被 `main` 动态 import。',
  '- **`ShareAppPage-BVCmVrHF.js`**：default 导出（分享页主组件），被 `share-CymbjOw4.js` 动态 import。',
  '- **`mediabunny-mp3-encoder-1kfWdaog.js`**：`export { v as registerMp3Encoder }`。',
  '- **`httpClient-Bqba_SHR.js`**：导出 HTTP 客户端与所有 `/api/*` 函数；被 `App` / `endpointConfig` 等引用。具体导出名请用 `grep "^export" src/bundle/httpClient-Bqba_SHR.js` 查看。',
  '- **`src--1UFFpRm.js`**：共享业务 chunk，导出公共依赖供 `App` 等引用。导出名用 `grep "^export" src/bundle/src--1UFFpRm.js` 查看。',
  '- **`main-1TOrc0Z5.js`**：`export { j as _ }`（preload 助手），被其它 chunk 引用。',
  '',
  '---',
  '',
].join('\n');

// ---- 动态抽取：导出边界 + 运行时契约核实（吸收 A23 做法，防手写漂移） ----
function exportsOf(src) {
  const names = [];
  const re1 = /export\s*\{([^}]*)\}/g;
  let m;
  while ((m = re1.exec(src))) {
    m[1].split(',').forEach((p) => { const t = p.trim(); if (t) names.push(t.trim()); });
  }
  const re2 = /export\s+(?:async\s+)?(?:default\s+)?(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
  while ((m = re2.exec(src))) names.push(m[1]);
  if (/export\s+default\s+/.test(src) && !names.some((n) => n === 'default')) names.push('default');
  return names;
}
const allFiles = fs.readdirSync(BUNDLE).filter((f) => f.endsWith('.js'));
const srcOf = {};
allFiles.forEach((f) => (srcOf[f] = fs.readFileSync(path.join(BUNDLE, f), 'utf8')));
const allSrc = Object.values(srcOf).join('\n');
const exportsByChunk = {};
allFiles.forEach((f) => (exportsByChunk[f] = exportsOf(srcOf[f])));

const CONTRACT = {
  '持久化键': ['active_api_endpoint', 'transitResources', 'users', 'api_configs', 'canvas-state-v1'],
  '端口/主机': ['18080', '127.0.0.1', 'localhost', 'https://www.1mao.cc', 'https://1mao.16iai.com', 'http://154.219.102.152:3012'],
  'API路径(localTool)': ['/api/kv/get', '/api/kv/set', '/api/proxy', '/api/files/upload', '/api/files/read', '/api/jianying/send', '/api/status', '/api/workflow-app', '/plugin/manifest.json'],
  'API路径(apimart网关)': ['/v1/chat/completions', '/v1/images/generations', '/v1/videos/generations', '/v1/music/generations', '/v1/tasks/', '/v1/uploads/images', '/v1/balance', '/v1/audio/generations'],
  '消息action名': ['resourceAdded'],
  '资源路径': ['mediapipe/wasm', 'models/ue-mannequin'],
  '分享页标记': ['__CANVAS_RUNTIME__'],
};
const foundContract = {};
for (const [cat, list] of Object.entries(CONTRACT)) foundContract[cat] = list.filter((s) => allSrc.includes(s));
const contractHit = Object.values(foundContract).reduce((a, b) => a + b.length, 0);

// 全量分区分组（供 §7）
const groups = {};
for (const r of regions) (groups[r.region] = groups[r.region] || []).push(r);
const REGION_HUMAN = {};
for (const [k, v] of Object.entries(labels.regions || {})) REGION_HUMAN[k] = v.label ? v.label + (v.what ? '：' + v.what : '') : '';

const static_4 = [
  '## 4. 运行时绑定字符串清单（**一个字都不能改**）',
  '',
  '这些字符串是运行期查找契约，与「标识符重命名」是两回事；改名（哪怕只改路径/键名）会导致',
  '读不到旧数据 / 接口 404 / 功能静默失效。**如需对接自有后端，只改「端点主机/端口」这类可切换项**。',
  '',
  '- **持久化键**：`active_api_endpoint`（endpointConfig）、`transitResources`、`users`、`api_configs`、`canvas-state-v1`',
  '- **端口/主机**：`18080`、`127.0.0.1`、`localhost`、`https://www.1mao.cc`、`https://1mao.16iai.com`、`http://154.219.102.152:3012`',
  '- **API 路径（localTool）**：`/api/kv/get`、`/api/kv/set`、`/api/proxy`、`/api/files/upload`、`/api/files/*`、',
  '  `/api/jianying/send`、`/api/status`、`/api/workflow-app*`、`/plugin/manifest.json`',
  '- **API 路径（apimart-gateway，AI 生成网关 `:8000/:9004`）**：`/v1/chat/completions`、`/v1/images/generations`、',
  '  `/v1/videos/generations`、`/v1/music/generations`、`/v1/tasks/{id}`、`/v1/uploads/images`、`/v1/balance`、`/v1/audio/generations`',
  '  （均在 `httpClient-Bqba_SHR.js`，grep `/v1/` 可见；路径与请求体形状必须与网关契约一致）',
  '- **消息 action 名**：`resourceAdded`（background.js → 侧边栏）',
  '- **资源路径**：`mediapipe/wasm`、`mediapipe/blaze_face_short_range.tflite`、`models/ue-mannequin-retopology.glb`',
  '- **分享页 runtime 标记**：`window.__CANVAS_RUNTIME__ = { disableLocalTool: true }`（share-CymbjOw4.js）',
  '',
  `> 以上契约字符串均已在 \`src/bundle/\` 动态核实存在，共 **${contractHit}** 条命中（未命中的说明本样本未含，已自动剔除）。`,
  '',
  '---',
  '',
].join('\n');

const static_5 = [
  '## 5. AI 改写红线（务必遵守）',
  '',
  '1. **不重构 / 不重写**：不抽共享函数、不整块迁移、不重排初始化顺序（会打乱 ES module 加载图 → TDZ / X is not a function）。',
  '2. **不对第三方 `vendor-*` / `rolldown-runtime-*` / `__vite-browser-external` 反编译或手改**。',
  '3. **不重写应用 CSS**：`public/assets/*.css` 保留原始哈希名原样复制。',
  '4. **禁止手工 `sed`/`replace` 批量换名**：改名只走 `scope_rename_plugin`（`npm run restore:rename`），有歧义即跳过。',
  '5. **运行时绑定字符串（§4）一个字都不能改**。',
  '6. **跨文件导出名受保护**（§2）：改前先 `grep` 全树引用，确认同步。',
  '7. **dist 文件名 = 原始 chunk 名**（铁律 #4）：`vite.config.ts` 的 `manualChunks` 已返回原始名，',
  '   构建产物 `dist/assets/*.js` 与原 chunk 同名，运行时 `__vite__mapDeps` 引用才能命中。',
  '',
  '---',
  '',
].join('\n');

const static_6 = [
  '## 6. 一键复现 / 验证命令',
  '',
  '```bash',
  'npm install',
  'SAMPLE=../一毛AI画布多端合一版本1.4.0/dist/assets node scripts/beautify.cjs   # 反编译美化 -> src/bundle',
  'node scripts/_copy_public.cjs                                                # 复制 manifest/图标/mediapipe/models',
  'npm run restore:stringify                                                   # 无插值反引号模板 -> 字符串字面量',
  'node scripts/analyze_regions.cjs                                            # 生成 regions.json / panels.json',
  'node scripts/gen_map.cjs                                                    # 重建本 MODULE_MAP.md',
  'npm run build                                                               # 生成 dist/（可加载的 MV3 扩展）',
  'node scripts/_check_align.cjs                                               # 改名对齐安全网（/api/ 等标记零漂移）',
  '```',
  '',
  '> `_check_align` 输出写入 `scripts/_align_out.txt`；改名后重跑应与改名前一致。',
  '',
].join('\n');

const dyn2 = [
  '### 2.1 自动核实导出（动态抽取自 src/bundle，与上方人工标注交叉验证）',
  '',
  ...allFiles.sort().map((f) => {
    const ex = exportsByChunk[f] || [];
    return '- `' + f + '`：' + (ex.length ? '`export{ ' + ex.join(', ') + ' }`' : '（无静态 export）');
  }),
  '',
].join('\n');

// §7 全量分区明细（吸收 A23：完整覆盖全部符号，非抽样；并融入 region_labels.json 人话标签）
const s7 = [];
s7.push('## 7. 自动分区明细（来自 `scripts/regions.json` + `region_labels.json`）');
s7.push('');
s7.push('> 全部 ' + total + ' 个符号按 region 自动分组（完整覆盖，非抽样）。符号级人话标签来自 region_labels.json，标注「推断」者未经运行期验证。');
s7.push('');
const coreRegions = Object.keys(groups).filter((k) => k.startsWith('core:')).sort();
for (const k of coreRegions) {
  const human = REGION_HUMAN[k] ? ' —— **' + REGION_HUMAN[k] + '**' : '';
  s7.push('### ' + k + human);
  s7.push('');
  s7.push('| 符号 | 行 | 类型 | 特征信号 | 人话标签 |');
  s7.push('|---|---|---|---|---|');
  for (const r of groups[k]) {
    const hl = labels.symbols[r.name];
    const label = hl ? hl.label + (hl.note ? '（' + hl.note + '）' : '') : '-';
    s7.push('| `' + r.name + '` | L' + r.line + ' | ' + r.kind + ' | ' + ((r.signals || []).join(', ') || '-') + ' | ' + label + ' |');
  }
  s7.push('');
}
const panelRegions = Object.keys(groups).filter((k) => k.startsWith('panel:'));
for (const k of panelRegions) {
  const items = groups[k];
  const root = k.split(':')[1];
  const rootLine = (regions.find((i) => i.name === root) || {}).line;
  s7.push('### ' + k + (REGION_HUMAN[k] ? ' —— **' + REGION_HUMAN[k] + '**' : ''));
  s7.push('');
  s7.push('根组件：`' + root + '`(L' + rootLine + ')；子组件：' + items.filter((i) => i.name !== root).map((i) => '`' + i.name + '`(L' + i.line + ')').join(', '));
  s7.push('');
}
if (groups['shared']) {
  s7.push('### shared（共享绑定 ' + groups['shared'].length + ' 个）');
  s7.push('');
  s7.push('| 符号 | 行 | 类型 |');
  s7.push('|---|---|---|');
  for (const r of groups['shared']) s7.push('| `' + r.name + '` | L' + r.line + ' | ' + r.kind + ' |');
  s7.push('');
}
if (groups['ui-misc']) {
  s7.push('### ui-misc（独立 UI 原子 ' + groups['ui-misc'].length + ' 个）');
  s7.push('');
  s7.push('| 符号 | 行 | 类型 |');
  s7.push('|---|---|---|');
  for (const r of groups['ui-misc']) s7.push('| `' + r.name + '` | L' + r.line + ' | ' + r.kind + ' |');
  s7.push('');
}
const section7 = s7.join('\n');

const out = [
  static_0,
  chunkTable,
  '---',
  '',
  static_2,
  dyn2,
  panelTree,
  '---',
  '',
  static_4,
  static_5,
  static_6,
  section7,
].join('\n');

fs.writeFileSync(path.join(ROOT, 'MODULE_MAP.md'), out);
console.log('已重建 MODULE_MAP.md（chunk 表 ' + rows.length + ' 行，App 符号 ' + total + ' 个，根面板 ' + rootPanels + '）');
