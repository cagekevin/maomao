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
 * 【保命机制（四条）】
 *   1. **journal 兜底**：注入前把**原文全文**写进 `scripts/.probe/<ts>-<name>.journal.json`；还原在 `finally`。
 *      启动时先 `recoverStale()` —— 若发现上次被 Ctrl+C/崩溃打断留下的 journal，**先还原再干活**。
 *   2. **注入点唯一性**：字面量/正则默认必须**恰好命中 1 处**；0 处 = 探针无效（exit 2），>1 处须显式 `--all`。
 *      0 处也要报错，否则"命令失败"会被误当"探针命中"（本仓 TD-02-9「假护栏恒绿」同款教训）。
 *   3. **还原自校验**：还原后重算 sha256，与注入前不一致 → 大声报错并保留 journal（供手工恢复）。
 *   4. **并发编辑守卫**（2026-09-18 实测催生）：注入前 / 还原前各校验一次目标文件 sha；
 *      与期望不符（= 运行期间被别的进程改过）⇒ **拒绝覆盖** + exit 2。防的是"整份重写把别人的改动
 *      静默冲掉、探针还报绿"这类**假绿**（比丢一次改动更坏：结论建在旧码上）。
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
 *   --expect-exit <N>            期待退出码（默认不校验退出码，显式给才校验）
 *   --expect-out <子串>          期待命中（stdout+stderr 合并后）
 *   --expect-not-out <子串>      期待不出现（防"红在别处"）
 *   --label <名字>               探针名（进结论块，便粘贴）
 *   --all                        允许注入点出现多处时全部替换
 *   --dry                        只预览注入 diff，不写盘、不跑命令
 *   --suggest-out                跑**未注入**命令，列出可用作 --expect-out 的候选串（治"凭印象猜关键词"）
 *   --skip-baseline              跳过"基线必绿"前置检查（默认开启，见下）
 *
 * 【基线必绿（默认开启 · 2026-09-16 加固）】
 *   注入前先跑一遍**未注入**的同命令；若它本来就失败，则注入后的"红"与你的修复无关
 *   ⇒ 直接拒跑（exit 2）。本仓 TD-02-41 实证：探针首次 `exit=1` 被当成"先红成立"，
 *   真因是那条命令**单文件跑不起来**（未注入时就红）—— 写进日志就是一条假证据。
 *
 * 【退出码】0 = 观测与期望**一致**（探针命中）；1 = 不一致（探针未命中）；2 = 探针本身无效（参数/注入点/基线不绿/还原失败）。
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

/**
 * 去 ANSI 色码 —— **必须**在比对与打印前做。
 *
 * 【为什么（2026-09-15 实测）】vitest 会给「期望值 / 实际值 / 路径行号」着色，ESC 序列会把
 * 目标子串**切断**（如 `to have a length of \x1b[31m0\x1b[39m`）。后果：`--expect-out` 明明
 * 该命中却报「未命中」→ 把「探针没测到」的假象扣在真实结论上。本仓 TD-22-51 的探针因此
 * 连续两次假红、白跑两轮 —— 这不是"测试不红"，是**工具的眼睛被蒙了一层**。
 */
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

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
const skipBaseline = has('--skip-baseline');
const suggestOut = has('--suggest-out');

