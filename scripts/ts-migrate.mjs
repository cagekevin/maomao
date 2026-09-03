/**
 * ts-migrate.mjs — TS 规范化重构的「终极架构版」辅助脚本（完美时序 + 多根 + 事务型）
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 概览：本脚本做【机械改名/移动/目录搬运 + AST 全库同步 import 说明符】。
 * 它只负责「文件位置与引用的一致」，不处理 Props 接口、内部 any、契约表同步、
 * 测试验证、提交等——这些仍由你手动完成。
 *
 * 事务模型（Plan → Move → Commit）：
 *   1. Plan   内存规划全部 import 改写，不落盘；
 *   2. Move   执行 git mv / fs rename（物理改名/移动）；
 *   3. Commit 物理【成功后才】把内存改动一次性刷盘。
 *   → 物理失败时改动自动丢弃，绝不产生「import 已改、文件却没搬」的脏写中间态。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 全局选项（放在命令前，可多次/组合）：
 *   --root <dir>            追加扫描根（默认 src/ 与 tests/）。后端/子项目常用，
 *                           例：--root download/ai-relay/src  --root localTool/src
 *   --alias <from>:<to>     追加自定义 import 别名，如 --alias '@proto/:/src/protocol/'
 *                           （from 须以 / 结尾，to 相对扫描根，可多次）
 *   --suffix auto|ts|js     import 产物后缀策略（默认 auto）：
 *                               auto → 按目标源码推断运行后缀（.ts 源写 .js，ESM 约定）
 *                               ts   → 显式统一写 .ts；  js → 显式统一写 .js
 *   --dry                   只预览改动，不落盘、不改名（对 rename/move/move-dir/convert/batch 均生效）
 *   --force                 绕过永久豁免红线（convert 用）
 *
 * 其他命令专属选项见下。
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 命令：
 *   # 改扩展名 / 后缀（把 .js/.jsx → .ts/.tsx，自动同步引用方 import 后缀）
 *   convert <file> [--to ts|tsx] [--dry] [--force] [--nocheck]
 *       缺省按内容 JSX 判定（有 JSX → .tsx，纯逻辑 → .ts）。--nocheck 注入 // @ts-nocheck。
 *   update-imports <file> [--dry]      仅重写指向它的 import（文件已手动改名时用）
 *
 *   # 改文件名（目录不变）+ 全库同步引用 —— 语义化重命名
 *   rename <file> <newName> [--dry]    例：rename src/a.ts b.ts
 *       <newName> 可带或不带扩展名（缺省沿用旧扩展名）。同目录不可覆盖已存在文件。
 *
 *   # 移动文件（可顺带改名）+ 全库同步引用
 *   move <file> <targetDirOrFile> [--dry]
 *       目标为已存在目录 → 移入并保留 basename；
 *       目标为新文件路径   → 移动并改名（自动建目录）。
 *       文件已移动过、重跑 = 修复模式（只同步引用不重复移动）。
 *
 *   # 整目录搬运 + 一键回退 —— 搬一个目录并同步所有落其下的引用
 *   move-dir <srcDir> <dstDir> [--dry]
 *       dstDir 不存在则创建。任何文件移动失败 → 丢弃改写并提示回退。
 *   move-dir --undo [--dry]   按上次记录（scripts/.move-dir-undo.json）整目录回退并还原引用
 *
 *   # 只读侦察 / 视图
 *   refs <file>               列出谁 import 它 + 字符串残留引用位置（改名/搬移前先看影响面）
 *   plan [<dir>] [--limit N] [--all]
 *                             按引用量升序列待转 .js/.jsx（叶子优先），规划 convert 批次
 *   find-dead [<dir>] [--strict]
 *                             找孤儿/仅被测试引用的文件（启发式，删前人工核实）
 *   batch [<dir>] --limit N [--dry] [--nocheck]
 *                             批量 convert 引用数为 0 的叶子节点（危险度高于单文件，先 --dry）
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 常用示例：
 *   # 对子项目重命名并让全仓（含该根下测试 .mjs/.cjs）引用指向新名，ESM 项目保持 .js：
 *   node scripts/ts-migrate.mjs --root download/ai-relay/src rename download/ai-relay/src/connection.ts connectionTest.ts
 *   # 强制 import 写 .ts（纯 bundler / 开了 allowImportingTsExtensions 的项目）：
 *   node scripts/ts-migrate.mjs --root download/ai-relay/src --suffix ts rename download/ai-relay/src/a.ts b.ts
 *   # 先 dry 预览整目录搬运影响面：
 *   node scripts/ts-migrate.mjs --root localTool/src move-dir localTool/src/lib localTool/src/core --dry
 *   # 搬完发现不对，一键回退：
 *   node scripts/ts-migrate.mjs --root localTool/src move-dir --undo
 *   # 子项目自定义别名：@proto/ → src/protocol/
 *   node scripts/ts-migrate.mjs --alias '@proto/:/src/protocol/' rename src/x.ts y.ts
 *
 * 多根 Alias 说明：resolveSpec/computeNewSpec 通过 aliasTable 解析与生成，
 * 并依据「路径前缀最长的扫描根」判断别名归属，避免多根含嵌套时误判。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync, mkdirSync } from 'node:fs'
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

// 【修复 1: 扩大猎杀范围】测试脚本也需要参与引用同步
if (!SCAN_EXTS.includes('.mjs')) SCAN_EXTS.push('.mjs', '.cjs');
if (!SOURCE_EXTS.includes('.mjs')) SOURCE_EXTS.push('.mjs', '.cjs');

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')
const SCAN_ROOTS = [join(root, 'src'), join(root, 'tests')]

/** @type {Set<string>} */
const parseWarnings = new Set()

function toPosix(p) { return p.replace(/\\/g, '/') }
function relOf(abs) { return toPosix(abs.slice(root.length).replace(/^[/\\]/, '')) }
function isExemptAbs(abs) { return isExempt(relOf(abs)) }

