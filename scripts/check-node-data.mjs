/**
 * check-node-data.mjs
 * 只读普查：`node.data` 契约对账（字段缺口 / 结果字段命名 / 读写路径）。
 *
 * 背景（为什么要加本脚本）：
 *   同一个节点的 data 形状目前由【五处各自表述】——① canvas/nodeDataSchema.ts 的 `NODE_DATA_DEFAULTS`
 *   （**新建默认值真源**；2026-09-12 / TD-02-7 从 NodePalette 的 palette `data:{}` 迁出）、
 *   ② 各节点文件本地 `interface XxxData`（渲染期类型）、③ useConnectedInputs.ts 的**产出契约三张表**
 *   （2026-09-12 / TD-02-11：SINGLE_OUTPUT_FIELDS 单 URL 声明 + NODE_OUTPUTS 复合声明 +
 *   NO_OUTPUT_NODE_TYPES 无产出；genericOutput 已降级为"未登记类型的最后安全网"）、
 *   ④ nodeDefaults.ts（只补结构，不碰 data）、
 *   ⑤ 快照落盘白名单（2026-09-12 起真源 = canvas/canvasSnapshotSchema.ts 的 NODE_KEEP/EDGE_KEEP，
 *      原在 projectStore.sanitizeNodes；projectStore 只消费）。五处之间没有任何对账，
 *   已实锤漂移：GridSplitNode 的 `data.imageUrl` 未进本地 interface（读取处只能 `as` 硬转）、
 *   VideoProcessNode 写 `outputName/outputInfo` 不在 interface、FaceMosaicNode 的 `data.resultUrls`
 *   声明了也读了但从未写回、AssetNode 的 `data.url` 兼容层留在读取端。
 *   本脚本把「写侧产出 vs 读侧认识」的差集变成可见清单（与 scripts/check-node-types.mjs 的
 *   普查方法一致，但查的是【数据】而不是代码重复）。
 *
 * 与 docs/119（重复逻辑收敛清单）的关系：
 *   119 查「同一段代码抄了几次」（收口 = 副作用）；本脚本查「同一个 data 有几套说法」。
 *   先有清单再决定收口范围——数据契约真源（nodeDataSchema）落地前，本脚本是唯一的对齐依据。
 *
 * 边界（诚实标注，避免误读）：
 *  - 纯文本扫描（零新依赖），不做 AST。已做：注释整体抹白（保留换行，行号不漂）、字符串/括号
 *    配对保护、`extends` 基类型字段并入（见 EXTERNAL_BASE_FILES）。不追求 100% 精确。
 *  - 「本节点自写」与「子节点规格 / 跨节点写」按守卫区分（`n.id === id` vs `n.id !== 其他`），
 *    后者不算本节点字段——混算会误报（实测：给下游 imageBox 写 activeIndex）。
 *  - 「结果类字段」是启发式过滤（名字含 url/result/output，或属 text/images/extractedImages
 *    这类产出字段；排除 source 前缀、demo 前缀），用于把参数类字段的噪点压下去。
 *    判定结果需人工过一眼再施工；确属本节点自用的例外登记 RESULT_EXEMPT（带原因，且有过期自检）。
 *  - 报告模式默认 exit 0；**`--strict` 已挂 `npm run check:health`**（字段缺口/结果字段读侧不认 ≠ 0 即失败）。
 *    prebuild/pretest 仍不挂（构建/测试关键路径，此体检非构建必需，且失败信息面向数据治理而非编译）。
 *
 * 用法：
 *   node scripts/check-node-data.mjs              # 全量对账（报告）
 *   node scripts/check-node-data.mjs videoProcess # 只看某类型（子串匹配）
 *   node scripts/check-node-data.mjs --strict     # 有缺口时 exit 1（check:health 用的就是它）
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');

/**
 * 节点类型 → 节点组件文件（相对仓库根）。
 * 显式登记而非按命名推导：type 是 camelCase、文件名是 PascalCase 且非一一对应
 * （group→GroupNode / textGenerateNode→TextGenerate），推导规则会静默错配。
 * 未登记的类型请补此表；nodes/ 下出现未登记的文件会在收尾处报出（防本表悄悄过期）。
 */
const NODE_TYPE_TO_FILE = {
  assetNode: 'src/components/nodes/AssetNode.tsx',
  imageBoxNode: 'src/components/nodes/ImageBoxNode.tsx',
  gridSplitNode: 'src/components/nodes/GridSplitNode.tsx',
  gridMergeNode: 'src/components/nodes/GridMergeNode.tsx',
  panoramaNode: 'src/components/nodes/PanoramaNode.tsx',
  director3dNode: 'src/components/nodes/Director3DNode.tsx',
  faceMosaicNode: 'src/components/nodes/FaceMosaicNode.tsx',
  loopNode: 'src/components/nodes/LoopNode.tsx',
  videoExtractNode: 'src/components/nodes/VideoExtractNode.tsx',
  videoProcessNode: 'src/components/nodes/VideoProcessNode.tsx',
  group: 'src/components/nodes/GroupNode.tsx',
  scriptBoxNode: 'src/components/nodes/ScriptBoxNode.tsx',
  textGenerateNode: 'src/components/nodes/TextGenerate.tsx',
  imageGenerateNode: 'src/components/nodes/ImageGenerate.tsx',
  videoGenerateNode: 'src/components/nodes/VideoGenerate.tsx',
  ghostTarget: 'src/components/nodes/GhostTargetNode.tsx',
};

