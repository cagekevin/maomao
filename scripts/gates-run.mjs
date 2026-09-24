#!/usr/bin/env node
/**
 * 架构闸统一运行器（单一验证阶段模型，2026-09-13 三次重构）
 *
 * 【为什么合并】最早用『累积式分层』（build⊂commit⊂push），低层闸在高层被原样重跑；二次重构改**分区**
 * （每闸只属一个 phase、互不重叠）后虽不重复，但一次「提交 → 推送」仍要等**两轮**闸。
 * 用户裁定（2026-09-13）：「提交和推送这两个我可以看成一个。只要最后推送不出去…就可以了，
 * 不需要反反复复把这两个东西一起跑」→ 合并为**单一验证阶段**：代码闸全归 push，
 * 本地 pre-push 与 CI 各跑一次；commit 阶段不再跑闸（只留 lint-staged + 改动相关测试）。
 *
 * 分组（scripts/gates.manifest.json::phases）：
 *   build   → 6 道廉价构建契约（无 tsc），只在 npm run build 时跑
 *   push    → 6 道代码闸（合并原 commit+push：type-check/any/events + arch/dead-code + gate-vitals 元层）
 *             （2026-09-24：strict-src 并入 type-check、gates 并入 gate-vitals，见 manifest::_design.audit2026-09-24）
 *   health  → 全量巡检 = 所有闸 + healthOnly
 *
 * 用法：node scripts/gates-run.mjs build | push | health | list
 * 退出码：任一闸失败 → 非 0（fail-fast）。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'scripts/gates.manifest.json');

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  console.error(`❌ 闸清单读取失败（${MANIFEST}）：${e.message}`);
  process.exit(1);
}

const PHASES = manifest.phases || [];
const GATE_PHASES = PHASES.filter((p) => p !== 'health'); // 普通闸可归属的 phase
const phase = process.argv[2] || '';

// ── 自检（fail-loud）：manifest 自身也需护栏 ──
function selfCheck() {
  const problems = [];
  for (const req of ['build', 'push', 'health']) {
    if (!PHASES.includes(req)) problems.push(`phases 缺少必需分组: ${req}`);
  }
  const ids = new Set();
  for (const g of manifest.gates || []) {
    if (!g.id) problems.push('某闸缺少 id');
    if (ids.has(g.id)) problems.push(`闸 id 重复: ${g.id}`);
    ids.add(g.id);
    if (!g.cmd) problems.push(`闸 ${g.id} 缺少 cmd`);
    if (!GATE_PHASES.includes(g.phase)) {
      problems.push(`闸 ${g.id} 的 phase 非法（须为 ${GATE_PHASES.join('/')} 之一）`);
    }
  }
  for (const h of manifest.healthOnly || []) {
    if (!h.id || !h.cmd) problems.push(`healthOnly 闸 ${h.id || '?'} 缺少 id/cmd`);
  }
  if (problems.length) {
    console.error('❌ 闸清单自检失败：\n  - ' + problems.join('\n  - '));
    process.exit(1);
  }
}
selfCheck();

const all = [...(manifest.gates || []), ...(manifest.healthOnly || [])];
if (all.length === 0) {
  console.error('❌ 闸清单为空：gates.manifest.json 未定义任何闸（勿当通过）');
  process.exit(1);
}

// list：按 phase 打印清单（调试/审计用）
if (phase === 'list') {
  console.log('分区闸清单（唯一真源 scripts/gates.manifest.json）：\n');
  for (const p of GATE_PHASES) {
    console.log(`  ── ${p}（独立职责，不与其他 phase 重叠）──`);
    for (const g of manifest.gates) {
      if (g.phase === p) console.log(`    ${g.id.padEnd(14)} ${g.desc}`);
    }
  }
  console.log('\n  ── health（= 全量闸 + 以下 healthOnly）──');
  for (const g of manifest.gates) console.log(`    ${g.id.padEnd(14)} ${g.desc}`);
  for (const h of manifest.healthOnly) console.log(`    ${h.id.padEnd(14)} ${h.desc}`);
  process.exit(0);
}

if (!PHASES.includes(phase)) {
  console.error(`❌ 未知闸分组: "${phase}"（可用: ${PHASES.join(' / ')} / list）`);
  process.exit(1);
}

// 分区选择：health 跑全部闸 + healthOnly；其余只跑自己名下的闸。
const selected =
  phase === 'health'
    ? [...(manifest.gates || []), ...(manifest.healthOnly || [])]
    : (manifest.gates || []).filter((g) => g.phase === phase);

console.log(`🔒 架构闸分组 "${phase}"：${selected.length} 道（源自 gates.manifest.json）\n`);

let failed = 0;
for (const g of selected) {
  process.stdout.write(`▶ check:${g.id} — ${g.desc}\n`);
  try {
    execSync(g.cmd, { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    failed++;
    console.error(`\n❌ 闸失败: check:${g.id}（${g.cmd}）\n`);
    break; // fail-fast：首个失败即停，避免噪音淹没根因
  }
}

if (failed > 0) {
  console.error(`\n❌ 架构闸分组 "${phase}" 未通过（${failed} 道失败）`);
  process.exit(1);
}
console.log(`\n✅ 架构闸分组 "${phase}" 全部通过（${selected.length} 道）`);
