#!/usr/bin/env node
/**
 * 【元层闸 · 静态度量】在册闸的**扫描根必须存在**，且其"基数自检"不得缺失。
 *
 * ★闸的申诉口
 *   Q1 守什么：**结构偏好闸**。它守的不是代码，而是**其它闸的眼睛**。
 *   Q2 何时该改：① 新增闸 → 在 `GATES` 表里登记它的扫描根与本闸的"自检类型"；
 *              ② 某闸确实无扫描根（如 type-check 交给 tsc）→ 在表里写 `roots: null` + 理由；
 *              ③ 某闸的扫描根**合理地不存在** → 先问"这个闸还有存在意义吗"，有则登记豁免并写理由。
 *   Q3 怎么改：**只收窄不放宽**。新增豁免必须写明"为什么这个根不存在是正常的"。
 *
 * 【为什么存在 · 以及为什么是"静态"而不是"跑一遍"（2026-09-16 两次改版留痕）】
 *
 *   母体：**扫描型闸靠"字面目录路径"锚定，目录随重构改名 ⇒ 扫 0 ⇒ 仍打印 ✅**。
 *   实证：`TD-22-53`（`check-arch` 规则 4/6 守护的 `videoEditor/core/`、`hooks/` 随 cutia
 *   搬迁消失，两条规则**空转很久**却照常绿灯，而闸的产物被下游当真相用）；
 *   `TD-02-9`（`check-node-data` 解析正则因 `.ts` 化静默失效，长期报 `palette (0)` 却通过 check:health）。
 *
 *   ⚠️ **第一版设计是错的，必须记下来防重走**：
 *   我最初把本闸写成"**跑所有在册闸，从输出里抓扫描基数，0 就判红**"。
 *   实测 **8.9 秒**（其它闸全在 2 秒内），是全仓最慢的闸 —— 因为它把整个 push 阶段**又跑了一遍**。
 *   更要命的是：这个代价换来的是**几乎不会发生的场景**——
 *   绝大多数闸的扫描根就是 `join(ROOT, 'src')`，而 **`src/` 永远存在**；
 *   真正会消失的是 `check-arch` 内部那种**子目录**（如 `videoEditor/core/`），
 *   而那类**已经由 `check-arch` 自己的 `assertScanned()` 覆盖**。
 *   ⇒ 结论：**"跑一遍"是过度设计。这个信息是静态的，根本不需要执行任何闸就能拿到。**
 *
 *   【正确形态 = 静态度量】只做两件**零成本**的事：
 *     ① 读闸脚本源码，抽出它的**扫描根常量**，检查**该目录/文件是否存在**（`existsSync`，毫秒级）；
 *     ② 检查闸源码里**有没有"基数自检"**（扫到 0 时 fail-loud），没有则提示补。
 *   实测耗时 **< 0.1 秒**（原 8.9 秒 → 降 99%）。
 *
 * 【诚实边界（写进闸里，不假装覆盖）】
 *   本闸是**静态近似**，不等于"那个闸真的扫到了 N 个"。它能抓的是**目录消失**这类
 *   结构性失效（也正是两条实证弯路的成因）。运行时才暴露的失效（如正则写错、
 *   解析器被 `.ts` 化打瞎）由各闸**自己的基数自检**负责 —— 本闸同时检查"你有没有那个自检"，
 *   两者配合才完整。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MANIFEST = join(ROOT, 'scripts', 'gates.manifest.json');

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes('--json');

/**
 * 剥掉注释后再做特征匹配。
 * 【为什么必须剥（本仓两轮实证）】首版闸在全文上匹配 ⇒ `check-silent-catch.mjs` 的**文件头注释**里
 * 写了一句「经 scripts/gates-run.mjs」就被误判；同款教训 `TD-22-50`：守卫把注释里的 `<BaseView>`
 * 算成违规。**判据要判"代码做了什么"，不是"文件里出现了什么词"。**
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // 块注释（含 JSDoc）
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // 行注释（避开 http:// 之类）
}

/**
 * 在册闸的扫描根登记表 —— **唯一真源，新增闸时在此登记一行**。
 *
 * 字段：
 *   roots    —— 闸依赖的扫描根（相对仓库根）。`null` = 该闸无扫描根（如交给外部工具）。
 *   selfCheck—— 该闸是否带"扫到 0 即 fail-loud"的自检。`'own'` = 自己实现了；
 *               `'external'` = 由外部消费方保证（如 tsc）；缺失则本闸提示补。
 *   why      —— 无扫描根 / 无自检时的理由（**必填**，防"一句话绕过"）。
 */
