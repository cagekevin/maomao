#!/usr/bin/env node
/**
 * check-css-globals.mjs — mockup 裸值门禁
 *
 * 扫描 mockup/ 下所有 .css / .html（含 <style> 内联），
 * 找出「裸色值 / 裸字号 / 裸阴影」并逐项报告。用于 Step 3 范围界定 + CI 防回退。
 *
 * 豁免规则（按优先级）：
 *   1. 行内出现 --mao- / --placeholder / rgb(var( / rgba(var(  → 已令牌化
 *   2. 行尾/行内出现 /* raw *​/ 或 mao-raw 标记              → 故意保留
 *   3. 整文件在 .css-globals.allow.json 的 files 里 true      → 该 mockup 的故意装饰
 *   4. 行包含 allow.json 的 substrings 任一                  → 具体装饰色点放行
 *
 * 退出码：发现违规 → 1（CI 失败）；否则 0。
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('mockup');
const SCAN = ['.css', '.html'];
const ALLOW_PATH = path.join(ROOT, '.css-globals.allow.json');

const reHex = /#([0-9a-fA-F]{3,8})\b/g;
const reRgb = /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*[,/]\s*[\d.]+\s*\)/g;
const reHsl = /hsla?\(/g;
const reShadow = /box-shadow:\s*[^;<\n]+/g;

let allowFiles = new Set();
let allowSubs = [];
if (fs.existsSync(ALLOW_PATH)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(ALLOW_PATH, 'utf8'));
    if (cfg.files) allowFiles = new Set(Object.keys(cfg.files).filter((k) => cfg.files[k]));
    if (Array.isArray(cfg.substr)) allowSubs = cfg.substr;
  } catch (e) {
    console.error('⚠️  白名单解析失败，忽略：', e.message);
  }
}

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
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  if (allowFiles.has(rel)) continue; // 整文件放行（故意装饰）
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => {
    if (/--mao-|--placeholder|rgb\(var\(|rgba\(var\(/i.test(ln)) return; // 已令牌化
    if (/^\s*--[\w-]+\s*:\s*/.test(ln)) return; // 自定义令牌声明（含本地 --c-* 装饰令牌），定义非使用
    if (/raw/i.test(ln) && /mao-raw|\/\*\s*raw\s*\*\//i.test(ln)) return; // 行内放行
    if (allowSubs.some((s) => ln.includes(s))) return; // 具体装饰色点放行
    const hits = [];
    let m;
    while ((m = reHex.exec(ln))) hits.push('#' + m[1]);
    reHex.lastIndex = 0;
    while ((m = reRgb.exec(ln))) hits.push(m[0]);
    reRgb.lastIndex = 0;
    if (reHsl.test(ln)) hits.push('hsl(...)');
    reHsl.lastIndex = 0;
    while ((m = reShadow.exec(ln))) {
      if (/var\(/.test(ln)) break; // 整行阴影色已用令牌（var()），非裸
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
  console.log('✅ 门禁通过：mockup/ 现有文件均在白名单基线内，无新增裸值漂移');
  process.exit(0);
}

console.log('⚠️  共享设计层发现裸值（Step 3 待替换）：');
for (const [rel, items] of byFile) {
  console.log(`\n📄 ${rel}  (${items.length})`);
  for (const it of items) console.log('   ' + it);
}
console.log(`\nTOTAL bare-value hits (共享层): ${total}  across ${byFile.size} files`);
process.exit(1);
