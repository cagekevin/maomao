#!/usr/bin/env node
/**
 * check-arch.mjs — 架构校验（轻量版，主工程内自包含，仅依赖 @babel/parser）。
 *
 * 【为什么存在】download/.dependency-cruiser.cjs 固化了完整架构规则，但 download/ 在 .gitignore，
 * CI 装不到。这里用 @babel/parser 实现最核心的两条架构红线，挂进 check:health，让门槛在主工程内持久生效：
 *   1. no-circular —— 模块循环依赖（CLAUDE.md §5.4.2 TDZ 红线）
 *   2. base/ 禁反向依赖业务域（nodes/scriptbox/agent/panels）—— 通用地基必须单向，业务依赖 base 才正确
 *
 * 与 download/.dependency-cruiser.cjs 的关系：这里是它的「精简、自包含」等价实现，规则一致；
 * 全量图/可视化仍用 dependency-cruiser。
 *
 * 用法: node scripts/check-arch.mjs       （或 npm run check:arch）
 * 退出码: 有违规 → 1；无 → 0
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let parse;
try {
  const babelParser = await import('@babel/parser');
  parse = babelParser.parse;
} catch (e) {
  console.error('✖ 缺少 @babel/parser（devDependencies 已声明），请 npm install');
  process.exit(1);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const SRC = join(root, 'src');
const EXTS = ['.js', '.jsx', '.ts', '.tsx'];
// 更新(2026-09-09)：director3d 已解除豁免（spec/CONTEXT.md §五·五：可改、可收口），
//   原「跳过 src/components/director3d」逻辑一并移除，纳入全量架构校验。

let errors = 0;
const fail = (msg) => {
  console.log('  ❌ ' + msg);
  errors++;
};

// ── 收集源码文件 ──
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) collectFiles(full, acc);
    else if (EXTS.includes(extname(name))) acc.push(full);
  }
  return acc;
}

// ── AST 提取模块 import 说明符 → 解析绝对路径 ──
function extractImportAbs(code, filepath) {
  const out = [];
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (
        node.type === 'ImportDeclaration' ||
        node.type === 'ExportNamedDeclaration' ||
        node.type === 'ExportAllDeclaration'
      ) {
        // 跳过 type-only 边：`import type { A }` / `export type { A }` 编译后完全擦除，不构成运行时
        // 依赖，也就不存在 ESM 循环的 TDZ 问题（CLAUDE.md §5.4.2 红线针对的是运行时循环）。
        //   · ImportDeclaration.importKind === 'type'  ⇔ 纯 `import type`，跳过
        //   · 混用 `import { A, type B }` 的 importKind 是 'value'（含运行时符号）→ 保留整条边
        //   · ExportNamedDeclaration.exportKind === 'type'  ⇔ 纯 `export type`，跳过
        const kind = node.importKind || node.exportKind;
        if (kind !== 'type') out.push(node.source.value);
      } else if (
        node.type === 'CallExpression' &&
        node.callee.type === 'Import' &&
        node.arguments.length
      ) {
        const a = node.arguments[0];
        if (a.type === 'StringLiteral') out.push(a.value);
      }
      for (const k in node) {
        if (k !== 'loc' && k !== 'range' && typeof node[k] === 'object' && node[k] !== null)
          walk(node[k]);
      }
    };
    walk(ast.program);
  } catch (e) {
    /* 语法错误：交由 build/type-check 兜底，此处跳过该文件依赖追踪 */
  }
  // 解析为绝对路径（相对 + @/ 别名）
  const resolved = out
    .map((spec) => {
      if (spec.startsWith('@/')) return resolve(root, 'src', spec.slice(2));
      if (spec.startsWith('.')) return resolve(dirname(filepath), spec);
      return null; // 外部 npm 包，不参与内部循环/分层
    })
    .filter(Boolean)
    .map((abs) => resolveSourceFile(abs))
    .filter(Boolean)
    .filter((abs) => abs !== filepath);
  return [...new Set(resolved)];
}

