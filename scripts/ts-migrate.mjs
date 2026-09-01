/**
 * ts-migrate.mjs — TS 规范化重构的「终极架构版」辅助脚本 (AST 精确解析 v3)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ⚠️ 能力边界（AI 必读）：本脚本只做【机械改名 + 同步 import】。
 *    一个文件转完它就算完成任务。Props 接口、消除内部 any、同步 contracts.js
 *    EVENTS 表、同步 scripts/ 硬编码路径、跑测试、验证、提交——全部要你手动做。
 *    详见 docs/TS-migration-handoff-2026-08-31.md「九、脚本做了什么 / 不做什么」。
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 【命令清单】
 *   convert <file> [--to ts|tsx] [--dry] [--force]
 *       改名为目标后缀（缺省按内容 JSX 判定：有 JSX → .tsx，纯逻辑 → .ts）
 *       + AST 全库重写指向它的 import 扩展名。--force 可绕过永久豁免红线。
 *   update-imports <file> [--to ts|tsx] [--dry]
 *       仅重写 import 说明符（文件已改名时用）。
 *   move <file> <targetDir> [--dry]        移动文件 + 重写全库 import 路径（横切收口）
 *   plan <dir> [--limit N] [--all]         按引用量升序（叶子优先）列待转文件
 *   refs <file>                            列模块引用 + 硬编码字符串残留（带行号）
 *   report <dir>                           生成 ts-migration-view.csv（Excel 作战表）
 *   batch <dir> --limit N [--nocheck]      批量转引用数为 0 的叶子节点
 *   find-dead <dir> [--strict]             孤儿文件 / 仅被测试引用的检测
 *
 * 【命令详解】
 *   - convert 是核心：git mv 改名 + AST 全库重写 import。AST 坐标精确替换，
 *     注释/字符串里的同名文本不误伤；按解析后绝对路径比对规避同名 basename 误伤。
 *   - plan / report / refs 是只读的「视图」：不落盘，用于规划批次和排查残留。
 *   - batch 会【自动连续执行 convert】多次——危险度高于单文件 convert，
 *     因为它一次改多个文件。用前先 --dry 预览，且每批限 --limit N。
 *   - find-dead 是排查工具：孤儿 ≠ 一定废弃（可能是动态拼接字符串黑魔法引入、
 *     或独立入口点），删前必须人工核实（例：TemplateNode 是动态注册的核心节点）。
 *
 * 【实现说明】
 *   - 说明符捕获/改写走 @babel/parser AST（坐标精确替换），不再用正则扫文本。
 *   - 解析失败/语法错误不静默跳过，汇总到 parseWarnings 末尾告警（防「漏改 import」）。
 *   - 依赖检查用 import.meta.resolve 探 @babel/parser，缺依赖直接 exit(1) 提示安装。
 *   - 扩展名无关 + 豁免清单 + JSX 探测定义在 ts-exts.cjs，经 check-targets.mjs 转出，
 *     与 check-* / smoke / health / sync-mapping 等脚本共用一份，避免各写一份。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs'
import { resolve, join, dirname, extname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

let parse;
try {
  import.meta.resolve('@babel/parser');
  const babelParser = await import('@babel/parser');
  parse = babelParser.parse;
} catch (e) {
  console.error('✖ 缺少核心依赖 @babel/parser。请运行: npm install --save-dev @babel/parser');
  process.exit(1);
}

import { SCAN_EXTS, SOURCE_EXTS, TS_EXEMPT_DIRS, TS_EXEMPT_FILES, isExempt, resolveSourceFile, hasJsx, hasJsxHintRaw } from './check-targets.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const SCAN_ROOTS = [join(root, 'src'), join(root, 'tests')]

const parseWarnings = new Set()

function toPosix(p) { return p.replace(/\\/g, '/') }
function relOf(abs) { return toPosix(abs.slice(root.length).replace(/^[/\\]/, '')) }
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

/**
 * 用 AST 提取文件里所有模块说明符节点（含 start/end 坐标）。
 * 覆盖：ESM import / export...from / require() / 动态 import()。
 * 说明符是「引用点」——convert 改扩展名、move 改路径都靠这些坐标做精确替换。
 * @param {string} code      文件源码
 * @param {string} filepath  文件绝对路径（仅用于解析告警提示）
 * @returns {Array|null} 说明符节点数组；解析崩溃返回 null（调用方据此告警）
 * @note 边界：模板串动态 import（`import(\`./x/${v}.js\`)`）AST 抓不到。
 *       本仓已明令禁止这种写法（见 lazyNode.jsx 注释），故不构成风险。
 */
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
        // vi.mock('…/Xxx.jsx')：vitest 的 mock 路径是【字符串参数】，convert 改名后不自动变，
        // 是 TS 迁移期反复翻车的最大盲区（见交接文档 §10.1/§10.3/§10.5/§10.6/§10.9/§10.11）。
        // 这里把它当普通模块说明符抓进 AST，让 rewriteImports 在 convert 时自动同步后缀。
        // 只认 `vi.mock(...)` 且首个实参是 StringLiteral；正则/变量形式的 mock 不处理（本仓不用）。
        const isViMock =
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' && node.callee.object.name === 'vi' &&
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'mock'
        const isMockWithSpec = (isViMock && node.arguments.length > 0)
        if ((isRequire || isDynamicImport || isMockWithSpec) && node.arguments.length > 0) {
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
    parseWarnings.add(`[解析崩溃] ${filepath} (严重：将丢失该文件的依赖追踪/重写)`)
    return null
  }
  return nodes
}

