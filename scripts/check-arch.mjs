#!/usr/bin/env node
/**
 * check-arch.mjs — 架构校验（轻量版，主工程内自包含，仅依赖 @babel/parser）。
 *
 * 【为什么存在】架构红线的历史落点曾是 audit/ 沙盒里的 .dependency-cruiser.cjs，但它装在 .gitignore
 * 的目录、CI 装不到 → 规则不生效。故用主工程依赖 @babel/parser 自包含实现架构红线，挂进闸体系
 * （gates.manifest push 层 + check:health），让门槛在主工程内持久生效：
 *   1. no-circular —— 模块循环依赖（CLAUDE.md §5.4.2 TDZ 红线）
 *   2. base/ 禁反向依赖业务域（nodes/scriptbox/agent/panels）—— 通用地基必须单向，业务依赖 base 才正确
 *   （另含：结果信封 / 工具层写操作 / 裸写 node 字段 / 存储唯一入口 / KV 同步读 / 深路径，见下方各规则）
 *
 * 【与 audit/ 的关系（2026-09-13 · TD-17-1）】audit/ 沙盒已退役，本文件即架构规则的**唯一落点**
 * （原「全量图/可视化另用 dependency-cruiser」的补充形态随之取消——不留孤岛）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸**（分层边界，非 CLAUDE 级物理契约）—— 只有红线闸不可自行放宽；
 *               本闸属"默认值"，可被"正确性 / 复杂度"证据推翻。
 *   Q2 何时该改：它拦住了"让同一语义的**份数下降**"的动作（收口 / 下沉 / 去重）→ 该改。
 *   Q3 怎么改：① 清单式白名单 → **反向判据**（清单必漏：漏一个目录就要再改一次闸，这本身是母体）；
 *               ② **只收窄不放宽**（取证掉"放宽整个目录"的诱惑）；③ 改完跑**闸探针先红后绿**
 *               （注入正例 → 精确红；注入反例 → **仍红**，证明没放过头）。统一走 `node scripts/probe.mjs`。
 *   先例与实证：规则 2 与规则 4 的两次「清单 → 反向判据」；规则 4 的【★改】段 —— 原「文件级白名单」
 *               把 `core/` 逼成内联重写 7 遍（文件头写着"严禁在此重写"，正文却只能重写
 *               = **闸把作者逼成了它禁止的样子**）。
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

// ── 2. base/ 禁反向依赖业务域（**反向判据**，非手写域名清单）· docs/123 G-1 ──
// 【为什么改成反向判据（7 步法附录 A4）】原实现用 BUSINESS_RE 手写域名（nodes|scriptbox|agent|panels）。
// 「每来一个业务域就要记得加一次」**本身就是母体**：下一个业务域（videoEditor / edges / …）必然重演同一坑。
// 实测已漏：`src/components/edges/` 不在名单内 → `base/ui/NodeShell.tsx → edges/CustomHandle.tsx` 长期无守卫
//   （该边已修：CustomHandle 下沉 `base/ui/`，2026-09-13 —— 反向判据上线即抓出它，正是本改法的价值证明）。
// 反向判据 = base/ 不得 import `src/components/` 下**任何非 base/ 目录**：一次改完，自动覆盖未来所有业务域。
console.log('\n🏗 分层边界：base/ 禁止反向依赖业务域（反向判据）');
// 豁免：NodePalette 节点注册表单源、lazyNode 重节点懒加载包装（刻意引用 nodes，已验证无环）
const BASE_ALLOWLIST = new Set([
  join(SRC, 'components/base/canvas/NodePalette.ts'),
  join(SRC, 'components/base/canvas/lazyNode.tsx'),
]);
let baseViol = 0;
for (const [from, deps] of graph) {
  const relFrom = from.slice(root.length + 1).replace(/\\/g, '/');
  if (!relFrom.startsWith('src/components/base/')) continue;
  if (BASE_ALLOWLIST.has(from)) continue;
  for (const dep of deps) {
    const relDep = dep.slice(root.length + 1).replace(/\\/g, '/');
    if (relDep.startsWith('src/components/') && !relDep.startsWith('src/components/base/')) {
      baseViol++;
      fail(`base 反向依赖业务域: ${relFrom} → ${relDep}`);
    }
  }
}
if (!baseViol) console.log('  ✅ base/ 无反向依赖业务域');

// ─────────────────────────────────────────────────────────────────
// 规则 4（docs/123 G-2，2026-09-13）：videoEditor/core 导入白名单 ——「零 React / 零 IO」的结构守卫。
//
// 【为什么是一条白名单而不是三条禁令】写「禁 React / 禁 IO / 禁 fetch」必漏（漏掉 lucide、zustand、
// 任何新库）；白名单是**补集**形态——只留两条出路，其余一律违规，一条规则覆盖全部外来依赖。
//
// 【判定】`src/components/videoEditor/core/**` 的每个 import / export-from / 动态 import 的 specifier：
//   · 相对或 `@/` 路径 → 解析后必须落在 `videoEditor/core/` 内，或落在下面白名单目录内；
//   · 裸 specifier（npm 包：react / @xyflow/react / mediabunny …）→ 一律违规。
//   含 `import type`：type-only 虽编译期擦除，但「core 零 React」是**认知边界**，不许靠擦除绕过。
//
// 【★改：文件白名单 → 目录白名单（2026-09-14，附取证）】
// 原实现是「一个具体文件」白名单（只放行 `base/core/idGen.ts`），后果是：
//   `core/timelineOps.ts` **无法复用**已下沉的映射原语 `base/utils/timeline/sourceTime.ts`，
//   于是它在文件头写着「直接复用、严禁在此重写」，正文却**内联重写了 4 遍**同一公式
//   （`:284/303/316/342`）—— 闸把作者逼成了自己禁止的样子。
// 原想放宽整个 `base/utils/`，**取证后否决**：该目录**不是**纯函数层 ——
//   `assetUrl.ts` import react（useCallback）、`audioPeaks.ts`/`videoEngine.ts` import mediabunny。
//   放行整个目录 = 把 React 与重编码器也放进来，闸真废。
// 故收窄为**只放行 `base/utils/timeline/`**：实测该目录三个文件（sourceTime / timeScale / rulerTicks）
//   **零 import**（`rg '^import' → 0 命中`），是真正的零依赖纯函数层，正是本闸要放行的对象。
// 判据从「白名单某个文件」改为「白名单某个**层**」⇒ 该层新增纯函数模块**不必再回来手改清单**
//   （消除「加一个合法模块就要改一次闸」这条母体，与规则 2 改反向判据同款手法）。
// ─────────────────────────────────────────────────────────────────
const VE_CORE_REL = 'src/components/videoEditor/core/';
// 白名单**目录**（纯函数层）。理由见上方「★改」段：timeline/ 实测零 import。
const VE_CORE_ALLOW_DIRS = ['src/components/base/core/', 'src/components/base/utils/timeline/'];
// 【2026-09-14 删】此处原有"白名单**文件**"容器 `VE_CORE_ALLOW = new Set([])` —— 实测**恒空、零填充点**
//   （唯一加载点只读不写）→ 属本仓已批过的「幽灵预留 / 假接缝」（7步法 铁律 5：只有一种实现的接缝即假接缝；
//   区域 20 清偿轮清过同类）。它的真实成本是**误导**：让人以为存在"单文件豁免"机制。
//   将来真出现"该层不成目录 / 或该目录非纯函数层"的合法单文件场景 → **到时有真实消费方再加**，并同步本注释。
let veCoreViol = 0;
let veCoreScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (!rel.startsWith(VE_CORE_REL)) continue;
  veCoreScanned++;
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
  const bad = [];
  const judge = (spec, line) => {
    if (!spec) return;
    let relDep = null;
    if (spec.startsWith('.')) {
      const abs = resolveSourceFile(resolve(dirname(f), spec));
      if (abs) relDep = abs.slice(root.length + 1).replace(/\\/g, '/');
    } else if (spec.startsWith('@/')) {
      const abs = resolveSourceFile(resolve(root, 'src', spec.slice(2)));
      if (abs) relDep = abs.slice(root.length + 1).replace(/\\/g, '/');
    } else {
      bad.push({ spec: `${spec}（外部依赖）`, line });
      return;
    }
    if (
      relDep &&
      (relDep.startsWith(VE_CORE_REL) ||
        VE_CORE_ALLOW_DIRS.some((dir) => relDep.startsWith(dir)))
    )
      return;
    bad.push({ spec: relDep ? `${spec} → ${relDep}` : spec, line });
  };
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (
      (n.type === 'ImportDeclaration' ||
        n.type === 'ExportNamedDeclaration' ||
        n.type === 'ExportAllDeclaration') &&
      n.source?.value
    ) {
      judge(n.source.value, n.loc?.start?.line);
    }
    if (n.type === 'ImportExpression' && n.source?.type === 'StringLiteral') {
      judge(n.source.value, n.loc?.start?.line);
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const b of bad) {
    veCoreViol++;
    fail(
      `videoEditor/core 越界依赖: ${rel}:${b.line} → ${b.spec}` +
        `（core 只准 import videoEditor/core/** 与 base/core/ · base/utils/timeline/；零 React / 零存储 / 零网络）`,
    );
  }
}
console.log(
  `\n🧱 videoEditor/core 导入白名单（零 React / 零 IO）· 已扫描 ${veCoreScanned} 个 core 文件` +
    (veCoreScanned === 0 ? '（core/ 尚未创建，G1 落码起生效）' : ''),
);
if (!veCoreViol)
  console.log(
    veCoreScanned === 0
      ? '  ⚠️ 目标目录不存在 ⇒ 本规则当前**未生效**（别读成"通过"；目录改名/迁移后要回来对路径 —— TD-22-53）'
      : '  ✅ core 依赖未越界（仅 core/** 与 base/core/ · base/utils/timeline/）',
  );

// ─────────────────────────────────────────────────────────────────
// 规则 6（2026-09-13）：`videoEditor/hooks/**` 禁依赖 `videoEditor/export/**` —— 播放/探测域不得反向依赖导出域。
//
// 【为什么】（docs/123 §二 的依赖方向 + 亲历教训）判据/探测/预览是**读/领域**，导出是**写/环境**。
//   hooks（useEditorSources / useEditorFilmstrips / useEditorWaveforms）若为取一个
//   判据或工具去 import `export/composite`，就会把「它要一个纯函数」变成「拉进整个导出域（含 mediabunny）」
//   —— 既制造播放→导出倒挂，又放大依赖半径。判据一律收在 `core/`（见 `routeClip.audibleClipsOf` 上移）。
// 【判定】只拦「相对/`@/` import 解析后落在 `videoEditor/export/`」；裸 spec（react 等）不禁（hooks 可用外部库）。
// 【防回潮】将来 hooks 需要"可闻/某判据" → 从 `core/routeClip.ts` 取，不许 import export。
// ─────────────────────────────────────────────────────────────────
const VE_HOOKS_REL = 'src/components/videoEditor/hooks/';
const VE_EXPORT_REL = 'src/components/videoEditor/export/';
let veHooksExportViol = 0;
let veHooksScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (!rel.startsWith(VE_HOOKS_REL)) continue;
  veHooksScanned++;
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
  const bad = [];
  const judge = (spec, line) => {
    if (!spec) return;
    let relDep = null;
    if (spec.startsWith('.')) {
      const abs = resolveSourceFile(resolve(dirname(f), spec));
      if (abs) relDep = abs.slice(root.length + 1).replace(/\\/g, '/');
    } else if (spec.startsWith('@/')) {
      const abs = resolveSourceFile(resolve(root, 'src', spec.slice(2)));
      if (abs) relDep = abs.slice(root.length + 1).replace(/\\/g, '/');
    } else {
      return; // 裸 spec（npm 库）不加限制
    }
    if (relDep && relDep.startsWith(VE_EXPORT_REL)) bad.push({ spec: relDep, line });
  };
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (
      (n.type === 'ImportDeclaration' ||
        n.type === 'ExportNamedDeclaration' ||
        n.type === 'ExportAllDeclaration') &&
      n.source?.value
    ) {
      judge(n.source.value, n.loc?.start?.line);
    }
    if (n.type === 'ImportExpression' && n.source?.type === 'StringLiteral') {
      judge(n.source.value, n.loc?.start?.line);
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const b of bad) {
    veHooksExportViol++;
    fail(
      `videoEditor/hooks 反向依赖导出域: ${rel}:${b.line} → ${b.spec}` +
        `（hooks 是播放/探测域，不许 import export/**；判据一律从 core/ 取）`,
    );
  }
}
console.log(
  `\n📴 videoEditor/hooks 禁依赖 export（播放/探测 ≠ 导出）· 已扫描 ${veHooksScanned} 个 hooks 文件`,
);
if (!veHooksExportViol)
  console.log(
    veHooksScanned === 0
      ? '  ⚠️ 目标目录不存在 ⇒ 本规则当前**未生效**（别读成"通过"；目录改名/迁移后要回来对路径 —— TD-22-53）'
      : '  ✅ hooks 未反向依赖导出域',
  );

// ─────────────────────────────────────────────────────────────────
// 规则 7（2026-09-15 · TD-22-31）：`videoEditor/types/**` 不得依赖 `videoEditor/engine/**`。
//
// 【为什么】类型契约层是全仓**最底层**：engine（实现层）依赖 types 才对；反向即**层位倒置**，
//   埋循环依赖隐患（engine 改类型签名时要先想 types 会不会被拉进来）。
//
// 【为什么「禁 engine」而不是「白名单放行 types/constants/utils」】types 层实测只依赖
//   types / constants / utils。用白名单会把"types 能依赖什么"钉死 —— 将来多一个 L0 目录就要回来
//   改闸（"每加一个目录记得改一次闸"本身就是母体，规则 2/4 都因它改过判据形态）。
//   反向判据只禁"往上跑"的那一条边，其余不碰。
//
// 【含 `import type`】层位是**认知边界**，不许靠编译期擦除绕过（与规则 4 同口径）。
//
// 【上线前的实测背景（2 处反向边，两种形态两种修法，{@link 见区域日志}）】
//   · `types/assets.ts → engine/services/storage/types`（`MediaAssetData`）：它**零 engine 依赖**
//     ⇒ **下沉**到 `types/assets.ts`，engine 侧改 `export type { … }` re-export（消费方零改动）；
//   · `types/keybinding.ts → engine/lib/actions`（`TActionWithOptionalArgs`）：它由 action 定义表
//     推导，**下不去**（总不能把整张表拖进类型层）⇒ 把**消费方类型** `KeybindingConfig` **上移**到
//     `engine/lib/actions/types.ts`（engine 依赖 types 合法）。
//   ⇒ 都收敛到同一条不变式：**types 不 import engine**。
// ─────────────────────────────────────────────────────────────────
// ⚠️ 这里**不带 `src/` 前缀**：下面用 `join(SRC, VE_TYPES_REL)` 拼绝对路径，
// 若常量本身含 `src/` 会拼成 `…/src/src/…` ⇒ 永远 0 命中（闸静默失效）。
const VE_TYPES_REL = 'components/videoEditor/types/';
let veTypesScanned = 0;
let veTypesViol = 0;
for (const f of files) {
  if (!resolve(f).startsWith(join(SRC, VE_TYPES_REL))) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  veTypesScanned++;
  const bad = [];
  const judge = (spec, line) => {
    if (typeof spec === 'string' && spec.startsWith('@videoEditor/engine')) bad.push({ spec, line });
  };
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch {
    continue;
  }
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (
      (n.type === 'ImportDeclaration' ||
        n.type === 'ExportNamedDeclaration' ||
        n.type === 'ExportAllDeclaration') &&
      n.source?.value
    ) {
      judge(n.source.value, n.loc?.start?.line);
    }
    if (n.type === 'ImportExpression' && n.source?.type === 'StringLiteral') {
      judge(n.source.value, n.loc?.start?.line);
    }
    for (const k in n) if (k !== 'loc' && k !== 'range') walk(n[k]);
  };
  walk(ast.program);
  for (const b of bad) {
    veTypesViol++;
    fail(
      `videoEditor/types 反向依赖 engine: ${resolve(f).slice(SRC.length + 1)}:${b.line} → ${b.spec}` +
        `（类型契约层是最底层，不许 import engine/**；零依赖的类型→下沉到 types，下不去的→把消费方上移到 engine）`,
    );
  }
}
console.log(
  `\n🧱 videoEditor/types 禁依赖 engine（层位摆正）· 已扫描 ${veTypesScanned} 个 types 文件`,
);
if (!veTypesViol) console.log('  ✅ types 层无反向依赖 engine');

// ─────────────────────────────────────────────────────────────────
// 规则 5（docs/123 G-3，2026-09-13）：激活位判据单点 —— 外部禁直调底层 `hasModalLayer()`。
//
// 【取证（Step 1 证伪）】该需求**已由前置收口卡 9 完成**，不是待建：
//   · 唯一真源：`modalLayer.ts:169 isCanvasSuppressed()`；
//   · 查询式消费：`useCanvasShortcuts.ts:80`；
//   · 订阅式消费：`App.tsx:1131 useSyncExternalStore(subscribeModalLayer, isCanvasSuppressed)`；
//   · 单测：`tests/unit/modalLayer.test.ts:188-202`（「让位消费方认的是同一判据」）。
// 故本规则不新建判据，只做**防回潮**：`hasModalLayer()` 是底层原语，外部一旦直调 = 自建第二处判据（必漂）。
// 将来剪辑器接入「激活位」→ **只在 `isCanvasSuppressed()` 里 `||` 一项**，本规则保证没有第二个落点。
// ─────────────────────────────────────────────────────────────────
const MODAL_LAYER_REL = 'src/components/base/core/modalLayer.ts';
let suppressionJudgeViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (rel === MODAL_LAYER_REL) continue;
  if (!rel.startsWith('src/')) continue;
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
  for (const st of ast.program.body) {
    if (st.type !== 'ImportDeclaration') continue;
    for (const s of st.specifiers || []) {
      if ((s.imported?.name || s.local?.name) === 'hasModalLayer') {
        suppressionJudgeViol++;
        fail(
          `激活位判据被复制: ${rel}:${st.loc?.start?.line} → import { hasModalLayer } from '${st.source.value}'` +
            `（外部只准用唯一真源 isCanvasSuppressed()；要加新让位条件请改 modalLayer.ts 内的 isCanvasSuppressed）`,
        );
      }
    }
  }
}
if (!suppressionJudgeViol)
  console.log('  ✅ 激活位判据单点（外部无直调 hasModalLayer 的第二处判据）');

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
/**
 * 豁免域 —— **与规则 6 的 `storageBypassAllowed` 故意不同，勿统一**（7步法 Step 3：判据重复 ≠ 探测重复）。
 *   本规则管「**可否同步读 KV 键**」，规则 6 管「**可否直调底层存储函数**」—— 语义不同，故例外集也不同：
 *   规则 6 多豁免 `conversationState.ts`（KV 迁移需**回读旧 local 存量**），而它读的是 **local 键、不是 KV 键**
 *   ⇒ 规则 7 本就不会命中它，**无需**在此豁免（少了它 ≠ 漂移，是判据差异）。
 *   三处理由与规则 6 同源：唯一入口本体 / 底层实现互引 / 第三方域（§五·五）。
 */
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

