#!/usr/bin/env node
/**
 * 渐进式 strict 类型收口闸（noImplicitAny）—— TD-09-1 选项 A 的落点。
 *
 * 【背景】`tsconfig.json` 关闭 `strict` / `noImplicitAny` / `strictNullChecks`（历史遗留）。
 * 全 src 在 `--noImplicitAny` 下实测 **1435 处**隐式 any（TS7006 参数 984 / TS7031 解构 242 为主）。
 *
 * 【职责边界（2026-09-13 明确）】本闸只负责「白名单目录 0 隐式 any」这一渐进收口目标，
 * **不替 type-check 做通用类型校验**——二者用不同 tsc 标志（本闸带 --noImplicitAny，type-check 不带），
 * 标志会改变对无类型 .mjs mock 等的推断，强行合并会引入伪错误。故通用类型错误由独立的
 * `type-check` 闸（phase=push，tsc --noEmit 不带 --noImplicitAny）负责，二者在 push 阶段各跑一次、
 * 互不重叠，且提交阶段（commit）完全不跑 tsc，消除 commit+push 连发的双重编译。
 *
 * 【机制】白名单**渐进收口**：`WHITELIST` 内目录必须零 noImplicitAny 错误（不达标即红）；
 * 白名单外暂不阻塞（存量债，属 TD-09-1「待翻新」）。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**结构偏好闸** —— `noImplicitAny` 渐进收口 = **债务清单**，不是物理红线。
 *   Q2 何时该改：**"加白名单" = 加约束（越加越严）** → 它天然免疫"为过闸而放松"（本仓健康样本）；
 *               某目录长期无法达标 → **记债**，不放宽。
 *   Q3 怎么改：改 `scripts/strict-src-whitelist.json`（真源数据，与 `strict-report.mjs` 共用）；
 *               **方向只允许收窄** —— 新目录收口后加进去；禁止移除已达标的目录（那是放松）。
 *
 * 【★ 2026-09-18 · 提速调研结论：**没有便宜的提速，本闸保持原样**（实测留痕，防后人重走）】
 *   背景：用户要求「审计闸、优化速度」。本闸实测 **~9.2–12s**，是全仓第二慢（仅次于 knip）。
 *   逐条试过、逐条否掉（全部本仓实测，非推理）：
 *
 *   ① **`incremental` / `tsBuildInfoFile` —— 无效**。`tsc --noEmit` **不会**把增量信息固化到
 *      行为上：实测 `tsconfig.tsbuildinfo` 的 mtime 长期不变（自 13:47 起冻结），即缓存根本没被复用；
 *      且 `.tsbuildinfo` 里 `affectedFilesPendingEmit` 恒含 **841** 项、`options.noEmit === undefined`
 *      —— 即便显式 `--tsBuildInfoFile` 让它落盘，第二次仍 ~10.5s（无提速）。
 *      ⚠️ 这是 **TypeScript 的已知限制**，不是配置写错：`--noEmit` 与 `--incremental` 组合下
 *      增量短路不生效。**别再试这条**（已试 3 种写法：CLI flag / tsconfig 内 tsBuildInfoFile / 显式 --incremental）。
 *
 *   ② **按白名单收窄 `include` —— 更快但**不安全，已否决**。做法：按 `strict-src-whitelist.json`
 *      生成只含 18 个白名单目录的子配置（285/589 文件）。实测 11.4s → 10.5s（**只省 0.9s**），
 *      但**引入伪错误**：窄配置下 `src/components/base/utils/videoEngine.ts:34` 报
 *      `TS7016 gifenc 无声明文件`，而**全量配置下不报**（`grep -c gifenc` = 0）。
 *      原因：收窄 include 会改变 tsc 的 program 组成（外部 `.d.ts` 的加载与可见性随之变化）。
 *      ⇒ **为了 0.9s 去换「可能红在别处」= 违反闸的诚实性，不做。**
 *
 *   ③ **`--skipLibCheck` —— 已开**（tsconfig 里），无可再省。
 *
 *   ④ **与本闸和 `type-check` 的关系（重要 · 顺带澄清一条旧注释）**：
 *      实测两闸**确实不同**（非冗余）：把 tsconfig 的 `noImplicitAny` 临时改 false 后，
 *      `type-check`（无 CLI flag）报 **93** 错，本闸（带 `--noImplicitAny`）报 **0** 错
 *      ⇒ **CLI flag 会覆盖 tsconfig**，本闸的覆盖面独立存在，**不可合并**。
 *      （manifest `_design.tsc` 段「标志会改变推断、不可合并」的判断，经本次实测**成立**。）
 *      ⚠️ 但也要知道：**当前 tsconfig 已写死 `noImplicitAny: true`**，故此刻两闸输出**逐行相同**
 *      （均 0 错）。本闸的价值在于「**即使有人把 tsconfig 的 noImplicitAny 改成 false，白名单目录仍被守住**」
 *      —— 它是防「悄悄放松 tsconfig」的二道锁。**这条理由要留着**，别因"看起来重复"而删本闸。
 *
 * 用法：`node scripts/check-strict-src.mjs`（挂 `npm run check:strict-src` / pre-push）
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** 已收口目录（单一真源 = scripts/strict-src-whitelist.json，与 strict-report.mjs 共用） */
const WHITELIST = JSON.parse(
  readFileSync(new URL('./strict-src-whitelist.json', import.meta.url), 'utf8'),
).whitelist;

// 基数自检（防「扫 0 却绿灯」——TD-02-9 同款）：白名单为 0 = 本闸在守卫 0 个目录，inScope 恒为空 → 静默通过 = 最危险的失效
if (WHITELIST.length === 0) {
  console.error('❌ strict 白名单为空 → 本闸在守卫 0 个目录（扫 0 却绿灯）→ 拒绝放行');
  process.exit(1);
}

let out = '';
try {
  out = execSync('npx tsc -p tsconfig.json --noEmit --noImplicitAny', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
} catch (e) {
  out = `${e.stdout || ''}${e.stderr || ''}`;
}

const allErrors = out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
const inScope = allErrors.filter((l) => WHITELIST.some((w) => l.includes(w)));

console.log('🔒 strict 类型收口闸（noImplicitAny · TD-09-1 选项 A）');
console.log(`   白名单目录（${WHITELIST.length}）：${WHITELIST.join(' · ')}`);
console.log(`   全 src 隐式 any 存量：${allErrors.length} 处（白名单外不阻塞，属待翻新）`);

if (inScope.length > 0) {
  console.error(`\n❌ 白名单目录内出现 ${inScope.length} 处隐式 any（须清零后才能扩白名单）：`);
  for (const l of inScope) console.error('   ' + l);
  process.exit(1);
}

console.log('   ✅ 白名单目录 0 隐式 any');
