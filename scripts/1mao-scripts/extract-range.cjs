#!/usr/bin/env node
/**
 * extract-range.cjs — 按「内容标记」从 src/bundle 文件安全删除一段代码（引擎拆分删残余用）
 *
 * 为什么不用行号：大段删除后行号会漂移，跨多次删除时行号不可靠。
 * 改用「起始标记 + 结束标记」定位区间，标记是内容本身，删除后仍可重新定位。
 *
 * 用法:
 *   node scripts/extract-range.cjs --preview <file> <startMarker> [endMarker]
 *   node scripts/extract-range.cjs --delete  <file> <startMarker> [endMarker]
 *   node scripts/extract-range.cjs --check   <file> <startMarker> [endMarker]   # 校验区间仍存在且语法OK
 *
 * 说明:
 *   - file 相对 src/bundle 的路径（如 httpClient-BknZwXjG_components/H_.jsx）
 *   - startMarker 删除区间的起始标记（该行保留/删除视 --whole-line）
 *   - endMarker   结束标记；缺省则只删 startMarker 所在行
 *   - --whole-line：把 startMarker/endMarker 所在整行包含进删除（默认只删标记之间）
 *   - 删除前自动备份到 scripts/extract-range-backup/<hash>.bak，可手工恢复
 *   - --delete 后自动做 JS 语法校验，失败则中止并提示恢复
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'src', 'bundle');
const BACKUP = path.join(__dirname, 'extract-range-backup');

const args = process.argv.slice(2);
const mode = args[0];
if (!['--preview', '--delete', '--check'].includes(mode)) {
  console.error('用法: node scripts/extract-range.cjs [--preview|--delete|--check] <file> <startMarker> [endMarker] [--whole-line]');
  process.exit(1);
}
let i = 1;
const fileArg = args[i++];
const startMarker = args[i++];
let endMarker = args[i++];
const wholeLine = args.includes('--whole-line');
if (!fileArg || !startMarker) {
  console.error('❌ 缺 file 或 startMarker');
  process.exit(1);
}
const filePath = path.join(BUNDLE, fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`❌ 文件不存在: ${filePath}`);
  process.exit(1);
}

function lineOf(content, idx) {
  return content.slice(0, idx).split('\n').length;
}
function syntaxOk(js) {
  try { new Function(js); return true; } catch { return false; }
}

const content = fs.readFileSync(filePath, 'utf-8');
const sIdx = content.indexOf(startMarker);
if (sIdx === -1) {
  console.error(`❌ 未找到起始标记: ${startMarker}`);
  process.exit(1);
}
let eIdx = -1;
let eEnd = -1;
if (endMarker) {
  const searchFrom = sIdx + startMarker.length;
  eIdx = content.indexOf(endMarker, searchFrom);
  if (eIdx === -1) {
    console.error(`❌ 在起始标记之后未找到结束标记: ${endMarker}`);
    process.exit(1);
  }
  eEnd = eIdx + endMarker.length;
} else {
  eEnd = sIdx + startMarker.length;
}

let delStart = sIdx, delEnd = eEnd;
if (wholeLine) {
  // 起始标记所在行的行首
  delStart = content.lastIndexOf('\n', sIdx) + 1;
  // 结束标记所在行的行尾
  const nl = content.indexOf('\n', eEnd);
  delEnd = nl === -1 ? content.length : nl + 1;
}
const removed = content.slice(delStart, delEnd);
const lineStart = lineOf(content, delStart);
const lineEnd = lineOf(content, Math.min(delEnd, content.length - 1));
console.log(`📍 区间: L${lineStart}-L${lineEnd} (${removed.split('\n').length} 行, ${removed.length} 字符)`);
console.log(`   --- 起始行: ${content.slice(delStart, delStart + 60).split('\n')[0]}`);
if (endMarker) console.log(`   --- 结束行: ${removed.trimEnd().split('\n').pop()}`);
if (mode === '--preview') {
  console.log('   (preview 模式，未改动)');
  process.exit(0);
}

if (mode === '--check') {
  const result = content.slice(0, delStart) + content.slice(delEnd);
  const ok = syntaxOk(result);
  console.log(ok ? '✅ 区间存在，删除后语法 OK' : '🔶 区间存在，但删除后语法会破坏（请勿 --delete）');
  process.exit(ok ? 0 : 1);
}

// --delete
if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });
const hash = require('crypto').createHash('sha1').update(fileArg + '@' + Date.now()).digest('hex').slice(0, 10);
const bakPath = path.join(BACKUP, `${path.basename(filePath)}-${hash}.bak`);
fs.copyFileSync(filePath, bakPath);
console.log(`💾 已备份原文件 → ${bakPath}`);

const newContent = content.slice(0, delStart) + content.slice(delEnd);
if (!syntaxOk(newContent)) {
  console.error('❌ 删除后 JS 语法校验失败，已中止，未写回！');
  console.error(`   恢复: copy ${bakPath} ${filePath}`);
  process.exit(1);
}
fs.writeFileSync(filePath, newContent);
console.log(`✅ 已删除 L${lineStart}-L${lineEnd} 并写回，语法校验通过。`);
console.log(`   如需恢复: copy ${bakPath} ${filePath}`);
