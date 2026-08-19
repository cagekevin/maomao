'use strict';
// 统一质量门禁：一次跑完所有测试（smoke + regression + tools）。
// 任一项失败即整体退出码 1，供 CI / 提交 / 交付前作为门禁。
// 用法：node scripts/run_all_tests.cjs   （或 npm run test:all）
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

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
//  - L2 vitest run 已是全量（含 canvasAgentTools.test.js），故不重复单跑 L3，避免连续起
//    两个 vitest 进程导致偶发失败（spawnSync 串行 + vitest 进程清理时序问题）。
//  - Agent 工具层另由 esbuild 版 test_agent_tools.cjs 覆盖（更快更稳，作为工具层门禁）。
const suites = [
  { name: '冒烟测试 (Tier 2)', cmd: 'node', args: ['scripts/smoke_test.cjs'] },
  { name: 'L2/L3 纯逻辑+工具单测 (Vitest, 全量)', cmd: process.execPath, args: [findVitestBin(), 'run'] },
  { name: '回归测试 (SSR / L1)', cmd: 'node', args: ['scripts/regression_test.cjs'] },
  { name: 'Agent 工具测试 (esbuild)', cmd: 'node', args: ['scripts/test_agent_tools.cjs'] },
];

let allPass = true;
console.log('================================================');
console.log('  统一测试门禁（react-nodes 原型）');
console.log('================================================');
for (const s of suites) {
  const r = spawnSync(s.cmd, s.args, { cwd: ROOT, encoding: 'utf8' });
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
