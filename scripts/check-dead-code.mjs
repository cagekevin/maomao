#!/usr/bin/env node
/**
 * 死代码闸（knip）—— TD-17-1 的落点：把「死代码检测」从 audit/ 孤岛并进主工程闸体系。
 *
 * 【为什么并进来】此前 knip/jscpd/oxlint/depcruise/madge 装在 `audit/download/` 沙盒（.gitignore），
 * 主工程 `package.json` 零引用、CI 装不到 → 工具再强也不生效（"审计师不审计自己"，TD-17-1）。
 * 本闸把**唯一主工程未覆盖**的能力（死代码：未使用导出/类型/文件/依赖）用**主工程 devDependency**
 * 跑起来，登记进 `scripts/gates.manifest.json`，CI 同跑。
 *
 * 【为什么其余四件不并】取证（2026-09-13）：
 *   · depcruise / madge —— 架构规则（循环依赖 + base 分层）已在 `scripts/check-arch.mjs` **自包含实现**
 *     并挂闸；沙盒版只是"全量图/可视化"的额外形态，闸不需要。
 *   · oxlint —— 实测仅 4 条（useless-spread 类），与既有 eslint 覆盖面重叠，再养第二个 linter 不值。
 *   · jscpd —— 实测重复率 1.7%（137 块），无迫切性；阈值闸属主观口径，不设。
 *   · ast-grep —— 是**批量重写执行器**（重构工具），不是闸。
 *
 * 【机制：基线「永不复涨」】存量死代码（基线内）不阻塞、可逐步清偿；**基线外新增死代码 = 闸红**。
 * 与 `check-strict-src.mjs`（白名单渐进收口）同构：防回潮，而不是逼一次清空存量（全量门禁弊大于利）。
 * 基线内条目消失会提示"可移除"（stale，仅告警，保持基线诚实而不制造摩擦）。
 *
 * 【禁止】新增死代码一律**先删**；确为"有意保留的公共 API / 运行时动态使用"→ 在 `knip.json` 配置
 * 豁免（`ignore` / `ignoreExportsUsedInFile` / entry），**不要**直接塞进基线（那是把闸弄瞎）。
 *
 * 【★改：`--update-baseline` 加「不许涨」守卫（2026-09-14）】
 * 原实现**无条件重生成**基线 → 于是"过闸"最便宜的动作就是它（一条命令 = 把违规洗成"存量"），
 * 而正道（删死代码 / 加 knip.json 豁免 + 理由）更贵 ⇒ **违反「闸的成本守恒」（架构师心法 §零.4.1）：
 * 闸会生产它本要禁止的行为**。原实现只有一句注释劝阻（"不要直接 --update-baseline"）—— 注释不是机器约束。
 * 现改为：**当前存在"基线外新增"（= 回归）时拒绝写盘**（exit 1），除非显式 `--allow-new`
 * （仅供"整体重生成确实必要"的场合，如 knip 版本跃迁；届时打印新增清单供 review）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸** —— 死代码是"待清偿债务"，不是物理契约。
 *   Q2 何时该改：① 清偿/改名后跑 `--update-baseline` **移除已消失项**（正途）；
 *               ② knip 版本跃迁等"整体重生成确实必要" → `--allow-new`（会打印新增清单供 review）。
 *               **禁止**用 `--allow-new` 把回归洗成存量 —— 已有「不许涨」守卫拦着（见上方【★改】）。
 *   Q3 怎么改：优先改 `knip.json`（真配置：`ignore` / entry）；基线只能靠**清偿**而缩小，不靠重生成而放大。
 *
 * 用法：
 *   node scripts/check-dead-code.mjs                    # 校验（新增死代码 → 退出码 1）
 *   node scripts/check-dead-code.mjs --update-baseline  # 清偿/改名后重生成（**有新增则拒绝**；须 review diff）
 *   node scripts/check-dead-code.mjs --update-baseline --allow-new   # 显式放行（打印本次新增 N 条）
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PATH = fileURLToPath(new URL('./dead-code-baseline.json', import.meta.url));
/** 显式放行"基线外新增"（默认禁止 —— 见文件头【★改：不许涨】） */
const ALLOW_NEW = process.argv.includes('--allow-new');
/** 与 knip 输出对齐的 issue 类别（knip --reporter json 的 issues[].{files,exports,...}） */
const KINDS = [
  'files',
  'exports',
  'types',
  'dependencies',
  'unlisted',
  'unresolved',
  'enumMembers',
  'binaries',
];
const UPDATE = process.argv.includes('--update-baseline');

