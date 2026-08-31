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
 * 【用法】
 *   node scripts/ts-migrate.mjs convert <file> [--to ts|tsx] [--dry]
 *       将 <file> 改名为目标扩展名（缺省按内容 JSX 判定），并全库重写其 import 说明符。
 *   node scripts/ts-migrate.mjs plan <dir>
 *       列出 <dir> 下待/可转文件 + 各自被引用次数（规划批次用，只读）。
 *   node scripts/ts-migrate.mjs update-imports <file> [--to ts|tsx] [--dry]
 *       仅重写 import 说明符（文件已改名时用）。
 *   node scripts/ts-migrate.mjs move <file> <targetDir> [--dry]
 *       把 <file> 移到 <targetDir>（横切收口用，如 hook 收口到 src/hooks/），
 *       并全库重写指向它的 import 路径（含被移动文件自身的 import，因其相对基准变了）。
 *       同样按【解析后的绝对路径】比对，规避同名 basename 误伤。
 *
 * 【注意】改完尺寸较大或被 EVENTS 引用的文件，务必跑 `npm run check:events` 确认反向校验仍自洽。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, renameSync } from 'node:fs'
import { resolve, join, dirname, extname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

// 扫描根：前端原型 + 测试。localTool/网关为独立后端，不在本次前端 TS 化范围。
const SCAN_ROOTS = [join(root, 'src'), join(root, 'tests')]
const SCAN_EXTS = ['.js', '.jsx', '.ts', '.tsx']
const GIT_MV_EXTS = ['.js', '.jsx', '.ts', '.tsx']

/** 递归收集目录内指定扩展名文件 */
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

/**
 * JSX 探测：先剥离注释与字符串/模板串，再找 HTML/组件式标签。
 * 避免把纯逻辑文件里字符串/正则中的 `<div>`、`<br>` 等 HTML 形文本误判成 JSX
 * （曾误伤 asyncGuard/utils 等纯逻辑文件）。
 */
function hasJsx(code) {
  const stripped = code
    .replace(/(^|[^\w$])\/\*[\s\S]*?\*\//g, '$1') // 块注释
    .replace(/(^|[^\w$])\/\/[^\n]*/g, '$1') // 行注释
    .replace(/(^|[^\w$])'([^'\\]|\\.)*'/g, '$1') // 单引号串
    .replace(/(^|[^\w$])"([^"\\]|\\.)*"/g, '$1') // 双引号串
    .replace(/(^|[^\w$])`([^`\\]|\\.)*`/g, '$1') // 模板串
  // JSX：开标签 <Tag、闭标签 </Tag、自闭合 <Tag ... />
  return /<\/?[A-Za-z][\w-]*(\s[^<>]*)?\/?>/.test(stripped)
}

/** 判定目标扩展名：--to 优先，否则按内容（引用 JSX → tsx，纯逻辑 → ts） */
function detectExt(code, toFlag) {
  if (toFlag) return toFlag === 'tsx' ? '.tsx' : '.ts'
  return hasJsx(code) ? '.tsx' : '.ts'
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 解析一个 import 说明符（相对/@/绝对）为绝对路径；裸包名返回 null */
function resolveSpec(spec, fromDir) {
  if (spec.startsWith('@/')) return resolve(root, 'src', spec.slice(2)) // '@' 别名 → src
  if (spec.startsWith('.')) return resolve(fromDir, spec)
  if (spec.startsWith('/')) return resolve(root, 'src', spec.slice(1))
  return null
}

/** 收集全部待扫描文件（去重，按修改时间排序做稳定基线） */
function allSources() {
  const set = new Set()
  for (const dir of SCAN_ROOTS) {
    if (!existsSync(dir)) continue
    collectFiles(dir, []).forEach((f) => set.add(f))
  }
  return [...set]
}

function toPosix(p) {
  return p.replace(/\\/g, '/')
}

/**
 * 计算「从引用文件 fromFile 指向 newAbs」的新说明符。
 * 沿用原说明符风格：原来用 `@/` 别名就仍输出别名，原来是相对路径就仍输出相对路径
 * （均以 `./` 或 `../` 打头，避免裸名被当成裸包名）。带扩展名（仓库已开 allowImportingTsExtensions）。
 */
function computeNewSpec(fromFile, newAbs, oldSpec) {
  if (oldSpec.startsWith('@/')) return '@/'.replace('@/', '@/') + toPosix(relative(resolve(root, 'src'), newAbs))
  let rel = toPosix(relative(dirname(fromFile), newAbs))
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

/**
 * 重写全库指向 oldAbs 的 import 说明符。
 * @param makeNewSpec (fromFile, fullSpec) => 新说明符；决定「换扩展名」还是「换路径」
 * @param skip 不参与重写的绝对路径集合
 * 返回被改动文件的相对路径列表。
 */
function rewriteSpecs(oldAbs, makeNewSpec, dry = false, skip = new Set()) {
  const B = basename(oldAbs, extname(oldAbs)) // 模块名（含路径无关）
  const oldExt = extname(oldAbs)
  // 在引号内出现「路径…/B.oldExt」的说明符：捕获前引号、说明符前缀、后引号
  const RE = new RegExp(`(["'\x60])([^'"\x60]*?)${escapeRe(B)}\\.${escapeRe(oldExt.slice(1))}(["'\x60])`, 'g')
  const changed = []
  for (const file of allSources()) {
    if (skip.has(file)) continue
    let src
    try { src = readFileSync(file, 'utf8') } catch { continue }
    let hit = false
    const next = src.replace(RE, (m, q1, prefix, q2) => {
      const fullSpec = prefix + B + oldExt // 完整说明符（不含引号）
      const cand = resolveSpec(fullSpec, dirname(file))
      // 仅当解析结果等于【目标文件被改名/移动前的绝对路径】才改写，避免同名 basename 误伤
      if (cand !== null && cand === oldAbs) {
        hit = true
        return q1 + makeNewSpec(file, fullSpec) + q2
      }
      return m
    })
    if (hit) {
      changed.push(file)
      if (!dry) writeFileSync(file, next, 'utf8') // --dry 只预览不落盘
    }
  }
  return changed.map((f) => f.replace(root + '/', ''))
}

/** 只换扩展名（convert / update-imports 用） */
function rewriteImports(oldAbs, newExt, dry = false) {
  const oldExt = extname(oldAbs)
  const newAbs = oldAbs.slice(0, oldAbs.length - oldExt.length) + newExt
  // 跳过目标文件自身（改名前后两种路径都不碰：避免把其头注释里的示例 import 一并改写）
  return rewriteSpecs(
    oldAbs,
    (_fromFile, fullSpec) => fullSpec.slice(0, fullSpec.length - oldExt.length) + newExt,
    dry,
    new Set([oldAbs, newAbs])
  )
}

/**
 * 换路径（move 用）：把说明符换成指向 newAbs 的新路径。
 * 与 convert 不同，这里【不跳过 newAbs】——被移动文件内部的相对 import 基准已变，必须一起重写。
 */
function rewriteImportsForMove(oldAbs, newAbs, dry = false) {
  return rewriteSpecs(oldAbs, (fromFile, fullSpec) => computeNewSpec(fromFile, newAbs, fullSpec), dry)
}

/**
 * 重写【被移动文件自身】的出向 import：文件换了目录，其内部相对路径的解析基准随之改变。
 * @param fileAbs 文件的新绝对路径
 * @param oldDir  文件移动前所在目录（用它解析现有的旧说明符）
 *
 * 【只改能解析到真实存在文件的说明符】——既是安全阀（跳过 'react' 等裸包名与文档里的虚构路径），
 * 也保证幂等：重跑时上一轮已修正的路径若按 oldDir 解析不到真实文件，就原样跳过。
 */
function rewriteOutgoingImports(fileAbs, oldDir, dry = false) {
  let src
  try { src = readFileSync(fileAbs, 'utf8') } catch { return false }
  // 覆盖 `from '…'` / `import('…')` / `require('…')` 三种说明符位置
  const RE = /((?:from|import|require)\s*\(?\s*)(["'\x60])([^'"\x60]+)(["'\x60])/g
  let hit = false
  const next = src.replace(RE, (m, head, q1, spec, q2) => {
    if (!(spec.startsWith('.') || spec.startsWith('@/') || spec.startsWith('/'))) return m // 裸包名不动
    const abs = resolveSpec(spec, oldDir)
    if (abs === null || !existsSync(abs)) return m // 解析不到真实文件 → 跳过（安全阀 + 幂等）
    const newSpec = computeNewSpec(fileAbs, abs, spec)
    if (newSpec === spec) return m
    hit = true
    return head + q1 + newSpec + q2
  })
  if (hit && !dry) writeFileSync(fileAbs, next, 'utf8')
  return hit
}

/** 用 git mv 改名（非 git 跟踪文件退回 fs rename） */
function renameFile(oldAbs, newAbs) {
  const rel = oldAbs.replace(root + '/', '')
  const res = spawnSync('git', ['mv', '--', rel, newAbs.replace(root + '/', '')], { cwd: root })
  if (res.status === 0) return 'git mv'
  try { renameSync(oldAbs, newAbs); return 'fs rename' } catch { return null }
}

const arg = process.argv.slice(2)
const cmd = arg[0]
const fileArg = arg[1]
const toFlag = arg.includes('--to') ? arg[arg.indexOf('--to') + 1] : null
const dry = arg.includes('--dry')

if (cmd === 'plan') {
  const dir = resolve(root, fileArg || 'src')
  const files = collectFiles(dir, [])
    .filter((f) => ['.js', '.jsx'].includes(extname(f)))
    .map((f) => {
      const code = readFileSync(f, 'utf8')
      return { file: f.slice(root.length + 1), to: hasJsx(code) ? '.tsx' : '.ts' }
    })
    .sort((a, b) => a.file.localeCompare(b.file))
  const byTo = files.reduce((acc, f) => { acc[f.to] = (acc[f.to] || 0) + 1; return acc }, {})
  console.log(`\n待转 ${files.length} 个文件（tsx:${byTo['.tsx'] || 0} / ts:${byTo['.ts'] || 0}）`)
  for (const f of files) console.log('  ' + f.file.padEnd(70) + ' → ' + f.to)
  process.exit(0)
}

if (cmd === 'convert' || cmd === 'update-imports') {
  if (!fileArg) { console.error('缺少 <file> 参数'); process.exit(1) }
  const oldAbs = resolve(root, fileArg)
  if (!existsSync(oldAbs)) { console.error(`文件不存在：${fileArg}`); process.exit(1) }
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
  const rel = oldAbs.replace(root + '/', '')
  if (changed.length === 0) {
    console.log(`ℹ ${rel}：无其他文件引用其 import 说明符`)
  } else {
    console.log(`✔ 已同步 ${changed.length} 个文件的 import 说明符：`)
    for (const c of changed) console.log('   - ' + c)
  }
  if (dry) console.log('（--dry 仅预览，未实际落盘/改名）')
  process.exit(0)
}

if (cmd === 'move') {
  const targetArg = arg[2]
  if (!fileArg || !targetArg) { console.error('用法：move <file> <targetDir> [--dry]'); process.exit(1) }
  const oldAbs = resolve(root, fileArg)
  const targetDir = resolve(root, targetArg)
  const newAbs = join(targetDir, basename(oldAbs))
  const alreadyMoved = !existsSync(oldAbs) && existsSync(newAbs)

  if (!existsSync(oldAbs) && !alreadyMoved) { console.error(`文件不存在：${fileArg}`); process.exit(1) }

  if (alreadyMoved) {
    // 幂等修复模式：文件已在目标位置（先前只搬了壳、漏改自身 import），跳过移动、只补重写
    console.log(`ℹ ${basename(oldAbs)} 已在目标位置，进入修复模式（只重写引用）`)
  } else if (!dry) {
    const how = renameFile(oldAbs, newAbs)
    if (!how) { console.error(`移动失败：${oldAbs} → ${newAbs}`); process.exit(1) }
    console.log(`✔ 移动 ${oldAbs.replace(root + '/', '')} → ${newAbs.replace(root + '/', '')}（${how}）`)
  } else {
    console.log(`（--dry 预览）将移动 ${oldAbs.replace(root + '/', '')} → ${newAbs.replace(root + '/', '')}`)
  }

  // ① 先修被移动文件自身的出向 import（其相对基准已从 oldDir 变成 targetDir）
  const selfFixed = rewriteOutgoingImports(newAbs, dirname(oldAbs), dry)
  if (selfFixed) console.log(`✔ 已重写 ${basename(newAbs)} 自身的出向 import 路径`)

  // ② 再修全库指向它的 import 路径
  const changed = rewriteImportsForMove(oldAbs, newAbs, dry)
  if (changed.length === 0) {
    console.log(`ℹ 无其他文件引用其 import 说明符（或仅被自身引用且无需改）`)
  } else {
    console.log(`✔ 已同步 ${changed.length} 个文件的 import 路径：`)
    for (const c of changed) console.log('   - ' + c)
  }
  if (dry) console.log('（--dry 仅预览，未实际落盘/移动）')
  process.exit(0)
}

console.error(`未知命令：${cmd}\n用法见文件头 JSDoc。`)
process.exit(1)