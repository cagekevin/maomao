#!/usr/bin/env node
/**
 * health-check.cjs — 原型工程健康度全量检查（借鉴 1mao scripts/health-check.cjs）。
 *
 * 覆盖：
 *   1. 文件存在性（核心源码 / 插件文件 / 测试脚本）
 *   2. npm scripts 完整性
 *   3. npm run build（能构建）
 *   4. npm run test:all（统一测试门禁：smoke + regression + tools）
 *   5. TDZ 风险扫描（扫 src 下所有 .jsx/.js，防「Cannot access before initialization」）
 *   6. dist 构建产物基线（借鉴 1mao safety-net：防 dist 意外增删/体积异常）
 *
 * 用法: node scripts/health-check.cjs        （或 npm run check:health）
 * 退出码: 有错误 → 1；仅警告 → 0
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SNAPSHOT = path.join(__dirname, 'dist-snapshot.json');

let errors = 0, warns = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) errors++;
};
const warn = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✅' : '⚠️'} ${label}${detail ? '  ' + detail : ''}`);
  if (!ok) warns++;
};

console.log('═'.repeat(54));
console.log('  原型工程健康度全量检查（react-nodes）');
console.log('═'.repeat(54));

// ── 1. 文件存在性 ──
console.log('\n📁 文件存在性');
const files = [
  ['src/main.jsx', '入口'],
  ['src/App.jsx', '画布壳'],
  ['src/index.css', '全局样式'],
  ['src/components/base/apiBase.js', 'API 地址统一入口'],
  ['src/components/base/storageAdapter.js', '存储适配（chrome.storage）'],
  ['src/components/base/groupNodes.js', '编组算法'],
  ['public/manifest.json', '插件 manifest'],
  ['public/background.js', '插件 background'],
  ['public/icon16.png', '插件图标 16'],
  ['public/icon48.png', '插件图标 48'],
  ['public/icon128.png', '插件图标 128'],
  ['scripts/smoke_test.cjs', '冒烟测试'],
  ['scripts/regression_test.cjs', '回归测试'],
  ['scripts/test_agent_tools.cjs', 'Agent 工具测试'],
  ['scripts/run_all_tests.cjs', '统一门禁'],
  ['vite.config.js', '构建配置'],
];
for (const [f, name] of files) check(`${name} (${f})`, fs.existsSync(path.join(ROOT, f)));

// ── 2. npm scripts ──
console.log('\n🔧 npm scripts');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
['dev', 'build', 'test:smoke', 'test:regression', 'test:tools', 'test:all'].forEach((s) =>
  check(`scripts.${s}`, !!pkg.scripts[s], `package.json 缺 scripts.${s}`)
);

// ── 3. 构建 ──
console.log('\n🏗️ 构建（npm run build）');
try {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
  check('npm run build', true);
} catch (e) {
  check('npm run build', false, (e.stdout || e.message || '').slice(0, 100));
}

// ── 4. 统一测试门禁 ──
console.log('\n🧪 统一测试门禁（test:all）');
try {
  execSync('node scripts/run_all_tests.cjs', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  check('test:all (smoke+regression+tools)', true);
} catch (e) {
  check('test:all', false, (e.stdout || e.message || '').slice(0, 120));
}

// ── 5. TDZ 风险扫描（扫 src 下 .jsx/.js）──
console.log('\n🛡️ TDZ 风险扫描（src/*.jsx/js）');
const tdzPatterns = [
  [/Cannot access '(\w+)' before initialization/g, 'TDZ 引用错误'],
  [/'(\w+)' is not defined/g, '未定义变量引用'],
  [/(\w+) is not a function/g, '非函数调用'],
];
let tdzHits = 0;
(function walkDir(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walkDir(p); continue; }
    if (!/\.(jsx|js)$/.test(e.name)) continue;
    const code = fs.readFileSync(p, 'utf-8');
    for (const [pattern, label] of tdzPatterns) {
      const m = [...code.matchAll(pattern)];
      if (m.length) {
        tdzHits += m.length;
        console.log(`  ⚠️ ${path.relative(ROOT, p)}: ${label} ${m.length} 处`);
      }
    }
  }
})(path.join(ROOT, 'src'));
if (tdzHits === 0) console.log('  ✅ 未扫描到典型 TDZ / 未定义 / 非函数调用');
else warn('TDZ 扫描', false, `${tdzHits} 处风险（仅提醒，不阻断）`);

// ── 6. dist 构建产物基线（借鉴 safety-net）──
console.log('\n📊 dist 构建产物基线');
const scanDist = (dir, prefix = '') => {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out[rel] = scanDist(p, rel);
    else out[rel] = { size: fs.statSync(p).size };
  }
  return out;
};

const current = scanDist(DIST);
if (!fs.existsSync(SNAPSHOT)) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2));
  console.log('  ℹ️ 已生成基线快照 scripts/dist-snapshot.json（首次运行仅记录）');
} else {
  const prev = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf-8'));
  const prevFlat = flatten(prev);
  const curFlat = flatten(current);
  let diffs = 0;
  const allKeys = new Set([...Object.keys(prevFlat), ...Object.keys(curFlat)]);
  for (const k of allKeys) {
    const a = prevFlat[k];
    const b = curFlat[k];
    if (a === undefined) { console.log(`  ⚠️ 新增: ${k}`); diffs++; }
    else if (b === undefined) { console.log(`  ⚠️ 删除: ${k}`); diffs++; }
    else if (Math.abs(a - b) > a * 0.1 + 1024) { console.log(`  ⚠️ 体积变化: ${k} ${a}B → ${b}B`); diffs++; }
  }
  if (diffs === 0) console.log('  ✅ dist 与基线一致（无新增/删除/显著体积变化）');
  else warn('dist 基线', false, `${diffs} 处差异（dist 已更新后请重新生成基线）`);
}

function flatten(obj, p = '', out = {}) {
  for (const k of Object.keys(obj)) {
    const key = p ? `${p}/${k}` : k;
    if (obj[k] && typeof obj[k] === 'object' && !obj[k].size) flatten(obj[k], key, out);
    else out[key] = obj[k].size;
  }
  return out;
}

console.log('\n═'.repeat(54));
console.log(`  结论: ${errors ? `❌ ${errors} 处错误` : '✅ 无错误'}${warns ? `，⚠️ ${warns} 处警告` : ''}`);
console.log('═'.repeat(54));
process.exit(errors ? 1 : 0);
