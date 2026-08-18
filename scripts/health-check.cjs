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

// ── 7. 决策渠道门禁（ADR 必须为空；CLAUDE 决策铁律必须存在）──
// 硬约束：docs/adr/ 非本项目决策渠道（见 CLAUDE.md「🔒 决策记录铁律」）。
// 若出现 ADR 文件 → error 阻断；若决策铁律被误删 → error 阻断。不靠 AI 自觉，靠门禁拦截。
console.log('\n🔒 决策渠道门禁');
const adrDir = path.join(ROOT, 'docs/adr');
const adrFiles = fs.existsSync(adrDir)
  ? fs.readdirSync(adrDir).filter((f) => /\.md$/.test(f))
  : [];
check('docs/adr/ 无 ADR 文件（决策渠道 = CONTEXT + 代码注释）', adrFiles.length === 0, adrFiles.length ? `发现: ${adrFiles.join(', ')}` : '');

const claude = fs.existsSync(path.join(ROOT, 'CLAUDE.md')) ? fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8') : '';
check('CLAUDE.md 含「决策记录铁律」', /决策记录铁律/.test(claude), '铁律被删除会破坏决策渠道一致性');

// ── 8. 契约护栏扫描（预防写码绕过唯一入口）──
// 扫「CONTEXT §二 已定义唯一入口 / §五 铁律」的绕过点，让 AI 写码后立即看到，
// 当场改对 → 后期无需收口。设计为 warning（提示不阻断）：可能含合法/待确认场景，
// 需人工核对；但能让后续 AI 一眼看到「这里绕过了 idGen / previewUrl / clipboard」。
// 合法白名单（本身就是唯一入口实现 / 外部仓库 / 非 ID 用途的随机数）在排除列表中。
console.log('\n🧱 契约护栏扫描（绕过唯一入口预防）');
const scanFiles = (() => {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(jsx|js|ts|tsx)$/.test(e.name)) continue;
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      out.push({ rel, code: fs.readFileSync(p, 'utf-8') });
    }
  })(path.join(ROOT, 'src'));
  return out;
})();
const isIn = (rel, patterns) => patterns.some((p) => rel.includes(p));
// 唯一入口实现本身 / 外部仓库 / 测试，不扫
const IGNORE = ['/idGen.js', '/previewUrl.js', '/clipboard.js', '/logger.js', '/director3d/', '/videoEngine.js'];
// 契约护栏白名单：登记「已判定有意排除」的绕过点（带原因，防误报；新增排除点在此登记，
// 不靠散落注释——见 CONTEXT §二⑤ / §六 决策渠道）。格式：{ rel, reason }
const CONTRACT_WHITELIST = [
  // VideoProcessNode 的 GIF 产物 URL 喂给 spawnGifNode 作持久节点源，非「组件预览」，不收 previewUrl
  { rel: 'src/components/VideoProcessNode.jsx', reason: 'GIF 跨节点持久化产物，非预览语义' },
];

// 1) ID 绕道：应走 idGen.generateId（CONTEXT §五 ID 铁律 + §六#6）
const idBypass = [];
for (const { rel, code } of scanFiles) {
  if (isIn(rel, IGNORE)) continue;
  if (/Date\.now\(\)\.toString\(\)|'sc-'\s*\+\s*Date\.now\(\)\.toString\(36\)/.test(code)) idBypass.push(rel);
}
if (idBypass.length === 0) console.log('  ✅ ID 生成无绕过（均走 idGen.generateId）');
else warn('ID 绕道', false, `发现 ${idBypass.length} 处，应改走 base/idGen.js generateId：\n     - ${idBypass.join('\n     - ')}`);

// 2) 预览 URL 绕道：预览场景应走 previewUrl（CONTEXT §二⑤）
const previewBypass = [];
for (const { rel, code } of scanFiles) {
  if (isIn(rel, IGNORE)) continue;
  // 白名单内 = 已判定有意排除（带原因，见 CONTRACT_WHITELIST）
  const wl = CONTRACT_WHITELIST.find((w) => rel.includes(w.rel));
  if (wl) { console.log(`  ℹ️ 排除(已登记): ${rel}（${wl.reason}）`); continue; }
  const m = [...code.matchAll(/URL\.createObjectURL/g)];
  if (m.length) previewBypass.push(`${rel}（${m.length} 处）`);
}
if (previewBypass.length === 0) console.log('  ✅ 预览 URL 无绕过（均走 previewUrl）');
else warn('预览 URL 绕道', false, `发现 ${previewBypass.length} 处，预览场景应走 base/previewUrl.js（下载/持久化/外部仓库除外）：\n     - ${previewBypass.join('\n     - ')}`);

console.log('\n═'.repeat(54));
console.log(`  结论: ${errors ? `❌ ${errors} 处错误` : '✅ 无错误'}${warns ? `，⚠️ ${warns} 处警告` : ''}`);
console.log('═'.repeat(54));
process.exit(errors ? 1 : 0);
