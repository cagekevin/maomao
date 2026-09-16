#!/usr/bin/env node
/**
 * 令牌副本一致性闸（token-mirror）—— 「唯一真相源 + 镜像零漂移」
 *
 * 【为什么存在】`src/index.css` 的 `:root` 是**唯一真相源**，但 mockup 侧的
 *   `mockup/maomao-kit.css` 是**手工副本**（它 `@import` 了 5 个 src CSS，却把
 *   `panel-kit.css` 整段抄进自己的身体里）。手工副本 = 漂移母体，且已经漂了一次：
 *     `--mao-accent-soft` / `--mao-accent-soft-alpha` 在 `src/index.css:92-93` 有、kit 里没有。
 *   本仓铁律「凡收口无闸必回潮」⇒ 副本模式必须配一道**零容忍对账闸**，否则
 *   Step3 的数百处「改 src + 同步回 kit」就会长出第二份真相。
 *
 * 【与 css-globals 的分工】本闸不管「裸值」（那是 `check-css-globals.mjs`），只管
 *   **同一语义的值在多份副本间是否一致**。故它**没有基线**：不一致就是不一致（硬红）。
 *
 * 【判据（唯一真源 = 本段）】
 *   A. 同名键 · src 真源 ↔ kit 副本：值必须全等（`src/index.css` :root ↔ `mockup/maomao-kit.css` :root）。
 *   B. 同名键 · panel-kit 真源 ↔ kit 手工副本段：值必须全等。
 *   C. 引用解析：凡 `<link>`/`@import` 了 `maomao-kit.css` 的 mockup 文件（`.css`/`.html`），
 *      其中 `var(--mao-*)` / `var(--pk-*)` 必须能在【kit ∪ src 真源 ∪ panel-kit】里解析到
 *      （空引用 ⇒ 颜色静默失效，浏览器回落 = 最隐蔽的一类回归）。
 *   D. `@import` 存在性：`mockup/**` 下 `.css` 的每个 `@import '相对路径'` 必须指向真实文件
 *      （src 重构挪文件时，mockup 不许静默断链 —— MOCKUP-REFACTOR-PLAN §Step5 ①）。
 *   E. 两份 tailwind 配置（`tailwind.config.ts` / `mockup/tailwind.mockup.config.js`）里的
 *      `var(--mao-*)` 必须解析到 src 真源（配置里写错键名 = 全站静默失效）。
 *   ⚠️ 只报**不一致**，不逼「全量镜像」：src 有而 kit 无的键 -> WARN（可见但不强制复制，
 *      避免「为过闸而复制」把副本份数推高）。需要「用到必须有」时由判据 C 兜住。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸**（唯一真相源 + 副本零漂移）—— 依据 `MOCKUP-REFACTOR-PLAN.md` §2 / §5。
 *   Q2 何时该改：① 它拦住了「让同一语义份数下降」的动作时 → 该改 —— 特别注意：
 *                本闸的**正确终局**是「kit 由脚本从 src 生成」，那时 A/B 两条变成「生成物与源一致」，
 *                判据需同步改写；② 新增第二个镜像消费方（新 config / 新 mockup 入口）时补判据；
 *                ③ src 侧合法拆分真源（如 token 移到独立文件）时改 `TRUTH` 常量。
 *   Q3 怎么改：真相源永远是 `src/index.css` `:root`（新键只加在那里）；镜像侧改动靠
 *               同步（长期靠生成脚本），**禁止**为了让本闸变绿而在 kit 里手改出第二套值；
 *               改完跑 `--self-test` 与 `node scripts/probe.mjs`（先红后绿）。
 *
 * 用法：
 *   node scripts/check-token-mirror.mjs             # 检查
 *   node scripts/check-token-mirror.mjs --self-test # 判据自测（正例红 + 反例绿）
 *   node scripts/check-token-mirror.mjs --warn      # 顺带打印 WARN 级清单（缺键）
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SELF_TEST = args.includes('--self-test');
const SHOW_WARN = args.includes('--warn');

/** 真源与副本（改这里 = 改全仓口径；新镜像消费方加进来即可） */
const TRUTH = {
  src: 'src/index.css',
  panelKit: 'src/components/base/panels/panel-kit.css',
};
const MIRROR = ['mockup/maomao-kit.css'];
const TAILWIND_CONFIGS = ['tailwind.config.ts', 'mockup/tailwind.mockup.config.js'];
const MOCKUP_ROOT = 'mockup';

// ── 解析 ──────────────────────────────────────────────────────────────────
/** 抽出所有 `:root { … }` 块里的自定义属性（多块合并；后定义覆盖前定义） */
function parseRootTokens(css) {
  const out = new Map();
  const blocks = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/:root\s*\{([^}]*)\}/g);
  for (const b of blocks) {
    for (const d of b[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      out.set(d[1], d[2].trim().replace(/\s+/g, ' '));
    }
  }
  return out;
}

function readIfExists(rel) {
  const abs = join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
}

// ── 自测 ──────────────────────────────────────────────────────────────────
if (SELF_TEST) {
  const cases = [
    [':root{\n  --mao-a: 1 2 3;\n  --pk-b: 8px;\n}', 2, '解析 :root 键值'],
    [':root{--mao-a:1 2 3}\n:root{--mao-a:4 5 6}', 1, '多 :root 块合并（后者覆盖）'],
    ['/* :root{--mao-x:1} */', 0, '注释剔除'],
    ['.ve-scope{--ve-bg:18 18 18}', 0, '非 :root 不取（明暗主题局部变量）'],
  ];
  let bad = 0;
  console.log('🧪 token-mirror 判据自测');
  for (const [src, want, name] of cases) {
    const got = parseRootTokens(src).size;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`   ${ok ? '✅' : '❌'} ${name}：期望 ${want} 实得 ${got}`);
  }
  process.exit(bad ? 1 : 0);
}

