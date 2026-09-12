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
import { fileURLToPath } from 'node:url';

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

console.log(`\n${errors === 0 ? '✅ 架构校验通过' : `❌ ${errors} 处架构违规`}`);
process.exit(errors === 0 ? 0 : 1);