/**
 * 构建全库引用图：被引用模块绝对路径 → 引用它的文件集合（src + tests）。
 * 供 plan（按引用量排叶子优先）/ refs（查引用方）/ report（导出作战表）使用。
 * 说明符一律走扩展名无关解析（resolveSourceFile），改名前后的引用都能算进来。
 * @returns {Map<string, Set<string>>} targetAbs -> Set<importerAbs>
 */
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

/**
 * 计算「从引用文件 fromFile 指向 newAbs」的新说明符。
 * - 原 spec 是 @/ 别名 → 保持 @/ 形式
 * - 否则算相对路径；若回退 ≥2 层且目标在 src/ 下，自动净化成 @/ 别名（特性 3）
 * @param fromFile 引用方文件绝对路径
 * @param newAbs   目标文件新绝对路径
 * @param oldSpec  原说明符（判断 @/ 前缀）
 */
function computeNewSpec(fromFile, newAbs, oldSpec) {
  const srcRoot = resolve(root, 'src')
  if (oldSpec.startsWith('@/')) return '@/'.replace('@/', '@/') + toPosix(relative(srcRoot, newAbs))
  
  let rel = toPosix(relative(dirname(fromFile), newAbs))
  if (!rel.startsWith('.')) rel = './' + rel
  
  // 【特性 3: Alias 自动净化】如果相对路径过深 (回退两层及以上) 且都在 src/ 下，自动转为 @/ 别名
  if (rel.startsWith('../../') && newAbs.startsWith(srcRoot)) {
    return '@/' + toPosix(relative(srcRoot, newAbs))
  }
  
  return rel
}

/**
 * 重写全库指向 oldAbs 的 import 说明符（AST 坐标精确替换，从后往前改保证坐标不失效）。
 * @param oldAbs      被改名/移动前的目标文件绝对路径
 * @param makeNewSpec (fromFile, fullSpec) => 新说明符；决定「换扩展名」还是「换路径」
 * @param dry         只预览不落盘
 * @param skip        不参与重写的绝对路径集合（如目标文件自身/新文件）
 * @returns 被改动文件的相对路径列表
 * @note 仅重写「解析后绝对路径 === oldAbs」的说明符，规避同名 basename 误伤
 *      （如 base/ErrorBoundary vs director3d/ErrorBoundary）。
 */
