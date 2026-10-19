#!/usr/bin/env node
/**
 * ts-strict-override.mjs — `noImplicitOverride` 候选 **dry-run 生成器（不写文件）**。
 *
 * 【为什么存在】
 *   打开 `noImplicitOverride` 后，TS 会为「覆盖基类成员但没写 override」报 TS4114。
 *   这些位置看起来机械（加一个关键字），但实测有坑：
 *     · `async render()` 必须写成 `override async render()`；写成 `async override render()` 会 TS1029；
 *     · 带 `public/private/static/readonly` 的成员，`override` 的位置有顺序要求；
 *     · 字段（如 `state` / `cause`）与方法的插法不同，且「删冗余字段」可能改变运行时 `in` 语义。
 *   所以本脚本**只产出候选 diff**，由人审阅后手工应用；它**不提供 --write**。
 *
 * 【硬规则（用户 2026-10-19 裁定）】
 *   机械改写很危险，必须 `--dry`，否则禁止使用该脚本。
 *   本脚本从设计上就是 dry-run：**任何参数都不会写 `src/`**。
 *   若将来增加 `--write`，必须遵守计划 §4.6.5 三道闸（默认 dry-run / ≤20 文件 / journal + tsc 自动回滚）。
 *
 * 【口径】
 *   - 命令：`npx tsc --noEmit --noImplicitOverride`（真实根 tsconfig，零副本）。
 *   - 只处理 TS4114；解析率必须 100%（含 error TS 的行数 == 成功解析条数），否则 exit 2。
 *   - 插入点 = TS 报的列（声明起始，含修饰符）之前；前缀必须是纯空白。
 *   - 遇到 `static/public/private/protected/readonly/declare/abstract` 开头 → **跳过并列为人工**，
 *     不在本脚本里猜修饰符顺序。
 *
 * 【用法】
 *   node scripts/ts-strict-override.mjs                 # 打印全部候选 diff
 *   node scripts/ts-strict-override.mjs --file commands # 只看路径含该片段的候选
 *   node scripts/ts-strict-override.mjs --json logs/override-candidates.json
 *
 * 【退出码】
 *   0 = 无候选；1 = 有候选（正常，dry-run 有活要干）；2 = 脚本自身失效（解析率/环境异常）。
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values } = parseArgs({
  options: {
    file: { type: 'string', multiple: true },
    json: { type: 'string' },
  },
  allowPositionals: false,
});

const fileFilters = (values.file ?? []).map((s) => s.toLowerCase());

const res = spawnSync('npx', ['tsc', '--noEmit', '--noImplicitOverride'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true, // Windows 下 npx.cmd 必须走 shell（前辈踩坑 #1）
  maxBuffer: 64 * 1024 * 1024,
});

const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  .replace(/\x1b\[[0-9;]*m/g, '')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n');

const ERR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):\s*(.*)$/;
const lines = out.split('\n');
let errLineCount = 0;
const ts4114 = [];
const otherCodes = new Map();

for (const line of lines) {
  if (!line.includes('error TS')) continue;
  errLineCount++;
  const m = line.match(ERR_RE);
  if (!m) {
    console.error(`❌ 解析率异常：无法解析行 → ${line.trim().slice(0, 160)}`);
    process.exit(2);
  }
  const code = m[4];
  if (code !== 'TS4114') {
    otherCodes.set(code, (otherCodes.get(code) ?? 0) + 1);
    continue;
  }
  ts4114.push({
    file: m[1].trim().replace(/\\/g, '/'),
    line: Number(m[2]),
    col: Number(m[3]),
    msg: m[5].trim(),
  });
}

if (errLineCount !== ts4114.length + [...otherCodes.values()].reduce((a, b) => a + b, 0)) {
  console.error('❌ 解析率异常：解析条数与 error 行数不一致（拒绝输出，防假绿）。');
  process.exit(2);
}
if (errLineCount === 0 && res.status !== 0) {
  console.error(`❌ tsc exit=${res.status} 但没有错误行（环境/配置问题，不是「无候选」）。`);
  process.exit(2);
}

/** 每个文件只读一次；按行号升序处理，diff 稳定。 */
const byFile = new Map();
for (const e of ts4114) {
  if (fileFilters.length && !fileFilters.some((f) => e.file.toLowerCase().includes(f))) continue;
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e);
}