// 扩展名无关解析（复用 ts-exts.cjs 的 resolveSourceFile 语义）
function resolveSourceFile(abs) {
  if (!abs) return null;
  try {
    if (statSync(abs).isFile()) return abs;
  } catch {}
  const stem = EXTS.includes(extname(abs)) ? abs.slice(0, abs.length - extname(abs).length) : abs;
  for (const e of EXTS) {
    const c = stem + e;
    try {
      if (statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

const files = collectFiles(SRC);
// fileAbs -> Set<depAbs>
const graph = new Map();
for (const f of files) {
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  graph.set(f, new Set(extractImportAbs(code, f)));
}
const all = new Set(graph.keys());
for (const [, deps] of graph) for (const d of deps) all.add(d);

// ── 1. 循环依赖检测（DFS，栈上节点重复即环）──
console.log('🔄 循环依赖检测（no-circular）');
const color = new Map(); // 0 未访问, 1 在栈, 2 完成
const stack = [];
let circularFound = false;
function dfs(node) {
  color.set(node, 1);
  stack.push(node);
  for (const dep of graph.get(node) || []) {
    if (!all.has(dep)) continue;
    const c = color.get(dep);
    if (c === 1) {
      circularFound = true;
      const idx = stack.indexOf(dep);
      const cycle = stack
        .slice(idx)
        .concat(dep)
        .map((x) => x.slice(root.length + 1));
      fail(`循环依赖: ${cycle.join(' → ')}`);
    } else if (!c) dfs(dep);
  }
  stack.pop();
  color.set(node, 2);
}
for (const node of graph.keys()) if (!color.get(node)) dfs(node);
if (!circularFound) console.log('  ✅ 未发现循环依赖');

// ── 2. base/ 禁反向依赖业务域（nodes/scriptbox/agent/panels）──
console.log('\n🏗 分层边界：base/ 禁止反向依赖业务域');
// 豁免：NodePalette 节点注册表单源、lazyNode 重节点懒加载包装（刻意引用 nodes，已验证无环）
const BASE_ALLOWLIST = new Set([
  join(SRC, 'components/base/canvas/NodePalette.ts'),
  join(SRC, 'components/base/canvas/lazyNode.tsx'),
]);
const BUSINESS_RE = /^src\/components\/(nodes|scriptbox|agent|panels)\//;
let baseViol = 0;
for (const [from, deps] of graph) {
  const relFrom = from.slice(root.length + 1);
  if (!relFrom.startsWith('src/components/base/')) continue;
  if (BASE_ALLOWLIST.has(from)) continue;
  for (const dep of deps) {
    const relDep = dep.slice(root.length + 1);
    if (BUSINESS_RE.test(relDep)) {
      baseViol++;
      fail(`base 反向依赖业务域: ${relFrom} → ${relDep}`);
    }
  }
}
if (!baseViol) console.log('  ✅ base/ 无反向依赖业务域');

// ── 3. 结果信封单一真源：禁另立 interface（L3c）──
console.log('\n📦 结果信封单一真源：禁另立 interface（L3c）');
// 真源 = src/types/provider.ts::GenerationResult；其余同名信封必须是 `export type X = GenerationResult` 别名。
// 用 AST 而非正则：正则会误伤注释/字符串里的同名词。
const ENVELOPE_INTERFACE_BAN = new Set([
  'GenerationResult',
  'RelayGenerationResult',
  'NodeGenerationResult',
  'GenerateResult',
]);
const ENVELOPE_TRUE_SOURCE = 'src/types/provider.ts';
let envelopeViol = 0;
for (const f of files) {
  // files：复用顶部 collectFiles(SRC) 的结果
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (rel === ENVELOPE_TRUE_SOURCE) continue; // 真源本体豁免
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.type === 'ExportNamedDeclaration' && n.declaration?.type === 'TSInterfaceDeclaration') {
      const name = n.declaration.id?.name;
      if (ENVELOPE_INTERFACE_BAN.has(name)) {
        envelopeViol++;
        fail(
          `结果信封被另立 interface: ${rel} → interface ${name}` +
            `（必须改为 \`export type ${name} = GenerationResult\` 别名，真源 ${ENVELOPE_TRUE_SOURCE}）`,
        );
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
}
if (!envelopeViol) console.log('  ✅ 无另立结果信封 interface');

// ─────────────────────────────────────────────────────────────────
// 规则 3（TD-11-8，2026-09-11）：AI 工具层禁止裸调画布写操作，必须经 canvasHost。
//
// 【为什么存在】agent/index.ts 契约写明「画布写操作 → 只经 canvasHost，禁止裸 ctx.setNodes/setEdges/addNodes」，
// 但 2026-09-11 审计实测 connect_nodes/batch_connect_nodes/delete_edge 三工具共 4 处裸调 ctx.setEdges
// 绕过唯一入口（根因：canvasHost 缺 removeEdges 原语，被逼裸调）。已补原语 + 收口，本规则防回潮。
//
// 【判定】在 agent/canvas 工具层文件里，检测「从 ctx 解构出 setNodes/setEdges/addNodes/addEdges」
// 或直接 `ctx.setNodes(...)` 调用。canvasHost.ts 本体豁免（它就是唯一实现）。
// ─────────────────────────────────────────────────────────────────
const CANVAS_WRITE_BAN = new Set(['setNodes', 'setEdges', 'addNodes', 'addEdges']);
const CANVAS_WRITE_SCOPE = 'src/components/agent/canvas/';
const CANVAS_WRITE_EXEMPT = new Set([
  'src/components/agent/canvas/canvasHost.ts', // 唯一实现本体
]);
let canvasWriteViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (!rel.startsWith(CANVAS_WRITE_SCOPE) || CANVAS_WRITE_EXEMPT.has(rel)) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  const hits = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    // ① 从 ctx 解构画布写函数：const { setNodes, ... } = ctx
    if (n.type === 'VariableDeclarator' && n.id?.type === 'ObjectPattern') {
      const init = n.init;
      const fromCtx =
        init && (init.name === 'ctx' || (init.type === 'MemberExpression' && init.property?.name === 'ctx'));
      if (fromCtx) {
        for (const p of n.id.properties || []) {
          const pname = p.key?.name || p.value?.name;
          if (CANVAS_WRITE_BAN.has(pname)) hits.push({ line: n.loc?.start?.line, name: pname });
        }
      }
    }
    // ② 直接调用 ctx.setNodes(...) / ctx.setEdges(...)
    if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
      const obj = n.callee.object;
      const prop = n.callee.property?.name;
      if (CANVAS_WRITE_BAN.has(prop) && obj && (obj.name === 'ctx' || obj.property?.name === 'ctx')) {
        hits.push({ line: n.loc?.start?.line, name: `ctx.${prop}` });
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const h of hits) {
    canvasWriteViol++;
    fail(
      `工具层裸调画布写操作: ${rel}:${h.line} → ${h.name}` +
        `（必须经 canvasHost；缺原语就在 canvasHost 补原语，勿绕过唯一入口）`,
    );
  }
}
if (!canvasWriteViol) console.log('  ✅ 工具层无裸调画布写操作（均经 canvasHost）');

// ─────────────────────────────────────────────────────────────────
// 规则 5（TD-04-15 / TD-04-16 / TD-04-17，2026-09-12）：禁止手写 `setNodes/setEdges(...)` 裸写
// node/edge 字段样板。
//
// 【为什么存在】node/edge 写回唯一入口 = patchNodeById / computePatch*（src/hooks/useNodeData.ts）
// 与 patchEdgeById / computePatchEdgesById（src/hooks/useEdgeData.ts）。此前散落的手写样板
// （同语义多实现、易漂移项），2026-09-12 审计已迁移：
//  - node.data：VideoProcessNode/Director3DNode/AssetNode/PanoramaNode（TD-04-15）+ nodeImage/
//    useScriptBoxEngine/App.commitRename/App.expanded（TD-04-15 补）
//  - node 本体 width/height/style：useNodeResize.onMainBoxResize / useFitNodeRatio（TD-04-16）
//  - edge.data：App 选中联动 relatedToSelected（TD-04-17，全库仅此 1 处 edge.data 合并写回）
//  - edge 本体 selected：App.selectAll / duplicateSelected（TD-04-17 顺手收口）
// 本规则防回潮。
//
// 【判定】全 src 扫描 `setNodes(` / `setEdges(` 调用，且其回调/参数子树内出现手写样板签名
// `...<x>.data` 或 `...<x>.(width|height|style)`（SpreadElement + MemberExpression 命中字段名）。
// 豁免：
//  - src/components/agent/：agent 写操作统一经 canvasHost（TD-11-8 工具层已守），有意分层不重复闸；
//  - patchNodeById / patchEdgeById / computePatch* 内部在 hooks/（不在 setNodes/setEdges 调用内），不误报；
//  - 批量 position 更新（不碰 data/尺寸）无该 spread，不误报；
//  - groupNodes 的 parentId/extent 写回是纯函数（不在 setNodes 调用内），不误报；
//  - setEdges append/filter/replace（建边/删边/整体替换）非「按字段合并写回」，不归本规则管。
// ─────────────────────────────────────────────────────────────────
const NODE_FIELD_SPREAD = new Set(['data', 'width', 'height', 'style']);
// 嵌套写操作（不归 node 字段规则管的维度）：递归检测时遇到这些调用不深入其参数
const WRITE_CALLS = new Set(['setNodes', 'setEdges', 'addNodes', 'addEdges', 'deleteElements', 'applyNodeChanges']);
let nodeDataViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  // agent 层由 TD-11-8 守工具层（canvasHost 唯一入口），有意分层，不重复闸
  if (rel.startsWith('src/components/agent/')) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  const findSpreadField = (node, root = true) => {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some((x) => findSpreadField(x, false));
    if (
      node.type === 'SpreadElement' &&
      node.argument?.type === 'MemberExpression' &&
      node.argument.property?.name &&
      NODE_FIELD_SPREAD.has(node.argument.property.name)
    ) {
      return true;
    }
    // 嵌套写操作（如 setNodes 回调内再调 setEdges 写 edge.data）不归 node 字段规则管，
    // 不深入其参数，避免误抓 edge.data 裸写（App.tsx:1285-1291 的 relatedToSelected 回写）。
    // 注意：仅在「递归进入的」写操作调用上生效（root=false）；最外层 setNodes/setEdges 调用（root=true）
    // 不被此边界拦截，否则其回调内的合法 spread 永不被检查（TD-04-17 修复的误判）。
    if (node.type === 'CallExpression') {
      const c = node.callee;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : null;
      if (!root && name && WRITE_CALLS.has(name)) return false;
    }
    for (const k in node) {
      if (k !== 'loc' && k !== 'range' && typeof node[k] === 'object' && node[k] !== null) {
        if (findSpreadField(node[k], false)) return true;
      }
    }
    return false;
  };
  // 专门检测「整节点/边 spread + 覆盖 selected」样板（如 {...n, selected:true}）。
  // 注意：selected 不是「spread 旧对象某字段」模式（...n.selected 不存在），而是 spread 整个对象后附加键，
  // 故无法用上面的 NODE_FIELD_SPREAD（只匹配 SpreadElement.property）捕获，需独立检测。
  const findSelectedSpread = (node, root = true) => {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some((x) => findSelectedSpread(x, false));
    if (node.type === 'ObjectExpression') {
      const hasSpread = node.properties.some((p) => p.type === 'SpreadElement');
      const hasSelected = node.properties.some(
        (p) =>
          p.type === 'ObjectProperty' &&
          (p.key?.name === 'selected' || p.key?.value === 'selected'),
      );
      if (hasSpread && hasSelected) return true;
    }
    if (node.type === 'CallExpression') {
      const c = node.callee;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : null;
      if (!root && name && WRITE_CALLS.has(name)) return false;
    }
    for (const k in node) {
      if (k !== 'loc' && k !== 'range' && typeof node[k] === 'object' && node[k] !== null) {
        if (findSelectedSpread(node[k], false)) return true;
      }
    }
    return false;
  };
  const walkSet = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walkSet);
      return;
    }
    if (n.type === 'CallExpression') {
      const c = n.callee;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : null;
      const isSet = name === 'setNodes' || name === 'setEdges';
      if (isSet && findSpreadField(n)) {
        nodeDataViol++;
        fail(
          `手写 ${name} 裸写 node/edge 字段样板: ${rel}:${n.loc?.start?.line}` +
            `（必须改调 patchNodeById/patchEdgeById 或 computePatch*，禁手写 ...n/e.data|width|height|style 样板）`,
        );
      }
      if (isSet && findSelectedSpread(n)) {
        nodeDataViol++;
        fail(
          `手写 ${name} 裸写 node/edge 选中态: ${rel}:${n.loc?.start?.line}` +
            `（必须改调 patchNodeById/patchEdgeById 或 computePatch*，禁手写 {...n, selected} 样板）`,
        );
      }
    }
    for (const k in n) {
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walkSet(n[k]);
    }
  };
  walkSet(ast.program);
}
if (!nodeDataViol)
  console.log('  ✅ 无手写 setNodes/setEdges 裸写 node/edge 字段（data/width/height/style 均经 patchNodeById/patchEdgeById）');