/** nodes/ 下非节点组件文件（辅助 hook / 纯工具 / 素材），不参与 data 对账 */
const NON_NODE_FILES = new Set(['nodeImage.ts', 'useImagePersistence.tsx', 'useImageHoverActions.tsx']);
const NODES_DIR = 'src/components/nodes';
// 数据默认值真源（2026-09-12 / TD-02-7：原在 NodePalette.paletteNodes[].data，已迁此）
const DATA_SCHEMA_FILE = 'src/components/base/canvas/nodeDataSchema.ts';
const OUTPUTS_FILE = 'src/hooks/useConnectedInputs.ts';

// ───────────────────────── 文本扫描工具（抹注释 / 配对 / 分片 / 取 key）─────────────────────────

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

/**
 * 把注释整体抹成空格（保留换行 → 行号不漂）。
 * 为什么必须抹：注释里常出现示例代码（`data: { ... }`）与中文顿号/引号，会让正则解析出
 * 幽灵字段；而 `// 图片盒子：...` 紧贴在 key 前时会让「段首取 key」失败（整段被漏掉）。
 */
function blankComments(src) {
  const out = src.split('');
  let inStr = null;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) {
      if (c === '\n') inLine = false;
      else out[i] = ' ';
      continue;
    }
    if (inBlock) {
      if (c === '*' && n === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        inBlock = false;
        i++;
      } else if (c !== '\n') out[i] = ' ';
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') {
      out[i] = ' ';
      out[i + 1] = ' ';
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && n === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      inBlock = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
  }
  return out.join('');
}

