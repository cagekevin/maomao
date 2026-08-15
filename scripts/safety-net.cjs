#!/usr/bin/env node
/**
 * safety-net.cjs — dist 构建产物基线快照与对比
 *
 * 用法:
 *   node scripts/safety-net.cjs --save   # 首次：保存基线快照
 *   node scripts/safety-net.cjs          # 后续：对比当前 dist 与基线
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST = path.resolve(__dirname, '..', 'dist');
const SNAPSHOT = path.resolve(__dirname, 'dist-snapshot.json');

function scanDist(dir = DIST, prefix = '') {
  const result = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const key = prefix + e.name;
    if (e.isDirectory()) {
      Object.assign(result, scanDist(full, key + '/'));
    } else if (e.name.endsWith('.js') || e.name.endsWith('.css')) {
      result[key] = fs.statSync(full).size;
    }
  }
  return result;
}

if (process.argv.includes('--save')) {
  const snapshot = {
    created: new Date().toISOString(),
    commit: execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim(),
    chunks: scanDist(),
  };
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
  const total = Object.keys(snapshot.chunks).length;
  console.log(`✅ 基线已保存: ${total} 个文件 → ${SNAPSHOT}`);
  process.exit(0);
}

if (!fs.existsSync(SNAPSHOT)) {
  console.error('❌ 无基线快照。请先运行: node scripts/safety-net.cjs --save');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
const current = scanDist();

const allKeys = new Set([...Object.keys(baseline.chunks), ...Object.keys(current)]);
let pass = 0, fail = 0, added = 0, removed = 0;

for (const k of allKeys) {
  const prev = baseline.chunks[k];
  const now = current[k];
  if (!prev) { console.log(`  ➕ 新增: ${k} (${(now / 1024).toFixed(1)} KB)`); added++; }
  else if (!now) { console.log(`  ➖ 移除: ${k}`); removed++; }
  else if (prev !== now) {
    const delta = now - prev;
    const sign = delta > 0 ? '+' : '';
    console.log(`  🔶 变化: ${k}  ${(prev / 1024).toFixed(1)} → ${(now / 1024).toFixed(1)} KB  (${sign}${(delta / 1024).toFixed(1)} KB)`);
    fail++;
  } else { pass++; }
}

console.log(`\n📊 结果: ${pass} 不变 / ${fail} 变化 / ${added} 新增 / ${removed} 移除`);
console.log(`   基线 commit: ${baseline.commit}\n`);

process.exit(fail + added + removed > 0 ? 1 : 0);
