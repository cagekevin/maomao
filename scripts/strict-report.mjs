#!/usr/bin/env node
/**
 * strict 类型收口报告工具（只读 · 不 fail）—— TD-09-1 选项 A 的辅助，供「渐进消除隐式 any」的执行者使用。
 *
 * 【用法】
 *   node scripts/strict-report.mjs                     # 全仓概览 + 建议下一步
 *   node scripts/strict-report.mjs --dir src/components/base/storage   # 某目录全部错误 + 明细
 *   node scripts/strict-report.mjs --file src/App.tsx                  # 单文件全部错误
 *   node scripts/strict-report.mjs --top 30            # TOP N 文件（默认 15）
 *
 * 【与 check-strict-src.mjs 的分工】本脚本只读、只报告（不 exit 1）；门禁是 `npm run check:strict-src`。
 * 白名单真源 = scripts/strict-src-whitelist.json（两脚本共用）。
 *
 * 【与 ts-detail.mjs 的分工——勿当「第二实现」】
 *   - `ts-detail.mjs`：面向 **tests 侧**（复制 tests/unit → 剥 @ts-nocheck → 临时 config），支持 `--project` 子项目。
 *   - 本脚本：面向 **src 侧 noImplicitAny**（直接 `tsc -p tsconfig.json --noImplicitAny`；src 无 @ts-nocheck 故**不需副本**，
 *     天然规避 m1-scan 的副本 GBK 假阳性坑 #17），并叠加「白名单门禁视图 + 按域/建议下一步」。
 *   两者解析层同源（同为 `path(line,col): error TSxxxx:`）—— **改任一方须同步另一方**。
 *
 * 【解析率自检】沿用 ts-detail 踩坑 #13：正则失配时静默「0 错」比不扫更危险，故显式对比行数。
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dirArg = flag('--dir');
const fileArg = flag('--file');
const topN = Number(flag('--top') || 15);

const whitelist = JSON.parse(
  readFileSync(new URL('./strict-src-whitelist.json', import.meta.url), 'utf8'),
).whitelist;

/** tsc 错误行：`path(line,col): error TSxxxx: message`
 *  刻意不加行尾 `$`（与 ts-detail 一致）：错误消息可能含 `(` 等，宽松匹配更稳；续行不含 "error TS" 自然忽略。 */
const ERR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)/;

let raw = '';
try {
  raw = execSync('npx tsc -p tsconfig.json --noEmit --noImplicitAny', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
} catch (e) {
  raw = `${e.stdout || ''}${e.stderr || ''}`;
}

const errors = [];
let errLineCount = 0;
const unresolved = [];
for (const line of raw.split(/\r?\n/)) {
  if (!line.includes('error TS')) continue;
  errLineCount++;
  const m = ERR_RE.exec(line.trim());
  if (!m) {
    unresolved.push(line.trim());
    continue;
  }
  errors.push({
    file: m[1].replace(/\\/g, '/'),
    line: +m[2],
    col: +m[3],
    code: m[4],
    msg: m[5],
  });
}

// ── 解析率自检（踩坑 #13：静默「0 错」比不扫更危险，必须显式暴露）──
if (errLineCount > 0 && errors.length < errLineCount) {
  console.error(
    `\n⚠ 解析率异常：含 error TS 的行=${errLineCount}，成功解析=${errors.length}（统计可能失真，勿据此下结论）`,
  );
  unresolved.slice(0, 5).forEach((l) => console.error('   ' + l.slice(0, 160)));
  console.error('');
}

const inWl = (f) => whitelist.some((w) => f.startsWith(w));
const pad = (n, w = 5) => String(n).padStart(w);

// ── --file 模式 ──
if (fileArg) {
  const target = fileArg.replace(/\\/g, '/');
  const list = errors.filter((e) => e.file === target);
  console.log(`📄 ${target} —— ${list.length} 处${inWl(target) ? '（★白名单内：必须清零）' : ''}`);
  for (const e of list) console.log(`  ${e.line}:${e.col}  ${e.code}  ${e.msg}`);
  if (list.length === 0) console.log('  ✅ 无隐式 any');
  process.exit(0);
}

// ── --dir 模式 ──
if (dirArg) {
  const target = dirArg.replace(/\\/g, '/');
  const list = errors.filter((e) => e.file.startsWith(target));
  const byCode = new Map();
  const byFile = new Map();
  for (const e of list) {
    byCode.set(e.code, (byCode.get(e.code) || 0) + 1);
    byFile.set(e.file, (byFile.get(e.file) || 0) + 1);
  }
  console.log(`📁 ${target} —— ${list.length} 处${inWl(target) ? '（★白名单内：必须清零）' : ''}`);
  console.log(
    '  按错误码：' +
      [...byCode]
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${c}×${n}`)
        .join('  '),
  );
  console.log('  按文件：');
  for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`    ${pad(n, 4)}  ${f}`);
  console.log('\n  ── 明细 ──');
  for (const e of list) console.log(`  ${e.file}(${e.line},${e.col}) ${e.code}: ${e.msg}`);
  process.exit(0);
}

// ── 概览模式 ──
const wlErrors = errors.filter((e) => inWl(e.file));
const outside = errors.filter((e) => !inWl(e.file));

const byDomain = new Map();
for (const e of outside) {
  const m = /^(src\/components\/[^/]+|src\/[^/]+)\//.exec(e.file);
  const key = m ? m[1] + '/' : 'src/(根文件)';
  byDomain.set(key, (byDomain.get(key) || 0) + 1);
}
const byFile = new Map();
for (const e of outside) byFile.set(e.file, (byFile.get(e.file) || 0) + 1);
const byCode = new Map();
for (const e of errors) byCode.set(e.code, (byCode.get(e.code) || 0) + 1);

console.log('🔍 strict 类型收口报告（noImplicitAny · TD-09-1 选项 A）');
console.log(`   存量总计：${errors.length} 处`);
console.log(
  `   白名单：${whitelist.join(' · ') || '(空)'} → ${wlErrors.length === 0 ? '✅ 已清零' : `❌ ${wlErrors.length} 处未清（门禁会红）`}`,
);

console.log('\n── 按域（白名单外，待收口）──');
for (const [k, n] of [...byDomain].sort((a, b) => b[1] - a[1])) console.log(`   ${pad(n)}  ${k}`);

console.log('\n── 按错误码 ──');
for (const [c, n] of [...byCode].sort((a, b) => b[1] - a[1])) console.log(`   ${pad(n)}  ${c}`);

console.log(`\n── TOP ${topN} 文件（错误最多）──`);
for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1]).slice(0, topN))
  console.log(`   ${pad(n)}  ${f}`);

console.log('\n── 建议下一步（白名单外 · 错误最少的文件，最易啃）──');
for (const [f, n] of [...byFile].sort((a, b) => a[1] - b[1]).slice(0, 10))
  console.log(`   ${pad(n)}  ${f}`);

console.log(
  '\n提示：`--file <path>` 看单文件明细；`--dir <path>` 看整目录；收口一个目录后把路径加进 scripts/strict-src-whitelist.json',
);
