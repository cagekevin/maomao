#!/usr/bin/env node
/**
 * health-check.cjs — 原型工程健康度全量检查（借鉴 1mao scripts/health-check.cjs）。
 *
 * 覆盖（2026-09-23 瘦身后只剩三节）：
 *   1. 静态资产存在性 —— **只列"没有别的东西能抓到"的那些**（判据见 §1 注释）
 *   2. npm run build（能构建）
 *   3. 统一测试门禁（scripts/run_all_tests.cjs：冒烟 + 前端 vitest 全量 + localtool）
 *
 * 【门禁分工（2026-09-23 定）——为什么本文件只留这三节】
 *   各闸已经在**四条路上反复跑**了，health 不该再手写一遍：
 *     · pre-commit（日常钩子）：lint-staged + test-affected + smoke + regression + tools
 *     · pre-push（类型/代码闸）：全量 lint + `check:push`（type-check/any/events/arch/dead-code/gate-vitals）
 *     · CI（云端兜底）：同一个 `check:push` + `test:coverage`（+ localtool job）
 *     · **check:health（最终防线 / 交付前）**：manifest 全部闸（经 gates-run 各一次）+ 本文件三节
 *   ⇒ 本文件独有的、别处**都没有**的只有三件：**真·vite 生产构建**（CI 与 hook 均不跑）、
 *      **全量统一测试**（run_all_tests.cjs：smoke + vitest 全量 + localtool tsc/test）、**静态资产存在性**。
 *      这三件正是"最终防线"该管的事，其余判据一律回 gates.manifest.json 单源。
 *
 * 【2026-09-23 删四节（用户裁定「删」）——逐条理由，防回潮】
 *   ①「npm scripts 完整性」：判的是 `package.json` 文本，不是行为。`build` 由本文件 §2 自跑、
 *      `test:regression`/`test:tools` 由 `.husky/pre-commit` 直接调用（缺脚本那行自身即非 0）、
 *      `dev`/`test:smoke`/`test:all` 在闸/hook/CI 里**无人调用** ⇒ 删掉后任何真实失效路径的结论不变。
 *   ②「横切契约静态校验」（原 §4.1~4.4：keys/events/node-types/node-handles/node-data）与
 *      「架构校验」（原 §5.5 check-arch）：与 `scripts/gates.manifest.json` **逐条重复**（同一脚本一字不差）。
 *      health 分组 = 全部 gates + healthOnly（见 gates-run.mjs:92-95），本文件再手写一遍 ⇒ 同一次 health 里
 *      node-types/node-handles/node-data/keys 各跑 **3 遍**（闸循环 + §2 `npm run build` 的 prebuild + 原 §4.x）、
 *      events/arch 各 2 遍。实测单次耗时 check-arch 9.3s / check-keys 2.2s / check-events 2.0s
 *      ⇒ 纯重复 ≈ 20s、新增覆盖 0；且直接违反本文件 Q3 自述「闸清单本身是 gates.manifest.json 单一真源，
 *      此处不得重复写（只消费）」。
 *   ③「TDZ 风险扫描」：三个模式全是**运行期报错文案**，匹配的是源码文本，而 TDZ 是运行期现象
 *      ⇒ 不可能命中 TDZ（唯一命中途径 = 把报错文案写进字符串字面量；注释已被逐行跳过）。
 *      且它走 warn（不改退出码）⇒ 命中也不拦。实测 0 命中 ⇒ 假防线 + 永不失败。
 *   ④ 原「文件存在性」19 项里的 8 项冗余（src/main · src/App · src/index.css · base/core/config ·
 *      storageAdapter · groupNodes + scripts/run_all_tests · scripts/smoke_test）：缺席时 build / tsc /
 *      本文件「构建」「测试」两节会以**更好**的报错暴露（有栈、有原因）；收进来只会把诊断降级成
 *      一行「❌ 冒烟测试 (scripts/smoke_test.cjs)」。
 *
 * 【2026-09-20 删除「决策渠道门禁」整节（用户裁定）】原节断言 `docs/adr/` 为空（2026-08-18 立），
 *   该约定已于 2026-09-18 被 ADR-0017 推翻 ⇒ 该节此后**恒假红**（健康态判红）。修法不是"翻正判据"，
 *   而是**删掉**：**文档不需要任何测试**（用户裁定 2026-09-20）—— 文档内容不属闸的管辖面，
 *   文档写错就改文档，不靠断言守。本文件自此只做「编排既有闸 + 源码级检查」，不判任何文档内容。
 *   （2026-09-23 瘦身后，本文件只剩「静态资产存在性 + 构建 + 测试」三节。）
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**编排器（半判定闸）** —— 只判 §1 静态资产存在性 + 编排「构建 / 测试」两节；
 *               其余判据**一律不在此维护**，由各 `check:*` 闸经 gates.manifest.json 单源消费
 *               （避免第二份真相 —— 见上方 2026-09-23 第②条）。
 *   Q2 何时该改：巡检覆盖面变化时同步（新增核心文件 / 新脚本 / 基线项）。
 *   Q3 怎么改：改本文件的覆盖面清单；**闸清单本身是 `scripts/gates.manifest.json` 单一真源，
 *               此处不得重复写**（只消费）。本闸无豁免清单。
 *
 * 用法: node scripts/health-check.cjs        （或 npm run check:health）
 * 退出码: 有错误 → 1
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// 扩展名无关：TS 化期间源码后缀会在 .js/.jsx/.ts/.tsx 间漂移，写死后继扩展名的检查会在改名那刻误红
const { resolveSourceFile } = require('./ts-exts.cjs');

const ROOT = path.resolve(__dirname, '..');

let errors = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) errors++;
};

/**
 * 跑一道子进程门禁，**失败时把完整输出打出来**。
 *
 * 【2026-09-10 修：为什么不再 slice】
 * 原实现是 `execSync(..., { stdio: 'pipe' })` + `catch(e) { check(false, e.stdout.slice(0, 100)) }`。
 * 三重重击导致失败信息几乎不可用，排查者（含 AI）只能去 grep 源码反推：
 *   ① stdio:'pipe' 吞掉实时输出 → 失败瞬间看不到任何细节；
 *   ② `.slice(100)` 只留**首部** 100 字符 → 而 vitest/eslint 的失败摘要与断言差异都在**末尾**，被精准切除；
 *   ③ 无 maxBuffer 设置 → 默认 1MB，全量测试输出可能撞上限，报 "stdout maxBuffer exceeded"
 *      （这本身又是假错误，进一步误导排查）。
 * 现在：成功静默；失败时完整打印 stdout + stderr，让定位一次到位。
 *
 * @param {string} label  检查名（打印用）
 * @param {string} cmd    命令
 * @param {{timeout?: number}} [opts]
 * @returns {boolean} 是否通过
 */