// ─────────────────────────────────────────────────────────────────
// 规则 6（TD-02-1，2026-09-12）：存储读写唯一入口 —— 禁止绕过 contentStore 直调底层 transport。
//
// 【为什么存在】CLAUDE.md §二 / contentStore 文件头红字：「所有业务数据读写必须走 contentStore，
// 禁止直调 storageAdapter / kv 底层」。此前该红线**只有注释、无机器强制**，实测已被绕过：
// projectStore 直调 kvSet/kvGetVersion（画布快照 CAS）+ useCanvasSync 直调 kvGetVersion。
// 旁路一旦存在，contentStore 的失败分类 / 降级 / 观测对该条数据流全部失效——红线无守卫 = 无红线。
//
// 【判定】src 下（含 hooks）：
//  - 从 localToolApi（或 api barrel `base/api`）具名导入 kvGet/kvSet/kvDelete/kvGetVersion；
//  - 从 storageAdapter（或 storage barrel `base/storage`）具名导入 sGet/sSet/sRemove。
// 命中即违规（白名单文件除外）。
//
// 【白名单（有意例外，理由见 daily/架构日志/02-存储-持久化-二轮深扫-2026-09-12.md §一.2）】
//  - contentStore.ts：唯一入口本体，它才是这些底层的合法消费者；
//  - base/storage/**：底层实现内部互引（storageAdapter / index / storageQuota / kvStore 壳）；
//  - conversationState.ts：KV 迁移需回读旧 local 存量（键已登记 kv 后端，走 contentStore 会读错后端）；
//  - director3d/**：第三方域（§五·五 明示例外，不走本项目存储键体系）。
// ─────────────────────────────────────────────────────────────────
const KV_TRANSPORT_SYMBOLS = new Set(['kvGet', 'kvSet', 'kvDelete', 'kvGetVersion']);
const LOCAL_ADAPTER_SYMBOLS = new Set(['sGet', 'sSet', 'sRemove']);
function storageBypassAllowed(rel) {
  return (
    rel === 'src/components/base/core/contentStore.ts' ||
    rel.startsWith('src/components/base/storage/') ||
    rel === 'src/components/agent/conversation/conversationState.ts' ||
    rel.startsWith('src/components/director3d/')
  );
}
let storageBypassViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (storageBypassAllowed(rel)) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  for (const st of ast.program.body) {
    if (st.type !== 'ImportDeclaration') continue;
    const spec = st.source.value || '';
    const isKvTransport =
      /(^|\/)localToolApi(\.ts)?$/.test(spec) || /(^|\/)api(\/index)?(\.ts)?$/.test(spec);
    const isLocalAdapter =
      /(^|\/)storageAdapter(\.ts)?$/.test(spec) || /(^|\/)storage(\/index)?(\.ts)?$/.test(spec);
    if (!isKvTransport && !isLocalAdapter) continue;
    const banned = isKvTransport ? KV_TRANSPORT_SYMBOLS : LOCAL_ADAPTER_SYMBOLS;
    for (const s of st.specifiers || []) {
      const nm = s.imported?.name || s.local?.name;
      if (nm && banned.has(nm)) {
        storageBypassViol++;
        fail(
          `绕过存储唯一入口直调底层: ${rel}:${st.loc?.start?.line} → import { ${nm} } from '${spec}'` +
            `（必须经 contentStore：尽力而为族 contentSet/Get/Delete(+Async)，严格族 contentKvGetVersion/contentKvSetCas）`,
        );
      }
    }
  }
}
if (!storageBypassViol)
  console.log('  ✅ 无绕过 contentStore 直调存储底层（唯一入口红线成立）');

