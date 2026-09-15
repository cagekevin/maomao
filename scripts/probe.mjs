#!/usr/bin/env node
/**
 * 「先红后绿」探针执行器 —— **临时注入 → 跑命令 → 精确断言 → 自动还原**。
 *
 * 【为什么存在】`架构师改码7步法` §7.1 / `债务登记5步法`（工具债硬要求）都强制要求"先红后绿"证据：
 *   ① **闸探针（负例探针）**：往源码/闸配置里注入一处违规 → 期待闸**精确报该处**（exit≠0 + 命中提示）；
 *   ② **行为探针**：把修复**临时还原成旧实现** → 期待单测**精确变红**。
 *   本仓实测该动作高频（「先红后绿」出现在 38 份 md、「探针」43 份、「负例/反向探针」16 份区域日志），
 *   但每次都是**手工改源码 + 手工还原**，有三个真实风险：
 *     · **忘还原** → 注入态留在工作区/`git` 里（正是 A8「状态不许预支」的反面：假账 + 后续闸/单测带着违规跑）；
 *     · **红的不是那点** → 注入点不唯一/没命中时，命令照样失败，人眼分不清"打中了"还是"本来就红"；
 *     · **证据靠手抄** → 探针结论要人工搬进区域日志，易漏易失真。
 *   本工具把这三件事变成机器判定：**原子还原 + 精确断言 + 结论块直出**。
 *
 * 【只做一件事】临时改一个文件的一处 → 跑一条命令 → 比对"退出码 + 输出命中" → 无条件还原。
 *   不是测试框架、不选测试、不并发、不缓存——那些是 vitest / gates-run 的活。
 *
 * 【保命机制（三条）】
 *   1. **journal 兜底**：注入前把**原文全文**写进 `scripts/.probe/<ts>-<name>.journal.json`；还原在 `finally`。
 *      启动时先 `recoverStale()` —— 若发现上次被 Ctrl+C/崩溃打断留下的 journal，**先还原再干活**。
 *   2. **注入点唯一性**：字面量/正则默认必须**恰好命中 1 处**；0 处 = 探针无效（exit 2），>1 处须显式 `--all`。
 *      0 处也要报错，否则"命令失败"会被误当"探针命中"（本仓 TD-02-9「假护栏恒绿」同款教训）。
 *   3. **还原自校验**：还原后重算 sha256，与注入前不一致 → 大声报错并保留 journal（供手工恢复）。
 *
 * 【用法】
 *   # 闸探针：注入一处空 catch → 期待 check:catch 报错且命中关键词
 *   node scripts/probe.mjs --label "check:catch 负例" \
 *     --file src/components/base/store/taskStore.ts \
 *     --find "catch { }" --replace "catch { }" \
 *     --run "node scripts/check-silent-catch.mjs" \
 *     --expect-exit 1 --expect-out "catch {} 空块"
 *
 *   # 行为探针：临时还原旧实现 → 期待单测变红（可加 --expect-not-out 防"红在别处"）
 *   node scripts/probe.mjs --label "TD-xx 行为探针" \
 *     --file src/components/x/y.ts --find "<新实现>" --replace "<旧实现>" \
 *     --run "npx vitest run tests/unit/x.test.ts" \
 *     --expect-exit 1 --expect-out "expected '#000000' to be '#ffffff'"
 *
 *   # 正则注入（含捕获组，$1..$9 可用）+ 干跑预览（不写盘）
 *   node scripts/probe.mjs --file a.ts --find-re "foo\(\s*\)" --replace "foo(1)" --run "..." --dry
 *
 * 【参数】
 *   --file <相对仓库根的路径>     必填
 *   --find <字面量> | --find-re <正则>   必填，二选一
 *   --replace <替换文本>          必填（正则模式支持 $1..$9）
 *   --run "<shell 命令>"          必填，cwd = 仓库根
 *   --expect-exit <N>            期待退出码（默认：只要求"命令失败"= 非 0？→ 不，默认不校验退出码，显式给才校验）
 *   --expect-out <子串>          期待命中（stdout+stderr 合并后）
 *   --expect-not-out <子串>      期待不出现（防"红在别处"）
 *   --label <名字>               探针名（进结论块，便粘贴）
 *   --all                        允许注入点出现多处时全部替换
 *   --dry                        只预览注入 diff，不写盘、不跑命令
 *
 * 【退出码】0 = 观测与期望**一致**（探针命中）；1 = 不一致（探针未命中）；2 = 探针本身无效（参数/注入点/还原失败）。
 * 【界限】临时改文件这一动作**只允许通过本工具做**；用完即还原，**不允许 --keep 式保留**（那是假账的入口）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JOURNAL_DIR = join(ROOT, 'scripts', '.probe');

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12);
const fail = (msg, code = 2) => {
  console.error(`❌ 探针无效：${msg}`);
  process.exit(code);
};

/** ── 参数解析 ── */
const argv = process.argv.slice(2);
const val = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : '';
};
const has = (flag) => argv.includes(flag);
const file = val('--file');
const findLit = val('--find');
const findRe = val('--find-re');
const replace = argv.indexOf('--replace') >= 0 ? argv[argv.indexOf('--replace') + 1] : '';
const run = val('--run');
const label = val('--label') || 'probe';
const expectExitRaw = val('--expect-exit');
const expectOut = val('--expect-out');
const expectNotOut = val('--expect-not-out');
const allowAll = has('--all');
const dry = has('--dry');

