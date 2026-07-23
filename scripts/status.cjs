#!/usr/bin/env node
// 项目状态速览 — 开工前跑一下
const fs = require('fs');
const { execSync } = require('child_process');

console.log('╔══════════════════════════════════════╗');
console.log('║      猫猫AI画布 · 项目状态            ║');
console.log('╚══════════════════════════════════════╝\n');

// 1. App.js
const app = fs.readFileSync('src/App.js', 'utf-8');
const lines = app.split('\n').length;
const confirmed = (app.match(/✔ 已确认/g) || []).length;
const unknown = (app.match(/⚠️ 待确认/g) || []).length;
const semanticNodes = 27; // temporarily hardcoded

console.log('📦 App.js');
console.log(`   行数: ${lines.toLocaleString()}`);
console.log(`   函数: ${confirmed} ✔ / ${unknown} ⚠️`);
console.log(`   节点: ${semanticNodes = 27; // temporarily hardcoded

// 2. 映射表
const funcMap = fs.readFileSync('docs/func-mapping.txt', 'utf-8').split('\n').filter(l => l.match(/^\w+\s*=/)).length;
const varMap = fs.readFileSync('docs/var-mapping.txt', 'utf-8').split('\n').filter(l => l.match(/^\w+\s*=/)).length;
const vendorMap = fs.existsSync('docs/vendor-mapping.txt') ? fs.readFileSync('docs/vendor-mapping.txt', 'utf-8').split('\n').filter(l => l.match(/^\w+\s*=/)).length : 0;

console.log('\n📚 字典');
console.log(`   func-mapping: ${funcMap} 条   var-mapping: ${varMap} 条   vendor: ${vendorMap} 条`);

// 3. 构建产物
if (fs.existsSync('dist')) {
  const assets = fs.readdirSync('dist/assets');
  const engine = assets.find(f => f.startsWith('engine-') && f.endsWith('.js'));
  const vendor = assets.find(f => f.startsWith('vendor-legacy-'));
  if (engine) console.log(`\n🔨 dist: engine ${(fs.statSync('dist/assets/'+engine).size/1024).toFixed(0)}KB, vendor ${vendor?(fs.statSync('dist/assets/'+vendor).size/1024).toFixed(0):'?'}KB`);
}

// 4. Git
try {
  const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  const lastCommit = execSync('git log -1 --format="%h %s (%cr)"', { encoding: 'utf-8' }).trim();
  const ahead = execSync('git rev-list --count origin/main..HEAD 2>/dev/null || echo 0', { encoding: 'utf-8' }).trim();
  console.log(`\n📝 Git: ${branch} | ${lastCommit}`);
  if (parseInt(ahead) > 0) console.log(`   ⚠️  未推送: ${ahead} 个提交`);
} catch {}

// 5. 死代码
const deadBranches = (app.match(/false &&/g) || []).length;
const emptyReturns = (app.match(/return \[\]/g) || []).length;
console.log(`\n🧹 可清理: false&& x${deadBranches}  return[] x${emptyReturns}`);

console.log('\n── CLT 2026-07-24');