// ─────────────────────────────────────────────────────────────────
// 规则 7（TD-02-12，2026-09-12）：KV 后端键禁止「同步读」——必须 contentGetAsync / 严格族。
//
// 【为什么存在】`contentGet`（同步）对 **backend:'kv'** 的键在缓存未命中时只能返回 `undefined`：
// 它表达的是「未知」，与「键不存在」同值；而 KV 键的真实数据在 localTool 后端，只有
// `contentGetAsync`（或严格族 `contentKvGetVersion`/`contentKvSetCas`）才有权威语义。
// 用同步读读 KV 键 → 冷启动/缓存未命中时把「未知」当「不存在」→ **水化出空数据**
// （AI 会话迁移已真实踩过一次：docs/AI助手会话迁移-KV收口事实记录.md §读取路径）。
// 2026-09-12 普查时全库 0 处违规，但纯靠人工审：新增调用方写 `contentGet(CANVAS_STATE_PREFIX + id)`
// 无人拦 —— 本条把它变成机器红线（假护栏的教训：规则存在但不生效比没有更糟）。
//
// 【判定】src 下对同步 `contentGet(...)` 的**第一实参**做受限静态求值：
//   StringLiteral / 嵌套 `+` 拼接 / TemplateLiteral（丢弃 ${...} 占位视为通配）/ Identifier
//   （先查本文件字符串常量表，再查「全 src 唯一定义」的常量名 → 覆盖 import 进来的前缀常量）
//   → 拼出候选键文本；命中任一 KV 键前缀 / 精确键 → 违规。
//   求值不到（函数调用等）→ **不猜**（诚实免责，见「已知边界」）。
//
// 【豁免】contentStore.ts（入口本体）/ base/storage/**（底层自持原始键语义）/
//   director3d/**（第三方域，同规则 6 §五·五 例外）。
//
// 【已知边界（诚实标注）】
//   - 只覆盖**直接出现在调用点**的键文本；经多层变量传递、跨文件函数返回的键无法静态求值（宁漏不猜）；
//   - 只查同步 `contentGet`。`contentHas` 有同类隐患（「未知」与「不存在」同值），当前全库无 KV 键
//     用法故不纳入；若将来出现，把本规则 CALLEES 扩成 Set(['contentGet','contentHas']) 即可。
// ─────────────────────────────────────────────────────────────────
const KV_SYNC_READ_SCOPE_EXEMPT = (rel) =>
  rel === 'src/components/base/core/contentStore.ts' ||
  rel.startsWith('src/components/base/storage/') ||
  rel.startsWith('src/components/director3d/');