// 【修复 2: 动态多根 + 可配置 Alias 解析】
// 别名前缀表：from(import 里出现的前缀) → to(相对所在扫描根的目录)。默认 @/ → src/。
// 可用 --alias <from>:<to> 追加子项目/自定义别名（如 @proto/ → src/protocol/、~core/ → src/core/）。
const DEFAULT_ALIASES = [['@/', 'src/']]
const aliasTable = new Map(DEFAULT_ALIASES)

/**
 * 找文件所属的「扫描根」：取与之路径前缀最长的 SCAN_ROOTS 项（避免两个根存在包含关系时误判）。
 * 找不到时回退到仓库根 src/。
 */
function getAliasRoot(fileAbs) {
  let best = null
  for (const r of SCAN_ROOTS) {
    if (fileAbs.startsWith(r) && (!best || r.length > best.length)) best = r
  }
  return best || join(root, 'src')
}

/** 找命中文件 spec 前缀的别名项；无则返回 null。返回该别名 to 的目标（不含前缀后的剩余段）。 */
function matchAlias(spec) {
  for (const [from, to] of aliasTable) {
    if (spec.startsWith(from)) return { alias: from, to }
  }
  return null
}

/**
 * 把 import 说明符解析为绝对路径。
 *  相对(. / ../) → 相对 fromFile 所在目录；
 *  别名(命中 aliasTable) → 相对 fromFile 所在扫描根的 <alias.to>/剩余段；
 *  / 开头 → 当作相对根路径（相对 fromFile 所在扫描根）。
 * @returns {string|null}
 */
function resolveSpec(spec, fromFile) {
  const fromDir = dirname(fromFile)
  if (spec.startsWith('.')) return resolve(fromDir, spec)
  const m = matchAlias(spec)
  if (m) return resolve(getAliasRoot(fromFile), m.to, spec.slice(m.alias.length))
  if (spec.startsWith('/')) return resolve(getAliasRoot(fromFile), spec.slice(1))
  return null
}

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

function allSources() {
  const set = new Set()
  for (const dir of SCAN_ROOTS) {
    if (!existsSync(dir)) continue
    collectFiles(dir, []).forEach((f) => set.add(f))
  }
  return [...set]
}

function extractImportNodes(code, filepath) {
  const nodes = []
  try {
    const ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true
    })

    if (ast.errors && ast.errors.length > 0) parseWarnings.add(`[语法错误] ${filepath}`)

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
        const isViMock =
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' && node.callee.object.name === 'vi' &&
          node.callee.property.type === 'Identifier' && node.callee.property.name === 'mock'
        if ((isRequire || isDynamicImport || (isViMock && node.arguments.length > 0)) && node.arguments.length > 0) {
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
    parseWarnings.add(`[解析崩溃] ${filepath}`)
    return null
  }
  return nodes
}

function buildRefGraph() {
  const graph = new Map()
  const push = (target, from) => {
    let set = graph.get(target)
    if (!set) { set = new Set(); graph.set(target, set) }
    set.add(from)
  }
  
  for (const file of allSources()) {
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue

    for (const node of nodes) {
      const abs = resolveSpec(node.value, file)
      if (abs === null) continue
      const target = resolveSourceFile(abs)
      if (!target || target === file) continue
      push(target, file)
    }
  }
  return graph
}

// 【修复 3: Alias 自动净化匹配多根 + 动态别名】
/**
 * 源码扩展名 → 该项目「运行时 import 应写的扩展名」映射（ESM 项目惯用 .js 指向 .ts 源）：
 *   .ts  → .js     （tsx/esbuild 会把 .js 解析回 .ts 源）
 *   .tsx → .jsx    （同前）
 *   .js  → .js     （真实 js 文件）
 *   .jsx → .jsx    （真实 jsx 文件）
 * 空 = 文件无源码扩展名时不做替换。
 */
function runtimeSuffixForSource(newAbs) {
  const e = extname(newAbs)
  if (e === '.ts') return '.js'
  if (e === '.tsx') return '.jsx'
  return e && SOURCE_EXTS.includes(e) ? e : ''
}

/**
 * 把一个「可能带源码扩展名」的规范说明符片段，套用 --suffix 策略归一：
 *   suffix='ts'   → 一律补 .ts（或 .tsx，若原目标带 tsx/含 JSX 场景——这里统一 ts）
 *   suffix='js'   → 一律补 .js（真实 .jsx 源也归 .js，见下）
 *   suffix='auto' → 按目标源码推导「运行时后缀」（.ts→.js / .tsx→.jsx / .js→.js）
 * 说明：suffix 是用户显式声明的「想要的项目 import 后缀」，它直接决定产物；auto 才是"智能推断"。
 * 仅处理带源码扩展名的片段；无扩展名片段（如 @/types、@/hooks/useX）原样保留。
 */
function applySpecSuffix(specStem, targetExt, suffix) {
  const st = toPosix(specStem)
  // 显式 ts：目标若是 .ts/.tsx 源，就按 .ts/.tsx；但用户想要统一 ts 就统 .ts。为精确，
  // 这里按目标真实源码扩展名给（.ts→.ts、.tsx→.tsx、.js→.js），让"生成 TS"落对扩展名。
  if (suffix === 'ts') {
    if (targetExt === '.ts' || targetExt === '.tsx') return st + targetExt
    return st + (targetExt || '')
  }
  // 显式 js：一律归 .js/.jsx（真实 .jsx 源仍 .jsx；.js/.ts 归 .js）
  if (suffix === 'js') {
    if (targetExt === '.tsx' || targetExt === '.jsx') return st + '.jsx'
    return st + '.js'
  }
  // auto：按目标源码推导运行时后缀
  const rs = runtimeSuffixForSource(st + targetExt)
  return rs ? st + rs : st
}

