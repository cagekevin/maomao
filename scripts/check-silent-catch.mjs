#!/usr/bin/env node
/**
 * 「静默吞错误」门禁 —— 让「失败被吞掉」在写下代码的当轮就编译不过。
 *
 * 【背景·为什么需要它】架构审计发现：剩余「错误兜底类」债 **100% 是同一句病**——
 *   `catch {}` / `.catch(() => {})` / `.catch(() => null)` 里什么都不做，失败就地消失。
 *   登记债（TD-02-16 fire-and-forget 5 处零日志 / TD-02-17 坏正则静默吞 / TD-02-18 双通道零信号 /
 *   TD-03-11~13 httpClient 吞错误体、filesApi 静默 return null）时都写了「改 logger.warn」，
 *   但**无人改**——因为**没有机器守卫**。凡收口无闸，必回潮（本仓 02-1/02-12/04-15 已四度实证）。
 *
 * 【核心区分：吞错误 vs 结构性空 catch】不能一刀切禁空 catch——有些 catch 空块是**结构性必需**：
 *   · 锁链防断（`next.catch(() => {})` 保证 locks 里的 promise 永不 reject）
 *   · logger 自身防递归（上报失败不能调 logger 报错）
 *   · 浏览器 API 预期不可用（new URL(data:...) 抛、video.load() 抛、ImageBitmap.close() 抛）
 *   · 兜底解析（DOMParser 失败回退正则）
 *   对这类，「加日志」是噪音。故本闸**不用白名单**（白名单=假护栏，本仓已批过），
 *   而用**显式标记 `// catch-ok: <CODE>`**，CODE 须来自单一真源登记表
 *   `src/components/base/core/catchOk.ts`（TD-02-26 偿还：原豁免通道是自由文本 + 只判存在性，
 *   可一句话绕过、理由永不验证；现收紧为「有限面登记表项 + 闸双向校验」，与本仓
 *   STORAGE_KEYS/EVENTS/NODE_TYPES 同款 SSOT 模式）。
 *
 * 【判定】空 catch（含 `.catch(() => {})` 简写）**必须**带 `// catch-ok: <CODE>`，且 CODE 在
 *   `catchOk.ts` 白名单内；无标记 / 标记 CODE 不在表内 → 违规。
 *   「空」定义：块内仅注释/空白，或 `.catch` 回调体仅 `{}`/`null`/`undefined`/`0`/`void 0`。
 *   真债修法：改为经 `reportDegrade(...)` 或 `logger.warn(...)` 留痕（失败必须可见）。
 *
 * 【守卫 vs catch 职责边界】守卫只管「契约违约 → fail-fast」；catch 管「运行时可预期失败 → 留痕
 *   或标 catch-ok 结构性豁免」。用前置守卫防运行时意外 = 假守卫。详见 spec/CONTEXT.md §三。
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸** —— "失败必须可见" + 守卫/catch 职责边界（已写入 `spec/CONTEXT.md §三`）。
 *   Q2 何时该改：**同一 CODE 被 ≥3 处使用且语义相同时 → 该升级为「收口原语」**（调用点不再需要豁免），
 *               而不是往 `catchOk.ts` 加第 12 个码。**码数应单调下降**：码表膨胀 = 闸在退化成文本通道
 *               （TD-02-26 的病理会以"更贵的形式"复发）。
 *   Q3 怎么改：优先在 `base/utils/asyncGuard.ts`（或 `guardKit`）新增**原语**（唯一实现 + 自带理由 + 配测试）；
 *               `catchOk.ts` **只收窄**（新增码须写明"为什么不能收口成原语"）。
 *
 * 用法：node scripts/check-silent-catch.mjs（挂 npm run check:catch，经 scripts/gates-run.mjs
 *   在 pre-push 与 CI 各跑一次，单一验证阶段 push；不进 build/commit 阶段）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const REGISTRY = join(ROOT, 'src/components/base/core/catchOk.ts');

/** 从单一真源登记表抽取合法 CODE 白名单（fail-loud：抽不到即报错退出，防路径/格式失效后静默「0 违规」）。 */
function loadCatchOkCodes() {
  let text;
  try {
    text = readFileSync(REGISTRY, 'utf8');
  } catch (e) {
    console.error(`❌ 静默 catch 门禁无法读取理由登记表：${REGISTRY}\n   ${e.message}`);
    process.exit(1);
  }
  const block = text.match(/export const CATCH_OK\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (!block) {
    console.error('❌ 无法从 catchOk.ts 解析 CATCH_OK 登记表（期望 `export const CATCH_OK = { ... } as const`）');
    process.exit(1);
  }
  const codes = new Set();
  const re = /(\w+)\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block[1]))) codes.add(m[2]); // key 与 value 同名，值即 CODE 令牌
  if (codes.size === 0) {
    console.error('❌ CATCH_OK 登记表为空，闸无从校验（这会放行任意标记）');
    process.exit(1);
  }
  return codes;
}

