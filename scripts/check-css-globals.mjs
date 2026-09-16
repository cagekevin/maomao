#!/usr/bin/env node
/**
 * 整站 CSS 裸值闸（css-globals）—— 颜色 / 圆角 / 边框色，ratchet 基线「只降不升」
 *
 * 【为什么存在】整站四维度治理（`mockup/MOCKUP-REFACTOR-PLAN.md` §2–§3）：颜色 / 圆角 /
 *   边框色 / 图标必须「令牌唯一、闸守不回潮」。本仓四度实证：凡收口无闸必回潮
 *   → 故本闸先于一切「提令牌 / 平整」动作落地，并用 **per-file ratchet 基线** 防「全红逼人绕过」。
 *
 * 【判据（唯一真源 = 本段；改口径改这里，禁止口头约定）】
 *   · 扫描面：`src/**` 与 `mockup/**` 下的 `.css` + `.html`
 *     —— HTML 同时覆盖 `<style>` 块与内联 `style="…"` 属性（实测 mockup HTML 内联带色 37 处，
 *     只抽 `<style>` 会整片漏掉）。
 *   · 颜色：**前缀式**属性白名单（`color` / `background*` / `border*` / `outline*` /
 *     `caret-color` / `fill` / `stroke` / `text-shadow`），值命中 `#hex`(3/4/6/8) 或 `rgb(a)/hsl(a)`。
 *     必须用前缀：实测单边边框裸色 22 处（assistant-table 10 / agent-panel 4 / director3d 3 /
 *     ve-theme 2 / panel-kit 2 / creative-library 1），只写 `border`/`border-color` 会漏光。
 *   · 圆角：`border-radius` 值为裸 `px/rem/em/%`（非 `var(--mao-radius-*)`）。`50%` / `9999px` v1 暂许（记债）。
 *   · 计数口径：**剥离注释后的声明条数**（非行数、非正则命中数）。裸 grep 得 157 / 196，
 *     与本闸 155 / 187 的差即来自注释与令牌定义行。
 *   · 派生色豁免：`rgb(var(--mao-x) / 0.3)` 括号内首段是 `var(` → 合法（kit 里大量使用）。
 *   · `url(#id)` 是 SVG 片段引用、不是颜色 → 先摘除再判色。
 *   · 令牌定义行豁免：`--mao-*` / `--pk-*` / `--ve-*` / `--mock:*`（令牌来源本身）。
 *   · 文件白名单：`*.min.css`、`*.regression-entry.css`、`**\/vendor/**`、`**\/node_modules/**`。
 *
 * 【ratchet 算法】基线 `scripts/css-globals-baseline.json = { "<relpath>": <int 违规数> }`
 *   · 新文件（不在基线）含裸值 → FAIL 并列行号；
 *   · 在册文件 cur > base → FAIL（打印 +N 与相关行号）；
 *   · 全部 cur ≤ base → PASS。平整每落一波 → `--baseline` 重生成收紧（存量只降不升）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸**（四维度「令牌唯一」）—— 依据 `mockup/MOCKUP-REFACTOR-PLAN.md` §2–§3。
 *   Q2 何时该改：① 它拦住了「让同一语义份数下降」的动作时 → 该改（例：把 mockup 的合法演示值
 *               也逼成令牌、或把 cutia 的 `--ve-*` 独立色系判成违规）；
 *               ② 属性白名单 / 派生色豁免口径需调整时（同处常量，改完全仓口径一致）；
 *               ③ 出现新的合法「裸值语境」（新 vendor 文件、新构建产物）→ 只**收窄**白名单。
 *   Q3 怎么改：优先改**真源**（`src/index.css` `:root` 补 token → 重生成基线），
 *               白名单只收窄不收宽；改完跑 `--self-test` 先红后绿，再跑 `node scripts/probe.mjs`。
 *
 * 用法：
 *   node scripts/check-css-globals.mjs              # 检查（CI / pre-push）
 *   node scripts/check-css-globals.mjs --baseline   # 生成 / 刷新基线
 *   node scripts/check-css-globals.mjs --self-test  # 判定规则自测（正例必红 + 反例必绿）
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'css-globals-baseline.json');

const args = process.argv.slice(2);
const GEN = args.includes('--baseline');
const SELF_TEST = args.includes('--self-test');

// ── 扫描面 ────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['src', 'mockup'];
const EXTS = new Set(['.css', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'test-results']);
const FILE_WHITELIST = [
  /\.min\.css$/i,
  /\.regression-entry\.css$/i,
  /(^|[\\/])vendor[\\/]/i,
  /(^|[\\/])node_modules[\\/]/i,
];

// ── 判定规则 ──────────────────────────────────────────────────────────────
const TOKEN_DEF = /^(--(?:mao|pk|ve)-|--mock)/;
const COLOR_PROP =
  /^(color|background(?:-[\w-]+)?|border(?:-[\w-]+)?|outline(?:-[\w-]+)?|caret-color|fill|stroke|text-shadow)$/;
const RADIUS_PROP = /^(?:-[a-z]+-)?border-radius$/;
const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RADIUS_LITERAL = /(?:^|[\s,/])[0-9.]+(?:px|rem|em|%)/;

/** 剥注释（保留换行与偏移，行号才准） */
function stripComments(text, isHtml) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (isHtml) out = out.replace(/<!--[\s\S]*?-->/g, blank);
  return out;
}

