#!/usr/bin/env node
// 构建后完整性检查 — 不用 Chrome，检查常见问题
// 用法: npm run build && node scripts/check-build.cjs

const fs = require('fs');
const path = require('path');

const DIST = 'dist';
const engine = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.startsWith('engine-') && f.endsWith('.js'));
const vendor = fs.readdirSync(path.join(DIST, 'assets')).find(f => f.startsWith('vendor-legacy-') && f.endsWith('.js'));

if (!engine || !vendor) {
  console.error('❌ 找不到构建产物');
  process.exit(1);
}

const engineCode = fs.readFileSync(path.join(DIST, 'assets', engine), 'utf-8');
const vendorCode = fs.readFileSync(path.join(DIST, 'assets', vendor), 'utf-8');
const srcCode = fs.readFileSync('src/App.js', 'utf-8');

let issues = 0;

// 1. 检查是否包含常见的 undefined 引用
console.log('🔍 检查 1: 常见运行时错误签名...');
const dangerPatterns = [
  [/'(\w+)' is not defined/g, '未定义变量引用'],
  [/Cannot access '(\w+)' before initialization/g, 'TDZ 引用错误'],
  [/(\w+) is not a function/g, '非函数调用'],
  [/Cannot read propert\w+ '(\w+)' of null/g, 'null 属性访问'],
];

for (const [pattern, label] of dangerPatterns) {
  const matches = [...engineCode.matchAll(pattern)];
  if (matches.length > 0) {
    console.log(`  ⚠️  ${label}: ${matches.length} 处`);
    const seen = new Set();
    for (const m of matches.slice(0, 5)) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        console.log(`     → ${name}`);
      }
    }
    issues++;
  }
}

// 2. 检查 App.js 注释中是否有残留的 ⚠️ 待确认
console.log('\n🔍 检查 2: 注释完整性...');
const unknownCount = (srcCode.match(/⚠️ 待确认/g) || []).length;
if (unknownCount > 0) {
  console.log(`  ⚠️  还有 ${unknownCount} 个未确认函数，需运行 annotate`);
} else {
  console.log('  ✅ 全部函数已标注');
}

// 3. 检查构建产物中的短混淆名数量（如果太多说明映射不完整）
console.log('\n🔍 检查 3: 构建产物短名密度...');
const shortVars = (engineCode.match(/\b[a-z]{1,2}\b/g) || []).length;
const density = (shortVars / engineCode.length * 100).toFixed(1);
console.log(`  短变量名: ${shortVars} 个 (${density}%) — 越低越好`);

// 4. App.js 语法检查
console.log('\n🔍 检查 4: App.js 语法...');
try {
  require('acorn').Parser.parse(srcCode, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log('  ✅ 语法正确');
} catch (e) {
  console.log(`  ❌ ${e.message}`);
  issues++;
}

// 5. 构建产物大小
console.log('\n🔍 检查 5: 构建产物大小...');
const es=fs.statSync(path.join(DIST,"assets",engine)).size; const vs=fs.statSync(path.join(DIST,"assets",vendor)).size; console.log(`  engine: ${(es/1024).toFixed(0)} KB  vendor: ${(vs/1024).toFixed(0)} KB`);

// 6. 模块声明顺序 TDZ 风险
console.log('\n🔍 检查 6: TDZ 风险...');
const moduleDecls = [];
let lineNum = 0;
for (const line of srcCode.split('\n')) {
  lineNum++;
  const m = line.match(/^(?:var|let|const|function)\s+(\w+)/);
  if (m) moduleDecls.push({ name: m[1], num: lineNum, line });
}
let tdzCount = 0;
for (let i = 0; i < moduleDecls.length; i++) {
  if (moduleDecls[i].line.includes('var ') || moduleDecls[i].line.includes('let ') || moduleDecls[i].line.includes('const ')) {
    for (let j = i + 1; j < Math.min(i + 10, moduleDecls.length); j++) {
      if (moduleDecls[j].line.includes('function') && moduleDecls[j].line.includes(moduleDecls[i].name)) {
        tdzCount++;
      }
    }
  }
}
console.log(tdzCount > 0 ? `  ⚠️  可能的 TDZ 风险: ${tdzCount} 处` : '  ✅ 无明显风险');

// 总结
console.log(`\n${'='.repeat(50)}`);
if (issues === 0) {
  console.log('✅ 全部检查通过，可安全部署');
} else {
  console.log(`❌ ${issues} 个问题需处理`);
  process.exit(1);
}
