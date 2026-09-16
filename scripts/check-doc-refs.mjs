#!/usr/bin/env node
/**
 * 【闸】代码注释里的**债号引用**存在性校验 —— 挡「幽灵债号」。
 *
 * ★闸的申诉口
 *   Q1 守什么：**结构偏好闸**（描述层对账）。代码注释里写的 `TD-xx-n` 必须真实存在于账本，
 *              否则后来者按注释去找这条债 → 找不到 → 白跑一轮（本仓已发生：TD-24-1/2 就是
 *              前任按"幽灵债号"立的两条**假债**）。
 *   Q2 何时该改：① 账本口径变更（如新增归档文件）→ 改 `validIds()` 的取号来源；
 *              ② 当"注释引用了一个**尚未登记**的债号"时 —— 正解是**去登记**，不是改闸；
 *              ③ 若某类引用天然不指向账本（如示例中的 `TD-xx-n` 占位）→ 加进 `EXEMPT_PATTERNS`。
 *   Q3 怎么改：**只收窄不放宽**。要放宽先回答"为什么这条引用可以不存在"；答不出就是真幽灵。
 *
 * 【为什么存在】（2026-09-16）
 *   本仓 `描述层无对账`（M4）是最高频母体形态（56/333）。其中**债号引用**是唯一能被机器
 *   精确判定的子类：债号是**有限集合**（账本），引用是**字符串匹配**，两者都能机器枚举。
 *   实证翻车链（TD-24-1/2）：
 *     扫注释 → 与账本交叉 → show 报「均无」→ 判"幽灵债号" → 立 2 条债 + 建议建校验闸
 *     → **结论反了**：注释是对的，真因是 `debt.mjs loadAll()` 漏读全文归档。
 *   故本闸的**前置条件**是账本读口径已修（TD-17-12 已修：loadAll 并入全文归档）。
 *   若口径再坏，本闸会把**所有**引用全文归档的注释全判错 —— 所以本闸必须**复用 `debt.mjs show`
 *   的同一口径**（而不是自己再写一套枚举），且对"仅存于全文归档"的债号**放行**。
 *
 * 【范围（刻意不开大口）】只查**债号**，不查"注释里提到的文件名/符号是否存在"。
 *   原因（2026-09-16 实测）：放宽到文件名会得到 ~70% 误报 —— 大量引用是**历史叙述**
 *   （"旧 PromptLibrary.tsx 已删"、"此前是 VideoEditorDock.tsx"、"路径由 path.ts 派生"）
 *   与**示例占位**（`XxxNode.tsx`）。那会让闸变成假守卫，而本仓已明令：
 *   "闸拦住了它不该拦的" = 闸成本守恒被破坏。文件名级的对账留给人工 + 区域日志。
 *
 * 【豁免（必须带锚点，防"一句话绕过"）】见 EXEMPT_PATTERNS —— 覆盖两种真正的"引用未来"：
 *   ① 模板/文档占位：`XxxNode.tsx` 式的示例、`TD-xx-n` 式的格式说明；
 *   ② 历史叙述：同一行出现「已删/已退役/原名/旧…」等词 → 那是**在讲过去**，不是索引。
 *   豁免必须写在**同一行**且能 grep 到锚点；不接受"整文件豁免"。
 *
 * 【用法】
 *   node scripts/check-doc-refs.mjs             # 全库扫（默认）
 *   node scripts/check-doc-refs.mjs --json      # 机器可读
 *   node scripts/check-doc-refs.mjs --sample 3  # 每类违规最多展示 N 条（默认 12）
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_ROOTS = [join(ROOT, 'src')];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.probe']);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const argv = process.argv.slice(2);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const JSON_OUT = argv.includes('--json');
const SAMPLE = Number(val('--sample', '12'));

/**
 * 豁免：必须在**同一行**命中，且是"在讲过去/在写占位"的显式锚点。
 * 【为什么必须同行】本仓教训：`catch-ok` 曾是自由文本、闸只判"标记是否存在"⇒
 *   理由从不被验证、一句话即绕过。故豁免条件写成**可 grep 的形态**，不接受"注释里提了一句"。
 */
