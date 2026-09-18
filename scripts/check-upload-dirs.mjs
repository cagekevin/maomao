#!/usr/bin/env node
/**
 * uploads 目录契约闸（TD-03-18 恢复版）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么恢复这道闸，以及判据为什么换了】
 * 原闸（已删，2026-09-15）判据是「前端 UPLOAD_DIRS 常量 vs 后端 UPLOAD_ROOT_ALLOW 集合对账」——
 * 实测常绿（两端各 5 个手写根，一年最多动一次），性价比不合格，故删。
 *
 * **本次恢复用的是完全不同、且真正会漏的那条判据**：
 *   「**代码里实际传出去的 subfolder 值域 ⊆ 已登记目录**」
 * 原闸对不了这条 —— 它只比两张手写常量表，而漏的东西恰恰**不在任何表里**：
 *   · `canvas/face_mosaic`（FaceMosaicNode 裸写字面量，表外）
 *   · `migrated/脚本/尾帧变体`（scriptBoxEngine 裸写 2 处，表外）
 * 这两处都是"写侧自己知道、登记册不知道"，最终生产出 `canvas/cleaned` / `canvas/template` /
 * `canvas/upload` 三个**全仓零引用**的孤儿目录（128 文件）—— 写时没人拦，事后无人知。
 *
 * 【判据（三条，逐条必要）】
 *  ① **固化字面量**: 源码里出现 `'<root>/<sub>'` 形式的落盘目录字面量时，必须已登记
 *     （`KNOWN_SUB_DIRS` 或 `CODE_GENERATED_USER_SUB_DIRS`）——禁止表外裸写。
 *  ② **未知顶层根**: 字面量的顶层根必须在 `UPLOAD_ROOT_KIND` 里（防写错根）。
 *  ③ **两端一致**: 前端 `KNOWN_SUB_DIRS` 与后端 `SUB_DIR_ALLOW` 必须集合相等
 *     —— 这条才是原闸的旧判据，保留作补充（成本已付，顺带查）。
 *
 * 【豁免】只读/展示用途的路径引用（如注释里的示例）天然不进判据 —— 判据只看**代码里的字符串实参**，
 * 且在注释行/文档字符串内不扫（见 isCommentOrDoc）。
 * ════════════════════════════════════════════════════════════════
 *
 * 【★闸的申诉口 · 三问（2026-09-14 入规 → 架构师心法 §零.4.2）】
 *   Q1 守什么：**红线闸**。它守的是**「落盘目录 ⊆ 登记表」这条登记表一致性契约**
 *               —— 依据 `CLAUDE.md §5.1`「成功必须为真」：往未登记目录落盘 = 产物进得了盘、
 *               进不了登记册 ⇒ 事后无人认领（孤儿目录 128 文件的成因）。
 *   Q2 何时该改：① **新增落盘目录** → 不改本闸，改**真源登记表**
 *               （前端 `src/components/base/utils/uploadDirs.ts` 的 `KNOWN_SUB_DIRS` /
 *                `CODE_GENERATED_USER_SUB_DIRS`；后端 `localTool/src/utils/fileStore.ts` 的 `SUB_DIR_ALLOW`）；
 *               ② **两端登记表集合不等** → 改到相等为止（不是改闸）；
 *               ③ 若某条判据被证明**误报**（把正确动作判红）→ 收窄判据，**不放宽**。
 *               ⚠️ **它不会拦住"让同一语义份数下降"的动作**（只读源码字面量，不改任何判定）
 *               → 不构成成本倒挂源（ADR-0016）。
 *   Q3 怎么改：**只收窄不放宽**；改完必跑 `node scripts/check-upload-dirs.mjs` 求绿，
 *               并跑**先红后绿探针**证明它仍会红（`node scripts/probe.mjs …`）——
 *               **没有负例探针的闸 = 未验收**。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 从真源读取登记（不抄第二份；真源 = 前端中央表 + 后端白名单，用正则抽字面量）──

/** 从文件中抽取 `new Set([...])` 或 `= { ... }` 里的字符串字面量（按变量名定位）。 */
function extractStringLiteralsFromBlock(file, declRe) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const m = declRe.exec(src);
  if (!m) throw new Error(`[闸自检] 在 ${file} 中找不到声明：${declRe}`);
  // 从声明处向后截取到第一个 `]);` 或 `};`（本仓登记表均为扁平字面量，无嵌套）
  const rest = src.slice(m.index);
  const end = rest.search(/\]\s*\)|\}\s*;/);
  const block = end > 0 ? rest.slice(0, end) : rest.slice(0, 4000);
  return [...block.matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]);
}

const FRONT_DIRS = 'src/components/base/utils/uploadDirs.ts';
const BACK_FILE = 'localTool/src/utils/fileStore.ts';

