#!/usr/bin/env node
/**
 * m1-count.mjs — M1「React 重渲反模式」形态计数（**度量工具，不是闸**）
 *
 * 【为什么存在（TD-25-42）】性能轮的验收口径（ADR-0019：验收看**数量净减**，不看症状消失）
 *   原先停在 M1 评审 §一 的 7 行手写 grep。那套口径**不可复算**，三处硬伤：
 *     ① markdown 表格里 `\|` 转义后，ERE 的 `(^|[^.A-Za-z])memo\(` 被抄成 `(^\|…)` ⇒ 命令与数字脱钩；
 *     ② `=\{[^}]{0,60}=>` 里的 `{0,60}` 是**任意上界**，不是判据 ⇒ 换个上界就换个数；
 *     ③ 没有脚本 = 没有固定扫描面（`--include` / 目录 / 文件类型全靠人手敲）。
 *   实证：同一句「裸 memo」口径，2026-09-20 记 **37**、2026-09-21 复测 **52** ⇒ 改前改后**不可比**。
 *   ⇒ 本脚本把口径**钉进 AST**，同一份输入恒出同一个数，`--diff` 自动算净减。
 *
 * 【口径定义（唯一真源 = 本文件；文档只许引用，禁抄数字）】
 *   扫描面：`src/**\/*.{ts,tsx}`（统一两种后缀；JSX 只可能出现在 .tsx，故对 .ts 扫描恒为 0，不影响结果）。
 *   ├─ memo 决策点（真实层，净减看这几项）
 *   │   ① `memo(…)`            = CallExpression，被调为 Identifier `memo`
 *   │   ② `React.memo(…)`      = CallExpression，被调为 MemberExpression `React.memo`
 *   │   ③ 带自定义比较器       = ①② 且 `arguments.length > 1`
 *   └─ JSX 内联 prop 形态（**噪声层**，只作参考；≠ 违规数）
 *       ④ 内联箭头 prop  = JSXAttribute 的初值为 `{ (…) => … }` / `{ function … }`
 *       ⑤ 内联数组 prop  = 初值为 `{ [ … ] }`
 *       ⑥ 内联对象 prop  = 初值为 `{ { … } }`
 *
 *   ⚠️ ④⑤⑥ 是**形态计数**，不是违规数：`onClick` 之外大量合法写法同样命中。
 *      M1 评审实测信噪比 ≈ 1.7%（1571 形态 : 27 真违规）⇒ **不许拿 ④⑤⑥ 当验收数字**，
 *      也不许据此建闸（见下）。**真违规数需人判**，机器给不出（M1 评审 §9.7）。
 *
 * 【为什么它不是闸（不要把它改成闸）】
 *   M1 评审 §三 已裁定**不建闸**：建闸前置评审第 5 问一票否决（合法通过成本落在"每写一次 JSX prop"
 *   这个最高频动作上，98% 误伤），第 4/6 问不过（红了无唯一修法；覆盖基数靠人解释）。
 *   本脚本**无 pass/fail、无退出码语义（恒 0）、不挂 CI / check:health** —— 它只出数字。
 *   判据源：`docs/adr/ADR-0016`（建闸默认不建）· `docs/adr/ADR-0019`（净减口径）· M1 评审轮次文件。
 *
 * 【与 m1-scan.mjs 的区别（名字撞车，勿混）】
 *   `m1-scan.mjs` = 测试的 **TS 类型错误分布**（另一个"M1"）；本文件 = **React 重渲形态计数**。
 *
 * 【用法】
 *   node scripts/m1-count.mjs                          # 打印口径表
 *   node scripts/m1-count.mjs --json tmp/m1-before.json # 落基线快照（施工前）
 *   node scripts/m1-count.mjs --diff tmp/m1-before.json # 施工后跑：自动算净减
 *   node scripts/m1-count.mjs --json tmp/m1-after.json --diff tmp/m1-before.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const { values } = parseArgs({
  options: {
    json: { type: 'string' },
    diff: { type: 'string' },
  },
});

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const SRC = join(root, 'src');

/** 六个口径项的稳定顺序 + 人可读名（打印与 diff 都按它走，禁各处另排一份） */
const METRICS = [
  { key: 'bareMemo', label: '裸 memo(…)' },
  { key: 'reactMemo', label: 'React.memo(…)' },
  { key: 'memoWithComparator', label: '带自定义比较器' },
  { key: 'inlineArrowProps', label: '内联箭头 prop' },
  { key: 'inlineArrayProps', label: '内联数组 prop' },
  { key: 'inlineObjectProps', label: '内联对象 prop' },
];

/** 递归收集 .ts/.tsx（相对 root 的正斜杠路径，排序稳定 ⇒ 输出可 diff） */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (abs.endsWith('.ts') || abs.endsWith('.tsx')) out.push(abs);
  }
  return out;
}