const kvKeyPrefixes = new Set();
const kvKeyExact = new Set();
try {
  const mod = await import(pathToFileURL(join(SRC, 'components/base/core/contracts.ts')).href);
  for (const [k, v] of Object.entries(mod.STORAGE_KEYS || {})) {
    if (v?.backend !== 'kv') continue;
    const brace = k.indexOf('{');
    if (brace > 0) kvKeyPrefixes.add(k.slice(0, brace));
    else kvKeyExact.add(k);
  }
} catch (e) {
  console.log('  ⚠ 规则 7 无法加载 contracts.ts 的 STORAGE_KEYS（' + e.message + '）');
}
const KV_PREFIX_LIST = [...kvKeyPrefixes];
const isKvKeyText = (s) => !!s && (kvKeyExact.has(s) || KV_PREFIX_LIST.some((p) => s.startsWith(p)));
// 解析器自检（fail-loud）：解析源为空时上面的「✅ 无违规」不可信（假绿），必须报警而非放过。
// 教训来源：TD-02-9（check-node-data 因解析被打瞎却长期报 0 缺口）。
if (KV_PREFIX_LIST.length === 0 && kvKeyExact.size === 0) {
  fail('规则 7 解析源为空：未能从 contracts.ts 的 STORAGE_KEYS 取到任何 backend:"kv" 键 → 本规则未生效（勿当通过）');
}

