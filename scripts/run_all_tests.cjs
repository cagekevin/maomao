'use strict';
// 统一质量门禁：按角色筛选测试，避免改一块代码却把前后端全量都跑一遍。
// 任一项失败即整体退出码 1，供 CI / 提交 / 交付前作为门禁。
// 用法：
//   node scripts/run_all_tests.cjs         全量（CI / 交付前，约 60s）：冒烟 + 前端 Vitest + localtool
//   node scripts/run_all_tests.cjs --frontend   只跑前端（约 47s）：冒烟 + 前端 Vitest 全量
//   node scripts/run_all_tests.cjs --localtool  只跑 localtool（约 9s）：localTool 类型检查 + 单元测试
// 日常分工：改前端用 --frontend，改 localtool 用 --localtool，交付/CI 用默认全量。
// 注：前端 Vitest 全量约 44s 主要是 177 个文件的收集/初始化固有开销，日常可用
//     `npm run test:unit -- --changed` 或 `vitest` watch 只跑改动相关文件。
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('node:url');
const ROOT = path.resolve(__dirname, '..');
const LOCALTOOL = path.join(ROOT, 'localTool');

const MODE = process.argv.includes('--frontend')
  ? 'frontend'
  : process.argv.includes('--localtool')
    ? 'localtool'
    : 'all';

// 直接定位 vitest bin，避免经 npx/npm 包装在 spawnSync 无 TTY 下出现 stdout 丢失 / 退出码异常。
// 优先用 vitest.mjs（node 可直接执行），Windows 的 .cmd 包装不能用 node 跑。
function findVitestBin() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'),
    path.join(ROOT, 'node_modules', '.bin', 'vitest' + (process.platform === 'win32' ? '.cmd' : '')),
  ];
  return candidates.find((p) => fs.existsSync(p)) || 'vitest';
}

// 门禁套件说明：
//  - L2 vitest run 已是全量（含 canvasAgentTools 工具层单测），不再单独起 esbuild 进程。
//  - SSR 结构回归（原 regression_test.cjs 的 esbuild-CJS 版）已迁为 vitest 用例
//    tests/unit/nodes/ssrRegression.test.ts，直接用 vitest 跑，消除 "import.meta is not available
//    with cjs" 警告（vitest 原生支持 import.meta.env / ESM，无需 esbuild CJS 黑魔法）。
// 自行展开 localTool 测试文件：spawnSync 不经 shell，`test/*.test.js` 不会被展开，
// 而 Node 20 的 --test 也不支持 glob 参数（Node 21+ 才有）。
function listLocalToolTests() {
  const dir = path.join(LOCALTOOL, 'test');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('test', f));
}

// 直接给 tsx 装载器的绝对 file:// URL：`--import tsx` 这种包名写法在 spawnSync
// 下依赖被调进程的解析根目录，显式给路径最稳。
function localToolTestSuite() {
  const tsxLoader = path.join(LOCALTOOL, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  const tscBin = path.join(LOCALTOOL, 'node_modules', 'typescript', 'bin', 'tsc');
  const files = listLocalToolTests();
  const missing = [tsxLoader, tscBin].filter((p) => !fs.existsSync(p));
  if (missing.length || files.length === 0) {
    return [{
      name: 'localTool 类型检查 + 单元测试',
      skip: `localTool 依赖缺失或未找到用例，请先执行: cd localTool && npm install（缺少: ${missing.length ? missing.map((p) => path.basename(p)).join(', ') : '无'}）`,
    }];
  }
  return [
    { name: 'localTool 类型检查 (tsc --noEmit)', cmd: process.execPath, args: [tscBin, '--noEmit'], cwd: LOCALTOOL },
    { name: 'localTool 单元测试 (node:test + tsx)', cmd: process.execPath, args: ['--import', pathToFileURL(tsxLoader).href, '--test', ...files], cwd: LOCALTOOL },
  ];
}

// 按角色筛选套件：
//  - frontend：冒烟（前端 JSX/节点注册静态扫描）+ 前端 Vitest 全量
//  - localtool：仅 localTool（独立子项目，自含 tsc + node:test）
//  - all     ：两者全跑（CI / 交付前）
const suites = [];
if (MODE === 'frontend' || MODE === 'all') {
  suites.push({ name: '冒烟测试 (Tier 2)', cmd: 'node', args: ['scripts/smoke_test.cjs'] });
  suites.push({
    name: '前端 L2/L3 纯逻辑+工具单测 (Vitest, 全量)',
    cmd: process.execPath,
    args: [findVitestBin(), 'run'],
  });
}
if (MODE === 'localtool' || MODE === 'all') {
  // localTool 此前未纳入统一门禁：改动后端源码时 `npm run test:all` 全绿也照漏。
  // 此处补齐类型检查 + 单元测试（最快 ~9s，是后端门禁性价比最高的部分）。
  suites.push(...localToolTestSuite());
}

let allPass = true;
const MODE_LABEL = { frontend: '前端', localtool: 'localtool', all: '全量（前端 + localtool）' }[MODE];
console.log('================================================');
console.log(`  统一测试门禁 · ${MODE_LABEL}`);
console.log('================================================');
for (const s of suites) {
  if (s.skip) {
    console.log(`\n--- ${s.name}: SKIP ---`);
    console.log(`    ${s.skip}`);
    continue;
  }
  const r = spawnSync(s.cmd, s.args, { cwd: s.cwd || ROOT, encoding: 'utf8' });
  const ok = r.status === 0;
  allPass = allPass && ok;
  console.log(`\n--- ${s.name}: ${ok ? 'PASS' : 'FAIL'} ---`);
  if (r.stdout) console.log(r.stdout.replace(/\n+$/, ''));
  if (r.stderr && r.status !== 0) {
    const err = r.stderr.trim();
    if (err) console.error(err);
  }
}
console.log('\n================================================');
console.log(`  结果: ${allPass ? 'ALL PASS ✔' : 'FAILED ✖'}`);
console.log('================================================');
process.exit(allPass ? 0 : 1);