if (!file) fail('缺 --file');
if (!findLit && !findRe) fail('缺 --find 或 --find-re');
if (findLit && findRe) fail('--find 与 --find-re 二选一，别同时给');
if (replace === undefined || replace === null) fail('缺 --replace');
if (replace === '' && argv.indexOf('--replace') < 0) fail('缺 --replace（要删成空串也请显式传 --replace ""）');
if (!dry && !run) fail('缺 --run（或用 --dry 只预览）');

const target = join(ROOT, file);
if (!existsSync(target)) fail(`--file 不存在：${file}`);

/**
 * 启动自愈：还原上次被中断的探针（防"注入态"跨进程残留）。
 * journal 里存的是**原文全文**，所以即使进程被 kill 也能复原。
 */
function recoverStale() {
  if (!existsSync(JOURNAL_DIR)) return;
  const stale = readdirSync(JOURNAL_DIR).filter((n) => n.endsWith('.journal.json'));
  if (!stale.length) return;
  console.log(`⚠️  发现 ${stale.length} 份上次残留的探针 journal → 先自愈还原：`);
  for (const name of stale) {
    const p = join(JOURNAL_DIR, name);
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      const t = join(ROOT, j.file);
      const cur = existsSync(t) ? readFileSync(t, 'utf8') : '';
      if (sha(cur) !== j.sha256) {
        writeFileSync(t, j.original, 'utf8');
        console.log(`   已还原 ${j.file}（${name}）`);
      } else {
        console.log(`   无需还原 ${j.file}（已是原文，${name}）`);
      }
      unlinkSync(p);
    } catch (e) {
      console.error(`   ⚠️ journal 解析/还原失败（保留原文件待人工）：${name} — ${e.message}`);
    }
  }
}
recoverStale();

const original = readFileSync(target, 'utf8');
const originalSha = sha(original);

/** ── 计算注入结果（并强制注入点唯一） ── */
let injected;
let hitCount;
if (findRe) {
  const re = new RegExp(findRe, allowAll ? 'g' : '');
  hitCount = (original.match(new RegExp(findRe, 'g')) ?? []).length;
  injected = original.replace(re, replace);
} else {
  hitCount = original.split(findLit).length - 1;
  injected = allowAll ? original.split(findLit).join(replace) : original.replace(findLit, replace);
}

if (hitCount === 0) {
  fail(`注入点未命中（探针无效）：--${findRe ? 'find-re' : 'find'} 在 ${file} 里 0 处匹配。\n` +
    '   → 0 处也要报错：否则"命令本来就失败"会被误当"探针命中"（TD-02-9 假护栏恒绿同款）。');
}
if (hitCount > 1 && !allowAll) {
  fail(`注入点不唯一：在 ${file} 里命中 ${hitCount} 处 → 红的可能不是你要验的那点。\n` +
    '   → 加长 --find 上下文使其唯一，或确知要全改时显式 --all。');
}
if (injected === original) fail('注入后内容与原文相同（--replace 与 --find 等价）→ 什么都没改，不构成探针');

