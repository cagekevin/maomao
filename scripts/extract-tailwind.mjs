/**
 * extract-tailwind.mjs
 * 从混淆源码中提取全部 Tailwind class 清单，辅助高保真复刻时核对 class 不遗漏。
 *
 * 说明：
 *  - 默认扫描原型工程 components 目录，并把所有出现的 className 字面量拆 token 去重输出。
 *  - 也支持扫描主仓库混淆源码：`node scripts/extract-tailwind.mjs --source=src/bundle/...`
 *  - 纯正则，零依赖，不读 docs/逆向专用_ai 禁止读/。
 *
 * 用法：
 *   node scripts/extract-tailwind.mjs                                  # 扫描原型 components
 *   node scripts/extract-tailwind.mjs --source=../src/bundle --out=tokens.json
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

function parseArgs() {
  const argv = process.argv.slice(2)
  const arg = (k) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`))
    return hit ? hit.slice(k.length + 3) : undefined
  }
  return {
    source: arg('source'),
    out: arg('out')
  }
}

function collectFiles(dir, acc = []) {
  if (!dir) return acc
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) collectFiles(full, acc)
    else if (extname(e.name) === '.jsx' || extname(e.name) === '.js') acc.push(full)
  }
  return acc
}

const { source, out } = parseArgs()
const srcDir = source ? resolve(root, source) : join(root, 'src/components')
const files = collectFiles(srcDir)

if (files.length === 0) {
  console.error(`未找到任何 .jsx/.js 文件: ${srcDir}`)
  process.exit(1)
}

// 收集 className 字符串字面量（含模板字符串片段），拆成 token
const tokens = new Map() // token -> count
let totalClasses = 0
let totalFiles = 0

// 匹配 className={`...`} / className="..." 等。
// 注意：`className={` 里 { 在引号前，需允许；反引号用 \x60 表示避免模板字符串歧义。
const BT = '\\x60'
const CLASS_RE = new RegExp(
  `(?:className|class)\\s*=\\s*(?:[{]\\s*)?["'${BT}]([^"'${BT}]*?)["'${BT}]`,
  'g'
)

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  let m
  while ((m = CLASS_RE.exec(content)) !== null) {
    const raw = m[1]
    if (!raw.trim()) continue
    // 拆分：空白分隔（含模板字符串里 `${}` 表达式占位，会被拆成不完整 token，仅计数不算 class）
    for (const part of raw.split(/\s+/)) {
      if (!part) continue
      totalClasses++
      // 跳过含 JS 表达式残留的 token：${ } 反引号 三元 `?`、`>`、`/`注释等
      if (
        part.includes('${') ||
        part.includes('}') ||
        part.includes('`') ||
        part.includes('?') ||
        part.includes(';') ||
        part.includes('"') ||
        part.includes("'")
      ) {
        continue
      }
      tokens.set(part, (tokens.get(part) || 0) + 1)
    }
  }
  totalFiles++
}

const sorted = [...tokens.entries()].sort((a, b) => b[1] - a[1])
const lines = sorted.map(([t, c]) => `${c.toString().padStart(4)}  ${t}`)

const report = [
  `# Tailwind class 清单`,
  ``,
  `来源目录: ${relative(root, srcDir)}`,
  `扫描文件: ${totalFiles}`,
  `class 出现总次数: ${totalClasses}`,
  `去重 token 数: ${sorted.length}`,
  ``,
  ...lines
].join('\n')

if (out) {
  const outPath = resolve(root, out)
  writeFileSync(outPath, report + '\n', 'utf8')
  console.log(`已写入 ${relative(root, outPath)}（${sorted.length} 个去重 token）`)
} else {
  console.log(report)
}