const CODES = loadCatchOkCodes();

/** 抽取一行/一段文本里的 catch-ok CODE 令牌（无标记返回 null）。 */
function extractCode(text) {
  const m = text.match(/\/\/\s*catch-ok:\s*(\S+)/);
  return m ? m[1] : null;
}
/** 标记是否「存在且 CODE 合法」（= 闸认可的结构性豁免）。 */
function isValidMark(text) {
  const c = extractCode(text);
  return c !== null && CODES.has(c);
}

/** 递归收集 src 下所有 .ts/.tsx */
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
})(SRC);

// 自检 fail-loud：解析源为空 → 报错退出（防路径/遍历失效后静默「0 违规」）
if (files.length === 0) {
  console.error('❌ 静默 catch 门禁自检失败：未扫描到任何 src/**/*.ts(x) 文件（路径或遍历失效）');
  process.exit(1);
}

/** 空 catch 模式（逐条为已知「吞」形态，均零误报）：
 *  1. `catch {}`                 —— 空块（行内）
 *  2. `catch { /* 注释 *\/ }`     —— 块内仅注释（行内）
 *  3. `.catch(() => {})`         —— 空回调简写
 *  4. `.catch(() => null|undefined|0|void 0)` —— 返回空值的回调
 *  多行块（`catch {` 换行后 `}`）由下面的跨行扫描单独处理。
 */
const INLINE_PATTERNS = [
  { re: /catch\s*\{\s*\}/, name: 'catch {} 空块' },
  { re: /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/, name: '.catch(() => {})' },
  {
    re: /\.catch\(\s*\(\s*\)\s*=>\s*(null|undefined|0|void\s+0)\s*\)/,
    name: '.catch(() => 空值)',
  },
];

const violations = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((raw, i) => {
    const trimmed = raw.trim();
    // 跳过整行注释
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    // 剥行尾注释后再判（避免注释里的 catch 文字误报）；标记须写在 `// catch-ok: <CODE>` 且 CODE 合法
    const code = raw.replace(/\s\/\/.*$/, '');
    const validMark = isValidMark(raw);
    for (const rule of INLINE_PATTERNS) {
      if (rule.re.test(code) && !validMark) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}  [${rule.name} 缺合法 catch-ok 码]  ${trimmed.slice(0, 120)}`,
        );
      }
    }
  });

  // 跨行空 catch：`catch {` 行 → 向下找首个非空/非注释内容，若立刻是 `}` 则空
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (!/catch\s*\{\s*$/.test(raw.replace(/\s\/\/.*$/, ''))) continue;
    // 已是 `catch {}` 行内形态，由 INLINE 处理，跳过
    // 向下扫描块体
    let onlyComments = true;
    let closedAt = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t === '') continue;
      if (t === '}') {
        closedAt = j;
        break;
      }
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/')) {
        continue;
      }
      onlyComments = false;
      break;
    }
    if (onlyComments && closedAt !== -1) {
      // 标记可写在 `catch {` 行尾，或块内注释行；必须存在且 CODE 合法
      const bodyText = lines.slice(i, closedAt + 1).join('\n');
      if (!isValidMark(bodyText)) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}  [catch{ 仅注释/空块 缺合法 catch-ok 码]  ${trimmed.slice(0, 120)}`,
        );
      }
    }
  }
}

console.log('🔒 静默 catch 门禁（失败必须可见）');
console.log(
  `   扫描 src 共 ${files.length} 个 .ts/.tsx · 判定：空 catch 必须带 \`// catch-ok: <CODE>\`（CODE ∈ catchOk.ts 白名单，共 ${CODES.size} 项）`,
);

if (violations.length > 0) {
  console.error(`\n❌ 发现 ${violations.length} 处静默吞错误（无合法标记）：`);
  for (const v of violations) console.error('   ' + v);
  console.error(
    '\n修法二选一：\n' +
      '  ① 失败应可见 → 改为 `reportDegrade({ layer, key, e })` 或 `logger.warn(category, msg, e)` 留痕；\n' +
      '  ② 确属结构性空 catch（锁链防断 / 防递归 / 浏览器 API 预期不可用 / 解析兜底 / 释放失败 / 读取回退默认 …）→\n' +
      '     行尾加 `// catch-ok: <CODE>`，CODE 取自 src/components/base/core/catchOk.ts，禁止自由文本。',
  );
  process.exit(1);
}
console.log('   ✅ 0 违规');
