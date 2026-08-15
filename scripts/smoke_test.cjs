'use strict';
// Tier 2 冒烟测试（硬断言，仿源码 scripts/smoke_test.cjs）：
// 任一项 FAIL 即整体退出码 1，可在 CI / 交付前作为质量门。
// 用法：node scripts/smoke_test.cjs   （或 npm run test:smoke）
const path = require('path');
const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const C = require('./_smoke_checks.cjs');

const checks = [
  C.checkJsxSyntax(ROOT),
  C.checkReactFlowApis(ROOT),
  C.checkNodeTypes(ROOT),
  C.checkDeps(ROOT),
];

let allPass = true;
console.log('=== Tier 2 冒烟测试（react-nodes 原型） ===');
for (const c of checks) {
  console.log('\n● ' + c.name + (c.pass ? '  PASS' : '  FAIL'));
  for (const d of c.details || []) console.log('   ' + d);
  if (!c.pass) allPass = false;
}
console.log('\n=== 结果: ' + (allPass ? 'ALL PASS' : 'FAILED') + ' ===');
process.exit(allPass ? 0 : 1);
