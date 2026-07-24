#!/usr/bin/env node
/**
 * 合并 agent 函数体重写 → App.js，带质量验收
 * 优化版: 修复增量写入失败时的全局灾难回滚 Bug，引入原子化文件状态管理。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TASK_DIR = 'docs/annotate-body-tasks';
const SRC = 'src/App.js';
const BAK = SRC + '.merge-bak';

if (process.argv.includes('--rollback')) {
  if (fs.existsSync(BAK)) { 
    fs.copyFileSync(BAK, SRC); 
    console.log('✅ 已回退至合并前的原始状态'); 
  } else {
    console.log('⚠️ 无备份文件，无法回退');
  }
  process.exit(0);
}

if (!fs.existsSync(SRC)) {
  console.error(`❌ 找不到源文件: ${SRC}`);
  process.exit(1);
}

fs.copyFileSync(SRC, BAK);
console.log(`📦 建立全局备份: ${BAK}\n`);

// ── 1. 读取所有 agent 提交 ──
const rewrites = [];
for (let n = 1; n <= 9; n++) {
  const f = path.join(TASK_DIR, `AB${String(n).padStart(2, '0')}.md`);
  if (!fs.existsSync(f)) continue;
  
  const fileContent = fs.readFileSync(f, 'utf-8');
  // 优化正则，适应更多样的 markdown 表格排版
  const blocks = [...fileContent.matchAll(/\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*```(?:js|javascript)?\r?\n([\s\S]*?)```/g)];
  
  for (const m of blocks) {
    rewrites.push({ 
      nodeType: m[1], 
      varName: m[2], 
      newBody: m[3].trim(), 
      source: `AB${String(n).padStart(2, '0')}` 
    });
  }
}
console.log(`📋 读取到 ${rewrites.length} 个重写结果，准备排队合并验证...\n`);

// ── 2. 逐个验收并写入 ──
let passed = 0, failed = 0;

for (const rw of rewrites) {
  // ── 验收 1: 必须有段落注释 ──
  if (!rw.newBody.includes('──')) {
    console.log(`❌ ${rw.nodeType}: 缺少段落注释 (──)，跳过`);
    failed++; 
    continue;
  }

  // 记录此次写入前的稳态代码，用于局部回退 (原子化回退机制)
  const lastStableContent = fs.readFileSync(SRC, 'utf-8');
  
  // 找原函数位置
  const oldPattern = new RegExp(`(?:function )?${rw.varName}\\s*(?:=\\s*Y\\.memo\\(\\(|\\()`);
  const oldMatch = lastStableContent.match(oldPattern);
  
  if (!oldMatch) { 
    console.log(`⚠️  ${rw.nodeType}: 找不到原函数定义 ${rw.varName}`); 
    failed++; 
    continue; 
  }

  const sIdx = lastStableContent.indexOf(oldMatch[0]);
  let depth = 1, idx = sIdx + oldMatch[0].length;
  
  // 跳过参数括号
  for (; idx < lastStableContent.length && depth > 0; idx++) {
    if (lastStableContent[idx] === '(') depth++; 
    else if (lastStableContent[idx] === ')') depth--;
  }
  
  while (idx < lastStableContent.length && lastStableContent[idx] !== '{') idx++;
  const bStart = idx; 
  depth = 1; 
  idx++;
  
  // 匹配函数体大括号
  for (; idx < lastStableContent.length && depth > 0; idx++) {
    if (lastStableContent[idx] === '{') depth++; 
    else if (lastStableContent[idx] === '}') depth--;
  }
  
  if (depth !== 0) {
    console.log(`❌ ${rw.nodeType}: 解析函数大括号匹配失败，跳过`);
    failed++; 
    continue;
  }
  
  const bEnd = idx;
  const oldBody = lastStableContent.slice(bStart + 1, bEnd - 1);

  // ── 验收 2: 防止核心结构丢失 ──
  const oldJsxTags = [...new Set(oldBody.match(/X\.jsxs?\(`(\w+)`/g) || [])];
  const newJsxTags = [...new Set(rw.newBody.match(/X\.jsxs?\(`(\w+)`/g) || [])];
  
  if (oldJsxTags.length > 0 && newJsxTags.length === 0) {
    console.log(`❌ ${rw.nodeType}: 新代码疑似丢失了底层 JSX 结构，拦截合并`);
    failed++; 
    continue;
  }

  // ── 执行合并并验证 ──
  const signature = lastStableContent.slice(sIdx, bStart + 1);
  const newContent = lastStableContent.slice(0, sIdx) + signature + '\n' + rw.newBody + '\n}' + lastStableContent.slice(bEnd);
  
  fs.writeFileSync(SRC, newContent);

  try {
    // 静默构建，只暴露关键错误
    execSync('npm run build', { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    console.log(`✅ ${rw.nodeType} (${rw.source}) — 构建验证通过`);
    passed++;
  } catch (e) {
    // 提取报错前 80 个字符，避免日志刷屏
    const errMsg = e.stdout ? e.stdout.split('\n').find(l => l.includes('Error:')) || e.message : e.message;
    console.log(`❌ ${rw.nodeType}: 构建失败，触发局部回退 — ${errMsg.slice(0, 80)}`);
    
    // 【核心修复】：只回滚本次合并，不污染之前已通过的记录
    fs.writeFileSync(SRC, lastStableContent);
    failed++; 
  }
}

// ── 3. 最终验收 ──
console.log(`\n🎯 结果: 成功合并 ${passed} 个 / 拦截失败 ${failed} 个 / 总计 ${rewrites.length} 个任务`);

try {
  execSync('node scripts/check-build.cjs', { stdio: 'inherit' });
  console.log('\n✅ 完整性检查通过。如果需要彻底放弃本次合并，请执行: node scripts/merge-rewrites.cjs --rollback');
} catch {
  console.log('\n⚠️  check-build 阶段存在警告（例如可能的 TDZ 风险），请检查日志。');
}