// ─────────────────────────────────────────────────────────────────
// 规则 9（TD-02-23 收口，2026-09-13）：`projects` 键 SSOT —— module 态唯一真源，cache 只是同步副本。
//
// 【为什么存在】`projectStore` 的 module 态 `projects` 与 contentStore 同键（'projects'）的 cache
// 是两份内存真相，此前靠「每改必 contentSet」的**纸面约定**同步（无结构保证、无守卫）。
// 收口后：module 态 = 唯一真源；`persist()` 即时写 cache（cache 不再滞后 300ms，仅后端保存防抖）；
// store 内所有赋值集中到 `writeProjects()`。本规则把这条红线机器化：
//  ① 非 projectStore 文件**禁直读** cache（`contentGet('projects')`）——应走 `getAllProjects()` /
//     `useProjects()` / `getCurrentProject()`（cache 是副本，且绕过项目过滤/快照语义）；
//  ② projectStore 内对 `projects` 的赋值**必须**落在 `writeProjects` 内，或带 `// write-ok: <理由>` 显式豁免。
// ─────────────────────────────────────────────────────────────────
const PROJECTS_ASSIGN_RE = /^\s*projects\s*=[^=]/;
let projectsSSoTViol = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const isStore = rel === 'src/components/base/store/projectStore.ts';
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

  if (!isStore) {
    // ① 外部禁直读 projects cache
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.type === 'CallExpression') {
        const c = n.callee;
        const a0 = n.arguments?.[0];
        if (
          c?.type === 'Identifier' &&
          c.name === 'contentGet' &&
          a0?.type === 'StringLiteral' &&
          a0.value === 'projects'
        ) {
          projectsSSoTViol++;
          fail(
            `直读 projects cache: ${rel}:${n.loc?.start?.line} → contentGet('projects')` +
              `（module 态才是唯一真源；请用 getAllProjects()/useProjects()/getCurrentProject()）`,
          );
        }
      }
      for (const k in n)
        if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
    };
    walk(ast.program);
  } else {
    // ② store 内赋值只走 writeProjects（或显式 // write-ok: 豁免）
    let wpStart = 0;
    let wpEnd = Number.MAX_SAFE_INTEGER;
    for (const st of ast.program.body) {
      if (st.type === 'FunctionDeclaration' && st.id?.name === 'writeProjects') {
        wpStart = st.loc.start.line;
        wpEnd = st.loc.end.line;
      }
    }
    code.split('\n').forEach((ln, i) => {
      const lineNo = i + 1;
      if (!PROJECTS_ASSIGN_RE.test(ln)) return;
      if (lineNo >= wpStart && lineNo <= wpEnd) return;
      if (ln.includes('write-ok:')) return;
      projectsSSoTViol++;
      fail(
        `projects 赋值绕过唯一写点: ${rel}:${lineNo}` +
          `（必须走 writeProjects()，或加 // write-ok: <理由> 显式豁免）`,
      );
    });
  }
}
if (!projectsSSoTViol)
  console.log(
    '\n  ✅ projects 键 SSOT 成立（module 态唯一真源；外部无直读 cache、store 内无绕过 writeProjects 的赋值）',
  );

