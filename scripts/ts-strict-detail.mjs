#!/usr/bin/env node
/**
 * 最严格类型开关的**只读明细器** —— 跑一次 tsc，直接给出「文件:行:错误码:源码行」。
 *
 * 【为什么存在】
 * P4~P6 共约 1900 处待清，每批的动作都是「取明细 → 分类 → 替换 → 复算」。
 * 手工 `tsc | grep | sed` 有两个问题：① 口径靠记忆（漏锚点/少转义就漏行）；
 * ② 拿到行号还要再 `sed -n` 一次才有源码，每批多一轮往返。
 * 本脚本把「跑 + 解析 + 附源码」合成一步，并**自检解析率**（解析出的错误数必须等于 tsc 报告的条数，
 * 否则直接报错退出 —— 不允许「看起来解析成功了其实漏了一半」）。
 *
 * 【只读】不写源码、不改 tsconfig，仅调用 `npx tsc --noEmit --<flag> --incremental false`。
 *
 * 【用法】
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess --top 20
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess --file tests/unit/x.test.ts
 *   node scripts/ts-strict-detail.mjs --flag exactOptionalPropertyTypes --files-only
 *
 * 【参数】
 *   --flag <name>   必填，单个编译开关（如 noUncheckedIndexedAccess）
 *   --top <n>       按文件列前 n 个（默认 15）
 *   --file <path>   只打印该文件的逐条明细（附源码行）
 *   --files-only    只打按文件的计数，不跑明细
 *   --cwd <dir>     在子工程里跑（如 localTool）
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = arg('flag');
if (!flag) {
  console.error(
    '用法：node scripts/ts-strict-detail.mjs --flag <编译开关> [--top N] [--file 路径]',
  );
  process.exit(2);
}
const cwd = resolve(process.cwd(), arg('cwd', '.'));
const top = Number(arg('top', '15'));
const onlyFile = arg('file');
const filesOnly = process.argv.includes('--files-only');

const tsc = spawnSync('npx', ['tsc', '--noEmit', `--${flag}`, '--incremental', 'false'], {
  cwd,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: process.platform === 'win32',
});
const output = `${tsc.stdout || ''}${tsc.stderr || ''}`;

// 形如 `src/a.ts(12,34): error TS2532: Object is possibly 'undefined'.`
const LINE_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const rows = [];
for (const raw of output.split(/\r?\n/)) {
  const m = LINE_RE.exec(raw.trim());
  if (m) rows.push({ file: m[1], line: Number(m[2]), col: Number(m[3]), code: m[4], msg: m[5] });
}

// 解析率自检：tsc 自己报的 "Found N errors" 必须与解析条数一致
const found = /Found (\d+) error/.exec(output);
if (found && Number(found[1]) !== rows.length) {
  console.error(
    `[ts-strict-detail] 解析率异常：tsc 报 ${found[1]} 条，解析出 ${rows.length} 条 —— 拒绝输出（口径不可信）`,
  );
  process.exit(3);
}
if (!rows.length) {
  console.log(
    `✅ --${flag}：0 错${tsc.status === 0 ? '' : `（但 tsc 退出码 ${tsc.status}，检查命令）`}`,
  );
  process.exit(0);
}

const byCode = new Map();
const byFile = new Map();
for (const r of rows) {
  byCode.set(r.code, (byCode.get(r.code) || 0) + 1);
  byFile.set(r.file, (byFile.get(r.file) || 0) + 1);
}

if (onlyFile) {
  const hit = rows.filter((r) => r.file === onlyFile);
  const cache = new Map();
  const srcOf = (file) => {
    if (!cache.has(file)) {
      try {
        cache.set(file, readFileSync(resolve(cwd, file), 'utf8').split(/\r?\n/));
      } catch {
        cache.set(file, []);
      }
    }
    return cache.get(file);
  };
  for (const r of hit) {
    const src = (srcOf(r.file)[r.line - 1] || '').trim();
    console.log(`${r.line}:${r.col}\t${r.code}\t${src}`);
  }
  console.log(`\n${onlyFile}：${hit.length} 处`);
  process.exit(0);
}

console.log(`--${flag} 总计 ${rows.length} 处 / ${byFile.size} 文件`);
console.log(
  '按错误码：' +
    [...byCode.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join('｜'),
);
if (!filesOnly) {
  console.log(`\n按文件（前 ${top}）：`);
  for (const [f, c] of [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    console.log(`${String(c).padStart(4)}  ${f}`);
  }
}
