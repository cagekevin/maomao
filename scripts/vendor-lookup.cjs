#!/usr/bin/env node
/**
 * vendor.js 诊断工具 — 查一个混淆名对应什么
 * 
 * 用法: 
 *   node scripts/vendor-lookup.cjs <name>    # 查某个变量是啥，例如 Dj
 *   node scripts/vendor-lookup.cjs --imports # 列出所有 App.js 导入别名
 */
const fs = require('fs');
const path = require('path');

const name = process.argv[2];

if (!name) {
  console.log('❌ 请提供要查询的名称，或者使用 --imports 参数');
  process.exit(1);
}

const APP_PATH = 'src/App.js';
const VENDOR_PATH = 'src/vendor/vendor.js';
const MAPPING_PATH = 'docs/vendor-mapping.txt';

// --- 辅助函数：统一加载映射 ---
function loadMapping() {
  const mapping = {};
  try {
    if (fs.existsSync(MAPPING_PATH)) {
      for (const line of fs.readFileSync(MAPPING_PATH, 'utf-8').split('\n')) {
        const m = line.match(/^(\w+)\s*=\s*(.+)/);
        if (m) mapping[m[1]] = m[2].trim();
      }
    }
  } catch {}
  return mapping;
}

// ==========================================
// 模式 1: 列出所有导入
// ==========================================
if (name === '--imports') {
  if (!fs.existsSync(APP_PATH)) {
    console.error(`❌ 找不到文件: ${APP_PATH}`);
    process.exit(1);
  }

  const app = fs.readFileSync(APP_PATH, 'utf-8');
  const line2 = app.split('\n')[2] || ''; 
  const matches = [...line2.matchAll(/(\w+)\s+as\s+(\w+)/g)];
  const mapping = loadMapping();

  console.log(`📦 App.js vendor 导入别名 (共 ${matches.length} 个):\n`);
  console.log('vendor名'.padEnd(12) + 'App.js别名'.padEnd(12) + '可读名');
  console.log('─'.repeat(50));
  
  for (const m of matches) {
    const vName = m[1], alias = m[2];
    const readable = mapping[vName] || '❓未知';
    console.log(`${vName.padEnd(12)} ${alias.padEnd(12)} ${readable}`);
  }
  process.exit(0);
}

// ==========================================
// 模式 2: 查询单个名称
// ==========================================
console.log(`🔍 开始查询 "${name}"\n`);

if (!fs.existsSync(VENDOR_PATH) || !fs.existsSync(APP_PATH)) {
  console.error('❌ 缺失必要的源文件 (App.js 或 vendor.js)，请检查目录结构。');
  process.exit(1);
}

const vendor = fs.readFileSync(VENDOR_PATH, 'utf-8');
const app = fs.readFileSync(APP_PATH, 'utf-8');
const mapping = loadMapping();

// 1. 查 vendor 导出
const exportPattern = new RegExp(`(\\w+)\\s+as\\s+${name}\\b`, 'g');
const found = [...vendor.matchAll(exportPattern)];
if (found.length > 0) {
  console.log('✅ 发现 vendor.js 显式导出:');
  for (const m of found) {
    console.log(`   内部真实名: ${m[1]} → 导出暴露为: ${name}`);
  }
}

// 2. 查 mapping 字典
if (mapping[name]) {
  console.log(`   📚 字典映射: ${mapping[name]}`);
}

// 3. 查 App.js Import 引用情况
const importMatch = app.match(new RegExp(`${name}\\s+as\\s+(\\w+)`));
if (importMatch) {
  const alias = importMatch[1];
  const usageCount = (app.match(new RegExp(`\\b${alias}\\b`, 'g')) || []).length;
  console.log(`   🔗 App.js 导入别名: ${alias}`);
  console.log(`   📈 App.js 使用次数: ${usageCount} 次`);
}

// 4. 查 App.js 本地模块级声明
const moduleMatch = app.match(new RegExp(`^(?:var|let|const|function)\\s+${name}\\b`, 'm'));
if (moduleMatch) {
  console.log(`   📦 App.js 本地模块声明: ${moduleMatch[0]}`);
}

// 5. 查 vendor.js 内部使用 (仅在非导出时提示)
const internalPattern = new RegExp(`\\b${name}\\b`, 'g');
const internalMatches = [...vendor.matchAll(internalPattern)];
if (internalMatches.length > 0 && found.length === 0) {
  const firstMatch = internalMatches[0];
  const start = Math.max(0, firstMatch.index - 50);
  const end = Math.min(vendor.length, firstMatch.index + 50);
  console.log(`\n🔸 vendor.js 内部变量 (非暴露导出)，共出现 ${internalMatches.length} 次`);
  console.log(`   上下文预览: ...${vendor.slice(start, end).replace(/\n/g, ' ')}...`);
}

if (found.length === 0 && internalMatches.length === 0 && !moduleMatch) {
  console.log('❌ 未找到任何匹配项。这可能是构建产物中的 minified 临时局部变量。');
}