// ── 字符串常量表（规则 7 静态求值用）：本文件表 + 「全 src 唯一定义」的全局表 ──
const fileConsts = new Map(); // absPath -> Map(name -> literal)
const nameDefCount = new Map(); // name -> 定义次数（跨文件歧义名不参与全局求值，避免同名误解析）
const nameValue = new Map();
for (const f of files) {
  const map = new Map();
  let ast;
  try {
    ast = parse(readFileSync(f, 'utf8'), {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (
      n.type === 'VariableDeclarator' &&
      n.id?.type === 'Identifier' &&
      n.init?.type === 'StringLiteral'
    ) {
      map.set(n.id.name, n.init.value);
      nameDefCount.set(n.id.name, (nameDefCount.get(n.id.name) || 0) + 1);
      nameValue.set(n.id.name, n.init.value);
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  fileConsts.set(f, map);
}
/** 受限静态求值：能拼出确定文本就返回，否则返回 ''（宁漏不猜） */
const resolveConstText = (node, consts) => {
  if (!node) return '';
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'TemplateLiteral')
    return (node.quasis || []).map((q) => q.value.raw).join(''); // ${...} 丢掉 → 前缀仍可判
  if (node.type === 'BinaryExpression' && node.operator === '+')
    return resolveConstText(node.left, consts) + resolveConstText(node.right, consts);
  if (node.type === 'Identifier') {
    if (consts.has(node.name)) return consts.get(node.name);
    // import 进来的常量（如 contracts.CANVAS_STATE_PREFIX）：仅当全 src 唯一定义时才敢用
    if (nameDefCount.get(node.name) === 1) return nameValue.get(node.name);
    return '';
  }
  return '';
};

let kvSyncReadViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (KV_SYNC_READ_SCOPE_EXEMPT(rel)) continue;
  let ast;
  try {
    ast = parse(readFileSync(f, 'utf8'), {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    continue;
  }
  const consts = fileConsts.get(f) || new Map();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'CallExpression') {
      const c = n.callee;
      const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : null;
      if (name === 'contentGet' && n.arguments?.length) {
        const keyText = resolveConstText(n.arguments[0], consts);
        if (isKvKeyText(keyText)) {
          kvSyncReadViol++;
          fail(
            `KV 后端键被同步读: ${rel}:${n.loc?.start?.line} → contentGet(${keyText}…)` +
              `（KV 键缓存冷时同步读返回 undefined = 「未知」而非「不存在」，会水化出空数据；` +
              `必须用 contentGetAsync，或严格族 contentKvGetVersion/contentKvSetCas）`,
          );
        }
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
}
if (!kvSyncReadViol)
  console.log('  ✅ 无 KV 后端键同步读（KV 键均走 contentGetAsync / 严格族）');

// ─────────────────────────────────────────────────────────────────
// 规则 8（TD-03-5 裁定，2026-09-13）：实现层深路径禁绕行 —— 唯一入口红线的可执行化。
//
// 【背景】`base/api/index.ts` 等 barrel 的注释红线是「外部只从本入口 import（禁绕深层路径）」，
// 但**只有注释、无机器守卫**。审计发现 2 处绕行（d3dPersistence/ImageBoxNode 直引 api/filesApi.ts）。
//
// 【裁定（非「强行统一」，而是划清真边界）】审计时实测：base/api/* 深路径与 barrel **指向同一模块**，
// 绕 barrel 并不绕过任何实现；且 22 个测试按「模块名 api/filesApi.ts」mock 是**既定契约**
// （改 mock barrel 需列全 barrel 导出 → 测试脆弱度↑、收益 0）。故：
//   · `base/api/*` 深路径 = **合法契约边界**（可按模块名 import / mock），不纳本规则；
//   · 危险的是绕**实现层**深路径（`base/storage/*`、`base/core/contentStore` 等）——那里才是
//     「改内部实现会打爆外部」的真风险，也才是红线要防的东西。
// 本规则即把「实现层禁绕行」变成机器红线，补上原注释级无守卫的缺口。
//
// 【判定】业务代码（非 base/ 内部、非 tests）import `base/storage/<impl>` 深路径
// （storageAdapter/index/kvStore/storageQuota）→ 违规（必须经 `base/storage/index.ts` barrel 或更高层入口）。
// ─────────────────────────────────────────────────────────────────
const STORAGE_IMPL_DEEP = /^src\/components\/base\/storage\/(?!index\.ts$)[^/]+$/;
let deepImportViol = 0;
for (const [from, deps] of graph) {
  const relFrom = from.slice(root.length + 1).replace(/\\/g, '/');
  // base/storage/** 内部互引合法；其余才查
  if (relFrom.startsWith('src/components/base/storage/')) continue;
  for (const dep of deps) {
    const relDep = dep.slice(root.length + 1).replace(/\\/g, '/');
    if (STORAGE_IMPL_DEEP.test(relDep)) {
      deepImportViol++;
      fail(
        `绕实现层深路径 import: ${relFrom} → ${relDep}` +
          `（storage 实现层必须经 base/storage/index.ts 唯一入口，勿直引内部实现文件）`,
      );
    }
  }
}
if (!deepImportViol) console.log('\n  ✅ 无绕实现层深路径 import（storage 均经 index.ts 入口）');

console.log(`\n${errors === 0 ? '✅ 架构校验通过' : `❌ ${errors} 处架构违规`}`);
process.exit(errors === 0 ? 0 : 1);
