/**
 * check-jsx.mjs
 * 用 esbuild 批量校验 src 下含 JSX 的组件（.jsx / .tsx）的 JSX 语法。
 * 防止手工复制/拼接大段 JSX 时出现括号/闭合错误。
 * 注：TS 化后组件为 .tsx；director3d（第三方集成库）亦已于 2026-09-01 全部收敛为 .ts/.tsx，
 *     全仓不再有 .jsx 源码（永久豁免仅剩 contracts.js / config.js，二者非组件）。
 *
 * 用法：
 *   node scripts/check-jsx.mjs                 # 校验全部
 *   node scripts/check-jsx.mjs src/App.tsx      # 校验指定文件
 */
import { build } from 'esbuild'
import { readdirSync, statSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

function collectJsx(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectJsx(full, acc)
    } else if (extname(name) === '.jsx' || extname(name) === '.tsx') {
      acc.push(full)
    }
  }
  return acc
}

const args = process.argv.slice(2)
const targets =
  args.length > 0
    ? args.map((a) => resolve(root, a))
    : collectJsx(join(root, 'src'))

let failed = 0

for (const file of targets) {
  const rel = file.replace(root + '/', '')
  try {
    await build({
      entryPoints: [file],
      bundle: false,
      write: false,
      format: 'esm',
      loader: { '.jsx': 'jsx' },
      jsx: 'automatic',
      logLevel: 'silent'
    })
    console.log(`  ✔ ${rel}`)
  } catch (err) {
    failed++
    console.error(`  ✖ ${rel}`)
    for (const e of err.errors || []) {
      console.error(`      ${e.location?.line}:${e.location?.column}  ${e.text}`)
    }
  }
}

console.log(`\n${failed === 0 ? '全部通过 ✔' : `失败 ${failed} 个文件 ✖`}`)
process.exit(failed === 0 ? 0 : 1)
