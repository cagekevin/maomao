#!/usr/bin/env node
/**
 * check-arch.mjs — 架构校验（轻量版，主工程内自包含，仅依赖 @babel/parser）。
 *
 * 【为什么存在】架构红线的历史落点曾是 audit/ 沙盒里的 .dependency-cruiser.cjs，但它装在 .gitignore
 * 的目录、CI 装不到 → 规则不生效。故用主工程依赖 @babel/parser 自包含实现架构红线，挂进闸体系
 * （gates.manifest push 层 + check:health），让门槛在主工程内持久生效：
 *   1. no-circular —— **会 TDZ 的**模块循环依赖（CLAUDE.md §5.4.2 红线）。
 *      判据 = 环上存在「**模块顶层求值期读取环内符号**」（依据红线原文：「禁止**新文件**循环 import **大模块**（TDZ）：
 *      跨模块引用**走既有 barrel**」—— 该红线**推荐**走 barrel，故"经 barrel 的环"不能一律判红，那是形态②过严闸）。
 *      **无顶层读写的结构环不判红线，但逐条列出**（结构债 → 账本，2026-09-19 D13 第二半）。
 *      ⚠️ 解析器（resolveSourceFile）必须含「目录 → index」回退，否则一切 barrel 边失明（2026-09-19 D13 第一半）。
 *   2. base/ 禁反向依赖业务域（nodes/scriptbox/agent/panels）—— 通用地基必须单向，业务依赖 base 才正确
 *   （另含：结果信封 / 工具层写操作 / 裸写 node 字段 / 存储唯一入口 / KV 同步读 / 深路径，见下方各规则）
 *   ★ 扫目录型规则一律经 `assertScanned()` 做**扫描基数自检**：0 扫描 = 红灯（"没扫"≠"干净"），
 *     禁假绿 —— 本仓 TD-02-9 / TD-22-53 两次踩过。新增此类规则时第一件事是核对输出里的「已扫描 N」不是 0。
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
 *   先例与实证：规则 2（base）/ 规则 10（广播）/ 规则 4′（引擎区↔改造区）的「清单 → 反向判据」；
 *               原规则 4 的【★改】段 —— 「文件级白名单」把 `core/` 逼成内联重写 7 遍（文件头写着
 *               "严禁在此重写"，正文却只能重写 = **闸把作者逼成了它禁止的样子**）。
 *               ⚠️ 原规则 4 与规则 6 已于 2026-09-15 **退役删除**（守护两端随 cutia 搬迁消失、空转假绿
 *               ⇒ TD-22-53，决策源 `docs/130` §4.1）：见下方【已删 · 退役留痕】与规则 4′。
 *
 * 用法: node scripts/check-arch.mjs       （或 npm run check:arch）
 * 退出码: 有违规 → 1；无 → 0
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

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

/**
 * 扫目录型规则的**扫描基数自检**（fail-loud）—— 本文件唯一实现，勿在各规则里再手写一遍。
 *
 * 【为什么必须有】闸类代码最危险的失败模式是「**不报错、只少扫**」：目标目录改名 / 迁移后规则扫到
 *   0 个文件，却照样打印 ✅，读起来像"通过"。本仓两次实证：TD-02-9（`check-node-data` 解析被打瞎却长期报 0 缺口）、
 *   TD-22-53（规则 4/6 目标目录消失、空转假绿，直到有人盯"已扫描 0"才发现）。
 *   ⇒ **扫到 0 个文件不是"干净"，是"没扫"**，必须红灯，且不能让 CI 绿。
 *
 * 【口径】`label` 写清扫的是什么（含两端基数时一并写出）；返回 false 表示已记账（调用方**勿再打印 ✅**）。
 *   边界型规则（如规则 4′ 引擎区↔改造区）两端都要在 ⇒ 传两端基数的 `min`。
 */