/** ── 预览 ── */
if (dry) {
  const before = original.split(/\r?\n/);
  const after = injected.split(/\r?\n/);
  const firstDiff = before.findIndex((l, i) => l !== after[i]);
  console.log(`🔍 干跑预览（未写盘）｜${relative(ROOT, target)}｜命中 ${hitCount} 处｜sha ${originalSha} → ${sha(injected)}`);
  console.log(`   首个差异行 L${firstDiff + 1}:`);
  console.log(`     - ${(before[firstDiff] ?? '').trim().slice(0, 140)}`);
  console.log(`     + ${(after[firstDiff] ?? '').trim().slice(0, 140)}`);
  process.exit(0);
}

/** ── 注入 + 跑 + 还原 ── */
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const journalPath = join(JOURNAL_DIR, `${stamp}-${label.replace(/[^\w\u4e00-\u9fa5-]+/g, '_')}.journal.json`);
mkdirSync(JOURNAL_DIR, { recursive: true });
writeFileSync(journalPath, JSON.stringify({ file, label, cmd: run, sha256: originalSha, original }, null, 0), 'utf8');
writeFileSync(target, injected, 'utf8');

let exitCode = 0;
let output = '';
try {
  output = execSync(run, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  exitCode = 0;
} catch (e) {
  exitCode = typeof e.status === 'number' ? e.status : 1;
  output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
} finally {
  writeFileSync(target, original, 'utf8');
  const restored = sha(readFileSync(target, 'utf8'));
  if (restored !== originalSha) {
    console.error(`❌ 还原自校验失败！${file} 当前 sha=${restored} ≠ 原 sha=${originalSha}`);
    console.error(`   原文已保留在 journal，请手工恢复：${relative(ROOT, journalPath)}`);
    process.exit(2);
  }
  unlinkSync(journalPath);
}

/**
 * 去 ANSI 色码 —— **必须**在比对与打印前做。
 *
 * 【为什么（2026-09-15 实测）】vitest 会给「期望值 / 实际值 / 路径行号」着色，ESC 序列会把
 * 目标子串**切断**（如 `to have a length of \x1b[31m0\x1b[39m`）。后果：`--expect-out` 明明
 * 该命中却报「未命中」→ 把「探针没测到」的假象扣在真实结论上。本仓 TD-22-51 的探针因此
 * 连续两次假红、白跑两轮 —— 这不是"测试不红"，是**工具的眼睛被蒙了一层**。
 */
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const clean = stripAnsi(output);

/** ── 断言（观测 == 期望 才算"命中"） ── */
const checks = [];
if (expectExitRaw !== '') {
  const want = Number(expectExitRaw);
  checks.push({ name: `退出码 == ${want}`, ok: exitCode === want, got: `实际 ${exitCode}` });
}
if (expectOut) {
  checks.push({ name: `输出含「${expectOut}」`, ok: clean.includes(expectOut), got: clean.includes(expectOut) ? '命中' : '未命中' });
}
if (expectNotOut) {
  checks.push({ name: `输出**不含**「${expectNotOut}」`, ok: !clean.includes(expectNotOut), got: clean.includes(expectNotOut) ? '出现了' : '未出现' });
}
if (!checks.length) {
  console.log(`\n⚠️  未给任何断言（--expect-exit / --expect-out / --expect-not-out）→ 只报观测值，**不构成探针证据**。`);
}

const pass = checks.every((c) => c.ok);

console.log(`\n🔬 探针结论｜${label}`);
console.log(`   文件   : ${relative(ROOT, target)}（命中 ${hitCount} 处，已还原 sha=${originalSha}）`);
console.log(`   命令   : ${run}`);
console.log(`   观测   : exit=${exitCode}${clean ? `｜输出 ${clean.split(/\r?\n/).filter(Boolean).length} 行` : ''}`);
for (const c of checks) console.log(`   ${c.ok ? '✅' : '❌'} ${c.name} — ${c.got}`);

if (!checks.length) process.exit(pass ? 0 : 1);
if (pass) {
  console.log(`\n✅ 探针命中（观测与期望一致）—— 可直接粘贴本块进区域日志作为"先红后绿"证据。`);
  process.exit(0);
}
console.log(`\n❌ 探针未命中（观测 ≠ 期望）—— 探针本身没问题，是"你修的那点"没被测到；回去改断言或改探针，别跳过。`);
if (output) {
  console.log('   ── 输出尾部（定位用）──');
  for (const l of clean.split(/\r?\n/).filter(Boolean).slice(-12)) console.log(`   | ${l.slice(0, 160)}`);
}
process.exit(1);
