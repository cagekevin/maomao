/**
 * sync-mapping.mjs
 * 从混淆源码里解析「节点类型 → 混淆组件符号 → 文件名」，生成 nodeTypes 注册表骨架。
 *
 * 数据来源：
 *  - shared.js 的 `var O_ = {...}` 定义节点类型 → 混淆符号（如 imageNode: _cmp_xi）
 *  - component_map.json 定义混淆符号 → 文件名（如 xi: xi）
 *
 * 用法：
 *   node scripts/sync-mapping.mjs                      # 输出到控制台 + 写 node-types-map.md
 *   node scripts/sync-mapping.mjs --json=node-types.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

// 主仓库根 = 原型工程上两级（prototypes/react-nodes -> prototypes -> 项目根）
const REPO_ROOT = resolve(root, '../..')
const BUNDLE_DIR = join(REPO_ROOT, 'src/bundle/httpClient-BknZwXjG_components')

// 主仓库混淆源码路径（可被 --bundle= 覆盖）
const DEFAULT_SHARED = join(BUNDLE_DIR, 'shared.js')
const DEFAULT_MAP = join(BUNDLE_DIR, 'component_map.json')
const DEFAULT_COMP = BUNDLE_DIR

function arg(k) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : undefined
}
const bundle = arg('bundle') || ''
const sharedPath = bundle ? resolve(root, bundle, 'shared.js') : DEFAULT_SHARED
const mapPath = bundle ? resolve(root, bundle, 'component_map.json') : DEFAULT_MAP
const compDir = bundle ? resolve(root, bundle) : DEFAULT_COMP
const jsonOut = arg('json')

// 1. 解析 O_ 映射
const shared = readFileSync(sharedPath, 'utf8')
const oStart = shared.indexOf('var O_ = {')
if (oStart === -1) {
  console.error('在 shared.js 中找不到 "var O_ = {" 映射')
  process.exit(1)
}
const oBlock = shared.slice(oStart, oStart + 4000)
const oEnd = oBlock.indexOf('\n}')
const body = oBlock.slice('var O_ = {'.length, oEnd)
const typeToSymbol = new Map()
for (const line of body.split('\n')) {
  const m = line.match(/\b(\w+)\s*:\s*(_cmp_\w+)/)
  if (m) typeToSymbol.set(m[1], m[2])
}

// 2. 读 component_map.json：混淆符号(去 _cmp_) → 文件名
const compMap = JSON.parse(readFileSync(mapPath, 'utf8'))

// 3. 组装：节点类型 → 符号 → 文件名
const rows = []
for (const [type, symbol] of typeToSymbol) {
  const short = symbol.replace('_cmp_', '')
  const file = compMap[short] || short
  // 检查真实文件是否存在于混淆组件目录
  const exists =
    existsSync(join(compDir, `${file}.jsx`)) || existsSync(join(compDir, `${file}.js`))
  rows.push({
    type,
    symbol,
    shortName: short,
    file: `${file}.jsx`,
    exists
  })
}

// 输出
const markdown = [
  '# 节点类型 → 混淆组件映射（sync-mapping 生成）',
  '',
  `来源: ${sharedPath.replace(root, '')}`,
  `生成时间: ${new Date().toISOString()}`,
  '',
  '| 节点类型 | 混淆符号 | 文件名 | 文件存在 |',
  '| --- | --- | --- | --- |',
  ...rows.map(
    (r) => `| ${r.type} | \`${r.symbol}\` | \`${r.file}\` | ${r.exists ? '✔' : '✖ 缺失'} |`
  ),
  ''
].join('\n')

writeFileSync(join(root, 'node-types-map.md'), markdown, 'utf8')

if (jsonOut) {
  const data = {
    generatedAt: new Date().toISOString(),
    nodes: rows.map((r) => ({ type: r.type, file: r.file, symbol: r.symbol }))
  }
  writeFileSync(resolve(root, jsonOut), JSON.stringify(data, null, 2) + '\n', 'utf8')
}

console.log(markdown)
console.log(`\n已写入 node-types-map.md${jsonOut ? ` + ${jsonOut}` : ''}`)
