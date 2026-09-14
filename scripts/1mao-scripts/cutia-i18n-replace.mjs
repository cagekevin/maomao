#!/usr/bin/env node
/**
 * 2026-09-14 · cutia 编辑器 i18n 替换（docs/130-cutia搬迁计划书 §S2）
 *
 * 做三件事（每文件）：
 *   1. 删 `import { useTranslation } from "@i18next-toolkit/nextjs-approuter";`
 *   2. 删 `const { t } = useTranslation();`（及其变体）
 *   3. `t("X")` → `"中文"`（X 必须能在对照表命中）
 *
 * 安全检查（docs/130 X1–X4）：
 *   - 只处理**同时**含 useTranslation import 与解构的文件；
 *   - 只匹配 `t("双引号字面量")`，绝不碰 `t(` 后跟非字符串的形态（canvas translate / setTransform / 动态 key）；
 *   - 命中对照表的替换；未命中 → 记录并**保留原样**（不猜）；
 *   - 动态 key（t(variable)）→ 记录，不处理。
 *
 * 用法：node scripts/1mao-scripts/cutia-i18n-replace.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const TARGET = join(ROOT, 'src/components/videoEditor/ui');
const MAP_PATH = join(__dirname, 'cutia-i18n-zh-map.json');
const DRY = process.argv.includes('--dry');

const MAP = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
delete MAP._comment;
/** --no-import：只做 t() 文本替换，不删 import/解构（补漏第二轮用） */
const NO_IMPORT = process.argv.includes('--no-import');

/** 递归收集 .ts/.tsx */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const stats = { files: 0, replaced: 0, missed: new Set(), dynamic: new Set(), skippedFiles: [] };
const files = walk(TARGET);

for (const f of files) {
  let src = readFileSync(f, 'utf8');

  const hasImport = /from\s+["']@i18next-toolkit\/nextjs-approuter["']/.test(src);

  if (!NO_IMPORT) {
    if (!hasImport) continue;
    const hasDestructure = /const\s*\{[^}]*\}\s*=\s*useTranslation\s*\(/.test(src);
    if (!hasDestructure) {
      stats.skippedFiles.push(`${f.replace(ROOT + '/', '')}（有 import 无解构，跳过）`);
      continue;
    }
  } else {
    // 补漏：文件既可能已无 import（已处理过）也可能仍有；只要有 t( 就扫描
    if (!/\bt\(\s*["']/.test(src)) continue;
  }

  stats.files++;
  const before = src;

  if (!NO_IMPORT) {
    // 1+2. 删 import 行与解构行
    src = src.replace(/^\s*import\s*\{[^}]*\}\s*from\s*["']@i18next-toolkit\/nextjs-approuter["'];?\s*$/gm, '');
    src = src.replace(/^\s*const\s*\{[^}]*\}\s*=\s*useTranslation\s*\([^)]*\);?\s*$/gm, '');
  }

  // 3. t("X") → "中文"
  src = src.replace(/\bt\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g, (m, key) => {
    const hit = MAP[key];
    if (hit) {
      stats.replaced++;
      return `"${hit.replace(/"/g, '\\"')}"`;
    }
    stats.missed.add(key);
    return m;
  });

  // 3b. t('X') → "中文"（单引号形态；JSX 属性处同样适用）
  src = src.replace(/\bt\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g, (m, key) => {
    const hit = MAP[key];
    if (hit) {
      stats.replaced++;
      return `"${hit.replace(/"/g, '\\"')}"`;
    }
    stats.missed.add(key);
    return m;
  });

  // 记录动态 key（不处理，仅报告）
  for (const m of src.matchAll(/\bt\(\s*([A-Za-z_$][\w$.\[\]]*)\s*\)/g)) {
    stats.dynamic.add(m[1]);
  }

  if (src !== before) {
    if (!DRY) writeFileSync(f, src);
  }
}

console.log(`\n处理文件数：${stats.files}`);
console.log(`替换次数：${stats.replaced}`);
if (stats.missed.size) {
  console.log(`\n⚠️ 未命中对照表的 key（${stats.missed.size} 个，已保留原样，需人工补）：`);
  for (const k of [...stats.missed].sort()) console.log(`  ${JSON.stringify(k)}`);
}
if (stats.dynamic.size) {
  console.log(`\n⚠️ 动态 key（${stats.dynamic.size} 个，未处理，需人工判断取值域）：`);
  for (const k of [...stats.dynamic].sort()) console.log(`  t(${k})`);
}
if (stats.skippedFiles.length) {
  console.log(`\nℹ️ 跳过文件：`);
  for (const s of stats.skippedFiles) console.log(`  ${s}`);
}
console.log(DRY ? '\n[dry-run] 未写入' : '\n已写入');