function computeNewSpec(fromFile, newAbs, oldSpec) {
  const currentRoot = getAliasRoot(fromFile)
  const targetExt = extname(newAbs)
  const mkRel = (rel) => (toPosix(rel).startsWith('.') ? toPosix(rel) : './' + toPosix(rel))
  const stripExt = (p) => p.replace(/\.[a-z0-9]+$/i, '')

  // 旧 spec 原本是别名形式 → 保持别名前缀；alias 惯用不带后缀，仅当显式 --suffix 非 auto 时补全
  const m = matchAlias(oldSpec)
  if (m && newAbs.startsWith(currentRoot)) {
    const aliasRel = stripExt(toPosix(relative(resolve(currentRoot, m.to), newAbs)))
    return suffixMode === 'auto' ? m.alias + aliasRel : m.alias + applySpecSuffix(aliasRel, targetExt, suffixMode)
  }

  // 普通相对路径：去掉目标扩展名算出 stem，再按 suffix 策略决定产物扩展名
  let rel = stripExt(toPosix(relative(dirname(fromFile), newAbs)))

  // 相对过深(≥2 层回退)且目标仍在本根内 → 净化成 @/ 别名（仅 auto 下，别名不带后缀）
  if (rel.startsWith('../../') && newAbs.startsWith(currentRoot) && suffixMode === 'auto') {
    return '@/' + stripExt(toPosix(relative(currentRoot, newAbs)))
  }

  return mkRel(applySpecSuffix(rel, targetExt, suffixMode))
}

/**
 * 【事务型重构 v2】把「引用改写」拆成两个阶段：
 *   1. planImportRewrites —— 只读扫描 + 在【内存】生成每文件的改写后文本，绝不落盘；
 *   2. commitPendingWrites —— 由调用方在物理移动(git mv / rename)【成功后】显式调用，
 *      一次性把内存中的改动刷入磁盘。
 * 好处：物理移动失败时，内存改动直接丢弃，不产生「import 已改、文件却没搬」的脏写中间态。
 *
 * 返回 { pendingWrites: Map<fileAbs, newSourceText>, diffLogs: [{file, diffs}] }
 */
function planImportRewrites(oldAbs, makeNewSpec, skip = new Set()) {
  /** @type {Map<string, string>} */
  const pendingWrites = new Map()
  /** @type {Array<{file:string, diffs:Array<{old:string,new:string}>}>} */
  const diffLogs = []

  for (const file of allSources()) {
    if (skip.has(file)) continue
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }

    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue

    const hits = nodes.filter(node => {
      const abs = resolveSpec(node.value, file)
      if (abs === null) return false

      const target = resolveSourceFile(abs)
      if (target !== null && target === oldAbs) return true

      // 兜底：目标已不存在（如已被物理改名/移动），按去扩展名的路径比对，
      // 保证「文件已先动、引用还指着旧路径」时也能被找出来（旧版脏写踩坑点）。
      if (!target) {
        const baseAbs = abs.replace(/\.(jsx?|tsx?|mjs|cjs)$/, '')
        const oldBase = oldAbs.replace(/\.(jsx?|tsx?|mjs|cjs)$/, '')
        if (baseAbs === oldBase) return true
      }
      return false
    })

    if (hits.length > 0) {
      hits.sort((a, b) => b.start - a.start)
      let nextSrc = src
      const fileDiffs = []
      for (const node of hits) {
        const newSpec = makeNewSpec(file, node.value)
        if (newSpec === node.value) continue
        fileDiffs.push({ old: node.value, new: newSpec })
        const q = nextSrc[node.start]
        nextSrc = nextSrc.slice(0, node.start) + `${q}${newSpec}${q}` + nextSrc.slice(node.end)
      }
      if (fileDiffs.length > 0) {
        diffLogs.push({ file: relOf(file), diffs: fileDiffs })
        pendingWrites.set(file, nextSrc)
      }
    }
  }
  return { pendingWrites, diffLogs }
}

/** 事务提交：把内存中的待写改动一次性刷盘。返回写入的文件数。 */
function commitPendingWrites(pendingWrites) {
  let n = 0
  for (const [file, nextSrc] of pendingWrites.entries()) {
    writeFileSync(file, nextSrc, 'utf8')
    n++
  }
  return n
}

function rewriteImports(oldAbs, newExt) {
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + newExt
  // convert/batch：物理改扩展名(.js→.ts)。import 后缀按 suffix 策略落：
  //   auto → 沿用「指向 .ts 源写 .js」的项目约定（import 后缀由 newExt 推导运行后缀）；
  //   ts/js → 显式统一成对应后缀。
  // 复用 applySpecSuffix：specStem=去旧后缀的路径，targetExt=新文件真实后缀。
  return planImportRewrites(oldAbs, (_fromFile, fullSpec) => {
    const specExt = extname(fullSpec)
    if (!SOURCE_EXTS.includes(specExt)) return fullSpec
    const stem = fullSpec.slice(0, fullSpec.length - specExt.length)
    return applySpecSuffix(stem, newExt, suffixMode)
  }, new Set([oldAbs, newAbs]))
}

function rewriteImportsForMove(oldAbs, newAbs) {
  return planImportRewrites(oldAbs, (fromFile, fullSpec) => computeNewSpec(fromFile, newAbs, fullSpec))
}

/** 递归收集 srcDir 下所有源码文件绝对路径（稳定排序：目录序 + 文件名序）。 */
function collectSourceFilesUnder(srcDir, acc = []) {
  for (const name of readdirSync(srcDir)) {
    const full = join(srcDir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) collectSourceFilesUnder(full, acc)
    else if (SOURCE_EXTS.includes(extname(name))) acc.push(full)
  }
  return acc
}

