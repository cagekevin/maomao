#!/usr/bin/env node
/**
 * ts-strict-detail.mjs — 「最严格开关」只读明细/聚类/净减工具。
 *
 * 【为什么存在】
 *   本轮要把 `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` /
 *   `noPropertyAccessFromIndexSignature` 等开关逐项打开。每批开工前都要回答三个问题：
 *     ① 目标开关当前有多少错、分布在哪些文件？
 *     ② 这些错是「很多独立问题」还是「同一个根因簇」（同一属性名/变量名/类型）？
 *     ③ 这批改完到底净减了多少（可复算，不靠手抄）？
 *   手工 `npx tsc | Select-String | Group-Object` 有三个硬伤：口径随手变、无法自检、无法对比。
 *   本脚本把口径钉死：**真实根 tsconfig + CLI 追加开关**，不复制副本、不写源码。
 *
 * 【与既有脚本的区别（勿混）】
 *   - `ts-detail.mjs`：面向旧 `tests/unit` 的 `@ts-nocheck` 时代（复制到 tmp + `strict:false` 玩具配置）。
 *     本期根配置已 strict，且不能用放宽配置，故不复用它，只复用其「解析 + 解析率自检」思路。
 *   - `m1-scan.mjs`：复制副本有 GBK 假阳性（前辈踩坑 #17），禁用。
 *   - 本脚本：**零副本、零写入源码**，只跑 tsc + 读输出。
 *
 * 【口径（唯一真源 = 本文件）】
 *   - 命令：`npx tsc --noEmit` + `--<flag>`（布尔开关；`name=value` 形式追加值，如 `allowUnreachableCode=false`）。
 *   - 解析：`file(line,col): error TSxxxx: msg`；CRLF 统一为 LF；ANSI 色码剥离。
 *   - 自检：含 `error TS` 的行数必须等于成功解析条数；不等 → exit 2（防「正则失配却报 0 错」）。
 *   - 聚类：TS4111 按属性名；TS18048 按变量名；TS2532/TS2722 按形态；其余按错误码。
 *
 * 【边界】
 *   - 只读：不写 `src/` / `tests/` / `localTool/`；`--json` 只写指定快照文件。
 *   - 不是闸：不挂 CI，不产生 pass/fail 业务语义。
 *   - 不替人判断：它只给「哪里、什么码、哪个簇」，A/B 分类与缺值策略仍由人决定（计划 §4.5.3）。
 *
 * 【退出码（与 tsc 对齐，别误判为脚本坏了）】
 *   0 = 0 错；1 = 有类型错误（正常输出，不是脚本失败）；2 = 脚本自身失效（解析率异常/环境异常）。
 *
 * 【用法】
 *   node scripts/ts-strict-detail.mjs                          # 基线（应为 0）
 *   node scripts/ts-strict-detail.mjs --flag noImplicitOverride
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess --top 15
 *   node scripts/ts-strict-detail.mjs --flag exactOptionalPropertyTypes --file canvasPlanExecutor
 *   node scripts/ts-strict-detail.mjs --flag noPropertyAccessFromIndexSignature --cluster
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess --json logs/nua.json
 *   node scripts/ts-strict-detail.mjs --flag noUncheckedIndexedAccess --diff logs/nua-before.json
 *   node scripts/ts-strict-detail.mjs --flag allowUnreachableCode=false --flag allowUnusedLabels=false
 *   node scripts/ts-strict-detail.mjs --raw --file assistantTable   # 逐条原始行
 *
 * 【参数】
 *   --flag <name[=value]>  追加 tsc 开关，可重复
 *   --file <片段>          只看路径含该片段的错误，可重复（子串、不分大小写）
 *   --code <TSxxxx>        只看指定错误码，可重复
 *   --top <n>              列表条数（默认 20）
 *   --cluster              额外打印根因簇 Top（默认也打印摘要，此开关打印全量簇）
 *   --raw                  打印匹配的逐条错误
 *   --json <path>          落快照（相对 cwd；目录不存在会创建）
 *   --diff <path>          与快照对比，打印总数/按文件净减
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const { values } = parseArgs({
  options: {
    flag: { type: 'string', multiple: true },
    file: { type: 'string', multiple: true },
    code: { type: 'string', multiple: true },
    top: { type: 'string' },
    cluster: { type: 'boolean' },
    raw: { type: 'boolean' },
    json: { type: 'string' },
    diff: { type: 'string' },
  },
  allowPositionals: false,
});

const flags = values.flag ?? [];
const fileFilters = (values.file ?? []).map((s) => s.toLowerCase());
const codeFilters = (values.code ?? []).map((s) => s.toUpperCase());
const topN = Math.max(1, Number(values.top ?? 20) || 20);

/** `name` / `name=value` → tsc argv（布尔值必须作为独立 argv，不能拼成 `--x=false`）。 */
function flagArgs() {
  const out = [];
  for (const raw of flags) {
    const [name, ...rest] = raw.split('=');
    out.push(`--${name}`);
    if (rest.length) out.push(rest.join('='));
  }
  return out;
}

