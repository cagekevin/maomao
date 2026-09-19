#!/usr/bin/env node
/**
 * symbol-defs.cjs — 符号【定义处】解析器（架构闸豁免的唯一真源）
 *
 * 【为什么存在】架构闸的豁免此前按【文件路径】列清单 → 改名 / 搬迁即静默失效。两次实证：
 *   · TD-17-24：`canvasHost.ts` 改名 `agentCanvasHost.ts` 时漏改豁免 ⇒ **唯一实现本体被判 14 处假红**；
 *   · 2026-09-19 域归位：`check-node-handles` 的路径派生豁免失效 ⇒ **build 硬红**；`check-arch` 规则 12 同因假红。
 *   反面同样危险：实现本体真搬走、名单还指着旧路径 ⇒ 规则**静默放宽**（假绿）。
 *   `gates.manifest` 的 `_design.gateCost` ② 已明令：**用反向判据，别用清单白名单（清单必漏）**。
 *   ⇒ 豁免一律改按【定义关系】推：豁免 = 「**定义**该符号的那个文件 / 那个目录」。
 *
 * 【判据（定义 vs 转发）】
 *   定义 = 声明语句：`export [declare] [default] [async] (function|const|let|var|class|interface|type|enum) <符号>`
 *   转发 = `export { X } from './x'` / `export * from './x'`  → **不算定义处**（它是桶，不是真源）。
 *   ⇒ 位置随实现体一起改名/搬迁，闸不用改；桶怎么变都不影响推导。
 *
 * 【fail-loud 契约】调用方必须校验**定义数恰好 1**：
 *   0 处（被改名/删除）或 >1 处（出现第二份实现）都属"闸的判据失效"，**不得静默放宽**（TD-02-9 教训）。
 *
 * CJS：供 `.mjs` / `.cjs` 共用（同 `ts-exts.cjs` / `node-file-resolver.cjs` 的约定）。
 * 用法：const { buildDefIndex } = require('./symbol-defs.cjs');
 *       const idx = buildDefIndex(root, ['getLocalKeys', 'contentGet']);
 */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

const SRC_EXTS = ['.ts', '.tsx'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'tmp', 'logs', '__mocks__']);

/** 递归收集 `root/src` 下的 .ts/.tsx（排除测试件：测试里的 `mock` 定义会污染"唯一定义"判定）。 */
function walkSource(dir, out) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkSource(full, out);
    else if (SRC_EXTS.includes(path.extname(name)) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** 定义处正则：声明关键字必须是 `export` 直接修饰的声明（转发语句不匹配）。 */
const declRe = (sym) =>
  new RegExp(
    `^\\s*export\\s+(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function|const|let|var|class|interface|type|enum)\\s+${sym}\\b`,
    'm',
  );

/**
 * 建索引：一次遍历 `root/src` 全部源码，返回 Map<符号 → 定义处相对路径数组>（正斜杠，可 >1 处）。
 * 多个符号共用一次遍历（调用方一次性传全量符号名，避免反复扫盘）。
 */
function buildDefIndex(root, symbols) {
  const files = walkSource(path.join(root, 'src'), []);
  const index = new Map(symbols.map((s) => [s, []]));
  const res = new Map(symbols.map((s) => [s, declRe(s)]));
  for (const f of files) {
    let code;
    try {
      code = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const sym of symbols) {
      if (!res.get(sym).test(code)) continue;
      index.get(sym).push(path.relative(root, f).split(path.sep).join('/'));
    }
  }
  return index;
}

module.exports = { buildDefIndex, SRC_EXTS, walkSource };
