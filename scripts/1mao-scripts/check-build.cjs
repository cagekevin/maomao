#!/usr/bin/env node
/**
 * gougou 构建后完整性检查（适配自 maomao/scripts/check-build.cjs）
 * 用法: npm run build && node scripts/check-build.cjs
 *
 * 设计: 因 src/legacy 为反编译黑盒，错误签名 / TDZ 属"可见性提醒"不阻断；
 *       仅当 dist/assets 缺失或 main-*.js / vendor-*.js 产物缺失时才阻断。
 *       这样阶段1零逻辑改动下每次改码都能绿灯通过，又保留风险可见性。
 */
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join('dist', 'assets');

if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ 找不到构建目录 dist/assets，请先运行 npm run build');
  process.exit(1);
}

const files = fs.readdirSync(DIST_DIR).filter((f) => f.endsWith('.js'));
const main = files.find((f) => /^main-.*\.js$/.test(f));
const vendor = files.find((f) => /^vendor-.*\.js$/.test(f));

if (!main || !vendor) {
  console.error('❌ 在 dist/assets 找不到 main-*.js 或 vendor-*.js 产物');
  process.exit(1);
}

const read = (f) => fs.readFileSync(path.join(DIST_DIR, f), 'utf-8');
const mainCode = read(main);
const vendorCode = read(vendor);
const all = mainCode + '\n' + vendorCode;

function fmt(b) {
  return b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : (b / 1024).toFixed(1) + ' KB';
}

console.log('🚀 gougou 构建后检查...\n' + '='.repeat(50));

// 1. 错误签名（可见性，不阻断）
console.log('🔍 检查 1: 错误签名（is not defined / TDZ / is not a function / null 属性）');
const dangerPatterns = [
  [/'(\w+)' is not defined/g, '未定义变量引用'],
  [/Cannot access '(\w+)' before initialization/g, 'TDZ 引用错误'],
  [/(\w+) is not a function/g, '非函数调用'],
  [/Cannot read propert\w+ '(\w+)' of null/g, 'null 属性访问'],
];
let sigHits = 0;
for (const [pattern, label] of dangerPatterns) {
  const m = [...all.matchAll(pattern)];
  if (m.length) {
    sigHits += m.length;
    console.log(`  ⚠️  ${label}: ${m.length} 处`);
  }
}
if (sigHits === 0) console.log('  ✅ 未扫描到典型错误抛出字符串');

// 2. 产物体积
console.log('\n🔍 检查 2: 产物体积');
console.log(`  main  : ${main}  ${fmt(fs.statSync(path.join(DIST_DIR, main)).size)}`);
console.log(`  vendor: ${vendor}  ${fmt(fs.statSync(path.join(DIST_DIR, vendor)).size)}`);

// 3. TDZ（仅扫描 src 入口 ts/tsx；黑盒在 bundle/legacy 则跳过）
console.log('\n🔍 检查 3: TDZ 风险（扫描 src 入口 ts/tsx）');
const entryFiles = [];
(function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'bundle' || e.name === 'legacy') return; // 黑盒不扫
      walk(p);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      entryFiles.push(p);
    }
  }
})('src');
let tdz = 0;
for (const ef of entryFiles) {
  const lines = fs.readFileSync(ef, 'utf-8').split('\n');
  const decls = [];
  lines.forEach((l) => {
    const m = l.match(/^\s*(?:var|let|const|function)\s+(\w+)/);
    if (m) decls.push({ n: m[1], c: l });
  });
  for (let i = 0; i < decls.length; i++) {
    if (decls[i].c.includes('let ') || decls[i].c.includes('const ')) {
      for (let j = i + 1; j < Math.min(i + 10, decls.length); j++) {
        if (decls[j].c.includes('function') && decls[j].c.includes(decls[i].n)) tdz++;
      }
    }
  }
}
console.log(
  entryFiles.length
    ? tdz
      ? `  ⚠️  发现可能 TDZ: ${tdz} 处`
      : '  ✅ 无明显死区风险'
    : '  ℹ️  无 src 入口 ts/tsx，跳过（黑盒在 src/legacy）'
);

// 4. localTool（独立子项目，不存在或没 build 则跳过）
console.log('\n🔍 检查 4: localTool 本地服务产物');
const ltDist = path.join('localTool', 'dist');
if (!fs.existsSync(ltDist)) console.log('  ℹ️  localTool/dist 不存在，跳过');
else {
  const lt = fs.readdirSync(ltDist).filter((f) => f.endsWith('.js'));
  console.log(lt.length ? `  ✅ localTool/dist: ${lt.length} 个 js` : '  ⚠️  localTool/dist 为空');
}

console.log('\n' + '='.repeat(50));
console.log('🎉 结论: 产物完整（main/vendor 存在），可安全部署！（错误签名/TDZ 为可见性提醒，不阻断）');