/** `url(#grad)` 是片段引用、不是颜色 */
const stripUrls = (v) => v.replace(/url\([^)]*\)/g, 'url()');

/** 找裸颜色函数；括号内首段是 `var(` 则视为合法派生色（返回 null） */
function findBareColorFn(value) {
  const re = /(rgba?|hsla?)\(/g;
  let m;
  while ((m = re.exec(value))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    for (; i < value.length && depth > 0; i++) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
    }
    const inner = value.slice(start, Math.max(start, i - 1)).trim();
    if (!inner.startsWith('var(')) return `${m[1]}(${inner})`;
  }
  return null;
}

function lineOf(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') n++;
  return n;
}

/** 收集一个文件的裸值违规（去注释后的声明条数 = 口径） */
function collect(raw, relPath) {
  const text = stripComments(raw, relPath.endsWith('.html'));
  const hits = [];
  const re = /([-a-zA-Z][-a-zA-Z0-9]*)\s*:\s*([^;{}]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const prop = m[1].toLowerCase();
    if (TOKEN_DEF.test(prop)) continue; // 令牌定义行 = 合法来源
    const value = m[2];
    // ⚠️ 顺序不可换：`border-radius` 会被 COLOR_PROP 的 `border(-[\w-]+)?` 命中，
    //    先判半径再判颜色（曾因此恒判 0 处圆角 —— 自测用例即为此留的探针）。
    if (RADIUS_PROP.test(prop)) {
      const v = value.trim();
      if (/^var\(\s*--mao-radius-/.test(v)) continue;
      const lit = v.match(RADIUS_LITERAL);
      if (lit) {
        hits.push({
          line: lineOf(text, m.index),
          prop,
          raw: `${prop}: ${v}`,
          why: lit[0].trim(),
        });
      }
    } else if (COLOR_PROP.test(prop)) {
      const v = stripUrls(value);
      const hex = v.match(HEX);
      const fn = hex ? null : findBareColorFn(v);
      if (hex || fn) {
        hits.push({
          line: lineOf(text, m.index),
          prop,
          raw: `${prop}: ${value.trim().replace(/\s+/g, ' ')}`,
          why: hex ? hex[0] : fn,
        });
      }
    }
  }
  return hits;
}

// ── 文件收集 ──────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase())) out.push(abs);
  }
  return out;
}

function scan() {
  const results = new Map(); // relpath -> hits[]
  for (const d of SCAN_DIRS) {
    for (const abs of walk(join(ROOT, d))) {
      const rel = relative(ROOT, abs).replace(/\\/g, '/');
      if (FILE_WHITELIST.some((r) => r.test(rel))) continue;
      const hits = collect(readFileSync(abs, 'utf8'), rel);
      if (hits.length) results.set(rel, hits);
    }
  }
  return results;
}

// ── 自测（判定规则先红后绿） ──────────────────────────────────────────────
if (SELF_TEST) {
  const cases = [
    ['a{color:#fff}', 1, '裸 hex'],
    ['a{color:#aabbccdd}', 1, '8 位 hex'],
    ['a{background:rgba(0,0,0,.5)}', 1, 'rgba'],
    ['a{border-top:1px solid #333}', 1, '单边边框（枚举白名单会漏）'],
    ['a{outline:1px solid hsl(0 0% 50%)}', 1, 'outline + hsl'],
    ['a{border-radius:8px}', 1, '裸圆角'],
    ['a{border-radius:4px 8px}', 1, '多值裸圆角'],
    ['a{color:rgb(var(--mao-accent) / .3)}', 0, '派生色豁免'],
    ['a{border-radius:var(--mao-radius-lg)}', 0, '令牌圆角豁免'],
    ['a{fill:url(#grad)}', 0, 'SVG 片段引用'],
    ['/* a{color:#fff} */ b{color:var(--x)}', 0, '注释剥离（防假回潮）'],
    ['--mao-x:59 130 246; --pk-on:#34d399; --ve-bg:18 18 18;', 0, '令牌定义行豁免'],
    ['a{color:currentColor;background:transparent}', 0, '关键字'],
    ['.a{border-radius:50%}', 1, '50% 暂许 → v1 记债（此处按违规计，本金债见 §5）'],
  ];
  let bad = 0;
  console.log('🧪 css-globals 判定规则自测');
  for (const [src, want, name] of cases) {
    const got = collect(src, 'x.css').length;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`   ${ok ? '✅' : '❌'} ${name}：期望 ${want} 实得 ${got}  ← ${src}`);
  }
  process.exit(bad ? 1 : 0);
}