const argv = ['tsc', '--noEmit', ...flagArgs()];
const res = spawnSync('npx', argv, {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true, // Windows 下 npx.cmd 必须走 shell（前辈踩坑 #1）
  maxBuffer: 64 * 1024 * 1024,
});

const rawOut = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
  .replace(/\x1b\[[0-9;]*m/g, '') // ANSI
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n');

// ── 解析 + 自检 ──────────────────────────────────────────────────────────────
const ERR_RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+):\s*(.*)$/;
const lines = rawOut.split('\n');
let errLineCount = 0;
const errors = [];
const unresolved = [];

for (const line of lines) {
  if (!line.includes('error TS')) continue;
  errLineCount++;
  const m = line.match(ERR_RE);
  if (!m) {
    unresolved.push(line.trim());
    continue;
  }
  errors.push({
    file: m[1].trim().replace(/\\/g, '/'),
    line: Number(m[2]),
    col: Number(m[3]),
    code: m[4],
    msg: m[5].trim(),
  });
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(2);
}

if (errLineCount !== errors.length) {
  fail(
    `解析率异常：含 error TS 的行 ${errLineCount}，成功解析 ${errors.length}。` +
      `\n   未解析样例：\n${unresolved
        .slice(0, 5)
        .map((l) => '   ' + l.slice(0, 160))
        .join('\n')}`,
  );
}
if (errLineCount === 0 && res.status !== 0) {
  fail(
    `tsc exit=${res.status} 但没有错误行（环境/配置问题，不是「0 错」）。输出尾部：\n` +
      lines
        .filter(Boolean)
        .slice(-8)
        .map((l) => '   ' + l.slice(0, 160))
        .join('\n'),
  );
}

// ── 聚类口径 ─────────────────────────────────────────────────────────────────
function clusterOf(e) {
  if (e.code === 'TS4111') {
    const m = e.msg.match(/Property '([^']+)' comes from an index signature/);
    return m ? `prop:${m[1]}` : 'prop:<unknown>';
  }
  if (e.code === 'TS18048') {
    const m = e.msg.match(/'([^']+)' is possibly 'undefined'/);
    return m ? `var:${m[1]}` : 'var:<unknown>';
  }
  if (e.code === 'TS2532') return 'obj:possibly-undefined';
  if (e.code === 'TS2722') return 'call:possibly-undefined';
  if (e.code === 'TS2538') return 'index:undefined';
  // exactOptionalPropertyTypes 三码：按**目标类型**聚类（比按错误码更有杠杆）。
  // 例：`PlanEntry` / `Partial<ArrangeOptions>` / r3f 的 MeshStandardMaterial props。
  if (e.code === 'TS2375' || e.code === 'TS2379' || e.code === 'TS2412') {
    const m = e.msg.match(/not assignable to (?:parameter of )?type '([^']+)'/);
    if (m) return `type:${m[1].slice(0, 80)}`;
  }
  return `code:${e.code}`;
}