const frontRootKind = extractStringLiteralsFromBlock(
  FRONT_DIRS,
  /export const UPLOAD_ROOT_KIND[^=]*=\s*\{/,
);
const frontKnownSub = extractStringLiteralsFromBlock(
  FRONT_DIRS,
  /export const KNOWN_SUB_DIRS[^=]*=\s*new Set\(\[/,
);
const frontCodeGen = extractStringLiteralsFromBlock(
  FRONT_DIRS,
  /export const CODE_GENERATED_USER_SUB_DIRS[^=]*=\s*new Set\(\[/,
);
const backSubAllow = extractStringLiteralsFromBlock(BACK_FILE, /export const SUB_DIR_ALLOW\s*=\s*new Set\(\[/);

// UPLOAD_ROOT_KIND 的键：抽取结果混入了值（'system'/'user'），需按 "键: '值'" 解析
const frontRootKindKeys = (() => {
  const src = fs.readFileSync(path.join(ROOT, FRONT_DIRS), 'utf8');
  const m = /export const UPLOAD_ROOT_KIND[^=]*=\s*\{/.exec(src);
  const rest = src.slice(m.index);
  const end = rest.search(/\}\s*;/);
  const block = rest.slice(0, end > 0 ? end : 4000);
  const keys = [];
  for (const line of block.split('\n')) {
    const km = /^\s*'?([\w-]+)'?\s*:\s*'(user|system)'/.exec(line);
    if (km) keys.push(km[1]);
  }
  return keys;
})();

const KNOWN = new Set([...frontKnownSub, ...frontCodeGen]);

// ── 扫描：找出所有把字符串字面量当 subfolder 传的落盘调用 ──
//
// 判据 = 「落盘出口函数 + 其 subfolder 位置的字面量实参」。
// 落盘出口收口在 filesApi（见其头部注释：唯一端点 /api/files/upload），故只需认这几个函数名。
const PERSIST_FNS = [
  'uploadFileToLocal',
  'persistUrlToUploads',
  'saveInlineToLocal',
  'downloadRemoteToLocal',
  'saveResultToTasks',
  'uploadResult',
  'resolveNodeAssetUrl',
];

/** 目录字面量的形状：`<根>/<...>` 或纯顶层根名。 */
const DIR_LITERAL_RE = /^\s*(tasks|web|canvas|migrated|director3d|local-patch)(\/[^\s'"]+)?\s*$/;

function collectTargets(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectTargets(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 该行是否处于注释/文档字符串中（豁免：只读引用、示例说明）。 */
function isCommentOrDoc(line) {
  const t = line.trim();
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*/');
}

const violations = [];

for (const file of [...collectTargets(path.join(ROOT, 'src')), ...collectTargets(path.join(ROOT, 'localTool/src'))]) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentOrDoc(line)) continue;
    for (const fn of PERSIST_FNS) {
      if (!line.includes(fn)) continue;
      // 抓该调用点后 3 行内的字符串字面量（覆盖跨行实参）
      const window = lines.slice(i, i + 4).join(' ');
      for (const m of window.matchAll(/['"]([^'"]+)['"]/g)) {
        const lit = m[1];
        const dm = DIR_LITERAL_RE.exec(lit);
        if (!dm) continue; // 不是目录形状的字面量（如 filename），跳过
        const root = dm[1];
        const full = dm[0].trim();
        if (!frontRootKindKeys.includes(root)) {
          violations.push(`${rel}:${i + 1}  未知顶层根 '${root}'（未在 UPLOAD_ROOT_KIND 登记）`);
        } else if (full.includes('/') && !KNOWN.has(full)) {
          violations.push(
            `${rel}:${i + 1}  未登记目录字面量 '${full}' → 请在 ${FRONT_DIRS} 的 KNOWN_SUB_DIRS（系统产物根）或 CODE_GENERATED_USER_SUB_DIRS（用户根下代码生成目录）备案`,
          );
        }
      }
    }
  }
}

// ── 判据③：两端登记一致 ──
const onlyFront = [...frontKnownSub].filter((x) => !backSubAllow.includes(x));
const onlyBack = backSubAllow.filter((x) => !frontKnownSub.includes(x));
if (onlyFront.length) violations.push(`前端 KNOWN_SUB_DIRS 有而 后端 SUB_DIR_ALLOW 无：${onlyFront.join(', ')}`);
if (onlyBack.length) violations.push(`后端 SUB_DIR_ALLOW 有而 前端 KNOWN_SUB_DIRS 无：${onlyBack.join(', ')}`);

// ── 汇总 ──
console.log('📁 uploads 目录契约校验（落盘 subfolder ⊆ 登记）');
console.log(`   登记：顶层根 ${frontRootKindKeys.length} 个 · 系统产物子目录 ${frontKnownSub.length} 个 · 用户根下代码生成目录 ${frontCodeGen.length} 个`);

if (violations.length === 0) {
  console.log('  ✅ 无表外目录字面量（代码实参 ⊆ 登记）');
  console.log('\n✅ uploads 目录契约校验通过');
  process.exit(0);
}
for (const v of violations) console.error(`  ✖ ${v}`);
console.error(`\n发现 ${violations.length} 处 uploads 目录契约违规 ✖`);
process.exit(1);