const assertScanned = (label, count) => {
  if (count === 0) {
    fail(`${label}规则未生效：未扫到任何目标文件（目标目录不存在 / 已改名 ⇒ 本规则空转，勿当通过）`);
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────
// 豁免的**定义关系**解析（2026-09-19「放开闸」）—— 本文件四处豁免原先按**文件路径**写死
// （`agentCanvasHost.ts` / `contracts.ts` / `base/storage/`），改名或搬迁后两种失败都会发生：
//   ① 豁免失效 ⇒ 唯一实现本体被判违规（TD-17-24 实证：假红 14 处）；
//   ② 实现本体搬走而名单还指旧路径 ⇒ 规则**静默放宽**（假绿）。
// 清单必漏是母体（`gates.manifest` `_design.gateCost` ②）⇒ 统一改按【定义关系】推，
// 定义处（声明语句，`export { X } from './x'` 转发不算）必须**恰好 1 个**，否则 fail-loud。
// ─────────────────────────────────────────────────────────────────
const { buildDefIndex } = createRequire(import.meta.url)('./symbol-defs.cjs');
const _defIndex = buildDefIndex(root, ['AgentCanvasHost', 'getLocalKeys', 'contentGet', 'sGet']);
/** 唯一【定义处】相对路径（正斜杠）；0 或 >1 处 → null */
const defOf = (sym) => {
  const m = _defIndex.get(sym) || [];
  return m.length === 1 ? m[0] : null;
};
/** 唯一【定义处】所在目录（相对路径，无尾斜杠）；无 → null */
const defDirOf = (rel) => (rel && rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : null);
/** 取定义处；不唯一就**红灯**并返回 null（调用方不得静默放宽本规则） */
const requireDef = (sym) => {
  const m = _defIndex.get(sym) || [];
  if (m.length !== 1) {
    fail(
      `豁免推导失败：符号 ${sym} 在 src 下应**恰好 1 处定义**（re-export 转发不算），实际 ${m.length} 处${
        m.length ? ' → ' + m.join(' · ') : ''
      } ⇒ 是否被改名/搬迁？请核对 scripts/symbol-defs.cjs 的调用点或补定义，**勿放宽本规则**`,
    );
    return null;
  }
  return m[0];
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
  // 解析为绝对路径 —— 统一走 resolveSpec（唯一实现，避免第二份别名/回退逻辑）
  const resolved = out
    .map((spec) => resolveSpec(spec, filepath))
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
  // 【2026-09-19 修正 · D13】补「目录 → index」回退，与 scripts/ts-exts.cjs:91-94 的同名函数对齐。
  //   缺此回退时，`from '@/…/engine/core'` 这类**目录（barrel）导入**解析结果为 null ⇒ 不产生边，
  //   于是 no-circular 与规则 2（base 反向）/ 规则 4′（引擎区↔改造区）对**一切经 barrel 的边完全失明**。
  //   实证（改前）：videoEditor/engine 内 3 条真环（timeline / scene / project：core → managers → commands
  //   目录 barrel → 叶子命令 → 回引 engine/core）存在，而本闸输出 ✅ 通过。
  //   属**收窄（让判据变真）**，非放宽 —— 依 A12，红线/偏好闸的收窄由架构师直接改。
  for (const e of EXTS) {
    const c = join(abs, 'index' + e);
    try {
      if (statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

/** 单个 import 说明符 → 绝对源文件（`@/` 别名 + 相对路径）；外部包或解析不到 → null。**唯一实现**。 */
function resolveSpec(spec, filepath) {
  if (spec.startsWith('@/')) return resolveSourceFile(resolve(root, 'src', spec.slice(2)));
  if (spec.startsWith('.')) return resolveSourceFile(resolve(dirname(filepath), spec));
  return null; // 外部 npm 包，不参与内部循环/分层
}

// ── 1a. TDZ 精确化输入：每个模块的「值导入绑定」与「顶层求值期引用」──────────────
// 【为什么要有它】见文件头规则 1：红线守的是 **TDZ**，且**推荐走 barrel**；仅凭"存在文件级环"判红会
//   把红线推荐的动作判成违规（形态②过严闸）。故判据对准红线标题：环上必须有「**顶层求值期读取环内符号**」。
//
// 【近似边界（诚实声明，改这里等于改判据，须同步文件头）】
//   · 类：只取 `extends` 与 **static 字段初始化器**（类定义期求值）；方法体 / 实例字段**跳过**（调用期、构造期）。
//   · 函数 / 箭头函数体：**跳过**（调用期才执行）。
//   · TS 类型位置（`: T` / 泛型实参）：**跳过**（编译擦除，无运行时读取）。
//   · 只统计「真被读到」的导入：`import { x }` 但顶层从不引用 `x` ⇒ 不构成风险。
function analyzeTdz(code, filepath) {
  const bindings = new Map(); // 值导入的 local 名 → 目标绝对路径
  const topRefs = new Set(); // 模块顶层「求值期会读」的标识符名
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    return { bindings, topRefs }; // 语法错误交由 build / tsc 兜底
  }
  for (const stmt of ast.program.body) {
    if (stmt.type !== 'ImportDeclaration' || stmt.importKind === 'type') continue;
    const dep = resolveSpec(stmt.source.value, filepath);
    if (!dep) continue;
    for (const s of stmt.specifiers || []) {
      if (s.importKind === 'type') continue; // `import { type A, B }` 中只有 A 处于类型位
      if (s.local && s.local.name) bindings.set(s.local.name, dep);
    }
  }
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportAllDeclaration':
      case 'TSTypeAnnotation':
      case 'TSTypeParameterDeclaration':
      case 'TSTypeParameterInstantiation':
      case 'TSInterfaceDeclaration':
      case 'TSTypeAliasDeclaration':
      case 'TSDeclareFunction':
      case 'TSModuleDeclaration':
        return;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ClassMethod':
      case 'ClassPrivateMethod':
      case 'MethodDefinition':
      case 'ObjectMethod':
        return; // 体内：调用期执行，与模块求值无关
      case 'PropertyDefinition':
      case 'ClassProperty':
      case 'ClassPrivateProperty':
        if (node.static) walk(node.value); // static 字段：类定义期求值
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        walk(node.superClass); // `extends`：类定义期求值
        if (node.body && Array.isArray(node.body.body)) {
          for (const m of node.body.body) {
            if (
              (m.type === 'PropertyDefinition' || m.type === 'ClassProperty') &&
              m.static
            )
              walk(m.value);
          }
        }
        return;
      case 'ExportNamedDeclaration':
      case 'ExportDefaultDeclaration':
        walk(node.declaration);
        return;
      case 'Identifier':
        topRefs.add(node.name);
        return;
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        walk(node.object); // `a.b` 的属性名不是标识符引用
        return;
      case 'ObjectProperty':
      case 'Property':
        walk(node.value); // 键不是引用（计算键另算）
        if (node.computed) walk(node.key);
        return;
      case 'VariableDeclarator':
        walk(node.init); // 声明名不是引用
        return;
      default:
        break;
    }
    for (const k in node) {
      if (k === 'loc' || k === 'range' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (v && typeof v === 'object') walk(v);
    }
  };
  for (const stmt of ast.program.body) walk(stmt);
  return { bindings, topRefs };
}

const files = collectFiles(SRC);
// fileAbs -> Set<depAbs>
const graph = new Map();
// fileAbs -> { bindings, topRefs }（规则 1 的 TDZ 精确化输入；不影响其他规则的 graph 形状）
const modTdz = new Map();
for (const f of files) {
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  graph.set(f, new Set(extractImportAbs(code, f)));
  modTdz.set(f, analyzeTdz(code, f));
}
const all = new Set(graph.keys());
for (const [, deps] of graph) for (const d of deps) all.add(d);

// ── 1. 循环依赖检测（DFS，栈上节点重复即环）· **判据 = 会 TDZ**（见文件头规则 1）──
console.log('🔄 循环依赖检测（no-circular · 判据 = 会 TDZ）');
if (graph.size === 0) fail('循环依赖检测：扫描基数 0（没扫 ≠ 干净）');
else console.log(`  （已扫描 ${graph.size} 个 src 文件）`);
const color = new Map(); // 0 未访问, 1 在栈, 2 完成
const stack = [];
let circularFound = false;
/** 环上是否存在「模块顶层求值期读取环内符号」—— 是 ⇒ 真 TDZ 风险（判红线） */
function cycleHasTdz(cycleMembers) {
  const members = new Set(cycleMembers);
  for (const f of members) {
    const info = modTdz.get(f);
    if (!info) continue;
    for (const [local, dep] of info.bindings) {
      if (members.has(dep) && info.topRefs.has(local)) return true;
    }
  }
  return false;
}
const structuralCycles = new Set(); // 无 TDZ 实害的结构环（成员集合指纹，去重后计数）
const structuralSample = new Map(); // 指纹 → 可读环路径（打印用）
function dfs(node) {
  color.set(node, 1);
  stack.push(node);
  for (const dep of graph.get(node) || []) {
    if (!all.has(dep)) continue;
    const c = color.get(dep);
    if (c === 1) {
      const idx = stack.indexOf(dep);
      const members = stack.slice(idx);
      const cycle = members.concat(dep).map((x) => x.slice(root.length + 1));
      if (cycleHasTdz(members)) {
        circularFound = true;
        fail(`循环依赖(TDZ): ${cycle.join(' → ')}`);
      } else {
        const key = [...members].sort().join('|');
        structuralCycles.add(key);
        if (!structuralSample.has(key)) structuralSample.set(key, cycle.join(' → '));
      }
    } else if (!c) dfs(dep);
  }
  stack.pop();
  color.set(node, 2);
}
for (const node of graph.keys()) if (!color.get(node)) dfs(node);
if (!circularFound) console.log('  ✅ 未发现「会 TDZ」的循环依赖');
if (structuralCycles.size) {
  console.log(
    `  ℹ️ 另有 ${structuralCycles.size} 组**结构环**（环上无顶层求值期读取 ⇒ 无 TDZ 实害）：不判红线，另登记结构债`,
  );
  let shown = 0;
  for (const key of structuralCycles) {
    if (shown++ >= 20) {
      console.log(`     …（另 ${structuralCycles.size - 20} 组，见账本结构债条目）`);
      break;
    }
    console.log(`     · ${structuralSample.get(key)}`);
  }
}

// ── 2. 分层边界：**横切子目录**禁反向依赖业务域 · docs/123 G-1 ──
//
// 【守什么】依赖只能指向更稳定的方向。横切层（无业务语义的通用原语）若 import 业务域 ⇒
//   ① 成环风险 ② 横切层无法独立演化（改一个域就波及地基）。
//
// 【🔴 2026-09-19 判据修正：作用域从「整个 base/」收窄到「base/ 的横切子目录」】
//   原判据 = `relFrom.startsWith('src/components/base/')` —— 等于假设「base/ 里全是横切层」。
//   但本仓 `base/` 是**「横切层 + 域」的容器**（`docs/DOMAIN-MODULES.md §2.2` 实测）：
//     · 横切：core · utils · ui · api · storage · panels
//     · 域  ：canvas · store · editors · prompt · creative · depthVideo（**`media` 已于 2026-09-20 移出**，见下）
//     · 宿主/适配：panels · media（装配体，可依赖域 —— 见 `BASE_HOST_LAYER`）
//   ⇒ 拿「横切不许依赖域」去管 `base/canvas`（**它本身就是域**）= 把「稳定性层级」与「目录位置」混为一谈。
//   实证（2026-09-19）：全仓 `base/` 出向依赖**仅 1 处来源** = `base/canvas → nodes`（12 条，域→域，本该允许）；
//   其余 13 个子目录**零出向依赖** ⇒ 收窄后纯度仍 100%，且 `BASE_ALLOWLIST`（2 条清单式例外）**整个删除**。
//
// 【🔴 2026-09-20 第三次修正：`media` 从「域」改判为「**宿主 / 适配层**」（与 `panels` 同族）】
//   触发：`base/media/index.ts` 文件头写着红线「**禁** import 任何非 base 目录」，而实测
//   `providers/canvasSource.ts`（→ canvas/resource）与 `providers/librarySource.ts`（→ resource）
//   **正是这么干的** —— 红线在注释里、却不在 `BASE_CROSS_CUTTING` 里 ⇒ **无机器守卫的假护栏**；
//   且 `docs/DOMAIN-MODULES.md:1326` 记「`base/media` = 横切地基」与上方「域」列表**同日相反**（SSOT 冲突）。
//   重取判据（ADR-0040「≥3 域消费 **且** 零业务语义」）：`mediaRefRegistry` 实测**零业务域直接消费**
//   （仅被本层桶 + 测试引用）· `providers/*` 每个都读**某一个域**的数据（带业务语义）⇒ **两侧都不成立**
//   ⇒ 它既不是横切、也不是域，而是**装配体**：把各域的媒体数据适配进统一协议。
//   **处置**：判据（不是代码）—— 加进 `BASE_HOST_LAYER`；`base/media/index.ts` 的旧红线已回改作废；
//   判据全文落 `docs/adr/`（层籍：横切 / 域 / 宿主）。
//   **代价核算**：`media` 本来就不在 `BASE_CROSS_CUTTING` 里 ⇒ 本次**不损失任何既有防护**（0 变化）。
//
// 【为什么"横切子目录登记表"不是母体】原作者弃用域名清单的理由是「每来一个业务域就要记得加一次」。
//   但**会增殖的是「域」，不会增殖的是「横切子目录」** —— 横切是稳定集合，域由本规则**自动覆盖**（无需登记）。
//   故本表登记的是**稳定侧**，与 `contracts.ts` 的 NODE_TYPES / STORAGE_KEYS 同族（登记表 = 本仓既有机制）。
//
// 【何时该改】新增/删除 `base/` 下的**横切**子目录时同步本表；**域**子目录不要加进来。
// 【怎么改】把新横切子目录加进 `BASE_CROSS_CUTTING`。若某横切子目录确实要依赖某域 ⇒ 先问
//   「它是不是其实属于那个域」（多半是域物住横切层，应迁出而不是加白名单）。
// 【🔴 2026-09-19 第二次判据修正：`panels` 从横切子目录移出 ⇒ 改判「宿主 / 挂载层」】
//   依据 = `docs/DOMAIN-MODULES.md §3.3 C4` 原文：「`base/panels` **多数 app-shell（仅 App）**」。
//   实测坐实：`LeftPanel.tsx` 装配**四个域的 UI**（`TaskCenter` 任务 · `GeneratedView` 生成 ·
//   `ResourceLibrary` 素材 · `PromptHub` 提示词）并 import `taskStore`（任务域真源）
//   ⇒ 它就是 **app-shell 组合件**，职责就是「把各域的 UI 接起来」。
//   ⇒ 拿「横切不许依赖域」管它 = 与 `App.tsx` 同类误判（`§2.5` 明确「App.tsx 不计为消费域」）。
//   **代价核算**：移出时 `base/panels` 出向依赖 = **0 处**（实测）⇒ 今天不损失任何防护；
//   未来若 `panels` 里的**横切 UI kit**（`FullscreenModal` / `ImportMediaModal` / `panel-kit.css` …）
//   开始依赖域，需按「横切原语下沉」处理（不能靠本 guard，改由 code review 守）。
//   **用户裁定（2026-09-19）：`base/panels` 整体不拆** —— 它是**内聚的面板层**，
//   `FullscreenEditor` / `HoverToolbar` 等**留在原地**（`§3.3 C4` 那句「属画布域 ⇒ 应迁出」
//   据此作废，见 `docs/DOMAIN-MODULES.md §7` 修订记录）。
console.log('\n🏗 分层边界：base/ 的横切子目录禁止反向依赖业务域');
const BASE_CROSS_CUTTING = new Set(['core', 'utils', 'ui', 'api', 'storage']);
const BASE_HOST_LAYER = new Set(['panels', 'media']); // 宿主 / 适配层（app-shell · 面板层 · 媒体源装配体）· 可依赖域，见上注
const BASE_PREFIX = 'src/components/base/';
let baseViol = 0;
for (const [from, deps] of graph) {
  const relFrom = from.slice(root.length + 1).replace(/\\/g, '/');
  if (!relFrom.startsWith(BASE_PREFIX)) continue;
  const sub = relFrom.slice(BASE_PREFIX.length).split('/')[0];
  // base/ 下的**域容器**（canvas/store/editors/prompt/creative/media/depthVideo）与 components/ 下的域同级
  // ⇒ 允许出向依赖（域→域、域→横切都合法）。base/ 根下的散件（如 nodeImage.ts）同理跳过。
  if (!BASE_CROSS_CUTTING.has(sub)) continue;
  for (const dep of deps) {
    const relDep = dep.slice(root.length + 1).replace(/\\/g, '/');
    if (relDep.startsWith('src/components/') && !relDep.startsWith(BASE_PREFIX)) {
      baseViol++;
      fail(`横切层反向依赖业务域: ${relFrom} → ${relDep}`);
    }
  }
}
if (!baseViol) console.log(`  ✅ 横切层（${[...BASE_CROSS_CUTTING].join(' / ')}）无反向依赖业务域`);

// ─────────────────────────────────────────────────────────────────
// 【已删 · 退役留痕（2026-09-15 · TD-22-53）】原规则 4（`videoEditor/core/` 依赖白名单）与
// 规则 6（`videoEditor/hooks/` 禁依赖 `videoEditor/export/`）**已整体删除**，下面换成规则 4′。
//
// 【为什么删】两条规则的**守护两端都已随 cutia 版搬迁消失**：
//   · 规则 4 扫 `videoEditor/core/**` —— 自建 core 已退役（现为 `engine/`）；
//   · 规则 6 扫 `videoEditor/hooks/**` 并禁其 import `videoEditor/export/**` —— 目录改为 `hooks-cutia/`，
//     且 `export/` 域整体退役（`src/components/videoEditor/export/` 零文件）。
//   ⇒ 两条规则**空转**（各扫 0 个文件）却照样打印 ✅ —— 本仓已批过的「假守卫」（闸在假装工作）。
//
// 【决策源（不是本轮发明）】`docs/130-cutia搬迁计划书-2026-09-14.md` §4.1 裁决表：删规则 4/6、
//   建「引擎区不得 import 改造区」反向判据（对应债 `TD-VE-6`）；验收口径见 `docs/133` §五 不变式 `I-2`。
//   §4.1 对规则 4 的原话：「守护对象消失，且 cutia 引擎本就 import react/sonner（守不住，硬守只会逼人贴假标记）」。
//
// 【若将来重现「纯逻辑叶层零 React / 零 IO」需求（如未来的 `animations/`）】**不要恢复旧形态** ——
//   旧白名单是**手写目录清单**（"每加一个合法目录就要回来改一次闸" = 本仓母体，规则 2/10/4′ 都因它改过
//   判据形态）。该语义应由「**禁 npm 裸 specifier**」这类反向判据承载，而不是"允许谁"的清单。
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// 规则 4′（2026-09-15 · TD-22-53 / docs/130 §4.1）：**引擎区不得 import 改造区**（反向判据）。
//
// 【为什么守这一条】cutia 版把编辑器切成两个**变化速率截然不同**的区域（docs/130 §2.3）：
//   · **引擎区** `videoEditor/engine/**` —— cutia 原样搬入、**本版本冻结**，改动需明确理由；
//   · **改造区** `videoEditor/ui/**` —— 我们的主战场（panels / properties / assets），改动高频。
//   引擎若反向 import 改造区 ⇒ 每次 UI 重构都会把引擎一起拽动，"冻结"名存实亡。
//   ⇒ 依赖方向必须单向：`ui/ → engine/` 合法；`engine/ → ui/` 违规。
//
// 【为什么用反向判据而非白名单】规则 2（base）与规则 10（广播）已两次实证：「允许谁」的清单必漏，
//   且"加一个合法模块就要改一次闸"本身是母体。本规则只禁**往上跑的那一条边**，引擎区其余依赖
//   （base/ · types/ · constants/ · utils/ · lib/ · engine 自身）一概不碰，无需维护清单。
//   形态对标先例：上方规则 2「base 不得 import 任何非 base 目录」。
//
// 【★双端基数自检（本规则对 TD-22-53 母体的关键改进）】边界规则有**两端**。旧规则 4/6 只查自己那一端，
//   于是"目标目录改名 ⇒ 扫 0 ⇒ 假绿"。此处若只查引擎端，`ui/` 一旦改名，规则会**静默退化成
//   「引擎不得 import 一个不存在的目录」（恒真空转）**。故两端扫描基数都必须非 0，任一端消失即红灯。
//   ⇒ 判据取两端基数的 `min`：任一端为 0 则 min=0（边界不成立）。
// ─────────────────────────────────────────────────────────────────
const VE_ENGINE_REL = 'src/components/videoEditor/engine/';
const VE_UI_REL = 'src/components/videoEditor/ui/';
let veEngineToUiViol = 0;
let veEngineScanned = 0;
let veUiScanned = 0;
for (const [from, deps] of graph) {
  const relFrom = from.slice(root.length + 1).replace(/\\/g, '/');
  if (relFrom.startsWith(VE_UI_REL)) veUiScanned++;
  if (!relFrom.startsWith(VE_ENGINE_REL)) continue;
  veEngineScanned++;
  for (const dep of deps) {
    const relDep = dep.slice(root.length + 1).replace(/\\/g, '/');
    if (relDep.startsWith(VE_UI_REL)) {
      veEngineToUiViol++;
      fail(
        `引擎区反向依赖改造区: ${relFrom} → ${relDep}` +
          `（依赖方向必须单向 ui/ → engine/：引擎区是 cutia 冻结层，不得 import 我们的改造区）`,
      );
    }
  }
}
console.log(
  `\n🧱 引擎区禁 import 改造区（反向判据）· 已扫描 ${veEngineScanned} 个 engine 文件 / ${veUiScanned} 个 ui 文件`,
);
if (!assertScanned('引擎区→改造区边界', Math.min(veEngineScanned, veUiScanned))) {
  // 已记账（两端任一为 0 ⇒ 边界规则空转），勿再打印 ✅。
} else if (!veEngineToUiViol) {
  console.log(`  ✅ 引擎区无反向依赖改造区（扫 ${veEngineScanned} engine / ${veUiScanned} ui 文件）`);
}


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
    if (typeof spec === 'string' && spec.startsWith('@/components/videoEditor/engine')) bad.push({ spec, line });
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
// 扫描基数自检（共用原语）：`types/` 一旦改名/迁移 ⇒ 本规则空转，不许当通过（TD-22-53 教训）。
if (assertScanned('videoEditor/types 禁依赖 engine', veTypesScanned) && !veTypesViol) {
  console.log('  ✅ types 层无反向依赖 engine');
}

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
const MODAL_LAYER_REL = 'src/components/base/core/interaction/modalLayer.ts';
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
// 或直接 `ctx.setNodes(...)` 调用。`agentCanvasHost.ts` 本体豁免（它就是唯一实现）。
// ✅ 2026-09-19「放开闸」：豁免改为**按定义关系推** —— 定义 `AgentCanvasHost` 接口的那个文件（= 唯一实现本体）。
//    原写法按路径列 `agentCanvasHost.ts`：S1-2 改名后漏改 ⇒ 唯一实现本体被判 14 处假红（TD-17-24）；
//    反过来，若本体搬走而名单未改，则本规则静默放宽（假绿）。现改后：文件随便改名/搬目录都跟得住；
//    定义数 ≠ 1（0 处=被改名删除 / >1 处=冒出第二份实现）⇒ 直接红灯，不静默放宽。
// ─────────────────────────────────────────────────────────────────
const CANVAS_WRITE_BAN = new Set(['setNodes', 'setEdges', 'addNodes', 'addEdges']);
const CANVAS_WRITE_SCOPE = 'src/components/agent/canvas/';
const CANVAS_HOST_DEF = requireDef('AgentCanvasHost');
const CANVAS_WRITE_EXEMPT = new Set(CANVAS_HOST_DEF ? [CANVAS_HOST_DEF] : []);
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
//  - base/storage/**：底层实现内部互引（storageAdapter / index / storageQuota）；
//  - conversationState.ts：KV 迁移需回读旧 local 存量（键已登记 kv 后端，走 contentStore 会读错后端）。
// 【更新(2026-09-16 · M7 裸写收口)】原第 4 条「director3d/**：第三方域」**已删除（只收窄，不放宽）**：
//  ① 豁免理由本身已失效 —— spec/CONTEXT.md §五·五 早于 2026-09-01 就写明「director3d 已解除豁免，
//     可以动、可以改、可以收口」；此处却仍按"第三方域例外"整目录放行（**守卫的理由比守卫落后了半个月**）；
//  ② 实证：删掉该条后本规则**零违规** ⇒ 它早已是**死豁免**（director3d 侧无任何直调底层符号的依赖），
//     留着唯一的效果是让"下一个绕过点"天然落在没人看的角落（M2 母体：整目录豁免 ⇒ 绕过零成本）；
//  ③ 「不走本项目存储键体系」与事实不符：`director3d-custom-poses` 本就登记在 contracts.STORAGE_KEYS。
// ─────────────────────────────────────────────────────────────────
const KV_TRANSPORT_SYMBOLS = new Set(['kvGet', 'kvSet', 'kvDelete', 'kvGetVersion']);
const LOCAL_ADAPTER_SYMBOLS = new Set(['sGet', 'sSet', 'sRemove']);
function storageBypassAllowed(rel) {
  return (
    rel === 'src/components/base/core/contentStore.ts' ||
    rel.startsWith('src/components/base/storage/') ||
    rel === 'src/components/agent/conversation/conversationState.ts'
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
// 【豁免】contentStore.ts（入口本体）/ base/storage/**（底层自持原始键语义）。
//   【更新(2026-09-16)】原第 3 条 `director3d/**` 已随规则 6 一并**只收窄**删除（理由见规则 6 的更新段；
//   删后本规则零违规）。
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
 *   理由与规则 6 同源：唯一入口本体 / 底层实现互引。（原「第三方域 §五·五」一并于 2026-09-16 只收窄删除。）
 */
// ✅ 2026-09-19「放开闸」：豁免原按**路径**写死（contentStore.ts / base/storage/）⇒ 该层改名或搬迁即失效。
//   改为**定义关系**推导：入口本体 = 定义 `contentGet` 的文件；底层实现层 = 定义本地适配原语 `sGet` 的文件所在目录。
const KV_SYNC_READ_ENTRY = requireDef('contentGet');
const KV_STORAGE_DIR = defDirOf(requireDef('sGet'));
const KV_SYNC_READ_SCOPE_EXEMPT = (rel) =>
  (KV_SYNC_READ_ENTRY && rel === KV_SYNC_READ_ENTRY) ||
  (KV_STORAGE_DIR && rel.startsWith(KV_STORAGE_DIR + '/'));

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
// （storageAdapter/index/storageQuota）→ 违规（必须经 `base/storage/index.ts` barrel 或更高层入口）。
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
// 扫描基数自检（共用原语 assertScanned）：扫到 0 个文件时上面的「✅」不可信。
if (assertScanned('videoEditor 引用纪律', veImmutableScanned) && !veImmutableViol) {
  console.log(
    `  ✅ 无数组原地变异（扫 ${veImmutableScanned} 文件；快照与 store 隔离的纪律成立）`,
  );
}

// ─────────────────────────────────────────────────────────────────
// 规则 10（TD-22-23，2026-09-15）：事件广播**唯一通道** —— src 内禁 `window.dispatchEvent` 自建广播。
//
// 【为什么】`base/core/eventBus.ts` 文件头声明「全项目唯一的事件广播通道…**禁止自建第二套广播
//   （window.dispatchEvent / 手写 Map 监听）**」，但该红线**只有注释、无机器守卫**（本仓 M2 母体：
//   红线只在注释里 → 必回潮）。实测漏网：
//   `videoEditor/engine/core/managers/playback-manager.ts` 每帧 `window.dispatchEvent('playback-update')`
//   （全仓含 tests **零消费者**）+ seek 时 `window.dispatchEvent('playback-seek')`（绕过总线）——
//   videoEditor 搬迁时带进来的。同族前例 `yimao:remove-edge`（TD-04-8）与 `resource:renamed`
//   都按此红线清过，但**都是人工发现的**。本规则把它变成机器判定。
//
// 【判据（反向）】src/** 内任何 `window|document|globalThis|self . dispatchEvent(...)` 调用 → 违规。
//   · 不限定目录 ⇒ 不随模块改名失效（与规则 2/4「清单 → 反向判据」同款手法）；
//   · DOM 元素上的 `dispatchEvent` **不在判据内**（标准 DOM 事件派发，如
//     `input.dispatchEvent(new Event('change'))`，不构成第二套广播通道）；
//   · 【诚实边界】只机器化「dispatchEvent」这一半。红线里的另一半「手写 Map 监听」**不纳入** ——
//     它与各 manager 的 `listeners Set`（eventBus 文件头明示豁免的「模块内订阅」）静态上不可区分，
//     强行机器化 = 大面积误报（假守卫比无守卫更坏）。那一半仍靠结构约定 + 本条注释指路。
//   · 正确写法：`base/core/eventBus.ts` 的 publish/subscribe + `contracts.ts` EVENTS 登记
//     （`check:events` 校验「发布/订阅成对」）。
// ─────────────────────────────────────────────────────────────────
console.log('\n📡 事件广播唯一通道：禁 window/dispatchEvent 自建广播（反向判据）');
const DISPATCH_GLOBALS = new Set(['window', 'document', 'globalThis', 'self']);
let globalBroadcastViol = 0;
let globalBroadcastScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  globalBroadcastScanned++;
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
    if (
      n.type === 'CallExpression' &&
      n.callee?.type === 'MemberExpression' &&
      n.callee.property?.name === 'dispatchEvent' &&
      n.callee.object?.type === 'Identifier' &&
      DISPATCH_GLOBALS.has(n.callee.object.name)
    ) {
      hits.push({ line: n.loc?.start?.line, obj: n.callee.object.name });
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const h of hits) {
    globalBroadcastViol++;
    fail(
      `自建事件广播通道: ${rel}:${h.line} → ${h.obj}.dispatchEvent(...)` +
        `（唯一通道 = base/core/eventBus.ts 的 publish/subscribe + contracts.ts EVENTS 登记；` +
        `禁 window/dispatchEvent 第二套广播）`,
    );
  }
}
// 扫描基数自检（共用原语 assertScanned）：扫到 0 个文件时上面的「✅」不可信。
if (assertScanned('事件广播唯一通道（src 全域）', globalBroadcastScanned) && !globalBroadcastViol) {
  console.log(
    `  ✅ 无自建广播通道（扫 ${globalBroadcastScanned} 文件；均走 eventBus + EVENTS 登记）`,
  );
}

// 规则 11（TD-16-2 / TD-22-55，2026-09-16）：跨源裁决**唯一单点** —— src 内禁裸写 `crossOrigin = 'anonymous'`。
//
// 【为什么】`base/utils/captureFrame.ts` 文件头（现下沉 `base/utils/asyncGuard.ts::setCrossOriginForReadable`）
//   确立了唯一裁决：**同源不设 / 真跨源才设 anonymous**。理由：同源 `/files/*` 若被设 `anonymous`，
//   元素走 CORS 模式而网关未必回 CORS 头 ⇒ 媒体 opaque ⇒ canvas 被污染 ⇒ `toBlob`/`getImageData`
//   静默 `null`（TD-22-1 客观缺陷）。该红线**只有注释、无机器守卫**（M2 母体），实测漏网 ≥6 处：
//   `asyncGuard` 默认值 / `clipboard.toBlob` / 剪辑器 `image-node` `sticker-node` / `ImageZoomDialog`
//   / `VideoExtractNode` 预览 —— 全部恒设 `'anonymous'`，精确重演缺陷。
//
// 【判据（反向）】src/** 内任何 `x.crossOrigin = 'anonymous'` / `<el crossOrigin="anonymous">` → 违规。
//   · 不限定目录 ⇒ 不随模块改名失效（与规则 2/4/10「清单 → 反向判据」同款手法）；
//   · 唯一豁免 = 单点实现自身（`asyncGuard.ts`）；其余一律改走 `setCrossOriginForReadable(el, url)`；
//   · 纯展示态若确无需 canvas 回读，也**不要**静态恒设（直接不写该属性 = 同源默认）。
//   · 【诚实边界】只机器化「字面量 anonymous」这一半；运行时由变量决定的 crossOrigin 不在此判定
//     （那类仍靠结构约定）。本规则的目标 = 挡住"照抄一行恒设"这一最常见回潮形态。
// ─────────────────────────────────────────────────────────────────
console.log('\n🖼 跨源裁决唯一单点：禁裸写 crossOrigin="anonymous"（反向判据）');
const CROSSORIGIN_SSOT =
  'src/components/base/utils/net/asyncGuard.ts'; // 唯一实现处（setCrossOriginForReadable）
let crossOriginViol = 0;
let crossOriginScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  crossOriginScanned++;
  if (rel === CROSSORIGIN_SSOT) continue; // 单点实现自身豁免
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
    // ① 赋值形态：`el.crossOrigin = 'anonymous'`
    if (
      n.type === 'AssignmentExpression' &&
      n.left?.type === 'MemberExpression' &&
      n.left.property?.name === 'crossOrigin' &&
      n.right?.type === 'StringLiteral' &&
      n.right.value === 'anonymous'
    ) {
      hits.push({ line: n.loc?.start?.line, form: "`el.crossOrigin = 'anonymous'`" });
    }
    // ② JSX 属性形态：`<video crossOrigin="anonymous">`
    if (n.type === 'JSXAttribute' && n.name?.name === 'crossOrigin') {
      const v = n.value;
      if (v?.type === 'StringLiteral' && v.value === 'anonymous') {
        hits.push({ line: n.loc?.start?.line, form: '`<el crossOrigin="anonymous">`' });
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
  for (const h of hits) {
    crossOriginViol++;
    fail(
      `跨源裁决被绕过: ${rel}:${h.line} → ${h.form}` +
        `（唯一单点 = base/utils/asyncGuard.ts::setCrossOriginForReadable(el, url)：同源不设 / 真跨源才 anonymous）`,
    );
  }
}
if (assertScanned('跨源裁决唯一单点（src 全域）', crossOriginScanned) && !crossOriginViol) {
  console.log(`  ✅ 无裸写 crossOrigin（扫 ${crossOriginScanned} 文件；均走单点裁决）`);
}

// 规则 12（2026-09-16 · 云同步范围白名单）：`getLocalKeys()` 只允许在 2 处出现。
//
// 【为什么】云同步范围真源 = `cloudSync.ts` 的 `SYNC_ALLOW`（白名单默认拒绝，用户裁定：工程数据/UI 一律不出机器）。
//   `getLocalKeys()` 是「全部 local 后端键」，被它消费的地方都必须**显式决定**同步与否：
//     · `cloudSync.ts`  —— 云同步范围（∩ SYNC_ALLOW，仅设置类）；
//     · `backupStore.ts` —— 备份范围（全量，备份 ≠ 同步，故意全收）。
//   若第三处再 `getLocalKeys()` 起一套清单，就是「同步范围第二份」——新增键到底进不进云将取决于改哪一份，
//   正是本仓 M7 母体（SSOT 第二份）。本规则把它挡在源头（反向判据：只允许**定义处 + 具名标注者**消费）。
//   ✅ 2026-09-19「放开闸」：原写法是**按路径列 3 个合法消费者**，两条实证都踩了：
//      · 域归位把 `backupStore` 迁回 `base/store/` 后就**假红一次**（路径清单跟不上搬迁）；
//      · 清单里的 `cloudSync.ts` 其实**已不再调用** `getLocalKeys()` ⇒ 清单自身在腐烂（多一条死项）。
//      现改为「**定义关系 + 可自证标注**」：
//        · 定义处（谁 `export function getLocalKeys`）→ 自动推导，改名/搬目录都跟得住；
//        · 确需的语义例外 → 调用点**同行或上一行**标 `// cloud-scope-ok: <理由>`，本规则**打印全部标记点**
//          （标记量可观测 ⇒ 防"贴个标记就绕过"；同规则 11 的 `// storage-raw-ok:` 形态）。
// ─────────────────────────────────────────────────────────────────
console.log('\n☁️ 云同步范围：getLocalKeys() 只允许定义处 + 具名标注者消费（反向判据）');
const GETLOCALKEYS_DEF = requireDef('getLocalKeys');
let getLocalKeysViol = 0;
let getLocalKeysScanned = 0;
const cloudScopeMarkers = [];
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  getLocalKeysScanned++;
  if (rel === GETLOCALKEYS_DEF) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  // 只认「真调用」：`getLocalKeys(` （排除注释/字符串里的提及——用逐行粗筛 + 去行首注释）
  const lines = code.split('\n');
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (!/\bgetLocalKeys\s*\(/.test(line)) continue;
    const prev = i > 0 ? lines[i - 1] : '';
    if (/cloud-scope-ok:/.test(line) || /cloud-scope-ok:/.test(prev)) {
      cloudScopeMarkers.push(`${rel}:${i + 1}`);
      continue;
    }
    getLocalKeysViol++;
    fail(
      `云同步范围第二份: ${rel}:${i + 1} → 调用了 getLocalKeys()（合法消费者 = 定义处（自动推）或调用点标 // cloud-scope-ok: <理由> 者）`,
    );
  }
}
if (assertScanned('云同步范围（src 全域）', getLocalKeysScanned) && !getLocalKeysViol) {
  console.log(
    `  ✅ getLocalKeys() 仅定义处 + 例外可消费（扫 ${getLocalKeysScanned} 文件；cloud-scope-ok 标记 ${cloudScopeMarkers.length} 处${
      cloudScopeMarkers.length ? ' → ' + cloudScopeMarkers.join(' · ') : ''
    }）`,
  );
}

// 规则 12-b（2026-09-16 · TD-13-9 收口）：**cloudSync 内禁出现具体存储键名** —— 同步范围只许派生。
//
// 【为什么（这是 TD-13-9 的真解，比规则 12 更强的判据）】原实现把「哪些键进云」抄成
//   `cloudSync.ts` 的 `SYNC_ALLOW` 白名单集合 + `SYNC_LABELS` 显示名清单：
//     · 与 `contracts.STORAGE_KEYS` **两处维护**（加一个需同步的键要改 2 个文件）；
//     · **清单型判据必漏**（本仓规则 2/4/10/12 已四次从清单改回反向判据）。
//   现判据下沉为登记表字段（`sync` / `label`），cloudSync 只派生（`getSyncKeys()` / `getKeyLabel()`）。
//   ⇒ **cloudSync 里再出现任何一个具体键名字面量 = 第二份清单在回潮**，本规则当场红。
//
// 【判据（反向）】`cloudSync.ts` 源码内出现**已登记固定键的字面量**（照 STORAGE_KEYS 推导，
//   故新增键自动纳入、无需改本规则）→ 违规。注释里的引用不算（只扫源码文本的字符串字面量）。
//   · 豁免：本文件头/注释中的举例是**文档**，不是判据 —— 逐行跳过注释行。
// ─────────────────────────────────────────────────────────────────
console.log('\n☁️ 云同步只许派生：cloudSync 内禁出现具体存储键名（反向判据）');
const CLOUDSYNC_REL = 'src/components/base/store/cloudSync.ts';
// 自持一份「已登记固定键」集合（勿依赖规则 15 的常量 —— 那在本规则之后才初始化）。
const SYNC_GUARD_FIXED_KEYS = new Set();
try {
  const mod = await import(pathToFileURL(join(SRC, 'components/base/core/contracts.ts')).href);
  for (const [k, v] of Object.entries(mod.STORAGE_KEYS || {})) {
    if (!v || v.pattern || k.includes('{')) continue;
    SYNC_GUARD_FIXED_KEYS.add(k);
  }
} catch (e) {
  console.log('  ⚠ 规则 12-b 无法加载 contracts.ts 的 STORAGE_KEYS（' + e.message + '）');
}
let cloudKeyViol = 0;
{
  const abs = join(root, CLOUDSYNC_REL);
  if (!existsSync(abs)) {
    fail(`规则 12-b 目标文件不存在: ${CLOUDSYNC_REL}（文件改名/搬迁 ⇒ 本规则空转，勿当通过）`);
  } else if (SYNC_GUARD_FIXED_KEYS.size === 0) {
    fail('规则 12-b 解析源为空：未取到任何已登记固定键 → 本规则未生效（勿当通过）');
  } else {
    const lines = readFileSync(abs, 'utf8').split('\n');
    const KEY_LITERAL_RE = /(['"])([a-zA-Z0-9_.-]+)\1/g;
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*/')
      )
        continue;
      for (const m of line.matchAll(KEY_LITERAL_RE)) {
        const lit = m[2];
        if (!SYNC_GUARD_FIXED_KEYS.has(lit)) continue;
        cloudKeyViol++;
        fail(
          `云同步范围第二份回潮: ${CLOUDSYNC_REL}:${i + 1} → 出现具体存储键 '${lit}'` +
            `（同步范围必须派生 = contracts.STORAGE_KEYS 的 sync/label 字段；` +
            `本文件只许调 getSyncKeys()/getKeyLabel()，不得持键名清单）`,
        );
      }
    }
  }
}
if (!cloudKeyViol) {
  console.log(`  ✅ cloudSync 内无具体存储键名（同步范围纯派生自登记表）`);
}

// ─────────────────────────────────────────────────────────────────
// 规则 11（2026-09-16 · M7 裸写收口 · TD-02-33/36/37/39）：本地存储**变更**必须经唯一入口 contentStore。
//
// 【为什么存在】`contentStore.ts` 文件头第一句就是红线「所有业务数据读写必须走 contentStore，
//   禁止直调 storageAdapter / **原生 localStorage**」，但机器守卫只覆盖了一半：
//   规则 6 拦的是「import sSet/sGet/kvSet…」这类**经适配层**的绕过，对
//   **直接 `localStorage.setItem/removeItem/clear`** 完全无感（本规则上线前全 src 零扫描）。
//   实证：`director3d/storage.ts` 与 `videoEditor/hooks-cutia/storage/use-local-storage.ts` 两处长期裸写 ——
//   绕过入口 ⇒ 备份清单 / 存储监控 / 落盘失败上报（各站点 confirmPersist）对该条数据流**全部失效**，
//   且键连登记表都没有（换机丢数据）。红线只写在注释里 = 无红线。
//
// 【判定（反向判据，不列业务模块清单）】src 全域扫**变更类**裸调用
//   `localStorage.setItem|removeItem|clear`。（纯「读」不在本规则：读侧另有规则 7「KV 键禁同步读」管辖。）
//   唯一结构性豁免 = `src/components/base/storage/**` —— **底层实现本体** + 历史裸键迁移原语
//   （裸访问点全仓收敛在该层，理由见 `legacyRawKey.ts` 文件头）。
//   其余确需裸访问处（如写**外部站点**的 localStorage）→ 在该行或上一行标 `// storage-raw-ok: <理由>`；
//   本规则会**打印全部标记使用点**（可观测，防"标记一贴就绕过" —— `catch-ok` 的教训：标记量 ≠ 豁免量）。
// ─────────────────────────────────────────────────────────────────
console.log('\n🧱 本地存储变更唯一入口：禁裸写 localStorage（反向判据）');
// ✅ 2026-09-19「放开闸」：原按目录名写死 `base/storage/` ⇒ 该层改名/搬迁即失效。
//   失效有两个方向：豁免失灵 ⇒ 真收敛层被判违规（假红）；或收敛层搬走后本规则悄悄放宽（假绿）。
//   改为**定义关系**：底层收敛层 = 定义本地适配原语 `sGet` 的文件所在目录（与规则 7 同源推导，全仓唯一）。
const RAW_LS_STORAGE_DIR = KV_STORAGE_DIR;
const RAW_LS_SCOPE_EXEMPT = (rel) => !!RAW_LS_STORAGE_DIR && rel.startsWith(RAW_LS_STORAGE_DIR + '/');
const RAW_LS_MUTATE_RE = /localStorage\s*\.\s*(setItem|removeItem|clear)\s*\(/;
let rawLsViol = 0;
let rawLsScanned = 0;
const rawLsMarkers = [];
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  rawLsScanned++;
  if (RAW_LS_SCOPE_EXEMPT(rel)) continue;
  let code;
  try {
    code = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  const lines = code.split('\n');
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (!RAW_LS_MUTATE_RE.test(line)) continue;
    const prev = i > 0 ? lines[i - 1] : '';
    if (/storage-raw-ok:/.test(line) || /storage-raw-ok:/.test(prev)) {
      rawLsMarkers.push(`${rel}:${i + 1}`);
      continue;
    }
    rawLsViol++;
    fail(
      `裸写本地存储绕过唯一入口: ${rel}:${i + 1} → 必须经 contentStore（contentSet/contentSetAsync/contentDelete/contentDeleteAsync）；` +
        `确需裸访问（如写外部站点）须标 // storage-raw-ok: <理由>`,
    );
  }
}
if (assertScanned('禁裸写 localStorage（src 全域）', rawLsScanned) && !rawLsViol) {
  console.log(
    `  ✅ 无裸写 localStorage（扫 ${rawLsScanned} 文件；storage-raw-ok 标记 ${rawLsMarkers.length} 处${
      rawLsMarkers.length ? ' → ' + rawLsMarkers.join(' · ') : ''
    }）`,
  );
}

// 规则 13（2026-09-16 · 母体止血 · TD-16-4~14 / TD-08-16~20）：媒体类型 / URL 解析**真值源唯一入口**
//   —— src 内禁「就地手写扩展名→类别表/正则」与「裸 URL 文件名提取」（反向判据）。
//
// 【为什么存在（这是本轮母体的真正解）】「扩展名/mime → 媒体类别」与「URL → 文件名/磁盘路径」两件事，
//   全库**早就有唯一真源**（`base/utils/assetType.ts` EXT_KIND / `base/core/utils.ts` fileNameFromUrl），
//   但两条红线**只写在注释里、零机器守卫**（M2 母体）→ 每遇新需求就就地抄一份，抄的那份必然漂移。
//   实证（2026-09-16 普查）：A 类内联判定 **10 份**（漏 avif/ogv/aac/json… → `.wmv` 被当图片、
//   `.json` 被 rescan 丢弃）；B 类内联文件名提取 **13 份**（漏 decode → `my%20clip.png`、
//   不剥 `?`/`#` → `a.png?token=1`）。`assetType.ts:9` 注释原话「**禁止再就地手写 `\.(mp4|webm…)$` 正则：
//   此前 5 处各写一份，已漂移出三类不一致**」—— 而正文仍有 10 份 = **注释拦不住任何人**。
//   ⇒ 前两条收口（清存量）+ 本闸（止血）＝ 母体一收全消；此后新增格式只改真源，第 N+1 份当场红。
//
// 【判据（反向）】src/** 内任一文件（真源自身豁免）出现下列**字面**形态之一 → 违规：
//   ① 扩展名内联表/正则：源码文本含 `\.(png|jpe?g|gif|webp|svg|…)` 或 `\.(mp4|webm|mov|…)`
//      式**媒体扩展名列举**（≥2 个扩展名的 `\.(a|b)` 组），即「照抄真值源的一张表/正则」；
//   ② 裸文件名提取：`…pathname.split('/').pop()`（未经 fileNameFromUrl）或 `<x>.split('/').pop()`
//      之类的**从 URL 末段取名**内联实现。
//   · 不限定目录 ⇒ 不随模块改名失效（与规则 2/4/10/11/12「清单 → 反向判据」同款手法）；
//   · 豁免 = 真源实现自身（assetType.ts / core/utils.ts / localTool mime.ts —— 后端另由 tsc 层守）；
//   · **只收窄不放宽**：若本闸拦住了「让同一语义份数下降」的动作 → 按心法 §零.4.3 改闸，不许就地重写。
//   · 【诚实边界】只机器化「字面列举/裸 split」两种最常见回潮形态；运行时由变量拼出的扩展名不在此判定
//     （那类仍靠结构约定）。目标 = 挡住"照抄一行表/正则"这一主流回潮，而非穷尽所有可能。
// ─────────────────────────────────────────────────────────────────
console.log('\n🎞 媒体类型/URL 解析真值源唯一入口：禁内联重写判定与文件名提取（反向判据）');
const MEDIA_SSOT = new Set([
  'src/components/base/utils/media/assetType.ts', // EXT_KIND / classifyAssetUrlKind / detectFileType（媒体判定真源）
  'src/components/base/core/utils.ts', // fileNameFromUrl / relativePathFromFileUrl（URL 提取真源）
  'src/components/base/api/filesApi.ts', // relativePathFromUrl（薄委托，保留同名导出）
  'src/components/base/utils/media/assetUrl.ts', // toRelativeFileUrl 等 URL 归一化出口
  'src/components/agent/skill/write/skillImport.ts', // isSkillImportFile / skillNameFromFile（Skill 白名单真源；TD-16-8 收口，2026-09-22 随 TD-11-52 从 runtime/skillStore.ts 迁入本模块）
]);
// ① 媒体扩展名「列举」正则：`\.(png|jpe?g|gif|…)` —— ≥2 个分支才算列举（单个 `\.(mp4)$` 不算表）。
//    ⚠️ 只拦**与 EXT_KIND 真值源重叠**的列举（媒体/文本类）；域专用扩展名（如 3D 模型的 glb/gltf、
//    推理运行时的 wasm/onnx）**不属**本母体，不算违规 —— 见下方 `EXT_KIND_MEMBERS` 交集判定。
//    【读法】`\\` = 字面反斜杠，`\.` = 字面点号，`\(` = 字面左括号 ⇒ 本正则 = 「反斜杠 + . + ( 扩展名列举」，
//    与源码里正则字面量 `/\.(png|jpg)$/` 的写法（单反斜杠）**一致**。
const MEDIA_EXT_LIST_RE = /\\\.\(([a-z0-9|]{2,})\)/;
// ② 裸文件名提取：`.pathname.split('/').pop()`（未走原语）
const RAW_NAME_EXTRACT_RE = /\.pathname\s*\.\s*split\(\s*['"]\/['"]\s*\)\s*\.\s*pop\(/;
// EXT_KIND 真值源成员（assetType.ts:29-34）—— 只有列举里**命中这些**才算「抄了真值源」。
// 用集合而非单值：`\.(glb|gltf)` 与真值源零交集 ⇒ 非本母体（域专用，不拦），避免假守卫误报。
const EXT_KIND_MEMBERS = new Set([
  'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'ogv',
  'mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus', 'wma', 'aiff',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif',
  'txt', 'md', 'markdown', 'json', 'log', 'csv', 'srt',
]);
/** 提取一行里 `\.(a|b|c)` 列举的扩展名，返回与 EXT_KIND 的交集（空 = 非本母体）。 */
function mediaExtListOverlap(line) {
  const m = MEDIA_EXT_LIST_RE.exec(line);
  if (!m) return [];
  const alts = m[1]
    .split('|')
    .map((s) => s.replace(/[?^$]|\\./g, '').toLowerCase())
    .filter((s) => /^[a-z0-9]{2,6}$/.test(s));
  // 至少 2 个可识别扩展名才算「列举成表」
  if (alts.length < 2) return [];
  return alts.filter((a) => EXT_KIND_MEMBERS.has(a));
}
let mediaInlineViol = 0;
let mediaInlineScanned = 0;
const mediaInlineHits = [];
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  mediaInlineScanned++;
  if (MEDIA_SSOT.has(rel)) continue; // 真源/出口自身豁免
  const code = readFileSync(f, 'utf8');
  const lines = code.split('\n');
  for (const [i, line] of lines.entries()) {
    const trimmed = line.trim();
    // 跳过纯注释行（文档里引用旧形态是允许的；本闸只拦真实代码）
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    const overlap = mediaExtListOverlap(line);
    const isExtList = overlap.length >= 2; // 命中真值源 ≥2 个扩展名 = 抄了表
    const isRawName = RAW_NAME_EXTRACT_RE.test(line);
    if (!isExtList && !isRawName) continue;
    mediaInlineViol++;
    const form = isExtList
      ? `内联媒体扩展名列举正则（命中真值源扩展名：${overlap.join('/')}）`
      : '裸 URL 文件名提取（pathname.split("/").pop()）';
    mediaInlineHits.push(`${rel}:${i + 1}`);
    fail(
      `媒体类型/URL 解析内联重写: ${rel}:${i + 1} → ${form}` +
        `（真值源 = base/utils/assetType.ts EXT_KIND · base/core/utils.ts fileNameFromUrl；` +
        `禁就地手写第二份，新增格式只改真源）`,
    );
  }
}
if (assertScanned('媒体类型/URL 解析真值源（src 全域）', mediaInlineScanned) && !mediaInlineViol) {
  console.log(`  ✅ 无内联重写媒体判定/文件名提取（扫 ${mediaInlineScanned} 文件；均走真值源）`);
}

// 规则 13-b（2026-09-16 · 后端对等闸）：**localTool 内禁 MIME→ext 的 `includes()` 子串链**。
//
// 【为什么必须有（规则 13 只扫 src ⟹ 后端零守卫，母体必在后端复发）】实证：TD-08-22 ——
//   `ai-relay/providers/lovart/lovart_attachments.ts` 自持 `extFromDataHeader`/`extFromContentType`
//   两份 `h.includes('jpeg')||h.includes('jpg')…includes('audio')` 子串链，绕过 `utils/mime.ts`
//   唯一真源，且实测错判：`audio/aac`·`ogg`·`flac`·`wma`·`opus` 全因 `includes('audio')` 错归 `.mp3`、
//   `video/mpeg` 错归 `.mp3`、未列举型静默兜底 `.png`。
//   08 区上游轮已明确记「后端缺机器闸 → 同母复发」—— 本子规则即补这一半。
//
// 【判据（反向）】localTool/src/** 内任一行同时含**媒体 MIME 子串白名单**（`includes('jpeg'|'png'|'mp4'|…)`
//   ≥2 个）且该行参与 ext 返回 → 违规。豁免 = `utils/mime.ts`（唯一真源）。
//   · 域专用魔数表（如 `B64_MEDIA_MAGIC` 的 base64 前缀）**不拦**：前缀 ≠ MIME，无法由 mime.ts 表达。
//   · 【诚实边界】只拦「`includes('<媒体 mime 词>')` 链」这一主流回潮形态。
// ─────────────────────────────────────────────────────────────────
const BACKEND_SRC = join(root, 'localTool', 'src');
const BACKEND_MIME_SSOT = 'localTool/src/utils/mime.ts';
// 媒体 MIME 子串白名单信号（人写 mime→ext 链时的典型 token）
const MIME_SUBSTR_TOKENS = [
  'jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'avif', 'svg',
  'mp4', 'webm', 'quicktime', 'matroska', 'mpeg', 'ogg', 'flac', 'wav',
];
const MIME_INCLUDES_RE = /includes\s*\(\s*['"]([a-z0-9/+-]+)['"]\s*\)/gi;
let backendMediaViol = 0;
let backendMediaScanned = 0;
if (existsSync(BACKEND_SRC)) {
  const backendFiles = collectFiles(BACKEND_SRC);
  for (const f of backendFiles) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    backendMediaScanned++;
    if (rel === BACKEND_MIME_SSOT) continue; // 真源自身豁免
    const code = readFileSync(f, 'utf8');
    const lines = code.split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // 统计该行 `includes('…')` 命中的媒体 MIME 词数
      const hits = [];
      for (const m of line.matchAll(MIME_INCLUDES_RE)) {
        const tok = m[1].toLowerCase();
        if (MIME_SUBSTR_TOKENS.includes(tok)) hits.push(tok);
      }
      // 该行还须「参与扩展名/类型返回或赋值」（防误报：纯 URI 判断 `includes('http')` 等不在此）
      const looksLikeExtReturn = /\breturn\b|\bext\b|\btype\b|=\s*['"]/.test(line);
      if (hits.length >= 2 && looksLikeExtReturn) {
        backendMediaViol++;
        fail(
          `后端 MIME→ext 内联子串链: ${rel}:${i + 1} → includes(${hits.map((h) => `'${h}'`).join(', ')})` +
            `（真值源 = utils/mime.ts mimeToExt；子串匹配会错判，如 audio/aac 错归 .mp3）`,
        );
      }
    }
  }
}
if (assertScanned('后端 MIME→ext 真值源（localTool/src 全域）', backendMediaScanned) && !backendMediaViol) {
  console.log(`  ✅ 后端无 MIME→ext 内联子串链（扫 ${backendMediaScanned} 文件；均走 mime.ts）`);
}

// ─────────────────────────────────────────────────────────────────
// 规则 13-c（2026-09-16 · TD-08-23 复发闸）：**localTool 内禁「扩展名缺失 → 静默猜某格式」**。
//
// 【为什么必须有（13-b 拦不住这个形态）】13-b 只拦 `includes('<mime词>')` 子串链；而 TD-08-23
//   的形态是 `path.extname(filePath) || 'png'` —— 扩展名缺失时**静默把文件当成 png**：
//   真实无扩展名 JPEG 被 Jimp 按 png 重编码（体积膨胀 + 格式丢失），**且零日志**。
//   该形态在 TD-16-11（前端）修过后**在后端复发**（`routes/files.ts` · `utils/resolveLocalImages.ts`），
//   正是母体 M5「失败不可见」+「复发债必须有机器闸」的典型（附 B1：5 条复发债全部是"改了但没加闸"）。
//
// 【判据（反向）】localTool/src/** 内任一行同时满足：
//   ① 出现 `extname(`（在读扩展名）；② 该行有 `|| '<某媒体后缀>'` 或 `?? '<某媒体后缀>'` 兜底。
//   → 违规（应改用 `fileStore.jimpMimeForFile` / `jimpExtForFile`（缺扩展名时读字节真相）
//     或诚实返回 null/失败，禁「猜一个格式」）。
//   · 豁免：`utils/fileStore.ts`（该原语自身宿主，其 `?? Jimp.MIME_PNG` 是**表内保底**非静默错标，
//     且注释已写明读字节真相在前）；纯文本/JSON 等非媒体后缀不在判据内。
// ─────────────────────────────────────────────────────────────────
const MEDIA_EXT_GUESS = /(\|\||\?\?)\s*['"](?:png|jpe?g|gif|webp|bmp|tiff|avif|svg|mp4|webm|mov|mp3|wav|ogg)['"]/i;
const FILE_STORE_HOST = 'localTool/src/utils/fileStore.ts';
let backendGuessViol = 0;
if (existsSync(BACKEND_SRC)) {
  for (const f of collectFiles(BACKEND_SRC)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (rel === FILE_STORE_HOST) continue; // 原语宿主豁免（表内保底，非静默错标）
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (!line.includes('extname(')) continue;
      if (MEDIA_EXT_GUESS.test(line)) {
        backendGuessViol++;
        fail(
          `后端「扩展名缺失静默猜格式」: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（真值源 = fileStore.jimpExtForFile / jimpMimeForFile；缺扩展名应读字节真相或诚实失败，禁猜 png）`,
        );
      }
    }
  }
}
if (!backendGuessViol) {
  console.log('  ✅ 后端无「extname(...) || 媒体后缀」静默猜格式');
}

// 规则 15（2026-09-16 · M7 母体止血 · TD-13-7/11/12）：**已登记存储键禁裸字面量传 contentStore**。
//
// 【为什么必须有（这是 TD-13-4/13-7 反复复发的真正原因）】`contracts.ts` 文件头写着
//   「新增键→先在此登记，禁止散落字符串字面量」，但既有 `check:keys` 只校验**「登记没登记」**，
//   对「**已登记的键又被消费层抄成第二份字面量 / 本地 const**」完全无感 —— 红线只写在注释里（M2 母体）。
//   实证：TD-13-4 收口 7 把 `yimao_*` 后，剩下的 `agent_skills` 等 9 把继续散落 8 个模块
//   （skillStore / agentModelStore / scriptBoxPlaybookStore / providerStore / VideoExtractNode /
//    tableWorkspaceState / AgentPanel / cloudSync / useCanvasAgentTools）→ 与登记表两份维护。
//   一旦改名只改一处，`getLocalKeys()` 派生的**备份 / 云同步清单即漂移** → 漏备 / 误还原（数据完整性）。
//
// 【判据（反向）】src 全域（contracts.ts 自身豁免）内，凡把**已登记固定键的字面量**直接传给
//   contentStore 家族（contentGet/Set/Delete(+Async)/contentSubscribe/contentReadThrough）
//   的第一实参 → 违规。应当 `import` contracts 的命名 const 引用。
//   · 只拦**已登记的固定键字面量**（照 STORAGE_KEYS 清单推导）⇒ 新增键自动纳入，无需再改本闸；
//   · 动态模板键（含 `{占位}`）无法导出简单 const，不在判据内（由规则 7 的前缀求值另管）；
//   · 消费方 re-export 的常量（如 skillStore.SKILLS_KEY）是**合法出口**，不拦 —— 本闸只认字面量本身。
//   · 「怎么修若被拦」→ 去 contracts.ts 取命名 const，**不要**在消费方再声明一个同值本地 const
//     （那正是本闸要禁的第二份）。
// ─────────────────────────────────────────────────────────────────
console.log('\n🔑 已登记存储键禁裸字面量传 contentStore（反向判据 · M7 止血）');
const STORAGE_FNS_FOR_KEY = new Set([
  'contentGet',
  'contentSet',
  'contentDelete',
  'contentHas',
  'contentGetAsync',
  'contentSetAsync',
  'contentDeleteAsync',
  'contentSubscribe',
  'contentReadThrough',
]);
// 已登记的「固定键」字面量集合（含 pattern 模板但以字面量形态出现的固定段不算；只取真正的固定键名）。
const REGISTERED_FIXED_KEYS = new Set();
try {
  const mod = await import(pathToFileURL(join(SRC, 'components/base/core/contracts.ts')).href);
  for (const [k, v] of Object.entries(mod.STORAGE_KEYS || {})) {
    if (!v || v.pattern) continue; // 动态模板键不在本判据（无法导出简单 const）
    if (k.includes('{')) continue;
    REGISTERED_FIXED_KEYS.add(k);
  }
} catch (e) {
  console.log('  ⚠ 规则 15 无法加载 contracts.ts 的 STORAGE_KEYS（' + e.message + '）');
}
if (REGISTERED_FIXED_KEYS.size === 0) {
  fail('规则 15 解析源为空：未能从 contacts.ts STORAGE_KEYS 取到任何固定键 → 本规则未生效（勿当通过）');
}
const CONTRACTS_REL = 'src/components/base/core/contracts.ts';
let literalKeyViol = 0;
let literalKeyScanned = 0;
for (const f of files) {
  const rel = f.slice(root.length + 1).replace(/\\/g, '/');
  literalKeyScanned++;
  if (rel === CONTRACTS_REL) continue; // 真源自身豁免
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
    if (n.type === 'CallExpression') {
      const c = n.callee;
      const name =
        c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property?.name : null;
      if (name && STORAGE_FNS_FOR_KEY.has(name) && n.arguments?.length) {
        const a = n.arguments[0];
        if (a.type === 'StringLiteral' && REGISTERED_FIXED_KEYS.has(a.value)) {
          literalKeyViol++;
          fail(
            `已登记存储键被裸字面量重写: ${rel}:${n.loc?.start?.line} → ${name}('${a.value}')` +
              `（须 import contracts.ts 的命名 const 引用；禁在消费层再声明第二份同值 const）`,
          );
        }
      }
    }
    for (const k in n)
      if (k !== 'loc' && k !== 'range' && typeof n[k] === 'object' && n[k] !== null) walk(n[k]);
  };
  walk(ast.program);
}
if (
  assertScanned('已登记存储键唯一入口（src 全域）', literalKeyScanned) &&
  !literalKeyViol
) {
  console.log(
    `  ✅ 无裸字面量重写已登记存储键（扫 ${literalKeyScanned} 文件；均引用 contracts 命名 const）`,
  );
}

// 规则 14（2026-09-16 · TD-08-19）：**跨栈契约常量对账** —— 前端 / 后端各持一份、值必须相等。
//
// 【为什么是「对账」而非「收口」】`MAX_SEND_DIM` 无法只留一份：前端（`src/`，vite/浏览器构建）与
//   后端（`localTool/`，node + 独立 package.json）是**两个独立构建产物**，无共享模块机制
//   （抽共用模块需打通两套构建，改动半径远大于收益）。故**双写是结构必然**，不是 SSOT 第二份。
//   真正的缺口是：**没有任何机器对账** —— 两侧注释互相指向（"勿单边漂移"），但注释拦不住人。
//   实证风险：任一侧漂移会**静默改变发送图片的压缩上限**（用户可见：图变大/被压糊）。
//
// 【判据】从两侧各自的源文件抓 `NAME = <字面标量>`：**数字或引号字符串**（写成 `2 * 1024 * 1024`
//   或变量引用会抓不到 ⇒ 报"缺失"；2026-09-22 起支持字符串，见 `SKILL_ENTRY_FILE`）
//   → 必须都存在且相等；任一侧缺失/不等 → 违规。对账项见下方 `CROSS_STACK_CONSTS` 数组
//   （现有 `MAX_SEND_DIM` · `SKILL_MAX_FILE_BYTES`）；未来新增同类契约**按此模式补一行**。
// ─────────────────────────────────────────────────────────────────
// 规则 16（2026-09-18 · TD-02-64 / TD-02-65 母体止血）：**存** —— 后端落盘唯一权威。
//
// 【为什么必须有】「图片怎么落盘」在后端**只有一份权威实现** `fileStore.writeUploadDedup`
//   （sha1(字节) 内容寻址命名 + contentId 全局去重 + 命中校验磁盘还在），且它是**唯一**把产物
//   送进 resources 表（素材库可见 / 孤儿 GC 可管）的入口。但这约定**只写在注释里、零机器守卫**：
//   实证（2026-09-18 审计）已有 **2 处旁路**各自落盘 ——
//     · `routes/localPatch.ts`（crop/merge 产物）：自拼 `local_crop_<ctx>.png` 直接 `writeUploadBufferAt`
//       → 不进 resources 表、不去重（同字节内容与上传入口落成两个物理文件）
//     · `utils/base64Externalize.ts`（KV base64 外置）：自算 sha1 + 自查 DB + 自命名 + 自 `fs.writeFileSync`
//       —— **与权威逐项重复的第二套**，且从未跟进权威侧 2026-09-17 修的「命中必须校验磁盘还在」
//       （TD-08-31：DB 行在、文件被 GC 带走 → 复用回 404 死 url = 假成功）。
//   两处已于 2026-09-18 收口（localPatch → persistPatchProduct；base64Externalize → writeUploadDedupSync），
//   本闸防回潮（母体 M2：「注释拦不住任何人」）。
//
// 【判据（反向）】`localTool/src/**` 内（`utils/fileStore.ts` 自身豁免）出现下列形态 → 违规：
//   ① 直写 uploads：`fs.writeFileSync(` 且该行/邻近出现 `getUploadDir()` 派生的路径
//      （识别方式：同文件内 import 了 `getUploadDir` 且出现 `fs.writeFileSync(` —— 落盘必须经 fileStore）；
//   ② 越过权威落盘：直接调用 `writeUploadBufferAt(`（该函数是**内部原语**，仅供 fileStore 内
//      的 writeUploadBuffer / writeUploadDedup 使用；业务 handler 必须走 writeUploadDedup）。
//   · 豁免：`utils/fileStore.ts`（权威自身宿主）。
//   · 【诚实边界】只机器化上述两种**最常见回潮形态**；经变量间接拼路径的落盘不在此判定（仍靠结构约定）。
//     `fs.existsSync` 等**只读**调用不在判据内（读盘不产生第二份真相）。
// ─────────────────────────────────────────────────────────────────
console.log('\n💾 后端落盘唯一权威：禁直写 uploads / 禁越过 writeUploadDedup（反向判据）');
const FILE_STORE_AUTHORITY = 'localTool/src/utils/fileStore.ts';
let persistViol = 0;
if (existsSync(BACKEND_SRC)) {
  for (const f of collectFiles(BACKEND_SRC)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (rel === FILE_STORE_AUTHORITY) continue; // 权威宿主豁免
    const code = readFileSync(f, 'utf8');
    const lines = code.split('\n');
    // ① 直写 uploads：本文件用了 getUploadDir（= 在算 uploads 路径）且直接 fs.writeFileSync
    const usesUploadDir = /import\s*\{[^}]*\bgetUploadDir\b[^}]*\}\s*from/.test(code);
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (usesUploadDir && /\bfs\.writeFileSync\(/.test(line)) {
        persistViol++;
        fail(
          `后端直写 uploads 绕过落盘权威: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（应经 fileStore.writeUploadDedup：内容寻址命名 + contentId 去重 + 登记 resource 行；` +
            `裸 fs.writeFileSync 会产出"盘上有、库里没有"的孤儿文件）`,
        );
      }
      // ② 越过权威：直接调 writeUploadBufferAt（内部原语）
      if (/\bwriteUploadBufferAt\(/.test(line)) {
        persistViol++;
        fail(
          `后端越过落盘权威直调内部原语: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（writeUploadBufferAt 仅供 fileStore 内部使用；业务落盘请走 writeUploadDedup，否则丢去重与资源登记）`,
        );
      }
    }
  }
}
if (!persistViol) {
  console.log('  ✅ 后端无绕过落盘权威（扫 localTool/src；均走 writeUploadDedup 或其同步核心）');
}

// 规则 17（2026-09-18 · TD-02-61 / TD-02-65）：**发** —— 发送归一唯一出口。
//
// 【为什么必须有】图片「发（送去生成/对话）」的归一化（缩略图端点还原原图、相对→绝对、按上限压尺寸）
//   只有一份实现：`assetUrl.normalizeAssetUrl(s)ForSend`，且它被 **`api/generate.ts` 门面内部无条件调用**
//   （`:180` image/video 分支 `normalizeAssetUrlsForSend(req.images)`；`:123` chat 分支 `attachImages` 同款）
//   ⇒ 门面即唯一出口，**调用方无需也不应自行归一**。
//   但这约定同样只写在注释里。实证（2026-09-18）：`scriptBoxEngine.ts:1677` 曾在构造 `images:` 载荷时
//   先 `toAbsoluteFileUrl(origUrl)` —— 方向与出口的 `toRelativeFileUrl` **相反**，是白做一趟，
//   更坏的是它让读者误以为「调用方需自行归一」（认知污染 → 下一个人就会真的绕过门面自己归一）。
//
// 【判据（反向）】`src/**` 内，凡构造 `images:` 载荷的行同时出现 `toAbsoluteFileUrl(` → 违规。
//   · 只拦这**一种**历史上真实出现过的形态（发送载荷 + 与出口方向相反的转换）；
//   · `toAbsoluteFileUrl` 本身有大量合法用途（渲染/显示/磁盘定位），故不无条件禁，只限「发送载荷」语境。
// ─────────────────────────────────────────────────────────────────
console.log('\n📤 发送归一唯一出口：禁在 images 载荷处自行转换 URL（反向判据）');
let sendViol = 0;
if (existsSync(SRC)) {
  for (const f of collectFiles(SRC)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // 判据：同一行既有 images: 载荷又有 toAbsoluteFileUrl(...)
      if (/\bimages\s*:/.test(line) && /\btoAbsoluteFileUrl\(/.test(line)) {
        sendViol++;
        fail(
          `发送载荷自行转换 URL（绕过归一唯一出口）: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（发送归一在 generate.ts 门面内部无条件执行；此处转换与出口的 toRelativeFileUrl 方向相反，` +
            `属白做一趟且误导读者 —— 直接传原始 url 即可）`,
        );
      }
    }
  }
}
if (!sendViol) {
  console.log('  ✅ 无发送载荷自行转换 URL（扫 src；归一责任归 generate.ts 门面）');
}

// 规则 18（2026-09-18 · TD-02-62 / TD-02-65）：**收** —— 进节点的图必须已是持久 /files/ URL。
//
// 【为什么必须有】`node.data.images[].url` 只允许存**持久 /files/ URL**（禁内联 `data:`/`blob:`）——
//   否则整图 base64 进画布快照 → 快照膨胀 + 刷新后失效（正是手动「清理缓存」按钮要兜的后遗症）。
//   该不变式由 `nodes/ImageBoxNode.tsx` 的 `addImages`（**唯一写入口**）内部强制：六条加图路径
//   （上游连线 / 文件选择 / 粘贴文件 / 粘贴文本 / 拖入文件 / 拖入文本）统一过闸。
//   实证（2026-09-18）：修复前四条路径**裸 URL 直写**，上游连线源可携 `data:`（`assetType.ts:119`
//   `isAssetUrl` 明确放行）⇒ base64 直接进快照。属 TD-02-62。
//
// 【判据（反向）】`src/**` 内出现写 `node.data.images` 的字面形态，且**不在** ImageBoxNode 内 → 违规：
//   ① `patchData({ images`（或 `patchData({images`）
//   ② `data: { images` / `images:` 直接进 setNodes updater 的 node 对象（形态 ② 太宽，本闸只做 ①）。
//   · 豁免：`nodes/ImageBoxNode.tsx`（唯一写入口 addImages 的宿主）。
//   · 【诚实边界】只机器化 `patchData({ images` 这一最直接形态；经变量中转的写回不在此判定。
// ─────────────────────────────────────────────────────────────────
console.log('\n📥 进节点的图必须已持久：禁在 ImageBoxNode 之外直写 data.images（反向判据）');
const IMAGE_WRITER_HOST = 'src/components/image/nodes/ImageBoxNode.tsx';
let collectViol = 0;
if (existsSync(SRC)) {
  for (const f of collectFiles(SRC)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (rel === IMAGE_WRITER_HOST) continue; // 唯一写入口宿主豁免
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (/\bpatchData\(\s*\{\s*images\b/.test(line)) {
        collectViol++;
        fail(
          `ImageBoxNode 之外直写 data.images: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（node.data.images 的唯一写入口是 ImageBoxNode.addImages，它内部强制落盘换持久 URL；` +
            `否则内联 data:/blob: 会进画布快照）`,
        );
      }
    }
  }
}
if (!collectViol) {
  console.log('  ✅ 无越权直写 data.images（扫 src；唯一写入口 = ImageBoxNode.addImages）');
}

console.log('\n📐 跨栈契约常量对账：前后端必须相等（反向判据）');
const CROSS_STACK_CONSTS = [
  {
    name: 'MAX_SEND_DIM',
    fe: 'src/components/base/utils/media/assetUrl.ts',
    be: 'localTool/src/utils/resolveLocalImages.ts',
    why: '发送图片最长边上限（前端压 blob/data、后端压 /files/，两端口径必须一致）',
  },
  {
    name: 'SKILL_MAX_FILE_BYTES',
    fe: 'src/components/agent/skill/write/skillImport.ts',
    be: 'localTool/src/routes/skills.ts',
    why: '单个技能文件上限（前端据此不把必然被拒的文件读进内存、后端超限即 400；取值同一事实 —— TD-11-27）',
  },
  {
    name: 'SKILL_ENTRY_FILE',
    fe: 'src/components/agent/skill/rules/skillEntry.ts',
    be: 'localTool/src/routes/skills.ts',
    why:
      '技能包入口文件名（**跨栈协议名**：前端建包/解析、后端落盘/供数都按它找文件；' +
      '单边改成 `skill.md`/别的扩展名 = 包还在但谁也读不到它，而两侧各自都"对"、无类型错 —— TD-11-59）',
  },
  {
    name: 'CHAT_TOTAL_TIMEOUT',
    fe: 'src/components/base/core/config.ts',
    be: 'localTool/src/budget.ts',
    why:
      'chat 任务总预算（前端=真相，写进 `body.timeoutMs`；后端=前端未声明时的**兜底**）—— ' +
      '两值不等 ⇒ "前端传了"与"没传"拿到不同预算 = 行为分叉（TD-08-54）',
  },
  {
    name: 'CANVAS_STATE_PREFIX',
    fe: 'src/components/base/core/contracts.ts',
    be: 'localTool/src/routes/admin.ts',
    why:
      '画布快照 KV 键前缀（前端构键；后端**清理保护名单**＋**项目存储统计**同按它）—— ' +
      '单边改值 ⇒ 后端会误删画布状态本体、或统计永远落空（TD-08-68）',
  },
  {
    name: 'THUMB_MAX_DIM',
    fe: 'src/components/base/utils/media/assetUrl.ts',
    be: 'localTool/src/routes/files.ts',
    why:
      '缩略图渲染/出图的默认最长边（前端 `buildThumbnailUrl` 请求默认 与 后端 `/files/thumbnail` ' +
      '端点兜底）—— 不等 ⇒ 同图产生两套缓存，且"按哪个尺寸出图"取决于调用方是否传参（TD-08-71）',
  },
];
let crossStackViol = 0;
for (const c of CROSS_STACK_CONSTS) {
  const grab = (rel) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) return null;
    // 值允许**数字**或**单/双引号字符串**（2026-09-22 · TD-11-59 扩）：
    // 跨栈契约既有"取值上限"（`MAX_SEND_DIM = 1920`），也有"协议名"（`SKILL_ENTRY_FILE = 'SKILL.md'`）。
    // 判据不变（两侧都必须**显式定义**且值相等），只是把"值"从数字扩到字面标量 ——
    // 不扩的话协议名就只能靠注释互相喊话，那正是本闸当初要消灭的东西。
    // 数字支持 `_` 分隔（2026-09-22 · TD-08-54）：后端惯例写 `180_000`，归一化后比对，判据不变。
    const m = new RegExp(`\\b${c.name}\\s*=\\s*(?:['"]([^'"]*)['"]|(\\d[\\d_]*))`).exec(
      readFileSync(abs, 'utf8'),
    );
    return m ? (m[1] ?? m[2].replace(/_/g, '')) : null;
  };
  const feVal = grab(c.fe);
  const beVal = grab(c.be);
  if (feVal === null || beVal === null) {
    crossStackViol++;
    fail(
      `跨栈契约常量 ${c.name} 缺失: 前端 ${c.fe} = ${feVal ?? '未找到'} · 后端 ${c.be} = ${beVal ?? '未找到'}` +
        `（${c.why}；两端都必须显式定义，禁只留一份）`,
    );
  } else if (feVal !== beVal) {
    crossStackViol++;
    fail(
      `跨栈契约常量 ${c.name} 已漂移: 前端 ${c.fe} = ${feVal} · 后端 ${c.be} = ${beVal}` +
        `（${c.why}；必须相等）`,
    );
  } else {
    console.log(`  ✅ ${c.name} = ${feVal}（前端/后端一致）`);
  }
}
if (crossStackViol === 0) {
  console.log(`  ✅ 跨栈契约常量对账通过（${CROSS_STACK_CONSTS.length} 项）`);
}

// ─────────────────────────────────────────────────────────────────
// 规则 14·续（2026-09-22 · TD-08-59 / ADR-0057 毕业项）：**跨栈字面量联合类型对账**。
//
// 【为什么标量对账不够、还要单开这一类】上面的 `CROSS_STACK_CONSTS` 只抓**标量**（数字 · 单字符串）——
//   而"能力枚举"是**字面量联合类型**，值以**集合**形态存在（`'a' | 'b'` 或 `['a','b']`）。
//   实证（TD-08-59）：后端同一枚举曾有 **3 处类型副本 + 2 处运行时字面量列举**，且副本**结构同构 ⇒ 编译不报**；
//   前端另有 1 份（跨栈必然）。不机器对账 ⇒ 加第 4 个能力时必有一处漏改，而**两端各自都"对"**。
//
// 【判据（两条，缺一即漏）】
//   ① **同栈内只许 1 份定义**：`type <NAME> =` 的定义点在**同一栈**内 ≥2 ⇒ 违规。
//      （ADR-0057 原文只写"定义点 ≥2 ⇒ 违规" —— **必须按栈分组**：跨栈两侧各 1 份是结构必然，
//        不分栈会假红，那正是形态②过严闸。）
//   ② **跨栈两侧成员集合必须相等**：从两侧各自声明处抽引号字符串集合，排序后比较。
//
// 【诚实边界】抽的是"声明语句里的引号字符串"—— 若某侧改成由别处派生（如 `= SomeType['k']`）则抓不到
//   ⇒ 报"未找到/缺失"（逼人回来看闸并显式列举），**不会静默放过**。
// 【申诉口】Q1 守什么：跨栈契约一致性（结构偏好闸，非 CLAUDE 级物理红线）· Q2 何时该改：新契约的成员本就不是
//   引号字符串、或该枚举将来能跨栈共享（打通两套构建）时 · Q3 怎么改：改 `CROSS_STACK_UNIONS` 的 anchor/end，
//   并跑负例探针证明它仍会对真实违规变红。
// ─────────────────────────────────────────────────────────────────
const CROSS_STACK_UNIONS = [
  {
    name: 'RelayCapability',
    fe: {
      file: 'src/components/generate/lib/relayProxy.ts',
      anchor: /export\s+type\s+RelayCapability\s*=/,
      end: ';',
    },
    be: {
      file: 'localTool/src/capability.ts',
      anchor: /export\s+const\s+RELAY_CAPABILITIES\s*=/,
      end: ']',
    },
    why:
      '生成能力枚举（前端提交意图 / 后端分流与预算同按它；单边加一员 ⇒ 该能力在另一端永远"非法"，' +
      '而两端各自都编译得过 —— TD-08-59）',
  },
  {
    name: 'RelayTaskStatusValue',
    fe: {
      file: 'src/components/generate/lib/relayProxy.ts',
      anchor: /export\s+type\s+RelayTaskStatusValue\s*=/,
      end: ';',
    },
    be: {
      file: 'localTool/src/relay-poll.ts',
      anchor: /export\s+const\s+RELAY_TASK_STATUSES\s*=/,
      end: ']',
    },
    why:
      '任务句柄状态集合（前端 attach 解析 / 后端查询结果同按它；单边加状态 ⇒ 另一端永远收不到、' +
      '且 routes/generate.ts 压平层会静默折成 not-found，而两端各自都编译得过 —— TD-01-29）',
  },
];

/** 抽某栈内 `type <NAME> =` 的全部定义点（`rel:line`）—— 用于"同栈只许 1 份"判据。 */
const unionDefinitionSites = (base, name) => {
  const hits = [];
  if (!existsSync(base)) return hits;
  const re = new RegExp(`(?:^|[^\\w.])type\\s+${name}\\s*=`);
  for (const f of collectFiles(base)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (re.test(line)) hits.push(`${rel}:${i + 1}`);
    }
  }
  return hits;
};

/** 抽某侧声明的成员集合（引号字符串去重排序后 join）—— 抽不到返 null（= 缺失，判违规）。 */
const unionMembers = (side) => {
  const abs = join(root, side.file);
  if (!existsSync(abs)) return null;
  const code = readFileSync(abs, 'utf8');
  const m = side.anchor.exec(code);
  if (!m) return null;
  const rest = code.slice(m.index);
  const endIdx = rest.indexOf(side.end, m[0].length);
  const decl = rest.slice(0, endIdx > 0 ? endIdx : m[0].length + 300);
  const lits = decl.match(/['"`]([^'"`]+)['"`]/g);
  if (!lits || lits.length === 0) return null;
  return [...new Set(lits.map((s) => s.slice(1, -1)))].sort().join(' · ');
};

let crossStackUnionViol = 0;
for (const u of CROSS_STACK_UNIONS) {
  for (const [label, base] of [
    ['前端', SRC],
    ['后端', BACKEND_SRC],
  ]) {
    const sites = unionDefinitionSites(base, u.name);
    if (sites.length === 0) {
      crossStackUnionViol++;
      fail(`跨栈契约类型 ${u.name} 在${label}无定义点（${u.why}）`);
    } else if (sites.length > 1) {
      crossStackUnionViol++;
      fail(
        `跨栈契约类型 ${u.name} 在${label}内有 ${sites.length} 份定义: ${sites.join(' · ')}` +
          `（应只留 1 份真源、其余 import：副本结构同构 ⇒ 编译不报、漂移不显。${u.why}）`,
      );
    }
  }
  const feVal = unionMembers(u.fe);
  const beVal = unionMembers(u.be);
  if (feVal === null || beVal === null) {
    crossStackUnionViol++;
    fail(
      `跨栈契约类型 ${u.name} 成员读取失败: 前端 ${u.fe.file} = ${feVal ?? '未找到'}` +
        ` · 后端 ${u.be.file} = ${beVal ?? '未找到'}（${u.why}；两侧都必须显式列举成员）`,
    );
  } else if (feVal !== beVal) {
    crossStackUnionViol++;
    fail(
      `跨栈契约类型 ${u.name} 成员已漂移: 前端 = [${feVal}] · 后端 = [${beVal}]` +
        `（${u.why}；两侧成员集合必须相等 —— 改一侧必须同步另一侧）`,
    );
  } else {
    console.log(`  ✅ ${u.name} = {${feVal}}（前端/后端成员一致 · 同栈各 1 份定义）`);
  }
}
if (crossStackUnionViol === 0) {
  console.log(`  ✅ 跨栈契约类型对账通过（${CROSS_STACK_UNIONS.length} 项）`);
}

// 规则（2026-09-22 · TD-11-59）：**技能包入口文件名**（`SKILL.md`）只许住在两侧的定义文件里。
//
// 【为什么要这一条（对账已经够了？不够）】上面的 `CROSS_STACK_CONSTS` 保证**两侧定义的值相等**，
//   但它管不住"有人又在别处写一遍字面量"：那处的值可以永远正确、也可以在某次重构里被改成
//   `skill.md`，而**对账看的是定义文件**⇒ 改在别处的第四份跑了。所以"单一常量"要两条一起：
//   ① 两侧定义值相等（对账）；② 字面量只许出现在定义文件（本闸）。
// 【判据】除 `skillEntry.ts`（前端定义）与 `localTool/src/routes/skills.ts`（后端定义）外，
//   `src/**` + `localTool/src/**` 内出现**恰为** `'SKILL.md'` / `"SKILL.md"` / `` `SKILL.md` `` 的字面量
//   ⇒ 违规。**含该名字的文案**（如 `'读不到 SKILL.md 文本'`）不算 —— 判据只认"整个字面量就是它"，
//   免得把给用户看的句子也逼成拼接（那才是判据面超出问题面）。
// ─────────────────────────────────────────────────────────────────
console.log('\n📄 技能包入口文件名只许住定义文件（反向判据）');
const SKILL_ENTRY_OWNERS = new Set([
  'src/components/agent/skill/rules/skillEntry.ts',
  'localTool/src/routes/skills.ts',
]);
let entryLiteralViol = 0;
for (const base of [SRC, BACKEND_SRC]) {
  if (!existsSync(base)) continue;
  for (const f of collectFiles(base)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (SKILL_ENTRY_OWNERS.has(rel)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // 大小写不敏感（TD-11-64）：判据要覆盖"协议名的任何写法"，而 `skillImport` 里为了容忍手写包
      // 本来就在做 `baseOf(...).toLowerCase() === 'skill.md'` —— 首版闸只抓规范大小写 ⇒ **两处真实例当场漏检**
      // （那两处若在改名时漏改，整目录导入会静默失效且闸永远绿）。枚举式判据必漏，故这里收成"同形即违规"。
      if (/['"`]SKILL\.md['"`]/i.test(line)) {
        entryLiteralViol++;
        fail(
          `写了技能包入口文件名字面量: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（改用 \`SKILL_ENTRY_FILE\` / \`findSkillEntryFile(files)\` / \`skillEntryRelPath(category, slug)\`：` +
            `它是**跨栈协议名**，散着写就没人能保证两侧一致。见 TD-11-59）`,
        );
      }
    }
  }
}
if (entryLiteralViol === 0) {
  console.log('  ✅ 无散落的入口文件名字面量（唯一住处：skillEntry.ts 与后端 routes/skills.ts）');
}

// 规则（2026-09-22 · TD-11-25）：**命令行只许 argv 传递**。
//
// 【为什么必须有】`execSync(`${cmd} "${dir}"`)` 把变量拼进命令行 ⇒ 变量一旦含 `"` / `$()` / 反引号
//   就能逃出引号执行任意命令。而"路径合法字符集"这条判据**靠不住**：后端 `isSafeSegment` 刻意宽松
//   （POSIX 文件名本就可以含 `"`，Finder 也建得出来），前端另有一份（还更严）⇒ 两端分歧本身就是
//   已登记的债（TD-11-25）。所以正确的收口不是在字符集上打补丁，而是**让 shell 不再参与**：
//   `execFileSync(cmd, [arg, …])` 以 argv 传递，参数不经过 shell 解析 ⇒ 这一整类注入结构上不存在。
//   实证（2026-09-22）：全仓一次 grep 命中 4 处（`routes/skills.ts` open-dir、`routes/files.ts` ×2、
//   `index.ts` 开浏览器），其中前三处的参数分别来自**技能库目录名**与**用户可控查询参数**。
//
// 【判据（反向 · 2026-09-22 加固，TD-11-48）】**一律禁 `execSync(` / `exec(`**（豁免下表列出的文件），
//   只允许 argv 形态（`execFileSync(cmd, [args])`）。
//
// 【为什么从"抓模板插值"改成"一律禁"】首版判据是单行正则抓 `` execSync(`…${x}`) `` ⇒ 两处漏检：
//   ① 写成多行（反引号换到下一行）；② **先拼串再传**（`const c = \`…${x}\`` 然后 `execSync(c)`）——
//   那是最自然的规避写法，也是最可能的真实写法。既然**批准形态只有 argv 一种**，
//   直接禁掉 `exec*` 比"枚举危险写法"完整得多（枚举式判据的覆盖永远是漏的：本仓 M1 母体）。
// 【为什么不是"更宽松即可"】`execFileSync` 不含 `exec(`（后面是 `FileSync`），
//   `RegExp.exec(` 有 `.` 前缀被排除，故本判据在真实代码上零误报。
// 【唯一豁免（带理由，改它要过评审）】`localTool/src/utils/openExternal.ts` —— **拉起外部程序的唯一入口**：
//   ① 非 shell 分支走 `execFileSync(cmd, [target])`（argv ⇒ 注入结构上不存在）；
//   ② `shell:true` 分支走 `execSync`，**全仓只有「开画布页」一个调用点用它**（URL 由本仓拼出、无外部输入），
//      且 Windows 的 `start` 是 cmd **内置命令**，argv 形态会 ENOENT。
//   【143 · S9′ 迁移】此前豁免的是 `localTool/src/index.ts`（当时那处 `execSync` 在那里）——
//   收口后 `execSync` 迁进唯一入口，**豁免随之迁移**（不是新增豁免，总豁免数仍为 1）。
// ─────────────────────────────────────────────────────────────────
console.log('\n🐚 命令行只许 argv 传递：禁 exec / execSync（反向判据）');
const SHELL_ARGV_EXEMPT = new Set(['localTool/src/utils/openExternal.ts']);
let shellViol = 0;
for (const base of [SRC, BACKEND_SRC]) {
  if (!existsSync(base)) continue;
  for (const f of collectFiles(base)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (rel.endsWith('.d.ts')) continue; // 类型声明：里面的 `exec(...)` 是方法签名，不是命令执行
    if (SHELL_ARGV_EXEMPT.has(rel)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      // 变量间接（`const c = ...` 然后 `execSync(c)`）也被这条抓住 —— 它不看参数形态
      // ⚠️ 交替分支要写全 `execSync|exec`（首版写成 `e(xec|execSync)` ⇒ `execSync(` 永远匹不上，
      //    是探针把它逼出来的：注入"先拼串再传"后闸仍绿）
      if (/(^|[^.\w])(execSync|exec)\s*\(/.test(line)) {
        shellViol++;
        fail(
          `使用了 shell 形态的命令执行: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（改用 execFileSync(cmd, [arg, …])：argv 不经 shell 解析，"路径里有没有引号/命令替换"` +
            `就不再是安全前提 —— 别去补字符集，那是会漂移的判据。见 TD-11-25 / TD-11-48）`,
        );
      }
    }
  }
}
if (shellViol === 0) {
  console.log(
    '  ✅ 无 exec/execSync 调用（扫 src + localTool/src；豁免唯一入口 localTool/src/utils/openExternal.ts）',
  );
}

// 规则（2026-09-22 · TD-11-62）：Skill 的**组哨兵字面量**只许住在定义处 `skillGroup.ts`。
//
// 【为什么】这两个值（`__official` / `__index-only`）是模块的**内部实现细节**；消费者该读
//   `SkillGroupView.kind` / `SkillPickGroup.kind`（语义），不是哨兵字符串。此前它们被导出 ⇒
//   设置页直接写 `g.name === OFFICIAL_GROUP` 做渲染分支 ⇒ **改哨兵值即静默失效**（无类型错、无测试拦）。
//   "门面不转发"堵住了域外 `import` 这条路，但堵不住有人**手抄字面量** ⇒ 本闸补上这半。
//   （判据 3：约束落结构。只靠"记得别抄"是判据 4 的补丁形态。）
// 【判据】除 `skillGroup.ts`（唯一定义处）外，`src/**` 内出现含 `__official` / `__index-only` 的字符串字面量 ⇒ 违规。
// 【TD-11-68 起定义处换了文件】TD-11-62 时这两个哨兵住在 `skillLibraryView.ts`；拆分后组语义
//   整体搬到 `skillGroup.ts`（列表与下拉**共用**它）⇒ 闸的归属跟着定义走，不然唯一住处就成了旧文件。
// ─────────────────────────────────────────────────────────────────
console.log('\n🏷️  Skill 组哨兵字面量只许住在 skillGroup.ts（反向判据）');
const SENTINEL_OWNER = 'src/components/agent/skill/rules/skillGroup.ts';
let sentinelViol = 0;
for (const base of [SRC]) {
  if (!existsSync(base)) continue;
  for (const f of collectFiles(base)) {
    const rel = f.slice(root.length + 1).replace(/\\/g, '/');
    if (!/\.(ts|tsx)$/.test(rel)) continue;
    if (rel === SENTINEL_OWNER) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    for (const [i, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (/['"`]__(official|index-only)['"`]/.test(line)) {
        sentinelViol++;
        fail(
          `抄了 Skill 组哨兵字面量: ${rel}:${i + 1} → ${trimmed.slice(0, 100)}` +
            `（读 \`SkillGroupView.kind\`（'official'/'index-only'/'normal'）而不是比哨兵字符串 ——` +
            ` 哨兵是 \`skillGroup.ts\` 的实现细节，改它不该影响任何消费者。见 TD-11-62）`,
        );
      }
    }
  }
}
if (sentinelViol === 0) {
  console.log('  ✅ 无消费者手抄组哨兵（唯一住处：skillGroup.ts）');
}

console.log(`\n${errors === 0 ? '✅ 架构校验通过' : `❌ ${errors} 处架构违规`}`);
process.exit(errors === 0 ? 0 : 1);
