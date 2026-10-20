#!/usr/bin/env node
/**
 * check-nonnull.mjs — 非空断言（`x!`）「永不复涨」基线闸。
 *
 * 【为什么存在】
 *   `docs/plan/150` 收官期（P7）要给 `@typescript-eslint/no-non-null-assertion` 上闸，但实测存量
 *   **792 处 / 122 文件**（2026-10-20 eslint 实跑）：直接开 error 会让 `npm run lint` 一夜全红，
 *   而「红线不许用 `!`」是本项目贯穿 150 全程的判据 —— 存量是历史债，新增才是要拦的。
 *   故按 `check-dead-code.mjs` 的同一模型：**基线永不复涨**（存量不阻塞、新增即红），逐批下降后
 *   下调基线，最终降到 0 时把规则改成 `error` 并删掉本闸。
 *
 * 【口径（唯一真源 = 本文件 + scripts/nonnull-baseline.json）】
 *   - 命令：`npx eslint src tests --ext .ts,.tsx,.js,.jsx --rule @typescript-eslint/no-non-null-assertion:error -f json`
 *     （走仓库根 `.eslintrc.cjs`，不复制配置、不改源码）
 *   - 计数粒度：**按文件**（`filePath` → 命中条数）与**总量**双重比对；
 *   - 判定：任一文件当前数 > 基线数 ⇒ 红；总量 > 基线总量 ⇒ 红；
 *   - 基数自检：解析到 0 个被扫描文件 ⇒ 判红（防「正则/配置失配却报 0 处」——TD-22-53 同款）。
 *
 * 【怎么降基线】
 *   逐批清完后跑 `node scripts/check-nonnull.mjs --update` 重写基线（人工确认 diff 后再提交）。
 *   **禁止**手改 JSON 数字：它就是「当前已清到哪里」的唯一账本。
 *
 * ★闸的申诉口
 *   Q1 守什么：**新增**非空断言（`x!`）。它把「可能缺」改成编译器闭嘴，运行时越界仍是 TypeError；
 *              红线闸，不是风格偏好（`docs/plan/150` §5.1）。
 *   Q2 何时该改：① 某批 `!` 已清零 → `--update` 下调基线；② 存量全部清零（基线 total = 0）→
 *              把 `.eslintrc.cjs` 的 `no-non-null-assertion` 改 `error` 并**删除本闸**；
 *              ③ eslint 命令/扩展名变化导致解析为 0 → 修本闸的口径，不要放宽判定。
 *   Q3 怎么改：只改本文件与 `scripts/nonnull-baseline.json`（+ `gates.manifest.json` / `GATES` 登记）；
 *              **不要**为了过闸在业务代码里加 `eslint-disable`（那是把闸变成遮羞布）。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = join(ROOT, 'scripts', 'nonnull-baseline.json');
const RULE = '@typescript-eslint/no-non-null-assertion';
const update = process.argv.includes('--update');

function fail(message, code = 1) {
  console.error(`❌ ${message}`);
  process.exit(code);
}

// ── 1. 跑 eslint（只取该规则；配置来自仓库根 .eslintrc.cjs）──────────────────────
const res = spawnSync(
  'npx',
  // 规则值含空格 ⇒ 在 shell 形态下必须自带引号，否则会被拆成两个参数（踩过一次）。
  [
    'eslint',
    'src',
    'tests',
    '--ext',
    '.ts,.tsx,.js,.jsx',
    '--rule',
    `"${RULE}: error"`,
    '-f',
    'json',
  ],
  { cwd: ROOT, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 },
);
const stdout = res.stdout ?? '';
if (!stdout.trim().startsWith('[')) {
  fail(
    `eslint 输出不是 JSON（命令/配置变了？）。stderr 尾部：\n${(res.stderr ?? '').slice(-800)}`,
    2,
  );
}

let report;
try {
  report = JSON.parse(stdout);
} catch (e) {
  fail(`eslint JSON 解析失败：${e instanceof Error ? e.message : String(e)}`, 2);
}
if (!Array.isArray(report) || report.length === 0) {
  fail('eslint 没有返回任何文件结果（扫描根/配置失效），拒绝把「0 处」当成通过。', 2);
}

// ── 2. 按文件计数 ─────────────────────────────────────────────────────────────
const current = {};
let total = 0;
for (const file of report) {
  const messages = Array.isArray(file.messages) ? file.messages : [];
  const hits = messages.filter((m) => m.ruleId === RULE).length;
  if (hits > 0) {
    const rel = relative(ROOT, file.filePath).replace(/\\/g, '/');
    current[rel] = hits;
    total += hits;
  }
}

const scanned = report.length;
if (scanned === 0) fail('扫到 0 个文件（TD-22-53 同款假绿）', 2);

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { total: 0, byFile: {} };

console.log('🔒 非空断言基线闸（禁新增 `x!`）');
console.log(`   扫描文件 ${scanned} 个 · 命中 ${total} 处（基线 ${baseline.total ?? 0} 处）`);

if (update) {
  const next = {
    _comment:
      '非空断言存量基线（唯一账本）。只允许通过 `node scripts/check-nonnull.mjs --update` 下调；禁止手改数字。',
    generatedAt: new Date().toISOString(),
    total,
    byFile: Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`✅ 基线已更新：${total} 处 / ${Object.keys(current).length} 文件`);
  process.exit(0);
}

// ── 3. 判定：新增即红（按文件）+ 总量不得上涨 ────────────────────────────────
const baseByFile = baseline.byFile ?? {};
const regressions = [];
for (const [file, count] of Object.entries(current)) {
  const allowed = baseByFile[file] ?? 0;
  if (count > allowed) regressions.push(`${file}: ${allowed} → ${count}（+${count - allowed}）`);
}
const fixed = Object.keys(baseByFile).filter((f) => !(f in current));

if (regressions.length > 0 || total > (baseline.total ?? 0)) {
  console.error('\n❌ 新增了非空断言（红线：`!` 不得新增，见 docs/plan/150 §5.1）');
  for (const line of regressions) console.error(`   · ${line}`);
  if (total > (baseline.total ?? 0)) {
    console.error(
      `   · 总量 ${baseline.total ?? 0} → ${total}（+${total - (baseline.total ?? 0)}）`,
    );
  }
  console.error('\n   修法：不用 `!`。要么加显式守卫（`if (x === undefined) return/throw`），');
  console.error('   要么改类型表达（`for...of` / `entries()` / 局部常量 / 类型谓词）。');
  process.exit(1);
}

console.log('✅ 未超基线（新增 0 处）');
if (fixed.length > 0) {
  console.log(
    `   提示：${fixed.length} 个文件已清零，可跑 \`node scripts/check-nonnull.mjs --update\` 下调基线`,
  );
}