const EXEMPT_PATTERNS = [
  { re: /已删|已退役|已移除|已迁移|已改名|原名|此前|旧实现|旧版|历史|曾(经)?是|tombstone|墓碑/, why: '历史叙述（在讲过去，不是索引）' },
  { re: /TD-xx|TD-XX|TD-x-n|<TD-ID>|`TD-\$\{/, why: '格式占位（文档/模板里的示例）' },
  { re: /例:?|例如|举例|如\s*TD-|比如/, why: '举例' },
];

// ── 取账本有效债号（**复用 debt.mjs 的同一口径**，不另写枚举）──────────────────
function validIds() {
  // 唯一真源 = `debt.mjs list --all --json`（它内部走 loadAll()：主表 ∪ 活归档 ∪ 全文归档）。
  // 不自己读文件：口径一旦分叉，本闸就会批量误报（正是 TD-24-1/2 的翻车形态）。
  const out = execFileSync('node', [join(ROOT, 'scripts', 'debt.mjs'), 'list', '--all', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const rows = JSON.parse(out);
  return new Set(rows.map((r) => r.id));
}

/**
 * 「仅存于全文归档」的债号：`--json` 可能不含它们（取决于 debt.mjs 的 json 投影）。
 * 本闸对这类**放行** —— 它们真实存在，只是没有规范化行。
 * 【判据来源】`debt.mjs show <id>` 对它们会明说「仅存于『全文归档』」。
 */
function archivedIdsFromShow(ids) {
  const ok = new Set();
  for (const id of ids) {
    try {
      const out = execFileSync('node', [join(ROOT, 'scripts', 'debt.mjs'), 'show', id], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
      });
      if (!/均无|不存在|无此/.test(out)) ok.add(id);
    } catch {
      /* show 非 0 退出 = 查不到，保持"不存在" */
    }
  }
  return ok;
}

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXTS.has(extname(name))) yield p;
  }
}

const RE_ID = /\bTD-\d{2}-\d+\b/g;

const files = SCAN_ROOTS.flatMap((r) => [...walk(r)]);

// 基数自检 fail-loud：扫到 0 个文件即报错（防"路径/遍历失效后静默 0 违规"——TD-02-9 同款）
if (files.length === 0) {
  console.error('❌ 债号对账闸自检失败：未扫描到任何 src/**/*.ts(x) 文件（路径或遍历失效）');
  process.exit(1);
}

const usedIds = new Set();
const hits = []; // {file, line, id, text}

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(RE_ID);
    if (!m) return;
    if (EXEMPT_PATTERNS.some((p) => p.re.test(line))) return;
    for (const id of m) {
      usedIds.add(id);
      hits.push({ file: relative(ROOT, file), line: i + 1, id, text: line.trim().slice(0, 120) });
    }
  });
}

const known = validIds();
const unknown = [...usedIds].filter((id) => !known.has(id));
// 未知的再去问 show（可能是"仅存于全文归档"）——放行真实存在的
const archivedOk = unknown.length ? archivedIdsFromShow(unknown) : new Set();
const ghosts = unknown.filter((id) => !archivedOk.has(id));

const violations = hits.filter((h) => ghosts.includes(h.id));

if (JSON_OUT) {
  console.log(JSON.stringify({
    scannedFiles: files.length,
    referencedIds: usedIds.size,
    ledgerIds: known.size,
    ghosts,
    archivedOnly: [...archivedOk],
    violations,
  }, null, 2));
  process.exit(violations.length ? 1 : 0);
}

console.log('🔖 注释债号对账闸（防幽灵债号）');
console.log(`   扫描 src 共 ${files.length} 个文件 · 引用到 ${usedIds.size} 个债号 · 账本有效 ${known.size} 个`);
if (archivedOk.size) {
  console.log(`   ↳ ${archivedOk.size} 个「仅存于全文归档」已放行：${[...archivedOk].join(' ')}`);
}
if (!violations.length) {
  console.log('   ✅ 0 违规（引用的债号全部真实存在）');
  process.exit(0);
}

console.log(`   ❌ ${violations.length} 处引用了**账本中不存在**的债号（幽灵债号）：`);
for (const v of violations.slice(0, SAMPLE)) {
  console.log(`      ${v.file}:${v.line}  ${v.id}`);
  console.log(`         ${v.text}`);
}
if (violations.length > SAMPLE) console.log(`      …（另有 ${violations.length - SAMPLE} 处，--sample N 可调）`);

console.log(`
   ── 怎么修（按次序）──
   ① **先别改注释**：「账本里没有」≠「它不存在」（本仓 TD-24-1/2 就是踩了这个，产出 2 条假债）。
   ② 先 grep **区域日志正文**（那里"新增 TD-xx"是原始事实）：
        grep -rn "TD-02-19" daily/架构日志/ | head
   ③ 若确实存在 → 是**账本读口径**漏了（应已由 loadAll() 并入全文归档覆盖）；
      若是 show 能查到但 --json 查不到 → 本闸的 archivedIdsFromShow 应已放行，请报告。
   ④ 若确实不存在（引用了一个从未登记的号）→ **去登记**该债，或改正注释里的号。
      ⚠️ 禁止为了过闸而把注释删掉 —— 那是把"描述层错误"改成"描述层缺失"。
`);

process.exit(1);