if (!run) fail('缺 --run');
// --suggest-out 只跑"未注入"的命令，不需要注入参数，故在参数校验前短路。
if (suggestOut) {
  console.log(`\n🧭 建议断言串｜在**未注入**状态下跑一次，提取可用作 --expect-out 的候选\n   命令: ${run}\n`);
  let baseOut = '';
  let baseExit = 0;
  try {
    baseOut = execSync(run, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    baseExit = typeof e.status === 'number' ? e.status : 1;
    baseOut = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const cleanBase = stripAnsi(baseOut);
  const cands = extractCandidates(cleanBase);
  if (!cleanBase.trim()) {
    console.log('   ⚠️  未注入时命令**零输出**。这通常意味着：');
    console.log('       · 命令本身跑不起来（先确认基线），或');
    console.log('       · 这组用例会把进程挂死（本仓 TD-21-2 实例：无限渲染循环 ⇒ 永不产出输出）。');
    console.log('       → 挂死时 probe 不适用，改用受控手工注入 + git diff 核对，并在轮次文件写明口径。');
  } else if (!cands.length) {
    console.log('   （未提取到候选——输出里没有 文件:行 / 断言方法名 / 失败标记行）');
    console.log('   原始输出尾部：');
    for (const l of cleanBase.split(/\r?\n/).filter(Boolean).slice(-10)) console.log(`   | ${l.slice(0, 160)}`);
  } else {
    console.log(`   未注入基线: exit=${baseExit}\n`);
    console.log('   候选（按出现次数降序；次数高 = 多条失败路径都含它 = 更稳）:');
    for (const [s, n] of cands) console.log(`     ${String(n).padStart(2)}×  ${s}`);
    console.log('\n   ⚠️  基线必须为绿（exit=0）才有意义：基线是红的 ⇒ 红的是环境不是你的注入。');
    if (baseExit !== 0) {
      console.log(`   ⛔ 实测基线 exit=${baseExit} → **当前命令本来就失败**，不能用它做探针。`);
      console.log('      换用该测试被设计运行的方式（本仓实例：单文件跑不起来 ⇒ 改用全量 glob 命令）。');
    }
  }
  process.exit(0);
}

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

/**
 * ── 建议断言串（--suggest-out）─────────────────────────────────────────────
 * 跑**未注入**的命令，把输出里"适合当 --expect-out 的候选串"列出来。
 *
 * 【为什么（本仓真实弯路）】`--expect-out` 被**凭印象猜**导致假红至少 4 次：
 *   · 猜 `expected 0 to be 4`，而 vitest 2.x 的 `toHaveLength` 失败**只输出 diff**（`- 4 / + 0`）；
 *   · 猜断言值，而回显只截尾部，第一个失败用例的文案根本没进搜索范围；
 *   · 猜 `to have a length of 0`——那个串**在输出里根本不存在**。
 * 教训原话："必须取自实际输出"。本开关把这一步从人肉记忆变成一条命令。
 */
function extractCandidates(text) {
  const lines = text.split(/\r?\n/);
  const out = new Map(); // 候选串 → 出现次数
  const bump = (s) => {
    const t = s.trim();
    if (t.length < 4 || t.length > 100) return;
    out.set(t, (out.get(t) ?? 0) + 1);
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    // ① 文件:行:列 锚点（vitest / tsc 都产出）
    for (const m of l.matchAll(/([\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs)):(\d+)(?::\d+)?/g)) {
      bump(`${m[1]}:${m[2]}`);
    }
    // ② 断言方法名（区分度最高，且跨用例稳定）
    for (const m of l.matchAll(/\b(toHaveBeenCalled\w*|toBe\w*|toEqual|toContain|toMatch\w*|toThrow\w*|rejects)\b/g)) {
      bump(m[1]);
    }
    // ③ vitest / eslint 的失败标记行
    if (/^[×✕✗]\s/.test(l) || /^(FAIL|✖)\b/.test(l) || /error TS\d+:/.test(l)) bump(l.slice(0, 90));
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
}

/**
 * ── 基线必绿前置（治假红 / 假绿）───────────────────────────────────────────
 * 跑**未注入**的同一条命令：若它本来就失败，则注入后的"红"与你的修复无关 ——
 * 那不是"先红成功"，是**环境造成的假红**，写进日志就是一条假证据。
 *
 * 【本仓实证】TD-02-41 探针首次 `exit=1` 被当成"先红成立"，真因是
 * `stage2-routes.test.js` **不能单文件跑**（依赖 `node --test test/*.test.js` 全量 glob 装载），
 * 未注入时就已经失败。是 `--expect-out` 未命中才暴露了它。
 */
if (!dry && run && !skipBaseline) {
  let baseExit = 0;
  let baseOut = '';
  try {
    baseOut = execSync(run, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    baseExit = typeof e.status === 'number' ? e.status : 1;
    baseOut = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const cleanBase = stripAnsi(baseOut);
  if (baseExit !== 0) {
    console.error(`❌ 探针无效（基线不绿）：未注入时同命令已经 exit=${baseExit} → 注入后的"红"与你的修复无关。\n` +
      '   → 这不是"先红成功"，是环境造成的**假红**；写进日志就是假证据。\n' +
      '   → 正确处置：① 换用该测试被设计运行的方式（如全量 glob 命令）；\n' +
      '                ② 或先用 --suggest-out 看未注入的真实输出/退出码。\n' +
      '   → 确认这条命令的失败与你的注入无关时，显式加 --skip-baseline 跳过本检查。');
    console.error('   ── 未注入输出尾部 ──');
    for (const l of cleanBase.split(/\r?\n/).filter(Boolean).slice(-8)) console.error(`   | ${l.slice(0, 160)}`);
    process.exit(2);
  }
}

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
const injectedSha = sha(injected);

/**
 * ── 并发编辑守卫（2026-09-18 · 实测催生）───────────────────────────────────
 * 【它守什么】探针对目标文件做**整份重写**（注入 + 原子还原）⇒「运行期间别人改了同一个文件」
 *   会被**静默整份覆盖**。实测（本仓真翻车）：注入期间对同一文件做的一处修正被还原冲掉，
 *   而探针照样打印「✅ 探针命中 / exit=0」—— 比丢一次改动更坏的是**结论建立在已被覆盖的旧码上**（假绿）。
 * 【两个窗口都要守】① 读原文 → 注入之间（基线那一段最长）；② 注入 → 还原之间（跑命令那段）。
 * 【处置】一律 fail-loud 且**不覆盖**：exit 2；窗口②额外保留 journal（内含注入前原文全文）供人工合并。
 */
function guardNoConcurrentEdit(phase) {
  const want = phase === 'before-inject' ? originalSha : injectedSha;
  const cur = sha(readFileSync(target, 'utf8'));
  if (cur === want) return;
  console.error(`❌ 探针无效（${phase}：目标文件被并发改动）｜${file}`);
  console.error(`   当前 sha=${cur} ≠ 期望 sha=${want}`);
  console.error('   → 已**拒绝覆盖**（防静默丢弃别人的改动）。确认无并发编辑后再跑。');
  if (phase === 'before-inject') {
    console.error('   → 本次**未写盘**，文件保持改动后的现状（探针没有污染它）。');
  } else {
    console.error(`   → 注入前原文保留在 journal，请手工合并：${relative(ROOT, journalPath)}`);
  }
  process.exit(2);
}

guardNoConcurrentEdit('before-inject');
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
  guardNoConcurrentEdit('before-restore');
  writeFileSync(target, original, 'utf8');
  const restored = sha(readFileSync(target, 'utf8'));
  if (restored !== originalSha) {
    console.error(`❌ 还原自校验失败！${file} 当前 sha=${restored} ≠ 原 sha=${originalSha}`);
    console.error(`   原文已保留在 journal，请手工恢复：${relative(ROOT, journalPath)}`);
    process.exit(2);
  }
  unlinkSync(journalPath);
}

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