// ── 主流程 ────────────────────────────────────────────────────────────────
const results = scan();
const total = [...results.values()].reduce((n, h) => n + h.length, 0);

if (GEN) {
  const obj = {};
  for (const rel of [...results.keys()].sort()) obj[rel] = results.get(rel).length;
  writeFileSync(BASELINE_PATH, `${JSON.stringify(obj, null, 2)}\n`);
  console.log(`📌 css-globals 基线已生成：${relative(ROOT, BASELINE_PATH).replace(/\\/g, '/')}`);
  console.log(`   ${Object.keys(obj).length} 个文件 / ${total} 处裸值（= 下一轮「只降不升」的起点）`);
  process.exit(0);
}

console.log('🔒 整站 CSS 裸值闸（颜色 / 圆角 / 边框色 · ratchet 基线）');

if (!existsSync(BASELINE_PATH)) {
  console.error(
    `\n❌ 基线不存在：${relative(ROOT, BASELINE_PATH).replace(/\\/g, '/')}\n` +
      '   门禁未就位 = 无闸必回潮。先在「平整前」跑一次：node scripts/check-css-globals.mjs --baseline',
  );
  process.exit(1);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (e) {
  console.error(`❌ 基线解析失败：${e.message}`);
  process.exit(1);
}

const fails = [];
let curSum = 0;
let baseSum = 0;
for (const [rel, hits] of results) {
  curSum += hits.length;
  const base = baseline[rel];
  if (base === undefined) fails.push({ rel, hits, kind: 'new' });
  else if (hits.length > base) fails.push({ rel, hits, kind: 'ratchet', delta: hits.length - base });
}
for (const [rel, n] of Object.entries(baseline)) baseSum += n;

const stale = Object.keys(baseline).filter((rel) => !results.has(rel));

if (fails.length) {
  console.error(`\n❌ css-globals 未通过：${fails.length} 个文件违规（当前 ${curSum} / 基线 ${baseSum}）\n`);
  for (const f of fails) {
    const label =
      f.kind === 'new'
        ? `新文件含裸值 ${f.hits.length} 处（基线里没有它）`
        : `回潮 +${f.delta}（基线 ${baseline[f.rel]} → 当前 ${f.hits.length}）`;
    console.error(`   ✗ ${f.rel} —— ${label}`);
    for (const h of f.hits.slice(0, 12)) {
      console.error(`       L${h.line}  ${h.raw}   ⟵ ${h.why}`);
    }
    if (f.hits.length > 12) console.error(`       … 另有 ${f.hits.length - 12} 处（详见 --json / 直接搜该文件）`);
  }
  console.error(
    '\n修法（优先级从高到低）：\n' +
      '   ① 真源补 token → `src/index.css` `:root` 加 `--mao-*`，再把裸值换成 `var(...)`；\n' +
      '   ② 确认该处是合法裸值语境（新 vendor / 构建产物）→ 只**收窄**文件白名单（§申诉口 Q3）；\n' +
      '   ③ 确属存量且本轮不清 → 禁止直接抬基线；先平整再 `--baseline` 重生成（存量只降不升）。',
  );
  process.exit(1);
}

console.log(`   ✅ 全部 ${results.size} 个文件 ≤ 基线（当前 ${curSum} / 基线 ${baseSum}）`);
if (stale.length) {
  console.log(`   ℹ️ 基线里有 ${stale.length} 个文件已不在扫描面（多为 Step1 删除的旧 mockup）→ 可 --baseline 收紧：`);
  for (const s of stale.slice(0, 5)) console.log(`      - ${s}`);
  if (stale.length > 5) console.log(`      … 另 ${stale.length - 5} 个`);
}
if (curSum < baseSum) {
  console.log(`   📉 已低于基线 ${baseSum - curSum} 处 → 建议跑 --baseline 收紧（让回潮空间同步收窄）`);
}