// ── 判据 A/B：同名键值全等 ────────────────────────────────────────────────
const truthSrc = parseRootTokens(readIfExists(TRUTH.src) ?? '');
const truthPk = parseRootTokens(readIfExists(TRUTH.panelKit) ?? '');
const mirrorText = MIRROR.map((m) => ({ rel: m, text: readIfExists(m) })).filter((m) => m.text !== null);

const violations = [];
const warns = [];

if (truthSrc.size === 0 || truthPk.size === 0) {
  // fail-loud：解析到 0 个键 = 真源路径失效，绝不「静默 0 违规」
  console.error(`❌ 真源解析为空（${TRUTH.src} / ${TRUTH.panelKit}）—— 路径失效或格式变了，拒绝静默通过`);
  process.exit(1);
}

for (const { rel, text } of mirrorText) {
  const mirror = parseRootTokens(text);
  for (const [name, truthValue] of [...truthSrc, ...truthPk]) {
    if (!mirror.has(name)) continue;
    const got = mirror.get(name);
    if (got !== truthValue) {
      violations.push(`${rel} 的 ${name} 漂移：副本「${got}」≠ 真源「${truthValue}」`);
    }
  }
  // A2：src 有、副本无（WARN 级，可见但不强制复制）
  for (const name of truthSrc.keys()) {
    if (!mirror.has(name)) warns.push(`${rel} 缺 ${name}（src 真源有，mockup 侧未镜像）`);
  }
  for (const name of truthPk.keys()) {
    if (!mirror.has(name) && name.startsWith('--pk-')) {
      warns.push(`${rel} 缺 ${name}（panel-kit 真源有，kit 手工副本段未同步）`);
    }
  }
}

/** 可解析集合 = 副本 ∪ 两份真源 */
function resolvable(name, rel) {
  const mirror = parseRootTokens(readIfExists(rel) ?? '');
  return mirror.has(name) || truthSrc.has(name) || truthPk.has(name);
}

// ── 判据 C：引用解析（只对真正 link 了 kit 的 mockup 文件生效） ─────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(css|html)$/i.test(name)) out.push(abs);
  }
  return out;
}

let checkedRefs = 0;
for (const abs of walk(join(ROOT, MOCKUP_ROOT))) {
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const text = readFileSync(abs, 'utf8');
  const linksKit = /maomao-kit\.css/.test(text);
  if (!linksKit) continue;
  for (const m of text.matchAll(/var\(\s*(--(?:mao|pk)-[\w-]+)/g)) {
    checkedRefs++;
    const name = m[1];
    const kitRel = MIRROR[0];
    if (!resolvable(name, kitRel)) {
      violations.push(`${rel} 引用 ${name} 在 kit / 真源里都不存在（空引用 ⇒ 颜色静默失效）`);
    }
  }
}

// ── 判据 D：@import 存在性 ────────────────────────────────────────────────
for (const abs of walk(join(ROOT, MOCKUP_ROOT))) {
  if (!abs.endsWith('.css')) continue;
  const rel = relative(ROOT, abs).replace(/\\/g, '/');
  const text = readFileSync(abs, 'utf8');
  for (const m of text.matchAll(/@import\s+(?:url\()?['"]([^'")]+)['"]/g)) {
    const target = resolve(dirname(abs), m[1]);
    if (!existsSync(target)) {
      violations.push(`${rel} 的 @import 断链：${m[1]}（src 挪文件后 mockup 会静默失色）`);
    }
  }
}

// ── 判据 E：tailwind 配置里的 var(--mao-*) 必须解析到真源 ──────────────────
for (const rel of TAILWIND_CONFIGS) {
  const text = readIfExists(rel);
  if (text === null) continue;
  for (const m of text.matchAll(/var\(\s*(--mao-[\w-]+)/g)) {
    if (!truthSrc.has(m[1])) violations.push(`${rel} 引用 ${m[1]}，但 src 真源里没有这个键（配置写错 = 全站静默失效）`);
  }
}

// ── 输出 ──────────────────────────────────────────────────────────────────
console.log('🔒 令牌副本一致性闸（唯一真相源 ↔ 手工副本）');
console.log(`   真源 ${TRUTH.src}（${truthSrc.size} 键）· ${TRUTH.panelKit}（${truthPk.size} 键）`);
console.log(`   副本 ${MIRROR.join(' / ')} · 引用校验 ${checkedRefs} 处`);

if (SHOW_WARN && warns.length) {
  console.log(`\n   ⚠️ WARN（不阻断；「用到必须有」由判据 C 兜住）：${warns.length} 条`);
  for (const w of warns.slice(0, 20)) console.log(`      - ${w}`);
  if (warns.length > 20) console.log(`      … 另 ${warns.length - 20} 条`);
}

if (violations.length) {
  console.error(`\n❌ 副本一致性未通过：${violations.length} 条\n`);
  for (const v of violations) console.error(`   ✗ ${v}`);
  console.error(
    '\n修法：① 值不一致 → 以 `src/index.css` `:root` 为准改副本（长期应改为脚本生成 kit，见计划 §5）；\n' +
      '   ② 缺键 → 同步进副本，或让 mockup 改用已镜像的键；\n' +
      '   ③ @import 断链 → 修路径（若 src 已挪文件，证明「手动副本」模式必须尽快换成生成）。',
  );
  process.exit(1);
}

console.log(`   ✅ 副本与真源一致（${mirrorText.length} 份副本 / 0 漂移${warns.length ? ` / ${warns.length} 条 WARN` : ''}）`);