function runGate(label, cmd, opts = {}) {
  const timeout = opts.timeout ?? 180000; // 3min 余量（实测 test:all 全量约 17s，见下）
  try {
    execSync(cmd, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout,
      maxBuffer: 32 * 1024 * 1024, // 32MB：防全量测试输出撞默认 1MB 上限产生假错误
    });
    check(label, true);
    return true;
  } catch (e) {
    const status = e.status ?? '?';
    const timedOut = e.signal === 'SIGTERM' || e.killed;
    check(
      label,
      false,
      timedOut ? `超时被终止（>${timeout}ms）` : `退出码 ${status}（完整输出如下）`,
    );
    console.log('\n─────── 失败详情（完整输出）───────');
    if (e.stdout) console.log(String(e.stdout).trimEnd());
    if (e.stderr) console.error(String(e.stderr).trimEnd());
    console.log('───────────────────────────────────\n');
    return false;
  }
}

console.log('═'.repeat(54));
console.log('  原型工程健康度全量检查（react-nodes）');
console.log('═'.repeat(54));

// ── 1. 静态资产存在性 ──
console.log('\n📁 静态资产存在性（只列"没有别的东西能抓到"的那些）');
// 判据（2026-09-23 立）：**只收 build / tsc / 本文件「构建」「测试」两节抓不到的**。
//   被 build 或 tsc 覆盖的一律不收 —— 它们的缺席会以**更好**的报错（有栈、有原因、指出谁在引用）暴露，
//   收进来只会把诊断降级成一行「❌ XXX」。同理：本文件下面就要跑的脚本（run_all_tests/smoke_test）不收。
// 说明：源码条目【不写扩展名】——后缀会随 TS 化漂移（storageAdapter.js→.ts、groupNodes.js→.ts
// 已经把这项检查搞红过一次），统一走扩展名无关解析；非源码条目（插件文件/配置）照旧写全名。
const files = [
  // ① 插件产物：vite 只是把 public/ 原样拷进 dist，全仓**没有任何脚本读** manifest.json /
  //    background.js / 图标（已 grep scripts/ 确认）⇒ 缺了要到 Chrome 装载时才发现（拒绝安装），
  //    属「静默到装机才炸」，只有这里的 existsSync 能提前抓到。
  ['public/manifest.json', '插件 manifest'],
  ['public/background.js', '插件 background'],
  ['public/icon16.png', '插件图标 16'],
  ['public/icon48.png', '插件图标 48'],
  ['public/icon128.png', '插件图标 128'],
  ['public/manifest.webmanifest', 'PWA manifest（index.html 引用；2026-09-23 补登记，原清单漏项）'],
  // ② 配置文件：**被删时工具会静默回退默认配置、构建照样"成功"** ⇒ 存在性检查是唯一抓得到的手段。
  //    vite 少了 `base:'./'` ⇒ 插件侧相对路径失效；tailwind 少了 config ⇒ 主题令牌全丢。
  ['vite.config', '构建配置（缺 → base/chunk 切分静默回退默认值）'],
  ['vitest.config', '单测配置（缺 → 环境/别名静默回退默认值）'],
  ['playwright.config', 'E2E 配置'],
  ['tailwind.config', '样式令牌真相源（缺 → 主题静默回退默认值）'],
  // ③ 测试文件：vitest 少一个用例文件**不会失败**（其余用例仍绿）⇒ 这里是唯一防「覆盖静默缩水」的。
  ['tests/unit/nodes/ssrRegression.test', 'SSR 结构回归 (vitest)'],
  ['tests/unit/canvasAgentTools.test', 'Agent 工具单测 (vitest)'],
  // 注：postcss.config 刻意保持 .js（postcss-load-config@6 加载 .ts 需 ts-node），不加进清单。
];
const relOf = (p) => path.relative(ROOT, p).split(path.sep).join('/');
for (const [f, name] of files) {
  // 先按原样判存在（css / 插件文件 / 脚本等写全名的条目），不存在再走扩展名无关解析。
  //
  // ⚠️ 为什么不用 `path.extname(f) ? 存在性 : resolveSourceFile()` 的写法（2026-09-02 修正）：
  //   `path.extname('vite.config')` 返回 '.config'（truthy），会被当成「已写全扩展名」的条目，
  //   直接 existsSync 判 false → 根配置 TS 化后整项误红。点号文件名普遍存在（*.config / *.min 等），
  //   用 extname 是否为空来区分「写全名 vs 待解析」并不可靠。
  //   改成「原样存在即用，否则扩展名无关解析」后两类条目都成立，且保持「改名不误红」的初衷。
  const abs = path.join(ROOT, f);
  const hit = fs.existsSync(abs) ? f : resolveSourceFile(abs);
  check(`${name} (${hit === f ? f : hit ? relOf(hit) : f})`, !!hit);
}

// ── 2. 构建 ──
// 注：`npm run build` 会先触发 prebuild（= gates-run build 的 6 道构建契约闸），这是**闸循环之外**的
// 第二遍；原 §4.1~4.4 又手写了第三遍，已于 2026-09-23 删除（见文件头第②条）。
console.log('\n🏗️ 构建（npm run build）');
runGate('npm run build', 'npm run build', { timeout: 120000 });

// ── 3. 统一测试门禁 ──
console.log('\n🧪 统一测试门禁（test:all）');
runGate('test:all (smoke+regression+tools)', 'node scripts/run_all_tests.cjs');

console.log('\n═'.repeat(54));
console.log(`  结论: ${errors ? `❌ ${errors} 处错误` : '✅ 无错误'}`);
console.log('═'.repeat(54));
process.exit(errors ? 1 : 0);
