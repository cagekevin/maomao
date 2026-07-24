#!/usr/bin/env node
/**
 * 项目状态速览 — 开工前跑一下
 * 优化版: 增强文件校验、优化正则匹配性能、动态时间戳
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('╔══════════════════════════════════════╗');
console.log('║      猫猫AI画布 · 项目状态            ║');
console.log('╚══════════════════════════════════════╝\n');

// --- 辅助函数：安全读取文件行数 ---
function countLines(filePath, filterRegex = null) {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!filterRegex) return content.split('\n').length;
  return content.split('\n').filter(l => filterRegex.test(l)).length;
}

// 1. App.js 状态
const APP_PATH = 'src/App.js';
let lines = 0, confirmed = 0, unknown = 0, semanticNodes = 0;
let deadBranches = 0, emptyReturns = 0;

if (fs.existsSync(APP_PATH)) {
  const app = fs.readFileSync(APP_PATH, 'utf-8');
  lines = app.split('\n').length;
  
  // 使用正则迭代器提升大文件匹配性能
  const countMatches = (regex) => (app.match(regex) || []).length;
  
  confirmed = countMatches(/✔ 已确认/g);
  unknown = countMatches(/⚠️ 待确认/g);
  semanticNodes = countMatches(/\\w*NodeComp\\w*|CropNodeComp/g);
  
  // 死代码检查
  deadBranches = countMatches(/false &&/g);
  emptyReturns = countMatches(/return \[\]/g);
}

console.log('📦 App.js');
console.log(`   行数: ${lines.toLocaleString()}`);
console.log(`   函数: ${confirmed} ✔ / ${unknown} ⚠️`);
console.log(`   节点: ${semanticNodes}/27 语义化`);

// 2. 映射表字典状态
const funcMap = countLines('docs/func-mapping.txt', /^\w+\s*=/);
const varMap = countLines('docs/var-mapping.txt', /^\w+\s*=/);
const vendorMap = countLines('docs/vendor-mapping.txt', /^\w+\s*=/);

console.log('\n📚 字典');
console.log(`   func-mapping: ${funcMap} 条   var-mapping: ${varMap} 条   vendor: ${vendorMap} 条`);

// 3. 构建产物状态
const distPath = 'dist/assets';
if (fs.existsSync(distPath)) {
  const assets = fs.readdirSync(distPath);
  const engine = assets.find(f => f.startsWith('engine-') && f.endsWith('.js'));
  const vendor = assets.find(f => f.startsWith('vendor-legacy-') && f.endsWith('.js'));
  
  if (engine) {
    const eSize = (fs.statSync(`${distPath}/${engine}`).size / 1024).toFixed(0);
    const vSize = vendor ? (fs.statSync(`${distPath}/${vendor}`).size / 1024).toFixed(0) : '?';
    console.log(`\n🔨 dist: engine ${eSize}KB, vendor ${vSize}KB`);
  }
}

// 4. Git 状态
try {
  const branch = execSync('git branch --show-current', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const lastCommit = execSync('git log -1 --format="%h %s (%cr)"', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  console.log(`\n📝 Git: ${branch} | ${lastCommit}`);
  
  try {
    const ahead = execSync('git rev-list --count origin/main..HEAD 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (parseInt(ahead) > 0) console.log(`   ⚠️  未推送: ${ahead} 个提交`);
  } catch {} // 忽略 upstream 未设置等错误
} catch {
  console.log('\n📝 Git: 获取状态失败 (可能非 Git 仓库)');
}

// 4.5 localTool 本地服务状态
console.log('\n📦 localTool (本地服务 :18080)');
const LT_SRC = 'localTool/src';
const LT_DIST = 'localTool/dist/index.js';
if (fs.existsSync(LT_SRC)) {
  let ltLines = 0;
  let newestSrc = 0;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.ts')) {
        ltLines += fs.readFileSync(p, 'utf-8').split('\n').length;
        newestSrc = Math.max(newestSrc, fs.statSync(p).mtimeMs);
      }
    }
  })(LT_SRC);
  console.log(`   src: ${ltLines.toLocaleString()} 行`);
  if (fs.existsSync(LT_DIST)) {
    console.log(fs.statSync(LT_DIST).mtimeMs >= newestSrc
      ? '   dist: 已构建 (与 src 同步) ✅'
      : '   dist: 已构建但落后于 src，需重新 build ⚠️');
  } else {
    console.log('   dist: 未构建 (请 cd localTool && npm run build) ⚠️');
  }
} else {
  console.log('   未找到 localTool/src，跳过');
}

// 5. 待清理项与时间戳
console.log(`\n🧹 可清理: false&& x${deadBranches}  return[] x${emptyReturns}`);
const today = new Date().toISOString().split('T')[0];
console.log(`\n── CLT ${today}`);