const countBy = (arr, keyOf) => {
  const map = new Map();
  for (const item of arr) {
    const k = keyOf(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};

const byCode = countBy(errors, (e) => e.code);
const byFile = countBy(errors, (e) => e.file);
const byCluster = countBy(errors, clusterOf);

// ── 过滤 ─────────────────────────────────────────────────────────────────────
const matched = errors.filter((e) => {
  if (fileFilters.length && !fileFilters.some((f) => e.file.toLowerCase().includes(f)))
    return false;
  if (codeFilters.length && !codeFilters.includes(e.code.toUpperCase())) return false;
  return true;
});

// ── 打印 ─────────────────────────────────────────────────────────────────────
const flagText = flags.length
  ? flags.map((f) => `--${f.replace('=', ' ')}`).join(' ') // 与真实 argv 一致（布尔值单独成参）
  : '(无额外开关)';
console.log('══════ 类型最严格 · 只读明细 ══════');
console.log(`口径    : npx tsc --noEmit ${flagText}`);
console.log(`退出码  : ${res.status}`);
console.log(`总错误  : ${errors.length}｜涉及文件: ${byFile.length}`);
console.log(`自检    : ✅ ${errors.length}/${errLineCount} 行成功解析`);
if (fileFilters.length || codeFilters.length) {
  console.log(
    `过滤    : ${fileFilters.length ? `file~[${fileFilters.join(', ')}] ` : ''}${
      codeFilters.length ? `code=[${codeFilters.join(', ')}]` : ''
    } → 命中 ${matched.length} 条`,
  );
}

if (errors.length === 0) {
  console.log('\n✔ 0 类型错误。');
} else {
  console.log('\n── 错误码 ──');
  for (const [code, n] of byCode) console.log(`  ${code.padEnd(8)} ${String(n).padStart(5)}`);

  console.log(`\n── 文件 Top ${topN} ──`);
  for (const [file, n] of byFile.slice(0, topN)) console.log(`  ${String(n).padStart(5)}  ${file}`);
  if (byFile.length > topN) console.log(`  ... 余下 ${byFile.length - topN} 个文件`);

  const clusterLimit = values.cluster ? byCluster.length : Math.min(topN, byCluster.length);
  console.log(`\n── 根因簇 Top ${clusterLimit} ──`);
  for (const [key, n] of byCluster.slice(0, clusterLimit))
    console.log(`  ${String(n).padStart(5)}  ${key}`);
}

if (values.raw && matched.length) {
  console.log(`\n── 逐条（${matched.length}）──`);
  for (const e of matched) {
    console.log(`  ${e.file}(${e.line},${e.col}) ${e.code} ${e.msg.slice(0, 200)}`);
  }
}

// ── 快照 / 对比 ──────────────────────────────────────────────────────────────
if (values.json) {
  const out = resolve(ROOT, values.json);
  mkdirSync(dirname(out), { recursive: true });
  const snapshot = {
    generatedAt: new Date().toISOString(),
    flags,
    total: errors.length,
    files: byFile.length,
    byCode: Object.fromEntries(byCode),
    byFile: Object.fromEntries(byFile),
    byCluster: Object.fromEntries(byCluster),
  };
  writeFileSync(out, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`\n✔ 快照已落 ${relative(ROOT, out)}`);
}

if (values.diff) {
  const basePath = resolve(ROOT, values.diff);
  if (!existsSync(basePath)) fail(`--diff 基线不存在：${values.diff}`);
  const base = JSON.parse(readFileSync(basePath, 'utf8'));
  if (JSON.stringify(base.flags ?? []) !== JSON.stringify(flags)) {
    console.log(
      `\n⚠ 基线开关 ${JSON.stringify(base.flags ?? [])} ≠ 本次 ${JSON.stringify(flags)}；对比仅作参考。`,
    );
  }
  const delta = (a, b) => {
    const d = b - a;
    return d === 0 ? '±0' : d > 0 ? `+${d} ↑` : `${d} ↓`;
  };
  console.log(`\n── 净减对照（基线 ${base.generatedAt ?? '?'}）──`);
  console.log(
    `  总数  ${String(base.total ?? 0).padStart(5)} → ${String(errors.length).padStart(5)}  ${delta(base.total ?? 0, errors.length)}`,
  );
  const baseFiles = base.byFile ?? {};
  const nowFiles = Object.fromEntries(byFile);
  const all = new Set([...Object.keys(baseFiles), ...Object.keys(nowFiles)]);
  const moved = [...all]
    .map((f) => ({ f, a: baseFiles[f] ?? 0, b: nowFiles[f] ?? 0 }))
    .filter((x) => x.a !== x.b)
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  if (!moved.length) {
    console.log('  文件级：无变化。');
  } else {
    console.log(`  文件级变化（${moved.length}，Top ${topN}）：`);
    for (const x of moved.slice(0, topN)) console.log(`    ${x.a} → ${x.b}  ${x.f}`);
  }
}

process.exit(errors.length === 0 ? 0 : 1);