function rewriteSpecs(oldAbs, makeNewSpec, dry = false, skip = new Set()) {
  const changed = []
  
  for (const file of allSources()) {
    if (skip.has(file)) continue
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    
    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue

    const hits = nodes.filter(node => {
      const abs = resolveSpec(node.value, dirname(file))
      if (abs === null) return false
      // 用 resolveSourceFile 归一化（.jsx→.tsx 等），与 buildRefGraph 的判定一致——
      // 否则 `vi.mock('…/Foo.jsx')` 指向已改名的 .tsx 时，resolveSpec 返回 .jsx 路径，
      // 与 oldAbs(.tsx) 不相等，mock 引用就漏掉不重写（本批实测踩坑）。
      const target = resolveSourceFile(abs)
      return target !== null && target === oldAbs
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

/**
 * convert 用的专用改写器：把指向 oldAbs 的说明符后缀统一换成 newExt。
 *
 * 注意：替换基准是【说明符自身携带的后缀】（extname(fullSpec)），而非 oldAbs 的扩展名。
 * 原因：常规 import 的 spec 与 oldAbs 同后缀（.jsx→.tsx 时基准一致），但 `vi.mock('…/Foo.jsx')`
 * 里 spec 的后缀可能与 oldAbs 不一致（源已 .tsx、mock 仍写 .jsx 的漂移场景）。
 * 若用 oldAbs 的扩展名切，会把 `.jsx` 误切成 `.j.tsx`（§ State 4 实测踩坑）。按 spec 自身
 * 后缀替换，无论写 .jsx/.tsx/无后缀，只要解析命中 oldAbs，一律换成 newExt。
 */
function rewriteImports(oldAbs, newExt, dry = false) {
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + newExt
  return rewriteSpecs(
    oldAbs,
    (_fromFile, fullSpec) => {
      const specExt = extname(fullSpec)
      // 只替换「源码扩展名」；spec 不带后缀或带非源码后缀（如 .json）时原样保留（append 无意义）
      if (!SOURCE_EXTS.includes(specExt)) return fullSpec
      return fullSpec.slice(0, fullSpec.length - specExt.length) + newExt
    },
    dry,
    new Set([oldAbs, newAbs])
  )
}

/** move 用的专用改写器：把指向 oldAbs 的说明符重算为指向 newAbs 的新路径 */
function rewriteImportsForMove(oldAbs, newAbs, dry = false) {
  return rewriteSpecs(oldAbs, (fromFile, fullSpec) => computeNewSpec(fromFile, newAbs, fullSpec), dry)
}

/**
 * 重写【被移动文件自身】的 import 路径（其相对基准随移动变了）。
 * @param fileAbs 被移动的文件
 * @param oldDir  移动前所在目录（作为相对基准）
 * @param dry     只预览不落盘
 * @returns 是否有改动（供 move 命令判断「漏改自身 import 的修复模式」）
 */
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

/**
 * 全仓【字符串残留引用】扫描：找出把文件名硬编码进文本的位置（非 import 说明符）。
 * 这类引用脚本不会改（AST 只抓 import），改名后会静默失效——refs 命令靠它列出
 * 需要你手动同步的位置（典型：regression_test.cjs 拼出的 import 路径、tests 的文件名枚举）。
 * @param name    要搜的文件名（如 'ProjectSelector.jsx'）
 * @param skipAbs 排除的文件（目标文件自身/新文件）
 * @returns [{ file, line, text }]
 */
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

/**
 * 改名/移动：优先 git mv（保留历史），非跟踪文件退回 fs rename。
 * @returns 'git mv' | 'fs rename' | null（失败）
 */
function renameFile(oldAbs, newAbs) {
  const rel = relOf(oldAbs)
  const res = spawnSync('git', ['mv', '--', rel, relOf(newAbs)], { cwd: root })
  if (res.status === 0) return 'git mv'
  try { renameSync(oldAbs, newAbs); return 'fs rename' } catch { return null }
}

/**
 * 打印解析告警汇总。解析失败/语法错误会让某些文件的依赖重写不完整，
 * 必须显式告知而非静默跳过（本脚本的关键设计取舍）。
 */
function printWarnings() {
  if (parseWarnings.size > 0) {
    console.log('\n⚠ 发现以下解析告警，部分依赖重写可能受到影响：')
    for (const w of parseWarnings) console.log(`   - ${w}`)
  }
}

// ============================================================================
// CLI 入口解析
// ============================================================================

const { positionals, values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    to: { type: 'string' },
    dry: { type: 'boolean', default: false },
    limit: { type: 'string', default: '30' },
    all: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    strict: { type: 'boolean', default: false },
    nocheck: { type: 'boolean', default: false }, // 【特性 2: 平滑注入选项】
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
    + `　[已排除永久豁免 ${exemptSkipped} 个：${TS_EXEMPT_DIRS.join(' / ')}、${TS_EXEMPT_FILES.join(' / ')}]`)
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
    
    const srcCode = readFileSync(f, 'utf8')
    const importers = graph.get(f) ? Array.from(graph.get(f)).map(relOf) : []
    
    const base = basename(f)
    const newExt = detectExt(srcCode, toFlag)
    const newAbs = f.slice(0, f.length - extname(f).length) + newExt
    const strRefs = findStringRefs(base, [f, newAbs]).map(h => `${h.file}:${h.line}`)

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

// 【特性 4: 僵尸代码扫描】
if (cmd === 'find-dead') {
  const dir = resolve(root, fileArg || 'src')
  const strict = values.strict
  console.log(`\n🧟 正在扫描 ${dir} 查找僵尸文件/孤儿节点...${strict ? '（--strict 模式：含「仅被测试引用」的可疑项）' : ''}`)
  
  const graph = buildRefGraph()
  const dead = []
  const onlyTest = [] // 非孤儿，但仅被测试文件引用 → 疑似测试专用的废弃组件
  // 常见入口文件或构建态代码（strict 下收窄，避免 index/config/setup 误判为孤儿）
  const ENTRY_HINTS = strict
    ? ['main.', 'App.', 'index.', 'vite']
    : ['index.', 'main.', 'App.', 'router', 'setup', 'config', 'vite']

  const isTest = (abs) => basename(abs).includes('.test.') || basename(abs).includes('.spec.')

  for (const f of collectFiles(dir, [])) {
    if (isExemptAbs(f)) continue
    const base = basename(f)
    if (ENTRY_HINTS.some(h => base.includes(h))) continue
    if (isTest(f)) continue

    const importers = graph.get(f)
    if (!importers || importers.size === 0) {
      dead.push(f)
      continue
    }
    // --strict：被引用者全部是测试文件 → 业务侧已无引用，疑似测试专用或已废弃
    if (strict && [...importers].every(isTest)) {
      onlyTest.push(f)
    }
  }

  if (dead.length === 0 && onlyTest.length === 0) {
    console.log(`✔ 恭喜，未发现明显的孤儿代码！`)
  } else {
    if (dead.length) {
      console.log(`\n⚠ 发现 ${dead.length} 个无引用依赖的文件（疑似废弃代码）：`)
      for (const f of dead) console.log(`   - ${relOf(f)}`)
    }
    if (onlyTest.length) {
      console.log(`\n🔎 发现 ${onlyTest.length} 个「仅被测试引用」的文件（业务侧已无引用，疑似废弃）：`)
      for (const f of onlyTest) {
        const t = [...graph.get(f)].map(relOf).join(', ')
        console.log(`   - ${relOf(f)}\n       仅被引用：${t}`)
      }
    }
    console.log(`\n[提示] 请人工核实：这些文件未被 AST 探测到任何明确的 import/require 引用。`)
    console.log(`可能原因：1. 确实是废弃代码； 2. 通过动态拼接字符串黑魔法引入； 3. 这是个独立入口点。`)
  }
  printWarnings()
  process.exit(0)
}

// 【特性 1: 批量转叶子节点】
if (cmd === 'batch') {
  const dir = resolve(root, fileArg || 'src')
  const limitArg = Number(values.limit)
  const graph = buildRefGraph()

  const pending = []
  for (const f of collectFiles(dir, [])) {
    if (!['.js', '.jsx'].includes(extname(f))) continue
    if (isExemptAbs(f)) continue
    
    const refCount = graph.get(f) ? graph.get(f).size : 0
    if (refCount === 0) {
      const code = readFileSync(f, 'utf8')
      pending.push({ abs: f, to: detectExt(code, toFlag) })
    }
  }
  
  if (pending.length === 0) {
    console.log(`\nℹ 目录 ${dir} 下暂无可安全的叶子节点（引用数为 0 的 js/jsx）。`)
    process.exit(0)
  }

  // 叶子排序，优先处理浅层文件
  pending.sort((a, b) => a.abs.localeCompare(b.abs))
  const targets = pending.slice(0, limitArg)
  
  console.log(`\n🚀 [Batch] 找到 ${pending.length} 个叶子节点，本次将自动转换前 ${targets.length} 个...`)

  for (let i = 0; i < targets.length; i++) {
    const oldAbs = targets[i].abs
    const toExt = targets[i].to
    const oldExt = extname(oldAbs)
    const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + toExt
    const base = basename(oldAbs)

    console.log(`\n[${i+1}/${targets.length}] 处理 ${relOf(oldAbs)} ...`)

    if (!dry) {
      // 【特性 2: 注入 // @ts-nocheck】
      if (values.nocheck) {
        let currentCode = readFileSync(oldAbs, 'utf8')
        if (!currentCode.includes('// @ts-nocheck') && !currentCode.includes('// @ts-expect-error')) {
          writeFileSync(oldAbs, '// @ts-nocheck\n' + currentCode, 'utf8')
          console.log(`  ✔ 注入 // @ts-nocheck`)
        }
      }
      
      const how = renameFile(oldAbs, newAbs)
      if (!how) { console.error(`  ✖ 改名失败`); continue }
      console.log(`  ✔ 改名 ${base} → ${basename(newAbs)}`)
    } else {
      console.log(`  (预览) 拟改名 ${base} → ${basename(newAbs)}${values.nocheck ? ' (并注入 nocheck)' : ''}`)
    }

    const changed = rewriteImports(oldAbs, toExt, dry)
    if (changed.length > 0) {
      console.log(`  ✔ 同步 ${changed.length} 处引用: ${changed.map(c => basename(c)).join(', ')}`)
    }
  }
  
  if (dry) console.log('\n（--dry 仅预览，未实际落盘）')
  else console.log('\n🎉 批量转换完成！跑一遍 `npm run check:events` 确认健康状态吧。')
  
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
    // 【特性 2: 注入 // @ts-nocheck】
    if (values.nocheck) {
      let currentCode = readFileSync(oldAbs, 'utf8')
      if (!currentCode.includes('// @ts-nocheck') && !currentCode.includes('// @ts-expect-error')) {
        writeFileSync(oldAbs, '// @ts-nocheck\n' + currentCode, 'utf8')
        console.log(`✔ 注入 // @ts-nocheck`)
      }
    }
    
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

console.error(`未知命令：${cmd}\n用法：请查阅脚本源码顶部的 JSDoc`);
process.exit(1);