/** 单文件 AST 计数。返回六项 + parseError（TS 的 createSourceFile 会容错恢复，但仍记账） */
function scanFile(code) {
  const sf = ts.createSourceFile('f.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const m = {
    bareMemo: 0,
    reactMemo: 0,
    memoWithComparator: 0,
    inlineArrowProps: 0,
    inlineArrayProps: 0,
    inlineObjectProps: 0,
  };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const c = node.expression;
      const isBare = ts.isIdentifier(c) && c.text === 'memo';
      const isReact =
        ts.isPropertyAccessExpression(c) &&
        ts.isIdentifier(c.expression) &&
        c.expression.text === 'React' &&
        c.name.text === 'memo';
      if (isBare || isReact) {
        if (isBare) m.bareMemo++;
        else m.reactMemo++;
        if (node.arguments.length > 1) m.memoWithComparator++;
      }
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const init = node.initializer;
      if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) m.inlineArrowProps++;
        else if (ts.isArrayLiteralExpression(e)) m.inlineArrayProps++;
        else if (ts.isObjectLiteralExpression(e)) m.inlineObjectProps++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { metrics: m, parseErrors: sf.parseDiagnostics.length };
}

// ── 1. 扫描 ──
const files = walk(SRC).sort();
if (files.length === 0) {
  // 扫描基数自检：0 个文件不是"干净"，是"没扫"（TD-02-9 / TD-22-53 同款教训）
  console.error('✖ 扫描到 0 个源文件 —— 目录改名 / 路径错，不是"干净"。');
  process.exit(1);
}

const totals = Object.fromEntries(METRICS.map((x) => [x.key, 0]));
const perFile = {};
let parseErrorFiles = 0;

for (const abs of files) {
  const rel = relative(root, abs).replace(/\\/g, '/');
  const { metrics, parseErrors } = scanFile(readFileSync(abs, 'utf8'));
  const sum = METRICS.reduce((s, x) => s + metrics[x.key], 0);
  if (sum > 0) perFile[rel] = metrics;
  for (const x of METRICS) totals[x.key] += metrics[x.key];
  if (parseErrors > 0) parseErrorFiles++;
}

const memoDecisionPoints = totals.bareMemo + totals.reactMemo;

// ── 2. 打印口径表 ──
const row = (label, n) => `  ${label.padEnd(22)} ${String(n).padStart(6)}`;
console.log('══════ M1 · React 重渲反模式形态计数（AST 口径，度量工具非闸）══════');
console.log(`扫描面 src/**/*.{ts,tsx}：${files.length} 个文件（其中含 memo/内联 prop 的 ${Object.keys(perFile).length} 个）`);
if (parseErrorFiles) console.log(`  ⚠️ ${parseErrorFiles} 个文件有 TS 解析诊断（已容错恢复，计数可能偏低）`);
console.log('');
console.log('── 真实层：memo 决策点（净减看这几项）──');
console.log(row(METRICS[0].label, totals.bareMemo));
console.log(row(METRICS[1].label, totals.reactMemo));
console.log(row('  └ 合计决策点', memoDecisionPoints));
console.log(row(METRICS[2].label, totals.memoWithComparator));
console.log('');
console.log('── 噪声层：JSX 内联 prop 形态（≈98% 噪声，非违规数）──');
console.log(row(METRICS[3].label, totals.inlineArrowProps));
console.log(row(METRICS[4].label, totals.inlineArrayProps));
console.log(row(METRICS[5].label, totals.inlineObjectProps));
console.log('');

// ── 3. 落基线 ──
const snapshot = {
  generatedAt: new Date().toISOString(),
  scope: 'src/**/*.{ts,tsx}',
  filesScanned: files.length,
  memoDecisionPoints,
  totals,
  perFile,
};

if (values.json) {
  const out = resolve(root, values.json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`✔ 基线已落 ${relative(root, out)}`);
}

// ── 4. 算净减（施工前 --json 一份，施工后 --diff 指向它）──
if (values.diff) {
  const basePath = resolve(root, values.diff);
  const base = JSON.parse(readFileSync(basePath, 'utf8'));
  const delta = (a, b) => {
    const d = b - a;
    return d === 0 ? '±0' : d > 0 ? `+${d} ↑` : `${d} ↓`;
  };
  console.log(`── 净减对照（基线 ${base.generatedAt} → 现在）──`);
  console.log(`  ${'口径'.padEnd(22)} ${'改前'.padStart(6)} ${'改后'.padStart(6)}   Δ`);
  for (const x of METRICS) {
    const a = base.totals[x.key] ?? 0;
    const b = totals[x.key];
    console.log(`  ${x.label.padEnd(22)} ${String(a).padStart(6)} ${String(b).padStart(6)}   ${delta(a, b)}`);
  }
  console.log(`  ${'（memo 决策点合计）'.padEnd(20)} ${String(base.memoDecisionPoints ?? 0).padStart(6)} ${String(memoDecisionPoints).padStart(6)}   ${delta(base.memoDecisionPoints ?? 0, memoDecisionPoints)}`);
  console.log('');
  // 定位：哪些文件的 memo 决策点变了（噪声层不列，避免淹没）
  const memoOf = (m) => (m?.bareMemo ?? 0) + (m?.reactMemo ?? 0);
  const all = new Set([...Object.keys(base.perFile ?? {}), ...Object.keys(perFile)]);
  const moved = [...all]
    .map((f) => ({ f, a: memoOf(base.perFile?.[f]), b: memoOf(perFile[f]) }))
    .filter((x) => x.a !== x.b)
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  if (moved.length === 0) {
    console.log('  文件级：无文件 memo 决策点变化。');
  } else {
    console.log(`  文件级 memo 决策点变化（${moved.length} 个）：`);
    for (const x of moved) console.log(`    ${x.a} → ${x.b}  ${x.f}`);
  }
  console.log('');
  console.log(`▶ 落账口径：把上表原样粘进轮次文件 §八「减二」一行（凭证 = 本命令 + 本输出）。`);
}