const GATES = {
  api: { roots: null, selfCheck: null, why: '契约登记表比对（读 contracts.ts 与 router.ts），非目录遍历' },
  'node-types': { roots: ['src'], selfCheck: 'own', why: '' },
  'node-handles': { roots: ['src'], selfCheck: 'own', why: '' },
  'node-data': { roots: ['src'], selfCheck: 'own', why: '' },
  keys: { roots: ['src'], selfCheck: 'own', why: '' },
  'type-check': { roots: null, selfCheck: 'external', why: '由 tsc 负责遍历，tsc 自身对"无输入"会报错' },
  any: { roots: ['src'], selfCheck: 'own', why: '' },
  catch: { roots: ['src'], selfCheck: 'own', why: '' },
  events: { roots: ['src'], selfCheck: 'own', why: '' },
  'strict-src': { roots: ['src'], selfCheck: 'own', why: '' },
  arch: { roots: ['src'], selfCheck: 'own', why: '内部子规则（如 videoEditor/engine、ui、types）另有 assertScanned 逐条自检' },
  'dead-code': { roots: ['src'], selfCheck: 'own', why: '' },
  'arch-index': { roots: ['daily/架构日志'], selfCheck: 'own', why: '' },
  gates: { roots: null, selfCheck: null, why: '元层：读脚本头部注释，非扫描' },
  'gate-vitals': { roots: null, selfCheck: null, why: '元层（本闸）：静态度量其它闸，自身不扫描代码' },
  'doc-refs': { roots: ['src'], selfCheck: 'own', why: '' },
};

