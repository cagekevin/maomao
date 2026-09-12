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
 *   · 浏览器 API 预期不可用（`new URL(data:...)` 抛、`video.load()` 抛、`ImageBitmap.close()` 抛）
 *   · 兜底解析（DOMParser 失败回退正则）
 *   对这类，「加日志」是噪音。故本闸**不用白名单**（白名单=假护栏，本仓已批过），
 *   而用**显式标记 `// catch-ok: <理由>`**：标记本身是代码（AST/正则可查），理由另说。
 *
 * 【判定】空 catch（含 `.catch(() => {})` 简写）**必须**带 `// catch-ok:` 标记；无标记 → 违规。
 *   「空」定义：块内仅注释/空白，或 `.catch` 回调体仅 `{}`/`null`/`undefined`/`0`/`void 0`。
 *   真债修法：改为经 `reportDegrade(...)` 或 `logger.warn(...)` 留痕（失败必须可见）。
 *
 * 用法：`node scripts/check-silent-catch.mjs`（挂 `npm run check:catch`，进 prebuild/pretest）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

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
    // 剥行尾注释后再判（避免注释里的 catch 文字误报）；同行的 `// catch-ok:` 标记另判
    const code = raw.replace(/\s\/\/.*$/, '');
    const hasMark = /\/\/\s*catch-ok:/.test(raw);
    for (const rule of INLINE_PATTERNS) {
      if (rule.re.test(code) && !hasMark) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}  [${rule.name}]  ${trimmed.slice(0, 120)}`,
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
      // 标记可写在 `catch {` 行尾，或块内注释行
      const bodyText = lines.slice(i, closedAt + 1).join('\n');
      if (!/\/\/\s*catch-ok:/.test(bodyText)) {
        violations.push(
          `${relative(ROOT, file)}:${i + 1}  [catch{ 仅注释/空块]  ${trimmed.slice(0, 120)}`,
        );
      }
    }
  }
}

console.log('🔒 静默 catch 门禁（失败必须可见）');
console.log(
  `   扫描 src 共 ${files.length} 个 .ts/.tsx · 判定：空 catch 必须带 \`// catch-ok: <理由>\` 标记`,
);

if (violations.length > 0) {
  console.error(`\n❌ 发现 ${violations.length} 处静默吞错误（无标记）：`);
  for (const v of violations) console.error('   ' + v);
  console.error(
    '\n修法二选一：\n' +
      '  ① 失败应可见 → 改为 `reportDegrade({ layer, key, e })` 或 `logger.warn(category, msg, e)` 留痕；\n' +
      '  ② 确属结构性空 catch（锁链防断 / logger 防递归 / 浏览器 API 预期不可用）→ 行尾加 `// catch-ok: <理由>`。',
  );
  process.exit(1);
}
console.log('   ✅ 0 违规');