// ─────────────────────────────────────────────────────────────────
// videoEditor 引用纪律（TD-22-27，2026-09-15）：禁对 tracks / elements / transitions 数组**原地变异**。
//
// 【为什么】命令栈的 undo 靠 `savedState`（= `getTracks()` 的返回值）回写。若快照与 store 共享引用，
//   undo 的正确性就**完全依赖「所有写路径都不可变重建」这条纪律** —— 任何一处原地变异
//   （`track.elements.push(...)` / `tracks.sort(...)`）= 快照被同步污染 = **undo 静默失效**
//   （用户按撤销没反应，而数据已经错了）。纪律没有守卫 → 必然回潮（本仓 M2 母体：红线只在注释里）。
// 【判据】videoEditor 域内**禁止**对 `*.elements` / `*.transitions` / `*.tracks` 调数组变异方法。
//   合法写法 = **先复制再变异**：`[...track.elements].sort(...)`（`transition-utils.ts` 的 `findAdjacentPairs` 正是此形）。
// 【诚实边界】本闸只覆盖**数组级**原地变异（可静态判定、零误报）；
//   元素**属性级**改写（`el.startTime = x`）与对象字面量赋值无法机械区分，仍靠不可变重建纪律 ——
//   本闸**不假装覆盖它**（假覆盖比不覆盖更坏：会让后人以为已有守卫）。
// ─────────────────────────────────────────────────────────────────
console.log('\n🔒 videoEditor 引用纪律：快照与 store 隔离，禁数组原地变异（TD-22-27）');
const VE_ARRAY_MUTATORS = new Set([
  'push',
  'pop',
  'splice',
  'sort',
  'reverse',
  'shift',
  'unshift',
  'fill',
  'copyWithin',
]);
const VE_ARRAY_TAILS = new Set(['elements', 'transitions', 'tracks']);
const VE_IMMUTABLE_SCOPE = 'src/components/videoEditor/';
let veImmutableViol = 0;
let veImmutableScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  if (!rel.startsWith(VE_IMMUTABLE_SCOPE)) continue;
  if (rel.startsWith('src/components/videoEditor/types/')) continue; // 纯类型层，无运行时代码
  veImmutableScanned++;
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
  const hits = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
      const method = n.callee.property?.name;
      const obj = n.callee.object;
      if (
        VE_ARRAY_MUTATORS.has(method) &&
        obj?.type === 'MemberExpression' &&
        VE_ARRAY_TAILS.has(obj.property?.name)
      ) {
        hits.push({ line: n.loc?.start?.line, tail: obj.property.name, method });
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const h of hits) {
    veImmutableViol++;
    fail(
      `对 \`${h.tail}\` 数组原地变异: ${rel}:${h.line} → .${h.method}()` +
        `（会同步污染命令栈快照 → undo 静默失效；改「先复制再变异」：\`[...x.${h.tail}].${h.method}(…)\`）`,
    );
  }
}
// 解析源自检（fail-loud）：扫到 0 个文件时上面的「✅」不可信（本仓 TD-02-9「假护栏恒绿」同款教训）。
if (veImmutableScanned === 0) {
  fail(
    'videoEditor 引用纪律规则未生效：未扫到任何 videoEditor 文件（解析源为空，勿当通过）',
  );
} else if (!veImmutableViol) {
  console.log(
    `  ✅ 无数组原地变异（扫 ${veImmutableScanned} 文件；快照与 store 隔离的纪律成立）`,
  );
}

console.log(`\n${errors === 0 ? '✅ 架构校验通过' : `❌ ${errors} 处架构违规`}`);
process.exit(errors === 0 ? 0 : 1);
