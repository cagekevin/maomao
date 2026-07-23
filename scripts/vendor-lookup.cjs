#!/usr/bin/env node
// vendor.js 诊断工具 — 查一个混淆名对应什么
// 用法: node scripts/vendor-lookup.cjs <name>
//       node scripts/vendor-lookup.cjs Dj        → 查 Dj 是啥
//       node scripts/vendor-lookup.cjs --imports → 列出所有 App.js 导入别名
const fs = require('fs');
// 用法: node scripts/vendor-lookup.cjs <name>
//       node scripts/vendor-lookup.cjs --imports     # 列出全部导入别名
const name = process.argv[2];

if (!name || name === '--imports') {
  // 列出 App.js 导入的 vendor 别名映射
  const app = fs.readFileSync('src/App.js', 'utf-8');
  const line2 = app.split('\n')[2]; // import from vendor.js
  const line3 = app.split('\n')[3]; // import from entry.js
  const matches = [...line2.matchAll(/(\w+)\s+as\s+(\w+)/g)];
  console.log(`App.js vendor 导入别名 (${matches.length} 个):\n`);
  console.log('vendor名 → App.js别名 → 可读名');
  console.log('─'.repeat(50));
  const mapping = {};
  try {
    for (const line of fs.readFileSync('docs/vendor-mapping.txt', 'utf-8').split('\n')) {
      const m = line.match(/^(\w+)\s*=\s*(.+)/);
      if (m) mapping[m[1]] = m[2].trim();
    }
  } catch {}
  for (const m of matches) {
    const vName = m[1], alias = m[2];
    const readable = mapping[vName] || '?';
    console.log(`${vName.padEnd(10)} → ${alias.padEnd(10)} → ${readable}`);
  }
  process.exit(0);
}

// 查单个名字
console.log(`🔍 查 "${name}"\n`);
const vendor = fs.readFileSync('src/vendor/vendor.js', 'utf-8');

// 1. 是不是 vendor 导出
const exportPattern = new RegExp(`(\\w+)\\s+as\\s+${name}\\b`, 'g');
let found = [...vendor.matchAll(exportPattern)];
if (found.length > 0) {
  console.log('✅ vendor.js 导出:');
  for (const m of found) {
    console.log(`   内部名 ${m[1]} → 导出为 ${name}`);
  }
}

// 2. 从 mapping 查
try {
  const mapping = {};
  for (const line of fs.readFileSync('docs/vendor-mapping.txt', 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)\s*=\s*(.+)/);
    if (m) mapping[m[1]] = m[2].trim();
  }
  if (mapping[name]) console.log(`   映射: ${mapping[name]}`);
} catch {}

// 3. 是不是被 App.js import
const app = fs.readFileSync('src/App.js', 'utf-8');
const importMatch = app.match(new RegExp(`${name}\\s+as\\s+(\\w+)`));
if (importMatch) {
  console.log(`   在 App.js 中别名: ${importMatch[1]}`);
  // grep usage count
  const alias = importMatch[1];
  const usageCount = (app.match(new RegExp('\\b' + alias + '\\b', 'g')) || []).length;
  console.log(`   使用次数: ${usageCount}`);
}

// 4. 是不是 App.js 模块级变量
const moduleMatch = app.match(new RegExp(`^(?:var|let|const|function)\\s+${name}\\b`, 'm'));
if (moduleMatch) console.log(`   App.js 模块级声明: ${moduleMatch[0]}`);

// 5. 在 vendor.js 中搜索内部名（非导出）
const internalPattern = new RegExp(`\\b${name}\\b`, 'g');
const internalMatches = [...vendor.matchAll(internalPattern)];
if (internalMatches.length > 0 && found.length === 0) {
  // show first match context
  const firstMatch = internalMatches[0];
  const start = Math.max(0, firstMatch.index - 100);
  const end = Math.min(vendor.length, firstMatch.index + 100);
  console.log(`\n🔸 vendor.js 内部变量 (非导出)，出现 ${internalMatches.length} 次`);
  console.log(`   上下文: ...${vendor.slice(start, end)}...`);
}

if (found.length === 0 && internalMatches.length === 0) {
  console.log('❌ 未找到，可能是构建产物中的 minified 临时变量');
}
