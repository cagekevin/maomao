#!/usr/bin/env node
/**
 * 提交门禁用：只跑「与本次暂存改动相关的测试」，避免每次提交都跑全量（2259 个用例）。
 *
 * 为什么不直接用 `vitest run --changed`：
 *   --changed 只认「改动过的测试文件」，不认「改动过的源码文件」。改 src/ 代码时对应
 *   的 tests/unit/xxx.test.ts 没动，--changed 就跑不到它（要么跑 0 个、要么在基线异常时
 *   回退成全量）。本脚本反查：源码改动 → 同名 stem 的测试文件；测试文件改动 → 直接收口。
 *
 * 映射规则（按 basename stem 模糊匹配，覆盖本项目命名约定）：
 *   src/components/nodes/TextNode.tsx → tests/unit/TextNode.test.tsx + TextNode.upstream.test.tsx
 *   src/hooks/useNodeGeneration.ts   → tests/unit/useNodeGeneration*.test.ts
 *   src/stores/projectStore.ts        → tests/unit/projectStore*.test.ts
 *   tests/unit/foo.test.ts            → 直接纳入（测试文件自身改动）
 *
 * 无受影响测试时直接通过（exit 0），不让空集合误判为门禁失败。
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const TEST_DIR = path.join(ROOT, 'tests', 'unit')

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out.split('\n').map((s) => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

// 递归收集 tests/unit 下所有 *.test.{ts,tsx}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (/\.test\.(ts|tsx)$/.test(entry.name)) acc.push(full)
  }
  return acc
}

function main() {
  const staged = getStagedFiles()
  if (staged.length === 0) {
    console.log('[test-affected] 无暂存改动，跳过测试。')
    process.exit(0)
  }

  const allTests = walk(TEST_DIR)
  const selected = new Set()

  for (const rel of staged) {
    const abs = path.resolve(ROOT, rel)
    const isTest = /\.test\.(ts|tsx)$/.test(rel)
    if (isTest) {
      if (allTests.includes(abs)) selected.add(abs)
      continue
    }
    // 源码改动：取 basename stem（去扩展名），匹配 tests/unit/**/<stem>*.test.*
    const base = path.basename(rel).replace(/\.(ts|tsx|js|jsx)$/, '')
    const pattern = new RegExp(
      '^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*\\.test\\.(ts|tsx)$'
    )
    for (const t of allTests) {
      if (pattern.test(path.basename(t))) selected.add(t)
    }
  }

  if (selected.size === 0) {
    console.log('[test-affected] 改动未关联到任何单元测试，跳过。')
    process.exit(0)
  }

  const files = [...selected].map((f) => path.relative(ROOT, f))
  console.log(`[test-affected] 仅跑 ${files.length} 个相关测试文件：`)
  for (const f of files) console.log('  - ' + f)

  const cmd = 'npx vitest run --config vitest.config.ts ' + files.map((f) => JSON.stringify(f)).join(' ')
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
    process.exit(0)
  } catch (e) {
    process.exit(e.status ?? 1)
  }
}

main()
