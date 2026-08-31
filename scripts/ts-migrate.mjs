/**
 * ts-migrate.mjs — TS 规范化重构的「机械部分」辅助脚本
 *
 * 【职责边界】本脚本只做可验证的机械工作，不做语义改造：
 *   ── 做：
 *     1. 按 JSX 有无自动判定新扩展名（有 JSX → .tsx；纯逻辑 → .ts），可 `--to` 覆盖。
 *     2. `git mv` 或 fs rename 完成改名。
 *     3. 全库重写「所有 import/require/动态导入」指向该模块的说明符扩展名。
 *        · 按【解析后的绝对路径】比对，天然规避同名 basename 误伤
 *          （如 base/ErrorBoundary vs director3d/ErrorBoundary）。
 *   ── 不做：类型标注 / Props 接口 / types.ts 抽离 / EVENTS 表 from/to 的文件名引用同步。
 *     这些是在改名后逐文件的人工活；改名后 EVENTS 引用漂移由 `npm run check:events` 暴露并手工同步。
 *
 * 【实现】说明符的捕获与改写走 @babel/parser 的 AST（坐标精确替换），不再用正则扫文本：
 *   · 只认真正的模块说明符节点，注释/字符串里的同名文本永不误伤；
 *   · 替换只动说明符本体，原引号风格与缩进逐字节保留；
 *   · 解析失败/语法错误不再静默跳过，会汇总告警（防「悄悄漏改 import」）。
 *   ⚠️ 边界：模板串动态 import（`import(\`./x/${v}.js\`)`）AST 抓不到，本仓已明令禁止这种写法
 *      （见 src/components/base/lazyNode.jsx 注释），故不构成风险。
 *
 * 【用法】
 *   node scripts/ts-migrate.mjs convert <file> [--to ts|tsx] [--dry] [--force]
 *       将 <file> 改名为目标扩展名（缺省按内容 JSX 判定），并全库重写其 import 说明符。
 *       命中永久豁免（director3d / contracts.js / config.js）时拒绝，除非显式 --force。
 *   node scripts/ts-migrate.mjs plan <dir> [--limit N] [--all]
 *       列出 <dir> 下待转文件 + 被引用次数，按引用量升序（叶子优先）。
 *   node scripts/ts-migrate.mjs refs <file>
 *       列出谁引用了它：① 模块引用（convert 自动改写）② 硬编码字符串残留（需手工同步）。
 *   node scripts/ts-migrate.mjs report <dir>
 *       生成 ts-migration-view.csv（Excel 全景作战表，叶子优先排序，含引用方与残留位置）。
 *   node scripts/ts-migrate.mjs update-imports <file> [--to ts|tsx] [--dry]
 *       仅重写 import 说明符（文件已改名时用）。
 *   node scripts/ts-migrate.mjs move <file> <targetDir> [--dry]
 *       把 <file> 移到 <targetDir>（横切收口用，如 hook 收口到 src/hooks/），
 *       并全库重写指向它的 import 路径（含被移动文件自身的 import，因其相对基准变了）。
 *
 * 【注意】改完尺寸较大或被 EVENTS 引用的文件，务必跑 `npm run check:events` 确认反向校验仍自洽。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs'
import { resolve, join, dirname, extname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

// 运行时依赖检查，规避幽灵依赖炸弹
let parse;
try {
  import.meta.resolve('@babel/parser');
  const babelParser = await import('@babel/parser');
  parse = babelParser.parse;
} catch (e) {
  console.error('✖ 缺少核心依赖 @babel/parser。请运行: npm install --save-dev @babel/parser');
  process.exit(1);
}

import { SCAN_EXTS, TS_EXEMPT_DIRS, TS_EXEMPT_FILES, isExempt, resolveSourceFile, hasJsx, hasJsxHintRaw } from './check-targets.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const SCAN_ROOTS = [join(root, 'src'), join(root, 'tests')]

// 全局异常记录，防止静默漏改
const parseWarnings = new Set()

function toPosix(p) { return p.replace(/\\/g, '/') }
function relOf(abs) { return toPosix(abs.slice(root.length).replace(/^[\/\\]/, '')) }
function isExemptAbs(abs) { return isExempt(relOf(abs)) }

function collectFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      collectFiles(full, acc)
    } else if (SCAN_EXTS.includes(extname(name))) {
      acc.push(full)
    }
  }
  return acc
}

function detectExt(code, toFlag) {
  if (toFlag) return toFlag === 'tsx' ? '.tsx' : '.ts'
  return hasJsx(code) ? '.tsx' : '.ts'
}

function resolveSpec(spec, fromDir) {
  if (spec.startsWith('@/')) return resolve(root, 'src', spec.slice(2))
  if (spec.startsWith('.')) return resolve(fromDir, spec)
  if (spec.startsWith('/')) return resolve(root, 'src', spec.slice(1))
  return null
}

function allSources() {
  const set = new Set()
  for (const dir of SCAN_ROOTS) {
    if (!existsSync(dir)) continue
    collectFiles(dir, []).forEach((f) => set.add(f))
  }
  return [...set]
}

// ============================================================================
// AST 解析引擎
// ============================================================================

function extractImportNodes(code, filepath) {
  const nodes = []
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true
    })

    if (ast.errors && ast.errors.length > 0) {
      parseWarnings.add(`[语法错误] ${filepath} (已尝试恢复解析，请注意检查)`)
    }

    const walk = (node) => {
      if (!node) return
      if (Array.isArray(node)) { node.forEach(walk); return }
      
      if (node.type === 'ImportDeclaration') {
        if (node.source) nodes.push(node.source)
      } else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
        if (node.source) nodes.push(node.source)
      } else if (node.type === 'CallExpression') {
        const isRequire = node.callee.type === 'Identifier' && node.callee.name === 'require'
        const isDynamicImport = node.callee.type === 'Import'
        if ((isRequire || isDynamicImport) && node.arguments.length > 0) {
          const arg = node.arguments[0]
          if (arg.type === 'StringLiteral') nodes.push(arg)
        }
      }
      
      for (const key in node) {
        if (typeof node[key] === 'object' && node[key] !== null) {
          if (key !== 'loc' && key !== 'range') walk(node[key])
        }
      }
    }
    walk(ast.program)
  } catch (err) {
    parseWarnings.add(`[解析崩溃] ${filepath} (严重：将丢失该文件的依赖重写)`)
    return null
  }
  return nodes
}

function buildRefGraph() {
  const graph = new Map()
  const push = (target, from) => {
    if (!graph.has(target)) graph.set(target, new Set())
    graph.get(target).add(from)
  }
  
  for (const file of allSources()) {
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue

    for (const node of nodes) {
      const abs = resolveSpec(node.value, dirname(file))
      if (abs === null) continue
      const target = resolveSourceFile(abs)
      if (!target || target === file) continue
      push(target, file)
    }
  }
  return graph
}

// ============================================================================
// 引用重写逻辑
// ============================================================================

function computeNewSpec(fromFile, newAbs, oldSpec) {
  if (oldSpec.startsWith('@/')) return '@/'.replace('@/', '@/') + toPosix(relative(resolve(root, 'src'), newAbs))
  let rel = toPosix(relative(dirname(fromFile), newAbs))
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

function rewriteSpecs(oldAbs, makeNewSpec, dry = false, skip = new Set()) {
  const changed = []
  
  for (const file of allSources()) {
    if (skip.has(file)) continue
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    
    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue

    const hits = nodes.filter(node => {
      const cand = resolveSpec(node.value, dirname(file))
      return cand !== null && cand === oldAbs
    })

    if (hits.length > 0) {
      hits.sort((a, b) => b.start - a.start)
      let nextSrc = src
      for (const node of hits) {
        const newSpec = makeNewSpec(file, node.value)
        if (newSpec === node.value) continue
        
        const q = nextSrc[node.start] 
        nextSrc = nextSrc.slice(0, node.start) + `${q}${newSpec}${q}` + nextSrc.slice(node.end)
      }
      
      if (nextSrc !== src) {
        changed.push(file)
        if (!dry) writeFileSync(file, nextSrc, 'utf8')
      }
    }
  }
  return changed.map((f) => relOf(f))
}

function rewriteImports(oldAbs, newExt, dry = false) {
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + newExt
  return rewriteSpecs(
    oldAbs,
    (_fromFile, fullSpec) => fullSpec.slice(0, fullSpec.length - oldExt.length) + newExt,
    dry,
    new Set([oldAbs, newAbs])
  )
}

function rewriteImportsForMove(oldAbs, newAbs, dry = false) {
  return rewriteSpecs(oldAbs, (fromFile, fullSpec) => computeNewSpec(fromFile, newAbs, fullSpec), dry)
}

function rewriteOutgoingImports(fileAbs, oldDir, dry = false) {
  let src
  try { src = readFileSync(fileAbs, 'utf8') } catch { return false }
  
  const nodes = extractImportNodes(src, relOf(fileAbs))
  if (!nodes) return false

  let hit = false
  let nextSrc = src

  nodes.sort((a, b) => b.start - a.start).forEach(node => {
    const spec = node.value
    if (!(spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('/'))) return
    const abs = resolveSpec(spec, oldDir)
    if (abs === null || !existsSync(abs)) return
    
    const newSpec = computeNewSpec(fileAbs, abs, spec)
    if (newSpec !== spec) {
      hit = true
      const q = nextSrc[node.start]
      nextSrc = nextSrc.slice(0, node.start) + `${q}${newSpec}${q}` + nextSrc.slice(node.end)
    }
  })

  if (hit && !dry) writeFileSync(fileAbs, nextSrc, 'utf8')
  return hit
}

const STRING_REF_ROOTS = ['src', 'tests', 'scripts']
const STRING_REF_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.html']
const STRING_REF_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dev', 'coverage', '1mao-scripts', 'scriptbox-split-snapshot', 'archived'])

function collectStringScanFiles() {
  const out = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir) } catch { return }
    for (const name of entries) {
      if (STRING_REF_SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      let st
      try { st = statSync(full) } catch { continue }
      if (st.isDirectory()) walk(full)
      else if (STRING_REF_EXTS.includes(extname(name))) out.push(full)
    }
  }
  for (const r of STRING_REF_ROOTS) walk(join(root, r))
  return out
}

function findStringRefs(name, skipAbs = []) {
  const hits = []
  for (const file of collectStringScanFiles()) {
    if (skipAbs.includes(file)) continue
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(name)) {
        hits.push({ file: relOf(file), line: i + 1, text: lines[i].trim().slice(0, 160) })
      }
    }
  }
  return hits
}

function renameFile(oldAbs, newAbs) {
  const rel = relOf(oldAbs)
  const res = spawnSync('git', ['mv', '--', rel, relOf(newAbs)], { cwd: root })
  if (res.status === 0) return 'git mv'
  try { renameSync(oldAbs, newAbs); return 'fs rename' } catch { return null }
}

function printWarnings() {
  if (parseWarnings.size > 0) {
    console.log('\n⚠ 发现以下解析告警，部分依赖重写可能失败：')
    for (const w of parseWarnings) console.log(`   - ${w}`)
  }
}

// ============================================================================
// CLI 入口
// ============================================================================

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    to: { type: 'string' },
    dry: { type: 'boolean', default: false },
    limit: { type: 'string', default: '30' },
    all: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

const cmd = positionals[0]
const fileArg = positionals[1]
const toFlag = values.to
const dry = values.dry

if (cmd === 'plan') {
  const dir = resolve(root, fileArg || 'src')
  const limitArg = Number(values.limit)
  const all = values.all
  const graph = buildRefGraph()

  const pending = []
  let exemptSkipped = 0
  for (const f of collectFiles(dir, [])) {
    if (!['.js', '.jsx'].includes(extname(f))) continue
    if (isExemptAbs(f)) { exemptSkipped++; continue } 
    
    const code = readFileSync(f, 'utf8')
    const has = hasJsx(code)
    const suspect = has && !hasJsxHintRaw(code)
    pending.push({ abs: f, file: relOf(f), to: has ? '.tsx' : '.ts', suspect, refs: graph.get(f)?.size || 0 })
  }
  
  pending.sort((a, b) => a.refs - b.refs || a.file.localeCompare(b.file))

  const byTo = pending.reduce((acc, f) => { acc[f.to] = (acc[f.to] || 0) + 1; return acc }, {})
  console.log(`\n待转 ${pending.length} 个文件（tsx:${byTo['.tsx'] || 0} / ts:${byTo['.ts'] || 0}）`
    + ` [已排除永久豁免 ${exemptSkipped} 个：${TS_EXEMPT_DIRS.join(' / ')}、${TS_EXEMPT_FILES.join(' / ')}]`)
  console.log('排序：被引用次数升序（叶子优先，级联改动最小）\n')

  const shown = all ? pending : pending.slice(0, limitArg)
  for (const f of shown) {
    console.log(`  ${String(f.refs).padStart(3)} 引用  ${f.file.padEnd(64)} → ${f.to}${f.suspect ? '  ⚠判定可疑，人工确认' : ''}`)
  }
  const suspects = pending.filter((f) => f.suspect)
  if (suspects.length) {
    console.log(`\n⚠ ${suspects.length} 个判定可疑（原文无 JSX 字样却被判含 JSX）：`)
    for (const f of suspects) console.log('   - ' + f.file + '（确认后可用 --to ts/tsx 强制）')
  }
  if (!all && pending.length > shown.length) {
    console.log(`  … 另 ${pending.length - shown.length} 个未显示（加 --all 全列，或 --limit N 调整）`)
  }

  printWarnings()
  process.exit(0)
}

if (cmd === 'refs') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const abs = resolve(root, fileArg)
  if (!existsSync(abs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  const newExt = detectExt(readFileSync(abs, 'utf8'), toFlag)
  const newAbs = abs.slice(0, abs.length - extname(abs).length) + newExt

  const graph = buildRefGraph()
  const importers = [...(graph.get(abs) || [])].sort()
  console.log(`\n① 模块引用 ${importers.length} 处（convert 会自动改写这些 import 说明符）：`)
  for (const f of importers) console.log('   - ' + relOf(f))
  if (importers.length === 0) console.log('   （无）')

  const strRefs = findStringRefs(basename(abs), [abs, newAbs])
  console.log(`\n② 字符串残留引用 ${strRefs.length} 处（脚本【不】改字符串，需手工同步）：`)
  for (const h of strRefs) console.log(`   - ${h.file}:${h.line}\n       ${h.text}`)
  
  printWarnings()
  process.exit(0)
}

if (cmd === 'report') {
  const dir = resolve(root, fileArg || 'src')
  console.log(`正在深度扫描 ${dir} 下的文件，构建全景引用视图...`)
  
  const graph = buildRefGraph()
  const pending = []
  
  for (const f of collectFiles(dir, [])) {
    if (!['.js', '.jsx'].includes(extname(f))) continue
    if (isExemptAbs(f)) continue 
    
    // 复用文件读取内容
    const srcCode = readFileSync(f, 'utf8')
    const importers = graph.get(f) ? Array.from(graph.get(f)).map(relOf) : []
    
    const base = basename(f)
    const newExt = detectExt(srcCode, toFlag)
    const newAbs = f.slice(0, f.length - extname(f).length) + newExt
    const strRefs = findStringRefs(base, [f, newAbs]).map(h => `${h.file}:${h.line}`)

    // 采用标准的 Excel 兼容换行符 \r\n
    pending.push({
      file: relOf(f),
      refCount: importers.length,
      importers: importers.join(' \r\n '),
      strRefs: strRefs.length > 0 ? strRefs.join(' \r\n ') : '无'
    })
  }
  
  pending.sort((a, b) => a.refCount - b.refCount || a.file.localeCompare(b.file))

  let csv = '待转文件 (自底向上排序),被引用次数,被哪些文件 Import,硬编码字符串残留位置\r\n'
  for (const p of pending) {
    csv += `"${p.file}",${p.refCount},"${p.importers}","${p.strRefs}"\r\n`
  }
  
  const reportPath = resolve(root, 'ts-migration-view.csv')
  writeFileSync(reportPath, '\uFEFF' + csv, 'utf8')
  
  console.log(`\n✔ 已生成全景迁移视图报表：ts-migration-view.csv`)
  console.log(`  提示：记得将该文件加入 .gitignore！`)
  
  printWarnings()
  process.exit(0)
}

if (cmd === 'convert' || cmd === 'update-imports') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const oldAbs = resolve(root, fileArg)
  if (!existsSync(oldAbs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  
  if (isExemptAbs(oldAbs) && !values.force) {
    console.error(`✖ 拒绝转换：${relOf(oldAbs)} 属永久豁免（红线）。`)
    process.exit(1)
  }
  
  const code = readFileSync(oldAbs, 'utf8')
  const toExt = detectExt(code, toFlag)
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + toExt

  if (cmd === 'convert' && !dry) {
    const how = renameFile(oldAbs, newAbs)
    if (!how) { console.error(`改名失败：${oldAbs}`); process.exit(1) }
    console.log(`✔ 改名 ${basename(oldAbs)} → ${basename(newAbs)}（${how}）`)
  }

  const changed = rewriteImports(oldAbs, toExt, dry)
  const rel = relOf(oldAbs)
  if (changed.length === 0) {
    console.log(`ℹ ${rel}：无其他文件引用其 import 说明符`)
  } else {
    console.log(`✔ 已同步 ${changed.length} 个文件的 import 说明符：`)
    for (const c of changed) console.log('   - ' + c)
  }
  if (dry) console.log('（--dry 仅预览，未实际落盘/改名）')
  
  printWarnings()
  process.exit(0)
}

if (cmd === 'move') {
  const targetArg = positionals[2]
  if (!fileArg || !targetArg) { console.error('用法：move <file> <targetDir> [--dry]'); process.exit(1) }
  
  const oldAbs = resolve(root, fileArg)
  const targetDir = resolve(root, targetArg)
  const newAbs = join(targetDir, basename(oldAbs))
  const alreadyMoved = !existsSync(oldAbs) && existsSync(newAbs)

  if (!existsSync(oldAbs) && !alreadyMoved) { console.error(`文件不存在：${fileArg}`); process.exit(1) }

  if (alreadyMoved) {
    console.log(`ℹ ${basename(oldAbs)} 已在目标位置，进入修复模式（只重写引用）`)
  } else if (!dry) {
    const how = renameFile(oldAbs, newAbs)
    if (!how) { console.error(`移动失败：${oldAbs} → ${newAbs}`); process.exit(1) }
    console.log(`✔ 移动 ${relOf(oldAbs)} → ${relOf(newAbs)}（${how}）`)
  }

  const selfFixed = rewriteOutgoingImports(newAbs, dirname(oldAbs), dry)
  if (selfFixed) console.log(`✔ 已重写 ${basename(newAbs)} 自身的出向 import 路径`)

  const changed = rewriteImportsForMove(oldAbs, newAbs, dry)
  if (changed.length === 0) {
    console.log(`ℹ 无其他文件引用其 import 说明符`)
  } else {
    console.log(`✔ 已同步 ${changed.length} 个文件的 import 路径：`)
    for (const c of changed) console.log('   - ' + c)
  }
  
  printWarnings()
  process.exit(0)
}

console.error(`未知命令：${cmd}\n用法见文件头 JSDoc。`)
process.exit(1)