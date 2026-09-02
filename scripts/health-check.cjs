#!/usr/bin/env node
/**
 * health-check.cjs — 原型工程健康度全量检查（借鉴 1mao scripts/health-check.cjs）。
 *
 * 覆盖：
 *   1. 文件存在性（核心源码 / 插件文件 / 测试脚本）
 *   2. npm scripts 完整性
 *   3. npm run build（能构建）
 *   4. npm run test:all（统一测试门禁：smoke + regression + tools）
 *   5. TDZ 风险扫描（扫 src 下所有源码 .jsx/.js/.ts/.tsx，防「Cannot access before initialization」）
 *   6. dist 构建产物基线（借鉴 1mao safety-net：防 dist 意外增删/体积异常）
 *
 * 用法: node scripts/health-check.cjs        （或 npm run check:health）
 * 退出码: 有错误 → 1；仅警告 → 0
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
// 扩展名无关：TS 化期间源码后缀会在 .js/.jsx/.ts/.tsx 间漂移，写死后继扩展名的检查会在改名那刻误红
const { resolveSourceFile } = require('./ts-exts.cjs');

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
// 说明：源码条目【不写扩展名】——后缀会随 TS 化漂移（storageAdapter.js→.ts、groupNodes.js→.ts
// 已经把这项检查搞红过一次），统一走扩展名无关解析；非源码条目（css/插件文件/脚本）照旧写全名。
const files = [
  ['src/main', '入口'],
  ['src/App', '画布壳'],
  ['src/index.css', '全局样式'],
  ['src/components/base/config', 'API 地址统一入口（原 apiBase.js 已合并至此）'],
  ['src/components/base/storage/storageAdapter', '存储适配（chrome.storage）'],
  ['src/components/base/groupNodes', '编组算法'],
  ['public/manifest.json', '插件 manifest'],
  ['public/background.js', '插件 background'],
  ['public/icon16.png', '插件图标 16'],
  ['public/icon48.png', '插件图标 48'],
  ['public/icon128.png', '插件图标 128'],
  ['scripts/smoke_test.cjs', '冒烟测试'],
  ['tests/unit/nodes/ssrRegression.test', 'SSR 结构回归 (vitest)'],
  ['tests/unit/canvasAgentTools.test', 'Agent 工具单测 (vitest)'],
  ['tests/unit/demoPlan.test', 'demoPlan 规则 (vitest)'],
  ['scripts/run_all_tests.cjs', '统一门禁'],
  // 扩展名无关：根配置已随全仓 TS 化（.js→.ts，2026-09-02）。写死 .js 会在改名那刻误红，
  // 与上面源码条目同一处理（resolveSourceFile 自动命中 .ts/.js）。
  ['vite.config', '构建配置'],
  ['vitest.config', '单测配置'],
  ['playwright.config', 'E2E 配置'],
  ['tailwind.config', '样式令牌真相源'],
  // 注：postcss.config 刻意保持 .js（postcss-load-config@6 加载 .ts 需 ts-node），不加进清单。
];
const relOf = (p) => path.relative(ROOT, p).split(path.sep).join('/');
for (const [f, name] of files) {
  // 先按原样判存在（css / 插件文件 / 脚本等写全名的条目），不存在再走扩展名无关解析。
  //
  // ⚠️ 为什么不用 `path.extname(f) ? 存在性 : resolveSourceFile()` 的写法（2026-09-02 修正）：
  //   `path.extname('vite.config')` 返回 '.config'（truthy），会被当成「已写全扩展名」的条目，
  //   直接 existsSync 判 false → 根配置 TS 化后整项误红。点号文件名普遍存在（*.config / *.min 等），
  //   用 extname 是否为空来区分「写全名 vs 待解析」并不可靠。
  //   改成「原样存在即用，否则扩展名无关解析」后两类条目都成立，且保持「改名不误红」的初衷。
  const abs = path.join(ROOT, f);
  const hit = fs.existsSync(abs) ? f : resolveSourceFile(abs);
  check(`${name} (${hit === f ? f : hit ? relOf(hit) : f})`, !!hit);
}

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

// ── 4.1 存储键契约静态校验（裸 key 编译期拦截，对应架构 P0-1）──
console.log('\n🔑 存储键契约校验（npm run check:keys）');
try {
  execSync('npm run check:keys', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  check('check:keys (STORAGE_KEYS 裸 key 拦截)', true);
} catch (e) {
  check('check:keys', false, (e.stdout || e.message || '').slice(0, 160));
}

// ── 4.2 事件契约静态校验（裸事件名编译期拦截，对应架构 P0-1）──
console.log('\n📡 事件契约校验（npm run check:events）');
try {
  execSync('npm run check:events', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  check('check:events (EVENTS 裸事件名拦截)', true);
} catch (e) {
  check('check:events', false, (e.stdout || e.message || '').slice(0, 160));
}

// ── 4.3 节点类型契约静态校验（useNodePrefs 裸命名空间编译期拦截，对应架构 P0-1）──
console.log('\n🏷️ 节点类型契约校验（npm run check:node-types）');
try {
  execSync('npm run check:node-types', { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
  check('check:node-types (NODE_TYPES 裸 useNodePrefs 命名空间拦截)', true);
} catch (e) {
  check('check:node-types', false, (e.stdout || e.message || '').slice(0, 160));
}

// ── 5. TDZ 风险扫描（扫 src 下 .jsx/.js/.ts/.tsx）──
console.log('\n🛡️ TDZ 风险扫描（src/*.jsx|js|ts|tsx）');
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
    if (!/\.(jsx|js|ts|tsx)$/.test(e.name)) continue;
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

// ── 5.5 架构校验（循环依赖 + base 分层，check-arch.mjs）──
console.log('\n🏛 架构校验（no-circular + base 分层）');
try {
  execSync('node scripts/check-arch.mjs', { cwd: ROOT, stdio: 'pipe' });
  console.log('  ✅ 架构校验通过');
} catch (e) {
  const msg = e.stdout ? String(e.stdout) : e.message;
  check('架构校验', false, msg.split('\n').filter(Boolean).slice(-2).join(' | '));
}

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

console.log('\n═'.repeat(54));
console.log(`  结论: ${errors ? `❌ ${errors} 处错误` : '✅ 无错误'}${warns ? `，⚠️ ${warns} 处警告` : ''}`);
console.log('═'.repeat(54));
process.exit(errors ? 1 : 0);
