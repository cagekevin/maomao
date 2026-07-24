#!/usr/bin/env node
/**
 * 构建后完整性检查 — 拦截常见错误、静态分析构建产物
 * 
 * 用法: npm run build && node scripts/check-build.cjs
 */
const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join('dist', 'assets');
const SRC_FILE = 'src/App.js';

// --- 0. 前置环境检查 ---
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ 找不到构建目录 dist/assets，请先运行 npm run build');
  process.exit(1);
}

if (!fs.existsSync(SRC_FILE)) {
  console.error(`❌ 找不到源文件 ${SRC_FILE}`);
  process.exit(1);
}

const files = fs.readdirSync(DIST_DIR);
const engine = files.find(f => f.startsWith('engine-') && f.endsWith('.js'));
const vendor = files.find(f => f.startsWith('vendor-legacy-') && f.endsWith('.js'));

if (!engine || !vendor) {
  console.error('❌ 在构建目录中找不到 engine-*.js 或 vendor-legacy-*.js 产物');
  process.exit(1);
}

// --- 读取文件内容 ---
const engineCode = fs.readFileSync(path.join(DIST_DIR, engine), 'utf-8');
const vendorCode = fs.readFileSync(path.join(DIST_DIR, vendor), 'utf-8');
const srcCode = fs.readFileSync(SRC_FILE, 'utf-8');

let issues = 0;
console.log('🚀 开始执行构建后完整性检查...\n' + '='.repeat(50));

// --- 1. 检查常见运行时错误签名 ---
console.log('🔍 检查 1: 常见运行时错误签名');
const dangerPatterns = [
  [/'(\w+)' is not defined/g, '未定义变量引用'],
  [/Cannot access '(\w+)' before initialization/g, 'TDZ 引用错误'],
  [/(\w+) is not a function/g, '非函数调用'],
  [/Cannot read propert\w+ '(\w+)' of null/g, 'null 属性访问'],
];

let hasPatternIssue = false;
for (const [pattern, label] of dangerPatterns) {
  const matches = [...engineCode.matchAll(pattern)];
  if (matches.length > 0) {
    hasPatternIssue = true;
    console.log(`  ⚠️  ${label}: 发现 ${matches.length} 处嫌疑`);
    const seen = new Set();
    for (const m of matches.slice(0, 5)) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        console.log(`     → 涉及变量/属性: ${name}`);
      }
    }
    issues++;
  }
}
if (!hasPatternIssue) console.log('  ✅ 未扫描到典型的错误抛出字符串');


// --- 2. 检查注释完整性 ---
console.log('\n🔍 检查 2: App.js 注释完整性');
const unknownCount = (srcCode.match(/⚠️ 待确认/g) || []).length;
if (unknownCount > 0) {
  console.log(`  ⚠️  存在 ${unknownCount} 个未确认函数，建议运行 annotate 脚本修复`);
  // 这里不算作阻断级 issue，仅做警告
} else {
  console.log('  ✅ 所有函数标注状态健康');
}


// --- 3. 构建产物短混淆名密度 ---
console.log('\n🔍 检查 3: 构建产物短名密度');
const shortVars = (engineCode.match(/\b[a-z]{1,2}\b/g) || []).length;
const density = ((shortVars / engineCode.length) * 100).toFixed(2);
console.log(`  短变量名: ${shortVars} 个 (代码占比 ${density}%) — 占比异常高时需检查 sourcemap/压缩配置`);


// --- 4. App.js 语法检查 ---
console.log('\n🔍 检查 4: App.js 语法分析');
try {
  const acorn = require('acorn');
  const jsx = require('acorn-jsx');
  const JsxParser = acorn.Parser.extend(jsx());
  
  JsxParser.parse(srcCode, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log('  ✅ AST 解析通过，无底层语法错误');
} catch (e) {
  // 如果缺少 acorn-jsx 会降级提示
  if (e.code === 'MODULE_NOT_FOUND') {
    console.log('  ⚠️  跳过语法检查：缺少依赖 acorn 或 acorn-jsx');
  } else {
    console.log(`  ❌ 解析失败: ${e.message}`);
    issues++;
  }
}


// --- 5. 构建产物大小 ---
console.log('\n🔍 检查 5: 构建产物体积评估');
function formatSize(bytes) {
  if (bytes > 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}
const es = fs.statSync(path.join(DIST_DIR, engine)).size;
const vs = fs.statSync(path.join(DIST_DIR, vendor)).size;
console.log(`  ✅ engine: ${formatSize(es)}`);
console.log(`  ✅ vendor: ${formatSize(vs)}`);


// --- 6. 模块声明顺序 TDZ (暂时性死区) 风险 ---
console.log('\n🔍 检查 6: TDZ 风险静态扫描');
const moduleDecls = [];
const lines = srcCode.split('\n');

for (let i = 0; i < lines.length; i++) {
  // 优化正则：允许更多的空格，提取变量名
  const m = lines[i].match(/^\s*(?:var|let|const|function)\s+(\w+)/);
  if (m) moduleDecls.push({ name: m[1], lineNum: i + 1, content: lines[i] });
}

let tdzCount = 0;
for (let i = 0; i < moduleDecls.length; i++) {
  const current = moduleDecls[i].content;
  if (current.includes('let ') || current.includes('const ')) {
    // 检查紧随其后的 10 个声明中，是否有函数调用了提前声明的变量
    for (let j = i + 1; j < Math.min(i + 10, moduleDecls.length); j++) {
      if (moduleDecls[j].content.includes('function') && moduleDecls[j].content.includes(moduleDecls[i].name)) {
        tdzCount++;
      }
    }
  }
}
console.log(tdzCount > 0 ? `  ⚠️  发现可能的 TDZ 风险: ${tdzCount} 处 (请检查 let/const 声明顺序)` : '  ✅ 无明显死区风险');


// --- 7. localTool 本地服务产物 (仅报告，不计入前端阻断级 issues) ---
console.log('\n🔍 检查 7: localTool 本地服务产物');
const ltDist = path.join('localTool', 'dist');
if (!fs.existsSync(ltDist)) {
  console.log('  ⚠️  localTool/dist 不存在，跳过（请先 cd localTool && npm run build）');
} else {
  const ltFiles = fs.readdirSync(ltDist).filter(f => f.endsWith('.js'));
  if (ltFiles.length === 0) {
    console.log('  ⚠️  localTool/dist 为空，可能未成功构建');
  }
  for (const f of ltFiles) {
    const fp = path.join(ltDist, f);
    const code = fs.readFileSync(fp, 'utf-8');
    let fileIssues = 0;
    for (const [pattern, label] of dangerPatterns) {
      const m = [...code.matchAll(pattern)];
      if (m.length) {
        fileIssues += m.length;
        console.log(`  ⚠️  ${f}: ${label} 嫌疑 ${m.length} 处`);
      }
    }
    const sz = formatSize(fs.statSync(fp).size);
    console.log(fileIssues === 0 ? `  ✅ ${f}: 无错误签名 (${sz})` : `  ➕ ${f}: 体积 ${sz}`);
  }
}


// --- 总结 ---
console.log(`\n${'='.repeat(50)}`);
if (issues === 0) {
  console.log('🎉 结论: 全部硬性检查通过，可安全部署！');
} else {
  console.log(`❌ 结论: 发现 ${issues} 个阻断级问题，请修复后重试。`);
  process.exit(1);
}