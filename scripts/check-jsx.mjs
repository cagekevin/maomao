/**
 * check-jsx.mjs
 * 用 esbuild 批量校验 src/components/**\/ *.jsx 的 JSX 语法。
 * 防止手工复制/拼接大段 JSX 时出现括号/闭合错误。
 *
 * 用法：
 *   node scripts/check-jsx.mjs                 # 校验全部 components
 *   node scripts/check-jsx.mjs src/App.jsx      # 校验指定文件
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
    } else if (extname(name) === '.jsx') {
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