const candidates = [];
const skipped = [];
const stats = { method: 0, field: 0, async: 0, accessor: 0, already: 0 };

for (const [file, errs] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const srcLines = src.split(/\r?\n/);

  for (const e of errs.sort((a, b) => a.line - b.line)) {
    let idx = e.col - 1;
    const original = srcLines[e.line - 1];
    if (original === undefined) {
      skipped.push({ ...e, reason: '行号越界（文件可能已变）' });
      continue;
    }
    if (idx < 0 || idx >= original.length) {
      skipped.push({ ...e, reason: '列号越界' });
      continue;
    }
    // TS 对 `async render()` 报的是**名字**列（async 之后）；插入点要前移到 async 之前，
    // 否则会生成 `async override render()` → TS1029。只接受「纯缩进 + async + 空白」这一种前缀。
    if (original.slice(0, idx).trim() !== '') {
      const am = original.slice(0, idx).match(/^(\s*)async\s+$/);
      if (!am) {
        skipped.push({ ...e, reason: `列前不是纯缩进：${JSON.stringify(original.slice(0, idx))}` });
        continue;
      }
      idx = am[1].length;
    }
    const prefix = original.slice(0, idx);
    const rest = original.slice(idx);
    if (/^override\b/.test(rest)) {
      stats.already++;
      continue;
    }
    if (/^(static|public|private|protected|readonly|declare|abstract)\b/.test(rest)) {
      skipped.push({ ...e, reason: `带修饰符（需人工定顺序）：${rest.slice(0, 40)}` });
      continue;
    }

    if (/^async\b/.test(rest)) stats.async++;
    else if (/^(get|set)\b/.test(rest)) stats.accessor++;
    else if (/^[A-Za-z_$][\w$]*\s*\(/.test(rest)) stats.method++;
    else stats.field++;

    const next = `${prefix}override ${rest}`;
    candidates.push({ ...e, before: original, after: next, kind: /^async\b/.test(rest) ? 'async' : 'plain' });
  }
}

// ── 输出 unified diff（每个错误一行 hunk；dry-run，不写盘）──────────────────
if (candidates.length) {
  let cur = '';
  for (const c of candidates) {
    if (c.file !== cur) {
      cur = c.file;
      console.log(`\n--- a/${c.file}`);
      console.log(`+++ b/${c.file}`);
    }
    console.log(`@@ -${c.line},1 +${c.line},1 @@`);
    console.log(`-${c.before}`);
    console.log(`+${c.after}`);
  }
}

console.log('\n══════ noImplicitOverride 候选（dry-run，未写任何文件）══════');
console.log(`TS4114 总数 : ${ts4114.length}`);
console.log(`候选        : ${candidates.length}（方法 ${stats.method} / async ${stats.async} / 访问器 ${stats.accessor} / 字段 ${stats.field}）`);
console.log(`已是 override: ${stats.already}`);
console.log(`人工处理    : ${skipped.length}`);
for (const s of skipped) {
  console.log(`  - ${s.file}(${s.line},${s.col}) ${s.reason}`);
}
if (otherCodes.size) {
  console.log(`其他错误码  : ${[...otherCodes.entries()].map(([k, v]) => `${k}×${v}`).join('  ')}`);
}
if (candidates.length === 0) console.log('✔ 无候选（该开关已满足或全部需人工）。');

if (values.json) {
  const outPath = resolve(ROOT, values.json);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        flag: 'noImplicitOverride',
        total: ts4114.length,
        candidates,
        skipped,
        stats,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\n✔ 候选已落 ${relative(ROOT, outPath)}（仍未写源码）`);
}

process.exit(candidates.length ? 1 : 0);