/**
 * 【整目录搬动】对「所有 import 解析后落在 oldDir 下」的说明符，重算为指向 dstDir 下对应文件。
 * 事务型：只规划、不落盘。关键区别见 rewriteImportsForMove：本函数不依赖旧文件是否还存在——
 * 只要说明符解析后的绝对路径落在 oldDir 下即命中（整目录已 git mv 走、import 还写旧目录段时也能命中）。
 * @param oldDir 移动前目录绝对路径
 * @param newDir 移动后目录绝对路径（含目录名）
 * @returns {{pendingWrites:Map<string,string>, diffLogs:Array}}
 */
function planDirMoveRewrites(oldDir, newDir) {
  const pendingWrites = new Map()
  const diffLogs = []
  for (const file of allSources()) {
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    const nodes = extractImportNodes(src, relOf(file))
    if (!nodes) continue
    // 命中判定与生成都要用「真实源文件」解析（resolveSourceFile 归一化 import 写的 .js → 真实 .ts），
    // 否则 newAbs 会带上 import 里写的 .js，导致 applySpecSuffix 的 targetExt 判错。
    const hits = nodes.filter((node) => {
      const spec = node.value
      if (!(spec.startsWith('.') || matchAlias(spec) || spec.startsWith('/'))) return false
      const abs = resolveSpec(spec, file)
      if (abs === null) return false
      const real = resolveSourceFile(abs)
      const under = real || abs
      const relUnder = toPosix(relative(oldDir, under))
      return relUnder !== '' && !relUnder.startsWith('..')
    })
    if (hits.length === 0) continue
    hits.sort((a, b) => b.start - a.start)
    let nextSrc = src
    const diffs = []
    for (const node of hits) {
      const abs = resolveSpec(node.value, file)
      // 归一化到真实源文件（若文件已被 git mv 走、解析不到，退回用 abs）
      const real = resolveSourceFile(abs)
      const under = real || abs
      const relUnder = toPosix(relative(oldDir, under))
      const newAbs = join(newDir, relUnder)
      const newSpec = computeNewSpec(file, newAbs, node.value)
      if (newSpec === node.value) continue
      diffs.push({ old: node.value, new: newSpec })
      const q = nextSrc[node.start]
      nextSrc = nextSrc.slice(0, node.start) + `${q}${newSpec}${q}` + nextSrc.slice(node.end)
    }
    if (diffs.length > 0) {
      diffLogs.push({ file: relOf(file), diffs })
      pendingWrites.set(file, nextSrc)
    }
  }
  return { pendingWrites, diffLogs }
}

/**
 * 重写【被移动文件自身】的出向 import（其相对基准随移动变了）。
 * 事务型：只规划、不落盘；返回 { pendingWrites, diffLogs }，由调用方在物理移动成功后 commit。
 * ▎bug 修复(2026-09-04)：原实现用单个 fileAbs 同时当「读取源」「生成锚点」「回写目标」——但本函数
 *   在 Plan 阶段（物理移动前）被调用，此时文件还在旧位置，fileAbs=newAbs 尚不存在 → readFileSync 抛错
 *   被 catch 吞掉，导致 move/move-dir 的出向 import 从未被重写。现拆成三参数：
 * @param readFromAbs 读取源：当前文件实际所在路径（Plan 阶段 = 旧路径，物理移动前仍存在）
 * @param writeToAbs  回写目标 + 生成锚点：移动后的目标路径（物理移动成功后文件在此，computeNewSpec 以此
 *                    为基准算嵌套 ../，pendingWrites 也以此为主键回写）
 * @param baseDirForResolve 用于解析其相对 import 的基准目录（= 旧目录），
 *                          内容按移动前位置写，须用旧目录解析才命中目标；Node relative() 会自动算嵌套 ../。
 */
function planOutgoingRewrites(readFromAbs, writeToAbs, baseDirForResolve) {
  let src
  try { src = readFileSync(readFromAbs, 'utf8') } catch { return { pendingWrites: new Map(), diffLogs: [] } }

  const nodes = extractImportNodes(src, relOf(readFromAbs))
  if (!nodes) return { pendingWrites: new Map(), diffLogs: [] }

  let hit = false
  let nextSrc = src
  const diffs = []

  nodes.sort((a, b) => b.start - a.start).forEach(node => {
    const spec = node.value
    if (!(spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('/'))) return
    // 自身 import 的相对基准 = 移动前的所在目录（文件内容尚未变，仍按旧目录解析才找得到目标）
    const abs = resolveSpec(spec, join(baseDirForResolve, '_self_placeholder.ts'))
    if (abs === null) return

    const newSpec = computeNewSpec(writeToAbs, abs, spec)
    if (newSpec !== spec) {
      hit = true
      diffs.push({ old: spec, new: newSpec })
      const q = nextSrc[node.start]
      nextSrc = nextSrc.slice(0, node.start) + `${q}${newSpec}${q}` + nextSrc.slice(node.end)
    }
  })

  const pendingWrites = new Map()
  if (hit) pendingWrites.set(writeToAbs, nextSrc)
  return { pendingWrites, diffLogs: hit ? diffs : [] }
}

// 【修复 5: 严格拒绝静默丢失 Git 历史】
function renameFile(oldAbs, newAbs) {
  const rel = relOf(oldAbs)
  const isTracked = spawnSync('git', ['ls-files', '--error-unmatch', rel], { cwd: root }).status === 0;
  
  const res = spawnSync('git', ['mv', '--', rel, relOf(newAbs)], { cwd: root })
  if (res.status === 0) return 'git mv'
  
  if (isTracked) {
    console.error(`\n✖ 严重警告：${rel} 被 Git 跟踪，但 git mv 失败！`);
    console.error(`  为防止丢失历史记录，拒绝静默降级为 fs rename。请检查目标是否已存在或目录权限。`);
    return null;
  }
  
  try { 
    renameSync(oldAbs, newAbs); 
    return 'fs rename (未跟踪文件)' 
  } catch (err) { 
    return null 
  }
}