if (!existsSync(join(ROOT, 'node_modules', 'knip'))) {
  console.error('❌ 未找到主工程依赖 knip（devDependencies）。请先 `npm install`。');
  process.exit(1);
}
const knipVersion = JSON.parse(
  readFileSync(join(ROOT, 'node_modules', 'knip', 'package.json'), 'utf8'),
).version;

let raw = '';
try {
  raw = execFileSync('npx knip --config knip.json --reporter json --no-exit-code', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  console.error('❌ knip 执行失败：' + (e.stderr || e.message));
  process.exit(1);
}

/** knip JSON → 稳定可比标识集合（`<file>::<kind>::<name>`；不含行号，位置漂移不误判） */
function collect(text) {
  const json = JSON.parse(text);
  const items = [];
  for (const it of json.issues || []) {
    for (const kind of KINDS) {
      for (const entry of it[kind] || []) {
        const name =
          entry && typeof entry === 'object'
            ? (entry.name ?? entry.symbol ?? JSON.stringify(entry))
            : String(entry);
        items.push(`${it.file}::${kind}::${name}`);
      }
    }
  }
  return [...new Set(items)].sort();
}

const current = collect(raw);

if (UPDATE) {
  // ── 「闸的成本守恒」守卫（2026-09-14）：有"基线外新增"= 回归 → 拒绝写盘，把绕行成本抬回正道之上 ──
  const prior = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).items ?? []
    : [];
  const priorSet = new Set(prior);
  const newOnes = current.filter((x) => !priorSet.has(x));
  if (newOnes.length && !ALLOW_NEW) {
    console.error(`\n❌ 拒绝重生成基线：当前有 ${newOnes.length} 条**基线外新增**（这是回归，不是存量）：`);
    for (const x of newOnes.slice(0, 10)) console.error('   + ' + x);
    if (newOnes.length > 10) console.error(`   … 另 ${newOnes.length - 10} 条`);
    console.error(
      '\n处理：① 删除该死代码（首选）；② 确为有意保留（公共 API / 运行时动态使用）→ 在 knip.json 加豁免；\n' +
        '     ③ 仅当"整体重生成确实必要"（如 knip 版本跃迁）→ 显式加 `--allow-new` 并 review 上面的新增清单。',
    );
    process.exit(1);
  }
  if (newOnes.length) console.log(`⚠️  --allow-new 已放行 ${newOnes.length} 条基线外新增（请确认它们不是回归）`);
  const out = {
    _comment:
      '死代码闸基线（scripts/check-dead-code.mjs 消费）。基线内=存量（不阻塞，可逐步清偿）；基线外新增=闸红。重生成：node scripts/check-dead-code.mjs --update-baseline',
    knipVersion,
    count: current.length,
    items: current,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `✅ 基线已重生成：${current.length} 条（knip ${knipVersion}）→ scripts/dead-code-baseline.json`,
  );
  console.log('   请 review diff：若含"新增"，说明把回归也塞进了基线（应改代码或加 knip.json 豁免）。');
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baseSet = new Set(baseline.items);
const curSet = new Set(current);
const added = current.filter((x) => !baseSet.has(x));
const removed = baseline.items.filter((x) => !curSet.has(x));

console.log('🔒 死代码闸（knip · TD-17-1）');
console.log(`   knip ${knipVersion} ｜ 基线存量 ${baseline.items.length} 条 ｜ 当前 ${current.length} 条`);

if (removed.length) {
  console.log(`\n💡 基线内 ${removed.length} 条已消失（已清偿/改名）→ 可跑 --update-baseline 移除：`);
  for (const x of removed.slice(0, 8)) console.log('   - ' + x);
  if (removed.length > 8) console.log(`   … 另 ${removed.length - 8} 条`);
}

if (added.length) {
  console.error(`\n❌ 新增死代码 ${added.length} 条（基线外）：`);
  for (const x of added) console.error('   + ' + x);
  console.error(
    '\n处理：① 删除该死代码；② 若确为有意保留的公共 API / 运行时动态使用 → 在 knip.json 加豁免；' +
      '③ **不要**直接 --update-baseline 把回归塞进基线。',
  );
  process.exit(1);
}
console.log('   ✅ 无新增死代码（基线内存量属待清偿，未阻塞）');
