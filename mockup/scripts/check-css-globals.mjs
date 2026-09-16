#!/usr/bin/env node
/**
 * check-css-globals.mjs — mockup 裸值门禁
 *
 * 扫描 mockup/ 下所有 .css / .html（含 <style> 内联），
 * 找出「裸色值 / 裸字号 / 裸阴影」并逐项报告，便于 Step 3 替换 + CI 防回退。
 *
 * 规则：
 *   - 裸色值： #rgb / #rrggbb / rgba?(...) / hsla?(...)
 *   - 裸字号： font-size: 12px 之类（非 var()、非 0）
 *   - 裸阴影： box-shadow: 非 var() 且非 none
 * 豁免：行内出现 --mao- / --placeholder / rgb(var( 视为已令牌化。
 *
 * 退出码：发现违规 → 1（CI 失败）；否则 0。
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('mockup');
const SCAN = ['.css', '.html'];

const reHex = /#([0-9a-fA-F]{3,8})\b/g;
const reRgb = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*[,/]\s*[\d.]+\s*\)/g;
const reHsl = /hsla?\(/g;
const reFont = /font-size:\s*(\d+(\.\d+)?px)/g;
const reShadow = /box-shadow:\s*(?!var\()(?:none|[^;<\n]+)/g;

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'scripts') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SCAN.includes(path.extname(p))) out.push(p);
  }
}

const files = [];
walk(ROOT, files);

let total = 0;
const byFile = new Map();

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    if (/--mao-|--placeholder|rgb\(var\(|rgba\(var\(/i.test(ln)) return; // 已令牌化
    const hits = [];
    let m;
    while ((m = reHex.exec(ln))) hits.push('#' + m[1]);
    reHex.lastIndex = 0;
    while ((m = reRgb.exec(ln))) hits.push(m[0]);
    reRgb.lastIndex = 0;
    if (reHsl.test(ln)) hits.push('hsl(...)');
    reHsl.lastIndex = 0;
    while ((m = reFont.exec(ln))) hits.push('font-size:' + m[1]);
    reFont.lastIndex = 0;
    while ((m = reShadow.exec(ln))) {
      const v = m[0].replace(/\s+/g, ' ').trim();
      if (!/box-shadow:\s*none/i.test(v)) hits.push(v.slice(0, 60));
    }
    reShadow.lastIndex = 0;
    if (hits.length) {
      total += hits.length;
      if (!byFile.has(rel)) byFile.set(rel, []);
      byFile.get(rel).push(`${i + 1}: ${hits.join(' | ')}`);
    }
  });
}

if (byFile.size === 0) {
  console.log('✅ 未发现裸值（mockup/ 全部令牌化）');
  process.exit(0);
}

console.log('⚠️  发现裸值（Step 3 待替换）：');
for (const [rel, items] of byFile) {
  console.log(`\n📄 ${rel}  (${items.length})`);
  for (const it of items) console.log('   ' + it);
}
console.log(`\nTOTAL bare-value hits: ${total}  across ${byFile.size} files`);
process.exit(1);
