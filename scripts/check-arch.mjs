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
// director3d 外部开源库（CLAUDE.md §二 边界：不扫描、不整改）
const SKIP_DIR = 'src/components/director3d';

let errors = 0;
const fail = (msg) => {
  console.log('  ❌ ' + msg);
  errors++;
};

// ── 收集源码文件（排除 director3d）──
function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = full.slice(root.length + 1);
    if (rel.startsWith(SKIP_DIR + '/') || rel === SKIP_DIR) continue;
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

console.log(`\n${errors === 0 ? '✅ 架构校验通过' : `❌ ${errors} 处架构违规`}`);
process.exit(errors === 0 ? 0 : 1);
