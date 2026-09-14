#!/usr/bin/env node
/**
 * 元层闸：**闸自身自洽** —— 登记在册的闸脚本，头部必须带【申诉口】三问。
 *
 * 【为什么存在】2026-09-14 把「闸的成本守恒律」入规（`架构师心法.md §零.4`），并给 14 道闸逐个补了
 *   【申诉口】（守什么 / 何时该改 / 怎么改，锚点 `★闸的申诉口`）。但那条规定当时**只活在注释与文档里** ——
 *   而本仓已反复实证「**红线只写在注释里 → 必回潮**」（凡收口无闸必回潮，02-1/02-12/04-15 四度实证）。
 *   没有这道闸：① 新加的闸不会写申诉口；② 已有 14 处的句式会各自漂移（无法机器读）；
 *   ③ "闸能不能被挑战"重新变成只有人记得的口头约定 → 成本倒挂会以新形态复发。
 *
 * 【判据（唯一真源 = scripts/gates.manifest.json，本脚本不另立清单）】
 *   从 manifest 的 `gates` + `healthOnly` 读 `cmd`，解析出其中的**脚本文件**，逐个校验：
 *     · 脚本存在；
 *     · 头部 JSDoc 内同时含锚点 `★闸的申诉口` 与三行标签 `Q1 守什么：` / `Q2 何时该改：` / `Q3 怎么改：`。
 *       （留痕：本文件首次落盘时，此处写了**字面的块注释结束符**，导致 JSDoc 提前闭合 → SyntaxError；
 *        故改用文字描述，勿再写该字面量。同族坑见 CLAUDE §六.2 的 JSX 属性区注释。）
 *   缺任一 → 违规（exit 1）。
 *   `cmd` 不是 node 脚本的（如 `npm run type-check` = tsc 本体）→ **明确列出为"跳过"**，不静默略过。
 *
 * 【为什么用 manifest 而不是 glob `scripts/check-*.mjs`】glob 会把**非闸助手**（`check-targets.mjs` 共享扫描根、
 *   `check-build.cjs` 非 manifest 闸）也算进来 → 逼它们写无意义的申诉口（形式主义）。
 *   以 manifest 为准 = 只要求"**真正在闸体系里跑**的脚本"回答三问。
 *
 * 【自检 fail-loud】解析到的脚本数为 0（manifest 改了形状 / 路径失效）→ 当场报错退出，
 *   绝不"静默 0 违规"（教训：TD-02-9 —— check-node-data 曾恒解析空集却长期报「0 缺口」）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸** —— 它守的不是业务代码，而是「**闸体系自身可被挑战**」这条元规则
 *               （申诉口缺失 ⇒ 改闸成本不可估 ⇒ 成本倒挂会以新形态复发）。
 *   Q2 何时该改：① 申诉口的**锚点 / 标签句式**升级时（改 `ANCHOR`/`LABELS` 常量，本脚本自身同步）；
 *               ② 闸清单形状变化时（如出现新的"非脚本闸"形态）同步 `resolveScript`。
 *               注：它**不会**拦住"让份数下降"的动作（只读脚本头、不改任何判定）→ 不构成成本倒挂源。
 *   Q3 怎么改：改本文件的 `ANCHOR` / `LABELS` / `resolveScript`；**真源永远是 `scripts/gates.manifest.json`，
 *               禁止在此另立闸清单**（第二份真相必漂移）。
 *
 * 用法：`node scripts/check-gates.mjs`（挂 `npm run check:gates`，进 push 层）
 * 退出码：有违规 → 1；无 → 0
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'scripts', 'gates.manifest.json');

/** 申诉口的可 grep 锚点 + 三行标签（与 14 道闸的实际写法一致，改这里 = 改全仓口径） */
const ANCHOR = '★闸的申诉口';
const LABELS = ['Q1 守什么：', 'Q2 何时该改：', 'Q3 怎么改：'];

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  console.error(`❌ 无法读取/解析闸清单（${MANIFEST}）：${e.message}`);
  process.exit(1);
}

const entries = [...(manifest.gates || []), ...(manifest.healthOnly || [])];
if (entries.length === 0) {
  console.error('❌ 自检失败：闸清单为空（勿当通过）');
  process.exit(1);
}

/** 从 `cmd` 里解析出仓库内的脚本文件（相对 ROOT）；非脚本命令返回 null 并给出原因 */
function resolveScript(cmd) {
  const m = String(cmd || '').match(/(?:^|\s)([\w./-]+\.(?:mjs|cjs))/);
  if (!m) return { kind: 'non-script' };
  const rel = m[1].replace(/\\/g, '/');
  return { kind: 'script', rel };
}

const violations = [];
const skipped = [];
let checked = 0;

for (const g of entries) {
  const r = resolveScript(g.cmd);
  if (r.kind !== 'script') {
    skipped.push(`${g.id}（cmd 非脚本：${g.cmd}）`);
    continue;
  }
  const abs = join(ROOT, r.rel);
  if (!existsSync(abs)) {
    violations.push(`${g.id} → 闸清单指向的脚本不存在：${r.rel}`);
    continue;
  }
  checked++;

  const text = readFileSync(abs, 'utf8');
  // 头部 = 首个 `*/` 之前（约定：脚本头 JSDoc 必须自洽，见 CLAUDE §五.2）
  const close = text.indexOf('*/');
  const head = close >= 0 ? text.slice(0, close) : text.slice(0, 4000);

  const missing = [];
  if (!head.includes(ANCHOR)) missing.push(`锚点「${ANCHOR}」`);
  for (const label of LABELS) if (!head.includes(label)) missing.push(`标签「${label}」`);
  if (missing.length) {
    violations.push(`${r.rel}（闸 ${g.id}）缺：${missing.join(' · ')}`);
  }
}

console.log('🔒 闸自洽门禁（在册闸脚本必须带【申诉口】三问）');
console.log(`   真源 ${relative(ROOT, MANIFEST).replace(/\\/g, '/')} ｜ 在册 ${entries.length} 条 ｜ 脚本闸 ${checked} 个`);
if (skipped.length) {
  console.log('   跳过（非脚本命令，已明确列出、非静默略过）：');
  for (const s of skipped) console.log(`     - ${s}`);
}
if (checked === 0) {
  console.error('\n❌ 自检失败：一个闸脚本都没解析到（manifest 形状变了 / 路径失效）—— 拒绝"静默 0 违规"');
  process.exit(1);
}

if (violations.length) {
  console.error(`\n❌ ${violations.length} 个闸脚本缺【申诉口】：`);
  for (const v of violations) console.error('   ' + v);
  console.error(
    '\n修法：在该脚本文件头 JSDoc 里补（照抄任一在册闸的【★闸的申诉口 · 三问】段）：\n' +
      `   ${ANCHOR} · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）\n` +
      `   ${LABELS[0]}<红线闸 | 结构偏好闸 | 正确性闸（零豁免口）| 编排器> —— 依据\n` +
      `   ${LABELS[1]}<它拦住了"让同一语义份数下降"的动作时 → 该改；或其它触发条件>\n` +
      `   ${LABELS[2]}<优先改真源 / 清单只收窄 / 改完跑闸探针先红后绿（node scripts/probe.mjs）>`,
  );
  process.exit(1);
}
console.log(`   ✅ ${checked} 个闸脚本全部带【申诉口】三问`);