if (!existsSync(MANIFEST)) {
  console.error(`❌ 找不到闸清单：${MANIFEST}`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const registered = (manifest.gates ?? []).map((g) => g.id);

// ── 1. 登记表与闸清单必须双向一致（防"新增闸忘了登记"= 清单必漏）─────────────
const missing = registered.filter((id) => !(id in GATES));
const stale = Object.keys(GATES).filter((id) => !registered.includes(id));

/** 从闸的 cmd 里取脚本名 */
const scriptOf = (id) => {
  const g = (manifest.gates ?? []).find((x) => x.id === id);
  if (!g) return null;
  const m = /scripts\/([\w.-]+\.(?:mjs|cjs|js))/.exec(g.cmd);
  return m ? m[1] : null;
};

// ── 2. 逐闸静态体检 ─────────────────────────────────────────────────────────
const findings = []; // {id, level, msg}
for (const id of registered) {
  const meta = GATES[id];
  if (!meta) {
    findings.push({ id, level: 'error', msg: '未在 GATES 登记表里登记（新增闸必须登记：扫描根 + 自检类型）' });
    continue;
  }
  // 2a. 扫描根必须存在
  if (meta.roots) {
    for (const r of meta.roots) {
      if (!existsSync(join(ROOT, r))) {
        findings.push({ id, level: 'error', msg: `扫描根不存在：${r} → 该闸会**扫 0 但照常打印通过**（TD-22-53 同款）` });
      }
    }
  }
  // 2b. 无扫描根必须写明理由
  if (!meta.roots && !meta.why) {
    findings.push({ id, level: 'error', msg: 'roots 为 null 但未写 why（防"一句话绕过"，理由必填）' });
  }
  // 2c. 有扫描根就应有基数自检
  if (meta.roots && !meta.selfCheck) {
    findings.push({ id, level: 'warn', msg: '有扫描根但未声明基数自检 → 建议加"扫到 0 即 fail-loud"（TD-02-9 同款）' });
  }
  // 2d. 声称自己实现了自检 → 源码里应能找到痕迹（防"声明了但没做"）
  if (meta.selfCheck === 'own') {
    const s = scriptOf(id);
    if (s) {
      const p = join(ROOT, 'scripts', s);
      if (existsSync(p)) {
        const src = stripComments(readFileSync(p, 'utf8'));
        /*
         * 自检的**形态**（本仓实测的几种真实写法，别只认一种）：
         *   · `if (files.length === 0) { ...; process.exit(1) }`   ← check-silent-catch:99
         *   · `if (count === 0) { ... }`                            ← check-arch:71（assertScanned）
         *   · `if (codes.size === 0) { ... }`                       ← check-silent-catch:67
         *   · `if (X.length === 0 && Y.size === 0) { ... }`         ← check-arch:824
         * 故判据 = **存在"某集合的 size/length 判 0"且附近有 fail-loud（exit/throw/console.error）**
         *  —— 不要求两个条件在同一行（实测常分处两行）。
         */
        const zeroCheck =
          /(?:\.length|\.size)\s*===?\s*0/.test(src) ||
          /\bassertScanned\b/.test(src);
        const failLoud = /process\.exit\(\s*[1-9]/.test(src) || /throw new Error/.test(src);
        if (!(zeroCheck && failLoud)) {
          findings.push({
            id,
            level: 'warn',
            msg: `登记为 selfCheck:'own'，但源码未同时找到"集合判 0"（${zeroCheck ? '有' : '无'}）与"fail-loud"（${failLoud ? '有' : '无'}）痕迹（脚本 ${s}）`,
          });
        }
      }
    }
  }
}
// 3. 清单里有、登记表没有 → 已在上方 missing 里
for (const id of missing) {
  if (!findings.some((f) => f.id === id)) {
    findings.push({ id, level: 'error', msg: '闸清单里有，但 GATES 登记表没有' });
  }
}
for (const id of stale) findings.push({ id, level: 'warn', msg: 'GATES 登记表里有，但闸清单已无此闸（可能已退役，请删登记行）' });

const errors = findings.filter((f) => f.level === 'error');
const warns = findings.filter((f) => f.level === 'warn');

if (JSON_OUT) {
  console.log(JSON.stringify({ registered, findings }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

console.log('🩺 闸静态度量（元层 · 零执行）—— 扫 0 却绿灯 = 闸最危险的失败模式');
console.log(`   在册 ${registered.length} 道 · 静态检查扫描根存在性 + 基数自检声明\n`);

for (const id of registered) {
  const meta = GATES[id];
  const roots = meta?.roots ? meta.roots.join(',') : '（无·' + (meta?.why?.slice(0, 24) ?? '?') + '…）';
  const bad = findings.filter((f) => f.id === id);
  const mark = bad.some((f) => f.level === 'error') ? '❌' : bad.length ? '⚠️ ' : '✅';
  console.log(`   ${mark} ${id.padEnd(14)} 扫描根: ${roots}`);
}

if (errors.length) {
  console.log(`\n   ❌ ${errors.length} 处错误：`);
  for (const f of errors) console.log(`      ${f.id}: ${f.msg}`);
  console.log(`
   ── 怎么修 ──
   ① **扫描根不存在**：先读那道闸的判据 —— 它的守护对象是不是被改名/搬迁/删除了？
      · 对象已不存在 → **删该规则**（M6 幽灵预留），原处留「已删 · 退役留痕」注释；
      · 对象仍在但路径写错 → 修路径，**并加"扫到 0 即 fail-loud"自检**；
      · 确认"扫 0 正常" → 在 GATES 登记 reasons 里写清理由。
   ② **新增闸没登记** → 在 GATES 表加一行（扫描根 + selfCheck + why）。这是**唯一需要手写的地方**，
      但它**不是"闸清单"**（清单已在 gates.manifest.json）—— 它只是"本闸认识的扫描根"，
      漏了会被本闸当场点名（不像手写清单那样静默失效）。
`);
}
if (warns.length) {
  console.log(`\n   ⚠️  ${warns.length} 处警告（不判红）：`);
  for (const f of warns) console.log(`      ${f.id}: ${f.msg}`);
}

if (errors.length) process.exit(1);
console.log('\n   ✅ 全部闸的扫描根存在，且基数自检声明齐备');
process.exit(0);