/** 从 openIdx（{ [ ( 之一）配对到闭合符，返回其下标；字符串内的括号不计。找不到返回 -1。 */
function matchPair(src, openIdx) {
  const open = src[openIdx];
  const close = open === '{' ? '}' : open === '[' ? ']' : open === '(' ? ')' : null;
  if (!close) return -1;
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** 按顶层分隔符切分 [start,end)，返回 [{ text, start }]（嵌套括号与字符串内不切）。 */
function splitTopLevelRanges(src, start, end, seps = [',']) {
  const sepSet = new Set(seps);
  const out = [];
  let depth = 0;
  let inStr = null;
  let segStart = start;
  for (let i = start; i < end; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (depth === 0 && sepSet.has(c)) {
      out.push({ text: src.slice(segStart, i), start: segStart });
      segStart = i + 1;
    }
  }
  if (segStart < end) out.push({ text: src.slice(segStart, end), start: segStart });
  return out;
}

/**
 * 取对象字面量 body 的顶层成员（跳过 `...spread` 与简写；`[key: string]` 不匹配）。
 * 区分 `x: 值` 与 `x: undefined`：后者是【清空遗留字段】不是【产出】——
 * 实测 AssetNode `url: undefined` / VideoProcessNode `videoUrl|audioUrl: undefined` 都是清空，
 * 若混算成"产出"，表2 会误报成"写了个读侧不认的结果字段"。
 */
function topLevelEntries(body) {
  const out = [];
  for (const r of splitTopLevelRanges(body, 0, body.length)) {
    const m = /^\s*(?:\.\.\.\s*)?['"]?([A-Za-z_$][\w$]*)['"]?\s*:\s*([\s\S]*)$/.exec(r.text);
    if (m) {
      out.push({ key: m[1], cleared: /^undefined\b/.test(m[2].trim()) });
      continue;
    }
    // 简写属性（`outputName,`）：对象字面量里「无冒号的裸标识符」即 shorthand。
    // 不识别会漏掉真实字段（实测 VideoProcessNode 的 outputName 就这么漏的）。
    const s = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(r.text);
    if (s) out.push({ key: s[1], cleared: false });
  }
  return out;
}
const topLevelKeys = (body) => topLevelEntries(body).map((e) => e.key);

/** 取 `foo = { ... }` 形式对象字面量的顶层 key */
function keysOfObjectAfter(src, re) {
  const m = re.exec(src);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  if (open < 0) return null;
  const close = matchPair(src, open);
  return close < 0 ? null : topLevelKeys(src.slice(open + 1, close));
}

/** 取 `new Set([...])` / 数组字面量里的字符串常量 */
function stringLiteralsIn(src, re) {
  const m = re.exec(src);
  if (!m) return [];
  const open = src.indexOf('[', m.index);
  if (open < 0) return [];
  const close = matchPair(src, open);
  if (close < 0) return [];
  const out = [];
  const re2 = /['"]([\w$]+)['"]/g;
  let x;
  const body = src.slice(open + 1, close);
  while ((x = re2.exec(body)) !== null) out.push(x[1]);
  return out;
}

// ───────────────────────── 各来源解析（入参均为已抹注释的源码）─────────────────────────

/**
 * 解析节点文件的本地 `interface XxxData` 字段（含行号）。TS 成员用 `;` 分隔，需一并切。
 * 支持 `extends` 子句（如 `interface ScriptBoxNodeData extends Partial<ScriptBoxTop>`）：
 * 基类型字段先并入，否则会把「真源在 schema 里的继承字段」误报成缺口。
 * @param externalBaseFields 外部模块的 interface 字段表（见 EXTERNAL_BASE_FILES）
 */
function parseInterfaceFields(src, externalBaseFields = new Map()) {
  const fields = new Map(); // field -> line
  const re = /interface\s+(\w*Data)\s*(?:extends\s+([^{]+?))?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('{', m.index);
    const close = matchPair(src, open);
    if (close < 0) continue;
    for (const base of m[2]?.match(/[A-Za-z_$][\w$]*/g) || []) {
      if (base === 'Partial' || base === 'Readonly') continue;
      for (const k of externalBaseFields.get(base) || []) {
        if (!fields.has(k)) fields.set(k, lineOf(src, m.index));
      }
    }
    for (const r of splitTopLevelRanges(src, open + 1, close, [';', '\n', ','])) {
      const fm = /^\s*(?:readonly\s+)?['"]?([A-Za-z_$][\w$]*)['"]?\s*\??\s*:/.exec(r.text);
      if (fm) fields.set(fm[1], lineOf(src, r.start));
    }
  }
  return fields;
}

/**
 * 找出「节点 data interface 上带 `[key: string]: unknown` 索引签名」的接口名。
 *
 * 【为什么拦】索引签名会把「读写一个不存在的 data 字段」变成静默通过：实测它掩盖过
 * `data.name`（ImageGenerate 下载兜底，恒 undefined）、`onGenerateAssetImage` 等未登记回调、
 * `outputInfo/outputName` 未声明字段。2026-09-11 已把 16 个节点 data interface 的索引签名全删
 * （删后仅 5 处编译错误、全量单测 2400 绿）——**禁止再加回来**，否则类型重新形同虚设。
 * 只认「行首 `[key: string]`」，不误伤嵌套对象类型里的内联索引签名（如 images?: Array<{...}>）。
 */
function findIndexSignatureInterfaces(src) {
  const hits = [];
  const re = /interface\s+(\w*Data)\s*(?:extends\s+[^{]+?)?\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = src.indexOf('{', m.index);
    const close = matchPair(src, open);
    if (close < 0) continue;
    if (/^\s*\[[A-Za-z_$][\w$]*\s*:\s*string\s*\]/m.test(src.slice(open + 1, close))) {
      hits.push(m[1]);
    }
  }
  return hits;
}

/** 解析节点文件的写入点：patchData({...}) / data:{...} / {...n.data, X:...}。
 *  每个 site = { kind, keys(写值), cleared(写 undefined 的清空), indirect(经 helper 写), line }。 */
function parseWriteSites(src) {
  const sites = [];
  const push = (kind, openIdx) => {
    if (openIdx < 0) return;
    const close = matchPair(src, openIdx);
    if (close < 0) return;
    const body = src.slice(openIdx + 1, close);
    const entries = topLevelEntries(body);
    // 本地 patch-helper（如 `const updateData = (patch) => setNodes(... data:{...n.data, ...patch})`）：
    // 对象里全是 spread、没有字面量键 → 本工具展不开，但**确实是本节点在写 data**。
    // 若不单独标记，会被漏报成「自写 0」→ 误判该节点不落盘（实测 ImageBoxNode/Director3DNode 就栽在这）。
    if (!entries.length) {
      if (/\.\.\./.test(body)) sites.push({ kind, keys: [], cleared: [], indirect: true, line: lineOf(src, openIdx) });
      return;
    }
    sites.push({
      kind,
      keys: entries.filter((e) => !e.cleared).map((e) => e.key),
      cleared: entries.filter((e) => e.cleared).map((e) => e.key),
      indirect: false,
      line: lineOf(src, openIdx),
    });
  };

  // ① patchData({ ... }) —— 官方写回入口
  const rePatch = /patchData\s*\(\s*\{/g;
  let m;
  while ((m = rePatch.exec(src)) !== null) push('patchData', src.indexOf('{', m.index));

  // ② data: { ... } —— spawn 子节点规格 / addNode 的 data 字面量。
  //    单列一类：它描述的是【子节点】的 data，不是本节点自己的 data。
  //    混算会把 `data:{ ..., expanded:false }` 误报成"本节点写了未声明字段"（实测踩过）。
  const reLiteral = /\bdata\s*:\s*\{/g;
  while ((m = reLiteral.exec(src)) !== null) push('子节点data', src.indexOf('{', m.index));

  // ③ { ...n.data, X: ... } —— 手写 setNodes 不可变局部更新。
  //    必须再分「写自己」还是「写别的节点」：两者写法同构，靠紧邻的守卫判定——
  //      own    : ns.map(n => n.id === id ? { ...n, data: { ...n.data, X } } : n)
  //      跨节点 : ns.map(n => { if (n.id !== boxId) return n; ... data: { ...n.data, X } })
  //    混算会把「给下游 imageBox 写 activeIndex」误报成本节点的未声明字段（实测踩过）。
  const reSpread = /\.\.\.\s*n\s*\.\s*data\b/g;
  while ((m = reSpread.exec(src)) !== null) {
    const back = src.slice(Math.max(0, m.index - 800), m.index);
    const guards = [...back.matchAll(/n\.id\s*(===|!==)\s*([A-Za-z_$][\w$]*)/g)];
    const last = guards[guards.length - 1];
    const isOwn = !last || (last[1] === '===' && last[2] === 'id');
    push(isOwn ? 'setNodes写' : '跨节点写', src.lastIndexOf('{', m.index));
  }
  return sites;
}

/**
 * 解析 `nodeDataSchema.ts` 的 `NODE_DATA_DEFAULTS` → [{type, keys, line}]。
 *
 * 【为什么是「单一对象」而非「palette 数组」】2026-09-12 / TD-02-7 把各节点的 data 默认值从
 * `NodePalette.paletteNodes[].data`（数组内嵌 `data:{...}`）收口到本表（一层对象：type → 字段集）。
 * 解析从「扫数组 + 逐项找 data 块」简化为「扫一层对象」，同时消除了原实现对 `data:{` 字面形态的依赖。
 *
 * 【两个曾把本工具打瞎的坑（2026-09-12 修复，勿回退）】
 *  ① 正则写死「名 = [」裸形态 → `.ts` 类型标注（`export const paletteNodes: PaletteNodeDef[] = [`）
 *     一插进来就匹配失败；
 *  ② `src.indexOf('[', m.index)` 会被类型注解里的 `[]` 抢先命中 → 配对到注解的 `]` → 整段解析为空。
 *  修法：正则用 `(?::[^=]*)?` 容忍类型标注；定位开括号一律用 `m.index + m[0].length - 1`（正则末字符）。
 *  两道保险之外还有「解析器自检」（见文件末尾）：解析源为空即 fail-loud，绝不静默报「0 缺口」。
 */
function parseDataSchemaEntries(src) {
  const out = [];
  const m = /export const NODE_DATA_DEFAULTS\s*(?::[^=]*)?=\s*\{/.exec(src);
  if (!m) return out;
  const open = m.index + m[0].length - 1;
  if (src[open] !== '{') return out;
  const close = matchPair(src, open);
  if (close < 0) return out;
  for (const r of splitTopLevelRanges(src, open + 1, close)) {
    const km = /^\s*(\w+)\s*:\s*\{/.exec(r.text);
    if (!km) continue;
    const o = r.start + r.text.indexOf('{', km.index);
    const c = matchPair(src, o);
    const keys = c > 0 ? topLevelKeys(src.slice(o + 1, c)) : [];
    out.push({ type: km[1], keys, line: lineOf(src, r.start) });
  }
  return out;
}

/**
 * 读侧「单 URL 产出」显式声明字段（TD-02-11，2026-09-12）。
 * 从 `SINGLE_OUTPUT_FIELDS` 对象字面量里收集字符串常量 = 各节点**显式声明**的产出字段名。
 * （此前读侧靠 `genericOutput` 的三个魔法字段名 `assetUrl > videoUrl > resultUrl` 猜 —— 节点把结果
 *  写到别的字段即静默空产出；改由写侧声明后，本函数把它解析出来供表2「写侧结果字段是否被读侧认识」对账。）
 */
function parseSingleOutputFields(src) {
  const m = /const SINGLE_OUTPUT_FIELDS\s*(?::[^=]*)?=\s*\{/.exec(src);
  if (!m) return [];
  const open = m.index + m[0].length - 1; // 正则末字符即对象 `{`
  if (src[open] !== '{') return [];
  const close = matchPair(src, open);
  if (close < 0) return [];
  const body = src.slice(open + 1, close);
  const out = [];
  for (const x of body.matchAll(/'([^']+)'/g)) if (!out.includes(x[1])) out.push(x[1]);
  return out;
}

// ───────────────────────── 结果类字段启发式 ─────────────────────────
// 目的：把「可能参与管线产出」的字段挑出来（不报 label/mode/rows/imageSize 这类参数）。
// 命中：名字含 url/result/output；或属 text/images/extractedImages 这类产出字段。
// 排除：source 前缀（源素材地址是输入）、demo 前缀（演示图）。
// 注意不要用 `gif` 当命中词：gifFps/gifMaxSize/gifColors/gifCrop 是【参数】不是产出，
// 只有 gifResult 那种含 result 的才是产出（含 result 已被命中，无需单列 gif）。
const RESULTISH_RE = /(url|result|output)/i;
const EXTRA_RESULT_FIELDS = new Set(['text', 'images', 'extractedImages']);
const isResultish = (f) =>
  EXTRA_RESULT_FIELDS.has(f) || (RESULTISH_RE.test(f) && !/^source/i.test(f) && !/^demo/i.test(f));

/**
 * 结果字段豁免表 —— 「写侧产出但读侧不认」的**合理例外**，逐条注明原因（禁止默默新增）。
 * 判据：该字段是【本节点自用】（节点内展示 / 下载命名 / 元信息），不是给下游的管线数据；
 *   真产物经 spawn 子节点交付（见表2 的「↪ 经 spawn 子节点交付」行）。
 * 收紧原则：**凡下游确实需要的数据一律不豁免** —— 应补 NODE_OUTPUTS 声明或统一字段名。
 * 本表会被自检：豁免的字段若已不再被写入 → 报「表过期」，防豁免越挂越多变成垃圾桶。
 */
const RESULT_EXEMPT = {
  faceMosaicNode: {
    // 输入通道字段（手动上传图源列表 string[]）：节点初始化读取（data.assetUrls || []）+ TD-9 改动写回持久 URL，
    // 是「节点自有状态」而非下游管线产出；真结果经 spawn assetNode 子节点交付（见 CONTEXT §五 审计豁免口径）。
    assetUrls: '上传图源 = 输入通道（string[]），不是给下游的产出；下游取图走 spawn 的 assetNode 子节点',
  },
};

// ───────────────────────── 主流程 ─────────────────────────

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const filters = args.filter((a) => !a.startsWith('--'));

let NODE_TYPES = {};
try {
  const mod = await import(pathToFileURL(resolve(root, 'src/components/base/core/contracts.ts')).href);
  NODE_TYPES = mod.NODE_TYPES || {};
} catch (e) {
  console.error('  ✖ 无法加载 contracts.ts 的 NODE_TYPES：', e.message);
  process.exit(1);
}

/** 读源码并抹白注释（解析统一用这份；`blankComments` 只抹注释、**保留字符串内容**，故 `type: 'x'` 类字面量仍可解析）。 */
const read = (rel) => {
  const abs = join(root, rel);
  return existsSync(abs) ? blankComments(readFileSync(abs, 'utf8')) : null;
};

const dataSchemaSrc = read(DATA_SCHEMA_FILE) || '';
const outputsSrc = read(OUTPUTS_FILE) || '';

/**
 * 节点 data interface 可能 extends 的外部基类型（字段真源不在节点文件里）。
 * 不登记就会把继承来的字段误报成缺口（实测：ScriptBoxNodeData extends Partial<ScriptBoxTop>）。
 * 新增此类基类型时补此表；表是「字段真源文件」，不是豁免名单。
 */
const EXTERNAL_BASE_FILES = ['src/components/scriptbox/scriptBoxSchema.ts'];
const externalBaseFields = new Map(); // interface 名 -> 字段名数组
for (const rel of EXTERNAL_BASE_FILES) {
  const s = read(rel);
  if (!s) continue;
  const re = /interface\s+(\w+)\s*(?:extends\s+([^{]+?))?\s*\{/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const open = s.indexOf('{', m.index);
    const close = matchPair(s, open);
    if (close < 0) continue;
    const keys = [];
    for (const r of splitTopLevelRanges(s, open + 1, close, [';', '\n', ','])) {
      const fm = /^\s*(?:readonly\s+)?['"]?([A-Za-z_$][\w$]*)['"]?\s*\??\s*:/.exec(r.text);
      if (fm) keys.push(fm[1]);
    }
    if (!externalBaseFields.has(m[1])) externalBaseFields.set(m[1], keys);
  }
}

const dataDefaultsByType = new Map();
for (const e of parseDataSchemaEntries(dataSchemaSrc)) dataDefaultsByType.set(e.type, e.keys);

// ⚠️ 同上：源码为 `export const NODE_OUTPUTS: Record<string, NodeOutputResolver> = {`，
// 容忍类型标注，否则「声明式产出」整表解析为 (未解析到)（假护栏）。
const declaredOutputTypes =
  keysOfObjectAfter(outputsSrc, /export const NODE_OUTPUTS\s*(?::[^=]*)?=\s*\{/) || [];
// 读侧特判集 / 显式无产出集（2026-09-12 / TD-02-11：原 specialHandled + genericOutputOk 两处白名单，
// 现为 SPECIAL_OUTPUT_TYPES + NO_OUTPUT_NODE_TYPES；genericOutputOk 已删，其职责＝三张表覆盖）
const specialTypes = stringLiteralsIn(outputsSrc, /const SPECIAL_OUTPUT_TYPES\s*(?::[^=]*)?=\s*new Set\(/);
const noOutputTypes = stringLiteralsIn(outputsSrc, /const NO_OUTPUT_NODE_TYPES\s*(?::[^=]*)?=\s*new Set\(/);
const singleOutputFields = parseSingleOutputFields(outputsSrc);
// 安全网字段（仅未登记类型走；真源 = useConnectedInputs 的 SAFETY_NET_FIELDS）
const SAFETY_NET_FIELDS = ['assetUrl', 'videoUrl', 'resultUrl'];
const readSideFields = [...new Set([...SAFETY_NET_FIELDS, ...singleOutputFields])];
// NODE_OUTPUTS 内实际读的 data 字段（声明式产出，如 extractedImages / images / shots）
const declaredDataFields = [...new Set([...outputsSrc.matchAll(/\bd\.(\w+)\b/g)].map((m) => m[1]))];

const types = Object.keys(NODE_TYPES).filter(
  (t) => filters.length === 0 || filters.some((f) => t.includes(f)),
);

const rows = [];
for (const type of types) {
  const rel = NODE_TYPE_TO_FILE[type];
  const src = rel ? read(rel) : null;
  rows.push({
    type,
    rel,
    missing: !!rel && !src,
    iface: src ? parseInterfaceFields(src, externalBaseFields) : new Map(),
    idxSigs: src ? findIndexSignatureInterfaces(src) : [],
    sites: src ? parseWriteSites(src) : [],
    dataDefaultKeys: dataDefaultsByType.get(type) || [],
    // 四个生成节点经 useGenerateNode 间接走 useNodeGeneration 契约，两者都认
    genKind: !src
      ? ''
      : /useGenerateNode\s*\(/.test(src)
        ? 'useGenerateNode'
        : /useNodeGeneration\s*\(/.test(src)
          ? 'useNodeGeneration'
          : '',
  });
}

// ── 输出 ──
const line = (s = '') => console.log(s);
line('');
line('═══ node.data 契约对账（只读普查，报告模式）═══');
line(`登记节点类型 ${Object.keys(NODE_TYPES).length} 个 · 本轮对账 ${rows.length} 个`);
line(
  `读侧产出字段（单URL声明 + 安全网）: ${readSideFields.join(' / ') || '(未解析到)'}` +
    ` · 显式声明字段: ${singleOutputFields.join(' / ') || '(未解析到)'}`,
);
line(`读侧复合产出声明 NODE_OUTPUTS: ${declaredOutputTypes.join(' / ') || '(未解析到)'}`);
line(
  `读侧特判(文本): ${specialTypes.join(' / ') || '(未解析到)'} · 显式无产出类型 ${noOutputTypes.length} 个: ${noOutputTypes.join(' / ') || '(未解析到)'}`,
);
line('');

// 「本节点自己的 data」写入 = patchData + {...n.data, X}（守卫为 n.id === id）；
// 子节点规格 data:{...} 与「跨节点写」（守卫为 n.id !== other）都不算本节点字段，单独归类。
const NOT_OWN = new Set(['子节点data', '跨节点写']);
const ownKeys = (r, onlyKind) =>
  [
    ...new Set(
      r.sites.filter((s) => (onlyKind ? s.kind === onlyKind : !NOT_OWN.has(s.kind))).flatMap((s) => s.keys),
    ),
  ];
const clearedKeys = (r) =>
  [...new Set(r.sites.filter((s) => !NOT_OWN.has(s.kind)).flatMap((s) => s.cleared))];
const childKeys = (r) => ownKeys(r, '子节点data');
const crossKeys = (r) => ownKeys(r, '跨节点写');

// 表1 字段缺口
line('▌表1 字段缺口（interface 索引签名 / 默认值(nodeDataSchema) / 本节点实际写入）');
let gapCount = 0;
const noPatch = [];
for (const r of rows) {
  if (!r.rel) {
    line(`── ${r.type}  (无映射文件)`);
    continue;
  }
  if (r.missing) {
    line(`── ${r.type}  ✖ 映射文件不存在: ${r.rel}`);
    gapCount++;
    continue;
  }
  if (!r.iface.size && !r.sites.length && !r.dataDefaultKeys.length) {
    line(`── ${r.type}  (无 data 字段)`);
    continue;
  }
  const iface = [...r.iface.keys()];
  const written = ownKeys(r);
  const cleared = clearedKeys(r);
  const child = childKeys(r);
  const cross = crossKeys(r);
  // 默认值真源 = nodeDataSchema.NODE_DATA_DEFAULTS（2026-09-12 / TD-02-7；原为 palette.data）
  const def = [...new Set(r.dataDefaultKeys)];
  const defNotIface = def.filter((k) => !r.iface.has(k));
  const writeNotIface = written.filter((k) => !r.iface.has(k));
  const ifaceNotUsed = iface.filter((k) => !written.includes(k) && !def.includes(k));
  const patchCnt = r.sites.filter((s) => s.kind === 'patchData').length;
  if (patchCnt === 0 && (written.length || def.length)) noPatch.push(r.type);

  line(`── ${r.type}  (${r.rel.replace(NODES_DIR + '/', '')})`);
  line(`   interface(${iface.length}): ${iface.join(' ') || '(无)'}`);
  line(`   默认值    (${def.length}): ${def.join(' ') || '(无)'}`);
  const indirectCnt = r.sites.filter((s) => s.indirect).length;
  line(`   自写     (${written.length}): ${written.join(' ') || '(无)'}`);
  if (indirectCnt) {
    line(
      `   间接写回: ${indirectCnt} 处本地 patch-helper（键随调用参数，本工具不展开 → 该节点"声明但未见写入"一栏对它不适用）`,
    );
  }
  if (cleared.length) line(`   清空     (${cleared.length}): ${cleared.join(' ')}  ← 写 undefined，只清不写`);
  if (child.length) line(`   子节点   (${child.length}): ${child.join(' ')}  ← spawn 出去的子节点 data，非本节点字段`);
  if (cross.length) line(`   跨节点   (${cross.length}): ${cross.join(' ')}  ← 写给下游节点的 data，非本节点字段`);
  if (r.idxSigs.length) {
    line(`   ⚠ 索引签名回退（禁止）: ${r.idxSigs.join(' ')}  ← \`[key: string]: unknown\` 让写错字段名静默通过`);
    gapCount += r.idxSigs.length;
  }
  if (defNotIface.length) {
    line(`   ⚠ 默认值声明但 interface 未声明: ${defNotIface.join(' ')}`);
    gapCount += defNotIface.length;
  }
  if (writeNotIface.length) {
    line(`   ⚠ 自写但 interface 未声明（靠索引签名兜住）: ${writeNotIface.join(' ')}`);
    gapCount += writeNotIface.length;
  }
  if (ifaceNotUsed.length) line(`   · interface 声明但本轮未见写入/默认值: ${ifaceNotUsed.join(' ')}`);
}

// 表2 结果字段命名
line('');
line('▌表2 结果字段命名对账（本节点产出 vs 读侧是否认识）');
const readKnown = new Set([...readSideFields, ...declaredDataFields, ...specialTypes]);
let misreadCount = 0;
let exemptCount = 0;
for (const r of rows) {
  if (!r.rel || r.missing) continue;
  const written = ownKeys(r).filter(isResultish);
  const child = childKeys(r).filter(isResultish);
  if (!written.length && !child.length) continue;
  const exempt = RESULT_EXEMPT[r.type] || {};
  const ok = written.filter((f) => readKnown.has(f));
  const ex = written.filter((f) => !readKnown.has(f) && exempt[f]);
  const bad = written.filter((f) => !readKnown.has(f) && !exempt[f]);
  line(`── ${r.type}`);
  if (ok.length) line(`   ✔ 读侧认识: ${ok.join(' ')}`);
  if (ex.length) {
    exemptCount += ex.length;
    line(`   ⊘ 豁免（本节点自用，非管线产出）: ${ex.join(' ')}`);
  }
  if (bad.length) {
    misreadCount += bad.length;
    line(`   ✖ 读侧不认（下游取不到 / 静默为空）: ${bad.join(' ')}`);
  }
  if (child.length) line(`   ↪ 经 spawn 子节点交付（本节点不直接产出）: ${child.join(' ')}`);
}

// 表2d 无产出声明一致性（2026-09-12，TD-02-11 收口补丁）：
// NO_OUTPUT_NODE_TYPES 声明「本类型无自有产出」→ 若它又写了产出语义字段（assetUrl/videoUrl/
// resultUrl 或 SINGLE_OUTPUT_FIELDS 声明字段），说明声明与实现矛盾：下游永远拿不到该数据
// （getNodeOutput 第 1 步直接短路返回空），属 TD-02-11 要消灭的「静默空产出」回归。
// 边界（诚实标注）：只覆盖**本节点直接自写**；经 helper 间接写回（如 assetNode 走 replaceNodeImage）
// 不在本脚本解析范围（那类节点的 ownKeys 为空），改 helper 时请人工确认产出字段归属。
line('');
line('▌表2d 无产出声明一致性（NO_OUTPUT_NODE_TYPES 的类型不得写产出字段）');
const outputFieldSet = new Set(readSideFields);
let noOutputConflictCount = 0;
for (const r of rows) {
  if (!r.rel || r.missing || !noOutputTypes.includes(r.type)) continue;
  const conflict = ownKeys(r).filter((f) => outputFieldSet.has(f));
  if (conflict.length) {
    noOutputConflictCount += conflict.length;
    line(`   ✖ ${r.type} 声明「无自有产出」却写了产出字段: ${conflict.join(' ')}`);
  }
}
if (!noOutputConflictCount) line('   ✔ 无冲突（无产出类型均未写产出字段）');

// 表2c 豁免表自检：登记了豁免但字段已不再被写入 → 表过期（防豁免表越挂越多变垃圾桶）
line('');
const staleExempt = [];
for (const [type, fields] of Object.entries(RESULT_EXEMPT)) {
  const r = rows.find((x) => x.type === type);
  if (!r) continue; // 本轮过滤未含该类型，不判过期
  const writtenNow = new Set(ownKeys(r));
  for (const f of Object.keys(fields)) {
    if (!writtenNow.has(f)) staleExempt.push(`${type}.${f}`);
  }
}
if (staleExempt.length) {
  line(`⚠ RESULT_EXEMPT 过期（字段已不再写入，请从 scripts/check-node-data.mjs 删除）: ${staleExempt.join(' ')}`);
}

// 表2b 清空遗留字段：写 undefined = 只清不写 → 说明该字段曾是产出，现已退役但仍在代码里被清理
line('');
line('▌表2b 清空遗留字段（写 undefined，曾是产出 / 待删的 schema 残留）');
let clearedCount = 0;
for (const r of rows) {
  if (!r.rel || r.missing) continue;
  const fields = [...new Set(r.sites.flatMap((s) => s.cleared))];
  if (!fields.length) continue;
  clearedCount += fields.length;
  line(`── ${r.type}: ${fields.join(' ')}`);
}
if (!clearedCount) line('   （无）');

// 表3 读写路径
line('');
line('▌表3 读写路径（写回方式分布）');
line('   type                 生成契约                patchData  setNodes写  子节点data');
for (const r of rows) {
  if (!r.rel || r.missing) continue;
  const c = (kind) => r.sites.filter((s) => s.kind === kind).length;
  line(
    `   ${r.type.padEnd(20)} ${(r.genKind || '·').padEnd(21)} ${String(c('patchData')).padEnd(10)} ${String(c('setNodes写')).padEnd(11)} ${c('子节点data')}`,
  );
}

// 收尾：映射表过期检查
line('');
const knownFiles = new Set(
  Object.values(NODE_TYPE_TO_FILE).filter(Boolean).map((p) => p.replace(NODES_DIR + '/', '')),
);
const unmapped = [];
try {
  for (const f of readdirSync(join(root, NODES_DIR))) {
    if (!f.endsWith('.tsx') || NON_NODE_FILES.has(f) || knownFiles.has(f)) continue;
    unmapped.push(f);
  }
} catch {
  /* 目录不可读则跳过 */
}
if (unmapped.length) {
  line(`⚠ nodes/ 下有未登记到 NODE_TYPE_TO_FILE 的文件（本表可能过期）: ${unmapped.join(' ')}`);
}
const noFile = Object.entries(NODE_TYPE_TO_FILE)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (noFile.length) line(`· 无组件文件（预期）: ${noFile.join(' ')}`);

line('');
line('—— 汇总 ——');
line(
  `字段缺口 ${gapCount} 处 · 结果字段读侧不认 ${misreadCount} 处 · 无产出声明冲突 ${noOutputConflictCount} 处 · 豁免 ${exemptCount} 处 · 清空遗留字段 ${clearedCount} 处 · 无 patchData 的节点 ${noPatch.length} 个`,
);
if (noPatch.length) line(`   无 patchData: ${noPatch.join(' ')}`);
const helperNodes = rows.filter((r) => r.sites.some((s) => s.indirect)).map((r) => r.type);
if (helperNodes.length) {
  line(`   经本地 patch-helper 写回（非 patchData，可能是 helper 常态，未必是债）: ${helperNodes.join(' ')}`);
}

// ── 解析器自检（2026-09-12）────────────────────────────────────────
// 【为什么必须有】本工具的结论是「差集为零 ⇒ 健康」。但差集为空的**另一种成因**是「解析器瞎了」
// （实测：`.ts` 类型标注打断「名 = [」字面形态 + 类型注解里的 `[]` 抢先命中 indexOf →
//  默认值真源（当时是 palette.data）/ NODE_OUTPUTS 恒解析出空集 → 工具连续数月报「字段缺口 0 处」
//  却什么也没看见；2026-09-12 修复解析后补上本自检）。
// 因此工具必须能证明「它看得见」：任一解析源为空即视为**自检失败**，--strict 下直接 exit 1，
// 避免「假绿」被当成「无漂移」。新增解析源时一并登记到本清单。
const parserBlind = [];
if (!dataDefaultsByType.size) parserBlind.push('nodeDataSchema.NODE_DATA_DEFAULTS');
if (!declaredOutputTypes.length) parserBlind.push('NODE_OUTPUTS 声明式产出');
if (!singleOutputFields.length) parserBlind.push('SINGLE_OUTPUT_FIELDS 单 URL 产出声明字段');
if (!rows.some((r) => r.iface.size)) parserBlind.push('节点 data interface');
if (parserBlind.length) {
  line('');
  line(`⚠ 解析器自检失败 → 上面的「0 缺口」不可信，以下解析源为空: ${parserBlind.join(' / ')}`);
  line('  （多半是源码形态漂移打瞎了正则：类型标注 / 命名变化。请修 scripts/check-node-data.mjs 的解析，勿忽略本告警。）');
}

line(strict ? '严格模式：有缺口即失败。' : '报告模式：不阻断（加 --strict 才 exit 1）。');

if (strict && (gapCount > 0 || misreadCount > 0 || noOutputConflictCount > 0 || parserBlind.length > 0))
  process.exit(1);
process.exit(0);