function printDiffLog(changedFiles) {
  if (changedFiles.length === 0) {
    console.log(`ℹ 无其他文件引用需同步`)
    return
  }
  console.log(`✔ 已同步 ${changedFiles.length} 个文件的 import：`)
  for (const c of changedFiles) {
    console.log(`   📝 ${c.file}`)
    for (const d of c.diffs) {
      console.log(`      - ${d.old}\n      + ${d.new}`)
    }
  }
}

function printWarnings() {
  if (parseWarnings.size > 0) {
    console.log('\n⚠ 发现解析告警：')
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
    count: { type: 'boolean', default: false }, 
    nocheck: { type: 'boolean', default: false }, 
    root: { type: 'string', multiple: true },      
    alias: { type: 'string', multiple: true },   // 追加自定义别名：--alias <from>:<to>，可多次
    suffix: { type: 'string', default: 'auto' }, // import 产物后缀：auto(默认,按目标源码推断) | ts | js
    undo: { type: 'boolean', default: false },     
  },
  allowPositionals: true,
})

// import 产物后缀策略：默认 auto = 对 .ts 源生成 .js（ESM 惯用）；显式 ts/js 强制统一。
const suffixMode = ['auto', 'ts', 'js'].includes(values.suffix) ? values.suffix : 'auto'

if (values.root) {
  for (const r of values.root) {
    const abs = resolve(root, r)
    if (!existsSync(abs)) { console.error(`✖ --root 目录不存在：${r}`); process.exit(1) }
    if (!SCAN_ROOTS.some((existing) => existing === abs)) SCAN_ROOTS.push(abs)
  }
}

// 注入自定义别名（须在 --root 之后，因 to 相对各扫描根解析）。格式 "@proto/:/src/protocol/" 等。
if (values.alias) {
  for (const a of values.alias) {
    const idx = a.indexOf(':')
    if (idx <= 0) { console.error(`✖ --alias 格式应为 <from>:<to>，收到：${a}`); process.exit(1) }
    const from = a.slice(0, idx)
    const to = a.slice(idx + 1).replace(/^\/+/, '') // 去掉用户可能带的根斜杠
    if (!from.endsWith('/')) { console.error(`✖ alias from 应以 '/' 结尾：${from}`); process.exit(1) }
    aliasTable.set(from, to)
  }
}

const cmd = positionals[0]
const fileArg = positionals[1]
const toFlag = values.to
const dry = values.dry

// 工具函数：为无明确传参的目录提供智能推断，不再只盯 src/
function getDefaultDirArg() {
  return fileArg ? resolve(root, fileArg) : SCAN_ROOTS[0] || resolve(root, 'src');
}

if (cmd === 'plan') {
  const dir = getDefaultDirArg()
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
  console.log(`\n待转 ${pending.length} 个文件... [排除豁免 ${exemptSkipped} 个]`)
  const shown = all ? pending : pending.slice(0, limitArg)
  for (const f of shown) console.log(`  ${String(f.refs).padStart(3)} 引用  ${f.file.padEnd(64)} → ${f.to}`)
  process.exit(0)
}

// 【修复 6: 显式提示被豁免的探查特征】
if (cmd === 'find-dead') {
  const dir = getDefaultDirArg()
  const strict = values.strict
  console.log(`\n🧟 正在扫描 ${relOf(dir)} 查找僵尸文件...${strict ? '（含仅被测试引用的项目）' : ''}`)
  
  const graph = buildRefGraph()
  const dead = [], onlyTest = [], exempted = []
  const ENTRY_HINTS = strict ? ['main.', 'App.', 'index.', 'vite'] : ['index.', 'main.', 'App.', 'router', 'setup', 'config', 'vite']
  const isTest = (abs) => basename(abs).includes('.test.') || basename(abs).includes('.spec.')

  for (const f of collectFiles(dir, [])) {
    if (isExemptAbs(f)) continue
    const base = basename(f)
    if (ENTRY_HINTS.some(h => base.includes(h))) {
      exempted.push(f); continue;
    }
    if (isTest(f)) continue

    const importers = graph.get(f)
    if (!importers || importers.size === 0) dead.push(f)
    else if (strict && [...importers].every(isTest)) onlyTest.push(f)
  }

  if (exempted.length > 0) {
    console.log(`\n🛡 以下文件因包含特定关键字(${ENTRY_HINTS.join(', ')})被启发式规则跳过判定：`);
    console.log(`   (共 ${exempted.length} 个文件，如有遗漏请人工检查)`);
  }

  if (dead.length === 0 && onlyTest.length === 0) {
    console.log(`\n✔ 扫描完毕，未发现明确的无引用代码。`)
  } else {
    if (dead.length) {
      console.log(`\n⚠ 发现 ${dead.length} 个无引用依赖的文件：`)
      for (const f of dead) console.log(`   - ${relOf(f)}`)
    }
  }
  process.exit(0)
}

if (cmd === 'batch') {
  const dir = getDefaultDirArg()
  const limitArg = Number(values.limit)
  const graph = buildRefGraph()
  const pending = []
  
  for (const f of collectFiles(dir, [])) {
    if (!['.js', '.jsx'].includes(extname(f))) continue
    if (isExemptAbs(f)) continue
    if (!graph.get(f) || graph.get(f).size === 0) pending.push({ abs: f, to: detectExt(readFileSync(f, 'utf8'), toFlag) })
  }
  
  if (pending.length === 0) { console.log(`\nℹ 目录暂无可安全的叶子节点。`); process.exit(0) }
  const targets = pending.sort((a, b) => a.abs.localeCompare(b.abs)).slice(0, limitArg)

  for (let i = 0; i < targets.length; i++) {
    const oldAbs = targets[i].abs
    const toExt = targets[i].to
    const oldExt = extname(oldAbs)
    const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + toExt

    console.log(`\n[${i+1}/${targets.length}] 处理 ${relOf(oldAbs)} ...`)

    // Phase 1 — Plan：内存规划引用改写，不落盘
    const { pendingWrites, diffLogs } = rewriteImports(oldAbs, toExt)
    if (diffLogs.length > 0) console.log(`  ✔ 规划 ${diffLogs.length} 个引用方`)

    if (dry) { console.log(`  (预览) 拟改名 → ${basename(newAbs)}`); continue }

    // Phase 2 — Move：物理改名（git mv / fs rename）。失败 → 丢弃内存改动，零污染
    const how = renameFile(oldAbs, newAbs)
    if (!how) {
      console.error(`  ✖ 改名失败，已丢弃本次规划的内存改动（${relOf(oldAbs)} 未变化）`)
      continue
    }
    console.log(`  ✔ 改名 → ${basename(newAbs)} (${how})`)

    // Phase 3 — Commit：物理成功后一次性刷盘引用改写
    commitPendingWrites(pendingWrites)
  }
  if (dry) console.log('\n（--dry 仅预览，未实际落盘）')
  printWarnings(); process.exit(0)
}

