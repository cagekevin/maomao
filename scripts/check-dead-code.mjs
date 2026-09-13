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
 * 用法：
 *   node scripts/check-dead-code.mjs                    # 校验（新增死代码 → 退出码 1）
 *   node scripts/check-dead-code.mjs --update-baseline  # 清偿/改名后重生成基线（须 review diff）
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_PATH = fileURLToPath(new URL('./dead-code-baseline.json', import.meta.url));
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