if (cmd === 'convert' || cmd === 'update-imports') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const oldAbs = resolve(root, fileArg)
  if (!existsSync(oldAbs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  if (isExemptAbs(oldAbs) && !values.force) { console.error(`✖ 拒绝转换：${relOf(oldAbs)} 属永久豁免`); process.exit(1) }
  
  const toExt = detectExt(readFileSync(oldAbs, 'utf8'), toFlag)
  const newAbs = oldAbs.slice(0, oldAbs.length - extname(oldAbs).length) + toExt

  // Phase 1 — Plan：内存规划引用改写，不落盘
  const { pendingWrites, diffLogs } = rewriteImports(oldAbs, toExt)

  if (dry) {
    printDiffLog(diffLogs)
    console.log('（--dry 仅预览，未实际落盘/改名）')
    printWarnings(); process.exit(0)
  }

  // update-imports：文件已改名/移动，直接提交引用改写（不 rename）
  if (cmd === 'update-imports') {
    commitPendingWrites(pendingWrites)
    printDiffLog(diffLogs)
    printWarnings(); process.exit(0)
  }

  // convert：Phase 2 Move → Phase 3 Commit。物理失败丢弃内存改动，零污染
  const how = renameFile(oldAbs, newAbs)
  if (!how) {
    console.error('✖ 物理改名失败，已丢弃所有引用改写，系统保持一致。')
    process.exit(1)
  }
  console.log(`✔ 改名 ${basename(oldAbs)} → ${basename(newAbs)}（${how}）`)
  commitPendingWrites(pendingWrites)
  printDiffLog(diffLogs)
  printWarnings(); process.exit(0)
}

// 【修复 7: move 支持文件直接重命名】
if (cmd === 'move') {
  const targetArg = positionals[2]
  if (!fileArg || !targetArg) { console.error('用法：move <file> <targetDir/targetFile> [--dry]'); process.exit(1) }
  
  const oldAbs = resolve(root, fileArg)
  let targetAbs = resolve(root, targetArg)
  
  let newAbs;
  if (existsSync(targetAbs) && statSync(targetAbs).isDirectory()) {
    newAbs = join(targetAbs, basename(oldAbs))
  } else {
    newAbs = targetAbs
    const targetDir = dirname(newAbs)
    if (!dry && !existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
  }
  
  const alreadyMoved = !existsSync(oldAbs) && existsSync(newAbs)
  if (!existsSync(oldAbs) && !alreadyMoved) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  if (alreadyMoved) console.log(`ℹ 文件已在目标位置，进入修复模式`)

  // Phase 1 — Plan：同时规划「外部引用方 incoming」与「自身出向 outgoing」，全部不落盘
  const { pendingWrites: incWrites, diffLogs: incDiffs } = alreadyMoved
    ? planImportRewrites(newAbs, (fromFile, fullSpec) => computeNewSpec(fromFile, newAbs, fullSpec))
    : rewriteImportsForMove(oldAbs, newAbs)

  // 自身出向 import 重写：内容是按【移动前】的位置写的，故以 dirname(oldAbs) 为解析基准才能
  // 命中目标文件；改写后的新说明符要指向同一目标，故以【移动后】位置 newAbs 为生成基准。
  // Node relative(newAbs→目标) 会正确算出嵌套 ../，深层目录搬移不会算错。
  const { pendingWrites: selfWrites, diffLogs: selfDiffs } = planOutgoingRewrites(
    oldAbs, // 读取源：Plan 阶段文件仍在旧位置，从这里读内容
    newAbs, // 回写目标 + 生成锚点：物理移动成功后文件在此，以它算嵌套 ../ 并回写
    dirname(oldAbs), // 解析基准：内容按旧位置写的 import 才能命中目标
  )

  if (dry) {
    printDiffLog(incDiffs)
    if (selfDiffs.length) { console.log('   [自身出向]'); for (const d of selfDiffs) console.log(`      - ${d.old}\n      + ${d.new}`) }
    console.log('（--dry 仅预览，未实际落盘）')
    printWarnings(); process.exit(0)
  }

  // Phase 2 — Move：物理移动/改名。失败 → 丢弃全部内存改动，零污染
  if (!alreadyMoved) {
    const how = renameFile(oldAbs, newAbs)
    if (!how) {
      console.error('✖ 物理移动失败，已丢弃所有引用改写，系统保持一致。')
      process.exit(1)
    }
    console.log(`✔ 移动/改名 ${relOf(oldAbs)} → ${relOf(newAbs)}（${how}）`)
  }

  // Phase 3 — Commit：物理成功后一次性刷盘
  commitPendingWrites(incWrites)
  commitPendingWrites(selfWrites)
  printDiffLog(incDiffs)
  if (selfDiffs.length) { console.log('✔ 已重写自身出向 import：'); for (const d of selfDiffs) console.log(`      - ${d.old}\n      + ${d.new}`) }
  printWarnings(); process.exit(0)
}

if (cmd === 'rename') {
  const newName = positionals[2]
  if (!fileArg || !newName) { console.error('用法：rename <file> <newName> [--dry]'); process.exit(1) }
  if (newName.includes('/') || newName.includes('\\')) { console.error('✖ rename 只改文件名'); process.exit(1) }
  
  const oldAbs = resolve(root, fileArg)
  if (!existsSync(oldAbs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  
  const oldExt = extname(oldAbs)
  const nb = basename(newName)
  const newAbs = join(dirname(oldAbs), nb.toLowerCase().endsWith(oldExt) ? nb : nb + oldExt)
  if (newAbs === oldAbs) { console.error('✖ 新旧名相同'); process.exit(1) }
  if (existsSync(newAbs)) { console.error(`✖ 目标文件已存在，阻止静默覆盖！`); process.exit(1) }

  // Phase 1 — Plan：改名不换目录，自身出向相对路径不变，只需规划外部引用方改写
  const { pendingWrites, diffLogs } = rewriteImportsForMove(oldAbs, newAbs)

  if (dry) {
    console.log(`(预览) 改名 ${relOf(oldAbs)} → ${relOf(newAbs)}`)
    printDiffLog(diffLogs)
    printWarnings(); process.exit(0)
  }

  // Phase 2 — Move：物理改名。失败 → 丢弃内存改动，零污染
  const how = renameFile(oldAbs, newAbs)
  if (!how) {
    console.error('✖ 物理改名失败，已丢弃所有引用改写，系统保持一致。')
    process.exit(1)
  }
  console.log(`✔ 改名 ${basename(oldAbs)} → ${basename(newAbs)}（${how}）`)

  // Phase 3 — Commit
  commitPendingWrites(pendingWrites)
  printDiffLog(diffLogs)
  printWarnings(); process.exit(0)
}

// ============================================================================
// move-dir：整目录搬运 + 一键回退（undo）
//   命令：move-dir <srcDir> <dstDir> [--dry]
//         move-dir --undo  [--dry]
//   时序（事务型）：
//     Plan  → 内存规划：全部文件的入向/出向引用改写（不落盘）
//     Move  → 逐文件 git mv/rename 到 dstDir，边移边记录 undo manifest
//     Commit→ 全部物理移动成功后，一次性刷盘所有引用改写
//    失败策略：任一物理移动失败 → 丢弃内存改写、写回退清单，提示可 move-dir --undo
// ============================================================================
if (cmd === 'move-dir') {
  const UNDO_MANIFEST = join(__dirname, '.move-dir-undo.json')

  // ── 回退模式：move-dir --undo ──
  if (values.undo) {
    if (!existsSync(UNDO_MANIFEST)) { console.error('✖ 没有可回退的 move-dir 记录（无 .move-dir-undo.json）'); process.exit(1) }
    let manifest
    try { manifest = JSON.parse(readFileSync(UNDO_MANIFEST, 'utf8')) } catch { console.error('✖ 回退清单损坏'); process.exit(1) }
    const { srcDir, dstDir, pairs } = manifest
    if (dry) { console.log(`(预览) 将把 ${relOf(dstDir)} 下 ${pairs.length} 个文件移回 ${relOf(srcDir)} 并还原引用`); process.exit(0) }

    // 1) 先还原外部入向引用（把落在 dstDir 的说明符算回 srcDir 对应位置）→ 物理移回前不落盘？
    //    为安全：先物理移回所有文件（避免"引用已改但文件还在 dstDir"），再统一还原引用。
    let undoFail = false
    for (const { oldAbs, newAbs } of pairs) {
      if (!existsSync(newAbs)) { console.log(`  ℹ 跳过（不存在）：${relOf(newAbs)}`); continue }
      const how = renameFile(newAbs, oldAbs)
      if (!how) { console.error(`  ✖ 移回失败：${relOf(newAbs)}`); undoFail = true }
      else console.log(`✔ ${relOf(newAbs)} → ${relOf(oldAbs)}（${how}）`)
    }
    if (undoFail) { console.error('✖ 部分文件移回失败，回退清单保留，请人工处理。'); process.exit(1) }

    // 2) 引用还原：外部 import 由 dstDir 指回 srcDir；被移文件的自身出向也已随物理位置复原
    const { pendingWrites: backWrites, diffLogs: backDiffs } = planDirMoveRewrites(dstDir, srcDir)
    commitPendingWrites(backWrites)
    printDiffLog(backDiffs)

    // 3) 成功后清除清单
    try { writeFileSync(UNDO_MANIFEST, '[]', 'utf8') } catch {}
    console.log('\n✔ 已完整回退，undo 清单已清空。')
    printWarnings(); process.exit(0)
  }

  const targetArg = positionals[2]
  if (!fileArg || !targetArg) { console.error('用法：move-dir <srcDir> <dstDir> [--dry] | move-dir --undo'); process.exit(1) }
  const srcDir = resolve(root, fileArg)
  const dstDir = resolve(root, targetArg)
  if (!existsSync(srcDir)) { console.error(`源目录不存在：${fileArg}`); process.exit(1) }
  if (existsSync(dstDir) && !statSync(dstDir).isDirectory()) { console.error(`✖ 目标已存在且非目录：${targetArg}`); process.exit(1) }
  if (dry && !existsSync(dstDir)) mkdirSync(dstDir, { recursive: true }) // dry 也建出以便正常 resolve

  // 收集待搬文件（稳定顺序）
  const toMove = collectSourceFilesUnder(srcDir, [])
  if (toMove.length === 0) { console.error(`源目录下无源码文件可搬：${fileArg}`); process.exit(1) }
  console.log(`\n计划将 ${srcDir} 下 ${toMove.length} 个源码文件搬到 ${dstDir}`)

  // Phase 1 — Plan：先规划所有外部引用改写（旧目录→新目录），并逐文件规划自身出向
  const { pendingWrites: incoming, diffLogs: incomingDiffs } = planDirMoveRewrites(srcDir, dstDir)
  const pairs = [] // { oldAbs, newAbs }
  const selfLogs = []
  for (const oldAbs of toMove) {
    const relUnder = toPosix(relative(srcDir, oldAbs))
    const newAbs = join(dstDir, relUnder)
    pairs.push({ oldAbs, newAbs })
    // 自身出向：内容按旧位置写 → 以 dirname(oldAbs) 解析基准；改写后指向目标 → 生成基准用 newAbs。
    const selfPlan = planOutgoingRewrites(oldAbs, newAbs, dirname(oldAbs))
    if (selfPlan.diffLogs.length) selfLogs.push({ file: relOf(oldAbs), diffs: selfPlan.diffLogs, plan: selfPlan })
  }

  if (dry) {
    printDiffLog(incomingDiffs)
    if (selfLogs.length) { console.log('   [被搬文件自身出向]'); for (const s of selfLogs) for (const d of s.diffs) console.log(`      ${s.file}: - ${d.old}\n        + ${d.new}`) }
    console.log(`\n（--dry 仅预览，共 ${pairs.length} 个文件待搬。可先执行无 dry 落地；出错可用 move-dir --undo 回退）`)
    printWarnings(); process.exit(0)
  }

  // Phase 2 — Move：逐文件物理移动 + 写 undo manifest
  mkdirSync(dstDir, { recursive: true })
  let moveFailed = false
  const movedPairs = []
  for (const { oldAbs, newAbs } of pairs) {
    if (existsSync(newAbs)) { console.error(`  ✖ 目标已存在，跳过：${relOf(newAbs)}`); moveFailed = true; continue }
    mkdirSync(dirname(newAbs), { recursive: true })
    const how = renameFile(oldAbs, newAbs)
    if (!how) { console.error(`  ✖ 移动失败：${relOf(oldAbs)}`); moveFailed = true; continue }
    console.log(`✔ ${relOf(oldAbs)} → ${relOf(newAbs)}（${how}）`)
    movedPairs.push({ oldAbs, newAbs })
  }
  // 无论是否全成，先把已成功的记入清单，便于失败后按已搬部分回退
  try { writeFileSync(UNDO_MANIFEST, JSON.stringify({ srcDir, dstDir, pairs: movedPairs }, null, 2), 'utf8') } catch {}

  if (moveFailed) {
    console.error(`\n✖ 部分文件移动失败，已丢弃全部引用改写（未 commit）。`)
    console.error(`  已成功移动 ${movedPairs.length} 个文件已记录到回退清单。`)
    console.error(`  修复问题后：node scripts/ts-migrate.mjs move-dir --undo 可移回已搬部分。`)
    printWarnings(); process.exit(1)
  }

  // Phase 3 — Commit：全部移动成功 → 刷盘所有外部引用改写 + 被搬文件自身出向
  commitPendingWrites(incoming)
  for (const s of selfLogs) commitPendingWrites(s.plan.pendingWrites)
  printDiffLog(incomingDiffs)
  if (selfLogs.length) {
    console.log(`✔ 已重写 ${selfLogs.length} 个被搬文件自身的出向 import：`)
    for (const s of selfLogs) for (const d of s.diffs) console.log(`      - ${d.old}\n      + ${d.new}`)
  }
  console.log(`\nℹ 已记录回退清单 scripts/.move-dir-undo.json。出错回退：node scripts/ts-migrate.mjs move-dir --undo`)
  printWarnings(); process.exit(0)
}

// ============================================================================
// refs：列出某模块被谁 import + 字符串残留引用位置（改名/搬移前的事先勘察）
// ============================================================================
const STRING_REF_EXT_RE = /\.(js|jsx|ts|tsx|mjs|cjs|json|html|md)$/
const STRING_REF_SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dev', 'coverage', 'archived'])

/** 递归收集仓库文本文件（用于字符串残留扫描），仅覆盖各扫描根 + scripts。 */
function collectTextFilesUnder(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      if (STRING_REF_SKIP_DIRS.has(name)) continue
      collectTextFilesUnder(full, acc)
    } else if (STRING_REF_EXT_RE.test(name)) acc.push(full)
  }
  return acc
}

/** 在仓库文本里找把「文件名(不带扩展名/带扩展名)」硬编码成字符串的位置（非 import 说明符）。 */
function findStringRefs(basenameWithExt) {
  const hits = []
  const roots = [...new Set([...SCAN_ROOTS, join(root, 'scripts')])]
  const files = new Set()
  for (const r of roots) if (existsSync(r)) collectTextFilesUnder(r, []).forEach((f) => files.add(f))
  const stem = basenameWithExt.replace(/\.(jsx?|tsx?|mjs|cjs)$/, '')
  for (const file of files) {
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes(basenameWithExt) || line.includes(stem)) {
        hits.push({ file: relOf(file), line: i + 1, text: line.trim().slice(0, 160) })
      }
    }
  }
  return hits
}

if (cmd === 'refs') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const abs = resolve(root, fileArg)
  if (!existsSync(abs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
  const graph = buildRefGraph()

  const importers = [...(graph.get(abs) || [])].sort()
  console.log(`\n① 模块引用 ${importers.length} 处（convert/rename/move/move-dir 会自动改写这些 import）：`)
  for (const f of importers) console.log('   - ' + relOf(f))
  if (importers.length === 0) console.log('   （无）')

  const strRefs = findStringRefs(basename(abs))
  console.log(`\n② 字符串残留引用 ${strRefs.length} 处（脚本【不】改字符串，需手工同步）：`)
  for (const h of strRefs) console.log(`   - ${h.file}:${h.line}\n       ${h.text}`)
  if (strRefs.length === 0) console.log('   （无）')

  printWarnings(); process.exit(0)
}

console.error(`未知或省略的命令：${cmd}\n已知命令：convert / update-imports / move / rename / move-dir / batch / plan / refs / find-dead\n用法详见脚本顶部 JSDoc`);
process.exit(1);